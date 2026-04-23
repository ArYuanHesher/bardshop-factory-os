import { NextRequest, NextResponse } from 'next/server'

import { formatSupabaseAdminError, getSupabaseAdminClient } from '../../../lib/supabaseAdmin'

const API_BASE = process.env.ARGOERP_API_BASE!
const USERNAME = process.env.ARGOERP_USERNAME!
const PASSWORD = process.env.ARGOERP_PASSWORD!
const SEGMENT = process.env.ARGOERP_SEGMENT!

interface ApiKeyResponse {
  RESULT: {
    APIKEY1: string
    APIKEY2: string
    APIKEY3: string
  }
}

interface PjSyncMapping {
  docNoField: string
  subNoField?: string
  itemCodeField?: string
  descriptionField?: string
  qtyField?: string
  unitField?: string
  statusField?: string
  startDateField?: string
  endDateField?: string
  customerVendorField?: string
  remarkField?: string
}

interface InventorySyncMapping {
  sequenceNoField?: string
  itemCodeField: string
  itemNameField?: string
  specField?: string
  physicalCountField?: string
  bookCountField: string
  warehouseTotalField?: string
  // 啟用時會將相同 itemCode 的 bookCountField 在 server 端累加（用於 iv_inventoryboh 等明細表）
  groupByItemCode?: boolean
}

function getRecordValue(record: Record<string, unknown>, fieldName?: string) {
  if (!fieldName) return undefined

  if (fieldName in record) return record[fieldName]

  const normalizedField = fieldName.trim().toLowerCase()
  const matchedKey = Object.keys(record).find((key) => key.trim().toLowerCase() === normalizedField)
  return matchedKey ? record[matchedKey] : undefined
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function findObjectRows(value: unknown, seen = new Set<unknown>()): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return []
  if (seen.has(value)) return []
  seen.add(value)

  if (Array.isArray(value)) {
    const objectRows = value.filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    )
    if (objectRows.length > 0) return objectRows

    for (const item of value) {
      const nested = findObjectRows(item, seen)
      if (nested.length > 0) return nested
    }

    return []
  }

  const record = value as Record<string, unknown>
  const priorityKeys = ['RESULT', 'DATA', 'ROWS', 'rows', 'items', 'Items', 'Table', 'TABLE']

  for (const key of priorityKeys) {
    if (!(key in record)) continue
    const nested = findObjectRows(record[key], seen)
    if (nested.length > 0) return nested
  }

  for (const nestedValue of Object.values(record)) {
    const nested = findObjectRows(nestedValue, seen)
    if (nested.length > 0) return nested
  }

  return []
}

function normalizeInventoryRows(rows: Record<string, unknown>[], mapping: InventorySyncMapping) {
  const normalizedAt = new Date().toISOString()

  if (mapping.groupByItemCode) {
    // 明細表模式：將相同 itemCode 的 bookCountField 累加（等效 GROUP BY mbp_part SUM(qty)）
    const grouped = new Map<string, {
      item_code: string
      item_name: string
      spec: string
      book_count: number
      physical_count: number
      qisheng_sichuan_total: number
    }>()

    for (const row of rows) {
      const itemCode = String(getRecordValue(row, mapping.itemCodeField) ?? '').trim()
      if (!itemCode) continue
      const existing = grouped.get(itemCode)
      const bookQty = toNumber(getRecordValue(row, mapping.bookCountField))
      if (existing) {
        existing.book_count += bookQty
        existing.physical_count += toNumber(getRecordValue(row, mapping.physicalCountField))
        existing.qisheng_sichuan_total += toNumber(getRecordValue(row, mapping.warehouseTotalField))
      } else {
        grouped.set(itemCode, {
          item_code: itemCode,
          item_name: String(getRecordValue(row, mapping.itemNameField) ?? '').trim(),
          spec: String(getRecordValue(row, mapping.specField) ?? '').trim(),
          book_count: bookQty,
          physical_count: toNumber(getRecordValue(row, mapping.physicalCountField)),
          qisheng_sichuan_total: toNumber(getRecordValue(row, mapping.warehouseTotalField)),
        })
      }
    }

    return [...grouped.values()].map((entry, index) => ({
      sequence_no: index + 1,
      ...entry,
      updated_at: normalizedAt,
    }))
  }

  // 一般模式：一資料一筆
  const normalizedRows = rows
    .map((row, index) => {
      const itemCode = String(getRecordValue(row, mapping.itemCodeField) ?? '').trim()
      if (!itemCode) return null

      return {
        sequence_no: mapping.sequenceNoField ? toNumber(getRecordValue(row, mapping.sequenceNoField)) : index + 1,
        item_code: itemCode,
        item_name: String(getRecordValue(row, mapping.itemNameField) ?? '').trim(),
        spec: String(getRecordValue(row, mapping.specField) ?? '').trim(),
        physical_count: toNumber(getRecordValue(row, mapping.physicalCountField)),
        book_count: toNumber(getRecordValue(row, mapping.bookCountField)),
        qisheng_sichuan_total: toNumber(getRecordValue(row, mapping.warehouseTotalField)),
        updated_at: normalizedAt,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  return normalizedRows
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractApiError(result: unknown): string | null {
  if (!result) return null
  if (typeof result === 'string') {
    return /(error|exception|invalid|ora-|未授權|授權失敗|授權錯誤|無權|驗證失敗|webservice未|失敗)/i.test(result) ? result : null
  }
  if (typeof result !== 'object') return null

  const record = result as Record<string, unknown>
  const candidates = [record.ERROR, record.error, record.message, record.MESSAGE]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }

  return null
}

function isArgoSuccess(result: unknown): boolean {
  if (!result) return false
  if (typeof result === 'string') {
    return !/(error|exception|invalid|ora-|未授權|授權失敗|授權錯誤|無權|驗證失敗|webservice未|失敗)/i.test(result)
  }
  if (typeof result !== 'object') return true

  const record = result as Record<string, unknown>
  if (record.STATUS !== undefined) {
    const status = String(record.STATUS).trim().toUpperCase()
    return !['0', 'FALSE', 'N', 'ERROR'].includes(status)
  }

  return extractApiError(result) === null
}

async function readApiResponse(res: Response) {
  const rawText = await res.text()
  const parsed = rawText ? tryParseJson(rawText) : null
  return { rawText, parsed }
}

async function getApiKeys(): Promise<{ APIKEY1: string; APIKEY2: string; APIKEY3: string }> {
  const res = await fetch(`${API_BASE}/S_APIKEY`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`S_APIKEY failed: ${res.status}`)
  const data: ApiKeyResponse = await res.json()
  if (!data.RESULT?.APIKEY1) throw new Error('S_APIKEY returned no keys')
  return data.RESULT
}

// GET: 測試連線 — 取得版本 + 金鑰驗證
export async function GET() {
  try {
    // 1. 取得 API 版本
    const versionRes = await fetch(`${API_BASE}/S_VERSION`, { method: 'GET' })
    const versionData = await versionRes.text()

    // 2. 取得金鑰（驗證帳密是否正確）
    const keys = await getApiKeys()

    return NextResponse.json({
      status: 'ok',
      version: versionData,
      segment: SEGMENT,
      keysObtained: true,
      apiBase: API_BASE,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ status: 'error', error: message }, { status: 500 })
  }
}

// POST: 匯入製令資料
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data, interfaceId } = body as {
      action: 'import' | 'query' | 'sync_inventory'
      data?: Record<string, unknown>[]
      interfaceId?: string
    }

    // 取得金鑰（5 分鐘時效）
    const keys = await getApiKeys()

    if (action === 'import') {
      if (!data || !interfaceId) {
        return NextResponse.json({ status: 'error', error: 'Missing data or interfaceId' }, { status: 400 })
      }

      const sparam = JSON.stringify({
        APIKEY1: keys.APIKEY1,
        APIKEY2: keys.APIKEY2,
        APIKEY3: keys.APIKEY3,
        SEGMENT,
        IMP: 'Y',
        INTERFACE: interfaceId,
        DATA: data,
      })

      const res = await fetch(`${API_BASE}/S_IMPORT`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sparam }),
      })

      const { rawText, parsed } = await readApiResponse(res)
      const error = extractApiError(parsed)
      const success = res.ok && isArgoSuccess(parsed)

      return NextResponse.json({
        status: success ? 'ok' : 'error',
        success,
        error,
        apiResult: parsed,
        rawText,
      }, { status: success ? 200 : 502 })
    }

    if (action === 'query') {
      const { table, filters, customColumn } = body as {
        table: string
        filters?: Record<string, string>
        customColumn?: string
      }

      const sparam = JSON.stringify({
        APIKEY1: keys.APIKEY1,
        APIKEY2: keys.APIKEY2,
        APIKEY3: keys.APIKEY3,
        SEGMENT,
        TABLE: table,
        SHOWNULLCOLUMN: 'N',
        ...(customColumn ? { CUSTOMCOLUMN: customColumn } : {}),
        ...(filters || {}),
      })

      const res = await fetch(`${API_BASE}/S_QUERY`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sparam }),
      })

      const { rawText, parsed } = await readApiResponse(res)
      const error = extractApiError(parsed)
      const success = res.ok && isArgoSuccess(parsed)

      return NextResponse.json({
        status: success ? 'ok' : 'error',
        success,
        error,
        apiResult: parsed,
        rawText,
      }, { status: success ? 200 : 502 })
    }

    if (action === 'sync_inventory') {
      const { table, filters, customColumn, mapping } = body as {
        table: string
        filters?: Record<string, string>
        customColumn?: string
        mapping?: InventorySyncMapping
      }

      if (!table?.trim()) {
        return NextResponse.json({ status: 'error', error: 'Missing inventory table' }, { status: 400 })
      }

      if (!mapping?.itemCodeField?.trim() || !mapping?.bookCountField?.trim()) {
        return NextResponse.json({ status: 'error', error: 'Missing required inventory field mapping' }, { status: 400 })
      }

      const sparam = JSON.stringify({
        APIKEY1: keys.APIKEY1,
        APIKEY2: keys.APIKEY2,
        APIKEY3: keys.APIKEY3,
        SEGMENT,
        TABLE: table,
        SHOWNULLCOLUMN: 'N',
        ...(customColumn ? { CUSTOMCOLUMN: customColumn } : {}),
        ...(filters || {}),
      })

      const res = await fetch(`${API_BASE}/S_QUERY`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sparam }),
      })

      const { rawText, parsed } = await readApiResponse(res)
      const error = extractApiError(parsed)
      const success = res.ok && isArgoSuccess(parsed)

      if (!success) {
        return NextResponse.json({
          status: 'error',
          error: error || 'ARGO inventory query failed',
          apiResult: parsed,
          rawText,
        }, { status: 502 })
      }

      const queryRows = findObjectRows(parsed)
      if (queryRows.length === 0) {
        return NextResponse.json({
          status: 'error',
          error: 'ARGO 查詢成功，但找不到可映射的資料列，請確認 TABLE / CUSTOMCOLUMN / 欄位設定。',
          apiResult: parsed,
          rawText,
        }, { status: 422 })
      }

      const normalizedRows = normalizeInventoryRows(queryRows, mapping)
      if (normalizedRows.length === 0) {
        return NextResponse.json({
          status: 'error',
          error: 'ARGO 查詢有回傳資料，但目前欄位映射抓不到料號，請調整欄位名稱。',
          apiResult: parsed,
          rawText,
        }, { status: 422 })
      }

      try {
        const supabaseAdmin = getSupabaseAdminClient()
        const { error: clearError } = await supabaseAdmin.from('material_inventory_list').delete().neq('id', 0)
        if (clearError) throw clearError

        const batchSize = 500
        for (let index = 0; index < normalizedRows.length; index += batchSize) {
          const chunk = normalizedRows.slice(index, index + batchSize)
          const { error: insertError } = await supabaseAdmin.from('material_inventory_list').insert(chunk)
          if (insertError) throw insertError
        }
      } catch (error) {
        const message = error instanceof Error ? formatSupabaseAdminError(error.message) : '寫入 material_inventory_list 失敗'
        return NextResponse.json({ status: 'error', error: message }, { status: 500 })
      }

      return NextResponse.json({
        status: 'ok',
        syncedCount: normalizedRows.length,
        skippedCount: Math.max(0, queryRows.length - normalizedRows.length),
        table,
      })
    }

    if (action === 'sync_pj') {
      const { table, filters, customColumn, docType, mapping } = body as {
        table: string
        filters?: Record<string, string>
        customColumn?: string
        docType: string
        mapping: PjSyncMapping
      }

      if (!table?.trim()) {
        return NextResponse.json({ status: 'error', error: 'Missing PJ table' }, { status: 400 })
      }
      if (!docType?.trim()) {
        return NextResponse.json({ status: 'error', error: 'Missing docType' }, { status: 400 })
      }
      if (!mapping?.docNoField?.trim()) {
        return NextResponse.json({ status: 'error', error: 'Missing docNoField in mapping' }, { status: 400 })
      }

      // ARGO S_QUERY 將 filter 組成 WHERE key value（無 = 符號），
      // 因此 value 必須包含完整算符，例如 "= 'SO'" 或 ">= 100"。
      // 此處若 value 尚未以算符開頭，自動補上 = 並對字串補引號。
      const quotedFilters: Record<string, string> = {}
      for (const [k, v] of Object.entries(filters || {})) {
        if (v !== undefined && v !== null) {
          const s = String(v).trim()
          // 已含算符（=, !=, <, >, LIKE, IN, BETWEEN, IS …）則原樣送出
          const hasOperator = /^(=|!=|<>|<=|>=|<|>|like|in\s*\(|between|is\s)/i.test(s)
          if (hasOperator) {
            quotedFilters[k] = s
          } else {
            // 數字直接加 =，字串加 = 並補單引號
            const isNumeric = /^\d+(\.\d+)?$/.test(s)
            quotedFilters[k] = isNumeric ? `= ${s}` : `= '${s.replace(/'/g, "''")}'`
          }
        }
      }

      const sparam = JSON.stringify({
        APIKEY1: keys.APIKEY1,
        APIKEY2: keys.APIKEY2,
        APIKEY3: keys.APIKEY3,
        SEGMENT,
        TABLE: table,
        SHOWNULLCOLUMN: 'N',
        ...(customColumn ? { CUSTOMCOLUMN: customColumn } : {}),
        ...quotedFilters,
      })

      const res = await fetch(`${API_BASE}/S_QUERY`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sparam }),
      })

      const { rawText, parsed } = await readApiResponse(res)
      const error = extractApiError(parsed)
      const success = res.ok && isArgoSuccess(parsed)

      if (!success) {
        return NextResponse.json({
          status: 'error',
          error: error || 'ARGO PJ query failed',
          rawText,
          debugSparam: JSON.parse(sparam) as Record<string, unknown>,
        }, { status: 502 })
      }

      const queryRows = findObjectRows(parsed)
      if (queryRows.length === 0) {
        return NextResponse.json({
          status: 'error',
          error: 'ARGO 查詢成功，但找不到可映射的資料列。請確認 TABLE / CUSTOMCOLUMN 設定。',
          rawText,
        }, { status: 422 })
      }

      const normalizedRows = normalizePjRows(queryRows, docType, mapping)

      // 第一筆 raw 資料回給前端供欄位對照用
      const rawSample = queryRows[0] ?? null

      if (normalizedRows.length === 0) {
        return NextResponse.json({
          status: 'error',
          error: `找到 ${queryRows.length.toString()} 筆原始資料，但 docNoField="${mapping.docNoField}" 欄位全為空，請調整欄位映射。`,
          rawSample,
          rawText,
        }, { status: 422 })
      }

      try {
        const supabaseAdmin = getSupabaseAdminClient()
        // 刪除同類型舊資料後重寫
        const { error: clearError } = await supabaseAdmin
          .from('erp_pj_sync')
          .delete()
          .eq('doc_type', docType)
        if (clearError) throw clearError

        const batchSize = 500
        for (let index = 0; index < normalizedRows.length; index += batchSize) {
          const chunk = normalizedRows.slice(index, index + batchSize)
          const { error: insertError } = await supabaseAdmin.from('erp_pj_sync').insert(chunk)
          if (insertError) throw insertError
        }
      } catch (err) {
        const message = err instanceof Error ? formatSupabaseAdminError(err.message) : '寫入 erp_pj_sync 失敗'
        return NextResponse.json({ status: 'error', error: message }, { status: 500 })
      }

      return NextResponse.json({
        status: 'ok',
        syncedCount: normalizedRows.length,
        skippedCount: Math.max(0, queryRows.length - normalizedRows.length),
        docType,
        table,
        rawSample,
      })
    }

    return NextResponse.json({ status: 'error', error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ status: 'error', error: message }, { status: 500 })
  }
}

function normalizePjRows(
  rows: Record<string, unknown>[],
  docType: string,
  mapping: PjSyncMapping,
) {
  const syncedAt = new Date().toISOString()
  const knownFields = new Set(Object.values(mapping).filter(Boolean))

  return rows
    .map((row) => {
      const docNo = String(getRecordValue(row, mapping.docNoField) ?? '').trim()
      if (!docNo) return null

      // 非映射欄位全部塞進 extra JSON
      const extra: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(row)) {
        if (!knownFields.has(k)) extra[k] = v
      }

      return {
        doc_type: docType,
        doc_no: docNo,
        sub_no: String(getRecordValue(row, mapping.subNoField) ?? '').trim(),
        item_code: String(getRecordValue(row, mapping.itemCodeField) ?? '').trim() || null,
        description: String(getRecordValue(row, mapping.descriptionField) ?? '').trim() || null,
        qty: toNumber(getRecordValue(row, mapping.qtyField)),
        unit: String(getRecordValue(row, mapping.unitField) ?? '').trim() || null,
        status: String(getRecordValue(row, mapping.statusField) ?? '').trim() || null,
        start_date: String(getRecordValue(row, mapping.startDateField) ?? '').trim() || null,
        end_date: String(getRecordValue(row, mapping.endDateField) ?? '').trim() || null,
        customer_vendor: String(getRecordValue(row, mapping.customerVendorField) ?? '').trim() || null,
        remark: String(getRecordValue(row, mapping.remarkField) ?? '').trim() || null,
        extra: Object.keys(extra).length > 0 ? extra : null,
        synced_at: syncedAt,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
}
