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
    'bg-primary-600 text-white shadow-soft hover:bg-primary-700 disabled:bg-primary-300',
  secondary:
    'bg-white text-ink ring-1 ring-black/10 hover:bg-mist disabled:text-slate-400',
  ghost: 'bg-transparent text-ink hover:bg-black/5',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
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
        'focus-ring inline-flex items-center justify-center gap-2 rounded-panel font-medium transition',
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
