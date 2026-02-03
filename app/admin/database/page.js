'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient' // 確保路徑正確

export default function DatabaseViewer() {
  const [activeTab, setActiveTab] = useState('ops') // ops | routes | items
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [lastUpdated, setLastUpdated] = useState('讀取中...')

  // 當切換分頁時，重新抓資料
  useEffect(() => {
    fetchData(activeTab)
  }, [activeTab])

  const fetchData = async (tab) => {
    setLoading(true)
    setData([])
    setSearchTerm('') // 切換時清空搜尋
    
    try {
      let query
      
      // 根據分頁決定要抓哪張表
      if (tab === 'ops') {
        // 1. 工序時間表
        query = supabase.from('operation_times').select('*').order('op_name', { ascending: true })
      } else if (tab === 'routes') {
        // 2. 途程表 (這張表比較大，我們限制抓前 2000 筆，避免卡頓)
        query = supabase.from('route_operations').select('*').order('route_id, sequence')
      } else if (tab === 'items') {
        // 3. 品項關聯表
        query = supabase.from('item_routes').select('*').order('item_code', { ascending: true })
      }

      const { data: result, error } = await query
      
      if (error) throw error

      setData(result || [])

      // 計算最後更新時間 (找 created_at 最大的那一筆)
      if (result && result.length > 0) {
        // 假設 Supabase 有自動生成 created_at 欄位
        // 如果你的表沒有 created_at，這段可能會顯示無效日期，但不影響功能
        const timestamps = result.map(r => new Date(r.created_at || 0).getTime())
        const latest = Math.max(...timestamps)
        if (latest > 0) {
          setLastUpdated(new Date(latest).toLocaleString())
        } else {
          setLastUpdated('未知 (無時間戳記)')
        }
      } else {
        setLastUpdated('無資料')
      }

    } catch (err) {
      console.error('讀取失敗:', err)
      alert('讀取資料失敗: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // 前端搜尋過濾邏輯
  const filteredData = data.filter(row => {
    if (!searchTerm) return true
    const lowerTerm = searchTerm.toLowerCase()
    // 搜尋所有欄位的值
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(lowerTerm)
    )
  })

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">資料庫監控中心</h1>
          <p className="text-sm text-gray-500 mt-1">
            目前檢視版本時間：<span className="font-mono text-blue-600 font-bold">{lastUpdated}</span>
          </p>
        </div>
        <div className="text-right">
            <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs">
                總筆數: {filteredData.length}
            </span>
        </div>
      </div>

      {/* 分頁標籤 (Tabs) */}
      <div className="flex border-b border-gray-300 mb-6">
        <button
          onClick={() => setActiveTab('ops')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'ops' 
              ? 'border-b-4 border-blue-600 text-blue-600 bg-white' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          工序時間表 (Operation Times)
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'routes' 
              ? 'border-b-4 border-purple-600 text-purple-600 bg-white' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          途程表 (Routes)
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'items' 
              ? 'border-b-4 border-green-600 text-green-600 bg-white' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          品項關聯表 (Items)
        </button>
      </div>

      {/* 搜尋框 */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
        <input
          type="text"
          placeholder="輸入關鍵字搜尋 (例如: 途程代碼、工序名稱...)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      {/* 表格顯示區 */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            資料讀取中...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {searchTerm ? '找不到符合搜尋條件的資料' : '此表格目前沒有資料'}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px]">
            <table className="min-w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10">
                {/* 根據不同分頁顯示不同標題 */}
                {activeTab === 'ops' && (
                  <tr>
                    <th className="px-6 py-3 border-b">工序名稱 (Op Name)</th>
                    <th className="px-6 py-3 border-b">站點 (Station)</th>
                    <th className="px-6 py-3 border-b text-right">標準工時 (Min)</th>
                    <th className="px-6 py-3 border-b text-right text-gray-400">上傳時間</th>
                  </tr>
                )}
                {activeTab === 'routes' && (
                  <tr>
                    <th className="px-6 py-3 border-b">途程代碼 (Route ID)</th>
                    <th className="px-6 py-3 border-b text-center">順序 (Seq)</th>
                    <th className="px-6 py-3 border-b">工序名稱 (Op Name)</th>
                    <th className="px-6 py-3 border-b text-right text-gray-400">建立時間</th>
                  </tr>
                )}
                {activeTab === 'items' && (
                  <tr>
                    <th className="px-6 py-3 border-b">品項編碼 (Item Code)</th>
                    <th className="px-6 py-3 border-b">品項名稱 (Item Name)</th>
                    <th className="px-6 py-3 border-b">對應途程 (Route ID)</th>
                    <th className="px-6 py-3 border-b text-right text-gray-400">建立時間</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                    
                    {/* 內容區：工序表 */}
                    {activeTab === 'ops' && (
                      <>
                        <td className="px-6 py-3 font-medium text-gray-900">{row.op_name}</td>
                        <td className="px-6 py-3">{row.station || '-'}</td>
                        <td className="px-6 py-3 text-right font-mono text-blue-600">{row.std_time_min}</td>
                        <td className="px-6 py-3 text-right text-xs text-gray-400">
                            {new Date(row.created_at).toLocaleDateString()}
                        </td>
                      </>
                    )}

                    {/* 內容區：途程表 */}
                    {activeTab === 'routes' && (
                      <>
                        <td className="px-6 py-3 font-bold text-purple-700">{row.route_id}</td>
                        <td className="px-6 py-3 text-center">
                            <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                {row.sequence}
                            </span>
                        </td>
                        <td className="px-6 py-3">{row.op_name}</td>
                        <td className="px-6 py-3 text-right text-xs text-gray-400">
                            {new Date(row.created_at).toLocaleDateString()}
                        </td>
                      </>
                    )}

                    {/* 內容區：品項表 */}
                    {activeTab === 'items' && (
                      <>
                        <td className="px-6 py-3 font-medium text-gray-900">{row.item_code}</td>
                        <td className="px-6 py-3">{row.item_name || '-'}</td>
                        <td className="px-6 py-3 font-mono text-green-600">{row.route_id}</td>
                        <td className="px-6 py-3 text-right text-xs text-gray-400">
                            {new Date(row.created_at).toLocaleDateString()}
                        </td>
                      </>
                    )}

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}