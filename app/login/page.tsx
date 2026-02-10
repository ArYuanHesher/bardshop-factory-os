'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient' // 引入 Supabase

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')
    
    try {
      // 1. 去資料庫找這個人 (直接查 members 表)
      const { data: member, error } = await supabase
        .from('members')
        .select('email, password, real_name')
        .eq('email', formData.email)
        .single()

      if (error || !member) {
        throw new Error('找不到此帳號，請確認 Email 是否正確')
      }

      // 2. 檢查密碼 (注意：這裡直接比對明碼，需確保資料庫內的密碼也是明碼)
      // 如果資料庫密碼是 123456，這裡輸入 123456 就會過
      if (String(member.password) !== String(formData.password)) {
        throw new Error('密碼錯誤')
      }

      // 3. 登入成功：儲存使用者資訊到瀏覽器
      // 🔥 關鍵步驟：把 Email 存起來，讓其他頁面知道是誰登入的
      localStorage.setItem('bardshop_user_email', member.email)
      localStorage.setItem('bardshop_user_name', member.real_name)

      // 4. 設定 Cookie (給 Middleware 過路檢察用)
      document.cookie = `bardshop-token=authorized; path=/; max-age=86400; SameSite=Lax;`

      // 5. 轉址進首頁
      // 使用 router.push 比 window.location.href 更平滑
      router.push('/')

    } catch (err: any) {
      setErrorMsg(err.message || '登入失敗')
      setIsLoading(false)
    }
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
        <div className="absolute inset-0 border border-cyan-500/30 rounded-2xl blur-[2px]"></div>
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg"></div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br-lg"></div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-white tracking-widest mb-2">BARDSHOP</h1>
            <p className="text-xs text-cyan-400 font-mono tracking-[0.4em] uppercase">Enterprise Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Email Account</label>
              <div className="relative group">
                <input 
                  type="email" 
                  required
                  className="w-full bg-slate-950/50 border border-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all font-mono"
                  placeholder="admin@bardshop.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
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

            {errorMsg && (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-xs text-center font-bold animate-pulse">
                {errorMsg}
              </div>
            )}

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
                  Verifying...
                </span>
              ) : (
                <span className="relative z-10">Login System</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}