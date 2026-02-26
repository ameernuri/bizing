import { and, eq, inArray, or, sql } from 'drizzle-orm'
import dbPackage from '@bizing/db'

const {
  db,
  users,
  members,
  authzPermissionDefinitions,
  authzRoleDefinitions,
  authzRolePermissions,
  authzMembershipRoleMappings,
  authzRoleAssignments,
} = dbPackage

export type AclScopeInput = {
  bizId?: string | null
  locationId?: string | null
  resourceId?: string | null
  subjectType?: string | null
  subjectId?: string | null
}

export type PermissionDecision = {
  allowed: boolean
  reason: string
  effect?: 'allow' | 'deny'
  scopeType?: 'platform' | 'biz' | 'location' | 'resource' | 'subject'
  matchedRoleKeys?: string[]
}

type ResolvedAssignmentSource = 'assignment' | 'membership'

type ResolvedScopedAssignment = {
  roleDefinitionId: string
  scopeType: 'platform' | 'biz' | 'location' | 'resource' | 'subject'
  scopeSpecificity: number
  source: ResolvedAssignmentSource
}

type PermissionSeed = {
  key: string
  name: string
  moduleKey: string
  description: string
}

const CORE_PERMISSION_SEEDS: PermissionSeed[] = [
  { key: 'bizes.read', name: 'Read Biz', moduleKey: 'bizes', description: 'View biz profile/config.' },
  { key: 'bizes.create', name: 'Create Biz', moduleKey: 'bizes', description: 'Create new biz tenants.' },
  { key: 'bizes.update', name: 'Update Biz', moduleKey: 'bizes', description: 'Edit biz profile/config.' },
  { key: 'bizes.archive', name: 'Archive Biz', moduleKey: 'bizes', description: 'Archive/deactivate biz.' },
  { key: 'locations.read', name: 'Read Locations', moduleKey: 'locations', description: 'View biz locations.' },
  { key: 'locations.create', name: 'Create Locations', moduleKey: 'locations', description: 'Create locations.' },
  { key: 'locations.update', name: 'Update Locations', moduleKey: 'locations', description: 'Edit locations.' },
  { key: 'locations.archive', name: 'Archive Locations', moduleKey: 'locations', description: 'Archive locations.' },
  { key: 'resources.read', name: 'Read Resources', moduleKey: 'resources', description: 'View resources.' },
  { key: 'resources.create', name: 'Create Resources', moduleKey: 'resources', description: 'Create resources.' },
  { key: 'resources.update', name: 'Update Resources', moduleKey: 'resources', description: 'Edit resources.' },
  { key: 'resources.archive', name: 'Archive Resources', moduleKey: 'resources', description: 'Archive resources.' },
  { key: 'offers.read', name: 'Read Offers', moduleKey: 'offers', description: 'View offers and versions.' },
  { key: 'offers.create', name: 'Create Offers', moduleKey: 'offers', description: 'Create offers.' },
  { key: 'offers.update', name: 'Update Offers', moduleKey: 'offers', description: 'Edit offers and versions.' },
  { key: 'offers.archive', name: 'Archive Offers', moduleKey: 'offers', description: 'Archive offers.' },
  { key: 'pricing.read', name: 'Read Pricing', moduleKey: 'pricing', description: 'View pricing rules and demand-pricing policies.' },
  { key: 'pricing.write', name: 'Write Pricing', moduleKey: 'pricing', description: 'Create/update pricing rules and demand-pricing policies.' },
  { key: 'booking_orders.read', name: 'Read Booking Orders', moduleKey: 'bookings', description: 'View bookings.' },
  { key: 'booking_orders.create', name: 'Create Booking Orders', moduleKey: 'bookings', description: 'Create bookings.' },
  { key: 'booking_orders.update', name: 'Update Booking Orders', moduleKey: 'bookings', description: 'Edit bookings.' },
  { key: 'booking_orders.status.update', name: 'Update Booking Status', moduleKey: 'bookings', description: 'Change booking status.' },
  { key: 'booking_orders.cancel', name: 'Cancel Booking Orders', moduleKey: 'bookings', description: 'Cancel/archive bookings.' },
  { key: 'queues.read', name: 'Read Queues', moduleKey: 'queues', description: 'View queue/waitlist definitions.' },
  { key: 'queues.create', name: 'Create Queues', moduleKey: 'queues', description: 'Create queue/waitlist definitions.' },
  { key: 'queues.update', name: 'Update Queues', moduleKey: 'queues', description: 'Edit queue/waitlist definitions.' },
  { key: 'queues.archive', name: 'Archive Queues', moduleKey: 'queues', description: 'Archive queue/waitlist definitions.' },
  { key: 'queue_entries.read', name: 'Read Queue Entries', moduleKey: 'queues', description: 'View queue entry rows.' },
  { key: 'queue_entries.create', name: 'Create Queue Entries', moduleKey: 'queues', description: 'Create queue entry rows.' },
  { key: 'queue_entries.update', name: 'Update Queue Entries', moduleKey: 'queues', description: 'Update queue entry status/priority.' },
  { key: 'compliance.read', name: 'Read Compliance Controls', moduleKey: 'compliance', description: 'View compliance/privacy/audit control snapshot.' },
  { key: 'members.read', name: 'Read Members', moduleKey: 'members', description: 'View biz members.' },
  { key: 'members.manage', name: 'Manage Members', moduleKey: 'members', description: 'Add/update/remove members.' },
  { key: 'invitations.read', name: 'Read Invitations', moduleKey: 'members', description: 'View member invitations.' },
  { key: 'invitations.manage', name: 'Manage Invitations', moduleKey: 'members', description: 'Create/cancel invitations.' },
  { key: 'acl.read', name: 'Read ACL', moduleKey: 'acl', description: 'View ACL roles/assignments.' },
  { key: 'acl.write', name: 'Write ACL', moduleKey: 'acl', description: 'Manage ACL roles/assignments.' },
  { key: 'auth.switch_active_biz', name: 'Switch Active Biz', moduleKey: 'auth', description: 'Switch active biz context.' },
  { key: 'sagas.read', name: 'Read Saga Runs', moduleKey: 'sagas', description: 'View saga runs.' },
  { key: 'sagas.run', name: 'Run Sagas', moduleKey: 'sagas', description: 'Create/execute saga runs.' },
  { key: 'sagas.manage', name: 'Manage Saga Runs', moduleKey: 'sagas', description: 'Mutate saga steps/artifacts.' },
]

/**
 * Baseline role bundle defaults used for first-run bootstrap and legacy fallback.
 *
 * Why these are still in code:
 * - They guarantee the system can boot with sensible defaults.
 * - Admins can override them in DB using ACL management routes.
 */
const DEFAULT_ROLE_PERMISSION_KEYS: Record<string, string[]> = {
  owner: ['*'],
  admin: ['*'],
  manager: [
    'bizes.read',
    'bizes.update',
    'locations.read',
    'locations.create',
    'locations.update',
    'resources.read',
    'resources.create',
    'resources.update',
    'offers.read',
    'offers.create',
    'offers.update',
    'pricing.read',
    'pricing.write',
    'booking_orders.read',
    'booking_orders.create',
    'booking_orders.update',
    'booking_orders.status.update',
    'booking_orders.cancel',
    'queues.read',
    'queues.create',
    'queues.update',
    'queues.archive',
    'queue_entries.read',
    'queue_entries.create',
    'queue_entries.update',
    'compliance.read',
    'members.read',
    'invitations.read',
    'invitations.manage',
    'auth.switch_active_biz',
    'sagas.read',
    'sagas.run',
  ],
  staff: [
    'bizes.read',
    'locations.read',
    'resources.read',
    'offers.read',
    'pricing.read',
    'booking_orders.read',
    'booking_orders.create',
    'booking_orders.update',
    'booking_orders.status.update',
    'queues.read',
    'queue_entries.read',
    'queue_entries.create',
    'queue_entries.update',
    'compliance.read',
    'auth.switch_active_biz',
  ],
  host: [
    'bizes.read',
    'locations.read',
    'resources.read',
    'offers.read',
    'pricing.read',
    'booking_orders.read',
    'booking_orders.create',
    'booking_orders.update',
    'booking_orders.status.update',
    'queues.read',
    'queue_entries.read',
    'queue_entries.create',
    'queue_entries.update',
    'compliance.read',
    'auth.switch_active_biz',
  ],
  customer: ['offers.read', 'booking_orders.read', 'booking_orders.create', 'queue_entries.read', 'queue_entries.create'],
  user: [],
  member: ['bizes.read', 'locations.read', 'offers.read', 'booking_orders.read', 'queues.read', 'queue_entries.read'],
}

let bootstrapPromise: Promise<void> | null = null

function roleHasPermission(permissionKeys: string[], permissionKey: string) {
  if (permissionKeys.includes('*')) return true
  return permissionKeys.includes(permissionKey)
}

function scopeSpecificity(scopeType: string): number {
  switch (scopeType) {
    case 'subject':
      return 5
    case 'resource':
      return 4
    case 'location':
      return 3
    case 'biz':
      return 2
    default:
      return 1
  }
}

/**
 * Build deterministic scope-ref key from optional scope payload.
 */
export function buildScopeRef(scope: AclScopeInput): string {
  if (scope.resourceId) return `resource:${scope.resourceId}`
  if (scope.locationId) return `location:${scope.locationId}`
  if (scope.subjectType && scope.subjectId) return `subject:${scope.subjectType}:${scope.subjectId}`
  if (scope.bizId) return `biz:${scope.bizId}`
  return 'platform'
}

/**
 * Infer scope type from scope payload.
 */
export function inferScopeType(scope: AclScopeInput): 'platform' | 'biz' | 'location' | 'resource' | 'subject' {
  if (scope.resourceId) return 'resource'
  if (scope.locationId) return 'location'
  if (scope.subjectType && scope.subjectId) return 'subject'
  if (scope.bizId) return 'biz'
  return 'platform'
}

function assignmentMatchesScope(
  assignment: {
    scopeType: string
    bizId: string | null
    locationId: string | null
    resourceId: string | null
    scopeSubjectType: string | null
    scopeSubjectId: string | null
  },
  scope: AclScopeInput,
) {
  if (assignment.scopeType === 'platform') return true
  if (assignment.scopeType === 'biz') return Boolean(scope.bizId && assignment.bizId === scope.bizId)
  if (assignment.scopeType === 'location') {
    return Boolean(
      scope.bizId &&
        scope.locationId &&
        assignment.bizId === scope.bizId &&
        assignment.locationId === scope.locationId,
    )
  }
  if (assignment.scopeType === 'resource') {
    return Boolean(
      scope.bizId &&
        scope.resourceId &&
        assignment.bizId === scope.bizId &&
        assignment.resourceId === scope.resourceId,
    )
  }
  if (assignment.scopeType === 'subject') {
    return Boolean(
      scope.bizId &&
        scope.subjectType &&
        scope.subjectId &&
        assignment.bizId === scope.bizId &&
        assignment.scopeSubjectType === scope.subjectType &&
        assignment.scopeSubjectId === scope.subjectId,
    )
  }
  return false
}

/**
 * Seed core permission dictionary + baseline role bundles.
 *
 * This function is idempotent and safe to call many times.
 */
export async function ensureAclBootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        for (const permission of CORE_PERMISSION_SEEDS) {
          await db
            .insert(authzPermissionDefinitions)
            .values({
              permissionKey: permission.key,
              name: permission.name,
              moduleKey: permission.moduleKey,
              description: permission.description,
              isSystem: true,
            })
            .onConflictDoNothing({
              target: authzPermissionDefinitions.permissionKey,
            })
        }

        const defaultRoleKeys = ['owner', 'admin', 'manager', 'staff', 'host', 'customer', 'user']
        for (const roleKey of defaultRoleKeys) {
          await db
            .insert(authzRoleDefinitions)
            .values({
              scopeType: 'platform',
              scopeRef: 'platform',
              roleKey,
              name: roleKey[0]!.toUpperCase() + roleKey.slice(1),
              description: `Seeded default ACL role for ${roleKey}.`,
              status: 'active',
              isSystem: true,
              isDefault: true,
            })
            .onConflictDoNothing({
              target: [authzRoleDefinitions.scopeRef, authzRoleDefinitions.roleKey],
            })
        }

        const permissionRows = await db
          .select({
            id: authzPermissionDefinitions.id,
            permissionKey: authzPermissionDefinitions.permissionKey,
          })
          .from(authzPermissionDefinitions)
          .where(
            inArray(
              authzPermissionDefinitions.permissionKey,
              CORE_PERMISSION_SEEDS.map((row) => row.key),
            ),
          )

        const roleRows = await db
          .select({
            id: authzRoleDefinitions.id,
            roleKey: authzRoleDefinitions.roleKey,
          })
          .from(authzRoleDefinitions)
          .where(
            and(
              eq(authzRoleDefinitions.scopeRef, 'platform'),
              inArray(authzRoleDefinitions.roleKey, defaultRoleKeys),
            ),
          )

        const permissionByKey = new Map(permissionRows.map((row) => [row.permissionKey, row.id]))
        const roleByKey = new Map(roleRows.map((row) => [row.roleKey, row.id]))

        for (const [roleKey, keys] of Object.entries(DEFAULT_ROLE_PERMISSION_KEYS)) {
          const roleId = roleByKey.get(roleKey)
          if (!roleId) continue

          const resolvedKeys =
            keys.includes('*') ? CORE_PERMISSION_SEEDS.map((row) => row.key) : keys

          for (const permissionKey of resolvedKeys) {
            const permissionId = permissionByKey.get(permissionKey)
            if (!permissionId) continue

            await db
              .insert(authzRolePermissions)
              .values({
                roleDefinitionId: roleId,
                permissionDefinitionId: permissionId,
                effect: 'allow',
                isActive: true,
                priority: 100,
              })
              .onConflictDoNothing({
                target: [
                  authzRolePermissions.roleDefinitionId,
                  authzRolePermissions.permissionDefinitionId,
                ],
              })
          }
        }

        const roleMappingRows = await db
          .select({
            id: authzRoleDefinitions.id,
            roleKey: authzRoleDefinitions.roleKey,
          })
          .from(authzRoleDefinitions)
          .where(eq(authzRoleDefinitions.scopeRef, 'platform'))

        const mappingByRoleKey = new Map(roleMappingRows.map((row) => [row.roleKey, row.id]))
        const membershipRoles = ['owner', 'admin', 'manager', 'staff', 'host', 'customer', 'user', 'member']

        for (const membershipRole of membershipRoles) {
          const canonicalRoleKey = membershipRole === 'member' ? 'staff' : membershipRole
          const roleId = mappingByRoleKey.get(canonicalRoleKey)
          if (!roleId) continue

          await db
            .insert(authzMembershipRoleMappings)
            .values({
              membershipRole,
              roleDefinitionId: roleId,
              isActive: true,
              priority: 100,
            })
            .onConflictDoNothing({
              target: [
                authzMembershipRoleMappings.bizId,
                authzMembershipRoleMappings.membershipRole,
                authzMembershipRoleMappings.roleDefinitionId,
              ],
            })
        }
      } catch {
        // Bootstrap errors are intentionally swallowed here so API can keep
        // serving with legacy role fallback until migrations/seeding are fixed.
      }
    })()
  }
  await bootstrapPromise
}

async function getMembershipRole(userId: string, bizId: string) {
  const membership = await db.query.members.findFirst({
    where: and(eq(members.userId, userId), eq(members.organizationId, bizId)),
  })
  return membership?.role ?? null
}

/**
 * Legacy compatibility path used when ACL tables are not yet migrated/seeded.
 */
async function evaluateWithLegacyRoleFallback(
  userId: string,
  platformRole: string | null | undefined,
  permissionKey: string,
  scope: AclScopeInput,
): Promise<PermissionDecision> {
  if (platformRole === 'admin' || platformRole === 'owner') {
    return {
      allowed: true,
      reason: 'platform role bypass (legacy fallback)',
      effect: 'allow',
      scopeType: 'platform',
      matchedRoleKeys: [platformRole],
    }
  }

  const bizId = scope.bizId ?? null
  if (!bizId) {
    return {
      allowed: false,
      reason: 'no biz scope available in legacy fallback',
      effect: 'deny',
      scopeType: 'platform',
      matchedRoleKeys: [],
    }
  }

  const membershipRole = await getMembershipRole(userId, bizId)
  if (!membershipRole) {
    return {
      allowed: false,
      reason: 'no biz membership (legacy fallback)',
      effect: 'deny',
      scopeType: 'biz',
      matchedRoleKeys: [],
    }
  }

  const permissionKeys = DEFAULT_ROLE_PERMISSION_KEYS[membershipRole] ?? []
  const allowed = roleHasPermission(permissionKeys, permissionKey)

  return {
    allowed,
    reason: allowed ? 'allowed by legacy role map' : 'denied by legacy role map',
    effect: allowed ? 'allow' : 'deny',
    scopeType: 'biz',
    matchedRoleKeys: [membershipRole],
  }
}

/**
 * Resolve one permission decision for one user at one optional scope.
 *
 * Decision model:
 * - collect all applicable role bundles (explicit assignments + membership maps),
 * - evaluate only rows matching permission key,
 * - pick most specific scope, then highest priority,
 * - deny beats allow at same specificity.
 */
export async function evaluatePermission(input: {
  userId: string
  platformRole?: string | null
  permissionKey: string
  scope?: AclScopeInput
}): Promise<PermissionDecision> {
  const scope = input.scope ?? {}
  await ensureAclBootstrap()

  try {
    if (input.platformRole === 'admin' || input.platformRole === 'owner') {
      return {
        allowed: true,
        reason: 'platform role bypass',
        effect: 'allow',
        scopeType: 'platform',
        matchedRoleKeys: [input.platformRole],
      }
    }

    const permission = await db.query.authzPermissionDefinitions.findFirst({
      where: eq(authzPermissionDefinitions.permissionKey, input.permissionKey),
    })
    if (!permission) {
      return evaluateWithLegacyRoleFallback(
        input.userId,
        input.platformRole,
        input.permissionKey,
        scope,
      )
    }

    const now = new Date()

    const explicitAssignments = await db.query.authzRoleAssignments.findMany({
      where: and(
        eq(authzRoleAssignments.userId, input.userId),
        eq(authzRoleAssignments.status, 'active'),
        sql`"effective_from" <= ${now}`,
        sql`("effective_to" IS NULL OR "effective_to" > ${now})`,
      ),
    })

    const scopedAssignments: ResolvedScopedAssignment[] = explicitAssignments
      .filter((row) => assignmentMatchesScope(row, scope))
      .map((row) => ({
        roleDefinitionId: row.roleDefinitionId,
        scopeType: row.scopeType,
        scopeSpecificity: scopeSpecificity(row.scopeType),
        source: 'assignment' as const,
      }))

    if (scope.bizId) {
      const membershipRole = await getMembershipRole(input.userId, scope.bizId)
      if (membershipRole) {
        const mappingRows = await db.query.authzMembershipRoleMappings.findMany({
          where: and(
            eq(authzMembershipRoleMappings.membershipRole, membershipRole),
            eq(authzMembershipRoleMappings.isActive, true),
            or(
              eq(authzMembershipRoleMappings.bizId, scope.bizId),
              sql`"biz_id" IS NULL`,
            ),
          ),
        })

        for (const mapping of mappingRows) {
          const specificity = mapping.bizId === scope.bizId ? 3 : 2
          scopedAssignments.push({
            roleDefinitionId: mapping.roleDefinitionId,
            scopeType: 'biz',
            scopeSpecificity: specificity,
            source: 'membership' as const,
          })
        }
      }
    }

    if (scopedAssignments.length === 0) {
      return evaluateWithLegacyRoleFallback(
        input.userId,
        input.platformRole,
        input.permissionKey,
        scope,
      )
    }

    const roleIds = Array.from(new Set(scopedAssignments.map((row) => row.roleDefinitionId)))

    const permissionRows = await db
      .select({
        roleDefinitionId: authzRolePermissions.roleDefinitionId,
        effect: authzRolePermissions.effect,
        priority: authzRolePermissions.priority,
        roleKey: authzRoleDefinitions.roleKey,
        roleScopeType: authzRoleDefinitions.scopeType,
      })
      .from(authzRolePermissions)
      .innerJoin(
        authzRoleDefinitions,
        eq(authzRoleDefinitions.id, authzRolePermissions.roleDefinitionId),
      )
      .where(
        and(
          inArray(authzRolePermissions.roleDefinitionId, roleIds),
          eq(authzRolePermissions.permissionDefinitionId, permission.id),
          eq(authzRolePermissions.isActive, true),
          eq(authzRoleDefinitions.status, 'active'),
        ),
      )

    if (permissionRows.length === 0) {
      return evaluateWithLegacyRoleFallback(
        input.userId,
        input.platformRole,
        input.permissionKey,
        scope,
      )
    }

    const assignmentByRoleId = new Map(
      scopedAssignments.map((row) => [row.roleDefinitionId, row]),
    )

    const weighted = permissionRows
      .map((row) => {
        const assignment = assignmentByRoleId.get(row.roleDefinitionId)
        if (!assignment) return null
        return {
          ...row,
          scopeSpecificity: assignment.scopeSpecificity,
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => {
        if (b.scopeSpecificity !== a.scopeSpecificity) {
          return b.scopeSpecificity - a.scopeSpecificity
        }
        return b.priority - a.priority
      })

    if (weighted.length === 0) {
      return {
        allowed: false,
        reason: 'no weighted ACL rows after assignment resolution',
        effect: 'deny',
      }
    }

    const topSpecificity = weighted[0]!.scopeSpecificity
    const topRows = weighted.filter((row) => row.scopeSpecificity === topSpecificity)
    const hasDeny = topRows.some((row) => row.effect === 'deny')
    const hasAllow = topRows.some((row) => row.effect === 'allow')

    if (hasDeny) {
      return {
        allowed: false,
        reason: 'explicit deny at highest specificity',
        effect: 'deny',
        scopeType: topRows[0]?.roleScopeType,
        matchedRoleKeys: Array.from(new Set(topRows.map((row) => row.roleKey))),
      }
    }

    if (hasAllow) {
      return {
        allowed: true,
        reason: 'allow at highest specificity',
        effect: 'allow',
        scopeType: topRows[0]?.roleScopeType,
        matchedRoleKeys: Array.from(new Set(topRows.map((row) => row.roleKey))),
      }
    }

    return {
      allowed: false,
      reason: 'no allow rows at highest specificity',
      effect: 'deny',
      scopeType: topRows[0]?.roleScopeType,
      matchedRoleKeys: Array.from(new Set(topRows.map((row) => row.roleKey))),
    }
  } catch {
    return evaluateWithLegacyRoleFallback(
      input.userId,
      input.platformRole,
      input.permissionKey,
      scope,
    )
  }
}

/**
 * Convenience helper for UI/auth context endpoints.
 */
export async function listEffectivePermissionKeys(input: {
  userId: string
  platformRole?: string | null
  scope?: AclScopeInput
}) {
  await ensureAclBootstrap()

  const definitions = await db.query.authzPermissionDefinitions.findMany({
    orderBy: (table, { asc }) => [asc(table.permissionKey)],
  })

  const allowed: string[] = []
  for (const definition of definitions) {
    const decision = await evaluatePermission({
      userId: input.userId,
      platformRole: input.platformRole,
      permissionKey: definition.permissionKey,
      scope: input.scope,
    })
    if (decision.allowed) {
      allowed.push(definition.permissionKey)
    }
  }
  return allowed
}
