import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card } from '@/components/Card'
import { MetricTile } from '@/components/MetricTile'
import { StatusBadge } from '@/components/StatusBadge'
import { TechStackBadges } from '@/components/TechStackBadges'
import { Skeleton } from '@/components/Skeleton'
import type { StoredAnalysis } from '@/types/api'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? ''

export function SharedAnalysisPage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!shareToken) return
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/analysis/${shareToken}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError((data as { detail?: string }).detail ?? 'Report not found or link revoked.')
        } else {
          setAnalysis(await res.json() as StoredAnalysis)
        }
      } catch {
        setError('Could not connect to server. Please try again later.')
      } finally {
        setLoading(false)
      }
    })()
  }, [shareToken])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Report Not Found</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{error ?? 'This shared report link is invalid or has been revoked by the owner.'}</p>
          <Link to="/auth" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
            Sign in to RepoLense
          </Link>
        </div>
      </div>
    )
  }

  const metric = analysis.code_metric

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Banner */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
            <span className="text-sm font-medium opacity-90">This is a read-only shared analysis report.</span>
          </div>
          <Link to="/auth" className="text-sm font-semibold underline underline-offset-2 hover:no-underline opacity-90">
            Analyze your own repo →
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{analysis.repository_name}</h1>
              <StatusBadge status={analysis.status} />
            </div>
            <a href={analysis.repository_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              {analysis.repository_url}
            </a>
            {analysis.branch && (
              <span className="ml-3 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
                branch: {analysis.branch}
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 text-right">
            <p>Analyzed on</p>
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              {analysis.completed_at ? new Date(analysis.completed_at).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>

        {/* Tech Stack */}
        {metric?.tech_stack && metric.tech_stack.length > 0 && (
          <Card>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Tech Stack</h2>
            <TechStackBadges badges={metric.tech_stack} />
          </Card>
        )}

        {/* Metrics Grid */}
        {metric && (
          <div>
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Code Quality Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricTile label="Files" value={metric.file_count.toLocaleString()} icon="📁" />
              <MetricTile label="Lines of Code" value={metric.line_count.toLocaleString()} icon="📝" />
              <MetricTile label="Commits" value={metric.commit_count.toLocaleString()} icon="🔀" />
              <MetricTile label="Technical Debt" value={`${metric.technical_debt_score.toFixed(1)}/100`} icon="⚠️" />
              <MetricTile label="Avg Complexity" value={metric.average_cyclomatic_complexity.toFixed(2)} icon="🔄" />
              <MetricTile label="Max Complexity" value={String(metric.max_cyclomatic_complexity)} icon="📈" />
              <MetricTile label="Maintainability" value={`${metric.maintainability_index.toFixed(1)}/100`} icon="🛠️" />
              <MetricTile label="Duplicate Blocks" value={String(metric.duplicate_block_count)} icon="📋" />
            </div>
          </div>
        )}

        {/* AI Insights */}
        {analysis.ai_insights && analysis.ai_insights.length > 0 && (
          <Card>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">AI Insights</h2>
            <div className="space-y-4">
              {analysis.ai_insights.map((insight) => (
                <div key={insight.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">{insight.insight_type.replace('_', ' ')}</span>
                    <span className="text-xs text-slate-400">• {insight.model_used}</span>
                  </div>
                  {insight.raw_text && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{insight.raw_text}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-6 border-t border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Powered by <span className="font-bold text-primary-600">RepoLense</span> — AI-powered code intelligence
          </p>
          <Link to="/auth" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
            Analyze your own repository →
          </Link>
        </div>
      </div>
    </div>
  )
}
