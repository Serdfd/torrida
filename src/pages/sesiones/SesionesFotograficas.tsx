import { useEffect, useState, useCallback } from 'react'
import {
  Camera, Plus, ChevronDown, ChevronRight,
  Trash2, Pencil, X, Check, Receipt, Package
} from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { formatCOP } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Spinner from '@/components/ui/Spinner'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Sesion {
  id:          number
  fecha:       string
  fotografo:   string | null
  costo_total: number
  notas:       string | null
  created_at:  string
}

interface GastoSesion {
  id:          number
  sesion_id:   number
  descripcion: string
  monto:       number
}

interface ProductoSesion {
  id:                   number
  sesion_id:            number
  producto_id:          number
  producto_nombre:      string
  cantidad_unidades:    number
  costo_foto_calculado: number
}

interface Producto {
  id:          number
  nombre:      string
  stock_total: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtFecha(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Formulario sesión (crear/editar) ───────────────────────────────────────

interface SesionFormState {
  fecha:     string
  fotografo: string
  notas:     string
}

const EMPTY_FORM: SesionFormState = {
  fecha:     new Date().toISOString().slice(0, 10),
  fotografo: '',
  notas:     '',
}

function SesionForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?:  SesionFormState
  onSave:    (f: SesionFormState) => void
  onCancel:  () => void
}) {
  const [form, setForm] = useState<SesionFormState>(initial ?? EMPTY_FORM)

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (form.fecha) onSave(form) }}
      className="card flex flex-col gap-4"
    >
      <p className="text-[14px] font-semibold text-primary">
        {initial ? 'Editar sesión' : 'Nueva sesión fotográfica'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="input-label">Fecha *</label>
          <input
            type="date"
            value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
            className="input"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="input-label">Fotógrafo / Estudio</label>
          <input
            type="text"
            value={form.fotografo}
            onChange={e => setForm(f => ({ ...f, fotografo: e.target.value }))}
            placeholder="Nombre del fotógrafo"
            className="input"
          />
        </div>
      </div>

      {/* Costo total — informativo, se calcula automáticamente */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sidebar border border-border">
        <Receipt size={15} className="text-accent shrink-0" />
        <div className="flex-1">
          <p className="text-[12px] font-bold uppercase tracking-wider text-primary-muted">
            Costo total
          </p>
          <p className="text-[12.5px] text-primary-muted mt-0.5">
            Se calcula automáticamente sumando los gastos de la sesión
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="input-label">Notas</label>
        <textarea
          value={form.notas}
          onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
          placeholder="Observaciones, locación, modelo…"
          rows={2}
          className="input resize-none"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-ghost text-[13px]">
          Cancelar
        </button>
        <button type="submit" className="btn-primary text-[13px]">
          <Check size={14} /> Guardar
        </button>
      </div>
    </form>
  )
}

// ── Panel de detalle de sesión ─────────────────────────────────────────────

function SesionDetalle({
  sesion,
  productos,
  onRefresh,
}: {
  sesion:    Sesion
  productos: Producto[]
  onRefresh: (costoNuevo: number) => void
}) {
  const toast = useToast()

  const [gastos,        setGastos]        = useState<GastoSesion[]>([])
  const [prods,         setProds]         = useState<ProductoSesion[]>([])
  const [loading,       setLoading]       = useState(true)
  const [showGastoForm, setShowGastoForm] = useState(false)
  const [gDesc,         setGDesc]         = useState('')
  const [gMonto,        setGMonto]        = useState('')
  const [showProdForm,  setShowProdForm]  = useState(false)
  const [pProdId,       setPProdId]       = useState('')
  const [pUnidades,     setPUnidades]     = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [g, p] = await Promise.all([
        window.electronAPI.db.query<GastoSesion>(
          `SELECT * FROM sesion_fotografica_items WHERE sesion_id = ? ORDER BY id`,
          [sesion.id]
        ),
        window.electronAPI.db.query<ProductoSesion>(
          `SELECT sfp.*, pr.nombre AS producto_nombre
           FROM sesion_fotografica_productos sfp
           JOIN productos pr ON pr.id = sfp.producto_id
           WHERE sfp.sesion_id = ? ORDER BY sfp.id`,
          [sesion.id]
        ),
      ])
      setGastos(g)
      setProds(p as unknown as ProductoSesion[])
    } finally {
      setLoading(false)
    }
  }, [sesion.id])

  useEffect(() => { loadData() }, [loadData])

  async function recalcularCostosFoto(costoTotal: number, prodsList: ProductoSesion[]) {
    const totalUnidades = prodsList.reduce((s, p) => s + p.cantidad_unidades, 0)
    if (totalUnidades === 0) return
    const costoPorUnidad = costoTotal / totalUnidades
    for (const p of prodsList) {
      const calculado = Math.round(costoPorUnidad * p.cantidad_unidades)
      await window.electronAPI.db.run(
        `UPDATE sesion_fotografica_productos SET costo_foto_calculado = ? WHERE id = ?`,
        [calculado, p.id]
      )
    }
  }

  async function actualizarCostoTotal(gastosList: GastoSesion[]): Promise<number> {
    const nuevo = gastosList.reduce((s, g) => s + g.monto, 0)
    await window.electronAPI.db.run(
      `UPDATE sesiones_fotograficas SET costo_total = ?, updated_at = datetime('now') WHERE id = ?`,
      [nuevo, sesion.id]
    )
    return nuevo
  }

  async function handleAddGasto(e: React.FormEvent) {
    e.preventDefault()
    if (!gDesc.trim()) return
    try {
      await window.electronAPI.db.run(
        `INSERT INTO sesion_fotografica_items (sesion_id, descripcion, monto) VALUES (?, ?, ?)`,
        [sesion.id, gDesc.trim(), parseFloat(gMonto) || 0]
      )
      const nuevosGastos = [
        ...gastos,
        { id: 0, sesion_id: sesion.id, descripcion: gDesc.trim(), monto: parseFloat(gMonto) || 0 }
      ]
      const costoNuevo = await actualizarCostoTotal(nuevosGastos)
      setGDesc(''); setGMonto(''); setShowGastoForm(false)
      await loadData()
      await recalcularCostosFoto(costoNuevo, prods)
      await loadData()
      onRefresh(costoNuevo)
      toast.success('Gasto agregado')
    } catch {
      toast.error('Error al agregar gasto')
    }
  }

  async function handleDeleteGasto(id: number) {
    try {
      await window.electronAPI.db.run(`DELETE FROM sesion_fotografica_items WHERE id = ?`, [id])
      const nuevosGastos = gastos.filter(g => g.id !== id)
      const costoNuevo = await actualizarCostoTotal(nuevosGastos)
      await recalcularCostosFoto(costoNuevo, prods)
      await loadData()
      onRefresh(costoNuevo)
      toast.success('Gasto eliminado')
    } catch {
      toast.error('Error al eliminar gasto')
    }
  }

  async function handleAddProd(e: React.FormEvent) {
    e.preventDefault()
    if (!pProdId) return
    if (prods.some(p => p.producto_id === parseInt(pProdId))) {
      toast.warning('Este producto ya está en la sesión')
      return
    }
    try {
      await window.electronAPI.db.run(
        `INSERT INTO sesion_fotografica_productos
           (sesion_id, producto_id, cantidad_unidades, costo_foto_calculado)
         VALUES (?, ?, ?, 0)`,
        [sesion.id, parseInt(pProdId), parseFloat(pUnidades) || 1]
      )
      setPProdId(''); setPUnidades(''); setShowProdForm(false)
      const nuevosProds = await window.electronAPI.db.query<ProductoSesion>(
        `SELECT sfp.*, pr.nombre AS producto_nombre
         FROM sesion_fotografica_productos sfp
         JOIN productos pr ON pr.id = sfp.producto_id
         WHERE sfp.sesion_id = ? ORDER BY sfp.id`,
        [sesion.id]
      ) as unknown as ProductoSesion[]
      await recalcularCostosFoto(sesion.costo_total, nuevosProds)
      await loadData()
      toast.success('Producto agregado')
    } catch {
      toast.error('Error al agregar producto')
    }
  }

  async function handleUpdateUnidades(prodId: number, nuevasUnidades: number) {
    try {
      await window.electronAPI.db.run(
        `UPDATE sesion_fotografica_productos SET cantidad_unidades = ? WHERE id = ?`,
        [nuevasUnidades, prodId]
      )
      const nuevosProds = prods.map(p =>
        p.id === prodId ? { ...p, cantidad_unidades: nuevasUnidades } : p
      )
      await recalcularCostosFoto(sesion.costo_total, nuevosProds)
      await loadData()
    } catch {
      toast.error('Error al actualizar unidades')
    }
  }

  async function handleDeleteProd(id: number) {
    try {
      await window.electronAPI.db.run(`DELETE FROM sesion_fotografica_productos WHERE id = ?`, [id])
      const nuevosProds = prods.filter(p => p.id !== id)
      await recalcularCostosFoto(sesion.costo_total, nuevosProds)
      await loadData()
      toast.success('Producto eliminado')
    } catch {
      toast.error('Error al eliminar producto')
    }
  }

  const totalUnidades = prods.reduce((s, p) => s + p.cantidad_unidades, 0)
  const costoPorUnidad = totalUnidades > 0 ? sesion.costo_total / totalUnidades : 0

  if (loading) return (
    <div className="py-4 flex justify-center bg-card/40 border-t border-border/30">
      <Spinner size="sm" />
    </div>
  )

  return (
    <div className="px-4 pb-5 pt-3 grid grid-cols-2 gap-4 bg-card/40 border-t border-border/30">

      {/* ── Gastos de la sesión ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={13} className="text-accent" />
            <p className="text-[12.5px] font-bold uppercase tracking-wider text-primary-muted">
              Gastos de la sesión
            </p>
          </div>
          <span className="text-[13px] font-bold text-warning">
            {formatCOP(sesion.costo_total)}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          {gastos.length === 0 && !showGastoForm && (
            <p className="text-[12px] text-primary-muted py-1">Sin gastos registrados.</p>
          )}
          {gastos.map(g => (
            <div key={g.id}
              className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
              <span className="flex-1 text-[13px] text-primary">{g.descripcion}</span>
              <span className="text-[13px] font-semibold text-warning shrink-0">
                {formatCOP(g.monto)}
              </span>
              <button
                onClick={() => handleDeleteGasto(g.id)}
                className="text-primary-muted hover:text-danger transition-colors shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        {showGastoForm ? (
          <form onSubmit={handleAddGasto}
            className="flex flex-col gap-2 p-3 rounded-xl border border-accent/30 bg-accent-light/20">
            <div>
              <label className="input-label">Concepto *</label>
              <input
                type="text"
                value={gDesc}
                onChange={e => setGDesc(e.target.value)}
                placeholder="Fotógrafo, estudio, modelo…"
                className="input h-8 text-[13px]"
                autoFocus
              />
            </div>
            <div>
              <label className="input-label">Monto</label>
              <input
                type="number"
                min="0"
                step="1"
                value={gMonto}
                onChange={e => setGMonto(e.target.value)}
                placeholder="0"
                className="input h-8 text-[13px]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button"
                onClick={() => { setShowGastoForm(false); setGDesc(''); setGMonto('') }}
                className="btn-ghost h-8 text-[12px]">
                <X size={12} /> Cancelar
              </button>
              <button type="submit" className="btn-primary h-8 text-[12px]">
                <Check size={12} /> Agregar
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowGastoForm(true)}
            className="flex items-center gap-1.5 text-[12.5px] text-accent
                       hover:text-accent/80 transition-colors self-start">
            <Plus size={13} /> Agregar gasto
          </button>
        )}
      </div>

      {/* ── Productos fotografiados ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={13} className="text-accent" />
            <p className="text-[12.5px] font-bold uppercase tracking-wider text-primary-muted">
              Productos fotografiados
            </p>
          </div>
          {totalUnidades > 0 && (
            <span className="text-[11.5px] text-primary-muted">
              {formatCOP(Math.round(costoPorUnidad))}/ud · {totalUnidades} uds
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {prods.length === 0 && !showProdForm && (
            <p className="text-[12px] text-primary-muted py-1">Sin productos asignados.</p>
          )}
          {prods.map(p => (
            <div key={p.id}
              className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
              <span className="flex-1 text-[13px] text-primary truncate">{p.producto_nombre}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={p.cantidad_unidades}
                onChange={e => handleUpdateUnidades(p.id, parseFloat(e.target.value) || 1)}
                className="input h-7 text-[12px] text-center w-20 shrink-0"
                title="Unidades fotografiadas"
              />
              <span className="text-[12px] font-semibold text-accent shrink-0 w-24 text-right">
                {formatCOP(p.costo_foto_calculado)}
              </span>
              <button
                onClick={() => handleDeleteProd(p.id)}
                className="text-primary-muted hover:text-danger transition-colors shrink-0">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        {showProdForm ? (
          <form onSubmit={handleAddProd}
            className="flex flex-col gap-2 p-3 rounded-xl border border-accent/30 bg-accent-light/20">
            <div>
              <label className="input-label">Producto *</label>
              <select
                value={pProdId}
                onChange={e => {
                  setPProdId(e.target.value)
                  if (e.target.value) {
                    const prod = productos.find(pp => pp.id === parseInt(e.target.value))
                    if (prod) setPUnidades(String(Math.max(1, Math.round(prod.stock_total))))
                  }
                }}
                className="input text-[13px]"
                autoFocus
              >
                <option value="">— Seleccionar —</option>
                {productos
                  .filter(p => !prods.some(pp => pp.producto_id === p.id))
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))
                }
              </select>
            </div>
            <div>
              <label className="input-label">Unidades fotografiadas</label>
              <input
                type="number"
                min="1"
                step="1"
                value={pUnidades}
                onChange={e => setPUnidades(e.target.value)}
                placeholder="1"
                className="input text-[13px]"
              />
              <p className="text-[11px] text-primary-muted mt-1">
                Pre-cargado desde stock actual. Editable.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button"
                onClick={() => { setShowProdForm(false); setPProdId(''); setPUnidades('') }}
                className="btn-ghost h-8 text-[12px]">
                <X size={12} /> Cancelar
              </button>
              <button type="submit" className="btn-primary h-8 text-[12px]">
                <Check size={12} /> Agregar
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowProdForm(true)}
            className="flex items-center gap-1.5 text-[12.5px] text-accent
                       hover:text-accent/80 transition-colors self-start">
            <Plus size={13} /> Agregar producto
          </button>
        )}
      </div>
    </div>
  )
}

// ── Fila de sesión ─────────────────────────────────────────────────────────

function SesionFila({
  sesion,
  productos,
  onEdit,
  onDelete,
  onCostoChange,
}: {
  sesion:        Sesion
  productos:     Producto[]
  onEdit:        (s: Sesion) => void
  onDelete:      (s: Sesion) => void
  onCostoChange: (id: number, costo: number) => void
}) {
  const [expanded,   setExpanded]   = useState(false)
  const [costoLocal, setCostoLocal] = useState(sesion.costo_total)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-card/80 transition-colors">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-primary-muted hover:text-primary transition-colors shrink-0"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <span className="text-[13px] font-semibold text-primary w-24 shrink-0">
          {fmtFecha(sesion.fecha)}
        </span>

        <span className="text-[13px] text-primary-muted flex-1 truncate">
          {sesion.fotografo || '—'}
        </span>

        <span className="text-[13px] font-semibold text-warning w-32 text-right shrink-0">
          {formatCOP(costoLocal)}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(sesion)}
            className="p-1.5 rounded-lg text-primary-muted hover:text-accent hover:bg-accent/10 transition-colors"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(sesion)}
            className="p-1.5 rounded-lg text-primary-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {sesion.notas && (
        <div className="px-4 pb-2 pt-1.5 text-[12px] text-primary-muted
                        border-t border-border/30 bg-card">
          {sesion.notas}
        </div>
      )}

      {expanded && (
        <SesionDetalle
          sesion={{ ...sesion, costo_total: costoLocal }}
          productos={productos}
          onRefresh={costo => {
            setCostoLocal(costo)
            onCostoChange(sesion.id, costo)
          }}
        />
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

export default function SesionesFotograficas() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [sesiones,  setSesiones]  = useState<Sesion[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editando,  setEditando]  = useState<Sesion | null>(null)

  const loadSesiones = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await window.electronAPI.db.query<Sesion>(
        `SELECT * FROM sesiones_fotograficas ORDER BY fecha DESC`
      )
      setSesiones(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSesiones()
    window.electronAPI.db.query<Producto>(
      `SELECT p.id, p.nombre,
              COALESCE((
                SELECT SUM(ip.stock)
                FROM inventario_productos ip
                WHERE ip.producto_id = p.id
              ), 0) AS stock_total
       FROM productos p WHERE p.activo = 1 ORDER BY p.nombre`
    ).then(rows => setProductos(rows))
  }, [loadSesiones])

  async function handleSave(form: SesionFormState) {
    try {
      if (editando) {
        await window.electronAPI.db.run(
          `UPDATE sesiones_fotograficas
           SET fecha = ?, fotografo = ?, notas = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [form.fecha, form.fotografo || null, form.notas || null, editando.id]
        )
        toast.success('Sesión actualizada')
      } else {
        await window.electronAPI.db.run(
          `INSERT INTO sesiones_fotograficas (fecha, fotografo, costo_total, notas)
           VALUES (?, ?, 0, ?)`,
          [form.fecha, form.fotografo || null, form.notas || null]
        )
        toast.success('Sesión registrada')
      }
      setShowForm(false); setEditando(null)
      loadSesiones()
    } catch {
      toast.error('Error al guardar la sesión')
    }
  }

  function handleDelete(sesion: Sesion) {
    openModal(
      <ConfirmDialog
        title="Eliminar sesión fotográfica"
        description={`¿Eliminar la sesión del ${fmtFecha(sesion.fecha)}? Se eliminarán también sus gastos y productos.`}
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM sesiones_fotograficas WHERE id = ?`, [sesion.id]
            )
            toast.success('Sesión eliminada')
            loadSesiones()
          } catch {
            toast.error('Error al eliminar')
          }
        }}
      />
    )
  }

  function handleEdit(sesion: Sesion) {
    setEditando(sesion)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCostoChange(id: number, costo: number) {
    setSesiones(prev => prev.map(s => s.id === id ? { ...s, costo_total: costo } : s))
  }

  const formInitial: SesionFormState | undefined = editando
    ? { fecha: editando.fecha, fotografo: editando.fotografo ?? '', notas: editando.notas ?? '' }
    : undefined

  const totalCosto = sesiones.reduce((s, ses) => s + ses.costo_total, 0)

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center
                        justify-center text-accent shrink-0">
          <Camera size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-[17px] font-bold text-primary">Sesiones Fotográficas</h2>
          <p className="text-[12.5px] text-primary-muted">
            Registra gastos y distribución de costos entre productos
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditando(null); setShowForm(true) }}
            className="btn-primary text-[13px]"
          >
            <Plus size={15} /> Nueva sesión
          </button>
        )}
      </div>

      {/* KPIs — siempre arriba, antes del formulario */}
      {!loading && sesiones.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-sidebar border border-border rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-muted mb-1">
              Total sesiones
            </p>
            <p className="text-[22px] font-bold text-accent">{sesiones.length}</p>
          </div>
          <div className="bg-sidebar border border-border rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-muted mb-1">
              Inversión total
            </p>
            <p className="text-[22px] font-bold text-warning">{formatCOP(totalCosto)}</p>
          </div>
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <SesionForm
          initial={formInitial}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditando(null) }}
        />
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="lg" /></div>
      ) : sesiones.length === 0 ? (
        <div className="card text-center py-12">
          <Camera size={40} className="mx-auto text-primary-muted/30 mb-3" />
          <p className="text-[14px] text-primary-muted">No hay sesiones registradas.</p>
          <p className="text-[12px] text-primary-muted/60 mt-1">
            Registrá tu primera sesión fotográfica para llevar el control de costos.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-4
                          text-[11px] font-bold uppercase tracking-wider text-primary-muted">
            <span className="w-4 shrink-0" />
            <span className="w-24 shrink-0">Fecha</span>
            <span className="flex-1">Fotógrafo / Estudio</span>
            <span className="w-32 text-right shrink-0">Costo total</span>
            <span className="w-16 shrink-0" />
          </div>

          {sesiones.map(sesion => (
            <SesionFila
              key={sesion.id}
              sesion={sesion}
              productos={productos}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCostoChange={handleCostoChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
