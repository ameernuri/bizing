/**
 * Receivables routes.
 *
 * ELI5:
 * These rows answer the B2B / invoice-style money questions:
 * - who can buy on terms?
 * - what PO are they using?
 * - what invoice was issued and what happened next?
 *
 * Why this route matters:
 * booking sagas should prove net-terms, credit limits, PO capture, invoice
 * aging, and collections through the API, not through ad-hoc booking metadata.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  arInvoices,
  billingAccounts,
  invoiceEvents,
  purchaseOrders,
} = dbPackage

const billingAccountBodySchema = z.object({
  name: z.string().min(1).max(220),
  accountType: z.enum(['user', 'group_account', 'biz']),
  status: z.enum(['active', 'suspended', 'closed']).default('active'),
  counterpartyBizId: z.string().optional(),
  counterpartyUserId: z.string().optional(),
  counterpartyGroupAccountId: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  creditLimitMinor: z.number().int().min(0).optional(),
  paymentTermsDays: z.number().int().min(0).default(0),
  taxProfile: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  const count = [value.counterpartyBizId, value.counterpartyUserId, value.counterpartyGroupAccountId].filter(Boolean).length
  if (count !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Exactly one counterparty pointer is required.' })
  }
})

const purchaseOrderBodySchema = z.object({
  billingAccountId: z.string().min(1),
  poNumber: z.string().min(1).max(120),
  status: z.enum(['draft', 'issued', 'accepted', 'partially_billed', 'closed', 'cancelled']).default('issued'),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  authorizedAmountMinor: z.number().int().min(0),
  billedAmountMinor: z.number().int().min(0).default(0),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const invoiceBodySchema = z.object({
  billingAccountId: z.string().min(1),
  purchaseOrderId: z.string().optional(),
  invoiceNumber: z.string().min(1).max(120),
  status: z.enum(['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'voided', 'in_dispute', 'written_off']).default('issued'),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  subtotalMinor: z.number().int().min(0),
  taxMinor: z.number().int().min(0).default(0),
  feeMinor: z.number().int().min(0).default(0),
  discountMinor: z.number().int().min(0).default(0),
  totalMinor: z.number().int().min(0).optional(),
  outstandingMinor: z.number().int().min(0).optional(),
  issuedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
  voidedAt: z.string().datetime().optional(),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const invoicePatchBodySchema = invoiceBodySchema.partial()

const invoiceEventBodySchema = z.object({
  eventType: z.enum(['created', 'issued', 'sent', 'viewed', 'payment_recorded', 'partial_payment', 'voided', 'disputed', 'resolved', 'note']),
  amountMinor: z.number().int().min(0).optional(),
  happenedAt: z.string().datetime().optional(),
  note: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

function computeInvoiceTotal(input: { subtotalMinor: number; taxMinor: number; feeMinor: number; discountMinor: number }) {
  return input.subtotalMinor + input.taxMinor + input.feeMinor - input.discountMinor
}

export const receivableRoutes = new Hono()

receivableRoutes.get(
  '/bizes/:bizId/billing-accounts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.billingAccounts.findMany({
      where: eq(billingAccounts.bizId, bizId),
      orderBy: [asc(billingAccounts.name)],
    })
    return ok(c, rows)
  },
)

receivableRoutes.post(
  '/bizes/:bizId/billing-accounts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = billingAccountBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(billingAccounts).values({
      bizId,
      name: sanitizePlainText(parsed.data.name),
      accountType: parsed.data.accountType,
      status: parsed.data.status,
      counterpartyBizId: parsed.data.counterpartyBizId ?? null,
      counterpartyUserId: parsed.data.counterpartyUserId ?? null,
      counterpartyGroupAccountId: parsed.data.counterpartyGroupAccountId ?? null,
      currency: parsed.data.currency,
      creditLimitMinor: parsed.data.creditLimitMinor ?? null,
      paymentTermsDays: parsed.data.paymentTermsDays,
      taxProfile: sanitizeUnknown(parsed.data.taxProfile ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()
    return ok(c, created, 201)
  },
)

receivableRoutes.get(
  '/bizes/:bizId/purchase-orders',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.purchaseOrders.findMany({
      where: eq(purchaseOrders.bizId, bizId),
      orderBy: [desc(purchaseOrders.issuedAt)],
    })
    return ok(c, rows)
  },
)

receivableRoutes.post(
  '/bizes/:bizId/purchase-orders',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = purchaseOrderBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(purchaseOrders).values({
      bizId,
      billingAccountId: parsed.data.billingAccountId,
      poNumber: sanitizePlainText(parsed.data.poNumber),
      status: parsed.data.status,
      currency: parsed.data.currency,
      authorizedAmountMinor: parsed.data.authorizedAmountMinor,
      billedAmountMinor: parsed.data.billedAmountMinor,
      issuedAt: parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()
    return ok(c, created, 201)
  },
)

receivableRoutes.get(
  '/bizes/:bizId/ar-invoices',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.arInvoices.findMany({
      where: eq(arInvoices.bizId, bizId),
      orderBy: [desc(arInvoices.issuedAt)],
    })
    return ok(c, rows)
  },
)

receivableRoutes.post(
  '/bizes/:bizId/ar-invoices',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = invoiceBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const billingAccount = await db.query.billingAccounts.findFirst({
      where: and(eq(billingAccounts.bizId, bizId), eq(billingAccounts.id, parsed.data.billingAccountId)),
    })
    if (!billingAccount) return fail(c, 'NOT_FOUND', 'Billing account not found.', 404)

    const totalMinor = parsed.data.totalMinor ?? computeInvoiceTotal(parsed.data)
    const outstandingMinor = parsed.data.outstandingMinor ?? totalMinor
    const approvalOverride =
      typeof parsed.data.metadata?.approvalOverride === 'boolean'
        ? parsed.data.metadata.approvalOverride
        : false

    if (billingAccount.creditLimitMinor !== null && billingAccount.creditLimitMinor !== undefined && !approvalOverride) {
      const existingInvoices = await db.query.arInvoices.findMany({
        where: and(eq(arInvoices.bizId, bizId), eq(arInvoices.billingAccountId, parsed.data.billingAccountId)),
        columns: { outstandingMinor: true, status: true },
      })
      const activeOutstandingMinor = existingInvoices
        .filter((row) => row.status !== 'voided' && row.status !== 'paid' && row.status !== 'written_off')
        .reduce((sum, row) => sum + Number(row.outstandingMinor ?? 0), 0)
      if (activeOutstandingMinor + outstandingMinor > billingAccount.creditLimitMinor) {
        return fail(c, 'CREDIT_LIMIT_EXCEEDED', 'Invoice exceeds billing-account credit limit.', 409, {
          creditLimitMinor: billingAccount.creditLimitMinor,
          activeOutstandingMinor,
          attemptedOutstandingMinor: outstandingMinor,
        })
      }
    }

    const [created] = await db.insert(arInvoices).values({
      bizId,
      billingAccountId: parsed.data.billingAccountId,
      purchaseOrderId: parsed.data.purchaseOrderId ?? null,
      invoiceNumber: sanitizePlainText(parsed.data.invoiceNumber),
      status: parsed.data.status,
      currency: parsed.data.currency,
      subtotalMinor: parsed.data.subtotalMinor,
      taxMinor: parsed.data.taxMinor,
      feeMinor: parsed.data.feeMinor,
      discountMinor: parsed.data.discountMinor,
      totalMinor,
      outstandingMinor,
      issuedAt: parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : null,
      voidedAt: parsed.data.voidedAt ? new Date(parsed.data.voidedAt) : null,
      notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    await db.insert(invoiceEvents).values({
      bizId,
      arInvoiceId: created.id,
      eventType: 'created',
      actorUserId: getCurrentUser(c)?.id ?? null,
      note: 'Invoice created through API.',
      metadata: { source: 'receivables.create_invoice' },
    })

    return ok(c, created, 201)
  },
)

receivableRoutes.get(
  '/bizes/:bizId/ar-invoices/:invoiceId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, invoiceId } = c.req.param()
    const invoice = await db.query.arInvoices.findFirst({
      where: and(eq(arInvoices.bizId, bizId), eq(arInvoices.id, invoiceId)),
    })
    if (!invoice) return fail(c, 'NOT_FOUND', 'Invoice not found.', 404)

    const events = await db.query.invoiceEvents.findMany({
      where: and(eq(invoiceEvents.bizId, bizId), eq(invoiceEvents.arInvoiceId, invoiceId)),
      orderBy: [asc(invoiceEvents.happenedAt)],
    })

    return ok(c, { invoice, events })
  },
)

receivableRoutes.patch(
  '/bizes/:bizId/ar-invoices/:invoiceId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, invoiceId } = c.req.param()
    const parsed = invoicePatchBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.arInvoices.findFirst({
      where: and(eq(arInvoices.bizId, bizId), eq(arInvoices.id, invoiceId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Invoice not found.', 404)

    const subtotalMinor = parsed.data.subtotalMinor ?? existing.subtotalMinor
    const taxMinor = parsed.data.taxMinor ?? existing.taxMinor
    const feeMinor = parsed.data.feeMinor ?? existing.feeMinor
    const discountMinor = parsed.data.discountMinor ?? existing.discountMinor
    const totalMinor = parsed.data.totalMinor ?? computeInvoiceTotal({ subtotalMinor, taxMinor, feeMinor, discountMinor })
    const outstandingMinor = parsed.data.outstandingMinor ?? existing.outstandingMinor

    /**
     * Once an invoice is confirmed beyond draft, currency becomes part of the
     * financial truth. Changing it later would break replayability for FX/tax.
     */
    if (
      parsed.data.currency !== undefined &&
      parsed.data.currency !== existing.currency &&
      existing.status !== 'draft'
    ) {
      return fail(c, 'INVOICE_CURRENCY_LOCKED', 'Invoice currency is locked after confirmation.', 409, {
        invoiceId,
        existingCurrency: existing.currency,
        attemptedCurrency: parsed.data.currency,
        status: existing.status,
      })
    }

    const [updated] = await db.update(arInvoices).set({
      billingAccountId: parsed.data.billingAccountId ?? undefined,
      purchaseOrderId: parsed.data.purchaseOrderId ?? undefined,
      invoiceNumber: parsed.data.invoiceNumber ? sanitizePlainText(parsed.data.invoiceNumber) : undefined,
      status: parsed.data.status ?? undefined,
      currency: parsed.data.currency ?? undefined,
      subtotalMinor,
      taxMinor,
      feeMinor,
      discountMinor,
      totalMinor,
      outstandingMinor,
      issuedAt: parsed.data.issuedAt === undefined ? undefined : parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null,
      dueAt: parsed.data.dueAt === undefined ? undefined : parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      paidAt: parsed.data.paidAt === undefined ? undefined : parsed.data.paidAt ? new Date(parsed.data.paidAt) : null,
      voidedAt: parsed.data.voidedAt === undefined ? undefined : parsed.data.voidedAt ? new Date(parsed.data.voidedAt) : null,
      notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : undefined,
      metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
    }).where(and(eq(arInvoices.bizId, bizId), eq(arInvoices.id, invoiceId))).returning()

    return ok(c, updated)
  },
)

receivableRoutes.post(
  '/bizes/:bizId/ar-invoices/:invoiceId/events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, invoiceId } = c.req.param()
    const parsed = invoiceEventBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const invoice = await db.query.arInvoices.findFirst({
      where: and(eq(arInvoices.bizId, bizId), eq(arInvoices.id, invoiceId)),
      columns: { id: true },
    })
    if (!invoice) return fail(c, 'NOT_FOUND', 'Invoice not found.', 404)

    const [created] = await db.insert(invoiceEvents).values({
      bizId,
      arInvoiceId: invoiceId,
      eventType: parsed.data.eventType,
      amountMinor: parsed.data.amountMinor ?? null,
      happenedAt: parsed.data.happenedAt ? new Date(parsed.data.happenedAt) : new Date(),
      actorUserId: getCurrentUser(c)?.id ?? null,
      note: parsed.data.note ? sanitizePlainText(parsed.data.note) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)
