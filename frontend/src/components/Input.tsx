import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, hint, id, label, ...props },
  ref,
) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <label className="block space-y-2" htmlFor={inputId}>
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'focus-ring h-11 w-full rounded-panel border bg-white px-3 text-sm text-ink placeholder:text-slate-400',
          error ? 'border-rose-400' : 'border-black/10',
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
        }
        {...props}
      />
      {error ? (
        <span id={`${inputId}-error`} className="text-sm text-rose-600">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="text-sm text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  )
})
