import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import * as authService from '@/services/auth'
import { getErrorMessage, registerUnauthorizedHandler, setAccessToken } from '@/services/api'
import type {
  AuthStatus,
  LoginPayload,
  RegisterPayload,
  User,
} from '@/types/api'
import { readAuthSession, clearAuthSession, writeAuthSession } from '@/utils/storage'
import { useToastContext } from '@/contexts/ToastContext'
import { ROUTES } from '@/utils/constants'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isVerified: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<{ verification_url: string | null }>
  logout: (options?: { reason?: string; redirect?: boolean }) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const location = useLocation()
  const { pushToast } = useToastContext()
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const session = readAuthSession()
    if (session) {
      setUser(session.user)
      setToken(session.token)
      setAccessToken(session.token)
      setStatus('authenticated')
      return
    }

    setAccessToken(null)
    setStatus('unauthenticated')
  }, [])

  const completeAuth = useCallback((nextToken: string, nextUser: User) => {
    setAccessToken(nextToken)
    setToken(nextToken)
    setUser(nextUser)
    setStatus('authenticated')
    writeAuthSession({ token: nextToken, user: nextUser })
  }, [])

  const logout = useCallback(
    (options?: { reason?: string; redirect?: boolean }) => {
      clearAuthSession()
      setAccessToken(null)
      setToken(null)
      setUser(null)
      setStatus('unauthenticated')

      if (options?.reason) {
        pushToast({
          title: options.reason,
          tone: 'info',
        })
      }

      if (options?.redirect !== false && location.pathname !== ROUTES.auth) {
        navigate(ROUTES.auth, {
          replace: true,
          state: { from: location },
        })
      }
    },
    [location, navigate, pushToast],
  )

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      logout({ reason: 'Your session expired. Please sign in again.' })
    })

    return () => {
      registerUnauthorizedHandler(null)
    }
  }, [logout])

  const login = useCallback(
    async (payload: LoginPayload) => {
      try {
        const response = await authService.login(payload)
        completeAuth(response.access_token, response.user)
      } catch (error) {
        throw new Error(getErrorMessage(error))
      }
    },
    [completeAuth],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      try {
        const response = await authService.register(payload)
        return { verification_url: response.verification_url }
      } catch (error) {
        throw new Error(getErrorMessage(error))
      }
    },
    [],
  )

  const value = useMemo(
    () => ({
      status,
      user,
      token,
      isAuthenticated: status === 'authenticated' && !!token,
      isVerified: !!user?.is_verified,
      login,
      register,
      logout,
    }),
    [login, logout, register, status, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }

  return context
}
