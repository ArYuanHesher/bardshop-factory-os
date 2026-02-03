'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // 定義按鈕與色系
  const navItems = [
    // --- Group 1: 母資料管理 (藍色系 - 資料核心) ---
    { 
      name: '工序總表更新', 
      path: '/admin/upload', 
      theme: 'blue',
      icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' 
    },
    { 
      name: '工序總表查詢', 
      path: '/admin/database', 
      theme: 'blue',
      icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' 
    },

    // --- Group 2: 每日作業 (青色系 - 執行與紀錄) ---
    { 
      name: '每日訂單作業', 
      path: '/admin/daily', 
      theme: 'cyan', // 改為 cyan 更符合首頁色調
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' 
    },
    { 
      name: '發單紀錄總表', 
      path: '/admin/history', 
      theme: 'cyan',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' 
    },

    // --- Group 3: 監控 (紫色系 - 數據分析) ---
    { 
      name: '產程監控表', 
      path: '/admin/schedule', 
      theme: 'purple',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' 
    },

    // --- Group 4: 人員 (橘色系 - 管理權限) ---
    { 
      name: '組織成員管理', 
      path: '/admin/team', 
      theme: 'orange',
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' 
    },
  ]

  // 輔助函式：根據主題回傳樣式 (深色模式版)
  const getThemeClasses = (theme: string, isActive: boolean) => {
    // 基礎樣式：更深邃的背景，文字帶有科技感
    const base = "flex items-center gap-2 px-4 py-2 rounded border transition-all duration-300 whitespace-nowrap font-mono text-sm tracking-wide"
    
    // 顏色定義 (Dark Mode Glow Effects)
    const colors: Record<string, any> = {
      blue: {
        active: "bg-blue-950/40 text-blue-400 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]",
        inactive: "bg-transparent text-slate-400 border-transparent hover:bg-blue-950/20 hover:text-blue-300 hover:border-blue-500/30"
      },
      cyan: {
        active: "bg-cyan-950/40 text-cyan-400 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]",
        inactive: "bg-transparent text-slate-400 border-transparent hover:bg-cyan-950/20 hover:text-cyan-300 hover:border-cyan-500/30"
      },
      purple: {
        active: "bg-purple-950/40 text-purple-400 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]",
        inactive: "bg-transparent text-slate-400 border-transparent hover:bg-purple-950/20 hover:text-purple-300 hover:border-purple-500/30"
      },
      orange: {
        active: "bg-orange-950/40 text-orange-400 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]",
        inactive: "bg-transparent text-slate-400 border-transparent hover:bg-orange-950/20 hover:text-orange-300 hover:border-orange-500/30"
      }
    }

    const themeStyle = colors[theme] || colors['blue']
    return `${base} ${isActive ? themeStyle.active : themeStyle.inactive}`
  }

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-300 font-sans selection:bg-cyan-500 selection:text-white relative">
      
      {/* --- 全域背景特效 (與首頁一致) --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100 contrast-150"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-900/10 via-transparent to-slate-950/90"></div>
        {/* 深色網格背景 */}
        <div className="absolute inset-0 opacity-[0.15]" 
             style={{ 
               backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)', 
               backgroundSize: '40px 40px' 
             }}>
        </div>
      </div>

      {/* --- 頂部戰術導航列 (HUD Style) --- */}
      <div className="sticky top-0 z-50 bg-[#050b14]/80 backdrop-blur-md border-b border-slate-800 shadow-lg shadow-black/50">
        <div className="w-full px-4 md:px-6"> 
          
          <div className="flex flex-col xl:flex-row items-center justify-start py-3 gap-4 xl:gap-8">
            
            {/* 左側：控制區 (Home / Back) */}
            <div className="flex items-center gap-3 w-full xl:w-auto shrink-0 border-b xl:border-b-0 border-slate-800/50 pb-3 xl:pb-0">
              <Link 
                href="/"
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900/80 border border-slate-700 text-cyan-500 hover:bg-cyan-950 hover:border-cyan-500 hover:text-cyan-400 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all group"
                title="回到入口大廳"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              </Link>

              <button 
                onClick={() => router.back()}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-500 hover:text-white transition-all"
                title="回上一頁"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              
              {/* 裝飾性分隔線與標籤 */}
              <div className="h-8 w-px bg-slate-800 mx-2 hidden xl:block"></div>
              
              <div className="hidden sm:flex flex-col justify-center shrink-0">
                <div className="text-white font-bold text-xs tracking-[0.2em]">CONSOLE</div>
                <div className="text-[10px] text-cyan-500/60 font-mono">V2.0 ONLINE</div>
              </div>
            </div>

            {/* 右側：功能導航 (霓虹按鈕) */}
            <nav className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full xl:w-auto mask-linear-fade">
              {navItems.map((item) => {
                const isActive = pathname === item.path
                return (
                  <Link 
                    key={item.path}
                    href={item.path}
                    className={getThemeClasses(item.theme, isActive)}
                  >
                    <svg className={`w-4 h-4 ${isActive ? 'animate-pulse' : 'opacity-70'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </nav>

          </div>
        </div>
      </div>

      {/* --- 主要內容區 --- */}
      {/* 這裡使用 relative z-10 確保內容浮在網格背景之上 */}
      <main className="relative z-10 min-h-[calc(100vh-70px)] p-4 md:p-6">
        {children}
      </main>

    </div>
  )
}