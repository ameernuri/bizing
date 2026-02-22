import { z } from 'zod'

/**
 * Canonical scalar values accepted by the pseudo API layer.
 *
 * ELI5:
 * This contract intentionally avoids complex nested payload assumptions so
 * translators/executors can remain deterministic and easy to audit.
 */
export const commandScalarValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

/**
 * Safe condition operators supported by the query/mutation compiler.
 *
 * These operators map 1:1 to SQL snippets generated in the executor so we can
 * reason about behavior without hidden ORM magic.
 */
export const commandFilterOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'in',
  'is_null',
  'not_null',
])

/**
 * One WHERE-clause condition.
 */
export const commandFilterSchema = z.object({
  column: z.string().min(1),
  op: commandFilterOperatorSchema,
  value: z
    .union([
      commandScalarValueSchema,
      z.array(commandScalarValueSchema),
    ])
    .optional(),
})

/**
 * Sort instructions for query commands.
 */
export const commandSortSchema = z.object({
  column: z.string().min(1),
  direction: z.enum(['asc', 'desc']).default('asc'),
})

/**
 * Canonical read command.
 *
 * This is the only query shape the executor accepts. Every natural-language
 * request is normalized into this structure before SQL compilation.
 */
export const queryCommandSchema = z.object({
  kind: z.literal('query'),
  table: z.string().min(1),
  select: z.array(z.string().min(1)).optional(),
  filters: z.array(commandFilterSchema).default([]),
  sort: z.array(commandSortSchema).default([]),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
})

/**
 * Canonical write command.
 *
 * - insert: requires values
 * - update: requires values and usually filters
 * - delete: usually requires filters
 *
 * "Usually" is intentionally not hardcoded here because certain controlled
 * testing scenarios may intentionally run unfiltered operations in dry runs.
 */
export const mutateCommandSchema = z.object({
  kind: z.literal('mutate'),
  action: z.enum(['insert', 'update', 'delete']),
  table: z.string().min(1),
  values: z.record(z.union([commandScalarValueSchema, z.array(commandScalarValueSchema)])).optional(),
  filters: z.array(commandFilterSchema).default([]),
  returning: z.array(z.string().min(1)).optional(),
})

/**
 * Batch command for workflow-like test plans.
 */
const commandSchemaLazy: z.ZodTypeAny = z.lazy(() =>
  z.union([queryCommandSchema, mutateCommandSchema, batchCommandSchema]),
)

export const batchCommandSchema = z.lazy(() =>
  z.object({
    kind: z.literal('batch'),
    steps: z.array(commandSchemaLazy).min(1),
  }),
)

/**
 * Union command accepted by the agent-contract executor.
 */
export const agentCommandSchema = commandSchemaLazy

/**
 * Shared request scope carried with every pseudo API request.
 *
 * ELI5:
 * This mirrors what the final API auth layer will eventually enforce. During
 * schema testing we can inject scope values explicitly.
 */
export const agentRequestScopeSchema = z.object({
  bizId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  actorUserId: z.string().min(1).optional(),
})

/**
 * Top-level pseudo API request envelope.
 */
export const pseudoApiRequestSchema = z.object({
  requestId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).optional(),
  dryRun: z.boolean().default(true),
  scope: agentRequestScopeSchema.default({}),
  command: agentCommandSchema,
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Optional translator hints for experiments.
 */
export const translationOptionsSchema = z.object({
  forceTable: z.string().min(1).optional(),
  forceAction: z.enum(['query', 'insert', 'update', 'delete']).optional(),
})

/**
 * Natural-language translation request shape.
 */
export const nlTranslationRequestSchema = z.object({
  input: z.string().min(1),
  dryRun: z.boolean().default(true),
  scope: agentRequestScopeSchema.default({}),
  options: translationOptionsSchema.optional(),
})

/**
 * Scenario item used by automated schema test runners.
 */
export const scenarioItemSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  prompt: z.string().min(1).optional(),
  request: pseudoApiRequestSchema.optional(),
  execute: z.boolean().default(true),
  dryRun: z.boolean().optional(),
  scope: agentRequestScopeSchema.optional(),
})

/**
 * Batch scenario run request.
 */
export const scenarioRunRequestSchema = z.object({
  scenarios: z.array(scenarioItemSchema).min(1),
  defaults: z
    .object({
      dryRun: z.boolean().default(true),
      scope: agentRequestScopeSchema.default({}),
    })
    .default({ dryRun: true, scope: {} }),
})

export type CommandScalarValue = z.infer<typeof commandScalarValueSchema>
export type CommandFilter = z.infer<typeof commandFilterSchema>
export type CommandSort = z.infer<typeof commandSortSchema>
export type QueryCommand = z.infer<typeof queryCommandSchema>
export type MutateCommand = z.infer<typeof mutateCommandSchema>
export type BatchCommand = z.infer<typeof batchCommandSchema>
export type AgentCommand = z.infer<typeof agentCommandSchema>
export type AgentRequestScope = z.infer<typeof agentRequestScopeSchema>
export type PseudoApiRequest = z.infer<typeof pseudoApiRequestSchema>
export type NLTranslationRequest = z.infer<typeof nlTranslationRequestSchema>
export type ScenarioRunRequest = z.infer<typeof scenarioRunRequestSchema>

/**
 * Trace row emitted by the executor for explainability.
 */
export type ExecutionTraceStep = {
  stepIndex: number
  kind: AgentCommand['kind']
  table?: string
  sqlPreview: string
  params: unknown[]
  rowCount: number
  dryRun: boolean
}

/**
 * Uniform pseudo API response shape.
 */
export type PseudoApiResponse = {
  requestId: string
  dryRun: boolean
  success: boolean
  commandKind: AgentCommand['kind']
  warnings: string[]
  trace: ExecutionTraceStep[]
  result: unknown
  error?: {
    message: string
    code?: string
    detail?: unknown
  }
}
