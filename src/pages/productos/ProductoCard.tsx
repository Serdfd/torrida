import { Pencil, PowerOff, Power, Package } from 'lucide-react'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Producto {
  id:               number
  nombre:           string
  referencia:       string
  precio_venta:     number
  activo:           number
  coleccion_nombre: string | null
  imagen_url:       string | null
}

interface ProductoCardProps {
  producto:        Producto
  onEditar:        () => void
  onToggleActivo:  () => void
}

export default function ProductoCard({
  producto,
  onEditar,
  onToggleActivo
}: ProductoCardProps) {
  const isActivo = Boolean(producto.activo)

  return (
    <div
      className={cn(
        'card flex flex-col gap-0 p-0 overflow-hidden group',
        'transition-all duration-200 hover:border-accent-DEFAULT/40',
        !isActivo && 'opacity-60'
      )}
    >
      {/* Imagen */}
      <div className="relative h-44 bg-[#0B0B16] flex items-center justify-center
                      overflow-hidden">
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
            className="w-full h-full object-cover transition-transform duration-300
                       group-hover:scale-105"
          />
        ) : (
          <Package
            size={40}
            className="text-primary-muted opacity-20"
            strokeWidth={1.5}
          />
        )}

        {/* Badge activo/inactivo */}
        <div className="absolute top-2.5 left-2.5">
          <span className={cn(
            'badge text-[11px]',
            isActivo ? 'badge-success' : 'badge-muted'
          )}>
            {isActivo ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        {/* Acciones hover */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={onEditar}
            className="w-7 h-7 rounded-lg bg-card/90 border border-border
                       flex items-center justify-center text-primary-muted
                       hover:text-primary-DEFAULT hover:bg-card
                       transition-colors shadow"
            title="Editar"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onToggleActivo}
            className={cn(
              'w-7 h-7 rounded-lg bg-card/90 border border-border',
              'flex items-center justify-center transition-colors shadow',
              isActivo
                ? 'text-danger hover:bg-danger/10'
                : 'text-success hover:bg-success/10'
            )}
            title={isActivo ? 'Desactivar' : 'Activar'}
          >
            {isActivo
              ? <PowerOff size={12} />
              : <Power    size={12} />
            }
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2 flex-1">

        {/* Colección */}
        {producto.coleccion_nombre && (
          <span className="badge badge-muted text-[11px] self-start">
            {producto.coleccion_nombre}
          </span>
        )}

        {/* Nombre */}
        <p className="text-[14.5px] font-bold text-primary-DEFAULT leading-snug
                      line-clamp-2">
          {producto.nombre}
        </p>

        {/* Referencia */}
        {producto.referencia && (
          <p className="text-[12px] font-mono text-primary-muted">
            REF: {producto.referencia}
          </p>
        )}

        {/* Precio */}
        <div className="mt-auto pt-2 border-t border-border flex items-center
                        justify-between">
          <span className="text-[12px] text-primary-muted">Precio venta</span>
          <span className="text-[15px] font-bold text-accent-DEFAULT">
            {formatCOP(producto.precio_venta)}
          </span>
        </div>
      </div>
    </div>
  )
}