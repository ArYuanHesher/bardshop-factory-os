'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../../../lib/supabaseClient'

interface Inquiry {
  id: number
  form_date: string | null
  customer_name: string
  order_no: string | null
  product_name: string
  quantity: number | null
  expected_date: string | null
  handler_name: string | null
  planned_order_date: string | null
  remark: string | null
  status: 'pending' | 'confirmed' | 'reserved' | 'completed'
  author_name: string
  author_email: string | null
  department: string | null
  created_at: string
  updated_at: string
}

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  pending: { label: '待處理', class: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  confirmed: { label: '已確認', class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  reserved: { label: '已預留', class: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  completed: { label: '已完成', class: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
}

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'reserved' | 'completed'

export default function ScheduleConfirmPage() {
  const [records, setRecords] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending')
  const [editRecord, setEditRecord] = useState<Inquiry | null>(null)
  const [editForm, setEditForm] = useState({
    customer_name: '',
    order_no: '',
    product_name: '',
    quantity: '',
    expected_date: '',
    handler_name: '',
    planned_order_date: '',
    remark: '',
  })

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('schedule_inquiries')
      .select('*')
      .order('created_at', { ascending: false })

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus)
    }

    const { data, error } = await query
    if (error) {
      setRecords([])
      setLoading(false)
      return
    }
    setRecords((data as Inquiry[]) || [])
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const handleStatusChange = async (id: number, newStatus: string) => {
    const { error } = await supabase
      .from('schedule_inquiries')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { alert('更新失敗: ' + error.message); return }
    fetchRecords()
  }

  const openEdit = (record: Inquiry) => {
    setEditRecord(record)
    setEditForm({
      customer_name: record.customer_name,
      order_no: record.order_no || '',
      product_name: record.product_name,
      quantity: record.quantity?.toString() || '',
      expected_date: record.expected_date || '',
      handler_name: record.handler_name || '',
      planned_order_date: record.planned_order_date || '',
      remark: record.remark || '',
    })
  }

  const handleEditSubmit = async () => {
    if (!editRecord || !editForm.customer_name.trim() || !editForm.product_name.trim()) return
    const { error } = await supabase
      .from('schedule_inquiries')
      .update({
        customer_name: editForm.customer_name.trim(),
        order_no: editForm.order_no.trim() || null,
        product_name: editForm.product_name.trim(),
        quantity: editForm.quantity ? parseInt(editForm.quantity, 10) : null,
        expected_date: editForm.expected_date || null,
        handler_name: editForm.handler_name.trim() || null,
        planned_order_date: editForm.planned_order_date || null,
        remark: editForm.remark.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editRecord.id)
    if (error) { alert('更新失敗: ' + error.message); return }
    setEditRecord(null)
    fetchRecords()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除此單據？此操作無法復原。')) return
    const { error } = await supabase.from('schedule_inquiries').delete().eq('id', id)
    if (error) { alert('刪除失敗: ' + error.message); return }
    fetchRecords()
  }

  const filterButtons: { key: FilterStatus; label: string }[] = [
    { key: 'pending', label: '待處理' },
    { key: 'confirmed', label: '已確認' },
    { key: 'reserved', label: '已預留' },
    { key: 'completed', label: '已完成' },
    { key: 'all', label: '全部' },
  ]

  return (
    <div className="p-8 max-w-full mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">產期詢問確認</h1>
      <p className="text-sm text-slate-400 mb-6">審核並確認各單位提交的產期詢問/預留單</p>

      {/* 篩選列 */}
      <div className="flex gap-2 mb-6">
        {filterButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => setFilterStatus(btn.key)}
            className={`px-4 py-1.5 text-sm font-bold rounded-lg border transition-colors ${
              filterStatus === btn.key
                ? 'bg-orange-600 text-white border-orange-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* 表格 */}
      {loading ? (
        <div className="text-center text-slate-500 py-20 text-sm">載入中...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-sm">
          目前沒有{filterStatus === 'all' ? '' : STATUS_MAP[filterStatus]?.label}的詢問/預留單
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950 text-slate-200 uppercase font-mono text-xs">
              <tr>
                <th className="p-3 whitespace-nowrap">狀態</th>
                <th className="p-3 whitespace-nowrap">填單日期</th>
                <th className="p-3 whitespace-nowrap">客戶名稱</th>
                <th className="p-3 whitespace-nowrap">品名/規格</th>
                <th className="p-3 whitespace-nowrap">訂單編號</th>
                <th className="p-3 whitespace-nowrap">數量</th>
                <th className="p-3 whitespace-nowrap">承辦人</th>
                <th className="p-3 whitespace-nowrap">預計發單日</th>
                <th className="p-3 whitespace-nowrap">希望交期</th>
                <th className="p-3 whitespace-nowrap">備註</th>
                <th className="p-3 whitespace-nowrap">提交人</th>
                <th className="p-3 whitespace-nowrap">部門</th>
                <th className="p-3 whitespace-nowrap">提交時間</th>
                <th className="p-3 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => {
                const statusInfo = STATUS_MAP[record.status]
                return (
                  <tr key={record.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusInfo.class}`}>{statusInfo.label}</span>
                    </td>
                    <td className="p-3 whitespace-nowrap text-slate-300">{record.form_date ?? '-'}</td>
                    <td className="p-3 whitespace-nowrap text-white font-medium">{record.customer_name}</td>
                    <td className="p-3 whitespace-nowrap text-white">{record.product_name}</td>
                    <td className="p-3 whitespace-nowrap">{record.order_no ?? '-'}</td>
                    <td className="p-3 whitespace-nowrap">{record.quantity ?? '-'}</td>
                    <td className="p-3 whitespace-nowrap">{record.handler_name ?? '-'}</td>
                    <td className="p-3 whitespace-nowrap">{record.planned_order_date ?? '-'}</td>
                    <td className="p-3 whitespace-nowrap">{record.expected_date ?? '-'}</td>
                    <td className="p-3 max-w-[200px] truncate" title={record.remark ?? ''}>{record.remark ?? '-'}</td>
                    <td className="p-3 whitespace-nowrap">{record.author_name}</td>
                    <td className="p-3 whitespace-nowrap">{record.department ?? '-'}</td>
                    <td className="p-3 whitespace-nowrap text-xs text-slate-500 font-mono">
                      {new Date(record.created_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {record.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(record.id, 'confirmed')}
                            className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            確認
                          </button>
                        )}
                        {(record.status === 'confirmed' || record.status === 'reserved' || record.status === 'completed') && (
                          <button
                            onClick={() => handleStatusChange(record.id, 'pending')}
                            className="px-2.5 py-1 text-xs font-bold rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                          >
                            退回待處理
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(record)}
                          className="px-2.5 py-1 text-xs font-bold rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="px-2.5 py-1 text-xs font-bold rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 編輯 Modal */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl my-4">
            <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700 rounded-t-2xl">
              <h3 className="text-white font-bold flex items-center gap-2">
                <span className="w-2 h-6 bg-sky-500 rounded-full"></span>
                編輯單據
              </h3>
              <button onClick={() => setEditRecord(null)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">客戶名稱 *</label>
                  <input
                    value={editForm.customer_name}
                    onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none transition-colors"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">訂單編號</label>
                  <input
                    value={editForm.order_no}
                    onChange={e => setEditForm(f => ({ ...f, order_no: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none transition-colors"
                    maxLength={50}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">品名/規格 *</label>
                  <input
                    value={editForm.product_name}
                    onChange={e => setEditForm(f => ({ ...f, product_name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none transition-colors"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">數量</label>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none transition-colors"
                    min={1}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">承辦人</label>
                  <input
                    value={editForm.handler_name}
                    onChange={e => setEditForm(f => ({ ...f, handler_name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none transition-colors"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">預計發單日</label>
                  <input
                    type="date"
                    value={editForm.planned_order_date}
                    onChange={e => setEditForm(f => ({ ...f, planned_order_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">希望交期(寄出日期)</label>
                <input
                  type="date"
                  value={editForm.expected_date}
                  onChange={e => setEditForm(f => ({ ...f, expected_date: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">備註</label>
                <textarea
                  value={editForm.remark}
                  onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none transition-colors resize-none"
                  maxLength={1000}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditRecord(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">取消</button>
                <button
                  onClick={handleEditSubmit}
                  disabled={!editForm.customer_name.trim() || !editForm.product_name.trim()}
                  className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
