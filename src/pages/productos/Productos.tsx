import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Package } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { getProductos } from '@/lib/queries'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import ProductoCard from './ProductoCard'
import ProductoForm from './ProductoForm'
import FichaCostoPanel from './FichaCostoPanel'

type ProductoEstado = 'borrador' | 'en_produccion' | 'activo' | 'descontinuado'

const ESTADO_BADGE: Record<ProductoEstado, { label: string; color: string }> = {
  borrador:      { label: 'Borrador',       color: 'text-primary-muted border-border' },
  en_produccion: { label: 'En producción', color: 'text-warning border-warning/40'    },
  activo:        { label: 'Activo',          color: 'text-success border-success/40'   },
  descontinuado: { label: 'Descontinuado',   color: 'text-danger border-danger/40'     },
}

const FILTROS_ESTADO: { value: string; label: string }[] = [
  { value: '',              label: 'Todos'          },
  { value: 'borrador',      label: 'Borrador'       },
  { value: 'en_produccion', label: 'En producción'  },
  { value: 'activo',        label: 'Activos'        },
  { value: 'descontinuado', label: 'Descontinuados' },
]

interface Producto {
  id:               number
  nombre:           string
  referencia:       string
  precio_venta:     number
  activo:           number
  estado:           ProductoEstado
  coleccion_nombre: string | null
  imagen_url:       string | null
}

export default function Productos() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,      setLoading]      = useState(true)
  const [productos,    setProductos]    = useState<Producto[]>([])
  const [busqueda,     setBusqueda]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const loadProductos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getProductos(false) as Producto[]
      setProductos(data)
    } catch {
      toast.error('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProductos() }, [loadProductos])

  const productosFiltrados = productos.filter(p => {
    if (filtroEstado && p.estado !== filtroEstado) return false
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
    // Cambiar entre activo <-> descontinuado
    const nuevoEstado = producto.estado === 'activo' ? 'descontinuado' : 'activo'
    const nuevoActivo = nuevoEstado === 'activo' ? 1 : 0
    try {
      await window.electronAPI.db.run(
        `UPDATE productos SET estado = ?, activo = ?, updated_at = datetime('now') WHERE id = ?`,
        [nuevoEstado, nuevoActivo, producto.id]
      )
      toast.success(
        nuevoEstado === 'activo'
          ? `"${producto.nombre}" activado`
          : `"${producto.nombre}" descontinuado`
      )
      loadProductos()
    } catch {
      toast.error('Error al actualizar producto')
    }
  }

  function handleFichaCosto(producto: Producto) {
    openModal(
      <FichaCostoPanel
        productoId={producto.id}
        productoNombre={producto.nombre}
        precioVenta={producto.precio_venta}
        onClose={closeModal}
      />,
      'lg'
    )
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

        {/* Nuevo producto */}
        <button onClick={handleNuevoProducto} className="btn-primary h-9 text-[13px]">
          <Plus size={14} />
          Nuevo producto
        </button>
      </div>

      {/* Filtro por estado */}
      <div className="flex gap-2 flex-wrap -mt-2">
        {FILTROS_ESTADO.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltroEstado(f.value)}
            className={`px-3 py-1 rounded-xl border text-[12px] font-semibold transition-all
              ${filtroEstado === f.value
                ? 'bg-accent-light border-accent/40 text-accent'
                : 'border-border text-primary-muted hover:border-accent/30'
              }`}
          >
            {f.label}
            {f.value !== '' && (
              <span className="ml-1.5 opacity-60">
                {productos.filter(p => p.estado === f.value).length}
              </span>
            )}
          </button>
        ))}
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
              onFichaCosto={() => handleFichaCosto(producto)}
            />
          ))}
        </div>
      )}
    </div>
  )
}