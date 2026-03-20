 'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

interface QaReport {
  id: number;
  created_at: string;
  order_number: string;
  qa_category: string | null;
  qa_department: string | null;
  qa_reporter: string | null;
  handler_department: string | null;
  qa_handlers: string[] | string | null;
  reason: string;
  handler_record: string | null;
}

export default function QaHandlePage() {
  const [pendingReports, setPendingReports] = useState<QaReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [handlerRecord, setHandlerRecord] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPending = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('schedule_anomaly_reports')
        .select('*')
        .eq('report_type', 'qa')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingReports((data as QaReport[]) || []);
      setLoading(false);
    };
    fetchPending();
  }, []);

  const handleEdit = (report: QaReport) => {
    setEditId(report.id);
    setHandlerRecord(report.handler_record || '');
  };

  const handleSave = async () => {
    if (!handlerRecord.trim()) {
      alert('請填寫異常處理');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('schedule_anomaly_reports')
        .update({ handler_record: handlerRecord, status: 'confirmed' })
        .eq('id', editId);
      if (error) throw error;
      alert('✅ 已完成異常處理');
      setEditId(null);
      setHandlerRecord('');
      // 重新載入
      const { data } = await supabase
        .from('schedule_anomaly_reports')
        .select('*')
        .eq('report_type', 'qa')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingReports((data as QaReport[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('儲存失敗：' + message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex justify-end mb-4">
        <Link href="/" className="px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">回到首頁</Link>
      </div>
      <h1 className="text-2xl font-bold text-white mb-4">異常單處理</h1>
      {loading ? (
        <div className="text-slate-400">載入中...</div>
      ) : pendingReports.length === 0 ? (
        <div className="text-slate-400">目前沒有待處理的異常單</div>
      ) : (
        <table className="w-full text-left text-sm text-slate-300 mb-6">
          <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono">
            <tr>
              <th className="p-3">日期</th>
              <th className="p-3">相關單號</th>
              <th className="p-3">異常分類</th>
              <th className="p-3">異常回報</th>
              <th className="p-3">異常處理</th>
              <th className="p-3">異常原因</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {pendingReports.map((report) => (
              <tr key={report.id}>
                <td className="p-3">{new Date(report.created_at).toLocaleDateString()}</td>
                <td className="p-3">{report.order_number}</td>
                <td className="p-3">{report.qa_category || '-'}</td>
                <td className="p-3">
                  <div>{report.qa_department || '-'}</div>
                  <div className="text-xs text-cyan-300">{report.qa_reporter || '-'}</div>
                </td>
                <td className="p-3">
                  <div>{report.handler_department || '-'}</div>
                  <div className="text-xs text-cyan-300">{Array.isArray(report.qa_handlers) ? report.qa_handlers.join(', ') : (report.qa_handlers || '-')}</div>
                </td>
                <td className="p-3">{report.reason}</td>
                <td className="p-3">
                  <button
                    className="px-3 py-1 rounded border border-cyan-700 text-cyan-300 hover:bg-cyan-900/30 text-xs"
                    onClick={() => handleEdit(report)}
                  >
                    填寫處理
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editId && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">填寫異常處理</h2>
          <textarea
            rows={4}
            value={handlerRecord}
            onChange={(e) => setHandlerRecord(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            placeholder="請填寫異常處理內容..."
          />
          <div className="flex gap-2 justify-end">
            <button
              className="px-4 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => { setEditId(null); setHandlerRecord(''); }}
            >取消</button>
            <button
              className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold disabled:bg-slate-700 disabled:text-slate-400"
              onClick={handleSave}
              disabled={saving}
            >{saving ? '儲存中...' : '儲存處理'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
