import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasAuthCookie = request.cookies.getAll().some(cookie =>
    cookie.name.startsWith('sb-')
  )

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/accept-invite')

  if (!hasAuthCookie && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasAuthCookie && pathname === '/login') {
    return NextResponse.redirect(new URL('/records', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
