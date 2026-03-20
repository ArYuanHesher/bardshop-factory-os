'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../../lib/supabaseClient'

interface AnomalyReport {
  id: number
  report_type: 'qa' | 'upv' | 'other' | string
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
  qa_department: string | null
  qa_reporter: string | null
  qa_handlers: string[] | null
  qa_category: string | null
  qa_responsible: string[] | null
  handler_department: string | null
  handler_record: string | null
}

interface PersonnelOption {
  option_value: string
  department_value: string
}

interface OptionState {
  personnel: PersonnelOption[]
  categories: string[]
  departments: string[]
}

interface CreateFormState {
  createdDate: string
  orderNumber: string
  status: 'pending' | 'confirmed'
  reason: string
  department: string
  reporter: string
  category: string
  handlerDepartment: string
  handlers: string[]
  handling: string
  responsibleDepartment: string
  responsible: string[]
}

type OptionType = 'personnel' | 'category' | 'department'

interface OptionItem {
  id: number
  option_type: OptionType
  option_value: string
  department_value?: string
}

const DEFAULT_OPTIONS: OptionState = {
  personnel: [
    { option_value: '王小明', department_value: '' },
    { option_value: '李小華', department_value: '' },
    { option_value: '陳建宏', department_value: '' },
  ],
  categories: ['品質異常', '製程異常', '資料異常'],
  departments: ['品保部', '生產部', '工程部'],
}

const getTodayDateInput = () => new Date().toISOString().slice(0, 10)

const DEFAULT_CREATE_FORM: CreateFormState = {
  createdDate: getTodayDateInput(),
  orderNumber: '',
  status: 'pending',
  reason: '',
  department: '',
  reporter: '',
  category: '',
  handlerDepartment: '',
  handlers: [],
  handling: '',
  responsibleDepartment: '',
  responsible: [],
}

const RECORDS_LOCK_PASSWORD = '680401'

export default function QaRecordsPage() {
  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('qaRecordsUnlocked') !== 'true';
    }
    return true;
  })
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [reports, setReports] = useState<AnomalyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE_FORM)
  const [savingCreate, setSavingCreate] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CreateFormState>(DEFAULT_CREATE_FORM)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [options, setOptions] = useState<OptionState>(DEFAULT_OPTIONS)
  const [selectedReason, setSelectedReason] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedReporter, setSelectedReporter] = useState('')
  const [selectedHandler, setSelectedHandler] = useState('')
  const [selectedResponsible, setSelectedResponsible] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState({ pending: true, confirmed: true })
  const [orderKeyword, setOrderKeyword] = useState('')

  const fetchOptions = useCallback(async () => {
    const { data, error } = await supabase
      .from('qa_anomaly_option_items')
      .select('id, option_type, option_value, department_value')
      .order('option_type', { ascending: true })
      .order('option_value', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    const rows = (data as OptionItem[]) || []
    const personnelRows: PersonnelOption[] = rows
      .filter((row) => row.option_type === 'personnel')
      .map((row) => ({ option_value: row.option_value, department_value: row.department_value || '' }))
    const categoriesRows = rows.filter((row) => row.option_type === 'category').map((row) => row.option_value)
    const departmentsRows = rows.filter((row) => row.option_type === 'department').map((row) => row.option_value)

    setOptions({
      personnel: personnelRows.length ? personnelRows : DEFAULT_OPTIONS.personnel,
      categories: categoriesRows.length ? categoriesRows : DEFAULT_OPTIONS.categories,
      departments: departmentsRows.length ? departmentsRows : DEFAULT_OPTIONS.departments,
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
      .eq('report_type', 'qa')
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
      department: report.qa_department || '',
      reporter: report.qa_reporter || '',
      category: report.qa_category || '',
      handlerDepartment: report.handler_department || '',
      handlers: normalizeTextArray(report.qa_handlers),
      handling: report.handler_record || '',
      responsibleDepartment: '',
      responsible: normalizeTextArray(report.qa_responsible),
    })
  }

  const closeEditModal = () => {
    setEditingId(null)
    setEditForm(DEFAULT_CREATE_FORM)
  }

  const openCreateModal = () => {
    setCreateForm({ ...DEFAULT_CREATE_FORM, createdDate: getTodayDateInput() })
    setCreating(true)
  }

  const closeCreateModal = () => {
    setCreating(false)
    setCreateForm(DEFAULT_CREATE_FORM)
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

  const handleCreate = async () => {
    if (!createForm.orderNumber.trim()) {
      alert('請填寫相關單號')
      return
    }

    if (!createForm.reason.trim()) {
      alert('請填寫異常原因（手填）')
      return
    }

    setSavingCreate(true)
    try {
      const payload = {
        report_type: 'qa',
        reason: createForm.reason.trim(),
        status: createForm.status,
        source_order_id: null,
        task_id: null,
        order_number: createForm.orderNumber.trim(),
        item_code: '',
        quantity: 0,
        op_name: null,
        station: null,
        section_id: null,
        created_at: createForm.createdDate ? `${createForm.createdDate}T00:00:00.000Z` : new Date().toISOString(),
        qa_department: createForm.department || null,
        qa_reporter: createForm.reporter || null,
        qa_handlers: createForm.handlers,
        qa_category: createForm.category || null,
        qa_responsible: createForm.responsible,
        handler_department: createForm.handlerDepartment || null,
        handler_record: createForm.handling.trim() || null,
      }

      const { error } = await supabase.from('schedule_anomaly_reports').insert(payload)
      if (error) throw error

      alert('✅ 已新增異常單')
      closeCreateModal()
      await fetchReports()
    } catch (err: unknown) {
      alert(`新增失敗：${getReadableErrorMessage(err)}`)
    } finally {
      setSavingCreate(false)
    }
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
          qa_department: editForm.department || null,
          qa_reporter: editForm.reporter || null,
          qa_handlers: editForm.handlers,
          qa_category: editForm.category || null,
          qa_responsible: editForm.responsible,
          handler_department: editForm.handlerDepartment || null,
          handler_record: editForm.handling.trim() || null,
        })
        .eq('id', editingId)

      if (error) throw error

      alert('✅ 已更新異常單')
      closeEditModal()
      await fetchReports()
    } catch (err: unknown) {
      const message = getReadableErrorMessage(err)
      alert(`更新失敗：${message}`)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (report: AnomalyReport) => {
    if (!confirm(`確定刪除異常單 #${report.id}（單號：${report.order_number}）嗎？`)) return

    setDeletingId(report.id)
    try {
      const { error } = await supabase
        .from('schedule_anomaly_reports')
        .delete()
        .eq('id', report.id)

      if (error) throw error

      alert('🗑️ 已刪除異常單')
      await fetchReports()
    } catch (err: unknown) {
      alert(`刪除失敗：${getReadableErrorMessage(err)}`)
    } finally {
      setDeletingId(null)
    }
  }

  const reportRows = useMemo(() => [...pendingReports, ...completedReports], [pendingReports, completedReports])

  const reasonFilterOptions = useMemo(
    () => [...new Set(reports.map((report) => report.reason?.trim()).filter((value): value is string => !!value))],
    [reports],
  )


  const handleUnlock = () => {
    if (unlockPasswordInput === RECORDS_LOCK_PASSWORD) {
      setIsLocked(false)
      setUnlockError('')
      setUnlockPasswordInput('')
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('qaRecordsUnlocked', 'true');
      }
      return
    }
    setUnlockError('密碼錯誤，請重新輸入')
  }
  // 若使用者手動登出或想重新鎖定，可加一個「上鎖」按鈕（選用）
  // const handleLock = () => {
  //   setIsLocked(true)
  //   if (typeof window !== 'undefined') {
  //     sessionStorage.removeItem('qaRecordsUnlocked');
  //   }
  // }

  const reporterFilterOptions = useMemo(
    () => [...new Set(reports.map((report) => report.qa_reporter?.trim()).filter((value): value is string => !!value))],
    [reports],
  )

  const departmentFilterOptions = useMemo(
    () => [...new Set(reports.map((report) => report.qa_department?.trim()).filter((value): value is string => !!value))],
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
      const departmentMatch = !selectedDepartment || (report.qa_department || '').trim() === selectedDepartment
      const reporterMatch = !selectedReporter || (report.qa_reporter || '').trim() === selectedReporter
      const handlerMatch = !selectedHandler || normalizeTextArray(report.qa_handlers).map((name) => name.trim()).includes(selectedHandler)
      const responsibleMatch = !selectedResponsible || normalizeTextArray(report.qa_responsible).map((name) => name.trim()).includes(selectedResponsible)
      const orderMatch = !keyword || (report.order_number || '').toLowerCase().includes(keyword)

      return reasonMatch && categoryMatch && departmentMatch && reporterMatch && handlerMatch && responsibleMatch && orderMatch
    })
  }, [
    orderKeyword,
    reportRows,
    selectedCategory,
    selectedDepartment,
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
    <div className="relative p-6 md:p-8 max-w-[1900px] mx-auto min-h-screen space-y-8">
      {isLocked && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">異常紀錄表已上鎖</h2>
            <p className="text-sm text-slate-400">請輸入密碼以繼續。</p>
            <input
              type="password"
              value={unlockPasswordInput}
              onChange={(e) => {
                setUnlockPasswordInput(e.target.value)
                if (unlockError) setUnlockError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlock()
              }}
              placeholder="請輸入密碼"
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
            {unlockError && <p className="text-sm text-rose-400">{unlockError}</p>}
            <div className="flex justify-end">
              <button
                onClick={handleUnlock}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                解鎖
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">異常紀錄表</h1>
          <p className="text-cyan-400 mt-1 font-mono text-sm uppercase">QA ANOMALY RECORDS</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openCreateModal}
            className="px-3 py-2 rounded border border-emerald-600 text-emerald-300 hover:bg-emerald-900/30 text-sm"
          >
            新增異常單
          </button>
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
            <label className="text-xs text-slate-400">篩選部門</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            >
              <option value="">全部部門</option>
              {departmentFilterOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
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
              setSelectedDepartment('')
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
              <th className="p-3">異常回報</th>
              <th className="p-3">異常處理</th>
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
                const department = report.qa_department || ''
                const reporter = report.qa_reporter || ''
                const handlerDept = report.handler_department || ''
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
                      <div className="text-xs space-y-0.5">
                        <div className="text-slate-400">{department || '-'}</div>
                        <div className="text-slate-100">{reporter || '-'}</div>
                      </div>
                    </td>

                    <td className="p-3 min-w-[170px]">
                      <div className="text-xs space-y-0.5">
                        <div className="text-slate-400">{handlerDept || '-'}</div>
                        <div className="text-slate-100">{handlers.length ? handlers.join('、') : '-'}</div>
                      </div>
                    </td>

                    <td className="p-3 min-w-[160px]">
                      <span className="text-slate-100 text-xs">{category || '-'}</span>
                    </td>

                    <td className="p-3 min-w-[220px] text-slate-200">{report.reason || '-'}</td>

                    <td className="p-3 min-w-[220px]">
                      <span className="text-slate-100 text-xs">{responsible.length ? responsible.join('、') : '-'}</span>
                    </td>

                    <td className="p-3 text-center min-w-[130px]">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(report)}
                          className="px-3 py-1.5 rounded border border-cyan-700 text-cyan-300 hover:bg-cyan-900/30 text-xs"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => void handleDelete(report)}
                          disabled={deletingId === report.id}
                          className="px-3 py-1.5 rounded border border-rose-700 text-rose-300 hover:bg-rose-900/30 text-xs disabled:opacity-60"
                        >
                          {deletingId === report.id ? '刪除中...' : '刪除'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-[900px] bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">新增異常單</h2>
              <button onClick={closeCreateModal} className="px-2 py-1 text-slate-300 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400">日期</label>
                <input
                  type="date"
                  value={createForm.createdDate}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, createdDate: e.target.value }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">相關單號</label>
                <input
                  value={createForm.orderNumber}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, orderNumber: e.target.value }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">狀態</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCreateForm((prev) => ({ ...prev, status: 'pending' }))}
                    className={`px-3 py-2 rounded border text-sm font-bold transition-colors ${createForm.status === 'pending' ? 'bg-amber-900/30 border-amber-600 text-amber-300' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
                  >
                    待處理
                  </button>
                  <button
                    onClick={() => setCreateForm((prev) => ({ ...prev, status: 'confirmed' }))}
                    className={`px-3 py-2 rounded border text-sm font-bold transition-colors ${createForm.status === 'confirmed' ? 'bg-emerald-900/30 border-emerald-600 text-emerald-300' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
                  >
                    已確認
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">異常回報-部門</label>
                <select
                  value={createForm.department}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, department: e.target.value, reporter: '' }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">請選擇</option>
                  {options.departments.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">異常回報-人員</label>
                {createForm.department ? (
                  <select
                    value={createForm.reporter}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, reporter: e.target.value }))}
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  >
                    <option value="">請選擇</option>
                    {options.personnel.filter((p) => p.department_value === createForm.department).map((p) => (
                      <option key={p.option_value} value={p.option_value}>{p.option_value}</option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-500 text-sm">請先選部門</div>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-400">異常處理-部門</label>
                <select
                  value={createForm.handlerDepartment}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, handlerDepartment: e.target.value, handlers: [] }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">請選擇</option>
                  {options.departments.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">異常處理-人員</label>
                {createForm.handlerDepartment ? (
                  <select
                    value={createForm.handlers[0] || ''}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, handlers: e.target.value ? [e.target.value] : [] }))}
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  >
                    <option value="">請選擇</option>
                    {options.personnel.filter((p) => p.department_value === createForm.handlerDepartment).map((p) => (
                      <option key={p.option_value} value={p.option_value}>{p.option_value}</option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-500 text-sm">請先選部門</div>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-400">異常分類</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))}
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
                value={createForm.reason}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, reason: e.target.value }))}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">異常處理（手填）</label>
              <textarea
                rows={3}
                value={createForm.handling}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, handling: e.target.value }))}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label className="text-xs text-slate-400">缺失-部門</label>
                <select
                  value={createForm.responsibleDepartment}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, responsibleDepartment: e.target.value }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">請選擇</option>
                  {options.departments.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">缺失-人員</label>
                {createForm.responsibleDepartment ? (
                  <div className="mt-1 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {createForm.responsible.map((name) => (
                        <span key={name} className="px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700 text-amber-200 text-xs flex items-center gap-1">
                          {name}
                          <button onClick={() => setCreateForm((prev) => ({ ...prev, responsible: prev.responsible.filter((item) => item !== name) }))}>×</button>
                        </span>
                      ))}
                    </div>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const value = e.target.value
                        if (!value) return
                        setCreateForm((prev) => prev.responsible.includes(value) ? prev : { ...prev, responsible: [...prev.responsible, value] })
                        e.currentTarget.value = ''
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                    >
                      <option value="">+ 新增缺失人員</option>
                      {options.personnel.filter((p) => p.department_value === createForm.responsibleDepartment).map((p) => (
                        <option key={p.option_value} value={p.option_value}>{p.option_value}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-500 text-sm">請先選部門</div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={closeCreateModal} className="px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800">取消</button>
              <button
                onClick={() => void handleCreate()}
                disabled={savingCreate}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:bg-slate-700 disabled:text-slate-400"
              >
                {savingCreate ? '新增中...' : '新增異常單'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-[900px] bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">編輯異常單</h2>
              <button onClick={closeEditModal} className="px-2 py-1 text-slate-300 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    className={`px-3 py-1.5 rounded border text-sm font-bold transition-colors ${editForm.status === 'pending' ? 'bg-amber-900/30 border-amber-600 text-amber-300' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
                  >
                    待處理
                  </button>
                  <button
                    onClick={() => setEditForm((prev) => ({ ...prev, status: 'confirmed' }))}
                    className={`px-3 py-1.5 rounded border text-sm font-bold transition-colors ${editForm.status === 'confirmed' ? 'bg-emerald-900/30 border-emerald-600 text-emerald-300' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
                  >
                    已確認
                  </button>
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

              <div>
                <label className="text-xs text-slate-400">異常回報-部門</label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value, reporter: '' }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">請選擇</option>
                  {options.departments.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">異常回報-人員</label>
                {editForm.department ? (
                  <select
                    value={editForm.reporter}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, reporter: e.target.value }))}
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  >
                    <option value="">請選擇</option>
                    {options.personnel.filter((p) => p.department_value === editForm.department).map((p) => (
                      <option key={p.option_value} value={p.option_value}>{p.option_value}</option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-500 text-sm">請先選部門</div>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-400">異常處理-部門</label>
                <select
                  value={editForm.handlerDepartment}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, handlerDepartment: e.target.value, handlers: [] }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">請選擇</option>
                  {options.departments.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">異常處理-人員</label>
                {editForm.handlerDepartment ? (
                  <select
                    value={editForm.handlers[0] || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, handlers: e.target.value ? [e.target.value] : [] }))}
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  >
                    <option value="">請選擇</option>
                    {options.personnel.filter((p) => p.department_value === editForm.handlerDepartment).map((p) => (
                      <option key={p.option_value} value={p.option_value}>{p.option_value}</option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-500 text-sm">請先選部門</div>
                )}
              </div>

            </div>

            <div>
              <label className="text-xs text-slate-400">異常原因（手填）</label>
              <textarea
                rows={2}
                value={editForm.reason}
                onChange={(e) => setEditForm((prev) => ({ ...prev, reason: e.target.value }))}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">異常處理（手填）</label>
              <textarea
                rows={2}
                value={editForm.handling}
                onChange={(e) => setEditForm((prev) => ({ ...prev, handling: e.target.value }))}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              <div>
                <label className="text-xs text-slate-400">缺失-部門</label>
                <select
                  value={editForm.responsibleDepartment}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, responsibleDepartment: e.target.value }))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                >
                  <option value="">請選擇</option>
                  {options.departments.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">缺失-人員</label>
                {editForm.responsibleDepartment ? (
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
                      {options.personnel.filter((p) => p.department_value === editForm.responsibleDepartment).map((p) => (
                        <option key={p.option_value} value={p.option_value}>{p.option_value}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-500 text-sm">請先選部門</div>
                )}
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
