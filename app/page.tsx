'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function LandingPage() {
  const router = useRouter()
  const [time, setTime] = useState('')
  const [isHovered, setIsHovered] = useState<'none' | 'production' | 'admin'>('none')
  
  // 公告相關狀態
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [currentAnnoIndex, setCurrentAnnoIndex] = useState(0)
  const [showModal, setShowModal] = useState(false) // 控制詳情視窗

  // 時間跳動
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 讀取公告
  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data } = await supabase
        .from('system_announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (data && data.length > 0) {
        setAnnouncements(data)
      }
    }
    fetchAnnouncements()
  }, [])

  // 公告輪播
  useEffect(() => {
    if (announcements.length <= 1 || showModal) return // 如果打開詳情就不輪播
    const interval = setInterval(() => {
      setCurrentAnnoIndex((prev) => (prev + 1) % announcements.length)
    }, 5000) 
    return () => clearInterval(interval)
  }, [announcements, showModal])

  const handleLogout = () => {
    document.cookie = "bardshop-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;"
    router.push('/login')
  }

  // 取得當前顯示的公告
  const currentAnnouncement = announcements[currentAnnoIndex]

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-300 font-sans selection:bg-cyan-500 selection:text-white relative overflow-hidden flex flex-col items-center justify-center">
      
      {/* --- 背景特效 --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-900/10 via-transparent to-slate-900/80"></div>
        <div className="absolute inset-0 opacity-20" 
             style={{ 
               backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)', 
               backgroundSize: '50px 50px' 
             }}>
        </div>
      </div>

      {/* --- 左上角：公告顯示區 (卷軸式) --- */}
      {currentAnnouncement && (
        <div className="absolute top-6 left-6 z-40 max-w-[280px] md:max-w-sm animate-fade-in-right">
          <div 
            onClick={() => setShowModal(true)}
            className="group cursor-pointer bg-slate-900/60 backdrop-blur-md border border-orange-500/30 rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-orange-500/60 transition-all hover:translate-x-1"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">System Notice</span>
              {announcements.length > 1 && (
                <span className="text-[10px] text-slate-500 ml-auto font-mono">
                  {currentAnnoIndex + 1}/{announcements.length}
                </span>
              )}
            </div>
            
            <h3 className="text-white font-bold text-sm mb-1 truncate group-hover:text-orange-300 transition-colors">
              {currentAnnouncement.title}
            </h3>
            
            {/* 限制顯示兩行 (line-clamp-2) */}
            <p className="text-xs text-slate-400 font-mono leading-relaxed line-clamp-2">
              {currentAnnouncement.content || '點擊查看詳情...'}
            </p>

            <div className="mt-2 text-[10px] text-slate-600 group-hover:text-slate-500">
              Click to expand &rarr;
            </div>
          </div>
        </div>
      )}

      {/* 右上角登出按鈕 */}
      <div className="absolute top-6 right-6 z-40">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 border border-slate-700 rounded-full text-xs font-mono text-slate-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-950/20 transition-all backdrop-blur-sm bg-slate-900/30"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          LOGOUT
        </button>
      </div>

      {/* --- 中央內容區 --- */}
      <div className="relative z-10 w-full max-w-7xl px-6 flex flex-col items-center">
        
        {/* LOGO & Header */}
        <div className="text-center mb-16 animate-fade-in-down flex flex-col items-center">
          <div className="inline-block px-4 py-1 border border-cyan-500/30 rounded-full bg-cyan-950/30 text-cyan-400 text-xs tracking-[0.3em] uppercase mb-6 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            Authorized Access
          </div>
          
          <h1 className="flex flex-col items-center font-black text-white tracking-tight leading-none mb-6">
            <span className="text-5xl md:text-7xl mb-2 tracking-widest text-slate-500">BARDSHOP</span>
            <div className="relative text-6xl md:text-8xl">
              EIP<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">.SYSTEM</span>
              <span className="absolute -top-1 -right-4 w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
            </div>
          </h1>

          <p className="text-slate-500 text-sm md:text-lg font-mono tracking-[0.2em] uppercase mb-8">
            Enterprise Information Portal
          </p>
          
          <div className="font-mono text-5xl md:text-7xl text-slate-400 font-bold tabular-nums tracking-wider drop-shadow-lg text-cyan-500/80">
            {time}
          </div>
        </div>

        {/* 雙入口選擇器 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          
          {/* 左側：產線看板 */}
          <Link href="/admin/schedule" 
            onMouseEnter={() => setIsHovered('production')}
            onMouseLeave={() => setIsHovered('none')}
            className={`
              group relative h-64 md:h-80 rounded-2xl border border-slate-700 bg-slate-900/40 backdrop-blur-sm 
              flex flex-col items-center justify-center text-center p-8 transition-all duration-500 cursor-pointer
              hover:border-cyan-500 hover:bg-slate-800/60 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]
              ${isHovered === 'admin' ? 'opacity-50 scale-95 blur-[2px]' : 'opacity-100'}
            `}
          >
            <div className="mb-6 p-4 rounded-full bg-slate-800 group-hover:bg-cyan-900/50 text-slate-400 group-hover:text-cyan-400 transition-colors">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">產線看板</h2>
            <p className="text-slate-500 text-sm mb-6 max-w-xs group-hover:text-slate-300">
              即時生產進度與工單狀態。<br/>(View Production Status)
            </p>
            <span className="px-6 py-2 rounded border border-slate-600 text-slate-300 text-sm font-mono group-hover:bg-cyan-600 group-hover:border-cyan-600 group-hover:text-white transition-all">
              ENTER SYSTEM &rarr;
            </span>
          </Link>

          {/* 右側：管理核心 */}
          <Link href="/admin"
            onMouseEnter={() => setIsHovered('admin')}
            onMouseLeave={() => setIsHovered('none')}
            className={`
              group relative h-64 md:h-80 rounded-2xl border border-slate-700 bg-slate-900/40 backdrop-blur-sm 
              flex flex-col items-center justify-center text-center p-8 transition-all duration-500 cursor-pointer
              hover:border-purple-500 hover:bg-slate-800/60 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]
              ${isHovered === 'production' ? 'opacity-50 scale-95 blur-[2px]' : 'opacity-100'}
            `}
          >
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 rounded border border-purple-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></div>
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Manager</span>
            </div>

            <div className="mb-6 p-4 rounded-full bg-slate-800 group-hover:bg-purple-900/50 text-slate-400 group-hover:text-purple-400 transition-colors">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">管理核心</h2>
            <p className="text-slate-500 text-sm mb-6 max-w-xs group-hover:text-slate-300">
              母資料設定、訂單計算與人員管理。<br/>(Admin Console)
            </p>
            <span className="px-6 py-2 rounded border border-slate-600 text-slate-300 text-sm font-mono group-hover:bg-purple-600 group-hover:border-purple-600 group-hover:text-white transition-all">
              ACCESS CONSOLE &rarr;
            </span>
          </Link>

        </div>
        
        <div className="mt-16 text-center opacity-40 hover:opacity-100 transition-opacity">
           <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2">BARDSHOP INC. • INTERNAL USE ONLY</p>
           <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-slate-600 to-transparent mx-auto"></div>
        </div>

      </div>

      {/* --- 公告詳情 Modal (彈出視窗) --- */}
      {showModal && currentAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
              <h3 className="text-white font-bold flex items-center gap-2">
                <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                系統公告 (System Notice)
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="text-xs text-slate-500 font-mono mb-4">
                發布時間: {new Date(currentAnnouncement.created_at).toLocaleString()}
              </div>
              <h2 className="text-2xl font-bold text-orange-400 mb-4">{currentAnnouncement.title}</h2>
              <div className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm">
                {currentAnnouncement.content || "無詳細內容"}
              </div>
            </div>

            {/* Modal Footer (如果有上一則/下一則可以放這裡) */}
            {announcements.length > 1 && (
              <div className="bg-slate-800/50 p-3 flex justify-between border-t border-slate-700">
                <button 
                  onClick={() => setCurrentAnnoIndex(prev => (prev - 1 + announcements.length) % announcements.length)}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1 hover:bg-slate-700 rounded"
                >
                  &larr; Prev
                </button>
                <span className="text-xs text-slate-500 font-mono py-1">
                  {currentAnnoIndex + 1} / {announcements.length}
                </span>
                <button 
                  onClick={() => setCurrentAnnoIndex(prev => (prev + 1) % announcements.length)}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1 hover:bg-slate-700 rounded"
                >
                  Next &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}