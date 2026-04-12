import type { StoredAnalysis, User } from '@/types/api'
import { ANALYSIS_STORAGE_PREFIX, AUTH_STORAGE_KEY } from '@/utils/constants'

interface AuthSession {
  token: string
  user: User
}

export function readAuthSession() {
  const rawValue = sessionStorage.getItem(AUTH_STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as AuthSession
  } catch {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export function writeAuthSession(session: AuthSession) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
}

export function analysisHistoryKey(userId: string) {
  return `${ANALYSIS_STORAGE_PREFIX}:${userId}`
}

export function readAnalysisHistory(userId: string) {
  const rawValue = localStorage.getItem(analysisHistoryKey(userId))
  if (!rawValue) {
    return [] as StoredAnalysis[]
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredAnalysis[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    localStorage.removeItem(analysisHistoryKey(userId))
    return [] as StoredAnalysis[]
  }
}

export function writeAnalysisHistory(userId: string, analyses: StoredAnalysis[]) {
  localStorage.setItem(analysisHistoryKey(userId), JSON.stringify(analyses))
}
