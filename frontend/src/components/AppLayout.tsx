import { Link, NavLink, Outlet } from 'react-router-dom'

import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/utils/constants'
import { cn } from '@/utils/cn'

const navItems = [
  { label: 'Dashboard', to: ROUTES.dashboard },
  { label: 'Reports', to: ROUTES.reports },
]

export function AppLayout() {
  const { logout, user } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="border-b border-black/5 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to={ROUTES.dashboard} className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-panel bg-primary-600 text-lg font-bold text-white">
              R
            </span>
            <div>
              <p className="text-base font-semibold text-ink">RepoLens</p>
              <p className="text-sm text-slate-500">Repository analysis cockpit</p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.dashboard}
                className={({ isActive }) =>
                  cn(
                    'focus-ring rounded-panel px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-primary-50 text-primary-800' : 'text-slate-600 hover:bg-black/5',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <p className="max-w-48 truncate text-sm font-medium text-ink">
                {user?.full_name ?? user?.email}
              </p>
              <p className="max-w-48 truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
