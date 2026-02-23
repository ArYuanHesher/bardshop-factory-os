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
  sequence: number 
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
  const [isAutoAssigning, setIsAutoAssigning] = useState(false)

  // 新增工序 Modal 狀態
  const [showAddModal, setShowAddModal] = useState(false)
  const [targetGroup, setTargetGroup] = useState<GroupedPendingOrder | null>(null)
  const [newOpData, setNewOpData] = useState({ station: '後加工', op_name: '', total_time_min: 20, insertAfterId: 'end' })

  useEffect(() => {
    fetchPendingData()
  }, [])

  // 1. 讀取並分組資料
  const fetchPendingData = async () => {
    setLoading(true)
    const { data: rawData, error } = await supabase
      .from('station_time_summary')
      .select('*')
      .is('assigned_section', null)
      .order('created_at', { ascending: false })
      .order('source_order_id', { ascending: true })
      .order('sequence', { ascending: true }) 
    
    if (error) {
      console.error(error)
    } else {
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
      groups.forEach(g => g.items.sort((a, b) => a.sequence - b.sequence))
      setGroupedData(groups)
    }
    setLoading(false)
  }

  // 2. 前端篩選邏輯
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedData
    const lowerTerm = searchTerm.toLowerCase()
    return groupedData.filter(group => 
      group.order_number.toLowerCase().includes(lowerTerm) ||
      group.item_code.toLowerCase().includes(lowerTerm) ||
      group.item_name.toLowerCase().includes(lowerTerm) ||
      group.customer.toLowerCase().includes(lowerTerm) ||
      group.items.some(item => item.op_name.toLowerCase().includes(lowerTerm) || item.station.toLowerCase().includes(lowerTerm))
    )
  }, [groupedData, searchTerm])

  // 3. 選擇邏輯
  const handleSelect = (rowId: number, sectionId: string) => {
    setSelections(prev => {
      const currentSelection = prev[rowId]
      const newSelections = { ...prev }
      if (currentSelection === sectionId) delete newSelections[rowId]
      else newSelections[rowId] = sectionId
      return newSelections
    })
  }

  // 4. 更新工時邏輯
  const handleTimeUpdate = async (itemId: number, newValue: string) => {
    const numValue = parseFloat(newValue)
    if (isNaN(numValue)) return

    setGroupedData(prev => prev.map(group => ({
      ...group,
      items: group.items.map(item => item.id === itemId ? { ...item, total_time_min: numValue } : item)
    })))

    await supabase.from('station_time_summary').update({ total_time_min: numValue }).eq('id', itemId)
  }

  // 5. 刪除工序邏輯
  const handleDeleteOp = async (itemId: number, opName: string) => {
    if (!confirm(`確定要刪除工序「${opName}」嗎？\n此動作將直接從資料庫移除該項目。`)) return

    setGroupedData(prev => {
      return prev.map(group => ({
        ...group,
        items: group.items.filter(item => item.id !== itemId)
      })).filter(group => group.items.length > 0)
    })

    const { error } = await supabase.from('station_time_summary').delete().eq('id', itemId)
    if (error) {
      alert('刪除失敗: ' + error.message)
      fetchPendingData()
    }
  }

  // 6. 開啟新增視窗
  const openAddModal = (group: GroupedPendingOrder) => {
    setTargetGroup(group)
    setNewOpData({ station: '後加工', op_name: '', total_time_min: 30, insertAfterId: 'end' })
    setShowAddModal(true)
  }

  // 7. 新增工序提交
  const handleAddOpSubmit = async () => {
    if (!targetGroup) return
    if (!newOpData.op_name) return alert('請輸入工序名稱')

    setSaving(true)

    const newRowBase = {
      source_order_id: targetGroup.source_order_id,
      order_number: targetGroup.order_number,
      doc_type: targetGroup.doc_type,
      item_code: targetGroup.item_code,
      item_name: targetGroup.item_name,
      quantity: targetGroup.quantity,
      plate_count: targetGroup.plate_count,
      delivery_date: targetGroup.delivery_date,
      designer: targetGroup.designer,
      customer: targetGroup.customer,
      handler: targetGroup.handler,
      issuer: targetGroup.issuer,
      station: newOpData.station,
      op_name: newOpData.op_name,
      total_time_min: newOpData.total_time_min,
      std_time: 0,
      assigned_section: null
    }

    try {
      const currentItems = [...targetGroup.items]
      let insertIndex = currentItems.length
      if (newOpData.insertAfterId === 'start') {
        insertIndex = 0
      } else if (newOpData.insertAfterId !== 'end') {
        const foundIndex = currentItems.findIndex(item => item.id === Number(newOpData.insertAfterId))
        if (foundIndex !== -1) insertIndex = foundIndex + 1
      }

      const updates = []
      for (let i = 0; i < insertIndex; i++) updates.push({ id: currentItems[i].id, sequence: (i + 1) * 10 })
      const newRowSequence = (insertIndex + 1) * 10 
      for (let i = insertIndex; i < currentItems.length; i++) updates.push({ id: currentItems[i].id, sequence: (i + 2) * 10 })

      const tasks = []
      if (updates.length > 0) {
        updates.forEach(u => tasks.push(supabase.from('station_time_summary').update({ sequence: u.sequence }).eq('id', u.id)))
      }
      tasks.push(supabase.from('station_time_summary').insert({ ...newRowBase, sequence: newRowSequence }))

      await Promise.all(tasks)
      setShowAddModal(false)
      fetchPendingData()
      alert('工序新增並重新排序完成！')

    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : '未知錯誤'
      alert('新增失敗: ' + message)
    } finally {
      setSaving(false)
    }
  }

  // 8. 批量確認邏輯
  const handleBatchConfirm = async () => {
    const selectedIds = Object.keys(selections).map(Number)
    if (selectedIds.length === 0) return

    const selectedSet = new Set(selectedIds)
    const incompleteGroups = groupedData
      .map(group => {
        const selectedInGroup = group.items.filter(item => selectedSet.has(item.id))
        if (selectedInGroup.length === 0) return null
        if (selectedInGroup.length === group.items.length) return null

        const missingOps = group.items
          .filter(item => !selectedSet.has(item.id))
          .map(item => item.op_name)

        return {
          orderNumber: group.order_number,
          itemCode: group.item_code,
          missingOps
        }
      })
      .filter((group): group is { orderNumber: string; itemCode: string; missingOps: string[] } => group !== null)

    if (incompleteGroups.length > 0) {
      const preview = incompleteGroups
        .slice(0, 5)
        .map(group => `- ${group.orderNumber} / ${group.itemCode} 未指定工序：${group.missingOps.join('、')}`)
        .join('\n')

      const more = incompleteGroups.length > 5 ? `\n...另有 ${incompleteGroups.length - 5} 筆` : ''
      alert(`同一品項必須所有工序都指定後才能確認排程。\n\n請先補齊以下工單：\n${preview}${more}`)
      return
    }

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
        supabase.from('station_time_summary').update({ assigned_section: sectionId }).in('id', ids)
      )
      await Promise.all(promises)
      
      setGroupedData(prev => prev.map(group => ({
        ...group,
        items: group.items.filter(item => !selections[item.id]) 
      })).filter(group => group.items.length > 0))

      setSelections({})
      alert('🎉 排程成功！已移入排程總表。')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知錯誤'
      alert('排程失敗: ' + message)
    } finally {
      setSaving(false)
    }
  }

  // 🔥🔥🔥 9. 修改：智慧預選 (Auto Select) - 只更新前端選取狀態
  const handleAutoAssign = () => {
    setIsAutoAssigning(true)
    
    // 1. 蒐集所有待排工序
    const allPendingItems = groupedData.flatMap(group => group.items)
    
    if (allPendingItems.length === 0) {
        alert('目前沒有待處理的工序。')
        setIsAutoAssigning(false)
        return
    }

    let matchCount = 0
    // 2. 複製目前的選取狀態，準備進行更新
    const newSelections = { ...selections }

    for (const item of allPendingItems) {
        // 如果已經有人工選取了，就不覆蓋 (或者你可以決定要不要覆蓋)
        // 這裡設定：若未選取才自動填入
        if (newSelections[item.id]) continue;

        let targetSection = null
        const stationName = item.station || ''
        const docType = item.doc_type || ''

        // --- 判斷邏輯 ---
        if (stationName.includes('印刷')) targetSection = 'printing'
        else if (stationName.includes('轉運')) {
            targetSection = docType.includes('常平') ? 'changping' : 'outsourced'
        }
        else if (stationName.includes('雷切')) targetSection = 'laser'
        else if (stationName.includes('包裝')) targetSection = 'packaging'
        else if (stationName.includes('加工') || stationName.includes('組裝')) targetSection = 'post'
        else if (stationName.includes('常平')) targetSection = 'changping'
        // --- 判斷結束 ---

        if (targetSection) {
            newSelections[item.id] = targetSection
            matchCount++
        }
    }

    // 3. 更新畫面狀態
    setSelections(newSelections)
    setIsAutoAssigning(false)
    
    if (matchCount > 0) {
        alert(`✨ 已自動選取 ${matchCount} 筆建議站點！\n\n請檢查按鈕亮起狀況，確認無誤後點擊右下角「確認排程」送出。`)
    } else {
        alert('未找到符合規則的工序，或所有工序皆已選取。')
    }
  }

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
            PENDING SCHEDULE // 新增/刪除/分配工序
          </p>
        </div>
        
        <div className="flex items-center gap-3">
            {/* 🔥 自動預選按鈕 */}
            <button 
                onClick={handleAutoAssign}
                disabled={isAutoAssigning}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 shadow-lg ${isAutoAssigning ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400'}`}
            >
                {isAutoAssigning ? (
                    <>處理中...</>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        一鍵智慧預選 (Auto Select)
                    </>
                )}
            </button>

            <div className="relative w-full md:w-96">
                <input 
                    type="text" 
                    placeholder="搜尋關鍵字..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg block pl-4 p-2.5 focus:border-yellow-500 outline-none transition-colors shadow-lg"
                />
            </div>
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
                <th className="px-4 py-3 w-32 text-right border-b border-slate-700 text-emerald-400">預計總時</th>
                <th className="px-4 py-3 min-w-[280px] text-center border-b border-slate-700">分配區塊</th>
                <th className="px-4 py-3 w-16 text-center border-b border-slate-700">操作</th>
              </tr>
            </thead>
            
            {loading ? (
               <tbody><tr><td colSpan={7} className="p-20 text-center text-slate-500">載入中...</td></tr></tbody>
            ) : filteredGroups.length === 0 ? (
               <tbody><tr><td colSpan={7} className="p-20 text-center text-slate-600">無符合條件的待排資料</td></tr></tbody>
            ) : filteredGroups.map((group, gIndex) => (
              <tbody key={group.source_order_id} className={`border-b border-slate-700/50 ${gIndex % 2 === 0 ? 'bg-slate-900/20' : 'bg-transparent'} hover:bg-slate-800/30 transition-colors`}>
                {group.items.map((row, index) => {
                  const isFirst = index === 0
                  const rowSpan = group.items.length + 1 

                  return (
                    <tr key={row.id} className="group/row">
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

                      <td className="px-4 py-3 align-top border-r border-slate-800/30">
                        <div className="text-slate-300 font-bold mb-1">{row.op_name}</div>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${getStationBadge(row.station)}`}>
                          {row.station}
                        </span>
                        <span className="ml-2 text-[9px] text-slate-600 font-mono">#{row.sequence}</span>
                      </td>

                      <td className="px-4 py-3 align-top text-right border-r border-slate-800/30">
                        <div className="flex flex-col items-end">
                          <input 
                            type="number"
                            value={row.total_time_min}
                            onChange={(e) => handleTimeUpdate(row.id, e.target.value)}
                            className="bg-transparent border-b border-slate-700 hover:border-emerald-500 focus:border-emerald-400 focus:bg-slate-800 outline-none w-20 text-right font-mono text-xl font-bold text-emerald-400 transition-colors"
                          />
                          <span className="text-xs text-emerald-600 block mt-1">mins</span>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 align-middle border-r border-slate-800/30">
                        <div className="flex gap-2 justify-center flex-wrap">
                          {PRODUCTION_SECTIONS.map((section) => {
                            const isSelected = selections[row.id] === section.id
                            return (
                              <button
                                key={section.id}
                                onClick={() => handleSelect(row.id, section.id)}
                                className={`
                                  w-8 h-8 rounded-md border-2 transition-all flex flex-col items-center justify-center gap-0.5 relative overflow-hidden
                                  ${isSelected 
                                    ? `${section.border} ${section.color} text-white shadow-lg scale-110 z-10` 
                                    : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:border-slate-500 hover:bg-slate-700 hover:text-slate-300'
                                  }
                                `}
                                title={section.name}
                              >
                                <span className="text-[10px] font-bold leading-none z-10">{section.name.substring(0, 1)}</span>
                              </button>
                            )
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center align-middle">
                        <button onClick={() => handleDeleteOp(row.id, row.op_name)} className="text-slate-600 hover:text-red-500 transition-colors p-2 rounded hover:bg-red-950/30">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}

                <tr>
                  <td colSpan={4} className="p-2 text-center border-t border-slate-800/30">
                    <button 
                      onClick={() => openAddModal(group)}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-slate-700 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all text-xs font-mono"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      ADD OPERATION (新增工序)
                    </button>
                  </td>
                </tr>
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

      {/* 新增工序 Modal */}
      {showAddModal && targetGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-white mb-1">新增工序 (Add Operation)</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">
              工單: {targetGroup.order_number} / 品項: {targetGroup.item_code}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-cyan-400 mb-1 font-bold">插入位置 (Insert After)</label>
                <select 
                  value={newOpData.insertAfterId}
                  onChange={e => setNewOpData({...newOpData, insertAfterId: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-cyan-500"
                >
                  <option value="start">⬆️ 最前面 (Start of Order)</option>
                  {targetGroup.items.map(item => (
                    <option key={item.id} value={item.id}>
                      ⬇️ 插在「{item.op_name}」之後
                    </option>
                  ))}
                  <option value="end">⬇️ 最後面 (End of Order)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  * 系統將自動重新排列序號 (10, 20, 30...) 以確保順序正確。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">站點 (Station)</label>
                  <select 
                    value={newOpData.station}
                    onChange={e => setNewOpData({...newOpData, station: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm outline-none focus:border-cyan-500"
                  >
                    <option value="印刷">印刷 (Printing)</option>
                    <option value="雷切">雷切 (Laser)</option>
                    <option value="後加工">後加工 (Post)</option>
                    <option value="包裝">包裝 (Packing)</option>
                    <option value="委外">委外 (Outsourced)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">預計工時 (分)</label>
                  <input 
                    type="number" 
                    value={newOpData.total_time_min}
                    onChange={e => setNewOpData({...newOpData, total_time_min: parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm outline-none focus:border-cyan-500 text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">工序名稱 (Op Name)</label>
                <input 
                  type="text" 
                  value={newOpData.op_name}
                  onChange={e => setNewOpData({...newOpData, op_name: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm outline-none focus:border-cyan-500"
                  placeholder="例如: 手工糊盒、加貼標籤..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button 
                onClick={() => setShowAddModal(false)} 
                disabled={saving}
                className="px-4 py-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
              >
                取消
              </button>
              <button 
                onClick={handleAddOpSubmit} 
                disabled={saving}
                className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 flex items-center gap-2"
              >
                {saving ? '處理中...' : '確認新增'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}