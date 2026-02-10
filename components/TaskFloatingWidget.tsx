'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

export default function TaskFloatingWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'chat'>('list')
  const [tasks, setTasks] = useState<any[]>([])
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  
  // 模擬當前使用者 (實際應從 Auth Context 取得)
  const currentUser = { id: 'user-123', name: '張肇元', dept: '生產管理' }

  useEffect(() => {
    fetchTasks()
    
    // 訂閱即時更新
    const channel = supabase
      .channel('tasks-widget')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchTasks = async () => {
    // 這裡簡化邏輯：抓取所有相關任務
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) {
      setTasks(data)
      // 計算未讀 (假設 status 為 pending 或是 is_read 為 false)
      setUnreadCount(data.filter(t => !t.is_read).length)
    }
  }

  const handleOpenTask = (task: any) => {
    setSelectedTask(task)
    setActiveTab('chat')
    // 標記為已讀
    supabase.from('tasks').update({ is_read: true }).eq('id', task.id).then()
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* 聊天視窗 (Popup) */}
      {isOpen && (
        <div className="mb-4 w-96 h-[500px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
          
          {/* Header */}
          <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
            {activeTab === 'chat' ? (
              <button onClick={() => setActiveTab('list')} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                返回列表
              </button>
            ) : (
              <h3 className="font-bold text-white flex items-center gap-2">
                任務通知
                {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{unreadCount}</span>}
              </h3>
            )}
            <div className="flex gap-2">
               <Link href="/tasks" className="text-xs text-blue-400 hover:text-blue-300">開啟完整看板</Link>
               <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a101a]">
            
            {/* TAB: 列表模式 */}
            {activeTab === 'list' && (
              <div className="divide-y divide-slate-800">
                {tasks.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">目前沒有新任務</div>
                ) : (
                    tasks.map(task => (
                    <div 
                        key={task.id} 
                        onClick={() => handleOpenTask(task)}
                        className={`p-4 cursor-pointer hover:bg-slate-800/50 transition-colors ${!task.is_read ? 'bg-blue-900/10 border-l-2 border-blue-500' : ''}`}
                    >
                        <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-blue-400">[{task.target_dept}]</span>
                        <span className="text-[10px] text-slate-500">{new Date(task.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1 truncate">{task.title}</h4>
                        <p className="text-xs text-slate-400 truncate">{task.content}</p>
                        <div className="mt-2 flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                task.status === 'returned' ? 'border-red-500 text-red-400' : 
                                task.status === 'completed' ? 'border-green-500 text-green-400' : 
                                'border-slate-600 text-slate-500'
                            }`}>
                                {task.status === 'returned' ? '已退回' : task.status}
                            </span>
                            <span className="text-[10px] text-slate-600">From: {task.sender_name}</span>
                        </div>
                    </div>
                    ))
                )}
              </div>
            )}

            {/* TAB: 聊天模式 (簡易版) */}
            {activeTab === 'chat' && selectedTask && (
              <div className="p-4 space-y-4">
                 <div className="bg-slate-900 p-3 rounded border border-slate-700">
                    <h3 className="font-bold text-white text-sm mb-1">{selectedTask.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{selectedTask.content}</p>
                 </div>
                 
                 {/* 模擬的對話紀錄 */}
                 <div className="space-y-3">
                    <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white">張</div>
                        <div className="bg-slate-800 p-2 rounded-r-xl rounded-bl-xl text-xs text-slate-300 max-w-[80%]">
                            請協助確認這個訂單的包裝規格，急件。
                        </div>
                    </div>
                    <div className="text-center text-[10px] text-slate-600 my-2">— 任務已轉移給 [美編部] —</div>
                 </div>

                 {/* 底部操作區 */}
                 <div className="mt-4 pt-4 border-t border-slate-800">
                    <button className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-bold">
                        進入任務看板回覆
                    </button>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 懸浮按鈕 (Badge) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center justify-center w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-lg hover:scale-110 transition-transform active:scale-95"
      >
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen ? (
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          )}
        </svg>
        
        {/* 未讀紅點 */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-[#050b14] rounded-full text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

    </div>
  )
}