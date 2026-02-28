/**
 * Virtual meeting routes.
 *
 * ELI5:
 * A remote booking often needs a real meeting room with settings like:
 * - primary join link,
 * - fallback link,
 * - waiting room,
 * - recording mode,
 * - host-joins-first policy.
 *
 * Why this route exists:
 * - those are booking fulfillment details, not random UI text,
 * - the schema already has generic channel-account and entity-link primitives,
 * - saga validation needs an API proof surface for "this booking got a unique
 *   virtual room with the right safety settings and delivery message".
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const {
  db,
  bookingOrders,
  channelAccounts,
  channelEntityLinks,
  outboundMessages,
  outboundMessageEvents,
} = dbPackage

const upsertVirtualMeetingBodySchema = z.object({
  channelAccountId: z.string(),
  providerLabel: z.enum(['zoom', 'google_meet', 'teams', 'custom']).default('custom'),
  waitingRoomEnabled: z.boolean().default(true),
  recordingMode: z.enum(['disabled', 'optional', 'required']).default('disabled'),
  hostJoinPolicy: z.enum(['host_must_join_first', 'anyone_can_start']).default('host_must_join_first'),
  autoStartEnabled: z.boolean().default(false),
  forceRegenerate: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
})

export const virtualMeetingRoutes = new Hono()

function buildMeetingUrl(providerLabel: string, meetingId: string) {
  switch (providerLabel) {
    case 'zoom':
      return `https://zoom.example.test/j/${meetingId}`
    case 'google_meet':
      return `https://meet.google.example.test/${meetingId}`
    case 'teams':
      return `https://teams.example.test/l/meetup-join/${meetingId}`
    default:
      return `https://video.example.test/room/${meetingId}`
  }
}

virtualMeetingRoutes.get(
  '/bizes/:bizId/booking-orders/:bookingOrderId/virtual-meeting',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const links = await db.query.channelEntityLinks.findMany({
      where: and(
        eq(channelEntityLinks.bizId, bizId),
        eq(channelEntityLinks.objectType, 'custom'),
        eq(channelEntityLinks.bookingOrderId, bookingOrderId),
      ),
      orderBy: [asc(channelEntityLinks.id)],
    })
    const virtualMeetingLink = links.find((row) => row.localReferenceKey === `virtual_meeting:${bookingOrderId}`) ?? null
    const metadata =
      booking.metadata && typeof booking.metadata === 'object' && !Array.isArray(booking.metadata)
        ? (booking.metadata as Record<string, unknown>)
        : {}

    return ok(c, {
      bookingId: booking.id,
      virtualMeeting: metadata.virtualMeeting ?? null,
      channelLink: virtualMeetingLink,
    })
  },
)

virtualMeetingRoutes.post(
  '/bizes/:bizId/booking-orders/:bookingOrderId/virtual-meeting',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const parsed = upsertVirtualMeetingBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [booking, channelAccount] = await Promise.all([
      db.query.bookingOrders.findFirst({
        where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
      }),
      db.query.channelAccounts.findFirst({
        where: and(eq(channelAccounts.bizId, bizId), eq(channelAccounts.id, parsed.data.channelAccountId)),
      }),
    ])
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)
    if (!channelAccount) return fail(c, 'NOT_FOUND', 'Channel account not found.', 404)

    const currentMetadata =
      booking.metadata && typeof booking.metadata === 'object' && !Array.isArray(booking.metadata)
        ? (booking.metadata as Record<string, unknown>)
        : {}
    const existingMeeting =
      currentMetadata.virtualMeeting && typeof currentMetadata.virtualMeeting === 'object'
        ? (currentMetadata.virtualMeeting as Record<string, unknown>)
        : null

    if (existingMeeting && !parsed.data.forceRegenerate) {
      return ok(c, {
        bookingId: booking.id,
        virtualMeeting: existingMeeting,
        reused: true,
      })
    }

    const meetingId = `meet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const primaryJoinUrl = buildMeetingUrl(parsed.data.providerLabel, meetingId)
    const fallbackMeetingId = `${meetingId}_fallback`
    const fallbackJoinUrl = buildMeetingUrl('custom', fallbackMeetingId)

    const virtualMeeting = {
      meetingId,
      providerLabel: parsed.data.providerLabel,
      channelAccountId: channelAccount.id,
      primaryJoinUrl,
      fallbackJoinUrl,
      waitingRoomEnabled: parsed.data.waitingRoomEnabled,
      recordingMode: parsed.data.recordingMode,
      hostJoinPolicy: parsed.data.hostJoinPolicy,
      autoStartEnabled: parsed.data.autoStartEnabled,
      generatedAt: new Date().toISOString(),
      ...parsed.data.metadata,
    }

    await db
      .update(bookingOrders)
      .set({
        metadata: {
          ...currentMetadata,
          virtualMeeting,
        },
      })
      .where(and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)))

    const existingLink = await db.query.channelEntityLinks.findFirst({
      where: and(
        eq(channelEntityLinks.bizId, bizId),
        eq(channelEntityLinks.objectType, 'custom'),
        eq(channelEntityLinks.bookingOrderId, bookingOrderId),
        eq(channelEntityLinks.localReferenceKey, `virtual_meeting:${bookingOrderId}`),
      ),
    })
    if (existingLink) {
      await db
        .update(channelEntityLinks)
        .set({
          channelAccountId: channelAccount.id,
          externalObjectId: meetingId,
          externalParentId: fallbackMeetingId,
          syncHash: `${meetingId}:${fallbackMeetingId}`,
          isActive: true,
          metadata: {
            providerLabel: parsed.data.providerLabel,
          },
        })
        .where(and(eq(channelEntityLinks.bizId, bizId), eq(channelEntityLinks.id, existingLink.id)))
    } else {
      await db.insert(channelEntityLinks).values({
        bizId,
        channelAccountId: channelAccount.id,
        objectType: 'custom',
        bookingOrderId,
        localReferenceKey: `virtual_meeting:${bookingOrderId}`,
        externalObjectId: meetingId,
        externalParentId: fallbackMeetingId,
        syncHash: `${meetingId}:${fallbackMeetingId}`,
        isActive: true,
        metadata: {
          providerLabel: parsed.data.providerLabel,
        },
      })
    }

    const [message] = await db
      .insert(outboundMessages)
      .values({
        bizId,
        channel: 'email',
        purpose: 'transactional',
        recipientUserId: booking.customerUserId ?? null,
        recipientRef: booking.customerUserId ? `user:${booking.customerUserId}` : `booking:${bookingOrderId}`,
        status: 'delivered',
        scheduledFor: new Date(),
        sentAt: new Date(),
        deliveredAt: new Date(),
        providerKey: 'simulated_calendar_mail',
        providerMessageRef: `virtual-meeting-${meetingId}-${Date.now()}`,
        payload: {
          subject: `Join link for booking ${bookingOrderId}`,
          body: `Primary: ${primaryJoinUrl}\nFallback: ${fallbackJoinUrl}`,
          calendarInvite: {
            joinUrl: primaryJoinUrl,
            fallbackJoinUrl,
            waitingRoomEnabled: parsed.data.waitingRoomEnabled,
            hostJoinPolicy: parsed.data.hostJoinPolicy,
          },
        },
        metadata: {
          bookingOrderId,
          eventType: 'virtual_meeting.created',
          meetingId,
        },
      })
      .returning()

    await db.insert(outboundMessageEvents).values([
      {
        bizId,
        outboundMessageId: message.id,
        eventType: 'queued',
        payload: { meetingId },
      },
      {
        bizId,
        outboundMessageId: message.id,
        eventType: 'sent',
        payload: { meetingId },
      },
      {
        bizId,
        outboundMessageId: message.id,
        eventType: 'delivered',
        payload: { meetingId },
      },
    ])

    return ok(
      c,
      {
        bookingId: booking.id,
        virtualMeeting,
        deliveryMessageId: message.id,
      },
      201,
    )
  },
)
