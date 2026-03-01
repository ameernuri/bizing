/**
 * Booking participant obligations routes.
 *
 * ELI5:
 * A booking can involve more than one person. Each person may owe something:
 * money, identity verification, a document, attendance confirmation, etc.
 *
 * Why this route matters:
 * - group bookings, split payments, identity checks, and compliance intake all
 *   reuse this one canonical participant-obligation model,
 * - saga validators need real API CRUD over participant state,
 * - keeping this separate from the booking header prevents one booking row from
 *   becoming a giant unstructured blob.
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const { db, bookingOrders, bookingParticipantObligations, participantObligationEvents } = dbPackage

const baseParticipantBodySchema = z.object({
  participantUserId: z.string().optional(),
  participantGroupAccountId: z.string().optional(),
  bookingOrderLineId: z.string().optional(),
  obligationType: z.enum([
    'payment_contribution',
    'consent',
    'identity_verification',
    'attendance',
    'document_submission',
    'custom',
  ]),
  status: z.enum(['pending', 'satisfied', 'waived', 'cancelled', 'overdue']).default('pending'),
  amountDueMinor: z.number().int().min(0).optional(),
  amountSatisfiedMinor: z.number().int().min(0).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  dueAt: z.string().datetime().optional(),
  satisfiedAt: z.string().datetime().optional(),
  statusReason: z.string().max(400).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createParticipantBodySchema = baseParticipantBodySchema.superRefine((value, ctx) => {
  const count = [value.participantUserId, value.participantGroupAccountId].filter(Boolean).length
  if (count !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exactly one participant identity is required.',
    })
  }
})

const updateParticipantBodySchema = baseParticipantBodySchema.partial()

const createEventBodySchema = z.object({
  eventType: z.enum(['created', 'updated', 'satisfied', 'waived', 'cancelled', 'reopened', 'payment_applied', 'note']),
  deltaAmountMinor: z.number().int().optional(),
  note: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const bookingParticipantRoutes = new Hono()

bookingParticipantRoutes.get(
  '/bizes/:bizId/booking-orders/:bookingOrderId/participants',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const rows = await db.query.bookingParticipantObligations.findMany({
      where: and(
        eq(bookingParticipantObligations.bizId, bizId),
        eq(bookingParticipantObligations.bookingOrderId, bookingOrderId),
      ),
      orderBy: [asc(bookingParticipantObligations.id)],
    })
    return ok(c, rows)
  },
)

bookingParticipantRoutes.post(
  '/bizes/:bizId/booking-orders/:bookingOrderId/participants',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
      columns: { id: true },
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const parsed = createParticipantBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [created] = await db
      .insert(bookingParticipantObligations)
      .values({
        bizId,
        bookingOrderId,
        bookingOrderLineId: parsed.data.bookingOrderLineId ?? null,
        participantUserId: parsed.data.participantUserId ?? null,
        participantGroupAccountId: parsed.data.participantGroupAccountId ?? null,
        obligationType: parsed.data.obligationType,
        status: parsed.data.status,
        amountDueMinor: parsed.data.amountDueMinor ?? null,
        amountSatisfiedMinor: parsed.data.amountSatisfiedMinor,
        currency: parsed.data.currency,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        satisfiedAt: parsed.data.satisfiedAt ? new Date(parsed.data.satisfiedAt) : null,
        statusReason: parsed.data.statusReason ?? null,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    await db.insert(participantObligationEvents).values({
      bizId,
      bookingParticipantObligationId: created.id,
      eventType: 'created',
      actorUserId: getCurrentUser(c)?.id ?? null,
      note: 'Participant obligation created through API.',
      metadata: { source: 'booking_participants.create' },
    })

    return ok(c, created, 201)
  },
)

bookingParticipantRoutes.patch(
  '/bizes/:bizId/booking-orders/:bookingOrderId/participants/:obligationId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId, obligationId } = c.req.param()
    const existing = await db.query.bookingParticipantObligations.findFirst({
      where: and(
        eq(bookingParticipantObligations.bizId, bizId),
        eq(bookingParticipantObligations.bookingOrderId, bookingOrderId),
        eq(bookingParticipantObligations.id, obligationId),
      ),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Participant obligation not found.', 404)

    const parsed = updateParticipantBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [updated] = await db
      .update(bookingParticipantObligations)
      .set({
        participantUserId: parsed.data.participantUserId ?? undefined,
        participantGroupAccountId: parsed.data.participantGroupAccountId ?? undefined,
        bookingOrderLineId: parsed.data.bookingOrderLineId ?? undefined,
        obligationType: parsed.data.obligationType ?? undefined,
        status: parsed.data.status ?? undefined,
        amountDueMinor: parsed.data.amountDueMinor ?? undefined,
        amountSatisfiedMinor: parsed.data.amountSatisfiedMinor ?? undefined,
        currency: parsed.data.currency ?? undefined,
        dueAt: parsed.data.dueAt === undefined ? undefined : parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        satisfiedAt:
          parsed.data.satisfiedAt === undefined
            ? undefined
            : parsed.data.satisfiedAt
              ? new Date(parsed.data.satisfiedAt)
              : null,
        statusReason: parsed.data.statusReason ?? undefined,
        metadata: parsed.data.metadata ?? undefined,
      })
      .where(and(eq(bookingParticipantObligations.bizId, bizId), eq(bookingParticipantObligations.id, obligationId)))
      .returning()

    await db.insert(participantObligationEvents).values({
      bizId,
      bookingParticipantObligationId: obligationId,
      eventType: 'updated',
      actorUserId: getCurrentUser(c)?.id ?? null,
      note: 'Participant obligation updated through API.',
      metadata: { source: 'booking_participants.patch', patch: parsed.data },
    })

    return ok(c, updated)
  },
)

bookingParticipantRoutes.post(
  '/bizes/:bizId/booking-orders/:bookingOrderId/participants/:obligationId/events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId, obligationId } = c.req.param()
    const existing = await db.query.bookingParticipantObligations.findFirst({
      where: and(
        eq(bookingParticipantObligations.bizId, bizId),
        eq(bookingParticipantObligations.bookingOrderId, bookingOrderId),
        eq(bookingParticipantObligations.id, obligationId),
      ),
      columns: { id: true },
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Participant obligation not found.', 404)

    const parsed = createEventBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [created] = await db
      .insert(participantObligationEvents)
      .values({
        bizId,
        bookingParticipantObligationId: obligationId,
        eventType: parsed.data.eventType,
        deltaAmountMinor: parsed.data.deltaAmountMinor ?? null,
        actorUserId: getCurrentUser(c)?.id ?? null,
        note: parsed.data.note ?? null,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)
