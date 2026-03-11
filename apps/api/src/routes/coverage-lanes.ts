import { Hono } from 'hono'
import { and, asc, desc, eq, gte, lte, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'
import { sanitizeUnknown } from '../lib/sanitize.js'
import { ensureCoverageLaneArtifacts, syncCoverageLaneAssignmentAvailability } from '../services/coverage-lanes.js'
import {
  evaluateCoverageLaneAlerts,
  listCoverageLaneAlerts,
  publishCoverageLaneShiftTemplate,
} from '../services/coverage-lane-operations.js'

const {
  db,
  coverageLanes,
  coverageLaneAlerts,
  coverageLaneMemberships,
  coverageLaneShiftTemplates,
  staffingDemands,
  staffingAssignments,
  availabilityRules,
  resources,
} = dbPackage

const laneBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  locationId: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  laneType: z.enum(['front_desk', 'phone_response', 'remote_response', 'triage', 'dispatch', 'supervisor', 'custom']).default('custom'),
  presenceMode: z.enum(['onsite', 'remote', 'hybrid']).default('onsite'),
  requiredHeadcount: z.number().int().min(1).default(1),
  autoDispatchEnabled: z.boolean().default(false),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const lanePatchSchema = laneBodySchema.partial()

const membershipBodySchema = z.object({
  resourceId: z.string().min(1),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  membershipRole: z.enum(['primary', 'backup', 'overflow']).default('primary'),
  participationMode: z.enum(['onsite', 'remote', 'hybrid']).default('onsite'),
  escalationOrder: z.number().int().min(0).default(100),
  responsePriority: z.number().int().min(0).default(100),
  isDispatchEligible: z.boolean().default(true),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const membershipPatchSchema = membershipBodySchema.partial()

const onCallShiftBodySchema = z.object({
  title: z.string().min(1).max(220).optional(),
  description: z.string().max(1000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  fillMode: z.enum(['direct_assign', 'fcfs_claim', 'invite_accept', 'auction', 'auto_match']).optional(),
  requiredCount: z.number().int().min(1).optional(),
  resourceId: z.string().optional(),
  compensationRateMinor: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const listCoverageLaneAlertsQuerySchema = z.object({
  laneId: z.string().optional(),
  status: z.enum(['active', 'acknowledged', 'resolved']).optional(),
})

const shiftTemplateBodySchema = z.object({
  name: z.string().min(1).max(220),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  locationId: z.string().optional().nullable(),
  defaultResourceId: z.string().optional().nullable(),
  timezone: z.string().min(1).max(80).default('UTC'),
  dayOfWeeks: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  fillMode: z.enum(['direct_assign', 'fcfs_claim', 'invite_accept', 'auction', 'auto_match']).default('invite_accept'),
  requiredCount: z.number().int().min(1).default(1),
  autoPublishEnabled: z.boolean().default(false),
  publishWindowDays: z.number().int().min(1).max(365).default(14),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const shiftTemplatePatchSchema = shiftTemplateBodySchema.partial()
const publishShiftTemplateBodySchema = z.object({
  through: z.string().datetime().optional(),
})

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

async function loadLane(bizId: string, laneId: string) {
  return db.query.coverageLanes.findFirst({
    where: and(eq(coverageLanes.bizId, bizId), eq(coverageLanes.id, laneId)),
  })
}

export const coverageLaneRoutes = new Hono()

coverageLaneRoutes.get(
  '/bizes/:bizId/coverage-lanes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.coverageLanes.findMany({
      where: eq(coverageLanes.bizId, bizId),
      orderBy: [asc(coverageLanes.name)],
    })
    return ok(c, rows)
  },
)

coverageLaneRoutes.get(
  '/bizes/:bizId/coverage-lane-alerts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listCoverageLaneAlertsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const rows = await listCoverageLaneAlerts({
      bizId,
      laneId: parsed.data.laneId ?? null,
      status: parsed.data.status ?? null,
    })
    return ok(c, rows)
  },
)

coverageLaneRoutes.post(
  '/bizes/:bizId/coverage-lanes/evaluate-alerts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const locationId = c.req.query('locationId') ? String(c.req.query('locationId')) : null
    const result = await db.transaction((tx) =>
      evaluateCoverageLaneAlerts({
        bizId,
        locationId,
        executor: tx,
      }),
    )
    return ok(c, result)
  },
)

coverageLaneRoutes.post(
  '/bizes/:bizId/coverage-lanes',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const actor = c.get('user')
    const parsed = laneBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const result = await db.transaction(async (tx) => {
      const [lane] = await tx.insert(coverageLanes).values({
        bizId,
        locationId: parsed.data.locationId ?? null,
        name: parsed.data.name,
        slug: parsed.data.slug,
        status: parsed.data.status,
        laneType: parsed.data.laneType,
        presenceMode: parsed.data.presenceMode,
        requiredHeadcount: parsed.data.requiredHeadcount,
        autoDispatchEnabled: parsed.data.autoDispatchEnabled,
        policy: sanitizeUnknown(parsed.data.policy ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      }).returning()

      const artifacts = await ensureCoverageLaneArtifacts({
        bizId,
        coverageLaneId: lane.id,
        name: lane.name,
        locationId: lane.locationId,
        requiredHeadcount: lane.requiredHeadcount,
        actorUserId: actor?.id ?? null,
        executor: tx,
      })

      const hydrated = await tx.query.coverageLanes.findFirst({
        where: and(eq(coverageLanes.bizId, bizId), eq(coverageLanes.id, lane.id)),
      })
      return { lane: hydrated, artifacts }
    })

    return ok(c, result, 201)
  },
)

coverageLaneRoutes.get(
  '/bizes/:bizId/coverage-lanes/:laneId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, laneId } = c.req.param()
    const lane = await loadLane(bizId, laneId)
    if (!lane) return fail(c, 'NOT_FOUND', 'Coverage lane not found.', 404)
    return ok(c, lane)
  },
)

coverageLaneRoutes.patch(
  '/bizes/:bizId/coverage-lanes/:laneId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, laneId } = c.req.param()
    const actor = c.get('user')
    const parsed = lanePatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const existing = await loadLane(bizId, laneId)
    if (!existing) return fail(c, 'NOT_FOUND', 'Coverage lane not found.', 404)

    const patch = {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
      ...(parsed.data.locationId !== undefined ? { locationId: parsed.data.locationId ?? null } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.laneType !== undefined ? { laneType: parsed.data.laneType } : {}),
      ...(parsed.data.presenceMode !== undefined ? { presenceMode: parsed.data.presenceMode } : {}),
      ...(parsed.data.requiredHeadcount !== undefined ? { requiredHeadcount: parsed.data.requiredHeadcount } : {}),
      ...(parsed.data.autoDispatchEnabled !== undefined ? { autoDispatchEnabled: parsed.data.autoDispatchEnabled } : {}),
      ...(parsed.data.policy !== undefined ? { policy: sanitizeUnknown(parsed.data.policy ?? {}) } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    } as Record<string, unknown>

    await db.update(coverageLanes).set(patch).where(and(eq(coverageLanes.bizId, bizId), eq(coverageLanes.id, laneId)))
    const updated = await loadLane(bizId, laneId)
    if (!updated) return fail(c, 'NOT_FOUND', 'Coverage lane not found.', 404)
    await ensureCoverageLaneArtifacts({
      bizId,
      coverageLaneId: laneId,
      name: updated.name,
      locationId: updated.locationId,
      requiredHeadcount: updated.requiredHeadcount,
      actorUserId: actor?.id ?? null,
    })
    return ok(c, updated)
  },
)

coverageLaneRoutes.get(
  '/bizes/:bizId/coverage-lanes/:laneId/memberships',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, laneId } = c.req.param()
    const rows = await db.query.coverageLaneMemberships.findMany({
      where: and(eq(coverageLaneMemberships.bizId, bizId), eq(coverageLaneMemberships.coverageLaneId, laneId)),
      orderBy: [asc(coverageLaneMemberships.escalationOrder), asc(coverageLaneMemberships.responsePriority)],
    })
    return ok(c, rows)
  },
)

coverageLaneRoutes.post(
  '/bizes/:bizId/coverage-lanes/:laneId/memberships',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, laneId } = c.req.param()
    const actor = c.get('user')
    const parsed = membershipBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const lane = await loadLane(bizId, laneId)
    if (!lane) return fail(c, 'NOT_FOUND', 'Coverage lane not found.', 404)

    const resource = await db.query.resources.findFirst({
      where: and(eq(resources.bizId, bizId), eq(resources.id, parsed.data.resourceId)),
      columns: { id: true },
    })
    if (!resource) return fail(c, 'NOT_FOUND', 'Resource not found.', 404)

    const existing = await db.query.coverageLaneMemberships.findFirst({
      where: and(
        eq(coverageLaneMemberships.bizId, bizId),
        eq(coverageLaneMemberships.coverageLaneId, laneId),
        eq(coverageLaneMemberships.resourceId, parsed.data.resourceId),
      ),
    })
    if (existing) return ok(c, existing)

    const [created] = await db.insert(coverageLaneMemberships).values({
      bizId,
      coverageLaneId: laneId,
      resourceId: parsed.data.resourceId,
      status: parsed.data.status,
      membershipRole: parsed.data.membershipRole,
      participationMode: parsed.data.participationMode,
      escalationOrder: parsed.data.escalationOrder,
      responsePriority: parsed.data.responsePriority,
      isDispatchEligible: parsed.data.isDispatchEligible,
      effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null,
      effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
      policy: sanitizeUnknown(parsed.data.policy ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

coverageLaneRoutes.patch(
  '/bizes/:bizId/coverage-lane-memberships/:membershipId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, membershipId } = c.req.param()
    const actor = c.get('user')
    const parsed = membershipPatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.coverageLaneMemberships.findFirst({
      where: and(eq(coverageLaneMemberships.bizId, bizId), eq(coverageLaneMemberships.id, membershipId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Coverage lane membership not found.', 404)

    const patch = {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.membershipRole !== undefined ? { membershipRole: parsed.data.membershipRole } : {}),
      ...(parsed.data.participationMode !== undefined ? { participationMode: parsed.data.participationMode } : {}),
      ...(parsed.data.escalationOrder !== undefined ? { escalationOrder: parsed.data.escalationOrder } : {}),
      ...(parsed.data.responsePriority !== undefined ? { responsePriority: parsed.data.responsePriority } : {}),
      ...(parsed.data.isDispatchEligible !== undefined ? { isDispatchEligible: parsed.data.isDispatchEligible } : {}),
      ...(parsed.data.effectiveFrom !== undefined ? { effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null } : {}),
      ...(parsed.data.effectiveTo !== undefined ? { effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null } : {}),
      ...(parsed.data.policy !== undefined ? { policy: sanitizeUnknown(parsed.data.policy ?? {}) } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    } as Record<string, unknown>

    const [updated] = await db.update(coverageLaneMemberships).set(patch).where(and(eq(coverageLaneMemberships.bizId, bizId), eq(coverageLaneMemberships.id, membershipId))).returning()
    return ok(c, updated)
  },
)

coverageLaneRoutes.post(
  '/bizes/:bizId/coverage-lanes/:laneId/on-call-shifts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, laneId } = c.req.param()
    const actor = c.get('user')
    const parsed = onCallShiftBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const lane = await loadLane(bizId, laneId)
    if (!lane) return fail(c, 'NOT_FOUND', 'Coverage lane not found.', 404)

    const result = await db.transaction(async (tx) => {
      const [demand] = await tx.insert(staffingDemands).values({
        bizId,
        demandType: 'on_call',
        fillMode: parsed.data.fillMode ?? (parsed.data.resourceId ? 'direct_assign' : 'invite_accept'),
        status: parsed.data.resourceId ? 'filled' : 'open',
        title: parsed.data.title ?? `${lane.name} on-call`,
        description: parsed.data.description ?? null,
        locationId: lane.locationId,
        requiredCount: parsed.data.requiredCount ?? lane.requiredHeadcount,
        filledCount: parsed.data.resourceId ? 1 : 0,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        requestedByUserId: actor?.id ?? null,
        coverageLaneId: laneId,
        policy: sanitizeUnknown(lane.policy ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      }).returning()

      let assignment: Record<string, unknown> | null = null
      if (parsed.data.resourceId) {
        const [createdAssignment] = await tx.insert(staffingAssignments).values({
          bizId,
          staffingDemandId: demand.id,
          resourceId: parsed.data.resourceId,
          coverageLaneId: laneId,
          status: 'confirmed',
          startsAt: new Date(parsed.data.startsAt),
          endsAt: new Date(parsed.data.endsAt),
          isPrimary: true,
          compensationRateMinor: parsed.data.compensationRateMinor ?? null,
          assignedByUserId: actor?.id ?? null,
          assignedAt: new Date(),
          metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
        }).returning()
        assignment = createdAssignment as Record<string, unknown>
        await syncCoverageLaneAssignmentAvailability({
          bizId,
          staffingAssignmentId: createdAssignment.id,
          actorUserId: actor?.id ?? null,
          executor: tx,
        })
      }

      return { demand, assignment }
    })

    return ok(c, result, 201)
  },
)

coverageLaneRoutes.get(
  '/bizes/:bizId/coverage-lanes/:laneId/shift-templates',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, laneId } = c.req.param()
    const rows = await db.query.coverageLaneShiftTemplates.findMany({
      where: and(eq(coverageLaneShiftTemplates.bizId, bizId), eq(coverageLaneShiftTemplates.coverageLaneId, laneId)),
      orderBy: [asc(coverageLaneShiftTemplates.name)],
    })
    return ok(c, rows)
  },
)

coverageLaneRoutes.post(
  '/bizes/:bizId/coverage-lanes/:laneId/shift-templates',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, laneId } = c.req.param()
    const parsed = shiftTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const lane = await loadLane(bizId, laneId)
    if (!lane) return fail(c, 'NOT_FOUND', 'Coverage lane not found.', 404)

    const [created] = await db.insert(coverageLaneShiftTemplates).values({
      bizId,
      coverageLaneId: laneId,
      locationId: parsed.data.locationId ?? lane.locationId ?? null,
      defaultResourceId: parsed.data.defaultResourceId ?? null,
      name: parsed.data.name,
      status: parsed.data.status,
      timezone: parsed.data.timezone,
      recurrenceRule: sanitizeUnknown({
        dayOfWeeks: parsed.data.dayOfWeeks,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
      }),
      fillMode: parsed.data.fillMode,
      requiredCount: parsed.data.requiredCount,
      autoPublishEnabled: parsed.data.autoPublishEnabled,
      publishWindowDays: parsed.data.publishWindowDays,
      policy: sanitizeUnknown(parsed.data.policy ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

coverageLaneRoutes.patch(
  '/bizes/:bizId/coverage-shift-templates/:templateId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, templateId } = c.req.param()
    const parsed = shiftTemplatePatchSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.coverageLaneShiftTemplates.findFirst({
      where: and(eq(coverageLaneShiftTemplates.bizId, bizId), eq(coverageLaneShiftTemplates.id, templateId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Coverage shift template not found.', 404)

    const nextRule = {
      ...asRecord(existing.recurrenceRule),
      ...(parsed.data.dayOfWeeks !== undefined ? { dayOfWeeks: parsed.data.dayOfWeeks } : {}),
      ...(parsed.data.startTime !== undefined ? { startTime: parsed.data.startTime } : {}),
      ...(parsed.data.endTime !== undefined ? { endTime: parsed.data.endTime } : {}),
    }

    const [updated] = await db.update(coverageLaneShiftTemplates).set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.locationId !== undefined ? { locationId: parsed.data.locationId ?? null } : {}),
      ...(parsed.data.defaultResourceId !== undefined ? { defaultResourceId: parsed.data.defaultResourceId ?? null } : {}),
      ...(parsed.data.timezone !== undefined ? { timezone: parsed.data.timezone } : {}),
      ...(parsed.data.dayOfWeeks !== undefined || parsed.data.startTime !== undefined || parsed.data.endTime !== undefined
        ? { recurrenceRule: sanitizeUnknown(nextRule) }
        : {}),
      ...(parsed.data.fillMode !== undefined ? { fillMode: parsed.data.fillMode } : {}),
      ...(parsed.data.requiredCount !== undefined ? { requiredCount: parsed.data.requiredCount } : {}),
      ...(parsed.data.autoPublishEnabled !== undefined ? { autoPublishEnabled: parsed.data.autoPublishEnabled } : {}),
      ...(parsed.data.publishWindowDays !== undefined ? { publishWindowDays: parsed.data.publishWindowDays } : {}),
      ...(parsed.data.policy !== undefined ? { policy: sanitizeUnknown(parsed.data.policy ?? {}) } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
    }).where(and(eq(coverageLaneShiftTemplates.bizId, bizId), eq(coverageLaneShiftTemplates.id, templateId))).returning()

    return ok(c, updated)
  },
)

coverageLaneRoutes.post(
  '/bizes/:bizId/coverage-shift-templates/:templateId/publish',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, templateId } = c.req.param()
    const actor = c.get('user')
    const parsed = publishShiftTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const result = await db.transaction((tx) =>
      publishCoverageLaneShiftTemplate({
        bizId,
        templateId,
        through: parsed.data.through ? new Date(parsed.data.through) : undefined,
        executor: tx,
        actorUserId: actor?.id ?? null,
      }),
    )
    return ok(c, result)
  },
)

coverageLaneRoutes.get(
  '/bizes/:bizId/coverage-lanes/:laneId/coverage',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, laneId } = c.req.param()
    const lane = await loadLane(bizId, laneId)
    if (!lane) return fail(c, 'NOT_FOUND', 'Coverage lane not found.', 404)

    const from = c.req.query('from') ? new Date(String(c.req.query('from'))) : new Date(Date.now() - 12 * 60 * 60 * 1000)
    const to = c.req.query('to') ? new Date(String(c.req.query('to'))) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const [assignments, rules] = await Promise.all([
      db.query.staffingAssignments.findMany({
        where: and(
          eq(staffingAssignments.bizId, bizId),
          eq(staffingAssignments.coverageLaneId, laneId),
          lte(staffingAssignments.startsAt, to),
          gte(staffingAssignments.endsAt, from),
        ),
        orderBy: [asc(staffingAssignments.startsAt)],
      }),
      lane.primaryCalendarId
        ? db.query.availabilityRules.findMany({
            where: and(
              eq(availabilityRules.bizId, bizId),
              eq(availabilityRules.calendarId, lane.primaryCalendarId),
              or(
                and(gte(availabilityRules.endAt, from), lte(availabilityRules.startAt, to)),
                and(eq(availabilityRules.mode, 'recurring'), eq(availabilityRules.isActive, true)),
              ),
            ),
            orderBy: [asc(availabilityRules.priority), asc(availabilityRules.startAt)],
          })
        : Promise.resolve([]),
    ])

    return ok(c, {
      lane,
      assignments,
      calendarRules: rules,
    })
  },
)
