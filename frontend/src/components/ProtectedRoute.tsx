import { Navigate, useLocation } from 'react-router-dom'
import type { PropsWithChildren } from 'react'

import { Spinner } from '@/components/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/utils/constants'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation()
  const { isAuthenticated, status } = useAuth()

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 dark:border-white/10 dark:bg-zinc-900 px-4 py-3 shadow-soft">
          <Spinner />
          <span className="text-sm font-medium text-ink dark:text-slate-200">Restoring your workspace...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate replace to={ROUTES.auth} state={{ from: location }} />
  }

  return <>{children}</>
}
