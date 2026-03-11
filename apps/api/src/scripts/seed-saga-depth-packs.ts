import {
  getSagaDefinitionWithSpec,
  listSagaDefinitions,
  reclassifySagaDefinitionDepths,
  upsertSagaDefinitionSpec,
} from '../services/sagas.js'
import { inferSagaDepth } from '../sagas/depth.js'
import { type SagaSpec } from '../sagas/spec-schema.js'

const MEDIUM_SEED_KEYS = [
  'uc-1-the-solo-entrepreneur-sarah',
  'uc-10-the-multi-location-owner-marcus',
  'uc-40-the-solo-entrepreneur-sarah',
  'uc-67-the-solo-entrepreneur-sarah',
  'uc-95-the-solo-entrepreneur-sarah',
  'uc-120-the-solo-entrepreneur-sarah',
]

const DEEP_SEED_KEYS = [
  'uc-157-the-black-hat-hacker-spectre',
  'uc-170-the-solo-entrepreneur-sarah',
  'uc-194-the-black-hat-hacker-spectre',
  'uc-280-the-support-lead-mina',
  'uc-290-the-revenue-operations-architect-riley',
  'uc-314-the-enterprise-account-manager-bianca',
]

type Lane = 'medium' | 'deep'

const SHALLOW_SEED_KEYS = [
  'uc-1-the-solo-entrepreneur-sarah',
  'uc-10-the-multi-location-owner-marcus',
  'uc-40-the-solo-entrepreneur-sarah',
  'uc-67-the-solo-entrepreneur-sarah',
  'uc-120-the-solo-entrepreneur-sarah',
  'uc-170-the-solo-entrepreneur-sarah',
]

function withDepthTags(spec: SagaSpec, depth: SagaSpec['depth']) {
  const tags = new Set(
    spec.tags.filter(
      (tag) =>
        !tag.startsWith('depth:') &&
        !tag.startsWith('lane:') &&
        tag !== 'depth-pack' &&
        tag !== 'pre-merge' &&
        tag !== 'regression',
    ),
  )
  tags.add(`depth:${depth}`)
  tags.add(`lane:${depth}`)
  return Array.from(tags)
}

function classifyDepthForKey(sagaKey: string, spec: SagaSpec): SagaSpec['depth'] {
  if (sagaKey.endsWith('-deep-pack')) return 'deep'
  if (sagaKey.endsWith('-medium-pack')) return 'medium'
  if (sagaKey.endsWith('-shallow-pack')) return 'shallow'
  return inferSagaDepth(spec)
}

async function classifyAllExistingDefinitions() {
  const definitions = await listSagaDefinitions({ limit: 20_000 })
  const counts: Record<SagaSpec['depth'], number> = {
    shallow: 0,
    medium: 0,
    deep: 0,
  }

  for (const definition of definitions) {
    const resolved = await getSagaDefinitionWithSpec(definition.sagaKey)
    if (!resolved?.spec) continue

    const spec = resolved.spec
    const depth = classifyDepthForKey(definition.sagaKey, spec)
    counts[depth] += 1

    const next: SagaSpec = {
      ...spec,
      depth,
      tags: withDepthTags(spec, depth),
      metadata: {
        ...(spec.metadata ?? {}),
        depth,
        depthSource: 'spec.classifier',
      },
    }

    await upsertSagaDefinitionSpec({
      sagaKey: definition.sagaKey,
      spec: next,
      actorUserId: 'system',
      status: definition.status,
      forceRevision: false,
    })
  }

  return { files: definitions.length, counts }
}

function makeDepthPackSpec(base: SagaSpec, lane: Lane): SagaSpec {
  const laneSuffix = lane === 'deep' ? 'deep-pack' : 'medium-pack'
  const sagaKey = `${base.sagaKey}-${laneSuffix}`
  return {
    ...base,
    sagaKey,
    depth: lane,
    title: `${base.title} · ${lane === 'deep' ? 'Deep Validation Pack' : 'Medium Validation Pack'}`,
    description:
      `${base.description} ` +
      `${lane === 'deep' ? 'This variant is grouped into the deep pre-merge lane.' : 'This variant is grouped into the medium regression lane.'}`,
    tags: Array.from(
      new Set([
        ...withDepthTags(base, lane),
        'depth-pack',
        lane === 'deep' ? 'pre-merge' : 'regression',
      ]),
    ),
    source: {
      ...base.source,
      generatedAt: new Date().toISOString(),
    },
    metadata: {
      ...(base.metadata ?? {}),
      depth: lane,
      depthSource: 'depth.pack.generator',
      baseSagaKey: base.sagaKey,
      depthPack: true,
      lane,
    },
  }
}

const SHALLOW_STEP_KEYS = new Set([
  'owner-sign-up',
  'owner-create-biz',
  'owner-create-location',
  'owner-create-offer',
  'owner-create-offer-version',
  'owner-publish-catalog',
  'customer-sign-up',
  'customer-book-primary',
])

function makeShallowPackSpec(base: SagaSpec): SagaSpec {
  const sagaKey = `${base.sagaKey}-shallow-pack`
  let order = 0
  let stepOrder = 0
  const phases = base.phases
    .map((phase) => {
      const steps = phase.steps
        .filter((step) => SHALLOW_STEP_KEYS.has(step.stepKey))
        .map((step) => ({
          ...step,
          order: ++stepOrder,
          delay: {
            mode: 'none' as const,
            jitterMs: 0,
          },
        }))
      if (steps.length === 0) return null
      return {
        ...phase,
        order: ++order,
        steps,
      }
    })
    .filter((phase): phase is NonNullable<typeof phase> => Boolean(phase))

  return {
    ...base,
    sagaKey,
    depth: 'shallow',
    title: `${base.title} · Shallow Smoke Pack`,
    description: `${base.description} This shallow variant keeps only the fast critical-path steps for quick feedback loops.`,
    tags: Array.from(
      new Set([
        ...withDepthTags(base, 'shallow'),
        'depth-pack',
        'smoke',
        'quick-feedback',
      ]),
    ),
    source: {
      ...base.source,
      generatedAt: new Date().toISOString(),
    },
    objectives: [
      'Validate the fastest critical path end-to-end with minimal execution cost.',
      'Catch obvious regressions quickly before medium/deep suites.',
    ],
    phases,
    metadata: {
      ...(base.metadata ?? {}),
      depth: 'shallow',
      depthSource: 'depth.pack.generator',
      baseSagaKey: base.sagaKey,
      depthPack: true,
      lane: 'shallow',
      smokePack: true,
    },
  }
}

async function createPackVariants(seedKeys: string[], lane: Lane) {
  let created = 0
  let skipped = 0

  for (const seedKey of seedKeys) {
    const base = await getSagaDefinitionWithSpec(seedKey)
    if (!base?.spec) {
      skipped += 1
      continue
    }

    const next = makeDepthPackSpec(base.spec, lane)
    const existing = await getSagaDefinitionWithSpec(next.sagaKey)
    if (existing) {
      skipped += 1
      continue
    }

    await upsertSagaDefinitionSpec({
      spec: next,
      actorUserId: 'system',
      status: 'active',
      forceRevision: true,
    })
    created += 1
  }

  return { created, skipped }
}

async function createShallowPackVariants(seedKeys: string[]) {
  let created = 0
  let skipped = 0

  for (const seedKey of seedKeys) {
    const base = await getSagaDefinitionWithSpec(seedKey)
    if (!base?.spec) {
      skipped += 1
      continue
    }

    const next = makeShallowPackSpec(base.spec)
    const existing = await getSagaDefinitionWithSpec(next.sagaKey)
    if (existing) {
      skipped += 1
      continue
    }

    await upsertSagaDefinitionSpec({
      spec: next,
      actorUserId: 'system',
      status: 'active',
      forceRevision: true,
    })
    created += 1
  }

  return { created, skipped }
}

async function main() {
  const classified = await classifyAllExistingDefinitions()
  const mediumPack = await createPackVariants(MEDIUM_SEED_KEYS, 'medium')
  const deepPack = await createPackVariants(DEEP_SEED_KEYS, 'deep')
  const shallowPack = await createShallowPackVariants(SHALLOW_SEED_KEYS)

  const reclassified = await reclassifySagaDefinitionDepths({
    actorUserId: 'system',
    status: 'active',
    limit: 20_000,
  })

  console.log('[sagas] depth classification complete')
  console.log(`- classified definitions: ${classified.files}`)
  console.log(
    `- initial depth totals: shallow=${classified.counts.shallow}, medium=${classified.counts.medium}, deep=${classified.counts.deep}`,
  )
  console.log(`- medium pack: created=${mediumPack.created}, skipped=${mediumPack.skipped}`)
  console.log(`- deep pack: created=${deepPack.created}, skipped=${deepPack.skipped}`)
  console.log(`- shallow pack: created=${shallowPack.created}, skipped=${shallowPack.skipped}`)
  console.log(
    `- final depth totals: shallow=${reclassified.totals.shallow}, medium=${reclassified.totals.medium}, deep=${reclassified.totals.deep}`,
  )
}

main().catch((error) => {
  console.error('[sagas] depth pack seed failed', error)
  process.exit(1)
})
