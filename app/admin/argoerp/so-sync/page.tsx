'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabaseClient'

// ─── 型別 ─────────────────────────────────────────────
interface SoLine {
  id: number
  project_id: string
  begin_date: string | null
  sales_name: string | null
  tpn_partner_id: string | null
  line_no: string
  description: string | null
  part: string | null
  duedate: string | null
  order_qty: number
  unit_of_measure: string | null
  synced_at: string
}

type SortCol = 'project_id' | 'begin_date' | 'tpn_partner_id' | 'duedate' | 'synced_at'
type SortDir = 'asc' | 'desc'

// ─── 欄位標頭 ──────────────────────────────────────────
const COLUMNS: { key: keyof SoLine; label: string; tw: string }[] = [
  { key: 'project_id',      label: '訂單編號',    tw: 'min-w-[140px]' },
  { key: 'begin_date',      label: '開立日期',    tw: 'min-w-[110px]' },
  { key: 'sales_name',      label: '業務員',      tw: 'min-w-[90px]'  },
  { key: 'tpn_partner_id',  label: '客戶代號',    tw: 'min-w-[100px]' },
  { key: 'line_no',         label: '序號',        tw: 'w-16 text-center' },
  { key: 'description',     label: '產品名稱',    tw: 'min-w-[160px]' },
  { key: 'part',            label: '規格',        tw: 'min-w-[120px]' },
  { key: 'duedate',         label: '交貨日(預)',   tw: 'min-w-[110px]' },
  { key: 'order_qty',       label: '數量',        tw: 'w-20 text-right' },
  { key: 'unit_of_measure', label: '單位',        tw: 'w-16 text-center' },
]

// ─── 頁面 ─────────────────────────────────────────────
export default function SoSyncPage() {
  const [rows, setRows]           = useState<SoLine[]>([])
  const [loading, setLoading]     = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [syncMsg, setSyncMsg]     = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [sortCol, setSortCol]     = useState<SortCol>('project_id')
  const [sortDir, setSortDir]     = useState<SortDir>('asc')
  const [lastSync, setLastSync]   = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('erp_so_lines')
      .select('*')
      .order(sortCol, { ascending: sortDir === 'asc' })
      .limit(2000)
    setLoading(false)
    if (error) { console.error(error); return }
    setRows(data ?? [])
    if (data && data.length > 0) {
      const latest = data.reduce((a, b) => a.synced_at > b.synced_at ? a : b)
      setLastSync(latest.synced_at)
    }
  }, [sortCol, sortDir])

  useEffect(() => { void fetchRows() }, [fetchRows])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    setSyncError(null)
    try {
      const res = await fetch('/api/argoerp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_so' }),
      })
      const json = await res.json() as {
        status: string
        syncedCount?: number
        headerCount?: number
        detailTotal?: number
        error?: string
        sampleDetailRow?: unknown
      }
      if (json.status === 'ok') {
        setSyncMsg(`同步完成：${String(json.syncedCount)} 筆 SO 明細（表頭 ${String(json.headerCount)} 筆，明細原始 ${String(json.detailTotal)} 筆）`)
        void fetchRows()
      } else {
        setSyncError(json.error ?? '同步失敗')
        if (json.sampleDetailRow) {
          console.warn('sampleDetailRow', json.sampleDetailRow)
        }
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : '網路錯誤')
    } finally {
      setSyncing(false)
    }
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sortableKeys: SortCol[] = ['project_id', 'begin_date', 'tpn_partner_id', 'duedate', 'synced_at']

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.project_id.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q) ||
      (r.tpn_partner_id ?? '').toLowerCase().includes(q) ||
      (r.sales_name ?? '').toLowerCase().includes(q) ||
      (r.part ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* 標題列 */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">銷售訂單同步</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            ARGO PJ_PROJECT + PJ_PROJECTDETAIL → erp_so_lines
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {lastSync && (
            <span className="text-xs text-gray-500">
              上次同步：{new Date(lastSync).toLocaleString('zh-TW')}
            </span>
          )}
          <button
            onClick={() => void handleSync()}
            disabled={syncing}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
          >
            {syncing ? '同步中...' : '立即同步'}
          </button>
        </div>
      </div>

      {/* 同步結果訊息 */}
      {syncMsg && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-teal-900/40 border border-teal-700 text-teal-300 text-sm">
          {syncMsg}
        </div>
      )}
      {syncError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm whitespace-pre-wrap">
          ⚠ {syncError}
        </div>
      )}

      {/* 搜尋 + 計數 */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="搜尋訂單號 / 品名 / 客戶 / 規格..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 w-80 focus:outline-none focus:border-teal-500"
        />
        <span className="text-sm text-gray-400">
          {loading ? '載入中...' : `顯示 ${filtered.length.toString()} / ${rows.length.toString()} 筆`}
        </span>
      </div>

      {/* 資料表 */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/80">
              {COLUMNS.map(col => {
                const isSortable = sortableKeys.includes(col.key as SortCol)
                const isActive = sortCol === col.key
                return (
                  <th
                    key={col.key}
                    onClick={isSortable ? () => toggleSort(col.key as SortCol) : undefined}
                    className={`px-3 py-2.5 text-left font-medium text-gray-300 whitespace-nowrap select-none ${col.tw} ${isSortable ? 'cursor-pointer hover:text-white' : ''}`}
                  >
                    {col.label}
                    {isActive && (
                      <span className="ml-1 text-teal-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-gray-500">
                  {rows.length === 0 ? '尚未同步，請點「立即同步」' : '無符合搜尋條件的資料'}
                </td>
              </tr>
            )}
            {filtered.map((row, i) => (
              <tr
                key={row.id}
                className={`border-t border-gray-800/60 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-900/30'}`}
              >
                <td className="px-3 py-2 font-mono text-teal-400">{row.project_id}</td>
                <td className="px-3 py-2 text-gray-300">{row.begin_date ?? '—'}</td>
                <td className="px-3 py-2 text-gray-300">{row.sales_name ?? '—'}</td>
                <td className="px-3 py-2 text-gray-300">{row.tpn_partner_id ?? '—'}</td>
                <td className="px-3 py-2 text-center text-gray-400">{row.line_no || '—'}</td>
                <td className="px-3 py-2 text-gray-200">{row.description ?? '—'}</td>
                <td className="px-3 py-2 text-gray-400 text-xs">{row.part ?? '—'}</td>
                <td className="px-3 py-2 text-yellow-400/80">{row.duedate ?? '—'}</td>
                <td className="px-3 py-2 text-right text-gray-200">{row.order_qty}</td>
                <td className="px-3 py-2 text-center text-gray-400">{row.unit_of_measure ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 說明 */}
      <div className="mt-4 text-xs text-gray-600">
        * 每次同步會清除舊資料後重寫。資料來源：ARGO PJ_PROJECT（PJT_TYPE=SO）JOIN PJ_PROJECTDETAIL。
      </div>
    </div>
  )
}
