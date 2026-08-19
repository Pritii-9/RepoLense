import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

import { Spinner } from '@/components/Spinner'
import { cn } from '@/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-xs transition-colors cursor-pointer disabled:opacity-50',
  secondary:
    'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer',
  ghost: 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white font-medium transition-colors cursor-pointer disabled:opacity-50',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    fullWidth = false,
    isLoading = false,
    leftIcon,
    size = 'md',
    type = 'button',
    variant = 'primary',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-80',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Spinner className="h-4 w-4" /> : leftIcon}
      <span className="truncate">{children}</span>
    </button>
  )
})
