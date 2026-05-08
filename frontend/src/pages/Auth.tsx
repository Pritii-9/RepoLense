import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { verifyEmail, resendVerification } from '@/services/auth'
import { getErrorMessage } from '@/services/api'
import { AUTH_ARTWORK_URL, ROUTES } from '@/utils/constants'

type AuthMode = 'login' | 'register' | 'enter-code'

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
          className="w-11 h-14 text-center text-2xl font-bold border-2 rounded-lg transition-all outline-none
            border-slate-200 bg-white text-slate-900 
            focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100
            disabled:opacity-50 disabled:cursor-not-allowed
            caret-transparent"
          style={{ fontFamily: 'monospace' }}
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

  // Countdown timer for resend cooldown
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

  // ── Submit (login / register) ──────────────────────────────────────
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
        // Register
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
          description: 'Enter the 6-digit code we sent to your email.',
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

  // ── Verify OTP ────────────────────────────────────────────────────
  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) {
      setOtpError('Please enter all 6 digits.')
      return
    }
    setOtpError(null)
    try {
      setIsVerifying(true)
      await verifyEmail({ email: pendingEmail, code: otpCode })
      // Auto-login using stored credentials
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

  // ── Resend OTP ────────────────────────────────────────────────────
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

  return (
    <div className="min-h-screen bg-mist">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex items-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-xl rounded-panel bg-white p-6 shadow-soft sm:p-8">
            <p className="text-sm font-medium uppercase tracking-wide text-primary-700">
              RepoLens
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">
              Keep repository analysis moving without babysitting the queue.
            </h1>

            {/* ── Tab switcher (only for login/register) ── */}
            {mode !== 'enter-code' && (
              <div className="mt-6 inline-flex rounded-panel bg-mist p-1">
                {(['login', 'register'] as AuthMode[]).map((nextMode) => (
                  <button
                    key={nextMode}
                    type="button"
                    className={`focus-ring rounded-panel px-4 py-2 text-sm font-medium transition ${
                      mode === nextMode
                        ? 'bg-white text-ink shadow-soft'
                        : 'text-slate-500 hover:text-ink'
                    }`}
                    onClick={() => { setMode(nextMode); setAuthError(null) }}
                  >
                    {nextMode === 'login' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>
            )}

            {/* ── Login / Register form ── */}
            {(mode === 'login' || mode === 'register') && (
              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                {mode === 'register' && (
                  <Input
                    label="Full name"
                    value={fields.fullName}
                    onChange={handleChange('fullName')}
                    error={errors.fullName}
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                  />
                )}

                <Input
                  label="Email"
                  type="email"
                  value={fields.email}
                  onChange={handleChange('email')}
                  error={errors.email}
                  autoComplete="email"
                  placeholder="team@repolens.dev"
                />

                <Input
                  label="Password"
                  type="password"
                  value={fields.password}
                  onChange={handleChange('password')}
                  error={errors.password}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="At least 8 characters"
                />

                {authError && (
                  <div
                    className="rounded-panel border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    role="alert"
                  >
                    {authError}
                  </div>
                )}

                <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
                  {mode === 'login' ? 'Enter dashboard' : 'Create account'}
                </Button>
              </form>
            )}

            {/* ── Enter OTP code ── */}
            {mode === 'enter-code' && (
              <div className="mt-6 space-y-6">
                {/* Header */}
                <div className="rounded-panel border border-indigo-100 bg-indigo-50 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">📬</span>
                    <h3 className="font-semibold text-ink">Check your email</h3>
                  </div>
                  <p className="text-sm text-slate-600">
                    We sent a 6-digit code to{' '}
                    <strong className="text-ink">{pendingEmail}</strong>.
                    Enter it below to verify your account.
                  </p>
                </div>

                {/* OTP digit boxes */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700 text-center">
                    Verification code
                  </label>
                  <OtpInput
                    value={otpCode}
                    onChange={(val) => { setOtpCode(val); setOtpError(null) }}
                    disabled={isVerifying}
                  />
                  {otpError && (
                    <p className="text-center text-sm text-rose-600 font-medium" role="alert">
                      {otpError}
                    </p>
                  )}
                </div>

                <Button
                  fullWidth
                  size="lg"
                  isLoading={isVerifying}
                  onClick={handleVerifyCode}
                  disabled={otpCode.length !== 6}
                >
                  Verify email
                </Button>

                {/* Resend + back */}
                <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
                  <span>Didn't receive the code?</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isResending}
                    className="font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : isResending
                      ? 'Sending…'
                      : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setOtpCode(''); setOtpError(null) }}
                    className="text-slate-400 hover:text-slate-600 transition"
                  >
                    ← Back to sign in
                  </button>
                </div>
              </div>
            )}

            <p className="mt-4 text-sm text-slate-500">
              This frontend restores the bearer token from the browser session until the
              backend issues httpOnly cookies.
            </p>
          </div>
        </section>

        <aside className="hidden min-h-screen lg:block">
          <div className="relative h-full">
            <img
              src={AUTH_ARTWORK_URL}
              alt="Developer workstation with code on screen"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white">
              <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
                Real-time pipeline
              </p>
              <p className="mt-3 max-w-md text-3xl font-semibold">
                Submit a repository, watch it progress, then pull reports from secure
                presigned links.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
