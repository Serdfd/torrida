import { useEffect, useState } from 'react'
import { History, LockKeyhole, UnlockKeyhole, TrendingUp, TrendingDown } from 'lucide-react'
import { getCierresHistorial } from '@/lib/queries'
import { formatCOP, formatPct, monthYearLabel } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

interface CierreHistorial {
  id:             number
  anio:           number
  mes:            number
  ingresos:       number
  gastos:         number
  utilidad_neta:  number
  unidades:       number
  devoluciones:   number
  cerrado:        number
  cerrado_en:     string | null
}

export default function HistorialCierres() {
  const toast = useToast()

  const [loading,  setLoading]  = useState(true)
  const [cierres,  setCierres]  = useState<CierreHistorial[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getCierresHistorial() as CierreHistorial[]
        setCierres(data)
      } catch {
        toast.error('Error al cargar historial')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <FullPageSpinner />

  return (
    <div className="card">

      {/* Encabezado */}
      <div className="flex items-center gap-2 mb-5">
        <History size={16} className="text-primary-muted" />
        <p className="text-[13px] font-bold text-primary-muted uppercase tracking-wider">
          Historial de cierres
        </p>
        <span className="badge badge-muted ml-auto">
          {cierres.length} período{cierres.length !== 1 ? 's' : ''}
        </span>
      </div>

      {cierres.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin cierres registrados"
          description="Cuando cierres un período aparecerá aquí."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {cierres.map(cierre => {
            const margen = cierre.ingresos > 0
              ? (cierre.utilidad_neta / cierre.ingresos) * 100
              : 0
            const esPositivo  = cierre.utilidad_neta >= 0
            const estaCerrado = Boolean(cierre.cerrado)
            const isOpen      = expanded === cierre.id

            return (
              <div
                key={cierre.id}
                className={cn(
                  'rounded-xl border transition-all duration-200',
                  estaCerrado
                    ? 'border-border bg-[#0B0B16]'
                    : 'border-warning/20 bg-warning/5'
                )}
              >
                {/* Fila resumen — clickeable */}
                <button
                  className="w-full flex items-center gap-4 px-4 py-3.5
                             text-left hover:bg-white/2 transition-colors
                             rounded-xl"
                  onClick={() => setExpanded(isOpen ? null : cierre.id)}
                >
                  {/* Icono estado */}
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    estaCerrado ? 'bg-success/10' : 'bg-warning/10'
                  )}>
                    {estaCerrado
                      ? <LockKeyhole   size={14} className="text-success" />
                      : <UnlockKeyhole size={14} className="text-warning" />
                    }
                  </div>

                  {/* Período */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-primary">
                      {monthYearLabel(cierre.anio, cierre.mes)}
                    </p>
                    <p className="text-[12px] text-primary-muted">
                      {estaCerrado && cierre.cerrado_en
                        ? `Cerrado el ${new Date(cierre.cerrado_en)
                            .toLocaleDateString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}`
                        : 'Período abierto'
                      }
                    </p>
                  </div>

                  {/* Ingresos */}
                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] text-primary-muted mb-0.5">Ingresos</p>
                    <p className="text-[13.5px] font-bold text-primary">
                      {formatCOP(cierre.ingresos)}
                    </p>
                  </div>

                  {/* Utilidad */}
                  <div className="text-right">
                    <p className="text-[11px] text-primary-muted mb-0.5">Utilidad</p>
                    <p className={cn(
                      'text-[14px] font-bold',
                      esPositivo ? 'text-success' : 'text-danger'
                    )}>
                      {esPositivo ? '+' : ''}{formatCOP(cierre.utilidad_neta)}
                    </p>
                  </div>

                  {/* Margen */}
                  <div className="text-right hidden md:block">
                    <p className="text-[11px] text-primary-muted mb-0.5">Margen</p>
                    <div className="flex items-center gap-1 justify-end">
                      {esPositivo
                        ? <TrendingUp   size={12} className="text-success" />
                        : <TrendingDown size={12} className="text-danger"  />
                      }
                      <span className={cn(
                        'text-[13px] font-bold',
                        margen >= 30
                          ? 'text-success'
                          : margen >= 10
                            ? 'text-warning'
                            : 'text-danger'
                      )}>
                        {formatPct(margen)}
                      </span>
                    </div>
                  </div>

                  {/* Chevron */}
                  <svg
                    className={cn(
                      'w-4 h-4 text-primary-muted shrink-0 transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round"
                          strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Detalle expandible */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/50 pt-3
                                  grid grid-cols-2 sm:grid-cols-4 gap-3
                                  animate-fade-in">
                    <DetalleItem
                      label="Ingresos brutos"
                      value={formatCOP(cierre.ingresos)}
                      color="text-success"
                    />
                    <DetalleItem
                      label="Total gastos"
                      value={formatCOP(cierre.gastos)}
                      color="text-danger"
                    />
                    <DetalleItem
                      label="Unidades vendidas"
                      value={String(cierre.unidades)}
                      color="text-primary"
                    />
                    <DetalleItem
                      label="Devoluciones"
                      value={String(cierre.devoluciones)}
                      color="text-warning"
                    />
                    <DetalleItem
                      label="Utilidad neta"
                      value={formatCOP(cierre.utilidad_neta)}
                      color={esPositivo ? 'text-accent' : 'text-danger'}
                      bold
                    />
                    <DetalleItem
                      label="Margen neto"
                      value={formatPct(margen)}
                      color={
                        margen >= 30
                          ? 'text-success'
                          : margen >= 10
                            ? 'text-warning'
                            : 'text-danger'
                      }
                      bold
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Sub-componente ─────────────────────────────────────────

interface DetalleItemProps {
  label:  string
  value:  string
  color:  string
  bold?:  boolean
}

function DetalleItem({ label, value, color, bold }: DetalleItemProps) {
  return (
    <div className="bg-card rounded-xl px-3 py-2.5 border border-border">
      <p className="text-[11px] text-primary-muted uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={cn(
        'text-[14px]',
        bold ? 'font-bold' : 'font-semibold',
        color
      )}>
        {value}
      </p>
    </div>
  )
}