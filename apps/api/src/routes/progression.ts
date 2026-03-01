/**
 * Progression / prerequisite routes.
 *
 * ELI5:
 * A requirement set is a reusable unlock rulebook.
 * Nodes are the individual checks.
 * Edges connect those checks into a graph.
 * Evaluations record "did this learner/subject pass the gate?"
 *
 * Why this route exists:
 * - course gating, onboarding checklists, and unlock flows all need the same
 *   canonical graph model,
 * - the schema already has progression tables,
 * - sagas need an API surface for prerequisite and unlock proofs.
 */

import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import dbPackage from '@bizing/db'
import { requireAclPermission, requireAuth, requireBizAccess } from '../middleware/auth.js'
import { fail, ok } from './_api.js'

const {
  db,
  requirementSets,
  requirementNodes,
  requirementEdges,
  requirementEvaluations,
  requirementEvidenceLinks,
} = dbPackage

const requirementSetBodySchema = z.object({
  name: z.string().min(1).max(220),
  slug: z.string().min(1).max(140),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  evaluationMode: z.enum(['all', 'any', 'threshold']).default('all'),
  minSatisfiedCount: z.number().int().min(0).optional().nullable(),
  passThresholdPercent: z.number().int().min(0).max(100).optional().nullable(),
  version: z.number().int().min(1).default(1),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const requirementNodeBodySchema = z.object({
  requirementSetId: z.string().min(1),
  nodeKey: z.string().min(1).max(140),
  name: z.string().min(1).max(220),
  nodeType: z.enum(['predicate', 'group', 'milestone', 'manual', 'custom']),
  status: z.enum(['draft', 'active', 'inactive', 'suspended', 'archived']).default('active'),
  description: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).default(100),
  weight: z.number().int().min(1).default(1),
  isBlocking: z.boolean().default(true),
  predicateType: z.string().max(140).optional().nullable(),
  predicateConfig: z.record(z.unknown()).optional(),
  targetSubjectType: z.string().max(80).optional().nullable(),
  targetSubjectId: z.string().max(140).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

const requirementEdgeBodySchema = z.object({
  requirementSetId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  edgeType: z.enum(['depends_on', 'unlocks', 'blocks']).default('depends_on'),
  metadata: z.record(z.unknown()).optional(),
})

const requirementEvaluationBodySchema = z.object({
  requirementSetId: z.string().min(1),
  evaluatedSubjectType: z.string().min(1).max(80),
  evaluatedSubjectId: z.string().min(1).max(140),
  contextSubjectType: z.string().max(80).optional().nullable(),
  contextSubjectId: z.string().max(140).optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'passed', 'failed', 'blocked', 'waived', 'expired']).default('pending'),
  requestKey: z.string().max(140).optional().nullable(),
  scorePercent: z.number().int().min(0).max(100).optional().nullable(),
  totalNodeCount: z.number().int().min(0).optional().nullable(),
  satisfiedNodeCount: z.number().int().min(0).optional().nullable(),
  startedAt: z.string().datetime().optional().nullable(),
  evaluatedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  resultSnapshot: z.record(z.unknown()).optional(),
  policySnapshot: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const requirementEvidenceBodySchema = z.object({
  requirementEvaluationId: z.string().min(1),
  requirementNodeId: z.string().optional().nullable(),
  evidenceType: z.enum(['subject', 'external_reference', 'artifact', 'event']),
  subjectType: z.string().max(80).optional().nullable(),
  subjectId: z.string().max(140).optional().nullable(),
  externalReferenceType: z.string().max(80).optional().nullable(),
  externalReferenceId: z.string().max(140).optional().nullable(),
  artifactType: z.string().max(120).optional().nullable(),
  artifactId: z.string().max(180).optional().nullable(),
  eventType: z.string().max(120).optional().nullable(),
  eventId: z.string().max(180).optional().nullable(),
  occurredAt: z.string().datetime().optional().nullable(),
  details: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const progressionRoutes = new Hono()

progressionRoutes.get('/bizes/:bizId/requirement-sets', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.requirementSets.findMany({
    where: eq(requirementSets.bizId, bizId),
    orderBy: [asc(requirementSets.name)],
  })
  return ok(c, rows)
})

progressionRoutes.post('/bizes/:bizId/requirement-sets', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = requirementSetBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(requirementSets).values({
    bizId,
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description ?? null,
    status: parsed.data.status,
    evaluationMode: parsed.data.evaluationMode,
    minSatisfiedCount: parsed.data.minSatisfiedCount ?? null,
    passThresholdPercent: parsed.data.passThresholdPercent ?? null,
    version: parsed.data.version,
    policySnapshot: parsed.data.policySnapshot ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

progressionRoutes.get('/bizes/:bizId/requirement-sets/:requirementSetId/nodes', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const { bizId, requirementSetId } = c.req.param()
  const rows = await db.query.requirementNodes.findMany({
    where: and(eq(requirementNodes.bizId, bizId), eq(requirementNodes.requirementSetId, requirementSetId)),
    orderBy: [asc(requirementNodes.sortOrder), asc(requirementNodes.nodeKey)],
  })
  return ok(c, rows)
})

progressionRoutes.post('/bizes/:bizId/requirement-nodes', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = requirementNodeBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(requirementNodes).values({
    bizId,
    requirementSetId: parsed.data.requirementSetId,
    nodeKey: parsed.data.nodeKey,
    name: parsed.data.name,
    nodeType: parsed.data.nodeType,
    status: parsed.data.status,
    description: parsed.data.description ?? null,
    sortOrder: parsed.data.sortOrder,
    weight: parsed.data.weight,
    isBlocking: parsed.data.isBlocking,
    predicateType: parsed.data.predicateType ?? null,
    targetSubjectType: parsed.data.targetSubjectType ?? null,
    targetSubjectId: parsed.data.targetSubjectId ?? null,
    predicateConfig: parsed.data.predicateConfig ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

progressionRoutes.post('/bizes/:bizId/requirement-edges', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = requirementEdgeBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(requirementEdges).values({
    bizId,
    requirementSetId: parsed.data.requirementSetId,
    fromNodeId: parsed.data.fromNodeId,
    toNodeId: parsed.data.toNodeId,
    edgeType: parsed.data.edgeType,
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

progressionRoutes.get('/bizes/:bizId/requirement-evaluations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.read', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const rows = await db.query.requirementEvaluations.findMany({
    where: eq(requirementEvaluations.bizId, bizId),
    orderBy: [desc(requirementEvaluations.startedAt), desc(requirementEvaluations.id)],
  })
  return ok(c, rows)
})

progressionRoutes.post('/bizes/:bizId/requirement-evaluations', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = requirementEvaluationBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(requirementEvaluations).values({
    bizId,
    requirementSetId: parsed.data.requirementSetId,
    evaluatedSubjectType: parsed.data.evaluatedSubjectType,
    evaluatedSubjectId: parsed.data.evaluatedSubjectId,
    contextSubjectType: parsed.data.contextSubjectType ?? null,
    contextSubjectId: parsed.data.contextSubjectId ?? null,
    status: parsed.data.status,
    requestKey: parsed.data.requestKey ?? null,
    totalNodeCount: parsed.data.totalNodeCount ?? 0,
    satisfiedNodeCount: parsed.data.satisfiedNodeCount ?? 0,
    scorePercent: parsed.data.scorePercent ?? null,
    startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : new Date(),
    evaluatedAt: parsed.data.evaluatedAt ? new Date(parsed.data.evaluatedAt) : null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    resultSnapshot: parsed.data.resultSnapshot ?? {},
    policySnapshot: parsed.data.policySnapshot ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})

progressionRoutes.post('/bizes/:bizId/requirement-evidence-links', requireAuth, requireBizAccess('bizId'), requireAclPermission('bizes.update', { bizIdParam: 'bizId' }), async (c) => {
  const bizId = c.req.param('bizId')
  const parsed = requirementEvidenceBodySchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return fail(c, 'VALIDATION_ERROR', 'Invalid request body.', 400, parsed.error.flatten())
  const [row] = await db.insert(requirementEvidenceLinks).values({
    bizId,
    requirementEvaluationId: parsed.data.requirementEvaluationId,
    requirementNodeId: parsed.data.requirementNodeId ?? null,
    evidenceType: parsed.data.evidenceType,
    subjectType: parsed.data.subjectType ?? null,
    subjectId: parsed.data.subjectId ?? null,
    externalReferenceType: parsed.data.externalReferenceType ?? null,
    externalReferenceId: parsed.data.externalReferenceId ?? null,
    artifactType: parsed.data.artifactType ?? null,
    artifactId: parsed.data.artifactId ?? null,
    eventType: parsed.data.eventType ?? null,
    eventId: parsed.data.eventId ?? null,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
    details: parsed.data.details ?? {},
    metadata: parsed.data.metadata ?? {},
  }).returning()
  return ok(c, row, 201)
})
