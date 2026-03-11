/**
 * Unified work-item routes.
 *
 * ELI5:
 * This is the cross-surface operational inbox for humans and agents.
 * Source domains stay canonical; these routes expose one prioritized queue.
 */

import { Hono } from 'hono'
import { and, desc, eq, ilike, notInArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok, parseJsonBody, parsePositiveInt, parseQuery } from './_api.js'
import {
  createManualWorkItem,
  isTrackedWorkItemSourceTable,
  type WorkItemSourceTable,
  syncWorkItemsForBiz,
  trackedWorkItemSourceTables,
  updateWorkItem,
} from '../services/work-items.js'

const { db, workItems, workItemEvents, workItemLinks, workCommandRuns, workflowInstances } = dbPackage

const workItemStatusSchema = z.enum(['open', 'in_progress', 'blocked', 'snoozed', 'done', 'cancelled'])
const workItemUrgencySchema = z.enum(['low', 'normal', 'high', 'critical'])
const workItemSourceTableSchema = z.custom<WorkItemSourceTable>(
  (value) => typeof value === 'string' && isTrackedWorkItemSourceTable(value),
  {
    message: `Invalid source table; expected one of ${trackedWorkItemSourceTables.join(', ')}`,
  },
)
const workItemSourceTypeSchema = z.enum([
  'manual',
  'action_request',
  'domain_event',
  'workflow_instance',
  'workflow_step',
  'review_item',
  'operational_demand',
  'operational_assignment',
  'crm_task',
  'support_case',
  'queue_entry',
  'dispatch_task',
  'work_run',
  'work_entry',
  'custom_subject',
])

const listWorkItemsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: workItemStatusSchema.optional(),
  sourceType: workItemSourceTypeSchema.optional(),
  assigneeUserId: z.string().optional(),
  includeCompleted: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
})

const createWorkItemBodySchema = z.object({
  title: z.string().min(1).max(260),
  summary: z.string().max(8000).optional().nullable(),
  status: workItemStatusSchema.optional(),
  urgency: workItemUrgencySchema.optional(),
  priority: z.number().int().min(0).max(100000).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  snoozedUntil: z.string().datetime().optional().nullable(),
  assigneeUserId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const updateWorkItemBodySchema = z.object({
  title: z.string().min(1).max(260).optional(),
  summary: z.string().max(8000).optional().nullable(),
  status: workItemStatusSchema.optional(),
  urgency: workItemUrgencySchema.optional(),
  priority: z.number().int().min(0).max(100000).optional(),
  rank: z.number().min(0).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  snoozedUntil: z.string().datetime().optional().nullable(),
  assigneeUserId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const syncWorkItemsBodySchema = z.object({
  sourceTables: z.array(workItemSourceTableSchema).min(1).optional(),
  limitPerSource: z.number().int().min(1).max(1000).optional(),
})

export const workItemRoutes = new Hono()

workItemRoutes.get(
  '/bizes/:bizId/work-items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsedQuery = parseQuery(c, listWorkItemsQuerySchema)
    if (!parsedQuery.ok) return parsedQuery.response

    const page = parsePositiveInt(parsedQuery.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsedQuery.data.perPage, 25), 200)
    const includeCompleted = parsedQuery.data.includeCompleted === 'true'
    const search = parsedQuery.data.search?.trim()

    const where = and(
      eq(workItems.bizId, bizId),
      parsedQuery.data.status ? eq(workItems.status, parsedQuery.data.status) : undefined,
      parsedQuery.data.sourceType ? eq(workItems.sourceType, parsedQuery.data.sourceType) : undefined,
      parsedQuery.data.assigneeUserId
        ? eq(workItems.assigneeUserId, parsedQuery.data.assigneeUserId)
        : undefined,
      includeCompleted ? undefined : notInArray(workItems.status, ['done', 'cancelled']),
      search ? ilike(workItems.title, `%${search}%`) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.workItems.findMany({
        where,
        orderBy: [
          workItems.priority,
          workItems.rank,
          workItems.dueAt,
          desc(workItems.urgency),
          desc(workItems.updatedAt),
        ],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(workItems).where(where),
    ])

    return ok(c, rows, 200, {
      pagination: {
        page,
        perPage,
        total: countRows[0]?.count ?? 0,
        hasMore: page * perPage < (countRows[0]?.count ?? 0),
      },
    })
  },
)

workItemRoutes.get(
  '/bizes/:bizId/work-items/:workItemId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workItemId } = c.req.param()

    const item = await db.query.workItems.findFirst({
      where: and(eq(workItems.bizId, bizId), eq(workItems.id, workItemId)),
    })
    if (!item) return fail(c, 'NOT_FOUND', 'Work item not found.', 404)

    const [events, links, recentCommandRuns] = await Promise.all([
      db.query.workItemEvents.findMany({
        where: and(eq(workItemEvents.bizId, bizId), eq(workItemEvents.workItemId, workItemId)),
        orderBy: [desc(workItemEvents.occurredAt)],
        limit: 200,
      }),
      db.query.workItemLinks.findMany({
        where: and(eq(workItemLinks.bizId, bizId), eq(workItemLinks.workItemId, workItemId)),
        orderBy: [desc(workItemLinks.isPrimary), desc(workItemLinks.updatedAt)],
        limit: 200,
      }),
      db.query.workCommandRuns.findMany({
        where: and(eq(workCommandRuns.bizId, bizId), eq(workCommandRuns.workItemId, workItemId)),
        orderBy: [desc(workCommandRuns.startedAt)],
        limit: 50,
      }),
    ])

    return ok(c, {
      item,
      events,
      links,
      recentCommandRuns,
    })
  },
)

workItemRoutes.post(
  '/bizes/:bizId/work-items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsedBody = await parseJsonBody(c, createWorkItemBodySchema)
    if (!parsedBody.ok) return parsedBody.response

    const user = getCurrentUser(c)

    const created = await createManualWorkItem({
      bizId,
      actorUserId: user?.id ?? null,
      title: parsedBody.data.title,
      summary: parsedBody.data.summary ?? null,
      status: parsedBody.data.status,
      urgency: parsedBody.data.urgency,
      priority: parsedBody.data.priority,
      startsAt: parsedBody.data.startsAt ? new Date(parsedBody.data.startsAt) : null,
      dueAt: parsedBody.data.dueAt ? new Date(parsedBody.data.dueAt) : null,
      snoozedUntil: parsedBody.data.snoozedUntil ? new Date(parsedBody.data.snoozedUntil) : null,
      assigneeUserId: parsedBody.data.assigneeUserId ?? null,
      ownerUserId: parsedBody.data.ownerUserId ?? user?.id ?? null,
      metadata: parsedBody.data.metadata,
    })

    return ok(c, created, 201)
  },
)

workItemRoutes.patch(
  '/bizes/:bizId/work-items/:workItemId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workItemId } = c.req.param()
    const parsedBody = await parseJsonBody(c, updateWorkItemBodySchema)
    if (!parsedBody.ok) return parsedBody.response

    const user = getCurrentUser(c)

    const updated = await updateWorkItem({
      bizId,
      workItemId,
      actorUserId: user?.id ?? null,
      patch: {
        title: parsedBody.data.title,
        summary: parsedBody.data.summary,
        status: parsedBody.data.status,
        urgency: parsedBody.data.urgency,
        priority: parsedBody.data.priority,
        rank: parsedBody.data.rank,
        startsAt:
          parsedBody.data.startsAt === undefined
            ? undefined
            : parsedBody.data.startsAt === null
              ? null
              : new Date(parsedBody.data.startsAt),
        dueAt:
          parsedBody.data.dueAt === undefined
            ? undefined
            : parsedBody.data.dueAt === null
              ? null
              : new Date(parsedBody.data.dueAt),
        snoozedUntil:
          parsedBody.data.snoozedUntil === undefined
            ? undefined
            : parsedBody.data.snoozedUntil === null
              ? null
              : new Date(parsedBody.data.snoozedUntil),
        assigneeUserId: parsedBody.data.assigneeUserId,
        ownerUserId: parsedBody.data.ownerUserId,
        metadata: parsedBody.data.metadata,
      },
    })

    if (!updated) return fail(c, 'NOT_FOUND', 'Work item not found.', 404)

    return ok(c, updated)
  },
)

workItemRoutes.post(
  '/bizes/:bizId/work-items/sync',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsedBody = await parseJsonBody(c, syncWorkItemsBodySchema)
    if (!parsedBody.ok) return parsedBody.response

    const user = getCurrentUser(c)

    const result = await syncWorkItemsForBiz({
      bizId,
      actorUserId: user?.id ?? null,
      sourceTables: parsedBody.data.sourceTables,
      limitPerSource: parsedBody.data.limitPerSource,
    })

    return ok(c, result)
  },
)

workItemRoutes.get(
  '/bizes/:bizId/work-items/continuity/feed',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')

    const [queue, recentEvents, activeCommandRuns, activeWorkflowInstances] = await Promise.all([
      db.query.workItems.findMany({
        where: and(
          eq(workItems.bizId, bizId),
          notInArray(workItems.status, ['done', 'cancelled']),
        ),
        orderBy: [workItems.priority, workItems.rank, workItems.dueAt, desc(workItems.updatedAt)],
        limit: 100,
      }),
      db.query.workItemEvents.findMany({
        where: eq(workItemEvents.bizId, bizId),
        orderBy: [desc(workItemEvents.occurredAt)],
        limit: 200,
      }),
      db.query.workCommandRuns.findMany({
        where: and(
          eq(workCommandRuns.bizId, bizId),
          notInArray(workCommandRuns.status, ['succeeded', 'failed', 'cancelled']),
        ),
        orderBy: [desc(workCommandRuns.startedAt)],
        limit: 100,
      }),
      db.query.workflowInstances.findMany({
        where: and(
          eq(workflowInstances.bizId, bizId),
          notInArray(workflowInstances.status, ['completed', 'failed', 'cancelled']),
        ),
        orderBy: [desc(workflowInstances.startedAt)],
        limit: 100,
      }),
    ])

    return ok(c, {
      queue,
      recentEvents,
      activeCommandRuns,
      activeWorkflowInstances,
    })
  },
)
