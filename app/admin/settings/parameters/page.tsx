'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'

// --- 型別定義 ---
interface Machine {
  id: number
  name: string
  category: string      // 新增：大分類
  station_type: string  // 實際站點 (對應工序表)
  daily_minutes: number
  is_active: boolean
}

interface CalendarOverride {
  date: string
  is_holiday: boolean
  note: string
}

// --- 🔥 核心設定：大分類與站點對照表 (依據工序總表) ---
const STATION_MAPPING: Record<string, string[]> = {
  '印刷': ['印刷站2F', '印刷站6F'],
  '雷切': ['雷切站'],
  '後加工': ['後加工站'],
  '包裝': ['包裝站'],
  '委外': ['轉運站'], // 轉運站通常包含委外進出貨時間
  '常平': ['印刷站(常平)', '雷切站(常平)', '後加工站(常平)', '包裝站(常平)'] // 預設常平也有這些分站
}

const CATEGORIES = Object.keys(STATION_MAPPING)

export default function ParametersPage() {
  const [activeTab, setActiveTab] = useState<'machines' | 'calendar'>('machines')

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto text-slate-300 min-h-screen space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">產程參數設定</h1>
          <p className="text-orange-500 mt-1 font-mono text-sm uppercase">
            SYSTEM CONFIGURATION // 機台產能與行事曆
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('machines')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'machines' ? 'border-orange-500 text-orange-400 bg-orange-950/20' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          機台與產能設定
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'calendar' ? 'border-orange-500 text-orange-400 bg-orange-950/20' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          廠區行事曆
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 min-h-[500px]">
        {activeTab === 'machines' ? <MachinesManager /> : <FactoryCalendar />}
      </div>
    </div>
  )
}

// ============================================================================
// 子組件 1: 機台管理器 (已更新分類邏輯)
// ============================================================================
function MachinesManager() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(false)
  
  // 新增表單狀態
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]) // 預設第一個大分類
  const [newStation, setNewStation] = useState(STATION_MAPPING[CATEGORIES[0]][0]) // 預設該分類的第一個站點
  const [newMins, setNewMins] = useState(480)

  // 當大分類改變時，自動切換對應的第一個站點
  useEffect(() => {
    setNewStation(STATION_MAPPING[newCategory][0] || '')
  }, [newCategory])

  useEffect(() => {
    fetchMachines()
  }, [])

  const fetchMachines = async () => {
    setLoading(true)
    const { data } = await supabase.from('production_machines').select('*').order('category').order('station_type')
    if (data) setMachines(data)
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!newName) return alert('請輸入機台名稱')
    const { error } = await supabase.from('production_machines').insert({
      name: newName,
      category: newCategory,
      station_type: newStation,
      daily_minutes: newMins,
      is_active: true
    })
    if (error) alert(error.message)
    else {
      setNewName('')
      // 不重置分類，方便連續新增
      fetchMachines()
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除此機台嗎？')) return
    await supabase.from('production_machines').delete().eq('id', id)
    fetchMachines()
  }

  const handleUpdate = async (id: number, field: keyof Machine, value: any) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
    await supabase.from('production_machines').update({ [field]: value }).eq('id', id)
  }

  return (
    <div className="space-y-8">
      {/* 新增區塊 */}
      <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-xl">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          新增機台設備
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          {/* 1. 大分類選擇 */}
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500 mb-1 block">大分類 (Category)</label>
            <select 
              value={newCategory} 
              onChange={e => setNewCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-sm focus:border-orange-500 outline-none text-white"
            >
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* 2. 歸屬站點選擇 (連動) */}
          <div className="md:col-span-3">
            <label className="text-xs text-slate-500 mb-1 block">歸屬站點 (Station)</label>
            <select 
              value={newStation} 
              onChange={e => setNewStation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-sm focus:border-orange-500 outline-none text-white"
            >
              {STATION_MAPPING[newCategory]?.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>

          {/* 3. 機台名稱 */}
          <div className="md:col-span-4">
            <label className="text-xs text-slate-500 mb-1 block">機台名稱 (Machine Name)</label>
            <input 
              type="text" 
              placeholder="例如: UV直噴機-A" 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-sm focus:border-orange-500 outline-none text-white placeholder-slate-600"
            />
          </div>

          {/* 4. 每日工時 */}
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500 mb-1 block">每日工時 (分)</label>
            <input 
              type="number" 
              value={newMins} 
              onChange={e => setNewMins(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-sm focus:border-orange-500 outline-none text-white"
            />
          </div>

          {/* 按鈕 */}
          <div className="md:col-span-1">
            <button onClick={handleAdd} className="w-full h-[42px] bg-orange-600 hover:bg-orange-500 text-white rounded font-bold transition-colors flex items-center justify-center">
              新增
            </button>
          </div>
        </div>
      </div>

      {/* 列表區塊 */}
      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/30">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="text-slate-400 bg-slate-950 uppercase text-xs tracking-wider">
            <tr>
              <th className="p-4 border-b border-slate-800">大分類</th>
              <th className="p-4 border-b border-slate-800">歸屬站點 (對應工序表)</th>
              <th className="p-4 border-b border-slate-800">機台名稱</th>
              <th className="p-4 border-b border-slate-800 text-right">每日工時</th>
              <th className="p-4 border-b border-slate-800 text-center">狀態</th>
              <th className="p-4 border-b border-slate-800 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {machines.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-600">目前沒有機台資料，請新增。</td></tr>
            ) : machines.map(m => (
              <tr key={m.id} className="hover:bg-slate-800/50 group transition-colors">
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold border ${
                    m.category === '印刷' ? 'border-blue-500/50 text-blue-400 bg-blue-900/10' :
                    m.category === '雷切' ? 'border-red-500/50 text-red-400 bg-red-900/10' :
                    m.category === '常平' ? 'border-purple-500/50 text-purple-400 bg-purple-900/10' :
                    'border-slate-600 text-slate-400 bg-slate-800/30'
                  }`}>
                    {m.category}
                  </span>
                </td>
                <td className="p-4 text-slate-300 font-mono">
                  {m.station_type}
                </td>
                <td className="p-4">
                  <input 
                    type="text" 
                    value={m.name} 
                    onChange={(e) => handleUpdate(m.id, 'name', e.target.value)}
                    className="bg-transparent border-b border-transparent focus:border-orange-500 outline-none w-full text-white font-bold"
                  />
                </td>
                <td className="p-4 text-right font-mono">
                  <input 
                    type="number" 
                    value={m.daily_minutes} 
                    onChange={(e) => handleUpdate(m.id, 'daily_minutes', Number(e.target.value))}
                    className="bg-transparent border-b border-transparent focus:border-orange-500 outline-none w-20 text-right text-emerald-400 font-bold"
                  />
                </td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => handleUpdate(m.id, 'is_active', !m.is_active)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${m.is_active ? 'bg-green-600' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${m.is_active ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => handleDelete(m.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// 子組件 2: 廠區行事曆 (Calendar) - 維持不變
// ============================================================================
function FactoryCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [overrides, setOverrides] = useState<Map<string, CalendarOverride>>(new Map())
  const [loading, setLoading] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() 
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  
  useEffect(() => {
    fetchMonthData()
  }, [currentDate])

  const fetchMonthData = async () => {
    setLoading(true)
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay.getDate()}`
    
    const { data } = await supabase
      .from('factory_calendar')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)
    
    const map = new Map()
    data?.forEach((d: CalendarOverride) => map.set(d.date, d))
    setOverrides(map)
    setLoading(false)
  }

  const toggleDateStatus = async (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const checkDate = new Date(year, month, day)
    const dayOfWeek = checkDate.getDay() 
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    const currentOverride = overrides.get(dateStr)
    let currentIsHoliday = currentOverride ? currentOverride.is_holiday : isWeekend

    const newIsHoliday = !currentIsHoliday
    let note = ''

    if (newIsHoliday) note = '休假'
    else note = isWeekend ? '補班/加班' : ''

    const isBackToDefault = (isWeekend && newIsHoliday) || (!isWeekend && !newIsHoliday)

    if (isBackToDefault) {
      await supabase.from('factory_calendar').delete().eq('date', dateStr)
      const newMap = new Map(overrides)
      newMap.delete(dateStr)
      setOverrides(newMap)
    } else {
      await supabase.from('factory_calendar').upsert({ date: dateStr, is_holiday: newIsHoliday, note })
      const newMap = new Map(overrides)
      newMap.set(dateStr, { date: dateStr, is_holiday: newIsHoliday, note })
      setOverrides(newMap)
    }
  }

  const handleMonthChange = (offset: number) => {
    setCurrentDate(new Date(year, month + offset, 1))
  }

  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay()
  const calendarGrid = []

  for (let i = 0; i < startDayOfWeek; i++) {
    calendarGrid.push(<div key={`empty-${i}`} className="h-24 bg-slate-950/30 border border-slate-800/50"></div>)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const checkDate = new Date(year, month, day)
    const dayOfWeek = checkDate.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    const override = overrides.get(dateStr)
    const isHoliday = override ? override.is_holiday : isWeekend
    const statusText = isHoliday ? '休假' : '上班'
    const statusColor = isHoliday ? 'text-red-400 bg-red-900/20' : 'text-emerald-400 bg-emerald-900/20'
    const note = override?.note

    calendarGrid.push(
      <div 
        key={day} 
        onClick={() => toggleDateStatus(day)}
        className={`h-28 border border-slate-800 p-2 cursor-pointer transition-all hover:border-orange-500 relative group flex flex-col justify-between ${isHoliday ? 'bg-slate-900/80' : 'bg-slate-800/20'}`}
      >
        <div className="flex justify-between items-start">
          <span className={`text-lg font-bold ${isHoliday ? 'text-slate-500' : 'text-white'}`}>{day}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>
            {statusText}
          </span>
        </div>
        
        <div className="text-xs text-center mt-2">
           {note && <span className="text-orange-300 block">{note}</span>}
           {isWeekend && !isHoliday && <span className="text-emerald-500 font-bold block">補班</span>}
        </div>

        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-slate-800 rounded">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="text-2xl font-bold text-white font-mono">
          {year} 年 {month + 1} 月
        </h2>
        <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-slate-800 rounded">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
          <div key={d} className={`font-bold p-2 ${i === 0 || i === 6 ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarGrid}
      </div>

      <div className="mt-4 flex gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-900/20 border border-emerald-500/50 block"></span> 上班日</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-slate-900/80 border border-red-500/50 block"></span> 休假日</div>
        <div className="ml-auto">
          💡 點擊日期可切換狀態 (預設週六日為休假，週一至五為上班)
        </div>
      </div>
    </div>
  )
}