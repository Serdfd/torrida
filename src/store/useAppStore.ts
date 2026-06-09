/**
 * useAppStore.ts
 * Store global con Zustand.
 * Maneja: filtro de período, sidebar, modal y toast.
 */

import { create }       from 'zustand'
import { persist }      from 'zustand/middleware'
import React            from 'react'
import type { ToastType } from '@/types'

// ── Tipos internos ─────────────────────────────────────────────────────────

interface ModalState {
  open:    boolean
  content: React.ReactNode | null
}

interface ToastState {
  visible:  boolean
  message:  string
  type:     ToastType
  timeoutId?: ReturnType<typeof setTimeout>
}

interface AppStore {
  // Filtro período
  filtroAnio:  number
  filtroMes:   number
  setFiltro:   (anio: number, mes: number) => void

  // Sidebar
  sidebarOpen:    boolean
  toggleSidebar:  () => void
  setSidebarOpen: (open: boolean) => void

  // Modal
  modal:      ModalState
  openModal:  (content: React.ReactNode) => void
  closeModal: () => void

  // Toast
  toast:        ToastState
  showToast:    (message: string, type: ToastType) => void
  dismissToast: () => void
}

// ── Valores iniciales ──────────────────────────────────────────────────────

function getNow() {
  const now = new Date()
  return { anio: now.getFullYear(), mes: now.getMonth() + 1 }
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({

      // ── Filtro período ───────────────────────────────────────────────────
      filtroAnio: getNow().anio,
      filtroMes:  getNow().mes,
      setFiltro(anio, mes) {
        set({ filtroAnio: anio, filtroMes: mes })
      },

      // ── Sidebar ──────────────────────────────────────────────────────────
      sidebarOpen: true,
      toggleSidebar() {
        set(s => ({ sidebarOpen: !s.sidebarOpen }))
      },
      setSidebarOpen(open) {
        set({ sidebarOpen: open })
      },

      // ── Modal ────────────────────────────────────────────────────────────
      modal: { open: false, content: null },
      openModal(content) {
        set({ modal: { open: true, content } })
      },
      closeModal() {
        set({ modal: { open: false, content: null } })
      },

      // ── Toast ────────────────────────────────────────────────────────────
      toast: {
        visible:  false,
        message:  '',
        type:     'info'
      },
      showToast(message, type) {
        // Cancelar timeout anterior si existe
        const prev = get().toast.timeoutId
        if (prev) clearTimeout(prev)

        const timeoutId = setTimeout(() => {
          set(s => ({
            toast: { ...s.toast, visible: false }
          }))
        }, 3500)

        set({
          toast: { visible: true, message, type, timeoutId }
        })
      },
      dismissToast() {
        const prev = get().toast.timeoutId
        if (prev) clearTimeout(prev)
        set(s => ({
          toast: { ...s.toast, visible: false }
        }))
      }
    }),

    {
      name:    'torrida-app-store',
      partialize: (state) => ({
        // Solo persistir filtro y sidebar, NO modal ni toast
        filtroAnio:  state.filtroAnio,
        filtroMes:   state.filtroMes,
        sidebarOpen: state.sidebarOpen
      })
    }
  )
)

// ── Hooks de conveniencia ──────────────────────────────────────────────────

/**
 * Hook para el toast con métodos tipados.
 * Uso: const toast = useToast()
 *      toast.success('Guardado!')
 */
export function useToast() {
  const showToast = useAppStore(s => s.showToast)

  return {
    success: (msg: string) => showToast(msg, 'success'),
    error:   (msg: string) => showToast(msg, 'error'),
    warning: (msg: string) => showToast(msg, 'warning'),
    info:    (msg: string) => showToast(msg, 'info')
  }
}

/**
 * Hook para el modal.
 * Uso: const { openModal, closeModal } = useModal()
 */
export function useModal() {
  const openModal  = useAppStore(s => s.openModal)
  const closeModal = useAppStore(s => s.closeModal)
  return { openModal, closeModal }
}

/**
 * Hook para el filtro de período.
 * Uso: const { filtroAnio, filtroMes, setFiltro } = useFiltro()
 */
export function useFiltro() {
  const filtroAnio = useAppStore(s => s.filtroAnio)
  const filtroMes  = useAppStore(s => s.filtroMes)
  const setFiltro  = useAppStore(s => s.setFiltro)
  return { filtroAnio, filtroMes, setFiltro }
}