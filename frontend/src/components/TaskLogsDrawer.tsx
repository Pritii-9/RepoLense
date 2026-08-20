import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check, Terminal, ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAnalysisLogs, type LogLine } from '@/hooks/useAnalysisLogs'
import { StatusBadge } from '@/components/StatusBadge'
import type { AnalysisStatus } from '@/types/api'
import { cn } from '@/utils/cn'

interface TaskLogsDrawerProps {
  isOpen: boolean
  analysisId: string | null
  repositoryName?: string
  status?: string
  onClose: () => void
}

function lineColour(line: LogLine): string {
  if (line.type === 'done') return 'text-indigo-400 font-semibold'
  if (line.type === 'error') return 'text-rose-400 font-semibold'
  if (line.message.startsWith('✅') || line.emoji === '✅') return 'text-indigo-300'
  if (line.message.includes('error') || line.message.includes('Failed')) return 'text-rose-400'
  return 'text-zinc-200'
}

export function TaskLogsDrawer({
  isOpen,
  analysisId,
  repositoryName,
  status,
  onClose,
}: TaskLogsDrawerProps) {
  const { lines, isConnected, isComplete, disconnect } = useAnalysisLogs(analysisId ?? '', isOpen && !!analysisId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [localLines, setLocalLines] = useState<LogLine[]>([])

  useEffect(() => {
    setLocalLines(lines)
  }, [lines])

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [localLines, isOpen])

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        disconnect()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, disconnect])

  const handleCopyLogs = async () => {
    const fullLog = localLines.map((l) => `[${l.ts}] ${l.emoji || ''} ${l.message}`).join('\n')
    await navigator.clipboard.writeText(fullLog)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClearLogs = () => {
    setLocalLines([])
  }

  if (!isOpen || !analysisId) return null

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-hidden flex justify-end">
      {/* Dimmed Glass Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md transition-opacity duration-300"
        onClick={() => {
          disconnect()
          onClose()
        }}
      />

      {/* Slide-out Sidebar Drawer */}
      <div className="relative z-10 w-full max-w-xl h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-out">
        
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-xs">
              <Terminal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate font-mono">
                  {repositoryName || 'Live Pipeline Logs'}
                </h3>
                {status && <StatusBadge status={status as AnalysisStatus} />}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-mono">
                ID: {analysisId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyLogs}
              title="Copy log text"
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all text-xs font-medium cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              title="Clear log screen"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-all text-xs cursor-pointer shadow-xs"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                disconnect()
                onClose()
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
              aria-label="Close logs drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Console Log Terminal Output Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2 bg-zinc-950 text-zinc-100 font-mono text-xs scrollbar-thin select-text">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 border-b border-zinc-800/80 pb-2.5 mb-3">
            <span>EVENT STREAM OUTPUT</span>
            <span>
              {!isComplete ? (
                <span className="text-indigo-400 flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping inline-block" />
                  {isConnected ? 'STREAMING LIVE' : 'CONNECTING...'}
                </span>
              ) : (
                <span className="text-indigo-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> TASK COMPLETED
                </span>
              )}
            </span>
          </div>

          {localLines.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin mx-auto" />
              <p className="text-zinc-500 text-xs italic">Waiting for pipeline telemetry events...</p>
            </div>
          )}

          {localLines.map((line, idx) => (
            <div key={idx} className={cn('flex gap-2.5 py-0.5 leading-relaxed tracking-tight', lineColour(line))}>
              <span className="text-zinc-600 shrink-0 select-none text-[11px]">[{line.ts}]</span>
              {line.emoji && <span className="shrink-0">{line.emoji}</span>}
              <span className="break-all">{line.message}</span>
            </div>
          ))}

          {!isComplete && isConnected && (
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5" />
              <span className="text-[10px] text-zinc-500 italic">Listening for output...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Drawer Footer Controls */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 flex items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex-1">
            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isComplete
                    ? 'bg-indigo-500 w-full'
                    : 'bg-indigo-600 animate-pulse',
                )}
                style={isComplete ? {} : { width: `${Math.min(localLines.length * 12, 90)}%` }}
              />
            </div>
          </div>

          <Link
            to={`/analyses/${analysisId}`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-xs transition-colors shrink-0"
          >
            <span>View Full Report</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}
