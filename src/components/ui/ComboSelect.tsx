import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboOption {
  value: string
  label: string
}

interface ComboSelectProps {
  value:        string
  onChange:     (value: string) => void
  options:      ComboOption[]
  placeholder?: string
  disabled?:    boolean
  className?:   string
  clearable?:   boolean
}

const MAX_VISIBLE = 200

export default function ComboSelect({
  value,
  onChange,
  options,
  placeholder = '— Seleccionar —',
  disabled = false,
  className,
  clearable = true,
}: ComboSelectProps) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const [style,  setStyle]  = useState<React.CSSProperties>({})

  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef    = useRef<HTMLInputElement>(null)
  const dropdownRef  = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  // Posicionar el dropdown usando fixed (evita clipping en modales con overflow)
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const viewportH = window.innerHeight
    const dropH = 280 // aprox max-height del dropdown
    const spaceBelow = viewportH - rect.bottom
    const openUp = spaceBelow < dropH && rect.top > dropH

    setStyle({
      position: 'fixed',
      left:     rect.left,
      width:    rect.width,
      zIndex:   9999,
      ...(openUp
        ? { bottom: viewportH - rect.top + 4 }
        : { top:    rect.bottom + 4 }),
    })
  }, [open])

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return
    function handleDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return
      setOpen(false)
      setSearch('')
    }
    document.addEventListener('mousedown', handleDown)
    return () => document.removeEventListener('mousedown', handleDown)
  }, [open])

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setSearch('') }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function handleOpen() {
    if (disabled) return
    setOpen(v => !v)
    if (!open) setTimeout(() => searchRef.current?.focus(), 30)
  }

  function handleSelect(opt: ComboOption) {
    onChange(opt.value)
    setOpen(false)
    setSearch('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setSearch('')
  }

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).slice(0, MAX_VISIBLE)
    : options.slice(0, MAX_VISIBLE)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          'input w-full text-left flex items-center justify-between gap-2',
          'cursor-pointer select-none',
          disabled && 'opacity-50 cursor-not-allowed',
          open && 'border-accent/50'
        )}
      >
        <span className={cn('flex-1 truncate', !selected && 'text-primary-muted')}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {clearable && selected && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-white/10 text-primary-muted hover:text-primary transition-colors"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={cn(
              'text-primary-muted transition-transform duration-150',
              open && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Dropdown via portal */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={style}
          className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden
                     animate-fade-in"
        >
          {/* Buscador */}
          <div className="p-2 border-b border-border">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="input h-8 text-base"
            />
          </div>

          {/* Lista */}
          <ul className="overflow-y-auto max-h-[220px]">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-primary-muted">
                Sin resultados
              </li>
            ) : (
              filtered.map(opt => (
                <li
                  key={opt.value}
                  onMouseDown={() => handleSelect(opt)}
                  className={cn(
                    'px-3 py-2 cursor-pointer text-base transition-colors',
                    opt.value === value
                      ? 'bg-accent-light text-accent font-semibold'
                      : 'text-primary hover:bg-white/[0.04]'
                  )}
                >
                  {opt.label}
                </li>
              ))
            )}
            {options.length > MAX_VISIBLE && !search && (
              <li className="px-3 py-2 text-center text-xs text-primary-muted border-t border-border">
                Escribe para filtrar los {options.length} resultados
              </li>
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
}
