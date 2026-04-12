import type { AnalysisStatus, ReportType } from '@/types/api'
import { STATUS_LABELS } from '@/utils/constants'

const compactFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

const integerFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
})

export function formatNumber(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0'
  }

  return compactFormatter.format(value)
}

export function formatInteger(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0'
  }

  return integerFormatter.format(value)
}

export function formatPercent(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0%'
  }

  return `${Math.round(value)}%`
}

export function formatAnalysisStatus(status: AnalysisStatus) {
  return STATUS_LABELS[status] ?? status
}

export function formatReportType(reportType: ReportType) {
  return reportType.toUpperCase()
}

export function truncateMiddle(value: string, maxLength = 48) {
  if (value.length <= maxLength) {
    return value
  }

  const sideLength = Math.floor((maxLength - 3) / 2)
  return `${value.slice(0, sideLength)}...${value.slice(-sideLength)}`
}

export function formatBytes(value?: number | null) {
  if (value === undefined || value === null || value <= 0) {
    return 'Not provided'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
