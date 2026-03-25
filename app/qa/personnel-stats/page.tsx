'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../../lib/supabaseClient'

interface AnomalyRow {
  qa_responsible: string[] | null
  qa_category: string | null
  created_at: string
  status: string | null
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function normalizeArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : []
}

export default function PersonnelStatsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return toDateInputValue(d)
  })
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()))
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<AnomalyRow[]>([])

  // 排序狀態：'total' | category name
  const [sortBy, setSortBy] = useState<string>('total')

  const runQuery = async () => {
    if (!startDate || !endDate) { alert('請選擇日期區間'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('schedule_anomaly_reports')
        .select('qa_responsible, qa_category, created_at, status')
        .eq('report_type', 'qa')
        .gte('created_at', `${startDate}T00:00:00.000Z`)
        .lte('created_at', `${endDate}T23:59:59.999Z`)
      if (error) throw error
      setRows((data as AnomalyRow[]) || [])
      setSortBy('total')
    } catch (err: unknown) {
      alert(`查詢失敗：${err instanceof Error ? err.message : '未知錯誤'}`)
    } finally {
      setLoading(false)
    }
  }

  // 所有分類（去重排序）
  const allCategories = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      const cat = (row.qa_category || '未分類').trim() || '未分類'
      set.add(cat)
    }
    return [...set].sort()
  }, [rows])

  // 人員 × 分類 交叉統計
  // personMap: Map<person, Map<category, count>>
  const personMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const row of rows) {
      const cat = (row.qa_category || '未分類').trim() || '未分類'
      for (const raw of normalizeArray(row.qa_responsible)) {
        const person = raw.trim()
        if (!person) continue
        if (!map.has(person)) map.set(person, new Map())
        const inner = map.get(person)!
        inner.set(cat, (inner.get(cat) || 0) + 1)
      }
    }
    return map
  }, [rows])

  // 人員列表（依選中欄位排序）
  const sortedPersons = useMemo(() => {
    const persons = [...personMap.keys()]
    return persons.sort((a, b) => {
      const aMap = personMap.get(a)!
      const bMap = personMap.get(b)!
      const aVal = sortBy === 'total'
        ? [...aMap.values()].reduce((s, c) => s + c, 0)
        : (aMap.get(sortBy) || 0)
      const bVal = sortBy === 'total'
        ? [...bMap.values()].reduce((s, c) => s + c, 0)
        : (bMap.get(sortBy) || 0)
      return bVal - aVal
    })
  }, [personMap, sortBy])

  // 摘要數字
  const totalCount = useMemo(() => [...personMap.values()].flatMap((m) => [...m.values()]).reduce((s, c) => s + c, 0), [personMap])
  const uniquePersons = personMap.size
  const uniqueCategories = allCategories.length

  const handleDownload = useCallback(() => {
    if (rows.length === 0) { alert('尚無資料，請先查詢'); return }

    const header = ['缺失人員', '合計', ...allCategories]
    const sheetRows = sortedPersons.map((person) => {
      const inner = personMap.get(person)!
      const total = [...inner.values()].reduce((s, c) => s + c, 0)
      const row: Record<string, string | number> = { 缺失人員: person, 合計: total }
      for (const cat of allCategories) { row[cat] = inner.get(cat) || 0 }
      return row
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(sheetRows, { header })
    ws['!cols'] = [{ wch: 16 }, { wch: 8 }, ...allCategories.map(() => ({ wch: 14 }))]
    XLSX.utils.book_append_sheet(wb, ws, '異常人員統計')
    XLSX.writeFile(wb, `異常人員統計_${startDate}_${endDate}.xlsx`)
  }, [rows, sortedPersons, personMap, allCategories, startDate, endDate])

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">異常人員統計</h1>
          <p className="text-rose-400 mt-1 font-mono text-sm uppercase">PERSONNEL STATS // 缺失人員 × 異常分類</p>
        </div>
        <Link href="/qa" className="px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">返回品保專區</Link>
      </div>

      {/* 日期篩選 */}
      <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-400">起始日期</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400">結束日期</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white" />
          </div>
          <button
            onClick={() => void runQuery()}
            disabled={loading}
            className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-600 text-white font-bold disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? '查詢中...' : '開始查詢'}
          </button>
          <button
            onClick={handleDownload}
            disabled={rows.length === 0}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:bg-slate-700 disabled:text-slate-400"
          >
            下載 XLSX
          </button>
          <span className="text-xs text-slate-500">共 {rows.length} 筆資料</span>
        </div>
      </div>

      {/* 摘要卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-400">缺失總次數</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{totalCount}</p>
        </div>
        <div className="bg-slate-900/50 border border-rose-700/60 rounded-xl p-4">
          <p className="text-xs text-rose-300">缺失人員（不重複）</p>
          <p className="mt-2 text-3xl font-black text-rose-300 font-mono">{uniquePersons}</p>
        </div>
        <div className="bg-slate-900/50 border border-amber-700/60 rounded-xl p-4">
          <p className="text-xs text-amber-300">異常分類（不重複）</p>
          <p className="mt-2 text-3xl font-black text-amber-300 font-mono">{uniqueCategories}</p>
        </div>
      </div>

      {/* 交叉統計表 */}
      {rows.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-12 text-center text-slate-500">
          請選擇日期區間後點選「開始查詢」
        </div>
      ) : sortedPersons.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-12 text-center text-slate-500">
          此區間內無缺失人員資料
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="px-4 py-3 text-left sticky left-0 bg-slate-900 z-10 min-w-[120px]">缺失人員</th>
                <th
                  className={`px-4 py-3 text-center cursor-pointer hover:text-white whitespace-nowrap ${sortBy === 'total' ? 'text-white' : ''}`}
                  onClick={() => setSortBy('total')}
                >
                  合計 {sortBy === 'total' && '▼'}
                </th>
                {allCategories.map((cat) => (
                  <th
                    key={cat}
                    className={`px-4 py-3 text-center cursor-pointer hover:text-white whitespace-nowrap ${sortBy === cat ? 'text-amber-300' : ''}`}
                    onClick={() => setSortBy(cat)}
                  >
                    {cat} {sortBy === cat && '▼'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedPersons.map((person) => {
                const inner = personMap.get(person)!
                const total = [...inner.values()].reduce((s, c) => s + c, 0)
                const maxTotal = Math.max(...sortedPersons.map((p) => {
                  const m = personMap.get(p)!
                  return [...m.values()].reduce((s, c) => s + c, 0)
                }))
                return (
                  <tr key={person} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-white sticky left-0 bg-slate-900/80 z-10">{person}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-slate-800 rounded h-1.5 hidden md:block">
                          <div
                            className="h-1.5 bg-rose-500 rounded"
                            style={{ width: `${maxTotal > 0 ? (total / maxTotal) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="font-bold text-rose-300 font-mono">{total}</span>
                      </div>
                    </td>
                    {allCategories.map((cat) => {
                      const count = inner.get(cat) || 0
                      return (
                        <td key={cat} className="px-4 py-3 text-center">
                          {count > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-900/30 border border-amber-700/50 text-amber-200 text-xs font-mono">
                              {count}
                            </span>
                          ) : (
                            <span className="text-slate-700">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            {/* 分類合計行 */}
            <tfoot>
              <tr className="border-t border-slate-600 text-xs text-slate-400 bg-slate-900/60">
                <td className="px-4 py-3 sticky left-0 bg-slate-900/60 z-10 font-bold text-slate-300">各分類合計</td>
                <td className="px-4 py-3 text-center font-bold text-rose-300 font-mono">{totalCount}</td>
                {allCategories.map((cat) => {
                  const sum = sortedPersons.reduce((s, p) => s + (personMap.get(p)?.get(cat) || 0), 0)
                  return (
                    <td key={cat} className="px-4 py-3 text-center font-mono text-slate-300">
                      {sum > 0 ? sum : '-'}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 各人員橫條圖 */}
      {sortedPersons.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold text-white">缺失人員分類分布</h2>
          <div className="space-y-3">
            {sortedPersons.map((person) => {
              const inner = personMap.get(person)!
              const total = [...inner.values()].reduce((s, c) => s + c, 0)
              const maxTotal = Math.max(...sortedPersons.map((p) => {
                const m = personMap.get(p)!
                return [...m.values()].reduce((s, c) => s + c, 0)
              }))
              const barColors = ['bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-fuchsia-500', 'bg-orange-500', 'bg-teal-500']
              return (
                <div key={person} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white font-medium">{person}</span>
                    <span className="text-rose-300 font-mono text-xs">{total} 次</span>
                  </div>
                  {/* stacked bar */}
                  <div className="flex h-4 rounded overflow-hidden bg-slate-800" style={{ width: `${maxTotal > 0 ? (total / maxTotal) * 100 : 0}%`, minWidth: total > 0 ? '4px' : '0' }}>
                    {allCategories.map((cat, i) => {
                      const count = inner.get(cat) || 0
                      if (!count) return null
                      return (
                        <div
                          key={cat}
                          className={`${barColors[i % barColors.length]} h-full`}
                          style={{ width: `${(count / total) * 100}%` }}
                          title={`${cat}: ${count}`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map((cat, i) => {
                      const count = inner.get(cat) || 0
                      if (!count) return null
                      return (
                        <span key={cat} className="text-xs text-slate-400">
                          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${barColors[i % barColors.length]}`} />
                          {cat}: {count}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
