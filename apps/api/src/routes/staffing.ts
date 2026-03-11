/**
 * Staffing and substitution routes.
 *
 * ELI5:
 * The schema already had a strong staffing backbone:
 * - capability templates describe what a person/resource can do,
 * - capability assignments attach those skills/certifications to resources,
 * - staffing demands describe "we need someone here at this time",
 * - staffing responses track accepts/declines/claims,
 * - staffing assignments track the final posted person.
 *
 * This route file turns that backbone into API proof surfaces so sagas, agents,
 * and eventually product UI can validate internal staffing and replacement
 * workflows without writing directly to the database.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'
import { sanitizeUnknown } from '../lib/sanitize.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { syncCoverageLaneAssignmentAvailability } from '../services/coverage-lanes.js'

const {
  db,
  resources,
  bookingOrders,
  outboundMessages,
  outboundMessageEvents,
  resourceCapabilityTemplates,
  resourceCapabilityAssignments,
  staffingDemands,
  staffingDemandRequirements,
  staffingDemandSelectors,
  staffingResponses,
  staffingAssignments,
  coverageLanes,
  coverageLaneMemberships,
} = dbPackage

async function createStaffingRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: string,
  data: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'create',
    data,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details)
  return result.row
}

async function updateStaffingRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: string,
  id: string,
  patch: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
    tableKey,
    operation: 'update',
    id,
    patch,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId ?? id,
    displayName: options?.displayName,
    metadata: options?.metadata,
  })
  if (!result.ok) return fail(c, result.code, result.message, result.httpStatus, result.details)
  return result.row
}

function cleanMetadata(value: Record<string, unknown> | undefined) {
  return sanitizeUnknown(value ?? {}) as Record<string, unknown>
}

const capabilityTemplateBodySchema = z.object({
  locationId: z.string().optional(),
  scope: z.enum(['host', 'company_host', 'asset', 'venue']),
  name: z.string().min(1).max(180),
  slug: z.string().min(1).max(140),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const capabilityAssignmentBodySchema = z.object({
  resourceId: z.string().min(1),
  capabilityTemplateId: z.string().min(1),
  proficiencyScore: z.number().int().min(0).max(100).optional(),
  isPrimary: z.boolean().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const selectorBodySchema = z
  .object({
    selectorType: z.enum(['any', 'resource', 'resource_type', 'capability_template', 'location', 'custom_subject']),
    isIncluded: z.boolean().optional(),
    resourceId: z.string().optional(),
    resourceType: z.enum(['host', 'company_host', 'asset', 'venue']).optional(),
    capabilityTemplateId: z.string().optional(),
    locationId: z.string().optional(),
    subjectType: z.string().optional(),
    subjectId: z.string().optional(),
    sortOrder: z.number().int().min(0).optional(),
    description: z.string().max(700).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.selectorType === 'resource' && !value.resourceId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'resourceId is required for selectorType=resource' })
    }
    if (value.selectorType === 'resource_type' && !value.resourceType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'resourceType is required for selectorType=resource_type',
      })
    }
    if (value.selectorType === 'capability_template' && !value.capabilityTemplateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'capabilityTemplateId is required for selectorType=capability_template',
      })
    }
    if (value.selectorType === 'location' && !value.locationId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'locationId is required for selectorType=location' })
    }
    if (value.selectorType === 'custom_subject' && (!value.subjectType || !value.subjectId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'subjectType and subjectId are required for selectorType=custom_subject',
      })
    }
  })

const requirementBodySchema = z.object({
  name: z.string().min(1).max(180),
  slug: z.string().min(1).max(120),
  targetResourceType: z.enum(['host', 'company_host', 'asset', 'venue']),
  requirementMode: z.enum(['required', 'optional']).optional(),
  minQuantity: z.number().int().min(0).optional(),
  maxQuantity: z.number().int().min(0).optional().nullable(),
  selectorMatchMode: z.enum(['any', 'all']).optional(),
  allowSubstitution: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  description: z.string().max(700).optional(),
  metadata: z.record(z.unknown()).optional(),
  selectors: z.array(selectorBodySchema).default([]),
})

const staffingDemandBodySchema = z.object({
  staffingPoolId: z.string().optional(),
  coverageLaneId: z.string().optional(),
  demandType: z.enum(['replacement', 'open_shift', 'internal_task', 'on_call', 'overtime']).optional(),
  fillMode: z.enum(['direct_assign', 'fcfs_claim', 'invite_accept', 'auction', 'auto_match']).optional(),
  status: z.enum(['open', 'offered', 'claimed', 'assigned', 'filled', 'expired', 'cancelled']).optional(),
  title: z.string().min(1).max(220),
  description: z.string().max(1000).optional(),
  locationId: z.string().optional(),
  targetResourceType: z.enum(['host', 'company_host', 'asset', 'venue']).optional(),
  requiredCount: z.number().int().min(1).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  claimOpensAt: z.string().datetime().optional(),
  claimClosesAt: z.string().datetime().optional(),
  baseRateMinor: z.number().int().min(0).optional(),
  maxRateMinor: z.number().int().min(0).optional(),
  fulfillmentAssignmentId: z.string().optional(),
  fulfillmentUnitId: z.string().optional(),
  fromResourceId: z.string().optional(),
  assignedResourceId: z.string().optional(),
  sourceType: z.string().optional(),
  sourceRefId: z.string().optional(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  requirements: z.array(requirementBodySchema).default([]),
})

const dispatchDemandBodySchema = z.object({
  candidateResourceIds: z.array(z.string()).optional(),
  responseMode: z.enum(['invite', 'claim', 'bid']).default('invite'),
  channel: z.enum(['email', 'sms']).default('email'),
  notifyClient: z.boolean().default(false),
})

const updateResponseBodySchema = z.object({
  status: z.enum(['pending', 'accepted', 'declined', 'withdrawn', 'expired']),
  responseReason: z.string().max(600).optional(),
  respondedAt: z.string().datetime().optional(),
  proposedHourlyRateMinor: z.number().int().min(0).optional(),
  proposedTotalMinor: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createAssignmentBodySchema = z
  .object({
    staffingResponseId: z.string().optional(),
    resourceId: z.string().optional(),
    coverageLaneId: z.string().optional(),
    status: z.enum(['planned', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
    compensationRateMinor: z.number().int().min(0).optional(),
    metadata: z.record(z.unknown()).optional(),
    notifyClient: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (!value.staffingResponseId && !value.resourceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either staffingResponseId or resourceId is required.',
      })
    }
  })

async function createLifecycleMessage(c: Parameters<typeof executeCrudRouteAction>[0]['c'], input: {
  bizId: string
  recipientUserId?: string | null
  recipientRef: string
  channel: 'email' | 'sms'
  purpose: 'transactional' | 'operational'
  subject: string
  body: string
  eventType: string
  metadata?: Record<string, unknown>
}) {
  const message = await createStaffingRow(c, input.bizId, 'outboundMessages', {
      bizId: input.bizId,
      channel: input.channel,
      purpose: input.purpose,
      recipientUserId: input.recipientUserId ?? null,
      recipientRef: input.recipientRef,
      status: 'delivered',
      scheduledFor: new Date(),
      sentAt: new Date(),
      deliveredAt: new Date(),
      providerKey: `simulated_${input.channel}`,
      providerMessageRef: `${input.eventType}-${Date.now()}`,
      payload: {
        subject: input.subject,
        body: input.body,
      },
      metadata: {
        eventType: input.eventType,
        ...(input.metadata ?? {}),
      },
    }, {
    subjectType: 'outbound_message',
    displayName: input.subject,
  })
  if (message instanceof Response || !message) throw new Error('Failed to create outbound message.')
  const messageRow = message as Record<string, unknown>
  const messageId = messageRow.id
  if (typeof messageId !== 'string' || messageId.length === 0) {
    throw new Error('Outbound message id missing.')
  }

  for (const eventRow of [
    {
      bizId: input.bizId,
      outboundMessageId: messageId,
      eventType: 'queued',
      payload: { eventType: input.eventType },
    },
    {
      bizId: input.bizId,
      outboundMessageId: messageId,
      eventType: 'sent',
      payload: { channel: input.channel },
    },
    {
      bizId: input.bizId,
      outboundMessageId: messageId,
      eventType: 'delivered',
      payload: { recipientRef: input.recipientRef },
    },
  ]) {
    const event = await createStaffingRow(c, input.bizId, 'outboundMessageEvents', eventRow, {
      subjectType: 'outbound_message_event',
      displayName: eventRow.eventType,
    })
    if (event instanceof Response) throw new Error('Failed to create outbound message event.')
  }

  return messageRow
}

async function loadDemandGraph(bizId: string, demandId: string) {
  const demand = await db.query.staffingDemands.findFirst({
    where: and(eq(staffingDemands.bizId, bizId), eq(staffingDemands.id, demandId)),
  })
  if (!demand) return null

  const requirements = await db.query.staffingDemandRequirements.findMany({
    where: and(eq(staffingDemandRequirements.bizId, bizId), eq(staffingDemandRequirements.staffingDemandId, demandId)),
    orderBy: [asc(staffingDemandRequirements.sortOrder)],
  })
  const requirementIds = requirements.map((row) => row.id)
  const selectors =
    requirementIds.length === 0
      ? []
      : await db.query.staffingDemandSelectors.findMany({
          where: and(
            eq(staffingDemandSelectors.bizId, bizId),
            inArray(staffingDemandSelectors.staffingDemandRequirementId, requirementIds),
          ),
          orderBy: [asc(staffingDemandSelectors.sortOrder)],
        })

  return { demand, requirements, selectors }
}

type CandidateRow = {
  resourceId: string
  resourceName: string
  resourceType: string
  matchedRequirementIds: string[]
  matchedCapabilityTemplateIds: string[]
  assignmentCount: number
  lastAssignedAt: string | null
  fairnessScore: number
}

async function computeDemandCandidates(bizId: string, demandId: string): Promise<CandidateRow[]> {
  const graph = await loadDemandGraph(bizId, demandId)
  if (!graph) return []

  const demandTime = new Date(graph.demand.startsAt)
  const baseResourceRows = await db.query.resources.findMany({
    where: and(
      eq(resources.bizId, bizId),
      graph.demand.targetResourceType ? eq(resources.type, graph.demand.targetResourceType) : undefined,
    ),
  })
  let resourceRows = baseResourceRows

  if (graph.demand.coverageLaneId) {
    const laneMembershipRows = await db.query.coverageLaneMemberships.findMany({
      where: and(
        eq(coverageLaneMemberships.bizId, bizId),
        eq(coverageLaneMemberships.coverageLaneId, graph.demand.coverageLaneId),
        eq(coverageLaneMemberships.status, 'active'),
        eq(coverageLaneMemberships.isDispatchEligible, true),
      ),
    })

    const eligibleResourceIds = new Set(
      laneMembershipRows
        .filter((row) => {
          const startsOk = !row.effectiveFrom || row.effectiveFrom.getTime() <= demandTime.getTime()
          const endsOk = !row.effectiveTo || row.effectiveTo.getTime() >= demandTime.getTime()
          return startsOk && endsOk
        })
        .map((row) => row.resourceId),
    )
    resourceRows = resourceRows.filter((row) => eligibleResourceIds.has(row.id))
  }

  const resourceIds = resourceRows.map((row) => row.id)
  if (resourceIds.length === 0) return []

  const [capabilityRows, assignmentHistory] = await Promise.all([
    db.query.resourceCapabilityAssignments.findMany({
      where: and(eq(resourceCapabilityAssignments.bizId, bizId), inArray(resourceCapabilityAssignments.resourceId, resourceIds)),
    }),
    db.query.staffingAssignments.findMany({
      where: and(eq(staffingAssignments.bizId, bizId), inArray(staffingAssignments.resourceId, resourceIds)),
      orderBy: [desc(staffingAssignments.assignedAt)],
      limit: 500,
    }),
  ])

  const capabilityByResource = new Map<string, typeof capabilityRows>()
  for (const row of capabilityRows) {
    const validFromOk = !row.validFrom || row.validFrom.getTime() <= demandTime.getTime()
    const validToOk = !row.validTo || row.validTo.getTime() >= demandTime.getTime()
    if (!validFromOk || !validToOk) continue
    const list = capabilityByResource.get(row.resourceId) ?? []
    list.push(row)
    capabilityByResource.set(row.resourceId, list)
  }

  const assignmentStats = new Map<string, { count: number; lastAssignedAt: Date | null }>()
  for (const row of assignmentHistory) {
    const current = assignmentStats.get(row.resourceId) ?? { count: 0, lastAssignedAt: null }
    current.count += 1
    if (!current.lastAssignedAt || row.assignedAt.getTime() > current.lastAssignedAt.getTime()) {
      current.lastAssignedAt = row.assignedAt
    }
    assignmentStats.set(row.resourceId, current)
  }

  const selectorsByRequirement = new Map<string, typeof graph.selectors>()
  for (const selector of graph.selectors) {
    const list = selectorsByRequirement.get(selector.staffingDemandRequirementId) ?? []
    list.push(selector)
    selectorsByRequirement.set(selector.staffingDemandRequirementId, list)
  }

  const requiredRequirements = graph.requirements.filter((row) => row.requirementMode === 'required')
  const candidates: CandidateRow[] = []

  for (const resource of resourceRows) {
    const matchedRequirementIds: string[] = []
    const matchedCapabilityTemplateIds = new Set<string>()
    let failedRequired = false

    for (const requirement of graph.requirements) {
      if (resource.type !== requirement.targetResourceType) {
        if (requirement.requirementMode === 'required') failedRequired = true
        continue
      }

      const selectors = selectorsByRequirement.get(requirement.id) ?? []
      if (selectors.length === 0 || selectors.some((selector) => selector.selectorType === 'any')) {
        matchedRequirementIds.push(requirement.id)
        continue
      }

      const capabilityIds = new Set((capabilityByResource.get(resource.id) ?? []).map((row) => row.capabilityTemplateId))
      const matches = selectors.filter((selector) => {
        if (selector.selectorType === 'resource') return selector.resourceId === resource.id
        if (selector.selectorType === 'resource_type') return selector.resourceType === resource.type
        if (selector.selectorType === 'capability_template') return Boolean(selector.capabilityTemplateId && capabilityIds.has(selector.capabilityTemplateId))
        if (selector.selectorType === 'location') {
          return resource.metadata && (resource.metadata as Record<string, unknown>).locationId === selector.locationId
        }
        return false
      })

      const selectorMatched =
        requirement.selectorMatchMode === 'all' ? matches.length === selectors.length : matches.length > 0

      if (selectorMatched) {
        matchedRequirementIds.push(requirement.id)
        for (const match of matches) {
          if (match.capabilityTemplateId) matchedCapabilityTemplateIds.add(match.capabilityTemplateId)
        }
      } else if (requirement.requirementMode === 'required') {
        failedRequired = true
      }
    }

    if (failedRequired || matchedRequirementIds.length < requiredRequirements.length) continue

    const stats = assignmentStats.get(resource.id) ?? { count: 0, lastAssignedAt: null }
    const fairnessScore =
      stats.count === 0
        ? 1000
        : Math.max(
            1,
            Math.round((Date.now() - (stats.lastAssignedAt?.getTime() ?? Date.now())) / (1000 * 60 * 60)) - stats.count,
          )

    candidates.push({
      resourceId: resource.id,
      resourceName: resource.name,
      resourceType: resource.type,
      matchedRequirementIds,
      matchedCapabilityTemplateIds: Array.from(matchedCapabilityTemplateIds),
      assignmentCount: stats.count,
      lastAssignedAt: stats.lastAssignedAt?.toISOString() ?? null,
      fairnessScore,
    })
  }

  return candidates.sort((a, b) => {
    if (b.fairnessScore !== a.fairnessScore) return b.fairnessScore - a.fairnessScore
    if (a.assignmentCount !== b.assignmentCount) return a.assignmentCount - b.assignmentCount
    return a.resourceName.localeCompare(b.resourceName)
  })
}

export const staffingRoutes = new Hono()

staffingRoutes.get(
  '/bizes/:bizId/resource-capability-templates',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.resourceCapabilityTemplates.findMany({
      where: eq(resourceCapabilityTemplates.bizId, bizId),
      orderBy: [asc(resourceCapabilityTemplates.name)],
    })
    return ok(c, rows)
  },
)

staffingRoutes.post(
  '/bizes/:bizId/resource-capability-templates',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = capabilityTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const created = await createStaffingRow(c, bizId, 'resourceCapabilityTemplates', {
        bizId,
        locationId: parsed.data.locationId,
        scope: parsed.data.scope,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        isActive: parsed.data.isActive ?? true,
        metadata: cleanMetadata(parsed.data.metadata),
      }, {
      subjectType: 'resource_capability_template',
      displayName: parsed.data.name,
    })
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

staffingRoutes.get(
  '/bizes/:bizId/resource-capability-assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const resourceId = c.req.query('resourceId')
    const capabilityTemplateId = c.req.query('capabilityTemplateId')
    const rows = await db.query.resourceCapabilityAssignments.findMany({
      where: and(
        eq(resourceCapabilityAssignments.bizId, bizId),
        resourceId ? eq(resourceCapabilityAssignments.resourceId, resourceId) : undefined,
        capabilityTemplateId ? eq(resourceCapabilityAssignments.capabilityTemplateId, capabilityTemplateId) : undefined,
      ),
      orderBy: [desc(resourceCapabilityAssignments.isPrimary), asc(resourceCapabilityAssignments.id)],
    })
    return ok(c, rows)
  },
)

staffingRoutes.post(
  '/bizes/:bizId/resource-capability-assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = capabilityAssignmentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.resourceCapabilityAssignments.findFirst({
      where: and(
        eq(resourceCapabilityAssignments.bizId, bizId),
        eq(resourceCapabilityAssignments.resourceId, parsed.data.resourceId),
        eq(resourceCapabilityAssignments.capabilityTemplateId, parsed.data.capabilityTemplateId),
      ),
      orderBy: [desc(resourceCapabilityAssignments.isPrimary), asc(resourceCapabilityAssignments.id)],
    })
    if (existing) return ok(c, existing)

    const created = await createStaffingRow(c, bizId, 'resourceCapabilityAssignments', {
        bizId,
        resourceId: parsed.data.resourceId,
        capabilityTemplateId: parsed.data.capabilityTemplateId,
        proficiencyScore: parsed.data.proficiencyScore,
        isPrimary: parsed.data.isPrimary ?? false,
        validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
        validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : null,
        metadata: cleanMetadata(parsed.data.metadata),
      }, {
      subjectType: 'resource_capability_assignment',
      displayName: parsed.data.resourceId,
    })
    if (created instanceof Response) return created

    return ok(c, created, 201)
  },
)

staffingRoutes.get(
  '/bizes/:bizId/staffing-demands',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const status = c.req.query('status')
    const rows = await db.query.staffingDemands.findMany({
      where: and(eq(staffingDemands.bizId, bizId), status ? eq(staffingDemands.status, status as any) : undefined),
      orderBy: [desc(staffingDemands.startsAt)],
      limit: 200,
    })
    return ok(c, rows)
  },
)

staffingRoutes.post(
  '/bizes/:bizId/staffing-demands',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = staffingDemandBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    if (parsed.data.coverageLaneId) {
      const coverageLane = await db.query.coverageLanes.findFirst({
        where: and(eq(coverageLanes.bizId, bizId), eq(coverageLanes.id, parsed.data.coverageLaneId)),
        columns: { id: true },
      })
      if (!coverageLane) return fail(c, 'NOT_FOUND', 'Coverage lane not found.', 404)
    }

    const demand = await createStaffingRow(c, bizId, 'staffingDemands', {
          bizId,
          staffingPoolId: parsed.data.staffingPoolId,
          coverageLaneId: parsed.data.coverageLaneId,
          demandType: parsed.data.demandType ?? 'open_shift',
          fillMode: parsed.data.fillMode ?? 'invite_accept',
          status: parsed.data.status ?? 'open',
          title: parsed.data.title,
          description: parsed.data.description,
          locationId: parsed.data.locationId,
          targetResourceType: parsed.data.targetResourceType,
          requiredCount: parsed.data.requiredCount ?? 1,
          startsAt: new Date(parsed.data.startsAt),
          endsAt: new Date(parsed.data.endsAt),
          claimOpensAt: parsed.data.claimOpensAt ? new Date(parsed.data.claimOpensAt) : null,
          claimClosesAt: parsed.data.claimClosesAt ? new Date(parsed.data.claimClosesAt) : null,
          baseRateMinor: parsed.data.baseRateMinor,
          maxRateMinor: parsed.data.maxRateMinor,
          fulfillmentAssignmentId: parsed.data.fulfillmentAssignmentId,
          fulfillmentUnitId: parsed.data.fulfillmentUnitId,
          fromResourceId: parsed.data.fromResourceId,
          assignedResourceId: parsed.data.assignedResourceId,
          requestedByUserId: c.get('user')?.id ?? null,
          sourceType: parsed.data.sourceType,
          sourceRefId: parsed.data.sourceRefId,
          policy: cleanMetadata(parsed.data.policy),
          metadata: cleanMetadata(parsed.data.metadata),
        }, {
      subjectType: 'staffing_demand',
      displayName: parsed.data.title,
    })
    if (demand instanceof Response) return demand

    const demandId = (demand as Record<string, unknown>).id as string
    const requirementsCreated: Array<{ id: string; selectorsCreated: number }> = []
    for (const requirement of parsed.data.requirements) {
      const createdRequirement = await createStaffingRow(c, bizId, 'staffingDemandRequirements', {
            bizId,
            staffingDemandId: demandId,
            name: requirement.name,
            slug: requirement.slug,
            targetResourceType: requirement.targetResourceType,
            requirementMode: requirement.requirementMode ?? 'required',
            minQuantity: requirement.minQuantity ?? 1,
            maxQuantity: requirement.maxQuantity ?? null,
            selectorMatchMode: requirement.selectorMatchMode ?? 'any',
            allowSubstitution: requirement.allowSubstitution ?? true,
            sortOrder: requirement.sortOrder ?? 100,
            description: requirement.description,
            metadata: cleanMetadata(requirement.metadata),
          }, {
        subjectType: 'staffing_demand_requirement',
        displayName: requirement.name,
      })
      if (createdRequirement instanceof Response) return createdRequirement

      const requirementId = (createdRequirement as Record<string, unknown>).id as string
      if (requirement.selectors.length > 0) {
        for (const selector of requirement.selectors) {
          const selectorRow = await createStaffingRow(c, bizId, 'staffingDemandSelectors', {
              bizId,
              staffingDemandRequirementId: requirementId,
              selectorType: selector.selectorType,
              isIncluded: selector.isIncluded ?? true,
              resourceId: selector.resourceId,
              resourceType: selector.resourceType,
              capabilityTemplateId: selector.capabilityTemplateId,
              locationId: selector.locationId,
              subjectType: selector.subjectType,
              subjectId: selector.subjectId,
              sortOrder: selector.sortOrder ?? 100,
              description: selector.description,
              metadata: cleanMetadata(selector.metadata),
            }, {
            subjectType: 'staffing_demand_selector',
            displayName: selector.selectorType,
          })
          if (selectorRow instanceof Response) return selectorRow
        }
      }
      requirementsCreated.push({ id: requirementId, selectorsCreated: requirement.selectors.length })
    }
    const result = { demand, requirementsCreated }

    return ok(c, result, 201)
  },
)

staffingRoutes.get(
  '/bizes/:bizId/staffing-demands/:demandId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const graph = await loadDemandGraph(c.req.param('bizId'), c.req.param('demandId'))
    if (!graph) return fail(c, 'NOT_FOUND', 'Staffing demand not found.', 404)
    return ok(c, graph)
  },
)

staffingRoutes.get(
  '/bizes/:bizId/staffing-demands/:demandId/candidates',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, demandId } = c.req.param()
    const graph = await loadDemandGraph(bizId, demandId)
    if (!graph) return fail(c, 'NOT_FOUND', 'Staffing demand not found.', 404)
    const candidates = await computeDemandCandidates(bizId, demandId)
    return ok(c, { demand: graph.demand, candidates })
  },
)

staffingRoutes.post(
  '/bizes/:bizId/staffing-demands/:demandId/dispatch',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, demandId } = c.req.param()
    const parsed = dispatchDemandBodySchema.safeParse(await c.req.json().catch(() => ({})))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const graph = await loadDemandGraph(bizId, demandId)
    if (!graph) return fail(c, 'NOT_FOUND', 'Staffing demand not found.', 404)

    const candidates = await computeDemandCandidates(bizId, demandId)
    const selectedIds = parsed.data.candidateResourceIds?.length
      ? candidates.filter((row) => parsed.data.candidateResourceIds?.includes(row.resourceId)).map((row) => row.resourceId)
      : candidates.slice(0, Math.max(graph.demand.requiredCount, 1) * 3).map((row) => row.resourceId)

    if (selectedIds.length === 0) return fail(c, 'NO_CANDIDATES', 'No eligible staffing candidates found.', 409)

    const candidateResources = await db.query.resources.findMany({
      where: and(eq(resources.bizId, bizId), inArray(resources.id, selectedIds)),
    })

    const responsesCreated: Array<Record<string, unknown>> = []
    for (const [index, resource] of candidateResources.entries()) {
      const responseRow = await createStaffingRow(c, bizId, 'staffingResponses', {
        bizId,
        staffingDemandId: demandId,
        candidateResourceId: resource.id,
        responseMode: parsed.data.responseMode,
        status: 'pending',
        rankOrder: index + 1,
        offeredAt: new Date(),
        metadata: {
          dispatchSource: 'staffing.dispatch',
        },
      }, {
        subjectType: 'staffing_response',
        displayName: resource.name,
      })
      if (responseRow instanceof Response) return responseRow
      responsesCreated.push(responseRow as Record<string, unknown>)
    }

    const messages: Array<Record<string, unknown>> = []
    for (const resource of candidateResources) {
      if (!resource.hostUserId) continue
      const message = await createLifecycleMessage(c, {
          bizId,
          recipientUserId: resource.hostUserId,
          recipientRef: resource.hostUserId,
          channel: parsed.data.channel,
          purpose: 'operational',
          subject: `Coverage request: ${graph.demand.title}`,
          body: `A new staffing demand needs coverage from ${graph.demand.startsAt.toISOString()} to ${graph.demand.endsAt.toISOString()}.`,
          eventType: 'staffing.demand_invited',
          metadata: {
            staffingDemandId: demandId,
            candidateResourceId: resource.id,
          },
        })
      messages.push(message)
    }

    return ok(c, {
      demandId,
      candidateCount: selectedIds.length,
      responses: responsesCreated,
      notificationsSent: messages.length,
    }, 201)
  },
)

staffingRoutes.get(
  '/bizes/:bizId/staffing-demands/:demandId/responses',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, demandId } = c.req.param()
    const rows = await db.query.staffingResponses.findMany({
      where: and(eq(staffingResponses.bizId, bizId), eq(staffingResponses.staffingDemandId, demandId)),
      orderBy: [asc(staffingResponses.rankOrder), asc(staffingResponses.offeredAt)],
    })
    return ok(c, rows)
  },
)

staffingRoutes.patch(
  '/bizes/:bizId/staffing-responses/:responseId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, responseId } = c.req.param()
    const parsed = updateResponseBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.staffingResponses.findFirst({
      where: and(eq(staffingResponses.bizId, bizId), eq(staffingResponses.id, responseId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Staffing response not found.', 404)

    const demand = await db.query.staffingDemands.findFirst({
      where: and(eq(staffingDemands.bizId, bizId), eq(staffingDemands.id, existing.staffingDemandId)),
    })
    if (!demand) return fail(c, 'NOT_FOUND', 'Staffing demand not found.', 404)

    if (
      parsed.data.proposedHourlyRateMinor !== undefined &&
      demand.baseRateMinor !== null &&
      parsed.data.proposedHourlyRateMinor < demand.baseRateMinor
    ) {
      return fail(c, 'RATE_BELOW_BASE', 'Proposed rate is below the staffing demand base rate.', 409)
    }
    if (
      parsed.data.proposedHourlyRateMinor !== undefined &&
      demand.maxRateMinor !== null &&
      parsed.data.proposedHourlyRateMinor > demand.maxRateMinor
    ) {
      return fail(c, 'RATE_ABOVE_MAX', 'Proposed rate is above the staffing demand max rate.', 409)
    }

    const updated = await updateStaffingRow(c, bizId, 'staffingResponses', responseId, {
        status: parsed.data.status,
        responseReason: parsed.data.responseReason,
        respondedAt: parsed.data.respondedAt ? new Date(parsed.data.respondedAt) : new Date(),
        proposedHourlyRateMinor: parsed.data.proposedHourlyRateMinor,
        proposedTotalMinor: parsed.data.proposedTotalMinor,
        respondedByUserId: c.get('user')?.id ?? null,
        metadata: parsed.data.metadata === undefined ? undefined : cleanMetadata(parsed.data.metadata),
      }, {
      subjectType: 'staffing_response',
      displayName: existing.id,
    })
    if (updated instanceof Response) return updated
    return ok(c, updated)
  },
)

staffingRoutes.post(
  '/bizes/:bizId/staffing-demands/:demandId/assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, demandId } = c.req.param()
    const parsed = createAssignmentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const graph = await loadDemandGraph(bizId, demandId)
    if (!graph) return fail(c, 'NOT_FOUND', 'Staffing demand not found.', 404)

    const response =
      parsed.data.staffingResponseId
        ? await db.query.staffingResponses.findFirst({
            where: and(eq(staffingResponses.bizId, bizId), eq(staffingResponses.id, parsed.data.staffingResponseId)),
          })
        : null
    if (parsed.data.staffingResponseId && !response) return fail(c, 'NOT_FOUND', 'Staffing response not found.', 404)

    const resourceId = response?.candidateResourceId ?? parsed.data.resourceId
    if (!resourceId) return fail(c, 'VALIDATION_ERROR', 'resourceId could not be resolved.', 400)

    const resource = await db.query.resources.findFirst({
      where: and(eq(resources.bizId, bizId), eq(resources.id, resourceId)),
    })
    if (!resource) return fail(c, 'NOT_FOUND', 'Resource not found.', 404)

    const coverageLaneId = parsed.data.coverageLaneId ?? graph.demand.coverageLaneId ?? null
    if (coverageLaneId) {
      const coverageLane = await db.query.coverageLanes.findFirst({
        where: and(eq(coverageLanes.bizId, bizId), eq(coverageLanes.id, coverageLaneId)),
        columns: { id: true },
      })
      if (!coverageLane) return fail(c, 'NOT_FOUND', 'Coverage lane not found.', 404)
    }

    const assignment = await createStaffingRow(c, bizId, 'staffingAssignments', {
        bizId,
        staffingDemandId: demandId,
        resourceId,
        coverageLaneId,
        staffingResponseId: response?.id ?? null,
        fulfillmentAssignmentId: graph.demand.fulfillmentAssignmentId ?? null,
        fulfillmentUnitId: graph.demand.fulfillmentUnitId ?? null,
        status: parsed.data.status ?? 'confirmed',
        startsAt: graph.demand.startsAt,
        endsAt: graph.demand.endsAt,
        isPrimary: true,
        compensationRateMinor: parsed.data.compensationRateMinor ?? graph.demand.baseRateMinor ?? null,
        assignedByUserId: c.get('user')?.id ?? null,
        metadata: cleanMetadata(parsed.data.metadata),
      }, {
      subjectType: 'staffing_assignment',
      displayName: resource.name,
    })
    if (assignment instanceof Response) return assignment

    await syncCoverageLaneAssignmentAvailability({
      bizId,
      staffingAssignmentId: String((assignment as Record<string, unknown>).id),
      actorUserId: c.get('user')?.id ?? null,
    })

    const demandUpdated = await updateStaffingRow(c, bizId, 'staffingDemands', demandId, {
        status: 'filled',
        filledCount: Math.min((graph.demand.filledCount ?? 0) + 1, graph.demand.requiredCount),
        assignedResourceId: resourceId,
      }, {
      subjectType: 'staffing_demand',
      displayName: graph.demand.title,
    })
    if (demandUpdated instanceof Response) return demandUpdated

    if (response) {
      const acceptedResponse = await updateStaffingRow(c, bizId, 'staffingResponses', response.id, {
          status: response.status === 'accepted' ? response.status : 'accepted',
          respondedAt: response.respondedAt ?? new Date(),
        }, {
        subjectType: 'staffing_response',
        displayName: response.id,
      })
      if (acceptedResponse instanceof Response) return acceptedResponse

      if (graph.demand.fillMode === 'auction') {
        const losers = await db.query.staffingResponses.findMany({
          where: and(
            eq(staffingResponses.bizId, bizId),
            eq(staffingResponses.staffingDemandId, demandId),
            inArray(staffingResponses.status, ['pending', 'accepted']),
          ),
        })
        for (const loser of losers) {
          if (loser.id === response.id) continue
          const lostResponse = await updateStaffingRow(c, bizId, 'staffingResponses', loser.id, {
            status: 'lost',
            respondedAt: loser.respondedAt ?? new Date(),
            responseReason: loser.responseReason ?? 'lost_after_award',
          }, {
            subjectType: 'staffing_response',
            displayName: loser.id,
          })
          if (lostResponse instanceof Response) return lostResponse
        }
      }
    }

    let clientMessageId: string | null = null
    if (parsed.data.notifyClient && graph.demand.sourceType === 'booking_order' && graph.demand.sourceRefId) {
      const booking = await db.query.bookingOrders.findFirst({
        where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, graph.demand.sourceRefId)),
      })
      if (booking?.customerUserId) {
        const message = await createLifecycleMessage(c, {
          bizId,
          recipientUserId: booking.customerUserId,
          recipientRef: booking.customerUserId,
          channel: 'email',
          purpose: 'transactional',
          subject: `Updated provider for ${graph.demand.title}`,
          body: `${resource.name} is now assigned to your booking.`,
          eventType: 'staffing.assignment_client_notified',
          metadata: {
            staffingDemandId: demandId,
            staffingAssignmentId: (assignment as Record<string, unknown>).id as string,
            bookingOrderId: booking.id,
            resourceId,
          },
        })
        clientMessageId = String(message.id)
      }
    }

    return ok(
      c,
      {
        assignment,
        clientMessageId,
      },
      201,
    )
  },
)

staffingRoutes.get(
  '/bizes/:bizId/staffing-demands/:demandId/assignments',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, demandId } = c.req.param()
    const rows = await db.query.staffingAssignments.findMany({
      where: and(eq(staffingAssignments.bizId, bizId), eq(staffingAssignments.staffingDemandId, demandId)),
      orderBy: [asc(staffingAssignments.assignedAt)],
    })
    return ok(c, rows)
  },
)

staffingRoutes.get(
  '/bizes/:bizId/staffing-demands/:demandId/history',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, demandId } = c.req.param()
    const graph = await loadDemandGraph(bizId, demandId)
    if (!graph) return fail(c, 'NOT_FOUND', 'Staffing demand not found.', 404)
    const [responsesRows, assignmentsRows, messages] = await Promise.all([
      db.query.staffingResponses.findMany({
        where: and(eq(staffingResponses.bizId, bizId), eq(staffingResponses.staffingDemandId, demandId)),
        orderBy: [asc(staffingResponses.offeredAt)],
      }),
      db.query.staffingAssignments.findMany({
        where: and(eq(staffingAssignments.bizId, bizId), eq(staffingAssignments.staffingDemandId, demandId)),
        orderBy: [asc(staffingAssignments.assignedAt)],
      }),
      db.query.outboundMessages.findMany({
        where: and(eq(outboundMessages.bizId, bizId), sql`${outboundMessages.metadata} ->> 'staffingDemandId' = ${demandId}`),
        orderBy: [asc(outboundMessages.sentAt)],
      }),
    ])
    return ok(c, {
      demand: graph.demand,
      requirements: graph.requirements,
      selectors: graph.selectors,
      responses: responsesRows,
      assignments: assignmentsRows,
      messages,
    })
  },
)
