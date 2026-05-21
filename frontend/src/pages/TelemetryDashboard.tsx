import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '@/services/api'
import { Card } from '@/components/Card'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/hooks/useToast'
import { formatInteger, formatPercent } from '@/utils/formatters'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/utils/constants'

interface TelemetryMetrics {
  summary: {
    total_requests: number
    error_rate: number
    avg_latency: number
    total_ai_cost: number
    total_ai_tokens: number
  }
  slowest_endpoints: Array<{ path: string; avg_latency: number; calls: number }>
  daily_costs: Array<{ date: string; cost: number }>
  daily_api: Array<{ date: string; requests: number; avg_latency: number }>
}

export function TelemetryDashboard() {
  const [metrics, setMetrics] = useState<TelemetryMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { pushToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchTelemetry() {
      try {
        const response = await api.get<TelemetryMetrics>('/telemetry/metrics')
        setMetrics(response.data)
      } catch (error) {
        console.error(error)
        pushToast({
          title: 'Error loading telemetry',
          description: 'Failed to fetch observability metrics.',
          tone: 'error',
        })
      } finally {
        setIsLoading(false)
      }
    }
    fetchTelemetry()
  }, [pushToast])

  const formatCost = (val: number) => `$${val.toFixed(4)}`
  const formatLatency = (val: number) => `${val.toFixed(0)} ms`

  if (isLoading || !metrics) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(ROUTES.dashboard)}
              className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-black text-ink tracking-tight flex items-center gap-3 dark:text-slate-100">
              <span className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </span>
              System Telemetry
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-2 ml-10 dark:text-slate-400">Real-time observability, API performance, and AI LLM cost metrics over the last 7 days.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-between border border-indigo-100 bg-gradient-to-b from-white to-indigo-50/30 dark:border-indigo-900/50 dark:from-slate-800/80 dark:to-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">API Requests (7d)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-ink dark:text-slate-100">{formatInteger(metrics.summary.total_requests)}</span>
            <span className="text-xs text-emerald-600 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-full">Active</span>
          </div>
        </Card>
        
        <Card className="p-5 flex flex-col justify-between border border-rose-100 bg-gradient-to-b from-white to-rose-50/30 dark:border-rose-900/50 dark:from-slate-800/80 dark:to-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">Global Error Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-ink dark:text-slate-100">{formatPercent(metrics.summary.error_rate / 100)}</span>
            {metrics.summary.error_rate > 5 ? (
               <span className="text-xs text-rose-600 font-bold bg-rose-100 px-1.5 py-0.5 rounded-full">High</span>
            ) : (
               <span className="text-xs text-emerald-600 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-full">Healthy</span>
            )}
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between border border-amber-100 bg-gradient-to-b from-white to-amber-50/30 dark:border-amber-900/50 dark:from-slate-800/80 dark:to-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">Avg Global Latency</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-ink dark:text-slate-100">{formatLatency(metrics.summary.avg_latency)}</span>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/30 dark:border-emerald-900/50 dark:from-slate-800/80 dark:to-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">Total AI Token Cost</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-ink dark:text-slate-100">{formatCost(metrics.summary.total_ai_cost)}</span>
            <span className="text-xs text-slate-400 font-medium">{formatInteger(metrics.summary.total_ai_tokens)} tokens</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Volume Chart */}
        <Card className="p-6">
          <h3 className="text-sm font-bold text-ink mb-6 flex items-center gap-2 dark:text-slate-100">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            API Traffic Volume (Last 7 Days)
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.daily_api} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="requests" name="Total Requests" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRequests)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* AI Cost Chart */}
        <Card className="p-6">
          <h3 className="text-sm font-bold text-ink mb-6 flex items-center gap-2 dark:text-slate-100">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            AI Token Cost (Last 7 Days)
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.daily_costs} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barSize={30}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCost(value), 'Cost (USD)']}
                />
                <Bar dataKey="cost" name="Cost" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Slow Endpoints Table */}
      <Card className="overflow-hidden border border-slate-200/60 shadow-sm dark:border-slate-700/60">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 dark:border-slate-700/50 dark:bg-slate-800/50">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 dark:text-slate-100">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Top 5 Slowest Endpoints
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-400">Endpoints with the highest average latency.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider dark:bg-slate-800/80 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3 font-semibold">Endpoint Path</th>
                <th className="px-6 py-3 font-semibold text-right">Calls (7d)</th>
                <th className="px-6 py-3 font-semibold text-right">Avg Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700 dark:divide-slate-700/50 dark:bg-slate-800 dark:text-slate-300">
              {metrics.slowest_endpoints.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No API telemetry data found yet.
                  </td>
                </tr>
              ) : (
                metrics.slowest_endpoints.map((ep, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-700/50">
                    <td className="px-6 py-3 font-medium text-ink dark:text-slate-100"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-pink-600 dark:bg-slate-900 dark:text-pink-400">{ep.path}</code></td>
                    <td className="px-6 py-3 text-right">{formatInteger(ep.calls)}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        ep.avg_latency > 1000 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : ep.avg_latency > 300 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {formatLatency(ep.avg_latency)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
