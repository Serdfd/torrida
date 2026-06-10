/**
 * migrations.ts
 * Sistema de migraciones incrementales para SQLite.
 * Cada migración tiene un número de versión único.
 * Se ejecutan en orden ascendente solo si no se han aplicado antes.
 */

import type { Database } from 'better-sqlite3'

// ── Tipo migración ─────────────────────────────────────────────────────────

interface Migration {
  version:     number
  description: string
  up:          (db: Database) => void
}

// ── Tabla de control ───────────────────────────────────────────────────────

function ensureMigrationsTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version      INTEGER PRIMARY KEY,
      description  TEXT    NOT NULL,
      applied_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

function getAppliedVersions(db: Database): Set<number> {
  const rows = db
    .prepare<[], { version: number }>(`SELECT version FROM _migrations`)
    .all()
  return new Set(rows.map(r => r.version))
}

function markApplied(db: Database, migration: Migration): void {
  db.prepare(
    `INSERT INTO _migrations (version, description)
     VALUES (?, ?)`
  ).run(migration.version, migration.description)
}

// ── Lista de migraciones ───────────────────────────────────────────────────

const MIGRATIONS: Migration[] = [

  // ── v1: Columna ciudad en ventas ────────────────────────────────────────
  {
    version:     1,
    description: 'Agregar columna ciudad_destino a ventas',
    up(db) {
      db.exec(`
        ALTER TABLE ventas
        ADD COLUMN ciudad_destino TEXT
      `)
    }
  },

  // ── v2: Columna tags en productos ───────────────────────────────────────
  {
    version:     2,
    description: 'Agregar columna tags a productos',
    up(db) {
      db.exec(`
        ALTER TABLE productos
        ADD COLUMN tags TEXT
      `)
    }
  },

  // ── v3: Columna notas en cierres ────────────────────────────────────────
  {
    version:     3,
    description: 'Agregar columna notas a cierres_mensuales',
    up(db) {
      // Ya existe en schema, solo para consistencia de migraciones
      try {
        db.exec(`
          ALTER TABLE cierres_mensuales
          ADD COLUMN notas TEXT
        `)
      } catch {
        // Columna ya existe, ignorar
      }
    }
  },

  // ── v4: Índice en venta_items por producto ──────────────────────────────
  {
    version:     4,
    description: 'Índice adicional en venta_items por producto_id + talla_id',
    up(db) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_venta_items_prod_talla
          ON venta_items(producto_id, talla_id)
      `)
    }
  },

  // ── v5: Tabla de notas rápidas ──────────────────────────────────────────
  {
    version:     5,
    description: 'Crear tabla notas_rapidas',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS notas_rapidas (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          contenido  TEXT    NOT NULL,
          color      TEXT    NOT NULL DEFAULT '#FBBF24',
          fijada     INTEGER NOT NULL DEFAULT 0,
          created_at TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `)
    }
  },

  // ── v6: Columna número de guía en ventas ────────────────────────────────
  {
    version:     6,
    description: 'Agregar numero_guia y transportadora a ventas',
    up(db) {
      db.exec(`
        ALTER TABLE ventas ADD COLUMN numero_guia    TEXT;
        ALTER TABLE ventas ADD COLUMN transportadora TEXT;
      `)
    }
  },

  // ── v7: Vista de rentabilidad por producto ──────────────────────────────
  {
    version:     7,
    description: 'Crear vista v_rentabilidad_productos',
    up(db) {
      db.exec(`
        CREATE VIEW IF NOT EXISTS v_rentabilidad_productos AS
        SELECT
          p.id                                          AS producto_id,
          p.nombre                                      AS producto,
          COALESCE(SUM(vi.cantidad), 0)                 AS unidades_vendidas,
          COALESCE(SUM(vi.subtotal_item), 0)            AS ingresos,
          COALESCE(
            SUM(vi.cantidad * COALESCE(p.costo_unitario, 0)), 0
          )                                             AS costo_total,
          COALESCE(SUM(vi.subtotal_item), 0) -
          COALESCE(
            SUM(vi.cantidad * COALESCE(p.costo_unitario, 0)), 0
          )                                             AS utilidad
        FROM productos p
        LEFT JOIN venta_items vi ON vi.producto_id = p.id
        LEFT JOIN ventas       v  ON v.id = vi.venta_id
                                 AND v.estado != 'cancelado'
        WHERE p.activo = 1
        GROUP BY p.id
      `)
    }
  },

  // ── v8: Columna descuento_global en ventas ──────────────────────────────
  {
    version:     8,
    description: 'Agregar columna descuento_tipo a ventas',
    up(db) {
      db.exec(`
        ALTER TABLE ventas
        ADD COLUMN descuento_tipo TEXT DEFAULT 'monto'
        CHECK(descuento_tipo IN ('monto', 'porcentaje'))
      `)
    }
  },

  // ── v9: Índice en gastos por fecha y categoría ──────────────────────────
  {
    version:     9,
    description: 'Índice compuesto en gastos(fecha, categoria_id)',
    up(db) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_gastos_fecha_cat
          ON gastos(fecha, categoria_id)
      `)
    }
  },

  // ── v10: Tabla de metas mensuales ───────────────────────────────────────
  {
    version:     10,
    description: 'Crear tabla metas_mensuales',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS metas_mensuales (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          anio            INTEGER NOT NULL,
          mes             INTEGER NOT NULL,
          meta_ingresos   REAL    NOT NULL DEFAULT 0,
          meta_unidades   INTEGER NOT NULL DEFAULT 0,
          meta_utilidad   REAL    NOT NULL DEFAULT 0,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),

          UNIQUE(anio, mes)
        )
      `)
    }
  },

  // ── v11: Columna estado_envio en ventas ─────────────────────────────────
  {
    version:     11,
    description: 'Agregar estado_envio a ventas',
    up(db) {
      db.exec(`
        ALTER TABLE ventas
        ADD COLUMN estado_envio TEXT DEFAULT 'pendiente'
        CHECK(estado_envio IN
          ('pendiente','preparando','enviado','entregado','devuelto')
        )
      `)
    }
  },

  // ── v13: Tablas de sesiones fotográficas ────────────────────────────────
  {
    version:     13,
    description: 'Crear tablas sesiones_fotograficas y sesion_fotografica_items',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sesiones_fotograficas (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha          TEXT    NOT NULL,
          fotografo      TEXT,
          costo_total    REAL    NOT NULL DEFAULT 0,
          cantidad_looks INTEGER NOT NULL DEFAULT 0,
          notas          TEXT,
          created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sesion_fotografica_items (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          sesion_id       INTEGER NOT NULL REFERENCES sesiones_fotograficas(id) ON DELETE CASCADE,
          producto_id     INTEGER REFERENCES productos(id) ON DELETE SET NULL,
          descripcion     TEXT,
          costo_asignado  REAL    NOT NULL DEFAULT 0,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_sesion_items_sesion
          ON sesion_fotografica_items(sesion_id);
      `)
    }
  },

  // ── v12: View resumen anual ──────────────────────────────────────────────
  {
    version:     12,
    description: 'Crear vista v_resumen_anual',
    up(db) {
      db.exec(`
        CREATE VIEW IF NOT EXISTS v_resumen_anual AS
        SELECT
          strftime('%Y', fecha)            AS anio,
          strftime('%m', fecha)            AS mes,
          COUNT(id)                        AS ventas,
          COALESCE(SUM(total), 0)          AS ingresos,
          COALESCE(SUM(comision_canal), 0) AS comisiones,
          COALESCE(SUM(costo_envio),    0) AS costos_envio
        FROM ventas
        WHERE estado != 'cancelado'
        GROUP BY anio, mes
        ORDER BY anio DESC, mes DESC
      `)
    }
  }

]

// ── Runner principal ───────────────────────────────────────────────────────

/**
 * Ejecuta todas las migraciones pendientes en orden.
 * Se llama desde el proceso principal de Electron al arrancar.
 */
export function runMigrations(db: Database): void {
  ensureMigrationsTable(db)

  const applied = getAppliedVersions(db)
  const pending = MIGRATIONS
    .filter(m => !applied.has(m.version))
    .sort((a, b) => a.version - b.version)

  if (pending.length === 0) {
    console.log('[migrations] ✅ Sin migraciones pendientes')
    return
  }

  console.log(`[migrations] 🔄 Aplicando ${pending.length} migración(es)…`)

  const runAll = db.transaction(() => {
    for (const migration of pending) {
      try {
        migration.up(db)
        markApplied(db, migration)
        console.log(
          `[migrations] ✓ v${migration.version} — ${migration.description}`
        )
      } catch (err) {
        console.error(
          `[migrations] ✗ v${migration.version} FALLÓ:`, err
        )
        throw err // Rollback
      }
    }
  })

  try {
    runAll()
    console.log('[migrations] ✅ Todas las migraciones aplicadas')
  } catch (err) {
    console.error('[migrations] ❌ Rollback ejecutado por error en migración')
    throw err
  }
}

/**
 * Retorna el estado actual de las migraciones.
 */
export function getMigrationsStatus(db: Database): {
  version:     number
  description: string
  applied:     boolean
  applied_at:  string | null
}[] {
  ensureMigrationsTable(db)

  const rows = db
    .prepare<[], { version: number; description: string; applied_at: string }>(
      `SELECT version, description, applied_at FROM _migrations`
    )
    .all()

  const appliedMap = new Map(rows.map(r => [r.version, r.applied_at]))

  return MIGRATIONS.map(m => ({
    version:     m.version,
    description: m.description,
    applied:     appliedMap.has(m.version),
    applied_at:  appliedMap.get(m.version) ?? null
  }))
}