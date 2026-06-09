import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { VentasPorMes } from '@/types'
import { formatCOP } from '@/lib/utils'

interface VentasMesChartProps {
  data: VentasPorMes[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-[12px] font-bold text-primary-muted uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-[15px] font-bold text-accent-DEFAULT">
        {formatCOP(payload[0]?.value ?? 0)}
      </p>
      <p className="text-[12px] text-primary-muted">
        {payload[1]?.value ?? 0} unidades
      </p>
    </div>
  )
}

export default function VentasMesChart({ data }: VentasMesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px]
                      text-primary-muted text-[13.5px]">
        Sin datos para mostrar
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#E07A5F" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#E07A5F" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradUnidades" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#4CAF82" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#4CAF82" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1E1E35"
          vertical={false}
        />

        <XAxis
          dataKey="mes"
          tick={{ fill: '#8A8AA8', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />

        <YAxis
          yAxisId="total"
          orientation="left"
          tick={{ fill: '#8A8AA8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
                ? `${(v / 1_000).toFixed(0)}K`
                : String(v)
          }
          width={52}
        />

        <YAxis
          yAxisId="cant"
          orientation="right"
          tick={{ fill: '#8A8AA8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />

        <Tooltip content={<CustomTooltip />} />

        <Area
          yAxisId="total"
          type="monotone"
          dataKey="total"
          name="Total"
          stroke="#E07A5F"
          strokeWidth={2.5}
          fill="url(#gradTotal)"
          dot={false}
          activeDot={{ r: 5, fill: '#E07A5F', strokeWidth: 0 }}
        />

        <Area
          yAxisId="cant"
          type="monotone"
          dataKey="cantidad"
          name="Unidades"
          stroke="#4CAF82"
          strokeWidth={2}
          fill="url(#gradUnidades)"
          dot={false}
          activeDot={{ r: 4, fill: '#4CAF82', strokeWidth: 0 }}
          strokeDasharray="4 3"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}