import { useEffect, useState, useCallback } from 'react'
import { Camera, Plus, ChevronDown, ChevronRight, Trash2, Pencil, X, Check } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useModal } from '@/store/useAppStore'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Sesion {
  id:             number
  fecha:          string
  fotografo:      string | null
  costo_total:    number
  cantidad_looks: number
  notas:          string | null
  created_at:     string
}

interface SesionItem {
  id:             number
  sesion_id:      number
  producto_id:    number | null
  producto_nombre?: string
  descripcion:    string | null
  costo_asignado: number
}

interface Producto {
  id:     number
  nombre: string
}

// ── Formulario de sesión ───────────────────────────────────────────────────

interface SesionFormState {
  fecha:          string
  fotografo:      string
  costo_total:    string
  cantidad_looks: string
  notas:          string
}

const EMPTY_FORM: SesionFormState = {
  fecha:          new Date().toISOString().slice(0, 10),
  fotografo:      '',
  costo_total:    '',
  cantidad_looks: '',
  notas:          '',
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

  function set(k: keyof SesionFormState, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
      <p className="text-[14px] font-semibold text-primary">
        {initial ? 'Editar sesión' : 'Nueva sesión fotográfica'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Fecha */}
        <div className="flex flex-col gap-1">
          <label className="input-label">Fecha *</label>
          <input
            type="date"
            value={form.fecha}
            onChange={e => set('fecha', e.target.value)}
            className="input"
            required
          />
        </div>

        {/* Fotógrafo */}
        <div className="flex flex-col gap-1">
          <label className="input-label">Fotógrafo / Estudio</label>
          <input
            type="text"
            value={form.fotografo}
            onChange={e => set('fotografo', e.target.value)}
            placeholder="Nombre del fotógrafo"
            className="input"
          />
        </div>

        {/* Costo total */}
        <div className="flex flex-col gap-1">
          <label className="input-label">Costo total</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.costo_total}
            onChange={e => set('costo_total', e.target.value)}
            placeholder="0"
            className="input"
          />
        </div>

        {/* Cantidad de looks */}
        <div className="flex flex-col gap-1">
          <label className="input-label">Cantidad de looks</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.cantidad_looks}
            onChange={e => set('cantidad_looks', e.target.value)}
            placeholder="0"
            className="input"
          />
        </div>
      </div>

      {/* Notas */}
      <div className="flex flex-col gap-1">
        <label className="input-label">Notas</label>
        <textarea
          value={form.notas}
          onChange={e => set('notas', e.target.value)}
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
          <Check size={14} />
          Guardar
        </button>
      </div>
    </form>
  )
}

// ── Panel de items de sesión ───────────────────────────────────────────────

function ItemsPanel({
  sesion,
  productos,
  onRefresh,
}: {
  sesion:    Sesion
  productos: Producto[]
  onRefresh: () => void
}) {
  const toast = useToast()
  const [items,     setItems]     = useState<SesionItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)

  // form estado item
  const [iProdId,  setIProdId]  = useState<string>('')
  const [iDesc,    setIDesc]    = useState('')
  const [iCosto,   setICosto]   = useState('')

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await window.electronAPI.db.query(
        `SELECT sfi.*, p.nombre AS producto_nombre
         FROM sesion_fotografica_items sfi
         LEFT JOIN productos p ON p.id = sfi.producto_id
         WHERE sfi.sesion_id = ?
         ORDER BY sfi.id`,
        [sesion.id]
      )
      setItems(rows as unknown as SesionItem[])
    } finally {
      setLoading(false)
    }
  }, [sesion.id])

  useEffect(() => { loadItems() }, [loadItems])

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!iDesc && !iProdId) return
    try {
      await window.electronAPI.db.run(
        `INSERT INTO sesion_fotografica_items
           (sesion_id, producto_id, descripcion, costo_asignado)
         VALUES (?, ?, ?, ?)`,
        [
          sesion.id,
          iProdId ? parseInt(iProdId) : null,
          iDesc || null,
          parseFloat(iCosto) || 0,
        ]
      )
      // Actualizar costo_total de la sesión
      const newCosto = items.reduce((s, it) => s + it.costo_asignado, parseFloat(iCosto) || 0)
      await window.electronAPI.db.run(
        `UPDATE sesiones_fotograficas SET costo_total=?, updated_at=datetime('now') WHERE id=?`,
        [newCosto, sesion.id]
      )
      setIProdId(''); setIDesc(''); setICosto('')
      setShowForm(false)
      await loadItems()
      onRefresh()
      toast.success('Item agregado')
    } catch {
      toast.error('Error al agregar item')
    }
  }

  async function handleDeleteItem(id: number, costo: number) {
    try {
      await window.electronAPI.db.run(
        `DELETE FROM sesion_fotografica_items WHERE id=?`,
        [id]
      )
      const newCosto = Math.max(0, sesion.costo_total - costo)
      await window.electronAPI.db.run(
        `UPDATE sesiones_fotograficas SET costo_total=?, updated_at=datetime('now') WHERE id=?`,
        [newCosto, sesion.id]
      )
      await loadItems()
      onRefresh()
      toast.success('Item eliminado')
    } catch {
      toast.error('Error al eliminar item')
    }
  }

  const fmtCop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="mt-3 pl-4 border-l-2 border-border">
      {loading ? (
        <p className="text-[12px] text-primary-muted py-2">Cargando…</p>
      ) : (
        <>
          {items.length === 0 && !showForm && (
            <p className="text-[12px] text-primary-muted py-1">Sin items registrados.</p>
          )}

          {/* Lista de items */}
          {items.map(item => (
            <div key={item.id}
              className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 gap-2">
              <div className="flex-1 min-w-0">
                {item.producto_nombre && (
                  <span className="text-[12px] font-semibold text-primary mr-2">
                    {item.producto_nombre}
                  </span>
                )}
                {item.descripcion && (
                  <span className="text-[12px] text-primary-muted">{item.descripcion}</span>
                )}
              </div>
              <span className="text-[12px] text-warning shrink-0">{fmtCop(item.costo_asignado)}</span>
              <button
                onClick={() => handleDeleteItem(item.id, item.costo_asignado)}
                className="text-primary-muted hover:text-danger transition-colors shrink-0"
                title="Eliminar item"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {/* Formulario inline para nuevo item */}
          {showForm ? (
            <form onSubmit={handleAddItem} className="flex flex-wrap gap-2 mt-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="input-label">Producto (opcional)</label>
                <select
                  value={iProdId}
                  onChange={e => setIProdId(e.target.value)}
                  className="input text-[12px] py-1.5"
                >
                  <option value="">Sin producto</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                <label className="input-label">Descripción</label>
                <input
                  type="text"
                  value={iDesc}
                  onChange={e => setIDesc(e.target.value)}
                  placeholder="Look, outfit…"
                  className="input text-[12px] py-1.5"
                />
              </div>
              <div className="flex flex-col gap-1 w-28">
                <label className="input-label">Costo asignado</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={iCosto}
                  onChange={e => setICosto(e.target.value)}
                  placeholder="0"
                  className="input text-[12px] py-1.5"
                />
              </div>
              <div className="flex gap-1 pb-0.5">
                <button type="submit" className="btn-primary text-[12px] py-1.5 px-3">
                  <Check size={13} /> Agregar
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-[12px] py-1.5 px-3">
                  <X size={13} />
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 flex items-center gap-1 text-[12px] text-accent hover:text-accent/80 transition-colors"
            >
              <Plus size={13} /> Agregar item
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Fila de sesión ─────────────────────────────────────────────────────────

function SesionFila({
  sesion,
  productos,
  onEdit,
  onDelete,
  onRefresh,
}: {
  sesion:    Sesion
  productos: Producto[]
  onEdit:    (s: Sesion) => void
  onDelete:  (s: Sesion) => void
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const fmtCop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  const fmtFecha = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Fila principal */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-card/80 transition-colors">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-primary-muted hover:text-primary transition-colors shrink-0"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Fecha */}
        <span className="text-[13px] font-semibold text-primary w-24 shrink-0">
          {fmtFecha(sesion.fecha)}
        </span>

        {/* Fotógrafo */}
        <span className="text-[13px] text-primary-muted flex-1 truncate">
          {sesion.fotografo || '—'}
        </span>

        {/* Looks */}
        <span className="text-[12px] text-primary-muted w-20 text-center shrink-0">
          {sesion.cantidad_looks} looks
        </span>

        {/* Costo */}
        <span className="text-[13px] font-semibold text-warning w-32 text-right shrink-0">
          {fmtCop(sesion.costo_total)}
        </span>

        {/* Acciones */}
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

      {/* Notas */}
      {sesion.notas && (
        <div className="px-4 pb-2 text-[12px] text-primary-muted border-t border-border/30 bg-card pt-1.5">
          {sesion.notas}
        </div>
      )}

      {/* Panel de items expandible */}
      {expanded && (
        <div className="px-4 pb-4 bg-card/50 border-t border-border/30">
          <ItemsPanel sesion={sesion} productos={productos} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

export default function SesionesFotograficas() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [sesiones,   setSesiones]   = useState<Sesion[]>([])
  const [productos,  setProductos]  = useState<Producto[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editando,   setEditando]   = useState<Sesion | null>(null)

  const loadSesiones = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await window.electronAPI.db.query(
        `SELECT * FROM sesiones_fotograficas ORDER BY fecha DESC`,
        []
      )
      setSesiones(rows as unknown as Sesion[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSesiones()
    // Cargar productos activos para selects
    window.electronAPI.db.query(
      `SELECT id, nombre FROM productos WHERE activo=1 ORDER BY nombre`,
      []
    ).then(rows => setProductos(rows as unknown as Producto[]))
  }, [loadSesiones])

  // ── Guardar sesión (crear o editar) ──────────────────────────────────────
  async function handleSaveSesion(form: SesionFormState) {
    const params = [
      form.fecha,
      form.fotografo || null,
      parseFloat(form.costo_total)    || 0,
      parseInt(form.cantidad_looks)   || 0,
      form.notas || null,
    ]

    try {
      if (editando) {
        await window.electronAPI.db.run(
          `UPDATE sesiones_fotograficas
           SET fecha=?, fotografo=?, costo_total=?, cantidad_looks=?, notas=?,
               updated_at=datetime('now')
           WHERE id=?`,
          [...params, editando.id]
        )
        toast.success('Sesión actualizada')
      } else {
        await window.electronAPI.db.run(
          `INSERT INTO sesiones_fotograficas
             (fecha, fotografo, costo_total, cantidad_looks, notas)
           VALUES (?, ?, ?, ?, ?)`,
          params
        )
        toast.success('Sesión registrada')
      }
      setShowForm(false)
      setEditando(null)
      loadSesiones()
    } catch {
      toast.error('Error al guardar la sesión')
    }
  }

  // ── Eliminar sesión ───────────────────────────────────────────────────────
  function handleDeleteSesion(sesion: Sesion) {
    openModal(
      <ConfirmDialog
        title="Eliminar sesión fotográfica"
        description={`¿Eliminar la sesión del ${sesion.fecha.split('-').reverse().join('/')}? Se eliminarán también todos sus items.`}
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM sesiones_fotograficas WHERE id=?`,
              [sesion.id]
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

  // ── Editar ────────────────────────────────────────────────────────────────
  function handleEdit(sesion: Sesion) {
    setEditando(sesion)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const formInitial: SesionFormState | undefined = editando
    ? {
        fecha:          editando.fecha,
        fotografo:      editando.fotografo ?? '',
        costo_total:    editando.costo_total.toString(),
        cantidad_looks: editando.cantidad_looks.toString(),
        notas:          editando.notas ?? '',
      }
    : undefined

  const totalCosto = sesiones.reduce((s, ses) => s + ses.costo_total, 0)
  const fmtCop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center text-accent shrink-0">
          <Camera size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-[17px] font-bold text-primary">Sesiones Fotográficas</h2>
          <p className="text-[12.5px] text-primary-muted">
            Registro de sesiones y costos asignados por producto
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditando(null); setShowForm(true) }}
            className="btn-primary text-[13px]"
          >
            <Plus size={15} />
            Nueva sesión
          </button>
        )}
      </div>

      {/* Formulario crear/editar */}
      {showForm && (
        <SesionForm
          initial={formInitial}
          onSave={handleSaveSesion}
          onCancel={() => { setShowForm(false); setEditando(null) }}
        />
      )}

      {/* KPIs resumen */}
      {!loading && sesiones.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-sidebar border border-border rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-muted mb-1">
              Total sesiones
            </p>
            <p className="text-[22px] font-bold text-accent">{sesiones.length}</p>
          </div>
          <div className="bg-sidebar border border-border rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-muted mb-1">
              Looks totales
            </p>
            <p className="text-[22px] font-bold text-primary">
              {sesiones.reduce((s, ses) => s + ses.cantidad_looks, 0)}
            </p>
          </div>
          <div className="bg-sidebar border border-border rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-muted mb-1">
              Inversión total
            </p>
            <p className="text-[22px] font-bold text-warning">{fmtCop(totalCosto)}</p>
          </div>
        </div>
      )}

      {/* Lista de sesiones */}
      {loading ? (
        <p className="text-[13px] text-primary-muted">Cargando…</p>
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
          {/* Header columnas */}
          <div className="flex items-center gap-3 px-4 text-[11px] font-bold uppercase tracking-wider text-primary-muted">
            <span className="w-4 shrink-0" />
            <span className="w-24 shrink-0">Fecha</span>
            <span className="flex-1">Fotógrafo / Estudio</span>
            <span className="w-20 text-center shrink-0">Looks</span>
            <span className="w-32 text-right shrink-0">Costo total</span>
            <span className="w-16 shrink-0" />
          </div>

          {sesiones.map(sesion => (
            <SesionFila
              key={sesion.id}
              sesion={sesion}
              productos={productos}
              onEdit={handleEdit}
              onDelete={handleDeleteSesion}
              onRefresh={loadSesiones}
            />
          ))}
        </div>
      )}
    </div>
  )
}
