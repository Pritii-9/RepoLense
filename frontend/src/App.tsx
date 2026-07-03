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

const TelemetryDashboard = lazy(async () => {
  const module = await import('@/pages/TelemetryDashboard')
  return { default: module.TelemetryDashboard }
})

const SharedAnalysisPage = lazy(async () => {
  const module = await import('@/pages/SharedAnalysis')
  return { default: module.SharedAnalysisPage }
})

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-panel bg-white px-4 py-3 shadow-soft dark:bg-slate-800 dark:border-slate-700/60 dark:shadow-[0_0_30px_rgba(0,0,0,0.5)]">
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
                <Route path="/oauth-callback" element={<OAuthCallback />} />
                <Route path="/share/:shareToken" element={<SharedAnalysisPage />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path={ROUTES.dashboard} element={<DashboardPage />} />
                  <Route path={ROUTES.analysisDetail} element={<AnalysisDetail />} />
                  <Route path={ROUTES.reports} element={<ReportsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/telemetry" element={<TelemetryDashboard />} />
                </Route>
                <Route path="*" element={<Navigate replace to={ROUTES.dashboard} />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AnalysisProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
