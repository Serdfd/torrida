import { useState } from 'react'
import { MoreHorizontal, Eye, CheckCircle, XCircle, Truck } from 'lucide-react'
import { Venta } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import { useToast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

interface VentaFilaProps {
  venta: Venta
  onClick: () => void
  onUpdate: () => void
}

const ESTADO_BADGE: Record<string, string> = {
  pendiente:  'badge-warning',
  enviado:    'badge-accent',
  entregado:  'badge-success',
  cancelado:  'badge-danger',
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente:  'Pendiente',
  enviado:    'Enviado',
  entregado:  'Entregado',
  cancelado:  'Cancelado',
}

export default function VentaFila({ venta, onClick, onUpdate }: VentaFilaProps) {
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  async function cambiarEstado(nuevoEstado: string) {
    setMenuOpen(false)
    setUpdating(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE ventas SET estado = ?, updated_at = datetime('now') WHERE id = ?`,
        [nuevoEstado, venta.id]
      )
      toast.success(`Venta actualizada a "${ESTADO_LABEL[nuevoEstado]}"`)
      onUpdate()
    } catch (err) {
      console.error(err)
      toast.error('Error al actualizar estado')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <tr className={cn(updating && 'opacity-50 pointer-events-none')}>
      {/* Número */}
      <td>
        <span className="font-mono text-[13px] font-semibold text-accent-DEFAULT">
          {venta.numero}
        </span>
      </td>

      {/* Fecha */}
      <td className="text-primary-muted text-[13px]">
        {formatDate(venta.fecha)}
      </td>

      {/* Cliente */}
      <td>
        <span className="text-[13.5px] text-primary-DEFAULT">
          {venta.cliente_nombre || <span className="text-primary-muted italic">Sin nombre</span>}
        </span>
        {venta.cliente_contacto && (
          <p className="text-[11.5px] text-primary-muted mt-0.5">
            {venta.cliente_contacto}
          </p>
        )}
      </td>

      {/* Canal */}
      <td>
        <span className="badge badge-muted text-[11.5px]">
          {venta.canal_nombre}
        </span>
      </td>

      {/* Medio pago */}
      <td className="text-[13px] text-primary-muted">
        {venta.medio_pago_nombre ?? '—'}
      </td>

      {/* Total */}
      <td className="text-right">
        <span className="font-semibold text-[14px] text-primary-DEFAULT">
          {formatCOP(venta.total)}
        </span>
        {venta.descuento > 0 && (
          <p className="text-[11.5px] text-danger mt-0.5">
            -{formatCOP(venta.descuento)}
          </p>
        )}
      </td>

      {/* Comisión */}
      <td className="text-right">
        {venta.comision_canal > 0
          ? <span className="text-[13px] text-warning">{formatCOP(venta.comision_canal)}</span>
          : <span className="text-primary-muted text-[13px]">—</span>
        }
      </td>

      {/* Estado */}
      <td>
        <span className={cn('badge', ESTADO_BADGE[venta.estado] ?? 'badge-muted')}>
          {ESTADO_LABEL[venta.estado] ?? venta.estado}
        </span>
      </td>

      {/* Acciones */}
      <td>
        <div className="flex items-center gap-1 justify-end relative">
          {/* Ver detalle */}
          <button
            onClick={onClick}
            className="p-1.5 rounded-lg text-primary-muted hover:text-primary-DEFAULT
                       hover:bg-white/5 transition-colors"
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>

          {/* Menú de estado */}
          {venta.estado !== 'cancelado' && venta.estado !== 'entregado' && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded-lg text-primary-muted hover:text-primary-DEFAULT
                           hover:bg-white/5 transition-colors"
                title="Cambiar estado"
              >
                <MoreHorizontal size={14} />
              </button>

              {menuOpen && (
                <>
                  {/* Overlay para cerrar */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-8 z-20 bg-card border border-border
                                  rounded-xl shadow-xl py-1.5 min-w-[160px] animate-fade-in">
                    {venta.estado === 'pendiente' && (
                      <button
                        onClick={() => cambiarEstado('enviado')}
                        className="flex items-center gap-2.5 w-full px-4 py-2
                                   text-[13px] text-primary-muted hover:text-primary-DEFAULT
                                   hover:bg-white/5 transition-colors"
                      >
                        <Truck size={13} className="text-accent-DEFAULT" />
                        Marcar como enviado
                      </button>
                    )}
                    {(venta.estado === 'pendiente' || venta.estado === 'enviado') && (
                      <button
                        onClick={() => cambiarEstado('entregado')}
                        className="flex items-center gap-2.5 w-full px-4 py-2
                                   text-[13px] text-primary-muted hover:text-primary-DEFAULT
                                   hover:bg-white/5 transition-colors"
                      >
                        <CheckCircle size={13} className="text-success" />
                        Marcar como entregado
                      </button>
                    )}
                    <div className="divider my-1" />
                    <button
                      onClick={() => cambiarEstado('cancelado')}
                      className="flex items-center gap-2.5 w-full px-4 py-2
                                 text-[13px] text-danger hover:bg-danger/5
                                 transition-colors"
                    >
                      <XCircle size={13} />
                      Cancelar venta
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}