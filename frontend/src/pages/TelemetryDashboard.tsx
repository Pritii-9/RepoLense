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
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/hooks/useToast'
import { formatInteger, formatPercent } from '@/utils/formatters'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/utils/constants'
import { ArrowLeft, Activity, AlertTriangle } from 'lucide-react'

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
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(ROUTES.dashboard)}
              className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              System Telemetry
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 ml-9">
            Real-time observability, API performance, and LLM cost metrics over the last 7 days.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">API Requests (7d)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white font-mono">{formatInteger(metrics.summary.total_requests)}</span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md">Active</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Global Error Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white font-mono">{formatPercent(metrics.summary.error_rate / 100)}</span>
            {metrics.summary.error_rate > 5 ? (
               <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md">High</span>
            ) : (
               <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-md">Healthy</span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Avg Global Latency</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white font-mono">{formatLatency(metrics.summary.avg_latency)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Total AI Token Cost</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white font-mono">{formatCost(metrics.summary.total_ai_cost)}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{formatInteger(metrics.summary.total_ai_tokens)} tokens</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Volume Chart */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.3} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #3f3f46', backgroundColor: '#18181b', color: '#fff' }}
                />
                <Area type="monotone" dataKey="requests" name="Total Requests" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRequests)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Cost Chart */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
            AI Token Cost (Last 7 Days)
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.daily_costs} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.3} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#71717a' }} 
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #3f3f46', backgroundColor: '#18181b', color: '#fff' }}
                  formatter={(value: number) => [formatCost(value), 'Cost (USD)']}
                />
                <Bar dataKey="cost" name="Cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Slow Endpoints Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Top 5 Slowest Endpoints
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Endpoints with the highest average latency.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3">Endpoint Path</th>
                <th className="px-6 py-3 text-right">Calls (7d)</th>
                <th className="px-6 py-3 text-right">Avg Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
              {metrics.slowest_endpoints.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-500 text-sm">
                    No API telemetry data found yet.
                  </td>
                </tr>
              ) : (
                metrics.slowest_endpoints.map((ep, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-3 font-medium text-zinc-900 dark:text-white">
                      <code className="text-xs bg-zinc-100 dark:bg-zinc-950 px-2 py-1 rounded text-indigo-600 dark:text-indigo-400 font-mono border border-zinc-200 dark:border-zinc-800">
                        {ep.path}
                      </code>
                    </td>
                    <td className="px-6 py-3 text-right font-mono">{formatInteger(ep.calls)}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold font-mono border ${
                        ep.avg_latency > 1000 ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800' : ep.avg_latency > 300 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800' : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
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
      </div>
    </div>
  )
}
