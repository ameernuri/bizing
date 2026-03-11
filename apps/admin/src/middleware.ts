import { NextResponse, type NextRequest } from 'next/server'

/**
 * Admin route guard.
 *
 * We enforce auth at edge-level using Better Auth's session cookie presence.
 * Server-side validation still happens in the API. This middleware provides
 * quick UX redirects before client code loads.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname === '/login') {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.search = search
    return NextResponse.redirect(signInUrl)
  }

  // Never guard Next internals or static assets.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const isPublicPath =
    pathname === '/' ||
    pathname === '/sign-in' ||
    pathname === '/book' ||
    pathname.startsWith('/book/')
  const configuredCookiePrefix =
    process.env.NEXT_PUBLIC_BETTER_AUTH_COOKIE_PREFIX?.trim() ||
    process.env.BETTER_AUTH_COOKIE_PREFIX?.trim() ||
    'bizing-auth'
  const sessionCookieCandidates = [
    `${configuredCookiePrefix}.session_token`,
    'bizing-auth.session_token',
    'better-auth.session_token',
  ]
  const hasSessionCookie = sessionCookieCandidates.some((cookieName) =>
    Boolean(request.cookies.get(cookieName)?.value),
  )

  if (isPublicPath) {
    // Public surfaces stay reachable without auth:
    // - `/` (marketing/home)
    // - `/sign-in` (auth)
    // - `/book` (customer booking)
    return NextResponse.next()
  }

  if (!hasSessionCookie) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
