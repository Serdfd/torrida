import { useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { formatCOP, formatPct } from '@/lib/utils'

export interface VentasGeo {
  zona:     string
  total:    number
  cantidad: number
}

interface VentasGeoChartProps {
  porDepartamento: VentasGeo[]
  porCiudad:       VentasGeo[]
}

const COLORS = [
  '#E07A5F', '#F2CC8F', '#7C6AF7', '#34D399',
  '#60A5FA', '#F87171', '#A78BFA', '#FBBF24',
  '#6EE7B7', '#FCA5A5'
]

type Vista = 'departamento' | 'ciudad'

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload as VentasGeo
  return (
    <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-base font-bold text-primary mb-1">{item.zona}</p>
      <p className="text-md font-bold text-accent">{formatCOP(item.total)}</p>
      <p className="text-sm text-primary-muted">{item.cantidad} {item.cantidad === 1 ? 'venta' : 'ventas'}</p>
    </div>
  )
}

export default function VentasGeoChart({ porDepartamento, porCiudad }: VentasGeoChartProps) {
  const [vista, setVista] = useState<Vista>('departamento')

  const data = vista === 'departamento' ? porDepartamento : porCiudad
  const totalGeneral = data.reduce((s, d) => s + d.total, 0)

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-primary-muted">
          Agrupado <span className="text-accent font-semibold">
            {vista === 'departamento' ? 'por departamento' : 'por ciudad'}
          </span>
        </span>
        <div className="flex items-center bg-bg-surface border border-border rounded-lg p-0.5">
          {(['departamento', 'ciudad'] as Vista[]).map(v => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={[
                'px-3 py-1 rounded-md text-sm font-semibold transition-all duration-150',
                vista === v
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-primary-muted hover:text-primary',
              ].join(' ')}
            >
              {v === 'departamento' ? 'Depto.' : 'Ciudad'}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-primary-muted text-base">
          Sin datos de ubicación para este período
        </div>
      ) : (
        <>
          {/* Dona — altura fija, centrada, sin Legend interna */}
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="zona"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Leyenda debajo */}
          <ul className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
            {data.map((item, i) => {
              const pct = totalGeneral > 0 ? (item.total / totalGeneral) * 100 : 0
              return (
                <li key={i} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-sm text-primary-muted truncate">{item.zona}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary shrink-0">
                    {formatPct(pct)}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}


