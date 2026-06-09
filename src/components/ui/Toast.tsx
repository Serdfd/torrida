import { useAppStore } from '@/store/useAppStore'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToastType } from '@/types'

const TOAST_CONFIG: Record<ToastType, {
  icon: React.ReactNode
  classes: string
}> = {
  success: {
    icon: <CheckCircle size={16} />,
    classes: 'bg-success/10 border-success/30 text-success'
  },
  error: {
    icon: <XCircle size={16} />,
    classes: 'bg-danger/10 border-danger/30 text-danger'
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    classes: 'bg-warning/10 border-warning/30 text-warning'
  },
  info: {
    icon: <Info size={16} />,
    classes: 'bg-accent-light border-accent-DEFAULT/30 text-accent-DEFAULT'
  }
}

export default function Toast() {
  const { toasts, removeToast } = useAppStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => {
        const config = TOAST_CONFIG[toast.type]
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border',
              'shadow-lg min-w-[280px] max-w-[380px]',
              'animate-slide-in',
              config.classes
            )}
          >
            {/* Icono */}
            <span className="shrink-0">
              {config.icon}
            </span>

            {/* Mensaje */}
            <p className="text-[13.5px] font-medium flex-1 leading-snug">
              {toast.message}
            </p>

            {/* Cerrar */}
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}