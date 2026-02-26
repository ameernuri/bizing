'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  authClient,
  type AuthContextPayload,
  type BizMembershipRole,
  type BizMembershipSummary,
  type AuthSession,
  type AuthUser,
  type SessionPayload,
  type SignInInput,
  type SignUpInput,
} from '@/lib/auth-client'

type AuthContextValue = {
  user: AuthUser | null
  session: AuthSession | null
  memberships: BizMembershipSummary[]
  permissionKeys: string[]
  activeBizId: string | null
  activeBizRole: BizMembershipRole | null
  isAuthenticated: boolean
  isLoading: boolean
  refreshContext: () => Promise<AuthContextPayload | null>
  refreshSession: () => Promise<SessionPayload>
  refreshMemberships: () => Promise<BizMembershipSummary[]>
  switchActiveBiz: (bizId: string) => Promise<void>
  signInEmail: (input: SignInInput) => Promise<void>
  signUpEmail: (input: SignUpInput) => Promise<void>
  signOut: () => Promise<void>
  hasPlatformRole: (allowed: string[]) => boolean
  hasBizRole: (allowed: BizMembershipRole[], bizId?: string | null) => boolean
  hasPermission: (permissionKey: string) => boolean
  hasAnyPermission: (permissionKeys: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * AuthProvider is the single source of truth for admin client session state.
 *
 * Pages should consume `useAuth()` rather than calling Better Auth endpoints
 * directly. This keeps authentication behavior consistent as the app grows.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [memberships, setMemberships] = useState<BizMembershipSummary[]>([])
  const [permissionKeys, setPermissionKeys] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const applyAuthContext = useCallback((payload: AuthContextPayload | null) => {
    if (!payload) {
      setUser(null)
      setSession(null)
      setMemberships([])
      setPermissionKeys([])
      return
    }
    setUser(payload.user)
    setSession(payload.session)
    setMemberships(payload.memberships ?? [])
    setPermissionKeys(payload.permissionKeys ?? [])
  }, [])

  const refreshContext = useCallback(async (): Promise<AuthContextPayload | null> => {
    try {
      const payload = await authClient.getAuthContext()
      applyAuthContext(payload)
      return payload
    } catch {
      applyAuthContext(null)
      return null
    }
  }, [applyAuthContext])

  const refreshSession = useCallback(async (): Promise<SessionPayload> => {
    const payload = await refreshContext()
    if (!payload) return null
    return { user: payload.user, session: payload.session }
  }, [refreshContext])

  const refreshMemberships = useCallback(async (): Promise<BizMembershipSummary[]> => {
    const payload = await refreshContext()
    return payload?.memberships ?? []
  }, [refreshContext])

  const switchActiveBiz = useCallback(
    async (bizId: string) => {
      await authClient.switchActiveBiz(bizId)
      await refreshContext()
    },
    [refreshContext],
  )

  const signInEmail = useCallback(
    async (input: SignInInput) => {
      await authClient.signInEmail(input)
      const payload = await refreshSession()
      if (!payload) {
        throw new Error('Signed in, but session context could not be loaded. Please retry.')
      }
      await refreshMemberships()
    },
    [refreshMemberships, refreshSession],
  )

  const signUpEmail = useCallback(
    async (input: SignUpInput) => {
      await authClient.signUpEmail(input)
      const payload = await refreshSession()
      if (!payload) {
        throw new Error('Account created, but session context could not be loaded. Please retry.')
      }
      await refreshMemberships()
    },
    [refreshMemberships, refreshSession],
  )

  const signOut = useCallback(async () => {
    await authClient.signOut()
    applyAuthContext(null)
  }, [applyAuthContext])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const payload = await authClient.getAuthContext().catch(() => null)
        if (!cancelled) applyAuthContext(payload)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyAuthContext])

  const activeBizId = session?.activeOrganizationId ?? memberships[0]?.id ?? null
  const activeBizRole =
    memberships.find((membership) => membership.id === activeBizId)?.membershipRole ?? null

  const hasPlatformRole = useCallback(
    (allowed: string[]) => {
      const role = user?.role ?? ''
      return allowed.includes(role)
    },
    [user?.role],
  )

  const hasBizRole = useCallback(
    (allowed: BizMembershipRole[], bizId?: string | null) => {
      const targetBizId = bizId ?? activeBizId
      if (!targetBizId) return false
      const role = memberships.find((membership) => membership.id === targetBizId)?.membershipRole
      if (!role) return false
      return allowed.includes(role)
    },
    [activeBizId, memberships],
  )

  const hasPermission = useCallback(
    (permissionKey: string) => {
      if (user?.role === 'admin' || user?.role === 'owner') return true
      return permissionKeys.includes(permissionKey)
    },
    [permissionKeys, user?.role],
  )

  const hasAnyPermission = useCallback(
    (permissionList: string[]) => {
      if (user?.role === 'admin' || user?.role === 'owner') return true
      return permissionList.some((permissionKey) => permissionKeys.includes(permissionKey))
    },
    [permissionKeys, user?.role],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      memberships,
      permissionKeys,
      activeBizId,
      activeBizRole,
      isAuthenticated: Boolean(user?.id && session?.id),
      isLoading,
      refreshContext,
      refreshSession,
      refreshMemberships,
      switchActiveBiz,
      signInEmail,
      signUpEmail,
      signOut,
      hasPlatformRole,
      hasBizRole,
      hasPermission,
      hasAnyPermission,
    }),
    [
      user,
      session,
      memberships,
      permissionKeys,
      activeBizId,
      activeBizRole,
      isLoading,
      refreshContext,
      refreshSession,
      refreshMemberships,
      switchActiveBiz,
      signInEmail,
      signUpEmail,
      signOut,
      hasPlatformRole,
      hasBizRole,
      hasPermission,
      hasAnyPermission,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }
  return context
}
