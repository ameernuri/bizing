/**
 * Inventory procurement + replenishment routes.
 *
 * ELI5:
 * This route family gives one API surface for:
 * - supplier lifecycle,
 * - replenishment planning runs and suggestion decisions,
 * - procurement order lifecycle.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  supplyPartners,
  inventoryReplenishmentRuns,
  inventoryReplenishmentSuggestions,
  inventoryProcurementOrders,
} = dbPackage

const supplyPartnerBodySchema = z.object({
  partnerType: z.enum([
    'manufacturer',
    'supplier',
    'distributor',
    'dropship_partner',
    'third_party_logistics',
    'marketplace_seller',
    'internal',
  ]),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  legalName: z.string().max(260).optional().nullable(),
  defaultLeadTimeDays: z.number().int().min(0).default(0),
  orderingPolicy: z.record(z.unknown()).optional(),
  contactSnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const supplyPartnerPatchSchema = supplyPartnerBodySchema.partial()

const replenishmentRunBodySchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).default('pending'),
  triggerType: z.string().min(1).max(60).default('manual'),
  triggeredByUserId: z.string().optional().nullable(),
  windowStartsAt: z.string().datetime(),
  windowEndsAt: z.string().datetime(),
  startedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  suggestionCount: z.number().int().min(0).default(0),
  acceptedCount: z.number().int().min(0).default(0),
  draftOrderCount: z.number().int().min(0).default(0),
  summary: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const replenishmentRunPatchSchema = replenishmentRunBodySchema.partial()

const suggestionDecisionBodySchema = z.object({
  status: z.enum(['accepted', 'rejected', 'ordered', 'cancelled']),
  quantityAccepted: z.number().int().min(0).optional().nullable(),
  inventoryProcurementOrderId: z.string().optional().nullable(),
  rationale: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const procurementOrderBodySchema = z.object({
  supplyPartnerId: z.string().min(1),
  status: z
    .enum([
      'draft',
      'submitted',
      'acknowledged',
      'partially_received',
      'received',
      'cancelled',
      'closed',
    ])
    .default('draft'),
  orderNumber: z.string().min(1).max(160),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  inventoryReplenishmentRunId: z.string().optional().nullable(),
  orderedTotalMinor: z.number().int().min(0).default(0),
  receivedTotalMinor: z.number().int().min(0).default(0),
  invoicedTotalMinor: z.number().int().min(0).default(0),
  orderedAt: z.string().datetime().optional().nullable(),
  submittedAt: z.string().datetime().optional().nullable(),
  acknowledgedAt: z.string().datetime().optional().nullable(),
  expectedByAt: z.string().datetime().optional().nullable(),
  closedAt: z.string().datetime().optional().nullable(),
  cancelledAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
const procurementOrderPatchSchema = procurementOrderBodySchema.partial()

async function createInventoryRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'inventory' },
  })
  if (!delegated.ok) {
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  return delegated.row as T
}

async function updateInventoryRow<T extends Record<string, unknown>>(input: {
  c: Parameters<typeof fail>[0]
  bizId: string
  tableKey: string
  subjectType: string
  id: string
  patch: Record<string, unknown>
  notFoundMessage: string
}) {
  const delegated = await executeCrudRouteAction({
    c: input.c,
    bizId: input.bizId,
    tableKey: input.tableKey,
    operation: 'update',
    id: input.id,
    subjectType: input.subjectType,
    subjectId: input.id,
    patch: input.patch,
    metadata: { routeFamily: 'inventory' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') {
      return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    }
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

export const inventoryRoutes = new Hono()

inventoryRoutes.get(
  '/bizes/:bizId/supply-partners',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const status = c.req.query('status')
    const partnerType = c.req.query('partnerType')
    const rows = await db.query.supplyPartners.findMany({
      where: and(
        eq(supplyPartners.bizId, bizId),
        status ? eq(supplyPartners.status, status as any) : undefined,
        partnerType ? eq(supplyPartners.partnerType, partnerType as any) : undefined,
      ),
      orderBy: [asc(supplyPartners.name)],
    })
    return ok(c, rows)
  },
)

inventoryRoutes.post(
  '/bizes/:bizId/supply-partners',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = supplyPartnerBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const created = await createInventoryRow<typeof supplyPartners.$inferSelect>({
      c,
      bizId,
      tableKey: 'supplyPartners',
      subjectType: 'supply_partner',
      displayName: parsed.data.name,
      data: {
        bizId,
        partnerType: parsed.data.partnerType,
        status: parsed.data.status,
        name: sanitizePlainText(parsed.data.name),
        slug: sanitizePlainText(parsed.data.slug),
        legalName: parsed.data.legalName ? sanitizePlainText(parsed.data.legalName) : null,
        defaultLeadTimeDays: parsed.data.defaultLeadTimeDays,
        orderingPolicy: sanitizeUnknown(parsed.data.orderingPolicy ?? {}),
        contactSnapshot: sanitizeUnknown(parsed.data.contactSnapshot ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

inventoryRoutes.patch(
  '/bizes/:bizId/supply-partners/:supplyPartnerId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, supplyPartnerId } = c.req.param()
    const parsed = supplyPartnerPatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const patch = {
      ...(parsed.data.partnerType !== undefined ? { partnerType: parsed.data.partnerType } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.name !== undefined ? { name: sanitizePlainText(parsed.data.name) } : {}),
      ...(parsed.data.slug !== undefined ? { slug: sanitizePlainText(parsed.data.slug) } : {}),
      ...(parsed.data.legalName !== undefined
        ? { legalName: parsed.data.legalName ? sanitizePlainText(parsed.data.legalName) : null }
        : {}),
      ...(parsed.data.defaultLeadTimeDays !== undefined
        ? { defaultLeadTimeDays: parsed.data.defaultLeadTimeDays }
        : {}),
      ...(parsed.data.orderingPolicy !== undefined
        ? { orderingPolicy: sanitizeUnknown(parsed.data.orderingPolicy ?? {}) }
        : {}),
      ...(parsed.data.contactSnapshot !== undefined
        ? { contactSnapshot: sanitizeUnknown(parsed.data.contactSnapshot ?? {}) }
        : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    } as Record<string, unknown>
    const updated = await updateInventoryRow<typeof supplyPartners.$inferSelect>({
      c,
      bizId,
      tableKey: 'supplyPartners',
      subjectType: 'supply_partner',
      id: supplyPartnerId,
      patch,
      notFoundMessage: 'Supply partner not found.',
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

inventoryRoutes.get(
  '/bizes/:bizId/inventory-replenishment-runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const status = c.req.query('status')
    const rows = await db.query.inventoryReplenishmentRuns.findMany({
      where: and(
        eq(inventoryReplenishmentRuns.bizId, bizId),
        status ? eq(inventoryReplenishmentRuns.status, status as any) : undefined,
      ),
      orderBy: [desc(inventoryReplenishmentRuns.windowStartsAt)],
    })
    return ok(c, rows)
  },
)

inventoryRoutes.post(
  '/bizes/:bizId/inventory-replenishment-runs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = replenishmentRunBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const created = await createInventoryRow<typeof inventoryReplenishmentRuns.$inferSelect>({
      c,
      bizId,
      tableKey: 'inventoryReplenishmentRuns',
      subjectType: 'inventory_replenishment_run',
      data: {
        bizId,
        status: parsed.data.status,
        triggerType: sanitizePlainText(parsed.data.triggerType),
        triggeredByUserId: parsed.data.triggeredByUserId ?? null,
        windowStartsAt: new Date(parsed.data.windowStartsAt),
        windowEndsAt: new Date(parsed.data.windowEndsAt),
        startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
        completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
        suggestionCount: parsed.data.suggestionCount,
        acceptedCount: parsed.data.acceptedCount,
        draftOrderCount: parsed.data.draftOrderCount,
        summary: sanitizeUnknown(parsed.data.summary ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

inventoryRoutes.patch(
  '/bizes/:bizId/inventory-replenishment-runs/:runId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, runId } = c.req.param()
    const parsed = replenishmentRunPatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const patch = {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.triggerType !== undefined ? { triggerType: sanitizePlainText(parsed.data.triggerType) } : {}),
      ...(parsed.data.triggeredByUserId !== undefined ? { triggeredByUserId: parsed.data.triggeredByUserId ?? null } : {}),
      ...(parsed.data.windowStartsAt !== undefined ? { windowStartsAt: new Date(parsed.data.windowStartsAt) } : {}),
      ...(parsed.data.windowEndsAt !== undefined ? { windowEndsAt: new Date(parsed.data.windowEndsAt) } : {}),
      ...(parsed.data.startedAt !== undefined ? { startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null } : {}),
      ...(parsed.data.completedAt !== undefined
        ? { completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null }
        : {}),
      ...(parsed.data.suggestionCount !== undefined ? { suggestionCount: parsed.data.suggestionCount } : {}),
      ...(parsed.data.acceptedCount !== undefined ? { acceptedCount: parsed.data.acceptedCount } : {}),
      ...(parsed.data.draftOrderCount !== undefined ? { draftOrderCount: parsed.data.draftOrderCount } : {}),
      ...(parsed.data.summary !== undefined ? { summary: sanitizeUnknown(parsed.data.summary ?? {}) } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    } as Record<string, unknown>
    const updated = await updateInventoryRow<typeof inventoryReplenishmentRuns.$inferSelect>({
      c,
      bizId,
      tableKey: 'inventoryReplenishmentRuns',
      subjectType: 'inventory_replenishment_run',
      id: runId,
      patch,
      notFoundMessage: 'Replenishment run not found.',
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

inventoryRoutes.get(
  '/bizes/:bizId/inventory-replenishment-suggestions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const runId = c.req.query('inventoryReplenishmentRunId')
    const status = c.req.query('status')
    const rows = await db.query.inventoryReplenishmentSuggestions.findMany({
      where: and(
        eq(inventoryReplenishmentSuggestions.bizId, bizId),
        runId
          ? eq(inventoryReplenishmentSuggestions.inventoryReplenishmentRunId, runId)
          : undefined,
        status ? eq(inventoryReplenishmentSuggestions.status, status as any) : undefined,
      ),
      orderBy: [desc(inventoryReplenishmentSuggestions.priorityScore), desc(inventoryReplenishmentSuggestions.decidedAt)],
    })
    return ok(c, rows)
  },
)

inventoryRoutes.patch(
  '/bizes/:bizId/inventory-replenishment-suggestions/:suggestionId/decision',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, suggestionId } = c.req.param()
    const parsed = suggestionDecisionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.inventoryReplenishmentSuggestions.findFirst({
      where: and(
        eq(inventoryReplenishmentSuggestions.bizId, bizId),
        eq(inventoryReplenishmentSuggestions.id, suggestionId),
      ),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Replenishment suggestion not found.', 404)

    const user = getCurrentUser(c)
    const quantityAccepted =
      parsed.data.quantityAccepted === undefined
        ? existing.quantityAccepted
        : parsed.data.quantityAccepted
    if (
      quantityAccepted !== null &&
      quantityAccepted !== undefined &&
      quantityAccepted > existing.quantitySuggested
    ) {
      return fail(
        c,
        'VALIDATION_ERROR',
        'Accepted quantity cannot exceed suggested quantity.',
        400,
      )
    }
    const updated = await updateInventoryRow<typeof inventoryReplenishmentSuggestions.$inferSelect>({
      c,
      bizId,
      tableKey: 'inventoryReplenishmentSuggestions',
      subjectType: 'inventory_replenishment_suggestion',
      id: suggestionId,
      patch: {
        status: parsed.data.status,
        quantityAccepted: quantityAccepted ?? null,
        inventoryProcurementOrderId: parsed.data.inventoryProcurementOrderId ?? existing.inventoryProcurementOrderId ?? null,
        decidedAt: new Date(),
        decidedByUserId: user?.id ?? null,
        rationale: sanitizeUnknown(parsed.data.rationale ?? existing.rationale ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? existing.metadata ?? {}),
      },
      notFoundMessage: 'Replenishment suggestion not found.',
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

inventoryRoutes.get(
  '/bizes/:bizId/inventory-procurement-orders',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const status = c.req.query('status')
    const rows = await db.query.inventoryProcurementOrders.findMany({
      where: and(
        eq(inventoryProcurementOrders.bizId, bizId),
        status ? eq(inventoryProcurementOrders.status, status as any) : undefined,
      ),
      orderBy: [desc(inventoryProcurementOrders.orderedAt), desc(inventoryProcurementOrders.submittedAt)],
    })
    return ok(c, rows)
  },
)

inventoryRoutes.post(
  '/bizes/:bizId/inventory-procurement-orders',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = procurementOrderBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const created = await createInventoryRow<typeof inventoryProcurementOrders.$inferSelect>({
      c,
      bizId,
      tableKey: 'inventoryProcurementOrders',
      subjectType: 'inventory_procurement_order',
      displayName: parsed.data.orderNumber,
      data: {
        bizId,
        supplyPartnerId: parsed.data.supplyPartnerId,
        status: parsed.data.status,
        orderNumber: sanitizePlainText(parsed.data.orderNumber),
        currency: parsed.data.currency,
        inventoryReplenishmentRunId: parsed.data.inventoryReplenishmentRunId ?? null,
        orderedTotalMinor: parsed.data.orderedTotalMinor,
        receivedTotalMinor: parsed.data.receivedTotalMinor,
        invoicedTotalMinor: parsed.data.invoicedTotalMinor,
        orderedAt: parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : null,
        submittedAt: parsed.data.submittedAt ? new Date(parsed.data.submittedAt) : null,
        acknowledgedAt: parsed.data.acknowledgedAt ? new Date(parsed.data.acknowledgedAt) : null,
        expectedByAt: parsed.data.expectedByAt ? new Date(parsed.data.expectedByAt) : null,
        closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
        cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null,
        notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (created instanceof Response) return created
    return ok(c, created, 201)
  },
)

inventoryRoutes.patch(
  '/bizes/:bizId/inventory-procurement-orders/:orderId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, orderId } = c.req.param()
    const parsed = procurementOrderPatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }
    const patch = {
      ...(parsed.data.supplyPartnerId !== undefined ? { supplyPartnerId: parsed.data.supplyPartnerId } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.orderNumber !== undefined ? { orderNumber: sanitizePlainText(parsed.data.orderNumber) } : {}),
      ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
      ...(parsed.data.inventoryReplenishmentRunId !== undefined
        ? { inventoryReplenishmentRunId: parsed.data.inventoryReplenishmentRunId ?? null }
        : {}),
      ...(parsed.data.orderedTotalMinor !== undefined ? { orderedTotalMinor: parsed.data.orderedTotalMinor } : {}),
      ...(parsed.data.receivedTotalMinor !== undefined ? { receivedTotalMinor: parsed.data.receivedTotalMinor } : {}),
      ...(parsed.data.invoicedTotalMinor !== undefined ? { invoicedTotalMinor: parsed.data.invoicedTotalMinor } : {}),
      ...(parsed.data.orderedAt !== undefined ? { orderedAt: parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : null } : {}),
      ...(parsed.data.submittedAt !== undefined ? { submittedAt: parsed.data.submittedAt ? new Date(parsed.data.submittedAt) : null } : {}),
      ...(parsed.data.acknowledgedAt !== undefined
        ? { acknowledgedAt: parsed.data.acknowledgedAt ? new Date(parsed.data.acknowledgedAt) : null }
        : {}),
      ...(parsed.data.expectedByAt !== undefined ? { expectedByAt: parsed.data.expectedByAt ? new Date(parsed.data.expectedByAt) : null } : {}),
      ...(parsed.data.closedAt !== undefined ? { closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null } : {}),
      ...(parsed.data.cancelledAt !== undefined
        ? { cancelledAt: parsed.data.cancelledAt ? new Date(parsed.data.cancelledAt) : null }
        : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    } as Record<string, unknown>
    const updated = await updateInventoryRow<typeof inventoryProcurementOrders.$inferSelect>({
      c,
      bizId,
      tableKey: 'inventoryProcurementOrders',
      subjectType: 'inventory_procurement_order',
      id: orderId,
      patch,
      notFoundMessage: 'Procurement order not found.',
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)
