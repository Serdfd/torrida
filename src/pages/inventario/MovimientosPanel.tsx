import { useEffect, useState } from 'react'
import {
  ArrowUpCircle, ArrowDownCircle,
  SlidersHorizontal, History, RefreshCw
} from 'lucide-react'
import { formatDate, formatNumber } from '@/lib/utils'
import { useToast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

interface Movimiento {
  id:           number
  tipo:         string
  cantidad:     number
  notas:        string | null
  fecha:        string
  created_at:   string
  talla_nombre: string
}

interface MovimientosPanelProps {
  productoId:      number
  productoNombre:  string
  onClose:         () => void
}

const TIPO_CONFIG: Record<string, {
  label:  string
  icon:   React.ElementType
  color:  string
  bg:     string
}> = {
  entrada_produccion: {
    label: 'Entrada producción',
    icon:  ArrowUpCircle,
    color: 'text-success',
    bg:    'bg-success/10'
  },
  salida_venta: {
    label: 'Salida venta',
    icon:  ArrowDownCircle,
    color: 'text-danger',
    bg:    'bg-danger/10'
  },
  devolucion: {
    label: 'Devolución',
    icon:  ArrowUpCircle,
    color: 'text-warning',
    bg:    'bg-warning/10'
  },
  ajuste_manual: {
    label: 'Ajuste manual',
    icon:  SlidersHorizontal,
    color: 'text-accent',
    bg:    'bg-accent-light'
  },
  ajuste_reconciliacion: {
    label: 'Reconciliación',
    icon:  RefreshCw,
    color: 'text-accent2',
    bg:    'bg-accent2/10'
  },
  entrada_compra: {
    label: 'Entrada manual',
    icon:  ArrowUpCircle,
    color: 'text-success',
    bg:    'bg-success/10'
  },
  salida_produccion: {
    label: 'Salida manual',
    icon:  ArrowDownCircle,
    color: 'text-danger',
    bg:    'bg-danger/10'
  }
}

export default function MovimientosPanel({
  productoId,
  productoNombre,
  onClose
}: MovimientosPanelProps) {
  const toast = useToast()

  const [loading,      setLoading]      = useState(true)
  const [movimientos,  setMovimientos]  = useState<Movimiento[]>([])

  async function load() {
    setLoading(true)
    try {
      const data = await window.electronAPI.db.query<Movimiento>(
        `SELECT
           mi.id, mi.tipo, mi.cantidad, mi.notas,
           mi.fecha, mi.created_at,
           t.nombre AS talla_nombre
         FROM movimientos_inventario mi
         JOIN tallas t ON t.id = mi.talla_id
         WHERE mi.producto_id = ?
         ORDER BY mi.created_at DESC
         LIMIT 200`,
        [productoId]
      )
      setMovimientos(data)
    } catch {
      toast.error('Error al cargar movimientos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [productoId])

  // Resumen: positivos = entradas, negativos = salidas
  const totalEntradas = movimientos
    .filter(m => m.cantidad > 0)
    .reduce((s, m) => s + m.cantidad, 0)

  const totalSalidas = movimientos
    .filter(m => m.cantidad < 0)
    .reduce((s, m) => s + Math.abs(m.cantidad), 0)

  return (
    <div className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1">

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center
                        justify-center text-accent">
          <History size={18} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-primary">
            Historial de movimientos
          </h2>
          <p className="text-sm text-primary-muted">
            {productoNombre}
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-success/5 border border-success/20 rounded-xl px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider
                        text-success/70 mb-1">
            Total entradas
          </p>
          <p className="text-xl font-bold text-success">
            +{formatNumber(totalEntradas)}
          </p>
        </div>
        <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider
                        text-danger/70 mb-1">
            Total salidas
          </p>
          <p className="text-xl font-bold text-danger">
            -{formatNumber(totalSalidas)}
          </p>
        </div>
      </div>

      {/* Lista movimientos */}
      {loading ? (
        <FullPageSpinner />
      ) : movimientos.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin movimientos registrados"
          description="Los ajustes manuales y reconciliaciones aparecerán aquí."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {movimientos.map(mov => {
            const config = TIPO_CONFIG[mov.tipo] ?? {
              label: mov.tipo,
              icon:  SlidersHorizontal,
              color: 'text-primary-muted',
              bg:    'bg-card'
            }
            const Icon     = config.icon
            const esSalida = mov.cantidad < 0

            return (
              <div
                key={mov.id}
                className="flex items-start gap-3 p-3 rounded-xl border
                           border-border bg-[#0B0B16]"
              >
                {/* Icono */}
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  config.bg
                )}>
                  <Icon size={15} className={config.color} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-sm font-semibold', config.color)}>
                      {config.label}
                    </span>
                    <span className="text-xs text-primary-muted">
                      · Talla {mov.talla_nombre} · {formatDate(mov.fecha)}
                    </span>
                  </div>
                  {mov.notas && (
                    <p className="text-sm text-primary-muted truncate leading-snug">
                      {mov.notas}
                    </p>
                  )}
                </div>

                {/* Cantidad */}
                <div className="text-right shrink-0">
                  <p className={cn(
                    'text-md font-bold',
                    esSalida ? 'text-danger' : 'text-success'
                  )}>
                    {esSalida ? '' : '+'}{formatNumber(mov.cantidad)}
                  </p>
                  <p className="text-xs text-primary-muted">ud.</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Cerrar */}
      <div className="flex justify-end pt-1 border-t border-border">
        <button onClick={onClose} className="btn-ghost">
          Cerrar
        </button>
      </div>
    </div>
  )
}