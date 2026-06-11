import { useEffect, useState, useCallback } from 'react'
import { useAppStore, useToast, useModal } from '@/store/useAppStore'
import {
  LockKeyhole, UnlockKeyhole, TrendingUp,
  TrendingDown, DollarSign, ReceiptText,
  ShoppingBag, RotateCcw, AlertTriangle, Users
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
  id:                number
  anio:              number
  mes:               number
  ingresos:          number
  gastos:            number
  utilidad_bruta:    number
  utilidad_neta:     number
  unidades:          number
  devoluciones:      number
  cerrado:           number
  cerrado_en:        string | null
  notas:             string | null
  pct_reinversion:   number | null
  monto_reinversion: number | null
  retiro_socia_a:    number | null
  retiro_socia_b:    number | null
}

export default function CierreMensual() {
  const { filtroAnio, filtroMes } = useAppStore()
  const toast  = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,         setLoading]         = useState(true)
  const [cierre,          setCierre]          = useState<CierreData | null>(null)
  const [resumen, setResumen] = useState<{
    ingresos:          number
    gastos:            number
    utilidad:          number
    unidades:          number
    devoluciones:      number
    comision_pasarela: number
  } | null>(null)

  // Distribución
  const [nombreSociaA,   setNombreSociaA]   = useState('Socia A')
  const [nombreSociaB,   setNombreSociaB]   = useState('Socia B')
  const [pctReinversion, setPctReinversion] = useState(0)
  const [retiroA,        setRetiroA]        = useState(0)
  const [retiroB,        setRetiroB]        = useState(0)
  const [savingDist,     setSavingDist]     = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [kpis, totalGastos, cierreExist, configRows] = await Promise.all([
        getDashboardKpis(filtroAnio, filtroMes),
        getTotalGastos(filtroAnio, filtroMes),
        getCierreMensual(filtroAnio, filtroMes),
        window.electronAPI.db.query<{ clave: string; valor: string }>(
          `SELECT clave, valor FROM configuracion_app
           WHERE clave IN ('nombre_socia_a','nombre_socia_b')`
        )
      ])

      const configMap = Object.fromEntries(configRows.map(r => [r.clave, r.valor]))
      setNombreSociaA(configMap['nombre_socia_a'] ?? 'Socia A')
      setNombreSociaB(configMap['nombre_socia_b'] ?? 'Socia B')

      const utilidad = kpis.ingresos_mes - totalGastos
      setResumen({
        ingresos:          kpis.ingresos_mes,
        gastos:            totalGastos,
        utilidad,
        unidades:          kpis.unidades_vendidas,
        devoluciones:      kpis.devoluciones,
        comision_pasarela: kpis.comision_pasarela,
      })
      const c = cierreExist as CierreData | null
      setCierre(c)
      if (c) {
        setPctReinversion(c.pct_reinversion   ?? 0)
        setRetiroA(       c.retiro_socia_a    ?? 0)
        setRetiroB(       c.retiro_socia_b    ?? 0)
      } else {
        setPctReinversion(0); setRetiroA(0); setRetiroB(0)
      }
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

  // ── Guardar distribución ───────────────────────────────
  async function handleGuardarDistribucion() {
    if (!cierre?.id) return
    const montoReinversion = (resumen?.utilidad ?? 0) * (pctReinversion / 100)
    setSavingDist(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE cierres_mensuales SET
           pct_reinversion   = ?,
           monto_reinversion = ?,
           retiro_socia_a    = ?,
           retiro_socia_b    = ?,
           updated_at        = datetime('now')
         WHERE id = ?`,
        [pctReinversion, montoReinversion, retiroA, retiroB, cierre.id]
      )
      toast.success('Distribución guardada')
      loadData()
    } catch {
      toast.error('Error al guardar distribución')
    } finally {
      setSavingDist(false)
    }
  }

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
              'text-md font-bold',
              estaCerrado ? 'text-success' : 'text-warning'
            )}>
              {estaCerrado ? 'Período cerrado' : 'Período abierto'}
            </p>
            <p className="text-base text-primary-muted">
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
            'shrink-0',
            estaCerrado
              ? 'btn-ghost border-success/30 text-success hover:bg-success/10'
              : 'btn-ghost bg-warning/10 border-warning/30 text-warning hover:bg-warning/20'
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
        <p className="text-base font-bold text-primary-muted uppercase
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
          {(resumen?.comision_pasarela ?? 0) > 0 && (
            <FinancialRow
              label="Comisiones pasarela"
              value={resumen?.comision_pasarela ?? 0}
              color="text-warning"
              sign="-"
            />
          )}
          <div className="border-t border-border pt-3 mt-1">
            <FinancialRow
              label="Utilidad neta"
              value={resumen?.utilidad ?? 0}
              color={(resumen?.utilidad ?? 0) >= 0 ? 'text-accent' : 'text-danger'}
              bold
            />
          </div>
          <div className="flex justify-between items-center
                          text-base text-primary-muted">
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
          <p className="text-base text-primary-muted">
            Este período aún está <strong className="text-warning">abierto</strong>.
            Ciérralo cuando hayas registrado todas las ventas y gastos del mes
            para congelar los datos y generar el historial.
          </p>
        </div>
      )}

      {/* Distribución de utilidad — solo cuando existe cierre */}
      {cierre?.id && (
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Users size={15} className="text-primary-muted" />
            <p className="text-base font-bold text-primary-muted uppercase tracking-wider">
              Distribución de utilidad
            </p>
          </div>

          {(resumen?.utilidad ?? 0) <= 0 ? (
            <p className="text-base text-primary-muted">
              No hay utilidad positiva para distribuir en este período.
            </p>
          ) : (
            <div className="flex flex-col gap-4">

              {/* Reinversión */}
              <div className="flex flex-col gap-1.5">
                <label className="input-label">
                  % Reinversión al negocio
                  <span className="ml-2 text-accent font-bold">
                    {formatCOP((resumen?.utilidad ?? 0) * (pctReinversion / 100))}
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={100} step={5}
                    value={pctReinversion}
                    onChange={e => {
                      const pct = Number(e.target.value)
                      setPctReinversion(pct)
                      const disponible = (resumen?.utilidad ?? 0) * (1 - pct / 100)
                      setRetiroA(Math.round(disponible / 2))
                      setRetiroB(Math.round(disponible / 2))
                    }}
                    className="flex-1 accent-accent"
                  />
                  <span className="text-md font-bold text-accent w-10 text-right">
                    {pctReinversion}%
                  </span>
                </div>
              </div>

              {/* Retiros */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Retiro {nombreSociaA}</label>
                  <input
                    type="number" min={0} className="input"
                    value={retiroA}
                    onChange={e => setRetiroA(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="input-label">Retiro {nombreSociaB}</label>
                  <input
                    type="number" min={0} className="input"
                    value={retiroB}
                    onChange={e => setRetiroB(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Resumen distribución */}
              <div className="bg-[#0B0B16] border border-border rounded-xl p-4
                              flex flex-col gap-1.5 text-base">
                {[
                  { label: 'Utilidad neta',        val: resumen?.utilidad ?? 0,       color: 'text-success' },
                  { label: `Reinversión (${pctReinversion}%)`, val: -(resumen?.utilidad ?? 0) * (pctReinversion / 100), color: 'text-warning' },
                  { label: `Retiro ${nombreSociaA}`, val: -retiroA, color: 'text-primary-muted' },
                  { label: `Retiro ${nombreSociaB}`, val: -retiroB, color: 'text-primary-muted' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-primary-muted">{label}</span>
                    <span className={cn('font-semibold', color)}>
                      {val >= 0 ? '' : '-'}{formatCOP(Math.abs(val))}
                    </span>
                  </div>
                ))}
                {(() => {
                  const saldo = (resumen?.utilidad ?? 0)
                    - (resumen?.utilidad ?? 0) * (pctReinversion / 100)
                    - retiroA - retiroB
                  return (
                    <div className={cn(
                      'border-t border-border mt-1 pt-1.5 flex justify-between font-bold',
                      Math.abs(saldo) < 1 ? 'text-success' : 'text-danger'
                    )}>
                      <span>Saldo sin asignar</span>
                      <span>{formatCOP(saldo)}</span>
                    </div>
                  )
                })()}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleGuardarDistribucion}
                  disabled={savingDist}
                  className="btn-primary"
                >
                  {savingDist ? 'Guardando…' : 'Guardar distribución'}
                </button>
              </div>
            </div>
          )}
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
      bold ? 'text-md' : 'text-base'
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