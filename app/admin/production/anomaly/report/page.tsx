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
  const [reporterDepartment, setReporterDepartment] = useState('')
  const [reporter, setReporter] = useState('')
  const [handlerDepartment, setHandlerDepartment] = useState('')
  const [handlerPersonnel, setHandlerPersonnel] = useState('')
  const [personnelOptions, setPersonnelOptions] = useState<OptionItem[]>([])
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORY_OPTIONS)
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(DEFAULT_DEPARTMENT_OPTIONS)
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // QA 部門欄位：以 reporterDepartment 為主
  // handlers 欄位補上，預設為單一人員
  const handlers = handlerPersonnel ? [handlerPersonnel] : [];

  useEffect(() => {
    const fetchOptions = async () => {
      const { data, error } = await supabase
        .from('qa_anomaly_option_items')
        .select('option_type, option_value, department_value')
        .order('option_value', { ascending: true })

      if (error) {
        console.error(error)
        return
      }

      const rows = (data as Array<{ option_type: string; option_value: string }>) || []
      const personnel = rows
        .filter((item) => item.option_type === 'personnel')
        .map((item) => ({
          option_value: item.option_value,
          department_value: item.department_value || '',
        }))
        .filter((item) => typeof item.option_value === 'string' && item.option_value.trim().length > 0)

      const categories = rows
        .filter((item) => item.option_type === 'category')
        .map((item) => item.option_value)
        .filter((value) => typeof value === 'string' && value.trim().length > 0)

      const departments = rows
        .filter((item) => item.option_type === 'department')
        .map((item) => item.option_value)
        .filter((value) => typeof value === 'string' && value.trim().length > 0)

      setPersonnelOptions(personnel.length ? personnel : DEFAULT_PERSONNEL_OPTIONS.map(v => ({ option_value: v, department_value: '' })))
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

    if (!reporterDepartment.trim()) {
      alert('請選擇部門（必填）')
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
        order_number: orderNumber.trim(),
        created_at: createdDate ? `${createdDate}T00:00:00.000Z` : new Date().toISOString(),
        qa_department: reporterDepartment.trim() || null,
        qa_reporter: reporter.trim() || null,
        qa_handlers: handlers,
        qa_category: category || null,
        qa_responsible: [],
        handler_department: handlerDepartment.trim() || null,
      }

      const { error } = await supabase.from('schedule_anomaly_reports').insert(payload)
      if (error) throw error

      alert('✅ 已送出異常回報單')
      setCreatedDate(getTodayDateInput())
      setOrderNumber('')
      setReason('')
      setReporterDepartment('')
      setReporter('')
      setHandlerDepartment('')
      setHandlerPersonnel('')
      setCategory('')
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
        <Link href="/" className="px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">
          返回首頁
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

          <div className="md:col-span-2 flex gap-4">
            <div style={{ width: '50%' }}>
              <label className="text-xs text-slate-400">異常分類</label>
              <input
                list="qa-category-options"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="輸入或選擇異常分類"
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div style={{ width: '50%' }} className="flex flex-col justify-end">
              <label className="text-xs text-slate-400">狀態</label>
              <div className="mt-1 w-full">
                <span className="bg-yellow-400 text-black px-3 py-2 rounded text-xs font-bold w-full block text-center" style={{height:'40px',display:'flex',alignItems:'center',justifyContent:'center'}}>待處理</span>
              </div>
            </div>
          </div>

          <div className="col-span-1">
            <label className="text-xs text-slate-400">異常回報-部門</label>
            <input
              list="qa-department-options"
              value={reporterDepartment}
              onChange={(e) => {
                setReporterDepartment(e.target.value);
                setReporter('');
              }}
              placeholder="輸入或選擇部門"
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-slate-400">異常回報-人員</label>
            {reporterDepartment ? (
              <>
                <input
                  list="qa-reporter-personnel-options"
                  value={reporter}
                  onChange={(e) => setReporter(e.target.value)}
                  placeholder="先選部門，再選人員"
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                />
                <datalist id="qa-reporter-personnel-options">
                  {personnelOptions.filter(p => p.department_value === reporterDepartment).map((option, idx) => (
                    <option key={idx} value={option.option_value} />
                  ))}
                </datalist>
              </>
            ) : (
              <div className="mt-1 text-slate-500 text-xs">請先選部門</div>
            )}
          </div>
          <div className="col-span-1">
            <label className="text-xs text-slate-400">異常處理-部門</label>
            <input
              list="qa-department-options"
              value={handlerDepartment}
              onChange={e => {
                setHandlerDepartment(e.target.value);
                setHandlerPersonnel('');
              }}
              placeholder="輸入或選擇部門"
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-slate-400">異常處理-人員</label>
            {handlerDepartment ? (
              <>
                <input
                  list="qa-handler-personnel-options"
                  value={handlerPersonnel}
                  onChange={e => setHandlerPersonnel(e.target.value)}
                  placeholder="先選部門，再選人員"
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                />
                <datalist id="qa-handler-personnel-options">
                  {personnelOptions.filter(p => p.department_value === handlerDepartment).map((option, i) => (
                    <option key={i} value={option.option_value} />
                  ))}
                </datalist>
              </>
            ) : (
              <div className="mt-1 text-slate-500 text-xs">請先選部門</div>
            )}
          </div>
          {/* 已移除多餘的先選部門再選人員空格 */}
        </div>

        <div>
          {/* 已移除多餘的異常處理部門與人員欄位 */}

          {/* 異常分類欄位已移至狀態欄位，避免重複 */}
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
          {personnelOptions.map((option, idx) => (
            <option
              key={typeof option === 'string' ? option : (option.option_value + (option.department_value || '') + idx)}
              value={typeof option === 'string' ? option : option.option_value}
            />
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
