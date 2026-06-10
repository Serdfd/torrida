import { AlertTriangle, Package } from 'lucide-react'
import { formatNumber, cn }       from '@/lib/utils'

interface StockAlerta {
  producto_id:     number
  producto_nombre: string
  talla_nombre:    string
  stock:           number
}

interface StockAlertasProps {
  items: StockAlerta[]
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <span className="badge badge-danger">Sin stock</span>
  return <span className="badge badge-warning">{formatNumber(stock)} ud.</span>
}

export default function StockAlertas({ items }: StockAlertasProps) {
  if (items.length === 0) return null

  // Agrupar por producto
  const porProducto = items.reduce<Record<string, StockAlerta[]>>((acc, item) => {
    const key = String(item.producto_id)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(porProducto).map(([productoId, tallas]) => {
        const nombre       = tallas[0].producto_nombre
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
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              tieneAgotado ? 'bg-danger/10' : 'bg-warning/10'
            )}>
              {tieneAgotado
                ? <AlertTriangle size={16} className="text-danger" />
                : <Package      size={16} className="text-warning" />
              }
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-primary truncate mb-2">
                {nombre}
              </p>
              <div className="flex flex-wrap gap-2">
                {tallas.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-primary-muted">
                      {item.talla_nombre}
                    </span>
                    <StockBadge stock={item.stock} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}