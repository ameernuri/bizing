import { z } from 'zod'

/**
 * Canonical saga spec schema.
 *
 * Why this exists:
 * - Gives humans a readable JSON contract for lifecycle simulations.
 * - Gives agents a deterministic shape for execution instructions.
 * - Keeps run generation stable as API/schema evolve.
 *
 * v1 change summary:
 * - Adds first-class simulation controls (virtual clock + scheduler defaults).
 * - Keeps backward parsing for `saga.v0` so existing specs can be normalized.
 */

/** Assertion contract for one saga step. */
export const sagaAssertionSchema = z.object({
  /** Assertion category (api_response, db_effect, acl_guard, etc.). */
  kind: z.string().min(1),
  /** Natural-language assertion description for runner and report output. */
  description: z.string().min(1),
  /** Optional machine-readable expression understood by evaluator plugins. */
  expression: z.string().optional(),
})

/** Evidence item requested by one saga step. */
const sagaEvidenceKindSchema = z.preprocess(
  (value) => {
    // Backward compatibility for existing saga specs written before
    // we standardized wording from "pseudoshot" to "snapshot".
    if (value === 'pseudoshot') return 'snapshot'
    return value
  },
  z.enum(['api_trace', 'snapshot', 'report_note', 'event_ref']),
)

export const sagaEvidenceRequirementSchema = z.object({
  /** Evidence class expected from runner. */
  kind: sagaEvidenceKindSchema,
  /** Friendly label shown in UI/report. */
  label: z.string().min(1),
  /** Optional relative path recommendation for artifact naming. */
  pathHint: z.string().optional(),
})

/** Actor participating in one saga. */
export const sagaActorSchema = z.object({
  actorKey: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  description: z.string().optional(),
  personaRef: z.string().optional(),
})

/**
 * Optional delay/wait behavior before executing one step.
 *
 * ELI5:
 * Some real workflows need time to pass:
 * - fixed wait (advance clock by N ms),
 * - wait-until (poll condition until timeout).
 */
export const sagaStepDelaySchema = z
  .object({
    mode: z.enum(['none', 'fixed', 'until_condition']).default('none'),
    delayMs: z.number().int().positive().optional(),
    conditionKey: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().optional(),
    pollMs: z.number().int().positive().optional(),
    jitterMs: z.number().int().min(0).default(0),
    note: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'fixed' && !value.delayMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "delayMs is required when delay mode is 'fixed'.",
      })
    }
    if (value.mode === 'until_condition' && !value.conditionKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "conditionKey is required when delay mode is 'until_condition'.",
      })
    }
  })

/** One executable saga step. */
export const sagaStepSchema = z.object({
  stepKey: z.string().min(1),
  order: z.number().int().nonnegative(),
  title: z.string().min(1),
  actorKey: z.string().min(1),
  intent: z.string().min(1),
  instruction: z.string().min(1),
  expectedResult: z.string().min(1),
  toolHints: z.array(z.string().min(1)).default([]),
  assertions: z.array(sagaAssertionSchema).default([]),
  evidenceRequired: z.array(sagaEvidenceRequirementSchema).default([]),
  guardrails: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  delay: sagaStepDelaySchema.default({ mode: 'none', jitterMs: 0 }),
})

/** Phase grouping for lifecycle readability and execution ordering. */
export const sagaPhaseSchema = z.object({
  phaseKey: z.string().min(1),
  order: z.number().int().nonnegative(),
  title: z.string().min(1),
  description: z.string().min(1),
  steps: z.array(sagaStepSchema).min(1),
})

/** Saga source traceability metadata. */
export const sagaSourceSchema = z.object({
  useCaseRef: z.string().optional(),
  personaRef: z.string().optional(),
  useCaseFile: z.string().optional(),
  personaFile: z.string().optional(),
  generatedAt: z.string().datetime().optional(),
})

/** Shared default behavior for run creation. */
const sagaDefaultsSchema = z
  .object({
    runMode: z.enum(['dry_run', 'live']).default('dry_run'),
    continueOnFailure: z.boolean().default(false),
  })
  .default({ runMode: 'dry_run', continueOnFailure: false })

/**
 * Clock simulation config.
 *
 * ELI5:
 * - `virtual`: tests move time intentionally without waiting in real time.
 * - `realtime`: tests use wall clock (mainly for integration parity checks).
 */
export const sagaSimulationClockSchema = z
  .object({
    mode: z.enum(['virtual', 'realtime']).default('virtual'),
    startAt: z.string().datetime().optional(),
    timezone: z.string().min(1).default('UTC'),
    autoAdvance: z.boolean().default(true),
  })
  .default({ mode: 'virtual', timezone: 'UTC', autoAdvance: true })

/**
 * Scheduler simulation config.
 *
 * ELI5:
 * This controls how condition waits are checked.
 */
export const sagaSimulationSchedulerSchema = z
  .object({
    mode: z.enum(['deterministic', 'realtime']).default('deterministic'),
    defaultPollMs: z.number().int().positive().default(1000),
    defaultTimeoutMs: z.number().int().positive().default(30000),
    maxTicksPerStep: z.number().int().positive().default(500),
  })
  .default({
    mode: 'deterministic',
    defaultPollMs: 1000,
    defaultTimeoutMs: 30000,
    maxTicksPerStep: 500,
  })

/**
 * Top-level simulation settings for run orchestration.
 */
export const sagaSimulationSchema = z
  .object({
    clock: sagaSimulationClockSchema,
    scheduler: sagaSimulationSchedulerSchema,
  })
  .default({
    clock: { mode: 'virtual', timezone: 'UTC', autoAdvance: true },
    scheduler: {
      mode: 'deterministic',
      defaultPollMs: 1000,
      defaultTimeoutMs: 30000,
      maxTicksPerStep: 500,
    },
  })

const sagaSpecCommonShape = {
  sagaKey: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  defaults: sagaDefaultsSchema,
  source: sagaSourceSchema.default({}),
  objectives: z.array(z.string().min(1)).default([]),
  actors: z.array(sagaActorSchema).min(1),
  phases: z.array(sagaPhaseSchema).min(1),
  metadata: z.record(z.unknown()).default({}),
} as const

/** Legacy v0 parser (kept to normalize old specs). */
const sagaSpecV0Schema = z.object({
  schemaVersion: z.literal('saga.v0'),
  ...sagaSpecCommonShape,
})

/** Canonical v1 schema. */
const sagaSpecV1Schema = z.object({
  schemaVersion: z.literal('saga.v1'),
  simulation: sagaSimulationSchema,
  ...sagaSpecCommonShape,
})

/** Accept both versions at API boundary and normalize to v1 internally. */
export const sagaSpecInputSchema = z.union([sagaSpecV1Schema, sagaSpecV0Schema])

/** Canonical internal saga shape used by services/runtime. */
export const sagaSpecSchema = sagaSpecV1Schema

function v1SimulationDefaults() {
  return {
    clock: {
      mode: 'virtual' as const,
      timezone: 'UTC',
      autoAdvance: true,
    },
    scheduler: {
      mode: 'deterministic' as const,
      defaultPollMs: 1000,
      defaultTimeoutMs: 30000,
      maxTicksPerStep: 500,
    },
  }
}

/**
 * Parse unknown input and return canonical `saga.v1` shape.
 */
export function normalizeSagaSpec(input: unknown): SagaSpec {
  const parsed = sagaSpecInputSchema.parse(input)
  if (parsed.schemaVersion === 'saga.v1') {
    return parsed
  }

  return {
    ...parsed,
    schemaVersion: 'saga.v1',
    simulation: v1SimulationDefaults(),
  }
}

export type SagaSpec = z.infer<typeof sagaSpecSchema>
export type SagaSpecInput = z.infer<typeof sagaSpecInputSchema>
export type SagaPhase = z.infer<typeof sagaPhaseSchema>
export type SagaStep = z.infer<typeof sagaStepSchema>
