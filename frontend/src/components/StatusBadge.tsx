import type { AnalysisStatus } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatAnalysisStatus } from '@/utils/formatters'

const statusStyles: Record<AnalysisStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-500/30',
  running: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:ring-teal-500/30',
  completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30',
  failed: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-500/30',
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
