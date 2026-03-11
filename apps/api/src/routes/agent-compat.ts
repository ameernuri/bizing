/**
 * Agent compatibility routes.
 *
 * ELI5:
 * Legacy `/agent/*` helpers and deprecation shims live here while canonical
 * tool execution remains under `/agents/*`.
 */

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import {
  getSchemaCatalog,
  resolveTableName,
  serializeCatalog,
  translateNaturalLanguageRequest,
} from '../agent-contract/index.js'

export const agentCompatRoutes = new Hono()

agentCompatRoutes.get('/agent/schema', requireAuth, (c) => {
  try {
    const catalog = getSchemaCatalog()
    const tableQuery = c.req.query('table')

    if (!tableQuery) {
      return c.json({ success: true, catalog: serializeCatalog(catalog) })
    }

    const resolved = resolveTableName(tableQuery, catalog) ?? tableQuery
    const table = catalog.tables.get(resolved)
    if (!table) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TABLE_NOT_FOUND',
            message: `Unknown table alias/name: ${tableQuery}`,
          },
        },
        404,
      )
    }

    return c.json({
      success: true,
      catalog: {
        generatedAt: catalog.generatedAt,
        summary: { tableCount: 1, columnCount: table.columns.length },
        table: {
          name: table.name,
          hasBizId: table.hasBizId,
          primaryKeys: table.primaryKeys,
          columns: table.columns,
        },
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AGENT_SCHEMA_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch schema catalog',
        },
      },
      500,
    )
  }
})

agentCompatRoutes.post('/agent/translate', requireAuth, async (c) => {
  try {
    const body = await c.req.json()
    const result = translateNaturalLanguageRequest(body)
    return c.json(result, result.success ? 200 : 400)
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: error instanceof Error ? error.message : 'Invalid request payload',
        },
      },
      400,
    )
  }
})

agentCompatRoutes.post('/agent/execute', requireAuth, (c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'DEPRECATED_DIRECT_DB_EXECUTION',
        message: 'Direct SQL-style execution has been removed. Use /api/v1/agents/execute with API tools.',
      },
      meta: {
        requestId: c.get('requestId') || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    410,
  )
})

agentCompatRoutes.post('/agent/simulate', requireAuth, (c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'DEPRECATED_DIRECT_DB_SIMULATION',
        message: 'Direct DB simulation has been removed. Use /api/v1/agents/tools + /api/v1/agents/execute.',
      },
      meta: {
        requestId: c.get('requestId') || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    410,
  )
})

agentCompatRoutes.get('/agent/testing/openapi.json', requireAuth, (c) => {
  return c.json({
    openapi: '3.1.0',
    info: {
      title: 'Bizing Agent API',
      version: '0.2.0',
      description: 'Agent-safe, API-first testing surface. No direct DB mutation endpoints.',
    },
    servers: [{ url: 'http://localhost:6129' }],
    paths: {
      '/api/v1/agents/manifest': {
        get: {
          summary: 'Tooling manifest for agents',
          responses: { '200': { description: 'Manifest' } },
        },
      },
      '/api/v1/agents/tools': {
        get: {
          summary: 'List API tools',
          responses: { '200': { description: 'Tool list' } },
        },
      },
      '/api/v1/agents/search': {
        get: {
          summary: 'Search API tools',
          parameters: [{ name: 'q', in: 'query', required: false, schema: { type: 'string' } }],
          responses: { '200': { description: 'Search results' } },
        },
      },
      '/api/v1/agents/execute': {
        post: {
          summary: 'Execute one API tool call',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: {
            '200': { description: 'Execution success' },
            '207': { description: 'Execution returned non-2xx upstream response' },
          },
        },
      },
      '/api/v1/ws/sagas': {
        get: {
          summary: 'WebSocket endpoint for live saga run events (upgrade required)',
        },
      },
      '/api/v1/auth/api-keys': {
        get: { summary: 'List machine API keys for current user' },
        post: { summary: 'Create machine API key' },
      },
      '/api/v1/auth/api-keys/{apiCredentialId}/revoke': {
        post: { summary: 'Revoke one API key and child tokens' },
      },
      '/api/v1/auth/api-keys/{apiCredentialId}/rotate': {
        post: { summary: 'Rotate one API key and optionally revoke prior credential' },
      },
      '/api/v1/auth/tokens': {
        get: { summary: 'List short-lived machine tokens for current user' },
      },
      '/api/v1/auth/events': {
        get: { summary: 'List auth decision/lifecycle events for observability' },
      },
      '/api/v1/auth/principals': {
        get: { summary: 'List normalized auth principals inventory' },
      },
      '/api/v1/auth/tokens/exchange': {
        post: { summary: 'Exchange API key for short-lived bearer token' },
      },
      '/api/v1/auth/tokens/{tokenId}/revoke': {
        post: { summary: 'Revoke one short-lived machine token' },
      },
      '/api/v1/agent/schema': {
        get: { summary: 'Schema catalog (read-only helper)' },
      },
      '/api/v1/agent/translate': {
        post: { summary: 'Natural language to pseudo-request translator' },
      },
      '/api/v1/ooda/sagas/docs': {
        get: { summary: 'Saga testing contract and filesystem layout' },
      },
      '/api/v1/ooda/sagas/specs': {
        get: { summary: 'List synced saga definitions' },
      },
      '/api/v1/ooda/sagas/specs/generate': {
        post: { summary: 'Generate saga spec files from UC/persona markdown' },
      },
      '/api/v1/ooda/sagas/specs/depth/reclassify': {
        post: { summary: 'Recompute saga definition depth categories (shallow/medium/deep)' },
      },
      '/api/v1/ooda/sagas/runs': {
        get: { summary: 'List saga runs' },
        post: { summary: 'Create saga run from definition key' },
      },
      '/api/v1/ooda/sagas/runs/{runId}': {
        get: { summary: 'Get full saga run detail' },
      },
      '/api/v1/ooda/sagas/runs/{runId}/coverage': {
        get: { summary: 'Get server-side saga coverage verdict for one run' },
      },
      '/api/v1/ooda/sagas/runs/{runId}/archive': {
        post: { summary: 'Soft-archive one saga run' },
      },
      '/api/v1/ooda/sagas/runs/archive': {
        post: { summary: 'Soft-archive multiple saga runs' },
      },
      '/api/v1/ooda/sagas/test-mode/next': {
        get: { summary: 'Get next actionable saga step for agent execution' },
      },
      '/api/v1/public/bizes/{bizId}/offers': {
        get: { summary: 'Public list of active/published offers for customer discovery' },
      },
      '/api/v1/public/bizes/{bizId}/booking-orders': {
        get: { summary: 'List authenticated customer bookings for one biz (public surface)' },
        post: { summary: 'Create authenticated customer booking for one biz (public surface)' },
      },
    },
  })
})

