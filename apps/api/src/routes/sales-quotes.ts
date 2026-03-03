/**
 * Sales quote routes.
 *
 * ELI5:
 * A quote is the "here is the offer we are proposing" thread before payment or
 * booking commitment happens.
 *
 * This route family exposes:
 * - quote thread headers,
 * - immutable-ish revisions,
 * - line items inside one revision,
 * - acceptance/rejection decisions with actor trail.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  salesQuotes,
  salesQuoteVersions,
  salesQuoteLines,
  salesQuoteAcceptances,
} = dbPackage

const quoteBodySchema = z.object({
  quoteNumber: z.string().min(1).max(120),
  status: z.string().max(40).optional(),
  statusConfigValueId: z.string().optional().nullable(),
  title: z.string().max(240).optional().nullable(),
  description: z.string().optional().nullable(),
  crmContactId: z.string().min(1),
  currency: z.string().length(3).optional(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  currentVersionNumber: z.number().int().min(1).optional(),
  sourceCheckoutSessionId: z.string().optional().nullable(),
  convertedBookingOrderId: z.string().optional().nullable(),
  convertedAt: z.string().datetime().optional().nullable(),
  termsSnapshot: z.record(z.unknown()).optional(),
  pricingContext: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const quoteVersionBodySchema = z.object({
  versionNumber: z.number().int().min(1),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  subtotalMinor: z.number().int().min(0),
  taxMinor: z.number().int().min(0).optional(),
  feeMinor: z.number().int().min(0).optional(),
  discountMinor: z.number().int().min(0).optional(),
  totalMinor: z.number().int().min(0),
  currency: z.string().length(3).optional(),
  isCurrent: z.boolean().optional(),
  termsSnapshot: z.record(z.unknown()).optional(),
  pricingSnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const quoteLineBodySchema = z.object({
  lineType: z.string().max(60).optional(),
  label: z.string().min(1).max(240),
  description: z.string().optional().nullable(),
  sellableId: z.string().optional().nullable(),
  variantKey: z.string().max(180).optional().nullable(),
  quantity: z.number().int().positive().optional(),
  unitAmountMinor: z.number().int().min(0),
  subtotalMinor: z.number().int().min(0),
  discountMinor: z.number().int().min(0).optional(),
  taxMinor: z.number().int().min(0).optional(),
  totalMinor: z.number().int().min(0),
  currency: z.string().length(3).optional(),
  sortOrder: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const quoteAcceptanceBodySchema = z.object({
  decisionType: z.string().min(1).max(60),
  actorContactId: z.string().optional().nullable(),
  actorSubjectType: z.string().max(80).optional().nullable(),
  actorSubjectId: z.string().max(140).optional().nullable(),
  signerName: z.string().max(220).optional().nullable(),
  signerEmail: z.string().email().max(320).optional().nullable(),
  sourceIp: z.string().max(80).optional().nullable(),
  sourceUserAgent: z.string().max(800).optional().nullable(),
  signatureEvidence: z.record(z.unknown()).optional(),
  acceptedTermsSnapshot: z.record(z.unknown()).optional(),
  bookingOrderId: z.string().optional().nullable(),
  instrumentRunId: z.string().optional().nullable(),
  decisionNote: z.string().optional().nullable(),
  decidedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

function asDate(value?: string | null) {
  return value ? new Date(value) : null
}

export const salesQuoteRoutes = new Hono()

async function createSalesQuoteRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'sales-quotes' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

salesQuoteRoutes.get('/bizes/:bizId/sales-quotes', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.salesQuotes.findMany({ where: eq(salesQuotes.bizId, bizId), orderBy: [desc(salesQuotes.validUntil), desc(salesQuotes.id)] })
  return ok(c, rows)
})

salesQuoteRoutes.post('/bizes/:bizId/sales-quotes', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = quoteBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid sales quote body.', 400, parsed.error.flatten())
  const row = await createSalesQuoteRow<typeof salesQuotes.$inferSelect>({
    c,
    bizId,
    tableKey: 'salesQuotes',
    subjectType: 'sales_quote',
    displayName: parsed.data.quoteNumber,
    data: {
    bizId,
    quoteNumber: sanitizePlainText(parsed.data.quoteNumber),
    status: parsed.data.status ?? 'draft',
    statusConfigValueId: parsed.data.statusConfigValueId ?? null,
    title: parsed.data.title ? sanitizePlainText(parsed.data.title) : null,
    description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
    crmContactId: parsed.data.crmContactId,
    currency: parsed.data.currency ?? 'USD',
    validFrom: asDate(parsed.data.validFrom),
    validUntil: asDate(parsed.data.validUntil),
    currentVersionNumber: parsed.data.currentVersionNumber ?? 1,
    sourceCheckoutSessionId: parsed.data.sourceCheckoutSessionId ?? null,
    convertedBookingOrderId: parsed.data.convertedBookingOrderId ?? null,
    convertedAt: asDate(parsed.data.convertedAt),
    termsSnapshot: sanitizeUnknown(parsed.data.termsSnapshot ?? {}),
    pricingContext: sanitizeUnknown(parsed.data.pricingContext ?? {}),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (row instanceof Response) return row
  return ok(c, row, 201)
})

salesQuoteRoutes.get('/bizes/:bizId/sales-quotes/:salesQuoteId/versions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, salesQuoteId } = c.req.param()
  const rows = await db.query.salesQuoteVersions.findMany({ where: and(eq(salesQuoteVersions.bizId, bizId), eq(salesQuoteVersions.salesQuoteId, salesQuoteId)), orderBy: [desc(salesQuoteVersions.versionNumber)] })
  return ok(c, rows)
})

salesQuoteRoutes.post('/bizes/:bizId/sales-quotes/:salesQuoteId/versions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, salesQuoteId } = c.req.param()
  const parsed = quoteVersionBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid sales quote version body.', 400, parsed.error.flatten())
  const row = await createSalesQuoteRow<typeof salesQuoteVersions.$inferSelect>({
    c,
    bizId,
    tableKey: 'salesQuoteVersions',
    subjectType: 'sales_quote_version',
    displayName: `${salesQuoteId}:v${parsed.data.versionNumber}`,
    data: {
    bizId,
    salesQuoteId,
    versionNumber: parsed.data.versionNumber,
    status: parsed.data.status ?? 'draft',
    issuedAt: asDate(parsed.data.validFrom),
    validUntil: asDate(parsed.data.validUntil),
    subtotalMinor: parsed.data.subtotalMinor,
    taxMinor: parsed.data.taxMinor ?? 0,
    feeMinor: parsed.data.feeMinor ?? 0,
    discountMinor: parsed.data.discountMinor ?? 0,
    totalMinor: parsed.data.totalMinor,
    currency: parsed.data.currency ?? 'USD',
    isCurrent: parsed.data.isCurrent ?? false,
    termsSnapshot: sanitizeUnknown(parsed.data.termsSnapshot ?? {}),
    pricingSnapshot: sanitizeUnknown(parsed.data.pricingSnapshot ?? {}),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (row instanceof Response) return row
  return ok(c, row, 201)
})

salesQuoteRoutes.get('/bizes/:bizId/sales-quote-versions/:salesQuoteVersionId/lines', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, salesQuoteVersionId } = c.req.param()
  const rows = await db.query.salesQuoteLines.findMany({ where: and(eq(salesQuoteLines.bizId, bizId), eq(salesQuoteLines.salesQuoteVersionId, salesQuoteVersionId)), orderBy: [asc(salesQuoteLines.sortOrder)] })
  return ok(c, rows)
})

salesQuoteRoutes.post('/bizes/:bizId/sales-quote-versions/:salesQuoteVersionId/lines', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, salesQuoteVersionId } = c.req.param()
  const parsed = quoteLineBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid sales quote line body.', 400, parsed.error.flatten())
  const row = await createSalesQuoteRow<typeof salesQuoteLines.$inferSelect>({
    c,
    bizId,
    tableKey: 'salesQuoteLines',
    subjectType: 'sales_quote_line',
    displayName: parsed.data.label,
    data: {
    bizId,
    salesQuoteVersionId,
    lineType: parsed.data.lineType ?? 'custom',
    description: sanitizePlainText(parsed.data.description ?? parsed.data.label),
    sellableId: parsed.data.sellableId ?? null,
    quantity: parsed.data.quantity ?? 1,
    unitPriceMinor: parsed.data.unitAmountMinor,
    lineSubtotalMinor: parsed.data.subtotalMinor,
    discountMinor: parsed.data.discountMinor ?? 0,
    taxMinor: parsed.data.taxMinor ?? 0,
    feeMinor: 0,
    totalMinor: parsed.data.totalMinor,
    currency: parsed.data.currency ?? 'USD',
    sortOrder: parsed.data.sortOrder ?? 100,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (row instanceof Response) return row
  return ok(c, row, 201)
})

salesQuoteRoutes.get('/bizes/:bizId/sales-quote-versions/:salesQuoteVersionId/acceptances', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, salesQuoteVersionId } = c.req.param()
  const rows = await db.query.salesQuoteAcceptances.findMany({ where: and(eq(salesQuoteAcceptances.bizId, bizId), eq(salesQuoteAcceptances.salesQuoteVersionId, salesQuoteVersionId)), orderBy: [desc(salesQuoteAcceptances.decidedAt)] })
  return ok(c, rows)
})

salesQuoteRoutes.post('/bizes/:bizId/sales-quote-versions/:salesQuoteVersionId/acceptances', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, salesQuoteVersionId } = c.req.param()
  const parsed = quoteAcceptanceBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid sales quote acceptance body.', 400, parsed.error.flatten())
  const row = await createSalesQuoteRow<typeof salesQuoteAcceptances.$inferSelect>({
    c,
    bizId,
    tableKey: 'salesQuoteAcceptances',
    subjectType: 'sales_quote_acceptance',
    displayName: parsed.data.decisionType,
    data: {
    bizId,
    salesQuoteVersionId,
    decisionType: sanitizePlainText(parsed.data.decisionType),
    decidedByCrmContactId: parsed.data.actorContactId ?? null,
    decidedBySubjectType: parsed.data.actorSubjectType ?? null,
    decidedBySubjectId: parsed.data.actorSubjectId ?? null,
    signerName: parsed.data.signerName ? sanitizePlainText(parsed.data.signerName) : null,
    signerEmail: parsed.data.signerEmail ?? null,
    bookingOrderId: parsed.data.bookingOrderId ?? null,
    instrumentRunId: parsed.data.instrumentRunId ?? null,
    decisionNote: parsed.data.decisionNote ? sanitizePlainText(parsed.data.decisionNote) : null,
    decidedAt: asDate(parsed.data.decidedAt) ?? new Date(),
    sourceIp: parsed.data.sourceIp ?? null,
    sourceUserAgent: parsed.data.sourceUserAgent ? sanitizePlainText(parsed.data.sourceUserAgent) : null,
    signatureEvidence: sanitizeUnknown(parsed.data.signatureEvidence ?? parsed.data.acceptedTermsSnapshot ?? {}),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (row instanceof Response) return row
  return ok(c, row, 201)
})
