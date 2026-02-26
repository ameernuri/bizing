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
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const { db, dispatchTasks, transportRoutes, transportTrips } = dbPackage

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

export const dispatchRoutes = new Hono()

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
