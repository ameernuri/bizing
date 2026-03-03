/**
 * CRM routes.
 *
 * ELI5:
 * These endpoints expose the "people and deals" side of the platform.
 *
 * Why this file exists:
 * - use cases talk about CRM sync, leads, and opportunities,
 * - the schema already has first-class CRM tables,
 * - but without routes, agents and UI cannot prove that CRM concepts are part
 *   of the canonical API surface.
 *
 * Design rule:
 * - keep these routes generic,
 * - do not hardcode Salesforce/HubSpot semantics into the schema,
 * - let integrations push/pull through the same canonical CRM objects.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { fail, ok, parsePositiveInt } from './_api.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'

const {
  db,
  bookingOrders,
  checkoutSessions,
  communicationConsents,
  crmContacts,
  crmLeads,
  crmOpportunities,
  crmPipelines,
  crmPipelineStages,
  instrumentRuns,
  outboundMessages,
  paymentTransactions,
  reviewQueueItems,
} = dbPackage

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

const listContactsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  contactType: z.string().optional(),
  sourceType: z.string().optional(),
})

const createContactBodySchema = z.object({
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  contactType: z.enum(['user', 'group_account', 'external']),
  userId: z.string().optional(),
  groupAccountId: z.string().optional(),
  externalContactRef: z.string().max(220).optional(),
  displayName: z.string().max(220).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(80).optional(),
  sourceType: z.string().max(80).optional(),
  sourceRef: z.string().max(220).optional(),
  profile: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.contactType === 'user' && !value.userId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'userId is required for user contacts.' })
  }
  if (value.contactType === 'group_account' && !value.groupAccountId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'groupAccountId is required for group-account contacts.' })
  }
  if (value.contactType === 'external' && !value.externalContactRef) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'externalContactRef is required for external contacts.' })
  }
})

const listLeadsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.string().optional(),
  sourceType: z.string().optional(),
  crmContactId: z.string().optional(),
})

const createLeadBodySchema = z.object({
  status: z.string().default('new'),
  sourceType: z.string().max(80).optional(),
  sourceRef: z.string().max(220).optional(),
  crmContactId: z.string(),
  locationId: z.string().optional(),
  ownerUserId: z.string().optional(),
  scoreBps: z.number().int().min(0).max(10000).default(0),
  priority: z.number().int().min(0).default(100),
  notes: z.string().max(4000).optional(),
  attributes: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const listOpportunitiesQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.string().optional(),
  ownerUserId: z.string().optional(),
  crmContactId: z.string().optional(),
})

const createOpportunityBodySchema = z.object({
  status: z.string().default('open'),
  crmPipelineId: z.string(),
  crmPipelineStageId: z.string(),
  title: z.string().min(1).max(260),
  description: z.string().max(4000).optional(),
  primaryCrmLeadId: z.string().optional(),
  ownerUserId: z.string().optional(),
  crmContactId: z.string().optional(),
  estimatedAmountMinor: z.number().int().min(0).default(0),
  committedAmountMinor: z.number().int().min(0).default(0),
  weightedAmountMinor: z.number().int().min(0).default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  probabilityBps: z.number().int().min(0).max(10000).default(0),
  expectedCloseAt: z.string().datetime().optional(),
  sourceType: z.string().max(80).optional(),
  sourceRef: z.string().max(220).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createPipelineBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  pipelineType: z.string().max(40).default('opportunity'),
  isDefault: z.boolean().default(false),
  description: z.string().max(4000).optional(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const createPipelineStageBodySchema = z.object({
  crmPipelineId: z.string().min(1),
  name: z.string().min(1).max(180),
  slug: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  sortOrder: z.number().int().min(0).default(100),
  isClosedWon: z.boolean().default(false),
  isClosedLost: z.boolean().default(false),
  defaultProbabilityBps: z.number().int().min(0).max(10000).default(0),
  stagePolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const patchLeadBodySchema = createLeadBodySchema.partial()

const leadIntakeBodySchema = z.object({
  sourceType: z.string().min(1).max(80),
  sourceRef: z.string().min(1).max(220),
  contactType: z.enum(['user', 'group_account', 'external']).default('external'),
  userId: z.string().optional(),
  groupAccountId: z.string().optional(),
  externalContactRef: z.string().max(220).optional(),
  displayName: z.string().max(220).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(80).optional(),
  leadStatus: z.string().default('new'),
  ownerUserId: z.string().optional(),
  scoreBps: z.number().int().min(0).max(10000).default(0),
  priority: z.number().int().min(0).default(100),
  notes: z.string().max(4000).optional(),
  crmPipelineId: z.string().optional(),
  crmPipelineStageId: z.string().optional(),
  attributes: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  routeTo: z.enum(['none', 'review_queue', 'checkout']).default('none'),
  reviewQueueId: z.string().optional(),
  checkoutCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
  checkoutSubtotalMinor: z.number().int().min(0).optional(),
})

async function createCrmRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'crm' },
  })
  if (!delegated.ok) return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  return delegated.row as T
}

async function updateCrmRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'crm' },
  })
  if (!delegated.ok) {
    if (delegated.code === 'CRUD_TARGET_NOT_FOUND') return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  if (!delegated.row) return fail(input.c, 'NOT_FOUND', input.notFoundMessage, 404)
  return delegated.row as T
}

export const crmRoutes = new Hono()

crmRoutes.get(
  '/bizes/:bizId/crm/pipelines',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const pipelineType = c.req.query('pipelineType')
    const rows = await db.query.crmPipelines.findMany({
      where: and(eq(crmPipelines.bizId, bizId), pipelineType ? eq(crmPipelines.pipelineType, pipelineType) : undefined),
      orderBy: [asc(crmPipelines.pipelineType), asc(crmPipelines.name)],
    })
    return ok(c, rows)
  },
)

crmRoutes.post(
  '/bizes/:bizId/crm/pipelines',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createPipelineBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const createdOrResponse = await createCrmRow<typeof crmPipelines.$inferSelect>({
      c,
      bizId,
      tableKey: 'crmPipelines',
      subjectType: 'crm_pipeline',
      displayName: parsed.data.name,
      data: {
        bizId,
        name: sanitizePlainText(parsed.data.name),
        slug: sanitizePlainText(parsed.data.slug),
        status: parsed.data.status,
        pipelineType: sanitizePlainText(parsed.data.pipelineType),
        isDefault: parsed.data.isDefault,
        description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
        policy: sanitizeUnknown(parsed.data.policy ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse
    return ok(c, created, 201)
  },
)

crmRoutes.get(
  '/bizes/:bizId/crm/pipelines/:pipelineId/stages',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, pipelineId } = c.req.param()
    const rows = await db.query.crmPipelineStages.findMany({
      where: and(eq(crmPipelineStages.bizId, bizId), eq(crmPipelineStages.crmPipelineId, pipelineId)),
      orderBy: [asc(crmPipelineStages.sortOrder)],
    })
    return ok(c, rows)
  },
)

crmRoutes.post(
  '/bizes/:bizId/crm/pipelines/:pipelineId/stages',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const pipelineId = c.req.param('pipelineId')
    const parsed = createPipelineStageBodySchema.safeParse({
      ...(await c.req.json().catch(() => null)),
      crmPipelineId: pipelineId,
    })
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const createdOrResponse = await createCrmRow<typeof crmPipelineStages.$inferSelect>({
      c,
      bizId,
      tableKey: 'crmPipelineStages',
      subjectType: 'crm_pipeline_stage',
      displayName: parsed.data.name,
      data: {
        bizId,
        crmPipelineId: pipelineId,
        name: sanitizePlainText(parsed.data.name),
        slug: sanitizePlainText(parsed.data.slug),
        status: parsed.data.status,
        sortOrder: parsed.data.sortOrder,
        isClosedWon: parsed.data.isClosedWon,
        isClosedLost: parsed.data.isClosedLost,
        defaultProbabilityBps: parsed.data.defaultProbabilityBps,
        stagePolicy: sanitizeUnknown(parsed.data.stagePolicy ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse
    return ok(c, created, 201)
  },
)

crmRoutes.get(
  '/bizes/:bizId/crm/contacts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listContactsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(crmContacts.bizId, bizId),
      parsed.data.status ? eq(crmContacts.status, parsed.data.status) : undefined,
      parsed.data.contactType ? eq(crmContacts.contactType, parsed.data.contactType) : undefined,
      parsed.data.sourceType ? eq(crmContacts.sourceType, parsed.data.sourceType) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.crmContacts.findMany({
        where,
        orderBy: [asc(crmContacts.displayName), asc(crmContacts.id)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(crmContacts).where(where),
    ])
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total: countRows[0]?.count ?? 0,
        hasMore: pageInfo.page * pageInfo.perPage < (countRows[0]?.count ?? 0),
      },
    })
  },
)

crmRoutes.post(
  '/bizes/:bizId/crm/contacts',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createContactBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const createdOrResponse = await createCrmRow<typeof crmContacts.$inferSelect>({
      c,
      bizId,
      tableKey: 'crmContacts',
      subjectType: 'crm_contact',
      displayName: parsed.data.displayName,
      data: {
        bizId,
        status: parsed.data.status,
        contactType: parsed.data.contactType,
        userId: parsed.data.userId ?? null,
        groupAccountId: parsed.data.groupAccountId ?? null,
        externalContactRef: parsed.data.externalContactRef ?? null,
        displayName: parsed.data.displayName ? sanitizePlainText(parsed.data.displayName) : null,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ? sanitizePlainText(parsed.data.phone) : null,
        sourceType: parsed.data.sourceType ? sanitizePlainText(parsed.data.sourceType) : null,
        sourceRef: parsed.data.sourceRef ? sanitizePlainText(parsed.data.sourceRef) : null,
        profile: sanitizeUnknown(parsed.data.profile ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse
    return ok(c, created, 201)
  },
)

crmRoutes.get(
  '/bizes/:bizId/crm/leads',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listLeadsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(crmLeads.bizId, bizId),
      parsed.data.status ? eq(crmLeads.status, parsed.data.status) : undefined,
      parsed.data.sourceType ? eq(crmLeads.sourceType, parsed.data.sourceType) : undefined,
      parsed.data.crmContactId ? eq(crmLeads.crmContactId, parsed.data.crmContactId) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.crmLeads.findMany({
        where,
        orderBy: [desc(crmLeads.priority), desc(crmLeads.scoreBps), desc(crmLeads.id)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(crmLeads).where(where),
    ])
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total: countRows[0]?.count ?? 0,
        hasMore: pageInfo.page * pageInfo.perPage < (countRows[0]?.count ?? 0),
      },
    })
  },
)

crmRoutes.post(
  '/bizes/:bizId/crm/leads',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createLeadBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const createdOrResponse = await createCrmRow<typeof crmLeads.$inferSelect>({
      c,
      bizId,
      tableKey: 'crmLeads',
      subjectType: 'crm_lead',
      data: {
        bizId,
        status: parsed.data.status,
        sourceType: parsed.data.sourceType ? sanitizePlainText(parsed.data.sourceType) : null,
        sourceRef: parsed.data.sourceRef ? sanitizePlainText(parsed.data.sourceRef) : null,
        crmContactId: parsed.data.crmContactId,
        locationId: parsed.data.locationId ?? null,
        ownerUserId: parsed.data.ownerUserId ?? null,
        scoreBps: parsed.data.scoreBps,
        priority: parsed.data.priority,
        notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
        attributes: sanitizeUnknown(parsed.data.attributes ?? {}),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse
    return ok(c, created, 201)
  },
)

crmRoutes.patch(
  '/bizes/:bizId/crm/leads/:leadId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, leadId } = c.req.param()
    const parsed = patchLeadBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const existing = await db.query.crmLeads.findFirst({
      where: and(eq(crmLeads.bizId, bizId), eq(crmLeads.id, leadId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Lead not found.', 404)
    const updatedOrResponse = await updateCrmRow<typeof crmLeads.$inferSelect>({
      c,
      bizId,
      tableKey: 'crmLeads',
      subjectType: 'crm_lead',
      id: leadId,
      notFoundMessage: 'Lead not found.',
      patch: {
        status: parsed.data.status ?? undefined,
        sourceType: parsed.data.sourceType === undefined ? undefined : parsed.data.sourceType ? sanitizePlainText(parsed.data.sourceType) : null,
        sourceRef: parsed.data.sourceRef === undefined ? undefined : parsed.data.sourceRef ? sanitizePlainText(parsed.data.sourceRef) : null,
        crmContactId: parsed.data.crmContactId ?? undefined,
        locationId: parsed.data.locationId === undefined ? undefined : parsed.data.locationId,
        ownerUserId: parsed.data.ownerUserId === undefined ? undefined : parsed.data.ownerUserId,
        scoreBps: parsed.data.scoreBps ?? undefined,
        priority: parsed.data.priority ?? undefined,
        notes: parsed.data.notes === undefined ? undefined : parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
        attributes: parsed.data.attributes ? sanitizeUnknown(parsed.data.attributes) : undefined,
        metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
      },
    })
    if (updatedOrResponse instanceof Response) return updatedOrResponse
    const updated = updatedOrResponse
    return ok(c, updated)
  },
)

crmRoutes.post(
  '/bizes/:bizId/crm/lead-intake',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = leadIntakeBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid lead intake body.', 400, parsed.error.flatten())

    let contact = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.bizId, bizId),
        parsed.data.email ? eq(crmContacts.email, parsed.data.email) : undefined,
        eq(crmContacts.contactType, parsed.data.contactType),
      ),
    })
    if (!contact) {
      const createdContactOrResponse = await createCrmRow<typeof crmContacts.$inferSelect>({
        c,
        bizId,
        tableKey: 'crmContacts',
        subjectType: 'crm_contact',
        displayName: parsed.data.displayName,
        data: {
          bizId,
          status: 'active',
          contactType: parsed.data.contactType,
          userId: parsed.data.userId ?? null,
          groupAccountId: parsed.data.groupAccountId ?? null,
          externalContactRef: parsed.data.externalContactRef ?? null,
          displayName: parsed.data.displayName ? sanitizePlainText(parsed.data.displayName) : null,
          email: parsed.data.email ?? null,
          phone: parsed.data.phone ? sanitizePlainText(parsed.data.phone) : null,
          sourceType: sanitizePlainText(parsed.data.sourceType),
          sourceRef: sanitizePlainText(parsed.data.sourceRef),
          profile: {},
          metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
        },
      })
      if (createdContactOrResponse instanceof Response) return createdContactOrResponse
      const createdContact = createdContactOrResponse
      contact = createdContact
    }

    let lead = await db.query.crmLeads.findFirst({
      where: and(eq(crmLeads.bizId, bizId), eq(crmLeads.sourceType, parsed.data.sourceType), eq(crmLeads.sourceRef, parsed.data.sourceRef)),
    })
    if (!lead) {
      const createdLeadOrResponse = await createCrmRow<typeof crmLeads.$inferSelect>({
        c,
        bizId,
        tableKey: 'crmLeads',
        subjectType: 'crm_lead',
        data: {
          bizId,
          status: parsed.data.leadStatus,
          sourceType: sanitizePlainText(parsed.data.sourceType),
          sourceRef: sanitizePlainText(parsed.data.sourceRef),
          crmContactId: contact.id,
          crmPipelineId: parsed.data.crmPipelineId ?? null,
          crmPipelineStageId: parsed.data.crmPipelineStageId ?? null,
          ownerUserId: parsed.data.ownerUserId ?? null,
          scoreBps: parsed.data.scoreBps,
          priority: parsed.data.priority,
          notes: parsed.data.notes ? sanitizePlainText(parsed.data.notes) : null,
          attributes: sanitizeUnknown(parsed.data.attributes ?? {}),
          metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
        },
      })
      if (createdLeadOrResponse instanceof Response) return createdLeadOrResponse
      const createdLead = createdLeadOrResponse
      lead = createdLead
    }

    let routed: Record<string, unknown> | null = null
    if (parsed.data.routeTo === 'review_queue' && parsed.data.reviewQueueId) {
      const itemOrResponse = await createCrmRow<typeof reviewQueueItems.$inferSelect>({
        c,
        bizId,
        tableKey: 'reviewQueueItems',
        subjectType: 'review_queue_item',
        data: {
          bizId,
          reviewQueueId: parsed.data.reviewQueueId,
          status: 'pending',
          itemType: 'crm_lead',
          itemRefId: lead.id,
          priority: parsed.data.priority,
          metadata: sanitizeUnknown({ sourceType: parsed.data.sourceType, sourceRef: parsed.data.sourceRef }),
        },
      })
      if (itemOrResponse instanceof Response) return itemOrResponse
      const item = itemOrResponse
      routed = { kind: 'review_queue_item', id: item.id }
    } else if (parsed.data.routeTo === 'checkout') {
      const sessionOrResponse = await createCrmRow<typeof checkoutSessions.$inferSelect>({
        c,
        bizId,
        tableKey: 'checkoutSessions',
        subjectType: 'checkout_session',
        data: {
          bizId,
          status: 'active',
          channel: 'web',
          ownerUserId: contact.userId ?? null,
          currency: parsed.data.checkoutCurrency ?? 'USD',
          subtotalMinor: parsed.data.checkoutSubtotalMinor ?? 0,
          totalMinor: parsed.data.checkoutSubtotalMinor ?? 0,
          acquisitionSource: sanitizePlainText(parsed.data.sourceType),
          campaignReference: sanitizePlainText(parsed.data.sourceRef),
          metadata: sanitizeUnknown({ leadId: lead.id }),
        },
      })
      if (sessionOrResponse instanceof Response) return sessionOrResponse
      const session = sessionOrResponse
      routed = { kind: 'checkout_session', id: session.id }
    }

    return ok(c, { contact, lead, routed }, 201)
  },
)

crmRoutes.get(
  '/bizes/:bizId/crm/opportunities',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listOpportunitiesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    const pageInfo = pagination(parsed.data)
    const where = and(
      eq(crmOpportunities.bizId, bizId),
      parsed.data.status ? eq(crmOpportunities.status, parsed.data.status) : undefined,
      parsed.data.ownerUserId ? eq(crmOpportunities.ownerUserId, parsed.data.ownerUserId) : undefined,
      parsed.data.crmContactId ? eq(crmOpportunities.crmContactId, parsed.data.crmContactId) : undefined,
    )
    const [rows, countRows] = await Promise.all([
      db.query.crmOpportunities.findMany({
        where,
        orderBy: [desc(crmOpportunities.expectedCloseAt), desc(crmOpportunities.id)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(crmOpportunities).where(where),
    ])
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total: countRows[0]?.count ?? 0,
        hasMore: pageInfo.page * pageInfo.perPage < (countRows[0]?.count ?? 0),
      },
    })
  },
)

crmRoutes.post(
  '/bizes/:bizId/crm/opportunities',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createOpportunityBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    const createdOrResponse = await createCrmRow<typeof crmOpportunities.$inferSelect>({
      c,
      bizId,
      tableKey: 'crmOpportunities',
      subjectType: 'crm_opportunity',
      displayName: parsed.data.title,
      data: {
        bizId,
        status: parsed.data.status,
        crmPipelineId: parsed.data.crmPipelineId,
        crmPipelineStageId: parsed.data.crmPipelineStageId,
        title: sanitizePlainText(parsed.data.title),
        description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
        primaryCrmLeadId: parsed.data.primaryCrmLeadId ?? null,
        ownerUserId: parsed.data.ownerUserId ?? null,
        crmContactId: parsed.data.crmContactId ?? null,
        estimatedAmountMinor: parsed.data.estimatedAmountMinor,
        committedAmountMinor: parsed.data.committedAmountMinor,
        weightedAmountMinor: parsed.data.weightedAmountMinor,
        currency: parsed.data.currency,
        probabilityBps: parsed.data.probabilityBps,
        expectedCloseAt: parsed.data.expectedCloseAt ? new Date(parsed.data.expectedCloseAt) : null,
        sourceType: parsed.data.sourceType ? sanitizePlainText(parsed.data.sourceType) : null,
        sourceRef: parsed.data.sourceRef ? sanitizePlainText(parsed.data.sourceRef) : null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
    })
    if (createdOrResponse instanceof Response) return createdOrResponse
    const created = createdOrResponse
    return ok(c, created, 201)
  },
)

crmRoutes.get(
  '/bizes/:bizId/crm/contacts/:contactId/summary',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, contactId } = c.req.param()
    const contact = await db.query.crmContacts.findFirst({
      where: and(eq(crmContacts.bizId, bizId), eq(crmContacts.id, contactId)),
    })
    if (!contact) return fail(c, 'NOT_FOUND', 'CRM contact not found.', 404)

    const [leads, opportunities, consents, messages, bookings, instrumentRunsForContact] = await Promise.all([
      db.query.crmLeads.findMany({ where: and(eq(crmLeads.bizId, bizId), eq(crmLeads.crmContactId, contactId)), orderBy: [desc(crmLeads.id)] }),
      db.query.crmOpportunities.findMany({ where: and(eq(crmOpportunities.bizId, bizId), eq(crmOpportunities.crmContactId, contactId)), orderBy: [desc(crmOpportunities.id)] }),
      contact.userId
        ? db.query.communicationConsents.findMany({ where: and(eq(communicationConsents.bizId, bizId), eq(communicationConsents.subjectUserId, contact.userId)), orderBy: [desc(communicationConsents.capturedAt)] })
        : Promise.resolve([]),
      contact.userId
        ? db.query.outboundMessages.findMany({ where: and(eq(outboundMessages.bizId, bizId), eq(outboundMessages.recipientUserId, contact.userId)), orderBy: [desc(outboundMessages.scheduledFor)], limit: 10 })
        : Promise.resolve([]),
      contact.userId
        ? db.query.bookingOrders.findMany({ where: and(eq(bookingOrders.bizId, bizId), eq(bookingOrders.customerUserId, contact.userId)), orderBy: [desc(bookingOrders.confirmedStartAt), desc(bookingOrders.requestedStartAt)], limit: 10 })
        : Promise.resolve([]),
      contact.userId
        ? db.query.instrumentRuns.findMany({ where: and(eq(instrumentRuns.bizId, bizId), eq(instrumentRuns.assigneeSubjectType, 'user'), eq(instrumentRuns.assigneeSubjectId, contact.userId)), orderBy: [desc(instrumentRuns.startedAt)], limit: 10 })
        : Promise.resolve([]),
    ])
    const bookingOrderIds = bookings.map((row) => row.id)
    const payments = bookingOrderIds.length
      ? await db.query.paymentTransactions.findMany({
          where: and(eq(paymentTransactions.bizId, bizId), inArray(paymentTransactions.bookingOrderId, bookingOrderIds)),
          orderBy: [desc(paymentTransactions.occurredAt)],
          limit: 10,
        })
      : []

    return ok(c, {
      contact,
      relationships: {
        userId: contact.userId,
        groupAccountId: contact.groupAccountId,
        contactType: contact.contactType,
      },
      timeline: {
        bookings,
        payments,
        forms: instrumentRunsForContact,
        messages,
      },
      consents,
      leads,
      opportunities,
    })
  },
)
