'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import TaskFloatingWidget from '../../components/TaskFloatingWidget' // 引用剛剛的組件

// --- 模擬資料：部門與人員 ---
const DEPARTMENTS = [
  { id: 'prod', name: '生產管理', users: [{ id: 'u1', name: '張肇元' }, { id: 'u2', name: '生管小陳' }] },
  { id: 'art', name: '美編設計', users: [{ id: 'u3', name: '美編小美' }, { id: 'u4', name: '美編阿強' }] },
  { id: 'sales', name: '業務部門', users: [{ id: 'u5', name: '業務大王' }, { id: 'u6', name: '業務小莉' }] },
  { id: 'wh', name: '倉儲物流', users: [{ id: 'u7', name: '倉管老李' }] },
]

export default function TaskBoardPage() {
  // --- 狀態 ---
  const [tasks, setTasks] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'mine' | 'sent'>('all')
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  
  // 新任務表單
  const [newTask, setNewTask] = useState({ title: '', content: '', targetDept: '', targetUsers: [] as string[] })
  
  // 聊天輸入
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  
  // 模擬當前登入者
  const currentUser = { id: 'u1', name: '張肇元', dept: '生產管理' }

  useEffect(() => {
    fetchTasks()
    
    // 即時監聽
    const channel = supabase.channel('tasks-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('updated_at', { ascending: false })
    if (data) setTasks(data)
  }

  // --- 邏輯：發送任務 ---
  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.targetDept) return alert('請填寫標題與部門')

    const { error } = await supabase.from('tasks').insert({
      title: newTask.title,
      content: newTask.content,
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      target_dept: newTask.targetDept, // 選部門
      assigned_to: newTask.targetUsers, // 選人 (可多選，可空)
      status: 'pending',
      transfer_count: 0
    })

    if (!error) {
      setIsCreateModalOpen(false)
      setNewTask({ title: '', content: '', targetDept: '', targetUsers: [] })
      fetchTasks()
    }
  }

  // --- 邏輯：接收任務 ---
  const handleAcceptTask = async () => {
    if (!selectedTask) return
    await supabase.from('tasks').update({ status: 'accepted' }).eq('id', selectedTask.id)
    addSystemMessage('已接收此任務')
    setSelectedTask({ ...selectedTask, status: 'accepted' })
  }

  // --- 邏輯：轉移任務 (含防呆退回) ---
  const handleTransferTask = async (newDept: string, newUsers: string[]) => {
    if (!selectedTask) return
    
    // 檢查轉移次數
    const newCount = (selectedTask.transfer_count || 0) + 1
    
    if (newCount > 2) {
      // 超過2次，退回給發送人
      await supabase.from('tasks').update({
        status: 'returned',
        target_dept: '退回', 
        assigned_to: [selectedTask.sender_id], // 指回給發送者
        transfer_count: 0,
        is_read: false
      }).eq('id', selectedTask.id)
      
      addSystemMessage(`⚠️ 任務流轉次數過多 (${newCount}次)，系統強制退回給發送人。`)
      alert('任務流轉次數過多，已退回給發送人！')
    } else {
      // 正常轉移
      await supabase.from('tasks').update({
        target_dept: newDept,
        assigned_to: newUsers,
        status: 'pending', // 重置為待接收
        transfer_count: newCount,
        is_read: false
      }).eq('id', selectedTask.id)
      
      addSystemMessage(`將任務轉移至 [${newDept}]`)
    }
    
    fetchTasks()
    setSelectedTask(null)
  }

  // --- 邏輯：發送訊息 ---
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedTask) return
    // 這裡僅示範 UI 更新，實際應寫入 task_messages 表
    const newMsg = {
        id: Date.now(),
        user_name: currentUser.name,
        content: chatInput,
        created_at: new Date().toISOString(),
        type: 'text'
    }
    setMessages([...messages, newMsg])
    setChatInput('')
  }
  
  const addSystemMessage = (msg: string) => {
      setMessages(prev => [...prev, {
          id: Date.now(),
          user_name: 'System',
          content: msg,
          created_at: new Date().toISOString(),
          type: 'system'
      }])
  }

  // --- UI 渲染 ---
  return (
    <div className="min-h-screen bg-[#050b14] text-slate-300 flex flex-col md:flex-row font-sans relative">
      
      {/* 引用懸浮聊天室 (全域) */}
      <TaskFloatingWidget />

      {/* 左側邊欄：導航與篩選 */}
      <div className="w-full md:w-64 bg-slate-950 border-r border-slate-800 flex flex-col p-4">
        <div className="mb-8">
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
               <span className="w-3 h-8 bg-blue-600 rounded-sm"></span>
               任務看板
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">TASK MANAGEMENT SYSTEM</p>
        </div>

        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 mb-6 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          建立新任務
        </button>

        <nav className="space-y-1">
           {['all', 'mine', 'sent'].map((f) => (
             <button
               key={f}
               onClick={() => setFilter(f as any)}
               className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-colors ${filter === f ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
             >
               {f === 'all' && '📌 所有任務'}
               {f === 'mine' && '📥 指派給我'}
               {f === 'sent' && '📤 我發出的'}
             </button>
           ))}
        </nav>
      </div>

      {/* 中間：任務列表 (List View) */}
      <div className="flex-1 bg-[#0a101a] flex flex-col border-r border-slate-800 max-w-md">
         <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-white">任務列表</h2>
            <span className="text-xs text-slate-500">{tasks.length} tasks</span>
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {tasks.map(task => (
               <div 
                 key={task.id}
                 onClick={() => setSelectedTask(task)}
                 className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedTask?.id === task.id ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
               >
                  <div className="flex justify-between items-start mb-2">
                     <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${task.status === 'returned' ? 'bg-red-900/30 text-red-400' : 'bg-slate-800 text-blue-400'}`}>
                        {task.status.toUpperCase()}
                     </span>
                     <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(task.updated_at).toLocaleDateString()}
                     </span>
                  </div>
                  <h3 className="font-bold text-white mb-1 truncate">{task.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                     <span className="flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px]">{task.sender_name[0]}</span>
                        {task.sender_name}
                     </span>
                     <span>➔</span>
                     <span className="font-bold text-slate-300">{task.target_dept}</span>
                  </div>
               </div>
            ))}
         </div>
      </div>

      {/* 右側：任務詳情與聊天 (Detail View) */}
      <div className="flex-[2] bg-[#050b14] flex flex-col relative">
         {selectedTask ? (
            <>
               {/* Detail Header */}
               <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/50 backdrop-blur">
                  <div>
                     <h2 className="text-lg font-bold text-white">{selectedTask.title}</h2>
                     <div className="text-xs text-slate-500 flex gap-2">
                        <span>發送: {selectedTask.sender_name}</span>
                        <span>•</span>
                        <span>轉移次數: {selectedTask.transfer_count}</span>
                     </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                     {selectedTask.status === 'pending' && (
                        <button onClick={handleAcceptTask} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-full transition-colors">
                           接收任務
                        </button>
                     )}
                     <button 
                        onClick={() => {
                           const target = prompt('輸入轉移部門 (prod, art, sales):'); // 簡化示範
                           if (target) handleTransferTask(target, []);
                        }}
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-full border border-slate-600 transition-colors"
                     >
                        轉移任務
                     </button>
                  </div>
               </div>

               {/* Chat Area */}
               <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {/* 任務內容本體 */}
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mb-8">
                     <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Description</h4>
                     <p className="text-slate-300 leading-relaxed">{selectedTask.content}</p>
                  </div>

                  <div className="flex items-center gap-4 py-4">
                     <div className="h-px bg-slate-800 flex-1"></div>
                     <span className="text-xs text-slate-600 font-mono">HISTORY & MESSAGES</span>
                     <div className="h-px bg-slate-800 flex-1"></div>
                  </div>

                  {/* 訊息列表 */}
                  {messages.map(msg => (
                     <div key={msg.id} className={`flex flex-col ${msg.type === 'system' ? 'items-center' : msg.user_name === currentUser.name ? 'items-end' : 'items-start'}`}>
                        {msg.type === 'system' ? (
                           <span className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full">{msg.content}</span>
                        ) : (
                           <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${msg.user_name === currentUser.name ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-300 rounded-tl-sm'}`}>
                              {msg.content}
                           </div>
                        )}
                        {msg.type !== 'system' && <span className="text-[10px] text-slate-600 mt-1 mx-1">{msg.user_name} • {new Date(msg.created_at).toLocaleTimeString()}</span>}
                     </div>
                  ))}
               </div>

               {/* Input Area */}
               <div className="p-4 bg-slate-950 border-t border-slate-800">
                  <div className="flex gap-2">
                     <input 
                        type="text" 
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                        placeholder="輸入回覆訊息..." 
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                     />
                     <button onClick={handleSendMessage} className="px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                     </button>
                  </div>
               </div>
            </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
               <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
               </div>
               <p>選擇一個任務以檢視詳情或開始對話</p>
            </div>
         )}
      </div>

      {/* Modal: 建立任務 */}
      {isCreateModalOpen && (
         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-fade-in-up">
               <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">指派新任務</h3>
                  <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-500 hover:text-white">✕</button>
               </div>
               <div className="p-6 space-y-4">
                  <div>
                     <label className="text-xs font-bold text-slate-500 block mb-1">任務標題</label>
                     <input 
                        type="text" 
                        value={newTask.title}
                        onChange={e => setNewTask({...newTask, title: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" 
                     />
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 block mb-1">指派部門 (必選)</label>
                     <div className="grid grid-cols-2 gap-2">
                        {DEPARTMENTS.map(dept => (
                           <button
                              key={dept.id}
                              onClick={() => setNewTask({...newTask, targetDept: dept.name, targetUsers: []})} // 切換部門清空人選
                              className={`py-2 rounded-lg text-sm border transition-colors ${newTask.targetDept === dept.name ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                           >
                              {dept.name}
                           </button>
                        ))}
                     </div>
                  </div>
                  
                  {/* 選完部門才顯示選人 */}
                  {newTask.targetDept && (
                     <div className="animate-fade-in">
                        <label className="text-xs font-bold text-slate-500 block mb-1">指派人員 (選填，可複選)</label>
                        <div className="flex flex-wrap gap-2">
                           {DEPARTMENTS.find(d => d.name === newTask.targetDept)?.users.map(u => (
                              <button
                                 key={u.id}
                                 onClick={() => {
                                    const exists = newTask.targetUsers.includes(u.name);
                                    setNewTask({
                                       ...newTask, 
                                       targetUsers: exists 
                                          ? newTask.targetUsers.filter(n => n !== u.name)
                                          : [...newTask.targetUsers, u.name]
                                    })
                                 }}
                                 className={`px-3 py-1 rounded-full text-xs border transition-colors ${newTask.targetUsers.includes(u.name) ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                              >
                                 {u.name} {newTask.targetUsers.includes(u.name) && '✓'}
                              </button>
                           ))}
                        </div>
                     </div>
                  )}

                  <div>
                     <label className="text-xs font-bold text-slate-500 block mb-1">任務內容</label>
                     <textarea 
                        rows={4}
                        value={newTask.content}
                        onChange={e => setNewTask({...newTask, content: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none resize-none" 
                     />
                  </div>
               </div>
               <div className="p-4 bg-slate-950 flex justify-end gap-3">
                  <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
                  <button onClick={handleCreateTask} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow-lg">確認指派</button>
               </div>
            </div>
         </div>
      )}

    </div>
  )
}