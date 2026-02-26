/**
 * Authentication + authorization middleware for the API.
 *
 * Design goals:
 * - Better Auth is the source of truth for identity/session.
 * - `members` is the source of truth for biz membership/role.
 * - API handlers never guess tenant context; they must resolve `bizId` explicitly.
 * - ACL checks are composable and easy to reuse in routes.
 */

import type { Context, Next } from 'hono'
import dbPackage from '@bizing/db'
import { auth } from '../auth.js'
import { evaluatePermission } from '../services/acl.js'
import { resolveMachineAuthFromHeaders } from '../services/machine-auth.js'

const { db } = dbPackage

/** Membership roles supported by the current schema. */
export type BizRole = 'owner' | 'admin' | 'manager' | 'staff' | 'host' | 'customer'

/** Small user shape used by the API guard layer. */
export type CurrentUser = {
  id: string
  email?: string
  role?: string | null
}

/** Session payload shape used by handlers. */
export type CurrentSession = {
  id: string
  activeOrganizationId?: string | null
}

export type AuthSource = 'session' | 'api_key' | 'access_token'

type PermissionGuardOptions = {
  bizIdParam?: string
  locationIdParam?: string
  resourceIdParam?: string
  subjectTypeParam?: string
  subjectIdParam?: string
}

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string
    user: CurrentUser
    session: CurrentSession
    authSource: AuthSource
    authScopes: string[]
    authCredentialId: string
    bizId: string
    membershipId: string
    membershipRole: BizRole
  }
}

/**
 * Resolve Better Auth session from the incoming request.
 */
export async function getSession(c: Context) {
  return auth.api.getSession({ headers: c.req.raw.headers })
}

function attachAuthContext(
  c: Context,
  input: {
    user: CurrentUser
    session: CurrentSession
    authSource: AuthSource
    authScopes?: string[]
    authCredentialId?: string
  },
) {
  c.set('user', input.user)
  c.set('session', input.session)
  c.set('authSource', input.authSource)
  c.set('authScopes', input.authScopes ?? ['*'])
  if (input.authCredentialId) {
    c.set('authCredentialId', input.authCredentialId)
  }
}

function permissionAllowedByScopes(scopes: string[] | undefined, permissionKey: string) {
  const resolvedScopes = (scopes ?? []).map((scope) => String(scope || '').trim()).filter(Boolean)
  if (resolvedScopes.length === 0) return true
  if (resolvedScopes.includes('*')) return true
  if (resolvedScopes.includes(permissionKey)) return true
  return resolvedScopes.some((scope) => {
    if (!scope.endsWith('.*')) return false
    const prefix = scope.slice(0, -1)
    return permissionKey.startsWith(prefix)
  })
}

/**
 * Ensure each request has a stable request id for tracing.
 */
export async function requestId(c: Context, next: Next) {
  const id = c.req.header('x-request-id') ?? crypto.randomUUID()
  c.set('requestId', id)
  c.header('x-request-id', id)
  await next()
}

/**
 * Attach user/session when present, but do not enforce auth.
 */
export async function optionalAuth(c: Context, next: Next) {
  const machinePrincipal = await resolveMachineAuthFromHeaders(c.req.raw.headers, {
    allowDirectApiKey: false,
  })
  if (machinePrincipal) {
    attachAuthContext(c, {
      user: machinePrincipal.user,
      session: machinePrincipal.session,
      authSource: machinePrincipal.authSource,
      authScopes: machinePrincipal.authScopes,
      authCredentialId: machinePrincipal.credentialId,
    })
    await next()
    return
  }

  const session = await getSession(c)
  if (session?.user && session?.session) {
    attachAuthContext(c, {
      user: {
        id: String(session.user.id),
        email: session.user.email,
        role: (session.user as { role?: string | null }).role ?? null,
      },
      session: {
        id: String(session.session.id),
        activeOrganizationId: (session.session as { activeOrganizationId?: string | null })
          .activeOrganizationId,
      },
      authSource: 'session',
      authScopes: ['*'],
    })
  }
  await next()
}

/**
 * Require authenticated user session.
 */
export async function requireAuth(c: Context, next: Next) {
  const machinePrincipal = await resolveMachineAuthFromHeaders(c.req.raw.headers, {
    allowDirectApiKey: false,
  })
  if (machinePrincipal) {
    attachAuthContext(c, {
      user: machinePrincipal.user,
      session: machinePrincipal.session,
      authSource: machinePrincipal.authSource,
      authScopes: machinePrincipal.authScopes,
      authCredentialId: machinePrincipal.credentialId,
    })
    await next()
    return
  }

  const session = await getSession(c)

  if (!session?.user || !session?.session) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
        meta: {
          requestId: c.get('requestId') ?? crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      401,
    )
  }

  attachAuthContext(c, {
    user: {
      id: String(session.user.id),
      email: session.user.email,
      role: (session.user as { role?: string | null }).role ?? null,
    },
    session: {
      id: String(session.session.id),
      activeOrganizationId: (session.session as { activeOrganizationId?: string | null })
        .activeOrganizationId,
    },
    authSource: 'session',
    authScopes: ['*'],
  })

  await next()
}

/**
 * Require auth, but allow direct API key authentication for routes that are
 * explicitly designed for API-key bootstrap flows (for example token exchange).
 */
export async function requireAuthAllowApiKey(c: Context, next: Next) {
  const machinePrincipal = await resolveMachineAuthFromHeaders(c.req.raw.headers, {
    allowDirectApiKey: true,
  })
  if (machinePrincipal) {
    attachAuthContext(c, {
      user: machinePrincipal.user,
      session: machinePrincipal.session,
      authSource: machinePrincipal.authSource,
      authScopes: machinePrincipal.authScopes,
      authCredentialId: machinePrincipal.credentialId,
    })
    await next()
    return
  }
  return requireAuth(c, next)
}

/**
 * Resolve biz id from request in priority order:
 * 1) path param (`/:bizId/...`)
 * 2) query (`?bizId=...`)
 * 3) header (`x-biz-id`)
 * 4) active org from Better Auth session
 */
function resolveBizId(c: Context, bizIdParam = 'bizId'): string | undefined {
  const fromParam = c.req.param(bizIdParam)
  if (fromParam) return fromParam

  const fromQuery = c.req.query(bizIdParam)
  if (fromQuery) return fromQuery

  const fromHeader = c.req.header('x-biz-id')
  if (fromHeader) return fromHeader

  const session = c.get('session')
  if (session?.activeOrganizationId) return session.activeOrganizationId

  return undefined
}

function resolveScopedParam(c: Context, paramName?: string, headerName?: string) {
  if (!paramName) return undefined
  const fromParam = c.req.param(paramName)
  if (fromParam) return fromParam
  const fromQuery = c.req.query(paramName)
  if (fromQuery) return fromQuery
  if (headerName) {
    const fromHeader = c.req.header(headerName)
    if (fromHeader) return fromHeader
  }
  return undefined
}

/**
 * Require authenticated membership in the resolved biz scope.
 */
export function requireBizAccess(bizIdParam = 'bizId') {
  return async (c: Context, next: Next) => {
    const user = c.get('user')

    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
          meta: {
            requestId: c.get('requestId') ?? crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        401,
      )
    }

    const bizId = resolveBizId(c, bizIdParam)
    if (!bizId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: `Missing biz scope. Provide :${bizIdParam}, ?${bizIdParam}=, or x-biz-id header.`,
          },
          meta: {
            requestId: c.get('requestId') ?? crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        400,
      )
    }

    // Platform admins can operate across biz tenants even without explicit
    // membership rows. This supports central support/ops workflows.
    if (user.role === 'admin' || user.role === 'owner') {
      c.set('bizId', bizId)
      c.set('membershipId', `platform-admin:${user.id}`)
      c.set('membershipRole', 'admin')
      await next()
      return
    }

    const membership = await db.query.members.findFirst({
      where: (table, helpers) =>
        helpers.and(helpers.eq(table.organizationId, bizId), helpers.eq(table.userId, user.id)),
    })

    if (!membership) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not a member of this biz.',
          },
          meta: {
            requestId: c.get('requestId') ?? crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        403,
      )
    }

    c.set('bizId', bizId)
    c.set('membershipId', membership.id)
    c.set('membershipRole', membership.role as BizRole)

    await next()
  }
}

/**
 * Guard for platform-level administration routes.
 *
 * Use this when a route should only be reachable by global operators, not
 * tenant memberships.
 */
export function requirePlatformAdmin(c: Context, next: Next) {
  const user = c.get('user')
  if (!user?.id) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        meta: {
          requestId: c.get('requestId') ?? crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      401,
    )
  }

  if (user.role !== 'admin' && user.role !== 'owner') {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Platform admin role required.' },
        meta: {
          requestId: c.get('requestId') ?? crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      },
      403,
    )
  }

  return next()
}

/**
 * Require one of the allowed membership roles for the current biz.
 */
export function requireBizRole(allowed: BizRole[]) {
  return async (c: Context, next: Next) => {
    const role = c.get('membershipRole')
    const user = c.get('user')

    const isPlatformAdmin = user?.role === 'admin' || user?.role === 'owner'
    if (!isPlatformAdmin && !allowed.includes(role)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Requires one of roles: ${allowed.join(', ')}`,
          },
          meta: {
            requestId: c.get('requestId') ?? crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        403,
      )
    }

    await next()
  }
}

/**
 * Permission-based authorization guard.
 *
 * Why this exists:
 * - decouples route auth from hardcoded role arrays,
 * - supports configurable ACL at platform/biz/location/resource levels,
 * - keeps route code explicit by naming the required permission key.
 */
export function requireAclPermission(permissionKey: string, options: PermissionGuardOptions = {}) {
  return async (c: Context, next: Next) => {
    const user = c.get('user')
    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
          },
          meta: {
            requestId: c.get('requestId') ?? crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        401,
      )
    }

    const bizId = c.get('bizId') ?? resolveBizId(c, options.bizIdParam ?? 'bizId')
    const locationId = resolveScopedParam(c, options.locationIdParam, 'x-location-id')
    const resourceId = resolveScopedParam(c, options.resourceIdParam, 'x-resource-id')
    const subjectType = resolveScopedParam(c, options.subjectTypeParam)
    const subjectId = resolveScopedParam(c, options.subjectIdParam)

    const decision = await evaluatePermission({
      userId: user.id,
      platformRole: user.role ?? null,
      permissionKey,
      scope: {
        bizId: bizId ?? null,
        locationId: locationId ?? null,
        resourceId: resourceId ?? null,
        subjectType: subjectType ?? null,
        subjectId: subjectId ?? null,
      },
    })

    if (!decision.allowed) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Permission denied: ${permissionKey}`,
          },
          data: {
            permissionKey,
            decision,
          },
          meta: {
            requestId: c.get('requestId') ?? crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        403,
      )
    }

    const authScopes = c.get('authScopes')
    if (!permissionAllowedByScopes(authScopes, permissionKey)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Credential scope does not allow permission: ${permissionKey}`,
          },
          data: {
            permissionKey,
            authScopes,
          },
          meta: {
            requestId: c.get('requestId') ?? crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        403,
      )
    }

    await next()
  }
}

/** Context helpers used by handlers. */
export function getCurrentUser(c: Context): CurrentUser | undefined {
  return c.get('user')
}

export function getCurrentBizId(c: Context): string | undefined {
  return c.get('bizId')
}

export function getCurrentBizRole(c: Context): BizRole | undefined {
  return c.get('membershipRole')
}

export function getCurrentAuthSource(c: Context): AuthSource | undefined {
  return c.get('authSource')
}

export function getCurrentAuthScopes(c: Context): string[] | undefined {
  return c.get('authScopes')
}

export function getCurrentAuthCredentialId(c: Context): string | undefined {
  return c.get('authCredentialId')
}
