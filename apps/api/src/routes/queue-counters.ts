/**
 * Queue counter / dispatch-board routes.
 *
 * ELI5:
 * A queue says "people are waiting".
 * A counter says "this is the place/person serving them".
 * An assignment says "who is staffing that counter right now".
 *
 * Why this route exists:
 * - queue tickets alone do not answer "which window is open?",
 * - front-desk and clinic flows need first-class counter APIs,
 * - sagas should validate counter operations through HTTP.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const { db, queueCounters, queueCounterAssignments, queueEntries, queueTickets, queueTicketCalls } = dbPackage

const counterBodySchema = z.object({
  queueId: z.string().min(1),
  locationId: z.string().optional().nullable(),
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).default('active'),
  counterType: z.string().default('window'),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const assignmentBodySchema = z.object({
  queueCounterId: z.string().min(1),
  assigneeUserId: z.string().optional().nullable(),
  assigneeGroupAccountId: z.string().optional().nullable(),
  assigneeResourceId: z.string().optional().nullable(),
  assigneeSubjectType: z.string().max(80).optional().nullable(),
  assigneeSubjectId: z.string().max(140).optional().nullable(),
  assignmentState: z.string().default('scheduled'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  activatedAt: z.string().datetime().optional().nullable(),
  endedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const counterPatchSchema = counterBodySchema.partial()

const assignmentPatchSchema = assignmentBodySchema.partial()

const callBodySchema = z.object({
  queueEntryId: z.string().min(1),
  queueCounterId: z.string().min(1),
  callState: z.string().default('called'),
  calledAt: z.string().datetime().optional().nullable(),
  acknowledgedAt: z.string().datetime().optional().nullable(),
  serviceStartedAt: z.string().datetime().optional().nullable(),
  serviceEndedAt: z.string().datetime().optional().nullable(),
  calledByUserId: z.string().optional().nullable(),
  servedByUserId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const callPatchSchema = callBodySchema.omit({ queueEntryId: true, queueCounterId: true }).partial()

export const queueCounterRoutes = new Hono()

queueCounterRoutes.get('/bizes/:bizId/queue-counters', requireAuth, requireBizAccess('bizId'), requireAclPermission('queues.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const queueId = c.req.query('queueId')
  const rows = await db.query.queueCounters.findMany({
    where: and(eq(queueCounters.bizId, bizId), queueId ? eq(queueCounters.queueId, queueId) : undefined),
    orderBy: [asc(queueCounters.name)],
  })
  return ok(c, rows)
})

queueCounterRoutes.post('/bizes/:bizId/queue-counters', requireAuth, requireBizAccess('bizId'), requireAclPermission('queues.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = counterBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(queueCounters).values({
    bizId,
    ...parsed.data,
    policy: parsed.data.policy ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

queueCounterRoutes.patch('/bizes/:bizId/queue-counters/:queueCounterId', requireAuth, requireBizAccess('bizId'), requireAclPermission('queues.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, queueCounterId } = c.req.param()
  const parsed = counterPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.update(queueCounters).set({
    queueId: parsed.data.queueId ?? undefined,
    locationId: parsed.data.locationId ?? undefined,
    code: parsed.data.code ?? undefined,
    name: parsed.data.name ?? undefined,
    status: parsed.data.status ?? undefined,
    counterType: parsed.data.counterType ?? undefined,
    policy: parsed.data.policy ?? undefined,
    metadata: parsed.data.metadata ?? undefined,
  }).where(and(eq(queueCounters.bizId, bizId), eq(queueCounters.id, queueCounterId))).returning()
  if (!row) return fail(c, 'NOT_FOUND', 'Queue counter not found.', 404)
  return ok(c, row)
})

queueCounterRoutes.get('/bizes/:bizId/queue-counter-assignments', requireAuth, requireBizAccess('bizId'), requireAclPermission('queues.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const queueCounterId = c.req.query('queueCounterId')
  const rows = await db.query.queueCounterAssignments.findMany({
    where: and(eq(queueCounterAssignments.bizId, bizId), queueCounterId ? eq(queueCounterAssignments.queueCounterId, queueCounterId) : undefined),
    orderBy: [desc(queueCounterAssignments.startsAt)],
  })
  return ok(c, rows)
})

queueCounterRoutes.post('/bizes/:bizId/queue-counter-assignments', requireAuth, requireBizAccess('bizId'), requireAclPermission('queues.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = assignmentBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(queueCounterAssignments).values({
    bizId,
    ...parsed.data,
    startsAt: new Date(parsed.data.startsAt),
    endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    activatedAt: parsed.data.activatedAt ? new Date(parsed.data.activatedAt) : null,
    endedAt: parsed.data.endedAt ? new Date(parsed.data.endedAt) : null,
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

queueCounterRoutes.patch('/bizes/:bizId/queue-counter-assignments/:assignmentId', requireAuth, requireBizAccess('bizId'), requireAclPermission('queues.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, assignmentId } = c.req.param()
  const parsed = assignmentPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.update(queueCounterAssignments).set({
    queueCounterId: parsed.data.queueCounterId ?? undefined,
    assigneeUserId: parsed.data.assigneeUserId ?? undefined,
    assigneeGroupAccountId: parsed.data.assigneeGroupAccountId ?? undefined,
    assigneeResourceId: parsed.data.assigneeResourceId ?? undefined,
    assigneeSubjectType: parsed.data.assigneeSubjectType ?? undefined,
    assigneeSubjectId: parsed.data.assigneeSubjectId ?? undefined,
    assignmentState: parsed.data.assignmentState ?? undefined,
    startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
    endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
    activatedAt: parsed.data.activatedAt ? new Date(parsed.data.activatedAt) : undefined,
    endedAt: parsed.data.endedAt ? new Date(parsed.data.endedAt) : undefined,
    metadata: parsed.data.metadata ?? undefined,
  }).where(and(eq(queueCounterAssignments.bizId, bizId), eq(queueCounterAssignments.id, assignmentId))).returning()
  if (!row) return fail(c, 'NOT_FOUND', 'Queue counter assignment not found.', 404)
  return ok(c, row)
})

queueCounterRoutes.get('/bizes/:bizId/queue-ticket-calls', requireAuth, requireBizAccess('bizId'), requireAclPermission('queues.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const queueCounterId = c.req.query('queueCounterId')
  const queueEntryId = c.req.query('queueEntryId')
  const rows = await db.query.queueTicketCalls.findMany({
    where: and(
      eq(queueTicketCalls.bizId, bizId),
      queueCounterId ? eq(queueTicketCalls.queueCounterId, queueCounterId) : undefined,
      queueEntryId ? eq(queueTicketCalls.queueEntryId, queueEntryId) : undefined,
    ),
    orderBy: [desc(queueTicketCalls.calledAt)],
  })
  return ok(c, rows)
})

queueCounterRoutes.post('/bizes/:bizId/queue-ticket-calls', requireAuth, requireBizAccess('bizId'), requireAclPermission('queues.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = callBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const [entry, counter] = await Promise.all([
    db.query.queueEntries.findFirst({
      where: and(eq(queueEntries.bizId, bizId), eq(queueEntries.id, parsed.data.queueEntryId)),
    }),
    db.query.queueCounters.findFirst({
      where: and(eq(queueCounters.bizId, bizId), eq(queueCounters.id, parsed.data.queueCounterId)),
    }),
  ])
  if (!entry) return fail(c, 'NOT_FOUND', 'Queue entry not found.', 404)
  if (!counter) return fail(c, 'NOT_FOUND', 'Queue counter not found.', 404)

  let ticket = await db.query.queueTickets.findFirst({
    where: and(eq(queueTickets.bizId, bizId), eq(queueTickets.queueEntryId, entry.id)),
    orderBy: [desc(queueTickets.issuedAt)],
  })
  if (!ticket) {
    const existingTickets = await db.query.queueTickets.findMany({
      where: and(eq(queueTickets.bizId, bizId), eq(queueTickets.queueId, entry.queueId)),
      orderBy: [desc(queueTickets.ticketNumber)],
      limit: 1,
    })
    const nextTicketNumber = (existingTickets[0]?.ticketNumber ?? 0) + 1
    ;[ticket] = await db.insert(queueTickets).values({
      bizId,
      queueEntryId: entry.id,
      queueId: entry.queueId,
      ticketNumber: nextTicketNumber,
      status: 'issued',
      metadata: {},
    }).returning()
  }

  const [row] = await db.insert(queueTicketCalls).values({
    bizId,
    queueTicketId: ticket.id,
    queueEntryId: entry.id,
    queueCounterId: counter.id,
    callState: parsed.data.callState,
    calledAt: parsed.data.calledAt ? new Date(parsed.data.calledAt) : new Date(),
    acknowledgedAt: parsed.data.acknowledgedAt ? new Date(parsed.data.acknowledgedAt) : null,
    serviceStartedAt: parsed.data.serviceStartedAt ? new Date(parsed.data.serviceStartedAt) : null,
    serviceEndedAt: parsed.data.serviceEndedAt ? new Date(parsed.data.serviceEndedAt) : null,
    calledByUserId: parsed.data.calledByUserId ?? null,
    servedByUserId: parsed.data.servedByUserId ?? null,
    metadata: parsed.data.metadata ?? {},
  }).returning()

  await db.update(queueTickets).set({
    status: row.callState === 'served' ? 'completed' : row.callState === 'cancelled' ? 'cancelled' : row.serviceStartedAt ? 'serving' : 'called',
    calledAt: row.calledAt,
    serviceStartedAt: row.serviceStartedAt ?? undefined,
    serviceEndedAt: row.serviceEndedAt ?? undefined,
  }).where(and(eq(queueTickets.bizId, bizId), eq(queueTickets.id, ticket.id)))

  return ok(c, row, 201)
})

queueCounterRoutes.patch('/bizes/:bizId/queue-ticket-calls/:callId', requireAuth, requireBizAccess('bizId'), requireAclPermission('queues.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, callId } = c.req.param()
  const parsed = callPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.update(queueTicketCalls).set({
    callState: parsed.data.callState ?? undefined,
    calledAt: parsed.data.calledAt ? new Date(parsed.data.calledAt) : undefined,
    acknowledgedAt: parsed.data.acknowledgedAt ? new Date(parsed.data.acknowledgedAt) : undefined,
    serviceStartedAt: parsed.data.serviceStartedAt ? new Date(parsed.data.serviceStartedAt) : undefined,
    serviceEndedAt: parsed.data.serviceEndedAt ? new Date(parsed.data.serviceEndedAt) : undefined,
    calledByUserId: parsed.data.calledByUserId ?? undefined,
    servedByUserId: parsed.data.servedByUserId ?? undefined,
    metadata: parsed.data.metadata ?? undefined,
  }).where(and(eq(queueTicketCalls.bizId, bizId), eq(queueTicketCalls.id, callId))).returning()
  if (!row) return fail(c, 'NOT_FOUND', 'Queue ticket call not found.', 404)
  return ok(c, row)
})

queueCounterRoutes.get('/bizes/:bizId/queue-counter-analytics', requireAuth, requireBizAccess('bizId'), requireAclPermission('queues.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const queueId = c.req.query('queueId')
  const locationId = c.req.query('locationId')
  const counters = await db.query.queueCounters.findMany({
    where: and(
      eq(queueCounters.bizId, bizId),
      queueId ? eq(queueCounters.queueId, queueId) : undefined,
      locationId ? eq(queueCounters.locationId, locationId) : undefined,
    ),
    orderBy: [asc(queueCounters.name)],
  })
  const counterIds = counters.map((row) => row.id)
  const [calls, assignments] = await Promise.all([
    counterIds.length
      ? db.query.queueTicketCalls.findMany({
          where: and(eq(queueTicketCalls.bizId, bizId)),
          orderBy: [desc(queueTicketCalls.calledAt)],
        })
      : Promise.resolve([]),
    counterIds.length
      ? db.query.queueCounterAssignments.findMany({
          where: and(eq(queueCounterAssignments.bizId, bizId)),
          orderBy: [desc(queueCounterAssignments.startsAt)],
        })
      : Promise.resolve([]),
  ])

  const rows = counters.map((counter) => {
    const counterCalls = calls.filter((row) => row.queueCounterId === counter.id)
    const counterAssignments = assignments.filter((row) => row.queueCounterId === counter.id)
    const servedCalls = counterCalls.filter((row) => row.callState === 'served' && row.serviceStartedAt && row.serviceEndedAt)
    const avgServiceSeconds = servedCalls.length
      ? Math.round(
          servedCalls.reduce((sum, row) => sum + ((row.serviceEndedAt!.getTime() - row.serviceStartedAt!.getTime()) / 1000), 0) /
            servedCalls.length,
        )
      : null
    return {
      counterId: counter.id,
      counterCode: counter.code,
      counterName: counter.name,
      queueId: counter.queueId,
      locationId: counter.locationId,
      status: counter.status,
      totalCalls: counterCalls.length,
      servedCalls: servedCalls.length,
      lastCalledAt: counterCalls[0]?.calledAt ?? null,
      averageServiceSeconds: avgServiceSeconds,
      activeAssignmentCount: counterAssignments.filter((row) => row.assignmentState === 'active').length,
    }
  })

  return ok(c, rows)
})
