'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function DatabaseViewer() {
  const [activeTab, setActiveTab] = useState<'ops' | 'routes' | 'items'>('ops')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // 分頁與搜尋狀態
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0) // 目前頁碼 (從 0 開始)
  const [totalCount, setTotalCount] = useState(0) // 資料庫總筆數
  const PAGE_SIZE = 100 // 每頁顯示筆數

  // 當 分頁、搜尋關鍵字 或 頁碼 改變時，觸發抓取
  useEffect(() => {
    fetchData()
  }, [activeTab, page, searchTerm])

  // 當切換分頁時，重置搜尋與頁碼
  const handleTabChange = (tab: 'ops' | 'routes' | 'items') => {
    setActiveTab(tab)
    setPage(0)
    setSearchTerm('')
    setData([])
  }

  // 當搜尋輸入時，重置回第一頁 (並加入防抖動，避免打字太快一直發請求)
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setPage(0) 
  }

  const fetchData = async () => {
    setLoading(true)
    
    try {
      let query = supabase.from(
        activeTab === 'ops' ? 'operation_times' : 
        activeTab === 'routes' ? 'route_operations' : 'item_routes'
      )
      .select('*', { count: 'exact' }) // count: 'exact' 讓我們知道符合條件的總筆數有多少

      // --- 1. 搜尋邏輯 (Server-side Search) ---
      if (searchTerm) {
        if (activeTab === 'ops') {
          query = query.ilike('op_name', `%${searchTerm}%`)
        } else if (activeTab === 'routes') {
          // 搜尋 RouteID 或 OpName
          query = query.or(`route_id.ilike.%${searchTerm}%,op_name.ilike.%${searchTerm}%`)
        } else if (activeTab === 'items') {
          // 搜尋 ItemCode 或 ItemName
          query = query.or(`item_code.ilike.%${searchTerm}%,item_name.ilike.%${searchTerm}%`)
        }
      }

      // --- 2. 排序邏輯 ---
      if (activeTab === 'ops') {
        query = query.order('op_name', { ascending: true })
      } else if (activeTab === 'routes') {
        query = query.order('route_id', { ascending: true }).order('sequence', { ascending: true })
      } else if (activeTab === 'items') {
        query = query.order('item_code', { ascending: true })
      }

      // --- 3. 分頁邏輯 (Server-side Pagination) ---
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      query = query.range(from, to)

      const { data: result, count, error } = await query
      
      if (error) throw error

      setData(result || [])
      setTotalCount(count || 0)

    } catch (err: any) {
      console.error('讀取失敗:', err)
      alert('讀取資料失敗: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // 計算總頁數
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto text-slate-300 min-h-screen">
      
      {/* 標題區 */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">工序母資料庫</h1>
          <p className="text-cyan-500/80 mt-1 font-mono text-sm uppercase">
            DATABASE VIEWER // 伺服器端搜尋與分頁
          </p>
        </div>

        {/* 搜尋框 */}
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="搜尋資料庫 (Enter search...)" 
            value={searchTerm}
            onChange={handleSearch}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg block pl-10 p-2.5 focus:ring-cyan-500 focus:border-cyan-500 placeholder-slate-600"
          />
        </div>
      </div>

      {/* 分頁標籤 (Tabs) */}
      <div className="flex gap-2 mb-6 border-b border-slate-800">
        <button 
          onClick={() => handleTabChange('items')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'items' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          品項關聯 (Items)
        </button>
        <button 
          onClick={() => handleTabChange('routes')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'routes' ? 'border-purple-500 text-purple-400 bg-purple-950/20' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          途程表 (Routes)
        </button>
        <button 
          onClick={() => handleTabChange('ops')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'ops' ? 'border-blue-500 text-blue-400 bg-blue-950/20' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          工序時間 (Operations)
        </button>
      </div>

      {/* 資料表格 */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden shadow-xl flex flex-col min-h-[600px]">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 animate-pulse">
             <svg className="w-10 h-10 mb-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             正在向伺服器查詢資料...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono">
                  <tr>
                    {activeTab === 'items' && (
                      <>
                        <th className="px-6 py-4">品項編碼 (Item Code)</th>
                        <th className="px-6 py-4">品項名稱</th>
                        <th className="px-6 py-4 text-right">對應途程 ID</th>
                        <th className="px-6 py-4 text-right text-slate-500">建立時間</th>
                      </>
                    )}
                    {activeTab === 'routes' && (
                      <>
                        <th className="px-6 py-4">途程代碼 (Route ID)</th>
                        <th className="px-6 py-4 text-center">順序</th>
                        <th className="px-6 py-4">工序名稱</th>
                        <th className="px-6 py-4 text-right text-slate-500">建立時間</th>
                      </>
                    )}
                    {activeTab === 'ops' && (
                      <>
                        <th className="px-6 py-4">工序名稱 (Op Name)</th>
                        <th className="px-6 py-4">站點</th>
                        <th className="px-6 py-4 text-right">標準工時 (分)</th>
                        <th className="px-6 py-4 text-right text-slate-500">建立時間</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.length === 0 ? (
                     <tr><td colSpan={4} className="p-12 text-center text-slate-600">查無資料</td></tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                        {activeTab === 'items' && (
                          <>
                            <td className="px-6 py-3 font-mono text-cyan-400 font-bold">{row.item_code}</td>
                            <td className="px-6 py-3">{row.item_name || '-'}</td>
                            <td className="px-6 py-3 text-right font-mono text-purple-400">{row.route_id}</td>
                            <td className="px-6 py-3 text-right text-xs text-slate-600 font-mono">
                               {new Date(row.created_at).toLocaleDateString()}
                            </td>
                          </>
                        )}
                        {activeTab === 'routes' && (
                          <>
                            <td className="px-6 py-3 font-mono text-purple-400">{row.route_id}</td>
                            <td className="px-6 py-3 text-center font-mono text-slate-500">{row.sequence}</td>
                            <td className="px-6 py-3 text-slate-300">{row.op_name}</td>
                            <td className="px-6 py-3 text-right text-xs text-slate-600 font-mono">
                               {new Date(row.created_at).toLocaleDateString()}
                            </td>
                          </>
                        )}
                        {activeTab === 'ops' && (
                          <>
                            <td className="px-6 py-3 text-white font-bold">{row.op_name}</td>
                            <td className="px-6 py-3 text-slate-500">{row.station}</td>
                            <td className="px-6 py-3 text-right font-mono text-green-400">{row.std_time_min}</td>
                            <td className="px-6 py-3 text-right text-xs text-slate-600 font-mono">
                               {new Date(row.created_at).toLocaleDateString()}
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 底部：分頁控制器 */}
            <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-xs text-slate-500 font-mono">
                顯示 {data.length > 0 ? page * PAGE_SIZE + 1 : 0} - {Math.min((page + 1) * PAGE_SIZE, totalCount)} 筆，共 {totalCount} 筆資料
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                  className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一頁
                </button>
                <span className="text-xs font-mono text-slate-400 px-2">
                   Page {page + 1} / {totalPages || 1}
                </span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || loading}
                  className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一頁
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}