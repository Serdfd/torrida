import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  children: React.ReactNode
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}

export default function Modal({
  children,
  onClose,
  title,
  size = 'md'
}: ModalProps) {
  const overlayRef   = useRef<HTMLDivElement>(null)
  const mouseDownRef = useRef<EventTarget | null>(null)

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Solo cerrar si TANTO el mousedown como el mouseup ocurrieron en el overlay
  function handleOverlayMouseDown(e: React.MouseEvent) {
    mouseDownRef.current = e.target
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current && mouseDownRef.current === overlayRef.current) {
      onClose()
    }
    mouseDownRef.current = null
  }

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        className={cn(
          'relative w-full mx-4 bg-card border border-border rounded-2xl',
          'shadow-2xl animate-fade-in',
          SIZE_CLASSES[size]
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4
                          border-b border-border">
            <h2 className="text-lg font-bold text-primary">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-primary-muted
                         hover:text-primary hover:bg-white/5
                         transition-colors"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Close button sin título */}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg
                       text-primary-muted hover:text-primary
                       hover:bg-white/5 transition-colors z-10"
          >
            <X size={17} />
          </button>
        )}

        {/* Contenido */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}