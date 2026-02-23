'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../../lib/supabaseClient'

interface AnomalyReport {
  id: number
  report_type: 'upv' | 'other' | string
  reason: string | null
  status: 'pending' | 'confirmed' | string
  source_order_id: number | null
  order_number: string
  item_code: string
  quantity: number
  op_name: string | null
  station: string | null
  created_at: string
  processed_at: string | null
  qa_reporter: string | null
  qa_handlers: string[] | null
  qa_category: string | null
  qa_responsible: string[] | null
}

interface OptionState {
  personnel: string[]
  categories: string[]
}

interface CreateFormState {
  createdDate: string
  orderNumber: string
  status: 'pending' | 'confirmed'
  reason: string
  reporter: string
  category: string
  handlers: string[]
  responsible: string[]
}

type OptionType = 'personnel' | 'category'

interface OptionItem {
  id: number
  option_type: OptionType
  option_value: string
}

const DEFAULT_OPTIONS: OptionState = {
  personnel: ['王小明', '李小華', '陳建宏', '課長A', '主管B', '品保C', '作業員A', '作業員B', '技術員C'],
  categories: ['品質異常', '製程異常', '資料異常'],
}

const getTodayDateInput = () => new Date().toISOString().slice(0, 10)

const DEFAULT_CREATE_FORM: CreateFormState = {
  createdDate: getTodayDateInput(),
  orderNumber: '',
  status: 'pending',
  reason: '',
  reporter: '',
  category: '',
  handlers: [],
  responsible: [],
}

export default function QaRecordsPage() {
  const [reports, setReports] = useState<AnomalyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CreateFormState>(DEFAULT_CREATE_FORM)
  const [savingEdit, setSavingEdit] = useState(false)
  const [options, setOptions] = useState<OptionState>(DEFAULT_OPTIONS)
  const [selectedReason, setSelectedReason] = useState('')
  const [selectedReporter, setSelectedReporter] = useState('')
  const [selectedHandler, setSelectedHandler] = useState('')
  const [selectedResponsible, setSelectedResponsible] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState({ pending: true, confirmed: true })
  const [orderKeyword, setOrderKeyword] = useState('')

  const fetchOptions = useCallback(async () => {
    const { data, error } = await supabase
      .from('qa_anomaly_option_items')
      .select('id, option_type, option_value')
      .order('option_type', { ascending: true })
      .order('option_value', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    const rows = (data as OptionItem[]) || []
    const personnelRows = rows.filter((row) => row.option_type === 'personnel').map((row) => row.option_value)
    const categoriesRows = rows.filter((row) => row.option_type === 'category').map((row) => row.option_value)

    const next: OptionState = {
      personnel: personnelRows,
      categories: categoriesRows,
    }

    setOptions({
      personnel: next.personnel.length ? next.personnel : DEFAULT_OPTIONS.personnel,
      categories: next.categories.length ? next.categories : DEFAULT_OPTIONS.categories,
    })
  }, [])

  useEffect(() => {
    void fetchOptions()
  }, [fetchOptions])

  const fetchReports = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('schedule_anomaly_reports')
      .select('*')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      alert(`載入失敗：${error.message}`)
    } else {
      setReports((data as AnomalyReport[]) || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchReports()
  }, [fetchReports])

  const applyUpvDoubleForOrder = async (report: AnomalyReport) => {
    let query = supabase
      .from('station_time_summary')
      .select('id, total_time_min')
      .ilike('station', '%印刷%')

    if (report.source_order_id) {
      query = query.eq('source_order_id', report.source_order_id)
    } else {
      query = query
        .eq('order_number', report.order_number)
        .eq('item_code', report.item_code)
        .eq('quantity', report.quantity)
    }

    const { data: printRows, error: fetchError } = await query
    if (fetchError) throw fetchError

    const rows = (printRows || []) as Array<{ id: number; total_time_min: number | null }>
    if (rows.length === 0) return

    const updateJobs = rows.map((row) => {
      const currentMinutes = Number(row.total_time_min) || 0
      return supabase
        .from('station_time_summary')
        .update({ total_time_min: Math.round(currentMinutes * 2 * 100) / 100 })
        .eq('id', row.id)
    })

    const results = await Promise.all(updateJobs)
    const failed = results.find((result) => result.error)
    if (failed?.error) throw failed.error
  }

  const handleConfirm = async (report: AnomalyReport) => {
    if (!confirm(`確認處理此筆異常回報？\n\n工單：${report.order_number}\n類型：${report.report_type === 'upv' ? '此為上V' : '其他異常'}`)) return

    setProcessingId(report.id)
    try {
      if (report.report_type === 'upv') {
        await applyUpvDoubleForOrder(report)
      }

      const { error: updateError } = await supabase
        .from('schedule_anomaly_reports')
        .update({ status: 'confirmed', processed_at: new Date().toISOString() })
        .eq('id', report.id)

      if (updateError) throw updateError

      alert(report.report_type === 'upv' ? '✅ 已確認，印刷時間已雙倍。' : '✅ 已確認並結案。')
      fetchReports()
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : '未知錯誤'
      alert(`處理失敗：${message}`)
    } finally {
      setProcessingId(null)
    }
  }

  const pendingReports = reports.filter((report) => report.status === 'pending')
  const completedReports = reports.filter((report) => report.status !== 'pending')

  const normalizeTextArray = (value: string[] | null | undefined) => Array.isArray(value) ? value : []

  const openEditModal = (report: AnomalyReport) => {
    setEditingId(report.id)
    setEditForm({
      createdDate: report.created_at ? new Date(report.created_at).toISOString().slice(0, 10) : getTodayDateInput(),
      orderNumber: report.order_number || '',
      status: report.status === 'confirmed' ? 'confirmed' : 'pending',
      reason: report.reason || '',
      reporter: report.qa_reporter || '',
      category: report.qa_category || '',
      handlers: normalizeTextArray(report.qa_handlers),
      responsible: normalizeTextArray(report.qa_responsible),
    })
  }

  const closeEditModal = () => {
    setEditingId(null)
    setEditForm(DEFAULT_CREATE_FORM)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return

    if (!editForm.orderNumber.trim()) {
      alert('請填寫相關單號')
      return
    }

    if (!editForm.reason.trim()) {
      alert('請填寫異常原因（手填）')
      return
    }

    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from('schedule_anomaly_reports')
        .update({
          created_at: editForm.createdDate ? `${editForm.createdDate}T00:00:00.000Z` : undefined,
          order_number: editForm.orderNumber.trim(),
          status: editForm.status,
          reason: editForm.reason.trim(),
          qa_reporter: editForm.reporter || null,
          qa_handlers: editForm.handlers,
          qa_category: editForm.category || null,
          qa_responsible: editForm.responsible,
        })
        .eq('id', editingId)

      if (error) throw error

      alert('✅ 已更新異常單')
      closeEditModal()
      await fetchReports()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知錯誤'
      alert(`更新失敗：${message}`)
    } finally {
      setSavingEdit(false)
    }
  }

  const reportRows = useMemo(() => [...pendingReports, ...completedReports], [pendingReports, completedReports])

  const reasonFilterOptions = useMemo(
    () => [...new Set(reports.map((report) => report.reason?.trim()).filter((value): value is string => !!value))],
    [reports],
  )

  const reporterFilterOptions = useMemo(
    () => [...new Set(reports.map((report) => report.qa_reporter?.trim()).filter((value): value is string => !!value))],
    [reports],
  )

  const handlerFilterOptions = useMemo(() => {
    const handlerSet = new Set<string>()
    reports.forEach((report) => {
      normalizeTextArray(report.qa_handlers).forEach((name) => name?.trim() && handlerSet.add(name.trim()))
    })
    return [...handlerSet]
  }, [reports])

  const responsibleFilterOptions = useMemo(() => {
    const responsibleSet = new Set<string>()
    reports.forEach((report) => {
      normalizeTextArray(report.qa_responsible).forEach((name) => name?.trim() && responsibleSet.add(name.trim()))
    })
    return [...responsibleSet]
  }, [reports])

  const categoryFilterOptions = useMemo(
    () => [...new Set(reports.map((report) => report.qa_category?.trim()).filter((value): value is string => !!value))],
    [reports],
  )

  const baseRowsWithoutStatusFilter = useMemo(() => {
    const keyword = orderKeyword.trim().toLowerCase()

    return reportRows.filter((report) => {
      const reasonMatch = !selectedReason || (report.reason || '').trim() === selectedReason
      const categoryMatch = !selectedCategory || (report.qa_category || '').trim() === selectedCategory
      const reporterMatch = !selectedReporter || (report.qa_reporter || '').trim() === selectedReporter
      const handlerMatch = !selectedHandler || normalizeTextArray(report.qa_handlers).map((name) => name.trim()).includes(selectedHandler)
      const responsibleMatch = !selectedResponsible || normalizeTextArray(report.qa_responsible).map((name) => name.trim()).includes(selectedResponsible)
      const orderMatch = !keyword || (report.order_number || '').toLowerCase().includes(keyword)

      return reasonMatch && categoryMatch && reporterMatch && handlerMatch && responsibleMatch && orderMatch
    })
  }, [
    orderKeyword,
    reportRows,
    selectedCategory,
    selectedHandler,
    selectedReason,
    selectedReporter,
    selectedResponsible,
  ])

  const statusCounts = useMemo(() => {
    return baseRowsWithoutStatusFilter.reduce(
      (acc, row) => {
        if (row.status === 'pending') acc.pending += 1
        if (row.status === 'confirmed') acc.confirmed += 1
        return acc
      },
      { pending: 0, confirmed: 0 },
    )
  }, [baseRowsWithoutStatusFilter])

  const filteredReportRows = useMemo(() => {
    return baseRowsWithoutStatusFilter.filter((report) => {
      const statusValue = (report.status || '').trim()
      const statusMatch =
        (statusFilter.pending && statusValue === 'pending') ||
        (statusFilter.confirmed && statusValue === 'confirmed')
      return statusMatch
    })
  }, [baseRowsWithoutStatusFilter, statusFilter.confirmed, statusFilter.pending])

  return (
    <div className="p-6 md:p-8 max-w-[1900px] mx-auto min-h-screen space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">異常紀錄表</h1>
          <p className="text-cyan-400 mt-1 font-mono text-sm uppercase">QA ANOMALY RECORDS</p>
        </div>
        <div className="flex gap-2">
          <Link href="/qa/report" className="px-3 py-2 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/30 text-sm">
            前往異常回報單
          </Link>
          <Link href="/qa/options" className="px-3 py-2 rounded border border-cyan-700 text-cyan-300 hover:bg-cyan-900/30 text-sm">
            編輯下拉選項
          </Link>
          <Link href="/qa" className="px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">
            返回品保專區
          </Link>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-400">篩選異常原因</label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            >
              <option value="">全部原因</option>
              {reasonFilterOptions.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400">篩選回報人</label>
            <select
              value={selectedReporter}
              onChange={(e) => setSelectedReporter(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            >
              <option value="">全部回報人</option>
              {reporterFilterOptions.map((person) => (
                <option key={person} value={person}>{person}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400">篩選處理人</label>
            <select
              value={selectedHandler}
              onChange={(e) => setSelectedHandler(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            >
              <option value="">全部處理人</option>
              {handlerFilterOptions.map((person) => (
                <option key={person} value={person}>{person}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400">篩選缺失人員</label>
            <select
              value={selectedResponsible}
              onChange={(e) => setSelectedResponsible(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            >
              <option value="">全部缺失人員</option>
              {responsibleFilterOptions.map((person) => (
                <option key={person} value={person}>{person}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400">篩選分類</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            >
              <option value="">全部分類</option>
              {categoryFilterOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400">單號搜尋</label>
            <input
              value={orderKeyword}
              onChange={(e) => setOrderKeyword(e.target.value)}
              placeholder="輸入單號關鍵字"
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-slate-400">篩選狀態</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                onClick={() => setStatusFilter((prev) => ({ ...prev, pending: !prev.pending }))}
                className={`px-3 py-2 rounded border text-sm font-bold transition-colors ${statusFilter.pending ? 'bg-amber-900/30 border-amber-600 text-amber-300' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
              >
                待處理（{statusCounts.pending}）
              </button>
              <button
                onClick={() => setStatusFilter((prev) => ({ ...prev, confirmed: !prev.confirmed }))}
                className={`px-3 py-2 rounded border text-sm font-bold transition-colors ${statusFilter.confirmed ? 'bg-emerald-900/30 border-emerald-600 text-emerald-300' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
              >
                已確認（{statusCounts.confirmed}）
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">共 {filteredReportRows.length} 筆符合篩選</span>
          <button
            onClick={() => {
              setSelectedReason('')
              setSelectedReporter('')
              setSelectedHandler('')
              setSelectedResponsible('')
              setSelectedCategory('')
              setStatusFilter({ pending: true, confirmed: true })
              setOrderKeyword('')
            }}
            className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
          >
            清除篩選
          </button>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono">
            <tr>
              <th className="p-3">日期</th>
              <th className="p-3">相關單號</th>
              <th className="p-3">狀態</th>
              <th className="p-3">異常回報人</th>
              <th className="p-3">異常處理人</th>
              <th className="p-3">異常分類</th>
              <th className="p-3">異常原因</th>
              <th className="p-3">缺失人員</th>
              <th className="p-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={9} className="p-8 text-center text-slate-500">載入中...</td></tr>
            ) : filteredReportRows.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-slate-500">無符合條件的異常紀錄</td></tr>
            ) : (
              filteredReportRows.map((report) => {
                const reporter = report.qa_reporter || ''
                const handlers = normalizeTextArray(report.qa_handlers)
                const category = report.qa_category || ''
                const responsible = normalizeTextArray(report.qa_responsible)
                const statusLabel = report.status === 'pending' ? '待處理' : report.status === 'confirmed' ? '已確認' : report.status

                return (
                  <tr key={report.id} className="hover:bg-slate-800/30 align-top">
                    <td className="p-3 font-mono text-xs whitespace-nowrap">{new Date(report.created_at).toLocaleDateString()}</td>
                    <td className="p-3 font-mono text-cyan-300 whitespace-nowrap">{report.order_number}</td>

                    <td className="p-3 min-w-[120px]">
                      <span className={`px-2 py-1 rounded border text-xs whitespace-nowrap ${report.status === 'pending' ? 'bg-amber-900/30 border-amber-700 text-amber-300' : 'bg-emerald-900/30 border-emerald-700 text-emerald-300'}`}>
                        {statusLabel || '-'}
                      </span>
                    </td>

                    <td className="p-3 min-w-[170px]">
                      <span className="text-slate-100 text-xs">{reporter || '-'}</span>
                    </td>

                    <td className="p-3 min-w-[220px]">
                      <span className="text-slate-100 text-xs">{handlers.length ? handlers.join('、') : '-'}</span>
                    </td>

                    <td className="p-3 min-w-[160px]">
                      <span className="text-slate-100 text-xs">{category || '-'}</span>
                    </td>

                    <td className="p-3 min-w-[220px] text-slate-200">{report.reason || '-'}</td>

                    <td className="p-3 min-w-[220px]">
                      <span className="text-slate-100 text-xs">{responsible.length ? responsible.join('、') : '-'}</span>
                    </td>

                    <td className="p-3 text-center min-w-[130px]">
                      <div className="flex flex-col gap-2 items-center">
                        <button
                          onClick={() => openEditModal(report)}
                          className="px-3 py-1.5 rounded border border-cyan-700 text-cyan-300 hover:bg-cyan-900/30 text-xs"
                        >
                          編輯
                        </button>
                        {report.status === 'pending' ? (
                          <button
                            onClick={() => handleConfirm(report)}
                            disabled={processingId === report.id}
                            className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold disabled:bg-slate-700 disabled:text-slate-400"
                          >
                            {processingId === report.id ? '處理中...' : '確認'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {editingId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-[900px] bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">編輯異常單</h2>
              <button onClick={closeEditModal} className="px-2 py-1 text-slate-300 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400">日期</label>
                <input
                  type="date"
                  value={editForm.createdDate}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, createdDate: e.target.value }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">相關單號</label>
                <input
                  value={editForm.orderNumber}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, orderNumber: e.target.value }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">狀態</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEditForm((prev) => ({ ...prev, status: 'pending' }))}
                    className={`px-3 py-2 rounded border text-sm font-bold transition-colors ${editForm.status === 'pending' ? 'bg-amber-900/30 border-amber-600 text-amber-300' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
                  >
                    待處理
                  </button>
                  <button
                    onClick={() => setEditForm((prev) => ({ ...prev, status: 'confirmed' }))}
                    className={`px-3 py-2 rounded border text-sm font-bold transition-colors ${editForm.status === 'confirmed' ? 'bg-emerald-900/30 border-emerald-600 text-emerald-300' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
                  >
                    已確認
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">異常回報人</label>
                <select
                  value={editForm.reporter}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, reporter: e.target.value }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">請選擇</option>
                  {options.personnel.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">異常處理人</label>
                <div className="mt-1 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {editForm.handlers.map((name) => (
                      <span key={name} className="px-2 py-0.5 rounded bg-cyan-900/40 border border-cyan-700 text-cyan-200 text-xs flex items-center gap-1">
                        {name}
                        <button onClick={() => setEditForm((prev) => ({ ...prev, handlers: prev.handlers.filter((item) => item !== name) }))}>×</button>
                      </span>
                    ))}
                  </div>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const value = e.target.value
                      if (!value) return
                      setEditForm((prev) => prev.handlers.includes(value) ? prev : { ...prev, handlers: [...prev.handlers, value] })
                      e.currentTarget.value = ''
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  >
                    <option value="">+ 新增處理人</option>
                    {options.personnel.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">異常分類</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">請選擇</option>
                  {options.categories.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400">異常原因（手填）</label>
              <textarea
                rows={3}
                value={editForm.reason}
                onChange={(e) => setEditForm((prev) => ({ ...prev, reason: e.target.value }))}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">缺失人員</label>
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {editForm.responsible.map((name) => (
                    <span key={name} className="px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700 text-amber-200 text-xs flex items-center gap-1">
                      {name}
                      <button onClick={() => setEditForm((prev) => ({ ...prev, responsible: prev.responsible.filter((item) => item !== name) }))}>×</button>
                    </span>
                  ))}
                </div>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const value = e.target.value
                    if (!value) return
                    setEditForm((prev) => prev.responsible.includes(value) ? prev : { ...prev, responsible: [...prev.responsible, value] })
                    e.currentTarget.value = ''
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">+ 新增缺失人員</option>
                  {options.personnel.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={closeEditModal} className="px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800">取消</button>
              <button
                onClick={() => void handleSaveEdit()}
                disabled={savingEdit}
                className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold disabled:bg-slate-700 disabled:text-slate-400"
              >
                {savingEdit ? '儲存中...' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
