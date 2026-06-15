import { formatCOP, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Pencil, Trash2 } from 'lucide-react'

interface VentaFilaProps {
  venta:      any
  onClick:    () => void
  onUpdate:   () => void
  onEditar:   () => void
  onEliminar: () => void
}

const ESTADO_STYLE: Record<string, string> = {
  completada: 'bg-success/10 border-success/20 text-success',
  pendiente:  'bg-warning/10 border-warning/20 text-warning',
  cancelado:  'bg-danger/10  border-danger/20  text-danger'
}

export default function VentaFila({ venta, onClick, onEditar, onEliminar }: VentaFilaProps) {
  const estadoStyle = ESTADO_STYLE[venta.estado] ?? 'bg-card border-border text-primary-muted'

  return (
    <tr
      className="cursor-pointer hover:bg-white/[0.02] transition-colors"
      onClick={onClick}
    >
      {/* Número */}
      <td className="font-mono text-sm text-primary-muted whitespace-nowrap">
        {venta.numero_venta}
      </td>

      {/* Fecha */}
      <td className="text-base whitespace-nowrap">
        {formatDate(venta.fecha)}
      </td>

      {/* Cliente */}
      <td className="text-base text-primary-muted max-w-[140px] truncate">
        {venta.cliente_nombre ?? '—'}
      </td>

      {/* Canal */}
      <td>
        <span className="text-sm font-semibold text-primary-muted">
          {venta.canal_nombre ?? '—'}
        </span>
      </td>

      {/* Medio pago */}
      <td className="text-sm text-primary-muted whitespace-nowrap">
        {venta.medio_pago_nombre ?? '—'}
      </td>

      {/* Total */}
      <td className="text-right font-bold text-md whitespace-nowrap">
        {formatCOP(venta.total)}
      </td>

      {/* Envío */}
      <td className="text-right text-base whitespace-nowrap text-primary-muted">
        {(venta.costo_envio ?? 0) > 0 ? formatCOP(venta.costo_envio) : <span>—</span>}
      </td>

      {/* Comisión */}
      <td className="text-right text-base whitespace-nowrap">
        {(() => {
          const total = (venta.comision_canal ?? 0) + (venta.comision_medio_pago ?? 0)
          return total > 0
            ? <span className="text-warning">{formatCOP(total)}</span>
            : <span className="text-primary-muted">—</span>
        })()}
      </td>

      {/* Utilidad */}
      <td className="text-right text-base whitespace-nowrap font-semibold">
        {venta.estado === 'cancelado'
          ? <span className="text-primary-muted">—</span>
          : <span className={(venta.utilidad_total ?? 0) >= 0 ? 'text-success' : 'text-danger'}>
              {formatCOP(venta.utilidad_total ?? 0)}
            </span>
        }
      </td>

      {/* Estado */}
      <td>
        <span className={cn(
          'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border',
          estadoStyle
        )}>
          {venta.estado}
        </span>
      </td>

      {/* Envío */}
      <td>
        {venta.estado === 'cancelado'
          ? <span className="text-primary-muted text-xs">—</span>
          : venta.envio_pendiente
            ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border bg-warning/10 border-warning/20 text-warning">Pendiente</span>
            : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border bg-success/10 border-success/20 text-success">Enviado</span>
        }
      </td>

      {/* Acciones */}
      <td>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onEditar() }}
            className="p-1.5 rounded-lg text-primary-muted hover:text-primary
                       hover:bg-white/5 transition-colors"
            title="Editar venta"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEliminar() }}
            className="p-1.5 rounded-lg text-primary-muted hover:text-danger
                       hover:bg-danger/10 transition-colors"
            title="Eliminar venta"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}


