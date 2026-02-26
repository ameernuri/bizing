'use client'

import { type ReactNode } from 'react'
import { useAuth } from '@/components/AuthProvider'
import type { BizMembershipRole } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type RequireRoleProps = {
  children: ReactNode
  platformRoles?: string[]
  bizRoles?: BizMembershipRole[]
  permissions?: string[]
  mode?: 'any' | 'all'
  fallback?: ReactNode
}

/**
 * Route-level UI authorization guard.
 *
 * - `platformRoles`: roles from users.role (global/platform scope).
 * - `bizRoles`: roles from memberships in current active biz scope.
 * - `mode="any"` means either check can pass.
 * - `mode="all"` means every declared check must pass.
 */
export function RequireRole({
  children,
  platformRoles = [],
  bizRoles = [],
  permissions = [],
  mode = 'any',
  fallback,
}: RequireRoleProps) {
  const { isLoading, isAuthenticated, hasPlatformRole, hasBizRole, hasPermission, activeBizId } =
    useAuth()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">Loading access control...</CardContent>
      </Card>
    )
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authentication required</CardTitle>
          <CardDescription>Sign in to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button>Go to login</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  const hasPlatformAccess = platformRoles.length === 0 ? true : hasPlatformRole(platformRoles)
  const hasBizAccess = bizRoles.length === 0 ? true : hasBizRole(bizRoles, activeBizId)
  const hasPermissionAccess =
    permissions.length === 0
      ? true
      : mode === 'all'
        ? permissions.every((permissionKey) => hasPermission(permissionKey))
        : permissions.some((permissionKey) => hasPermission(permissionKey))
  const allowed =
    mode === 'all'
      ? hasPlatformAccess && hasBizAccess && hasPermissionAccess
      : hasPlatformAccess || hasBizAccess || hasPermissionAccess

  if (!allowed) {
    return (
      fallback ?? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Insufficient role permissions</CardTitle>
            <CardDescription>
              Your account is authenticated but lacks the required role for this view.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    )
  }

  return <>{children}</>
}
