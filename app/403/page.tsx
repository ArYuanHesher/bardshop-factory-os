"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ForbiddenPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-300 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900/60 border border-slate-700 rounded-2xl p-8 text-center shadow-2xl">
        <div className="text-6xl font-black text-red-400 mb-3">403</div>
        <h1 className="text-2xl font-bold text-white mb-2">權限不足，無法存取此頁面</h1>
        <p className="text-slate-400 text-sm mb-8">
          你目前的帳號角色無法使用此功能（HTTP 403）。
          <br />
          如需開通權限，請聯絡系統管理員。
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded border border-slate-600 text-slate-200 hover:bg-slate-800 transition-colors"
          >
            返回上一頁
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded border border-slate-600 text-slate-200 hover:bg-slate-800 transition-colors"
          >
            回首頁
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
          >
            重新登入
          </Link>
        </div>
      </div>
    </div>
  )
}
