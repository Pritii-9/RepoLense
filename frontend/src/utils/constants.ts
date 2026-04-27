export const APP_NAME = 'RepoLens'
export const POLL_INTERVAL_MS = 5_000
export const AUTH_STORAGE_KEY = 'repolens.auth.session'
export const ANALYSIS_STORAGE_PREFIX = 'repolens.analysis-history'
export const HOTSPOT_LIMIT = 8
export const TEMP_CREDS_KEY = 'repolens.temp.creds'

export const ROUTES = {
  auth: '/auth',
  verify: '/auth/verify',
  dashboard: '/',
  analysisDetail: '/analyses/:analysisId',
  reports: '/reports',
} as const

export const AUTH_ARTWORK_URL =
  'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80'

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
}
