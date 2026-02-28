/**
 * Extension catalog and tenant-install routes.
 *
 * ELI5:
 * - `extension_definitions` is the app-store catalog entry.
 * - `biz_extension_installs` is one biz saying "we installed that app".
 * - `extension_state_documents` is the app's per-biz saved state.
 *
 * Why this route exists:
 * - saga coverage needs a real API surface to prove plugin/extension state,
 * - tenant isolation should be demonstrated through normal biz-scoped reads,
 * - future extension UIs and agents should reuse one canonical contract.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { sanitizePlainText, sanitizeUnknown } from '../lib/sanitize.js'
import { fail, ok, parsePositiveInt } from './_api.js'

const {
  db,
  bizExtensionInstalls,
  extensionDefinitions,
  extensionStateDocuments,
} = dbPackage

const catalogQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  sourceType: z.enum(['private', 'first_party', 'partner', 'third_party']).optional(),
  runtimeType: z.enum(['internal', 'webhook']).optional(),
})

const createCatalogBodySchema = z.object({
  key: z.string().min(1).max(140).regex(/^[a-z0-9-_]+$/),
  name: z.string().min(1).max(200),
  publisher: z.string().max(200).optional(),
  sourceType: z.enum(['private', 'first_party', 'partner', 'third_party']),
  runtimeType: z.enum(['internal', 'webhook']),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  currentVersion: z.string().max(80).optional(),
  docsUrl: z.string().url().max(1000).optional(),
  homepageUrl: z.string().url().max(1000).optional(),
  description: z.string().max(2000).optional(),
  manifest: z.record(z.unknown()).optional(),
  capabilities: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const installQuerySchema = z.object({
  status: z.enum(['active', 'disabled', 'suspended', 'uninstalled']).optional(),
})

const createInstallBodySchema = z.object({
  extensionDefinitionId: z.string().optional(),
  extensionKey: z.string().optional(),
  status: z.enum(['active', 'disabled', 'suspended', 'uninstalled']).default('active'),
  installedVersion: z.string().max(80).optional(),
  configuration: z.record(z.unknown()).optional(),
  secretRef: z.string().max(255).optional(),
  lastHealthStatus: z.string().max(80).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (!value.extensionDefinitionId && !value.extensionKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either extensionDefinitionId or extensionKey is required.',
    })
  }
})

const updateInstallBodySchema = z.object({
  status: z.enum(['active', 'disabled', 'suspended', 'uninstalled']).optional(),
  installedVersion: z.string().max(80).optional(),
  configuration: z.record(z.unknown()).optional(),
  secretRef: z.string().max(255).optional().nullable(),
  lastHealthStatus: z.string().max(80).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const stateDocumentScopeSchema = z.enum(['biz', 'location', 'custom_subject'])

const createStateDocumentBodySchema = z.object({
  namespace: z.string().min(1).max(120),
  documentKey: z.string().min(1).max(180),
  scope: stateDocumentScopeSchema.default('biz'),
  locationId: z.string().optional(),
  subjectRefType: z.string().max(80).optional(),
  subjectRefId: z.string().max(140).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('active'),
  schemaVersion: z.number().int().positive().default(1),
  payload: z.record(z.unknown()).default({}),
  payloadChecksum: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.scope === 'location' && !value.locationId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'locationId is required when scope=location.' })
  }
  if (value.scope === 'custom_subject' && (!value.subjectRefType || !value.subjectRefId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'subjectRefType and subjectRefId are required when scope=custom_subject.' })
  }
})

const updateStateDocumentBodySchema = z.object({
  namespace: z.string().min(1).max(120).optional(),
  documentKey: z.string().min(1).max(180).optional(),
  scope: stateDocumentScopeSchema.optional(),
  locationId: z.string().optional(),
  subjectRefType: z.string().max(80).optional(),
  subjectRefId: z.string().max(140).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  schemaVersion: z.number().int().positive().optional(),
  payload: z.record(z.unknown()).optional(),
  payloadChecksum: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
  revision: z.number().int().positive().optional(),
})

function pagination(input: { page?: string; perPage?: string }) {
  const page = parsePositiveInt(input.page, 1)
  const perPage = Math.min(parsePositiveInt(input.perPage, 20), 100)
  return { page, perPage, offset: (page - 1) * perPage }
}

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

export const extensionRoutes = new Hono()

async function createCatalogDefinition(input: z.infer<typeof createCatalogBodySchema>) {
  const existing = await db.query.extensionDefinitions.findFirst({
    where: eq(extensionDefinitions.key, input.key),
  })
  if (existing) return { row: existing, created: false as const }

  const [created] = await db.insert(extensionDefinitions).values({
    key: input.key,
    name: sanitizePlainText(input.name),
    publisher: input.publisher ? sanitizePlainText(input.publisher) : null,
    sourceType: input.sourceType,
    runtimeType: input.runtimeType,
    status: input.status,
    currentVersion: input.currentVersion ?? null,
    docsUrl: input.docsUrl ?? null,
    homepageUrl: input.homepageUrl ?? null,
    description: input.description ? sanitizePlainText(input.description) : null,
    manifest: sanitizeUnknown(input.manifest ?? {}),
    capabilities: sanitizeUnknown(input.capabilities ?? {}),
    metadata: sanitizeUnknown(input.metadata ?? {}),
  }).returning()

  return { row: created, created: true as const }
}

extensionRoutes.get(
  '/extensions/catalog',
  requireAuth,
  requireAclPermission('bizes.read'),
  async (c) => {
    const parsed = catalogQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const pageInfo = pagination(parsed.data)
    const where = and(
      parsed.data.status ? eq(extensionDefinitions.status, parsed.data.status) : undefined,
      parsed.data.sourceType ? eq(extensionDefinitions.sourceType, parsed.data.sourceType) : undefined,
      parsed.data.runtimeType ? eq(extensionDefinitions.runtimeType, parsed.data.runtimeType) : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db.query.extensionDefinitions.findMany({
        where,
        orderBy: [asc(extensionDefinitions.name)],
        limit: pageInfo.perPage,
        offset: pageInfo.offset,
      }),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(extensionDefinitions).where(where),
    ])

    const total = countRows[0]?.count ?? 0
    return ok(c, rows, 200, {
      pagination: {
        page: pageInfo.page,
        perPage: pageInfo.perPage,
        total,
        hasMore: pageInfo.page * pageInfo.perPage < total,
      },
    })
  },
)

extensionRoutes.post(
  '/extensions/catalog',
  requireAuth,
  requireAclPermission('bizes.update'),
  async (c) => {
    const parsed = createCatalogBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const result = await createCatalogDefinition(parsed.data)
    return ok(c, result.row, result.created ? 201 : 200)
  },
)

extensionRoutes.post(
  '/bizes/:bizId/extensions/catalog',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const parsed = createCatalogBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const result = await createCatalogDefinition({
      ...parsed.data,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        publisherBizId: c.req.param('bizId'),
      },
    })

    return ok(c, result.row, result.created ? 201 : 200)
  },
)

extensionRoutes.get(
  '/bizes/:bizId/extensions/installs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = installQuerySchema.safeParse(c.req.query())
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid query parameters.', 400, parsed.error.flatten())
    }

    const installs = await db.query.bizExtensionInstalls.findMany({
      where: and(
        eq(bizExtensionInstalls.bizId, bizId),
        parsed.data.status ? eq(bizExtensionInstalls.status, parsed.data.status) : undefined,
      ),
      orderBy: [desc(bizExtensionInstalls.installedAt)],
    })

    return ok(c, installs)
  },
)

extensionRoutes.post(
  '/bizes/:bizId/extensions/installs',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const bizId = c.req.param('bizId')
    const parsed = createInstallBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const definition = parsed.data.extensionDefinitionId
      ? await db.query.extensionDefinitions.findFirst({
          where: eq(extensionDefinitions.id, parsed.data.extensionDefinitionId),
        })
      : await db.query.extensionDefinitions.findFirst({
          where: eq(extensionDefinitions.key, parsed.data.extensionKey as string),
        })

    if (!definition) return fail(c, 'NOT_FOUND', 'Extension definition not found.', 404)

    const existing = await db.query.bizExtensionInstalls.findFirst({
      where: and(
        eq(bizExtensionInstalls.bizId, bizId),
        eq(bizExtensionInstalls.extensionDefinitionId, definition.id),
      ),
    })
    if (existing) return ok(c, existing)

    const [created] = await db.insert(bizExtensionInstalls).values({
      bizId,
      extensionDefinitionId: definition.id,
      status: parsed.data.status,
      installedVersion: parsed.data.installedVersion ?? definition.currentVersion ?? '0.0.0',
      configuration: sanitizeUnknown(parsed.data.configuration ?? {}),
      secretRef: parsed.data.secretRef ?? null,
      lastHealthStatus: parsed.data.lastHealthStatus ?? null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

extensionRoutes.patch(
  '/bizes/:bizId/extensions/installs/:installId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, installId } = c.req.param()
    const parsed = updateInstallBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.bizExtensionInstalls.findFirst({
      where: and(eq(bizExtensionInstalls.bizId, bizId), eq(bizExtensionInstalls.id, installId)),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Extension install not found.', 404)

    const [updated] = await db.update(bizExtensionInstalls).set({
      status: parsed.data.status ?? undefined,
      installedVersion: parsed.data.installedVersion ?? undefined,
      configuration: parsed.data.configuration ? sanitizeUnknown(parsed.data.configuration) : undefined,
      secretRef: parsed.data.secretRef === undefined ? undefined : parsed.data.secretRef,
      lastHealthStatus: parsed.data.lastHealthStatus === undefined ? undefined : parsed.data.lastHealthStatus,
      metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
    }).where(and(eq(bizExtensionInstalls.bizId, bizId), eq(bizExtensionInstalls.id, installId))).returning()

    return ok(c, updated)
  },
)

extensionRoutes.get(
  '/bizes/:bizId/extensions/installs/:installId/state-documents',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.read', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, installId } = c.req.param()
    const rows = await db.query.extensionStateDocuments.findMany({
      where: and(
        eq(extensionStateDocuments.bizId, bizId),
        eq(extensionStateDocuments.bizExtensionInstallId, installId),
      ),
      orderBy: [asc(extensionStateDocuments.namespace), asc(extensionStateDocuments.documentKey)],
    })
    return ok(c, rows)
  },
)

extensionRoutes.post(
  '/bizes/:bizId/extensions/installs/:installId/state-documents',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, installId } = c.req.param()
    const parsed = createStateDocumentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const install = await db.query.bizExtensionInstalls.findFirst({
      where: and(eq(bizExtensionInstalls.bizId, bizId), eq(bizExtensionInstalls.id, installId)),
      columns: { id: true },
    })
    if (!install) return fail(c, 'NOT_FOUND', 'Extension install not found.', 404)

    const scopeRefKey = buildScopeRefKey(parsed.data)
    const existing = await db.query.extensionStateDocuments.findFirst({
      where: and(
        eq(extensionStateDocuments.bizId, bizId),
        eq(extensionStateDocuments.bizExtensionInstallId, installId),
        eq(extensionStateDocuments.namespace, parsed.data.namespace),
        eq(extensionStateDocuments.documentKey, parsed.data.documentKey),
        eq(extensionStateDocuments.scopeRefKey, scopeRefKey),
      ),
    })
    if (existing) return ok(c, existing)

    const [created] = await db.insert(extensionStateDocuments).values({
      bizId,
      bizExtensionInstallId: installId,
      namespace: parsed.data.namespace,
      documentKey: parsed.data.documentKey,
      scope: parsed.data.scope,
      scopeRefKey,
      locationId: parsed.data.scope === 'location' ? parsed.data.locationId ?? null : null,
      subjectRefType: parsed.data.scope === 'custom_subject' ? parsed.data.subjectRefType ?? null : null,
      subjectRefId: parsed.data.scope === 'custom_subject' ? parsed.data.subjectRefId ?? null : null,
      status: parsed.data.status,
      schemaVersion: parsed.data.schemaVersion,
      payload: sanitizeUnknown(parsed.data.payload),
      payloadChecksum: parsed.data.payloadChecksum ?? null,
      metadata: sanitizeUnknown(parsed.data.metadata ?? {}),
    }).returning()

    return ok(c, created, 201)
  },
)

extensionRoutes.patch(
  '/bizes/:bizId/extensions/installs/:installId/state-documents/:documentId',
  requireAuth,
  requireBizAccess('bizId'),
  requireAclPermission('bizes.update', { bizIdParam: 'bizId' }),
  async (c) => {
    const { bizId, installId, documentId } = c.req.param()
    const parsed = updateStateDocumentBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
    }

    const existing = await db.query.extensionStateDocuments.findFirst({
      where: and(
        eq(extensionStateDocuments.bizId, bizId),
        eq(extensionStateDocuments.bizExtensionInstallId, installId),
        eq(extensionStateDocuments.id, documentId),
      ),
    })
    if (!existing) return fail(c, 'NOT_FOUND', 'Extension state document not found.', 404)

    const nextScope = parsed.data.scope ?? existing.scope
    const scopeRefKey = buildScopeRefKey({
      scope: nextScope,
      locationId: parsed.data.locationId ?? existing.locationId ?? undefined,
      subjectRefType: parsed.data.subjectRefType ?? existing.subjectRefType ?? undefined,
      subjectRefId: parsed.data.subjectRefId ?? existing.subjectRefId ?? undefined,
    })

    const [updated] = await db.update(extensionStateDocuments).set({
      namespace: parsed.data.namespace ?? undefined,
      documentKey: parsed.data.documentKey ?? undefined,
      scope: parsed.data.scope ?? undefined,
      scopeRefKey,
      locationId:
        nextScope === 'location'
          ? (parsed.data.locationId ?? existing.locationId ?? null)
          : null,
      subjectRefType:
        nextScope === 'custom_subject'
          ? (parsed.data.subjectRefType ?? existing.subjectRefType ?? null)
          : null,
      subjectRefId:
        nextScope === 'custom_subject'
          ? (parsed.data.subjectRefId ?? existing.subjectRefId ?? null)
          : null,
      status: parsed.data.status ?? undefined,
      revision: parsed.data.revision ?? existing.revision + 1,
      schemaVersion: parsed.data.schemaVersion ?? undefined,
      payload: parsed.data.payload ? sanitizeUnknown(parsed.data.payload) : undefined,
      payloadChecksum: parsed.data.payloadChecksum ?? undefined,
      metadata: parsed.data.metadata ? sanitizeUnknown(parsed.data.metadata) : undefined,
      lastMaterializedAt: new Date(),
    }).where(and(eq(extensionStateDocuments.bizId, bizId), eq(extensionStateDocuments.id, documentId))).returning()

    return ok(c, updated)
  },
)
