import { useEffect, useState, useCallback } from 'react'
import { Search, Package, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { getStockCompleto } from '@/lib/queries'
import { formatCOP, formatNumber } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { StockItem } from '@/types'
import { cn } from '@/lib/utils'
import AjusteStockForm from './AjusteStockForm'
import MovimientosPanel from './MovimientosPanel'

interface ProductoStock {
  producto_id:      number
  producto_nombre:  string
  costo_unitario:   number | null
  tallas:           TallaStock[]
  totalStock:       number
  valorInventario:  number
}

interface TallaStock {
  talla_id:   number
  talla_nombre: string
  stock:      number
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
      talla_id:    item.talla_id,
      talla_nombre: item.talla_nombre,
      stock:       item.stock
    })
    prod.totalStock      += item.stock
    prod.valorInventario += item.stock * (item.costo_unitario ?? 0)
  }

  return Array.from(map.values())
}

export default function Inventario() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,   setLoading]   = useState(true)
  const [productos, setProductos] = useState<ProductoStock[]>([])
  const [busqueda,  setBusqueda]  = useState('')

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

  useEffect(() => { loadInventario() }, [loadInventario])

  const productosFiltrados = productos.filter(p =>
    !busqueda ||
    p.producto_nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Totales globales
  const totalUnidades = productosFiltrados.reduce((s, p) => s + p.totalStock, 0)
  const totalValor    = productosFiltrados.reduce((s, p) => s + p.valorInventario, 0)
  const totalAgotados = productosFiltrados.reduce((p, prod) =>
    p + prod.tallas.filter(t => t.stock === 0).length, 0)

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

  return (
    <div className="flex flex-col gap-5">

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
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Total unidades</p>
          <p className="text-[22px] font-bold text-primary-DEFAULT">
            {formatNumber(totalUnidades)}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Valor inventario</p>
          <p className="text-[22px] font-bold text-accent-DEFAULT">
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

      {/* Tabla */}
      {loading ? (
        <FullPageSpinner />
      ) : productosFiltrados.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin productos en inventario"
          description="Crea productos primero para ver su stock aquí."
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tbl">
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

                    {/* Nombre */}
                    <td>
                      <p className="font-semibold text-[13.5px] text-primary-DEFAULT">
                        {prod.producto_nombre}
                      </p>
                    </td>

                    {/* Tallas */}
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

                    {/* Total */}
                    <td className="text-right font-bold text-[14px]">
                      {formatNumber(prod.totalStock)}
                    </td>

                    {/* Costo */}
                    <td className="text-right text-[13px] text-primary-muted">
                      {prod.costo_unitario
                        ? formatCOP(prod.costo_unitario)
                        : '—'
                      }
                    </td>

                    {/* Valor */}
                    <td className="text-right font-semibold text-[13.5px]">
                      {prod.valorInventario > 0
                        ? formatCOP(prod.valorInventario)
                        : '—'
                      }
                    </td>

                    {/* Acciones */}
                    <td>
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleAjuste(prod)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg
                                     text-[12px] font-semibold
                                     bg-accent-light text-accent-DEFAULT
                                     hover:bg-accent-DEFAULT hover:text-white
                                     transition-colors"
                          title="Ajustar stock"
                        >
                          <ArrowUpCircle size={12} />
                          Ajustar
                        </button>
                        <button
                          onClick={() => handleMovimientos(prod)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg
                                     text-[12px] font-semibold
                                     bg-card border border-border text-primary-muted
                                     hover:text-primary-DEFAULT hover:border-accent-DEFAULT/40
                                     transition-colors"
                          title="Ver movimientos"
                        >
                          <ArrowDownCircle size={12} />
                          Historial
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
    </div>
  )
}