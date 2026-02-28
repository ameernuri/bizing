/**
 * Policy template/rule/binding routes.
 *
 * ELI5:
 * A policy template is a reusable rulebook.
 * A policy rule is one rule inside that rulebook.
 * A policy binding says where the rulebook applies.
 *
 * Why this route matters:
 * - many advanced use cases are "governance on top of core objects" rather
 *   than brand new niche tables,
 * - proctoring, agent safety, hybrid classroom controls, and compliance checks
 *   can all reuse the same canonical policy backbone,
 * - saga validators need first-class API endpoints to prove these controls.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const { db, policyTemplates, policyRules, policyBindings } = dbPackage

const lifecycleSchema = z.enum(['draft', 'active', 'inactive', 'archived'])

const listTemplatesQuerySchema = z.object({
  domainKey: z.string().optional(),
  status: lifecycleSchema.optional(),
})

const createTemplateBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  status: lifecycleSchema.default('active'),
  domainKey: z.string().min(1).max(120),
  description: z.string().max(4000).optional(),
  version: z.number().int().positive().default(1),
  aggregationMode: z.enum(['all', 'any', 'threshold']).default('all'),
  minPassingRuleCount: z.number().int().positive().optional(),
  isDefault: z.boolean().default(false),
  policySnapshot: z.record(z.unknown()).optional(),
  evaluationPolicy: z.record(z.unknown()).optional(),
  consequencePolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateTemplateBodySchema = createTemplateBodySchema
  .omit({ slug: true, domainKey: true })
  .partial()

const createRuleBodySchema = z.object({
  ruleKey: z.string().min(1).max(140),
  name: z.string().min(1).max(220),
  description: z.string().max(4000).optional(),
  status: lifecycleSchema.default('active'),
  predicateType: z.enum(['expression', 'metric_threshold', 'schedule_window', 'event_pattern', 'custom']),
  conditionExpr: z.string().max(4000).optional(),
  metricKey: z.string().max(140).optional(),
  metricComparator: z.enum(['>', '>=', '<', '<=', '=', '!=']).optional(),
  metricThreshold: z.number().int().optional(),
  scheduleWindow: z.record(z.unknown()).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  priority: z.number().int().min(0).default(100),
  isBlocking: z.boolean().default(true),
  isEnabled: z.boolean().default(true),
  evidencePolicy: z.record(z.unknown()).optional(),
  consequencePolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createBindingBodySchema = z
  .object({
    policyTemplateId: z.string().min(1),
    targetType: z.enum([
      'biz',
      'location',
      'resource',
      'service',
      'service_product',
      'offer',
      'offer_version',
      'queue',
      'subject',
    ]),
    locationId: z.string().optional(),
    resourceId: z.string().optional(),
    serviceId: z.string().optional(),
    serviceProductId: z.string().optional(),
    offerId: z.string().optional(),
    offerVersionId: z.string().optional(),
    queueId: z.string().optional(),
    targetSubjectType: z.string().max(80).optional(),
    targetSubjectId: z.string().max(140).optional(),
    priority: z.number().int().min(0).default(100),
    isActive: z.boolean().default(true),
    enforcementPolicy: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    const count = [
      value.locationId,
      value.resourceId,
      value.serviceId,
      value.serviceProductId,
      value.offerId,
      value.offerVersionId,
      value.queueId,
      value.targetSubjectType && value.targetSubjectId ? `${value.targetSubjectType}:${value.targetSubjectId}` : null,
    ].filter(Boolean).length

    if (value.targetType === 'biz') {
      if (count > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'biz target must not include extra target ids.' })
      }
      return
    }

    const expectedField =
      value.targetType === 'location'
        ? value.locationId
        : value.targetType === 'resource'
          ? value.resourceId
          : value.targetType === 'service'
            ? value.serviceId
            : value.targetType === 'service_product'
              ? value.serviceProductId
              : value.targetType === 'offer'
                ? value.offerId
                : value.targetType === 'offer_version'
                  ? value.offerVersionId
                  : value.targetType === 'queue'
                    ? value.queueId
                    : value.targetSubjectType && value.targetSubjectId
                      ? `${value.targetSubjectType}:${value.targetSubjectId}`
                      : null

    if (!expectedField || count !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Binding target payload must match targetType exactly.',
      })
    }
  })

export const policyRoutes = new Hono()

policyRoutes.get(
  '/bizes/:bizId/policies/templates',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listTemplatesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const rows = await db.query.policyTemplates.findMany({
      where: and(
        eq(policyTemplates.bizId, bizId),
        parsed.data.domainKey ? eq(policyTemplates.domainKey, parsed.data.domainKey) : undefined,
        parsed.data.status ? eq(policyTemplates.status, parsed.data.status) : undefined,
      ),
      orderBy: [asc(policyTemplates.domainKey), desc(policyTemplates.version)],
      limit: 200,
    })
    return ok(c, rows)
  },
)

policyRoutes.post(
  '/bizes/:bizId/policies/templates',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    /**
     * Keep template creation idempotent for setup/saga flows.
     *
     * ELI5:
     * A saga may "set up the same rulebook again" while proving another step.
     * The schema is right to allow only one active default template per biz+domain.
     * Instead of crashing with a 500, we reuse the matching template when the
     * caller is effectively asking for the same thing again.
     */
    const existingDefault =
      parsed.data.isDefault
        ? await db.query.policyTemplates.findFirst({
            where: and(
              eq(policyTemplates.bizId, bizId),
              eq(policyTemplates.domainKey, parsed.data.domainKey),
              eq(policyTemplates.isDefault, true),
              eq(policyTemplates.status, 'active'),
            ),
            orderBy: [desc(policyTemplates.version)],
          })
        : null

    if (existingDefault) {
      return ok(c, existingDefault, 200, { reused: true })
    }

    const [created] = await db
      .insert(policyTemplates)
      .values({
        bizId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        status: parsed.data.status,
        domainKey: parsed.data.domainKey,
        description: parsed.data.description ?? null,
        version: parsed.data.version,
        aggregationMode: parsed.data.aggregationMode,
        minPassingRuleCount: parsed.data.minPassingRuleCount ?? null,
        isDefault: parsed.data.isDefault,
        policySnapshot: parsed.data.policySnapshot ?? {},
        evaluationPolicy: parsed.data.evaluationPolicy ?? {},
        consequencePolicy: parsed.data.consequencePolicy ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)

policyRoutes.patch(
  '/bizes/:bizId/policies/templates/:policyTemplateId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, policyTemplateId } = c.req.param()
    const parsed = updateTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.policyTemplates.findFirst({
      where: and(eq(policyTemplates.bizId, bizId), eq(policyTemplates.id, policyTemplateId)),
      columns: { id: true },
    })
    if (!existing) {
      return fail(c, 'NOT_FOUND', 'Policy template not found.', 404)
    }

    const [updated] = await db
      .update(policyTemplates)
      .set({
        name: parsed.data.name,
        status: parsed.data.status,
        description: parsed.data.description ?? undefined,
        version: parsed.data.version,
        aggregationMode: parsed.data.aggregationMode,
        minPassingRuleCount: parsed.data.minPassingRuleCount ?? undefined,
        isDefault: parsed.data.isDefault,
        policySnapshot: parsed.data.policySnapshot,
        evaluationPolicy: parsed.data.evaluationPolicy,
        consequencePolicy: parsed.data.consequencePolicy,
        metadata: parsed.data.metadata,
      })
      .where(and(eq(policyTemplates.bizId, bizId), eq(policyTemplates.id, policyTemplateId)))
      .returning()

    return ok(c, updated)
  },
)

policyRoutes.get(
  '/bizes/:bizId/policies/templates/:policyTemplateId/rules',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, policyTemplateId } = c.req.param()
    const rows = await db.query.policyRules.findMany({
      where: and(eq(policyRules.bizId, bizId), eq(policyRules.policyTemplateId, policyTemplateId)),
      orderBy: [asc(policyRules.priority), asc(policyRules.ruleKey)],
      limit: 500,
    })
    return ok(c, rows)
  },
)

policyRoutes.post(
  '/bizes/:bizId/policies/templates/:policyTemplateId/rules',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, policyTemplateId } = c.req.param()
    const parsed = createRuleBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const [created] = await db
      .insert(policyRules)
      .values({
        bizId,
        policyTemplateId,
        ruleKey: parsed.data.ruleKey,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
        predicateType: parsed.data.predicateType,
        conditionExpr: parsed.data.conditionExpr ?? null,
        metricKey: parsed.data.metricKey ?? null,
        metricComparator: parsed.data.metricComparator ?? null,
        metricThreshold: parsed.data.metricThreshold ?? null,
        scheduleWindow: parsed.data.scheduleWindow ?? null,
        severity: parsed.data.severity,
        priority: parsed.data.priority,
        isBlocking: parsed.data.isBlocking,
        isEnabled: parsed.data.isEnabled,
        evidencePolicy: parsed.data.evidencePolicy ?? {},
        consequencePolicy: parsed.data.consequencePolicy ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)

policyRoutes.get(
  '/bizes/:bizId/policies/bindings',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const targetType = c.req.query('targetType')
    const rows = await db.query.policyBindings.findMany({
      where: and(
        eq(policyBindings.bizId, bizId),
        targetType ? eq(policyBindings.targetType, targetType as never) : undefined,
      ),
      orderBy: [asc(policyBindings.targetType), asc(policyBindings.priority)],
      limit: 500,
    })
    return ok(c, rows)
  },
)

policyRoutes.post(
  '/bizes/:bizId/policies/bindings',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('compliance.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createBindingBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    /**
     * Keep binding creation idempotent for canonical setup flows.
     *
     * ELI5:
     * A template can only be bound once to the same exact target scope. If the
     * same binding is requested again, return the existing row instead of
     * throwing a uniqueness error that looks like an API bug.
     */
    const existingBinding = await db.query.policyBindings.findFirst({
      where: and(
        eq(policyBindings.bizId, bizId),
        eq(policyBindings.policyTemplateId, parsed.data.policyTemplateId),
        eq(policyBindings.targetType, parsed.data.targetType),
        parsed.data.targetType === 'location' && parsed.data.locationId
          ? eq(policyBindings.locationId, parsed.data.locationId)
          : undefined,
        parsed.data.targetType === 'resource' && parsed.data.resourceId
          ? eq(policyBindings.resourceId, parsed.data.resourceId)
          : undefined,
        parsed.data.targetType === 'service' && parsed.data.serviceId
          ? eq(policyBindings.serviceId, parsed.data.serviceId)
          : undefined,
        parsed.data.targetType === 'service_product'
          && parsed.data.serviceProductId
          ? eq(policyBindings.serviceProductId, parsed.data.serviceProductId)
          : undefined,
        parsed.data.targetType === 'offer' && parsed.data.offerId
          ? eq(policyBindings.offerId, parsed.data.offerId)
          : undefined,
        parsed.data.targetType === 'offer_version'
          && parsed.data.offerVersionId
          ? eq(policyBindings.offerVersionId, parsed.data.offerVersionId)
          : undefined,
        parsed.data.targetType === 'queue' && parsed.data.queueId
          ? eq(policyBindings.queueId, parsed.data.queueId)
          : undefined,
        parsed.data.targetType === 'subject'
          && parsed.data.targetSubjectType
          && parsed.data.targetSubjectId
          ? and(
              eq(policyBindings.targetSubjectType, parsed.data.targetSubjectType),
              eq(policyBindings.targetSubjectId, parsed.data.targetSubjectId),
            )
          : undefined,
      ),
    })

    if (existingBinding) {
      return ok(c, existingBinding, 200, { reused: true })
    }

    const [created] = await db
      .insert(policyBindings)
      .values({
        bizId,
        policyTemplateId: parsed.data.policyTemplateId,
        targetType: parsed.data.targetType,
        locationId: parsed.data.locationId ?? null,
        resourceId: parsed.data.resourceId ?? null,
        serviceId: parsed.data.serviceId ?? null,
        serviceProductId: parsed.data.serviceProductId ?? null,
        offerId: parsed.data.offerId ?? null,
        offerVersionId: parsed.data.offerVersionId ?? null,
        queueId: parsed.data.queueId ?? null,
        targetSubjectType: parsed.data.targetSubjectType ?? null,
        targetSubjectId: parsed.data.targetSubjectId ?? null,
        priority: parsed.data.priority,
        isActive: parsed.data.isActive,
        enforcementPolicy: parsed.data.enforcementPolicy ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, created, 201)
  },
)
