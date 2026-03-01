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
import { and, asc, eq, inArray } from 'drizzle-orm'
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
  compensationPayRuns,
  compensationPayRunItems,
  compensationPayRunItemEntries,
  fulfillmentUnits,
  fulfillmentAssignments,
  bookingOrders,
  resources,
  workTimeSegments,
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

const createLedgerEntryBodySchema = z.object({
  payeeResourceId: z.string().min(1),
  roleTemplateId: z.string().optional(),
  compensationPlanVersionId: z.string().optional(),
  compensationPlanRuleId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  fulfillmentUnitId: z.string().optional(),
  fulfillmentAssignmentId: z.string().optional(),
  staffingAssignmentId: z.string().optional(),
  workTimeSegmentId: z.string().optional(),
  entryType: z.enum(['accrual', 'adjustment', 'reversal', 'hold', 'release', 'payout', 'correction']).default('accrual'),
  amountMinor: z.number().int(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).default('USD'),
  occurredAt: z.string().datetime().optional(),
  effectiveAt: z.string().datetime().optional(),
  description: z.string().max(400).optional(),
  idempotencyKey: z.string().max(140).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const reverseLedgerEntryBodySchema = z.object({
  reason: z.string().max(300).default('manual_reversal'),
  occurredAt: z.string().datetime().optional(),
  effectiveAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createPayRunBodySchema = z.object({
  name: z.string().min(1).max(220),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).default('USD'),
  periodStartAt: z.string().datetime(),
  periodEndAt: z.string().datetime(),
  scheduledPayAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const buildPayRunBodySchema = z.object({
  payeeResourceIds: z.array(z.string()).optional(),
  finalize: z.boolean().default(false),
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

compensationRoutes.post(
  '/bizes/:bizId/compensation-ledger-entries',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createLedgerEntryBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [row] = await db.insert(compensationLedgerEntries).values({
      bizId,
      payeeResourceId: parsed.data.payeeResourceId,
      roleTemplateId: parsed.data.roleTemplateId ?? null,
      compensationPlanVersionId: parsed.data.compensationPlanVersionId ?? null,
      compensationPlanRuleId: parsed.data.compensationPlanRuleId ?? null,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      fulfillmentUnitId: parsed.data.fulfillmentUnitId ?? null,
      fulfillmentAssignmentId: parsed.data.fulfillmentAssignmentId ?? null,
      staffingAssignmentId: parsed.data.staffingAssignmentId ?? null,
      workTimeSegmentId: parsed.data.workTimeSegmentId ?? null,
      entryType: parsed.data.entryType,
      amountMinor: parsed.data.amountMinor,
      currency: parsed.data.currency,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      effectiveAt: parsed.data.effectiveAt ? new Date(parsed.data.effectiveAt) : new Date(),
      description: parsed.data.description ?? null,
      idempotencyKey: parsed.data.idempotencyKey ?? null,
      metadata: parsed.data.metadata ?? {},
    }).returning()

    return ok(c, row, 201)
  },
)

compensationRoutes.post(
  '/bizes/:bizId/compensation-ledger-entries/:entryId/reverse',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, entryId } = c.req.param()
    const parsed = reverseLedgerEntryBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const entry = await db.query.compensationLedgerEntries.findFirst({
      where: and(eq(compensationLedgerEntries.bizId, bizId), eq(compensationLedgerEntries.id, entryId)),
    })
    if (!entry) return fail(c, 'NOT_FOUND', 'Compensation ledger entry not found.', 404)

    const [reversal] = await db.insert(compensationLedgerEntries).values({
      bizId,
      payeeResourceId: entry.payeeResourceId,
      roleTemplateId: entry.roleTemplateId,
      compensationPlanVersionId: entry.compensationPlanVersionId,
      compensationPlanRuleId: entry.compensationPlanRuleId,
      bookingOrderId: entry.bookingOrderId,
      fulfillmentUnitId: entry.fulfillmentUnitId,
      fulfillmentAssignmentId: entry.fulfillmentAssignmentId,
      staffingAssignmentId: entry.staffingAssignmentId,
      workTimeSegmentId: entry.workTimeSegmentId,
      entryType: 'reversal',
      amountMinor: -entry.amountMinor,
      currency: entry.currency,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      effectiveAt: parsed.data.effectiveAt ? new Date(parsed.data.effectiveAt) : new Date(),
      description: `Reversal of ${entry.id}: ${parsed.data.reason}`,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        reversedEntryId: entry.id,
        reversalReason: parsed.data.reason,
      },
    }).returning()

    return ok(c, reversal, 201)
  },
)

compensationRoutes.get(
  '/bizes/:bizId/compensation-pay-runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.compensationPayRuns.findMany({
      where: eq(compensationPayRuns.bizId, bizId),
      orderBy: [asc(compensationPayRuns.periodStartAt)],
    })
    return ok(c, rows)
  },
)

compensationRoutes.post(
  '/bizes/:bizId/compensation-pay-runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createPayRunBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const [row] = await db.insert(compensationPayRuns).values({
      bizId,
      name: parsed.data.name,
      status: 'draft',
      currency: parsed.data.currency,
      periodStartAt: new Date(parsed.data.periodStartAt),
      periodEndAt: new Date(parsed.data.periodEndAt),
      scheduledPayAt: parsed.data.scheduledPayAt ? new Date(parsed.data.scheduledPayAt) : null,
      notes: parsed.data.notes ?? null,
      metadata: parsed.data.metadata ?? {},
    }).returning()
    return ok(c, row, 201)
  },
)

compensationRoutes.post(
  '/bizes/:bizId/compensation-pay-runs/:payRunId/build',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.manage', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, payRunId } = c.req.param()
    const parsed = buildPayRunBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const run = await db.query.compensationPayRuns.findFirst({
      where: and(eq(compensationPayRuns.bizId, bizId), eq(compensationPayRuns.id, payRunId)),
    })
    if (!run) return fail(c, 'NOT_FOUND', 'Compensation pay run not found.', 404)

    const ledgerRows = await db.query.compensationLedgerEntries.findMany({
      where: and(
        eq(compensationLedgerEntries.bizId, bizId),
        parsed.data.payeeResourceIds && parsed.data.payeeResourceIds.length > 0
          ? inArray(compensationLedgerEntries.payeeResourceId, parsed.data.payeeResourceIds)
          : undefined,
      ),
      orderBy: [asc(compensationLedgerEntries.occurredAt)],
    })
    const inWindow = ledgerRows.filter((row) => row.occurredAt >= run.periodStartAt && row.occurredAt < run.periodEndAt)
    const byPayee = new Map<string, typeof inWindow>()
    for (const row of inWindow) {
      const list = byPayee.get(row.payeeResourceId) ?? []
      list.push(row)
      byPayee.set(row.payeeResourceId, list)
    }

    const items = []
    for (const [payeeResourceId, rows] of byPayee.entries()) {
      const accrualMinor = rows.filter((r) => r.entryType === 'accrual').reduce((sum, r) => sum + r.amountMinor, 0)
      const adjustmentMinor = rows.filter((r) => ['adjustment', 'reversal'].includes(r.entryType)).reduce((sum, r) => sum + r.amountMinor, 0)
      const deductionMinor = rows.filter((r) => r.entryType === 'hold').reduce((sum, r) => sum + Math.abs(r.amountMinor), 0)
      const netMinor = accrualMinor + adjustmentMinor - deductionMinor
      const [item] = await db.insert(compensationPayRunItems).values({
        bizId,
        compensationPayRunId: payRunId,
        payeeResourceId,
        status: parsed.data.finalize ? 'approved' : 'pending',
        currency: run.currency,
        accrualMinor,
        adjustmentMinor,
        deductionMinor,
        netMinor,
        entryCount: rows.length,
      }).onConflictDoUpdate({
        target: [compensationPayRunItems.compensationPayRunId, compensationPayRunItems.payeeResourceId],
        set: { accrualMinor, adjustmentMinor, deductionMinor, netMinor, entryCount: rows.length, status: parsed.data.finalize ? 'approved' : 'pending' },
      }).returning()
      items.push(item)
      for (const row of rows) {
        await db.insert(compensationPayRunItemEntries).values({
          bizId,
          compensationPayRunItemId: item.id,
          compensationLedgerEntryId: row.id,
          includedAmountMinor: row.amountMinor,
        }).onConflictDoNothing()
      }
    }

    if (parsed.data.finalize) {
      await db.update(compensationPayRuns).set({ status: 'approved', finalizedAt: new Date(), approvedAt: new Date() }).where(and(eq(compensationPayRuns.bizId, bizId), eq(compensationPayRuns.id, payRunId)))
    }

    return ok(c, { payRunId, itemCount: items.length, items }, 201)
  },
)

compensationRoutes.get(
  '/bizes/:bizId/compensation-pay-runs/:payRunId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, payRunId } = c.req.param()
    const run = await db.query.compensationPayRuns.findFirst({
      where: and(eq(compensationPayRuns.bizId, bizId), eq(compensationPayRuns.id, payRunId)),
    })
    if (!run) return fail(c, 'NOT_FOUND', 'Compensation pay run not found.', 404)
    const items = await db.query.compensationPayRunItems.findMany({
      where: and(eq(compensationPayRunItems.bizId, bizId), eq(compensationPayRunItems.compensationPayRunId, payRunId)),
      orderBy: [asc(compensationPayRunItems.payeeResourceId)],
    })
    const itemIds = items.map((item) => item.id)
    const itemEntries = itemIds.length === 0 ? [] : await db.query.compensationPayRunItemEntries.findMany({
      where: and(eq(compensationPayRunItemEntries.bizId, bizId), inArray(compensationPayRunItemEntries.compensationPayRunItemId, itemIds)),
      orderBy: [asc(compensationPayRunItemEntries.compensationPayRunItemId)],
    })
    return ok(c, { run, items, itemEntries })
  },
)

compensationRoutes.get(
  '/bizes/:bizId/payroll-exports/preview',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('payments.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const userId = c.req.query('userId')
    const workRunId = c.req.query('workRunId')

    const payeeResourceIds = userId
      ? (await db.query.resources.findMany({
          where: and(eq(resources.bizId, bizId), eq(resources.hostUserId, userId)),
          columns: { id: true },
        })).map((row) => row.id)
      : []

    const timeSegments = await db.query.workTimeSegments.findMany({
      where: and(
        eq(workTimeSegments.bizId, bizId),
        userId ? eq(workTimeSegments.userId, userId) : undefined,
        workRunId ? eq(workTimeSegments.workRunId, workRunId) : undefined,
      ),
      orderBy: [asc(workTimeSegments.clockInAt)],
    })

    const workTimeSegmentIds = timeSegments.map((row) => row.id)

    /**
     * ELI5:
     * Payroll/export integrations do not want to reverse-engineer the database.
     * They want one clean "what should I export for payroll?" answer.
     *
     * This preview route gives the API a canonical, read-only handoff surface
     * using the same payroll-grade time segments and compensation ledger rows
     * the rest of the platform already uses.
     */
    const ledgerEntries =
      userId && payeeResourceIds.length === 0
        ? []
        : await db.query.compensationLedgerEntries.findMany({
            where: and(
              eq(compensationLedgerEntries.bizId, bizId),
              payeeResourceIds.length > 0 ? inArray(compensationLedgerEntries.payeeResourceId, payeeResourceIds) : undefined,
              workTimeSegmentIds.length > 0 ? inArray(compensationLedgerEntries.workTimeSegmentId, workTimeSegmentIds) : undefined,
            ),
            orderBy: [asc(compensationLedgerEntries.occurredAt)],
          })

    const totalWorkedMinutes = timeSegments.reduce((sum, row) => {
      if (!row.clockOutAt) return sum
      const durationMinutes = Math.max(
        0,
        Math.round((row.clockOutAt.getTime() - row.clockInAt.getTime()) / (1000 * 60)),
      )
      return sum + Math.max(0, durationMinutes - (row.breakMinutes ?? 0))
    }, 0)

    const overtimeMinutes = timeSegments.reduce((sum, row) => {
      if (row.segmentType !== 'overtime' || !row.clockOutAt) return sum
      const durationMinutes = Math.max(
        0,
        Math.round((row.clockOutAt.getTime() - row.clockInAt.getTime()) / (1000 * 60)),
      )
      return sum + Math.max(0, durationMinutes - (row.breakMinutes ?? 0))
    }, 0)

    const totalCompensationMinor = ledgerEntries.reduce((sum, row) => {
      return sum + (row.amountMinor ?? 0)
    }, 0)

    return ok(c, {
      filters: { bizId, userId: userId ?? null, workRunId: workRunId ?? null },
      summary: {
        totalSegments: timeSegments.length,
        totalWorkedMinutes,
        overtimeMinutes,
        totalLedgerEntries: ledgerEntries.length,
        totalCompensationMinor,
        currency: ledgerEntries[0]?.currency ?? 'USD',
      },
      timeSegments,
      ledgerEntries,
    })
  },
)
