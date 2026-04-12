import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

interface MetricTileProps {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
  tone?: 'default' | 'warm' | 'cool'
}

const toneClasses = {
  default: 'bg-white',
  warm: 'bg-accent-50',
  cool: 'bg-primary-50',
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
        'surface-border rounded-panel p-4 shadow-soft transition hover:-translate-y-0.5',
        toneClasses[tone],
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
