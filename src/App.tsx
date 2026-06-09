/**
 * App.tsx
 * Componente raíz de la app.
 * Maneja: layout principal, sidebar, rutas, modal y toast.
 */

import { useState, useEffect } from 'react'
import { useAppStore }         from '@/store/useAppStore'
import Sidebar                 from '@/components/layout/Sidebar'
import TopBar                  from '@/components/layout/TopBar'
import ModalContainer          from '@/components/ui/ModalContainer'
import ToastContainer          from '@/components/ui/ToastContainer'

// ── Páginas ────────────────────────────────────────────────────────────────
import Dashboard        from '@/pages/dashboard/Dashboard'
import Ventas           from '@/pages/ventas/Ventas'
import NuevaVenta       from '@/pages/ventas/NuevaVenta'
import Gastos           from '@/pages/gastos/Gastos'
import Inventario       from '@/pages/inventario/Inventario'
import Productos        from '@/pages/productos/Productos'
import Reportes         from '@/pages/reportes/Reportes'
import CierreMensual    from '@/pages/cierre/CierreMensual'
import Configuracion    from '@/pages/configuracion/Configuracion'

// ── Tipos de rutas ─────────────────────────────────────────────────────────

export type PageId =
  | 'dashboard'
  | 'ventas'
  | 'nueva-venta'
  | 'editar-venta'
  | 'gastos'
  | 'inventario'
  | 'productos'
  | 'reportes'
  | 'cierre'
  | 'configuracion'

// ── Mapa de páginas ────────────────────────────────────────────────────────

const PAGE_TITLES: Record<PageId, string> = {
  'dashboard':    'Dashboard',
  'ventas':       'Ventas',
  'nueva-venta':  'Nueva venta',
  'editar-venta': 'Editar venta',
  'gastos':       'Gastos',
  'inventario':   'Inventario',
  'productos':    'Productos',
  'reportes':     'Reportes',
  'cierre':       'Cierre mensual',
  'configuracion':'Configuración'
}

// ── Componente ─────────────────────────────────────────────────────────────

export default function App() {
  const { sidebarOpen, modal, toast, dismissToast } = useAppStore()

  const [currentPage,   setCurrentPage]   = useState<PageId>('dashboard')
  const [editingVentaId, setEditingVentaId] = useState<number | null>(null)

  // ── Navegación ───────────────────────────────────────────────────────────
  function navigate(page: PageId, params?: { ventaId?: number }) {
    setCurrentPage(page)
    if (params?.ventaId !== undefined) {
      setEditingVentaId(params.ventaId)
    } else {
      setEditingVentaId(null)
    }
    // Scroll al top al cambiar de página
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

  // ── Renderizado de página activa ─────────────────────────────────────────
  function renderPage() {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={navigate}
          />
        )

      case 'ventas':
        return (
          <Ventas
            onNuevaVenta={() => navigate('nueva-venta')}
            onEditarVenta={id => navigate('editar-venta', { ventaId: id })}
          />
        )

      case 'nueva-venta':
        return (
          <NuevaVenta
            onSuccess={() => navigate('ventas')}
            onCancel={() => navigate('ventas')}
          />
        )

      case 'editar-venta':
        return (
          <NuevaVenta
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

      case 'reportes':
        return <Reportes />

      case 'cierre':
        return <CierreMensual />

      case 'configuracion':
        return <Configuracion />

      default:
        return <Dashboard onNavigate={navigate} />
    }
  }

  return (
    <div className="flex h-screen bg-bg-DEFAULT overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={navigate}
      />

      {/* ── Contenido principal ──────────────────────────────────────── */}
      <div className={`
        flex flex-col flex-1 min-w-0 overflow-hidden
        transition-all duration-300
        ${sidebarOpen ? 'ml-0' : 'ml-0'}
      `}>

        {/* TopBar */}
        <TopBar
          title={PAGE_TITLES[currentPage]}
          currentPage={currentPage}
          onNavigate={navigate}
        />

        {/* Página activa */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden
                         px-5 py-5 md:px-7 md:py-6">
          <div className="max-w-[1400px] mx-auto">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* ── Modal global ─────────────────────────────────────────────── */}
      <ModalContainer
        open={modal.open}
        onClose={() => useAppStore.getState().closeModal()}
      >
        {modal.content}
      </ModalContainer>

      {/* ── Toast global ─────────────────────────────────────────────── */}
      <ToastContainer
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={dismissToast}
      />

    </div>
  )
}