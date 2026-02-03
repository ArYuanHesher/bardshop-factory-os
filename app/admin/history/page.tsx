'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function HistoryPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('daily_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (error) console.error(error)
    else setData(data || [])
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-[1800px] mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">發單紀錄總表</h1>
          <p className="text-slate-500 mt-1">MASTER ORDER HISTORY // 正式生產資料庫</p>
        </div>
        <button onClick={fetchHistory} className="bg-slate-200 px-4 py-2 rounded hover:bg-slate-300">
           重新整理
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">載入中...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 text-sm uppercase">
              <tr>
                <th className="p-4 border-b">日期</th>
                <th className="p-4 border-b">工單編號</th>
                <th className="p-4 border-b">品項編碼</th>
                <th className="p-4 border-b text-right">數量</th>
                <th className="p-4 border-b text-right">工時 (分)</th>
                <th className="p-4 border-b text-center">狀態</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 border-b">
                  <td className="p-4 text-slate-500">{row.order_date}</td>
                  <td className="p-4 font-mono font-medium text-blue-600">{row.order_number}</td>
                  <td className="p-4 text-slate-700">{row.item_code}</td>
                  <td className="p-4 text-right font-bold">{row.quantity}</td>
                  <td className="p-4 text-right font-mono">{row.total_time_min}</td>
                  <td className="p-4 text-center">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}