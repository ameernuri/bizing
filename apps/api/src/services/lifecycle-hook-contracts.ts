import { and, eq } from 'drizzle-orm'
import dbPackage from '@bizing/db'
import { sanitizePlainText } from '../lib/sanitize.js'

const { db, lifecycleHookContracts, lifecycleHookContractVersions } = dbPackage

export type LifecycleHookContractResolutionMode = 'strict' | 'auto_register'

type EnsureLifecycleHookContractInput = {
  tx: typeof db
  bizId: string
  hookPoint: string
  contractId?: string | null
  targetType?: string | null
  mode?: LifecycleHookContractResolutionMode
  source: string
}

type EnsureLifecycleHookContractVersionInput = {
  tx: typeof db
  bizId: string
  contract: typeof lifecycleHookContracts.$inferSelect
  requestedVersion?: number | null
  mode?: LifecycleHookContractResolutionMode
  source: string
}

export function normalizeLifecycleHookKey(value: string) {
  return sanitizePlainText(value).trim()
}

function inferContractPhase(value: string): 'before' | 'after' {
  const key = value.toLowerCase()
  if (key.includes('.before_') || key.includes('.before.') || key.endsWith('.before')) return 'before'
  return 'after'
}

export async function ensureLifecycleHookContract(
  input: EnsureLifecycleHookContractInput,
): Promise<typeof lifecycleHookContracts.$inferSelect | null> {
  const mode = input.mode ?? 'strict'
  const key = normalizeLifecycleHookKey(input.hookPoint)

  if (input.contractId) {
    const byId = await input.tx.query.lifecycleHookContracts.findFirst({
      where: and(eq(lifecycleHookContracts.bizId, input.bizId), eq(lifecycleHookContracts.id, input.contractId)),
    })
    if (byId) return byId
    return null
  }

  const byKey = await input.tx.query.lifecycleHookContracts.findFirst({
    where: and(eq(lifecycleHookContracts.bizId, input.bizId), eq(lifecycleHookContracts.key, key)),
  })
  if (byKey) return byKey
  if (mode === 'strict') return null

  const [created] = await input.tx
    .insert(lifecycleHookContracts)
    .values({
      bizId: input.bizId,
      key,
      name: key,
      status: 'active',
      phase: inferContractPhase(key),
      triggerMode: 'manual',
      targetType: input.targetType ?? 'custom',
      mutability: 'effects',
      currentVersion: 1,
      description: `Auto-registered contract for ${key}.`,
      metadata: {
        source: input.source,
        autoRegistered: true,
      },
    })
    .returning()

  return created
}

export async function ensureLifecycleHookContractVersion(
  input: EnsureLifecycleHookContractVersionInput,
): Promise<typeof lifecycleHookContractVersions.$inferSelect | null> {
  const mode = input.mode ?? 'strict'
  const versionToLoad =
    typeof input.requestedVersion === 'number' && Number.isFinite(input.requestedVersion)
      ? Math.max(1, Math.floor(input.requestedVersion))
      : Math.max(1, input.contract.currentVersion ?? 1)

  const existing = await input.tx.query.lifecycleHookContractVersions.findFirst({
    where: and(
      eq(lifecycleHookContractVersions.bizId, input.bizId),
      eq(lifecycleHookContractVersions.lifecycleHookContractId, input.contract.id),
      eq(lifecycleHookContractVersions.version, versionToLoad),
    ),
  })
  if (existing) return existing
  if (mode === 'strict') return null

  const [created] = await input.tx
    .insert(lifecycleHookContractVersions)
    .values({
      bizId: input.bizId,
      lifecycleHookContractId: input.contract.id,
      version: versionToLoad,
      status: 'active',
      inputSchema: {},
      contextSchema: {},
      effectSchema: {},
      metadata: {
        source: input.source,
        autoRegistered: true,
      },
    })
    .returning()

  if (input.contract.currentVersion !== versionToLoad) {
    await input.tx
      .update(lifecycleHookContracts)
      .set({ currentVersion: versionToLoad })
      .where(and(eq(lifecycleHookContracts.bizId, input.bizId), eq(lifecycleHookContracts.id, input.contract.id)))
  }

  return created
}
