import type { PropsWithChildren, ReactNode } from 'react'

import { cn } from '@/utils/cn'

interface CardProps extends PropsWithChildren {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function Card({ action, children, className, description, title }: CardProps) {
  return (
    <section
      className={cn(
        'glass-panel rounded-panel p-5 sm:p-6',
        className,
      )}
    >
      {title || description || action ? (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {title ? <h2 className="text-lg font-semibold text-ink dark:text-slate-100">{title}</h2> : null}
            {description ? (
              <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  )
}
