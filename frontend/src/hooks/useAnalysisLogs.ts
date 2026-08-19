import { useCallback, useEffect, useRef, useState } from 'react'
import { getAccessToken, api } from '@/services/api'

export interface LogLine {
  ts: string
  emoji: string
  message: string
  type: 'log' | 'done' | 'error'
}

interface UseAnalysisLogsReturn {
  lines: LogLine[]
  isConnected: boolean
  isComplete: boolean
  /** Call to tear down the socket early (e.g. user closes the terminal). */
  disconnect: () => void
}

/**
 * Opens a WebSocket to /analysis/{analysisId}/logs and accumulates log lines.
 * Falls back to HTTP history polling if the WebSocket is blocked (e.g. mixed content under HTTPS).
 */
export function useAnalysisLogs(
  analysisId: string | null,
  enabled: boolean = true,
): UseAnalysisLogsReturn {
  const [lines, setLines] = useState<LogLine[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
    setIsConnected(false)
  }, [])

  // WebSocket Connection
  useEffect(() => {
    if (!analysisId || !enabled) return

    const token = getAccessToken()
    if (!token) return

    // Derive WebSocket base URL from the current API base URL.
    const apiBase = typeof import.meta.env.VITE_API_URL === 'string' && import.meta.env.VITE_API_URL.trim() !== ''
      ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
      : (import.meta.env.PROD ? 'http://32.198.121.140' : 'http://localhost:8000')

    const wsBase = apiBase.replace(/^http/, 'ws')
    const url = `${wsBase}/analysis/${analysisId}/logs?token=${encodeURIComponent(token)}`

    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(url)
      socketRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        setLines([])
        setIsComplete(false)
      }

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as LogLine
          setLines((prev) => [...prev, data])
          if (data.type === 'done' || data.type === 'error') {
            setIsComplete(true)
            ws?.close()
          }
        } catch {
          // Ignore malformed frames
        }
      }

      ws.onerror = () => {
        setIsConnected(false)
      }

      ws.onclose = () => {
        setIsConnected(false)
        socketRef.current = null
      }
    } catch (e) {
      console.warn('[WebSocket] Secure page loaded over HTTPS failed to connect to insecure WS:', e)
      setIsConnected(false)
    }

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [analysisId, enabled])

  // HTTP Polling Fallback (runs if WebSocket fails to connect)
  useEffect(() => {
    if (!analysisId || !enabled || isConnected || isComplete) return

    let cancelled = false
    let timeoutId: number | undefined

    const pollHistory = async () => {
      try {
        const response = await api.get<LogLine[]>(`/analysis/${analysisId}/logs/history`)
        if (cancelled) return

        setLines(response.data)

        // Check if the last log is terminal (done or error) to stop polling
        const lastLine = response.data[response.data.length - 1]
        if (lastLine && (lastLine.type === 'done' || lastLine.type === 'error')) {
          setIsComplete(true)
          return
        }
      } catch (err) {
        console.warn('Failed to poll analysis logs history:', err)
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(pollHistory, 1500)
      }
    }

    // Start polling immediately
    pollHistory()

    return () => {
      cancelled = true
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [analysisId, enabled, isConnected, isComplete])

  return { lines, isConnected, isComplete, disconnect }
}
