'use client'

import { useState, useEffect, useMemo, useCallback, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PRODUCTION_CATEGORY_MAP, getCurrentWeekStart, type ProductionMachine, type ProductionTask, type TaskUpdate } from '../lib/production'
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  pointerWithin 
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

const SECTION_NAME_MAP: Record<string, string> = {
  printing: '印刷看板',
  laser: '雷切看板',
  post: '後加工看板',
  packaging: '包裝看板',
  outsourced: '委外看板',
  changping: '常平看板'
}

const SECTION_OPTIONS: Array<{ id: string; label: string; style: string }> = [
  { id: 'printing', label: '印刷', style: 'bg-blue-700 hover:bg-blue-600 border-blue-400' },
  { id: 'laser', label: '雷切', style: 'bg-red-700 hover:bg-red-600 border-red-400' },
  { id: 'post', label: '後加工', style: 'bg-purple-700 hover:bg-purple-600 border-purple-400' },
  { id: 'packaging', label: '包裝', style: 'bg-orange-700 hover:bg-orange-600 border-orange-400' },
  { id: 'outsourced', label: '委外', style: 'bg-slate-700 hover:bg-slate-600 border-slate-400' },
  { id: 'changping', label: '常平', style: 'bg-emerald-700 hover:bg-emerald-600 border-emerald-400' }
]

function getTargetSection(stationRaw: string, docTypeRaw: string): string | null {
  const station = stationRaw || ''
  const docType = docTypeRaw || ''

  if (docType.includes('常平') || station.includes('常平')) return 'changping'
  if (station.includes('轉運')) return docType.includes('委外') ? 'outsourced' : 'outsourced'
  if (station.includes('印刷')) return 'printing'
  if (station.includes('雷切')) return 'laser'
  if (station.includes('包裝')) return 'packaging'
  if (station.includes('加工') || station.includes('組裝')) return 'post'
  if (docType.includes('委外')) return 'outsourced'

  return null
}

// --- 1. 警告確認彈窗 ---
function AlertModal({ 
  isOpen, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  isOpen: boolean, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void 
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-2 border-red-500 w-full max-w-md rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.3)] overflow-hidden transform scale-100 flex flex-col">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/50">
            <svg className="w-8 h-8 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-white mb-2">排程邏輯衝突警告</h3>
          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line text-left bg-slate-950 p-3 rounded border border-slate-800">
            {message}
          </p>
        </div>
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">
            取消操作
          </button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-900/20">
            強制排入
          </button>
        </div>
      </div>
    </div>
  )
}

// --- 2. 詳細資料彈窗 (含人員資訊與完整欄位) ---
function TaskDetailModal({ task, onClose, onTaskUpdate, onRefreshAll }: { task: ProductionTask | null, onClose: () => void, onTaskUpdate: (id: number, updates: TaskUpdate) => void, onRefreshAll: () => Promise<void> }) {
  const [orderStages, setOrderStages] = useState<ProductionTask[]>([])
  const [isLoadingStages, setIsLoadingStages] = useState(false)
  const [partialInput, setPartialInput] = useState<string>('')
  const [currentCompleted, setCurrentCompleted] = useState<number>(task?.completed_quantity || 0)
  const [isUpvUpdating, setIsUpvUpdating] = useState(false)
  const [showSectionPicker, setShowSectionPicker] = useState(false)

  const fetchStages = useCallback(async () => {
    if (!task?.order_number) return
    setIsLoadingStages(true)
    const { data, error } = await supabase
      .from('station_time_summary')
      .select(`*, production_machines ( name )`)
      .eq('order_number', task.order_number)
      .eq('item_code', task.item_code)
      .eq('quantity', task.quantity)
      .order('id', { ascending: true })

    if (!error && data) setOrderStages(data as ProductionTask[])
    setIsLoadingStages(false)
  }, [task])

  useEffect(() => {
    if (task) {
      const timer = setTimeout(() => {
        void fetchStages()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [task, fetchStages])

  const handleFullComplete = async () => {
    if (!task) return
    if(!confirm('確定標記為「全部完成」嗎？')) return
    const updates = { status: 'completed', completed_quantity: task.quantity }
    const { error } = await supabase.from('station_time_summary').update(updates).eq('id', task.id)
    if (!error) { 
        setCurrentCompleted(task.quantity)
        onTaskUpdate(task.id, updates)
      await onRefreshAll()
        alert('已更新為完成狀態！') 
    }
  }

  const handlePartialUpdate = async () => {
    const qty = parseInt(partialInput, 10)
    if (isNaN(qty) || qty < 0) return alert('請輸入有效數量')
    
    if (!task) return
    const updates: TaskUpdate = { completed_quantity: qty }
    if (qty >= task.quantity) updates.status = 'completed'
    else updates.status = 'active'

    const { error } = await supabase.from('station_time_summary').update(updates).eq('id', task.id)
    if (!error) {
        setCurrentCompleted(qty)
        setPartialInput('')
        fetchStages()
        onTaskUpdate(task.id, updates)
      await onRefreshAll()
        if(qty >= task.quantity) alert('數量已達標，自動標記為完成！'); else alert(`進度已更新：${qty} / ${task.quantity}`)
    }
  }

  const handleResetProgress = async () => {
    if (!task) return
    if (!confirm('⚠️ 警告：確定要取消完成狀態並重置進度嗎？\n此動作將把「已完成數量」歸零，且無法復原。')) return
    
    const updates = { status: 'active', completed_quantity: 0 }
    const { error } = await supabase.from('station_time_summary').update(updates).eq('id', task.id)

    if (!error) {
        setCurrentCompleted(0)
        fetchStages()
        onTaskUpdate(task.id, updates)
      await onRefreshAll()
        alert('🔄 已重置進度！任務狀態已恢復。')
    } else {
        alert('重置失敗: ' + error.message)
    }
  }

  const suggestedSection = useMemo(() => getTargetSection(task?.station || '', task?.doc_type || ''), [task])

  const handleReassignSection = () => {
    setShowSectionPicker((prev) => !prev)
  }

  const handleAssignToSection = async (targetSection: string) => {
    if (!task) return

    const targetSectionName = SECTION_NAME_MAP[targetSection] || targetSection
    if (!confirm(`是否將此工序重新分區到「${targetSectionName}」？`)) return

    const { error } = await supabase
      .from('station_time_summary')
      .update({ assigned_section: targetSection })
      .eq('id', task.id)

    if (error) {
      alert('重新分區失敗: ' + error.message)
      return
    }

    onTaskUpdate(task.id, { assigned_section: targetSection })
    await fetchStages()
    await onRefreshAll()
    setShowSectionPicker(false)
    alert(`✅ 已重新分區至：${targetSectionName}`)

    if (task.assigned_section !== targetSection) {
      onClose()
    }
  }

  const hasUpvApplied = useMemo(
    () => orderStages.some((stage) => (stage.station || '').includes('印刷') && (stage.basis_text || '').includes('[上Vx2]')),
    [orderStages]
  )

  const handleApplyUpv = async () => {
    if (!task) return

    const firstConfirm = confirm('⚠️ 將直接套用「上V」：此工單所有印刷工序時間會 ×2。\n\n是否繼續？')
    if (!firstConfirm) return

    const secondConfirm = confirm('請再次確認：要立即套用「上V ×2」嗎？\n此動作不經審核。')
    if (!secondConfirm) return

    setIsUpvUpdating(true)
    try {
      const { data, error } = await supabase
        .from('station_time_summary')
        .select('id, total_time_min, basis_text')
        .eq('order_number', task.order_number)
        .eq('item_code', task.item_code)
        .eq('quantity', task.quantity)
        .ilike('station', '%印刷%')

      if (error) throw error
      const printRows = (data || []) as Array<{ id: number; total_time_min: number | null; basis_text: string | null }>
      if (printRows.length === 0) {
        alert('此工單目前沒有印刷工序可套用上V。')
        return
      }

      const updateJobs = printRows.map((row) => {
        const currentMinutes = Number(row.total_time_min) || 0
        const currentBasis = row.basis_text || ''
        const nextBasis = currentBasis.includes('[上Vx2]') ? currentBasis : `${currentBasis}${currentBasis ? ' / ' : ''}[上Vx2]`

        return supabase
          .from('station_time_summary')
          .update({
            total_time_min: Math.round(currentMinutes * 2 * 100) / 100,
            basis_text: nextBasis
          })
          .eq('id', row.id)
      })

      const results = await Promise.all(updateJobs)
      const failed = results.find((result) => result.error)
      if (failed?.error) throw failed.error

      alert('✅ 已套用上V：印刷工序時間已全部 ×2')
      await fetchStages()
      if ((task.station || '').includes('印刷')) {
        const currentTaskAfterUpdate = printRows.find((row) => row.id === task.id)
        if (currentTaskAfterUpdate) {
          onTaskUpdate(task.id, { total_time_min: Math.round((Number(currentTaskAfterUpdate.total_time_min) || 0) * 2 * 100) / 100 })
        }
      }
      await onRefreshAll()
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : '未知錯誤'
      alert(`套用上V失敗：${message}`)
    } finally {
      setIsUpvUpdating(false)
    }
  }

  const handleCancelUpv = async () => {
    if (!task) return
    if (!confirm('確定要取消「上V」？\n系統會將此工單印刷工序時間還原 ÷2。')) return

    setIsUpvUpdating(true)
    try {
      const { data, error } = await supabase
        .from('station_time_summary')
        .select('id, total_time_min, basis_text')
        .eq('order_number', task.order_number)
        .eq('item_code', task.item_code)
        .eq('quantity', task.quantity)
        .ilike('station', '%印刷%')

      if (error) throw error
      const printRows = (data || []) as Array<{ id: number; total_time_min: number | null; basis_text: string | null }>
      if (printRows.length === 0) {
        alert('此工單目前沒有印刷工序。')
        return
      }

      const targetRows = printRows.filter((row) => (row.basis_text || '').includes('[上Vx2]'))
      if (targetRows.length === 0) {
        alert('此工單尚未套用上V，不需取消。')
        return
      }

      const updateJobs = targetRows.map((row) => {
        const currentMinutes = Number(row.total_time_min) || 0
        const cleanedBasis = (row.basis_text || '').replace(' / [上Vx2]', '').replace('[上Vx2]', '').trim()

        return supabase
          .from('station_time_summary')
          .update({
            total_time_min: Math.round((currentMinutes / 2) * 100) / 100,
            basis_text: cleanedBasis || null
          })
          .eq('id', row.id)
      })

      const results = await Promise.all(updateJobs)
      const failed = results.find((result) => result.error)
      if (failed?.error) throw failed.error

      alert('✅ 已取消上V：印刷工序時間已還原。')
      await fetchStages()
      if ((task.station || '').includes('印刷')) {
        const currentTaskAfterCancel = targetRows.find((row) => row.id === task.id)
        if (currentTaskAfterCancel) {
          onTaskUpdate(task.id, { total_time_min: Math.round((Number(currentTaskAfterCancel.total_time_min) || 0) / 2 * 100) / 100 })
        }
      }
      await onRefreshAll()
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : '未知錯誤'
      alert(`取消上V失敗：${message}`)
    } finally {
      setIsUpvUpdating(false)
    }
  }

  if (!task) return null
  const remaining = task.quantity - currentCompleted
  const hasProgress = currentCompleted > 0 || task.status === 'completed'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-white tracking-wide font-mono">{task.order_number}</h2>
                <span className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-400">{task.doc_type}</span>
                <div className="flex items-center gap-2 ml-4 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={hasUpvApplied ? handleCancelUpv : handleApplyUpv}
                      disabled={isUpvUpdating}
                      className={`px-3 py-1.5 text-white text-xs font-bold rounded transition-colors border ${hasUpvApplied ? 'bg-amber-700 hover:bg-amber-600 border-amber-400' : 'bg-red-700 hover:bg-red-600 border-red-400'} disabled:bg-slate-700 disabled:border-slate-600 disabled:text-slate-400`}
                    >
                      {isUpvUpdating ? '處理中...' : hasUpvApplied ? '取消上V' : '上V x2'}
                    </button>
                    <button onClick={handleFullComplete} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors flex items-center gap-1">✅ 全部完成</button>
                    <button onClick={handleReassignSection} className="px-3 py-1.5 bg-fuchsia-700 hover:bg-fuchsia-600 text-white text-xs font-bold rounded transition-colors">重新分區</button>
                    <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>
                    <div className="flex items-center gap-2">
                        <input type="number" placeholder="輸入數量" className="w-20 bg-black/50 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500" value={partialInput} onChange={(e) => setPartialInput(e.target.value)} />
                        <button onClick={handlePartialUpdate} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors">更新</button>
                    </div>
                    {hasProgress && (
                        <>
                            <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>
                            <button 
                                onClick={handleResetProgress}
                                className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 text-xs font-bold rounded transition-colors flex items-center gap-1"
                                title="重置進度歸零"
                            >
                                ↺ 重置
                            </button>
                        </>
                    )}
                    <span className="text-xs text-slate-400 ml-2 font-mono">(剩餘: <span className="text-yellow-400 font-bold">{remaining > 0 ? remaining : 0}</span>)</span>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        {showSectionPicker && (
          <div className="px-6 py-3 border-b border-fuchsia-700/40 bg-fuchsia-950/20">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-fuchsia-300 font-bold mr-2">選擇分區：</span>
              {SECTION_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => { void handleAssignToSection(option.id) }}
                  className={`px-3 py-1.5 text-white text-xs font-bold rounded border transition-colors ${option.style}`}
                >
                  {option.label}
                </button>
              ))}
              <button
                onClick={() => setShowSectionPicker(false)}
                className="px-3 py-1.5 text-xs font-bold rounded border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                取消
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              建議分區：
              <span className="text-cyan-300 font-bold ml-1">{suggestedSection ? SECTION_NAME_MAP[suggestedSection] : '無法判斷，請手動選擇'}</span>
            </div>
          </div>
        )}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar border-r border-slate-800 bg-slate-900/50">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="w-1 h-4 bg-blue-500 rounded-full"></span> 訂單基本資料</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                        <div><span className="text-[10px] text-slate-500 block">客戶</span><span className="text-white font-medium">{task.customer}</span></div>
                        <div><span className="text-[10px] text-slate-500 block">交付日期</span><span className="text-yellow-400 font-bold font-mono">{task.delivery_date}</span></div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2 bg-slate-800/20 rounded border border-slate-700/30">
                        <div><span className="text-[10px] text-slate-500 block">承辦人員</span><span className="text-slate-300 text-xs font-bold">{task.handler || '-'}</span></div>
                        <div><span className="text-[10px] text-slate-500 block">美編人員</span><span className="text-slate-300 text-xs font-bold">{task.designer || '-'}</span></div>
                        <div><span className="text-[10px] text-slate-500 block">開單人員</span><span className="text-slate-300 text-xs font-bold">{task.issuer || '-'}</span></div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="border-b border-slate-800 pb-2"><span className="text-[10px] text-slate-500 block">品號</span><span className="text-purple-300 font-mono">{task.item_code}</span></div>
                        <div className="border-b border-slate-800 pb-2"><span className="text-[10px] text-slate-500 block">品名</span><span className="text-white font-bold">{task.item_name}</span></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div><span className="text-[10px] text-slate-500 block">數量</span><span className="text-white text-lg font-mono font-bold">{task.quantity}</span></div>
                        <div><span className="text-[10px] text-slate-500 block">已完成</span><span className="text-cyan-400 text-lg font-mono font-bold">{currentCompleted}</span></div>
                        <div><span className="text-[10px] text-slate-500 block">總工時</span><span className="text-emerald-400 font-mono font-bold">{task.total_time_min} min</span></div>
                        <div><span className="text-[10px] text-slate-500 block">盤數</span><span className="text-slate-300 font-mono">{task.plate_count || '-'}</span></div>
                    </div>
                </div>
            </div>
            <div className="w-full lg:w-[450px] bg-[#0a101a] flex flex-col border-l border-slate-800">
                <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><span className="w-1 h-4 bg-purple-500 rounded-full"></span> 生產工序排程表</h3>
                    <span className="text-[10px] text-slate-500">{orderStages.length} 個工序</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {isLoadingStages ? <div className="text-center text-slate-500 text-xs py-10">載入中...</div> : (
                        <div className="space-y-3">
                            {orderStages.map((stage, index) => {
                                const isCurrent = stage.id === task.id
                                const isScheduled = !!stage.scheduled_date
                                const machineName = stage.production_machines?.name || (stage.production_machine_id ? `機台 #${stage.production_machine_id}` : '-')
                                
                                const stageQty = stage.quantity || 1
                                const stageDone = stage.completed_quantity || 0
                                const progressPct = Math.min(100, Math.round((stageDone / stageQty) * 100))
                                const isStageComplete = stage.status === 'completed' || stageDone >= stageQty

                                return (
                                    <div key={stage.id} className={`p-3 rounded-lg border transition-all ${isCurrent ? 'bg-cyan-900/20 border-cyan-500 ring-1 ring-cyan-500/50' : 'bg-slate-900 border-slate-800'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isCurrent ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{index + 1}</span>
                                                <span className={`text-sm font-bold ${isCurrent ? 'text-cyan-400' : 'text-slate-200'}`}>{stage.op_name}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{stage.assigned_section}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                            <div className="flex flex-col"><span className="text-slate-600 text-[10px]">預計日期</span>{isScheduled ? <span className="text-emerald-400 font-mono font-bold">{stage.scheduled_date}</span> : <span className="text-yellow-600 italic">待排程</span>}</div>
                                            <div className="flex flex-col text-right"><span className="text-slate-600 text-[10px]">機台</span><span className={isScheduled ? "text-slate-300" : "text-slate-600"}>{machineName}</span></div>
                                        </div>
                                        
                                        <div className="mt-2 pt-2 border-t border-slate-800/50">
                                            <div className="flex justify-between items-end text-[10px] mb-1">
                                                <span className={`${isStageComplete ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                    {isStageComplete ? '已完成' : '進行中'} 
                                                    <span className="ml-1 text-slate-500 font-mono">{stageDone}/{stageQty}</span>
                                                </span>
                                                <span className="font-mono text-white">{progressPct}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                                <div 
                                                    className={`h-full transition-all duration-500 ${isStageComplete ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                                    style={{ width: `${progressPct}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}

// --- 3. 可拖曳卡片 (🔥 修改Header顯示工序名稱) ---
function DraggableTask({ task, isOverlay = false, onTaskDblClick }: { task: ProductionTask, isOverlay?: boolean, onTaskDblClick?: (task: ProductionTask) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id.toString(), data: { task } })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 }
  
  const isCompleted = task.status === 'completed'
  const completedQty = task.completed_quantity ?? 0
  const isPartial = !isCompleted && completedQty > 0
  const progressPct = task.quantity > 0 ? Math.min(100, Math.round((completedQty / task.quantity) * 100)) : 0

  const getDocTypeColor = (type?: string | null) => {
    if (!type) return 'bg-slate-700 text-slate-400 border-slate-600'
    if (type.includes('急')) return 'bg-red-900/60 text-red-300 border-red-500/50'
    if (type.includes('樣')) return 'bg-purple-900/60 text-purple-300 border-purple-500/50'
    return 'bg-blue-900/40 text-blue-400 border-blue-500/30'
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes} 
      onDoubleClick={(e) => { e.stopPropagation(); if (onTaskDblClick) onTaskDblClick(task); }} 
      className={`
        p-2 mb-2 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing text-xs select-none relative group transition-all flex flex-col gap-1.5 
        ${isOverlay ? 'bg-cyan-950 border-cyan-500 scale-105 z-50 shadow-2xl ring-2 ring-cyan-400 w-60' : 'bg-slate-800 border-slate-700 hover:border-cyan-500/50 hover:bg-slate-750 hover:shadow-md'} 
        ${isCompleted ? 'grayscale opacity-50 bg-black/80 border-slate-800' : ''}
      `}
    >
      {/* 呼吸燈 */}
      {isPartial && !isOverlay && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3 z-10">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 border border-slate-900"></span>
        </span>
      )}

      {/* 🔥 Header: 單號 + 工序名稱 + 單據種類 */}
      <div className="flex justify-between items-center border-b border-slate-700/50 pb-1.5">
        <span className={`font-mono font-black text-[13px] tracking-tight truncate ${isCompleted ? 'text-slate-500' : 'text-cyan-400'} max-w-[80px]`}>{task.order_number}</span>
        
        {/* 🔥 新增：工序名稱 (置中) */}
        <span className="flex-1 text-center px-1">
            <span className="text-[10px] font-bold text-slate-300 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50 truncate max-w-full block">
                {task.op_name}
            </span>
        </span>

        <span className={`text-[12px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${isCompleted ? 'bg-slate-900 text-slate-600 border-slate-800' : getDocTypeColor(task.doc_type)}`}>{task.doc_type || '工單'}</span>
      </div>

      <div className={`font-bold text-[11px] leading-tight break-words line-clamp-2 min-h-[1.2em] ${isCompleted ? 'text-slate-500' : 'text-white'}`} title={task.item_name ?? undefined}>{task.item_name || '-'}</div>
      <div className="flex items-center justify-between text-[12px] bg-black/20 p-1.5 rounded border border-slate-700/30">
        <div className="flex items-center gap-1"><span className="text-slate-500 text-[11px] scale-90">數量:</span><span className={`font-mono font-bold ${isCompleted ? 'text-slate-500' : 'text-white'}`}>{task.quantity}</span></div>
        <div className="flex items-center gap-1 border-l border-slate-700 pl-2"><span className="text-slate-500 text-[11px] scale-90">工時:</span><span className={`font-mono font-bold ${isCompleted ? 'text-slate-600' : 'text-emerald-500'}`}>{task.total_time_min}m</span></div>
        <div className="flex items-center gap-1 border-l border-slate-700 pl-2"><span className="text-slate-500 text-[11px] scale-90">交期:</span><span className={`font-mono font-bold ${isCompleted ? 'text-slate-600' : 'text-yellow-400'}`}>{task.delivery_date?.slice(5) || '-'}</span></div>
      </div>
      
      {/* 微型進度條 */}
      {isPartial && (
        <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden mt-1">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
        </div>
      )}

      <div className="flex justify-between items-center text-[9px] pt-0.5">
        <div className="text-slate-400 truncate max-w-[50%]">🏢 {task.customer}</div>
        <div className="text-slate-500 font-mono truncate max-w-[45%]">{task.item_code}</div>
      </div>
      
      {isCompleted && (<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="bg-black/80 rounded-full p-1 border border-slate-600"><span className="text-2xl">✅</span></div></div>)}
    </div>
  )
}

// --- 4. 行事曆格子 (維持不變) ---
function DroppableDay({ date, tasks, title, isMachineSelected, isToday, dailyCapacity, onTaskDblClick }: { date: string, tasks: ProductionTask[], title: string, isMachineSelected: boolean, isToday: boolean, dailyCapacity: number, onTaskDblClick: (task: ProductionTask) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: date, disabled: !isMachineSelected })
  const usedMins = tasks.reduce((sum, t) => sum + (t.total_time_min ?? 0), 0)
  const remainingMins = dailyCapacity - usedMins
  const isOverloaded = remainingMins < 0
  return (
    <div ref={setNodeRef} className={`flex-1 min-w-[180px] border-r border-slate-700/50 flex flex-col transition-colors relative ${isOver ? 'bg-cyan-900/20 shadow-[inset_0_0_20px_rgba(6,182,212,0.2)]' : 'bg-transparent'} ${!isMachineSelected ? 'bg-slate-950/50 cursor-not-allowed' : ''} ${isToday ? 'bg-slate-800/30' : ''}`}>
      <div className={`p-2 border-b border-slate-700/50 sticky top-0 z-10 backdrop-blur-sm ${isToday ? 'bg-cyan-950/40 border-cyan-500/30' : 'bg-slate-900/90'}`}>
        <div className="flex flex-col items-center mb-1"><span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-cyan-400' : 'text-slate-400'}`}>{title}</span><span className={`text-lg font-black font-mono ${isToday ? 'text-white' : 'text-slate-200'}`}>{date.slice(5)}</span></div>
        <div className="bg-black/20 rounded p-1.5 space-y-1"><div className="flex justify-between text-[10px] text-cyan-400 font-mono"><span>已排: {usedMins}</span></div><div className={`flex justify-between text-[10px] font-bold font-mono ${isOverloaded ? 'text-red-400' : 'text-emerald-400'}`}><span>剩餘: {remainingMins}</span></div></div>
      </div>
      <div className="relative flex-1 group/container">
        <div className={`p-2 h-[500px] min-h-[500px] pb-6 ${tasks.length > 0 ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`}>
            {tasks.map(task => <DraggableTask key={task.id} task={task} onTaskDblClick={onTaskDblClick} />)}
            {tasks.length === 0 && <div className="h-full flex items-center justify-center text-slate-700 text-[10px] italic opacity-50 border-2 border-dashed border-slate-800/50 rounded m-1">{isMachineSelected ? '+' : '停止'}</div>}
        </div>
      </div>
    </div>
  )
}

// --- 5. Unscheduled Sidebar (維持原樣) ---
function UnscheduledSidebar({ tasks, onTaskDblClick }: { tasks: ProductionTask[], onTaskDblClick: (t: ProductionTask) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled' })
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: 'delivery_date' | 'item_code' | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' })

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.scheduled_date) return false
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (t.order_number?.toLowerCase().includes(q) || t.customer?.toLowerCase().includes(q) || t.item_name?.toLowerCase().includes(q) || t.item_code?.toLowerCase().includes(q))
    })
  }, [tasks, searchQuery])

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      if (!sortConfig.key) return 0
      const valA = a[sortConfig.key] || ''; const valB = b[sortConfig.key] || ''
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredTasks, sortConfig])

  const handleSort = (key: 'delivery_date' | 'item_code') => {
    setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  }

  return (
    <div ref={setNodeRef} className={`w-72 flex flex-col bg-slate-950 border border-slate-800 rounded-xl shadow-2xl transition-colors ${isOver ? 'bg-red-900/10 border-red-500/50' : ''}`}>
      <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-2">
        <h3 className="font-bold text-white text-sm flex items-center gap-2"><svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>待排任務 ({sortedTasks.length})</h3>
        <div className="relative"><input type="text" placeholder="🔍 搜尋單號/客戶/品名..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black/30 border border-slate-700 rounded text-xs text-slate-200 px-2 py-1.5 focus:outline-none focus:border-cyan-500 pl-2" /></div>
        <div className="flex gap-2">
          <button onClick={() => handleSort('delivery_date')} className={`flex-1 text-[10px] py-1 rounded border transition-colors flex items-center justify-center gap-1 ${sortConfig.key === 'delivery_date' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}>依交期 {sortConfig.key === 'delivery_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</button>
          <button onClick={() => handleSort('item_code')} className={`flex-1 text-[10px] py-1 rounded border transition-colors flex items-center justify-center gap-1 ${sortConfig.key === 'item_code' ? 'bg-purple-900/30 text-purple-400 border-purple-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}>依品號 {sortConfig.key === 'item_code' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</button>
        </div>
      </div>
      <div className="flex-1 p-2 overflow-y-auto custom-scrollbar">
        {sortedTasks.length === 0 ? <div className="text-center text-slate-600 mt-10 text-xs"><p>{searchQuery ? '無搜尋結果' : '無待排任務'}</p></div> : sortedTasks.map(task => <DraggableTask key={task.id} task={task} onTaskDblClick={onTaskDblClick} />)}
      </div>
    </div>
  )
}

// --- 6. 主框架元件 ---
export default function ProductionScheduler({ sectionId, sectionName }: { sectionId: string, sectionName: string }) {
  const [tasks, setTasks] = useState<ProductionTask[]>([])
  const [machines, setMachines] = useState<ProductionMachine[]>([])
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [activeDragItem, setActiveDragItem] = useState<ProductionTask | null>(null)
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<ProductionTask | null>(null)
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean, message: string, onConfirm: () => void } | null>(null)
  
  // 🔥 新增：全域搜尋狀態與邏輯
  const [globalFilter, setGlobalFilter] = useState('') // 儲存觸發搜尋後的關鍵字
  const [searchInput, setSearchInput] = useState('')   // 儲存輸入框的即時內容

  const [currentStart, setCurrentStart] = useState(getCurrentWeekStart)
  const [showWeekends, setShowWeekends] = useState(false)
  const [showNextWeek, setShowNextWeek] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }))

  // 搜尋觸發函式
  const handleSearch = () => {
    setGlobalFilter(searchInput.trim())
  }

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      await fetchTasks()
    } finally {
      setIsSyncing(false)
    }
  }

  // 修正機台抓取邏輯
  useEffect(() => {
    const fetchMachines = async () => {
      const targetCategory = PRODUCTION_CATEGORY_MAP[sectionId] || sectionName.replace('產程', '')
      let { data } = await supabase
        .from('production_machines')
        .select('*')
        .eq('category', targetCategory)
        .eq('is_active', true)
        .order('id')

      if ((!data || data.length === 0) && sectionName) {
        const { data: fallbackData } = await supabase
            .from('production_machines')
            .select('*')
            .ilike('name', `%${sectionName.replace('產程', '')}%`)
            .eq('is_active', true)
            .order('id')
        if (fallbackData && fallbackData.length > 0) data = fallbackData
      }

      if (data && data.length > 0) {
          const machineData = data as ProductionMachine[]
          setMachines(machineData)
          setSelectedMachineId(prev => prev ? prev : machineData[0].id)
      } else { 
          setMachines([]); 
          setSelectedMachineId(null) 
      }
    }
    if (sectionId) fetchMachines()
  }, [sectionId, sectionName])

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('station_time_summary')
      .select('*')
      .eq('assigned_section', sectionId)
    setTasks((data as ProductionTask[]) || [])
  }, [sectionId])

  useEffect(() => {
    void fetchTasks()
  }, [sectionId, selectedMachineId, fetchTasks])

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchTasks()
    }, 60000)

    return () => clearInterval(interval)
  }, [fetchTasks])

  const currentMachine = machines.find(m => m.id === selectedMachineId); const currentDailyCap = currentMachine?.daily_minutes || 480 
  
    const generateDates = (startDate: Date, weeks: number) => {
      const arr: string[] = []
      // 強制起點為週一
      let start = new Date(startDate)
      const startDay = start.getDay()
      if (startDay !== 1) {
        const diff = start.getDate() - (startDay === 0 ? 6 : startDay - 1)
        start.setDate(diff)
      }
      start.setHours(0, 0, 0, 0)
      for (let i = 0; i < weeks * 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        // 隱藏第一欄(週日)和最後一欄(週六)
        if (!showWeekends && (i === 0 || i === 6)) continue
        arr.push(d.toISOString().split('T')[0])
      }
      return arr
  }
  const week1Dates = generateDates(currentStart, 1); const week2Dates = generateDates(new Date(new Date(currentStart).setDate(currentStart.getDate() + 7)), 1)

  // 🔥 修改後的 getTasksForDate (支援全域搜尋)
  const getTasksForDate = (date: string) => {
    if (!selectedMachineId) return []
    
    // 1. 先篩選日期與機台
    let dailyTasks = tasks.filter(t => t.scheduled_date === date && t.production_machine_id === selectedMachineId)
    
    // 2. 再套用全域搜尋 (如果有按搜尋才執行)
    if (globalFilter) {
        const q = globalFilter.toLowerCase()
        dailyTasks = dailyTasks.filter(t => 
            (t.order_number?.toLowerCase().includes(q)) || 
            (t.customer?.toLowerCase().includes(q)) || 
            (t.item_name?.toLowerCase().includes(q))
        )
    }

    // 3. 排序邏輯
    return dailyTasks.sort((a, b) => {
        const aCompleted = a.status === 'completed' ? 1 : 0
        const bCompleted = b.status === 'completed' ? 1 : 0
        if (aCompleted !== bCompleted) return aCompleted - bCompleted
        const getUrgency = (t: ProductionTask) => (t.doc_type || '').includes('急') ? 1 : 0
        return getUrgency(b) - getUrgency(a)
    })
  }
  
  const todayStr = new Date().toISOString().split('T')[0]

  const executeUpdate = async (taskId: string | number, targetDate: string | null, machineId: number | null) => {
    setTasks(prev => prev.map(t => { if (t.id.toString() === taskId.toString()) { return { ...t, scheduled_date: targetDate, production_machine_id: machineId } } return t }))
    await supabase.from('station_time_summary').update({ scheduled_date: targetDate, production_machine_id: machineId }).eq('id', taskId)
    setAlertConfig(null)
  }

  const handleTaskUpdate = (taskId: number, updates: TaskUpdate) => {
    setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, ...updates } : t
    ))
    if (selectedTaskDetail?.id === taskId) {
        setSelectedTaskDetail(prev => (prev ? { ...prev, ...updates } : prev))
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragItem(null)
    if (!over) return

    const taskId = active.id
    const targetId = over.id as string
    const currentTask = active.data.current?.task as ProductionTask | undefined
    if (!currentTask) return
    if (targetId === 'unscheduled') { executeUpdate(taskId, null, null); return }
    if (!selectedMachineId) { alert('請先選擇機台！'); return }
    const newDate = targetId
    const { data: allStages } = await supabase.from('station_time_summary').select('*').eq('order_number', currentTask.order_number).eq('item_code', currentTask.item_code).eq('quantity', currentTask.quantity).order('id', { ascending: true })
    if (!allStages) { executeUpdate(taskId, newDate, selectedMachineId); return }
    const typedStages = allStages as ProductionTask[]
    const currentIndex = typedStages.findIndex((s) => s.id === currentTask.id)
    let warningMsg = ""
    if (currentIndex > 0) { const prev = typedStages[currentIndex - 1]; if (!prev.scheduled_date) warningMsg += `⚠️ 前工序 [${prev.op_name}] 尚未排程！\n`; else if (new Date(newDate) <= new Date(prev.scheduled_date)) warningMsg += `⚠️ 日期衝突：需在 [${prev.op_name}] (${prev.scheduled_date}) 之後。\n` }
    if (currentIndex < typedStages.length - 1) { const next = typedStages[currentIndex + 1]; if (next.scheduled_date && new Date(newDate) >= new Date(next.scheduled_date)) warningMsg += `⚠️ 日期衝突：需在 [${next.op_name}] (${next.scheduled_date}) 之前。\n` }
    if (warningMsg) setAlertConfig({ isOpen: true, message: warningMsg, onConfirm: () => executeUpdate(taskId, newDate, selectedMachineId) }); else executeUpdate(taskId, newDate, selectedMachineId)
  }

  const handleDragStart = (event: DragStartEvent) => { setActiveDragItem(event.active.data.current?.task as ProductionTask) }
  const changeWeek = (offset: number) => { const newStart = new Date(currentStart); newStart.setDate(newStart.getDate() + (offset * 7)); setCurrentStart(newStart); setShowNextWeek(false) }
  // 讓日期選擇器選到的日期自動對齊到該週的週一
  const handleDatePick = (e: ChangeEvent<HTMLInputElement>) => {
    let date = new Date(e.target.value);
    if (!isNaN(date.getTime())) {
      const day = date.getDay();
      // day: 0=Sunday, 1=Monday, ..., 6=Saturday
      // 週一為主，週日(day=0)往回推6天到本週一
      if (day !== 1) {
        const diff = date.getDate() - (day === 0 ? 6 : day - 1);
        date.setDate(diff);
      }
      date.setHours(0, 0, 0, 0);
      setCurrentStart(new Date(date));
      setShowNextWeek(false);
    }
  }
  
  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} sensors={sensors} collisionDetection={pointerWithin}>
      <TaskDetailModal key={selectedTaskDetail?.id ?? 'empty-task'} task={selectedTaskDetail} onClose={() => setSelectedTaskDetail(null)} onTaskUpdate={handleTaskUpdate} onRefreshAll={fetchTasks} />
      <AlertModal isOpen={!!alertConfig} message={alertConfig?.message || ''} onConfirm={alertConfig?.onConfirm || (() => {})} onCancel={() => setAlertConfig(null)} />
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
        <div className="flex flex-col gap-3 mb-2 px-1">
            <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white whitespace-nowrap mr-2">{sectionName}</h2>
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1 border border-slate-700">
                        <button onClick={() => changeWeek(-1)} className="p-1 hover:text-cyan-400 text-slate-400">←</button>
                        {/* 日期選擇器永遠以本週一為主 */}
                        <input type="date" value={currentStart.toISOString().split('T')[0]} onChange={handleDatePick} className="bg-transparent text-white text-sm font-bold border-none outline-none focus:ring-0 w-32 text-center"/>
                        <button onClick={() => changeWeek(1)} className="p-1 hover:text-cyan-400 text-slate-400">→</button>
                    </div>
                    {/* 🔥 新增：按鈕式搜尋框 */}
                    <div className="relative ml-2 flex items-center gap-1">
                        <input 
                            type="text" 
                            placeholder="🔍 搜尋單號/客戶..." 
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="bg-black/30 border border-slate-700 rounded-lg px-3 py-1 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none w-48 transition-all"
                        />
                        <button 
                            onClick={handleSearch}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg text-sm border border-slate-600 transition-colors"
                        >
                            搜尋
                        </button>
                        {globalFilter && (
                            <button 
                                onClick={() => { setGlobalFilter(''); setSearchInput(''); }}
                                className="text-red-400 hover:text-red-300 text-xs ml-1"
                            >
                                清除
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { void handleManualSync() }}
                    disabled={isSyncing}
                    className="px-3 py-1 rounded-lg text-xs font-bold border border-cyan-700 bg-cyan-900/40 text-cyan-300 hover:bg-cyan-800/60 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSyncing ? '同步中...' : '立即同步'}
                  </button>
                  <label className="flex items-center cursor-pointer gap-2"><div className="relative"><input type="checkbox" className="sr-only" checked={showWeekends} onChange={() => setShowWeekends(!showWeekends)} /><div className={`block w-10 h-6 rounded-full transition-colors ${showWeekends ? 'bg-cyan-600' : 'bg-slate-700'}`}></div><div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showWeekends ? 'transform translate-x-4' : ''}`}></div></div><span className="text-xs text-slate-400 font-bold">顯示週末</span></label>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 p-2 bg-slate-900/30 rounded-lg border border-slate-800">
                {machines.map(machine => (<button key={machine.id} onClick={() => setSelectedMachineId(machine.id)} className={`px-4 py-2 rounded border transition-all text-xs font-bold flex items-center gap-2 grow-0 ${selectedMachineId === machine.id ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}><span className={`w-2 h-2 rounded-full ${selectedMachineId === machine.id ? 'bg-white animate-pulse' : 'bg-slate-500'}`}></span>{machine.name}</button>))}
            </div>
        </div>
        <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 pb-4 custom-scrollbar">
                <div className="flex flex-col bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl shrink-0">
                    <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex justify-between"><span className="text-xs font-bold text-cyan-400 flex items-center gap-2"><span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>CURRENT WEEK (本週)</span></div>
                    <div className="flex divide-x divide-slate-800 overflow-x-auto">{week1Dates.map((date) => (<DroppableDay key={date} date={date} tasks={getTasksForDate(date)} title={new Date(date).toLocaleDateString('en-US', { weekday: 'short' })} isMachineSelected={!!selectedMachineId} isToday={date === todayStr} dailyCapacity={currentDailyCap} onTaskDblClick={setSelectedTaskDetail} />))}</div>
                </div>
                {showNextWeek ? (
                    <div className="flex flex-col bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl shrink-0 animate-fade-in">
                        <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex justify-between"><span className="text-xs font-bold text-slate-400 flex items-center gap-2"><span className="w-1.5 h-4 bg-slate-600 rounded-full"></span>NEXT WEEK (下週)</span><button onClick={() => setShowNextWeek(false)} className="text-[10px] text-slate-500 hover:text-white">隱藏</button></div>
                        <div className="flex divide-x divide-slate-800 overflow-x-auto">{week2Dates.map((date) => (<DroppableDay key={date} date={date} tasks={getTasksForDate(date)} title={new Date(date).toLocaleDateString('en-US', { weekday: 'short' })} isMachineSelected={!!selectedMachineId} isToday={date === todayStr} dailyCapacity={currentDailyCap} onTaskDblClick={setSelectedTaskDetail} />))}</div>
                    </div>
                ) : (<button onClick={() => setShowNextWeek(true)} className="w-full py-3 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all text-xs font-mono flex items-center justify-center gap-2"><span>⬇️ 載入下週排程 (Show Next Week)</span></button>)}
            </div>
            <UnscheduledSidebar tasks={tasks} onTaskDblClick={setSelectedTaskDetail} />
        </div>
      </div>
      <DragOverlay>{activeDragItem ? <DraggableTask task={activeDragItem} isOverlay /> : null}</DragOverlay>
    </DndContext>
  )
}