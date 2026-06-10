import { useEffect, useState, useCallback } from 'react'
import { useAppStore, useToast, useModal } from '@/store/useAppStore'
import {
  LockKeyhole, UnlockKeyhole, TrendingUp,
  TrendingDown, DollarSign, ReceiptText,
  ShoppingBag, RotateCcw, AlertTriangle
} from 'lucide-react'
import {
  getDashboardKpis,
  getTotalGastos,
  getCierreMensual
} from '@/lib/queries'
import { formatCOP, formatPct, monthYearLabel, calcDelta } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import StatCard from '@/components/ui/StatCard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import HistorialCierres from './HistorialCierres'
import { cn } from '@/lib/utils'

interface CierreData {
  id:               number
  anio:             number
  mes:              number
  ingresos:         number
  gastos:           number
  utilidad_bruta:   number
  utilidad_neta:    number
  unidades:         number
  devoluciones:     number
  cerrado:          number
  cerrado_en:       string | null
  notas:            string | null
}

export default function CierreMensual() {
  const { filtroAnio, filtroMes } = useAppStore()
  const toast  = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,   setLoading]   = useState(true)
  const [cierre,    setCierre]    = useState<CierreData | null>(null)
  const [resumen,   setResumen]   = useState<{
    ingresos:    number
    gastos:      number
    utilidad:    number
    unidades:    number
    devoluciones: number
  } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [kpis, totalGastos, cierreExist] = await Promise.all([
        getDashboardKpis(filtroAnio, filtroMes),
        getTotalGastos(filtroAnio, filtroMes),
        getCierreMensual(filtroAnio, filtroMes)
      ])

      const utilidad = kpis.ingresos_mes - totalGastos
      setResumen({
        ingresos:     kpis.ingresos_mes,
        gastos:       totalGastos,
        utilidad,
        unidades:     kpis.unidades_vendidas,
        devoluciones: kpis.devoluciones
      })
      setCierre(cierreExist as CierreData | null)
    } catch {
      toast.error('Error al cargar datos del cierre')
    } finally {
      setLoading(false)
    }
  }, [filtroAnio, filtroMes])

  useEffect(() => { loadData() }, [loadData])

  const estaCerrado = Boolean(cierre?.cerrado)

  // ── Cerrar mes ─────────────────────────────────────────
  function handleCerrarMes() {
    openModal(
      <ConfirmDialog
        title={`¿Cerrar ${monthYearLabel(filtroAnio, filtroMes)}?`}
        description="Una vez cerrado, no podrás agregar ni editar ventas o gastos en este período."
        confirmLabel="Sí, cerrar período"
        variant="warning"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            if (cierre?.id) {
              // Ya existe, actualizar
              await window.electronAPI.db.run(
                `UPDATE cierres_mensuales SET
                   ingresos      = ?,
                   gastos        = ?,
                   utilidad_bruta = ?,
                   utilidad_neta  = ?,
                   unidades      = ?,
                   devoluciones  = ?,
                   cerrado       = 1,
                   cerrado_en    = datetime('now'),
                   updated_at    = datetime('now')
                 WHERE id = ?`,
                [
                  resumen!.ingresos,
                  resumen!.gastos,
                  resumen!.ingresos,
                  resumen!.utilidad,
                  resumen!.unidades,
                  resumen!.devoluciones,
                  cierre.id
                ]
              )
            } else {
              // Crear nuevo cierre
              await window.electronAPI.db.run(
                `INSERT INTO cierres_mensuales
                   (anio, mes, ingresos, gastos, utilidad_bruta,
                    utilidad_neta, unidades, devoluciones,
                    cerrado, cerrado_en, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,1,datetime('now'),
                         datetime('now'),datetime('now'))`,
                [
                  filtroAnio,
                  filtroMes,
                  resumen!.ingresos,
                  resumen!.gastos,
                  resumen!.ingresos,
                  resumen!.utilidad,
                  resumen!.unidades,
                  resumen!.devoluciones
                ]
              )
            }
            toast.success(`${monthYearLabel(filtroAnio, filtroMes)} cerrado correctamente`)
            loadData()
          } catch (err) {
            console.error(err)
            toast.error('Error al cerrar el período')
          }
        }}
      />
    )
  }

  // ── Reabrir mes ────────────────────────────────────────
  function handleReabrirMes() {
    openModal(
      <ConfirmDialog
        title={`¿Reabrir ${monthYearLabel(filtroAnio, filtroMes)}?`}
        description="Se podrán volver a editar ventas y gastos en este período."
        confirmLabel="Sí, reabrir"
        variant="info"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `UPDATE cierres_mensuales
               SET cerrado    = 0,
                   cerrado_en = NULL,
                   updated_at = datetime('now')
               WHERE id = ?`,
              [cierre!.id]
            )
            toast.success(`${monthYearLabel(filtroAnio, filtroMes)} reabierto`)
            loadData()
          } catch {
            toast.error('Error al reabrir el período')
          }
        }}
      />
    )
  }

  if (loading) return <FullPageSpinner />

  const margenPct = resumen && resumen.ingresos > 0
    ? (resumen.utilidad / resumen.ingresos) * 100
    : 0

  return (
    <div className="flex flex-col gap-6">

      {/* Estado del período */}
      <div className={cn(
        'flex items-start justify-between gap-4 p-5 rounded-2xl border',
        estaCerrado
          ? 'bg-success/5 border-success/30'
          : 'bg-warning/5 border-warning/30'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center',
            estaCerrado ? 'bg-success/15' : 'bg-warning/15'
          )}>
            {estaCerrado
              ? <LockKeyhole   size={20} className="text-success" />
              : <UnlockKeyhole size={20} className="text-warning" />
            }
          </div>
          <div>
            <p className={cn(
              'text-[15px] font-bold',
              estaCerrado ? 'text-success' : 'text-warning'
            )}>
              {estaCerrado ? 'Período cerrado' : 'Período abierto'}
            </p>
            <p className="text-[13px] text-primary-muted">
              {monthYearLabel(filtroAnio, filtroMes)}
              {estaCerrado && cierre?.cerrado_en
                ? ` · Cerrado el ${new Date(cierre.cerrado_en)
                    .toLocaleDateString('es-CO', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}`
                : ''
              }
            </p>
          </div>
        </div>

        {/* Acción */}
        <button
          onClick={estaCerrado ? handleReabrirMes : handleCerrarMes}
          className={cn(
            'btn text-[13px] shrink-0',
            estaCerrado
              ? 'btn-ghost border border-success/30 text-success hover:bg-success/10'
              : 'btn bg-warning/10 border border-warning/30 text-warning hover:bg-warning/20'
          )}
        >
          {estaCerrado
            ? <><UnlockKeyhole size={14} /> Reabrir período</>
            : <><LockKeyhole   size={14} /> Cerrar período</>
          }
        </button>
      </div>

      {/* KPIs del período */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos"
          value={formatCOP(resumen?.ingresos ?? 0)}
          icon={DollarSign}
          featured
        />
        <StatCard
          title="Gastos"
          value={formatCOP(resumen?.gastos ?? 0)}
          icon={ReceiptText}
        />
        <StatCard
          title="Utilidad neta"
          value={formatCOP(resumen?.utilidad ?? 0)}
          icon={TrendingUp}
          subtitle={`Margen: ${formatPct(margenPct)}`}
        />
        <StatCard
          title="Unidades"
          value={String(resumen?.unidades ?? 0)}
          icon={ShoppingBag}
          subtitle={`${resumen?.devoluciones ?? 0} devoluciones`}
        />
      </div>

      {/* Detalle financiero */}
      <div className="card">
        <p className="text-[13px] font-bold text-primary-muted uppercase
                      tracking-wider mb-4">
          Resumen financiero
        </p>

        <div className="flex flex-col gap-2">
          <FinancialRow
            label="Ingresos brutos"
            value={resumen?.ingresos ?? 0}
            color="text-success"
            sign="+"
          />
          <FinancialRow
            label="Total gastos"
            value={resumen?.gastos ?? 0}
            color="text-danger"
            sign="-"
          />
          <div className="border-t border-border pt-3 mt-1">
            <FinancialRow
              label="Utilidad neta"
              value={resumen?.utilidad ?? 0}
              color={(resumen?.utilidad ?? 0) >= 0 ? 'text-accent' : 'text-danger'}
              bold
            />
          </div>
          <div className="flex justify-between items-center
                          text-[13px] text-primary-muted">
            <span>Margen de utilidad</span>
            <span className={cn(
              'font-semibold',
              margenPct >= 30
                ? 'text-success'
                : margenPct >= 10
                  ? 'text-warning'
                  : 'text-danger'
            )}>
              {formatPct(margenPct)}
            </span>
          </div>
        </div>
      </div>

      {/* Advertencia período abierto */}
      {!estaCerrado && (resumen?.ingresos ?? 0) > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl
                        bg-warning/5 border border-warning/20">
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
          <p className="text-[13px] text-primary-muted">
            Este período aún está <strong className="text-warning">abierto</strong>.
            Ciérralo cuando hayas registrado todas las ventas y gastos del mes
            para congelar los datos y generar el historial.
          </p>
        </div>
      )}

      {/* Historial cierres */}
      <HistorialCierres />
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────

interface FinancialRowProps {
  label:  string
  value:  number
  color:  string
  sign?:  string
  bold?:  boolean
}

function FinancialRow({ label, value, color, sign, bold }: FinancialRowProps) {
  return (
    <div className={cn(
      'flex justify-between items-center',
      bold ? 'text-[15px]' : 'text-[13.5px]'
    )}>
      <span className={cn(
        'text-primary-muted',
        bold && 'font-bold text-primary'
      )}>
        {label}
      </span>
      <span className={cn('font-bold', color)}>
        {sign}{formatCOP(Math.abs(value))}
      </span>
    </div>
  )
}