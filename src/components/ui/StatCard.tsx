import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  delta?: number
  deltaLabel?: string
  icon?: LucideIcon
  featured?: boolean
  loading?: boolean
  subtitle?: string
  className?: string
}

export default function StatCard({
  title,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  featured = false,
  loading = false,
  subtitle,
  className
}: StatCardProps) {
  const isPositive = delta !== undefined && delta > 0
  const isNegative = delta !== undefined && delta < 0
  const isNeutral  = delta !== undefined && delta === 0

  const DeltaIcon = isPositive
    ? TrendingUp
    : isNegative
      ? TrendingDown
      : Minus

  const deltaColor = featured
    ? 'text-white/70'
    : isPositive
      ? 'text-success'
      : isNegative
        ? 'text-danger'
        : 'text-primary-muted'

  return (
    <div
      className={cn(
        'kpi-card',
        featured && 'kpi-card featured',
        className
      )}
    >
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-3">
        <p className={cn(
          'text-sm font-semibold uppercase tracking-wider',
          featured ? 'text-white/70' : 'text-primary-muted'
        )}>
          {title}
        </p>

        {Icon && (
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            featured ? 'bg-white/15' : 'bg-accent-light'
          )}>
            <Icon
              size={16}
              className={featured ? 'text-white' : 'text-accent'}
            />
          </div>
        )}
      </div>

      {/* Valor principal */}
      {loading ? (
        <div className="h-8 w-32 bg-white/10 rounded-lg animate-pulse mb-2" />
      ) : (
        <p className={cn(
          'text-3xl font-bold leading-none mb-1',
          featured ? 'text-white' : 'text-primary'
        )}>
          {value}
        </p>
      )}

      {/* Subtítulo */}
      {subtitle && (
        <p className={cn(
          'text-sm mb-2',
          featured ? 'text-white/60' : 'text-primary-muted'
        )}>
          {subtitle}
        </p>
      )}

      {/* Delta */}
      {delta !== undefined && !loading && (
        <div className={cn('flex items-center gap-1 text-sm font-medium', deltaColor)}>
          <DeltaIcon size={13} />
          <span>
            {isNeutral
              ? 'Sin cambio'
              : `${Math.abs(delta).toFixed(1)}% ${deltaLabel ?? 'vs mes anterior'}`
            }
          </span>
        </div>
      )}

      {/* Decoración fondo featured */}
      {featured && (
        <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full
                        bg-white/5 pointer-events-none" />
      )}
    </div>
  )
}