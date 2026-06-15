import { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, ShoppingBag, Truck } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { getCanalesVenta, getMediosPago, getProductos, isMesCerrado } from '@/lib/queries'
import { formatCOP } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import ComboSelect from '@/components/ui/ComboSelect'
import { DEPARTAMENTOS, getCiudades, toOptions } from '@/lib/colombia'

interface ItemForm {
  producto_id:         number
  talla_id:            number
  cantidad:            number
  precio_unitario:     number
  descuento_item:      number
  costo_unitario_snap: number
}

interface Tarifa {
  id:            number
  medio_pago_id: number
  concepto:      string
  comision_pct:  number
  comision_fija: number
  activo:        number
}

interface VentaFormData {
  fecha:            string
  hora:             string
  canal_id:         number
  medio_pago_id:    number
  cliente_nombre:   string
  cliente_telefono: string
  cliente_email:    string
  cliente_dni:      string
  tipo_envio:            'standard' | 'express' | 'recogida'
  costo_envio:           number
  costo_envio_real:      number
  envio_departamento:    string
  envio_ciudad:          string
  envio_direccion:       string
  transportadora_id:     number
  guia_numero:           string
  envio_pendiente:       number
  descuento:             number
  notas:            string
  estado:           'completada' | 'pendiente'
  items:            ItemForm[]
}

interface TallaStock {
  talla_id:     number
  talla_nombre: string
  stock:        number
}

interface VentaFormProps {
  ventaId?:  number
  onSuccess: () => void
  onCancel:  () => void
}

export default function VentaForm({ ventaId, onSuccess, onCancel }: VentaFormProps) {
  const toast     = useToast()
  const isEditing = Boolean(ventaId)

  const [canales,           setCanales]           = useState<any[]>([])
  const [medios,            setMedios]            = useState<any[]>([])
  const [productos,         setProductos]         = useState<any[]>([])
  const [transportadoras,   setTransportadoras]   = useState<any[]>([])
  const [tallasPorProducto, setTallasPorProducto] = useState<Record<number, TallaStock[]>>({})
  const [saving,            setSaving]            = useState(false)
  const [loadingCatalog,    setLoadingCatalog]    = useState(true)
  const [ventaEstadoOrig,   setVentaEstadoOrig]   = useState<string>('completada')
  const [tarifas,           setTarifas]           = useState<Tarifa[]>([])
  const [selectedTarifaId,  setSelectedTarifaId]  = useState<number>(0)
  const [comisionMPGuardada, setComisionMPGuardada] = useState<number>(0)

  const loadedProds = useRef<Set<number>>(new Set())

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<VentaFormData>({
    defaultValues: {
      fecha:            new Date().toISOString().slice(0, 10),
      hora:             new Date().toTimeString().slice(0, 5),
      canal_id:         0,
      medio_pago_id:    0,
      cliente_nombre:   '',
      cliente_telefono: '',
      cliente_email:    '',
      cliente_dni:      '',
      tipo_envio:            'standard',
      costo_envio:           0,
      costo_envio_real:      0,
      envio_departamento:    '',
      envio_ciudad:          '',
      envio_direccion:       '',
      transportadora_id:     0,
      guia_numero:           '',
      envio_pendiente:       0,
      descuento:             0,
      notas:            '',
      estado:           'completada',
      items: [{
        producto_id: 0, talla_id: 0,
        cantidad: 1, precio_unitario: 0,
        descuento_item: 0, costo_unitario_snap: 0,
      }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const watchItems      = watch('items')
  const watchDescuento  = watch('descuento')
  const watchEnvio      = watch('costo_envio')
  const watchCanalId    = watch('canal_id')
  const watchMedioId    = watch('medio_pago_id')
  const watchTipoEnvio  = watch('tipo_envio')
  const watchEnvioDep   = watch('envio_departamento')
  const watchEnvioCiud  = watch('envio_ciudad')

  const canalSelec  = canales.find(c => c.id === Number(watchCanalId))
  const pctComision = canalSelec?.comision_pct ?? 0

  const descuentoGlobal = Number(watchDescuento) || 0
  const envio           = Number(watchEnvio)     || 0

  const subtotalItems = watchItems.reduce((s, it) =>
    s + (it.cantidad ?? 0) * (it.precio_unitario ?? 0) - (it.descuento_item ?? 0), 0)

  const sumPreciosBruto = watchItems.reduce((s, it) =>
    s + (it.cantidad ?? 0) * (it.precio_unitario ?? 0), 0)

  const baseComision  = subtotalItems + envio
  const comisionTotal = baseComision * (pctComision / 100)
  const totalVenta    = subtotalItems - descuentoGlobal + envio

  const tarifaSelec  = tarifas.find(t => t.id === selectedTarifaId)
  const comisionMP   = tarifaSelec
    ? totalVenta * (tarifaSelec.comision_pct / 100) + tarifaSelec.comision_fija
    : 0

  const itemsCalc = watchItems.map(it => {
    const bruto          = (it.cantidad ?? 0) * (it.precio_unitario ?? 0)
    const subtotalItem   = bruto - (it.descuento_item ?? 0)
    const peso           = sumPreciosBruto > 0 ? bruto / sumPreciosBruto : 0
    const comisionItem   = comisionTotal * peso
    const comisionMPItem = comisionMP * peso
    const utilidadItem   = subtotalItem - (it.costo_unitario_snap ?? 0) * (it.cantidad ?? 0) - comisionItem - comisionMPItem
    return { subtotalItem, comisionItem, comisionMPItem, utilidadItem }
  })

  const totalUtilidad = itemsCalc.reduce((s, c) => s + c.utilidadItem, 0)

  // Limpiar campos de envío cuando se selecciona recogida
  useEffect(() => {
    if (watchTipoEnvio === 'recogida') {
      setValue('costo_envio', 0)
      setValue('costo_envio_real', 0)
      setValue('envio_departamento', '')
      setValue('envio_ciudad', '')
      setValue('envio_direccion', '')
      setValue('transportadora_id', 0)
      setValue('guia_numero', '')
      setValue('envio_pendiente', 0)
    }
  }, [watchTipoEnvio]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar tarifas cuando cambia el medio de pago
  useEffect(() => {
    const medioId = Number(watchMedioId)
    if (!medioId) { setTarifas([]); setSelectedTarifaId(0); return }
    window.electronAPI.db.query<Tarifa>(
      `SELECT * FROM medios_pago_tarifas WHERE medio_pago_id = ? AND activo = 1 ORDER BY concepto`,
      [medioId]
    ).then(rows => {
      setTarifas(rows)
      setSelectedTarifaId(0)
    }).catch(() => { setTarifas([]); setSelectedTarifaId(0) })
  }, [watchMedioId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTallasParaProducto(productoId: number) {
    if (!productoId || loadedProds.current.has(productoId)) return
    loadedProds.current.add(productoId)
    try {
      const rows = await window.electronAPI.db.query<any>(
        `SELECT ip.talla_id,
                t.nombre              AS talla_nombre,
                COALESCE(ip.stock, 0) AS stock
         FROM inventario_productos ip
         JOIN tallas t ON t.id = ip.talla_id
         WHERE ip.producto_id = ?
         ORDER BY t.orden`,
        [productoId],
      )
      setTallasPorProducto(prev => ({ ...prev, [productoId]: rows }))
    } catch {
      loadedProds.current.delete(productoId)
    }
  }

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [c, m, p, tr] = await Promise.all([
          getCanalesVenta(), getMediosPago(), getProductos(),
          window.electronAPI.db.query<any>(
            `SELECT * FROM transportadoras WHERE activa = 1 ORDER BY nombre`
          )
        ])
        setCanales(c); setMedios(m); setProductos(p); setTransportadoras(tr)
        if (c.length > 0) setValue('canal_id', c[0].id)
        if (m.length > 0) setValue('medio_pago_id', m[0].id)
      } catch {
        toast.error('Error cargando catálogos')
      } finally {
        setLoadingCatalog(false)
      }
    }
    loadCatalog()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ventaId || loadingCatalog) return
    async function loadVenta() {
      try {
        const [ventas, items] = await Promise.all([
          window.electronAPI.db.query<any>(`SELECT * FROM ventas WHERE id = ?`, [ventaId]),
          window.electronAPI.db.query<any>(`SELECT * FROM venta_items WHERE venta_id = ?`, [ventaId]),
        ])
        const v = ventas[0]
        if (!v) return
        setVentaEstadoOrig(v.estado ?? 'completada')
        setComisionMPGuardada(v.comision_medio_pago ?? 0)
        const prodIds = [...new Set(items.map((i: any) => i.producto_id))] as number[]
        await Promise.all(prodIds.map(id => loadTallasParaProducto(id)))
        // Cargar tarifa guardada en la venta
        if (v.medio_pago_tarifa_id) {
          const rows = await window.electronAPI.db.query<Tarifa>(
            `SELECT * FROM medios_pago_tarifas WHERE medio_pago_id = ? AND activo = 1 ORDER BY concepto`,
            [v.medio_pago_id]
          )
          setTarifas(rows)
          setSelectedTarifaId(v.medio_pago_tarifa_id ?? 0)
        }

        reset({
          fecha:            v.fecha,
          hora:             v.creado_en ? v.creado_en.slice(11, 16) : new Date().toTimeString().slice(0, 5),
          canal_id:         v.canal_id        ?? 0,
          medio_pago_id:    v.medio_pago_id   ?? 0,
          cliente_nombre:   v.cliente_nombre   ?? '',
          cliente_telefono: v.cliente_telefono ?? '',
          cliente_email:    v.cliente_email    ?? '',
          cliente_dni:      v.cliente_dni      ?? '',
          tipo_envio:            v.tipo_envio            ?? 'standard',
          costo_envio:           v.costo_envio           ?? 0,
          costo_envio_real:      v.costo_envio_real      ?? 0,
          envio_departamento:    v.envio_departamento    ?? '',
          envio_ciudad:          v.envio_ciudad          ?? '',
          envio_direccion:       v.envio_direccion       ?? '',
          transportadora_id:     v.transportadora_id     ?? 0,
          guia_numero:           v.guia_numero           ?? '',
          envio_pendiente:       v.envio_pendiente       ?? 0,
          descuento:        v.descuento        ?? 0,
          notas:            v.notas            ?? '',
          estado:           v.estado           === 'pendiente' ? 'pendiente' : 'completada',
          items: items.map((it: any) => ({
            producto_id:         it.producto_id,
            talla_id:            it.talla_id            ?? 0,
            cantidad:            it.cantidad,
            precio_unitario:     it.precio_unitario,
            descuento_item:      it.descuento_item      ?? 0,
            costo_unitario_snap: it.costo_unitario_snap ?? 0,
          })),
        })
      } catch {
        toast.error('Error cargando venta')
      }
    }
    loadVenta()
  }, [ventaId, loadingCatalog]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleProductoChange(idx: number, productoId: number) {
    setValue(`items.${idx}.producto_id`, productoId)
    const prod = productos.find(p => p.id === Number(productoId))
    if (prod) {
      setValue(`items.${idx}.precio_unitario`,     prod.precio_venta   ?? 0)
      setValue(`items.${idx}.costo_unitario_snap`, prod.costo_unitario ?? 0)
      setValue(`items.${idx}.talla_id`, 0)
    }
    await loadTallasParaProducto(Number(productoId))
  }

  async function onSubmit(data: VentaFormData) {
    if (data.items.length === 0) { toast.warning('Agrega al menos un producto'); return }
    for (const it of data.items) {
      if (!it.producto_id || it.cantidad < 1) {
        toast.warning('Completa todos los campos de los ítems'); return
      }
    }

    for (const it of data.items) {
      if (!it.talla_id) continue
      const [row] = await window.electronAPI.db.query<{ stock: number }>(
        `SELECT COALESCE(stock, 0) AS stock FROM inventario_productos
         WHERE producto_id = ? AND talla_id = ?`,
        [it.producto_id, it.talla_id],
      )
      const stockActual = row?.stock ?? 0
      let oldCantidad = 0
      if (isEditing && ventaId && ventaEstadoOrig !== 'cancelado') {
        const [oldIt] = await window.electronAPI.db.query<{ cantidad: number }>(
          `SELECT cantidad FROM venta_items
           WHERE venta_id = ? AND producto_id = ? AND talla_id = ?`,
          [ventaId, it.producto_id, it.talla_id],
        )
        oldCantidad = oldIt?.cantidad ?? 0
      }
      const disponible = stockActual + oldCantidad
      if (it.cantidad > disponible) {
        const pNombre = productos.find(p => p.id === it.producto_id)?.nombre ?? 'Producto'
        const tNombre = tallasPorProducto[it.producto_id]
          ?.find(t => t.talla_id === Number(it.talla_id))?.talla_nombre ?? String(it.talla_id)
        toast.error(`Stock insuficiente: ${pNombre} T${tNombre} — disponible: ${disponible}`)
        return
      }
    }

    // ── Verificar que el período no esté cerrado ───────────────────────
    const ventaAnio = new Date(data.fecha).getFullYear()
    const ventaMes  = new Date(data.fecha).getMonth() + 1
    if (await isMesCerrado(ventaAnio, ventaMes)) {
      toast.error('Este período está cerrado. Reabre el mes para poder guardar.')
      return
    }

    setSaving(true)
    try {
      const subtFinal   = data.items.reduce((s, it) => s + it.cantidad * it.precio_unitario - (it.descuento_item ?? 0), 0)
      const brutoFinal  = data.items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0)
      const envioFinal  = data.costo_envio ?? 0
      const descFinal   = data.descuento   ?? 0
      const comFinal    = (subtFinal + envioFinal) * (pctComision / 100)
      const totalFinal  = subtFinal - descFinal + envioFinal
      const tarifaSnap  = tarifas.find(t => t.id === selectedTarifaId)
      const comMPFinal  = tarifaSnap ? totalFinal * (tarifaSnap.comision_pct / 100) + tarifaSnap.comision_fija : 0
      const tarifaIdSnap    = tarifaSnap?.id ?? null
      const tarifaConcepto  = tarifaSnap?.concepto ?? null
      const creadoEn    = `${data.fecha} ${data.hora ?? '00:00'}:00`

      // Upsert cliente
      let clienteId: number | null = null
      const emailClean = data.cliente_email?.trim() || null
      const dniClean   = data.cliente_dni?.trim()   || null
      const nombreClean = data.cliente_nombre?.trim() || null
      if (nombreClean || emailClean || dniClean) {
        // Buscar por email o dni primero
        let existingCliente: { id: number }[] = []
        if (emailClean) {
          existingCliente = await window.electronAPI.db.query<{ id: number }>(
            `SELECT id FROM clientes WHERE email = ?`, [emailClean]
          )
        }
        if (existingCliente.length === 0 && dniClean) {
          existingCliente = await window.electronAPI.db.query<{ id: number }>(
            `SELECT id FROM clientes WHERE dni = ?`, [dniClean]
          )
        }
        if (existingCliente.length > 0) {
          clienteId = existingCliente[0].id
          await window.electronAPI.db.run(
            `UPDATE clientes SET
               nombre   = COALESCE(NULLIF(?, ''), nombre),
               email    = COALESCE(?, email),
               telefono = COALESCE(NULLIF(?, ''), telefono),
               dni      = COALESCE(?, dni),
               updated_at = datetime('now')
             WHERE id = ?`,
            [nombreClean, emailClean, data.cliente_telefono?.trim() || null, dniClean, clienteId]
          )
        } else {
          const cr = await window.electronAPI.db.run(
            `INSERT INTO clientes (nombre, email, telefono, dni, created_at, updated_at)
             VALUES (?,?,?,?,datetime('now'),datetime('now'))`,
            [nombreClean || 'Cliente', emailClean, data.cliente_telefono?.trim() || null, dniClean]
          )
          clienteId = cr.lastInsertRowid as number
        }
      }

      if (isEditing && ventaId) {
        if (ventaEstadoOrig !== 'cancelado') {
          const oldItems = await window.electronAPI.db.query<any>(
            `SELECT producto_id, talla_id, cantidad FROM venta_items WHERE venta_id = ?`,
            [ventaId],
          )
          for (const oi of oldItems) {
            if (!oi.talla_id) continue
            await window.electronAPI.db.run(
              `UPDATE inventario_productos SET stock = stock + ?, updated_at = datetime('now')
               WHERE producto_id = ? AND talla_id = ?`,
              [oi.cantidad, oi.producto_id, oi.talla_id],
            )
          }
        }

        await window.electronAPI.db.run(
          `UPDATE ventas SET
             fecha = ?, canal_id = ?, medio_pago_id = ?,
             cliente_id = ?, cliente_nombre = ?, cliente_telefono = ?,
             cliente_email = ?, cliente_dni = ?,
             subtotal = ?, descuento = ?, comision_canal = ?,
             tipo_envio = ?, costo_envio = ?, costo_envio_real = ?,
             envio_departamento = ?, envio_ciudad = ?, envio_direccion = ?,
             transportadora_id = ?, guia_numero = ?, envio_pendiente = ?,
             comision_medio_pago = ?, medio_pago_tarifa_id = ?,
             medio_pago_tarifa_concepto = ?,
             total = ?, notas = ?, estado = ?, creado_en = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [data.fecha, data.canal_id || null, data.medio_pago_id || null,
           clienteId, data.cliente_nombre || null, data.cliente_telefono || null,
           emailClean, dniClean,
           subtFinal, descFinal, comFinal,
           data.tipo_envio, envioFinal, data.costo_envio_real ?? 0,
           data.envio_departamento || null, data.envio_ciudad || null, data.envio_direccion || null,
           data.transportadora_id || null, data.guia_numero || null, data.envio_pendiente ?? 0,
           comMPFinal, tarifaIdSnap, tarifaConcepto,
           totalFinal, data.notas || null, data.estado ?? 'completada', creadoEn, ventaId],
        )

        await window.electronAPI.db.run(`DELETE FROM venta_items WHERE venta_id = ?`, [ventaId])
        await window.electronAPI.db.run(
          `DELETE FROM movimientos_inventario WHERE venta_id = ? AND tipo = 'salida_venta'`,
          [ventaId],
        )

        for (const it of data.items) {
          const brutoIt    = it.cantidad * it.precio_unitario
          const subtIt     = brutoIt - (it.descuento_item ?? 0)
          const peso       = brutoFinal > 0 ? brutoIt / brutoFinal : 0
          const comIt      = comFinal * peso
          const comMPIt    = comMPFinal * peso
          const utilIt     = subtIt - (it.costo_unitario_snap ?? 0) * it.cantidad - comIt - comMPIt
          await window.electronAPI.db.run(
            `INSERT INTO venta_items (venta_id, producto_id, talla_id, cantidad,
               precio_unitario, descuento_item, subtotal_item,
               costo_unitario_snap, comision_item, utilidad_item)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [ventaId, it.producto_id, it.talla_id || null, it.cantidad,
             it.precio_unitario, it.descuento_item ?? 0, subtIt,
             it.costo_unitario_snap ?? 0, comIt, utilIt],
          )
          if (it.talla_id) {
            await window.electronAPI.db.run(
              `UPDATE inventario_productos SET stock = stock - ?, updated_at = datetime('now')
               WHERE producto_id = ? AND talla_id = ?`,
              [it.cantidad, it.producto_id, it.talla_id],
            )
            await window.electronAPI.db.run(
              `INSERT INTO movimientos_inventario
                 (producto_id, talla_id, tipo, cantidad, notas, venta_id, fecha, created_at)
               VALUES (?,?,'salida_venta',?,?,?,?,datetime('now'))`,
              [it.producto_id, it.talla_id, -it.cantidad, 'Venta editada', ventaId, data.fecha],
            )
          }
        }
        toast.success('Venta actualizada')

      } else {
        const anio = new Date(data.fecha).getFullYear()
        const mes  = new Date(data.fecha).getMonth() + 1
        const pad  = (n: number) => String(n).padStart(2, '0')
        const [countRow] = await window.electronAPI.db.query<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM ventas WHERE strftime('%Y-%m', fecha) = ?`,
          [`${anio}-${pad(mes)}`],
        )
        const numero = `V-${anio}${pad(mes)}-${String((countRow?.cnt ?? 0) + 1).padStart(4, '0')}`

        const result = await window.electronAPI.db.run(
          `INSERT INTO ventas
             (numero_venta, fecha, canal_id, medio_pago_id,
              cliente_id, cliente_nombre, cliente_telefono, cliente_email, cliente_dni,
              subtotal, descuento, comision_canal,
              tipo_envio, costo_envio, costo_envio_real,
              envio_departamento, envio_ciudad, envio_direccion,
              transportadora_id, guia_numero, envio_pendiente,
              comision_medio_pago, medio_pago_tarifa_id, medio_pago_tarifa_concepto,
              total, notas, estado, creado_en, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
          [numero, data.fecha, data.canal_id || null, data.medio_pago_id || null,
           clienteId, data.cliente_nombre || null, data.cliente_telefono || null, emailClean, dniClean,
           subtFinal, descFinal, comFinal,
           data.tipo_envio, envioFinal, data.costo_envio_real ?? 0,
           data.envio_departamento || null, data.envio_ciudad || null, data.envio_direccion || null,
           data.transportadora_id || null, data.guia_numero || null, data.envio_pendiente ?? 0,
           comMPFinal, tarifaIdSnap, tarifaConcepto,
           totalFinal, data.notas || null, data.estado ?? 'completada', creadoEn],
        )
        const ventaIdNueva = result.lastInsertRowid as number

        for (const it of data.items) {
          const brutoIt    = it.cantidad * it.precio_unitario
          const subtIt     = brutoIt - (it.descuento_item ?? 0)
          const peso       = brutoFinal > 0 ? brutoIt / brutoFinal : 0
          const comIt      = comFinal * peso
          const comMPIt    = comMPFinal * peso
          const utilIt     = subtIt - (it.costo_unitario_snap ?? 0) * it.cantidad - comIt - comMPIt
          await window.electronAPI.db.run(
            `INSERT INTO venta_items (venta_id, producto_id, talla_id, cantidad,
               precio_unitario, descuento_item, subtotal_item,
               costo_unitario_snap, comision_item, utilidad_item)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [ventaIdNueva, it.producto_id, it.talla_id || null, it.cantidad,
             it.precio_unitario, it.descuento_item ?? 0, subtIt,
             it.costo_unitario_snap ?? 0, comIt, utilIt],
          )
          if (it.talla_id) {
            await window.electronAPI.db.run(
              `UPDATE inventario_productos SET stock = stock - ?, updated_at = datetime('now')
               WHERE producto_id = ? AND talla_id = ?`,
              [it.cantidad, it.producto_id, it.talla_id],
            )
            await window.electronAPI.db.run(
              `INSERT INTO movimientos_inventario
                 (producto_id, talla_id, tipo, cantidad, notas, venta_id, fecha, created_at)
               VALUES (?,?,'salida_venta',?,?,?,?,datetime('now'))`,
              [it.producto_id, it.talla_id, -it.cantidad, `Venta ${numero}`, ventaIdNueva, data.fecha],
            )
          }
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
    return <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
  }

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">

      <div className="flex items-center gap-2 mb-1">
        <ShoppingBag size={18} className="text-accent" />
        <h2 className="text-lg font-bold text-primary">
          {isEditing ? 'Editar venta' : 'Nueva venta'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

        {/* Fila 1: Fecha + Hora + Canal + Medio pago */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="input-label">Fecha</label>
            <input type="date" className="input" {...register('fecha', { required: true })} />
          </div>
          <div>
            <label className="input-label">Hora</label>
            <input type="time" className="input" {...register('hora')} />
          </div>
          <div>
            <label className="input-label">Canal de venta</label>
            <select className="input" {...register('canal_id', { required: true, valueAsNumber: true })}>
              {canales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Medio de pago</label>
            <select className="input" {...register('medio_pago_id', { valueAsNumber: true })}>
              <option value={0}>— Sin especificar —</option>
              {medios.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            {tarifas.length > 0 && (
              <div className="mt-1.5">
                <label className="input-label">Concepto / tarifa de cobro</label>
                <select
                  className="input"
                  value={selectedTarifaId}
                  onChange={e => setSelectedTarifaId(Number(e.target.value))}
                >
                  <option value={0}>— Sin tarifa —</option>
                  {tarifas.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.concepto} ({t.comision_pct}%{t.comision_fija > 0 ? ` + ${formatCOP(t.comision_fija)}` : ''})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Fila 2: Cliente */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Nombre cliente</label>
            <input type="text" placeholder="Ej: María García" className="input"
              {...register('cliente_nombre')} />
          </div>
          <div>
            <label className="input-label">Teléfono / Contacto</label>
            <input type="text" placeholder="Teléfono / Instagram" className="input"
              {...register('cliente_telefono')} />
          </div>
          <div>
            <label className="input-label">Email</label>
            <input type="email" placeholder="correo@ejemplo.com" className="input"
              {...register('cliente_email')} />
          </div>
          <div>
            <label className="input-label">Cédula / DNI</label>
            <input type="text" placeholder="Número de cédula" className="input"
              {...register('cliente_dni')} />
          </div>
        </div>

        {/* Ítems */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="input-label mb-0">Productos</label>
            <button type="button"
              onClick={() => append({ producto_id: 0, talla_id: 0, cantidad: 1,
                precio_unitario: 0, descuento_item: 0, costo_unitario_snap: 0 })}
              className="btn-ghost h-7 px-2">
              <Plus size={12} /> Agregar
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {fields.map((field, idx) => {
              const prodId     = Number(watchItems[idx]?.producto_id)
              const tallasDisp = tallasPorProducto[prodId] ?? []
              const calc       = itemsCalc[idx] ?? { subtotalItem: 0, comisionItem: 0, utilidadItem: 0 }
              return (
                <div key={field.id} className="bg-[#0B0B16] border border-border rounded-lg p-3 flex flex-col gap-2">
                  <div className="grid grid-cols-[2fr_1fr_70px_1fr_100px_32px] gap-2 items-end">
                    <div>
                      <label className="input-label">Producto</label>
                      <select className="input"
                        {...register(`items.${idx}.producto_id`, { required: true, valueAsNumber: true })}
                        onChange={e => handleProductoChange(idx, Number(e.target.value))}>
                        <option value={0}>— Seleccionar —</option>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="input-label">
                        Talla{prodId > 0 && tallasDisp.length === 0 &&
                          <span className="text-warning ml-1 text-2xs">sin tallas</span>}
                      </label>
                      <select className="input"
                        {...register(`items.${idx}.talla_id`, { valueAsNumber: true })}>
                        <option value={0}>—</option>
                        {tallasDisp.map(t =>
                          <option key={t.talla_id} value={t.talla_id}>
                            {t.talla_nombre} ({t.stock} disp.)
                          </option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="input-label">Cant.</label>
                      <input type="number" min={1} className="input"
                        {...register(`items.${idx}.cantidad`, { required: true, min: 1, valueAsNumber: true })} />
                    </div>
                    <div>
                      <label className="input-label">Precio unit.</label>
                      <input type="number" min={0} step="0.01" className="input"
                        {...register(`items.${idx}.precio_unitario`, { required: true, min: 0, valueAsNumber: true })} />
                    </div>
                    <div>
                      <label className="input-label">Desc. ítem</label>
                      <input type="number" min={0} className="input"
                        {...register(`items.${idx}.descuento_item`, { valueAsNumber: true })} />
                    </div>
                    <button type="button"
                      onClick={() => fields.length > 1 && remove(idx)}
                      disabled={fields.length === 1}
                      className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors disabled:opacity-20 mb-0.5">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Computed mini-row */}
                  <div className="grid grid-cols-3 gap-3 pt-1.5 border-t border-white/[0.05] text-xs">
                    <div className="flex items-center gap-1 text-primary-muted">
                      <span className="shrink-0">Costo:</span>
                      <span className="font-semibold">{formatCOP((watchItems[idx]?.costo_unitario_snap ?? 0) * (watchItems[idx]?.cantidad ?? 1))}</span>
                      <input type="hidden" {...register(`items.${idx}.costo_unitario_snap`, { valueAsNumber: true })} />
                    </div>
                    <div className="flex items-center gap-1 text-warning">
                      <span>Comisión:</span>
                      <span className="font-semibold">{formatCOP(calc.comisionItem + calc.comisionMPItem)}</span>
                    </div>
                    <div className={`flex items-center gap-1 font-semibold ${calc.utilidadItem >= 0 ? 'text-success' : 'text-danger'}`}>
                      <span>Utilidad:</span>
                      <span>{formatCOP(calc.utilidadItem)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Envío */}
        <div className="bg-[#0B0B16] border border-border rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Truck size={14} className="text-primary-muted" />
            <span className="text-base font-semibold text-primary">Envío</span>
          </div>
          <div className="flex gap-5">
            {([
              { value: 'standard', label: 'Estándar' },
              { value: 'express',  label: 'Express'  },
              { value: 'recogida', label: 'Recogida en punto' },
            ] as const).map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="radio" value={value} {...register('tipo_envio')} className="accent-accent" />
                <span className="text-base text-primary-muted">{label}</span>
              </label>
            ))}
          </div>

          {watchTipoEnvio === 'recogida' ? (
            <p className="text-base text-primary-muted bg-accent/5 border border-accent/20 rounded-lg px-3 py-2">
              El cliente retira su pedido en el punto de la marca. Sin costo de envío.
            </p>
          ) : (<>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="input-label">Departamento</label>
              <ComboSelect
                value={watchEnvioDep}
                onChange={v => { setValue('envio_departamento', v); setValue('envio_ciudad', '') }}
                options={toOptions(DEPARTAMENTOS)}
                placeholder="— Departamento —"
              />
            </div>
            <div>
              <label className="input-label">Ciudad</label>
              <ComboSelect
                value={watchEnvioCiud}
                onChange={v => setValue('envio_ciudad', v)}
                options={toOptions(getCiudades(watchEnvioDep))}
                placeholder={watchEnvioDep ? '— Ciudad —' : '— Primero el depto —'}
                disabled={!watchEnvioDep}
              />
            </div>
            <div>
              <label className="input-label">Dirección</label>
              <input type="text" placeholder="Calle, número, apto…" className="input"
                {...register('envio_direccion')} />
            </div>
          </div>

          {/* Fila: Transportadora + Guía + Estado envío */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="input-label">Transportadora</label>
              <select className="input" {...register('transportadora_id', { valueAsNumber: true })}>
                <option value={0}>— Sin especificar —</option>
                {transportadoras.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">N° Guía <span className="text-primary-muted normal-case font-normal">(opcional)</span></label>
              <input type="text" placeholder="Ej: 123456789" className="input"
                {...register('guia_numero')} />
            </div>
            <div>
              <label className="input-label">Estado del envío</label>
              <select className="input" {...register('envio_pendiente', { valueAsNumber: true })}>
                <option value={1}>Pendiente de envío</option>
                <option value={0}>Enviado</option>
              </select>
            </div>
          </div>

          <div className={`grid gap-3 ${watchTipoEnvio === 'express' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className="input-label">Costo envío cobrado al cliente</label>
              <input type="number" min={0} step="0.01" className="input"
                {...register('costo_envio', { valueAsNumber: true })} />
            </div>
            {watchTipoEnvio === 'express' && (
              <div>
                <label className="input-label">Costo envío real (mensajería)</label>
                <input type="number" min={0} step="0.01" className="input"
                  {...register('costo_envio_real', { valueAsNumber: true })} />
              </div>
            )}
          </div>
          </>)}
        </div>

        {/* Descuento global + notas + estado pago */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="input-label">Descuento global</label>
            <input type="number" min={0} className="input"
              {...register('descuento', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="input-label">Estado del pago</label>
            <select className="input" {...register('estado')}>
              <option value="completada">Pago recibido</option>
              <option value="pendiente">Pago pendiente</option>
            </select>
          </div>
          <div>
            <label className="input-label">Notas</label>
            <textarea rows={1} placeholder="Observaciones…" className="input resize-none"
              {...register('notas')} />
          </div>
        </div>

        {/* Resumen */}
        <div className="bg-[#0B0B16] border border-border rounded-xl p-4 flex flex-col gap-1.5">
          <div className="flex justify-between text-base text-primary-muted">
            <span>Subtotal productos</span><span>{formatCOP(subtotalItems)}</span>
          </div>
          {descuentoGlobal > 0 && (
            <div className="flex justify-between text-base text-danger">
              <span>Descuento global</span><span>-{formatCOP(descuentoGlobal)}</span>
            </div>
          )}
          {envio > 0 && (
            <div className="flex justify-between text-base text-primary-muted">
              <span>Costo de envío</span><span>+{formatCOP(envio)}</span>
            </div>
          )}
          {comisionTotal > 0 && (
            <div className="flex justify-between text-base text-warning">
              <span>Comisión canal ({pctComision}%)</span><span>-{formatCOP(comisionTotal)}</span>
            </div>
          )}
          {comisionMP > 0 && (
            <div className="flex justify-between text-base text-warning">
              <span>Comisión pasarela{tarifaSelec ? ` (${tarifaSelec.concepto})` : ''}</span>
              <span>-{formatCOP(comisionMP)}</span>
            </div>
          )}
          {comisionMP === 0 && comisionMPGuardada > 0 && (
            <div className="flex justify-between text-base text-warning">
              <span>Comisión pasarela (conciliada)</span>
              <span>-{formatCOP(comisionMPGuardada)}</span>
            </div>
          )}
          <div className={`flex justify-between text-base font-semibold ${totalUtilidad >= 0 ? 'text-success' : 'text-danger'}`}>
            <span>Utilidad estimada</span><span>{formatCOP(totalUtilidad)}</span>
          </div>
          <div className="border-t border-border mt-1 pt-1.5 flex justify-between">
            <span className="text-md font-bold text-primary">Total</span>
            <span className="text-xl font-bold text-accent">{formatCOP(totalVenta)}</span>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="btn-ghost" disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? <span className="flex items-center gap-2"><Spinner size="sm" /> Guardando…</span>
              : isEditing ? 'Guardar cambios' : 'Registrar venta'}
          </button>
        </div>

      </form>
    </div>
  )
}
