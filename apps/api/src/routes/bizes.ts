/**
 * Biz routes.
 *
 * These endpoints manage tenant roots and enforce that membership is established
 * immediately when a user creates a new biz.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
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
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { appendAuditEvent, createOperationalAlert } from '../lib/audit-log.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, auditEvents, auditStreams, bizes, members } = dbPackage

const listQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  type: z.enum(['individual', 'small_business', 'enterprise']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const createBizBodySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  type: z.enum(['individual', 'small_business', 'enterprise']).default('small_business'),
  timezone: z.string().min(1).max(50).default('UTC'),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  logoUrl: z.string().url().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateBizBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  type: z.enum(['individual', 'small_business', 'enterprise']).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  timezone: z.string().min(1).max(50).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  logoUrl: z.string().url().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const listAuditEventsQuerySchema = z.object({
  entityType: z.string().max(120).optional(),
  entityId: z.string().max(140).optional(),
  eventType: z
    .enum(['create', 'update', 'delete', 'read', 'state_transition', 'policy_decision', 'payment_event', 'custom'])
    .optional(),
  streamType: z.string().max(120).optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const createDataExportRequestBodySchema = z.object({
  exportType: z.string().min(1).max(120),
  format: z.enum(['json', 'csv', 'zip']).default('json'),
  scopeType: z.enum(['biz', 'location', 'subject', 'custom']).default('biz'),
  scopeRefId: z.string().max(140).optional(),
  reason: z.string().min(1).max(500),
  metadata: z.record(z.unknown()).optional(),
})

function pagination(input: { page?: string; perPage?: string }) {
  const page = Math.max(1, Number.parseInt(input.page ?? '1', 10) || 1)
  const perPage = Math.min(100, Math.max(1, Number.parseInt(input.perPage ?? '20', 10) || 20))
  return { page, perPage, offset: (page - 1) * perPage }
}

function auditActorTypeFromSource(source: string | null | undefined) {
  if (source === 'api_key') return 'api_key' as const
  if (source === 'integration') return 'integration' as const
  if (source === 'system') return 'system' as const
  return 'user' as const
}

export const bizRoutes = new Hono()

bizRoutes.get('/', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const { page, perPage, search, status, type, sortBy = 'name', sortOrder = 'desc' } = parsed.data
  const pageNum = parsePositiveInt(page, 1)
  const perPageNum = Math.min(parsePositiveInt(perPage, 20), 100)

  const where = and(
    eq(members.userId, user.id),
    status ? eq(bizes.status, status) : undefined,
    type ? eq(bizes.type, type) : undefined,
    search ? ilike(bizes.name, `%${search}%`) : undefined,
  )

  const sortColumn = sortBy === 'name' ? bizes.name : bizes.name
  const orderByExpr = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: bizes.id,
        name: bizes.name,
        slug: bizes.slug,
        type: bizes.type,
        status: bizes.status,
        timezone: bizes.timezone,
        currency: bizes.currency,
        logoUrl: bizes.logoUrl,
        metadata: bizes.metadata,
        membershipRole: members.role,
      })
      .from(bizes)
      .innerJoin(members, eq(members.organizationId, bizes.id))
      .where(where)
      .orderBy(orderByExpr)
      .limit(perPageNum)
      .offset((pageNum - 1) * perPageNum),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(bizes)
      .innerJoin(members, eq(members.organizationId, bizes.id))
      .where(where),
  ])

  const total = countRows[0]?.count ?? 0
  return ok(c, rows, 200, {
    pagination: {
      page: pageNum,
      perPage: perPageNum,
      total,
      hasMore: pageNum * perPageNum < total,
    },
  })
})

bizRoutes.post('/', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = createBizBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const duplicate = await db.query.bizes.findFirst({ where: eq(bizes.slug, parsed.data.slug) })
  if (duplicate) {
    return fail(c, 'DUPLICATE_SLUG', 'A biz with this slug already exists.', 409)
  }

  const createdResult = await executeCrudRouteAction({
    c,
    bizId: null,
    tableKey: 'bizes',
    operation: 'create',
    subjectType: 'biz',
    subjectId: parsed.data.slug,
    displayName: parsed.data.name,
    data: {
      name: sanitizePlainText(parsed.data.name),
      slug: parsed.data.slug,
      type: parsed.data.type,
      status: 'active',
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      logoUrl: parsed.data.logoUrl ?? null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
    metadata: { source: 'routes.bizes.create' },
  })
  if (!createdResult.ok) {
    return fail(c, createdResult.code, createdResult.message, createdResult.httpStatus, createdResult.details)
  }
  if (!createdResult.row) {
    return fail(c, 'ACTION_EXECUTION_FAILED', 'Biz create returned no row.', 500)
  }
  const created = createdResult.row

  const memberResult = await executeCrudRouteAction({
    c,
    bizId: String(created.id),
    tableKey: 'members',
    operation: 'create',
    subjectType: 'member',
    subjectId: String(created.id),
    displayName: 'owner membership',
    data: {
      id: `member_${crypto.randomUUID().replace(/-/g, '')}`,
      organizationId: created.id,
      userId: user.id,
      role: 'owner',
      createdAt: new Date(),
    },
    metadata: { source: 'routes.bizes.createOwnerMembership' },
  })
  if (!memberResult.ok) {
    return fail(c, memberResult.code, memberResult.message, memberResult.httpStatus, memberResult.details)
  }

  return ok(c, created, 201)
})

/**
 * Read immutable audit events for one biz.
 *
 * This lives in the biz router on purpose so the `/bizes/:bizId/*` prefix is
 * owned by one module and cannot be shadowed by the generic `/:bizId` route.
 */
bizRoutes.get(
  '/:bizId/audit/events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listAuditEventsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const { page, perPage, offset } = pagination(parsed.data)
    const rows = await db
      .select({
        id: auditEvents.id,
        eventType: auditEvents.eventType,
        occurredAt: auditEvents.occurredAt,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        reasonCode: auditEvents.reasonCode,
        note: auditEvents.note,
        metadata: auditEvents.metadata,
        beforeState: auditEvents.beforeState,
        afterState: auditEvents.afterState,
        diff: auditEvents.diff,
        streamKey: auditStreams.streamKey,
        streamType: auditStreams.streamType,
      })
      .from(auditEvents)
      .innerJoin(auditStreams, eq(auditStreams.id, auditEvents.streamId))
      .where(
        and(
          eq(auditEvents.bizId, bizId),
          parsed.data.entityType ? eq(auditEvents.entityType, parsed.data.entityType) : undefined,
          parsed.data.entityId ? eq(auditEvents.entityId, parsed.data.entityId) : undefined,
          parsed.data.eventType ? eq(auditEvents.eventType, parsed.data.eventType) : undefined,
          parsed.data.streamType ? eq(auditStreams.streamType, parsed.data.streamType) : undefined,
        ),
      )
      .orderBy(desc(auditEvents.occurredAt))
      .limit(perPage)
      .offset(offset)

    return ok(c, { items: rows, page, perPage })
  },
)

/**
 * Record a data export request as a first-class audited biz action.
 */
bizRoutes.post(
  '/:bizId/data-export-requests',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createDataExportRequestBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const actor = getCurrentUser(c)
    const requestId = `export_req_${crypto.randomUUID().replace(/-/g, '')}`
    const auditEvent = await appendAuditEvent({
      bizId,
      streamKey: `tenant:${bizId}`,
      streamType: 'tenant',
      entityType: 'data_export_request',
      entityId: requestId,
      eventType: 'create',
      actorType: auditActorTypeFromSource(getCurrentAuthSource(c)),
      actorUserId: actor?.id ?? null,
      actorRef: getCurrentAuthCredentialId(c) ?? null,
      reasonCode: 'data_export_request',
      note: sanitizePlainText(parsed.data.reason),
      requestRef: c.get('requestId') ?? null,
      sourceIp: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
      afterState: {
        exportType: parsed.data.exportType,
        format: parsed.data.format,
        scopeType: parsed.data.scopeType,
        scopeRefId: parsed.data.scopeRefId ?? null,
      },
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}) as Record<string, unknown>,
    })

    await createOperationalAlert({
      bizId,
      recipientUserId: actor?.id ?? null,
      recipientRef: actor?.email ?? 'ops@bizing.local',
      subject: 'Data export requested',
      body: `Data export request ${requestId} was logged.`,
      metadata: {
        source: 'data_export_request',
        requestId,
        auditEventId: auditEvent.id,
        exportType: parsed.data.exportType,
      },
    })

    return ok(c, {
      id: requestId,
      exportType: parsed.data.exportType,
      format: parsed.data.format,
      scopeType: parsed.data.scopeType,
      scopeRefId: parsed.data.scopeRefId ?? null,
      reason: parsed.data.reason,
      auditEventId: auditEvent.id,
    }, 201)
  },
)

bizRoutes.get(
  '/:bizId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
  const bizId = c.req.param('bizId')
  const row = await db.query.bizes.findFirst({ where: eq(bizes.id, bizId) })
  if (!row) return fail(c, 'NOT_FOUND', 'Biz not found.', 404)
  return ok(c, row)
  },
)

bizRoutes.patch(
  '/:bizId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const _user = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = updateBizBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.bizes.findFirst({ where: eq(bizes.id, bizId) })
    if (!existing) return fail(c, 'NOT_FOUND', 'Biz not found.', 404)

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const dup = await db.query.bizes.findFirst({ where: eq(bizes.slug, parsed.data.slug) })
      if (dup) return fail(c, 'DUPLICATE_SLUG', 'A biz with this slug already exists.', 409)
    }

    const updatedResult = await executeCrudRouteAction({
      c,
      bizId,
      tableKey: 'bizes',
      operation: 'update',
      id: bizId,
      subjectType: 'biz',
      subjectId: bizId,
      displayName: 'update biz',
      patch: {
        ...parsed.data,
        name: parsed.data.name ? sanitizePlainText(parsed.data.name) : undefined,
        metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
      },
      metadata: { source: 'routes.bizes.patch' },
    })
    if (!updatedResult.ok) {
      return fail(c, updatedResult.code, updatedResult.message, updatedResult.httpStatus, updatedResult.details)
    }
    if (!updatedResult.row) {
      return fail(c, 'ACTION_EXECUTION_FAILED', 'Biz update returned no row.', 500)
    }
    const updated = updatedResult.row

    return ok(c, updated)
  },
)

bizRoutes.delete(
  '/:bizId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.archive', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const _user = getCurrentUser(c)

    const existing = await db.query.bizes.findFirst({ where: eq(bizes.id, bizId) })
    if (!existing) return fail(c, 'NOT_FOUND', 'Biz not found.', 404)

    const archivedResult = await executeCrudRouteAction({
      c,
      bizId,
      tableKey: 'bizes',
      operation: 'update',
      id: bizId,
      subjectType: 'biz',
      subjectId: bizId,
      displayName: 'archive biz',
      patch: {
        status: 'archived',
      },
      metadata: { source: 'routes.bizes.archive' },
    })
    if (!archivedResult.ok) {
      return fail(c, archivedResult.code, archivedResult.message, archivedResult.httpStatus, archivedResult.details)
    }

    return ok(c, { id: bizId })
  },
)
