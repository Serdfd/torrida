import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'w-4 h-4 border-[2px]',
  md: 'w-6 h-6 border-[2.5px]',
  lg: 'w-10 h-10 border-[3px]'
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'rounded-full border-accent-DEFAULT border-t-transparent animate-spin',
        SIZE_CLASSES[size],
        className
      )}
    />
  )
}

// ── Spinner de página completa ─────────────────────────────
export function FullPageSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-primary-muted">Cargando…</p>
      </div>
    </div>
  )
}

// ── Spinner inline con texto ───────────────────────────────
interface SpinnerTextProps {
  text?: string
}

export function SpinnerText({ text = 'Cargando…' }: SpinnerTextProps) {
  return (
    <div className="flex items-center gap-2 text-primary-muted text-sm">
      <Spinner size="sm" />
      <span>{text}</span>
    </div>
  )
}