'use client'

import Link from 'next/link'
import { Building2, FlaskConical, LayoutTemplate, LogIn, LogOut, MapPin, Shield } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function HomePage() {
  const {
    isLoading,
    isAuthenticated,
    user,
    memberships,
    activeBizId,
    activeBizRole,
    permissionKeys,
    signOut,
  } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading admin workspace...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Bizing Admin</CardTitle>
            <CardDescription>
              You are signed out. Use the login page to access workspace tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              Login route: <code>/login</code>
            </div>
            <Link href="/login">
              <Button className="w-full">
                <LogIn className="mr-2 h-4 w-4" />
                Go To Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeMembership = memberships.find((row) => row.id === activeBizId)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Bizing Admin</h1>
            <p className="text-sm text-muted-foreground">
              Stable workspace home. Use the cards below to navigate.
            </p>
          </div>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Email:</span> {user?.email ?? 'unknown'}
              </p>
              <p>
                <span className="text-muted-foreground">Platform role:</span> {user?.role ?? 'user'}
              </p>
              <p>
                <span className="text-muted-foreground">Memberships:</span> {memberships.length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Active Biz
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="break-all">
                <span className="text-muted-foreground">Biz:</span>{' '}
                {activeMembership?.name ?? activeBizId ?? 'none'}
              </p>
              <p>
                <span className="text-muted-foreground">Role:</span> {activeBizRole ?? 'none'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Effective ACL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Permission keys:</span> {permissionKeys.length}
              </p>
              <div className="flex flex-wrap gap-1">
                {permissionKeys.slice(0, 6).map((key) => (
                  <Badge key={key} variant="secondary">
                    {key}
                  </Badge>
                ))}
                {permissionKeys.length > 6 ? <Badge variant="outline">+{permissionKeys.length - 6}</Badge> : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/sagas">
            <Card className="h-full transition-colors hover:bg-muted/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FlaskConical className="h-4 w-4" />
                  Saga Runs
                </CardTitle>
                <CardDescription>Lifecycle testing sessions and pseudoshot artifacts.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/schema">
            <Card className="h-full transition-colors hover:bg-muted/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayoutTemplate className="h-4 w-4" />
                  Schema Explorer
                </CardTitle>
                <CardDescription>Explore table graph and schema metadata.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
