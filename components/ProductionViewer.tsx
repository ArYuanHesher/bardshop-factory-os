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

// --- 🔥 1. 詳細資料彈窗 (新增工序流程表) ---
function TaskDetailModal({ task, onClose }: { task: any, onClose: () => void }) {
  const [orderStages, setOrderStages] = useState<any[]>([])
  const [isLoadingStages, setIsLoadingStages] = useState(false)

  // 當彈窗開啟時，抓取該訂單的所有工序
  useEffect(() => {
    if (task?.order_number) {
      const fetchStages = async () => {
        setIsLoadingStages(true)
        // 抓取相同訂單號的所有資料，並嘗試關聯機台名稱 (如果有設定 foreign key)
        // 這裡假設 production_machines 有設定關聯，若無則只顯示 ID
        const { data, error } = await supabase
          .from('station_time_summary')
          .select(`
            *,
            production_machines ( name )
          `)
          .eq('order_number', task.order_number)
          .order('id', { ascending: true }) // 依 ID 或自訂的順序欄位排序

        if (!error && data) {
          setOrderStages(data)
        }
        setIsLoadingStages(false)
      }
      fetchStages()
    }
  }, [task])

  if (!task) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()} 
      >
        {/* Header */}
        <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-3">
                <h2 className="text-3xl font-black text-white tracking-wide font-mono">{task.order_number}</h2>
                <span className="px-2 py-1 rounded text-xs font-bold bg-slate-800 text-slate-300 border border-slate-600">
                    {task.doc_type || '工單'}
                </span>
            </div>
            <div className="flex gap-2 mt-2">
              <span className="text-xs font-bold text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded border border-cyan-500/30">
                當前工序: {task.op_name}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Body (左右佈局：左邊詳細資料，右邊工序表) */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            
            {/* 左側：詳細資訊 (可捲動) */}
            <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar border-r border-slate-800">
                {/* 1. 核心資訊 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 space-y-3">
                        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 border-b border-blue-500/20 pb-1">產品資訊</h3>
                        <div className="flex justify-between"><span className="text-slate-500 text-xs">品名</span><span className="text-slate-200 text-sm font-bold text-right">{task.item_name}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500 text-xs">數量</span><span className="text-white text-lg font-mono font-bold">{task.quantity}</span></div>
                    </div>
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 space-y-3">
                        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 border-b border-emerald-500/20 pb-1">生產需求</h3>
                        <div className="flex justify-between"><span className="text-slate-500 text-xs">交付日</span><span className="text-yellow-400 text-sm font-bold font-mono">{task.delivery_date}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500 text-xs">工時</span><span className="text-emerald-400 text-lg font-mono font-bold">{task.total_time_min} m</span></div>
                    </div>
                </div>

                {/* 2. 美編規格 */}
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                        <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
                        <h3 className="text-xs font-bold text-slate-300">美編規格 (Specs)</h3>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-4 text-xs">
                        <div><span className="text-slate-500 block">尺寸</span><span className="text-slate-300">{task.open_size || '-'}</span></div>
                        <div><span className="text-slate-500 block">材質</span><span className="text-slate-300">{task.material || '-'}</span></div>
                        <div><span className="text-slate-500 block">加工</span><span className="text-slate-300">{task.processing || '-'}</span></div>
                        <div><span className="text-slate-500 block">備註</span><span className="text-slate-300">{task.other_spec || '-'}</span></div>
                    </div>
                </div>
            </div>

            {/* 右側：全工序生產進度表 (Timeline) */}
            <div className="w-full lg:w-[400px] bg-[#0a101a] flex flex-col border-l border-slate-800">
                <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        生產全工序進度
                    </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {isLoadingStages ? (
                        <div className="text-center text-slate-500 text-xs py-10">載入工序中...</div>
                    ) : (
                        <div className="relative border-l-2 border-slate-800 ml-3 space-y-6">
                            {orderStages.map((stage, index) => {
                                const isCurrent = stage.id === task.id
                                const isScheduled = !!stage.scheduled_date
                                // 嘗試取得關聯的機台名稱，若無則顯示 ID
                                const machineName = stage.production_machines?.name || (stage.production_machine_id ? `機台 #${stage.production_machine_id}` : '未指定')

                                return (
                                    <div key={stage.id} className={`relative pl-6 ${isCurrent ? 'opacity-100' : 'opacity-70 hover:opacity-100'} transition-opacity`}>
                                        {/* 圓點節點 */}
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${
                                            isCurrent ? 'bg-cyan-500 border-cyan-300 shadow-[0_0_10px_cyan]' : 
                                            isScheduled ? 'bg-slate-900 border-emerald-500' : 'bg-slate-900 border-slate-600'
                                        }`}></div>

                                        {/* 卡片內容 */}
                                        <div className={`p-3 rounded-lg border ${
                                            isCurrent ? 'bg-cyan-900/10 border-cyan-500/50' : 'bg-slate-900 border-slate-800'
                                        }`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-sm font-bold ${isCurrent ? 'text-cyan-400' : 'text-slate-300'}`}>
                                                    {stage.op_name}
                                                </span>
                                                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">
                                                    {stage.assigned_section || '待分派'}
                                                </span>
                                            </div>
                                            
                                            {isScheduled ? (
                                                <div className="mt-2 space-y-1">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-slate-500">日期:</span>
                                                        <span className="text-emerald-400 font-mono font-bold">{stage.scheduled_date}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-slate-500">機台:</span>
                                                        <span className="text-slate-300">{machineName}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-yellow-500/80 bg-yellow-900/10 px-2 py-1 rounded border border-yellow-500/20 w-fit">
                                                    <span className="animate-pulse">●</span> 尚未排程
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">關閉</button>
        </div>
      </div>
    </div>
  )
}

// --- 2. 可拖曳卡片 (雙擊) ---
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
        p-2 mb-2 rounded border shadow-sm cursor-grab active:cursor-grabbing text-xs select-none relative group transition-all
        ${isOverlay 
          ? 'bg-cyan-900 border-cyan-500 scale-105 z-50 shadow-2xl ring-2 ring-cyan-400 w-48' 
          : 'bg-slate-800 border-slate-700 hover:border-cyan-500/50 hover:bg-slate-700 hover:shadow-md'
        }
      `}
    >
      <div className="flex justify-between items-start mb-0.5 pointer-events-none">
        <span className="font-mono text-cyan-400 font-bold text-[10px]">{task.order_number}</span>
        <span className="text-[9px] bg-slate-900 px-1 rounded text-slate-400">{task.total_time_min}m</span>
      </div>
      <div className="text-white font-bold truncate text-[11px] mb-0.5 pointer-events-none">{task.op_name}</div>
      <div className="text-slate-400 truncate text-[9px] pointer-events-none">{task.item_name}</div>
    </div>
  )
}

// --- 3. 行事曆格子 ---
function DroppableDay({ 
  date, 
  tasks, 
  title, 
  isMachineSelected, 
  isToday, 
  dailyCapacity,
  onTaskDblClick 
}: { 
  date: string, 
  tasks: any[], 
  title: string, 
  isMachineSelected: boolean, 
  isToday: boolean,
  dailyCapacity: number,
  onTaskDblClick: (task: any) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: date, 
    disabled: !isMachineSelected 
  })

  const usedMins = tasks.reduce((sum, t) => sum + t.total_time_min, 0)
  const remainingMins = dailyCapacity - usedMins
  const isOverloaded = remainingMins < 0

  return (
    <div 
      ref={setNodeRef}
      className={`
        flex-1 min-w-[160px] border-r border-slate-700/50 flex flex-col transition-colors relative
        ${isOver ? 'bg-cyan-900/20 shadow-[inset_0_0_20px_rgba(6,182,212,0.2)]' : 'bg-transparent'}
        ${!isMachineSelected ? 'bg-slate-950/50 cursor-not-allowed' : ''}
        ${isToday ? 'bg-slate-800/30' : ''}
      `}
    >
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

      <div className="relative flex-1 group/container">
        <div className="p-2 overflow-y-auto custom-scrollbar h-[500px] min-h-[500px] pb-6">
          {tasks.map(task => (
            <DraggableTask key={task.id} task={task} onTaskDblClick={onTaskDblClick} />
          ))}
          {tasks.length === 0 && (
            <div className="h-full flex items-center justify-center text-slate-700 text-[10px] italic opacity-50 border-2 border-dashed border-slate-800/50 rounded m-1">
              {isMachineSelected ? '+' : '停止'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- 4. 主框架元件 ---
export default function ProductionScheduler({ sectionId, sectionName }: { sectionId: string, sectionName: string }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [activeDragItem, setActiveDragItem] = useState<any>(null)
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<any>(null)

  const [currentStart, setCurrentStart] = useState(new Date())
  const [showWeekends, setShowWeekends] = useState(false)
  const [showNextWeek, setShowNextWeek] = useState(false)

  // Sensors 設定
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  useEffect(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    setCurrentStart(new Date(d))
  }, [])

  useEffect(() => {
    const fetchMachines = async () => {
      const { data } = await supabase.from('production_machines').select('*').eq('section_id', sectionId).order('id')
      if (data && data.length > 0) {
        setMachines(data)
        setSelectedMachineId(data[0].id)
      } else {
        setMachines([])
        setSelectedMachineId(null)
      }
    }
    fetchMachines()
  }, [sectionId])

  useEffect(() => {
    fetchTasks()
  }, [sectionId, selectedMachineId])

  const fetchTasks = async () => {
    setLoading(true)
    let query = supabase.from('station_time_summary').select('*').eq('assigned_section', sectionId)
    const { data, error } = await query
    if (error) console.error(error)
    else setTasks(data || [])
    setLoading(false)
  }

  const currentMachine = machines.find(m => m.id === selectedMachineId)
  const currentDailyCap = currentMachine?.daily_minutes || 480 

  const generateDates = (startDate: Date, weeks: number) => {
    const arr = []
    const start = new Date(startDate)
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const dayOfWeek = d.getDay()
      if (!showWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) continue
      arr.push(d.toISOString().split('T')[0])
    }
    return arr
  }

  const allDates = generateDates(currentStart, 2)
  const daysPerWeek = showWeekends ? 7 : 5
  const week1Dates = allDates.slice(0, daysPerWeek)
  const week2Dates = allDates.slice(daysPerWeek, daysPerWeek * 2)

  const handleDragEnd = async (event: any) => {
    const { active, over } = event
    setActiveDragItem(null)
    if (!over) return

    const taskId = active.id
    const targetDate = over.id 

    if (targetDate !== 'unscheduled' && !selectedMachineId) {
      alert('請先選擇機台！')
      return
    }

    const isReverting = targetDate === 'unscheduled'

    setTasks(prev => prev.map(t => {
      if (t.id.toString() === taskId) {
        return { 
          ...t, 
          scheduled_date: isReverting ? null : targetDate,
          production_machine_id: isReverting ? null : selectedMachineId 
        }
      }
      return t
    }))

    const updatePayload = { 
      scheduled_date: isReverting ? null : targetDate,
      production_machine_id: isReverting ? null : selectedMachineId
    }
    await supabase.from('station_time_summary').update(updatePayload).eq('id', taskId)
  }

  const handleDragStart = (event: any) => {
    setActiveDragItem(event.active.data.current.task)
  }

  const changeWeek = (offset: number) => {
    const newStart = new Date(currentStart)
    newStart.setDate(newStart.getDate() + (offset * 7))
    setCurrentStart(newStart)
    setShowNextWeek(false)
  }

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value)
    if (!isNaN(date.getTime())) {
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1) 
      date.setDate(diff)
      setCurrentStart(new Date(date))
      setShowNextWeek(false)
    }
  }

  const unscheduledTasks = tasks.filter(t => !t.scheduled_date)
  const getTasksForDate = (date: string) => {
    if (!selectedMachineId) return []
    return tasks.filter(t => t.scheduled_date === date && t.production_machine_id === selectedMachineId)
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} sensors={sensors}>
      
      <TaskDetailModal task={selectedTaskDetail} onClose={() => setSelectedTaskDetail(null)} />

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
                <div className="flex items-center gap-3">
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
                {machines.map(machine => (
                    <button key={machine.id} onClick={() => setSelectedMachineId(machine.id)} className={`px-4 py-2 rounded border transition-all text-xs font-bold flex items-center gap-2 grow-0 ${selectedMachineId === machine.id ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
                        <span className={`w-2 h-2 rounded-full ${selectedMachineId === machine.id ? 'bg-white animate-pulse' : 'bg-slate-500'}`}></span>
                        {machine.name}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 pb-4 custom-scrollbar">
                <div className="flex flex-col bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl shrink-0">
                    <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex justify-between">
                       <span className="text-xs font-bold text-cyan-400 flex items-center gap-2"><span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>CURRENT WEEK (本週)</span>
                    </div>
                    <div className="flex divide-x divide-slate-800 overflow-x-auto">
                        {week1Dates.map((date) => (
                          <DroppableDay key={date} date={date} tasks={getTasksForDate(date)} title={new Date(date).toLocaleDateString('en-US', { weekday: 'short' })} isMachineSelected={!!selectedMachineId} isToday={date === todayStr} dailyCapacity={currentDailyCap} onTaskDblClick={setSelectedTaskDetail} />
                        ))}
                    </div>
                </div>

                {showNextWeek ? (
                    <div className="flex flex-col bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl shrink-0 animate-fade-in">
                        <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex justify-between">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-2"><span className="w-1.5 h-4 bg-slate-600 rounded-full"></span>NEXT WEEK (下週)</span>
                        <button onClick={() => setShowNextWeek(false)} className="text-[10px] text-slate-500 hover:text-white">隱藏</button>
                        </div>
                        <div className="flex divide-x divide-slate-800 overflow-x-auto">
                            {week2Dates.map((date) => (
                            <DroppableDay key={date} date={date} tasks={getTasksForDate(date)} title={new Date(date).toLocaleDateString('en-US', { weekday: 'short' })} isMachineSelected={!!selectedMachineId} isToday={date === todayStr} dailyCapacity={currentDailyCap} onTaskDblClick={setSelectedTaskDetail} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setShowNextWeek(true)} className="w-full py-3 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all text-xs font-mono flex items-center justify-center gap-2"><span>⬇️ 載入下週排程 (Show Next Week)</span></button>
                )}
            </div>

            <div className="w-72 flex flex-col bg-slate-950 border border-slate-800 rounded-xl shadow-2xl">
                <div className="p-3 border-b border-slate-800 bg-slate-900/50">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        待排任務 ({unscheduledTasks.length})
                    </h3>
                </div>
                <UnscheduledDroppable tasks={unscheduledTasks} onTaskDblClick={setSelectedTaskDetail} />
            </div>
        </div>
      </div>

      <DragOverlay>
        {activeDragItem ? <DraggableTask task={activeDragItem} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function UnscheduledDroppable({ tasks, onTaskDblClick }: { tasks: any[], onTaskDblClick: (t: any) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled' })
  return (
    <div ref={setNodeRef} className={`flex-1 p-2 overflow-y-auto custom-scrollbar transition-colors ${isOver ? 'bg-red-900/10' : ''}`}>
      {tasks.length === 0 ? <div className="text-center text-slate-600 mt-10 text-xs"><p>無待排任務</p></div> : tasks.map(task => <DraggableTask key={task.id} task={task} onTaskDblClick={onTaskDblClick} />)}
    </div>
  )
}