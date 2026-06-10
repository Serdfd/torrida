import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Factory,
  Boxes,
  Receipt,
  CalendarCheck,
  Settings,
  Store,
  BarChart2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'ventas',         label: 'Ventas',          icon: ShoppingBag     },
  { id: 'productos',      label: 'Productos',       icon: Package         },
  { id: 'produccion',     label: 'Producción',      icon: Factory         },
  { id: 'inventario',     label: 'Inventario',      icon: Boxes           },
  { id: 'gastos',         label: 'Gastos',          icon: Receipt         },
  { id: 'reportes',       label: 'Reportes',        icon: BarChart2       },
  { id: 'cierre',         label: 'Cierre Mensual',  icon: CalendarCheck   },
  { id: 'tiendanube',     label: 'Tienda Nube',     icon: Store           },
  { id: 'administracion', label: 'Administración',  icon: Settings        },
]

interface SidebarProps {
  currentPage: string
  onNavigate:  (page: string) => void
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar border-r border-sidebar-border',
        'transition-all duration-200 ease-in-out shrink-0',
        collapsed ? 'w-[64px]' : 'w-[220px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-sidebar-border',
        collapsed && 'justify-center px-0'
      )}>
        <img
          src="https://acdn-us.mitiendanube.com/stores/002/468/927/themes/common/ogimage-574228055-1717697925-883faf78a57d288d6c494ab9a0897ca01717697925.jpg?0"
          alt="Tórrida"
          className="w-8 h-8 rounded-lg object-cover shrink-0"
        />
        {!collapsed && (
          <span className="font-bold text-[16px] text-primary tracking-tight">
            Tórrida
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={cn(
              'nav-item w-full',
              currentPage === id && 'active',
              collapsed && 'justify-center px-0 w-full'
            )}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 pb-4 border-t border-sidebar-border pt-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'nav-item w-full opacity-40 hover:opacity-70',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed
            ? <ChevronRight size={16} />
            : <><ChevronLeft size={16} /><span className="text-[13px]">Colapsar</span></>
          }
        </button>
      </div>
    </aside>
  )
}