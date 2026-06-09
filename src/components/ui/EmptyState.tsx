import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({
  icon: Icon,
  title = 'Sin resultados',
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 px-6 text-center',
        className
      )}
    >
      {/* Icono */}
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-accent-light flex items-center
                        justify-center text-accent-DEFAULT">
          <Icon size={26} strokeWidth={1.5} />
        </div>
      )}

      {/* Texto */}
      <div className="flex flex-col gap-1.5 max-w-xs">
        <p className="text-[15px] font-semibold text-primary-DEFAULT">
          {title}
        </p>
        {description && (
          <p className="text-[13.5px] text-primary-muted leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Acción */}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  )
}