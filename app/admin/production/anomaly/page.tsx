'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabaseClient'

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
}

export default function ScheduleAnomalyPage() {
  const [reports, setReports] = useState<AnomalyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)

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

  return (
    <div className="p-6 md:p-8 max-w-[1800px] mx-auto min-h-screen space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">排程異常回報</h1>
        <p className="text-red-400 mt-1 font-mono text-sm uppercase">SCHEDULE ANOMALY REPORTS // 現場回報與後台確認</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white">待處理 ({pendingReports.length})</h2>
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono">
              <tr>
                <th className="p-3">建立時間</th>
                <th className="p-3">工單</th>
                <th className="p-3">品號</th>
                <th className="p-3">類型</th>
                <th className="p-3">異常原因</th>
                <th className="p-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">載入中...</td></tr>
              ) : pendingReports.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">目前無待處理回報</td></tr>
              ) : (
                pendingReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-xs">{new Date(report.created_at).toLocaleString()}</td>
                    <td className="p-3 font-mono text-cyan-300">{report.order_number}</td>
                    <td className="p-3 font-mono text-purple-300">{report.item_code}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${report.report_type === 'upv' ? 'bg-red-900/30 text-red-300 border-red-700' : 'bg-orange-900/20 text-orange-300 border-orange-700'}`}>
                        {report.report_type === 'upv' ? '此為上V' : '其他異常'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{report.reason || '-'}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleConfirm(report)}
                        disabled={processingId === report.id}
                        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold disabled:bg-slate-700 disabled:text-slate-400"
                      >
                        {processingId === report.id ? '處理中...' : '確認'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white">已處理 ({completedReports.length})</h2>
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono">
              <tr>
                <th className="p-3">建立時間</th>
                <th className="p-3">工單</th>
                <th className="p-3">類型</th>
                <th className="p-3">異常原因</th>
                <th className="p-3">處理時間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {completedReports.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">目前無已處理資料</td></tr>
              ) : (
                completedReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono text-xs">{new Date(report.created_at).toLocaleString()}</td>
                    <td className="p-3 font-mono text-cyan-300">{report.order_number}</td>
                    <td className="p-3">{report.report_type === 'upv' ? '此為上V' : '其他異常'}</td>
                    <td className="p-3">{report.reason || '-'}</td>
                    <td className="p-3 font-mono text-xs">{report.processed_at ? new Date(report.processed_at).toLocaleString() : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
