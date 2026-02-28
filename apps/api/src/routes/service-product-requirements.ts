/**
 * Service-product requirement routes.
 *
 * ELI5:
 * A service product can say "to sell/book this, I need these kinds of
 * resources". Example:
 * - one host with GP capability
 * - one asset that is a training car
 * - one venue in location X
 *
 * Why this route matters:
 * equipment/service matching should be modeled through first-class selectors,
 * not hidden in free-form metadata.
 */

import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok } from './_api.js'

const {
  db,
  serviceProductRequirementGroups,
  serviceProductRequirementSelectors,
  serviceProducts,
} = dbPackage

const requirementGroupBodySchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  targetResourceType: z.enum(['host', 'company_host', 'asset', 'venue']),
  requirementMode: z.enum(['required', 'optional']).default('required'),
  minQuantity: z.number().int().min(0).default(1),
  maxQuantity: z.number().int().min(0).optional(),
  selectorMatchMode: z.enum(['any', 'all']).default('any'),
  allowSubstitution: z.boolean().default(true),
  sortOrder: z.number().int().default(100),
  description: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const selectorBodySchema = z.object({
  selectorType: z.enum(['resource', 'resource_type', 'capability_template', 'location', 'custom_subject']),
  isIncluded: z.boolean().default(true),
  resourceId: z.string().optional(),
  resourceType: z.enum(['host', 'company_host', 'asset', 'venue']).optional(),
  capabilityTemplateId: z.string().optional(),
  locationId: z.string().optional(),
  subjectType: z.string().max(80).optional(),
  subjectId: z.string().max(140).optional(),
  sortOrder: z.number().int().default(100),
  description: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const serviceProductRequirementRoutes = new Hono()

serviceProductRequirementRoutes.get(
  '/bizes/:bizId/service-products/:serviceProductId/requirement-groups',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('services.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, serviceProductId } = c.req.param()
    const groups = await db.query.serviceProductRequirementGroups.findMany({
      where: and(
        eq(serviceProductRequirementGroups.bizId, bizId),
        eq(serviceProductRequirementGroups.serviceProductId, serviceProductId),
      ),
      orderBy: [asc(serviceProductRequirementGroups.sortOrder), asc(serviceProductRequirementGroups.name)],
    })
    return ok(c, groups)
  },
)

serviceProductRequirementRoutes.post(
  '/bizes/:bizId/service-products/:serviceProductId/requirement-groups',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('services.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, serviceProductId } = c.req.param()
    const parsed = requirementGroupBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const serviceProduct = await db.query.serviceProducts.findFirst({
      where: and(eq(serviceProducts.bizId, bizId), eq(serviceProducts.id, serviceProductId)),
      columns: { id: true },
    })
    if (!serviceProduct) return fail(c, 'NOT_FOUND', 'Service product not found.', 404)

    const [created] = await db.insert(serviceProductRequirementGroups).values({
      bizId,
      serviceProductId,
      name: sanitizePlainText(parsed.data.name),
      slug: parsed.data.slug,
      targetResourceType: parsed.data.targetResourceType,
      requirementMode: parsed.data.requirementMode,
      minQuantity: parsed.data.minQuantity,
      maxQuantity: parsed.data.maxQuantity ?? null,
      selectorMatchMode: parsed.data.selectorMatchMode,
      allowSubstitution: parsed.data.allowSubstitution,
      sortOrder: parsed.data.sortOrder,
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

serviceProductRequirementRoutes.get(
  '/bizes/:bizId/service-products/:serviceProductId/requirement-groups/:groupId/selectors',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('services.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, groupId } = c.req.param()
    const selectors = await db.query.serviceProductRequirementSelectors.findMany({
      where: and(
        eq(serviceProductRequirementSelectors.bizId, bizId),
        eq(serviceProductRequirementSelectors.requirementGroupId, groupId),
      ),
      orderBy: [asc(serviceProductRequirementSelectors.sortOrder)],
    })
    return ok(c, selectors)
  },
)

serviceProductRequirementRoutes.post(
  '/bizes/:bizId/service-products/:serviceProductId/requirement-groups/:groupId/selectors',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('services.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, groupId } = c.req.param()
    const parsed = selectorBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())

    const [created] = await db.insert(serviceProductRequirementSelectors).values({
      bizId,
      requirementGroupId: groupId,
      selectorType: parsed.data.selectorType,
      isIncluded: parsed.data.isIncluded,
      resourceId: parsed.data.resourceId ?? null,
      resourceType: parsed.data.resourceType ?? null,
      capabilityTemplateId: parsed.data.capabilityTemplateId ?? null,
      locationId: parsed.data.locationId ?? null,
      subjectType: parsed.data.selectorType === 'custom_subject' ? parsed.data.subjectType ?? null : null,
      subjectId: parsed.data.selectorType === 'custom_subject' ? parsed.data.subjectId ?? null : null,
      sortOrder: parsed.data.sortOrder,
      description: parsed.data.description ? sanitizePlainText(parsed.data.description) : null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)
