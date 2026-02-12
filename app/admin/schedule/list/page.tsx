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
  scheduled_date: string | null
  production_machine_id: number | null
  status: string
  // 🔥 新增：已完成數量
  completed_quantity: number 
  production_machines: {
    name: string
  } | null
}

export default function ScheduleListPage() {
  const [data, setData] = useState<ScheduledItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSection, setFilterSection] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    fetchScheduledData()
  }, [filterSection, showCompleted])

  const fetchScheduledData = async () => {
    setLoading(true)
    let query = supabase
      .from('station_time_summary')
      .select('*, production_machines ( name )')
      .not('assigned_section', 'is', null)
      
    query = query.order('order_number', { ascending: true })
                 .order('id', { ascending: true })

    if (!showCompleted) {
        query = query.eq('status', 'active')
    } else {
        query = query.eq('status', 'completed')
    }

    if (filterSection !== 'all') {
      query = query.eq('assigned_section', filterSection)
    }

    const { data, error } = await query
    if (!error) setData((data as any) || [])
    setLoading(false)
  }

  // 標記完成
  const handleComplete = async (id: number, orderNumber: string) => {
    if (!confirm(`確定工單 [${orderNumber}] 已「製作完成」並移入成品區嗎？`)) return
    const { error } = await supabase.from('station_time_summary').update({ status: 'completed' }).eq('id', id)
    if (error) alert(error.message); else setData(prev => prev.filter(row => row.id !== id))
  }

  // 退回待排
  const handleRevert = async (id: number, orderNumber: string) => {
    if (!confirm(`確定要將工單 [${orderNumber}] 退回「待排表」嗎？`)) return
    const { error } = await supabase.from('station_time_summary').update({ assigned_section: null, scheduled_date: null, production_machine_id: null, status: 'active' }).eq('id', id)
    if (error) alert(error.message); else setData(prev => prev.filter(row => row.id !== id))
  }

  // 刪除案件
  const handleDelete = async (id: number, orderNumber: string) => {
    if (!confirm(`⚠️ 警告：要永久刪除工單 [${orderNumber}] 嗎？`)) return
    if (!confirm(`⚠️ 最後確認：刪除無法復原！`)) return
    const { error } = await supabase.from('station_time_summary').delete().eq('id', id)
    if (error) alert(error.message); else setData(prev => prev.filter(row => row.id !== id))
  }

  const handleUpdate = async (id: number, field: string, value: any) => {
    setData(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    await supabase.from('station_time_summary').update({ [field]: value }).eq('id', id)
  }

  const getStationBadge = (station: string) => {
    const s = station || ''
    if (s.includes('印刷')) return 'text-blue-400 bg-blue-900/20'
    if (s.includes('雷切')) return 'text-red-400 bg-red-900/20'
    if (s.includes('包裝')) return 'text-orange-400 bg-orange-900/20'
    return 'text-slate-400 bg-slate-800'
  }

  const filteredData = data.filter(item => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (item.order_number?.toLowerCase().includes(q)) || (item.customer?.toLowerCase().includes(q)) || (item.item_name?.toLowerCase().includes(q))
  })

  return (
    <div className="p-6 md:p-8 max-w-[1800px] mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{showCompleted ? '歷史完成記錄' : '生產排程總表'}</h1>
          <p className="text-blue-400 mt-1 font-mono text-sm uppercase">{showCompleted ? 'COMPLETED ARCHIVE // 已結束工序' : 'SCHEDULED LIST // 進行中工序'}</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button onClick={() => setShowCompleted(false)} className={`px-4 py-1.5 rounded text-xs transition-all ${!showCompleted ? 'bg-cyan-600 text-white font-bold' : 'text-slate-500 hover:text-slate-300'}`}>生產中</button>
                <button onClick={() => setShowCompleted(true)} className={`px-4 py-1.5 rounded text-xs transition-all ${showCompleted ? 'bg-emerald-600 text-white font-bold' : 'text-slate-500 hover:text-slate-300'}`}>已完成</button>
            </div>
            <div className="relative group"><input type="text" placeholder="搜尋單號 / 客戶 / 品名..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-4 pr-4 py-1.5 bg-black/30 border border-slate-700 rounded text-sm text-slate-200 focus:border-cyan-500 outline-none w-64"/></div>
            <div className="flex gap-2 flex-wrap justify-end">
                <button onClick={() => setFilterSection('all')} className={`px-3 py-1.5 rounded text-xs border ${filterSection === 'all' ? 'bg-white text-black font-bold' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>全部課別</button>
                {PRODUCTION_SECTIONS.map(s => (<button key={s.id} onClick={() => setFilterSection(s.id)} className={`px-3 py-1.5 rounded text-xs border transition-all ${filterSection === s.id ? `${s.color} text-white font-bold` : 'bg-slate-900 text-slate-400 border-slate-700'}`}>{s.name}</button>))}
            </div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden min-h-[600px] flex flex-col shadow-xl">
        <div className="flex-1 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-400 border-collapse">
            <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono sticky top-0 z-10 shadow-lg">
              <tr>
                <th className="px-4 py-3 w-32 text-center border-b border-slate-700">操作工具</th>
                <th className="px-4 py-3 w-48 border-b border-slate-700">工單資訊 (Order)</th>
                <th className="px-4 py-3 w-28 text-center border-b border-slate-700">分配區塊</th>
                <th className="px-4 py-3 w-32 text-center border-b border-slate-700">排程狀態</th>
                <th className="px-4 py-3 min-w-[200px] border-b border-slate-700">品項與工序內容</th>
                <th className="px-4 py-3 w-32 text-right border-b border-slate-700 font-bold">數量/進度</th>
                <th className="px-4 py-3 w-24 text-right border-b border-slate-700 text-emerald-400">總時</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={7} className="p-20 text-center text-slate-500 italic">資料讀取中...</td></tr>
              ) : filteredData.map((row, index) => {
                const section = PRODUCTION_SECTIONS.find(s => s.id === row.assigned_section)
                const isNewOrder = index === 0 || row.order_number !== filteredData[index - 1].order_number
                // 計算完成百分比
                const progress = row.quantity > 0 ? Math.min(100, Math.round((row.completed_quantity / row.quantity) * 100)) : 0;

                return (
                  <tr key={row.id} className={`hover:bg-slate-800/60 transition-colors group ${isNewOrder && index !== 0 ? 'border-t-4 border-slate-950' : ''}`}>
                    <td className="px-2 py-3 text-center align-middle bg-slate-900/30">
                      <div className="flex justify-center gap-2">
                        {!showCompleted && (
                            <button onClick={() => handleComplete(row.id, row.order_number)} className="text-emerald-500 hover:bg-emerald-900/30 p-1.5 rounded-lg border border-emerald-900/50" title="標記完成">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </button>
                        )}
                        <button onClick={() => handleRevert(row.id, row.order_number)} className="text-yellow-500 hover:bg-yellow-900/30 p-1.5 rounded-lg border border-yellow-900/50" title="退回待排">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        </button>
                        <button onClick={() => handleDelete(row.id, row.order_number)} className="text-red-500 hover:bg-red-900/30 p-1.5 rounded-lg border border-red-900/50" title="永久刪除">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top border-r border-slate-800/30 bg-slate-900/10">
                      {isNewOrder ? (
                          <>
                            <div className="font-mono text-cyan-400 font-black text-lg">{row.order_number}</div>
                            <div className="text-[10px] text-slate-500 font-bold">{row.doc_type}</div>
                            <div className="mt-2 text-xs text-white">📅 交期: {row.delivery_date}</div>
                            <div className="text-xs text-slate-400">🏢 {row.customer}</div>
                          </>
                      ) : <div className="text-[10px] text-slate-700 italic px-2">↳ 續前單...</div>}
                    </td>
                    <td className="px-4 py-3 text-center align-middle border-r border-slate-800/30">
                      {section && <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${section.color.replace('bg-', 'text-')} border-current`}>{section.name}</span>}
                    </td>
                    <td className="px-4 py-3 text-center align-middle border-r border-slate-800/30">
                        {row.production_machines?.name ? (
                            <div className="flex flex-col items-center">
                                <span className="text-cyan-400 font-bold text-xs">{row.production_machines.name}</span>
                                <span className="text-[10px] text-yellow-500 font-mono">{row.scheduled_date}</span>
                            </div>
                        ) : <span className="text-slate-600 italic text-[10px]">未排機台</span>}
                    </td>
                    <td className="px-4 py-3 align-top border-r border-slate-800/30">
                      <div className="font-mono text-purple-300 text-xs">{row.item_code}</div>
                      <div className="text-slate-200 font-bold text-sm my-1">{row.item_name}</div>
                      <div className="flex gap-2 text-[10px] text-slate-500 font-bold">
                        <span className="bg-slate-800 px-1 rounded">工序: {row.op_name}</span>
                        <span className={getStationBadge(row.station) + " px-1 rounded"}>{row.station}</span>
                      </div>
                    </td>
                    {/* 🔥 6. 數量與進度 */}
                    <td className="px-4 py-3 align-top text-right border-r border-slate-800/30">
                      <div className="font-mono text-white text-lg font-bold">{row.quantity}</div>
                      {/* 如果有部分完成，顯示進度條 */}
                      {row.completed_quantity > 0 && (
                          <div className="mt-1">
                              <div className="text-[10px] text-cyan-400 font-mono mb-0.5">
                                  完成: {row.completed_quantity} ({progress}%)
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-cyan-500 h-full" style={{ width: `${progress}%` }}></div>
                              </div>
                          </div>
                      )}
                      <div className="text-slate-500 text-[10px] mt-1">盤: {row.plate_count || '-'}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-right bg-slate-900/20">
                      <div className="font-mono text-lg font-bold text-emerald-400">{row.total_time_min}</div>
                      <div className="text-[9px] text-emerald-700 font-bold uppercase">mins</div>
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