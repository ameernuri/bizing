/**
 * Resource routes (biz-scoped).
 *
 * Resources are supply-side bookables (host/company_host/asset/venue).
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
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, resources } = dbPackage

const listQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  type: z.enum(['host', 'company_host', 'asset', 'venue']).optional(),
  locationId: z.string().optional(),
  statusDefinitionId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const createBodySchema = z.object({
  locationId: z.string().min(1),
  type: z.enum(['host', 'company_host', 'asset', 'venue']),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  timezone: z.string().min(1).max(50).default('UTC'),
  statusDefinitionId: z.string().optional(),
  hostUserId: z.string().optional(),
  groupAccountId: z.string().optional(),
  assetId: z.string().optional(),
  venueId: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  allowSimultaneousBookings: z.boolean().default(false),
  maxSimultaneousBookings: z.number().int().positive().optional(),
  bufferBeforeMinutes: z.number().int().min(0).default(0),
  bufferAfterMinutes: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).optional(),
})

const updateBodySchema = createBodySchema.partial().omit({ type: true })

export const resourceRoutes = new Hono()

resourceRoutes.get(
  '/bizes/:bizId/resources',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')

  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  }

  const {
    page,
    perPage,
    type,
    locationId,
    statusDefinitionId,
    search,
    sortBy = 'name',
    sortOrder = 'desc',
  } = parsed.data

  const pageNum = parsePositiveInt(page, 1)
  const perPageNum = Math.min(parsePositiveInt(perPage, 20), 100)

  const where = and(
    eq(resources.bizId, bizId),
    type ? eq(resources.type, type) : undefined,
    locationId ? eq(resources.locationId, locationId) : undefined,
    statusDefinitionId ? eq(resources.statusDefinitionId, statusDefinitionId) : undefined,
    search ? ilike(resources.name, `%${search}%`) : undefined,
  )

  const sortColumn = sortBy === 'name' ? resources.name : resources.name
  const orderByExpr = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

  const [rows, countRows] = await Promise.all([
    db.query.resources.findMany({
      where,
      orderBy: orderByExpr,
      limit: perPageNum,
      offset: (pageNum - 1) * perPageNum,
    }),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(resources).where(where),
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

resourceRoutes.post(
  '/bizes/:bizId/resources',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.create', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const _user = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = createBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [created] = await db
      .insert(resources)
      .values({
        bizId,
        locationId: parsed.data.locationId,
        type: parsed.data.type,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        timezone: parsed.data.timezone,
        statusDefinitionId: parsed.data.statusDefinitionId,
        hostUserId: parsed.data.hostUserId,
        groupAccountId: parsed.data.groupAccountId,
        assetId: parsed.data.assetId,
        venueId: parsed.data.venueId,
        capacity: parsed.data.capacity,
        allowSimultaneousBookings: parsed.data.allowSimultaneousBookings,
        maxSimultaneousBookings: parsed.data.maxSimultaneousBookings,
        bufferBeforeMinutes: parsed.data.bufferBeforeMinutes,
        bufferAfterMinutes: parsed.data.bufferAfterMinutes,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)

resourceRoutes.get(
  '/bizes/:bizId/resources/:resourceId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId', resourceIdParam: 'resourceId' }),
  async (c) => {
    const { bizId, resourceId } = c.req.param()
    const row = await db.query.resources.findFirst({
      where: and(eq(resources.bizId, bizId), eq(resources.id, resourceId)),
    })

    if (!row) return fail(c, 'NOT_FOUND', 'Resource not found.', 404)
    return ok(c, row)
  },
)

resourceRoutes.patch(
  '/bizes/:bizId/resources/:resourceId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId', resourceIdParam: 'resourceId' }),
  async (c) => {
    const { bizId, resourceId } = c.req.param()
    const _user = getCurrentUser(c)

    const body = await c.req.json().catch(() => null)
    const parsed = updateBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.resources.findFirst({
      where: and(eq(resources.bizId, bizId), eq(resources.id, resourceId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Resource not found.', 404)

    const [updated] = await db
      .update(resources)
      .set({
        ...parsed.data,
      })
      .where(and(eq(resources.bizId, bizId), eq(resources.id, resourceId)))
      .returning()

    return ok(c, updated)
  },
)

resourceRoutes.delete(
  '/bizes/:bizId/resources/:resourceId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.archive', { bizIdParam: 'bizId', resourceIdParam: 'resourceId' }),
  async (c) => {
    const { bizId, resourceId } = c.req.param()
    const _user = getCurrentUser(c)

    const existing = await db.query.resources.findFirst({
      where: and(eq(resources.bizId, bizId), eq(resources.id, resourceId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Resource not found.', 404)

    await db.delete(resources).where(and(eq(resources.bizId, bizId), eq(resources.id, resourceId)))

    return ok(c, { id: resourceId })
  },
)
