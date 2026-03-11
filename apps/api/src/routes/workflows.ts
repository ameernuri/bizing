/**
 * Workflow + review runtime routes.
 *
 * ELI5:
 * The action backbone answers:
 * - what someone tried to do
 * - what event happened
 *
 * These routes answer the next layer:
 * - what long-running process started because of that
 * - what inbox/review item was created
 * - what step the workflow is currently on
 * - what deliverable/output is waiting later
 *
 * This is intentionally read-first for now. We want humans and agents to be
 * able to inspect process state before we add mutation-heavy intervention APIs.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { dispatchWorkflowTriggers } from '../services/workflow-trigger-runtime.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  reviewQueues,
  reviewQueueItems,
  workflowDefinitions,
  workflowDefinitionVersions,
  workflowDefinitionTriggers,
  workflowTriggerInvocations,
  workflowInstances,
  workflowSteps,
  workflowDecisions,
  asyncDeliverables,
} = dbPackage

async function createWorkflowRow<TTableKey extends 'reviewQueues' | 'reviewQueueItems'>(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: TTableKey,
  data: Parameters<typeof executeCrudRouteAction>[0]['data'],
  meta: { subjectType: string; subjectId: string; displayName: string; source: string },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'create',
    data,
    subjectType: meta.subjectType,
    subjectId: meta.subjectId,
    displayName: meta.displayName,
    metadata: { source: meta.source },
  })
  if (!result.ok) throw new Error(result.message ?? `Failed to create ${tableKey}`)
  if (!result.row) throw new Error(`Missing row for ${tableKey} create`)
  return result.row
}

const listQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const reviewQueueTypeSchema = z.enum(['fraud', 'manual_approval', 'compliance', 'moderation', 'risk'])
const reviewQueueStatusSchema = z.enum(['active', 'paused', 'archived'])
const reviewQueueItemStatusSchema = z.enum([
  'pending',
  'claimed',
  'approved',
  'rejected',
  'escalated',
  'timed_out',
  'cancelled',
])
const workflowInstanceStatusSchema = z.enum(['pending', 'running', 'waiting_input', 'completed', 'failed', 'cancelled'])
const asyncDeliverableStatusSchema = z.enum(['queued', 'processing', 'ready', 'delivered', 'expired', 'failed', 'cancelled'])
const asyncDeliverableTypeSchema = z.enum(['document', 'media_bundle', 'analysis_result', 'message_response', 'custom'])

const listReviewQueuesQuerySchema = listQuerySchema.extend({
  type: reviewQueueTypeSchema.optional(),
  status: reviewQueueStatusSchema.optional(),
})

const listReviewItemsQuerySchema = listQuerySchema.extend({
  reviewQueueId: z.string().optional(),
  status: reviewQueueItemStatusSchema.optional(),
  assignedToUserId: z.string().optional(),
  itemType: z.string().optional(),
})

const listWorkflowInstancesQuerySchema = listQuerySchema.extend({
  status: workflowInstanceStatusSchema.optional(),
  workflowKey: z.string().optional(),
  targetType: z.string().optional(),
  actionRequestId: z.string().optional(),
})

const lifecycleStatusSchema = z.enum(['draft', 'active', 'inactive', 'archived'])

const listWorkflowDefinitionsQuerySchema = listQuerySchema.extend({
  status: lifecycleStatusSchema.optional(),
  triggerMode: z
    .enum(['manual', 'lifecycle_hook', 'domain_event', 'action', 'schedule', 'system'])
    .optional(),
  key: z.string().optional(),
})

const workflowStepPlanSchema = z.array(
  z.object({
    stepKey: z.string().min(1).max(140),
    name: z.string().min(1).max(200),
    sequence: z.number().int().min(0),
    status: z.enum(['pending', 'running', 'blocked', 'completed', 'failed', 'skipped']).optional(),
    dueInMinutes: z.number().int().min(0).optional().nullable(),
    inputPayload: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
)

const createWorkflowDefinitionBodySchema = z.object({
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(220),
  status: lifecycleStatusSchema.default('active'),
  triggerMode: z
    .enum(['manual', 'lifecycle_hook', 'domain_event', 'action', 'schedule', 'system'])
    .default('manual'),
  targetType: z.string().min(1).max(120).optional().nullable(),
  currentVersion: z.number().int().min(1).default(1),
  description: z.string().max(4000).optional().nullable(),
  stepPlan: workflowStepPlanSchema.optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createWorkflowDefinitionVersionBodySchema = z.object({
  version: z.number().int().min(1),
  status: lifecycleStatusSchema.default('active'),
  stepPlan: workflowStepPlanSchema.optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const listWorkflowDefinitionTriggersQuerySchema = listQuerySchema.extend({
  status: lifecycleStatusSchema.optional(),
  triggerSource: z
    .enum([
      'lifecycle_hook_invocation',
      'lifecycle_hook_effect',
      'domain_event',
      'action_request',
      'manual',
      'schedule',
      'system',
    ])
    .optional(),
  workflowDefinitionId: z.string().optional(),
  targetType: z.string().optional(),
})

const createWorkflowDefinitionTriggerBodySchema = z
  .object({
    workflowDefinitionId: z.string().min(1),
    status: lifecycleStatusSchema.default('active'),
    triggerSource: z.enum([
      'lifecycle_hook_invocation',
      'lifecycle_hook_effect',
      'domain_event',
      'action_request',
      'manual',
      'schedule',
      'system',
    ]),
    lifecycleHookContractKey: z.string().min(1).max(180).optional().nullable(),
    lifecycleHookInvocationStatus: z
      .enum(['running', 'succeeded', 'failed', 'skipped'])
      .optional()
      .nullable(),
    lifecycleHookEffectType: z.string().min(1).max(120).optional().nullable(),
    domainEventPattern: z.string().min(1).max(200).optional().nullable(),
    actionKey: z.string().min(1).max(160).optional().nullable(),
    targetType: z.string().min(1).max(120).optional().nullable(),
    priority: z.number().int().min(0).max(100000).default(100),
    workflowDefinitionVersion: z.number().int().min(1).default(1),
    idempotencyMode: z.enum(['none', 'trigger', 'trigger_target']).default('trigger_target'),
    configuration: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.triggerSource === 'lifecycle_hook_invocation' && !value.lifecycleHookContractKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lifecycleHookContractKey is required for lifecycle_hook_invocation triggers.',
      })
    }
    if (
      value.triggerSource === 'lifecycle_hook_effect' &&
      !value.lifecycleHookContractKey &&
      !value.lifecycleHookEffectType
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lifecycleHookContractKey or lifecycleHookEffectType is required for lifecycle_hook_effect triggers.',
      })
    }
    if (value.triggerSource === 'domain_event' && !value.domainEventPattern) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'domainEventPattern is required for domain_event triggers.',
      })
    }
    if (value.triggerSource === 'action_request' && !value.actionKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'actionKey is required for action_request triggers.',
      })
    }
  })

const listWorkflowTriggerInvocationsQuerySchema = listQuerySchema.extend({
  triggerSource: z
    .enum([
      'lifecycle_hook_invocation',
      'lifecycle_hook_effect',
      'domain_event',
      'action_request',
      'manual',
      'schedule',
      'system',
    ])
    .optional(),
  workflowDefinitionId: z.string().optional(),
  workflowDefinitionTriggerId: z.string().optional(),
  status: z.enum(['running', 'succeeded', 'failed', 'skipped']).optional(),
  targetType: z.string().optional(),
  targetRefId: z.string().optional(),
})

const dispatchWorkflowTriggersBodySchema = z.object({
  triggerSource: z.enum([
    'lifecycle_hook_invocation',
    'lifecycle_hook_effect',
    'domain_event',
    'action_request',
    'manual',
    'schedule',
    'system',
  ]),
  triggerRefId: z.string().min(1).max(160),
  targetType: z.string().min(1).max(120),
  targetRefId: z.string().min(1).max(160),
  lifecycleHookContractKey: z.string().max(180).optional().nullable(),
  lifecycleHookInvocationStatus: z.enum(['running', 'succeeded', 'failed', 'skipped']).optional().nullable(),
  lifecycleHookEffectType: z.string().max(120).optional().nullable(),
  domainEventKey: z.string().max(200).optional().nullable(),
  actionKey: z.string().max(160).optional().nullable(),
  inputPayload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const listAsyncDeliverablesQuerySchema = listQuerySchema.extend({
  status: asyncDeliverableStatusSchema.optional(),
  deliverableType: asyncDeliverableTypeSchema.optional(),
  workflowInstanceId: z.string().optional(),
})

const createReviewQueueBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(140),
  type: reviewQueueTypeSchema,
  status: reviewQueueStatusSchema.optional(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createReviewQueueItemBodySchema = z.object({
  reviewQueueId: z.string().min(1),
  status: reviewQueueItemStatusSchema.optional(),
  itemType: z.string().min(1).max(100),
  itemRefId: z.string().min(1).max(140),
  bookingOrderId: z.string().optional().nullable(),
  fulfillmentUnitId: z.string().optional().nullable(),
  sourceActionRequestId: z.string().optional().nullable(),
  sourceDomainEventId: z.string().optional().nullable(),
  priority: z.number().int().min(0).optional(),
  riskScore: z.number().int().min(0).max(100).optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  resolvedAt: z.string().datetime().optional().nullable(),
  resolutionPayload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

function normalizedSelectorPart(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function triggerSelectorFingerprint(input: z.infer<typeof createWorkflowDefinitionTriggerBodySchema>) {
  return [
    input.triggerSource,
    normalizedSelectorPart(input.lifecycleHookContractKey ?? null),
    normalizedSelectorPart(input.lifecycleHookInvocationStatus ?? null),
    normalizedSelectorPart(input.lifecycleHookEffectType ?? null),
    normalizedSelectorPart(input.domainEventPattern ?? null),
    normalizedSelectorPart(input.actionKey ?? null),
    normalizedSelectorPart(input.targetType ?? null),
    String(input.workflowDefinitionVersion),
  ].join('|')
}

function triggerRowSelectorFingerprint(
  row: Pick<
    typeof workflowDefinitionTriggers.$inferSelect,
    | 'triggerSource'
    | 'lifecycleHookContractKey'
    | 'lifecycleHookInvocationStatus'
    | 'lifecycleHookEffectType'
    | 'domainEventPattern'
    | 'actionKey'
    | 'targetType'
    | 'workflowDefinitionVersion'
  >,
) {
  return [
    row.triggerSource,
    normalizedSelectorPart(row.lifecycleHookContractKey),
    normalizedSelectorPart(row.lifecycleHookInvocationStatus),
    normalizedSelectorPart(row.lifecycleHookEffectType),
    normalizedSelectorPart(row.domainEventPattern),
    normalizedSelectorPart(row.actionKey),
    normalizedSelectorPart(row.targetType),
    String(row.workflowDefinitionVersion),
  ].join('|')
}

function paginationMeta(page: number, perPage: number, total: number) {
  return { page, perPage, total, hasMore: page * perPage < total }
}

export const workflowRoutes = new Hono()

workflowRoutes.get(
  '/bizes/:bizId/workflow-definitions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listWorkflowDefinitionsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(workflowDefinitions.bizId, bizId),
      parsed.data.status ? eq(workflowDefinitions.status, parsed.data.status) : undefined,
      parsed.data.triggerMode ? eq(workflowDefinitions.triggerMode, parsed.data.triggerMode) : undefined,
      parsed.data.key ? eq(workflowDefinitions.key, parsed.data.key) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.workflowDefinitions.findMany({
        where,
        orderBy: [asc(workflowDefinitions.key)],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowDefinitions)
        .where(where),
    ])
    const total = Number(countRows[0]?.count ?? 0)
    return ok(c, rows, 200, {
      pagination: paginationMeta(page, perPage, total),
    })
  },
)

workflowRoutes.post(
  '/bizes/:bizId/workflow-definitions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createWorkflowDefinitionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.workflowDefinitions.findFirst({
      where: and(eq(workflowDefinitions.bizId, bizId), eq(workflowDefinitions.key, parsed.data.key)),
    })
    const definition =
      existing ??
      (await db
        .insert(workflowDefinitions)
        .values({
          bizId,
          key: parsed.data.key,
          name: parsed.data.name,
          status: parsed.data.status,
          triggerMode: parsed.data.triggerMode,
          targetType: parsed.data.targetType ?? null,
          currentVersion: parsed.data.currentVersion,
          description: parsed.data.description ?? null,
          metadata: parsed.data.metadata ?? {},
        })
        .returning())[0]

    const version = await db.query.workflowDefinitionVersions.findFirst({
      where: and(
        eq(workflowDefinitionVersions.bizId, bizId),
        eq(workflowDefinitionVersions.workflowDefinitionId, definition.id),
        eq(workflowDefinitionVersions.version, parsed.data.currentVersion),
      ),
    })

    const createdVersion =
      version ??
      (await db
        .insert(workflowDefinitionVersions)
        .values({
          bizId,
          workflowDefinitionId: definition.id,
          version: parsed.data.currentVersion,
          status: parsed.data.status,
          stepPlan: parsed.data.stepPlan ?? [{ stepKey: 'review', name: 'Manual review', sequence: 0, status: 'pending' }],
          inputSchema: parsed.data.inputSchema ?? {},
          outputSchema: parsed.data.outputSchema ?? {},
          metadata: parsed.data.metadata ?? {},
        })
        .returning())[0]

    return ok(
      c,
      { definition, version: createdVersion },
      existing ? 200 : 201,
      existing ? { reused: true } : undefined,
    )
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflow-definitions/:workflowDefinitionId/versions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workflowDefinitionId } = c.req.param()
    const rows = await db.query.workflowDefinitionVersions.findMany({
      where: and(
        eq(workflowDefinitionVersions.bizId, bizId),
        eq(workflowDefinitionVersions.workflowDefinitionId, workflowDefinitionId),
      ),
      orderBy: [asc(workflowDefinitionVersions.version)],
      limit: 200,
    })
    return ok(c, rows)
  },
)

workflowRoutes.post(
  '/bizes/:bizId/workflow-definitions/:workflowDefinitionId/versions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workflowDefinitionId } = c.req.param()
    const parsed = createWorkflowDefinitionVersionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const definition = await db.query.workflowDefinitions.findFirst({
      where: and(eq(workflowDefinitions.bizId, bizId), eq(workflowDefinitions.id, workflowDefinitionId)),
    })
    if (!definition) return fail(c, 'NOT_FOUND', 'Workflow definition not found.', 404)

    const existing = await db.query.workflowDefinitionVersions.findFirst({
      where: and(
        eq(workflowDefinitionVersions.bizId, bizId),
        eq(workflowDefinitionVersions.workflowDefinitionId, workflowDefinitionId),
        eq(workflowDefinitionVersions.version, parsed.data.version),
      ),
    })
    if (existing) return ok(c, existing, 200, { reused: true })

    const [created] = await db
      .insert(workflowDefinitionVersions)
      .values({
        bizId,
        workflowDefinitionId,
        version: parsed.data.version,
        status: parsed.data.status,
        stepPlan: parsed.data.stepPlan ?? [{ stepKey: 'review', name: 'Manual review', sequence: 0, status: 'pending' }],
        inputSchema: parsed.data.inputSchema ?? {},
        outputSchema: parsed.data.outputSchema ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    if (parsed.data.version > definition.currentVersion) {
      await db
        .update(workflowDefinitions)
        .set({ currentVersion: parsed.data.version })
        .where(and(eq(workflowDefinitions.bizId, bizId), eq(workflowDefinitions.id, workflowDefinitionId)))
    }

    return ok(c, created, 201)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflow-definition-triggers',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listWorkflowDefinitionTriggersQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(workflowDefinitionTriggers.bizId, bizId),
      parsed.data.status ? eq(workflowDefinitionTriggers.status, parsed.data.status) : undefined,
      parsed.data.triggerSource ? eq(workflowDefinitionTriggers.triggerSource, parsed.data.triggerSource) : undefined,
      parsed.data.workflowDefinitionId
        ? eq(workflowDefinitionTriggers.workflowDefinitionId, parsed.data.workflowDefinitionId)
        : undefined,
      parsed.data.targetType ? eq(workflowDefinitionTriggers.targetType, parsed.data.targetType) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.workflowDefinitionTriggers.findMany({
        where,
        orderBy: [asc(workflowDefinitionTriggers.priority), asc(workflowDefinitionTriggers.id)],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowDefinitionTriggers)
        .where(where),
    ])
    const total = Number(countRows[0]?.count ?? 0)
    return ok(c, rows, 200, {
      pagination: paginationMeta(page, perPage, total),
    })
  },
)

workflowRoutes.post(
  '/bizes/:bizId/workflow-definition-triggers',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createWorkflowDefinitionTriggerBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const definition = await db.query.workflowDefinitions.findFirst({
      where: and(
        eq(workflowDefinitions.bizId, bizId),
        eq(workflowDefinitions.id, parsed.data.workflowDefinitionId),
      ),
    })
    if (!definition) return fail(c, 'NOT_FOUND', 'Workflow definition not found.', 404)

    const definitionVersion = await db.query.workflowDefinitionVersions.findFirst({
      where: and(
        eq(workflowDefinitionVersions.bizId, bizId),
        eq(workflowDefinitionVersions.workflowDefinitionId, parsed.data.workflowDefinitionId),
        eq(workflowDefinitionVersions.version, parsed.data.workflowDefinitionVersion),
      ),
    })
    if (!definitionVersion) {
      return fail(
        c,
        'VALIDATION_ERROR',
        `Workflow definition version ${parsed.data.workflowDefinitionVersion} does not exist for the target definition.`,
        400,
      )
    }

    const fingerprint = triggerSelectorFingerprint(parsed.data)
    const sameBucket = await db.query.workflowDefinitionTriggers.findMany({
      where: and(
        eq(workflowDefinitionTriggers.bizId, bizId),
        eq(workflowDefinitionTriggers.workflowDefinitionId, parsed.data.workflowDefinitionId),
        eq(workflowDefinitionTriggers.status, parsed.data.status),
        eq(workflowDefinitionTriggers.triggerSource, parsed.data.triggerSource),
        eq(workflowDefinitionTriggers.workflowDefinitionVersion, parsed.data.workflowDefinitionVersion),
      ),
      limit: 500,
    })
    const duplicate = sameBucket.find((row) => triggerRowSelectorFingerprint(row) === fingerprint)
    if (duplicate) {
      return fail(c, 'DUPLICATE_TRIGGER_SELECTOR', 'An equivalent workflow trigger already exists.', 409, {
        existingTriggerId: duplicate.id,
      })
    }

    const [created] = await db
      .insert(workflowDefinitionTriggers)
      .values({
        bizId,
        workflowDefinitionId: parsed.data.workflowDefinitionId,
        status: parsed.data.status,
        triggerSource: parsed.data.triggerSource,
        lifecycleHookContractKey: parsed.data.lifecycleHookContractKey ?? null,
        lifecycleHookInvocationStatus: parsed.data.lifecycleHookInvocationStatus ?? null,
        lifecycleHookEffectType: parsed.data.lifecycleHookEffectType ?? null,
        domainEventPattern: parsed.data.domainEventPattern ?? null,
        actionKey: parsed.data.actionKey ?? null,
        targetType: parsed.data.targetType ?? null,
        priority: parsed.data.priority,
        workflowDefinitionVersion: parsed.data.workflowDefinitionVersion,
        idempotencyMode: parsed.data.idempotencyMode,
        configuration: parsed.data.configuration ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflow-trigger-invocations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listWorkflowTriggerInvocationsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(workflowTriggerInvocations.bizId, bizId),
      parsed.data.triggerSource ? eq(workflowTriggerInvocations.triggerSource, parsed.data.triggerSource) : undefined,
      parsed.data.workflowDefinitionId
        ? eq(workflowTriggerInvocations.workflowDefinitionId, parsed.data.workflowDefinitionId)
        : undefined,
      parsed.data.workflowDefinitionTriggerId
        ? eq(workflowTriggerInvocations.workflowDefinitionTriggerId, parsed.data.workflowDefinitionTriggerId)
        : undefined,
      parsed.data.status ? eq(workflowTriggerInvocations.status, parsed.data.status) : undefined,
      parsed.data.targetType ? eq(workflowTriggerInvocations.targetType, parsed.data.targetType) : undefined,
      parsed.data.targetRefId ? eq(workflowTriggerInvocations.targetRefId, parsed.data.targetRefId) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.workflowTriggerInvocations.findMany({
        where,
        orderBy: [desc(workflowTriggerInvocations.startedAt)],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowTriggerInvocations)
        .where(where),
    ])
    const total = Number(countRows[0]?.count ?? 0)
    return ok(c, rows, 200, {
      pagination: paginationMeta(page, perPage, total),
    })
  },
)

workflowRoutes.post(
  '/bizes/:bizId/workflow-triggers/dispatch',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = dispatchWorkflowTriggersBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const result = await db.transaction((tx) =>
      dispatchWorkflowTriggers({
        tx,
        bizId,
        triggerSource: parsed.data.triggerSource,
        triggerRefId: parsed.data.triggerRefId,
        targetType: parsed.data.targetType,
        targetRefId: parsed.data.targetRefId,
        lifecycleHookContractKey: parsed.data.lifecycleHookContractKey ?? null,
        lifecycleHookInvocationStatus: parsed.data.lifecycleHookInvocationStatus ?? null,
        lifecycleHookEffectType: parsed.data.lifecycleHookEffectType ?? null,
        domainEventKey: parsed.data.domainEventKey ?? null,
        actionKey: parsed.data.actionKey ?? null,
        inputPayload: parsed.data.inputPayload ?? {},
        metadata: parsed.data.metadata ?? {},
      }),
    )
    return ok(c, result)
  },
)

workflowRoutes.post(
  '/bizes/:bizId/review-queues',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createReviewQueueBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const row = await createWorkflowRow(
      c,
      bizId,
      'reviewQueues',
      {
        bizId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        type: parsed.data.type,
        status: parsed.data.status ?? 'active',
        policy: parsed.data.policy ?? {},
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'review_queue',
        subjectId: parsed.data.slug,
        displayName: parsed.data.name,
        source: 'routes.workflows.createReviewQueue',
      },
    )
    return ok(c, row, 201)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/review-queues',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listReviewQueuesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(reviewQueues.bizId, bizId),
      parsed.data.type ? eq(reviewQueues.type, parsed.data.type) : undefined,
      parsed.data.status ? eq(reviewQueues.status, parsed.data.status) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.reviewQueues.findMany({
        where,
        orderBy: desc(reviewQueues.id),
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviewQueues)
        .where(where),
    ])
    const total = Number(countRows[0]?.count ?? 0)
    return ok(c, rows, 200, {
      pagination: paginationMeta(page, perPage, total),
    })
  },
)

workflowRoutes.get(
  '/bizes/:bizId/review-queue-items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listReviewItemsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(reviewQueueItems.bizId, bizId),
      parsed.data.reviewQueueId ? eq(reviewQueueItems.reviewQueueId, parsed.data.reviewQueueId) : undefined,
      parsed.data.status ? eq(reviewQueueItems.status, parsed.data.status) : undefined,
      parsed.data.assignedToUserId ? eq(reviewQueueItems.assignedToUserId, parsed.data.assignedToUserId) : undefined,
      parsed.data.itemType ? eq(reviewQueueItems.itemType, parsed.data.itemType) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.reviewQueueItems.findMany({
        where,
        orderBy: [desc(reviewQueueItems.priority), desc(reviewQueueItems.id)],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviewQueueItems)
        .where(where),
    ])
    const total = Number(countRows[0]?.count ?? 0)
    return ok(c, rows, 200, {
      pagination: paginationMeta(page, perPage, total),
    })
  },
)

workflowRoutes.post(
  '/bizes/:bizId/review-queue-items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createReviewQueueItemBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const row = await createWorkflowRow(
      c,
      bizId,
      'reviewQueueItems',
      {
        bizId,
        reviewQueueId: parsed.data.reviewQueueId,
        status: parsed.data.status ?? 'pending',
        itemType: parsed.data.itemType,
        itemRefId: parsed.data.itemRefId,
        bookingOrderId: parsed.data.bookingOrderId ?? null,
        fulfillmentUnitId: parsed.data.fulfillmentUnitId ?? null,
        sourceActionRequestId: parsed.data.sourceActionRequestId ?? null,
        sourceDomainEventId: parsed.data.sourceDomainEventId ?? null,
        priority: parsed.data.priority ?? 100,
        riskScore: parsed.data.riskScore ?? null,
        assignedToUserId: parsed.data.assignedToUserId ?? null,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null,
        resolutionPayload: parsed.data.resolutionPayload ?? {},
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'review_queue_item',
        subjectId: parsed.data.itemRefId,
        displayName: parsed.data.itemType,
        source: 'routes.workflows.createReviewQueueItem',
      },
    )
    return ok(c, row, 201)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/review-queue-items/:reviewQueueItemId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, reviewQueueItemId } = c.req.param()
    const row = await db.query.reviewQueueItems.findFirst({
      where: and(eq(reviewQueueItems.bizId, bizId), eq(reviewQueueItems.id, reviewQueueItemId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Review queue item not found.', 404)
    return ok(c, row)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflows',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listWorkflowInstancesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(workflowInstances.bizId, bizId),
      parsed.data.status ? eq(workflowInstances.status, parsed.data.status) : undefined,
      parsed.data.workflowKey ? eq(workflowInstances.workflowKey, parsed.data.workflowKey) : undefined,
      parsed.data.targetType ? eq(workflowInstances.targetType, parsed.data.targetType) : undefined,
      parsed.data.actionRequestId ? eq(workflowInstances.actionRequestId, parsed.data.actionRequestId) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.workflowInstances.findMany({
        where,
        orderBy: desc(workflowInstances.startedAt),
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowInstances)
        .where(where),
    ])
    const total = Number(countRows[0]?.count ?? 0)
    return ok(c, rows, 200, {
      pagination: paginationMeta(page, perPage, total),
    })
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflows/:workflowInstanceId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workflowInstanceId } = c.req.param()
    const row = await db.query.workflowInstances.findFirst({
      where: and(eq(workflowInstances.bizId, bizId), eq(workflowInstances.id, workflowInstanceId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Workflow instance not found.', 404)

    const [steps, decisions] = await Promise.all([
      db.query.workflowSteps.findMany({
        where: and(eq(workflowSteps.bizId, bizId), eq(workflowSteps.workflowInstanceId, workflowInstanceId)),
        orderBy: workflowSteps.sequence,
      }),
      db.query.workflowDecisions.findMany({
        where: and(eq(workflowDecisions.bizId, bizId), eq(workflowDecisions.workflowInstanceId, workflowInstanceId)),
        orderBy: desc(workflowDecisions.decidedAt),
      }),
    ])

    return ok(c, { workflow: row, steps, decisions })
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflows/:workflowInstanceId/steps',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workflowInstanceId } = c.req.param()
    const rows = await db.query.workflowSteps.findMany({
      where: and(eq(workflowSteps.bizId, bizId), eq(workflowSteps.workflowInstanceId, workflowInstanceId)),
      orderBy: workflowSteps.sequence,
    })
    return ok(c, rows)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/workflows/:workflowInstanceId/decisions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, workflowInstanceId } = c.req.param()
    const rows = await db.query.workflowDecisions.findMany({
      where: and(eq(workflowDecisions.bizId, bizId), eq(workflowDecisions.workflowInstanceId, workflowInstanceId)),
      orderBy: desc(workflowDecisions.decidedAt),
    })
    return ok(c, rows)
  },
)

workflowRoutes.get(
  '/bizes/:bizId/async-deliverables',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listAsyncDeliverablesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }
    const page = parsePositiveInt(parsed.data.page, 1)
    const perPage = Math.min(parsePositiveInt(parsed.data.perPage, 20), 100)
    const where = and(
      eq(asyncDeliverables.bizId, bizId),
      parsed.data.status ? eq(asyncDeliverables.status, parsed.data.status) : undefined,
      parsed.data.deliverableType ? eq(asyncDeliverables.deliverableType, parsed.data.deliverableType) : undefined,
      parsed.data.workflowInstanceId ? eq(asyncDeliverables.workflowInstanceId, parsed.data.workflowInstanceId) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.asyncDeliverables.findMany({
        where,
        orderBy: desc(asyncDeliverables.requestedAt),
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(asyncDeliverables)
        .where(where),
    ])
    const total = Number(countRows[0]?.count ?? 0)
    return ok(c, rows, 200, {
      pagination: paginationMeta(page, perPage, total),
    })
  },
)

workflowRoutes.get(
  '/bizes/:bizId/async-deliverables/:asyncDeliverableId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('workflows.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, asyncDeliverableId } = c.req.param()
    const row = await db.query.asyncDeliverables.findFirst({
      where: and(eq(asyncDeliverables.bizId, bizId), eq(asyncDeliverables.id, asyncDeliverableId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Async deliverable not found.', 404)
    return ok(c, row)
  },
)
