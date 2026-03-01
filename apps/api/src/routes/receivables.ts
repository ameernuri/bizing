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
  autocollectionAttempts,
  billingAccounts,
  billingAccountAutopayRules,
  invoiceEvents,
  purchaseOrders,
  installmentPlans,
  installmentScheduleItems,
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
  paymentTermsDays: z.number().int().min(0).optional(),
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

const installmentPlanBodySchema = z.object({
  arInvoiceId: z.string().min(1),
  version: z.number().int().min(1).optional(),
  isCurrent: z.boolean().optional(),
  status: z.string().max(40).optional(),
  statusConfigValueId: z.string().optional().nullable(),
  planKind: z.string().max(40).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  totalPlannedMinor: z.number().int().min(0).optional(),
  totalPaidMinor: z.number().int().min(0).optional(),
  totalWaivedMinor: z.number().int().min(0).optional(),
  totalFailedMinor: z.number().int().min(0).optional(),
  installmentCount: z.number().int().min(1).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  nextDueAt: z.string().datetime().optional().nullable(),
  autoAdvance: z.boolean().optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const installmentItemBodySchema = z.object({
  sequenceNo: z.number().int().min(1),
  dueAt: z.string().datetime(),
  status: z.string().max(40).optional(),
  statusConfigValueId: z.string().optional().nullable(),
  amountMinor: z.number().int().min(0),
  paidMinor: z.number().int().min(0).optional(),
  waivedMinor: z.number().int().min(0).optional(),
  failedMinor: z.number().int().min(0).optional(),
  lateFeeMinor: z.number().int().min(0).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  attemptCount: z.number().int().min(0).optional(),
  lastAttemptAt: z.string().datetime().optional().nullable(),
  paidAt: z.string().datetime().optional().nullable(),
  delinquentAt: z.string().datetime().optional().nullable(),
  paymentIntentId: z.string().optional().nullable(),
  paymentTransactionId: z.string().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const autopayRuleBodySchema = z.object({
  billingAccountId: z.string().min(1),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  name: z.string().min(1).max(220),
  priority: z.number().int().min(0).default(100),
  isDefault: z.boolean().default(false),
  paymentMethodId: z.string().optional().nullable(),
  targetScope: z.enum(['invoice', 'installment', 'both']).default('both'),
  runOffsetDays: z.number().int().min(-90).max(90).default(0),
  maxAttemptsPerItem: z.number().int().min(1).default(3),
  retryIntervalHours: z.number().int().min(1).default(24),
  minimumAmountMinor: z.number().int().min(0).default(0),
  maximumAmountMinor: z.number().int().min(0).optional().nullable(),
  allowPartialCollection: z.boolean().default(false),
  collectionPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const autocollectionAttemptBodySchema = z.object({
  billingAccountAutopayRuleId: z.string().min(1),
  billingAccountId: z.string().min(1),
  arInvoiceId: z.string().optional().nullable(),
  installmentScheduleItemId: z.string().optional().nullable(),
  status: z.string().max(40).default('queued'),
  statusConfigValueId: z.string().optional().nullable(),
  attemptNumber: z.number().int().min(1).default(1),
  scheduledFor: z.string().datetime(),
  startedAt: z.string().datetime().optional().nullable(),
  finishedAt: z.string().datetime().optional().nullable(),
  paymentIntentId: z.string().optional().nullable(),
  paymentTransactionId: z.string().optional().nullable(),
  attemptedAmountMinor: z.number().int().min(0).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  failureCode: z.string().max(120).optional().nullable(),
  failureMessage: z.string().max(4000).optional().nullable(),
  idempotencyKey: z.string().max(160).optional().nullable(),
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

    const issuedAt = parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : new Date()
    const paymentTermsDays = parsed.data.paymentTermsDays ?? billingAccount.paymentTermsDays ?? 0
    const dueAt =
      parsed.data.dueAt
        ? new Date(parsed.data.dueAt)
        : paymentTermsDays > 0
          ? new Date(issuedAt.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000)
          : null

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
      issuedAt,
      dueAt,
      paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : null,
      voidedAt: parsed.data.voidedAt ? new Date(parsed.data.voidedAt) : null,
      notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
      metadata: sanitizeUnknown({
        ...(parsed.data.metadata ?? {}),
        paymentTermsDays,
      }),
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

receivableRoutes.get(
  '/bizes/:bizId/installment-plans',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const arInvoiceId = c.req.query('arInvoiceId')
    const rows = await db.query.installmentPlans.findMany({
      where: and(
        eq(installmentPlans.bizId, bizId),
        arInvoiceId ? eq(installmentPlans.arInvoiceId, arInvoiceId) : undefined,
      ),
      orderBy: [desc(installmentPlans.startsAt), desc(installmentPlans.version)],
    })
    return ok(c, rows)
  },
)

receivableRoutes.post(
  '/bizes/:bizId/installment-plans',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = installmentPlanBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid installment plan body.', 400, parsed.error.flatten())

    const invoice = await db.query.arInvoices.findFirst({
      where: and(eq(arInvoices.bizId, bizId), eq(arInvoices.id, parsed.data.arInvoiceId)),
      columns: { id: true, currency: true, totalMinor: true },
    })
    if (!invoice) return fail(c, 'NOT_FOUND', 'Invoice not found.', 404)

    const [created] = await db.insert(installmentPlans).values({
      bizId,
      arInvoiceId: parsed.data.arInvoiceId,
      version: parsed.data.version ?? 1,
      isCurrent: parsed.data.isCurrent ?? true,
      status: parsed.data.status ?? 'draft',
      statusConfigValueId: parsed.data.statusConfigValueId ?? null,
      planKind: parsed.data.planKind ?? 'custom_schedule',
      currency: parsed.data.currency ?? invoice.currency,
      totalPlannedMinor: parsed.data.totalPlannedMinor ?? invoice.totalMinor,
      totalPaidMinor: parsed.data.totalPaidMinor ?? 0,
      totalWaivedMinor: parsed.data.totalWaivedMinor ?? 0,
      totalFailedMinor: parsed.data.totalFailedMinor ?? 0,
      installmentCount: parsed.data.installmentCount ?? 1,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      nextDueAt: parsed.data.nextDueAt ? new Date(parsed.data.nextDueAt) : null,
      autoAdvance: parsed.data.autoAdvance ?? true,
      policySnapshot: sanitizeUnknown(parsed.data.policySnapshot ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

receivableRoutes.get(
  '/bizes/:bizId/installment-plans/:planId/items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, planId } = c.req.param()
    const rows = await db.query.installmentScheduleItems.findMany({
      where: and(eq(installmentScheduleItems.bizId, bizId), eq(installmentScheduleItems.installmentPlanId, planId)),
      orderBy: [asc(installmentScheduleItems.sequenceNo)],
    })
    return ok(c, rows)
  },
)

receivableRoutes.post(
  '/bizes/:bizId/installment-plans/:planId/items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, planId } = c.req.param()
    const parsed = installmentItemBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid installment item body.', 400, parsed.error.flatten())

    const plan = await db.query.installmentPlans.findFirst({
      where: and(eq(installmentPlans.bizId, bizId), eq(installmentPlans.id, planId)),
      columns: { id: true, currency: true },
    })
    if (!plan) return fail(c, 'NOT_FOUND', 'Installment plan not found.', 404)

    const [created] = await db.insert(installmentScheduleItems).values({
      bizId,
      installmentPlanId: planId,
      sequenceNo: parsed.data.sequenceNo,
      dueAt: new Date(parsed.data.dueAt),
      status: parsed.data.status ?? 'pending',
      statusConfigValueId: parsed.data.statusConfigValueId ?? null,
      amountMinor: parsed.data.amountMinor,
      paidMinor: parsed.data.paidMinor ?? 0,
      waivedMinor: parsed.data.waivedMinor ?? 0,
      failedMinor: parsed.data.failedMinor ?? 0,
      lateFeeMinor: parsed.data.lateFeeMinor ?? 0,
      currency: parsed.data.currency ?? plan.currency,
      attemptCount: parsed.data.attemptCount ?? 0,
      lastAttemptAt: parsed.data.lastAttemptAt ? new Date(parsed.data.lastAttemptAt) : null,
      paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : null,
      paymentIntentId: parsed.data.paymentIntentId ?? null,
      paymentTransactionId: parsed.data.paymentTransactionId ?? null,
      notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

receivableRoutes.get(
  '/bizes/:bizId/billing-account-autopay-rules',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const billingAccountId = c.req.query('billingAccountId')
    const rows = await db.query.billingAccountAutopayRules.findMany({
      where: and(
        eq(billingAccountAutopayRules.bizId, bizId),
        billingAccountId ? eq(billingAccountAutopayRules.billingAccountId, billingAccountId) : undefined,
      ),
      orderBy: [asc(billingAccountAutopayRules.billingAccountId), asc(billingAccountAutopayRules.priority)],
    })
    return ok(c, rows)
  },
)

receivableRoutes.post(
  '/bizes/:bizId/billing-account-autopay-rules',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = autopayRuleBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid autopay rule body.', 400, parsed.error.flatten())

    const [created] = await db.insert(billingAccountAutopayRules).values({
      bizId,
      billingAccountId: parsed.data.billingAccountId,
      status: parsed.data.status,
      name: sanitizePlainText(parsed.data.name),
      priority: parsed.data.priority,
      isDefault: parsed.data.isDefault,
      paymentMethodId: parsed.data.paymentMethodId ?? null,
      targetScope: parsed.data.targetScope,
      runOffsetDays: parsed.data.runOffsetDays,
      maxAttemptsPerItem: parsed.data.maxAttemptsPerItem,
      retryIntervalHours: parsed.data.retryIntervalHours,
      minimumAmountMinor: parsed.data.minimumAmountMinor,
      maximumAmountMinor: parsed.data.maximumAmountMinor ?? null,
      allowPartialCollection: parsed.data.allowPartialCollection,
      collectionPolicy: sanitizeUnknown(parsed.data.collectionPolicy ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()
    return ok(c, created, 201)
  },
)

receivableRoutes.get(
  '/bizes/:bizId/autocollection-attempts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const billingAccountId = c.req.query('billingAccountId')
    const arInvoiceId = c.req.query('arInvoiceId')
    const rows = await db.query.autocollectionAttempts.findMany({
      where: and(
        eq(autocollectionAttempts.bizId, bizId),
        billingAccountId ? eq(autocollectionAttempts.billingAccountId, billingAccountId) : undefined,
        arInvoiceId ? eq(autocollectionAttempts.arInvoiceId, arInvoiceId) : undefined,
      ),
      orderBy: [desc(autocollectionAttempts.scheduledFor), desc(autocollectionAttempts.attemptNumber)],
    })
    return ok(c, rows)
  },
)

receivableRoutes.post(
  '/bizes/:bizId/autocollection-attempts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = autocollectionAttemptBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid autocollection attempt body.', 400, parsed.error.flatten())

    const [created] = await db.insert(autocollectionAttempts).values({
      bizId,
      billingAccountAutopayRuleId: parsed.data.billingAccountAutopayRuleId,
      billingAccountId: parsed.data.billingAccountId,
      arInvoiceId: parsed.data.arInvoiceId ?? null,
      installmentScheduleItemId: parsed.data.installmentScheduleItemId ?? null,
      status: sanitizePlainText(parsed.data.status),
      statusConfigValueId: parsed.data.statusConfigValueId ?? null,
      attemptNumber: parsed.data.attemptNumber,
      scheduledFor: new Date(parsed.data.scheduledFor),
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
      finishedAt: parsed.data.finishedAt ? new Date(parsed.data.finishedAt) : null,
      paymentIntentId: parsed.data.paymentIntentId ?? null,
      paymentTransactionId: parsed.data.paymentTransactionId ?? null,
      attemptedAmountMinor: parsed.data.attemptedAmountMinor,
      currency: parsed.data.currency,
      failureCode: parsed.data.failureCode ?? null,
      failureMessage: parsed.data.failureMessage ? sanitizePlainText(parsed.data.failureMessage) : null,
      idempotencyKey: parsed.data.idempotencyKey ?? null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()
    return ok(c, created, 201)
  },
)
