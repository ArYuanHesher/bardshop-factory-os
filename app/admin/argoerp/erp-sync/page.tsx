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

interface SoLine {
  id: number
  project_id: string
  begin_date: string | null
  tpn_partner_id: string | null
  sales_id: number | null
  sales_name: string | null
  partner_name: string | null
  currency: string | null
  exchange_rate: number | null
  department: string | null
  sales_category: string | null
  hold_status: string | null
  line_no: string
  mbp_part: string | null
  mbp_ver: number | null
  description: string | null
  duedate: string | null
  order_qty_oru: number
  unit_of_measure_oru: string | null
  unit_price_oru: number
  grade: string | null
  remark: string | null
  create_date: string | null
  update_date: string | null
  synced_at: string
}

interface MoLine {
  id: number
  project_id: string
  begin_date: string | null
  end_date: string | null
  hold_status: string | null
  mo_begin_date: string | null
  line_no: string
  mbp_part: string | null
  mbp_lot_no: string | null
  order_qty: number
  source_order: string | null
  synced_at: string
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
const MO_PAGE_SIZE = 20
const SO_PAGE_SIZE = 20

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
    description: 'PJ_PROJECT 表頭查詢（PJT_TYPE=SO）。明細欄位請使用專屬「銷售訂單同步」頁面（/admin/argoerp/so-sync）。',
    defaultConfig: {
      table: 'PJ_PROJECT',
      customColumn: 'PROJECT_ID,BEGIN_DATE,SALES_NAME,TPN_PARTNER_ID',
      filters: [{ key: 'PJT_TYPE', value: 'SO' }],
      mapping: {
        docNoField: 'PROJECT_ID',
        subNoField: '',
        itemCodeField: '',
        descriptionField: '',
        qtyField: '',
        unitField: '',
        statusField: '',
        startDateField: 'BEGIN_DATE',
        endDateField: '',
        customerVendorField: 'TPN_PARTNER_ID',
        remarkField: 'SALES_NAME',
      },
    },
  },
  mo: {
    label: '製令單號',
    description: 'PJT_TYPE=MO。PJT_TYPE 在 PJ_PROJECT 表頭，單表查詢即可。',
    defaultConfig: {
      table: 'PJ_PROJECT',
      customColumn: '',
      filters: [{ key: 'PJT_TYPE', value: 'MO' }],
      mapping: {
        ...EMPTY_MAPPING,
        docNoField: 'PROJECT_ID',
        descriptionField: 'PROJECT_NAME',
        statusField: 'HOLD_STATUS',
        startDateField: 'BEGIN_DATE',
        endDateField: 'END_DATE',
        customerVendorField: 'IN_CHARGE',
      },
    },
  },
  po: {
    label: '採購單號',
    description: 'PJT_TYPE=PO。PJT_TYPE 在 PJ_PROJECT 表頭，單表查詢即可。',
    defaultConfig: {
      table: 'PJ_PROJECT',
      customColumn: '',
      filters: [{ key: 'PJT_TYPE', value: 'PO' }],
      mapping: {
        ...EMPTY_MAPPING,
        docNoField: 'PROJECT_ID',
        descriptionField: 'PROJECT_NAME',
        statusField: 'HOLD_STATUS',
        startDateField: 'BEGIN_DATE',
        endDateField: 'END_DATE',
        customerVendorField: 'IN_CHARGE',
      },
    },
  },
  subcontract: {
    label: '委外製令',
    description: 'PJT_TYPE=OO。PJT_TYPE 在 PJ_PROJECT 表頭，單表查詢即可。',
    defaultConfig: {
      table: 'PJ_PROJECT',
      customColumn: '',
      filters: [{ key: 'PJT_TYPE', value: 'OO' }],
      mapping: {
        ...EMPTY_MAPPING,
        docNoField: 'PROJECT_ID',
        descriptionField: 'PROJECT_NAME',
        statusField: 'HOLD_STATUS',
        startDateField: 'BEGIN_DATE',
        endDateField: 'END_DATE',
        customerVendorField: 'IN_CHARGE',
      },
    },
  },
}

const MAPPING_LABELS: { key: keyof PjSyncMapping; label: string; required?: boolean }[] = [
  { key: 'docNoField',        label: '訂單編號 PROJECT_ID',         required: true },
  { key: 'subNoField',        label: '序號 LINE_NO' },
  { key: 'itemCodeField',     label: '規格 PART' },
  { key: 'descriptionField',  label: '產品名稱 DESCRIPTION' },
  { key: 'qtyField',          label: '數量 ORDER_QTY' },
  { key: 'unitField',         label: '單位 UNIT_OF_MEASURE' },
  { key: 'statusField',       label: '狀態 HOLD_STATUS' },
  { key: 'startDateField',    label: '開立日期 BEGIN_DATE' },
  { key: 'endDateField',      label: '交貨日 DUEDATE' },
  { key: 'customerVendorField', label: '客戶代號 TPN_PARTNER_ID' },
  { key: 'remarkField',       label: '業務員 SALES_NAME' },
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
  const isSoTab = docKey === 'sales'
  const isMoTab = docKey === 'mo'
  const [config, setConfig] = useState<SyncConfig>(() => loadConfig(docKey))
  const [showConfig, setShowConfig] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState(true)
  const [rawSample, setRawSample] = useState<Record<string, unknown> | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [records, setRecords] = useState<PjRecord[]>([])
  const [soRecords, setSoRecords] = useState<SoLine[]>([])
  const [moRecords, setMoRecords] = useState<MoLine[]>([])
  const [moStatusFilter, setMoStatusFilter] = useState<'OPEN' | 'HOLD' | 'CLOSE' | null>('OPEN')
  const [moPage, setMoPage] = useState(1)
  const [soStatusFilter, setSoStatusFilter] = useState<'OPEN' | 'HOLD' | 'CLOSE' | null>('OPEN')
  const [soPage, setSoPage] = useState(1)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const configRef = useRef(config)
  configRef.current = config

  // 讀取 Supabase 資料
  const fetchRecords = useCallback(async (keyword = '', page = 1) => {
    setLoadingRecords(true)
    try {
      if (isSoTab) {
        const offset = (page - 1) * SO_PAGE_SIZE
        let query = supabase
          .from('erp_so_lines')
          .select('*', { count: 'exact' })
          .order('project_id', { ascending: true })
          .range(offset, offset + SO_PAGE_SIZE - 1)
        if (soStatusFilter) {
          query = query.eq('hold_status', soStatusFilter)
        }
        if (keyword.trim()) {
          const kw = keyword.trim()
          query = query.or(
            `project_id.ilike.%${kw}%,mbp_part.ilike.%${kw}%,partner_name.ilike.%${kw}%,sales_name.ilike.%${kw}%`
          )
        }
        const { data, count } = await query
        setSoRecords((data ?? []) as SoLine[])
        setTotalCount(count ?? 0)
      } else if (isMoTab) {
        const offset = (page - 1) * MO_PAGE_SIZE
        let query = supabase
          .from('erp_mo_lines')
          .select('*', { count: 'exact' })
          .order('project_id', { ascending: true })
          .range(offset, offset + MO_PAGE_SIZE - 1)
        if (moStatusFilter) {
          query = query.eq('hold_status', moStatusFilter)
        }
        if (keyword.trim()) {
          const kw = keyword.trim()
          query = query.or(
            `project_id.ilike.%${kw}%,mbp_part.ilike.%${kw}%,mbp_lot_no.ilike.%${kw}%,source_order.ilike.%${kw}%`
          )
        }
        const { data, count } = await query
        setMoRecords((data ?? []) as MoLine[])
        setTotalCount(count ?? 0)
      } else {
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
      }
    } catch {
      // ignore
    } finally {
      setLoadingRecords(false)
    }
  }, [isSoTab, isMoTab, meta.label, moStatusFilter, soStatusFilter])

  useEffect(() => { void fetchRecords() }, [fetchRecords])

  // MO 狀態篩選切換時回到第一頁
  const handleMoStatusFilter = (s: 'OPEN' | 'HOLD' | 'CLOSE' | null) => {
    setMoPage(1)
    setMoStatusFilter(s)
  }

  // MO 換頁
  const handleMoPageChange = (page: number) => {
    setMoPage(page)
    void fetchRecords(search, page)
  }

  // SO 狀態篩選切換時回到第一頁
  const handleSoStatusFilter = (s: 'OPEN' | 'HOLD' | 'CLOSE' | null) => {
    setSoPage(1)
    setSoStatusFilter(s)
  }

  // SO 換頁
  const handleSoPageChange = (page: number) => {
    setSoPage(page)
    void fetchRecords(search, page)
  }

  // MO 匯出 CSV（取全部筆數，不分頁）
  const handleMoExportCsv = async () => {
    let query = supabase
      .from('erp_mo_lines')
      .select('hold_status,project_id,source_order,line_no,mbp_part,order_qty,end_date,mo_begin_date,mbp_lot_no')
      .order('project_id', { ascending: true })
    if (moStatusFilter) query = query.eq('hold_status', moStatusFilter)
    if (search.trim()) {
      const kw = search.trim()
      query = query.or(`project_id.ilike.%${kw}%,mbp_part.ilike.%${kw}%,mbp_lot_no.ilike.%${kw}%,source_order.ilike.%${kw}%`)
    }
    const { data } = await query
    if (!data || data.length === 0) return
    const headers = ['狀態', '製令單號', '來源訂單', '編號', '生產貨號', '預訂產出量', '預定結案日', '開立日期', '批號']
    const rows = data.map((r) => [
      r.hold_status ?? '',
      r.project_id ?? '',
      r.source_order ?? '',
      r.line_no ?? '',
      r.mbp_part ?? '',
      r.order_qty ?? '',
      r.end_date ?? '',
      r.mo_begin_date ?? '',
      r.mbp_lot_no ?? '',
    ])
    const csvContent = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `製令單_${moStatusFilter ?? '全部'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // MO 列印（當頁）
  const handleMoPrint = () => {    const headers = ['狀態', '製令單號', '來源訂單', '編號', '生產貨號', '預訂產出量', '預定結案日', '開立日期', '批號']
    const rows = moRecords.map((r) => [
      r.hold_status ?? '—',
      r.project_id ?? '—',
      r.source_order ?? '—',
      r.line_no ?? '—',
      r.mbp_part ?? '—',
      r.order_qty > 0 ? r.order_qty.toLocaleString() : '—',
      r.end_date ?? '—',
      r.mo_begin_date ?? '—',
      r.mbp_lot_no ?? '—',
    ])
    const tableRows = rows.map((row) =>
      `<tr>${row.map((v) => `<td>${v}</td>`).join('')}</tr>`
    ).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>製令單列印</title>
<style>
  body { font-family: sans-serif; font-size: 11px; margin: 16px; }
  h2 { font-size: 14px; margin-bottom: 8px; }
  p { font-size: 10px; color: #666; margin-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #f0f0f0; font-weight: 600; text-align: left; padding: 4px 6px; border: 1px solid #ccc; }
  td { padding: 3px 6px; border: 1px solid #ddd; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { @page { margin: 10mm; size: landscape; } }
</style></head><body>
<h2>製令單列表</h2>
<p>狀態篩選：${moStatusFilter ?? '全部'} ／ 第 ${moPage} 頁 ／ 列印時間：${new Date().toLocaleString('zh-TW')}</p>
<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody></table>
<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`
    const w = window.open('', '_blank', 'width=1100,height=700')
    w?.document.write(html)
    w?.document.close()
  }

  // SO 匯出 CSV（取全部筆數，不分頁）
  const handleSoExportCsv = async () => {
    let query = supabase
      .from('erp_so_lines')
      .select('hold_status,project_id,line_no,mbp_part,description,order_qty_oru,duedate,partner_name,sales_name,remark')
      .order('project_id', { ascending: true })
    if (soStatusFilter) query = query.eq('hold_status', soStatusFilter)
    if (search.trim()) {
      const kw = search.trim()
      query = query.or(`project_id.ilike.%${kw}%,mbp_part.ilike.%${kw}%,partner_name.ilike.%${kw}%,sales_name.ilike.%${kw}%`)
    }
    const { data } = await query
    if (!data || data.length === 0) return
    const headers = ['狀態', '訂單編號', '序號', '料號', '品名/規格說明', '數量', '交貨日(預)', '客戶名稱', '業務員', '備註']
    const rows = data.map((r) => [
      r.hold_status ?? '',
      r.project_id ?? '',
      r.line_no ?? '',
      r.mbp_part ?? '',
      r.description ?? '',
      r.order_qty_oru ?? '',
      (r.duedate ?? '').slice(0, 10),
      r.partner_name ?? '',
      r.sales_name ?? '',
      r.remark ?? '',
    ])
    const csvContent = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `銷售訂單_${soStatusFilter ?? '全部'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // SO 列印（當頁）
  const handleSoPrint = () => {
    const headers = ['狀態', '訂單編號', '序號', '料號', '品名/規格說明', '數量', '交貨日(預)', '客戶名稱', '業務員', '備註']
    const rows = soRecords.map((r) => [
      r.hold_status ?? '—',
      r.project_id ?? '—',
      r.line_no ?? '—',
      r.mbp_part ?? '—',
      r.description ?? '—',
      r.order_qty_oru > 0 ? r.order_qty_oru.toLocaleString() : '—',
      r.duedate?.slice(0, 10) ?? '—',
      r.partner_name ?? '—',
      r.sales_name ?? '—',
      r.remark ?? '—',
    ])
    const tableRows = rows.map((row) =>
      `<tr>${row.map((v) => `<td>${v}</td>`).join('')}</tr>`
    ).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>銷售訂單列印</title>
<style>
  body { font-family: sans-serif; font-size: 11px; margin: 16px; }
  h2 { font-size: 14px; margin-bottom: 8px; }
  p { font-size: 10px; color: #666; margin-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #f0f0f0; font-weight: 600; text-align: left; padding: 4px 6px; border: 1px solid #ccc; }
  td { padding: 3px 6px; border: 1px solid #ddd; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { @page { margin: 10mm; size: landscape; } }
</style></head><body>
<h2>銷售訂單列表</h2>
<p>狀態篩選：${soStatusFilter ?? '全部'} ／ 第 ${soPage} 頁 ／ 列印時間：${new Date().toLocaleString('zh-TW')}</p>
<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody></table>
<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`
    const w = window.open('', '_blank', 'width=1100,height=700')
    w?.document.write(html)
    w?.document.close()
  }

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
      let res: Response

      if (isSoTab) {
        res = await fetch('/api/argoerp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync_so' }),
        })
      } else if (isMoTab) {
        res = await fetch('/api/argoerp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync_mo' }),
        })
      } else {
        const filtersObj: Record<string, string> = {}
        for (const { key, value } of cfg.filters) {
          if (key.trim()) filtersObj[key.trim()] = value
        }
        res = await fetch('/api/argoerp', {
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
      }

      const result = await res.json() as {
        status: string
        error?: string
        syncedCount?: number
        skippedCount?: number
        headerCount?: number
        detailTotal?: number
        detailAuthorized?: boolean
        detailError?: string
        totalRows?: number
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

      if (isSoTab) {
        setMessage(`✅ 已同步 ${result.syncedCount ?? 0} 筆銷售訂單明細（ARGO 原始 ${result.totalRows ?? 0} 筆）`)
      } else if (isMoTab) {
        const detailNote = result.detailAuthorized
          ? `明細 ${result.detailTotal ?? 0} 筆`
          : `明細未授權（${result.detailError ?? '未知錯誤'}）`
        setMessage(`✅ 已同步 ${result.syncedCount ?? 0} 筆製令（表頭 ${result.headerCount ?? 0} 筆，${detailNote}）`)
        if (!result.detailAuthorized) setMessageOk(false)
      } else {
        setMessage(`✅ 已同步 ${result.syncedCount ?? 0} 筆 ${meta.label}`)
      }
      setMessageOk(true)
      void fetchRecords(search)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '同步失敗')
      setMessageOk(false)
    } finally {
      setSyncing(false)
    }
  }

  const lastSynced = (isSoTab ? soRecords[0]?.synced_at : isMoTab ? moRecords[0]?.synced_at : records[0]?.synced_at)
    ? new Date((isSoTab ? soRecords[0]?.synced_at : isMoTab ? moRecords[0]?.synced_at : records[0]?.synced_at) as string).toLocaleString('zh-TW')
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
        <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (isSoTab) { setSoPage(1); void fetchRecords(search, 1) }
                else { setMoPage(1); void fetchRecords(search, 1) }
              }
            }}
            placeholder="搜尋單號 / 料號 / 品名..."
            className="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (isSoTab) { setSoPage(1); void fetchRecords(search, 1) }
              else { setMoPage(1); void fetchRecords(search, 1) }
            }}
            disabled={loadingRecords}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {loadingRecords ? '載入中...' : '搜尋'}
          </button>
          {isSoTab && (
            <div className="flex gap-1">
              {(['OPEN', 'HOLD', 'CLOSE', null] as const).map((s) => (
                <button
                  key={String(s)}
                  type="button"
                  onClick={() => handleSoStatusFilter(s)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    soStatusFilter === s
                      ? s === 'OPEN'  ? 'bg-green-700 text-white'
                        : s === 'HOLD'  ? 'bg-yellow-700 text-white'
                        : s === 'CLOSE' ? 'bg-slate-600 text-white'
                        : 'bg-cyan-700 text-white'
                      : 'border border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {s ?? '全部'}
                </button>
              ))}
            </div>
          )}
          {isMoTab && (
            <div className="flex gap-1">
              {(['OPEN', 'HOLD', 'CLOSE', null] as const).map((s) => (
                <button
                  key={String(s)}
                  type="button"
                  onClick={() => handleMoStatusFilter(s)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    moStatusFilter === s
                      ? s === 'OPEN'  ? 'bg-green-700 text-white'
                        : s === 'HOLD'  ? 'bg-yellow-700 text-white'
                        : s === 'CLOSE' ? 'bg-slate-600 text-white'
                        : 'bg-cyan-700 text-white'
                      : 'border border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {s ?? '全部'}
                </button>
              ))}
            </div>
          )}
          {(isSoTab || isMoTab) && totalCount !== null && (
            <span className="text-xs text-slate-500 ml-auto">
              共 {totalCount.toLocaleString()} 筆
            </span>
          )}
          {isSoTab && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void handleSoExportCsv()}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-emerald-400 hover:bg-slate-800"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M8 12l4 4m0 0l4-4m-4 4V4" /></svg>
                匯出 CSV
              </button>
              <button
                type="button"
                onClick={handleSoPrint}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-sky-400 hover:bg-slate-800"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" /></svg>
                列印
              </button>
            </div>
          )}
          {isMoTab && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void handleMoExportCsv()}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-emerald-400 hover:bg-slate-800"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M8 12l4 4m0 0l4-4m-4 4V4" /></svg>
                匯出 CSV
              </button>
              <button
                type="button"
                onClick={handleMoPrint}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-sky-400 hover:bg-slate-800"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" /></svg>
                列印
              </button>
            </div>
          )}
          {!isSoTab && !isMoTab && totalCount !== null && totalCount > 200 && (
            <span className="text-xs text-slate-500">顯示前 200 筆 / 共 {totalCount.toLocaleString()} 筆</span>
          )}
        </div>

        {(isSoTab ? soRecords.length === 0 : isMoTab ? moRecords.length === 0 : records.length === 0) && !loadingRecords ? (
          <p className="px-4 pb-4 text-xs text-slate-600">尚無資料，請先執行同步。{isSoTab ? '（需先在 Supabase 建立 erp_so_lines 表）' : isMoTab ? '（需先在 Supabase 建立 erp_mo_lines 表）' : ''}</p>
        ) : isSoTab ? (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">狀態</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">訂單編號</th>
                  <th className="px-3 py-2 text-center text-slate-400 font-medium">序號</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">料號</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">品名/規格說明</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">數量</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">交貨日(預)</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">客戶名稱</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">業務員</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">備註</th>
                </tr>
              </thead>
              <tbody>
                {soRecords.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-900/40">
                    <td className="px-3 py-2">
                      {r.hold_status ? (
                        <span className={`rounded px-1.5 py-0.5 text-xs ${
                          r.hold_status === 'OPEN'  ? 'bg-green-900/40 text-green-300' :
                          r.hold_status === 'HOLD'  ? 'bg-yellow-900/40 text-yellow-300' :
                          r.hold_status === 'CLOSE' ? 'bg-slate-800 text-slate-500' :
                          'bg-slate-800 text-slate-300'
                        }`}>{r.hold_status}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{r.project_id}</td>
                    <td className="px-3 py-2 text-center text-slate-400">{r.line_no || '—'}</td>
                    <td className="px-3 py-2 font-mono text-slate-200">{r.mbp_part ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-200 max-w-[200px] truncate" title={r.description ?? ''}>{r.description ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-200">{r.order_qty_oru > 0 ? r.order_qty_oru.toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-yellow-400/80">{r.duedate?.slice(0, 10) ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-300 max-w-[160px] truncate" title={r.partner_name ?? ''}>{r.partner_name ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-300">{r.sales_name ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400 max-w-[160px] truncate" title={r.remark ?? ''}>{r.remark ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* SO 分頁列 */}
          {totalCount !== null && totalCount > SO_PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5">
              <span className="text-xs text-slate-500">
                第 {soPage} 頁 / 共 {Math.ceil(totalCount / SO_PAGE_SIZE)} 頁（{totalCount.toLocaleString()} 筆）
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSoPageChange(soPage - 1)}
                  disabled={soPage <= 1}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一頁
                </button>
                {Array.from({ length: Math.min(7, Math.ceil(totalCount / SO_PAGE_SIZE)) }, (_, i) => {
                  const totalPages = Math.ceil(totalCount / SO_PAGE_SIZE)
                  let page: number
                  if (totalPages <= 7) {
                    page = i + 1
                  } else if (soPage <= 4) {
                    page = i + 1
                    if (i === 6) page = totalPages
                    if (i === 5) page = -1
                  } else if (soPage >= totalPages - 3) {
                    page = i === 0 ? 1 : i === 1 ? -1 : totalPages - (6 - i)
                  } else {
                    const map = [1, -1, soPage - 1, soPage, soPage + 1, -2, totalPages]
                    page = map[i]
                  }
                  if (page < 0) return (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-600">…</span>
                  )
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => handleSoPageChange(page)}
                      className={`min-w-[28px] rounded border px-1.5 py-1 text-xs transition-colors ${
                        soPage === page
                          ? 'border-cyan-600 bg-cyan-700 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => handleSoPageChange(soPage + 1)}
                  disabled={soPage * SO_PAGE_SIZE >= totalCount}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
          </>
        ) : isMoTab ? (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">狀態</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">製令單號</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">來源訂單</th>
                  <th className="px-3 py-2 text-center text-slate-400 font-medium">編號</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">生產貨號</th>
                  <th className="px-3 py-2 text-right text-slate-400 font-medium">預訂產出量</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">預定結案日</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">開立日期</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">批號</th>
                </tr>
              </thead>
              <tbody>
                {moRecords.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-900/40">
                    <td className="px-3 py-2">
                      {r.hold_status ? (
                        <span className={`rounded px-1.5 py-0.5 ${
                          r.hold_status === 'OPEN'  ? 'bg-green-900/40 text-green-300' :
                          r.hold_status === 'HOLD'  ? 'bg-yellow-900/40 text-yellow-300' :
                          r.hold_status === 'CLOSE' ? 'bg-slate-800 text-slate-500' :
                          'bg-slate-800 text-slate-300'
                        }`}>{r.hold_status}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{r.project_id}</td>
                    <td className="px-3 py-2 font-mono text-slate-300">{r.source_order ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-slate-400">{r.line_no || '—'}</td>
                    <td className="px-3 py-2 font-mono text-slate-200">{r.mbp_part ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-200">{r.order_qty > 0 ? r.order_qty.toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{r.end_date ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{r.mo_begin_date ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{r.mbp_lot_no ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* MO 分頁列 */}
          {totalCount !== null && totalCount > MO_PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5">
              <span className="text-xs text-slate-500">
                第 {moPage} 頁 / 共 {Math.ceil(totalCount / MO_PAGE_SIZE)} 頁（{totalCount.toLocaleString()} 筆）
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMoPageChange(moPage - 1)}
                  disabled={moPage <= 1}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一頁
                </button>
                {Array.from({ length: Math.min(7, Math.ceil(totalCount / MO_PAGE_SIZE)) }, (_, i) => {
                  const totalPages = Math.ceil(totalCount / MO_PAGE_SIZE)
                  let page: number
                  if (totalPages <= 7) {
                    page = i + 1
                  } else if (moPage <= 4) {
                    page = i + 1
                    if (i === 6) page = totalPages
                    if (i === 5) page = -1
                  } else if (moPage >= totalPages - 3) {
                    page = i === 0 ? 1 : i === 1 ? -1 : totalPages - (6 - i)
                  } else {
                    const map = [1, -1, moPage - 1, moPage, moPage + 1, -2, totalPages]
                    page = map[i]
                  }
                  if (page < 0) return (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-600">…</span>
                  )
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => handleMoPageChange(page)}
                      className={`min-w-[28px] rounded border px-1.5 py-1 text-xs transition-colors ${
                        moPage === page
                          ? 'border-cyan-600 bg-cyan-700 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => handleMoPageChange(moPage + 1)}
                  disabled={moPage * MO_PAGE_SIZE >= totalCount}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
          </>
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
