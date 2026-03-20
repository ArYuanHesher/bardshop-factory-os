'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabaseClient'

// --- 介面定義 ---
interface PendingOrder {
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
  error_reason: string
  conversion_status: string
  conversion_note: string
}

// 驗證用的母資料快取
interface MasterData {
  itemMap: Map<string, string> // item_code -> route_id
  ready: boolean
}

interface ItemRouteRow {
  item_code: string
  route_id: string
}

interface EditableCellProps {
  value: string | number | null | undefined
  onChange: (value: string) => void
  className?: string
}

export default function PendingPage() {
  const [orderErrors, setOrderErrors] = useState<PendingOrder[]>([])
  const [conversionErrors, setConversionErrors] = useState<PendingOrder[]>([])
  
  const masterDataRef = useRef<MasterData>({ itemMap: new Map(), ready: false })

  const fetchData = useCallback(async () => {
    const { data: errOrders } = await supabase
      .from('daily_orders')
      .select('*')
      .eq('status', 'Error')
      .order('created_at', { ascending: false })

    const { data: convOrders } = await supabase
      .from('daily_orders')
      .select('*')
      .eq('conversion_status', 'failed')
      .order('created_at', { ascending: false })

    setOrderErrors(errOrders || [])
    setConversionErrors(convOrders || [])
  }, [])

  const loadMasterData = useCallback(async () => {
    const { data } = await supabase.from('item_routes').select('item_code, route_id')
    const map = new Map<string, string>()
    ;(data as ItemRouteRow[] | null)?.forEach((item) =>
      map.set(item.item_code.toUpperCase().trim(), item.route_id)
    )
    masterDataRef.current = { itemMap: map, ready: true }
  }, [])

  const initData = useCallback(async () => {
    await Promise.all([fetchData(), loadMasterData()])
  }, [fetchData, loadMasterData])

  useEffect(() => {
    initData()
  }, [initData])

  // --- 通用編輯處理 ---
  const handleEdit = (
    type: 'order' | 'conversion', 
    id: number, 
    field: keyof PendingOrder, 
    value: PendingOrder[keyof PendingOrder]
  ) => {
    const setter = type === 'order' ? setOrderErrors : setConversionErrors
    
    setter(prev => prev.map(row => {
      if (row.id !== id) return row
      const newRow = { ...row, [field]: value }
      
      // 如果是上半部，編輯時觸發自動驗證
      if (type === 'order') {
        const check = validateOrder(newRow)
        newRow.status = check.status
        newRow.error_reason = check.reason
      }
      return newRow
    }))
  }

  // 3. 上半部邏輯：自動驗證
  const validateOrder = (row: PendingOrder) => {
    const itemCode = (row.item_code || '').toUpperCase().trim()
    const qty = Number(row.quantity)
    const map = masterDataRef.current.itemMap

    if (!itemCode) return { status: 'Error', reason: '缺少品項編碼' }
    if (!map.has(itemCode)) return { status: 'Error', reason: '資料庫無此品項' }
    if (!qty || qty <= 0) return { status: 'Error', reason: '數量必須大於 0' }
    
    return { status: 'OK', reason: '' }
  }

  // 刪除訂單錯誤資料
  const handleDeleteOrder = async (id: number) => {
    if (!window.confirm('確定要刪除這筆訂單錯誤資料？此動作無法復原！')) return;
    try {
      const { error } = await supabase.from('daily_orders').delete().eq('id', id);
      if (error) throw error;
      setOrderErrors(prev => prev.filter(r => r.id !== id));
      alert('✅ 已刪除該筆訂單錯誤資料');
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : '未知錯誤';
      alert('刪除失敗: ' + message);
    }
  }

  // 4. 🔥 關鍵修改：發送回訂單更新表 (Move back to temp_orders)
  const handleSubmitOrderFix = async (id: number) => {
    const row = orderErrors.find(r => r.id === id)
    if (!row) return
    if (row.status === 'Error') { alert('資料仍有錯誤，無法送回！'); return; }

    try {
      // 步驟 A: 將修正後的資料寫入 temp_orders (暫存表)
      const { error: insertError } = await supabase
        .from('temp_orders')
        .insert({
          order_number: row.order_number,
          doc_type: row.doc_type,
          designer: row.designer,
          customer: row.customer,
          handler: row.handler,
          issuer: row.issuer,
          item_code: row.item_code,
          item_name: row.item_name,
          quantity: row.quantity,
          delivery_date: row.delivery_date,
          plate_count: row.plate_count,
          status: 'Pending', // 重置狀態，讓它在暫存區等待檢查
          log_msg: '從待處理區修正後退回',
        })

      if (insertError) throw insertError

      // 步驟 B: 從 daily_orders (正式表) 刪除這筆錯誤紀錄
      const { error: deleteError } = await supabase
        .from('daily_orders')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      // 步驟 C: 更新 UI
      alert('✅ 已發送回「訂單更新表」，請回到該頁面重新進行確認與發單。')
      setOrderErrors(prev => prev.filter(r => r.id !== id))

    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : '未知錯誤'
      alert('操作失敗: ' + message)
    }
  }

  // 刪除工時轉換錯誤資料
  const handleDeleteConversion = async (id: number) => {
    if (!window.confirm('確定要刪除這筆工時轉換錯誤資料？此動作無法復原！')) return;
    try {
      const { error } = await supabase.from('daily_orders').delete().eq('id', id);
      if (error) throw error;
      setConversionErrors(prev => prev.filter(r => r.id !== id));
      alert('✅ 已刪除該筆工時轉換錯誤資料');
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : '未知錯誤';
      alert('刪除失敗: ' + message);
    }
  }

  // 5. 下半部動作：發送回各站工時轉換表
  const handleSubmitConversionFix = async (id: number) => {
    const row = conversionErrors.find(r => r.id === id)
    if (!row) return

    const { error } = await supabase
      .from('daily_orders')
      .update({ 
        item_code: row.item_code,
        item_name: row.item_name,
        quantity: row.quantity,
        plate_count: row.plate_count,
        conversion_status: 'pending', // 改回 pending 讓它重新出現在轉換表
        conversion_note: null
      })
      .eq('id', id)

    if (error) alert('更新失敗:' + error.message)
    else {
      setConversionErrors(prev => prev.filter(r => r.id !== id)) 
      alert('✅ 已發送回「各站工時轉換表」，請重新進行工時計算。')
    }
  }

  const EditableCell = ({ value, onChange, className="" }: EditableCellProps) => (
    <input 
      value={value || ''} 
      onChange={e => onChange(e.target.value)} 
      className={`bg-transparent border-b border-slate-700 focus:border-cyan-500 outline-none w-full px-1 ${className}`} 
    />
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1800px] mx-auto min-h-screen space-y-8 md:space-y-12">
      
      {/* --- 上半部：訂單更新表待修正 --- */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 border-b border-red-900/50 pb-2">
          <div className="w-2 h-8 bg-red-500 rounded-full"></div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">訂單更新表待修正</h2>
            <p className="text-red-400 text-sm">ORDER ERRORS // 修正後將退回「訂單更新表 (Temp Table)」，請至該處重新確認發單。</p>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden min-h-[250px]">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400 min-w-[900px]">
            <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono">
              <tr>
                <th className="p-4 w-24">狀態</th>
                <th className="p-4">工單編號</th>
                <th className="p-4 w-40">品項編碼 (Edit)</th>
                <th className="p-4 w-64">品名 (Edit)</th>
                <th className="p-4 w-24 text-right">數量 (Edit)</th>
                <th className="p-4 text-red-400">錯誤原因</th>
                <th className="p-4 text-center w-32">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {orderErrors.length === 0 ? <tr><td colSpan={7} className="p-8 text-center">無待修正訂單</td></tr> : 
                orderErrors.map(row => (
                <tr key={row.id} className="hover:bg-slate-800/30">
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'OK' ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-white">{row.order_number}</td>
                  <td className="p-4"><EditableCell value={row.item_code} onChange={(v: string) => handleEdit('order', row.id, 'item_code', v)} className="text-yellow-300 font-mono" /></td>
                  <td className="p-4"><EditableCell value={row.item_name} onChange={(v: string) => handleEdit('order', row.id, 'item_name', v)} /></td>
                  <td className="p-4"><EditableCell value={row.quantity} onChange={(v: string) => handleEdit('order', row.id, 'quantity', v)} className="text-right" /></td>
                  <td className="p-4 text-red-400 text-xs">{row.error_reason}</td>
                  <td className="p-4 text-center flex flex-col gap-2">
                    <button 
                      onClick={() => handleSubmitOrderFix(row.id)}
                      disabled={row.status === 'Error'}
                      className={`px-3 py-1 rounded text-xs transition-all ${row.status === 'OK' ? 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-500/20' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                    >
                      退回訂單表
                    </button>
                    <button
                      onClick={() => handleDeleteOrder(row.id)}
                      className="px-3 py-1 rounded text-xs bg-rose-700 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20 transition-all"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* --- 下半部：工時轉換表待修正 --- */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 border-b border-yellow-900/50 pb-2">
          <div className="w-2 h-8 bg-yellow-500 rounded-full"></div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">工時轉換表待修正</h2>
            <p className="text-yellow-400 text-sm">CONVERSION ERRORS // 修正後將回到「工時轉換表」，請至該處重新計算工時。</p>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden min-h-[250px]">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400 min-w-[900px]">
            <thead className="bg-slate-950 text-slate-200 uppercase text-xs font-mono">
              <tr>
                <th className="p-4 w-32">工單編號</th>
                <th className="p-4 w-40">品項編碼 (Edit)</th>
                <th className="p-4 w-64">品名 (Edit)</th>
                <th className="p-4 w-24 text-right">數量 (Edit)</th>
                <th className="p-4 w-24 text-center">盤數 (Edit)</th>
                <th className="p-4 text-yellow-400">轉換失敗原因</th>
                <th className="p-4 text-center w-40">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {conversionErrors.length === 0 ? <tr><td colSpan={7} className="p-8 text-center">無待修正資料</td></tr> :
                conversionErrors.map(row => (
                <tr key={row.id} className="hover:bg-slate-800/30">
                  <td className="p-4 font-mono text-white">{row.order_number}</td>
                  <td className="p-4"><EditableCell value={row.item_code} onChange={(v: string) => handleEdit('conversion', row.id, 'item_code', v)} className="text-cyan-300 font-mono" /></td>
                  <td className="p-4"><EditableCell value={row.item_name} onChange={(v: string) => handleEdit('conversion', row.id, 'item_name', v)} /></td>
                  <td className="p-4"><EditableCell value={row.quantity} onChange={(v: string) => handleEdit('conversion', row.id, 'quantity', v)} className="text-right" /></td>
                  <td className="p-4"><EditableCell value={row.plate_count} onChange={(v: string) => handleEdit('conversion', row.id, 'plate_count', v)} className="text-center" /></td>
                  <td className="p-4 text-yellow-400 text-xs">{row.conversion_note}</td>
                  <td className="p-4 text-center flex flex-col gap-2">
                    <button 
                      onClick={() => handleSubmitConversionFix(row.id)}
                      className="px-4 py-2 rounded text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-500/20 transition-all"
                    >
                      發送回轉換表
                    </button>
                    <button
                      onClick={() => handleDeleteConversion(row.id)}
                      className="px-3 py-1 rounded text-xs bg-rose-700 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20 transition-all"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

    </div>
  )
}