'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Central admin auth screen.
 *
 * Every protected route redirects here when the session cookie is missing.
 * The page supports sign-in and sign-up to reduce friction for local testing.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <Card className="w-full max-w-md">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Loading login...</CardContent>
          </Card>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, signInEmail, signUpEmail } = useAuth()

  const nextPath = useMemo(() => {
    const next = searchParams.get('next') || '/'
    return next.startsWith('/') ? next : '/'
  }, [searchParams])
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(nextPath)
    }
  }, [isLoading, isAuthenticated, nextPath, router])

  async function onSubmit() {
    setSubmitting(true)
    setError(null)

    try {
      if (!email || !password) {
        throw new Error('Email and password are required.')
      }
      if (mode === 'sign_in') {
        await signInEmail({ email, password })
      } else {
        await signUpEmail({
          email,
          password,
          name: name.trim() || email.split('@')[0],
        })
      }
      router.replace(nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">Loading session...</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="px-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
          <CardTitle>{mode === 'sign_in' ? 'Sign in' : 'Create account'}</CardTitle>
          <CardDescription>Use your Better Auth account to access admin routes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mode === 'sign_up' ? (
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              type="text"
              placeholder="display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : null}
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting ? 'Working...' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setMode((prev) => (prev === 'sign_in' ? 'sign_up' : 'sign_in'))}
              disabled={submitting}
            >
              {mode === 'sign_in' ? 'Need an account?' : 'Have an account?'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
