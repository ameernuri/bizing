/**
 * Agents / MCP-style API adapter.
 *
 * This surface exists so AI agents can discover and execute API actions using
 * structured tools, without touching SQL or database internals.
 */

import { Hono } from 'hono'
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { z } from 'zod'
import { getCurrentAuthCredentialId, getCurrentAuthSource, getCurrentUser, requireAuth } from '../middleware/auth.js'
import { fail, ok } from './_api.js'
import { apiTools, findTool, searchTools } from '../code-mode/tools.js'
import { ensureBizMembership, saveSagaArtifact } from '../services/sagas.js'
import { isStrictRuntimeAssuranceMode } from '../lib/runtime-assurance.js'
import { buildApiExplorerCatalog, buildApiExplorerOpenApiDocument } from '../services/openapi-explorer.js'

const { db, policyTemplates, policyBindings, authAccessEvents } = dbPackage

const executeBodySchema = z.object({
  tool: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  runId: z.string().optional(),
  stepKey: z.string().optional(),
})

const rawApiProxyParamsSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1),
  query: z.record(z.string()).optional(),
  body: z.unknown().optional(),
})

const baseUrl = process.env.CODE_MODE_BASE_URL || process.env.API_BASE_URL || 'http://localhost:6129'
const inMemoryAgentRateWindow = new Map<string, number[]>()

function recordAndCountRecentAgentCalls(key: string, nowMs: number, windowMs: number) {
  const existing = inMemoryAgentRateWindow.get(key) ?? []
  const fresh = existing.filter((value) => nowMs - value < windowMs)
  fresh.push(nowMs)
  inMemoryAgentRateWindow.set(key, fresh)
  return fresh.length
}

export const codeModeRoutes = new Hono()

async function resolveAgentGovernanceForBiz(bizId: string) {
  const rows = await db
    .select({
      bindingId: policyBindings.id,
      targetType: policyBindings.targetType,
      enforcementPolicy: policyBindings.enforcementPolicy,
      policySnapshot: policyTemplates.policySnapshot,
    })
    .from(policyBindings)
    .innerJoin(
      policyTemplates,
      and(
        eq(policyBindings.bizId, policyTemplates.bizId),
        eq(policyBindings.policyTemplateId, policyTemplates.id),
      ),
    )
    .where(
      and(
        eq(policyBindings.bizId, bizId),
        eq(policyBindings.isActive, true),
        eq(policyTemplates.status, 'active'),
        eq(policyTemplates.domainKey, 'agent_governance'),
        inArray(policyBindings.targetType, ['biz', 'subject']),
      ),
    )

  return rows.map((row) => ({
    ...row,
    policySnapshot:
      row.policySnapshot && typeof row.policySnapshot === 'object' && !Array.isArray(row.policySnapshot)
        ? (row.policySnapshot as Record<string, unknown>)
        : {},
  }))
}

async function canAccessRunForTrace(
  user: { id: string; role?: string | null },
  runId: string,
): Promise<{ allowed: boolean; reason?: string; run?: { id: string; bizId: string | null; requestedByUserId: string } }> {
  const run = await db.query.sagaRuns.findFirst({
    where: eq(dbPackage.sagaRuns.id, runId),
    columns: {
      id: true,
      bizId: true,
      requestedByUserId: true,
    },
  })
  if (!run) return { allowed: false, reason: 'Saga run not found.' }
  if (user.role === 'admin' || user.role === 'owner') return { allowed: true, run }
  if (run.requestedByUserId === user.id) return { allowed: true, run }
  if (!run.bizId) return { allowed: false, reason: 'Only run owner can attach traces for this run.' }

  const membership = await ensureBizMembership(user.id, run.bizId)
  if (!membership) return { allowed: false, reason: 'You are not a member of this run biz scope.' }
  return { allowed: true, run }
}

codeModeRoutes.get('/manifest', requireAuth, (c) => {
  return ok(c, {
    name: 'bizing-agents',
    version: '0.2.0',
    description: 'API-first tool interface for Bizing',
    transport: 'http',
    toolsCount: apiTools.length,
    endpoints: {
      tools: '/api/v1/agents/tools',
      search: '/api/v1/agents/search',
      execute: '/api/v1/agents/execute',
    },
  })
})

codeModeRoutes.get('/tools', requireAuth, (c) => {
  return ok(c, apiTools)
})

codeModeRoutes.get('/search', requireAuth, (c) => {
  const q = c.req.query('q') ?? ''
  const results = searchTools(q)
  return ok(c, {
    query: q,
    count: results.length,
    tools: results,
  })
})

codeModeRoutes.get('/openapi/catalog', requireAuth, async (c) => {
  const catalog = await buildApiExplorerCatalog()
  return ok(c, catalog)
})

codeModeRoutes.get('/openapi.json', requireAuth, async (c) => {
  const openapi = await buildApiExplorerOpenApiDocument()
  return c.json(openapi)
})

codeModeRoutes.post('/execute', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) {
    return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  }

  const parsed = executeBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid execute payload.', 400, parsed.error.flatten())
  }

  const authSource = getCurrentAuthSource(c) ?? 'session'
  const authCredentialId = getCurrentAuthCredentialId(c) ?? null
  const explicitBizId =
    c.req.header('x-biz-id') ?? (typeof parsed.data.params.bizId === 'string' ? parsed.data.params.bizId : null)

  if ((authSource === 'api_key' || authSource === 'access_token') && explicitBizId) {
    const governanceRows = await resolveAgentGovernanceForBiz(explicitBizId)
    const mergedPolicy = governanceRows.reduce<Record<string, unknown>>((acc, row) => {
      Object.assign(acc, row.policySnapshot)
      return acc
    }, {})

    if (mergedPolicy.killSwitch === true) {
      return fail(c, 'AGENT_KILL_SWITCH', 'Agent execution is disabled by biz governance policy.', 423, {
        bizId: explicitBizId,
        authSource,
      })
    }

    const maxRequestsPerMinute =
      typeof mergedPolicy.maxRequestsPerMinute === 'number' ? mergedPolicy.maxRequestsPerMinute : null
    if (authCredentialId && maxRequestsPerMinute && Number.isFinite(maxRequestsPerMinute)) {
      const nowMs = Date.now()
      const inMemoryObserved = recordAndCountRecentAgentCalls(
        `${explicitBizId}:${authSource}:${authCredentialId}`,
        nowMs,
        60 * 1000,
      )
      if (inMemoryObserved > maxRequestsPerMinute) {
        return fail(c, 'RATE_LIMITED', 'Agent execution exceeded biz policy rate limit.', 429, {
          bizId: explicitBizId,
          authSource,
          authCredentialId,
          maxRequestsPerMinute,
          observedRequestsLastMinute: inMemoryObserved,
          enforcementSource: 'in_memory_window',
        })
      }

      const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
      try {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)`.mapWith(Number) })
          .from(authAccessEvents)
          .where(
            and(
              eq(authAccessEvents.apiCredentialId, authCredentialId),
              eq(authAccessEvents.authSource, authSource),
              gte(authAccessEvents.occurredAt, oneMinuteAgo),
            ),
          )
        if ((count ?? 0) > maxRequestsPerMinute) {
          return fail(c, 'RATE_LIMITED', 'Agent execution exceeded biz policy rate limit.', 429, {
            bizId: explicitBizId,
            authSource,
            authCredentialId,
            maxRequestsPerMinute,
            observedRequestsLastMinute: count,
            enforcementSource: 'auth_access_events',
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const missingObservabilityTable = /auth_access_events|does not exist/i.test(message)
        if (!missingObservabilityTable) {
          throw error
        }

        /**
         * Strict assurance mode is fail-fast:
         * we do not allow agent execution without observability dependencies.
         *
         * Relaxed dev mode keeps graceful degradation for local iteration.
         */
        if (isStrictRuntimeAssuranceMode()) {
          throw error
        }
      }
    }
  }

  const tool = findTool(parsed.data.tool)
  const isRawProxy = parsed.data.tool === 'bizing.api.raw'
  if (!tool && !isRawProxy) {
    return fail(c, 'UNKNOWN_TOOL', `Unknown tool: ${parsed.data.tool}`, 404)
  }

  let resolvedToolName = parsed.data.tool
  let resolvedMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET'
  let resolvedPath = ''
  const usedKeys = new Set<string>()
  let rawProxyPayload: z.infer<typeof rawApiProxyParamsSchema> | null = null

  if (isRawProxy) {
    const rawParsed = rawApiProxyParamsSchema.safeParse(parsed.data.params)
    if (!rawParsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid raw API proxy params.', 400, rawParsed.error.flatten())
    }
    rawProxyPayload = rawParsed.data
    resolvedMethod = rawProxyPayload.method
    resolvedPath = rawProxyPayload.path
    if (!resolvedPath.startsWith('/api/v1/')) {
      return fail(c, 'INVALID_PATH', "Raw proxy path must start with '/api/v1/'.", 400)
    }
    if (resolvedPath.startsWith('/api/v1/agents/')) {
      return fail(c, 'INVALID_PATH', 'Raw proxy cannot target /api/v1/agents/* (prevents recursive execution).', 400)
    }
  } else {
    resolvedMethod = tool!.method
    resolvedPath = tool!.path
    for (const [key, value] of Object.entries(parsed.data.params)) {
      const token = `{${key}}`
      if (resolvedPath.includes(token)) {
        resolvedPath = resolvedPath.replaceAll(token, encodeURIComponent(String(value)))
        usedKeys.add(key)
      }
    }
    if (resolvedPath.includes('{')) {
      return fail(c, 'MISSING_PATH_PARAM', `Missing required path params for tool ${tool!.name}.`, 400)
    }
    resolvedToolName = tool!.name
  }

  const url = new URL(resolvedPath, baseUrl)

  const headers: Record<string, string> = {}
  const cookie = c.req.header('cookie')
  if (cookie) headers.cookie = cookie
  const authorization = c.req.header('authorization')
  if (authorization) headers.authorization = authorization
  const apiKey = c.req.header('x-api-key')
  if (apiKey) headers['x-api-key'] = apiKey
  const accessToken = c.req.header('x-access-token')
  if (accessToken) headers['x-access-token'] = accessToken
  const bizIdHeader = c.req.header('x-biz-id')
  if (bizIdHeader) headers['x-biz-id'] = bizIdHeader
  headers['x-request-id'] = c.get('requestId') ?? crypto.randomUUID()

  let body: string | undefined
  if (resolvedMethod === 'GET') {
    if (rawProxyPayload?.query) {
      for (const [key, value] of Object.entries(rawProxyPayload.query)) {
        if (value === undefined || value === null) continue
        url.searchParams.set(key, String(value))
      }
    } else {
      for (const [key, value] of Object.entries(parsed.data.params)) {
        if (usedKeys.has(key) || value === undefined || value === null) continue
        url.searchParams.set(key, String(value))
      }
    }
  } else {
    const payload: Record<string, unknown> = rawProxyPayload?.body && typeof rawProxyPayload.body === 'object'
      ? (rawProxyPayload.body as Record<string, unknown>)
      : {}
    if (!rawProxyPayload) {
      for (const [key, value] of Object.entries(parsed.data.params)) {
        if (usedKeys.has(key)) continue
        payload[key] = value
      }
    }
    headers['content-type'] = 'application/json'
    body = JSON.stringify(payload)
  }

  const response = await fetch(url.toString(), {
    method: resolvedMethod,
    headers,
    body,
  })

  const contentType = response.headers.get('content-type') || ''
  const parsedBody = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '')

  if (parsed.data.runId) {
    const access = await canAccessRunForTrace(user, parsed.data.runId)
    if (!access.allowed) {
      return fail(c, 'FORBIDDEN', access.reason ?? 'Forbidden', 403)
    }

    const tracePayload = {
      request: {
        tool: resolvedToolName,
        method: resolvedMethod,
        path: resolvedPath,
        requestUrl: url.toString(),
        params: parsed.data.params,
      },
      response: {
        status: response.status,
        success: response.ok,
        body: parsedBody,
      },
      capturedAt: new Date().toISOString(),
    }

    await saveSagaArtifact({
      runId: parsed.data.runId,
      actorUserId: user.id,
      artifactType: 'api_trace',
      title: `${resolvedToolName} trace`,
      stepKey: parsed.data.stepKey,
      fileName: `artifacts/${Date.now()}-${resolvedToolName.replace(/[^a-zA-Z0-9_.-]/g, '_')}.json`,
      contentType: 'application/json',
      body: `${JSON.stringify(tracePayload, null, 2)}\n`,
      metadata: {
        tool: resolvedToolName,
        method: resolvedMethod,
        path: resolvedPath,
        requestUrl: url.toString(),
        status: response.status,
        stepKey: parsed.data.stepKey ?? null,
      },
    })
  }

  return ok(c, {
    tool: resolvedToolName,
    method: resolvedMethod,
    path: resolvedPath,
    requestUrl: url.toString(),
    status: response.status,
    success: response.ok,
    response: parsedBody,
  }, response.ok ? 200 : 207)
})
