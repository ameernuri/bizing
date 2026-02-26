'use client'

import { apiUrl } from '@/lib/api'

/**
 * Minimal Better Auth client wrapper for the admin app.
 *
 * Why this exists:
 * - keeps auth endpoint paths in one place,
 * - keeps credentials/cookie behavior consistent,
 * - gives pages a typed interface instead of ad-hoc fetch calls.
 */

export type AuthUser = {
  id: string
  email?: string | null
  name?: string | null
  role?: string | null
}

export type AuthSession = {
  id: string
  activeOrganizationId?: string | null
}

export type SessionPayload = {
  user: AuthUser
  session: AuthSession
} | null

export type SignInInput = {
  email: string
  password: string
}

export type SignUpInput = {
  email: string
  password: string
  name?: string
}

export type BizMembershipRole = 'owner' | 'admin' | 'manager' | 'staff' | 'host' | 'customer'

export type BizMembershipSummary = {
  id: string
  name: string
  slug: string
  membershipId?: string
  membershipRole: BizMembershipRole
  membershipCreatedAt?: string
}

export type AuthContextPayload = {
  user: AuthUser
  session: AuthSession
  memberships: BizMembershipSummary[]
  activeBizId: string | null
  permissionKeys: string[]
}

type JsonLike = Record<string, unknown>

class ApiRequestError extends Error {
  status: number
  payload: unknown

  constructor(status: number, message: string, payload: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.payload = payload
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as JsonLike
  const message = record.message
  if (typeof message === 'string' && message.trim().length > 0) return message

  const error = record.error
  if (error && typeof error === 'object') {
    const errorMessage = (error as JsonLike).message
    if (typeof errorMessage === 'string' && errorMessage.trim().length > 0) return errorMessage
  }

  return null
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const rawText = await response.text().catch(() => '')
  let payload: unknown = null
  if (rawText) {
    try {
      payload = JSON.parse(rawText) as unknown
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const fallback =
      response.status >= 500
        ? `Server error (HTTP ${response.status}). Check API logs and DATABASE_URL connectivity/quota.`
        : `Request failed with HTTP ${response.status}`
    const message =
      extractErrorMessage(payload) ||
      rawText.trim() ||
      fallback
    throw new ApiRequestError(response.status, message, payload)
  }

  return payload
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

type ApiEnvelope<T> = {
  success: boolean
  data: T
}

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const payload = (await requestJson(path, init)) as ApiEnvelope<T>
  if (!payload || payload.success !== true) {
    throw new Error('API response was not successful.')
  }
  return payload.data
}

export const authClient = {
  /**
   * Wait for Better Auth session cookie/session row to become visible to
   * subsequent API calls. This prevents "signed in" -> immediate 401 races.
   */
  async waitForSession(attempts = 6, delayMs = 120): Promise<SessionPayload> {
    for (let i = 0; i < attempts; i += 1) {
      const payload = await this.getSession().catch(() => null)
      if (payload?.user?.id && payload?.session?.id) return payload
      if (i < attempts - 1) await delay(delayMs)
    }
    return null
  },

  async getSession(): Promise<SessionPayload> {
    const payload = await requestJson('/api/auth/get-session', { method: 'GET' })
    if (!payload || typeof payload !== 'object') return null

    const record = payload as JsonLike
    const user = record.user
    const session = record.session
    if (!user || !session || typeof user !== 'object' || typeof session !== 'object') return null

    return {
      user: user as AuthUser,
      session: session as AuthSession,
    }
  },

  async signInEmail(input: SignInInput): Promise<void> {
    await requestJson('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const session = await this.waitForSession()
    if (!session) {
      throw new Error('Sign-in succeeded but no session was established yet. Please retry.')
    }
  },

  async signUpEmail(input: SignUpInput): Promise<void> {
    await requestJson('/api/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const session = await this.waitForSession()
    if (!session) {
      throw new Error('Account created but no session was established yet. Please retry.')
    }
  },

  async signOut(): Promise<void> {
    // Better Auth validates Origin for sign-out to mitigate CSRF.
    await requestJson('/api/auth/sign-out', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },

  async listBizes(): Promise<BizMembershipSummary[]> {
    return requestApi<BizMembershipSummary[]>('/api/v1/bizes?perPage=100')
  },

  async getAuthContext(): Promise<AuthContextPayload> {
    // Avoid calling /api/v1/auth/me when there is clearly no active Better Auth session.
    const currentSession = await this.getSession().catch(() => null)
    if (!currentSession?.user?.id || !currentSession?.session?.id) {
      throw new ApiRequestError(401, 'Authentication required.', null)
    }

    try {
      return await requestApi<AuthContextPayload>('/api/v1/auth/me')
    } catch (error) {
      // If session propagation is slightly delayed, retry once after a short wait.
      if (error instanceof ApiRequestError && error.status === 401) {
        const recovered = await this.waitForSession(4, 150)
        if (!recovered) throw error
        return requestApi<AuthContextPayload>('/api/v1/auth/me')
      }
      throw error
    }
  },

  async switchActiveBiz(bizId: string): Promise<{ id: string; activeOrganizationId: string | null }> {
    return requestApi<{ id: string; activeOrganizationId: string | null }>('/api/v1/auth/active-biz', {
      method: 'PATCH',
      body: JSON.stringify({ bizId }),
    })
  },
}
