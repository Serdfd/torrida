import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, CreditCard, Check, X } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'

interface MedioPago {
  id:     number
  nombre: string
  activo: number
}

export default function ConfigMediosPago() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,   setLoading]   = useState(true)
  const [medios,    setMedios]    = useState<MedioPago[]>([])
  const [editId,    setEditId]    = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [newNombre, setNewNombre]  = useState('')
  const [adding,    setAdding]    = useState(false)
  const [saving,    setSaving]    = useState(false)

  async function loadMedios() {
    setLoading(true)
    try {
      const data = await window.electronAPI.db.query<MedioPago>(
        `SELECT * FROM medios_pago ORDER BY nombre`
      )
      setMedios(data)
    } catch {
      toast.error('Error al cargar medios de pago')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMedios() }, [])

  // ── Agregar ────────────────────────────────────────────
  async function handleAgregar() {
    if (!newNombre.trim()) {
      toast.warning('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO medios_pago (nombre, activo, created_at, updated_at)
         VALUES (?, 1, datetime('now'), datetime('now'))`,
        [newNombre.trim()]
      )
      toast.success(`"${newNombre}" agregado`)
      setNewNombre('')
      setAdding(false)
      loadMedios()
    } catch {
      toast.error('Error al crear medio de pago')
    } finally {
      setSaving(false)
    }
  }

  // ── Editar ─────────────────────────────────────────────
  async function handleGuardarEdicion(id: number) {
    if (!editNombre.trim()) {
      toast.warning('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE medios_pago
         SET nombre = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [editNombre.trim(), id]
      )
      toast.success('Medio de pago actualizado')
      setEditId(null)
      loadMedios()
    } catch {
      toast.error('Error al actualizar medio de pago')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle activo ──────────────────────────────────────
  async function handleToggleActivo(medio: MedioPago) {
    try {
      await window.electronAPI.db.run(
        `UPDATE medios_pago
         SET activo = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [medio.activo ? 0 : 1, medio.id]
      )
      loadMedios()
    } catch {
      toast.error('Error al actualizar medio de pago')
    }
  }

  // ── Eliminar ───────────────────────────────────────────
  function handleEliminar(medio: MedioPago) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar "${medio.nombre}"?`}
        description="Si tiene ventas asociadas, no podrá eliminarse."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM medios_pago WHERE id = ?`,
              [medio.id]
            )
            toast.success(`"${medio.nombre}" eliminado`)
            loadMedios()
          } catch {
            toast.error('No se puede eliminar: tiene ventas asociadas')
          }
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Título sección */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-accent-DEFAULT" />
          <h3 className="text-[15px] font-bold text-primary-DEFAULT">
            Medios de pago
          </h3>
        </div>
        <button
          onClick={() => { setAdding(true); setEditId(null) }}
          className="btn-primary h-8 text-[12.5px]"
          disabled={adding}
        >
          <Plus size={13} />
          Nuevo medio
        </button>
      </div>

      {/* Formulario nuevo */}
      {adding && (
        <div className="flex items-end gap-2 p-4 rounded-xl border
                        border-accent-DEFAULT/30 bg-accent-light
                        animate-fade-in">
          <div className="flex-1">
            <label className="input-label">Nombre</label>
            <input
              type="text"
              placeholder="Ej: Nequi, Transferencia, Efectivo, Wompi…"
              className="input h-9 text-[13px]"
              value={newNombre}
              onChange={e => setNewNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              autoFocus
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
            onClick={() => { setAdding(false); setNewNombre('') }}
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
      ) : medios.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin medios de pago"
          description='Crea tu primer medio con "Nuevo medio".'
        />
      ) : (
        <div className="flex flex-col gap-2">
          {medios.map(medio => {
            const isEditing = editId === medio.id
            return (
              <div
                key={medio.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border',
                  'transition-all duration-150',
                  isEditing
                    ? 'border-accent-DEFAULT/40 bg-accent-light'
                    : 'border-border bg-[#0B0B16]',
                  !medio.activo && 'opacity-50'
                )}
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      className="input h-8 text-[13px] flex-1"
                      value={editNombre}
                      onChange={e => setEditNombre(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleGuardarEdicion(medio.id)}
                      autoFocus
                    />
                    <button
                      onClick={() => handleGuardarEdicion(medio.id)}
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
                    {/* Icono */}
                    <div className="w-7 h-7 rounded-lg bg-accent-light
                                    flex items-center justify-center shrink-0">
                      <CreditCard size={13} className="text-accent-DEFAULT" />
                    </div>

                    {/* Nombre */}
                    <p className="flex-1 text-[13.5px] font-semibold
                                  text-primary-DEFAULT">
                      {medio.nombre}
                    </p>

                    {/* Estado */}
                    <button
                      onClick={() => handleToggleActivo(medio)}
                      className={cn(
                        'text-[12px] font-semibold px-2.5 py-1 rounded-lg',
                        'border transition-colors',
                        medio.activo
                          ? 'border-success/30 text-success bg-success/10 hover:bg-success/20'
                          : 'border-border text-primary-muted hover:border-accent-DEFAULT/30'
                      )}
                    >
                      {medio.activo ? 'Activo' : 'Inactivo'}
                    </button>

                    {/* Acciones */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditId(medio.id)
                          setEditNombre(medio.nombre)
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
                        onClick={() => handleEliminar(medio)}
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

      {/* Ejemplos sugeridos */}
      {medios.length === 0 && !adding && (
        <div className="flex flex-wrap gap-2">
          {['Nequi', 'Daviplata', 'Transferencia bancaria',
            'Efectivo', 'Wompi', 'PSE'].map(sugerido => (
            <button
              key={sugerido}
              onClick={() => {
                setNewNombre(sugerido)
                setAdding(true)
              }}
              className="px-3 py-1.5 rounded-xl border border-dashed
                         border-border text-[12.5px] text-primary-muted
                         hover:border-accent-DEFAULT/40 hover:text-accent-DEFAULT
                         transition-colors"
            >
              + {sugerido}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}