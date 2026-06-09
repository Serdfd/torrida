/**
 * utils.ts
 * Funciones utilitarias globales de la app.
 */

// ── Formateo de moneda ─────────────────────────────────────────────────────

/**
 * Formatea un número como pesos colombianos.
 * Ej: 125000 → "$125.000"
 */
export function formatCOP(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '$0'
  return new Intl.NumberFormat('es-CO', {
    style:                 'currency',
    currency:              'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

/**
 * Formatea un número con separadores de miles.
 * Ej: 12500 → "12.500"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0'
  return new Intl.NumberFormat('es-CO').format(value)
}

/**
 * Formatea un porcentaje.
 * Ej: 34.5 → "34,5%"
 */
export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value == null || isNaN(value)) return '0%'
  return `${value.toFixed(decimals).replace('.', ',')}%`
}

// ── Formateo de fechas ─────────────────────────────────────────────────────

/**
 * Formatea una fecha ISO o string a formato legible.
 * Ej: "2025-05-20" → "20 may. 2025"
 */
export function formatDate(
  value: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value + 'T00:00:00') : value
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-CO', opts ?? {
    day:   '2-digit',
    month: 'short',
    year:  'numeric'
  })
}

/**
 * Formatea fecha y hora.
 * Ej: "2025-05-20T14:30:00" → "20 may. 2025, 2:30 p. m."
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-CO', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit'
  })
}

/**
 * Retorna el label "Mayo 2025" para un mes/año dado.
 */
export function monthYearLabel(anio: number, mes: number): string {
  const date = new Date(anio, mes - 1, 1)
  return date.toLocaleDateString('es-CO', {
    month: 'long',
    year:  'numeric'
  }).replace(/^./, c => c.toUpperCase())
}

/**
 * Retorna el nombre corto del mes.
 * Ej: mes=5 → "May"
 */
export function shortMonthLabel(mes: number): string {
  const date = new Date(2025, mes - 1, 1)
  return date.toLocaleDateString('es-CO', { month: 'short' })
    .replace('.', '')
    .replace(/^./, c => c.toUpperCase())
}

// ── Cálculos financieros ───────────────────────────────────────────────────

/**
 * Calcula el delta porcentual entre dos valores.
 * Ej: calcDelta(120, 100) → 20
 */
export function calcDelta(actual: number, anterior: number): number {
  if (anterior === 0) return actual > 0 ? 100 : 0
  return ((actual - anterior) / Math.abs(anterior)) * 100
}

/**
 * Redondea a N decimales.
 */
export function round(value: number, decimals = 2): number {
  return Math.round(value * 10 ** decimals) / 10 ** decimals
}

/**
 * Calcula el margen de utilidad.
 * Ej: margen(30000, 100000) → 30
 */
export function margenUtilidad(utilidad: number, ingresos: number): number {
  if (ingresos === 0) return 0
  return round((utilidad / ingresos) * 100)
}

// ── Strings ────────────────────────────────────────────────────────────────

/**
 * Capitaliza la primera letra de cada palabra.
 * Ej: "camiseta azul" → "Camiseta Azul"
 */
export function titleCase(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Trunca un string a N caracteres añadiendo "…".
 */
export function truncate(str: string, max = 40): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

/**
 * Genera un slug simple a partir de un string.
 * Ej: "Camiseta Azul 2025" → "camiseta-azul-2025"
 */
export function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Normaliza un string para búsqueda (sin tildes, minúsculas).
 * Ej: "Árbol" → "arbol"
 */
export function normalizeSearch(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// ── Arrays ─────────────────────────────────────────────────────────────────

/**
 * Agrupa un array de objetos por una clave.
 * Ej: groupBy(ventas, 'canal_nombre')
 */
export function groupBy<T>(
  arr: T[],
  key: keyof T
): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key] ?? 'Sin valor')
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

/**
 * Suma una propiedad numérica de un array de objetos.
 */
export function sumBy<T>(arr: T[], key: keyof T): number {
  return arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0)
}

/**
 * Retorna los N elementos con mayor valor de una propiedad.
 */
export function topN<T>(arr: T[], key: keyof T, n = 5): T[] {
  return [...arr]
    .sort((a, b) => Number(b[key]) - Number(a[key]))
    .slice(0, n)
}

// ── Exportación CSV ────────────────────────────────────────────────────────

/**
 * Convierte un array de objetos a string CSV.
 * Ej: objectsToCSV([{ Nombre: 'Ana', Total: 100 }])
 */
export function objectsToCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return ''

  const headers = Object.keys(data[0])
  const escape  = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const rows = data.map(row =>
    headers.map(h => escape(row[h])).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

// ── Colores ────────────────────────────────────────────────────────────────

/**
 * Retorna un color hex aleatorio (para gráficos sin color asignado).
 */
export function randomColor(): string {
  const PALETTE = [
    '#F87171', '#FB923C', '#FBBF24', '#34D399',
    '#60A5FA', '#A78BFA', '#F472B6', '#2DD4BF'
  ]
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

/**
 * Convierte un hex a rgb con opacidad.
 * Ej: hexToRgba('#F87171', 0.2) → "rgba(248, 113, 113, 0.2)"
 */
export function hexToRgba(hex: string, alpha = 1): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ── Clases CSS ─────────────────────────────────────────────────────────────

/**
 * Combina clases de Tailwind (similar a clsx/cn).
 * Elimina valores falsy.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ── Validaciones ───────────────────────────────────────────────────────────

/**
 * Valida si un string es una URL válida.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Valida si un string es un email válido.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ── Fechas / Períodos ──────────────────────────────────────────────────────

/**
 * Retorna { anio, mes } del mes actual.
 */
export function mesActual(): { anio: number; mes: number } {
  const now = new Date()
  return { anio: now.getFullYear(), mes: now.getMonth() + 1 }
}

/**
 * Retorna { anio, mes } del mes anterior.
 */
export function mesAnterior(anio: number, mes: number): { anio: number; mes: number } {
  if (mes === 1) return { anio: anio - 1, mes: 12 }
  return { anio, mes: mes - 1 }
}

/**
 * Retorna los últimos N meses como array de { anio, mes }.
 */
export function ultimosMeses(n = 6): { anio: number; mes: number }[] {
  const result: { anio: number; mes: number }[] = []
  let { anio, mes } = mesActual()
  for (let i = 0; i < n; i++) {
    result.unshift({ anio, mes })
    ;({ anio, mes } = mesAnterior(anio, mes))
  }
  return result
}

/**
 * Retorna true si el período dado está cerrado según un array de cierres.
 */
export function isPeriodoCerrado(
  anio: number,
  mes:  number,
  cierres: { anio: number; mes: number; cerrado: number }[]
): boolean {
  const c = cierres.find(x => x.anio === anio && x.mes === mes)
  return Boolean(c?.cerrado)
}