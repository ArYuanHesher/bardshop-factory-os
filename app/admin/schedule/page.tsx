'use client'

import Link from 'next/link'

const CATEGORIES = [
  {
    id: 'printing',
    name: '印刷產程',
    eng: 'Printing Schedule',
    desc: 'UV直噴、熱昇華、數位印刷排程監控',
    color: 'from-blue-600 to-cyan-600',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2.4-9h6.2M6 13h2m0 0l-.867 12.142A2 2 0 015.138 21H3.862a2 2 0 01-1.995-1.858L3 7m2 6h14m-2 0l.867 12.142A2 2 0 0018.862 21h1.276a2 2 0 001.995-1.858L21 7" /></svg>
    )
  },
  {
    id: 'laser',
    name: '雷切產程',
    eng: 'Laser Cutting',
    desc: '雷射切割、板材裁切與雕刻進度',
    color: 'from-red-600 to-rose-600',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    )
  },
  {
    id: 'post',
    name: '後加工產程',
    eng: 'Post Processing',
    desc: '壓克力貼合、配件組裝、打磨',
    color: 'from-purple-600 to-violet-600',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
    )
  },
  {
    id: 'packing',
    name: '包裝產程',
    eng: 'Packaging',
    desc: '產品包裝、貼標、出貨前準備',
    color: 'from-orange-500 to-amber-500',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
    )
  },
  {
    id: 'outsourced',
    name: '委外產程',
    eng: 'Outsourced',
    desc: '外部廠商加工進度、轉運站追蹤',
    color: 'from-slate-600 to-gray-500',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
    )
  },
  {
    id: 'changping',
    name: '常平產程',
    eng: 'Changping Factory',
    desc: '常平廠區專屬生產與進度追蹤',
    color: 'from-emerald-600 to-teal-600',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )
  },
]

export default function SchedulePortalPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col justify-center">
      
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">產程總表入口</h1>
        <p className="text-slate-400 font-mono uppercase tracking-widest">
          PRODUCTION MASTER SCHEDULE // 請選擇要檢視的生產站點
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CATEGORIES.map((cat) => (
          <Link 
            key={cat.id} 
            href={`/admin/schedule/${cat.id}`}
            className="group relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-600 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 block"
          >
            {/* 背景光暈特效 */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${cat.color} opacity-20 blur-3xl group-hover:opacity-30 transition-opacity rounded-full -translate-y-1/2 translate-x-1/2`}></div>
            
            <div className="p-8 relative z-10 h-full flex flex-col">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300`}>
                {cat.icon}
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                {cat.name}
              </h2>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-4">
                {cat.eng}
              </p>
              
              <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-1">
                {cat.desc}
              </p>

              <div className="flex items-center text-sm font-bold text-slate-500 group-hover:text-white transition-colors">
                <span>進入排程表</span>
                <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}