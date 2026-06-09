import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Receipt } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import Spinner from '@/components/ui/Spinner'

interface GastoFormData {
  descripcion:     string
  monto:           number
  fecha:           string
  categoria_id:    number
  comprobante_url: string
  notas:           string
}

interface GastoFormProps {
  gasto?:    any
  onSuccess: () => void
  onCancel:  () => void
}

export default function GastoForm({
  gasto,
  onSuccess,
  onCancel
}: GastoFormProps) {
  const toast     = useToast()
  const isEditing = Boolean(gasto?.id)

  const [categorias,     setCategorias]     = useState<any[]>([])
  const [saving,         setSaving]         = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<GastoFormData>({
    defaultValues: {
      descripcion:     gasto?.descripcion     ?? '',
      monto:           gasto?.monto           ?? 0,
      fecha:           gasto?.fecha           ?? new Date().toISOString().slice(0, 10),
      categoria_id:    gasto?.categoria_id    ?? 0,
      comprobante_url: gasto?.comprobante_url ?? '',
      notas:           gasto?.notas           ?? ''
    }
  })

  useEffect(() => {
    async function loadCatalog() {
      try {
        const cats = await window.electronAPI.db.query(
          `SELECT * FROM categorias_gasto WHERE activa = 1 ORDER BY nombre`
        )
        setCategorias(cats)
        if (!isEditing && cats.length > 0) {
          // No seteamos aquí porque defaultValues ya maneja el primer render
        }
      } catch {
        toast.error('Error cargando categorías')
      } finally {
        setLoadingCatalog(false)
      }
    }
    loadCatalog()
  }, [])

  async function onSubmit(data: GastoFormData) {
    if (!data.descripcion.trim()) {
      toast.warning('La descripción es obligatoria')
      return
    }
    if (!data.categoria_id) {
      toast.warning('Selecciona una categoría')
      return
    }
    if (data.monto <= 0) {
      toast.warning('El monto debe ser mayor a 0')
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        await window.electronAPI.db.run(
          `UPDATE gastos SET
             descripcion     = ?,
             monto           = ?,
             fecha           = ?,
             categoria_id    = ?,
             comprobante_url = ?,
             notas           = ?,
             updated_at      = datetime('now')
           WHERE id = ?`,
          [
            data.descripcion.trim(),
            data.monto,
            data.fecha,
            data.categoria_id,
            data.comprobante_url.trim() || null,
            data.notas.trim()          || null,
            gasto.id
          ]
        )
        toast.success('Gasto actualizado')
      } else {
        await window.electronAPI.db.run(
          `INSERT INTO gastos
             (descripcion, monto, fecha, categoria_id,
              comprobante_url, notas, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            data.descripcion.trim(),
            data.monto,
            data.fecha,
            data.categoria_id,
            data.comprobante_url.trim() || null,
            data.notas.trim()          || null
          ]
        )
        toast.success('Gasto registrado')
      }
      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar el gasto')
    } finally {
      setSaving(false)
    }
  }

  if (loadingCatalog) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Título */}
      <div className="flex items-center gap-2 mb-1">
        <Receipt size={18} className="text-accent-DEFAULT" />
        <h2 className="text-[16px] font-bold text-primary-DEFAULT">
          {isEditing ? 'Editar gasto' : 'Nuevo gasto'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

        {/* Fila 1: Descripción */}
        <div>
          <label className="input-label">
            Descripción <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            placeholder="Ej: Compra tela lycra negra, Domicilio cliente…"
            className="input"
            {...register('descripcion', { required: true })}
          />
          {errors.descripcion && (
            <p className="text-[12px] text-danger mt-1">Campo requerido</p>
          )}
        </div>

        {/* Fila 2: Monto + Fecha */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">
              Monto <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              min={1}
              placeholder="0"
              className="input"
              {...register('monto', {
                required:     true,
                min:          1,
                valueAsNumber: true
              })}
            />
            {errors.monto && (
              <p className="text-[12px] text-danger mt-1">Monto inválido</p>
            )}
          </div>
          <div>
            <label className="input-label">Fecha</label>
            <input
              type="date"
              className="input"
              {...register('fecha', { required: true })}
            />
          </div>
        </div>

        {/* Fila 3: Categoría */}
        <div>
          <label className="input-label">
            Categoría <span className="text-danger">*</span>
          </label>
          {categorias.length === 0 ? (
            <p className="text-[12.5px] text-warning mt-1">
              No hay categorías activas. Ve a Configuración → Categorías de gasto.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {categorias.map((cat: any) => (
                <label
                  key={cat.id}
                  className="relative flex items-center gap-2 px-3 py-2.5
                             rounded-xl border border-border bg-[#0B0B16]
                             cursor-pointer hover:border-accent-DEFAULT/40
                             transition-all has-[:checked]:border-accent-DEFAULT
                             has-[:checked]:bg-accent-light"
                >
                  <input
                    type="radio"
                    value={cat.id}
                    className="sr-only"
                    {...register('categoria_id', {
                      required:     true,
                      valueAsNumber: true
                    })}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color ?? '#8A8AA8' }}
                  />
                  <span className="text-[12.5px] font-semibold text-primary-DEFAULT
                                   leading-tight truncate">
                    {cat.nombre}
                  </span>
                </label>
              ))}
            </div>
          )}
          {errors.categoria_id && (
            <p className="text-[12px] text-danger mt-1">
              Selecciona una categoría
            </p>
          )}
        </div>

        {/* Comprobante URL */}
        <div>
          <label className="input-label">URL comprobante (opcional)</label>
          <input
            type="url"
            placeholder="https://drive.google.com/…"
            className="input"
            {...register('comprobante_url')}
          />
        </div>

        {/* Notas */}
        <div>
          <label className="input-label">Notas</label>
          <textarea
            rows={2}
            placeholder="Observaciones adicionales…"
            className="input resize-none"
            {...register('notas')}
          />
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2 pt-1 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || categorias.length === 0}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                Guardando…
              </span>
            ) : isEditing ? 'Guardar cambios' : 'Registrar gasto'}
          </button>
        </div>

      </form>
    </div>
  )
}