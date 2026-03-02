'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl } from '@/lib/api'

type SagaRealtimeEvent = {
  type: 'saga_event'
  event: {
    eventType: string
    runId: string
    sagaKey: string
    status: string
    at: string
    payload?: Record<string, unknown>
  }
}

type SagaRealtimeMessage =
  | { type: 'connected'; timestamp: string }
  | { type: 'subscribed_list'; scope: 'all' | 'mine' }
  | { type: 'subscribed_run'; runId: string }
  | { type: 'pong'; timestamp: string }
  | { type: 'error'; error: string }
  | SagaRealtimeEvent

function wsUrlForSagas() {
  const target = new URL(apiUrl('/api/v1/ws/sagas'), window.location.origin)
  target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:'
  return target.toString()
}

/**
 * Realtime subscription helper for saga runtime updates.
 *
 * ELI5:
 * - connect once to saga websocket,
 * - subscribe to list-level events and optional run-specific events,
 * - call onEvent so pages can refresh only when relevant data changes.
 */
export function useSagaRealtime(options: {
  runId?: string
  enabled?: boolean
  onEvent?: (event: SagaRealtimeEvent['event']) => void
}) {
  const [connected, setConnected] = useState(false)
  const [lastEventAt, setLastEventAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)

  const shouldRun = options.enabled ?? true
  const onEventRef = useRef(options.onEvent)
  onEventRef.current = options.onEvent

  const stableRunId = useMemo(() => options.runId?.trim() || null, [options.runId])

  useEffect(() => {
    if (!shouldRun) return
    let cancelled = false

    const clearReconnect = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const connect = () => {
      clearReconnect()
      try {
        const socket = new WebSocket(wsUrlForSagas())
        socketRef.current = socket

        socket.addEventListener('open', () => {
          if (cancelled) return
          setConnected(true)
          setError(null)
          socket.send(JSON.stringify({ type: 'subscribe_list' }))
          if (stableRunId) {
            socket.send(JSON.stringify({ type: 'subscribe_run', runId: stableRunId }))
          }
        })

        socket.addEventListener('message', (msg) => {
          if (cancelled) return
          let payload: SagaRealtimeMessage | null = null
          try {
            payload = JSON.parse(String(msg.data)) as SagaRealtimeMessage
          } catch {
            return
          }
          if (!payload) return
          if (payload.type === 'error') {
            setError(payload.error)
            return
          }
          if (payload.type === 'saga_event') {
            setLastEventAt(payload.event.at || new Date().toISOString())
            onEventRef.current?.(payload.event)
          }
        })

        socket.addEventListener('close', () => {
          setConnected(false)
          if (!cancelled) {
            reconnectTimerRef.current = window.setTimeout(connect, 1500)
          }
        })

        socket.addEventListener('error', () => {
          setConnected(false)
          setError('Realtime connection error')
          try {
            socket.close()
          } catch {
            // ignore close errors
          }
        })
      } catch (cause) {
        setConnected(false)
        setError(cause instanceof Error ? cause.message : 'Failed to connect realtime socket.')
        reconnectTimerRef.current = window.setTimeout(connect, 1500)
      }
    }

    connect()

    return () => {
      cancelled = true
      clearReconnect()
      const socket = socketRef.current
      socketRef.current = null
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        try {
          socket.close()
        } catch {
          // ignore close errors
        }
      }
    }
  }, [shouldRun, stableRunId])

  return {
    connected,
    lastEventAt,
    error,
  }
}

