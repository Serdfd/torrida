import React from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToastType } from '@/types'

const TOAST_CONFIG: Record<ToastType, { icon: React.ReactNode; classes: string }> = {
  success: {
    icon:    <CheckCircle size={16} />,
    classes: 'bg-success/10 border-success/30 text-success'
  },
  error: {
    icon:    <XCircle size={16} />,
    classes: 'bg-danger/10 border-danger/30 text-danger'
  },
  warning: {
    icon:    <AlertTriangle size={16} />,
    classes: 'bg-warning/10 border-warning/30 text-warning'
  },
  info: {
    icon:    <Info size={16} />,
    classes: 'bg-accent-light border-accent/30 text-accent'
  }
}

interface ToastContainerProps {
  visible:   boolean
  message:   string
  type:      ToastType
  onDismiss: () => void
}

export default function ToastContainer({ visible, message, type, onDismiss }: ToastContainerProps) {
  if (!visible) return null

  const config = TOAST_CONFIG[type]

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl border',
          'shadow-lg min-w-[280px] max-w-[380px]',
          'animate-fade-up',
          config.classes
        )}
      >
        <span className="shrink-0">{config.icon}</span>
        <p className="text-[13.5px] font-medium flex-1 leading-snug">{message}</p>
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
