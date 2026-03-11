import dbPackage from '@bizing/db'

const { db, outboundMessages, outboundMessageEvents } = dbPackage

export type SimulatedOutboundChannel = 'email' | 'sms' | 'push' | 'whatsapp' | 'voice'
export type SimulatedOutboundPurpose = 'transactional' | 'marketing' | 'operational' | 'legal'
export type SimulatedOutboundStatus = 'queued' | 'sent' | 'delivered' | 'failed'

function defaultProviderKey(channel: SimulatedOutboundChannel) {
  if (channel === 'email') return 'simulated_email'
  if (channel === 'sms') return 'simulated_sms'
  if (channel === 'push') return 'simulated_push'
  if (channel === 'whatsapp') return 'simulated_whatsapp'
  return 'simulated_voice'
}

export async function dispatchSimulatedOutboundMessage(input: {
  bizId: string
  channel: SimulatedOutboundChannel
  purpose: SimulatedOutboundPurpose
  recipientRef: string
  recipientUserId?: string | null
  recipientGroupAccountId?: string | null
  status?: SimulatedOutboundStatus
  providerKey?: string
  providerMessageRef?: string
  payload?: Record<string, unknown>
  metadata?: Record<string, unknown>
}) {
  const now = new Date()
  const nextStatus = input.status ?? 'delivered'
  const providerKey = input.providerKey ?? defaultProviderKey(input.channel)
  const providerMessageRef =
    input.providerMessageRef ??
    `${providerKey}:${now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}:${Math.random().toString(36).slice(2, 8)}`

  const [message] = await db
    .insert(outboundMessages)
    .values({
      bizId: input.bizId,
      channel: input.channel,
      purpose: input.purpose,
      recipientUserId: input.recipientUserId ?? null,
      recipientGroupAccountId: input.recipientGroupAccountId ?? null,
      recipientRef: input.recipientRef,
      status: nextStatus,
      scheduledFor: now,
      sentAt: nextStatus === 'queued' ? null : now,
      deliveredAt: nextStatus === 'delivered' ? now : null,
      failedAt: nextStatus === 'failed' ? now : null,
      providerKey,
      providerMessageRef,
      payload: input.payload ?? {},
      metadata: input.metadata ?? {},
    })
    .returning()

  const baseEvents: Array<typeof outboundMessageEvents.$inferInsert> = [
    {
      bizId: input.bizId,
      outboundMessageId: message.id,
      eventType: 'queued',
      occurredAt: now,
      payload: { providerKey, providerMessageRef },
    },
  ]

  if (nextStatus === 'sent' || nextStatus === 'delivered' || nextStatus === 'failed') {
    baseEvents.push({
      bizId: input.bizId,
      outboundMessageId: message.id,
      eventType: 'sent',
      occurredAt: now,
      payload: { providerKey, providerMessageRef },
    })
  }

  if (nextStatus === 'delivered') {
    baseEvents.push({
      bizId: input.bizId,
      outboundMessageId: message.id,
      eventType: 'delivered',
      occurredAt: now,
      payload: { recipientRef: input.recipientRef },
    })
  }

  if (nextStatus === 'failed') {
    baseEvents.push({
      bizId: input.bizId,
      outboundMessageId: message.id,
      eventType: 'failed',
      occurredAt: now,
      payload: { recipientRef: input.recipientRef },
    })
  }

  const events = await db.insert(outboundMessageEvents).values(baseEvents).returning()

  return { message, events }
}
