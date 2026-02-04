'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'

// 定義資料介面 (與 DailyOperations 保持一致)
interface OrderHistory {
  id: number
  created_at: string // 上傳/歸檔時間
  order_number: string
  doc_type: string
  designer: string
  customer: string
  handler: string
  issuer: string
  item_code: string
  item_name: string
  quantity: number
  delivery_date: string
  plate_count: string
  matched_route_id: string
  total_time_min: number
  status: string
  log_msg: string
}

export default function HistoryPage() {
  const [data, setData] = useState<OrderHistory[]>([])
  const [loading, setLoading] = useState(true)
  // 簡單的搜尋過濾
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setLoading(true)
    // 限制抓取最近 500 筆，避免資料量過大卡頓
    const { data, error } = await supabase
      .from('daily_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    
    if (error) console.error(error)
    else setData(data || [])
    setLoading(false)
  }

  // 前端過濾邏輯
  const filteredData = data.filter(row => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      row.order_number?.toLowerCase().includes(term) ||
      row.item_code?.toLowerCase().includes(term) ||
      row.customer?.toLowerCase().includes(term) ||
      row.doc_type?.toLowerCase().includes(term)
    )
  })

  // 格式化日期時間
  const formatDateTime = (isoString: string) => {
    if (!isoString) return '-'
    return new Date(isoString).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="p-6 md:p-8 max-w-[1800px] mx-auto text-slate-300 min-h-screen">
      
      {/* 標題與工具列 */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">發單紀錄總表</h1>
          <p className="text-purple-500 mt-1 font-mono text-sm uppercase">
            MASTER ORDER HISTORY // 正式生產資料庫 (READ ONLY)
          </p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
           {/* 搜尋框 */}
           <div className="relative flex-1 md:w-64">
             <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
               <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
             <input 
               type="text" 
               placeholder="搜尋單號/品號/客戶..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg block pl-10 p-2.5 focus:ring-purple-500 focus:border-purple-500 placeholder-slate-600"
             />
           </div>

           <button 
             onClick={fetchHistory} 
             className="bg-slate-800 border border-slate-600 px-4 py-2 rounded hover:bg-slate-700 text-white flex items-center gap-2 transition-all"
           >
             <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             重新整理
           </button>
        </div>
      </div>

      {/* 表格區塊 */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden shadow-xl flex flex-col h-[75vh]">
        <div className="p-3 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-white flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              歷史資料列表
            </h2>
            <div className="text-xs font-mono text-slate-500">
              顯示最近 {filteredData.length} 筆資料
            </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 animate-pulse">
             <svg className="w-10 h-10 mb-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             載入歷史數據中...
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-[11px] border-collapse table-fixed min-w-[1400px]">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono sticky top-0 z-10 shadow-lg">
                <tr>
                  <th className="p-3 w-28 border-b border-slate-700">上傳時間</th>
                  <th className="p-3 w-20 border-b border-slate-700 text-cyan-400">工單編號</th>
                  <th className="p-3 w-16 border-b border-slate-700">種類</th>
                  <th className="p-3 w-24 border-b border-slate-700 text-purple-300">品項編碼</th>
                  <th className="p-3 w-48 border-b border-slate-700">品名/規格</th>
                  <th className="p-3 w-16 text-right border-b border-slate-700">數量</th>
                  <th className="p-3 w-24 border-b border-slate-700">交付日</th>
                  <th className="p-3 w-16 border-b border-slate-700">美編</th>
                  <th className="p-3 w-20 border-b border-slate-700">客戶</th>
                  <th className="p-3 w-16 border-b border-slate-700">承辦</th>
                  <th className="p-3 w-16 border-b border-slate-700">開單</th>
                  <th className="p-3 w-12 text-center border-b border-slate-700">盤數</th>
                  <th className="p-3 w-20 text-right border-b border-slate-700 text-emerald-400">總工時</th>
                  <th className="p-3 w-16 text-center border-b border-slate-700">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/60 transition-colors group">
                    <td className="p-3 text-slate-500 font-mono text-[10px]">{formatDateTime(row.created_at)}</td>
                    <td className="p-3 font-mono text-cyan-300 font-bold">{row.order_number}</td>
                    <td className="p-3 text-slate-400">{row.doc_type}</td>
                    <td className="p-3 font-mono text-purple-300">{row.item_code}</td>
                    <td className="p-3 text-slate-300 break-words leading-tight">{row.item_name}</td>
                    <td className="p-3 text-right font-mono font-bold text-white">
                      {row.quantity?.toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-slate-400">{row.delivery_date}</td>
                    <td className="p-3 text-slate-500">{row.designer}</td>
                    <td className="p-3 text-slate-500 truncate" title={row.customer}>{row.customer}</td>
                    <td className="p-3 text-slate-500">{row.handler}</td>
                    <td className="p-3 text-slate-500">{row.issuer}</td>
                    <td className="p-3 text-center text-slate-400">{row.plate_count}</td>
                    <td className="p-3 text-right font-mono text-emerald-400 font-bold">{row.total_time_min}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        row.status === 'OK' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 
                        row.status === 'Completed' ? 'bg-blue-900/30 text-blue-400 border-blue-800' :
                        'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {row.status || 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr><td colSpan={14} className="p-20 text-center text-slate-600">查無資料</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}