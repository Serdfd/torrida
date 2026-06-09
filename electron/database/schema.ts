export const SCHEMA_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ─────────────────────────────────────────
-- ADMINISTRACIÓN
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  rol         TEXT NOT NULL DEFAULT 'socia', -- socia | admin
  activo      INTEGER NOT NULL DEFAULT 1,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS configuracion_app (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  clave           TEXT UNIQUE NOT NULL,
  valor           TEXT NOT NULL,
  actualizado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proveedores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  contacto    TEXT,
  telefono    TEXT,
  notas       TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categorias_insumo (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  color     TEXT NOT NULL DEFAULT '#E07A5F'
);

CREATE TABLE IF NOT EXISTS insumos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  unidad          TEXT NOT NULL DEFAULT 'unidad', -- unidad | metro | kg | rollo
  categoria_id    INTEGER REFERENCES categorias_insumo(id),
  proveedor_id    INTEGER REFERENCES proveedores(id),
  stock_minimo    REAL NOT NULL DEFAULT 0,
  activo          INTEGER NOT NULL DEFAULT 1,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS insumo_lotes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  insumo_id       INTEGER NOT NULL REFERENCES insumos(id),
  proveedor_id    INTEGER REFERENCES proveedores(id),
  fecha_compra    TEXT NOT NULL,
  cantidad        REAL NOT NULL,
  precio_unitario REAL NOT NULL,
  precio_total    REAL NOT NULL,
  notas           TEXT,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS canales_venta (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  comision_pct  REAL NOT NULL DEFAULT 0,
  activo        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS medios_pago (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT NOT NULL,
  activo  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tallas (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT NOT NULL,
  orden   INTEGER NOT NULL DEFAULT 0,
  activo  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categorias_gasto (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT NOT NULL,
  color   TEXT NOT NULL DEFAULT '#8A8AA8'
);

-- ─────────────────────────────────────────
-- FOTOGRAFÍA
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sesiones_fotograficas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha           TEXT NOT NULL,
  fotografo       TEXT,
  costo_total     REAL NOT NULL DEFAULT 0,
  cantidad_looks  INTEGER NOT NULL DEFAULT 0,
  notas           TEXT,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sesion_fotografica_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id       INTEGER NOT NULL REFERENCES sesiones_fotograficas(id),
  producto_id     INTEGER REFERENCES productos(id),
  descripcion     TEXT,
  costo_asignado  REAL NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────
-- COLECCIONES Y PRODUCTOS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS colecciones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  temporada   TEXT,
  anio        INTEGER,
  activa      INTEGER NOT NULL DEFAULT 1,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS productos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  coleccion_id    INTEGER REFERENCES colecciones(id),
  sku             TEXT UNIQUE,
  imagen_url      TEXT,
  activo          INTEGER NOT NULL DEFAULT 1,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS producto_tallas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  talla_id    INTEGER NOT NULL REFERENCES tallas(id),
  activa      INTEGER NOT NULL DEFAULT 1,
  UNIQUE(producto_id, talla_id)
);

CREATE TABLE IF NOT EXISTS fichas_costo (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id             INTEGER NOT NULL REFERENCES productos(id),
  version                 INTEGER NOT NULL DEFAULT 1,
  vigente                 INTEGER NOT NULL DEFAULT 1,
  costo_confeccion        REAL NOT NULL DEFAULT 0,
  costo_tela              REAL NOT NULL DEFAULT 0,
  costo_insumos_total     REAL NOT NULL DEFAULT 0,
  costo_foto              REAL NOT NULL DEFAULT 0,
  costo_total             REAL NOT NULL DEFAULT 0,
  precio_venta_sugerido   REAL NOT NULL DEFAULT 0,
  margen_objetivo_pct     REAL NOT NULL DEFAULT 0,
  notas                   TEXT,
  creado_en               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fichas_costo_insumos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ficha_id            INTEGER NOT NULL REFERENCES fichas_costo(id),
  insumo_id           INTEGER NOT NULL REFERENCES insumos(id),
  lote_id             INTEGER REFERENCES insumo_lotes(id),
  cantidad            REAL NOT NULL,
  precio_unitario_snap REAL NOT NULL,
  subtotal            REAL NOT NULL
);

-- ─────────────────────────────────────────
-- INVENTARIO INSUMOS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS movimientos_insumos (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  insumo_id             INTEGER NOT NULL REFERENCES insumos(id),
  tipo                  TEXT NOT NULL, -- entrada_compra | salida_produccion | ajuste_manual | ajuste_reconciliacion
  cantidad              REAL NOT NULL, -- positivo entrada, negativo salida
  lote_id               INTEGER REFERENCES insumo_lotes(id),
  orden_produccion_id   INTEGER REFERENCES ordenes_produccion(id),
  fecha                 TEXT NOT NULL DEFAULT (date('now')),
  notas                 TEXT,
  usuario_id            INTEGER REFERENCES usuarios(id),
  creado_en             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reconciliaciones_insumos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha       TEXT NOT NULL,
  usuario_id  INTEGER REFERENCES usuarios(id),
  notas       TEXT,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reconciliacion_insumo_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  reconciliacion_id   INTEGER NOT NULL REFERENCES reconciliaciones_insumos(id),
  insumo_id           INTEGER NOT NULL REFERENCES insumos(id),
  stock_calculado     REAL NOT NULL,
  stock_fisico_real   REAL NOT NULL,
  diferencia          REAL NOT NULL,
  ajuste_aplicado     INTEGER NOT NULL DEFAULT 0,
  movimiento_id       INTEGER REFERENCES movimientos_insumos(id)
);

-- ─────────────────────────────────────────
-- PRODUCCIÓN
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ordenes_produccion (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  numero          TEXT UNIQUE NOT NULL,
  fabricante      TEXT,
  proveedor_id    INTEGER REFERENCES proveedores(id),
  estado          TEXT NOT NULL DEFAULT 'borrador', -- borrador | confirmada | en_produccion | entregada | cancelada
  fecha_orden     TEXT NOT NULL DEFAULT (date('now')),
  fecha_entrega   TEXT,
  costo_total     REAL NOT NULL DEFAULT 0,
  notas           TEXT,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ordenes_produccion_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id        INTEGER NOT NULL REFERENCES ordenes_produccion(id),
  producto_id     INTEGER NOT NULL REFERENCES productos(id),
  ficha_costo_id  INTEGER REFERENCES fichas_costo(id),
  cantidad_total  INTEGER NOT NULL DEFAULT 0,
  costo_unitario  REAL NOT NULL DEFAULT 0,
  subtotal        REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ordenes_produccion_tallas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER NOT NULL REFERENCES ordenes_produccion_items(id),
  talla_id    INTEGER NOT NULL REFERENCES tallas(id),
  cantidad    INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────
-- INVENTARIO PRODUCTOS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id           INTEGER NOT NULL REFERENCES productos(id),
  talla_id              INTEGER NOT NULL REFERENCES tallas(id),
  tipo                  TEXT NOT NULL, -- entrada_produccion | salida_venta | devolucion | ajuste_manual | ajuste_reconciliacion
  cantidad              INTEGER NOT NULL,
  costo_unitario_snap   REAL,
  orden_produccion_id   INTEGER REFERENCES ordenes_produccion(id),
  venta_id              INTEGER REFERENCES ventas(id),
  devolucion_id         INTEGER REFERENCES devoluciones(id),
  fecha                 TEXT NOT NULL DEFAULT (date('now')),
  notas                 TEXT,
  usuario_id            INTEGER REFERENCES usuarios(id),
  creado_en             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reconciliaciones_inventario (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha       TEXT NOT NULL,
  usuario_id  INTEGER REFERENCES usuarios(id),
  notas       TEXT,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reconciliacion_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  reconciliacion_id   INTEGER NOT NULL REFERENCES reconciliaciones_inventario(id),
  producto_id         INTEGER NOT NULL REFERENCES productos(id),
  talla_id            INTEGER NOT NULL REFERENCES tallas(id),
  stock_calculado     INTEGER NOT NULL,
  stock_fisico_real   INTEGER NOT NULL,
  diferencia          INTEGER NOT NULL,
  ajuste_aplicado     INTEGER NOT NULL DEFAULT 0,
  movimiento_id       INTEGER REFERENCES movimientos_inventario(id)
);

-- ─────────────────────────────────────────
-- VENTAS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  numero                TEXT UNIQUE NOT NULL,
  fecha                 TEXT NOT NULL DEFAULT (date('now')),
  cliente_nombre        TEXT,
  cliente_telefono      TEXT,
  canal_id              INTEGER NOT NULL REFERENCES canales_venta(id),
  medio_pago_id         INTEGER REFERENCES medios_pago(id),
  subtotal              REAL NOT NULL DEFAULT 0,
  descuento             REAL NOT NULL DEFAULT 0,
  costo_envio_cobrado   REAL NOT NULL DEFAULT 0,
  costo_envio_real      REAL NOT NULL DEFAULT 0,
  total                 REAL NOT NULL DEFAULT 0,
  comision_canal        REAL NOT NULL DEFAULT 0,
  notas                 TEXT,
  tiendanube_order_id   TEXT,
  estado                TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | enviado | entregado | cancelado
  cierre_id             INTEGER REFERENCES cierres_mensuales(id),
  creado_en             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS venta_items (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id              INTEGER NOT NULL REFERENCES ventas(id),
  producto_id           INTEGER NOT NULL REFERENCES productos(id),
  talla_id              INTEGER NOT NULL REFERENCES tallas(id),
  cantidad              INTEGER NOT NULL DEFAULT 1,
  precio_unitario       REAL NOT NULL,
  costo_unitario_snap   REAL NOT NULL DEFAULT 0,
  subtotal              REAL NOT NULL,
  comision_item         REAL NOT NULL DEFAULT 0,
  utilidad_item         REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS devoluciones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id        INTEGER NOT NULL REFERENCES ventas(id),
  fecha           TEXT NOT NULL DEFAULT (date('now')),
  motivo          TEXT,
  tipo            TEXT NOT NULL DEFAULT 'devolucion', -- devolucion | cambio
  monto_devuelto  REAL NOT NULL DEFAULT 0,
  venta_cambio_id INTEGER REFERENCES ventas(id),
  notas           TEXT,
  cierre_id       INTEGER REFERENCES cierres_mensuales(id),
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- GASTOS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gastos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha           TEXT NOT NULL DEFAULT (date('now')),
  categoria_id    INTEGER NOT NULL REFERENCES categorias_gasto(id),
  descripcion     TEXT NOT NULL,
  monto           REAL NOT NULL,
  comprobante_url TEXT,
  notas           TEXT,
  usuario_id      INTEGER REFERENCES usuarios(id),
  cierre_id       INTEGER REFERENCES cierres_mensuales(id),
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- CIERRE MENSUAL
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cierres_mensuales (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  anio                    INTEGER NOT NULL,
  mes                     INTEGER NOT NULL,
  estado                  TEXT NOT NULL DEFAULT 'abierto', -- abierto | cerrado
  ventas_brutas           REAL NOT NULL DEFAULT 0,
  devoluciones            REAL NOT NULL DEFAULT 0,
  costo_mercaderia        REAL NOT NULL DEFAULT 0,
  comisiones_canal        REAL NOT NULL DEFAULT 0,
  envios_asumidos         REAL NOT NULL DEFAULT 0,
  utilidad_bruta          REAL NOT NULL DEFAULT 0,
  gastos_operativos       REAL NOT NULL DEFAULT 0,
  utilidad_neta           REAL NOT NULL DEFAULT 0,
  distribucion_json       TEXT,
  notas                   TEXT,
  cerrado_en              TEXT,
  cerrado_por             INTEGER REFERENCES usuarios(id),
  creado_en               TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(anio, mes)
);

-- ─────────────────────────────────────────
-- TIENDA NUBE
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tiendanube_sync_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo            TEXT NOT NULL, -- orden | producto | stock
  referencia_id   TEXT,
  estado          TEXT NOT NULL, -- ok | error | pendiente
  detalle         TEXT,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- DATOS INICIALES
-- ─────────────────────────────────────────

INSERT OR IGNORE INTO tallas (id, nombre, orden) VALUES
  (1, 'XS', 1), (2, 'S', 2), (3, 'M', 3),
  (4, 'L', 4),  (5, 'XL', 5),(6, 'XXL', 6);

INSERT OR IGNORE INTO canales_venta (id, nombre, comision_pct) VALUES
  (1, 'WhatsApp',   0),
  (2, 'Instagram',  0),
  (3, 'Tienda Nube',8),
  (4, 'Presencial', 0);

INSERT OR IGNORE INTO medios_pago (id, nombre) VALUES
  (1, 'Efectivo'),
  (2, 'Transferencia'),
  (3, 'MercadoPago'),
  (4, 'Tarjeta débito'),
  (5, 'Tarjeta crédito');

INSERT OR IGNORE INTO categorias_gasto (id, nombre, color) VALUES
  (1, 'Publicidad y marketing', '#E07A5F'),
  (2, 'Fotografía',             '#F2CC8F'),
  (3, 'Transporte y envíos',    '#4CAF82'),
  (4, 'Muestras y desarrollo',  '#8A8AA8'),
  (5, 'Materiales de oficina',  '#C8C8E0'),
  (6, 'Servicios digitales',    '#E07A5F'),
  (7, 'Otros',                  '#8A8AA8');

INSERT OR IGNORE INTO categorias_insumo (id, nombre, color) VALUES
  (1, 'Etiquetas y marquillas', '#E07A5F'),
  (2, 'Empaques',               '#F2CC8F'),
  (3, 'Telas',                  '#4CAF82'),
  (4, 'Avíos',                  '#8A8AA8'),
  (5, 'Otros',                  '#C8C8E0');

INSERT OR IGNORE INTO configuracion_app (clave, valor) VALUES
  ('nombre_marca',     'Tórrida'),
  ('moneda',           'COP'),
  ('version_schema',   '1');
`;