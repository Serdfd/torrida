import { useEffect, useState, useCallback } from 'react'
import { useAppStore, useToast, useModal }  from '@/store/useAppStore'
import { Plus, Search, Filter, Download, Truck }   from 'lucide-react'
import { getVentas }                        from '@/lib/queries'
import { formatCOP, formatDate, objectsToCSV } from '@/lib/utils'
import { FullPageSpinner }                  from '@/components/ui/Spinner'
import EmptyState                           from '@/components/ui/EmptyState'
import VentaForm                            from './VentaForm'
import VentaDetalle                         from './VentaDetalle'
import VentaFila                            from './VentaFila'

interface VentasProps {
  onNuevaVenta:   () => void
  onEditarVenta:  (id: number) => void
}

const ESTADOS = ['todos', 'pendiente', 'completada', 'cancelado']

export default function Ventas({ onNuevaVenta, onEditarVenta }: VentasProps) {
  const { filtroAnio, filtroMes }  = useAppStore()
  const toast                      = useToast()
  const { openModal, closeModal }  = useModal()

  const [loading,  setLoading]  = useState(true)
  const [ventas,   setVentas]   = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [estado,   setEstado]   = useState('todos')
  const [soloEnvioPendiente, setSoloEnvioPendiente] = useState(false)

  const loadVentas = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getVentas(filtroAnio, filtroMes)
      setVentas(data)
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar ventas')
    } finally {
      setLoading(false)
    }
  }, [filtroAnio, filtroMes])

  useEffect(() => { loadVentas() }, [loadVentas])

  const ventasFiltradas = ventas.filter(v => {
    if (estado !== 'todos' && v.estado !== estado) return false
    if (soloEnvioPendiente && (v.estado === 'cancelado' || !v.envio_pendiente)) return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      v.numero_venta?.toLowerCase().includes(q) ||
      v.cliente_nombre?.toLowerCase().includes(q) ||
      v.canal_nombre?.toLowerCase().includes(q)
    )
  })

  const totalIngresos = ventasFiltradas.reduce((s: number, v: any) =>
    v.estado !== 'cancelado' ? s + (v.total ?? 0) : s, 0)

  function handleVerDetalle(venta: any) {
    openModal(
      <VentaDetalle
        venta={venta}
        onClose={closeModal}
        onUpdate={() => { closeModal(); loadVentas() }}
      />,
      'xl'
    )
  }

  function handleExportar() {
    if (ventasFiltradas.length === 0) {
      toast.warning('No hay ventas para exportar')
      return
    }
    const data = ventasFiltradas.map((v: any) => ({
      Numero:    v.numero_venta,
      Fecha:     formatDate(v.fecha),
      Cliente:   v.cliente_nombre   ?? '',
      Canal:     v.canal_nombre     ?? '',
      MedioPago: v.medio_pago_nombre ?? '',
      Total:     v.total,
      Descuento: v.descuento,
      Envio:     v.costo_envio,
      Comision:  v.comision_canal,
      Estado:    v.estado
    }))
    const csv  = objectsToCSV(data)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `ventas_${filtroAnio}_${filtroMes}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Ventas exportadas')
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Barra de acciones */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-muted" />
          <input
            type="text"
            placeholder="Buscar por número, cliente o canal…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input pl-8 h-9 text-base"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-bg-surface border border-border
                        rounded-lg px-2 py-1">
          <Filter size={13} className="text-primary-muted" />
          {ESTADOS.map(e => (
            <button key={e} onClick={() => setEstado(e)}
              className={`px-2.5 py-1 rounded-md text-sm font-semibold capitalize
                          transition-colors duration-100
                          ${estado === e
                            ? 'bg-accent text-white'
                            : 'text-primary-muted hover:text-primary'}`}>
              {e}
            </button>
          ))}
        </div>

        <button onClick={handleExportar} className="btn-ghost">
          <Download size={14} /> CSV
        </button>

        <button
          onClick={() => setSoloEnvioPendiente(v => !v)}
          className={`btn-ghost gap-1.5 ${
            soloEnvioPendiente
              ? 'border-warning/40 text-warning bg-warning/10'
              : ''
          }`}
        >
          <Truck size={14} />
          {soloEnvioPendiente ? 'Pendientes de envío' : 'Envío pendiente'}
        </button>

        <button onClick={onNuevaVenta} className="btn-primary">
          <Plus size={14} /> Nueva venta
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ventas',     value: ventasFiltradas.filter((v:any) => v.estado !== 'cancelado').length, fmt: String },
          { label: 'Ingresos',   value: totalIngresos,  fmt: formatCOP },
          { label: 'Canceladas', value: ventasFiltradas.filter((v:any) => v.estado === 'cancelado').length, fmt: String },
          { label: 'Total reg.', value: ventasFiltradas.length, fmt: String }
        ].map(({ label, value, fmt }) => (
          <div key={label} className="card py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-primary-muted mb-1">
              {label}
            </p>
            <p className="text-xl font-bold text-primary">
              {fmt(value as any)}
            </p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <FullPageSpinner />
      ) : ventasFiltradas.length === 0 ? (
        <EmptyState
          title="Sin ventas"
          description="No hay ventas registradas para el período y filtro seleccionados."
          action={
            <button onClick={onNuevaVenta} className="btn-primary">
              <Plus size={14} /> Nueva venta
            </button>
          }
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Canal</th>
                  <th>Medio pago</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Envío</th>
                  <th className="text-right">Comisión</th>
                  <th className="text-right">Utilidad</th>
                  <th>Estado</th>
                  <th>Envío</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.map((venta: any) => (
                  <VentaFila
                    key={venta.id}
                    venta={venta}
                    onClick={() => handleVerDetalle(venta)}
                    onUpdate={loadVentas}
                    onEditar={() => onEditarVenta(venta.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}