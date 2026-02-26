import 'dotenv/config'
import {
  generateSagaSpecsFromDocs,
  syncSagaDefinitionsFromDisk,
  DEFAULT_PERSONAS_FILE,
  DEFAULT_USE_CASES_FILE,
} from '../services/sagas.js'

/**
 * CLI helper to generate saga specs from UC + persona docs.
 *
 * Usage:
 *   bun run --cwd apps/api sagas:generate
 *   bun run --cwd apps/api sagas:generate -- --limit=20
 *   bun run --cwd apps/api sagas:generate -- --uc=UC-1,UC-2
 *   bun run --cwd apps/api sagas:generate -- --persona=P-1
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const lookup = new Map<string, string>()

  for (const arg of args) {
    if (!arg.startsWith('--')) continue
    const [rawKey, rawValue] = arg.slice(2).split('=')
    lookup.set(rawKey, rawValue ?? 'true')
  }

  const useCaseRefs = lookup.get('uc')?.split(',').map((value) => value.trim()).filter(Boolean)
  const personaRefs = lookup
    .get('persona')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const limitUseCasesRaw = lookup.get('limit')
  const maxPersonasRaw = lookup.get('max-personas')

  return {
    useCaseRefs,
    personaRefs,
    limitUseCases:
      limitUseCasesRaw && Number.isFinite(Number(limitUseCasesRaw))
        ? Number(limitUseCasesRaw)
        : undefined,
    maxPersonasPerUseCase:
      maxPersonasRaw && Number.isFinite(Number(maxPersonasRaw)) ? Number(maxPersonasRaw) : 1,
    overwrite: lookup.get('overwrite') !== 'false',
    sync: lookup.get('sync') === 'true',
  }
}

async function main() {
  const options = parseArgs()
  console.log('[sagas] generating specs...')
  console.log(`[sagas] use-cases source: ${DEFAULT_USE_CASES_FILE}`)
  console.log(`[sagas] personas source: ${DEFAULT_PERSONAS_FILE}`)

  const generated = await generateSagaSpecsFromDocs({
    ...options,
  })
  const synced = options.sync ? await syncSagaDefinitionsFromDisk() : []

  console.log(`[sagas] generated: ${generated.length}`)
  console.log(`[sagas] synced definitions: ${synced.length} (sync=${options.sync})`)
  if (generated.length > 0) {
    console.log(`[sagas] first key: ${generated[0].sagaKey}`)
  }
}

main().catch((error) => {
  console.error('[sagas] failed:', error)
  process.exit(1)
})
