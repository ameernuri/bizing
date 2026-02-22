import {
  type PseudoApiRequest,
  scenarioRunRequestSchema,
} from './types.js'
import { executePseudoApiRequest } from './executor.js'
import { translateNaturalLanguageRequest } from './translator.js'

export type ScenarioResult = {
  id: string
  name: string
  success: boolean
  prompt?: string
  translation?: ReturnType<typeof translateNaturalLanguageRequest>
  request?: PseudoApiRequest
  response?: Awaited<ReturnType<typeof executePseudoApiRequest>>
  error?: string
}

export type ScenarioRunResult = {
  success: boolean
  total: number
  succeeded: number
  failed: number
  results: ScenarioResult[]
}

/**
 * Runs a batch of generated scenarios against the pseudo API layer.
 *
 * ELI5:
 * Each scenario can be either:
 * - natural language (`prompt`) -> translated to canonical request,
 * - or direct canonical request (`request`) if a generator already emits JSON.
 */
export async function runScenarios(rawInput: unknown): Promise<ScenarioRunResult> {
  const parsed = scenarioRunRequestSchema.parse(rawInput)

  const results: ScenarioResult[] = []

  for (let index = 0; index < parsed.scenarios.length; index += 1) {
    const scenario = parsed.scenarios[index]
    const id = scenario.id ?? `scenario-${index + 1}`

    try {
      let request: PseudoApiRequest
      let translation: ReturnType<typeof translateNaturalLanguageRequest> | undefined

      if (scenario.request) {
        request = {
          ...scenario.request,
          dryRun:
            scenario.dryRun ?? scenario.request.dryRun ?? parsed.defaults.dryRun,
          scope: {
            ...parsed.defaults.scope,
            ...scenario.request.scope,
            ...(scenario.scope ?? {}),
          },
        }
      } else {
        if (!scenario.prompt) {
          throw new Error('Scenario must provide either prompt or request.')
        }

        translation = translateNaturalLanguageRequest({
          input: scenario.prompt,
          dryRun: scenario.dryRun ?? parsed.defaults.dryRun,
          scope: {
            ...parsed.defaults.scope,
            ...(scenario.scope ?? {}),
          },
        })

        if (!translation.success || !translation.pseudoRequest) {
          results.push({
            id,
            name: scenario.name,
            prompt: scenario.prompt,
            success: false,
            translation,
            error: translation.error?.message ?? 'translation_failed',
          })
          continue
        }

        request = translation.pseudoRequest
      }

      if (!scenario.execute) {
        results.push({
          id,
          name: scenario.name,
          prompt: scenario.prompt,
          success: true,
          translation,
          request,
        })
        continue
      }

      const response = await executePseudoApiRequest(request)

      results.push({
        id,
        name: scenario.name,
        prompt: scenario.prompt,
        success: response.success,
        translation,
        request,
        response,
        error: response.error?.message,
      })
    } catch (error) {
      results.push({
        id,
        name: scenario.name,
        prompt: scenario.prompt,
        success: false,
        error: error instanceof Error ? error.message : 'unknown_scenario_error',
      })
    }
  }

  const succeeded = results.filter((result) => result.success).length
  const failed = results.length - succeeded

  return {
    success: failed === 0,
    total: results.length,
    succeeded,
    failed,
    results,
  }
}
