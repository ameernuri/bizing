/**
 * Offer-version component routes.
 *
 * ELI5:
 * An offer version can say "to sell/book this, I need these kinds of
 * resources" directly.
 *
 * Why this exists:
 * - replaces legacy service-product requirement modeling,
 * - keeps requirement buckets on the canonical commercial primitive
 *   (`offer_version`),
 * - lets selector-backed matching stay first-class without detouring through
 *   a parallel catalog model.
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { executeCrudRouteAction } from '../services/action-route-bridge.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  offers,
  offerVersions,
  offerComponents,
  offerComponentSelectors,
} = dbPackage

async function createOfferRequirementRow<
  TTableKey extends 'offerComponents' | 'offerComponentSelectors',
>(
  c: Parameters<typeof executeCrudRouteAction>[0]['c'],
  bizId: string,
  tableKey: TTableKey,
  data: Parameters<typeof executeCrudRouteAction>[0]['data'],
  meta: { subjectType: string; subjectId: string; displayName: string; source: string },
) {
  const result = await executeCrudRouteAction({
    c,
    bizId,
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

const componentBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(140).regex(/^[a-z0-9-]+$/),
  targetType: z.enum(['host', 'company_host', 'asset', 'venue']),
  mode: z.enum(['required', 'optional']).default('required'),
  selectorMatchMode: z.enum(['any', 'all']).default('any'),
  minQuantity: z.number().int().min(0).default(1),
  maxQuantity: z.number().int().min(0).optional(),
  allowSubstitution: z.boolean().default(true),
  sortOrder: z.number().int().default(100),
  description: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const selectorBodySchema = z.object({
  selectorType: z.enum(['resource', 'resource_type', 'capability_template', 'location', 'custom_subject']),
  resourceId: z.string().optional(),
  resourceType: z.enum(['host', 'company_host', 'asset', 'venue']).optional(),
  capabilityTemplateId: z.string().optional(),
  locationId: z.string().optional(),
  subjectType: z.string().max(80).optional(),
  subjectId: z.string().max(140).optional(),
  weight: z.number().int().default(100),
  metadata: z.record(z.unknown()).optional(),
})

export const offerComponentRoutes = new Hono()

offerComponentRoutes.get(
  '/bizes/:bizId/offers/:offerId/versions/:offerVersionId/components',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId, offerVersionId } = c.req.param()

    const version = await db.query.offerVersions.findFirst({
      where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.id, offerVersionId), eq(offerVersions.offerId, offerId)),
      columns: { id: true },
    })
    if (!version) return fail(c, 'NOT_FOUND', 'Offer version not found.', 404)

    const rows = await db.query.offerComponents.findMany({
      where: and(eq(offerComponents.bizId, bizId), eq(offerComponents.offerVersionId, offerVersionId)),
      orderBy: [asc(offerComponents.sortOrder), asc(offerComponents.name)],
    })
    return ok(c, rows)
  },
)

offerComponentRoutes.post(
  '/bizes/:bizId/offers/:offerId/versions/:offerVersionId/components',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId, offerVersionId } = c.req.param()
    const parsed = componentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const parent = await db.query.offerVersions.findFirst({
      where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.id, offerVersionId), eq(offerVersions.offerId, offerId)),
      columns: { id: true },
    })
    if (!parent) return fail(c, 'NOT_FOUND', 'Offer version not found.', 404)

    const created = await createOfferRequirementRow(
      c,
      bizId,
      'offerComponents',
      {
        bizId,
        offerVersionId,
        name: sanitizePlainText(parsed.data.name),
        slug: parsed.data.slug,
        targetType: parsed.data.targetType,
        mode: parsed.data.mode,
        selectorMatchMode: parsed.data.selectorMatchMode,
        minQuantity: parsed.data.minQuantity,
        maxQuantity: parsed.data.maxQuantity ?? null,
        allowSubstitution: parsed.data.allowSubstitution,
        sortOrder: parsed.data.sortOrder,
        description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
      {
        subjectType: 'offer_component',
        subjectId: offerVersionId,
        displayName: parsed.data.name,
        source: 'routes.offerComponents.createComponent',
      },
    )

    return ok(c, created, 201)
  },
)

offerComponentRoutes.get(
  '/bizes/:bizId/offers/:offerId/versions/:offerVersionId/components/:componentId/selectors',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId, offerVersionId, componentId } = c.req.param()

    const component = await db.query.offerComponents.findFirst({
      where: and(eq(offerComponents.bizId, bizId), eq(offerComponents.id, componentId), eq(offerComponents.offerVersionId, offerVersionId)),
      columns: { id: true },
    })
    const parent = component
      ? await db.query.offerVersions.findFirst({
          where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.id, offerVersionId), eq(offerVersions.offerId, offerId)),
          columns: { id: true },
        })
      : null
    if (!component || !parent) {
      return fail(c, 'NOT_FOUND', 'Offer component not found.', 404)
    }

    const rows = await db.query.offerComponentSelectors.findMany({
      where: and(eq(offerComponentSelectors.bizId, bizId), eq(offerComponentSelectors.componentId, componentId)),
      orderBy: [asc(offerComponentSelectors.weight), asc(offerComponentSelectors.id)],
    })
    return ok(c, rows)
  },
)

offerComponentRoutes.post(
  '/bizes/:bizId/offers/:offerId/versions/:offerVersionId/components/:componentId/selectors',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('offers.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, offerId, offerVersionId, componentId } = c.req.param()
    const parsed = selectorBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const component = await db.query.offerComponents.findFirst({
      where: and(eq(offerComponents.bizId, bizId), eq(offerComponents.id, componentId), eq(offerComponents.offerVersionId, offerVersionId)),
      columns: { id: true },
    })
    const parent = component
      ? await db.query.offerVersions.findFirst({
          where: and(eq(offerVersions.bizId, bizId), eq(offerVersions.id, offerVersionId), eq(offerVersions.offerId, offerId)),
          columns: { id: true },
        })
      : null
    if (!component || !parent) {
      return fail(c, 'NOT_FOUND', 'Offer component not found.', 404)
    }

    const created = await createOfferRequirementRow(
      c,
      bizId,
      'offerComponentSelectors',
      {
        bizId,
        componentId,
        selectorType: parsed.data.selectorType,
        resourceId: parsed.data.resourceId ?? null,
        resourceType: parsed.data.resourceType ?? null,
        capabilityTemplateId: parsed.data.capabilityTemplateId ?? null,
        locationId: parsed.data.locationId ?? null,
        subjectType: parsed.data.selectorType === 'custom_subject' ? parsed.data.subjectType ?? null : null,
        subjectId: parsed.data.selectorType === 'custom_subject' ? parsed.data.subjectId ?? null : null,
        weight: parsed.data.weight,
        metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
      },
      {
        subjectType: 'offer_component_selector',
        subjectId: componentId,
        displayName: parsed.data.selectorType,
        source: 'routes.offerComponents.createSelector',
      },
    )

    return ok(c, created, 201)
  },
)
