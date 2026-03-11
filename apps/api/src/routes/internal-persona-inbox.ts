/**
 * Internal persona inbox routes.
 *
 * ELI5:
 * This is a debug-only mirror inbox for persona actors (like Sarah) so we can
 * inspect email/SMS/push outcomes without touching real providers.
 *
 * Important:
 * - these routes are internal-only,
 * - they still persist via the real outbound message tables/events so workflow
 *   behavior stays consistent with production pipelines.
 */

import { Hono } from 'hono'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAuth, requireBizAccess, requirePlatformAdmin } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parseJsonBody, parsePositiveInt, parseQuery } from './_api.js'
import { dispatchSimulatedOutboundMessage } from '../services/simulated-outbound-dispatch.js'

const { db, outboundMessages, outboundMessageEvents } = dbPackage

const personaCatalog = [
  {
    personaKey: 'sarah',
    displayName: 'Sarah',
    defaults: {
      email: 'sarah@persona.bizing.local',
      sms: '+15551001001',
      push: 'persona:sarah',
    },
  },
  {
    personaKey: 'marcus',
    displayName: 'Marcus',
    defaults: {
      email: 'marcus@persona.bizing.local',
      sms: '+15551001002',
      push: 'persona:marcus',
    },
  },
  {
    personaKey: 'noah',
    displayName: 'Noah',
    defaults: {
      email: 'noah@persona.bizing.local',
      sms: '+15551001003',
      push: 'persona:noah',
    },
  },
] as const

const channelSchema = z.enum(['email', 'sms', 'push'])
const statusSchema = z.enum(['queued', 'sent', 'delivered', 'failed'])
const purposeSchema = z.enum(['transactional', 'marketing', 'operational', 'legal'])

const listPersonaQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.string().optional(),
})

const listPersonaMessagesQuerySchema = z.object({
  channel: channelSchema.optional(),
  status: statusSchema.optional(),
  limit: z.string().optional(),
})

const simulatePersonaMessageBodySchema = z.object({
  channel: channelSchema.default('email'),
  purpose: purposeSchema.default('transactional'),
  status: statusSchema.default('delivered'),
  recipientRef: z.string().max(500).optional(),
  subject: z.string().max(300).optional(),
  title: z.string().max(200).optional(),
  body: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

function normalizePersonaKey(raw: string) {
  const cleaned = sanitizePlainText(raw).toLowerCase().replace(/\s+/g, '-')
  return cleaned.replace(/[^a-z0-9_-]/g, '').slice(0, 80)
}

function fallbackPersonaRecipient(personaKey: string, channel: z.infer<typeof channelSchema>) {
  const known = personaCatalog.find((persona) => persona.personaKey === personaKey)
  if (known) return known.defaults[channel]
  if (channel === 'email') return `${personaKey || 'persona'}@persona.bizing.local`
  if (channel === 'sms') return '+15550000000'
  return `persona:${personaKey || 'persona'}`
}

function personaDisplayName(personaKey: string) {
  const known = personaCatalog.find((persona) => persona.personaKey === personaKey)
  if (known) return known.displayName
  if (!personaKey) return 'Persona'
  return personaKey
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

type PersonaStatsRow = {
  personaKey: string
  displayName: string
  messageCount: number
  deliveredCount: number
  failedCount: number
  lastSentAt: string | null
  channels: string[]
}

export const internalPersonaInboxRoutes = new Hono()

internalPersonaInboxRoutes.get(
  '/bizes/:bizId/persona-inboxes',
  requireAuth,
  requirePlatformAdmin,
  requireBizAccess('bizId'),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = parseQuery(c, listPersonaQuerySchema)
    if (!parsed.ok) return parsed.response

    const limit = Math.min(parsePositiveInt(parsed.data.limit, 100), 500)
    const search = sanitizePlainText(parsed.data.search ?? '').toLowerCase()

    const rows = await db.query.outboundMessages.findMany({
      where: eq(outboundMessages.bizId, bizId),
      orderBy: [desc(outboundMessages.sentAt), desc(outboundMessages.scheduledFor), desc(outboundMessages.id)],
      limit,
    })

    const stats = new Map<string, PersonaStatsRow>()
    for (const preset of personaCatalog) {
      stats.set(preset.personaKey, {
        personaKey: preset.personaKey,
        displayName: preset.displayName,
        messageCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        lastSentAt: null,
        channels: [],
      })
    }

    for (const row of rows) {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>
      const rawKey = typeof metadata.personaKey === 'string' ? metadata.personaKey : ''
      const personaKey = normalizePersonaKey(rawKey)
      if (!personaKey) continue

      const existing = stats.get(personaKey) ?? {
        personaKey,
        displayName: personaDisplayName(personaKey),
        messageCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        lastSentAt: null,
        channels: [],
      }
      existing.messageCount += 1
      if (row.status === 'delivered') existing.deliveredCount += 1
      if (row.status === 'failed') existing.failedCount += 1
      if (row.channel && !existing.channels.includes(row.channel)) {
        existing.channels.push(row.channel)
      }
      const sentAt = row.sentAt?.toISOString() ?? row.scheduledFor?.toISOString() ?? null
      if (sentAt && (!existing.lastSentAt || sentAt > existing.lastSentAt)) {
        existing.lastSentAt = sentAt
      }
      stats.set(personaKey, existing)
    }

    const data = Array.from(stats.values())
      .filter((row) => {
        if (!search) return true
        return row.personaKey.includes(search) || row.displayName.toLowerCase().includes(search)
      })
      .sort((a, b) => {
        if (a.lastSentAt && b.lastSentAt) return a.lastSentAt < b.lastSentAt ? 1 : -1
        if (a.lastSentAt) return -1
        if (b.lastSentAt) return 1
        return a.displayName.localeCompare(b.displayName)
      })

    return ok(c, data)
  },
)

internalPersonaInboxRoutes.get(
  '/bizes/:bizId/persona-inboxes/:personaKey/messages',
  requireAuth,
  requirePlatformAdmin,
  requireBizAccess('bizId'),
  async (c) => {
    const bizId = c.req.param('bizId')
    const personaKey = normalizePersonaKey(c.req.param('personaKey'))
    if (!personaKey) return fail(c, 'VALIDATION_ERROR', 'Invalid persona key.', 400)

    const parsed = parseQuery(c, listPersonaMessagesQuerySchema)
    if (!parsed.ok) return parsed.response

    const limit = Math.min(parsePositiveInt(parsed.data.limit, 50), 200)

    const where = and(
      eq(outboundMessages.bizId, bizId),
      sql`${outboundMessages.metadata} ->> 'personaKey' = ${personaKey}`,
      parsed.data.channel ? eq(outboundMessages.channel, parsed.data.channel) : undefined,
      parsed.data.status ? eq(outboundMessages.status, parsed.data.status) : undefined,
    )

    const messages = await db.query.outboundMessages.findMany({
      where,
      orderBy: [desc(outboundMessages.sentAt), desc(outboundMessages.scheduledFor), desc(outboundMessages.id)],
      limit,
    })

    const messageIds = messages.map((row) => row.id)
    const events =
      messageIds.length > 0
        ? await db.query.outboundMessageEvents.findMany({
            where: and(
              eq(outboundMessageEvents.bizId, bizId),
              inArray(outboundMessageEvents.outboundMessageId, messageIds),
            ),
            orderBy: [desc(outboundMessageEvents.occurredAt), desc(outboundMessageEvents.id)],
          })
        : []

    const eventsByMessageId = new Map<string, Array<typeof outboundMessageEvents.$inferSelect>>()
    for (const event of events) {
      const collection = eventsByMessageId.get(event.outboundMessageId) ?? []
      collection.push(event)
      eventsByMessageId.set(event.outboundMessageId, collection)
    }

    return ok(
      c,
      messages.map((message) => ({
        ...message,
        events: eventsByMessageId.get(message.id) ?? [],
      })),
    )
  },
)

internalPersonaInboxRoutes.post(
  '/bizes/:bizId/persona-inboxes/:personaKey/messages/simulate',
  requireAuth,
  requirePlatformAdmin,
  requireBizAccess('bizId'),
  async (c) => {
    const bizId = c.req.param('bizId')
    const personaKey = normalizePersonaKey(c.req.param('personaKey'))
    if (!personaKey) return fail(c, 'VALIDATION_ERROR', 'Invalid persona key.', 400)

    const parsed = await parseJsonBody(c, simulatePersonaMessageBodySchema, 'Invalid simulated message payload.')
    if (!parsed.ok) return parsed.response

    const input = parsed.data
    const subject = input.subject ? sanitizePlainText(input.subject) : undefined
    const title = input.title ? sanitizePlainText(input.title) : undefined
    const body = input.body ? sanitizePlainText(input.body) : ''
    const recipientRef = input.recipientRef
      ? sanitizePlainText(input.recipientRef)
      : fallbackPersonaRecipient(personaKey, input.channel)

    const payload =
      input.channel === 'email'
        ? {
            subject: subject ?? `Message for ${personaDisplayName(personaKey)}`,
            body: body || 'Automated message simulation.',
          }
        : input.channel === 'sms'
          ? {
              body: body || 'Automated SMS simulation.',
            }
          : {
              title: title ?? `Notification for ${personaDisplayName(personaKey)}`,
              body: body || 'Automated push simulation.',
            }

    const { message, events } = await dispatchSimulatedOutboundMessage({
      bizId,
      channel: input.channel,
      purpose: input.purpose,
      status: input.status,
      recipientRef,
      payload,
      metadata: sanitizeUnknown({
        ...input.metadata,
        personaKey,
        personaLabel: personaDisplayName(personaKey),
        source: 'internal_persona_inbox',
        simulated: true,
      }) as Record<string, unknown>,
      providerMessageRef: `persona-${personaKey}-${Date.now()}`,
    })

    return ok(c, { message, events }, 201)
  },
)
