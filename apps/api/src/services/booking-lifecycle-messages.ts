import { dispatchSimulatedOutboundMessage } from './simulated-outbound-dispatch.js'

/**
 * Persist one simulated booking lifecycle message.
 *
 * ELI5:
 * The system often needs to prove "the customer would have received a message"
 * even when we are not connected to a real email provider in development or in
 * deterministic saga tests.
 *
 * So instead of sending a real email here, we save the message we would have
 * sent plus the delivery events we would expect. That makes the message:
 * - queryable through the API,
 * - testable by sagas,
 * - inspectable by humans and agents during debugging.
 *
 * Why this lives in a service:
 * Both direct booking routes and the new canonical action runtime need the
 * exact same side effect. Keeping the logic in one place prevents the two paths
 * from drifting and creating inconsistent evidence.
 */
export async function createBookingLifecycleMessage(input: {
  bizId: string
  recipientUserId?: string | null
  recipientRef: string
  bookingOrderId: string
  subject: string
  body: string
  templateSlug: string
  eventType: 'booking.confirmed' | 'booking.cancelled'
}) {
  const { message } = await dispatchSimulatedOutboundMessage({
    bizId: input.bizId,
    channel: 'email',
    purpose: 'transactional',
    recipientUserId: input.recipientUserId ?? null,
    recipientRef: input.recipientRef,
    status: 'delivered',
    providerKey: 'simulated_email',
    providerMessageRef: `${input.templateSlug}-${input.bookingOrderId}`,
    payload: {
      subject: input.subject,
      body: input.body,
    },
    metadata: {
      bookingOrderId: input.bookingOrderId,
      eventType: input.eventType,
      templateSlug: input.templateSlug,
    },
  })

  return message
}
