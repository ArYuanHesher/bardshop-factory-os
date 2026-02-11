'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

// --- 1. 警告確認彈窗 (Alert Modal) ---
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

// --- 2. 詳細資料彈窗 ---
function TaskDetailModal({ task, onClose }: { task: any, onClose: () => void }) {
  const [orderStages, setOrderStages] = useState<any[]>([])
  const [isLoadingStages, setIsLoadingStages] = useState(false)

  useEffect(() => {
    if (task?.order_number) {
      const fetchStages = async () => {
        setIsLoadingStages(true)
        const { data, error } = await supabase
          .from('station_time_summary')
          .select(`*, production_machines ( name )`)
          .eq('order_number', task.order_number)
          .eq('item_code', task.item_code)
          .eq('quantity', task.quantity)
          .order('id', { ascending: true })

        if (!error && data) setOrderStages(data)
        setIsLoadingStages(false)
      }
      fetchStages()
    }
  }, [task])

  if (!task) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white tracking-wide font-mono">{task.order_number}</h2>
            <span className="px-2 py-1 rounded text-xs font-bold bg-slate-800 text-slate-300 border border-slate-600">{task.doc_type || '工單'}</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar border-r border-slate-800 bg-slate-900/50">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><span className="w-1 h-4 bg-blue-500 rounded-full"></span> 訂單基本資料</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div className="col-span-2 grid grid-cols-2 gap-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                        <div><span className="text-[10px] text-slate-500 block">客戶</span><span className="text-white font-medium">{task.customer}</span></div>
                        <div><span className="text-[10px] text-slate-500 block">交付日期</span><span className="text-yellow-400 font-bold font-mono">{task.delivery_date}</span></div>
                    </div>
                    <div className="col-span-2 space-y-3">
                        <div className="border-b border-slate-800 pb-2"><span className="text-[10px] text-slate-500 block">品號</span><span className="text-purple-300 font-mono">{task.item_code}</span></div>
                        <div className="border-b border-slate-800 pb-2"><span className="text-[10px] text-slate-500 block">品名</span><span className="text-white font-bold">{task.item_name}</span></div>
                    </div>
                    <div><span className="text-[10px] text-slate-500 block">數量</span><span className="text-white text-lg font-mono font-bold">{task.quantity}</span></div>
                    <div><span className="text-[10px] text-slate-500 block">盤數</span><span className="text-slate-300">{task.plate_count || '-'}</span></div>
                    <div><span className="text-[10px] text-slate-500 block">總工時</span><span className="text-emerald-400 font-mono font-bold">{task.total_time_min} min</span></div>
                    <div className="col-span-2 grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800">
                        <div><span className="text-[10px] text-slate-600 block">業務</span><span className="text-slate-400 text-xs">{task.handler}</span></div>
                        <div><span className="text-[10px] text-slate-600 block">開單</span><span className="text-slate-400 text-xs">{task.issuer}</span></div>
                        <div><span className="text-[10px] text-slate-600 block">美編</span><span className="text-slate-400 text-xs">{task.designer}</span></div>
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
                                return (
                                    <div key={stage.id} className={`p-3 rounded-lg border transition-all ${isCurrent ? 'bg-cyan-900/20 border-cyan-500 ring-1 ring-cyan-500/50' : 'bg-slate-900 border-slate-800'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isCurrent ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{index + 1}</span>
                                                <span className={`text-sm font-bold ${isCurrent ? 'text-cyan-400' : 'text-slate-200'}`}>{stage.op_name}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{stage.assigned_section}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex flex-col"><span className="text-slate-600 text-[10px]">預計日期</span>{isScheduled ? <span className="text-emerald-400 font-mono font-bold">{stage.scheduled_date}</span> : <span className="text-yellow-600 italic">待排程</span>}</div>
                                            <div className="flex flex-col text-right"><span className="text-slate-600 text-[10px]">機台</span><span className={isScheduled ? "text-slate-300" : "text-slate-600"}>{machineName}</span></div>
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

// --- 3. 可拖曳卡片 ---
function DraggableTask({ 
  task, 
  isOverlay = false, 
  onTaskDblClick 
}: { 
  task: any, 
  isOverlay?: boolean, 
  onTaskDblClick?: (task: any) => void 
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id.toString(),
    data: { task }
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  }

  // 單據類型顏色
  const getDocTypeColor = (type: string) => {
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
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (onTaskDblClick) onTaskDblClick(task);
      }}
      className={`
        p-2 mb-2 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing text-xs select-none relative group transition-all flex flex-col gap-1.5
        ${isOverlay 
          ? 'bg-cyan-950 border-cyan-500 scale-105 z-50 shadow-2xl ring-2 ring-cyan-400 w-56' 
          : 'bg-slate-800 border-slate-700 hover:border-cyan-500/50 hover:bg-slate-750 hover:shadow-md'
        }
      `}
    >
      {/* 1. 訂單編號 (放大) & 單據類型 (完整顯示 + 放大) */}
      <div className="flex justify-between items-center border-b border-slate-700/50 pb-1.5">
        <span className="font-mono text-cyan-400 font-black text-[13px] tracking-tight truncate">
            {task.order_number}
        </span>
        <span className={`text-[12px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${getDocTypeColor(task.doc_type)}`}>
            {task.doc_type || '工單'}
        </span>
      </div>

      {/* 2. 品名 */}
      <div className="text-white font-bold text-[11px] leading-tight break-words line-clamp-2 min-h-[1.2em]" title={task.item_name}>
        {task.item_name}
      </div>

      {/* 3. 三合一數據行 (含中文標題 + 字體放大至 12px) */}
      <div className="flex items-center justify-between text-[12px] bg-black/20 p-1.5 rounded border border-slate-700/30">
        <div className="flex items-center gap-1" title="數量">
            <span className="text-slate-500 text-[11px] scale-90 origin-right">數量:</span>
            <span className="text-white font-mono font-bold">{task.quantity}</span>
        </div>
        
        <div className="flex items-center gap-1 border-l border-slate-700 pl-2" title="工時">
            <span className="text-slate-500 text-[11px] scale-90 origin-right">工時:</span>
            <span className="text-emerald-500 font-mono font-bold">{task.total_time_min}m</span>
        </div>

        <div className="flex items-center gap-1 border-l border-slate-700 pl-2" title="交付日期">
            <span className="text-slate-500 text-[11px] scale-90 origin-right">交期:</span>
            <span className="text-yellow-400 font-mono font-bold">{task.delivery_date?.slice(5) || '-'}</span>
        </div>
      </div>

      {/* 4. 客戶 & 品號 (左右對齊) */}
      <div className="flex justify-between items-center text-[9px] pt-0.5">
        <div className="text-slate-400 truncate max-w-[50%]" title={task.customer}>
            🏢 {task.customer}
        </div>
        <div className="text-slate-500 font-mono truncate max-w-[45%]" title={task.item_code}>
            {task.item_code}
        </div>
      </div>
    </div>
  )
}

// --- 4. 行事曆格子 ---
function DroppableDay({ date, tasks, title, isMachineSelected, isToday, dailyCapacity, onTaskDblClick }: { date: string, tasks: any[], title: string, isMachineSelected: boolean, isToday: boolean, dailyCapacity: number, onTaskDblClick: (task: any) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: date, disabled: !isMachineSelected })
  const usedMins = tasks.reduce((sum, t) => sum + t.total_time_min, 0)
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

// --- 5. 主框架元件 ---
export default function ProductionScheduler({ sectionId, sectionName }: { sectionId: string, sectionName: string }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDragItem, setActiveDragItem] = useState<any>(null)
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<any>(null)
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean, message: string, onConfirm: () => void } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: 'delivery_date' | 'item_code' | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' })

  const [currentStart, setCurrentStart] = useState(new Date())
  const [showWeekends, setShowWeekends] = useState(false)
  const [showNextWeek, setShowNextWeek] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }))

  // 🔥 邏輯：初始化時，將日期強制對齊到「本週一」
  useEffect(() => {
    const d = new Date();
    const day = d.getDay(); // 0(Sun) ~ 6(Sat)
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    setCurrentStart(new Date(d));
  }, [])

  // 🔥🔥🔥【關鍵修正】：雙重保險機台讀取邏輯 (不檢查 status，且有 fallback) 🔥🔥🔥
  useEffect(() => {
    const fetchMachines = async () => {
      // 1. 嘗試透過 section_id 讀取
      let { data, error } = await supabase
        .from('production_machines')
        .select('*')
        .eq('section_id', sectionId)
        // .eq('status', true) // 🔥 移除狀態檢查，確保全部顯示
        .order('id')

      // 2. 如果沒抓到，且有中文名稱，嘗試用名稱模糊搜尋 (Fallback)
      if ((!data || data.length === 0) && sectionName) {
        console.warn(`[Scheduler] 找不到 section_id=${sectionId}，嘗試名稱搜尋: ${sectionName}`)
        const { data: fallbackData } = await supabase
          .from('production_machines')
          .select('*')
          .ilike('name', `%${sectionName}%`) 
          // .eq('status', true) // 🔥 這裡也移除狀態檢查
          .order('id')
        
        if (fallbackData && fallbackData.length > 0) {
            data = fallbackData
        }
      }

      if (data && data.length > 0) {
        setMachines(data)
        // 避免重複重設，只有當 selectedMachineId 為空時才設預設值
        setSelectedMachineId(prev => prev ? prev : data![0].id)
      } else {
        setMachines([])
        setSelectedMachineId(null)
      }
    }
    
    if (sectionId) {
        fetchMachines()
    }
  }, [sectionId, sectionName])

  useEffect(() => { const fetchTasks = async () => { setLoading(true); const { data } = await supabase.from('station_time_summary').select('*').eq('assigned_section', sectionId); setTasks(data || []); setLoading(false) }; fetchTasks() }, [sectionId, selectedMachineId])

  const currentMachine = machines.find(m => m.id === selectedMachineId); const currentDailyCap = currentMachine?.daily_minutes || 480 
  
  // 🔥 邏輯：產生日期 (週一到週五)
  const generateDates = (startDate: Date, weeks: number) => { 
      const arr = []; 
      const start = new Date(startDate); 
      for (let i = 0; i < weeks * 7; i++) { 
          const d = new Date(start); 
          d.setDate(start.getDate() + i); 
          const dayOfWeek = d.getDay(); 
          // 0=Sun, 6=Sat. 若不顯示週末則跳過
          if (!showWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) continue; 
          arr.push(d.toISOString().split('T')[0]) 
      } 
      return arr 
  }
  
  const week1Dates = generateDates(currentStart, 1); 
  const week2Dates = generateDates(new Date(new Date(currentStart).setDate(currentStart.getDate() + 7)), 1)

  // 搜尋過濾
  const filteredTasks = tasks.filter(t => {
    if (t.scheduled_date) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
        (t.order_number || '').toLowerCase().includes(q) ||
        (t.customer || '').toLowerCase().includes(q) ||
        (t.item_name || '').toLowerCase().includes(q) ||
        (t.item_code || '').toLowerCase().includes(q)
    )
  })

  // 排序邏輯
  const sortedUnscheduledTasks = [...filteredTasks].sort((a, b) => {
    if (!sortConfig.key) return 0
    const valA = a[sortConfig.key] || ''
    const valB = b[sortConfig.key] || ''
    
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const handleSort = (key: 'delivery_date' | 'item_code') => {
    setSortConfig(current => {
        if (current.key === key) {
            return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        }
        return { key, direction: 'asc' }
    })
  }

  const getTasksForDate = (date: string) => {
    if (!selectedMachineId) return []
    return tasks.filter(t => t.scheduled_date === date && t.production_machine_id === selectedMachineId)
  }
  const todayStr = new Date().toISOString().split('T')[0]

  const executeUpdate = async (taskId: string, targetDate: string | null, machineId: number | null) => {
    setTasks(prev => prev.map(t => {
        if (t.id.toString() === taskId) {
            return { ...t, scheduled_date: targetDate, production_machine_id: machineId }
        }
        return t
    }))
    await supabase.from('station_time_summary').update({ 
        scheduled_date: targetDate, 
        production_machine_id: machineId 
    }).eq('id', taskId)
    setAlertConfig(null)
  }

  const handleDragEnd = async (event: any) => {
    const { active, over } = event
    setActiveDragItem(null)
    if (!over) return

    const taskId = active.id
    const targetDate = over.id as string
    const currentTask = active.data.current.task

    if (targetDate !== 'unscheduled' && !selectedMachineId) {
      alert('請先選擇機台！')
      return
    }

    const isReverting = targetDate === 'unscheduled'
    const newDate = isReverting ? null : targetDate
    const newMachineId = isReverting ? null : selectedMachineId

    if (isReverting) {
        executeUpdate(taskId, newDate, newMachineId)
        return
    }

    const { data: allStages } = await supabase
        .from('station_time_summary')
        .select('*')
        .eq('order_number', currentTask.order_number)
        .eq('item_code', currentTask.item_code)
        .eq('quantity', currentTask.quantity)
        .order('id', { ascending: true })

    if (!allStages) {
        executeUpdate(taskId, newDate, newMachineId)
        return
    }

    const currentIndex = allStages.findIndex((s: any) => s.id === currentTask.id)
    if (currentIndex === -1) {
        executeUpdate(taskId, newDate, newMachineId)
        return
    }

    let warningMsg = ""

    if (currentIndex > 0) {
        const prevTask = allStages[currentIndex - 1]
        if (!prevTask.scheduled_date) {
            warningMsg += `⚠️ 前一工序 [${prevTask.op_name}] 尚未排程！\n`
        } else {
            const prevDate = new Date(prevTask.scheduled_date)
            const currDate = new Date(targetDate)
            if (currDate <= prevDate) {
                warningMsg += `⚠️ 日期衝突：\n本工序日期 (${targetDate}) \n早於或等於 \n前工序 [${prevTask.op_name}] 日期 (${prevTask.scheduled_date})。\n規定需至少間隔一天。\n`
            }
        }
    }

    if (currentIndex < allStages.length - 1) {
        const nextTask = allStages[currentIndex + 1]
        if (nextTask.scheduled_date) {
            const nextDate = new Date(nextTask.scheduled_date)
            const currDate = new Date(targetDate)
            if (currDate >= nextDate) {
                warningMsg += `⚠️ 日期衝突：\n本工序日期 (${targetDate}) \n晚於或等於 \n後工序 [${nextTask.op_name}] 日期 (${nextTask.scheduled_date})。\n`
            }
        }
    }

    if (warningMsg) {
        setAlertConfig({
            isOpen: true,
            message: warningMsg,
            onConfirm: () => executeUpdate(taskId, newDate, newMachineId)
        })
    } else {
        executeUpdate(taskId, newDate, newMachineId)
    }
  }

  const handleDragStart = (event: any) => {
    setActiveDragItem(event.active.data.current.task)
  }

  const changeWeek = (offset: number) => { const newStart = new Date(currentStart); newStart.setDate(newStart.getDate() + (offset * 7)); setCurrentStart(newStart); setShowNextWeek(false) }
  
  // 🔥 邏輯：切換日期時，強制對齊週一
  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => { 
      const date = new Date(e.target.value); 
      if (!isNaN(date.getTime())) { 
          const day = date.getDay(); 
          const diff = date.getDate() - (day === 0 ? 6 : day - 1);
          date.setDate(diff);
          setCurrentStart(new Date(date)); 
          setShowNextWeek(false) 
      } 
  }
  
  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} sensors={sensors}>
      
      <TaskDetailModal task={selectedTaskDetail} onClose={() => setSelectedTaskDetail(null)} />
      
      <AlertModal 
        isOpen={!!alertConfig} 
        message={alertConfig?.message || ''} 
        onConfirm={alertConfig?.onConfirm || (() => {})} 
        onCancel={() => setAlertConfig(null)} 
      />

      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
        <div className="flex flex-col gap-3 mb-2 px-1">
            <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white whitespace-nowrap mr-2">{sectionName}</h2>
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1 border border-slate-700">
                        <button onClick={() => changeWeek(-1)} className="p-1 hover:text-cyan-400 text-slate-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                        <input type="date" value={currentStart.toISOString().split('T')[0]} onChange={handleDatePick} className="bg-transparent text-white text-sm font-bold border-none outline-none focus:ring-0 w-32 text-center"/>
                        <button onClick={() => changeWeek(1)} className="p-1 hover:text-cyan-400 text-slate-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                    </div>
                </div>
                <div className="flex items-center gap-3"><label className="flex items-center cursor-pointer gap-2"><div className="relative"><input type="checkbox" className="sr-only" checked={showWeekends} onChange={() => setShowWeekends(!showWeekends)} /><div className={`block w-10 h-6 rounded-full transition-colors ${showWeekends ? 'bg-cyan-600' : 'bg-slate-700'}`}></div><div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showWeekends ? 'transform translate-x-4' : ''}`}></div></div><span className="text-xs text-slate-400 font-bold">顯示週末</span></label></div>
            </div>
            
            <div className="flex flex-wrap gap-2 p-2 bg-slate-900/30 rounded-lg border border-slate-800">
                {machines.length === 0 ? (
                    <div className="text-slate-500 text-xs w-full text-center py-2">尚無可用機台，請檢查後台設定</div>
                ) : (
                    machines.map(machine => (
                        <button key={machine.id} onClick={() => setSelectedMachineId(machine.id)} className={`px-4 py-2 rounded border transition-all text-xs font-bold flex items-center gap-2 grow-0 ${selectedMachineId === machine.id ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
                            <span className={`w-2 h-2 rounded-full ${selectedMachineId === machine.id ? 'bg-white animate-pulse' : 'bg-slate-500'}`}></span>
                            {machine.name}
                        </button>
                    ))
                )}
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
            
            {/* 待排任務區塊 */}
            <div className="w-72 flex flex-col bg-slate-950 border border-slate-800 rounded-xl shadow-2xl">
                <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-2">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        待排任務 ({sortedUnscheduledTasks.length})
                    </h3>
                    
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="🔍 搜尋單號/客戶/品名..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/30 border border-slate-700 rounded text-xs text-slate-200 px-2 py-1.5 focus:outline-none focus:border-cyan-500 pl-2"
                        />
                    </div>

                    {/* 排序按鈕 */}
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleSort('delivery_date')}
                            className={`flex-1 text-[10px] py-1 rounded border transition-colors flex items-center justify-center gap-1 ${sortConfig.key === 'delivery_date' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}
                        >
                            依交期 {sortConfig.key === 'delivery_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </button>
                        <button 
                            onClick={() => handleSort('item_code')}
                            className={`flex-1 text-[10px] py-1 rounded border transition-colors flex items-center justify-center gap-1 ${sortConfig.key === 'item_code' ? 'bg-purple-900/30 text-purple-400 border-purple-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}
                        >
                            依品號 {sortConfig.key === 'item_code' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </button>
                    </div>
                </div>
                
                <div ref={useDroppable({ id: 'unscheduled' }).setNodeRef} className={`flex-1 p-2 transition-colors ${useDroppable({ id: 'unscheduled' }).isOver ? 'bg-red-900/10' : ''} ${sortedUnscheduledTasks.length > 0 ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`}>
                    {sortedUnscheduledTasks.length === 0 ? (
                        <div className="text-center text-slate-600 mt-10 text-xs"><p>{searchQuery ? '無搜尋結果' : '無待排任務'}</p></div>
                    ) : (
                        sortedUnscheduledTasks.map(task => <DraggableTask key={task.id} task={task} onTaskDblClick={setSelectedTaskDetail} />)
                    )}
                </div>
            </div>
        </div>
      </div>
      <DragOverlay>{activeDragItem ? <DraggableTask task={activeDragItem} isOverlay /> : null}</DragOverlay>
    </DndContext>
  )
}

function UnscheduledDroppable({ tasks, onTaskDblClick }: { tasks: any[], onTaskDblClick: (t: any) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled' })
  return (
    <div ref={setNodeRef} className={`flex-1 p-2 transition-colors ${isOver ? 'bg-red-900/10' : ''} ${tasks.length > 0 ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`}>
      {tasks.length === 0 ? <div className="text-center text-slate-600 mt-10 text-xs"><p>無待排任務</p></div> : tasks.map(task => <DraggableTask key={task.id} task={task} onTaskDblClick={onTaskDblClick} />)}
    </div>
  )
}