import { api } from './api'
import type { SearchResponse } from '@/types/api'

/**
 * Run a semantic similarity search over a completed analysis's vector index.
 *
 * @param analysisId - the analysis to search within
 * @param query      - natural-language search query
 * @param k          - max number of results (1–20, default 6)
 */
export async function searchCode(
  analysisId: string,
  query: string,
  k = 6,
): Promise<SearchResponse> {
  const response = await api.post<SearchResponse>(`/analysis/${analysisId}/search`, {
    query,
    k,
  })
  return response.data
}
