/**
 * Instrument API.
 *
 * ELI5:
 * "Instrument" is the one reusable system for:
 * - intake forms,
 * - waivers,
 * - checklists,
 * - surveys,
 * - quizzes/assessments.
 *
 * Why this route family exists:
 * - the schema already unified these concepts into one canonical backbone
 * - the API still needed a first-class surface so sagas and real UIs can use
 *   that backbone without inventing ad-hoc tables or one-off endpoints
 * - this route keeps definition management, binding, runtime execution, and
 *   submission history in one coherent place
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok, parsePositiveInt } from './_api.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'

const {
  db,
  instruments,
  instrumentItems,
  instrumentBindings,
  instrumentRuns,
  instrumentResponses,
  instrumentEvents,
  subjects,
} = dbPackage

const lifecycleStatuses = ['draft', 'active', 'inactive', 'archived'] as const
const instrumentTypes = ['intake_form', 'quiz', 'assessment', 'checklist', 'survey', 'other'] as const
const instrumentEvaluationModes = ['none', 'auto', 'manual', 'hybrid'] as const
const instrumentItemTypes = [
  'single_choice',
  'multi_choice',
  'text',
  'numeric',
  'boolean',
  'date',
  'datetime',
  'file_upload',
  'signature',
  'attestation',
  'custom',
] as const
const instrumentRunStatuses = ['pending', 'in_progress', 'submitted', 'evaluating', 'completed', 'expired', 'waived', 'cancelled'] as const
const instrumentResultStatuses = ['pending', 'passed', 'failed', 'waived', 'invalidated'] as const
const requirementModes = ['required', 'optional'] as const
const targetTypes = [
  'biz',
  'location',
  'user',
  'group_account',
  'resource',
  'service',
  'service_product',
  'offer',
  'offer_version',
  'product',
  'sellable',
  'booking_order',
  'booking_order_line',
  'fulfillment_unit',
  'payment_intent',
  'queue_entry',
  'trip',
  'custom',
] as const

const listInstrumentsQuerySchema = z.object({
  status: z.enum(lifecycleStatuses).optional(),
  instrumentType: z.enum(instrumentTypes).optional(),
  currentOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const createInstrumentBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  version: z.number().int().positive().default(1),
  isCurrent: z.boolean().default(false),
  instrumentType: z.enum(instrumentTypes),
  status: z.enum(lifecycleStatuses).default('draft'),
  evaluationMode: z.enum(instrumentEvaluationModes).default('none'),
  description: z.string().max(5000).optional().nullable(),
  schemaSnapshot: z.record(z.unknown()).optional(),
  validationPolicy: z.record(z.unknown()).optional(),
  scoringPolicy: z.record(z.unknown()).optional(),
  completionPolicy: z.record(z.unknown()).optional(),
  passScorePercent: z.number().int().min(0).max(100).optional().nullable(),
  maxAttempts: z.number().int().positive().optional().nullable(),
  attemptDurationSeconds: z.number().int().positive().optional().nullable(),
  requiresSignature: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
})

const patchInstrumentBodySchema = createInstrumentBodySchema.partial()

const createInstrumentItemBodySchema = z.object({
  itemKey: z.string().min(1).max(140),
  prompt: z.string().min(1).max(5000),
  description: z.string().max(5000).optional().nullable(),
  itemType: z.enum(instrumentItemTypes),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(100),
  maxScore: z.number().int().min(0).default(0),
  config: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createInstrumentBindingBodySchema = z.object({
  instrumentId: z.string().min(1),
  targetType: z.enum(targetTypes),
  triggerEvent: z.string().min(1).max(180),
  requirementMode: z.enum(requirementModes).default('required'),
  locationId: z.string().min(1).optional().nullable(),
  serviceId: z.string().min(1).optional().nullable(),
  serviceProductId: z.string().min(1).optional().nullable(),
  offerId: z.string().min(1).optional().nullable(),
  offerVersionId: z.string().min(1).optional().nullable(),
  priority: z.number().int().min(0).default(100),
  conditionExpr: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const createInstrumentRunBodySchema = z.object({
  instrumentId: z.string().min(1),
  targetType: z.enum(targetTypes),
  targetRefId: z.string().min(1).max(140),
  assigneeSubjectBizId: z.string().min(1),
  assigneeSubjectType: z.string().min(1).max(80),
  assigneeSubjectId: z.string().min(1),
  status: z.enum(instrumentRunStatuses).default('pending'),
  attemptNumber: z.number().int().positive().default(1),
  requestKey: z.string().min(1).max(140).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  responsePayload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const appendInstrumentResponsesBodySchema = z.object({
  responses: z
    .array(
      z.object({
        instrumentItemId: z.string().min(1).optional().nullable(),
        itemKey: z.string().min(1).max(140),
        value: z.unknown(),
        normalizedText: z.string().optional().nullable(),
        normalizedNumber: z.number().int().optional().nullable(),
        normalizedBoolean: z.boolean().optional().nullable(),
        score: z.number().int().min(0).optional().nullable(),
        feedback: z.string().max(5000).optional().nullable(),
        isFinal: z.boolean().default(true),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .min(1),
  mergeIntoRunPayload: z.boolean().default(true),
})

const submitInstrumentRunBodySchema = z.object({
  responsePayload: z.record(z.unknown()).optional(),
  evaluationSummary: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const evaluateInstrumentRunBodySchema = z.object({
  scorePercent: z.number().int().min(0).max(100).optional().nullable(),
  maxScore: z.number().int().min(0).optional().nullable(),
  resultStatus: z.enum(instrumentResultStatuses).optional().nullable(),
  evaluationSummary: z.string().max(5000).optional().nullable(),
  status: z.enum(instrumentRunStatuses).default('completed'),
  metadata: z.record(z.unknown()).optional(),
})

function instrumentRunBelongsToCurrentUser(run: {
  assigneeSubjectType: string
  assigneeSubjectId: string
}, userId: string) {
  /**
   * ELI5:
   * A customer/public route should only expose runs assigned to that same user.
   * We keep the first rule simple and explicit:
   * - if the assignee is a `user`
   * - and the assignee id matches the current authenticated user id
   * then that user owns the run for public self-service purposes.
   */
  return run.assigneeSubjectType === 'user' && run.assigneeSubjectId === userId
}

async function ensureInstrumentSubject(params: {
  bizId: string
  subjectType: string
  subjectId: string
}) {
  const where = and(
    eq(subjects.bizId, params.bizId),
    eq(subjects.subjectType, params.subjectType),
    eq(subjects.subjectId, params.subjectId),
  )
  const existing = await db.query.subjects.findFirst({ where })
  if (existing) return existing

  await db
    .insert(subjects)
    .values({
      bizId: params.bizId,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      category: 'person',
      status: 'active',
      isLinkable: true,
      displayName: params.subjectType === 'user' ? 'Instrument assignee' : undefined,
      metadata: sanitizeUnknown({ source: 'instrument-runs' }),
    })
    .onConflictDoNothing()

  return db.query.subjects.findFirst({ where })
}

export const instrumentRoutes = new Hono()

instrumentRoutes.get(
  '/bizes/:bizId/instruments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listInstrumentsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query.', 400, parsed.error.flatten())
    const limit = parsed.data.limit ?? 100
    const offset = parsed.data.offset ?? 0

    const rows = await db.query.instruments.findMany({
      where: and(
        eq(instruments.bizId, bizId),
        parsed.data.status ? eq(instruments.status, parsed.data.status) : undefined,
        parsed.data.instrumentType ? eq(instruments.instrumentType, parsed.data.instrumentType) : undefined,
        parsed.data.currentOnly ? eq(instruments.isCurrent, true) : undefined,
      ),
      orderBy: [desc(instruments.isCurrent), asc(instruments.instrumentType), asc(instruments.slug), desc(instruments.version)],
      limit,
      offset,
    })

    return ok(c, rows)
  },
)

instrumentRoutes.post(
  '/bizes/:bizId/instruments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createInstrumentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [row] = await db.insert(instruments).values({
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      version: parsed.data.version,
      isCurrent: parsed.data.isCurrent,
      instrumentType: parsed.data.instrumentType,
      status: parsed.data.status,
      evaluationMode: parsed.data.evaluationMode,
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      schemaSnapshot: sanitizeUnknown(parsed.data.schemaSnapshot ?? {}),
      validationPolicy: sanitizeUnknown(parsed.data.validationPolicy ?? {}),
      scoringPolicy: sanitizeUnknown(parsed.data.scoringPolicy ?? {}),
      completionPolicy: sanitizeUnknown(parsed.data.completionPolicy ?? {}),
      passScorePercent: parsed.data.passScorePercent ?? null,
      maxAttempts: parsed.data.maxAttempts ?? null,
      attemptDurationSeconds: parsed.data.attemptDurationSeconds ?? null,
      requiresSignature: parsed.data.requiresSignature,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, row, 201)
  },
)

instrumentRoutes.get(
  '/bizes/:bizId/instruments/:instrumentId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, instrumentId } = c.req.param()
    const row = await db.query.instruments.findFirst({
      where: and(eq(instruments.bizId, bizId), eq(instruments.id, instrumentId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Instrument not found.', 404)
    return ok(c, row)
  },
)

instrumentRoutes.patch(
  '/bizes/:bizId/instruments/:instrumentId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, instrumentId } = c.req.param()
    const parsed = patchInstrumentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.instruments.findFirst({
      where: and(eq(instruments.bizId, bizId), eq(instruments.id, instrumentId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Instrument not found.', 404)

    const [row] = await db.update(instruments).set({
      name: parsed.data.name !== undefined ? sanitizePlainText(parsed.data.name) : undefined,
      slug: parsed.data.slug !== undefined ? sanitizePlainText(parsed.data.slug) : undefined,
      version: parsed.data.version,
      isCurrent: parsed.data.isCurrent,
      instrumentType: parsed.data.instrumentType,
      status: parsed.data.status,
      evaluationMode: parsed.data.evaluationMode,
      description: parsed.data.description !== undefined ? (parsed.data.description ? sanitizePlainText(parsed.data.description) : null) : undefined,
      schemaSnapshot: parsed.data.schemaSnapshot ? sanitizeUnknown(parsed.data.schemaSnapshot) : undefined,
      validationPolicy: parsed.data.validationPolicy ? sanitizeUnknown(parsed.data.validationPolicy) : undefined,
      scoringPolicy: parsed.data.scoringPolicy ? sanitizeUnknown(parsed.data.scoringPolicy) : undefined,
      completionPolicy: parsed.data.completionPolicy ? sanitizeUnknown(parsed.data.completionPolicy) : undefined,
      passScorePercent: parsed.data.passScorePercent,
      maxAttempts: parsed.data.maxAttempts,
      attemptDurationSeconds: parsed.data.attemptDurationSeconds,
      requiresSignature: parsed.data.requiresSignature,
      metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
    }).where(and(eq(instruments.bizId, bizId), eq(instruments.id, instrumentId))).returning()

    return ok(c, row)
  },
)

instrumentRoutes.get(
  '/bizes/:bizId/instruments/:instrumentId/items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, instrumentId } = c.req.param()
    const rows = await db.query.instrumentItems.findMany({
      where: and(eq(instrumentItems.bizId, bizId), eq(instrumentItems.instrumentId, instrumentId)),
      orderBy: [asc(instrumentItems.sortOrder), asc(instrumentItems.itemKey)],
    })
    return ok(c, rows)
  },
)

instrumentRoutes.post(
  '/bizes/:bizId/instruments/:instrumentId/items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, instrumentId } = c.req.param()
    const parsed = createInstrumentItemBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [row] = await db.insert(instrumentItems).values({
      bizId,
      instrumentId,
      itemKey: sanitizePlainText(parsed.data.itemKey),
      prompt: sanitizePlainText(parsed.data.prompt),
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      itemType: parsed.data.itemType,
      isRequired: parsed.data.isRequired,
      sortOrder: parsed.data.sortOrder,
      maxScore: parsed.data.maxScore,
      config: sanitizeUnknown(parsed.data.config ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, row, 201)
  },
)

instrumentRoutes.get(
  '/bizes/:bizId/instrument-bindings',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.instrumentBindings.findMany({
      where: eq(instrumentBindings.bizId, bizId),
      orderBy: [asc(instrumentBindings.targetType), asc(instrumentBindings.triggerEvent), asc(instrumentBindings.priority)],
    })
    return ok(c, rows)
  },
)

instrumentRoutes.post(
  '/bizes/:bizId/instrument-bindings',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createInstrumentBindingBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [row] = await db.insert(instrumentBindings).values({
      bizId,
      instrumentId: parsed.data.instrumentId,
      targetType: parsed.data.targetType,
      triggerEvent: sanitizePlainText(parsed.data.triggerEvent),
      requirementMode: parsed.data.requirementMode,
      locationId: parsed.data.locationId ?? null,
      serviceId: parsed.data.serviceId ?? null,
      serviceProductId: parsed.data.serviceProductId ?? null,
      offerId: parsed.data.offerId ?? null,
      offerVersionId: parsed.data.offerVersionId ?? null,
      priority: parsed.data.priority,
      conditionExpr: sanitizeUnknown(parsed.data.conditionExpr ?? {}),
      isActive: parsed.data.isActive,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, row, 201)
  },
)

instrumentRoutes.get(
  '/bizes/:bizId/instrument-runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const limit = parsePositiveInt(c.req.query('limit'), 100)
    const offset = Math.max(0, Number(c.req.query('offset') ?? '0') || 0)
    const rows = await db.query.instrumentRuns.findMany({
      where: eq(instrumentRuns.bizId, bizId),
      orderBy: [desc(instrumentRuns.startedAt)],
      limit,
      offset,
    })
    return ok(c, rows)
  },
)

instrumentRoutes.post(
  '/bizes/:bizId/instrument-runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createInstrumentRunBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const subject = await ensureInstrumentSubject({
      bizId: parsed.data.assigneeSubjectBizId,
      subjectType: sanitizePlainText(parsed.data.assigneeSubjectType),
      subjectId: parsed.data.assigneeSubjectId,
    })
    if (!subject) {
      return fail(c, 'VALIDATION_ERROR', 'Assignee subject could not be resolved or created.', 400)
    }

    const actorSubject = c.get('user')?.id
      ? await ensureInstrumentSubject({
          bizId,
          subjectType: 'user',
          subjectId: c.get('user')?.id,
        })
      : null

    const [row] = await db.insert(instrumentRuns).values({
      bizId,
      instrumentId: parsed.data.instrumentId,
      targetType: parsed.data.targetType,
      targetRefId: sanitizePlainText(parsed.data.targetRefId),
      assigneeSubjectBizId: subject.bizId,
      assigneeSubjectType: subject.subjectType,
      assigneeSubjectId: subject.subjectId,
      status: parsed.data.status,
      attemptNumber: parsed.data.attemptNumber,
      requestKey: parsed.data.requestKey ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      responsePayload: sanitizeUnknown(parsed.data.responsePayload ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    await db.insert(instrumentEvents).values({
      bizId,
      instrumentRunId: row.id,
      eventType: 'run_created',
      payload: { status: row.status, targetType: row.targetType, targetRefId: row.targetRefId },
      actorSubjectBizId: actorSubject?.bizId ?? null,
      actorSubjectType: actorSubject?.subjectType ?? null,
      actorSubjectId: actorSubject?.subjectId ?? null,
      metadata: { source: 'api' },
    })

    return ok(c, row, 201)
  },
)

instrumentRoutes.get(
  '/bizes/:bizId/instrument-runs/:instrumentRunId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, instrumentRunId } = c.req.param()
    const row = await db.query.instrumentRuns.findFirst({
      where: and(eq(instrumentRuns.bizId, bizId), eq(instrumentRuns.id, instrumentRunId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Instrument run not found.', 404)
    return ok(c, row)
  },
)

instrumentRoutes.get(
  '/bizes/:bizId/instrument-runs/:instrumentRunId/events',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, instrumentRunId } = c.req.param()
    const rows = await db.query.instrumentEvents.findMany({
      where: and(eq(instrumentEvents.bizId, bizId), eq(instrumentEvents.instrumentRunId, instrumentRunId)),
      orderBy: [asc(instrumentEvents.occurredAt)],
    })
    return ok(c, rows)
  },
)

instrumentRoutes.get(
  '/bizes/:bizId/instrument-runs/:instrumentRunId/responses',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, instrumentRunId } = c.req.param()
    const rows = await db.query.instrumentResponses.findMany({
      where: and(eq(instrumentResponses.bizId, bizId), eq(instrumentResponses.instrumentRunId, instrumentRunId)),
      orderBy: [asc(instrumentResponses.id), asc(instrumentResponses.itemKey)],
    })
    return ok(c, rows)
  },
)

async function appendResponsesAndMaybeMergeRun(params: {
  bizId: string
  instrumentRunId: string
  instrumentId: string
  responses: z.infer<typeof appendInstrumentResponsesBodySchema>['responses']
  mergeIntoRunPayload: boolean
}) {
  const createdRows = await db.insert(instrumentResponses).values(
    params.responses.map((response) => ({
      bizId: params.bizId,
      instrumentRunId: params.instrumentRunId,
      instrumentId: params.instrumentId,
      instrumentItemId: response.instrumentItemId ?? null,
      itemKey: sanitizePlainText(response.itemKey),
      value: sanitizeUnknown(response.value),
      normalizedText: response.normalizedText ? sanitizePlainText(response.normalizedText) : null,
      normalizedNumber: response.normalizedNumber ?? null,
      normalizedBoolean: response.normalizedBoolean ?? null,
      score: response.score ?? null,
      feedback: response.feedback ? sanitizePlainText(response.feedback) : null,
      isFinal: response.isFinal,
      metadata: sanitizeUnknown(response.metadata ?? {}),
    })),
  ).returning()

  if (params.mergeIntoRunPayload) {
    const payload = Object.fromEntries(
      params.responses.map((response) => [response.itemKey, sanitizeUnknown(response.value)]),
    )
    await db
      .update(instrumentRuns)
      .set({
        responsePayload: payload,
        status: 'in_progress',
      })
      .where(and(eq(instrumentRuns.bizId, params.bizId), eq(instrumentRuns.id, params.instrumentRunId)))
  }

  return createdRows
}

async function loadBizInstrumentRun(bizId: string, instrumentRunId: string) {
  return db.query.instrumentRuns.findFirst({
    where: and(eq(instrumentRuns.bizId, bizId), eq(instrumentRuns.id, instrumentRunId)),
  })
}

async function appendInstrumentEvent(params: {
  bizId: string
  instrumentRunId: string
  eventType: string
  actorSubjectId?: string | null
  payload?: Record<string, unknown>
  metadata?: Record<string, unknown>
}) {
  await db.insert(instrumentEvents).values({
    bizId: params.bizId,
    instrumentRunId: params.instrumentRunId,
    eventType: params.eventType,
    actorSubjectBizId: params.actorSubjectId ? params.bizId : null,
    actorSubjectType: params.actorSubjectId ? 'user' : null,
    actorSubjectId: params.actorSubjectId ?? null,
    payload: sanitizeUnknown(params.payload ?? {}),
    metadata: sanitizeUnknown(params.metadata ?? {}),
  })
}

instrumentRoutes.post(
  '/bizes/:bizId/instrument-runs/:instrumentRunId/responses',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, instrumentRunId } = c.req.param()
    const parsed = appendInstrumentResponsesBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const run = await loadBizInstrumentRun(bizId, instrumentRunId)
    if (!run) return fail(c, 'NOT_FOUND', 'Instrument run not found.', 404)

    const rows = await appendResponsesAndMaybeMergeRun({
      bizId,
      instrumentRunId,
      instrumentId: run.instrumentId,
      responses: parsed.data.responses,
      mergeIntoRunPayload: parsed.data.mergeIntoRunPayload,
    })

    await appendInstrumentEvent({
      bizId,
      instrumentRunId,
      eventType: 'responses_appended',
      actorSubjectId: c.get('user')?.id,
      payload: { itemCount: parsed.data.responses.length },
      metadata: { source: 'api' },
    })

    return ok(c, rows, 201)
  },
)

instrumentRoutes.post(
  '/bizes/:bizId/instrument-runs/:instrumentRunId/submit',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, instrumentRunId } = c.req.param()
    const parsed = submitInstrumentRunBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const run = await loadBizInstrumentRun(bizId, instrumentRunId)
    if (!run) return fail(c, 'NOT_FOUND', 'Instrument run not found.', 404)

    const [row] = await db
      .update(instrumentRuns)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        responsePayload: parsed.data.responsePayload ? sanitizeUnknown(parsed.data.responsePayload) : run.responsePayload,
        evaluationSummary: parsed.data.evaluationSummary ? sanitizePlainText(parsed.data.evaluationSummary) : run.evaluationSummary,
        metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : run.metadata,
      })
      .where(and(eq(instrumentRuns.bizId, bizId), eq(instrumentRuns.id, instrumentRunId)))
      .returning()

    await appendInstrumentEvent({
      bizId,
      instrumentRunId,
      eventType: 'submitted',
      actorSubjectId: c.get('user')?.id,
      payload: { status: row.status },
      metadata: { source: 'api' },
    })

    return ok(c, row)
  },
)

instrumentRoutes.post(
  '/bizes/:bizId/instrument-runs/:instrumentRunId/evaluate',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, instrumentRunId } = c.req.param()
    const parsed = evaluateInstrumentRunBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const run = await loadBizInstrumentRun(bizId, instrumentRunId)
    if (!run) return fail(c, 'NOT_FOUND', 'Instrument run not found.', 404)

    const [row] = await db
      .update(instrumentRuns)
      .set({
        status: parsed.data.status,
        evaluatedAt: new Date(),
        completedAt: parsed.data.status === 'completed' ? new Date() : run.completedAt,
        scorePercent: parsed.data.scorePercent ?? run.scorePercent,
        maxScore: parsed.data.maxScore ?? run.maxScore,
        resultStatus: parsed.data.resultStatus ?? run.resultStatus,
        evaluationSummary: parsed.data.evaluationSummary ? sanitizePlainText(parsed.data.evaluationSummary) : run.evaluationSummary,
        metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : run.metadata,
      })
      .where(and(eq(instrumentRuns.bizId, bizId), eq(instrumentRuns.id, instrumentRunId)))
      .returning()

    await appendInstrumentEvent({
      bizId,
      instrumentRunId,
      eventType: 'evaluated',
      actorSubjectId: c.get('user')?.id,
      payload: { resultStatus: row.resultStatus, scorePercent: row.scorePercent },
      metadata: { source: 'api' },
    })

    return ok(c, row)
  },
)

instrumentRoutes.get('/public/bizes/:bizId/instrument-runs/:instrumentRunId', requireAuth, async (c) => {
  const { bizId, instrumentRunId } = c.req.param()
  const run = await loadBizInstrumentRun(bizId, instrumentRunId)
  if (!run) return fail(c, 'NOT_FOUND', 'Instrument run not found.', 404)
  const currentUser = c.get('user')
  if (!currentUser || !instrumentRunBelongsToCurrentUser(run, currentUser.id)) {
    return fail(c, 'FORBIDDEN', 'You do not own this instrument run.', 403)
  }
  return ok(c, run)
})

instrumentRoutes.post('/public/bizes/:bizId/instrument-runs/:instrumentRunId/responses', requireAuth, async (c) => {
  const { bizId, instrumentRunId } = c.req.param()
  const parsed = appendInstrumentResponsesBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const run = await loadBizInstrumentRun(bizId, instrumentRunId)
  if (!run) return fail(c, 'NOT_FOUND', 'Instrument run not found.', 404)
  const currentUser = c.get('user')
  if (!currentUser || !instrumentRunBelongsToCurrentUser(run, currentUser.id)) {
    return fail(c, 'FORBIDDEN', 'You do not own this instrument run.', 403)
  }

  const rows = await appendResponsesAndMaybeMergeRun({
    bizId,
    instrumentRunId,
    instrumentId: run.instrumentId,
    responses: parsed.data.responses,
    mergeIntoRunPayload: parsed.data.mergeIntoRunPayload,
  })

  await appendInstrumentEvent({
    bizId,
    instrumentRunId,
    eventType: 'responses_appended',
    actorSubjectId: currentUser.id,
    payload: { itemCount: parsed.data.responses.length },
    metadata: { source: 'public_api' },
  })

  return ok(c, rows, 201)
})

instrumentRoutes.post('/public/bizes/:bizId/instrument-runs/:instrumentRunId/submit', requireAuth, async (c) => {
  const { bizId, instrumentRunId } = c.req.param()
  const parsed = submitInstrumentRunBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const run = await loadBizInstrumentRun(bizId, instrumentRunId)
  if (!run) return fail(c, 'NOT_FOUND', 'Instrument run not found.', 404)
  const currentUser = c.get('user')
  if (!currentUser || !instrumentRunBelongsToCurrentUser(run, currentUser.id)) {
    return fail(c, 'FORBIDDEN', 'You do not own this instrument run.', 403)
  }

  const [row] = await db
    .update(instrumentRuns)
    .set({
      status: 'submitted',
      submittedAt: new Date(),
      responsePayload: parsed.data.responsePayload ? sanitizeUnknown(parsed.data.responsePayload) : run.responsePayload,
      evaluationSummary: parsed.data.evaluationSummary ? sanitizePlainText(parsed.data.evaluationSummary) : run.evaluationSummary,
      metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : run.metadata,
    })
    .where(and(eq(instrumentRuns.bizId, bizId), eq(instrumentRuns.id, instrumentRunId)))
    .returning()

  await appendInstrumentEvent({
    bizId,
    instrumentRunId,
    eventType: 'submitted',
    actorSubjectId: currentUser.id,
    payload: { status: row.status },
    metadata: { source: 'public_api' },
  })

  return ok(c, row)
})
