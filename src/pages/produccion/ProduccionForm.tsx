import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Factory } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import ComboSelect from '@/components/ui/ComboSelect'

interface Producto {
  id:             number
  nombre:         string
  costo_unitario: number | null
  activo:         number
}

interface TallaStock {
  talla_id:     number
  talla_nombre: string
  stock:        number
}

interface ProduccionFormData {
  producto_id: number
  talla_id:    number
  cantidad:    number
  motivo:      string
  fecha:       string
}

interface ProduccionFormProps {
  onSuccess: () => void
  onCancel:  () => void
}

export default function ProduccionForm({ onSuccess, onCancel }: ProduccionFormProps) {
  const toast = useToast()

  const [saving,         setSaving]         = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [loadingTallas,  setLoadingTallas]  = useState(false)
  const [productos,      setProductos]      = useState<Producto[]>([])
  const [tallas,         setTallas]         = useState<TallaStock[]>([])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ProduccionFormData>({
    defaultValues: {
      producto_id: 0,
      talla_id:    0,
      cantidad:    1,
      motivo:      '',
      fecha:       new Date().toISOString().slice(0, 10)
    }
  })

  const watchProductoId = watch('producto_id')
  const watchTallaId    = watch('talla_id')
  const watchCantidad   = watch('cantidad')

  const tallaActual    = tallas.find(t => t.talla_id === Number(watchTallaId))
  const productoActual = productos.find(p => p.id === Number(watchProductoId))

  // Cargar productos
  useEffect(() => {
    async function load() {
      try {
        const data = await window.electronAPI.db.query<Producto>(
          `SELECT id, nombre, costo_unitario, activo
           FROM productos
           ORDER BY activo DESC, nombre ASC`
        )
        setProductos(data)
      } catch {
        toast.error('Error cargando productos')
      } finally {
        setLoadingCatalog(false)
      }
    }
    load()
  }, [])

  // Cargar tallas cuando cambia el producto
  useEffect(() => {
    if (!watchProductoId || Number(watchProductoId) === 0) {
      setTallas([])
      return
    }
    async function loadTallas() {
      setLoadingTallas(true)
      try {
        const data = await window.electronAPI.db.query<TallaStock>(
          `SELECT ip.talla_id, t.nombre AS talla_nombre, ip.stock
           FROM inventario_productos ip
           JOIN tallas t ON t.id = ip.talla_id
           WHERE ip.producto_id = ?
           ORDER BY t.orden ASC, t.nombre ASC`,
          [Number(watchProductoId)]
        )
        setTallas(data)
        setValue('talla_id', data[0]?.talla_id ?? 0)
      } catch {
        toast.error('Error cargando tallas')
      } finally {
        setLoadingTallas(false)
      }
    }
    loadTallas()
  }, [watchProductoId])

  async function onSubmit(data: ProduccionFormData) {
    if (!data.producto_id || Number(data.producto_id) === 0) {
      toast.warning('Selecciona un producto')
      return
    }
    if (!data.talla_id || Number(data.talla_id) === 0) {
      toast.warning('Selecciona una talla')
      return
    }
    if (data.cantidad < 1) {
      toast.warning('La cantidad debe ser mayor a 0')
      return
    }
    if (tallaActual && data.cantidad > tallaActual.stock) {
      toast.warning(`Stock insuficiente. Disponible: ${tallaActual.stock} ud.`)
      return
    }

    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO movimientos_insumos
           (insumo_id, tipo, cantidad, motivo, fecha, created_at)
         VALUES (?, 'salida_produccion', ?, ?, ?, datetime('now'))`,
        [
          Number(data.producto_id),
          data.cantidad,
          data.motivo.trim() || null,
          data.fecha
        ]
      )

      await window.electronAPI.db.run(
        `UPDATE inventario_productos
         SET stock      = stock - ?,
             updated_at = datetime('now')
         WHERE producto_id = ? AND talla_id = ?`,
        [data.cantidad, Number(data.producto_id), Number(data.talla_id)]
      )

      toast.success(`${data.cantidad} ud. registradas en producción`)
      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error('Error al registrar la producción')
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
        <Factory size={18} className="text-accent" />
        <h2 className="text-lg font-bold text-primary">
          Registrar producción
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

        {/* Producto */}
        <div>
          <label className="input-label">
            Producto <span className="text-danger">*</span>
          </label>
          {productos.length === 0 ? (
            <p className="text-sm text-warning mt-1">
              No hay productos activos.
            </p>
          ) : (
            <>
              <input type="hidden" {...register('producto_id', { required: true, valueAsNumber: true })} />
              <ComboSelect
                value={Number(watchProductoId) > 0 ? String(watchProductoId) : ''}
                onChange={v => setValue('producto_id', Number(v) as any, { shouldValidate: true })}
                options={productos.map(p => ({ value: String(p.id), label: p.activo ? p.nombre : `${p.nombre} (inactivo)` }))}
                placeholder="Seleccionar producto…"
              />
            </>
          )}
          {errors.producto_id && (
            <p className="text-sm text-danger mt-1">Selecciona un producto</p>
          )}
        </div>

        {/* Tallas */}
        {Number(watchProductoId) > 0 && (
          <div>
            <label className="input-label">
              Talla <span className="text-danger">*</span>
            </label>
            {loadingTallas ? (
              <div className="flex items-center gap-2 mt-1">
                <Spinner size="sm" />
                <span className="text-sm text-primary-muted">Cargando tallas…</span>
              </div>
            ) : tallas.length === 0 ? (
              <p className="text-sm text-warning mt-1">
                Sin stock registrado para este producto.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1">
                {tallas.map(talla => {
                  const isSelected = Number(watchTallaId) === talla.talla_id
                  return (
                    <label
                      key={talla.talla_id}
                      className={cn(
                        'flex flex-col items-center gap-0.5 px-3 py-2',
                        'rounded-xl border cursor-pointer transition-all',
                        isSelected
                          ? 'border-accent bg-accent-light'
                          : 'border-border bg-[#0B0B16] hover:border-accent/40',
                        talla.stock === 0 && !isSelected && 'opacity-40'
                      )}
                    >
                      <input
                        type="radio"
                        value={talla.talla_id}
                        className="sr-only"
                        {...register('talla_id', { valueAsNumber: true })}
                      />
                      <span className={cn(
                        'text-base font-bold',
                        isSelected ? 'text-accent' : 'text-primary'
                      )}>
                        {talla.talla_nombre}
                      </span>
                      <span className={cn(
                        'text-xs',
                        talla.stock === 0 ? 'text-danger' : 'text-primary-muted'
                      )}>
                        {talla.stock} ud.
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Stock preview */}
        {tallaActual && (
          <div className={cn(
            'flex items-center justify-between px-4 py-2.5 rounded-xl border text-base',
            tallaActual.stock === 0
              ? 'bg-danger/5 border-danger/20'
              : 'bg-success/5 border-success/20'
          )}>
            <span className="text-primary-muted">
              Stock disponible — {tallaActual.talla_nombre}
            </span>
            <span className={cn(
              'font-bold text-md',
              tallaActual.stock === 0 ? 'text-danger' : 'text-success'
            )}>
              {formatNumber(tallaActual.stock)} ud.
            </span>
          </div>
        )}

        {/* Cantidad + Fecha */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">
              Cantidad <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={tallaActual?.stock}
              className="input"
              {...register('cantidad', {
                required:      true,
                min:           1,
                valueAsNumber: true
              })}
            />
            {errors.cantidad && (
              <p className="text-sm text-danger mt-1">Mínimo 1</p>
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

        {/* Costo estimado */}
        {productoActual?.costo_unitario && Number(watchCantidad) > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5
                          rounded-xl border border-border bg-[#0B0B16] text-base">
            <span className="text-primary-muted">Costo estimado</span>
            <span className="font-bold text-accent">
              {new Intl.NumberFormat('es-CO', {
                style: 'currency', currency: 'COP', maximumFractionDigits: 0
              }).format(productoActual.costo_unitario * Number(watchCantidad))}
            </span>
          </div>
        )}

        {/* Motivo */}
        <div>
          <label className="input-label">Colección / Motivo</label>
          <textarea
            rows={2}
            placeholder="Ej: Colección verano 2025, Reposición stock…"
            className="input resize-none"
            {...register('motivo')}
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
            disabled={saving || productos.length === 0}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                Guardando…
              </span>
            ) : 'Registrar producción'}
          </button>
        </div>

      </form>
    </div>
  )
}