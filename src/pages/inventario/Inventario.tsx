import { useEffect, useState, useCallback } from 'react'
import {
  Search, Package, ArrowUpCircle, ArrowDownCircle, RefreshCw,
  ClipboardCheck, Layers, AlertTriangle, History, Download
} from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { getStockCompleto } from '@/lib/queries'
import { formatCOP, formatNumber, objectsToCSV } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { StockItem } from '@/types'
import { cn } from '@/lib/utils'
import AjusteStockForm from './AjusteStockForm'
import MovimientosPanel from './MovimientosPanel'
import ReconciliacionForm from './ReconciliacionForm'
import InsumoMovimientosPanel from './InsumoMovimientosPanel'

interface ProductoStock {
  producto_id:      number
  producto_nombre:  string
  costo_unitario:   number | null
  tallas:           TallaStock[]
  totalStock:       number
  valorInventario:  number
}

interface TallaStock {
  talla_id:     number
  talla_nombre: string
  stock:        number
}

interface InsumoStock {
  id:               number
  nombre:           string
  unidad:           string
  stock_minimo:     number
  stock_actual:     number
  categoria_nombre: string | null
  categoria_color:  string | null
}

interface InventarioProps {
  onVerProductos?: () => void
}

function agruparPorProducto(items: StockItem[]): ProductoStock[] {
  const map = new Map<number, ProductoStock>()

  for (const item of items) {
    if (!map.has(item.producto_id)) {
      map.set(item.producto_id, {
        producto_id:     item.producto_id,
        producto_nombre: item.producto_nombre,
        costo_unitario:  item.costo_unitario ?? null,
        tallas:          [],
        totalStock:      0,
        valorInventario: 0
      })
    }
    const prod = map.get(item.producto_id)!
    prod.tallas.push({
      talla_id:     item.talla_id,
      talla_nombre: item.talla_nombre,
      stock:        item.stock
    })
    prod.totalStock      += item.stock
    prod.valorInventario += item.stock * (item.costo_unitario ?? 0)
  }

  return Array.from(map.values())
}

type Tab = 'productos' | 'insumos'

export default function Inventario({ onVerProductos }: InventarioProps) {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [tab,       setTab]       = useState<Tab>('productos')
  const [loading,   setLoading]   = useState(true)
  const [productos, setProductos] = useState<ProductoStock[]>([])
  const [busqueda,  setBusqueda]  = useState('')

  // ── Insumos state ───────────────────────────────────────────────────────
  const [loadingIns, setLoadingIns] = useState(false)
  const [insumos,    setInsumos]    = useState<InsumoStock[]>([])
  const [busquedaIns, setBusquedaIns] = useState('')

  const loadInventario = useCallback(async () => {
    setLoading(true)
    try {
      const items = await getStockCompleto()
      setProductos(agruparPorProducto(items))
    } catch {
      toast.error('Error al cargar inventario')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadInsumos = useCallback(async () => {
    setLoadingIns(true)
    try {
      const data = await window.electronAPI.db.query<InsumoStock>(
        `SELECT
           i.id, i.nombre, i.unidad, i.stock_minimo,
           ci.nombre AS categoria_nombre,
           ci.color  AS categoria_color,
           COALESCE((
             SELECT SUM(CASE tipo
               WHEN 'entrada_compra'        THEN cantidad
               WHEN 'salida_produccion'     THEN -cantidad
               WHEN 'ajuste_manual'         THEN cantidad
               WHEN 'ajuste_reconciliacion' THEN cantidad
               ELSE 0
             END)
             FROM movimientos_insumos
             WHERE insumo_id = i.id
           ), 0) AS stock_actual
         FROM insumos i
         LEFT JOIN categorias_insumo ci ON ci.id = i.categoria_id
         WHERE i.activo = 1
         ORDER BY i.nombre ASC`
      )
      setInsumos(data)
    } catch {
      toast.error('Error al cargar insumos')
    } finally {
      setLoadingIns(false)
    }
  }, [])

  useEffect(() => { loadInventario() }, [loadInventario])
  useEffect(() => { if (tab === 'insumos') loadInsumos() }, [tab, loadInsumos])

  const productosFiltrados = productos.filter(p =>
    !busqueda ||
    p.producto_nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Totales globales
  const totalProductos = productosFiltrados.length
  const totalUnidades  = productosFiltrados.reduce((s, p) => s + p.totalStock, 0)
  const totalValor     = productosFiltrados.reduce((s, p) => s + p.valorInventario, 0)
  const totalAgotados  = productosFiltrados.reduce((acc, prod) =>
    acc + prod.tallas.filter(t => t.stock === 0).length, 0)

  function handleExportarInventario() {
    if (productosFiltrados.length === 0) {
      toast.warning('No hay datos para exportar')
      return
    }
    const rows: Record<string, unknown>[] = []
    for (const prod of productosFiltrados) {
      for (const t of prod.tallas) {
        rows.push({
          Producto:      prod.producto_nombre,
          Talla:         t.talla_nombre,
          Stock:         t.stock,
          'Costo unit.': prod.costo_unitario ?? 0,
          'Valor total': t.stock * (prod.costo_unitario ?? 0),
        })
      }
    }
    const csv  = objectsToCSV(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Inventario exportado')
  }

  function handleAjuste(producto: ProductoStock) {
    openModal(
      <AjusteStockForm
        producto={producto}
        onSuccess={() => { closeModal(); loadInventario() }}
        onCancel={closeModal}
      />
    )
  }

  function handleMovimientos(producto: ProductoStock) {
    openModal(
      <MovimientosPanel
        productoId={producto.producto_id}
        productoNombre={producto.producto_nombre}
        onClose={closeModal}
      />
    )
  }

  function handleReconciliar(producto: ProductoStock) {
    openModal(
      <ReconciliacionForm
        producto={producto}
        onSuccess={() => { closeModal(); loadInventario() }}
        onCancel={closeModal}
      />
    )
  }

  function handleMovimientosInsumo(insumo: InsumoStock) {
    openModal(
      <InsumoMovimientosPanel
        insumoId={insumo.id}
        insumoNombre={insumo.nombre}
        unidad={insumo.unidad}
        onClose={closeModal}
      />
    )
  }

  // ── Insumos filtrados ────────────────────────────────────────────────────
  const insumosFiltrados = insumos.filter(i =>
    !busquedaIns ||
    i.nombre.toLowerCase().includes(busquedaIns.toLowerCase())
  )
  const insumosConAlerta = insumos.filter(i => i.stock_actual <= i.stock_minimo).length

  return (
    <div className="flex flex-col gap-5">

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card border border-border
                      rounded-xl p-1 self-start">
        <button
          onClick={() => setTab('productos')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold',
            'transition-colors',
            tab === 'productos'
              ? 'bg-accent-light text-accent'
              : 'text-primary-muted hover:text-primary'
          )}
        >
          <Package size={14} />
          Productos
        </button>
        <button
          onClick={() => setTab('insumos')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold',
            'transition-colors relative',
            tab === 'insumos'
              ? 'bg-accent-light text-accent'
              : 'text-primary-muted hover:text-primary'
          )}
        >
          <Layers size={14} />
          Insumos
          {insumosConAlerta > 0 && tab !== 'insumos' && (
            <span className="w-4 h-4 rounded-full bg-danger text-white
                             text-[10px] font-bold flex items-center justify-center">
              {insumosConAlerta}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB PRODUCTOS ─────────────────────────────────────────────────── */}
      {tab === 'productos' && (
        <>
          {/* Barra de acciones */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-muted"
              />
              <input
                type="text"
                placeholder="Buscar producto…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="input pl-8 h-9 text-[13.5px]"
              />
            </div>
            <button
              onClick={loadInventario}
              className="btn-ghost h-9 text-[13px]"
              title="Recargar"
            >
              <RefreshCw size={14} />
              Recargar
            </button>
            <button
              onClick={handleExportarInventario}
              className="btn-ghost h-9 text-[13px]"
              title="Exportar CSV"
            >
              <Download size={14} />
              CSV
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <div className="card py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider
                            text-primary-muted mb-1">Total productos</p>
              <p className="text-[22px] font-bold text-primary">
                {formatNumber(totalProductos)}
              </p>
            </div>
            <div className="card py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider
                            text-primary-muted mb-1">Total unidades</p>
              <p className="text-[22px] font-bold text-primary">
                {formatNumber(totalUnidades)}
              </p>
            </div>
            <div className="card py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider
                            text-primary-muted mb-1">Valor inventario</p>
              <p className="text-[22px] font-bold text-accent">
                {formatCOP(totalValor)}
              </p>
            </div>
            <div className="card py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider
                            text-primary-muted mb-1">Tallas agotadas</p>
              <p className={cn(
                'text-[22px] font-bold',
                totalAgotados > 0 ? 'text-danger' : 'text-success'
              )}>
                {totalAgotados}
              </p>
            </div>
          </div>

          {/* Tabla productos */}
          {loading ? (
            <FullPageSpinner />
          ) : productosFiltrados.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Sin productos en inventario"
              description="Crea productos primero para ver su stock aquí."
              action={
                onVerProductos && (
                  <button onClick={onVerProductos} className="btn-primary">
                    <Package size={14} /> Ir a Productos
                  </button>
                )
              }
            />
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Tallas / Stock</th>
                      <th className="text-right">Total ud.</th>
                      <th className="text-right">Costo unit.</th>
                      <th className="text-right">Valor total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.map(prod => (
                      <tr key={prod.producto_id}>

                        <td>
                          <p className="font-semibold text-[13.5px] text-primary">
                            {prod.producto_nombre}
                          </p>
                        </td>

                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {prod.tallas.map(t => (
                              <div
                                key={t.talla_id}
                                className={cn(
                                  'flex items-center gap-1 px-2 py-0.5 rounded-lg',
                                  'text-[12px] font-semibold border',
                                  t.stock === 0
                                    ? 'bg-danger/10 border-danger/20 text-danger'
                                    : t.stock <= 2
                                      ? 'bg-warning/10 border-warning/20 text-warning'
                                      : 'bg-success/10 border-success/20 text-success'
                                )}
                              >
                                <span className="text-primary-muted">{t.talla_nombre}</span>
                                <span>{t.stock}</span>
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="text-right font-bold text-[14px]">
                          {formatNumber(prod.totalStock)}
                        </td>

                        <td className="text-right text-[13px] text-primary-muted">
                          {prod.costo_unitario ? formatCOP(prod.costo_unitario) : '—'}
                        </td>

                        <td className="text-right font-semibold text-[13.5px]">
                          {prod.valorInventario > 0 ? formatCOP(prod.valorInventario) : '—'}
                        </td>

                        <td>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => handleAjuste(prod)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg
                                         text-[12px] font-semibold
                                         bg-accent-light text-accent
                                         hover:bg-accent hover:text-white
                                         transition-colors"
                              title="Ajustar stock"
                            >
                              <ArrowUpCircle size={12} />
                              Ajustar
                            </button>
                            <button
                              onClick={() => handleReconciliar(prod)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg
                                         text-[12px] font-semibold
                                         bg-card border border-border text-primary-muted
                                         hover:text-accent hover:border-accent/40
                                         transition-colors"
                              title="Reconciliación física"
                            >
                              <ClipboardCheck size={12} />
                              Reconciliar
                            </button>
                            <button
                              onClick={() => handleMovimientos(prod)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg
                                         text-[12px] font-semibold
                                         bg-card border border-border text-primary-muted
                                         hover:text-primary hover:border-accent/40
                                         transition-colors"
                              title="Ver movimientos"
                            >
                              <History size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB INSUMOS ───────────────────────────────────────────────────── */}
      {tab === 'insumos' && (
        <>
          {/* Barra */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-muted"
              />
              <input
                type="text"
                placeholder="Buscar insumo…"
                value={busquedaIns}
                onChange={e => setBusquedaIns(e.target.value)}
                className="input pl-8 h-9 text-[13.5px]"
              />
            </div>
            <button
              onClick={loadInsumos}
              className="btn-ghost h-9 text-[13px]"
            >
              <RefreshCw size={14} />
              Recargar
            </button>
          </div>

          {/* Alerta stock bajo */}
          {insumosConAlerta > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                            border border-warning/20 bg-warning/5">
              <AlertTriangle size={14} className="text-warning shrink-0" />
              <p className="text-[12.5px] text-warning">
                <strong>{insumosConAlerta}</strong> insumo{insumosConAlerta > 1 ? 's' : ''} con
                stock igual o por debajo del mínimo
              </p>
            </div>
          )}

          {/* Tabla insumos */}
          {loadingIns ? (
            <FullPageSpinner />
          ) : insumosFiltrados.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Sin insumos"
              description="Registrá insumos desde la sección Administración."
            />
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th>Categoría</th>
                      <th className="text-right">Stock actual</th>
                      <th className="text-right">Stock mínimo</th>
                      <th className="text-center">Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {insumosFiltrados.map(ins => {
                      const bajo = ins.stock_actual <= ins.stock_minimo
                      return (
                        <tr key={ins.id}>
                          <td>
                            <p className="font-semibold text-[13.5px] text-primary">
                              {ins.nombre}
                            </p>
                          </td>

                          <td>
                            {ins.categoria_nombre ? (
                              <span
                                className="px-2 py-0.5 rounded-full text-[11.5px]
                                           font-semibold border"
                                style={{
                                  color:            ins.categoria_color ?? undefined,
                                  borderColor:      `${ins.categoria_color}40`,
                                  backgroundColor:  `${ins.categoria_color}18`
                                }}
                              >
                                {ins.categoria_nombre}
                              </span>
                            ) : (
                              <span className="text-[12px] text-primary-muted">—</span>
                            )}
                          </td>

                          <td className="text-right">
                            <span className={cn(
                              'text-[14px] font-bold',
                              bajo ? 'text-danger' : 'text-primary'
                            )}>
                              {formatNumber(ins.stock_actual)}
                            </span>
                            <span className="text-[11px] text-primary-muted ml-1">
                              {ins.unidad}
                            </span>
                          </td>

                          <td className="text-right text-[13px] text-primary-muted">
                            {formatNumber(ins.stock_minimo)} {ins.unidad}
                          </td>

                          <td className="text-center">
                            {bajo ? (
                              <span className="inline-flex items-center gap-1
                                               px-2 py-0.5 rounded-full text-[11.5px]
                                               font-semibold border
                                               border-danger/20 bg-danger/10 text-danger">
                                <AlertTriangle size={11} />
                                Stock bajo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1
                                               px-2 py-0.5 rounded-full text-[11.5px]
                                               font-semibold border
                                               border-success/20 bg-success/10 text-success">
                                OK
                              </span>
                            )}
                          </td>

                          <td>
                            <button
                              onClick={() => handleMovimientosInsumo(ins)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg
                                         text-[12px] font-semibold
                                         bg-card border border-border text-primary-muted
                                         hover:text-primary hover:border-accent/40
                                         transition-colors"
                              title="Ver movimientos"
                            >
                              <History size={12} />
                              Historial
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}