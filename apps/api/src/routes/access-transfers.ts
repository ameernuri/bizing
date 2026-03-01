/**
 * Access transfer / resale routes.
 *
 * ELI5:
 * Some access rights can move from one person to another.
 * This route family stores the policy ("is transfer allowed?") and the actual
 * transfer workflow ("requested", "accepted", "completed", etc.).
 *
 * Why this route exists:
 * - ticket transfer and resale is a recurring product need,
 * - the schema already models transfer policy + transfer contracts,
 * - sagas need to prove ownership handoff and policy enforcement by API.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const {
  db,
  accessTransferPolicies,
  accessTransfers,
  accessResaleListings,
  accessArtifacts,
  accessArtifactEvents,
} = dbPackage

const transferPolicyBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).default('active'),
  appliesToArtifactType: z.enum(['access_grant', 'license_key', 'download_entitlement', 'ticket_entitlement', 'content_gate', 'replay_access', 'custom']).optional().nullable(),
  appliesToSellableId: z.string().optional().nullable(),
  allowTransfers: z.boolean().default(true),
  allowResale: z.boolean().default(false),
  approvalRequired: z.boolean().default(false),
  maxTransfersPerArtifact: z.number().int().positive().optional().nullable(),
  minHoldSeconds: z.number().int().min(0).optional().nullable(),
  transferCooldownSeconds: z.number().int().min(0).optional().nullable(),
  transferFeeMinor: z.number().int().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const transferBodySchema = z.object({
  sourceAccessArtifactId: z.string().min(1),
  targetAccessArtifactId: z.string().optional().nullable(),
  accessTransferPolicyId: z.string().optional().nullable(),
  mode: z.enum(['full_transfer', 'split_transfer', 'delegation']).default('full_transfer'),
  status: z.enum(['requested', 'approved', 'rejected', 'cancelled', 'expired', 'completed', 'reversed']).default('requested'),
  quantityRequested: z.number().int().positive().default(1),
  quantityTransferred: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  decidedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  reversedAt: z.string().datetime().optional().nullable(),
  targetHolderUserId: z.string().optional().nullable(),
  targetHolderGroupAccountId: z.string().optional().nullable(),
  targetHolderSubjectType: z.string().max(80).optional().nullable(),
  targetHolderSubjectId: z.string().max(140).optional().nullable(),
  reasonCode: z.string().max(80).optional().nullable(),
  reasonText: z.string().max(4000).optional().nullable(),
  fromHolderSnapshot: z.record(z.unknown()).optional(),
  toHolderSnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const resaleBodySchema = z.object({
  accessArtifactId: z.string().min(1),
  accessTransferPolicyId: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'reserved', 'sold', 'expired', 'cancelled', 'removed']).default('draft'),
  sellerUserId: z.string().optional().nullable(),
  sellerGroupAccountId: z.string().optional().nullable(),
  sellerSubjectType: z.string().max(80).optional().nullable(),
  sellerSubjectId: z.string().max(140).optional().nullable(),
  listedPriceMinor: z.number().int().min(0),
  minAcceptablePriceMinor: z.number().int().min(0).optional().nullable(),
  currency: z.string().length(3).default('USD'),
  listedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  reservedAt: z.string().datetime().optional().nullable(),
  soldAt: z.string().datetime().optional().nullable(),
  cancelledAt: z.string().datetime().optional().nullable(),
  buyerUserId: z.string().optional().nullable(),
  buyerGroupAccountId: z.string().optional().nullable(),
  buyerSubjectType: z.string().max(80).optional().nullable(),
  buyerSubjectId: z.string().max(140).optional().nullable(),
  completedTransferId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

export const accessTransferRoutes = new Hono()

accessTransferRoutes.get('/bizes/:bizId/access-transfer-policies', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.accessTransferPolicies.findMany({
    where: eq(accessTransferPolicies.bizId, bizId),
    orderBy: [asc(accessTransferPolicies.name)],
  })
  return ok(c, rows)
})

accessTransferRoutes.post('/bizes/:bizId/access-transfer-policies', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = transferPolicyBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(accessTransferPolicies).values({
    bizId,
    ...parsed.data,
    policySnapshot: parsed.data.policySnapshot ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

accessTransferRoutes.get('/bizes/:bizId/access-transfers', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const sourceAccessArtifactId = c.req.query('sourceAccessArtifactId')
  const rows = await db.query.accessTransfers.findMany({
    where: and(eq(accessTransfers.bizId, bizId), sourceAccessArtifactId ? eq(accessTransfers.sourceAccessArtifactId, sourceAccessArtifactId) : undefined),
    orderBy: [desc(accessTransfers.requestedAt)],
  })
  return ok(c, rows)
})

accessTransferRoutes.post('/bizes/:bizId/access-transfers', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = transferBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const policy = parsed.data.accessTransferPolicyId
    ? await db.query.accessTransferPolicies.findFirst({
        where: and(eq(accessTransferPolicies.bizId, bizId), eq(accessTransferPolicies.id, parsed.data.accessTransferPolicyId)),
      })
    : null
  if (parsed.data.accessTransferPolicyId && !policy) return fail(c, 'NOT_FOUND', 'Access transfer policy not found.', 404)
  if (policy && !policy.allowTransfers) {
    return fail(c, 'TRANSFER_DISABLED', 'This policy does not allow transfers.', 409)
  }
  const [row] = await db.insert(accessTransfers).values({
    bizId,
    sourceAccessArtifactId: parsed.data.sourceAccessArtifactId,
    targetAccessArtifactId: parsed.data.targetAccessArtifactId ?? null,
    accessTransferPolicyId: parsed.data.accessTransferPolicyId ?? null,
    mode: parsed.data.mode,
    status: parsed.data.status,
    quantityRequested: parsed.data.quantityRequested,
    quantityTransferred: parsed.data.quantityTransferred ?? null,
    requestedByUserId: user.id,
    requestedAt: new Date(),
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    decidedAt: parsed.data.decidedAt ? new Date(parsed.data.decidedAt) : null,
    completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
    reversedAt: parsed.data.reversedAt ? new Date(parsed.data.reversedAt) : null,
    targetHolderUserId: parsed.data.targetHolderUserId ?? null,
    targetHolderGroupAccountId: parsed.data.targetHolderGroupAccountId ?? null,
    targetHolderSubjectType: parsed.data.targetHolderSubjectType ?? null,
    targetHolderSubjectId: parsed.data.targetHolderSubjectId ?? null,
    reasonCode: parsed.data.reasonCode ?? null,
    reasonText: parsed.data.reasonText ?? null,
    fromHolderSnapshot: parsed.data.fromHolderSnapshot ?? {},
    toHolderSnapshot: parsed.data.toHolderSnapshot ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  await db.insert(accessArtifactEvents).values({
    bizId,
    accessArtifactId: row.sourceAccessArtifactId,
    eventType: 'metadata_updated',
    actorUserId: user.id,
    outcome: 'allowed',
    reasonCode: 'transfer_requested',
    reasonText: parsed.data.reasonText ?? 'Transfer requested.',
    payload: {
      accessTransferId: row.id,
      targetHolderUserId: row.targetHolderUserId,
      targetHolderSubjectType: row.targetHolderSubjectType,
      targetHolderSubjectId: row.targetHolderSubjectId,
    },
    metadata: {
      sourceRoute: 'access-transfers.create',
      transferStatus: row.status,
    },
  })
  return ok(c, row, 201)
})

accessTransferRoutes.patch('/bizes/:bizId/access-transfers/:transferId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, transferId } = c.req.param()
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = transferBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.accessTransfers.findFirst({
    where: and(eq(accessTransfers.bizId, bizId), eq(accessTransfers.id, transferId)),
  })
  if (!existing) return fail(c, 'NOT_FOUND', 'Access transfer not found.', 404)
  const policyId = parsed.data.accessTransferPolicyId ?? existing.accessTransferPolicyId
  const policy = policyId
    ? await db.query.accessTransferPolicies.findFirst({
        where: and(eq(accessTransferPolicies.bizId, bizId), eq(accessTransferPolicies.id, policyId)),
      })
    : null
  if (policyId && !policy) return fail(c, 'NOT_FOUND', 'Access transfer policy not found.', 404)
  if (policy && !policy.allowTransfers) {
    return fail(c, 'TRANSFER_DISABLED', 'This policy does not allow transfers.', 409)
  }
  if (policy && parsed.data.status === 'completed' && policy.maxTransfersPerArtifact) {
    const priorCompleted = await db.query.accessTransfers.findMany({
      where: and(
        eq(accessTransfers.bizId, bizId),
        eq(accessTransfers.sourceAccessArtifactId, existing.sourceAccessArtifactId),
        eq(accessTransfers.status, 'completed'),
      ),
    })
    if (priorCompleted.length >= policy.maxTransfersPerArtifact) {
      return fail(c, 'TRANSFER_LIMIT_REACHED', 'Transfer limit has already been reached for this artifact.', 409)
    }
  }

  const [row] = await db.update(accessTransfers).set({
    sourceAccessArtifactId: parsed.data.sourceAccessArtifactId ?? undefined,
    targetAccessArtifactId: parsed.data.targetAccessArtifactId ?? undefined,
    accessTransferPolicyId: parsed.data.accessTransferPolicyId ?? undefined,
    mode: parsed.data.mode ?? undefined,
    status: parsed.data.status ?? undefined,
    quantityRequested: parsed.data.quantityRequested ?? undefined,
    quantityTransferred: parsed.data.quantityTransferred ?? undefined,
    targetHolderUserId: parsed.data.targetHolderUserId ?? undefined,
    targetHolderGroupAccountId: parsed.data.targetHolderGroupAccountId ?? undefined,
    targetHolderSubjectType: parsed.data.targetHolderSubjectType ?? undefined,
    targetHolderSubjectId: parsed.data.targetHolderSubjectId ?? undefined,
    reasonCode: parsed.data.reasonCode ?? undefined,
    reasonText: parsed.data.reasonText ?? undefined,
    fromHolderSnapshot: parsed.data.fromHolderSnapshot ?? undefined,
    toHolderSnapshot: parsed.data.toHolderSnapshot ?? undefined,
    metadata: parsed.data.metadata ?? undefined,
    approvedByUserId:
      parsed.data.status && ['approved', 'rejected', 'cancelled', 'expired', 'completed', 'reversed'].includes(parsed.data.status)
        ? user.id
        : undefined,
    decidedAt: parsed.data.decidedAt ? new Date(parsed.data.decidedAt) : undefined,
    completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : undefined,
    reversedAt: parsed.data.reversedAt ? new Date(parsed.data.reversedAt) : undefined,
  }).where(and(eq(accessTransfers.bizId, bizId), eq(accessTransfers.id, transferId))).returning()
  if (!row) return fail(c, 'NOT_FOUND', 'Access transfer not found.', 404)

  if (parsed.data.status === 'completed') {
    await db.update(accessArtifacts).set({
      holderUserId: row.targetHolderUserId ?? undefined,
      holderGroupAccountId: row.targetHolderGroupAccountId ?? undefined,
      holderSubjectType: row.targetHolderSubjectType ?? undefined,
      holderSubjectId: row.targetHolderSubjectId ?? undefined,
      status: 'transferred',
      metadata: {
        accessTransferId: row.id,
        lastTransferCompletedAt: row.completedAt?.toISOString?.() ?? new Date().toISOString(),
      },
    }).where(and(eq(accessArtifacts.bizId, bizId), eq(accessArtifacts.id, row.sourceAccessArtifactId)))

    await db.insert(accessArtifactEvents).values({
      bizId,
      accessArtifactId: row.sourceAccessArtifactId,
      eventType: 'transferred_out',
      actorUserId: user.id,
      outcome: 'allowed',
      reasonCode: row.reasonCode ?? 'transfer_completed',
      reasonText: row.reasonText ?? 'Transfer completed.',
      payload: {
        accessTransferId: row.id,
        targetHolderUserId: row.targetHolderUserId,
        targetHolderSubjectType: row.targetHolderSubjectType,
        targetHolderSubjectId: row.targetHolderSubjectId,
      },
      metadata: {
        sourceRoute: 'access-transfers.patch',
        transferStatus: row.status,
      },
    })
  }

  if (parsed.data.status === 'reversed') {
    await db.insert(accessArtifactEvents).values({
      bizId,
      accessArtifactId: row.sourceAccessArtifactId,
      eventType: 'transferred_in',
      actorUserId: user.id,
      outcome: 'allowed',
      reasonCode: row.reasonCode ?? 'transfer_reversed',
      reasonText: row.reasonText ?? 'Transfer reversed.',
      payload: {
        accessTransferId: row.id,
      },
      metadata: {
        sourceRoute: 'access-transfers.patch',
        transferStatus: row.status,
      },
    })
  }
  return ok(c, row)
})

accessTransferRoutes.get('/bizes/:bizId/access-resale-listings', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.accessResaleListings.findMany({
    where: eq(accessResaleListings.bizId, bizId),
    orderBy: [desc(accessResaleListings.listedAt)],
  })
  return ok(c, rows)
})

accessTransferRoutes.post('/bizes/:bizId/access-resale-listings', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = resaleBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const policy = parsed.data.accessTransferPolicyId
    ? await db.query.accessTransferPolicies.findFirst({
        where: and(eq(accessTransferPolicies.bizId, bizId), eq(accessTransferPolicies.id, parsed.data.accessTransferPolicyId)),
      })
    : null
  if (parsed.data.accessTransferPolicyId && !policy) return fail(c, 'NOT_FOUND', 'Access transfer policy not found.', 404)
  if (policy && !policy.allowResale) {
    return fail(c, 'RESALE_DISABLED', 'This policy does not allow resale listings.', 409)
  }
  const [row] = await db.insert(accessResaleListings).values({
    bizId,
    accessArtifactId: parsed.data.accessArtifactId,
    accessTransferPolicyId: parsed.data.accessTransferPolicyId ?? null,
    status: parsed.data.status,
    sellerUserId: parsed.data.sellerUserId ?? user.id,
    sellerGroupAccountId: parsed.data.sellerGroupAccountId ?? null,
    sellerSubjectType: parsed.data.sellerSubjectType ?? null,
    sellerSubjectId: parsed.data.sellerSubjectId ?? null,
    listedPriceMinor: parsed.data.listedPriceMinor,
    minAcceptablePriceMinor: parsed.data.minAcceptablePriceMinor ?? null,
    listedAt: parsed.data.listedAt ? new Date(parsed.data.listedAt) : new Date(),
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    reservedAt: parsed.data.reservedAt ? new Date(parsed.data.reservedAt) : null,
    soldAt: parsed.data.soldAt ? new Date(parsed.data.soldAt) : null,
    cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
    buyerUserId: parsed.data.buyerUserId ?? null,
    buyerGroupAccountId: parsed.data.buyerGroupAccountId ?? null,
    buyerSubjectType: parsed.data.buyerSubjectType ?? null,
    buyerSubjectId: parsed.data.buyerSubjectId ?? null,
    completedTransferId: parsed.data.completedTransferId ?? null,
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

accessTransferRoutes.patch('/bizes/:bizId/access-resale-listings/:listingId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, listingId } = c.req.param()
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = resaleBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.accessResaleListings.findFirst({
    where: and(eq(accessResaleListings.bizId, bizId), eq(accessResaleListings.id, listingId)),
  })
  if (!existing) return fail(c, 'NOT_FOUND', 'Access resale listing not found.', 404)
  const [row] = await db.update(accessResaleListings).set({
    accessTransferPolicyId: parsed.data.accessTransferPolicyId ?? undefined,
    status: parsed.data.status ?? undefined,
    listedPriceMinor: parsed.data.listedPriceMinor ?? undefined,
    minAcceptablePriceMinor: parsed.data.minAcceptablePriceMinor ?? undefined,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    reservedAt: parsed.data.reservedAt ? new Date(parsed.data.reservedAt) : undefined,
    soldAt: parsed.data.soldAt ? new Date(parsed.data.soldAt) : undefined,
    cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : undefined,
    buyerUserId: parsed.data.buyerUserId ?? undefined,
    buyerGroupAccountId: parsed.data.buyerGroupAccountId ?? undefined,
    buyerSubjectType: parsed.data.buyerSubjectType ?? undefined,
    buyerSubjectId: parsed.data.buyerSubjectId ?? undefined,
    completedTransferId: parsed.data.completedTransferId ?? undefined,
    metadata: parsed.data.metadata ?? undefined,
  }).where(and(eq(accessResaleListings.bizId, bizId), eq(accessResaleListings.id, listingId))).returning()
  if (!row) return fail(c, 'NOT_FOUND', 'Access resale listing not found.', 404)
  await db.insert(accessArtifactEvents).values({
    bizId,
    accessArtifactId: row.accessArtifactId,
    eventType: parsed.data.status === 'sold' ? 'transferred_out' : 'metadata_updated',
    actorUserId: user.id,
    outcome: 'allowed',
    reasonCode: parsed.data.status === 'sold' ? 'resale_completed' : 'resale_updated',
    reasonText: parsed.data.status === 'sold' ? 'Resale completed.' : 'Resale listing updated.',
    payload: {
      accessResaleListingId: row.id,
      completedTransferId: row.completedTransferId,
      buyerUserId: row.buyerUserId,
      buyerSubjectType: row.buyerSubjectType,
      buyerSubjectId: row.buyerSubjectId,
    },
    metadata: {
      sourceRoute: 'access-resale-listings.patch',
      listingStatus: row.status,
    },
  })
  return ok(c, row)
})
