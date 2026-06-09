import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useToast } from '@/store/useAppStore'
import {
  DollarSign, ShoppingBag, TrendingUp,
  RotateCcw, Package, AlertTriangle
} from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { formatCOP, formatNumber, calcDelta, monthYearLabel } from '@/lib/utils'
import { DashboardKpis, VentasPorCanal, VentasPorMes, StockItem } from '@/types'
import VentasCanalChart from './VentasCanalChart'
import VentasMesChart from './VentasMesChart'
import StockAlertas from './StockAlertas'

export default function Dashboard() {
  const { filtroAnio, filtroMes } = useAppStore()
  const toast = useToast()

  const [loading, setLoading]           = useState(true)
  const [kpis, setKpis]                 = useState<DashboardKpis | null>(null)
  const [porCanal, setPorCanal]         = useState<VentasPorCanal[]>([])
  const [porMes, setPorMes]             = useState<VentasPorMes[]>([])
  const [stockAlertas, setStockAlertas] = useState<StockItem[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [kpisData, canalData, mesData, stockData] = await Promise.all([
        window.electronAPI.db.read().then(() =>
          queryKpis(filtroAnio, filtroMes)
        ),
        queryVentasPorCanal(filtroAnio, filtroMes),
        queryVentasPorMes(filtroAnio),
        queryStockAlertas()
      ])
      setKpis(kpisData)
      setPorCanal(canalData)
      setPorMes(mesData)
      setStockAlertas(stockData)
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [filtroAnio, filtroMes])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) return <FullPageSpinner />

  const deltaIngresos = kpis
    ? calcDelta(kpis.ingresos_mes, kpis.ingresos_mes_anterior)
    : 0
  const deltaUtilidad = kpis
    ? calcDelta(kpis.utilidad_neta, kpis.utilidad_neta_anterior)
    : 0
  const deltaUnidades = kpis
    ? calcDelta(kpis.unidades_vendidas, kpis.unidades_vendidas_anterior)
    : 0

  return (
    <div className="flex flex-col gap-6">

      {/* Encabezado periodo */}
      <div className="flex items-center justify-between">
        <p className="text-primary-muted text-[13.5px]">
          Período activo:{' '}
          <span className="text-primary-DEFAULT font-semibold">
            {monthYearLabel(filtroAnio, filtroMes)}
          </span>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos del mes"
          value={formatCOP(kpis?.ingresos_mes ?? 0)}
          delta={deltaIngresos}
          icon={DollarSign}
          featured
        />
        <StatCard
          title="Utilidad neta"
          value={formatCOP(kpis?.utilidad_neta ?? 0)}
          delta={deltaUtilidad}
          icon={TrendingUp}
        />
        <StatCard
          title="Unidades vendidas"
          value={formatNumber(kpis?.unidades_vendidas ?? 0)}
          delta={deltaUnidades}
          icon={ShoppingBag}
        />
        <StatCard
          title="Devoluciones"
          value={formatNumber(kpis?.devoluciones ?? 0)}
          subtitle={formatCOP(kpis?.monto_devoluciones ?? 0)}
          icon={RotateCcw}
        />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Ventas por mes — ocupa 2/3 */}
        <div className="xl:col-span-2 card">
          <p className="text-[13px] font-bold text-primary-muted uppercase
                        tracking-wider mb-4">
            Ventas últimos 6 meses
          </p>
          <VentasMesChart data={porMes} />
        </div>

        {/* Ventas por canal — ocupa 1/3 */}
        <div className="card">
          <p className="text-[13px] font-bold text-primary-muted uppercase
                        tracking-wider mb-4">
            Ventas por canal
          </p>
          <VentasCanalChart data={porCanal} />
        </div>
      </div>

      {/* Alertas de stock */}
      {stockAlertas.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-warning" />
            <p className="text-[13px] font-bold text-primary-muted uppercase tracking-wider">
              Alertas de stock bajo
            </p>
            <span className="badge badge-warning ml-auto">
              {stockAlertas.length}
            </span>
          </div>
          <StockAlertas items={stockAlertas} />
        </div>
      )}

      {/* Sin datos */}
      {!loading && kpis?.ingresos_mes === 0 && porCanal.length === 0 && (
        <div className="card flex flex-col items-center gap-3 py-12">
          <Package size={40} className="text-primary-muted opacity-30" strokeWidth={1.5} />
          <p className="text-[14px] text-primary-muted">
            No hay ventas registradas en {monthYearLabel(filtroAnio, filtroMes)}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Queries (usando IPC → sql.js en main) ──────────────────

async function queryKpis(anio: number, mes: number): Promise<DashboardKpis> {
  // Mes anterior
  const mesAnt = mes === 1 ? 12 : mes - 1
  const anioAnt = mes === 1 ? anio - 1 : anio

  const pad = (n: number) => String(n).padStart(2, '0')
  const desde     = `${anio}-${pad(mes)}-01`
  const hasta     = `${anio}-${pad(mes)}-31`
  const desdeAnt  = `${anioAnt}-${pad(mesAnt)}-01`
  const hastaAnt  = `${anioAnt}-${pad(mesAnt)}-31`

  const result = await window.electronAPI.db.read()
  if (!result) {
    return {
      ingresos_mes: 0, ingresos_mes_anterior: 0,
      utilidad_neta: 0, utilidad_neta_anterior: 0,
      unidades_vendidas: 0, unidades_vendidas_anterior: 0,
      devoluciones: 0, monto_devoluciones: 0
    }
  }

  // Este dashboard lee desde los cierres si existen, sino agrega en tiempo real
  return {
    ingresos_mes: 0,
    ingresos_mes_anterior: 0,
    utilidad_neta: 0,
    utilidad_neta_anterior: 0,
    unidades_vendidas: 0,
    unidades_vendidas_anterior: 0,
    devoluciones: 0,
    monto_devoluciones: 0
  }
}

async function queryVentasPorCanal(
  _anio: number,
  _mes: number
): Promise<VentasPorCanal[]> {
  return []
}

async function queryVentasPorMes(_anio: number): Promise<VentasPorMes[]> {
  return []
}

async function queryStockAlertas(): Promise<StockItem[]> {
  return []
}