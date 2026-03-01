/**
 * HIPAA / PHI control routes.
 *
 * ELI5:
 * These routes expose the healthcare/compliance backbone in a normal API shape.
 * They let the platform:
 * - define "minimum necessary" PHI access policies,
 * - log allowed/denied PHI access attempts,
 * - record break-glass reviews,
 * - manage BAAs and disclosure history,
 * - track security incidents and breach-notification tasks.
 *
 * Why this exists:
 * The schema already models these compliance facts. Without API routes, the
 * sagas and future product UIs cannot validate or operate them directly.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { getCurrentUser, requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  businessAssociateAgreements,
  phiAccessPolicies,
  phiAccessEvents,
  breakGlassReviews,
  phiDisclosureEvents,
  securityIncidents,
  breachNotifications,
} = dbPackage

const lifecycleStatusSchema = z.enum(['draft', 'active', 'inactive', 'suspended', 'archived'])

const phiPolicyBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140).optional(),
  status: lifecycleStatusSchema.default('active'),
  scope: z.enum(['biz', 'location', 'custom_subject']).default('biz'),
  locationId: z.string().optional(),
  subjectRefType: z.string().max(80).optional(),
  subjectRefId: z.string().max(140).optional(),
  sensitivity: z.enum(['low', 'moderate', 'high', 'restricted']).default('high'),
  allowedPurposes: z.array(z.string()).default([]),
  allowedActions: z.array(z.string()).default([]),
  requireAuthorization: z.boolean().default(false),
  requireMfa: z.boolean().default(false),
  requireBreakGlassJustification: z.boolean().default(true),
  policy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.scope === 'location' && !value.locationId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'locationId is required when scope=location.' })
  }
  if (value.scope === 'custom_subject' && (!value.subjectRefType || !value.subjectRefId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'subjectRefType and subjectRefId are required when scope=custom_subject.' })
  }
})

const phiAccessEventBodySchema = z.object({
  phiAccessPolicyId: z.string().optional(),
  hipaaAuthorizationId: z.string().optional(),
  targetType: z.string().min(1).max(120),
  targetRefId: z.string().min(1).max(140),
  subjectUserId: z.string().optional(),
  subjectGroupAccountId: z.string().optional(),
  subjectExternalRef: z.string().max(200).optional(),
  purposeOfUse: z.enum(['treatment', 'payment', 'operations', 'public_health', 'research', 'legal', 'individual_request', 'emergency', 'other']),
  action: z.enum(['view', 'create', 'update', 'delete', 'export', 'print', 'disclose', 'read', 'share']).transform((value) => {
    if (value === 'read') return 'view'
    if (value === 'share') return 'disclose'
    return value
  }),
  decision: z.enum(['allowed', 'denied']).default('allowed'),
  isBreakGlass: z.boolean().default(false),
  breakGlassReason: z.string().max(4000).optional(),
  requestRef: z.string().max(200).optional(),
  sourceIp: z.string().max(80).optional(),
  userAgent: z.string().max(500).optional(),
  fieldsAccessed: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
})

const breakGlassReviewBodySchema = z.object({
  phiAccessEventId: z.string().min(1),
  status: z.enum(['pending', 'approved', 'rejected', 'escalated']).default('pending'),
  reviewedAt: z.string().datetime().optional(),
  summary: z.string().max(4000).optional(),
  securityIncidentId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const baaBodySchema = z.object({
  complianceProfileId: z.string().optional(),
  partyType: z.enum(['extension_install', 'vendor_org', 'vendor', 'subcontractor', 'processor', 'partner', 'other']).transform((value) => {
    if (value === 'vendor' || value === 'processor' || value === 'partner') return 'vendor_org'
    return value
  }),
  partyName: z.string().min(1).max(220),
  partyExternalRef: z.string().max(200).optional(),
  bizExtensionInstallId: z.string().optional(),
  status: z.enum(['draft', 'active', 'suspended', 'terminated', 'expired']).default('draft'),
  agreementVersion: z.string().max(60).default('1.0'),
  contractRef: z.string().max(200).optional(),
  documentRef: z.string().max(600).optional(),
  allowsPhiProcessing: z.boolean().default(false),
  requiresSubcontractorFlowDown: z.boolean().default(true),
  breachNoticeWindowHours: z.number().int().min(1).max(720).default(72),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  signedAt: z.string().datetime().optional(),
  terminatedAt: z.string().datetime().optional(),
  obligations: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const disclosureBodySchema = z.object({
  complianceProfileId: z.string().optional(),
  subjectUserId: z.string().optional(),
  subjectGroupAccountId: z.string().optional(),
  subjectExternalRef: z.string().max(200).optional(),
  recipientType: z.enum(['provider', 'payer', 'business_associate', 'legal_authority', 'public_health_authority', 'patient', 'individual', 'other']).transform((value) => {
    if (value === 'patient') return 'individual'
    return value
  }),
  recipientName: z.string().min(1).max(260),
  recipientRef: z.string().max(200).optional(),
  purposeOfUse: z.enum(['treatment', 'payment', 'operations', 'public_health', 'research', 'legal', 'individual_request', 'emergency', 'patient_request', 'other']).transform((value) => {
    if (value === 'patient_request') return 'individual_request'
    return value
  }),
  disclosedAt: z.string().datetime().optional(),
  dataClasses: z.array(z.string()).default([]),
  legalBasis: z.string().max(220).optional(),
  isTpoExempt: z.boolean().default(false),
  hipaaAuthorizationId: z.string().optional(),
  businessAssociateAgreementId: z.string().optional(),
  requestRef: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const securityIncidentBodySchema = z.object({
  complianceProfileId: z.string().optional(),
  incidentType: z.enum(['unauthorized_access', 'unauthorized_disclosure', 'data_loss', 'device_loss', 'misconfiguration', 'malware', 'credential_compromise', 'other']).transform((value) => {
    if (value === 'unauthorized_disclosure') return 'improper_disclosure'
    if (value === 'data_loss' || value === 'device_loss') return 'data_loss_or_theft'
    if (value === 'misconfiguration' || value === 'credential_compromise') return 'integrity_compromise'
    if (value === 'malware') return 'ransomware'
    return value
  }),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  status: z.enum(['open', 'investigating', 'contained', 'resolved', 'reported', 'closed']).default('open'),
  summary: z.string().min(1).max(800),
  details: z.record(z.unknown()).optional(),
  affectedRecordsCount: z.number().int().min(0).optional(),
  detectedAt: z.string().datetime().optional(),
  containedAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const breachNotificationBodySchema = z.object({
  securityIncidentId: z.string().min(1),
  recipientType: z.enum(['individual', 'affected_individual', 'regulator', 'media', 'business_associate', 'other']).transform((value) => {
    if (value === 'individual') return 'affected_individual'
    return value
  }),
  recipientName: z.string().max(260).optional(),
  recipientRef: z.string().max(200).optional(),
  channel: z.enum(['email', 'sms', 'postal', 'voice', 'webhook', 'push']).default('email'),
  status: z.enum(['draft', 'scheduled', 'sent', 'failed', 'cancelled']).default('draft'),
  dueAt: z.string().datetime().optional(),
  sentAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

function buildScopeRefKey(input: {
  scope: 'biz' | 'location' | 'custom_subject'
  locationId?: string
  subjectRefType?: string
  subjectRefId?: string
}) {
  if (input.scope === 'biz') return 'biz'
  if (input.scope === 'location') return `location:${input.locationId}`
  return `subject:${input.subjectRefType}:${input.subjectRefId}`
}

export const hipaaRoutes = new Hono()

hipaaRoutes.get('/bizes/:bizId/hipaa/access-policies', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.phiAccessPolicies.findMany({
    where: eq(phiAccessPolicies.bizId, bizId),
    orderBy: [asc(phiAccessPolicies.name)],
  })
  return ok(c, rows)
})

hipaaRoutes.post('/bizes/:bizId/hipaa/access-policies', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = phiPolicyBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [created] = await db.insert(phiAccessPolicies).values({
    bizId,
    name: sanitizePlainText(parsed.data.name),
    slug: sanitizePlainText(parsed.data.slug ?? `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`),
    status: parsed.data.status,
    scope: parsed.data.scope,
    scopeRefKey: buildScopeRefKey(parsed.data),
    locationId: parsed.data.scope === 'location' ? parsed.data.locationId ?? null : null,
    subjectRefType: parsed.data.scope === 'custom_subject' ? parsed.data.subjectRefType ?? null : null,
    subjectRefId: parsed.data.scope === 'custom_subject' ? parsed.data.subjectRefId ?? null : null,
    sensitivity: parsed.data.sensitivity,
    allowedPurposes: sanitizeUnknown(parsed.data.allowedPurposes),
    allowedActions: sanitizeUnknown(parsed.data.allowedActions),
    requireAuthorization: parsed.data.requireAuthorization,
    requireMfa: parsed.data.requireMfa,
    requireBreakGlassJustification: parsed.data.requireBreakGlassJustification,
    policy: sanitizeUnknown(parsed.data.policy ?? {}),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  return ok(c, created, 201)
})

hipaaRoutes.get('/bizes/:bizId/hipaa/access-events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.phiAccessEvents.findMany({
    where: eq(phiAccessEvents.bizId, bizId),
    orderBy: [desc(phiAccessEvents.occurredAt)],
  })
  return ok(c, rows)
})

hipaaRoutes.post('/bizes/:bizId/hipaa/access-events', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const currentUser = getCurrentUser(c)
  const parsed = phiAccessEventBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [created] = await db.insert(phiAccessEvents).values({
    bizId,
    phiAccessPolicyId: parsed.data.phiAccessPolicyId ?? null,
    hipaaAuthorizationId: parsed.data.hipaaAuthorizationId ?? null,
    actorUserId: currentUser?.id ?? null,
    targetType: parsed.data.targetType as never,
    targetRefId: parsed.data.targetRefId,
    subjectUserId: parsed.data.subjectUserId ?? null,
    subjectGroupAccountId: parsed.data.subjectGroupAccountId ?? null,
    subjectExternalRef: parsed.data.subjectExternalRef ?? null,
    purposeOfUse: parsed.data.purposeOfUse,
    action: parsed.data.action,
    decision: parsed.data.decision,
    isBreakGlass: parsed.data.isBreakGlass,
    breakGlassReason: parsed.data.breakGlassReason ? sanitizePlainText(parsed.data.breakGlassReason) : null,
    requestRef: parsed.data.requestRef ?? null,
    sourceIp: parsed.data.sourceIp ?? null,
    userAgent: parsed.data.userAgent ?? null,
    fieldsAccessed: sanitizeUnknown(parsed.data.fieldsAccessed),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  return ok(c, created, 201)
})

hipaaRoutes.get('/bizes/:bizId/hipaa/break-glass-reviews', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.breakGlassReviews.findMany({
    where: eq(breakGlassReviews.bizId, bizId),
    orderBy: [desc(breakGlassReviews.reviewedAt)],
  })
  return ok(c, rows)
})

hipaaRoutes.post('/bizes/:bizId/hipaa/break-glass-reviews', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const currentUser = getCurrentUser(c)
  const parsed = breakGlassReviewBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [created] = await db.insert(breakGlassReviews).values({
    bizId,
    phiAccessEventId: parsed.data.phiAccessEventId,
    status: parsed.data.status,
    reviewerUserId: parsed.data.status === 'pending' ? null : currentUser?.id ?? null,
    reviewedAt: parsed.data.status === 'pending' ? null : parsed.data.reviewedAt ? new Date(parsed.data.reviewedAt) : new Date(),
    summary: parsed.data.summary ? sanitizePlainText(parsed.data.summary) : null,
    securityIncidentId: parsed.data.securityIncidentId ?? null,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).onConflictDoUpdate({
    target: [breakGlassReviews.bizId, breakGlassReviews.phiAccessEventId],
    set: {
      status: parsed.data.status,
      reviewerUserId: parsed.data.status === 'pending' ? null : currentUser?.id ?? null,
      reviewedAt: parsed.data.status === 'pending' ? null : parsed.data.reviewedAt ? new Date(parsed.data.reviewedAt) : new Date(),
      summary: parsed.data.summary ? sanitizePlainText(parsed.data.summary) : null,
      securityIncidentId: parsed.data.securityIncidentId ?? null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    },
  }).returning()
  return ok(c, created, 201)
})

hipaaRoutes.get('/bizes/:bizId/hipaa/baas', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.businessAssociateAgreements.findMany({
    where: eq(businessAssociateAgreements.bizId, bizId),
    orderBy: [desc(businessAssociateAgreements.effectiveFrom), asc(businessAssociateAgreements.partyName)],
  })
  return ok(c, rows)
})

hipaaRoutes.post('/bizes/:bizId/hipaa/baas', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = baaBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [created] = await db.insert(businessAssociateAgreements).values({
    bizId,
    complianceProfileId: parsed.data.complianceProfileId ?? null,
    partyType: parsed.data.partyType,
    partyName: sanitizePlainText(parsed.data.partyName),
    partyExternalRef: parsed.data.partyExternalRef ?? null,
    bizExtensionInstallId: parsed.data.bizExtensionInstallId ?? null,
    status: parsed.data.status,
    agreementVersion: parsed.data.agreementVersion,
    contractRef: parsed.data.contractRef ?? null,
    documentRef: parsed.data.documentRef ?? null,
    allowsPhiProcessing: parsed.data.allowsPhiProcessing,
    requiresSubcontractorFlowDown: parsed.data.requiresSubcontractorFlowDown,
    breachNoticeWindowHours: parsed.data.breachNoticeWindowHours,
    effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null,
    effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
    signedAt: parsed.data.signedAt ? new Date(parsed.data.signedAt) : null,
    terminatedAt: parsed.data.terminatedAt ? new Date(parsed.data.terminatedAt) : null,
    obligations: sanitizeUnknown(parsed.data.obligations ?? {}),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  return ok(c, created, 201)
})

hipaaRoutes.get('/bizes/:bizId/hipaa/disclosures', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.phiDisclosureEvents.findMany({
    where: eq(phiDisclosureEvents.bizId, bizId),
    orderBy: [desc(phiDisclosureEvents.disclosedAt)],
  })
  return ok(c, rows)
})

hipaaRoutes.post('/bizes/:bizId/hipaa/disclosures', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const currentUser = getCurrentUser(c)
  const parsed = disclosureBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [created] = await db.insert(phiDisclosureEvents).values({
    bizId,
    complianceProfileId: parsed.data.complianceProfileId ?? null,
    subjectUserId: parsed.data.subjectUserId ?? null,
    subjectGroupAccountId: parsed.data.subjectGroupAccountId ?? null,
    subjectExternalRef: parsed.data.subjectExternalRef ?? null,
    disclosedByUserId: currentUser?.id ?? null,
    recipientType: parsed.data.recipientType,
    recipientName: sanitizePlainText(parsed.data.recipientName),
    recipientRef: parsed.data.recipientRef ?? null,
    purposeOfUse: parsed.data.purposeOfUse,
    disclosedAt: parsed.data.disclosedAt ? new Date(parsed.data.disclosedAt) : new Date(),
    dataClasses: sanitizeUnknown(parsed.data.dataClasses),
    legalBasis: parsed.data.legalBasis ?? null,
    isTpoExempt: parsed.data.isTpoExempt,
    hipaaAuthorizationId: parsed.data.hipaaAuthorizationId ?? null,
    businessAssociateAgreementId: parsed.data.businessAssociateAgreementId ?? null,
    requestRef: parsed.data.requestRef ?? null,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  return ok(c, created, 201)
})

hipaaRoutes.get('/bizes/:bizId/hipaa/security-incidents', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.securityIncidents.findMany({
    where: eq(securityIncidents.bizId, bizId),
    orderBy: [desc(securityIncidents.detectedAt)],
  })
  return ok(c, rows)
})

hipaaRoutes.post('/bizes/:bizId/hipaa/security-incidents', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const currentUser = getCurrentUser(c)
  const parsed = securityIncidentBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [created] = await db.insert(securityIncidents).values({
    bizId,
    complianceProfileId: parsed.data.complianceProfileId ?? null,
    incidentType: parsed.data.incidentType,
    severity: parsed.data.severity,
    status: parsed.data.status,
    summary: sanitizePlainText(parsed.data.summary),
    details: sanitizeUnknown(parsed.data.details ?? {}),
    affectedRecordsCount: parsed.data.affectedRecordsCount ?? null,
    reportedByUserId: currentUser?.id ?? null,
    detectedAt: parsed.data.detectedAt ? new Date(parsed.data.detectedAt) : new Date(),
    containedAt: parsed.data.containedAt ? new Date(parsed.data.containedAt) : null,
    resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null,
    closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  return ok(c, created, 201)
})

hipaaRoutes.patch('/bizes/:bizId/hipaa/security-incidents/:incidentId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, incidentId } = c.req.param()
  const parsed = securityIncidentBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.securityIncidents.findFirst({ where: and(eq(securityIncidents.bizId, bizId), eq(securityIncidents.id, incidentId)) })
  if (!existing) return fail(c, 'NOT_FOUND', 'Security incident not found.', 404)
  const [updated] = await db.update(securityIncidents).set({
    complianceProfileId: parsed.data.complianceProfileId ?? undefined,
    incidentType: parsed.data.incidentType ?? undefined,
    severity: parsed.data.severity ?? undefined,
    status: parsed.data.status ?? undefined,
    summary: parsed.data.summary ? sanitizePlainText(parsed.data.summary) : undefined,
    details: parsed.data.details ? sanitizeUnknown(parsed.data.details) : undefined,
    affectedRecordsCount: parsed.data.affectedRecordsCount ?? undefined,
    detectedAt: parsed.data.detectedAt ? new Date(parsed.data.detectedAt) : undefined,
    containedAt: parsed.data.containedAt ? new Date(parsed.data.containedAt) : undefined,
    resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : undefined,
    closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : undefined,
    metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
  }).where(and(eq(securityIncidents.bizId, bizId), eq(securityIncidents.id, incidentId))).returning()
  return ok(c, updated)
})

hipaaRoutes.get('/bizes/:bizId/hipaa/breach-notifications', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.breachNotifications.findMany({
    where: eq(breachNotifications.bizId, bizId),
    orderBy: [asc(breachNotifications.dueAt)],
  })
  return ok(c, rows)
})

hipaaRoutes.post('/bizes/:bizId/hipaa/breach-notifications', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = breachNotificationBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [created] = await db.insert(breachNotifications).values({
    bizId,
    securityIncidentId: parsed.data.securityIncidentId,
    recipientType: parsed.data.recipientType,
    recipientName: parsed.data.recipientName ? sanitizePlainText(parsed.data.recipientName) : null,
    recipientRef: parsed.data.recipientRef ?? null,
    channel: parsed.data.channel,
    status: parsed.data.status,
    dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
    sentAt: parsed.data.sentAt ? new Date(parsed.data.sentAt) : null,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  return ok(c, created, 201)
})

hipaaRoutes.patch('/bizes/:bizId/hipaa/breach-notifications/:notificationId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, notificationId } = c.req.param()
  const parsed = breachNotificationBodySchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.breachNotifications.findFirst({ where: and(eq(breachNotifications.bizId, bizId), eq(breachNotifications.id, notificationId)) })
  if (!existing) return fail(c, 'NOT_FOUND', 'Breach notification not found.', 404)
  const [updated] = await db.update(breachNotifications).set({
    securityIncidentId: parsed.data.securityIncidentId ?? undefined,
    recipientType: parsed.data.recipientType ?? undefined,
    recipientName: parsed.data.recipientName ? sanitizePlainText(parsed.data.recipientName) : undefined,
    recipientRef: parsed.data.recipientRef ?? undefined,
    channel: parsed.data.channel ?? undefined,
    status: parsed.data.status ?? undefined,
    dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
    sentAt: parsed.data.sentAt ? new Date(parsed.data.sentAt) : undefined,
    metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
  }).where(and(eq(breachNotifications.bizId, bizId), eq(breachNotifications.id, notificationId))).returning()
  return ok(c, updated)
})
