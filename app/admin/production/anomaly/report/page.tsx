'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../../../../lib/supabaseClient'

const DEFAULT_PERSONNEL_OPTIONS = ['王小明', '李小華', '陳建宏', '課長A', '主管B', '品保C', '作業員A', '作業員B', '技術員C']
const DEFAULT_CATEGORY_OPTIONS = ['品質異常', '製程異常', '資料異常']
const DEFAULT_DEPARTMENT_OPTIONS = ['品保部', '生產部', '工程部']

const getTodayDateInput = () => new Date().toISOString().slice(0, 10)

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

export default function QaReportFormPage() {
  const [createdDate, setCreatedDate] = useState(getTodayDateInput())
  const [orderNumber, setOrderNumber] = useState('')
  const [status] = useState<'pending'>('pending')
  const [reason, setReason] = useState('')
  const [reporter, setReporter] = useState('')
  const [personnelOptions, setPersonnelOptions] = useState<string[]>(DEFAULT_PERSONNEL_OPTIONS)
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORY_OPTIONS)
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(DEFAULT_DEPARTMENT_OPTIONS)
  const [department, setDepartment] = useState('')
  const [category, setCategory] = useState('')
  const [handlers, setHandlers] = useState<string[]>([])
  const [handlerInput, setHandlerInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchOptions = async () => {
      const { data, error } = await supabase
        .from('qa_anomaly_option_items')
        .select('option_type, option_value')
        .order('option_value', { ascending: true })

      if (error) {
        console.error(error)
        return
      }

      const rows = (data as Array<{ option_type: string; option_value: string }>) || []
      const personnel = rows
        .filter((item) => item.option_type === 'personnel')
        .map((item) => item.option_value)
        .filter((value) => typeof value === 'string' && value.trim().length > 0)

      const categories = rows
        .filter((item) => item.option_type === 'category')
        .map((item) => item.option_value)
        .filter((value) => typeof value === 'string' && value.trim().length > 0)

      const departments = rows
        .filter((item) => item.option_type === 'department')
        .map((item) => item.option_value)
        .filter((value) => typeof value === 'string' && value.trim().length > 0)

      setPersonnelOptions(personnel.length ? personnel : DEFAULT_PERSONNEL_OPTIONS)
      setCategoryOptions(categories.length ? categories : DEFAULT_CATEGORY_OPTIONS)
      setDepartmentOptions(departments.length ? departments : DEFAULT_DEPARTMENT_OPTIONS)
    }

    void fetchOptions()
  }, [])

  const handleSubmit = async () => {
    if (!orderNumber.trim()) {
      alert('請填寫相關單號')
      return
    }

    if (!reason.trim()) {
      alert('請填寫異常原因')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        report_type: 'qa',
        reason: reason.trim(),
        status,
        source_order_id: null,
        task_id: null,
        order_number: orderNumber.trim(),
        item_code: '',
        quantity: 0,
        op_name: null,
        station: null,
        section_id: null,
        created_at: createdDate ? `${createdDate}T00:00:00.000Z` : new Date().toISOString(),
        qa_department: department.trim() || null,
        qa_reporter: reporter.trim() || null,
        qa_handlers: handlers,
        qa_category: category || null,
        qa_responsible: [],
      }

      const { error } = await supabase.from('schedule_anomaly_reports').insert(payload)
      if (error) throw error

      alert('✅ 已送出異常回報單')
      setCreatedDate(getTodayDateInput())
      setOrderNumber('')
      setReason('')
      setDepartment('')
      setReporter('')
      setHandlers([])
      setCategory('')
      setHandlerInput('')
    } catch (err: unknown) {
      if (isQaReportTypeConstraintError(err)) {
        alert('送出失敗：資料庫尚未允許 report_type=qa。請先執行 sql/20260224_allow_qa_report_type.sql migration。')
        return
      }
      const message = getReadableErrorMessage(err)
      alert(`送出失敗：${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-[1000px] mx-auto min-h-screen space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">異常回報單</h1>
          <p className="text-teal-400 mt-1 font-mono text-sm uppercase">QA REPORT FORM</p>
        </div>
        <Link href="/qa" className="px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">
          返回品保專區
        </Link>
      </div>

      <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">日期</label>
            <input
              type="date"
              value={createdDate}
              onChange={(e) => setCreatedDate(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">相關單號</label>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">狀態</label>
            <div className="mt-1 px-3 py-2 rounded border border-amber-700 bg-amber-900/30 text-amber-300 text-sm font-bold">
              待處理
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">部門</label>
            <input
              list="qa-department-options"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="輸入或選擇部門"
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">異常回報人</label>
            <input
              list="qa-personnel-options"
              value={reporter}
              onChange={(e) => setReporter(e.target.value)}
              placeholder="輸入或選擇回報人"
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">異常處理人</label>
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap gap-1">
                {handlers.map((name) => (
                  <span key={name} className="px-2 py-0.5 rounded bg-cyan-900/40 border border-cyan-700 text-cyan-200 text-xs flex items-center gap-1">
                    {name}
                    <button type="button" onClick={() => setHandlers((prev) => prev.filter((item) => item !== name))}>×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  list="qa-personnel-options"
                  value={handlerInput}
                  onChange={(e) => setHandlerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    const value = handlerInput.trim()
                    if (!value) return
                    setHandlers((prev) => (prev.includes(value) ? prev : [...prev, value]))
                    setHandlerInput('')
                  }}
                  placeholder="輸入或選擇處理人"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const value = handlerInput.trim()
                    if (!value) return
                    setHandlers((prev) => (prev.includes(value) ? prev : [...prev, value]))
                    setHandlerInput('')
                  }}
                  className="px-3 py-2 rounded border border-cyan-700 text-cyan-300 hover:bg-cyan-900/30 text-sm"
                >
                  新增
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">異常分類</label>
            <input
              list="qa-category-options"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="輸入或選擇異常分類"
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400">異常原因（手填）</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="請填寫異常描述..."
            className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
          />
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
          缺失人員請於「異常紀錄表」編輯時填寫。
        </div>

        <datalist id="qa-personnel-options">
          {personnelOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="qa-category-options">
          {categoryOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <datalist id="qa-department-options">
          {departmentOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold disabled:bg-slate-700 disabled:text-slate-400"
          >
            {submitting ? '送出中...' : '送出回報單'}
          </button>
        </div>
      </div>
    </div>
  )
}
