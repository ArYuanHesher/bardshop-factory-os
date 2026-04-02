'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { NavButton } from '../../../components/NavButton'
import { supabase } from '../../../lib/supabaseClient'

interface ParsedCsvRow {
  rowNo: number
  createdDate: string
  orderNumber: string
  department: string
  reporter: string
  handlers: string[]
  category: string
  reason: string
  responsible: string[]
  validationError: string | null
}

const HEADER_ALIASES: Record<string, string[]> = {
  createdDate: ['日期', 'created_date', 'date', 'createdAt'],
  orderNumber: ['相關單號', '單號', 'order_number', 'orderNo'],
  department: ['部門', 'qa_department', 'department'],
  reporter: ['異常回報人', 'qa_reporter', 'reporter'],
  handlers: ['異常處理人', 'qa_handlers', 'handlers'],
  category: ['異常分類', 'qa_category', 'category'],
  reason: ['異常原因', 'reason'],
  responsible: ['缺失人員', 'qa_responsible', 'responsible'],
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  result.push(current.trim())
  return result
}

function normalizePeopleCell(raw: string): string[] {
  if (!raw) return []
  return raw
    .split(/[|,、/]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function mapHeaderIndex(headerCells: string[]) {
  const lowerHeaders = headerCells.map((item) => item.trim().toLowerCase())

  const getIndex = (aliases: string[]) => {
    for (const alias of aliases) {
      const idx = lowerHeaders.findIndex((header) => header === alias.toLowerCase())
      if (idx >= 0) return idx
    }
    return -1
  }

  return {
    createdDate: getIndex(HEADER_ALIASES.createdDate),
    orderNumber: getIndex(HEADER_ALIASES.orderNumber),
    department: getIndex(HEADER_ALIASES.department),
    reporter: getIndex(HEADER_ALIASES.reporter),
    handlers: getIndex(HEADER_ALIASES.handlers),
    category: getIndex(HEADER_ALIASES.category),
    reason: getIndex(HEADER_ALIASES.reason),
    responsible: getIndex(HEADER_ALIASES.responsible),
  }
}

function normalizeDateToIso(dateValue: string): string | null {
  const value = dateValue.trim()
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const getReadableErrorMessage = (err: unknown) => {
  if (err instanceof Error && err.message) return err.message

  if (typeof err === 'object' && err !== null) {
    const maybeError = err as {
      message?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
    }

    const parts = [
      typeof maybeError.message === 'string' ? maybeError.message : '',
      typeof maybeError.details === 'string' ? maybeError.details : '',
      typeof maybeError.hint === 'string' ? maybeError.hint : '',
      typeof maybeError.code === 'string' ? `code: ${maybeError.code}` : '',
    ].filter(Boolean)

    if (parts.length > 0) return parts.join(' | ')
  }

  return '未知錯誤'
}

const isQaReportTypeConstraintError = (err: unknown) => {
  if (typeof err !== 'object' || err === null) return false
  const maybeError = err as { message?: unknown; code?: unknown }
  const message = typeof maybeError.message === 'string' ? maybeError.message : ''
  const code = typeof maybeError.code === 'string' ? maybeError.code : ''
  return code === '23514' && message.includes('schedule_anomaly_reports_report_type_check')
}

export default function QaBatchUploadPage() {
  const [rows, setRows] = useState<ParsedCsvRow[]>([])
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)

  const validRows = useMemo(() => rows.filter((row) => !row.validationError), [rows])
  const invalidRows = useMemo(() => rows.filter((row) => !!row.validationError), [rows])

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length < 2) {
      alert('CSV 內容不足，至少需要標題列 + 1 筆資料')
      return
    }

    const headerCells = parseCsvLine(lines[0])
    const map = mapHeaderIndex(headerCells)

    if (map.orderNumber < 0 || map.reason < 0) {
      alert('CSV 必須包含「相關單號」與「異常原因」欄位')
      return
    }

    const parsedRows: ParsedCsvRow[] = lines.slice(1).map((line, rowIndex) => {
      const cells = parseCsvLine(line)
      const orderNumber = map.orderNumber >= 0 ? (cells[map.orderNumber] || '').trim() : ''
      const reason = map.reason >= 0 ? (cells[map.reason] || '').trim() : ''
      const createdDate = map.createdDate >= 0 ? (cells[map.createdDate] || '').trim() : ''

      const validationError = !orderNumber
        ? '缺少相關單號'
        : !reason
          ? '缺少異常原因'
          : null

      return {
        rowNo: rowIndex + 2,
        createdDate,
        orderNumber,
        department: map.department >= 0 ? (cells[map.department] || '').trim() : '',
        reporter: map.reporter >= 0 ? (cells[map.reporter] || '').trim() : '',
        handlers: map.handlers >= 0 ? normalizePeopleCell(cells[map.handlers] || '') : [],
        category: map.category >= 0 ? (cells[map.category] || '').trim() : '',
        reason,
        responsible: map.responsible >= 0 ? normalizePeopleCell(cells[map.responsible] || '') : [],
        validationError,
      }
    })

    setRows(parsedRows)
    setFileName(file.name)
  }

  const handleInsert = async () => {
    if (validRows.length === 0) {
      alert('沒有可匯入資料')
      return
    }

    if (invalidRows.length > 0) {
      alert('CSV 仍有欄位錯誤，請先修正後再匯入')
      return
    }

    const orderNumbers = validRows.map((row) => row.orderNumber)
    const duplicateInFile = orderNumbers.filter((value, index) => orderNumbers.indexOf(value) !== index)

    if (duplicateInFile.length > 0) {
      const uniqueDuplicated = [...new Set(duplicateInFile)]
      alert(`CSV 內有重複單號，已阻擋匯入：\n${uniqueDuplicated.join(', ')}`)
      return
    }

    setUploading(true)
    try {
      const { data: existed, error: checkError } = await supabase
        .from('schedule_anomaly_reports')
        .select('order_number')
        .eq('report_type', 'qa')
        .in('order_number', orderNumbers)

      if (checkError) throw checkError

      const existedOrderNumbers = [...new Set(((existed as Array<{ order_number: string }>) || []).map((item) => item.order_number).filter(Boolean))]

      if (existedOrderNumbers.length > 0) {
        alert(`資料庫已有重複單號，已阻擋匯入：\n${existedOrderNumbers.join(', ')}`)
        return
      }

      const payload = validRows.map((row) => ({
        report_type: 'qa',
        reason: row.reason,
        status: 'pending',
        source_order_id: null,
        task_id: null,
        order_number: row.orderNumber,
        item_code: '',
        quantity: 0,
        op_name: null,
        station: null,
        section_id: null,
        created_at: normalizeDateToIso(row.createdDate) || new Date().toISOString(),
        qa_department: row.department || null,
        qa_reporter: row.reporter || null,
        qa_handlers: row.handlers,
        qa_category: row.category || null,
        qa_responsible: row.responsible,
      }))

      const { error: insertError } = await supabase
        .from('schedule_anomaly_reports')
        .insert(payload)

      if (insertError) throw insertError

      alert(`✅ 已成功匯入 ${payload.length} 筆到異常紀錄表`)
      setRows([])
      setFileName('')
    } catch (err: unknown) {
      if (isQaReportTypeConstraintError(err)) {
        alert('匯入失敗：資料庫尚未允許 report_type=qa。請先執行 sql/20260224_allow_qa_report_type.sql migration。')
        return
      }
      const message = getReadableErrorMessage(err)
      alert(`匯入失敗：${message}`)
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplateCsv = () => {
    const headers = ['日期', '相關單號', '部門', '異常回報人', '異常處理人', '異常分類', '異常原因', '缺失人員']
    const csv = `${headers.join(',')}\n`
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'qa_anomaly_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight">批量上傳異常單</h1>
          <p className="text-emerald-400 mt-1 font-mono text-sm uppercase">BATCH UPLOAD // CSV PREVIEW & VALIDATION</p>
        </div>
        <NavButton href="/qa" direction="back" title="返回品保專區" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={downloadTemplateCsv}
            className="px-4 py-2 rounded border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            下載範例 CSV
          </button>
          <button
            onClick={() => void handleInsert()}
            disabled={uploading || validRows.length === 0}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:bg-slate-700 disabled:text-slate-400"
          >
            {uploading ? '匯入中...' : '加入異常紀錄表'}
          </button>
          {fileName && <span className="text-xs text-slate-400">目前檔案：{fileName}</span>}
      </div>

      <p className="text-xs text-slate-500">CSV 建議欄位：日期、相關單號、部門、異常回報人、異常處理人、異常分類、異常原因、缺失人員。</p>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-auto">
        <table className="min-w-[1200px] w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono">
            <tr>
              <th className="p-3">列</th>
              <th className="p-3">日期</th>
              <th className="p-3">相關單號</th>
              <th className="p-3">部門</th>
              <th className="p-3">異常回報人</th>
              <th className="p-3">異常處理人</th>
              <th className="p-3">異常分類</th>
              <th className="p-3">異常原因</th>
              <th className="p-3">缺失人員</th>
              <th className="p-3">檢查</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-slate-500">請先上傳 CSV 以預覽資料</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.rowNo} className="hover:bg-slate-800/30 align-top">
                  <td className="p-3 font-mono text-xs text-slate-500">{row.rowNo}</td>
                  <td className="p-3 text-xs">{row.createdDate || '-'}</td>
                  <td className="p-3 text-cyan-300 font-mono">{row.orderNumber || '-'}</td>
                  <td className="p-3 text-xs">{row.department || '-'}</td>
                  <td className="p-3 text-xs">{row.reporter || '-'}</td>
                  <td className="p-3 text-xs">{row.handlers.length ? row.handlers.join('、') : '-'}</td>
                  <td className="p-3 text-xs">{row.category || '-'}</td>
                  <td className="p-3 text-xs">{row.reason || '-'}</td>
                  <td className="p-3 text-xs">{row.responsible.length ? row.responsible.join('、') : '-'}</td>
                  <td className="p-3 text-xs">
                    {row.validationError ? (
                      <span className="px-2 py-1 rounded bg-rose-900/40 border border-rose-700 text-rose-300">{row.validationError}</span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-emerald-900/40 border border-emerald-700 text-emerald-300">可匯入</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
