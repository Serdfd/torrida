import React from 'react'
import Modal from './Modal'


interface ModalContainerProps {
  open:     boolean
  onClose:  () => void
  children: React.ReactNode
  size?:    'sm' | 'md' | 'lg' | 'xl'
}

export default function ModalContainer({ open, onClose, children, size }: ModalContainerProps) {
  if (!open || !children) return null
  return <Modal onClose={onClose} size={size}>{children}</Modal>
}
