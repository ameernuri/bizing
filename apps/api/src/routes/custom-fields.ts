/**
 * Custom field routes.
 *
 * ELI5:
 * A custom field is "the business made up its own extra question/data point."
 *
 * Examples:
 * - pet breed on a grooming booking
 * - preferred instructor on a customer profile
 * - internal color code on a service product
 *
 * Why this route family exists:
 * - the schema already had generic custom-field tables
 * - without routes, those tables are just hidden capability
 * - this API makes custom fields first-class and reusable across many target
 *   types without baking industry-specific columns into core tables
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'

const {
  db,
  customFieldDefinitions,
  customFieldDefinitionOptions,
  customFieldValues,
} = dbPackage

const customFieldScopes = ['biz', 'location'] as const
const customFieldTargetTypes = [
  'biz',
  'location',
  'user',
  'group_account',
  'resource',
  'service',
  'service_product',
  'offer',
  'offer_version',
  'product',
  'sellable',
  'booking_order',
  'booking_order_line',
  'fulfillment_unit',
  'payment_intent',
  'queue_entry',
  'trip',
  'custom',
] as const
const customFieldDataTypes = [
  'short_text',
  'long_text',
  'number',
  'boolean',
  'date',
  'datetime',
  'single_select',
  'multi_select',
  'currency',
  'email',
  'phone',
  'url',
  'json',
] as const
const customFieldVisibilities = ['public', 'internal', 'private', 'system'] as const
const lifecycleStatuses = ['draft', 'active', 'inactive', 'archived'] as const
const customFieldValueSources = ['user', 'system', 'extension', 'import', 'migration'] as const

const createDefinitionBodySchema = z.object({
  targetType: z.enum(customFieldTargetTypes),
  scope: z.enum(customFieldScopes).default('biz'),
  locationId: z.string().min(1).optional().nullable(),
  fieldKey: z.string().min(1).max(120),
  label: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  dataType: z.enum(customFieldDataTypes),
  visibility: z.enum(customFieldVisibilities).default('internal'),
  status: z.enum(lifecycleStatuses).default('active'),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(100),
  validationSchema: z.record(z.unknown()).optional(),
  defaultValue: z.unknown().optional(),
  helpText: z.string().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const createOptionBodySchema = z.object({
  optionKey: z.string().min(1).max(120),
  label: z.string().min(1).max(200),
  description: z.string().max(800).optional().nullable(),
  sortOrder: z.number().int().min(0).default(100),
  status: z.enum(lifecycleStatuses).default('active'),
  metadata: z.record(z.unknown()).optional(),
})

const upsertValueBodySchema = z.object({
  customFieldDefinitionId: z.string().min(1),
  targetType: z.enum(customFieldTargetTypes),
  targetRefId: z.string().min(1).max(140),
  value: z.unknown(),
  valueTextSearch: z.string().max(500).optional().nullable(),
  valueNumberSearch: z.number().optional().nullable(),
  valueBooleanSearch: z.boolean().optional().nullable(),
  valueDateSearch: z.string().date().optional().nullable(),
  valueTimestampSearch: z.string().datetime().optional().nullable(),
  source: z.enum(customFieldValueSources).default('user'),
  setByUserId: z.string().min(1).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const listDefinitionsQuerySchema = z.object({
  targetType: z.enum(customFieldTargetTypes).optional(),
  scope: z.enum(customFieldScopes).optional(),
  status: z.enum(lifecycleStatuses).optional(),
  locationId: z.string().optional(),
})

const listValuesQuerySchema = z.object({
  targetType: z.enum(customFieldTargetTypes),
  targetRefId: z.string().min(1),
})

export const customFieldRoutes = new Hono()

customFieldRoutes.get(
  '/bizes/:bizId/custom-field-definitions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('custom_fields.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listDefinitionsQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query.', 400, parsed.error.flatten())

    const rows = await db.query.customFieldDefinitions.findMany({
      where: and(
        eq(customFieldDefinitions.bizId, bizId),
        parsed.data.targetType ? eq(customFieldDefinitions.targetType, parsed.data.targetType) : undefined,
        parsed.data.scope ? eq(customFieldDefinitions.scope, parsed.data.scope) : undefined,
        parsed.data.status ? eq(customFieldDefinitions.status, parsed.data.status) : undefined,
        parsed.data.locationId ? eq(customFieldDefinitions.locationId, parsed.data.locationId) : undefined,
      ),
      orderBy: [asc(customFieldDefinitions.targetType), asc(customFieldDefinitions.sortOrder), asc(customFieldDefinitions.fieldKey)],
    })
    return ok(c, rows)
  },
)

customFieldRoutes.post(
  '/bizes/:bizId/custom-field-definitions',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('custom_fields.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createDefinitionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(customFieldDefinitions).values({
      bizId,
      targetType: parsed.data.targetType,
      scope: parsed.data.scope,
      locationId: parsed.data.locationId ?? null,
      fieldKey: sanitizePlainText(parsed.data.fieldKey),
      label: sanitizePlainText(parsed.data.label),
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      dataType: parsed.data.dataType,
      visibility: parsed.data.visibility,
      status: parsed.data.status,
      isRequired: parsed.data.isRequired,
      sortOrder: parsed.data.sortOrder,
      validationSchema: sanitizeUnknown(parsed.data.validationSchema ?? {}),
      defaultValue: parsed.data.defaultValue === undefined ? null : sanitizeUnknown(parsed.data.defaultValue),
      helpText: parsed.data.helpText ? sanitizePlainText(parsed.data.helpText) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

customFieldRoutes.get(
  '/bizes/:bizId/custom-field-definitions/:definitionId/options',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('custom_fields.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, definitionId } = c.req.param()
    const rows = await db.query.customFieldDefinitionOptions.findMany({
      where: and(
        eq(customFieldDefinitionOptions.bizId, bizId),
        eq(customFieldDefinitionOptions.customFieldDefinitionId, definitionId),
      ),
      orderBy: [asc(customFieldDefinitionOptions.sortOrder), asc(customFieldDefinitionOptions.optionKey)],
    })
    return ok(c, rows)
  },
)

customFieldRoutes.post(
  '/bizes/:bizId/custom-field-definitions/:definitionId/options',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('custom_fields.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, definitionId } = c.req.param()
    const parsed = createOptionBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(customFieldDefinitionOptions).values({
      bizId,
      customFieldDefinitionId: definitionId,
      optionKey: sanitizePlainText(parsed.data.optionKey),
      label: sanitizePlainText(parsed.data.label),
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      sortOrder: parsed.data.sortOrder,
      status: parsed.data.status,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

customFieldRoutes.get(
  '/bizes/:bizId/custom-field-values',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('custom_fields.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = listValuesQuerySchema.safeParse(c.req.query())
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid query.', 400, parsed.error.flatten())

    const rows = await db.query.customFieldValues.findMany({
      where: and(
        eq(customFieldValues.bizId, bizId),
        eq(customFieldValues.targetType, parsed.data.targetType),
        eq(customFieldValues.targetRefId, parsed.data.targetRefId),
      ),
      orderBy: [asc(customFieldValues.setAt)],
    })
    return ok(c, rows)
  },
)

customFieldRoutes.post(
  '/bizes/:bizId/custom-field-values',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('custom_fields.write', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = upsertValueBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const existing = await db.query.customFieldValues.findFirst({
      where: and(
        eq(customFieldValues.bizId, bizId),
        eq(customFieldValues.customFieldDefinitionId, parsed.data.customFieldDefinitionId),
        eq(customFieldValues.targetType, parsed.data.targetType),
        eq(customFieldValues.targetRefId, parsed.data.targetRefId),
      ),
    })

    if (existing) {
      const [updated] = await db.update(customFieldValues).set({
        value: sanitizeUnknown(parsed.data.value),
        valueTextSearch: parsed.data.valueTextSearch === undefined ? undefined : parsed.data.valueTextSearch ? sanitizePlainText(parsed.data.valueTextSearch) : null,
        valueNumberSearch:
          parsed.data.valueNumberSearch === undefined || parsed.data.valueNumberSearch === null
            ? null
            : String(parsed.data.valueNumberSearch),
        valueBooleanSearch: parsed.data.valueBooleanSearch ?? null,
        valueDateSearch: parsed.data.valueDateSearch ?? null,
        valueTimestampSearch: parsed.data.valueTimestampSearch ? new Date(parsed.data.valueTimestampSearch) : null,
        source: parsed.data.source,
        setByUserId: parsed.data.setByUserId ?? null,
        setAt: new Date(),
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      }).where(and(eq(customFieldValues.bizId, bizId), eq(customFieldValues.id, existing.id))).returning()
      return ok(c, updated)
    }

    const [created] = await db.insert(customFieldValues).values({
      bizId,
      customFieldDefinitionId: parsed.data.customFieldDefinitionId,
      targetType: parsed.data.targetType,
      targetRefId: parsed.data.targetRefId,
      value: sanitizeUnknown(parsed.data.value),
      valueTextSearch: parsed.data.valueTextSearch ? sanitizePlainText(parsed.data.valueTextSearch) : null,
      valueNumberSearch:
        parsed.data.valueNumberSearch === undefined || parsed.data.valueNumberSearch === null
          ? null
          : String(parsed.data.valueNumberSearch),
      valueBooleanSearch: parsed.data.valueBooleanSearch ?? null,
      valueDateSearch: parsed.data.valueDateSearch ?? null,
      valueTimestampSearch: parsed.data.valueTimestampSearch ? new Date(parsed.data.valueTimestampSearch) : null,
      source: parsed.data.source,
      setByUserId: parsed.data.setByUserId ?? null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)
