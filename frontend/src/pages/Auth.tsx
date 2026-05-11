import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { verifyEmail, resendVerification, forgotPassword, resetPassword } from '@/services/auth'
import { getErrorMessage } from '@/services/api'
import { AUTH_ARTWORK_URL, ROUTES } from '@/utils/constants'

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
        // Auto-login after registration
        await login({
          email: fields.email.trim(),
          password: fields.password,
        })
        pushToast({
          title: 'Account created!',
          description: 'Welcome to RepoLens.',
          tone: 'success',
        })
        navigate(destination, { replace: true })
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

  // ── Forgot Password ──────────────────────────────────────────────
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

  // ── Reset Password ────────────────────────────────────────────────
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
    <div className="min-h-screen bg-mist relative overflow-hidden flex items-center justify-center">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary-400/20 blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[10%] -right-[5%] w-[50%] h-[50%] rounded-full bg-accent-400/10 blur-[150px] animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>
      </div>

      <div className="w-full max-w-6xl mx-auto grid min-h-[90vh] lg:grid-cols-[1.1fr_0.9fr] rounded-[24px] overflow-hidden shadow-2xl z-10 m-4 bg-white/40 backdrop-blur-3xl border border-white/50 animate-slide-up">
        <section className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 relative">
          <div className="w-full max-w-md mx-auto relative z-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="inline-flex items-center gap-2 mb-8">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white shadow-glow">
                R
              </span>
              <p className="text-lg font-bold tracking-tight text-ink">
                RepoLens
              </p>
            </div>
            
            <h1 className="text-3xl font-bold text-ink tracking-tight mb-2">
              {mode === 'enter-code' ? 'Verify your email' : mode === 'login' ? 'Welcome back' : 'Create an account'}
            </h1>
            <p className="text-slate-500 mb-8">
              {mode === 'enter-code' ? 'Security is our top priority.' : 'Keep repository analysis moving without babysitting the queue.'}
            </p>

            {/* ── Tab switcher (only for login/register) ── */}
            {mode !== 'enter-code' && (
              <div className="mb-8 inline-flex rounded-pill bg-black/5 p-1 backdrop-blur-sm w-full">
                {(['login', 'register'] as AuthMode[]).map((nextMode) => (
                  <button
                    key={nextMode}
                    type="button"
                    className={`focus-ring w-1/2 rounded-pill px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                      mode === nextMode
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-slate-500 hover:text-ink hover:bg-black/5'
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
              <form className="space-y-5 animate-fade-in" onSubmit={handleSubmit} noValidate>
                {mode === 'register' && (
                  <div className="animate-slide-down">
                    <Input
                      label="Full name"
                      value={fields.fullName}
                      onChange={handleChange('fullName')}
                      error={errors.fullName}
                      autoComplete="name"
                      placeholder="Ada Lovelace"
                    />
                  </div>
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

                {mode === 'login' && (
                  <div className="flex justify-end -mt-2">
                    <button
                      type="button"
                      onClick={() => { setMode('forgot-password'); setAuthError(null); }}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {authError && (
                  <div
                    className="relative overflow-hidden rounded-xl border border-rose-200 bg-rose-50/90 text-rose-900 shadow-glass backdrop-blur-xl px-4 py-3 text-sm animate-fade-in before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-rose-500 flex items-start gap-3 pl-5"
                    role="alert"
                  >
                    <svg className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>{authError}</div>
                  </div>
                )}

                <div className="pt-2">
                  <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
                    {mode === 'login' ? 'Enter dashboard' : 'Create account'}
                  </Button>
                </div>
              </form>
            )}

            {/* ── Enter OTP code ── */}
            {mode === 'enter-code' && (
              <div className="space-y-8 animate-fade-in">
                {/* Header */}
                <div className="rounded-panel border border-primary-100 bg-gradient-to-r from-primary-50/50 to-transparent p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                      <svg xmlns="http://www.w3.org/-2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-ink text-lg">Check your email</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed ml-[52px]">
                    We sent a 6-digit code to{' '}
                    <strong className="text-ink font-medium">{pendingEmail}</strong>.<br/>
                    Enter it below to verify your account.
                  </p>
                </div>

                {/* OTP digit boxes */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700 text-center">
                    Verification code
                  </label>
                  <OtpInput
                    value={otpCode}
                    onChange={(val) => { setOtpCode(val); setOtpError(null) }}
                    disabled={isVerifying}
                  />
                  {otpError && (
                    <p className="text-center text-sm text-rose-600 font-medium animate-fade-in" role="alert">
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
                <div className="flex flex-col items-center gap-3 text-sm text-slate-500 pt-4 border-t border-black/5">
                  <p>Didn't receive the code?</p>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isResending}
                    className="font-medium text-primary-600 hover:text-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
                    className="text-slate-400 hover:text-slate-600 transition mt-2 flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/-2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                    Back to sign in
                  </button>
                </div>
              </div>
            )}

            {/* ── Forgot Password ── */}
            {mode === 'forgot-password' && (
              <form className="space-y-5 animate-fade-in" onSubmit={handleForgotPassword} noValidate>
                <div className="rounded-panel border border-primary-100 bg-gradient-to-r from-primary-50/50 to-transparent p-5 mb-4">
                  <h3 className="font-semibold text-ink text-lg mb-1">Reset your password</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Enter your email address and we will send you a code to reset your password.
                  </p>
                </div>

                <Input
                  label="Email"
                  type="email"
                  value={fields.email}
                  onChange={handleChange('email')}
                  error={errors.email}
                  autoComplete="email"
                  placeholder="team@repolens.dev"
                />

                {authError && (
                  <div
                    className="relative overflow-hidden rounded-xl border border-rose-200 bg-rose-50/90 text-rose-900 shadow-glass backdrop-blur-xl px-4 py-3 text-sm animate-fade-in before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-rose-500 flex items-start gap-3 pl-5"
                    role="alert"
                  >
                    <svg className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>{authError}</div>
                  </div>
                )}

                <div className="pt-2">
                  <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
                    Send reset code
                  </Button>
                </div>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setAuthError(null); }}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700 transition"
                  >
                    Back to sign in
                  </button>
                </div>
              </form>
            )}

            {/* ── Reset Password ── */}
            {mode === 'reset-password' && (
              <div className="space-y-8 animate-fade-in">
                <div className="rounded-panel border border-primary-100 bg-gradient-to-r from-primary-50/50 to-transparent p-5">
                  <h3 className="font-semibold text-ink text-lg mb-1">Enter reset code</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    We sent a code to <strong className="text-ink font-medium">{pendingEmail}</strong>.
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700 text-center">
                    Reset code
                  </label>
                  <OtpInput
                    value={otpCode}
                    onChange={(val) => { setOtpCode(val); setOtpError(null) }}
                    disabled={isVerifying}
                  />
                  {otpError && (
                    <p className="text-center text-sm text-rose-600 font-medium animate-fade-in" role="alert">
                      {otpError}
                    </p>
                  )}
                </div>

                <Input
                  label="New Password"
                  type="password"
                  value={fields.password}
                  onChange={handleChange('password')}
                  error={errors.password}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />

                <Button
                  fullWidth
                  size="lg"
                  isLoading={isVerifying}
                  onClick={handleResetPassword}
                  disabled={otpCode.length !== 6 || fields.password.length < 8}
                >
                  Reset password
                </Button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setAuthError(null); }}
                    className="text-sm font-medium text-slate-400 hover:text-slate-600 transition"
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="hidden lg:block relative overflow-hidden bg-ink">
          <div className="absolute inset-0 z-0">
            <img
              src={AUTH_ARTWORK_URL}
              alt="Developer workstation with code on screen"
              className="h-full w-full object-cover opacity-60 mix-blend-luminosity hover:mix-blend-normal hover:opacity-100 transition-all duration-1000 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-transparent to-transparent" />
          </div>
          
          <div className="relative z-10 h-full flex flex-col justify-end p-12 text-white">
            <div className="glass-panel !bg-ink/40 !border-white/10 p-8 rounded-2xl animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-2 w-2 rounded-full bg-primary-400 animate-pulse-slow"></span>
                <p className="text-sm font-semibold uppercase tracking-widest text-primary-200">
                  Real-time pipeline
                </p>
              </div>
              <p className="max-w-md text-3xl font-bold leading-tight text-white mb-4">
                Submit a repository, watch it progress, then pull reports seamlessly.
              </p>
              <p className="text-slate-300 text-sm">
                Industry-standard analytics for your codebase. Fast, secure, and perfectly synced.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
