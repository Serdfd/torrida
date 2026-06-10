import { useAppStore }               from '@/store/useAppStore'
import { monthYearLabel }            from '@/lib/utils'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import type { PageId }               from '@/App'

interface TopBarProps {
  title:       string
  currentPage: PageId
  onNavigate:  (page: PageId) => void
}

const SHOW_MONTH_FILTER: PageId[] = ['dashboard', 'ventas', 'gastos', 'cierre']

export default function TopBar({ title, currentPage }: TopBarProps) {
  const { filtroAnio, filtroMes, setFiltro } = useAppStore()

  const showMonthFilter = SHOW_MONTH_FILTER.includes(currentPage)

  function prevMonth() {
    if (filtroMes === 1) setFiltro(filtroAnio - 1, 12)
    else                 setFiltro(filtroAnio, filtroMes - 1)
  }

  function nextMonth() {
    const now = new Date()
    const isCurrent = filtroAnio === now.getFullYear() && filtroMes === now.getMonth() + 1
    if (isCurrent) return
    if (filtroMes === 12) setFiltro(filtroAnio + 1, 1)
    else                  setFiltro(filtroAnio, filtroMes + 1)
  }

  const isCurrentMonth = (() => {
    const now = new Date()
    return filtroAnio === now.getFullYear() && filtroMes === now.getMonth() + 1
  })()

  return (
    <header className="h-14 flex items-center justify-between px-6
                       border-b border-border bg-bg-surface shrink-0">
      <h1 className="text-[17px] font-bold text-primary tracking-tight">
        {title}
      </h1>

      {showMonthFilter && (
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-primary-muted" />

          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-primary-muted hover:text-primary
                       hover:bg-white/5 transition-colors"
          >
            <ChevronLeft size={15} />
          </button>

          <span className="text-[14px] font-semibold text-primary
                           min-w-[150px] text-center">
            {monthYearLabel(filtroAnio, filtroMes)}
          </span>

          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-lg text-primary-muted hover:text-primary
                       hover:bg-white/5 transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </header>
  )
}