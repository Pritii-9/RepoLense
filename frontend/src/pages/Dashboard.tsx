import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Clock,
  Activity,
  CheckCircle2,
  GitBranch,
  RefreshCw,
  Trash2,
  Download,
  Eye,
  FolderPlus,
  ArrowUpRight,
  ExternalLink
} from 'lucide-react'

import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { LiveTerminal } from '@/components/LiveTerminal'
import { useAnalysis } from '@/hooks/useAnalysis'
import { usePollStatus } from '@/hooks/usePollStatus'
import { useToast } from '@/hooks/useToast'
import { formatRelativeTime } from '@/utils/dateHelpers'
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

  // Terminal & comparison state
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)
  const [activeRepoName, setActiveRepoName] = useState<string>('')
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all')
  const [searchTerm, setSearchTerm] = useState('')

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
    const failed = analyses.filter((analysis) => analysis.status === 'failed').length

    return { pending, running, completed, failed }
  }, [analyses])

  const filteredAnalyses = useMemo(() => {
    return analyses.filter((analysis) => {
      const matchesStatus = statusFilter === 'all' || analysis.status === statusFilter
      const matchesSearch =
        analysis.repository_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        analysis.repository_url.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [analyses, statusFilter, searchTerm])

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

  const handleGitHubImport = async (repoUrl: string, selectedBranch: string) => {
    try {
      const created = await submitRepository({
        repository_url: repoUrl,
        branch: selectedBranch || undefined,
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
      <div className="space-y-6 w-full max-w-7xl mx-auto py-6">
        <Skeleton className="h-44 w-full rounded-xl bg-zinc-200 dark:bg-zinc-900" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 rounded-xl bg-zinc-200 dark:bg-zinc-900" />
          <Skeleton className="h-28 rounded-xl bg-zinc-200 dark:bg-zinc-900" />
          <Skeleton className="h-28 rounded-xl bg-zinc-200 dark:bg-zinc-900" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl bg-zinc-200 dark:bg-zinc-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      {/* ========================================================================= */}
      {/* 1. TOP SECTION (INPUT & CONTROLS - RENDER.COM CLEAN DESIGN)               */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 transition-colors shadow-xs">
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
              Submit a Task
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                AST & Telemetry Engine
              </span>
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
              Enter any public or private GitHub repository URL to initiate full dependency indexing, code metric parsing, and real-time git analysis.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Repository URL Input */}
              <div className="md:col-span-7 space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Repository URL <span className="text-indigo-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500 z-10">
                    <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-400 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={repositoryUrl}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setRepositoryUrl(e.target.value)
                      setErrors({})
                    }}
                    placeholder="https://github.com/owner/repository"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono shadow-xs"
                    required
                  />
                </div>
                {errors.repositoryUrl && (
                  <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">{errors.repositoryUrl}</p>
                )}
              </div>

              {/* Branch Name Input */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Branch Name <span className="text-zinc-400 dark:text-zinc-500">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono shadow-xs"
                  />
                </div>
              </div>

              {/* Solid Accent Submit Button */}
              <div className="md:col-span-2 pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-xs transition-all flex items-center justify-center gap-2 border-none disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Submit Task</span>
                </button>
              </div>
            </div>

            {/* Alternative Action Link */}
            <div className="flex items-center gap-3 pt-2">
              <span className="text-xs text-zinc-400 font-medium">or</span>
              <button
                type="button"
                onClick={() => setShowGitHubImporter(true)}
                className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 hover:underline transition-all cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Import from GitHub Organizations or Cloud Storage
                <ArrowUpRight className="w-3 h-3 opacity-70" />
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. METRIC CARDS (MUTED RENDER AESTHETIC)                                 */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Queued Metric Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 transition-colors shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Queued
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-zinc-900 dark:text-white font-mono">
              {formatInteger(stats.pending)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {stats.pending > 0 || isPolling ? `${activeCount} active poll(s)` : 'No active queue'}
            </span>
          </div>
        </div>

        {/* Running Metric Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 transition-colors shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Running
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 relative">
              <Activity className="w-4 h-4" />
              {stats.running > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              )}
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-zinc-900 dark:text-white font-mono">
              {formatInteger(stats.running)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Active background tasks</span>
          </div>
        </div>

        {/* Completed Metric Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 transition-colors shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Completed
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-zinc-900 dark:text-white font-mono">
              {formatInteger(stats.completed)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Indexed & archived in history</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. LIVE TERMINAL (SHOWN UPON ACTIVE TASK OR SUBMISSION)                  */}
      {/* ========================================================================= */}
      {activeTerminalId && (
        <LiveTerminal
          analysisId={activeTerminalId}
          repositoryName={activeRepoName}
          onClose={() => setActiveTerminalId(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. DATA TABLE (RECENT ANALYSES)                                           */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5 transition-colors shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              Recent Analyses
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">({analyses.length} total)</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Manage, inspect, compare, and export repository analyses.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input Box */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search repository..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56 font-mono"
              />
              <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-2.5 top-2 pointer-events-none" />
            </div>

            {/* Filter Status Tabs */}
            <div className="flex items-center p-1 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
              {(['all', 'running', 'completed', 'pending'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium border border-zinc-200 dark:border-zinc-700/60 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Comparison Trigger */}
            {selectedForCompare.length > 0 && (
              <Button
                onClick={() => {
                  window.location.href = `/compare?ids=${selectedForCompare.join(',')}`
                }}
                disabled={selectedForCompare.length < 2}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-xs"
              >
                Compare ({selectedForCompare.length})
              </Button>
            )}
          </div>
        </div>

        {/* Table Container */}
        {filteredAnalyses.length === 0 ? (
          <EmptyState
            title="No analyses found"
            description={
              searchTerm || statusFilter !== 'all'
                ? 'No repository records match your current filter criteria.'
                : 'Submit a GitHub repository above to begin your first analysis run.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-950">
                  <th className="py-3.5 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-indigo-600 focus:ring-indigo-500"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedForCompare(filteredAnalyses.map((a) => a.id))
                        } else {
                          setSelectedForCompare([])
                        }
                      }}
                      checked={
                        filteredAnalyses.length > 0 &&
                        selectedForCompare.length === filteredAnalyses.length
                      }
                    />
                  </th>
                  <th className="py-3.5 px-4">Repository</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Submitted</th>
                  <th className="py-3.5 px-4">Last Update</th>
                  <th className="py-3.5 px-4">Metrics</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 text-sm">
                {filteredAnalyses.map((analysis) => {
                  const isSelected = selectedForCompare.includes(analysis.id)
                  return (
                    <tr
                      key={analysis.id}
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${
                        isSelected ? 'bg-indigo-500/5' : ''
                      }`}
                    >
                      <td className="py-4 pl-4 pr-2">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-indigo-600 focus:ring-indigo-500"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedForCompare((prev) => [...prev, analysis.id])
                            } else {
                              setSelectedForCompare((prev) => prev.filter((id) => id !== analysis.id))
                            }
                          }}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <Link
                          to={`/analyses/${analysis.id}`}
                          className="font-bold font-mono text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 hover:underline flex items-center gap-1.5"
                        >
                          {analysis.repository_name}
                        </Link>
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <a
                            href={analysis.repository_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-1"
                          >
                            <span>{analysis.repository_url}</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                          {analysis.branch && (
                            <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 font-mono text-[10px]">
                              {analysis.branch}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge status={analysis.status} />
                        {analysis.error_message && (
                          <p className="mt-1 text-xs text-rose-500 dark:text-rose-400 truncate max-w-xs">
                            {analysis.error_message}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                        {formatRelativeTime(analysis.submitted_at)}
                      </td>
                      <td className="py-4 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                        {formatRelativeTime(analysis.updated_at)}
                      </td>
                      <td className="py-4 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                        {analysis.code_metric ? (
                          <div className="space-y-0.5 font-mono text-[11px]">
                            <p>
                              Files:{' '}
                              <span className="text-zinc-900 dark:text-white font-semibold">
                                {formatInteger(analysis.code_metric.file_count)}
                              </span>
                            </p>
                            <p>
                              Commits:{' '}
                              <span className="text-zinc-900 dark:text-white font-semibold">
                                {formatInteger(analysis.code_metric.commit_count)}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 italic">Processing metrics...</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setActiveTerminalId(analysis.id)
                              setActiveRepoName(analysis.repository_name)
                            }}
                            className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                            title="View Terminal Logs"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRefresh(analysis.id)}
                            isLoading={refreshingId === analysis.id}
                            className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                            title="Re-run analysis"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>

                          {analysis.code_metric && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowExport(analysis.id)}
                              className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                              title="Export report"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(analysis.id)}
                            isLoading={deletingId === analysis.id}
                            className="p-1.5 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg"
                            title="Delete analysis"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modals */}
      {showExport && (
        <ExportModal
          analysis={analyses.find((a) => a.id === showExport)!}
          isOpen={!!showExport}
          onClose={() => setShowExport(null)}
        />
      )}
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
