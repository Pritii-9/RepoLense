import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { AUTH_ARTWORK_URL, ROUTES } from '@/utils/constants'

type AuthMode = 'login' | 'register'

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
  const destination = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname ?? ROUTES.dashboard
  }, [location.state])

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
      } else {
        await register({
          email: fields.email.trim(),
          password: fields.password,
          full_name: fields.fullName.trim() || undefined,
        })
      }

      pushToast({
        title: mode === 'login' ? 'Welcome back.' : 'Account ready.',
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
