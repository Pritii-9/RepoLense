import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  RefreshCw,
  Trash2,
  Download,
  ExternalLink,
  Terminal,
  History as HistoryIcon
} from 'lucide-react'

import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { TaskLogsDrawer } from '@/components/TaskLogsDrawer'
import { useAnalysis } from '@/hooks/useAnalysis'
import { usePollStatus } from '@/hooks/usePollStatus'
import { useToast } from '@/hooks/useToast'
import { formatRelativeTime } from '@/utils/dateHelpers'
import { formatInteger } from '@/utils/formatters'
import { ExportModal } from '@/components/ExportModal'
import { ConfirmModal } from '@/components/ConfirmModal'

export function HistoryPage() {
  const { analyses, isHydrated, refreshAnalysis, deleteAnalysis } = useAnalysis()
  const { pushToast } = useToast()
  
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showExport, setShowExport] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  
  // Segmented filters and search
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Slide-over Drawer State
  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState<boolean>(false)
  const [drawerAnalysisId, setDrawerAnalysisId] = useState<string | null>(null)
  const [drawerRepoName, setDrawerRepoName] = useState<string>('')
  const [drawerStatus, setDrawerStatus] = useState<string>('')

  usePollStatus(
    analyses.map((analysis) => ({
      id: analysis.id,
      status: analysis.status,
    })),
  )

  const exportTargetAnalysis = useMemo(
    () => analyses.find((a) => a.id === showExport),
    [analyses, showExport],
  )

  const filteredAnalyses = useMemo(() => {
    // Sort all analyses by date descending (most recent first)
    const sorted = [...analyses].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    )
    
    return sorted.filter((analysis) => {
      const matchesStatus = statusFilter === 'all' || analysis.status === statusFilter
      const matchesSearch =
        analysis.repository_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        analysis.repository_url.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [analyses, statusFilter, searchTerm])

  const openDrawer = (id: string, repoName: string, statusVal: string) => {
    setDrawerAnalysisId(id)
    setDrawerRepoName(repoName)
    setDrawerStatus(statusVal)
    setIsLogsDrawerOpen(true)
  }

  const handleRefresh = async (analysisId: string) => {
    try {
      setRefreshingId(analysisId)
      await refreshAnalysis(analysisId)
      pushToast({
        title: 'Analysis restarted.',
        description: 'The analysis task has been queued.',
        tone: 'success',
      })
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
        <Skeleton className="h-16 w-full rounded-xl bg-zinc-200 dark:bg-zinc-900" />
        <Skeleton className="h-80 w-full rounded-xl bg-zinc-200 dark:bg-zinc-900" />
      </div>
    )
  }

  return (
    <div className="space-y-8 w-full max-w-7xl mx-auto pb-12">
      {/* Header Panel */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 sm:p-8 transition-colors shadow-xs">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <HistoryIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
              Analysis Archive
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-3xl mt-1">
              A complete chronological archive of all indexing, telemetry generation, and AST parsing tasks submitted to the engine.
            </p>
          </div>
        </div>
      </section>

      {/* Main Table Card */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5 transition-colors shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              All Analyses
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">({analyses.length} total)</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Filter, search, compare, and delete historical records.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input Box */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search repository..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56 font-mono"
              />
              <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-2.5 top-2 pointer-events-none" />
            </div>

            {/* Filter Status Tabs */}
            <div className="flex items-center p-1 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
              {(['all', 'running', 'completed', 'pending', 'failed'] as const).map((st) => (
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
                : 'Submit a GitHub repository from the Dashboard page to populate this list.'
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
                          <p className="mt-1 text-xs text-rose-500 dark:text-rose-400 truncate max-w-xs" title={analysis.error_message}>
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
                            onClick={() => openDrawer(analysis.id, analysis.repository_name, analysis.status)}
                            className="px-2.5 py-1 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg flex items-center gap-1.5 text-xs font-mono font-medium border border-indigo-200 dark:border-indigo-800/60 transition-colors"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Logs</span>
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

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowExport(analysis.id)}
                            className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                            title="Export report"
                          >
                            <Download className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(analysis.id)}
                            isLoading={deletingId === analysis.id}
                            className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
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

      {/* Drawer and Modals */}
      <TaskLogsDrawer
        isOpen={isLogsDrawerOpen}
        analysisId={drawerAnalysisId}
        repositoryName={drawerRepoName}
        status={drawerStatus}
        onClose={() => setIsLogsDrawerOpen(false)}
      />

      {showExport && exportTargetAnalysis && (
        <ExportModal
          isOpen={Boolean(showExport)}
          analysis={exportTargetAnalysis}
          onClose={() => setShowExport(null)}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title="Delete Analysis"
        message="Are you sure you want to delete this repository analysis record? This action cannot be undone."
        confirmText="Delete Record"
        isLoading={Boolean(deletingId)}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}
