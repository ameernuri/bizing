/**
 * Payments routes (biz + customer booking surfaces).
 *
 * ELI5:
 * - Public route lets a customer pay for their own booking using split tender.
 * - Biz routes let operators/auditors inspect payment intent state and the
 *   immutable transaction trail that proves "who paid what and how".
 *
 * Design intent:
 * - No direct DB access by agents or UI clients.
 * - Money flows are persisted through first-class payment tables:
 *   payment_intents -> payment_intent_tenders -> payment_*_line_allocations
 *   plus immutable payment_transactions.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  bookingOrders,
  bookingOrderLines,
  paymentProcessorAccounts,
  paymentMethods,
  paymentIntents,
  paymentIntentEvents,
  paymentIntentTenders,
  paymentIntentLineAllocations,
  paymentTransactions,
  paymentTransactionLineAllocations,
} = dbPackage

const paymentMethodTypeValues = [
  'card',
  'cash',
  'bank_transfer',
  'wallet',
  'gift_card',
  'external_channel_credit',
  'custom',
] as const

const listPaymentIntentsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z
    .enum([
      'requires_payment_method',
      'requires_confirmation',
      'requires_capture',
      'processing',
      'succeeded',
      'partially_paid',
      'failed',
      'cancelled',
      'refunded',
    ])
    .optional(),
  bookingOrderId: z.string().optional(),
  customerUserId: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

const advancedTenderSchema = z.object({
  methodType: z.enum(paymentMethodTypeValues),
  allocatedMinor: z.number().int().positive(),
  provider: z.string().min(1).max(80).optional(),
  providerMethodRef: z.string().min(1).max(200).optional(),
  label: z.string().min(1).max(120).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const advancedPaymentBodySchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  tipMinor: z.number().int().min(0).default(0),
  tenders: z.array(advancedTenderSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Guarantees a deterministic routing account for simulated gateway writes.
 *
 * Why this helper matters:
 * - payment_intents/transactions can reference one processor account,
 * - this avoids null-routing in test flows while keeping real integrations
 *   free to replace routing later.
 */
async function getOrCreateDefaultProcessorAccount(bizId: string) {
  const existing = await db.query.paymentProcessorAccounts.findFirst({
    where: and(
      eq(paymentProcessorAccounts.bizId, bizId),
      eq(paymentProcessorAccounts.isDefault, true),
      eq(paymentProcessorAccounts.status, 'active'),
    ),
    orderBy: [desc(paymentProcessorAccounts.id)],
  })
  if (existing) return existing

  const [created] = await db
    .insert(paymentProcessorAccounts)
    .values({
      bizId,
      providerKey: 'bizing_platform',
      processorAccountRef: `platform-${bizId}`,
      status: 'active',
      ownershipModel: 'platform_managed',
      commerceModel: 'merchant_of_record',
      isDefault: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      supportsSplitTender: true,
      supportsDisputes: true,
      supportsRefunds: true,
      configuration: { mode: 'simulated' },
      capabilities: { simulated: true },
      metadata: { source: 'payments-route' },
    })
    .returning()

  return created
}

/**
 * Ensures one booking has at least one payable positive line row.
 *
 * Why this helper exists:
 * - allocation tables work at line level for exact traceability,
 * - many early booking flows create booking_orders without explicit lines,
 * - we synthesize a canonical base line so payment line allocations are valid.
 */
async function ensureBaseBookingLine(input: {
  bizId: string
  bookingOrderId: string
  subtotalMinor: number
  totalMinor: number
  currency: string
}) {
  const rows = await db.query.bookingOrderLines.findMany({
    where: and(
      eq(bookingOrderLines.bizId, input.bizId),
      eq(bookingOrderLines.bookingOrderId, input.bookingOrderId),
    ),
    orderBy: [asc(bookingOrderLines.id)],
  })

  if (rows.length > 0) return rows

  const baseAmount = Math.max(0, input.subtotalMinor || input.totalMinor)
  if (baseAmount <= 0) return rows

  const [created] = await db
    .insert(bookingOrderLines)
    .values({
      bizId: input.bizId,
      bookingOrderId: input.bookingOrderId,
      lineType: 'offer_base',
      label: `Booking total (${input.currency})`,
      quantity: 1,
      unitAmountMinor: baseAmount,
      lineTotalMinor: baseAmount,
      pricingDetail: { source: 'auto_seed' },
    })
    .returning()

  return [created]
}

type AllocationPlanRow = {
  tenderIndex: number
  bookingOrderLineId: string
  allocatedMinor: number
}

/**
 * Builds deterministic tender->line allocation rows.
 *
 * Strategy:
 * - consume each tender amount left-to-right,
 * - fill line totals top-to-bottom,
 * - reject if total tender amount exceeds payable positive line capacity.
 */
function buildAllocationPlan(input: {
  tenders: Array<{ allocatedMinor: number }>
  lines: Array<{ id: string; lineTotalMinor: number }>
}) {
  const lineRemainders = input.lines
    .filter((line) => line.lineTotalMinor > 0)
    .map((line) => ({ lineId: line.id, remainingMinor: line.lineTotalMinor }))

  const capacityMinor = lineRemainders.reduce((sum, row) => sum + row.remainingMinor, 0)
  const allocatedMinor = input.tenders.reduce((sum, tender) => sum + tender.allocatedMinor, 0)
  if (allocatedMinor > capacityMinor) {
    throw new Error(
      `Tender total (${allocatedMinor}) exceeds payable line capacity (${capacityMinor}).`,
    )
  }

  const plan: AllocationPlanRow[] = []

  input.tenders.forEach((tender, tenderIndex) => {
    let tenderRemaining = tender.allocatedMinor
    for (const line of lineRemainders) {
      if (tenderRemaining <= 0) break
      if (line.remainingMinor <= 0) continue
      const applied = Math.min(tenderRemaining, line.remainingMinor)
      if (applied <= 0) continue
      plan.push({
        tenderIndex,
        bookingOrderLineId: line.lineId,
        allocatedMinor: applied,
      })
      line.remainingMinor -= applied
      tenderRemaining -= applied
    }
    if (tenderRemaining > 0) {
      throw new Error(
        `Could not allocate ${tenderRemaining} minor units for tender index ${tenderIndex}.`,
      )
    }
  })

  return plan
}

function autoProviderForMethod(methodType: (typeof paymentMethodTypeValues)[number]) {
  if (methodType === 'cash') return 'manual'
  if (methodType === 'gift_card') return 'gift_ledger'
  return 'simulated_gateway'
}

export const paymentRoutes = new Hono()

/**
 * Customer payment endpoint for advanced (split tender) checkout.
 *
 * Security:
 * - authenticated customer only,
 * - customer can only pay for their own booking order row.
 */
paymentRoutes.post(
  '/public/bizes/:bizId/booking-orders/:bookingOrderId/payments/advanced',
  requireAuth,
  async (c) => {
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)

    const bizId = c.req.param('bizId')
    const bookingOrderId = c.req.param('bookingOrderId')
    const body = await c.req.json().catch(() => null)
    const parsed = advancedPaymentBodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)
    if (booking.customerUserId !== user.id) {
      return fail(c, 'FORBIDDEN', 'You can only pay for your own booking orders.', 403)
    }

    const tipMinor = parsed.data.tipMinor ?? 0
    const currency = parsed.data.currency ?? booking.currency
    const tenderTotalMinor = parsed.data.tenders.reduce((sum, row) => sum + row.allocatedMinor, 0)
    const expectedTotalMinor = booking.totalMinor + tipMinor
    if (tenderTotalMinor !== expectedTotalMinor) {
      return fail(
        c,
        'AMOUNT_MISMATCH',
        `Tender total (${tenderTotalMinor}) must equal expected amount (${expectedTotalMinor}).`,
        409,
      )
    }

    const processor = await getOrCreateDefaultProcessorAccount(bizId)
    const existingLines = await ensureBaseBookingLine({
      bizId,
      bookingOrderId,
      subtotalMinor: booking.subtotalMinor,
      totalMinor: booking.totalMinor,
      currency: booking.currency,
    })

    const allLines = [...existingLines]
    if (tipMinor > 0) {
      const [tipLine] = await db
        .insert(bookingOrderLines)
        .values({
          bizId,
          bookingOrderId,
          lineType: 'tip',
          label: 'Tip',
          quantity: 1,
          unitAmountMinor: tipMinor,
          lineTotalMinor: tipMinor,
          pricingDetail: { source: 'advanced_payment_tip' },
        })
        .returning()
      allLines.push(tipLine)
    }

    const allocationPlan = buildAllocationPlan({
      tenders: parsed.data.tenders.map((row) => ({ allocatedMinor: row.allocatedMinor })),
      lines: allLines.map((line) => ({ id: line.id, lineTotalMinor: line.lineTotalMinor })),
    })

    const [intent] = await db
      .insert(paymentIntents)
      .values({
        bizId,
        bookingOrderId,
        paymentProcessorAccountId: processor.id,
        status: 'succeeded',
        currency,
        amountTargetMinor: expectedTotalMinor,
        amountCapturedMinor: expectedTotalMinor,
        amountRefundedMinor: 0,
        requiresCapture: false,
        source: 'public_checkout',
        capturedAt: new Date(),
        amountSnapshot: {
          bookingTotalMinor: booking.totalMinor,
          tipMinor,
          expectedTotalMinor,
        },
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    await db.insert(paymentIntentEvents).values([
      {
        bizId,
        paymentIntentId: intent.id,
        eventType: 'created',
        actorUserId: user.id,
        details: { source: 'public_checkout' },
      },
      {
        bizId,
        paymentIntentId: intent.id,
        eventType: 'captured',
        previousStatus: 'requires_confirmation',
        nextStatus: 'succeeded',
        previousAmountCapturedMinor: 0,
        nextAmountCapturedMinor: expectedTotalMinor,
        actorUserId: user.id,
        details: { source: 'public_checkout' },
      },
    ])

    const createdTenders: Array<{
      tenderId: string
      paymentMethodId: string
      methodType: (typeof paymentMethodTypeValues)[number]
      allocatedMinor: number
      sortOrder: number
    }> = []

    for (let index = 0; index < parsed.data.tenders.length; index += 1) {
      const tender = parsed.data.tenders[index]
      const provider = tender.provider ?? autoProviderForMethod(tender.methodType)
      const providerMethodRef =
        tender.providerMethodRef ?? `${tender.methodType}-${Date.now()}-${index}-${crypto.randomUUID()}`
      const [method] = await db
        .insert(paymentMethods)
        .values({
          bizId,
          /**
           * We intentionally keep checkout-generated methods unowned so this
           * endpoint can simulate split tender even on databases that still
           * enforce a strict one-method-per-user unique index shape.
           *
           * Customer linkage remains traceable through:
           * - booking_order.customer_user_id
           * - payment_intent + payment_transaction rows
           * - method metadata checkoutUserId
           */
          paymentProcessorAccountId: processor.id,
          type: tender.methodType,
          provider,
          providerMethodRef,
          label: tender.label ?? `${tender.methodType.toUpperCase()} Tender`,
          isDefault: false,
          isActive: true,
          metadata: {
            ...(tender.metadata ?? {}),
            checkoutUserId: user.id,
          },
        })
        .returning()

      const [intentTender] = await db
        .insert(paymentIntentTenders)
        .values({
          bizId,
          paymentIntentId: intent.id,
          paymentMethodId: method.id,
          methodType: tender.methodType,
          allocatedMinor: tender.allocatedMinor,
          capturedMinor: tender.allocatedMinor,
          refundedMinor: 0,
          sortOrder: index + 1,
          metadata: tender.metadata ?? {},
        })
        .returning()

      createdTenders.push({
        tenderId: intentTender.id,
        paymentMethodId: method.id,
        methodType: tender.methodType,
        allocatedMinor: tender.allocatedMinor,
        sortOrder: index + 1,
      })
    }

    const tenderIdByIndex = new Map<number, string>()
    const paymentMethodIdByIndex = new Map<number, string>()
    createdTenders.forEach((row) => {
      tenderIdByIndex.set(row.sortOrder - 1, row.tenderId)
      paymentMethodIdByIndex.set(row.sortOrder - 1, row.paymentMethodId)
    })

    const [lineAllocationRows] = await Promise.all([
      db
        .insert(paymentIntentLineAllocations)
        .values(
          allocationPlan.map((plan, idx) => ({
            bizId,
            paymentIntentId: intent.id,
            paymentIntentTenderId: tenderIdByIndex.get(plan.tenderIndex)!,
            bookingOrderId,
            bookingOrderLineId: plan.bookingOrderLineId,
            allocatedMinor: plan.allocatedMinor,
            capturedMinor: plan.allocatedMinor,
            refundedMinor: 0,
            sortOrder: idx + 1,
            metadata: {},
          })),
        )
        .returning(),
      db
        .update(bookingOrders)
        .set({
          status:
            booking.status === 'draft' ||
            booking.status === 'quoted' ||
            booking.status === 'awaiting_payment'
              ? 'confirmed'
              : booking.status,
        })
        .where(and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId))),
    ])

    const transactionRows = await db
      .insert(paymentTransactions)
      .values(
        parsed.data.tenders.map((tender, index) => ({
          bizId,
          paymentIntentId: intent.id,
          bookingOrderId,
          paymentIntentTenderId: tenderIdByIndex.get(index)!,
          paymentMethodId: paymentMethodIdByIndex.get(index),
          paymentProcessorAccountId: processor.id,
          type: 'charge' as const,
          status: 'succeeded' as const,
          amountMinor: tender.allocatedMinor,
          currency,
          occurredAt: new Date(),
          providerPayload: { source: 'simulated_advanced_checkout' },
          metadata: {
            tenderIndex: index,
          },
        })),
      )
      .returning()

    const transactionByTenderId = new Map<string, string>()
    transactionRows.forEach((row) => {
      if (row.paymentIntentTenderId) {
        transactionByTenderId.set(row.paymentIntentTenderId, row.id)
      }
    })

    const planByTenderAndLine = new Map<string, string>()
    lineAllocationRows.forEach((row) => {
      planByTenderAndLine.set(`${row.paymentIntentTenderId}:${row.bookingOrderLineId}`, row.id)
    })

    await db.insert(paymentTransactionLineAllocations).values(
      allocationPlan.map((plan) => {
        const tenderId = tenderIdByIndex.get(plan.tenderIndex)!
        const transactionId = transactionByTenderId.get(tenderId)
        const planId = planByTenderAndLine.get(`${tenderId}:${plan.bookingOrderLineId}`)
        if (!transactionId || !planId) {
          throw new Error('Failed to resolve transaction/plan link for line allocation.')
        }
        return {
          bizId,
          paymentTransactionId: transactionId,
          paymentIntentId: intent.id,
          paymentIntentTenderId: tenderId,
          bookingOrderId,
          bookingOrderLineId: plan.bookingOrderLineId,
          paymentIntentLineAllocationId: planId,
          amountMinor: plan.allocatedMinor,
          occurredAt: new Date(),
          metadata: {},
        }
      }),
    )

    return ok(
      c,
      {
        paymentIntentId: intent.id,
        bookingOrderId,
        status: intent.status,
        currency,
        amountTargetMinor: intent.amountTargetMinor,
        amountCapturedMinor: intent.amountCapturedMinor,
        tenderCount: createdTenders.length,
        lineAllocationCount: lineAllocationRows.length,
        transactionCount: transactionRows.length,
      },
      201,
    )
  },
)

paymentRoutes.get(
  '/bizes/:bizId/payment-intents',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listPaymentIntentsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const pageNum = parsePositiveInt(parsed.data.page, 1)
    const perPageNum = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const orderByExpr =
      parsed.data.sortOrder === 'asc' ? asc(paymentIntents.id) : desc(paymentIntents.id)

    const where = and(
      eq(paymentIntents.bizId, bizId),
      parsed.data.status ? eq(paymentIntents.status, parsed.data.status) : undefined,
      parsed.data.bookingOrderId ? eq(paymentIntents.bookingOrderId, parsed.data.bookingOrderId) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.paymentIntents.findMany({
        where,
        orderBy: orderByExpr,
        limit: perPageNum,
        offset: (pageNum - 1) * perPageNum,
      }),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(paymentIntents)
        .where(where),
    ])

    let filteredRows = rows
    if (parsed.data.customerUserId) {
      const orderIds = rows
        .map((row) => row.bookingOrderId)
        .filter((value): value is string => Boolean(value))
      if (orderIds.length === 0) {
        filteredRows = []
      } else {
        const ownedOrders = await db.query.bookingOrders.findMany({
          where: and(
            eq(bookingOrders.bizId, bizId),
            eq(bookingOrders.customerUserId, parsed.data.customerUserId),
            inArray(bookingOrders.id, orderIds),
          ),
          columns: { id: true },
        })
        const ownedIds = new Set(ownedOrders.map((row) => row.id))
        filteredRows = rows.filter((row) => row.bookingOrderId && ownedIds.has(row.bookingOrderId))
      }
    }

    const total = countRows[0]?.count ?? 0
    return ok(c, filteredRows, 200, {
      pagination: {
        page: pageNum,
        perPage: perPageNum,
        total,
        hasMore: pageNum * perPageNum < total,
      },
    })
  },
)

paymentRoutes.get(
  '/bizes/:bizId/payment-intents/:paymentIntentId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const paymentIntentId = c.req.param('paymentIntentId')

    const intent = await db.query.paymentIntents.findFirst({
      where: and(eq(paymentIntents.bizId, bizId), eq(paymentIntents.id, paymentIntentId)),
    })
    if (!intent) return fail(c, 'NOT_FOUND', 'Payment intent not found.', 404)

    const [tenders, lineAllocations, transactions, transactionLineAllocations] = await Promise.all([
      db.query.paymentIntentTenders.findMany({
        where: and(
          eq(paymentIntentTenders.bizId, bizId),
          eq(paymentIntentTenders.paymentIntentId, paymentIntentId),
        ),
        orderBy: [asc(paymentIntentTenders.sortOrder)],
      }),
      db.query.paymentIntentLineAllocations.findMany({
        where: and(
          eq(paymentIntentLineAllocations.bizId, bizId),
          eq(paymentIntentLineAllocations.paymentIntentId, paymentIntentId),
        ),
        orderBy: [asc(paymentIntentLineAllocations.sortOrder)],
      }),
      db.query.paymentTransactions.findMany({
        where: and(
          eq(paymentTransactions.bizId, bizId),
          eq(paymentTransactions.paymentIntentId, paymentIntentId),
        ),
        orderBy: [asc(paymentTransactions.occurredAt)],
      }),
      db.query.paymentTransactionLineAllocations.findMany({
        where: and(
          eq(paymentTransactionLineAllocations.bizId, bizId),
          eq(paymentTransactionLineAllocations.paymentIntentId, paymentIntentId),
        ),
        orderBy: [asc(paymentTransactionLineAllocations.occurredAt)],
      }),
    ])

    return ok(c, {
      intent,
      tenders,
      lineAllocations,
      transactions,
      transactionLineAllocations,
    })
  },
)
