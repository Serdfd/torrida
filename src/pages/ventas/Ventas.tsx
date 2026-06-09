import { useEffect, useState, useCallback } from 'react'
import { useAppStore, useToast, useModal } from '@/store/useAppStore'
import { Plus, Search, Filter, Download } from 'lucide-react'
import { Venta } from '@/types'
import { getVentas } from '@/lib/queries'
import { formatCOP, formatDate, objectsToCSV } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import VentaForm from './VentaForm'
import VentaDetalle from './VentaDetalle'
import VentaFila from './VentaFila'

const ESTADOS = ['todos', 'pendiente', 'enviado', 'entregado', 'cancelado']

export default function Ventas() {
  const { filtroAnio, filtroMes } = useAppStore()
  const toast  = useToast()
  const { openModal, closeModal } = useModal()

  const [loading, setLoading]   = useState(true)
  const [ventas, setVentas]     = useState<Venta[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado]     = useState('todos')

  const loadVentas = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getVentas(
        filtroAnio,
        filtroMes,
        estado === 'todos' ? undefined : estado
      ) as Venta[]
      setVentas(data)
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar ventas')
    } finally {
      setLoading(false)
    }
  }, [filtroAnio, filtroMes, estado])

  useEffect(() => { loadVentas() }, [loadVentas])

  // Filtro por búsqueda local
  const ventasFiltradas = ventas.filter(v => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      v.numero?.toLowerCase().includes(q) ||
      v.cliente_nombre?.toLowerCase().includes(q) ||
      v.canal_nombre?.toLowerCase().includes(q)
    )
  })

  // Totales
  const totalIngresos = ventasFiltradas.reduce((s, v) =>
    v.estado !== 'cancelado' ? s + v.total : s, 0)
  const totalUnidades = ventasFiltradas.reduce((s, v) =>
    v.estado !== 'cancelado' ? s + (v.items?.reduce((si, i) => si + i.cantidad, 0) ?? 0) : s, 0)

  function handleNuevaVenta() {
    openModal(
      <VentaForm
        onSuccess={() => { closeModal(); loadVentas() }}
        onCancel={closeModal}
      />
    )
  }

  function handleVerDetalle(venta: Venta) {
    openModal(
      <VentaDetalle
        venta={venta}
        onClose={closeModal}
        onUpdate={() => { closeModal(); loadVentas() }}
      />
    )
  }

  function handleExportar() {
    if (ventasFiltradas.length === 0) {
      toast.warning('No hay ventas para exportar')
      return
    }
    const data = ventasFiltradas.map(v => ({
      Numero:       v.numero,
      Fecha:        formatDate(v.fecha),
      Cliente:      v.cliente_nombre ?? '',
      Canal:        v.canal_nombre   ?? '',
      MedioPago:    v.medio_pago_nombre ?? '',
      Total:        v.total,
      Descuento:    v.descuento,
      Envio:        v.costo_envio_cobrado,
      Comision:     v.comision_canal,
      Estado:       v.estado
    }))
    const csv  = objectsToCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
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

        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-muted"
          />
          <input
            type="text"
            placeholder="Buscar por número, cliente o canal…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input pl-8 h-9 text-[13.5px]"
          />
        </div>

        {/* Filtro estado */}
        <div className="flex items-center gap-1.5 bg-card border border-border
                        rounded-lg px-2 py-1">
          <Filter size={13} className="text-primary-muted" />
          {ESTADOS.map(e => (
            <button
              key={e}
              onClick={() => setEstado(e)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-semibold capitalize
                          transition-colors duration-100
                          ${estado === e
                            ? 'bg-accent-DEFAULT text-white'
                            : 'text-primary-muted hover:text-primary-DEFAULT'
                          }`}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Exportar */}
        <button onClick={handleExportar} className="btn-ghost h-9 text-[13px]">
          <Download size={14} />
          CSV
        </button>

        {/* Nueva venta */}
        <button onClick={handleNuevaVenta} className="btn-primary h-9 text-[13px]">
          <Plus size={14} />
          Nueva venta
        </button>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Ventas</p>
          <p className="text-[20px] font-bold text-primary-DEFAULT">
            {ventasFiltradas.filter(v => v.estado !== 'cancelado').length}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Ingresos</p>
          <p className="text-[20px] font-bold text-accent-DEFAULT">
            {formatCOP(totalIngresos)}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Unidades</p>
          <p className="text-[20px] font-bold text-primary-DEFAULT">
            {totalUnidades}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Canceladas</p>
          <p className="text-[20px] font-bold text-danger">
            {ventasFiltradas.filter(v => v.estado === 'cancelado').length}
          </p>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <FullPageSpinner />
      ) : ventasFiltradas.length === 0 ? (
        <EmptyState
          title="Sin ventas"
          description="No hay ventas registradas para el período y filtro seleccionados."
          action={
            <button onClick={handleNuevaVenta} className="btn-primary">
              <Plus size={14} /> Nueva venta
            </button>
          }
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Canal</th>
                  <th>Medio pago</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Comisión</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.map(venta => (
                  <VentaFila
                    key={venta.id}
                    venta={venta}
                    onClick={() => handleVerDetalle(venta)}
                    onUpdate={loadVentas}
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