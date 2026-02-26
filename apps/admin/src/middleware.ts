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

  // Never guard Next internals or static assets.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const isLoginPage = pathname === '/login'
  const hasSessionCookie = Boolean(request.cookies.get('better-auth.session_token')?.value)

  if (isLoginPage) {
    // Always allow reaching /login. Client-side auth context will redirect
    // authenticated users, while stale cookies can still recover here.
    return NextResponse.next()
  }

  if (!hasSessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
