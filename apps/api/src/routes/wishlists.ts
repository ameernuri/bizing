/**
 * Wishlist / save-for-later routes.
 *
 * ELI5:
 * A cart is "I want this right now".
 * A wishlist is "I want this later, remind me when it matters".
 *
 * These routes keep that intent first-class so the platform can support:
 * - save-for-later UX,
 * - cross-sell reminders,
 * - availability/price snapshots at save time,
 * - conversion attribution from wishlist into checkout later.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const { db, wishlists, wishlistItems } = dbPackage

const wishlistBodySchema = z.object({
  crmContactId: z.string().min(1),
  name: z.string().min(1).max(180),
  slug: z.string().min(1).max(140),
  status: z.string().max(40).optional(),
  visibilityMode: z.string().max(40).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const wishlistItemBodySchema = z.object({
  sellableId: z.string().min(1),
  variantKey: z.string().max(180).optional().nullable(),
  status: z.string().max(40).optional(),
  desiredQuantity: z.number().int().positive().optional(),
  priority: z.number().int().min(0).optional(),
  note: z.string().optional().nullable(),
  desiredUnitPriceMinor: z.number().int().min(0).optional().nullable(),
  currency: z.string().length(3).optional(),
  addedAt: z.string().datetime().optional().nullable(),
  lastTouchedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

function asDate(value?: string | null) {
  return value ? new Date(value) : null
}

export const wishlistRoutes = new Hono()

wishlistRoutes.get('/bizes/:bizId/wishlists', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const crmContactId = c.req.query('crmContactId')
  const rows = await db.query.wishlists.findMany({
    where: and(eq(wishlists.bizId, bizId), crmContactId ? eq(wishlists.crmContactId, crmContactId) : undefined),
    orderBy: [asc(wishlists.sortOrder), asc(wishlists.name)],
  })
  return ok(c, rows)
})

wishlistRoutes.post('/bizes/:bizId/wishlists', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = wishlistBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid wishlist body.', 400, parsed.error.flatten())
  const [row] = await db.insert(wishlists).values({
    bizId,
    crmContactId: parsed.data.crmContactId,
    name: sanitizePlainText(parsed.data.name),
    slug: sanitizePlainText(parsed.data.slug),
    status: (parsed.data.status ?? 'active') as 'active' | 'draft' | 'inactive' | 'suspended' | 'archived',
    visibilityMode: parsed.data.visibilityMode ?? 'private',
    isDefault: parsed.data.isDefault ?? false,
    sortOrder: parsed.data.sortOrder ?? 100,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  return ok(c, row, 201)
})

wishlistRoutes.get('/bizes/:bizId/wishlists/:wishlistId/items', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, wishlistId } = c.req.param()
  const rows = await db.query.wishlistItems.findMany({
    where: and(eq(wishlistItems.bizId, bizId), eq(wishlistItems.wishlistId, wishlistId)),
    orderBy: [asc(wishlistItems.priority), desc(wishlistItems.addedAt)],
  })
  return ok(c, rows)
})

wishlistRoutes.post('/bizes/:bizId/wishlists/:wishlistId/items', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, wishlistId } = c.req.param()
  const parsed = wishlistItemBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid wishlist item body.', 400, parsed.error.flatten())
  const [row] = await db.insert(wishlistItems).values({
    bizId,
    wishlistId,
    sellableId: parsed.data.sellableId,
    variantKey: parsed.data.variantKey ?? null,
    status: (parsed.data.status ?? 'active') as 'active' | 'draft' | 'inactive' | 'suspended' | 'archived',
    desiredQuantity: parsed.data.desiredQuantity ?? 1,
    priority: parsed.data.priority ?? 100,
    note: parsed.data.note ? sanitizePlainText(parsed.data.note) : null,
    desiredUnitPriceMinor: parsed.data.desiredUnitPriceMinor ?? null,
    currency: parsed.data.currency ?? 'USD',
    addedAt: asDate(parsed.data.addedAt) ?? new Date(),
    lastTouchedAt: asDate(parsed.data.lastTouchedAt) ?? new Date(),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  return ok(c, row, 201)
})
