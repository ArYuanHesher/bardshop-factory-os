'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

interface Announcement {
  id: number
  title: string
  content: string | null
  is_active: boolean
  created_at: string
}

interface CurrentUserProfile {
  real_name: string
  department: string
  email: string
  permissions: string[]
  is_admin: boolean
}

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

export default function LandingPage() {
  const router = useRouter()
  const [time, setTime] = useState('')
  // 🔥 新增 'tasks' 狀態
  const [isHovered, setIsHovered] = useState<'none' | 'production' | 'admin' | 'estimation' | 'tasks' | 'qa' | 'settings' | 'notice' | 'finance'>('none')
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [currentAnnoIndex, setCurrentAnnoIndex] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null)
  const [memberPermissions, setMemberPermissions] = useState<string[]>([])

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: authData } = await supabase.auth.getUser()
      const authUserId = authData.user?.id || ''
      const email = authData.user?.email || localStorage.getItem('bardshop_user_email') || ''
      if (!email) return

      let memberData: {
        real_name: string | null
        department: string | null
        email: string | null
        permissions: string[] | null
        is_admin: boolean | null
      } | null = null

      if (authUserId) {
        const { data } = await supabase
          .from('members')
          .select('real_name, department, email, permissions, is_admin')
          .eq('auth_user_id', authUserId)
          .maybeSingle()
        memberData = data
      }

      if (!memberData) {
        const { data } = await supabase
          .from('members')
          .select('real_name, department, email, permissions, is_admin')
          .eq('email', email)
          .maybeSingle()
        memberData = data
      }

      if (memberData) {
        const normalizedPermissions = Boolean(memberData.is_admin)
          ? ['dashboard', 'notice', 'estimation', 'tasks', 'qa', 'production_admin', 'system_settings']
          : normalizeLegacyPermissions(Array.isArray(memberData.permissions) ? memberData.permissions : [])

        setMemberPermissions(normalizedPermissions)
        setCurrentUser({
          real_name: memberData.real_name || '-',
          department: memberData.department || '-',
          email: memberData.email || email,
          permissions: normalizedPermissions,
          is_admin: Boolean(memberData.is_admin),
        })
        return
      }

      setMemberPermissions([])
      setCurrentUser({
        real_name: '-',
        department: '-',
        email,
        permissions: [],
        is_admin: false,
      })
    }

    void fetchCurrentUser()
  }, [])

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data } = await supabase
        .from('system_announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (data && data.length > 0) {
        setAnnouncements(data as Announcement[])
      }
    }
    fetchAnnouncements()
  }, [])

  useEffect(() => {
    if (announcements.length <= 1 || showModal) return 
    const interval = setInterval(() => {
      setCurrentAnnoIndex((prev) => (prev + 1) % announcements.length)
    }, 5000) 
    return () => clearInterval(interval)
  }, [announcements, showModal])

  const handleLogout = () => {
    document.cookie = "bardshop-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;"
    document.cookie = "bardshop-role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;"
    document.cookie = "bardshop-permissions=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;"
    router.push('/login')
  }

  const currentAnnouncement = announcements[currentAnnoIndex]
  const hasFeaturePermission = (permissionKey: string) => {
    if (currentUser?.is_admin) return true
    return memberPermissions.includes(permissionKey)
  }

  const guardFeatureAccess = (permissionKey: string, featureName: string) => {
    if (hasFeaturePermission(permissionKey)) return undefined
    return (event: React.MouseEvent) => {
      event.preventDefault()
      alert(`你目前沒有「${featureName}」權限，請聯絡核心管理員。`)
    }
  }

  const canDashboard = hasFeaturePermission('dashboard')
  const canEstimation = hasFeaturePermission('estimation')
  const canTasks = hasFeaturePermission('tasks')
  const canProductionAdmin = hasFeaturePermission('production_admin')
  const canSystemSettings = hasFeaturePermission('system_settings')
  const canQa = hasFeaturePermission('qa')

  return (
    <div className="h-screen bg-[#050b14] text-slate-300 font-sans selection:bg-cyan-500 selection:text-white relative overflow-hidden flex flex-col items-center justify-center">
      
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

      {/* --- 左上角：公告顯示區 --- */}
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
            
            <p className="text-xs text-slate-400 font-mono leading-relaxed line-clamp-2">
              {currentAnnouncement.content || '點擊查看詳情...'}
            </p>

            <div className="mt-2 text-[10px] text-slate-600 group-hover:text-slate-500">
              Click to expand &rarr;
            </div>
          </div>
        </div>
      )}

      {/* 右上角：時間 + 登出 */}
      <div className="absolute top-6 right-6 z-40 flex flex-col items-end gap-3">
        <div className="font-mono text-2xl md:text-3xl text-cyan-500/80 font-bold tabular-nums tracking-wider">
          {time}
        </div>
        {currentUser && (
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-right backdrop-blur-sm min-w-[220px]">
            <div className="text-sm font-bold text-white leading-tight">{currentUser.real_name}</div>
            <div className="text-xs text-cyan-400 leading-tight">{currentUser.department}</div>
            <div className="text-[11px] text-slate-400 font-mono leading-tight mt-1">{currentUser.email}</div>
          </div>
        )}
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 border border-slate-700 rounded-full text-xs font-mono text-slate-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-950/20 transition-all backdrop-blur-sm bg-slate-900/30"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          LOGOUT
        </button>
      </div>

      {/* --- 中央內容區 --- */}
      <div className="relative z-10 w-full max-w-[1400px] px-6 flex flex-col items-center">
        
        {/* LOGO & Header */}
        <div className="text-center mb-8 animate-fade-in-down flex flex-col items-center">
          <div className="inline-block px-4 py-1 border border-cyan-500/30 rounded-full bg-cyan-950/30 text-cyan-400 text-xs tracking-[0.3em] uppercase mb-6 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            Authorized Access
          </div>
          
          <h1 className="flex flex-col items-center font-black text-white tracking-tight leading-none mb-6">
            <span className="text-4xl md:text-6xl mb-2 tracking-widest text-slate-500">BARDSHOP</span>
            <div className="relative text-5xl md:text-7xl">
              EIP<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">.SYSTEM</span>
              <span className="absolute -top-1 -right-4 w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
            </div>
          </h1>

          <p className="text-slate-500 text-xs md:text-base font-mono tracking-[0.2em] uppercase mb-4">
            Enterprise Information Portal
          </p>
        </div>

        {/* 🔥 四入口選擇器 (Grid 調整為 2x2 或 4欄) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          
          {/* 1. 產線看板 (Cyan) */}
          <Link href="/dashboard" 
            onClick={guardFeatureAccess('dashboard', '產線看板')}
            onMouseEnter={() => setIsHovered('production')}
            onMouseLeave={() => setIsHovered('none')}
            className={`
              group relative order-1 h-52 md:h-60 lg:h-64 rounded-2xl border border-slate-700 bg-slate-900/40 backdrop-blur-sm 
              flex flex-col items-center justify-center text-center p-6 transition-all duration-500 cursor-pointer
              hover:border-cyan-500 hover:bg-slate-800/60 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]
              ${canDashboard ? '' : 'opacity-50 grayscale'}
              ${isHovered !== 'none' && isHovered !== 'production' ? 'opacity-50 scale-95 blur-[2px]' : 'opacity-100'}
            `}
          >
            <div className="mb-6 p-4 rounded-full bg-slate-800 group-hover:bg-cyan-900/50 text-slate-400 group-hover:text-cyan-400 transition-colors">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">產線看板</h2>
            <p className="text-slate-500 text-xs mb-6 group-hover:text-slate-300 px-2">
              即時生產進度與狀態。<br/>(Dashboard)
            </p>
            <span className="px-4 py-2 rounded border border-slate-600 text-slate-300 text-xs font-mono group-hover:bg-cyan-600 group-hover:border-cyan-600 group-hover:text-white transition-all">
              ENTER SYSTEM &rarr;
            </span>
          </Link>

          {/* 2. 時間試算 (Emerald) */}
          <Link href="/estimation"
            onClick={guardFeatureAccess('estimation', '時間試算')}
            onMouseEnter={() => setIsHovered('estimation')}
            onMouseLeave={() => setIsHovered('none')}
            className={`
              group relative order-5 h-52 md:h-60 lg:h-64 rounded-2xl border border-slate-700 bg-slate-900/40 backdrop-blur-sm 
              flex flex-col items-center justify-center text-center p-6 transition-all duration-500 cursor-pointer
              hover:border-emerald-500 hover:bg-slate-800/60 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]
              ${canEstimation ? '' : 'opacity-50 grayscale'}
              ${isHovered !== 'none' && isHovered !== 'estimation' ? 'opacity-50 scale-95 blur-[2px]' : 'opacity-100'}
            `}
          >
            <div className="mb-6 p-4 rounded-full bg-slate-800 group-hover:bg-emerald-900/50 text-slate-400 group-hover:text-emerald-400 transition-colors">
               <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
               </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">時間試算</h2>
            <p className="text-slate-500 text-xs mb-6 group-hover:text-slate-300 px-2">
              生產週期評估與計算。<br/>(Estimator)
            </p>
            <span className="px-4 py-2 rounded border border-slate-600 text-slate-300 text-xs font-mono group-hover:bg-emerald-600 group-hover:border-emerald-600 group-hover:text-white transition-all">
              CALCULATE &rarr;
            </span>
          </Link>

          {/* 🔥 3. 任務看板 (New - Blue) */}
          <Link href="/tasks"
            onClick={guardFeatureAccess('tasks', '任務看板')}
            onMouseEnter={() => setIsHovered('tasks')}
            onMouseLeave={() => setIsHovered('none')}
            className={`
              group relative order-3 h-52 md:h-60 lg:h-64 rounded-2xl border border-slate-700 bg-slate-900/40 backdrop-blur-sm 
              flex flex-col items-center justify-center text-center p-6 transition-all duration-500 cursor-pointer
              hover:border-blue-500 hover:bg-slate-800/60 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]
              ${canTasks ? '' : 'opacity-50 grayscale'}
              ${isHovered !== 'none' && isHovered !== 'tasks' ? 'opacity-50 scale-95 blur-[2px]' : 'opacity-100'}
            `}
          >
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 rounded border border-blue-500/20">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">New</span>
            </div>

            <div className="mb-6 p-4 rounded-full bg-slate-800 group-hover:bg-blue-900/50 text-slate-400 group-hover:text-blue-400 transition-colors">
               <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
               </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">任務看板</h2>
            <p className="text-slate-500 text-xs mb-6 group-hover:text-slate-300 px-2">
              部門協作、指派與追蹤。<br/>(Task Flow)
            </p>
            <span className="px-4 py-2 rounded border border-slate-600 text-slate-300 text-xs font-mono group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white transition-all">
              OPEN BOARD &rarr;
            </span>
          </Link>

          {/* 4. 生產管理 (Purple) */}
          <Link href="/admin"
            onClick={guardFeatureAccess('production_admin', '生產管理')}
            onMouseEnter={() => setIsHovered('admin')}
            onMouseLeave={() => setIsHovered('none')}
            className={`
              group relative order-4 h-52 md:h-60 lg:h-64 rounded-2xl border border-slate-700 bg-slate-900/40 backdrop-blur-sm 
              flex flex-col items-center justify-center text-center p-6 transition-all duration-500 cursor-pointer
              hover:border-purple-500 hover:bg-slate-800/60 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]
              ${canProductionAdmin ? '' : 'opacity-50 grayscale'}
              ${isHovered !== 'none' && isHovered !== 'admin' ? 'opacity-50 scale-95 blur-[2px]' : 'opacity-100'}
            `}
          >
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 rounded border border-purple-500/20">
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Production</span>
            </div>

            <div className="mb-6 p-4 rounded-full bg-slate-800 group-hover:bg-purple-900/50 text-slate-400 group-hover:text-purple-400 transition-colors">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">生產管理</h2>
            <p className="text-slate-500 text-xs mb-6 group-hover:text-slate-300 px-2">
              生產流程與資料管理。<br/>(Production Admin)
            </p>
            <span className="px-4 py-2 rounded border border-slate-600 text-slate-300 text-xs font-mono group-hover:bg-purple-600 group-hover:border-purple-600 group-hover:text-white transition-all">
              ACCESS &rarr;
            </span>
          </Link>

          {/* 5. 系統設定 (Orange) */}
          <Link href="/admin/settings"
            onClick={guardFeatureAccess('system_settings', '系統設定')}
            onMouseEnter={() => setIsHovered('settings')}
            onMouseLeave={() => setIsHovered('none')}
            className={`
              group relative order-8 h-52 md:h-60 lg:h-64 rounded-2xl border border-slate-700 bg-slate-900/40 backdrop-blur-sm 
              flex flex-col items-center justify-center text-center p-6 transition-all duration-500 cursor-pointer
              hover:border-orange-500 hover:bg-slate-800/60 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]
              ${canSystemSettings ? '' : 'opacity-50 grayscale'}
              ${isHovered !== 'none' && isHovered !== 'settings' ? 'opacity-50 scale-95 blur-[2px]' : 'opacity-100'}
            `}
          >
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-orange-500/10 rounded border border-orange-500/20">
              <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Settings</span>
            </div>

            <div className="mb-6 p-4 rounded-full bg-slate-800 group-hover:bg-orange-900/50 text-slate-400 group-hover:text-orange-400 transition-colors">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">系統設定</h2>
            <p className="text-slate-500 text-xs mb-6 group-hover:text-slate-300 px-2">
              組織與公告管理。<br/>(System Settings)
            </p>
            <span className="px-4 py-2 rounded border border-slate-600 text-slate-300 text-xs font-mono group-hover:bg-orange-600 group-hover:border-orange-600 group-hover:text-white transition-all">
              OPEN SETTINGS &rarr;
            </span>
          </Link>

          {/* 5. 系統設定 (Orange) */}
          {/* 系統設定入口已移除 */}

          {/* 6. 品保專區 (Teal) */}
          <Link href="/qa"
            onClick={guardFeatureAccess('qa', '品保專區')}
            onMouseEnter={() => setIsHovered('qa')}
            onMouseLeave={() => setIsHovered('none')}
            className={`
              group relative order-6 h-52 md:h-60 lg:h-64 rounded-2xl border border-slate-700 bg-slate-900/40 backdrop-blur-sm 
              flex flex-col items-center justify-center text-center p-6 transition-all duration-500 cursor-pointer
              hover:border-teal-500 hover:bg-slate-800/60 hover:shadow-[0_0_30px_rgba(20,184,166,0.15)]
              ${canQa ? '' : 'opacity-50 grayscale'}
              ${isHovered !== 'none' && isHovered !== 'qa' ? 'opacity-50 scale-95 blur-[2px]' : 'opacity-100'}
            `}
          >
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-teal-500/10 rounded border border-teal-500/20">
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">QA</span>
            </div>

            <div className="mb-6 p-4 rounded-full bg-slate-800 group-hover:bg-teal-900/50 text-slate-400 group-hover:text-teal-400 transition-colors">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">品保專區</h2>
            <p className="text-slate-500 text-xs mb-6 group-hover:text-slate-300 px-2">
              異常回報與品質追蹤。<br/>(Quality Assurance)
            </p>
            <span className="px-4 py-2 rounded border border-slate-600 text-slate-300 text-xs font-mono group-hover:bg-teal-600 group-hover:border-teal-600 group-hover:text-white transition-all">
              OPEN QA &rarr;
            </span>
          </Link>

          {/* 7. 產期告示 (Slate / Disabled) */}
          <div
            onMouseEnter={() => setIsHovered('notice')}
            onMouseLeave={() => setIsHovered('none')}
            className={`
              group relative order-2 h-52 md:h-60 lg:h-64 rounded-2xl border border-slate-700 bg-slate-900/40 backdrop-blur-sm
              flex flex-col items-center justify-center text-center p-6 transition-all duration-500
              ${isHovered !== 'none' && isHovered !== 'notice' ? 'opacity-50 scale-95 blur-[2px]' : 'opacity-100'}
            `}
          >
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-slate-500/10 rounded border border-slate-500/20">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Soon</span>
            </div>

            <div className="mb-6 p-4 rounded-full bg-slate-800 text-slate-400">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">產期告示</h2>
            <p className="text-slate-500 text-xs mb-6 px-2">
              生產交期公告與提醒。<br/>(Schedule Notice)
            </p>
            <span className="px-4 py-2 rounded border border-slate-700 text-slate-500 text-xs font-mono">
              COMING SOON
            </span>
          </div>

          {/* 8. 財會專區 (Slate / Disabled) */}
          <div
            onMouseEnter={() => setIsHovered('finance')}
            onMouseLeave={() => setIsHovered('none')}
            className={`
              group relative order-7 h-52 md:h-60 lg:h-64 rounded-2xl border border-slate-700 bg-slate-900/40 backdrop-blur-sm
              flex flex-col items-center justify-center text-center p-6 transition-all duration-500
              ${isHovered !== 'none' && isHovered !== 'finance' ? 'opacity-50 scale-95 blur-[2px]' : 'opacity-100'}
            `}
          >
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-slate-500/10 rounded border border-slate-500/20">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Soon</span>
            </div>

            <div className="mb-6 p-4 rounded-full bg-slate-800 text-slate-400">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-10V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">財會專區</h2>
            <p className="text-slate-500 text-xs mb-6 px-2">
              財務與會計相關作業。<br/>(Finance Center)
            </p>
            <span className="px-4 py-2 rounded border border-slate-700 text-slate-500 text-xs font-mono">
              COMING SOON
            </span>
          </div>

        </div>
        
        <div className="mt-8 text-center opacity-40 hover:opacity-100 transition-opacity">
           <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2">BARDSHOP INC. • INTERNAL USE ONLY</p>
           <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-slate-600 to-transparent mx-auto"></div>
        </div>

      </div>

      {/* --- 公告詳情 Modal --- */}
      {showModal && currentAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
            <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
              <h3 className="text-white font-bold flex items-center gap-2">
                <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                系統公告
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="text-xs text-slate-500 font-mono mb-4">
                發布時間: {new Date(currentAnnouncement.created_at).toLocaleString()}
              </div>
              <h2 className="text-2xl font-bold text-orange-400 mb-4">{currentAnnouncement.title}</h2>
              <div className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm">
                {currentAnnouncement.content || "無詳細內容"}
              </div>
            </div>
            {announcements.length > 1 && (
              <div className="bg-slate-800/50 p-3 flex justify-between border-t border-slate-700">
                <button onClick={() => setCurrentAnnoIndex(prev => (prev - 1 + announcements.length) % announcements.length)} className="text-xs text-slate-400 hover:text-white px-3 py-1 hover:bg-slate-700 rounded">&larr; Prev</button>
                <span className="text-xs text-slate-500 font-mono py-1">{currentAnnoIndex + 1} / {announcements.length}</span>
                <button onClick={() => setCurrentAnnoIndex(prev => (prev + 1) % announcements.length)} className="text-xs text-slate-400 hover:text-white px-3 py-1 hover:bg-slate-700 rounded">Next &rarr;</button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}