/**
 * Work management routes.
 *
 * ELI5:
 * Some work is not "a customer booking".
 * It is a report, checklist, inspection, timesheet, or site log.
 *
 * These routes expose that operational backbone directly so field/construction/
 * staffing sagas can prove real work capture without inventing side tables.
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
  workTemplates,
  workRuns,
  workEntries,
  workArtifacts,
  workTimeSegments,
  workTimeSegmentAllocations,
} = dbPackage

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

const listQuerySchema = z.object({ page: z.string().optional(), perPage: z.string().optional() })

const createTemplateBodySchema = z.object({
  kind: z.enum(['report', 'timesheet', 'checklist', 'inspection', 'punch_list', 'signoff', 'form', 'custom']),
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  version: z.number().int().positive().default(1),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  isCurrent: z.boolean().default(true),
  title: z.string().max(320).optional(),
  description: z.string().optional(),
  schema: z.record(z.unknown()).default({}),
  policy: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).optional(),
})

const createRunBodySchema = z.object({
  workTemplateId: z.string().min(1),
  targetType: z.enum(['biz', 'location', 'user', 'group_account', 'resource', 'service', 'service_product', 'offer', 'offer_version', 'product', 'sellable', 'booking_order', 'booking_order_line', 'fulfillment_unit', 'payment_intent', 'queue_entry', 'trip', 'custom']),
  targetRefId: z.string().min(1).max(140),
  locationId: z.string().optional().nullable(),
  resourceId: z.string().optional().nullable(),
  assigneeUserId: z.string().optional().nullable(),
  assigneeGroupAccountId: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'submitted', 'approved', 'rejected', 'completed', 'cancelled', 'archived']).default('draft'),
  priority: z.number().int().min(0).default(100),
  dueAt: z.string().datetime().optional().nullable(),
  policySnapshot: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).optional(),
})

const createEntryBodySchema = z.object({
  workRunId: z.string().min(1),
  workRunStepId: z.string().optional().nullable(),
  entryType: z.enum(['note', 'labor', 'material', 'expense', 'mileage', 'incident', 'weather', 'measurement', 'custom']),
  status: z.enum(['logged', 'submitted', 'approved', 'rejected', 'voided']).default('logged'),
  occurredAt: z.string().datetime().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  durationMin: z.number().int().min(0).optional(),
  quantity: z.union([z.number(), z.string()]).optional(),
  quantityUnit: z.string().max(40).optional(),
  amountMinor: z.number().int().min(0).optional(),
  currency: z.string().length(3).default('USD'),
  geoLat: z.number().min(-90).max(90).optional(),
  geoLng: z.number().min(-180).max(180).optional(),
  note: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).optional(),
})

const createArtifactBodySchema = z.object({
  workRunId: z.string().min(1),
  workEntryId: z.string().optional().nullable(),
  artifactType: z.enum(['file', 'image', 'video', 'audio', 'pdf', 'signature', 'other']),
  storageRef: z.string().min(1).max(600),
  fileName: z.string().max(260).optional(),
  mimeType: z.string().max(160).optional(),
  fileSizeBytes: z.number().int().min(0).optional(),
  sha256: z.string().max(128).optional(),
  geoLat: z.number().min(-90).max(90).optional(),
  geoLng: z.number().min(-180).max(180).optional(),
  annotations: z.record(z.unknown()).default({}),
  capturedAt: z.string().datetime().optional().nullable(),
  capturedByUserId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const createTimeSegmentBodySchema = z.object({
  workRunId: z.string().min(1),
  userId: z.string().min(1),
  segmentType: z.enum(['work', 'break', 'travel', 'standby', 'overtime']).default('work'),
  clockSource: z.enum(['mobile', 'kiosk', 'web', 'api', 'import']).default('mobile'),
  clockInAt: z.string().datetime(),
  clockOutAt: z.string().datetime().optional().nullable(),
  breakMinutes: z.number().int().min(0).default(0),
  clockInLat: z.number().min(-90).max(90).optional(),
  clockInLng: z.number().min(-180).max(180).optional(),
  clockOutLat: z.number().min(-90).max(90).optional(),
  clockOutLng: z.number().min(-180).max(180).optional(),
  isClockInWithinGeofence: z.boolean().optional(),
  isClockOutWithinGeofence: z.boolean().optional(),
  geofencePolicyRef: z.string().max(200).optional(),
  correctionNote: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createTimeSegmentAllocationBodySchema = z.object({
  workTimeSegmentId: z.string().min(1),
  staffingAssignmentId: z.string().min(1),
  allocatedMinutes: z.number().int().min(0).optional(),
  allocationBps: z.number().int().min(1).max(10000).optional(),
  note: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine((value) => value.allocatedMinutes !== undefined || value.allocationBps !== undefined, {
  message: 'Either allocatedMinutes or allocationBps is required.',
})

export const workManagementRoutes = new Hono()

async function createWorkManagementRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'work-management' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

workManagementRoutes.get('/bizes/:bizId/work-templates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  const pageInfo = pagination(parsed.data)
  const [rows, countRows] = await Promise.all([
    db.query.workTemplates.findMany({ where: eq(workTemplates.bizId, bizId), orderBy: [asc(workTemplates.slug), desc(workTemplates.version)], limit: pageInfo.perPage, offset: pageInfo.offset }),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(workTemplates).where(eq(workTemplates.bizId, bizId)),
  ])
  return ok(c, rows, 200, { pagination: { page: pageInfo.page, perPage: pageInfo.perPage, total: countRows[0]?.count ?? 0, hasMore: pageInfo.page * pageInfo.perPage < (countRows[0]?.count ?? 0) } })
})

workManagementRoutes.post('/bizes/:bizId/work-templates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkManagementRow<typeof workTemplates.$inferSelect>({
    c,
    bizId,
    tableKey: 'workTemplates',
    subjectType: 'work_template',
    displayName: parsed.data.name,
    data: {
    bizId,
    kind: parsed.data.kind,
    name: sanitizePlainText(parsed.data.name),
    slug: sanitizePlainText(parsed.data.slug),
    version: parsed.data.version,
    status: parsed.data.status,
    isCurrent: parsed.data.isCurrent,
    title: parsed.data.title ? sanitizePlainText(parsed.data.title) : null,
    description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
    schema: sanitizeUnknown(parsed.data.schema),
    policy: sanitizeUnknown(parsed.data.policy),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workManagementRoutes.get('/bizes/:bizId/work-runs', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.workRuns.findMany({ where: eq(workRuns.bizId, bizId), orderBy: [desc(workRuns.dueAt), desc(workRuns.id)] })
  return ok(c, rows)
})

workManagementRoutes.post('/bizes/:bizId/work-runs', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createRunBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkManagementRow<typeof workRuns.$inferSelect>({
    c,
    bizId,
    tableKey: 'workRuns',
    subjectType: 'work_run',
    displayName: parsed.data.targetType,
    data: {
    bizId,
    workTemplateId: parsed.data.workTemplateId,
    targetType: parsed.data.targetType,
    targetRefId: sanitizePlainText(parsed.data.targetRefId),
    locationId: parsed.data.locationId ?? null,
    resourceId: parsed.data.resourceId ?? null,
    assigneeUserId: parsed.data.assigneeUserId ?? null,
    assigneeGroupAccountId: parsed.data.assigneeGroupAccountId ?? null,
    status: parsed.data.status,
    priority: parsed.data.priority,
    dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
    policySnapshot: sanitizeUnknown(parsed.data.policySnapshot),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workManagementRoutes.get('/bizes/:bizId/work-runs/:workRunId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, workRunId } = c.req.param()
  const run = await db.query.workRuns.findFirst({ where: and(eq(workRuns.bizId, bizId), eq(workRuns.id, workRunId)) })
  if (!run) return fail(c, 'NOT_FOUND', 'Work run not found.', 404)
  const [entries, artifacts, timeSegments] = await Promise.all([
    db.query.workEntries.findMany({ where: and(eq(workEntries.bizId, bizId), eq(workEntries.workRunId, workRunId)), orderBy: [asc(workEntries.occurredAt)] }),
    db.query.workArtifacts.findMany({ where: and(eq(workArtifacts.bizId, bizId), eq(workArtifacts.workRunId, workRunId)), orderBy: [asc(workArtifacts.capturedAt)] }),
    db.query.workTimeSegments.findMany({ where: and(eq(workTimeSegments.bizId, bizId), eq(workTimeSegments.workRunId, workRunId)), orderBy: [asc(workTimeSegments.clockInAt)] }),
  ])
  return ok(c, { run, entries, artifacts, timeSegments })
})

workManagementRoutes.post('/bizes/:bizId/work-entries', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createEntryBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkManagementRow<typeof workEntries.$inferSelect>({
    c,
    bizId,
    tableKey: 'workEntries',
    subjectType: 'work_entry',
    displayName: parsed.data.entryType,
    data: {
    bizId,
    workRunId: parsed.data.workRunId,
    workRunStepId: parsed.data.workRunStepId ?? null,
    entryType: parsed.data.entryType,
    status: parsed.data.status,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
    startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
    endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    durationMin: parsed.data.durationMin ?? null,
    quantity: parsed.data.quantity === undefined ? null : String(parsed.data.quantity),
    quantityUnit: parsed.data.quantityUnit ? sanitizePlainText(parsed.data.quantityUnit) : null,
    amountMinor: parsed.data.amountMinor ?? null,
    currency: parsed.data.currency.toUpperCase(),
    geoLat: parsed.data.geoLat ?? null,
    geoLng: parsed.data.geoLng ?? null,
    note: parsed.data.note ? sanitizePlainText(parsed.data.note) : null,
    payload: sanitizeUnknown(parsed.data.payload),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workManagementRoutes.post('/bizes/:bizId/work-artifacts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createArtifactBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkManagementRow<typeof workArtifacts.$inferSelect>({
    c,
    bizId,
    tableKey: 'workArtifacts',
    subjectType: 'work_artifact',
    displayName: parsed.data.artifactType,
    data: {
    bizId,
    workRunId: parsed.data.workRunId,
    workEntryId: parsed.data.workEntryId ?? null,
    artifactType: parsed.data.artifactType,
    storageRef: sanitizePlainText(parsed.data.storageRef),
    fileName: parsed.data.fileName ? sanitizePlainText(parsed.data.fileName) : null,
    mimeType: parsed.data.mimeType ? sanitizePlainText(parsed.data.mimeType) : null,
    fileSizeBytes: parsed.data.fileSizeBytes ?? null,
    sha256: parsed.data.sha256 ? sanitizePlainText(parsed.data.sha256) : null,
    geoLat: parsed.data.geoLat ?? null,
    geoLng: parsed.data.geoLng ?? null,
    annotations: sanitizeUnknown(parsed.data.annotations),
    capturedAt: parsed.data.capturedAt ? new Date(parsed.data.capturedAt) : new Date(),
    capturedByUserId: parsed.data.capturedByUserId ?? null,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workManagementRoutes.post('/bizes/:bizId/work-time-segments', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createTimeSegmentBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkManagementRow<typeof workTimeSegments.$inferSelect>({
    c,
    bizId,
    tableKey: 'workTimeSegments',
    subjectType: 'work_time_segment',
    displayName: parsed.data.segmentType,
    data: {
    bizId,
    workRunId: parsed.data.workRunId,
    userId: parsed.data.userId,
    segmentType: parsed.data.segmentType,
    clockSource: parsed.data.clockSource,
    clockInAt: new Date(parsed.data.clockInAt),
    clockOutAt: parsed.data.clockOutAt ? new Date(parsed.data.clockOutAt) : null,
    breakMinutes: parsed.data.breakMinutes,
    clockInLat: parsed.data.clockInLat ?? null,
    clockInLng: parsed.data.clockInLng ?? null,
    clockOutLat: parsed.data.clockOutLat ?? null,
    clockOutLng: parsed.data.clockOutLng ?? null,
    isClockInWithinGeofence: parsed.data.isClockInWithinGeofence ?? null,
    isClockOutWithinGeofence: parsed.data.isClockOutWithinGeofence ?? null,
    geofencePolicyRef: parsed.data.geofencePolicyRef ? sanitizePlainText(parsed.data.geofencePolicyRef) : null,
    approvedByUserId: null,
    approvedAt: null,
    correctionNote: parsed.data.correctionNote ? sanitizePlainText(parsed.data.correctionNote) : null,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})

workManagementRoutes.get('/bizes/:bizId/work-time-segment-allocations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const workTimeSegmentId = c.req.query('workTimeSegmentId')
  const staffingAssignmentId = c.req.query('staffingAssignmentId')
  const rows = await db.query.workTimeSegmentAllocations.findMany({
    where: and(
      eq(workTimeSegmentAllocations.bizId, bizId),
      workTimeSegmentId ? eq(workTimeSegmentAllocations.workTimeSegmentId, workTimeSegmentId) : undefined,
      staffingAssignmentId ? eq(workTimeSegmentAllocations.staffingAssignmentId, staffingAssignmentId) : undefined,
    ),
    orderBy: [asc(workTimeSegmentAllocations.id)],
  })
  return ok(c, rows)
})

workManagementRoutes.post('/bizes/:bizId/work-time-segment-allocations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createTimeSegmentAllocationBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const created = await createWorkManagementRow<typeof workTimeSegmentAllocations.$inferSelect>({
    c,
    bizId,
    tableKey: 'workTimeSegmentAllocations',
    subjectType: 'work_time_segment_allocation',
    displayName: parsed.data.workTimeSegmentId,
    data: {
    bizId,
    workTimeSegmentId: parsed.data.workTimeSegmentId,
    staffingAssignmentId: parsed.data.staffingAssignmentId,
    allocatedMinutes: parsed.data.allocatedMinutes ?? null,
    allocationBps: parsed.data.allocationBps ?? null,
    note: parsed.data.note ? sanitizePlainText(parsed.data.note) : null,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  })
  if (created instanceof Response) return created
  return ok(c, created, 201)
})
