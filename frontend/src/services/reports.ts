import axios from 'axios'

import { api } from '@/services/api'
import type { ExportResponse, ReportDownloadUrlResponse, ReportResponse } from '@/types/api'

export async function getReportDownloadUrl(reportId: string) {
  const response = await api.get<ReportDownloadUrlResponse>(`/reports/${reportId}/download-url`)
  return response.data
}

export async function triggerReportDownload(report: ReportResponse) {
  const { url } = await getReportDownloadUrl(report.id)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = report.file_name
  anchor.rel = 'noreferrer'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

export async function fetchReportText(reportId: string) {
  const { url } = await getReportDownloadUrl(reportId)
  const response = await axios.get<string>(url, {
    responseType: 'text',
    transformResponse: [(value) => value as string],
  })
  return response.data
}

export async function exportAnalysisMetrics(analysisId: string, format: 'csv' | 'json') {
  const response = await api.post<ExportResponse>(`/reports/${analysisId}/export`, { format })
  return response.data
}
