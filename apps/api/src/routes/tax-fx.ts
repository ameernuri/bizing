/**
 * Tax + FX routes.
 *
 * ELI5:
 * - FX snapshots remember which exchange rate was used.
 * - Tax profiles/rules describe which tax logic applies.
 * - Tax calculations store the exact tax/FX outcome used at checkout/invoice time.
 *
 * Why this matters:
 * - cross-border checkout should be replayable later,
 * - invoices should keep the rate/currency context they were confirmed with,
 * - saga coverage needs a first-class API, not inferred metadata.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  fxRateSnapshots,
  taxProfiles,
  taxRuleRefs,
  taxCalculations,
} = dbPackage

const rateValueSchema = z.union([z.string(), z.number()]).transform((value) => String(value))

const fxRateBodySchema = z.object({
  baseCurrency: z.string().regex(/^[A-Z]{3}$/),
  quoteCurrency: z.string().regex(/^[A-Z]{3}$/),
  rate: rateValueSchema,
  source: z.enum(['provider', 'manual', 'custom']).default('provider'),
  sourceRef: z.string().max(200).optional(),
  effectiveAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const taxProfileBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  regionCode: z.string().max(80).optional(),
  cityCode: z.string().max(80).optional(),
  postalCodePattern: z.string().max(120).optional(),
  taxInclusiveDefault: z.boolean().default(false),
  roundingPolicy: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const taxRuleBodySchema = z.object({
  taxProfileId: z.string().min(1),
  ruleKey: z.string().min(1).max(140),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  priority: z.number().int().min(0).default(100),
  rateBps: z.number().int().positive().max(100000).optional(),
  flatAmountMinor: z.number().int().min(0).optional(),
  appliesTo: z.record(z.unknown()).optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.rateBps === undefined && value.flatAmountMinor === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide rateBps and/or flatAmountMinor.' })
  }
})

const taxCalculationBodySchema = z.object({
  taxProfileId: z.string().optional(),
  taxRuleRefId: z.string().optional(),
  fxRateSnapshotId: z.string().optional(),
  bookingOrderId: z.string().optional(),
  arInvoiceId: z.string().optional(),
  status: z.enum(['calculated', 'finalized', 'voided']).default('calculated'),
  taxableSubtotalMinor: z.number().int().min(0),
  taxMinor: z.number().int().min(0),
  totalMinor: z.number().int().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/),
  calculatedAt: z.string().datetime().optional(),
  finalizedAt: z.string().datetime().optional(),
  inputSnapshot: z.record(z.unknown()).optional(),
  outputBreakdown: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (!value.bookingOrderId && !value.arInvoiceId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'bookingOrderId or arInvoiceId is required.' })
  }
})

export const taxFxRoutes = new Hono()

taxFxRoutes.get(
  '/bizes/:bizId/fx-rate-snapshots',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.fxRateSnapshots.findMany({
      where: eq(fxRateSnapshots.bizId, bizId),
      orderBy: [desc(fxRateSnapshots.effectiveAt)],
    })
    return ok(c, rows)
  },
)

taxFxRoutes.post(
  '/bizes/:bizId/fx-rate-snapshots',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = fxRateBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(fxRateSnapshots).values({
      bizId,
      baseCurrency: parsed.data.baseCurrency,
      quoteCurrency: parsed.data.quoteCurrency,
      rate: parsed.data.rate,
      source: parsed.data.source,
      sourceRef: parsed.data.sourceRef ?? null,
      effectiveAt: new Date(parsed.data.effectiveAt),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

taxFxRoutes.get(
  '/bizes/:bizId/tax-profiles',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.taxProfiles.findMany({
      where: eq(taxProfiles.bizId, bizId),
      orderBy: [asc(taxProfiles.name)],
    })
    return ok(c, rows)
  },
)

taxFxRoutes.post(
  '/bizes/:bizId/tax-profiles',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = taxProfileBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(taxProfiles).values({
      bizId,
      name: sanitizePlainText(parsed.data.name),
      slug: parsed.data.slug,
      status: parsed.data.status,
      countryCode: parsed.data.countryCode,
      regionCode: parsed.data.regionCode ?? null,
      cityCode: parsed.data.cityCode ?? null,
      postalCodePattern: parsed.data.postalCodePattern ?? null,
      taxInclusiveDefault: parsed.data.taxInclusiveDefault,
      roundingPolicy: sanitizeUnknown(parsed.data.roundingPolicy ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

taxFxRoutes.get(
  '/bizes/:bizId/tax-rule-refs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const taxProfileId = c.req.query('taxProfileId')
    const rows = await db.query.taxRuleRefs.findMany({
      where: and(
        eq(taxRuleRefs.bizId, bizId),
        taxProfileId ? eq(taxRuleRefs.taxProfileId, taxProfileId) : undefined,
      ),
      orderBy: [asc(taxRuleRefs.priority), asc(taxRuleRefs.ruleKey)],
    })
    return ok(c, rows)
  },
)

taxFxRoutes.post(
  '/bizes/:bizId/tax-rule-refs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = taxRuleBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(taxRuleRefs).values({
      bizId,
      taxProfileId: parsed.data.taxProfileId,
      ruleKey: sanitizePlainText(parsed.data.ruleKey),
      status: parsed.data.status,
      priority: parsed.data.priority,
      rateBps: parsed.data.rateBps ?? null,
      flatAmountMinor: parsed.data.flatAmountMinor ?? null,
      appliesTo: sanitizeUnknown(parsed.data.appliesTo ?? {}),
      validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
      validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

taxFxRoutes.get(
  '/bizes/:bizId/tax-calculations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const rows = await db.query.taxCalculations.findMany({
      where: eq(taxCalculations.bizId, bizId),
      orderBy: [desc(taxCalculations.calculatedAt)],
    })
    return ok(c, rows)
  },
)

taxFxRoutes.post(
  '/bizes/:bizId/tax-calculations',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = taxCalculationBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(taxCalculations).values({
      bizId,
      taxProfileId: parsed.data.taxProfileId ?? null,
      taxRuleRefId: parsed.data.taxRuleRefId ?? null,
      fxRateSnapshotId: parsed.data.fxRateSnapshotId ?? null,
      bookingOrderId: parsed.data.bookingOrderId ?? null,
      arInvoiceId: parsed.data.arInvoiceId ?? null,
      status: parsed.data.status,
      taxableSubtotalMinor: parsed.data.taxableSubtotalMinor,
      taxMinor: parsed.data.taxMinor,
      totalMinor: parsed.data.totalMinor,
      currency: parsed.data.currency,
      calculatedAt: parsed.data.calculatedAt ? new Date(parsed.data.calculatedAt) : new Date(),
      finalizedAt: parsed.data.finalizedAt ? new Date(parsed.data.finalizedAt) : null,
      inputSnapshot: sanitizeUnknown(parsed.data.inputSnapshot ?? {}),
      outputBreakdown: sanitizeUnknown(parsed.data.outputBreakdown ?? {}),
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

taxFxRoutes.get(
  '/bizes/:bizId/tax-calculations/:taxCalculationId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, taxCalculationId } = c.req.param()
    const row = await db.query.taxCalculations.findFirst({
      where: and(eq(taxCalculations.bizId, bizId), eq(taxCalculations.id, taxCalculationId)),
    })
    if (!row) return fail(c, 'NOT_FOUND', 'Tax calculation not found.', 404)
    return ok(c, row)
  },
)
