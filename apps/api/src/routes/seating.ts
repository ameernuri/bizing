/**
 * Seating routes.
 *
 * ELI5:
 * These routes expose the seat-map backbone directly:
 * - a seat map is the drawing/rules for a seatable space,
 * - seats are the actual selectable spots,
 * - holds are temporary "someone is paying right now" locks,
 * - reservations are committed seat claims.
 *
 * Why this matters:
 * - ticketing and reserved-capacity use cases need concrete seat APIs,
 * - the saga runner should validate seat flows by calling the API, not by
 *   inferring state from raw tables,
 * - this route family stays generic enough for theaters, classrooms, buses,
 *   boats, custom subjects, and any future seatable layout.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, lte } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const { db, seatMaps, seatMapSeats, seatHolds, seatReservations } = dbPackage

const createSeatMapBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).default('active'),
  targetType: z.string().min(1).max(60).default('resource'),
  resourceId: z.string().optional(),
  targetSubjectType: z.string().optional(),
  targetSubjectId: z.string().optional(),
  timezone: z.string().min(1).max(50).default('UTC'),
  layout: z.record(z.unknown()).optional(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createSeatBodySchema = z.object({
  seatKey: z.string().min(1).max(120),
  sectionKey: z.string().max(80).optional(),
  rowLabel: z.string().max(60).optional(),
  columnLabel: z.string().max(60).optional(),
  gridX: z.number().int().optional(),
  gridY: z.number().int().optional(),
  sortOrder: z.number().int().min(0).default(100),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).default('active'),
  isAccessible: z.boolean().default(false),
  capacity: z.number().int().positive().default(1),
  attributes: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createHoldBodySchema = z.object({
  seatMapSeatId: z.string().min(1),
  bookingOrderId: z.string().optional(),
  bookingOrderLineId: z.string().optional(),
  queueEntryId: z.string().optional(),
  holderUserId: z.string().optional(),
  holderGroupAccountId: z.string().optional(),
  holdType: z.string().min(1).max(60).default('checkout'),
  holdState: z.string().min(1).max(40).default('held'),
  expiresAt: z.string().datetime(),
  idempotencyKey: z.string().max(200).optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateHoldBodySchema = z.object({
  holdState: z.string().min(1).max(40).optional(),
  releasedAt: z.string().datetime().optional(),
  convertedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const expireHoldsBodySchema = z.object({
  /**
   * Optional execution clock override.
   *
   * ELI5:
   * Most callers will omit this and let the server use "right now".
   * Saga tests and admin tools can provide a deterministic timestamp so they
   * can prove expiry behavior without waiting in real time.
   */
  asOf: z.string().datetime().optional(),
})

const createReservationBodySchema = z.object({
  seatMapSeatId: z.string().min(1),
  seatHoldId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  bookingOrderLineId: z.string().optional(),
  fulfillmentUnitId: z.string().optional(),
  queueEntryId: z.string().optional(),
  reservationState: z.string().min(1).max(40).default('reserved'),
  note: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const seatingRoutes = new Hono()

seatingRoutes.get('/bizes/:bizId/seat-maps', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const resourceId = c.req.query('resourceId')
  const rows = await db.query.seatMaps.findMany({
    where: and(eq(seatMaps.bizId, bizId), resourceId ? eq(seatMaps.resourceId, resourceId) : undefined),
    orderBy: [asc(seatMaps.name)],
  })
  return ok(c, rows)
})

seatingRoutes.post('/bizes/:bizId/seat-maps', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createSeatMapBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(seatMaps).values({
    bizId,
    ...parsed.data,
    resourceId: parsed.data.resourceId ?? null,
    targetSubjectType: parsed.data.targetSubjectType ?? null,
    targetSubjectId: parsed.data.targetSubjectId ?? null,
    layout: parsed.data.layout ?? {},
    policy: parsed.data.policy ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

seatingRoutes.get('/bizes/:bizId/seat-maps/:seatMapId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, seatMapId } = c.req.param()
  const row = await db.query.seatMaps.findFirst({ where: and(eq(seatMaps.bizId, bizId), eq(seatMaps.id, seatMapId)) })
  if (!row) return fail(c, 'NOT_FOUND', 'Seat map not found.', 404)
  return ok(c, row)
})

seatingRoutes.get('/bizes/:bizId/seat-maps/:seatMapId/seats', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, seatMapId } = c.req.param()
  const rows = await db.query.seatMapSeats.findMany({
    where: and(eq(seatMapSeats.bizId, bizId), eq(seatMapSeats.seatMapId, seatMapId)),
    orderBy: [asc(seatMapSeats.sortOrder), asc(seatMapSeats.seatKey)],
  })
  return ok(c, rows)
})

seatingRoutes.post('/bizes/:bizId/seat-maps/:seatMapId/seats', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, seatMapId } = c.req.param()
  const parsed = createSeatBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(seatMapSeats).values({
    bizId,
    seatMapId,
    ...parsed.data,
    sectionKey: parsed.data.sectionKey ?? null,
    rowLabel: parsed.data.rowLabel ?? null,
    columnLabel: parsed.data.columnLabel ?? null,
    gridX: parsed.data.gridX ?? null,
    gridY: parsed.data.gridY ?? null,
    attributes: parsed.data.attributes ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

seatingRoutes.get('/bizes/:bizId/seat-maps/:seatMapId/holds', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, seatMapId } = c.req.param()
  const rows = await db.query.seatHolds.findMany({
    where: and(eq(seatHolds.bizId, bizId), eq(seatHolds.seatMapId, seatMapId)),
    orderBy: [desc(seatHolds.heldAt)],
  })
  return ok(c, rows)
})

seatingRoutes.post('/bizes/:bizId/seat-maps/:seatMapId/holds', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, seatMapId } = c.req.param()
  const parsed = createHoldBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(seatHolds).values({
    bizId,
    seatMapId,
    seatMapSeatId: parsed.data.seatMapSeatId,
    bookingOrderId: parsed.data.bookingOrderId ?? null,
    bookingOrderLineId: parsed.data.bookingOrderLineId ?? null,
    queueEntryId: parsed.data.queueEntryId ?? null,
    holderUserId: parsed.data.holderUserId ?? null,
    holderGroupAccountId: parsed.data.holderGroupAccountId ?? null,
    holdType: parsed.data.holdType,
    holdState: parsed.data.holdState,
    expiresAt: new Date(parsed.data.expiresAt),
    idempotencyKey: parsed.data.idempotencyKey ?? null,
    policySnapshot: parsed.data.policySnapshot ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

seatingRoutes.patch('/bizes/:bizId/seat-holds/:seatHoldId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, seatHoldId } = c.req.param()
  const parsed = updateHoldBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.update(seatHolds).set({
    holdState: parsed.data.holdState,
    releasedAt: parsed.data.releasedAt ? new Date(parsed.data.releasedAt) : undefined,
    convertedAt: parsed.data.convertedAt ? new Date(parsed.data.convertedAt) : undefined,
    metadata: parsed.data.metadata ?? undefined,
  }).where(and(eq(seatHolds.bizId, bizId), eq(seatHolds.id, seatHoldId))).returning()
  if (!row) return fail(c, 'NOT_FOUND', 'Seat hold not found.', 404)
  return ok(c, row)
})

seatingRoutes.post('/bizes/:bizId/seat-maps/:seatMapId/holds/expire', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, seatMapId } = c.req.param()
  const parsed = expireHoldsBodySchema.safeParse(await c.req.json().catch(() => null) ?? {})
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const asOf = parsed.data.asOf ? new Date(parsed.data.asOf) : new Date()
  const expiredRows = await db.update(seatHolds).set({
    holdState: 'expired',
    releasedAt: asOf,
  }).where(and(
    eq(seatHolds.bizId, bizId),
    eq(seatHolds.seatMapId, seatMapId),
    eq(seatHolds.holdState, 'held'),
    lte(seatHolds.expiresAt, asOf),
  )).returning()

  return ok(c, {
    expiredCount: expiredRows.length,
    asOf: asOf.toISOString(),
    holds: expiredRows,
  })
})

seatingRoutes.get('/bizes/:bizId/seat-maps/:seatMapId/reservations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, seatMapId } = c.req.param()
  const rows = await db.query.seatReservations.findMany({
    where: and(eq(seatReservations.bizId, bizId), eq(seatReservations.seatMapId, seatMapId)),
    orderBy: [desc(seatReservations.reservedAt)],
  })
  return ok(c, rows)
})

seatingRoutes.post('/bizes/:bizId/seat-maps/:seatMapId/reservations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, seatMapId } = c.req.param()
  const parsed = createReservationBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(seatReservations).values({
    bizId,
    seatMapId,
    seatMapSeatId: parsed.data.seatMapSeatId,
    seatHoldId: parsed.data.seatHoldId ?? null,
    bookingOrderId: parsed.data.bookingOrderId ?? null,
    bookingOrderLineId: parsed.data.bookingOrderLineId ?? null,
    fulfillmentUnitId: parsed.data.fulfillmentUnitId ?? null,
    queueEntryId: parsed.data.queueEntryId ?? null,
    reservationState: parsed.data.reservationState,
    note: parsed.data.note ?? null,
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})
