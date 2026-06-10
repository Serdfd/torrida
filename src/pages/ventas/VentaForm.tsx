import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, ShoppingBag } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { getCanalesVenta, getMediosPago, getProductos, getTallas } from '@/lib/queries'
import { formatCOP } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

interface ItemForm {
  producto_id:    number
  talla_id:       number
  cantidad:       number
  precio_unitario: number
  descuento_item: number
}

interface VentaFormData {
  fecha:            string
  canal_id:         number
  medio_pago_id:    number
  cliente_nombre:   string
  cliente_telefono: string
  costo_envio:      number
  descuento:        number
  notas:            string
  items:            ItemForm[]
}

interface VentaFormProps {
  ventaId?: number
  onSuccess: () => void
  onCancel:  () => void
}

export default function VentaForm({ ventaId, onSuccess, onCancel }: VentaFormProps) {
  const toast = useToast()
  const isEditing = Boolean(ventaId)

  const [canales,        setCanales]        = useState<any[]>([])
  const [medios,         setMedios]         = useState<any[]>([])
  const [productos,      setProductos]      = useState<any[]>([])
  const [tallas,         setTallas]         = useState<any[]>([])
  const [saving,         setSaving]         = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(true)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset
  } = useForm<VentaFormData>({
    defaultValues: {
      fecha:            new Date().toISOString().slice(0, 10),
      canal_id:         0,
      medio_pago_id:    0,
      cliente_nombre:   '',
      cliente_telefono: '',
      costo_envio:      0,
      descuento:        0,
      notas:            '',
      items: [{ producto_id: 0, talla_id: 0, cantidad: 1, precio_unitario: 0, descuento_item: 0 }]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchItems    = watch('items')
  const watchDescuento = watch('descuento')
  const watchEnvio    = watch('costo_envio')
  const watchCanalId  = watch('canal_id')

  const canalSeleccionado = canales.find(c => c.id === Number(watchCanalId))
  const pctComision       = canalSeleccionado?.comision_pct ?? 0

  const subtotal = watchItems.reduce((s, it) => {
    return s + (it.cantidad ?? 0) * (it.precio_unitario ?? 0) - (it.descuento_item ?? 0)
  }, 0)
  const descuentoGlobal = Number(watchDescuento) || 0
  const envio           = Number(watchEnvio)     || 0
  const totalConEnvio   = subtotal - descuentoGlobal + envio
  const comision        = totalConEnvio * (pctComision / 100)

  // ── Cargar catálogos ──────────────────────────────────────────────────────
  useEffect(() => {
    async function loadCatalog() {
      try {
        const [c, m, p, t] = await Promise.all([
          getCanalesVenta(),
          getMediosPago(),
          getProductos(),
          getTallas()
        ])
        setCanales(c)
        setMedios(m)
        setProductos(p)
        setTallas(t)
        if (c.length > 0) setValue('canal_id', c[0].id)
        if (m.length > 0) setValue('medio_pago_id', m[0].id)
      } catch {
        toast.error('Error cargando catálogos')
      } finally {
        setLoadingCatalog(false)
      }
    }
    loadCatalog()
  }, [])

  // ── Cargar venta existente si es edición ──────────────────────────────────
  useEffect(() => {
    if (!ventaId || loadingCatalog) return

    async function loadVenta() {
      try {
        const [ventas, items] = await Promise.all([
          window.electronAPI.db.query<any>(
            `SELECT * FROM ventas WHERE id = ?`, [ventaId]
          ),
          window.electronAPI.db.query<any>(
            `SELECT * FROM venta_items WHERE venta_id = ?`, [ventaId]
          )
        ])
        const v = ventas[0]
        if (!v) return

        reset({
          fecha:            v.fecha,
          canal_id:         v.canal_id      ?? 0,
          medio_pago_id:    v.medio_pago_id ?? 0,
          cliente_nombre:   v.cliente_nombre   ?? '',
          cliente_telefono: v.cliente_telefono ?? '',
          costo_envio:      v.costo_envio    ?? 0,
          descuento:        v.descuento      ?? 0,
          notas:            v.notas          ?? '',
          items: items.map((it: any) => ({
            producto_id:     it.producto_id,
            talla_id:        it.talla_id ?? 0,
            cantidad:        it.cantidad,
            precio_unitario: it.precio_unitario,
            descuento_item:  it.descuento_item
          }))
        })
      } catch {
        toast.error('Error cargando venta')
      }
    }
    loadVenta()
  }, [ventaId, loadingCatalog])

  function handleProductoChange(idx: number, productoId: number) {
    const prod = productos.find(p => p.id === Number(productoId))
    if (prod?.precio_venta) {
      setValue(`items.${idx}.precio_unitario`, prod.precio_venta)
    }
  }

  async function onSubmit(data: VentaFormData) {
    if (data.items.length === 0) {
      toast.warning('Agrega al menos un producto')
      return
    }
    for (const it of data.items) {
      if (!it.producto_id || it.cantidad < 1) {
        toast.warning('Completa todos los campos de los ítems')
        return
      }
    }

    setSaving(true)
    try {
      if (isEditing && ventaId) {
        // ── UPDATE ──────────────────────────────────────────────────────────
        await window.electronAPI.db.run(
          `UPDATE ventas SET
             fecha            = ?,
             canal_id         = ?,
             medio_pago_id    = ?,
             cliente_nombre   = ?,
             cliente_telefono = ?,
             subtotal         = ?,
             descuento        = ?,
             comision_canal   = ?,
             costo_envio      = ?,
             total            = ?,
             notas            = ?,
             updated_at       = datetime('now')
           WHERE id = ?`,
          [
            data.fecha,
            data.canal_id       || null,
            data.medio_pago_id  || null,
            data.cliente_nombre   || null,
            data.cliente_telefono || null,
            subtotal,
            descuentoGlobal,
            comision,
            envio,
            totalConEnvio,
            data.notas || null,
            ventaId
          ]
        )

        // Reemplazar ítems
        await window.electronAPI.db.run(
          `DELETE FROM venta_items WHERE venta_id = ?`, [ventaId]
        )
        for (const it of data.items) {
          await window.electronAPI.db.run(
            `INSERT INTO venta_items
               (venta_id, producto_id, talla_id, cantidad,
                precio_unitario, descuento_item, subtotal_item)
             VALUES (?,?,?,?,?,?,?)`,
            [
              ventaId,
              it.producto_id,
              it.talla_id   || null,
              it.cantidad,
              it.precio_unitario,
              it.descuento_item ?? 0,
              it.cantidad * it.precio_unitario - (it.descuento_item ?? 0)
            ]
          )
        }

        toast.success('Venta actualizada')

      } else {
        // ── INSERT ──────────────────────────────────────────────────────────
        const anio = new Date(data.fecha).getFullYear()
        const mes  = new Date(data.fecha).getMonth() + 1
        const pad  = (n: number) => String(n).padStart(2, '0')

        const countRow = await window.electronAPI.db.query<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM ventas
           WHERE strftime('%Y-%m', fecha) = ?`,
          [`${anio}-${pad(mes)}`]
        )
        const correlativo = (countRow[0]?.cnt ?? 0) + 1
        const numero = `V-${anio}${pad(mes)}-${String(correlativo).padStart(4, '0')}`

        const result = await window.electronAPI.db.run(
          `INSERT INTO ventas
             (numero_venta, fecha, canal_id, medio_pago_id,
              cliente_nombre, cliente_telefono,
              subtotal, descuento, comision_canal, costo_envio,
              total, notas, estado, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'completada',
                   datetime('now'), datetime('now'))`,
          [
            numero,
            data.fecha,
            data.canal_id      || null,
            data.medio_pago_id || null,
            data.cliente_nombre   || null,
            data.cliente_telefono || null,
            subtotal,
            descuentoGlobal,
            comision,
            envio,
            totalConEnvio,
            data.notas || null
          ]
        )
        const ventaIdNueva = result.lastInsertRowid

        for (const it of data.items) {
          await window.electronAPI.db.run(
            `INSERT INTO venta_items
               (venta_id, producto_id, talla_id, cantidad,
                precio_unitario, descuento_item, subtotal_item)
             VALUES (?,?,?,?,?,?,?)`,
            [
              ventaIdNueva,
              it.producto_id,
              it.talla_id   || null,
              it.cantidad,
              it.precio_unitario,
              it.descuento_item ?? 0,
              it.cantidad * it.precio_unitario - (it.descuento_item ?? 0)
            ]
          )
        }

        toast.success(`Venta ${numero} registrada`)
      }

      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar la venta')
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
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">

      <div className="flex items-center gap-2 mb-1">
        <ShoppingBag size={18} className="text-accent" />
        <h2 className="text-[16px] font-bold text-primary">
          {isEditing ? 'Editar venta' : 'Nueva venta'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

        {/* Fila 1: Fecha + Canal + Medio pago */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="input-label">Fecha</label>
            <input type="date" className="input"
              {...register('fecha', { required: true })} />
          </div>
          <div>
            <label className="input-label">Canal de venta</label>
            <select className="input" {...register('canal_id', { required: true })}>
              {canales.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Medio de pago</label>
            <select className="input" {...register('medio_pago_id')}>
              <option value="">— Sin especificar —</option>
              {medios.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila 2: Cliente */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Nombre cliente</label>
            <input type="text" placeholder="Ej: María García"
              className="input" {...register('cliente_nombre')} />
          </div>
          <div>
            <label className="input-label">Teléfono / Contacto</label>
            <input type="text" placeholder="Teléfono / Instagram"
              className="input" {...register('cliente_telefono')} />
          </div>
        </div>

        {/* Ítems */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="input-label mb-0">Productos</label>
            <button type="button"
              onClick={() => append({
                producto_id: 0, talla_id: 0,
                cantidad: 1, precio_unitario: 0, descuento_item: 0
              })}
              className="btn-ghost h-7 text-[12px] px-2"
            >
              <Plus size={12} /> Agregar
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {fields.map((field, idx) => (
              <div key={field.id}
                className="grid grid-cols-[2fr_1fr_80px_1fr_100px_32px] gap-2
                           items-end bg-[#0B0B16] border border-border rounded-lg p-3">

                <div>
                  <label className="input-label">Producto</label>
                  <select className="input h-9 text-[13px]"
                    {...register(`items.${idx}.producto_id`, { required: true })}
                    onChange={e => handleProductoChange(idx, Number(e.target.value))}>
                    <option value="">— Seleccionar —</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Talla</label>
                  <select className="input h-9 text-[13px]"
                    {...register(`items.${idx}.talla_id`)}>
                    <option value="">—</option>
                    {tallas.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Cant.</label>
                  <input type="number" min={1} className="input h-9 text-[13px]"
                    {...register(`items.${idx}.cantidad`,
                      { required: true, min: 1, valueAsNumber: true })} />
                </div>

                <div>
                  <label className="input-label">Precio unit.</label>
                  <input type="number" min={0} className="input h-9 text-[13px]"
                    {...register(`items.${idx}.precio_unitario`,
                      { required: true, min: 0, valueAsNumber: true })} />
                </div>

                <div>
                  <label className="input-label">Desc. ítem</label>
                  <input type="number" min={0} className="input h-9 text-[13px]"
                    {...register(`items.${idx}.descuento_item`,
                      { valueAsNumber: true })} />
                </div>

                <button type="button"
                  onClick={() => fields.length > 1 && remove(idx)}
                  disabled={fields.length === 1}
                  className="p-1.5 rounded-lg text-danger hover:bg-danger/10
                             transition-colors disabled:opacity-20 mb-0.5">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Fila 3: Envío + Descuento global */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Costo de envío</label>
            <input type="number" min={0} className="input"
              {...register('costo_envio', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="input-label">Descuento global</label>
            <input type="number" min={0} className="input"
              {...register('descuento', { valueAsNumber: true })} />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="input-label">Notas</label>
          <textarea rows={2} placeholder="Observaciones de la venta…"
            className="input resize-none" {...register('notas')} />
        </div>

        {/* Resumen */}
        <div className="bg-[#0B0B16] border border-border rounded-xl p-4 flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px] text-primary-muted">
            <span>Subtotal productos</span>
            <span>{formatCOP(subtotal)}</span>
          </div>
          {descuentoGlobal > 0 && (
            <div className="flex justify-between text-[13px] text-danger">
              <span>Descuento global</span>
              <span>-{formatCOP(descuentoGlobal)}</span>
            </div>
          )}
          {envio > 0 && (
            <div className="flex justify-between text-[13px] text-primary-muted">
              <span>Costo de envío</span>
              <span>{formatCOP(envio)}</span>
            </div>
          )}
          {comision > 0 && (
            <div className="flex justify-between text-[13px] text-warning">
              <span>Comisión canal ({pctComision}%)</span>
              <span>-{formatCOP(comision)}</span>
            </div>
          )}
          <div className="border-t border-border mt-1 pt-1.5 flex justify-between">
            <span className="text-[14px] font-bold text-primary">Total</span>
            <span className="text-[18px] font-bold text-accent">
              {formatCOP(totalConEnvio)}
            </span>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="btn-ghost" disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? <span className="flex items-center gap-2"><Spinner size="sm" /> Guardando…</span>
              : isEditing ? 'Guardar cambios' : 'Registrar venta'
            }
          </button>
        </div>

      </form>
    </div>
  )
}