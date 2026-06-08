'use client'

/**
 * 出單表➜委外請購
 * ArgoERP IFAF105 — 請購單（PR）介面
 *
 * 一物一單：每個委外品項各自產生一張請購單
 * 請購單號格式：MPO + 銷售訂單數字部分 + 2位 SO 序號（match_line_no）
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../../../lib/supabaseClient'

interface SourceRow {
  row_key?: string
  order_number: string
  doc_type: string
  factory: 'T' | 'C' | 'O'
  mo_number?: string | null
  pr_number?: string | null
  customer: string
  item_code: string
  item_name: string
  note: string
  quantity: string
  delivery_date: string
  match_line_no?: string | null
  po_status?: string | null
  po_number?: string | null
}

interface PrHeader {
  apply_date: string
  department: string
  hold_status: 'OPEN' | 'HOLD' | 'CLOSE' | 'UNSIGNED'
  currency: string
}

interface LineEdit {
  line_no: string
  mbp_ver: string
  uom: string
}

const HEADER_KEY = 'argoerp_pr_o_header_v1'
const ERP_KEYS = [
  'APPLY_ID',
  'APPLY_DATE',
  'SEG_SEGMENT_NO_DEPARTMENT',
  'HOLD_STATUS',
  'LINE_NO',
  'MBP_PART',
  'MBP_VER',
  'MBP_LOT_NO',
  'UNIT_OF_MEASURE_ORU',
  'ORDER_QTY_ORU',
  'CURRENCY',
  'DUEDATE',
] as const

function fmtDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function extractOrderNums(orderNo: string): string {
  return orderNo.replace(/\D/g, '')
}

function genRowApplyNos(rows: SourceRow[]): string[] {
  const counters = new Map<string, number>()
  return rows.map(row => {
    const nums = extractOrderNums(row.order_number)
    const lineNo = row.match_line_no != null ? parseInt(row.match_line_no, 10) : Number.NaN
    if (!Number.isNaN(lineNo) && lineNo > 0) {
      return `MPO${nums}${String(lineNo).padStart(2, '0')}`
    }
    const c = (counters.get(nums) ?? 0) + 1
    counters.set(nums, c)
    return `MPO${nums}${String(c).padStart(2, '0')}`
  })
}

function makeDefaultHeader(): PrHeader {
  return {
    apply_date: fmtDate(new Date()),
    department: 'M1100',
    hold_status: 'OPEN',
    currency: 'CNY',
  }
}

function isMpoImportedRow(row: SourceRow): boolean {
  const moNo = String(row.mo_number ?? '').trim().toUpperCase()
  const prNo = String(row.pr_number ?? '').trim().toUpperCase()
  return moNo.startsWith('MPO') || prNo.startsWith('MPO')
}

export default function PrBatchExportOPage() {
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([])
  const [importedMpoRows, setImportedMpoRows] = useState<SourceRow[]>([])
  const [lineEdits, setLineEdits] = useState<LineEdit[]>([])
  const [rowApplyNos, setRowApplyNos] = useState<string[]>([])
  const [header, setHeader] = useState<PrHeader>(makeDefaultHeader)

  const [availDates, setAvailDates] = useState<{ sheet_date: string; row_count: number }[]>([])
  const [pickerDate, setPickerDate] = useState('')
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pending' | 'imported'>('pending')
  const [datesLoading, setDatesLoading] = useState(false)

  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null)
  const [msg, setMsg] = useState('')
  const [unitMap, setUnitMap] = useState<Record<string, string>>({})
  const [seqMismatchIdx, setSeqMismatchIdx] = useState<Set<number>>(new Set())

  const [prSearchId, setPrSearchId] = useState('')
  const [prSearching, setPrSearching] = useState(false)
  const [prSyncRows, setPrSyncRows] = useState<Array<Record<string, unknown>> | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HEADER_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setHeader({ ...makeDefaultHeader(), ...parsed })
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(HEADER_KEY, JSON.stringify(header))
  }, [header])

  useEffect(() => {
    setDatesLoading(true)
    fetch('/api/argoerp/daily-order-sheet')
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setAvailDates(j.sheets ?? [])
          if (j.sheets?.length && !pickerDate) setPickerDate(j.sheets[0].sheet_date)
        }
      })
      .catch(() => {})
      .finally(() => setDatesLoading(false))
  }, [pickerDate])

  const loadUnitMapForRows = useCallback(async (rows: SourceRow[]) => {
    const partCodes = Array.from(new Set(rows.map(r => r.item_code).filter(Boolean)))
    if (partCodes.length === 0) {
      const emptyMap: Record<string, string> = {}
      setUnitMap(emptyMap)
      return emptyMap
    }

    const { data, error } = await supabase
      .from('mm_bom_part_units')
      .select('part_code, unit_of_measure')
      .in('part_code', partCodes)

    if (error) throw error

    const nextMap: Record<string, string> = {}
    for (const item of (data ?? []) as Array<{ part_code: string; unit_of_measure: string | null }>) {
      if (item.part_code && item.unit_of_measure) {
        nextMap[item.part_code] = item.unit_of_measure
      }
    }
    setUnitMap(nextMap)
    return nextMap
  }, [])

  const loadSheet = useCallback(async (date: string) => {
    if (!date) return
    try {
      const r = await fetch(`/api/argoerp/daily-order-sheet?date=${date}`)
      const j = await r.json()
      if (!j.success || !j.sheet) {
        alert(`找不到 ${date} 的出單表`)
        return
      }

      const allORows = (j.sheet.rows ?? []).filter((x: SourceRow) => x.factory === 'O')
      const normalizedRows: SourceRow[] = allORows
        .filter((x: SourceRow) => x.po_status !== 'no_po')
        .map((x: SourceRow) => ({ ...x, match_line_no: x.match_line_no ?? null }))

      // 舊資料補償：早期已匯入請購但僅回寫 mo_number=po_number，沒有 pr_number。
      // 這裡用 APPLY_ID 規則補出 pr_number，並回寫到 daily_order_sheets，避免後續頁面判斷遺漏。
      const legacyApplyNos = genRowApplyNos(normalizedRows)
      const legacyBackfillUpdates: Array<Record<string, unknown>> = []
      const normalizedWithBackfill = normalizedRows.map((row, idx) => {
        const hasLegacyImportedMark =
          row.factory === 'O' &&
          row.po_status === 'matched' &&
          !!row.po_number &&
          row.mo_number === row.po_number &&
          !String(row.pr_number ?? '').trim()

        if (!hasLegacyImportedMark) return row

        const backfilledPrNo = legacyApplyNos[idx] ?? ''
        if (row.row_key && backfilledPrNo) {
          legacyBackfillUpdates.push({ row_key: row.row_key, pr_number: backfilledPrNo })
        }
        return { ...row, pr_number: backfilledPrNo || null }
      })

      if (legacyBackfillUpdates.length > 0) {
        fetch('/api/argoerp/daily-order-sheet', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheet_date: date, updates: legacyBackfillUpdates }),
        }).catch(() => {})
      }

      const mpoImportedRows: SourceRow[] = normalizedWithBackfill
        .filter(isMpoImportedRow)
        .map((row) => {
          if (!String(row.pr_number ?? '').trim() && String(row.mo_number ?? '').trim().toUpperCase().startsWith('MPO')) {
            return { ...row, pr_number: row.mo_number ?? null }
          }
          return row
        })

      const rows: SourceRow[] = normalizedWithBackfill.filter(x => !isMpoImportedRow(x))

      if (allORows.length === 0) {
        alert(`${date} 出單表中沒有委外廠訂單`)
        return
      }
      if (rows.length === 0 && mpoImportedRows.length === 0) {
        alert(`${date} 委外廠訂單皆標記為無須採購，無可轉請購資料`)
        return
      }

      const fetchedUnitMap = await loadUnitMapForRows(normalizedWithBackfill)
      setSourceRows(rows)
      setImportedMpoRows(mpoImportedRows)
      setLineEdits(rows.map(row => ({
        line_no: '1',
        mbp_ver: '1',
        uom: fetchedUnitMap[row.item_code] || 'PCS',
      })))
      setRowApplyNos(genRowApplyNos(rows))
      setLoadedDate(date)
      setActiveTab('pending')
      setSeqMismatchIdx(new Set())
      if (rows.length === 0 && mpoImportedRows.length > 0) {
        setMsg(`ℹ️ 此日期委外列皆已匹配 MPO（${mpoImportedRows.length} 筆），已移至「已匯入(MPO)」分頁`)
      } else {
        setMsg('')
      }
    } catch (e) {
      alert(`載入失敗：${e}`)
    }
  }, [loadUnitMapForRows])

  const payload = useMemo<Array<Record<string, string>>>(() => {
    return sourceRows.map((row, i) => {
      const edit = lineEdits[i] ?? { line_no: '1', mbp_ver: '1', uom: 'PCS' }
      return {
        APPLY_ID: rowApplyNos[i] ?? '',
        APPLY_DATE: header.apply_date,
        SEG_SEGMENT_NO_DEPARTMENT: header.department,
        HOLD_STATUS: header.hold_status,
        LINE_NO: edit.line_no || '1',
        MBP_PART: row.item_code,
        MBP_VER: edit.mbp_ver || '1',
        MBP_LOT_NO: row.order_number,
        UNIT_OF_MEASURE_ORU: edit.uom || 'PCS',
        ORDER_QTY_ORU: row.quantity,
        CURRENCY: header.currency,
        DUEDATE: row.delivery_date,
      }
    })
  }, [sourceRows, lineEdits, rowApplyNos, header])

  const doExport = useCallback((fmt: 'csv' | 'xlsx' = 'csv') => {
    if (payload.length === 0) return

    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const fileBase = `ArgoERP_委外請購單_BATCH_${loadedDate ?? ts}_${ts}`
    const rows = payload.map(r => ERP_KEYS.map(k => r[k] ?? ''))

    if (fmt === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([[...ERP_KEYS], ...rows])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '委外請購批次')
      XLSX.writeFile(wb, `${fileBase}.xlsx`)
      return
    }

    const csvLines = [[...ERP_KEYS].join(','), ...rows.map(row => row.map(v => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v.replace(/"/g, '""')}"`
      return v
    }).join(','))]
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileBase}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [payload, loadedDate])

  const handleImport = useCallback(async () => {
    if (payload.length === 0) {
      alert('尚無可匯入資料')
      return
    }
    if (!header.department.trim()) {
      alert('請填寫請購部門')
      return
    }
    if (!confirm(`確認逐張匯入 ${payload.length} 張委外請購單至 ArgoERP？`)) return

    const unitMismatch = sourceRows
      .map((row, i) => {
        const erpUnit = unitMap[row.item_code]
        const currentUnit = lineEdits[i]?.uom?.trim() || ''
        if (!erpUnit) return null
        if (currentUnit === erpUnit) return null
        return `${row.item_code}：目前 ${currentUnit || '空白'}，ERP ${erpUnit}`
      })
      .filter((x): x is string => Boolean(x))

    if (unitMismatch.length > 0) {
      alert(`單位與 ERP 對應不一致，請先修正後再匯入：\n${unitMismatch.slice(0, 10).join('\n')}${unitMismatch.length > 10 ? `\n…（共 ${unitMismatch.length} 筆）` : ''}`)
      return
    }

    setImporting(true)
    setMsg('')
    setImportProgress({ done: 0, total: payload.length, errors: [] })
    const errors: string[] = []
    const sheetUpdates: Array<Record<string, unknown>> = []

    for (let i = 0; i < payload.length; i++) {
      try {
        const res = await fetch('/api/argoerp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'import', interfaceId: 'IFAF105', data: [payload[i]] }),
        })
        const result = await res.json()
        if (!res.ok || !result?.success) {
          const raw = typeof result?.rawText === 'string'
            ? result.rawText.slice(0, 200)
            : JSON.stringify(result?.apiResult ?? '').slice(0, 200)
          errors.push(`${rowApplyNos[i]}: ${result?.error || `HTTP ${res.status}`} — ${raw}`)
        } else {
          const src = sourceRows[i]
          if (loadedDate && src?.row_key) {
            const hasMatchedPo = src.po_status === 'matched' && !!src.po_number
            if (hasMatchedPo) {
              sheetUpdates.push({
                row_key: src.row_key,
                mo_number: src.po_number,
                pr_number: rowApplyNos[i] ?? '',
                po_number: src.po_number,
                po_status: 'matched',
              })
            } else {
              sheetUpdates.push({
                row_key: src.row_key,
                mo_number: rowApplyNos[i] ?? '',
                pr_number: rowApplyNos[i] ?? '',
                po_status: null,
              })
            }
          }
        }
      } catch (e) {
        errors.push(`${rowApplyNos[i]}: ${e instanceof Error ? e.message : String(e)}`)
      }
      setImportProgress({ done: i + 1, total: payload.length, errors: [...errors] })
    }

    let sheetSyncMsg = ''
    if (loadedDate && sheetUpdates.length > 0) {
      try {
        const patchRes = await fetch('/api/argoerp/daily-order-sheet', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet_date: loadedDate,
            updates: sheetUpdates,
          }),
        })
        const patchJson = await patchRes.json()
        if (!patchRes.ok || !patchJson?.success) {
          throw new Error(patchJson?.error || `HTTP ${patchRes.status}`)
        }
        sheetSyncMsg = `，已回寫出單表 ${sheetUpdates.length} 筆`
      } catch (e) {
        sheetSyncMsg = `，但出單表回寫失敗：${e instanceof Error ? e.message : String(e)}`
      }
    }

    const okCount = payload.length - errors.length
    if (errors.length === 0) {
      const m = `✅ 全部 ${payload.length} 張委外請購單已匯入 ERP${sheetSyncMsg}`
      setMsg(m)
      alert(m)
      setSourceRows([])
      setLineEdits([])
      setRowApplyNos([])
      setLoadedDate(null)
    } else {
      const m = `⚠️ 匯入完成：${okCount} 成功，${errors.length} 失敗${sheetSyncMsg}`
      setMsg(m)
      alert(`${m}\n\n失敗明細：\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n…（共 ${errors.length} 筆）` : ''}`)
    }

    setImporting(false)
    setTimeout(() => setImportProgress(null), 12000)
  }, [payload, rowApplyNos, header.department, sourceRows, loadedDate, lineEdits, unitMap])

  const setH = useCallback(<K extends keyof PrHeader>(k: K, v: PrHeader[K]) => {
    setHeader(prev => ({ ...prev, [k]: v }))
  }, [])

  const setLE = useCallback((i: number, k: keyof LineEdit, v: string) => {
    setLineEdits(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e))
  }, [])

  const setApplyNo = useCallback((i: number, v: string) => {
    setRowApplyNos(prev => prev.map((n, idx) => idx === i ? v : n))
  }, [])

  const searchSyncedPr = useCallback(async () => {
    const q = prSearchId.trim()
    if (!q) {
      setPrSyncRows(null)
      return
    }
    setPrSearching(true)
    setMsg('')
    try {
      const { data, error } = await supabase
        .from('erp_pj_sync')
        .select('*')
        .eq('doc_type', '請購單號')
        .ilike('doc_no', `%${q}%`)
        .order('doc_no', { ascending: true })
        .order('sub_no', { ascending: true })
      if (error) throw error
      setPrSyncRows(data ?? [])
    } catch (e) {
      setMsg(`❌ 查詢失敗：${e instanceof Error ? e.message : String(e)}`)
      setPrSyncRows(null)
    } finally {
      setPrSearching(false)
    }
  }, [prSearchId])

  const compareSourceSequence = useCallback(() => {
    if (sourceRows.length === 0) {
      setMsg('⚠️ 尚未載入資料，無法比對來源序號')
      return
    }

    const mismatch = new Set<number>()
    for (let i = 0; i < sourceRows.length; i++) {
      const row = sourceRows[i]
      const nums = extractOrderNums(row.order_number)
      const sourceSeq = (() => {
        const n = row.match_line_no != null ? parseInt(row.match_line_no, 10) : Number.NaN
        return !Number.isNaN(n) && n > 0 ? n : 1
      })()
      const expectedApply = `MPO${nums}${String(sourceSeq).padStart(2, '0')}`
      if ((rowApplyNos[i] ?? '') !== expectedApply) mismatch.add(i)
    }

    setSeqMismatchIdx(mismatch)
    if (mismatch.size === 0) {
      setMsg('✅ 來源序號比對一致')
    } else {
      setMsg(`⚠️ 來源序號比對完成：${mismatch.size} 筆不一致（已標示）`)
    }
  }, [sourceRows, rowApplyNos])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-[1500px] mx-auto space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">出單表➜委外請購</h1>
            <p className="text-slate-400 text-sm mt-1">ArgoERP IFAF105（PJBF084）｜一物一單｜請購單號前綴 MPO</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={pickerDate}
              onChange={e => setPickerDate(e.target.value)}
              className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm"
            >
              <option value="">選擇日期</option>
              {availDates.map(d => (
                <option key={d.sheet_date} value={d.sheet_date}>{d.sheet_date}（{d.row_count} 筆）</option>
              ))}
            </select>
            <button
              onClick={() => void loadSheet(pickerDate)}
              disabled={!pickerDate || datesLoading}
              className="px-4 py-2 rounded bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-500 text-sm"
            >
              {datesLoading ? '讀取中…' : '載入委外列'}
            </button>
          </div>
        </div>

        <section className="bg-slate-900 border border-slate-800 rounded p-4">
          <h2 className="font-semibold mb-3">請購表頭（必填）</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <label className="flex flex-col gap-1">開立日期
              <input value={header.apply_date} onChange={e => setH('apply_date', e.target.value)} className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700" />
            </label>
            <label className="flex flex-col gap-1">請購部門
              <input value={header.department} onChange={e => setH('department', e.target.value)} className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700" />
            </label>
            <label className="flex flex-col gap-1">請購單狀態
              <select value={header.hold_status} onChange={e => setH('hold_status', e.target.value as PrHeader['hold_status'])} className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700">
                <option value="OPEN">OPEN</option>
                <option value="HOLD">HOLD</option>
                <option value="CLOSE">CLOSE</option>
                <option value="UNSIGNED">UNSIGNED</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">幣別
              <input value={header.currency} onChange={e => setH('currency', e.target.value)} className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700" />
            </label>
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="mb-3 flex items-center gap-2 text-xs">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded border transition-colors ${activeTab === 'pending' ? 'bg-cyan-900/40 border-cyan-700 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
            >
              待匯入（{sourceRows.length}）
            </button>
            <button
              onClick={() => setActiveTab('imported')}
              className={`px-3 py-1.5 rounded border transition-colors ${activeTab === 'imported' ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
            >
              已匯入(MPO)（{importedMpoRows.length}）
            </button>
          </div>

          {activeTab === 'pending' && (
            <>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="font-semibold">明細（{sourceRows.length} 筆）</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => compareSourceSequence()} disabled={sourceRows.length === 0} className="px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 text-sm">比對來源序號</button>
              <button onClick={() => doExport('csv')} disabled={payload.length === 0} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-sm">匯出 CSV</button>
              <button onClick={() => doExport('xlsx')} disabled={payload.length === 0} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-sm">匯出 XLSX</button>
              <button onClick={() => void handleImport()} disabled={importing || payload.length === 0} className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-sm">
                {importing ? '匯入中…' : `匯入 ERP（${payload.length}）`}
              </button>
            </div>
          </div>

          {importProgress && (
            <div className="mb-3 text-xs text-slate-300">進度：{importProgress.done} / {importProgress.total}{importProgress.errors.length > 0 ? `｜失敗 ${importProgress.errors.length}` : ''}</div>
          )}

          {msg && <div className={`mb-3 text-sm ${msg.startsWith('❌') || msg.startsWith('⚠️') ? 'text-amber-300' : 'text-emerald-300'}`}>{msg}</div>}

          <div className="overflow-auto border border-slate-800 rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">請購單號 (APPLY_ID)</th>
                  <th className="px-2 py-2 text-left">來源單號</th>
                  <th className="px-2 py-2 text-left">單據種類</th>
                  <th className="px-2 py-2 text-left">料號</th>
                  <th className="px-2 py-2 text-left">品名</th>
                  <th className="px-2 py-2 text-left">數量</th>
                  <th className="px-2 py-2 text-left">交期</th>
                  <th className="px-2 py-2 text-left">來源序號</th>
                  <th className="px-2 py-2 text-left">序號</th>
                  <th className="px-2 py-2 text-left">版本</th>
                  <th className="px-2 py-2 text-left">批號</th>
                  <th className="px-2 py-2 text-left">ERP 對應單位</th>
                  <th className="px-2 py-2 text-left">單位</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((row, i) => (
                  <tr key={`${row.row_key || row.order_number}-${i}`} className={`border-t border-slate-800/80 ${seqMismatchIdx.has(i) ? 'bg-amber-950/30' : ''}`}>
                    <td className="px-2 py-1.5 text-slate-500">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <input value={rowApplyNos[i] ?? ''} onChange={e => setApplyNo(i, e.target.value)} className="w-44 px-2 py-1 rounded bg-slate-950 border border-slate-700" />
                    </td>
                    <td className="px-2 py-1.5 text-cyan-300">{row.order_number}</td>
                    <td className="px-2 py-1.5">{row.doc_type}</td>
                    <td className="px-2 py-1.5 font-mono">{row.item_code}</td>
                    <td className="px-2 py-1.5">{row.item_name}</td>
                    <td className="px-2 py-1.5 font-mono">{row.quantity}</td>
                    <td className="px-2 py-1.5">{row.delivery_date}</td>
                    <td className="px-2 py-1.5 font-mono">{row.match_line_no || '1'}</td>
                    <td className="px-2 py-1.5">
                      <input value={lineEdits[i]?.line_no ?? '1'} onChange={e => setLE(i, 'line_no', e.target.value)} className="w-14 px-2 py-1 rounded bg-slate-950 border border-slate-700" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={lineEdits[i]?.mbp_ver ?? '1'} onChange={e => setLE(i, 'mbp_ver', e.target.value)} className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700" />
                    </td>
                    <td className="px-2 py-1.5 font-mono text-cyan-300">{row.order_number}</td>
                    <td className="px-2 py-1.5 font-mono">{unitMap[row.item_code] || '—'}</td>
                    <td className="px-2 py-1.5">
                      <input value={lineEdits[i]?.uom ?? 'PCS'} onChange={e => setLE(i, 'uom', e.target.value)} className={`w-20 px-2 py-1 rounded bg-slate-950 border ${unitMap[row.item_code] && lineEdits[i]?.uom !== unitMap[row.item_code] ? 'border-amber-500 text-amber-300' : 'border-slate-700'}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sourceRows.length === 0 && (
            <div className="text-slate-500 text-sm py-8 text-center">
              {loadedDate ? '此日期無待匯入委外請購資料' : '請先選擇日期並載入委外資料'}
            </div>
          )}
            </>
          )}

          {activeTab === 'imported' && (
            <>
              <div className="mb-3 text-sm text-emerald-300">以下為出單表已匹配 MPO 的列（重新載入時不會出現在待匯入）</div>
              <div className="overflow-auto border border-slate-800 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="px-2 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-left">MPO 單號</th>
                      <th className="px-2 py-2 text-left">來源單號</th>
                      <th className="px-2 py-2 text-left">單據種類</th>
                      <th className="px-2 py-2 text-left">料號</th>
                      <th className="px-2 py-2 text-left">品名</th>
                      <th className="px-2 py-2 text-left">數量</th>
                      <th className="px-2 py-2 text-left">交期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedMpoRows.map((row, i) => (
                      <tr key={`${row.row_key || row.order_number}-imp-${i}`} className="border-t border-slate-800/80">
                        <td className="px-2 py-1.5 text-slate-500">{i + 1}</td>
                        <td className="px-2 py-1.5 font-mono text-emerald-300">{row.mo_number || '—'}</td>
                        <td className="px-2 py-1.5 text-cyan-300">{row.order_number}</td>
                        <td className="px-2 py-1.5">{row.doc_type}</td>
                        <td className="px-2 py-1.5 font-mono">{row.item_code}</td>
                        <td className="px-2 py-1.5">{row.item_name}</td>
                        <td className="px-2 py-1.5 font-mono">{row.quantity}</td>
                        <td className="px-2 py-1.5">{row.delivery_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importedMpoRows.length === 0 && (
                <div className="text-slate-500 text-sm py-8 text-center">目前無已匯入 MPO 資料</div>
              )}
            </>
          )}
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded p-4">
          <h2 className="font-semibold mb-2">ERP 同步確認（請購單號）</h2>
          <p className="text-xs text-slate-500 mb-3">查詢 erp_pj_sync（doc_type=請購單號）。先在 ERP 同步區執行請購單同步再查詢。</p>
          <div className="flex gap-2 flex-wrap mb-3">
            <input value={prSearchId} onChange={e => setPrSearchId(e.target.value)} placeholder="輸入請購單號前綴，如 MPO" className="px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm w-72" />
            <button onClick={() => void searchSyncedPr()} disabled={prSearching} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">{prSearching ? '查詢中…' : '查詢'}</button>
          </div>

          {prSyncRows && (
            <div className="overflow-auto border border-slate-800 rounded max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-2 py-2 text-left">請購單號</th>
                    <th className="px-2 py-2 text-left">序號</th>
                    <th className="px-2 py-2 text-left">料號</th>
                    <th className="px-2 py-2 text-left">數量</th>
                    <th className="px-2 py-2 text-left">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {prSyncRows.map((r, i) => (
                    <tr key={`pr-sync-${i}`} className="border-t border-slate-800/80">
                      <td className="px-2 py-1.5 font-mono text-cyan-300">{String(r.doc_no ?? '')}</td>
                      <td className="px-2 py-1.5 font-mono">{String(r.sub_no ?? '')}</td>
                      <td className="px-2 py-1.5 font-mono">{String(r.item_code ?? '')}</td>
                      <td className="px-2 py-1.5 font-mono">{String(r.qty ?? '')}</td>
                      <td className="px-2 py-1.5">{String(r.status ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
