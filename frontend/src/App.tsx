import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Spinner } from '@/components/Spinner'
import { AuthProvider } from '@/contexts/AuthContext'
import { AnalysisProvider } from '@/contexts/AnalysisContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { ROUTES } from '@/utils/constants'

const AuthPage = lazy(async () => {
  const module = await import('@/pages/Auth')
  return { default: module.AuthPage }
})

const OAuthCallback = lazy(async () => {
  const module = await import('@/pages/OAuthCallback')
  return { default: module.OAuthCallback }
})

const DashboardPage = lazy(async () => {
  const module = await import('@/pages/Dashboard')
  return { default: module.DashboardPage }
})

const ModernDashboardPage = lazy(async () => {
  const module = await import('@/pages/ModernDashboardPage')
  return { default: module.ModernDashboardPage }
})

const AnalysisDetail = lazy(async () => {
  const module = await import('@/pages/AnalysisDetail')
  return { default: module.AnalysisDetail }
})

const ReportsPage = lazy(async () => {
  const module = await import('@/pages/Reports')
  return { default: module.ReportsPage }
})

const ProfilePage = lazy(async () => {
  const module = await import('@/pages/Profile')
  return { default: module.ProfilePage }
})

const SettingsPage = lazy(async () => {
  const module = await import('@/pages/Settings')
  return { default: module.SettingsPage }
})

const OrganizationsPage = lazy(async () => {
  const module = await import('@/pages/Organizations')
  return { default: module.OrganizationsPage }
})

const TelemetryDashboard = lazy(async () => {
  const module = await import('@/pages/TelemetryDashboard')
  return { default: module.TelemetryDashboard }
})

const SharedAnalysisPage = lazy(async () => {
  const module = await import('@/pages/SharedAnalysis')
  return { default: module.SharedAnalysisPage }
})

const ComparePage = lazy(async () => {
  const module = await import('@/pages/Compare')
  return { default: module.ComparePage }
})

const HistoryPage = lazy(async () => {
  const module = await import('@/pages/History')
  return { default: module.HistoryPage }
})

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 dark:border-white/10 dark:bg-zinc-900 px-4 py-3 shadow-soft">
        <Spinner />
        <span className="text-sm font-medium text-ink dark:text-slate-200">Loading workspace...</span>
      </div>
    </div>
  )
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AnalysisProvider>
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path={ROUTES.auth} element={<AuthPage />} />
                <Route path="/modern" element={<ModernDashboardPage />} />
                <Route path="/oauth-callback" element={<OAuthCallback />} />
                <Route path="/share/:shareToken" element={<SharedAnalysisPage />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path={ROUTES.dashboard} element={<ModernDashboardPage />} />
                  <Route path="/legacy-dashboard" element={<DashboardPage />} />
                  <Route path="/compare" element={<ComparePage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path={ROUTES.analysisDetail} element={<AnalysisDetail />} />
                  <Route path={ROUTES.reports} element={<ReportsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/organizations" element={<OrganizationsPage />} />
                  <Route path="/telemetry" element={<TelemetryDashboard />} />
                </Route>
                <Route path="*" element={<Navigate replace to="/modern" />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AnalysisProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
