'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

// --- 輔助函式：簡易 CSV 解析器 (處理中文編碼與換行) ---
const parseCSV = (content: string) => {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '')
  if (lines.length === 0) return []
  
  const headers = lines[0].split(',').map(h => h.trim())
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].split(',')
    // 簡單防呆：如果欄位數不符，略過 (或視情況補空值)
    if (currentLine.length === headers.length) {
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = (currentLine[index] || '').trim()
      })
      data.push(row)
    }
  }
  return data
}

// --- 輔助函式：分批寫入 (Batch Insert) ---
const batchInsert = async (table: string, data: any[], statusCallback: (msg: string) => void) => {
  const BATCH_SIZE = 1000
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE)
    statusCallback(`正在寫入 ${table}... (${i + 1}/${data.length})`)
    
    const { error } = await supabase.from(table).insert(chunk)
    if (error) throw error
  }
}

export default function UploadPage() {
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  
  // 檔案狀態
  const [files, setFiles] = useState<{
    itemRoutes: File | null,
    routeOps: File | null,
    opTimes: File | null
  }>({
    itemRoutes: null,
    routeOps: null,
    opTimes: null
  })

  // 處理檔案選擇
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [type]: e.target.files![0] }))
    }
  }

  // --- 核心邏輯：執行覆寫更新 ---
  const handleOverwrite = async () => {
    // 1. 確認防呆
    if (!files.itemRoutes && !files.routeOps && !files.opTimes) {
      alert('請至少選擇一個要更新的檔案')
      return
    }

    if (!confirm('⚠️ 警告：這將會「清空」舊資料並寫入新資料！\n\n確定要執行覆寫嗎？')) {
      return
    }

    setLoading(true)
    setLogs([])
    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])

    try {
      // --- A. 處理 品項對途程 (item_routes) ---
      if (files.itemRoutes) {
        addLog('📦 開始處理：品項對途程...')
        const text = await files.itemRoutes.text()
        const rawData = parseCSV(text)
        
        // 轉換欄位
        const cleanData = rawData
          .filter((row: any) => row['品項編碼'] && row['途程名稱'])
          .map((row: any) => ({
            item_code: row['品項編碼'].toUpperCase(), // 強制大寫
            route_id: row['途程名稱'] // 或是 row['對應途程 ID']，視您的CSV標頭而定
          }))

        if (cleanData.length > 0) {
          addLog(`  - 清空舊資料 (item_routes)...`)
          const { error: delError } = await supabase.from('item_routes').delete().neq('id', 0) // 清空全表
          if (delError) throw delError

          addLog(`  - 寫入 ${cleanData.length} 筆新資料...`)
          await batchInsert('item_routes', cleanData, addLog)
          addLog('  ✅ 品項對途程 更新完成')
        }
      }

      // --- B. 處理 途程對工序 (route_operations) ---
      if (files.routeOps) {
        addLog('🛠️ 開始處理：途程對工序...')
        const text = await files.routeOps.text()
        const rawData = parseCSV(text)
        
        // 轉換邏輯：寬表格 (站點1, 工序1...) 轉 長表格 (sequence, op_name)
        const cleanData: any[] = []
        
        rawData.forEach((row: any) => {
          const routeId = row['途程']
          if (!routeId) return

          // 假設最多支援 20 個工序，依序檢查
          for (let i = 1; i <= 20; i++) {
            const opName = row[`工序${i}`]
            // 只要工序名稱存在，就加入
            if (opName) {
              cleanData.push({
                route_id: routeId,
                sequence: i,
                op_name: opName.trim()
              })
            }
          }
        })

        if (cleanData.length > 0) {
          addLog(`  - 清空舊資料 (route_operations)...`)
          const { error: delError } = await supabase.from('route_operations').delete().neq('id', 0)
          if (delError) throw delError

          addLog(`  - 轉換後產生 ${cleanData.length} 筆工序資料，開始寫入...`)
          await batchInsert('route_operations', cleanData, addLog)
          addLog('  ✅ 途程對工序 更新完成')
        }
      }

      // --- C. 處理 工序對時間 (operation_times) ---
      if (files.opTimes) {
        addLog('⏱️ 開始處理：工序對時間...')
        const text = await files.opTimes.text()
        const rawData = parseCSV(text)
        
        const cleanData = rawData
          .filter((row: any) => row['製程名稱'] && row['生產時間'])
          .map((row: any) => ({
            op_name: row['製程名稱'].trim(),
            station: row['站點'] ? row['站點'].trim() : '未知',
            std_time_min: parseFloat(row['生產時間']) || 0
          }))

        if (cleanData.length > 0) {
          addLog(`  - 清空舊資料 (operation_times)...`)
          const { error: delError } = await supabase.from('operation_times').delete().neq('id', 0)
          if (delError) throw delError

          addLog(`  - 寫入 ${cleanData.length} 筆工時資料...`)
          await batchInsert('operation_times', cleanData, addLog)
          addLog('  ✅ 工序對時間 更新完成')
        }
      }

      addLog('🎉 全部更新作業成功！')
      alert('資料庫已成功覆寫更新！')

    } catch (err: any) {
      console.error(err)
      addLog(`❌ 錯誤：${err.message}`)
      alert(`更新失敗：${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto text-slate-300 min-h-screen space-y-8">
      
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">工序總表更新</h1>
        <p className="text-orange-500 mt-1 font-mono text-sm uppercase">
          DATABASE MANAGEMENT // 上傳 CSV 以覆寫資料
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Card 1: 品項對途程 */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col gap-4 hover:border-cyan-500 transition-colors">
          <div className="w-12 h-12 bg-cyan-900/30 rounded-lg flex items-center justify-center text-cyan-400 mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h3 className="text-xl font-bold text-white">1. 品項對途程</h3>
          <p className="text-xs text-slate-500">
            欄位需求：品項編碼, 途程名稱 (或對應途程 ID)<br/>
            用途：連結產品編號與生產路徑
          </p>
          <input 
            type="file" 
            accept=".csv"
            onChange={(e) => handleFileChange(e, 'itemRoutes')}
            className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-900/30 file:text-cyan-400 hover:file:bg-cyan-900/50"
          />
        </div>

        {/* Card 2: 途程對工序 */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col gap-4 hover:border-purple-500 transition-colors">
          <div className="w-12 h-12 bg-purple-900/30 rounded-lg flex items-center justify-center text-purple-400 mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <h3 className="text-xl font-bold text-white">2. 途程對工序</h3>
          <p className="text-xs text-slate-500">
            欄位需求：途程, 站點1, 工序1, 站點2...<br/>
            用途：定義每一種路徑的生產步驟
          </p>
          <input 
            type="file" 
            accept=".csv"
            onChange={(e) => handleFileChange(e, 'routeOps')}
            className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-900/30 file:text-purple-400 hover:file:bg-purple-900/50"
          />
        </div>

        {/* Card 3: 工序對時間 */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col gap-4 hover:border-green-500 transition-colors">
          <div className="w-12 h-12 bg-green-900/30 rounded-lg flex items-center justify-center text-green-400 mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 className="text-xl font-bold text-white">3. 工序對時間</h3>
          <p className="text-xs text-slate-500">
            欄位需求：製程名稱, 站點, 生產時間<br/>
            用途：計算標準工時的核心資料
          </p>
          <input 
            type="file" 
            accept=".csv"
            onChange={(e) => handleFileChange(e, 'opTimes')}
            className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-900/30 file:text-green-400 hover:file:bg-green-900/50"
          />
        </div>
      </div>

      {/* Action Button */}
      <div className="flex flex-col items-center gap-4 pt-4">
        <button
          onClick={handleOverwrite}
          disabled={loading}
          className={`
            px-12 py-4 rounded-full font-black text-xl tracking-widest uppercase transition-all duration-300 shadow-xl
            ${loading 
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
              : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:scale-105 hover:shadow-orange-500/30'}
          `}
        >
          {loading ? '正在覆寫資料庫...' : '確認上傳並覆寫資料 (OVERWRITE)'}
        </button>
        <p className="text-sm text-slate-500">
          ⚠️ 注意：點擊按鈕後，系統將先「清空」選擇表格中的舊資料，再寫入新資料。
        </p>
      </div>

      {/* Logs Console */}
      <div className="bg-black/40 border border-slate-800 rounded-xl p-4 font-mono text-sm h-64 overflow-y-auto custom-scrollbar">
        <div className="text-slate-500 mb-2 border-b border-slate-800 pb-2">--- 執行紀錄 (System Logs) ---</div>
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">等待操作...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="text-green-400/80 mb-1">{log}</div>
          ))
        )}
      </div>

    </div>
  )
}