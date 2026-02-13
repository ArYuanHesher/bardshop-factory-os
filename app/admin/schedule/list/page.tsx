'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'
import { PRODUCTION_SECTIONS } from '../../../../config/productionSections'
import OrderEditModal from '../../../../components/OrderEditModal'

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
  status: string // 'active' | 'completed'
  completed_quantity: number
  production_machines: {
    name: string
  } | null
}

// 群組結構介面
interface OrderGroup {
  order_number: string
  customer: string
  item_name: string
  item_code: string
  delivery_date: string
  doc_type: string
  quantity: number
  plate_count: string
  designer: string
  handler: string
  issuer: string
  items: ScheduledItem[]
}

export default function ScheduleListPage() {
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSection, setFilterSection] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // 編輯視窗狀態
  const [editingOrder, setEditingOrder] = useState<string | null>(null)

  useEffect(() => {
    fetchScheduledData()
  }, [filterSection])

  const fetchScheduledData = async () => {
    setLoading(true)
    
    let query = supabase
      .from('station_time_summary')
      .select('*, production_machines ( name )')
      .not('assigned_section', 'is', null)
      .order('id', { ascending: true }) // 確保工序順序正確 (ID 小 -> 大)

    if (filterSection !== 'all') {
      query = query.eq('assigned_section', filterSection)
    }

    const { data, error } = await query
    
    if (error) {
        console.error(error)
    } else {
        const rawData = (data as any) || []
        groupDataByOrder(rawData)
    }
    setLoading(false)
  }

  // 將平鋪資料轉為以工單為單位的群組
  const groupDataByOrder = (data: ScheduledItem[]) => {
    const groups: Record<string, OrderGroup> = {}
    
    data.forEach(item => {
        // 🔥 強制轉型為數字，避免資料庫回傳字串導致顯示錯誤
        const currentQty = Number(item.quantity) || 0
        const currentPlateCount = item.plate_count || '0'

        if (!groups[item.order_number]) {
            // 初始化群組
            groups[item.order_number] = {
                order_number: item.order_number,
                customer: item.customer,
                item_name: item.item_name,
                item_code: item.item_code,
                delivery_date: item.delivery_date,
                doc_type: item.doc_type,
                quantity: currentQty, 
                plate_count: currentPlateCount,
                designer: item.designer,
                handler: item.handler,
                issuer: item.issuer,
                items: []
            }
        } else {
            // 🔥 關鍵修正：依照指示「抓最後一筆」
            // 因為資料來源已按 ID 排序 (舊->新)，我們在迴圈中不斷更新 quantity，
            // 最後留下的就會是該工單「最後一筆資料」的 quantity。
            groups[item.order_number].quantity = currentQty
            groups[item.order_number].plate_count = currentPlateCount
        }
        groups[item.order_number].items.push(item)
    })

    // 轉回陣列
    setOrderGroups(Object.values(groups))
  }

  // 搜尋過濾邏輯
  const filteredGroups = orderGroups.filter(g => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (
      g.order_number?.toLowerCase().includes(q) ||
      g.customer?.toLowerCase().includes(q) ||
      g.item_name?.toLowerCase().includes(q) ||
      g.item_code?.toLowerCase().includes(q)
    )
  })

  // 計算群組總進度 (所有工序完成比例)
  // 若需要以「數量」計算總進度，可在此修改邏輯
  const calculateTotalProgress = (items: ScheduledItem[]) => {
    if (items.length === 0) return 0
    const totalItems = items.length
    const completedItems = items.filter(i => i.status === 'completed' || (i.quantity > 0 && i.completed_quantity >= i.quantity)).length
    return Math.round((completedItems / totalItems) * 100)
  }

  return (
    <div className="p-4 md:p-6 max-w-[1920px] mx-auto min-h-screen">
      {/* 編輯視窗 */}
      <OrderEditModal 
        orderNumber={editingOrder || ''} 
        isOpen={!!editingOrder} 
        onClose={() => setEditingOrder(null)} 
        onSaveSuccess={fetchScheduledData}
      />

      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">排程總表 (管理模式)</h1>
          <p className="text-blue-400 mt-1 font-mono text-sm uppercase flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            MASTER SCHEDULE // 工單結構化檢視與編輯
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-end w-full md:w-auto">
            <div className="relative group w-full md:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input 
                    type="text" 
                    placeholder="🔍 搜尋單號 / 客戶 / 品名..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none w-full md:w-80 shadow-inner"
                />
            </div>

            <div className="flex gap-1.5 flex-wrap justify-end">
                <button 
                    onClick={() => setFilterSection('all')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${filterSection === 'all' ? 'bg-white text-slate-900 border-white shadow-lg' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:bg-slate-700'}`}
                >
                    全部顯示
                </button>
                {PRODUCTION_SECTIONS.map(s => (
                    <button
                    key={s.id}
                    onClick={() => setFilterSection(s.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${filterSection === s.id ? `${s.color} text-white border-transparent shadow-[0_0_15px_rgba(var(--tw-shadow-color),0.4)] transform scale-105` : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:bg-slate-700'}`}
                    >
                    {s.name}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <div className="space-y-6">
        {loading ? (
            <div className="text-center py-32 text-slate-500 animate-pulse text-lg">載入資料中...</div>
        ) : filteredGroups.length === 0 ? (
            <div className="text-center py-32 text-slate-600 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">
                <p className="text-xl font-bold mb-2">無符合資料</p>
                <p className="text-sm">請嘗試調整搜尋關鍵字或篩選條件</p>
            </div>
        ) : (
            filteredGroups.map(group => {
                // 檢查是否有盤數資料且不為0 (過濾掉 "0", "0.0", null, undefined)
                const hasPlateCount = group.plate_count && parseFloat(group.plate_count) > 0
                
                return (
                    <div key={group.order_number} className="bg-[#0f172a] border border-slate-700/60 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-slate-600 transition-all duration-300 relative group">
                        
                        {/* 工單 Header (資訊區) */}
                        <div className="bg-slate-900/80 px-5 py-4 border-b border-slate-800 grid grid-cols-1 lg:grid-cols-[2fr_1.5fr_1fr_auto] gap-6 items-center backdrop-blur-sm">
                            
                            {/* 1. 基本識別與數量資訊 */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-xl font-black text-cyan-400 font-mono tracking-wide">{group.order_number}</span>
                                    
                                    {/* 單據種類 */}
                                    <span className={`text-sm px-3 py-1 rounded border font-bold uppercase tracking-wider ${group.doc_type?.includes('急') ? 'bg-red-900/40 text-red-400 border-red-800' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                                        {group.doc_type || '一般'}
                                    </span>

                                    {/* 🔥 總數量 (顯示抓取到的最大數量) */}
                                    <span className="text-slate-400 text-sm font-bold ml-2">
                                        總數量: <span className="text-white font-mono text-base">{group.quantity}</span> 個
                                    </span>

                                    {/* 總盤數 (若有才顯示) */}
                                    {hasPlateCount && (
                                        <>
                                            <span className="text-slate-700">|</span>
                                            <span className="text-slate-400 text-sm font-bold">
                                                總盤數: <span className="text-yellow-400 font-mono text-base">{group.plate_count}</span> 盤
                                            </span>
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700">{group.customer}</span>
                                    <span className="font-mono text-slate-500">{group.item_code}</span>
                                </div>
                            </div>

                            {/* 2. 品名與人員 */}
                            <div className="flex flex-col gap-1.5 border-l border-slate-800 pl-6">
                                <div className="text-base font-bold text-white leading-tight">{group.item_name}</div>
                                <div className="flex gap-4 text-xs text-slate-500 font-mono">
                                    <span title="美編">🎨 {group.designer || '-'}</span>
                                    <span title="承辦">👤 {group.handler || '-'}</span>
                                    <span title="開單">📝 {group.issuer || '-'}</span>
                                </div>
                            </div>

                            {/* 3. 交付日期 (純日期) */}
                            <div className="flex flex-col items-center justify-center border-l border-slate-800 pl-6 h-full">
                                <span className="text-slate-500 text-xs mb-1">預計交付</span>
                                <span className="text-yellow-400 font-mono font-bold text-xl tracking-wide">{group.delivery_date}</span>
                            </div>

                            {/* 4. 操作按鈕 */}
                            <div className="pl-4">
                                <button 
                                    onClick={() => setEditingOrder(group.order_number)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-900/20 hover:shadow-indigo-900/40 transition-all flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    編輯結構
                                </button>
                            </div>
                        </div>

                        {/* 工序列表 Table */}
                        <div className="overflow-x-auto bg-[#0b1221]">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="bg-slate-950/50 text-[10px] uppercase text-slate-500 font-mono border-b border-slate-800">
                                    <tr>
                                        <th className="px-5 py-3 w-14 text-center">序</th>
                                        <th className="px-4 py-3 min-w-[200px]">工序名稱</th>
                                        <th className="px-4 py-3 min-w-[120px]">負責區塊</th>
                                        <th className="px-4 py-3 min-w-[250px]">機台排程</th>
                                        <th className="px-4 py-3 min-w-[150px]">執行進度 (數量)</th>
                                        <th className="px-4 py-3 w-24 text-right">工時</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/30">
                                    {group.items.map((item, idx) => {
                                        const isCompleted = item.status === 'completed'
                                        const itemPct = item.quantity > 0 ? Math.round((item.completed_quantity / item.quantity) * 100) : 0
                                        const displayPct = Math.min(itemPct, 100)
                                        
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                                                <td className="px-5 py-4 text-center text-slate-600 font-mono text-xs">{idx + 1}</td>
                                                
                                                <td className="px-4 py-4">
                                                    <span className="font-bold text-slate-200 text-base whitespace-nowrap">{item.op_name}</span>
                                                </td>
                                                
                                                <td className="px-4 py-4">
                                                    <span className={`text-xs px-3 py-1 rounded border font-bold ${PRODUCTION_SECTIONS.find(s=>s.id===item.assigned_section)?.color.replace('bg-','text-')} border-slate-700 bg-slate-900 whitespace-nowrap`}>
                                                        {PRODUCTION_SECTIONS.find(s=>s.id===item.assigned_section)?.name || item.assigned_section}
                                                    </span>
                                                </td>
                                                
                                                {/* 🔥 修正：機台排程順序改為 [日期] + [機台] */}
                                                <td className="px-4 py-4">
                                                    {item.production_machines ? (
                                                        <div className="flex flex-row items-center gap-3">
                                                            {/* 日期在前 */}
                                                            <span className="text-sm font-bold text-yellow-400 font-mono whitespace-nowrap">
                                                                {item.scheduled_date}
                                                            </span>
                                                            {/* 機台在後 */}
                                                            <span className="text-cyan-400 text-sm font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-900 whitespace-nowrap">
                                                                {item.production_machines.name}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600 text-xs italic px-2 py-0.5 border border-dashed border-slate-700 rounded">待排程</span>
                                                    )}
                                                </td>
                                                
                                                {/* 進度顯示條 */}
                                                <td className="px-4 py-4 align-middle">
                                                    <div className="flex items-center gap-3 w-full">
                                                        <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : item.completed_quantity > 0 ? 'bg-blue-500' : 'bg-slate-600'}`} 
                                                                style={{ width: `${displayPct}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="text-right min-w-[80px]">
                                                            <span className={`text-xs font-mono font-bold ${isCompleted ? 'text-emerald-400' : item.completed_quantity > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                                                                {item.completed_quantity} / {item.quantity}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                
                                                <td className="px-4 py-4 text-right font-mono text-emerald-500 font-bold text-base">
                                                    {item.total_time_min}
                                                    <span className="text-[10px] text-emerald-800 ml-1">m</span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            })
        )}
      </div>
    </div>
  )
}