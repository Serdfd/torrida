import { Pencil, PowerOff, Power, Package, DollarSign } from 'lucide-react'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'

type ProductoEstado = 'borrador' | 'en_produccion' | 'activo' | 'descontinuado'

const ESTADO_BADGE: Record<ProductoEstado, { label: string; cls: string }> = {
  borrador:      { label: 'Borrador',       cls: 'bg-border/60 text-primary-muted border-border' },
  en_produccion: { label: 'En producción', cls: 'bg-warning/10 text-warning border-warning/40'   },
  activo:        { label: 'Activo',          cls: 'bg-success/10 text-success border-success/40'  },
  descontinuado: { label: 'Descontinuado',   cls: 'bg-danger/10  text-danger  border-danger/40'   },
}

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

interface ProductoCardProps {
  producto:        Producto
  onEditar:        () => void
  onToggleActivo:  () => void
  onFichaCosto:    () => void
}

export default function ProductoCard({
  producto,
  onEditar,
  onToggleActivo,
  onFichaCosto,
}: ProductoCardProps) {
  const estado   = producto.estado ?? (producto.activo ? 'activo' : 'descontinuado')
  const estadoCfg = ESTADO_BADGE[estado as ProductoEstado] ?? ESTADO_BADGE.activo
  const isActivo  = estado === 'activo'

  return (
    <div
      className={cn(
        'card flex flex-col gap-0 p-0 overflow-hidden group',
        'transition-all duration-200 hover:border-accent/40',
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

        {/* Badge estado */}
        <div className="absolute top-2.5 left-2.5">
          <span className={cn(
            'text-2xs font-bold px-2 py-0.5 rounded-full border',
            estadoCfg.cls
          )}>
            {estadoCfg.label}
          </span>
        </div>

        {/* Acciones */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          <button
            onClick={onEditar}
            className="w-7 h-7 rounded-lg bg-card/90 border border-border
                       flex items-center justify-center text-primary-muted
                       hover:text-primary hover:bg-card
                       transition-colors shadow"
            title="Editar"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onToggleActivo}
            className={cn(
              'w-7 h-7 rounded-lg border',
              'flex items-center justify-center transition-colors shadow',
              isActivo
                ? 'bg-danger border-danger text-white hover:bg-danger/80'
                : 'bg-success border-success text-white hover:bg-success/80'
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
          <span className="badge badge-muted text-xs self-start">
            {producto.coleccion_nombre}
          </span>
        )}

        {/* Nombre */}
        <p className="text-md font-bold text-primary leading-snug
                      line-clamp-2">
          {producto.nombre}
        </p>

        {/* Referencia */}
        {producto.referencia && (
          <p className="text-sm font-mono text-primary-muted">
            REF: {producto.referencia}
          </p>
        )}

        {/* Precio */}
        <div className="mt-auto pt-2 border-t border-border flex items-center
                        justify-between">
          <span className="text-sm text-primary-muted">Precio venta</span>
          <span className="text-md font-bold text-accent">
            {formatCOP(producto.precio_venta)}
          </span>
        </div>

        {/* Ficha de costo */}
        <button
          onClick={onFichaCosto}
          className="flex items-center justify-center gap-1.5 w-full mt-1
                     text-sm text-primary-muted hover:text-accent
                     border border-border hover:border-accent/40
                     rounded-lg py-1.5 transition-colors"
        >
          <DollarSign size={13} />
          Ficha de costo
        </button>
      </div>
    </div>
  )
}