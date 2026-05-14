'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabaseClient'

// ─── Constants ────────────────────────────────────────────────────────────────

const SKIP_PREFIXES = ['C', 'S']
const MAT_SKIP_PREFIXES = ['W']
const INV_SYNC_PAYLOAD = {
  action: 'sync_inventory',
  table: 'MM_BOM_BOH_V',
  customColumn: 'PART,PART_DESC,BOH,PO_ON_ROAD',
  filters: { ROWNUM: '<= 10000' },
  mapping: { itemCodeField: 'PART', itemNameField: 'PART_DESC', bookCountField: 'BOH', warehouseTotalField: 'PO_ON_ROAD' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SoLineStatus = 'ok' | 'transit_ok' | 'sub_ok' | 'shortage' | 'no_bom'
type SyncPhase = 'so' | 'inventory' | 'material_prep'
type SyncState = 'idle' | 'running' | 'ok' | 'error'

interface SyncStatus { phase: SyncPhase; state: SyncState; msg: string }

interface MatItem {
  material_code: string
  material_name: string | null
  need_qty: number
  book_avail: number
  transit_avail: number
  sub_code: string | null
  sub_name: string | null
  sub_avail: number
  final_shortage: number
  mat_status: 'shortage' | 'no_inv'
}

interface SoLineResult {
  project_id: string
  line_no: number
  mbp_part: string
  description: string | null
  order_qty_oru: number
  duedate: string | null
  partner_name: string | null
  status: SoLineStatus
  shortages: MatItem[]
}

interface MrpSummary {
  total_open_lines: number
  skipped_cs: number
  prepped_lines: number
  processed_lines: number
  ok_lines: number
  shortage_lines: number
  no_bom_lines: number
  no_bom_products: string[]
}

interface ExcludedRow { id: number; item_code: string; note: string | null }

interface MatAggregate {
  material_code: string
  material_name: string | null
  total_need: number
  book_avail: number
  transit_avail: number
  sub_code: string | null
  sub_avail: number
  total_shortage: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(n: number) { return Math.round(n * 100) / 100 }

function deduct(code: string, qty: number, book: Map<string, number>, transit: Map<string, number>) {
  const b = book.get(code) ?? 0
  if (b >= qty) { book.set(code, b - qty) }
  else { book.set(code, 0); transit.set(code, Math.max(0, (transit.get(code) ?? 0) - (qty - b))) }
}

function bestSub(
  code: string,
  rules: Map<string, Array<{ sub_code: string; priority: number }>>,
  book: Map<string, number>,
  transit: Map<string, number>,
): { sub_code: string; sub_avail: number } | null {
  const subs = [...(rules.get(code) ?? [])].sort((a, b) => a.priority - b.priority)
  let best: { sub_code: string; sub_avail: number } | null = null
  for (const s of subs) {
    const avail = (book.get(s.sub_code) ?? 0) + (transit.get(s.sub_code) ?? 0)
    if (!best || avail > best.sub_avail) best = { sub_code: s.sub_code, sub_avail: avail }
    if (best.sub_avail > 0) break
  }
  return best
}

/** Supabase 分頁拉取所有資料 */
async function fetchAll<T>(
  builder: (range: { from: number; to: number }) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await builder({ from: offset, to: offset + pageSize - 1 })
    if (error) throw error
    all.push(...(data ?? []))
    if ((data?.length ?? 0) < pageSize) break
    offset += pageSize
  }
  return all
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function SoStatusBadge({ status }: { status: SoLineStatus }) {
  switch (status) {
    case 'ok':         return <span className="rounded-full bg-emerald-900/60 border border-emerald-800 px-2 py-0.5 text-emerald-300 whitespace-nowrap">庫存充足</span>
    case 'transit_ok': return <span className="rounded-full bg-amber-900/60 border border-amber-800 px-2 py-0.5 text-amber-300 whitespace-nowrap">在途可補</span>
    case 'sub_ok':     return <span className="rounded-full bg-sky-900/60 border border-sky-800 px-2 py-0.5 text-sky-300 whitespace-nowrap">替代料可補</span>
    case 'shortage':   return <span className="rounded-full bg-red-900/60 border border-red-800 px-2 py-0.5 text-red-300 whitespace-nowrap">⚠ 缺料</span>
    case 'no_bom':     return <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-slate-400 whitespace-nowrap">無 BOM</span>
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MrpTestPage() {
  // ── sync state ──
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([])
  const [syncing, setSyncing] = useState(false)

  // ── excluded materials ──
  const [excluded, setExcluded] = useState<ExcludedRow[]>([])
  const [excludedLoading, setExcludedLoading] = useState(false)
  const [newExcludedCode, setNewExcludedCode] = useState('')
  const [newExcludedNote, setNewExcludedNote] = useState('')
  const [excludedSaving, setExcludedSaving] = useState(false)
  const [excludedModalOpen, setExcludedModalOpen] = useState(false)
  const [excludedError, setExcludedError] = useState<string | null>(null)

  // ── MRP state ──
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<SoLineResult[]>([])
  const [matAgg, setMatAgg] = useState<MatAggregate[]>([])
  const [summary, setSummary] = useState<MrpSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'shortage' | 'ok' | 'no_bom' | 'all' | 'mat_agg'>('shortage')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // ── load excluded materials ──
  const loadExcluded = useCallback(async () => {
    setExcludedLoading(true)
    const { data } = await supabase
      .from('mrp_excluded_materials')
      .select('id, item_code, note')
      .order('item_code', { ascending: true })
    setExcluded((data ?? []) as ExcludedRow[])
    setExcludedLoading(false)
  }, [])

  useEffect(() => { void loadExcluded() }, [loadExcluded])

  async function addExcluded() {
    const code = newExcludedCode.trim().toUpperCase()
    if (!code) return
    setExcludedSaving(true)
    setExcludedError(null)
    const { error: err } = await supabase.from('mrp_excluded_materials').insert({
      item_code: code,
      note: newExcludedNote.trim() || null,
    })
    if (err) {
      setExcludedError(err.message)
    } else {
      setNewExcludedCode('')
      setNewExcludedNote('')
      await loadExcluded()
    }
    setExcludedSaving(false)
  }

  async function removeExcluded(id: number) {
    await supabase.from('mrp_excluded_materials').delete().eq('id', id)
    await loadExcluded()
  }

  function toggleRow(key: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  // ── pre-sync ──
  function setSyncPhase(phase: SyncPhase, state: SyncState, msg: string) {
    setSyncStatuses(prev => {
      const next = prev.filter(s => s.phase !== phase)
      return [...next, { phase, state, msg }]
    })
  }

  async function runSync() {
    setSyncing(true)
    setSyncStatuses([])
    const phases: Array<{ phase: SyncPhase; label: string; payload: object }> = [
      { phase: 'so',            label: '銷售訂單',  payload: { action: 'sync_so' } },
      { phase: 'inventory',     label: '庫存',      payload: INV_SYNC_PAYLOAD },
      { phase: 'material_prep', label: '批備料',    payload: { action: 'sync_material_prep' } },
    ]
    for (const p of phases) {
      setSyncPhase(p.phase, 'running', `${p.label} 同步中…`)
      try {
        const res = await fetch('/api/argoerp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p.payload),
        })
        const json = await res.json() as { status?: string; error?: string; count?: number; upsertedCount?: number }
        if (json.status === 'ok') {
          const cnt = json.count ?? json.upsertedCount ?? ''
          setSyncPhase(p.phase, 'ok', `${p.label} 同步完成${cnt ? ` (${cnt} 筆)` : ''}`)
        } else {
          setSyncPhase(p.phase, 'error', `${p.label} 失敗：${json.error ?? '未知'}`)
        }
      } catch (e) {
        setSyncPhase(p.phase, 'error', `${p.label} 連線錯誤：${e instanceof Error ? e.message : String(e)}`)
      }
    }
    setSyncing(false)
  }

  // ── MRP calculation ──
  async function runMrp() {
    setRunning(true)
    setError(null)
    setResults([])
    setMatAgg([])
    setSummary(null)
    setExpanded(new Set())

    try {
      // ── 1. 排除料號 set ──────────────────────────────────────────────
      const excludedSet = new Set(excluded.map(e => e.item_code))

      // ── 2. OPEN SO 明細（分頁，按交貨日升冪） ──────────────────────
      const soLines = await fetchAll<{
        project_id: string; line_no: number; mbp_part: string
        description: string | null; order_qty_oru: number
        duedate: string | null; partner_name: string | null
      }>(({ from, to }) =>
        supabase
          .from('erp_so_lines')
          .select('project_id, line_no, mbp_part, description, order_qty_oru, duedate, partner_name')
          .eq('hold_status', 'OPEN')
          .order('duedate', { ascending: true, nullsFirst: false })
          .order('project_id', { ascending: true })
          .order('line_no', { ascending: true })
          .range(from, to) as PromiseLike<{ data: never[] | null; error: unknown }>
      )

      // ── 3. 已批備料製令 ──────────────────────────────────────────────
      const moRaw = await fetchAll<{ source_order: string | null; product_code: string | null }>(
        ({ from, to }) =>
          supabase
            .from('argoerp_mo_summary')
            .select('source_order, product_code')
            .eq('prep_status', '已備料')
            .range(from, to) as PromiseLike<{ data: never[] | null; error: unknown }>
      )
      const preppedSet = new Set(moRaw.filter(m => m.source_order && m.product_code).map(m => `${m.source_order}|${m.product_code}`))

      // ── 4. BOM 展開 ─────────────────────────────────────────────────
      const allParts = [...new Set(soLines.map(l => l.mbp_part).filter(p => p && !SKIP_PREFIXES.some(pfx => p.toUpperCase().startsWith(pfx))))]
      const bomMap = new Map<string, Array<{ material_code: string; material_name: string | null; quantity: number; production_quantity: number }>>()
      const bomNames = new Map<string, string | null>()
      if (allParts.length > 0) {
        const bomRaw = await fetchAll<{ product_code: string; material_code: string; material_name: string | null; quantity: number; production_quantity: number }>(
          ({ from, to }) =>
            supabase
              .from('bom')
              .select('product_code, material_code, material_name, quantity, production_quantity')
              .in('product_code', allParts)
              .range(from, to) as PromiseLike<{ data: never[] | null; error: unknown }>
        )
        for (const b of bomRaw) {
          if (!bomMap.has(b.product_code)) bomMap.set(b.product_code, [])
          bomMap.get(b.product_code)!.push(b)
          if (b.material_name && !bomNames.has(b.material_code)) bomNames.set(b.material_code, b.material_name)
        }
      }

      // ── 5. 替代料規則 ────────────────────────────────────────────────
      const matCodesSet = new Set<string>()
      for (const [, items] of bomMap) items.forEach(i => { if (!excludedSet.has(i.material_code) && !MAT_SKIP_PREFIXES.some(p => i.material_code.toUpperCase().startsWith(p))) matCodesSet.add(i.material_code) })
      const matCodes = [...matCodesSet]

      const subRules = new Map<string, Array<{ sub_code: string; priority: number }>>()
      const subCodesSet = new Set<string>()
      if (matCodes.length > 0) {
        const subRaw = await fetchAll<{ source_item_code: string; substitute_item_code: string; priority: number }>(
          ({ from, to }) =>
            supabase
              .from('material_substitute_rules')
              .select('source_item_code, substitute_item_code, priority')
              .in('source_item_code', matCodes)
              .range(from, to) as PromiseLike<{ data: never[] | null; error: unknown }>
        )
        for (const s of subRaw) {
          if (!subRules.has(s.source_item_code)) subRules.set(s.source_item_code, [])
          subRules.get(s.source_item_code)!.push({ sub_code: s.substitute_item_code, priority: s.priority })
          subCodesSet.add(s.substitute_item_code)
        }
      }

      // ── 6. 庫存（主料 + 替代料） ─────────────────────────────────────
      const allInvCodes = [...new Set([...matCodes, ...subCodesSet])]
      const bookAvail = new Map<string, number>()
      const transitAvail = new Map<string, number>()
      const matNames = new Map<string, string | null>()
      if (allInvCodes.length > 0) {
        const invRaw = await fetchAll<{ item_code: string; item_name: string | null; book_count: number; qisheng_sichuan_total: number }>(
          ({ from, to }) =>
            supabase
              .from('material_inventory_list')
              .select('item_code, item_name, book_count, qisheng_sichuan_total')
              .in('item_code', allInvCodes)
              .range(from, to) as PromiseLike<{ data: never[] | null; error: unknown }>
        )
        for (const inv of invRaw) {
          bookAvail.set(inv.item_code, inv.book_count ?? 0)
          transitAvail.set(inv.item_code, inv.qisheng_sichuan_total ?? 0)
          matNames.set(inv.item_code, inv.item_name)
        }
      }

      // ── 7. 逐筆 SO 明細計算（交貨日最早優先扣料） ────────────────────
      const origBook = new Map(bookAvail)
      const origTransit = new Map(transitAvail)
      const matTotalNeed = new Map<string, number>()
      const lineResults: SoLineResult[] = []
      let preppedCount = 0
      let skippedCs = 0
      const noBomProducts = new Set<string>()

      for (const line of soLines) {
        // C/S 開頭成品直接略過
        if (SKIP_PREFIXES.some(pfx => line.mbp_part?.toUpperCase().startsWith(pfx))) {
          skippedCs++
          continue
        }
        // 已批備料略過
        if (preppedSet.has(`${line.project_id}|${line.mbp_part}`)) { preppedCount++; continue }

        const bom = bomMap.get(line.mbp_part)
        if (!bom || bom.length === 0) {
          noBomProducts.add(line.mbp_part)
          lineResults.push({ ...line, status: 'no_bom', shortages: [] })
          continue
        }

        let lineStatus: SoLineStatus = 'ok'
        const shortages: MatItem[] = []

        for (const b of bom) {
          // 排除料號直接跳過（不計需求、不計缺料）
          if (excludedSet.has(b.material_code)) continue
          if (MAT_SKIP_PREFIXES.some(p => b.material_code.toUpperCase().startsWith(p))) continue

          const batch = (b.production_quantity ?? 0) > 0 ? b.production_quantity : 1
          const needQty = (line.order_qty_oru / batch) * b.quantity
          matTotalNeed.set(b.material_code, (matTotalNeed.get(b.material_code) ?? 0) + needQty)
          const book = bookAvail.get(b.material_code) ?? 0
          const transit = transitAvail.get(b.material_code) ?? 0
          const hasInv = bookAvail.has(b.material_code)

          if (book >= needQty) {
            deduct(b.material_code, needQty, bookAvail, transitAvail)
          } else if (hasInv && book + transit >= needQty) {
            deduct(b.material_code, needQty, bookAvail, transitAvail)
            if (lineStatus === 'ok') lineStatus = 'transit_ok'
          } else {
            const shortageAmt = needQty - book - transit
            const sub = bestSub(b.material_code, subRules, bookAvail, transitAvail)
            const subAvail = sub ? ((bookAvail.get(sub.sub_code) ?? 0) + (transitAvail.get(sub.sub_code) ?? 0)) : 0

            if (sub && subAvail >= shortageAmt) {
              deduct(b.material_code, book + transit, bookAvail, transitAvail)
              deduct(sub.sub_code, shortageAmt, bookAvail, transitAvail)
              if (lineStatus === 'ok') lineStatus = 'sub_ok'
            } else {
              const usedSubAvail = sub ? Math.min(subAvail, shortageAmt) : 0
              const finalShortage = r2(shortageAmt - usedSubAvail)
              deduct(b.material_code, book + transit, bookAvail, transitAvail)
              if (sub && usedSubAvail > 0) deduct(sub.sub_code, usedSubAvail, bookAvail, transitAvail)
              shortages.push({
                material_code: b.material_code,
                material_name: matNames.get(b.material_code) ?? b.material_name,
                need_qty: r2(needQty),
                book_avail: r2(book),
                transit_avail: r2(transit),
                sub_code: sub?.sub_code ?? null,
                sub_name: sub ? (matNames.get(sub.sub_code) ?? null) : null,
                sub_avail: r2(subAvail),
                final_shortage: finalShortage,
                mat_status: !hasInv ? 'no_inv' : 'shortage',
              })
              lineStatus = 'shortage'
            }
          }
        }

        lineResults.push({ ...line, status: lineStatus, shortages })
      }

      // ── 8. 原料彙總（以原始庫存對照各料號總需求，不扣料） ─────────────
      const aggResults: MatAggregate[] = [...matTotalNeed.entries()].map(([code, totalNeed]) => {
        const book = origBook.get(code) ?? 0
        const transit = origTransit.get(code) ?? 0
        const subs = [...(subRules.get(code) ?? [])].sort((a, b) => a.priority - b.priority)
        const bestSubCode = subs[0]?.sub_code ?? null
        const subOrigAvail = bestSubCode ? r2((origBook.get(bestSubCode) ?? 0) + (origTransit.get(bestSubCode) ?? 0)) : 0
        return {
          material_code: code,
          material_name: matNames.get(code) ?? bomNames.get(code) ?? null,
          total_need: r2(totalNeed),
          book_avail: r2(book),
          transit_avail: r2(transit),
          sub_code: bestSubCode,
          sub_avail: subOrigAvail,
          total_shortage: r2(Math.max(0, totalNeed - book - transit)),
        }
      }).sort((a, b) => b.total_shortage - a.total_shortage)
      setMatAgg(aggResults)

      setSummary({
        total_open_lines: soLines.length,
        skipped_cs: skippedCs,
        prepped_lines: preppedCount,
        processed_lines: lineResults.length,
        ok_lines: lineResults.filter(r => r.status === 'ok' || r.status === 'transit_ok' || r.status === 'sub_ok').length,
        shortage_lines: lineResults.filter(r => r.status === 'shortage').length,
        no_bom_lines: lineResults.filter(r => r.status === 'no_bom').length,
        no_bom_products: [...noBomProducts],
      })
      setResults(lineResults)
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知錯誤')
    } finally {
      setRunning(false)
    }
  }

  const tabRows = activeTab === 'all' ? results
    : activeTab === 'shortage' ? results.filter(r => r.status === 'shortage')
    : activeTab === 'ok'       ? results.filter(r => r.status === 'ok' || r.status === 'transit_ok' || r.status === 'sub_ok')
    : activeTab === 'no_bom'   ? results.filter(r => r.status === 'no_bom')
    : []

  const syncPhaseLabel: Record<SyncPhase, string> = { so: '銷售訂單', inventory: '庫存', material_prep: '批備料' }

  return (
    <>
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── 頁頭 ──────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold">MRP 缺料分析</h1>
          <p className="mt-1 text-sm text-slate-400">
            每筆 OPEN SO 序號獨立計算（交貨日排序扣料）→ 替代料 → 在途 → 缺料明細
          </p>
        </div>

        {/* ── 同步區 ────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-slate-200">Step 1 ─ 同步最新資料</p>
              <p className="text-xs text-slate-500 mt-0.5">執行 MRP 前建議先同步，確保使用最新的 ERP 資料</p>
            </div>
            <button
              type="button"
              onClick={() => void runSync()}
              disabled={syncing}
              className="rounded-lg bg-teal-700 hover:bg-teal-600 disabled:bg-slate-700 disabled:text-slate-500 px-5 py-2 text-sm font-semibold transition-colors"
            >
              {syncing ? '⏳ 同步中...' : '🔄 一鍵同步三表'}
            </button>
          </div>

          {syncStatuses.length > 0 && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['so', 'inventory', 'material_prep'] as SyncPhase[]).map(phase => {
                const s = syncStatuses.find(x => x.phase === phase)
                return (
                  <div key={phase} className={`rounded-lg px-3 py-2 text-xs border ${
                    !s ? 'border-slate-800 bg-slate-900/30 text-slate-600'
                    : s.state === 'running' ? 'border-teal-800 bg-teal-900/20 text-teal-300'
                    : s.state === 'ok'      ? 'border-emerald-800 bg-emerald-900/20 text-emerald-300'
                    : 'border-red-800 bg-red-900/20 text-red-300'
                  }`}>
                    <span className="font-semibold">{syncPhaseLabel[phase]}</span>
                    {s ? ` — ${s.msg}` : ' — 等待中'}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── 執行 MRP ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => void runMrp()}
            disabled={running || syncing}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 px-10 py-3 text-base font-bold transition-colors"
          >
            {running ? '⏳ 計算中...' : '▶ Step 2 ─ 執行 MRP'}
          </button>
          <p className="text-xs text-slate-600">C / S 開頭成品自動略過，已批備料製令自動跳過</p>
        </div>

        {/* ── 錯誤 ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">⚠ {error}</div>
        )}

        {/* ── 摘要卡片 ──────────────────────────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {([
              { label: 'OPEN SO 序號', value: summary.total_open_lines, color: 'text-cyan-300' },
              { label: 'C/S略過', value: summary.skipped_cs, color: 'text-slate-500' },
              { label: '已批備料(跳過)', value: summary.prepped_lines, color: 'text-slate-500' },
              { label: '已計算序號', value: summary.processed_lines, color: 'text-slate-300' },
              { label: '庫存/替代料充足', value: summary.ok_lines, color: 'text-emerald-400' },
              { label: '缺料序號', value: summary.shortage_lines, color: summary.shortage_lines > 0 ? 'text-red-400' : 'text-emerald-400' },
              { label: '無BOM序號', value: summary.no_bom_lines, color: summary.no_bom_lines > 0 ? 'text-yellow-400' : 'text-slate-500' },
              { label: '無BOM成品種數', value: summary.no_bom_products.length, color: summary.no_bom_products.length > 0 ? 'text-yellow-400' : 'text-slate-500' },
            ] as const).map(card => (
              <div key={card.label} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-3 text-center">
                <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                <div className="mt-1 text-[10px] text-slate-500 leading-tight">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── 無BOM 成品清單 ────────────────────────────────────────────── */}
        {summary && summary.no_bom_products.length > 0 && (
          <div className="rounded-xl border border-yellow-800 bg-yellow-900/10 px-4 py-3">
            <p className="text-xs font-semibold text-yellow-400 mb-2">
              ⚠ 以下成品在 BOM 表查無資料（需建立 BOM 才能計算缺料）
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.no_bom_products.map(p => (
                <span key={p} className="rounded bg-yellow-900/40 border border-yellow-800 px-2 py-0.5 font-mono text-xs text-yellow-300">{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Tabs + 表格 ───────────────────────────────────────────────── */}
        {results.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40">
            {/* Tab bar */}
            <div className="flex items-center gap-1 border-b border-slate-800 px-4 pt-3 flex-wrap">
              {([
                ['mat_agg',  '📦 原料彙總', 'text-violet-400 border-violet-500'],
                ['shortage', '⚠ 缺料明細',  'text-red-400 border-red-500'],
                ['ok',       '✅ 庫存充足',  'text-emerald-400 border-emerald-500'],
                ['no_bom',   '❓ 無BOM',    'text-yellow-400 border-yellow-500'],
                ['all',      '全部',        'text-slate-300 border-slate-400'],
              ] as const).map(([key, label, activeColor]) => {
                const count = key === 'shortage' ? (summary?.shortage_lines ?? 0)
                  : key === 'ok' ? (summary?.ok_lines ?? 0)
                  : key === 'no_bom' ? (summary?.no_bom_lines ?? 0)
                  : key === 'mat_agg' ? matAgg.length
                  : results.length
                return (
                  <button key={key} type="button" onClick={() => setActiveTab(key as typeof activeTab)}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors mr-3 ${activeTab === key ? activeColor : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    {label} <span className="text-xs opacity-60">({count})</span>
                  </button>
                )
              })}
              <span className="ml-auto pb-2 text-xs text-slate-600">{activeTab === 'mat_agg' ? matAgg.length : tabRows.length} 筆</span>
            </div>

            {/* Table */}
            {activeTab === 'mat_agg' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60">
                      <th className="px-3 py-2 text-left text-slate-400 whitespace-nowrap">料號</th>
                      <th className="px-3 py-2 text-left text-slate-400">品名</th>
                      <th className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">總需求量</th>
                      <th className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">帳面庫存</th>
                      <th className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">在途</th>
                      <th className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">可用合計</th>
                      <th className="px-3 py-2 text-left text-slate-400 whitespace-nowrap">替代料</th>
                      <th className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">替代料庫存</th>
                      <th className="px-3 py-2 text-right text-slate-400 whitespace-nowrap font-bold">缺料量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matAgg.map(m => (
                      <tr key={m.material_code} className={`border-b border-slate-800/50 hover:bg-slate-900/40 ${m.total_shortage > 0 ? 'bg-red-950/20' : ''}`}>
                        <td className="px-3 py-2 font-mono text-sky-300 whitespace-nowrap">{m.material_code}</td>
                        <td className="px-3 py-2 text-slate-300 max-w-[180px] truncate" title={m.material_name ?? undefined}>{m.material_name ?? <span className="text-slate-600">—</span>}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-200">{m.total_need.toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${m.book_avail > 0 ? 'text-slate-300' : 'text-slate-600'}`}>{m.book_avail.toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${m.transit_avail > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{m.transit_avail > 0 ? m.transit_avail.toLocaleString() : '—'}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${m.book_avail + m.transit_avail >= m.total_need ? 'text-emerald-400' : 'text-red-400'}`}>{(m.book_avail + m.transit_avail).toLocaleString()}</td>
                        <td className="px-3 py-2 font-mono text-xs text-sky-400 whitespace-nowrap">{m.sub_code ?? <span className="text-slate-600">—</span>}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${m.sub_avail > 0 ? 'text-sky-300' : 'text-slate-600'}`}>{m.sub_code ? m.sub_avail.toLocaleString() : '—'}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold ${m.total_shortage > 0 ? 'text-red-300' : 'text-emerald-400'}`}>{m.total_shortage > 0 ? m.total_shortage.toLocaleString() : '✓'}</td>
                      </tr>
                    ))}
                    {matAgg.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-600">無原料需求資料</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="px-3 py-2 text-left text-slate-400 whitespace-nowrap">SO 單號</th>
                    <th className="px-3 py-2 text-left text-slate-400 whitespace-nowrap">序號</th>
                    <th className="px-3 py-2 text-left text-slate-400 whitespace-nowrap">成品料號</th>
                    <th className="px-3 py-2 text-left text-slate-400">品名</th>
                    <th className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">生產數量</th>
                    <th className="px-3 py-2 text-left text-slate-400 whitespace-nowrap">交貨日</th>
                    <th className="px-3 py-2 text-left text-slate-400 whitespace-nowrap">客戶</th>
                    <th className="px-3 py-2 text-center text-slate-400 whitespace-nowrap">狀態</th>
                    <th className="px-3 py-2 text-center text-slate-400 whitespace-nowrap">缺料明細</th>
                  </tr>
                </thead>
                <tbody>
                  {tabRows.map(row => {
                    const rowKey = `${row.project_id}|${row.line_no}`
                    const isExpanded = expanded.has(rowKey)
                    const isShortage = row.status === 'shortage'
                    return (
                      <>
                        <tr key={rowKey} className={`border-b border-slate-800/50 ${isShortage ? 'bg-red-950/20' : ''} hover:bg-slate-900/40`}>
                          <td className="px-3 py-2 font-mono text-cyan-300 whitespace-nowrap">{row.project_id}</td>
                          <td className="px-3 py-2 text-center text-slate-300">{row.line_no}</td>
                          <td className="px-3 py-2 font-mono text-sky-300 whitespace-nowrap">{row.mbp_part}</td>
                          <td className="px-3 py-2 text-slate-300 max-w-[160px] truncate" title={row.description ?? undefined}>
                            {row.description ?? <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-200 tabular-nums whitespace-nowrap">
                            {(row.order_qty_oru ?? 0).toLocaleString()}
                          </td>
                          <td className={`px-3 py-2 whitespace-nowrap font-mono text-[11px] ${row.duedate ? (new Date(row.duedate) < new Date() ? 'text-red-400' : 'text-slate-300') : 'text-slate-600'}`}>
                            {row.duedate ? row.duedate.slice(0, 10) : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate" title={row.partner_name ?? undefined}>
                            {row.partner_name ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-center text-[11px]">
                            <SoStatusBadge status={row.status} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isShortage && row.shortages.length > 0 ? (
                              <button type="button" onClick={() => toggleRow(rowKey)}
                                className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-400 hover:text-white transition-colors">
                                {isExpanded ? '▲' : '▼'} {row.shortages.length} 項
                              </button>
                            ) : <span className="text-slate-700">—</span>}
                          </td>
                        </tr>

                        {/* 展開缺料明細 */}
                        {isExpanded && row.shortages.length > 0 && (
                          <tr key={`${rowKey}_d`} className="bg-slate-950">
                            <td colSpan={9} className="px-0 py-0">
                              <div className="mx-6 my-3 rounded-lg border border-red-900/50 bg-red-950/20 overflow-x-auto">
                                <table className="w-full text-[11px]">
                                  <thead>
                                    <tr className="border-b border-red-900/40 bg-red-950/30">
                                      <th className="px-3 py-1.5 text-left text-red-400/80 whitespace-nowrap">缺料料號</th>
                                      <th className="px-3 py-1.5 text-left text-red-400/80">品名</th>
                                      <th className="px-3 py-1.5 text-right text-red-400/80 whitespace-nowrap">需求量</th>
                                      <th className="px-3 py-1.5 text-right text-red-400/80 whitespace-nowrap">帳面庫存</th>
                                      <th className="px-3 py-1.5 text-right text-red-400/80 whitespace-nowrap">在途數量</th>
                                      <th className="px-3 py-1.5 text-left text-red-400/80 whitespace-nowrap">最佳替代料</th>
                                      <th className="px-3 py-1.5 text-right text-red-400/80 whitespace-nowrap">替代料可用</th>
                                      <th className="px-3 py-1.5 text-right text-red-400/80 whitespace-nowrap font-bold">最終缺料量</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.shortages.map(m => (
                                      <tr key={m.material_code} className="border-b border-red-900/20">
                                        <td className="px-3 py-1.5 font-mono text-red-300 whitespace-nowrap">{m.material_code}</td>
                                        <td className="px-3 py-1.5 text-slate-400 max-w-[140px] truncate" title={m.material_name ?? undefined}>
                                          {m.material_name ?? <span className="text-slate-600">—</span>}
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums">{m.need_qty.toLocaleString()}</td>
                                        <td className={`px-3 py-1.5 text-right tabular-nums ${m.book_avail > 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                                          {m.mat_status === 'no_inv' ? <span className="text-slate-600">無資料</span> : m.book_avail.toLocaleString()}
                                        </td>
                                        <td className={`px-3 py-1.5 text-right tabular-nums ${m.transit_avail > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                                          {m.mat_status === 'no_inv' ? '—' : (m.transit_avail > 0 ? m.transit_avail.toLocaleString() : '—')}
                                        </td>
                                        <td className="px-3 py-1.5 font-mono text-sky-400 whitespace-nowrap">
                                          {m.sub_code
                                            ? <span title={m.sub_name ?? undefined}>{m.sub_code}{m.sub_name ? ` (${m.sub_name.slice(0, 8)})` : ''}</span>
                                            : <span className="text-slate-600">無替代料</span>
                                          }
                                        </td>
                                        <td className={`px-3 py-1.5 text-right tabular-nums ${m.sub_avail > 0 ? 'text-sky-300' : 'text-slate-600'}`}>
                                          {m.sub_code ? (m.sub_avail > 0 ? m.sub_avail.toLocaleString() : '0') : '—'}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums font-bold text-red-300">
                                          {m.final_shortage.toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                  {tabRows.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-600">無符合條件的資料</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {/* ── 初始提示 ──────────────────────────────────────────────────── */}
        {!running && results.length === 0 && !error && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-6 py-12 text-center text-slate-600 text-sm">
            先點「一鍵同步三表」取得最新資料，再點「執行 MRP」
          </div>
        )}

      </div>
    </div>

    {/* ── 排除料號浮動按鈕 ───────────────────────────────────────────── */}
    <button
      type="button"
      onClick={() => setExcludedModalOpen(true)}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-amber-700 hover:bg-amber-600 shadow-lg shadow-black/40 px-4 py-3 text-sm font-semibold text-white transition-colors"
      title="排除料號設定"
    >
      <span className="text-base leading-none">🚫</span>
      <span>排除料號</span>
      {excluded.length > 0 && (
        <span className="ml-0.5 rounded-full bg-amber-900/80 border border-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none">{excluded.length}</span>
      )}
    </button>

    {/* ── 排除料號 Modal ────────────────────────────────────────────── */}
    {excludedModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* 背景遮罩 */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setExcludedModalOpen(false)}
        />
        {/* 視窗 */}
        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-amber-800/60 bg-slate-900 shadow-2xl">
          {/* 標頭 */}
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-amber-300">🚫 排除料號設定</h2>
              <p className="mt-0.5 text-xs text-slate-500">以下料號不列入 MRP 缺料計算（執行前生效）</p>
            </div>
            <button
              type="button"
              onClick={() => setExcludedModalOpen(false)}
              className="rounded-lg px-2 py-1 text-slate-500 hover:text-white transition-colors text-lg leading-none"
            >✕</button>
          </div>

          {/* 新增欄位 */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="料號（必填）"
                value={newExcludedCode}
                onChange={e => setNewExcludedCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') void addExcluded() }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 w-36"
              />
              <input
                type="text"
                placeholder="排除原因（選填）"
                value={newExcludedNote}
                onChange={e => setNewExcludedNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void addExcluded() }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 flex-1 min-w-[140px]"
              />
              <button
                type="button"
                onClick={() => void addExcluded()}
                disabled={excludedSaving || !newExcludedCode.trim()}
                className="rounded-lg bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                {excludedSaving ? '儲存中…' : '+ 新增'}
              </button>
            </div>
            {excludedError && (
              <p className="mt-2 text-xs text-red-400">⚠ {excludedError}</p>
            )}
          </div>

          {/* 清單 */}
          <div className="max-h-72 overflow-y-auto px-5 pb-5">
            {excludedLoading ? (
              <p className="text-xs text-slate-600 py-4 text-center">載入中…</p>
            ) : excluded.length === 0 ? (
              <p className="text-xs text-slate-600 py-4 text-center">目前沒有排除料號</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {excluded.map(row => (
                  <span
                    key={row.id}
                    className="flex items-center gap-1 rounded-lg bg-slate-800 border border-slate-700 pl-2.5 pr-1 py-1 text-xs text-slate-300"
                    title={row.note ?? undefined}
                  >
                    <span className="font-mono text-amber-300">{row.item_code}</span>
                    {row.note && <span className="text-slate-500 ml-1">({row.note.slice(0, 20)})</span>}
                    <button
                      type="button"
                      onClick={() => void removeExcluded(row.id)}
                      className="ml-1 rounded px-1.5 py-0.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
