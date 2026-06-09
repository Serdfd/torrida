import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Tag, Check, X } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'

interface Canal {
  id:            number
  nombre:        string
  comision_pct:  number
  activo:        number
}

interface CanalFormData {
  nombre:       string
  comision_pct: number
}

export default function ConfigCanales() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,  setLoading]  = useState(true)
  const [canales,  setCanales]  = useState<Canal[]>([])
  const [editId,   setEditId]   = useState<number | null>(null)
  const [editData, setEditData] = useState<CanalFormData>({ nombre: '', comision_pct: 0 })
  const [newData,  setNewData]  = useState<CanalFormData>({ nombre: '', comision_pct: 0 })
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(false)

  async function loadCanales() {
    setLoading(true)
    try {
      const data = await window.electronAPI.db.query<Canal>(
        `SELECT * FROM canales_venta ORDER BY nombre`
      )
      setCanales(data)
    } catch {
      toast.error('Error al cargar canales')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCanales() }, [])

  // ── Agregar ────────────────────────────────────────────
  async function handleAgregar() {
    if (!newData.nombre.trim()) {
      toast.warning('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO canales_venta (nombre, comision_pct, activo, created_at, updated_at)
         VALUES (?, ?, 1, datetime('now'), datetime('now'))`,
        [newData.nombre.trim(), newData.comision_pct ?? 0]
      )
      toast.success(`Canal "${newData.nombre}" creado`)
      setNewData({ nombre: '', comision_pct: 0 })
      setAdding(false)
      loadCanales()
    } catch {
      toast.error('Error al crear canal')
    } finally {
      setSaving(false)
    }
  }

  // ── Editar ─────────────────────────────────────────────
  function startEdit(canal: Canal) {
    setEditId(canal.id)
    setEditData({ nombre: canal.nombre, comision_pct: canal.comision_pct })
  }

  async function handleGuardarEdicion(id: number) {
    if (!editData.nombre.trim()) {
      toast.warning('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE canales_venta
         SET nombre = ?, comision_pct = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [editData.nombre.trim(), editData.comision_pct ?? 0, id]
      )
      toast.success('Canal actualizado')
      setEditId(null)
      loadCanales()
    } catch {
      toast.error('Error al actualizar canal')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle activo ──────────────────────────────────────
  async function handleToggleActivo(canal: Canal) {
    try {
      await window.electronAPI.db.run(
        `UPDATE canales_venta
         SET activo = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [canal.activo ? 0 : 1, canal.id]
      )
      loadCanales()
    } catch {
      toast.error('Error al actualizar canal')
    }
  }

  // ── Eliminar ───────────────────────────────────────────
  function handleEliminar(canal: Canal) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar "${canal.nombre}"?`}
        description="Si este canal tiene ventas asociadas, no podrá eliminarse."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM canales_venta WHERE id = ?`,
              [canal.id]
            )
            toast.success(`Canal "${canal.nombre}" eliminado`)
            loadCanales()
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
          <Tag size={16} className="text-accent-DEFAULT" />
          <h3 className="text-[15px] font-bold text-primary-DEFAULT">
            Canales de venta
          </h3>
        </div>
        <button
          onClick={() => { setAdding(true); setEditId(null) }}
          className="btn-primary h-8 text-[12.5px]"
          disabled={adding}
        >
          <Plus size={13} />
          Nuevo canal
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
              placeholder="Ej: Instagram, TikTok, Tienda física…"
              className="input h-9 text-[13px]"
              value={newData.nombre}
              onChange={e => setNewData(p => ({ ...p, nombre: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="w-36">
            <label className="input-label">Comisión (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              placeholder="0"
              className="input h-9 text-[13px]"
              value={newData.comision_pct}
              onChange={e => setNewData(p => ({
                ...p, comision_pct: parseFloat(e.target.value) || 0
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
            onClick={() => { setAdding(false); setNewData({ nombre: '', comision_pct: 0 }) }}
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
      ) : canales.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Sin canales de venta"
          description='Crea tu primer canal con "Nuevo canal".'
        />
      ) : (
        <div className="flex flex-col gap-2">
          {canales.map(canal => {
            const isEditing = editId === canal.id
            return (
              <div
                key={canal.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border',
                  'transition-all duration-150',
                  isEditing
                    ? 'border-accent-DEFAULT/40 bg-accent-light'
                    : 'border-border bg-[#0B0B16]',
                  !canal.activo && 'opacity-50'
                )}
              >
                {isEditing ? (
                  // Modo edición inline
                  <>
                    <input
                      type="text"
                      className="input h-8 text-[13px] flex-1"
                      value={editData.nombre}
                      onChange={e => setEditData(p => ({
                        ...p, nombre: e.target.value
                      }))}
                      autoFocus
                    />
                    <div className="flex items-center gap-1.5 w-36">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        className="input h-8 text-[13px] w-20 text-right"
                        value={editData.comision_pct}
                        onChange={e => setEditData(p => ({
                          ...p, comision_pct: parseFloat(e.target.value) || 0
                        }))}
                      />
                      <span className="text-[12px] text-primary-muted shrink-0">%</span>
                    </div>
                    <button
                      onClick={() => handleGuardarEdicion(canal.id)}
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
                  // Modo vista
                  <>
                    {/* Nombre */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold text-primary-DEFAULT">
                        {canal.nombre}
                      </p>
                    </div>

                    {/* Comisión */}
                    <div className="text-right w-28">
                      {canal.comision_pct > 0 ? (
                        <span className="badge badge-warning text-[12px]">
                          {canal.comision_pct}% comisión
                        </span>
                      ) : (
                        <span className="text-[12px] text-primary-muted">
                          Sin comisión
                        </span>
                      )}
                    </div>

                    {/* Estado */}
                    <button
                      onClick={() => handleToggleActivo(canal)}
                      className={cn(
                        'text-[12px] font-semibold px-2.5 py-1 rounded-lg',
                        'border transition-colors',
                        canal.activo
                          ? 'border-success/30 text-success bg-success/10 hover:bg-success/20'
                          : 'border-border text-primary-muted hover:border-accent-DEFAULT/30'
                      )}
                    >
                      {canal.activo ? 'Activo' : 'Inactivo'}
                    </button>

                    {/* Acciones */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(canal)}
                        className="p-1.5 rounded-lg text-primary-muted
                                   hover:text-primary-DEFAULT hover:bg-white/5
                                   transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleEliminar(canal)}
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

      {/* Tip comisiones */}
      <div className="p-3 rounded-xl bg-accent-light border border-accent-DEFAULT/20">
        <p className="text-[12px] text-primary-muted leading-relaxed">
          <strong className="text-accent-DEFAULT">Tip:</strong> La comisión se descuenta
          automáticamente al registrar una venta por ese canal.
          Ej: Instagram con 3% → una venta de $100.000 genera $3.000 de comisión.
        </p>
      </div>
    </div>
  )
}