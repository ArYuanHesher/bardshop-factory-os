'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'
import { PRODUCTION_SECTIONS } from '../../../../config/productionSections'

interface ScheduledItem {
  id: number
  order_number: string
  doc_type: string
  item_code: string
  item_name: string
  quantity: number
  plate_count: string
  delivery_date: string
  designer: string
  customer: string
  handler: string
  issuer: string
  op_name: string
  station: string
  total_time_min: number
  assigned_section: string
  created_at: string
}

export default function ScheduleListPage() {
  const [data, setData] = useState<ScheduledItem[]>([])
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

  // 退回待排
  const handleRevert = async (id: number, orderNumber: string) => {
    if (!confirm(`確定要將工單 [${orderNumber}] 退回「待排表」嗎？`)) return

    const { error } = await supabase
      .from('station_time_summary')
      .update({ assigned_section: null })
      .eq('id', id)

    if (error) alert(error.message)
    else {
      setData(prev => prev.filter(row => row.id !== id))
    }
  }

  // 簡單編輯功能 (如修改品名)
  const handleUpdate = async (id: number, field: string, value: any) => {
    setData(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    await supabase.from('station_time_summary').update({ [field]: value }).eq('id', id)
  }

  const getStationBadge = (station: string) => {
    const s = station || ''
    if (s.includes('印刷')) return 'text-blue-400 bg-blue-900/20'
    if (s.includes('雷切')) return 'text-red-400 bg-red-900/20'
    if (s.includes('包裝')) return 'text-orange-400 bg-orange-900/20'
    if (s.includes('後加工')) return 'text-purple-400 bg-purple-900/20'
    return 'text-slate-400 bg-slate-800'
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
        <div className="flex gap-2 flex-wrap justify-end">
          <button 
            onClick={() => setFilterSection('all')}
            className={`px-3 py-1.5 rounded text-xs border transition-all ${filterSection === 'all' ? 'bg-white text-black border-white font-bold' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'}`}
          >
            全部顯示
          </button>
          {PRODUCTION_SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setFilterSection(s.id)}
              className={`px-3 py-1.5 rounded text-xs border transition-all ${filterSection === s.id ? `${s.color} text-white border-transparent font-bold shadow-[0_0_15px_rgba(var(--tw-shadow-color),0.4)]` : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden min-h-[600px] flex flex-col shadow-xl">
        <div className="flex-1 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-400 border-collapse">
            <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono sticky top-0 z-10 shadow-lg">
              <tr>
                <th className="px-4 py-3 w-10 text-center border-b border-slate-700">退回</th>
                <th className="px-4 py-3 w-48 border-b border-slate-700">工單資訊</th>
                <th className="px-4 py-3 w-28 text-center border-b border-slate-700">分配區塊</th>
                <th className="px-4 py-3 min-w-[200px] border-b border-slate-700">品項資訊</th>
                <th className="px-4 py-3 w-24 text-right border-b border-slate-700">數量/盤數</th>
                <th className="px-4 py-3 w-40 border-b border-slate-700">工序與站點</th>
                <th className="px-4 py-3 w-24 text-right border-b border-slate-700 text-emerald-400">預計總時</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={7} className="p-20 text-center text-slate-500">載入中...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={7} className="p-20 text-center text-slate-600">無符合條件的已排程資料</td></tr>
              ) : data.map((row) => {
                const section = PRODUCTION_SECTIONS.find(s => s.id === row.assigned_section)
                return (
                  <tr key={row.id} className="hover:bg-slate-800/60 transition-colors group">
                    {/* 1. 退回按鈕 */}
                    <td className="px-4 py-3 text-center align-middle">
                      <button onClick={() => handleRevert(row.id, row.order_number)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="退回待排表">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>

                    {/* 2. 工單資訊 */}
                    <td className="px-4 py-3 align-top border-r border-slate-800/30">
                      <div className="flex justify-between items-start">
                        <div className="font-mono text-cyan-400 font-bold text-base">{row.order_number}</div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{row.doc_type}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="text-slate-600 font-mono">交付:</span>
                          <span className="text-white">{row.delivery_date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="text-slate-600 font-mono">客戶:</span>
                          <span className="truncate max-w-[120px]" title={row.customer}>{row.customer}</span>
                        </div>
                      </div>
                    </td>

                    {/* 3. 分配區塊 (視覺強化) */}
                    <td className="px-4 py-3 text-center align-middle border-r border-slate-800/30">
                      {section ? (
                        <div className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded border ${section.color.replace('bg-', 'text-')} border-current bg-transparent shadow-[0_0_10px_rgba(0,0,0,0.2)]`}>
                          <span className="text-xs font-black">{section.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">Unknown</span>
                      )}
                    </td>

                    {/* 4. 品項資訊 */}
                    <td className="px-4 py-3 align-top border-r border-slate-800/30">
                      <div className="font-mono text-purple-300 text-sm mb-1">{row.item_code}</div>
                      <div className="mb-2">
                        <input 
                          type="text" 
                          value={row.item_name || ''} 
                          onChange={(e) => handleUpdate(row.id, 'item_name', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-cyan-500 outline-none w-full text-slate-300 text-sm break-words"
                        />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono mt-auto">
                        <span>美: {row.designer}</span>
                        <span>承: {row.handler}</span>
                        <span>開: {row.issuer}</span>
                      </div>
                    </td>

                    {/* 5. 數量/盤數 */}
                    <td className="px-4 py-3 align-top text-right border-r border-slate-800/30">
                      <div className="font-mono text-white text-lg font-bold">{row.quantity}</div>
                      <div className="text-slate-500 text-xs mt-1">盤: {row.plate_count || '-'}</div>
                    </td>

                    {/* 6. 工序與站點 */}
                    <td className="px-4 py-3 align-top border-r border-slate-800/30">
                      <div className="text-slate-300 font-bold mb-1">{row.op_name}</div>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${getStationBadge(row.station)}`}>
                        {row.station}
                      </span>
                    </td>

                    {/* 7. 預計總時 */}
                    <td className="px-4 py-3 align-top text-right">
                      <span className="font-mono text-xl font-bold text-emerald-400">{row.total_time_min}</span>
                      <span className="text-xs text-emerald-600 block mt-1">mins</span>
                    </td>
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