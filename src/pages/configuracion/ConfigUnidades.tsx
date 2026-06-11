import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Ruler, Check, X } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState    from '@/components/ui/EmptyState'
import Spinner       from '@/components/ui/Spinner'

interface Unidad {
  id:     number
  nombre: string
  activa: number
}

const UNIDADES_SUGERIDAS = [
  'unidad', 'metro', 'kg', 'rollo', 'par', 'caja', 'litro',
  'cm', 'gramo', 'yarda', 'bolsa', 'resma'
]

export default function ConfigUnidades() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,  setLoading]  = useState(true)
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [editId,   setEditId]   = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [newNombre,  setNewNombre]  = useState('')
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(false)

  async function loadUnidades() {
    setLoading(true)
    try {
      const data = await window.electronAPI.db.query<Unidad>(
        `SELECT * FROM unidades ORDER BY nombre`
      )
      setUnidades(data)
    } catch {
      toast.error('Error al cargar unidades')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUnidades() }, [])

  async function handleAgregar() {
    const nombre = newNombre.trim().toLowerCase()
    if (!nombre) { toast.warning('El nombre es obligatorio'); return }
    const yaExiste = unidades.some(u => u.nombre.toLowerCase() === nombre)
    if (yaExiste) { toast.warning(`"${nombre}" ya existe`); return }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO unidades (nombre, activa, created_at) VALUES (?, 1, datetime('now'))`,
        [nombre]
      )
      toast.success(`Unidad "${nombre}" creada`)
      setNewNombre('')
      setAdding(false)
      loadUnidades()
    } catch {
      toast.error('Error al crear unidad')
    } finally {
      setSaving(false)
    }
  }

  async function handleAgregarSugerida(nombre: string) {
    const yaExiste = unidades.some(u => u.nombre.toLowerCase() === nombre.toLowerCase())
    if (yaExiste) { toast.warning(`"${nombre}" ya existe`); return }
    try {
      await window.electronAPI.db.run(
        `INSERT INTO unidades (nombre, activa, created_at) VALUES (?, 1, datetime('now'))`,
        [nombre]
      )
      toast.success(`"${nombre}" agregada`)
      loadUnidades()
    } catch {
      toast.error('Error al agregar unidad')
    }
  }

  async function handleGuardarEdicion(id: number) {
    const nombre = editNombre.trim().toLowerCase()
    if (!nombre) { toast.warning('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE unidades SET nombre = ? WHERE id = ?`,
        [nombre, id]
      )
      toast.success('Unidad actualizada')
      setEditId(null)
      loadUnidades()
    } catch {
      toast.error('Error al actualizar unidad')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActiva(u: Unidad) {
    try {
      await window.electronAPI.db.run(
        `UPDATE unidades SET activa = ? WHERE id = ?`,
        [u.activa ? 0 : 1, u.id]
      )
      loadUnidades()
    } catch {
      toast.error('Error al actualizar unidad')
    }
  }

  function handleEliminar(u: Unidad) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar "${u.nombre}"?`}
        description="Si hay insumos usando esta unidad, no podrá eliminarse."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM unidades WHERE id = ?`, [u.id]
            )
            toast.success(`"${u.nombre}" eliminada`)
            loadUnidades()
          } catch {
            toast.error('No se puede eliminar: hay insumos usando esta unidad')
          }
        }}
      />
    )
  }

  const sugeridosFaltantes = UNIDADES_SUGERIDAS.filter(
    s => !unidades.some(u => u.nombre.toLowerCase() === s.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-5">

      {/* Título */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Ruler size={16} className="text-accent" />
          <h3 className="text-[15px] font-bold text-primary">
            Unidades de medida
          </h3>
        </div>
        <button
          onClick={() => { setAdding(true); setEditId(null) }}
          className="btn-primary h-8 text-[12.5px]"
          disabled={adding}
        >
          <Plus size={13} /> Nueva unidad
        </button>
      </div>

      {/* Sugeridas */}
      {sugeridosFaltantes.length > 0 && unidades.length < 4 && (
        <div>
          <p className="text-[12px] text-primary-muted mb-2">Unidades sugeridas:</p>
          <div className="flex flex-wrap gap-2">
            {sugeridosFaltantes.map(s => (
              <button
                key={s}
                onClick={() => handleAgregarSugerida(s)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border
                           border-dashed border-border text-[12.5px] font-semibold
                           text-primary-muted hover:border-accent/40 hover:text-accent
                           transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Formulario nuevo */}
      {adding && (
        <div className="flex items-end gap-2 p-4 rounded-xl border border-accent/30 bg-accent-light animate-fade-in">
          <div className="flex-1">
            <label className="input-label">Nombre unidad</label>
            <input
              type="text"
              placeholder="Ej: metro, kg, rollo…"
              className="input h-9 text-[13px]"
              value={newNombre}
              onChange={e => setNewNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              autoFocus
            />
          </div>
          <button
            onClick={() => { setAdding(false); setNewNombre('') }}
            className="btn-ghost h-9 text-[13px]"
            disabled={saving}
          >
            <X size={14} /> Cancelar
          </button>
          <button onClick={handleAgregar} disabled={saving} className="btn-primary h-9 text-[13px]">
            {saving ? <Spinner size="sm" /> : <Check size={14} />}
            Guardar
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="lg" /></div>
      ) : unidades.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="Sin unidades"
          description="Agrega las unidades de medida que usan tus insumos."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {unidades.map(u => {
            const isEditing = editId === u.id
            return (
              <div
                key={u.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150',
                  isEditing ? 'border-accent/40 bg-accent-light' : 'border-border bg-[#0B0B16]',
                  !u.activa && 'opacity-50'
                )}
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      className="input h-8 text-[13px] flex-1"
                      value={editNombre}
                      onChange={e => setEditNombre(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleGuardarEdicion(u.id)}
                      autoFocus
                    />
                    <button onClick={() => setEditId(null)} className="btn-ghost h-8 text-[12.5px]">
                      <X size={13} /> Cancelar
                    </button>
                    <button
                      onClick={() => handleGuardarEdicion(u.id)}
                      disabled={saving}
                      className="btn-primary h-8 text-[12.5px]"
                    >
                      {saving ? <Spinner size="sm" /> : <Check size={13} />}
                      Guardar
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-[13.5px] font-medium text-primary">
                      {u.nombre}
                    </span>
                    <button
                      onClick={() => handleToggleActiva(u)}
                      className={cn(
                        'text-[11.5px] font-semibold px-2 py-0.5 rounded-lg border transition-colors',
                        u.activa
                          ? 'border-success/30 text-success bg-success/10 hover:bg-success/20'
                          : 'border-border text-primary-muted hover:border-accent/30'
                      )}
                    >
                      {u.activa ? 'Activa' : 'Inactiva'}
                    </button>
                    <button
                      onClick={() => { setEditId(u.id); setEditNombre(u.nombre); setAdding(false) }}
                      className="btn-ghost h-7 w-7 p-0 flex items-center justify-center"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleEliminar(u)}
                      className="btn-ghost h-7 w-7 p-0 flex items-center justify-center text-danger hover:bg-danger/10"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
