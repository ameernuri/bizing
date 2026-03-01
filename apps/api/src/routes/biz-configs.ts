/**
 * Biz-config routes.
 *
 * ELI5:
 * These routes let a biz define its own reusable dictionaries instead of
 * hardcoding every status or checklist value in the database forever.
 *
 * Think of them as "boxes of options":
 * - one box for offer statuses
 * - one box for queue-entry statuses
 * - one box for checklist item types
 *
 * Why this matters:
 * - different businesses want different words
 * - one location may want a slightly different vocabulary than another
 * - workflows still need stable internal codes, so values can also map to a
 *   `systemCode`
 *
 * This is intentionally generic so the same backbone can power:
 * - statuses
 * - labels
 * - enum-like choices
 * - future plugin-defined dictionaries
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import {
  getCurrentAuthCredentialId,
  getCurrentAuthSource,
  getCurrentUser,
  requireAclPermission,
  requireAuth,
  requireBizAccess,
} from '../middleware/auth.js'
import { appendAuditEvent } from '../lib/audit-log.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  bizConfigBindings,
  bizConfigSets,
  bizConfigValues,
  bizConfigValueLocalizations,
} = dbPackage

const lifecycleStatuses = ['draft', 'active', 'inactive', 'suspended', 'archived'] as const
const scopeTypes = ['biz', 'location', 'custom_subject'] as const

const createConfigSetBodySchema = z.object({
  locationId: z.string().optional().nullable(),
  setType: z.string().min(1).max(80).default('status'),
  sourceOwnerKey: z.string().max(180).optional().nullable(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9_:-]+$/),
  description: z.string().max(4000).optional().nullable(),
  allowFreeformValues: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const patchConfigSetBodySchema = createConfigSetBodySchema.partial()

const createConfigValueBodySchema = z.object({
  code: z.string().min(1).max(140).regex(/^[a-z0-9_:-]+$/),
  label: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  systemCode: z.string().max(140).optional().nullable(),
  replacedByConfigValueId: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(100),
  colorHint: z.string().max(40).optional().nullable(),
  behavior: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const patchConfigValueBodySchema = createConfigValueBodySchema.partial()

const createLocalizationBodySchema = z.object({
  locale: z.string().min(2).max(35),
  label: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const resolveConfigQuerySchema = z.object({
  targetEntity: z.string().min(1).max(120),
  targetField: z.string().min(1).max(120),
  locationId: z.string().optional(),
  scopeRefType: z.string().max(80).optional(),
  scopeRefId: z.string().optional(),
})

const retireConfigValueBodySchema = z.object({
  replacementConfigValueId: z.string().optional().nullable(),
  updateBindingsDefault: z.boolean().default(true),
  reason: z.string().max(400).optional().nullable(),
})

const configMigrationPreviewBodySchema = z.object({
  setSlug: z.string().min(1).max(140),
  targetEntity: z.string().min(1).max(120),
  targetField: z.string().min(1).max(120),
  locationId: z.string().optional().nullable(),
  incomingValues: z.array(
    z.object({
      code: z.string().min(1).max(140),
      label: z.string().min(1).max(200),
      description: z.string().max(4000).optional().nullable(),
      systemCode: z.string().max(140).optional().nullable(),
      isDefault: z.boolean().default(false),
      isActive: z.boolean().default(true),
      sortOrder: z.number().int().min(0).default(100),
    }),
  ),
})

const configMigrationApplyBodySchema = configMigrationPreviewBodySchema.extend({
  apply: z.boolean().default(true),
})

const createBindingBodyBaseSchema = z.object({
  configSetId: z.string().min(1),
  locationId: z.string().optional().nullable(),
  scopeRefType: z.string().max(80).optional().nullable(),
  scopeRefId: z.string().optional().nullable(),
  targetEntity: z.string().min(1).max(120),
  targetField: z.string().min(1).max(120),
  isPrimary: z.boolean().default(true),
  isStrict: z.boolean().default(true),
  defaultConfigValueId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const createBindingBodySchema = createBindingBodyBaseSchema.superRefine((value, ctx) => {
  const count = Number(Boolean(value.scopeRefType)) + Number(Boolean(value.scopeRefId))
  if (count === 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scopeRefType and scopeRefId must be provided together.' })
  }
})

const patchBindingBodySchema = createBindingBodyBaseSchema.partial().superRefine((value, ctx) => {
  const count = Number(Boolean(value.scopeRefType)) + Number(Boolean(value.scopeRefId))
  if (count === 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scopeRefType and scopeRefId must be provided together.' })
  }
})

const seedPackBodySchema = z.object({
  industryKey: z.string().min(1).max(120),
  locationId: z.string().optional().nullable(),
  targetEntity: z.string().default('offers'),
  targetField: z.string().default('status'),
  setType: z.string().default('status'),
  setSlug: z.string().max(140).optional(),
  setName: z.string().max(200).optional(),
})

function auditActorTypeFromSource(source: string | null | undefined) {
  if (source === 'api_key') return 'api_key' as const
  if (source === 'integration') return 'integration' as const
  if (source === 'system') return 'system' as const
  return 'user' as const
}

function buildPackSeed(industryKey: string) {
  const normalized = industryKey.toLowerCase()
  return {
    packKey: `industry:${normalized}:default-statuses`,
    values: [
      { code: 'draft', label: 'Draft', description: 'Not live yet.', systemCode: 'draft', sortOrder: 10, isDefault: true, isActive: true },
      { code: 'active', label: 'Active', description: 'Live and available.', systemCode: 'active', sortOrder: 20, isDefault: false, isActive: true },
      { code: 'inactive', label: 'Inactive', description: 'Temporarily paused.', systemCode: 'inactive', sortOrder: 30, isDefault: false, isActive: true },
      { code: 'archived', label: 'Archived', description: 'Kept for history only.', systemCode: 'archived', sortOrder: 40, isDefault: false, isActive: true },
    ],
  }
}

async function writeConfigAudit(input: {
  bizId: string
  entityType: string
  entityId: string
  eventType: 'create' | 'update' | 'delete'
  beforeState?: Record<string, unknown> | null
  afterState?: Record<string, unknown> | null
  diff?: Record<string, unknown> | null
  note: string
  c: Parameters<typeof getCurrentUser>[0]
}) {
  const user = getCurrentUser(input.c)
  await appendAuditEvent({
    bizId: input.bizId,
    streamKey: `biz_config:${input.entityType}:${input.entityId}`,
    streamType: 'biz_config',
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    actorType: auditActorTypeFromSource(getCurrentAuthSource(input.c)),
    actorUserId: user?.id ?? null,
    actorRef: getCurrentAuthCredentialId(input.c),
    requestRef: input.c.get('requestId') ?? null,
    note: input.note,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    diff: input.diff ?? null,
    metadata: { routeFamily: 'biz-configs' },
  })
}

function compareBindingSpecificity(row: typeof bizConfigBindings.$inferSelect) {
  if (row.scopeRefType && row.scopeRefId) return 3
  if (row.locationId) return 2
  return 1
}

export const bizConfigRoutes = new Hono()

bizConfigRoutes.get('/bizes/:bizId/config-sets', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.bizConfigSets.findMany({
    where: eq(bizConfigSets.bizId, bizId),
    orderBy: [asc(bizConfigSets.setType), asc(bizConfigSets.name)],
  })
  return ok(c, rows)
})

bizConfigRoutes.post('/bizes/:bizId/config-sets', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createConfigSetBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [created] = await db.insert(bizConfigSets).values({
    bizId,
    locationId: parsed.data.locationId ?? null,
    setType: sanitizePlainText(parsed.data.setType),
    sourceOwnerKey: parsed.data.sourceOwnerKey ?? null,
    name: sanitizePlainText(parsed.data.name),
    slug: parsed.data.slug,
    description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
    allowFreeformValues: parsed.data.allowFreeformValues,
    isActive: parsed.data.isActive,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  await writeConfigAudit({ bizId, entityType: 'biz_config_set', entityId: created.id, eventType: 'create', afterState: created as Record<string, unknown>, note: `Created config set ${created.slug}.`, c })
  return ok(c, created, 201)
})

bizConfigRoutes.patch('/bizes/:bizId/config-sets/:setId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, setId } = c.req.param()
  const parsed = patchConfigSetBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.bizConfigSets.findFirst({ where: and(eq(bizConfigSets.bizId, bizId), eq(bizConfigSets.id, setId)) })
  if (!existing) return fail(c, 'NOT_FOUND', 'Config set not found.', 404)
  const [updated] = await db.update(bizConfigSets).set({
    locationId: parsed.data.locationId === undefined ? undefined : parsed.data.locationId ?? null,
    setType: parsed.data.setType === undefined ? undefined : sanitizePlainText(parsed.data.setType),
    sourceOwnerKey: parsed.data.sourceOwnerKey === undefined ? undefined : parsed.data.sourceOwnerKey ?? null,
    name: parsed.data.name === undefined ? undefined : sanitizePlainText(parsed.data.name),
    slug: parsed.data.slug,
    description: parsed.data.description === undefined ? undefined : parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
    allowFreeformValues: parsed.data.allowFreeformValues,
    isActive: parsed.data.isActive,
    metadata: parsed.data.metadata === undefined ? undefined : sanitizeUnknown(parsed.data.metadata),
  }).where(and(eq(bizConfigSets.bizId, bizId), eq(bizConfigSets.id, setId))).returning()
  await writeConfigAudit({ bizId, entityType: 'biz_config_set', entityId: setId, eventType: 'update', beforeState: existing as Record<string, unknown>, afterState: updated as Record<string, unknown>, diff: sanitizeUnknown(parsed.data as Record<string, unknown>) as Record<string, unknown>, note: `Updated config set ${updated.slug}.`, c })
  return ok(c, updated)
})

bizConfigRoutes.get('/bizes/:bizId/config-sets/:setId/values', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, setId } = c.req.param()
  const rows = await db.query.bizConfigValues.findMany({
    where: and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.configSetId, setId)),
    orderBy: [asc(bizConfigValues.sortOrder), asc(bizConfigValues.label)],
  })
  return ok(c, rows)
})

bizConfigRoutes.get('/bizes/:bizId/config-values/:valueId/localizations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, valueId } = c.req.param()
  const rows = await db.query.bizConfigValueLocalizations.findMany({
    where: and(eq(bizConfigValueLocalizations.bizId, bizId), eq(bizConfigValueLocalizations.configValueId, valueId)),
    orderBy: [asc(bizConfigValueLocalizations.locale)],
  })
  return ok(c, rows)
})

bizConfigRoutes.post('/bizes/:bizId/config-values/:valueId/localizations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, valueId } = c.req.param()
  const parsed = createLocalizationBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const existing = await db.query.bizConfigValueLocalizations.findFirst({
    where: and(
      eq(bizConfigValueLocalizations.bizId, bizId),
      eq(bizConfigValueLocalizations.configValueId, valueId),
      eq(bizConfigValueLocalizations.locale, parsed.data.locale),
    ),
  })

  const [saved] = existing
    ? await db.update(bizConfigValueLocalizations).set({
        label: sanitizePlainText(parsed.data.label),
        description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
        isActive: parsed.data.isActive,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      }).where(and(eq(bizConfigValueLocalizations.bizId, bizId), eq(bizConfigValueLocalizations.id, existing.id))).returning()
    : await db.insert(bizConfigValueLocalizations).values({
        bizId,
        configValueId: valueId,
        locale: parsed.data.locale,
        label: sanitizePlainText(parsed.data.label),
        description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
        isActive: parsed.data.isActive,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      }).returning()

  await writeConfigAudit({
    bizId,
    entityType: 'biz_config_value_localization',
    entityId: saved.id,
    eventType: existing ? 'update' : 'create',
    afterState: saved as Record<string, unknown>,
    note: `${existing ? 'Updated' : 'Created'} localization ${saved.locale} for config value ${valueId}.`,
    c,
  })

  return ok(c, saved, existing ? 200 : 201)
})

bizConfigRoutes.post('/bizes/:bizId/config-sets/:setId/values', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, setId } = c.req.param()
  const parsed = createConfigValueBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [created] = await db.insert(bizConfigValues).values({
    bizId,
    configSetId: setId,
    code: parsed.data.code,
    label: sanitizePlainText(parsed.data.label),
    description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
    systemCode: parsed.data.systemCode ?? null,
    replacedByConfigValueId: parsed.data.replacedByConfigValueId ?? null,
    isDefault: parsed.data.isDefault,
    isActive: parsed.data.isActive,
    sortOrder: parsed.data.sortOrder,
    colorHint: parsed.data.colorHint ?? null,
    behavior: sanitizeUnknown(parsed.data.behavior ?? {}),
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  await writeConfigAudit({ bizId, entityType: 'biz_config_value', entityId: created.id, eventType: 'create', afterState: created as Record<string, unknown>, note: `Created config value ${created.code}.`, c })
  return ok(c, created, 201)
})

bizConfigRoutes.patch('/bizes/:bizId/config-values/:valueId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, valueId } = c.req.param()
  const parsed = patchConfigValueBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.bizConfigValues.findFirst({ where: and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.id, valueId)) })
  if (!existing) return fail(c, 'NOT_FOUND', 'Config value not found.', 404)
  const [updated] = await db.update(bizConfigValues).set({
    code: parsed.data.code,
    label: parsed.data.label === undefined ? undefined : sanitizePlainText(parsed.data.label),
    description: parsed.data.description === undefined ? undefined : parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
    systemCode: parsed.data.systemCode === undefined ? undefined : parsed.data.systemCode ?? null,
    replacedByConfigValueId: parsed.data.replacedByConfigValueId === undefined ? undefined : parsed.data.replacedByConfigValueId ?? null,
    isDefault: parsed.data.isDefault,
    isActive: parsed.data.isActive,
    sortOrder: parsed.data.sortOrder,
    colorHint: parsed.data.colorHint === undefined ? undefined : parsed.data.colorHint ?? null,
    behavior: parsed.data.behavior === undefined ? undefined : sanitizeUnknown(parsed.data.behavior),
    metadata: parsed.data.metadata === undefined ? undefined : sanitizeUnknown(parsed.data.metadata),
  }).where(and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.id, valueId))).returning()
  await writeConfigAudit({ bizId, entityType: 'biz_config_value', entityId: valueId, eventType: 'update', beforeState: existing as Record<string, unknown>, afterState: updated as Record<string, unknown>, diff: sanitizeUnknown(parsed.data as Record<string, unknown>) as Record<string, unknown>, note: `Updated config value ${updated.code}.`, c })
  return ok(c, updated)
})

bizConfigRoutes.post('/bizes/:bizId/config-values/:valueId/retire', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, valueId } = c.req.param()
  const parsed = retireConfigValueBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const existing = await db.query.bizConfigValues.findFirst({
    where: and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.id, valueId)),
  })
  if (!existing) return fail(c, 'NOT_FOUND', 'Config value not found.', 404)

  const [updated] = await db.update(bizConfigValues).set({
    isActive: false,
    replacedByConfigValueId: parsed.data.replacementConfigValueId ?? null,
    metadata: sanitizeUnknown({
      ...((existing.metadata ?? {}) as Record<string, unknown>),
      retiredAt: new Date().toISOString(),
      retiredReason: parsed.data.reason ?? null,
    }),
  }).where(and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.id, valueId))).returning()

  const updatedBindings = parsed.data.updateBindingsDefault && parsed.data.replacementConfigValueId
    ? await db.update(bizConfigBindings).set({
        defaultConfigValueId: parsed.data.replacementConfigValueId,
      }).where(and(eq(bizConfigBindings.bizId, bizId), eq(bizConfigBindings.defaultConfigValueId, valueId))).returning({
        id: bizConfigBindings.id,
        defaultConfigValueId: bizConfigBindings.defaultConfigValueId,
      })
    : []

  await writeConfigAudit({
    bizId,
    entityType: 'biz_config_value',
    entityId: valueId,
    eventType: 'update',
    beforeState: existing as Record<string, unknown>,
    afterState: updated as Record<string, unknown>,
    diff: sanitizeUnknown({
      isActive: false,
      replacedByConfigValueId: parsed.data.replacementConfigValueId ?? null,
      updatedBindingCount: updatedBindings.length,
    }) as Record<string, unknown>,
    note: `Retired config value ${updated.code}.`,
    c,
  })

  return ok(c, { value: updated, updatedBindings })
})

bizConfigRoutes.get('/bizes/:bizId/config-bindings', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.bizConfigBindings.findMany({
    where: eq(bizConfigBindings.bizId, bizId),
    orderBy: [asc(bizConfigBindings.targetEntity), asc(bizConfigBindings.targetField), desc(bizConfigBindings.isPrimary)],
  })
  return ok(c, rows)
})

bizConfigRoutes.get('/bizes/:bizId/config-bindings/resolve', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = resolveConfigQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())

  const rows = await db.query.bizConfigBindings.findMany({
    where: and(
      eq(bizConfigBindings.bizId, bizId),
      eq(bizConfigBindings.targetEntity, parsed.data.targetEntity),
      eq(bizConfigBindings.targetField, parsed.data.targetField),
      eq(bizConfigBindings.isActive, true),
    ),
  })

  const candidates = rows
    .filter((row) => {
      const scopeOk = parsed.data.scopeRefType && parsed.data.scopeRefId
        ? (row.scopeRefType === parsed.data.scopeRefType && row.scopeRefId === parsed.data.scopeRefId) || (!row.scopeRefType && !row.scopeRefId)
        : !row.scopeRefType && !row.scopeRefId
      const locationOk = parsed.data.locationId
        ? row.locationId === parsed.data.locationId || row.locationId === null
        : row.locationId === null
      return scopeOk && locationOk
    })
    .sort((a, b) => {
      const specificity = compareBindingSpecificity(b) - compareBindingSpecificity(a)
      if (specificity !== 0) return specificity
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
      return a.id.localeCompare(b.id)
    })

  return ok(c, {
    resolved: candidates[0] ?? null,
    candidates,
    resolutionOrder: ['scope override', 'location override', 'biz default'],
  })
})

bizConfigRoutes.post('/bizes/:bizId/config-bindings', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = createBindingBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  if (parsed.data.isPrimary) {
    await db.update(bizConfigBindings).set({ isPrimary: false }).where(and(
      eq(bizConfigBindings.bizId, bizId),
      eq(bizConfigBindings.targetEntity, parsed.data.targetEntity),
      eq(bizConfigBindings.targetField, parsed.data.targetField),
      parsed.data.locationId ? eq(bizConfigBindings.locationId, parsed.data.locationId) : isNull(bizConfigBindings.locationId),
      parsed.data.scopeRefType ? eq(bizConfigBindings.scopeRefType, parsed.data.scopeRefType) : isNull(bizConfigBindings.scopeRefType),
      parsed.data.scopeRefId ? eq(bizConfigBindings.scopeRefId, parsed.data.scopeRefId) : isNull(bizConfigBindings.scopeRefId),
    ))
  }
  const [created] = await db.insert(bizConfigBindings).values({
    bizId,
    configSetId: parsed.data.configSetId,
    locationId: parsed.data.locationId ?? null,
    scopeRefType: parsed.data.scopeRefType ?? null,
    scopeRefId: parsed.data.scopeRefId ?? null,
    targetEntity: sanitizePlainText(parsed.data.targetEntity),
    targetField: sanitizePlainText(parsed.data.targetField),
    isPrimary: parsed.data.isPrimary,
    isStrict: parsed.data.isStrict,
    defaultConfigValueId: parsed.data.defaultConfigValueId ?? null,
    isActive: parsed.data.isActive,
    metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
  }).returning()
  await writeConfigAudit({ bizId, entityType: 'biz_config_binding', entityId: created.id, eventType: 'create', afterState: created as Record<string, unknown>, note: `Created config binding ${created.targetEntity}.${created.targetField}.`, c })
  return ok(c, created, 201)
})

bizConfigRoutes.patch('/bizes/:bizId/config-bindings/:bindingId', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, bindingId } = c.req.param()
  const parsed = patchBindingBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const existing = await db.query.bizConfigBindings.findFirst({ where: and(eq(bizConfigBindings.bizId, bizId), eq(bizConfigBindings.id, bindingId)) })
  if (!existing) return fail(c, 'NOT_FOUND', 'Config binding not found.', 404)
  const nextLocationId = parsed.data.locationId === undefined ? existing.locationId : parsed.data.locationId ?? null
  const nextScopeRefType = parsed.data.scopeRefType === undefined ? existing.scopeRefType : parsed.data.scopeRefType ?? null
  const nextScopeRefId = parsed.data.scopeRefId === undefined ? existing.scopeRefId : parsed.data.scopeRefId ?? null
  const nextTargetEntity = parsed.data.targetEntity ?? existing.targetEntity
  const nextTargetField = parsed.data.targetField ?? existing.targetField
  const nextIsPrimary = parsed.data.isPrimary ?? existing.isPrimary
  if (nextIsPrimary) {
    await db.update(bizConfigBindings).set({ isPrimary: false }).where(and(
      eq(bizConfigBindings.bizId, bizId),
      eq(bizConfigBindings.targetEntity, nextTargetEntity),
      eq(bizConfigBindings.targetField, nextTargetField),
      nextLocationId ? eq(bizConfigBindings.locationId, nextLocationId) : isNull(bizConfigBindings.locationId),
      nextScopeRefType ? eq(bizConfigBindings.scopeRefType, nextScopeRefType) : isNull(bizConfigBindings.scopeRefType),
      nextScopeRefId ? eq(bizConfigBindings.scopeRefId, nextScopeRefId) : isNull(bizConfigBindings.scopeRefId),
      eq(bizConfigBindings.isActive, true),
    ))
  }
  const [updated] = await db.update(bizConfigBindings).set({
    configSetId: parsed.data.configSetId,
    locationId: parsed.data.locationId === undefined ? undefined : parsed.data.locationId ?? null,
    scopeRefType: parsed.data.scopeRefType === undefined ? undefined : parsed.data.scopeRefType ?? null,
    scopeRefId: parsed.data.scopeRefId === undefined ? undefined : parsed.data.scopeRefId ?? null,
    targetEntity: parsed.data.targetEntity === undefined ? undefined : sanitizePlainText(parsed.data.targetEntity),
    targetField: parsed.data.targetField === undefined ? undefined : sanitizePlainText(parsed.data.targetField),
    isPrimary: parsed.data.isPrimary,
    isStrict: parsed.data.isStrict,
    defaultConfigValueId: parsed.data.defaultConfigValueId === undefined ? undefined : parsed.data.defaultConfigValueId ?? null,
    isActive: parsed.data.isActive,
    metadata: parsed.data.metadata === undefined ? undefined : sanitizeUnknown(parsed.data.metadata),
  }).where(and(eq(bizConfigBindings.bizId, bizId), eq(bizConfigBindings.id, bindingId))).returning()
  await writeConfigAudit({ bizId, entityType: 'biz_config_binding', entityId: bindingId, eventType: 'update', beforeState: existing as Record<string, unknown>, afterState: updated as Record<string, unknown>, diff: sanitizeUnknown(parsed.data as Record<string, unknown>) as Record<string, unknown>, note: `Updated config binding ${updated.targetEntity}.${updated.targetField}.`, c })
  return ok(c, updated)
})

/**
 * Seed one quick-start config pack.
 *
 * ELI5:
 * This gives a new biz a sensible starter dictionary without making them build
 * every option box by hand on day one.
 */
bizConfigRoutes.post('/bizes/:bizId/config-packs/seed', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = seedPackBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const seed = buildPackSeed(parsed.data.industryKey)
  const setSlug = parsed.data.setSlug ?? `${parsed.data.targetEntity}_${parsed.data.targetField}`
  const setName = parsed.data.setName ?? `${parsed.data.industryKey} ${parsed.data.targetEntity} ${parsed.data.targetField}`
  const existingSet = await db.query.bizConfigSets.findFirst({
    where: and(eq(bizConfigSets.bizId, bizId), eq(bizConfigSets.slug, setSlug), parsed.data.locationId ? eq(bizConfigSets.locationId, parsed.data.locationId) : isNull(bizConfigSets.locationId)),
  })
  const [configSet] = existingSet
    ? [existingSet]
    : await db.insert(bizConfigSets).values({
        bizId,
        locationId: parsed.data.locationId ?? null,
        setType: parsed.data.setType,
        name: sanitizePlainText(setName),
        slug: setSlug,
        description: `Seeded from quick-start pack ${seed.packKey}.`,
        allowFreeformValues: false,
        isActive: true,
        metadata: sanitizeUnknown({ seedPackKey: seed.packKey, seedValues: seed.values }),
      }).returning()

  const createdValues = []
  for (const value of seed.values) {
    const existingValue = await db.query.bizConfigValues.findFirst({
      where: and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.configSetId, configSet.id), eq(bizConfigValues.code, value.code)),
    })
    if (existingValue) {
      createdValues.push(existingValue)
      continue
    }
    const [created] = await db.insert(bizConfigValues).values({
      bizId,
      configSetId: configSet.id,
      code: value.code,
      label: value.label,
      description: value.description,
      systemCode: value.systemCode,
      isDefault: value.isDefault,
      isActive: value.isActive,
      sortOrder: value.sortOrder,
      metadata: sanitizeUnknown({ seedPackKey: seed.packKey }),
    }).returning()
    createdValues.push(created)
  }

  const defaultValue = createdValues.find((row) => row.isDefault) ?? null
  const existingBinding = await db.query.bizConfigBindings.findFirst({
    where: and(eq(bizConfigBindings.bizId, bizId), eq(bizConfigBindings.configSetId, configSet.id), eq(bizConfigBindings.targetEntity, parsed.data.targetEntity), eq(bizConfigBindings.targetField, parsed.data.targetField), parsed.data.locationId ? eq(bizConfigBindings.locationId, parsed.data.locationId) : isNull(bizConfigBindings.locationId)),
  })
  const [binding] = existingBinding
    ? [existingBinding]
    : await db.insert(bizConfigBindings).values({
        bizId,
        configSetId: configSet.id,
        locationId: parsed.data.locationId ?? null,
        targetEntity: parsed.data.targetEntity,
        targetField: parsed.data.targetField,
        isPrimary: true,
        isStrict: true,
        defaultConfigValueId: defaultValue?.id ?? null,
        isActive: true,
        metadata: sanitizeUnknown({ seedPackKey: seed.packKey }),
      }).returning()

  await writeConfigAudit({
    bizId,
    entityType: 'biz_config_pack',
    entityId: seed.packKey,
    eventType: 'create',
    afterState: { configSet, binding, values: createdValues } as Record<string, unknown>,
    note: `Seeded quick-start config pack ${seed.packKey}.`,
    c,
  })
  return ok(c, { packKey: seed.packKey, configSet, binding, values: createdValues }, 201)
})

bizConfigRoutes.get('/bizes/:bizId/config-packs', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.bizConfigSets.findMany({
    where: eq(bizConfigSets.bizId, bizId),
    orderBy: [asc(bizConfigSets.name)],
  })
  const packs = rows
    .filter((row) => {
      const metadata = row.metadata
      return typeof metadata === 'object' && metadata !== null && 'seedPackKey' in metadata
    })
    .map((row) => ({
      packKey: (row.metadata as Record<string, unknown>).seedPackKey,
      configSetId: row.id,
      slug: row.slug,
      locationId: row.locationId,
      name: row.name,
    }))
  return ok(c, packs)
})

bizConfigRoutes.post('/bizes/:bizId/config-packs/:packKey/revert', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, packKey } = c.req.param()
  const set = await db.query.bizConfigSets.findFirst({
    where: and(eq(bizConfigSets.bizId, bizId), eq(bizConfigSets.slug, c.req.query('setSlug') ?? 'offers_status')),
  })
  const targetSet = set ?? await db.query.bizConfigSets.findFirst({
    where: eq(bizConfigSets.bizId, bizId),
    orderBy: [asc(bizConfigSets.name)],
  })
  if (!targetSet) return fail(c, 'NOT_FOUND', 'No seeded config set found to revert.', 404)
  const metadata = (targetSet.metadata ?? {}) as Record<string, unknown>
  const seedValues = Array.isArray(metadata.seedValues) ? metadata.seedValues as Array<Record<string, unknown>> : []
  if (metadata.seedPackKey !== packKey || seedValues.length === 0) {
    return fail(c, 'NOT_FOUND', 'Seed pack metadata was not found on the target set.', 404)
  }

  const currentValues = await db.query.bizConfigValues.findMany({
    where: and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.configSetId, targetSet.id)),
  })

  for (const row of currentValues) {
    const seedRow = seedValues.find((value) => value.code === row.code)
    if (!seedRow) {
      await db.update(bizConfigValues).set({ isActive: false }).where(and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.id, row.id)))
      continue
    }
    await db.update(bizConfigValues).set({
      label: typeof seedRow.label === 'string' ? seedRow.label : row.label,
      description: typeof seedRow.description === 'string' ? seedRow.description : null,
      systemCode: typeof seedRow.systemCode === 'string' ? seedRow.systemCode : null,
      isDefault: seedRow.isDefault === true,
      isActive: seedRow.isActive !== false,
      sortOrder: typeof seedRow.sortOrder === 'number' ? seedRow.sortOrder : row.sortOrder,
    }).where(and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.id, row.id)))
  }

  for (const seedRow of seedValues) {
    const code = typeof seedRow.code === 'string' ? seedRow.code : null
    if (!code || currentValues.some((row) => row.code === code)) continue
    await db.insert(bizConfigValues).values({
      bizId,
      configSetId: targetSet.id,
      code,
      label: typeof seedRow.label === 'string' ? seedRow.label : code,
      description: typeof seedRow.description === 'string' ? seedRow.description : null,
      systemCode: typeof seedRow.systemCode === 'string' ? seedRow.systemCode : null,
      isDefault: seedRow.isDefault === true,
      isActive: seedRow.isActive !== false,
      sortOrder: typeof seedRow.sortOrder === 'number' ? seedRow.sortOrder : 100,
      metadata: sanitizeUnknown({ seedPackKey: packKey }),
    })
  }

  const refreshedValues = await db.query.bizConfigValues.findMany({
    where: and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.configSetId, targetSet.id)),
    orderBy: [asc(bizConfigValues.sortOrder), asc(bizConfigValues.label)],
  })

  await writeConfigAudit({
    bizId,
    entityType: 'biz_config_pack',
    entityId: packKey,
    eventType: 'update',
    afterState: { configSetId: targetSet.id, values: refreshedValues } as Record<string, unknown>,
    note: `Reverted config pack ${packKey} to its seeded defaults.`,
    c,
  })
  return ok(c, { packKey, configSetId: targetSet.id, values: refreshedValues })
})

bizConfigRoutes.post('/bizes/:bizId/config-packs/preview', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = configMigrationPreviewBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const existingSet = await db.query.bizConfigSets.findFirst({
    where: and(
      eq(bizConfigSets.bizId, bizId),
      eq(bizConfigSets.slug, parsed.data.setSlug),
      parsed.data.locationId ? eq(bizConfigSets.locationId, parsed.data.locationId) : isNull(bizConfigSets.locationId),
    ),
  })
  const existingValues = existingSet
    ? await db.query.bizConfigValues.findMany({
        where: and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.configSetId, existingSet.id)),
        orderBy: [asc(bizConfigValues.sortOrder), asc(bizConfigValues.code)],
      })
    : []
  const existingCodes = new Set(existingValues.map((row) => row.code))
  const incomingCodes = new Set(parsed.data.incomingValues.map((row) => row.code))

  return ok(c, {
    setExists: Boolean(existingSet),
    setId: existingSet?.id ?? null,
    diff: {
      create: parsed.data.incomingValues.filter((row) => !existingCodes.has(row.code)).map((row) => row.code),
      update: parsed.data.incomingValues.filter((row) => existingCodes.has(row.code)).map((row) => row.code),
      retire: existingValues.filter((row) => !incomingCodes.has(row.code)).map((row) => row.code),
    },
    bindingTarget: {
      targetEntity: parsed.data.targetEntity,
      targetField: parsed.data.targetField,
      locationId: parsed.data.locationId ?? null,
    },
  })
})

bizConfigRoutes.post('/bizes/:bizId/config-packs/apply', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = configMigrationApplyBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

  const existingSet = await db.query.bizConfigSets.findFirst({
    where: and(
      eq(bizConfigSets.bizId, bizId),
      eq(bizConfigSets.slug, parsed.data.setSlug),
      parsed.data.locationId ? eq(bizConfigSets.locationId, parsed.data.locationId) : isNull(bizConfigSets.locationId),
    ),
  })

  const [configSet] = existingSet
    ? [existingSet]
    : await db.insert(bizConfigSets).values({
        bizId,
        locationId: parsed.data.locationId ?? null,
        setType: 'status',
        name: sanitizePlainText(parsed.data.setSlug.replace(/[_-]+/g, ' ')),
        slug: parsed.data.setSlug,
        description: 'Applied through config promotion workflow.',
        allowFreeformValues: false,
        isActive: true,
        metadata: sanitizeUnknown({ source: 'config_promotion' }),
      }).returning()

  const upserted: string[] = []
  for (const incoming of parsed.data.incomingValues) {
    const existingValue = await db.query.bizConfigValues.findFirst({
      where: and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.configSetId, configSet.id), eq(bizConfigValues.code, incoming.code)),
    })
    if (existingValue) {
      await db.update(bizConfigValues).set({
        label: sanitizePlainText(incoming.label),
        description: incoming.description ? sanitizePlainText(incoming.description) : null,
        systemCode: incoming.systemCode ?? null,
        isDefault: incoming.isDefault,
        isActive: incoming.isActive,
        sortOrder: incoming.sortOrder,
      }).where(and(eq(bizConfigValues.bizId, bizId), eq(bizConfigValues.id, existingValue.id)))
    } else {
      await db.insert(bizConfigValues).values({
        bizId,
        configSetId: configSet.id,
        code: incoming.code,
        label: sanitizePlainText(incoming.label),
        description: incoming.description ? sanitizePlainText(incoming.description) : null,
        systemCode: incoming.systemCode ?? null,
        isDefault: incoming.isDefault,
        isActive: incoming.isActive,
        sortOrder: incoming.sortOrder,
      })
    }
    upserted.push(incoming.code)
  }

  await writeConfigAudit({
    bizId,
    entityType: 'biz_config_pack',
    entityId: configSet.id,
    eventType: 'update',
    afterState: { setSlug: parsed.data.setSlug, upserted } as Record<string, unknown>,
    note: `Applied config promotion pack ${parsed.data.setSlug}.`,
    c,
  })

  return ok(c, { configSetId: configSet.id, upserted, applied: parsed.data.apply })
})
