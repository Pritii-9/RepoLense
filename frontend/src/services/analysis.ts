import { api } from '@/services/api'
import type { AnalysisResponse, SubmitAnalysisPayload } from '@/types/api'

export async function submitAnalysis(payload: SubmitAnalysisPayload) {
  const response = await api.post<AnalysisResponse>('/analysis/submit', payload)
  return response.data
}

export async function getAnalysisStatus(analysisId: string) {
  const response = await api.get<AnalysisResponse>(`/analysis/${analysisId}/status`)
  return response.data
}
