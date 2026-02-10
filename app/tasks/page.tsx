'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

// --- 定義資料介面 ---
interface Member {
  id: number
  real_name: string
  department: string
  email: string
}

interface Department {
  id: number
  name: string
}

export default function TaskBoardPage() {
  const router = useRouter()
  
  // --- 系統資料狀態 ---
  const [dbDepartments, setDbDepartments] = useState<Department[]>([])
  const [dbMembers, setDbMembers] = useState<Member[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string, name: string, dept: string } | null>(null)

  // --- 任務狀態 ---
  const [tasks, setTasks] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'mine' | 'sent'>('all')
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  
  // 新任務表單
  const [newTask, setNewTask] = useState({ title: '', content: '', targetDept: '', targetUsers: [] as string[] })
  // 🔥 新增：控制選人視窗目前正在看哪個部門
  const [activeUserSelectTab, setActiveUserSelectTab] = useState<string>('') 
  
  // 聊天輸入
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<any[]>([])

  // --- 1. 初始化 ---
  useEffect(() => {
    const initData = async () => {
      const [deptRes, memberRes] = await Promise.all([
        supabase.from('departments').select('*').order('id', { ascending: true }),
        supabase.from('members').select('*').eq('status', 'Active')
      ])

      if (deptRes.data) {
        setDbDepartments(deptRes.data)
        // 預設選人分頁為第一個部門
        if (deptRes.data.length > 0) setActiveUserSelectTab(deptRes.data[0].name)
      }
      if (memberRes.data) setDbMembers(memberRes.data)

      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.email && memberRes.data) {
        const matchedMember = memberRes.data.find(m => m.email === user.email)
        if (matchedMember) {
          setCurrentUser({
            id: user.id,
            name: matchedMember.real_name,
            dept: matchedMember.department
          })
        } else {
          setCurrentUser({ id: user.id, name: user.email, dept: 'Unknown' })
        }
      }
    }

    initData()
    fetchTasks()

    const channel = supabase.channel('tasks-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('updated_at', { ascending: false })
    if (data) setTasks(data)
  }

  // --- 邏輯：選人相關 (Toggle / Select All) ---
  
  // 切換單一人員
  const handleToggleUser = (userName: string) => {
    setNewTask(prev => {
      const exists = prev.targetUsers.includes(userName)
      return {
        ...prev,
        targetUsers: exists 
          ? prev.targetUsers.filter(u => u !== userName) // 移除
          : [...prev.targetUsers, userName] // 新增
      }
    })
  }

  // 切換部門全選
  const handleToggleDeptAll = (deptName: string) => {
    // 找出該部門所有成員的名字
    const deptMembers = dbMembers.filter(m => m.department === deptName).map(m => m.real_name)
    if (deptMembers.length === 0) return

    setNewTask(prev => {
      // 檢查是否已經全選了該部門的人
      const allSelected = deptMembers.every(name => prev.targetUsers.includes(name))
      
      let newUsers = [...prev.targetUsers]
      if (allSelected) {
        // 如果已全選 -> 全部取消 (從名單中移除該部門的人)
        newUsers = newUsers.filter(name => !deptMembers.includes(name))
      } else {
        // 如果未全選 -> 全部加入 (加入還沒被選的人)
        deptMembers.forEach(name => {
          if (!newUsers.includes(name)) newUsers.push(name)
        })
      }
      return { ...prev, targetUsers: newUsers }
    })
  }

  // --- 邏輯：發送任務 ---
  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.targetDept) return alert('請填寫標題與主要歸屬部門')
    if (!currentUser) return alert('無法識別您的身分')

    // 如果沒有選人，預設為該部門全部人可見 (邏輯可自訂，這邊保留空陣列)
    const { error } = await supabase.from('tasks').insert({
      title: newTask.title,
      content: newTask.content,
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      target_dept: newTask.targetDept,
      assigned_to: newTask.targetUsers,
      status: 'pending',
      transfer_count: 0
    })

    if (!error) {
      setIsCreateModalOpen(false)
      setNewTask({ title: '', content: '', targetDept: '', targetUsers: [] })
      fetchTasks()
    } else {
      alert('發送失敗：' + error.message)
    }
  }

  // --- 邏輯：接收與轉移 ---
  const handleAcceptTask = async () => {
    if (!selectedTask) return
    await supabase.from('tasks').update({ status: 'accepted' }).eq('id', selectedTask.id)
    addSystemMessage('已接收此任務')
    setSelectedTask({ ...selectedTask, status: 'accepted' })
  }

  const handleTransferTask = async () => {
    if (!selectedTask) return
    const newDept = prompt('請輸入要轉移的部門名稱:', dbDepartments[0]?.name)
    if (!newDept) return

    const deptExists = dbDepartments.some(d => d.name === newDept)
    if (!deptExists) return alert('找不到此部門。')

    const newCount = (selectedTask.transfer_count || 0) + 1
    
    if (newCount > 2) {
      await supabase.from('tasks').update({
        status: 'returned',
        target_dept: '退回', 
        assigned_to: [selectedTask.sender_name],
        transfer_count: 0,
        is_read: false
      }).eq('id', selectedTask.id)
      
      addSystemMessage(`⚠️ 任務流轉次數過多，系統強制退回。`)
      alert('任務流轉次數過多，已退回給發送人！')
    } else {
      await supabase.from('tasks').update({
        target_dept: newDept,
        assigned_to: [], // 轉移時清空指定人
        status: 'pending',
        transfer_count: newCount,
        is_read: false
      }).eq('id', selectedTask.id)
      addSystemMessage(`將任務轉移至 [${newDept}]`)
    }
    fetchTasks()
    setSelectedTask(null)
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedTask || !currentUser) return
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

  // --- 過濾任務 ---
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true
    if (!currentUser) return true
    if (filter === 'sent') return task.sender_id === currentUser.id
    if (filter === 'mine') {
      const assignedToMe = task.assigned_to?.includes(currentUser.name)
      const assignedToMyDept = task.target_dept === currentUser.dept && (!task.assigned_to || task.assigned_to.length === 0)
      return assignedToMe || assignedToMyDept
    }
    return true
  })

  // --- UI ---
  return (
    <div className="min-h-screen bg-[#050b14] text-slate-300 flex flex-col md:flex-row font-sans relative">
      
      {/* 左側邊欄 */}
      <div className="w-full md:w-64 bg-slate-950 border-r border-slate-800 flex flex-col p-4">
        <div className="flex gap-2 mb-6">
           <Link href="/" className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              回首頁
           </Link>
           <button onClick={() => router.back()} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              上一頁
           </button>
        </div>

        <div className="mb-8">
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
               <span className="w-3 h-8 bg-blue-600 rounded-sm"></span>
               任務看板
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">TASK MANAGEMENT SYSTEM</p>
            {currentUser && <p className="text-xs text-blue-400 mt-2">Hi, {currentUser.name}</p>}
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
             <button key={f} onClick={() => setFilter(f as any)} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-colors ${filter === f ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}>
               {f === 'all' && '📌 所有任務'}
               {f === 'mine' && '📥 指派給我'}
               {f === 'sent' && '📤 我發出的'}
             </button>
           ))}
        </nav>
      </div>

      {/* 中間：任務列表 */}
      <div className="flex-1 bg-[#0a101a] flex flex-col border-r border-slate-800 max-w-md">
         <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-white">任務列表</h2>
            <span className="text-xs text-slate-500">{filteredTasks.length} tasks</span>
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {filteredTasks.length === 0 ? (
               <div className="p-8 text-center text-slate-600 text-sm">沒有符合的任務</div>
            ) : filteredTasks.map(task => (
               <div key={task.id} onClick={() => setSelectedTask(task)} className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedTask?.id === task.id ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                  <div className="flex justify-between items-start mb-2">
                     <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${task.status === 'returned' ? 'bg-red-900/30 text-red-400' : 'bg-slate-800 text-blue-400'}`}>
                        {task.status.toUpperCase()}
                     </span>
                     <span className="text-[10px] text-slate-500 font-mono">{new Date(task.updated_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-bold text-white mb-1 truncate">{task.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                     <span>{task.sender_name}</span> <span>➔</span> <span className="font-bold text-slate-300">{task.target_dept}</span>
                  </div>
               </div>
            ))}
         </div>
      </div>

      {/* 右側：任務詳情 */}
      <div className="flex-[2] bg-[#050b14] flex flex-col relative">
         {selectedTask ? (
            <>
               <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/50 backdrop-blur">
                  <div>
                     <h2 className="text-lg font-bold text-white">{selectedTask.title}</h2>
                     <div className="text-xs text-slate-500 flex gap-2">
                        <span>發送: {selectedTask.sender_name}</span><span>•</span><span>轉移: {selectedTask.transfer_count}</span>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     {selectedTask.status === 'pending' && <button onClick={handleAcceptTask} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-full transition-colors">接收任務</button>}
                     <button onClick={handleTransferTask} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-full border border-slate-600 transition-colors">轉移任務</button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mb-8">
                     <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Description</h4>
                     <p className="text-slate-300 leading-relaxed">{selectedTask.content}</p>
                     {selectedTask.assigned_to && selectedTask.assigned_to.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-800/50">
                           <span className="text-xs text-slate-500 mr-2">指派給:</span>
                           {selectedTask.assigned_to.map((name: string, i: number) => (
                              <span key={i} className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded mr-1 border border-blue-500/20">{name}</span>
                           ))}
                        </div>
                     )}
                  </div>
                  <div className="flex items-center gap-4 py-4">
                     <div className="h-px bg-slate-800 flex-1"></div>
                     <span className="text-xs text-slate-600 font-mono">MESSAGES</span>
                     <div className="h-px bg-slate-800 flex-1"></div>
                  </div>
                  {messages.map(msg => (
                     <div key={msg.id} className={`flex flex-col ${msg.type === 'system' ? 'items-center' : msg.user_name === currentUser?.name ? 'items-end' : 'items-start'}`}>
                        {msg.type === 'system' ? (
                           <span className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full">{msg.content}</span>
                        ) : (
                           <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${msg.user_name === currentUser?.name ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-300 rounded-tl-sm'}`}>{msg.content}</div>
                        )}
                        {msg.type !== 'system' && <span className="text-[10px] text-slate-600 mt-1 mx-1">{msg.user_name} • {new Date(msg.created_at).toLocaleTimeString()}</span>}
                     </div>
                  ))}
               </div>

               <div className="p-4 bg-slate-950 border-t border-slate-800">
                  <div className="flex gap-2">
                     <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="輸入回覆訊息..." className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none" />
                     <button onClick={handleSendMessage} className="px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
                  </div>
               </div>
            </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
               <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4"><svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div>
               <p>選擇一個任務以檢視詳情或開始對話</p>
            </div>
         )}
      </div>

      {/* --- Modal: 建立任務 (已更新選人邏輯) --- */}
      {isCreateModalOpen && (
         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                  <h3 className="text-xl font-bold text-white">指派新任務</h3>
                  <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-500 hover:text-white">✕</button>
               </div>
               
               <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                  
                  {/* 標題與內容 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 block mb-1">任務標題</label>
                        <input type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                     </div>
                     <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 block mb-1">任務內容</label>
                        <textarea rows={3} value={newTask.content} onChange={e => setNewTask({...newTask, content: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none resize-none" />
                     </div>
                  </div>

                  <div className="h-px bg-slate-800 w-full"></div>

                  {/* 🔥 1. 主要歸屬部門 (Primary Dept) */}
                  <div>
                     <label className="text-xs font-bold text-blue-400 block mb-2 uppercase">1. 設定主要歸屬部門 (Primary Dept)</label>
                     <div className="flex flex-wrap gap-2">
                        {dbDepartments.map(dept => (
                           <button
                              key={dept.id}
                              onClick={() => setNewTask({ ...newTask, targetDept: dept.name })}
                              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${newTask.targetDept === dept.name ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                           >
                              {dept.name}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* 🔥 2. 指派人員 (Assignees - Cross Dept) */}
                  <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800">
                     <label className="text-xs font-bold text-emerald-400 block mb-3 uppercase">2. 指派執行人員 (複選 / 跨部門)</label>
                     
                     {/* A. 部門切換 Tabs */}
                     <div className="flex border-b border-slate-700 mb-3 overflow-x-auto custom-scrollbar">
                        {dbDepartments.map(dept => (
                           <button
                              key={dept.id}
                              onClick={() => setActiveUserSelectTab(dept.name)}
                              className={`px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${activeUserSelectTab === dept.name ? 'border-emerald-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                           >
                              {dept.name}
                           </button>
                        ))}
                     </div>

                     {/* B. 該部門人員列表 */}
                     <div className="min-h-[100px]">
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-xs text-slate-500">部門成員:</span>
                           <button onClick={() => handleToggleDeptAll(activeUserSelectTab)} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white">
                              全選/取消 {activeUserSelectTab}
                           </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                           {dbMembers.filter(m => m.department === activeUserSelectTab).length > 0 ? (
                              dbMembers.filter(m => m.department === activeUserSelectTab).map(u => (
                                 <button
                                    key={u.id}
                                    onClick={() => handleToggleUser(u.real_name)}
                                    className={`px-3 py-1.5 rounded-full text-xs border transition-all flex items-center gap-1 ${newTask.targetUsers.includes(u.real_name) ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                                 >
                                    {u.real_name}
                                    {newTask.targetUsers.includes(u.real_name) && <span className="text-[10px]">✓</span>}
                                 </button>
                              ))
                           ) : (
                              <span className="text-xs text-slate-600 italic py-2">此部門尚無成員</span>
                           )}
                        </div>
                     </div>
                  </div>

                  {/* 🔥 3. 已選名單總覽 (Selected Summary) */}
                  {newTask.targetUsers.length > 0 && (
                     <div className="animate-fade-in">
                        <label className="text-xs font-bold text-slate-500 block mb-2">已選擇人員 ({newTask.targetUsers.length})</label>
                        <div className="flex flex-wrap gap-2 p-3 bg-black/20 rounded-xl border border-slate-800">
                           {newTask.targetUsers.map(user => (
                              <button key={user} onClick={() => handleToggleUser(user)} className="group flex items-center gap-1 bg-blue-900/30 text-blue-300 border border-blue-500/30 px-2 py-1 rounded text-xs hover:bg-red-900/30 hover:text-red-300 hover:border-red-500/30 transition-colors">
                                 {user}
                                 <span className="text-[10px] opacity-50 group-hover:opacity-100">✕</span>
                              </button>
                           ))}
                        </div>
                     </div>
                  )}

               </div>

               <div className="p-4 bg-slate-950 flex justify-end gap-3 border-t border-slate-800">
                  <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
                  <button onClick={handleCreateTask} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow-lg">
                     確認發送 ({newTask.targetUsers.length}人)
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  )
}