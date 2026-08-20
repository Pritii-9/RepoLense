import type { AnalysisStatus } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatAnalysisStatus } from '@/utils/formatters'

const statusStyles: Record<AnalysisStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  running: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  failed: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
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
