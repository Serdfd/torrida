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

  // ── v14: Tablas de proveedores, insumos y lotes ─────────────────────────
  {
    version:     14,
    description: 'Crear tablas proveedores, categorias_insumo, insumos, insumo_lotes',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS proveedores (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre     TEXT    NOT NULL,
          contacto   TEXT,
          telefono   TEXT,
          email      TEXT,
          notas      TEXT,
          activo     INTEGER NOT NULL DEFAULT 1,
          created_at TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS categorias_insumo (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre     TEXT    NOT NULL,
          color      TEXT    NOT NULL DEFAULT '#8A8AA8',
          activa     INTEGER NOT NULL DEFAULT 1,
          created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO categorias_insumo (nombre, color) VALUES
          ('Telas',      '#60A5FA'),
          ('Cierres',    '#F472B6'),
          ('Botones',    '#FBBF24'),
          ('Hilos',      '#34D399'),
          ('Empaque',    '#A78BFA'),
          ('Etiquetas',  '#F87171');

        CREATE TABLE IF NOT EXISTS insumos (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre       TEXT    NOT NULL,
          descripcion  TEXT,
          unidad       TEXT    NOT NULL DEFAULT 'unidad'
                       CHECK(unidad IN ('unidad','metro','kg','rollo','par','caja','litro')),
          categoria_id INTEGER REFERENCES categorias_insumo(id) ON DELETE SET NULL,
          proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
          stock_minimo REAL    NOT NULL DEFAULT 0,
          activo       INTEGER NOT NULL DEFAULT 1,
          created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_insumos_activo ON insumos(activo);

        CREATE TABLE IF NOT EXISTS insumo_lotes (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          insumo_id       INTEGER NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
          proveedor_id    INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
          fecha_compra    TEXT    NOT NULL DEFAULT (date('now')),
          cantidad        REAL    NOT NULL DEFAULT 0,
          precio_unitario REAL    NOT NULL DEFAULT 0,
          precio_total    REAL    NOT NULL DEFAULT 0,
          notas           TEXT,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_lotes_insumo ON insumo_lotes(insumo_id);
      `)
    }
  },

  // ── v16: Tablas de órdenes de producción ────────────────────────────────
  {
    version:     16,
    description: 'Crear tablas ordenes_produccion, ordenes_produccion_items, ordenes_produccion_tallas',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ordenes_produccion (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          numero        TEXT    NOT NULL UNIQUE,
          fabricante    TEXT,
          proveedor_id  INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
          estado        TEXT    NOT NULL DEFAULT 'borrador'
                        CHECK(estado IN
                          ('borrador','confirmada','en_produccion','entregada','cancelada')
                        ),
          fecha_orden   TEXT    NOT NULL DEFAULT (date('now')),
          fecha_entrega TEXT,
          costo_total   REAL    NOT NULL DEFAULT 0,
          notas         TEXT,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_op_estado ON ordenes_produccion(estado);
        CREATE INDEX IF NOT EXISTS idx_op_fecha  ON ordenes_produccion(fecha_orden);

        CREATE TABLE IF NOT EXISTS ordenes_produccion_items (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          orden_id       INTEGER NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
          producto_id    INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
          ficha_costo_id INTEGER REFERENCES fichas_costo(id) ON DELETE SET NULL,
          cantidad_total INTEGER NOT NULL DEFAULT 0,
          costo_unitario REAL    NOT NULL DEFAULT 0,
          subtotal       REAL    NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_op_items_orden ON ordenes_produccion_items(orden_id);

        CREATE TABLE IF NOT EXISTS ordenes_produccion_tallas (
          id       INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id  INTEGER NOT NULL REFERENCES ordenes_produccion_items(id) ON DELETE CASCADE,
          talla_id INTEGER NOT NULL REFERENCES tallas(id) ON DELETE CASCADE,
          cantidad INTEGER NOT NULL DEFAULT 0,

          UNIQUE(item_id, talla_id)
        );
      `)
    }
  },

  // ── v15: Tablas de fichas de costo ───────────────────────────────────────
  {
    version:     15,
    description: 'Crear tablas fichas_costo y fichas_costo_insumos',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS fichas_costo (
          id                    INTEGER PRIMARY KEY AUTOINCREMENT,
          producto_id           INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
          version               INTEGER NOT NULL DEFAULT 1,
          vigente               INTEGER NOT NULL DEFAULT 1,
          costo_confeccion      REAL    NOT NULL DEFAULT 0,
          costo_tela            REAL    NOT NULL DEFAULT 0,
          costo_insumos_total   REAL    NOT NULL DEFAULT 0,
          costo_foto            REAL    NOT NULL DEFAULT 0,
          otros_costos          REAL    NOT NULL DEFAULT 0,
          costo_total           REAL    NOT NULL DEFAULT 0,
          precio_venta_sugerido REAL    NOT NULL DEFAULT 0,
          margen_objetivo_pct   REAL    NOT NULL DEFAULT 0,
          notas                 TEXT,
          created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_fichas_producto ON fichas_costo(producto_id);
        CREATE INDEX IF NOT EXISTS idx_fichas_vigente  ON fichas_costo(producto_id, vigente);

        CREATE TABLE IF NOT EXISTS fichas_costo_insumos (
          id                   INTEGER PRIMARY KEY AUTOINCREMENT,
          ficha_id             INTEGER NOT NULL REFERENCES fichas_costo(id) ON DELETE CASCADE,
          insumo_id            INTEGER REFERENCES insumos(id) ON DELETE SET NULL,
          descripcion          TEXT,
          cantidad             REAL    NOT NULL DEFAULT 0,
          precio_unitario_snap REAL    NOT NULL DEFAULT 0,
          subtotal             REAL    NOT NULL DEFAULT 0
        );
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

  // ── v18: Columnas de envío y utilidad en ventas/venta_items + fix trigger ─
  {
    version:     18,
    description: 'Add tipo_envio/costo_envio_real to ventas; costo_unitario_snap/comision_item/utilidad_item to venta_items; fix stock-reversion trigger',
    up(db) {
      // Nuevas columnas en ventas
      try { db.exec(`ALTER TABLE ventas ADD COLUMN tipo_envio TEXT DEFAULT 'standard'`) } catch {}
      try { db.exec(`ALTER TABLE ventas ADD COLUMN costo_envio_real REAL DEFAULT 0`) } catch {}

      // Nuevas columnas en venta_items
      try { db.exec(`ALTER TABLE venta_items ADD COLUMN costo_unitario_snap REAL DEFAULT 0`) } catch {}
      try { db.exec(`ALTER TABLE venta_items ADD COLUMN comision_item REAL DEFAULT 0`) } catch {}
      try { db.exec(`ALTER TABLE venta_items ADD COLUMN utilidad_item REAL DEFAULT 0`) } catch {}

      // Recrear trigger de reversión de stock con sintaxis SQLite correcta
      db.exec(`DROP TRIGGER IF EXISTS trg_revertir_stock_cancelacion`)
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_revertir_stock_cancelacion
        AFTER UPDATE ON ventas
        WHEN NEW.estado = 'cancelado' AND OLD.estado != 'cancelado'
        BEGIN
          UPDATE inventario_productos
          SET stock      = stock + (
                SELECT vi.cantidad FROM venta_items vi
                WHERE vi.venta_id       = NEW.id
                  AND vi.producto_id    = inventario_productos.producto_id
                  AND vi.talla_id       = inventario_productos.talla_id
              ),
              updated_at = datetime('now')
          WHERE EXISTS (
            SELECT 1 FROM venta_items vi
            WHERE vi.venta_id       = NEW.id
              AND vi.producto_id    = inventario_productos.producto_id
              AND vi.talla_id       = inventario_productos.talla_id
          );
        END
      `)
    }
  },

  // ── v17: Tabla movimientos_inventario ───────────────────────────────────
  {
    version:     17,
    description: 'Crear tabla movimientos_inventario (historial de stock por producto/talla)',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS movimientos_inventario (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
          talla_id    INTEGER NOT NULL REFERENCES tallas(id)   ON DELETE CASCADE,
          tipo        TEXT    NOT NULL,
          cantidad    INTEGER NOT NULL,
          notas       TEXT,
          orden_id    INTEGER,
          venta_id    INTEGER,
          fecha       TEXT    NOT NULL DEFAULT (date('now')),
          created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_movinv_producto
          ON movimientos_inventario(producto_id);
        CREATE INDEX IF NOT EXISTS idx_movinv_fecha
          ON movimientos_inventario(fecha);
      `)
    }
  },

  // ── v20: Tienda Nube — columnas de mapeo + canal ────────────────────────
  {
    version:     20,
    description: 'Columnas Tienda Nube en productos, producto_tallas y ventas',
    up(db) {
      const cols: [string, string][] = [
        ['productos',      'ADD COLUMN tn_product_id TEXT'],
        ['producto_tallas','ADD COLUMN tn_variant_id TEXT'],
        ['ventas',         'ADD COLUMN tn_order_id TEXT'],
      ]
      for (const [table, col] of cols) {
        try { db.exec(`ALTER TABLE ${table} ${col}`) } catch { /* ya existe */ }
      }
      // Índice único para evitar duplicados en sync
      try {
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_tn_order
                 ON ventas(tn_order_id) WHERE tn_order_id IS NOT NULL`)
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_tn
                 ON productos(tn_product_id) WHERE tn_product_id IS NOT NULL`)
      } catch { /* ya existe */ }
      // Config keys para credenciales
      db.exec(`
        INSERT OR IGNORE INTO configuracion_app (clave, valor) VALUES
          ('tn_store_id',     ''),
          ('tn_access_token', '')
      `)
      // Canal Tienda Nube (comisión 0 — TN ya cobra aparte)
      db.exec(`
        INSERT OR IGNORE INTO canales_venta (nombre, comision_pct)
        VALUES ('Tienda Nube', 0)
      `)
    }
  },

  // ── v19: Distribución cierre mensual + nombres socias ───────────────────
  {
    version:     19,
    description: 'Distribución de utilidad en cierre mensual',
    up(db) {
      const cols = [
        'ADD COLUMN pct_reinversion    REAL DEFAULT 0',
        'ADD COLUMN monto_reinversion  REAL DEFAULT 0',
        'ADD COLUMN retiro_socia_a     REAL DEFAULT 0',
        'ADD COLUMN retiro_socia_b     REAL DEFAULT 0',
      ]
      for (const col of cols) {
        try { db.exec(`ALTER TABLE cierres_mensuales ${col}`) } catch { /* ya existe */ }
      }
      db.exec(`
        INSERT OR IGNORE INTO configuracion_app (clave, valor) VALUES
          ('nombre_socia_a', 'Socia A'),
          ('nombre_socia_b', 'Socia B')
      `)
    }
  },

  // ── v22: Tarifas por medio de pago + comision_medio_pago en ventas ───────
  {
    version:     22,
    description: 'Tabla medios_pago_tarifas y comision_medio_pago en ventas',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS medios_pago_tarifas (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          medio_pago_id  INTEGER NOT NULL REFERENCES medios_pago(id) ON DELETE CASCADE,
          concepto       TEXT    NOT NULL,
          comision_pct   REAL    NOT NULL DEFAULT 0,
          comision_fija  REAL    NOT NULL DEFAULT 0,
          activo         INTEGER NOT NULL DEFAULT 1,
          created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `)
      const cols: [string, string][] = [
        ['ventas', 'ADD COLUMN medio_pago_tarifa_id       INTEGER'],
        ['ventas', 'ADD COLUMN medio_pago_tarifa_concepto TEXT'],
        ['ventas', 'ADD COLUMN comision_medio_pago        REAL NOT NULL DEFAULT 0'],
      ]
      for (const [table, col] of cols) {
        try { db.exec(`ALTER TABLE ${table} ${col}`) } catch { /* ya existe */ }
      }
    }
  },

  // ── v21: Redes sociales y sitio web en configuracion_app ────────────────
  {
    version:     21,
    description: 'Agregar sitio_web, facebook y tiktok a configuracion_app',
    up(db) {
      db.exec(`
        INSERT OR IGNORE INTO configuracion_app (clave, valor) VALUES
          ('sitio_web', ''),
          ('facebook',  ''),
          ('tiktok',    '')
      `)
    }
  },

  // ── v25: sesion_fotografica_productos + limpiar sesion_fotografica_items ─
  {
    version:     25,
    description: 'Crear tabla sesion_fotografica_productos y limpiar sesion_fotografica_items',
    up(db) {
      // Nueva tabla de productos fotografiados por sesión
      db.exec(`
        CREATE TABLE IF NOT EXISTS sesion_fotografica_productos (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          sesion_id           INTEGER NOT NULL
                              REFERENCES sesiones_fotograficas(id) ON DELETE CASCADE,
          producto_id         INTEGER NOT NULL
                              REFERENCES productos(id) ON DELETE CASCADE,
          cantidad_unidades   REAL    NOT NULL DEFAULT 1,
          costo_foto_calculado REAL   NOT NULL DEFAULT 0,
          created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_sfp_sesion
          ON sesion_fotografica_productos(sesion_id);
      `)

      // Limpiar sesion_fotografica_items: quitar producto_id y costo_asignado,
      // dejar solo descripcion + monto (renombrar costo_asignado → monto)
      // SQLite no permite DROP COLUMN en versiones antiguas, recreamos la tabla
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS sesion_fotografica_items_new (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sesion_id   INTEGER NOT NULL
                        REFERENCES sesiones_fotograficas(id) ON DELETE CASCADE,
            descripcion TEXT    NOT NULL,
            monto       REAL    NOT NULL DEFAULT 0,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
          );

          INSERT INTO sesion_fotografica_items_new (id, sesion_id, descripcion, monto)
            SELECT id, sesion_id,
                   COALESCE(descripcion, 'Gasto'),
                   COALESCE(costo_asignado, 0)
            FROM sesion_fotografica_items;

          DROP TABLE sesion_fotografica_items;

          ALTER TABLE sesion_fotografica_items_new
            RENAME TO sesion_fotografica_items;
        `)
      } catch { /* tabla puede no existir aún */ }

      // Quitar cantidad_looks de sesiones_fotograficas (recrear sin esa columna)
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS sesiones_fotograficas_new (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha        TEXT    NOT NULL,
            fotografo    TEXT,
            costo_total  REAL    NOT NULL DEFAULT 0,
            notas        TEXT,
            created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
          );

          INSERT INTO sesiones_fotograficas_new
            (id, fecha, fotografo, costo_total, notas, created_at, updated_at)
            SELECT id, fecha, fotografo, costo_total, notas, created_at, updated_at
            FROM sesiones_fotograficas;

          DROP TABLE sesiones_fotograficas;

          ALTER TABLE sesiones_fotograficas_new
            RENAME TO sesiones_fotograficas;
        `)
      } catch { /* ya migrada */ }
    }
  },

  // ── v24: Columna referencia en productos ────────────────────────────────
  {
    version:     24,
    description: 'Agregar columna referencia a productos',
    up(db) {
      try {
        db.exec(`ALTER TABLE productos ADD COLUMN referencia TEXT`)
      } catch { /* ya existe */ }
    }
  },

  // ── v23: Tabla unidades + eliminar CHECK en insumos.unidad ─────────────
  {
    version:     23,
    description: 'Crear tabla unidades y liberar CHECK constraint en insumos.unidad',
    up(db) {
      // 1. Tabla unidades
      db.exec(`
        CREATE TABLE IF NOT EXISTS unidades (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre     TEXT    NOT NULL UNIQUE,
          activa     INTEGER NOT NULL DEFAULT 1,
          created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO unidades (nombre) VALUES
          ('unidad'),
          ('metro'),
          ('kg'),
          ('rollo'),
          ('par'),
          ('caja'),
          ('litro');
      `)

      // 2. Recrear insumos sin CHECK constraint
      db.exec(`
        CREATE TABLE IF NOT EXISTS insumos_new (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre       TEXT    NOT NULL,
          descripcion  TEXT,
          unidad       TEXT    NOT NULL DEFAULT 'unidad',
          categoria_id INTEGER REFERENCES categorias_insumo(id) ON DELETE SET NULL,
          proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
          stock_minimo REAL    NOT NULL DEFAULT 0,
          activo       INTEGER NOT NULL DEFAULT 1,
          created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO insumos_new
          SELECT id, nombre, descripcion, unidad, categoria_id,
                 proveedor_id, stock_minimo, activo, created_at, updated_at
          FROM insumos;

        DROP TABLE insumos;

        ALTER TABLE insumos_new RENAME TO insumos;

        CREATE INDEX IF NOT EXISTS idx_insumos_activo ON insumos(activo);
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
  },

  // ── v26: Estado de producto + pagos de orden de producción ─────────────
  {
    version:     26,
    description: 'Agregar estado a productos y campos anticipo/saldo a ordenes_produccion',
    up(db) {
      // estado del producto: borrador | en_produccion | activo | descontinuado
      try {
        db.exec(`ALTER TABLE productos ADD COLUMN estado TEXT NOT NULL DEFAULT 'activo'`)
      } catch { /* ya existe */ }

      // Poner en 'activo' todos los productos existentes activos
      try {
        db.exec(`
          UPDATE productos SET estado = 'activo'    WHERE activo = 1;
          UPDATE productos SET estado = 'descontinuado' WHERE activo = 0;
        `)
      } catch { /* ok */ }

      // Campos de pago en dos momentos para ordenes_produccion
      try {
        db.exec(`ALTER TABLE ordenes_produccion ADD COLUMN anticipo       REAL NOT NULL DEFAULT 0`)
      } catch { /* ya existe */ }
      try {
        db.exec(`ALTER TABLE ordenes_produccion ADD COLUMN fecha_anticipo TEXT`)
      } catch { /* ya existe */ }
      try {
        db.exec(`ALTER TABLE ordenes_produccion ADD COLUMN saldo          REAL NOT NULL DEFAULT 0`)
      } catch { /* ya existe */ }
      try {
        db.exec(`ALTER TABLE ordenes_produccion ADD COLUMN fecha_saldo    TEXT`)
      } catch { /* ya existe */ }
    }
  },

  // ── v27: Eliminar trigger redundante trg_descontar_stock_venta ──────────
  {
    version:     27,
    description: 'Drop trg_descontar_stock_venta (VentaForm gestiona el stock explícitamente)',
    up(db) {
      db.exec(`DROP TRIGGER IF EXISTS trg_descontar_stock_venta`)
    }
  },

  {
    version:     28,
    description: 'Agrega campos de dirección de envío a ventas',
    up(db) {
      db.exec(`
        ALTER TABLE ventas ADD COLUMN envio_departamento TEXT;
        ALTER TABLE ventas ADD COLUMN envio_ciudad       TEXT;
        ALTER TABLE ventas ADD COLUMN envio_direccion    TEXT;
      `)
    }
  },

  {
    version:     29,
    description: 'Tabla transportadoras + columnas transportadora_id, guia_numero, envio_pendiente en ventas',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS transportadoras (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre     TEXT    NOT NULL UNIQUE,
          activa     INTEGER NOT NULL DEFAULT 1,
          created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        INSERT OR IGNORE INTO transportadoras (nombre) VALUES
          ('Coordinadora'),
          ('Interrapidísimo'),
          ('Mensajería');
      `)
      try { db.exec(`ALTER TABLE ventas ADD COLUMN transportadora_id INTEGER REFERENCES transportadoras(id) ON DELETE SET NULL`) } catch {}
      try { db.exec(`ALTER TABLE ventas ADD COLUMN guia_numero TEXT`) } catch {}
      try { db.exec(`ALTER TABLE ventas ADD COLUMN envio_pendiente INTEGER NOT NULL DEFAULT 0`) } catch {}
    }
  },

  {
    version:     30,
    description: 'Agrega creado_en a ventas para heatmap por hora',
    up(db) {
      try { db.exec(`ALTER TABLE ventas ADD COLUMN creado_en TEXT`) } catch {}
      db.exec(`UPDATE ventas SET creado_en = creado_en WHERE creado_en IS NOT NULL`)
      db.exec(`UPDATE ventas SET creado_en = fecha || ' 00:00:00' WHERE creado_en IS NULL`)
    }
  },

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