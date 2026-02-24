'use client'

import Link from 'next/link'

export default function MaterialsBomPage() {
  return (
    <div className="p-8 max-w-[1200px] mx-auto min-h-screen text-slate-300 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">BOM表</h1>
          <p className="text-orange-500 mt-1 font-mono text-sm uppercase">MATERIAL MANAGEMENT // BOM</p>
        </div>
        <Link
          href="/admin/materials"
          className="px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm"
        >
          返回物料清單
        </Link>
      </div>

      <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-8 text-slate-400">
        BOM表頁面已建立，下一步可開始製作欄位與上傳流程。
      </div>
    </div>
  )
}
