import React, { useState, useEffect } from 'react'
import {
  Layers,
  Search,
  ChevronDown,
  User,
  Settings,
  ShieldCheck,
  LogOut,
  GitBranch,
  Sparkles,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Eye,
  RefreshCw,
  Download,
  Trash2,
  ExternalLink,
  CheckSquare,
  Square,
  FolderPlus,
  Cpu,
  ArrowUpRight
} from 'lucide-react'

export interface TaskRecord {
  id: string
  name: string
  url: string
  branch: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  submittedAt: string
  lastUpdate: string
  fileCount: number
  locCount: number
  healthScore: number
}

const INITIAL_TASKS: TaskRecord[] = [
  {
    id: 'task-1',
    name: 'facebook/react',
    url: 'https://github.com/facebook/react',
    branch: 'main',
    status: 'running',
    submittedAt: '5 mins ago',
    lastUpdate: 'Just now',
    fileCount: 1420,
    locCount: 89400,
    healthScore: 94
  },
  {
    id: 'task-2',
    name: 'vercel/next.js',
    url: 'https://github.com/vercel/next.js',
    branch: 'canary',
    status: 'queued',
    submittedAt: '12 mins ago',
    lastUpdate: '2 mins ago',
    fileCount: 3820,
    locCount: 245000,
    healthScore: 88
  },
  {
    id: 'task-3',
    name: 'tailwindlabs/tailwindcss',
    url: 'https://github.com/tailwindlabs/tailwindcss',
    branch: 'main',
    status: 'completed',
    submittedAt: '1 hour ago',
    lastUpdate: '55 mins ago',
    fileCount: 640,
    locCount: 42100,
    healthScore: 98
  },
  {
    id: 'task-4',
    name: 'shadcn/ui',
    url: 'https://github.com/shadcn/ui',
    branch: 'main',
    status: 'completed',
    submittedAt: '3 hours ago',
    lastUpdate: '2 hours ago',
    fileCount: 210,
    locCount: 18900,
    healthScore: 96
  },
  {
    id: 'task-5',
    name: 'expressjs/express',
    url: 'https://github.com/expressjs/express',
    branch: 'master',
    status: 'failed',
    submittedAt: '5 hours ago',
    lastUpdate: '5 hours ago',
    fileCount: 95,
    locCount: 12300,
    healthScore: 72
  }
]

interface ModernRepositoryDashboardProps {
  hideHeader?: boolean
}

export function ModernRepositoryDashboard({ hideHeader = true }: ModernRepositoryDashboardProps) {
  // Navigation & User Dropdown state
  const [activeNav, setActiveNav] = useState<'Dashboard' | 'Reports' | 'Organizations'>('Dashboard')
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  // Input Form state
  const [urlInput, setUrlInput] = useState('')
  const [branchInput, setBranchInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Data & Table state
  const [tasks, setTasks] = useState<TaskRecord[]>(INITIAL_TASKS)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Live Terminal state
  const [activeTerminalTask, setActiveTerminalTask] = useState<TaskRecord>(INITIAL_TASKS[0]!)
  const [terminalProgress, setTerminalProgress] = useState<number>(68)
  const [logLines, setLogLines] = useState<Array<{ timestamp: string; level: 'INFO' | 'SUCCESS' | 'WARN' | 'EXEC' | 'LIVE'; message: string }>>([
    { timestamp: '10:42:01', level: 'INFO', message: 'Connecting to runner node-eu-west-1a...' },
    { timestamp: '10:42:02', level: 'INFO', message: 'Cloning target repository (branch: main)...' },
    { timestamp: '10:42:04', level: 'SUCCESS', message: 'Repository cloned successfully (size: 48.2 MB, 14,289 objects).' },
    { timestamp: '10:42:05', level: 'EXEC', message: 'Parsing TypeScript/JavaScript AST & dependency graph...' },
    { timestamp: '10:42:07', level: 'WARN', message: 'Found 12 circular imports in package sub-modules.' },
    { timestamp: '10:42:08', level: 'LIVE', message: 'Computing code quality metrics & AST cyclomatic complexity matrix...' }
  ])

  // Simulated live progress ticker for terminal
  useEffect(() => {
    const interval = setInterval(() => {
      setTerminalProgress((prev) => {
        if (prev >= 100) return 35
        return prev + 1
      })
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  // Calculate status counters
  const queuedCount = tasks.filter((t) => t.status === 'queued').length
  const runningCount = tasks.filter((t) => t.status === 'running').length
  const completedCount = tasks.filter((t) => t.status === 'completed').length

  // Filtered tasks for table
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.url.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Handle Form Submission
  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return

    setIsSubmitting(true)

    setTimeout(() => {
      // Create new task name from URL
      let repoName = urlInput.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '')
      if (!repoName) repoName = urlInput

      const newTask: TaskRecord = {
        id: `task-${Date.now()}`,
        name: repoName,
        url: urlInput.startsWith('http') ? urlInput : `https://${urlInput}`,
        branch: branchInput.trim() || 'main',
        status: 'queued',
        submittedAt: 'Just now',
        lastUpdate: 'Just now',
        fileCount: Math.floor(Math.random() * 800) + 150,
        locCount: Math.floor(Math.random() * 50000) + 10000,
        healthScore: 95
      }

      setTasks([newTask, ...tasks])
      setActiveTerminalTask(newTask)
      setUrlInput('')
      setBranchInput('')
      setIsSubmitting(false)

      // Add log line to terminal
      setLogLines((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          level: 'INFO',
          message: `Task queued: ${newTask.name} (${newTask.branch})`
        }
      ])
    }, 600)
  }

  // Handle checkbox toggles
  const toggleSelectAll = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([])
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t.id))
    }
  }

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setSelectedTaskIds((prev) => prev.filter((item) => item !== id))
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-slate-950">
      {/* Background Subtle Gradient Overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(255,255,255,0))] pointer-events-none" />

      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR (ONLY SHOWN IN STANDALONE MODE)                     */}
      {/* ========================================================================= */}
      {!hideHeader && (
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800/80 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 via-indigo-500 to-violet-600 p-[1px] shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                  <Layers className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white font-mono">
                  Repo<span className="text-indigo-400">Lens</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Pro
                </span>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60">
              {(['Dashboard', 'Reports', 'Organizations'] as const).map((item) => {
                const isActive = activeNav === item
                return (
                  <button
                    key={item}
                    onClick={() => setActiveNav(item)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {item}
                  </button>
                )
              })}
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-400 hover:border-slate-700 cursor-pointer transition-colors">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Search repos...</span>
                <kbd className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700 font-mono">
                  ⌘K
                </kbd>
              </div>

              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-3 p-1.5 pr-3 rounded-full bg-slate-900 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/80 transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center font-bold text-xs text-slate-950 shadow-md">
                    AM
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-semibold text-slate-200 leading-tight group-hover:text-indigo-300 transition-colors">
                      Alex Morgan
                    </p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[110px]">
                      alex@repolens.io
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isProfileOpen ? 'rotate-180 text-indigo-400' : ''
                    }`}
                  />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 shadow-2xl py-2 z-50 animate-slide-down">
                    <div className="px-4 py-3 border-b border-slate-800/80">
                      <p className="text-sm font-semibold text-white">Alex Morgan</p>
                      <p className="text-xs text-slate-400 font-mono">alex.morgan@repolens.io</p>
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-medium border border-indigo-500/20">
                        <ShieldCheck className="w-3 h-3" /> Enterprise Plan
                      </div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => setIsProfileOpen(false)}
                        className="w-full px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors"
                      >
                        <User className="w-4 h-4 text-slate-400" /> Account Profile
                      </button>
                      <button
                        onClick={() => setIsProfileOpen(false)}
                        className="w-full px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-400" /> Workspace Settings
                      </button>
                      <button
                        onClick={() => setIsProfileOpen(false)}
                        className="w-full px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4 text-slate-400" /> API Tokens & Keys
                      </button>
                    </div>
                    <div className="pt-1 border-t border-slate-800/80">
                      <button
                        onClick={() => setIsProfileOpen(false)}
                        className="w-full px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors font-medium"
                      >
                        <LogOut className="w-4 h-4 text-rose-400" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* ========================================================================= */}
        {/* 2. MAIN CONTENT AREA - TOP SECTION (INPUT & CONTROLS)                      */}
        {/* ========================================================================= */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Subtle decorative glow orb in background */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                Submit a Task
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  AST & Telemetry Engine
                </span>
              </h1>
              <p className="text-sm text-slate-400 max-w-2xl">
                Enter any public or private GitHub repository URL to initiate full dependency indexing, code metric parsing, and real-time git analysis.
              </p>
            </div>

            <form onSubmit={handleSubmitTask} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                
                {/* Repository URL Input */}
                <div className="md:col-span-7 space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Repository URL <span className="text-indigo-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 z-10">
                      <svg className="w-4 h-4 text-indigo-400 fill-current" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://github.com/owner/repository"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all font-mono shadow-inner"
                      required
                    />
                  </div>
                </div>

                {/* Branch Name Input */}
                <div className="md:col-span-3 space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Branch Name <span className="text-slate-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <GitBranch className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={branchInput}
                      onChange={(e) => setBranchInput(e.target.value)}
                      placeholder="main"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Primary Submit Button */}
                <div className="md:col-span-2 pt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 border-none disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 fill-white" />
                    )}
                    <span>Submit</span>
                  </button>
                </div>
              </div>

              {/* Alternative Action Link */}
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs text-slate-500 font-medium">or</span>
                <button
                  type="button"
                  onClick={() => alert('Import from GitHub modal opened')}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline transition-all"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  Import from GitHub Organizations or Cloud Storage
                  <ArrowUpRight className="w-3 h-3 opacity-70" />
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. METRIC CARDS (STATUS COUNTERS)                                          */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Card 1: Queued */}
          <div className="relative group overflow-hidden rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 hover:border-amber-500/40 hover:bg-slate-900/90 transition-all duration-300 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Queued
              </span>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {queuedCount}
              </p>
              <p className="text-xs text-amber-400/90 font-medium">
                {queuedCount === 1 ? '1 task waiting in runner queue' : `${queuedCount} tasks waiting in runner queue`}
              </p>
            </div>
          </div>

          {/* Card 2: Running */}
          <div className="relative group overflow-hidden rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 hover:border-emerald-500/40 hover:bg-slate-900/90 transition-all duration-300 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Running
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {runningCount}
              </p>
              <p className="text-xs text-emerald-400/90 font-medium">
                {runningCount === 1 ? '1 active pipeline analyzing AST' : `${runningCount} active pipelines analyzing AST`}
              </p>
            </div>
          </div>

          {/* Card 3: Completed */}
          <div className="relative group overflow-hidden rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 hover:border-teal-500/40 hover:bg-slate-900/90 transition-all duration-300 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Completed
              </span>
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {completedCount}
              </p>
              <p className="text-xs text-teal-400/90 font-medium">
                Successfully indexed and archived
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. LIVE LOG / TERMINAL WINDOW                                              */}
        {/* ========================================================================= */}
        <section className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
          {/* Terminal Window Header */}
          <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-4">
            
            {/* Window Controls (Red/Yellow/Green dots) */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-3 text-xs font-mono text-slate-400 hidden sm:inline-block">
                bash - {activeTerminalTask.name} ({activeTerminalTask.branch})
              </span>
            </div>

            {/* Task Name & Live Indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="truncate max-w-[180px] sm:max-w-xs">{activeTerminalTask.name}</span>
              </div>
              
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
                  LIVE
                </span>
              </div>
            </div>
          </div>

          {/* Terminal Inner Content */}
          <div className="p-5 space-y-4 font-mono text-xs text-slate-300">
            
            {/* Progress Bar / Waiting State */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-2 text-slate-300 font-semibold">
                  <Cpu className="w-4 h-4 text-emerald-400" /> Pipeline #8042 • Analysis Step 3 of 5
                </span>
                <span className="text-emerald-400 font-bold">{terminalProgress}%</span>
              </div>
              
              {/* Progress Track */}
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                  style={{ width: `${terminalProgress}%` }}
                />
              </div>
            </div>

            {/* Console Log Lines */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
              {logLines.map((log, index) => (
                <div key={index} className="flex items-start gap-3 leading-relaxed">
                  <span className="text-slate-500 select-none">[{log.timestamp}]</span>
                  <span
                    className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                      log.level === 'SUCCESS'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : log.level === 'WARN'
                        ? 'bg-amber-500/20 text-amber-400'
                        : log.level === 'EXEC'
                        ? 'bg-teal-500/20 text-teal-300'
                        : log.level === 'LIVE'
                        ? 'bg-emerald-500/30 text-emerald-300 animate-pulse'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span
                    className={
                      log.level === 'SUCCESS'
                        ? 'text-emerald-300'
                        : log.level === 'WARN'
                        ? 'text-amber-200'
                        : 'text-slate-300'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-2 text-emerald-400 pt-1">
                <span className="animate-pulse font-bold text-sm">█</span>
                <span className="text-slate-500 text-[11px]">Awaiting next AST batch event stream...</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. DATA TABLE (RECENT ACTIVITY)                                           */}
        {/* ========================================================================= */}
        <section className="space-y-4">
          
          {/* Section Header & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Recent Analyses</h2>
              <p className="text-xs text-slate-400">
                Tracked history, analysis status badges, and execution metrics.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter table..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                {(['all', 'running', 'completed', 'queued'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800/80 uppercase text-[10px] tracking-wider text-slate-400 font-mono">
                  <tr>
                    <th className="py-3.5 pl-4 pr-2 w-10">
                      <button onClick={toggleSelectAll} className="flex items-center">
                        {selectedTaskIds.length === filteredTasks.length && filteredTasks.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="py-3.5 px-4 font-bold text-slate-300">Repository / Task Name</th>
                    <th className="py-3.5 px-4 font-bold text-slate-300">Status</th>
                    <th className="py-3.5 px-4 font-bold text-slate-300">Submitted</th>
                    <th className="py-3.5 px-4 font-bold text-slate-300">Last Update</th>
                    <th className="py-3.5 px-4 font-bold text-slate-300">Metrics</th>
                    <th className="py-3.5 pr-6 pl-4 text-right font-bold text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No analyses found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      const isSelected = selectedTaskIds.includes(task.id)
                      return (
                        <tr
                          key={task.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-emerald-500/5' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-4 pl-4 pr-2">
                            <button onClick={() => toggleSelectTask(task.id)} className="flex items-center">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                              )}
                            </button>
                          </td>

                          {/* Repository / Task Name */}
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <a
                                href={task.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-sm font-semibold text-white hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                              >
                                {task.name}
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </a>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono">
                                  <GitBranch className="w-3 h-3 text-emerald-400" />
                                  {task.branch}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-4 px-4">
                            {task.status === 'completed' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                              </span>
                            )}
                            {task.status === 'running' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold">
                                <Activity className="w-3.5 h-3.5 animate-spin" /> Running
                              </span>
                            )}
                            {task.status === 'queued' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
                                <Clock className="w-3.5 h-3.5" /> Queued
                              </span>
                            )}
                            {task.status === 'failed' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-semibold">
                                <AlertCircle className="w-3.5 h-3.5" /> Failed
                              </span>
                            )}
                          </td>

                          {/* Submitted Time */}
                          <td className="py-4 px-4 text-slate-400">{task.submittedAt}</td>

                          {/* Last Update */}
                          <td className="py-4 px-4 text-slate-400">{task.lastUpdate}</td>

                          {/* Metrics */}
                          <td className="py-4 px-4 font-mono">
                            <div className="space-y-0.5">
                              <p className="text-slate-200">
                                {task.fileCount.toLocaleString()} files
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {task.locCount.toLocaleString()} LOC • {task.healthScore}% health
                              </p>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-4 pr-6 pl-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                title="View Logs & Terminal"
                                onClick={() => setActiveTerminalTask(task)}
                                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Re-run Pipeline"
                                onClick={() => {
                                  setTasks((prev) =>
                                    prev.map((t) =>
                                      t.id === task.id ? { ...t, status: 'running', lastUpdate: 'Just now' } : t
                                    )
                                  )
                                }}
                                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-teal-400 hover:border-teal-500/40 transition-all"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Download Report"
                                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Delete Task"
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
