'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({ id: '', password: '' })

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // 模擬驗證過程 (之後可接 Supabase Auth)
    setTimeout(() => {
      // 1. 設定 Cookie (通行證)，有效期設為 1 天
      document.cookie = "bardshop-token=authorized; path=/; max-age=86400; SameSite=Lax;"

      // 2. 🔥 強制重新整理並跳轉 (這是解決轉圈圈的關鍵)
      // 使用 router.push 有時會因為 Next.js 的快取導致 Middleware 沒讀到新 Cookie
      window.location.href = '/' 
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-300 font-sans selection:bg-cyan-500 selection:text-white relative flex flex-col items-center justify-center overflow-hidden">
      
      {/* 背景特效 */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-900/10 via-transparent to-slate-900/90"></div>
        <div className="absolute inset-0 opacity-[0.15]" 
             style={{ backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>
      </div>

      {/* 登入卡片 */}
      <div className="relative z-10 w-full max-w-md p-1">
        {/* 裝飾框線 */}
        <div className="absolute inset-0 border border-cyan-500/30 rounded-2xl blur-[2px]"></div>
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br-lg"></div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-white tracking-widest mb-2">BARDSHOP</h1>
            <p className="text-xs text-cyan-400 font-mono tracking-[0.4em] uppercase">Enterprise Portal</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Employee ID</label>
              <div className="relative group">
                <input 
                  type="text" 
                  required
                  className="w-full bg-slate-950/50 border border-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all font-mono"
                  placeholder="BARD-001"
                  value={formData.id}
                  onChange={e => setFormData({...formData, id: e.target.value})}
                />
                <div className="absolute inset-0 border border-cyan-500/0 rounded-lg group-hover:border-cyan-500/20 pointer-events-none transition-all"></div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Password</label>
              <input 
                type="password" 
                required
                className="w-full bg-slate-950/50 border border-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all font-mono tracking-widest"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className={`
                w-full py-4 rounded-lg font-bold text-sm tracking-widest uppercase transition-all duration-300 relative overflow-hidden group
                ${isLoading ? 'bg-cyan-900 text-cyan-400 cursor-not-allowed' : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-900/50'}
              `}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Authenticating...
                </span>
              ) : (
                <>
                  <span className="relative z-10">System Login</span>
                  <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-slate-600 font-mono">
              SECURE CONNECTION ESTABLISHED<br/>
              V2.1.0 • BARDSHOP INC.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}