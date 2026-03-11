/**
 * Route-class matrix for API auth posture.
 *
 * ELI5:
 * Every endpoint belongs to one "door policy":
 * - public: anyone can call it
 * - session_only: only a logged-in human browser session can call it
 * - machine_allowed: human session OR machine credential can call it
 * - internal_only: platform-internal/testing operators only
 *
 * Why this exists:
 * - keeps auth posture coherent across hundreds of routes
 * - prevents accidental exposure when new routes are added
 * - gives one canonical place to reason about route security expectations
 */

export type RouteClass = 'public' | 'session_only' | 'machine_allowed' | 'internal_only'

type RouteClassRule = {
  /**
   * Human-readable key for debugging/logging.
   */
  key: string
  /**
   * Regex is used because many routes have dynamic path ids.
   */
  path: RegExp
  /**
   * Optional method filter. If omitted, applies to all methods.
   */
  methods?: ReadonlyArray<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'>
  class: RouteClass
}

/**
 * Route-class rules are ordered from most specific -> least specific.
 */
const ROUTE_CLASS_RULES: RouteClassRule[] = [
  {
    key: 'internal-test-surface',
    path: /^\/api\/v1\/test(?:\/|$)/,
    class: 'internal_only',
  },
  {
    key: 'internal-operator-surface',
    path: /^\/api\/v1\/internal(?:\/|$)/,
    class: 'internal_only',
  },
  {
    key: 'public-v1-surface',
    path: /^\/api\/v1\/public(?:\/|$)/,
    class: 'public',
  },
  {
    key: 'better-auth-surface',
    path: /^\/api\/auth(?:\/|$)/,
    class: 'public',
  },
  {
    key: 'impersonation-surface',
    path: /^\/api\/v1\/auth\/impersonation(?:\/|$)/,
    class: 'session_only',
  },
  {
    key: 'machine-token-exchange',
    path: /^\/api\/v1\/auth\/tokens\/exchange(?:\/|$)/,
    class: 'machine_allowed',
  },
  {
    key: 'machine-auth-management',
    path: /^\/api\/v1\/auth\/(?:api-keys|tokens|events|principals)(?:\/|$)/,
    class: 'session_only',
  },
  {
    key: 'agent-surface',
    path: /^\/api\/v1\/agents(?:\/|$)/,
    class: 'machine_allowed',
  },
  {
    key: 'ooda-surface',
    path: /^\/api\/v1\/ooda(?:\/|$)/,
    class: 'machine_allowed',
  },
  {
    key: 'default-v1-protected',
    path: /^\/api\/v1(?:\/|$)/,
    class: 'machine_allowed',
  },
]

export function resolveRouteClass(
  path: string,
  method: string,
): { routeClass: RouteClass; ruleKey: string } {
  const normalizedMethod = String(method || 'GET').toUpperCase() as
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
    | 'HEAD'
    | 'OPTIONS'
  for (const rule of ROUTE_CLASS_RULES) {
    if (!rule.path.test(path)) continue
    if (rule.methods && !rule.methods.includes(normalizedMethod)) {
      continue
    }
    return { routeClass: rule.class, ruleKey: rule.key }
  }
  /**
   * Security default:
   * If a route is not explicitly classified, we fail closed.
   *
   * ELI5:
   * New routes should never become public by accident.
   * They must be intentionally listed in ROUTE_CLASS_RULES.
   */
  return { routeClass: 'internal_only', ruleKey: 'implicit-internal-fallback' }
}

export function routeClassAllowsUnauthenticated(routeClass: RouteClass) {
  return routeClass === 'public'
}

export function routeClassAllowsMachine(routeClass: RouteClass) {
  return routeClass === 'machine_allowed'
}

export function routeClassRequiresSession(routeClass: RouteClass) {
  return routeClass === 'session_only'
}

export function routeClassIsInternalOnly(routeClass: RouteClass) {
  return routeClass === 'internal_only'
}
