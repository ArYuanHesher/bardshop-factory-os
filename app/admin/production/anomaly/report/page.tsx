'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../../../../lib/supabaseClient'

const DEFAULT_PERSONNEL_OPTIONS = ['王小明', '李小華', '陳建宏', '課長A', '主管B', '品保C', '作業員A', '作業員B', '技術員C']

export default function QaReportFormPage() {
  const [orderNumber, setOrderNumber] = useState('')
  const [itemCode, setItemCode] = useState('')
  const [quantity, setQuantity] = useState<number>(0)
  const [opName, setOpName] = useState('')
  const [station, setStation] = useState('')
  const [reason, setReason] = useState('')
  const [reporter, setReporter] = useState('')
  const [personnelOptions, setPersonnelOptions] = useState<string[]>(DEFAULT_PERSONNEL_OPTIONS)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchPersonnelOptions = async () => {
      const { data, error } = await supabase
        .from('qa_anomaly_option_items')
        .select('option_value')
        .eq('option_type', 'personnel')
        .order('option_value', { ascending: true })

      if (error) {
        console.error(error)
        return
      }

      const options = ((data as Array<{ option_value: string }>) || [])
        .map((item) => item.option_value)
        .filter((value) => typeof value === 'string' && value.trim().length > 0)

      setPersonnelOptions(options.length ? options : DEFAULT_PERSONNEL_OPTIONS)
    }

    void fetchPersonnelOptions()
  }, [])

  const handleSubmit = async () => {
    if (!orderNumber.trim() || !itemCode.trim()) {
      alert('請至少填寫工單號與品號')
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
        status: 'pending',
        source_order_id: null,
        task_id: null,
        order_number: orderNumber.trim(),
        item_code: itemCode.trim(),
        quantity: Number.isFinite(quantity) ? quantity : 0,
        op_name: opName.trim() || null,
        station: station.trim() || null,
        section_id: null,
        qa_reporter: reporter.trim() || null,
      }

      const { error } = await supabase.from('schedule_anomaly_reports').insert(payload)
      if (error) throw error

      alert('✅ 已送出異常回報單')
      setOrderNumber('')
      setItemCode('')
      setQuantity(0)
      setOpName('')
      setStation('')
      setReason('')
      setReporter('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知錯誤'
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
            <label className="text-xs text-slate-400">工單號</label>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">品號</label>
            <input
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">數量</label>
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">異常回報人</label>
            <select
              value={reporter}
              onChange={(e) => setReporter(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            >
              <option value="">請選擇</option>
              {personnelOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400">工序名稱</label>
            <input
              value={opName}
              onChange={(e) => setOpName(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">站別</label>
            <input
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400">異常原因</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="請填寫異常描述..."
            className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
          />
        </div>

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
