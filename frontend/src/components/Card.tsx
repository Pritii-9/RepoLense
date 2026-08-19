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
        'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs transition-colors',
        className,
      )}
    >
      {title || description || action ? (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {title ? <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{title}</h2> : null}
            {description ? (
              <p className="max-w-2xl text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  )
}
