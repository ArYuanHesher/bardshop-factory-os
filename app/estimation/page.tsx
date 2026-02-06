'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'

// --- 資料介面 ---
interface ItemRoute {
  id: number
  item_code: string
  item_name: string
  route_id: string
}

interface CalculationResult {
  sequence: number
  op_name: string
  station: string
  setup_min: number
  cycle_min: number
  total_min: number
  formula: string
  is_plate_calc: boolean
}

export default function EstimationPage() {
  // --- 狀態管理 ---
  
  // COL 1: 搜尋與代出
  const [searchKey, setSearchKey] = useState('')
  const [suggestions, setSuggestions] = useState<ItemRoute[]>([]) 
  const [retrievedItem, setRetrievedItem] = useState<ItemRoute | null>(null) 
  
  // COL 2: 生產參數
  const [quantity, setQuantity] = useState<number | ''>('') 
  const [isSheetMode, setIsSheetMode] = useState<boolean | null>(null) 
  const [plateCount, setPlateCount] = useState<number | ''>('')

  // 板材換算器
  const [plateDim, setPlateDim] = useState({ length: 0, width: 0 })
  const [prodDim, setProdDim] = useState({ length: 0, width: 0 })
  const [calcInfo, setCalcInfo] = useState<{ perPlate: number, needed: number, note: string } | null>(null)

  // COL 3: 計算結果
  const [results, setResults] = useState<CalculationResult[]>([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const terminalRef = useRef<HTMLDivElement>(null)

  // --- 步驟狀態判斷 ---
  const step1Done = !!retrievedItem
  const step2Done = step1Done && typeof quantity === 'number' && quantity > 0
  const step3Done = step2Done && isSheetMode !== null
  const step4Done = step3Done && (!isSheetMode || (isSheetMode && typeof plateCount === 'number' && plateCount > 0))
  
  const isReadyToRun = step4Done 

  // 終端機自動捲動
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logs])

  // --- 1. 搜尋建議 ---
  useEffect(() => {
    if (!searchKey.trim() || retrievedItem) {
      setSuggestions([])
      return
    }
    const delayDebounceFn = setTimeout(async () => {
      const { data } = await supabase
        .from('item_routes')
        .select('*')
        .ilike('item_code', `%${searchKey}%`) 
        .limit(10)

      if (data) setSuggestions(data)
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }, [searchKey, retrievedItem])

  // --- 動作處理 ---
  const handleRetrieve = (item: ItemRoute) => {
    setRetrievedItem(item)      
    setSearchKey(item.item_code) 
    setSuggestions([])          
    setQuantity('')
    setIsSheetMode(null)
    setPlateCount('')
    setCalcInfo(null)
    setShowResults(false)
    setLogs([])
  }

  const handleReset = () => {
    setRetrievedItem(null)
    setSearchKey('')
    setSuggestions([])
    setQuantity('')
    setIsSheetMode(null)
    setPlateCount('')
    setCalcInfo(null)
    setShowResults(false)
    setLogs([])
  }

  // --- 板材試算 ---
  const handleCalcPlate = () => {
    if (!plateDim.length || !plateDim.width || !prodDim.length || !prodDim.width) {
        alert("請輸入完整尺寸")
        return
    }
    const qtyNum = Number(quantity) 
    if (qtyNum <= 0) return

    const gap = 0.2
    const pL = prodDim.length + gap
    const pW = prodDim.width + gap
    
    const countA = Math.floor(plateDim.length / pL) * Math.floor(plateDim.width / pW)
    const countB = Math.floor(plateDim.length / pW) * Math.floor(plateDim.width / pL)
    const maxPerPlate = Math.max(countA, countB)

    if (maxPerPlate === 0) {
        setCalcInfo({ perPlate: 0, needed: 0, note: "❌ 尺寸過大" })
        return
    }

    const platesNeeded = Math.ceil(qtyNum / maxPerPlate)
    const bestMode = countA >= countB ? "直排" : "旋轉"

    setCalcInfo({ 
        perPlate: maxPerPlate, 
        needed: platesNeeded, 
        note: `✅ ${bestMode}: 一版 ${maxPerPlate} 模`
    })

    setPlateCount(platesNeeded)
  }

  // --- 🔥 核心運算 (更新：增加大量模擬日誌與延遲) ---
  const runSimulation = async () => {
    if (!isReadyToRun || !retrievedItem) return

    setIsCalculating(true)
    setShowResults(false)
    setLogs([])

    try {
      // 1. 初始化
      addLog(`Initializing calculation kernel v3.0...`)
      await wait(400)
      
      addLog(`Allocating memory for job: [${retrievedItem.item_code}]`)
      await wait(500)

      // 2. 讀取途程
      addLog(`Connecting to database [route_operations]...`)
      await wait(600)
      
      addLog(`> Querying Route ID: ${retrievedItem.route_id}`)
      const { data: routeOps } = await supabase
        .from('route_operations')
        .select('*')
        .eq('route_id', retrievedItem.route_id)
        .order('sequence', { ascending: true })

      if (!routeOps || routeOps.length === 0) throw new Error("無途程資料")
      await wait(400)
      addLog(`> Sequence Loaded. Found ${routeOps.length} operations.`)
      await wait(500)

      // 3. 讀取工時
      addLog(`Retrieving standard time definitions from [operation_times]...`)
      const opNames = routeOps.map(r => r.op_name)
      const { data: opTimes } = await supabase
        .from('operation_times')
        .select('*')
        .in('op_name', opNames)
      await wait(700)
      
      if (opTimes) {
         addLog(`> Master Data Loaded. Matched ${opTimes.length}/${routeOps.length} operations.`)
      } else {
         addLog(`> Warning: Partial master data missing.`)
      }
      await wait(400)

      // 4. 參數驗證
      addLog(`Verifying production parameters...`)
      await wait(400)
      const qtyNum = Number(quantity)
      const plateNum = Number(plateCount)
      
      addLog(`> Production Qty: ${qtyNum} pcs`)
      if (isSheetMode) {
         addLog(`> Mode: SHEET PROCESSING (Plate Count: ${plateNum})`)
      } else {
         addLog(`> Mode: STANDARD BATCH PROCESSING`)
      }
      await wait(600)

      // 5. 計算矩陣
      addLog(`Computing time matrix...`)
      await wait(800) // 假裝算很久

      const calculatedData: CalculationResult[] = routeOps.map(route => {
        const timeData = opTimes?.find(t => t.op_name === route.op_name)
        const setup = timeData?.setup_min || 0 
        const cycle = timeData?.std_time_min || 0 
        const station = timeData?.station || 'Unknown'
        
        const isPrintOrLaser = station.includes('印刷') || station.includes('雷切')
        const usePlateCalc = (isSheetMode === true) && isPrintOrLaser
        let total = 0
        let formula = ''

        if (usePlateCalc) {
          total = setup + (cycle * plateNum)
          formula = `${setup} + (${cycle}×${plateNum}盤)`
        } else {
          total = setup + (cycle * qtyNum)
          formula = `${setup} + (${cycle}×${qtyNum})`
        }

        return {
          sequence: route.sequence,
          op_name: route.op_name,
          station: station,
          setup_min: setup,
          cycle_min: cycle,
          total_min: Math.ceil(total),
          formula: formula,
          is_plate_calc: usePlateCalc
        }
      })

      // 6. 收尾
      addLog(`Optimizing schedule timeline...`)
      await wait(400)
      addLog(`Generating final report...`)
      await wait(300)
      addLog(`CALCULATION SUCCESS.`)
      
      setResults(calculatedData)
      await wait(300)
      setIsCalculating(false)
      setShowResults(true)

    } catch (err: any) {
      addLog(`CRITICAL ERROR: ${err.message}`)
      setIsCalculating(false)
    }
  }

  const addLog = (msg: string) => setLogs(prev => [...prev, msg])
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const totalProductionTime = results.reduce((acc, curr) => acc + curr.total_min, 0)

  // --- 渲染 ---
  return (
    <div className="h-screen bg-[#050b14] text-slate-300 flex flex-col overflow-hidden font-sans">
      
      {/* Top Bar */}
      <div className="flex-none h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6 z-20">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="w-3 h-8 bg-emerald-500 rounded-sm shadow-[0_0_15px_#10b981]"></span>
          生產時間試算系統 <span className="text-sm text-slate-500 font-mono hidden md:inline ml-2">v3.0 Large</span>
        </h1>
        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white flex items-center gap-2 bg-slate-800 px-5 py-2 rounded-full border border-slate-700 hover:border-emerald-500 transition-all">
           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
           系統首頁
        </Link>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        
        {/* COL 1: 搜尋 (30%) */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-[#0a101a] border-r border-slate-800 flex flex-col z-10">
          <div className="p-6 h-full flex flex-col">
             
             {/* Step Header */}
             <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center text-lg font-bold border border-blue-500/30">1</div>
                <h3 className="text-lg font-bold text-white">品項檢索</h3>
             </div>
             
             {/* 搜尋框 */}
             <div className="relative mb-6">
                <input 
                  type="text"
                  disabled={!!retrievedItem}
                  value={searchKey}
                  onChange={e => setSearchKey(e.target.value.toUpperCase())}
                  placeholder="輸入編碼 (例如: P...)"
                  className="w-full bg-slate-900 border-2 border-slate-700 focus:border-blue-500 rounded-xl px-4 py-4 text-xl text-white outline-none font-mono tracking-wide uppercase disabled:opacity-50 transition-colors shadow-inner"
                />
                
                {/* 搜尋建議 */}
                {!retrievedItem && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto custom-scrollbar">
                    {suggestions.map(item => (
                      <div key={item.id} onClick={() => handleRetrieve(item)} className="px-4 py-3 hover:bg-blue-600/30 cursor-pointer border-b border-slate-700/50 last:border-0 transition-colors">
                         <div className="font-bold text-base text-white">{item.item_code}</div>
                         <div className="text-sm text-slate-400 truncate">{item.item_name}</div>
                      </div>
                    ))}
                  </div>
                )}
             </div>

             {/* 資料卡 (鎖定後顯示) */}
             {retrievedItem ? (
                <div className="bg-blue-900/20 border border-blue-500/50 rounded-xl p-5 animate-fade-in-up shadow-lg">
                   <div className="flex justify-between items-start mb-4 border-b border-blue-500/30 pb-2">
                      <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">SELECTED ITEM</span>
                      <button onClick={handleReset} className="text-sm font-bold text-red-400 hover:text-red-300 underline">重選 (Reset)</button>
                   </div>
                   <div className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">品項編碼</div>
                        <div className="text-2xl font-mono font-black text-white tracking-widest break-all leading-none">{retrievedItem.item_code}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">品項名稱</div>
                        <div className="text-base text-slate-200 font-bold leading-snug">{retrievedItem.item_name}</div>
                      </div>
                      <div className="pt-2">
                         <div className="inline-block px-2 py-1 bg-purple-900/40 text-purple-300 text-xs font-mono rounded border border-purple-500/30">
                           Route: {retrievedItem.route_id}
                         </div>
                      </div>
                   </div>
                </div>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30 p-8">
                   <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                   <p className="text-base">請輸入編碼並選取</p>
                   <p className="text-sm mt-1">以解鎖後續步驟</p>
                </div>
             )}
          </div>
        </div>

        {/* COL 2: 參數設定 (30%) - 核心互動區 */}
        <div className={`col-span-12 md:col-span-4 lg:col-span-3 bg-[#0a101a] border-r border-slate-800 flex flex-col relative transition-all duration-500 ${!step1Done ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
          <div className="p-6 h-full overflow-y-auto custom-scrollbar pb-24 space-y-8">
             
             {/* Step 2: 數量 */}
             <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold border transition-colors ${step1Done ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>2</div>
                    <h3 className="text-lg font-bold text-white">生產數量</h3>
                </div>
                
                <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 focus-within:border-emerald-500 transition-colors shadow-lg">
                   <div className="flex items-center px-4">
                      <input 
                        type="number" 
                        value={quantity} 
                        onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="0"
                        className="w-full bg-transparent py-4 text-right text-3xl font-mono font-bold text-white outline-none placeholder-slate-700" 
                      />
                      <span className="text-lg text-slate-500 font-bold ml-3">pcs</span>
                   </div>
                </div>
             </div>

             {/* Step 3: 是否為板材 (二選一) */}
             <div className={`space-y-3 transition-all duration-500 ${!step2Done ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold border transition-colors ${step2Done ? 'bg-orange-600/20 text-orange-400 border-orange-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>3</div>
                    <h3 className="text-lg font-bold text-white">是否為板材類?</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setIsSheetMode(true)}
                        className={`py-4 rounded-xl border-2 font-bold text-lg transition-all ${isSheetMode === true ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                        是 (YES)
                    </button>
                    <button 
                        onClick={() => setIsSheetMode(false)}
                        className={`py-4 rounded-xl border-2 font-bold text-lg transition-all ${isSheetMode === false ? 'bg-slate-600 border-slate-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                        否 (NO)
                    </button>
                </div>
             </div>

             {/* Step 4: 盤數設定 (只有選「是」才出現) */}
             {isSheetMode === true && (
                <div className="space-y-3 animate-fade-in-down">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center text-lg font-bold border border-cyan-500/30">4</div>
                        <h3 className="text-lg font-bold text-white">盤數計算</h3>
                    </div>

                    <div className="bg-slate-900/50 rounded-xl border border-slate-700 p-4 space-y-4">
                        {/* 盤數輸入框 */}
                        <div>
                            <label className="text-sm text-cyan-400 font-bold mb-2 block">輸入總盤數 (Plate Count)</label>
                            <div className="bg-slate-950 rounded-lg border border-cyan-500/50 flex items-center px-4 shadow-inner">
                                <input 
                                    type="number" 
                                    value={plateCount} 
                                    onChange={e => setPlateCount(e.target.value === '' ? '' : Number(e.target.value))} 
                                    className="w-full bg-transparent py-3 text-right text-2xl font-mono font-bold text-cyan-400 outline-none placeholder-slate-800"
                                    placeholder="0" 
                                />
                                <span className="text-sm text-cyan-600 ml-2 font-bold">盤</span>
                            </div>
                        </div>

                        {/* 計算器 Helper */}
                        <div className="bg-cyan-950/20 rounded-lg p-3 border border-cyan-500/20">
                            <div className="text-xs text-cyan-500/70 mb-2 font-bold text-center">— 或是使用換算器 —</div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <input type="number" placeholder="板長cm" className="bg-slate-900 text-sm text-center text-white py-2 rounded border border-slate-700 focus:border-cyan-500 outline-none" onChange={e => setPlateDim({...plateDim, length: Number(e.target.value)})} />
                                <input type="number" placeholder="板寬cm" className="bg-slate-900 text-sm text-center text-white py-2 rounded border border-slate-700 focus:border-cyan-500 outline-none" onChange={e => setPlateDim({...plateDim, width: Number(e.target.value)})} />
                                <input type="number" placeholder="品長cm" className="bg-slate-900 text-sm text-center text-white py-2 rounded border border-slate-700 focus:border-cyan-500 outline-none" onChange={e => setProdDim({...prodDim, length: Number(e.target.value)})} />
                                <input type="number" placeholder="品寬cm" className="bg-slate-900 text-sm text-center text-white py-2 rounded border border-slate-700 focus:border-cyan-500 outline-none" onChange={e => setProdDim({...prodDim, width: Number(e.target.value)})} />
                            </div>
                            <button onClick={handleCalcPlate} className="w-full py-2 bg-cyan-800 hover:bg-cyan-700 text-white text-xs font-bold rounded shadow transition-colors">計算並帶入盤數</button>
                            {calcInfo && <div className="mt-2 text-center text-xs text-cyan-300 font-mono font-bold bg-black/20 py-1 rounded">{calcInfo.note} → 需 {calcInfo.needed} 盤</div>}
                        </div>
                    </div>
                </div>
             )}

          </div>

          {/* Action Button (Sticky) */}
          <div className="absolute bottom-0 left-0 w-full p-4 bg-[#0a101a]/95 backdrop-blur border-t border-slate-800 z-20">
             <button 
               onClick={runSimulation}
               disabled={!isReadyToRun || isCalculating}
               className={`
                 w-full py-4 rounded-xl font-black text-xl tracking-widest uppercase shadow-lg transition-all duration-300 flex items-center justify-center gap-3
                 ${isReadyToRun 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:scale-[1.02] hover:shadow-emerald-500/40 animate-pulse cursor-pointer' 
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                 }
               `}
             >
               {isCalculating ? (
                 <>
                   <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   COMPUTING...
                 </>
               ) : (
                 <>
                   {isReadyToRun && <span className="w-3 h-3 bg-white rounded-full animate-ping"></span>}
                   開始計算 (RUN)
                 </>
               )}
             </button>
          </div>
        </div>

        {/* COL 3: 終端機結果 (40%) */}
        <div className="col-span-12 md:col-span-4 lg:col-span-6 bg-[#050b14] flex flex-col h-full relative border-l border-slate-800">
           {/* Header */}
           <div className="flex-none h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
              <span className="text-sm font-mono text-slate-400 flex items-center gap-3">
                 <span className={`w-3 h-3 rounded-full ${isCalculating ? 'bg-yellow-400 animate-pulse' : showResults ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-slate-600'}`}></span>
                 TERMINAL_OUTPUT
              </span>
              {showResults && (
                 <div className="text-right">
                    <span className="text-xs text-slate-500 mr-2">總工時:</span>
                    <span className="text-xl font-mono font-black text-emerald-400">
                       {Math.floor(totalProductionTime / 60)}<span className="text-sm mx-1 text-slate-500">h</span>
                       {totalProductionTime % 60}<span className="text-sm mx-1 text-slate-500">m</span>
                    </span>
                 </div>
              )}
           </div>

           {/* Content */}
           <div ref={terminalRef} className="flex-1 overflow-y-auto p-8 font-mono text-base custom-scrollbar">
              
              {!isCalculating && !showResults && logs.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-40">
                    <div className="text-6xl mb-4">⌨️</div>
                    <div className="text-lg tracking-widest">READY TO CALCULATE</div>
                 </div>
              )}

              <div className="space-y-2 mb-8">
                 {logs.map((log, i) => (
                    <div key={i} className="text-emerald-500/90 break-all border-l-2 border-emerald-900/50 pl-3">{`> ${log}`}</div>
                 ))}
                 {isCalculating && <div className="text-emerald-500 animate-pulse font-bold text-xl">_</div>}
              </div>

              {showResults && (
                 <div className="animate-fade-in-up pb-10">
                    <table className="w-full text-left border-collapse border border-slate-800 rounded-lg overflow-hidden">
                       <thead className="bg-slate-800 text-sm text-slate-400 uppercase tracking-wider">
                          <tr>
                             <th className="p-4 border-b border-slate-700">Sequence / Operation</th>
                             <th className="p-4 border-b border-slate-700 text-right">Time (Min)</th>
                          </tr>
                       </thead>
                       <tbody className="text-base text-slate-300 divide-y divide-slate-800">
                          {results.map((r, i) => (
                             <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                                <td className="p-4">
                                   <div className="flex items-center gap-3">
                                      <span className="text-xs font-bold text-slate-600 w-6">{r.sequence}.</span>
                                      <div>
                                        <div className="font-bold text-white text-lg">{r.op_name}</div>
                                        <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                           <span>{r.station}</span>
                                           {r.is_plate_calc && <span className="text-emerald-500">[板材計價]</span>}
                                        </div>
                                      </div>
                                   </div>
                                </td>
                                <td className="p-4 text-right">
                                   <div className="font-mono font-bold text-emerald-400 text-xl">{r.total_min}</div>
                                   <div className="text-[10px] text-slate-600 font-mono mt-1">{r.formula}</div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
           </div>
        </div>

      </div>
    </div>
  )
}