import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '@/services/api'
import { Card } from '@/components/Card'
import { Skeleton } from '@/components/Skeleton'
import { Analysis } from '@/hooks/useAnalysis'
import { formatInteger } from '@/utils/formatters'
import { TechStackBadges } from '@/components/TechStackBadges'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

export function ComparePage() {
  const [searchParams] = useSearchParams()
  const ids = searchParams.get('ids')
  
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ids) {
      setError("No analysis IDs provided.")
      setLoading(false)
      return
    }

    void api.get<Analysis[]>(`/analysis/compare?ids=${ids}`)
      .then(res => setAnalyses(res.data))
      .catch(err => {
        setError(err instanceof Error ? err.message : "Failed to load analyses for comparison.")
      })
      .finally(() => setLoading(false))
  }, [ids])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (error || analyses.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>{error || "No analyses found."}</p>
        <Link to="/dashboard" className="text-primary-600 hover:underline mt-4 inline-block">Back to Dashboard</Link>
      </div>
    )
  }

  const chartData = [
    {
      name: 'Maintainability',
      ...analyses.reduce((acc, a) => ({...acc, [a.repository_name]: a.code_metric?.maintainability_index || 0}), {})
    },
    {
      name: 'Tech Debt',
      ...analyses.reduce((acc, a) => ({...acc, [a.repository_name]: a.code_metric?.technical_debt_score || 0}), {})
    },
    {
      name: 'Avg Complexity',
      ...analyses.reduce((acc, a) => ({...acc, [a.repository_name]: a.code_metric?.average_cyclomatic_complexity || 0}), {})
    }
  ]
  
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Repository Comparison</h1>
          <p className="text-slate-500 text-sm mt-1">Comparing {analyses.length} repositories</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Metrics Overview">
          <div className="h-80 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {analyses.map((a, i) => (
                  <Bar key={a.id} dataKey={a.repository_name} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        
        <Card title="Size & Scope">
           <div className="h-80 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                  {
                    name: 'Lines of Code',
                    ...analyses.reduce((acc, a) => ({...acc, [a.repository_name]: a.code_metric?.line_count || 0}), {})
                  }
              ]} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {analyses.map((a, i) => (
                  <Bar key={a.id} dataKey={a.repository_name} fill={colors[(i+2) % colors.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {analyses.map(analysis => (
          <Card key={analysis.id} title={analysis.repository_name} className="flex flex-col h-full">
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                  <p className="text-slate-500 text-xs">Files</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{formatInteger(analysis.code_metric?.file_count || 0)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                  <p className="text-slate-500 text-xs">Commits</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{formatInteger(analysis.code_metric?.commit_count || 0)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                  <p className="text-slate-500 text-xs">Maintainability</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{Math.round(analysis.code_metric?.maintainability_index || 0)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                  <p className="text-slate-500 text-xs">Debt Score</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{Math.round(analysis.code_metric?.technical_debt_score || 0)}</p>
                </div>
              </div>
              
              {analysis.code_metric?.tech_stack && analysis.code_metric.tech_stack.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-2">Tech Stack</p>
                  <TechStackBadges badges={analysis.code_metric.tech_stack} />
                </div>
              )}
              
              {analysis.vulnerabilities && analysis.vulnerabilities.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {analysis.vulnerabilities.length} Vulnerabilities
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
               <Link to={`/analyses/${analysis.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1">
                 View full analysis
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
               </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
