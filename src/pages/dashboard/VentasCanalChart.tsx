import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { VentasPorCanal } from '@/types'
import { formatCOP, formatPct } from '@/lib/utils'

interface VentasCanalChartProps {
  data: VentasPorCanal[]
}

const COLORS = ['#E07A5F', '#4CAF82', '#F2CC8F', '#8A8AA8', '#C8C8E0']

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload as VentasPorCanal
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-[13px] font-bold text-primary-DEFAULT mb-1">
        {item.canal}
      </p>
      <p className="text-[15px] font-bold text-accent-DEFAULT">
        {formatCOP(item.total)}
      </p>
      <p className="text-[12px] text-primary-muted">
        {item.cantidad} ventas · {formatPct(item.porcentaje)}
      </p>
    </div>
  )
}

function CustomLegend({ payload }: any) {
  if (!payload?.length) return null
  return (
    <ul className="flex flex-col gap-2 mt-2">
      {payload.map((entry: any, i: number) => (
        <li key={i} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[12.5px] text-primary-muted">
              {entry.value}
            </span>
          </div>
          <span className="text-[12.5px] font-semibold text-primary-DEFAULT">
            {formatPct(entry.payload?.porcentaje ?? 0)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function VentasCanalChart({ data }: VentasCanalChartProps) {
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
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="total"
          nameKey="canal"
          strokeWidth={0}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>

        <Tooltip content={<CustomTooltip />} />

        <Legend
          content={<CustomLegend />}
          verticalAlign="bottom"
        />
      </PieChart>
    </ResponsiveContainer>
  )
}