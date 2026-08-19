import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

interface MetricTileProps {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
}

export function MetricTile({
  hint,
  icon,
  label,
  value,
}: MetricTileProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col justify-between shadow-xs transition-colors',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-mono font-bold text-zinc-900 dark:text-white">{value}</p>
        </div>
        {icon ? <div>{icon}</div> : null}
      </div>
      {hint ? <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  )
}
