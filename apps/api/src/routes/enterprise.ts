/**
 * Enterprise / franchise routes.
 *
 * ELI5:
 * These routes expose the reusable parent-child business network model.
 * The same API can represent a franchise network, a corporate portfolio,
 * a regional operating group, or a shared-service structure.
 *
 * Why this route exists:
 * - enterprise/franchise use cases need deterministic APIs,
 * - the schema already models scopes, relationships, rollups, and
 *   intercompany accounting lanes,
 * - sagas should validate those ideas through normal API reads/writes.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  enterpriseRelationshipTemplates,
  enterpriseRelationships,
  enterpriseScopes,
  enterpriseIntercompanyAccounts,
  enterpriseIntercompanyEntries,
  enterpriseIntercompanySettlementRuns,
  enterpriseContractPackTemplates,
  enterpriseContractPackVersions,
  enterpriseContractPackBindings,
  enterpriseAdminDelegations,
  enterpriseApprovalAuthorityLimits,
  enterpriseIdentityProviders,
  enterpriseScimSyncStates,
  enterpriseExternalDirectoryLinks,
  enterpriseChangeRolloutRuns,
  enterpriseChangeRolloutTargets,
  enterpriseChangeRolloutResults,
  factEnterpriseRevenueDaily,
} = dbPackage

const relationshipTemplateBodySchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(120),
  relationshipTypeKey: z.string().min(1).max(120),
  inverseRelationshipTypeKey: z.string().max(120).optional().nullable(),
  description: z.string().optional().nullable(),
  isSymmetric: z.boolean().optional(),
  allowsCycles: z.boolean().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const relationshipBodySchema = z.object({
  relationshipTemplateId: z.string().min(1),
  fromBizId: z.string().min(1),
  toBizId: z.string().min(1),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  priority: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const scopeBodySchema = z.object({
  scopeType: z.enum(['network', 'biz', 'location', 'subject']),
  scopeKey: z.string().min(1).max(260),
  targetBizId: z.string().optional().nullable(),
  targetLocationId: z.string().optional().nullable(),
  targetSubjectType: z.string().max(80).optional().nullable(),
  targetSubjectId: z.string().max(140).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const intercompanyAccountBodySchema = z.object({
  sourceBizId: z.string().min(1),
  counterpartyBizId: z.string().min(1),
  accountType: z.enum(['clearing', 'royalty', 'management_fee', 'cost_share', 'custom']),
  currency: z.string().length(3).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  externalAccountRef: z.string().max(140).optional().nullable(),
  description: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const intercompanyEntryBodySchema = z.object({
  intercompanyAccountId: z.string().min(1),
  entryType: z.enum(['accrual', 'adjustment', 'settlement', 'reversal']),
  status: z.enum(['pending', 'posted', 'reversed', 'voided']).optional(),
  occurredAt: z.string().datetime().optional().nullable(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3).optional(),
  description: z.string().optional().nullable(),
  referenceKey: z.string().max(160).optional().nullable(),
  sourceCrossBizOrderId: z.string().optional().nullable(),
  sourcePaymentTransactionId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const contractPackTemplateBodySchema = z.object({
  name: z.string().min(1).max(180),
  slug: z.string().min(1).max(120),
  domainKey: z.string().max(80).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const contractPackVersionBodySchema = z.object({
  contractPackTemplateId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  definition: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const contractPackBindingBodySchema = z.object({
  contractPackVersionId: z.string().min(1),
  scopeId: z.string().min(1),
  bindingMode: z.enum(['required', 'recommended', 'optional']).optional(),
  isInherited: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const revenueFactBodySchema = z.object({
  memberBizId: z.string().optional().nullable(),
  factDate: z.string().date(),
  currency: z.string().length(3).optional(),
  grossMinor: z.number().int().min(0),
  feeMinor: z.number().int().min(0).default(0),
  refundMinor: z.number().int().min(0).default(0),
  netMinor: z.number().int().min(0),
  ordersCount: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).optional(),
})

const adminDelegationBodySchema = z.object({
  delegatorUserId: z.string().min(1),
  delegateUserId: z.string().min(1),
  delegationAction: z.string().min(1).max(100),
  scopeId: z.string().min(1),
  status: z.enum(['active', 'revoked', 'suspended', 'expired']).optional(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  canSubdelegate: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})
const adminDelegationPatchBodySchema = adminDelegationBodySchema.partial()

const approvalLimitBodySchema = z.object({
  userId: z.string().min(1),
  actionType: z.string().min(1).max(100),
  scopeId: z.string().min(1),
  currency: z.string().length(3).optional(),
  perApprovalLimitMinor: z.number().int().min(0).optional().nullable(),
  dailyLimitMinor: z.number().int().min(0).optional().nullable(),
  monthlyLimitMinor: z.number().int().min(0).optional().nullable(),
  requiresSecondApprover: z.boolean().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  metadata: z.record(z.unknown()).optional(),
})
const approvalLimitPatchBodySchema = approvalLimitBodySchema.partial()

const identityProviderBodySchema = z.object({
  name: z.string().min(1).max(180),
  slug: z.string().min(1).max(120),
  providerType: z.enum(['oidc', 'saml', 'scim', 'custom']),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).optional(),
  issuerUrl: z.string().max(500).optional().nullable(),
  authorizationUrl: z.string().max(500).optional().nullable(),
  tokenUrl: z.string().max(500).optional().nullable(),
  jwksUrl: z.string().max(500).optional().nullable(),
  ssoEntryPointUrl: z.string().max(500).optional().nullable(),
  scimBaseUrl: z.string().max(500).optional().nullable(),
  audience: z.string().max(255).optional().nullable(),
  clientId: z.string().max(255).optional().nullable(),
  lastSyncAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const scimSyncStateBodySchema = z.object({
  identityProviderId: z.string().min(1),
  status: z.enum(['pending', 'running', 'succeeded', 'partial', 'failed']).optional(),
  syncStartedAt: z.string().datetime().optional().nullable(),
  syncFinishedAt: z.string().datetime().optional().nullable(),
  cursor: z.string().max(1000).optional().nullable(),
  importedUsersCount: z.number().int().min(0).optional(),
  updatedUsersCount: z.number().int().min(0).optional(),
  deactivatedUsersCount: z.number().int().min(0).optional(),
  errorSummary: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
const scimSyncStatePatchBodySchema = scimSyncStateBodySchema.partial()

const directoryLinkBodySchema = z.object({
  identityProviderId: z.string().min(1),
  principalType: z.string().min(1).max(60),
  userId: z.string().optional().nullable(),
  subjectType: z.string().max(80).optional().nullable(),
  subjectId: z.string().max(140).optional().nullable(),
  externalDirectoryId: z.string().min(1).max(200),
  externalParentId: z.string().max(200).optional().nullable(),
  status: z.enum(['active', 'error', 'disabled']).optional(),
  lastSeenAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
const directoryLinkPatchBodySchema = directoryLinkBodySchema.partial()

const settlementRunBodySchema = z.object({
  intercompanyAccountId: z.string().min(1),
  status: z.enum(['draft', 'running', 'completed', 'failed', 'cancelled']).optional(),
  windowStartDate: z.string().date(),
  windowEndDate: z.string().date(),
  expectedTotalMinor: z.number().int().min(0).optional(),
  postedTotalMinor: z.number().int().min(0).optional(),
  differenceMinor: z.number().int().optional(),
  startedAt: z.string().datetime().optional().nullable(),
  finishedAt: z.string().datetime().optional().nullable(),
  errorSummary: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
const settlementRunPatchBodySchema = settlementRunBodySchema.partial()

const rolloutRunBodySchema = z.object({
  name: z.string().min(1).max(180),
  slug: z.string().max(120).optional().nullable(),
  changeType: z.string().min(1).max(100),
  status: z.enum(['draft', 'running', 'completed', 'failed', 'cancelled']).optional(),
  sourceRevision: z.string().max(160).optional().nullable(),
  targetRevision: z.string().max(160).optional().nullable(),
  requestedByUserId: z.string().optional().nullable(),
  startedAt: z.string().datetime().optional().nullable(),
  finishedAt: z.string().datetime().optional().nullable(),
  errorSummary: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const rolloutTargetBodySchema = z.object({
  rolloutRunId: z.string().min(1),
  scopeId: z.string().min(1),
  targetOrder: z.number().int().min(0).optional(),
  status: z.enum(['pending', 'applied', 'skipped', 'failed']).optional(),
  appliedAt: z.string().datetime().optional().nullable(),
  errorSummary: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})
const rolloutTargetPatchBodySchema = rolloutTargetBodySchema.partial()

const rolloutResultBodySchema = z.object({
  rolloutTargetId: z.string().min(1),
  resultType: z.string().min(1).max(80),
  resultCode: z.string().max(120).optional().nullable(),
  message: z.string().optional().nullable(),
  beforeSnapshot: z.record(z.unknown()).optional(),
  afterSnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

function cleanRecord(value: Record<string, unknown> | undefined) {
  return sanitizeUnknown(value ?? {}) as Record<string, unknown>
}

function asDate(value?: string | null) {
  return value ? new Date(value) : null
}

function asOptionalDate(value?: string | null) {
  return value === undefined ? undefined : value ? new Date(value) : null
}

function sanitizeText(value?: string | null) {
  return value ? sanitizePlainText(value) : null
}

async function createEnterpriseRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'enterprise' },
  })
  if (!delegated.ok) {
    return fail(input.c, delegated.code, delegated.message, delegated.httpStatus, delegated.details)
  }
  return delegated.row as T
}

async function updateEnterpriseRow<T extends Record<string, unknown>>(input: {
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
    metadata: { routeFamily: 'enterprise' },
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

export const enterpriseRoutes = new Hono()

enterpriseRoutes.get('/bizes/:bizId/enterprise/relationship-templates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.enterpriseRelationshipTemplates.findMany({ where: eq(enterpriseRelationshipTemplates.bizId, bizId), orderBy: [asc(enterpriseRelationshipTemplates.name)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/relationship-templates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = relationshipTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid enterprise relationship template body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseRelationshipTemplates',
    subjectType: 'enterprise_relationship_template',
    displayName: parsed.data.name,
    data: {
    bizId,
    name: sanitizePlainText(parsed.data.name),
    slug: sanitizePlainText(parsed.data.slug),
    relationshipTypeKey: sanitizePlainText(parsed.data.relationshipTypeKey),
    inverseRelationshipTypeKey: sanitizeText(parsed.data.inverseRelationshipTypeKey),
    description: sanitizeText(parsed.data.description),
    isSymmetric: parsed.data.isSymmetric ?? false,
    allowsCycles: parsed.data.allowsCycles ?? false,
    status: parsed.data.status ?? 'active',
    metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/relationships', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.enterpriseRelationships.findMany({ where: eq(enterpriseRelationships.bizId, bizId), orderBy: [asc(enterpriseRelationships.priority), desc(enterpriseRelationships.effectiveFrom)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/relationships', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = relationshipBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid enterprise relationship body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseRelationships',
    subjectType: 'enterprise_relationship',
    data: {
    bizId,
    relationshipTemplateId: parsed.data.relationshipTemplateId,
    fromBizId: parsed.data.fromBizId,
    toBizId: parsed.data.toBizId,
    status: parsed.data.status ?? 'active',
    effectiveFrom: asDate(parsed.data.effectiveFrom) ?? new Date(),
    effectiveTo: asDate(parsed.data.effectiveTo),
    priority: parsed.data.priority ?? 100,
    metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/scopes', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.enterpriseScopes.findMany({ where: eq(enterpriseScopes.bizId, bizId), orderBy: [asc(enterpriseScopes.scopeKey)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/scopes', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = scopeBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid enterprise scope body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseScopes',
    subjectType: 'enterprise_scope',
    displayName: parsed.data.scopeKey,
    data: {
    bizId,
    scopeType: parsed.data.scopeType,
    scopeKey: sanitizePlainText(parsed.data.scopeKey),
    targetBizId: parsed.data.targetBizId ?? null,
    targetLocationId: parsed.data.targetLocationId ?? null,
    targetSubjectType: sanitizeText(parsed.data.targetSubjectType),
    targetSubjectId: sanitizeText(parsed.data.targetSubjectId),
    metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/intercompany-accounts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.enterpriseIntercompanyAccounts.findMany({ where: eq(enterpriseIntercompanyAccounts.bizId, bizId), orderBy: [asc(enterpriseIntercompanyAccounts.accountType)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/intercompany-accounts', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = intercompanyAccountBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid intercompany account body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseIntercompanyAccounts',
    subjectType: 'enterprise_intercompany_account',
    data: {
    bizId,
    sourceBizId: parsed.data.sourceBizId,
    counterpartyBizId: parsed.data.counterpartyBizId,
    accountType: parsed.data.accountType,
    currency: parsed.data.currency ?? 'USD',
    status: parsed.data.status ?? 'active',
    externalAccountRef: sanitizeText(parsed.data.externalAccountRef),
    description: sanitizeText(parsed.data.description),
    metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/intercompany-entries', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const accountId = c.req.query('intercompanyAccountId')
  const rows = await db.query.enterpriseIntercompanyEntries.findMany({ where: and(eq(enterpriseIntercompanyEntries.bizId, bizId), accountId ? eq(enterpriseIntercompanyEntries.intercompanyAccountId, accountId) : undefined), orderBy: [desc(enterpriseIntercompanyEntries.occurredAt)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/intercompany-entries', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = intercompanyEntryBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid intercompany entry body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseIntercompanyEntries',
    subjectType: 'enterprise_intercompany_entry',
    data: {
    bizId,
    intercompanyAccountId: parsed.data.intercompanyAccountId,
    entryType: parsed.data.entryType,
    status: parsed.data.status ?? 'pending',
    occurredAt: asDate(parsed.data.occurredAt) ?? new Date(),
    amountMinor: parsed.data.amountMinor,
    currency: parsed.data.currency ?? 'USD',
    description: sanitizeText(parsed.data.description),
    referenceKey: sanitizeText(parsed.data.referenceKey),
    sourceCrossBizOrderId: parsed.data.sourceCrossBizOrderId ?? null,
    sourcePaymentTransactionId: parsed.data.sourcePaymentTransactionId ?? null,
    metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/contract-pack-templates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.enterpriseContractPackTemplates.findMany({ where: eq(enterpriseContractPackTemplates.bizId, bizId), orderBy: [asc(enterpriseContractPackTemplates.name)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/contract-pack-templates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = contractPackTemplateBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid contract pack template body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseContractPackTemplates',
    subjectType: 'enterprise_contract_pack_template',
    displayName: parsed.data.name,
    data: {
    bizId,
    name: sanitizePlainText(parsed.data.name),
    slug: sanitizePlainText(parsed.data.slug),
    domainKey: parsed.data.domainKey ?? 'operations',
    description: sanitizeText(parsed.data.description),
    status: parsed.data.status ?? 'active',
    metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/contract-pack-versions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const templateId = c.req.query('contractPackTemplateId')
  const rows = await db.query.enterpriseContractPackVersions.findMany({ where: and(eq(enterpriseContractPackVersions.bizId, bizId), templateId ? eq(enterpriseContractPackVersions.contractPackTemplateId, templateId) : undefined), orderBy: [desc(enterpriseContractPackVersions.versionNumber)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/contract-pack-versions', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = contractPackVersionBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid contract pack version body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseContractPackVersions',
    subjectType: 'enterprise_contract_pack_version',
    data: {
    bizId,
    contractPackTemplateId: parsed.data.contractPackTemplateId,
    versionNumber: parsed.data.versionNumber,
    status: parsed.data.status ?? 'draft',
    effectiveFrom: asDate(parsed.data.effectiveFrom),
    effectiveTo: asDate(parsed.data.effectiveTo),
    definition: cleanRecord(parsed.data.definition),
    metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/contract-pack-bindings', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.enterpriseContractPackBindings.findMany({ where: eq(enterpriseContractPackBindings.bizId, bizId), orderBy: [asc(enterpriseContractPackBindings.priority)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/contract-pack-bindings', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = contractPackBindingBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid contract pack binding body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseContractPackBindings',
    subjectType: 'enterprise_contract_pack_binding',
    data: {
    bizId,
    contractPackVersionId: parsed.data.contractPackVersionId,
    scopeId: parsed.data.scopeId,
    bindingMode: parsed.data.bindingMode ?? 'required',
    isInherited: parsed.data.isInherited ?? false,
    priority: parsed.data.priority ?? 100,
    status: parsed.data.status ?? 'active',
    effectiveFrom: asDate(parsed.data.effectiveFrom),
    effectiveTo: asDate(parsed.data.effectiveTo),
    metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/admin-delegations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.enterpriseAdminDelegations.findMany({ where: eq(enterpriseAdminDelegations.bizId, bizId), orderBy: [asc(enterpriseAdminDelegations.delegateUserId), desc(enterpriseAdminDelegations.effectiveFrom)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/admin-delegations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = adminDelegationBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid enterprise delegation body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseAdminDelegations',
    subjectType: 'enterprise_admin_delegation',
    data: {
      bizId,
      delegatorUserId: parsed.data.delegatorUserId,
      delegateUserId: parsed.data.delegateUserId,
      delegationAction: sanitizePlainText(parsed.data.delegationAction),
      scopeId: parsed.data.scopeId,
      status: parsed.data.status ?? 'active',
      effectiveFrom: asDate(parsed.data.effectiveFrom) ?? new Date(),
      effectiveTo: asDate(parsed.data.effectiveTo),
      canSubdelegate: parsed.data.canSubdelegate ?? false,
      metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.patch('/bizes/:bizId/enterprise/admin-delegations/:delegationId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, delegationId } = c.req.param()
  const parsed = adminDelegationPatchBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid enterprise delegation patch body.', 400, parsed.error.flatten())
  const rowOrResponse = await updateEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseAdminDelegations',
    subjectType: 'enterprise_admin_delegation',
    id: delegationId,
    notFoundMessage: 'Enterprise delegation not found.',
    patch: {
      delegatorUserId: parsed.data.delegatorUserId ?? undefined,
      delegateUserId: parsed.data.delegateUserId ?? undefined,
      delegationAction: parsed.data.delegationAction ? sanitizePlainText(parsed.data.delegationAction) : undefined,
      scopeId: parsed.data.scopeId ?? undefined,
      status: parsed.data.status ?? undefined,
      effectiveFrom:
        parsed.data.effectiveFrom == null ? undefined : new Date(parsed.data.effectiveFrom),
      effectiveTo: asOptionalDate(parsed.data.effectiveTo),
      canSubdelegate: parsed.data.canSubdelegate ?? undefined,
      metadata: parsed.data.metadata ? cleanRecord(parsed.data.metadata) : undefined,
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/approval-authority-limits', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.enterpriseApprovalAuthorityLimits.findMany({ where: eq(enterpriseApprovalAuthorityLimits.bizId, bizId), orderBy: [asc(enterpriseApprovalAuthorityLimits.userId), asc(enterpriseApprovalAuthorityLimits.actionType)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/approval-authority-limits', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = approvalLimitBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid approval authority limit body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseApprovalAuthorityLimits',
    subjectType: 'enterprise_approval_authority_limit',
    data: {
      bizId,
      userId: parsed.data.userId,
      actionType: sanitizePlainText(parsed.data.actionType),
      scopeId: parsed.data.scopeId,
      currency: parsed.data.currency ?? 'USD',
      perApprovalLimitMinor: parsed.data.perApprovalLimitMinor ?? null,
      dailyLimitMinor: parsed.data.dailyLimitMinor ?? null,
      monthlyLimitMinor: parsed.data.monthlyLimitMinor ?? null,
      requiresSecondApprover: parsed.data.requiresSecondApprover ?? false,
      status: parsed.data.status ?? 'active',
      metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.patch('/bizes/:bizId/enterprise/approval-authority-limits/:limitId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, limitId } = c.req.param()
  const parsed = approvalLimitPatchBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid approval authority limit patch body.', 400, parsed.error.flatten())
  const rowOrResponse = await updateEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseApprovalAuthorityLimits',
    subjectType: 'enterprise_approval_authority_limit',
    id: limitId,
    notFoundMessage: 'Approval authority limit not found.',
    patch: {
      userId: parsed.data.userId ?? undefined,
      actionType: parsed.data.actionType ? sanitizePlainText(parsed.data.actionType) : undefined,
      scopeId: parsed.data.scopeId ?? undefined,
      currency: parsed.data.currency ?? undefined,
      perApprovalLimitMinor: parsed.data.perApprovalLimitMinor === undefined ? undefined : parsed.data.perApprovalLimitMinor,
      dailyLimitMinor: parsed.data.dailyLimitMinor === undefined ? undefined : parsed.data.dailyLimitMinor,
      monthlyLimitMinor: parsed.data.monthlyLimitMinor === undefined ? undefined : parsed.data.monthlyLimitMinor,
      requiresSecondApprover: parsed.data.requiresSecondApprover ?? undefined,
      status: parsed.data.status ?? undefined,
      metadata: parsed.data.metadata ? cleanRecord(parsed.data.metadata) : undefined,
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/identity-providers', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.enterpriseIdentityProviders.findMany({ where: eq(enterpriseIdentityProviders.bizId, bizId), orderBy: [asc(enterpriseIdentityProviders.name)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/identity-providers', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = identityProviderBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid identity provider body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseIdentityProviders',
    subjectType: 'enterprise_identity_provider',
    displayName: parsed.data.name,
    data: {
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizePlainText(parsed.data.slug),
      providerType: parsed.data.providerType,
      status: parsed.data.status ?? 'active',
      issuerUrl: sanitizeText(parsed.data.issuerUrl),
      authorizationUrl: sanitizeText(parsed.data.authorizationUrl),
      tokenUrl: sanitizeText(parsed.data.tokenUrl),
      jwksUrl: sanitizeText(parsed.data.jwksUrl),
      ssoEntryPointUrl: sanitizeText(parsed.data.ssoEntryPointUrl),
      scimBaseUrl: sanitizeText(parsed.data.scimBaseUrl),
      audience: sanitizeText(parsed.data.audience),
      clientId: sanitizeText(parsed.data.clientId),
      lastSyncAt: asDate(parsed.data.lastSyncAt),
      metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/scim-sync-states', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const identityProviderId = c.req.query('identityProviderId')
  const rows = await db.query.enterpriseScimSyncStates.findMany({ where: and(eq(enterpriseScimSyncStates.bizId, bizId), identityProviderId ? eq(enterpriseScimSyncStates.identityProviderId, identityProviderId) : undefined), orderBy: [desc(enterpriseScimSyncStates.syncStartedAt)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/scim-sync-states', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = scimSyncStateBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid SCIM sync state body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseScimSyncStates',
    subjectType: 'enterprise_scim_sync_state',
    data: {
      bizId,
      identityProviderId: parsed.data.identityProviderId,
      status: parsed.data.status ?? 'pending',
      syncStartedAt: asDate(parsed.data.syncStartedAt) ?? new Date(),
      syncFinishedAt: asDate(parsed.data.syncFinishedAt),
      cursor: sanitizeText(parsed.data.cursor),
      importedUsersCount: parsed.data.importedUsersCount ?? 0,
      updatedUsersCount: parsed.data.updatedUsersCount ?? 0,
      deactivatedUsersCount: parsed.data.deactivatedUsersCount ?? 0,
      errorSummary: sanitizeText(parsed.data.errorSummary),
      metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.patch('/bizes/:bizId/enterprise/scim-sync-states/:syncStateId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, syncStateId } = c.req.param()
  const parsed = scimSyncStatePatchBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid SCIM sync state patch body.', 400, parsed.error.flatten())
  const rowOrResponse = await updateEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseScimSyncStates',
    subjectType: 'enterprise_scim_sync_state',
    id: syncStateId,
    notFoundMessage: 'SCIM sync state not found.',
    patch: {
      identityProviderId: parsed.data.identityProviderId ?? undefined,
      status: parsed.data.status ?? undefined,
      syncStartedAt:
        parsed.data.syncStartedAt == null ? undefined : new Date(parsed.data.syncStartedAt),
      syncFinishedAt: asOptionalDate(parsed.data.syncFinishedAt),
      cursor: parsed.data.cursor === undefined ? undefined : sanitizeText(parsed.data.cursor),
      importedUsersCount: parsed.data.importedUsersCount ?? undefined,
      updatedUsersCount: parsed.data.updatedUsersCount ?? undefined,
      deactivatedUsersCount: parsed.data.deactivatedUsersCount ?? undefined,
      errorSummary: parsed.data.errorSummary === undefined ? undefined : sanitizeText(parsed.data.errorSummary),
      metadata: parsed.data.metadata ? cleanRecord(parsed.data.metadata) : undefined,
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/directory-links', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const identityProviderId = c.req.query('identityProviderId')
  const rows = await db.query.enterpriseExternalDirectoryLinks.findMany({ where: and(eq(enterpriseExternalDirectoryLinks.bizId, bizId), identityProviderId ? eq(enterpriseExternalDirectoryLinks.identityProviderId, identityProviderId) : undefined), orderBy: [asc(enterpriseExternalDirectoryLinks.externalDirectoryId)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/directory-links', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = directoryLinkBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid external directory link body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseExternalDirectoryLinks',
    subjectType: 'enterprise_external_directory_link',
    data: {
      bizId,
      identityProviderId: parsed.data.identityProviderId,
      principalType: sanitizePlainText(parsed.data.principalType),
      userId: parsed.data.userId ?? null,
      subjectType: sanitizeText(parsed.data.subjectType),
      subjectId: sanitizeText(parsed.data.subjectId),
      externalDirectoryId: sanitizePlainText(parsed.data.externalDirectoryId),
      externalParentId: sanitizeText(parsed.data.externalParentId),
      status: parsed.data.status ?? 'active',
      lastSeenAt: asDate(parsed.data.lastSeenAt),
      metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.patch('/bizes/:bizId/enterprise/directory-links/:directoryLinkId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, directoryLinkId } = c.req.param()
  const parsed = directoryLinkPatchBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid external directory link patch body.', 400, parsed.error.flatten())
  const rowOrResponse = await updateEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseExternalDirectoryLinks',
    subjectType: 'enterprise_external_directory_link',
    id: directoryLinkId,
    notFoundMessage: 'External directory link not found.',
    patch: {
      identityProviderId: parsed.data.identityProviderId ?? undefined,
      principalType: parsed.data.principalType ? sanitizePlainText(parsed.data.principalType) : undefined,
      userId: parsed.data.userId ?? undefined,
      subjectType: parsed.data.subjectType === undefined ? undefined : sanitizeText(parsed.data.subjectType),
      subjectId: parsed.data.subjectId === undefined ? undefined : sanitizeText(parsed.data.subjectId),
      externalDirectoryId: parsed.data.externalDirectoryId ? sanitizePlainText(parsed.data.externalDirectoryId) : undefined,
      externalParentId: parsed.data.externalParentId === undefined ? undefined : sanitizeText(parsed.data.externalParentId),
      status: parsed.data.status ?? undefined,
      lastSeenAt: asOptionalDate(parsed.data.lastSeenAt),
      metadata: parsed.data.metadata ? cleanRecord(parsed.data.metadata) : undefined,
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/intercompany-settlement-runs', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const intercompanyAccountId = c.req.query('intercompanyAccountId')
  const rows = await db.query.enterpriseIntercompanySettlementRuns.findMany({ where: and(eq(enterpriseIntercompanySettlementRuns.bizId, bizId), intercompanyAccountId ? eq(enterpriseIntercompanySettlementRuns.intercompanyAccountId, intercompanyAccountId) : undefined), orderBy: [desc(enterpriseIntercompanySettlementRuns.startedAt)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/intercompany-settlement-runs', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = settlementRunBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid intercompany settlement run body.', 400, parsed.error.flatten())
  const expectedTotalMinor = parsed.data.expectedTotalMinor ?? 0
  const postedTotalMinor = parsed.data.postedTotalMinor ?? 0
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseIntercompanySettlementRuns',
    subjectType: 'enterprise_intercompany_settlement_run',
    data: {
      bizId,
      intercompanyAccountId: parsed.data.intercompanyAccountId,
      status: parsed.data.status ?? 'draft',
      windowStartDate: parsed.data.windowStartDate,
      windowEndDate: parsed.data.windowEndDate,
      expectedTotalMinor,
      postedTotalMinor,
      differenceMinor: parsed.data.differenceMinor ?? expectedTotalMinor - postedTotalMinor,
      startedAt: asDate(parsed.data.startedAt) ?? new Date(),
      finishedAt: asDate(parsed.data.finishedAt),
      errorSummary: sanitizeText(parsed.data.errorSummary),
      metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.patch('/bizes/:bizId/enterprise/intercompany-settlement-runs/:settlementRunId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, settlementRunId } = c.req.param()
  const parsed = settlementRunPatchBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid intercompany settlement run patch body.', 400, parsed.error.flatten())
  const rowOrResponse = await updateEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseIntercompanySettlementRuns',
    subjectType: 'enterprise_intercompany_settlement_run',
    id: settlementRunId,
    notFoundMessage: 'Intercompany settlement run not found.',
    patch: {
      intercompanyAccountId: parsed.data.intercompanyAccountId ?? undefined,
      status: parsed.data.status ?? undefined,
      windowStartDate: parsed.data.windowStartDate ?? undefined,
      windowEndDate: parsed.data.windowEndDate ?? undefined,
      expectedTotalMinor: parsed.data.expectedTotalMinor ?? undefined,
      postedTotalMinor: parsed.data.postedTotalMinor ?? undefined,
      differenceMinor: parsed.data.differenceMinor ?? undefined,
      startedAt:
        parsed.data.startedAt == null ? undefined : new Date(parsed.data.startedAt),
      finishedAt: asOptionalDate(parsed.data.finishedAt),
      errorSummary: parsed.data.errorSummary === undefined ? undefined : sanitizeText(parsed.data.errorSummary),
      metadata: parsed.data.metadata ? cleanRecord(parsed.data.metadata) : undefined,
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/change-rollout-runs', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.enterpriseChangeRolloutRuns.findMany({ where: eq(enterpriseChangeRolloutRuns.bizId, bizId), orderBy: [desc(enterpriseChangeRolloutRuns.startedAt)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/change-rollout-runs', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = rolloutRunBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid enterprise rollout run body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseChangeRolloutRuns',
    subjectType: 'enterprise_change_rollout_run',
    displayName: parsed.data.name,
    data: {
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: sanitizeText(parsed.data.slug),
      changeType: sanitizePlainText(parsed.data.changeType),
      status: parsed.data.status ?? 'draft',
      sourceRevision: sanitizeText(parsed.data.sourceRevision),
      targetRevision: sanitizeText(parsed.data.targetRevision),
      requestedByUserId: parsed.data.requestedByUserId ?? null,
      startedAt: asDate(parsed.data.startedAt) ?? new Date(),
      finishedAt: asDate(parsed.data.finishedAt),
      errorSummary: sanitizeText(parsed.data.errorSummary),
      metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/change-rollout-targets', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rolloutRunId = c.req.query('rolloutRunId')
  const rows = await db.query.enterpriseChangeRolloutTargets.findMany({ where: and(eq(enterpriseChangeRolloutTargets.bizId, bizId), rolloutRunId ? eq(enterpriseChangeRolloutTargets.rolloutRunId, rolloutRunId) : undefined), orderBy: [asc(enterpriseChangeRolloutTargets.targetOrder)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/change-rollout-targets', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = rolloutTargetBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid enterprise rollout target body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseChangeRolloutTargets',
    subjectType: 'enterprise_change_rollout_target',
    data: {
      bizId,
      rolloutRunId: parsed.data.rolloutRunId,
      scopeId: parsed.data.scopeId,
      targetOrder: parsed.data.targetOrder ?? 100,
      status: parsed.data.status ?? 'pending',
      appliedAt: asDate(parsed.data.appliedAt),
      errorSummary: sanitizeText(parsed.data.errorSummary),
      metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.patch('/bizes/:bizId/enterprise/change-rollout-targets/:rolloutTargetId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, rolloutTargetId } = c.req.param()
  const parsed = rolloutTargetPatchBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid enterprise rollout target patch body.', 400, parsed.error.flatten())
  const rowOrResponse = await updateEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseChangeRolloutTargets',
    subjectType: 'enterprise_change_rollout_target',
    id: rolloutTargetId,
    notFoundMessage: 'Enterprise rollout target not found.',
    patch: {
      rolloutRunId: parsed.data.rolloutRunId ?? undefined,
      scopeId: parsed.data.scopeId ?? undefined,
      targetOrder: parsed.data.targetOrder ?? undefined,
      status: parsed.data.status ?? undefined,
      appliedAt: asOptionalDate(parsed.data.appliedAt),
      errorSummary: parsed.data.errorSummary === undefined ? undefined : sanitizeText(parsed.data.errorSummary),
      metadata: parsed.data.metadata ? cleanRecord(parsed.data.metadata) : undefined,
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/change-rollout-results', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rolloutTargetId = c.req.query('rolloutTargetId')
  const rows = await db.query.enterpriseChangeRolloutResults.findMany({ where: and(eq(enterpriseChangeRolloutResults.bizId, bizId), rolloutTargetId ? eq(enterpriseChangeRolloutResults.rolloutTargetId, rolloutTargetId) : undefined), orderBy: [asc(enterpriseChangeRolloutResults.id)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/change-rollout-results', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = rolloutResultBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid enterprise rollout result body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'enterpriseChangeRolloutResults',
    subjectType: 'enterprise_change_rollout_result',
    data: {
      bizId,
      rolloutTargetId: parsed.data.rolloutTargetId,
      resultType: sanitizePlainText(parsed.data.resultType),
      resultCode: sanitizeText(parsed.data.resultCode),
      message: sanitizeText(parsed.data.message),
      beforeSnapshot: cleanRecord(parsed.data.beforeSnapshot),
      afterSnapshot: cleanRecord(parsed.data.afterSnapshot),
      metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})

enterpriseRoutes.get('/bizes/:bizId/enterprise/revenue-daily', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.factEnterpriseRevenueDaily.findMany({ where: eq(factEnterpriseRevenueDaily.bizId, bizId), orderBy: [desc(factEnterpriseRevenueDaily.factDate)] })
  return ok(c, rows)
})

enterpriseRoutes.post('/bizes/:bizId/enterprise/revenue-daily', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = revenueFactBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid enterprise revenue fact body.', 400, parsed.error.flatten())
  const rowOrResponse = await createEnterpriseRow({
    c,
    bizId,
    tableKey: 'factEnterpriseRevenueDaily',
    subjectType: 'enterprise_revenue_daily_fact',
    data: {
      bizId,
      memberBizId: parsed.data.memberBizId ?? null,
      factDate: parsed.data.factDate,
      currency: parsed.data.currency ?? 'USD',
      grossMinor: parsed.data.grossMinor,
      feeMinor: parsed.data.feeMinor,
      refundMinor: parsed.data.refundMinor,
      netMinor: parsed.data.netMinor,
      ordersCount: parsed.data.ordersCount,
      metadata: cleanRecord(parsed.data.metadata),
    },
  })
  if (rowOrResponse instanceof Response) return rowOrResponse
  const row = rowOrResponse
  return ok(c, row, 201)
})
