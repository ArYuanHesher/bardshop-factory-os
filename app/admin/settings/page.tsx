'use client'

import Link from 'next/link'
import { NavButton } from '../../../components/NavButton'

export default function SystemSettingsHomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-10">
      <div className="w-full max-w-[1400px] px-6 space-y-8">
        <div className="flex items-end justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">系統設定</h1>
            <p className="text-orange-500 font-mono tracking-widest uppercase text-sm">SYSTEM SETTINGS</p>
          </div>
          <NavButton href="/" direction="home" title="返回首頁" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Link
            href="/admin/team"
            className="group relative bg-slate-900/40 border border-slate-700/60 rounded-2xl p-8 flex flex-col gap-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 hover:border-orange-500/50 hover:bg-orange-950/20 backdrop-blur-sm"
          >
            <div className="p-4 rounded-xl bg-slate-950 w-fit shadow-lg text-orange-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-orange-300 transition-colors">組織成員設定</h2>
              <p className="text-sm text-slate-400 font-mono">Organization Members</p>
            </div>

            <div className="mt-auto pt-6 flex items-center justify-between border-t border-white/5 group-hover:border-white/10 transition-colors">
              <div className="h-1 w-12 rounded-full opacity-30 group-hover:w-full transition-all duration-500 bg-orange-400"></div>
              <span className="text-xs font-mono opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-white">
                ENTER →
              </span>
            </div>
          </Link>

          <Link
            href="/admin/settings/announcements"
            className="group relative bg-slate-900/40 border border-slate-700/60 rounded-2xl p-8 flex flex-col gap-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 hover:border-orange-500/50 hover:bg-orange-950/20 backdrop-blur-sm"
          >
            <div className="p-4 rounded-xl bg-slate-950 w-fit shadow-lg text-orange-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-orange-300 transition-colors">公告設定</h2>
              <p className="text-sm text-slate-400 font-mono">Announcements</p>
            </div>

            <div className="mt-auto pt-6 flex items-center justify-between border-t border-white/5 group-hover:border-white/10 transition-colors">
              <div className="h-1 w-12 rounded-full opacity-30 group-hover:w-full transition-all duration-500 bg-orange-400"></div>
              <span className="text-xs font-mono opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-white">
                ENTER →
              </span>
            </div>
          </Link>

          <Link
            href="/admin/system-logs"
            className="group relative bg-slate-900/40 border border-slate-700/60 rounded-2xl p-8 flex flex-col gap-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 hover:border-orange-500/50 hover:bg-orange-950/20 backdrop-blur-sm"
          >
            <div className="p-4 rounded-xl bg-slate-950 w-fit shadow-lg text-orange-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-orange-300 transition-colors">系統 LOG</h2>
              <p className="text-sm text-slate-400 font-mono">System Audit Logs</p>
            </div>
            <div className="mt-auto pt-6 flex items-center justify-between border-t border-white/5 group-hover:border-white/10 transition-colors">
              <div className="h-1 w-12 rounded-full opacity-30 group-hover:w-full transition-all duration-500 bg-orange-400"></div>
              <span className="text-xs font-mono opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-white">
                ENTER →
              </span>
            </div>
          </Link>
        {/* LOG監控大型入口看板連結已移除 */}
        </div>
      </div>
    </div>
  )
}
