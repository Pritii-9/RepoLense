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
        <Card className="w-full max-w-md p-6 shadow-premium hover:shadow-glow transition-all duration-200 bg-white/90 backdrop-blur-md">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            <button 
              className="text-slate-400 hover:text-slate-600 transition-colors text-2xl font-light leading-none" 
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="mt-4">
            <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
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
