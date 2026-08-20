import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  LayoutDashboard,
  BarChart3,
  Building2,
  Activity,
  Settings,
  PanelLeftClose,
  ChevronDown,
  User,
  ShieldCheck,
  LogOut,
  History
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/utils/constants'
import { cn } from '@/utils/cn'
import { ThemeToggle } from '@/components/ThemeToggle'

const navItems = [
  { label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard },
  { label: 'Analysis Archive', to: '/history', icon: History },
  { label: 'Reports', to: ROUTES.reports, icon: BarChart3 },
  { label: 'Organizations', to: '/organizations', icon: Building2 },
  { label: 'Telemetry', to: '/telemetry', icon: Activity },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export function AppLayout() {
  const { logout, user } = useAuth()
  const location = useLocation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false)
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

  // Derive current page title for the Header bar
  const getCurrentPageTitle = () => {
    const path = location.pathname
    if (path === ROUTES.dashboard || path === '/') return 'Dashboard Overview'
    if (path.startsWith('/history')) return 'Analysis Archive'
    if (path.startsWith('/reports')) return 'Reports & Intelligence'
    if (path.startsWith('/organizations')) return 'Organization Management'
    if (path.startsWith('/telemetry')) return 'System Telemetry'
    if (path.startsWith('/settings')) return 'Workspace Settings'
    if (path.startsWith('/profile')) return 'User Profile'
    if (path.startsWith('/analyses/')) return 'Repository Deep Dive'
    return 'Enterprise Workspace'
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-200">
      {/* ========================================================================= */}
      {/* 1. LEFT COLLAPSIBLE SIDEBAR                                               */}
      {/* ========================================================================= */}
      <aside
        className={cn(
          'h-screen border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between transition-all duration-300 ease-in-out z-40 bg-white dark:bg-zinc-900 shrink-0 shadow-xs select-none',
          isSidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Top Brand Logo & Sleek Corner Toggle Button */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80 shrink-0">
          <Link to={ROUTES.dashboard} className="flex items-center gap-3 group overflow-hidden">
            <img
              src="/icon.svg"
              alt="RepoLens Logo"
              className="w-8 h-8 rounded-lg shadow-xs group-hover:scale-105 transition-transform shrink-0"
            />
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-base font-bold tracking-tight text-zinc-900 dark:text-white font-mono leading-tight">
                  Repo<span className="text-indigo-600 dark:text-indigo-400">Lens</span>
                </p>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono tracking-wider">AST & ENGINE</span>
              </div>
            )}
          </Link>

          {/* Top-Corner Sleek Sidebar Toggle (Linear / VS Code Style) */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <PanelLeftClose className={cn("w-4 h-4 transition-transform duration-200", isSidebarCollapsed && "rotate-180")} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.dashboard}
                title={isSidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 group relative cursor-pointer',
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
                  )
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span className="truncate font-sans text-xs">{item.label}</span>}

                {/* Tooltip on collapsed hover */}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-3 hidden group-hover:flex items-center px-2.5 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold rounded-md shadow-lg whitespace-nowrap z-50 pointer-events-none">
                    {item.label}
                  </div>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Sidebar Bottom: Sign Out Action */}
        <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setIsSignOutModalOpen(true)}
            title={isSidebarCollapsed ? 'Sign Out' : undefined}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer group relative',
              'text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            )}
          >
            <LogOut className="w-4 h-4 shrink-0 text-zinc-500 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
            {!isSidebarCollapsed && <span className="truncate font-sans">Sign Out</span>}

            {isSidebarCollapsed && (
              <div className="absolute left-full ml-3 hidden group-hover:flex items-center px-2.5 py-1 bg-rose-600 text-white text-xs font-semibold rounded-md shadow-lg whitespace-nowrap z-50 pointer-events-none">
                Sign Out
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT RIGHT COLUMN AREA                                         */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 px-6 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-wide font-mono">
              {getCurrentPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />

            {/* User Profile Menu */}
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
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors max-w-[120px] truncate">
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

              {/* Profile Dropdown Popover */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl py-2 z-50 origin-top-right overflow-hidden animate-slide-down">
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/60">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{userName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">{userEmail}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium border border-indigo-200 dark:border-indigo-800/60">
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
        </header>

        {/* Independent Scrollable Viewport Content Area */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-zinc-50 dark:bg-zinc-950 scrollbar-thin">
          <Outlet />
        </main>
      </div>

      {/* Sign Out Modal */}
      {isSignOutModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
            onClick={() => setIsSignOutModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Sign Out Confirmation</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to sign out of your RepoLens workspace account?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSignOutModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignOutModalOpen(false)
                  logout()
                }}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
