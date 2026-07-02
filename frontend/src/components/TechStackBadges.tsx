import type { TechStackBadge } from '@/types/api'

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-200/60 dark:border-blue-700/40' },
  cyan:   { bg: 'bg-cyan-50 dark:bg-cyan-900/30',   text: 'text-cyan-700 dark:text-cyan-300',   border: 'border-cyan-200/60 dark:border-cyan-700/40' },
  teal:   { bg: 'bg-teal-50 dark:bg-teal-900/30',   text: 'text-teal-700 dark:text-teal-300',   border: 'border-teal-200/60 dark:border-teal-700/40' },
  green:  { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200/60 dark:border-emerald-700/40' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200/60 dark:border-yellow-700/40' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200/60 dark:border-orange-700/40' },
  red:    { bg: 'bg-rose-50 dark:bg-rose-900/30',   text: 'text-rose-700 dark:text-rose-300',   border: 'border-rose-200/60 dark:border-rose-700/40' },
  pink:   { bg: 'bg-pink-50 dark:bg-pink-900/30',   text: 'text-pink-700 dark:text-pink-300',   border: 'border-pink-200/60 dark:border-pink-700/40' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200/60 dark:border-violet-700/40' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200/60 dark:border-indigo-700/40' },
  slate:  { bg: 'bg-slate-100 dark:bg-slate-700/40', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-200/60 dark:border-slate-600/40' },
}

const FALLBACK = COLOR_MAP['slate']!

function getBadgeClasses(color: string): string {
  const c = COLOR_MAP[color] ?? FALLBACK
  return [
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1',
    'text-xs font-semibold border shadow-sm',
    'transition-transform hover:scale-105',
    c.bg,
    c.text,
    c.border,
  ].join(' ')
}

interface Props {
  badges: TechStackBadge[]
  className?: string
}

export function TechStackBadges({ badges, className = '' }: Props) {
  if (!badges || badges.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badges.map((badge) => (
        <span key={badge.label} className={getBadgeClasses(badge.color)}>
          {badge.label}
        </span>
      ))}
    </div>
  )
}
