import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Layers, ShieldCheck, ArrowRight } from 'lucide-react'

import { Input } from '@/components/Input'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { verifyEmail, resendVerification, forgotPassword, resetPassword } from '@/services/auth'
import { getErrorMessage } from '@/services/api'
import { ROUTES } from '@/utils/constants'

type AuthMode = 'login' | 'register' | 'enter-code' | 'forgot-password' | 'reset-password'

interface AuthFields {
  fullName: string
  email: string
  password: string
}

interface AuthErrors {
  fullName?: string
  email?: string
  password?: string
}

const initialFields: AuthFields = {
  fullName: '',
  email: '',
  password: '',
}

function validate(mode: AuthMode, fields: AuthFields) {
  const nextErrors: AuthErrors = {}

  if (mode === 'register' && fields.fullName.trim().length > 255) {
    nextErrors.fullName = 'Full name must be 255 characters or fewer.'
  }

  if (!fields.email.trim()) {
    nextErrors.email = 'Email is required.'
  }

  if (fields.password.length < 8) {
    nextErrors.password = 'Password must be at least 8 characters.'
  }

  return nextErrors
}

// ── OTP Input Component ──────────────────────────────────────────────
interface OtpInputProps {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}

function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  const digits = value.padEnd(6, '').slice(0, 6).split('')

  const handleChange = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = char
    onChange(next.join('').trimEnd())
    if (char && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        onChange(next.join('').trimEnd())
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputsRef.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) inputsRef.current[index + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) {
      onChange(pasted)
      const focusIndex = Math.min(pasted.length, 5)
      inputsRef.current[focusIndex]?.focus()
      e.preventDefault()
    }
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          disabled={disabled}
          className="w-11 h-14 text-center text-2xl font-bold rounded-lg transition-all outline-none
            bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 
            focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
            caret-transparent font-mono shadow-xs"
          aria-label={`Digit ${i + 1}`}
          id={`otp-digit-${i}`}
        />
      ))}
    </div>
  )
}

// ── Main Auth Page ───────────────────────────────────────────────────
export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, login, register } = useAuth()
  const { pushToast } = useToast()
  const [mode, setMode] = useState<AuthMode>('login')
  const [fields, setFields] = useState<AuthFields>(initialFields)
  const [errors, setErrors] = useState<AuthErrors>({})
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // For enter-code mode
  const [pendingEmail, setPendingEmail] = useState<string>('')
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const destination = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname ?? ROUTES.dashboard
  }, [location.state])

  useEffect(() => {
    if (isAuthenticated) {
      navigate(destination, { replace: true })
    }
  }, [destination, isAuthenticated, navigate])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleChange =
    (field: keyof AuthFields) => (event: ChangeEvent<HTMLInputElement>) => {
      setFields((current) => ({
        ...current,
        [field]: event.target.value,
      }))
      setErrors((current) => ({
        ...current,
        [field]: undefined,
      }))
      setAuthError(null)
    }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate(mode, fields)
    setErrors(nextErrors)
    setAuthError(null)

    if (Object.keys(nextErrors).length > 0) return

    try {
      setIsSubmitting(true)
      if (mode === 'login') {
        await login({
          email: fields.email.trim(),
          password: fields.password,
        })
        pushToast({
          title: 'Welcome back.',
          description: 'You can start submitting repositories right away.',
          tone: 'success',
        })
        navigate(destination, { replace: true })
      } else {
        await register({
          email: fields.email.trim(),
          password: fields.password,
          full_name: fields.fullName.trim() || undefined,
        })
        setPendingEmail(fields.email.trim().toLowerCase())
        setOtpCode('')
        setOtpError(null)
        setMode('enter-code')
        pushToast({
          title: 'Account created!',
          description: 'Please check your email for the verification code.',
          tone: 'success',
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.'
      const friendlyMessage =
        mode === 'register' && message === 'An account with this email already exists.'
          ? 'That email is already registered. Sign in instead, or use a different email.'
          : message
      setAuthError(friendlyMessage)
      pushToast({
        title: mode === 'login' ? 'Sign-in failed.' : 'Registration failed.',
        description: friendlyMessage,
        tone: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) {
      setOtpError('Please enter all 6 digits.')
      return
    }
    setOtpError(null)
    try {
      setIsVerifying(true)
      await verifyEmail({ email: pendingEmail, code: otpCode })
      await login({
        email: pendingEmail,
        password: fields.password,
      })
      pushToast({
        title: 'Email verified!',
        description: 'Welcome to RepoLens.',
        tone: 'success',
      })
    } catch (error) {
      const message = getErrorMessage(error)
      setOtpError(message)
      pushToast({ title: 'Verification failed', description: message, tone: 'error' })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    try {
      setIsResending(true)
      await resendVerification({ email: pendingEmail })
      setResendCooldown(60)
      setOtpCode('')
      setOtpError(null)
      pushToast({
        title: 'Code resent',
        description: 'A new 6-digit code has been sent to your email.',
        tone: 'success',
      })
    } catch (error) {
      const message = getErrorMessage(error)
      pushToast({ title: 'Resend failed', description: message, tone: 'error' })
    } finally {
      setIsResending(false)
    }
  }

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!fields.email.trim()) {
      setErrors({ email: 'Email is required.' })
      return
    }
    try {
      setIsSubmitting(true)
      await forgotPassword({ email: fields.email.trim() })
      setPendingEmail(fields.email.trim().toLowerCase())
      setOtpCode('')
      setOtpError(null)
      setMode('reset-password')
      pushToast({
        title: 'Reset code sent',
        description: 'Enter the code and your new password.',
        tone: 'success',
      })
    } catch (error) {
      const message = getErrorMessage(error)
      setAuthError(message)
      pushToast({ title: 'Request failed', description: message, tone: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (otpCode.length !== 6) {
      setOtpError('Please enter all 6 digits.')
      return
    }
    if (fields.password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters.' })
      return
    }
    try {
      setIsVerifying(true)
      await resetPassword({
        email: pendingEmail,
        code: otpCode,
        new_password: fields.password,
      })
      pushToast({
        title: 'Password reset!',
        description: 'You can now sign in with your new password.',
        tone: 'success',
      })
      setMode('login')
      setFields({ ...initialFields, email: pendingEmail })
    } catch (error) {
      const message = getErrorMessage(error)
      setOtpError(message)
      pushToast({ title: 'Reset failed', description: message, tone: 'error' })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 transition-colors duration-200">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
        
        {/* Left Side: Auth Form Container */}
        <div className="p-8 sm:p-12 flex flex-col justify-center">
          <div className="w-full max-w-sm mx-auto space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-mono">
                Repo<span className="text-indigo-600 dark:text-indigo-400">Lens</span>
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                {mode === 'enter-code' ? 'Verify Your Email' : mode === 'forgot-password' ? 'Reset Password' : mode === 'reset-password' ? 'Set New Password' : mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {mode === 'enter-code' ? 'Security code sent to your email.' : mode === 'forgot-password' ? 'We will send a 6-digit verification code.' : 'Enter your credentials to access RepoLens dashboard.'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            {(mode === 'login' || mode === 'register') && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setAuthError(null); }}
                  className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700/60 shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setAuthError(null); }}
                  className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700/60 shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Register
                </button>
              </div>
            )}

            {/* Form Area */}
            {(mode === 'login' || mode === 'register') && (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {mode === 'register' && (
                  <Input
                    label="Full Name"
                    value={fields.fullName}
                    onChange={handleChange('fullName')}
                    error={errors.fullName}
                    placeholder="Ada Lovelace"
                  />
                )}

                <Input
                  label="Email Address"
                  type="email"
                  value={fields.email}
                  onChange={handleChange('email')}
                  error={errors.email}
                  placeholder="name@company.com"
                />

                <Input
                  label="Password"
                  type="password"
                  value={fields.password}
                  onChange={handleChange('password')}
                  error={errors.password}
                  placeholder="At least 8 characters"
                />

                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setMode('forgot-password'); setAuthError(null); }}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                {authError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <span className="relative bg-white dark:bg-zinc-900 px-3 text-[11px] uppercase font-semibold text-zinc-400">
                    Or continue with
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const envUrl = import.meta.env.PROD ? 'https://beyond-hub-samuel-rubber.trycloudflare.com' : (import.meta.env.VITE_API_URL || 'http://localhost:8000');
                    const baseUrl = envUrl.replace(/\/+$/, '');
                    window.location.href = `${baseUrl}/auth/github/login`;
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-900 dark:text-white font-medium text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xs"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  <span>GitHub OAuth</span>
                </button>
              </form>
            )}

            {/* OTP Code Form */}
            {mode === 'enter-code' && (
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                  Code sent to <span className="font-semibold text-zinc-900 dark:text-white">{pendingEmail}</span>. Enter code below:
                </div>
                <OtpInput value={otpCode} onChange={(val) => { setOtpCode(val); setOtpError(null) }} disabled={isVerifying} />
                {otpError && <p className="text-center text-xs text-rose-500">{otpError}</p>}
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={isVerifying || otpCode.length !== 6}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  Verify Email
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isResending}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>
              </div>
            )}

            {/* Forgot Password Form */}
            {mode === 'forgot-password' && (
              <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
                <Input
                  label="Email Address"
                  type="email"
                  value={fields.email}
                  onChange={handleChange('email')}
                  error={errors.email}
                  placeholder="name@company.com"
                />
                {authError && <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 text-xs">{authError}</div>}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all cursor-pointer"
                >
                  Send Reset Code
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setAuthError(null); }}
                    className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* Reset Password Form */}
            {mode === 'reset-password' && (
              <div className="space-y-4">
                <OtpInput value={otpCode} onChange={(val) => { setOtpCode(val); setOtpError(null) }} disabled={isVerifying} />
                <Input
                  label="New Password"
                  type="password"
                  value={fields.password}
                  onChange={handleChange('password')}
                  error={errors.password}
                  placeholder="At least 8 characters"
                />
                {otpError && <p className="text-center text-xs text-rose-500">{otpError}</p>}
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={isVerifying || otpCode.length !== 6 || fields.password.length < 8}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  Reset Password
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setAuthError(null); }}
                    className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Render Style Illustration Panel */}
        <div className="hidden lg:flex flex-col justify-between p-10 bg-zinc-950 border-l border-zinc-800 text-white relative">
          <div className="space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Enterprise Grade Security</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white leading-snug">
              Automated Codebase AST Analysis & Telemetry Dashboard
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-md">
              Submit your public or private repositories for immediate abstract syntax tree analysis, dependency health scores, and automated exportable reports.
            </p>
          </div>

          <div className="relative z-10 p-6 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span>Pipeline Status: Active</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full w-3/4" />
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Analyzing AST tree & indexing LOC metrics...
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
