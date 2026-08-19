import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Download, Trash2, FileSpreadsheet, ArrowUpRight } from 'lucide-react'

import { Button } from '@/components/Button'
import { ConfirmModal } from '@/components/ConfirmModal'
import { EmptyState } from '@/components/EmptyState'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useToast } from '@/hooks/useToast'
import { triggerReportDownload } from '@/services/reports'
import type { ReportResponse } from '@/types/api'
import { formatDateTime } from '@/utils/dateHelpers'

interface ReportRow {
  repositoryName: string
  analysisId: string
  report: ReportResponse
}

export function ReportsPage() {
  const { analyses, deleteAnalysis } = useAnalysis()
  const { pushToast } = useToast()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const rows = useMemo<ReportRow[]>(
    () =>
      analyses
        .flatMap((analysis) =>
          analysis.reports.map((report) => ({
            repositoryName: analysis.repository_name,
            analysisId: analysis.id,
            report,
          })),
        )
        .sort(
          (left, right) =>
            new Date(right.report.created_at).getTime() -
            new Date(left.report.created_at).getTime(),
        ),
    [analyses],
  )

  const handleDownload = async (report: ReportResponse) => {
    try {
      setDownloadingId(report.id)
      await triggerReportDownload(report)
      pushToast({
        title: 'Download started.',
        description: `${report.file_name} is being fetched from its presigned URL.`,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: 'Download failed.',
        description: error instanceof Error ? error.message : 'Unable to fetch download URL.',
        tone: 'error',
      })
    } finally {
      setDownloadingId(null)
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
        description: 'Analysis and its reports have been removed.',
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

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6 transition-colors shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
              Generated Reports
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                PDF & CSV
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
              Generated reports are available for direct secure download via temporary presigned URLs and immutable storage keys.
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No reports available yet"
            description="Completed analyses with generated CSV or PDF reports will show up here."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-950">
                  <th className="py-3.5 px-4">File Name</th>
                  <th className="py-3.5 px-4">Repository</th>
                  <th className="py-3.5 px-4">Format</th>
                  <th className="py-3.5 px-4">Generated</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 text-sm">
                {rows.map(({ analysisId, repositoryName, report }) => (
                  <tr key={report.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-4 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
                      {report.report_type === 'pdf' ? (
                        <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4 text-indigo-500 shrink-0" />
                      )}
                      <span>{report.file_name}</span>
                    </td>
                    <td className="py-4 px-4">
                      <Link
                        to={`/analyses/${analysisId}`}
                        className="font-bold font-mono text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:underline flex items-center gap-1"
                      >
                        <span>{repositoryName}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-60" />
                      </Link>
                    </td>
                    <td className="py-4 px-4">
                      {report.report_type === 'pdf' ? (
                        <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 rounded-md text-xs font-medium">PDF</span>
                      ) : (
                        <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-md text-xs font-medium">CSV</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDateTime(report.created_at)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Download Report"
                          className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                          isLoading={downloadingId === report.id}
                          onClick={() => void handleDownload(report)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete Analysis"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                          isLoading={deletingId === analysisId}
                          onClick={() => void handleDelete(analysisId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
    </div>
  )
}
