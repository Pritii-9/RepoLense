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
    <div className="min-h-screen flex flex-col">
      {/* Sticky Glass Header */}
      <header className="sticky top-0 z-50 border-b border-white/40 bg-white/60 backdrop-blur-xl shadow-sm transition-all duration-300">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to={ROUTES.dashboard} className="flex items-center gap-3 group">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-lg font-bold text-white shadow-glow transition-transform group-hover:scale-105">
              R
            </span>
            <div>
              <p className="text-base font-bold text-ink tracking-tight">RepoLens</p>
              <p className="text-xs text-slate-500 font-medium">Repository analysis cockpit</p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-1 bg-white/50 p-1 rounded-pill border border-white/60 shadow-inner">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.dashboard}
                className={({ isActive }) =>
                  cn(
                    'focus-ring rounded-pill px-4 py-1.5 text-sm font-semibold transition-all duration-300',
                    isActive ? 'bg-primary-600 text-white shadow-md' : 'text-slate-600 hover:text-ink hover:bg-black/5',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-4 bg-white/50 p-1.5 pr-2 rounded-full border border-white/60 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="hidden sm:flex items-center gap-3 pl-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white font-bold shadow-sm text-sm">
                {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="text-left pr-2">
                <p className="max-w-48 truncate text-sm font-bold text-ink leading-tight">
                  {user?.full_name ?? user?.email?.split('@')[0]}
                </p>
                <p className="max-w-48 truncate text-[11px] text-slate-500 font-medium">{user?.email}</p>
              </div>
            </div>
            <div className="h-6 w-[1px] bg-black/10 hidden sm:block"></div>
            <button
              onClick={() => logout()}
              className="flex items-center justify-center gap-2 h-8 px-3 rounded-full text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              title="Sign out"
            >
              <span className="hidden sm:inline">Sign out</span>
              <svg xmlns="http://www.w3.org/-2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 flex-1 animate-fade-in">
        <Outlet />
      </main>
    </div>
  )
}
