import { useAppStore } from '@/store/useAppStore'
import { monthName } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  dashboard:      'Dashboard',
  ventas:         'Ventas',
  productos:      'Productos',
  produccion:     'Producción',
  inventario:     'Inventario',
  gastos:         'Gastos',
  cierre:         'Cierre Mensual',
  administracion: 'Administración',
  tiendanube:     'Tienda Nube'
}

export default function TopBar() {
  const { activePage, filtroAnio, filtroMes, setFiltroMes } = useAppStore()

  const title = PAGE_TITLES[activePage] ?? 'Tórrida'

  const showMonthFilter = ['dashboard', 'ventas', 'gastos', 'cierre'].includes(activePage)

  function prevMonth() {
    if (filtroMes === 1) {
      setFiltroMes(filtroAnio - 1, 12)
    } else {
      setFiltroMes(filtroAnio, filtroMes - 1)
    }
  }

  function nextMonth() {
    const now = new Date()
    const isCurrentMonth =
      filtroAnio === now.getFullYear() && filtroMes === now.getMonth() + 1
    if (isCurrentMonth) return

    if (filtroMes === 12) {
      setFiltroMes(filtroAnio + 1, 1)
    } else {
      setFiltroMes(filtroAnio, filtroMes + 1)
    }
  }

  const isCurrentMonth = (() => {
    const now = new Date()
    return filtroAnio === now.getFullYear() && filtroMes === now.getMonth() + 1
  })()

  return (
    <header className="h-14 flex items-center justify-between px-6
                       border-b border-border bg-bg shrink-0">
      {/* Título */}
      <h1 className="text-[17px] font-bold text-primary-DEFAULT tracking-tight">
        {title}
      </h1>

      {/* Filtro de mes */}
      {showMonthFilter && (
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-primary-muted" />

          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-primary-muted hover:text-primary-DEFAULT
                       hover:bg-card transition-colors"
          >
            <ChevronLeft size={15} />
          </button>

          <span className="text-[14px] font-semibold text-primary-DEFAULT min-w-[140px] text-center">
            {monthName(filtroMes)} {filtroAnio}
          </span>

          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-lg text-primary-muted hover:text-primary-DEFAULT
                       hover:bg-card transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </header>
  )
}