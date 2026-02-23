'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabaseClient'

interface Log {
  id: number
  user_name: string
  action_type: string
  target_resource: string
  details: string
  created_at: string
}

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState('')

  const fetchLogs = useCallback(async (userFilter: string = '') => {
    setLoading(true)
    let query = supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100) // 只抓最近 100 筆，避免太慢

    if (userFilter) {
      query = query.ilike('user_name', `%${userFilter}%`)
    }

    const { data } = await query
    if (data) setLogs(data as Log[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLogs('')
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchLogs])

  const getActionColor = (action: string) => {
    if (action.includes('刪除')) return 'text-red-400'
    if (action.includes('新增') || action.includes('匯入')) return 'text-emerald-400'
    if (action.includes('修改') || action.includes('更新')) return 'text-yellow-400'
    return 'text-cyan-400'
  }

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">系統操作日誌</h1>
          <p className="text-slate-500 mt-1 font-mono text-sm uppercase">SYSTEM AUDIT LOGS</p>
        </div>
        <div className="flex gap-2">
            <input 
                type="text" 
                placeholder="搜尋使用者..." 
                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-cyan-500 outline-none"
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchLogs(filterUser)}
            />
              <button onClick={() => fetchLogs(filterUser)} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded transition-colors">重新整理</button>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-950 text-slate-200 uppercase font-mono text-xs">
            <tr>
              <th className="p-4 border-b border-slate-800 w-40">時間</th>
              <th className="p-4 border-b border-slate-800 w-32">操作者</th>
              <th className="p-4 border-b border-slate-800 w-32">動作</th>
              <th className="p-4 border-b border-slate-800 w-48">目標對象</th>
              <th className="p-4 border-b border-slate-800">詳細內容</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading ? (
                <tr><td colSpan={5} className="p-10 text-center">載入中...</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-4 font-mono text-xs text-slate-500">
                  {new Date(log.created_at).toLocaleString('zh-TW')}
                </td>
                <td className="p-4 font-bold text-white">{log.user_name}</td>
                <td className={`p-4 font-bold ${getActionColor(log.action_type)}`}>{log.action_type}</td>
                <td className="p-4 font-mono text-slate-300">{log.target_resource}</td>
                <td className="p-4 text-slate-400">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}