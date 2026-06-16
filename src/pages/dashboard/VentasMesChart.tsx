import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { formatCOP }       from '@/lib/utils'
import type { VentasPorMes } from './Dashboard'

interface VentasMesChartProps {
  data: VentasPorMes[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-sm font-bold text-primary-muted uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-md font-bold text-accent">
        {formatCOP(payload[0]?.value ?? 0)}
      </p>

    </div>
  )
}

export default function VentasMesChart({ data }: VentasMesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-primary-muted text-base">
        Sin datos para mostrar
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#7C6AF7" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#7C6AF7" stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

        <XAxis
          dataKey="mes"
          tick={{ fill: '#6B6B8A', fontSize: 12 }}
          axisLine={false} tickLine={false} dy={6}
        />

        <YAxis
          orientation="left"
          tick={{ fill: '#6B6B8A', fontSize: 11 }}
          axisLine={false} tickLine={false}
          tickFormatter={v =>
            v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M`
            : v >= 1_000   ? `${(v/1_000).toFixed(0)}K`
            : String(v)
          }
          width={52}
        />



        <Tooltip content={<CustomTooltip />} />

        <Area
          type="monotone"
          dataKey="ingresos"
          name="Ingresos"
          stroke="#7C6AF7"
          strokeWidth={2.5}
          fill="url(#gradIngresos)"
          dot={false}
          activeDot={{ r: 5, fill: '#7C6AF7', strokeWidth: 0 }}
        />


      </AreaChart>
    </ResponsiveContainer>
  )
}