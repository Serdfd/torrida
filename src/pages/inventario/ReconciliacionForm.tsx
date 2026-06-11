import { useState } from 'react'
import { ClipboardCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

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

interface ConteoTalla {
  talla_id:     number
  talla_nombre: string
  stock_actual: number
  stock_fisico: string      // string para el input controlado
}

interface ReconciliacionFormProps {
  producto:  ProductoStock
  onSuccess: () => void
  onCancel:  () => void
}

export default function ReconciliacionForm({
  producto,
  onSuccess,
  onCancel
}: ReconciliacionFormProps) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const [conteos, setConteos] = useState<ConteoTalla[]>(
    producto.tallas.map(t => ({
      talla_id:     t.talla_id,
      talla_nombre: t.talla_nombre,
      stock_actual: t.stock,
      stock_fisico: String(t.stock)   // valor por defecto = stock actual
    }))
  )

  function setFisico(tallaId: number, value: string) {
    setConteos(prev =>
      prev.map(c =>
        c.talla_id === tallaId ? { ...c, stock_fisico: value } : c
      )
    )
  }

  // Diferencias calculadas (sólo tallas con valor numérico válido)
  const diferencias = conteos
    .map(c => {
      const fisico = parseInt(c.stock_fisico, 10)
      if (isNaN(fisico) || fisico < 0) return null
      const diff = fisico - c.stock_actual
      return { ...c, stock_fisico_num: fisico, diferencia: diff }
    })
    .filter(Boolean) as (ConteoTalla & { stock_fisico_num: number; diferencia: number })[]

  const conCambios = diferencias.filter(d => d.diferencia !== 0)

  async function aplicar() {
    if (conCambios.length === 0) {
      toast.warning('No hay diferencias entre el conteo físico y el sistema')
      return
    }

    setSaving(true)
    try {
      const statements: { sql: string; params: unknown[] }[] = []

      for (const c of conCambios) {
        // Movimiento de reconciliación (cantidad puede ser negativa)
        statements.push({
          sql: `INSERT INTO movimientos_inventario
                  (producto_id, talla_id, tipo, cantidad, notas, fecha, created_at)
                VALUES (?, ?, 'ajuste_reconciliacion', ?, 'Reconciliación física', date('now'), datetime('now'))`,
          params: [producto.producto_id, c.talla_id, c.diferencia]
        })

        // Actualizar stock al conteo físico exacto
        statements.push({
          sql: `UPDATE inventario_productos
                SET stock = ?, updated_at = datetime('now')
                WHERE producto_id = ? AND talla_id = ?`,
          params: [c.stock_fisico_num, producto.producto_id, c.talla_id]
        })
      }

      await window.electronAPI.db.transaction(statements)
      toast.success(
        `Reconciliación aplicada: ${conCambios.length} talla${conCambios.length > 1 ? 's' : ''} ajustada${conCambios.length > 1 ? 's' : ''}`
      )
      onSuccess()
    } catch (err) {
      console.error(err)
      toast.error('Error al aplicar la reconciliación')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Título */}
      <div className="flex items-center gap-2">
        <ClipboardCheck size={18} className="text-accent" />
        <h2 className="text-[16px] font-bold text-primary">
          Reconciliación física
        </h2>
      </div>

      {/* Producto */}
      <div className="bg-[#0B0B16] border border-border rounded-xl px-4 py-3">
        <p className="text-[12px] text-primary-muted mb-0.5">Producto</p>
        <p className="text-[15px] font-bold text-primary">
          {producto.producto_nombre}
        </p>
      </div>

      {/* Instrucción */}
      <p className="text-[12.5px] text-primary-muted">
        Ingresá el conteo físico para cada talla. Las diferencias se aplicarán
        como ajuste de reconciliación.
      </p>

      {/* Tabla de conteo */}
      <div className="flex flex-col gap-2">
        {/* Cabecera */}
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 px-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary-muted">
            Talla
          </span>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary-muted text-right">
            Sistema
          </span>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary-muted text-right">
            Físico
          </span>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary-muted text-right">
            Diferencia
          </span>
        </div>

        {conteos.map(c => {
          const fisico = parseInt(c.stock_fisico, 10)
          const diff   = isNaN(fisico) ? null : fisico - c.stock_actual
          const invalid = c.stock_fisico !== '' && (isNaN(fisico) || fisico < 0)

          return (
            <div
              key={c.talla_id}
              className={cn(
                'grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 items-center',
                'px-3 py-2.5 rounded-xl border',
                diff !== null && diff !== 0
                  ? diff > 0
                    ? 'border-success/30 bg-success/5'
                    : 'border-danger/30 bg-danger/5'
                  : 'border-border bg-[#0B0B16]'
              )}
            >
              <span className="text-[13px] font-bold text-primary">
                {c.talla_nombre}
              </span>

              <span className="text-[13px] text-primary-muted text-right">
                {formatNumber(c.stock_actual)}
              </span>

              <div className="flex justify-end">
                <input
                  type="number"
                  min={0}
                  value={c.stock_fisico}
                  onChange={e => setFisico(c.talla_id, e.target.value)}
                  className={cn(
                    'w-20 input text-right text-[13px] h-8 py-0',
                    invalid && 'border-danger'
                  )}
                />
              </div>

              <div className="text-right">
                {diff === null || c.stock_fisico === '' ? (
                  <span className="text-[12px] text-primary-muted">—</span>
                ) : diff === 0 ? (
                  <span className="flex items-center justify-end gap-1 text-[12px] text-success">
                    <CheckCircle2 size={12} />
                    OK
                  </span>
                ) : (
                  <span className={cn(
                    'text-[13px] font-bold',
                    diff > 0 ? 'text-success' : 'text-danger'
                  )}>
                    {diff > 0 ? '+' : ''}{diff}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Resumen de cambios */}
      {conCambios.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl border
                        border-warning/20 bg-warning/5">
          <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-warning">
            Se ajustarán <strong>{conCambios.length}</strong> talla
            {conCambios.length > 1 ? 's' : ''} con diferencia
          </p>
        </div>
      )}

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
          type="button"
          onClick={aplicar}
          disabled={saving || conCambios.length === 0}
          className="btn-primary"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" />
              Aplicando…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <ClipboardCheck size={14} />
              Aplicar reconciliación
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
