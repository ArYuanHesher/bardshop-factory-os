import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  const token = request.cookies.get('bardshop-token')?.value
  const role = request.cookies.get('bardshop-role')?.value
  const isPublicPath = path === '/login'
  const isAdminPath = path.startsWith('/admin')
  const isOpsPath = path.startsWith('/dashboard') || path.startsWith('/estimation') || path.startsWith('/tasks')

  if (token) {
    if (isPublicPath) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (isAdminPath && role !== 'admin') {
      return NextResponse.redirect(new URL('/403', request.url))
    }

    if (isOpsPath && role !== 'admin' && role !== 'ops') {
      return NextResponse.redirect(new URL('/403', request.url))
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