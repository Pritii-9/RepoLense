import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { verifyEmail, resendVerification } from '@/services/auth'
import { AUTH_ARTWORK_URL, ROUTES, TEMP_CREDS_KEY } from '@/utils/constants'
import type { VerifyPayload } from '@/types/api'

type AuthMode = 'login' | 'register' | 'check-email' | 'verify-email' | 'resend'

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

interface TempCreds {
  email: string
  password: string
  full_name: string | undefined
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

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, login, register } = useAuth()
  const { pushToast } = useToast()
  const [mode, setMode] = useState<AuthMode>('login')
  const [fields, setFields] = useState<AuthFields>(initialFields)
  const [tempCreds, setTempCreds] = useState<TempCreds | null>(null)
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null)
  const [errors, setErrors] = useState<AuthErrors>({})
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const destination = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname ?? ROUTES.dashboard
  }, [location.state])

  // Check for verification token on mount
  useEffect(() => {
    const token = searchParams.get('token')
    if (token && mode !== 'verify-email') {
      setMode('verify-email')
    }
  }, [searchParams, mode])

  // Load temp creds for verify flow
  useEffect(() => {
    const stored = localStorage.getItem(TEMP_CREDS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as TempCreds & { verification_url?: string | null }
      setTempCreds({
        email: parsed.email,
        password: parsed.password,
        full_name: parsed.full_name,
      })
      setVerificationUrl(parsed.verification_url ?? null)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      navigate(destination, { replace: true })
    }
  }, [destination, isAuthenticated, navigate])

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

  const handleVerifyEmail = async () => {
    if (!tempCreds) return

    try {
      setIsVerifying(true)
      const token: VerifyPayload = { token: searchParams.get('token')! }
      await verifyEmail(token)
      await login({
        email: tempCreds.email,
        password: tempCreds.password,
      })
      localStorage.removeItem(TEMP_CREDS_KEY)
      pushToast({
        title: 'Email verified!',
        description: 'Welcome to RepoLens.',
        tone: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed'
      setAuthError(message)
      pushToast({
        title: 'Verification failed',
        description: message,
        tone: 'error',
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate('login', fields) // reuse login validation
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      setIsSubmitting(true)
      const response = await resendVerification({
        email: fields.email.trim(),
        password: fields.password,
      })
      setVerificationUrl(response.verification_url ?? null)
      setMode('check-email')
      pushToast({
        title: 'Verification email sent',
        description: response.verification_url
          ? 'Use the local verification link to continue.'
          : 'Please check your inbox.',
        tone: 'success',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Resend failed'
      setAuthError(message)
      pushToast({
        title: 'Resend failed',
        description: message,
        tone: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate(mode, fields)
    setErrors(nextErrors)
    setAuthError(null)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      setIsSubmitting(true)
      if (mode === 'login') {
        await login({
          email: fields.email.trim(),
          password: fields.password,
        })
      } else if (mode === 'register') {
        const registerPayload = {
          email: fields.email.trim(),
          password: fields.password,
          full_name: fields.fullName.trim() || undefined,
        } as TempCreds
        const response = await register({
          email: registerPayload.email,
          password: registerPayload.password,
          full_name: registerPayload.full_name,
        })

        // Store temp creds
        localStorage.setItem(
          TEMP_CREDS_KEY,
          JSON.stringify({
            ...registerPayload,
            verification_url: response.verification_url,
          }),
        )
        setTempCreds(registerPayload)
        setVerificationUrl(response.verification_url)
        setMode('check-email')
        pushToast({
          title: 'Account created!',
          description: response.verification_url
            ? 'Open the local verification link to finish setup.'
            : 'Please check your email to verify your account.',
          tone: 'success',
        })
        return // Don't navigate, show check-email
      }

      pushToast({
        title: 'Welcome back.',
        description: 'You can start submitting repositories right away.',
        tone: 'success',
      })
      navigate(destination, { replace: true })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Please try again.'
      const friendlyMessage =
        mode === 'register' && message === 'An account with this email already exists.'
          ? 'That email is already registered. Sign in instead, or use a different email address.'
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

            {mode === 'check-email' || mode === 'verify-email' || mode === 'resend' ? null : (
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
                    onClick={() => setMode(nextMode)}
                  >
                    {nextMode === 'login' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>
            )}

            {mode === 'login' || mode === 'register' ? (
              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                {mode === 'register' ? (
                  <Input
                    label="Full name"
                    value={fields.fullName}
                    onChange={handleChange('fullName')}
                    error={errors.fullName}
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                  />
                ) : null}

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

                {authError ? (
                  <div
                    className="rounded-panel border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    role="alert"
                  >
                    {authError}
                  </div>
                ) : null}

                <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
                  {mode === 'login' ? 'Enter dashboard' : 'Create account'}
                </Button>
              </form>
            ) : mode === 'verify-email' ? (
              <div className="mt-6 space-y-4">
                {tempCreds && (
                  <div className="rounded-panel bg-mint/10 border border-mint p-4">
                    <h3 className="font-semibold text-ink">Verify your email</h3>
                    <p className="text-slate-600">We've received your token. Click verify to complete setup for <strong>{tempCreds.email}</strong>.</p>
                  </div>
                )}
                {authError ? (
                  <div
                    className="rounded-panel border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    role="alert"
                  >
                    {authError}
                  </div>
                ) : null}
                <Button 
                  onClick={handleVerifyEmail}
                  fullWidth 
                  size="lg" 
                  isLoading={isVerifying}
                >
                  Verify Email
                </Button>
                <Button 
                  variant="ghost" 
                  fullWidth
                  onClick={() => setMode('login')}
                >
                  I already verified
                </Button>
              </div>
            ) : mode === 'check-email' ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-panel bg-blue/10 border border-blue p-4">
                  <h3 className="font-semibold text-ink">Check your email</h3>
                  <p className="text-slate-600">
                    We've sent a verification link to <strong>{tempCreds?.email}</strong>.
                    Please check your inbox (and spam folder).
                  </p>
                  {verificationUrl ? (
                    <a
                      href={verificationUrl}
                      className="focus-ring mt-3 inline-flex rounded-panel border border-blue bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-blue/5"
                    >
                      Open verification link
                    </a>
                  ) : null}
                </div>
                <Button 
                  variant="ghost" 
                  fullWidth
                  onClick={() => setMode('resend')}
                >
                  Didn't receive email? Resend
                </Button>
                <Button 
                  variant="ghost" 
                  fullWidth
                  onClick={() => setMode('login')}
                >
                  I already verified
                </Button>
              </div>
            ) : mode === 'resend' ? (
              <form className="mt-6 space-y-4" onSubmit={handleResendVerification} noValidate>
                <Input
                  label="Email"
                  type="email"
                  value={fields.email}
                  onChange={handleChange('email')}
                  error={errors.email}
                  autoComplete="email"
                  placeholder="your@email.com"
                />
                <Input
                  label="Password"
                  type="password"
                  value={fields.password}
                  onChange={handleChange('password')}
                  error={errors.password}
                  autoComplete="current-password"
                  placeholder="Enter your password to resend"
                />
                {authError ? (
                  <div
                    className="rounded-panel border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    role="alert"
                  >
                    {authError}
                  </div>
                ) : null}
                <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
                  Resend Verification Email
                </Button>
              </form>
            ) : null}

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
