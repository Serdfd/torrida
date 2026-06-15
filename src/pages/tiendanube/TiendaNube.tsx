import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Store, Wifi, WifiOff, RefreshCw, ShoppingCart,
  Package, Boxes, CheckCircle, AlertTriangle,
  ExternalLink, Upload
} from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { formatCOP, formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface SyncLog {
  tipo:      string
  ok:        number
  errores:   number
  mensaje:   string
  fecha:     string
}

type TabKey = 'config' | 'productos' | 'ordenes' | 'conciliacion'

interface CsvVariante {
  talla: string
  stock: number
}

interface CsvPreviewItem {
  referencia:  string
  nombre:      string
  descripcion: string | null
  precio:      number
  variantes:   CsvVariante[]
  estado:      'nuevo' | 'actualizar'
  warnings:    string[]
}

interface OrdenCsvPreviewItem {
  tn_order_id:         string
  numero_orden:        string
  fecha:               string
  creado_en:           string
  estado_pago:         'completada' | 'pendiente' | 'cancelado'
  cliente_nombre:      string
  cliente_email:       string
  cliente_telefono:    string
  cliente_dni:         string
  ciudad:              string
  provincia:           string
  medio_pago_texto:    string
  pago_transaccion_id: string
  guia_numero:         string
  transportadora_texto: string
  direccion:           string
  subtotal:            number
  descuento:           number
  costo_envio:         number
  total:               number
  items: {
    nombre_producto: string
    talla:           string
    precio:          number
    cantidad:        number
    producto_id:     number | null
    talla_id:        number | null
  }[]
  estado_import: 'nuevo' | 'duplicada' | 'productos_faltantes'
  faltantes:     string[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function tnFetch(storeId: string, token: string, endpoint: string, method = 'GET', body?: unknown) {
  return window.electronAPI.tn.fetch({ storeId, token, method, endpoint, body })
}

async function tnFetchAll<T>(storeId: string, token: string, endpoint: string): Promise<T[]> {
  const results: T[] = []
  let page = 1
  while (true) {
    const sep = endpoint.includes('?') ? '&' : '?'
    const res = await tnFetch(storeId, token, `${endpoint}${sep}page=${page}&per_page=50`)
    if (!res.ok || !Array.isArray(res.data) || (res.data as T[]).length === 0) break
    results.push(...(res.data as T[]))
    if ((res.data as T[]).length < 50) break
    page++
  }
  return results
}
function parseCsv(text: string, sep = ';'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch   = text[i]
    const next = text[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') { field += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      row.push(field); field = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += ch
    }
  }
  row.push(field)
  if (row.some(f => f.trim())) rows.push(row)
  return rows
}

function parsePrecioTN(raw: string): number {
  return parseFloat(raw.replace(/,/g, '')) || 0
}

function parseFechaTN(raw: string): { fecha: string; creado_en: string } {
  // "15/06/2026 11:18:02" → { fecha: "2026-06-15", creado_en: "2026-06-15 11:18:02" }
  const [datePart, timePart] = raw.trim().split(' ')
  if (!datePart) return { fecha: '', creado_en: '' }
  const parts = datePart.split('/')
  if (parts.length !== 3) return { fecha: '', creado_en: '' }
  const [d, m, y] = parts
  const fecha = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  const creado_en = `${fecha} ${timePart ?? '00:00:00'}`
  return { fecha, creado_en }
}

function parseTallaDelNombre(rawNombre: string): { nombre: string; talla: string } {
  // "Vestido Lush (M)" → { nombre: "Vestido Lush", talla: "M" }
  const match = rawNombre.match(/^(.+)\s+\(([^)]+)\)\s*$/)
  if (match) return { nombre: match[1].trim(), talla: match[2].trim() }
  return { nombre: rawNombre.trim(), talla: '' }
}

function estadoPagoTN(estado: string): 'completada' | 'pendiente' | 'cancelado' {
  const e = estado.toLowerCase().trim()
  if (e === 'recibido' || e === 'paid') return 'completada'
  if (['cancelado', 'reembolsado', 'voided', 'refunded', 'cancelled'].includes(e)) return 'cancelado'
  return 'pendiente'
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li>/gi, '\n• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í').replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ')
    .replace(/&Aacute;/gi, 'Á').replace(/&Eacute;/gi, 'É')
    .replace(/&Iacute;/gi, 'Í').replace(/&Oacute;/gi, 'Ó')
    .replace(/&Uacute;/gi, 'Ú').replace(/&Ntilde;/gi, 'Ñ')
    .replace(/&uuml;/gi, 'ü').replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ').replace(/&bull;/gi, '•')
    .replace(/&middot;/gi, '·').replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—').replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
// ── Componente ─────────────────────────────────────────────────────────────

export default function TiendaNube() {
  const toast = useToast()

  const [tab,          setTab]          = useState<TabKey>('config')
  const [storeId,      setStoreId]      = useState('')
  const [token,        setToken]        = useState('')
  const [savedStoreId, setSavedStoreId] = useState('')
  const [savedToken,   setSavedToken]   = useState('')
  const [editando,     setEditando]     = useState(false)
  const [testando,     setTestando]     = useState(false)
  const [conectado,    setConectado]    = useState(false)
  const [storeName,    setStoreName]    = useState<string | null>(null)

  // Sync state
  const [syncingProd,  setSyncingProd]  = useState(false)
  const [syncingStock, setSyncingStock] = useState(false)
  const [syncingOrd,   setSyncingOrd]   = useState(false)
  const [syncMsg,      setSyncMsg]      = useState('')
  const [syncLogs,     setSyncLogs]     = useState<SyncLog[]>([])

  // Data
  const [ordenes,      setOrdenes]      = useState<any[]>([])
  const [productos,    setProductos]    = useState<any[]>([])
  const [loadingData,  setLoadingData]  = useState(false)

  // CSV import — productos
  const csvInputRef                      = useRef<HTMLInputElement>(null)
  const [csvPreview,   setCsvPreview]   = useState<CsvPreviewItem[] | null>(null)
  const [csvSkipped,   setCsvSkipped]   = useState<string[]>([])
  const [importingCsv, setImportingCsv] = useState(false)

  // CSV import — órdenes
  const csvOrdenInputRef                              = useRef<HTMLInputElement>(null)
  const [ordenCsvPreview,   setOrdenCsvPreview]       = useState<OrdenCsvPreviewItem[] | null>(null)
  const [ordenCsvErrors,    setOrdenCsvErrors]        = useState<string[]>([])
  const [importingOrdenes,  setImportingOrdenes]      = useState(false)
  const [restarStock,       setRestarStock]            = useState(true)
  const [allProductos,      setAllProductos]          = useState<{ id: number; nombre: string }[]>([])

  // Conciliación
  const concilInputRef                                = useRef<HTMLInputElement>(null)
  const [concilProcesador, setConcilProcesador]       = useState<'mercadopago' | 'bold'>('mercadopago')
  const [concilPreview,    setConcilPreview]          = useState<{transaccion_id: string; comision: number; venta_id: number | null; numero_venta: string | null}[] | null>(null)
  const [conciliando,      setConciliando]            = useState(false)

  // ── Cargar configuración desde DB ────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    const rows = await window.electronAPI.db.query<{ clave: string; valor: string }>(
      `SELECT clave, valor FROM configuracion_app
       WHERE clave IN ('tn_store_id','tn_access_token')`
    )
    const cfg = Object.fromEntries(rows.map(r => [r.clave, r.valor]))
    const sid = cfg['tn_store_id']     ?? ''
    const tok = cfg['tn_access_token'] ?? ''
    setSavedStoreId(sid); setSavedToken(tok)
    setStoreId(sid);      setToken(tok)
    setConectado(sid.trim().length > 0 && tok.trim().length > 0)
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  // ── Guardar configuración ────────────────────────────────────────────────
  async function handleGuardar() {
    const sid = storeId.trim()
    const tok = token.trim()
    if (!sid || !tok) { toast.warning('Completa el ID de tienda y el token'); return }
    await window.electronAPI.db.run(
      `UPDATE configuracion_app SET valor = ?, updated_at = datetime('now') WHERE clave = ?`,
      [sid, 'tn_store_id']
    )
    await window.electronAPI.db.run(
      `UPDATE configuracion_app SET valor = ?, updated_at = datetime('now') WHERE clave = ?`,
      [tok, 'tn_access_token']
    )
    setSavedStoreId(sid); setSavedToken(tok)
    setConectado(true); setEditando(false)
    toast.success('Configuración guardada')
  }

  function handleDesconectar() {
    window.electronAPI.db.run(`UPDATE configuracion_app SET valor = '' WHERE clave IN ('tn_store_id','tn_access_token')`)
    setSavedStoreId(''); setSavedToken(''); setToken(''); setStoreId('')
    setConectado(false); setStoreName(null)
    toast.info('Conexión removida')
  }

  // ── Probar conexión ──────────────────────────────────────────────────────
  async function handleTestConexion() {
    setTestando(true); setStoreName(null)
    const res = await tnFetch(savedStoreId, savedToken, '')
    setTestando(false)
    if (res.ok && res.data && typeof res.data === 'object') {
      const d = res.data as any
      setStoreName(d.name?.es ?? d.name ?? 'Tienda conectada')
      toast.success('Conexión exitosa')
    } else {
      toast.error(`Error de conexión (${res.status}). Verifica el ID y el token.`)
    }
  }

  // ── Cargar datos locales ─────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setLoadingData(true)
      try {
        const [ords, prods] = await Promise.all([
          window.electronAPI.db.query(
            `SELECT v.*, c.nombre AS canal_nombre
             FROM ventas v
             LEFT JOIN canales_venta c ON c.id = v.canal_id
             WHERE v.tn_order_id IS NOT NULL
             ORDER BY v.fecha DESC, v.created_at DESC
             LIMIT 50`
          ),
          window.electronAPI.db.query(
            `SELECT id, nombre, referencia, tn_product_id, precio_venta, activo
             FROM productos
             WHERE tn_product_id IS NOT NULL OR referencia IS NOT NULL
             ORDER BY nombre`
          )
        ])
        setOrdenes(ords as any[])
        setProductos(prods as any[])
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
  }, [conectado, syncLogs])

  // ── Sync: importar productos desde TN ───────────────────────────────────
  async function handleSyncProductos() {
    setSyncingProd(true); setSyncMsg('Obteniendo productos de Tienda Nube…')
    let ok = 0; let errores = 0
    try {
      const tnProducts = await tnFetchAll<any>(savedStoreId, savedToken, 'products')
      setSyncMsg(`Procesando ${tnProducts.length} productos…`)

      for (const tp of tnProducts) {
        try {
          const nombre     = (tp.name?.es ?? tp.name ?? String(tp.id)).trim()
          const precio     = parseFloat(tp.variants?.[0]?.price ?? tp.price ?? '0')
          const tnId       = String(tp.id)

          // Upsert producto
          const existing = await window.electronAPI.db.query<{ id: number }>(
            `SELECT id FROM productos WHERE tn_product_id = ?`, [tnId]
          )
          let productoId: number
          if (existing.length > 0) {
            productoId = existing[0].id
            await window.electronAPI.db.run(
              `UPDATE productos SET nombre = ?, precio_venta = ?, updated_at = datetime('now')
               WHERE id = ?`,
              [nombre, precio, productoId]
            )
          } else {
            const r = await window.electronAPI.db.run(
              `INSERT INTO productos (nombre, precio_venta, tn_product_id, activo, created_at, updated_at)
               VALUES (?,?,?,1,datetime('now'),datetime('now'))`,
              [nombre, precio, tnId]
            )
            productoId = r.lastInsertRowid as number
          }

          // Procesar variantes (tallas)
          for (const v of tp.variants ?? []) {
            const variantId  = String(v.id)
            const tallaNombre = (v.values?.[0]?.es ?? v.values?.[0] ?? 'Única').trim()
            const stockTotal  = v.stock?.total ?? 0

            // Buscar/crear talla
            let [tallaRow] = await window.electronAPI.db.query<{ id: number }>(
              `SELECT id FROM tallas WHERE nombre = ?`, [tallaNombre]
            )
            let tallaId: number
            if (tallaRow) {
              tallaId = tallaRow.id
            } else {
              const tr = await window.electronAPI.db.run(
                `INSERT OR IGNORE INTO tallas (nombre, orden, activo) VALUES (?,99,1)`,
                [tallaNombre]
              )
              tallaId = tr.lastInsertRowid as number ||
                (await window.electronAPI.db.query<{ id: number }>(
                  `SELECT id FROM tallas WHERE nombre = ?`, [tallaNombre]
                ))[0].id
            }

            // Upsert producto_tallas
            await window.electronAPI.db.run(
              `INSERT INTO producto_tallas (producto_id, talla_id, activa, tn_variant_id)
               VALUES (?,?,1,?)
               ON CONFLICT(producto_id, talla_id)
               DO UPDATE SET tn_variant_id = excluded.tn_variant_id, activa = 1`,
              [productoId, tallaId, variantId]
            )

            // Upsert stock
            await window.electronAPI.db.run(
              `INSERT INTO inventario_productos (producto_id, talla_id, stock, updated_at)
               VALUES (?,?,?,datetime('now'))
               ON CONFLICT(producto_id, talla_id)
               DO UPDATE SET stock = excluded.stock, updated_at = datetime('now')`,
              [productoId, tallaId, stockTotal]
            )
          }
          ok++
        } catch { errores++ }
      }
      const log: SyncLog = {
        tipo: 'import_productos', ok, errores,
        mensaje: `${ok} productos importados, ${errores} errores`,
        fecha: new Date().toISOString()
      }
      setSyncLogs(prev => [log, ...prev.slice(0, 9)])
      toast.success(`${ok} productos sincronizados`)
    } catch (err) {
      toast.error('Error al sincronizar productos')
      console.error(err)
    } finally {
      setSyncingProd(false); setSyncMsg('')
    }
  }

  // ── Sync: empujar stock a TN ─────────────────────────────────────────────
  async function handlePushStock() {
    setSyncingStock(true); setSyncMsg('Enviando stock a Tienda Nube…')
    let ok = 0; let errores = 0
    try {
      const rows = await window.electronAPI.db.query<any>(
        `SELECT pt.tn_variant_id, p.tn_product_id,
                COALESCE(ip.stock, 0) AS stock
         FROM producto_tallas pt
         JOIN productos p ON p.id = pt.producto_id
         LEFT JOIN inventario_productos ip
           ON ip.producto_id = pt.producto_id AND ip.talla_id = pt.talla_id
         WHERE pt.tn_variant_id IS NOT NULL
           AND p.tn_product_id IS NOT NULL`
      )
      setSyncMsg(`Actualizando ${rows.length} variantes…`)
      for (const row of rows) {
        const res = await tnFetch(
          savedStoreId, savedToken,
          `products/${row.tn_product_id}/variants/${row.tn_variant_id}`,
          'PUT',
          { stock: { total: row.stock } }
        )
        if (res.ok) ok++; else errores++
      }
      const log: SyncLog = {
        tipo: 'push_stock', ok, errores,
        mensaje: `${ok} variantes actualizadas, ${errores} errores`,
        fecha: new Date().toISOString()
      }
      setSyncLogs(prev => [log, ...prev.slice(0, 9)])
      toast.success(`Stock enviado: ${ok} variantes`)
    } catch (err) {
      toast.error('Error al enviar stock')
      console.error(err)
    } finally {
      setSyncingStock(false); setSyncMsg('')
    }
  }

  // ── Sync: importar órdenes desde TN ─────────────────────────────────────
  async function handleSyncOrdenes() {
    setSyncingOrd(true); setSyncMsg('Obteniendo órdenes de Tienda Nube…')
    let ok = 0; let errores = 0
    try {
      // Canal TN
      const [canalRow] = await window.electronAPI.db.query<{ id: number }>(
        `SELECT id FROM canales_venta WHERE nombre = 'Tienda Nube' LIMIT 1`
      )
      const canalId = canalRow?.id ?? null

      const tnOrders = await tnFetchAll<any>(
        savedStoreId, savedToken,
        'orders?payment_status=paid'
      )
      setSyncMsg(`Procesando ${tnOrders.length} órdenes…`)

      for (const order of tnOrders) {
        const tnOrderId = String(order.id)
        // Chequear si ya existe
        const exists = await window.electronAPI.db.query<{ id: number }>(
          `SELECT id FROM ventas WHERE tn_order_id = ?`, [tnOrderId]
        )
        if (exists.length > 0) continue

        try {
          const fecha    = (order.created_at ?? new Date().toISOString()).slice(0, 10)
          const clienteN = [order.customer?.name, order.customer?.lastname].filter(Boolean).join(' ').trim() || null
          const clienteT = order.customer?.phone ?? null
          const envio    = parseFloat(order.shipping_cost_owner ?? order.shipping_cost_customer ?? '0')
          const total    = parseFloat(order.total ?? '0')
          const subtotal = total - envio
          const numero   = `TN-${tnOrderId}`

          const r = await window.electronAPI.db.run(
            `INSERT INTO ventas
               (numero_venta, fecha, canal_id, cliente_nombre, cliente_telefono,
                subtotal, descuento, comision_canal, costo_envio, total,
                estado, tn_order_id, tipo_envio, created_at, updated_at)
             VALUES (?,?,?,?,?,?,0,0,?,?,'completada',?,'standard',datetime('now'),datetime('now'))`,
            [numero, fecha, canalId, clienteN, clienteT, subtotal, envio, total, tnOrderId]
          )
          const ventaId = r.lastInsertRowid as number

          for (const item of order.products ?? []) {
            const tnProdId  = String(item.product_id)
            const tnVarId   = String(item.variant_id ?? '')
            const cant      = parseInt(item.quantity ?? '1')
            const precio    = parseFloat(item.price ?? '0')
            const subtItem  = cant * precio

            const [prodRow] = await window.electronAPI.db.query<{ id: number }>(
              `SELECT id FROM productos WHERE tn_product_id = ?`, [tnProdId]
            )
            const [varRow] = tnVarId
              ? await window.electronAPI.db.query<{ talla_id: number }>(
                  `SELECT talla_id FROM producto_tallas WHERE tn_variant_id = ?`, [tnVarId]
                )
              : [null]

            if (prodRow) {
              await window.electronAPI.db.run(
                `INSERT INTO venta_items
                   (venta_id, producto_id, talla_id, cantidad, precio_unitario,
                    descuento_item, subtotal_item, costo_unitario_snap, comision_item, utilidad_item)
                 VALUES (?,?,?,?,?,0,?,0,0,0)`,
                [ventaId, prodRow.id, varRow?.talla_id ?? null, cant, precio, subtItem]
              )
              // Descontar stock si hay talla
              if (varRow?.talla_id) {
                await window.electronAPI.db.run(
                  `UPDATE inventario_productos
                   SET stock = MAX(0, stock - ?), updated_at = datetime('now')
                   WHERE producto_id = ? AND talla_id = ?`,
                  [cant, prodRow.id, varRow.talla_id]
                )
                await window.electronAPI.db.run(
                  `INSERT INTO movimientos_inventario
                     (producto_id, talla_id, tipo, cantidad, notas, venta_id, fecha, created_at)
                   VALUES (?,?,'salida_venta',?,?,?,?,datetime('now'))`,
                  [prodRow.id, varRow.talla_id, -cant, `Orden TN #${tnOrderId}`, ventaId, fecha]
                )
              }
            }
          }
          ok++
        } catch { errores++ }
      }
      const log: SyncLog = {
        tipo: 'import_ordenes', ok, errores,
        mensaje: `${ok} órdenes importadas, ${errores} errores`,
        fecha: new Date().toISOString()
      }
      setSyncLogs(prev => [log, ...prev.slice(0, 9)])
      toast.success(`${ok} órdenes importadas`)
    } catch (err) {
      toast.error('Error al sincronizar órdenes')
      console.error(err)
    } finally {
      setSyncingOrd(false); setSyncMsg('')
    }
  }

  // ── CSV Import ────────────────────────────────────────────────────────────
  async function handleCsvFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const buffer = await file.arrayBuffer()
      // Intentar UTF-8; si hay caracteres de reemplazo, releer como Windows-1252
      let text = new TextDecoder('utf-8').decode(buffer)
      if (text.includes('\uFFFD')) {
        text = new TextDecoder('windows-1252').decode(buffer)
      }
      // Strip BOM si existe
      if (text.startsWith('\uFEFF')) text = text.slice(1)
      const rows = parseCsv(text)
      if (rows.length < 2) { toast.error('El archivo CSV está vacío'); return }

      const headers = rows[0].map(h => h.trim())
      const REQ = ['Identificador de URL', 'Precio', 'Valor de propiedad 1', 'Stock']
      const missing = REQ.filter(c => !headers.includes(c))
      if (missing.length > 0) {
        toast.error(`Columnas faltantes: ${missing.join(', ')}`)
        return
      }

      const iRef    = headers.indexOf('Identificador de URL')
      const iNombre = headers.indexOf('Nombre')
      const iPrecio = headers.indexOf('Precio')
      const iTalla  = headers.indexOf('Valor de propiedad 1')
      const iStock  = headers.indexOf('Stock')
      const iDesc   = headers.indexOf('Descripción')

      type GroupData = { nombre: string; descripcion: string | null; precio: number; variantes: CsvVariante[]; warnings: string[] }
      const groups  = new Map<string, GroupData>()
      const skipped: string[] = []

      for (let r = 1; r < rows.length; r++) {
        const row    = rows[r]
        const ref    = (row[iRef]    ?? '').trim()
        const nombre = (row[iNombre] ?? '').trim()
        const talla  = (row[iTalla]  ?? '').trim()
        const stock  = parseInt((row[iStock] ?? '').replace(/,/g, '') || '0') || 0

        if (!ref) { skipped.push(`Fila ${r + 1}: sin Identificador de URL`); continue }

        if (!groups.has(ref)) {
          const rawDesc = iDesc >= 0 ? (row[iDesc] ?? '').trim() : ''
          groups.set(ref, {
            nombre:      nombre || ref,
            descripcion: rawDesc ? htmlToText(rawDesc) : null,
            precio:      parsePrecioTN(row[iPrecio] ?? ''),
            variantes:   [],
            warnings:    []
          })
        } else if (nombre) {
          groups.get(ref)!.nombre = nombre
          if (iDesc >= 0) {
            const rawDesc = (row[iDesc] ?? '').trim()
            if (rawDesc) groups.get(ref)!.descripcion = htmlToText(rawDesc)
          }
        }

        const g = groups.get(ref)!
        if (!talla) { g.warnings.push(`Fila ${r + 1}: sin talla — variante omitida`); continue }
        g.variantes.push({ talla, stock })
      }

      if (groups.size === 0) { toast.error('No se encontraron productos válidos'); return }

      const items: CsvPreviewItem[] = []
      for (const [ref, g] of groups) {
        let ex = await window.electronAPI.db.query<{ id: number }>(
          `SELECT id FROM productos WHERE referencia = ?`, [ref]
        )
        if (ex.length === 0 && g.nombre !== ref) {
          ex = await window.electronAPI.db.query<{ id: number }>(
            `SELECT id FROM productos WHERE nombre = ?`, [g.nombre]
          )
        }
        items.push({
          referencia:  ref,
          nombre:      g.nombre,
          descripcion: g.descripcion,
          precio:      g.precio,
          variantes:   g.variantes,
          estado:      ex.length > 0 ? 'actualizar' : 'nuevo',
          warnings:    g.warnings,
        })
      }

      setCsvPreview(items)
      setCsvSkipped(skipped)
    } catch (err) {
      console.error(err)
      toast.error('Error al leer el archivo CSV')
    }
  }

  async function handleCsvConfirm() {
    if (!csvPreview) return
    setImportingCsv(true)
    let ok = 0; let errores = 0
    try {
      for (const item of csvPreview) {
        try {
          let productoId: number
          let ex = await window.electronAPI.db.query<{ id: number }>(
            `SELECT id FROM productos WHERE referencia = ?`, [item.referencia]
          )
          if (ex.length === 0 && item.nombre !== item.referencia) {
            ex = await window.electronAPI.db.query<{ id: number }>(
              `SELECT id FROM productos WHERE nombre = ?`, [item.nombre]
            )
          }
          if (ex.length > 0) {
            productoId = ex[0].id
            await window.electronAPI.db.run(
              `UPDATE productos SET nombre=?, precio_venta=?, referencia=?, descripcion=?, updated_at=datetime('now') WHERE id=?`,
              [item.nombre, item.precio, item.referencia, item.descripcion ?? null, productoId]
            )
          } else {
            const r = await window.electronAPI.db.run(
              `INSERT INTO productos (nombre, precio_venta, referencia, descripcion, activo, created_at, updated_at)
               VALUES (?,?,?,?,1,datetime('now'),datetime('now'))`,
              [item.nombre, item.precio, item.referencia, item.descripcion ?? null]
            )
            productoId = r.lastInsertRowid as number
          }

          for (const v of item.variantes) {
            let [tr] = await window.electronAPI.db.query<{ id: number }>(
              `SELECT id FROM tallas WHERE nombre = ?`, [v.talla]
            )
            let tallaId: number
            if (tr) {
              tallaId = tr.id
            } else {
              const ins = await window.electronAPI.db.run(
                `INSERT OR IGNORE INTO tallas (nombre, orden, activo) VALUES (?,99,1)`, [v.talla]
              )
              tallaId = ins.lastInsertRowid as number ||
                (await window.electronAPI.db.query<{ id: number }>(
                  `SELECT id FROM tallas WHERE nombre = ?`, [v.talla]
                ))[0].id
            }
            await window.electronAPI.db.run(
              `INSERT INTO producto_tallas (producto_id, talla_id, activa) VALUES (?,?,1)
               ON CONFLICT(producto_id, talla_id) DO UPDATE SET activa = 1`,
              [productoId, tallaId]
            )
            await window.electronAPI.db.run(
              `INSERT INTO inventario_productos (producto_id, talla_id, stock, updated_at)
               VALUES (?,?,?,datetime('now'))
               ON CONFLICT(producto_id, talla_id)
               DO UPDATE SET stock=excluded.stock, updated_at=datetime('now')`,
              [productoId, tallaId, v.stock]
            )
          }
          ok++
        } catch (err) { console.error('CSV import error', item.referencia, err); errores++ }
      }
      setSyncLogs(prev => [{
        tipo:    'import_csv',
        ok, errores,
        mensaje: `CSV: ${ok} productos importados${errores > 0 ? `, ${errores} errores` : ''}`,
        fecha:   new Date().toISOString(),
      }, ...prev.slice(0, 9)])
      toast.success(`${ok} productos importados desde CSV`)
      setCsvPreview(null); setCsvSkipped([])
    } catch (err) {
      toast.error('Error en la importación'); console.error(err)
    } finally {
      setImportingCsv(false)
    }
  }

  // ── CSV Import Órdenes ────────────────────────────────────────────────────
  async function handleOrdenCsvFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const buffer = await file.arrayBuffer()
      let text = new TextDecoder('utf-8').decode(buffer)
      if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buffer)
      if (text.startsWith('\uFEFF')) text = text.slice(1)

      const rows = parseCsv(text)
      if (rows.length < 2) { toast.error('El archivo CSV está vacío'); return }

      const headers = rows[0].map(h => h.trim())
      const REQ = ['Número de orden', 'Estado del pago', 'Total', 'Nombre del producto']
      const missing = REQ.filter(c => !headers.includes(c))
      if (missing.length > 0) {
        toast.error(`Columnas faltantes: ${missing.join(', ')}`)
        return
      }

      const col = (name: string) => headers.indexOf(name)
      const iNumOrden     = col('Número de orden')
      const iFecha        = col('Fecha')
      const iEstadoPago   = col('Estado del pago')
      const iNombreComp   = col('Nombre del comprador')
      const iEmail        = col('Email')
      const iTelefono     = col('Teléfono')
      const iDni          = col('DNI / CUIT')
      const iDireccion    = col('Dirección')
      const iNumero       = col('Número')
      const iPiso         = col('Piso')
      const iCiudad       = col('Ciudad')
      const iProvincia    = col('Provincia o estado')
      const iMedioPago    = col('Medio de pago')
      const iTransId      = col('Identificador de la transacción en el medio de pago')
      const iTracking      = col('Código de tracking del envío')
      const iSubtotal     = col('Subtotal de productos')
      const iDescuento    = col('Descuento')
      const iCostoEnvio   = col('Costo de envío')
      const iTotal        = col('Total')
      const iNombreProd   = col('Nombre del producto')
      const iPrecioProd   = col('Precio del producto')
      const iCantidadProd = col('Cantidad del producto')
      const iTnOrderId    = col('Identificador de la orden')

      type GroupData = {
        fecha: string; creado_en: string; estado_pago: 'completada' | 'pendiente' | 'cancelado'
        cliente_nombre: string; cliente_email: string; cliente_telefono: string; cliente_dni: string
        direccion: string; ciudad: string; provincia: string; medio_pago_texto: string; pago_transaccion_id: string
        guia_numero: string; transportadora_texto: string
        subtotal: number; descuento: number; costo_envio: number; total: number
        tn_order_id: string
        items: { nombre_producto: string; talla: string; precio: number; cantidad: number }[]
      }

      const groups = new Map<string, GroupData>()

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        const numOrden = (row[iNumOrden] ?? '').trim()
        if (!numOrden) continue

        const nombreProdRaw = (row[iNombreProd] ?? '').trim()

        if (!groups.has(numOrden)) {
          const fechaRaw = iFecha >= 0 ? (row[iFecha] ?? '').trim() : ''
          const { fecha, creado_en } = parseFechaTN(fechaRaw)
          // Limpiar pago_transaccion_id: quitar ="..." que agrega TN
          const rawTransId = iTransId >= 0 ? (row[iTransId] ?? '').trim() : ''
          const cleanTransId = rawTransId.replace(/^="?(.+?)"?$/, '$1').trim()
          // Parsear tracking: "20310105147 Coordinadora" → guia + transportadora
          const rawTracking = iTracking >= 0 ? (row[iTracking] ?? '').trim() : ''
          const cleanTracking = rawTracking.replace(/^="?(.+?)"?\s*$/, '$1').trim()
          // Intentar separar: si el último token parece un nombre de empresa, es transportadora
          const trackingParts = cleanTracking.split(/\s+/).filter(Boolean)
          let guia_numero = cleanTracking
          let transportadora_texto = ''
          if (trackingParts.length >= 2) {
            // Heurística: si el último token tiene solo letras, es la transportadora
            const lastToken = trackingParts[trackingParts.length - 1]
            if (/^[A-Za-záéíóúñÁÉÍÓÚÑ]+$/.test(lastToken)) {
              transportadora_texto = lastToken
              guia_numero = trackingParts.slice(0, -1).join(' ')
            }
          }
          groups.set(numOrden, {
            fecha, creado_en,
            estado_pago:         estadoPagoTN(iEstadoPago >= 0 ? (row[iEstadoPago] ?? '') : ''),
            cliente_nombre:      iNombreComp >= 0 ? (row[iNombreComp] ?? '').trim() : '',
            cliente_email:       iEmail      >= 0 ? (row[iEmail]      ?? '').trim() : '',
            cliente_telefono:    iTelefono   >= 0 ? (row[iTelefono]   ?? '').trim() : '',
            cliente_dni:         iDni        >= 0 ? (row[iDni]        ?? '').trim() : '',
            direccion: [iDireccion,iNumero,iPiso]
              .map(i => i >= 0 ? (row[i] ?? '').trim() : '')
              .filter(Boolean).join(', '),
            ciudad:              iCiudad     >= 0 ? (row[iCiudad]     ?? '').trim() : '',
            provincia:           iProvincia  >= 0 ? (row[iProvincia]  ?? '').trim() : '',
            medio_pago_texto:    iMedioPago  >= 0 ? (row[iMedioPago]  ?? '').trim() : '',
            pago_transaccion_id: cleanTransId,
            guia_numero:         guia_numero,
            transportadora_texto: transportadora_texto,
            subtotal:    parsePrecioTN(iSubtotal   >= 0 ? (row[iSubtotal]   ?? '0') : '0'),
            descuento:   parsePrecioTN(iDescuento  >= 0 ? (row[iDescuento]  ?? '0') : '0'),
            costo_envio: parsePrecioTN(iCostoEnvio >= 0 ? (row[iCostoEnvio] ?? '0') : '0'),
            total:       parsePrecioTN(iTotal      >= 0 ? (row[iTotal]      ?? '0') : '0'),
            tn_order_id: iTnOrderId  >= 0 ? (row[iTnOrderId]  ?? '').trim() : numOrden,
            items: [],
          })
        }

        if (nombreProdRaw) {
          const { nombre, talla } = parseTallaDelNombre(nombreProdRaw)
          groups.get(numOrden)!.items.push({
            nombre_producto: nombre,
            talla,
            precio:   parsePrecioTN(iPrecioProd   >= 0 ? (row[iPrecioProd]   ?? '0') : '0'),
            cantidad: parseInt((row[iCantidadProd] ?? '1').replace(/,/g, ''), 10) || 1,
          })
        }
      }

      if (groups.size === 0) { toast.error('No se encontraron órdenes válidas'); return }

      // Cargar canal TN
      const [canalTN] = await window.electronAPI.db.query<{ id: number }>(
        `SELECT id FROM canales_venta WHERE nombre = 'Tienda Nube' LIMIT 1`
      )

      // Resolver productos y verificar duplicados
      const preview: OrdenCsvPreviewItem[] = []
      const globalFaltantes = new Set<string>()

      for (const [numOrden, g] of groups) {
        // Verificar duplicado por tn_order_id
        const [dupRow] = await window.electronAPI.db.query<{ id: number }>(
          `SELECT id FROM ventas WHERE tn_order_id = ?`, [g.tn_order_id]
        )

        const resolvedItems = []
        const faltantes: string[] = []

        for (const item of g.items) {
          // Buscar producto por nombre exacto o con LIKE
          const [prodRow] = await window.electronAPI.db.query<{ id: number }>(
            `SELECT id FROM productos WHERE LOWER(nombre) = LOWER(?) AND activo = 1 LIMIT 1`,
            [item.nombre_producto]
          )
          let tallaId: number | null = null
          if (prodRow && item.talla) {
            const [tallaRow] = await window.electronAPI.db.query<{ id: number }>(
              `SELECT talla_id AS id FROM inventario_productos ip
               JOIN tallas t ON t.id = ip.talla_id
               WHERE ip.producto_id = ? AND LOWER(t.nombre) = LOWER(?) LIMIT 1`,
              [prodRow.id, item.talla]
            )
            tallaId = tallaRow?.id ?? null
          }
          if (!prodRow) {
            const key = item.talla ? `${item.nombre_producto} (${item.talla})` : item.nombre_producto
            faltantes.push(key)
            globalFaltantes.add(item.nombre_producto)
          }
          resolvedItems.push({
            ...item,
            producto_id: prodRow?.id ?? null,
            talla_id:    tallaId,
          })
        }

        preview.push({
          ...g,
          numero_orden: numOrden,
          items: resolvedItems,
          estado_import: dupRow ? 'duplicada' : faltantes.length > 0 ? 'productos_faltantes' : 'nuevo',
          faltantes,
        })
      }

      const errors: string[] = []
      if (globalFaltantes.size > 0) {
        errors.push(`${globalFaltantes.size} producto(s) no encontrado(s) — selecciona el equivalente en cada fila para poder importarlos:`)
        globalFaltantes.forEach(n => errors.push(`• ${n}`))
      }

      // Cargar lista completa de productos para el selector manual
      const todosProductos = await window.electronAPI.db.query<{ id: number; nombre: string }>(
        `SELECT id, nombre FROM productos WHERE activo = 1 ORDER BY nombre`
      )
      setAllProductos(todosProductos)

      setOrdenCsvPreview(preview)
      setOrdenCsvErrors(errors)
    } catch (err) {
      console.error(err)
      toast.error('Error al leer el archivo CSV')
    }
  }

  async function handleResolveFaltante(ordenIdx: number, itemIdx: number, productoId: number) {
    if (!ordenCsvPreview) return
    // Buscar talla_id para este producto + nombre de talla del ítem
    const item = ordenCsvPreview[ordenIdx].items[itemIdx]
    let tallaId: number | null = null
    if (item.talla && productoId) {
      const [tallaRow] = await window.electronAPI.db.query<{ id: number }>(
        `SELECT talla_id AS id FROM inventario_productos ip
         JOIN tallas t ON t.id = ip.talla_id
         WHERE ip.producto_id = ? AND LOWER(t.nombre) = LOWER(?) LIMIT 1`,
        [productoId, item.talla]
      )
      tallaId = tallaRow?.id ?? null
    }

    setOrdenCsvPreview(prev => {
      if (!prev) return prev
      const next = prev.map((orden, oi) => {
        if (oi !== ordenIdx) return orden
        const newItems = orden.items.map((it, ii) =>
          ii === itemIdx ? { ...it, producto_id: productoId || null, talla_id: tallaId } : it
        )
        const sinResolver = newItems.filter(it => it.producto_id === null).length
        return {
          ...orden,
          items: newItems,
          estado_import: orden.estado_import === 'duplicada'
            ? 'duplicada'
            : sinResolver === 0 ? 'nuevo' : 'productos_faltantes',
          faltantes: newItems.filter(it => !it.producto_id).map(it =>
            it.talla ? `${it.nombre_producto} (${it.talla})` : it.nombre_producto
          ),
        } as OrdenCsvPreviewItem
      })
      return next
    })
  }

  async function handleOrdenCsvConfirm() {
    if (!ordenCsvPreview) return
    const nuevas = ordenCsvPreview.filter(o => o.estado_import === 'nuevo')
    if (nuevas.length === 0) { toast.warning('No hay órdenes nuevas para importar'); return }

    setImportingOrdenes(true)
    let ok = 0; let errores = 0

    // Cargar canal TN y medios de pago una vez
    const [canalTN] = await window.electronAPI.db.query<{ id: number }>(
      `SELECT id FROM canales_venta WHERE nombre = 'Tienda Nube' LIMIT 1`
    )
    const mediosPago = await window.electronAPI.db.query<{ id: number; nombre: string }>(
      `SELECT id, nombre FROM medios_pago WHERE activo = 1`
    )
    const transportadoras = await window.electronAPI.db.query<{ id: number; nombre: string }>(
      `SELECT id, nombre FROM transportadoras WHERE activa = 1`
    )

    try {
      for (const orden of nuevas) {
        try {
          // Match medio de pago
          const medioPagoTextoLower = orden.medio_pago_texto.toLowerCase()
          const medioMatch = mediosPago.find(m =>
            medioPagoTextoLower.includes(m.nombre.toLowerCase()) ||
            m.nombre.toLowerCase().includes(medioPagoTextoLower)
          )
          const medioId = medioMatch?.id ?? null

          // Match transportadora
          const transTextoLower = orden.transportadora_texto.toLowerCase()
          const transMatch = transTextoLower
            ? transportadoras.find(t =>
                transTextoLower.includes(t.nombre.toLowerCase()) ||
                t.nombre.toLowerCase().includes(transTextoLower)
              )
            : null
          const transportadoraId = transMatch?.id ?? null

          // Upsert cliente
          let clienteId: number | null = null
          const emailClean = orden.cliente_email || null
          const dniClean   = orden.cliente_dni   || null
          const nombreClean = orden.cliente_nombre || null
          if (nombreClean || emailClean || dniClean) {
            let ex: { id: number }[] = []
            if (emailClean) ex = await window.electronAPI.db.query<{ id: number }>(`SELECT id FROM clientes WHERE email = ?`, [emailClean])
            if (ex.length === 0 && dniClean) ex = await window.electronAPI.db.query<{ id: number }>(`SELECT id FROM clientes WHERE dni = ?`, [dniClean])
            if (ex.length > 0) {
              clienteId = ex[0].id
              await window.electronAPI.db.run(
                `UPDATE clientes SET nombre=COALESCE(NULLIF(?, ''),nombre), email=COALESCE(?,email), telefono=COALESCE(NULLIF(?, ''),telefono), dni=COALESCE(?,dni), updated_at=datetime('now') WHERE id=?`,
                [nombreClean, emailClean, orden.cliente_telefono || null, dniClean, clienteId]
              )
            } else {
              const cr = await window.electronAPI.db.run(
                `INSERT INTO clientes (nombre, email, telefono, dni, created_at, updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now'))`,
                [nombreClean || 'Cliente', emailClean, orden.cliente_telefono || null, dniClean]
              )
              clienteId = cr.lastInsertRowid as number
            }
          }

          // Insertar venta
          const numero = `TN-${orden.numero_orden}`
          const r = await window.electronAPI.db.run(
            `INSERT INTO ventas
               (numero_venta, fecha, canal_id, medio_pago_id,
                cliente_id, cliente_nombre, cliente_telefono, cliente_email, cliente_dni,
                subtotal, descuento, comision_canal,
                tipo_envio, costo_envio, costo_envio_real,
                envio_direccion, envio_ciudad, envio_departamento,
                transportadora_id, guia_numero,
                comision_medio_pago, pago_transaccion_id, tn_order_id,
                total, notas, estado, creado_en, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,0,'standard',?,?,?,?,?,?,?,0,?,?,?,null,?,?,datetime('now'),datetime('now'))`,
            [numero, orden.fecha, canalTN?.id ?? null, medioId,
             clienteId, orden.cliente_nombre || null, orden.cliente_telefono || null,
             emailClean, dniClean,
             orden.subtotal, orden.descuento,
             orden.costo_envio, orden.costo_envio,
             orden.direccion || null, orden.ciudad || null, orden.provincia || null,
             transportadoraId, orden.guia_numero || null,
             orden.pago_transaccion_id || null, orden.tn_order_id || null,
             orden.total, orden.estado_pago, orden.creado_en]
          )
          const ventaId = r.lastInsertRowid as number

          // Insertar ítems
          const brutoTotal = orden.items.reduce((s, it) => s + it.cantidad * it.precio, 0)
          for (const item of orden.items) {
            if (!item.producto_id) continue
            const brutoIt = item.cantidad * item.precio
            // Buscar costo desde ficha vigente
            const [fichaRow] = await window.electronAPI.db.query<{ costo_total: number }>(
              `SELECT costo_total FROM fichas_costo
               WHERE producto_id = ? AND vigente = 1
               ORDER BY version DESC LIMIT 1`,
              [item.producto_id]
            )
            const costoSnap = fichaRow?.costo_total ?? 0
            await window.electronAPI.db.run(
              `INSERT INTO venta_items (venta_id, producto_id, talla_id, cantidad,
                 precio_unitario, descuento_item, subtotal_item,
                 costo_unitario_snap, comision_item, utilidad_item)
               VALUES (?,?,?,?,?,0,?,?,0,?)`,
              [ventaId, item.producto_id, item.talla_id, item.cantidad,
               item.precio, brutoIt, costoSnap,
               brutoIt - costoSnap * item.cantidad]
            )
            // Descontar stock
            if (restarStock && item.talla_id && orden.estado_pago !== 'cancelado') {
              await window.electronAPI.db.run(
                `UPDATE inventario_productos SET stock=MAX(0,stock-?), updated_at=datetime('now')
                 WHERE producto_id=? AND talla_id=?`,
                [item.cantidad, item.producto_id, item.talla_id]
              )
              await window.electronAPI.db.run(
                `INSERT INTO movimientos_inventario
                   (producto_id, talla_id, tipo, cantidad, notas, venta_id, fecha, created_at)
                 VALUES (?,?,'salida_venta',?,?,?,?,datetime('now'))`,
                [item.producto_id, item.talla_id, -item.cantidad,
                 `Orden TN #${orden.tn_order_id}`, ventaId, orden.fecha]
              )
            }
          }
          ok++
        } catch (err) { console.error('Error orden', orden.numero_orden, err); errores++ }
      }
      setSyncLogs(prev => [{
        tipo: 'import_csv_ordenes', ok, errores,
        mensaje: `CSV Órdenes: ${ok} importadas${errores > 0 ? `, ${errores} errores` : ''}`,
        fecha: new Date().toISOString(),
      }, ...prev.slice(0, 9)])
      toast.success(`${ok} órdenes importadas`)
      setOrdenCsvPreview(null); setOrdenCsvErrors([])
    } catch (err) {
      toast.error('Error en la importación'); console.error(err)
    } finally {
      setImportingOrdenes(false)
    }
  }

  // ── Conciliación ──────────────────────────────────────────────────────────
  async function handleConciliacionCsvFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const buffer = await file.arrayBuffer()
      let text = new TextDecoder('utf-8').decode(buffer)
      if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buffer)
      if (text.startsWith('\uFEFF')) text = text.slice(1)

      const rows = parseCsv(text)
      if (rows.length < 2) { toast.error('El archivo CSV está vacío'); return }

      const headers = rows[0].map(h => h.trim())

      // Detectar columnas según procesador
      type ColMap = { transId: number; comision: number }
      let colMap: ColMap = { transId: -1, comision: -1 }

      if (concilProcesador === 'mercadopago') {
        // MP: "Número de operación", "Comisión de Mercado Pago" o "Cargos"
        colMap.transId  = headers.findIndex(h => /número.*(operaci|transacci)/i.test(h) || /external.*(id|ref)/i.test(h))
        colMap.comision = headers.findIndex(h => /comisi[oó]n|cargo|fee/i.test(h))
      } else {
        // Bold: "ID Transacción", "Tarifa" o "Comisión"
        colMap.transId  = headers.findIndex(h => /id.*transacc|transacc.*id/i.test(h))
        colMap.comision = headers.findIndex(h => /tarifa|comisi[oó]n|fee/i.test(h))
      }

      if (colMap.transId < 0 || colMap.comision < 0) {
        toast.error(`No se encontraron las columnas de ID de transacción y comisión. Columnas disponibles: ${headers.slice(0,8).join(', ')}`)
        return
      }

      const preview: typeof concilPreview = []
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        const rawId = (row[colMap.transId] ?? '').trim().replace(/^="?(.+?)"?$/, '$1')
        const rawCom = (row[colMap.comision] ?? '').trim()
        if (!rawId) continue
        const comision = Math.abs(parsePrecioTN(rawCom.replace(/[$\s%]/g, '')))

        const [ventaRow] = await window.electronAPI.db.query<{ id: number; numero_venta: string }>(
          `SELECT id, numero_venta FROM ventas WHERE pago_transaccion_id = ? LIMIT 1`, [rawId]
        )
        preview.push({
          transaccion_id: rawId,
          comision,
          venta_id:     ventaRow?.id     ?? null,
          numero_venta: ventaRow?.numero_venta ?? null,
        })
      }

      if (preview.length === 0) { toast.error('No se encontraron transacciones en el archivo'); return }
      setConcilPreview(preview)
    } catch (err) {
      console.error(err); toast.error('Error al leer el archivo de conciliación')
    }
  }

  async function handleConciliacionConfirmar() {
    if (!concilPreview) return
    const conciliables = concilPreview.filter(c => c.venta_id !== null)
    if (conciliables.length === 0) { toast.warning('No hay transacciones que coincidan con ventas'); return }
    setConciliando(true)
    let ok = 0
    try {
      for (const c of conciliables) {
        await window.electronAPI.db.run(
          `UPDATE ventas SET comision_medio_pago = ?, updated_at = datetime('now') WHERE id = ?`,
          [c.comision, c.venta_id]
        )
        ok++
      }
      toast.success(`${ok} ventas actualizadas con comisión real`)
      setConcilPreview(null)
    } catch (err) {
      toast.error('Error al guardar conciliación'); console.error(err)
    } finally {
      setConciliando(false)
    }
  }

  const syncing = syncingProd || syncingStock || syncingOrd

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center
                        justify-center text-accent shrink-0">
          <Store size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-primary">Tienda Nube</h2>
          <p className="text-sm text-primary-muted">
            {storeName ?? 'Integración con tu tienda online'}
          </p>
        </div>
        <div className={cn(
          'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
          'text-sm font-semibold border',
          conectado
            ? 'bg-success/10 border-success/20 text-success'
            : 'bg-danger/10  border-danger/20  text-danger'
        )}>
          {conectado
            ? <><Wifi    size={13} /> Conectado</>
            : <><WifiOff size={13} /> Sin conexión</>
          }
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card rounded-xl p-1 border border-border w-fit">
        {([
          { key: 'config',        label: 'Configuración' },
          { key: 'productos',     label: 'Productos'     },
          { key: 'ordenes',       label: 'Órdenes'       },
          { key: 'conciliacion',  label: 'Conciliación'  },
        ] as { key: TabKey; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-base font-semibold transition-all',
              tab === t.key
                ? 'bg-accent text-white'
                : 'text-primary-muted hover:text-primary'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Configuración ───────────────────────────────────────────── */}
      {tab === 'config' && (
        <div className="flex flex-col gap-4">
          <div className="card flex flex-col gap-4">
            <div>
              <p className="text-base font-bold text-primary mb-0.5">
                Credenciales de la API
              </p>
              <p className="text-sm text-primary-muted">
                Encontrás tu Store ID y Access Token en{' '}
                <button
                  className="text-accent underline"
                  onClick={() => window.electronAPI.app.openExternal('https://partners.nuvemshop.com.br/')}
                >
                  Tienda Nube Partners
                </button>{' '}
                o en la sección de aplicaciones de tu tienda.
              </p>
            </div>

            {conectado && !editando ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 p-3 rounded-xl
                                border border-success/20 bg-success/5">
                  <CheckCircle size={16} className="text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary">
                      Store ID: <span className="font-mono">{savedStoreId}</span>
                    </p>
                    <p className="text-sm text-primary-muted font-mono">
                      Token: {'•'.repeat(10)}{savedToken.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestConexion}
                    disabled={testando}
                    className="btn-ghost"
                  >
                    {testando ? <Spinner size="sm" /> : <Wifi size={13} />}
                    Probar conexión
                  </button>
                  <button onClick={() => setEditando(true)} className="btn-ghost">
                    Cambiar
                  </button>
                  <button
                    onClick={handleDesconectar}
                    className="btn-ghost text-danger hover:text-danger ml-auto"
                  >
                    Desconectar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="input-label">ID de tienda</label>
                  <input
                    type="text" placeholder="Ej: 123456"
                    value={storeId} onChange={e => setStoreId(e.target.value)}
                    className="input font-mono text-base"
                  />
                </div>
                <div>
                  <label className="input-label">Access Token</label>
                  <input
                    type="password" placeholder="Pegar token…"
                    value={token} onChange={e => setToken(e.target.value)}
                    className="input font-mono text-base"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleGuardar} className="btn-primary">
                    Guardar
                  </button>
                  {editando && (
                    <button
                      onClick={() => { setEditando(false); setStoreId(savedStoreId); setToken(savedToken) }}
                      className="btn-ghost"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Acciones de sync */}
          {conectado && (
            <div className="card flex flex-col gap-4">
              <p className="text-base font-bold text-primary">
                Sincronización manual
              </p>

              {syncing && syncMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl
                                bg-accent-light border border-accent/20">
                  <Spinner size="sm" />
                  <span className="text-base text-accent">{syncMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SyncCard
                  icon={<Package size={22} className="text-accent" />}
                  title="Importar productos"
                  desc="Trae productos y variantes de TN a esta app"
                  loading={syncingProd}
                  disabled={syncing}
                  onClick={handleSyncProductos}
                />
                <SyncCard
                  icon={<Boxes size={22} className="text-accent" />}
                  title="Enviar stock"
                  desc="Actualiza el stock de TN con nuestros datos"
                  loading={syncingStock}
                  disabled={syncing}
                  onClick={handlePushStock}
                />
                <SyncCard
                  icon={<ShoppingCart size={22} className="text-accent" />}
                  title="Importar órdenes"
                  desc="Importa pedidos pagados como ventas"
                  loading={syncingOrd}
                  disabled={syncing}
                  onClick={handleSyncOrdenes}
                />
              </div>

              {/* Log de últimas operaciones */}
              {syncLogs.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                  <p className="text-xs font-bold text-primary-muted uppercase tracking-wider mb-1">
                    Últimas operaciones
                  </p>
                  {syncLogs.map((log, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      {log.errores === 0
                        ? <CheckCircle  size={13} className="text-success shrink-0" />
                        : <AlertTriangle size={13} className="text-warning shrink-0" />
                      }
                      <span className="text-primary-muted">{log.mensaje}</span>
                      <span className="ml-auto text-primary-muted text-xs">
                        {formatDate(log.fecha.slice(0, 10))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Productos ───────────────────────────────────────────────── */}
      {tab === 'productos' && (
        <>
          {/* Hidden file input for CSV */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvFileSelect}
          />

          {csvPreview ? (
            /* ── Vista previa de importación CSV ──────────────────────── */
            <div className="card flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-primary">
                    Vista previa — Importar desde CSV
                  </p>
                  <p className="text-sm text-primary-muted mt-0.5">
                    Revisá los cambios antes de confirmar
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-success font-semibold">
                    {csvPreview.filter(i => i.estado === 'nuevo').length} nuevos
                  </span>
                  <span className="text-primary-muted">·</span>
                  <span className="text-accent font-semibold">
                    {csvPreview.filter(i => i.estado === 'actualizar').length} a actualizar
                  </span>
                </div>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0B0B16]">
                    <th className="th text-left px-3 py-2">Nombre</th>
                    <th className="th text-left px-3 py-2">Referencia</th>
                    <th className="th text-right px-3 py-2">Precio</th>
                    <th className="th text-center px-3 py-2">Tallas</th>
                    <th className="th text-center px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.map((item, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-base text-primary">
                        {item.nombre}
                        {item.warnings.length > 0 && (
                          <span
                            className="ml-2 text-xs text-warning cursor-help"
                            title={item.warnings.join('\n')}
                          >
                            ⚠ {item.warnings.length} talla(s) omitida(s)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-sm text-primary-muted">
                        {item.referencia}
                      </td>
                      <td className="px-3 py-2.5 text-right text-base">
                        {formatCOP(item.precio)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-sm text-primary-muted">
                        {item.variantes.map(v => v.talla).join(', ')}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border',
                          item.estado === 'nuevo'
                            ? 'bg-success/10 border-success/20 text-success'
                            : 'bg-accent/10  border-accent/20  text-accent'
                        )}>
                          {item.estado === 'nuevo' ? 'Nuevo' : 'Actualizar'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(csvSkipped.length > 0 || csvPreview.some(i => i.warnings.length > 0)) && (
                <div className="flex flex-col gap-1 pt-2 border-t border-border">
                  <p className="text-xs font-bold text-warning uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Filas omitidas
                  </p>
                  {csvSkipped.map((w, i) => (
                    <p key={i} className="text-sm text-primary-muted">{w}</p>
                  ))}
                  {csvPreview.flatMap(item =>
                    item.warnings.map((w, wi) => (
                      <p key={`${item.referencia}-${wi}`} className="text-sm text-primary-muted">{w}</p>
                    ))
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button
                  onClick={handleCsvConfirm}
                  disabled={importingCsv}
                  className="btn-primary"
                >
                  {importingCsv ? <Spinner size="sm" /> : <CheckCircle size={13} />}
                  Confirmar importación ({csvPreview.length} productos)
                </button>
                <button
                  onClick={() => { setCsvPreview(null); setCsvSkipped([]) }}
                  disabled={importingCsv}
                  className="btn-ghost"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            /* ── Tabla de productos importados ─────────────────────────── */
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-base font-bold text-primary">
                  Productos importados
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="btn-ghost"
                  >
                    <Upload size={13} />
                    Importar CSV
                  </button>
                  <button
                    onClick={handleSyncProductos}
                    disabled={syncing || !conectado}
                    className="btn-ghost"
                  >
                    {syncingProd ? <Spinner size="sm" /> : <RefreshCw size={13} />}
                    Sincronizar API
                  </button>
                </div>
              </div>
              {loadingData ? (
                <div className="flex justify-center py-10"><Spinner size="lg" /></div>
              ) : productos.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    icon={Package}
                    title="Sin productos importados"
                    description='Importá desde un CSV de Tienda Nube o usá "Sincronizar API" si tenés acceso.'
                  />
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0B0B16]">
                      <th className="th text-left px-4 py-2">Nombre</th>
                      <th className="th text-left px-4 py-2">Referencia</th>
                      <th className="th text-right px-4 py-2">Precio</th>
                      <th className="th text-center px-4 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((p: any) => (
                      <tr key={p.id} className="border-b border-border/50
                                                 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 text-base text-primary">{p.nombre}</td>
                        <td className="px-4 py-2.5 font-mono text-sm text-primary-muted">
                          {p.referencia ?? p.tn_product_id ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-base">
                          {formatCOP(p.precio_venta)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border',
                            p.activo
                              ? 'bg-success/10 border-success/20 text-success'
                              : 'bg-danger/10  border-danger/20  text-danger'
                          )}>
                            {p.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Órdenes ─────────────────────────────────────────────────── */}
      {tab === 'ordenes' && (
        <div className="flex flex-col gap-4">
          <input
            ref={csvOrdenInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleOrdenCsvFileSelect}
          />

          {/* Cabecera con acciones */}
          <div className="card flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-primary">Importar órdenes desde CSV</p>
              <p className="text-sm text-primary-muted mt-0.5">
                Descarga el CSV de ventas desde el panel de TN y súbelo aquí.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Toggle restar stock */}
              <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                restarStock
                  ? 'bg-success/10 border-success/20 text-success'
                  : 'bg-warning/10 border-warning/20 text-warning'
              }`}>
                <input
                  type="checkbox"
                  checked={restarStock}
                  onChange={e => setRestarStock(e.target.checked)}
                  className="accent-accent"
                />
                {restarStock ? 'Restar stock al importar' : 'NO restar stock (cargue inicial)'}
              </label>
              <div className="flex gap-2">
              <button
                onClick={() => csvOrdenInputRef.current?.click()}
                disabled={importingOrdenes}
                className="btn-primary"
              >
                <Upload size={14} /> Importar CSV
              </button>
              <button
                onClick={handleSyncOrdenes}
                disabled={syncing || !conectado}
                className="btn-ghost"
                title={!conectado ? 'Sin conexión a TN' : 'Sincronizar vía API'}
              >
                {syncingOrd ? <Spinner size="sm" /> : <RefreshCw size={13} />}
                Sincronizar API
              </button>
            </div>
            </div>
          </div>

          {/* Preview CSV de órdenes */}
          {ordenCsvPreview && (
            <div className="card flex flex-col gap-4">
              {/* Advertencia de productos faltantes (no bloqueante) */}
              {ordenCsvErrors.length > 0 && (
                <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-warning font-semibold text-base mb-1">
                    <AlertTriangle size={16} /> Productos no reconocidos — selecciona el equivalente
                  </div>
                  {ordenCsvErrors.map((msg, i) => (
                    <p key={i} className={`text-sm ${msg.startsWith('•') ? 'ml-4 text-primary' : 'text-primary-muted'}`}>{msg}</p>
                  ))}
                </div>
              )}

              {/* Resumen */}
              <div className="flex gap-4">
                {(['nuevo','duplicada','productos_faltantes'] as const).map(est => {
                  const count = ordenCsvPreview.filter(o => o.estado_import === est).length
                  const colors = { nuevo: 'text-success', duplicada: 'text-primary-muted', productos_faltantes: 'text-danger' }
                  const labels = { nuevo: 'Nuevas', duplicada: 'Ya importadas', productos_faltantes: 'Con faltantes' }
                  return (
                    <div key={est} className="flex items-center gap-2">
                      <span className={`text-xl font-bold ${colors[est]}`}>{count}</span>
                      <span className="text-sm text-primary-muted">{labels[est]}</span>
                    </div>
                  )
                })}
              </div>

              {/* Tabla preview */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0B0B16]">
                      <th className="th text-left px-3 py-2">#Orden</th>
                      <th className="th text-left px-3 py-2">Fecha</th>
                      <th className="th text-left px-3 py-2">Cliente</th>
                      <th className="th text-left px-3 py-2">Productos</th>
                      <th className="th text-right px-3 py-2">Total</th>
                      <th className="th text-left px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenCsvPreview.map((o, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className="px-3 py-2 font-mono text-sm text-primary-muted">TN-{o.numero_orden}</td>
                        <td className="px-3 py-2 text-sm text-primary-muted whitespace-nowrap">{o.fecha}</td>
                        <td className="px-3 py-2 text-sm text-primary max-w-[140px] truncate">{o.cliente_nombre || '—'}</td>
                        <td className="px-3 py-2 text-sm text-primary-muted">
                          {o.items.map((it, j) => (
                            <div key={j} className="flex items-center gap-1.5 mb-1 last:mb-0">
                              {it.talla && (
                                <span className="text-xs text-primary-muted shrink-0">({it.talla}) ×{it.cantidad}</span>
                              )}
                              {it.producto_id ? (
                                <span className="text-primary">
                                  {allProductos.find(p => p.id === it.producto_id)?.nombre ?? it.nombre_producto}
                                  {!it.talla && ` ×${it.cantidad}`}
                                </span>
                              ) : (
                                <select
                                  className="input h-7 text-xs py-0 flex-1 min-w-0"
                                  value=""
                                  onChange={e => handleResolveFaltante(i, j, Number(e.target.value))}
                                >
                                  <option value="">— {it.nombre_producto} —</option>
                                  {allProductos.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ))}
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-bold">{formatCOP(o.total)}</td>
                        <td className="px-3 py-2">
                          {o.estado_import === 'nuevo' && (
                            <span className="badge bg-success/10 text-success border-success/20 text-xs">Nueva</span>
                          )}
                          {o.estado_import === 'duplicada' && (
                            <span className="badge bg-white/5 text-primary-muted border-border text-xs">Ya importada</span>
                          )}
                          {o.estado_import === 'productos_faltantes' && (
                            <span className="badge bg-danger/10 text-danger border-danger/20 text-xs" title={o.faltantes.join(', ')}>
                              Faltantes
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Acciones */}
              <div className="flex justify-end gap-2 pt-1 border-t border-border">
                <button
                  onClick={() => { setOrdenCsvPreview(null); setOrdenCsvErrors([]) }}
                  className="btn-ghost"
                  disabled={importingOrdenes}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleOrdenCsvConfirm}
                  className="btn-primary"
                  disabled={importingOrdenes || ordenCsvPreview.every(o => o.estado_import !== 'nuevo')}
                >
                  {importingOrdenes
                    ? <><Spinner size="sm" /> Importando…</>
                    : `Importar ${ordenCsvPreview.filter(o => o.estado_import === 'nuevo').length} órdenes`
                  }
                </button>
              </div>
            </div>
          )}

          {/* Tabla de órdenes ya importadas */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-base font-bold text-primary">Órdenes importadas</h3>
            </div>
            {loadingData ? (
              <div className="flex justify-center py-10"><Spinner size="lg" /></div>
            ) : ordenes.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  icon={ShoppingCart}
                  title="Sin órdenes importadas"
                  description='Importa el CSV de ventas de TN para ver los pedidos aquí.'
                />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0B0B16]">
                    <th className="th text-left px-4 py-2">#</th>
                    <th className="th text-left px-4 py-2">Fecha</th>
                    <th className="th text-left px-4 py-2">Cliente</th>
                    <th className="th text-right px-4 py-2">Total</th>
                    <th className="th text-left px-4 py-2">Estado</th>
                    <th className="th text-left px-4 py-2">TN ID</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map((o: any) => (
                    <tr key={o.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5 font-mono text-sm text-primary-muted">{o.numero_venta}</td>
                      <td className="px-4 py-2.5 text-sm text-primary-muted whitespace-nowrap">{formatDate(o.fecha)}</td>
                      <td className="px-4 py-2.5 text-sm text-primary truncate max-w-[160px]">{o.cliente_nombre ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-bold">{formatCOP(o.total)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          'badge text-xs',
                          o.estado === 'completada' ? 'bg-success/10 text-success border-success/20' :
                          o.estado === 'pendiente'  ? 'bg-warning/10 text-warning border-warning/20' :
                          'bg-danger/10 text-danger border-danger/20'
                        )}>{o.estado}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <a
                          href={`https://torrida.mitiendanube.com/admin/orders/${o.tn_order_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-sm text-accent hover:underline"
                          onClick={e => { e.preventDefault(); window.electronAPI.app?.openExternal?.(`https://torrida.mitiendanube.com/admin/orders/${o.tn_order_id}`) }}
                        >
                          #{o.tn_order_id} <ExternalLink size={11} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Conciliación ─────────────────────────────────────────────── */}
      {tab === 'conciliacion' && (
        <div className="flex flex-col gap-4">
          <input
            ref={concilInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleConciliacionCsvFileSelect}
          />
          <div className="card flex flex-col gap-4">
            <div>
              <p className="text-base font-semibold text-primary">Conciliación de comisiones</p>
              <p className="text-sm text-primary-muted mt-0.5">
                Sube el reporte CSV de tu procesador de pago para actualizar las comisiones reales en cada venta.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <span className="input-label mb-0">Procesador:</span>
              {(['mercadopago', 'bold'] as const).map(p => (
                <label key={p} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    value={p}
                    checked={concilProcesador === p}
                    onChange={() => { setConcilProcesador(p); setConcilPreview(null) }}
                    className="accent-accent"
                  />
                  <span className="text-base text-primary capitalize">{p === 'mercadopago' ? 'Mercado Pago' : 'Bold'}</span>
                </label>
              ))}
            </div>

            <button
              onClick={() => concilInputRef.current?.click()}
              disabled={conciliando}
              className="btn-primary w-fit"
            >
              <Upload size={14} /> Subir reporte CSV
            </button>

            <div className="bg-accent-light border border-accent/20 rounded-xl p-3 text-sm text-primary-muted">
              <p className="font-semibold text-accent mb-1">¿Qué columnas necesita el archivo?</p>
              {concilProcesador === 'mercadopago'
                ? <p>Mercado Pago: columna con el ID de la operación y columna con la comisión/cargos.</p>
                : <p>Bold: columna con el ID de la transacción y columna con la tarifa cobrada.</p>
              }
            </div>
          </div>

          {concilPreview && (
            <div className="card flex flex-col gap-4">
              <div className="flex gap-6">
                <div>
                  <span className="text-xl font-bold text-success">{concilPreview.filter(c => c.venta_id).length}</span>
                  <span className="text-sm text-primary-muted ml-2">Coincidencias encontradas</span>
                </div>
                <div>
                  <span className="text-xl font-bold text-primary-muted">{concilPreview.filter(c => !c.venta_id).length}</span>
                  <span className="text-sm text-primary-muted ml-2">Sin match</span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0">
                    <tr className="border-b border-border bg-[#0B0B16]">
                      <th className="th text-left px-3 py-2">ID Transacción</th>
                      <th className="th text-right px-3 py-2">Comisión</th>
                      <th className="th text-left px-3 py-2">Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concilPreview.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className="px-3 py-2 font-mono text-sm text-primary-muted">{c.transaccion_id}</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-warning">{formatCOP(c.comision)}</td>
                        <td className="px-3 py-2 text-sm">
                          {c.numero_venta
                            ? <span className="text-success">{c.numero_venta}</span>
                            : <span className="text-primary-muted">Sin match</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-border">
                <button onClick={() => setConcilPreview(null)} className="btn-ghost" disabled={conciliando}>
                  Cancelar
                </button>
                <button
                  onClick={handleConciliacionConfirmar}
                  className="btn-primary"
                  disabled={conciliando || !concilPreview.some(c => c.venta_id)}
                >
                  {conciliando
                    ? <><Spinner size="sm" /> Guardando…</>
                    : `Actualizar ${concilPreview.filter(c => c.venta_id).length} ventas`
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-componente SyncCard ────────────────────────────────────────────────

interface SyncCardProps {
  icon:     React.ReactNode
  title:    string
  desc:     string
  loading:  boolean
  disabled: boolean
  onClick:  () => void
}

function SyncCard({ icon, title, desc, loading, disabled, onClick }: SyncCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-2 p-4 rounded-xl border',
        'transition-all text-center',
        !disabled
          ? 'border-border hover:border-accent/40 hover:bg-accent-light cursor-pointer'
          : 'border-border opacity-50 cursor-not-allowed',
        loading && 'border-accent bg-accent-light'
      )}
    >
      {loading ? <Spinner size="sm" /> : icon}
      <span className="text-base font-semibold text-primary">{title}</span>
      <span className="text-xs text-primary-muted leading-tight">{desc}</span>
    </button>
  )
}
