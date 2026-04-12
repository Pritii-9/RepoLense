import { useEffect, useMemo } from 'react'

import { useAnalysis } from '@/hooks/useAnalysis'
import type { AnalysisStatus } from '@/types/api'
import { POLL_INTERVAL_MS } from '@/utils/constants'

interface PollTarget {
  id: string
  status: AnalysisStatus
}

export function usePollStatus(
  targets: PollTarget[],
  options?: {
    enabled?: boolean
    intervalMs?: number
  },
) {
  const { refreshAnalysis } = useAnalysis()
  const activeTargets = useMemo(
    () => targets.filter((target) => target.status === 'pending' || target.status === 'running'),
    [targets],
  )
  const signature = useMemo(
    () => activeTargets.map((target) => `${target.id}:${target.status}`).join('|'),
    [activeTargets],
  )

  useEffect(() => {
    if (options?.enabled === false || activeTargets.length === 0) {
      return
    }

    const intervalMs = options?.intervalMs ?? POLL_INTERVAL_MS
    let cancelled = false
    let timeoutId: number | undefined

    const poll = async () => {
      await Promise.allSettled(activeTargets.map((target) => refreshAnalysis(target.id)))

      if (!cancelled) {
        timeoutId = window.setTimeout(poll, intervalMs)
      }
    }

    timeoutId = window.setTimeout(poll, intervalMs)

    return () => {
      cancelled = true
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [activeTargets, options?.enabled, options?.intervalMs, refreshAnalysis, signature])

  return {
    activeCount: activeTargets.length,
    isPolling: activeTargets.length > 0 && options?.enabled !== false,
  }
}
