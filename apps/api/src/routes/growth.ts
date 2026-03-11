/**
 * Growth backbone routes.
 *
 * ELI5:
 * This domain unifies three capabilities under one extensible contract:
 * 1) localization resources + resolved locale values,
 * 2) experimentation (A/B + multi-variant assignments and metrics),
 * 3) marketing activation runs (publish/sync bridges).
 *
 * Why this exists:
 * - keeps growth logic API-first and auditable,
 * - keeps workflows and plugins integrated through domain events,
 * - avoids one-off endpoint logic spread across unrelated route modules.
 */

import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { dispatchWorkflowTriggers } from '../services/workflow-trigger-runtime.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  domainEvents,
  growthLocalizationResources,
  growthLocalizationValues,
  growthExperiments,
  growthExperimentVariants,
  growthExperimentAssignments,
  growthExperimentMeasurements,
  growthMarketingActivations,
  growthMarketingActivationRuns,
  growthMarketingActivationRunItems,
  subjects,
} = dbPackage

type GrowthWorkflowDispatchSummary = {
  matchedTriggers: number
  launchedCount: number
  reusedCount: number
  skippedCount: number
}

const paginationQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const lifecycleStatusSchema = z.enum(['draft', 'active', 'inactive', 'archived'])

const localizationResourceBodySchema = z.object({
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(220),
  targetType: z.string().min(1).max(120),
  targetRefId: z.string().min(1).max(160),
  fieldKey: z.string().min(1).max(160),
  defaultLocale: z.string().min(2).max(35).default('en-US'),
  status: lifecycleStatusSchema.default('active'),
  metadata: z.record(z.unknown()).optional(),
})

const localizationValueBodySchema = z.object({
  locale: z.string().min(2).max(35),
  contentText: z.string().min(1).max(50000).optional().nullable(),
  contentJson: z.record(z.unknown()).optional().nullable(),
  sourceType: z.string().max(40).default('manual'),
  qualityScore: z.number().int().min(0).max(100).optional().nullable(),
  status: lifecycleStatusSchema.default('active'),
  isCurrent: z.boolean().default(true),
  isMachineGenerated: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (!value.contentText && !value.contentJson) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either contentText or contentJson must be provided.',
    })
  }
})

const localizationResolveBodySchema = z.object({
  targetType: z.string().min(1).max(120),
  targetRefId: z.string().min(1).max(160),
  fieldKey: z.string().min(1).max(160),
  locale: z.string().min(2).max(35),
  fallbackLocales: z.array(z.string().min(2).max(35)).default([]),
})

const listExperimentsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
  targetType: z.string().optional(),
})

const createExperimentBodySchema = z.object({
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(220),
  status: z.string().max(40).default('draft'),
  hypothesis: z.string().max(5000).optional().nullable(),
  objectiveType: z.string().max(80).default('conversion_rate'),
  assignmentUnitType: z.string().max(60).default('subject'),
  assignmentStrategy: z.string().max(60).default('weighted_hash'),
  marketingAudienceSegmentId: z.string().optional().nullable(),
  targetType: z.string().max(120).optional().nullable(),
  targetRefId: z.string().max(160).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const createExperimentVariantBodySchema = z.object({
  variantKey: z.string().min(1).max(120),
  name: z.string().min(1).max(220),
  status: lifecycleStatusSchema.default('active'),
  isControl: z.boolean().default(false),
  allocationBps: z.number().int().min(0).max(10000),
  treatment: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const assignmentStatusSchema = z.enum(['assigned', 'exposed', 'converted', 'excluded', 'failed'])

const createExperimentAssignmentBodySchema = z.object({
  growthExperimentVariantId: z.string().optional().nullable(),
  subjectType: z.string().min(1).max(80),
  subjectRefId: z.string().min(1).max(160),
  assignmentKey: z.string().max(180).optional().nullable(),
  status: assignmentStatusSchema.default('assigned'),
  exposedAt: z.string().datetime().optional().nullable(),
  convertedAt: z.string().datetime().optional().nullable(),
  conversionEventKey: z.string().max(180).optional().nullable(),
  conversionValueMinor: z.number().int().min(0).optional().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  sourceType: z.string().max(40).default('api'),
  metadata: z.record(z.unknown()).optional(),
})

const createExperimentMeasurementBodySchema = z.object({
  growthExperimentVariantId: z.string().optional().nullable(),
  growthExperimentAssignmentId: z.string().optional().nullable(),
  metricKey: z.string().min(1).max(120),
  metricValue: z.union([z.number(), z.string()]),
  metricUnit: z.string().max(40).optional().nullable(),
  observedAt: z.string().datetime().optional().nullable(),
  sourceType: z.string().max(40).default('api'),
  eventRef: z.string().max(180).optional().nullable(),
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const listActivationsQuerySchema = paginationQuerySchema.extend({
  status: lifecycleStatusSchema.optional(),
  provider: z.string().optional(),
})

const createActivationBodySchema = z.object({
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(220),
  status: lifecycleStatusSchema.default('active'),
  provider: z.string().min(1).max(80),
  channelAccountId: z.string().optional().nullable(),
  sourceType: z.string().max(40).default('experiment_variant'),
  growthExperimentId: z.string().optional().nullable(),
  growthExperimentVariantId: z.string().optional().nullable(),
  marketingCampaignId: z.string().optional().nullable(),
  messageTemplateId: z.string().optional().nullable(),
  marketingAudienceSegmentId: z.string().optional().nullable(),
  destinationRef: z.string().max(220).optional().nullable(),
  syncMode: z.string().max(40).default('push'),
  publishPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const activationRunStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled', 'partial'])

const createActivationRunBodySchema = z.object({
  status: activationRunStatusSchema.default('queued'),
  triggerSource: z.string().max(40).default('manual'),
  triggerRefId: z.string().max(160).optional().nullable(),
  initiatedByUserId: z.string().optional().nullable(),
  startedAt: z.string().datetime().optional().nullable(),
  finishedAt: z.string().datetime().optional().nullable(),
  inputPayload: z.record(z.unknown()).optional(),
  outputPayload: z.record(z.unknown()).optional(),
  errorCode: z.string().max(120).optional().nullable(),
  errorMessage: z.string().max(4000).optional().nullable(),
  publishedCount: z.number().int().min(0).default(0),
  syncedCount: z.number().int().min(0).default(0),
  failedCount: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).optional(),
  items: z
    .array(
      z.object({
        itemType: z.string().min(1).max(80),
        itemRefId: z.string().max(180).optional().nullable(),
        externalRef: z.string().max(220).optional().nullable(),
        status: z.enum(['planned', 'published', 'synced', 'failed', 'skipped']).default('planned'),
        errorCode: z.string().max(120).optional().nullable(),
        errorMessage: z.string().max(4000).optional().nullable(),
        payload: z.record(z.unknown()).optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .default([]),
})

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

function cleanMetadata(value: Record<string, unknown> | undefined) {
  return sanitizeUnknown(value ?? {}) as Record<string, unknown>
}

function normalizedKey(input: string) {
  return sanitizePlainText(input).trim().toLowerCase()
}

function hashToBps(seed: string) {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 12)
  const numeric = Number.parseInt(digest, 16)
  if (!Number.isFinite(numeric) || numeric < 0) return 0
  return numeric % 10000
}

async function createGrowthRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0]
  bizId: string
  tableKey: string
  subjectType: string
  data: Record<string, unknown>
  displayName?: string
}) {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: 'create',
    subjectType: input.subjectType,
    displayName: input.displayName,
    data: input.data,
    metadata: { routeFamily: 'growth' },
  })
  if (!delegated.ok) {
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  return delegated.row as T
}

async function ensureGrowthSubject(input: {
  bizId: string
  subjectType: string
  subjectId: string
  displayName?: string | null
  metadata?: Record<string, unknown>
}) {
  await db
    .insert(subjects)
    .values({
      bizId: input.bizId,
      subjectType: normalizedKey(input.subjectType),
      subjectId: input.subjectId,
      displayName: input.displayName ? sanitizePlainText(input.displayName) : null,
      status: 'active',
      isLinkable: true,
      metadata: sanitizeUnknown(input.metadata ?? {}) as Record<string, unknown>,
    })
    .onConflictDoNothing({
      target: [subjects.bizId, subjects.subjectType, subjects.subjectId],
    })
}

async function emitGrowthDomainEvent(input: {
  bizId: string
  eventKey: string
  eventFamily: string
  subjectType: string
  subjectId: string
  summary: string
  payload?: Record<string, unknown>
  metadata?: Record<string, unknown>
  actorUserId?: string | null
}): Promise<{
  domainEventId: string
  workflowDispatch: GrowthWorkflowDispatchSummary
}> {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(domainEvents)
      .values({
        bizId: input.bizId,
        eventKey: input.eventKey,
        eventFamily: input.eventFamily,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        actorType: 'api',
        actorUserId: input.actorUserId ?? null,
        payload: sanitizeUnknown(input.payload ?? {}),
        summary: sanitizePlainText(input.summary),
        metadata: sanitizeUnknown(input.metadata ?? {}),
      })
      .returning()

    const workflowDispatch = await dispatchWorkflowTriggers({
      tx,
      bizId: input.bizId,
      triggerSource: 'domain_event',
      triggerRefId: event.id,
      targetType: input.subjectType,
      targetRefId: input.subjectId,
      domainEventKey: input.eventKey,
      inputPayload: sanitizeUnknown(input.payload ?? {}) as Record<string, unknown>,
      metadata: sanitizeUnknown({
        source: 'growth-routes',
        eventFamily: input.eventFamily,
      }) as Record<string, unknown>,
    })

    return {
      domainEventId: event.id,
      workflowDispatch: {
        matchedTriggers: workflowDispatch.matchedTriggers,
        launchedCount: workflowDispatch.launchedCount,
        reusedCount: workflowDispatch.reusedCount,
        skippedCount: workflowDispatch.skippedCount,
      },
    }
  })
}

async function pickVariantForSubject(input: {
  bizId: string
  growthExperimentId: string
  subjectType: string
  subjectRefId: string
  assignmentKey?: string | null
}) {
  const variants = await db.query.growthExperimentVariants.findMany({
    where: and(
      eq(growthExperimentVariants.bizId, input.bizId),
      eq(growthExperimentVariants.growthExperimentId, input.growthExperimentId),
      eq(growthExperimentVariants.status, 'active'),
    ),
    orderBy: [desc(growthExperimentVariants.isControl), desc(growthExperimentVariants.allocationBps), asc(growthExperimentVariants.variantKey)],
  })

  if (variants.length === 0) {
    return null
  }

  const total = variants.reduce((sum, row) => sum + (row.allocationBps ?? 0), 0)
  if (total <= 0) {
    return variants[0]
  }

  const slot = hashToBps(
    `${input.growthExperimentId}:${input.subjectType}:${input.subjectRefId}:${input.assignmentKey ?? ''}`,
  )
  let cursor = 0
  for (const row of variants) {
    cursor += row.allocationBps
    if (slot < cursor) return row
  }
  return variants[variants.length - 1]
}

export const growthRoutes = new Hono()

growthRoutes.get(
  '/bizes/:bizId/growth/localization/resources',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const targetType = c.req.query('targetType')
    const targetRefId = c.req.query('targetRefId')
    const rows = await db.query.growthLocalizationResources.findMany({
      where: and(
        eq(growthLocalizationResources.bizId, bizId),
        targetType ? eq(growthLocalizationResources.targetType, targetType) : undefined,
        targetRefId ? eq(growthLocalizationResources.targetRefId, targetRefId) : undefined,
      ),
      orderBy: [asc(growthLocalizationResources.targetType), asc(growthLocalizationResources.fieldKey)],
    })
    return ok(c, rows)
  },
)

growthRoutes.post(
  '/bizes/:bizId/growth/localization/resources',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = localizationResourceBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid localization resource body.', 400, parsed.error.flatten())
    const key = normalizedKey(parsed.data.key)

    const existing = await db.query.growthLocalizationResources.findFirst({
      where: and(
        eq(growthLocalizationResources.bizId, bizId),
        eq(growthLocalizationResources.key, key),
      ),
    })
    if (existing) {
      await ensureGrowthSubject({
        bizId,
        subjectType: 'growth_localization_resource',
        subjectId: existing.id,
        displayName: existing.name,
        metadata: { route: 'growth/localization/resources', reason: 'reused' },
      })
      return ok(c, existing, 200, { reused: true })
    }

    const created = await createGrowthRow<typeof growthLocalizationResources.$inferSelect>({
      c,
      bizId,
      tableKey: 'growthLocalizationResources',
      subjectType: 'growth_localization_resource',
      displayName: parsed.data.name,
      data: {
        bizId,
        key,
        name: sanitizePlainText(parsed.data.name),
        targetType: normalizedKey(parsed.data.targetType),
        targetRefId: parsed.data.targetRefId,
        fieldKey: normalizedKey(parsed.data.fieldKey),
        defaultLocale: sanitizePlainText(parsed.data.defaultLocale),
        status: parsed.data.status,
        currentVersion: 1,
        metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    const event = await emitGrowthDomainEvent({
      bizId,
      eventKey: 'growth.localization.resource.created',
      eventFamily: 'growth',
      subjectType: 'growth_localization_resource',
      subjectId: created.id as string,
      summary: `Localization resource created: ${parsed.data.key}`,
      payload: {
        growthLocalizationResourceId: created.id,
        targetType: created.targetType,
        targetRefId: created.targetRefId,
        fieldKey: created.fieldKey,
      },
      metadata: { route: 'growth/localization/resources' },
    })

    return ok(c, created, 201, {
      domainEventId: event.domainEventId,
      workflowDispatch: event.workflowDispatch,
    })
  },
)

growthRoutes.get(
  '/bizes/:bizId/growth/localization/resources/:resourceId/values',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, resourceId } = c.req.param()
    const locale = c.req.query('locale')
    const rows = await db.query.growthLocalizationValues.findMany({
      where: and(
        eq(growthLocalizationValues.bizId, bizId),
        eq(growthLocalizationValues.growthLocalizationResourceId, resourceId),
        locale ? eq(growthLocalizationValues.locale, locale) : undefined,
      ),
      orderBy: [asc(growthLocalizationValues.locale), desc(growthLocalizationValues.version)],
    })
    return ok(c, rows)
  },
)

growthRoutes.post(
  '/bizes/:bizId/growth/localization/resources/:resourceId/values',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, resourceId } = c.req.param()
    const parsed = localizationValueBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid localization value body.', 400, parsed.error.flatten())

    const resource = await db.query.growthLocalizationResources.findFirst({
      where: and(eq(growthLocalizationResources.bizId, bizId), eq(growthLocalizationResources.id, resourceId)),
    })
    if (!resource) return fail(c, 'NOT_FOUND', 'Localization resource not found.', 404)

    const latestForLocale = await db.query.growthLocalizationValues.findFirst({
      where: and(
        eq(growthLocalizationValues.bizId, bizId),
        eq(growthLocalizationValues.growthLocalizationResourceId, resourceId),
        eq(growthLocalizationValues.locale, parsed.data.locale),
      ),
      orderBy: [desc(growthLocalizationValues.version)],
    })
    const nextVersion = Math.max(1, (latestForLocale?.version ?? 0) + 1)

    if (parsed.data.isCurrent) {
      await db
        .update(growthLocalizationValues)
        .set({ isCurrent: false })
        .where(
          and(
            eq(growthLocalizationValues.bizId, bizId),
            eq(growthLocalizationValues.growthLocalizationResourceId, resourceId),
            eq(growthLocalizationValues.locale, parsed.data.locale),
            eq(growthLocalizationValues.isCurrent, true),
          ),
        )
    }

    const created = await createGrowthRow<typeof growthLocalizationValues.$inferSelect>({
      c,
      bizId,
      tableKey: 'growthLocalizationValues',
      subjectType: 'growth_localization_value',
      displayName: `${resource.key}:${parsed.data.locale}`,
      data: {
        bizId,
        growthLocalizationResourceId: resourceId,
        locale: sanitizePlainText(parsed.data.locale),
        version: nextVersion,
        isCurrent: parsed.data.isCurrent,
        isMachineGenerated: parsed.data.isMachineGenerated,
        sourceType: normalizedKey(parsed.data.sourceType),
        contentText: parsed.data.contentText ?? null,
        contentJson: parsed.data.contentJson ? cleanMetadata(parsed.data.contentJson) : null,
        qualityScore: parsed.data.qualityScore ?? null,
        status: parsed.data.status,
        metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    await db
      .update(growthLocalizationResources)
      .set({
        currentVersion: resource.currentVersion + 1,
      })
      .where(and(eq(growthLocalizationResources.bizId, bizId), eq(growthLocalizationResources.id, resourceId)))

    await ensureGrowthSubject({
      bizId,
      subjectType: 'growth_localization_resource',
      subjectId: resourceId,
      displayName: resource.name,
      metadata: { route: 'growth/localization/resources/:resourceId/values', reason: 'event-subject-guard' },
    })

    const event = await emitGrowthDomainEvent({
      bizId,
      eventKey: 'growth.localization.value.upserted',
      eventFamily: 'growth',
      subjectType: 'growth_localization_resource',
      subjectId: resourceId,
      summary: `Localization value upserted for ${resource.key} (${parsed.data.locale})`,
      payload: {
        growthLocalizationValueId: created.id,
        growthLocalizationResourceId: resourceId,
        locale: created.locale,
        version: created.version,
        isCurrent: created.isCurrent,
      },
      metadata: { route: 'growth/localization/resources/:resourceId/values' },
    })

    return ok(c, created, 201, {
      domainEventId: event.domainEventId,
      workflowDispatch: event.workflowDispatch,
    })
  },
)

growthRoutes.post(
  '/bizes/:bizId/growth/localization/resolve',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = localizationResolveBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid localization resolve payload.', 400, parsed.error.flatten())

    const resource = await db.query.growthLocalizationResources.findFirst({
      where: and(
        eq(growthLocalizationResources.bizId, bizId),
        eq(growthLocalizationResources.targetType, normalizedKey(parsed.data.targetType)),
        eq(growthLocalizationResources.targetRefId, parsed.data.targetRefId),
        eq(growthLocalizationResources.fieldKey, normalizedKey(parsed.data.fieldKey)),
        eq(growthLocalizationResources.status, 'active'),
      ),
    })
    if (!resource) return fail(c, 'NOT_FOUND', 'Localization resource not found for requested target/field.', 404)

    const fallbackChain = Array.from(
      new Set([
        parsed.data.locale,
        ...parsed.data.fallbackLocales,
        resource.defaultLocale,
      ]),
    )
    const rows = await db.query.growthLocalizationValues.findMany({
      where: and(
        eq(growthLocalizationValues.bizId, bizId),
        eq(growthLocalizationValues.growthLocalizationResourceId, resource.id),
        eq(growthLocalizationValues.isCurrent, true),
        eq(growthLocalizationValues.status, 'active'),
        inArray(growthLocalizationValues.locale, fallbackChain),
      ),
    })

    const valueByLocale = new Map(rows.map((row) => [row.locale, row] as const))
    const resolved = fallbackChain.map((locale) => valueByLocale.get(locale)).find(Boolean) ?? null
    if (!resolved) {
      return fail(c, 'NOT_FOUND', 'No active localization value found for requested locale/fallback chain.', 404, {
        fallbackChain,
        resourceId: resource.id,
      })
    }

    return ok(c, {
      resource,
      resolvedLocale: resolved.locale,
      fallbackChain,
      value: resolved,
    })
  },
)

growthRoutes.get(
  '/bizes/:bizId/growth/experiments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listExperimentsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(growthExperiments.bizId, bizId),
      parsed.data.status ? eq(growthExperiments.status, parsed.data.status) : undefined,
      parsed.data.targetType ? eq(growthExperiments.targetType, parsed.data.targetType) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.growthExperiments.findMany({
        where,
        orderBy: [desc(growthExperiments.startsAt), asc(growthExperiments.key)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(growthExperiments).where(where),
    ])
    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total,
        hasMore: pageInfo.page * pageInfo.perPage < total,
      },
    })
  },
)

growthRoutes.post(
  '/bizes/:bizId/growth/experiments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createExperimentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid experiment body.', 400, parsed.error.flatten())
    const key = normalizedKey(parsed.data.key)

    const existing = await db.query.growthExperiments.findFirst({
      where: and(
        eq(growthExperiments.bizId, bizId),
        eq(growthExperiments.key, key),
      ),
    })
    if (existing) {
      await ensureGrowthSubject({
        bizId,
        subjectType: 'growth_experiment',
        subjectId: existing.id,
        displayName: existing.name,
        metadata: { route: 'growth/experiments', reason: 'reused' },
      })
      return ok(c, existing, 200, { reused: true })
    }

    const created = await createGrowthRow<typeof growthExperiments.$inferSelect>({
      c,
      bizId,
      tableKey: 'growthExperiments',
      subjectType: 'growth_experiment',
      displayName: parsed.data.name,
      data: {
        bizId,
        key,
        name: sanitizePlainText(parsed.data.name),
        status: normalizedKey(parsed.data.status),
        hypothesis: parsed.data.hypothesis ? sanitizePlainText(parsed.data.hypothesis) : null,
        objectiveType: normalizedKey(parsed.data.objectiveType),
        assignmentUnitType: normalizedKey(parsed.data.assignmentUnitType),
        assignmentStrategy: normalizedKey(parsed.data.assignmentStrategy),
        marketingAudienceSegmentId: parsed.data.marketingAudienceSegmentId ?? null,
        targetType: parsed.data.targetType ? normalizedKey(parsed.data.targetType) : null,
        targetRefId: parsed.data.targetRefId ?? null,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    const event = await emitGrowthDomainEvent({
      bizId,
      eventKey: 'growth.experiment.created',
      eventFamily: 'growth',
      subjectType: 'growth_experiment',
      subjectId: created.id as string,
      summary: `Experiment created: ${parsed.data.key}`,
      payload: {
        growthExperimentId: created.id,
        key: created.key,
        status: created.status,
      },
      metadata: { route: 'growth/experiments' },
    })

    return ok(c, created, 201, {
      domainEventId: event.domainEventId,
      workflowDispatch: event.workflowDispatch,
    })
  },
)

growthRoutes.get(
  '/bizes/:bizId/growth/experiments/:experimentId/variants',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, experimentId } = c.req.param()
    const rows = await db.query.growthExperimentVariants.findMany({
      where: and(
        eq(growthExperimentVariants.bizId, bizId),
        eq(growthExperimentVariants.growthExperimentId, experimentId),
      ),
      orderBy: [desc(growthExperimentVariants.isControl), desc(growthExperimentVariants.allocationBps), asc(growthExperimentVariants.variantKey)],
    })
    return ok(c, rows)
  },
)

growthRoutes.post(
  '/bizes/:bizId/growth/experiments/:experimentId/variants',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, experimentId } = c.req.param()
    const parsed = createExperimentVariantBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid experiment variant body.', 400, parsed.error.flatten())
    const variantKey = normalizedKey(parsed.data.variantKey)

    const experiment = await db.query.growthExperiments.findFirst({
      where: and(eq(growthExperiments.bizId, bizId), eq(growthExperiments.id, experimentId)),
    })
    if (!experiment) return fail(c, 'NOT_FOUND', 'Experiment not found.', 404)

    const existingVariant = await db.query.growthExperimentVariants.findFirst({
      where: and(
        eq(growthExperimentVariants.bizId, bizId),
        eq(growthExperimentVariants.growthExperimentId, experimentId),
        eq(growthExperimentVariants.variantKey, variantKey),
      ),
    })
    if (existingVariant) {
      await ensureGrowthSubject({
        bizId,
        subjectType: 'growth_experiment_variant',
        subjectId: existingVariant.id,
        displayName: existingVariant.name,
        metadata: { route: 'growth/experiments/:experimentId/variants', reason: 'reused' },
      })
      return ok(c, existingVariant, 200, { reused: true })
    }

    const existingVariants = await db.query.growthExperimentVariants.findMany({
      where: and(
        eq(growthExperimentVariants.bizId, bizId),
        eq(growthExperimentVariants.growthExperimentId, experimentId),
      ),
    })
    const allocationAfter = existingVariants.reduce((sum, row) => sum + row.allocationBps, 0) + parsed.data.allocationBps
    if (allocationAfter > 10000) {
      return fail(c, 'VALIDATION_ERROR', 'Total variant allocation cannot exceed 10000 bps.', 409, {
        allocationAfter,
      })
    }

    const created = await createGrowthRow<typeof growthExperimentVariants.$inferSelect>({
      c,
      bizId,
      tableKey: 'growthExperimentVariants',
      subjectType: 'growth_experiment_variant',
      displayName: parsed.data.name,
      data: {
        bizId,
        growthExperimentId: experimentId,
        variantKey,
        name: sanitizePlainText(parsed.data.name),
        status: parsed.data.status,
        isControl: parsed.data.isControl,
        allocationBps: parsed.data.allocationBps,
        treatment: cleanMetadata(parsed.data.treatment),
        metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    const event = await emitGrowthDomainEvent({
      bizId,
      eventKey: 'growth.experiment.variant.created',
      eventFamily: 'growth',
      subjectType: 'growth_experiment',
      subjectId: experimentId,
      summary: `Experiment variant created: ${parsed.data.variantKey}`,
      payload: {
        growthExperimentId: experimentId,
        growthExperimentVariantId: created.id,
        allocationBps: created.allocationBps,
      },
      metadata: { route: 'growth/experiments/:experimentId/variants' },
    })

    return ok(c, created, 201, {
      domainEventId: event.domainEventId,
      workflowDispatch: event.workflowDispatch,
      allocationAfter,
    })
  },
)

growthRoutes.get(
  '/bizes/:bizId/growth/experiments/:experimentId/assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, experimentId } = c.req.param()
    const subjectType = c.req.query('subjectType')
    const subjectRefId = c.req.query('subjectRefId')
    const rows = await db.query.growthExperimentAssignments.findMany({
      where: and(
        eq(growthExperimentAssignments.bizId, bizId),
        eq(growthExperimentAssignments.growthExperimentId, experimentId),
        subjectType ? eq(growthExperimentAssignments.subjectType, subjectType) : undefined,
        subjectRefId ? eq(growthExperimentAssignments.subjectRefId, subjectRefId) : undefined,
      ),
      orderBy: [desc(growthExperimentAssignments.assignedAt)],
    })
    return ok(c, rows)
  },
)

growthRoutes.post(
  '/bizes/:bizId/growth/experiments/:experimentId/assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, experimentId } = c.req.param()
    const parsed = createExperimentAssignmentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid assignment body.', 400, parsed.error.flatten())

    const experiment = await db.query.growthExperiments.findFirst({
      where: and(eq(growthExperiments.bizId, bizId), eq(growthExperiments.id, experimentId)),
    })
    if (!experiment) return fail(c, 'NOT_FOUND', 'Experiment not found.', 404)

    const existing = await db.query.growthExperimentAssignments.findFirst({
      where: and(
        eq(growthExperimentAssignments.bizId, bizId),
        eq(growthExperimentAssignments.growthExperimentId, experimentId),
        eq(growthExperimentAssignments.subjectType, parsed.data.subjectType),
        eq(growthExperimentAssignments.subjectRefId, parsed.data.subjectRefId),
      ),
    })
    if (existing) {
      await ensureGrowthSubject({
        bizId,
        subjectType: 'growth_experiment_assignment',
        subjectId: existing.id,
        displayName: `${existing.subjectType}:${existing.subjectRefId}`,
        metadata: { route: 'growth/experiments/:experimentId/assignments', reason: 'reused' },
      })
      return ok(c, existing, 200, {
        reused: true,
      })
    }

    const selectedVariant =
      parsed.data.growthExperimentVariantId
        ? await db.query.growthExperimentVariants.findFirst({
            where: and(
              eq(growthExperimentVariants.bizId, bizId),
              eq(growthExperimentVariants.id, parsed.data.growthExperimentVariantId),
              eq(growthExperimentVariants.growthExperimentId, experimentId),
            ),
          })
        : await pickVariantForSubject({
            bizId,
            growthExperimentId: experimentId,
            subjectType: parsed.data.subjectType,
            subjectRefId: parsed.data.subjectRefId,
            assignmentKey: parsed.data.assignmentKey ?? null,
          })

    if (!selectedVariant) {
      return fail(c, 'VALIDATION_ERROR', 'No eligible active variant found for assignment.', 409)
    }

    const assignedAt = parsed.data.exposedAt
      ? new Date(parsed.data.exposedAt)
      : parsed.data.convertedAt
        ? new Date(parsed.data.convertedAt)
        : new Date()

    const created = await createGrowthRow<typeof growthExperimentAssignments.$inferSelect>({
      c,
      bizId,
      tableKey: 'growthExperimentAssignments',
      subjectType: 'growth_experiment_assignment',
      displayName: `${parsed.data.subjectType}:${parsed.data.subjectRefId}`,
      data: {
        bizId,
        growthExperimentId: experimentId,
        growthExperimentVariantId: selectedVariant.id,
        subjectType: normalizedKey(parsed.data.subjectType),
        subjectRefId: parsed.data.subjectRefId,
        assignmentKey: parsed.data.assignmentKey ?? null,
        status: parsed.data.status,
        assignedAt,
        exposedAt: parsed.data.exposedAt ? new Date(parsed.data.exposedAt) : null,
        convertedAt: parsed.data.convertedAt ? new Date(parsed.data.convertedAt) : null,
        conversionEventKey: parsed.data.conversionEventKey ? sanitizePlainText(parsed.data.conversionEventKey) : null,
        conversionValueMinor: parsed.data.conversionValueMinor ?? null,
        currency: parsed.data.currency,
        sourceType: normalizedKey(parsed.data.sourceType),
        metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    const event = await emitGrowthDomainEvent({
      bizId,
      eventKey: 'growth.experiment.assignment.recorded',
      eventFamily: 'growth',
      subjectType: 'growth_experiment_assignment',
      subjectId: created.id as string,
      summary: `Experiment assignment recorded for ${parsed.data.subjectType}:${parsed.data.subjectRefId}`,
      payload: {
        growthExperimentId: experimentId,
        growthExperimentAssignmentId: created.id,
        growthExperimentVariantId: created.growthExperimentVariantId,
        status: created.status,
      },
      metadata: { route: 'growth/experiments/:experimentId/assignments' },
    })

    return ok(c, created, 201, {
      domainEventId: event.domainEventId,
      workflowDispatch: event.workflowDispatch,
      selectedVariant,
    })
  },
)

growthRoutes.get(
  '/bizes/:bizId/growth/experiments/:experimentId/measurements',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, experimentId } = c.req.param()
    const metricKey = c.req.query('metricKey')
    const rows = await db.query.growthExperimentMeasurements.findMany({
      where: and(
        eq(growthExperimentMeasurements.bizId, bizId),
        eq(growthExperimentMeasurements.growthExperimentId, experimentId),
        metricKey ? eq(growthExperimentMeasurements.metricKey, metricKey) : undefined,
      ),
      orderBy: [desc(growthExperimentMeasurements.observedAt)],
    })
    return ok(c, rows)
  },
)

growthRoutes.post(
  '/bizes/:bizId/growth/experiments/:experimentId/measurements',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, experimentId } = c.req.param()
    const parsed = createExperimentMeasurementBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid measurement body.', 400, parsed.error.flatten())

    const metricValue = Number(parsed.data.metricValue)
    if (!Number.isFinite(metricValue)) {
      return fail(c, 'VALIDATION_ERROR', 'metricValue must be numeric.', 400)
    }

    const created = await createGrowthRow<typeof growthExperimentMeasurements.$inferSelect>({
      c,
      bizId,
      tableKey: 'growthExperimentMeasurements',
      subjectType: 'growth_experiment_measurement',
      displayName: parsed.data.metricKey,
      data: {
        bizId,
        growthExperimentId: experimentId,
        growthExperimentVariantId: parsed.data.growthExperimentVariantId ?? null,
        growthExperimentAssignmentId: parsed.data.growthExperimentAssignmentId ?? null,
        metricKey: normalizedKey(parsed.data.metricKey),
        metricValue: metricValue.toString(),
        metricUnit: parsed.data.metricUnit ? sanitizePlainText(parsed.data.metricUnit) : null,
        observedAt: parsed.data.observedAt ? new Date(parsed.data.observedAt) : new Date(),
        sourceType: normalizedKey(parsed.data.sourceType),
        eventRef: parsed.data.eventRef ? sanitizePlainText(parsed.data.eventRef) : null,
        payload: cleanMetadata(parsed.data.payload),
        metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    const event = await emitGrowthDomainEvent({
      bizId,
      eventKey: 'growth.experiment.measurement.recorded',
      eventFamily: 'growth',
      subjectType: 'growth_experiment',
      subjectId: experimentId,
      summary: `Experiment metric recorded: ${parsed.data.metricKey}`,
      payload: {
        growthExperimentId: experimentId,
        growthExperimentMeasurementId: created.id,
        metricKey: created.metricKey,
        metricValue: created.metricValue,
      },
      metadata: { route: 'growth/experiments/:experimentId/measurements' },
    })

    return ok(c, created, 201, {
      domainEventId: event.domainEventId,
      workflowDispatch: event.workflowDispatch,
    })
  },
)

growthRoutes.get(
  '/bizes/:bizId/growth/experiments/:experimentId/summary',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, experimentId } = c.req.param()
    const [experiment, variants, assignments, measurements] = await Promise.all([
      db.query.growthExperiments.findFirst({
        where: and(eq(growthExperiments.bizId, bizId), eq(growthExperiments.id, experimentId)),
      }),
      db.query.growthExperimentVariants.findMany({
        where: and(eq(growthExperimentVariants.bizId, bizId), eq(growthExperimentVariants.growthExperimentId, experimentId)),
      }),
      db.query.growthExperimentAssignments.findMany({
        where: and(eq(growthExperimentAssignments.bizId, bizId), eq(growthExperimentAssignments.growthExperimentId, experimentId)),
      }),
      db.query.growthExperimentMeasurements.findMany({
        where: and(eq(growthExperimentMeasurements.bizId, bizId), eq(growthExperimentMeasurements.growthExperimentId, experimentId)),
      }),
    ])
    if (!experiment) return fail(c, 'NOT_FOUND', 'Experiment not found.', 404)

    const perVariant = variants.map((variant) => {
      const variantAssignments = assignments.filter((row) => row.growthExperimentVariantId === variant.id)
      const conversions = variantAssignments.filter((row) => row.status === 'converted').length
      const exposures = variantAssignments.filter((row) => row.status === 'exposed' || row.status === 'converted').length
      const conversionValueMinor = variantAssignments.reduce((sum, row) => sum + (row.conversionValueMinor ?? 0), 0)
      const variantMeasurements = measurements.filter((row) => row.growthExperimentVariantId === variant.id)
      return {
        variant,
        counts: {
          assignments: variantAssignments.length,
          exposures,
          conversions,
          conversionRate: exposures > 0 ? conversions / exposures : 0,
          conversionValueMinor,
        },
        measurements: variantMeasurements,
      }
    })

    return ok(c, {
      experiment,
      totals: {
        assignments: assignments.length,
        exposures: assignments.filter((row) => row.status === 'exposed' || row.status === 'converted').length,
        conversions: assignments.filter((row) => row.status === 'converted').length,
        measurementCount: measurements.length,
        conversionValueMinor: assignments.reduce((sum, row) => sum + (row.conversionValueMinor ?? 0), 0),
      },
      perVariant,
    })
  },
)

growthRoutes.get(
  '/bizes/:bizId/growth/marketing-activations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listActivationsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(growthMarketingActivations.bizId, bizId),
      parsed.data.status ? eq(growthMarketingActivations.status, parsed.data.status) : undefined,
      parsed.data.provider ? eq(growthMarketingActivations.provider, parsed.data.provider) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.growthMarketingActivations.findMany({
        where,
        orderBy: [asc(growthMarketingActivations.provider), asc(growthMarketingActivations.key)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(growthMarketingActivations).where(where),
    ])
    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total,
        hasMore: pageInfo.page * pageInfo.perPage < total,
      },
    })
  },
)

growthRoutes.post(
  '/bizes/:bizId/growth/marketing-activations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createActivationBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid marketing activation body.', 400, parsed.error.flatten())
    const key = normalizedKey(parsed.data.key)

    const sourceCount =
      Number(Boolean(parsed.data.growthExperimentId)) +
      Number(Boolean(parsed.data.growthExperimentVariantId)) +
      Number(Boolean(parsed.data.marketingCampaignId)) +
      Number(Boolean(parsed.data.messageTemplateId)) +
      Number(Boolean(parsed.data.marketingAudienceSegmentId))
    if (sourceCount < 1) {
      return fail(c, 'VALIDATION_ERROR', 'At least one source pointer is required for activation.', 409)
    }

    const existing = await db.query.growthMarketingActivations.findFirst({
      where: and(
        eq(growthMarketingActivations.bizId, bizId),
        eq(growthMarketingActivations.key, key),
      ),
    })
    if (existing) {
      await ensureGrowthSubject({
        bizId,
        subjectType: 'growth_marketing_activation',
        subjectId: existing.id,
        displayName: existing.name,
        metadata: { route: 'growth/marketing-activations', reason: 'reused' },
      })
      return ok(c, existing, 200, { reused: true })
    }

    const created = await createGrowthRow<typeof growthMarketingActivations.$inferSelect>({
      c,
      bizId,
      tableKey: 'growthMarketingActivations',
      subjectType: 'growth_marketing_activation',
      displayName: parsed.data.name,
      data: {
        bizId,
        key,
        name: sanitizePlainText(parsed.data.name),
        status: parsed.data.status,
        provider: normalizedKey(parsed.data.provider),
        channelAccountId: parsed.data.channelAccountId ?? null,
        sourceType: normalizedKey(parsed.data.sourceType),
        growthExperimentId: parsed.data.growthExperimentId ?? null,
        growthExperimentVariantId: parsed.data.growthExperimentVariantId ?? null,
        marketingCampaignId: parsed.data.marketingCampaignId ?? null,
        messageTemplateId: parsed.data.messageTemplateId ?? null,
        marketingAudienceSegmentId: parsed.data.marketingAudienceSegmentId ?? null,
        destinationRef: parsed.data.destinationRef ? sanitizePlainText(parsed.data.destinationRef) : null,
        syncMode: normalizedKey(parsed.data.syncMode),
        publishPolicy: cleanMetadata(parsed.data.publishPolicy),
        metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (created instanceof Response) return created

    const event = await emitGrowthDomainEvent({
      bizId,
      eventKey: 'growth.activation.created',
      eventFamily: 'growth',
      subjectType: 'growth_marketing_activation',
      subjectId: created.id as string,
      summary: `Growth activation created: ${parsed.data.key}`,
      payload: {
        growthMarketingActivationId: created.id,
        provider: created.provider,
      },
      metadata: { route: 'growth/marketing-activations' },
    })

    return ok(c, created, 201, {
      domainEventId: event.domainEventId,
      workflowDispatch: event.workflowDispatch,
    })
  },
)

growthRoutes.get(
  '/bizes/:bizId/growth/marketing-activations/:activationId/runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, activationId } = c.req.param()
    const rows = await db.query.growthMarketingActivationRuns.findMany({
      where: and(
        eq(growthMarketingActivationRuns.bizId, bizId),
        eq(growthMarketingActivationRuns.growthMarketingActivationId, activationId),
      ),
      orderBy: [desc(growthMarketingActivationRuns.startedAt)],
    })
    return ok(c, rows)
  },
)

growthRoutes.post(
  '/bizes/:bizId/growth/marketing-activations/:activationId/runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, activationId } = c.req.param()
    const parsed = createActivationRunBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid activation run body.', 400, parsed.error.flatten())

    const activation = await db.query.growthMarketingActivations.findFirst({
      where: and(eq(growthMarketingActivations.bizId, bizId), eq(growthMarketingActivations.id, activationId)),
    })
    if (!activation) return fail(c, 'NOT_FOUND', 'Activation not found.', 404)

    const createdRun = await createGrowthRow<typeof growthMarketingActivationRuns.$inferSelect>({
      c,
      bizId,
      tableKey: 'growthMarketingActivationRuns',
      subjectType: 'growth_marketing_activation_run',
      displayName: `${activation.key}:${parsed.data.status}`,
      data: {
        bizId,
        growthMarketingActivationId: activationId,
        status: parsed.data.status,
        triggerSource: normalizedKey(parsed.data.triggerSource),
        triggerRefId: parsed.data.triggerRefId ?? null,
        initiatedByUserId: parsed.data.initiatedByUserId ?? null,
        startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : new Date(),
        finishedAt: parsed.data.finishedAt ? new Date(parsed.data.finishedAt) : null,
        inputPayload: cleanMetadata(parsed.data.inputPayload),
        outputPayload: cleanMetadata(parsed.data.outputPayload),
        errorCode: parsed.data.errorCode ? sanitizePlainText(parsed.data.errorCode) : null,
        errorMessage: parsed.data.errorMessage ? sanitizePlainText(parsed.data.errorMessage) : null,
        publishedCount: parsed.data.publishedCount,
        syncedCount: parsed.data.syncedCount,
        failedCount: parsed.data.failedCount,
        metadata: cleanMetadata(parsed.data.metadata),
      },
    })
    if (createdRun instanceof Response) return createdRun

    const itemRows: Array<typeof growthMarketingActivationRunItems.$inferSelect> = []
    for (const item of parsed.data.items) {
      const row = await createGrowthRow<typeof growthMarketingActivationRunItems.$inferSelect>({
        c,
        bizId,
        tableKey: 'growthMarketingActivationRunItems',
        subjectType: 'growth_marketing_activation_run_item',
        displayName: item.itemType,
        data: {
          bizId,
          growthMarketingActivationRunId: createdRun.id,
          itemType: normalizedKey(item.itemType),
          itemRefId: item.itemRefId ?? null,
          externalRef: item.externalRef ?? null,
          status: item.status,
          errorCode: item.errorCode ?? null,
          errorMessage: item.errorMessage ?? null,
          payload: cleanMetadata(item.payload),
          metadata: cleanMetadata(item.metadata),
        },
      })
      if (row instanceof Response) return row
      itemRows.push(row)
    }

    const runEvent = await emitGrowthDomainEvent({
      bizId,
      eventKey: 'growth.activation.run.started',
      eventFamily: 'growth',
      subjectType: 'growth_marketing_activation',
      subjectId: activationId,
      summary: `Growth activation run started: ${createdRun.id}`,
      payload: {
        growthMarketingActivationId: activationId,
        growthMarketingActivationRunId: createdRun.id,
        status: createdRun.status,
        itemCount: itemRows.length,
      },
      metadata: { route: 'growth/marketing-activations/:activationId/runs' },
    })

    let completionEvent: { domainEventId: string; workflowDispatch: GrowthWorkflowDispatchSummary } | null = null
    if (createdRun.status === 'succeeded' || createdRun.status === 'failed' || createdRun.status === 'partial' || createdRun.status === 'cancelled') {
      completionEvent = await emitGrowthDomainEvent({
        bizId,
        eventKey: 'growth.activation.run.completed',
        eventFamily: 'growth',
        subjectType: 'growth_marketing_activation',
        subjectId: activationId,
        summary: `Growth activation run completed: ${createdRun.id} (${createdRun.status})`,
        payload: {
          growthMarketingActivationId: activationId,
          growthMarketingActivationRunId: createdRun.id,
          status: createdRun.status,
          publishedCount: createdRun.publishedCount,
          syncedCount: createdRun.syncedCount,
          failedCount: createdRun.failedCount,
        },
        metadata: { route: 'growth/marketing-activations/:activationId/runs' },
      })
    }

    return ok(c, {
      run: createdRun,
      items: itemRows,
    }, 201, {
      domainEventId: runEvent.domainEventId,
      workflowDispatch: runEvent.workflowDispatch,
      completionDomainEventId: completionEvent?.domainEventId ?? null,
      completionWorkflowDispatch: completionEvent?.workflowDispatch ?? null,
    })
  },
)

growthRoutes.get(
  '/bizes/:bizId/growth/marketing-activation-runs/:runId/items',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, runId } = c.req.param()
    const rows = await db.query.growthMarketingActivationRunItems.findMany({
      where: and(
        eq(growthMarketingActivationRunItems.bizId, bizId),
        eq(growthMarketingActivationRunItems.growthMarketingActivationRunId, runId),
      ),
      orderBy: [asc(growthMarketingActivationRunItems.itemType)],
    })
    return ok(c, rows)
  },
)
