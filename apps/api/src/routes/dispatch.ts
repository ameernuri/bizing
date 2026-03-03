/**
 * Dispatch/transport read-model routes (biz-scoped).
 *
 * Why this exists:
 * - Sagas need a first-class way to validate route/dispatch operational state.
 * - Agents need one API endpoint that summarizes "what's happening right now"
 *   without joining many tables client-side.
 *
 * This is intentionally read-only for now. Mutations can be added later with
 * the same scope/ACL model.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'

const { db, dispatchTasks, transportRoutes, transportRouteStops, transportTrips, etaEvents } = dbPackage

const querySchema = z.object({
  /**
   * Window size for "upcoming trips". Keeps payload bounded for dashboards.
   */
  lookaheadHours: z.coerce.number().int().min(1).max(24 * 14).default(72),
  /**
   * Max rows returned in each recent list section.
   */
  perEntityLimit: z.coerce.number().int().min(1).max(100).default(20),
})

const routeBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(140),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  originLocationId: z.string().optional().nullable(),
  destinationLocationId: z.string().optional().nullable(),
  timezone: z.string().min(1).max(50).default('UTC'),
  policy: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).optional(),
})

const routeStopBodySchema = z.object({
  stopOrder: z.number().int().min(0),
  kind: z.enum(['pickup', 'dropoff', 'waypoint', 'depot', 'break']),
  name: z.string().min(1).max(180),
  locationId: z.string().optional().nullable(),
  geoPoint: z.record(z.unknown()).default({}),
  offsetFromStartMin: z.number().int().min(0).optional().nullable(),
  dwellMin: z.number().int().min(0).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const tripBodySchema = z.object({
  routeId: z.string().min(1),
  offerVersionId: z.string().optional().nullable(),
  fleetVehicleId: z.string().optional().nullable(),
  driverResourceId: z.string().optional().nullable(),
  calendarBindingId: z.string().optional().nullable(),
  status: z.enum(['planned', 'boarding', 'in_progress', 'delayed', 'completed', 'cancelled']).default('planned'),
  boardingOpensAt: z.string().datetime().optional().nullable(),
  departureAt: z.string().datetime(),
  arrivalAt: z.string().datetime(),
  capacitySeats: z.number().int().positive(),
  overbookSeats: z.number().int().min(0).default(0),
  policy: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).optional(),
})

const dispatchTaskBodySchema = z.object({
  tripId: z.string().optional().nullable(),
  assignedResourceId: z.string().optional().nullable(),
  title: z.string().min(1).max(220),
  instructions: z.string().max(2000).optional().nullable(),
  status: z.enum(['queued', 'assigned', 'accepted', 'en_route', 'in_progress', 'done', 'failed', 'cancelled']).default('queued'),
  dueAt: z.string().datetime().optional().nullable(),
  startedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const etaEventBodySchema = z.object({
  routeStopId: z.string().optional().nullable(),
  eventType: z.enum(['predicted', 'updated', 'arrived', 'departed', 'delay_alert']),
  eventAt: z.string().datetime().optional().nullable(),
  etaAt: z.string().datetime().optional().nullable(),
  actualAt: z.string().datetime().optional().nullable(),
  payload: z.record(z.unknown()).default({}),
})

export const dispatchRoutes = new Hono()

async function createDispatchRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0]
  bizId: string
  tableKey: string
  subjectType: string
  data: Record<string, unknown>
  displayName?: string
}) {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: 'create',
    subjectType: input.subjectType,
    displayName: input.displayName,
    data: input.data,
    metadata: { routeFamily: 'dispatch' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

dispatchRoutes.get(
  '/bizes/:bizId/dispatch/routes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bookings.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.transportRoutes.findMany({
      where: eq(transportRoutes.bizId, bizId),
      orderBy: [asc(transportRoutes.name)],
    })
    return ok(c, rows)
  },
)

dispatchRoutes.post(
  '/bizes/:bizId/dispatch/routes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = routeBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createDispatchRow<typeof transportRoutes.$inferSelect>({
      c,
      bizId,
      tableKey: 'transportRoutes',
      subjectType: 'transport_route',
      displayName: parsed.data.name,
      data: {
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      status: parsed.data.status,
      originLocationId: parsed.data.originLocationId ?? null,
      destinationLocationId: parsed.data.destinationLocationId ?? null,
      timezone: sanitizePlainText(parsed.data.timezone),
      policy: sanitizeUnknown(parsed.data.policy),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

dispatchRoutes.post(
  '/bizes/:bizId/dispatch/routes/:routeId/stops',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, routeId } = c.req.param()
    const parsed = routeStopBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createDispatchRow<typeof transportRouteStops.$inferSelect>({
      c,
      bizId,
      tableKey: 'transportRouteStops',
      subjectType: 'transport_route_stop',
      displayName: parsed.data.name,
      data: {
      bizId,
      routeId,
      stopOrder: parsed.data.stopOrder,
      kind: parsed.data.kind,
      name: sanitizePlainText(parsed.data.name),
      locationId: parsed.data.locationId ?? null,
      geoPoint: sanitizeUnknown(parsed.data.geoPoint),
      offsetFromStartMin: parsed.data.offsetFromStartMin ?? null,
      dwellMin: parsed.data.dwellMin ?? null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

dispatchRoutes.post(
  '/bizes/:bizId/dispatch/trips',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = tripBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createDispatchRow<typeof transportTrips.$inferSelect>({
      c,
      bizId,
      tableKey: 'transportTrips',
      subjectType: 'transport_trip',
      displayName: parsed.data.routeId,
      data: {
      bizId,
      routeId: parsed.data.routeId,
      offerVersionId: parsed.data.offerVersionId ?? null,
      fleetVehicleId: parsed.data.fleetVehicleId ?? null,
      driverResourceId: parsed.data.driverResourceId ?? null,
      calendarBindingId: parsed.data.calendarBindingId ?? null,
      status: parsed.data.status,
      boardingOpensAt: parsed.data.boardingOpensAt ? new Date(parsed.data.boardingOpensAt) : null,
      departureAt: new Date(parsed.data.departureAt),
      arrivalAt: new Date(parsed.data.arrivalAt),
      capacitySeats: parsed.data.capacitySeats,
      overbookSeats: parsed.data.overbookSeats,
      policy: sanitizeUnknown(parsed.data.policy),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

dispatchRoutes.get(
  '/bizes/:bizId/dispatch/trips/:tripId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bookings.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, tripId } = c.req.param()
    const trip = await db.query.transportTrips.findFirst({
      where: and(eq(transportTrips.bizId, bizId), eq(transportTrips.id, tripId)),
    })
    if (!trip) return fail(c, 'NOT_FOUND', 'Trip not found.', 404)
    const [tasks, etaTimeline, stops] = await Promise.all([
      db.query.dispatchTasks.findMany({
        where: and(eq(dispatchTasks.bizId, bizId), eq(dispatchTasks.tripId, tripId)),
        orderBy: [asc(dispatchTasks.dueAt)],
      }),
      db.query.etaEvents.findMany({
        where: and(eq(etaEvents.bizId, bizId), eq(etaEvents.tripId, tripId)),
        orderBy: [asc(etaEvents.eventAt)],
      }),
      db.select().from(transportRouteStops).where(and(eq(transportRouteStops.bizId, bizId), eq(transportRouteStops.routeId, trip.routeId))).orderBy(asc(transportRouteStops.stopOrder)),
    ])
    return ok(c, { trip, tasks, etaTimeline, stops })
  },
)

dispatchRoutes.post(
  '/bizes/:bizId/dispatch/tasks',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = dispatchTaskBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createDispatchRow<typeof dispatchTasks.$inferSelect>({
      c,
      bizId,
      tableKey: 'dispatchTasks',
      subjectType: 'dispatch_task',
      displayName: parsed.data.title,
      data: {
      bizId,
      tripId: parsed.data.tripId ?? null,
      assignedResourceId: parsed.data.assignedResourceId ?? null,
      title: sanitizePlainText(parsed.data.title),
      instructions: parsed.data.instructions ? sanitizePlainText(parsed.data.instructions) : null,
      status: parsed.data.status,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
      completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

dispatchRoutes.post(
  '/bizes/:bizId/dispatch/trips/:tripId/eta-events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, tripId } = c.req.param()
    const parsed = etaEventBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const created = await createDispatchRow<typeof etaEvents.$inferSelect>({
      c,
      bizId,
      tableKey: 'etaEvents',
      subjectType: 'eta_event',
      displayName: parsed.data.eventType,
      data: {
      bizId,
      tripId,
      routeStopId: parsed.data.routeStopId ?? null,
      eventType: parsed.data.eventType,
      eventAt: parsed.data.eventAt ? new Date(parsed.data.eventAt) : new Date(),
      etaAt: parsed.data.etaAt ? new Date(parsed.data.etaAt) : null,
      actualAt: parsed.data.actualAt ? new Date(parsed.data.actualAt) : null,
      payload: sanitizeUnknown(parsed.data.payload),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

dispatchRoutes.get(
  '/bizes/:bizId/dispatch/state',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bookings.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = querySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const now = new Date()
    const lookaheadUntil = new Date(now.getTime() + parsed.data.lookaheadHours * 60 * 60 * 1000)
    const limit = parsed.data.perEntityLimit

    const [taskStatusRows, tripStatusRows, routeStatusRows, upcomingTrips, recentTasks] = await Promise.all([
      db
        .select({
          status: dispatchTasks.status,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(dispatchTasks)
        .where(eq(dispatchTasks.bizId, bizId))
        .groupBy(dispatchTasks.status),
      db
        .select({
          status: transportTrips.status,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(transportTrips)
        .where(eq(transportTrips.bizId, bizId))
        .groupBy(transportTrips.status),
      db
        .select({
          status: transportRoutes.status,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(transportRoutes)
        .where(eq(transportRoutes.bizId, bizId))
        .groupBy(transportRoutes.status),
      db.query.transportTrips.findMany({
        where: and(
          eq(transportTrips.bizId, bizId),
          gte(transportTrips.departureAt, now),
          lte(transportTrips.departureAt, lookaheadUntil),
        ),
        orderBy: [transportTrips.departureAt],
        limit,
      }),
      db.query.dispatchTasks.findMany({
        where: eq(dispatchTasks.bizId, bizId),
        orderBy: [desc(dispatchTasks.dueAt)],
        limit,
      }),
    ])

    return ok(c, {
      at: now.toISOString(),
      window: {
        startAt: now.toISOString(),
        endAt: lookaheadUntil.toISOString(),
        lookaheadHours: parsed.data.lookaheadHours,
      },
      summaries: {
        tasksByStatus: taskStatusRows,
        tripsByStatus: tripStatusRows,
        routesByStatus: routeStatusRows,
      },
      upcomingTrips,
      recentTasks,
    })
  },
)
