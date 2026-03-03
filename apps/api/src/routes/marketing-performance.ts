/**
 * Marketing performance routes.
 *
 * ELI5:
 * These routes turn "marketing happened somewhere else" into first-class Bizing
 * facts:
 * - who is in an audience,
 * - what got synced,
 * - how much we spent,
 * - what conversion values we pushed back out,
 * - and simple profitability math built from those facts.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  adSpendDailyFacts,
  marketingAudienceSegments,
  marketingAudienceSegmentMemberships,
  marketingAudienceSyncRuns,
  offlineConversionPushes,
} = dbPackage

const segmentBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  segmentType: z.string().max(40).default('dynamic'),
  sourceType: z.string().max(40).default('rule'),
  graphAudienceSegmentId: z.string().optional().nullable(),
  definition: z.record(z.unknown()).optional(),
  lastMaterializedAt: z.string().datetime().optional().nullable(),
  memberCount: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).optional(),
})

const segmentMembershipBodySchema = z.object({
  memberCrmContactId: z.string().optional().nullable(),
  memberSubjectType: z.string().max(80).optional().nullable(),
  memberSubjectId: z.string().max(140).optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  sourceType: z.string().max(40).default('rule'),
  sourceRef: z.string().max(180).optional().nullable(),
  score: z.number().int().min(0).optional().nullable(),
  addedAt: z.string().datetime().optional(),
  removedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const syncRunBodySchema = z.object({
  marketingAudienceSegmentId: z.string().min(1),
  channelAccountId: z.string().optional().nullable(),
  provider: z.string().min(1).max(80),
  externalAudienceRef: z.string().max(220).optional().nullable(),
  direction: z.string().max(40).default('export'),
  status: z.string().max(40).default('queued'),
  statusConfigValueId: z.string().optional().nullable(),
  requestedByUserId: z.string().optional().nullable(),
  requestedAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional().nullable(),
  finishedAt: z.string().datetime().optional().nullable(),
  inputCount: z.number().int().min(0).default(0),
  addedCount: z.number().int().min(0).default(0),
  removedCount: z.number().int().min(0).default(0),
  failedCount: z.number().int().min(0).default(0),
  errorSummary: z.string().max(4000).optional().nullable(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const adSpendBodySchema = z.object({
  factDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  provider: z.string().min(1).max(80),
  channelAccountId: z.string().optional().nullable(),
  providerAccountRef: z.string().max(220).optional().nullable(),
  providerAccountName: z.string().max(220).optional().nullable(),
  campaignRef: z.string().max(220).optional().nullable(),
  campaignName: z.string().max(220).optional().nullable(),
  adGroupRef: z.string().max(220).optional().nullable(),
  adGroupName: z.string().max(220).optional().nullable(),
  adRef: z.string().max(220).optional().nullable(),
  adName: z.string().max(220).optional().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  impressions: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  conversions: z.number().int().min(0).default(0),
  spendMinor: z.number().int().min(0).default(0),
  conversionValueMinor: z.number().int().min(0).optional().nullable(),
  attributedRevenueMinor: z.number().int().min(0).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const offlineConversionBodySchema = z.object({
  channelAccountId: z.string().optional().nullable(),
  provider: z.string().min(1).max(80),
  conversionActionRef: z.string().max(220).optional().nullable(),
  status: z.string().max(40).default('queued'),
  statusConfigValueId: z.string().optional().nullable(),
  bookingOrderId: z.string().optional().nullable(),
  paymentTransactionId: z.string().optional().nullable(),
  referralAttributionId: z.string().optional().nullable(),
  conversionAt: z.string().datetime(),
  conversionValueMinor: z.number().int().min(0).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  externalEventRef: z.string().max(220).optional().nullable(),
  attemptCount: z.number().int().min(0).default(0),
  lastAttemptAt: z.string().datetime().optional().nullable(),
  sentAt: z.string().datetime().optional().nullable(),
  errorCode: z.string().max(120).optional().nullable(),
  errorMessage: z.string().max(4000).optional().nullable(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const overviewQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  provider: z.string().optional(),
})

export const marketingPerformanceRoutes = new Hono()

async function createMarketingPerformanceRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'marketing-performance' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

marketingPerformanceRoutes.get(
  '/bizes/:bizId/marketing/audience-segments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.marketingAudienceSegments.findMany({
      where: eq(marketingAudienceSegments.bizId, bizId),
      orderBy: [asc(marketingAudienceSegments.name)],
    })
    return ok(c, rows)
  },
)

marketingPerformanceRoutes.post(
  '/bizes/:bizId/marketing/audience-segments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = segmentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid audience segment body.', 400, parsed.error.flatten())
    const created = await createMarketingPerformanceRow<typeof marketingAudienceSegments.$inferSelect>({
      c,
      bizId,
      tableKey: 'marketingAudienceSegments',
      subjectType: 'marketing_audience_segment',
      displayName: parsed.data.name,
      data: {
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      status: parsed.data.status,
      segmentType: sanitizePlainText(parsed.data.segmentType),
      sourceType: sanitizePlainText(parsed.data.sourceType),
      graphAudienceSegmentId: parsed.data.graphAudienceSegmentId ?? null,
      definition: sanitizeUnknown(parsed.data.definition ?? {}),
      lastMaterializedAt: parsed.data.lastMaterializedAt ? new Date(parsed.data.lastMaterializedAt) : null,
      memberCount: parsed.data.memberCount,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

marketingPerformanceRoutes.get(
  '/bizes/:bizId/marketing/audience-segments/:segmentId/memberships',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, segmentId } = c.req.param()
    const rows = await db.query.marketingAudienceSegmentMemberships.findMany({
      where: and(
        eq(marketingAudienceSegmentMemberships.bizId, bizId),
        eq(marketingAudienceSegmentMemberships.marketingAudienceSegmentId, segmentId),
      ),
      orderBy: [desc(marketingAudienceSegmentMemberships.score), desc(marketingAudienceSegmentMemberships.addedAt)],
    })
    return ok(c, rows)
  },
)

marketingPerformanceRoutes.post(
  '/bizes/:bizId/marketing/audience-segments/:segmentId/memberships',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, segmentId } = c.req.param()
    const parsed = segmentMembershipBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid audience membership body.', 400, parsed.error.flatten())
    const created = await createMarketingPerformanceRow<typeof marketingAudienceSegmentMemberships.$inferSelect>({
      c,
      bizId,
      tableKey: 'marketingAudienceSegmentMemberships',
      subjectType: 'marketing_audience_segment_membership',
      displayName: parsed.data.memberSubjectId ?? parsed.data.memberCrmContactId ?? 'membership',
      data: {
      bizId,
      marketingAudienceSegmentId: segmentId,
      memberCrmContactId: parsed.data.memberCrmContactId ?? null,
      memberSubjectType: parsed.data.memberSubjectType ?? null,
      memberSubjectId: parsed.data.memberSubjectId ?? null,
      status: parsed.data.status,
      sourceType: sanitizePlainText(parsed.data.sourceType),
      sourceRef: parsed.data.sourceRef ? sanitizePlainText(parsed.data.sourceRef) : null,
      score: parsed.data.score ?? null,
      addedAt: parsed.data.addedAt ? new Date(parsed.data.addedAt) : new Date(),
      removedAt: parsed.data.removedAt ? new Date(parsed.data.removedAt) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

marketingPerformanceRoutes.get(
  '/bizes/:bizId/marketing/audience-sync-runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const segmentId = c.req.query('marketingAudienceSegmentId')
    const rows = await db.query.marketingAudienceSyncRuns.findMany({
      where: and(
        eq(marketingAudienceSyncRuns.bizId, bizId),
        segmentId ? eq(marketingAudienceSyncRuns.marketingAudienceSegmentId, segmentId) : undefined,
      ),
      orderBy: [desc(marketingAudienceSyncRuns.requestedAt)],
    })
    return ok(c, rows)
  },
)

marketingPerformanceRoutes.post(
  '/bizes/:bizId/marketing/audience-sync-runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = syncRunBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid audience sync run body.', 400, parsed.error.flatten())
    const created = await createMarketingPerformanceRow<typeof marketingAudienceSyncRuns.$inferSelect>({
      c,
      bizId,
      tableKey: 'marketingAudienceSyncRuns',
      subjectType: 'marketing_audience_sync_run',
      displayName: parsed.data.provider,
      data: {
      bizId,
      marketingAudienceSegmentId: parsed.data.marketingAudienceSegmentId,
      channelAccountId: parsed.data.channelAccountId ?? null,
      provider: sanitizePlainText(parsed.data.provider),
      externalAudienceRef: parsed.data.externalAudienceRef ? sanitizePlainText(parsed.data.externalAudienceRef) : null,
      direction: sanitizePlainText(parsed.data.direction),
      status: sanitizePlainText(parsed.data.status),
      statusConfigValueId: parsed.data.statusConfigValueId ?? null,
      requestedByUserId: parsed.data.requestedByUserId ?? null,
      requestedAt: parsed.data.requestedAt ? new Date(parsed.data.requestedAt) : new Date(),
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
      finishedAt: parsed.data.finishedAt ? new Date(parsed.data.finishedAt) : null,
      inputCount: parsed.data.inputCount,
      addedCount: parsed.data.addedCount,
      removedCount: parsed.data.removedCount,
      failedCount: parsed.data.failedCount,
      errorSummary: parsed.data.errorSummary ? sanitizePlainText(parsed.data.errorSummary) : null,
      payload: sanitizeUnknown(parsed.data.payload ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

marketingPerformanceRoutes.get(
  '/bizes/:bizId/ad-spend-daily-facts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = overviewQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const rows = await db.query.adSpendDailyFacts.findMany({
      where: and(
        eq(adSpendDailyFacts.bizId, bizId),
        parsed.data.provider ? eq(adSpendDailyFacts.provider, parsed.data.provider) : undefined,
        parsed.data.dateFrom ? gte(adSpendDailyFacts.factDate, parsed.data.dateFrom) : undefined,
        parsed.data.dateTo ? lte(adSpendDailyFacts.factDate, parsed.data.dateTo) : undefined,
      ),
      orderBy: [desc(adSpendDailyFacts.factDate), asc(adSpendDailyFacts.provider)],
    })
    return ok(c, rows)
  },
)

marketingPerformanceRoutes.post(
  '/bizes/:bizId/ad-spend-daily-facts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = adSpendBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid ad spend fact body.', 400, parsed.error.flatten())
    const created = await createMarketingPerformanceRow<typeof adSpendDailyFacts.$inferSelect>({
      c,
      bizId,
      tableKey: 'adSpendDailyFacts',
      subjectType: 'ad_spend_daily_fact',
      displayName: `${parsed.data.provider}:${parsed.data.factDate}`,
      data: {
      bizId,
      factDate: parsed.data.factDate,
      provider: sanitizePlainText(parsed.data.provider),
      channelAccountId: parsed.data.channelAccountId ?? null,
      providerAccountRef: parsed.data.providerAccountRef ? sanitizePlainText(parsed.data.providerAccountRef) : null,
      providerAccountName: parsed.data.providerAccountName ? sanitizePlainText(parsed.data.providerAccountName) : null,
      campaignRef: parsed.data.campaignRef ? sanitizePlainText(parsed.data.campaignRef) : null,
      campaignName: parsed.data.campaignName ? sanitizePlainText(parsed.data.campaignName) : null,
      adGroupRef: parsed.data.adGroupRef ? sanitizePlainText(parsed.data.adGroupRef) : null,
      adGroupName: parsed.data.adGroupName ? sanitizePlainText(parsed.data.adGroupName) : null,
      adRef: parsed.data.adRef ? sanitizePlainText(parsed.data.adRef) : null,
      adName: parsed.data.adName ? sanitizePlainText(parsed.data.adName) : null,
      currency: parsed.data.currency,
      impressions: parsed.data.impressions,
      clicks: parsed.data.clicks,
      conversions: parsed.data.conversions,
      spendMinor: parsed.data.spendMinor,
      conversionValueMinor: parsed.data.conversionValueMinor ?? null,
      attributedRevenueMinor: parsed.data.attributedRevenueMinor ?? null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

marketingPerformanceRoutes.get(
  '/bizes/:bizId/offline-conversion-pushes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.offlineConversionPushes.findMany({
      where: eq(offlineConversionPushes.bizId, bizId),
      orderBy: [desc(offlineConversionPushes.conversionAt)],
    })
    return ok(c, rows)
  },
)

marketingPerformanceRoutes.post(
  '/bizes/:bizId/offline-conversion-pushes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = offlineConversionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid offline conversion body.', 400, parsed.error.flatten())
    const created = await createMarketingPerformanceRow<typeof offlineConversionPushes.$inferSelect>({
      c,
      bizId,
      tableKey: 'offlineConversionPushes',
      subjectType: 'offline_conversion_push',
      displayName: parsed.data.provider,
      data: {
      bizId,
      channelAccountId: parsed.data.channelAccountId ?? null,
      provider: sanitizePlainText(parsed.data.provider),
      conversionActionRef: parsed.data.conversionActionRef ? sanitizePlainText(parsed.data.conversionActionRef) : null,
      status: sanitizePlainText(parsed.data.status),
      statusConfigValueId: parsed.data.statusConfigValueId ?? null,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      paymentTransactionId: parsed.data.paymentTransactionId ?? null,
      referralAttributionId: parsed.data.referralAttributionId ?? null,
      conversionAt: new Date(parsed.data.conversionAt),
      conversionValueMinor: parsed.data.conversionValueMinor,
      currency: parsed.data.currency,
      externalEventRef: parsed.data.externalEventRef ? sanitizePlainText(parsed.data.externalEventRef) : null,
      attemptCount: parsed.data.attemptCount,
      lastAttemptAt: parsed.data.lastAttemptAt ? new Date(parsed.data.lastAttemptAt) : null,
      sentAt: parsed.data.sentAt ? new Date(parsed.data.sentAt) : null,
      errorCode: parsed.data.errorCode ?? null,
      errorMessage: parsed.data.errorMessage ? sanitizePlainText(parsed.data.errorMessage) : null,
      payload: sanitizeUnknown(parsed.data.payload ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

marketingPerformanceRoutes.get(
  '/bizes/:bizId/marketing/overview',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = overviewQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())

    const facts = await db.query.adSpendDailyFacts.findMany({
      where: and(
        eq(adSpendDailyFacts.bizId, bizId),
        parsed.data.provider ? eq(adSpendDailyFacts.provider, parsed.data.provider) : undefined,
        parsed.data.dateFrom ? gte(adSpendDailyFacts.factDate, parsed.data.dateFrom) : undefined,
        parsed.data.dateTo ? lte(adSpendDailyFacts.factDate, parsed.data.dateTo) : undefined,
      ),
    })
    const pushes = await db.query.offlineConversionPushes.findMany({
      where: and(
        eq(offlineConversionPushes.bizId, bizId),
        parsed.data.dateFrom ? gte(offlineConversionPushes.conversionAt, new Date(`${parsed.data.dateFrom}T00:00:00.000Z`)) : undefined,
        parsed.data.dateTo ? lte(offlineConversionPushes.conversionAt, new Date(`${parsed.data.dateTo}T23:59:59.999Z`)) : undefined,
      ),
    })

    const spendMinor = facts.reduce((sum, row) => sum + Number(row.spendMinor ?? 0), 0)
    const attributedRevenueMinor = facts.reduce((sum, row) => sum + Number(row.attributedRevenueMinor ?? 0), 0)
    const conversionCount = facts.reduce((sum, row) => sum + Number(row.conversions ?? 0), 0)
    const pushedConversionValueMinor = pushes.reduce((sum, row) => sum + Number(row.conversionValueMinor ?? 0), 0)
    const roas = spendMinor > 0 ? attributedRevenueMinor / spendMinor : 0
    const cacMinor = conversionCount > 0 ? Math.round(spendMinor / conversionCount) : 0

    return ok(c, {
      spendMinor,
      attributedRevenueMinor,
      conversionCount,
      pushedConversionValueMinor,
      roas,
      cacMinor,
      factsCount: facts.length,
      pushCount: pushes.length,
    })
  },
)
