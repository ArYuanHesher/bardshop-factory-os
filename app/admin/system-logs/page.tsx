'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabaseClient'

interface Log {
  id: number
  user_name: string
  user_email: string | null
  user_department: string | null
  action_type: string
  target_resource: string
  details: string | null
  created_at: string
}

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterBoard, setFilterBoard] = useState('')
  const boardOptions = [
    { value: '', label: '全部看板' },
    { value: '訂單資料管理', label: '訂單資料管理' },
    { value: '生產管理入口', label: '生產管理入口' },
    { value: '產線排程看板', label: '產線排程看板' },
    { value: '物料管理', label: '物料管理' },
    { value: '工序資料庫', label: '工序資料庫' },
    { value: '系統設定', label: '系統設定' },
  ]

  const fetchLogs = useCallback(async (userFilter: string = '', actionFilter: string = '', boardFilter: string = '') => {
    setLoading(true)
    let query = supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (userFilter) {
      query = query.or(`user_name.ilike.%${userFilter}%,user_email.ilike.%${userFilter}%`)
    }
    if (actionFilter) {
      query = query.ilike('action_type', `%${actionFilter}%`)
    }
    if (boardFilter) {
      query = query.ilike('target_resource', `%${boardFilter}%`)
    }
    const { data } = await query
    if (data) setLogs(data as Log[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLogs('', '', '')
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
          <select
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-cyan-500 outline-none"
            value={filterBoard}
            onChange={e => {
              setFilterBoard(e.target.value)
              fetchLogs(filterUser, filterAction, e.target.value)
            }}
          >
            {boardOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="搜尋操作者 / Email..."
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-cyan-500 outline-none"
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchLogs(filterUser, filterAction, filterBoard)}
          />
          <input
            type="text"
            placeholder="搜尋動作..."
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-cyan-500 outline-none"
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchLogs(filterUser, filterAction, filterBoard)}
          />
          <button onClick={() => fetchLogs(filterUser, filterAction, filterBoard)} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded transition-colors">重新整理</button>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-950 text-slate-200 uppercase font-mono text-xs">
            <tr>
              <th className="p-4 border-b border-slate-800 w-40">時間</th>
              <th className="p-4 border-b border-slate-800 w-56">操作者</th>
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
                <td className="p-4">
                  <div className="font-bold text-white">{log.user_name || '-'}</div>
                  <div className="text-xs text-slate-500">{log.user_email || '-'}</div>
                  <div className="text-xs text-slate-600">{log.user_department || '-'}</div>
                </td>
                <td className={`p-4 font-bold ${getActionColor(log.action_type)}`}>{log.action_type}</td>
                <td className="p-4 font-mono text-slate-300">{log.target_resource}</td>
                <td className="p-4 text-slate-400">{log.details || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}