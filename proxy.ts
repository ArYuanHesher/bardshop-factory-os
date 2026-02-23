import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  const token = request.cookies.get('bardshop-token')?.value
  const isPublicPath = path === '/login'

  if (token) {
    if (isPublicPath) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  } else {
    if (!isPublicPath) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}