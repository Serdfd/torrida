import { useEffect, useState } from 'react'
import {
  ShoppingBag, Calendar, User, CreditCard,
  Store, Truck, FileText, RotateCcw, Package
} from 'lucide-react'
import { formatCOP, formatDate, formatDateTime } from '@/lib/utils'
import { useToast, useModal } from '@/store/useAppStore'
import { getVentaById } from '@/lib/queries'
import { cn } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface VentaDetalleProps {
  venta:    any
  onClose:  () => void
  onUpdate: () => void
}

const ESTADO_BADGE: Record<string, string> = {
  completada: 'bg-success/10 border-success/20 text-success',
  pendiente:  'bg-warning/10 border-warning/20 text-warning',
  cancelado:  'bg-danger/10  border-danger/20  text-danger'
}

const TIPO_ENVIO_LABEL: Record<string, string> = {
  standard: 'Estándar',
  express:  'Express'
}

export default function VentaDetalle({
  venta: ventaBase,
  onClose,
  onUpdate
}: VentaDetalleProps) {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [venta,   setVenta]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await getVentaById(ventaBase.id)
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
        description={`Se cancelará ${ventaBase.numero_venta}. El stock se revertirá automáticamente.`}
        confirmLabel="Sí, cancelar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            // Registrar devolución en movimientos_inventario (trigger revierte el stock)
            if (venta?.items) {
              for (const item of venta.items) {
                if (item.talla_id) {
                  await window.electronAPI.db.run(
                    `INSERT INTO movimientos_inventario
                       (producto_id, talla_id, tipo, cantidad, venta_id, notas, fecha, created_at)
                     VALUES (?, ?, 'devolucion', ?, ?, ?, date('now'), datetime('now'))`,
                    [item.producto_id, item.talla_id, item.cantidad,
                     ventaBase.id, `Cancelación ${ventaBase.numero_venta}`]
                  )
                }
              }
            }
            // Trigger SQL revierte el stock automáticamente al cambiar estado
            await window.electronAPI.db.run(
              `UPDATE ventas SET estado = 'cancelado', updated_at = datetime('now') WHERE id = ?`,
              [ventaBase.id]
            )
            toast.success('Venta cancelada')
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

  const items = venta.items ?? []
  const utilidadTotal = items.reduce((s: number, it: any) =>
    s + (it.utilidad_item ?? 0), 0)

  return (
    <div className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1">

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center
                        justify-center text-accent shrink-0">
          <ShoppingBag size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-lg font-bold text-primary font-mono">
              {venta.numero_venta}
            </p>
            <span className={cn(
              'inline-flex px-2.5 py-0.5 rounded-full text-sm font-semibold border',
              ESTADO_BADGE[venta.estado] ?? 'bg-card border-border text-primary-muted'
            )}>
              {venta.estado}
            </span>
          </div>
          <p className="text-sm text-primary-muted">
            Registrada el {venta.created_at ? formatDateTime(venta.created_at) : formatDate(venta.fecha)}
          </p>
        </div>
      </div>

      {/* Info general */}
      <div className="grid grid-cols-2 gap-3">
        <InfoRow icon={Calendar} label="Fecha"        value={formatDate(venta.fecha)} />
        <InfoRow icon={Store}    label="Canal"         value={venta.canal_nombre ?? '—'} />
        <InfoRow
          icon={User}
          label="Cliente"
          value={venta.cliente_nombre || 'Sin nombre'}
          sub={venta.cliente_telefono}
        />
        <InfoRow
          icon={CreditCard}
          label="Medio de pago"
          value={venta.medio_pago_nombre ?? '—'}
        />
        {(venta.costo_envio > 0 || venta.tipo_envio) && (
          <InfoRow
            icon={Truck}
            label={`Envío ${TIPO_ENVIO_LABEL[venta.tipo_envio] ?? ''}`}
            value={venta.costo_envio > 0 ? formatCOP(venta.costo_envio) : 'Marca asume'}
            sub={[
              venta.costo_envio_real > 0 ? `Costo real: ${formatCOP(venta.costo_envio_real)}` : null,
              [venta.envio_departamento, venta.envio_ciudad].filter(Boolean).join(', ') || null,
              venta.envio_direccion || null,
              venta.transportadora_nombre ? `Transportadora: ${venta.transportadora_nombre}` : null,
              venta.guia_numero ? `Guía: ${venta.guia_numero}` : null,
            ].filter(Boolean).join(' · ') || undefined}
            badge={venta.envio_pendiente
              ? { label: 'Pendiente de envío', color: 'warning' }
              : { label: 'Enviado', color: 'success' }}
            className="col-span-2"
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
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="table w-full min-w-[560px]">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Talla</th>
                <th className="text-right">Cant.</th>
                <th className="text-right">P. Unit.</th>
                <th className="text-right">Comisión</th>
                <th className="text-right">Utilidad</th>
                <th className="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="font-medium text-base">
                    {item.producto_nombre}
                  </td>
                  <td>
                    <span className="badge badge-muted">{item.talla_nombre ?? '—'}</span>
                  </td>
                  <td className="text-right text-base">{item.cantidad}</td>
                  <td className="text-right text-base">
                    {formatCOP(item.precio_unitario)}
                  </td>
                  <td className="text-right text-base text-warning">
                    {(() => {
                      const comTotal = (item.subtotal_item ?? 0)
                        - (item.costo_unitario_snap ?? 0) * (item.cantidad ?? 1)
                        - (item.utilidad_item ?? 0)
                      return comTotal > 0.01
                        ? `-${formatCOP(comTotal)}`
                        : '—'
                    })()}
                  </td>
                  <td className={cn(
                    'text-right text-base font-semibold',
                    (item.utilidad_item ?? 0) >= 0 ? 'text-success' : 'text-danger'
                  )}>
                    {formatCOP(item.utilidad_item ?? 0)}
                  </td>
                  <td className="text-right font-semibold text-base">
                    {formatCOP(item.subtotal_item)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="bg-[#0B0B16] border border-border rounded-xl p-4 flex flex-col gap-1.5">
        <FinRow label="Subtotal productos" value={formatCOP(venta.subtotal)} />
        {venta.descuento > 0 && (
          <FinRow
            label="Descuento global"
            value={`-${formatCOP(venta.descuento)}`}
            className="text-danger"
          />
        )}
        {venta.costo_envio > 0 && (
          <FinRow label="Envío cobrado" value={formatCOP(venta.costo_envio)} />
        )}
        {venta.comision_canal > 0 && (
          <FinRow
            label="Comisión canal"
            value={`-${formatCOP(venta.comision_canal)}`}
            className="text-warning"
          />
        )}
        {(venta.comision_medio_pago ?? 0) > 0 && (
          <FinRow
            label={`Comisión pasarela${venta.medio_pago_tarifa_concepto ? ` (${venta.medio_pago_tarifa_concepto})` : ''}`}
            value={`-${formatCOP(venta.comision_medio_pago)}`}
            className="text-warning"
          />
        )}
        <div className="border-t border-border mt-1 pt-2 flex justify-between">
          <span className="text-md font-bold text-primary">Total</span>
          <span className="text-xl font-bold text-accent">
            {formatCOP(venta.total)}
          </span>
        </div>
        {utilidadTotal !== 0 && (
          <div className={cn(
            'flex justify-between text-base font-semibold mt-0.5',
            utilidadTotal >= 0 ? 'text-success' : 'text-danger'
          )}>
            <span>Utilidad estimada</span>
            <span>{formatCOP(utilidadTotal)}</span>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between pt-4 mt-1 border-t border-border">
        {venta.estado !== 'cancelado' && (
          <button onClick={handleCancelar} className="btn-danger">
            <RotateCcw size={13} />
            Cancelar venta
          </button>
        )}
        <div className="ml-auto">
          <button onClick={onClose} className="btn-ghost">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value, sub, badge, className }: {
  icon:       React.ElementType
  label:      string
  value:      string
  sub?:       string
  badge?:     { label: string; color: 'success' | 'warning' | 'danger' }
  className?: string
}) {
  const badgeColors = {
    success: 'bg-success/10 border-success/20 text-success',
    warning: 'bg-warning/10 border-warning/20 text-warning',
    danger:  'bg-danger/10  border-danger/20  text-danger',
  }
  return (
    <div className={cn(
      'flex items-start gap-3 p-3 bg-[#0B0B16] rounded-xl border border-border',
      className
    )}>
      <div className="w-7 h-7 rounded-lg bg-accent-light flex items-center
                      justify-center text-accent shrink-0 mt-0.5">
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide
                      text-primary-muted mb-0.5">
          {label}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-base font-medium text-primary">{value}</p>
          {badge && (
            <span className={cn(
              'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border',
              badgeColors[badge.color]
            )}>
              {badge.label}
            </span>
          )}
        </div>
        {sub && <p className="text-sm text-primary-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function FinRow({ label, value, className }: {
  label: string; value: string; className?: string
}) {
  return (
    <div className={cn('flex justify-between text-base text-primary-muted', className)}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

