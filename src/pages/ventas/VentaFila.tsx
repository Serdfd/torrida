import { formatCOP, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface VentaFilaProps {
  venta:    any
  onClick:  () => void
  onUpdate: () => void
  onEditar: () => void
}

const ESTADO_STYLE: Record<string, string> = {
  completada: 'bg-success/10 border-success/20 text-success',
  pendiente:  'bg-warning/10 border-warning/20 text-warning',
  cancelado:  'bg-danger/10  border-danger/20  text-danger'
}

export default function VentaFila({ venta, onClick, onEditar }: VentaFilaProps) {
  const estadoStyle = ESTADO_STYLE[venta.estado] ?? 'bg-card border-border text-primary-muted'

  return (
    <tr
      className="cursor-pointer hover:bg-white/[0.02] transition-colors"
      onClick={onClick}
    >
      {/* Número */}
      <td className="font-mono text-[12.5px] text-primary-muted whitespace-nowrap">
        {venta.numero_venta}
      </td>

      {/* Fecha */}
      <td className="text-[13px] whitespace-nowrap">
        {formatDate(venta.fecha)}
      </td>

      {/* Cliente */}
      <td className="text-[13px] text-primary-muted max-w-[140px] truncate">
        {venta.cliente_nombre ?? '—'}
      </td>

      {/* Canal */}
      <td>
        <span className="text-[12.5px] font-semibold text-primary-muted">
          {venta.canal_nombre ?? '—'}
        </span>
      </td>

      {/* Medio pago */}
      <td className="text-[12.5px] text-primary-muted whitespace-nowrap">
        {venta.medio_pago_nombre ?? '—'}
      </td>

      {/* Total */}
      <td className="text-right font-bold text-[14px] whitespace-nowrap">
        {formatCOP(venta.total)}
      </td>

      {/* Comisión */}
      <td className="text-right text-[13px] whitespace-nowrap">
        {venta.comision_canal > 0
          ? <span className="text-warning">{formatCOP(venta.comision_canal)}</span>
          : <span className="text-primary-muted">—</span>
        }
      </td>

      {/* Estado */}
      <td>
        <span className={cn(
          'inline-flex px-2 py-0.5 rounded-full text-[11.5px] font-semibold border',
          estadoStyle
        )}>
          {venta.estado}
        </span>
      </td>

      {/* Acciones */}
      <td>
        <button
          onClick={e => { e.stopPropagation(); onEditar() }}
          className="px-2.5 py-1 rounded-lg text-[12px] font-semibold
                     bg-card border border-border text-primary-muted
                     hover:text-primary hover:border-accent/40 transition-colors"
          title="Editar venta"
        >
          Editar
        </button>
      </td>
    </tr>
  )
}


