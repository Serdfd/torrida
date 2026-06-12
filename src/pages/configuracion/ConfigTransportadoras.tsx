import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Truck, Check, X } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState    from '@/components/ui/EmptyState'
import Spinner       from '@/components/ui/Spinner'

interface Transportadora {
  id:     number
  nombre: string
  activa: number
}

export default function ConfigTransportadoras() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,       setLoading]       = useState(true)
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [editId,        setEditId]        = useState<number | null>(null)
  const [editNombre,    setEditNombre]    = useState('')
  const [newNombre,     setNewNombre]     = useState('')
  const [adding,        setAdding]        = useState(false)
  const [saving,        setSaving]        = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await window.electronAPI.db.query<Transportadora>(
        `SELECT * FROM transportadoras ORDER BY nombre`
      )
      setTransportadoras(data)
    } catch {
      toast.error('Error al cargar transportadoras')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAgregar() {
    const nombre = newNombre.trim()
    if (!nombre) { toast.warning('El nombre es obligatorio'); return }
    const yaExiste = transportadoras.some(
      t => t.nombre.toLowerCase() === nombre.toLowerCase()
    )
    if (yaExiste) { toast.warning(`"${nombre}" ya existe`); return }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO transportadoras (nombre, activa, created_at) VALUES (?, 1, datetime('now'))`,
        [nombre]
      )
      toast.success(`"${nombre}" creada`)
      setNewNombre('')
      setAdding(false)
      load()
    } catch {
      toast.error('Error al crear transportadora')
    } finally {
      setSaving(false)
    }
  }

  async function handleGuardarEdicion(id: number) {
    const nombre = editNombre.trim()
    if (!nombre) { toast.warning('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE transportadoras SET nombre = ? WHERE id = ?`,
        [nombre, id]
      )
      toast.success('Transportadora actualizada')
      setEditId(null)
      load()
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActiva(t: Transportadora) {
    try {
      await window.electronAPI.db.run(
        `UPDATE transportadoras SET activa = ? WHERE id = ?`,
        [t.activa ? 0 : 1, t.id]
      )
      load()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  function handleEliminar(t: Transportadora) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar "${t.nombre}"?`}
        description="Si hay ventas usando esta transportadora, no podrá eliminarse."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM transportadoras WHERE id = ?`, [t.id]
            )
            toast.success(`"${t.nombre}" eliminada`)
            load()
          } catch {
            toast.error('No se puede eliminar: hay ventas asociadas')
          }
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Título */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-accent" />
          <h3 className="text-md font-bold text-primary">Transportadoras</h3>
        </div>
        <button
          onClick={() => { setAdding(true); setEditId(null) }}
          className="btn-primary"
          disabled={adding}
        >
          <Plus size={13} /> Nueva
        </button>
      </div>

      {/* Formulario nueva */}
      {adding && (
        <div className="flex items-end gap-2 p-4 rounded-xl border border-accent/30 bg-accent-light animate-fade-in">
          <div className="flex-1">
            <label className="input-label">Nombre transportadora</label>
            <input
              autoFocus
              type="text"
              placeholder="Ej: Coordinadora, Servientrega…"
              className="input h-9 text-base"
              value={newNombre}
              onChange={e => setNewNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAgregar() }}
            />
          </div>
          <button onClick={() => { setAdding(false); setNewNombre('') }}
            className="btn-ghost" disabled={saving}>
            <X size={14} /> Cancelar
          </button>
          <button onClick={handleAgregar} disabled={saving} className="btn-primary">
            {saving ? <Spinner size="sm" /> : <Check size={14} />}
            Guardar
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="lg" /></div>
      ) : transportadoras.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Sin transportadoras"
          description="Agrega la primera empresa transportadora"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {transportadoras.map(t => {
            const isEditing = editId === t.id
            return (
              <div
                key={t.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150',
                  isEditing ? 'border-accent/40 bg-accent-light' : 'border-border bg-[#0B0B16]',
                  !t.activa && 'opacity-50'
                )}
              >
                {isEditing ? (
                  <>
                    <input
                      autoFocus
                      type="text"
                      className="input h-8 text-base flex-1"
                      value={editNombre}
                      onChange={e => setEditNombre(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleGuardarEdicion(t.id) }}
                    />
                    <button onClick={() => setEditId(null)} className="btn-ghost">
                      <X size={13} /> Cancelar
                    </button>
                    <button
                      onClick={() => handleGuardarEdicion(t.id)}
                      disabled={saving}
                      className="btn-primary"
                    >
                      {saving ? <Spinner size="sm" /> : <Check size={13} />}
                      Guardar
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-base font-medium text-primary">
                      {t.nombre}
                    </span>
                    <button
                      onClick={() => handleToggleActiva(t)}
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-lg border transition-colors',
                        t.activa
                          ? 'border-success/30 text-success bg-success/10 hover:bg-success/20'
                          : 'border-border text-primary-muted hover:border-accent/30'
                      )}
                    >
                      {t.activa ? 'Activa' : 'Inactiva'}
                    </button>
                    <button
                      onClick={() => { setEditId(t.id); setEditNombre(t.nombre); setAdding(false) }}
                      className="btn-ghost h-7 w-7 p-0 flex items-center justify-center"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleEliminar(t)}
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
