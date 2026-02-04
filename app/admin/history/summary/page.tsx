'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'

// 定義資料介面
interface StationSummaryRow {
  id: number
  created_at: string
  order_number: string
  item_code: string
  sequence: number
  station: string
  op_name: string
  basis_text: string
  std_time: number
  total_time_min: number
}

export default function StationSummaryPage() {
  const [data, setData] = useState<StationSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    // 預設抓取最近 1000 筆，可依需求調整 limit
    const { data, error } = await supabase
      .from('station_time_summary')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)
    
    if (error) console.error(error)
    else setData(data || [])
    setLoading(false)
  }

  // 前端篩選邏輯
  const filteredData = data.filter(row => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      row.order_number.toLowerCase().includes(term) ||
      row.item_code.toLowerCase().includes(term) ||
      row.station.toLowerCase().includes(term) || 
      row.op_name.toLowerCase().includes(term)
    )
  })

  // 格式化日期
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString()

  return (
    <div className="p-6 md:p-8 max-w-[1800px] mx-auto text-slate-300 min-h-screen">
      
      {/* 標題與工具列 */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">各站工時總表</h1>
          <p className="text-green-500 mt-1 font-mono text-sm uppercase">
            STATION TIME DATABASE // 已轉換工時明細
          </p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
           {/* 搜尋框 */}
           <div className="relative flex-1 md:w-80">
             <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
               <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
             <input 
               type="text" 
               placeholder="搜尋工單、品號或站點..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg block pl-10 p-2.5 focus:ring-green-500 focus:border-green-500 placeholder-slate-600"
             />
           </div>

           <button 
             onClick={fetchData} 
             className="bg-slate-800 border border-slate-600 px-4 py-2 rounded hover:bg-slate-700 text-white flex items-center gap-2 transition-all"
           >
             <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             重新整理
           </button>
        </div>
      </div>

      {/* 資料表格 */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden shadow-xl flex flex-col h-[75vh]">
        <div className="p-3 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-white flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              工時資料列表
            </h2>
            <div className="text-xs font-mono text-slate-500">
              共 {filteredData.length} 筆資料
            </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 animate-pulse">
             <svg className="w-10 h-10 mb-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             讀取資料庫...
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm border-collapse table-fixed min-w-[1200px]">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono sticky top-0 z-10 shadow-lg text-xs">
                <tr>
                  <th className="p-4 w-24 border-b border-slate-700">轉換日期</th>
                  <th className="p-4 w-40 border-b border-slate-700 text-cyan-400">工單編號</th>
                  <th className="p-4 w-32 border-b border-slate-700 text-purple-300">品項編碼</th>
                  <th className="p-4 w-16 border-b border-slate-700 text-center">序</th>
                  <th className="p-4 w-28 border-b border-slate-700">站點</th>
                  <th className="p-4 w-48 border-b border-slate-700">工序名稱</th>
                  <th className="p-4 w-32 border-b border-slate-700 text-right text-slate-500">計算依據</th>
                  <th className="p-4 w-24 border-b border-slate-700 text-right text-slate-500">標準工時</th>
                  <th className="p-4 w-28 border-b border-slate-700 text-right text-green-400">總工時(分)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/60 transition-colors">
                    <td className="p-4 text-slate-500 font-mono text-xs">{formatDate(row.created_at)}</td>
                    <td className="p-4 font-mono text-cyan-300 font-bold">{row.order_number}</td>
                    <td className="p-4 font-mono text-purple-300">{row.item_code}</td>
                    <td className="p-4 text-center font-mono text-slate-500">{row.sequence}</td>
                    <td className="p-4">
                      {/* 站點顏色標籤 */}
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        row.station.includes('印刷') ? 'bg-blue-900/40 text-blue-300 border border-blue-800' :
                        row.station.includes('雷切') ? 'bg-red-900/40 text-red-300 border border-red-800' :
                        row.station.includes('包裝') ? 'bg-orange-900/40 text-orange-300 border border-orange-800' :
                        'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {row.station}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">{row.op_name}</td>
                    <td className="p-4 text-right font-mono text-slate-500 text-xs">{row.basis_text}</td>
                    <td className="p-4 text-right font-mono text-slate-500">{row.std_time}</td>
                    <td className="p-4 text-right font-mono text-green-400 font-bold text-lg">{row.total_time_min}</td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr><td colSpan={9} className="p-20 text-center text-slate-600">查無資料</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}