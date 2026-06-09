import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ArrowUpCircle, ArrowDownCircle, SlidersHorizontal } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

type TipoAjuste = 'entrada_compra' | 'salida_produccion' | 'ajuste_manual'

interface TallaStock {
  talla_id:     number
  talla_nombre: string
  stock:        number
}

interface ProductoStock {
  producto_id:     number
  producto_nombre: string
  tallas:          TallaStock[]
}

interface AjusteFormData {
  talla_id:   number
  tipo:       TipoAjuste
  cantidad:   number
  motivo:     string
}

interface AjusteStockFormProps {
  producto:  ProductoStock
  onSuccess: () => void
  onCancel:  () => void
}

const TIPOS: { value: TipoAjuste; label: string; icon: React.ElementType; color: string }[] = [
  {
    value: 'entrada_compra',
    label: 'Entrada por compra',
    icon:  ArrowUpCircle,
    color: 'text-success'
  },
  {
    value: 'salida_produccion',
    label: 'Salida por producción',
    icon:  ArrowDownCircle,
    color: 'text-danger'
  },
  {
    value: 'ajuste_manual',
    label: 'Ajuste manual',
    icon:  SlidersHorizontal,
    color: 'text-accent-DEFAULT'
  }
]

export default function AjusteStockForm({
  producto,
  onSuccess,
  onCancel
}: AjusteStockFormProps) {
  const toast   = useToast()
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<AjusteFormData>({
    defaultValues: {
      talla_id: producto.tallas[0]?.talla_id ?? 0,
      tipo:     'entrada_compra',
      cantidad: 1,
      motivo:   ''
    }
  })

  const watchTallaId = watch('talla_id')
  const watchTipo    = watch('tipo')

  const tallaActual = producto.tallas.find(
    t => t.talla_id === Number(watchTallaId)
  )

  const tipoActual = TIPOS.find(t => t.value === watchTipo)!
  const esSalida   = watchTipo === 'salida_produccion'

  async function onSubmit(data: AjusteFormData) {
    if (data.cantidad < 1) {
      toast.warning('La cantidad debe ser mayor a 0')
      return
    }

    // Validar stock suficiente para salidas
    if (esSalida && tallaActual && data.cantidad > tallaActual.stock) {
      toast.warning(
        `Stock insuficiente. Disponible: ${tallaActual.stock} ud.`
      )
      return
    }

    setSaving(true)
    try {
      // Registrar movimiento
      await window.electronAPI.db.run(
        `INSERT INTO movimientos_insumos
           (insumo_id, tipo, cantidad, motivo, fecha, created_at)
         VALUES (?, ?, ?, ?, date('now'), datetime('now'))`,
        [
          // Usamos producto_id como referencia (tabla de movimientos unificada)
          producto.producto_id,
          data.tipo,
          data.cantidad,
          data.motivo.trim() || null
        ]
      )

      // Actualizar stock
      const delta = esSalida ? -data.cantidad : data.cantidad
      await window.electronAPI.db.run(
        `UPDATE inventario_productos
         SET stock      = stock + ?,
             updated_at = datetime('now')
         WHERE producto_id = ? AND talla_id = ?`,
        [delta, producto.producto_id, data.talla_id]
      )

      const accion = esSalida ? 'descontadas' : 'agregadas'
      toast.success(
        `${data.cantidad} ud. ${accion} en talla ${tallaActual?.talla_nombre}`
      )
      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error('Error al registrar el ajuste')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Título */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={18} className="text-accent-DEFAULT" />
        <h2 className="text-[16px] font-bold text-primary-DEFAULT">
          Ajuste de stock
        </h2>
      </div>

      {/* Producto info */}
      <div className="bg-[#0B0B16] border border-border rounded-xl px-4 py-3">
        <p className="text-[12px] text-primary-muted mb-0.5">Producto</p>
        <p className="text-[15px] font-bold text-primary-DEFAULT">
          {producto.producto_nombre}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

        {/* Tipo de ajuste */}
        <div>
          <label className="input-label">Tipo de movimiento</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {TIPOS.map(tipo => {
              const Icon      = tipo.icon
              const isSelected = watchTipo === tipo.value
              return (
                <label
                  key={tipo.value}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border',
                    'cursor-pointer transition-all duration-150 text-center',
                    isSelected
                      ? 'border-accent-DEFAULT bg-accent-light'
                      : 'border-border bg-[#0B0B16] hover:border-accent-DEFAULT/40'
                  )}
                >
                  <input
                    type="radio"
                    value={tipo.value}
                    className="sr-only"
                    {...register('tipo')}
                  />
                  <Icon
                    size={18}
                    className={isSelected ? tipo.color : 'text-primary-muted'}
                  />
                  <span className={cn(
                    'text-[11.5px] font-semibold leading-tight',
                    isSelected ? 'text-accent-DEFAULT' : 'text-primary-muted'
                  )}>
                    {tipo.label}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Talla */}
        <div>
          <label className="input-label">Talla</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {producto.tallas.map(talla => {
              const isSelected = Number(watchTallaId) === talla.talla_id
              return (
                <label
                  key={talla.talla_id}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-2',
                    'rounded-xl border cursor-pointer transition-all',
                    isSelected
                      ? 'border-accent-DEFAULT bg-accent-light'
                      : 'border-border bg-[#0B0B16] hover:border-accent-DEFAULT/40',
                    talla.stock === 0 && !isSelected && 'opacity-50'
                  )}
                >
                  <input
                    type="radio"
                    value={talla.talla_id}
                    className="sr-only"
                    {...register('talla_id', { valueAsNumber: true })}
                  />
                  <span className={cn(
                    'text-[13px] font-bold',
                    isSelected ? 'text-accent-DEFAULT' : 'text-primary-DEFAULT'
                  )}>
                    {talla.talla_nombre}
                  </span>
                  <span className={cn(
                    'text-[11px]',
                    talla.stock === 0
                      ? 'text-danger'
                      : 'text-primary-muted'
                  )}>
                    {talla.stock} ud.
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Stock actual preview */}
        {tallaActual && (
          <div className={cn(
            'flex items-center justify-between px-4 py-2.5 rounded-xl border',
            'text-[13px]',
            tallaActual.stock === 0
              ? 'bg-danger/5 border-danger/20'
              : 'bg-success/5 border-success/20'
          )}>
            <span className="text-primary-muted">
              Stock actual — talla {tallaActual.talla_nombre}
            </span>
            <span className={cn(
              'font-bold text-[15px]',
              tallaActual.stock === 0 ? 'text-danger' : 'text-success'
            )}>
              {formatNumber(tallaActual.stock)} ud.
            </span>
          </div>
        )}

        {/* Cantidad */}
        <div>
          <label className="input-label">
            Cantidad a {esSalida ? 'descontar' : 'agregar'}
            <span className="text-danger"> *</span>
          </label>
          <input
            type="number"
            min={1}
            max={esSalida ? tallaActual?.stock : undefined}
            className="input"
            {...register('cantidad', {
              required: true,
              min: 1,
              valueAsNumber: true
            })}
          />
          {errors.cantidad && (
            <p className="text-[12px] text-danger mt-1">
              Cantidad mínima: 1
            </p>
          )}
        </div>

        {/* Motivo */}
        <div>
          <label className="input-label">Motivo / Observación</label>
          <textarea
            rows={2}
            placeholder={
              watchTipo === 'entrada_compra'
                ? 'Ej: Compra proveedor X, lote Mayo 2025…'
                : watchTipo === 'salida_produccion'
                  ? 'Ej: Producción colección verano…'
                  : 'Ej: Corrección inventario físico…'
            }
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
            className={cn(
              'btn-primary',
              esSalida && 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20'
            )}
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                Guardando…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <tipoActual.icon size={14} />
                {esSalida ? 'Registrar salida' : 'Registrar entrada'}
              </span>
            )}
          </button>
        </div>

      </form>
    </div>
  )
}