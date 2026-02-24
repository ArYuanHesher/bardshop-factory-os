import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  const token = request.cookies.get('bardshop-token')?.value
  const role = request.cookies.get('bardshop-role')?.value
  const permissionsCookie = request.cookies.get('bardshop-permissions')?.value || ''
  const permissions = new Set(
    decodeURIComponent(permissionsCookie)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  )

  const isPublicPath = path === '/login' || path === '/apply-account'
  const isAdminPath = path.startsWith('/admin')
  const isOpsPath = path.startsWith('/dashboard') || path.startsWith('/estimation') || path.startsWith('/tasks') || path.startsWith('/qa')
  const hasPermissionsCookie = permissions.size > 0

  const hasPermission = (permissionKey: string) => {
    if (role === 'admin') return true
    if (!hasPermissionsCookie) return false
    if (permissionKey === 'system_settings') {
      return permissions.has('system_settings') || permissions.has('production_admin')
    }
    return permissions.has(permissionKey)
  }

  if (token) {
    if (!role && !isPublicPath) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.set('bardshop-token', '', { path: '/', expires: new Date(0) })
      response.cookies.set('bardshop-role', '', { path: '/', expires: new Date(0) })
      response.cookies.set('bardshop-permissions', '', { path: '/', expires: new Date(0) })
      return response
    }

    if (isPublicPath) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (!hasPermissionsCookie) {
      if (isAdminPath && role !== 'admin') {
        return NextResponse.redirect(new URL('/403', request.url))
      }

      if (isOpsPath && role !== 'admin' && role !== 'ops') {
        return NextResponse.redirect(new URL('/403', request.url))
      }

      return NextResponse.next()
    }

    if (isAdminPath) {
      const isSystemSettingsPath =
        path.startsWith('/admin/settings') ||
        path.startsWith('/admin/team') ||
        path.startsWith('/admin/system-logs')

      if (isSystemSettingsPath) {
        if (!hasPermission('system_settings')) {
          return NextResponse.redirect(new URL('/403', request.url))
        }
      } else if (!hasPermission('production_admin')) {
        return NextResponse.redirect(new URL('/403', request.url))
      }
    }

    if (isOpsPath) {
      if (path.startsWith('/dashboard') && !hasPermission('dashboard')) {
        return NextResponse.redirect(new URL('/403', request.url))
      }
      if (path.startsWith('/estimation') && !hasPermission('estimation')) {
        return NextResponse.redirect(new URL('/403', request.url))
      }
      if (path.startsWith('/tasks') && !hasPermission('tasks')) {
        return NextResponse.redirect(new URL('/403', request.url))
      }
      if (path.startsWith('/qa') && !hasPermission('qa')) {
        return NextResponse.redirect(new URL('/403', request.url))
      }
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