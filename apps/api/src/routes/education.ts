/**
 * Education and multi-session program routes.
 *
 * ELI5:
 * Some businesses do not sell just one appointment. They sell a course,
 * bootcamp, corporate training, or repeating program with many sessions.
 *
 * These routes expose that model directly so the API can prove:
 * - one program can have many cohorts,
 * - one cohort can have many sessions,
 * - one learner/company attendee can be enrolled,
 * - attendance can be tracked session by session,
 * - certificates can be awarded from attendance/completion evidence.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok, parsePositiveInt } from './_api.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'

const {
  db,
  programs,
  programCohorts,
  programCohortSessions,
  cohortEnrollments,
  sessionAttendanceRecords,
  certificationTemplates,
  certificationAwards,
} = dbPackage

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

const listQuerySchema = z.object({ page: z.string().optional(), perPage: z.string().optional() })

const createProgramBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  offerVersionId: z.string().optional().nullable(),
  calendarBindingId: z.string().optional().nullable(),
  expectedDurationDays: z.number().int().positive().optional(),
  requiredAttendanceBps: z.number().int().min(0).max(10000).default(8000),
  minEnrollmentCount: z.number().int().min(0).optional(),
  curriculum: z.record(z.unknown()).optional(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createCohortBodySchema = z.object({
  programId: z.string().min(1),
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(220),
  status: z.enum(['planned', 'enrolling', 'in_progress', 'completed', 'cancelled']).default('planned'),
  enrollmentOpensAt: z.string().datetime().optional().nullable(),
  enrollmentClosesAt: z.string().datetime().optional().nullable(),
  locationId: z.string().optional().nullable(),
  leadResourceId: z.string().optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().positive().optional(),
  minEnrollment: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createSessionBodySchema = z.object({
  cohortId: z.string().min(1),
  sequence: z.number().int().positive(),
  name: z.string().min(1).max(220),
  status: z.enum(['planned', 'scheduled', 'in_progress', 'completed', 'cancelled']).default('planned'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
})

const updateSessionBodySchema = createSessionBodySchema.partial().omit({ cohortId: true, sequence: true })

const createEnrollmentBodySchema = z.object({
  cohortId: z.string().min(1),
  learnerUserId: z.string().min(1),
  bookingOrderId: z.string().optional().nullable(),
  status: z.enum(['enrolled', 'waitlisted', 'dropped', 'completed', 'failed']).default('enrolled'),
  metadata: z.record(z.unknown()).optional(),
})

const createAttendanceBodySchema = z.object({
  sessionId: z.string().min(1),
  enrollmentId: z.string().min(1),
  status: z.enum(['present', 'late', 'absent', 'excused', 'no_show', 'makeup']).default('present'),
  checkedInAt: z.string().datetime().optional().nullable(),
  checkedOutAt: z.string().datetime().optional().nullable(),
  attendedMinutes: z.number().int().min(0).optional(),
  notes: z.string().max(800).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createCertificationTemplateBodySchema = z.object({
  programId: z.string().min(1),
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  criteria: z.record(z.unknown()).default({}),
  validForDays: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const createCertificationAwardBodySchema = z.object({
  certificationTemplateId: z.string().min(1),
  enrollmentId: z.string().min(1),
  learnerUserId: z.string().min(1),
  status: z.enum(['awarded', 'revoked', 'expired']).default('awarded'),
  awardedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  certificateCode: z.string().max(120).optional(),
  evidence: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

async function createEducationRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'education' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

async function updateEducationRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'education' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

export const educationRoutes = new Hono()

educationRoutes.get('/bizes/:bizId/programs', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  const pageInfo = pagination(parsed.data)
  const [rows, countRows] = await Promise.all([
    db.query.programs.findMany({ where: eq(programs.bizId, bizId), orderBy: [asc(programs.name)], limit: pageInfo.perPage, offset: pageInfo.offset }),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(programs).where(eq(programs.bizId, bizId)),
  ])
  return ok(c, rows, 200, { pagination: { page: pageInfo.page, perPage: pageInfo.perPage, total: countRows[0]?.count ?? 0, hasMore: pageInfo.page * pageInfo.perPage < (countRows[0]?.count ?? 0) } })
})

educationRoutes.post('/bizes/:bizId/programs', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createProgramBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const createdOrResponse = await createEducationRow<typeof programs.$inferSelect>({
    c,
    bizId,
    tableKey: 'programs',
    subjectType: 'program',
    displayName: parsed.data.name,
    data: {
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      status: parsed.data.status,
      offerVersionId: parsed.data.offerVersionId ?? null,
      calendarBindingId: parsed.data.calendarBindingId ?? null,
      expectedDurationDays: parsed.data.expectedDurationDays ?? null,
      requiredAttendanceBps: parsed.data.requiredAttendanceBps,
      curriculum: sanitizeUnknown(parsed.data.curriculum ?? {}),
      policy: sanitizeUnknown({ minEnrollmentCount: parsed.data.minEnrollmentCount ?? 0, ...(parsed.data.policy ?? {}) }),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

educationRoutes.get('/bizes/:bizId/program-cohorts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  const pageInfo = pagination(parsed.data)
  const rows = await db.query.programCohorts.findMany({ where: eq(programCohorts.bizId, bizId), orderBy: [desc(programCohorts.startsAt), asc(programCohorts.code)], limit: pageInfo.perPage, offset: pageInfo.offset })
  return ok(c, rows)
})

educationRoutes.post('/bizes/:bizId/program-cohorts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createCohortBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const createdOrResponse = await createEducationRow<typeof programCohorts.$inferSelect>({
    c,
    bizId,
    tableKey: 'programCohorts',
    subjectType: 'program_cohort',
    displayName: parsed.data.name,
    data: {
      bizId,
      programId: parsed.data.programId,
      code: sanitizePlainText(parsed.data.code),
      name: sanitizePlainText(parsed.data.name),
      status: parsed.data.status,
      enrollmentOpensAt: parsed.data.enrollmentOpensAt ? new Date(parsed.data.enrollmentOpensAt) : null,
      enrollmentClosesAt: parsed.data.enrollmentClosesAt ? new Date(parsed.data.enrollmentClosesAt) : null,
      locationId: parsed.data.locationId ?? null,
      leadResourceId: parsed.data.leadResourceId ?? null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      capacity: parsed.data.capacity ?? null,
      minEnrollment: parsed.data.minEnrollment ?? null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

educationRoutes.post('/bizes/:bizId/program-sessions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createSessionBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const createdOrResponse = await createEducationRow<typeof programCohortSessions.$inferSelect>({
    c,
    bizId,
    tableKey: 'programCohortSessions',
    subjectType: 'program_session',
    displayName: parsed.data.name,
    data: {
      bizId,
      cohortId: parsed.data.cohortId,
      sequence: parsed.data.sequence,
      name: sanitizePlainText(parsed.data.name),
      status: parsed.data.status,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

educationRoutes.get('/bizes/:bizId/program-sessions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.programCohortSessions.findMany({ where: eq(programCohortSessions.bizId, bizId), orderBy: [asc(programCohortSessions.startsAt), asc(programCohortSessions.sequence)] })
  return ok(c, rows)
})

educationRoutes.patch('/bizes/:bizId/program-sessions/:sessionId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, sessionId } = c.req.param()
  const parsed = updateSessionBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.programCohortSessions.findFirst({
    where: and(eq(programCohortSessions.bizId, bizId), eq(programCohortSessions.id, sessionId)),
  })
  if (!existing) return fail(c, 'NOT_FOUND', 'Program session not found.', 404)
  const updatedOrResponse = await updateEducationRow<typeof programCohortSessions.$inferSelect>({
    c,
    bizId,
    tableKey: 'programCohortSessions',
    subjectType: 'program_session',
    id: sessionId,
    notFoundMessage: 'Program session not found.',
    patch: {
      name: parsed.data.name === undefined ? undefined : sanitizePlainText(parsed.data.name),
      status: parsed.data.status ?? undefined,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
      metadata: parsed.data.metadata === undefined ? undefined : sanitizeUnknown(parsed.data.metadata),
    },
  })
  if (updatedOrResponse instanceof Response) return updatedOrResponse
  const updated = updatedOrResponse
  return ok(c, updated)
})

educationRoutes.post('/bizes/:bizId/cohort-enrollments', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createEnrollmentBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const createdOrResponse = await createEducationRow<typeof cohortEnrollments.$inferSelect>({
    c,
    bizId,
    tableKey: 'cohortEnrollments',
    subjectType: 'cohort_enrollment',
    data: {
      bizId,
      cohortId: parsed.data.cohortId,
      learnerUserId: parsed.data.learnerUserId,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      status: parsed.data.status,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

educationRoutes.get('/bizes/:bizId/cohort-enrollments', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.cohortEnrollments.findMany({ where: eq(cohortEnrollments.bizId, bizId), orderBy: [desc(cohortEnrollments.enrolledAt)] })
  return ok(c, rows)
})

educationRoutes.post('/bizes/:bizId/session-attendance-records', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createAttendanceBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existingAttendance = await db.query.sessionAttendanceRecords.findFirst({
    where: and(
      eq(sessionAttendanceRecords.bizId, bizId),
      eq(sessionAttendanceRecords.sessionId, parsed.data.sessionId),
      eq(sessionAttendanceRecords.enrollmentId, parsed.data.enrollmentId),
    ),
  })
  const createdOrResponse = existingAttendance
    ? await updateEducationRow<typeof sessionAttendanceRecords.$inferSelect>({
        c,
        bizId,
        tableKey: 'sessionAttendanceRecords',
        subjectType: 'session_attendance_record',
        id: existingAttendance.id,
        notFoundMessage: 'Session attendance record not found.',
        patch: {
          status: parsed.data.status,
          checkedInAt: parsed.data.checkedInAt ? new Date(parsed.data.checkedInAt) : null,
          checkedOutAt: parsed.data.checkedOutAt ? new Date(parsed.data.checkedOutAt) : null,
          attendedMinutes: parsed.data.attendedMinutes ?? null,
          notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
          metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
        },
      })
    : await createEducationRow<typeof sessionAttendanceRecords.$inferSelect>({
        c,
        bizId,
        tableKey: 'sessionAttendanceRecords',
        subjectType: 'session_attendance_record',
        data: {
          bizId,
          sessionId: parsed.data.sessionId,
          enrollmentId: parsed.data.enrollmentId,
          status: parsed.data.status,
          checkedInAt: parsed.data.checkedInAt ? new Date(parsed.data.checkedInAt) : null,
          checkedOutAt: parsed.data.checkedOutAt ? new Date(parsed.data.checkedOutAt) : null,
          attendedMinutes: parsed.data.attendedMinutes ?? null,
          notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
          metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
        },
      })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

educationRoutes.get('/bizes/:bizId/session-attendance-records', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.sessionAttendanceRecords.findMany({ where: eq(sessionAttendanceRecords.bizId, bizId), orderBy: [desc(sessionAttendanceRecords.checkedInAt), desc(sessionAttendanceRecords.id)] })
  return ok(c, rows)
})

educationRoutes.get('/bizes/:bizId/cohort-enrollments/:enrollmentId/agenda', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, enrollmentId } = c.req.param()
  const enrollment = await db.query.cohortEnrollments.findFirst({
    where: and(eq(cohortEnrollments.bizId, bizId), eq(cohortEnrollments.id, enrollmentId)),
  })
  if (!enrollment) return fail(c, 'NOT_FOUND', 'Cohort enrollment not found.', 404)
  const sessions = await db.query.programCohortSessions.findMany({
    where: and(eq(programCohortSessions.bizId, bizId), eq(programCohortSessions.cohortId, enrollment.cohortId)),
    orderBy: [asc(programCohortSessions.startsAt), asc(programCohortSessions.sequence)],
  })
  const attendance = await db.query.sessionAttendanceRecords.findMany({
    where: and(eq(sessionAttendanceRecords.bizId, bizId), eq(sessionAttendanceRecords.enrollmentId, enrollmentId)),
  })
  const attendanceBySession = new Map(attendance.map((row) => [row.sessionId, row]))
  return ok(c, {
    enrollment,
    agenda: sessions.map((session) => ({
      session,
      attendance: attendanceBySession.get(session.id) ?? null,
    })),
  })
})

educationRoutes.get('/bizes/:bizId/program-cohorts/:cohortId/conflicts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, cohortId } = c.req.param()
  const sessions = await db.query.programCohortSessions.findMany({
    where: and(eq(programCohortSessions.bizId, bizId), eq(programCohortSessions.cohortId, cohortId)),
    orderBy: [asc(programCohortSessions.startsAt), asc(programCohortSessions.sequence)],
  })
  const conflicts: Array<Record<string, unknown>> = []
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      const left = sessions[i]
      const right = sessions[j]
      const overlaps = left.startsAt < right.endsAt && right.startsAt < left.endsAt
      if (!overlaps) continue
      const leftMeta = (left.metadata ?? {}) as Record<string, unknown>
      const rightMeta = (right.metadata ?? {}) as Record<string, unknown>
      const sameRoom = leftMeta.roomResourceId && rightMeta.roomResourceId && leftMeta.roomResourceId === rightMeta.roomResourceId
      const samePresenter = leftMeta.presenterResourceId && rightMeta.presenterResourceId && leftMeta.presenterResourceId === rightMeta.presenterResourceId
      if (!sameRoom && !samePresenter) continue
      conflicts.push({
        leftSessionId: left.id,
        rightSessionId: right.id,
        conflictKinds: [
          ...(sameRoom ? ['room'] : []),
          ...(samePresenter ? ['presenter'] : []),
        ],
      })
    }
  }
  return ok(c, { cohortId, conflictCount: conflicts.length, conflicts })
})

educationRoutes.post('/bizes/:bizId/certification-templates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createCertificationTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const createdOrResponse = await createEducationRow<typeof certificationTemplates.$inferSelect>({
    c,
    bizId,
    tableKey: 'certificationTemplates',
    subjectType: 'certification_template',
    displayName: parsed.data.name,
    data: {
      bizId,
      programId: parsed.data.programId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      criteria: sanitizeUnknown(parsed.data.criteria),
      validForDays: parsed.data.validForDays ?? null,
      isActive: parsed.data.isActive,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

educationRoutes.post('/bizes/:bizId/certification-awards', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createCertificationAwardBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const createdOrResponse = await createEducationRow<typeof certificationAwards.$inferSelect>({
    c,
    bizId,
    tableKey: 'certificationAwards',
    subjectType: 'certification_award',
    displayName: parsed.data.certificateCode,
    data: {
      bizId,
      certificationTemplateId: parsed.data.certificationTemplateId,
      enrollmentId: parsed.data.enrollmentId,
      learnerUserId: parsed.data.learnerUserId,
      status: parsed.data.status,
      awardedAt: parsed.data.awardedAt ? new Date(parsed.data.awardedAt) : new Date(),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      certificateCode: parsed.data.certificateCode ? sanitizePlainText(parsed.data.certificateCode) : null,
      evidence: sanitizeUnknown(parsed.data.evidence ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (createdOrResponse instanceof Response) return createdOrResponse
  const created = createdOrResponse
  return ok(c, created, 201)
})

educationRoutes.get('/bizes/:bizId/certification-awards', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.certificationAwards.findMany({ where: eq(certificationAwards.bizId, bizId), orderBy: [desc(certificationAwards.awardedAt)] })
  return ok(c, rows)
})
