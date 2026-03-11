'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">Loading...</div>
      }
    >
      <SignInPageContent />
    </Suspense>
  )
}

function SignInPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, signInEmail, signUpEmail } = useAuth()

  const nextPath = useMemo(() => {
    const next = searchParams.get('next') || '/'
    return next.startsWith('/') ? next : '/'
  }, [searchParams])

  const initialMode = useMemo<'sign_in' | 'sign_up'>(
    () => (searchParams.get('mode') === 'sign_up' ? 'sign_up' : 'sign_in'),
    [searchParams],
  )

  const [mode, setMode] = useState<'sign_in' | 'sign_up'>(initialMode)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(nextPath)
    }
  }, [isLoading, isAuthenticated, nextPath, router])

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const helperCopy =
    mode === 'sign_in'
      ? 'Sign in to continue where you left off.'
      : 'Create your account and set up your business in a few quick steps.'

  const leadTitle = mode === 'sign_in' ? 'Welcome back.' : 'Start Bizing in under a minute.'
  const leadDescription =
    mode === 'sign_in'
      ? 'Pick up your day where it left off.'
      : 'Create your account, launch your first offer, and open your schedule.'

  async function onSubmit() {
    setSubmitting(true)
    setError(null)

    try {
      if (!email || !password) throw new Error('Email and password are required.')

      if (mode === 'sign_in') {
        await signInEmail({ email, password })
      } else {
        const normalizedFirstName = firstName.trim()
        const normalizedLastName = lastName.trim()
        if (!normalizedFirstName || !normalizedLastName) {
          throw new Error('First and last name are required.')
        }
        await signUpEmail({
          email,
          password,
          name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
        })
      }

      const redirectPath = mode === 'sign_up' ? '/owner/onboarding' : nextPath
      router.replace(redirectPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 md:px-10">
          <Link href="/" className="inline-flex">
            <img src="/images/bizing.logo.horizontal.combo.svg" alt="Bizing" className="h-9 w-auto" />
          </Link>
          <div className="text-sm text-slate-600">
            {mode === 'sign_in' ? (
              <>
                New here?{' '}
                <button
                  type="button"
                  onClick={() => setMode('sign_up')}
                  className="font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  Create account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('sign_in')}
                  className="font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10 md:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1.25fr_1fr]">
          <section className="space-y-7 pt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {mode === 'sign_in' ? 'Sign in' : 'Create account'}
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-tight text-slate-900 md:text-6xl">{leadTitle}</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-600">{leadDescription}</p>
          </section>

          <Card className="w-full border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl text-slate-900">{mode === 'sign_in' ? 'Sign in' : 'Create your account'}</CardTitle>
              <CardDescription className="text-slate-600">{helperCopy}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void onSubmit()
                }}
              >
                {mode === 'sign_up' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="firstName" className="text-sm font-medium text-slate-800">
                        First name
                      </label>
                      <input
                        id="firstName"
                        className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                        type="text"
                        placeholder="Sarah"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="lastName" className="text-sm font-medium text-slate-800">
                        Last name
                      </label>
                      <input
                        id="lastName"
                        className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                        type="text"
                        placeholder="Lee"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-slate-800">
                    Email
                  </label>
                  <input
                    id="email"
                    className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-slate-800">
                    Password
                  </label>
                  <input
                    id="password"
                    className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                    type="password"
                    placeholder="••••••••"
                    autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error ? <p className="text-sm text-rose-600">{error}</p> : null}

                <Button type="submit" disabled={submitting} className="h-11 w-full bg-slate-900 text-sm font-medium text-white hover:bg-slate-800">
                  {submitting ? 'Working...' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
                </Button>
              </form>

              <div className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-600">
                {mode === 'sign_in' ? (
                  <>
                    Need an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('sign_up')}
                      className="font-medium text-slate-900 underline-offset-4 hover:underline"
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('sign_in')}
                      className="font-medium text-slate-900 underline-offset-4 hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
