/**
 * Access / ticket routes.
 *
 * ELI5:
 * A booking can turn into a "ticket" that a person carries on their phone.
 * The ticket is not just text in booking metadata. It becomes a real access
 * artifact with:
 * - a stable artifact row,
 * - a QR-capable verification token,
 * - immutable timeline events,
 * - an optional attendance obligation for "did this person actually arrive?".
 *
 * Why this module exists:
 * - QR check-in/ticketing flows are a recurring product need,
 * - the schema already has canonical access-right tables,
 * - sagas need first-class APIs to prove issuance, delivery, scanning,
 *   check-in, no-show, reissue, and offline sync behavior through the API.
 */

import crypto from 'node:crypto'
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

const {
  db,
  accessArtifacts,
  accessArtifactLinks,
  accessArtifactEvents,
  accessActionTokens,
  bookingOrders,
  bookingParticipantObligations,
  participantObligationEvents,
  outboundMessages,
  outboundMessageEvents,
} = dbPackage

const issueBookingTicketBodySchema = z.object({
  deliveryChannels: z.array(z.enum(['email', 'app'])).default(['email']),
  tokenTtlHours: z.number().int().min(1).max(24 * 365).default(24 * 30),
  ticketLabel: z.string().max(160).optional(),
  autoCreateAttendanceObligation: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const reissueTicketBodySchema = z.object({
  deliveryChannels: z.array(z.enum(['email', 'app'])).default(['email']),
  tokenTtlHours: z.number().int().min(1).max(24 * 365).default(24 * 30),
  reason: z.string().max(300).default('booking_details_changed'),
  metadata: z.record(z.unknown()).optional(),
})

const resolveTicketBodySchema = z
  .object({
    token: z.string().min(8).optional(),
    publicCode: z.string().min(4).optional(),
  })
  .refine((value) => Boolean(value.token || value.publicCode), {
    message: 'Either token or publicCode is required.',
  })

const scanTicketBodySchema = z
  .object({
    token: z.string().min(8).optional(),
    publicCode: z.string().min(4).optional(),
    scannerMode: z.enum(['phone_camera', 'dedicated_scanner']).default('phone_camera'),
    markCheckedIn: z.boolean().default(true),
    offlineCapturedAt: z.string().datetime().optional(),
    deviceRef: z.string().max(140).optional(),
    requestKey: z.string().max(140).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((value) => Boolean(value.token || value.publicCode), {
    message: 'Either token or publicCode is required.',
  })

const markNoShowBodySchema = z.object({
  reason: z.string().max(400).default('customer_did_not_arrive'),
  happenedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

function randomCode(prefix: string, length = 10) {
  return `${prefix}${crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase()}`
}

function hashToken(rawToken: string) {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

function makeTicketQrValue(rawToken: string) {
  return `bizing://ticket/${rawToken}`
}

/**
 * Store one simulated delivery message for ticket issuance or reissue.
 *
 * ELI5:
 * We keep delivery proof inside the API/domain so a saga can verify "did the
 * customer really receive the digital ticket?" without asking a real provider.
 */
async function createTicketDeliveryMessage(input: {
  bizId: string
  bookingOrderId: string
  recipientUserId?: string | null
  recipientRef: string
  channel: 'email' | 'push'
  subject: string
  body: string
  accessArtifactId: string
  publicCode: string
  qrValue: string
}) {
  const [message] = await db
    .insert(outboundMessages)
    .values({
      bizId: input.bizId,
      channel: input.channel,
      purpose: 'transactional',
      recipientUserId: input.recipientUserId ?? null,
      recipientRef: input.recipientRef,
      status: 'delivered',
      scheduledFor: new Date(),
      sentAt: new Date(),
      deliveredAt: new Date(),
      providerKey: input.channel === 'email' ? 'simulated_email' : 'simulated_app',
      providerMessageRef: `ticket-${input.accessArtifactId}-${input.channel}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      payload: {
        subject: input.subject,
        body: input.body,
        qrValue: input.qrValue,
        publicCode: input.publicCode,
      },
      metadata: {
        bookingOrderId: input.bookingOrderId,
        accessArtifactId: input.accessArtifactId,
        publicCode: input.publicCode,
        qrValue: input.qrValue,
        eventType: 'ticket.issued',
      },
    })
    .returning()

  await db.insert(outboundMessageEvents).values([
    {
      bizId: input.bizId,
      outboundMessageId: message.id,
      eventType: 'queued',
      payload: { channel: input.channel },
    },
    {
      bizId: input.bizId,
      outboundMessageId: message.id,
      eventType: 'sent',
      payload: { channel: input.channel },
    },
    {
      bizId: input.bizId,
      outboundMessageId: message.id,
      eventType: 'delivered',
      payload: { recipientRef: input.recipientRef },
    },
  ])

  return message
}

async function ensureAttendanceObligation(input: {
  bizId: string
  bookingOrderId: string
  participantUserId?: string | null
  accessArtifactId: string
}) {
  if (!input.participantUserId) return null

  const existing = await db.query.bookingParticipantObligations.findFirst({
    where: and(
      eq(bookingParticipantObligations.bizId, input.bizId),
      eq(bookingParticipantObligations.bookingOrderId, input.bookingOrderId),
      eq(bookingParticipantObligations.participantUserId, input.participantUserId),
      eq(bookingParticipantObligations.obligationType, 'attendance'),
    ),
  })
  if (existing) return existing

  const [created] = await db
    .insert(bookingParticipantObligations)
    .values({
      bizId: input.bizId,
      bookingOrderId: input.bookingOrderId,
      participantUserId: input.participantUserId,
      obligationType: 'attendance',
      status: 'pending',
      currency: 'USD',
      amountSatisfiedMinor: 0,
      metadata: {
        accessArtifactId: input.accessArtifactId,
        sourceRoute: 'access.issue_ticket',
      },
    })
    .returning()

  await db.insert(participantObligationEvents).values({
    bizId: input.bizId,
    bookingParticipantObligationId: created.id,
    eventType: 'created',
    actorUserId: null,
    note: 'Attendance obligation auto-created for ticketed booking.',
    metadata: {
      sourceRoute: 'access.issue_ticket',
      accessArtifactId: input.accessArtifactId,
    },
  })

  return created
}

async function findTicketByTokenOrCode(input: { bizId: string; token?: string; publicCode?: string }) {
  if (input.token) {
    const tokenHash = hashToken(input.token)
    const actionToken = await db.query.accessActionTokens.findFirst({
      where: and(eq(accessActionTokens.bizId, input.bizId), eq(accessActionTokens.tokenHash, tokenHash)),
    })
    if (!actionToken) return null
    const artifact = await db.query.accessArtifacts.findFirst({
      where: and(eq(accessArtifacts.bizId, input.bizId), eq(accessArtifacts.id, actionToken.accessArtifactId)),
    })
    return artifact ? { artifact, actionToken, rawToken: input.token } : null
  }

  const artifact = await db.query.accessArtifacts.findFirst({
    where: and(eq(accessArtifacts.bizId, input.bizId), eq(accessArtifacts.publicCode, input.publicCode!)),
  })
  if (!artifact) return null
  const actionToken = await db.query.accessActionTokens.findFirst({
    where: and(
      eq(accessActionTokens.bizId, input.bizId),
      eq(accessActionTokens.accessArtifactId, artifact.id),
      eq(accessActionTokens.actionType, 'verify'),
      eq(accessActionTokens.status, 'active'),
    ),
    orderBy: [asc(accessActionTokens.issuedAt)],
  })
  return { artifact, actionToken: actionToken ?? null, rawToken: null }
}

async function loadTicketContext(bizId: string, accessArtifactId: string) {
  const [links, events] = await Promise.all([
    db.query.accessArtifactLinks.findMany({
      where: and(eq(accessArtifactLinks.bizId, bizId), eq(accessArtifactLinks.accessArtifactId, accessArtifactId)),
    }),
    db.query.accessArtifactEvents.findMany({
      where: and(eq(accessArtifactEvents.bizId, bizId), eq(accessArtifactEvents.accessArtifactId, accessArtifactId)),
      orderBy: [asc(accessArtifactEvents.happenedAt)],
    }),
  ])
  const bookingLink = links.find((row) => row.linkType === 'booking_order' && row.bookingOrderId)
  const booking = bookingLink?.bookingOrderId
    ? await db.query.bookingOrders.findFirst({
        where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingLink.bookingOrderId)),
      })
    : null
  const attendanceObligation =
    booking?.customerUserId
      ? await db.query.bookingParticipantObligations.findFirst({
          where: and(
            eq(bookingParticipantObligations.bizId, bizId),
            eq(bookingParticipantObligations.bookingOrderId, booking.id),
            eq(bookingParticipantObligations.participantUserId, booking.customerUserId),
            eq(bookingParticipantObligations.obligationType, 'attendance'),
          ),
        })
      : null

  return {
    links,
    events,
    booking,
    attendanceObligation,
  }
}

export const accessRoutes = new Hono()

/**
 * Issue one ticket artifact for a booking.
 *
 * Bigger purpose:
 * - turns "this booking has a QR code" into canonical rows,
 * - emits simulated delivery proof,
 * - seeds attendance tracking so later scans/no-shows are explainable.
 */
accessRoutes.post(
  '/bizes/:bizId/booking-orders/:bookingOrderId/tickets',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const parsed = issueBookingTicketBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const publicCode = randomCode('TKT-')
    const rawToken = randomCode('qr_', 30)
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + parsed.data.tokenTtlHours * 60 * 60 * 1000)
    const actorUserId = getCurrentUser(c)?.id ?? null

    const [artifact] = await db
      .insert(accessArtifacts)
      .values({
        bizId,
        artifactType: 'ticket_entitlement',
        status: 'active',
        publicCode,
        holderUserId: booking.customerUserId ?? null,
        issuedAt: new Date(),
        activatedAt: new Date(),
        expiresAt,
        transferable: false,
        usageGranted: 1,
        usageRemaining: 1,
        policySnapshot: {
          bookingOrderId,
          tokenTtlHours: parsed.data.tokenTtlHours,
        },
        metadata: {
          bookingOrderId,
          ticketLabel: parsed.data.ticketLabel ?? 'Booking ticket',
          ...parsed.data.metadata,
        },
      })
      .returning()

    await db.insert(accessArtifactLinks).values({
      bizId,
      accessArtifactId: artifact.id,
      linkType: 'booking_order',
      bookingOrderId,
      metadata: {
        sourceRoute: 'access.issue_ticket',
      },
    })

    const [token] = await db
      .insert(accessActionTokens)
      .values({
        bizId,
        accessArtifactId: artifact.id,
        actionType: 'verify',
        tokenType: 'qr_code',
        status: 'active',
        tokenHash,
        tokenPreview: rawToken.slice(-8),
        maxValidationCount: 1000,
        issuedAt: new Date(),
        expiresAt,
        intendedHolderUserId: booking.customerUserId ?? null,
        metadata: {
          bookingOrderId,
          sourceRoute: 'access.issue_ticket',
        },
      })
      .returning()

    await db.insert(accessArtifactEvents).values({
      bizId,
      accessArtifactId: artifact.id,
      eventType: 'issued',
      happenedAt: new Date(),
      actorUserId,
      outcome: 'allowed',
      reasonCode: 'ticket_issued',
      payload: {
        bookingOrderId,
        actionTokenId: token.id,
      },
      metadata: {
        sourceRoute: 'access.issue_ticket',
      },
    })

    const attendanceObligation =
      parsed.data.autoCreateAttendanceObligation
        ? await ensureAttendanceObligation({
            bizId,
            bookingOrderId,
            participantUserId: booking.customerUserId ?? null,
            accessArtifactId: artifact.id,
          })
        : null

    const qrValue = makeTicketQrValue(rawToken)
    const deliveryMessages = []
    const recipientRef =
      booking.customerUserId ? `user:${booking.customerUserId}` : `booking:${bookingOrderId}`
    for (const channel of parsed.data.deliveryChannels) {
      deliveryMessages.push(
        await createTicketDeliveryMessage({
          bizId,
          bookingOrderId,
          recipientUserId: booking.customerUserId ?? null,
          recipientRef,
          channel: channel === 'app' ? 'push' : 'email',
          subject: `Your ticket for booking ${bookingOrderId}`,
          body: `Present code ${publicCode} or scan the QR ticket to check in.`,
          accessArtifactId: artifact.id,
          publicCode,
          qrValue,
        }),
      )
    }

    return ok(
      c,
      {
        artifact,
        token: {
          id: token.id,
          tokenType: token.tokenType,
          tokenPreview: token.tokenPreview,
          rawToken,
          qrValue,
          expiresAt,
        },
        attendanceObligation,
        deliveryMessages,
      },
      201,
    )
  },
)

accessRoutes.get(
  '/bizes/:bizId/booking-orders/:bookingOrderId/tickets',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const links = await db.query.accessArtifactLinks.findMany({
      where: and(
        eq(accessArtifactLinks.bizId, bizId),
        eq(accessArtifactLinks.linkType, 'booking_order'),
        eq(accessArtifactLinks.bookingOrderId, bookingOrderId),
      ),
    })
    const rows = await Promise.all(
      links.map(async (link) => {
        const artifact = await db.query.accessArtifacts.findFirst({
          where: and(eq(accessArtifacts.bizId, bizId), eq(accessArtifacts.id, link.accessArtifactId)),
        })
        if (!artifact) return null
        const context = await loadTicketContext(bizId, artifact.id)
        return {
          artifact,
          ...context,
        }
      }),
    )
    return ok(c, rows.filter(Boolean))
  },
)

accessRoutes.post(
  '/bizes/:bizId/tickets/:accessArtifactId/reissue',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, accessArtifactId } = c.req.param()
    const parsed = reissueTicketBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const artifact = await db.query.accessArtifacts.findFirst({
      where: and(eq(accessArtifacts.bizId, bizId), eq(accessArtifacts.id, accessArtifactId)),
    })
    if (!artifact) return fail(c, 'NOT_FOUND', 'Ticket artifact not found.', 404)

    const context = await loadTicketContext(bizId, accessArtifactId)
    if (!context.booking) return fail(c, 'NOT_FOUND', 'Ticket is not linked to a booking order.', 404)

    await db
      .update(accessActionTokens)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(accessActionTokens.bizId, bizId),
          eq(accessActionTokens.accessArtifactId, accessArtifactId),
          eq(accessActionTokens.status, 'active'),
        ),
      )

    const rawToken = randomCode('qr_', 30)
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + parsed.data.tokenTtlHours * 60 * 60 * 1000)
    const [token] = await db
      .insert(accessActionTokens)
      .values({
        bizId,
        accessArtifactId,
        actionType: 'verify',
        tokenType: 'qr_code',
        status: 'active',
        tokenHash,
        tokenPreview: rawToken.slice(-8),
        maxValidationCount: 1000,
        issuedAt: new Date(),
        expiresAt,
        intendedHolderUserId: artifact.holderUserId ?? null,
        metadata: {
          bookingOrderId: context.booking.id,
          reissueReason: parsed.data.reason,
          ...parsed.data.metadata,
        },
      })
      .returning()

    await db.insert(accessArtifactEvents).values({
      bizId,
      accessArtifactId,
      eventType: 'reissued',
      happenedAt: new Date(),
      actorUserId: getCurrentUser(c)?.id ?? null,
      outcome: 'allowed',
      reasonCode: parsed.data.reason,
      payload: {
        bookingOrderId: context.booking.id,
        actionTokenId: token.id,
      },
      metadata: {
        sourceRoute: 'access.reissue_ticket',
      },
    })

    const qrValue = makeTicketQrValue(rawToken)
    const deliveryMessages = []
    const recipientRef =
      context.booking.customerUserId ? `user:${context.booking.customerUserId}` : `booking:${context.booking.id}`
    for (const channel of parsed.data.deliveryChannels) {
      deliveryMessages.push(
        await createTicketDeliveryMessage({
          bizId,
          bookingOrderId: context.booking.id,
          recipientUserId: context.booking.customerUserId ?? null,
          recipientRef,
          channel: channel === 'app' ? 'push' : 'email',
          subject: `Updated ticket for booking ${context.booking.id}`,
          body: `Your ticket has been refreshed. Use code ${artifact.publicCode}.`,
          accessArtifactId,
          publicCode: artifact.publicCode ?? '',
          qrValue,
        }),
      )
    }

    return ok(c, {
      artifact,
      token: {
        id: token.id,
        tokenPreview: token.tokenPreview,
        rawToken,
        qrValue,
        expiresAt,
      },
      deliveryMessages,
    })
  },
)

accessRoutes.post('/public/bizes/:bizId/tickets/resolve', async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = resolveTicketBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const resolved = await findTicketByTokenOrCode({
    bizId,
    token: parsed.data.token,
    publicCode: parsed.data.publicCode,
  })
  if (!resolved) return fail(c, 'NOT_FOUND', 'Ticket not found.', 404)

  const context = await loadTicketContext(bizId, resolved.artifact.id)
  return ok(c, {
    artifact: resolved.artifact,
    token: resolved.actionToken
      ? {
          id: resolved.actionToken.id,
          tokenPreview: resolved.actionToken.tokenPreview,
          status: resolved.actionToken.status,
          expiresAt: resolved.actionToken.expiresAt,
        }
      : null,
    booking: context.booking,
    attendanceObligation: context.attendanceObligation,
  })
})

/**
 * Scan/verify one ticket.
 *
 * ELI5:
 * The QR code is the credential. When somebody scans it, we verify the token,
 * append an immutable event, and optionally move the booking/attendance state
 * into "checked in".
 */
accessRoutes.post('/public/bizes/:bizId/tickets/scan', async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = scanTicketBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const resolved = await findTicketByTokenOrCode({
    bizId,
    token: parsed.data.token,
    publicCode: parsed.data.publicCode,
  })
  if (!resolved || !resolved.actionToken) return fail(c, 'NOT_FOUND', 'Ticket token not found.', 404)

  const now = new Date()
  const artifact = resolved.artifact
  const token = resolved.actionToken
  if (artifact.status !== 'active' || token.status !== 'active') {
    return fail(c, 'NOT_SCANNABLE', 'Ticket is not active.', 409, {
      artifactStatus: artifact.status,
      tokenStatus: token.status,
    })
  }
  if (artifact.expiresAt && artifact.expiresAt.getTime() < now.getTime()) {
    return fail(c, 'EXPIRED', 'Ticket has expired.', 409)
  }
  if (token.expiresAt && token.expiresAt.getTime() < now.getTime()) {
    return fail(c, 'EXPIRED', 'Ticket token has expired.', 409)
  }

  const context = await loadTicketContext(bizId, artifact.id)
  const effectiveEventAt = parsed.data.offlineCapturedAt ? new Date(parsed.data.offlineCapturedAt) : now
  const requestKey =
    parsed.data.requestKey ??
    (parsed.data.deviceRef && parsed.data.offlineCapturedAt
      ? `${artifact.id}:${parsed.data.deviceRef}:${parsed.data.offlineCapturedAt}`
      : undefined)

  let existingEvent = null
  if (requestKey) {
    existingEvent = await db.query.accessArtifactEvents.findFirst({
      where: and(eq(accessArtifactEvents.bizId, bizId), eq(accessArtifactEvents.requestKey, requestKey)),
    })
  }
  if (!existingEvent) {
    await db.insert(accessArtifactEvents).values({
      bizId,
      accessArtifactId: artifact.id,
      eventType: 'verified',
      happenedAt: effectiveEventAt,
      outcome: 'allowed',
      requestKey: requestKey ?? null,
      reasonCode: parsed.data.markCheckedIn ? 'ticket_checked_in' : 'ticket_verified',
      payload: {
        scannerMode: parsed.data.scannerMode,
        deviceRef: parsed.data.deviceRef ?? null,
        offlineCapturedAt: parsed.data.offlineCapturedAt ?? null,
      },
      metadata: parsed.data.metadata ?? {},
    })
  }

  await db
    .update(accessActionTokens)
    .set({
      successfulValidationCount: token.successfulValidationCount + 1,
      firstValidatedAt: token.firstValidatedAt ?? effectiveEventAt,
      lastValidatedAt: effectiveEventAt,
    })
    .where(and(eq(accessActionTokens.bizId, bizId), eq(accessActionTokens.id, token.id)))

  if (parsed.data.markCheckedIn && context.booking) {
    await db
      .update(bookingOrders)
      .set({
        status: 'checked_in',
        metadata: {
          ...(typeof context.booking.metadata === 'object' && context.booking.metadata ? context.booking.metadata : {}),
          checkedInAt: effectiveEventAt.toISOString(),
          checkInScannerMode: parsed.data.scannerMode,
          accessArtifactId: artifact.id,
        },
      })
      .where(and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, context.booking.id)))

    if (context.attendanceObligation) {
      await db
        .update(bookingParticipantObligations)
        .set({
          status: 'satisfied',
          satisfiedAt: effectiveEventAt,
          statusReason: 'checked_in',
          metadata: {
            ...(typeof context.attendanceObligation.metadata === 'object' && context.attendanceObligation.metadata
              ? context.attendanceObligation.metadata
              : {}),
            checkedInAt: effectiveEventAt.toISOString(),
            scannerMode: parsed.data.scannerMode,
          },
        })
        .where(
          and(
            eq(bookingParticipantObligations.bizId, bizId),
            eq(bookingParticipantObligations.id, context.attendanceObligation.id),
          ),
        )

      await db.insert(participantObligationEvents).values({
        bizId,
        bookingParticipantObligationId: context.attendanceObligation.id,
        eventType: 'satisfied',
        note: 'Attendance obligation satisfied by ticket scan.',
        metadata: {
          accessArtifactId: artifact.id,
          scannerMode: parsed.data.scannerMode,
          offlineCapturedAt: parsed.data.offlineCapturedAt ?? null,
        },
      })
    }
  }

  const refreshed = await loadTicketContext(bizId, artifact.id)
  return ok(c, {
    artifact,
    booking: refreshed.booking,
    attendanceObligation: refreshed.attendanceObligation,
    scannedAt: effectiveEventAt.toISOString(),
    offlineSynced: Boolean(parsed.data.offlineCapturedAt),
  })
})

accessRoutes.post(
  '/bizes/:bizId/booking-orders/:bookingOrderId/no-show',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const parsed = markNoShowBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const happenedAt = parsed.data.happenedAt ? new Date(parsed.data.happenedAt) : new Date()
    const attendanceObligation =
      booking.customerUserId
        ? await db.query.bookingParticipantObligations.findFirst({
            where: and(
              eq(bookingParticipantObligations.bizId, bizId),
              eq(bookingParticipantObligations.bookingOrderId, bookingOrderId),
              eq(bookingParticipantObligations.participantUserId, booking.customerUserId),
              eq(bookingParticipantObligations.obligationType, 'attendance'),
            ),
          })
        : null

    if (attendanceObligation) {
      await db
        .update(bookingParticipantObligations)
        .set({
          status: 'overdue',
          statusReason: parsed.data.reason,
          metadata: {
            ...(typeof attendanceObligation.metadata === 'object' && attendanceObligation.metadata
              ? attendanceObligation.metadata
              : {}),
            noShowAt: happenedAt.toISOString(),
            ...parsed.data.metadata,
          },
        })
        .where(
          and(
            eq(bookingParticipantObligations.bizId, bizId),
            eq(bookingParticipantObligations.id, attendanceObligation.id),
          ),
        )

      await db.insert(participantObligationEvents).values({
        bizId,
        bookingParticipantObligationId: attendanceObligation.id,
        eventType: 'updated',
        note: 'Attendance marked as no-show.',
        metadata: {
          noShowAt: happenedAt.toISOString(),
          reason: parsed.data.reason,
        },
      })
    }

    const ticketLinks = await db.query.accessArtifactLinks.findMany({
      where: and(
        eq(accessArtifactLinks.bizId, bizId),
        eq(accessArtifactLinks.linkType, 'booking_order'),
        eq(accessArtifactLinks.bookingOrderId, bookingOrderId),
      ),
    })

    for (const link of ticketLinks) {
      await db.insert(accessArtifactEvents).values({
        bizId,
        accessArtifactId: link.accessArtifactId,
        eventType: 'verification_failed',
        happenedAt,
        outcome: 'expired',
        reasonCode: 'no_show',
        reasonText: parsed.data.reason,
        payload: parsed.data.metadata ?? {},
      })
    }

    await db
      .update(bookingOrders)
      .set({
        metadata: {
          ...(typeof booking.metadata === 'object' && booking.metadata ? booking.metadata : {}),
          noShowAt: happenedAt.toISOString(),
          noShowReason: parsed.data.reason,
        },
      })
      .where(and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)))

    return ok(c, {
      bookingOrderId,
      noShowAt: happenedAt.toISOString(),
      attendanceObligationId: attendanceObligation?.id ?? null,
      ticketArtifactIds: ticketLinks.map((row) => row.accessArtifactId),
    })
  },
)
