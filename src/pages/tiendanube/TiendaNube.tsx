import { useState, useEffect, useCallback } from 'react'
import {
  Store, Wifi, WifiOff, RefreshCw, ShoppingCart,
  Package, Boxes, CheckCircle, AlertTriangle,
  ExternalLink
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

type TabKey = 'config' | 'productos' | 'ordenes'

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
    if (!conectado) return
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
            `SELECT id, nombre, tn_product_id, precio_venta, activo
             FROM productos WHERE tn_product_id IS NOT NULL ORDER BY nombre`
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
          <h2 className="text-[17px] font-bold text-primary">Tienda Nube</h2>
          <p className="text-[12.5px] text-primary-muted">
            {storeName ?? 'Integración con tu tienda online'}
          </p>
        </div>
        <div className={cn(
          'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
          'text-[12px] font-semibold border',
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
          { key: 'config',    label: 'Configuración' },
          { key: 'productos', label: 'Productos'     },
          { key: 'ordenes',   label: 'Órdenes'       },
        ] as { key: TabKey; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all',
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
              <p className="text-[13.5px] font-bold text-primary mb-0.5">
                Credenciales de la API
              </p>
              <p className="text-[12.5px] text-primary-muted">
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
                    <p className="text-[12.5px] font-semibold text-primary">
                      Store ID: <span className="font-mono">{savedStoreId}</span>
                    </p>
                    <p className="text-[12px] text-primary-muted font-mono">
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
                    className="input font-mono text-[13px]"
                  />
                </div>
                <div>
                  <label className="input-label">Access Token</label>
                  <input
                    type="password" placeholder="Pegar token…"
                    value={token} onChange={e => setToken(e.target.value)}
                    className="input font-mono text-[13px]"
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
              <p className="text-[13.5px] font-bold text-primary">
                Sincronización manual
              </p>

              {syncing && syncMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl
                                bg-accent-light border border-accent/20">
                  <Spinner size="sm" />
                  <span className="text-[13px] text-accent">{syncMsg}</span>
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
                  <p className="text-[11px] font-bold text-primary-muted uppercase tracking-wider mb-1">
                    Últimas operaciones
                  </p>
                  {syncLogs.map((log, i) => (
                    <div key={i} className="flex items-center gap-3 text-[12.5px]">
                      {log.errores === 0
                        ? <CheckCircle  size={13} className="text-success shrink-0" />
                        : <AlertTriangle size={13} className="text-warning shrink-0" />
                      }
                      <span className="text-primary-muted">{log.mensaje}</span>
                      <span className="ml-auto text-primary-muted text-[11.5px]">
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
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-[13.5px] font-bold text-primary">
              Productos mapeados con TN
            </h3>
            <button
              onClick={handleSyncProductos}
              disabled={syncing}
              className="btn-ghost"
            >
              {syncingProd ? <Spinner size="sm" /> : <RefreshCw size={13} />}
              Sincronizar
            </button>
          </div>
          {loadingData ? (
            <div className="flex justify-center py-10"><Spinner size="lg" /></div>
          ) : productos.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={Package}
                title="Sin productos mapeados"
                description='Haz clic en "Sincronizar" para importar productos de Tienda Nube.'
              />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-[#0B0B16]">
                  <th className="th text-left px-4 py-2">Producto</th>
                  <th className="th text-left px-4 py-2">TN ID</th>
                  <th className="th text-right px-4 py-2">Precio</th>
                  <th className="th text-center px-4 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p: any) => (
                  <tr key={p.id} className="border-b border-border/50
                                             hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-[13px] text-primary">{p.nombre}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-primary-muted">
                      {p.tn_product_id}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px]">
                      {formatCOP(p.precio_venta)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border',
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

      {/* ── Tab: Órdenes ─────────────────────────────────────────────────── */}
      {tab === 'ordenes' && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-[13.5px] font-bold text-primary">
              Órdenes importadas de TN
            </h3>
            <button
              onClick={handleSyncOrdenes}
              disabled={syncing}
              className="btn-ghost"
            >
              {syncingOrd ? <Spinner size="sm" /> : <RefreshCw size={13} />}
              Sincronizar
            </button>
          </div>
          {loadingData ? (
            <div className="flex justify-center py-10"><Spinner size="lg" /></div>
          ) : ordenes.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={ShoppingCart}
                title="Sin órdenes importadas"
                description='Haz clic en "Sincronizar" para importar pedidos pagados.'
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
                  <th className="th text-left px-4 py-2">TN ID</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o: any) => (
                  <tr key={o.id} className="border-b border-border/50
                                             hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[12px] text-primary-muted">
                      {o.numero_venta}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-primary-muted whitespace-nowrap">
                      {formatDate(o.fecha)}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-primary truncate max-w-[160px]">
                      {o.cliente_nombre ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13.5px] font-bold">
                      {formatCOP(o.total)}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() =>
                          window.electronAPI.app.openExternal(
                            `https://www.tiendanube.com/admin/orders/${o.tn_order_id}`
                          )
                        }
                        className="flex items-center gap-1 text-[12px] text-accent hover:underline"
                      >
                        #{o.tn_order_id}
                        <ExternalLink size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      <span className="text-[13px] font-semibold text-primary">{title}</span>
      <span className="text-[11.5px] text-primary-muted leading-tight">{desc}</span>
    </button>
  )
}
