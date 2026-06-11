import { useEffect, useState } from 'react'
import {
  ArrowUpCircle, ArrowDownCircle,
  SlidersHorizontal, History
} from 'lucide-react'
import { formatDate, formatNumber } from '@/lib/utils'
import { useToast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

interface Movimiento {
  id:         number
  tipo:       string
  cantidad:   number
  motivo:     string | null
  fecha:      string
  created_at: string
}

interface InsumoMovimientosPanelProps {
  insumoId:     number
  insumoNombre: string
  unidad:       string
  onClose:      () => void
}

const TIPO_CONFIG: Record<string, {
  label:  string
  icon:   React.ElementType
  color:  string
  bg:     string
  signo:  1 | -1
}> = {
  entrada_compra: {
    label: 'Entrada compra',
    icon:  ArrowUpCircle,
    color: 'text-success',
    bg:    'bg-success/10',
    signo: 1
  },
  salida_produccion: {
    label: 'Salida producción',
    icon:  ArrowDownCircle,
    color: 'text-danger',
    bg:    'bg-danger/10',
    signo: -1
  },
  ajuste_manual: {
    label: 'Ajuste manual',
    icon:  SlidersHorizontal,
    color: 'text-accent',
    bg:    'bg-accent-light',
    signo: 1
  },
  ajuste_reconciliacion: {
    label: 'Reconciliación',
    icon:  SlidersHorizontal,
    color: 'text-accent2',
    bg:    'bg-accent2/10',
    signo: 1
  }
}

export default function InsumoMovimientosPanel({
  insumoId,
  insumoNombre,
  unidad,
  onClose
}: InsumoMovimientosPanelProps) {
  const toast = useToast()

  const [loading,     setLoading]     = useState(true)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])

  useEffect(() => {
    async function load() {
      try {
        const data = await window.electronAPI.db.query<Movimiento>(
          `SELECT id, tipo, cantidad, motivo, fecha, created_at
           FROM movimientos_insumos
           WHERE insumo_id = ?
           ORDER BY created_at DESC
           LIMIT 200`,
          [insumoId]
        )
        setMovimientos(data)
      } catch {
        toast.error('Error al cargar movimientos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [insumoId])

  const totalEntradas = movimientos
    .filter(m => m.tipo === 'entrada_compra' || m.tipo === 'ajuste_manual' || m.tipo === 'ajuste_reconciliacion')
    .reduce((s, m) => s + m.cantidad, 0)

  const totalSalidas = movimientos
    .filter(m => m.tipo === 'salida_produccion')
    .reduce((s, m) => s + m.cantidad, 0)

  return (
    <div className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1">

      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center
                        justify-center text-accent">
          <History size={18} />
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-primary">
            Historial de movimientos
          </h2>
          <p className="text-[12.5px] text-primary-muted">
            {insumoNombre}
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-success/5 border border-success/20 rounded-xl px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-success/70 mb-1">
            Total entradas
          </p>
          <p className="text-[20px] font-bold text-success">
            +{formatNumber(totalEntradas)}
            <span className="text-[12px] font-normal ml-1 opacity-70">{unidad}</span>
          </p>
        </div>
        <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-danger/70 mb-1">
            Total salidas
          </p>
          <p className="text-[20px] font-bold text-danger">
            -{formatNumber(totalSalidas)}
            <span className="text-[12px] font-normal ml-1 opacity-70">{unidad}</span>
          </p>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <FullPageSpinner />
      ) : movimientos.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin movimientos"
          description="Las entradas y salidas de este insumo aparecerán aquí."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {movimientos.map(mov => {
            const config = TIPO_CONFIG[mov.tipo] ?? {
              label: mov.tipo,
              icon:  SlidersHorizontal,
              color: 'text-primary-muted',
              bg:    'bg-card',
              signo: 1 as const
            }
            const Icon     = config.icon
            const esSalida = mov.tipo === 'salida_produccion'

            return (
              <div
                key={mov.id}
                className="flex items-start gap-3 p-3 rounded-xl border
                           border-border bg-[#0B0B16]"
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  config.bg
                )}>
                  <Icon size={15} className={config.color} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-[12.5px] font-semibold', config.color)}>
                      {config.label}
                    </span>
                    <span className="text-[11.5px] text-primary-muted">
                      · {formatDate(mov.fecha)}
                    </span>
                  </div>
                  {mov.motivo && (
                    <p className="text-[12.5px] text-primary-muted truncate leading-snug">
                      {mov.motivo}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className={cn(
                    'text-[15px] font-bold',
                    esSalida ? 'text-danger' : 'text-success'
                  )}>
                    {esSalida ? '-' : '+'}{formatNumber(mov.cantidad)}
                  </p>
                  <p className="text-[11px] text-primary-muted">{unidad}</p>
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
