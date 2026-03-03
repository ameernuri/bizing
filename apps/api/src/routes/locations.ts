/**
 * Location routes (biz-scoped).
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, locations } = dbPackage

async function createLocationRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  data: Record<string, unknown>,
  source: string,
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey: 'locations',
    operation: 'create',
    data,
    subjectType: 'location',
    subjectId: String((data.slug as string | undefined) ?? ''),
    displayName: String((data.name as string | undefined) ?? 'location'),
    metadata: { source },
  })
  if (!result.ok) throw new Error(result.message ?? 'Failed to create location')
  if (!result.row) throw new Error('Missing row for location create')
  return result.row
}

async function updateLocationRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  locationId: string,
  patch: Parameters<typeof executeCrudRouteAction>[0]['patch'],
  source: string,
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey: 'locations',
    operation: 'update',
    id: locationId,
    patch,
    subjectType: 'location',
    subjectId: locationId,
    displayName: 'update location',
    metadata: { source },
  })
  if (!result.ok) throw new Error(result.message ?? 'Failed to update location')
  if (!result.row) throw new Error('Missing row for location update')
  return result.row
}

const listQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  type: z.enum(['physical', 'virtual', 'mobile', 'hybrid']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const createBodySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  type: z.enum(['physical', 'virtual', 'mobile', 'hybrid']).default('physical'),
  timezone: z.string().min(1).max(50).default('UTC'),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  address: z.record(z.unknown()).optional(),
  operatingHours: z.record(z.unknown()).optional(),
  configOverride: z.record(z.unknown()).optional(),
  serviceArea: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateBodySchema = createBodySchema.partial()

export const locationRoutes = new Hono()

locationRoutes.get('/public/bizes/:bizId/locations', async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.locations.findMany({
    where: and(eq(locations.bizId, bizId), eq(locations.status, 'active')),
    orderBy: asc(locations.name),
  })
  return ok(c, rows)
})

locationRoutes.get(
  '/bizes/:bizId/locations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('locations.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')

  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const { page, perPage, status, type, search, sortBy = 'createdAt', sortOrder = 'desc' } = parsed.data
  const pageNum = parsePositiveInt(page, 1)
  const perPageNum = Math.min(parsePositiveInt(perPage, 20), 100)

  const where = and(
    eq(locations.bizId, bizId),
    status ? eq(locations.status, status) : undefined,
    type ? eq(locations.type, type) : undefined,
    search ? ilike(locations.name, `%${search}%`) : undefined,
  )

  const sortColumn =
    sortBy === 'name' ? locations.name : sortBy === 'updatedAt' ? locations.updatedAt : locations.createdAt
  const orderByExpr = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

  const [rows, countRows] = await Promise.all([
    db.query.locations.findMany({
      where,
      orderBy: orderByExpr,
      limit: perPageNum,
      offset: (pageNum - 1) * perPageNum,
    }),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(locations).where(where),
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
  },
)

locationRoutes.post(
  '/bizes/:bizId/locations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('locations.create', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const _user = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = createBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const created = await createLocationRow(
      c,
      bizId,
      {
        bizId,
        name: sanitizePlainText(parsed.data.name),
        slug: parsed.data.slug,
        type: parsed.data.type,
        timezone: parsed.data.timezone,
        status: parsed.data.status,
        address: sanitizeUnknown(parsed.data.address ?? {}),
        operatingHours: sanitizeUnknown(parsed.data.operatingHours ?? {}),
        configOverride: sanitizeUnknown(parsed.data.configOverride ?? {}),
        serviceArea: sanitizeUnknown(parsed.data.serviceArea ?? {}),
        isDefault: parsed.data.isDefault ?? false,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
      'routes.locations.create',
    )

    return ok(c, created, 201)
  },
)

locationRoutes.get(
  '/bizes/:bizId/locations/:locationId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('locations.read', { bizIdParam: 'bizId', locationIdParam: 'locationId' }),
  async (c) => {
    const { bizId, locationId } = c.req.param()
    const row = await db.query.locations.findFirst({
      where: and(eq(locations.bizId, bizId), eq(locations.id, locationId)),
    })

    if (!row) return fail(c, 'NOT_FOUND', 'Location not found.', 404)
    return ok(c, row)
  },
)

locationRoutes.patch(
  '/bizes/:bizId/locations/:locationId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('locations.update', { bizIdParam: 'bizId', locationIdParam: 'locationId' }),
  async (c) => {
    const { bizId, locationId } = c.req.param()
    const _user = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = updateBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.locations.findFirst({
      where: and(eq(locations.bizId, bizId), eq(locations.id, locationId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Location not found.', 404)

    const updated = await updateLocationRow(
      c,
      bizId,
      locationId,
      {
        ...parsed.data,
        name: parsed.data.name ? sanitizePlainText(parsed.data.name) : undefined,
        address: parsed.data.address ? sanitizeUnknown(parsed.data.address) : undefined,
        operatingHours: parsed.data.operatingHours ? sanitizeUnknown(parsed.data.operatingHours) : undefined,
        configOverride: parsed.data.configOverride ? sanitizeUnknown(parsed.data.configOverride) : undefined,
        serviceArea: parsed.data.serviceArea ? sanitizeUnknown(parsed.data.serviceArea) : undefined,
        metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
        updatedAt: new Date(),
      },
      'routes.locations.patch',
    )

    return ok(c, updated)
  },
)

locationRoutes.delete(
  '/bizes/:bizId/locations/:locationId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('locations.archive', { bizIdParam: 'bizId', locationIdParam: 'locationId' }),
  async (c) => {
    const { bizId, locationId } = c.req.param()
    const _user = getCurrentUser(c)

    const existing = await db.query.locations.findFirst({
      where: and(eq(locations.bizId, bizId), eq(locations.id, locationId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Location not found.', 404)

    const delegated = await executeCrudRouteAction({
      c,
      bizId,
      tableKey: 'locations',
      operation: 'update',
      id: locationId,
      subjectType: 'location',
      subjectId: locationId,
      patch: {
        status: 'archived',
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
      metadata: { source: 'routes.locations.archive' },
    })
    if (!delegated.ok) {
      return fail(c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
    }

    return ok(c, { id: locationId })
  },
)
