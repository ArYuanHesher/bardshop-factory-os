'use client'

import { useState, useEffect, useCallback } from 'react'
// 🔥 修正路徑：往上四層即可 (../../../../)
import { supabase } from '../../../../lib/supabaseClient'

interface Announcement {
  id: number
  title: string
  content: string | null
  is_active: boolean
  created_at: string
}

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('system_announcements')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) console.error(error)
    else setList((data as Announcement[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return alert('標題不可為空')
    
    setIsSubmitting(true)
    const { error } = await supabase
      .from('system_announcements')
      .insert({ title, content, is_active: true }) // 預設啟用

    if (error) {
      alert('新增失敗: ' + error.message)
    } else {
      setTitle('')
      setContent('')
      void fetchData()
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除此公告嗎？')) return
    const { error } = await supabase.from('system_announcements').delete().eq('id', id)
    if (!error) setList(prev => prev.filter(item => item.id !== id))
  }

  const handleToggle = async (id: number, currentStatus: boolean) => {
    // 樂觀更新 UI
    setList(prev => prev.map(item => item.id === id ? { ...item, is_active: !currentStatus } : item))
    
    const { error } = await supabase
      .from('system_announcements')
      .update({ is_active: !currentStatus })
      .eq('id', id)
      
    if (error) {
      alert('更新狀態失敗')
      void fetchData() // 失敗則重抓
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto min-h-screen text-slate-300">
      <h1 className="text-3xl font-bold text-white tracking-tight mb-6">系統公告設定</h1>

      {/* 新增區塊 */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 mb-8 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
          發布新公告
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-500 mb-1">公告標題 (TITLE)</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:border-orange-500 outline-none"
              placeholder="例如：系統維護通知..."
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-slate-500 mb-1">內容詳情 (CONTENT) - 選填</label>
            <textarea 
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:border-orange-500 outline-none resize-none"
              placeholder="輸入更多詳細資訊..."
            />
          </div>
          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
            >
              {isSubmitting ? '發布中...' : '確認發布'}
            </button>
          </div>
        </form>
      </div>

      {/* 列表區塊 */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-400 font-mono text-xs uppercase">
            <tr>
              <th className="p-4 w-20 text-center">顯示</th>
              <th className="p-4 w-48">發布時間</th>
              <th className="p-4">標題 / 內容</th>
              <th className="p-4 w-20 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? <tr><td colSpan={4} className="p-8 text-center">載入中...</td></tr> : list.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-600">目前沒有公告</td></tr> : list.map(item => (
              <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-4 text-center">
                  {/* Toggle Switch */}
                  <button 
                    onClick={() => handleToggle(item.id, item.is_active)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${item.is_active ? 'bg-green-600' : 'bg-slate-700'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${item.is_active ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </td>
                <td className="p-4 font-mono text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString()}
                </td>
                <td className="p-4">
                  <div className={`font-bold text-base ${item.is_active ? 'text-white' : 'text-slate-500'}`}>{item.title}</div>
                  {item.content && <div className="text-slate-400 text-xs mt-1">{item.content}</div>}
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => handleDelete(item.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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