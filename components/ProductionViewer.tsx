'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import { PRODUCTION_CATEGORY_MAP, getCurrentWeekStart, type ProductionMachine, type ProductionTask, type TaskUpdate } from '../lib/production'

// --- 1. 詳細資料彈窗 (現場看板專用版：無重置功能) ---
function TaskDetailModal({ task, onClose, onTaskUpdate }: { task: ProductionTask | null, onClose: () => void, onTaskUpdate: (id: number, updates: TaskUpdate) => void }) {
  const [orderStages, setOrderStages] = useState<ProductionTask[]>([])
  const [isLoadingStages, setIsLoadingStages] = useState(true)
  const [partialInput, setPartialInput] = useState<string>('')
  const [currentCompleted, setCurrentCompleted] = useState<number>(task?.completed_quantity || 0)
  const [isSubmittingAnomaly, setIsSubmittingAnomaly] = useState(false)
  const [showOtherAnomalyForm, setShowOtherAnomalyForm] = useState(false)
  const [otherAnomalyReason, setOtherAnomalyReason] = useState('')

  const getReadableErrorMessage = (err: unknown) => {
    if (err instanceof Error && err.message) return err.message

    if (typeof err === 'object' && err !== null) {
      const maybeError = err as {
        message?: unknown
        details?: unknown
        hint?: unknown
        code?: unknown
      }

      const parts = [
        typeof maybeError.message === 'string' ? maybeError.message : '',
        typeof maybeError.details === 'string' ? maybeError.details : '',
        typeof maybeError.hint === 'string' ? maybeError.hint : '',
        typeof maybeError.code === 'string' ? `code: ${maybeError.code}` : '',
      ].filter(Boolean)

      if (parts.length > 0) return parts.join(' | ')
    }

    return '未知錯誤'
  }

  const fetchStages = useCallback(async () => {
    if (!task?.order_number) return
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

  // 功能 A: 全部完成
  const handleFullComplete = async () => {
    if (!task) return
    if(!confirm('確定標記為「全部完成」嗎？')) return
    const updates = { status: 'completed', completed_quantity: task.quantity }
    const { error } = await supabase.from('station_time_summary').update(updates).eq('id', task.id)
    if (!error) { 
        setCurrentCompleted(task.quantity)
        onTaskUpdate(task.id, updates)
        alert('✅ 已更新為完成狀態！') 
    }
  }

  // 功能 B: 部分完成 (更新數量)
  const handlePartialUpdate = async () => {
    const qty = parseInt(partialInput, 10)
    if (isNaN(qty) || qty < 0) return alert('請輸入有效數量')
    
    if (!task) return
    const updates: TaskUpdate = { completed_quantity: qty }
    // 若數量達標則自動完成，否則保持 active
    if (qty >= task.quantity) updates.status = 'completed'
    else updates.status = 'active'

    const { error } = await supabase.from('station_time_summary').update(updates).eq('id', task.id)
    if (!error) {
        setCurrentCompleted(qty)
        setPartialInput('')
        fetchStages()
        onTaskUpdate(task.id, updates)
        if(qty >= task.quantity) alert('✅ 數量已達標，自動標記為完成！'); else alert(`👌 進度已更新：${qty} / ${task.quantity}`)
    }
  }

  // ❌ 現場看板不包含「重置」功能

  const submitAnomalyReport = async (reportType: 'upv' | 'other', reason: string | null) => {
    if (!task) return

    setIsSubmittingAnomaly(true)
    try {
      const payload = {
        report_type: reportType,
        reason,
        status: 'pending',
        source_order_id: task.source_order_id || null,
        task_id: task.id,
        order_number: task.order_number,
        item_code: task.item_code,
        quantity: task.quantity,
        op_name: task.op_name,
        station: task.station,
        section_id: task.assigned_section || null
      }

      const { error } = await supabase.from('schedule_anomaly_reports').insert(payload)
      if (error) throw error

      alert(reportType === 'upv' ? '✅ 已送出「此為上V」回報' : '✅ 已送出「其他異常回報」')
      setShowOtherAnomalyForm(false)
      setOtherAnomalyReason('')
    } catch (err: unknown) {
      console.error(err)
      const message = getReadableErrorMessage(err)
      alert(`送出失敗：${message}`)
    } finally {
      setIsSubmittingAnomaly(false)
    }
  }

  const handleUpvReport = () => {
    if (!confirm('確定送出「此為上V」回報？\n(後台確認後印刷工時將雙倍)')) return
    void submitAnomalyReport('upv', '此為上V')
  }

  const handleSubmitOtherAnomaly = () => {
    const reason = otherAnomalyReason.trim()
    if (!reason) {
      alert('請填寫異常原因')
      return
    }
    void submitAnomalyReport('other', reason)
  }

  if (!task) return null
  const remaining = task.quantity - currentCompleted

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-white tracking-wide font-mono">{task.order_number}</h2>
                <span className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-400">{task.doc_type || '工單'}</span>
                
                {/* 操作區 */}
                <div className="flex items-center gap-2 ml-4 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button onClick={handleFullComplete} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors flex items-center gap-1">✅ 全部完成</button>
                    <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>
                    <div className="flex items-center gap-2">
                        <input type="number" placeholder="輸入數量" className="w-20 bg-black/50 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500" value={partialInput} onChange={(e) => setPartialInput(e.target.value)} />
                        <button onClick={handlePartialUpdate} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors">更新進度</button>
                    </div>
                    <span className="text-xs text-slate-400 ml-2 font-mono">(剩餘: <span className="text-yellow-400 font-bold">{remaining > 0 ? remaining : 0}</span>)</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpvReport}
                disabled={isSubmittingAnomaly}
                className="w-20 h-12 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-black border-2 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.35)] disabled:bg-slate-700 disabled:border-slate-600 disabled:text-slate-400"
                title="此為上V"
              >
                此為上V
              </button>
              <button
                onClick={() => setShowOtherAnomalyForm(prev => !prev)}
                disabled={isSubmittingAnomaly}
                className="w-24 h-12 rounded-lg bg-red-800 hover:bg-red-700 text-white text-sm font-black border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)] disabled:bg-slate-700 disabled:border-slate-600 disabled:text-slate-400"
                title="其他異常回報"
              >
                其他異常
              </button>
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
            </div>
        </div>

        {showOtherAnomalyForm && (
          <div className="px-6 py-4 border-b border-slate-800 bg-red-950/20">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-red-300">其他異常原因</label>
              <textarea
                value={otherAnomalyReason}
                onChange={(e) => setOtherAnomalyReason(e.target.value)}
                placeholder="請輸入異常原因..."
                className="w-full min-h-[90px] bg-slate-900 border border-red-500/40 rounded-lg p-3 text-sm text-white outline-none focus:border-red-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowOtherAnomalyForm(false); setOtherAnomalyReason('') }}
                  className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitOtherAnomaly}
                  disabled={isSubmittingAnomaly}
                  className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isSubmittingAnomaly ? '送出中...' : '送出回報'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            {/* 左側：詳細資料 */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar border-r border-slate-800 bg-slate-900/50">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="w-1 h-4 bg-blue-500 rounded-full"></span> 訂單基本資料</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                        <div><span className="text-[10px] text-slate-500 block">客戶</span><span className="text-white font-medium">{task.customer}</span></div>
                        <div><span className="text-[10px] text-slate-500 block">交付日期</span><span className="text-yellow-400 font-bold font-mono">{task.delivery_date}</span></div>
                    </div>
                    
                    {/* 人員資訊 */}
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

            {/* 右側：工序表 */}
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

// --- 2. 互動式任務卡片 (🔥 修改Header顯示工序名稱) ---
function InteractiveTaskCard({ task, onClick }: { task: ProductionTask, onClick: () => void }) {
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
      onClick={onClick}
      className={`
        p-2 mb-2 rounded-lg border shadow-sm cursor-pointer select-none relative group transition-all flex flex-col gap-1.5 
        hover:border-cyan-500/50 hover:bg-slate-750 hover:shadow-md
        ${isCompleted ? 'grayscale opacity-50 bg-black/80 border-slate-800' : 'bg-slate-800 border-slate-700'}
      `}
    >
      {/* 呼吸燈 (執行中提示) */}
      {isPartial && (
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

// --- 3. 行事曆格子 (接收點擊事件) ---
function DayColumn({ 
  date, 
  tasks, 
  title, 
  isMachineSelected, 
  isToday, 
  dailyCapacity,
  onTaskClick 
}: { 
  date: string, 
  tasks: ProductionTask[], 
  title: string, 
  isMachineSelected: boolean, 
  isToday: boolean,
  dailyCapacity: number,
  onTaskClick: (task: ProductionTask) => void
}) {
  const usedMins = tasks.reduce((sum, t) => sum + (t.total_time_min ?? 0), 0)
  const remainingMins = dailyCapacity - usedMins
  const isOverloaded = remainingMins < 0

  return (
    <div className={`
        flex-1 min-w-[180px] border-r border-slate-700/50 flex flex-col transition-colors relative
        ${!isMachineSelected ? 'bg-slate-950/50' : 'bg-transparent'}
        ${isToday ? 'bg-slate-800/30' : ''}
      `}
    >
      {/* 標頭 */}
      <div className={`
        p-2 border-b border-slate-700/50 sticky top-0 z-10 backdrop-blur-sm
        ${isToday ? 'bg-cyan-950/40 border-cyan-500/30' : 'bg-slate-900/90'}
      `}>
        <div className="flex flex-col items-center mb-1">
          <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-cyan-400' : 'text-slate-400'}`}>{title}</span>
          <span className={`text-lg font-black font-mono ${isToday ? 'text-white' : 'text-slate-200'}`}>{date.slice(5)}</span>
        </div>

        <div className="bg-black/20 rounded p-1.5 space-y-1">
          <div className="flex justify-between text-[10px] text-cyan-400 font-mono">
              <span>已排: {usedMins}</span>
          </div>
          <div className={`flex justify-between text-[10px] font-bold font-mono ${isOverloaded ? 'text-red-400' : 'text-emerald-400'}`}>
              <span>剩餘: {remainingMins}</span>
          </div>
        </div>
      </div>

      {/* 任務列表區 (支援點擊) */}
      <div className="p-2 overflow-y-auto custom-scrollbar h-[calc(100vh-250px)] pb-6">
        {tasks.map(task => (
          <InteractiveTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
        ))}
        {tasks.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-700 text-[10px] italic opacity-50 border-2 border-dashed border-slate-800/50 rounded m-1">
              {isMachineSelected ? '- 空閒 -' : '停止'}
          </div>
        )}
      </div>
    </div>
  )
}

// --- 4. 主框架 (現場看板模式：可操作但無重置、無拖拉、無右側Sidebar) ---
export default function ProductionViewer({ sectionId, sectionName }: { sectionId: string, sectionName: string }) {
  const [tasks, setTasks] = useState<ProductionTask[]>([])
  const [machines, setMachines] = useState<ProductionMachine[]>([])
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  // 互動狀態
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<ProductionTask | null>(null)

  // 日期控制
  const [currentStart, setCurrentStart] = useState(getCurrentWeekStart)
  const [showWeekends, setShowWeekends] = useState(false)
  const [showNextWeek, setShowNextWeek] = useState(false)

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase.from('station_time_summary').select('*').eq('assigned_section', sectionId)
    if (error) console.error(error)
    else setTasks((data as ProductionTask[]) || [])
  }, [sectionId])

  // 抓取機台 (使用新的 category 邏輯)
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
        setSelectedMachineId(machineData[0].id)
      } else {
        setMachines([])
        setSelectedMachineId(null)
      }
    }
    fetchMachines()
  }, [sectionId, sectionName])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTasks()
    }, 0)
    return () => clearTimeout(timer)
  }, [sectionId, selectedMachineId, fetchTasks])

  // 1分鐘自動重整
  useEffect(() => {
    const interval = setInterval(() => { fetchTasks() }, 60000)
    return () => clearInterval(interval)
  }, [sectionId, selectedMachineId, fetchTasks])

  // 處理任務更新 (即時反應在 UI)
  const handleTaskUpdate = (taskId: number, updates: TaskUpdate) => {
    setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, ...updates } : t
    ))
    if (selectedTaskDetail?.id === taskId) {
        setSelectedTaskDetail(prev => (prev ? { ...prev, ...updates } : prev))
    }
  }

  const currentMachine = machines.find(m => m.id === selectedMachineId)
  const currentDailyCap = currentMachine?.daily_minutes || 480 

  const generateDates = (startDate: Date, weeks: number) => {
    const arr = []
    const start = new Date(startDate)
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      // 隱藏第一欄(週日)和最後一欄(週六)
      if (!showWeekends && (i === 0 || i === 6)) continue
      arr.push(d.toISOString().split('T')[0])
    }
    return arr
  }

  const week1Dates = generateDates(currentStart, 1)
  const week2Dates = generateDates(new Date(new Date(currentStart).setDate(currentStart.getDate() + 7)), 1)

  const changeWeek = (offset: number) => {
    const newStart = new Date(currentStart)
    newStart.setDate(newStart.getDate() + (offset * 7))
    setCurrentStart(newStart)
    setShowNextWeek(false)
  }

  const getTasksForDate = (date: string) => {
    if (!selectedMachineId) return []
    const keyword = searchTerm.trim().toLowerCase()
    let dailyTasks = tasks.filter(t => t.scheduled_date === date && t.production_machine_id === selectedMachineId)

    if (keyword) {
      dailyTasks = dailyTasks.filter((task) =>
        (task.order_number || '').toLowerCase().includes(keyword) ||
        (task.customer || '').toLowerCase().includes(keyword)
      )
    }

    // 排序：未完成 > 急件 > 一般 > 已完成
    return dailyTasks.sort((a, b) => {
        const aCompleted = a.status === 'completed' ? 1 : 0
        const bCompleted = b.status === 'completed' ? 1 : 0
        if (aCompleted !== bCompleted) return aCompleted - bCompleted
      const getUrgency = (t: ProductionTask) => (t.doc_type || '').includes('急') ? 1 : 0
        return getUrgency(b) - getUrgency(a)
    })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
        {/* 互動視窗 */}
        <TaskDetailModal key={selectedTaskDetail?.id ?? 'empty-task'} task={selectedTaskDetail} onClose={() => setSelectedTaskDetail(null)} onTaskUpdate={handleTaskUpdate} />

        {/* Header */}
        <div className="flex flex-col gap-3 mb-2 px-1">
            <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-blue-600 text-white px-2 py-1 rounded">現場看板</span>
                    <h2 className="text-xl font-bold text-white whitespace-nowrap mr-2">{sectionName}</h2>
                    
                    {/* 日期導航 */}
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1 border border-slate-700">
                        <button onClick={() => changeWeek(-1)} className="p-1 hover:text-cyan-400 text-slate-400 transition-colors">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="text-white text-sm font-bold w-32 text-center font-mono">
                           {currentStart.toISOString().split('T')[0]}
                        </span>
                        <button onClick={() => changeWeek(1)} className="p-1 hover:text-cyan-400 text-slate-400 transition-colors">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>

                    {/* 返回首頁 */}
                    <Link 
                      href="/dashboard" 
                      className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-500/50 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-all group"
                    >
                      <svg className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      看板首頁
                    </Link>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Live Sync
                    </span>
                    <label className="flex items-center cursor-pointer gap-2">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={showWeekends} onChange={() => setShowWeekends(!showWeekends)} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${showWeekends ? 'bg-cyan-600' : 'bg-slate-700'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showWeekends ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="text-xs text-slate-400 font-bold">顯示週末</span>
                    </label>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 p-2 bg-slate-900/30 rounded-lg border border-slate-800">
                {machines.length === 0 ? (
                    <div className="text-slate-500 text-xs w-full text-center py-2">尚無機台</div>
                ) : (
                    machines.map(machine => (
                        <button
                            key={machine.id}
                            onClick={() => setSelectedMachineId(machine.id)}
                            className={`
                                px-4 py-2 rounded border transition-all text-xs font-bold flex items-center gap-2 grow-0
                                ${selectedMachineId === machine.id 
                                    ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' 
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                                }
                            `}
                        >
                            <span className={`w-2 h-2 rounded-full ${selectedMachineId === machine.id ? 'bg-white animate-pulse' : 'bg-slate-500'}`}></span>
                            {machine.name}
                        </button>
                    ))
                )}

                <div className="relative min-w-[240px] flex-1 md:flex-none md:w-[320px] ml-auto">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜尋單號 / 客戶"
                    className="w-full bg-black/40 border border-slate-700 rounded text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
                  />
                </div>
            </div>
        </div>

        {/* Content (佔滿寬度，無右側Sidebar) */}
        <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 pb-4 custom-scrollbar">
                {/* 第一週 */}
                <div className="flex flex-col bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl shrink-0">
                    <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex justify-between">
                        <span className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>
                          CURRENT WEEK (本週)
                        </span>
                    </div>
                    <div className="flex divide-x divide-slate-800 overflow-x-auto">
                        {week1Dates.map((date) => (
                          <DayColumn 
                              key={date} 
                              date={date} 
                              tasks={getTasksForDate(date)} 
                              title={new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                              isMachineSelected={!!selectedMachineId}
                              isToday={date === todayStr}
                              dailyCapacity={currentDailyCap}
                              onTaskClick={setSelectedTaskDetail}
                          />
                        ))}
                    </div>
                </div>

                {/* 第二週 */}
                {showNextWeek ? (
                    <div className="flex flex-col bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl shrink-0 animate-fade-in">
                        <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex justify-between">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-slate-600 rounded-full"></span>
                            NEXT WEEK (下週)
                        </span>
                        <button onClick={() => setShowNextWeek(false)} className="text-[10px] text-slate-500 hover:text-white">
                            隱藏
                        </button>
                        </div>
                        <div className="flex divide-x divide-slate-800 overflow-x-auto">
                            {week2Dates.map((date) => (
                            <DayColumn 
                                key={date} 
                                date={date} 
                                tasks={getTasksForDate(date)} 
                                title={new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                                isMachineSelected={!!selectedMachineId}
                                isToday={date === todayStr}
                                dailyCapacity={currentDailyCap}
                                onTaskClick={setSelectedTaskDetail}
                            />
                            ))}
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => setShowNextWeek(true)}
                        className="w-full py-3 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all text-xs font-mono flex items-center justify-center gap-2"
                    >
                        <span>⬇️ 載入下週排程 (Show Next Week)</span>
                    </button>
                )}
            </div>
        </div>
    </div>
  )
}