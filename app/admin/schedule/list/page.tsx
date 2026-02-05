'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'
import { PRODUCTION_SECTIONS } from '../../../../config/productionSections'

export default function ScheduleListPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSection, setFilterSection] = useState<string>('all')

  useEffect(() => {
    fetchScheduledData()
  }, [filterSection])

  const fetchScheduledData = async () => {
    setLoading(true)
    let query = supabase
      .from('station_time_summary')
      .select('*')
      .not('assigned_section', 'is', null) // 只抓已分配的
      .order('created_at', { ascending: false })

    if (filterSection !== 'all') {
      query = query.eq('assigned_section', filterSection)
    }

    const { data, error } = await query
    
    if (error) console.error(error)
    else setData(data || [])
    setLoading(false)
  }

  // 退回待排 (刪除排程)
  const handleRevert = async (id: number, orderNumber: string) => {
    if (!confirm(`確定要將工單 [${orderNumber}] 退回「待排表」嗎？`)) return

    const { error } = await supabase
      .from('station_time_summary')
      .update({ assigned_section: null }) // 設為 NULL 即退回
      .eq('id', id)

    if (error) alert(error.message)
    else {
      setData(prev => prev.filter(row => row.id !== id))
    }
  }

  // 編輯功能 (簡易版：只示範改數量，可自行擴充)
  const handleUpdate = async (id: number, field: string, value: any) => {
    setData(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    await supabase.from('station_time_summary').update({ [field]: value }).eq('id', id)
  }

  return (
    <div className="p-6 md:p-8 max-w-[1800px] mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">排程總表</h1>
          <p className="text-blue-400 mt-1 font-mono text-sm uppercase">
            SCHEDULED LIST // 已分配生產區塊的訂單
          </p>
        </div>

        {/* 篩選器 */}
        <div className="flex gap-2">
          <button 
            onClick={() => setFilterSection('all')}
            className={`px-3 py-1.5 rounded text-xs border ${filterSection === 'all' ? 'bg-white text-black border-white' : 'bg-slate-900 text-slate-400 border-slate-700'}`}
          >
            全部
          </button>
          {PRODUCTION_SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setFilterSection(s.id)}
              className={`px-3 py-1.5 rounded text-xs border transition-colors ${filterSection === s.id ? `${s.color} text-white border-transparent` : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden min-h-[600px] flex flex-col shadow-xl">
        <div className="flex-1 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono sticky top-0 z-10 shadow-lg">
              <tr>
                <th className="px-4 py-3 w-10 text-center">退回</th>
                <th className="px-4 py-3 w-32">工單編號</th>
                <th className="px-4 py-3 w-24">區塊</th>
                <th className="px-4 py-3 w-32">品項編碼</th>
                <th className="px-4 py-3">品名</th>
                <th className="px-4 py-3 w-20 text-right">數量</th>
                <th className="px-4 py-3 w-24">工序</th>
                <th className="px-4 py-3 w-24 text-right">總時(分)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={8} className="p-20 text-center text-slate-500">載入中...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={8} className="p-20 text-center text-slate-600">無符合條件的已排程資料</td></tr>
              ) : data.map((row) => {
                const section = PRODUCTION_SECTIONS.find(s => s.id === row.assigned_section)
                return (
                  <tr key={row.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleRevert(row.id, row.order_number)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="退回待排表">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-400 font-bold">{row.order_number}</td>
                    <td className="px-4 py-3">
                      {section ? (
                        <span className={`px-2 py-1 rounded text-[10px] font-bold border ${section.color.replace('bg-', 'text-')} border-current bg-transparent`}>
                          {section.name}
                        </span>
                      ) : row.assigned_section}
                    </td>
                    <td className="px-4 py-3 font-mono text-purple-300">{row.item_code}</td>
                    <td className="px-4 py-3 text-slate-300">
                        <input 
                          type="text" 
                          value={row.item_name || ''} 
                          onChange={(e) => handleUpdate(row.id, 'item_name', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-cyan-500 outline-none w-full"
                        />
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">{row.quantity}</td>
                    <td className="px-4 py-3 text-slate-400">{row.op_name}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">{row.total_time_min}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}