import { AlertTriangle, Trash2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

const VARIANT_CONFIG = {
  danger: {
    icon: Trash2,
    iconClass: 'text-danger bg-danger/10',
    confirmClass: 'btn-danger'
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-warning bg-warning/10',
    confirmClass: 'btn bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20'
  },
  info: {
    icon: Info,
    iconClass: 'text-accent bg-accent-light',
    confirmClass: 'btn-primary'
  }
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false
}: ConfirmDialogProps) {
  const config = VARIANT_CONFIG[variant]
  const Icon = config.icon

  return (
    <div className="flex flex-col gap-5">
      {/* Icono + título */}
      <div className="flex items-start gap-4">
        <div className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
          config.iconClass
        )}>
          <Icon size={20} />
        </div>

        <div className="flex flex-col gap-1 pt-0.5">
          <p className="text-[15px] font-bold text-primary">
            {title}
          </p>
          {description && (
            <p className="text-[13.5px] text-primary-muted leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          onClick={onCancel}
          disabled={loading}
          className="btn-ghost disabled:opacity-50"
        >
          {cancelLabel}
        </button>

        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            config.confirmClass,
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent
                               rounded-full animate-spin" />
              Procesando…
            </span>
          ) : confirmLabel}
        </button>
      </div>
    </div>
  )
}