import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Factory } from 'lucide-react'
import { useAppStore, useToast, useModal } from '@/store/useAppStore'
import { formatCOP, formatDate, formatNumber } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import ProduccionForm from './ProduccionForm'

interface RegistroProduccion {
  id:              number
  insumo_id:       number
  producto_nombre: string
  costo_unitario:  number | null
  cantidad:        number
  motivo:          string | null
  fecha:           string
  created_at:      string
}

export default function Produccion() {
  const { filtroAnio, filtroMes } = useAppStore()
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,   setLoading]   = useState(true)
  const [registros, setRegistros] = useState<RegistroProduccion[]>([])
  const [busqueda,  setBusqueda]  = useState('')

  const loadProduccion = useCallback(async () => {
    setLoading(true)
    try {
      const mes = String(filtroMes).padStart(2, '0')
      const data = await window.electronAPI.db.query<RegistroProduccion>(
        `SELECT
           mi.id, mi.insumo_id, mi.cantidad, mi.motivo,
           mi.fecha, mi.created_at,
           COALESCE(p.nombre, 'Producto eliminado') AS producto_nombre,
           p.costo_unitario
         FROM movimientos_insumos mi
         LEFT JOIN productos p ON p.id = mi.insumo_id
         WHERE mi.tipo = 'salida_produccion'
           AND strftime('%Y', mi.fecha) = ?
           AND strftime('%m', mi.fecha) = ?
         ORDER BY mi.fecha DESC, mi.created_at DESC`,
        [String(filtroAnio), mes]
      )
      setRegistros(data)
    } catch {
      toast.error('Error al cargar producción')
    } finally {
      setLoading(false)
    }
  }, [filtroAnio, filtroMes])

  useEffect(() => { loadProduccion() }, [loadProduccion])

  const registrosFiltrados = registros.filter(r =>
    !busqueda ||
    r.producto_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (r.motivo ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  // KPIs
  const totalUnidades  = registrosFiltrados.reduce((s, r) => s + r.cantidad, 0)
  const costoEstimado  = registrosFiltrados.reduce((s, r) =>
    s + r.cantidad * (r.costo_unitario ?? 0), 0)

  function handleNuevaProduccion() {
    openModal(
      <ProduccionForm
        onSuccess={() => { closeModal(); loadProduccion() }}
        onCancel={closeModal}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Barra de acciones */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-muted"
          />
          <input
            type="text"
            placeholder="Buscar por producto o colección…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input pl-8 h-9 text-[13.5px]"
          />
        </div>
        <button onClick={handleNuevaProduccion} className="btn-primary h-9 text-[13px]">
          <Plus size={14} />
          Registrar producción
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Unidades producidas</p>
          <p className="text-[22px] font-bold text-primary">
            {formatNumber(totalUnidades)}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Costo estimado</p>
          <p className="text-[22px] font-bold text-accent">
            {formatCOP(costoEstimado)}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Registros</p>
          <p className="text-[22px] font-bold text-primary">
            {registrosFiltrados.length}
          </p>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <FullPageSpinner />
      ) : registrosFiltrados.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="Sin registros de producción"
          description={
            busqueda
              ? 'No se encontraron registros con ese filtro.'
              : 'No hay producción registrada en este período.'
          }
          action={
            !busqueda && (
              <button onClick={handleNuevaProduccion} className="btn-primary">
                <Plus size={14} /> Registrar producción
              </button>
            )
          }
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Colección / Motivo</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">Costo unit.</th>
                  <th className="text-right">Costo total</th>
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.map(r => (
                  <tr key={r.id}>
                    <td className="text-primary-muted text-[13px] whitespace-nowrap">
                      {formatDate(r.fecha)}
                    </td>
                    <td>
                      <p className="font-semibold text-[13.5px] text-primary">
                        {r.producto_nombre}
                      </p>
                    </td>
                    <td className="max-w-[200px]">
                      {r.motivo
                        ? (
                          <p className="text-[12.5px] text-primary-muted truncate"
                             title={r.motivo}>
                            {r.motivo}
                          </p>
                        )
                        : <span className="text-primary-muted text-[13px]">—</span>
                      }
                    </td>
                    <td className="text-right font-bold text-[14px] text-primary">
                      {formatNumber(r.cantidad)}
                    </td>
                    <td className="text-right text-[13px] text-primary-muted">
                      {r.costo_unitario ? formatCOP(r.costo_unitario) : '—'}
                    </td>
                    <td className="text-right font-semibold text-[13.5px] text-accent">
                      {r.costo_unitario
                        ? formatCOP(r.cantidad * r.costo_unitario)
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-[#0B0B16]">
                  <td colSpan={3} className="px-4 py-3 text-[13px]
                                             font-bold text-primary-muted">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold
                                 text-[15px] text-primary">
                    {formatNumber(totalUnidades)}
                  </td>
                  <td />
                  <td className="px-4 py-3 text-right font-bold
                                 text-[15px] text-accent">
                    {formatCOP(costoEstimado)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}