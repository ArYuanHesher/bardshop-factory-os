'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DndContext, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

// --- 1. 小元件：可拖曳的任務卡片 ---
function DraggableTask({ task, isOverlay = false }: { task: any, isOverlay?: boolean }) {
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
      className={`
        p-2 mb-2 rounded border shadow-sm cursor-grab active:cursor-grabbing text-xs select-none relative group
        ${isOverlay 
          ? 'bg-cyan-900 border-cyan-500 scale-105 z-50 shadow-2xl ring-2 ring-cyan-400 w-48' 
          : 'bg-slate-800 border-slate-700 hover:border-cyan-500/50 hover:bg-slate-700'
        }
      `}
    >
      <div className="flex justify-between items-start mb-0.5">
        <span className="font-mono text-cyan-400 font-bold text-[10px]">{task.order_number}</span>
        <span className="text-[9px] bg-slate-900 px-1 rounded text-slate-400">{task.total_time_min}m</span>
      </div>
      <div className="text-white font-bold truncate text-[11px] mb-0.5">{task.op_name}</div>
      <div className="text-slate-400 truncate text-[9px]">{task.item_name}</div>
    </div>
  )
}

// --- 2. 小元件：行事曆格子 (UI 重點優化) ---
function DroppableDay({ 
  date, 
  tasks, 
  title, 
  isMachineSelected, 
  isToday, 
  dailyCapacity 
}: { 
  date: string, 
  tasks: any[], 
  title: string, 
  isMachineSelected: boolean, 
  isToday: boolean,
  dailyCapacity: number // 機台每日產能
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: date, 
    disabled: !isMachineSelected 
  })

  // 計算數據 (分鐘)
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
      {/* 標頭：日期顯示優化 */}
      <div className={`
        p-2 border-b border-slate-700/50 sticky top-0 z-10 backdrop-blur-sm
        ${isToday ? 'bg-cyan-950/40 border-cyan-500/30' : 'bg-slate-900/90'}
      `}>
        {/* 日期大標題 */}
        <div className="flex flex-col items-center mb-1">
          <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-cyan-400' : 'text-slate-400'}`}>{title}</span>
          <span className={`text-lg font-black font-mono ${isToday ? 'text-white' : 'text-slate-200'}`}>{date.slice(5)}</span>
        </div>

        {/* 產能儀表板 (分鐘制) */}
        <div className="bg-black/20 rounded p-1.5 space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400 font-mono border-b border-slate-700/50 pb-1">
             <span>日產能:</span>
             <span>{dailyCapacity}</span>
          </div>
          <div className="flex justify-between text-[10px] text-cyan-400 font-mono">
             <span>已排:</span>
             <span>{usedMins}</span>
          </div>
          <div className={`flex justify-between text-[10px] font-bold font-mono ${isOverloaded ? 'text-red-400' : 'text-emerald-400'}`}>
             <span>剩餘:</span>
             <span>{remainingMins}</span>
          </div>
        </div>
      </div>

      {/* 任務列表區 (高度限制 + 提示) */}
      {/* h-[320px] 約為 5.5 張卡片的高度 */}
      <div className="relative flex-1 group/container">
        <div className="p-2 overflow-y-auto custom-scrollbar h-[320px] min-h-[320px] pb-6">
          {tasks.map(task => (
            <DraggableTask key={task.id} task={task} />
          ))}
          
          {tasks.length === 0 && (
            <div className="h-full flex items-center justify-center text-slate-700 text-[10px] italic opacity-50 border-2 border-dashed border-slate-800/50 rounded m-1">
              {isMachineSelected ? '+' : '停止'}
            </div>
          )}
        </div>

        {/* 底部提示 (如果超過 5 筆才顯示) */}
        {tasks.length > 5 && (
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black to-transparent pointer-events-none flex justify-center items-end pb-1">
                <span className="text-[9px] text-cyan-400 bg-black/60 px-2 rounded-full border border-cyan-900/50 backdrop-blur-md">
                   ⬇️ 還有 {tasks.length - 5} 筆...
                </span>
            </div>
        )}
      </div>
    </div>
  )
}

// --- 3. 主框架元件 ---
export default function ProductionScheduler({ sectionId, sectionName }: { sectionId: string, sectionName: string }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [activeDragItem, setActiveDragItem] = useState<any>(null)

  // 日期與顯示控制
  const [currentStart, setCurrentStart] = useState(new Date())
  const [showWeekends, setShowWeekends] = useState(false)

  useEffect(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    setCurrentStart(new Date(d))
  }, [])

  // 1. 讀取機台
  useEffect(() => {
    const fetchMachines = async () => {
      const { data } = await supabase
        .from('production_machines') 
        .select('*')
        .eq('section_id', sectionId)
        .order('id')
      
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

  // 2. 讀取任務
  useEffect(() => {
    fetchTasks()
  }, [sectionId, selectedMachineId])

  const fetchTasks = async () => {
    setLoading(true)
    let query = supabase
      .from('station_time_summary')
      .select('*')
      .eq('assigned_section', sectionId)

    const { data, error } = await query
    if (error) console.error(error)
    else setTasks(data || [])
    setLoading(false)
  }

  // 取得目前選中機台的每日產能
  const currentMachine = machines.find(m => m.id === selectedMachineId)
  const currentDailyCap = currentMachine?.daily_minutes || 480 // 預設 480 分鐘

  const generateDates = (startDate: Date, weeks: number) => {
    const arr = []
    const start = new Date(startDate)
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const dayOfWeek = d.getDay()
      if (!showWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
        continue
      }
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
  }

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value)
    if (!isNaN(date.getTime())) {
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1)
      date.setDate(diff)
      setCurrentStart(new Date(date))
    }
  }

  const unscheduledTasks = tasks.filter(t => !t.scheduled_date)
  const getTasksForDate = (date: string) => {
    if (!selectedMachineId) return []
    return tasks.filter(t => t.scheduled_date === date && t.production_machine_id === selectedMachineId)
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
        
        {/* === Header 區塊 === */}
        <div className="flex flex-col gap-3 mb-2 px-1">
            
            {/* 1. 上方控制列 (日期與顯示) */}
            <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white whitespace-nowrap mr-2">{sectionName}</h2>
                    {/* 日期導航 */}
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1 border border-slate-700">
                        <button onClick={() => changeWeek(-1)} className="p-1 hover:text-cyan-400 text-slate-400 transition-colors">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <input 
                          type="date" 
                          value={currentStart.toISOString().split('T')[0]}
                          onChange={handleDatePick}
                          className="bg-transparent text-white text-sm font-bold border-none outline-none focus:ring-0 w-32 text-center"
                        />
                        <button onClick={() => changeWeek(1)} className="p-1 hover:text-cyan-400 text-slate-400 transition-colors">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                   {/* 顯示週末開關 */}
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

            {/* 2. 機台選擇區 (自動換行) */}
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
            </div>
        </div>

        {/* === Main Content === */}
        <div className="flex flex-1 gap-4 overflow-hidden">
            
            {/* 左側：行事曆主區 (垂直滾動，包含兩週) */}
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 pb-4 custom-scrollbar">
                
                {/* 第一週 Row */}
                <div className="flex flex-col bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl shrink-0">
                    <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex justify-between">
                       <span className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                         <span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>
                         CURRENT WEEK (本週)
                       </span>
                    </div>
                    <div className="flex divide-x divide-slate-800 overflow-x-auto">
                        {week1Dates.map((date) => (
                          <DroppableDay 
                              key={date} 
                              date={date} 
                              tasks={getTasksForDate(date)} 
                              title={new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                              isMachineSelected={!!selectedMachineId}
                              isToday={date === todayStr}
                              dailyCapacity={currentDailyCap}
                          />
                        ))}
                    </div>
                </div>

                {/* 第二週 Row */}
                <div className="flex flex-col bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl shrink-0">
                    <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-800 flex justify-between">
                       <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                         <span className="w-1.5 h-4 bg-slate-600 rounded-full"></span>
                         NEXT WEEK (下週)
                       </span>
                    </div>
                    <div className="flex divide-x divide-slate-800 overflow-x-auto">
                        {week2Dates.map((date) => (
                          <DroppableDay 
                              key={date} 
                              date={date} 
                              tasks={getTasksForDate(date)} 
                              title={new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                              isMachineSelected={!!selectedMachineId}
                              isToday={date === todayStr}
                              dailyCapacity={currentDailyCap}
                          />
                        ))}
                    </div>
                </div>

            </div>

            {/* 右側：待排任務箱 */}
            <div className="w-72 flex flex-col bg-slate-950 border border-slate-800 rounded-xl shadow-2xl">
                <div className="p-3 border-b border-slate-800 bg-slate-900/50">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        待排任務 ({unscheduledTasks.length})
                    </h3>
                </div>
                <UnscheduledDroppable tasks={unscheduledTasks} />
            </div>

        </div>
      </div>

      <DragOverlay>
        {activeDragItem ? <DraggableTask task={activeDragItem} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function UnscheduledDroppable({ tasks }: { tasks: any[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unscheduled',
  })

  return (
    <div 
      ref={setNodeRef} 
      className={`flex-1 p-2 overflow-y-auto custom-scrollbar transition-colors ${isOver ? 'bg-red-900/10' : ''}`}
    >
      {tasks.length === 0 ? (
        <div className="text-center text-slate-600 mt-10 text-xs">
            <p>無待排任務</p>
        </div>
      ) : (
        tasks.map(task => <DraggableTask key={task.id} task={task} />)
      )}
    </div>
  )
}