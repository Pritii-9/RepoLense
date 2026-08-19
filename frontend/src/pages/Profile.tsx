import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User as UserIcon, Mail, Settings, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/Button'
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

  const initial = ((user?.full_name ?? user?.email ?? '?') || '?')[0]!.toUpperCase()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(ROUTES.dashboard)}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden transition-colors">
        {/* Profile Card Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-8 py-8 text-white">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl font-bold ring-2 ring-white/30 shadow-inner">
              {initial}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{user?.full_name || 'Enterprise Developer'}</h1>
              <p className="text-indigo-100 text-xs font-mono truncate mt-0.5">{user?.email}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-sm text-white text-[10px] font-medium border border-white/20">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Active Organization User
              </div>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Display Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Email Address
            </label>
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-mono">
              <Mail className="w-4 h-4 text-zinc-400 shrink-0" />
              <span className="truncate flex-1">{user?.email}</span>
              <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-md font-sans font-medium">Read-only</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={fullName.trim() === (user?.full_name ?? '')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-5 py-2.5 shadow-xs"
            >
              Save Changes
            </Button>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="text-xs font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Workspace Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
