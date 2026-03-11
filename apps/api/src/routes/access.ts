/**
 * Access / ticket routes.
 *
 * ELI5:
 * A booking can turn into a "ticket" that a person carries on their phone.
 * The ticket is not just text in booking metadata. It becomes a real access
 * artifact with:
 * - a stable artifact row,
 * - a QR-capable verification token,
 * - immutable timeline events,
 * - an optional attendance obligation for "did this person actually arrive?".
 *
 * Why this module exists:
 * - QR check-in/ticketing flows are a recurring product need,
 * - the schema already has canonical access-right tables,
 * - sagas need first-class APIs to prove issuance, delivery, scanning,
 *   check-in, no-show, reissue, and offline sync behavior through the API.
 */

import crypto from 'node:crypto'
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
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok } from './_api.js'

const {
  db,
  accessArtifacts,
  accessArtifactLinks,
  accessArtifactEvents,
  accessActionTokens,
  bookingOrders,
  bookingParticipantObligations,
  participantObligationEvents,
  outboundMessages,
  outboundMessageEvents,
  users,
} = dbPackage

const ACCESS_SYSTEM_EMAIL = 'system+access@bizing.local'
let accessSystemActorCache: { id: string; role: string; email: string } | null = null

async function ensureAccessSystemActor() {
  if (accessSystemActorCache) return accessSystemActorCache

  const existing = await db.query.users.findFirst({
    where: eq(users.email, ACCESS_SYSTEM_EMAIL),
  })
  if (existing) {
    accessSystemActorCache = {
      id: existing.id,
      role: existing.role,
      email: existing.email,
    }
    return accessSystemActorCache
  }

  const [created] = await db
    .insert(users)
    .values({
      email: ACCESS_SYSTEM_EMAIL,
      name: 'Access System Actor',
      role: 'admin',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      metadata: { source: 'routes.access.public' },
    })
    .returning()

  accessSystemActorCache = {
    id: created.id,
    role: created.role,
    email: created.email,
  }
  return accessSystemActorCache
}

const issueBookingTicketBodySchema = z.object({
  deliveryChannels: z.array(z.enum(['email', 'app'])).default(['email']),
  tokenTtlHours: z.number().int().min(1).max(24 * 365).default(24 * 30),
  ticketLabel: z.string().max(160).optional(),
  autoCreateAttendanceObligation: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const accessArtifactTypeSchema = z.enum([
  'access_grant',
  'license_key',
  'download_entitlement',
  'ticket_entitlement',
  'content_gate',
  'replay_access',
  'custom',
])

const accessArtifactStatusSchema = z.enum([
  'draft',
  'active',
  'suspended',
  'revoked',
  'expired',
  'consumed',
  'transferred',
])

const createAccessArtifactBodySchema = z.object({
  artifactType: accessArtifactTypeSchema,
  status: accessArtifactStatusSchema.default('active'),
  publicCode: z.string().max(200).optional(),
  holderUserId: z.string().optional(),
  holderGroupAccountId: z.string().optional(),
  holderSubjectType: z.string().optional(),
  holderSubjectId: z.string().optional(),
  sellableId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  transferable: z.boolean().default(false),
  usageGranted: z.number().int().min(0).optional(),
  usageRemaining: z.number().int().min(0).optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const listAccessArtifactsQuerySchema = z.object({
  artifactType: accessArtifactTypeSchema.optional(),
})

const createAccessArtifactLinkBodySchema = z.object({
  accessArtifactId: z.string().min(1),
  linkType: z.enum(['sellable', 'booking_order', 'booking_order_line', 'membership', 'entitlement_grant', 'payment_transaction', 'fulfillment_unit', 'custom_subject', 'external_reference']),
  relationKey: z.string().max(120).default('source'),
  sellableId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  bookingOrderLineId: z.string().optional(),
  membershipId: z.string().optional(),
  entitlementGrantId: z.string().optional(),
  paymentTransactionId: z.string().optional(),
  fulfillmentUnitId: z.string().optional(),
  customSubjectType: z.string().optional(),
  customSubjectId: z.string().optional(),
  externalReferenceType: z.string().optional(),
  externalReferenceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createAccessLinkBodySchema = z.object({
  accessArtifactId: z.string().min(1),
  actionType: z.enum(['verify', 'view', 'download', 'redeem', 'transfer', 'support_override']).default('verify'),
  tokenTtlHours: z.number().int().min(1).max(24 * 365).default(24 * 30),
  maxValidationCount: z.number().int().min(1).max(100).default(1),
  tokenType: z.enum(['opaque_link', 'numeric_code', 'qr_code', 'one_time_password', 'custom']).default('opaque_link'),
  requestKey: z.string().max(140).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const reissueTicketBodySchema = z.object({
  deliveryChannels: z.array(z.enum(['email', 'app'])).default(['email']),
  tokenTtlHours: z.number().int().min(1).max(24 * 365).default(24 * 30),
  reason: z.string().max(300).default('booking_details_changed'),
  metadata: z.record(z.unknown()).optional(),
})

const resolveTicketBodySchema = z
  .object({
    token: z.string().min(8).optional(),
    publicCode: z.string().min(4).optional(),
  })
  .refine((value) => Boolean(value.token || value.publicCode), {
    message: 'Either token or publicCode is required.',
  })

const scanTicketBodySchema = z
  .object({
    token: z.string().min(8).optional(),
    publicCode: z.string().min(4).optional(),
    scannerMode: z.enum(['phone_camera', 'dedicated_scanner']).default('phone_camera'),
    markCheckedIn: z.boolean().default(true),
    offlineCapturedAt: z.string().datetime().optional(),
    deviceRef: z.string().max(140).optional(),
    requestKey: z.string().max(140).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((value) => Boolean(value.token || value.publicCode), {
    message: 'Either token or publicCode is required.',
  })

const markNoShowBodySchema = z.object({
  reason: z.string().max(400).default('customer_did_not_arrive'),
  happenedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

function randomCode(prefix: string, length = 10) {
  return `${prefix}${crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase()}`
}

function hashToken(rawToken: string) {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

function makeTicketQrValue(rawToken: string) {
  return `bizing://ticket/${rawToken}`
}

async function createAccessRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null | undefined,
  tableKey: string,
  data: Record<string, unknown>,
  options?: {
    subjectType?: string
    subjectId?: string
    displayName?: string
    metadata?: Record<string, unknown>
  },
) {
  const currentUser = getCurrentUser(c)
  const actor = currentUser ?? (await ensureAccessSystemActor())
  const authSourceOverride = currentUser ? undefined : 'access_token'
  const result = await executeCrudRouteAction({
    c,
    bizId: bizId ?? null,
    tableKey,
    operation: 'create',
    data,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
    actorOverride: actor,
    authSourceOverride,
  })
  if (!result.ok) {
    return fail(c, result.code, result.message, result.httpStatus, result.details)
  }
  return result.row
}

async function updateAccessRow(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string | null | undefined,
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
  const currentUser = getCurrentUser(c)
  const actor = currentUser ?? (await ensureAccessSystemActor())
  const authSourceOverride = currentUser ? undefined : 'access_token'
  const result = await executeCrudRouteAction({
    c,
    bizId: bizId ?? null,
    tableKey,
    operation: 'update',
    id,
    patch,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    displayName: options?.displayName,
    metadata: options?.metadata,
    actorOverride: actor,
    authSourceOverride,
  })
  if (!result.ok) {
    return fail(c, result.code, result.message, result.httpStatus, result.details)
  }
  return result.row
}

/**
 * Store one simulated delivery message for ticket issuance or reissue.
 *
 * ELI5:
 * We keep delivery proof inside the API/domain so a saga can verify "did the
 * customer really receive the digital ticket?" without asking a real provider.
 */
async function createTicketDeliveryMessage(input: {
  c: Parameters<typeof executeCrudRouteAction>[0]['c']
  bizId: string
  bookingOrderId: string
  recipientUserId?: string | null
  recipientRef: string
  channel: 'email' | 'push'
  subject: string
  body: string
  accessArtifactId: string
  publicCode: string
  qrValue: string
}) {
  const message = (await createAccessRow(
    input.c,
    input.bizId,
    'outboundMessages',
    {
      bizId: input.bizId,
      channel: input.channel,
      purpose: 'transactional',
      recipientUserId: input.recipientUserId ?? null,
      recipientRef: input.recipientRef,
      status: 'delivered',
      scheduledFor: new Date(),
      sentAt: new Date(),
      deliveredAt: new Date(),
      providerKey: input.channel === 'email' ? 'simulated_email' : 'simulated_app',
      providerMessageRef: `ticket-${input.accessArtifactId}-${input.channel}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      payload: {
        subject: input.subject,
        body: input.body,
        qrValue: input.qrValue,
        publicCode: input.publicCode,
      },
      metadata: {
        bookingOrderId: input.bookingOrderId,
        accessArtifactId: input.accessArtifactId,
        publicCode: input.publicCode,
        qrValue: input.qrValue,
        eventType: 'ticket.issued',
      },
    },
    {
      subjectType: 'outbound_message',
      displayName: `Ticket delivery (${input.channel})`,
      metadata: { source: 'routes.access.createTicketDeliveryMessage' },
    },
  )) as Record<string, unknown> | Response
  if (message instanceof Response) throw new Error('Failed to create ticket delivery outbound message.')

  for (const event of [
    {
      bizId: input.bizId,
      outboundMessageId: String(message.id),
      eventType: 'queued',
      payload: { channel: input.channel },
    },
    {
      bizId: input.bizId,
      outboundMessageId: String(message.id),
      eventType: 'sent',
      payload: { channel: input.channel },
    },
    {
      bizId: input.bizId,
      outboundMessageId: String(message.id),
      eventType: 'delivered',
      payload: { recipientRef: input.recipientRef },
    },
  ]) {
    const createdEvent = await createAccessRow(input.c, input.bizId, 'outboundMessageEvents', event, {
      subjectType: 'outbound_message_event',
      subjectId: String(message.id),
      displayName: `Outbound message event (${event.eventType})`,
      metadata: { source: 'routes.access.createTicketDeliveryMessage' },
    })
    if (createdEvent instanceof Response) throw new Error('Failed to create outbound message event.')
  }

  return message
}

async function ensureAttendanceObligation(input: {
  c: Parameters<typeof executeCrudRouteAction>[0]['c']
  bizId: string
  bookingOrderId: string
  participantUserId?: string | null
  accessArtifactId: string
}) {
  if (!input.participantUserId) return null

  const existing = await db.query.bookingParticipantObligations.findFirst({
    where: and(
      eq(bookingParticipantObligations.bizId, input.bizId),
      eq(bookingParticipantObligations.bookingOrderId, input.bookingOrderId),
      eq(bookingParticipantObligations.participantUserId, input.participantUserId),
      eq(bookingParticipantObligations.obligationType, 'attendance'),
    ),
  })
  if (existing) return existing

  const created = (await createAccessRow(
    input.c,
    input.bizId,
    'bookingParticipantObligations',
    {
      bizId: input.bizId,
      bookingOrderId: input.bookingOrderId,
      participantUserId: input.participantUserId,
      obligationType: 'attendance',
      status: 'pending',
      currency: 'USD',
      amountSatisfiedMinor: 0,
      metadata: {
        accessArtifactId: input.accessArtifactId,
        sourceRoute: 'access.issue_ticket',
      },
    },
    {
      subjectType: 'booking_participant_obligation',
      displayName: 'Attendance obligation',
      metadata: { source: 'routes.access.ensureAttendanceObligation' },
    },
  )) as Record<string, unknown> | Response
  if (created instanceof Response) throw new Error('Failed to create attendance obligation.')

  const createdEvent = await createAccessRow(
    input.c,
    input.bizId,
    'participantObligationEvents',
    {
      bizId: input.bizId,
      bookingParticipantObligationId: String(created.id),
      eventType: 'created',
      actorUserId: null,
      note: 'Attendance obligation auto-created for ticketed booking.',
      metadata: {
        sourceRoute: 'access.issue_ticket',
        accessArtifactId: input.accessArtifactId,
      },
    },
    {
      subjectType: 'participant_obligation_event',
      subjectId: String(created.id),
      displayName: 'Attendance obligation created',
      metadata: { source: 'routes.access.ensureAttendanceObligation' },
    },
  )
  if (createdEvent instanceof Response) throw new Error('Failed to create attendance obligation event.')

  return created
}

async function findTicketByTokenOrCode(input: { bizId: string; token?: string; publicCode?: string }) {
  if (input.token) {
    const tokenHash = hashToken(input.token)
    const actionToken = await db.query.accessActionTokens.findFirst({
      where: and(eq(accessActionTokens.bizId, input.bizId), eq(accessActionTokens.tokenHash, tokenHash)),
    })
    if (!actionToken) return null
    const artifact = await db.query.accessArtifacts.findFirst({
      where: and(eq(accessArtifacts.bizId, input.bizId), eq(accessArtifacts.id, actionToken.accessArtifactId)),
    })
    return artifact ? { artifact, actionToken, rawToken: input.token } : null
  }

  const artifact = await db.query.accessArtifacts.findFirst({
    where: and(eq(accessArtifacts.bizId, input.bizId), eq(accessArtifacts.publicCode, input.publicCode!)),
  })
  if (!artifact) return null
  const actionToken = await db.query.accessActionTokens.findFirst({
    where: and(
      eq(accessActionTokens.bizId, input.bizId),
      eq(accessActionTokens.accessArtifactId, artifact.id),
      eq(accessActionTokens.actionType, 'verify'),
      eq(accessActionTokens.status, 'active'),
    ),
    orderBy: [asc(accessActionTokens.issuedAt)],
  })
  return { artifact, actionToken: actionToken ?? null, rawToken: null }
}

async function loadTicketContext(bizId: string, accessArtifactId: string) {
  const [links, events] = await Promise.all([
    db.query.accessArtifactLinks.findMany({
      where: and(eq(accessArtifactLinks.bizId, bizId), eq(accessArtifactLinks.accessArtifactId, accessArtifactId)),
    }),
    db.query.accessArtifactEvents.findMany({
      where: and(eq(accessArtifactEvents.bizId, bizId), eq(accessArtifactEvents.accessArtifactId, accessArtifactId)),
      orderBy: [asc(accessArtifactEvents.happenedAt)],
    }),
  ])
  const bookingLink = links.find((row) => row.linkType === 'booking_order' && row.bookingOrderId)
  const booking = bookingLink?.bookingOrderId
    ? await db.query.bookingOrders.findFirst({
        where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingLink.bookingOrderId)),
      })
    : null
  const attendanceObligation =
    booking?.customerUserId
      ? await db.query.bookingParticipantObligations.findFirst({
          where: and(
            eq(bookingParticipantObligations.bizId, bizId),
            eq(bookingParticipantObligations.bookingOrderId, booking.id),
            eq(bookingParticipantObligations.participantUserId, booking.customerUserId),
            eq(bookingParticipantObligations.obligationType, 'attendance'),
          ),
        })
      : null

  return {
    links,
    events,
    booking,
    attendanceObligation,
  }
}

export const accessRoutes = new Hono()

accessRoutes.get(
  '/bizes/:bizId/access-artifacts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bookings.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listAccessArtifactsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())

    const rows = await db.query.accessArtifacts.findMany({
      where: and(
        eq(accessArtifacts.bizId, bizId),
        parsed.data.artifactType ? eq(accessArtifacts.artifactType, parsed.data.artifactType) : undefined,
      ),
      orderBy: [asc(accessArtifacts.issuedAt)],
    })
    return ok(c, rows)
  },
)

accessRoutes.post(
  '/bizes/:bizId/access-artifacts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bookings.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createAccessArtifactBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const row = (await createAccessRow(
      c,
      bizId,
      'accessArtifacts',
      {
        bizId,
        artifactType: parsed.data.artifactType,
        status: parsed.data.status,
        publicCode: parsed.data.publicCode ?? randomCode('ACC-', 10),
        holderUserId: parsed.data.holderUserId ?? null,
        holderGroupAccountId: parsed.data.holderGroupAccountId ?? null,
        holderSubjectType: parsed.data.holderSubjectType ?? null,
        holderSubjectId: parsed.data.holderSubjectId ?? null,
        sellableId: parsed.data.sellableId ?? null,
        activatedAt: new Date(),
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        transferable: parsed.data.transferable,
        usageGranted: parsed.data.usageGranted ?? null,
        usageRemaining: parsed.data.usageRemaining ?? parsed.data.usageGranted ?? null,
        policySnapshot: parsed.data.policySnapshot ?? {},
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'access_artifact',
        displayName: parsed.data.publicCode ?? 'Access Artifact',
        metadata: { source: 'routes.access.createArtifact' },
      },
    )) as Record<string, unknown> | Response
    if (row instanceof Response) return row
    return ok(c, row, 201)
  },
)

accessRoutes.get(
  '/bizes/:bizId/access-artifacts/:artifactId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bookings.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, artifactId } = c.req.param()
    const artifact = await db.query.accessArtifacts.findFirst({ where: and(eq(accessArtifacts.bizId, bizId), eq(accessArtifacts.id, artifactId)) })
    if (!artifact) return fail(c, 'NOT_FOUND', 'Access artifact not found.', 404)
    const [links, events, tokens] = await Promise.all([
      db.query.accessArtifactLinks.findMany({ where: and(eq(accessArtifactLinks.bizId, bizId), eq(accessArtifactLinks.accessArtifactId, artifactId)) }),
      db.query.accessArtifactEvents.findMany({ where: and(eq(accessArtifactEvents.bizId, bizId), eq(accessArtifactEvents.accessArtifactId, artifactId)), orderBy: [asc(accessArtifactEvents.happenedAt)] }),
      db.query.accessActionTokens.findMany({ where: and(eq(accessActionTokens.bizId, bizId), eq(accessActionTokens.accessArtifactId, artifactId)), orderBy: [asc(accessActionTokens.issuedAt)] }),
    ])
    return ok(c, { artifact, links, events, tokens })
  },
)

accessRoutes.post(
  '/bizes/:bizId/access-artifact-links',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bookings.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createAccessArtifactLinkBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const row = (await createAccessRow(
      c,
      bizId,
      'accessArtifactLinks',
      {
        bizId,
        accessArtifactId: parsed.data.accessArtifactId,
        linkType: parsed.data.linkType,
        relationKey: parsed.data.relationKey,
        sellableId: parsed.data.sellableId ?? null,
        bookingOrderId: parsed.data.bookingOrderId ?? null,
        bookingOrderLineId: parsed.data.bookingOrderLineId ?? null,
        membershipId: parsed.data.membershipId ?? null,
        entitlementGrantId: parsed.data.entitlementGrantId ?? null,
        paymentTransactionId: parsed.data.paymentTransactionId ?? null,
        fulfillmentUnitId: parsed.data.fulfillmentUnitId ?? null,
        customSubjectType: parsed.data.customSubjectType ?? null,
        customSubjectId: parsed.data.customSubjectId ?? null,
        externalReferenceType: parsed.data.externalReferenceType ?? null,
        externalReferenceId: parsed.data.externalReferenceId ?? null,
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'access_artifact_link',
        subjectId: parsed.data.accessArtifactId,
        displayName: 'Access artifact link',
        metadata: { source: 'routes.access.createArtifactLink' },
      },
    )) as Record<string, unknown> | Response
    if (row instanceof Response) return row
    return ok(c, row, 201)
  },
)

accessRoutes.post(
  '/bizes/:bizId/access-links',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bookings.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createAccessLinkBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const rawToken = randomCode('lnk_', 24)
    const token = (await createAccessRow(
      c,
      bizId,
      'accessActionTokens',
      {
        bizId,
        accessArtifactId: parsed.data.accessArtifactId,
        actionType: parsed.data.actionType,
        tokenType: parsed.data.tokenType,
        status: 'active',
        tokenHash: hashToken(rawToken),
        tokenPreview: rawToken.slice(-6),
        maxValidationCount: parsed.data.maxValidationCount,
        expiresAt: new Date(Date.now() + parsed.data.tokenTtlHours * 60 * 60 * 1000),
        requestKey: parsed.data.requestKey ?? null,
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'access_action_token',
        subjectId: parsed.data.accessArtifactId,
        displayName: 'Access link token',
        metadata: { source: 'routes.access.createAccessLink' },
      },
    )) as Record<string, unknown> | Response
    if (token instanceof Response) return token
    return ok(c, { token, rawToken }, 201)
  },
)

accessRoutes.post(
  '/public/access/resolve',
  async (c) => {
    const parsed = resolveTicketBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const tokenHash = parsed.data.token ? hashToken(parsed.data.token) : null
    const artifact = parsed.data.token
      ? await db.query.accessActionTokens.findFirst({ where: eq(accessActionTokens.tokenHash, tokenHash!) })
      : null
    let accessArtifactId: string | null = artifact?.accessArtifactId ?? null
    let bizId: string | null = artifact?.bizId ?? null
    if (!accessArtifactId && parsed.data.publicCode) {
      const row = await db.query.accessArtifacts.findFirst({ where: eq(accessArtifacts.publicCode, parsed.data.publicCode) })
      accessArtifactId = row?.id ?? null
      bizId = row?.bizId ?? null
    }
    if (!accessArtifactId || !bizId) return fail(c, 'NOT_FOUND', 'Access artifact not found.', 404)
    const detail = await db.query.accessArtifacts.findFirst({ where: and(eq(accessArtifacts.bizId, bizId), eq(accessArtifacts.id, accessArtifactId)) })
    return ok(c, detail)
  },
)

accessRoutes.post(
  '/public/access/consume',
  async (c) => {
    const parsed = z.object({
      token: z.string().optional(),
      publicCode: z.string().optional(),
      actionType: z.enum(['verify', 'view', 'download', 'redeem', 'transfer', 'support_override']).default('verify'),
      requestKey: z.string().max(140).optional(),
      metadata: z.record(z.unknown()).optional(),
    }).refine((value) => Boolean(value.token || value.publicCode), { message: 'token or publicCode is required.' }).safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const resolved = parsed.data.token
      ? await db.query.accessActionTokens.findFirst({ where: eq(accessActionTokens.tokenHash, hashToken(parsed.data.token)) })
      : null
    const artifact = resolved
      ? await db.query.accessArtifacts.findFirst({ where: and(eq(accessArtifacts.bizId, resolved.bizId), eq(accessArtifacts.id, resolved.accessArtifactId)) })
      : await db.query.accessArtifacts.findFirst({ where: eq(accessArtifacts.publicCode, parsed.data.publicCode!) })
    if (!artifact) return fail(c, 'NOT_FOUND', 'Access artifact not found.', 404)
    if (artifact.status === 'revoked' || artifact.status === 'expired') return fail(c, 'ACCESS_DENIED', 'Access artifact is not active.', 409)
    if (
      parsed.data.actionType === 'download' &&
      typeof artifact.usageRemaining === 'number' &&
      artifact.usageRemaining <= 0
    ) {
      return fail(c, 'USAGE_EXHAUSTED', 'No remaining downloads are available for this artifact.', 409)
    }
    const event = (await createAccessRow(
      c,
      artifact.bizId,
      'accessArtifactEvents',
      {
        bizId: artifact.bizId,
        accessArtifactId: artifact.id,
        eventType: parsed.data.actionType === 'download' ? 'usage_debited' : 'verified',
        quantityDelta: parsed.data.actionType === 'download' ? -1 : 0,
        outcome: 'allowed',
        requestKey: parsed.data.requestKey ?? null,
        payload: parsed.data.metadata ?? {},
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'access_artifact_event',
        subjectId: artifact.id,
        displayName: 'Access consume event',
        metadata: { source: 'routes.access.consume' },
      },
    )) as Record<string, unknown> | Response
    if (event instanceof Response) return event
    if (parsed.data.actionType === 'download' && typeof artifact.usageRemaining === 'number') {
      const artifactUpdated = await updateAccessRow(
        c,
        artifact.bizId,
        'accessArtifacts',
        artifact.id,
        {
          usageRemaining: Math.max(0, artifact.usageRemaining - 1),
          consumedAt: artifact.usageRemaining - 1 <= 0 ? new Date() : artifact.consumedAt,
        },
        {
          subjectType: 'access_artifact',
          subjectId: artifact.id,
          displayName: 'Access artifact usage update',
          metadata: { source: 'routes.access.consume' },
        },
      )
      if (artifactUpdated instanceof Response) return artifactUpdated
    }
    return ok(c, { artifactId: artifact.id, event }, 200)
  },
)

/**
 * Issue one ticket artifact for a booking.
 *
 * Bigger purpose:
 * - turns "this booking has a QR code" into canonical rows,
 * - emits simulated delivery proof,
 * - seeds attendance tracking so later scans/no-shows are explainable.
 */
accessRoutes.post(
  '/bizes/:bizId/booking-orders/:bookingOrderId/tickets',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const parsed = issueBookingTicketBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const publicCode = randomCode('TKT-')
    const rawToken = randomCode('qr_', 30)
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + parsed.data.tokenTtlHours * 60 * 60 * 1000)
    const actorUserId = getCurrentUser(c)?.id ?? null

    const artifact = (await createAccessRow(
      c,
      bizId,
      'accessArtifacts',
      {
        bizId,
        artifactType: 'ticket_entitlement',
        status: 'active',
        publicCode,
        holderUserId: booking.customerUserId ?? null,
        issuedAt: new Date(),
        activatedAt: new Date(),
        expiresAt,
        transferable: false,
        usageGranted: 1,
        usageRemaining: 1,
        policySnapshot: {
          bookingOrderId,
          tokenTtlHours: parsed.data.tokenTtlHours,
        },
        metadata: {
          bookingOrderId,
          ticketLabel: parsed.data.ticketLabel ?? 'Booking ticket',
          ...parsed.data.metadata,
        },
      },
      {
        subjectType: 'access_artifact',
        displayName: `Ticket ${publicCode}`,
        metadata: { source: 'routes.access.issueTicket' },
      },
    )) as Record<string, unknown> | Response
    if (artifact instanceof Response) return artifact

    const link = await createAccessRow(
      c,
      bizId,
      'accessArtifactLinks',
      {
        bizId,
        accessArtifactId: String(artifact.id),
        linkType: 'booking_order',
        bookingOrderId,
        metadata: {
          sourceRoute: 'access.issue_ticket',
        },
      },
      {
        subjectType: 'access_artifact_link',
        subjectId: String(artifact.id),
        displayName: 'Ticket booking link',
        metadata: { source: 'routes.access.issueTicket' },
      },
    )
    if (link instanceof Response) return link

    const token = (await createAccessRow(
      c,
      bizId,
      'accessActionTokens',
      {
        bizId,
        accessArtifactId: String(artifact.id),
        actionType: 'verify',
        tokenType: 'qr_code',
        status: 'active',
        tokenHash,
        tokenPreview: rawToken.slice(-8),
        maxValidationCount: 1000,
        issuedAt: new Date(),
        expiresAt,
        intendedHolderUserId: booking.customerUserId ?? null,
        metadata: {
          bookingOrderId,
          sourceRoute: 'access.issue_ticket',
        },
      },
      {
        subjectType: 'access_action_token',
        subjectId: String(artifact.id),
        displayName: `Ticket token ${publicCode}`,
        metadata: { source: 'routes.access.issueTicket' },
      },
    )) as Record<string, unknown> | Response
    if (token instanceof Response) return token

    const issuedEvent = await createAccessRow(
      c,
      bizId,
      'accessArtifactEvents',
      {
        bizId,
        accessArtifactId: String(artifact.id),
        eventType: 'issued',
        happenedAt: new Date(),
        actorUserId,
        outcome: 'allowed',
        reasonCode: 'ticket_issued',
        payload: {
          bookingOrderId,
          actionTokenId: token.id,
        },
        metadata: {
          sourceRoute: 'access.issue_ticket',
        },
      },
      {
        subjectType: 'access_artifact_event',
        subjectId: String(artifact.id),
        displayName: 'Ticket issued',
        metadata: { source: 'routes.access.issueTicket' },
      },
    )
    if (issuedEvent instanceof Response) return issuedEvent

    const attendanceObligation =
      parsed.data.autoCreateAttendanceObligation
        ? await ensureAttendanceObligation({
            c,
            bizId,
            bookingOrderId,
            participantUserId: booking.customerUserId ?? null,
            accessArtifactId: String(artifact.id),
          })
        : null

    const qrValue = makeTicketQrValue(rawToken)
    const deliveryMessages = []
    const recipientRef =
      booking.customerUserId ? `user:${booking.customerUserId}` : `booking:${bookingOrderId}`
    for (const channel of parsed.data.deliveryChannels) {
      deliveryMessages.push(
        await createTicketDeliveryMessage({
          c,
          bizId,
          bookingOrderId,
          recipientUserId: booking.customerUserId ?? null,
          recipientRef,
          channel: channel === 'app' ? 'push' : 'email',
          subject: `Your ticket for booking ${bookingOrderId}`,
          body: `Present code ${publicCode} or scan the QR ticket to check in.`,
          accessArtifactId: String(artifact.id),
          publicCode,
          qrValue,
        }),
      )
    }

    return ok(
      c,
      {
        artifact,
        token: {
          id: String(token.id),
          tokenType: token.tokenType as string,
          tokenPreview: token.tokenPreview as string,
          rawToken,
          qrValue,
          expiresAt,
        },
        attendanceObligation,
        deliveryMessages,
      },
      201,
    )
  },
)

accessRoutes.get(
  '/bizes/:bizId/booking-orders/:bookingOrderId/tickets',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const links = await db.query.accessArtifactLinks.findMany({
      where: and(
        eq(accessArtifactLinks.bizId, bizId),
        eq(accessArtifactLinks.linkType, 'booking_order'),
        eq(accessArtifactLinks.bookingOrderId, bookingOrderId),
      ),
    })
    const rows = await Promise.all(
      links.map(async (link) => {
        const artifact = await db.query.accessArtifacts.findFirst({
          where: and(eq(accessArtifacts.bizId, bizId), eq(accessArtifacts.id, link.accessArtifactId)),
        })
        if (!artifact) return null
        const context = await loadTicketContext(bizId, artifact.id)
        return {
          artifact,
          ...context,
        }
      }),
    )
    return ok(c, rows.filter(Boolean))
  },
)

accessRoutes.post(
  '/bizes/:bizId/tickets/:accessArtifactId/reissue',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, accessArtifactId } = c.req.param()
    const parsed = reissueTicketBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const artifact = await db.query.accessArtifacts.findFirst({
      where: and(eq(accessArtifacts.bizId, bizId), eq(accessArtifacts.id, accessArtifactId)),
    })
    if (!artifact) return fail(c, 'NOT_FOUND', 'Ticket artifact not found.', 404)

    const context = await loadTicketContext(bizId, accessArtifactId)
    if (!context.booking) return fail(c, 'NOT_FOUND', 'Ticket is not linked to a booking order.', 404)

    const activeTokens = await db.query.accessActionTokens.findMany({
      where: and(
        eq(accessActionTokens.bizId, bizId),
        eq(accessActionTokens.accessArtifactId, accessArtifactId),
        eq(accessActionTokens.status, 'active'),
      ),
    })
    for (const activeToken of activeTokens) {
      const revoked = await updateAccessRow(
        c,
        bizId,
        'accessActionTokens',
        activeToken.id,
        {
          status: 'revoked',
          revokedAt: new Date(),
        },
        {
          subjectType: 'access_action_token',
          subjectId: accessArtifactId,
          displayName: 'Revoke active ticket token',
          metadata: { source: 'routes.access.reissueTicket' },
        },
      )
      if (revoked instanceof Response) return revoked
    }

    const rawToken = randomCode('qr_', 30)
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + parsed.data.tokenTtlHours * 60 * 60 * 1000)
    const token = (await createAccessRow(
      c,
      bizId,
      'accessActionTokens',
      {
        bizId,
        accessArtifactId,
        actionType: 'verify',
        tokenType: 'qr_code',
        status: 'active',
        tokenHash,
        tokenPreview: rawToken.slice(-8),
        maxValidationCount: 1000,
        issuedAt: new Date(),
        expiresAt,
        intendedHolderUserId: artifact.holderUserId ?? null,
        metadata: {
          bookingOrderId: context.booking.id,
          reissueReason: parsed.data.reason,
          ...parsed.data.metadata,
        },
      },
      {
        subjectType: 'access_action_token',
        subjectId: accessArtifactId,
        displayName: 'Reissued ticket token',
        metadata: { source: 'routes.access.reissueTicket' },
      },
    )) as Record<string, unknown> | Response
    if (token instanceof Response) return token

    const reissueEvent = await createAccessRow(
      c,
      bizId,
      'accessArtifactEvents',
      {
        bizId,
        accessArtifactId,
        eventType: 'reissued',
        happenedAt: new Date(),
        actorUserId: getCurrentUser(c)?.id ?? null,
        outcome: 'allowed',
        reasonCode: parsed.data.reason,
        payload: {
          bookingOrderId: context.booking.id,
          actionTokenId: token.id,
        },
        metadata: {
          sourceRoute: 'access.reissue_ticket',
        },
      },
      {
        subjectType: 'access_artifact_event',
        subjectId: accessArtifactId,
        displayName: 'Ticket reissued',
        metadata: { source: 'routes.access.reissueTicket' },
      },
    )
    if (reissueEvent instanceof Response) return reissueEvent

    const qrValue = makeTicketQrValue(rawToken)
    const deliveryMessages = []
    const recipientRef =
      context.booking.customerUserId ? `user:${context.booking.customerUserId}` : `booking:${context.booking.id}`
    for (const channel of parsed.data.deliveryChannels) {
      deliveryMessages.push(
        await createTicketDeliveryMessage({
          c,
          bizId,
          bookingOrderId: context.booking.id,
          recipientUserId: context.booking.customerUserId ?? null,
          recipientRef,
          channel: channel === 'app' ? 'push' : 'email',
          subject: `Updated ticket for booking ${context.booking.id}`,
          body: `Your ticket has been refreshed. Use code ${artifact.publicCode}.`,
          accessArtifactId,
          publicCode: artifact.publicCode ?? '',
          qrValue,
        }),
      )
    }

    return ok(c, {
      artifact,
      token: {
        id: String(token.id),
        tokenPreview: token.tokenPreview as string,
        rawToken,
        qrValue,
        expiresAt,
      },
      deliveryMessages,
    })
  },
)

accessRoutes.post('/public/bizes/:bizId/tickets/resolve', async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = resolveTicketBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const resolved = await findTicketByTokenOrCode({
    bizId,
    token: parsed.data.token,
    publicCode: parsed.data.publicCode,
  })
  if (!resolved) return fail(c, 'NOT_FOUND', 'Ticket not found.', 404)

  const context = await loadTicketContext(bizId, resolved.artifact.id)
  return ok(c, {
    artifact: resolved.artifact,
    token: resolved.actionToken
      ? {
          id: resolved.actionToken.id,
          tokenPreview: resolved.actionToken.tokenPreview,
          status: resolved.actionToken.status,
          expiresAt: resolved.actionToken.expiresAt,
        }
      : null,
    booking: context.booking,
    attendanceObligation: context.attendanceObligation,
  })
})

/**
 * Scan/verify one ticket.
 *
 * ELI5:
 * The QR code is the credential. When somebody scans it, we verify the token,
 * append an immutable event, and optionally move the booking/attendance state
 * into "checked in".
 */
accessRoutes.post('/public/bizes/:bizId/tickets/scan', async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = scanTicketBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const resolved = await findTicketByTokenOrCode({
    bizId,
    token: parsed.data.token,
    publicCode: parsed.data.publicCode,
  })
  if (!resolved || !resolved.actionToken) return fail(c, 'NOT_FOUND', 'Ticket token not found.', 404)

  const now = new Date()
  const artifact = resolved.artifact
  const token = resolved.actionToken
  if (artifact.status !== 'active' || token.status !== 'active') {
    return fail(c, 'NOT_SCANNABLE', 'Ticket is not active.', 409, {
      artifactStatus: artifact.status,
      tokenStatus: token.status,
    })
  }
  if (artifact.expiresAt && artifact.expiresAt.getTime() < now.getTime()) {
    return fail(c, 'EXPIRED', 'Ticket has expired.', 409)
  }
  if (token.expiresAt && token.expiresAt.getTime() < now.getTime()) {
    return fail(c, 'EXPIRED', 'Ticket token has expired.', 409)
  }

  const context = await loadTicketContext(bizId, artifact.id)
  const effectiveEventAt = parsed.data.offlineCapturedAt ? new Date(parsed.data.offlineCapturedAt) : now
  const requestKey =
    parsed.data.requestKey ??
    (parsed.data.deviceRef && parsed.data.offlineCapturedAt
      ? `${artifact.id}:${parsed.data.deviceRef}:${parsed.data.offlineCapturedAt}`
      : undefined)

  let existingEvent = null
  if (requestKey) {
    existingEvent = await db.query.accessArtifactEvents.findFirst({
      where: and(eq(accessArtifactEvents.bizId, bizId), eq(accessArtifactEvents.requestKey, requestKey)),
    })
  }
  if (!existingEvent) {
    const scanEvent = await createAccessRow(
      c,
      bizId,
      'accessArtifactEvents',
      {
        bizId,
        accessArtifactId: artifact.id,
        eventType: 'verified',
        happenedAt: effectiveEventAt,
        outcome: 'allowed',
        requestKey: requestKey ?? null,
        reasonCode: parsed.data.markCheckedIn ? 'ticket_checked_in' : 'ticket_verified',
        payload: {
          scannerMode: parsed.data.scannerMode,
          deviceRef: parsed.data.deviceRef ?? null,
          offlineCapturedAt: parsed.data.offlineCapturedAt ?? null,
        },
        metadata: parsed.data.metadata ?? {},
      },
      {
        subjectType: 'access_artifact_event',
        subjectId: artifact.id,
        displayName: 'Ticket verified',
        metadata: { source: 'routes.access.scanTicket' },
      },
    )
    if (scanEvent instanceof Response) return scanEvent
  }

  const tokenUpdated = await updateAccessRow(
    c,
    bizId,
    'accessActionTokens',
    token.id,
    {
      successfulValidationCount: token.successfulValidationCount + 1,
      firstValidatedAt: token.firstValidatedAt ?? effectiveEventAt,
      lastValidatedAt: effectiveEventAt,
    },
    {
      subjectType: 'access_action_token',
      subjectId: token.id,
      displayName: 'Ticket token validation counters',
      metadata: { source: 'routes.access.scanTicket' },
    },
  )
  if (tokenUpdated instanceof Response) return tokenUpdated

  if (parsed.data.markCheckedIn && context.booking) {
    const bookingUpdated = await updateAccessRow(
      c,
      bizId,
      'bookingOrders',
      context.booking.id,
      {
        status: 'checked_in',
        metadata: {
          ...(typeof context.booking.metadata === 'object' && context.booking.metadata ? context.booking.metadata : {}),
          checkedInAt: effectiveEventAt.toISOString(),
          checkInScannerMode: parsed.data.scannerMode,
          accessArtifactId: artifact.id,
        },
      },
      {
        subjectType: 'booking_order',
        subjectId: context.booking.id,
        displayName: 'Booking checked in',
        metadata: { source: 'routes.access.scanTicket' },
      },
    )
    if (bookingUpdated instanceof Response) return bookingUpdated

    if (context.attendanceObligation) {
      const obligationUpdated = await updateAccessRow(
        c,
        bizId,
        'bookingParticipantObligations',
        context.attendanceObligation.id,
        {
          status: 'satisfied',
          satisfiedAt: effectiveEventAt,
          statusReason: 'checked_in',
          metadata: {
            ...(typeof context.attendanceObligation.metadata === 'object' && context.attendanceObligation.metadata
              ? context.attendanceObligation.metadata
              : {}),
            checkedInAt: effectiveEventAt.toISOString(),
            scannerMode: parsed.data.scannerMode,
          },
        },
        {
          subjectType: 'booking_participant_obligation',
          subjectId: context.attendanceObligation.id,
          displayName: 'Attendance obligation satisfied',
          metadata: { source: 'routes.access.scanTicket' },
        },
      )
      if (obligationUpdated instanceof Response) return obligationUpdated

      const obligationEvent = await createAccessRow(
        c,
        bizId,
        'participantObligationEvents',
        {
          bizId,
          bookingParticipantObligationId: context.attendanceObligation.id,
          eventType: 'satisfied',
          note: 'Attendance obligation satisfied by ticket scan.',
          metadata: {
            accessArtifactId: artifact.id,
            scannerMode: parsed.data.scannerMode,
            offlineCapturedAt: parsed.data.offlineCapturedAt ?? null,
          },
        },
        {
          subjectType: 'participant_obligation_event',
          subjectId: context.attendanceObligation.id,
          displayName: 'Obligation satisfied event',
          metadata: { source: 'routes.access.scanTicket' },
        },
      )
      if (obligationEvent instanceof Response) return obligationEvent
    }
  }

  const refreshed = await loadTicketContext(bizId, artifact.id)
  return ok(c, {
    artifact,
    booking: refreshed.booking,
    attendanceObligation: refreshed.attendanceObligation,
    scannedAt: effectiveEventAt.toISOString(),
    offlineSynced: Boolean(parsed.data.offlineCapturedAt),
  })
})

accessRoutes.post(
  '/bizes/:bizId/booking-orders/:bookingOrderId/no-show',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('booking_orders.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, bookingOrderId } = c.req.param()
    const parsed = markNoShowBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const booking = await db.query.bookingOrders.findFirst({
      where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.id, bookingOrderId)),
    })
    if (!booking) return fail(c, 'NOT_FOUND', 'Booking order not found.', 404)

    const happenedAt = parsed.data.happenedAt ? new Date(parsed.data.happenedAt) : new Date()
    const attendanceObligation =
      booking.customerUserId
        ? await db.query.bookingParticipantObligations.findFirst({
            where: and(
              eq(bookingParticipantObligations.bizId, bizId),
              eq(bookingParticipantObligations.bookingOrderId, bookingOrderId),
              eq(bookingParticipantObligations.participantUserId, booking.customerUserId),
              eq(bookingParticipantObligations.obligationType, 'attendance'),
            ),
          })
        : null

    if (attendanceObligation) {
      const overdue = await updateAccessRow(
        c,
        bizId,
        'bookingParticipantObligations',
        attendanceObligation.id,
        {
          status: 'overdue',
          statusReason: parsed.data.reason,
          metadata: {
            ...(typeof attendanceObligation.metadata === 'object' && attendanceObligation.metadata
              ? attendanceObligation.metadata
              : {}),
            noShowAt: happenedAt.toISOString(),
            ...parsed.data.metadata,
          },
        },
        {
          subjectType: 'booking_participant_obligation',
          subjectId: attendanceObligation.id,
          displayName: 'Attendance obligation marked overdue',
          metadata: { source: 'routes.access.markNoShow' },
        },
      )
      if (overdue instanceof Response) return overdue

      const noShowEvent = await createAccessRow(
        c,
        bizId,
        'participantObligationEvents',
        {
          bizId,
          bookingParticipantObligationId: attendanceObligation.id,
          eventType: 'updated',
          note: 'Attendance marked as no-show.',
          metadata: {
            noShowAt: happenedAt.toISOString(),
            reason: parsed.data.reason,
          },
        },
        {
          subjectType: 'participant_obligation_event',
          subjectId: attendanceObligation.id,
          displayName: 'No-show obligation event',
          metadata: { source: 'routes.access.markNoShow' },
        },
      )
      if (noShowEvent instanceof Response) return noShowEvent
    }

    const ticketLinks = await db.query.accessArtifactLinks.findMany({
      where: and(
        eq(accessArtifactLinks.bizId, bizId),
        eq(accessArtifactLinks.linkType, 'booking_order'),
        eq(accessArtifactLinks.bookingOrderId, bookingOrderId),
      ),
    })

    for (const link of ticketLinks) {
      const event = await createAccessRow(
        c,
        bizId,
        'accessArtifactEvents',
        {
          bizId,
          accessArtifactId: link.accessArtifactId,
          eventType: 'verification_failed',
          happenedAt,
          outcome: 'expired',
          reasonCode: 'no_show',
          reasonText: parsed.data.reason,
          payload: parsed.data.metadata ?? {},
        },
        {
          subjectType: 'access_artifact_event',
          subjectId: link.accessArtifactId,
          displayName: 'No-show ticket event',
          metadata: { source: 'routes.access.markNoShow' },
        },
      )
      if (event instanceof Response) return event
    }

    const bookingUpdated = await updateAccessRow(
      c,
      bizId,
      'bookingOrders',
      bookingOrderId,
      {
        metadata: {
          ...(typeof booking.metadata === 'object' && booking.metadata ? booking.metadata : {}),
          noShowAt: happenedAt.toISOString(),
          noShowReason: parsed.data.reason,
        },
      },
      {
        subjectType: 'booking_order',
        subjectId: bookingOrderId,
        displayName: 'Booking no-show metadata update',
        metadata: { source: 'routes.access.markNoShow' },
      },
    )
    if (bookingUpdated instanceof Response) return bookingUpdated

    return ok(c, {
      bookingOrderId,
      noShowAt: happenedAt.toISOString(),
      attendanceObligationId: attendanceObligation?.id ?? null,
      ticketArtifactIds: ticketLinks.map((row) => row.accessArtifactId),
    })
  },
)
