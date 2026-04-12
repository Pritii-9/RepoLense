import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import * as analysisService from '@/services/analysis'
import { getErrorMessage } from '@/services/api'
import type { AnalysisResponse, StoredAnalysis, SubmitAnalysisPayload } from '@/types/api'
import { readAnalysisHistory, writeAnalysisHistory } from '@/utils/storage'
import { useAuthContext } from '@/contexts/AuthContext'

interface AnalysisContextValue {
  analyses: StoredAnalysis[]
  isHydrated: boolean
  isSubmitting: boolean
  submitRepository: (payload: SubmitAnalysisPayload) => Promise<StoredAnalysis>
  refreshAnalysis: (analysisId: string) => Promise<StoredAnalysis | null>
  getAnalysisById: (analysisId: string) => StoredAnalysis | undefined
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

function normalizeAnalysis(analysis: AnalysisResponse): StoredAnalysis {
  return {
    ...analysis,
    last_synced_at: new Date().toISOString(),
  }
}

function mergeAnalyses(current: StoredAnalysis[], incoming: StoredAnalysis) {
  const next = current.filter((analysis) => analysis.id !== incoming.id)
  next.unshift(incoming)
  return next.sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  )
}

export function AnalysisProvider({ children }: PropsWithChildren) {
  const { user } = useAuthContext()
  const [analyses, setAnalyses] = useState<StoredAnalysis[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!user) {
      setAnalyses([])
      setIsHydrated(false)
      return
    }

    setAnalyses(readAnalysisHistory(user.id))
    setIsHydrated(true)
  }, [user])

  useEffect(() => {
    if (!user || !isHydrated) {
      return
    }

    writeAnalysisHistory(user.id, analyses)
  }, [analyses, isHydrated, user])

  const upsertAnalysis = useCallback((analysis: AnalysisResponse | StoredAnalysis) => {
    const normalized = normalizeAnalysis(analysis)
    setAnalyses((current) => mergeAnalyses(current, normalized))
    return normalized
  }, [])

  const submitRepository = useCallback(
    async (payload: SubmitAnalysisPayload) => {
      try {
        setIsSubmitting(true)
        const response = await analysisService.submitAnalysis(payload)
        return upsertAnalysis(response)
      } catch (error) {
        throw new Error(getErrorMessage(error))
      } finally {
        setIsSubmitting(false)
      }
    },
    [upsertAnalysis],
  )

  const refreshAnalysis = useCallback(
    async (analysisId: string) => {
      try {
        const response = await analysisService.getAnalysisStatus(analysisId)
        return upsertAnalysis(response)
      } catch (error) {
        throw new Error(getErrorMessage(error))
      }
    },
    [upsertAnalysis],
  )

  const getAnalysisById = useCallback(
    (analysisId: string) => analyses.find((analysis) => analysis.id === analysisId),
    [analyses],
  )

  const value = useMemo(
    () => ({
      analyses,
      isHydrated,
      isSubmitting,
      submitRepository,
      refreshAnalysis,
      getAnalysisById,
    }),
    [analyses, getAnalysisById, isHydrated, isSubmitting, refreshAnalysis, submitRepository],
  )

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysisContext() {
  const context = useContext(AnalysisContext)

  if (!context) {
    throw new Error('useAnalysisContext must be used within AnalysisProvider')
  }

  return context
}
