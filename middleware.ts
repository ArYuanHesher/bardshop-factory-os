import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // 嘗試讀取 token
  const token = request.cookies.get('bardshop-token')?.value

  // 定義公開路徑 (只有 login 是公開的)
  const isPublicPath = path === '/login'

  // 情況 A: 已經登入 (有 Token)
  if (token) {
    // 如果登入的人想去 "登入頁"，把他踢回 "首頁"
    if (isPublicPath) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  } 
  // 情況 B: 還沒登入 (沒 Token)
  else {
    // 如果沒登入的人想去 "非公開頁面" (例如首頁或後台)，把他踢去 "登入頁"
    if (!isPublicPath) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  // 其他情況 (例如：已登入且去首頁，或沒登入且在登入頁) -> 放行
  return NextResponse.next()
}

// 設定警衛要守衛哪些路徑
export const config = {
  matcher: [
    /*
     * 匹配所有路徑，但排除以下開頭的：
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}