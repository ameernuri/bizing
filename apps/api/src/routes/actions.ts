/**
 * Canonical actions + projections routes.
 *
 * ELI5:
 * These routes are the beginning of the "real API backbone" for the redesign.
 *
 * Instead of only exposing direct table-shaped endpoints, they expose:
 * - actions: "what are you trying to do?"
 * - projections: "what does the platform currently want humans/agents to read?"
 * - debug snapshots: "what did the platform see when something mattered?"
 *
 * This keeps the API closer to the schema philosophy:
 * action -> execution -> failure/debug -> projection
 */

import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentAuthCredentialId,
  getCurrentAuthSource,
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { evaluatePermission } from '../services/acl.js'
import {
  canonicalActionBodySchema,
  isPublicActionKey,
  permissionForActionKey,
  persistCanonicalAction,
} from '../services/action-runtime.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  actionRequests,
  actionExecutions,
  actionFailures,
  domainEvents,
  projections,
  projectionDocuments,
  debugSnapshots,
} = dbPackage

const listActionsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  actionFamily: z.string().optional(),
  actionKey: z.string().optional(),
  status: z.string().optional(),
  intentMode: z.string().optional(),
})

const listProjectionsQuerySchema = z.object({
  projectionFamily: z.string().optional(),
  status: z.string().optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const listProjectionDocumentsQuerySchema = z.object({
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  status: z.string().optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const listDebugSnapshotsQuerySchema = z.object({
  snapshotFamily: z.string().optional(),
  contextRef: z.string().optional(),
  severity: z.string().optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const listEventsQuerySchema = z.object({
  eventFamily: z.string().optional(),
  eventKey: z.string().optional(),
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  actionRequestId: z.string().optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
})

export const actionRoutes = new Hono()

async function executeCanonicalActionRequest(input: {
  bizId: string
  intentMode: 'dry_run' | 'execute'
  user: NonNullable<ReturnType<typeof getCurrentUser>>
  authSource: ReturnType<typeof getCurrentAuthSource>
  authCredentialId: ReturnType<typeof getCurrentAuthCredentialId>
  requestId?: string
  actionBody: z.infer<typeof canonicalActionBodySchema>
  accessMode: 'biz' | 'public'
}) {
  return persistCanonicalAction({
    bizId: input.bizId,
    input: input.actionBody,
    intentMode: input.intentMode,
    context: {
      bizId: input.bizId,
      user: input.user,
      authSource: input.authSource,
      authCredentialId: input.authCredentialId,
      requestId: input.requestId,
      accessMode: input.accessMode,
    },
  }).catch((error) => {
    if (error?.code === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD') return error
    throw error
  })
}

actionRoutes.get(
  '/bizes/:bizId/actions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('actions.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listActionsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(actionRequests.bizId, bizId),
      parsed.data.actionFamily ? eq(actionRequests.actionFamily, parsed.data.actionFamily) : undefined,
      parsed.data.actionKey ? eq(actionRequests.actionKey, parsed.data.actionKey) : undefined,
      parsed.data.status ? eq(actionRequests.status, parsed.data.status) : undefined,
      parsed.data.intentMode ? eq(actionRequests.intentMode, parsed.data.intentMode) : undefined,
    )

    const [rows, totalRows] = await Promise.all([
      db.query.actionRequests.findMany({
        where,
        orderBy: desc(actionRequests.requestedAt),
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db.query.actionRequests.findMany({
        where,
        columns: { id: true },
      }),
    ])

    return ok(c, rows, 200, {
      pagination: {
        page,
        perPage,
        total: totalRows.length,
        hasMore: page * perPage < totalRows.length,
      },
    })
  },
)

actionRoutes.get(
  '/bizes/:bizId/actions/:actionRequestId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('actions.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, actionRequestId } = c.req.param()
    const actionRequest = await db.query.actionRequests.findFirst({
      where: and(eq(actionRequests.bizId, bizId), eq(actionRequests.id, actionRequestId)),
    })
    if (!actionRequest) return fail(c, 'NOT_FOUND', 'Action request not found.', 404)

    const [executions, failures] = await Promise.all([
      db.query.actionExecutions.findMany({
        where: eq(actionExecutions.actionRequestId, actionRequest.id),
        orderBy: desc(actionExecutions.startedAt),
      }),
      db.query.actionFailures.findMany({
        where: eq(actionFailures.actionRequestId, actionRequest.id),
        orderBy: desc(actionFailures.failedAt),
      }),
    ])

    return ok(c, {
      actionRequest,
      executions,
      failures,
      domainEvents: await db.query.domainEvents.findMany({
        where: eq(domainEvents.actionRequestId, actionRequest.id),
        orderBy: desc(domainEvents.occurredAt),
      }),
    })
  },
)

actionRoutes.post(
  '/bizes/:bizId/actions/preview',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('actions.execute', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const body = await c.req.json().catch(() => null)
    const parsed = canonicalActionBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid action payload.', 400, parsed.error.flatten())
    }

    const permissionKey = permissionForActionKey(parsed.data.actionKey)
    if (!permissionKey) {
      return fail(c, 'UNSUPPORTED_ACTION', `Action ${parsed.data.actionKey} is not supported yet.`, 400)
    }

    const decision = await evaluatePermission({
      userId: user.id,
      platformRole: user.role,
      permissionKey,
      scope: { bizId },
    })
    if (!decision.allowed) {
      return fail(c, 'FORBIDDEN', `Missing permission ${permissionKey} for action preview.`, 403, decision)
    }

    const result = await executeCanonicalActionRequest({
      bizId,
      intentMode: 'dry_run',
      user,
      authSource: getCurrentAuthSource(c),
      authCredentialId: getCurrentAuthCredentialId(c),
      requestId: c.get('requestId'),
      actionBody: parsed.data,
      accessMode: 'biz',
    })

    if ('code' in result && result.code === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD') {
      return fail(c, result.code, result.message, result.httpStatus ?? 409)
    }

    return ok(c, result, result.httpStatus, {
      idempotency: {
        reused: result.reused,
      },
    })
  },
)

actionRoutes.post(
  '/bizes/:bizId/actions/execute',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('actions.execute', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const body = await c.req.json().catch(() => null)
    const parsed = canonicalActionBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid action payload.', 400, parsed.error.flatten())
    }

    const permissionKey = permissionForActionKey(parsed.data.actionKey)
    if (!permissionKey) {
      return fail(c, 'UNSUPPORTED_ACTION', `Action ${parsed.data.actionKey} is not supported yet.`, 400)
    }

    const decision = await evaluatePermission({
      userId: user.id,
      platformRole: user.role,
      permissionKey,
      scope: { bizId },
    })
    if (!decision.allowed) {
      return fail(c, 'FORBIDDEN', `Missing permission ${permissionKey} for action execution.`, 403, decision)
    }

    const result = await executeCanonicalActionRequest({
      bizId,
      intentMode: 'execute',
      user,
      authSource: getCurrentAuthSource(c),
      authCredentialId: getCurrentAuthCredentialId(c),
      requestId: c.get('requestId'),
      actionBody: parsed.data,
      accessMode: 'biz',
    })

    if ('code' in result && result.code === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD') {
      return fail(c, result.code, result.message, result.httpStatus ?? 409)
    }

    if (result.failure) {
      return fail(c, 'ACTION_FAILED', 'The action failed.', result.httpStatus, result)
    }

    return ok(c, result, result.httpStatus, {
      idempotency: {
        reused: result.reused,
      },
    })
  },
)

actionRoutes.post(
  '/public/bizes/:bizId/actions/preview',
  requireAuth,
  async (c) => {
    const bizId = c.req.param('bizId')
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const body = await c.req.json().catch(() => null)
    const parsed = canonicalActionBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid action payload.', 400, parsed.error.flatten())
    }
    if (!isPublicActionKey(parsed.data.actionKey)) {
      return fail(c, 'UNSUPPORTED_PUBLIC_ACTION', `Action ${parsed.data.actionKey} is not available on the public surface.`, 400)
    }

    const result = await executeCanonicalActionRequest({
      bizId,
      intentMode: 'dry_run',
      user,
      authSource: getCurrentAuthSource(c),
      authCredentialId: getCurrentAuthCredentialId(c),
      requestId: c.get('requestId'),
      actionBody: parsed.data,
      accessMode: 'public',
    })

    if ('code' in result && result.code === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD') {
      return fail(c, result.code, result.message, result.httpStatus ?? 409)
    }

    return ok(c, result, result.httpStatus, {
      idempotency: {
        reused: result.reused,
      },
    })
  },
)

actionRoutes.post(
  '/public/bizes/:bizId/actions/execute',
  requireAuth,
  async (c) => {
    const bizId = c.req.param('bizId')
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const body = await c.req.json().catch(() => null)
    const parsed = canonicalActionBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid action payload.', 400, parsed.error.flatten())
    }
    if (!isPublicActionKey(parsed.data.actionKey)) {
      return fail(c, 'UNSUPPORTED_PUBLIC_ACTION', `Action ${parsed.data.actionKey} is not available on the public surface.`, 400)
    }

    const result = await executeCanonicalActionRequest({
      bizId,
      intentMode: 'execute',
      user,
      authSource: getCurrentAuthSource(c),
      authCredentialId: getCurrentAuthCredentialId(c),
      requestId: c.get('requestId'),
      actionBody: parsed.data,
      accessMode: 'public',
    })

    if ('code' in result && result.code === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD') {
      return fail(c, result.code, result.message, result.httpStatus ?? 409)
    }
    if (result.failure) {
      return fail(c, 'ACTION_FAILED', 'The action failed.', result.httpStatus, result)
    }

    return ok(c, result, result.httpStatus, {
      idempotency: {
        reused: result.reused,
      },
    })
  },
)

actionRoutes.get(
  '/bizes/:bizId/projections',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('projections.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listProjectionsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(projections.bizId, bizId),
      parsed.data.projectionFamily ? eq(projections.projectionFamily, parsed.data.projectionFamily) : undefined,
      parsed.data.status ? eq(projections.status, parsed.data.status) : undefined,
    )
    const [rows, totalRows] = await Promise.all([
      db.query.projections.findMany({
        where,
        orderBy: desc(projections.id),
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db.query.projections.findMany({
        where,
        columns: { id: true },
      }),
    ])
    return ok(c, rows, 200, {
      pagination: {
        page,
        perPage,
        total: totalRows.length,
        hasMore: page * perPage < totalRows.length,
      },
    })
  },
)

actionRoutes.get(
  '/bizes/:bizId/projections/:projectionId/documents',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('projections.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, projectionId } = c.req.param()
    const parsed = listProjectionDocumentsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(projectionDocuments.bizId, bizId),
      eq(projectionDocuments.projectionId, projectionId),
      parsed.data.subjectType ? eq(projectionDocuments.subjectType, parsed.data.subjectType) : undefined,
      parsed.data.subjectId ? eq(projectionDocuments.subjectId, parsed.data.subjectId) : undefined,
      parsed.data.status ? eq(projectionDocuments.status, parsed.data.status) : undefined,
    )
    const [rows, totalRows] = await Promise.all([
      db.query.projectionDocuments.findMany({
        where,
        orderBy: desc(projectionDocuments.generatedAt),
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db.query.projectionDocuments.findMany({
        where,
        columns: { id: true },
      }),
    ])
    return ok(c, rows, 200, {
      pagination: {
        page,
        perPage,
        total: totalRows.length,
        hasMore: page * perPage < totalRows.length,
      },
    })
  },
)

actionRoutes.get(
  '/bizes/:bizId/projection-documents/:documentId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('projections.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, documentId } = c.req.param()
    const row = await db.query.projectionDocuments.findFirst({
      where: and(eq(projectionDocuments.bizId, bizId), eq(projectionDocuments.id, documentId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Projection document not found.', 404)
    return ok(c, row)
  },
)

actionRoutes.get(
  '/bizes/:bizId/debug-snapshots',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('projections.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listDebugSnapshotsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(debugSnapshots.bizId, bizId),
      parsed.data.snapshotFamily ? eq(debugSnapshots.snapshotFamily, parsed.data.snapshotFamily) : undefined,
      parsed.data.contextRef ? eq(debugSnapshots.contextRef, parsed.data.contextRef) : undefined,
      parsed.data.severity ? eq(debugSnapshots.severity, parsed.data.severity) : undefined,
    )
    const [rows, totalRows] = await Promise.all([
      db.query.debugSnapshots.findMany({
        where,
        orderBy: desc(debugSnapshots.capturedAt),
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db.query.debugSnapshots.findMany({
        where,
        columns: { id: true },
      }),
    ])
    return ok(c, rows, 200, {
      pagination: {
        page,
        perPage,
        total: totalRows.length,
        hasMore: page * perPage < totalRows.length,
      },
    })
  },
)

actionRoutes.get(
  '/bizes/:bizId/events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listEventsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(domainEvents.bizId, bizId),
      parsed.data.eventFamily ? eq(domainEvents.eventFamily, parsed.data.eventFamily) : undefined,
      parsed.data.eventKey ? eq(domainEvents.eventKey, parsed.data.eventKey) : undefined,
      parsed.data.subjectType ? eq(domainEvents.subjectType, parsed.data.subjectType) : undefined,
      parsed.data.subjectId ? eq(domainEvents.subjectId, parsed.data.subjectId) : undefined,
      parsed.data.actionRequestId ? eq(domainEvents.actionRequestId, parsed.data.actionRequestId) : undefined,
    )
    const [rows, totalRows] = await Promise.all([
      db.query.domainEvents.findMany({
        where,
        orderBy: desc(domainEvents.occurredAt),
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db.query.domainEvents.findMany({
        where,
        columns: { id: true },
      }),
    ])

    return ok(c, rows, 200, {
      pagination: {
        page,
        perPage,
        total: totalRows.length,
        hasMore: page * perPage < totalRows.length,
      },
    })
  },
)

actionRoutes.get(
  '/bizes/:bizId/events/:domainEventId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('events.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, domainEventId } = c.req.param()
    const row = await db.query.domainEvents.findFirst({
      where: and(eq(domainEvents.bizId, bizId), eq(domainEvents.id, domainEventId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Domain event not found.', 404)
    return ok(c, row)
  },
)
