import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, getErrorMessage } from '@/services/api'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { MetricTile } from '@/components/MetricTile'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { SemanticSearch } from '@/components/SemanticSearch'
import { TechStackBadges } from '@/components/TechStackBadges'
import { useAnalysis } from '@/hooks/useAnalysis'
import { usePollStatus } from '@/hooks/usePollStatus'
import { useToast } from '@/hooks/useToast'
import { getAiInsights } from '@/services/aiInsights'
import type {
  AiArchitectureInsight,
  AiInsightResponse,
  AiRepositorySummary,
  StoredAnalysis,
} from '@/types/api'
import { ChatPanel } from '@/components/ChatPanel'
import { ConfirmModal } from '@/components/ConfirmModal'
import { formatDateTime, formatShortDate } from '@/utils/dateHelpers'
import {
  formatInteger,
  formatPercent,
} from '@/utils/formatters'
import { cn } from '@/utils/cn'

function sameRepository(history: StoredAnalysis[], current: StoredAnalysis) {
  return history.filter((analysis) => analysis.repository_url === current.repository_url)
}

export function AnalysisDetail() {
  const { analysisId } = useParams()
  const { analyses, getAnalysisById, refreshAnalysis, isHydrated } = useAnalysis()
  const { pushToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [aiInsights, setAiInsights] = useState<AiInsightResponse[]>([])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'search'>('overview')
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

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



  const navigate = useNavigate()

  const handleDelete = () => {
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
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
    } finally {
      setIsDeleting(false)
      setIsDeleteModalOpen(false)
    }
  }

  const handleRefresh = async () => {
    if (analysisId) {
      await refreshAnalysis(analysisId)
    }
  }

  const handleShare = async () => {
    if (!analysisId) return
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      pushToast({ title: 'Link copied!', description: 'Share link copied to clipboard.', tone: 'success' })
      return
    }
    setIsSharing(true)
    try {
      const res = await api.post<{ share_token?: string }>(`/analysis/${analysisId}/share`)
      const token = res.data.share_token
      if (token) {
        const url = `${window.location.origin}/share/${token}`
        setShareUrl(url)
        await navigator.clipboard.writeText(url)
        pushToast({ title: 'Share link created!', description: 'Link copied to clipboard. Anyone with this link can view the report.', tone: 'success' })
      }
    } catch (error) {
      pushToast({ title: 'Share failed', description: getErrorMessage(error), tone: 'error' })
    } finally {
      setIsSharing(false)
    }
  }

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

        {/* Tech Stack Badges */}
        {metrics?.tech_stack && metrics.tech_stack.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Tech Stack</p>
            <TechStackBadges badges={metrics.tech_stack} />
          </div>
        )}

        {analysis.error_message ? (
          <p className="mt-4 rounded-panel bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
            {analysis.error_message}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={handleRefresh} variant="secondary" size="sm">
            Refresh status
          </Button>
          {analysis.status === 'completed' && (
            <Button
              onClick={handleShare}
              variant="secondary"
              size="sm"
              className="flex items-center gap-1.5"
              disabled={isSharing}
            >
              {isSharing ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : shareUrl ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
              {isSharing ? 'Generating…' : shareUrl ? 'Copy link again' : 'Share report'}
            </Button>
          )}
          <Button onClick={handleDelete} variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 border border-rose-200 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:border-rose-800">
            Delete Analysis
          </Button>
          <Link
            to="/reports"
            className="focus-ring inline-flex h-11 items-center justify-center rounded-panel px-4 text-sm font-medium text-ink transition hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/5"
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

      {/* Tab bar */}
      <nav className="flex gap-1 bg-white/50 p-1 rounded-xl border border-white/60 shadow-inner w-fit dark:bg-slate-800/50 dark:border-slate-700/60">
        <button
          id="tab-overview"
          onClick={() => setActiveTab('overview')}
          className={cn(
            'px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
            activeTab === 'overview'
              ? 'bg-primary-600 text-white shadow'
              : 'text-slate-600 hover:text-ink hover:bg-black/5 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/5',
          )}
        >
          Overview
        </button>
        <button
          id="tab-code-search"
          onClick={() => analysis?.status === 'completed' && setActiveTab('search')}
          disabled={analysis?.status !== 'completed'}
          title={analysis?.status !== 'completed' ? 'Available after analysis completes' : undefined}
          className={cn(
            'px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2',
            activeTab === 'search'
              ? 'bg-primary-600 text-white shadow'
              : 'text-slate-600 hover:text-ink hover:bg-black/5 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/5',
            analysis?.status !== 'completed' && 'opacity-40 cursor-not-allowed',
          )}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          Code Search
        </button>
      </nav>
      {/* ── Code Search tab ── */}
      {activeTab === 'search' && analysisId && (
        <Card
          title="Semantic Code Search"
          description="Ask questions in plain English. Results are ranked by semantic similarity using the repository's vector index."
        >
          <SemanticSearch analysisId={analysisId} />
        </Card>
      )}

      {/* ── Overview tab ── */}
      {activeTab === 'overview' && (
        <>
          <section className="grid gap-6 xl:grid-cols-2">

        <Card
          title="AI Insights"
          description={
            aiInsights.length > 0
              ? `Generated by ${aiInsights[0]?.model_used} | v${aiInsights[0]?.prompt_version}`
              : 'AI-powered analysis of your repository'
          }
          className="relative overflow-hidden"
        >
          {isAiLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : aiInsights.length > 0 ? (
            (() => {
              const insight = aiInsights[0]
              if (!insight) return null

              const summary = insight.structured_data as unknown as AiRepositorySummary | undefined
              if (!summary) return null

              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-5 bg-white/40 p-4 rounded-xl border border-white/60 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/60">
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-black text-white shadow-glow"
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
                      <p className="font-bold text-ink text-lg tracking-tight dark:text-slate-100">Code Health</p>
                      <p className="text-sm text-slate-600 leading-snug dark:text-slate-400">{summary.overview}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {summary.strengths.length > 0 && (
                      <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50 dark:bg-emerald-900/20 dark:border-emerald-800/30">
                        <h4 className="font-bold text-emerald-800 flex items-center gap-2 dark:text-emerald-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Strengths
                        </h4>
                        <ul className="mt-2 space-y-1.5">
                          {summary.strengths.map((strength) => (
                            <li key={strength} className="text-sm text-emerald-900/80 leading-snug dark:text-emerald-200/80">
                              &bull; {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {summary.risks.length > 0 && (
                      <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100/50 dark:bg-rose-900/20 dark:border-rose-800/30">
                        <h4 className="font-bold text-rose-800 flex items-center gap-2 dark:text-rose-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Risks
                        </h4>
                        <ul className="mt-2 space-y-1.5">
                          {summary.risks.map((risk) => (
                            <li key={risk} className="text-sm text-rose-900/80 leading-snug dark:text-rose-200/80">
                              &bull; {risk}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {summary.top_recommendations.length > 0 && (
                    <div className="rounded-xl bg-primary-50/50 p-4 border border-primary-100/50 dark:bg-primary-900/20 dark:border-primary-800/30">
                      <h4 className="font-bold text-primary-900 flex items-center gap-2 dark:text-primary-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Top Recommendations
                      </h4>
                      <ol className="mt-3 space-y-2.5">
                        {summary.top_recommendations.map((recommendation, index) => (
                          <li
                            key={`${recommendation}-${index}`}
                            className="text-sm text-primary-900/80 flex gap-2 dark:text-primary-200/80"
                          >
                            <span className="font-bold text-primary-400">{index + 1}.</span> 
                            <span className="leading-snug">{recommendation}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium tracking-wide text-slate-400 uppercase bg-slate-50/50 p-2 rounded-lg justify-center dark:bg-slate-800/50">
                    <span>Lat: {insight.latency_ms}ms</span>
                    <span>Cost: ~${insight.estimated_cost_usd.toFixed(5)}</span>
                    <span>Tokens: {formatInteger(insight.input_tokens)} in / {formatInteger(insight.output_tokens)} out</span>
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Tech Stack</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(data.tech_stack).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-white/60 p-3 border border-black/5 shadow-sm dark:bg-slate-800/60 dark:border-white/5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{key}</span>
                        <p className="text-sm font-semibold text-ink mt-0.5 dark:text-slate-200">{value || 'None'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Design Patterns</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.design_patterns.map((pattern) => (
                      <span key={pattern} className="rounded-pill bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-100 shadow-sm dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50">
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Structure & Modularization</h4>
                  <p className="text-sm text-slate-600 leading-relaxed bg-white/40 p-3 rounded-xl border border-black/5 dark:text-slate-400 dark:bg-slate-800/40 dark:border-white/5">
                    {data.modularization_description}
                  </p>
                </div>

                <div className="rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 shadow-sm dark:border-amber-900/50 dark:from-amber-900/20 dark:to-amber-800/20">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1.5 dark:text-amber-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Architect's Notes
                  </h4>
                  <p className="text-sm text-amber-900 leading-relaxed italic dark:text-amber-200">
                    "{data.architectural_notes}"
                  </p>
                </div>
              </div>
            )
          })()}
        </Card>
      </section>

      {/* Chat Section (Floating) */}
      {analysisId && (
        <ChatPanel analysisId={analysisId} repositoryName={analysis?.repository_name} />
      )}

      {/* Conditionally Rendered Charts */}
      {trendData.length > 1 ? (
        <section className="grid gap-6">
          <Card
            title="Trend over analyses"
            description="RepoLens uses the repository history in your local workspace to show how quality metrics move between runs."
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 12, right: 12, left: 0, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe4dc" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }} />
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
          </Card>
        </section>
      ) : null}
        </>
      )}


      {isDeleteModalOpen && (
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Delete Analysis"
          message="Are you sure you want to delete this analysis? All associated reports and AI insights will be permanently removed."
          confirmText="Delete"
          cancelText="Cancel"
          isLoading={isDeleting}
        />
      )}
    </div>
  )
}
