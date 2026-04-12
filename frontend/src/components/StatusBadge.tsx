import type { AnalysisStatus } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatAnalysisStatus } from '@/utils/formatters'

const statusStyles: Record<AnalysisStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  running: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  failed: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}

interface StatusBadgeProps {
  status: AnalysisStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-w-24 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold',
        statusStyles[status],
      )}
    >
      {formatAnalysisStatus(status)}
    </span>
  )
}
