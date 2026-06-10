import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Package, ToggleLeft, ToggleRight } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { getProductos } from '@/lib/queries'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import ProductoCard from './ProductoCard'
import ProductoForm from './ProductoForm'

interface Producto {
  id:               number
  nombre:           string
  referencia:       string
  precio_venta:     number
  activo:           number
  coleccion_nombre: string | null
  imagen_url:       string | null
}

export default function Productos() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,      setLoading]      = useState(true)
  const [productos,    setProductos]    = useState<Producto[]>([])
  const [busqueda,     setBusqueda]     = useState('')
  const [soloActivos,  setSoloActivos]  = useState(true)

  const loadProductos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getProductos(soloActivos) as Producto[]
      setProductos(data)
    } catch {
      toast.error('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [soloActivos])

  useEffect(() => { loadProductos() }, [loadProductos])

  const productosFiltrados = productos.filter(p => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      p.nombre.toLowerCase().includes(q) ||
      p.referencia?.toLowerCase().includes(q) ||
      p.coleccion_nombre?.toLowerCase().includes(q)
    )
  })

  function handleNuevoProducto() {
    openModal(
      <ProductoForm
        onSuccess={() => { closeModal(); loadProductos() }}
        onCancel={closeModal}
      />,
    )
  }

  function handleEditarProducto(producto: Producto) {
    openModal(
      <ProductoForm
        producto={producto}
        onSuccess={() => { closeModal(); loadProductos() }}
        onCancel={closeModal}
      />
    )
  }

  async function handleToggleActivo(producto: Producto) {
    try {
      await window.electronAPI.db.run(
        `UPDATE productos SET activo = ?, updated_at = datetime('now') WHERE id = ?`,
        [producto.activo ? 0 : 1, producto.id]
      )
      toast.success(
        producto.activo
          ? `"${producto.nombre}" desactivado`
          : `"${producto.nombre}" activado`
      )
      loadProductos()
    } catch {
      toast.error('Error al actualizar producto')
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Barra de acciones */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-muted"
          />
          <input
            type="text"
            placeholder="Buscar por nombre, referencia o colección…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input pl-8 h-9 text-[13.5px]"
          />
        </div>

        {/* Toggle activos */}
        <button
          onClick={() => setSoloActivos(!soloActivos)}
          className="flex items-center gap-2 btn-ghost h-9 text-[13px]"
        >
          {soloActivos
            ? <ToggleRight size={16} className="text-accent" />
            : <ToggleLeft  size={16} className="text-primary-muted" />
          }
          {soloActivos ? 'Solo activos' : 'Todos'}
        </button>

        {/* Nuevo producto */}
        <button onClick={handleNuevoProducto} className="btn-primary h-9 text-[13px]">
          <Plus size={14} />
          Nuevo producto
        </button>
      </div>

      {/* Contador */}
      <p className="text-[13px] text-primary-muted -mt-2">
        {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
      </p>

      {/* Grid de productos */}
      {loading ? (
        <FullPageSpinner />
      ) : productosFiltrados.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin productos"
          description={
            busqueda
              ? 'No se encontraron productos con ese criterio.'
              : 'Aún no has registrado productos.'
          }
          action={
            !busqueda && (
              <button onClick={handleNuevoProducto} className="btn-primary">
                <Plus size={14} /> Nuevo producto
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {productosFiltrados.map(producto => (
            <ProductoCard
              key={producto.id}
              producto={producto}
              onEditar={() => handleEditarProducto(producto)}
              onToggleActivo={() => handleToggleActivo(producto)}
            />
          ))}
        </div>
      )}
    </div>
  )
}