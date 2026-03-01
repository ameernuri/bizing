/**
 * Session interaction routes.
 *
 * ELI5:
 * This is the API for things people do during a live or virtual session:
 * - join,
 * - chat,
 * - ask a question,
 * - answer a poll,
 * - watch replay.
 *
 * Why this route exists:
 * - engagement should be a first-class fact, not hidden provider metadata,
 * - virtual-event sagas need deterministic HTTP proofs,
 * - follow-up analytics need one canonical event stream.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const {
  db,
  sessionInteractionEvents,
  sessionInteractionAggregates,
  sessionInteractionArtifacts,
} = dbPackage

const eventBodySchema = z.object({
  sourceType: z.enum(['program_session', 'fulfillment_unit', 'custom_subject']),
  programSessionId: z.string().optional().nullable(),
  fulfillmentUnitId: z.string().optional().nullable(),
  customSessionSubjectType: z.string().max(80).optional().nullable(),
  customSessionSubjectId: z.string().max(140).optional().nullable(),
  participantUserId: z.string().optional().nullable(),
  participantEnrollmentId: z.string().optional().nullable(),
  participantSubjectType: z.string().max(80).optional().nullable(),
  participantSubjectId: z.string().max(140).optional().nullable(),
  interactionType: z.enum([
    'join',
    'leave',
    'chat_message',
    'qna_question',
    'qna_answer',
    'poll_response',
    'reaction',
    'hand_raise',
    'replay_view',
    'custom',
  ]),
  visibility: z.enum(['public', 'participant_only', 'staff_only', 'private']).default('public'),
  occurredAt: z.string().datetime().optional().nullable(),
  threadKey: z.string().max(120).optional().nullable(),
  contentText: z.string().max(10000).optional().nullable(),
  payload: z.record(z.unknown()).optional(),
  requestKey: z.string().max(140).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const aggregateBodySchema = z.object({
  sourceType: z.enum(['program_session', 'fulfillment_unit', 'custom_subject']),
  programSessionId: z.string().optional().nullable(),
  fulfillmentUnitId: z.string().optional().nullable(),
  customSessionSubjectType: z.string().max(80).optional().nullable(),
  customSessionSubjectId: z.string().max(140).optional().nullable(),
  granularity: z.string().min(1).max(24),
  bucketStartAt: z.string().datetime(),
  bucketEndAt: z.string().datetime(),
  interactionType: z.enum([
    'join',
    'leave',
    'chat_message',
    'qna_question',
    'qna_answer',
    'poll_response',
    'reaction',
    'hand_raise',
    'replay_view',
    'custom',
  ]).optional().nullable(),
  eventCount: z.number().int().min(0).default(0),
  uniqueParticipantCount: z.number().int().min(0).default(0),
  lastEventAt: z.string().datetime().optional().nullable(),
  metrics: z.record(z.unknown()).optional(),
})

const artifactBodySchema = z.object({
  sessionInteractionEventId: z.string().min(1),
  artifactType: z.string().min(1).max(60),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  visibility: z.enum(['public', 'participant_only', 'staff_only', 'private']).optional(),
  label: z.string().max(240).optional().nullable(),
  storageProvider: z.string().max(40).optional(),
  storageKey: z.string().min(1).max(1000),
  contentType: z.string().max(120).optional().nullable(),
  byteSize: z.number().int().min(0).optional().nullable(),
  checksum: z.string().max(255).optional().nullable(),
  uploadedByUserId: z.string().optional().nullable(),
  uploadedBySubjectType: z.string().max(80).optional().nullable(),
  uploadedBySubjectId: z.string().max(140).optional().nullable(),
  createdAtSource: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  redactedAt: z.string().datetime().optional().nullable(),
  details: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const sessionInteractionRoutes = new Hono()

sessionInteractionRoutes.get('/bizes/:bizId/session-interactions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const programSessionId = c.req.query('programSessionId')
  const fulfillmentUnitId = c.req.query('fulfillmentUnitId')
  const rows = await db.query.sessionInteractionEvents.findMany({
    where: and(
      eq(sessionInteractionEvents.bizId, bizId),
      programSessionId ? eq(sessionInteractionEvents.programSessionId, programSessionId) : undefined,
      fulfillmentUnitId ? eq(sessionInteractionEvents.fulfillmentUnitId, fulfillmentUnitId) : undefined,
    ),
    orderBy: [asc(sessionInteractionEvents.occurredAt), asc(sessionInteractionEvents.id)],
  })
  return ok(c, rows)
})

sessionInteractionRoutes.post('/bizes/:bizId/session-interactions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = eventBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(sessionInteractionEvents).values({
    bizId,
    ...parsed.data,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
    payload: parsed.data.payload ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

sessionInteractionRoutes.get('/bizes/:bizId/session-interaction-aggregates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const programSessionId = c.req.query('programSessionId')
  const rows = await db.query.sessionInteractionAggregates.findMany({
    where: and(
      eq(sessionInteractionAggregates.bizId, bizId),
      programSessionId ? eq(sessionInteractionAggregates.programSessionId, programSessionId) : undefined,
    ),
    orderBy: [desc(sessionInteractionAggregates.bucketStartsAt)],
  })
  return ok(c, rows)
})

sessionInteractionRoutes.get('/bizes/:bizId/session-engagement-overview', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const programSessionId = c.req.query('programSessionId')
  const fulfillmentUnitId = c.req.query('fulfillmentUnitId')
  const rows = await db.query.sessionInteractionEvents.findMany({
    where: and(
      eq(sessionInteractionEvents.bizId, bizId),
      programSessionId ? eq(sessionInteractionEvents.programSessionId, programSessionId) : undefined,
      fulfillmentUnitId ? eq(sessionInteractionEvents.fulfillmentUnitId, fulfillmentUnitId) : undefined,
    ),
    orderBy: [asc(sessionInteractionEvents.occurredAt), asc(sessionInteractionEvents.id)],
  })
  const countsByType = new Map<string, number>()
  const participantScores = new Map<string, { participantKey: string; score: number; interactions: number }>()
  const uniqueParticipants = new Set<string>()
  for (const row of rows) {
    countsByType.set(row.interactionType, (countsByType.get(row.interactionType) ?? 0) + 1)
    const participantKey =
      row.participantUserId
      ?? row.participantEnrollmentId
      ?? (row.participantSubjectType && row.participantSubjectId ? `${row.participantSubjectType}:${row.participantSubjectId}` : null)
    if (participantKey) {
      uniqueParticipants.add(participantKey)
      const scoreDelta =
        row.interactionType === 'join' ? 1
        : row.interactionType === 'replay_view' ? 1
        : row.interactionType === 'poll_response' ? 2
        : row.interactionType === 'qna_question' ? 3
        : row.interactionType === 'qna_answer' ? 3
        : row.interactionType === 'chat_message' ? 1
        : 1
      const current = participantScores.get(participantKey) ?? { participantKey, score: 0, interactions: 0 }
      current.score += scoreDelta
      current.interactions += 1
      participantScores.set(participantKey, current)
    }
  }
  return ok(c, {
    totals: {
      eventCount: rows.length,
      uniqueParticipants: uniqueParticipants.size,
    },
    countsByType: Object.fromEntries(Array.from(countsByType.entries()).sort(([a], [b]) => a.localeCompare(b))),
    topParticipants: Array.from(participantScores.values()).sort((a, b) => b.score - a.score || b.interactions - a.interactions).slice(0, 10),
    rows,
  })
})

sessionInteractionRoutes.get('/bizes/:bizId/session-interaction-artifacts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const sessionInteractionEventId = c.req.query('sessionInteractionEventId')
  const rows = await db.query.sessionInteractionArtifacts.findMany({
    where: and(
      eq(sessionInteractionArtifacts.bizId, bizId),
      sessionInteractionEventId ? eq(sessionInteractionArtifacts.sessionInteractionEventId, sessionInteractionEventId) : undefined,
    ),
    orderBy: [asc(sessionInteractionArtifacts.sessionInteractionEventId), asc(sessionInteractionArtifacts.id)],
  })
  return ok(c, rows)
})

sessionInteractionRoutes.post('/bizes/:bizId/session-interaction-artifacts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = artifactBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(sessionInteractionArtifacts).values({
    bizId,
    sessionInteractionEventId: parsed.data.sessionInteractionEventId,
    artifactType: parsed.data.artifactType,
    status: parsed.data.status ?? 'active',
    visibility: parsed.data.visibility ?? 'public',
    label: parsed.data.label ?? null,
    storageProvider: parsed.data.storageProvider ?? 's3',
    storageKey: parsed.data.storageKey,
    contentType: parsed.data.contentType ?? null,
    byteSize: parsed.data.byteSize ?? null,
    checksum: parsed.data.checksum ?? null,
    uploadedByUserId: parsed.data.uploadedByUserId ?? null,
    uploadedBySubjectType: parsed.data.uploadedBySubjectType ?? null,
    uploadedBySubjectId: parsed.data.uploadedBySubjectId ?? null,
    createdAtSource: parsed.data.createdAtSource ? new Date(parsed.data.createdAtSource) : null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    redactedAt: parsed.data.redactedAt ? new Date(parsed.data.redactedAt) : null,
    details: parsed.data.details ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

sessionInteractionRoutes.post('/bizes/:bizId/session-interaction-aggregates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = aggregateBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(sessionInteractionAggregates).values({
    bizId,
    sourceType: parsed.data.sourceType,
    programSessionId: parsed.data.programSessionId ?? null,
    fulfillmentUnitId: parsed.data.fulfillmentUnitId ?? null,
    customSessionSubjectType: parsed.data.customSessionSubjectType ?? null,
    customSessionSubjectId: parsed.data.customSessionSubjectId ?? null,
    granularity: parsed.data.granularity,
    bucketStartsAt: new Date(parsed.data.bucketStartAt),
    bucketEndsAt: new Date(parsed.data.bucketEndAt),
    interactionType: parsed.data.interactionType ?? null,
    eventCount: parsed.data.eventCount,
    uniqueParticipantCount: parsed.data.uniqueParticipantCount,
    lastEventAt: parsed.data.lastEventAt ? new Date(parsed.data.lastEventAt) : null,
    metrics: parsed.data.metrics ?? {},
  }).returning()
  return ok(c, row, 201)
})
