import { useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, CreditCard, Check, X,
  ChevronDown, ChevronRight, Percent, DollarSign
} from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { formatCOP } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'

interface MedioPago {
  id:     number
  nombre: string
  activo: number
}

interface Tarifa {
  id:            number
  medio_pago_id: number
  concepto:      string
  comision_pct:  number
  comision_fija: number
  activo:        number
}

export default function ConfigMediosPago() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,     setLoading]    = useState(true)
  const [medios,      setMedios]     = useState<MedioPago[]>([])
  const [editId,      setEditId]     = useState<number | null>(null)
  const [editNombre,  setEditNombre] = useState('')
  const [newNombre,   setNewNombre]  = useState('')
  const [adding,      setAdding]     = useState(false)
  const [saving,      setSaving]     = useState(false)

  // Tarifas
  const [expandedId,   setExpandedId]   = useState<number | null>(null)
  const [tarifas,      setTarifas]      = useState<Record<number, Tarifa[]>>({})
  const [addingTarifa, setAddingTarifa] = useState(false)
  const [newTarifa,    setNewTarifa]    = useState({ concepto: '', comision_pct: 0, comision_fija: 0 })
  const [editTarifaId, setEditTarifaId] = useState<number | null>(null)
  const [editTarifa,   setEditTarifa]   = useState({ concepto: '', comision_pct: 0, comision_fija: 0 })
  const [savingTarifa, setSavingTarifa] = useState(false)

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

  async function loadTarifas(medioId: number) {
    try {
      const data = await window.electronAPI.db.query<Tarifa>(
        `SELECT * FROM medios_pago_tarifas WHERE medio_pago_id = ? ORDER BY concepto`,
        [medioId]
      )
      setTarifas(prev => ({ ...prev, [medioId]: data }))
    } catch {
      toast.error('Error al cargar tarifas')
    }
  }

  useEffect(() => { loadMedios() }, [])

  // ── Medios: Agregar ───────────────────────────────────────
  async function handleAgregar() {
    if (!newNombre.trim()) { toast.warning('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO medios_pago (nombre, activo, created_at, updated_at)
         VALUES (?, 1, datetime('now'), datetime('now'))`,
        [newNombre.trim()]
      )
      toast.success(`"${newNombre}" agregado`)
      setNewNombre(''); setAdding(false)
      loadMedios()
    } catch {
      toast.error('Error al crear medio de pago')
    } finally {
      setSaving(false)
    }
  }

  // ── Medios: Editar ────────────────────────────────────────
  async function handleGuardarEdicion(id: number) {
    if (!editNombre.trim()) { toast.warning('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE medios_pago SET nombre = ?, updated_at = datetime('now') WHERE id = ?`,
        [editNombre.trim(), id]
      )
      toast.success('Actualizado')
      setEditId(null)
      loadMedios()
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  // ── Medios: Toggle activo ─────────────────────────────────
  async function handleToggleActivo(medio: MedioPago) {
    try {
      await window.electronAPI.db.run(
        `UPDATE medios_pago SET activo = ?, updated_at = datetime('now') WHERE id = ?`,
        [medio.activo ? 0 : 1, medio.id]
      )
      loadMedios()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  // ── Medios: Eliminar ──────────────────────────────────────
  function handleEliminar(medio: MedioPago) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar "${medio.nombre}"?`}
        description="Se eliminarán también sus tarifas. Si tiene ventas asociadas, no podrá eliminarse."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(`DELETE FROM medios_pago WHERE id = ?`, [medio.id])
            toast.success(`"${medio.nombre}" eliminado`)
            loadMedios()
          } catch {
            toast.error('No se puede eliminar: tiene ventas asociadas')
          }
        }}
      />
    )
  }

  // ── Tarifas: Expand ───────────────────────────────────────
  async function handleExpandir(medioId: number) {
    if (expandedId === medioId) {
      setExpandedId(null)
      setAddingTarifa(false)
      setEditTarifaId(null)
    } else {
      setExpandedId(medioId)
      setAddingTarifa(false)
      setEditTarifaId(null)
      setNewTarifa({ concepto: '', comision_pct: 0, comision_fija: 0 })
      await loadTarifas(medioId)
    }
  }

  // ── Tarifas: Agregar ──────────────────────────────────────
  async function handleAgregarTarifa(medioId: number) {
    if (!newTarifa.concepto.trim()) { toast.warning('El concepto es obligatorio'); return }
    setSavingTarifa(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO medios_pago_tarifas
           (medio_pago_id, concepto, comision_pct, comision_fija, activo, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
        [medioId, newTarifa.concepto.trim(), newTarifa.comision_pct, newTarifa.comision_fija]
      )
      toast.success('Tarifa agregada')
      setNewTarifa({ concepto: '', comision_pct: 0, comision_fija: 0 })
      setAddingTarifa(false)
      await loadTarifas(medioId)
    } catch {
      toast.error('Error al agregar tarifa')
    } finally {
      setSavingTarifa(false)
    }
  }

  // ── Tarifas: Guardar edición ──────────────────────────────
  async function handleGuardarEditTarifa(tarifa: Tarifa) {
    if (!editTarifa.concepto.trim()) { toast.warning('El concepto es obligatorio'); return }
    setSavingTarifa(true)
    try {
      await window.electronAPI.db.run(
        `UPDATE medios_pago_tarifas
         SET concepto = ?, comision_pct = ?, comision_fija = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [editTarifa.concepto.trim(), editTarifa.comision_pct, editTarifa.comision_fija, tarifa.id]
      )
      toast.success('Tarifa actualizada')
      setEditTarifaId(null)
      await loadTarifas(tarifa.medio_pago_id)
    } catch {
      toast.error('Error al actualizar tarifa')
    } finally {
      setSavingTarifa(false)
    }
  }

  // ── Tarifas: Toggle activo ────────────────────────────────
  async function handleToggleTarifa(tarifa: Tarifa) {
    try {
      await window.electronAPI.db.run(
        `UPDATE medios_pago_tarifas SET activo = ?, updated_at = datetime('now') WHERE id = ?`,
        [tarifa.activo ? 0 : 1, tarifa.id]
      )
      await loadTarifas(tarifa.medio_pago_id)
    } catch {
      toast.error('Error al actualizar tarifa')
    }
  }

  // ── Tarifas: Eliminar ─────────────────────────────────────
  function handleEliminarTarifa(tarifa: Tarifa) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar tarifa "${tarifa.concepto}"?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM medios_pago_tarifas WHERE id = ?`, [tarifa.id]
            )
            toast.success('Tarifa eliminada')
            await loadTarifas(tarifa.medio_pago_id)
          } catch {
            toast.error('Error al eliminar tarifa')
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
          <CreditCard size={16} className="text-accent" />
          <h3 className="text-[15px] font-bold text-primary">Medios de pago</h3>
        </div>
        <button
          onClick={() => { setAdding(true); setEditId(null) }}
          className="btn-primary h-8 text-[12.5px]"
          disabled={adding}
        >
          <Plus size={13} /> Nuevo medio
        </button>
      </div>

      {/* Formulario nuevo medio */}
      {adding && (
        <div className="flex items-end gap-2 p-4 rounded-xl border
                        border-accent/30 bg-accent-light animate-fade-in">
          <div className="flex-1">
            <label className="input-label">Nombre</label>
            <input
              type="text"
              placeholder="Ej: Nequi, Efectivo, Bold, MercadoPago…"
              className="input h-9 text-[13px]"
              value={newNombre}
              onChange={e => setNewNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAgregar()}
              autoFocus
            />
          </div>
          <button onClick={handleAgregar} disabled={saving}
            className="btn-primary h-9 text-[13px] shrink-0">
            {saving ? <Spinner size="sm" /> : <Check size={14} />} Guardar
          </button>
          <button onClick={() => { setAdding(false); setNewNombre('') }}
            className="btn-ghost h-9 text-[13px] shrink-0" disabled={saving}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="lg" /></div>
      ) : medios.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin medios de pago"
          description='Crea tu primer medio con "Nuevo medio".'
        />
      ) : (
        <div className="flex flex-col gap-2">
          {medios.map(medio => {
            const isEditing  = editId === medio.id
            const isExpanded = expandedId === medio.id
            const listaTarifas = tarifas[medio.id] ?? []

            return (
              <div
                key={medio.id}
                className={cn(
                  'rounded-xl border transition-all duration-150',
                  isExpanded
                    ? 'border-accent/30 bg-[#0B0B16]'
                    : 'border-border bg-[#0B0B16]',
                  !medio.activo && 'opacity-50'
                )}
              >
                {/* Fila principal */}
                <div className="flex items-center gap-3 px-4 py-3">
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
                      <button onClick={() => handleGuardarEdicion(medio.id)} disabled={saving}
                        className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors">
                        {saving ? <Spinner size="sm" /> : <Check size={14} />}
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="p-1.5 rounded-lg text-primary-muted hover:bg-white/5 transition-colors">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-7 h-7 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
                        <CreditCard size={13} className="text-accent" />
                      </div>

                      <p className="flex-1 text-[13.5px] font-semibold text-primary">
                        {medio.nombre}
                      </p>

                      {/* Cantidad de tarifas */}
                      {(tarifas[medio.id]?.length ?? 0) > 0 && !isExpanded && (
                        <span className="text-[11.5px] text-primary-muted">
                          {tarifas[medio.id].length} tarifa{tarifas[medio.id].length !== 1 ? 's' : ''}
                        </span>
                      )}

                      {/* Toggle tarifas */}
                      <button
                        onClick={() => handleExpandir(medio.id)}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-lg',
                          'text-[12px] border transition-colors',
                          isExpanded
                            ? 'border-accent/30 text-accent bg-accent-light'
                            : 'border-border text-primary-muted hover:border-accent/30 hover:text-accent'
                        )}
                        title="Gestionar tarifas"
                      >
                        <Percent size={12} />
                        Tarifas
                        {isExpanded
                          ? <ChevronDown size={11} />
                          : <ChevronRight size={11} />
                        }
                      </button>

                      {/* Toggle activo */}
                      <button
                        onClick={() => handleToggleActivo(medio)}
                        className={cn(
                          'text-[12px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
                          medio.activo
                            ? 'border-success/30 text-success bg-success/10 hover:bg-success/20'
                            : 'border-border text-primary-muted hover:border-accent/30'
                        )}
                      >
                        {medio.activo ? 'Activo' : 'Inactivo'}
                      </button>

                      {/* Acciones */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditId(medio.id); setEditNombre(medio.nombre); setAdding(false) }}
                          className="p-1.5 rounded-lg text-primary-muted hover:text-primary hover:bg-white/5 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleEliminar(medio)}
                          className="p-1.5 rounded-lg text-primary-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Panel de tarifas (expandible) */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-3">

                    <div className="flex items-center justify-between">
                      <p className="text-[11.5px] font-bold text-primary-muted uppercase tracking-wider">
                        Tarifas de cobro
                      </p>
                      <button
                        onClick={() => { setAddingTarifa(true); setEditTarifaId(null) }}
                        className="btn-ghost h-7 text-[12px]"
                        disabled={addingTarifa}
                      >
                        <Plus size={12} /> Agregar tarifa
                      </button>
                    </div>

                    {/* Form nueva tarifa */}
                    {addingTarifa && (
                      <div className="flex items-end gap-2 p-3 rounded-xl border border-accent/20 bg-accent-light/50">
                        <div className="flex-1">
                          <label className="input-label">Concepto</label>
                          <input
                            type="text"
                            placeholder="Ej: PSE, Tarjeta crédito, Link de pago…"
                            className="input h-8 text-[13px]"
                            value={newTarifa.concepto}
                            onChange={e => setNewTarifa(p => ({ ...p, concepto: e.target.value }))}
                            autoFocus
                          />
                        </div>
                        <div className="w-24">
                          <label className="input-label">% Comisión</label>
                          <input
                            type="number" step="0.01" min="0"
                            className="input h-8 text-[13px]"
                            value={newTarifa.comision_pct}
                            onChange={e => setNewTarifa(p => ({ ...p, comision_pct: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="w-28">
                          <label className="input-label">Fijo (COP)</label>
                          <input
                            type="number" min="0"
                            className="input h-8 text-[13px]"
                            value={newTarifa.comision_fija}
                            onChange={e => setNewTarifa(p => ({ ...p, comision_fija: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                        <button
                          onClick={() => handleAgregarTarifa(medio.id)}
                          disabled={savingTarifa}
                          className="btn-primary h-8 text-[12.5px] shrink-0"
                        >
                          {savingTarifa ? <Spinner size="sm" /> : <Check size={13} />}
                          Guardar
                        </button>
                        <button
                          onClick={() => { setAddingTarifa(false); setNewTarifa({ concepto: '', comision_pct: 0, comision_fija: 0 }) }}
                          className="btn-ghost h-8 text-[12.5px] shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}

                    {/* Lista tarifas */}
                    {listaTarifas.length === 0 && !addingTarifa ? (
                      <p className="text-[12.5px] text-primary-muted italic py-1">
                        Sin tarifas configuradas. Agregá los conceptos de cobro de este procesador.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {listaTarifas.map(t => (
                          <div
                            key={t.id}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg border',
                              editTarifaId === t.id
                                ? 'border-accent/30 bg-accent-light/40'
                                : 'border-border/60 bg-[#0F0F1A]',
                              !t.activo && 'opacity-50'
                            )}
                          >
                            {editTarifaId === t.id ? (
                              <>
                                <input
                                  type="text"
                                  className="input h-7 text-[12.5px] flex-1"
                                  value={editTarifa.concepto}
                                  onChange={e => setEditTarifa(p => ({ ...p, concepto: e.target.value }))}
                                  autoFocus
                                />
                                <input
                                  type="number" step="0.01" min="0"
                                  className="input h-7 text-[12.5px] w-20"
                                  value={editTarifa.comision_pct}
                                  onChange={e => setEditTarifa(p => ({ ...p, comision_pct: parseFloat(e.target.value) || 0 }))}
                                />
                                <input
                                  type="number" min="0"
                                  className="input h-7 text-[12.5px] w-24"
                                  value={editTarifa.comision_fija}
                                  onChange={e => setEditTarifa(p => ({ ...p, comision_fija: parseFloat(e.target.value) || 0 }))}
                                />
                                <button onClick={() => handleGuardarEditTarifa(t)} disabled={savingTarifa}
                                  className="p-1 rounded text-success hover:bg-success/10 transition-colors">
                                  {savingTarifa ? <Spinner size="sm" /> : <Check size={13} />}
                                </button>
                                <button onClick={() => setEditTarifaId(null)}
                                  className="p-1 rounded text-primary-muted hover:bg-white/5 transition-colors">
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <>
                                <p className="flex-1 text-[13px] font-medium text-primary">
                                  {t.concepto}
                                </p>
                                <div className="flex items-center gap-1 text-[12px] text-primary-muted">
                                  <Percent size={11} className="text-warning" />
                                  <span className="text-warning font-semibold">{t.comision_pct}%</span>
                                  {t.comision_fija > 0 && (
                                    <>
                                      <span className="mx-1">+</span>
                                      <DollarSign size={11} className="text-accent2" />
                                      <span className="text-accent2 font-semibold">
                                        {formatCOP(t.comision_fija)}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleToggleTarifa(t)}
                                  className={cn(
                                    'text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition-colors',
                                    t.activo
                                      ? 'border-success/30 text-success bg-success/10 hover:bg-success/20'
                                      : 'border-border text-primary-muted hover:border-accent/30'
                                  )}
                                >
                                  {t.activo ? 'Activa' : 'Inactiva'}
                                </button>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditTarifaId(t.id)
                                      setEditTarifa({ concepto: t.concepto, comision_pct: t.comision_pct, comision_fija: t.comision_fija })
                                      setAddingTarifa(false)
                                    }}
                                    className="p-1 rounded text-primary-muted hover:text-primary hover:bg-white/5 transition-colors"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleEliminarTarifa(t)}
                                    className="p-1 rounded text-primary-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
