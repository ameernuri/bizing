/**
 * Workforce core routes.
 *
 * ELI5:
 * This route family exposes workforce architecture end-to-end:
 * - departments, positions, assignments
 * - requisitions, candidates, applications + hire workflow
 * - performance cycles/reviews
 * - benefits plans/enrollments
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  workforceDepartments,
  workforcePositions,
  workforceAssignments,
  workforceRequisitions,
  workforceCandidates,
  workforceApplications,
  workforceCandidateEvents,
  workforcePerformanceCycles,
  workforcePerformanceReviews,
  workforceBenefitPlans,
  workforceBenefitEnrollments,
} = dbPackage

const departmentBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  departmentCode: z.string().max(80).optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  parentWorkforceDepartmentId: z.string().optional().nullable(),
  managerUserId: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).default(100),
  description: z.string().max(4000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
const departmentPatchSchema = departmentBodySchema.partial()

const positionBodySchema = z.object({
  workforceDepartmentId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  title: z.string().min(1).max(220),
  positionCode: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  employmentClass: z.enum(['employee', 'contractor', 'temporary', 'intern', 'vendor_worker']).default('employee'),
  timeCommitment: z.enum(['full_time', 'part_time', 'shift_based', 'project_based', 'flexible']).default('full_time'),
  reportsToWorkforcePositionId: z.string().optional().nullable(),
  headcountTarget: z.number().int().min(1).default(1),
  headcountFilled: z.number().int().min(0).default(0),
  isHiringEnabled: z.boolean().default(false),
  description: z.string().max(4000).optional().nullable(),
  requirements: z.record(z.unknown()).optional(),
  compensationBand: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const positionPatchSchema = positionBodySchema.partial()

const assignmentBodySchema = z.object({
  workforcePositionId: z.string().min(1),
  userId: z.string().optional().nullable(),
  resourceId: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'on_leave', 'suspended', 'terminated', 'ended']).default('draft'),
  employmentClass: z.enum(['employee', 'contractor', 'temporary', 'intern', 'vendor_worker']).default('employee'),
  timeCommitment: z.enum(['full_time', 'part_time', 'shift_based', 'project_based', 'flexible']).default('full_time'),
  assignmentTitle: z.string().max(220).optional().nullable(),
  managerWorkforceAssignmentId: z.string().optional().nullable(),
  compensationPlanId: z.string().optional().nullable(),
  leavePolicyId: z.string().optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  isPrimary: z.boolean().default(true),
  allocationBasisPoints: z.number().int().min(1).max(10000).default(10000),
  workPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const assignmentPatchSchema = assignmentBodySchema.partial()

const requisitionBodySchema = z.object({
  workforcePositionId: z.string().optional().nullable(),
  workforceDepartmentId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  title: z.string().min(1).max(220),
  status: z.enum(['draft', 'open', 'on_hold', 'filled', 'cancelled', 'closed']).default('draft'),
  openingCount: z.number().int().min(1).default(1),
  filledCount: z.number().int().min(0).default(0),
  priority: z.number().int().min(0).default(100),
  hiringManagerUserId: z.string().optional().nullable(),
  recruiterUserId: z.string().optional().nullable(),
  openedAt: z.string().datetime().optional().nullable(),
  targetHireByAt: z.string().datetime().optional().nullable(),
  closedAt: z.string().datetime().optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  requirements: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const requisitionPatchSchema = requisitionBodySchema.partial()

const candidateBodySchema = z.object({
  status: z.enum(['sourced', 'screening', 'interviewing', 'offer', 'hired', 'rejected', 'withdrawn']).default('sourced'),
  fullName: z.string().min(1).max(220),
  primaryEmail: z.string().email().max(320).optional().nullable(),
  primaryPhone: z.string().max(60).optional().nullable(),
  sourceChannel: z.string().max(120).optional().nullable(),
  currentCompany: z.string().max(220).optional().nullable(),
  currentTitle: z.string().max(220).optional().nullable(),
  locationPreference: z.string().max(1000).optional().nullable(),
  availableFromAt: z.string().datetime().optional().nullable(),
  resumeDocumentRef: z.string().max(260).optional().nullable(),
  profile: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const candidatePatchSchema = candidateBodySchema.partial()

const applicationBodySchema = z.object({
  workforceRequisitionId: z.string().min(1),
  workforceCandidateId: z.string().min(1),
  status: z.enum(['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn', 'on_hold']).default('applied'),
  appliedAt: z.string().datetime().optional().nullable(),
  assignedRecruiterUserId: z.string().optional().nullable(),
  decisionByUserId: z.string().optional().nullable(),
  decisionAt: z.string().datetime().optional().nullable(),
  desiredCompensationMinor: z.number().int().min(0).optional().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  hiredWorkforceAssignmentId: z.string().optional().nullable(),
  offerPayload: z.record(z.unknown()).optional(),
  notes: z.string().max(4000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
const applicationPatchSchema = applicationBodySchema.partial()

const hireBodySchema = z.object({
  userId: z.string().optional().nullable(),
  resourceId: z.string().optional().nullable(),
  workforcePositionId: z.string().optional().nullable(),
  employmentClass: z.enum(['employee', 'contractor', 'temporary', 'intern', 'vendor_worker']).default('employee'),
  timeCommitment: z.enum(['full_time', 'part_time', 'shift_based', 'project_based', 'flexible']).default('full_time'),
  assignmentTitle: z.string().max(220).optional().nullable(),
  startsAt: z.string().datetime(),
  isPrimary: z.boolean().default(true),
  allocationBasisPoints: z.number().int().min(1).max(10000).default(10000),
  workPolicy: z.record(z.unknown()).optional(),
  notes: z.string().max(4000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const performanceCycleBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'closed', 'archived']).default('draft'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  calibrationDueAt: z.string().datetime().optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
  closedAt: z.string().datetime().optional().nullable(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const performanceCyclePatchSchema = performanceCycleBodySchema.partial()

const performanceReviewBodySchema = z.object({
  workforcePerformanceCycleId: z.string().min(1),
  workforceAssignmentId: z.string().min(1),
  reviewerWorkforceAssignmentId: z.string().optional().nullable(),
  status: z.enum(['draft', 'in_progress', 'submitted', 'completed', 'cancelled']).default('draft'),
  scoreBasisPoints: z.number().int().min(0).max(10000).optional().nullable(),
  selfAssessment: z.record(z.unknown()).optional(),
  managerAssessment: z.record(z.unknown()).optional(),
  goals: z.record(z.unknown()).optional(),
  submittedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
const performanceReviewPatchSchema = performanceReviewBodySchema.partial()

const benefitPlanBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  benefitType: z.string().min(1).max(80).default('health'),
  providerName: z.string().max(220).optional().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  employerContributionMinor: z.number().int().min(0).default(0),
  employeeContributionMinor: z.number().int().min(0).default(0),
  effectiveAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  eligibilityPolicy: z.record(z.unknown()).optional(),
  coveragePolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const benefitPlanPatchSchema = benefitPlanBodySchema.partial()

const benefitEnrollmentBodySchema = z.object({
  workforceBenefitPlanId: z.string().min(1),
  workforceAssignmentId: z.string().min(1),
  status: z.enum(['pending', 'active', 'declined', 'cancelled', 'ended']).default('pending'),
  coverageTier: z.string().max(100).optional().nullable(),
  dependentCount: z.number().int().min(0).default(0),
  employeeContributionMinor: z.number().int().min(0).optional().nullable(),
  employerContributionMinor: z.number().int().min(0).optional().nullable(),
  electedAt: z.string().datetime().optional().nullable(),
  effectiveAt: z.string().datetime(),
  endedAt: z.string().datetime().optional().nullable(),
  waivedReason: z.string().max(1000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
const benefitEnrollmentPatchSchema = benefitEnrollmentBodySchema.partial()

async function createWorkforceRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'workforce' },
  })
  if (!delegated.ok) {
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  return delegated.row as T
}

async function updateWorkforceRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'workforce' },
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

export const workforceRoutes = new Hono()

workforceRoutes.get('/bizes/:bizId/workforce-departments', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.workforceDepartments.findMany({ where: eq(workforceDepartments.bizId, bizId), orderBy: [asc(workforceDepartments.sortOrder), asc(workforceDepartments.name)] })
  return ok(c, rows)
})

workforceRoutes.post('/bizes/:bizId/workforce-departments', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = departmentBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkforceRow<typeof workforceDepartments.$inferSelect>({
    c, bizId, tableKey: 'workforceDepartments', subjectType: 'workforce_department', displayName: parsed.data.name, data: {
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      departmentCode: parsed.data.departmentCode ?? null,
      status: parsed.data.status,
      parentWorkforceDepartmentId: parsed.data.parentWorkforceDepartmentId ?? null,
      managerUserId: parsed.data.managerUserId ?? null,
      sortOrder: parsed.data.sortOrder,
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workforceRoutes.patch('/bizes/:bizId/workforce-departments/:workforceDepartmentId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforceDepartmentId } = c.req.param()
  const parsed = departmentPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const patch = {
    ...(parsed.data.name !== undefined ? { name: sanitizePlainText(parsed.data.name) } : {}),
    ...(parsed.data.slug !== undefined ? { slug: sanitizePlainText(parsed.data.slug) } : {}),
    ...(parsed.data.departmentCode !== undefined ? { departmentCode: parsed.data.departmentCode ?? null } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.parentWorkforceDepartmentId !== undefined ? { parentWorkforceDepartmentId: parsed.data.parentWorkforceDepartmentId ?? null } : {}),
    ...(parsed.data.managerUserId !== undefined ? { managerUserId: parsed.data.managerUserId ?? null } : {}),
    ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null } : {}),
    ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
  } as Record<string, unknown>
  const updated = await updateWorkforceRow<typeof workforceDepartments.$inferSelect>({
    c, bizId, tableKey: 'workforceDepartments', subjectType: 'workforce_department', id: workforceDepartmentId, patch, notFoundMessage: 'Workforce department not found.',
  })
  if (updated instanceof Response) return updated
  return ok(c, updated)
})

workforceRoutes.get('/bizes/:bizId/workforce-positions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.workforcePositions.findMany({ where: eq(workforcePositions.bizId, bizId), orderBy: [asc(workforcePositions.title)] })
  return ok(c, rows)
})

workforceRoutes.post('/bizes/:bizId/workforce-positions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = positionBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkforceRow<typeof workforcePositions.$inferSelect>({
    c, bizId, tableKey: 'workforcePositions', subjectType: 'workforce_position', displayName: parsed.data.title, data: {
      bizId,
      workforceDepartmentId: parsed.data.workforceDepartmentId ?? null,
      locationId: parsed.data.locationId ?? null,
      title: sanitizePlainText(parsed.data.title),
      positionCode: sanitizePlainText(parsed.data.positionCode),
      status: parsed.data.status,
      employmentClass: parsed.data.employmentClass,
      timeCommitment: parsed.data.timeCommitment,
      reportsToWorkforcePositionId: parsed.data.reportsToWorkforcePositionId ?? null,
      headcountTarget: parsed.data.headcountTarget,
      headcountFilled: parsed.data.headcountFilled,
      isHiringEnabled: parsed.data.isHiringEnabled,
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      requirements: sanitizeUnknown(parsed.data.requirements ?? {}),
      compensationBand: sanitizeUnknown(parsed.data.compensationBand ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workforceRoutes.patch('/bizes/:bizId/workforce-positions/:workforcePositionId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforcePositionId } = c.req.param()
  const parsed = positionPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const patch = {
    ...(parsed.data.workforceDepartmentId !== undefined ? { workforceDepartmentId: parsed.data.workforceDepartmentId ?? null } : {}),
    ...(parsed.data.locationId !== undefined ? { locationId: parsed.data.locationId ?? null } : {}),
    ...(parsed.data.title !== undefined ? { title: sanitizePlainText(parsed.data.title) } : {}),
    ...(parsed.data.positionCode !== undefined ? { positionCode: sanitizePlainText(parsed.data.positionCode) } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.employmentClass !== undefined ? { employmentClass: parsed.data.employmentClass } : {}),
    ...(parsed.data.timeCommitment !== undefined ? { timeCommitment: parsed.data.timeCommitment } : {}),
    ...(parsed.data.reportsToWorkforcePositionId !== undefined ? { reportsToWorkforcePositionId: parsed.data.reportsToWorkforcePositionId ?? null } : {}),
    ...(parsed.data.headcountTarget !== undefined ? { headcountTarget: parsed.data.headcountTarget } : {}),
    ...(parsed.data.headcountFilled !== undefined ? { headcountFilled: parsed.data.headcountFilled } : {}),
    ...(parsed.data.isHiringEnabled !== undefined ? { isHiringEnabled: parsed.data.isHiringEnabled } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null } : {}),
    ...(parsed.data.requirements !== undefined ? { requirements: sanitizeUnknown(parsed.data.requirements ?? {}) } : {}),
    ...(parsed.data.compensationBand !== undefined ? { compensationBand: sanitizeUnknown(parsed.data.compensationBand ?? {}) } : {}),
    ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
  } as Record<string, unknown>
  const updated = await updateWorkforceRow<typeof workforcePositions.$inferSelect>({
    c, bizId, tableKey: 'workforcePositions', subjectType: 'workforce_position', id: workforcePositionId, patch, notFoundMessage: 'Workforce position not found.',
  })
  if (updated instanceof Response) return updated
  return ok(c, updated)
})

workforceRoutes.get('/bizes/:bizId/workforce-assignments', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const status = c.req.query('status')
  const rows = await db.query.workforceAssignments.findMany({
    where: and(eq(workforceAssignments.bizId, bizId), status ? eq(workforceAssignments.status, status as any) : undefined),
    orderBy: [desc(workforceAssignments.startsAt)],
  })
  return ok(c, rows)
})

workforceRoutes.post('/bizes/:bizId/workforce-assignments', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = assignmentBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  if (!parsed.data.userId && !parsed.data.resourceId) return fail(c, 'VALIDATION_ERROR', 'Either userId or resourceId is required.', 400)
  const created = await createWorkforceRow<typeof workforceAssignments.$inferSelect>({
    c, bizId, tableKey: 'workforceAssignments', subjectType: 'workforce_assignment', displayName: parsed.data.assignmentTitle ?? parsed.data.userId ?? parsed.data.resourceId ?? 'assignment', data: {
      bizId,
      workforcePositionId: parsed.data.workforcePositionId,
      userId: parsed.data.userId ?? null,
      resourceId: parsed.data.resourceId ?? null,
      status: parsed.data.status,
      employmentClass: parsed.data.employmentClass,
      timeCommitment: parsed.data.timeCommitment,
      assignmentTitle: parsed.data.assignmentTitle ? sanitizePlainText(parsed.data.assignmentTitle) : null,
      managerWorkforceAssignmentId: parsed.data.managerWorkforceAssignmentId ?? null,
      compensationPlanId: parsed.data.compensationPlanId ?? null,
      leavePolicyId: parsed.data.leavePolicyId ?? null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      isPrimary: parsed.data.isPrimary,
      allocationBasisPoints: parsed.data.allocationBasisPoints,
      workPolicy: sanitizeUnknown(parsed.data.workPolicy ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workforceRoutes.patch('/bizes/:bizId/workforce-assignments/:workforceAssignmentId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforceAssignmentId } = c.req.param()
  const parsed = assignmentPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const patch = {
    ...(parsed.data.workforcePositionId !== undefined ? { workforcePositionId: parsed.data.workforcePositionId } : {}),
    ...(parsed.data.userId !== undefined ? { userId: parsed.data.userId ?? null } : {}),
    ...(parsed.data.resourceId !== undefined ? { resourceId: parsed.data.resourceId ?? null } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.employmentClass !== undefined ? { employmentClass: parsed.data.employmentClass } : {}),
    ...(parsed.data.timeCommitment !== undefined ? { timeCommitment: parsed.data.timeCommitment } : {}),
    ...(parsed.data.assignmentTitle !== undefined ? { assignmentTitle: parsed.data.assignmentTitle ? sanitizePlainText(parsed.data.assignmentTitle) : null } : {}),
    ...(parsed.data.managerWorkforceAssignmentId !== undefined ? { managerWorkforceAssignmentId: parsed.data.managerWorkforceAssignmentId ?? null } : {}),
    ...(parsed.data.compensationPlanId !== undefined ? { compensationPlanId: parsed.data.compensationPlanId ?? null } : {}),
    ...(parsed.data.leavePolicyId !== undefined ? { leavePolicyId: parsed.data.leavePolicyId ?? null } : {}),
    ...(parsed.data.startsAt !== undefined ? { startsAt: new Date(parsed.data.startsAt) } : {}),
    ...(parsed.data.endsAt !== undefined ? { endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null } : {}),
    ...(parsed.data.isPrimary !== undefined ? { isPrimary: parsed.data.isPrimary } : {}),
    ...(parsed.data.allocationBasisPoints !== undefined ? { allocationBasisPoints: parsed.data.allocationBasisPoints } : {}),
    ...(parsed.data.workPolicy !== undefined ? { workPolicy: sanitizeUnknown(parsed.data.workPolicy ?? {}) } : {}),
    ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
  } as Record<string, unknown>
  const updated = await updateWorkforceRow<typeof workforceAssignments.$inferSelect>({
    c, bizId, tableKey: 'workforceAssignments', subjectType: 'workforce_assignment', id: workforceAssignmentId, patch, notFoundMessage: 'Workforce assignment not found.',
  })
  if (updated instanceof Response) return updated
  return ok(c, updated)
})

workforceRoutes.get('/bizes/:bizId/workforce-requisitions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.workforceRequisitions.findMany({ where: eq(workforceRequisitions.bizId, bizId), orderBy: [desc(workforceRequisitions.openedAt)] })
  return ok(c, rows)
})

workforceRoutes.post('/bizes/:bizId/workforce-requisitions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = requisitionBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkforceRow<typeof workforceRequisitions.$inferSelect>({
    c, bizId, tableKey: 'workforceRequisitions', subjectType: 'workforce_requisition', displayName: parsed.data.title, data: {
      bizId,
      workforcePositionId: parsed.data.workforcePositionId ?? null,
      workforceDepartmentId: parsed.data.workforceDepartmentId ?? null,
      locationId: parsed.data.locationId ?? null,
      title: sanitizePlainText(parsed.data.title),
      status: parsed.data.status,
      openingCount: parsed.data.openingCount,
      filledCount: parsed.data.filledCount,
      priority: parsed.data.priority,
      hiringManagerUserId: parsed.data.hiringManagerUserId ?? null,
      recruiterUserId: parsed.data.recruiterUserId ?? null,
      openedAt: parsed.data.openedAt ? new Date(parsed.data.openedAt) : new Date(),
      targetHireByAt: parsed.data.targetHireByAt ? new Date(parsed.data.targetHireByAt) : null,
      closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      requirements: sanitizeUnknown(parsed.data.requirements ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workforceRoutes.patch('/bizes/:bizId/workforce-requisitions/:workforceRequisitionId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforceRequisitionId } = c.req.param()
  const parsed = requisitionPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const patch = {
    ...(parsed.data.workforcePositionId !== undefined ? { workforcePositionId: parsed.data.workforcePositionId ?? null } : {}),
    ...(parsed.data.workforceDepartmentId !== undefined ? { workforceDepartmentId: parsed.data.workforceDepartmentId ?? null } : {}),
    ...(parsed.data.locationId !== undefined ? { locationId: parsed.data.locationId ?? null } : {}),
    ...(parsed.data.title !== undefined ? { title: sanitizePlainText(parsed.data.title) } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.openingCount !== undefined ? { openingCount: parsed.data.openingCount } : {}),
    ...(parsed.data.filledCount !== undefined ? { filledCount: parsed.data.filledCount } : {}),
    ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
    ...(parsed.data.hiringManagerUserId !== undefined ? { hiringManagerUserId: parsed.data.hiringManagerUserId ?? null } : {}),
    ...(parsed.data.recruiterUserId !== undefined ? { recruiterUserId: parsed.data.recruiterUserId ?? null } : {}),
    ...(parsed.data.openedAt !== undefined ? { openedAt: parsed.data.openedAt ? new Date(parsed.data.openedAt) : null } : {}),
    ...(parsed.data.targetHireByAt !== undefined ? { targetHireByAt: parsed.data.targetHireByAt ? new Date(parsed.data.targetHireByAt) : null } : {}),
    ...(parsed.data.closedAt !== undefined ? { closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null } : {}),
    ...(parsed.data.requirements !== undefined ? { requirements: sanitizeUnknown(parsed.data.requirements ?? {}) } : {}),
    ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
  } as Record<string, unknown>
  const updated = await updateWorkforceRow<typeof workforceRequisitions.$inferSelect>({
    c, bizId, tableKey: 'workforceRequisitions', subjectType: 'workforce_requisition', id: workforceRequisitionId, patch, notFoundMessage: 'Workforce requisition not found.',
  })
  if (updated instanceof Response) return updated
  return ok(c, updated)
})

workforceRoutes.get('/bizes/:bizId/workforce-candidates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.workforceCandidates.findMany({ where: eq(workforceCandidates.bizId, bizId), orderBy: [asc(workforceCandidates.fullName)] })
  return ok(c, rows)
})

workforceRoutes.post('/bizes/:bizId/workforce-candidates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = candidateBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkforceRow<typeof workforceCandidates.$inferSelect>({
    c, bizId, tableKey: 'workforceCandidates', subjectType: 'workforce_candidate', displayName: parsed.data.fullName, data: {
      bizId,
      status: parsed.data.status,
      fullName: sanitizePlainText(parsed.data.fullName),
      primaryEmail: parsed.data.primaryEmail ?? null,
      primaryPhone: parsed.data.primaryPhone ? sanitizePlainText(parsed.data.primaryPhone) : null,
      sourceChannel: parsed.data.sourceChannel ? sanitizePlainText(parsed.data.sourceChannel) : null,
      currentCompany: parsed.data.currentCompany ? sanitizePlainText(parsed.data.currentCompany) : null,
      currentTitle: parsed.data.currentTitle ? sanitizePlainText(parsed.data.currentTitle) : null,
      locationPreference: parsed.data.locationPreference ? sanitizePlainText(parsed.data.locationPreference) : null,
      availableFromAt: parsed.data.availableFromAt ? new Date(parsed.data.availableFromAt) : null,
      resumeDocumentRef: parsed.data.resumeDocumentRef ?? null,
      profile: sanitizeUnknown(parsed.data.profile ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workforceRoutes.patch('/bizes/:bizId/workforce-candidates/:workforceCandidateId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforceCandidateId } = c.req.param()
  const parsed = candidatePatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const patch = {
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.fullName !== undefined ? { fullName: sanitizePlainText(parsed.data.fullName) } : {}),
    ...(parsed.data.primaryEmail !== undefined ? { primaryEmail: parsed.data.primaryEmail ?? null } : {}),
    ...(parsed.data.primaryPhone !== undefined ? { primaryPhone: parsed.data.primaryPhone ? sanitizePlainText(parsed.data.primaryPhone) : null } : {}),
    ...(parsed.data.sourceChannel !== undefined ? { sourceChannel: parsed.data.sourceChannel ? sanitizePlainText(parsed.data.sourceChannel) : null } : {}),
    ...(parsed.data.currentCompany !== undefined ? { currentCompany: parsed.data.currentCompany ? sanitizePlainText(parsed.data.currentCompany) : null } : {}),
    ...(parsed.data.currentTitle !== undefined ? { currentTitle: parsed.data.currentTitle ? sanitizePlainText(parsed.data.currentTitle) : null } : {}),
    ...(parsed.data.locationPreference !== undefined ? { locationPreference: parsed.data.locationPreference ? sanitizePlainText(parsed.data.locationPreference) : null } : {}),
    ...(parsed.data.availableFromAt !== undefined ? { availableFromAt: parsed.data.availableFromAt ? new Date(parsed.data.availableFromAt) : null } : {}),
    ...(parsed.data.resumeDocumentRef !== undefined ? { resumeDocumentRef: parsed.data.resumeDocumentRef ?? null } : {}),
    ...(parsed.data.profile !== undefined ? { profile: sanitizeUnknown(parsed.data.profile ?? {}) } : {}),
    ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
  } as Record<string, unknown>
  const updated = await updateWorkforceRow<typeof workforceCandidates.$inferSelect>({
    c, bizId, tableKey: 'workforceCandidates', subjectType: 'workforce_candidate', id: workforceCandidateId, patch, notFoundMessage: 'Workforce candidate not found.',
  })
  if (updated instanceof Response) return updated
  return ok(c, updated)
})

workforceRoutes.get('/bizes/:bizId/workforce-applications', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const status = c.req.query('status')
  const rows = await db.query.workforceApplications.findMany({
    where: and(eq(workforceApplications.bizId, bizId), status ? eq(workforceApplications.status, status as any) : undefined),
    orderBy: [desc(workforceApplications.appliedAt)],
  })
  return ok(c, rows)
})

workforceRoutes.post('/bizes/:bizId/workforce-applications', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = applicationBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkforceRow<typeof workforceApplications.$inferSelect>({
    c, bizId, tableKey: 'workforceApplications', subjectType: 'workforce_application', displayName: parsed.data.workforceCandidateId, data: {
      bizId,
      workforceRequisitionId: parsed.data.workforceRequisitionId,
      workforceCandidateId: parsed.data.workforceCandidateId,
      status: parsed.data.status,
      appliedAt: parsed.data.appliedAt ? new Date(parsed.data.appliedAt) : new Date(),
      assignedRecruiterUserId: parsed.data.assignedRecruiterUserId ?? null,
      decisionByUserId: parsed.data.decisionByUserId ?? null,
      decisionAt: parsed.data.decisionAt ? new Date(parsed.data.decisionAt) : null,
      desiredCompensationMinor: parsed.data.desiredCompensationMinor ?? null,
      currency: parsed.data.currency,
      hiredWorkforceAssignmentId: parsed.data.hiredWorkforceAssignmentId ?? null,
      offerPayload: sanitizeUnknown(parsed.data.offerPayload ?? {}),
      notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workforceRoutes.patch('/bizes/:bizId/workforce-applications/:workforceApplicationId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforceApplicationId } = c.req.param()
  const parsed = applicationPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const patch = {
    ...(parsed.data.workforceRequisitionId !== undefined ? { workforceRequisitionId: parsed.data.workforceRequisitionId } : {}),
    ...(parsed.data.workforceCandidateId !== undefined ? { workforceCandidateId: parsed.data.workforceCandidateId } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.appliedAt !== undefined ? { appliedAt: parsed.data.appliedAt ? new Date(parsed.data.appliedAt) : null } : {}),
    ...(parsed.data.assignedRecruiterUserId !== undefined ? { assignedRecruiterUserId: parsed.data.assignedRecruiterUserId ?? null } : {}),
    ...(parsed.data.decisionByUserId !== undefined ? { decisionByUserId: parsed.data.decisionByUserId ?? null } : {}),
    ...(parsed.data.decisionAt !== undefined ? { decisionAt: parsed.data.decisionAt ? new Date(parsed.data.decisionAt) : null } : {}),
    ...(parsed.data.desiredCompensationMinor !== undefined ? { desiredCompensationMinor: parsed.data.desiredCompensationMinor ?? null } : {}),
    ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
    ...(parsed.data.hiredWorkforceAssignmentId !== undefined ? { hiredWorkforceAssignmentId: parsed.data.hiredWorkforceAssignmentId ?? null } : {}),
    ...(parsed.data.offerPayload !== undefined ? { offerPayload: sanitizeUnknown(parsed.data.offerPayload ?? {}) } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null } : {}),
    ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
  } as Record<string, unknown>
  const updated = await updateWorkforceRow<typeof workforceApplications.$inferSelect>({
    c, bizId, tableKey: 'workforceApplications', subjectType: 'workforce_application', id: workforceApplicationId, patch, notFoundMessage: 'Workforce application not found.',
  })
  if (updated instanceof Response) return updated
  return ok(c, updated)
})

workforceRoutes.post('/bizes/:bizId/workforce-applications/:workforceApplicationId/hire', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforceApplicationId } = c.req.param()
  const parsed = hireBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  if (!parsed.data.userId && !parsed.data.resourceId) {
    return fail(c, 'VALIDATION_ERROR', 'Either userId or resourceId is required for hire workflow.', 400)
  }
  const actorUserId = getCurrentUser(c)?.id ?? null
  const hired = await db.transaction(async (tx) => {
    const application = await tx.query.workforceApplications.findFirst({
      where: and(eq(workforceApplications.bizId, bizId), eq(workforceApplications.id, workforceApplicationId)),
    })
    if (!application) return { errorCode: 'NOT_FOUND', errorMessage: 'Workforce application not found.', httpStatus: 404 } as const
    if (application.status === 'hired' && application.hiredWorkforceAssignmentId) {
      const existingAssignment = await tx.query.workforceAssignments.findFirst({
        where: and(eq(workforceAssignments.bizId, bizId), eq(workforceAssignments.id, application.hiredWorkforceAssignmentId)),
      })
      return {
        alreadyHired: true,
        application,
        assignment: existingAssignment ?? null,
      } as const
    }
    const requisition = await tx.query.workforceRequisitions.findFirst({
      where: and(eq(workforceRequisitions.bizId, bizId), eq(workforceRequisitions.id, application.workforceRequisitionId)),
    })
    if (!requisition) {
      return { errorCode: 'NOT_FOUND', errorMessage: 'Workforce requisition not found.', httpStatus: 404 } as const
    }
    const positionId = parsed.data.workforcePositionId ?? requisition.workforcePositionId
    if (!positionId) {
      return { errorCode: 'VALIDATION_ERROR', errorMessage: 'No workforce position available for hire.', httpStatus: 400 } as const
    }
    const [assignment] = await tx
      .insert(workforceAssignments)
      .values({
        bizId,
        workforcePositionId: positionId,
        userId: parsed.data.userId ?? null,
        resourceId: parsed.data.resourceId ?? null,
        status: 'active',
        employmentClass: parsed.data.employmentClass,
        timeCommitment: parsed.data.timeCommitment,
        assignmentTitle: parsed.data.assignmentTitle ? sanitizePlainText(parsed.data.assignmentTitle) : null,
        startsAt: new Date(parsed.data.startsAt),
        isPrimary: parsed.data.isPrimary,
        allocationBasisPoints: parsed.data.allocationBasisPoints,
        workPolicy: sanitizeUnknown(parsed.data.workPolicy ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      })
      .returning()

    const [updatedApplication] = await tx
      .update(workforceApplications)
      .set({
        status: 'hired',
        decisionByUserId: actorUserId,
        decisionAt: new Date(),
        hiredWorkforceAssignmentId: assignment.id,
        notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : application.notes,
      })
      .where(and(eq(workforceApplications.bizId, bizId), eq(workforceApplications.id, workforceApplicationId)))
      .returning()

    const nextFilled = Math.min(requisition.openingCount, requisition.filledCount + 1)
    const requisitionStatus = nextFilled >= requisition.openingCount ? 'filled' : requisition.status
    const [updatedRequisition] = await tx
      .update(workforceRequisitions)
      .set({
        filledCount: nextFilled,
        status: requisitionStatus,
      })
      .where(and(eq(workforceRequisitions.bizId, bizId), eq(workforceRequisitions.id, requisition.id)))
      .returning()

    const [event] = await tx
      .insert(workforceCandidateEvents)
      .values({
        bizId,
        workforceCandidateId: application.workforceCandidateId,
        workforceRequisitionId: requisition.id,
        workforceApplicationId: application.id,
        eventType: 'hired',
        occurredAt: new Date(),
        actorUserId,
        title: 'Candidate hired',
        notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
        eventPayload: sanitizeUnknown({ assignmentId: assignment.id, positionId }),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      })
      .returning()

    return {
      alreadyHired: false,
      assignment,
      application: updatedApplication,
      requisition: updatedRequisition,
      candidateEvent: event,
    } as const
  })

  if ('errorCode' in hired) return fail(c, String(hired.errorCode), String(hired.errorMessage), hired.httpStatus)
  return ok(c, hired)
})

workforceRoutes.get('/bizes/:bizId/workforce-performance-cycles', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.workforcePerformanceCycles.findMany({ where: eq(workforcePerformanceCycles.bizId, bizId), orderBy: [desc(workforcePerformanceCycles.startsAt)] })
  return ok(c, rows)
})

workforceRoutes.post('/bizes/:bizId/workforce-performance-cycles', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = performanceCycleBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkforceRow<typeof workforcePerformanceCycles.$inferSelect>({
    c, bizId, tableKey: 'workforcePerformanceCycles', subjectType: 'workforce_performance_cycle', displayName: parsed.data.name, data: {
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      status: parsed.data.status,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      calibrationDueAt: parsed.data.calibrationDueAt ? new Date(parsed.data.calibrationDueAt) : null,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
      closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
      policy: sanitizeUnknown(parsed.data.policy ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workforceRoutes.patch('/bizes/:bizId/workforce-performance-cycles/:workforcePerformanceCycleId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforcePerformanceCycleId } = c.req.param()
  const parsed = performanceCyclePatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const patch = {
    ...(parsed.data.name !== undefined ? { name: sanitizePlainText(parsed.data.name) } : {}),
    ...(parsed.data.slug !== undefined ? { slug: sanitizePlainText(parsed.data.slug) } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.startsAt !== undefined ? { startsAt: new Date(parsed.data.startsAt) } : {}),
    ...(parsed.data.endsAt !== undefined ? { endsAt: new Date(parsed.data.endsAt) } : {}),
    ...(parsed.data.calibrationDueAt !== undefined ? { calibrationDueAt: parsed.data.calibrationDueAt ? new Date(parsed.data.calibrationDueAt) : null } : {}),
    ...(parsed.data.publishedAt !== undefined ? { publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null } : {}),
    ...(parsed.data.closedAt !== undefined ? { closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null } : {}),
    ...(parsed.data.policy !== undefined ? { policy: sanitizeUnknown(parsed.data.policy ?? {}) } : {}),
    ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
  } as Record<string, unknown>
  const updated = await updateWorkforceRow<typeof workforcePerformanceCycles.$inferSelect>({
    c, bizId, tableKey: 'workforcePerformanceCycles', subjectType: 'workforce_performance_cycle', id: workforcePerformanceCycleId, patch, notFoundMessage: 'Performance cycle not found.',
  })
  if (updated instanceof Response) return updated
  return ok(c, updated)
})

workforceRoutes.get('/bizes/:bizId/workforce-performance-reviews', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const cycleId = c.req.query('workforcePerformanceCycleId')
  const rows = await db.query.workforcePerformanceReviews.findMany({
    where: and(eq(workforcePerformanceReviews.bizId, bizId), cycleId ? eq(workforcePerformanceReviews.workforcePerformanceCycleId, cycleId) : undefined),
    orderBy: [desc(workforcePerformanceReviews.completedAt), desc(workforcePerformanceReviews.submittedAt)],
  })
  return ok(c, rows)
})

workforceRoutes.post('/bizes/:bizId/workforce-performance-reviews', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = performanceReviewBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkforceRow<typeof workforcePerformanceReviews.$inferSelect>({
    c, bizId, tableKey: 'workforcePerformanceReviews', subjectType: 'workforce_performance_review', displayName: parsed.data.workforceAssignmentId, data: {
      bizId,
      workforcePerformanceCycleId: parsed.data.workforcePerformanceCycleId,
      workforceAssignmentId: parsed.data.workforceAssignmentId,
      reviewerWorkforceAssignmentId: parsed.data.reviewerWorkforceAssignmentId ?? null,
      status: parsed.data.status,
      scoreBasisPoints: parsed.data.scoreBasisPoints ?? null,
      selfAssessment: sanitizeUnknown(parsed.data.selfAssessment ?? {}),
      managerAssessment: sanitizeUnknown(parsed.data.managerAssessment ?? {}),
      goals: sanitizeUnknown(parsed.data.goals ?? {}),
      submittedAt: parsed.data.submittedAt ? new Date(parsed.data.submittedAt) : null,
      completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workforceRoutes.patch('/bizes/:bizId/workforce-performance-reviews/:workforcePerformanceReviewId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforcePerformanceReviewId } = c.req.param()
  const parsed = performanceReviewPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const patch = {
    ...(parsed.data.workforcePerformanceCycleId !== undefined ? { workforcePerformanceCycleId: parsed.data.workforcePerformanceCycleId } : {}),
    ...(parsed.data.workforceAssignmentId !== undefined ? { workforceAssignmentId: parsed.data.workforceAssignmentId } : {}),
    ...(parsed.data.reviewerWorkforceAssignmentId !== undefined ? { reviewerWorkforceAssignmentId: parsed.data.reviewerWorkforceAssignmentId ?? null } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.scoreBasisPoints !== undefined ? { scoreBasisPoints: parsed.data.scoreBasisPoints ?? null } : {}),
    ...(parsed.data.selfAssessment !== undefined ? { selfAssessment: sanitizeUnknown(parsed.data.selfAssessment ?? {}) } : {}),
    ...(parsed.data.managerAssessment !== undefined ? { managerAssessment: sanitizeUnknown(parsed.data.managerAssessment ?? {}) } : {}),
    ...(parsed.data.goals !== undefined ? { goals: sanitizeUnknown(parsed.data.goals ?? {}) } : {}),
    ...(parsed.data.submittedAt !== undefined ? { submittedAt: parsed.data.submittedAt ? new Date(parsed.data.submittedAt) : null } : {}),
    ...(parsed.data.completedAt !== undefined ? { completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null } : {}),
    ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
  } as Record<string, unknown>
  const updated = await updateWorkforceRow<typeof workforcePerformanceReviews.$inferSelect>({
    c, bizId, tableKey: 'workforcePerformanceReviews', subjectType: 'workforce_performance_review', id: workforcePerformanceReviewId, patch, notFoundMessage: 'Performance review not found.',
  })
  if (updated instanceof Response) return updated
  return ok(c, updated)
})

workforceRoutes.get('/bizes/:bizId/workforce-benefit-plans', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.workforceBenefitPlans.findMany({ where: eq(workforceBenefitPlans.bizId, bizId), orderBy: [asc(workforceBenefitPlans.name)] })
  return ok(c, rows)
})

workforceRoutes.post('/bizes/:bizId/workforce-benefit-plans', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = benefitPlanBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkforceRow<typeof workforceBenefitPlans.$inferSelect>({
    c, bizId, tableKey: 'workforceBenefitPlans', subjectType: 'workforce_benefit_plan', displayName: parsed.data.name, data: {
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      status: parsed.data.status,
      benefitType: sanitizePlainText(parsed.data.benefitType),
      providerName: parsed.data.providerName ? sanitizePlainText(parsed.data.providerName) : null,
      currency: parsed.data.currency,
      employerContributionMinor: parsed.data.employerContributionMinor,
      employeeContributionMinor: parsed.data.employeeContributionMinor,
      effectiveAt: new Date(parsed.data.effectiveAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      eligibilityPolicy: sanitizeUnknown(parsed.data.eligibilityPolicy ?? {}),
      coveragePolicy: sanitizeUnknown(parsed.data.coveragePolicy ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workforceRoutes.patch('/bizes/:bizId/workforce-benefit-plans/:workforceBenefitPlanId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforceBenefitPlanId } = c.req.param()
  const parsed = benefitPlanPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const patch = {
    ...(parsed.data.name !== undefined ? { name: sanitizePlainText(parsed.data.name) } : {}),
    ...(parsed.data.slug !== undefined ? { slug: sanitizePlainText(parsed.data.slug) } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.benefitType !== undefined ? { benefitType: sanitizePlainText(parsed.data.benefitType) } : {}),
    ...(parsed.data.providerName !== undefined ? { providerName: parsed.data.providerName ? sanitizePlainText(parsed.data.providerName) : null } : {}),
    ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
    ...(parsed.data.employerContributionMinor !== undefined ? { employerContributionMinor: parsed.data.employerContributionMinor } : {}),
    ...(parsed.data.employeeContributionMinor !== undefined ? { employeeContributionMinor: parsed.data.employeeContributionMinor } : {}),
    ...(parsed.data.effectiveAt !== undefined ? { effectiveAt: new Date(parsed.data.effectiveAt) } : {}),
    ...(parsed.data.endsAt !== undefined ? { endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null } : {}),
    ...(parsed.data.eligibilityPolicy !== undefined ? { eligibilityPolicy: sanitizeUnknown(parsed.data.eligibilityPolicy ?? {}) } : {}),
    ...(parsed.data.coveragePolicy !== undefined ? { coveragePolicy: sanitizeUnknown(parsed.data.coveragePolicy ?? {}) } : {}),
    ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
  } as Record<string, unknown>
  const updated = await updateWorkforceRow<typeof workforceBenefitPlans.$inferSelect>({
    c, bizId, tableKey: 'workforceBenefitPlans', subjectType: 'workforce_benefit_plan', id: workforceBenefitPlanId, patch, notFoundMessage: 'Benefit plan not found.',
  })
  if (updated instanceof Response) return updated
  return ok(c, updated)
})

workforceRoutes.get('/bizes/:bizId/workforce-benefit-enrollments', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.workforceBenefitEnrollments.findMany({ where: eq(workforceBenefitEnrollments.bizId, bizId), orderBy: [desc(workforceBenefitEnrollments.electedAt)] })
  return ok(c, rows)
})

workforceRoutes.post('/bizes/:bizId/workforce-benefit-enrollments', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = benefitEnrollmentBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkforceRow<typeof workforceBenefitEnrollments.$inferSelect>({
    c, bizId, tableKey: 'workforceBenefitEnrollments', subjectType: 'workforce_benefit_enrollment', displayName: parsed.data.workforceAssignmentId, data: {
      bizId,
      workforceBenefitPlanId: parsed.data.workforceBenefitPlanId,
      workforceAssignmentId: parsed.data.workforceAssignmentId,
      status: parsed.data.status,
      coverageTier: parsed.data.coverageTier ? sanitizePlainText(parsed.data.coverageTier) : null,
      dependentCount: parsed.data.dependentCount,
      employeeContributionMinor: parsed.data.employeeContributionMinor ?? null,
      employerContributionMinor: parsed.data.employerContributionMinor ?? null,
      electedAt: parsed.data.electedAt ? new Date(parsed.data.electedAt) : new Date(),
      effectiveAt: new Date(parsed.data.effectiveAt),
      endedAt: parsed.data.endedAt ? new Date(parsed.data.endedAt) : null,
      waivedReason: parsed.data.waivedReason ? sanitizePlainText(parsed.data.waivedReason) : null,
      notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workforceRoutes.patch('/bizes/:bizId/workforce-benefit-enrollments/:workforceBenefitEnrollmentId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workforceBenefitEnrollmentId } = c.req.param()
  const parsed = benefitEnrollmentPatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const patch = {
    ...(parsed.data.workforceBenefitPlanId !== undefined ? { workforceBenefitPlanId: parsed.data.workforceBenefitPlanId } : {}),
    ...(parsed.data.workforceAssignmentId !== undefined ? { workforceAssignmentId: parsed.data.workforceAssignmentId } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.coverageTier !== undefined ? { coverageTier: parsed.data.coverageTier ? sanitizePlainText(parsed.data.coverageTier) : null } : {}),
    ...(parsed.data.dependentCount !== undefined ? { dependentCount: parsed.data.dependentCount } : {}),
    ...(parsed.data.employeeContributionMinor !== undefined ? { employeeContributionMinor: parsed.data.employeeContributionMinor ?? null } : {}),
    ...(parsed.data.employerContributionMinor !== undefined ? { employerContributionMinor: parsed.data.employerContributionMinor ?? null } : {}),
    ...(parsed.data.electedAt !== undefined ? { electedAt: parsed.data.electedAt ? new Date(parsed.data.electedAt) : null } : {}),
    ...(parsed.data.effectiveAt !== undefined ? { effectiveAt: new Date(parsed.data.effectiveAt) } : {}),
    ...(parsed.data.endedAt !== undefined ? { endedAt: parsed.data.endedAt ? new Date(parsed.data.endedAt) : null } : {}),
    ...(parsed.data.waivedReason !== undefined ? { waivedReason: parsed.data.waivedReason ? sanitizePlainText(parsed.data.waivedReason) : null } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null } : {}),
    ...(parsed.data.metadata !== undefined ? { metadata: sanitizeUnknown(parsed.data.metadata ?? {}) } : {}),
  } as Record<string, unknown>
  const updated = await updateWorkforceRow<typeof workforceBenefitEnrollments.$inferSelect>({
    c, bizId, tableKey: 'workforceBenefitEnrollments', subjectType: 'workforce_benefit_enrollment', id: workforceBenefitEnrollmentId, patch, notFoundMessage: 'Benefit enrollment not found.',
  })
  if (updated instanceof Response) return updated
  return ok(c, updated)
})
