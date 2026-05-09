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
  info: 'border-primary-200 bg-white/80 text-ink shadow-glass before:bg-primary-500',
  success: 'border-emerald-200 bg-emerald-50/90 text-emerald-900 shadow-glass before:bg-emerald-500',
  error: 'border-rose-200 bg-rose-50/90 text-rose-900 shadow-glass before:bg-rose-500',
}

const toneIcons: Record<ToastTone, JSX.Element> = {
  info: (
    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
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
        className="pointer-events-none fixed right-4 bottom-4 sm:bottom-auto sm:top-4 z-[100] flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-3"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={cn(
              'pointer-events-auto relative overflow-hidden rounded-xl border px-4 py-3 shadow-glass backdrop-blur-xl transition-all animate-slide-up sm:animate-fade-in',
              'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1',
              toneStyles[toast.tone],
            )}
            role="status"
          >
            <div className="flex items-start gap-3 pl-1">
              <div className="flex-shrink-0 mt-0.5">
                {toneIcons[toast.tone]}
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-sm opacity-80 leading-snug">{toast.description}</p>
                ) : null}
              </div>
              <button 
                onClick={() => setToasts(current => current.filter(t => t.id !== toast.id))}
                className="ml-auto flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
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
