import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { api, getErrorMessage } from '@/services/api'
import type { User } from '@/types/api'
import { ROUTES } from '@/utils/constants'
import { writeAuthSession } from '@/utils/storage'

export function ProfilePage() {
  const { user, token, loginWithToken } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setIsLoading(true)
      const res = await api.patch<User>('/auth/me', { full_name: fullName.trim() })
      const updatedUser = res.data
      if (token) {
        loginWithToken(token, updatedUser)
        writeAuthSession({ token, user: updatedUser })
      }
      pushToast({ title: 'Profile updated', description: 'Your display name has been saved.', tone: 'success' })
    } catch (error) {
      pushToast({ title: 'Update failed', description: getErrorMessage(error), tone: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const initial = (user?.full_name ?? user?.email ?? '?')[0].toUpperCase()

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Back nav */}
      <div className="flex items-center gap-4 mb-10">
        <button
          onClick={() => navigate(ROUTES.dashboard)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </button>
      </div>

      <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-lg overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-8 py-8">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-bold ring-2 ring-white/40 shadow-inner">
              {initial}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{user?.full_name ?? 'No name set'}</h1>
              <p className="text-primary-200 text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          <Input
            label="Display Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
          />
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Email Address</label>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-sm">
              {user?.email}
              <span className="ml-auto text-[11px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-medium">Read-only</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={fullName.trim() === (user?.full_name ?? '')}
            >
              Save Changes
            </Button>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="text-sm text-slate-400 hover:text-primary-600 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              More settings
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
