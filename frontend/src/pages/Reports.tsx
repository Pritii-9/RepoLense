import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
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
    <Card
      title="Reports"
      description="Generated reports are available for direct secure download via temporary presigned URLs."
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No reports available yet"
          description="Completed analyses with generated CSV or PDF reports will show up here."
        />
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="min-w-full divide-y divide-black/5 dark:divide-white/10 text-left text-sm">
            <thead>
              <tr className="text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4 font-medium">File</th>
                <th className="py-3 pr-4 font-medium">Repository</th>
                <th className="py-3 pr-4 font-medium">Type</th>
                <th className="py-3 pr-4 font-medium">Size</th>
                <th className="py-3 pr-4 font-medium">Generated</th>
                <th className="py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {rows.map(({ analysisId, repositoryName, report }) => (
                <tr key={report.id}>
                  <td className="py-4 pr-4 font-mono font-medium text-ink dark:text-slate-100">{report.file_name}</td>
                  <td className="py-4 pr-4">
                    <Link
                      to={`/analyses/${analysisId}`}
                      className="focus-ring rounded-lg text-sm font-mono text-ink hover:text-primary-700 dark:text-slate-100 dark:hover:text-primary-400"
                    >
                      {repositoryName}
                    </Link>
                  </td>
                  <td className="py-4 pr-4">
                    {report.report_type === 'pdf' ? (
                      <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full text-xs font-medium">PDF</span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-medium">CSV</span>
                    )}
                  </td>
                  <td className="py-4 pr-4"><span className="text-slate-400 dark:text-slate-500">—</span></td>
                  <td className="py-4 pr-4">{formatDateTime(report.created_at)}</td>
                  <td className="py-4">
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Download"
                        className="w-8 h-8 !p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-all rounded-md"
                        isLoading={downloadingId === report.id}
                        onClick={() => void handleDownload(report)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete Analysis"
                        className="w-8 h-8 !p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-slate-800 transition-all rounded-md"
                        isLoading={deletingId === analysisId}
                        onClick={() => void handleDelete(analysisId)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Note: Report sizes are calculated asynchronously and will populate upon indexing completion.
          </p>
        </div>
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
    </Card>
  )
}
