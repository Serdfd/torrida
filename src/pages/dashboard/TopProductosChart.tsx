import { formatCOP } from '@/lib/utils'

export interface TopProducto {
  producto_nombre: string
  unidades:        number
  total:           number
}

interface Props {
  data: TopProducto[]
}

const COLORS = ['#E07A5F', '#F2CC8F', '#7C6AF7', '#34D399', '#60A5FA']

export default function TopProductosChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[160px] text-primary-muted text-base">
        Sin datos para este período
      </div>
    )
  }

  const maxUnidades = Math.max(...data.map(d => d.unidades), 1)

  return (
    <ul className="flex flex-col gap-3">
      {data.map((item, i) => (
        <li key={i} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-5 h-5 rounded-md text-xs font-bold flex items-center justify-center shrink-0 text-white"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              >
                {i + 1}
              </span>
              <span className="text-sm text-primary truncate">{item.producto_nombre}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-primary-muted">{item.unidades} uds</span>
              <span className="text-sm font-semibold text-accent">{formatCOP(item.total)}</span>
            </div>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.unidades / maxUnidades) * 100}%`,
                backgroundColor: COLORS[i % COLORS.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
