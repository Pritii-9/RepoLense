import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

interface MetricTileProps {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
  tone?: 'default' | 'warm' | 'cool'
}

export function MetricTile({
  hint,
  icon,
  label,
  tone = 'default',
  value,
}: MetricTileProps) {
  return (
    <div
      className={cn(
        'glass-panel rounded-panel p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
        tone === 'warm' && 'bg-accent-50/70',
        tone === 'cool' && 'bg-primary-50/70',
        tone === 'default' && 'bg-white/70',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
        </div>
        {icon ? <div className="text-primary-700">{icon}</div> : null}
      </div>
      {hint ? <p className="mt-3 text-sm text-slate-500">{hint}</p> : null}
    </div>
  )
}
