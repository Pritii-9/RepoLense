import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ChevronDown, User, Settings, ShieldCheck, LogOut, Layers } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { ThemeToggle } from '@/components/ThemeToggle'

const navItems = [
  { label: 'Dashboard', to: ROUTES.dashboard },
  { label: 'Reports', to: ROUTES.reports },
  { label: 'Organizations', to: '/organizations' },
  { label: 'Telemetry', to: '/telemetry' },
]

export function AppLayout() {
  const { logout, user } = useAuth()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const userInitial = (user?.full_name || user?.email || 'A').charAt(0).toUpperCase()
  const userName = user?.full_name || user?.email?.split('@')[0] || 'User'
  const userEmail = user?.email || 'user@repolens.io'

  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false)

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-200">
      {/* Render.com Style Top Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 shadow-xs transition-colors duration-200">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          
          {/* Left Side: Brand Logo and Name */}
          <Link to={ROUTES.dashboard} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:bg-indigo-500 transition-colors">
              <Layers className="w-4 h-4" />
            </div>
            <p className="text-base font-bold tracking-tight text-zinc-900 dark:text-white font-mono">
              Repo<span className="text-indigo-600 dark:text-indigo-400">Lens</span>
            </p>
          </Link>

          {/* Center: Primary Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800/60">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.dashboard}
                className={({ isActive }) =>
                  cn(
                    'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border border-transparent',
                    isActive
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-700/60 font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right Side: Theme Toggle & User Profile Dropdown */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            {/* Profile Dropdown Container */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2.5 p-1 pr-3 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group focus:outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-xs cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-xs">
                  {userInitial}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors max-w-[120px] truncate">
                    {userName}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">
                    {userEmail}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 text-zinc-400 transition-transform duration-200',
                    isProfileOpen && 'rotate-180 text-indigo-500'
                  )}
                />
              </button>

              {/* Render-Style Popover Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl py-2 z-50 origin-top-right overflow-hidden animate-slide-down">
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{userName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">{userEmail}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-medium border border-zinc-200 dark:border-zinc-700/60">
                      <ShieldCheck className="w-3 h-3 text-indigo-500" /> Active Workspace
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center gap-2.5 transition-colors group font-medium"
                    >
                      <User className="w-4 h-4 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                      Account Profile
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center gap-2.5 transition-colors group font-medium"
                    >
                      <Settings className="w-4 h-4 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                      Workspace Settings
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false)
                        setIsSignOutModalOpen(true)
                      }}
                      className="w-full px-4 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Content Wrapper */}
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex-1">
        <Outlet />
      </main>

      {/* Sign Out Confirmation Modal */}
      {isSignOutModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity animate-fade-in"
          onClick={() => setIsSignOutModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                  Sign Out Confirmation
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Ending your active session
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to sign out? You will need to authenticate again to access your repository dashboards and reports.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSignOutModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignOutModalOpen(false)
                  logout()
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
