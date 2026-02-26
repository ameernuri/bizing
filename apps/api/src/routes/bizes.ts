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
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const { db, bizes, members } = dbPackage

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

  const [created] = await db
    .insert(bizes)
    .values({
      name: parsed.data.name,
      slug: parsed.data.slug,
      type: parsed.data.type,
      status: 'active',
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      logoUrl: parsed.data.logoUrl ?? null,
      metadata: parsed.data.metadata ?? {},
    })
    .returning()

  await db.insert(members).values({
    id: `member_${crypto.randomUUID().replace(/-/g, '')}`,
    organizationId: created.id,
    userId: user.id,
    role: 'owner',
    createdAt: new Date(),
  })

  return ok(c, created, 201)
})

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

    const [updated] = await db
      .update(bizes)
      .set({
        ...parsed.data,
      })
      .where(eq(bizes.id, bizId))
      .returning()

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

    await db
      .update(bizes)
      .set({
        status: 'archived',
      })
      .where(eq(bizes.id, bizId))

    return ok(c, { id: bizId })
  },
)
