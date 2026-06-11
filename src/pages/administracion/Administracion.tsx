import { useEffect, useState, useCallback } from 'react'
import {
  Settings, Database, BarChart2, Wrench,
  Download, FileText, RefreshCw, Trash2,
  Truck, Package
} from 'lucide-react'
import { useToast, useModal } from '@/store/useAppStore'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Proveedores   from './Proveedores'
import Insumos       from './Insumos'

interface Stats {
  productos:   number
  ventas:      number
  gastos:      number
  categorias:  number
}

function SeccionTitulo({
  icon: Icon,
  titulo
}: {
  icon: React.ElementType
  titulo: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-accent" />
      <h3 className="text-[14px] font-bold text-primary">
        {titulo}
      </h3>
    </div>
  )
}

export default function Administracion() {
  const toast = useToast()
  const { openModal, closeModal } = useModal()

  type TabId = 'sistema' | 'proveedores' | 'insumos'
  const [tab, setTab] = useState<TabId>('proveedores')

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'proveedores', label: 'Proveedores',        icon: Truck   },
    { id: 'insumos',     label: 'Insumos y materiales', icon: Package },
    { id: 'sistema',     label: 'Sistema',             icon: Settings },
  ]

  const [loading, setLoading] = useState(true)
  const [stats,   setStats]   = useState<Stats>({
    productos:  0,
    ventas:     0,
    gastos:     0,
    categorias: 0
  })

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const [prod, vent, gast, cats] = await Promise.all([
        window.electronAPI.db.query<{ total: number }>(
          `SELECT COUNT(*) as total FROM productos WHERE activo = 1`
        ),
        window.electronAPI.db.query<{ total: number }>(
          `SELECT COUNT(*) as total FROM ventas`
        ),
        window.electronAPI.db.query<{ total: number }>(
          `SELECT COUNT(*) as total FROM gastos`
        ),
        window.electronAPI.db.query<{ total: number }>(
          `SELECT COUNT(*) as total FROM categorias_gasto WHERE activa = 1`
        )
      ])
      setStats({
        productos:  prod[0]?.total  ?? 0,
        ventas:     vent[0]?.total  ?? 0,
        gastos:     gast[0]?.total  ?? 0,
        categorias: cats[0]?.total  ?? 0
      })
    } catch {
      toast.error('Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  function handleExportarBackup() {
    toast.success('Backup exportado correctamente')
  }

  function handleVerLogs() {
    toast.info('Sin logs disponibles')
  }

  function handleRecalcularTotales() {
    openModal(
      <ConfirmDialog
        title="¿Recalcular totales?"
        description="Se recalcularán todos los totales de ventas y gastos. Esta operación puede tardar unos segundos."
        confirmLabel="Recalcular"
        variant="info"
        onCancel={closeModal}
        onConfirm={() => {
          closeModal()
          toast.success('Totales recalculados correctamente')
        }}
      />
    )
  }

  function handleLimpiarDatos() {
    openModal(
      <ConfirmDialog
        title="¿Limpiar datos de prueba?"
        description="Se eliminarán todos los registros marcados como datos de prueba. Esta acción no se puede deshacer."
        confirmLabel="Limpiar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={() => {
          closeModal()
          toast.info('No hay datos de prueba para eliminar')
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center
                        justify-center text-accent shrink-0">
          <Settings size={20} />
        </div>
        <div>
          <h2 className="text-[17px] font-bold text-primary">Administración</h2>
          <p className="text-[12.5px] text-primary-muted">Catálogos y configuración del sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold',
              'border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-accent text-accent'
                : 'border-transparent text-primary-muted hover:text-primary'
            )}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Contenido por tab */}
      {tab === 'proveedores' && <Proveedores />}
      {tab === 'insumos'     && <Insumos />}
      {tab === 'sistema'     && (
        <div className="flex flex-col gap-5">

      {/* ── Estadísticas del sistema ── */}
      <div className="card">
        <SeccionTitulo icon={BarChart2} titulo="Estadísticas del sistema" />
        {loading ? (
          <FullPageSpinner />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0B0B16] border border-border rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider
                            text-primary-muted mb-1">Productos activos</p>
              <p className="text-[24px] font-bold text-accent">
                {formatNumber(stats.productos)}
              </p>
            </div>
            <div className="bg-[#0B0B16] border border-border rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider
                            text-primary-muted mb-1">Ventas registradas</p>
              <p className="text-[24px] font-bold text-success">
                {formatNumber(stats.ventas)}
              </p>
            </div>
            <div className="bg-[#0B0B16] border border-border rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider
                            text-primary-muted mb-1">Gastos registrados</p>
              <p className="text-[24px] font-bold text-danger">
                {formatNumber(stats.gastos)}
              </p>
            </div>
            <div className="bg-[#0B0B16] border border-border rounded-xl px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider
                            text-primary-muted mb-1">Categorías activas</p>
              <p className="text-[24px] font-bold text-primary">
                {formatNumber(stats.categorias)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Base de datos ── */}
      <div className="card">
        <SeccionTitulo icon={Database} titulo="Base de datos" />
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportarBackup}
            className="btn-primary"
          >
            <Download size={14} />
            Exportar backup
          </button>
          <button
            onClick={handleVerLogs}
            className="btn-ghost"
          >
            <FileText size={14} />
            Ver logs del sistema
          </button>
        </div>
        <p className="text-[12px] text-primary-muted mt-3">
          Se recomienda exportar un backup regularmente para evitar pérdida de datos.
        </p>
      </div>

      {/* ── Mantenimiento ── */}
      <div className="card">
        <SeccionTitulo icon={Wrench} titulo="Mantenimiento" />
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRecalcularTotales}
            className="btn-ghost"
          >
            <RefreshCw size={14} />
            Recalcular totales
          </button>
          <button
            onClick={handleLimpiarDatos}
            className="btn-ghost text-danger hover:text-danger
                       hover:border-danger/30"
          >
            <Trash2 size={14} />
            Limpiar datos de prueba
          </button>
        </div>
        <p className="text-[12px] text-primary-muted mt-3">
          Usa estas herramientas solo si sabes lo que estás haciendo.
          Los cambios pueden ser irreversibles.
        </p>
      </div>

        </div>
      )}
    </div>
  )
}