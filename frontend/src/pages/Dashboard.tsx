import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { Input } from '@/components/Input'
import { MetricTile } from '@/components/MetricTile'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { LiveTerminal } from '@/components/LiveTerminal'
import { useAnalysis } from '@/hooks/useAnalysis'
import { usePollStatus } from '@/hooks/usePollStatus'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/utils/cn'
import { formatDateTime, formatRelativeTime } from '@/utils/dateHelpers'
import { formatInteger } from '@/utils/formatters'
import { isValidGitHubUrl } from '@/utils/validation'
import { ExportModal } from '@/components/ExportModal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { GitHubRepoImporter } from '@/components/GitHubRepoImporter'

interface SubmissionErrors {
  repositoryUrl?: string
}

export function DashboardPage() {
  const { analyses, isHydrated, isSubmitting, refreshAnalysis, submitRepository, deleteAnalysis } =
    useAnalysis()
  const { pushToast } = useToast()
  const [repositoryUrl, setRepositoryUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [errors, setErrors] = useState<SubmissionErrors>({})
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showExport, setShowExport] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showGitHubImporter, setShowGitHubImporter] = useState(false)
  // Live terminal state
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)
  const [activeRepoName, setActiveRepoName] = useState<string>('')

  const { activeCount, isPolling } = usePollStatus(
    analyses.map((analysis) => ({
      id: analysis.id,
      status: analysis.status,
    })),
  )

  const stats = useMemo(() => {
    const pending = analyses.filter((analysis) => analysis.status === 'pending').length
    const running = analyses.filter((analysis) => analysis.status === 'running').length
    const completed = analyses.filter((analysis) => analysis.status === 'completed').length

    return { pending, running, completed }
  }, [analyses])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: SubmissionErrors = {}

    if (!isValidGitHubUrl(repositoryUrl.trim())) {
      nextErrors.repositoryUrl = 'Enter a valid GitHub repository URL.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      const created = await submitRepository({
        repository_url: repositoryUrl.trim(),
        branch: branch.trim() || undefined,
      })

      setRepositoryUrl('')
      setBranch('')

      // Open the live terminal for this new analysis
      setActiveTerminalId(created.id)
      setActiveRepoName(created.repository_name)

      pushToast({
        title: 'Repository submitted.',
        description: `Live-streaming logs for ${created.repository_name}.`,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: 'Submission failed.',
        description: error instanceof Error ? error.message : 'Please try again.',
        tone: 'error',
      })
    }
  }

  const handleGitHubImport = async (repoUrl: string, branch: string) => {
    try {
      const created = await submitRepository({
        repository_url: repoUrl,
        branch: branch || undefined,
      })
      setActiveTerminalId(created.id)
      setActiveRepoName(created.repository_name)
      pushToast({
        title: 'Repository submitted.',
        description: `Analyzing ${created.repository_name}…`,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: 'Submission failed.',
        description: error instanceof Error ? error.message : 'Please try again.',
        tone: 'error',
      })
    }
  }

  const handleRefresh = async (analysisId: string) => {
    try {
      setRefreshingId(analysisId)
      await refreshAnalysis(analysisId)
    } catch (error) {
      pushToast({
        title: 'Refresh failed.',
        description: error instanceof Error ? error.message : 'Unable to refresh analysis.',
        tone: 'error',
      })
    } finally {
      setRefreshingId(null)
    }
  }

  const handleDelete = (analysisId: string) => {
    setDeleteConfirmId(analysisId)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return
    
    try {
      setDeletingId(deleteConfirmId)
      await deleteAnalysis(deleteConfirmId)
      pushToast({
        title: 'Deleted.',
        description: 'Analysis has been removed.',
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: 'Delete failed.',
        description: error instanceof Error ? error.message : 'Unable to delete.',
        tone: 'error',
      })
    } finally {
      setDeletingId(null)
      setDeleteConfirmId(null)
    }
  }

  if (!isHydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card
          title="Submit a repository"
          description="RepoLens accepts GitHub repository URLs and polls active jobs every five seconds until they complete or fail."
          className="relative overflow-hidden group"
        >
          {/* Decorative background element */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary-100/30 rounded-full blur-3xl group-hover:bg-primary-200/30 transition-colors duration-500 pointer-events-none dark:bg-primary-900/20 dark:group-hover:bg-primary-800/20"></div>
          
          <form className="relative z-10 grid gap-5 mt-2" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-start">
              <Input
                label="Repository URL"
                value={repositoryUrl}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setRepositoryUrl(event.target.value)
                  setErrors({})
                }}
                error={errors.repositoryUrl}
                placeholder="https://github.com/owner/repository"
                className="bg-white/60 dark:bg-slate-900/60"
              />
              <Input
                label="Branch"
                value={branch}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setBranch(event.target.value)}
                hint="Optional. Leave blank for the default branch."
                placeholder="main"
                className="bg-white/60 dark:bg-slate-900/60"
              />
              <div className="pt-7">
                <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full md:w-auto shadow-md">
                  Analyze repo
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs text-slate-400 font-medium">or</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
            <button
              type="button"
              onClick={() => setShowGitHubImporter(true)}
              className="flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 hover:text-primary-700 dark:hover:text-primary-400 transition-all font-medium text-sm group"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              Import from GitHub — pick from your repos
            </button>
          </form>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <MetricTile
            label="Queued"
            value={formatInteger(stats.pending)}
            hint={isPolling ? `${activeCount} analysis job(s) still polling.` : 'No active polls.'}
            tone="warm"
          />
          <MetricTile
            label="Running"
            value={formatInteger(stats.running)}
            hint="Background analysis currently processing."
            tone="cool"
          />
          <MetricTile
            label="Completed"
            value={formatInteger(stats.completed)}
            hint="Completed analyses stay in your local workspace history."
          />
        </div>
      </section>

      {/* Live Terminal – shown after submission */}
      {activeTerminalId && (
        <LiveTerminal
          analysisId={activeTerminalId}
          repositoryName={activeRepoName}
          onClose={() => setActiveTerminalId(null)}
        />
      )}
      <div className="mt-8 flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-bold text-ink tracking-tight dark:text-slate-100">Recent Analyses</h2>
          {isPolling && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-full border border-primary-100 shadow-sm dark:bg-primary-900/30 dark:border-primary-800/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              <span className="text-xs font-bold text-primary-700 dark:text-primary-400">Syncing {activeCount}</span>
            </div>
          )}
        </div>

        {analyses.length === 0 ? (
          <EmptyState
            title="No analyses tracked yet"
            description="Submit a GitHub repository to start the first analysis run."
          />
        ) : (
          <div className="scrollbar-thin overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-premium dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full divide-y divide-black/5 dark:divide-white/5 text-left text-sm">
              <thead className="bg-black/[0.02] dark:bg-white/[0.02]">
                <tr className="text-slate-500 dark:text-slate-400">
                  <th className="py-4 pl-5 pr-4 font-semibold">Repository</th>
                  <th className="py-4 pr-4 font-semibold">Status</th>
                  <th className="py-4 pr-4 font-semibold">Submitted</th>
                  <th className="py-4 pr-4 font-semibold">Last update</th>
                  <th className="py-4 pr-4 font-semibold">Metrics</th>
                  <th className="py-4 pr-5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {analyses.map((analysis) => (
                  <tr key={analysis.id} className="align-top hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors">
                    <td className="py-5 pl-5 pr-4">
                      <Link
                        to={`/analyses/${analysis.id}`}
                        className="focus-ring rounded-panel text-sm font-bold text-ink dark:text-slate-100 hover:text-primary-700 dark:hover:text-primary-400 hover:underline decoration-primary-300 underline-offset-2"
                      >
                        {analysis.repository_name}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <a 
                          href={analysis.repository_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2 py-0.5 rounded-full transition-colors"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                          GitHub
                        </a>
                      </div>
                      {analysis.branch ? (
                        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/-2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 opacity-70">
                            <path fillRule="evenodd" d="M11.5 2a1.5 1.5 0 0 0-1.5 1.5V6a1.5 1.5 0 0 0 3 0V3.5A1.5 1.5 0 0 0 11.5 2Zm-5 0A1.5 1.5 0 0 0 5 3.5v13A1.5 1.5 0 0 0 6.5 18h7a1.5 1.5 0 0 0 1.5-1.5V11a1.5 1.5 0 0 0-3 0v4H6.5V3.5A1.5 1.5 0 0 0 6.5 2h5ZM6.5 7h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1Z" clipRule="evenodd" />
                          </svg>
                          {analysis.branch}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-5 pr-4">
                      <StatusBadge status={analysis.status} />
                      {analysis.error_message ? (
                        <p className="mt-2 max-w-xs text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-100">
                          {analysis.error_message}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-5 pr-4">
                      <p className="font-medium text-slate-700 dark:text-slate-300">{formatDateTime(analysis.submitted_at)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatRelativeTime(analysis.submitted_at)}
                      </p>
                    </td>
                    <td className="py-5 pr-4">
                      <p className="font-medium text-slate-700 dark:text-slate-300">{formatDateTime(analysis.updated_at)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                        </span>
                        Synced {formatRelativeTime(analysis.last_synced_at)}
                      </p>
                    </td>
                    <td className="py-5 pr-4">
                      {analysis.code_metric ? (
                        <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                          <p className="flex justify-between w-24"><span>Files:</span> <span className="text-ink dark:text-slate-200">{formatInteger(analysis.code_metric.file_count)}</span></p>
                          <p className="flex justify-between w-24"><span>Commits:</span> <span className="text-ink dark:text-slate-200">{formatInteger(analysis.code_metric.commit_count)}</span></p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded">
                          <div className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin"></div>
                          Processing
                        </span>
                      )}
                    </td>
                    <td className="py-5 pr-5">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleRefresh(analysis.id)}
                          isLoading={refreshingId === analysis.id}
                          className="w-9 !px-0 bg-white shadow-sm"
                          title="Refresh"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(analysis.id)}
                          isLoading={deletingId === analysis.id}
                          className="w-9 !px-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                        </Button>
                        {analysis.code_metric && (
                          <button
                            onClick={() => setShowExport(analysis.id)}
                            className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-panel text-sm font-medium text-primary-700 bg-primary-50 transition hover:bg-primary-100 shadow-sm dark:bg-primary-900/30 dark:hover:bg-primary-900/50 dark:text-primary-400"
                            title="Export"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                          </button>
                        )}
                        {showExport && (
                          <ExportModal
                            analysis={analysis}
                            isOpen={showExport === analysis.id}
                            onClose={() => setShowExport(null)}
                          />
                        )}
                        <Link
                          to={`/analyses/${analysis.id}`}
                          title="View"
                          className={cn(
                            'focus-ring inline-flex h-9 w-9 items-center justify-center rounded-panel text-sm font-medium text-slate-700 bg-white border border-slate-200 shadow-sm transition hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700',
                          )}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Analysis"
        message="Are you sure you want to delete this analysis permanently? All associated reports and AI insights will be removed."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deletingId !== null}
      />
      <GitHubRepoImporter
        isOpen={showGitHubImporter}
        onClose={() => setShowGitHubImporter(false)}
        onSelect={handleGitHubImport}
      />
    </div>
  )
}
