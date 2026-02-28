/**
 * Operations read-model routes.
 *
 * ELI5:
 * Core tables store precise facts. Operators also need one summary payload that
 * says "how are my locations doing right now?" This route gives that overview
 * without forcing every client to manually join half the schema.
 */

import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import {
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { ok } from './_api.js'

const { db, locations, resources, bookingOrders, demandPricingPolicies, queues } = dbPackage

function locationIdFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).locationId
  return typeof value === 'string' && value.length > 0 ? value : null
}

function secondaryLocationIdsFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const value = (metadata as Record<string, unknown>).secondaryLocationIds
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : []
}

export const operationsRoutes = new Hono()

operationsRoutes.get(
  '/bizes/:bizId/operations/location-overview',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')

    const [locationRows, resourceRows, bookingRows, pricingRows, queueRows] = await Promise.all([
      db.query.locations.findMany({
        where: and(eq(locations.bizId, bizId), eq(locations.status, 'active')),
        orderBy: [locations.name],
      }),
      db.query.resources.findMany({
        where: eq(resources.bizId, bizId),
        columns: { id: true, locationId: true, type: true, hostUserId: true, name: true, metadata: true },
      }),
      db.query.bookingOrders.findMany({
        where: eq(bookingOrders.bizId, bizId),
        columns: { id: true, status: true, totalMinor: true, metadata: true },
      }),
      db.query.demandPricingPolicies.findMany({
        where: eq(demandPricingPolicies.bizId, bizId),
        columns: { id: true, locationId: true, isEnabled: true, status: true, name: true },
      }),
      db.query.queues.findMany({
        where: eq(queues.bizId, bizId),
        columns: { id: true, locationId: true, status: true, name: true },
      }),
    ])

    const items = locationRows.map((location) => {
      const locationBookings = bookingRows.filter((row) => locationIdFromMetadata(row.metadata) === location.id)
      const locationResources = resourceRows.filter((row) => row.locationId === location.id)
      const locationPolicies = pricingRows.filter((row) => row.locationId === location.id && row.isEnabled)
      const locationQueues = queueRows.filter((row) => row.locationId === location.id && row.status !== 'archived')
      const sharedHostUserIds = resourceRows
        .filter((row) => {
          if (row.type !== 'host' || !row.hostUserId) return false
          const secondaryLocationIds = secondaryLocationIdsFromMetadata((row as unknown as { metadata?: unknown }).metadata)
          return row.locationId === location.id || secondaryLocationIds.includes(location.id)
        })
        .map((row) => row.hostUserId as string)
      const multiLocationHostCount = new Set(
        sharedHostUserIds.filter((hostUserId) => resourceRows.filter((row) => row.hostUserId === hostUserId).length > 1),
      ).size

      return {
        locationId: location.id,
        name: location.name,
        slug: location.slug,
        timezone: location.timezone,
        operatingHours: location.operatingHours,
        serviceArea: location.serviceArea,
        resources: {
          total: locationResources.length,
          hosts: locationResources.filter((row) => row.type === 'host').length,
          venues: locationResources.filter((row) => row.type === 'venue').length,
          assets: locationResources.filter((row) => row.type === 'asset').length,
          multiLocationHostCount,
        },
        bookings: {
          total: locationBookings.length,
          confirmed: locationBookings.filter((row) => row.status === 'confirmed').length,
          revenueMinor: locationBookings.reduce((sum, row) => sum + row.totalMinor, 0),
        },
        demandPricing: {
          activePolicyCount: locationPolicies.length,
          policyNames: locationPolicies.map((row) => row.name),
        },
        queues: {
          activeCount: locationQueues.length,
          queueNames: locationQueues.map((row) => row.name),
        },
      }
    })

    return ok(c, {
      bizId,
      locations: items,
      summary: {
        locationCount: items.length,
        bookingCount: bookingRows.length,
        resourceCount: resourceRows.length,
        demandPricingPolicyCount: pricingRows.filter((row) => row.isEnabled).length,
      },
    })
  },
)
