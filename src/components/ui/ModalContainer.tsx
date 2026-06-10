import React from 'react'
import Modal from './Modal'

interface ModalContainerProps {
  open:     boolean
  onClose:  () => void
  children: React.ReactNode
}

export default function ModalContainer({ open, onClose, children }: ModalContainerProps) {
  if (!open || !children) return null
  return <Modal onClose={onClose}>{children}</Modal>
}
