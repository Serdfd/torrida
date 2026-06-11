import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, X, Factory, ChevronDown } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Producto  { id: number; nombre: string; costo_unitario: number | null }
interface Proveedor { id: number; nombre: string }
interface Talla     { id: number; nombre: string; orden: number }

interface ItemForm {
  producto_id:     number
  producto_nombre: string
  costo_unitario:  string
  tallas:          Record<number, string>   // talla_id → cantidad
}

interface Props {
  onSuccess: (ordenId: number) => void
  onCancel:  () => void
}

const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(n)

// ── Componente ─────────────────────────────────────────────────────────────

export default function OrdenForm({ onSuccess, onCancel }: Props) {
  const toast = useToast()

  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)

  // Catálogos
  const [productos,   setProductos]   = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [tallas,      setTallas]      = useState<Talla[]>([])

  // Cabecera orden
  const [proveedorId,   setProveedorId]   = useState<string>('')
  const [fechaOrden,    setFechaOrden]    = useState(new Date().toISOString().slice(0, 10))
  const [fechaEntrega,  setFechaEntrega]  = useState('')
  const [notas,         setNotas]         = useState('')

  // Items
  const [items,         setItems]         = useState<ItemForm[]>([])
  const [prodSelector,  setProdSelector]  = useState<string>('')

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [prods, provs, tals] = await Promise.all([
          window.electronAPI.db.query(
            `SELECT id, nombre, costo_unitario FROM productos
             WHERE estado IN ('borrador','en_produccion','activo')
             ORDER BY nombre`, []
          ),
          window.electronAPI.db.query(
            `SELECT id, nombre FROM proveedores WHERE activo=1 ORDER BY nombre`, []
          ),
          window.electronAPI.db.query(
            `SELECT id, nombre, orden FROM tallas WHERE activo=1 ORDER BY orden`, []
          ),
        ])
        setProductos(prods as unknown as Producto[])
        setProveedores(provs as unknown as Proveedor[])
        setTallas(tals as unknown as Talla[])
      } catch {
        toast.error('Error cargando catálogos')
      } finally {
        setLoading(false)
      }
    }
    loadCatalogs()
  }, [])

  // ── Handlers items ────────────────────────────────────────────────────────

  async function handleAgregarProducto() {
    const prodId = parseInt(prodSelector)
    if (!prodId) return
    if (items.some(i => i.producto_id === prodId)) {
      toast.warning('Ya agregaste ese producto'); return
    }
    const prod = productos.find(p => p.id === prodId)
    if (!prod) return

    const tallaMap: Record<number, string> = {}
    tallas.forEach(t => { tallaMap[t.id] = '' })

    setItems(prev => [...prev, {
      producto_id:     prodId,
      producto_nombre: prod.nombre,
      costo_unitario:  '',
      tallas:          tallaMap,
    }])
    setProdSelector('')
  }

  function handleRemoveItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function setItemCosto(idx: number, val: string) {
    setItems(prev => prev.map((it, i) =>
      i === idx ? { ...it, costo_unitario: val } : it
    ))
  }

  function setItemTalla(idx: number, tallaId: number, val: string) {
    setItems(prev => prev.map((it, i) =>
      i === idx
        ? { ...it, tallas: { ...it.tallas, [tallaId]: val } }
        : it
    ))
  }

  // ── Totales ───────────────────────────────────────────────────────────────

  function itemCantidadTotal(item: ItemForm): number {
    return Object.values(item.tallas).reduce((s, v) => s + (parseInt(v) || 0), 0)
  }

  function itemSubtotal(item: ItemForm): number {
    return itemCantidadTotal(item) * (parseFloat(item.costo_unitario) || 0)
  }

  const costoTotal = items.reduce((s, it) => s + itemSubtotal(it), 0)

  // ── Generar número de orden ───────────────────────────────────────────────

  async function generarNumero(): Promise<string> {
    const rows = await window.electronAPI.db.query(
      `SELECT COUNT(*) AS cnt FROM ordenes_produccion`, []
    )
    const cnt = (rows as unknown as { cnt: number }[])[0]?.cnt ?? 0
    const anio = new Date().getFullYear()
    return `OP-${anio}-${String(cnt + 1).padStart(4, '0')}`
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (items.length === 0) {
      toast.warning('Agregá al menos un producto'); return
    }
    const sinCantidad = items.some(it => itemCantidadTotal(it) === 0)
    if (sinCantidad) {
      toast.warning('Todos los items deben tener al menos 1 unidad'); return
    }

    setSaving(true)
    try {
      const numero = await generarNumero()

      // Insertar orden
      const opResult = await window.electronAPI.db.run(
        `INSERT INTO ordenes_produccion
           (numero, proveedor_id, estado, fecha_orden, fecha_entrega, costo_total, notas)
         VALUES (?, ?, 'borrador', ?, ?, ?, ?)`,
        [
          numero,
          proveedorId ? parseInt(proveedorId) : null,
          fechaOrden,
          fechaEntrega || null,
          costoTotal,
          notas.trim() || null,
        ]
      )
      const ordenId = opResult.lastInsertRowid as number

      // Insertar items
      for (const item of items) {
        const cantTotal = itemCantidadTotal(item)
        const subtotal  = itemSubtotal(item)
        const costo     = parseFloat(item.costo_unitario) || 0

        const fichaRows = await window.electronAPI.db.query(
          `SELECT id FROM fichas_costo WHERE producto_id=? AND vigente=1 LIMIT 1`,
          [item.producto_id]
        )
        const fichaId = (fichaRows as unknown as { id: number }[])[0]?.id ?? null

        const itemResult = await window.electronAPI.db.run(
          `INSERT INTO ordenes_produccion_items
             (orden_id, producto_id, ficha_costo_id, cantidad_total, costo_unitario, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [ordenId, item.producto_id, fichaId, cantTotal, costo, subtotal]
        )
        const itemId = itemResult.lastInsertRowid as number

        // Insertar tallas con cantidad > 0
        for (const talla of tallas) {
          const cant = parseInt(item.tallas[talla.id]) || 0
          if (cant > 0) {
            await window.electronAPI.db.run(
              `INSERT INTO ordenes_produccion_tallas (item_id, talla_id, cantidad)
               VALUES (?, ?, ?)`,
              [itemId, talla.id, cant]
            )
          }
        }
      }

      toast.success(`Orden ${numero} creada`)
      onSuccess(ordenId)
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar la orden')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <p className="text-[13px] text-primary-muted py-8 text-center">Cargando catálogos…</p>
  }

  return (
    <div className="flex flex-col gap-5 max-h-[85vh] overflow-y-auto pr-1">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-light flex items-center
                        justify-center text-accent shrink-0">
          <Factory size={18} />
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-bold text-primary">Nueva orden de producción</p>
          <p className="text-[12px] text-primary-muted">Estado inicial: borrador</p>
        </div>
        <button onClick={onCancel} className="text-primary-muted hover:text-primary transition-colors p-1">
          <X size={18} />
        </button>
      </div>

      {/* ── Datos de cabecera ── */}
      <div className="card">
        <p className="text-[13px] font-semibold text-primary mb-3">Datos generales</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 col-span-2">
            <label className="input-label">Fabricante / Taller</label>
            <select
              value={proveedorId}
              onChange={e => setProveedorId(e.target.value)}
              className="input"
            >
              <option value="">Sin asignar</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="input-label">Fecha de orden</label>
            <input
              type="date"
              value={fechaOrden}
              onChange={e => setFechaOrden(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="input-label">Fecha entrega estimada</label>
            <input
              type="date"
              value={fechaEntrega}
              onChange={e => setFechaEntrega(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 mt-3">
          <label className="input-label">Notas</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            placeholder="Instrucciones especiales, telas, acabados…"
            className="input resize-none"
          />
        </div>
      </div>

      {/* ── Items ── */}
      <div className="card">
        <p className="text-[13px] font-semibold text-primary mb-3">
          Productos a producir
        </p>

        {/* Selector agregar producto */}
        <div className="flex gap-2 mb-4">
          <select
            value={prodSelector}
            onChange={e => setProdSelector(e.target.value)}
            className="input flex-1"
          >
            <option value="">Seleccioná un producto…</option>
            {productos
              .filter(p => !items.some(i => i.producto_id === p.id))
              .map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
          </select>
          <button
            type="button"
            onClick={handleAgregarProducto}
            disabled={!prodSelector}
            className={cn(
              'btn-primary',
              !prodSelector && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Plus size={14} /> Agregar
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-[12.5px] text-primary-muted text-center py-4">
            Todavía no agregaste productos a la orden.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item, idx) => {
              const cantTotal = itemCantidadTotal(item)
              const subtotal  = itemSubtotal(item)

              return (
                <div key={item.producto_id}
                  className="border border-border rounded-xl p-4 flex flex-col gap-3">

                  {/* Header item */}
                  <div className="flex items-center gap-3">
                    <p className="text-[14px] font-bold text-primary flex-1 truncate">
                      {item.producto_nombre}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-primary-muted">
                        {cantTotal} ud.
                      </span>
                      {subtotal > 0 && (
                        <span className="text-[13px] font-semibold text-warning">
                          {fmtCOP(subtotal)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="text-primary-muted hover:text-danger transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Precio confección */}
                  <div className="flex items-center gap-2">
                    <label className="input-label whitespace-nowrap">Precio confección (por unidad)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={item.costo_unitario}
                      onChange={e => setItemCosto(idx, e.target.value)}
                      placeholder="A definir"
                      className="input w-44 text-[13px]"
                    />
                  </div>

                  {/* Tallas */}
                  <div>
                    <p className="input-label mb-2">Cantidades por talla</p>
                    <div className="flex flex-wrap gap-2">
                      {tallas.map(talla => (
                        <div key={talla.id}
                          className="flex flex-col items-center gap-1 w-16">
                          <span className="text-[11.5px] text-primary-muted font-semibold">
                            {talla.nombre}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.tallas[talla.id] ?? ''}
                            onChange={e => setItemTalla(idx, talla.id, e.target.value)}
                            placeholder="0"
                            className="input text-center text-[13px] w-full px-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Total orden */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[13px] font-bold text-primary">
                Costo total estimado
              </span>
              <span className="text-[16px] font-bold text-warning">{fmtCOP(costoTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Acciones ── */}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-ghost" disabled={saving}>
          Cancelar
        </button>
        <button onClick={handleSave} className="btn-primary" disabled={saving || items.length === 0}>
          <Check size={14} />
          {saving ? 'Guardando…' : 'Crear orden'}
        </button>
      </div>
    </div>
  )
}
