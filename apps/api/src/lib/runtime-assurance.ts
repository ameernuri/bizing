/**
 * Runtime assurance profile.
 *
 * ELI5:
 * We run the same app in very different contexts:
 * - local developer sandboxes,
 * - staging/pre-prod environments,
 * - production/compliance-sensitive deployments.
 *
 * In local mode we allow limited graceful degradation so engineers can keep
 * iterating when optional observability tables are missing.
 *
 * In strict modes we fail fast instead. This protects audit/compliance posture
 * by preventing "green but partially unobservable" runtime behavior.
 */
export type RuntimeAssuranceMode =
  | 'dev_relaxed'
  | 'staging_strict'
  | 'prod_strict'
  | 'compliance_strict'

function normalizeMode(input: string | undefined): RuntimeAssuranceMode {
  const value = String(input ?? '').trim().toLowerCase()
  if (value === 'staging_strict') return 'staging_strict'
  if (value === 'prod_strict') return 'prod_strict'
  if (value === 'compliance_strict') return 'compliance_strict'
  return 'dev_relaxed'
}

export function getRuntimeAssuranceMode(): RuntimeAssuranceMode {
  return normalizeMode(process.env.BIZING_RUNTIME_ASSURANCE_MODE)
}

export function isStrictRuntimeAssuranceMode() {
  const mode = getRuntimeAssuranceMode()
  return mode !== 'dev_relaxed'
}

