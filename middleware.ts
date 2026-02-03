import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 1. 取得使用者的路徑
  const path = request.nextUrl.pathname

  // 2. 嘗試讀取 'bardshop-token' 這個餅乾 (Cookie)
  const token = request.cookies.get('bardshop-token')?.value

  // 3. 定義公開路徑 (不需要登入也能看的頁面)
  const isPublicPath = path === '/login'

  // 4. 邏輯判斷：
  
  // 情況 A: 如果已經登入 (有 Token) 且試圖去 "登入頁"，強制踢回 "首頁"
  if (isPublicPath && token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 情況 B: 如果還沒登入 (沒 Token) 且試圖去 "非公開頁面" (例如首頁或後台)，強制踢去 "登入頁"
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

// 設定警衛要守衛哪些路徑 (排除圖片、API、靜態檔案)
export const config = {
  matcher: [
    '/',
    '/login',
    '/admin/:path*',  // 守護 admin 底下所有頁面
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}