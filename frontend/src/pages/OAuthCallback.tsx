import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { setAccessToken } from '@/services/api'
import { ROUTES } from '@/utils/constants'
import { useToast } from '@/hooks/useToast'

export function OAuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()
  const { pushToast } = useToast()

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (token) {
      // Store token
      localStorage.setItem('accessToken', token)
      setAccessToken(token)
      
      // Fetch user profile to complete login
      import('@/services/auth').then(({ getCurrentUser }) => {
        getCurrentUser()
          .then((user) => {
            loginWithToken(token, user)
            pushToast({
              title: 'Login successful',
              description: 'Welcome to RepoLens.',
              tone: 'success',
            })
            navigate(ROUTES.dashboard, { replace: true })
          })
          .catch(() => {
            pushToast({
              title: 'Login failed',
              description: 'Could not fetch user profile.',
              tone: 'error',
            })
            navigate(ROUTES.auth, { replace: true })
          })
      })
    } else {
      pushToast({
        title: 'Authentication error',
        description: 'No token received from GitHub.',
        tone: 'error',
      })
      navigate(ROUTES.auth, { replace: true })
    }
  }, [searchParams, navigate, loginWithToken, pushToast])

  return (
    <div className="min-h-screen flex items-center justify-center bg-mist">
      <div className="text-center animate-pulse-slow">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">Completing authentication...</p>
      </div>
    </div>
  )
}
