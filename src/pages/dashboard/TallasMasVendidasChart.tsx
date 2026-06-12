import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'

export interface TallaVendida {
  talla:    string
  unidades: number
}

interface Props {
  data: TallaVendida[]
}

const COLORS = [
  '#7C6AF7', '#E07A5F', '#34D399', '#F2CC8F',
  '#60A5FA', '#F87171', '#A78BFA', '#FBBF24',
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-base font-bold text-primary mb-1">Talla {label}</p>
      <p className="text-md font-bold text-accent">
        {payload[0]?.value ?? 0} unidades
      </p>
    </div>
  )
}

export default function TallasMasVendidasChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-primary-muted text-base">
        Sin datos para este período
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={32}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="talla"
          tick={{ fill: '#6B6B8A', fontSize: 12 }}
          axisLine={false} tickLine={false} dy={6}
        />
        <YAxis
          tick={{ fill: '#6B6B8A', fontSize: 11 }}
          axisLine={false} tickLine={false}
          width={32} allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="unidades" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
