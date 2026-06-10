import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Palette, Check, X } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'

interface Coleccion {
  id:          number
  nombre:      string
  anio:        number | null
  descripcion: string | null
  activa:      number
}

interface ColeccionFormData {
  nombre:      string
  anio:        string
  descripcion: string
}

const ANIO_ACTUAL = new Date().getFullYear()

export default function ConfigColecciones() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,     setLoading]     = useState(true)
  const [colecciones, setColecciones] = useState<Coleccion[]>([])
  const [editId,      setEditId]      = useState<number | null>(null)
  const [editData,    setEditData]    = useState<ColeccionFormData>({
    nombre: '', anio: String(ANIO_ACTUAL), descripcion: ''
  })
  const [newData,     setNewData]     = useState<ColeccionFormData>({
    nombre: '', anio: String(ANIO_ACTUAL), descripcion: ''
  })
  const [adding,      setAdding]      = useState(false)
  const [saving,      setSaving]      = useState(false)

  async function loadColecciones() {
    setLoading(true)
    try {
      const data = await window.electronAPI.db.query<Coleccion>(
        `SELECT * FROM colecciones ORDER BY anio DESC, nombre ASC`
      )
      setColecciones(data)
    } catch {
      toast.error('Error al cargar colecciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadColecciones() }, [])

  // ── Agregar ────────────────────────────────────────────
  async function handleAgregar() {
    if (!newData.nombre.trim()) {
      toast.warning('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO colecciones
           (nombre, anio, descripcion, activa, created_at, updated_at)
         VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`,
        [
          newData.nombre.trim(),
          newData.anio ? parseInt(newData.anio) : null,
          newData.descripcion.trim() || null
        ]
      )
      toast.success(`Colección "${newData.nombre}" creada`)
      setNewData({ nombre: '', anio: String(ANIO_ACTUAL), descripcion: '' })
      setAdding(false)
      loadColecciones()
    } catch {
      toast.error('Error al crear colección')
    } finally {
      setSaving(false)
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
        `UPDATE colecciones
         SET nombre      = ?,
             anio        = ?,
             descripcion = ?,
             updated_at  = datetime('now')
         WHERE id = ?`,
        [
          editData.nombre.trim(),
          editData.anio ? parseInt(editData.anio) : null,
          editData.descripcion.trim() || null,
          id
        ]
      )
      toast.success('Colección actualizada')
      setEditId(null)
      loadColecciones()
    } catch {
      toast.error('Error al actualizar colección')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle activa ──────────────────────────────────────
  async function handleToggleActiva(col: Coleccion) {
    try {
      await window.electronAPI.db.run(
        `UPDATE colecciones
         SET activa = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [col.activa ? 0 : 1, col.id]
      )
      loadColecciones()
    } catch {
      toast.error('Error al actualizar colección')
    }
  }

  // ── Eliminar ───────────────────────────────────────────
  function handleEliminar(col: Coleccion) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar "${col.nombre}"?`}
        description="Si tiene productos asociados, no podrá eliminarse."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM colecciones WHERE id = ?`,
              [col.id]
            )
            toast.success(`"${col.nombre}" eliminada`)
            loadColecciones()
          } catch {
            toast.error('No se puede eliminar: tiene productos asociados')
          }
        }}
      />
    )
  }

  // ── Formulario inline ──────────────────────────────────
  function ColeccionFormInline({
    data,
    onChange,
    onSave,
    onCancel,
    saving
  }: {
    data:      ColeccionFormData
    onChange:  (d: ColeccionFormData) => void
    onSave:    () => void
    onCancel:  () => void
    saving:    boolean
  }) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="input-label">Nombre colección</label>
            <input
              type="text"
              placeholder="Ej: Verano 2025, Básicos…"
              className="input h-9 text-[13px]"
              value={data.nombre}
              onChange={e => onChange({ ...data, nombre: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="input-label">Año</label>
            <input
              type="number"
              min={2000}
              max={2100}
              placeholder={String(ANIO_ACTUAL)}
              className="input h-9 text-[13px]"
              value={data.anio}
              onChange={e => onChange({ ...data, anio: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="input-label">Descripción (opcional)</label>
          <input
            type="text"
            placeholder="Breve descripción de la colección…"
            className="input h-9 text-[13px]"
            value={data.descripcion}
            onChange={e => onChange({ ...data, descripcion: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && onSave()}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost h-9 text-[13px]"
            disabled={saving}
          >
            <X size={13} /> Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="btn-primary h-9 text-[13px]"
          >
            {saving ? <Spinner size="sm" /> : <Check size={13} />}
            Guardar
          </button>
        </div>
      </div>
    )
  }

  // Agrupar por año
  const anosUnicos = Array.from(
    new Set(colecciones.map(c => c.anio ?? 0))
  ).sort((a, b) => b - a)

  return (
    <div className="flex flex-col gap-5">

      {/* Título sección */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-accent" />
          <h3 className="text-[15px] font-bold text-primary">
            Colecciones
          </h3>
        </div>
        <button
          onClick={() => { setAdding(true); setEditId(null) }}
          className="btn-primary h-8 text-[12.5px]"
          disabled={adding}
        >
          <Plus size={13} />
          Nueva colección
        </button>
      </div>

      {/* Formulario nuevo */}
      {adding && (
        <div className="p-4 rounded-xl border border-accent/30
                        bg-accent-light animate-fade-in">
          <p className="text-[13px] font-semibold text-accent mb-3">
            Nueva colección
          </p>
          <ColeccionFormInline
            data={newData}
            onChange={setNewData}
            onSave={handleAgregar}
            onCancel={() => {
              setAdding(false)
              setNewData({ nombre: '', anio: String(ANIO_ACTUAL), descripcion: '' })
            }}
            saving={saving}
          />
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : colecciones.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="Sin colecciones"
          description='Crea tu primera colección para agrupar productos por temporada.'
          action={
            <button
              onClick={() => setAdding(true)}
              className="btn-primary"
            >
              <Plus size={14} /> Nueva colección
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {anosUnicos.map(anio => {
            const cols = colecciones.filter(c => (c.anio ?? 0) === anio)
            return (
              <div key={anio}>
                {/* Header año */}
                <p className="text-[11.5px] font-bold uppercase tracking-widest
                               text-primary-muted mb-2 px-1">
                  {anio === 0 ? 'Sin año' : anio}
                </p>

                <div className="flex flex-col gap-2">
                  {cols.map(col => {
                    const isEditing = editId === col.id
                    return (
                      <div
                        key={col.id}
                        className={cn(
                          'rounded-xl border transition-all duration-150',
                          isEditing
                            ? 'border-accent/40 bg-accent-light p-4'
                            : 'border-border bg-[#0B0B16] px-4 py-3',
                          !col.activa && !isEditing && 'opacity-50'
                        )}
                      >
                        {isEditing ? (
                          <>
                            <p className="text-[12px] font-semibold
                                          text-accent mb-3">
                              Editando: {col.nombre}
                            </p>
                            <ColeccionFormInline
                              data={editData}
                              onChange={setEditData}
                              onSave={() => handleGuardarEdicion(col.id)}
                              onCancel={() => setEditId(null)}
                              saving={saving}
                            />
                          </>
                        ) : (
                          <div className="flex items-start gap-3">

                            {/* Icono */}
                            <div className="w-9 h-9 rounded-xl bg-accent-light
                                            flex items-center justify-center
                                            shrink-0 border border-accent/20">
                              <Palette size={15} className="text-accent" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-[13.5px] font-bold
                                              text-primary">
                                  {col.nombre}
                                </p>
                                {col.anio && (
                                  <span className="badge badge-muted text-[11px]">
                                    {col.anio}
                                  </span>
                                )}
                              </div>
                              {col.descripcion && (
                                <p className="text-[12px] text-primary-muted
                                              truncate">
                                  {col.descripcion}
                                </p>
                              )}
                            </div>

                            {/* Estado */}
                            <button
                              onClick={() => handleToggleActiva(col)}
                              className={cn(
                                'text-[12px] font-semibold px-2.5 py-1',
                                'rounded-lg border transition-colors shrink-0',
                                col.activa
                                  ? 'border-success/30 text-success bg-success/10 hover:bg-success/20'
                                  : 'border-border text-primary-muted hover:border-accent/30'
                              )}
                            >
                              {col.activa ? 'Activa' : 'Inactiva'}
                            </button>

                            {/* Acciones */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditId(col.id)
                                  setEditData({
                                    nombre:      col.nombre,
                                    anio:        String(col.anio ?? ''),
                                    descripcion: col.descripcion ?? ''
                                  })
                                  setAdding(false)
                                }}
                                className="p-1.5 rounded-lg text-primary-muted
                                           hover:text-primary hover:bg-white/5
                                           transition-colors"
                                title="Editar"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleEliminar(col)}
                                className="p-1.5 rounded-lg text-primary-muted
                                           hover:text-danger hover:bg-danger/10
                                           transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tip */}
      <div className="p-3 rounded-xl bg-accent-light border border-accent/20">
        <p className="text-[12px] text-primary-muted leading-relaxed">
          <strong className="text-accent">Tip:</strong> Las colecciones
          te permiten agrupar productos por temporada o línea (ej: Verano 2025,
          Básicos, Edición limitada). Aparecen como filtro en el catálogo de productos.
        </p>
      </div>
    </div>
  )
}