import { useState, useEffect } from 'react'
import { useAppStore }         from '@/store/useAppStore'
import Sidebar                 from '@/components/layout/Sidebar'
import TopBar                  from '@/components/layout/TopBar'
import ModalContainer          from '@/components/ui/ModalContainer'
import ToastContainer          from '@/components/ui/ToastContainer'

// ── Páginas ────────────────────────────────────────────────────────────────
import Dashboard        from '@/pages/dashboard/Dashboard'
import Ventas           from '@/pages/ventas/Ventas'
import VentaForm        from '@/pages/ventas/VentaForm'
import Gastos           from '@/pages/gastos/Gastos'
import Inventario       from '@/pages/inventario/Inventario'
import Productos        from '@/pages/productos/Productos'
import Produccion       from '@/pages/produccion/Produccion'
import Reportes         from '@/pages/reportes/Reportes'
import CierreMensual    from '@/pages/cierre/CierreMensual'
import TiendaNube       from '@/pages/tiendanube/TiendaNube'
import Administracion   from '@/pages/administracion/Administracion'
import Configuracion    from '@/pages/configuracion/Configuracion'
import SesionesFotograficas from '@/pages/sesiones/SesionesFotograficas'
import SetupWizard        from '@/pages/configuracion/SetupWizard'

// ── Tipos de rutas ─────────────────────────────────────────────────────────
export type PageId =
  | 'dashboard'
  | 'ventas'
  | 'nueva-venta'
  | 'editar-venta'
  | 'gastos'
  | 'inventario'
  | 'productos'
  | 'produccion'
  | 'reportes'
  | 'cierre'
  | 'tiendanube'
  | 'administracion'
  | 'configuracion'
  | 'sesiones'

// ── Títulos de página ──────────────────────────────────────────────────────
const PAGE_TITLES: Record<PageId, string> = {
  'dashboard':      'Dashboard',
  'ventas':         'Ventas',
  'nueva-venta':    'Nueva venta',
  'editar-venta':   'Editar venta',
  'gastos':         'Gastos',
  'inventario':     'Inventario',
  'productos':      'Productos',
  'produccion':     'Producción',
  'reportes':       'Reportes',
  'cierre':         'Cierre mensual',
  'tiendanube':     'Tienda Nube',
  'administracion': 'Administración',
  'configuracion':  'Configuración',
  'sesiones':       'Sesiones Fotográficas',
}

// ── Componente principal ───────────────────────────────────────────────────
export default function App() {
  const { sidebarOpen, modal, toast, dismissToast } = useAppStore()

  const [currentPage,    setCurrentPage]    = useState<PageId>('dashboard')
  const [editingVentaId, setEditingVentaId] = useState<number | null>(null)
  const [setupDone,      setSetupDone]      = useState<boolean | null>(null) // null = cargando

  // Verificar si el setup fue completado alguna vez
  useEffect(() => {
    window.electronAPI.db.query<{ valor: string }>(
      `SELECT valor FROM configuracion_app WHERE clave = 'setup_completado' LIMIT 1`
    ).then(rows => {
      setSetupDone(rows[0]?.valor === '1')
    }).catch(() => setSetupDone(true)) // si falla la DB, no bloquear
  }, [])

  // ── Navegación ────────────────────────────────────────────────────────────
  function navigate(page: string, params?: { ventaId?: number }) {
    setCurrentPage(page as PageId)
    if (params?.ventaId !== undefined) {
      setEditingVentaId(params.ventaId)
    } else {
      setEditingVentaId(null)
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // Atajo de teclado: Ctrl+N → Nueva venta
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        navigate('nueva-venta')
      }
      if (e.key === 'Escape' && modal.open) {
        useAppStore.getState().closeModal()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modal.open])

  // ── Renderizado de página activa ──────────────────────────────────────────
  function renderPage() {
    switch (currentPage) {

      case 'dashboard':
        return <Dashboard onNavigate={navigate} />

      case 'ventas':
        return (
          <Ventas
            onNuevaVenta={() => navigate('nueva-venta')}
            onEditarVenta={id => navigate('editar-venta', { ventaId: id })}
          />
        )

      case 'nueva-venta':
        return (
          <VentaForm
            onSuccess={() => navigate('ventas')}
            onCancel={() => navigate('ventas')}
          />
        )

      case 'editar-venta':
        return (
          <VentaForm
            ventaId={editingVentaId ?? undefined}
            onSuccess={() => navigate('ventas')}
            onCancel={() => navigate('ventas')}
          />
        )

      case 'gastos':
        return <Gastos />

      case 'inventario':
        return (
          <Inventario
            onVerProductos={() => navigate('productos')}
          />
        )

      case 'productos':
        return <Productos />

      case 'produccion':
        return <Produccion />

      case 'reportes':
        return <Reportes />

      case 'cierre':
        return <CierreMensual />

      case 'tiendanube':
        return <TiendaNube />

      case 'administracion':
        return <Administracion />

      case 'configuracion':
        return <Configuracion />

      case 'sesiones':
        return <SesionesFotograficas />

      default:
        return <Dashboard onNavigate={navigate} />
    }
  }

  // Mientras se verifica si el setup está hecho, no renderizar nada
  if (setupDone === null) return null

  // Wizard de primer arranque
  if (!setupDone) {
    return (
      <SetupWizard onComplete={() => setSetupDone(true)} />
    )
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">

      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={navigate}
      />

      {/* Contenido principal */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300">

        <TopBar
          title={PAGE_TITLES[currentPage]}
          currentPage={currentPage}
          onNavigate={navigate}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 md:px-7 md:py-6">
          <div className="max-w-[1400px] mx-auto">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Modal global */}
      <ModalContainer
        open={modal.open}
        onClose={() => useAppStore.getState().closeModal()}
        size={modal.size}
      >
        {modal.content}
      </ModalContainer>

      {/* Toast global */}
      <ToastContainer
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={dismissToast}
      />

    </div>
  )
}