import { useCallback, useEffect, useRef, useState } from 'react'
import { getAccessToken } from '@/services/api'

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
 *
 * The socket passes the JWT as a ?token= query parameter because browsers
 * cannot set custom headers during the WebSocket handshake.
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
  }, [])

  useEffect(() => {
    if (!analysisId || !enabled) return

    const token = getAccessToken()
    if (!token) return

    // Derive WebSocket base URL from the current API base URL.
    const apiBase = typeof import.meta.env.VITE_API_URL === 'string' && import.meta.env.VITE_API_URL.trim() !== ''
      ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
      : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')

    const wsBase = apiBase.replace(/^http/, 'ws')
    const url = `${wsBase}/analysis/${analysisId}/logs?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(url)
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
          ws.close()
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

    return () => {
      ws.close()
    }
  }, [analysisId, enabled])

  return { lines, isConnected, isComplete, disconnect }
}
