import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, getErrorMessage } from '@/services/api'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { MetricTile } from '@/components/MetricTile'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { useAnalysis } from '@/hooks/useAnalysis'
import { usePollStatus } from '@/hooks/usePollStatus'
import { useToast } from '@/hooks/useToast'
import { getAiInsights } from '@/services/aiInsights'
import { fetchReportText } from '@/services/reports'
import type {
  AiArchitectureInsight,
  AiInsightResponse,
  AiRepositorySummary,
  CsvHotspot,
  ReportResponse,
  StoredAnalysis,
} from '@/types/api'
import { ChatPanel } from '@/components/ChatPanel'
import { parseAnalysisCsvReport } from '@/utils/analysisCsv'
import { formatDateTime, formatShortDate } from '@/utils/dateHelpers'
import {
  formatInteger,
  formatNumber,
  formatPercent,
  truncateMiddle,
} from '@/utils/formatters'

const pieColors = ['#1fb37f', '#fb8740', '#14b8a6', '#e11d48', '#7c3aed']

function reportOfType(reports: ReportResponse[], reportType: ReportResponse['report_type']) {
  return reports.find((report) => report.report_type === reportType)
}

function extensionLabel(filePath: string) {
  const extension = filePath.split('.').pop()
  return extension ? extension.toUpperCase() : 'OTHER'
}

function sameRepository(history: StoredAnalysis[], current: StoredAnalysis) {
  return history.filter((analysis) => analysis.repository_url === current.repository_url)
}

export function AnalysisDetail() {
  const { analysisId } = useParams()
  const { analyses, getAnalysisById, refreshAnalysis, isHydrated } = useAnalysis()
  const { pushToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [hotspots, setHotspots] = useState<CsvHotspot[]>([])
  const [isReportLoading, setIsReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [aiInsights, setAiInsights] = useState<AiInsightResponse[]>([])
  const [isAiLoading, setIsAiLoading] = useState(false)

  const analysis = analysisId ? getAnalysisById(analysisId) : undefined

  usePollStatus(
    analysis
      ? [
          {
            id: analysis.id,
            status: analysis.status,
          },
        ]
      : [],
  )

  useEffect(() => {
    if (!analysisId || analysis) {
      return
    }

    void (async () => {
      try {
        setIsLoading(true)
        await refreshAnalysis(analysisId)
      } catch (error) {
        pushToast({
          title: 'Unable to load analysis.',
          description: error instanceof Error ? error.message : 'Please try again.',
          tone: 'error',
        })
      } finally {
        setIsLoading(false)
      }
    })()
  }, [analysis, analysisId, pushToast, refreshAnalysis])

  useEffect(() => {
    if (!analysis) {
      return
    }

    const csvReport = reportOfType(analysis.reports, 'csv')
    if (analysis.status !== 'completed' || !csvReport) {
      setHotspots([])
      setReportError(null)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        setIsReportLoading(true)
        const csvText = await fetchReportText(csvReport.id)
        if (cancelled) {
          return
        }

        const parsed = parseAnalysisCsvReport(csvText)
        setHotspots(parsed.hotspots)
        setReportError(null)
      } catch (error) {
        if (!cancelled) {
          setHotspots([])
          setReportError(
            error instanceof Error
              ? error.message
              : 'Unable to read the CSV report for chart enrichment.',
          )
        }
      } finally {
        if (!cancelled) {
          setIsReportLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [analysis])

  useEffect(() => {
    if (!analysis || analysis.status !== 'completed') {
      setAiInsights([])
      setIsAiLoading(false)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        setIsAiLoading(true)
        const insights = await getAiInsights(analysis.id)
        if (!cancelled) {
          setAiInsights(insights)
        }
      } catch {
        if (!cancelled) {
          setAiInsights([])
        }
      } finally {
        if (!cancelled) {
          setIsAiLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [analysis])

  const trendData = useMemo(() => {
    if (!analysis) {
      return []
    }

    return sameRepository(analyses, analysis)
      .filter((item) => item.code_metric)
      .sort(
        (left, right) =>
          new Date(left.submitted_at).getTime() - new Date(right.submitted_at).getTime(),
      )
      .map((item) => ({
        label: formatShortDate(item.submitted_at),
        commitCount: item.code_metric?.commit_count ?? 0,
        maintainability: item.code_metric?.maintainability_index ?? 0,
        technicalDebt: item.code_metric?.technical_debt_score ?? 0,
      }))
  }, [analyses, analysis])

  const barData = useMemo(
    () =>
      hotspots.slice(0, 8).map((hotspot) => ({
        name: hotspot.entityName,
        label: truncateMiddle(`${hotspot.filePath}:${hotspot.lineNumber}`, 28),
        complexity: hotspot.complexity,
      })),
    [hotspots],
  )

  const navigate = useNavigate()

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this analysis? All associated reports and AI insights will be permanently removed.')) {
      return
    }

    try {
      await api.delete(`/analysis/${analysisId}`)
      pushToast({
        title: 'Analysis deleted',
        description: 'The analysis has been removed successfully.',
        tone: 'success',
      })
      navigate('/dashboard')
    } catch (error) {
      pushToast({
        title: 'Delete failed',
        description: getErrorMessage(error),
        tone: 'error',
      })
    }
  }

  const handleRefresh = async () => {
    if (analysisId) {
      await refreshAnalysis(analysisId)
    }
  }

  const languageData = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const hotspot of hotspots) {
      const key = extensionLabel(hotspot.filePath)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }

    return Array.from(buckets.entries()).map(([name, value]) => ({
      name,
      value,
    }))
  }, [hotspots])

  const heatmapData = useMemo(() => {
    return hotspots.map(h => ({
      name: truncateMiddle(h.entityName, 20),
      fullName: h.filePath,
      size: h.complexity,
    })).sort((a, b) => b.size - a.size).slice(0, 50);
  }, [hotspots]);

  if (!isHydrated || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!analysis) {
    return (
      <EmptyState
        title="Analysis not found"
        description="This analysis is not in the local workspace history yet. Submit it again from the dashboard or refresh its status once it exists."
      />
    )
  }

  const metrics = analysis.code_metric

  return (
    <div className="space-y-6">
      <Card
        title={analysis.repository_name}
        description={analysis.repository_url}
        action={<StatusBadge status={analysis.status} />}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>Submitted {formatDateTime(analysis.submitted_at)}</span>
          {analysis.branch ? <span>Branch {analysis.branch}</span> : null}
          {analysis.completed_at ? (
            <span>Completed {formatDateTime(analysis.completed_at)}</span>
          ) : null}
        </div>

        {analysis.error_message ? (
          <p className="mt-4 rounded-panel bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {analysis.error_message}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            Refresh status
          </Button>
          <Button onClick={handleDelete} variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200">
            Delete Analysis
          </Button>
          <Link
            to="/reports"
            className="focus-ring inline-flex h-11 items-center justify-center rounded-panel px-4 text-sm font-medium text-ink transition hover:bg-black/5"
          >
            Open reports
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Files scanned"
          value={formatInteger(metrics?.file_count)}
          hint="Source files included in the analysis snapshot."
          tone="cool"
        />
        <MetricTile
          label="Maintainability"
          value={formatPercent(metrics?.maintainability_index)}
          hint="Average maintainability index across Python files."
        />
        <MetricTile
          label="Technical debt"
          value={formatPercent(metrics?.technical_debt_score)}
          hint="Weighted debt score from complexity, duplication, and maintainability."
          tone="warm"
        />
        <MetricTile
          label="Commits visible"
          value={formatInteger(metrics?.commit_count)}
          hint="Visible from the shallow clone used by Stage 1."
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Complexity hotspots"
          description="Bar chart of the most complex entities found in the CSV report."
        >
          {isReportLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : barData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 12, right: 12, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe4dc" />
                  <XAxis dataKey="label" angle={-12} height={56} textAnchor="end" tickMargin={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="complexity" radius={[6, 6, 0, 0]} fill="#1fb37f" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No hotspot chart yet"
              description={
                reportError ??
                'Hotspot charts become available after the completed analysis CSV can be fetched.'
              }
            />
          )}
        </Card>

        <Card
          title="Trend over analyses"
          description="RepoLens uses the repository history in your local workspace to show how quality metrics move between runs."
        >
          {trendData.length > 1 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 12, right: 12, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe4dc" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="maintainability"
                    stroke="#1fb37f"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    name="Maintainability"
                  />
                  <Line
                    type="monotone"
                    dataKey="technicalDebt"
                    stroke="#fb8740"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    name="Technical debt"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="Trend line needs at least two completed runs"
              description="Run another analysis for this repository to compare maintainability and technical debt over time."
            />
          )}
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card
          title="Language distribution"
          description="Grouped by file extension from the parsed hotspot report when available."
        >
          {languageData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={languageData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={96}
                    paddingAngle={3}
                  >
                    {languageData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={pieColors[index % pieColors.length] ?? pieColors[0]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="Language mix unavailable"
              description="Stage 1 does not expose language distribution directly, so RepoLens only renders this pie chart when the CSV hotspot report can be parsed."
            />
          )}
        </Card>

        <Card
          title="File heatmap"
          description="Higher-complexity hotspots burn brighter. Hover or tap the file names for more context."
        >
          {heatmapData.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {heatmapData.map((hotspot) => {
                const intensity = Math.min(0.88, hotspot.complexity / 24)
                return (
                  <div
                    key={`${hotspot.filePath}-${hotspot.entityName}-${hotspot.lineNumber}`}
                    className="rounded-panel p-4 text-white shadow-soft"
                    style={{ backgroundColor: `rgba(13, 148, 136, ${Math.max(0.2, intensity)})` }}
                    title={`${hotspot.filePath} - ${hotspot.entityName} - line ${hotspot.lineNumber}`}
                  >
                    <p className="text-xs uppercase tracking-wide text-white/80">
                      {extensionLabel(hotspot.filePath)}
                    </p>
                    <p className="mt-2 break-words text-sm font-semibold">{hotspot.filePath}</p>
                    <p className="mt-2 text-xs text-white/85">{hotspot.entityName}</p>
                    <p className="mt-4 text-sm font-medium">
                      Complexity {formatNumber(hotspot.complexity)}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title="No heatmap data yet"
              description="The heatmap is sourced from the CSV hotspot report after a completed analysis."
            />
          )}
        </Card>
      </section>

      <section className="grid gap-6">
        <Card
          title="Code Complexity Heatmap"
          description="Visual distribution of technical debt and complexity hotspots across files."
        >
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={heatmapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                fill="#1fb37f"
              >
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-panel bg-white p-3 shadow-premium border border-slate-100">
                          <p className="text-xs font-bold text-slate-800">{data.fullName}</p>
                          <p className="text-xs text-slate-500">Complexity: {data.size}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Architectural Analysis"
          description={
            aiInsights.find((i) => i.insight_type === 'architecture')
              ? `Inferred Architecture | ${aiInsights.find((i) => i.insight_type === 'architecture')?.model_used}`
              : 'Deep dive into system design'
          }
        >
          {(() => {
            const archInsight = aiInsights.find((i) => i.insight_type === 'architecture')
            if (!archInsight) {
              return (
                <EmptyState
                  title="Architecture data unavailable"
                  description="Architectural analysis is generated alongside the summary during analysis."
                />
              )
            }

            const data = archInsight.structured_data as unknown as AiArchitectureInsight

            return (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tech Stack</h4>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {Object.entries(data.tech_stack).map(([key, value]) => (
                      <div key={key} className="rounded bg-slate-50 p-2 border border-slate-100">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">{key}</span>
                        <p className="text-sm font-semibold text-slate-700">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Design Patterns</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.design_patterns.map((pattern) => (
                      <span key={pattern} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 border border-primary-100">
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Structure & Modularization</h4>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {data.modularization_description}
                  </p>
                </div>

                <div className="rounded-panel border border-amber-100 bg-amber-50/50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600">Architect's Notes</h4>
                  <p className="mt-2 text-sm text-amber-800 italic">
                    "{data.architectural_notes}"
                  </p>
                </div>
              </div>
            )
          })()}
        </Card>

        {analysisId && <ChatPanel analysisId={analysisId} repositoryName={analysis?.repository_name} />}
      </section>

      <section className="grid gap-6">
        <Card
          title="AI Insights"
          description={
            aiInsights.length > 0
              ? `Generated by ${aiInsights[0]?.model_used} | v${aiInsights[0]?.prompt_version}`
              : 'AI-powered analysis of your repository'
          }
        >
          {isAiLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : aiInsights.length > 0 ? (
            (() => {
              const insight = aiInsights[0]
              if (!insight) {
                return (
                  <EmptyState
                    title="AI summary unavailable"
                    description="The AI insight payload was empty."
                  />
                )
              }

              const summary = insight.structured_data as unknown as
                | AiRepositorySummary
                | undefined

              if (!summary) {
                return (
                  <EmptyState
                    title="AI summary unavailable"
                    description="The AI insight was stored but could not be parsed for display."
                  />
                )
              }

              return (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white"
                      style={{
                        backgroundColor:
                          summary.code_health_score >= 70
                            ? '#1fb37f'
                            : summary.code_health_score >= 40
                              ? '#fb8740'
                              : '#e11d48',
                      }}
                    >
                      {Math.round(summary.code_health_score)}
                    </div>
                    <div>
                      <p className="font-semibold">Code Health Score</p>
                      <p className="text-sm text-slate-500">{summary.overview}</p>
                    </div>
                  </div>

                  {summary.strengths.length > 0 && (
                    <div>
                      <h4 className="font-medium text-emerald-700">Strengths</h4>
                      <ul className="mt-2 space-y-1">
                        {summary.strengths.map((strength) => (
                          <li key={strength} className="text-sm text-slate-600">
                            - {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.risks.length > 0 && (
                    <div>
                      <h4 className="font-medium text-rose-700">Risks</h4>
                      <ul className="mt-2 space-y-1">
                        {summary.risks.map((risk) => (
                          <li key={risk} className="text-sm text-slate-600">
                            - {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.top_recommendations.length > 0 && (
                    <div className="rounded-panel bg-primary-50 p-4">
                      <h4 className="font-medium text-primary-800">Top Recommendations</h4>
                      <ol className="mt-2 space-y-2">
                        {summary.top_recommendations.map((recommendation, index) => (
                          <li
                            key={`${recommendation}-${index}`}
                            className="text-sm text-primary-700"
                          >
                            {index + 1}. {recommendation}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>Latency: {insight.latency_ms}ms</span>
                    <span>Cost: ~${insight.estimated_cost_usd.toFixed(5)}</span>
                    <span>
                      Tokens: {formatInteger(insight.input_tokens)} in /{' '}
                      {formatInteger(insight.output_tokens)} out
                    </span>
                  </div>
                </div>
              )
            })()
          ) : (
            <EmptyState
              title="AI analysis not available"
              description="AI insights will appear after analysis completes if AI analysis is enabled."
            />
          )}
        </Card>
      </section>
    </div>
  )
}
