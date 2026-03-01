/**
 * Credential exchange routes.
 *
 * ELI5:
 * These routes expose the user's portable credential wallet.
 * A user can upload one credential once, attach facts/documents/verifications,
 * and then share it with one or more businesses using explicit grants.
 *
 * Why this route exists:
 * - the schema already models portable credentials in a generic way,
 * - saga validation needs real API surfaces instead of direct DB inspection,
 * - future UIs and external clients need one clean contract for records,
 *   sharing, requests, and disclosure history.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  users,
  bizes,
  credentialTypeDefinitions,
  userCredentialProfiles,
  userCredentialRecords,
  userCredentialDocuments,
  userCredentialFacts,
  userCredentialVerifications,
  bizCredentialShareGrants,
  bizCredentialShareGrantSelectors,
  bizCredentialRequests,
  bizCredentialRequestItems,
  credentialDisclosureEvents,
} = dbPackage

const listQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
})

const credentialProfileBodySchema = z.object({
  status: z.string().max(60).optional(),
  allowMarketplaceDiscovery: z.boolean().optional(),
  allowInboundCredentialRequests: z.boolean().optional(),
  defaultGrantAccessLevel: z.string().max(60).optional(),
  defaultGrantScope: z.string().max(60).optional(),
  publicSummary: z.record(z.unknown()).optional(),
  preferences: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const credentialRecordBodySchema = z.object({
  credentialTypeDefinitionId: z.string().optional().nullable(),
  credentialTypeKey: z.string().min(1).max(120),
  credentialKey: z.string().min(1).max(140),
  displayName: z.string().max(260).optional().nullable(),
  issuerName: z.string().max(260).optional().nullable(),
  issuerCountry: z.string().length(2).optional().nullable(),
  issuerRegion: z.string().max(16).optional().nullable(),
  credentialNumberHash: z.string().max(255).optional().nullable(),
  issuedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  lastVerifiedAt: z.string().datetime().optional().nullable(),
  nextReverificationAt: z.string().datetime().optional().nullable(),
  status: z.string().max(60).optional(),
  verificationStatus: z.string().max(60).optional(),
  discoveryVisibility: z.string().max(60).optional(),
  isShareable: z.boolean().optional(),
  summary: z.record(z.unknown()).optional(),
  attributes: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const credentialDocumentBodySchema = z.object({
  documentType: z.string().min(1).max(80),
  storageRef: z.string().min(1).max(700),
  fileName: z.string().max(260).optional().nullable(),
  mimeType: z.string().max(160).optional().nullable(),
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  sha256: z.string().max(128).optional().nullable(),
  capturedAt: z.string().datetime().optional().nullable(),
  sourceType: z.string().max(60).optional(),
  sensitivityClass: z.string().max(60).optional(),
  previewPolicy: z.string().max(60).optional(),
  isPrimary: z.boolean().optional(),
  status: z.string().max(60).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const credentialFactBodySchema = z.object({
  factKey: z.string().min(1).max(120),
  valueKey: z.string().max(120).optional().nullable(),
  valueText: z.string().max(500).optional().nullable(),
  valueNumber: z.number().optional().nullable(),
  valueBoolean: z.boolean().optional().nullable(),
  valueDate: z.string().date().optional().nullable(),
  valueTimestamp: z.string().datetime().optional().nullable(),
  visibilityMode: z.string().max(60).optional(),
  isFilterable: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const credentialVerificationBodySchema = z.object({
  userCredentialDocumentId: z.string().optional().nullable(),
  verifierType: z.string().max(60).optional(),
  verifierBizId: z.string().optional().nullable(),
  verifierUserId: z.string().optional().nullable(),
  method: z.string().max(80).optional(),
  status: z.string().max(60).optional(),
  confidenceScore: z.number().int().min(0).max(100).optional().nullable(),
  requestedAt: z.string().datetime().optional().nullable(),
  decidedAt: z.string().datetime().optional().nullable(),
  verifiedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  summary: z.string().max(1000).optional().nullable(),
  evidence: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const shareGrantBodySchema = z.object({
  ownerUserId: z.string().min(1),
  status: z.string().max(60).optional(),
  accessLevel: z.string().max(60).optional(),
  scope: z.string().max(60).optional(),
  allowCandidateSearch: z.boolean().optional(),
  allowFactFiltering: z.boolean().optional(),
  allowDocumentPreview: z.boolean().optional(),
  allowDocumentDownload: z.boolean().optional(),
  allowVerificationRequests: z.boolean().optional(),
  grantedByUserId: z.string().optional().nullable(),
  grantedAt: z.string().datetime().optional().nullable(),
  revokedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  reason: z.string().max(1000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const shareGrantSelectorBodySchema = z.object({
  ownerUserId: z.string().min(1),
  selectorType: z.string().min(1).max(60),
  isIncluded: z.boolean().optional(),
  credentialRecordId: z.string().optional().nullable(),
  credentialTypeKey: z.string().max(120).optional().nullable(),
  factKey: z.string().max(120).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const credentialRequestBodySchema = z.object({
  candidateUserId: z.string().min(1),
  requestedByUserId: z.string().optional().nullable(),
  status: z.string().max(60).optional(),
  title: z.string().min(1).max(260),
  description: z.string().max(1200).optional().nullable(),
  priority: z.number().int().min(0).optional(),
  dueAt: z.string().datetime().optional().nullable(),
  respondedAt: z.string().datetime().optional().nullable(),
  bizCredentialShareGrantId: z.string().optional().nullable(),
  sourceSubjectType: z.string().max(80).optional().nullable(),
  sourceSubjectId: z.string().max(140).optional().nullable(),
  requestKey: z.string().max(140).optional().nullable(),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const credentialRequestItemBodySchema = z.object({
  candidateUserId: z.string().min(1),
  requirementMode: z.string().max(40).optional(),
  selectorType: z.string().min(1).max(60),
  credentialRecordId: z.string().optional().nullable(),
  credentialTypeKey: z.string().max(120).optional().nullable(),
  factKey: z.string().max(120).optional().nullable(),
  factPredicate: z.record(z.unknown()).optional().nullable(),
  minValidityDaysRemaining: z.number().int().min(0).optional(),
  requiredVerificationStatus: z.string().max(60).optional(),
  isSatisfied: z.boolean().optional(),
  notes: z.string().max(700).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const disclosureEventBodySchema = z.object({
  ownerUserId: z.string().min(1),
  bizCredentialShareGrantId: z.string().optional().nullable(),
  bizCredentialRequestId: z.string().optional().nullable(),
  eventType: z.string().min(1).max(80),
  credentialRecordId: z.string().optional().nullable(),
  credentialDocumentId: z.string().optional().nullable(),
  actorType: z.string().max(60).optional(),
  actorUserId: z.string().optional().nullable(),
  occurredAt: z.string().datetime().optional().nullable(),
  requestRef: z.string().max(200).optional().nullable(),
  details: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const candidateDiscoveryQuerySchema = z.object({
  credentialTypeKey: z.string().optional(),
  factKey: z.string().optional(),
  valueKey: z.string().optional(),
  page: z.string().optional(),
  perPage: z.string().optional(),
})

function pagination(query: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(query.page, 1)
  const perPage = Math.min(parsePositiveInt(query.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

function cleanRecord(value: Record<string, unknown> | undefined) {
  return sanitizeUnknown(value ?? {}) as Record<string, unknown>
}

function asDate(value?: string | null) {
  return value ? new Date(value) : null
}

function sanitizeText(value?: string | null) {
  if (!value) return null
  return sanitizePlainText(value)
}

async function requireExistingUser(userId: string) {
  return db.query.users.findFirst({ where: eq(users.id, userId) })
}

export const credentialExchangeRoutes = new Hono()

credentialExchangeRoutes.get('/credential-type-definitions', requireAuth, async (c) => {
  const rows = await db.query.credentialTypeDefinitions.findMany({ orderBy: [asc(credentialTypeDefinitions.name)] })
  return ok(c, rows)
})

credentialExchangeRoutes.get('/me/credential-profile', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const profile = await db.query.userCredentialProfiles.findFirst({ where: eq(userCredentialProfiles.ownerUserId, user.id) })
  return ok(c, profile)
})

credentialExchangeRoutes.put('/me/credential-profile', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = credentialProfileBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential profile body.', 400, parsed.error.flatten())
  const existing = await db.query.userCredentialProfiles.findFirst({ where: eq(userCredentialProfiles.ownerUserId, user.id) })
  const values = {
    ownerUserId: user.id,
    status: (parsed.data.status ?? 'active') as 'active' | 'draft' | 'inactive' | 'suspended' | 'archived',
    allowMarketplaceDiscovery: parsed.data.allowMarketplaceDiscovery ?? false,
    allowInboundCredentialRequests: parsed.data.allowInboundCredentialRequests ?? true,
    defaultGrantAccessLevel: parsed.data.defaultGrantAccessLevel ?? 'summary',
    defaultGrantScope: parsed.data.defaultGrantScope ?? 'selected_records',
    publicSummary: cleanRecord(parsed.data.publicSummary),
    preferences: cleanRecord(parsed.data.preferences),
    metadata: cleanRecord(parsed.data.metadata),
  }
  const row = existing
    ? (await db.update(userCredentialProfiles).set(values).where(eq(userCredentialProfiles.id, existing.id)).returning())[0]
    : (await db.insert(userCredentialProfiles).values(values).returning())[0]
  return ok(c, row, existing ? 200 : 201)
})

credentialExchangeRoutes.get('/me/credentials', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = listQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  const pageInfo = pagination(parsed.data)
  const [rows, countRows] = await Promise.all([
    db.query.userCredentialRecords.findMany({
      where: eq(userCredentialRecords.ownerUserId, user.id),
      orderBy: [desc(userCredentialRecords.issuedAt), asc(userCredentialRecords.id)],
      limit: pageInfo.perPage,
      offset: pageInfo.offset,
    }),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(userCredentialRecords).where(eq(userCredentialRecords.ownerUserId, user.id)),
  ])
  return ok(c, rows, 200, { pagination: { page: pageInfo.page, perPage: pageInfo.perPage, total: countRows[0]?.count ?? 0 } })
})

credentialExchangeRoutes.post('/me/credentials', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = credentialRecordBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential record body.', 400, parsed.error.flatten())
  const [row] = await db.insert(userCredentialRecords).values({
    ownerUserId: user.id,
    credentialTypeDefinitionId: parsed.data.credentialTypeDefinitionId ?? null,
    credentialTypeKey: sanitizePlainText(parsed.data.credentialTypeKey),
    credentialKey: sanitizePlainText(parsed.data.credentialKey),
    displayName: sanitizeText(parsed.data.displayName),
    issuerName: sanitizeText(parsed.data.issuerName),
    issuerCountry: parsed.data.issuerCountry ?? null,
    issuerRegion: sanitizeText(parsed.data.issuerRegion),
    credentialNumberHash: sanitizeText(parsed.data.credentialNumberHash),
    issuedAt: asDate(parsed.data.issuedAt),
    expiresAt: asDate(parsed.data.expiresAt),
    lastVerifiedAt: asDate(parsed.data.lastVerifiedAt),
    nextReverificationAt: asDate(parsed.data.nextReverificationAt),
    status: (parsed.data.status ?? 'active') as 'active' | 'draft' | 'inactive' | 'suspended' | 'archived',
    verificationStatus: parsed.data.verificationStatus ?? 'unverified',
    discoveryVisibility: parsed.data.discoveryVisibility ?? 'private',
    isShareable: parsed.data.isShareable ?? true,
    summary: cleanRecord(parsed.data.summary),
    attributes: cleanRecord(parsed.data.attributes),
    metadata: cleanRecord(parsed.data.metadata),
  }).returning()
  return ok(c, row, 201)
})

credentialExchangeRoutes.get('/me/credentials/:recordId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const record = await db.query.userCredentialRecords.findFirst({ where: and(eq(userCredentialRecords.ownerUserId, user.id), eq(userCredentialRecords.id, c.req.param('recordId'))) })
  if (!record) return fail(c, 'NOT_FOUND', 'Credential record not found.', 404)
  const [documents, facts, verifications] = await Promise.all([
    db.query.userCredentialDocuments.findMany({ where: and(eq(userCredentialDocuments.ownerUserId, user.id), eq(userCredentialDocuments.userCredentialRecordId, record.id)), orderBy: [asc(userCredentialDocuments.capturedAt)] }),
    db.query.userCredentialFacts.findMany({ where: and(eq(userCredentialFacts.ownerUserId, user.id), eq(userCredentialFacts.userCredentialRecordId, record.id)), orderBy: [asc(userCredentialFacts.factKey)] }),
    db.query.userCredentialVerifications.findMany({ where: and(eq(userCredentialVerifications.ownerUserId, user.id), eq(userCredentialVerifications.userCredentialRecordId, record.id)), orderBy: [desc(userCredentialVerifications.requestedAt)] }),
  ])
  return ok(c, { record, documents, facts, verifications })
})

credentialExchangeRoutes.patch('/me/credentials/:recordId', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const parsed = credentialRecordBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential record body.', 400, parsed.error.flatten())
  const existing = await db.query.userCredentialRecords.findFirst({ where: and(eq(userCredentialRecords.ownerUserId, user.id), eq(userCredentialRecords.id, c.req.param('recordId'))) })
  if (!existing) return fail(c, 'NOT_FOUND', 'Credential record not found.', 404)
  const [row] = await db.update(userCredentialRecords).set({
    credentialTypeDefinitionId: parsed.data.credentialTypeDefinitionId ?? existing.credentialTypeDefinitionId,
    credentialTypeKey: parsed.data.credentialTypeKey ? sanitizePlainText(parsed.data.credentialTypeKey) : existing.credentialTypeKey,
    credentialKey: parsed.data.credentialKey ? sanitizePlainText(parsed.data.credentialKey) : existing.credentialKey,
    displayName: parsed.data.displayName === undefined ? existing.displayName : sanitizeText(parsed.data.displayName),
    issuerName: parsed.data.issuerName === undefined ? existing.issuerName : sanitizeText(parsed.data.issuerName),
    issuerCountry: parsed.data.issuerCountry === undefined ? existing.issuerCountry : parsed.data.issuerCountry,
    issuerRegion: parsed.data.issuerRegion === undefined ? existing.issuerRegion : sanitizeText(parsed.data.issuerRegion),
    credentialNumberHash: parsed.data.credentialNumberHash === undefined ? existing.credentialNumberHash : sanitizeText(parsed.data.credentialNumberHash),
    issuedAt: parsed.data.issuedAt === undefined ? existing.issuedAt : asDate(parsed.data.issuedAt),
    expiresAt: parsed.data.expiresAt === undefined ? existing.expiresAt : asDate(parsed.data.expiresAt),
    lastVerifiedAt: parsed.data.lastVerifiedAt === undefined ? existing.lastVerifiedAt : asDate(parsed.data.lastVerifiedAt),
    nextReverificationAt:
      parsed.data.nextReverificationAt === undefined ? existing.nextReverificationAt : asDate(parsed.data.nextReverificationAt),
    status: (parsed.data.status ?? existing.status) as 'active' | 'draft' | 'inactive' | 'suspended' | 'archived',
    verificationStatus: parsed.data.verificationStatus ?? existing.verificationStatus,
    discoveryVisibility: parsed.data.discoveryVisibility ?? existing.discoveryVisibility,
    isShareable: parsed.data.isShareable ?? existing.isShareable,
    summary: parsed.data.summary === undefined ? (existing.summary as Record<string, unknown> ?? {}) : cleanRecord(parsed.data.summary),
    attributes:
      parsed.data.attributes === undefined ? (existing.attributes as Record<string, unknown> ?? {}) : cleanRecord(parsed.data.attributes),
    metadata: parsed.data.metadata === undefined ? (existing.metadata as Record<string, unknown> ?? {}) : cleanRecord(parsed.data.metadata),
  }).where(eq(userCredentialRecords.id, existing.id)).returning()
  return ok(c, row)
})

credentialExchangeRoutes.post('/me/credentials/:recordId/documents', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const recordId = c.req.param('recordId')
  const record = await db.query.userCredentialRecords.findFirst({ where: and(eq(userCredentialRecords.ownerUserId, user.id), eq(userCredentialRecords.id, recordId)) })
  if (!record) return fail(c, 'NOT_FOUND', 'Credential record not found.', 404)
  const parsed = credentialDocumentBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential document body.', 400, parsed.error.flatten())
  const [row] = await db.insert(userCredentialDocuments).values({
    ownerUserId: user.id,
    userCredentialRecordId: record.id,
    documentType: sanitizePlainText(parsed.data.documentType),
    storageRef: sanitizePlainText(parsed.data.storageRef),
    fileName: sanitizeText(parsed.data.fileName),
    mimeType: sanitizeText(parsed.data.mimeType),
    fileSizeBytes: parsed.data.fileSizeBytes ?? null,
    sha256: sanitizeText(parsed.data.sha256),
    capturedAt: asDate(parsed.data.capturedAt) ?? new Date(),
    sourceType: parsed.data.sourceType ?? 'upload',
    sensitivityClass: parsed.data.sensitivityClass ?? 'restricted',
    previewPolicy: parsed.data.previewPolicy ?? 'redacted',
    isPrimary: parsed.data.isPrimary ?? false,
    status: (parsed.data.status ?? 'active') as 'active' | 'draft' | 'inactive' | 'suspended' | 'archived',
    metadata: cleanRecord(parsed.data.metadata),
  }).returning()
  return ok(c, row, 201)
})

credentialExchangeRoutes.post('/me/credentials/:recordId/facts', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const recordId = c.req.param('recordId')
  const record = await db.query.userCredentialRecords.findFirst({ where: and(eq(userCredentialRecords.ownerUserId, user.id), eq(userCredentialRecords.id, recordId)) })
  if (!record) return fail(c, 'NOT_FOUND', 'Credential record not found.', 404)
  const parsed = credentialFactBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential fact body.', 400, parsed.error.flatten())
  const [row] = await db.insert(userCredentialFacts).values({
    ownerUserId: user.id,
    userCredentialRecordId: record.id,
    factKey: sanitizePlainText(parsed.data.factKey),
    valueKey: sanitizeText(parsed.data.valueKey),
    valueText: sanitizeText(parsed.data.valueText),
    valueNumber: parsed.data.valueNumber === null || parsed.data.valueNumber === undefined ? null : String(parsed.data.valueNumber),
    valueBoolean: parsed.data.valueBoolean ?? null,
    valueDate: parsed.data.valueDate ?? null,
    valueTimestamp: asDate(parsed.data.valueTimestamp),
    visibilityMode: parsed.data.visibilityMode ?? 'grant_required',
    isFilterable: parsed.data.isFilterable ?? true,
    metadata: cleanRecord(parsed.data.metadata),
  }).returning()
  return ok(c, row, 201)
})

credentialExchangeRoutes.post('/me/credentials/:recordId/verifications', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const recordId = c.req.param('recordId')
  const record = await db.query.userCredentialRecords.findFirst({ where: and(eq(userCredentialRecords.ownerUserId, user.id), eq(userCredentialRecords.id, recordId)) })
  if (!record) return fail(c, 'NOT_FOUND', 'Credential record not found.', 404)
  const parsed = credentialVerificationBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential verification body.', 400, parsed.error.flatten())
  const [row] = await db.insert(userCredentialVerifications).values({
    ownerUserId: user.id,
    userCredentialRecordId: record.id,
    userCredentialDocumentId: parsed.data.userCredentialDocumentId ?? null,
    verifierType: parsed.data.verifierType ?? 'system',
    verifierBizId: parsed.data.verifierBizId ?? null,
    verifierUserId: parsed.data.verifierUserId ?? null,
    method: parsed.data.method ?? 'manual_review',
    status: parsed.data.status ?? 'pending',
    confidenceScore: parsed.data.confidenceScore ?? null,
    requestedAt: asDate(parsed.data.requestedAt) ?? new Date(),
    decidedAt: asDate(parsed.data.decidedAt),
    verifiedAt: asDate(parsed.data.verifiedAt),
    expiresAt: asDate(parsed.data.expiresAt),
    summary: sanitizeText(parsed.data.summary),
    evidence: cleanRecord(parsed.data.evidence),
    metadata: cleanRecord(parsed.data.metadata),
  }).returning()
  return ok(c, row, 201)
})

credentialExchangeRoutes.get('/bizes/:bizId/credential-candidates', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = candidateDiscoveryQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
  const pageInfo = pagination(parsed.data)
  const grantRows = await db.query.bizCredentialShareGrants.findMany({
    where: and(eq(bizCredentialShareGrants.granteeBizId, bizId), eq(bizCredentialShareGrants.status, 'granted'), eq(bizCredentialShareGrants.allowCandidateSearch, true)),
  })
  const ownerUserIds = Array.from(new Set(grantRows.map((row) => row.ownerUserId)))
  if (ownerUserIds.length === 0) return ok(c, [], 200, { pagination: { page: pageInfo.page, perPage: pageInfo.perPage, total: 0 } })
  const factRows = await db.query.userCredentialFacts.findMany({
    where: and(
      inArray(userCredentialFacts.ownerUserId, ownerUserIds),
      eq(userCredentialFacts.visibilityMode, 'marketplace_summary'),
      eq(userCredentialFacts.isFilterable, true),
      parsed.data.factKey ? eq(userCredentialFacts.factKey, parsed.data.factKey) : undefined,
      parsed.data.valueKey ? eq(userCredentialFacts.valueKey, parsed.data.valueKey) : undefined,
    ),
    orderBy: [asc(userCredentialFacts.factKey)],
  })
  const recordRows = await db.query.userCredentialRecords.findMany({
    where: and(
      inArray(userCredentialRecords.ownerUserId, ownerUserIds),
      parsed.data.credentialTypeKey ? eq(userCredentialRecords.credentialTypeKey, parsed.data.credentialTypeKey) : undefined,
    ),
    orderBy: [asc(userCredentialRecords.displayName), asc(userCredentialRecords.credentialKey)],
  })
  const profileRows = await db.query.userCredentialProfiles.findMany({
    where: and(inArray(userCredentialProfiles.ownerUserId, ownerUserIds), eq(userCredentialProfiles.allowMarketplaceDiscovery, true)),
  })
  const profileMap = new Map(profileRows.map((row) => [row.ownerUserId, row]))
  const factMap = new Map<string, typeof factRows>()
  for (const fact of factRows) {
    const list = factMap.get(fact.ownerUserId) ?? []
    list.push(fact)
    factMap.set(fact.ownerUserId, list)
  }
  const filtered = recordRows.filter((row) => profileMap.has(row.ownerUserId))
  const paged = filtered.slice(pageInfo.offset, pageInfo.offset + pageInfo.perPage).map((row) => ({
    ownerUserId: row.ownerUserId,
    credentialRecordId: row.id,
    credentialTypeKey: row.credentialTypeKey,
    credentialKey: row.credentialKey,
    displayName: row.displayName,
    verificationStatus: row.verificationStatus,
    expiresAt: row.expiresAt,
    publicSummary: profileMap.get(row.ownerUserId)?.publicSummary ?? {},
    facts: (factMap.get(row.ownerUserId) ?? []).filter((fact) => fact.userCredentialRecordId === row.id),
  }))
  return ok(c, paged, 200, { pagination: { page: pageInfo.page, perPage: pageInfo.perPage, total: filtered.length } })
})

credentialExchangeRoutes.get('/bizes/:bizId/credential-share-grants', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const ownerUserId = c.req.query('ownerUserId')
  const rows = await db.query.bizCredentialShareGrants.findMany({
    where: and(eq(bizCredentialShareGrants.granteeBizId, bizId), ownerUserId ? eq(bizCredentialShareGrants.ownerUserId, ownerUserId) : undefined),
    orderBy: [desc(bizCredentialShareGrants.grantedAt)],
  })
  return ok(c, rows)
})

credentialExchangeRoutes.post('/bizes/:bizId/credential-share-grants', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = shareGrantBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential share grant body.', 400, parsed.error.flatten())
  const owner = await requireExistingUser(parsed.data.ownerUserId)
  if (!owner) return fail(c, 'NOT_FOUND', 'Credential owner user not found.', 404)
  const [row] = await db.insert(bizCredentialShareGrants).values({
    ownerUserId: parsed.data.ownerUserId,
    granteeBizId: bizId,
    status: parsed.data.status ?? 'granted',
    accessLevel: parsed.data.accessLevel ?? 'summary',
    scope: parsed.data.scope ?? 'selected_records',
    allowCandidateSearch: parsed.data.allowCandidateSearch ?? false,
    allowFactFiltering: parsed.data.allowFactFiltering ?? true,
    allowDocumentPreview: parsed.data.allowDocumentPreview ?? false,
    allowDocumentDownload: parsed.data.allowDocumentDownload ?? false,
    allowVerificationRequests: parsed.data.allowVerificationRequests ?? true,
    grantedByUserId: parsed.data.grantedByUserId ?? null,
    grantedAt: asDate(parsed.data.grantedAt) ?? new Date(),
    revokedAt: asDate(parsed.data.revokedAt),
    expiresAt: asDate(parsed.data.expiresAt),
    reason: sanitizeText(parsed.data.reason),
    metadata: cleanRecord(parsed.data.metadata),
  }).returning()
  return ok(c, row, 201)
})

credentialExchangeRoutes.patch('/bizes/:bizId/credential-share-grants/:grantId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, grantId } = c.req.param()
  const parsed = shareGrantBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential share grant body.', 400, parsed.error.flatten())
  const existing = await db.query.bizCredentialShareGrants.findFirst({ where: and(eq(bizCredentialShareGrants.granteeBizId, bizId), eq(bizCredentialShareGrants.id, grantId)) })
  if (!existing) return fail(c, 'NOT_FOUND', 'Credential share grant not found.', 404)
  const [row] = await db.update(bizCredentialShareGrants).set({
    status: parsed.data.status ?? existing.status,
    accessLevel: parsed.data.accessLevel ?? existing.accessLevel,
    scope: parsed.data.scope ?? existing.scope,
    allowCandidateSearch: parsed.data.allowCandidateSearch ?? existing.allowCandidateSearch,
    allowFactFiltering: parsed.data.allowFactFiltering ?? existing.allowFactFiltering,
    allowDocumentPreview: parsed.data.allowDocumentPreview ?? existing.allowDocumentPreview,
    allowDocumentDownload: parsed.data.allowDocumentDownload ?? existing.allowDocumentDownload,
    allowVerificationRequests: parsed.data.allowVerificationRequests ?? existing.allowVerificationRequests,
    grantedByUserId: parsed.data.grantedByUserId === undefined ? existing.grantedByUserId : parsed.data.grantedByUserId,
    grantedAt: parsed.data.grantedAt === undefined ? existing.grantedAt : asDate(parsed.data.grantedAt) ?? existing.grantedAt,
    revokedAt: parsed.data.revokedAt === undefined ? existing.revokedAt : asDate(parsed.data.revokedAt),
    expiresAt: parsed.data.expiresAt === undefined ? existing.expiresAt : asDate(parsed.data.expiresAt),
    reason: parsed.data.reason === undefined ? existing.reason : sanitizeText(parsed.data.reason),
    metadata: parsed.data.metadata === undefined ? (existing.metadata as Record<string, unknown> ?? {}) : cleanRecord(parsed.data.metadata),
  }).where(eq(bizCredentialShareGrants.id, existing.id)).returning()
  return ok(c, row)
})

credentialExchangeRoutes.get('/bizes/:bizId/credential-share-grants/:grantId/selectors', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, grantId } = c.req.param()
  const rows = await db.query.bizCredentialShareGrantSelectors.findMany({
    where: and(eq(bizCredentialShareGrantSelectors.granteeBizId, bizId), eq(bizCredentialShareGrantSelectors.bizCredentialShareGrantId, grantId)),
    orderBy: [asc(bizCredentialShareGrantSelectors.selectorType)],
  })
  return ok(c, rows)
})

credentialExchangeRoutes.post('/bizes/:bizId/credential-share-grants/:grantId/selectors', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, grantId } = c.req.param()
  const parsed = shareGrantSelectorBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential share grant selector body.', 400, parsed.error.flatten())
  const [row] = await db.insert(bizCredentialShareGrantSelectors).values({
    ownerUserId: parsed.data.ownerUserId,
    granteeBizId: bizId,
    bizCredentialShareGrantId: grantId,
    selectorType: parsed.data.selectorType,
    isIncluded: parsed.data.isIncluded ?? true,
    credentialRecordId: parsed.data.credentialRecordId ?? null,
    credentialTypeKey: sanitizeText(parsed.data.credentialTypeKey),
    factKey: sanitizeText(parsed.data.factKey),
    metadata: cleanRecord(parsed.data.metadata),
  }).returning()
  return ok(c, row, 201)
})

credentialExchangeRoutes.get('/bizes/:bizId/credential-requests', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const candidateUserId = c.req.query('candidateUserId')
  const rows = await db.query.bizCredentialRequests.findMany({
    where: and(eq(bizCredentialRequests.bizId, bizId), candidateUserId ? eq(bizCredentialRequests.candidateUserId, candidateUserId) : undefined),
    orderBy: [desc(bizCredentialRequests.dueAt), asc(bizCredentialRequests.id)],
  })
  return ok(c, rows)
})

credentialExchangeRoutes.post('/bizes/:bizId/credential-requests', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = credentialRequestBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(bizCredentialRequests).values({
    bizId,
    candidateUserId: parsed.data.candidateUserId,
    requestedByUserId: parsed.data.requestedByUserId ?? null,
    status: parsed.data.status ?? 'open',
    title: sanitizePlainText(parsed.data.title),
    description: sanitizeText(parsed.data.description),
    priority: parsed.data.priority ?? 100,
    dueAt: asDate(parsed.data.dueAt),
    respondedAt: asDate(parsed.data.respondedAt),
    bizCredentialShareGrantId: parsed.data.bizCredentialShareGrantId ?? null,
    sourceSubjectType: sanitizeText(parsed.data.sourceSubjectType),
    sourceSubjectId: sanitizeText(parsed.data.sourceSubjectId),
    requestKey: sanitizeText(parsed.data.requestKey),
    policy: cleanRecord(parsed.data.policy),
    metadata: cleanRecord(parsed.data.metadata),
  }).returning()
  return ok(c, row, 201)
})

credentialExchangeRoutes.patch('/bizes/:bizId/credential-requests/:requestId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, requestId } = c.req.param()
  const parsed = credentialRequestBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential request body.', 400, parsed.error.flatten())
  const existing = await db.query.bizCredentialRequests.findFirst({ where: and(eq(bizCredentialRequests.bizId, bizId), eq(bizCredentialRequests.id, requestId)) })
  if (!existing) return fail(c, 'NOT_FOUND', 'Credential request not found.', 404)
  const [row] = await db.update(bizCredentialRequests).set({
    candidateUserId: parsed.data.candidateUserId ?? existing.candidateUserId,
    requestedByUserId: parsed.data.requestedByUserId === undefined ? existing.requestedByUserId : parsed.data.requestedByUserId,
    status: parsed.data.status ?? existing.status,
    title: parsed.data.title ? sanitizePlainText(parsed.data.title) : existing.title,
    description: parsed.data.description === undefined ? existing.description : sanitizeText(parsed.data.description),
    priority: parsed.data.priority ?? existing.priority,
    dueAt: parsed.data.dueAt === undefined ? existing.dueAt : asDate(parsed.data.dueAt),
    respondedAt: parsed.data.respondedAt === undefined ? existing.respondedAt : asDate(parsed.data.respondedAt),
    bizCredentialShareGrantId: parsed.data.bizCredentialShareGrantId === undefined ? existing.bizCredentialShareGrantId : parsed.data.bizCredentialShareGrantId,
    sourceSubjectType: parsed.data.sourceSubjectType === undefined ? existing.sourceSubjectType : sanitizeText(parsed.data.sourceSubjectType),
    sourceSubjectId: parsed.data.sourceSubjectId === undefined ? existing.sourceSubjectId : sanitizeText(parsed.data.sourceSubjectId),
    requestKey: parsed.data.requestKey === undefined ? existing.requestKey : sanitizeText(parsed.data.requestKey),
    policy: parsed.data.policy === undefined ? (existing.policy as Record<string, unknown> ?? {}) : cleanRecord(parsed.data.policy),
    metadata: parsed.data.metadata === undefined ? (existing.metadata as Record<string, unknown> ?? {}) : cleanRecord(parsed.data.metadata),
  }).where(eq(bizCredentialRequests.id, existing.id)).returning()
  return ok(c, row)
})

credentialExchangeRoutes.get('/bizes/:bizId/credential-requests/:requestId/items', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, requestId } = c.req.param()
  const rows = await db.query.bizCredentialRequestItems.findMany({
    where: and(eq(bizCredentialRequestItems.bizId, bizId), eq(bizCredentialRequestItems.bizCredentialRequestId, requestId)),
    orderBy: [asc(bizCredentialRequestItems.id)],
  })
  return ok(c, rows)
})

credentialExchangeRoutes.post('/bizes/:bizId/credential-requests/:requestId/items', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, requestId } = c.req.param()
  const parsed = credentialRequestItemBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential request item body.', 400, parsed.error.flatten())
  const [row] = await db.insert(bizCredentialRequestItems).values({
    bizId,
    bizCredentialRequestId: requestId,
    candidateUserId: parsed.data.candidateUserId,
    requirementMode: parsed.data.requirementMode ?? 'required',
    selectorType: parsed.data.selectorType,
    credentialRecordId: parsed.data.credentialRecordId ?? null,
    credentialTypeKey: sanitizeText(parsed.data.credentialTypeKey),
    factKey: sanitizeText(parsed.data.factKey),
    factPredicate: parsed.data.factPredicate ?? null,
    minValidityDaysRemaining: parsed.data.minValidityDaysRemaining ?? 0,
    requiredVerificationStatus: parsed.data.requiredVerificationStatus ?? 'verified',
    isSatisfied: parsed.data.isSatisfied ?? false,
    notes: sanitizeText(parsed.data.notes),
    metadata: cleanRecord(parsed.data.metadata),
  }).returning()
  return ok(c, row, 201)
})

credentialExchangeRoutes.get('/me/credential-disclosure-events', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  if (!user) return fail(c, 'UNAUTHORIZED', 'Authentication required.', 401)
  const rows = await db.query.credentialDisclosureEvents.findMany({
    where: eq(credentialDisclosureEvents.ownerUserId, user.id),
    orderBy: [desc(credentialDisclosureEvents.occurredAt)],
  })
  return ok(c, rows)
})

credentialExchangeRoutes.get('/bizes/:bizId/credential-disclosure-events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.credentialDisclosureEvents.findMany({
    where: eq(credentialDisclosureEvents.granteeBizId, bizId),
    orderBy: [desc(credentialDisclosureEvents.occurredAt)],
  })
  return ok(c, rows)
})

credentialExchangeRoutes.post('/bizes/:bizId/credential-disclosure-events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = disclosureEventBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid credential disclosure event body.', 400, parsed.error.flatten())
  const [row] = await db.insert(credentialDisclosureEvents).values({
    ownerUserId: parsed.data.ownerUserId,
    granteeBizId: bizId,
    bizCredentialShareGrantId: parsed.data.bizCredentialShareGrantId ?? null,
    bizCredentialRequestId: parsed.data.bizCredentialRequestId ?? null,
    eventType: parsed.data.eventType,
    credentialRecordId: parsed.data.credentialRecordId ?? null,
    credentialDocumentId: parsed.data.credentialDocumentId ?? null,
    actorType: parsed.data.actorType ?? 'system',
    actorUserId: parsed.data.actorUserId ?? null,
    occurredAt: asDate(parsed.data.occurredAt) ?? new Date(),
    requestRef: sanitizeText(parsed.data.requestRef),
    details: cleanRecord(parsed.data.details),
    metadata: cleanRecord(parsed.data.metadata),
  }).returning()
  return ok(c, row, 201)
})
