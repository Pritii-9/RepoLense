import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import { cn } from '@/utils/cn'

type ToastTone = 'info' | 'success' | 'error'

interface ToastItem {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneStyles: Record<ToastTone, string> = {
  info: 'border-teal-200 bg-white text-ink',
  success: 'border-emerald-200 bg-emerald-50 text-ink',
  error: 'border-rose-200 bg-rose-50 text-ink',
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const nextToast = {
      ...toast,
      id: crypto.randomUUID(),
    }

    setToasts((current) => [...current, nextToast])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== nextToast.id))
    }, 4000)
  }, [])

  const value = useMemo(
    () => ({
      pushToast,
    }),
    [pushToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={cn(
              'pointer-events-auto rounded-panel border px-4 py-3 shadow-soft',
              toneStyles[toast.tone],
            )}
            role="status"
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? (
              <p className="mt-1 text-sm text-slate-600">{toast.description}</p>
            ) : null}
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToastContext() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider')
  }

  return context
}
