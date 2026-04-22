'use client'

import { useState, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'

// ==================== 製令總表記錄 ====================
interface MoRecord {
  mo_number: string
  planned_start_date: string
  planned_end_date: string
  mo_status: string
  department: string
  product_code: string
  lot_number: string
  planned_qty: string
  source_order: string
  mo_note: string
  create_date: string
  factory: string
  saved_at: string  // 儲存時間
}

const STORAGE_KEY = 'argoerp_mo_summary'

const DISPLAY_COLS: { key: keyof MoRecord; label: string }[] = [
  { key: 'mo_number', label: '製令單號' },
  { key: 'factory', label: '廠別' },
  { key: 'product_code', label: '生產貨號' },
  { key: 'lot_number', label: '批號' },
  { key: 'planned_qty', label: '預訂產出量' },
  { key: 'planned_start_date', label: '預定投產日' },
  { key: 'planned_end_date', label: '預定結案日' },
  { key: 'source_order', label: '來源訂單' },
  { key: 'mo_note', label: '製令說明' },
  { key: 'create_date', label: '開立日期' },
  { key: 'saved_at', label: '儲存時間' },
]

export default function MoSummaryPage() {
  const [records, setRecords] = useState<MoRecord[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [searchText, setSearchText] = useState('')
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // 主來源：Supabase。localStorage 只當離線備援。
  const reload = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/argoerp/mo-summary', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`)
      const list: MoRecord[] = (json.records ?? []) as MoRecord[]
      setRecords(list)
      // 同步一份到 localStorage 當備援（供 order-batch-export 頁離線時用）
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch {}
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(`從 Supabase 讀取失敗，改顯示本機備援：${msg}`)
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) setRecords(JSON.parse(raw))
      } catch {}
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // 篩選
  const filtered = searchText.trim()
    ? records.filter(r =>
        Object.values(r).some(v => v?.toLowerCase().includes(searchText.toLowerCase()))
      )
    : records

  const toggleSelectAll = useCallback(() => {
    if (selectedRows.size === filtered.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(filtered.map((_, i) => i)))
  }, [selectedRows, filtered])

  const toggleRow = useCallback((idx: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }, [])

  // 刪除選取（同步刪 Supabase + localStorage）
  const handleDeleteSelected = useCallback(async () => {
    const filteredSet = new Set(selectedRows)
    const toDelete = [...filteredSet].map(i => filtered[i]?.mo_number).filter(Boolean) as string[]
    if (toDelete.length === 0) return
    if (!confirm(`確定刪除 ${toDelete.length} 筆製令記錄？此動作不可還原。`)) return

    try {
      const res = await fetch('/api/argoerp/mo-summary', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mo_numbers: toDelete }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`)

      const toDeleteSet = new Set(toDelete)
      const updated = records.filter(r => !toDeleteSet.has(r.mo_number))
      setRecords(updated)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch {}
      setSelectedRows(new Set())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`刪除失敗：${msg}`)
    }
  }, [selectedRows, filtered, records])

  // 匯出
  const handleExport = useCallback(() => {
    const rows = selectedRows.size > 0
      ? [...selectedRows].sort((a, b) => a - b).map(i => filtered[i]).filter(Boolean)
      : filtered

    if (rows.length === 0) return

    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`

    const headers = DISPLAY_COLS.map(c => c.label)
    const dataRows = rows.map(r => DISPLAY_COLS.map(c => r[c.key] ?? ''))

    if (exportFormat === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '製令總表')
      XLSX.writeFile(wb, `製令總表_${ts}.xlsx`)
    } else {
      const csvLines = [headers.join(',')]
      dataRows.forEach(cells => {
        csvLines.push(cells.map(v => {
          if (v.includes(',') || v.includes('\n') || v.includes('"')) return `"${v.replace(/"/g, '""')}"`
          return v
        }).join(','))
      })
      const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `製令總表_${ts}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [filtered, selectedRows, exportFormat])

  // 統計
  const factoryCounts = records.reduce((acc, r) => {
    acc[r.factory] = (acc[r.factory] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6 border-b border-slate-800 pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">製令總表</h1>
            <p className="text-slate-400 mt-1 text-sm">已確認轉出的製令記錄（資料儲存於 Supabase）</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* 重新整理 */}
            <button
              onClick={reload}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50 transition-colors text-sm"
              title="從 Supabase 重新讀取"
            >
              {loading ? '讀取中…' : '🔄 重新整理'}
            </button>
            {/* 搜尋 */}
            <input
              type="text"
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setSelectedRows(new Set()) }}
              placeholder="搜尋製令單號、貨號、客戶..."
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 w-60 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 placeholder:text-slate-600"
            />
            {filtered.length > 0 && (
              <>
                <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${exportFormat === 'csv' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >CSV</button>
                  <button
                    onClick={() => setExportFormat('xlsx')}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${exportFormat === 'xlsx' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >XLSX</button>
                </div>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors text-sm flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  匯出 {selectedRows.size > 0 ? `選取 ${selectedRows.size} 筆` : `全部 ${filtered.length} 筆`}
                </button>
              </>
            )}
            {selectedRows.size > 0 && (
              <button onClick={handleDeleteSelected} className="px-4 py-2 rounded-lg bg-red-900/60 border border-red-700/50 text-red-300 hover:bg-red-800 hover:text-white transition-colors text-sm">
                刪除選取 ({selectedRows.size})
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-950/40 border border-red-700/50 text-red-300 text-sm">
            ⚠ {errorMsg}
          </div>
        )}

        {/* 統計 */}
        <div className="mb-4 flex items-center gap-4 text-sm">
          <span className="text-slate-400">
            共 <span className="text-cyan-400 font-bold">{records.length}</span> 筆記錄
          </span>          {searchText && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">篩選結果 <span className="text-cyan-400 font-bold">{filtered.length}</span> 筆</span>
            </>
          )}
          {Object.entries(factoryCounts).sort().map(([f, count]) => (
            <span key={f} className={`px-2 py-0.5 rounded text-xs font-medium ${
              f === 'C' ? 'bg-orange-900/40 text-orange-300' :
              f === 'O' ? 'bg-purple-900/40 text-purple-300' :
              'bg-blue-900/40 text-blue-300'
            }`}>
              {f === 'C' ? '常平' : f === 'O' ? '委外' : '台北'} {count}
            </span>
          ))}
        </div>

        {/* 表格 */}
        {filtered.length > 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/80 border-b border-slate-700">
                    <th className="px-2 py-3 text-center sticky left-0 bg-slate-800/80 z-10 w-10">
                      <input type="checkbox" checked={selectedRows.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
                        className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/30" />
                    </th>
                    <th className="px-2 py-3 text-center text-slate-500 font-mono text-xs w-10">#</th>
                    {DISPLAY_COLS.map(col => (
                      <th key={col.key} className="px-3 py-3 text-left text-slate-300 font-medium whitespace-nowrap text-xs">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <tr key={idx} className={`border-b border-slate-800/50 transition-colors ${selectedRows.has(idx) ? 'bg-cyan-950/30' : idx % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-900/20'} hover:bg-slate-800/50`}>
                      <td className="px-2 py-2 text-center sticky left-0 bg-inherit z-10">
                        <input type="checkbox" checked={selectedRows.has(idx)} onChange={() => toggleRow(idx)}
                          className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/30" />
                      </td>
                      <td className="px-2 py-2 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                      {DISPLAY_COLS.map(col => (
                        <td key={col.key} className={`px-3 py-2 whitespace-nowrap max-w-[300px] truncate text-xs ${
                          col.key === 'factory'
                            ? row.factory === 'C' ? 'text-orange-300 font-bold' : row.factory === 'O' ? 'text-purple-300 font-bold' : 'text-blue-300 font-bold'
                            : 'text-slate-300'
                        }`} title={row[col.key] || ''}>
                          {col.key === 'factory'
                            ? (row.factory === 'C' ? 'C 常平' : row.factory === 'O' ? 'O 委外' : 'T 台北')
                            : (row[col.key] || <span className="text-slate-700">—</span>)
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
            <p className="text-slate-500">
              {searchText ? '無符合搜尋條件的記錄' : '尚無製令記錄，請從「訂單批量轉製令匯出」儲存至總表'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
