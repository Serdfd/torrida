import { useEffect, useState } from 'react'
import {
  ShoppingBag, Calendar, User, CreditCard,
  Store, Truck, Tag, FileText, RotateCcw
} from 'lucide-react'
import { Venta, VentaItem } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import { useToast, useModal } from '@/store/useAppStore'
import { getVentaById } from '@/lib/queries'
import { cn } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface VentaDetalleProps {
  venta:    Venta
  onClose:  () => void
  onUpdate: () => void
}

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'badge-warning',
  enviado:   'badge-accent',
  entregado: 'badge-success',
  cancelado: 'badge-danger'
}

export default function VentaDetalle({
  venta: ventaBase,
  onClose,
  onUpdate
}: VentaDetalleProps) {
  const toast              = useToast()
  const { openModal, closeModal } = useModal()

  const [venta,   setVenta]   = useState<Venta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await getVentaById(ventaBase.id) as Venta
        setVenta(data)
      } catch {
        toast.error('Error al cargar detalle')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [ventaBase.id])

  async function handleCancelar() {
    openModal(
      <ConfirmDialog
        title="¿Cancelar esta venta?"
        description={`Se revertirá el stock de los productos de la venta ${ventaBase.numero}.`}
        confirmLabel="Sí, cancelar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            // Revertir stock
            if (venta?.items) {
              for (const item of venta.items) {
                await window.electronAPI.db.run(
                  `UPDATE inventario_productos
                   SET stock = stock + ?, updated_at = datetime('now')
                   WHERE producto_id = ? AND talla_id = ?`,
                  [item.cantidad, item.producto_id, item.talla_id]
                )
              }
            }
            // Cancelar venta
            await window.electronAPI.db.run(
              `UPDATE ventas SET estado = 'cancelado',
               updated_at = datetime('now') WHERE id = ?`,
              [ventaBase.id]
            )
            toast.success('Venta cancelada y stock revertido')
            onUpdate()
            onClose()
          } catch (err) {
            console.error(err)
            toast.error('Error al cancelar la venta')
          }
        }}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!venta) {
    return (
      <p className="text-center text-primary-muted py-8">
        No se encontró la venta.
      </p>
    )
  }

  const items = (venta.items ?? []) as VentaItem[]

  return (
    <div className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center
                          justify-center text-accent">
            <ShoppingBag size={18} />
          </div>
          <div>
            <p className="text-[17px] font-bold text-primary font-mono">
              {venta.numero}
            </p>
            <p className="text-[12.5px] text-primary-muted">
              Registrada el {formatDate(venta.created_at ?? venta.fecha)}
            </p>
          </div>
        </div>
        <span className={cn('badge text-[12px]', ESTADO_BADGE[venta.estado] ?? 'badge-muted')}>
          {venta.estado}
        </span>
      </div>

      {/* Info general */}
      <div className="grid grid-cols-2 gap-3">
        <InfoRow icon={Calendar} label="Fecha" value={formatDate(venta.fecha)} />
        <InfoRow icon={Store}    label="Canal"  value={venta.canal_nombre ?? '—'} />
        <InfoRow
          icon={User}
          label="Cliente"
          value={venta.cliente_nombre || 'Sin nombre'}
          sub={venta.cliente_contacto}
        />
        <InfoRow
          icon={CreditCard}
          label="Medio de pago"
          value={venta.medio_pago_nombre ?? '—'}
        />
        {venta.costo_envio_cobrado > 0 && (
          <InfoRow
            icon={Truck}
            label="Envío cobrado"
            value={formatCOP(venta.costo_envio_cobrado)}
            sub={venta.costo_envio_real
              ? `Costo real: ${formatCOP(venta.costo_envio_real)}`
              : undefined}
          />
        )}
        {venta.notas && (
          <InfoRow
            icon={FileText}
            label="Notas"
            value={venta.notas}
            className="col-span-2"
          />
        )}
      </div>

      {/* Ítems */}
      <div>
        <p className="input-label mb-2">Productos</p>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Talla</th>
                <th className="text-right">Cant.</th>
                <th className="text-right">Precio</th>
                <th className="text-right">Desc.</th>
                <th className="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="font-medium text-[13.5px]">
                    {item.producto_nombre}
                  </td>
                  <td>
                    <span className="badge badge-muted">{item.talla_nombre}</span>
                  </td>
                  <td className="text-right text-[13px]">{item.cantidad}</td>
                  <td className="text-right text-[13px]">
                    {formatCOP(item.precio_unit)}
                  </td>
                  <td className="text-right text-[13px] text-danger">
                    {item.descuento_item > 0 ? `-${formatCOP(item.descuento_item)}` : '—'}
                  </td>
                  <td className="text-right font-semibold text-[13.5px]">
                    {formatCOP(item.subtotal_item)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="bg-[#0B0B16] border border-border rounded-xl p-4
                      flex flex-col gap-1.5">
        <FinRow label="Subtotal"      value={formatCOP(venta.subtotal)} />
        {venta.descuento > 0 && (
          <FinRow
            label="Descuento"
            value={`-${formatCOP(venta.descuento)}`}
            className="text-danger"
          />
        )}
        {venta.costo_envio_cobrado > 0 && (
          <FinRow label="Envío" value={formatCOP(venta.costo_envio_cobrado)} />
        )}
        {venta.comision_canal > 0 && (
          <FinRow
            label="Comisión canal"
            value={`-${formatCOP(venta.comision_canal)}`}
            className="text-warning"
          />
        )}
        <div className="border-t border-border mt-1 pt-2 flex justify-between">
          <span className="text-[14px] font-bold text-primary">Total</span>
          <span className="text-[18px] font-bold text-accent">
            {formatCOP(venta.total)}
          </span>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        {venta.estado !== 'cancelado' && (
          <button
            onClick={handleCancelar}
            className="btn-danger text-[13px]"
          >
            <RotateCcw size={13} />
            Cancelar venta
          </button>
        )}
        <div className="ml-auto">
          <button onClick={onClose} className="btn-ghost text-[13px]">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────

interface InfoRowProps {
  icon:      React.ElementType
  label:     string
  value:     string
  sub?:      string
  className?: string
}

function InfoRow({ icon: Icon, label, value, sub, className }: InfoRowProps) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-3 bg-[#0B0B16] rounded-xl border border-border',
      className
    )}>
      <div className="w-7 h-7 rounded-lg bg-accent-light flex items-center
                      justify-center text-accent shrink-0 mt-0.5">
        <Icon size={13} />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide
                      text-primary-muted mb-0.5">
          {label}
        </p>
        <p className="text-[13.5px] font-medium text-primary">
          {value}
        </p>
        {sub && (
          <p className="text-[12px] text-primary-muted mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  )
}

interface FinRowProps {
  label:     string
  value:     string
  className?: string
}

function FinRow({ label, value, className }: FinRowProps) {
  return (
    <div className={cn(
      'flex justify-between text-[13px] text-primary-muted',
      className
    )}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}