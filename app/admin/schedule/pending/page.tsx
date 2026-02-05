'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../../lib/supabaseClient'
import { PRODUCTION_SECTIONS } from '../../../../config/productionSections'

// 資料介面
interface PendingItem {
  id: number
  source_order_id: number
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
  created_at: string
}

// 分組介面
interface GroupedPendingOrder {
  source_order_id: number
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
  items: PendingItem[]
}

export default function SchedulePendingPage() {
  const [groupedData, setGroupedData] = useState<GroupedPendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchPendingData()
  }, [])

  // 1. 讀取並分組資料
  const fetchPendingData = async () => {
    setLoading(true)
    const { data: rawData, error } = await supabase
      .from('station_time_summary')
      .select('*')
      .is('assigned_section', null) // 只抓未分配
      .order('created_at', { ascending: false })
      .order('source_order_id', { ascending: true }) // 確保同源ID在一起
      .order('id', { ascending: true })
    
    if (error) {
      console.error(error)
    } else {
      // 進行資料分組
      const groups: GroupedPendingOrder[] = []
      const map = new Map<number, GroupedPendingOrder>()

      rawData?.forEach((row: PendingItem) => {
        if (!map.has(row.source_order_id)) {
          const newGroup: GroupedPendingOrder = {
            source_order_id: row.source_order_id,
            order_number: row.order_number,
            doc_type: row.doc_type || '',
            item_code: row.item_code,
            item_name: row.item_name,
            quantity: row.quantity,
            plate_count: row.plate_count,
            delivery_date: row.delivery_date || '',
            designer: row.designer || '',
            customer: row.customer || '',
            handler: row.handler || '',
            issuer: row.issuer || '',
            items: []
          }
          map.set(row.source_order_id, newGroup)
          groups.push(newGroup)
        }
        map.get(row.source_order_id)?.items.push(row)
      })
      setGroupedData(groups)
    }
    setLoading(false)
  }

  // 2. 前端篩選邏輯
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedData
    const lowerTerm = searchTerm.toLowerCase()
    
    // 只要 Group 內的任何資訊符合，整組都會顯示
    return groupedData.filter(group => 
      group.order_number.toLowerCase().includes(lowerTerm) ||
      group.item_code.toLowerCase().includes(lowerTerm) ||
      group.item_name.toLowerCase().includes(lowerTerm) ||
      group.customer.toLowerCase().includes(lowerTerm) ||
      // 甚至搜尋工序名稱 (例如搜尋 "雷切" 顯示含有雷切工序的單)
      group.items.some(item => item.op_name.toLowerCase().includes(lowerTerm) || item.station.toLowerCase().includes(lowerTerm))
    )
  }, [groupedData, searchTerm])

  // 3. 🔥 選擇邏輯 (支援取消選取 Toggle)
  const handleSelect = (rowId: number, sectionId: string) => {
    setSelections(prev => {
      const currentSelection = prev[rowId]
      const newSelections = { ...prev }

      if (currentSelection === sectionId) {
        // 如果點擊的是已經選取的項目 -> 移除選擇 (取消)
        delete newSelections[rowId]
      } else {
        // 否則 -> 設定為新的選擇
        newSelections[rowId] = sectionId
      }
      
      return newSelections
    })
  }

  // 4. 批量確認邏輯 (Floating Button Action)
  const handleBatchConfirm = async () => {
    const selectedIds = Object.keys(selections).map(Number)
    if (selectedIds.length === 0) return

    if (!confirm(`確定要將這 ${selectedIds.length} 筆工序移入排程總表嗎？`)) return

    setSaving(true)
    
    const updatesBySection: Record<string, number[]> = {}
    
    selectedIds.forEach(id => {
      const section = selections[id]
      if (!updatesBySection[section]) updatesBySection[section] = []
      updatesBySection[section].push(id)
    })

    try {
      const promises = Object.entries(updatesBySection).map(([sectionId, ids]) => 
        supabase
          .from('station_time_summary')
          .update({ assigned_section: sectionId })
          .in('id', ids)
      )

      await Promise.all(promises)

      // 更新成功，從前端移除這些資料
      setGroupedData(prev => {
        return prev.map(group => ({
          ...group,
          items: group.items.filter(item => !selections[item.id]) 
        })).filter(group => group.items.length > 0) 
      })

      setSelections({})
      alert('🎉 排程成功！已移入排程總表。')

    } catch (err: any) {
      console.error(err)
      alert('排程失敗: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // 計算已選擇的數量 (用於懸浮按鈕顯示)
  const selectedCount = Object.keys(selections).length

  const getStationBadge = (station: string) => {
    const s = station || ''
    if (s.includes('印刷')) return 'text-blue-400 bg-blue-900/20'
    if (s.includes('雷切')) return 'text-red-400 bg-red-900/20'
    if (s.includes('包裝')) return 'text-orange-400 bg-orange-900/20'
    if (s.includes('後加工')) return 'text-purple-400 bg-purple-900/20'
    return 'text-slate-400 bg-slate-800'
  }

  return (
    <div className="p-6 md:p-8 max-w-[1800px] mx-auto min-h-screen relative pb-24">
      
      {/* 標題與搜尋區 */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">生產待排表</h1>
          <p className="text-yellow-500 mt-1 font-mono text-sm uppercase">
            PENDING SCHEDULE // 請分配生產區塊 (支援批量)
          </p>
        </div>
        <div className="relative w-full md:w-96">
          <input 
            type="text" 
            placeholder="搜尋關鍵字 (工單、客戶、雷切...)" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg block pl-4 p-2.5 focus:border-yellow-500 outline-none transition-colors shadow-lg"
          />
          {searchTerm && (
            <div className="absolute right-3 top-2.5 text-xs text-slate-500">
              Filter Active
            </div>
          )}
        </div>
      </div>

      {/* 主表格區 */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden min-h-[600px] flex flex-col shadow-xl">
        <div className="flex-1 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-400 border-collapse">
            <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono sticky top-0 z-20 shadow-lg">
              <tr>
                <th className="px-4 py-3 w-48 border-b border-slate-700">工單資訊</th>
                <th className="px-4 py-3 min-w-[200px] border-b border-slate-700">品項資訊 (分組)</th>
                <th className="px-4 py-3 w-24 text-right border-b border-slate-700">數量/盤數</th>
                <th className="px-4 py-3 w-40 border-b border-slate-700">工序與站點</th>
                <th className="px-4 py-3 w-24 text-right border-b border-slate-700 text-emerald-400">預計總時</th>
                <th className="px-4 py-3 min-w-[280px] text-center border-b border-slate-700">分配區塊 (點擊選擇)</th>
              </tr>
            </thead>
            
            {/* 分組顯示邏輯 */}
            {loading ? (
               <tbody><tr><td colSpan={6} className="p-20 text-center text-slate-500">載入中...</td></tr></tbody>
            ) : filteredGroups.length === 0 ? (
               <tbody><tr><td colSpan={6} className="p-20 text-center text-slate-600">無符合條件的待排資料</td></tr></tbody>
            ) : filteredGroups.map((group, gIndex) => (
              <tbody key={group.source_order_id} className={`border-b border-slate-700/50 ${gIndex % 2 === 0 ? 'bg-slate-900/20' : 'bg-transparent'} hover:bg-slate-800/30 transition-colors`}>
                {group.items.map((row, index) => {
                  const isFirst = index === 0
                  const rowSpan = group.items.length

                  return (
                    <tr key={row.id} className="group/row">
                      {/* 共用資訊欄位 (第一列顯示，RowSpan合併) */}
                      {isFirst && (
                        <>
                          <td rowSpan={rowSpan} className="px-4 py-3 align-top border-r border-slate-800/30 pt-4">
                            <div className="flex justify-between items-start">
                              <div className="font-mono text-cyan-400 font-bold text-base">{group.order_number}</div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{group.doc_type}</span>
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="text-slate-600 font-mono">交付:</span>
                                <span className="text-white">{group.delivery_date}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="text-slate-600 font-mono">客戶:</span>
                                <span className="truncate max-w-[120px]" title={group.customer}>{group.customer}</span>
                              </div>
                            </div>
                          </td>

                          <td rowSpan={rowSpan} className="px-4 py-3 align-top border-r border-slate-800/30 pt-4">
                            <div className="font-mono text-purple-300 text-sm mb-1">{group.item_code}</div>
                            <div className="text-slate-300 text-sm mb-2 break-words max-w-[250px] leading-tight">{group.item_name}</div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono mt-auto">
                              <span>美: {group.designer}</span>
                              <span>承: {group.handler}</span>
                              <span>開: {group.issuer}</span>
                            </div>
                          </td>

                          <td rowSpan={rowSpan} className="px-4 py-3 align-top text-right border-r border-slate-800/30 pt-4">
                            <div className="font-mono text-white text-lg font-bold">{group.quantity}</div>
                            <div className="text-slate-500 text-xs mt-1">盤: {group.plate_count || '-'}</div>
                          </td>
                        </>
                      )}

                      {/* 獨立工序資訊 */}
                      <td className="px-4 py-3 align-top border-r border-slate-800/30">
                        <div className="text-slate-300 font-bold mb-1">{row.op_name}</div>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${getStationBadge(row.station)}`}>
                          {row.station}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top text-right border-r border-slate-800/30">
                        <span className="font-mono text-xl font-bold text-emerald-400">{row.total_time_min}</span>
                        <span className="text-xs text-emerald-600 block mt-1">mins</span>
                      </td>
                      
                      {/* 六格選擇區 */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex gap-2 justify-center flex-wrap">
                          {PRODUCTION_SECTIONS.map((section) => {
                            const isSelected = selections[row.id] === section.id
                            return (
                              <button
                                key={section.id}
                                onClick={() => handleSelect(row.id, section.id)}
                                className={`
                                  w-10 h-10 rounded-md border-2 transition-all flex flex-col items-center justify-center gap-0.5 relative overflow-hidden
                                  ${isSelected 
                                    ? `${section.border} ${section.color} text-white shadow-lg scale-110 z-10 ring-2 ring-offset-2 ring-offset-slate-900 ring-white` 
                                    : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:border-slate-500 hover:bg-slate-700 hover:text-slate-300'
                                  }
                                `}
                                title={section.name}
                              >
                                <span className="text-[11px] font-bold leading-none z-10">{section.name.substring(0, 1)}</span>
                                <span className="text-[9px] leading-none opacity-80 z-10">{section.name.substring(1)}</span>
                                {isSelected && <div className="absolute inset-0 bg-white/10 animate-pulse"></div>}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      </div>

      {/* 懸浮批量確認按鈕 (FAB) */}
      <div className={`fixed bottom-8 right-8 z-50 transition-all duration-300 transform ${selectedCount > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        <button
          onClick={handleBatchConfirm}
          disabled={saving}
          className="group flex items-center gap-3 bg-green-600 hover:bg-green-500 text-white px-6 py-4 rounded-full shadow-[0_0_30px_rgba(22,163,74,0.5)] border border-green-400 transition-all hover:scale-105 active:scale-95"
        >
          <div className="flex flex-col items-end leading-tight">
            <span className="font-black text-lg">確認排程 ({selectedCount})</span>
            <span className="text-[10px] text-green-200 uppercase tracking-wider">Confirm All Selection</span>
          </div>
          <div className="bg-white/20 p-2 rounded-full">
            {saving ? (
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            )}
          </div>
        </button>
      </div>

    </div>
  )
}