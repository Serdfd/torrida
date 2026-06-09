/**
 * db.ts
 * Capa de acceso a la base de datos SQLite via Electron IPC.
 * Expone helpers tipados que usan window.electronAPI.db internamente.
 */

// ── Tipos base ─────────────────────────────────────────────────────────────

export interface RunResult {
  changes:         number
  lastInsertRowid: number
}

export interface DbAPI {
  query: <T = Record<string, unknown>>(
    sql:    string,
    params?: unknown[]
  ) => Promise<T[]>

  run: (
    sql:    string,
    params?: unknown[]
  ) => Promise<RunResult>
}

// ── Acceso tipado ──────────────────────────────────────────────────────────

/**
 * Shorthand para window.electronAPI.db.query<T>
 * Lanza error si la API no está disponible.
 */
export async function dbQuery<T = Record<string, unknown>>(
  sql:     string,
  params?: unknown[]
): Promise<T[]> {
  if (!window.electronAPI?.db) {
    throw new Error('[db] electronAPI no disponible')
  }
  return window.electronAPI.db.query<T>(sql, params)
}

/**
 * Shorthand para window.electronAPI.db.run
 */
export async function dbRun(
  sql:     string,
  params?: unknown[]
): Promise<RunResult> {
  if (!window.electronAPI?.db) {
    throw new Error('[db] electronAPI no disponible')
  }
  return window.electronAPI.db.run(sql, params)
}

/**
 * Retorna el primer resultado o null.
 */
export async function dbFirst<T = Record<string, unknown>>(
  sql:     string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await dbQuery<T>(sql, params)
  return rows[0] ?? null
}

// ── Transacciones ──────────────────────────────────────────────────────────

/**
 * Ejecuta múltiples sentencias en secuencia.
 * No es una transacción real de SQLite, pero agrupa
 * la lógica para claridad.
 * Para transacciones reales usa el handler de Electron.
 */
export async function dbBatch(
  statements: { sql: string; params?: unknown[] }[]
): Promise<RunResult[]> {
  const results: RunResult[] = []
  for (const stmt of statements) {
    const r = await dbRun(stmt.sql, stmt.params)
    results.push(r)
  }
  return results
}

// ── Helpers CRUD genéricos ─────────────────────────────────────────────────

/**
 * INSERT genérico.
 * Ej: dbInsert('productos', { nombre: 'Biker', precio_venta: 80000 })
 */
export async function dbInsert(
  tabla:  string,
  datos:  Record<string, unknown>
): Promise<RunResult> {
  const cols    = Object.keys(datos)
  const valores = Object.values(datos)
  const marks   = cols.map(() => '?').join(', ')

  const sql = `
    INSERT INTO ${tabla}
      (${cols.join(', ')}, created_at, updated_at)
    VALUES
      (${marks}, datetime('now'), datetime('now'))
  `
  return dbRun(sql, valores)
}

/**
 * UPDATE genérico por ID.
 * Ej: dbUpdate('productos', { nombre: 'Nuevo' }, 5)
 */
export async function dbUpdate(
  tabla:  string,
  datos:  Record<string, unknown>,
  id:     number
): Promise<RunResult> {
  const cols    = Object.keys(datos)
  const valores = Object.values(datos)
  const sets    = cols.map(c => `${c} = ?`).join(', ')

  const sql = `
    UPDATE ${tabla}
    SET ${sets}, updated_at = datetime('now')
    WHERE id = ?
  `
  return dbRun(sql, [...valores, id])
}

/**
 * DELETE genérico por ID.
 */
export async function dbDelete(
  tabla: string,
  id:    number
): Promise<RunResult> {
  return dbRun(`DELETE FROM ${tabla} WHERE id = ?`, [id])
}

/**
 * SELECT genérico por ID.
 */
export async function dbFindById<T = Record<string, unknown>>(
  tabla: string,
  id:    number
): Promise<T | null> {
  return dbFirst<T>(`SELECT * FROM ${tabla} WHERE id = ?`, [id])
}

/**
 * SELECT todos de una tabla con ORDER BY opcional.
 */
export async function dbFindAll<T = Record<string, unknown>>(
  tabla:   string,
  orderBy = 'id ASC'
): Promise<T[]> {
  return dbQuery<T>(`SELECT * FROM ${tabla} ORDER BY ${orderBy}`)
}

// ── UPSERT helpers ─────────────────────────────────────────────────────────

/**
 * INSERT OR REPLACE para tabla configuracion_app (clave/valor).
 */
export async function dbSetConfig(
  clave: string,
  valor: string
): Promise<RunResult> {
  return dbRun(
    `INSERT INTO configuracion_app (clave, valor, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(clave)
     DO UPDATE SET valor = ?, updated_at = datetime('now')`,
    [clave, valor, valor]
  )
}

/**
 * Obtiene un valor de configuracion_app por clave.
 */
export async function dbGetConfig(
  clave:        string,
  defaultValor = ''
): Promise<string> {
  const row = await dbFirst<{ valor: string }>(
    `SELECT valor FROM configuracion_app WHERE clave = ?`,
    [clave]
  )
  return row?.valor ?? defaultValor
}

/**
 * Obtiene múltiples claves de configuracion_app como objeto.
 * Ej: dbGetConfigs(['nombre_negocio', 'moneda'])
 */
export async function dbGetConfigs(
  claves: string[]
): Promise<Record<string, string>> {
  const rows = await dbQuery<{ clave: string; valor: string }>(
    `SELECT clave, valor FROM configuracion_app
     WHERE clave IN (${claves.map(() => '?').join(', ')})`,
    claves
  )
  const map: Record<string, string> = {}
  rows.forEach(r => { map[r.clave] = r.valor })
  return map
}

// ── Inventario helpers ─────────────────────────────────────────────────────

/**
 * Actualiza stock sumando un delta (+/-).
 */
export async function dbAjustarStock(
  productoId: number,
  tallaId:    number,
  delta:      number
): Promise<RunResult> {
  return dbRun(
    `UPDATE inventario_productos
     SET stock      = MAX(0, stock + ?),
         updated_at = datetime('now')
     WHERE producto_id = ? AND talla_id = ?`,
    [delta, productoId, tallaId]
  )
}

/**
 * Descuenta stock por cada item de una venta.
 * items: [{ producto_id, talla_id, cantidad }]
 */
export async function dbDescontarStockVenta(
  items: { producto_id: number; talla_id: number; cantidad: number }[]
): Promise<void> {
  for (const item of items) {
    await dbAjustarStock(item.producto_id, item.talla_id, -item.cantidad)
  }
}

/**
 * Revierte el stock de una venta cancelada.
 */
export async function dbRevertirStockVenta(
  items: { producto_id: number; talla_id: number; cantidad: number }[]
): Promise<void> {
  for (const item of items) {
    await dbAjustarStock(item.producto_id, item.talla_id, +item.cantidad)
  }
}

// ── Schema check ───────────────────────────────────────────────────────────

/**
 * Verifica si una tabla existe en la base de datos.
 */
export async function dbTableExists(tabla: string): Promise<boolean> {
  const row = await dbFirst<{ name: string }>(
    `SELECT name FROM sqlite_master
     WHERE type='table' AND name=?`,
    [tabla]
  )
  return Boolean(row)
}

/**
 * Retorna las columnas de una tabla.
 */
export async function dbGetColumns(tabla: string): Promise<string[]> {
  const rows = await dbQuery<{ name: string }>(
    `PRAGMA table_info(${tabla})`
  )
  return rows.map(r => r.name)
}