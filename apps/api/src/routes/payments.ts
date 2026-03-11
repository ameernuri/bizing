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
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import {
  canUseStripeAutoTestCard,
  extractStripeChargeRef,
  getStripeClient,
  mapStripeIntentStatusToBizing,
  requireStripeClient,
} from '../services/stripe-payments.js'
import { requirePublicBizAccess } from './_public-biz-access.js'
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
  stripeWebhookEvents,
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
const refundPaymentBodySchema = z.object({
  amountMinor: z.number().int().positive(),
  reason: z.string().max(240).optional(),
  fallbackMode: z.string().max(120).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const stripeIntentBodySchema = z.object({
  /**
   * Optional explicit total.
   * If omitted, booking total (plus optional tip) is used.
   */
  amountMinor: z.number().int().positive().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  tipMinor: z.number().int().min(0).default(0),
  /**
   * Optional Stripe payment method (`pm_...`) for immediate confirmation.
   */
  paymentMethodRef: z.string().min(1).max(200).optional(),
  /**
   * If true, API asks Stripe to confirm immediately.
   * In local test mode, this can auto-fallback to Stripe test PM when no
   * paymentMethodRef is supplied.
   */
  confirmNow: z.boolean().default(true),
  /**
   * Optional idempotency key to safely retry the same intent request.
   */
  idempotencyKey: z.string().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
})

async function createPaymentRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
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
    bizId,
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

async function updatePaymentRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
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
    bizId,
    tableKey,
    operation: 'update',
    id,
    patch,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId ?? id,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) {
    return fail(c, result.code, result.message, result.httpStatus, result.details)
  }
  return result.row
}

/**
 * Guarantees a deterministic routing account for platform-managed Stripe-like writes.
 *
 * Why this helper matters:
 * - payment_intents/transactions can reference one processor account,
 * - this avoids null-routing in test flows while staying aligned with Bizing's
 *   default merchant-of-record model: platform-managed Stripe accounts first,
 *   custom processors optional later.
 */
async function getOrCreateDefaultProcessorAccount(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
): Promise<{ id: string }> {
  const stripeConfigured = Boolean(getStripeClient())
  const existing = await db.query.paymentProcessorAccounts.findFirst({
    where: and(
      eq(paymentProcessorAccounts.bizId, bizId),
      eq(paymentProcessorAccounts.isDefault, true),
      eq(paymentProcessorAccounts.status, 'active'),
    ),
    orderBy: [desc(paymentProcessorAccounts.id)],
  })
  if (existing) return { id: existing.id }

  const actionResult = await executeCrudRouteAction({
    c,
    bizId,
    tableKey: 'paymentProcessorAccounts',
    operation: 'create',
    data: {
      bizId,
      providerKey: 'stripe',
      processorAccountRef: `stripe-platform-${bizId}`,
      status: 'active',
      ownershipModel: 'platform_managed',
      commerceModel: 'merchant_of_record',
      isDefault: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      supportsSplitTender: true,
      supportsDisputes: true,
      supportsRefunds: true,
      configuration: {
        mode: stripeConfigured ? 'provider_stripe' : 'simulated',
        merchantOfRecord: 'bizing_platform',
      },
      capabilities: {
        simulated: !stripeConfigured,
        stripeConfigured,
        stripeCompatible: true,
      },
      metadata: { source: 'payments-route', defaultProvider: 'stripe' },
    },
    subjectType: 'payment_processor_account',
    displayName: 'Default Processor Account',
    metadata: { source: 'payments.getOrCreateDefaultProcessorAccount' },
  })
  if (!actionResult.ok) {
    throw new Error(actionResult.message)
  }
  const created = actionResult.row as Record<string, unknown> | null
  const createdId = created?.id
  if (typeof createdId !== 'string' || createdId.length === 0) {
    throw new Error('Failed to create default payment processor account.')
  }
  return { id: createdId }
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
  c: Parameters<typeof executeCrudRouteAction>[0]['c']
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

  const created = (await createPaymentRow(
    input.c,
    input.bizId,
    'bookingOrderLines',
    {
      bizId: input.bizId,
      bookingOrderId: input.bookingOrderId,
      lineType: 'offer_base',
      label: `Booking total (${input.currency})`,
      quantity: 1,
      unitAmountMinor: baseAmount,
      lineTotalMinor: baseAmount,
      pricingDetail: { source: 'auto_seed' },
    },
    {
      subjectType: 'booking_order_line',
      displayName: 'Auto Base Booking Line',
      metadata: { source: 'payments.ensureBaseBookingLine' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) {
    throw new Error('Failed to create auto base booking line.')
  }

  return [created as (typeof rows)[number]]
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

function mapBizingStatusToIntentEventType(
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_capture' | 'processing' | 'succeeded' | 'failed' | 'cancelled',
): 'created' | 'status_changed' | 'captured' | 'failed' | 'cancelled' | 'authorized' {
  if (status === 'succeeded') return 'captured'
  if (status === 'failed') return 'failed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'requires_capture') return 'authorized'
  if (status === 'requires_payment_method') return 'created'
  return 'status_changed'
}

function autoProviderForMethod(methodType: (typeof paymentMethodTypeValues)[number]) {
  if (methodType === 'cash') return 'manual'
  if (methodType === 'gift_card') return 'gift_ledger'
  return 'simulated_gateway'
}

/**
 * Creates one real Stripe payment intent and mirrors it into canonical Bizing payment tables.
 *
 * Scope guardrails:
 * - this route focuses on one Stripe-backed card tender for now,
 * - split tender across multiple processor-backed card legs can be added later,
 *   but this baseline gives a real provider integration today without breaking
 *   existing simulated multi-tender flows.
 */
async function createStripePaymentIntentForBooking(input: {
  c: Parameters<typeof executeCrudRouteAction>[0]['c']
  bizId: string
  bookingOrderId: string
  customerUserId: string
  amountMinor: number
  currency: string
  paymentMethodRef?: string
  confirmNow: boolean
  metadata?: Record<string, unknown>
  source: 'public_checkout' | 'operator_checkout'
  idempotencyKey?: string
}) {
  const stripe = requireStripeClient()
  const processor = await getOrCreateDefaultProcessorAccount(input.c, input.bizId)
  const shouldAutoConfirmWithTestCard =
    input.confirmNow && !input.paymentMethodRef && canUseStripeAutoTestCard()
  const confirmationMethodRef =
    input.paymentMethodRef ?? (shouldAutoConfirmWithTestCard ? 'pm_card_visa' : undefined)

  const createParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
    amount: input.amountMinor,
    currency: input.currency.toLowerCase(),
    metadata: {
      bizId: input.bizId,
      bookingOrderId: input.bookingOrderId,
      customerUserId: input.customerUserId,
      ...(input.metadata ?? {}),
    },
    automatic_payment_methods: input.paymentMethodRef ? undefined : { enabled: true },
  }

  if (confirmationMethodRef) {
    createParams.confirm = true
    createParams.payment_method = confirmationMethodRef
  }

  const stripeIntent = await stripe.paymentIntents.create(createParams, {
    idempotencyKey:
      input.idempotencyKey ??
      `bizing:${input.bizId}:${input.bookingOrderId}:${input.amountMinor}:${input.currency}`,
  })

  const mappedStatus = mapStripeIntentStatusToBizing(stripeIntent.status)
  const chargeRef = extractStripeChargeRef(stripeIntent)
  const amountCapturedMinor =
    mappedStatus === 'succeeded' ? Number(stripeIntent.amount_received ?? input.amountMinor) : 0

  const intentRow = await createPaymentRow(
    input.c,
    input.bizId,
    'paymentIntents',
    {
      bizId: input.bizId,
      bookingOrderId: input.bookingOrderId,
      paymentProcessorAccountId: processor.id,
      status: mappedStatus,
      currency: input.currency,
      amountTargetMinor: input.amountMinor,
      amountCapturedMinor,
      amountRefundedMinor: 0,
      requiresCapture: stripeIntent.capture_method === 'manual',
      providerIntentRef: stripeIntent.id,
      source: input.source,
      authorizedAt: mappedStatus === 'requires_capture' ? new Date() : null,
      capturedAt: mappedStatus === 'succeeded' ? new Date() : null,
      failedAt: mappedStatus === 'failed' ? new Date() : null,
      amountSnapshot: {
        provider: 'stripe',
        stripeStatus: stripeIntent.status,
        amountReceivedMinor: stripeIntent.amount_received ?? 0,
      },
      metadata: {
        ...(input.metadata ?? {}),
        stripeClientSecretPresent: Boolean(stripeIntent.client_secret),
      },
    },
    { subjectType: 'payment_intent', displayName: 'Stripe Payment Intent' },
  )
  if (intentRow instanceof Response) return intentRow

  const methodRef =
    (typeof stripeIntent.payment_method === 'string' && stripeIntent.payment_method.length > 0
      ? stripeIntent.payment_method
      : input.paymentMethodRef) ?? `stripe-pm-${Date.now()}-${crypto.randomUUID()}`

  const existingPaymentMethod = await db.query.paymentMethods.findFirst({
    where: and(
      eq(paymentMethods.bizId, input.bizId),
      eq(paymentMethods.provider, 'stripe'),
      eq(paymentMethods.providerMethodRef, methodRef),
    ),
  })

  const paymentMethodRow =
    existingPaymentMethod ??
    (await createPaymentRow(
      input.c,
      input.bizId,
      'paymentMethods',
      {
        bizId: input.bizId,
        ownerUserId: input.customerUserId,
        paymentProcessorAccountId: processor.id,
        type: 'card',
        provider: 'stripe',
        providerMethodRef: methodRef,
        label: 'Stripe Card',
        isDefault: false,
        isActive: true,
        metadata: {
          source: 'stripe_payment_intent',
        },
      },
      { subjectType: 'payment_method', displayName: 'Stripe Payment Method' },
    ))
  if (paymentMethodRow instanceof Response) return paymentMethodRow

  const tenderRow = await createPaymentRow(
    input.c,
    input.bizId,
    'paymentIntentTenders',
    {
      bizId: input.bizId,
      paymentIntentId: (intentRow as Record<string, unknown>).id as string,
      paymentMethodId: (paymentMethodRow as Record<string, unknown>).id as string,
      methodType: 'card',
      allocatedMinor: input.amountMinor,
      capturedMinor: amountCapturedMinor,
      refundedMinor: 0,
      sortOrder: 1,
      metadata: {
        provider: 'stripe',
      },
    },
    { subjectType: 'payment_intent_tender', displayName: 'Stripe Tender' },
  )
  if (tenderRow instanceof Response) return tenderRow

  const eventRows: Array<Record<string, unknown>> = [
    {
      bizId: input.bizId,
      paymentIntentId: (intentRow as Record<string, unknown>).id as string,
      eventType: 'created',
      actorUserId: input.customerUserId,
      details: {
        source: input.source,
        stripeEvent: 'payment_intent.created',
      },
    },
  ]

  if (mappedStatus !== 'requires_payment_method') {
    eventRows.push({
      bizId: input.bizId,
      paymentIntentId: (intentRow as Record<string, unknown>).id as string,
      eventType: mapBizingStatusToIntentEventType(mappedStatus),
      previousStatus: 'requires_payment_method',
      nextStatus: mappedStatus,
      previousAmountCapturedMinor: 0,
      nextAmountCapturedMinor: amountCapturedMinor,
      actorUserId: input.customerUserId,
      details: {
        source: input.source,
        stripeStatus: stripeIntent.status,
      },
    })
  }

  for (const eventRow of eventRows) {
    const createdEvent = await createPaymentRow(
      input.c,
      input.bizId,
      'paymentIntentEvents',
      eventRow,
      {
        subjectType: 'payment_intent_event',
        displayName: `Payment Intent Event ${String(eventRow.eventType)}`,
      },
    )
    if (createdEvent instanceof Response) return createdEvent
  }

  let transactionId: string | null = null
  if (mappedStatus === 'succeeded' || mappedStatus === 'processing' || mappedStatus === 'failed') {
    const transaction = await createPaymentRow(
      input.c,
      input.bizId,
      'paymentTransactions',
      {
        bizId: input.bizId,
        paymentIntentId: (intentRow as Record<string, unknown>).id as string,
        bookingOrderId: input.bookingOrderId,
        paymentIntentTenderId: (tenderRow as Record<string, unknown>).id as string,
        paymentMethodId: (paymentMethodRow as Record<string, unknown>).id as string,
        paymentProcessorAccountId: processor.id,
        type: 'charge',
        status: mappedStatus === 'succeeded' ? 'succeeded' : mappedStatus === 'processing' ? 'processing' : 'failed',
        amountMinor: input.amountMinor,
        currency: input.currency,
        occurredAt: new Date(),
        providerTransactionRef: chargeRef,
        providerPayload: {
          provider: 'stripe',
          stripeIntentId: stripeIntent.id,
          stripeStatus: stripeIntent.status,
        },
        metadata: {
          source: input.source,
        },
      },
      { subjectType: 'payment_transaction', displayName: 'Stripe Charge Transaction' },
    )
    if (transaction instanceof Response) return transaction
    transactionId = String((transaction as Record<string, unknown>).id)
  }

  return {
    intentRow: intentRow as Record<string, unknown>,
    paymentMethodRow: paymentMethodRow as Record<string, unknown>,
    tenderRow: tenderRow as Record<string, unknown>,
    transactionId,
    stripeIntent,
    mappedStatus,
    amountCapturedMinor,
    chargeRef,
  }
}

export const paymentRoutes = new Hono()

/**
 * Create one real Stripe-backed payment intent for a booking order.
 *
 * Why this route exists:
 * - gives a deterministic provider-backed payment path (not simulated),
 * - returns Stripe client secret for real checkout clients,
 * - mirrors provider state into canonical Bizing payment tables immediately.
 */
paymentRoutes.post(
  '/public/bizes/:bizId/booking-orders/:bookingOrderId/payments/stripe/payment-intents',
  requireAuth,
  async (c) => {
    const user = getCurrentUser(c)
    if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
    if (!getStripeClient()) {
      return fail(c, 'STRIPE_NOT_CONFIGURED', 'Stripe integration is not configured.', 503)
    }

    const bizId = c.req.param('bizId')
    const bizAccess = await requirePublicBizAccess(c, bizId)
    if (bizAccess instanceof Response) return bizAccess

    const bookingOrderId = c.req.param('bookingOrderId')
    const body = await c.req.json().catch(() => null)
    const parsed = stripeIntentBodySchema.safeParse(body)
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
    const expectedTotalMinor = booking.totalMinor + tipMinor
    const amountMinor = parsed.data.amountMinor ?? expectedTotalMinor
    if (amountMinor !== expectedTotalMinor) {
      return fail(
        c,
        'AMOUNT_MISMATCH',
        `Stripe payment amount (${amountMinor}) must equal expected booking amount (${expectedTotalMinor}).`,
        409,
      )
    }

    let stripeResult:
      | Awaited<ReturnType<typeof createStripePaymentIntentForBooking>>
      | Response
    try {
      stripeResult = await createStripePaymentIntentForBooking({
        c,
        bizId,
        bookingOrderId,
        customerUserId: user.id,
        amountMinor,
        currency,
        paymentMethodRef: parsed.data.paymentMethodRef,
        confirmNow: parsed.data.confirmNow,
        metadata: parsed.data.metadata ?? {},
        source: 'public_checkout',
        idempotencyKey: parsed.data.idempotencyKey,
      })
    } catch (error) {
      return fail(c, 'STRIPE_CREATE_INTENT_FAILED', 'Failed to create Stripe payment intent.', 502, {
        message: error instanceof Error ? error.message : 'Unknown Stripe error.',
      })
    }
    if (stripeResult instanceof Response) return stripeResult

    const existingLines = await ensureBaseBookingLine({
      c,
      bizId,
      bookingOrderId,
      subtotalMinor: booking.subtotalMinor,
      totalMinor: booking.totalMinor,
      currency: booking.currency,
    })
    const allLines = [...existingLines]
    if (tipMinor > 0) {
      const tipLine = await createPaymentRow(
        c,
        bizId,
        'bookingOrderLines',
        {
          bizId,
          bookingOrderId,
          lineType: 'tip',
          label: 'Tip',
          quantity: 1,
          unitAmountMinor: tipMinor,
          lineTotalMinor: tipMinor,
          pricingDetail: { source: 'stripe_payment_tip' },
        },
        { subjectType: 'booking_order_line', displayName: 'Stripe Booking Tip Line' },
      )
      if (tipLine instanceof Response) return tipLine
      allLines.push(tipLine as (typeof allLines)[number])
    }

    const allocationPlan = buildAllocationPlan({
      tenders: [{ allocatedMinor: amountMinor }],
      lines: allLines.map((line) => ({ id: line.id, lineTotalMinor: line.lineTotalMinor })),
    })

    const lineAllocationRows: Array<Record<string, unknown>> = []
    for (const [idx, plan] of allocationPlan.entries()) {
      const allocation = await createPaymentRow(
        c,
        bizId,
        'paymentIntentLineAllocations',
        {
          bizId,
          paymentIntentId: String(stripeResult.intentRow.id),
          paymentIntentTenderId: String(stripeResult.tenderRow.id),
          bookingOrderId,
          bookingOrderLineId: plan.bookingOrderLineId,
          allocatedMinor: plan.allocatedMinor,
          capturedMinor:
            stripeResult.mappedStatus === 'succeeded' ? plan.allocatedMinor : 0,
          refundedMinor: 0,
          sortOrder: idx + 1,
          metadata: { source: 'stripe_payment_intent' },
        },
        { subjectType: 'payment_intent_line_allocation', displayName: 'Stripe Intent Allocation' },
      )
      if (allocation instanceof Response) return allocation
      lineAllocationRows.push(allocation as Record<string, unknown>)
    }

    if (stripeResult.transactionId) {
      for (const allocation of lineAllocationRows) {
        const txAlloc = await createPaymentRow(
          c,
          bizId,
          'paymentTransactionLineAllocations',
          {
            bizId,
            paymentTransactionId: stripeResult.transactionId,
            paymentIntentId: String(stripeResult.intentRow.id),
            paymentIntentTenderId: String(stripeResult.tenderRow.id),
            bookingOrderId,
            bookingOrderLineId: String(allocation.bookingOrderLineId),
            paymentIntentLineAllocationId: String(allocation.id),
            amountMinor: Number(allocation.allocatedMinor),
            occurredAt: new Date(),
            metadata: { source: 'stripe_payment_intent' },
          },
          { subjectType: 'payment_transaction_line_allocation', displayName: 'Stripe Transaction Allocation' },
        )
        if (txAlloc instanceof Response) return txAlloc
      }
    }

    const nextBookingStatus =
      stripeResult.mappedStatus === 'succeeded'
        ? 'confirmed'
        : booking.status === 'draft' || booking.status === 'quoted'
          ? 'awaiting_payment'
          : booking.status
    const bookingStatusUpdate = await updatePaymentRow(
      c,
      bizId,
      'bookingOrders',
      bookingOrderId,
      { status: nextBookingStatus },
      { subjectType: 'booking_order', displayName: 'Stripe Booking Status Update' },
    )
    if (bookingStatusUpdate instanceof Response) return bookingStatusUpdate

    if (stripeResult.mappedStatus === 'failed') {
      return fail(c, 'PAYMENT_DECLINED', 'Stripe payment intent failed.', 402, {
        paymentIntentId: stripeResult.intentRow.id,
        providerIntentRef: stripeResult.stripeIntent.id,
        stripeStatus: stripeResult.stripeIntent.status,
      })
    }

    return ok(
      c,
      {
        paymentIntentId: stripeResult.intentRow.id,
        bookingOrderId,
        status: stripeResult.intentRow.status,
        provider: 'stripe',
        providerIntentRef: stripeResult.stripeIntent.id,
        clientSecret: stripeResult.stripeIntent.client_secret,
        requiresAction:
          stripeResult.mappedStatus === 'requires_confirmation' ||
          stripeResult.mappedStatus === 'requires_payment_method',
      },
      201,
    )
  },
)

/**
 * Stripe webhook ingress (public endpoint, signature-verified when secret is configured).
 *
 * ELI5:
 * - Stripe calls this endpoint after payment intent state changes.
 * - We store the raw event, dedupe by Stripe event id, then reconcile canonical
 *   payment_intents/payment_transactions rows so operators can trust local state.
 */
paymentRoutes.post('/public/payments/stripe/webhook', async (c) => {
  if (!getStripeClient()) {
    return fail(c, 'STRIPE_NOT_CONFIGURED', 'Stripe integration is not configured.', 503)
  }

  const stripe = requireStripeClient()
  const signatureHeader = c.req.header('stripe-signature') ?? ''
  const rawBody = await c.req.raw.text()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let stripeEvent: Record<string, unknown>
  let signatureVerified = false
  try {
    if (webhookSecret) {
      const verified = stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret)
      stripeEvent = verified as unknown as Record<string, unknown>
      signatureVerified = true
    } else {
      stripeEvent = JSON.parse(rawBody) as Record<string, unknown>
      signatureVerified = false
    }
  } catch (error) {
    return fail(c, 'STRIPE_WEBHOOK_INVALID', 'Failed to verify Stripe webhook signature.', 400, {
      message: error instanceof Error ? error.message : 'Unknown signature verification error.',
    })
  }

  const stripeEventId = String(stripeEvent.id ?? '')
  const eventType = String(stripeEvent.type ?? 'unknown')
  const eventData = (stripeEvent.data ?? {}) as Record<string, unknown>
  const eventObject = (eventData.object ?? {}) as Record<string, unknown>
  const livemode = Boolean(stripeEvent.livemode)
  const eventCreatedAt = Number(stripeEvent.created)
  const metadata = ((eventObject.metadata ?? {}) as Record<string, unknown>) ?? {}
  const metadataBizId =
    typeof metadata.bizId === 'string' && metadata.bizId.length > 0 ? metadata.bizId : null
  const eventStripeAccountId =
    typeof stripeEvent.account === 'string' && stripeEvent.account.length > 0
      ? String(stripeEvent.account)
      : null

  if (!stripeEventId) {
    return fail(c, 'STRIPE_WEBHOOK_INVALID', 'Webhook payload missing Stripe event id.', 400)
  }

  const insertedWebhook = await db
    .insert(stripeWebhookEvents)
    .values({
      bizId: null,
      stripeEventId,
      stripeAccountId: eventStripeAccountId,
      eventType,
      apiVersion:
        typeof stripeEvent.api_version === 'string' ? stripeEvent.api_version : null,
      livemode,
      eventCreatedAt:
        Number.isFinite(eventCreatedAt) && eventCreatedAt > 0
          ? new Date(eventCreatedAt * 1000)
          : null,
      payload: stripeEvent,
      signatureVerified,
      processingStatus: 'pending',
      attempts: 1,
      processedAt: null,
      processingError: null,
    })
    .onConflictDoNothing({ target: stripeWebhookEvents.stripeEventId })
    .returning({ id: stripeWebhookEvents.id })

  if (insertedWebhook.length === 0) {
    return ok(c, { duplicate: true, stripeEventId, eventType })
  }

  const webhookId = insertedWebhook[0]!.id

  try {
    const providerIntentRef =
      eventType.startsWith('payment_intent.')
        ? typeof eventObject.id === 'string'
          ? eventObject.id
          : null
        : typeof eventObject.payment_intent === 'string'
          ? eventObject.payment_intent
          : null

    if (!providerIntentRef) {
      await db
        .update(stripeWebhookEvents)
        .set({
          processingStatus: 'ignored',
          processedAt: new Date(),
        })
        .where(eq(stripeWebhookEvents.id, webhookId))
      return ok(c, { accepted: true, stripeEventId, eventType, ignored: true })
    }

    const intent = await db.query.paymentIntents.findFirst({
      where: and(
        eq(paymentIntents.providerIntentRef, providerIntentRef),
        metadataBizId ? eq(paymentIntents.bizId, metadataBizId) : undefined,
      ),
    })
    if (!intent) {
      await db
        .update(stripeWebhookEvents)
        .set({
          processingStatus: 'ignored',
          processedAt: new Date(),
          processingError: `No local payment_intent found for provider ref ${providerIntentRef}.`,
        })
        .where(eq(stripeWebhookEvents.id, webhookId))
      return ok(c, {
        accepted: true,
        stripeEventId,
        eventType,
        ignored: true,
        reason: 'local_intent_not_found',
      })
    }

    const stripeStatus = String(eventObject.status ?? '')
    const mappedStatus = mapStripeIntentStatusToBizing(
      (stripeStatus || 'requires_payment_method') as Parameters<
        typeof mapStripeIntentStatusToBizing
      >[0],
    )
    const amountReceivedMinor = Number(eventObject.amount_received ?? 0)
    const amountIntentMinor = Number(eventObject.amount ?? intent.amountTargetMinor)
    const currency = String(eventObject.currency ?? intent.currency).toUpperCase()
    const previousStatus = intent.status

    await db
      .update(paymentIntents)
      .set({
        status: mappedStatus,
        amountCapturedMinor:
          mappedStatus === 'succeeded'
            ? Math.max(intent.amountCapturedMinor, amountReceivedMinor)
            : intent.amountCapturedMinor,
        amountTargetMinor: intent.amountTargetMinor > 0 ? intent.amountTargetMinor : amountIntentMinor,
        capturedAt: mappedStatus === 'succeeded' ? new Date() : intent.capturedAt,
        failedAt:
          mappedStatus === 'failed' || mappedStatus === 'cancelled' ? new Date() : intent.failedAt,
      })
      .where(eq(paymentIntents.id, intent.id))

    await db.insert(paymentIntentEvents).values({
      bizId: intent.bizId,
      paymentIntentId: intent.id,
      eventType: mapBizingStatusToIntentEventType(mappedStatus),
      previousStatus,
      nextStatus: mappedStatus,
      previousAmountCapturedMinor: intent.amountCapturedMinor,
      nextAmountCapturedMinor:
        mappedStatus === 'succeeded'
          ? Math.max(intent.amountCapturedMinor, amountReceivedMinor)
          : intent.amountCapturedMinor,
      actorRef: 'stripe:webhook',
      details: {
        stripeEventId,
        stripeEventType: eventType,
        stripeStatus,
      },
    })

    const chargeRef =
      typeof eventObject.latest_charge === 'string'
        ? eventObject.latest_charge
        : null
    if (
      chargeRef &&
      (mappedStatus === 'succeeded' || mappedStatus === 'processing' || mappedStatus === 'failed')
    ) {
      const existingTransaction = await db.query.paymentTransactions.findFirst({
        where: and(
          eq(paymentTransactions.bizId, intent.bizId),
          eq(paymentTransactions.paymentIntentId, intent.id),
          eq(paymentTransactions.type, 'charge'),
          eq(paymentTransactions.providerTransactionRef, chargeRef),
        ),
      })
      if (!existingTransaction) {
        const firstTender = await db.query.paymentIntentTenders.findFirst({
          where: and(
            eq(paymentIntentTenders.bizId, intent.bizId),
            eq(paymentIntentTenders.paymentIntentId, intent.id),
          ),
          orderBy: [asc(paymentIntentTenders.sortOrder)],
        })

        await db.insert(paymentTransactions).values({
          bizId: intent.bizId,
          paymentIntentId: intent.id,
          bookingOrderId: intent.bookingOrderId,
          crossBizOrderId: intent.crossBizOrderId,
          paymentIntentTenderId: firstTender?.id ?? null,
          paymentMethodId: firstTender?.paymentMethodId ?? null,
          paymentProcessorAccountId: intent.paymentProcessorAccountId,
          type: 'charge',
          status: mappedStatus === 'succeeded' ? 'succeeded' : mappedStatus === 'processing' ? 'processing' : 'failed',
          amountMinor: amountReceivedMinor > 0 ? amountReceivedMinor : amountIntentMinor,
          currency,
          providerTransactionRef: chargeRef,
          occurredAt: new Date(),
          providerPayload: {
            stripeEventId,
            stripeEventType: eventType,
            stripeStatus,
          },
          metadata: {
            source: 'stripe_webhook',
          },
        })
      }
    }

    if (mappedStatus === 'succeeded' && intent.bookingOrderId) {
      await db
        .update(bookingOrders)
        .set({ status: 'confirmed' })
        .where(
          and(
            eq(bookingOrders.bizId, intent.bizId),
            eq(bookingOrders.id, intent.bookingOrderId),
            inArray(bookingOrders.status, ['draft', 'quoted', 'awaiting_payment']),
          ),
        )
    }

    await db
      .update(stripeWebhookEvents)
      .set({
        bizId: intent.bizId,
        processingStatus: 'processed',
        processedAt: new Date(),
        processingError: null,
      })
      .where(eq(stripeWebhookEvents.id, webhookId))

    return ok(c, {
      accepted: true,
      stripeEventId,
      eventType,
      paymentIntentId: intent.id,
      mappedStatus,
    })
  } catch (error) {
    await db
      .update(stripeWebhookEvents)
      .set({
        processingStatus: 'failed',
        processedAt: new Date(),
        processingError: error instanceof Error ? error.message : 'Unknown webhook processing error.',
      })
      .where(eq(stripeWebhookEvents.id, webhookId))
    return fail(c, 'STRIPE_WEBHOOK_PROCESSING_FAILED', 'Failed to process Stripe webhook.', 500, {
      stripeEventId,
      eventType,
      message: error instanceof Error ? error.message : 'Unknown error.',
    })
  }
})

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
    const bizAccess = await requirePublicBizAccess(c, bizId)
    if (bizAccess instanceof Response) return bizAccess

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
    const simulatedDeclineTender = parsed.data.tenders.find((row) => row.metadata?.simulateDecline === true)
    const processor = await getOrCreateDefaultProcessorAccount(c, bizId)

    if (simulatedDeclineTender) {
      const intent = await createPaymentRow(
        c,
        bizId,
        'paymentIntents',
        {
          bizId,
          bookingOrderId,
          paymentProcessorAccountId: processor.id,
          status: 'failed',
          currency,
          amountTargetMinor: expectedTotalMinor,
          amountCapturedMinor: 0,
          amountRefundedMinor: 0,
          requiresCapture: false,
          source: 'public_checkout',
          amountSnapshot: {
            bookingTotalMinor: booking.totalMinor,
            tipMinor,
            expectedTotalMinor,
            simulatedDecline: true,
          },
          metadata: parsed.data.metadata ?? {},
        },
        { subjectType: 'payment_intent', displayName: 'Declined Payment Intent' },
      )
      if (intent instanceof Response) return intent

      const method = await createPaymentRow(
        c,
        bizId,
        'paymentMethods',
        {
          bizId,
          paymentProcessorAccountId: processor.id,
          type: simulatedDeclineTender.methodType,
          provider: simulatedDeclineTender.provider ?? autoProviderForMethod(simulatedDeclineTender.methodType),
          providerMethodRef: simulatedDeclineTender.providerMethodRef ?? `declined-${Date.now()}-${crypto.randomUUID()}`,
          label: simulatedDeclineTender.label ?? 'Declined Tender',
          isDefault: false,
          isActive: true,
          metadata: {
            ...(simulatedDeclineTender.metadata ?? {}),
            checkoutUserId: user.id,
          },
        },
        { subjectType: 'payment_method', displayName: 'Declined Payment Method' },
      )
      if (method instanceof Response) return method

      const intentTender = await createPaymentRow(
        c,
        bizId,
        'paymentIntentTenders',
        {
          bizId,
          paymentIntentId: (intent as Record<string, unknown>).id,
          paymentMethodId: (method as Record<string, unknown>).id,
          methodType: simulatedDeclineTender.methodType,
          allocatedMinor: expectedTotalMinor,
          capturedMinor: 0,
          refundedMinor: 0,
          sortOrder: 1,
          metadata: simulatedDeclineTender.metadata ?? {},
        },
        { subjectType: 'payment_intent_tender', displayName: 'Declined Intent Tender' },
      )
      if (intentTender instanceof Response) return intentTender

      const transaction = await createPaymentRow(
        c,
        bizId,
        'paymentTransactions',
        {
          bizId,
          paymentIntentId: (intent as Record<string, unknown>).id as string,
          bookingOrderId,
          paymentIntentTenderId: (intentTender as Record<string, unknown>).id as string,
          paymentMethodId: (method as Record<string, unknown>).id as string,
          paymentProcessorAccountId: processor.id,
          type: 'charge',
          status: 'failed',
          amountMinor: expectedTotalMinor,
          currency,
          occurredAt: new Date(),
          providerPayload: { source: 'simulated_decline' },
          metadata: {
            simulateDecline: true,
          },
        },
        { subjectType: 'payment_transaction', displayName: 'Declined Charge Transaction' },
      )
      if (transaction instanceof Response) return transaction

      for (const eventRow of [
        {
          bizId,
          paymentIntentId: (intent as Record<string, unknown>).id as string,
          eventType: 'created',
          actorUserId: user.id,
          details: { source: 'public_checkout' },
        },
        {
          bizId,
          paymentIntentId: (intent as Record<string, unknown>).id as string,
          eventType: 'failed',
          previousStatus: 'requires_confirmation',
          nextStatus: 'failed',
          actorUserId: user.id,
          details: {
            reason: 'simulated_decline',
            paymentTransactionId: (transaction as Record<string, unknown>).id as string,
          },
        },
      ]) {
        const createdEvent = await createPaymentRow(c, bizId, 'paymentIntentEvents', eventRow, {
          subjectType: 'payment_intent_event',
          displayName: `Payment Intent Event ${eventRow.eventType}`,
        })
        if (createdEvent instanceof Response) return createdEvent
      }

      return fail(c, 'PAYMENT_DECLINED', 'Primary payment method was declined.', 402, {
        paymentIntentId: (intent as Record<string, unknown>).id,
      })
    }

    if (tenderTotalMinor !== expectedTotalMinor) {
      return fail(
        c,
        'AMOUNT_MISMATCH',
        `Tender total (${tenderTotalMinor}) must equal expected amount (${expectedTotalMinor}).`,
        409,
      )
    }

    const existingLines = await ensureBaseBookingLine({
      c,
      bizId,
      bookingOrderId,
      subtotalMinor: booking.subtotalMinor,
      totalMinor: booking.totalMinor,
      currency: booking.currency,
    })

    const allLines = [...existingLines]
    if (tipMinor > 0) {
      const tipLine = await createPaymentRow(
        c,
        bizId,
        'bookingOrderLines',
        {
          bizId,
          bookingOrderId,
          lineType: 'tip',
          label: 'Tip',
          quantity: 1,
          unitAmountMinor: tipMinor,
          lineTotalMinor: tipMinor,
          pricingDetail: { source: 'advanced_payment_tip' },
        },
        { subjectType: 'booking_order_line', displayName: 'Booking Tip Line' },
      )
      if (tipLine instanceof Response) return tipLine
      allLines.push(tipLine as (typeof allLines)[number])
    }

    const allocationPlan = buildAllocationPlan({
      tenders: parsed.data.tenders.map((row) => ({ allocatedMinor: row.allocatedMinor })),
      lines: allLines.map((line) => ({ id: line.id, lineTotalMinor: line.lineTotalMinor })),
    })

    const intent = await createPaymentRow(
      c,
      bizId,
      'paymentIntents',
      {
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
      },
      { subjectType: 'payment_intent', displayName: 'Checkout Payment Intent' },
    )
    if (intent instanceof Response) return intent

    for (const eventRow of [
      {
        bizId,
        paymentIntentId: (intent as Record<string, unknown>).id as string,
        eventType: 'created',
        actorUserId: user.id,
        details: { source: 'public_checkout' },
      },
      {
        bizId,
        paymentIntentId: (intent as Record<string, unknown>).id as string,
        eventType: 'captured',
        previousStatus: 'requires_confirmation',
        nextStatus: 'succeeded',
        previousAmountCapturedMinor: 0,
        nextAmountCapturedMinor: expectedTotalMinor,
        actorUserId: user.id,
        details: { source: 'public_checkout' },
      },
    ]) {
      const createdEvent = await createPaymentRow(c, bizId, 'paymentIntentEvents', eventRow, {
        subjectType: 'payment_intent_event',
        displayName: `Payment Intent Event ${eventRow.eventType}`,
      })
      if (createdEvent instanceof Response) return createdEvent
    }

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
      const method = await createPaymentRow(
        c,
        bizId,
        'paymentMethods',
        {
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
        },
        { subjectType: 'payment_method', displayName: `${tender.methodType} Payment Method` },
      )
      if (method instanceof Response) return method

      const intentTender = await createPaymentRow(
        c,
        bizId,
        'paymentIntentTenders',
        {
          bizId,
          paymentIntentId: (intent as Record<string, unknown>).id as string,
          paymentMethodId: (method as Record<string, unknown>).id as string,
          methodType: tender.methodType,
          allocatedMinor: tender.allocatedMinor,
          capturedMinor: tender.allocatedMinor,
          refundedMinor: 0,
          sortOrder: index + 1,
          metadata: tender.metadata ?? {},
        },
        { subjectType: 'payment_intent_tender', displayName: 'Payment Tender' },
      )
      if (intentTender instanceof Response) return intentTender

      createdTenders.push({
        tenderId: (intentTender as Record<string, unknown>).id as string,
        paymentMethodId: (method as Record<string, unknown>).id as string,
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

    const lineAllocationRows: Array<Record<string, unknown>> = []
    for (const [idx, plan] of allocationPlan.entries()) {
      const allocationRow = await createPaymentRow(c, bizId, 'paymentIntentLineAllocations', {
        bizId,
        paymentIntentId: (intent as Record<string, unknown>).id as string,
        paymentIntentTenderId: tenderIdByIndex.get(plan.tenderIndex)!,
        bookingOrderId,
        bookingOrderLineId: plan.bookingOrderLineId,
        allocatedMinor: plan.allocatedMinor,
        capturedMinor: plan.allocatedMinor,
        refundedMinor: 0,
        sortOrder: idx + 1,
        metadata: {},
      }, {
        subjectType: 'payment_intent_line_allocation',
        displayName: 'Intent Line Allocation',
      })
      if (allocationRow instanceof Response) return allocationRow
      lineAllocationRows.push(allocationRow as Record<string, unknown>)
    }

    const bookingStatusUpdate = await updatePaymentRow(
      c,
      bizId,
      'bookingOrders',
      bookingOrderId,
      {
        status:
          booking.status === 'draft' ||
          booking.status === 'quoted' ||
          booking.status === 'awaiting_payment'
            ? 'confirmed'
            : booking.status,
      },
      { subjectType: 'booking_order', displayName: 'Booking Status Update' },
    )
    if (bookingStatusUpdate instanceof Response) return bookingStatusUpdate

    const transactionRows: Array<Record<string, unknown>> = []
    for (const [index, tender] of parsed.data.tenders.entries()) {
      const tx = await createPaymentRow(c, bizId, 'paymentTransactions', {
          bizId,
          paymentIntentId: (intent as Record<string, unknown>).id as string,
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
        }, {
          subjectType: 'payment_transaction',
          displayName: 'Charge Transaction',
        })
      if (tx instanceof Response) return tx
      transactionRows.push(tx as Record<string, unknown>)
    }

    const transactionByTenderId = new Map<string, string>()
    transactionRows.forEach((row) => {
      if (row.paymentIntentTenderId) {
        transactionByTenderId.set(String(row.paymentIntentTenderId), String(row.id))
      }
    })

    const planByTenderAndLine = new Map<string, string>()
    lineAllocationRows.forEach((row) => {
      planByTenderAndLine.set(
        `${String(row.paymentIntentTenderId)}:${String(row.bookingOrderLineId)}`,
        String(row.id),
      )
    })

    for (const plan of allocationPlan) {
      const tenderId = tenderIdByIndex.get(plan.tenderIndex)!
      const transactionId = transactionByTenderId.get(tenderId)
      const planId = planByTenderAndLine.get(`${tenderId}:${plan.bookingOrderLineId}`)
      if (!transactionId || !planId) {
        throw new Error('Failed to resolve transaction/plan link for line allocation.')
      }
      const txAlloc = await createPaymentRow(c, bizId, 'paymentTransactionLineAllocations', {
          bizId,
          paymentTransactionId: transactionId,
          paymentIntentId: (intent as Record<string, unknown>).id as string,
          paymentIntentTenderId: tenderId,
          bookingOrderId,
          bookingOrderLineId: plan.bookingOrderLineId,
          paymentIntentLineAllocationId: planId,
          amountMinor: plan.allocatedMinor,
          occurredAt: new Date(),
          metadata: {},
        }, {
          subjectType: 'payment_transaction_line_allocation',
          displayName: 'Transaction Line Allocation',
        })
      if (txAlloc instanceof Response) return txAlloc
    }

    return ok(
      c,
      {
        paymentIntentId: (intent as Record<string, unknown>).id,
        bookingOrderId,
        status: (intent as Record<string, unknown>).status,
        currency,
        amountTargetMinor: (intent as Record<string, unknown>).amountTargetMinor,
        amountCapturedMinor: (intent as Record<string, unknown>).amountCapturedMinor,
        tenderCount: createdTenders.length,
        lineAllocationCount: lineAllocationRows.length,
        transactionCount: transactionRows.length,
      },
      201,
    )
  },
)

paymentRoutes.post(
  '/bizes/:bizId/payment-intents/:paymentIntentId/refunds',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, paymentIntentId } = c.req.param()
    const parsed = refundPaymentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const intent = await db.query.paymentIntents.findFirst({
      where: and(eq(paymentIntents.bizId, bizId), eq(paymentIntents.id, paymentIntentId)),
    })
    if (!intent) return fail(c, 'NOT_FOUND', 'Payment intent not found.', 404)

    const refundableMinor = Math.max(0, Number(intent.amountCapturedMinor ?? 0) - Number(intent.amountRefundedMinor ?? 0))
    if (parsed.data.amountMinor > refundableMinor) {
      return fail(c, 'REFUND_EXCEEDS_AVAILABLE', 'Refund amount exceeds captured balance.', 409, {
        refundableMinor,
      })
    }

    const chargeTransactions = await db.query.paymentTransactions.findMany({
      where: and(eq(paymentTransactions.bizId, bizId), eq(paymentTransactions.paymentIntentId, paymentIntentId)),
      orderBy: [asc(paymentTransactions.occurredAt)],
    })
    const successfulCharges = chargeTransactions.filter((row) => row.type === 'charge' && row.status === 'succeeded')
    if (successfulCharges.length === 0) {
      return fail(c, 'NO_REFUNDABLE_CHARGE', 'No succeeded charge exists for this payment intent.', 409)
    }

    let remainingMinor = parsed.data.amountMinor
    const refundRows: Array<{ paymentTransactionId: string; amountMinor: number }> = []
    for (const charge of successfulCharges) {
      if (remainingMinor <= 0) break
      const alreadyRefunded = chargeTransactions
        .filter((row) => row.type === 'refund' && row.paymentIntentTenderId === charge.paymentIntentTenderId)
        .reduce((sum, row) => sum + Number(row.amountMinor ?? 0), 0)
      const availableForCharge = Math.max(0, Number(charge.amountMinor ?? 0) - alreadyRefunded)
      if (availableForCharge <= 0) continue
      const amountMinor = Math.min(remainingMinor, availableForCharge)
      const refundTx = await createPaymentRow(c, bizId, 'paymentTransactions', {
          bizId,
          paymentIntentId,
          bookingOrderId: intent.bookingOrderId,
          paymentIntentTenderId: charge.paymentIntentTenderId,
          paymentMethodId: charge.paymentMethodId,
          paymentProcessorAccountId: charge.paymentProcessorAccountId,
          type: 'refund',
          status: 'succeeded',
          amountMinor,
          currency: intent.currency,
          occurredAt: new Date(),
          providerPayload: { source: 'manual_refund' },
          metadata: {
            ...(parsed.data.metadata ?? {}),
            reason: parsed.data.reason ?? null,
            fallbackMode: parsed.data.fallbackMode ?? null,
            sourceChargeTransactionId: charge.id,
          },
        }, {
          subjectType: 'payment_transaction',
          displayName: 'Refund Transaction',
        })
      if (refundTx instanceof Response) return refundTx
      refundRows.push({ paymentTransactionId: String((refundTx as Record<string, unknown>).id), amountMinor })
      remainingMinor -= amountMinor
    }

    const nextRefundedMinor = Number(intent.amountRefundedMinor ?? 0) + parsed.data.amountMinor
    const nextStatus =
      nextRefundedMinor >= Number(intent.amountCapturedMinor ?? 0) ? 'refunded' : intent.status

    const updatedIntent = await updatePaymentRow(
      c,
      bizId,
      'paymentIntents',
      paymentIntentId,
      {
        amountRefundedMinor: nextRefundedMinor,
        status: nextStatus,
      },
      { subjectType: 'payment_intent', displayName: 'Refunded Payment Intent' },
    )
    if (updatedIntent instanceof Response) return updatedIntent

    const refundEvent = await createPaymentRow(c, bizId, 'paymentIntentEvents', {
      bizId,
      paymentIntentId,
      eventType: 'refunded',
      previousStatus: intent.status,
      nextStatus,
      previousAmountRefundedMinor: intent.amountRefundedMinor,
      nextAmountRefundedMinor: nextRefundedMinor,
      actorUserId: getCurrentUser(c)?.id ?? null,
      details: {
        amountMinor: parsed.data.amountMinor,
        reason: parsed.data.reason ?? null,
        fallbackMode: parsed.data.fallbackMode ?? null,
      },
    }, { subjectType: 'payment_intent_event', displayName: 'Payment Intent Refunded Event' })
    if (refundEvent instanceof Response) return refundEvent

    return ok(c, {
      paymentIntentId,
      refundedMinor: parsed.data.amountMinor,
      refundTransactionCount: refundRows.length,
      paymentIntent: updatedIntent,
    }, 201)
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

    const [processorAccount, tenders, lineAllocations, transactions, transactionLineAllocations] = await Promise.all([
      intent.paymentProcessorAccountId
        ? db.query.paymentProcessorAccounts.findFirst({
            where: and(
              eq(paymentProcessorAccounts.bizId, bizId),
              eq(paymentProcessorAccounts.id, intent.paymentProcessorAccountId),
            ),
          })
        : Promise.resolve(null),
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
      processorAccount,
      tenders,
      lineAllocations,
      transactions,
      transactionLineAllocations,
    })
  },
)
