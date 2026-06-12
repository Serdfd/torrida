import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

export interface UnidadesPorMes {
  mes:      string
  unidades: number
  ventas:   number
}

interface Props {
  data: UnidadesPorMes[]
}

const COLOR = '#34D399'

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-sm font-bold text-primary-muted uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-md font-bold" style={{ color: COLOR }}>
        {payload[0]?.value ?? 0} unidades
      </p>
      <p className="text-sm text-primary-muted">
        {payload[0]?.payload?.ventas ?? 0} ventas
      </p>
    </div>
  )
}

export default function UnidadesMesChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-primary-muted text-base">
        Sin datos para mostrar
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={28}>
        <defs>
          <linearGradient id="gradUnidades" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={COLOR} stopOpacity={0.9} />
            <stop offset="100%" stopColor={COLOR} stopOpacity={0.3} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

        <XAxis
          dataKey="mes"
          tick={{ fill: '#6B6B8A', fontSize: 12 }}
          axisLine={false} tickLine={false} dy={6}
        />

        <YAxis
          tick={{ fill: '#6B6B8A', fontSize: 11 }}
          axisLine={false} tickLine={false}
          width={36}
          allowDecimals={false}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

        <Bar dataKey="unidades" name="Unidades" fill="url(#gradUnidades)" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="url(#gradUnidades)" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
