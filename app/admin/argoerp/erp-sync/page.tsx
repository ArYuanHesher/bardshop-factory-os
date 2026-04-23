'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../../lib/supabaseClient'

// ─── 型別 ─────────────────────────────────────────────
type DocTypeKey = 'sales' | 'mo' | 'po' | 'subcontract'

interface PjSyncMapping {
  docNoField: string
  subNoField: string
  itemCodeField: string
  descriptionField: string
  qtyField: string
  unitField: string
  statusField: string
  startDateField: string
  endDateField: string
  customerVendorField: string
  remarkField: string
}

interface SyncConfig {
  table: string
  customColumn: string
  filters: Array<{ key: string; value: string }>
  mapping: PjSyncMapping
}

interface PjRecord {
  id: number
  doc_type: string
  doc_no: string
  sub_no: string
  item_code: string | null
  description: string | null
  qty: number
  unit: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
  customer_vendor: string | null
  remark: string | null
  extra: Record<string, unknown> | null
  synced_at: string
}

// ─── 常數 ─────────────────────────────────────────────
const STORAGE_PREFIX = 'argoerp_pj_sync_v1_'

const EMPTY_MAPPING: PjSyncMapping = {
  docNoField: '',
  subNoField: '',
  itemCodeField: '',
  descriptionField: '',
  qtyField: '',
  unitField: '',
  statusField: '',
  startDateField: '',
  endDateField: '',
  customerVendorField: '',
  remarkField: '',
}

const DOC_TYPES: Record<DocTypeKey, {
  label: string
  description: string
  defaultConfig: SyncConfig
}> = {
  sales: {
    label: '銷售訂單',
    description: 'PROJECT_TYPE=SO。使用 PJ_PROJECT,PJ_PROJECTDETAIL 聯合查詢（PROJECT_TYPE 在 DETAIL 表）。',
    defaultConfig: {
      table: 'PJ_PROJECT,PJ_PROJECTDETAIL',
      customColumn: '',
      filters: [{ key: 'PROJECT_TYPE', value: 'SO' }],
      mapping: { ...EMPTY_MAPPING, docNoField: 'PROJECT_NO' },
    },
  },
  mo: {
    label: '製令單號',
    description: 'PROJECT_TYPE=MO。使用 PJ_PROJECT,PJ_PROJECTDETAIL 聯合查詢（PROJECT_TYPE 在 DETAIL 表）。',
    defaultConfig: {
      table: 'PJ_PROJECT,PJ_PROJECTDETAIL',
      customColumn: '',
      filters: [{ key: 'PROJECT_TYPE', value: 'MO' }],
      mapping: { ...EMPTY_MAPPING, docNoField: 'PROJECT_NO' },
    },
  },
  po: {
    label: '採購單號',
    description: 'PROJECT_TYPE=PO。使用 PJ_PROJECT,PJ_PROJECTDETAIL 聯合查詢（PROJECT_TYPE 在 DETAIL 表）。',
    defaultConfig: {
      table: 'PJ_PROJECT,PJ_PROJECTDETAIL',
      customColumn: '',
      filters: [{ key: 'PROJECT_TYPE', value: 'PO' }],
      mapping: { ...EMPTY_MAPPING, docNoField: 'PROJECT_NO' },
    },
  },
  subcontract: {
    label: '委外製令',
    description: 'PROJECT_TYPE=OO。使用 PJ_PROJECT,PJ_PROJECTDETAIL 聯合查詢（PROJECT_TYPE 在 DETAIL 表）。',
    defaultConfig: {
      table: 'PJ_PROJECT,PJ_PROJECTDETAIL',
      customColumn: '',
      filters: [{ key: 'PROJECT_TYPE', value: 'OO' }],
      mapping: { ...EMPTY_MAPPING, docNoField: 'PROJECT_NO' },
    },
  },
}

const MAPPING_LABELS: { key: keyof PjSyncMapping; label: string; required?: boolean }[] = [
  { key: 'docNoField', label: '主單號欄位', required: true },
  { key: 'subNoField', label: '子序號欄位' },
  { key: 'itemCodeField', label: '料號欄位' },
  { key: 'descriptionField', label: '品名欄位' },
  { key: 'qtyField', label: '數量欄位' },
  { key: 'unitField', label: '單位欄位' },
  { key: 'statusField', label: '狀態欄位' },
  { key: 'startDateField', label: '開始日期欄位' },
  { key: 'endDateField', label: '結束日期欄位' },
  { key: 'customerVendorField', label: '客戶/廠商欄位' },
  { key: 'remarkField', label: '備註欄位' },
]

// ─── 工具 ─────────────────────────────────────────────
function loadConfig(key: DocTypeKey): SyncConfig {
  if (typeof window === 'undefined') return DOC_TYPES[key].defaultConfig
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return DOC_TYPES[key].defaultConfig
    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    return {
      ...DOC_TYPES[key].defaultConfig,
      ...parsed,
      mapping: { ...DOC_TYPES[key].defaultConfig.mapping, ...(parsed.mapping ?? {}) },
      filters: parsed.filters ?? [],
    }
  } catch {
    return DOC_TYPES[key].defaultConfig
  }
}

function saveConfig(key: DocTypeKey, config: SyncConfig) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(config)) } catch {}
}

// ─── 子元件：單一同步卡片 ───────────────────────────────
interface SyncCardProps {
  docKey: DocTypeKey
}

function SyncCard({ docKey }: SyncCardProps) {
  const meta = DOC_TYPES[docKey]
  const [config, setConfig] = useState<SyncConfig>(() => loadConfig(docKey))
  const [showConfig, setShowConfig] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState(true)
  const [rawSample, setRawSample] = useState<Record<string, unknown> | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [records, setRecords] = useState<PjRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const configRef = useRef(config)
  configRef.current = config

  // 讀取 Supabase 資料
  const fetchRecords = useCallback(async (keyword = '') => {
    setLoadingRecords(true)
    try {
      let query = supabase
        .from('erp_pj_sync')
        .select('*', { count: 'exact' })
        .eq('doc_type', meta.label)
        .order('doc_no', { ascending: true })
        .limit(200)
      if (keyword.trim()) {
        const kw = keyword.trim()
        query = query.or(
          `doc_no.ilike.%${kw}%,item_code.ilike.%${kw}%,description.ilike.%${kw}%,customer_vendor.ilike.%${kw}%`
        )
      }
      const { data, count } = await query
      setRecords((data ?? []) as PjRecord[])
      setTotalCount(count ?? 0)
    } catch {
      // ignore
    } finally {
      setLoadingRecords(false)
    }
  }, [meta.label])

  useEffect(() => { void fetchRecords() }, [fetchRecords])

  // 儲存設定
  useEffect(() => { saveConfig(docKey, config) }, [docKey, config])

  const updateMapping = (key: keyof PjSyncMapping, value: string) => {
    setConfig((prev) => ({ ...prev, mapping: { ...prev.mapping, [key]: value } }))
  }

  const updateFilter = (index: number, field: 'key' | 'value', val: string) => {
    setConfig((prev) => {
      const next = [...prev.filters]
      next[index] = { ...next[index], [field]: val }
      return { ...prev, filters: next }
    })
  }

  const addFilter = () => {
    setConfig((prev) => ({ ...prev, filters: [...prev.filters, { key: '', value: '' }] }))
  }

  const removeFilter = (index: number) => {
    setConfig((prev) => ({ ...prev, filters: prev.filters.filter((_, i) => i !== index) }))
  }

  const handleSync = async () => {
    const cfg = configRef.current
    if (!cfg.table.trim()) {
      setMessage('請先填入 ARGO TABLE 名稱')
      setMessageOk(false)
      setShowConfig(true)
      return
    }
    if (!cfg.mapping.docNoField.trim()) {
      setMessage('主單號欄位不能為空')
      setMessageOk(false)
      setShowConfig(true)
      return
    }

    setSyncing(true)
    setMessage('')
    setRawSample(null)

    try {
      const filtersObj: Record<string, string> = {}
      for (const { key, value } of cfg.filters) {
        if (key.trim()) filtersObj[key.trim()] = value
      }

      const res = await fetch('/api/argoerp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_pj',
          table: cfg.table.trim(),
          customColumn: cfg.customColumn.trim() || undefined,
          filters: Object.keys(filtersObj).length > 0 ? filtersObj : undefined,
          docType: meta.label,
          mapping: cfg.mapping,
        }),
      })

      const result = await res.json() as {
        status: string
        error?: string
        syncedCount?: number
        skippedCount?: number
        rawSample?: Record<string, unknown>
        rawText?: string
        debugSparam?: Record<string, unknown>
      }

      if (result.rawSample) setRawSample(result.rawSample)

      if (result.status !== 'ok') {
        const sparamInfo = result.debugSparam
          ? `\n\n送出參數：${Object.entries(result.debugSparam).filter(([k]) => !['APIKEY1','APIKEY2','APIKEY3'].includes(k)).map(([k,v]) => `${k}=${String(v)}`).join(', ')}` : ''
        const detail = result.rawText ? `\n\nARGO 原始回應：${result.rawText.slice(0, 300)}` : ''
        setMessage((result.error ?? '同步失敗') + sparamInfo + detail)
        setMessageOk(false)
        if (result.rawSample) setShowRaw(true)
        return
      }

      setMessage(`✅ 已同步 ${result.syncedCount ?? 0} 筆 ${meta.label}`)
      setMessageOk(true)
      void fetchRecords(search)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '同步失敗')
      setMessageOk(false)
    } finally {
      setSyncing(false)
    }
  }

  const lastSynced = records[0]?.synced_at
    ? new Date(records[0].synced_at).toLocaleString('zh-TW')
    : null

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60">
      {/* 頭部 */}
      <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">{meta.label}</h3>
          <p className="mt-1 text-xs text-slate-400">{meta.description}</p>
          {lastSynced && (
            <p className="mt-1 text-xs text-slate-500">
              上次同步：{lastSynced}　共 {(totalCount ?? 0).toLocaleString()} 筆
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfig((p) => !p)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            {showConfig ? '收合設定' : '展開設定'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_PREFIX + docKey)
              setConfig(DOC_TYPES[docKey].defaultConfig)
              setShowConfig(true)
              setMessage('')
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            重置預設
          </button>
          {rawSample && (
            <button
              type="button"
              onClick={() => setShowRaw((p) => !p)}
              className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-900/40"
            >
              {showRaw ? '隱藏原始欄位' : '查看原始欄位'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500"
          >
            {syncing ? '同步中...' : `同步 ${meta.label}`}
          </button>
        </div>
      </div>

      {/* 訊息列 */}
      {message && (
        <div className={`border-t border-slate-800 px-4 py-2 text-sm ${messageOk ? 'text-emerald-300' : 'text-red-300'}`}>
          {message}
        </div>
      )}

      {/* 原始欄位預覽 */}
      {showRaw && rawSample && (
        <div className="border-t border-amber-800/40 bg-amber-950/20 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-amber-400">ARGO 回傳第一筆原始欄位（用來設定下方欄位名稱）</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(rawSample).map(([k, v]) => (
              <span
                key={k}
                className="rounded bg-slate-800 px-2 py-1 font-mono text-xs text-amber-300"
                title={String(v)}
              >
                {k}
                <span className="ml-1 text-slate-500">= {String(v).slice(0, 20)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 設定區 */}
      {showConfig && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-4">
          {/* TABLE / CUSTOMCOLUMN */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">TABLE <span className="text-red-400">*</span></label>
              <input
                value={config.table}
                onChange={(e) => setConfig((p) => ({ ...p, table: e.target.value }))}
                placeholder="PJ_PROJECT 或 PJ_PROJECTDETAIL"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">CUSTOMCOLUMN（留空 = 查全部欄位）</label>
              <input
                value={config.customColumn}
                onChange={(e) => setConfig((p) => ({ ...p, customColumn: e.target.value }))}
                placeholder="PROJECT_NO,DOC_NO,QTY..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              />
            </div>
          </div>

          {/* 過濾條件（動態新增） */}
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs text-slate-400">ARGO 過濾條件（篩選此類型資料用）</span>
              <button
                type="button"
                onClick={addFilter}
                className="rounded bg-slate-800 px-2 py-0.5 text-xs text-cyan-400 hover:bg-slate-700"
              >
                + 新增條件
              </button>
            </div>
            {config.filters.length === 0 && (
              <p className="text-xs text-slate-600">（無過濾條件，查全部資料）</p>
            )}
            {config.filters.map((f, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input
                  value={f.key}
                  onChange={(e) => updateFilter(i, 'key', e.target.value)}
                  placeholder="欄位名稱 例如 DOC_TYPE"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
                />
                <input
                  value={f.value}
                  onChange={(e) => updateFilter(i, 'value', e.target.value)}
                  placeholder="值 例如 SO"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeFilter(i)}
                  className="rounded bg-red-900/30 px-2 text-xs text-red-400 hover:bg-red-900/60"
                >
                  刪
                </button>
              </div>
            ))}
          </div>

          {/* 欄位映射 */}
          <div>
            <p className="mb-2 text-xs text-slate-400">欄位映射（填 ARGO 實際回傳的欄位名稱）</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {MAPPING_LABELS.map(({ key, label, required }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-slate-500">
                    {label} {required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    value={config.mapping[key]}
                    onChange={(e) => updateMapping(key, e.target.value)}
                    placeholder={required ? '必填' : '可留空'}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-600">
            💡 先按「同步」讓 ARGO 回傳資料，再點「查看原始欄位」找到正確的欄位名稱填入上方。
          </p>
        </div>
      )}

      {/* 資料表格 */}
      <div className="border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void fetchRecords(search) }}
            placeholder="搜尋單號 / 料號 / 品名..."
            className="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void fetchRecords(search)}
            disabled={loadingRecords}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {loadingRecords ? '載入中...' : '搜尋'}
          </button>
          {totalCount !== null && totalCount > 200 && (
            <span className="text-xs text-slate-500">顯示前 200 筆 / 共 {totalCount.toLocaleString()} 筆</span>
          )}
        </div>

        {records.length === 0 && !loadingRecords ? (
          <p className="px-4 pb-4 text-xs text-slate-600">尚無資料，請先執行同步。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">主單號</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">子序號</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">料號</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">品名</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">數量</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">單位</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">狀態</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">開始日</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">結束日</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">客戶/廠商</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">備註</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-900/40">
                    <td className="px-3 py-2 font-mono text-cyan-300">{r.doc_no}</td>
                    <td className="px-3 py-2 text-slate-400">{r.sub_no || '—'}</td>
                    <td className="px-3 py-2 font-mono text-slate-300">{r.item_code ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-300 max-w-[160px] truncate">{r.description ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{r.qty > 0 ? r.qty.toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{r.unit ?? '—'}</td>
                    <td className="px-3 py-2">
                      {r.status ? (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{r.status}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{r.start_date ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{r.end_date ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-300 max-w-[120px] truncate">{r.customer_vendor ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate">{r.remark ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 主頁面 ──────────────────────────────────────────
const TABS: { key: DocTypeKey; label: string }[] = [
  { key: 'sales', label: '銷售訂單' },
  { key: 'mo', label: '製令單號' },
  { key: 'po', label: '採購單號' },
  { key: 'subcontract', label: '委外製令' },
]

export default function ErpSyncPage() {
  const [activeTab, setActiveTab] = useState<DocTypeKey>('sales')

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8">
      {/* 頁頭 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">ERP 同步區</h1>
        <p className="mt-1 text-sm text-slate-400">
          從 ARGO ERP PJ 系列端口同步四類單據資料到 Supabase，供後續頁面自動引用。
        </p>
        <div className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/20 px-4 py-2 text-xs text-amber-300">
          💡 首次使用：點「展開設定」→ 按「同步」→ 點「查看原始欄位」→ 填入正確欄位名稱後再次同步。
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-cyan-700 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <SyncCard key={activeTab} docKey={activeTab} />
    </div>
  )
}
