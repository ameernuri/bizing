/**
 * Workflow + review runtime routes.
 *
 * ELI5:
 * The action backbone answers:
 * - what someone tried to do
 * - what event happened
 *
 * These routes answer the next layer:
 * - what long-running process started because of that
 * - what inbox/review item was created
 * - what step the workflow is currently on
 * - what deliverable/output is waiting later
 *
 * This is intentionally read-first for now. We want humans and agents to be
 * able to inspect process state before we add mutation-heavy intervention APIs.
 */

import { Hono } from 'hono'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  reviewQueues,
  reviewQueueItems,
  workflowInstances,
  workflowSteps,
  workflowDecisions,
  asyncDeliverables,
} = dbPackage

const listQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const listReviewQueuesQuerySchema = listQuerySchema.extend({
  type: z.string().optional(),
  status: z.string().optional(),
})

const listReviewItemsQuerySchema = listQuerySchema.extend({
  reviewQueueId: z.string().optional(),
  status: z.string().optional(),
  assignedToUserId: z.string().optional(),
  itemType: z.string().optional(),
})

const listWorkflowInstancesQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  workflowKey: z.string().optional(),
  targetType: z.string().optional(),
  actionRequestId: z.string().optional(),
})

const listAsyncDeliverablesQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  deliverableType: z.string().optional(),
  workflowInstanceId: z.string().optional(),
})

const createReviewQueueBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(140),
  type: z.enum(['fraud', 'manual_approval', 'compliance', 'moderation', 'risk']),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createReviewQueueItemBodySchema = z.object({
  reviewQueueId: z.string().min(1),
  status: z.enum(['pending', 'claimed', 'approved', 'rejected', 'escalated', 'timed_out', 'cancelled']).optional(),
  itemType: z.string().min(1).max(100),
  itemRefId: z.string().min(1).max(140),
  bookingOrderId: z.string().optional().nullable(),
  fulfillmentUnitId: z.string().optional().nullable(),
  sourceActionRequestId: z.string().optional().nullable(),
  sourceDomainEventId: z.string().optional().nullable(),
  priority: z.number().int().min(0).optional(),
  riskScore: z.number().int().min(0).max(100).optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  resolvedAt: z.string().datetime().optional().nullable(),
  resolutionPayload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const workflowRoutes = new Hono()

workflowRoutes.post(
  '/bizes/:bizId/review-queues',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createReviewQueueBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const [row] = await db.insert(reviewQueues).values({
      bizId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      type: parsed.data.type,
      status: parsed.data.status ?? 'active',
      policy: parsed.data.policy ?? {},
      metadata: parsed.data.metadata ?? {},
    }).returning()
    return ok(c, row, 201)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/review-queues',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listReviewQueuesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(reviewQueues.bizId, bizId),
      parsed.data.type ? eq(reviewQueues.type, parsed.data.type as never) : undefined,
      parsed.data.status ? eq(reviewQueues.status, parsed.data.status as never) : undefined,
    )
    const rows = await db.query.reviewQueues.findMany({
      where,
      orderBy: desc(reviewQueues.id),
      limit: perPage,
      offset: (page - 1) * perPage,
    })
    return ok(c, rows, 200, {
      pagination: { page, perPage, total: rows.length, hasMore: rows.length === perPage },
    })
  },
)

workflowRoutes.get(
  '/bizes/:bizId/review-queue-items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listReviewItemsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(reviewQueueItems.bizId, bizId),
      parsed.data.reviewQueueId ? eq(reviewQueueItems.reviewQueueId, parsed.data.reviewQueueId) : undefined,
      parsed.data.status ? eq(reviewQueueItems.status, parsed.data.status as never) : undefined,
      parsed.data.assignedToUserId ? eq(reviewQueueItems.assignedToUserId, parsed.data.assignedToUserId) : undefined,
      parsed.data.itemType ? eq(reviewQueueItems.itemType, parsed.data.itemType) : undefined,
    )
    const rows = await db.query.reviewQueueItems.findMany({
      where,
      orderBy: [desc(reviewQueueItems.priority), desc(reviewQueueItems.id)],
      limit: perPage,
      offset: (page - 1) * perPage,
    })
    return ok(c, rows, 200, {
      pagination: { page, perPage, total: rows.length, hasMore: rows.length === perPage },
    })
  },
)

workflowRoutes.post(
  '/bizes/:bizId/review-queue-items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createReviewQueueItemBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const [row] = await db.insert(reviewQueueItems).values({
      bizId,
      reviewQueueId: parsed.data.reviewQueueId,
      status: parsed.data.status ?? 'pending',
      itemType: parsed.data.itemType,
      itemRefId: parsed.data.itemRefId,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      fulfillmentUnitId: parsed.data.fulfillmentUnitId ?? null,
      sourceActionRequestId: parsed.data.sourceActionRequestId ?? null,
      sourceDomainEventId: parsed.data.sourceDomainEventId ?? null,
      priority: parsed.data.priority ?? 100,
      riskScore: parsed.data.riskScore ?? null,
      assignedToUserId: parsed.data.assignedToUserId ?? null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null,
      resolutionPayload: parsed.data.resolutionPayload ?? {},
      metadata: parsed.data.metadata ?? {},
    }).returning()
    return ok(c, row, 201)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/review-queue-items/:reviewQueueItemId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, reviewQueueItemId } = c.req.param()
    const row = await db.query.reviewQueueItems.findFirst({
      where: and(eq(reviewQueueItems.bizId, bizId), eq(reviewQueueItems.id, reviewQueueItemId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Review queue item not found.', 404)
    return ok(c, row)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflows',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listWorkflowInstancesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(workflowInstances.bizId, bizId),
      parsed.data.status ? eq(workflowInstances.status, parsed.data.status as never) : undefined,
      parsed.data.workflowKey ? eq(workflowInstances.workflowKey, parsed.data.workflowKey) : undefined,
      parsed.data.targetType ? eq(workflowInstances.targetType, parsed.data.targetType) : undefined,
      parsed.data.actionRequestId ? eq(workflowInstances.actionRequestId, parsed.data.actionRequestId) : undefined,
    )
    const rows = await db.query.workflowInstances.findMany({
      where,
      orderBy: desc(workflowInstances.startedAt),
      limit: perPage,
      offset: (page - 1) * perPage,
    })
    return ok(c, rows, 200, {
      pagination: { page, perPage, total: rows.length, hasMore: rows.length === perPage },
    })
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflows/:workflowInstanceId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workflowInstanceId } = c.req.param()
    const row = await db.query.workflowInstances.findFirst({
      where: and(eq(workflowInstances.bizId, bizId), eq(workflowInstances.id, workflowInstanceId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Workflow instance not found.', 404)

    const [steps, decisions] = await Promise.all([
      db.query.workflowSteps.findMany({
        where: and(eq(workflowSteps.bizId, bizId), eq(workflowSteps.workflowInstanceId, workflowInstanceId)),
        orderBy: workflowSteps.sequence,
      }),
      db.query.workflowDecisions.findMany({
        where: and(eq(workflowDecisions.bizId, bizId), eq(workflowDecisions.workflowInstanceId, workflowInstanceId)),
        orderBy: desc(workflowDecisions.decidedAt),
      }),
    ])

    return ok(c, { workflow: row, steps, decisions })
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflows/:workflowInstanceId/steps',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workflowInstanceId } = c.req.param()
    const rows = await db.query.workflowSteps.findMany({
      where: and(eq(workflowSteps.bizId, bizId), eq(workflowSteps.workflowInstanceId, workflowInstanceId)),
      orderBy: workflowSteps.sequence,
    })
    return ok(c, rows)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflows/:workflowInstanceId/decisions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workflowInstanceId } = c.req.param()
    const rows = await db.query.workflowDecisions.findMany({
      where: and(eq(workflowDecisions.bizId, bizId), eq(workflowDecisions.workflowInstanceId, workflowInstanceId)),
      orderBy: desc(workflowDecisions.decidedAt),
    })
    return ok(c, rows)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/async-deliverables',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listAsyncDeliverablesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(asyncDeliverables.bizId, bizId),
      parsed.data.status ? eq(asyncDeliverables.status, parsed.data.status as never) : undefined,
      parsed.data.deliverableType ? eq(asyncDeliverables.deliverableType, parsed.data.deliverableType as never) : undefined,
      parsed.data.workflowInstanceId ? eq(asyncDeliverables.workflowInstanceId, parsed.data.workflowInstanceId) : undefined,
    )
    const rows = await db.query.asyncDeliverables.findMany({
      where,
      orderBy: desc(asyncDeliverables.requestedAt),
      limit: perPage,
      offset: (page - 1) * perPage,
    })
    return ok(c, rows, 200, {
      pagination: { page, perPage, total: rows.length, hasMore: rows.length === perPage },
    })
  },
)

workflowRoutes.get(
  '/bizes/:bizId/async-deliverables/:asyncDeliverableId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, asyncDeliverableId } = c.req.param()
    const row = await db.query.asyncDeliverables.findFirst({
      where: and(eq(asyncDeliverables.bizId, bizId), eq(asyncDeliverables.id, asyncDeliverableId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Async deliverable not found.', 404)
    return ok(c, row)
  },
)
