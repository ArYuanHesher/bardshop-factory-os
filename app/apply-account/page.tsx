'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

interface Department {
  id: number
  name: string
}

const isMissingPendingColumnError = (error: { message?: string } | null | undefined) =>
  Boolean(error?.message?.includes("is_pending_approval"))

export default function ApplyAccountPage() {
  const router = useRouter()
  const [departments, setDepartments] = useState<Department[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const [formData, setFormData] = useState({
    real_name: '',
    nickname: '',
    department: '',
    email: '',
    password: '',
  })

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase.from('departments').select('id,name').order('id', { ascending: true })
      const deptList = (data as Department[]) || []
      setDepartments(deptList)
      if (deptList.length > 0) {
        setFormData(prev => ({ ...prev, department: deptList[0].name }))
      }
    }

    void fetchDepartments()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage('')

    const email = formData.email.trim().toLowerCase()
    const realName = formData.real_name.trim()

    try {
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingMember) {
        throw new Error('此 Email 已被使用，請改用其他信箱。')
      }

      const payloadBase = {
        real_name: realName,
        nickname: formData.nickname.trim(),
        department: formData.department,
        email,
        password: formData.password,
        permissions: [],
        status: 'PendingApproval',
        is_admin: false,
      }

      const payloadWithPending = {
        ...payloadBase,
        is_pending_approval: true,
      }

      const { error } = await supabase.from('members').insert([payloadWithPending])
      if (error) {
        if (isMissingPendingColumnError(error)) {
          const { error: retryError } = await supabase.from('members').insert([payloadBase])
          if (retryError) throw retryError
        } else {
          throw error
        }
      }

      setMessage('申請已送出，請等待管理員指派權限後啟用。')
      setTimeout(() => router.push('/login'), 1200)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '申請失敗，請稍後再試'
      setMessage(errMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-300 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-slate-900/60 border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">申請帳號</h1>
          <p className="text-xs text-slate-500 mt-1">送出後由管理員審核並指派入口權限</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">真實姓名 *</label>
            <input
              required
              value={formData.real_name}
              onChange={(e) => setFormData(prev => ({ ...prev, real_name: e.target.value }))}
              className="w-full bg-slate-950/60 border border-slate-700 rounded px-3 py-2 text-white focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">暱稱 (選填)</label>
            <input
              value={formData.nickname}
              onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
              className="w-full bg-slate-950/60 border border-slate-700 rounded px-3 py-2 text-white focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">所屬部門 *</label>
            <select
              required
              value={formData.department}
              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
              className="w-full bg-slate-950/60 border border-slate-700 rounded px-3 py-2 text-white focus:border-cyan-500 outline-none"
            >
              {departments.length === 0 ? (
                <option value="">請先聯絡管理員建立部門</option>
              ) : (
                departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">EMAIL *</label>
            <input
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full bg-slate-950/60 border border-slate-700 rounded px-3 py-2 text-white focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">登入密碼 *</label>
            <input
              required
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full bg-slate-950/60 border border-slate-700 rounded px-3 py-2 text-white focus:border-cyan-500 outline-none"
            />
          </div>

          {message && (
            <div className="text-xs rounded border border-cyan-700/50 bg-cyan-900/20 text-cyan-300 px-3 py-2">
              {message}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Link href="/login" className="text-xs text-slate-400 hover:text-white">返回登入</Link>
            <button
              type="submit"
              disabled={isSubmitting || departments.length === 0}
              className="px-5 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold disabled:opacity-50"
            >
              {isSubmitting ? '送出中...' : '送出申請'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
