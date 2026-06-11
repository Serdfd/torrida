import { useEffect, useState, useCallback } from 'react'
import {
  Factory, Plus, ChevronDown, ChevronRight,
  CheckCircle2, Clock, Truck, PackageCheck,
  XCircle, RefreshCw, Search, Download, CheckCheck,
  Trash2, Pencil, Check, X
} from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { cn, objectsToCSV } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import OrdenForm from './OrdenForm'

// ── Tipos ──────────────────────────────────────────────────────────────────

type EstadoOrden = 'borrador' | 'confirmada' | 'en_produccion' | 'entregada' | 'cancelada'

interface Orden {
  id:               number
  numero:           string
  fabricante:       string | null
  proveedor_nombre: string | null
  estado:           EstadoOrden
  fecha_orden:      string
  fecha_entrega:    string | null
  costo_total:      number
  anticipo:         number
  fecha_anticipo:   string | null
  saldo:            number
  fecha_saldo:      string | null
  notas:            string | null
  items_count:      number
  unidades_total:   number
}

interface OrdenItem {
  id:              number
  producto_id:     number
  producto_nombre: string
  ficha_costo_id:  number | null
  cantidad_total:  number
  costo_unitario:  number
  subtotal:        number
  tallas:          { talla_nombre: string; cantidad: number }[]
}

// ── Helpers visuales ───────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoOrden, {
  label: string
  color: string
  icon:  React.ElementType
}> = {
  borrador:      { label: 'Borrador',      color: 'text-primary-muted', icon: Clock        },
  confirmada:    { label: 'Confirmada',     color: 'text-warning',       icon: CheckCircle2 },
  en_produccion: { label: 'En producción', color: 'text-accent',        icon: Factory      },
  entregada:     { label: 'Entregada',      color: 'text-success',       icon: PackageCheck },
  cancelada:     { label: 'Cancelada',      color: 'text-danger',        icon: XCircle      },
}

const SIGUIENTE: Partial<Record<EstadoOrden, {
  estado:  EstadoOrden
  label:   string
}>> = {
  borrador:      { estado: 'confirmada',    label: 'Confirmar orden'      },
  confirmada:    { estado: 'en_produccion', label: 'Iniciar producción'   },
  en_produccion: { estado: 'entregada',     label: 'Marcar como entregada'},
}

const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(n)

const fmtFecha = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Modal de pago (anticipo / saldo) ───────────────────────────────────────

function PagoModal({
  titulo, descripcion, labelMonto, labelFecha,
  costoTotal, pagadoPrevio,
  onCancel, onConfirm,
}: {
  titulo:       string
  descripcion:  string
  labelMonto:   string
  labelFecha:   string
  costoTotal:   number
  pagadoPrevio: number
  onCancel:     () => void
  onConfirm:    (monto: number, fecha: string) => Promise<void>
}) {
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const montoNum    = parseFloat(monto) || 0
  const totalPagado = pagadoPrevio + montoNum
  const pendiente   = costoTotal > 0 ? costoTotal - totalPagado : 0
  const pct         = costoTotal > 0 ? Math.min(100, Math.round((totalPagado / costoTotal) * 100)) : 0

  async function handleOk() {
    setSaving(true)
    await onConfirm(montoNum, fecha)
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-5 min-w-[360px]">
      <div>
        <p className="text-[16px] font-bold text-primary">{titulo}</p>
        <p className="text-[12.5px] text-primary-muted mt-1">{descripcion}</p>
      </div>

      {/* Resumen de pagos */}
      {costoTotal > 0 && (
        <div className="bg-sidebar border border-border rounded-xl p-3 flex flex-col gap-2">
          <div className="flex justify-between text-[12.5px]">
            <span className="text-primary-muted">Total orden</span>
            <span className="font-semibold text-primary">{fmtCOP(costoTotal)}</span>
          </div>
          {pagadoPrevio > 0 && (
            <div className="flex justify-between text-[12.5px]">
              <span className="text-primary-muted">Ya pagado (anticipo)</span>
              <span className="font-semibold text-warning">{fmtCOP(pagadoPrevio)}</span>
            </div>
          )}
          {montoNum > 0 && (
            <div className="flex justify-between text-[12.5px]">
              <span className="text-primary-muted">{labelMonto}</span>
              <span className="font-semibold text-success">{fmtCOP(montoNum)}</span>
            </div>
          )}
          <div className="border-t border-border/40 pt-2 flex justify-between text-[12.5px]">
            <span className="text-primary-muted">Pendiente</span>
            <span className={cn('font-bold', pendiente > 0 ? 'text-danger' : 'text-success')}>
              {pendiente > 0 ? fmtCOP(pendiente) : '¡Cubierto!'}
            </span>
          </div>
          {/* Barra de progreso */}
          <div className="w-full h-2 bg-border/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: pct >= 100
                  ? '#4CAF82'
                  : 'linear-gradient(90deg, #F2CC8F, #E07A5F)'
              }}
            />
          </div>
          <p className="text-[11px] text-primary-muted text-right">{pct}% pagado</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <label className="input-label">{labelMonto} <span className="text-primary-muted/60 font-normal">(opcional)</span></label>
          <input
            type="number"
            min="0"
            step="1000"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            placeholder="0"
            className="input"
          />
        </div>
        <div>
          <label className="input-label">{labelFecha}</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="input"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-ghost text-[13px]" disabled={saving}>Cancelar</button>
        <button onClick={handleOk} className="btn-primary text-[13px]" disabled={saving}>
          {saving ? 'Guardando…' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}

// ── Panel de items ─────────────────────────────────────────────────────────

function ItemsOrdenPanel({
  ordenId,
  estadoOrden,
  onActivarProducto,
  onCostoActualizado,
}: {
  ordenId:             number
  estadoOrden:         EstadoOrden
  onActivarProducto:   (productoId: number, productoNombre: string) => void
  onCostoActualizado?: () => void
}) {
  const toast = useToast()
  const [items,          setItems]          = useState<OrdenItem[]>([])
  const [loading,        setLoading]        = useState(true)
  const [editingItemId,  setEditingItemId]  = useState<number | null>(null)
  const [editingCosto,   setEditingCosto]   = useState('')

  const canEditCosto = estadoOrden !== 'entregada' && estadoOrden !== 'cancelada'

  async function loadItems() {
    try {
      const itemsRaw = await window.electronAPI.db.query(
        `SELECT opi.id, opi.producto_id, p.nombre AS producto_nombre,
                opi.ficha_costo_id, opi.cantidad_total,
                opi.costo_unitario, opi.subtotal
         FROM ordenes_produccion_items opi
         JOIN productos p ON p.id = opi.producto_id
         WHERE opi.orden_id = ?
         ORDER BY opi.id`,
        [ordenId]
      )
      const raw = itemsRaw as unknown as Omit<OrdenItem, 'tallas'>[]
      const conTallas: OrdenItem[] = await Promise.all(
        raw.map(async (item) => {
          const tallas = await window.electronAPI.db.query(
            `SELECT t.nombre AS talla_nombre, opt.cantidad
             FROM ordenes_produccion_tallas opt
             JOIN tallas t ON t.id = opt.talla_id
             WHERE opt.item_id = ?
             ORDER BY t.orden`,
            [item.id]
          )
          return { ...item, tallas: tallas as unknown as OrdenItem['tallas'] }
        })
      )
      setItems(conTallas)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadItems() }, [ordenId])

  async function handleSaveCosto(item: OrdenItem) {
    const costo    = parseFloat(editingCosto) || 0
    const subtotal = costo * item.cantidad_total
    try {
      await window.electronAPI.db.run(
        `UPDATE ordenes_produccion_items SET costo_unitario=?, subtotal=? WHERE id=?`,
        [costo, subtotal, item.id]
      )
      await window.electronAPI.db.run(
        `UPDATE ordenes_produccion
         SET costo_total=(SELECT COALESCE(SUM(subtotal),0) FROM ordenes_produccion_items WHERE orden_id=?),
             updated_at=datetime('now')
         WHERE id=?`,
        [ordenId, ordenId]
      )
      setEditingItemId(null)
      await loadItems()
      onCostoActualizado?.()
      toast.success('Precio actualizado')
    } catch {
      toast.error('Error al guardar precio')
    }
  }

  if (loading) return <p className="text-[12px] text-primary-muted py-2">Cargando…</p>

  return (
    <div className="mt-3 flex flex-col gap-3 pl-3 border-l-2 border-border">
      {items.map(item => (
        <div key={item.id}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] font-semibold text-primary shrink-0">{item.producto_nombre}</p>
            <div className="flex items-center gap-3 flex-wrap">
              {estadoOrden === 'entregada' && (
                <button
                  onClick={() => onActivarProducto(item.producto_id, item.producto_nombre)}
                  className="flex items-center gap-1 text-[11.5px] font-semibold
                             text-success border border-success/40 rounded-lg px-2 py-0.5
                             hover:bg-success/10 transition-colors"
                >
                  <CheckCheck size={12} /> Activar producto
                </button>
              )}

              {/* Precio confección editable */}
              {editingItemId === item.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={editingCosto}
                    onChange={e => setEditingCosto(e.target.value)}
                    className="w-36 text-right text-[12.5px] font-semibold bg-sidebar
                               border border-accent/60 rounded-lg px-2 py-1
                               focus:outline-none text-primary"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveCosto(item)
                      if (e.key === 'Escape') setEditingItemId(null)
                    }}
                  />
                  <button
                    onClick={() => handleSaveCosto(item)}
                    className="w-6 h-6 rounded-lg bg-success/20 text-success flex items-center justify-center hover:bg-success/30"
                  ><Check size={12} /></button>
                  <button
                    onClick={() => setEditingItemId(null)}
                    className="w-6 h-6 rounded-lg bg-border/60 text-primary-muted flex items-center justify-center hover:bg-border"
                  ><X size={12} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-primary-muted">
                    {item.cantidad_total} ud.
                    {item.costo_unitario > 0 && ` × ${fmtCOP(item.costo_unitario)}`}
                  </span>
                  {item.subtotal > 0 && (
                    <span className="text-[13px] font-semibold text-warning">{fmtCOP(item.subtotal)}</span>
                  )}
                  {canEditCosto && (
                    <button
                      onClick={() => {
                        setEditingItemId(item.id)
                        setEditingCosto(item.costo_unitario > 0 ? item.costo_unitario.toString() : '')
                      }}
                      className="w-5 h-5 rounded text-primary-muted hover:text-accent transition-colors flex items-center justify-center"
                      title="Editar precio confección"
                    ><Pencil size={11} /></button>
                  )}
                </div>
              )}
            </div>
          </div>
          {item.tallas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1.5">
              {item.tallas.filter(t => t.cantidad > 0).map(t => (
                <span key={t.talla_nombre}
                  className="text-[11.5px] bg-sidebar border border-border
                             rounded-lg px-2 py-0.5 text-primary-muted">
                  {t.talla_nombre}: {t.cantidad}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Fila de orden ──────────────────────────────────────────────────────────

function OrdenFila({
  orden,
  onAvanzar,
  onCancelar,
  onEliminar,
  onActivarProducto,
  onCostoActualizado,
}: {
  orden:               Orden
  onAvanzar:           (o: Orden) => void
  onCancelar:          (o: Orden) => void
  onEliminar:          (o: Orden) => void
  onActivarProducto:   (productoId: number, nombre: string) => void
  onCostoActualizado:  () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg     = ESTADO_CONFIG[orden.estado]
  const EstIcon = cfg.icon
  const sig     = SIGUIENTE[orden.estado]
  const puedeCancelar = ['borrador','confirmada','en_produccion'].includes(orden.estado)
  const puedeEliminar = orden.estado === 'borrador'

  const pagado  = orden.anticipo + orden.saldo
  const pct     = orden.costo_total > 0 ? Math.min(100, Math.round((pagado / orden.costo_total) * 100)) : 0

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-card">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-primary-muted hover:text-primary transition-colors shrink-0"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className={cn('flex items-center gap-1.5 shrink-0 w-36', cfg.color)}>
          <EstIcon size={14} />
          <span className="text-[12px] font-semibold">{cfg.label}</span>
        </div>
        <span className="text-[13px] font-mono font-bold text-primary w-32 shrink-0">
          {orden.numero}
        </span>
        <span className="text-[13px] text-primary-muted flex-1 truncate">
          {orden.fabricante ?? orden.proveedor_nombre ?? '—'}
        </span>
        <span className="text-[12px] text-primary-muted w-24 shrink-0 text-center">
          {fmtFecha(orden.fecha_orden)}
        </span>
        <span className="text-[12px] text-primary-muted w-16 shrink-0 text-right">
          {orden.unidades_total} ud.
        </span>
        <span className="text-[13px] font-semibold text-warning w-32 shrink-0 text-right">
          {orden.costo_total > 0 ? fmtCOP(orden.costo_total) : '—'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {sig && (
            <button onClick={() => onAvanzar(orden)} className="btn-primary text-[12px] py-1.5 px-3">
              {sig.label}
            </button>
          )}
          {puedeCancelar && (
            <button
              onClick={() => onCancelar(orden)}
              className="btn-ghost text-[12px] py-1.5 px-2 text-danger hover:border-danger/30"
              title="Cancelar orden"
            >
              <XCircle size={13} />
            </button>
          )}
          {puedeEliminar && (
            <button
              onClick={() => onEliminar(orden)}
              className="btn-ghost text-[12px] py-1.5 px-2 text-danger hover:border-danger/30"
              title="Eliminar orden"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {(orden.notas || orden.fecha_entrega || orden.anticipo > 0 || orden.saldo > 0 || orden.costo_total > 0) && (
        <div className="px-4 py-2 text-[12px] text-primary-muted bg-card
                        border-t border-border/30 flex flex-col gap-2">
          <div className="flex gap-4 flex-wrap items-center">
            {orden.fecha_entrega && (
              <span className="flex items-center gap-1">
                <Truck size={11} /> Entrega: {fmtFecha(orden.fecha_entrega)}
              </span>
            )}
            {orden.costo_total > 0 && (
              <span className="flex items-center gap-1 font-semibold text-primary-muted">
                Total: {fmtCOP(orden.costo_total)}
              </span>
            )}
            {orden.anticipo > 0 && (
              <span className="flex items-center gap-1 text-warning">
                Anticipo: {fmtCOP(orden.anticipo)}{orden.fecha_anticipo ? ` (${fmtFecha(orden.fecha_anticipo)})` : ''}
              </span>
            )}
            {orden.saldo > 0 && (
              <span className="flex items-center gap-1 text-success">
                Saldo: {fmtCOP(orden.saldo)}{orden.fecha_saldo ? ` (${fmtFecha(orden.fecha_saldo)})` : ''}
              </span>
            )}
            {(orden.anticipo > 0 || orden.saldo > 0) && (
              <span className="flex items-center gap-1 font-semibold text-accent">
                Pagado: {fmtCOP(pagado)}
              </span>
            )}
            {orden.notas && <span>{orden.notas}</span>}
          </div>
          {/* Barra de progreso de pagos */}
          {orden.costo_total > 0 && (orden.anticipo > 0 || orden.saldo > 0) && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 100
                      ? 'var(--color-success)'
                      : 'linear-gradient(90deg, #F2CC8F, #E07A5F)'
                  }}
                />
              </div>
              <span className="text-[11px] text-primary-muted shrink-0">{pct}% pagado</span>
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/30 bg-card/50">
          <ItemsOrdenPanel
            ordenId={orden.id}
            estadoOrden={orden.estado}
            onActivarProducto={onActivarProducto}
            onCostoActualizado={onCostoActualizado}
          />
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

const ESTADOS_FILTRO = [
  { value: '',              label: 'Todos'         },
  { value: 'borrador',      label: 'Borrador'      },
  { value: 'confirmada',    label: 'Confirmadas'   },
  { value: 'en_produccion', label: 'En producción' },
  { value: 'entregada',     label: 'Entregadas'    },
  { value: 'cancelada',     label: 'Canceladas'    },
]

export default function Produccion() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [ordenes,       setOrdenes]       = useState<Orden[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filtroEstado,  setFiltroEstado]  = useState('')
  const [busqueda,      setBusqueda]      = useState('')
  const [showForm,      setShowForm]      = useState(false)

  const loadOrdenes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.electronAPI.db.query(
        `SELECT op.*,
                prov.nombre                          AS proveedor_nombre,
                COUNT(DISTINCT opi.id)               AS items_count,
                COALESCE(SUM(opi.cantidad_total), 0) AS unidades_total
         FROM ordenes_produccion op
         LEFT JOIN proveedores prov              ON prov.id = op.proveedor_id
         LEFT JOIN ordenes_produccion_items opi  ON opi.orden_id = op.id
         GROUP BY op.id
         ORDER BY op.created_at DESC`,
        []
      )
      setOrdenes(data as unknown as Orden[])
    } catch {
      toast.error('Error al cargar órdenes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOrdenes() }, [loadOrdenes])

  // ── Transiciones de estado ────────────────────────────────────────────────

  async function descontarInsumos(ordenId: number) {
    const items = await window.electronAPI.db.query(
      `SELECT opi.ficha_costo_id, opi.cantidad_total
       FROM ordenes_produccion_items opi
       WHERE opi.orden_id=? AND opi.ficha_costo_id IS NOT NULL`,
      [ordenId]
    ) as unknown as { ficha_costo_id: number; cantidad_total: number }[]

    for (const item of items) {
      const insumos = await window.electronAPI.db.query(
        `SELECT insumo_id, cantidad FROM fichas_costo_insumos
         WHERE ficha_id=? AND insumo_id IS NOT NULL`,
        [item.ficha_costo_id]
      ) as unknown as { insumo_id: number; cantidad: number }[]

      for (const fi of insumos) {
        await window.electronAPI.db.run(
          `INSERT INTO movimientos_insumos (insumo_id, tipo, cantidad, fecha)
           VALUES (?, 'salida_produccion', ?, date('now'))`,
          [fi.insumo_id, fi.cantidad * item.cantidad_total]
        )
      }
    }
  }

  async function ingresarStockProductos(ordenId: number) {
    const rows = await window.electronAPI.db.query(
      `SELECT opi.producto_id, opi.costo_unitario, opt.talla_id, opt.cantidad
       FROM ordenes_produccion_items opi
       JOIN ordenes_produccion_tallas opt ON opt.item_id = opi.id
       WHERE opi.orden_id=? AND opt.cantidad > 0`,
      [ordenId]
    ) as unknown as {
      producto_id: number; costo_unitario: number
      talla_id: number; cantidad: number
    }[]

    for (const row of rows) {
      await window.electronAPI.db.run(
        `INSERT INTO inventario_productos (producto_id, talla_id, stock, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(producto_id, talla_id)
         DO UPDATE SET stock=stock+excluded.stock, updated_at=datetime('now')`,
        [row.producto_id, row.talla_id, row.cantidad]
      )
      // Registrar movimiento en historial
      await window.electronAPI.db.run(
        `INSERT INTO movimientos_inventario
           (producto_id, talla_id, tipo, cantidad, orden_id, notas, fecha, created_at)
         VALUES (?, ?, 'entrada_produccion', ?, ?, 'Ingreso desde orden de producción', date('now'), datetime('now'))`,
        [row.producto_id, row.talla_id, row.cantidad, ordenId]
      )
      if (row.costo_unitario > 0) {
        await window.electronAPI.db.run(
          `UPDATE productos SET costo_unitario=?, updated_at=datetime('now')
           WHERE id=? AND (costo_unitario IS NULL OR costo_unitario=0)`,
          [row.costo_unitario, row.producto_id]
        )
      }
    }
  }

  function handleAvanzar(orden: Orden) {
    const sig = SIGUIENTE[orden.estado]
    if (!sig) return

    // Al confirmar: simple confirm dialog
    if (sig.estado === 'confirmada') {
      openModal(
        <ConfirmDialog
          title={sig.label}
          description={`¿Confirmar la orden ${orden.numero}?`}
          confirmLabel={sig.label}
          variant="info"
          onCancel={closeModal}
          onConfirm={async () => {
            closeModal()
            try {
              await window.electronAPI.db.run(
                `UPDATE ordenes_produccion SET estado='confirmada', updated_at=datetime('now') WHERE id=?`,
                [orden.id]
              )
              toast.success(`Orden ${orden.numero} confirmada`)
              loadOrdenes()
            } catch { toast.error('Error al actualizar el estado') }
          }}
        />
      )
      return
    }

    // Al iniciar producción: pedir anticipo
    if (sig.estado === 'en_produccion') {
      openModal(<PagoModal
        titulo="Iniciar producción"
        descripcion={`Podés registrar el anticipo pagado al proveedor. Es opcional — podés dejarlo en 0.`}
        labelMonto="Anticipo"
        labelFecha="Fecha de pago"        costoTotal={orden.costo_total}
        pagadoPrevio={0}        onCancel={closeModal}
        onConfirm={async (monto, fecha) => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `UPDATE ordenes_produccion
               SET estado='en_produccion', anticipo=?, fecha_anticipo=?, updated_at=datetime('now')
               WHERE id=?`,
              [monto, fecha || null, orden.id]
            )
            await descontarInsumos(orden.id)
            toast.success(`Orden ${orden.numero} → En producción${monto > 0 ? ` · Anticipo ${fmtCOP(monto)}` : ''}`)
            loadOrdenes()
          } catch (err) { console.error(err); toast.error('Error al actualizar el estado') }
        }}
      />)
      return
    }

    // Al marcar entregada: pedir saldo
    if (sig.estado === 'entregada') {
      openModal(<PagoModal
        titulo="Marcar como entregada"
        descripcion="Registrá el saldo pendiente pagado al entregar. El stock de productos será ingresado automáticamente."
        labelMonto="Saldo"
        labelFecha="Fecha de entrega / pago"
        costoTotal={orden.costo_total}
        pagadoPrevio={orden.anticipo}
        onCancel={closeModal}
        onConfirm={async (monto, fecha) => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `UPDATE ordenes_produccion
               SET estado='entregada', saldo=?, fecha_saldo=?, updated_at=datetime('now')
               WHERE id=?`,
              [monto, fecha || null, orden.id]
            )
            await ingresarStockProductos(orden.id)
            toast.success(`Orden ${orden.numero} entregada${monto > 0 ? ` · Saldo ${fmtCOP(monto)}` : ''}`)
            loadOrdenes()
          } catch (err) { console.error(err); toast.error('Error al actualizar el estado') }
        }}
      />)
      return
    }
  }

  function handleActivarProducto(productoId: number, nombre: string) {
    openModal(
      <ConfirmDialog
        title={`Activar "${nombre}"`}
        description="El producto pasará a estado Activo y estará disponible para ventas."
        confirmLabel="Activar"
        variant="info"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `UPDATE productos SET estado='activo', activo=1, updated_at=datetime('now') WHERE id=?`,
              [productoId]
            )
            toast.success(`"${nombre}" activado`)
          } catch { toast.error('Error al activar el producto') }
        }}
      />
    )
  }

  function handleEliminar(orden: Orden) {
    openModal(
      <ConfirmDialog
        title={`Eliminar orden ${orden.numero}`}
        description="La orden está en borrador y será eliminada permanentemente junto con sus ítems. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM ordenes_produccion WHERE id=?`, [orden.id]
            )
            toast.success(`Orden ${orden.numero} eliminada`)
            loadOrdenes()
          } catch { toast.error('Error al eliminar la orden') }
        }}
      />
    )
  }

  function handleCancelar(orden: Orden) {
    openModal(
      <ConfirmDialog
        title={`Cancelar orden ${orden.numero}`}
        description={
          orden.estado === 'en_produccion'
            ? 'La orden está en producción. Los movimientos de insumos registrados NO se revierten.'
            : `¿Cancelar la orden ${orden.numero}? Esta acción no se puede deshacer.`
        }
        confirmLabel="Cancelar orden"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `UPDATE ordenes_produccion
               SET estado='cancelada', updated_at=datetime('now') WHERE id=?`,
              [orden.id]
            )
            toast.success(`Orden ${orden.numero} cancelada`)
            loadOrdenes()
          } catch {
            toast.error('Error al cancelar')
          }
        }}
      />
    )
  }

  // ── Filtrado ──────────────────────────────────────────────────────────────

  const ordenesFiltradas = ordenes.filter(o => {
    if (filtroEstado && o.estado !== filtroEstado) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (
        o.numero.toLowerCase().includes(q) ||
        (o.fabricante ?? '').toLowerCase().includes(q) ||
        (o.proveedor_nombre ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const activas    = ordenes.filter(o => !['entregada','cancelada'].includes(o.estado)).length
  const entregadas = ordenes.filter(o => o.estado === 'entregada').length
  const costoActivo = ordenes
    .filter(o => !['entregada','cancelada'].includes(o.estado))
    .reduce((s, o) => s + o.costo_total, 0)

  function handleExportarOrdenes() {
    if (ordenesFiltradas.length === 0) {
      toast.warning('No hay órdenes para exportar')
      return
    }
    const data = ordenesFiltradas.map(o => ({
      'N° Orden':   o.numero,
      Proveedor:    o.proveedor_nombre ?? o.fabricante ?? '—',
      Estado:       ESTADO_CONFIG[o.estado].label,
      Fecha:        o.fecha_orden,
      'Entrega':    o.fecha_entrega ?? '—',
      Items:        o.items_count,
      Unidades:     o.unidades_total,
      'Costo total': o.costo_total,
    }))
    const csv  = objectsToCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `produccion_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Órdenes exportadas')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center
                        justify-center text-accent shrink-0">
          <Factory size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-[17px] font-bold text-primary">Órdenes de Producción</h2>
          <p className="text-[12.5px] text-primary-muted">
            Gestión de talleres y seguimiento de estados
          </p>
        </div>
        <button onClick={() => loadOrdenes()} className="btn-ghost text-[13px]" title="Recargar">
          <RefreshCw size={14} />
        </button>
        <button
          onClick={handleExportarOrdenes}
          disabled={ordenes.length === 0}
          className="btn-ghost text-[13px]"
          title="Exportar CSV"
        >
          <Download size={14} />
          CSV
        </button>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-[13px]">
            <Plus size={15} /> Nueva orden
          </button>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <OrdenForm
          onSuccess={() => { setShowForm(false); loadOrdenes() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* KPIs */}
      {!loading && ordenes.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-sidebar border border-border rounded-xl px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-muted mb-2">Órdenes activas</p>
            <p className="text-[24px] font-bold text-accent">{activas}</p>
          </div>
          <div className="bg-sidebar border border-border rounded-xl px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-muted mb-2">Entregadas</p>
            <p className="text-[24px] font-bold text-success">{entregadas}</p>
          </div>
          <div className="bg-sidebar border border-border rounded-xl px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-muted mb-2">Costo en curso</p>
            <p className="text-[24px] font-bold text-warning">{fmtCOP(costoActivo)}</p>
          </div>
        </div>
      )}

      {/* Separador */}
      {!loading && ordenes.length > 0 && (
        <div className="border-t border-border/40" />
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-muted" />
          <input
            type="text"
            placeholder="Buscar por número o proveedor…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input pl-8 h-9 text-[13px]"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {ESTADOS_FILTRO.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltroEstado(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-[12.5px] font-semibold border transition-colors',
                filtroEstado === f.value
                  ? 'bg-accent text-white border-accent'
                  : 'border-border text-primary-muted hover:text-primary hover:border-accent/30'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-[13px] text-primary-muted">Cargando…</p>
      ) : ordenesFiltradas.length === 0 ? (
        <div className="card text-center py-12">
          <Factory size={40} className="mx-auto text-primary-muted/30 mb-3" />
          <p className="text-[14px] text-primary-muted">
            {busqueda || filtroEstado
              ? 'No se encontraron órdenes con ese filtro.'
              : 'Todavía no hay órdenes de producción.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-4 text-[11px] font-bold
                          uppercase tracking-wider text-primary-muted">
            <span className="w-4 shrink-0" />
            <span className="w-36 shrink-0">Estado</span>
            <span className="w-32 shrink-0">N° Orden</span>
            <span className="flex-1">Fabricante</span>
            <span className="w-24 text-center shrink-0">Fecha</span>
            <span className="w-16 text-right shrink-0">Unid.</span>
            <span className="w-32 text-right shrink-0">Costo</span>
            <span className="w-44 shrink-0" />
          </div>
          {ordenesFiltradas.map(orden => (
            <OrdenFila
              key={orden.id}
              orden={orden}
              onAvanzar={handleAvanzar}
              onCancelar={handleCancelar}
              onEliminar={handleEliminar}
              onActivarProducto={handleActivarProducto}
              onCostoActualizado={loadOrdenes}
            />
          ))}
        </div>
      )}
    </div>
  )
}