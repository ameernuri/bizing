/**
 * Membership + entitlement routes.
 *
 * ELI5:
 * This module exposes the "membership and credits wallet" part of the schema.
 *
 * Why this is first-class instead of hiding everything inside generic metadata:
 * - subscriptions/memberships need stable ids, lifecycle, and reporting,
 * - credits/sessions/passes need immutable ledger history,
 * - saga validation should prove real API support, not hand-wave with JSON blobs.
 *
 * What this route family covers:
 * - membership plan templates,
 * - active customer memberships,
 * - entitlement wallets (credits, sessions, minutes, etc.),
 * - grants into wallets,
 * - consumption from wallets,
 * - rollover/expiry processing snapshots.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const { db } = dbPackage

function getDbSchema() {
  return ((db as typeof db & { _: { fullSchema?: Record<string, unknown> } })._?.fullSchema ?? {}) as Record<
    string,
    unknown
  >
}
/**
 * Use an explicit local name for the runtime table object.
 *
 * ELI5:
 * The schema table is named `memberships`, but this codebase also has auth/org
 * membership concepts. Using one unambiguous local alias here avoids mixing the
 * entitlement membership table with any other "membership" idea at runtime.
 */
function requireTable<T>(value: T | undefined, label: string): T {
  if (!value) {
    throw new Error(`ENTITLEMENTS_TABLE_MISSING:${label}`)
  }
  return value
}

/**
 * Resolve schema tables lazily.
 *
 * ELI5:
 * In this workspace, the DB package can finish initializing after this route
 * module is evaluated. If we destructure too early, we freeze `undefined`.
 * The proxy below asks for the real table each time Drizzle touches it.
 */
function lazyTable<T extends object>(resolve: () => T | undefined, label: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const table = requireTable(resolve(), label) as object
      return Reflect.get(table, prop)
    },
    has(_target, prop) {
      return prop in (requireTable(resolve(), label) as object)
    },
    ownKeys() {
      return Reflect.ownKeys(requireTable(resolve(), label) as object)
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Object.getOwnPropertyDescriptor(requireTable(resolve(), label) as object, prop)
    },
  })
}

const membershipPlans = lazyTable(
  () => (getDbSchema().membershipPlans as typeof dbPackage.membershipPlans | undefined) ?? dbPackage.membershipPlans,
  'membershipPlans',
)
const membershipTable = lazyTable(
  () =>
    (getDbSchema().memberships as typeof dbPackage.entitlementMemberships | undefined) ??
    dbPackage.entitlementMemberships,
  'entitlementMemberships',
)
const entitlementWallets = lazyTable(
  () =>
    (getDbSchema().entitlementWallets as typeof dbPackage.entitlementWallets | undefined) ??
    dbPackage.entitlementWallets,
  'entitlementWallets',
)
const entitlementGrants = lazyTable(
  () =>
    (getDbSchema().entitlementGrants as typeof dbPackage.entitlementGrants | undefined) ??
    dbPackage.entitlementGrants,
  'entitlementGrants',
)
const entitlementLedgerEntries = lazyTable(
  () =>
    (getDbSchema().entitlementLedgerEntries as typeof dbPackage.entitlementLedgerEntries | undefined) ??
    dbPackage.entitlementLedgerEntries,
  'entitlementLedgerEntries',
)
const rolloverRuns = lazyTable(
  () => (getDbSchema().rolloverRuns as typeof dbPackage.rolloverRuns | undefined) ?? dbPackage.rolloverRuns,
  'rolloverRuns',
)

function entitlementTransfersTable() {
  return requireTable(getDbSchema().entitlementTransfers as any, 'entitlementTransfers') as any
}

const paginationQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const membershipPlanStatusSchema = z.enum(['draft', 'active', 'inactive', 'archived'])
const membershipStatusSchema = z.enum(['trialing', 'active', 'paused', 'past_due', 'cancelled', 'expired'])
const entitlementTypeSchema = z.enum(['pass', 'credit', 'time_allowance', 'seat_pack', 'custom'])
const listPlansQuerySchema = paginationQuerySchema.extend({
  status: membershipPlanStatusSchema.optional(),
})

const createMembershipPlanBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().max(4000).optional(),
  status: membershipPlanStatusSchema.default('draft'),
  billingIntervalCount: z.number().int().positive().default(1),
  billingIntervalUnit: z.enum(['day', 'week', 'month', 'year', 'custom']).default('month'),
  priceMinor: z.number().int().min(0).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  entitlementType: entitlementTypeSchema.default('custom'),
  entitlementQuantityPerCycle: z.number().int().min(0).default(0),
  allowRollover: z.boolean().default(false),
  rolloverCapQuantity: z.number().int().min(0).optional(),
  allowTransfers: z.boolean().default(false),
  transferFeeMinor: z.number().int().min(0).default(0),
  entitlementPolicy: z.record(z.unknown()).optional(),
  membershipPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateMembershipPlanBodySchema = createMembershipPlanBodySchema.partial()

const listMembershipsQuerySchema = paginationQuerySchema.extend({
  status: membershipStatusSchema.optional(),
  ownerUserId: z.string().optional(),
  membershipPlanId: z.string().optional(),
})

const ownerShapeFields = {
  ownerUserId: z.string().optional(),
  ownerGroupAccountId: z.string().optional(),
}

const createMembershipBodySchema = z.object({
  ...ownerShapeFields,
  membershipPlanId: z.string().min(1),
  status: membershipStatusSchema.default('trialing'),
  startsAt: z.string().datetime(),
  currentPeriodStartAt: z.string().datetime(),
  currentPeriodEndAt: z.string().datetime(),
  pausedAt: z.string().datetime().optional().nullable(),
  cancelledAt: z.string().datetime().optional().nullable(),
  endedAt: z.string().datetime().optional().nullable(),
  autoRenew: z.boolean().default(true),
  providerSubscriptionRef: z.string().max(200).optional(),
  statusReason: z.string().max(400).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  const count = Number(Boolean(value.ownerUserId)) + Number(Boolean(value.ownerGroupAccountId))
  if (count !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exactly one owner pointer is required.',
      path: ['ownerUserId'],
    })
  }
})

const updateMembershipBodySchemaPlain = z.object({
  ...ownerShapeFields,
  membershipPlanId: z.string().min(1).optional(),
  status: membershipStatusSchema.optional(),
  startsAt: z.string().datetime().optional(),
  currentPeriodStartAt: z.string().datetime().optional(),
  currentPeriodEndAt: z.string().datetime().optional(),
  pausedAt: z.string().datetime().optional().nullable(),
  cancelledAt: z.string().datetime().optional().nullable(),
  endedAt: z.string().datetime().optional().nullable(),
  autoRenew: z.boolean().optional(),
  providerSubscriptionRef: z.string().max(200).optional(),
  statusReason: z.string().max(400).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  const ownerFieldsPresent =
    value.ownerUserId !== undefined || value.ownerGroupAccountId !== undefined
  if (!ownerFieldsPresent) return
  const count = Number(Boolean(value.ownerUserId)) + Number(Boolean(value.ownerGroupAccountId))
  if (count !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exactly one owner pointer is required when updating owner fields.',
      path: ['ownerUserId'],
    })
  }
})

const updateMembershipBodySchema = updateMembershipBodySchemaPlain

const listWalletsQuerySchema = paginationQuerySchema.extend({
  ownerUserId: z.string().optional(),
  membershipId: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
})

const createWalletBodySchema = z.object({
  ...ownerShapeFields,
  membershipId: z.string().optional(),
  name: z.string().min(1).max(180),
  entitlementType: entitlementTypeSchema,
  unitCode: z.string().min(1).max(60).default('credits'),
  balanceQuantity: z.number().int().min(0).default(0),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  const count = Number(Boolean(value.ownerUserId)) + Number(Boolean(value.ownerGroupAccountId))
  if (count !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exactly one owner pointer is required.',
      path: ['ownerUserId'],
    })
  }
})

const createGrantBodySchema = z.object({
  walletId: z.string().min(1),
  membershipId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  grantType: entitlementTypeSchema,
  quantity: z.number().int().positive(),
  validFromAt: z.string().datetime(),
  validUntilAt: z.string().datetime().optional(),
  rolloverEligible: z.boolean().default(false),
  transferable: z.boolean().default(false),
  reason: z.string().max(400).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const createTransferBodySchema = z.object({
  fromWalletId: z.string().min(1),
  toWalletId: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const consumeWalletBodySchema = z.object({
  quantity: z.number().int().positive(),
  bookingOrderId: z.string().optional(),
  fulfillmentUnitId: z.string().optional(),
  reasonCode: z.string().max(120).default('manual_consume'),
  metadata: z.record(z.unknown()).optional(),
})

const createRolloverRunBodySchema = z.object({
  membershipPlanId: z.string().optional(),
  membershipId: z.string().optional(),
  walletId: z.string().optional(),
  sourcePeriodStartAt: z.string().datetime(),
  sourcePeriodEndAt: z.string().datetime(),
  rolledOverQuantity: z.number().int().min(0).default(0),
  expiredQuantity: z.number().int().min(0).default(0),
  summary: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Gift-wallet routes reuse the entitlement wallet backbone.
 *
 * ELI5:
 * A gift is stored value plus sharing rules: code, purchaser, recipient,
 * expiration, transfer, revoke, and redemption state.
 */
const createGiftWalletBodySchema = z.object({
  purchaserUserId: z.string(),
  recipientUserId: z.string().optional(),
  name: z.string().min(1).max(180),
  unitCode: z.string().min(1).max(60).default('credits'),
  quantity: z.number().int().positive(),
  expiresAt: z.string().datetime().optional(),
  transferable: z.boolean().default(true),
  revocableUntilRedeemed: z.boolean().default(true),
  extendable: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const redeemGiftWalletBodySchema = z.object({
  giftCode: z.string().min(6).max(80),
  recipientUserId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const transferGiftWalletBodySchema = z.object({
  targetRecipientUserId: z.string().optional(),
  targetRecipientEmail: z.string().email().optional(),
  reason: z.string().max(400).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (!value.targetRecipientUserId && !value.targetRecipientEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A target recipient identity is required.',
    })
  }
})

const revokeGiftWalletBodySchema = z.object({
  reason: z.string().max(400).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const extendGiftWalletBodySchema = z.object({
  expiresAt: z.string().datetime(),
  reason: z.string().max(400).optional(),
  metadata: z.record(z.unknown()).optional(),
})

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

function cleanMetadata(value: Record<string, unknown> | undefined) {
  return sanitizeUnknown(value ?? {}) as Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function getGiftInstrumentMetadata(
  wallet: { metadata: unknown },
): Record<string, unknown> {
  return asRecord(asRecord(wallet.metadata).giftInstrument)
}

async function createEntitlementRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null | undefined,
  tableKey: string,
  data: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId: bizId ?? null,
    tableKey,
    operation: 'create',
    data,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) {
    return fail(c, result.code, result.message, result.httpStatus, result.details)
  }
  return result.row
}

async function updateEntitlementRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null | undefined,
  tableKey: string,
  id: string,
  patch: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId: bizId ?? null,
    tableKey,
    operation: 'update',
    id,
    patch,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) {
    return fail(c, result.code, result.message, result.httpStatus, result.details)
  }
  return result.row
}

export const entitlementRoutes = new Hono()

entitlementRoutes.get(
  '/bizes/:bizId/membership-plans',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const membershipPlansTable = requireTable(
      (getDbSchema().membershipPlans as typeof dbPackage.membershipPlans | undefined) ??
        dbPackage.membershipPlans,
      'membershipPlans',
    )
    const parsed = listPlansQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(membershipPlansTable.bizId, bizId),
      parsed.data.status ? eq(membershipPlansTable.status, parsed.data.status) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.membershipPlans.findMany({
        where,
        orderBy: [asc(membershipPlansTable.name)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(membershipPlansTable).where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total,
        hasMore: pageInfo.page * pageInfo.perPage < total,
      },
    })
  },
)

entitlementRoutes.post(
  '/bizes/:bizId/membership-plans',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const membershipPlansTable = requireTable(
      (getDbSchema().membershipPlans as typeof dbPackage.membershipPlans | undefined) ??
        dbPackage.membershipPlans,
      'membershipPlans',
    )
    const body = await c.req.json().catch(() => null)
    const parsed = createMembershipPlanBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const created = (await createEntitlementRow(
      c,
      bizId,
      'membershipPlans',
      {
        bizId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
        billingIntervalCount: parsed.data.billingIntervalCount,
        billingIntervalUnit: parsed.data.billingIntervalUnit,
        priceMinor: parsed.data.priceMinor,
        currency: parsed.data.currency,
        entitlementType: parsed.data.entitlementType,
        entitlementQuantityPerCycle: parsed.data.entitlementQuantityPerCycle,
        allowRollover: parsed.data.allowRollover,
        rolloverCapQuantity: parsed.data.rolloverCapQuantity ?? null,
        allowTransfers: parsed.data.allowTransfers,
        transferFeeMinor: parsed.data.transferFeeMinor,
        entitlementPolicy: cleanMetadata(parsed.data.entitlementPolicy),
        membershipPolicy: cleanMetadata(parsed.data.membershipPolicy),
        metadata: cleanMetadata(parsed.data.metadata),
      },
      {
        subjectType: 'membership_plan',
        displayName: parsed.data.name,
        metadata: { source: 'routes.entitlements.createMembershipPlan' },
      },
    )) as Record<string, unknown> | Response
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

entitlementRoutes.patch(
  '/bizes/:bizId/membership-plans/:membershipPlanId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, membershipPlanId } = c.req.param()
    const membershipPlansTable = requireTable(
      (getDbSchema().membershipPlans as typeof dbPackage.membershipPlans | undefined) ??
        dbPackage.membershipPlans,
      'membershipPlans',
    )
    const body = await c.req.json().catch(() => null)
    const parsed = updateMembershipPlanBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.membershipPlans.findFirst({
      where: and(eq(membershipPlansTable.bizId, bizId), eq(membershipPlansTable.id, membershipPlanId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Membership plan not found.', 404)

    const updated = (await updateEntitlementRow(
      c,
      bizId,
      'membershipPlans',
      membershipPlanId,
      {
        ...parsed.data,
        entitlementPolicy:
          parsed.data.entitlementPolicy === undefined
            ? undefined
            : cleanMetadata(parsed.data.entitlementPolicy),
        membershipPolicy:
          parsed.data.membershipPolicy === undefined
            ? undefined
            : cleanMetadata(parsed.data.membershipPolicy),
        metadata: parsed.data.metadata === undefined ? undefined : cleanMetadata(parsed.data.metadata),
      },
      {
        subjectType: 'membership_plan',
        subjectId: membershipPlanId,
        displayName: existing.name,
        metadata: { source: 'routes.entitlements.updateMembershipPlan' },
      },
    )) as Record<string, unknown> | Response
    if (updated instanceof Response) return updated

    return ok(c, updated)
  },
)

entitlementRoutes.get(
  '/bizes/:bizId/memberships',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const membershipTableRef = requireTable(
      (getDbSchema().memberships as typeof dbPackage.entitlementMemberships | undefined) ??
        dbPackage.entitlementMemberships,
      'entitlementMemberships',
    )
    const parsed = listMembershipsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(membershipTableRef.bizId, bizId),
      parsed.data.status ? eq(membershipTableRef.status, parsed.data.status) : undefined,
      parsed.data.ownerUserId ? eq(membershipTableRef.ownerUserId, parsed.data.ownerUserId) : undefined,
      parsed.data.membershipPlanId ? eq(membershipTableRef.membershipPlanId, parsed.data.membershipPlanId) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.select().from(membershipTableRef).where(where).orderBy(desc(membershipTableRef.currentPeriodEndAt))
        .limit(pageInfo.perPage)
        .offset(pageInfo.offset),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(membershipTableRef).where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total,
        hasMore: pageInfo.page * pageInfo.perPage < total,
      },
    })
  },
)

entitlementRoutes.post(
  '/bizes/:bizId/memberships',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const membershipTableRef = requireTable(
      (getDbSchema().memberships as typeof dbPackage.entitlementMemberships | undefined) ??
        dbPackage.entitlementMemberships,
      'entitlementMemberships',
    )
    const body = await c.req.json().catch(() => null)
    const parsed = createMembershipBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const created = (await createEntitlementRow(
      c,
      bizId,
      'entitlementMemberships',
      {
        bizId,
        membershipPlanId: parsed.data.membershipPlanId,
        ownerUserId: parsed.data.ownerUserId,
        ownerGroupAccountId: parsed.data.ownerGroupAccountId,
        status: parsed.data.status,
        startsAt: new Date(parsed.data.startsAt),
        currentPeriodStartAt: new Date(parsed.data.currentPeriodStartAt),
        currentPeriodEndAt: new Date(parsed.data.currentPeriodEndAt),
        pausedAt: parsed.data.pausedAt ? new Date(parsed.data.pausedAt) : null,
        cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
        endedAt: parsed.data.endedAt ? new Date(parsed.data.endedAt) : null,
        autoRenew: parsed.data.autoRenew,
        providerSubscriptionRef: parsed.data.providerSubscriptionRef,
        statusReason: parsed.data.statusReason,
        metadata: cleanMetadata(parsed.data.metadata),
      },
      {
        subjectType: 'membership',
        displayName: parsed.data.membershipPlanId,
        metadata: { source: 'routes.entitlements.createMembership' },
      },
    )) as Record<string, unknown> | Response
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

entitlementRoutes.get(
  '/bizes/:bizId/memberships/:membershipId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, membershipId } = c.req.param()
    const membershipTableRef = requireTable(
      (getDbSchema().memberships as typeof dbPackage.entitlementMemberships | undefined) ??
        dbPackage.entitlementMemberships,
      'entitlementMemberships',
    )

    const rows = await db
      .select()
      .from(membershipTableRef)
      .where(and(eq(membershipTableRef.bizId, bizId), eq(membershipTableRef.id, membershipId)))
      .limit(1)
    const membership = rows[0] ?? null
    if (!membership) return fail(c, 'NOT_FOUND', 'Membership not found.', 404)

    return ok(c, membership)
  },
)

entitlementRoutes.patch(
  '/bizes/:bizId/memberships/:membershipId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, membershipId } = c.req.param()
    const membershipTableRef = requireTable(
      (getDbSchema().memberships as typeof dbPackage.entitlementMemberships | undefined) ??
        dbPackage.entitlementMemberships,
      'entitlementMemberships',
    )
    const body = await c.req.json().catch(() => null)
    const parsed = updateMembershipBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existingRows = await db
      .select()
      .from(membershipTableRef)
      .where(and(eq(membershipTableRef.bizId, bizId), eq(membershipTableRef.id, membershipId)))
      .limit(1)
    const existing = existingRows[0] ?? null
    if (!existing) return fail(c, 'NOT_FOUND', 'Membership not found.', 404)

    const updated = (await updateEntitlementRow(
      c,
      bizId,
      'entitlementMemberships',
      membershipId,
      {
        membershipPlanId: parsed.data.membershipPlanId,
        ownerUserId: parsed.data.ownerUserId,
        ownerGroupAccountId: parsed.data.ownerGroupAccountId,
        status: parsed.data.status,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
        currentPeriodStartAt: parsed.data.currentPeriodStartAt
          ? new Date(parsed.data.currentPeriodStartAt)
          : undefined,
        currentPeriodEndAt: parsed.data.currentPeriodEndAt ? new Date(parsed.data.currentPeriodEndAt) : undefined,
        pausedAt: parsed.data.pausedAt === undefined ? undefined : parsed.data.pausedAt ? new Date(parsed.data.pausedAt) : null,
        cancelledAt:
          parsed.data.cancelledAt === undefined
            ? undefined
            : parsed.data.cancelledAt
              ? new Date(parsed.data.cancelledAt)
              : null,
        endedAt: parsed.data.endedAt === undefined ? undefined : parsed.data.endedAt ? new Date(parsed.data.endedAt) : null,
        autoRenew: parsed.data.autoRenew,
        providerSubscriptionRef: parsed.data.providerSubscriptionRef,
        statusReason: parsed.data.statusReason,
        metadata: parsed.data.metadata === undefined ? undefined : cleanMetadata(parsed.data.metadata),
      },
      {
        subjectType: 'membership',
        subjectId: membershipId,
        displayName: existing.id,
        metadata: { source: 'routes.entitlements.updateMembership' },
      },
    )) as Record<string, unknown> | Response
    if (updated instanceof Response) return updated

    return ok(c, updated)
  },
)

entitlementRoutes.get(
  '/bizes/:bizId/entitlement-wallets',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listWalletsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(entitlementWallets.bizId, bizId),
      parsed.data.ownerUserId ? eq(entitlementWallets.ownerUserId, parsed.data.ownerUserId) : undefined,
      parsed.data.membershipId ? eq(entitlementWallets.membershipId, parsed.data.membershipId) : undefined,
      parsed.data.isActive ? eq(entitlementWallets.isActive, parsed.data.isActive === 'true') : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.entitlementWallets.findMany({
        where,
        orderBy: [asc(entitlementWallets.name)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(entitlementWallets).where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total,
        hasMore: pageInfo.page * pageInfo.perPage < total,
      },
    })
  },
)

entitlementRoutes.post(
  '/bizes/:bizId/entitlement-wallets',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const body = await c.req.json().catch(() => null)
    const parsed = createWalletBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const created = (await createEntitlementRow(
      c,
      bizId,
      'entitlementWallets',
      {
        bizId,
        membershipId: parsed.data.membershipId,
        ownerUserId: parsed.data.ownerUserId,
        ownerGroupAccountId: parsed.data.ownerGroupAccountId,
        name: parsed.data.name,
        entitlementType: parsed.data.entitlementType,
        unitCode: parsed.data.unitCode,
        balanceQuantity: parsed.data.balanceQuantity,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        isActive: parsed.data.isActive,
        metadata: cleanMetadata(parsed.data.metadata),
      },
      {
        subjectType: 'entitlement_wallet',
        displayName: parsed.data.name,
        metadata: { source: 'routes.entitlements.createWallet' },
      },
    )) as Record<string, unknown> | Response
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

entitlementRoutes.get(
  '/bizes/:bizId/entitlement-wallets/:walletId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, walletId } = c.req.param()
    const wallet = await db.query.entitlementWallets.findFirst({
      where: and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, walletId)),
    })
    if (!wallet) return fail(c, 'NOT_FOUND', 'Entitlement wallet not found.', 404)
    return ok(c, wallet)
  },
)

entitlementRoutes.post(
  '/bizes/:bizId/entitlement-grants',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const body = await c.req.json().catch(() => null)
    const parsed = createGrantBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const result = await db.transaction(async (tx) => {
      const wallet = await tx.query.entitlementWallets.findFirst({
        where: and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, parsed.data.walletId)),
      })
      if (!wallet) throw new Error('ENTITLEMENT_WALLET_NOT_FOUND')

      const nextBalance = Number(wallet.balanceQuantity ?? 0) + parsed.data.quantity
      const [grant] = await tx
        .insert(entitlementGrants)
        .values({
          bizId,
          walletId: parsed.data.walletId,
          membershipId: parsed.data.membershipId,
          bookingOrderId: parsed.data.bookingOrderId,
          grantType: parsed.data.grantType,
          quantity: parsed.data.quantity,
          validFromAt: new Date(parsed.data.validFromAt),
          validUntilAt: parsed.data.validUntilAt ? new Date(parsed.data.validUntilAt) : null,
          rolloverEligible: parsed.data.rolloverEligible,
          transferable: parsed.data.transferable,
          reason: parsed.data.reason,
          metadata: cleanMetadata(parsed.data.metadata),
        })
        .returning()

      const [ledger] = await tx
        .insert(entitlementLedgerEntries)
        .values({
          bizId,
          walletId: wallet.id,
          grantId: grant.id,
          bookingOrderId: parsed.data.bookingOrderId,
          entryType: 'grant',
          quantityDelta: parsed.data.quantity,
          balanceAfter: nextBalance,
          reasonCode: 'grant',
          metadata: {
            source: 'entitlement_grant',
            grantType: parsed.data.grantType,
          },
        })
        .returning()

      const [updatedWallet] = await tx
        .update(entitlementWallets)
        .set({ balanceQuantity: nextBalance })
        .where(and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, wallet.id)))
        .returning()

      return { grant, ledger, wallet: updatedWallet }
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === 'ENTITLEMENT_WALLET_NOT_FOUND') return null
      throw error
    })

    if (!result) return fail(c, 'NOT_FOUND', 'Entitlement wallet not found.', 404)
    return ok(c, result, 201)
  },
)

entitlementRoutes.post(
  '/bizes/:bizId/entitlement-transfers',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createTransferBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const transfersTable = entitlementTransfersTable()
    const result = await db.transaction(async (tx) => {
      const fromWallet = await tx.query.entitlementWallets.findFirst({
        where: and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, parsed.data.fromWalletId)),
      })
      const toWallet = await tx.query.entitlementWallets.findFirst({
        where: and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, parsed.data.toWalletId)),
      })
      if (!fromWallet || !toWallet) throw new Error('ENTITLEMENT_WALLET_NOT_FOUND')
      if (fromWallet.id === toWallet.id) throw new Error('ENTITLEMENT_TRANSFER_SAME_WALLET')
      if (Number(fromWallet.balanceQuantity ?? 0) < parsed.data.quantity) {
        throw new Error('ENTITLEMENT_INSUFFICIENT_BALANCE')
      }

      // This table is resolved from the runtime Drizzle full schema because the
      // entitlement module can be loaded before generated static table exports
      // are fully aligned. Cast the returning rows at the edge so the rest of
      // the transfer flow stays strongly shaped and deterministic.
      const transferRows = (await tx
        .insert(transfersTable as any)
        .values({
          bizId,
          fromWalletId: fromWallet.id,
          toWalletId: toWallet.id,
          status: 'completed',
          quantity: parsed.data.quantity,
          requestedByUserId: c.get('user')?.id ?? null,
          reviewedByUserId: c.get('user')?.id ?? null,
          requestedAt: new Date(),
          reviewedAt: new Date(),
          completedAt: new Date(),
          reason: parsed.data.reason ?? null,
          metadata: cleanMetadata(parsed.data.metadata),
        })
        .returning()) as Array<{ id: string }>
      const transfer = transferRows[0]

      const nextFromBalance = Number(fromWallet.balanceQuantity ?? 0) - parsed.data.quantity
      const nextToBalance = Number(toWallet.balanceQuantity ?? 0) + parsed.data.quantity

      await tx.insert(entitlementLedgerEntries).values([
        {
          bizId,
          walletId: fromWallet.id,
          transferId: transfer.id,
          entryType: 'transfer_out' as const,
          quantityDelta: -parsed.data.quantity,
          balanceAfter: nextFromBalance,
          reasonCode: 'transfer_out',
          metadata: {},
        },
        {
          bizId,
          walletId: toWallet.id,
          transferId: transfer.id,
          entryType: 'transfer_in' as const,
          quantityDelta: parsed.data.quantity,
          balanceAfter: nextToBalance,
          reasonCode: 'transfer_in',
          metadata: {},
        },
      ])

      const [updatedFromWallet] = await tx
        .update(entitlementWallets)
        .set({ balanceQuantity: nextFromBalance })
        .where(and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, fromWallet.id)))
        .returning()
      const [updatedToWallet] = await tx
        .update(entitlementWallets)
        .set({ balanceQuantity: nextToBalance })
        .where(and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, toWallet.id)))
        .returning()

      return {
        transfer,
        fromWallet: updatedFromWallet,
        toWallet: updatedToWallet,
      }
    }).catch((error: unknown) => {
      if (!(error instanceof Error)) throw error
      if (error.message === 'ENTITLEMENT_WALLET_NOT_FOUND') return 'not_found' as const
      if (error.message === 'ENTITLEMENT_TRANSFER_SAME_WALLET') return 'same_wallet' as const
      if (error.message === 'ENTITLEMENT_INSUFFICIENT_BALANCE') return 'insufficient' as const
      throw error
    })

    if (result === 'not_found') return fail(c, 'NOT_FOUND', 'One or both wallets were not found.', 404)
    if (result === 'same_wallet') return fail(c, 'INVALID_TRANSFER', 'Source and destination wallets must differ.', 409)
    if (result === 'insufficient') return fail(c, 'INSUFFICIENT_BALANCE', 'Wallet balance is too low.', 409)
    return ok(c, result, 201)
  },
)

entitlementRoutes.post(
  '/bizes/:bizId/entitlement-wallets/:walletId/consume',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, walletId } = c.req.param()
    const body = await c.req.json().catch(() => null)
    const parsed = consumeWalletBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const result = await db.transaction(async (tx) => {
      const wallet = await tx.query.entitlementWallets.findFirst({
        where: and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, walletId)),
      })
      if (!wallet) throw new Error('ENTITLEMENT_WALLET_NOT_FOUND')
      if (!wallet.isActive) throw new Error('ENTITLEMENT_WALLET_INACTIVE')
      if (Number(wallet.balanceQuantity ?? 0) < parsed.data.quantity) throw new Error('ENTITLEMENT_INSUFFICIENT_BALANCE')

      const nextBalance = Number(wallet.balanceQuantity ?? 0) - parsed.data.quantity
      const [ledger] = await tx
        .insert(entitlementLedgerEntries)
        .values({
          bizId,
          walletId,
          bookingOrderId: parsed.data.bookingOrderId,
          fulfillmentUnitId: parsed.data.fulfillmentUnitId,
          entryType: 'consume',
          quantityDelta: -parsed.data.quantity,
          balanceAfter: nextBalance,
          reasonCode: parsed.data.reasonCode,
          metadata: cleanMetadata(parsed.data.metadata),
        })
        .returning()

      const [updatedWallet] = await tx
        .update(entitlementWallets)
        .set({ balanceQuantity: nextBalance })
        .where(and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, walletId)))
        .returning()

      return { ledger, wallet: updatedWallet }
    }).catch((error: unknown) => {
      if (!(error instanceof Error)) throw error
      if (error.message === 'ENTITLEMENT_WALLET_NOT_FOUND') return 'not_found' as const
      if (error.message === 'ENTITLEMENT_WALLET_INACTIVE') return 'inactive' as const
      if (error.message === 'ENTITLEMENT_INSUFFICIENT_BALANCE') return 'insufficient' as const
      throw error
    })

    if (result === 'not_found') return fail(c, 'NOT_FOUND', 'Entitlement wallet not found.', 404)
    if (result === 'inactive') return fail(c, 'WALLET_INACTIVE', 'Entitlement wallet is inactive.', 409)
    if (result === 'insufficient') return fail(c, 'INSUFFICIENT_BALANCE', 'Wallet balance is too low.', 409)

    return ok(c, result)
  },
)

entitlementRoutes.get(
  '/bizes/:bizId/entitlement-wallets/:walletId/ledger',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, walletId } = c.req.param()
    const parsed = paginationQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const pageInfo = pagination(parsed.data)
    const where = and(eq(entitlementLedgerEntries.bizId, bizId), eq(entitlementLedgerEntries.walletId, walletId))

    const [rows, countRows] = await Promise.all([
      db.query.entitlementLedgerEntries.findMany({
        where,
        orderBy: [desc(entitlementLedgerEntries.occurredAt)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(entitlementLedgerEntries).where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total,
        hasMore: pageInfo.page * pageInfo.perPage < total,
      },
    })
  },
)

entitlementRoutes.post(
  '/bizes/:bizId/gift-wallets',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const body = await c.req.json().catch(() => null)
    const parsed = createGiftWalletBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const giftCode = `GIFT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const nowIso = new Date().toISOString()
    /**
     * Create the gift wallet atomically with its opening grant and ledger row.
     *
     * ELI5:
     * Buying a gift should not create an empty wallet that only "claims" it has
     * value in a side table. The wallet balance, grant record, and ledger history
     * must all agree immediately so later redemption/consume routes read one
     * consistent truth.
     */
    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx
        .insert(entitlementWallets)
        .values({
          bizId,
          ownerUserId: parsed.data.purchaserUserId,
          membershipId: null,
          name: parsed.data.name,
          entitlementType: 'credit',
          unitCode: parsed.data.unitCode,
          balanceQuantity: parsed.data.quantity,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
          isActive: true,
          metadata: cleanMetadata({
            ...(parsed.data.metadata ?? {}),
            giftInstrument: {
              giftCode,
              purchaserUserId: parsed.data.purchaserUserId,
              recipientUserId: parsed.data.recipientUserId ?? null,
              status: 'active',
              transferable: parsed.data.transferable,
              revocableUntilRedeemed: parsed.data.revocableUntilRedeemed,
              extendable: parsed.data.extendable,
              issuedAt: nowIso,
              redeemedAt: null,
              revokedAt: null,
              transferredAt: null,
              extensionCount: 0,
            },
          }),
        })
        .returning()

      const [grant] = await tx
        .insert(entitlementGrants)
        .values({
          bizId,
          walletId: wallet.id,
          membershipId: null,
          bookingOrderId: null,
          grantType: 'credit',
          quantity: parsed.data.quantity,
          validFromAt: new Date(),
          validUntilAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
          rolloverEligible: false,
          transferable: parsed.data.transferable,
          reason: 'gift_purchase',
          metadata: { giftCode },
        })
        .returning()

      const [ledger] = await tx
        .insert(entitlementLedgerEntries)
        .values({
          bizId,
          walletId: wallet.id,
          grantId: grant.id,
          bookingOrderId: null,
          fulfillmentUnitId: null,
          entryType: 'grant',
          quantityDelta: parsed.data.quantity,
          balanceAfter: parsed.data.quantity,
          reasonCode: 'gift_purchase',
          metadata: cleanMetadata({
            source: 'gift_wallet_issue',
            giftCode,
          }),
        })
        .returning()

      return { wallet, grant, ledger }
    })

    return ok(c, { ...result, giftInstrument: getGiftInstrumentMetadata(result.wallet) }, 201)
  },
)

entitlementRoutes.get(
  '/bizes/:bizId/gift-wallets/:walletId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, walletId } = c.req.param()
    const wallet = await db.query.entitlementWallets.findFirst({
      where: and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, walletId)),
    })
    if (!wallet) return fail(c, 'NOT_FOUND', 'Gift wallet not found.', 404)

    const ledger = await db.query.entitlementLedgerEntries.findMany({
      where: and(eq(entitlementLedgerEntries.bizId, bizId), eq(entitlementLedgerEntries.walletId, walletId)),
      orderBy: [desc(entitlementLedgerEntries.occurredAt)],
      limit: 200,
    })

    return ok(c, { wallet, giftInstrument: getGiftInstrumentMetadata(wallet), ledger })
  },
)

entitlementRoutes.post('/public/bizes/:bizId/gift-wallets/redeem', requireAuth, async (c) => {
  const bizId = c.req.param('bizId')
  const actor = getCurrentUser(c)
  if (!actor) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

  const body = await c.req.json().catch(() => null)
  const parsed = redeemGiftWalletBodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  }

  const wallets = await db.query.entitlementWallets.findMany({
    where: eq(entitlementWallets.bizId, bizId),
    limit: 500,
  })
  const wallet = wallets.find((row) => getGiftInstrumentMetadata(row).giftCode === parsed.data.giftCode) ?? null
  if (!wallet) return fail(c, 'NOT_FOUND', 'Gift code not found.', 404)

  const gift = getGiftInstrumentMetadata(wallet)
  if (gift.status === 'revoked') return fail(c, 'GIFT_REVOKED', 'Gift has been revoked.', 409)

  const updated = (await updateEntitlementRow(
    c,
    bizId,
    'entitlementWallets',
    wallet.id,
    {
      metadata: cleanMetadata({
        ...asRecord(wallet.metadata),
        ...parsed.data.metadata,
        giftInstrument: {
          ...gift,
          recipientUserId: parsed.data.recipientUserId ?? actor.id,
          redeemedByUserId: actor.id,
          redeemedAt: new Date().toISOString(),
          status: 'redeemed',
        },
      }),
    },
    {
      subjectType: 'entitlement_wallet',
      subjectId: wallet.id,
      displayName: wallet.name,
      metadata: { source: 'routes.entitlements.redeemGiftWallet' },
    },
  )) as Record<string, unknown> | Response
  if (updated instanceof Response) return updated

  return ok(c, { wallet: updated, giftInstrument: getGiftInstrumentMetadata({ metadata: updated.metadata }) })
})

entitlementRoutes.post(
  '/bizes/:bizId/gift-wallets/:walletId/transfer',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, walletId } = c.req.param()
    const body = await c.req.json().catch(() => null)
    const parsed = transferGiftWalletBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const wallet = await db.query.entitlementWallets.findFirst({
      where: and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, walletId)),
    })
    if (!wallet) return fail(c, 'NOT_FOUND', 'Gift wallet not found.', 404)

    const gift = getGiftInstrumentMetadata(wallet)
    if (gift.transferable !== true) {
      return fail(c, 'TRANSFER_DISABLED', 'Gift cannot be transferred.', 409)
    }

    const updated = (await updateEntitlementRow(
      c,
      bizId,
      'entitlementWallets',
      walletId,
      {
        metadata: cleanMetadata({
          ...asRecord(wallet.metadata),
          ...parsed.data.metadata,
          giftInstrument: {
            ...gift,
            recipientUserId: parsed.data.targetRecipientUserId ?? gift.recipientUserId ?? null,
            targetRecipientEmail: parsed.data.targetRecipientEmail ?? gift.targetRecipientEmail ?? null,
            transferredAt: new Date().toISOString(),
            transferReason: parsed.data.reason ?? null,
          },
        }),
      },
      {
        subjectType: 'entitlement_wallet',
        subjectId: walletId,
        displayName: wallet.name,
        metadata: { source: 'routes.entitlements.transferGiftWallet' },
      },
    )) as Record<string, unknown> | Response
    if (updated instanceof Response) return updated

    return ok(c, { wallet: updated, giftInstrument: getGiftInstrumentMetadata({ metadata: updated.metadata }) })
  },
)

entitlementRoutes.post(
  '/bizes/:bizId/gift-wallets/:walletId/revoke',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, walletId } = c.req.param()
    const body = await c.req.json().catch(() => null)
    const parsed = revokeGiftWalletBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const wallet = await db.query.entitlementWallets.findFirst({
      where: and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, walletId)),
    })
    if (!wallet) return fail(c, 'NOT_FOUND', 'Gift wallet not found.', 404)

    const gift = getGiftInstrumentMetadata(wallet)
    if (gift.redeemedAt) {
      return fail(c, 'ALREADY_REDEEMED', 'Redeemed gifts cannot be revoked.', 409)
    }

    const updated = (await updateEntitlementRow(
      c,
      bizId,
      'entitlementWallets',
      walletId,
      {
        isActive: false,
        metadata: cleanMetadata({
          ...asRecord(wallet.metadata),
          ...parsed.data.metadata,
          giftInstrument: {
            ...gift,
            status: 'revoked',
            revokedAt: new Date().toISOString(),
            revokeReason: parsed.data.reason ?? null,
          },
        }),
      },
      {
        subjectType: 'entitlement_wallet',
        subjectId: walletId,
        displayName: wallet.name,
        metadata: { source: 'routes.entitlements.revokeGiftWallet' },
      },
    )) as Record<string, unknown> | Response
    if (updated instanceof Response) return updated

    return ok(c, { wallet: updated, giftInstrument: getGiftInstrumentMetadata({ metadata: updated.metadata }) })
  },
)

entitlementRoutes.post(
  '/bizes/:bizId/gift-wallets/:walletId/extend',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, walletId } = c.req.param()
    const body = await c.req.json().catch(() => null)
    const parsed = extendGiftWalletBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const wallet = await db.query.entitlementWallets.findFirst({
      where: and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, walletId)),
    })
    if (!wallet) return fail(c, 'NOT_FOUND', 'Gift wallet not found.', 404)

    const gift = getGiftInstrumentMetadata(wallet)
    if (gift.extendable !== true) {
      return fail(c, 'EXTENSION_DISABLED', 'Gift cannot be extended.', 409)
    }

    const updated = (await updateEntitlementRow(
      c,
      bizId,
      'entitlementWallets',
      walletId,
      {
        expiresAt: new Date(parsed.data.expiresAt),
        metadata: cleanMetadata({
          ...asRecord(wallet.metadata),
          ...parsed.data.metadata,
          giftInstrument: {
            ...gift,
            extensionCount: Number(gift.extensionCount ?? 0) + 1,
            extendedAt: new Date().toISOString(),
            extensionReason: parsed.data.reason ?? null,
          },
        }),
      },
      {
        subjectType: 'entitlement_wallet',
        subjectId: walletId,
        displayName: wallet.name,
        metadata: { source: 'routes.entitlements.extendGiftWallet' },
      },
    )) as Record<string, unknown> | Response
    if (updated instanceof Response) return updated

    return ok(c, { wallet: updated, giftInstrument: getGiftInstrumentMetadata({ metadata: updated.metadata }) })
  },
)

entitlementRoutes.post(
  '/bizes/:bizId/rollover-runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('entitlements.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const body = await c.req.json().catch(() => null)
    const parsed = createRolloverRunBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const result = await db.transaction(async (tx) => {
      let updatedWallet: typeof entitlementWallets.$inferSelect | null = null
      let expiryLedger: typeof entitlementLedgerEntries.$inferSelect | null = null

      if (parsed.data.walletId && parsed.data.expiredQuantity > 0) {
        const wallet = await tx.query.entitlementWallets.findFirst({
          where: and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, parsed.data.walletId)),
        })
        if (!wallet) throw new Error('ENTITLEMENT_WALLET_NOT_FOUND')
        if (Number(wallet.balanceQuantity ?? 0) < parsed.data.expiredQuantity) {
          throw new Error('ENTITLEMENT_INSUFFICIENT_BALANCE')
        }
        const nextBalance = Number(wallet.balanceQuantity ?? 0) - parsed.data.expiredQuantity
        ;[expiryLedger] = await tx
          .insert(entitlementLedgerEntries)
          .values({
            bizId,
            walletId: wallet.id,
            entryType: 'expire',
            quantityDelta: -parsed.data.expiredQuantity,
            balanceAfter: nextBalance,
            reasonCode: 'rollover_expire',
            metadata: {
              rolledOverQuantity: parsed.data.rolledOverQuantity,
            },
          })
          .returning()
        ;[updatedWallet] = await tx
          .update(entitlementWallets)
          .set({ balanceQuantity: nextBalance })
          .where(and(eq(entitlementWallets.bizId, bizId), eq(entitlementWallets.id, wallet.id)))
          .returning()
      }

      const [run] = await tx
        .insert(rolloverRuns)
        .values({
          bizId,
          membershipPlanId: parsed.data.membershipPlanId,
          membershipId: parsed.data.membershipId,
          status: 'completed',
          sourcePeriodStartAt: new Date(parsed.data.sourcePeriodStartAt),
          sourcePeriodEndAt: new Date(parsed.data.sourcePeriodEndAt),
          startedAt: new Date(),
          completedAt: new Date(),
          rolledOverQuantity: parsed.data.rolledOverQuantity,
          expiredQuantity: parsed.data.expiredQuantity,
          summary: cleanMetadata(parsed.data.summary),
          metadata: cleanMetadata({
            ...(parsed.data.metadata ?? {}),
            walletId: parsed.data.walletId ?? null,
          }),
        })
        .returning()

      return { run, wallet: updatedWallet, expiryLedger }
    }).catch((error: unknown) => {
      if (!(error instanceof Error)) throw error
      if (error.message === 'ENTITLEMENT_WALLET_NOT_FOUND') return 'not_found' as const
      if (error.message === 'ENTITLEMENT_INSUFFICIENT_BALANCE') return 'insufficient' as const
      throw error
    })

    if (result === 'not_found') return fail(c, 'NOT_FOUND', 'Entitlement wallet not found.', 404)
    if (result === 'insufficient') return fail(c, 'INSUFFICIENT_BALANCE', 'Wallet balance is too low.', 409)

    return ok(c, result, 201)
  },
)
