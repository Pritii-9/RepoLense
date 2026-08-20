import { useEffect, useRef } from 'react'
import { useAnalysisLogs, type LogLine } from '@/hooks/useAnalysisLogs'
import { cn } from '@/utils/cn'

interface LiveTerminalProps {
  analysisId: string
  repositoryName?: string
  onComplete?: () => void
  onClose?: () => void
}

function lineColour(line: LogLine): string {
  if (line.type === 'done') return 'text-indigo-600 dark:text-indigo-400'
  if (line.type === 'error') return 'text-rose-600 dark:text-rose-400'
  if (line.message.startsWith('✅') || line.emoji === '✅') return 'text-indigo-500 dark:text-indigo-300'
  return 'text-slate-600 dark:text-indigo-300'
}

export function LiveTerminal({
  analysisId,
  repositoryName,
  onComplete,
  onClose,
}: LiveTerminalProps) {
  const { lines, isConnected, isComplete, disconnect } = useAnalysisLogs(analysisId, true)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom whenever a new line arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  // Notify parent when pipeline finishes
  useEffect(() => {
    if (isComplete) {
      onComplete?.()
    }
  }, [isComplete, onComplete])

  const handleClose = () => {
    disconnect()
    onClose?.()
  }

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden border shadow-2xl',
        'bg-white border-slate-200 dark:border-slate-700/60 dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950',
        'animate-slide-down',
      )}
      style={{ animationDuration: '0.35s' }}
      role="log"
      aria-label="Live analysis terminal"
      aria-live="polite"
    >
      {/* Terminal chrome / title bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-400/80" />
            <span className="w-3 h-3 rounded-full bg-indigo-500/80" />
          </div>
          <span className="text-xs font-mono font-semibold text-slate-700 tracking-wider dark:text-slate-300">
            🖥&nbsp; {repositoryName ?? 'Repository'} — Live Analysis Log
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          {!isComplete && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              {isConnected ? 'LIVE' : 'CONNECTING…'}
            </span>
          )}
          {isComplete && (
            <span className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1">
              ✅ DONE
            </span>
          )}

          {/* Close button */}
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded dark:text-slate-500 dark:hover:text-slate-200"
            aria-label="Close terminal"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Log output area */}
      <div className="h-64 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed scrollbar-thin">
        {lines.length === 0 && (
          <p className="text-slate-500 animate-pulse">Waiting for pipeline to start…</p>
        )}

        {lines.map((line, idx) => (
          <div
            key={idx}
            className={cn('flex gap-2 py-0.5', lineColour(line))}
          >
            <span className="text-slate-400 shrink-0 select-none dark:text-slate-500">[{line.ts}]</span>
            <span className="shrink-0">{line.emoji}</span>
            <span className="break-all font-medium dark:font-normal">{line.message}</span>
          </div>
        ))}

        {/* Blinking cursor when still live */}
        {!isComplete && isConnected && (
          <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Footer progress bar */}
      <div className="px-4 pb-3 pt-1">
        <div className="h-1 rounded-full bg-slate-200 overflow-hidden dark:bg-slate-800">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              isComplete
                ? 'bg-indigo-500 w-full'
                : 'bg-gradient-to-r from-indigo-500 to-violet-400 animate-progress-indeterminate',
            )}
            style={isComplete ? {} : { width: `${Math.min(lines.length * 12, 85)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
