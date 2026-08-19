import { Button } from './Button'
import { Card } from './Card'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        <Card className="w-full max-w-md p-6 shadow-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{title}</h2>
            <button 
              className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-xl font-light leading-none cursor-pointer" 
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="mt-3">
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{message}</p>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              {cancelText}
            </Button>
            <Button 
              variant="danger" 
              onClick={onConfirm} 
              isLoading={isLoading}
              className="hover:scale-105 transition-all duration-200"
            >
              {confirmText}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
