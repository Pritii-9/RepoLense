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

type SettingsTab = 'profile' | 'security' | 'danger'

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Security',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
  },
]

export function SettingsPage() {
  const { user, token, loginWithToken, logout } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  // Profile tab state
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Security tab state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  // Danger zone state
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const initial = (user?.full_name ?? user?.email ?? '?')[0].toUpperCase()

  // ── Profile ───────────────────────────────────────────────
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

  // ── Security ──────────────────────────────────────────────
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

  // ── Danger Zone ───────────────────────────────────────────
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
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Page Header */}
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => navigate(ROUTES.dashboard)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Dashboard
        </button>
        <span className="text-slate-300">/</span>
        <h1 className="text-lg font-bold text-ink">Settings</h1>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0">
          {/* User Card */}
          <div className="flex flex-col items-center gap-2 mb-6 p-4 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-primary-100">
              {initial}
            </div>
            <p className="text-sm font-bold text-ink text-center leading-tight">{user?.full_name ?? 'No name set'}</p>
            <p className="text-[11px] text-slate-500 text-center truncate w-full text-center">{user?.email}</p>
          </div>

          {/* Tab Nav */}
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left ${
                  activeTab === tab.id
                    ? tab.id === 'danger'
                      ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                      : 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                    : tab.id === 'danger'
                    ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">

          {/* ── Profile Tab ── */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-ink">Public Profile</h2>
                <p className="text-sm text-slate-500 mt-0.5">This is how your name appears in the app.</p>
              </div>
              <div className="px-6 py-6 space-y-5">
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
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                    {user?.email}
                    <span className="ml-auto text-[11px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-medium">Read-only</span>
                  </div>
                </div>

                {/* Connected Accounts */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Connected Accounts</label>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                    <svg className="w-5 h-5 text-slate-700 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-ink">GitHub</p>
                      <p className="text-xs text-slate-500">Connected via OAuth</p>
                    </div>
                    <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow inline-block"></span>
                      Active
                    </span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                <Button type="submit" isLoading={isSavingProfile} disabled={fullName.trim() === (user?.full_name ?? '')}>
                  Save Profile
                </Button>
              </div>
            </form>
          )}

          {/* ── Security Tab ── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <form onSubmit={handleSavePassword} className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="text-base font-bold text-ink">Password</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Set a password to enable email + password sign-in alongside GitHub.
                  </p>
                </div>
                <div className="px-6 py-6 space-y-4">
                  <Input
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                </div>
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                  <Button type="submit" isLoading={isSavingPassword} disabled={!newPassword}>
                    Set Password
                  </Button>
                </div>
              </form>

              {/* Session info */}
              <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="text-base font-bold text-ink">Active Session</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Your current login session details.</p>
                </div>
                <div className="px-6 py-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">Current Browser Session</p>
                    <p className="text-xs text-slate-500">Signed in as {user?.email}</p>
                  </div>
                  <button
                    onClick={() => logout()}
                    className="ml-auto text-xs font-medium text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Danger Zone Tab ── */}
          {activeTab === 'danger' && (
            <div className="bg-white/70 backdrop-blur-xl border border-rose-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-rose-100 bg-rose-50/50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <h2 className="text-base font-bold text-rose-700">Delete Account</h2>
                </div>
                <p className="text-sm text-rose-600/80 mt-1">
                  This action is permanent and cannot be undone. All your analyses, reports, and data will be deleted.
                </p>
              </div>
              <div className="px-6 py-6 space-y-4">
                <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-4 text-sm text-slate-600 space-y-1">
                  <p>⚠️ All repository analyses will be deleted permanently</p>
                  <p>⚠️ All AI insights and reports will be deleted</p>
                  <p>⚠️ Your account cannot be recovered after deletion</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Type your email <strong className="text-ink">{user?.email}</strong> to confirm:
                  </label>
                  <input
                    type="email"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={user?.email ?? ''}
                    className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white text-sm text-ink placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all"
                  />
                </div>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== user?.email || isDeleting}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                      Delete My Account
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
