import { useEffect, useState, useCallback } from 'react'
import { Download, BarChart2, Flame, ShoppingBag, Share2 } from 'lucide-react'
import { useAppStore, useToast } from '@/store/useAppStore'
import {
  getComparativaMeses,
  getComparativaGastosMeses,
  getTopProductos,
  getVentasPorCanal,
  getHeatmapPorMes,
  getHeatmapPorDiaMes,
  getHeatmapPorDiaSemana,
  getHeatmapSemanaHora,
} from '@/lib/queries'
import { formatCOP, formatNumber, objectsToCSV, cn } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import MapaCalorChart   from './MapaCalorChart'
import type { HeatCell, HeatMatrix } from './MapaCalorChart'

type Tab = 'anual' | 'calor' | 'productos' | 'canales'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'anual',     label: 'Anual',          icon: BarChart2   },
  { id: 'calor',     label: 'Mapa de calor',  icon: Flame       },
  { id: 'productos', label: 'Productos',      icon: ShoppingBag },
  { id: 'canales',   label: 'Canales',        icon: Share2      },
]

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface FilaMes {
  mes:            string
  ventas:         number
  ingresos:       number
  comisiones:     number
  envios:         number
  utilidad_bruta: number
  gastos:         number
  margen:         number
}

interface TopProducto {
  producto: string
  unidades: number
  ingresos: number
}

interface CanalVenta {
  canal:       string
  cantidad:    number
  total:       number
  comisiones:  number
}

export default function Reportes() {
  const { filtroAnio, filtroMes } = useAppStore()
  const toast = useToast()

  const [tab,          setTab]          = useState<Tab>('anual')
  const [anio,         setAnio]         = useState(filtroAnio)
  const [loading,      setLoading]      = useState(true)
  const [filasMeses,   setFilasMeses]   = useState<FilaMes[]>([])
  const [topProductos, setTopProductos] = useState<TopProducto[]>([])
  const [canales,      setCanales]      = useState<CanalVenta[]>([])
  const [heatMes,      setHeatMes]      = useState<HeatCell[]>([])
  const [heatDia,      setHeatDia]      = useState<HeatCell[]>([])
  const [heatSemana,   setHeatSemana]   = useState<HeatCell[]>([])
  const [heatMatrix,   setHeatMatrix]   = useState<HeatMatrix[]>([])

  const loadReportes = useCallback(async () => {
    setLoading(true)
    try {
      const [ventasMeses, gastosMeses, top, canalData, hmMes, hmDia, hmSemana] = await Promise.all([
        getComparativaMeses(anio),
        getComparativaGastosMeses(anio),
        getTopProductos(anio, filtroMes),
        getVentasPorCanal(anio, filtroMes),
        getHeatmapPorMes(anio),
        getHeatmapPorDiaMes(anio),
        getHeatmapPorDiaSemana(anio),
      ])

      // Carga separada para no romper el resto si falla
      const hmMatrix = await getHeatmapSemanaHora(anio).catch((err) => {
        console.error('[Reportes] getHeatmapSemanaHora error:', err)
        return [] as { dow: number; hora: number; ventas: number; total: number }[]
      })

      const gastosPorMes = new Map<string, number>()
      for (const g of gastosMeses as any[]) {
        gastosPorMes.set(g.mes, g.gastos)
      }

      const filas: FilaMes[] = MESES.map((_, i) => {
        const mesStr     = String(i + 1).padStart(2, '0')
        const vRow       = (ventasMeses as any[]).find(v => v.mes === mesStr)
        const ingresos       = vRow?.ingresos       ?? 0
        const comisiones     = vRow?.comisiones     ?? 0
        const envios         = vRow?.envios         ?? 0
        const utilidad_bruta = vRow?.utilidad_bruta ?? 0
        const ventas         = vRow?.ventas         ?? 0
        const gastos         = gastosPorMes.get(mesStr) ?? 0
        const margen         = utilidad_bruta - gastos
        return { mes: MESES[i], ventas, ingresos, comisiones, envios, utilidad_bruta, gastos, margen }
      })

      setFilasMeses(filas)
      setTopProductos(top as unknown as TopProducto[])
      setCanales(canalData as unknown as CanalVenta[])
      setHeatMes((hmMes     as any[]).map(r => ({ key: r.mes, ventas: r.ventas, total: r.total })))
      setHeatDia((hmDia     as any[]).map(r => ({ key: r.dia, ventas: r.ventas, total: r.total })))
      setHeatSemana((hmSemana as any[]).map(r => ({ key: r.dow, ventas: r.ventas, total: r.total })))
      setHeatMatrix((hmMatrix as any[]).map(r => ({ dow: r.dow, hora: r.hora, ventas: r.ventas, total: r.total })))
    } catch {
      toast.error('Error al cargar reportes')
    } finally {
      setLoading(false)
    }
  }, [anio, filtroMes])

  useEffect(() => { loadReportes() }, [loadReportes])

  const totalIngresos      = filasMeses.reduce((s, f) => s + f.ingresos, 0)
  const totalGastos        = filasMeses.reduce((s, f) => s + f.gastos, 0)
  const totalComisiones    = filasMeses.reduce((s, f) => s + f.comisiones, 0)
  const totalEnvios        = filasMeses.reduce((s, f) => s + f.envios, 0)
  const totalUtilidadBruta = filasMeses.reduce((s, f) => s + f.utilidad_bruta, 0)
  const margenNeto         = totalUtilidadBruta - totalGastos
  const mejorMes        = filasMeses.reduce(
    (best, f) => f.ingresos > best.ingresos ? f : best,
    { mes: '—', ingresos: 0 } as FilaMes
  )

  function handleExportar() {
    if (filasMeses.every(f => f.ingresos === 0 && f.gastos === 0)) {
      toast.warning('No hay datos para exportar')
      return
    }
    const data = filasMeses.map(f => ({
      Mes: f.mes, Ventas: f.ventas, 'Ingresos brutos': f.ingresos,
      Comisiones: f.comisiones, 'Envíos (real)': f.envios,
      'Utilidad bruta': f.utilidad_bruta,
      Gastos: f.gastos, 'Utilidad neta': f.margen
    }))
    const csv  = objectsToCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `reporte_${anio}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Reporte exportado')
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Barra superior */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 size={20} className="text-accent" />
          <h2 className="text-lg font-bold text-primary">Reportes</h2>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="input h-9 text-base w-[110px]"
          >
            {Array.from({ length: 5 }, (_, i) => filtroAnio - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={handleExportar} className="btn-ghost">
            <Download size={14} />
            CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-bg-surface border border-border rounded-xl p-1 self-start">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
                tab === t.id ? 'bg-accent text-white shadow-sm' : 'text-primary-muted hover:text-primary'
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {loading ? <FullPageSpinner /> : (
        <>
          {/* Tab: Anual */}
          {tab === 'anual' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="card py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary-muted mb-1">Ingresos brutos {anio}</p>
                  <p className="text-xl font-bold text-success">{formatCOP(totalIngresos)}</p>
                </div>
                <div className="card py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary-muted mb-1">Utilidad bruta {anio}</p>
                  <p className="text-xl font-bold text-success">{formatCOP(totalUtilidadBruta)}</p>
                </div>
                <div className="card py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary-muted mb-1">Gastos {anio}</p>
                  <p className="text-xl font-bold text-danger">{formatCOP(totalGastos)}</p>
                </div>
                <div className="card py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary-muted mb-1">Margen neto</p>
                  <p className={`text-xl font-bold ${margenNeto >= 0 ? 'text-success' : 'text-danger'}`}>{formatCOP(margenNeto)}</p>
                </div>
                <div className="card py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary-muted mb-1">Mejor mes</p>
                  <p className="text-xl font-bold text-accent truncate">{mejorMes.ingresos > 0 ? mejorMes.mes : '—'}</p>
                </div>
              </div>

              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-base font-bold text-primary">Comparativa mensual {anio}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th className="text-right">Ventas</th>
                        <th className="text-right">Ingresos brutos</th>
                        <th className="text-right">Comisiones</th>
                        <th className="text-right">Envíos (real)</th>
                        <th className="text-right">Utilidad bruta</th>
                        <th className="text-right">Gastos operat.</th>
                        <th className="text-right">Utilidad neta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasMeses.map(f => (
                        <tr key={f.mes} className={f.ingresos === 0 && f.gastos === 0 ? 'opacity-35' : ''}>
                          <td className="font-medium text-base text-primary">{f.mes}</td>
                          <td className="text-right text-base text-primary-muted">{f.ventas > 0 ? formatNumber(f.ventas) : '—'}</td>
                          <td className="text-right font-semibold text-base text-primary">{f.ingresos > 0 ? formatCOP(f.ingresos) : '—'}</td>
                          <td className="text-right text-base text-primary">{f.comisiones > 0 ? formatCOP(f.comisiones) : '—'}</td>
                          <td className="text-right text-base text-primary">{f.envios > 0 ? formatCOP(f.envios) : '—'}</td>
                          <td className="text-right font-semibold text-base text-success">{f.utilidad_bruta > 0 ? formatCOP(f.utilidad_bruta) : '—'}</td>
                          <td className="text-right text-base text-danger">{f.gastos > 0 ? formatCOP(f.gastos) : '—'}</td>
                          <td className={`text-right font-bold text-base ${f.margen > 0 ? 'text-success' : f.margen < 0 ? 'text-danger' : 'text-primary-muted'}`}>
                            {f.ingresos > 0 || f.gastos > 0 ? formatCOP(f.margen) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-[#0B0B16]">
                        <td className="px-4 py-3 text-base font-bold text-primary-muted">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-base text-primary">{formatNumber(filasMeses.reduce((s, f) => s + f.ventas, 0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-base text-primary">{formatCOP(totalIngresos)}</td>
                        <td className="px-4 py-3 text-right font-bold text-base text-primary">{formatCOP(totalComisiones)}</td>
                        <td className="px-4 py-3 text-right font-bold text-base text-primary">{formatCOP(totalEnvios)}</td>
                        <td className="px-4 py-3 text-right font-bold text-base text-success">{formatCOP(totalUtilidadBruta)}</td>
                        <td className="px-4 py-3 text-right font-bold text-base text-danger">{formatCOP(totalGastos)}</td>
                        <td className={`px-4 py-3 text-right font-bold text-md ${margenNeto >= 0 ? 'text-success' : 'text-danger'}`}>{formatCOP(margenNeto)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Mapa de calor */}
          {tab === 'calor' && (
            <div className="card">
              <div className="flex items-center gap-2 mb-6">
                <Flame size={16} className="text-accent" />
                <h3 className="text-base font-bold text-primary">Intensidad de ventas — {anio}</h3>
              </div>
              <MapaCalorChart porMes={heatMes} porDiaMes={heatDia} porDiaSemana={heatSemana} semanaHora={heatMatrix} />
              <p className="mt-5 text-xs text-primary-muted">
                Mayor intensidad = más ingresos. Pasa el cursor sobre cada celda para ver el detalle.
              </p>
            </div>
          )}

          {/* Tab: Productos */}
          {tab === 'productos' && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-base font-bold text-primary">Top 5 productos — {MESES[filtroMes - 1]} {anio}</h3>
              </div>
              {topProductos.length === 0 ? (
                <div className="px-4 py-12 text-center text-base text-primary-muted">Sin datos en este período</div>
              ) : (
                <div className="divide-y divide-border">
                  {topProductos.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-6 h-6 rounded-full bg-accent-light text-accent text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-primary truncate">{p.producto}</p>
                        <p className="text-xs text-primary-muted">{formatNumber(p.unidades)} ud.</p>
                      </div>
                      <span className="font-bold text-base text-success shrink-0">{formatCOP(p.ingresos)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Canales */}
          {tab === 'canales' && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-base font-bold text-primary">Ventas por canal — {MESES[filtroMes - 1]} {anio}</h3>
              </div>
              {canales.length === 0 ? (
                <div className="px-4 py-12 text-center text-base text-primary-muted">Sin datos en este período</div>
              ) : (
                <div className="divide-y divide-border">
                  {canales.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-primary truncate">{c.canal ?? 'Sin canal'}</p>
                        <p className="text-xs text-primary-muted">
                          {formatNumber(c.cantidad)} ventas
                          {c.comisiones > 0 && ` · comisiones ${formatCOP(c.comisiones)}`}
                        </p>
                      </div>
                      <span className="font-bold text-base text-success shrink-0">{formatCOP(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
