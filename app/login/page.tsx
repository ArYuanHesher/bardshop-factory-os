'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient' // 引入 Supabase

const REMEMBER_EMAIL_KEY = 'bardshop_remember_email'

const isMissingAuthUserIdColumnError = (error: { message?: string } | null | undefined) =>
  Boolean(error?.message?.includes('auth_user_id'))

const normalizeLegacyPermissions = (rawPermissions: string[] = []) => {
  const normalized = new Set<string>()

  rawPermissions.forEach((permission) => {
    if (permission === 'production') normalized.add('dashboard')
    else if (permission === 'admin') {
      normalized.add('production_admin')
      normalized.add('system_settings')
    } else normalized.add(permission)
  })

  return Array.from(normalized)
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [rememberMe, setRememberMe] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY)
    if (rememberedEmail) {
      setFormData(prev => ({ ...prev, email: rememberedEmail }))
      setRememberMe(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')
    
    try {
      // 1. 去資料庫找這個人 (直接查 members 表)
      const { data: member, error } = await supabase
        .from('members')
        .select('id, auth_user_id, email, password, real_name, is_admin, permissions')
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

      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, member.email)
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY)
      }

      // 4. 設定 Cookie (給 Middleware 過路檢察用)
      document.cookie = `bardshop-token=authorized; path=/; max-age=86400; SameSite=Lax;`
      const finalPermissions = Boolean(member.is_admin)
        ? ['dashboard', 'notice', 'estimation', 'tasks', 'qa', 'production_admin', 'system_settings']
        : normalizeLegacyPermissions(Array.isArray(member.permissions) ? member.permissions : [])

      const isAdminRole =
        Boolean(member.is_admin) ||
        finalPermissions.includes('production_admin')

      const role = isAdminRole ? 'admin' : 'ops'
      document.cookie = `bardshop-role=${role}; path=/; max-age=86400; SameSite=Lax;`
      document.cookie = `bardshop-permissions=${encodeURIComponent(finalPermissions.join(','))}; path=/; max-age=86400; SameSite=Lax;`

      // 4-1. 盡力將 members 綁定 auth_user_id（有 Supabase Auth session 時才會生效）
      try {
        const { data: authData } = await supabase.auth.getUser()
        const authUserId = authData.user?.id

        if (authUserId && member.id && member.auth_user_id !== authUserId) {
          const { error: syncError } = await supabase
            .from('members')
            .update({ auth_user_id: authUserId })
            .eq('id', member.id)

          if (syncError && !isMissingAuthUserIdColumnError(syncError)) {
            console.warn('回寫 auth_user_id 失敗:', syncError.message)
          }
        }
      } catch {
        // ignore sync errors to avoid affecting login flow
      }

      // 5. 轉址進首頁
      // 使用 router.push 比 window.location.href 更平滑
      router.push('/')

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '登入失敗'
      setErrorMsg(errorMessage)
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

            <label className="flex items-center gap-2 text-sm text-slate-400 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
              />
              記住我
            </label>

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

            <div className="text-center">
              <Link
                href="/apply-account"
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
              >
                沒有帳號？申請帳號
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}