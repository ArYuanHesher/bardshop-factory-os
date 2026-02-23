'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

interface AnomalyReportRow {
  created_at: string
  status: string | null
  reason: string | null
  qa_reporter: string | null
  qa_handlers: string[] | null
  qa_responsible: string[] | null
}

interface RatioItem {
  name: string
  count: number
  percentage: number
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function normalizeArray(value: string[] | null | undefined) {
  return Array.isArray(value) ? value : []
}

export default function QaAnalyticsPage() {
  const [startDate, setStartDate] = useState(() => {
    const start = new Date()
    start.setDate(start.getDate() - 30)
    return toDateInputValue(start)
  })
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()))
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<AnomalyReportRow[]>([])

  const statusSummary = useMemo(() => {
    const total = rows.length
    const confirmed = rows.filter((row) => row.status === 'confirmed').length
    const pending = rows.filter((row) => row.status === 'pending').length
    return { total, confirmed, pending }
  }, [rows])

  const reasonRatios = useMemo<RatioItem[]>(() => {
    const map = new Map<string, number>()

    for (const row of rows) {
      const key = (row.reason || '未填寫').trim() || '未填寫'
      map.set(key, (map.get(key) || 0) + 1)
    }

    const total = rows.length || 1
    return [...map.entries()]
      .map(([name, count]) => ({ name, count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
  }, [rows])

  const personnelRatios = useMemo<RatioItem[]>(() => {
    const map = new Map<string, number>()

    for (const row of rows) {
      const people = new Set<string>()
      if (row.qa_reporter?.trim()) people.add(row.qa_reporter.trim())
      normalizeArray(row.qa_handlers).forEach((name) => name?.trim() && people.add(name.trim()))
      normalizeArray(row.qa_responsible).forEach((name) => name?.trim() && people.add(name.trim()))

      for (const name of people) {
        map.set(name, (map.get(name) || 0) + 1)
      }
    }

    const totalInvolvements = [...map.values()].reduce((sum, count) => sum + count, 0) || 1
    return [...map.entries()]
      .map(([name, count]) => ({ name, count, percentage: (count / totalInvolvements) * 100 }))
      .sort((a, b) => b.count - a.count)
  }, [rows])

  const runAnalysis = async () => {
    if (!startDate || !endDate) {
      alert('請選擇日期區間')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('schedule_anomaly_reports')
        .select('created_at, status, reason, qa_reporter, qa_handlers, qa_responsible')
        .eq('report_type', 'qa')
        .gte('created_at', `${startDate}T00:00:00.000Z`)
        .lte('created_at', `${endDate}T23:59:59.999Z`)

      if (error) throw error
      setRows((data as AnomalyReportRow[]) || [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知錯誤'
      alert(`分析失敗：${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">異常統計分析</h1>
          <p className="text-indigo-400 mt-1 font-mono text-sm uppercase">ANOMALY ANALYTICS // REASON & PERSONNEL RATIO</p>
        </div>
        <Link href="/qa" className="px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">返回品保專區</Link>
      </div>

      <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-400">起始日期</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400">結束日期</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 block bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white" />
          </div>
          <button
            onClick={() => void runAnalysis()}
            disabled={loading}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? '分析中...' : '開始分析'}
          </button>
          <span className="text-xs text-slate-500">共 {rows.length} 筆資料</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-400">總件數</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{statusSummary.total}</p>
        </div>
        <div className="bg-slate-900/50 border border-emerald-700/60 rounded-xl p-4">
          <p className="text-xs text-emerald-300">已處理件數</p>
          <p className="mt-2 text-3xl font-black text-emerald-300 font-mono">{statusSummary.confirmed}</p>
        </div>
        <div className="bg-slate-900/50 border border-amber-700/60 rounded-xl p-4">
          <p className="text-xs text-amber-300">待處理件數</p>
          <p className="mt-2 text-3xl font-black text-amber-300 font-mono">{statusSummary.pending}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 space-y-3">
          <h2 className="text-lg text-white font-bold">異常原因佔比</h2>
          {reasonRatios.length === 0 ? (
            <p className="text-sm text-slate-500">尚無資料</p>
          ) : (
            reasonRatios.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{item.name}</span>
                  <span>{item.count} 筆 / {item.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded">
                  <div className="h-2 bg-cyan-500 rounded" style={{ width: `${Math.max(3, item.percentage)}%` }} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 space-y-3">
          <h2 className="text-lg text-white font-bold">異常人員佔比</h2>
          {personnelRatios.length === 0 ? (
            <p className="text-sm text-slate-500">尚無資料</p>
          ) : (
            personnelRatios.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{item.name}</span>
                  <span>{item.count} 次 / {item.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded">
                  <div className="h-2 bg-emerald-500 rounded" style={{ width: `${Math.max(3, item.percentage)}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
