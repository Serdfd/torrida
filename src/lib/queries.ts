/**
 * queries.ts
 * Todas las consultas SQL reutilizables de la app.
 * Cada función retorna datos tipados usando window.electronAPI.db.query
 */

// ── Tipos base ─────────────────────────────────────────────────────────────

export interface StockItem {
  producto_id:      number
  producto_nombre:  string
  talla_id:         number
  talla_nombre:     string
  stock:            number
  costo_unitario:   number | null
}

export interface DashboardKpis {
  ingresos_mes:      number
  unidades_vendidas: number
  devoluciones:      number
  gastos_mes:        number
  ticket_promedio:   number
  ventas_count:      number
  comision_pasarela: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function rangoMes(anio: number, mes: number) {
  const desde = `${anio}-${pad(mes)}-01`
  const hasta = `${anio}-${pad(mes)}-31`
  return { desde, hasta }
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboardKpis(
  anio: number,
  mes:  number
): Promise<DashboardKpis> {
  const { desde, hasta } = rangoMes(anio, mes)

  const [ventasRow] = await window.electronAPI.db.query<{
    ingresos:           number
    devoluciones:       number
    ticket:             number
    count:              number
    comision_pasarela:  number
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN estado != 'cancelado' THEN total ELSE 0 END), 0)              AS ingresos,
       COALESCE(SUM(CASE WHEN estado  = 'cancelado' THEN 1    ELSE 0 END), 0)               AS devoluciones,
       COALESCE(AVG(CASE WHEN estado != 'cancelado' THEN total END), 0)                     AS ticket,
       COUNT(CASE WHEN estado != 'cancelado' THEN 1 END)                                    AS count,
       COALESCE(SUM(CASE WHEN estado != 'cancelado' THEN COALESCE(comision_canal,0) + COALESCE(comision_medio_pago,0) ELSE 0 END),0) AS comision_pasarela
     FROM ventas
     WHERE fecha BETWEEN ? AND ?`,
    [desde, hasta]
  )

  const [unidadesRow] = await window.electronAPI.db.query<{ unidades: number }>(
    `SELECT COALESCE(SUM(vi.cantidad), 0) AS unidades
     FROM venta_items vi
     JOIN ventas v ON v.id = vi.venta_id
     WHERE v.fecha BETWEEN ? AND ? AND v.estado != 'cancelado'`,
    [desde, hasta]
  )

  const [gastosRow] = await window.electronAPI.db.query<{ total: number }>(
    `SELECT COALESCE(SUM(monto), 0) AS total
     FROM gastos
     WHERE fecha BETWEEN ? AND ?`,
    [desde, hasta]
  )

  return {
    ingresos_mes:      ventasRow?.ingresos      ?? 0,
    unidades_vendidas: unidadesRow?.unidades    ?? 0,
    devoluciones:      ventasRow?.devoluciones  ?? 0,
    gastos_mes:        gastosRow?.total         ?? 0,
    ticket_promedio:   ventasRow?.ticket        ?? 0,
    ventas_count:      ventasRow?.count         ?? 0,
    comision_pasarela: ventasRow?.comision_pasarela ?? 0,
  }
}

// ── Ventas ─────────────────────────────────────────────────────────────────

export async function getVentas(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT
       v.*,
       c.nombre  AS canal_nombre,
       mp.nombre AS medio_pago_nombre,
       COALESCE((SELECT SUM(vi.utilidad_item) FROM venta_items vi WHERE vi.venta_id = v.id), 0) AS utilidad_total
     FROM ventas v
     LEFT JOIN canales_venta c  ON c.id  = v.canal_id
     LEFT JOIN medios_pago   mp ON mp.id = v.medio_pago_id
     WHERE v.fecha BETWEEN ? AND ?
     ORDER BY v.fecha DESC, v.created_at DESC`,
    [desde, hasta]
  )
}

export async function getVentaById(id: number) {
  const [venta] = await window.electronAPI.db.query(
    `SELECT
       v.*,
       c.nombre   AS canal_nombre,
       mp.nombre  AS medio_pago_nombre,
       tr.nombre  AS transportadora_nombre
     FROM ventas v
     LEFT JOIN canales_venta   c  ON c.id  = v.canal_id
     LEFT JOIN medios_pago     mp ON mp.id = v.medio_pago_id
     LEFT JOIN transportadoras tr ON tr.id = v.transportadora_id
     WHERE v.id = ?`,
    [id]
  )

  const items = await window.electronAPI.db.query(
    `SELECT
       vi.*,
       p.nombre     AS producto_nombre,
       t.nombre     AS talla_nombre
     FROM venta_items vi
     LEFT JOIN productos p ON p.id = vi.producto_id
     LEFT JOIN tallas    t ON t.id = vi.talla_id
     WHERE vi.venta_id = ?
     ORDER BY vi.id ASC`,
    [id]
  )

  return { ...venta, items }
}

export async function getVentasPorCanal(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT
       c.nombre                         AS canal,
       COUNT(v.id)                      AS cantidad,
       COALESCE(SUM(v.total), 0)        AS total,
       COALESCE(SUM(v.comision_canal),0) AS comisiones
     FROM ventas v
     LEFT JOIN canales_venta c ON c.id = v.canal_id
     WHERE v.fecha BETWEEN ? AND ?
       AND v.estado != 'cancelado'
     GROUP BY v.canal_id
     ORDER BY total DESC`,
    [desde, hasta]
  )
}

export async function getVentasPorDepartamento(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT
       envio_departamento                AS zona,
       COUNT(id)                         AS cantidad,
       COALESCE(SUM(total), 0)           AS total
     FROM ventas
     WHERE fecha BETWEEN ? AND ?
       AND estado != 'cancelado'
       AND envio_departamento IS NOT NULL
       AND TRIM(envio_departamento) != ''
     GROUP BY envio_departamento
     ORDER BY total DESC`,
    [desde, hasta]
  )
}

export async function getVentasPorCiudad(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT
       envio_ciudad                      AS zona,
       COUNT(id)                         AS cantidad,
       COALESCE(SUM(total), 0)           AS total
     FROM ventas
     WHERE fecha BETWEEN ? AND ?
       AND estado != 'cancelado'
       AND envio_ciudad IS NOT NULL
       AND TRIM(envio_ciudad) != ''
     GROUP BY envio_ciudad
     ORDER BY total DESC`,
    [desde, hasta]
  )
}

export async function getTopProductos(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT
       p.nombre                          AS producto_nombre,
       COALESCE(SUM(vi.cantidad), 0)     AS unidades,
       COALESCE(SUM(vi.precio_unitario * vi.cantidad - vi.descuento_item), 0) AS total
     FROM venta_items vi
     JOIN ventas v   ON v.id = vi.venta_id
     JOIN productos p ON p.id = vi.producto_id
     WHERE v.fecha BETWEEN ? AND ?
       AND v.estado != 'cancelado'
     GROUP BY vi.producto_id
     ORDER BY unidades DESC
     LIMIT 5`,
    [desde, hasta]
  )
}

export async function getTallasMasVendidas(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT
       t.nombre                          AS talla,
       COALESCE(SUM(vi.cantidad), 0)     AS unidades
     FROM venta_items vi
     JOIN ventas v ON v.id = vi.venta_id
     JOIN tallas t ON t.id = vi.talla_id
     WHERE v.fecha BETWEEN ? AND ?
       AND v.estado != 'cancelado'
     GROUP BY vi.talla_id
     ORDER BY unidades DESC`,
    [desde, hasta]
  )
}

export async function getGastosPorCategoria(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT
       COALESCE(cg.nombre, 'Sin categoría') AS categoria,
       COALESCE(SUM(g.monto), 0)            AS total
     FROM gastos g
     LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_id
     WHERE g.fecha BETWEEN ? AND ?
     GROUP BY g.categoria_id
     ORDER BY total DESC`,
    [desde, hasta]
  )
}

export async function getEnviosPendientes(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT COUNT(*) AS total
     FROM ventas
     WHERE fecha BETWEEN ? AND ?
       AND estado != 'cancelado'
       AND envio_pendiente = 1`,
    [desde, hasta]
  )
}

export async function getUnidadesPorMes() {
  return window.electronAPI.db.query(
    `SELECT
       strftime('%Y-%m', v.fecha)        AS mes,
       COALESCE(SUM(vi.cantidad), 0)     AS unidades,
       COUNT(DISTINCT v.id)              AS ventas
     FROM venta_items vi
     JOIN ventas v ON v.id = vi.venta_id
     WHERE v.fecha >= date('now','-6 months')
       AND v.estado != 'cancelado'
     GROUP BY mes
     ORDER BY mes ASC`
  )
}

export async function getVentasPorMedioPago(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT
       COALESCE(mp.nombre, 'Sin especificar') AS nombre,
       COUNT(v.id)                            AS cantidad,
       COALESCE(SUM(v.total), 0)              AS total
     FROM ventas v
     LEFT JOIN medios_pago mp ON mp.id = v.medio_pago_id
     WHERE v.fecha BETWEEN ? AND ?
       AND v.estado != 'cancelado'
     GROUP BY v.medio_pago_id
     ORDER BY total DESC`,
    [desde, hasta]
  )
}

export async function getVentasDiarias(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT
       v.fecha,
       COUNT(v.id)               AS cantidad,
       COALESCE(SUM(v.total), 0) AS total
     FROM ventas v
     WHERE v.fecha BETWEEN ? AND ?
       AND v.estado != 'cancelado'
     GROUP BY v.fecha
     ORDER BY v.fecha ASC`,
    [desde, hasta]
  )
}

export async function getHeatmapPorMes(anio: number) {
  return window.electronAPI.db.query(
    `SELECT
       CAST(strftime('%m', fecha) AS INTEGER) AS mes,
       COUNT(id)                              AS ventas,
       COALESCE(SUM(total), 0)               AS total
     FROM ventas
     WHERE strftime('%Y', fecha) = ?
       AND estado != 'cancelado'
     GROUP BY mes
     ORDER BY mes ASC`,
    [String(anio)]
  )
}

export async function getHeatmapPorDiaMes(anio: number) {
  return window.electronAPI.db.query(
    `SELECT
       CAST(strftime('%d', fecha) AS INTEGER) AS dia,
       COUNT(id)                              AS ventas,
       COALESCE(SUM(total), 0)               AS total
     FROM ventas
     WHERE strftime('%Y', fecha) = ?
       AND estado != 'cancelado'
     GROUP BY dia
     ORDER BY dia ASC`,
    [String(anio)]
  )
}

export async function getHeatmapPorDiaSemana(anio: number) {
  // SQLite: strftime('%w') → 0=Dom, 1=Lun … 6=Sáb
  return window.electronAPI.db.query(
    `SELECT
       CAST(strftime('%w', fecha) AS INTEGER) AS dow,
       COUNT(id)                              AS ventas,
       COALESCE(SUM(total), 0)               AS total
     FROM ventas
     WHERE strftime('%Y', fecha) = ?
       AND estado != 'cancelado'
     GROUP BY dow
     ORDER BY dow ASC`,
    [String(anio)]
  )
}

export async function getHeatmapSemanaHora(anio: number) {
  // Asegurar que la columna creado_en existe antes de consultarla
  await window.electronAPI.db.run(`ALTER TABLE ventas ADD COLUMN creado_en TEXT`, [])
    .catch(() => { /* ya existe, ignorar */ })

  return window.electronAPI.db.query<{ dow: number; hora: number; ventas: number; total: number }>(
    `SELECT
       CAST(strftime('%w', COALESCE(creado_en, fecha)) AS INTEGER) AS dow,
       CAST(strftime('%H', COALESCE(creado_en, fecha)) AS INTEGER) AS hora,
       COUNT(id)                                                   AS ventas,
       COALESCE(SUM(total), 0)                                     AS total
     FROM ventas
     WHERE strftime('%Y', COALESCE(creado_en, fecha)) = ?
       AND estado != 'cancelado'
     GROUP BY dow, hora
     ORDER BY dow ASC, hora ASC`,
    [String(anio)]
  )
}

// ── Gastos ─────────────────────────────────────────────────────────────────

export async function getGastos(anio: number, mes: number) {
  const { desde, hasta } = rangoMes(anio, mes)
  return window.electronAPI.db.query(
    `SELECT
       g.*,
       cg.nombre AS categoria_nombre,
       cg.color  AS categoria_color
     FROM gastos g
     LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_id
     WHERE g.fecha BETWEEN ? AND ?
     ORDER BY g.fecha DESC, g.created_at DESC`,
    [desde, hasta]
  )
}

export async function getTotalGastos(anio: number, mes: number): Promise<number> {
  const { desde, hasta } = rangoMes(anio, mes)
  const [row] = await window.electronAPI.db.query<{ total: number }>(
    `SELECT COALESCE(SUM(monto), 0) AS total
     FROM gastos
     WHERE fecha BETWEEN ? AND ?`,
    [desde, hasta]
  )
  return row?.total ?? 0
}

// ── Inventario ─────────────────────────────────────────────────────────────

export async function getStockCompleto(): Promise<StockItem[]> {
  return window.electronAPI.db.query<StockItem>(
    `SELECT
       ip.producto_id,
       p.nombre   AS producto_nombre,
       ip.talla_id,
       t.nombre   AS talla_nombre,
       ip.stock,
       COALESCE(fc.costo_total, p.costo_unitario, 0) AS costo_unitario
     FROM inventario_productos ip
     JOIN productos p ON p.id = ip.producto_id
     JOIN tallas    t ON t.id = ip.talla_id
     LEFT JOIN fichas_costo fc ON fc.producto_id = p.id AND fc.vigente = 1
     WHERE p.activo = 1
     ORDER BY p.nombre ASC, t.orden ASC`
  )
}

export async function getStockBajoMinimo(minimo = 3): Promise<StockItem[]> {
  return window.electronAPI.db.query<StockItem>(
    `SELECT
       ip.producto_id,
       p.nombre   AS producto_nombre,
       ip.talla_id,
       t.nombre   AS talla_nombre,
       ip.stock,
       COALESCE(fc.costo_total, p.costo_unitario, 0) AS costo_unitario
     FROM inventario_productos ip
     JOIN productos p ON p.id = ip.producto_id
     JOIN tallas    t ON t.id = ip.talla_id
     LEFT JOIN fichas_costo fc ON fc.producto_id = p.id AND fc.vigente = 1
     WHERE ip.stock <= ?
       AND p.activo = 1
     ORDER BY ip.stock ASC, p.nombre ASC`,
    [minimo]
  )
}

// ── Productos ──────────────────────────────────────────────────────────────

export async function getProductos(soloActivos = true) {
  return window.electronAPI.db.query(
    `SELECT
       p.*,
       c.nombre AS coleccion_nombre,
       COALESCE(fc.costo_total, p.costo_unitario, 0) AS costo_unitario
     FROM productos p
     LEFT JOIN colecciones c ON c.id = p.coleccion_id
     LEFT JOIN fichas_costo fc ON fc.producto_id = p.id AND fc.vigente = 1
     ${soloActivos ? 'WHERE p.activo = 1' : ''}
     ORDER BY p.nombre ASC`
  )
}

// ── Catálogos ──────────────────────────────────────────────────────────────

export async function getCanalesVenta() {
  return window.electronAPI.db.query(
    `SELECT * FROM canales_venta
     WHERE activo = 1
     ORDER BY nombre ASC`
  )
}

export async function getMediosPago() {
  return window.electronAPI.db.query(
    `SELECT * FROM medios_pago
     WHERE activo = 1
     ORDER BY nombre ASC`
  )
}

export async function getTallas() {
  return window.electronAPI.db.query(
    `SELECT * FROM tallas
     WHERE activo = 1
     ORDER BY orden ASC, nombre ASC`
  )
}

export async function getColecciones(soloActivas = true) {
  return window.electronAPI.db.query(
    `SELECT * FROM colecciones
     ${soloActivas ? 'WHERE activa = 1' : ''}
     ORDER BY anio DESC, nombre ASC`
  )
}

// ── Cierres mensuales ──────────────────────────────────────────────────────

export async function getCierreMensual(anio: number, mes: number) {
  const [row] = await window.electronAPI.db.query(
    `SELECT * FROM cierres_mensuales
     WHERE anio = ? AND mes = ?
     LIMIT 1`,
    [anio, mes]
  )
  return row ?? null
}

export async function getCierresHistorial() {
  return window.electronAPI.db.query(
    `SELECT * FROM cierres_mensuales
     ORDER BY anio DESC, mes DESC
     LIMIT 24`
  )
}

export async function isMesCerrado(anio: number, mes: number): Promise<boolean> {
  const [row] = await window.electronAPI.db.query<{ cerrado: number }>(
    `SELECT cerrado FROM cierres_mensuales WHERE anio = ? AND mes = ? LIMIT 1`,
    [anio, mes]
  )
  return Boolean(row?.cerrado)
}

// ── Reportes comparativos ──────────────────────────────────────────────────

export async function getComparativaMeses(anio: number) {
  return window.electronAPI.db.query(
    `SELECT
       strftime('%m', v.fecha)                                            AS mes,
       COUNT(v.id)                                                        AS ventas,
       COALESCE(SUM(v.total), 0)                                         AS ingresos,
       COALESCE(SUM(v.comision_canal + COALESCE(v.comision_medio_pago,0)), 0) AS comisiones,
       COALESCE(SUM(CASE WHEN v.costo_envio_real > 0 THEN v.costo_envio_real ELSE v.costo_envio END), 0) AS envios,
       COALESCE(SUM(vi_sum.total_utilidad), 0)                           AS utilidad_bruta
     FROM ventas v
     LEFT JOIN (
       SELECT venta_id, SUM(utilidad_item) AS total_utilidad
       FROM venta_items GROUP BY venta_id
     ) vi_sum ON vi_sum.venta_id = v.id
     WHERE strftime('%Y', v.fecha) = ?
       AND v.estado != 'cancelado'
     GROUP BY mes
     ORDER BY mes ASC`,
    [String(anio)]
  )
}

export async function getComparativaGastosMeses(anio: number) {
  return window.electronAPI.db.query(
    `SELECT
       strftime('%m', fecha)         AS mes,
       COALESCE(SUM(monto), 0)       AS gastos,
       COUNT(id)                     AS registros
     FROM gastos
     WHERE strftime('%Y', fecha) = ?
     GROUP BY mes
     ORDER BY mes ASC`,
    [String(anio)]
  )
}

export async function getEvolucionStock() {
  return window.electronAPI.db.query(
    `SELECT
       p.nombre                       AS producto,
       SUM(ip.stock)                  AS stock_total,
       SUM(ip.stock * COALESCE(p.costo_unitario, 0)) AS valor
     FROM inventario_productos ip
     JOIN productos p ON p.id = ip.producto_id
     WHERE p.activo = 1
     GROUP BY ip.producto_id
     ORDER BY stock_total DESC`
  )
}