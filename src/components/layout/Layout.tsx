import { useAppStore } from '@/store/useAppStore'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Modal from '@/components/ui/Modal'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { modalOpen, modalContent, closeModal } = useAppStore()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      {/* Sidebar */}
      <Sidebar />

      {/* Contenido principal */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <TopBar />

        {/* Página activa */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>

      {/* Modal global */}
      {modalOpen && modalContent && (
        <Modal onClose={closeModal}>
          {modalContent}
        </Modal>
      )}
    </div>
  )
}