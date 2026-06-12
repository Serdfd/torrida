import { useEffect, useState, useCallback } from 'react'
import { useAppStore, useToast }            from '@/store/useAppStore'
import {
  DollarSign, ShoppingBag, TrendingUp,
  RotateCcw, Package, AlertTriangle,
  Percent, Truck, Receipt
} from 'lucide-react'
import StatCard               from '@/components/ui/StatCard'
import { FullPageSpinner }    from '@/components/ui/Spinner'
import {
  formatCOP, formatNumber, calcDelta, monthYearLabel
} from '@/lib/utils'
import {
  getDashboardKpis as _getDashboardKpis,
  getVentasPorDepartamento,
  getVentasPorCiudad,
  getVentasPorMedioPago,
  getUnidadesPorMes,
  getTopProductos,
  getTallasMasVendidas,
  getGastosPorCategoria,
  getEnviosPendientes
} from '@/lib/queries'
import VentasCanalChart    from './VentasCanalChart'
import VentasMesChart      from './VentasMesChart'
import VentasGeoChart      from './VentasGeoChart'
import type { VentasGeo }       from './VentasGeoChart'
import VentasMedioChart    from './VentasMedioChart'
import type { VentasPorMedio }  from './VentasMedioChart'
import UnidadesMesChart    from './UnidadesMesChart'
import type { UnidadesPorMes }  from './UnidadesMesChart'
import TopProductosChart   from './TopProductosChart'
import type { TopProducto }     from './TopProductosChart'
import TallasMasVendidasChart from './TallasMasVendidasChart'
import type { TallaVendida }    from './TallasMasVendidasChart'
import GastosCategoriaChart from './GastosCategoriaChart'
import type { GastoCategoria }  from './GastosCategoriaChart'
import StockAlertas        from './StockAlertas'
import type { PageId }  from '@/App'

// ── Tipos locales ──────────────────────────────────────────────────────────

interface DashboardKpis {
  ingresos_mes:               number
  ingresos_mes_anterior:      number
  utilidad_bruta:             number
  utilidad_bruta_anterior:    number
  utilidad_neta:              number
  utilidad_neta_anterior:     number
  unidades_vendidas:          number
  unidades_vendidas_anterior: number
  gastos_mes:                 number
  devoluciones:               number
  envios_pendientes:          number
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
  const [porDepto,     setPorDepto]     = useState<VentasGeo[]>([])
  const [porCiudad,    setPorCiudad]    = useState<VentasGeo[]>([])
  const [porMedio,     setPorMedio]     = useState<VentasPorMedio[]>([])
  const [uniMes,       setUniMes]       = useState<UnidadesPorMes[]>([])
  const [topProductos, setTopProductos] = useState<TopProducto[]>([])
  const [tallas,       setTallas]       = useState<TallaVendida[]>([])
  const [gastosCat,    setGastosCat]    = useState<GastoCategoria[]>([])
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
        itemsMes, uniMesData, uniAntData,
        utilBrutaMes, utilBrutaAnt,
        canalData, mesData, deptoData, ciudadData, medioData, uniMesChart,
        topProdData, tallasData, gastosCatData, envPendData, stockBajo
      ] = await Promise.all([

        // Ingresos mes actual
        window.electronAPI.db.query<{ total: number }>(
          `SELECT COALESCE(SUM(total),0) AS total
           FROM ventas
           WHERE strftime('%Y-%m', fecha) = ?
             AND estado != 'cancelado'`,
          [periodo]
        ),

        // Ingresos mes anterior
        window.electronAPI.db.query<{ total: number }>(
          `SELECT COALESCE(SUM(total),0) AS total
           FROM ventas
           WHERE strftime('%Y-%m', fecha) = ?
             AND estado != 'cancelado'`,
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

        // Unidades vendidas mes actual
        window.electronAPI.db.query<{ unidades: number }>(
          `SELECT COALESCE(SUM(vi.cantidad),0) AS unidades
           FROM venta_items vi
           JOIN ventas v ON v.id = vi.venta_id
           WHERE strftime('%Y-%m', v.fecha) = ?
             AND v.estado != 'cancelado'`,
          [periodo]
        ),

        // Unidades vendidas mes anterior
        window.electronAPI.db.query<{ unidades: number }>(
          `SELECT COALESCE(SUM(vi.cantidad),0) AS unidades
           FROM venta_items vi
           JOIN ventas v ON v.id = vi.venta_id
           WHERE strftime('%Y-%m', v.fecha) = ?
             AND v.estado != 'cancelado'`,
          [periodoAnt]
        ),

        // Utilidad bruta mes actual (suma utilidad_item)
        window.electronAPI.db.query<{ utilidad: number }>(
          `SELECT COALESCE(SUM(vi.utilidad_item),0) AS utilidad
           FROM venta_items vi
           JOIN ventas v ON v.id = vi.venta_id
           WHERE strftime('%Y-%m', v.fecha) = ?
             AND v.estado != 'cancelado'`,
          [periodo]
        ),

        // Utilidad bruta mes anterior
        window.electronAPI.db.query<{ utilidad: number }>(
          `SELECT COALESCE(SUM(vi.utilidad_item),0) AS utilidad
           FROM venta_items vi
           JOIN ventas v ON v.id = vi.venta_id
           WHERE strftime('%Y-%m', v.fecha) = ?
             AND v.estado != 'cancelado'`,
          [periodoAnt]
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

        // Ventas por departamento
        getVentasPorDepartamento(filtroAnio, filtroMes),

        // Ventas por ciudad
        getVentasPorCiudad(filtroAnio, filtroMes),

        // Ventas por medio de pago
        getVentasPorMedioPago(filtroAnio, filtroMes),

        // Unidades vendidas últimos 6 meses
        getUnidadesPorMes(),

        // Top 5 productos
        getTopProductos(filtroAnio, filtroMes),

        // Tallas más vendidas
        getTallasMasVendidas(filtroAnio, filtroMes),

        // Gastos por categoría
        getGastosPorCategoria(filtroAnio, filtroMes),

        // Envíos pendientes
        getEnviosPendientes(filtroAnio, filtroMes),

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
        ),
      ])

      const ingMes    = ventasMes[0]?.total       ?? 0
      const ingAnt    = ventasAnt[0]?.total       ?? 0
      const uniMes    = uniMesData[0]?.unidades   ?? 0
      const uniAnt    = uniAntData[0]?.unidades   ?? 0
      const gastos    = gastosMes[0]?.total       ?? 0
      const utiBruta  = utilBrutaMes[0]?.utilidad ?? 0
      const utiBrutaAnt = utilBrutaAnt[0]?.utilidad ?? 0

      setKpis({
        ingresos_mes:               ingMes,
        ingresos_mes_anterior:      ingAnt,
        utilidad_bruta:             utiBruta,
        utilidad_bruta_anterior:    utiBrutaAnt,
        utilidad_neta:              utiBruta - gastos,
        utilidad_neta_anterior:     utiBrutaAnt,
        unidades_vendidas:          uniMes,
        unidades_vendidas_anterior: uniAnt,
        gastos_mes:                 gastos,
        devoluciones:               itemsMes[0]?.devoluciones ?? 0,
        envios_pendientes:          (envPendData as any)[0]?.total ?? 0,
      })

      setPorCanal(canalData)
      setPorMes(mesData)
      setPorDepto(deptoData as unknown as VentasGeo[])
      setPorCiudad(ciudadData as unknown as VentasGeo[])
      setPorMedio(medioData as unknown as VentasPorMedio[])
      setUniMes(uniMesChart as unknown as UnidadesPorMes[])
      setTopProductos(topProdData as unknown as TopProducto[])
      setTallas(tallasData as unknown as TallaVendida[])
      setGastosCat(gastosCatData as unknown as GastoCategoria[])
      setStockAlertas(stockBajo as unknown as StockAlerta[])

    } catch (err) {
      console.error(err)
      toast.error('Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [filtroAnio, filtroMes])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <FullPageSpinner />

  const deltaIngresos   = calcDelta(kpis?.ingresos_mes    ?? 0, kpis?.ingresos_mes_anterior    ?? 0)
  const deltaUtilBruta  = calcDelta(kpis?.utilidad_bruta  ?? 0, kpis?.utilidad_bruta_anterior  ?? 0)
  const deltaUtilidad   = calcDelta(kpis?.utilidad_neta   ?? 0, kpis?.utilidad_neta_anterior   ?? 0)
  const deltaUnidades   = calcDelta(kpis?.unidades_vendidas ?? 0, kpis?.unidades_vendidas_anterior ?? 0)

  const margenPct = kpis && kpis.ingresos_mes > 0
    ? (kpis.utilidad_bruta / kpis.ingresos_mes) * 100
    : 0

  return (
    <div className="flex flex-col gap-6">

      {/* Período */}
      <div className="flex items-center justify-between">
        <p className="text-primary-muted text-base">
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

      {/* KPIs — fila 1 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos brutos"
          value={formatCOP(kpis?.ingresos_mes ?? 0)}
          delta={deltaIngresos}
          icon={DollarSign}
          featured
        />
        <StatCard
          title="Utilidad bruta"
          value={formatCOP(kpis?.utilidad_bruta ?? 0)}
          delta={deltaUtilBruta}
          icon={TrendingUp}
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
      </div>

      {/* KPIs — fila 2 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Margen bruto"
          value={`${margenPct.toFixed(1)}%`}
          icon={Percent}
        />
        <StatCard
          title="Envíos pendientes"
          value={formatNumber(kpis?.envios_pendientes ?? 0)}
          icon={Truck}
          featured={( kpis?.envios_pendientes ?? 0) > 0}
        />
        <StatCard
          title="Gastos del mes"
          value={formatCOP(kpis?.gastos_mes ?? 0)}
          icon={Receipt}
        />
        <StatCard
          title="Canceladas"
          value={formatNumber(kpis?.devoluciones ?? 0)}
          icon={RotateCcw}
        />
      </div>

      {/* Gráficas de área — ventas e unidades en la misma fila */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <p className="section-title">Ventas últimos 6 meses</p>
          <VentasMesChart data={porMes} />
        </div>
        <div className="card">
          <p className="section-title">Unidades vendidas últimos 6 meses</p>
          <UnidadesMesChart data={uniMes} />
        </div>
      </div>

      {/* Donas — distribución geográfica, canales, medios de pago */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card">
          <p className="section-title">Distribución geográfica</p>
          <VentasGeoChart porDepartamento={porDepto} porCiudad={porCiudad} />
        </div>
        <div className="card">
          <p className="section-title">Ventas por canal</p>
          <VentasCanalChart data={porCanal} />
        </div>
        <div className="card">
          <p className="section-title">Medios de pago</p>
          <VentasMedioChart data={porMedio} />
        </div>
      </div>

      {/* Top productos + tallas + gastos por categoría */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card">
          <p className="section-title">Top 5 productos</p>
          <TopProductosChart data={topProductos} />
        </div>
        <div className="card">
          <p className="section-title">Tallas más vendidas</p>
          <TallasMasVendidasChart data={tallas} />
        </div>
        <div className="card">
          <p className="section-title">Gastos por categoría</p>
          <GastosCategoriaChart data={gastosCat} />
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
          <p className="text-md text-primary-muted">
            No hay ventas registradas en {monthYearLabel(filtroAnio, filtroMes)}
          </p>
        </div>
      )}

    </div>
  )
}