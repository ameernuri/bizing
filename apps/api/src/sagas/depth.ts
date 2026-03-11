import type { SagaDepth, SagaSpec } from './spec-schema.js'

const HIGH_COMPLEXITY_TAGS = new Set([
  'security',
  'acl',
  'abuse',
  'compliance',
  'hipaa',
  'soc2',
  'iso',
  'enterprise',
  'marketplace',
  'crm',
  'support',
  'marketing',
  'channels',
  'integrations',
  'dispatch',
  'workflow',
  'queue',
  'payments',
  'dispute',
  'payout',
  'settlement',
  'cross-biz',
  'tenant-isolation',
  'idor',
  'risk',
  'audit',
  'privacy',
  'consent',
])

const QUICK_PATH_TAGS = new Set([
  'auth',
  'setup',
  'catalog',
  'booking',
  'smoke',
  'sanity',
])

/**
 * Build one canonical tag bag from top-level spec tags plus step tags.
 */
function collectSagaTags(spec: SagaSpec): string[] {
  const tags = new Set<string>()
  const addTag = (rawTag: string) => {
    const tag = rawTag.toLowerCase()
    // Depth-lane labels are control tags, not complexity signals.
    if (tag.startsWith('depth:') || tag.startsWith('lane:')) return
    if (tag === 'depth-pack' || tag === 'pre-merge' || tag === 'regression') return
    tags.add(tag)
  }
  for (const tag of spec.tags ?? []) {
    addTag(tag)
  }
  for (const phase of spec.phases) {
    for (const step of phase.steps) {
      for (const tag of step.tags ?? []) {
        addTag(tag)
      }
    }
  }
  return Array.from(tags)
}

/**
 * Infer saga depth from the actual lifecycle surface.
 *
 * ELI5:
 * We score based on:
 * - how long the story is (step count),
 * - how risky/cross-domain it is (security/compliance/integration tags),
 * - how much async waiting it exercises (delay/scheduler behavior),
 * - how many actors it coordinates.
 *
 * This gives a stable default even when older specs did not declare depth.
 */
export function inferSagaDepth(spec: SagaSpec): SagaDepth {
  const tags = collectSagaTags(spec)
  const steps = spec.phases.flatMap((phase) => phase.steps)
  const totalSteps = steps.length
  const actorCount = spec.actors.length

  let score = 0
  score += totalSteps
  score += Math.max(actorCount - 3, 0)

  let highComplexityHits = 0
  for (const tag of tags) {
    if (HIGH_COMPLEXITY_TAGS.has(tag)) highComplexityHits += 1
  }
  score += Math.min(highComplexityHits * 2, 22)

  const fixedDelaySteps = steps.filter((step) => step.delay?.mode === 'fixed').length
  const conditionDelaySteps = steps.filter((step) => step.delay?.mode === 'until_condition').length
  score += Math.min(fixedDelaySteps, 6)
  score += Math.min(conditionDelaySteps * 2, 12)

  const quickTagHits = tags.filter((tag) => QUICK_PATH_TAGS.has(tag)).length
  if (quickTagHits >= 3 && totalSteps <= 14 && highComplexityHits <= 2) {
    return 'shallow'
  }

  if (totalSteps <= 18 && conditionDelaySteps <= 1 && highComplexityHits <= 3) {
    return 'shallow'
  }

  if (score >= 72 && totalSteps >= 42) {
    return 'deep'
  }
  if (highComplexityHits >= 10 && totalSteps >= 36 && conditionDelaySteps >= 3) {
    return 'deep'
  }

  return 'medium'
}

/**
 * Resolve the effective depth used by runtime/storage.
 *
 * If a spec explicitly declares `shallow` or `deep`, keep that.
 * If it declares/defaults to `medium`, allow inference to promote or demote
 * so legacy specs get meaningful categorization without manual edits.
 */
export function resolveSagaDepth(spec: SagaSpec): SagaDepth {
  /**
   * Explicit control-tag override.
   *
   * ELI5:
   * Some saga packs are intentionally lane-targeted (for example proactive
   * hole packs we want exactly shallow/medium/deep in fixed counts).
   * If spec tags contain `depth-{lane}`, trust the declared lane and skip
   * heuristic inference.
   */
  const tags = collectSagaTags(spec)
  if (tags.includes(`depth-${spec.depth}`)) {
    return spec.depth
  }

  if (spec.depth === 'shallow' || spec.depth === 'deep') return spec.depth
  return inferSagaDepth(spec)
}
