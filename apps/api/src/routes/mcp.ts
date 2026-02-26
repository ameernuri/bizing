/**
 * Agents / MCP-style API adapter.
 *
 * This surface exists so AI agents can discover and execute API actions using
 * structured tools, without touching SQL or database internals.
 */

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { z } from 'zod'
import { getCurrentUser, optionalAuth, requireAuth } from '../middleware/auth.js'
import { fail, ok } from './_api.js'
import { apiTools, findTool, searchTools } from '../code-mode/tools.js'
import { ensureBizMembership, saveSagaArtifact } from '../services/sagas.js'

const { db } = dbPackage

const executeBodySchema = z.object({
  tool: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  runId: z.string().optional(),
  stepKey: z.string().optional(),
})

const baseUrl = process.env.CODE_MODE_BASE_URL || process.env.API_BASE_URL || 'http://localhost:6129'

export const codeModeRoutes = new Hono()

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

codeModeRoutes.get('/manifest', optionalAuth, (c) => {
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

codeModeRoutes.post('/execute', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) {
    return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  }

  const parsed = executeBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid execute payload.', 400, parsed.error.flatten())
  }

  const tool = findTool(parsed.data.tool)
  if (!tool) {
    return fail(c, 'UNKNOWN_TOOL', `Unknown tool: ${parsed.data.tool}`, 404)
  }

  let path = tool.path
  const usedKeys = new Set<string>()

  for (const [key, value] of Object.entries(parsed.data.params)) {
    const token = `{${key}}`
    if (path.includes(token)) {
      path = path.replaceAll(token, encodeURIComponent(String(value)))
      usedKeys.add(key)
    }
  }

  if (path.includes('{')) {
    return fail(c, 'MISSING_PATH_PARAM', `Missing required path params for tool ${tool.name}.`, 400)
  }

  const url = new URL(path, baseUrl)

  const headers: Record<string, string> = {}
  const cookie = c.req.header('cookie')
  if (cookie) headers.cookie = cookie

  let body: string | undefined
  if (tool.method === 'GET') {
    for (const [key, value] of Object.entries(parsed.data.params)) {
      if (usedKeys.has(key) || value === undefined || value === null) continue
      url.searchParams.set(key, String(value))
    }
  } else {
    const payload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data.params)) {
      if (usedKeys.has(key)) continue
      payload[key] = value
    }
    headers['content-type'] = 'application/json'
    body = JSON.stringify(payload)
  }

  const response = await fetch(url.toString(), {
    method: tool.method,
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
        tool: tool.name,
        method: tool.method,
        path: tool.path,
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
      title: `${tool.name} trace`,
      stepKey: parsed.data.stepKey,
      fileName: `artifacts/${Date.now()}-${tool.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}.json`,
      contentType: 'application/json',
      body: `${JSON.stringify(tracePayload, null, 2)}\n`,
      metadata: {
        tool: tool.name,
        method: tool.method,
        path: tool.path,
        requestUrl: url.toString(),
        status: response.status,
        stepKey: parsed.data.stepKey ?? null,
      },
    })
  }

  return ok(c, {
    tool: tool.name,
    method: tool.method,
    path: tool.path,
    requestUrl: url.toString(),
    status: response.status,
    success: response.ok,
    response: parsedBody,
  }, response.ok ? 200 : 207)
})
