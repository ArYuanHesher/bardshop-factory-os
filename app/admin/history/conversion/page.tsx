'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'

// --- 介面定義 ---

interface SourceOrder {
  id: number
  order_number: string
  doc_type: string
  item_code: string
  item_name: string
  quantity: number
  plate_count: string
  delivery_date: string
  designer: string
  customer: string
  handler: string
  issuer: string
  status: string
}

interface ConvertedRow {
  unique_id: string       
  source_order_id: number 
  order_number: string
  doc_type: string      // 🔥 新增：寫入單據種類
  item_code: string
  item_name: string
  quantity: number
  plate_count: string
  delivery_date: string // 🔥 新增：寫入交付日
  designer: string      // 🔥 新增：寫入美編
  customer: string      // 🔥 新增：寫入客戶
  handler: string       // 🔥 新增：寫入承辦
  issuer: string        // 🔥 新增：寫入開單
  sequence: number
  station: string
  op_name: string
  basis_text: string
  std_time: number
  total_time_min: number
}

interface FailedRow {
  id: number
  order_number: string
  item_code: string
  item_name: string
  reason: string
}

interface MasterData {
  itemRoutes: Map<string, string>
  routeOps: Map<string, { sequence: number, op_name: string }[]>
  opTimes: Map<string, { station: string, std_time: number }>
  ready: boolean
}

export default function ConversionPage() {
  const [orders, setOrders] = useState<SourceOrder[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  
  const [results, setResults] = useState<ConvertedRow[]>([])
  const [failedRows, setFailedRows] = useState<FailedRow[]>([])

  const [masterData, setMasterData] = useState<MasterData>({ itemRoutes: new Map(), routeOps: new Map(), opTimes: new Map(), ready: false })
  
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [movingFailed, setMovingFailed] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    initData()
  }, [])

  const initData = async () => {
    setLoading(true)
    await Promise.all([fetchOrders(), fetchMasterData()])
    setLoading(false)
  }

  // 1. 讀取待處理工單
  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('daily_orders')
      .select('id, order_number, doc_type, item_code, item_name, quantity, plate_count, delivery_date, designer, customer, handler, issuer, status')
      .is('is_converted', false) 
      .neq('conversion_status', 'failed') 
      .neq('status', 'Error')
      .order('created_at', { ascending: false })
      .limit(500) 
    
    if (error) console.error('Fetch Orders Error:', error)
    else setOrders(data || [])
  }

  // 分頁讀取函式
  const fetchAllData = async (table: string, selectColumns: string) => {
    let allData: any[] = []
    let from = 0
    const size = 1000
    
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(selectColumns)
        .range(from, from + size - 1)
      
      if (error) throw error
      if (!data || data.length === 0) break 
      
      allData.push(...data)
      
      if (data.length < size) break 
      from += size 
    }
    return allData
  }

  // 2. 讀取母資料
  const fetchMasterData = async () => {
    try {
      const ir = await fetchAllData('item_routes', 'item_code, route_id')
      const irMap = new Map<string, string>()
      ir.forEach((i: any) => {
        const cleanCode = (i.item_code || '').trim().toUpperCase()
        const cleanRoute = (i.route_id || '').trim()
        if (cleanCode && cleanRoute) irMap.set(cleanCode, cleanRoute)
      })

      const ro = await fetchAllData('route_operations', 'route_id, sequence, op_name')
      ro.sort((a: any, b: any) => a.sequence - b.sequence)
      const roMap = new Map<string, any[]>()
      ro.forEach((r: any) => {
        const cleanRouteId = (r.route_id || '').trim()
        if (cleanRouteId && r.op_name) {
          if (!roMap.has(cleanRouteId)) roMap.set(cleanRouteId, [])
          roMap.get(cleanRouteId)?.push(r)
        }
      })

      const ot = await fetchAllData('operation_times', 'op_name, station, std_time_min')
      const otMap = new Map(ot.map((o: any) => [
        (o.op_name || '').trim(), 
        { station: (o.station || '').trim(), std_time: o.std_time_min }
      ]))

      setMasterData({ itemRoutes: irMap, routeOps: roMap, opTimes: otMap, ready: true })
      
      console.log(`✅ 母資料載入成功！`)
      console.log(`- 品項對途程: ${ir.length} 筆`)
      console.log(`- 途程對工序: ${ro.length} 筆`)
      console.log(`- 工序對時間: ${ot.length} 筆`)

    } catch (e) {
      console.error('Fetch Master Data Error', e)
      alert('母資料讀取失敗，請檢查網路或 Console')
    }
  }

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)))
    }
  }

  const filteredOrders = orders.filter(o => 
    o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 3. 核心轉換運算
  const handleConvert = () => {
    if (!masterData.ready) { alert('母資料載入中，請稍候...'); return }
    if (selectedIds.size === 0) { alert('請先勾選工單'); return }

    setCalculating(true)
    const newResults: ConvertedRow[] = []
    const newFailed: FailedRow[] = []

    const targetOrders = orders.filter(o => selectedIds.has(o.id))

    targetOrders.forEach(order => {
      const cleanItemCode = (order.item_code || '').trim().toUpperCase()
      
      const routeId = masterData.itemRoutes.get(cleanItemCode)
      if (!routeId) {
        newFailed.push({ ...order, reason: `找不到對應途程 (ItemCode: "${cleanItemCode}")` })
        return
      }

      const ops = masterData.routeOps.get(routeId)
      if (!ops || ops.length === 0) {
        newFailed.push({ ...order, reason: `途程存在但無工序資料 (RouteID: "${routeId}")` })
        return
      }

      const tempResults: ConvertedRow[] = []
      const missingOps: string[] = [] 

      ops.forEach(op => {
        const cleanOpName = (op.op_name || '').trim()
        const opInfo = masterData.opTimes.get(cleanOpName)
        
        if (!opInfo) {
          missingOps.push(cleanOpName)
          return
        }

        const station = opInfo.station || '未知站點'
        const stdTime = opInfo.std_time || 0
        const qty = Number(order.quantity) || 0
        const plates = parseFloat(order.plate_count) || 0
        
        let multiplier = 0
        let basisText = ''
        const isPrintOrLaser = station.includes('印刷') || station.includes('雷切')
        const isPacking = station.includes('包裝')

        if (isPacking) {
          multiplier = qty
          basisText = `數量 (${qty})`
        } else if (isPrintOrLaser) {
          if (plates > 0) { multiplier = plates; basisText = `盤數 (${plates})` }
          else { multiplier = qty; basisText = `數量 (${qty})` }
        } else {
          if (plates > 0) { multiplier = plates; basisText = `盤數 (${plates})` }
          else { multiplier = qty; basisText = `數量 (${qty})` }
        }

        let rawTime = stdTime * multiplier
        if (rawTime < 20) rawTime = 20

        const totalMin = Math.round(rawTime * 100) / 100

        tempResults.push({
          unique_id: `${order.id}_${op.sequence}`, 
          source_order_id: order.id,             
          order_number: order.order_number,
          doc_type: order.doc_type || '',       // 🔥 帶入值
          item_code: order.item_code,
          item_name: order.item_name || '',
          quantity: qty,
          plate_count: order.plate_count || '',
          delivery_date: order.delivery_date || '', // 🔥 帶入值
          designer: order.designer || '',           // 🔥 帶入值
          customer: order.customer || '',           // 🔥 帶入值
          handler: order.handler || '',             // 🔥 帶入值
          issuer: order.issuer || '',               // 🔥 帶入值
          sequence: op.sequence,
          station: station,
          op_name: op.op_name,
          basis_text: basisText,
          std_time: stdTime,
          total_time_min: totalMin
        })
      })

      if (missingOps.length > 0) {
        newFailed.push({
          ...order,
          reason: `缺標準工時: ${missingOps.join('、')}`
        })
      } else {
        newResults.push(...tempResults)
      }
    })

    setResults(newResults)
    setFailedRows(newFailed)
    setCalculating(false)

    setTimeout(() => { document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' }) }, 100)
  }

  // 4. 寫入資料庫
  const handleSaveToDatabase = async () => {
    if (results.length === 0) return
    if (!confirm(`確定要將這 ${results.length} 筆工時資料寫入總表嗎？`)) return

    setSaving(true)
    try {
      const processedOrderIds = Array.from(new Set(results.map(r => r.source_order_id)))

      if (processedOrderIds.length > 0) {
        await supabase.from('station_time_summary').delete().in('source_order_id', processedOrderIds)
      }

      const dataToInsert = results.map(({ unique_id, ...rest }) => rest)
      const { error: insertError } = await supabase.from('station_time_summary').insert(dataToInsert)
      if (insertError) throw insertError

      if (processedOrderIds.length > 0) {
        const { error: updateError } = await supabase
          .from('daily_orders')
          .update({ is_converted: true, conversion_status: 'success' })
          .in('id', processedOrderIds)
        if (updateError) throw updateError
      }

      alert('🎉 寫入成功！工單已從待處理列表中移除。')
      
      setResults([])
      setFailedRows([])
      setSelectedIds(new Set())
      fetchOrders() 

    } catch (err: any) {
      console.error(err)
      alert('寫入失敗: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleMoveFailedToPending = async () => {
    if (failedRows.length === 0) return
    if (!confirm(`確定要將這 ${failedRows.length} 筆失敗資料移至「待處理資料表」嗎？\n\n(這些資料將暫時從此列表中隱藏)`)) return

    setMovingFailed(true)
    try {
      const updates = failedRows.map(row => ({
        id: row.id,
        conversion_status: 'failed',
        conversion_note: row.reason
      }))

      const { error } = await supabase.from('daily_orders').upsert(updates)
      if (error) throw error

      alert(`✅ 已成功將 ${failedRows.length} 筆資料移至待處理區。`)
      setFailedRows([])
      fetchOrders() 

    } catch (err: any) {
      console.error(err)
      alert('移動失敗: ' + err.message)
    } finally {
      setMovingFailed(false)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-[1800px] mx-auto text-slate-300 min-h-screen space-y-8">
      
      {/* 1. 來源選擇區 */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">各站工時轉換表</h1>
            <p className="text-yellow-500 mt-1 font-mono text-sm uppercase">
              TIME CONVERSION CALCULATOR // 待處理工單
            </p>
          </div>
          <div className="flex gap-4">
             <input type="text" placeholder="篩選工單..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-yellow-500 outline-none" />
             <div className="px-4 py-2 bg-slate-800 rounded text-sm">已選取: <span className="text-yellow-400 font-bold">{selectedIds.size}</span> 筆</div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden h-[400px] flex flex-col">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-10 text-center"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === filteredOrders.length} /></th>
                  <th className="p-3">工單資訊</th>
                  <th className="p-3">品項資訊</th>
                  <th className="p-3 text-right">數量/盤數</th>
                  <th className="p-3">交付與客戶</th>
                  <th className="p-3">內部人員</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? ( <tr><td colSpan={6} className="p-10 text-center">載入中...</td></tr> ) : filteredOrders.length === 0 ? ( <tr><td colSpan={6} className="p-10 text-center text-slate-500">目前沒有待處理的工單 (無 Error 狀態訂單)</td></tr> ) : filteredOrders.map(order => (
                  <tr key={order.id} className={`hover:bg-slate-800/60 cursor-pointer ${selectedIds.has(order.id) ? 'bg-yellow-900/10' : ''}`} onClick={() => toggleSelect(order.id)}>
                    {/* 勾選 */}
                    <td className="p-3 text-center align-top pt-4" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelect(order.id)} /></td>
                    
                    {/* 工單資訊：編號 + 種類 */}
                    <td className="p-3 align-top">
                      <div className="font-mono text-cyan-300 font-bold text-sm">{order.order_number}</div>
                      <div className="text-slate-500 text-[10px] mt-1">{order.doc_type}</div>
                    </td>

                    {/* 品項資訊：編碼 + 品名 */}
                    <td className="p-3 align-top max-w-[250px]">
                      <div className="font-mono text-purple-300 text-sm">{order.item_code}</div>
                      <div className="text-slate-400 text-xs mt-1 leading-tight truncate">{order.item_name}</div>
                    </td>

                    {/* 數量/盤數 */}
                    <td className="p-3 align-top text-right">
                      <div className="font-bold text-white text-sm">{order.quantity}</div>
                      <div className="text-slate-500 text-xs mt-1">盤: {order.plate_count || '-'}</div>
                    </td>

                    {/* 交付與客戶 */}
                    <td className="p-3 align-top">
                      <div className="font-mono text-white text-xs">{order.delivery_date}</div>
                      <div className="text-slate-500 text-xs mt-1 truncate max-w-[100px]">{order.customer}</div>
                    </td>

                    {/* 內部人員 */}
                    <td className="p-3 align-top text-xs text-slate-400">
                      <div className="flex gap-2"><span>美: {order.designer}</span> <span>承: {order.handler}</span></div>
                      <div className="mt-1">開: {order.issuer}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. 轉換按鈕 */}
      <div className="flex justify-center py-4">
        <button onClick={handleConvert} disabled={calculating || selectedIds.size === 0} className={`group relative px-12 py-4 rounded-full font-black text-xl tracking-widest uppercase transition-all duration-300 ${selectedIds.size > 0 ? 'bg-yellow-500 text-black hover:bg-yellow-400 hover:scale-105 shadow-[0_0_30px_rgba(234,179,8,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
          {calculating ? '運算中...' : '開始轉換工時 (EXECUTE)'}
          <div className="absolute inset-0 rounded-full border border-white/20 group-hover:scale-110 transition-transform"></div>
        </button>
      </div>

      {/* 3. 成功結果 */}
      {results.length > 0 && (
        <div id="results-section" className="flex flex-col gap-4 animate-fade-in-up">
          <div className="flex justify-between items-end border-b border-slate-700 pb-4">
            <div>
               <h2 className="text-2xl font-bold text-white flex items-center gap-2"><span className="w-2 h-8 bg-green-500 rounded-full"></span> 轉換結果預覽</h2>
               <p className="text-slate-500 text-sm mt-1">注意：若單站工時低於 20 分鐘，系統已自動以 20 分鐘計。</p>
            </div>
            <button onClick={handleSaveToDatabase} disabled={saving} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white transition-all shadow-lg ${saving ? 'bg-green-800 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 hover:shadow-green-500/30 animate-pulse'}`}>
              {saving ? '寫入中...' : '確認並寫入總表 (SAVE)'}
            </button>
          </div>
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden min-h-[300px] flex flex-col">
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-950 text-slate-300 font-mono sticky top-0 z-10 shadow-lg">
                  <tr>
                    <th className="p-4 border-b border-slate-700">工單編號</th>
                    <th className="p-4 border-b border-slate-700">品項編碼</th>
                    <th className="p-4 border-b border-slate-700 w-48">品名</th>
                    <th className="p-4 border-b border-slate-700 text-center">序</th>
                    <th className="p-4 border-b border-slate-700">站點</th>
                    <th className="p-4 border-b border-slate-700">工序名稱</th>
                    <th className="p-4 border-b border-slate-700 text-right text-slate-400">計算依據</th>
                    <th className="p-4 border-b border-slate-700 text-right text-slate-400">標準工時</th>
                    <th className="p-4 border-b border-slate-700 text-right text-green-400">預計分鐘數</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {results.map((row) => (
                    <tr key={row.unique_id} className="hover:bg-slate-800/60 transition-colors">
                      <td className="p-4 font-mono text-cyan-300 font-bold">{row.order_number}</td>
                      <td className="p-4 font-mono text-purple-300">{row.item_code}</td>
                      <td className="p-4 text-slate-400 truncate max-w-[200px]" title={row.item_name}>{row.item_name}</td>
                      <td className="p-4 text-center font-mono text-slate-500">{row.sequence}</td>
                      <td className="p-4 font-bold text-white">
                        <span className={`px-2 py-1 rounded text-xs ${row.station.includes('印刷') ? 'bg-blue-900/40 text-blue-300' : row.station.includes('雷切') ? 'bg-red-900/40 text-red-300' : row.station.includes('包裝') ? 'bg-orange-900/40 text-orange-300' : 'bg-slate-800 text-slate-400'}`}>{row.station}</span>
                      </td>
                      <td className="p-4 text-slate-300">{row.op_name}</td>
                      <td className="p-4 text-right font-mono text-slate-500 text-xs">{row.basis_text}</td>
                      <td className="p-4 text-right font-mono text-slate-500">{row.std_time}</td>
                      <td className="p-4 text-right font-mono text-green-400 font-bold text-lg">{row.total_time_min}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. 失敗列表 (附帶移交按鈕) */}
      {failedRows.length > 0 && (
        <div className="flex flex-col gap-4 animate-fade-in-up mt-8">
          <div className="flex justify-between items-end border-b border-red-900/50 pb-4">
            <div>
               <h2 className="text-2xl font-bold text-white flex items-center gap-2"><span className="w-2 h-8 bg-red-500 rounded-full animate-pulse"></span> 轉換失敗清單 (Failed Orders)</h2>
               <p className="text-red-400 text-sm mt-1">以下工單無法轉換，請點擊右側按鈕移至「待處理資料表」進行修正。</p>
            </div>
            {/* 🔥 新增：移交按鈕 */}
            <button onClick={handleMoveFailedToPending} disabled={movingFailed} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white transition-all shadow-lg ${movingFailed ? 'bg-slate-700 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 hover:shadow-red-500/30'}`}>
              {movingFailed ? '移動中...' : '將失敗項目移至待處理區 (MOVE)'}
            </button>
          </div>
          <div className="bg-red-950/20 border border-red-900/50 rounded-xl overflow-hidden min-h-[150px] flex flex-col">
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-red-950/50 text-red-300 font-mono sticky top-0 z-10">
                  <tr>
                    <th className="p-4 border-b border-red-900/50 w-32">工單編號</th>
                    <th className="p-4 border-b border-red-900/50 w-32">品項編碼</th>
                    <th className="p-4 border-b border-red-900/50 w-64">品名</th>
                    <th className="p-4 border-b border-red-900/50 text-red-400">失敗原因 (Debug Info)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-900/30">
                  {failedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-red-900/10 transition-colors">
                      <td className="p-4 font-mono text-red-200 font-bold">{row.order_number}</td>
                      <td className="p-4 font-mono text-red-300">{row.item_code}</td>
                      <td className="p-4 text-red-300 truncate max-w-[200px]" title={row.item_name}>{row.item_name}</td>
                      <td className="p-4 font-mono text-sm text-red-400 break-words">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}