'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Papa from 'papaparse'

export default function UploadPage() {
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev])
  }

  const parseCSV = (file: File) => {
    return new Promise<any[]>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(err),
      })
    })
  }

  const chunkArray = (array: any[], size: number) => {
    const result = []
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size))
    }
    return result
  }

  // 1. 上傳工序對時間
  const handleUploadOpsTime = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    addLog(`Step 1: 正在讀取【工序對時間】...`)

    try {
      const data = await parseCSV(file)
      const rawData = data.map(row => ({
        op_name: row['製程名稱'],
        station: row['站點'],
        std_time_min: parseFloat(row['生產時間'] || 0)
      })).filter(row => row.op_name)

      const uniqueMap = new Map()
      rawData.forEach(item => uniqueMap.set(item.op_name, item))
      const formattedData = Array.from(uniqueMap.values())

      addLog(`解析成功，準備上傳 ${formattedData.length} 筆資料...`)
      const batches = chunkArray(formattedData, 100)
      for (let i = 0; i < batches.length; i++) {
        const { error } = await supabase.from('operation_times').upsert(batches[i], { onConflict: 'op_name' })
        if (error) throw error
        addLog(`進度: ${i + 1} / ${batches.length} 批完成`)
      }
      addLog('✅ 【工序對時間】上傳成功！', 'success')
    } catch (err: any) {
      console.error(err)
      addLog(`❌ Step 1 失敗: ${err.message}`, 'error')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  // 2. 上傳途程對工序
  const handleUploadRouteOps = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    addLog(`Step 2: 正在讀取【途程對工序】...`)

    try {
      const data = await parseCSV(file)
      addLog(`解析成功，正在進行資料驗證...`)

      let formattedData: any[] = []
      const activeRoutes = new Set()
      const usedOpsInCSV = new Set()

      data.forEach(row => {
        const routeId = row['途程']
        if (!routeId) return
        activeRoutes.add(routeId)
        for (let i = 1; i <= 20; i++) {
          const opName = row[`工序${i}`]
          if (opName && opName.trim() !== '') {
            const cleanName = opName.trim()
            formattedData.push({
              route_id: routeId,
              sequence: i,
              op_name: cleanName
            })
            usedOpsInCSV.add(cleanName)
          }
        }
      })

      const { data: validOps, error: fetchError } = await supabase.from('operation_times').select('op_name')
      if (fetchError) throw fetchError
      const validOpSet = new Set(validOps.map(v => v.op_name))
      
      const missingOps: string[] = []
      usedOpsInCSV.forEach((op: any) => {
        if (!validOpSet.has(op)) missingOps.push(op)
      })

      if (missingOps.length > 0) {
        addLog('⛔ 檢查失敗！您的 Step 2 表格中包含了 Step 1 沒見過的工序：', 'error')
        addLog(`❌ 缺少的工序名稱: ${missingOps.slice(0, 5).join(', ')} ...等`, 'error')
        setLoading(false)
        e.target.value = ''
        return
      }

      addLog(`驗證通過！開始更新資料庫...`)
      const routeArray = Array.from(activeRoutes)
      const deleteBatches = chunkArray(routeArray, 20)
      for (let i = 0; i < deleteBatches.length; i++) {
        await supabase.from('route_operations').delete().in('route_id', deleteBatches[i])
      }
      const insertBatches = chunkArray(formattedData, 100)
      for (let i = 0; i < insertBatches.length; i++) {
        const { error } = await supabase.from('route_operations').insert(insertBatches[i])
        if (error) throw error
        addLog(`寫入進度: ${i + 1} / ${insertBatches.length} 批完成`)
      }
      addLog('✅ 【途程對工序】上傳成功！', 'success')
    } catch (err: any) {
      console.error(err)
      addLog(`❌ Step 2 失敗: ${err.message}`, 'error')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  // 3. 上傳品項對途程
  const handleUploadItemRoutes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    addLog(`Step 3: 正在讀取【品項對途程】...`)

    try {
      const data = await parseCSV(file)
      const formattedData = data.map(row => ({
        item_code: row['品項編碼'],
        item_name: row['品項名稱'],
        route_id: row['途程名稱']
      })).filter(row => row.item_code && row.route_id)

      addLog(`解析成功，準備上傳 ${formattedData.length} 筆資料...`)
      const batches = chunkArray(formattedData, 100)
      for (let i = 0; i < batches.length; i++) {
        const { error } = await supabase.from('item_routes').upsert(batches[i], { onConflict: 'item_code' })
        if (error) throw error
      }
      addLog('✅ 【品項對途程】上傳成功！', 'success')
    } catch (err: any) {
      console.error(err)
      addLog(`❌ Step 3 失敗: ${err.message}`, 'error')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-8 text-slate-800">工序總表管理 (Master Data)</h1>
      
      <div className="grid gap-8">
        
        {/* Step 1 */}
        <div className="border p-6 rounded-lg shadow-sm bg-white border-l-4 border-l-blue-500">
          <h2 className="text-xl font-bold mb-2 text-blue-700">Step 1: 上傳【工序對時間】</h2>
          <p className="text-sm text-gray-600 mb-4">CSV: <code>製程名稱</code>, <code>生產時間</code></p>
          <input type="file" accept=".csv" onChange={handleUploadOpsTime} disabled={loading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"/>
        </div>

        {/* Step 2 */}
        <div className="border p-6 rounded-lg shadow-sm bg-white border-l-4 border-l-purple-500">
          <h2 className="text-xl font-bold mb-2 text-purple-700">Step 2: 上傳【途程對工序】</h2>
          <p className="text-sm text-gray-600 mb-4">CSV: <code>途程</code>, <code>工序1...</code></p>
          <input type="file" accept=".csv" onChange={handleUploadRouteOps} disabled={loading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"/>
        </div>

        {/* Step 3 */}
        <div className="border p-6 rounded-lg shadow-sm bg-white border-l-4 border-l-green-500">
          <h2 className="text-xl font-bold mb-2 text-green-700">Step 3: 上傳【品項對途程】</h2>
          <p className="text-sm text-gray-600 mb-4">CSV: <code>品項編碼</code>, <code>途程名稱</code></p>
          <input type="file" accept=".csv" onChange={handleUploadItemRoutes} disabled={loading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"/>
        </div>

      </div>

      <div className="mt-8 p-4 bg-gray-900 text-green-400 rounded-lg h-64 overflow-y-auto font-mono text-sm">
        <h3 className="text-white border-b border-gray-700 pb-2 mb-2">系統操作紀錄 (System Logs)</h3>
        {logs.map((log, index) => (
          <div key={index} className={`mb-1 border-b border-gray-800 pb-1 ${log.includes('❌') ? 'text-red-400 font-bold' : ''}`}>
            {log}
          </div>
        ))}
      </div>
    </div>
  )
}