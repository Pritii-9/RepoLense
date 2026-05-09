import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { Input } from '@/components/Input'
import { MetricTile } from '@/components/MetricTile'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { useAnalysis } from '@/hooks/useAnalysis'
import { usePollStatus } from '@/hooks/usePollStatus'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/utils/cn'
import { formatDateTime, formatRelativeTime } from '@/utils/dateHelpers'
import { formatInteger } from '@/utils/formatters'
import { isValidGitHubUrl } from '@/utils/validation'
import { ExportModal } from '@/components/ExportModal'

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
      pushToast({
        title: 'Repository submitted.',
        description: `Tracking analysis ${created.repository_name} every 5 seconds.`,
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

  const handleDelete = async (analysisId: string) => {
    if (!window.confirm('Delete this analysis permanently?')) return

    try {
      setDeletingId(analysisId)
      await deleteAnalysis(analysisId)
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
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary-100/30 rounded-full blur-3xl group-hover:bg-primary-200/30 transition-colors duration-500 pointer-events-none"></div>
          
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
                className="bg-white/60"
              />
              <Input
                label="Branch"
                value={branch}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setBranch(event.target.value)}
                hint="Optional. Leave blank for the default branch."
                placeholder="main"
                className="bg-white/60"
              />
              <div className="pt-7">
                <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full md:w-auto shadow-md">
                  Analyze repo
                </Button>
              </div>
            </div>
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

      <div className="mt-8 flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-bold text-ink tracking-tight">Recent Analyses</h2>
          {isPolling && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-full border border-primary-100 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              <span className="text-xs font-bold text-primary-700">Syncing {activeCount}</span>
            </div>
          )}
        </div>

        {analyses.length === 0 ? (
          <EmptyState
            title="No analyses tracked yet"
            description="Submit a GitHub repository to start the first analysis run."
          />
        ) : (
          <div className="scrollbar-thin overflow-x-auto rounded-2xl border border-white/60 bg-white/60 backdrop-blur-xl shadow-premium">
            <table className="min-w-full divide-y divide-black/5 text-left text-sm">
              <thead className="bg-black/[0.02]">
                <tr className="text-slate-500">
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
                  <tr key={analysis.id} className="align-top hover:bg-black/[0.015] transition-colors">
                    <td className="py-5 pl-5 pr-4">
                      <Link
                        to={`/analyses/${analysis.id}`}
                        className="focus-ring rounded-panel text-sm font-bold text-ink hover:text-primary-700 hover:underline decoration-primary-300 underline-offset-2"
                      >
                        {analysis.repository_name}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded inline-block">{analysis.repository_url}</p>
                      {analysis.branch ? (
                        <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
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
                      <p className="font-medium text-slate-700">{formatDateTime(analysis.submitted_at)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatRelativeTime(analysis.submitted_at)}
                      </p>
                    </td>
                    <td className="py-5 pr-4">
                      <p className="font-medium text-slate-700">{formatDateTime(analysis.updated_at)}</p>
                      <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                        </span>
                        Synced {formatRelativeTime(analysis.last_synced_at)}
                      </p>
                    </td>
                    <td className="py-5 pr-4">
                      {analysis.code_metric ? (
                        <div className="space-y-1.5 text-xs font-medium text-slate-600">
                          <p className="flex justify-between w-24"><span>Files:</span> <span className="text-ink">{formatInteger(analysis.code_metric.file_count)}</span></p>
                          <p className="flex justify-between w-24"><span>Commits:</span> <span className="text-ink">{formatInteger(analysis.code_metric.commit_count)}</span></p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
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
                          className="bg-white shadow-sm"
                        >
                          Refresh
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(analysis.id)}
                          isLoading={deletingId === analysis.id}
                          className="text-rose-600 hover:bg-rose-50"
                        >
                          Delete
                        </Button>
                        {analysis.code_metric && (
                          <button
                            onClick={() => setShowExport(analysis.id)}
                            className="focus-ring inline-flex h-9 items-center justify-center rounded-panel px-3 text-sm font-medium text-primary-700 bg-primary-50 transition hover:bg-primary-100 shadow-sm"
                          >
                            Export
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
                          className={cn(
                            'focus-ring inline-flex h-9 items-center justify-center rounded-panel px-3 text-sm font-medium text-white bg-ink shadow-sm transition hover:bg-ink/80 hover:shadow',
                          )}
                        >
                          View
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
    </div>
  )
}
