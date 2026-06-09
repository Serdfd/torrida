-- ============================================================
--  TORRIDA — Schema SQLite
--  Versión 1.0.0
--  Ejecutado una sola vez al iniciar la app por primera vez.
--  Las migraciones posteriores van en migrations.ts
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Configuración general ────────────────────────────────────

CREATE TABLE IF NOT EXISTS configuracion_app (
  clave       TEXT PRIMARY KEY NOT NULL,
  valor       TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO configuracion_app (clave, valor) VALUES
  ('nombre_negocio',  'Mi Marca'),
  ('moneda',          'COP'),
  ('prefijo_factura', 'V-'),
  ('nit',             ''),
  ('direccion',       ''),
  ('telefono',        ''),
  ('email',           ''),
  ('instagram',       ''),
  ('logo_url',        '');

-- ── Colecciones ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS colecciones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT    NOT NULL,
  anio        INTEGER,
  descripcion TEXT,
  activa      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Tallas ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tallas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT    NOT NULL UNIQUE,
  orden      INTEGER NOT NULL DEFAULT 0,
  activo     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO tallas (nombre, orden) VALUES
  ('XS',    1),
  ('S',     2),
  ('M',     3),
  ('L',     4),
  ('XL',    5),
  ('XXL',   6),
  ('Única', 7);

-- ── Canales de venta ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS canales_venta (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  comision_pct  REAL    NOT NULL DEFAULT 0,
  activo        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO canales_venta (nombre, comision_pct) VALUES
  ('Instagram',       0),
  ('TikTok Shop',     3),
  ('Tienda física',   0),
  ('WhatsApp',        0);

-- ── Medios de pago ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS medios_pago (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT    NOT NULL,
  activo     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO medios_pago (nombre) VALUES
  ('Nequi'),
  ('Daviplata'),
  ('Transferencia bancaria'),
  ('Efectivo'),
  ('Wompi');

-- ── Categorías de gasto ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS categorias_gasto (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT    NOT NULL,
  color      TEXT    NOT NULL DEFAULT '#8A8AA8',
  activa     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO categorias_gasto (nombre, color) VALUES
  ('Producción',  '#F87171'),
  ('Envíos',      '#60A5FA'),
  ('Marketing',   '#F472B6'),
  ('Insumos',     '#FBBF24'),
  ('Nómina',      '#34D399'),
  ('Plataformas', '#A78BFA');

-- ── Productos ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS productos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre           TEXT    NOT NULL,
  descripcion      TEXT,
  precio_venta     REAL    NOT NULL DEFAULT 0,
  costo_unitario   REAL,
  coleccion_id     INTEGER REFERENCES colecciones(id) ON DELETE SET NULL,
  imagen_url       TEXT,
  activo           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_productos_activo
  ON productos(activo);

CREATE INDEX IF NOT EXISTS idx_productos_coleccion
  ON productos(coleccion_id);

-- ── Inventario de productos por talla ────────────────────────

CREATE TABLE IF NOT EXISTS inventario_productos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  talla_id    INTEGER NOT NULL REFERENCES tallas(id)   ON DELETE CASCADE,
  stock       INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),

  UNIQUE(producto_id, talla_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_producto
  ON inventario_productos(producto_id);

CREATE INDEX IF NOT EXISTS idx_inv_stock
  ON inventario_productos(stock);

-- ── Ventas ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_venta      TEXT    NOT NULL UNIQUE,
  fecha             TEXT    NOT NULL,
  cliente_nombre    TEXT,
  cliente_telefono  TEXT,
  canal_id          INTEGER REFERENCES canales_venta(id) ON DELETE SET NULL,
  medio_pago_id     INTEGER REFERENCES medios_pago(id)   ON DELETE SET NULL,
  subtotal          REAL    NOT NULL DEFAULT 0,
  descuento         REAL    NOT NULL DEFAULT 0,
  comision_canal    REAL    NOT NULL DEFAULT 0,
  costo_envio       REAL    NOT NULL DEFAULT 0,
  total             REAL    NOT NULL DEFAULT 0,
  estado            TEXT    NOT NULL DEFAULT 'completada'
                    CHECK(estado IN ('completada','pendiente','cancelado')),
  notas             TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha
  ON ventas(fecha);

CREATE INDEX IF NOT EXISTS idx_ventas_estado
  ON ventas(estado);

CREATE INDEX IF NOT EXISTS idx_ventas_canal
  ON ventas(canal_id);

CREATE INDEX IF NOT EXISTS idx_ventas_numero
  ON ventas(numero_venta);

-- ── Items de venta ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS venta_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id        INTEGER NOT NULL REFERENCES ventas(id)    ON DELETE CASCADE,
  producto_id     INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  talla_id        INTEGER          REFERENCES tallas(id)    ON DELETE SET NULL,
  cantidad        INTEGER NOT NULL DEFAULT 1,
  precio_unitario REAL    NOT NULL DEFAULT 0,
  descuento_item  REAL    NOT NULL DEFAULT 0,
  subtotal_item   REAL    NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_venta_items_venta
  ON venta_items(venta_id);

CREATE INDEX IF NOT EXISTS idx_venta_items_producto
  ON venta_items(producto_id);

-- ── Gastos ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gastos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  descripcion      TEXT    NOT NULL,
  monto            REAL    NOT NULL DEFAULT 0,
  fecha            TEXT    NOT NULL,
  categoria_id     INTEGER REFERENCES categorias_gasto(id) ON DELETE SET NULL,
  comprobante_url  TEXT,
  notas            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gastos_fecha
  ON gastos(fecha);

CREATE INDEX IF NOT EXISTS idx_gastos_categoria
  ON gastos(categoria_id);

-- ── Movimientos de stock (entradas / salidas / ajustes) ──────

CREATE TABLE IF NOT EXISTS movimientos_insumos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  insumo_id   INTEGER NOT NULL,
  tipo        TEXT    NOT NULL
              CHECK(tipo IN ('entrada_compra','salida_produccion','ajuste_manual')),
  cantidad    INTEGER NOT NULL DEFAULT 0,
  motivo      TEXT,
  fecha       TEXT    NOT NULL DEFAULT (date('now')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mov_insumo
  ON movimientos_insumos(insumo_id);

CREATE INDEX IF NOT EXISTS idx_mov_fecha
  ON movimientos_insumos(fecha);

-- ── Cierres mensuales ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cierres_mensuales (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  anio            INTEGER NOT NULL,
  mes             INTEGER NOT NULL,
  ingresos        REAL    NOT NULL DEFAULT 0,
  gastos          REAL    NOT NULL DEFAULT 0,
  utilidad_bruta  REAL    NOT NULL DEFAULT 0,
  utilidad_neta   REAL    NOT NULL DEFAULT 0,
  unidades        INTEGER NOT NULL DEFAULT 0,
  devoluciones    INTEGER NOT NULL DEFAULT 0,
  cerrado         INTEGER NOT NULL DEFAULT 0,
  cerrado_en      TEXT,
  notas           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),

  UNIQUE(anio, mes)
);

CREATE INDEX IF NOT EXISTS idx_cierres_periodo
  ON cierres_mensuales(anio, mes);

-- ── Vistas útiles ────────────────────────────────────────────

-- Vista: resumen de stock por producto
CREATE VIEW IF NOT EXISTS v_stock_productos AS
SELECT
  p.id                                     AS producto_id,
  p.nombre                                 AS producto_nombre,
  p.precio_venta,
  p.costo_unitario,
  COALESCE(SUM(ip.stock), 0)               AS stock_total,
  COALESCE(SUM(ip.stock * p.costo_unitario), 0) AS valor_inventario
FROM productos p
LEFT JOIN inventario_productos ip ON ip.producto_id = p.id
WHERE p.activo = 1
GROUP BY p.id;

-- Vista: ventas con nombres de canal y medio de pago
CREATE VIEW IF NOT EXISTS v_ventas_detalle AS
SELECT
  v.*,
  c.nombre  AS canal_nombre,
  mp.nombre AS medio_pago_nombre
FROM ventas v
LEFT JOIN canales_venta c  ON c.id  = v.canal_id
LEFT JOIN medios_pago   mp ON mp.id = v.medio_pago_id;

-- Vista: gastos con nombre de categoría
CREATE VIEW IF NOT EXISTS v_gastos_detalle AS
SELECT
  g.*,
  cg.nombre AS categoria_nombre,
  cg.color  AS categoria_color
FROM gastos g
LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_id;

-- ── Triggers ─────────────────────────────────────────────────

-- Al cancelar una venta, revertir stock automáticamente
CREATE TRIGGER IF NOT EXISTS trg_revertir_stock_cancelacion
AFTER UPDATE ON ventas
WHEN NEW.estado = 'cancelado' AND OLD.estado != 'cancelado'
BEGIN
  UPDATE inventario_productos
  SET stock      = stock + vi.cantidad,
      updated_at = datetime('now')
  FROM venta_items vi
  WHERE vi.venta_id       = NEW.id
    AND inventario_productos.producto_id = vi.producto_id
    AND inventario_productos.talla_id    = vi.talla_id;
END;

-- Al insertar un item de venta, descontar stock
CREATE TRIGGER IF NOT EXISTS trg_descontar_stock_venta
AFTER INSERT ON venta_items
BEGIN
  UPDATE inventario_productos
  SET stock      = MAX(0, stock - NEW.cantidad),
      updated_at = datetime('now')
  WHERE producto_id = NEW.producto_id
    AND talla_id    = NEW.talla_id;
END;