import { useEffect, useState, useCallback } from 'react'
import { useAppStore, useToast }            from '@/store/useAppStore'
import {
  DollarSign, ShoppingBag, TrendingUp,
  RotateCcw, Package, AlertTriangle
} from 'lucide-react'
import StatCard               from '@/components/ui/StatCard'
import { FullPageSpinner }    from '@/components/ui/Spinner'
import {
  formatCOP, formatNumber, calcDelta, monthYearLabel
} from '@/lib/utils'
import VentasCanalChart from './VentasCanalChart'
import VentasMesChart   from './VentasMesChart'
import StockAlertas     from './StockAlertas'
import type { PageId }  from '@/App'

// ── Tipos locales ──────────────────────────────────────────────────────────

interface DashboardKpis {
  ingresos_mes:              number
  ingresos_mes_anterior:     number
  utilidad_neta:             number
  utilidad_neta_anterior:    number
  unidades_vendidas:         number
  unidades_vendidas_anterior: number
  gastos_mes:                number
  devoluciones:              number
}

export interface VentasPorCanal {
  canal:    string
  total:    number
  cantidad: number
}

export interface VentasPorMes {
  mes:      string
  ingresos: number
  cantidad: number
}

interface StockAlerta {
  producto_id:     number
  producto_nombre: string
  talla_nombre:    string
  stock:           number
}

interface DashboardProps {
  onNavigate: (page: PageId) => void
}

// ── Componente ─────────────────────────────────────────────────────────────

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { filtroAnio, filtroMes } = useAppStore()
  const toast = useToast()

  const [loading,      setLoading]      = useState(true)
  const [kpis,         setKpis]         = useState<DashboardKpis | null>(null)
  const [porCanal,     setPorCanal]     = useState<VentasPorCanal[]>([])
  const [porMes,       setPorMes]       = useState<VentasPorMes[]>([])
  const [stockAlertas, setStockAlertas] = useState<StockAlerta[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const pad     = (n: number) => String(n).padStart(2, '0')
      const periodo = `${filtroAnio}-${pad(filtroMes)}`

      const mesAnt  = filtroMes  === 1 ? 12          : filtroMes  - 1
      const anioAnt = filtroMes  === 1 ? filtroAnio - 1 : filtroAnio
      const periodoAnt = `${anioAnt}-${pad(mesAnt)}`

      const [
        ventasMes, ventasAnt, gastosMes,
        itemsMes,  canalData, mesData, stockBajo
      ] = await Promise.all([

        // Ingresos y unidades mes actual
        window.electronAPI.db.query<{ total: number; unidades: number }>(
          `SELECT COALESCE(SUM(total),0) AS total,
                  COALESCE(SUM(vi.cantidad),0) AS unidades
           FROM ventas v
           LEFT JOIN venta_items vi ON vi.venta_id = v.id
           WHERE strftime('%Y-%m', v.fecha) = ?
             AND v.estado != 'cancelado'`,
          [periodo]
        ),

        // Ingresos y unidades mes anterior
        window.electronAPI.db.query<{ total: number; unidades: number }>(
          `SELECT COALESCE(SUM(total),0) AS total,
                  COALESCE(SUM(vi.cantidad),0) AS unidades
           FROM ventas v
           LEFT JOIN venta_items vi ON vi.venta_id = v.id
           WHERE strftime('%Y-%m', v.fecha) = ?
             AND v.estado != 'cancelado'`,
          [periodoAnt]
        ),

        // Gastos mes actual
        window.electronAPI.db.query<{ total: number }>(
          `SELECT COALESCE(SUM(monto),0) AS total
           FROM gastos
           WHERE strftime('%Y-%m', fecha) = ?`,
          [periodo]
        ),

        // Devoluciones (canceladas)
        window.electronAPI.db.query<{ devoluciones: number }>(
          `SELECT COUNT(*) AS devoluciones FROM ventas
           WHERE strftime('%Y-%m', fecha) = ?
             AND estado = 'cancelado'`,
          [periodo]
        ),

        // Ventas por canal
        window.electronAPI.db.query<VentasPorCanal>(
          `SELECT COALESCE(c.nombre,'Sin canal') AS canal,
                  COALESCE(SUM(v.total),0)       AS total,
                  COUNT(v.id)                    AS cantidad
           FROM ventas v
           LEFT JOIN canales_venta c ON c.id = v.canal_id
           WHERE strftime('%Y-%m', v.fecha) = ?
             AND v.estado != 'cancelado'
           GROUP BY canal ORDER BY total DESC`,
          [periodo]
        ),

        // Ventas últimos 6 meses
        window.electronAPI.db.query<VentasPorMes>(
          `SELECT strftime('%Y-%m', fecha) AS mes,
                  COALESCE(SUM(total),0)   AS ingresos,
                  COUNT(id)                AS cantidad
           FROM ventas
           WHERE fecha >= date('now','-6 months')
             AND estado != 'cancelado'
           GROUP BY mes ORDER BY mes ASC`
        ),

        // Stock bajo (≤ 2)
        window.electronAPI.db.query<StockAlerta>(
          `SELECT ip.producto_id, p.nombre AS producto_nombre,
                  t.nombre AS talla_nombre, ip.stock
           FROM inventario_productos ip
           JOIN productos p ON p.id = ip.producto_id
           JOIN tallas    t ON t.id = ip.talla_id
           WHERE ip.stock <= 2 AND p.activo = 1
           ORDER BY ip.stock ASC, p.nombre ASC
           LIMIT 20`
        )
      ])

      const ingMes  = ventasMes[0]?.total    ?? 0
      const ingAnt  = ventasAnt[0]?.total    ?? 0
      const uniMes  = ventasMes[0]?.unidades ?? 0
      const uniAnt  = ventasAnt[0]?.unidades ?? 0
      const gastos  = gastosMes[0]?.total    ?? 0

      setKpis({
        ingresos_mes:               ingMes,
        ingresos_mes_anterior:      ingAnt,
        utilidad_neta:              ingMes - gastos,
        utilidad_neta_anterior:     ingAnt,
        unidades_vendidas:          uniMes,
        unidades_vendidas_anterior: uniAnt,
        gastos_mes:                 gastos,
        devoluciones:               itemsMes[0]?.devoluciones ?? 0
      })

      setPorCanal(canalData)
      setPorMes(mesData)
      setStockAlertas(stockBajo)

    } catch (err) {
      console.error(err)
      toast.error('Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [filtroAnio, filtroMes])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <FullPageSpinner />

  const deltaIngresos  = calcDelta(kpis?.ingresos_mes ?? 0,  kpis?.ingresos_mes_anterior ?? 0)
  const deltaUtilidad  = calcDelta(kpis?.utilidad_neta ?? 0, kpis?.utilidad_neta_anterior ?? 0)
  const deltaUnidades  = calcDelta(kpis?.unidades_vendidas ?? 0, kpis?.unidades_vendidas_anterior ?? 0)

  return (
    <div className="flex flex-col gap-6">

      {/* Período */}
      <div className="flex items-center justify-between">
        <p className="text-primary-muted text-[13.5px]">
          Período activo:{' '}
          <span className="text-primary font-semibold">
            {monthYearLabel(filtroAnio, filtroMes)}
          </span>
        </p>
        <button
          onClick={() => onNavigate('nueva-venta')}
          className="btn-primary px-3"
        >
          + Nueva venta
        </button>
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
          icon={RotateCcw}
        />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card">
          <p className="section-title">Ventas últimos 6 meses</p>
          <VentasMesChart data={porMes} />
        </div>
        <div className="card">
          <p className="section-title">Ventas por canal</p>
          <VentasCanalChart data={porCanal} />
        </div>
      </div>

      {/* Alertas stock */}
      {stockAlertas.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-warning" />
            <p className="section-title mb-0">Alertas de stock bajo</p>
            <span className="badge badge-warning ml-auto">{stockAlertas.length}</span>
          </div>
          <StockAlertas items={stockAlertas} />
        </div>
      )}

      {/* Sin datos */}
      {!loading && (kpis?.ingresos_mes ?? 0) === 0 && porCanal.length === 0 && (
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