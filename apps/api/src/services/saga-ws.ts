import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, WebSocket } from 'ws'
import { auth } from '../auth.js'
import { canUserAccessSagaRun } from './sagas.js'
import { onSagaRuntimeEvent, type SagaRuntimeEvent } from './saga-events.js'

type SagaSocketClientState = {
  socket: WebSocket
  userId: string
  role: string | null
  subscribedAll: boolean
  runIds: Set<string>
}

type SagaSocketCommand =
  | { type: 'ping' }
  | { type: 'subscribe_list' }
  | { type: 'subscribe_run'; runId: string }
  | { type: 'unsubscribe_run'; runId: string }

function toWebHeaders(req: IncomingMessage) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      headers.set(key, value.join(','))
      continue
    }
    headers.set(key, value)
  }
  return headers
}

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(payload))
}

function canReceiveSagaEvent(client: SagaSocketClientState, event: SagaRuntimeEvent) {
  if (client.runIds.has(event.runId)) return true
  if (event.requestedByUserId && event.requestedByUserId === client.userId) return true
  if (client.subscribedAll && (client.role === 'admin' || client.role === 'owner')) return true
  return false
}

async function resolveAuthenticatedUser(req: IncomingMessage) {
  const session = await auth.api.getSession({
    headers: toWebHeaders(req),
  })
  if (!session?.user || !session.session) return null
  return {
    userId: String(session.user.id),
    role: (session.user as { role?: string | null }).role ?? null,
  }
}

function safeUnauthorizedUpgrade(socket: Duplex & { write: (chunk: string) => void; destroy: () => void }) {
  socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
  socket.destroy()
}

/**
 * Install websocket bridge for live saga dashboard updates.
 *
 * Protocol:
 * - Connect to `/api/v1/ws/sagas` with normal session cookie.
 * - Send `{"type":"subscribe_list"}` for list-level updates.
 * - Send `{"type":"subscribe_run","runId":"..."}` for run-detail stream.
 */
export function installSagaWebSocketServer(server: {
  on: (
    event: 'upgrade',
    listener: (
      req: IncomingMessage,
      socket: Duplex & { write: (chunk: string) => void; destroy: () => void },
      head: Buffer,
    ) => void,
  ) => void
}) {
  const wss = new WebSocketServer({ noServer: true })
  const clients = new Map<WebSocket, SagaSocketClientState>()
  const stopEvents = onSagaRuntimeEvent((event) => {
    for (const client of clients.values()) {
      if (!canReceiveSagaEvent(client, event)) continue
      sendJson(client.socket, {
        type: 'saga_event',
        event,
      })
    }
  })

  server.on('upgrade', async (req, socket, head) => {
    try {
      const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
      if (url.pathname !== '/api/v1/ws/sagas') return

      const user = await resolveAuthenticatedUser(req)
      if (!user) {
        safeUnauthorizedUpgrade(socket)
        return
      }

      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        const state: SagaSocketClientState = {
          socket: ws,
          userId: user.userId,
          role: user.role,
          subscribedAll: false,
          runIds: new Set<string>(),
        }
        clients.set(ws, state)

        sendJson(ws, {
          type: 'connected',
          userId: state.userId,
          role: state.role,
          timestamp: new Date().toISOString(),
        })

        ws.on('message', async (buffer: Buffer) => {
          const raw = buffer.toString('utf8')
          let command: SagaSocketCommand | null = null
          try {
            command = JSON.parse(raw) as SagaSocketCommand
          } catch {
            sendJson(ws, { type: 'error', error: 'Invalid JSON payload.' })
            return
          }
          if (!command || typeof command !== 'object' || !('type' in command)) {
            sendJson(ws, { type: 'error', error: 'Invalid websocket command.' })
            return
          }

          if (command.type === 'ping') {
            sendJson(ws, { type: 'pong', timestamp: new Date().toISOString() })
            return
          }

          if (command.type === 'subscribe_list') {
            state.subscribedAll = state.role === 'admin' || state.role === 'owner'
            sendJson(ws, {
              type: 'subscribed_list',
              scope: state.subscribedAll ? 'all' : 'mine',
            })
            return
          }

          if (command.type === 'subscribe_run') {
            const runId = String(command.runId || '').trim()
            if (!runId) {
              sendJson(ws, { type: 'error', error: 'runId is required.' })
              return
            }
            const access = await canUserAccessSagaRun({
              userId: state.userId,
              platformRole: state.role,
              runId,
            })
            if (!access.allowed) {
              sendJson(ws, { type: 'error', error: access.reason ?? 'Forbidden run subscription.' })
              return
            }
            state.runIds.add(runId)
            sendJson(ws, { type: 'subscribed_run', runId })
            return
          }

          if (command.type === 'unsubscribe_run') {
            const runId = String(command.runId || '').trim()
            if (!runId) return
            state.runIds.delete(runId)
            sendJson(ws, { type: 'unsubscribed_run', runId })
            return
          }
        })

        ws.on('close', () => {
          clients.delete(ws)
        })
      })
    } catch {
      safeUnauthorizedUpgrade(socket)
    }
  })

  return () => {
    stopEvents()
    for (const client of clients.values()) {
      try {
        client.socket.close()
      } catch {
        // no-op
      }
    }
    clients.clear()
    wss.close()
  }
}
