import { useEffect, useState, useCallback } from 'react'
import { DollarSign, Plus, History, ChevronDown, ChevronRight, Check, X, TrendingUp, TrendingDown, Trash2 } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import ComboSelect from '@/components/ui/ComboSelect'

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

interface InsumoItem {
  _key:        number        // local key para React
  insumo_id:   number | null // null = fila libre (otros costos)
  nombre:      string
  cantidad:    string
  precio:      string        // precio_unitario_snap editable
}

interface InsumosCatalog {
  id:             number
  nombre:         string
  unidad:         string
  precio_ultimo:  number   // último lote
}

interface FormState {
  costo_confeccion:      string
  costo_tela:            string
  costo_foto:            string
  precio_venta_sugerido: string
  margen_objetivo_pct:   string
  notas:                 string
}

const EMPTY_FORM: FormState = {
  costo_confeccion:      '',
  costo_tela:            '',
  costo_foto:            '',
  precio_venta_sugerido: '',
  margen_objetivo_pct:   '',
  notas:                 '',
}

let _nextKey = 1
function nextKey() { return _nextKey++ }

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(n)

const fmtPct = (n: number) => `${n.toFixed(1)}%`

function num(s: string): number { return parseFloat(s) || 0 }

function calcCostoTotal(f: FormState, insumos: InsumoItem[], otros: InsumoItem[]): number {
  const totalInsumos = insumos.reduce((s, i) => s + num(i.cantidad) * num(i.precio), 0)
  const totalOtros   = otros.reduce((s, i) => s + num(i.precio), 0)
  return num(f.costo_confeccion) + num(f.costo_tela) +
         totalInsumos + num(f.costo_foto) + totalOtros
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
        <span className="text-sm text-primary-muted">{label}</span>
        <input
          type="number"
          min="0"
          step="100"
          value={value as string}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="input text-right text-base py-1 h-7 w-36"
        />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-primary-muted">{label}</span>
      <span className="text-base text-primary font-medium">{fmtCOP(value as number)}</span>
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

  // Catálogo de insumos disponibles
  const [insumosCatalog, setInsumosCatalog] = useState<InsumosCatalog[]>([])

  // Filas de insumos del catálogo (con insumo_id)
  const [insumoItems, setInsumoItems] = useState<InsumoItem[]>([])
  // Filas de otros costos libres (insumo_id = null)
  const [otrosItems,  setOtrosItems]  = useState<InsumoItem[]>([])

  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const loadFicha = useCallback(async () => {
    setLoading(true)
    try {
      const [vigentes, history, sesionRows, ordenRows, catalogRows] = await Promise.all([
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
        window.electronAPI.db.query<{ costo_unitario: number }>(
          `SELECT opi.costo_unitario
           FROM ordenes_produccion_items opi
           JOIN ordenes_produccion op ON op.id = opi.orden_id
           WHERE opi.producto_id = ?
             AND op.estado = 'entregada'
             AND opi.costo_unitario > 0
           ORDER BY op.id DESC
           LIMIT 1`,
          [productoId]
        ),
        // Catálogo de insumos con precio del último lote
        window.electronAPI.db.query<InsumosCatalog>(
          `SELECT i.id, i.nombre, i.unidad,
                  COALESCE((
                    SELECT il.precio_unitario FROM insumo_lotes il
                    WHERE il.insumo_id = i.id ORDER BY il.id DESC LIMIT 1
                  ), 0) AS precio_ultimo
           FROM insumos i
           WHERE i.activo = 1
           ORDER BY i.nombre ASC`,
          []
        ),
      ])

      const current = (vigentes as unknown as FichaCosto[])[0] ?? null
      setFicha(current)
      setHistorial(history as unknown as FichaCosto[])
      setCostoFotoSugerido(sesionRows[0]?.costo_foto_calculado ?? 0)
      setCostoConfeccionSugerido((ordenRows as any[])[0]?.costo_unitario ?? 0)
      setInsumosCatalog(catalogRows as unknown as InsumosCatalog[])

      // Cargar desglose de insumos de la ficha vigente
      if (current) {
        const detalles = await window.electronAPI.db.query<{
          insumo_id: number | null
          descripcion: string | null
          cantidad: number
          precio_unitario_snap: number
        }>(
          `SELECT insumo_id, descripcion, cantidad, precio_unitario_snap
           FROM fichas_costo_insumos WHERE ficha_id = ? ORDER BY id ASC`,
          [current.id]
        )
        const rows = detalles as unknown as { insumo_id: number | null; descripcion: string | null; cantidad: number; precio_unitario_snap: number }[]
        // Separar insumos de catálogo vs libres
        const catRows = rows.filter(r => r.insumo_id !== null)
        const libRows = rows.filter(r => r.insumo_id === null)
        setInsumoItems(catRows.map(r => ({
          _key:      nextKey(),
          insumo_id: r.insumo_id,
          nombre:    (catalogRows as unknown as InsumosCatalog[]).find(c => c.id === r.insumo_id)?.nombre ?? `Insumo #${r.insumo_id}`,
          cantidad:  r.cantidad.toString(),
          precio:    r.precio_unitario_snap.toString(),
        })))
        setOtrosItems(libRows.map(r => ({
          _key:      nextKey(),
          insumo_id: null,
          nombre:    r.descripcion ?? '',
          cantidad:  '1',
          precio:    r.precio_unitario_snap.toString(),
        })))
      } else {
        setInsumoItems([])
        setOtrosItems([])
      }
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
        costo_foto:            ficha.costo_foto > 0
                                 ? ficha.costo_foto.toString()
                                 : costoFotoSugerido > 0 ? costoFotoSugerido.toString() : '',
        precio_venta_sugerido: ficha.precio_venta_sugerido.toString(),
        margen_objetivo_pct:   ficha.margen_objetivo_pct.toString(),
        notas:                 ficha.notas ?? '',
      })
      // insumoItems y otrosItems ya están cargados desde loadFicha
    } else {
      setForm({
        ...EMPTY_FORM,
        costo_confeccion: costoConfeccionSugerido > 0 ? costoConfeccionSugerido.toString() : '',
        costo_foto:       costoFotoSugerido > 0 ? costoFotoSugerido.toString() : '',
      })
      setInsumoItems([])
      setOtrosItems([])
    }
    setEditing(true)
  }

  function setF(k: keyof FormState, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      const ct = calcCostoTotal(next, insumoItems, otrosItems)
      if (k === 'precio_venta_sugerido') {
        // Precio → calcula margen
        const precio = num(v)
        if (precio > 0 && ct > 0) {
          next.margen_objetivo_pct = (((precio - ct) / precio) * 100).toFixed(1)
        }
      } else if (k !== 'notas') {
        // Margen u otro costo → calcula precio
        const mp = num(next.margen_objetivo_pct)
        if (mp > 0 && mp < 100) {
          next.precio_venta_sugerido = calcPrecioSugerido(ct, mp).toFixed(0)
        }
      }
      return next
    })
  }

  function recalcPrecio(newInsumos: InsumoItem[], newOtros: InsumoItem[]) {
    setForm(prev => {
      const mp = num(prev.margen_objetivo_pct)
      if (mp > 0 && mp < 100) {
        const ct = calcCostoTotal(prev, newInsumos, newOtros)
        return { ...prev, precio_venta_sugerido: calcPrecioSugerido(ct, mp).toFixed(0) }
      }
      return prev
    })
  }

  // ── Insumos del catálogo ──
  function addInsumoFromCatalog(insumoId: string) {
    if (!insumoId) return
    const cat = insumosCatalog.find(c => c.id === Number(insumoId))
    if (!cat) return
    if (insumoItems.some(i => i.insumo_id === cat.id)) return // ya está
    const newItems = [...insumoItems, {
      _key:      nextKey(),
      insumo_id: cat.id,
      nombre:    cat.nombre,
      cantidad:  '1',
      precio:    cat.precio_ultimo.toString(),
    }]
    setInsumoItems(newItems)
    recalcPrecio(newItems, otrosItems)
  }

  function updateInsumoItem(key: number, field: 'cantidad' | 'precio', val: string) {
    const newItems = insumoItems.map(i => i._key === key ? { ...i, [field]: val } : i)
    setInsumoItems(newItems)
    recalcPrecio(newItems, otrosItems)
  }

  function removeInsumoItem(key: number) {
    const newItems = insumoItems.filter(i => i._key !== key)
    setInsumoItems(newItems)
    recalcPrecio(newItems, otrosItems)
  }

  // ── Otros costos libres ──
  function addOtroItem() {
    const newItems = [...otrosItems, { _key: nextKey(), insumo_id: null, nombre: '', cantidad: '1', precio: '' }]
    setOtrosItems(newItems)
  }

  function updateOtroItem(key: number, field: 'nombre' | 'precio', val: string) {
    const newItems = otrosItems.map(i => i._key === key ? { ...i, [field]: val } : i)
    setOtrosItems(newItems)
    recalcPrecio(insumoItems, newItems)
  }

  function removeOtroItem(key: number) {
    const newItems = otrosItems.filter(i => i._key !== key)
    setOtrosItems(newItems)
    recalcPrecio(insumoItems, newItems)
  }

  async function handleSave() {
    const costoTotal = calcCostoTotal(form, insumoItems, otrosItems)
    if (costoTotal <= 0) {
      toast.warning('Ingresá al menos un costo')
      return
    }
    const totalInsumos = insumoItems.reduce((s, i) => s + num(i.cantidad) * num(i.precio), 0)
    const totalOtros   = otrosItems.reduce((s, i) => s + num(i.precio), 0)

    setSaving(true)
    try {
      const nextVersion = historial.length > 0
        ? Math.max(...historial.map(f => f.version)) + 1
        : 1

      if (ficha) {
        await window.electronAPI.db.run(
          `UPDATE fichas_costo SET vigente=0 WHERE producto_id=? AND vigente=1`,
          [productoId]
        )
      }

      const result = await window.electronAPI.db.run(
        `INSERT INTO fichas_costo
           (producto_id, version, vigente,
            costo_confeccion, costo_tela, costo_insumos_total,
            costo_foto, otros_costos, costo_total,
            precio_venta_sugerido, margen_objetivo_pct, notas)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productoId, nextVersion,
          num(form.costo_confeccion),
          num(form.costo_tela),
          totalInsumos,
          num(form.costo_foto),
          totalOtros,
          costoTotal,
          num(form.precio_venta_sugerido),
          num(form.margen_objetivo_pct),
          form.notas.trim() || null,
        ]
      )

      const fichaId = (result as any).lastInsertRowid ?? (result as any).lastID

      // Guardar desglose de insumos
      for (const item of insumoItems) {
        const cant  = num(item.cantidad)
        const prec  = num(item.precio)
        if (cant <= 0 || !item.insumo_id) continue
        await window.electronAPI.db.run(
          `INSERT INTO fichas_costo_insumos
             (ficha_id, insumo_id, descripcion, cantidad, precio_unitario_snap, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [fichaId, item.insumo_id, null, cant, prec, cant * prec]
        )
      }
      for (const item of otrosItems) {
        const prec = num(item.precio)
        if (prec <= 0 || !item.nombre.trim()) continue
        await window.electronAPI.db.run(
          `INSERT INTO fichas_costo_insumos
             (ficha_id, insumo_id, descripcion, cantidad, precio_unitario_snap, subtotal)
           VALUES (?, NULL, ?, 1, ?, ?)`,
          [fichaId, item.nombre.trim(), prec, prec]
        )
      }

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
  const costoTotalForm = editing
    ? calcCostoTotal(form, insumoItems, otrosItems)
    : (ficha?.costo_total ?? 0)
  const margenReal  = calcMargenReal(precioVenta, costoTotalForm)
  const margenBueno = margenReal >= 40

  // Insumos ya usados para excluirlos del selector
  const insumosCatalogDisp = insumosCatalog.filter(
    c => !insumoItems.some(i => i.insumo_id === c.id)
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto pr-1">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-light flex items-center justify-center text-accent shrink-0">
          <DollarSign size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-md font-bold text-primary truncate">Ficha de costo</p>
          <p className="text-sm text-primary-muted truncate">{productoNombre}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-base text-primary-muted py-4 text-center">Cargando…</p>
      ) : (
        <>
          {/* ── Indicadores rápidos ── */}
          {(ficha || editing) && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-sidebar border border-border rounded-xl px-3 py-2.5 text-center">
                <p className="text-2xs uppercase tracking-wider text-primary-muted font-bold mb-0.5">
                  Costo total
                </p>
                <p className="text-lg font-bold text-warning">{fmtCOP(costoTotalForm)}</p>
              </div>
              <div className="bg-sidebar border border-border rounded-xl px-3 py-2.5 text-center">
                <p className="text-2xs uppercase tracking-wider text-primary-muted font-bold mb-0.5">
                  Precio venta
                </p>
                <p className="text-lg font-bold text-primary">{fmtCOP(precioVenta)}</p>
              </div>
              <div className={cn(
                'border rounded-xl px-3 py-2.5 text-center',
                margenBueno
                  ? 'bg-success/10 border-success/30'
                  : 'bg-danger/10 border-danger/30'
              )}>
                <p className="text-2xs uppercase tracking-wider text-primary-muted font-bold mb-0.5">
                  Margen real
                </p>
                <p className={cn(
                  'text-lg font-bold flex items-center justify-center gap-1',
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
              <p className="text-base font-semibold text-primary">
                {ficha ? `Versión ${ficha.version} (vigente)` : 'Sin ficha de costo'}
              </p>
              {!editing && (
                <button onClick={startEditing} className="btn-primary px-3">
                  <Plus size={13} />
                  {ficha ? 'Nueva versión' : 'Crear ficha'}
                </button>
              )}
            </div>

            {editing ? (
              <div className="flex flex-col gap-3">

                {/* ── Confección ── */}
                <div className="flex flex-col border-b border-border/40 pb-2 gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-primary-muted">Confección / Mano de obra</span>
                    <input
                      type="number" min="0" step="100"
                      value={form.costo_confeccion}
                      onChange={e => setF('costo_confeccion', e.target.value)}
                      placeholder="0"
                      className="w-32 text-right text-base font-semibold bg-transparent
                                 border border-border rounded-lg px-2 py-1
                                 focus:outline-none focus:border-accent text-primary"
                    />
                  </div>
                  {costoConfeccionSugerido > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setF('costo_confeccion', costoConfeccionSugerido.toString())}
                        className="flex items-center gap-1 text-xs font-semibold
                                   text-warning border border-warning/30 rounded-full
                                   px-2 py-0.5 hover:bg-warning/10 transition-colors"
                      >
                        Orden: {fmtCOP(costoConfeccionSugerido)} ← usar
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Telas ── */}
                <CostoFila label="Telas / Materiales" value={form.costo_tela} editing onChange={v => setF('costo_tela', v)} />

                {/* ── Insumos del catálogo ── */}
                <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-primary-muted font-medium">Insumos</span>
                    <span className="text-sm font-semibold text-primary">
                      {fmtCOP(insumoItems.reduce((s, i) => s + num(i.cantidad) * num(i.precio), 0))}
                    </span>
                  </div>

                  {insumoItems.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      {/* Header */}
                      <div className="grid grid-cols-[1fr_80px_100px_28px] gap-1 px-1">
                        <span className="text-2xs uppercase tracking-wide text-primary-muted/60">Insumo</span>
                        <span className="text-2xs uppercase tracking-wide text-primary-muted/60 text-right">Cant.</span>
                        <span className="text-2xs uppercase tracking-wide text-primary-muted/60 text-right">P. unit.</span>
                        <span />
                      </div>
                      {insumoItems.map(item => (
                        <div key={item._key} className="grid grid-cols-[1fr_80px_100px_28px] gap-1 items-center">
                          <span className="text-sm text-primary truncate px-1">{item.nombre}</span>
                          <input
                            type="number" min="0.01" step="0.01"
                            value={item.cantidad}
                            onChange={e => updateInsumoItem(item._key, 'cantidad', e.target.value)}
                            className="input text-right text-sm py-1 h-7"
                          />
                          <input
                            type="number" min="0" step="100"
                            value={item.precio}
                            onChange={e => updateInsumoItem(item._key, 'precio', e.target.value)}
                            className="input text-right text-sm py-1 h-7"
                          />
                          <button
                            type="button"
                            onClick={() => removeInsumoItem(item._key)}
                            className="text-primary-muted hover:text-danger transition-colors flex items-center justify-center"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {insumosCatalogDisp.length > 0 && (
                    <div className="mt-1">
                      <ComboSelect
                        value=""
                        onChange={addInsumoFromCatalog}
                        options={insumosCatalogDisp.map(c => ({
                          value: String(c.id),
                          label: `${c.nombre} (${fmtCOP(c.precio_ultimo)}/${c.unidad})`
                        }))}
                        placeholder="+ Agregar insumo del catálogo…"
                        clearable={false}
                      />
                    </div>
                  )}
                </div>

                {/* ── Fotografía ── */}
                <div className="flex flex-col border-b border-border/40 pb-2 gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-primary-muted">Fotografía (porción)</span>
                    <input
                      type="number" min="0" step="100"
                      value={form.costo_foto}
                      onChange={e => setF('costo_foto', e.target.value)}
                      placeholder="0"
                      className="input text-right text-base py-1 h-7 w-36 shrink-0"
                    />
                  </div>
                  {costoFotoSugerido > 0 && (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-primary-muted/70">Sesión fotográfica sugiere:</span>
                      <button
                        type="button"
                        onClick={() => setF('costo_foto', costoFotoSugerido.toString())}
                        className="text-xs px-2 py-0.5 rounded-full border border-accent/40
                                   bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                      >
                        Usar {fmtCOP(costoFotoSugerido)}/ud
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Otros costos libres ── */}
                <div className="flex flex-col gap-1.5 border-b border-border/40 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-primary-muted font-medium">Otros costos</span>
                    <span className="text-sm font-semibold text-primary">
                      {fmtCOP(otrosItems.reduce((s, i) => s + num(i.precio), 0))}
                    </span>
                  </div>

                  {otrosItems.map(item => (
                    <div key={item._key} className="grid grid-cols-[1fr_100px_28px] gap-1 items-center">
                      <input
                        type="text"
                        value={item.nombre}
                        onChange={e => updateOtroItem(item._key, 'nombre', e.target.value)}
                        placeholder="Descripción del costo…"
                        className="input text-sm py-1 h-7"
                      />
                      <input
                        type="number" min="0" step="100"
                        value={item.precio}
                        onChange={e => updateOtroItem(item._key, 'precio', e.target.value)}
                        placeholder="Monto"
                        className="input text-right text-sm py-1 h-7"
                      />
                      <button
                        type="button"
                        onClick={() => removeOtroItem(item._key)}
                        className="text-primary-muted hover:text-danger transition-colors flex items-center justify-center"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addOtroItem}
                    className="flex items-center gap-1 text-xs text-primary-muted
                               hover:text-primary transition-colors self-start mt-0.5"
                  >
                    <Plus size={12} /> Agregar otro costo
                  </button>
                </div>

                {/* ── Total ── */}
                <div className="flex items-center justify-between py-1 mt-1 border-t-2 border-border">
                  <span className="text-base font-bold text-primary">Costo total calculado</span>
                  <span className="text-md font-bold text-warning">{fmtCOP(calcCostoTotal(form, insumoItems, otrosItems))}</span>
                </div>

                {/* ── Margen y precio ── */}
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div className="flex flex-col gap-1">
                    <label className="input-label">Margen objetivo %</label>
                    <input
                      type="number" min="0" max="99" step="1"
                      value={form.margen_objetivo_pct}
                      onChange={e => setF('margen_objetivo_pct', e.target.value)}
                      placeholder="50"
                      className="input text-base"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="input-label">Precio sugerido</label>
                    <input
                      type="number" min="0"
                      value={form.precio_venta_sugerido}
                      onChange={e => setF('precio_venta_sugerido', e.target.value)}
                      placeholder="0"
                      className="input text-base"
                    />
                  </div>
                </div>

                {/* ── Notas ── */}
                <div className="flex flex-col gap-1 mt-1">
                  <label className="input-label">Notas</label>
                  <textarea
                    value={form.notas}
                    onChange={e => setF('notas', e.target.value)}
                    rows={2}
                    placeholder="Cambios respecto a versión anterior…"
                    className="input resize-none text-base"
                  />
                </div>

                {/* ── Botones ── */}
                <div className="flex gap-2 justify-end mt-3">
                  <button onClick={() => setEditing(false)} className="btn-ghost" disabled={saving}>
                    <X size={13} /> Cancelar
                  </button>
                  <button onClick={handleSave} className="btn-primary" disabled={saving}>
                    <Check size={13} />
                    {saving ? 'Guardando…' : 'Guardar versión'}
                  </button>
                </div>
              </div>

            ) : ficha ? (
              <div>
                <CostoFila label="Confección / Mano de obra" value={ficha.costo_confeccion} />
                <CostoFila label="Telas / Materiales"        value={ficha.costo_tela} />

                {/* Insumos con desglose si existe */}
                {insumoItems.length > 0 ? (
                  <div className="py-1.5 border-b border-border/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-primary-muted">Insumos</span>
                      <span className="text-base text-primary font-medium">{fmtCOP(ficha.costo_insumos_total)}</span>
                    </div>
                    {insumoItems.map(item => (
                      <div key={item._key} className="flex justify-between text-xs text-primary-muted/70 pl-3 py-0.5">
                        <span>{item.nombre} × {num(item.cantidad)}</span>
                        <span>{fmtCOP(num(item.cantidad) * num(item.precio))}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <CostoFila label="Insumos" value={ficha.costo_insumos_total} />
                )}

                <CostoFila label="Fotografía (porción)" value={ficha.costo_foto} />

                {/* Otros con desglose si existe */}
                {otrosItems.length > 0 ? (
                  <div className="py-1.5 border-b border-border/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-primary-muted">Otros costos</span>
                      <span className="text-base text-primary font-medium">{fmtCOP(ficha.otros_costos)}</span>
                    </div>
                    {otrosItems.map(item => (
                      <div key={item._key} className="flex justify-between text-xs text-primary-muted/70 pl-3 py-0.5">
                        <span>{item.nombre}</span>
                        <span>{fmtCOP(num(item.precio))}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <CostoFila label="Otros costos" value={ficha.otros_costos} />
                )}

                <div className="flex items-center justify-between py-2 mt-1 border-t-2 border-border">
                  <span className="text-base font-bold text-primary">Costo total</span>
                  <span className="text-md font-bold text-warning">{fmtCOP(ficha.costo_total)}</span>
                </div>
                {ficha.precio_venta_sugerido > 0 && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-primary-muted">
                      Precio sugerido ({fmtPct(ficha.margen_objetivo_pct)} margen)
                    </span>
                    <span className="text-base text-accent font-medium">{fmtCOP(ficha.precio_venta_sugerido)}</span>
                  </div>
                )}
                {ficha.notas && (
                  <p className="text-sm text-primary-muted mt-2 italic">{ficha.notas}</p>
                )}
                <p className="text-xs text-primary-muted/50 mt-2">
                  Creada: {new Date(ficha.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>
            ) : (
              <p className="text-base text-primary-muted py-2">
                Todavía no tiene ficha de costo. Creá la primera versión.
              </p>
            )}
          </div>

          {/* ── Historial de versiones ── */}
          {historial.length > 1 && (
            <div>
              <button
                onClick={() => setShowHist(s => !s)}
                className="flex items-center gap-2 text-sm text-primary-muted hover:text-primary transition-colors"
              >
                {showHist ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <History size={13} />
                Historial de versiones ({historial.length})
              </button>

              {showHist && (
                <div className="mt-2 flex flex-col gap-2">
                  {historial.filter(f => !f.vigente).map(f => (
                    <div key={f.id} className="border border-border/50 rounded-xl px-4 py-3 opacity-60">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-primary-muted">Versión {f.version}</span>
                        <span className="text-sm text-warning">{fmtCOP(f.costo_total)}</span>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-primary-muted/70">
                        <span>Conf: {fmtCOP(f.costo_confeccion)}</span>
                        <span>Tela: {fmtCOP(f.costo_tela)}</span>
                        <span>Ins: {fmtCOP(f.costo_insumos_total)}</span>
                      </div>
                      <p className="text-xs text-primary-muted/50 mt-1">
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

