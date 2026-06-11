import { useEffect, useState, useCallback } from 'react'
import { DollarSign, Plus, History, ChevronDown, ChevronRight, Check, X, TrendingUp, TrendingDown } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface FichaCosto {
  id:                    number
  producto_id:           number
  version:               number
  vigente:               number
  costo_confeccion:      number
  costo_tela:            number
  costo_insumos_total:   number
  costo_foto:            number
  otros_costos:          number
  costo_total:           number
  precio_venta_sugerido: number
  margen_objetivo_pct:   number
  notas:                 string | null
  created_at:            string
}

interface FormState {
  costo_confeccion:      string
  costo_tela:            string
  costo_insumos_total:   string
  costo_foto:            string
  otros_costos:          string
  precio_venta_sugerido: string
  margen_objetivo_pct:   string
  notas:                 string
}

const EMPTY_FORM: FormState = {
  costo_confeccion:      '',
  costo_tela:            '',
  costo_insumos_total:   '',
  costo_foto:            '',
  otros_costos:          '',
  precio_venta_sugerido: '',
  margen_objetivo_pct:   '',
  notas:                 '',
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(n)

const fmtPct = (n: number) => `${n.toFixed(1)}%`

function num(s: string): number { return parseFloat(s) || 0 }

function calcCostoTotal(f: FormState): number {
  return num(f.costo_confeccion) + num(f.costo_tela) +
         num(f.costo_insumos_total) + num(f.costo_foto) + num(f.otros_costos)
}

function calcMargenReal(precioVenta: number, costoTotal: number): number {
  if (!precioVenta || precioVenta <= 0) return 0
  return ((precioVenta - costoTotal) / precioVenta) * 100
}

function calcPrecioSugerido(costoTotal: number, margenPct: number): number {
  if (margenPct >= 100) return 0
  return costoTotal / (1 - margenPct / 100)
}

// ── Fila de costo ──────────────────────────────────────────────────────────

function CostoFila({ label, value, editing, onChange }: {
  label:    string
  value:    number | string
  editing?: boolean
  onChange?: (v: string) => void
}) {
  if (editing && onChange) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
        <span className="text-[12.5px] text-primary-muted">{label}</span>
        <input
          type="number"
          min="0"
          step="100"
          value={value as string}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="input text-right text-[13px] py-1 h-7 w-36"
        />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[12.5px] text-primary-muted">{label}</span>
      <span className="text-[13px] text-primary font-medium">{fmtCOP(value as number)}</span>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

interface Props {
  productoId:     number
  productoNombre: string
  precioVenta:    number
  onClose:        () => void
}

export default function FichaCostoPanel({
  productoId,
  productoNombre,
  precioVenta,
  onClose,
}: Props) {
  const toast = useToast()

  const [ficha,                   setFicha]                   = useState<FichaCosto | null>(null)
  const [historial,               setHistorial]               = useState<FichaCosto[]>([])
  const [loading,                 setLoading]                 = useState(true)
  const [editing,                 setEditing]                 = useState(false)
  const [saving,                  setSaving]                  = useState(false)
  const [showHist,                setShowHist]                = useState(false)
  const [costoFotoSugerido,       setCostoFotoSugerido]       = useState(0)
  const [costoConfeccionSugerido, setCostoConfeccionSugerido] = useState(0)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const loadFicha = useCallback(async () => {
    setLoading(true)
    try {
      const [vigentes, history, sesionRows, ordenRows] = await Promise.all([
        window.electronAPI.db.query(
          `SELECT * FROM fichas_costo WHERE producto_id=? AND vigente=1 LIMIT 1`,
          [productoId]
        ),
        window.electronAPI.db.query(
          `SELECT * FROM fichas_costo WHERE producto_id=? ORDER BY version DESC`,
          [productoId]
        ),
        window.electronAPI.db.query<{ costo_foto_calculado: number }>(
          `SELECT ROUND(sfp.costo_foto_calculado / NULLIF(sfp.cantidad_unidades, 0)) AS costo_foto_calculado
           FROM sesion_fotografica_productos sfp
           WHERE sfp.producto_id = ?
             AND sfp.costo_foto_calculado > 0
           ORDER BY sfp.id DESC
           LIMIT 1`,
          [productoId]
        ),
        window.electronAPI.db.query<{ costo_unitario: number; cantidad_total: number }>(
          `SELECT opi.costo_unitario, opi.cantidad_total
           FROM ordenes_produccion_items opi
           JOIN ordenes_produccion op ON op.id = opi.orden_id
           WHERE opi.producto_id = ?
             AND op.estado = 'entregada'
             AND opi.costo_unitario > 0
           ORDER BY op.id DESC
           LIMIT 1`,
          [productoId]
        ),
      ])
      const current = (vigentes as unknown as FichaCosto[])[0] ?? null
      setFicha(current)
      setHistorial(history as unknown as FichaCosto[])
      const sugerido = sesionRows[0]?.costo_foto_calculado ?? 0
      setCostoFotoSugerido(sugerido)
      const ordenRow = (ordenRows as unknown as { costo_unitario: number }[])[0]
      setCostoConfeccionSugerido(ordenRow?.costo_unitario ?? 0)
    } finally {
      setLoading(false)
    }
  }, [productoId])

  useEffect(() => { loadFicha() }, [loadFicha])

  function startEditing() {
    if (ficha) {
      setForm({
        costo_confeccion:      ficha.costo_confeccion.toString(),
        costo_tela:            ficha.costo_tela.toString(),
        costo_insumos_total:   ficha.costo_insumos_total.toString(),
        costo_foto:            ficha.costo_foto > 0
                                 ? ficha.costo_foto.toString()
                                 : costoFotoSugerido > 0 ? costoFotoSugerido.toString() : '',
        otros_costos:          ficha.otros_costos.toString(),
        precio_venta_sugerido: ficha.precio_venta_sugerido.toString(),
        margen_objetivo_pct:   ficha.margen_objetivo_pct.toString(),
        notas:                 ficha.notas ?? '',
      })
    } else {
      setForm({
        ...EMPTY_FORM,
        costo_confeccion: costoConfeccionSugerido > 0 ? costoConfeccionSugerido.toString() : '',
        costo_foto:       costoFotoSugerido > 0 ? costoFotoSugerido.toString() : '',
      })
    }
    setEditing(true)
  }

  function setF(k: keyof FormState, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      // Auto-calcular precio sugerido cuando cambia el margen u otros costos
      if (k !== 'precio_venta_sugerido' && k !== 'notas') {
        const ct = calcCostoTotal(next)
        const mp = num(next.margen_objetivo_pct)
        if (mp > 0 && mp < 100) {
          next.precio_venta_sugerido = calcPrecioSugerido(ct, mp).toFixed(0)
        }
      }
      return next
    })
  }

  async function handleSave() {
    const costoTotal = calcCostoTotal(form)
    if (costoTotal <= 0) {
      toast.warning('Ingresá al menos un costo')
      return
    }
    setSaving(true)
    try {
      // Calcular nueva versión
      const nextVersion = historial.length > 0
        ? Math.max(...historial.map(f => f.version)) + 1
        : 1

      // Marcar versión anterior como no vigente
      if (ficha) {
        await window.electronAPI.db.run(
          `UPDATE fichas_costo SET vigente=0 WHERE producto_id=? AND vigente=1`,
          [productoId]
        )
      }

      // Crear nueva versión vigente
      await window.electronAPI.db.run(
        `INSERT INTO fichas_costo
           (producto_id, version, vigente,
            costo_confeccion, costo_tela, costo_insumos_total,
            costo_foto, otros_costos, costo_total,
            precio_venta_sugerido, margen_objetivo_pct, notas)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productoId,
          nextVersion,
          num(form.costo_confeccion),
          num(form.costo_tela),
          num(form.costo_insumos_total),
          num(form.costo_foto),
          num(form.otros_costos),
          costoTotal,
          num(form.precio_venta_sugerido),
          num(form.margen_objetivo_pct),
          form.notas.trim() || null,
        ]
      )

      toast.success(`Ficha v${nextVersion} guardada`)
      setEditing(false)
      await loadFicha()
    } catch {
      toast.error('Error al guardar la ficha')
    } finally {
      setSaving(false)
    }
  }

  // ── Cálculos derivados ────────────────────────────────────────────────────
  const costoTotalForm   = editing ? calcCostoTotal(form) : (ficha?.costo_total ?? 0)
  const margenReal       = calcMargenReal(precioVenta, costoTotalForm)
  const margenBueno      = margenReal >= 40

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto pr-1">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-light flex items-center justify-center text-accent shrink-0">
          <DollarSign size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-primary truncate">Ficha de costo</p>
          <p className="text-[12px] text-primary-muted truncate">{productoNombre}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-primary-muted py-4 text-center">Cargando…</p>
      ) : (
        <>
          {/* ── Indicadores rápidos ── */}
          {(ficha || editing) && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-sidebar border border-border rounded-xl px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wider text-primary-muted font-bold mb-0.5">
                  Costo total
                </p>
                <p className="text-[16px] font-bold text-warning">{fmtCOP(costoTotalForm)}</p>
              </div>
              <div className="bg-sidebar border border-border rounded-xl px-3 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wider text-primary-muted font-bold mb-0.5">
                  Precio venta
                </p>
                <p className="text-[16px] font-bold text-primary">{fmtCOP(precioVenta)}</p>
              </div>
              <div className={cn(
                'border rounded-xl px-3 py-2.5 text-center',
                margenBueno
                  ? 'bg-success/10 border-success/30'
                  : 'bg-danger/10 border-danger/30'
              )}>
                <p className="text-[10px] uppercase tracking-wider text-primary-muted font-bold mb-0.5">
                  Margen real
                </p>
                <p className={cn(
                  'text-[16px] font-bold flex items-center justify-center gap-1',
                  margenBueno ? 'text-success' : 'text-danger'
                )}>
                  {margenBueno ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {fmtPct(margenReal)}
                </p>
              </div>
            </div>
          )}

          {/* ── Desglose de costos ── */}
          <div className="card gap-0 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-primary">
                {ficha ? `Versión ${ficha.version} (vigente)` : 'Sin ficha de costo'}
              </p>
              {!editing && (
                <button
                  onClick={startEditing}
                  className="btn-primary text-[12px] py-1.5 px-3"
                >
                  <Plus size={13} />
                  {ficha ? 'Nueva versión' : 'Crear ficha'}
                </button>
              )}
            </div>

            {editing ? (
              <div className="flex flex-col gap-1">
                {/* Confección con sugerencia desde orden de producción */}
                <div className="flex flex-col border-b border-border/40 py-1.5 gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] text-primary-muted">Confección / Mano de obra</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.costo_confeccion}
                      onChange={e => setF('costo_confeccion', e.target.value)}
                      placeholder="0"
                      className="w-32 text-right text-[13px] font-semibold bg-transparent
                                 border border-border rounded-lg px-2 py-1
                                 focus:outline-none focus:border-accent text-primary"
                    />
                  </div>
                  {costoConfeccionSugerido > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setF('costo_confeccion', costoConfeccionSugerido.toString())}
                        className="flex items-center gap-1 text-[11px] font-semibold
                                   text-warning border border-warning/30 rounded-full
                                   px-2 py-0.5 hover:bg-warning/10 transition-colors"
                      >
                        Orden: {fmtCOP(costoConfeccionSugerido)} ← usar
                      </button>
                    </div>
                  )}
                </div>
                <CostoFila label="Telas / Materiales"          value={form.costo_tela}           editing onChange={v => setF('costo_tela', v)} />
                <CostoFila label="Insumos (cierres, botones…)" value={form.costo_insumos_total}  editing onChange={v => setF('costo_insumos_total', v)} />

                {/* Fotografía con sugerencia desde sesiones */}
                <div className="flex flex-col border-b border-border/40 py-1.5 gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] text-primary-muted">Fotografía (porción)</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={form.costo_foto}
                      onChange={e => setF('costo_foto', e.target.value)}
                      placeholder="0"
                      className="input text-right text-[13px] py-1 h-7 w-36 shrink-0"
                    />
                  </div>
                  {costoFotoSugerido > 0 && (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[11px] text-primary-muted/70">
                        Sesión fotográfica sugiere:
                      </span>
                      <button
                        type="button"
                        onClick={() => setF('costo_foto', costoFotoSugerido.toString())}
                        className="text-[11px] px-2 py-0.5 rounded-full border border-accent/40
                                   bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                      >
                        Usar {fmtCOP(costoFotoSugerido)}/ud
                      </button>
                    </div>
                  )}
                </div>

                <CostoFila label="Otros costos"                value={form.otros_costos}         editing onChange={v => setF('otros_costos', v)} />

                {/* Separador total */}
                <div className="flex items-center justify-between py-2 mt-1 border-t-2 border-border">
                  <span className="text-[13px] font-bold text-primary">Costo total calculado</span>
                  <span className="text-[15px] font-bold text-warning">{fmtCOP(calcCostoTotal(form))}</span>
                </div>

                {/* Margen y precio sugerido */}
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <label className="input-label">Margen objetivo %</label>
                    <input
                      type="number" min="0" max="99" step="1"
                      value={form.margen_objetivo_pct}
                      onChange={e => setF('margen_objetivo_pct', e.target.value)}
                      placeholder="50"
                      className="input text-[13px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="input-label">Precio sugerido</label>
                    <input
                      type="number" min="0"
                      value={form.precio_venta_sugerido}
                      onChange={e => setF('precio_venta_sugerido', e.target.value)}
                      placeholder="0"
                      className="input text-[13px]"
                    />
                  </div>
                </div>

                {/* Notas */}
                <div className="flex flex-col gap-1 mt-1">
                  <label className="input-label">Notas</label>
                  <textarea
                    value={form.notas}
                    onChange={e => setF('notas', e.target.value)}
                    rows={2}
                    placeholder="Cambios respecto a versión anterior…"
                    className="input resize-none text-[13px]"
                  />
                </div>

                {/* Botones */}
                <div className="flex gap-2 justify-end mt-3">
                  <button
                    onClick={() => setEditing(false)}
                    className="btn-ghost text-[13px]"
                    disabled={saving}
                  >
                    <X size={13} /> Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn-primary text-[13px]"
                    disabled={saving}
                  >
                    <Check size={13} />
                    {saving ? 'Guardando…' : 'Guardar versión'}
                  </button>
                </div>
              </div>
            ) : ficha ? (
              <div>
                <CostoFila label="Confección / Mano de obra"   value={ficha.costo_confeccion} />
                <CostoFila label="Telas / Materiales"           value={ficha.costo_tela} />
                <CostoFila label="Insumos (cierres, botones…)"  value={ficha.costo_insumos_total} />
                <CostoFila label="Fotografía (porción)"         value={ficha.costo_foto} />
                <CostoFila label="Otros costos"                 value={ficha.otros_costos} />
                <div className="flex items-center justify-between py-2 mt-1 border-t-2 border-border">
                  <span className="text-[13px] font-bold text-primary">Costo total</span>
                  <span className="text-[15px] font-bold text-warning">{fmtCOP(ficha.costo_total)}</span>
                </div>
                {ficha.precio_venta_sugerido > 0 && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-[12.5px] text-primary-muted">Precio sugerido ({fmtPct(ficha.margen_objetivo_pct)} margen)</span>
                    <span className="text-[13px] text-accent font-medium">{fmtCOP(ficha.precio_venta_sugerido)}</span>
                  </div>
                )}
                {ficha.notas && (
                  <p className="text-[12px] text-primary-muted mt-2 italic">{ficha.notas}</p>
                )}
                <p className="text-[11px] text-primary-muted/50 mt-2">
                  Creada: {new Date(ficha.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-primary-muted py-2">
                Todavía no tiene ficha de costo. Creá la primera versión.
              </p>
            )}
          </div>

          {/* ── Historial de versiones ── */}
          {historial.length > 1 && (
            <div>
              <button
                onClick={() => setShowHist(s => !s)}
                className="flex items-center gap-2 text-[12.5px] text-primary-muted hover:text-primary transition-colors"
              >
                {showHist ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <History size={13} />
                Historial de versiones ({historial.length})
              </button>

              {showHist && (
                <div className="mt-2 flex flex-col gap-2">
                  {historial.filter(f => !f.vigente).map(f => (
                    <div
                      key={f.id}
                      className="border border-border/50 rounded-xl px-4 py-3 opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-primary-muted">
                          Versión {f.version}
                        </span>
                        <span className="text-[12px] text-warning">{fmtCOP(f.costo_total)}</span>
                      </div>
                      <div className="flex gap-4 mt-1 text-[11.5px] text-primary-muted/70">
                        <span>Conf: {fmtCOP(f.costo_confeccion)}</span>
                        <span>Tela: {fmtCOP(f.costo_tela)}</span>
                        <span>Ins: {fmtCOP(f.costo_insumos_total)}</span>
                      </div>
                      <p className="text-[11px] text-primary-muted/50 mt-1">
                        {new Date(f.created_at).toLocaleDateString('es-CO')}
                        {f.notas && ` — ${f.notas}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
