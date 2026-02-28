/**
 * Compensation routes
 *
 * Why this module exists:
 * - role templates, plans, rules, and ledger entries already exist in schema,
 * - sagas need real APIs to prove role-based payouts and commissions,
 * - payout logic should be traceable through immutable ledger rows, not
 *   hidden in transient calculator code.
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const {
  db,
  compensationRoleTemplates,
  compensationPlans,
  compensationPlanVersions,
  compensationPlanRules,
  compensationAssignmentRoles,
  compensationLedgerEntries,
  fulfillmentUnits,
  fulfillmentAssignments,
  bookingOrders,
} = dbPackage

const createRoleTemplateBodySchema = z.object({
  locationId: z.string().optional(),
  name: z.string().min(1).max(140),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
  sortOrder: z.number().int().min(0).default(100),
  metadata: z.record(z.unknown()).optional(),
})

const createPlanBodySchema = z.object({
  name: z.string().min(1).max(180),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  description: z.string().max(800).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  locationId: z.string().optional(),
  serviceId: z.string().optional(),
  serviceProductId: z.string().optional(),
  isDefault: z.boolean().default(false),
  priority: z.number().int().min(0).default(100),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createPlanVersionBodySchema = z.object({
  compensationPlanId: z.string(),
  versionNumber: z.number().int().min(1),
  status: z.enum(['draft', 'active', 'retired', 'archived']).default('draft'),
  effectiveFromAt: z.string().datetime(),
  effectiveToAt: z.string().datetime().optional(),
  isCurrent: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
  calculationPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createPlanRuleBodySchema = z.object({
  compensationPlanVersionId: z.string(),
  name: z.string().min(1).max(160),
  description: z.string().max(800).optional(),
  isEnabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(100),
  roleTemplateId: z.string().optional(),
  selectorType: z.enum(['any', 'resource', 'resource_type', 'capability_template', 'location', 'service', 'service_product', 'offer_component']),
  resourceId: z.string().optional(),
  resourceType: z.enum(['host', 'company_host', 'asset', 'venue']).optional(),
  locationId: z.string().optional(),
  serviceId: z.string().optional(),
  serviceProductId: z.string().optional(),
  offerComponentId: z.string().optional(),
  calculationMode: z.enum([
    'flat_amount',
    'percent_of_order_total',
    'percent_of_order_subtotal',
    'percent_of_line_total',
    'hourly',
    'base_plus_percent',
  ]),
  flatAmountMinor: z.number().int().optional(),
  baseAmountMinor: z.number().int().optional(),
  percentBps: z.number().int().min(0).max(10000).optional(),
  hourlyRateMinor: z.number().int().optional(),
  minimumPayoutMinor: z.number().int().optional(),
  maximumPayoutMinor: z.number().int().optional(),
  applyPerQuantity: z.boolean().default(false),
  effectiveFromAt: z.string().datetime().optional(),
  effectiveToAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const resolveForUnitBodySchema = z.object({
  compensationPlanVersionId: z.string(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).default('USD'),
})

function clampAmount(
  amountMinor: number,
  minimumPayoutMinor: number | null | undefined,
  maximumPayoutMinor: number | null | undefined,
) {
  let next = amountMinor
  if (typeof minimumPayoutMinor === 'number') next = Math.max(next, minimumPayoutMinor)
  if (typeof maximumPayoutMinor === 'number') next = Math.min(next, maximumPayoutMinor)
  return next
}

function calculateRuleAmount(rule: typeof compensationPlanRules.$inferSelect, assignmentMinutes: number, booking: typeof bookingOrders.$inferSelect | null) {
  const subtotalMinor = booking?.subtotalMinor ?? 0
  const totalMinor = booking?.totalMinor ?? subtotalMinor
  const hours = assignmentMinutes / 60
  switch (rule.calculationMode) {
    case 'flat_amount':
      return rule.flatAmountMinor ?? 0
    case 'hourly':
      return Math.round((rule.hourlyRateMinor ?? 0) * hours)
    case 'percent_of_order_total':
      return Math.round(totalMinor * ((rule.percentBps ?? 0) / 10000))
    case 'percent_of_order_subtotal':
      return Math.round(subtotalMinor * ((rule.percentBps ?? 0) / 10000))
    case 'base_plus_percent':
      return (rule.baseAmountMinor ?? 0) + Math.round(totalMinor * ((rule.percentBps ?? 0) / 10000))
    default:
      return 0
  }
}

export const compensationRoutes = new Hono()

compensationRoutes.get(
  '/bizes/:bizId/compensation-plan-rules',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const compensationPlanVersionId = c.req.query('compensationPlanVersionId')
    const rows = await db.query.compensationPlanRules.findMany({
      where: and(
        eq(compensationPlanRules.bizId, bizId),
        compensationPlanVersionId
          ? eq(compensationPlanRules.compensationPlanVersionId, compensationPlanVersionId)
          : undefined,
      ),
      orderBy: [asc(compensationPlanRules.priority)],
    })
    return ok(c, rows)
  },
)

compensationRoutes.post(
  '/bizes/:bizId/compensation-role-templates',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createRoleTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [row] = await db
      .insert(compensationRoleTemplates)
      .values({
        bizId,
        locationId: parsed.data.locationId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        status: parsed.data.status,
        sortOrder: parsed.data.sortOrder,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, row, 201)
  },
)

compensationRoutes.post(
  '/bizes/:bizId/compensation-plans',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createPlanBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [row] = await db
      .insert(compensationPlans)
      .values({
        bizId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        status: parsed.data.status,
        currency: parsed.data.currency,
        locationId: parsed.data.locationId,
        serviceId: parsed.data.serviceId,
        serviceProductId: parsed.data.serviceProductId,
        isDefault: parsed.data.isDefault,
        priority: parsed.data.priority,
        policy: parsed.data.policy ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, row, 201)
  },
)

compensationRoutes.post(
  '/bizes/:bizId/compensation-plan-versions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createPlanVersionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [row] = await db
      .insert(compensationPlanVersions)
      .values({
        bizId,
        compensationPlanId: parsed.data.compensationPlanId,
        versionNumber: parsed.data.versionNumber,
        status: parsed.data.status,
        effectiveFromAt: new Date(parsed.data.effectiveFromAt),
        effectiveToAt: parsed.data.effectiveToAt ? new Date(parsed.data.effectiveToAt) : null,
        isCurrent: parsed.data.isCurrent,
        notes: parsed.data.notes,
        calculationPolicy: parsed.data.calculationPolicy ?? {},
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, row, 201)
  },
)

compensationRoutes.post(
  '/bizes/:bizId/compensation-plan-rules',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createPlanRuleBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [row] = await db
      .insert(compensationPlanRules)
      .values({
        bizId,
        compensationPlanVersionId: parsed.data.compensationPlanVersionId,
        name: parsed.data.name,
        description: parsed.data.description,
        isEnabled: parsed.data.isEnabled,
        priority: parsed.data.priority,
        roleTemplateId: parsed.data.roleTemplateId,
        selectorType: parsed.data.selectorType,
        resourceId: parsed.data.resourceId,
        resourceType: parsed.data.resourceType,
        locationId: parsed.data.locationId,
        serviceId: parsed.data.serviceId,
        serviceProductId: parsed.data.serviceProductId,
        offerComponentId: parsed.data.offerComponentId,
        calculationMode: parsed.data.calculationMode,
        flatAmountMinor: parsed.data.flatAmountMinor,
        baseAmountMinor: parsed.data.baseAmountMinor,
        percentBps: parsed.data.percentBps,
        hourlyRateMinor: parsed.data.hourlyRateMinor,
        minimumPayoutMinor: parsed.data.minimumPayoutMinor,
        maximumPayoutMinor: parsed.data.maximumPayoutMinor,
        applyPerQuantity: parsed.data.applyPerQuantity,
        effectiveFromAt: parsed.data.effectiveFromAt ? new Date(parsed.data.effectiveFromAt) : null,
        effectiveToAt: parsed.data.effectiveToAt ? new Date(parsed.data.effectiveToAt) : null,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()

    return ok(c, row, 201)
  },
)

compensationRoutes.post(
  '/bizes/:bizId/compensation/resolve/fulfillment-units/:fulfillmentUnitId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, fulfillmentUnitId } = c.req.param()
    const user = getCurrentUser(c)
    const parsed = resolveForUnitBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const unit = await db.query.fulfillmentUnits.findFirst({
      where: and(eq(fulfillmentUnits.bizId, bizId), eq(fulfillmentUnits.id, fulfillmentUnitId)),
    })
    if (!unit) return fail(c, 'NOT_FOUND', 'Fulfillment unit not found.', 404)

    const [assignments, roleMappings, rules, booking] = await Promise.all([
      db.query.fulfillmentAssignments.findMany({
        where: and(eq(fulfillmentAssignments.bizId, bizId), eq(fulfillmentAssignments.fulfillmentUnitId, fulfillmentUnitId)),
      }),
      db.query.compensationAssignmentRoles.findMany({
        where: eq(compensationAssignmentRoles.bizId, bizId),
      }),
      db.query.compensationPlanRules.findMany({
        where: and(eq(compensationPlanRules.bizId, bizId), eq(compensationPlanRules.compensationPlanVersionId, parsed.data.compensationPlanVersionId), eq(compensationPlanRules.isEnabled, true)),
        orderBy: [asc(compensationPlanRules.priority)],
      }),
      unit.bookingOrderId
        ? db.query.bookingOrders.findFirst({
            where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, unit.bookingOrderId)),
          })
        : Promise.resolve(null),
    ])

    const roleByAssignmentId = new Map(roleMappings.map((row) => [row.fulfillmentAssignmentId, row.roleTemplateId]))
    const ledgerRows: Array<typeof compensationLedgerEntries.$inferInsert> = []

    for (const assignment of assignments) {
      const roleTemplateId = roleByAssignmentId.get(assignment.id) ?? null
      const assignmentMinutes =
        assignment.startsAt && assignment.endsAt
          ? Math.max(1, Math.round((assignment.endsAt.getTime() - assignment.startsAt.getTime()) / (1000 * 60)))
          : 60

      const rule =
        rules.find((candidate) => {
          if (candidate.roleTemplateId && candidate.roleTemplateId !== roleTemplateId) return false
          switch (candidate.selectorType) {
            case 'any':
              return true
            case 'resource':
              return candidate.resourceId === assignment.resourceId
            case 'resource_type':
              return true
            default:
              return false
          }
        }) ?? null

      if (!rule) continue

      const rawAmountMinor = calculateRuleAmount(rule, assignmentMinutes, booking ?? null)
      const amountMinor = clampAmount(rawAmountMinor, rule.minimumPayoutMinor, rule.maximumPayoutMinor)
      if (!amountMinor) continue

      ledgerRows.push({
        bizId,
        payeeResourceId: assignment.resourceId,
        roleTemplateId,
        compensationPlanVersionId: parsed.data.compensationPlanVersionId,
        compensationPlanRuleId: rule.id,
        bookingOrderId: unit.bookingOrderId,
        fulfillmentUnitId: unit.id,
        fulfillmentAssignmentId: assignment.id,
        entryType: 'accrual',
        amountMinor,
        currency: parsed.data.currency,
        occurredAt: new Date(),
        effectiveAt: new Date(),
        description: `Auto compensation for ${assignment.roleLabel ?? 'assignment'}`,
        idempotencyKey: `${unit.id}:${assignment.id}:${parsed.data.compensationPlanVersionId}`,
        metadata: {
          sourceRoute: 'compensation.resolve.fulfillment-unit',
          assignmentMinutes,
          calculationMode: rule.calculationMode,
        },
      })
    }

    if (ledgerRows.length === 0) {
      return fail(c, 'NO_MATCHING_RULES', 'No matching compensation rules were found for this fulfillment unit.', 409)
    }

    const inserted = await db
      .insert(compensationLedgerEntries)
      .values(ledgerRows)
      .onConflictDoNothing({ target: [compensationLedgerEntries.bizId, compensationLedgerEntries.idempotencyKey] })
      .returning()

    return ok(c, inserted, 201)
  },
)

compensationRoutes.get(
  '/bizes/:bizId/compensation-ledger-entries',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const fulfillmentUnitId = c.req.query('fulfillmentUnitId')
    const bookingOrderId = c.req.query('bookingOrderId')

    const rows = await db.query.compensationLedgerEntries.findMany({
      where: and(
        eq(compensationLedgerEntries.bizId, bizId),
        fulfillmentUnitId ? eq(compensationLedgerEntries.fulfillmentUnitId, fulfillmentUnitId) : undefined,
        bookingOrderId ? eq(compensationLedgerEntries.bookingOrderId, bookingOrderId) : undefined,
      ),
      orderBy: [asc(compensationLedgerEntries.occurredAt)],
    })

    return ok(c, rows)
  },
)
