import { api } from '@/services/api'
import type { AiInsightResponse } from '@/types/api'

export async function getAiInsights(analysisId: string) {
  const response = await api.get<AiInsightResponse[]>(`/ai-insights/${analysisId}`)
  return response.data
}
