'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link' // 🔥 新增 Link 引入
import { supabase } from '../lib/supabaseClient'

// --- 1. 純顯示的任務卡片 (無拖拉功能) ---
function TaskCard({ task }: { task: any }) {
  return (
    <div className="p-2 mb-2 rounded border shadow-sm bg-slate-800 border-slate-700 text-xs select-none relative group hover:border-cyan-500/30 transition-colors">
      <div className="flex justify-between items-start mb-0.5">
        <span className="font-mono text-cyan-400 font-bold text-[10px]">{task.order_number}</span>
        <span className="text-[9px] bg-slate-900 px-1 rounded text-slate-400">{task.total_time_min}m</span>
      </div>
      <div className="text-white font-bold truncate text-[11px] mb-0.5">{task.op_name}</div>
      <div className="text-slate-400 truncate text-[9px]">{task.item_name}</div>
    </div>
  )
}

// --- 2. 純顯示的行事曆格子 ---
function DayColumn({ 
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
  dailyCapacity: number 
}) {
  const usedMins = tasks.reduce((sum, t) => sum + t.total_time_min, 0)
  const remainingMins = dailyCapacity - usedMins
  const isOverloaded = remainingMins < 0

  return (
    <div className={`
        flex-1 min-w-[160px] border-r border-slate-700/50 flex flex-col transition-colors relative
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

      {/* 任務列表區 (純顯示) */}
      <div className="p-2 overflow-y-auto custom-scrollbar h-[500px] min-h-[500px] pb-6">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-700 text-[10px] italic opacity-50">
             - 空閒 -
          </div>
        )}
      </div>

      {/* 底部提示 */}
      {tasks.length > 8 && (
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black to-transparent pointer-events-none flex justify-center items-end pb-1">
            <span className="text-[9px] text-cyan-400 bg-black/60 px-2 rounded-full border border-cyan-900/50 backdrop-blur-md">
                ⬇️ 還有 {tasks.length - 8} 筆...
            </span>
        </div>
      )}
    </div>
  )
}

// --- 3. 主框架 (唯讀版) ---
export default function ProductionViewer({ sectionId, sectionName }: { sectionId: string, sectionName: string }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // 日期控制
  const [currentStart, setCurrentStart] = useState(new Date())
  const [showWeekends, setShowWeekends] = useState(false)
  const [showNextWeek, setShowNextWeek] = useState(false)

  // 自動重整
  useEffect(() => {
    const interval = setInterval(() => {
        fetchTasks()
    }, 60000) // 60秒自動更新
    return () => clearInterval(interval)
  }, [sectionId, selectedMachineId])

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

  const changeWeek = (offset: number) => {
    const newStart = new Date(currentStart)
    newStart.setDate(newStart.getDate() + (offset * 7))
    setCurrentStart(newStart)
    setShowNextWeek(false)
  }

  const getTasksForDate = (date: string) => {
    if (!selectedMachineId) return []
    return tasks.filter(t => t.scheduled_date === date && t.production_machine_id === selectedMachineId)
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col gap-3 mb-2 px-1">
            <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-orange-600 text-white px-2 py-1 rounded">唯讀模式</span>
                    <h2 className="text-xl font-bold text-white whitespace-nowrap mr-2">{sectionName} 看板</h2>
                    
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

                    {/* 🔥 新增：返回首頁按鈕 */}
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
                    {/* Auto Refresh Indicator */}
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
            </div>
        </div>

        {/* Content - 只有左側行事曆，移除右側待排區 */}
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