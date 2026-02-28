import { createHash } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'

const {
  db,
  auditStreams,
  auditEvents,
  outboundMessages,
  users,
} = dbPackage

type AuditActorType = 'user' | 'system' | 'api_key' | 'integration'
type AuditEventType =
  | 'create'
  | 'update'
  | 'delete'
  | 'read'
  | 'state_transition'
  | 'policy_decision'
  | 'payment_event'
  | 'custom'

type AppendAuditEventInput = {
  bizId: string
  streamKey: string
  streamType: string
  entityType: string
  entityId: string
  eventType: AuditEventType
  actorType: AuditActorType
  actorUserId?: string | null
  actorRef?: string | null
  reasonCode?: string | null
  note?: string | null
  requestRef?: string | null
  sourceIp?: string | null
  userAgent?: string | null
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
  diff?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

type OperationalAlertInput = {
  bizId: string
  recipientUserId?: string | null
  recipientRef: string
  subject: string
  body: string
  metadata?: Record<string, unknown> | null
}

function hashPayload(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function ensureAuditStream(input: {
  bizId: string
  streamKey: string
  streamType: string
  entityType: string
  entityId: string
  description?: string | null
}) {
  const existing = await db.query.auditStreams.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.bizId, input.bizId), eq(table.streamKey, input.streamKey)),
  })
  if (existing) return existing

  const [created] = await db
    .insert(auditStreams)
    .values({
      bizId: input.bizId,
      streamKey: input.streamKey,
      streamType: input.streamType,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description ?? null,
      isActive: true,
    })
    .returning()
  return created
}

export async function appendAuditEvent(input: AppendAuditEventInput) {
  const stream = await ensureAuditStream({
    bizId: input.bizId,
    streamKey: input.streamKey,
    streamType: input.streamType,
    entityType: input.entityType,
    entityId: input.entityId,
    description: `${input.entityType}:${input.entityId}`,
  })

  const lastEvent = await db.query.auditEvents.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.bizId, input.bizId), eq(table.streamId, stream.id)),
    orderBy: [desc(auditEvents.sequence)],
  })

  const sequence = (lastEvent?.sequence ?? 0) + 1
  const previousEventHash = lastEvent?.eventHash ?? null
  const occurredAt = new Date()
  const payloadForHash = {
    bizId: input.bizId,
    streamId: stream.id,
    sequence,
    eventType: input.eventType,
    actorType: input.actorType,
    actorUserId: input.actorUserId ?? null,
    actorRef: input.actorRef ?? null,
    occurredAt: occurredAt.toISOString(),
    entityType: input.entityType,
    entityId: input.entityId,
    reasonCode: input.reasonCode ?? null,
    note: input.note ?? null,
    requestRef: input.requestRef ?? null,
    sourceIp: input.sourceIp ?? null,
    userAgent: input.userAgent ?? null,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    diff: input.diff ?? null,
    previousEventHash,
    metadata: input.metadata ?? {},
  }
  const eventHash = hashPayload(payloadForHash)

  const [created] = await db
    .insert(auditEvents)
    .values({
      bizId: input.bizId,
      streamId: stream.id,
      sequence,
      eventType: input.eventType,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      actorRef: input.actorRef ?? null,
      occurredAt,
      entityType: input.entityType,
      entityId: input.entityId,
      reasonCode: input.reasonCode ?? null,
      note: input.note ?? null,
      requestRef: input.requestRef ?? null,
      sourceIp: input.sourceIp ?? null,
      userAgent: input.userAgent ?? null,
      beforeState: input.beforeState ?? null,
      afterState: input.afterState ?? null,
      diff: input.diff ?? null,
      previousEventHash,
      eventHash,
      metadata: input.metadata ?? {},
    })
    .returning()

  return created
}

export async function createOperationalAlert(input: OperationalAlertInput) {
  const recipient =
    input.recipientUserId != null
      ? await db.query.users.findFirst({
          where: eq(users.id, input.recipientUserId),
        })
      : null

  const [message] = await db
    .insert(outboundMessages)
    .values({
      bizId: input.bizId,
      channel: 'email',
      purpose: 'operational',
      recipientUserId: input.recipientUserId ?? null,
      recipientRef: recipient?.email ?? input.recipientRef,
      status: 'queued',
      payload: {
        subject: input.subject,
        body: input.body,
      },
      metadata: input.metadata ?? {},
    })
    .returning()

  return message
}
