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
        'glass-panel rounded-xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
        'bg-gradient-to-b from-white/[0.03] to-transparent border border-white/10 dark:border-white/10 dark:bg-zinc-900',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-4xl font-mono font-bold text-ink dark:text-white">{value}</p>
        </div>
        {icon ? <div>{icon}</div> : null}
      </div>
      {hint ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  )
}
