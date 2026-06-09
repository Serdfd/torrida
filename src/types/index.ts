/**
 * types/index.ts
 * Tipos e interfaces globales de la app Torrida.
 * Importar desde '@/types'
 */

// ── Configuración ──────────────────────────────────────────────────────────

export interface ConfigApp {
  nombre_negocio:  string
  nit:             string
  direccion:       string
  telefono:        string
  email:           string
  instagram:       string
  logo_url:        string
  moneda:          string
  prefijo_factura: string
}

// ── Catálogos ──────────────────────────────────────────────────────────────

export interface Talla {
  id:         number
  nombre:     string
  orden:      number
  activo:     number
}

export interface CanalVenta {
  id:           number
  nombre:       string
  comision_pct: number
  activo:       number
}

export interface MedioPago {
  id:     number
  nombre: string
  activo: number
}

export interface CategoriaGasto {
  id:     number
  nombre: string
  color:  string
  activa: number
}

export interface Coleccion {
  id:          number
  nombre:      string
  anio:        number | null
  descripcion: string | null
  activa:      number
}

// ── Productos ──────────────────────────────────────────────────────────────

export interface Producto {
  id:              number
  nombre:          string
  descripcion:     string | null
  precio_venta:    number
  costo_unitario:  number | null
  coleccion_id:    number | null
  coleccion_nombre?: string
  imagen_url:      string | null
  tags:            string | null
  activo:          number
  created_at:      string
  updated_at:      string
}

export interface StockItem {
  producto_id:     number
  producto_nombre: string
  talla_id:        number
  talla_nombre:    string
  stock:           number
  costo_unitario:  number | null
}

export interface ProductoConStock extends Producto {
  stock_por_talla: StockItem[]
  stock_total:     number
}

// ── Ventas ─────────────────────────────────────────────────────────────────

export type EstadoVenta    = 'completada' | 'pendiente' | 'cancelado'
export type EstadoEnvio    = 'pendiente' | 'preparando' | 'enviado' | 'entregado' | 'devuelto'
export type TipoDescuento  = 'monto' | 'porcentaje'

export interface VentaItem {
  id:              number
  venta_id:        number
  producto_id:     number
  producto_nombre?: string
  talla_id:        number | null
  talla_nombre?:   string
  cantidad:        number
  precio_unitario: number
  descuento_item:  number
  subtotal_item:   number
}

export interface VentaItemInput {
  producto_id:     number
  producto_nombre: string
  talla_id:        number | null
  talla_nombre:    string
  cantidad:        number
  precio_unitario: number
  descuento_item:  number
  subtotal_item:   number
  stock_disponible?: number
}

export interface Venta {
  id:               number
  numero_venta:     string
  fecha:            string
  cliente_nombre:   string | null
  cliente_telefono: string | null
  canal_id:         number | null
  canal_nombre?:    string
  medio_pago_id:    number | null
  medio_pago_nombre?: string
  subtotal:         number
  descuento:        number
  descuento_tipo:   TipoDescuento
  comision_canal:   number
  costo_envio:      number
  total:            number
  estado:           EstadoVenta
  estado_envio:     EstadoEnvio
  ciudad_destino:   string | null
  numero_guia:      string | null
  transportadora:   string | null
  notas:            string | null
  created_at:       string
  updated_at:       string
  items?:           VentaItem[]
}

export interface VentaFormData {
  fecha:            string
  cliente_nombre:   string
  cliente_telefono: string
  canal_id:         number | null
  medio_pago_id:    number | null
  descuento:        number
  descuento_tipo:   TipoDescuento
  costo_envio:      number
  ciudad_destino:   string
  numero_guia:      string
  transportadora:   string
  notas:            string
  items:            VentaItemInput[]
}

// ── Gastos ─────────────────────────────────────────────────────────────────

export interface Gasto {
  id:               number
  descripcion:      string
  monto:            number
  fecha:            string
  categoria_id:     number | null
  categoria_nombre?: string
  categoria_color?:  string
  comprobante_url:  string | null
  notas:            string | null
  created_at:       string
  updated_at:       string
}

export interface GastoFormData {
  descripcion:     string
  monto:           number
  fecha:           string
  categoria_id:    number
  comprobante_url: string
  notas:           string
}

// ── Cierre mensual ─────────────────────────────────────────────────────────

export interface CierreMensual {
  id:             number
  anio:           number
  mes:            number
  ingresos:       number
  gastos:         number
  utilidad_bruta: number
  utilidad_neta:  number
  unidades:       number
  devoluciones:   number
  cerrado:        number
  cerrado_en:     string | null
  notas:          string | null
  created_at:     string
  updated_at:     string
}

// ── Meta mensual ───────────────────────────────────────────────────────────

export interface MetaMensual {
  id:            number
  anio:          number
  mes:           number
  meta_ingresos: number
  meta_unidades: number
  meta_utilidad: number
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardKpis {
  ingresos_mes:      number
  unidades_vendidas: number
  devoluciones:      number
  gastos_mes:        number
  ticket_promedio:   number
  ventas_count:      number
}

export interface DashboardData extends DashboardKpis {
  utilidad_neta:     number
  margen_pct:        number
  canal_top:         string
  producto_top:      string
}

// ── Comparativa / Reportes ─────────────────────────────────────────────────

export interface ResumenMes {
  mes:        string   // "01", "02", …
  ventas:     number
  ingresos:   number
  comisiones: number
}

export interface ResumenGastosMes {
  mes:       string
  gastos:    number
  registros: number
}

export interface RentabilidadProducto {
  producto_id:      number
  producto:         string
  unidades_vendidas: number
  ingresos:         number
  costo_total:      number
  utilidad:         number
}

export interface StockResumen {
  producto:     string
  stock_total:  number
  valor:        number
}

// ── Store global ───────────────────────────────────────────────────────────

export interface AppState {
  filtroAnio:   number
  filtroMes:    number
  sidebarOpen:  boolean
  modal: {
    open:    boolean
    content: React.ReactNode | null
  }
  toast: {
    visible:  boolean
    message:  string
    type:     ToastType
  }
}

export type ToastType = 'success' | 'error' | 'warning' | 'info'

// ── UI ─────────────────────────────────────────────────────────────────────

export interface SelectOption<T = string | number> {
  value: T
  label: string
}

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'success'
export type BadgeVariant  = 'default' | 'success' | 'warning' | 'danger' | 'muted'

export interface Column<T> {
  key:       keyof T | string
  label:     string
  align?:    'left' | 'right' | 'center'
  render?:   (row: T) => React.ReactNode
  sortable?: boolean
}

// ── Electron API ───────────────────────────────────────────────────────────

export interface ElectronAPI {
  db: {
    query:       <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
    run:         (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>
    transaction: (statements: { sql: string; params?: unknown[] }[]) => Promise<{ changes: number; lastInsertRowid: number }[]>
    stats:       () => Promise<{ tables: Record<string, number>; sizeKb: number }>
  }
  app: {
    version:      () => Promise<string>
    userDataPath: () => Promise<string>
    name:         () => Promise<string>
    openExternal: (url: string) => Promise<void>
  }
  backup: {
    export: () => Promise<{ ok: boolean; filePath?: string; reason?: string }>
    import: () => Promise<{ ok: boolean; message?: string; reason?: string }>
  }
  file: {
    selectImage:  () => Promise<string | null>
    showInFolder: (filePath: string) => Promise<void>
  }
  export: {
    csv: (content: string, defaultName: string) => Promise<{ ok: boolean; filePath?: string; reason?: string }>
  }
  venta: {
    generarNumero: (prefijo: string) => Promise<string>
  }
}