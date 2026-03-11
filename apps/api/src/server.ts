import 'dotenv/config'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { OpenAPIHono } from '@hono/zod-openapi'
import { sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { auth } from './auth.js'
import { coreApiRoutes } from './routes/core-api.js'
import { adminOpsRoutes } from './routes/admin-ops.js'
import { runtimeCompatRoutes } from './routes/runtime-compat.js'
import { agentCompatRoutes } from './routes/agent-compat.js'
import { bizingChatRoutes } from './routes/bizing-chat.js'
import { mindAdminRoutes } from './routes/mind-admin.js'
import { internalPersonaInboxRoutes } from './routes/internal-persona-inbox.js'
import { requestId } from './middleware/auth.js'
import { installSagaWebSocketServer } from './services/saga-ws.js'
import { getRuntimeAssuranceMode, isStrictRuntimeAssuranceMode } from './lib/runtime-assurance.js'
import { startLifecycleDeliveryWorker } from './services/lifecycle-delivery-worker.js'

const { db, checkDatabaseConnection } = dbPackage

function log(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

/**
 * Tiny auth-throttling guard for Better Auth endpoints.
 *
 * ELI5:
 * If one email/IP keeps hammering sign-in or sign-up, the API should slow that
 * actor down. This local-memory version is enough for v0 and saga validation.
 */
const authThrottleWindowMs = 10 * 60 * 1000
const authThrottleMaxAttempts = 8
const authAttemptBuckets = new Map<string, number[]>()

function getAuthThrottleKey(request: Request, bodyText: string) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local'
  const emailMatch = bodyText.match(/"email"\s*:\s*"([^"]+)"/i)
  const email = emailMatch?.[1]?.toLowerCase() ?? 'unknown'
  return `${request.method}:${new URL(request.url).pathname}:${ip}:${email}`
}

const app = new OpenAPIHono()

app.use('/*', requestId)
app.use('/*', cors())

app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
  const pathname = new URL(c.req.raw.url).pathname
  if (c.req.method === 'POST' && (pathname.endsWith('/sign-in/email') || pathname.endsWith('/sign-up/email'))) {
    const bodyText = await c.req.raw.clone().text().catch(() => '')
    const bucketKey = getAuthThrottleKey(c.req.raw, bodyText)
    const now = Date.now()
    const bucket = (authAttemptBuckets.get(bucketKey) ?? []).filter((entry) => now - entry < authThrottleWindowMs)
    bucket.push(now)
    authAttemptBuckets.set(bucketKey, bucket)

    if (bucket.length > authThrottleMaxAttempts) {
      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many authentication attempts. Try again later.',
          },
          meta: {
            requestId: c.get('requestId') ?? crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        429,
      )
    }
  }
  return auth.handler(c.req.raw)
})

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  })
})

app.get('/api/v1/health/db', async (c) => {
  const startedAt = Date.now()
  try {
    const connected = await checkDatabaseConnection()
    return c.json(
      {
        status: connected ? 'ok' : 'down',
        db: {
          connected,
          latencyMs: Date.now() - startedAt,
        },
        timestamp: new Date().toISOString(),
      },
      connected ? 200 : 503,
    )
  } catch (error) {
    return c.json(
      {
        status: 'down',
        db: {
          connected: false,
          latencyMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : 'Database connectivity check failed.',
        },
        timestamp: new Date().toISOString(),
      },
      503,
    )
  }
})

// Keep admin ops mounted directly while nested route dispatch is stabilized.
app.route('/api/v1/admin', adminOpsRoutes)
app.route('/api/v1/internal', internalPersonaInboxRoutes)
app.route('/api/v1', coreApiRoutes)
app.route('/api/v1', runtimeCompatRoutes)
app.route('/api/v1', agentCompatRoutes)
app.route('/api/v1', bizingChatRoutes)
app.route('/api/v1', mindAdminRoutes)

app.onError((err, c) => {
  if (err instanceof Response) {
    return err
  }
  log(`ERROR: ${err.message}`)
  return c.json({ success: false, error: { message: err.message } }, 500)
})

app.notFound((c) => {
  return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404)
})

const PORT = Number(process.env.PORT) || 6129

async function assertStrictRuntimeDependencies() {
  if (!isStrictRuntimeAssuranceMode()) return
  try {
    await db.execute(sql`SELECT 1 FROM auth_access_events LIMIT 1`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `[runtime-assurance] strict mode (${getRuntimeAssuranceMode()}) failed boot dependency check: auth_access_events unavailable: ${message}`,
    )
    process.exit(1)
  }
}

void assertStrictRuntimeDependencies()
startLifecycleDeliveryWorker()

const httpServer = serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log('')
    console.log(' 🚀 bizing API http://localhost:' + info.port)
    console.log('')
  },
)

installSagaWebSocketServer(httpServer)
