import { useState } from 'react'
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'

export interface HeatCell {
  key:    number   // mes (1-12), dia (1-31), o dow (0-6)
  ventas: number
  total:  number
}

interface Props {
  porMes:       HeatCell[]
  porDiaMes:    HeatCell[]
  porDiaSemana: HeatCell[]
}

type Vista = 'mes' | 'dia' | 'semana'

const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const VISTAS: { id: Vista; label: string; icon: React.ElementType }[] = [
  { id: 'mes',    label: 'Por mes',          icon: CalendarRange },
  { id: 'dia',    label: 'Por día del mes',  icon: CalendarDays  },
  { id: 'semana', label: 'Por día semana',   icon: Calendar      },
]

function heatColor(pct: number): string {
  // 0% → transparente, 100% → accent #E07A5F
  if (pct === 0) return 'rgba(224,122,95,0)'
  const a = Math.max(0.08, pct)
  return `rgba(224,122,95,${a.toFixed(2)})`
}

function textColor(pct: number): string {
  return pct > 0.6 ? 'text-white' : pct > 0 ? 'text-accent' : 'text-primary-muted/30'
}

interface CellProps {
  label:    string
  ventas:   number
  total:    number
  pct:      number
  wide?:    boolean
}

function HeatCellBox({ label, ventas, total, pct, wide }: CellProps) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg',
        'transition-all duration-200 cursor-default select-none',
        'border border-white/5',
        wide ? 'h-16' : 'h-14',
      )}
      style={{ backgroundColor: heatColor(pct) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className={cn('text-xs font-bold', textColor(pct))}>{label}</span>
      {ventas > 0 && (
        <span className={cn('text-[10px] mt-0.5', textColor(pct))}>
          {ventas} vta{ventas !== 1 ? 's' : ''}
        </span>
      )}

      {/* Tooltip */}
      {hover && ventas > 0 && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50
                        bg-bg-elevated border border-border rounded-xl px-3 py-2
                        shadow-2xl whitespace-nowrap pointer-events-none">
          <p className="text-sm font-bold text-primary">{label}</p>
          <p className="text-xs text-accent font-semibold">{formatCOP(total)}</p>
          <p className="text-xs text-primary-muted">{ventas} venta{ventas !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}

export default function MapaCalorChart({ porMes, porDiaMes, porDiaSemana }: Props) {
  const [vista, setVista] = useState<Vista>('mes')

  function buildGrid() {
    if (vista === 'mes') {
      const map = new Map(porMes.map(c => [c.key, c]))
      const max = Math.max(...porMes.map(c => c.total), 1)
      return Array.from({ length: 12 }, (_, i) => {
        const cell = map.get(i + 1) ?? { key: i + 1, ventas: 0, total: 0 }
        return { label: MESES_SHORT[i], ...cell, pct: cell.total / max }
      })
    }
    if (vista === 'dia') {
      const map = new Map(porDiaMes.map(c => [c.key, c]))
      const max = Math.max(...porDiaMes.map(c => c.total), 1)
      return Array.from({ length: 31 }, (_, i) => {
        const cell = map.get(i + 1) ?? { key: i + 1, ventas: 0, total: 0 }
        return { label: String(i + 1).padStart(2, '0'), ...cell, pct: cell.total / max }
      })
    }
    // semana
    const map = new Map(porDiaSemana.map(c => [c.key, c]))
    const max = Math.max(...porDiaSemana.map(c => c.total), 1)
    return DIAS_SEMANA.map((label, i) => {
      const cell = map.get(i) ?? { key: i, ventas: 0, total: 0 }
      return { label, ...cell, pct: cell.total / max }
    })
  }

  const cells = buildGrid()
  const hasData = cells.some(c => c.ventas > 0)

  const gridClass = vista === 'mes'
    ? 'grid grid-cols-6 md:grid-cols-12 gap-2'
    : vista === 'dia'
    ? 'grid grid-cols-7 gap-2'
    : 'grid grid-cols-7 gap-3'

  return (
    <div className="flex flex-col gap-5">
      {/* Toggle */}
      <div className="flex items-center gap-1 bg-bg-surface border border-border
                      rounded-xl p-1 self-start">
        {VISTAS.map(v => {
          const Icon = v.icon
          return (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold',
                'transition-all duration-150',
                vista === v.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-primary-muted hover:text-primary'
              )}
            >
              <Icon size={13} />
              {v.label}
            </button>
          )
        })}
      </div>

      {/* Escala de color */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-primary-muted">Menor</span>
        <div className="flex gap-0.5">
          {[0.08, 0.2, 0.4, 0.6, 0.8, 1].map(v => (
            <div
              key={v}
              className="w-5 h-3 rounded-sm"
              style={{ backgroundColor: heatColor(v) }}
            />
          ))}
        </div>
        <span className="text-xs text-primary-muted">Mayor</span>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-[120px] text-primary-muted text-base">
          Sin datos de ventas para este año
        </div>
      ) : (
        <div className={gridClass}>
          {cells.map(cell => (
            <HeatCellBox
              key={cell.key}
              label={cell.label}
              ventas={cell.ventas}
              total={cell.total}
              pct={cell.pct}
              wide={vista === 'semana'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
