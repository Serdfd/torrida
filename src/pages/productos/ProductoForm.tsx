import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Package, ImagePlus } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { getColecciones, getTallas } from '@/lib/queries'
import Spinner from '@/components/ui/Spinner'

interface ProductoFormData {
  nombre:        string
  referencia:    string
  descripcion:   string
  precio_venta:  number
  coleccion_id:  number
  imagen_url:    string
  activo:        boolean
  // Stock inicial por talla
  stock:         Record<string, number>
}

interface ProductoFormProps {
  producto?: any
  onSuccess: () => void
  onCancel:  () => void
}

export default function ProductoForm({
  producto,
  onSuccess,
  onCancel
}: ProductoFormProps) {
  const toast = useToast()
  const isEditing = Boolean(producto?.id)

  const [colecciones,    setColecciones]    = useState<any[]>([])
  const [tallas,         setTallas]         = useState<any[]>([])
  const [saving,         setSaving]         = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [previewUrl,     setPreviewUrl]     = useState<string>(producto?.imagen_url ?? '')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ProductoFormData>({
    defaultValues: {
      nombre:       producto?.nombre       ?? '',
      referencia:   producto?.referencia   ?? '',
      descripcion:  producto?.descripcion  ?? '',
      precio_venta: producto?.precio_venta ?? 0,
      coleccion_id: producto?.coleccion_id ?? 0,
      imagen_url:   producto?.imagen_url   ?? '',
      activo:       producto?.activo !== undefined ? Boolean(producto.activo) : true,
      stock:        {}
    }
  })

  const watchImagenUrl = watch('imagen_url')

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [cols, tals] = await Promise.all([
          getColecciones(),
          getTallas()
        ])
        setColecciones(cols)
        setTallas(tals)

        // Si es edición, cargar stock actual por talla
        if (isEditing && producto?.id) {
          const stockRows = await window.electronAPI.db.query<{
            talla_id: number; stock: number
          }>(
            `SELECT talla_id, stock FROM inventario_productos WHERE producto_id = ?`,
            [producto.id]
          )
          const stockMap: Record<string, number> = {}
          stockRows.forEach(r => { stockMap[String(r.talla_id)] = r.stock })
          setValue('stock', stockMap)
        }
      } catch {
        toast.error('Error cargando catálogos')
      } finally {
        setLoadingCatalog(false)
      }
    }
    loadCatalog()
  }, [])

  // Preview imagen en tiempo real
  useEffect(() => {
    setPreviewUrl(watchImagenUrl)
  }, [watchImagenUrl])

  async function onSubmit(data: ProductoFormData) {
    if (!data.nombre.trim()) {
      toast.warning('El nombre es obligatorio')
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        // Actualizar producto
        await window.electronAPI.db.run(
          `UPDATE productos SET
             nombre       = ?,
             referencia   = ?,
             descripcion  = ?,
             precio_venta = ?,
             coleccion_id = ?,
             imagen_url   = ?,
             activo       = ?,
             updated_at   = datetime('now')
           WHERE id = ?`,
          [
            data.nombre.trim(),
            data.referencia.trim() || null,
            data.descripcion.trim() || null,
            data.precio_venta,
            data.coleccion_id || null,
            data.imagen_url.trim() || null,
            data.activo ? 1 : 0,
            producto.id
          ]
        )

        // Actualizar stock por talla
        for (const talla of tallas) {
          const stockVal = Number(data.stock?.[String(talla.id)] ?? 0)
          await window.electronAPI.db.run(
            `INSERT INTO inventario_productos (producto_id, talla_id, stock, updated_at)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(producto_id, talla_id)
             DO UPDATE SET stock = ?, updated_at = datetime('now')`,
            [producto.id, talla.id, stockVal, stockVal]
          )
        }

        toast.success(`"${data.nombre}" actualizado`)
      } else {
        // Crear producto
        const result = await window.electronAPI.db.run(
          `INSERT INTO productos
             (nombre, referencia, descripcion, precio_venta,
              coleccion_id, imagen_url, activo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            data.nombre.trim(),
            data.referencia.trim() || null,
            data.descripcion.trim() || null,
            data.precio_venta,
            data.coleccion_id || null,
            data.imagen_url.trim() || null,
            data.activo ? 1 : 0
          ]
        )
        const nuevoId = result.lastInsertRowid

        // Crear stock inicial por talla
        for (const talla of tallas) {
          const stockVal = Number(data.stock?.[String(talla.id)] ?? 0)
          await window.electronAPI.db.run(
            `INSERT INTO inventario_productos
               (producto_id, talla_id, stock, updated_at)
             VALUES (?, ?, ?, datetime('now'))`,
            [nuevoId, talla.id, stockVal]
          )
        }

        toast.success(`"${data.nombre}" creado correctamente`)
      }

      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar el producto')
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
    <div className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1">

      {/* Título */}
      <div className="flex items-center gap-2 mb-1">
        <Package size={18} className="text-accent" />
        <h2 className="text-[16px] font-bold text-primary">
          {isEditing ? 'Editar producto' : 'Nuevo producto'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

        {/* Fila 1: Nombre + Referencia */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">
              Nombre <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej: Biker Caramel"
              className="input"
              {...register('nombre', { required: true })}
            />
            {errors.nombre && (
              <p className="text-[12px] text-danger mt-1">Campo requerido</p>
            )}
          </div>
          <div>
            <label className="input-label">Referencia</label>
            <input
              type="text"
              placeholder="Ej: BIK-001"
              className="input"
              {...register('referencia')}
            />
          </div>
        </div>

        {/* Fila 2: Precio + Colección + Activo */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="input-label">
              Precio venta <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              min={0}
              placeholder="0"
              className="input"
              {...register('precio_venta', {
                required: true,
                min: 0,
                valueAsNumber: true
              })}
            />
          </div>
          <div>
            <label className="input-label">Colección</label>
            <select className="input" {...register('coleccion_id')}>
              <option value="">— Sin colección —</option>
              {colecciones.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.anio ? `(${c.anio})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="input-label">Estado</label>
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent-DEFAULT"
                {...register('activo')}
              />
              <span className="text-[13.5px] text-primary">Activo</span>
            </label>
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="input-label">Descripción</label>
          <textarea
            rows={2}
            placeholder="Descripción breve del producto…"
            className="input resize-none"
            {...register('descripcion')}
          />
        </div>

        {/* Imagen URL */}
        <div>
          <label className="input-label">URL de imagen</label>
          <input
            type="url"
            placeholder="https://…"
            className="input"
            {...register('imagen_url')}
          />
          {previewUrl && (
            <div className="mt-2 relative w-24 h-24 rounded-xl overflow-hidden
                            border border-border bg-[#0B0B16]">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={() => setPreviewUrl('')}
              />
            </div>
          )}
          {!previewUrl && (
            <div className="mt-2 w-24 h-24 rounded-xl border border-dashed border-border
                            bg-[#0B0B16] flex items-center justify-center
                            text-primary-muted">
              <ImagePlus size={22} strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Stock por talla */}
        <div>
          <label className="input-label mb-2">
            Stock por talla {isEditing ? '(actual)' : '(inicial)'}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {tallas.map(talla => (
              <div key={talla.id} className="flex flex-col items-center gap-1">
                <span className="text-[12px] font-bold text-primary-muted uppercase">
                  {talla.nombre}
                </span>
                <input
                  type="number"
                  min={0}
                  defaultValue={0}
                  className="input h-9 text-center text-[13px] px-2"
                  {...register(`stock.${talla.id}`, { valueAsNumber: true })}
                />
              </div>
            ))}
          </div>
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
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                Guardando…
              </span>
            ) : isEditing ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>

      </form>
    </div>
  )
}