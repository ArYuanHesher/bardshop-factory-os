'use client'

import Link from 'next/link'

export default function AdminDashboard() {
  const menuItems = [
    // --- Group 1: 日常作業 (Operations) ---
    {
      title: '每日發單作業',
      desc: 'Daily Operations',
      href: '/admin/daily',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
      ),
      color: 'text-emerald-400',
      bgHover: 'hover:bg-emerald-950/30',
      border: 'hover:border-emerald-500/50',
      group: 'OPERATIONS'
    },
    {
      title: '發單歷史紀錄',
      desc: 'Order History Logs',
      href: '/admin/history',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      ),
      color: 'text-purple-400',
      bgHover: 'hover:bg-purple-950/30',
      border: 'hover:border-purple-500/50',
      group: 'OPERATIONS'
    },
    
    // --- Group 2: 系統核心 (System Core) ---
    {
      title: '工序母資料庫',
      desc: 'Database & Routes',
      href: '/admin/database',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
      ),
      color: 'text-cyan-400',
      bgHover: 'hover:bg-cyan-950/30',
      border: 'hover:border-cyan-500/50',
      group: 'SYSTEM'
    },
    {
      title: '成員權限管理',
      desc: 'Member & Access Control',
      href: '/admin/team',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      ),
      color: 'text-orange-400',
      bgHover: 'hover:bg-orange-950/30',
      border: 'hover:border-orange-500/50',
      group: 'SYSTEM'
    }
  ]

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-300 p-8 flex flex-col items-center">
      
      {/* 容器寬度擴展至 1600px，利用空間分散排版 */}
      <div className="w-full max-w-[1600px]">
        
        {/* Header 區域 */}
        <div className="flex justify-between items-end mb-12 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">管理核心</h1>
            <p className="text-purple-500 font-mono tracking-widest uppercase text-sm">
              ADMINISTRATION CORE
            </p>
          </div>
          <Link href="/" className="px-6 py-2 rounded border border-slate-700 hover:bg-slate-800 hover:text-white transition-colors text-sm font-mono tracking-wide">
            &larr; BACK TO EIP
          </Link>
        </div>

        {/* 卡片 Grid 區域 */}
        {/* md:grid-cols-2 -> 平板時 2x2
            xl:grid-cols-4 -> 大螢幕時 1x4 (一字排開，充分分散)
            gap-8 -> 增加間距，讓畫面不擁擠
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
          {menuItems.map((item, idx) => (
            <Link 
              key={idx} 
              href={item.href} 
              className={`
                group relative bg-slate-900/40 border border-slate-700/60 rounded-2xl p-8 
                flex flex-col gap-6 transition-all duration-300 
                hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 
                ${item.border} ${item.bgHover}
                backdrop-blur-sm
              `}
            >
              {/* 分組標籤 */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className={`text-[10px] font-mono tracking-widest px-2 py-1 rounded border ${item.color.replace('text-', 'border-').replace('400', '500/30')} ${item.color.replace('text-', 'bg-').replace('400', '900/20')}`}>
                  {item.group}
                </span>
              </div>

              {/* Icon 容器 */}
              <div className={`p-4 rounded-xl bg-slate-950 w-fit shadow-lg ${item.color}`}>
                {item.icon}
              </div>
              
              {/* 文字內容 */}
              <div className="mt-2">
                <h2 className="text-2xl font-bold text-white mb-2 group-hover:tracking-wide transition-all">{item.title}</h2>
                <p className="text-sm text-slate-500 font-mono">{item.desc}</p>
              </div>

              {/* 底部裝飾 */}
              <div className="mt-auto pt-6 flex items-center justify-between border-t border-white/5 group-hover:border-white/10 transition-colors">
                 <div className={`h-1 w-12 rounded-full bg-current opacity-20 group-hover:w-full transition-all duration-500 ${item.color}`}></div>
                 <span className={`text-xs font-mono opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all ${item.color}`}>
                   ACCESS &rarr;
                 </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}