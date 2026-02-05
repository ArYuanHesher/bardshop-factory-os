'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'

interface ScheduleItem {
  id: number
  source_order_id: number 
  order_number: string
  item_code: string
  item_name: string
  quantity: number
  plate_count: string
  delivery_date: string // 新增
  designer: string      // 新增
  customer: string      // 新增
  handler: string       // 新增
  issuer: string        // 新增
  op_name: string
  station: string
  std_time: number
  total_time_min: number
  created_at: string
}

// 用來顯示分組資料的結構
interface GroupedOrder {
  source_order_id: number
  order_number: string
  item_code: string
  item_name: string
  // 將共用資訊拉到 Group 層級方便顯示
  delivery_date: string
  designer: string
  customer: string
  handler: string
  issuer: string
  items: ScheduleItem[]
}

export default function MasterSchedulePage() {
  const [groupedData, setGroupedData] = useState<GroupedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 100 

  useEffect(() => {
    fetchData()
  }, [page, searchTerm])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setPage(0) 
  }

  // --- 1. 讀取與分組邏輯 ---
  const fetchData = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('station_time_summary')
        .select('*', { count: 'exact' })
        // 🔥 重要：一定要先照 source_order_id 排序，才能確保分組在一起
        .order('created_at', { ascending: false }) 
        .order('source_order_id', { ascending: true })
        .order('id', { ascending: true })

      if (searchTerm) {
        query = query.or(`order_number.ilike.%${searchTerm}%,item_code.ilike.%${searchTerm}%,item_name.ilike.%${searchTerm}%,station.ilike.%${searchTerm}%,customer.ilike.%${searchTerm}%`)
      }

      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      query = query.range(from, to)

      const { data: rawData, count, error } = await query

      if (error) throw error

      // --- 前端資料分組 (Grouping) ---
      const groups: GroupedOrder[] = []
      const map = new Map<number, GroupedOrder>()

      rawData?.forEach((row: ScheduleItem) => {
        if (!map.has(row.source_order_id)) {
          const newGroup = {
            source_order_id: row.source_order_id,
            order_number: row.order_number,
            item_code: row.item_code,
            item_name: row.item_name,
            delivery_date: row.delivery_date, // 綁定第一筆資料的共用欄位
            designer: row.designer,
            customer: row.customer,
            handler: row.handler,
            issuer: row.issuer,
            items: []
          }
          map.set(row.source_order_id, newGroup)
          groups.push(newGroup)
        }
        map.get(row.source_order_id)?.items.push(row)
      })

      setGroupedData(groups)
      setTotalCount(count || 0)

    } catch (err: any) {
      console.error(err)
      alert('讀取失敗: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- 2. 刪除與回溯邏輯 ---
  const handleGroupDelete = async (sourceOrderId: number, orderNumber: string) => {
    if (!confirm(`⚠️ 警告：這將會刪除工單 [${orderNumber}] 的所有工序資料！\n\n並且該工單會回到「待處理清單」中。\n\n確定要執行嗎？`)) return
    
    setGroupedData(prev => prev.filter(g => g.source_order_id !== sourceOrderId))

    try {
      const { error: updateError } = await supabase
        .from('daily_orders')
        .update({ is_converted: false }) 
        .eq('id', sourceOrderId)
      
      if (updateError) throw updateError

      const { error: deleteError } = await supabase
        .from('station_time_summary')
        .delete()
        .eq('source_order_id', sourceOrderId)

      if (deleteError) throw deleteError

    } catch (err: any) {
      console.error(err)
      alert('操作失敗: ' + err.message)
      fetchData() 
    }
  }

  // --- 3. 編輯邏輯 ---
  const handleUpdate = async (id: number, field: keyof ScheduleItem, value: any) => {
    setGroupedData(prev => prev.map(group => ({
      ...group,
      items: group.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    })))

    const { error } = await supabase
      .from('station_time_summary')
      .update({ [field]: value })
      .eq('id', id)

    if (error) console.error('Update Failed', error)
  }

  const EditableCell = ({ value, onChange, type = "text", className = "" }: any) => (
    <input 
      type={type}
      value={value === null || value === undefined ? '' : value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent border-b border-transparent hover:border-slate-600 focus:border-cyan-500 focus:bg-slate-800 outline-none w-full transition-colors ${className}`}
    />
  )

  const getStationBadge = (station: string) => {
    const s = station || ''
    if (s.includes('印刷')) return 'text-blue-400'
    if (s.includes('雷切')) return 'text-red-400'
    if (s.includes('包裝')) return 'text-orange-400'
    if (s.includes('後加工')) return 'text-purple-400'
    return 'text-slate-400'
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="p-6 md:p-8 max-w-[1800px] mx-auto min-h-screen">
      
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">各站工時查詢表</h1>
          <p className="text-purple-400 mt-1 font-mono text-sm uppercase">
            MASTER SCHEDULE // 已分組顯示 (刪除時將自動退回轉換區)
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <input 
            type="text" 
            placeholder="搜尋工單、品項、站點、客戶..." 
            value={searchTerm}
            onChange={handleSearch}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg block pl-4 p-2.5 focus:border-purple-500 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden min-h-[600px] flex flex-col shadow-xl">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 animate-pulse">
            <svg className="w-10 h-10 mb-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            資料讀取與分組中...
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm text-slate-400 border-collapse">
                <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono sticky top-0 z-20 shadow-lg">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center">Action</th>
                    <th className="px-4 py-3 w-48">工單資訊</th>
                    <th className="px-4 py-3 min-w-[200px]">品項資訊 (雙層)</th>
                    <th className="px-4 py-3 w-24 text-right">數量/盤數</th>
                    <th className="px-4 py-3 w-32">歸屬站點</th>
                    <th className="px-4 py-3">工序名稱</th>
                    <th className="px-4 py-3 text-right w-24">標準工時</th>
                    <th className="px-4 py-3 text-right w-28 text-emerald-400">預計總時</th>
                  </tr>
                </thead>
                
                {/* 🔥 分組顯示 */}
                {groupedData.length === 0 ? (
                   <tbody><tr><td colSpan={10} className="p-20 text-center text-slate-600">無資料</td></tr></tbody>
                ) : groupedData.map((group, gIndex) => (
                  <tbody key={group.source_order_id} className={`border-b border-slate-700/50 ${gIndex % 2 === 0 ? 'bg-slate-900/20' : 'bg-transparent'} hover:bg-slate-800/30 transition-colors`}>
                    {group.items.map((row, index) => {
                      const isFirst = index === 0
                      const rowSpan = group.items.length

                      return (
                        <tr key={row.id} className="group/row">
                          {/* 只有第一列顯示刪除按鈕 */}
                          {isFirst && (
                            <td rowSpan={rowSpan} className="px-4 py-3 text-center align-top pt-4 border-r border-slate-800/50">
                              <button 
                                onClick={() => handleGroupDelete(group.source_order_id, group.order_number)} 
                                className="text-slate-600 hover:text-red-400 p-2 rounded hover:bg-red-900/20 transition-all tooltip-trigger"
                                title="刪除整張工單並退回"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          )}

                          {/* 只有第一列顯示共用資訊 (雙層排版) */}
                          {isFirst && (
                            <>
                              <td rowSpan={rowSpan} className="px-4 py-3 align-top pt-4 border-r border-slate-800/30">
                                <div className="font-mono text-cyan-400 font-bold text-base">{group.order_number}</div>
                                <div className="text-slate-500 text-xs mt-1">{group.delivery_date}</div>
                                <div className="text-slate-400 text-xs mt-1 truncate max-w-[150px]">{group.customer}</div>
                              </td>
                              
                              <td rowSpan={rowSpan} className="px-4 py-3 align-top pt-4 border-r border-slate-800/30">
                                <div className="font-mono text-purple-300 text-sm mb-1">{group.item_code}</div>
                                <div className="text-slate-300 text-sm mb-2 break-words max-w-[300px]">
                                  <EditableCell 
                                    value={row.item_name} 
                                    onChange={(val: string) => handleUpdate(row.id, 'item_name', val)}
                                  />
                                </div>
                                <div className="flex gap-2 text-[10px] text-slate-500 font-mono">
                                  <span>美: {group.designer}</span>
                                  <span>承: {group.handler}</span>
                                  <span>開: {group.issuer}</span>
                                </div>
                              </td>

                              <td rowSpan={rowSpan} className="px-4 py-3 text-right align-top pt-4 border-r border-slate-800/30">
                                <div className="font-mono text-white text-lg font-bold">{row.quantity}</div>
                                <div className="text-slate-500 text-xs mt-1">盤: {row.plate_count || '-'}</div>
                              </td>
                            </>
                          )}

                          {/* 這些是每行都不同的工序資料 */}
                          <td className="px-4 py-3">
                            <EditableCell 
                              value={row.station} 
                              onChange={(val: string) => handleUpdate(row.id, 'station', val)}
                              className={`font-bold text-xs ${getStationBadge(row.station)}`}
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            <EditableCell 
                              value={row.op_name} 
                              onChange={(val: string) => handleUpdate(row.id, 'op_name', val)}
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">
                            <EditableCell 
                              type="number"
                              value={row.std_time} 
                              onChange={(val: string) => handleUpdate(row.id, 'std_time', Number(val))}
                              className="text-right"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-lg font-bold text-emerald-400">
                            <EditableCell 
                              type="number"
                              value={row.total_time_min} 
                              onChange={(val: string) => handleUpdate(row.id, 'total_time_min', Number(val))}
                              className="text-right text-emerald-400 font-bold"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                ))}
              </table>
            </div>

            {/* 分頁控制器 */}
            <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-xs text-slate-500 font-mono">
                顯示 {groupedData.length > 0 ? page * PAGE_SIZE + 1 : 0} - {Math.min((page + 1) * PAGE_SIZE, totalCount)} 筆，共 {totalCount} 筆 (Row Count)
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  上一頁
                </button>
                <span className="text-xs font-mono text-slate-400 px-2">
                   Page {page + 1} / {totalPages || 1}
                </span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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