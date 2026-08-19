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
import { ArrowLeft, User as UserIcon, Shield, AlertTriangle, Monitor, Trash2 } from 'lucide-react'

type SettingsTab = 'profile' | 'security' | 'danger'

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: <UserIcon className="w-4 h-4" />,
  },
  {
    id: 'security',
    label: 'Security',
    icon: <Shield className="w-4 h-4" />,
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
]

export function SettingsPage() {
  const { user, token, loginWithToken, logout } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const initial = ((user?.full_name ?? user?.email ?? '?') || '?')[0]!.toUpperCase()

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setIsSavingProfile(true)
      const res = await api.patch<User>('/auth/me', { full_name: fullName.trim() })
      const updated = res.data
      if (token) {
        loginWithToken(token, updated)
        writeAuthSession({ token, user: updated })
      }
      pushToast({ title: 'Profile updated', description: 'Your display name has been saved.', tone: 'success' })
    } catch (err) {
      pushToast({ title: 'Update failed', description: getErrorMessage(err), tone: 'error' })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSavePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      pushToast({ title: 'Too short', description: 'Password must be at least 8 characters.', tone: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      pushToast({ title: 'Mismatch', description: 'Passwords do not match.', tone: 'error' })
      return
    }
    try {
      setIsSavingPassword(true)
      const res = await api.patch<User>('/auth/me', { new_password: newPassword })
      const updated = res.data
      if (token) {
        loginWithToken(token, updated)
        writeAuthSession({ token, user: updated })
      }
      pushToast({ title: 'Password set!', description: 'You can now sign in with email + password.', tone: 'success' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      pushToast({ title: 'Failed', description: getErrorMessage(err), tone: 'error' })
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.email) return
    try {
      setIsDeleting(true)
      await api.delete('/auth/me')
      pushToast({ title: 'Account deleted', description: 'Your account has been permanently removed.', tone: 'info' })
      logout({ redirect: false })
      navigate(ROUTES.auth, { replace: true })
    } catch (err) {
      pushToast({ title: 'Delete failed', description: getErrorMessage(err), tone: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.dashboard)}
            className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Account & Workspace Settings
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              Manage profile preferences, login security, and user sessions.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <aside className="w-full md:w-56 flex-shrink-0 space-y-4">
          <div className="flex flex-col items-center gap-2 p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-xs">
              {initial}
            </div>
            <div className="text-center w-full min-w-0">
              <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{user?.full_name ?? 'No name set'}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate font-mono mt-0.5">{user?.email}</p>
            </div>
          </div>

          <nav className="space-y-1 bg-white dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
                  activeTab === tab.id
                    ? tab.id === 'danger'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 shadow-xs'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 shadow-xs'
                    : tab.id === 'danger'
                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Public Profile</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Your display name for team activity.</p>
              </div>
              <div className="p-6 space-y-5">
                <Input
                  label="Display Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                />
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Email Address</label>
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-mono">
                    <span>{user?.email}</span>
                    <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded font-sans font-medium">Read-only</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Connected Providers</label>
                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white">GitHub OAuth</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Primary authentication provider</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded">Active</span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                <Button type="submit" isLoading={isSavingProfile} disabled={fullName.trim() === (user?.full_name ?? '')}>
                  Save Changes
                </Button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <form onSubmit={handleSavePassword} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Password Authentication</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Set a password for standard credentials sign in.</p>
                </div>
                <div className="p-6 space-y-4">
                  <Input
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <Input
                    label="Confirm Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>
                <div className="px-6 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                  <Button type="submit" isLoading={isSavingPassword} disabled={!newPassword}>
                    Update Password
                  </Button>
                </div>
              </form>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Active Session</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Details about your current browser session.</p>
                </div>
                <div className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-zinc-500" />
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white">Current Browser</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Authenticated as {user?.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Sign Out Session
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 rounded-xl overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20">
                <h2 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Delete Account & Workspace
                </h2>
                <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                  Permanent action. All repositories, analysis reports, and team tokens will be deleted.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <p>• All repository analyses will be purged from database</p>
                  <p>• AI insights and PDF exports will be unlinked</p>
                  <p>• Account access cannot be restored once deleted</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Confirm Email Address (<span className="font-mono">{user?.email}</span>):
                  </label>
                  <input
                    type="email"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={user?.email ?? ''}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== user?.email || isDeleting}
                  className="w-full py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Deleting Account...' : 'Permanently Delete Account'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
