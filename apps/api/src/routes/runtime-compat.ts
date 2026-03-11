/**
 * Runtime compatibility routes.
 *
 * ELI5:
 * Keep older endpoint contracts in one place so the main domain router stays
 * focused on canonical surfaces while clients migrate.
 */

import { Hono } from 'hono'
import { eq, inArray, sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAuth } from '../middleware/auth.js'
import { getSchemaGraph } from '../services/schema-graph.js'

const { db, bookingOrders, members } = dbPackage

function log(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

export const runtimeCompatRoutes = new Hono()

runtimeCompatRoutes.get('/products', (c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'DEPRECATED_ENDPOINT',
        message: 'Use /api/v1/bizes/:bizId/offers for catalog entries and productized offerings.',
      },
    },
    410,
  )
})

runtimeCompatRoutes.get('/bookings', (c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'DEPRECATED_ENDPOINT',
        message: 'Use /api/v1/bizes/:bizId/booking-orders instead.',
      },
    },
    410,
  )
})

runtimeCompatRoutes.get('/stats', requireAuth, async (c) => {
  try {
    const user = getCurrentUser(c)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const isPlatformOperator = user.role === 'admin' || user.role === 'owner'
    let scopedBizIds: string[] = []
    if (!isPlatformOperator) {
      const memberRows = await db
        .select({ bizId: members.organizationId })
        .from(members)
        .where(eq(members.userId, user.id))
      scopedBizIds = memberRows.map((row) => row.bizId)
      if (!scopedBizIds.length) {
        return c.json({
          totalRevenue: 0,
          totalBookings: 0,
          totalCustomers: 0,
          pendingOrders: 0,
        })
      }
    }

    const where = isPlatformOperator ? undefined : inArray(bookingOrders.bizId, scopedBizIds)

    const selectQuery = db
      .select({
        totalRevenueMinor: sql<number>`coalesce(sum(${bookingOrders.totalMinor}), 0)`.mapWith(Number),
        totalBookings: sql<number>`count(*)`.mapWith(Number),
        pendingOrders: sql<number>`
          count(*) filter (
            where ${bookingOrders.status} in ('draft', 'quoted', 'awaiting_payment')
          )
        `.mapWith(Number),
        totalCustomers: sql<number>`count(distinct ${bookingOrders.customerUserId})`.mapWith(Number),
      })
      .from(bookingOrders)

    const [aggregate] = where ? await selectQuery.where(where) : await selectQuery

    return c.json({
      totalRevenue: (aggregate?.totalRevenueMinor ?? 0) / 100,
      totalBookings: aggregate?.totalBookings ?? 0,
      totalCustomers: aggregate?.totalCustomers ?? 0,
      pendingOrders: aggregate?.pendingOrders ?? 0,
    })
  } catch (error) {
    log(`Failed to fetch stats: ${error instanceof Error ? error.message : String(error)}`)
    return c.json({ error: 'Failed to fetch stats' }, 500)
  }
})

runtimeCompatRoutes.get('/schema/graph', requireAuth, (c) => {
  try {
    return c.json(getSchemaGraph())
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`Failed to build schema graph: ${message}`)
    return c.json({ error: 'Failed to build schema graph', message }, 500)
  }
})

