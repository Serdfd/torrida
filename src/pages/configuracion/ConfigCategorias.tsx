import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Package, Check, X } from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'

interface Categoria {
  id:     number
  nombre: string
  color:  string
  activa: number
}

interface CategoriaFormData {
  nombre: string
  color:  string
}

const COLORES_PRESET = [
  '#F87171', // rojo
  '#FB923C', // naranja
  '#FBBF24', // amarillo
  '#34D399', // verde
  '#60A5FA', // azul
  '#A78BFA', // violeta
  '#F472B6', // rosa
  '#94A3B8', // gris azulado
  '#E879F9', // fucsia
  '#2DD4BF', // teal
]

const CATEGORIAS_SUGERIDAS = [
  { nombre: 'Producción',   color: '#F87171' },
  { nombre: 'Envíos',       color: '#60A5FA' },
  { nombre: 'Marketing',    color: '#F472B6' },
  { nombre: 'Insumos',      color: '#FBBF24' },
  { nombre: 'Nómina',       color: '#34D399' },
  { nombre: 'Plataformas',  color: '#A78BFA' },
]

export default function ConfigCategorias() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,    setLoading]    = useState(true)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [editId,     setEditId]     = useState<number | null>(null)
  const [editData,   setEditData]   = useState<CategoriaFormData>({ nombre: '', color: '#8A8AA8' })
  const [newData,    setNewData]    = useState<CategoriaFormData>({ nombre: '', color: '#8A8AA8' })
  const [adding,     setAdding]     = useState(false)
  const [saving,     setSaving]     = useState(false)

  async function loadCategorias() {
    setLoading(true)
    try {
      const data = await window.electronAPI.db.query<Categoria>(
        `SELECT * FROM categorias_gasto ORDER BY nombre`
      )
      setCategorias(data)
    } catch {
      toast.error('Error al cargar categorías')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCategorias() }, [])

  // ── Agregar ────────────────────────────────────────────
  async function handleAgregar() {
    if (!newData.nombre.trim()) {
      toast.warning('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO categorias_gasto (nombre, color, activa, created_at, updated_at)
         VALUES (?, ?, 1, datetime('now'), datetime('now'))`,
        [newData.nombre.trim(), newData.color]
      )
      toast.success(`Categoría "${newData.nombre}" creada`)
      setNewData({ nombre: '', color: '#8A8AA8' })
      setAdding(false)
      loadCategorias()
    } catch {
      toast.error('Error al crear categoría')
    } finally {
      setSaving(false)
    }
  }

  // ── Agregar sugerida ───────────────────────────────────
  async function handleAgregarSugerida(s: { nombre: string; color: string }) {
    const yaExiste = categorias.some(
      c => c.nombre.toLowerCase() === s.nombre.toLowerCase()
    )
    if (yaExiste) {
      toast.warning(`La categoría "${s.nombre}" ya existe`)
      return
    }
    try {
      await window.electronAPI.db.run(
        `INSERT INTO categorias_gasto (nombre, color, activa, created_at, updated_at)
         VALUES (?, ?, 1, datetime('now'), datetime('now'))`,
        [s.nombre, s.color]
      )
      toast.success(`"${s.nombre}" agregada`)
      loadCategorias()
    } catch {
      toast.error('Error al agregar categoría')
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
        `UPDATE categorias_gasto
         SET nombre = ?, color = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [editData.nombre.trim(), editData.color, id]
      )
      toast.success('Categoría actualizada')
      setEditId(null)
      loadCategorias()
    } catch {
      toast.error('Error al actualizar categoría')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle activa ──────────────────────────────────────
  async function handleToggleActiva(cat: Categoria) {
    try {
      await window.electronAPI.db.run(
        `UPDATE categorias_gasto
         SET activa = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [cat.activa ? 0 : 1, cat.id]
      )
      loadCategorias()
    } catch {
      toast.error('Error al actualizar categoría')
    }
  }

  // ── Eliminar ───────────────────────────────────────────
  function handleEliminar(cat: Categoria) {
    openModal(
      <ConfirmDialog
        title={`¿Eliminar "${cat.nombre}"?`}
        description="Si tiene gastos asociados, no podrá eliminarse."
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={async () => {
          closeModal()
          try {
            await window.electronAPI.db.run(
              `DELETE FROM categorias_gasto WHERE id = ?`,
              [cat.id]
            )
            toast.success(`"${cat.nombre}" eliminada`)
            loadCategorias()
          } catch {
            toast.error('No se puede eliminar: tiene gastos asociados')
          }
        }}
      />
    )
  }

  // ── Selector de color inline ───────────────────────────
  function ColorPicker({
    value,
    onChange
  }: {
    value: string
    onChange: (c: string) => void
  }) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {COLORES_PRESET.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'w-6 h-6 rounded-lg border-2 transition-all',
              value === color
                ? 'border-white scale-110'
                : 'border-transparent hover:scale-105'
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        {/* Input color personalizado */}
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-6 h-6 rounded-lg border border-border
                     bg-transparent cursor-pointer"
          title="Color personalizado"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Título sección */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-accent-DEFAULT" />
          <h3 className="text-[15px] font-bold text-primary-DEFAULT">
            Categorías de gasto
          </h3>
        </div>
        <button
          onClick={() => { setAdding(true); setEditId(null) }}
          className="btn-primary h-8 text-[12.5px]"
          disabled={adding}
        >
          <Plus size={13} />
          Nueva categoría
        </button>
      </div>

      {/* Sugeridas rápidas */}
      {categorias.length < 2 && (
        <div>
          <p className="text-[12px] text-primary-muted mb-2">
            Categorías sugeridas:
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS_SUGERIDAS.map(s => {
              const existe = categorias.some(
                c => c.nombre.toLowerCase() === s.nombre.toLowerCase()
              )
              return (
                <button
                  key={s.nombre}
                  onClick={() => handleAgregarSugerida(s)}
                  disabled={existe}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border',
                    'text-[12.5px] font-semibold transition-colors',
                    existe
                      ? 'border-border text-primary-muted opacity-40 cursor-not-allowed'
                      : 'border-dashed border-border text-primary-muted hover:border-accent-DEFAULT/40 hover:text-accent-DEFAULT'
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  {existe ? '✓' : '+'} {s.nombre}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Formulario nuevo */}
      {adding && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border
                        border-accent-DEFAULT/30 bg-accent-light
                        animate-fade-in">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="input-label">Nombre categoría</label>
              <input
                type="text"
                placeholder="Ej: Producción, Envíos, Marketing…"
                className="input h-9 text-[13px]"
                value={newData.nombre}
                onChange={e => setNewData(p => ({ ...p, nombre: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAgregar()}
                autoFocus
              />
            </div>
            {/* Preview color */}
            <div
              className="w-9 h-9 rounded-xl border-2 border-border shrink-0"
              style={{ backgroundColor: newData.color }}
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="input-label mb-1.5">Color</label>
            <ColorPicker
              value={newData.color}
              onChange={c => setNewData(p => ({ ...p, color: c }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setAdding(false); setNewData({ nombre: '', color: '#8A8AA8' }) }}
              className="btn-ghost h-9 text-[13px]"
              disabled={saving}
            >
              <X size={14} />
              Cancelar
            </button>
            <button
              onClick={handleAgregar}
              disabled={saving}
              className="btn-primary h-9 text-[13px]"
            >
              {saving ? <Spinner size="sm" /> : <Check size={14} />}
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : categorias.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin categorías de gasto"
          description='Crea tu primera categoría o usa las sugeridas.'
        />
      ) : (
        <div className="flex flex-col gap-2">
          {categorias.map(cat => {
            const isEditing = editId === cat.id
            return (
              <div
                key={cat.id}
                className={cn(
                  'flex flex-col gap-3 px-4 py-3 rounded-xl border',
                  'transition-all duration-150',
                  isEditing
                    ? 'border-accent-DEFAULT/40 bg-accent-light'
                    : 'border-border bg-[#0B0B16]',
                  !cat.activa && 'opacity-50'
                )}
              >
                {isEditing ? (
                  <>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="input-label">Nombre</label>
                        <input
                          type="text"
                          className="input h-8 text-[13px]"
                          value={editData.nombre}
                          onChange={e => setEditData(p => ({
                            ...p, nombre: e.target.value
                          }))}
                          onKeyDown={e => e.key === 'Enter' && handleGuardarEdicion(cat.id)}
                          autoFocus
                        />
                      </div>
                      <div
                        className="w-8 h-8 rounded-xl border-2 border-border shrink-0"
                        style={{ backgroundColor: editData.color }}
                      />
                    </div>

                    {/* Color picker edición */}
                    <div>
                      <label className="input-label mb-1.5">Color</label>
                      <ColorPicker
                        value={editData.color}
                        onChange={c => setEditData(p => ({ ...p, color: c }))}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditId(null)}
                        className="btn-ghost h-8 text-[12.5px]"
                      >
                        <X size={13} /> Cancelar
                      </button>
                      <button
                        onClick={() => handleGuardarEdicion(cat.id)}
                        disabled={saving}
                        className="btn-primary h-8 text-[12.5px]"
                      >
                        {saving ? <Spinner size="sm" /> : <Check size={13} />}
                        Guardar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    {/* Dot color */}
                    <div
                      className="w-8 h-8 rounded-xl shrink-0 border border-border/50"
                      style={{ backgroundColor: cat.color }}
                    />

                    {/* Nombre */}
                    <p className="flex-1 text-[13.5px] font-semibold
                                  text-primary-DEFAULT">
                      {cat.nombre}
                    </p>

                    {/* Estado */}
                    <button
                      onClick={() => handleToggleActiva(cat)}
                      className={cn(
                        'text-[12px] font-semibold px-2.5 py-1 rounded-lg',
                        'border transition-colors',
                        cat.activa
                          ? 'border-success/30 text-success bg-success/10 hover:bg-success/20'
                          : 'border-border text-primary-muted hover:border-accent-DEFAULT/30'
                      )}
                    >
                      {cat.activa ? 'Activa' : 'Inactiva'}
                    </button>

                    {/* Acciones */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditId(cat.id)
                          setEditData({ nombre: cat.nombre, color: cat.color })
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
                        onClick={() => handleEliminar(cat)}
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
      )}
    </div>
  )
}