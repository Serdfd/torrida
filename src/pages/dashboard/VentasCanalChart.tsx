import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { formatCOP, formatPct } from '@/lib/utils'
import type { VentasPorCanal }  from './Dashboard'

interface VentasCanalChartProps {
  data: VentasPorCanal[]
}

const COLORS = ['#7C6AF7', '#34D399', '#FBBF24', '#F87171', '#60A5FA']

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload as VentasPorCanal
  const total = item.total ?? 0
  return (
    <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-base font-bold text-primary mb-1">{item.canal}</p>
      <p className="text-md font-bold text-accent">{formatCOP(total)}</p>
      <p className="text-sm text-primary-muted">{item.cantidad} ventas</p>
    </div>
  )
}

function CustomLegend({ payload }: any) {
  if (!payload?.length) return null
  const totalGeneral = payload.reduce((s: number, e: any) => s + (e.payload?.total ?? 0), 0)
  return (
    <ul className="flex flex-col gap-2 mt-2">
      {payload.map((entry: any, i: number) => {
        const pct = totalGeneral > 0
          ? (entry.payload?.total / totalGeneral) * 100
          : 0
        return (
          <li key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-primary-muted">{entry.value}</span>
            </div>
            <span className="text-sm font-semibold text-primary">
              {formatPct(pct)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default function VentasCanalChart({ data }: VentasCanalChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-primary-muted text-base">
        Sin datos para mostrar
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="45%"
          innerRadius={55} outerRadius={80}
          paddingAngle={3}
          dataKey="total"
          nameKey="canal"
          strokeWidth={0}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} verticalAlign="bottom" />
      </PieChart>
    </ResponsiveContainer>
  )
}