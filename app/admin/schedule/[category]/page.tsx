'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'

// --- 類別對照 (必須與入口頁一致) ---
const CATEGORY_MAP: Record<string, string> = {
  'printing': '印刷',
  'laser': '雷切',
  'post': '後加工',
  'packaging': '包裝',
  'packing': '包裝',
  'outsourced': '委外',
  'changping': '常平',
}

interface ScheduleItem {
  id: number
  order_number: string
  item_code: string
  op_name: string
  station: string
  std_time: number
  total_time_min: number
  created_at: string
}

export default function CategorySchedulePage() {
  const params = useParams()
  const router = useRouter()
  const categoryId = params.category as string
  const categoryName = CATEGORY_MAP[categoryId] || categoryId

  const [data, setData] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: result, error } = await supabase
        .from('station_time_summary')
        .select('*')
        .ilike('station', `%${categoryName}%`)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setData(result || [])
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : '未知錯誤'
      alert('讀取失敗: ' + message)
    } finally {
      setLoading(false)
    }
  }, [categoryName])

  useEffect(() => {
    if (CATEGORY_MAP[categoryId]) {
      fetchData()
    }
  }, [categoryId, fetchData])

  // 如果網址亂打，顯示 404 風格
  if (!CATEGORY_MAP[categoryId]) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p>找不到此產程分類：{categoryId}</p>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 text-white">回上一頁</button>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-[1800px] mx-auto min-h-screen">
      
      {/* 頁面標題區 */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/admin/schedule')} className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            {categoryName}產程表
            <span className="text-sm font-normal text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800 font-mono uppercase">
              {categoryId} SCHEDULE
            </span>
          </h1>
        </div>
      </div>

      {/* 資料列表 */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden min-h-[600px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 animate-pulse">
            <svg className="w-10 h-10 mb-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            載入 {categoryName} 資料中...
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono sticky top-0 z-10 shadow-lg">
                <tr>
                  <th className="px-6 py-4">工單編號</th>
                  <th className="px-6 py-4">品項編碼</th>
                  <th className="px-6 py-4">工序名稱</th>
                  <th className="px-6 py-4">歸屬站點</th>
                  <th className="px-6 py-4 text-right">標準工時</th>
                  <th className="px-6 py-4 text-right text-emerald-400">預計總時</th>
                  <th className="px-6 py-4 text-right">建立時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.length === 0 ? (
                  <tr><td colSpan={7} className="p-20 text-center text-slate-600">此分類目前無排程資料</td></tr>
                ) : data.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3 font-mono text-cyan-400 font-bold">{row.order_number}</td>
                    <td className="px-6 py-3 font-mono text-purple-300">{row.item_code}</td>
                    <td className="px-6 py-3 text-white">{row.op_name}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs">
                        {row.station}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono">{row.std_time}</td>
                    <td className="px-6 py-3 text-right font-mono text-lg font-bold text-emerald-400">{row.total_time_min}</td>
                    <td className="px-6 py-3 text-right text-xs font-mono">{new Date(row.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}