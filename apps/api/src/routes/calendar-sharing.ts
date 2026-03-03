/**
 * Calendar sharing / external calendar routes.
 *
 * ELI5:
 * A user owns their calendars. They can connect external providers once, pick
 * which feeds matter, and then grant each biz a different visibility contract.
 *
 * These routes turn that schema into API proof surfaces for:
 * - one user sharing one or many calendar sources with a biz,
 * - time-boxed/revocable grants,
 * - free/busy vs detailed visibility,
 * - optional write-back permission for busy blocks.
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'

const {
  db,
  calendarSyncConnections,
  externalCalendars,
  externalCalendarEvents,
  calendarAccessGrants,
  calendarAccessGrantSources,
} = dbPackage

async function createCalendarSharingRow<
  TTableKey extends
    | 'calendarSyncConnections'
    | 'externalCalendars'
    | 'externalCalendarEvents'
    | 'calendarAccessGrants'
    | 'calendarAccessGrantSources',
>(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  tableKey: TTableKey,
  data: Parameters<typeof executeCrudRouteAction>[0]['data'],
  meta: { subjectType: string; subjectId: string; displayName: string; source: string },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId: null,
    tableKey,
    operation: 'create',
    data,
    subjectType: meta.subjectType,
    subjectId: meta.subjectId,
    displayName: meta.displayName,
    metadata: { source: meta.source },
  })
  if (!result.ok) throw new Error(result.message ?? `Failed to create ${tableKey}`)
  if (!result.row) throw new Error(`Missing row for ${tableKey} create`)
  return result.row
}

async function updateCalendarGrantRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  grantId: string,
  patch: Parameters<typeof executeCrudRouteAction>[0]['patch'],
) {
  const result = await executeCrudRouteAction({
    c,
    bizId: null,
    tableKey: 'calendarAccessGrants',
    operation: 'update',
    id: grantId,
    subjectType: 'calendar_access_grant',
    subjectId: grantId,
    displayName: 'update grant',
    patch,
    metadata: { source: 'routes.calendarSharing.updateGrant' },
  })
  if (!result.ok) {
    if (result.code === 'CRUD_TARGET_NOT_FOUND') return null
    throw new Error(result.message ?? 'Failed to update calendar access grant')
  }
  if (!result.row) return null
  return result.row
}

const createConnectionBodySchema = z.object({
  provider: z.enum(['google', 'microsoft', 'apple', 'ical', 'other']),
  providerAccountRef: z.string().min(1).max(255),
  displayName: z.string().max(255).optional(),
  authSecretRef: z.string().min(1).max(255),
  refreshSecretRef: z.string().max(255).optional(),
  grantedScopes: z.array(z.string()).default([]),
  providerTimezone: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createExternalCalendarBodySchema = z.object({
  calendarSyncConnectionId: z.string().min(1),
  providerCalendarRef: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  description: z.string().max(600).optional(),
  timezone: z.string().max(50).default('UTC'),
  color: z.string().max(32).optional(),
  isPrimary: z.boolean().default(false),
  isSelectedForSync: z.boolean().default(true),
  isReadOnly: z.boolean().default(false),
  syncState: z.enum(['pending', 'active', 'paused', 'error']).default('pending'),
  metadata: z.record(z.unknown()).optional(),
})

const createGrantBodySchema = z.object({
  granteeBizId: z.string().min(1),
  status: z.enum(['granted', 'revoked', 'expired']).default('granted'),
  accessLevel: z.enum(['free_busy', 'masked_details', 'full_details']).default('free_busy'),
  scope: z.enum(['all_sources', 'selected_sources']).default('all_sources'),
  allowAvailabilityComputation: z.boolean().default(true),
  allowConflictDetection: z.boolean().default(true),
  allowWriteBackBusyBlocks: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
  reason: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createGrantSourceBodySchema = z.object({
  calendarAccessGrantId: z.string().min(1),
  sourceType: z.enum(['external_calendar', 'internal_user_calendar_binding']),
  externalCalendarId: z.string().optional(),
  sourceBizId: z.string().optional(),
  calendarBindingId: z.string().optional(),
  isIncluded: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.sourceType === 'external_calendar' && !value.externalCalendarId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'externalCalendarId is required.' })
  if (value.sourceType === 'internal_user_calendar_binding' && (!value.sourceBizId || !value.calendarBindingId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sourceBizId and calendarBindingId are required.' })
})

const createExternalEventBodySchema = z.object({
  externalCalendarId: z.string().min(1),
  providerEventRef: z.string().min(1).max(255),
  iCalUid: z.string().max(255).optional(),
  eventStatus: z.enum(['confirmed', 'tentative', 'cancelled']).default('confirmed'),
  busyStatus: z.enum(['busy', 'free', 'tentative', 'out_of_office', 'unknown']).default('busy'),
  title: z.string().max(500).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isAllDay: z.boolean().default(false),
  sourceCreatedAt: z.string().datetime().optional(),
  sourceUpdatedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
  payload: z.record(z.unknown()).optional(),
})

export const calendarSharingRoutes = new Hono()

calendarSharingRoutes.get('/users/me/calendar-sync-connections', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const rows = await db.query.calendarSyncConnections.findMany({
    where: eq(calendarSyncConnections.ownerUserId, user.id),
    orderBy: [asc(calendarSyncConnections.displayName)],
  })
  return ok(c, rows)
})

calendarSharingRoutes.post('/users/me/calendar-sync-connections', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = createConnectionBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await createCalendarSharingRow(
    c,
    'calendarSyncConnections',
    {
      ownerUserId: user.id,
      provider: parsed.data.provider,
      providerAccountRef: parsed.data.providerAccountRef,
      displayName: parsed.data.displayName ?? null,
      status: 'active',
      authSecretRef: parsed.data.authSecretRef,
      refreshSecretRef: parsed.data.refreshSecretRef ?? null,
      grantedScopes: parsed.data.grantedScopes,
      providerTimezone: parsed.data.providerTimezone ?? null,
      metadata: parsed.data.metadata ?? {},
    },
    {
      subjectType: 'calendar_sync_connection',
      subjectId: user.id,
      displayName: parsed.data.provider,
      source: 'routes.calendarSharing.createConnection',
    },
  )
  return ok(c, row, 201)
})

calendarSharingRoutes.get('/users/me/external-calendars', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const rows = await db.query.externalCalendars.findMany({
    where: eq(externalCalendars.ownerUserId, user.id),
    orderBy: [asc(externalCalendars.name)],
  })
  return ok(c, rows)
})

calendarSharingRoutes.post('/users/me/external-calendars', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = createExternalCalendarBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await createCalendarSharingRow(
    c,
    'externalCalendars',
    {
      ownerUserId: user.id,
      calendarSyncConnectionId: parsed.data.calendarSyncConnectionId,
      providerCalendarRef: parsed.data.providerCalendarRef,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      timezone: parsed.data.timezone,
      color: parsed.data.color ?? null,
      isPrimary: parsed.data.isPrimary,
      isSelectedForSync: parsed.data.isSelectedForSync,
      isReadOnly: parsed.data.isReadOnly,
      syncState: parsed.data.syncState,
      metadata: parsed.data.metadata ?? {},
    },
    {
      subjectType: 'external_calendar',
      subjectId: user.id,
      displayName: parsed.data.name,
      source: 'routes.calendarSharing.createExternalCalendar',
    },
  )
  return ok(c, row, 201)
})

calendarSharingRoutes.post('/users/me/external-calendar-events', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = createExternalEventBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await createCalendarSharingRow(
    c,
    'externalCalendarEvents',
    {
      ownerUserId: user.id,
      externalCalendarId: parsed.data.externalCalendarId,
      providerEventRef: parsed.data.providerEventRef,
      iCalUid: parsed.data.iCalUid ?? null,
      eventStatus: parsed.data.eventStatus,
      busyStatus: parsed.data.busyStatus,
      title: parsed.data.title ?? null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      isAllDay: parsed.data.isAllDay,
      sourceCreatedAt: parsed.data.sourceCreatedAt ? new Date(parsed.data.sourceCreatedAt) : null,
      sourceUpdatedAt: parsed.data.sourceUpdatedAt ? new Date(parsed.data.sourceUpdatedAt) : null,
      metadata: parsed.data.metadata ?? {},
      payload: parsed.data.payload ?? {},
    },
    {
      subjectType: 'external_calendar_event',
      subjectId: parsed.data.externalCalendarId,
      displayName: parsed.data.providerEventRef,
      source: 'routes.calendarSharing.createExternalEvent',
    },
  )
  return ok(c, row, 201)
})

calendarSharingRoutes.get('/users/me/calendar-access-grants', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const rows = await db.query.calendarAccessGrants.findMany({
    where: eq(calendarAccessGrants.ownerUserId, user.id),
    orderBy: [asc(calendarAccessGrants.grantedAt)],
  })
  return ok(c, rows)
})

calendarSharingRoutes.post('/users/me/calendar-access-grants', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = createGrantBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await createCalendarSharingRow(
    c,
    'calendarAccessGrants',
    {
      ownerUserId: user.id,
      granteeBizId: parsed.data.granteeBizId,
      status: parsed.data.status,
      accessLevel: parsed.data.accessLevel,
      scope: parsed.data.scope,
      allowAvailabilityComputation: parsed.data.allowAvailabilityComputation,
      allowConflictDetection: parsed.data.allowConflictDetection,
      allowWriteBackBusyBlocks: parsed.data.allowWriteBackBusyBlocks,
      grantedByUserId: user.id,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      reason: parsed.data.reason ?? null,
      metadata: parsed.data.metadata ?? {},
    },
    {
      subjectType: 'calendar_access_grant',
      subjectId: user.id,
      displayName: parsed.data.granteeBizId,
      source: 'routes.calendarSharing.createGrant',
    },
  )
  return ok(c, row, 201)
})

calendarSharingRoutes.patch('/users/me/calendar-access-grants/:grantId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const grantId = c.req.param('grantId')
  const parsed = createGrantBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const row = await updateCalendarGrantRow(c, grantId, {
    status: parsed.data.status,
    accessLevel: parsed.data.accessLevel,
    scope: parsed.data.scope,
    allowAvailabilityComputation: parsed.data.allowAvailabilityComputation,
    allowConflictDetection: parsed.data.allowConflictDetection,
    allowWriteBackBusyBlocks: parsed.data.allowWriteBackBusyBlocks,
    revokedAt: parsed.data.status === 'revoked' ? new Date() : undefined,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    reason: parsed.data.reason,
    metadata: parsed.data.metadata,
  })
  if (!row) return fail(c, 'NOT_FOUND', 'Calendar access grant not found.', 404)
  return ok(c, row)
})

calendarSharingRoutes.get('/users/me/calendar-access-grant-sources', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const grantId = c.req.query('calendarAccessGrantId')
  const rows = await db.query.calendarAccessGrantSources.findMany({
    where: and(
      eq(calendarAccessGrantSources.ownerUserId, user.id),
      grantId ? eq(calendarAccessGrantSources.calendarAccessGrantId, grantId) : undefined,
    ),
    orderBy: [asc(calendarAccessGrantSources.id)],
  })
  return ok(c, rows)
})

calendarSharingRoutes.post('/users/me/calendar-access-grant-sources', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = createGrantSourceBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const grant = await db.query.calendarAccessGrants.findFirst({
    where: and(eq(calendarAccessGrants.ownerUserId, user.id), eq(calendarAccessGrants.id, parsed.data.calendarAccessGrantId)),
  })
  if (!grant) return fail(c, 'NOT_FOUND', 'Calendar access grant not found.', 404)
  const row = await createCalendarSharingRow(
    c,
    'calendarAccessGrantSources',
    {
      ownerUserId: user.id,
      granteeBizId: grant.granteeBizId,
      calendarAccessGrantId: grant.id,
      sourceType: parsed.data.sourceType,
      externalCalendarId: parsed.data.externalCalendarId ?? null,
      sourceBizId: parsed.data.sourceBizId ?? null,
      calendarBindingId: parsed.data.calendarBindingId ?? null,
      isIncluded: parsed.data.isIncluded,
      metadata: parsed.data.metadata ?? {},
    },
    {
      subjectType: 'calendar_access_grant_source',
      subjectId: grant.id,
      displayName: parsed.data.sourceType,
      source: 'routes.calendarSharing.createGrantSource',
    },
  )
  return ok(c, row, 201)
})

calendarSharingRoutes.get(
  '/bizes/:bizId/calendar-access-grants',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('resources.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.calendarAccessGrants.findMany({
      where: eq(calendarAccessGrants.granteeBizId, bizId),
      orderBy: [asc(calendarAccessGrants.grantedAt)],
    })
    return ok(c, rows)
  },
)
