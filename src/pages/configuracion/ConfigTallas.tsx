import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Ruler, Check, X, GripVertical } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'

interface Talla {
  id:     number
  nombre: string
  orden:  number
  activo: number
}

interface TallaFormData {
  nombre: string
  orden:  number
}

const TALLAS_SUGERIDAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Única']

export default function ConfigTallas() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,    setLoading]    = useState(true)
  const [tallas,     setTallas]     = useState<Talla[]>([])
  const [editId,     setEditId]     = useState<number | null>(null)
  const [editData,   setEditData]   = useState<TallaFormData>({ nombre: '', orden: 0 })
  const [newData,    setNewData]    = useState<TallaFormData>({ nombre: '', orden: 0 })
  const [adding,     setAdding]     = useState(false)
  const [saving,     setSaving]     = useState(false)

  async function loadTallas() {
    setLoading(true)
    try {
      const data = await window.electronAPI.db.query<Talla>(
        `SELECT * FROM tallas ORDER BY orden ASC, nombre ASC`
      )
      setTallas(data)
    } catch {
      toast.error('Error al cargar tallas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTallas() }, [])

  // Auto orden al abrir formulario nuevo
  function openAdding() {
    const maxOrden = tallas.length > 0
      ? Math.max(...tallas.map(t => t.orden)) + 1
      : 1
    setNewData({ nombre: '', orden: maxOrden })
    setAdding(true)
    setEditId(null)
  }

  // ── Agregar ────────────────────────────────────────────
  async function handleAgregar() {
    if (!newData.nombre.trim()) {
      toast.warning('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO tallas (nombre, orden, activo, created_at, updated_at)
         VALUES (?, ?, 1, datetime('now'), datetime('now'))`,
        [newData.nombre.trim().toUpperCase(), newData.orden ?? 0]
      )
      toast.success(`Talla "${newData.nombre.toUpperCase()}" creada`)
      setNewData({ nombre: '', orden: 0 })
      setAdding(false)
      loadTallas()
    } catch {
      toast.error('Error al crear talla')
    } finally {
      setSaving(false)
    }
  }

  // ── Agregar sugerida ───────────────────────────────────
  async function handleAgregarSugerida(nombre: string) {
    const yaExiste = tallas.some(
      t => t.nombre.toUpperCase() === nombre.toUpperCase()
    )
    if (yaExiste) {
      toast.warning(`La talla "${nombre}" ya existe`)
      return
    }
    const maxOrden = tallas.length > 0
      ? Math.max(...tallas.map(t => t.orden)) + 1
      : 1
    try {
      await window.electronAPI.db.run(
        `INSERT INTO tallas (nombre, orden, activo, created_at, updated_at)
         VALUES (?, ?, 1, datetime('now'), datetime('now'))`,
        [nombre, maxOrden]
      )
      toast.success(`Talla "${nombre}" agregada`)
      loadTallas()
    } catch {
      toast.error('Error al agregar talla')
    }
  }

  // ── Editar ─────────────────────────────────────────────
  async function handleGuardarEdicion(id: number) {
    if (!editData.nombre.trim()) {
      toast.warning('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE tallas
         SET nombre = ?, orden = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [editData.nombre.trim().toUpperCase(), editData.orden ?? 0, id]
      )
      toast.success('Talla actualizada')
      setEditId(null)
      loadTallas()
    } catch {
      toast.error('Error al actualizar talla')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle activo ──────────────────────────────────────
  async function handleToggleActivo(talla: Talla) {
    try {
      await window.electronAPI.db.run(
        `UPDATE tallas
         SET activo = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [talla.activo ? 0 : 1, talla.id]
      )
      loadTallas()
    } catch {
      toast.error('Error al actualizar talla')
    }
  }

  // ── Eliminar ───────────────────────────────────────────
  function handleEliminar(talla: Talla) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar talla "${talla.nombre}"?`}
        description="Si tiene productos o ventas asociadas, no podrá eliminarse."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM tallas WHERE id = ?`,
              [talla.id]
            )
            toast.success(`Talla "${talla.nombre}" eliminada`)
            loadTallas()
          } catch {
            toast.error('No se puede eliminar: tiene stock o ventas asociadas')
          }
        }}
      />
    )
  }

  // ── Mover orden ────────────────────────────────────────
  async function handleMoverOrden(talla: Talla, direccion: 'up' | 'down') {
    const idx = tallas.findIndex(t => t.id === talla.id)
    const target = direccion === 'up' ? tallas[idx - 1] : tallas[idx + 1]
    if (!target) return

    try {
      await Promise.all([
        window.electronAPI.db.run(
          `UPDATE tallas SET orden = ?, updated_at = datetime('now') WHERE id = ?`,
          [target.orden, talla.id]
        ),
        window.electronAPI.db.run(
          `UPDATE tallas SET orden = ?, updated_at = datetime('now') WHERE id = ?`,
          [talla.orden, target.id]
        )
      ])
      loadTallas()
    } catch {
      toast.error('Error al reordenar')
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Título sección */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Ruler size={16} className="text-accent-DEFAULT" />
          <h3 className="text-[15px] font-bold text-primary-DEFAULT">
            Tallas
          </h3>
        </div>
        <button
          onClick={openAdding}
          className="btn-primary h-8 text-[12.5px]"
          disabled={adding}
        >
          <Plus size={13} />
          Nueva talla
        </button>
      </div>

      {/* Sugeridas rápidas */}
      {tallas.length < 3 && (
        <div>
          <p className="text-[12px] text-primary-muted mb-2">
            Agregar tallas estándar rápidamente:
          </p>
          <div className="flex flex-wrap gap-2">
            {TALLAS_SUGERIDAS.map(s => {
              const existe = tallas.some(
                t => t.nombre.toUpperCase() === s.toUpperCase()
              )
              return (
                <button
                  key={s}
                  onClick={() => handleAgregarSugerida(s)}
                  disabled={existe}
                  className={cn(
                    'px-3 py-1.5 rounded-xl border text-[12.5px] font-bold',
                    'transition-colors',
                    existe
                      ? 'border-border text-primary-muted opacity-40 cursor-not-allowed'
                      : 'border-dashed border-border text-primary-muted hover:border-accent-DEFAULT/40 hover:text-accent-DEFAULT'
                  )}
                >
                  {existe ? '✓' : '+'} {s}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Formulario nuevo */}
      {adding && (
        <div className="flex items-end gap-2 p-4 rounded-xl border
                        border-accent-DEFAULT/30 bg-accent-light
                        animate-fade-in">
          <div className="flex-1">
            <label className="input-label">Nombre talla</label>
            <input
              type="text"
              placeholder="Ej: S, M, L, Única, 36, 38…"
              className="input h-9 text-[13px] uppercase"
              value={newData.nombre}
              onChange={e => setNewData(p => ({
                ...p, nombre: e.target.value.toUpperCase()
              }))}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              autoFocus
            />
          </div>
          <div className="w-24">
            <label className="input-label">Orden</label>
            <input
              type="number"
              min={0}
              className="input h-9 text-[13px]"
              value={newData.orden}
              onChange={e => setNewData(p => ({
                ...p, orden: parseInt(e.target.value) || 0
              }))}
            />
          </div>
          <button
            onClick={handleAgregar}
            disabled={saving}
            className="btn-primary h-9 text-[13px] shrink-0"
          >
            {saving ? <Spinner size="sm" /> : <Check size={14} />}
            Guardar
          </button>
          <button
            onClick={() => { setAdding(false); setNewData({ nombre: '', orden: 0 }) }}
            className="btn-ghost h-9 text-[13px] shrink-0"
            disabled={saving}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : tallas.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="Sin tallas configuradas"
          description='Agrega tallas estándar o crea las tuyas.'
        />
      ) : (
        <div className="flex flex-col gap-2">
          {tallas.map((talla, idx) => {
            const isEditing  = editId === talla.id
            const isFirst    = idx === 0
            const isLast     = idx === tallas.length - 1

            return (
              <div
                key={talla.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border',
                  'transition-all duration-150',
                  isEditing
                    ? 'border-accent-DEFAULT/40 bg-accent-light'
                    : 'border-border bg-[#0B0B16]',
                  !talla.activo && 'opacity-50'
                )}
              >
                {/* Grip / orden */}
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => handleMoverOrden(talla, 'up')}
                    disabled={isFirst}
                    className="text-primary-muted hover:text-primary-DEFAULT
                               disabled:opacity-20 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round"
                            strokeWidth={2.5} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <GripVertical size={12} className="text-primary-muted/40" />
                  <button
                    onClick={() => handleMoverOrden(talla, 'down')}
                    disabled={isLast}
                    className="text-primary-muted hover:text-primary-DEFAULT
                               disabled:opacity-20 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round"
                            strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {isEditing ? (
                  <>
                    <input
                      type="text"
                      className="input h-8 text-[13px] flex-1 uppercase"
                      value={editData.nombre}
                      onChange={e => setEditData(p => ({
                        ...p, nombre: e.target.value.toUpperCase()
                      }))}
                      onKeyDown={e => e.key === 'Enter' && handleGuardarEdicion(talla.id)}
                      autoFocus
                    />
                    <input
                      type="number"
                      min={0}
                      className="input h-8 text-[13px] w-20"
                      value={editData.orden}
                      onChange={e => setEditData(p => ({
                        ...p, orden: parseInt(e.target.value) || 0
                      }))}
                    />
                    <button
                      onClick={() => handleGuardarEdicion(talla.id)}
                      disabled={saving}
                      className="p-1.5 rounded-lg text-success
                                 hover:bg-success/10 transition-colors"
                      title="Guardar"
                    >
                      {saving ? <Spinner size="sm" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="p-1.5 rounded-lg text-primary-muted
                                 hover:bg-white/5 transition-colors"
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    {/* Badge nombre */}
                    <div className="flex-1">
                      <span className="inline-flex items-center justify-center
                                       w-12 h-8 rounded-lg bg-accent-light
                                       border border-accent-DEFAULT/20
                                       text-[13px] font-bold text-accent-DEFAULT">
                        {talla.nombre}
                      </span>
                    </div>

                    {/* Orden */}
                    <span className="text-[12px] text-primary-muted w-16 text-center">
                      #{talla.orden}
                    </span>

                    {/* Estado */}
                    <button
                      onClick={() => handleToggleActivo(talla)}
                      className={cn(
                        'text-[12px] font-semibold px-2.5 py-1 rounded-lg',
                        'border transition-colors',
                        talla.activo
                          ? 'border-success/30 text-success bg-success/10 hover:bg-success/20'
                          : 'border-border text-primary-muted hover:border-accent-DEFAULT/30'
                      )}
                    >
                      {talla.activo ? 'Activa' : 'Inactiva'}
                    </button>

                    {/* Acciones */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditId(talla.id)
                          setEditData({ nombre: talla.nombre, orden: talla.orden })
                          setAdding(false)
                        }}
                        className="p-1.5 rounded-lg text-primary-muted
                                   hover:text-primary-DEFAULT hover:bg-white/5
                                   transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleEliminar(talla)}
                        className="p-1.5 rounded-lg text-primary-muted
                                   hover:text-danger hover:bg-danger/10
                                   transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info orden */}
      <div className="p-3 rounded-xl bg-accent-light border border-accent-DEFAULT/20">
        <p className="text-[12px] text-primary-muted leading-relaxed">
          <strong className="text-accent-DEFAULT">Tip:</strong> Usa las flechas
          ▲▼ para ordenar cómo aparecen las tallas en el formulario de ventas.
          El orden afecta la visualización en toda la app.
        </p>
      </div>
    </div>
  )
}