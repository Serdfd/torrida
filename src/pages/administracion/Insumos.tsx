import React, { useEffect, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Package, Check, X,
  ChevronDown, ChevronRight, ShoppingCart, History
} from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { formatCOP, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState    from '@/components/ui/EmptyState'
import Spinner       from '@/components/ui/Spinner'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface CategoriaInsumo {
  id:     number
  nombre: string
  color:  string
}

interface Insumo {
  id:            number
  nombre:        string
  descripcion:   string | null
  unidad:        string
  categoria_id:  number | null
  proveedor_id:  number | null
  stock_minimo:  number
  activo:        number
  // calculados
  categoria_nombre?: string
  proveedor_nombre?: string
  stock_actual?:     number
  ultimo_precio?:    number
}

interface Lote {
  id:              number
  insumo_id:       number
  proveedor_id:    number | null
  fecha_compra:    string
  cantidad:        number
  precio_unitario: number
  precio_total:    number
  notas:           string | null
  proveedor_nombre?: string
}

interface Proveedor { id: number; nombre: string }

// ── Constantes ─────────────────────────────────────────────────────────────

const UNIDADES = ['unidad', 'metro', 'kg', 'rollo', 'par', 'caja', 'litro']

const EMPTY_INSUMO = {
  nombre:       '',
  descripcion:  '',
  unidad:       'unidad',
  categoria_id: '' as number | '',
  proveedor_id: '' as number | '',
  stock_minimo: 0
}

const EMPTY_LOTE = {
  proveedor_id:    '' as number | '',
  fecha_compra:    new Date().toISOString().slice(0, 10),
  cantidad:        1,
  precio_unitario: 0,
  notas:           ''
}

// ── Componente principal ───────────────────────────────────────────────────

export default function Insumos() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,      setLoading]      = useState(true)
  const [insumos,      setInsumos]      = useState<Insumo[]>([])
  const [categorias,   setCategorias]   = useState<CategoriaInsumo[]>([])
  const [proveedores,  setProveedores]  = useState<Proveedor[]>([])
  const [expanded,     setExpanded]     = useState<number | null>(null)
  const [lotes,        setLotes]        = useState<Record<number, Lote[]>>({})
  const [loadingLotes, setLoadingLotes] = useState<number | null>(null)

  // Formulario nuevo insumo
  const [adding,    setAdding]    = useState(false)
  const [newInsumo, setNewInsumo] = useState({ ...EMPTY_INSUMO })
  const [savingNew, setSavingNew] = useState(false)

  // Formulario edición
  const [editId,   setEditId]   = useState<number | null>(null)
  const [editData, setEditData] = useState({ ...EMPTY_INSUMO })

  // Formulario nuevo lote
  const [addingLoteFor, setAddingLoteFor] = useState<number | null>(null)
  const [newLote,       setNewLote]       = useState({ ...EMPTY_LOTE })
  const [savingLote,    setSavingLote]    = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ins, cats, provs] = await Promise.all([
        window.electronAPI.db.query<Insumo>(`
          SELECT
            i.*,
            ci.nombre  AS categoria_nombre,
            p.nombre   AS proveedor_nombre,
            COALESCE(
              (SELECT SUM(
                  CASE tipo
                    WHEN 'entrada_compra'     THEN cantidad
                    WHEN 'salida_produccion'  THEN -cantidad
                    WHEN 'ajuste_manual'      THEN cantidad
                    WHEN 'ajuste_reconciliacion' THEN cantidad
                    ELSE 0
                  END
               ) FROM movimientos_insumos WHERE insumo_id = i.id
              ), 0
            ) AS stock_actual,
            (SELECT precio_unitario FROM insumo_lotes
             WHERE insumo_id = i.id ORDER BY fecha_compra DESC LIMIT 1
            ) AS ultimo_precio
          FROM insumos i
          LEFT JOIN categorias_insumo ci ON ci.id = i.categoria_id
          LEFT JOIN proveedores p        ON p.id  = i.proveedor_id
          WHERE i.activo = 1
          ORDER BY i.nombre ASC
        `),
        window.electronAPI.db.query<CategoriaInsumo>(
          `SELECT * FROM categorias_insumo ORDER BY nombre`
        ),
        window.electronAPI.db.query<Proveedor>(
          `SELECT id, nombre FROM proveedores WHERE activo = 1 ORDER BY nombre`
        )
      ])
      setInsumos(ins)
      setCategorias(cats)
      setProveedores(provs)
    } catch {
      toast.error('Error al cargar insumos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function loadLotes(insumoId: number) {
    setLoadingLotes(insumoId)
    try {
      const data = await window.electronAPI.db.query<Lote>(`
        SELECT l.*, p.nombre AS proveedor_nombre
        FROM insumo_lotes l
        LEFT JOIN proveedores p ON p.id = l.proveedor_id
        WHERE l.insumo_id = ?
        ORDER BY l.fecha_compra DESC
      `, [insumoId])
      setLotes(prev => ({ ...prev, [insumoId]: data }))
    } catch {
      toast.error('Error al cargar lotes')
    } finally {
      setLoadingLotes(null)
    }
  }

  function toggleExpand(id: number) {
    if (expanded === id) {
      setExpanded(null)
    } else {
      setExpanded(id)
      if (!lotes[id]) loadLotes(id)
      setAddingLoteFor(null)
    }
  }

  // ── CRUD Insumos ──────────────────────────────────────────────────────────

  async function handleAgregarInsumo() {
    if (!newInsumo.nombre.trim()) { toast.warning('El nombre es obligatorio'); return }
    setSavingNew(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO insumos (nombre, descripcion, unidad, categoria_id, proveedor_id, stock_minimo, activo)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          newInsumo.nombre.trim(),
          newInsumo.descripcion.trim() || null,
          newInsumo.unidad,
          newInsumo.categoria_id || null,
          newInsumo.proveedor_id || null,
          newInsumo.stock_minimo
        ]
      )
      toast.success('Insumo agregado')
      setAdding(false)
      setNewInsumo({ ...EMPTY_INSUMO })
      loadData()
    } catch {
      toast.error('Error al guardar insumo')
    } finally {
      setSavingNew(false)
    }
  }

  async function handleGuardarEdicion() {
    if (!editData.nombre.trim()) { toast.warning('El nombre es obligatorio'); return }
    try {
      await window.electronAPI.db.run(
        `UPDATE insumos SET nombre=?, descripcion=?, unidad=?, categoria_id=?,
         proveedor_id=?, stock_minimo=? WHERE id=?`,
        [
          editData.nombre.trim(),
          editData.descripcion.trim() || null,
          editData.unidad,
          editData.categoria_id || null,
          editData.proveedor_id || null,
          editData.stock_minimo,
          editId
        ]
      )
      toast.success('Insumo actualizado')
      setEditId(null)
      loadData()
    } catch {
      toast.error('Error al actualizar insumo')
    }
  }

  function handleEliminarInsumo(ins: Insumo) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar "${ins.nombre}"?`}
        description="Se desactivará el insumo. Los lotes y movimientos históricos se conservan."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `UPDATE insumos SET activo = 0 WHERE id = ?`, [ins.id]
            )
            toast.success('Insumo eliminado')
            loadData()
          } catch {
            toast.error('Error al eliminar insumo')
          }
        }}
      />
    )
  }

  // ── CRUD Lotes ────────────────────────────────────────────────────────────

  async function handleAgregarLote(insumoId: number) {
    if (!newLote.cantidad || newLote.cantidad <= 0) {
      toast.warning('La cantidad debe ser mayor a 0'); return
    }
    if (!newLote.precio_unitario || newLote.precio_unitario <= 0) {
      toast.warning('El precio unitario debe ser mayor a 0'); return
    }
    setSavingLote(true)
    try {
      const total = newLote.cantidad * newLote.precio_unitario
      await window.electronAPI.db.transaction([
        {
          sql: `INSERT INTO insumo_lotes
                  (insumo_id, proveedor_id, fecha_compra, cantidad, precio_unitario, precio_total, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [
            insumoId,
            newLote.proveedor_id || null,
            newLote.fecha_compra,
            newLote.cantidad,
            newLote.precio_unitario,
            total,
            newLote.notas.trim() || null
          ]
        },
        {
          sql: `INSERT INTO movimientos_insumos
                  (insumo_id, tipo, cantidad, fecha)
                VALUES (?, 'entrada_compra', ?, ?)`,
          params: [insumoId, newLote.cantidad, newLote.fecha_compra]
        }
      ])
      toast.success('Lote registrado')
      setAddingLoteFor(null)
      setNewLote({ ...EMPTY_LOTE })
      loadLotes(insumoId)
      loadData()
    } catch {
      toast.error('Error al registrar lote')
    } finally {
      setSavingLote(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-accent" />
          <h3 className="text-[14px] font-bold text-primary">Insumos y materiales</h3>
          <span className="text-[12px] text-primary-muted">({insumos.length})</span>
        </div>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setEditId(null) }}
            className="btn-primary h-8 text-[12.5px]"
          >
            <Plus size={13} /> Agregar
          </button>
        )}
      </div>

      {/* Formulario nuevo insumo */}
      {adding && (
        <InsumoForm
          data={newInsumo}
          categorias={categorias}
          proveedores={proveedores}
          onChange={v => setNewInsumo(prev => ({ ...prev, ...v }))}
          onSave={handleAgregarInsumo}
          onCancel={() => { setAdding(false); setNewInsumo({ ...EMPTY_INSUMO }) }}
          saving={savingNew}
          titulo="Nuevo insumo"
        />
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : insumos.length === 0 && !adding ? (
        <EmptyState
          icon={Package}
          title="Sin insumos"
          description="Agregá tus primeros insumos: marquillas, bolsas, etiquetas, tela, etc."
        />
      ) : (
        <div className="flex flex-col gap-1">
          {insumos.map(ins => {
            const isExpanded    = expanded === ins.id
            const isEditing     = editId   === ins.id
            const isAddingLote  = addingLoteFor === ins.id
            const insLotes      = lotes[ins.id] ?? []
            const stockBajo     = ins.stock_actual !== undefined && ins.stock_actual <= ins.stock_minimo

            return (
              <div key={ins.id} className="flex flex-col">
                {isEditing ? (
                  <InsumoForm
                    data={editData}
                    categorias={categorias}
                    proveedores={proveedores}
                    onChange={v => setEditData(prev => ({ ...prev, ...v }))}
                    onSave={handleGuardarEdicion}
                    onCancel={() => setEditId(null)}
                    saving={false}
                    titulo="Editar insumo"
                  />
                ) : (
                  <div className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
                    isExpanded
                      ? 'bg-sidebar border-accent/30 rounded-b-none'
                      : 'bg-sidebar border-border hover:border-accent/30'
                  )}>
                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpand(ins.id)}
                      className="text-primary-muted hover:text-accent transition-colors"
                    >
                      {isExpanded
                        ? <ChevronDown size={14} />
                        : <ChevronRight size={14} />
                      }
                    </button>

                    {/* Icono categoría */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: ins.categoria_id
                          ? (categorias.find(c => c.id === ins.categoria_id)?.color ?? '#E07A5F') + '22'
                          : 'rgba(224,122,95,0.12)'
                      }}
                    >
                      <Package size={13} style={{
                        color: categorias.find(c => c.id === ins.categoria_id)?.color ?? '#E07A5F'
                      }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13.5px] font-semibold text-primary truncate">
                          {ins.nombre}
                        </p>
                        {ins.categoria_nombre && (
                          <span className="text-[11px] text-primary-muted shrink-0">
                            {ins.categoria_nombre}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11.5px] text-primary-muted">{ins.unidad}</span>
                        {ins.ultimo_precio != null && (
                          <span className="text-[11.5px] text-primary-muted">
                            Último precio: {formatCOP(ins.ultimo_precio)}
                          </span>
                        )}
                        {ins.proveedor_nombre && (
                          <span className="text-[11.5px] text-primary-muted">
                            {ins.proveedor_nombre}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stock */}
                    <div className="text-right shrink-0">
                      <p className={cn(
                        'text-[14px] font-bold',
                        stockBajo ? 'text-danger' : 'text-primary'
                      )}>
                        {ins.stock_actual ?? 0}
                      </p>
                      <p className="text-[10.5px] text-primary-muted">{ins.unidad}(s)</p>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditId(ins.id)
                          setEditData({
                            nombre:       ins.nombre,
                            descripcion:  ins.descripcion ?? '',
                            unidad:       ins.unidad,
                            categoria_id: ins.categoria_id ?? '',
                            proveedor_id: ins.proveedor_id ?? '',
                            stock_minimo: ins.stock_minimo
                          })
                          setAdding(false)
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center
                                   text-primary-muted hover:text-accent hover:bg-accent-light
                                   transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleEliminarInsumo(ins)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center
                                   text-primary-muted hover:text-danger hover:bg-danger/10
                                   transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Panel lotes expandido */}
                {isExpanded && !isEditing && (
                  <div className="border border-accent/30 border-t-0 rounded-b-xl bg-bg px-4 py-3 flex flex-col gap-3">

                    {/* Header lotes */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History size={13} className="text-primary-muted" />
                        <span className="text-[12.5px] font-semibold text-primary-muted">
                          Lotes de compra
                        </span>
                      </div>
                      {!isAddingLote && (
                        <button
                          onClick={() => {
                            setAddingLoteFor(ins.id)
                            setNewLote({ ...EMPTY_LOTE })
                          }}
                          className="btn-primary h-7 text-[12px]"
                        >
                          <ShoppingCart size={12} /> Registrar compra
                        </button>
                      )}
                    </div>

                    {/* Formulario nuevo lote */}
                    {isAddingLote && (
                      <div className="bg-sidebar border border-accent/20 rounded-xl p-3 flex flex-col gap-3">
                        <p className="text-[12px] font-semibold text-accent">Nueva compra</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="input-label">Proveedor</label>
                            <select
                              className="input h-8 text-[13px]"
                              value={newLote.proveedor_id}
                              onChange={e => setNewLote(l => ({ ...l, proveedor_id: e.target.value ? Number(e.target.value) : '' }))}
                            >
                              <option value="">Sin especificar</option>
                              {proveedores.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="input-label">Fecha de compra</label>
                            <input
                              type="date"
                              className="input h-8 text-[13px]"
                              value={newLote.fecha_compra}
                              onChange={e => setNewLote(l => ({ ...l, fecha_compra: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="input-label">Cantidad ({ins.unidad}s)</label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              className="input h-8 text-[13px]"
                              value={newLote.cantidad}
                              onChange={e => setNewLote(l => ({ ...l, cantidad: Number(e.target.value) }))}
                            />
                          </div>
                          <div>
                            <label className="input-label">Precio unitario</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="input h-8 text-[13px]"
                              value={newLote.precio_unitario}
                              onChange={e => setNewLote(l => ({ ...l, precio_unitario: Number(e.target.value) }))}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="input-label">Notas</label>
                            <input
                              className="input h-8 text-[13px]"
                              placeholder="Ej: Factura #1234"
                              value={newLote.notas}
                              onChange={e => setNewLote(l => ({ ...l, notas: e.target.value }))}
                            />
                          </div>
                        </div>
                        {newLote.cantidad > 0 && newLote.precio_unitario > 0 && (
                          <p className="text-[12px] text-accent font-semibold">
                            Total: {formatCOP(newLote.cantidad * newLote.precio_unitario)}
                          </p>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setAddingLoteFor(null)}
                            className="btn-ghost h-7 text-[12px]"
                          >
                            <X size={12} /> Cancelar
                          </button>
                          <button
                            onClick={() => handleAgregarLote(ins.id)}
                            disabled={savingLote}
                            className="btn-primary h-7 text-[12px]"
                          >
                            <Check size={12} /> {savingLote ? 'Guardando…' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tabla lotes */}
                    {loadingLotes === ins.id ? (
                      <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                    ) : insLotes.length === 0 ? (
                      <p className="text-[12.5px] text-primary-muted text-center py-3">
                        Sin compras registradas aún
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12.5px]">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-1.5 px-2 text-primary-muted font-semibold">Fecha</th>
                              <th className="text-left py-1.5 px-2 text-primary-muted font-semibold">Proveedor</th>
                              <th className="text-right py-1.5 px-2 text-primary-muted font-semibold">Cantidad</th>
                              <th className="text-right py-1.5 px-2 text-primary-muted font-semibold">Precio unit.</th>
                              <th className="text-right py-1.5 px-2 text-primary-muted font-semibold">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {insLotes.map(lote => (
                              <tr key={lote.id} className="border-b border-border/50">
                                <td className="py-1.5 px-2 text-primary">{formatDate(lote.fecha_compra)}</td>
                                <td className="py-1.5 px-2 text-primary-muted">{lote.proveedor_nombre ?? '—'}</td>
                                <td className="py-1.5 px-2 text-right text-primary">{lote.cantidad} {ins.unidad}</td>
                                <td className="py-1.5 px-2 text-right text-primary">{formatCOP(lote.precio_unitario)}</td>
                                <td className="py-1.5 px-2 text-right font-semibold text-accent">{formatCOP(lote.precio_total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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

// ── Sub-componente: formulario insumo ──────────────────────────────────────

interface InsumoFormProps {
  data:        typeof EMPTY_INSUMO
  categorias:  CategoriaInsumo[]
  proveedores: Proveedor[]
  onChange:    (v: Partial<typeof EMPTY_INSUMO>) => void
  onSave:      () => void
  onCancel:    () => void
  saving:      boolean
  titulo:      string
}

function InsumoForm({ data, categorias, proveedores, onChange, onSave, onCancel, saving, titulo }: InsumoFormProps) {
  return (
    <div className="bg-sidebar border border-accent/30 rounded-xl p-4 flex flex-col gap-3">
      <p className="text-[12.5px] font-semibold text-accent">{titulo}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="input-label">Nombre *</label>
          <input
            className="input h-8 text-[13px]"
            placeholder="Ej: Marquilla tejida"
            value={data.nombre}
            onChange={e => onChange({ nombre: e.target.value })}
            autoFocus
          />
        </div>
        <div>
          <label className="input-label">Unidad</label>
          <select
            className="input h-8 text-[13px]"
            value={data.unidad}
            onChange={e => onChange({ unidad: e.target.value })}
          >
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Categoría</label>
          <select
            className="input h-8 text-[13px]"
            value={data.categoria_id}
            onChange={e => onChange({ categoria_id: e.target.value ? Number(e.target.value) : '' })}
          >
            <option value="">Sin categoría</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Proveedor habitual</label>
          <select
            className="input h-8 text-[13px]"
            value={data.proveedor_id}
            onChange={e => onChange({ proveedor_id: e.target.value ? Number(e.target.value) : '' })}
          >
            <option value="">Sin especificar</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Stock mínimo</label>
          <input
            type="number"
            min="0"
            step="1"
            className="input h-8 text-[13px]"
            value={data.stock_minimo}
            onChange={e => onChange({ stock_minimo: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="input-label">Descripción</label>
          <input
            className="input h-8 text-[13px]"
            placeholder="Opcional"
            value={data.descripcion}
            onChange={e => onChange({ descripcion: e.target.value })}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-ghost h-8 text-[12.5px]">
          <X size={13} /> Cancelar
        </button>
        <button onClick={onSave} disabled={saving} className="btn-primary h-8 text-[12.5px]">
          <Check size={13} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
