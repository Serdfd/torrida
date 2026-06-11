import { useEffect, useState, useCallback } from 'react'
import { Download, BarChart2 } from 'lucide-react'
import { useAppStore, useToast } from '@/store/useAppStore'
import {
  getComparativaMeses,
  getComparativaGastosMeses,
  getTopProductos,
  getVentasPorCanal
} from '@/lib/queries'
import { formatCOP, formatNumber, objectsToCSV } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface FilaMes {
  mes:         string
  ventas:      number
  ingresos:    number
  comisiones:  number
  gastos:      number
  margen:      number
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

  const [anio,         setAnio]         = useState(filtroAnio)
  const [loading,      setLoading]      = useState(true)
  const [filasMeses,   setFilasMeses]   = useState<FilaMes[]>([])
  const [topProductos, setTopProductos] = useState<TopProducto[]>([])
  const [canales,      setCanales]      = useState<CanalVenta[]>([])

  const loadReportes = useCallback(async () => {
    setLoading(true)
    try {
      const [ventasMeses, gastosMeses, top, canalData] = await Promise.all([
        getComparativaMeses(anio),
        getComparativaGastosMeses(anio),
        getTopProductos(anio, filtroMes, 5),
        getVentasPorCanal(anio, filtroMes)
      ])

      // Construir tabla combinada mes a mes
      const gastosPorMes = new Map<string, number>()
      for (const g of gastosMeses as any[]) {
        gastosPorMes.set(g.mes, g.gastos)
      }

      const filas: FilaMes[] = MESES.map((_, i) => {
        const mesStr  = String(i + 1).padStart(2, '0')
        const vRow    = (ventasMeses as any[]).find(v => v.mes === mesStr)
        const ingresos   = vRow?.ingresos   ?? 0
        const comisiones = vRow?.comisiones ?? 0
        const ventas     = vRow?.ventas     ?? 0
        const gastos     = gastosPorMes.get(mesStr) ?? 0
        const margen     = ingresos - comisiones - gastos
        return { mes: MESES[i], ventas, ingresos, comisiones, gastos, margen }
      })

      setFilasMeses(filas)
      setTopProductos(top as unknown as TopProducto[])
      setCanales(canalData as unknown as CanalVenta[])
    } catch {
      toast.error('Error al cargar reportes')
    } finally {
      setLoading(false)
    }
  }, [anio, filtroMes])

  useEffect(() => { loadReportes() }, [loadReportes])

  // KPIs anuales
  const totalIngresos   = filasMeses.reduce((s, f) => s + f.ingresos, 0)
  const totalGastos     = filasMeses.reduce((s, f) => s + f.gastos, 0)
  const totalComisiones = filasMeses.reduce((s, f) => s + f.comisiones, 0)
  const margenNeto      = totalIngresos - totalComisiones - totalGastos
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
      Mes:         f.mes,
      Ventas:      f.ventas,
      Ingresos:    f.ingresos,
      Comisiones:  f.comisiones,
      Gastos:      f.gastos,
      Margen:      f.margen
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
          <h2 className="text-[16px] font-bold text-primary">
            Reporte anual
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Selector de año */}
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            className="input h-9 text-[13px] w-[110px]"
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

      {/* KPIs anuales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Ingresos {anio}</p>
          <p className="text-[20px] font-bold text-success">
            {formatCOP(totalIngresos)}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Gastos {anio}</p>
          <p className="text-[20px] font-bold text-danger">
            {formatCOP(totalGastos)}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Margen neto</p>
          <p className={`text-[20px] font-bold ${margenNeto >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatCOP(margenNeto)}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Mejor mes</p>
          <p className="text-[20px] font-bold text-accent truncate">
            {mejorMes.ingresos > 0 ? mejorMes.mes : '—'}
          </p>
        </div>
      </div>

      {loading ? (
        <FullPageSpinner />
      ) : (
        <>
          {/* Tabla comparativa mes a mes */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-[13.5px] font-bold text-primary">
                Comparativa mensual {anio}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th className="text-right">Ventas</th>
                    <th className="text-right">Ingresos</th>
                    <th className="text-right">Comisiones</th>
                    <th className="text-right">Gastos</th>
                    <th className="text-right">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {filasMeses.map(f => (
                    <tr key={f.mes}
                        className={f.ingresos === 0 && f.gastos === 0
                          ? 'opacity-35' : ''}>
                      <td className="font-medium text-[13px] text-primary">
                        {f.mes}
                      </td>
                      <td className="text-right text-[13px] text-primary-muted">
                        {f.ventas > 0 ? formatNumber(f.ventas) : '—'}
                      </td>
                      <td className="text-right font-semibold text-[13px] text-success">
                        {f.ingresos > 0 ? formatCOP(f.ingresos) : '—'}
                      </td>
                      <td className="text-right text-[13px] text-warning">
                        {f.comisiones > 0 ? formatCOP(f.comisiones) : '—'}
                      </td>
                      <td className="text-right text-[13px] text-danger">
                        {f.gastos > 0 ? formatCOP(f.gastos) : '—'}
                      </td>
                      <td className={`text-right font-bold text-[13px]
                        ${f.margen > 0 ? 'text-success' :
                          f.margen < 0 ? 'text-danger' : 'text-primary-muted'}`}>
                        {f.ingresos > 0 || f.gastos > 0 ? formatCOP(f.margen) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-[#0B0B16]">
                    <td className="px-4 py-3 text-[13px] font-bold text-primary-muted">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[13px]
                                   text-primary">
                      {formatNumber(filasMeses.reduce((s, f) => s + f.ventas, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[13px] text-success">
                      {formatCOP(totalIngresos)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[13px] text-warning">
                      {formatCOP(totalComisiones)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[13px] text-danger">
                      {formatCOP(totalGastos)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold text-[14px]
                      ${margenNeto >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatCOP(margenNeto)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Fila inferior: Top productos + Canales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Top 5 productos */}
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-[13.5px] font-bold text-primary">
                  Top 5 productos — {MESES[filtroMes - 1]}
                </h3>
              </div>
              {topProductos.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-primary-muted">
                  Sin datos en este período
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {topProductos.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-6 h-6 rounded-full bg-accent-light
                                       text-accent text-[12px] font-bold
                                       flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-primary truncate">
                          {p.producto}
                        </p>
                        <p className="text-[11.5px] text-primary-muted">
                          {formatNumber(p.unidades)} ud.
                        </p>
                      </div>
                      <span className="font-bold text-[13px] text-success shrink-0">
                        {formatCOP(p.ingresos)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ventas por canal */}
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-[13.5px] font-bold text-primary">
                  Ventas por canal — {MESES[filtroMes - 1]}
                </h3>
              </div>
              {canales.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-primary-muted">
                  Sin datos en este período
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {canales.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-primary truncate">
                          {c.canal ?? 'Sin canal'}
                        </p>
                        <p className="text-[11.5px] text-primary-muted">
                          {formatNumber(c.cantidad)} ventas
                          {c.comisiones > 0 && ` · comisiones ${formatCOP(c.comisiones)}`}
                        </p>
                      </div>
                      <span className="font-bold text-[13px] text-success shrink-0">
                        {formatCOP(c.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  )
}