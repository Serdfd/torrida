import React, { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Truck, Check, X, Phone, Mail } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState    from '@/components/ui/EmptyState'
import Spinner       from '@/components/ui/Spinner'

interface Proveedor {
  id:       number
  nombre:   string
  contacto: string | null
  telefono: string | null
  email:    string | null
  notas:    string | null
  activo:   number
}

interface FormData {
  nombre:   string
  contacto: string
  telefono: string
  email:    string
  notas:    string
}

const EMPTY_FORM: FormData = {
  nombre:   '',
  contacto: '',
  telefono: '',
  email:    '',
  notas:    ''
}

export default function Proveedores() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,    setLoading]    = useState(true)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [editId,     setEditId]     = useState<number | null>(null)
  const [editData,   setEditData]   = useState<FormData>(EMPTY_FORM)
  const [newData,    setNewData]    = useState<FormData>(EMPTY_FORM)
  const [adding,     setAdding]     = useState(false)
  const [saving,     setSaving]     = useState(false)

  async function loadProveedores() {
    setLoading(true)
    try {
      const data = await window.electronAPI.db.query<Proveedor>(
        `SELECT * FROM proveedores ORDER BY nombre ASC`
      )
      setProveedores(data)
    } catch {
      toast.error('Error al cargar proveedores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProveedores() }, [])

  async function handleAgregar() {
    if (!newData.nombre.trim()) { toast.warning('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO proveedores (nombre, contacto, telefono, email, notas, activo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [
          newData.nombre.trim(),
          newData.contacto.trim() || null,
          newData.telefono.trim() || null,
          newData.email.trim()    || null,
          newData.notas.trim()    || null
        ]
      )
      toast.success('Proveedor agregado')
      setAdding(false)
      setNewData(EMPTY_FORM)
      loadProveedores()
    } catch {
      toast.error('Error al guardar proveedor')
    } finally {
      setSaving(false)
    }
  }

  async function handleGuardarEdicion() {
    if (!editData.nombre.trim()) { toast.warning('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE proveedores
         SET nombre=?, contacto=?, telefono=?, email=?, notas=?
         WHERE id=?`,
        [
          editData.nombre.trim(),
          editData.contacto.trim() || null,
          editData.telefono.trim() || null,
          editData.email.trim()    || null,
          editData.notas.trim()    || null,
          editId
        ]
      )
      toast.success('Proveedor actualizado')
      setEditId(null)
      loadProveedores()
    } catch {
      toast.error('Error al actualizar proveedor')
    } finally {
      setSaving(false)
    }
  }

  function handleEliminar(p: Proveedor) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar "${p.nombre}"?`}
        description="Se desactivará el proveedor. Los registros históricos se conservan."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `UPDATE proveedores SET activo = 0 WHERE id = ?`, [p.id]
            )
            toast.success('Proveedor eliminado')
            loadProveedores()
          } catch {
            toast.error('Error al eliminar proveedor')
          }
        }}
      />
    )
  }

  function startEdit(p: Proveedor) {
    setEditId(p.id)
    setEditData({
      nombre:   p.nombre,
      contacto: p.contacto ?? '',
      telefono: p.telefono ?? '',
      email:    p.email    ?? '',
      notas:    p.notas    ?? ''
    })
    setAdding(false)
  }

  function cancelEdit() { setEditId(null) }
  function cancelAdd()  { setAdding(false); setNewData(EMPTY_FORM) }

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-accent" />
          <h3 className="text-[14px] font-bold text-primary">Proveedores</h3>
          <span className="text-[12px] text-primary-muted">
            ({proveedores.filter(p => p.activo).length})
          </span>
        </div>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setEditId(null) }}
            className="btn-primary"
          >
            <Plus size={13} /> Agregar
          </button>
        )}
      </div>

      {/* Formulario nuevo */}
      {adding && (
        <div className="bg-sidebar border border-accent/30 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-[12.5px] font-semibold text-accent">Nuevo proveedor</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Nombre *</label>
              <input
                className="input h-8 text-[13px]"
                placeholder="Ej: Confecciones Pérez"
                value={newData.nombre}
                onChange={e => setNewData(d => ({ ...d, nombre: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="input-label">Contacto</label>
              <input
                className="input h-8 text-[13px]"
                placeholder="Nombre de la persona"
                value={newData.contacto}
                onChange={e => setNewData(d => ({ ...d, contacto: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">Teléfono</label>
              <input
                className="input h-8 text-[13px]"
                placeholder="Ej: 300 123 4567"
                value={newData.telefono}
                onChange={e => setNewData(d => ({ ...d, telefono: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">Email</label>
              <input
                className="input h-8 text-[13px]"
                placeholder="Ej: proveedor@mail.com"
                value={newData.email}
                onChange={e => setNewData(d => ({ ...d, email: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="input-label">Notas</label>
              <input
                className="input h-8 text-[13px]"
                placeholder="Notas adicionales (opcional)"
                value={newData.notas}
                onChange={e => setNewData(d => ({ ...d, notas: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={cancelAdd} className="btn-ghost">
              <X size={13} /> Cancelar
            </button>
            <button onClick={handleAgregar} disabled={saving} className="btn-primary">
              <Check size={13} /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : proveedores.filter(p => p.activo).length === 0 && !adding ? (
        <EmptyState
          icon={Truck}
          title="Sin proveedores"
          description="Agregá tu primer proveedor para comenzar."
        />
      ) : (
        <div className="flex flex-col gap-1">
          {proveedores.filter(p => p.activo).map(p => (
            <div key={p.id}>
              {editId === p.id ? (
                /* Fila edición */
                <div className="bg-sidebar border border-accent/30 rounded-xl p-4 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="input-label">Nombre *</label>
                      <input
                        className="input h-8 text-[13px]"
                        value={editData.nombre}
                        onChange={e => setEditData(d => ({ ...d, nombre: e.target.value }))}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="input-label">Contacto</label>
                      <input
                        className="input h-8 text-[13px]"
                        value={editData.contacto}
                        onChange={e => setEditData(d => ({ ...d, contacto: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="input-label">Teléfono</label>
                      <input
                        className="input h-8 text-[13px]"
                        value={editData.telefono}
                        onChange={e => setEditData(d => ({ ...d, telefono: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="input-label">Email</label>
                      <input
                        className="input h-8 text-[13px]"
                        value={editData.email}
                        onChange={e => setEditData(d => ({ ...d, email: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="input-label">Notas</label>
                      <input
                        className="input h-8 text-[13px]"
                        value={editData.notas}
                        onChange={e => setEditData(d => ({ ...d, notas: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="btn-ghost">
                      <X size={13} /> Cancelar
                    </button>
                    <button onClick={handleGuardarEdicion} disabled={saving} className="btn-primary">
                      <Check size={13} /> {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Fila normal */
                <div className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl',
                  'bg-sidebar border border-border',
                  'hover:border-accent/30 transition-colors'
                )}>
                  <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center
                                  justify-center text-accent shrink-0">
                    <Truck size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-primary truncate">{p.nombre}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {p.contacto && (
                        <span className="text-[11.5px] text-primary-muted truncate">{p.contacto}</span>
                      )}
                      {p.telefono && (
                        <span className="flex items-center gap-1 text-[11.5px] text-primary-muted">
                          <Phone size={10} />{p.telefono}
                        </span>
                      )}
                      {p.email && (
                        <span className="flex items-center gap-1 text-[11.5px] text-primary-muted">
                          <Mail size={10} />{p.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(p)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center
                                 text-primary-muted hover:text-accent hover:bg-accent-light
                                 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleEliminar(p)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center
                                 text-primary-muted hover:text-danger hover:bg-danger/10
                                 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
