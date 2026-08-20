import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '@/services/api'
import { Button } from '@/components/Button'

interface GitHubRepo {
  id: number
  full_name: string
  name: string
  description: string
  html_url: string
  default_branch: string
  language: string
  stargazers_count: number
  private: boolean
  updated_at: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelect: (repoUrl: string, branch: string) => void
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
}

export function GitHubRepoImporter({ isOpen, onClose, onSelect }: Props) {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState<number | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    void api
      .get<GitHubRepo[]>('/auth/github/repos?per_page=50')
      .then((res) => setRepos(res.data))
      .catch((err: unknown) => {
        const msg =
          err instanceof Error
            ? err.message
            : 'Could not load repositories. Please connect your GitHub account first.'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const filtered = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()),
  )

  const handleAnalyze = (repo: GitHubRepo) => {
    setSubmitting(repo.id)
    onSelect(repo.html_url, repo.default_branch)
    onClose()
    setSubmitting(null)
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md animate-fade-in" 
        onClick={onClose} 
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-premium border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[80vh] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white dark:text-zinc-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Import from GitHub</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Select a repository to analyze</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Loading your repositories…</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 p-4 text-center">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-400 mb-1">Could not load repositories</p>
                <p className="text-xs text-rose-600 dark:text-rose-500 mb-4">{error}</p>
                <a
                  href={`${(import.meta.env.PROD ? 'https://beyond-hub-samuel-rubber.trycloudflare.com' : (import.meta.env.VITE_API_URL as string || 'http://localhost:8000')).replace(/\/+$/, '')}/auth/github/login`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold hover:opacity-90 transition cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                  Connect GitHub Account
                </a>
              </div>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No repositories found.</p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filtered.map((repo) => (
                <li key={repo.id} className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{repo.full_name}</span>
                      {repo.private && (
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60 font-medium">
                          Private
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mb-1">{repo.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-550">
                      {repo.language !== 'Unknown' && (
                        <span className="flex items-center gap-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: LANGUAGE_COLORS[repo.language] ?? '#8b949e' }}
                          />
                          {repo.language}
                        </span>
                      )}
                      {repo.stargazers_count > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          {repo.stargazers_count}
                        </span>
                      )}
                      <span className="font-mono text-[10px]">branch: {repo.default_branch}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAnalyze(repo)}
                    isLoading={submitting === repo.id}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Analyze
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && repos.length > 0 && (
          <div className="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800/60 text-center">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Showing {filtered.length} of {repos.length} repositories
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
