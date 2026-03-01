/**
 * Analytics report routes.
 *
 * ELI5:
 * Owners want more than one hard-coded dashboard tile.
 * They want saved report definitions, rendered report results, and export jobs.
 *
 * We build this on top of the canonical projection backbone:
 * - a projection row is the report definition,
 * - a projection document row is one rendered/exportable result.
 *
 * This keeps analytics flexible without creating a separate reporting schema
 * for every dashboard idea.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok, parsePositiveInt } from './_api.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'

const {
  db,
  projections,
  projectionDocuments,
  bookingOrders,
  resources,
  outboundMessages,
} = dbPackage

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

const reportQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.string().optional(),
})

const createReportBodySchema = z.object({
  projectionKey: z.string().min(1).max(160).regex(/^[a-z0-9._:-]+$/),
  name: z.string().min(1).max(180),
  description: z.string().max(500).optional(),
  spec: z.record(z.unknown()).default({}),
  freshnessPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const renderReportBodySchema = z.object({
  documentKey: z.string().max(180).optional(),
  subjectType: z.string().max(80).optional(),
  subjectId: z.string().max(140).optional(),
  specOverrides: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const exportReportBodySchema = z.object({
  projectionId: z.string(),
  format: z.enum(['csv', 'pdf']),
  reason: z.string().max(240).optional(),
  metadata: z.record(z.unknown()).optional(),
})

function locationIdFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).locationId
  return typeof value === 'string' && value.length > 0 ? value : null
}

function sourceFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'unknown'
  const value = (metadata as Record<string, unknown>).acquisitionSource
  return typeof value === 'string' && value.length > 0 ? value : 'unknown'
}

function providerUserIdFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).providerUserId
  return typeof value === 'string' && value.length > 0 ? value : null
}

async function buildAnalyticsDataset(bizId: string) {
  const [bookings, resourceRows, messages] = await Promise.all([
    db.query.bookingOrders.findMany({
      where: eq(bookingOrders.bizId, bizId),
      orderBy: [desc(bookingOrders.confirmedStartAt), desc(bookingOrders.requestedStartAt), desc(bookingOrders.id)],
    }),
    db.query.resources.findMany({
      where: eq(resources.bizId, bizId),
      columns: { id: true, name: true, type: true, hostUserId: true },
    }),
    db.query.outboundMessages.findMany({
      where: eq(outboundMessages.bizId, bizId),
      columns: { id: true, channel: true, status: true, scheduledFor: true },
      orderBy: [desc(outboundMessages.scheduledFor), desc(outboundMessages.id)],
      limit: 200,
    }),
  ])

  const bySource = new Map<string, number>()
  const byOffer = new Map<string, number>()
  const byLocation = new Map<string, number>()
  const byHour = new Map<string, number>()
  const byProvider = new Map<string, { bookingCount: number; confirmedCount: number; revenueMinor: number }>()
  const byCustomer = new Map<string, { bookingCount: number; revenueMinor: number }>()
  let totalRevenueMinor = 0
  let cancellationCount = 0
  let noShowCount = 0
  let leadTimeMinutesTotal = 0
  let leadTimeCount = 0

  for (const booking of bookings) {
    totalRevenueMinor += booking.totalMinor
    if (booking.status === 'cancelled') cancellationCount += 1
    if (((booking.metadata as Record<string, unknown> | null)?.attendanceOutcome) === 'no_show') noShowCount += 1
    bySource.set(sourceFromMetadata(booking.metadata), (bySource.get(sourceFromMetadata(booking.metadata)) ?? 0) + 1)
    byOffer.set(booking.offerId, (byOffer.get(booking.offerId) ?? 0) + 1)
    const locationId = locationIdFromMetadata(booking.metadata)
    if (locationId) byLocation.set(locationId, (byLocation.get(locationId) ?? 0) + 1)
    const providerUserId = providerUserIdFromMetadata(booking.metadata)
    if (providerUserId) {
      const current = byProvider.get(providerUserId) ?? { bookingCount: 0, confirmedCount: 0, revenueMinor: 0 }
      current.bookingCount += 1
      current.revenueMinor += booking.totalMinor
      if (booking.status === 'confirmed') current.confirmedCount += 1
      byProvider.set(providerUserId, current)
    }
    if (booking.customerUserId) {
      const current = byCustomer.get(booking.customerUserId) ?? { bookingCount: 0, revenueMinor: 0 }
      current.bookingCount += 1
      current.revenueMinor += booking.totalMinor
      byCustomer.set(booking.customerUserId, current)
    }
    const startAt = booking.confirmedStartAt ?? booking.requestedStartAt
    if (startAt) {
      const hourKey = startAt.toISOString().slice(11, 13)
      byHour.set(hourKey, (byHour.get(hourKey) ?? 0) + 1)
      const hintedLeadTime = Number((booking.metadata as Record<string, unknown> | null)?.leadTimeMinutes ?? 0)
      const diffMinutes = Number.isFinite(hintedLeadTime) && hintedLeadTime > 0 ? hintedLeadTime : 0
      leadTimeMinutesTotal += diffMinutes
      leadTimeCount += 1
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      bookingCount: bookings.length,
      totalRevenueMinor,
      cancellationRate: bookings.length ? cancellationCount / bookings.length : 0,
      noShowRate: bookings.length ? noShowCount / bookings.length : 0,
      averageLeadTimeMinutes: leadTimeCount ? Math.round(leadTimeMinutesTotal / leadTimeCount) : 0,
      providerCount: resourceRows.filter((row) => row.type === 'host').length,
    },
    topAcquisitionSources: Array.from(bySource.entries()).map(([source, bookingCount]) => ({ source, bookingCount })).sort((a, b) => b.bookingCount - a.bookingCount),
    topOffers: Array.from(byOffer.entries()).map(([offerId, bookingCount]) => ({ offerId, bookingCount })).sort((a, b) => b.bookingCount - a.bookingCount),
    bookingsByLocation: Array.from(byLocation.entries()).map(([locationId, bookingCount]) => ({ locationId, bookingCount })).sort((a, b) => b.bookingCount - a.bookingCount),
    providerPerformance: Array.from(byProvider.entries()).map(([providerUserId, aggregate]) => ({ providerUserId, ...aggregate })).sort((a, b) => b.revenueMinor - a.revenueMinor),
    popularTimeSlots: Array.from(byHour.entries()).map(([hourUtc, bookingCount]) => ({ hourUtc, bookingCount })).sort((a, b) => b.bookingCount - a.bookingCount),
    customerLifetimeValue: Array.from(byCustomer.entries()).map(([customerUserId, aggregate]) => ({ customerUserId, ...aggregate })).sort((a, b) => b.revenueMinor - a.revenueMinor),
    providers: resourceRows.filter((row) => row.type === 'host'),
    recentMessages: messages,
  }
}

export const analyticsRoutes = new Hono()

analyticsRoutes.get(
  '/bizes/:bizId/analytics/reports',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('projections.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = reportQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(projections.bizId, bizId),
      eq(projections.projectionFamily, 'analytics_custom_report'),
      parsed.data.status ? eq(projections.status, parsed.data.status) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.projections.findMany({
        where,
        orderBy: [asc(projections.projectionKey)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(projections).where(where),
    ])
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total: countRows[0]?.count ?? 0,
        hasMore: pageInfo.page * pageInfo.perPage < (countRows[0]?.count ?? 0),
      },
    })
  },
)

analyticsRoutes.post(
  '/bizes/:bizId/analytics/reports',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('projections.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createReportBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const [created] = await db.insert(projections).values({
      bizId,
      projectionKey: parsed.data.projectionKey,
      projectionFamily: 'analytics_custom_report',
      status: 'active',
      freshnessPolicy: sanitizeUnknown(parsed.data.freshnessPolicy ?? {}),
      metadata: sanitizeUnknown({
        name: sanitizePlainText(parsed.data.name),
        description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
        spec: parsed.data.spec,
        ...(parsed.data.metadata ?? {}),
      }),
    }).returning()
    return ok(c, created, 201)
  },
)

analyticsRoutes.post(
  '/bizes/:bizId/analytics/reports/:projectionId/render',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('projections.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const projectionId = c.req.param('projectionId')
    const parsed = renderReportBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const projection = await db.query.projections.findFirst({
      where: and(eq(projections.bizId, bizId), eq(projections.id, projectionId), eq(projections.projectionFamily, 'analytics_custom_report')),
    })
    if (!projection) return fail(c, 'NOT_FOUND', 'Analytics report definition not found.', 404)
    const rendered = await buildAnalyticsDataset(bizId)
    const documentKey = parsed.data.documentKey ?? `render_${Date.now()}`
    const [created] = await db.insert(projectionDocuments).values({
      bizId,
      projectionId,
      documentKey,
      subjectType: parsed.data.subjectType ?? 'biz',
      subjectId: parsed.data.subjectId ?? bizId,
      status: 'current',
      versionNumber: 1,
      renderedData: sanitizeUnknown({
        reportDefinition: projection.metadata,
        overrides: parsed.data.specOverrides ?? {},
        dataset: rendered,
      }),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()
    return ok(c, created, 201)
  },
)

analyticsRoutes.post(
  '/bizes/:bizId/analytics/exports',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('projections.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = exportReportBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const projection = await db.query.projections.findFirst({
      where: and(eq(projections.bizId, bizId), eq(projections.id, parsed.data.projectionId)),
    })
    if (!projection) return fail(c, 'NOT_FOUND', 'Projection not found.', 404)
    const rendered = await buildAnalyticsDataset(bizId)
    const [doc] = await db.insert(projectionDocuments).values({
      bizId,
      projectionId: projection.id,
      documentKey: `export_${parsed.data.format}_${Date.now()}`,
      subjectType: 'biz',
      subjectId: bizId,
      status: 'current',
      versionNumber: 1,
      renderedData: sanitizeUnknown({
        exportFormat: parsed.data.format,
        dataset: rendered,
      }),
      metadata: sanitizeUnknown({
        reason: parsed.data.reason ?? null,
        exportFormat: parsed.data.format,
        exportReady: true,
        ...(parsed.data.metadata ?? {}),
      }),
    }).returning()
    return ok(c, {
      exportId: doc.id,
      format: parsed.data.format,
      status: 'ready',
      projectionId: projection.id,
      documentId: doc.id,
    }, 201)
  },
)
