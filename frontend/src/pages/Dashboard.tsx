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
        >
          <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Repository URL"
                value={repositoryUrl}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setRepositoryUrl(event.target.value)
                  setErrors({})
                }}
                error={errors.repositoryUrl}
                placeholder="https://github.com/owner/repository"
              />
              <Input
                label="Branch"
                value={branch}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setBranch(event.target.value)}
                hint="Optional. Leave blank for the default branch."
                placeholder="main"
              />
            </div>

            <Button type="submit" isLoading={isSubmitting} className="md:mb-[2px]">
              Analyze repo
            </Button>
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

      <Card
        title="Analysis history"
        description="Stage 1 does not expose a list endpoint yet, so this table is restored from browser storage for the signed-in user and refreshed item by item."
        action={
          <span className="text-sm text-slate-500">
            {isPolling ? `Polling ${activeCount} active job(s)` : 'Idle'}
          </span>
        }
      >
        {analyses.length === 0 ? (
          <EmptyState
            title="No analyses tracked yet"
            description="Submit a GitHub repository to start the first analysis run."
          />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="min-w-full divide-y divide-black/5 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-3 pr-4 font-medium">Repository</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Submitted</th>
                  <th className="py-3 pr-4 font-medium">Last update</th>
                  <th className="py-3 pr-4 font-medium">Metrics</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {analyses.map((analysis) => (
                  <tr key={analysis.id} className="align-top">
                    <td className="py-4 pr-4">
                      <Link
                        to={`/analyses/${analysis.id}`}
                        className="focus-ring rounded-panel text-sm font-semibold text-ink hover:text-primary-700"
                      >
                        {analysis.repository_name}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{analysis.repository_url}</p>
                      {analysis.branch ? (
                        <p className="mt-1 text-xs text-slate-500">Branch: {analysis.branch}</p>
                      ) : null}
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={analysis.status} />
                      {analysis.error_message ? (
                        <p className="mt-2 max-w-xs text-xs text-rose-600">
                          {analysis.error_message}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-4 pr-4">
                      <p>{formatDateTime(analysis.submitted_at)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatRelativeTime(analysis.submitted_at)}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <p>{formatDateTime(analysis.updated_at)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Synced {formatRelativeTime(analysis.last_synced_at)}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      {analysis.code_metric ? (
                        <div className="space-y-1 text-xs text-slate-600">
                          <p>{formatInteger(analysis.code_metric.file_count)} files</p>
                          <p>
                            {formatInteger(analysis.code_metric.commit_count)} commits visible
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Waiting on completion</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleRefresh(analysis.id)}
                          isLoading={refreshingId === analysis.id}
                        >
                          Refresh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDelete(analysis.id)}
                          isLoading={deletingId === analysis.id}
                          className="text-red-600 hover:bg-red-50 border-red-200"
                        >
                          Delete
                        </Button>
                        {analysis.code_metric && (
                          <button
                            onClick={() => setShowExport(analysis.id)}
                            className="focus-ring inline-flex h-9 items-center justify-center rounded-panel px-3 text-sm font-medium text-ink transition hover:bg-black/5 hover:scale-105"
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
                            'focus-ring inline-flex h-9 items-center justify-center rounded-panel px-3 text-sm font-medium text-ink transition hover:bg-black/5',
                          )}
                        >
                          View detail
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
