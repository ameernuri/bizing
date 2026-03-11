import { canvasciiPrincipalSchema, type CanvasciiPrincipal } from '@bizing/canvascii-core'
import { collabConfig } from '../config'

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '')
}

function assertTrustedOrigin(originHeader: string | undefined): void {
  if (!originHeader) return
  const normalized = normalizeOrigin(originHeader)
  if (!collabConfig.trustedOrigins.map(normalizeOrigin).includes(normalized)) {
    throw new Error(`Untrusted websocket origin: ${originHeader}`)
  }
}

export async function resolvePrincipalFromHeaders(headers: Headers | Record<string, string | string[] | undefined>): Promise<CanvasciiPrincipal> {
  const getHeader = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined
    const value = headers[name.toLowerCase()] ?? headers[name]
    if (Array.isArray(value)) return value[0]
    return value
  }

  assertTrustedOrigin(getHeader('origin'))

  const cookie = getHeader('cookie')
  if (cookie) {
    const response = await fetch(`${collabConfig.apiOrigin}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        cookie,
        accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (response.ok) {
      const payload = (await response.json()) as {
        success?: boolean
        data?: {
          user?: { id?: string; email?: string | null; name?: string | null; role?: string | null }
        }
      }

      const principal = canvasciiPrincipalSchema.parse({
        userId: payload.data?.user?.id,
        email: payload.data?.user?.email ?? null,
        name: payload.data?.user?.name ?? null,
        role: payload.data?.user?.role ?? null,
        source: 'better-auth',
      })
      return principal
    }
  }

  if (collabConfig.allowDevAuthBypass) {
    return canvasciiPrincipalSchema.parse({
      userId: collabConfig.devBypassUserId,
      email: null,
      name: 'Canvascii Dev Bypass',
      role: 'developer',
      source: 'dev-bypass',
    })
  }

  throw new Error('Canvascii collaboration requires a valid Better Auth session.')
}
