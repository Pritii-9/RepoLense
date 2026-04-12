import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useToast } from '@/hooks/useToast'
import { triggerReportDownload } from '@/services/reports'
import type { ReportResponse } from '@/types/api'
import { formatDateTime } from '@/utils/dateHelpers'
import { formatBytes, formatReportType } from '@/utils/formatters'

interface ReportRow {
  repositoryName: string
  analysisId: string
  report: ReportResponse
}

export function ReportsPage() {
  const { analyses } = useAnalysis()
  const { pushToast } = useToast()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

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

  return (
    <Card
      title="Reports"
      description="Each download requests a fresh presigned URL from Stage 1 so the browser can fetch the file directly."
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No reports available yet"
          description="Completed analyses with generated CSV or PDF reports will show up here."
        />
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="min-w-full divide-y divide-black/5 text-left text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="py-3 pr-4 font-medium">File</th>
                <th className="py-3 pr-4 font-medium">Repository</th>
                <th className="py-3 pr-4 font-medium">Type</th>
                <th className="py-3 pr-4 font-medium">Size</th>
                <th className="py-3 pr-4 font-medium">Generated</th>
                <th className="py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map(({ analysisId, repositoryName, report }) => (
                <tr key={report.id}>
                  <td className="py-4 pr-4 font-medium text-ink">{report.file_name}</td>
                  <td className="py-4 pr-4">
                    <Link
                      to={`/analyses/${analysisId}`}
                      className="focus-ring rounded-panel text-sm text-ink hover:text-primary-700"
                    >
                      {repositoryName}
                    </Link>
                  </td>
                  <td className="py-4 pr-4">{formatReportType(report.report_type)}</td>
                  <td className="py-4 pr-4">{formatBytes(null)}</td>
                  <td className="py-4 pr-4">{formatDateTime(report.created_at)}</td>
                  <td className="py-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={downloadingId === report.id}
                      onClick={() => void handleDownload(report)}
                    >
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-sm text-slate-500">
            Report size is not included in the current Stage 1 metadata contract, so RepoLens
            keeps the column ready without guessing.
          </p>
        </div>
      )}
    </Card>
  )
}
