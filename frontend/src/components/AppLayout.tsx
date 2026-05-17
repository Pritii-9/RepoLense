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
            <Link
              to="/settings"
              className="flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </Link>
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
