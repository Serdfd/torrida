import { AlertTriangle, Package } from 'lucide-react'
import { StockItem } from '@/types'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface StockAlertasProps {
  items: StockItem[]
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="badge badge-danger">
        Sin stock
      </span>
    )
  }
  return (
    <span className="badge badge-warning">
      {formatNumber(stock)} ud.
    </span>
  )
}

export default function StockAlertas({ items }: StockAlertasProps) {
  if (items.length === 0) return null

  // Agrupar por producto
  const porProducto = items.reduce<Record<string, StockItem[]>>((acc, item) => {
    const key = `${item.producto_id}`
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(porProducto).map(([productoId, tallas]) => {
        const nombre = tallas[0].producto_nombre
        const tieneAgotado = tallas.some(t => t.stock === 0)

        return (
          <div
            key={productoId}
            className={cn(
              'flex items-start gap-4 p-4 rounded-xl border',
              tieneAgotado
                ? 'bg-danger/5 border-danger/20'
                : 'bg-warning/5 border-warning/20'
            )}
          >
            {/* Icono */}
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              tieneAgotado ? 'bg-danger/10' : 'bg-warning/10'
            )}>
              {tieneAgotado
                ? <AlertTriangle size={16} className="text-danger" />
                : <Package size={16} className="text-warning" />
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-primary-DEFAULT truncate mb-2">
                {nombre}
              </p>

              {/* Tallas */}
              <div className="flex flex-wrap gap-2">
                {tallas
                  .sort((a, b) => a.talla_id - b.talla_id)
                  .map((item) => (
                    <div
                      key={`${item.producto_id}-${item.talla_id}`}
                      className="flex items-center gap-1.5"
                    >
                      <span className="text-[12px] font-bold text-primary-muted">
                        {item.talla_nombre}
                      </span>
                      <StockBadge stock={item.stock} />
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Costo referencial */}
            {tallas[0].costo_unitario !== undefined && (
              <div className="text-right shrink-0">
                <p className="text-[11px] text-primary-muted">Costo unit.</p>
                <p className="text-[13px] font-semibold text-primary-DEFAULT">
                  {tallas[0].costo_unitario
                    ? `$${formatNumber(tallas[0].costo_unitario)}`
                    : '—'
                  }
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}