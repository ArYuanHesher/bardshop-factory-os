'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabaseClient'

// ============================================================
// 型別
// ============================================================
interface MoRecord {
  mo_number: string
  factory: string
  product_code?: string
  lot_number?: string         // 此處實際存放客戶名稱（顯示用）
  planned_qty?: string
  source_order?: string
  mo_note?: string
  create_date?: string
  saved_at?: string
  prep_status?: '未備料' | '已備料' | '無需備料'
}

interface BomRow {
  product_code: string
  product_name: string | null
  production_quantity: number | null
  production_unit: string | null
  note: string | null
  material_code: string
  material_name: string | null
  quantity: number
  unit: string | null
}

interface SubstituteRuleRow {
  source_item_code: string
  substitute_item_code: string
  priority: number
}

interface MaterialPrepRow {
  row_key: string
  mo_number: string
  customer: string
  source_order: string
  product_code: string
  source_material_code: string
  source_material_name: string
  required_qty: number
  unit: string
  stock_qty: number
  substitute_options: Array<{
    code: string
    name: string
    stock_qty: number
    label: string
  }>
  selected_material_code: string
  selected_material_name: string
  selected_material_stock_qty: number
  status: '可直接備料' | '建議替代' | '缺料' | '無BOM'
  note: string
}

// ============================================================
// 工具
// ============================================================
function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '')
}

const PREP_INTERFACE_KEY = 'argoerp_material_prep_interface_id'

// ============================================================
// 元件
// ============================================================
export default function MaterialPrepPage() {
  // ---- 製令清單 ----
  const [moRecords, setMoRecords] = useState<MoRecord[]>([])
  const [moLoading, setMoLoading] = useState(false)
  const [moError, setMoError] = useState('')

  // ---- BOM / 庫存 / 替代料 ----
  const [bomRows, setBomRows] = useState<BomRow[]>([])
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({})
  const [substituteMap, setSubstituteMap] = useState<Record<string, SubstituteRuleRow[]>>({})
  const [bomLoading, setBomLoading] = useState(false)
  const [bomError, setBomError] = useState('')
  const [materialOverrides, setMaterialOverrides] = useState<Record<string, string>>({})

  // ---- 選取 / 操作 ----
  const [selectedMos, setSelectedMos] = useState<Set<string>>(new Set())
  const [actionMessage, setActionMessage] = useState('')
  const [actionBusy, setActionBusy] = useState(false)

  // ---- 批備料介面 ----
  const [materialPrepInterfaceId, setMaterialPrepInterfaceId] = useState('')
  const [materialPrepImporting, setMaterialPrepImporting] = useState(false)
  const [materialPrepMessage, setMaterialPrepMessage] = useState('')

  // ---- 載入暫存 interface id ----
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(PREP_INTERFACE_KEY)
      if (saved) setMaterialPrepInterfaceId(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (materialPrepInterfaceId.trim()) localStorage.setItem(PREP_INTERFACE_KEY, materialPrepInterfaceId.trim())
      else localStorage.removeItem(PREP_INTERFACE_KEY)
    } catch {}
  }, [materialPrepInterfaceId])

  // ---- 載入未備料製令 ----
  const loadMoRecords = useCallback(async () => {
    setMoLoading(true)
    setMoError('')
    try {
      const res = await fetch('/api/argoerp/mo-summary?prep_status=未備料', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }
      const records: MoRecord[] = json.records ?? []
      setMoRecords(records)
      // 重置選取（保留仍存在的）
      setSelectedMos(prev => {
        const stillThere = new Set(records.map(r => r.mo_number))
        return new Set([...prev].filter(mo => stillThere.has(mo)))
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setMoError(msg)
    } finally {
      setMoLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMoRecords()
  }, [loadMoRecords])

  // ---- 載入 BOM / 庫存 / 替代料 ----
  const loadBomContext = useCallback(async () => {
    const productCodes = Array.from(new Set(moRecords.map(r => (r.product_code ?? '').trim()).filter(Boolean)))
    if (productCodes.length === 0) {
      setBomRows([])
      setInventoryMap({})
      setSubstituteMap({})
      setBomError('')
      return
    }

    setBomLoading(true)
    setBomError('')

    try {
      const { data: bomData, error: bomDataError } = await supabase
        .from('bom')
        .select('product_code, product_name, production_quantity, production_unit, note, material_code, material_name, quantity, unit')
        .in('product_code', productCodes)

      if (bomDataError) throw bomDataError

      const rows = (bomData as BomRow[] | null) || []
      const materialCodes = Array.from(new Set(rows.map(row => row.material_code).filter(Boolean)))

      const { data: substituteData, error: substituteError } = await supabase
        .from('material_substitute_rules')
        .select('source_item_code, substitute_item_code, priority')
        .in('source_item_code', materialCodes)

      if (substituteError) throw substituteError

      const groupedSubstitutes: Record<string, SubstituteRuleRow[]> = {}
      ;((substituteData as SubstituteRuleRow[] | null) || []).forEach(rule => {
        if (!groupedSubstitutes[rule.source_item_code]) groupedSubstitutes[rule.source_item_code] = []
        groupedSubstitutes[rule.source_item_code].push(rule)
      })
      Object.values(groupedSubstitutes).forEach(list => list.sort((a, b) => a.priority - b.priority))

      const allInventoryCodes = Array.from(new Set([
        ...materialCodes,
        ...(((substituteData as SubstituteRuleRow[] | null) || []).map(row => row.substitute_item_code).filter(Boolean)),
      ]))

      let nextInventoryMap: Record<string, number> = {}
      if (allInventoryCodes.length > 0) {
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('material_inventory_list')
          .select('item_code, book_count')
          .in('item_code', allInventoryCodes)

        if (inventoryError) throw inventoryError

        nextInventoryMap = ((inventoryData as Array<{ item_code: string; book_count: number }> | null) || []).reduce<Record<string, number>>((acc, item) => {
          acc[item.item_code] = Number(item.book_count) || 0
          return acc
        }, {})
      }

      setBomRows(rows)
      setSubstituteMap(groupedSubstitutes)
      setInventoryMap(nextInventoryMap)
    } catch (error) {
      const message = error instanceof Error ? error.message : '讀取 BOM / 庫存資料失敗'
      setBomError(message)
    } finally {
      setBomLoading(false)
    }
  }, [moRecords])

  useEffect(() => {
    void loadBomContext()
  }, [loadBomContext])

  // ---- 計算批備料行 ----
  const materialPrepRows = useMemo<MaterialPrepRow[]>(() => {
    if (moRecords.length === 0) return []
    return moRecords.flatMap((mo): MaterialPrepRow[] => {
      const productCode = (mo.product_code ?? '').trim()
      const matchedBom = bomRows.filter(row => row.product_code === productCode)
      if (matchedBom.length === 0) {
        const rowKey = `${mo.mo_number}::${productCode}::NO_BOM`
        return [{
          row_key: rowKey,
          mo_number: mo.mo_number,
          customer: mo.lot_number || '-',
          source_order: mo.source_order || '-',
          product_code: productCode || '-',
          source_material_code: '-',
          source_material_name: '查無 BOM',
          required_qty: 0,
          unit: '-',
          stock_qty: 0,
          substitute_options: [],
          selected_material_code: '',
          selected_material_name: '',
          selected_material_stock_qty: 0,
          status: '無BOM',
          note: '此生產貨號尚未在系統 BOM 表建立對應',
        }]
      }

      return matchedBom.map((bom): MaterialPrepRow => {
        const rowKey = `${mo.mo_number}::${productCode}::${bom.material_code}`
        const planQty = Number(mo.planned_qty) || 0
        const bomBaseQty = Number(bom.quantity) || 0
        const productionQty = Number(bom.production_quantity) || 0
        const requiredQty = productionQty > 0 ? (planQty * bomBaseQty) / productionQty : planQty * bomBaseQty
        const stockQty = inventoryMap[bom.material_code] ?? 0
        const substitutes = substituteMap[bom.material_code] || []
        const substituteOptions = [
          {
            code: bom.material_code,
            name: bom.material_name || '-',
            stock_qty: stockQty,
            label: `${bom.material_code}｜原料｜庫存 ${formatQty(stockQty)}`,
          },
          ...substitutes.map(rule => {
            const substituteBomRow = bomRows.find(item => item.material_code === rule.substitute_item_code)
            const substituteName = substituteBomRow?.material_name || rule.substitute_item_code
            const substituteStockQty = inventoryMap[rule.substitute_item_code] ?? 0
            return {
              code: rule.substitute_item_code,
              name: substituteName,
              stock_qty: substituteStockQty,
              label: `${rule.substitute_item_code}｜替代料 P${rule.priority}｜庫存 ${formatQty(substituteStockQty)}`,
            }
          }),
        ]
        const matchedSubstitute = substitutes.find(rule => (inventoryMap[rule.substitute_item_code] ?? 0) >= requiredQty)
        const defaultSelectedCode = stockQty >= requiredQty ? bom.material_code : (matchedSubstitute?.substitute_item_code || bom.material_code)
        const selectedCode = materialOverrides[rowKey] || defaultSelectedCode
        const selectedOption = substituteOptions.find(option => option.code === selectedCode) || substituteOptions[0]
        const selectedStockQty = selectedOption?.stock_qty ?? 0
        const selectedName = selectedOption?.name ?? '-'

        let status: MaterialPrepRow['status']
        let note: string
        if (selectedCode === bom.material_code && stockQty >= requiredQty) {
          status = '可直接備料'
          note = '庫存足夠，可直接匯入生產批備料'
        } else if (selectedCode !== bom.material_code && selectedStockQty >= requiredQty) {
          status = '建議替代'
          note = `原料庫存不足，改用 ${selectedCode} 可支應需求量`
        } else {
          status = '缺料'
          note = selectedCode === bom.material_code
            ? '原料與替代料庫存都不足，匯入批備料前需先補料或調整 BOM'
            : `已改選 ${selectedCode}，但庫存仍不足`
        }

        return {
          row_key: rowKey,
          mo_number: mo.mo_number,
          customer: mo.lot_number || '-',
          source_order: mo.source_order || '-',
          product_code: productCode,
          source_material_code: bom.material_code,
          source_material_name: bom.material_name || '-',
          required_qty: requiredQty,
          unit: bom.unit || '-',
          stock_qty: stockQty,
          substitute_options: substituteOptions,
          selected_material_code: selectedCode,
          selected_material_name: selectedName,
          selected_material_stock_qty: selectedStockQty,
          status,
          note,
        }
      })
    })
  }, [moRecords, bomRows, inventoryMap, substituteMap, materialOverrides])

  const materialPrepSummary = useMemo(() => {
    return materialPrepRows.reduce<Record<MaterialPrepRow['status'], number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    }, { 可直接備料: 0, 建議替代: 0, 缺料: 0, 無BOM: 0 })
  }, [materialPrepRows])

  // 將「選取的製令」轉為可送 ARGO 的批備料行
  const selectedImportRows = useMemo(() => {
    return materialPrepRows
      .filter(row => selectedMos.has(row.mo_number))
      .filter(row => row.status !== '無BOM')
      .filter(row => row.selected_material_code && row.selected_material_stock_qty >= row.required_qty)
      .map(row => ({
        mo_number: row.mo_number,
        product_code: row.product_code,
        source_order: row.source_order,
        material_code: row.selected_material_code,
        required_qty: formatQty(row.required_qty),
        unit: row.unit,
        note: row.source_material_code === row.selected_material_code
          ? '依原 BOM 備料'
          : `替代料：${row.source_material_code} -> ${row.selected_material_code}`,
      }))
  }, [materialPrepRows, selectedMos])

  // ---- 操作：勾選 ----
  const handleSelectMaterialOverride = useCallback((rowKey: string, materialCode: string) => {
    setMaterialOverrides(prev => ({ ...prev, [rowKey]: materialCode }))
  }, [])

  const toggleMo = useCallback((moNumber: string) => {
    setSelectedMos(prev => {
      const next = new Set(prev)
      if (next.has(moNumber)) next.delete(moNumber)
      else next.add(moNumber)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedMos.size === moRecords.length) setSelectedMos(new Set())
    else setSelectedMos(new Set(moRecords.map(r => r.mo_number)))
  }, [moRecords, selectedMos])

  // ---- 操作：標記為「無需備料」----
  const handleMarkNoNeed = useCallback(async () => {
    if (selectedMos.size === 0) return
    const moNumbers = [...selectedMos]
    if (!window.confirm(`確定將 ${moNumbers.length} 筆製令標記為「無需備料」？\n（總表狀態會改為已備料但實際不執行批備料）`)) return

    setActionBusy(true)
    setActionMessage('')
    try {
      const res = await fetch('/api/argoerp/mo-summary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mo_numbers: moNumbers, prep_status: '無需備料' }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`)
      setActionMessage(`✅ 已將 ${json.updated ?? moNumbers.length} 筆標記為「無需備料」`)
      await loadMoRecords()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setActionMessage(`❌ 標記失敗：${msg}`)
    } finally {
      setActionBusy(false)
      setTimeout(() => setActionMessage(''), 6000)
    }
  }, [selectedMos, loadMoRecords])

  // ---- 操作：送 ARGO 批備料 + 標記為「已備料」----
  const handleImportAndMarkDone = useCallback(async () => {
    if (selectedMos.size === 0) return

    if (!materialPrepInterfaceId.trim()) {
      setMaterialPrepMessage('❌ 請先輸入批備料匯入的 ARGO 介面編號')
      return
    }
    if (selectedImportRows.length === 0) {
      setMaterialPrepMessage('❌ 選取的製令中沒有可匯入的批備料資料（請檢查缺料或無 BOM 狀態）')
      return
    }

    const importMos = Array.from(new Set(selectedImportRows.map(r => r.mo_number)))
    if (!window.confirm(`將送出 ${selectedImportRows.length} 筆批備料資料到 ARGO（涵蓋 ${importMos.length} 筆製令），完成後將這些製令標記為「已備料」。確定？`)) return

    setMaterialPrepImporting(true)
    setMaterialPrepMessage('')

    try {
      const response = await fetch('/api/argoerp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          interfaceId: materialPrepInterfaceId.trim(),
          data: selectedImportRows,
        }),
      })

      const result = await response.json()
      const errorMessage =
        result?.error ||
        result?.message ||
        result?.apiResult?.ERROR ||
        result?.apiResult?.error ||
        result?.rawText
      const isSuccess = response.ok && result?.success === true
      if (!isSuccess) throw new Error(errorMessage || '生產批備料匯入失敗')

      // 更新狀態為「已備料」
      const patchRes = await fetch('/api/argoerp/mo-summary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mo_numbers: importMos, prep_status: '已備料' }),
      })
      const patchJson = await patchRes.json()
      if (!patchRes.ok || !patchJson?.success) {
        throw new Error(`ARGO 已匯入成功但更新狀態失敗：${patchJson?.error || `HTTP ${patchRes.status}`}\n請手動將以下製令標為已備料：${importMos.join(', ')}`)
      }

      setMaterialPrepMessage(`✅ 已送出 ${selectedImportRows.length} 筆到 ARGO，並將 ${importMos.length} 筆製令標記為「已備料」`)
      await loadMoRecords()
    } catch (error) {
      const message = error instanceof Error ? error.message : '生產批備料匯入失敗'
      setMaterialPrepMessage(`❌ ${message}`)
    } finally {
      setMaterialPrepImporting(false)
    }
  }, [selectedMos, selectedImportRows, materialPrepInterfaceId, loadMoRecords])

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-6 border-b border-slate-800 pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">生產批備料</h1>
            <p className="text-slate-400 mt-1 text-sm">
              自動列出製令總表中「未備料」的製令，比對系統 BOM / 替代料 / 物料庫存後可送 ARGO 批備料或標記為無需備料。
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => void loadMoRecords()}
              disabled={moLoading}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors text-sm"
            >
              {moLoading ? '讀取中...' : '🔄 重新整理'}
            </button>
          </div>
        </div>

        {/* 流程狀態 */}
        <div className="mb-6 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-3">流程狀態</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2">
              <span className="text-slate-400">未備料製令</span>
              <span className="text-cyan-300 font-semibold">{moRecords.length} 筆</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2">
              <span className="text-slate-400">BOM 比對</span>
              <span className="text-cyan-300 font-semibold">{bomLoading ? '讀取中' : `${materialPrepRows.length} 筆`}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2">
              <span className="text-slate-400">已選取</span>
              <span className="text-orange-300 font-semibold">{selectedMos.size} 筆製令</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded-lg bg-emerald-950/30 border border-emerald-800/30 px-3 py-2 text-emerald-300">可直接備料 {materialPrepSummary['可直接備料']}</div>
            <div className="rounded-lg bg-amber-950/30 border border-amber-800/30 px-3 py-2 text-amber-300">建議替代 {materialPrepSummary['建議替代']}</div>
            <div className="rounded-lg bg-red-950/30 border border-red-800/30 px-3 py-2 text-red-300">缺料 {materialPrepSummary['缺料']}</div>
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2 text-slate-300">無 BOM {materialPrepSummary['無BOM']}</div>
          </div>
        </div>

        {/* 操作區 */}
        <div className="mb-6 bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">批備料 ARGO 介面編號</label>
              <input
                value={materialPrepInterfaceId}
                onChange={e => setMaterialPrepInterfaceId(e.target.value)}
                placeholder="例如 IFAF0XX"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">說明</label>
              <div className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 leading-relaxed min-h-[42px] flex items-center">
                勾選製令後可批量「送 ARGO 批備料」或「標記為無需備料」。庫存只從 Supabase material_inventory_list 讀取，請另行於物料總表頁同步 ARGO 庫存。
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
              選取 {selectedMos.size} 筆製令｜可送批備料 {selectedImportRows.length} 筆料號
            </span>
            <button
              onClick={() => void handleImportAndMarkDone()}
              disabled={materialPrepImporting || actionBusy || selectedMos.size === 0}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium transition-colors text-sm"
            >
              {materialPrepImporting ? '匯入中...' : '送 ARGO 批備料 + 標為已備料'}
            </button>
            <button
              onClick={() => void handleMarkNoNeed()}
              disabled={actionBusy || materialPrepImporting || selectedMos.size === 0}
              className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium transition-colors text-sm"
            >
              {actionBusy ? '處理中...' : '標記為「無需備料」'}
            </button>
          </div>
          {materialPrepMessage && (
            <p className={`text-sm whitespace-pre-line ${materialPrepMessage.startsWith('❌') ? 'text-red-300' : 'text-emerald-300'}`}>
              {materialPrepMessage}
            </p>
          )}
          {actionMessage && (
            <p className={`text-sm ${actionMessage.startsWith('❌') ? 'text-red-300' : 'text-emerald-300'}`}>
              {actionMessage}
            </p>
          )}
        </div>

        {/* 製令清單 + BOM 表 */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          {moLoading ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">未備料製令讀取中...</div>
          ) : moError ? (
            <div className="px-4 py-10 text-center text-red-300 text-sm">{moError}</div>
          ) : moRecords.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-500 text-sm">目前沒有未備料的製令</div>
          ) : bomLoading ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">BOM / 替代料 / 庫存資料讀取中...</div>
          ) : bomError ? (
            <div className="px-4 py-10 text-center text-red-300 text-sm">{bomError}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/80 border-b border-slate-700">
                    <th className="px-2 py-3 text-center sticky left-0 bg-slate-800/80 z-10 w-10">
                      <input
                        type="checkbox"
                        checked={moRecords.length > 0 && selectedMos.size === moRecords.length}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/30"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-slate-300 text-xs whitespace-nowrap">製令單號</th>
                    <th className="px-3 py-3 text-left text-slate-300 text-xs whitespace-nowrap">客戶</th>
                    <th className="px-3 py-3 text-left text-slate-300 text-xs whitespace-nowrap">來源訂單</th>
                    <th className="px-3 py-3 text-left text-slate-300 text-xs whitespace-nowrap">生產貨號</th>
                    <th className="px-3 py-3 text-left text-slate-300 text-xs whitespace-nowrap">原料料號</th>
                    <th className="px-3 py-3 text-left text-slate-300 text-xs whitespace-nowrap">原料名稱</th>
                    <th className="px-3 py-3 text-right text-slate-300 text-xs whitespace-nowrap">需求量</th>
                    <th className="px-3 py-3 text-right text-slate-300 text-xs whitespace-nowrap">現有庫存</th>
                    <th className="px-3 py-3 text-left text-slate-300 text-xs whitespace-nowrap">使用料號</th>
                    <th className="px-3 py-3 text-right text-slate-300 text-xs whitespace-nowrap">選用庫存</th>
                    <th className="px-3 py-3 text-left text-slate-300 text-xs whitespace-nowrap">狀態</th>
                    <th className="px-3 py-3 text-left text-slate-300 text-xs whitespace-nowrap">說明</th>
                  </tr>
                </thead>
                <tbody>
                  {materialPrepRows.map((row, index) => {
                    const checked = selectedMos.has(row.mo_number)
                    return (
                      <tr key={`${row.row_key}-${index}`} className={`border-b border-slate-800/50 ${checked ? 'bg-cyan-950/30' : index % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-900/20'} hover:bg-slate-800/40`}>
                        <td className="px-2 py-2 text-center sticky left-0 bg-inherit z-10">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMo(row.mo_number)}
                            className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/30"
                          />
                        </td>
                        <td className="px-3 py-2 text-cyan-300 font-mono text-xs whitespace-nowrap">{row.mo_number}</td>
                        <td className="px-3 py-2 text-slate-300 text-xs max-w-[180px] truncate" title={row.customer}>{row.customer}</td>
                        <td className="px-3 py-2 text-slate-300 text-xs whitespace-nowrap">{row.source_order}</td>
                        <td className="px-3 py-2 text-slate-300 text-xs whitespace-nowrap">{row.product_code}</td>
                        <td className="px-3 py-2 text-slate-300 text-xs whitespace-nowrap">{row.source_material_code}</td>
                        <td className="px-3 py-2 text-slate-300 text-xs max-w-[220px] truncate" title={row.source_material_name}>{row.source_material_name}</td>
                        <td className="px-3 py-2 text-right text-slate-300 text-xs whitespace-nowrap">{formatQty(row.required_qty)} {row.unit}</td>
                        <td className="px-3 py-2 text-right text-slate-300 text-xs whitespace-nowrap">{formatQty(row.stock_qty)}</td>
                        <td className="px-3 py-2 text-xs min-w-[240px]">
                          {row.status === '無BOM' ? (
                            <span className="text-slate-500">—</span>
                          ) : (
                            <select
                              value={row.selected_material_code}
                              onChange={e => handleSelectMaterialOverride(row.row_key, e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                            >
                              {row.substitute_options.map(option => (
                                <option key={option.code} value={option.code}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300 text-xs whitespace-nowrap">
                          {row.selected_material_code ? formatQty(row.selected_material_stock_qty) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full ${
                            row.status === '可直接備料' ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/40' :
                            row.status === '建議替代' ? 'bg-amber-950/50 text-amber-300 border border-amber-800/40' :
                            row.status === '缺料' ? 'bg-red-950/50 text-red-300 border border-red-800/40' :
                            'bg-slate-950 text-slate-300 border border-slate-700'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-xs max-w-[320px]" title={row.note}>{row.note}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
