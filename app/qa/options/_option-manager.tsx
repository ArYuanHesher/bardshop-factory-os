'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export type OptionType = 'personnel' | 'category' | 'department' | 'disposition'

interface OptionItem {
  id: number
  option_type: string
  option_value: string
  created_at: string
  department_value?: string
}

interface Props {
  type: OptionType
  title: string
  subtitle: string
  accentClass: string    // e.g. 'text-cyan-400'
  borderClass: string    // e.g. 'border-cyan-700'
  bgClass: string        // e.g. 'bg-cyan-600 hover:bg-cyan-500'
}

export default function OptionManager({ type, title, subtitle, accentClass, borderClass, bgClass }: Props) {
  const [items, setItems] = useState<OptionItem[]>([])
  const [departments, setDepartments] = useState<OptionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newValue, setNewValue] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const fetchItems = useCallback(async () => {
    setLoading(true)

    const mainQuery = supabase
      .from('qa_anomaly_option_items')
      .select('id, option_type, option_value, created_at, department_value')
      .eq('option_type', type)
      .order('option_value', { ascending: true })

    if (type === 'personnel') {
      const [mainResult, deptResult] = await Promise.all([
        mainQuery,
        supabase
          .from('qa_anomaly_option_items')
          .select('id, option_type, option_value')
          .eq('option_type', 'department')
          .order('option_value', { ascending: true }),
      ])
      if (mainResult.error) { console.error(mainResult.error); setItems([]) }
      else setItems((mainResult.data as OptionItem[]) || [])
      setDepartments((deptResult.data as OptionItem[]) || [])
    } else {
      const { data, error } = await mainQuery
      if (error) { console.error(error); setItems([]) }
      else setItems((data as OptionItem[]) || [])
    }

    setLoading(false)
  }, [type])

  useEffect(() => { void fetchItems() }, [fetchItems])

  const handleAdd = async () => {
    const value = newValue.trim()
    if (!value) return
    const { error } = await supabase.from('qa_anomaly_option_items').insert({ option_type: type, option_value: value })
    if (error) { alert(`新增失敗：${error.message}`); return }
    setNewValue('')
    await fetchItems()
  }

  const handleSaveEdit = async (item: OptionItem) => {
    const value = editingValue.trim()
    if (!value) { alert('選項內容不可為空'); return }
    const { error } = await supabase.from('qa_anomaly_option_items').update({ option_value: value }).eq('id', item.id)
    if (error) { alert(`更新失敗：${error.message}`); return }
    setEditingId(null)
    setEditingValue('')
    await fetchItems()
  }

  const handleDelete = async (item: OptionItem) => {
    if (!confirm(`確定刪除選項「${item.option_value}」？`)) return
    const { error } = await supabase.from('qa_anomaly_option_items').delete().eq('id', item.id)
    if (error) { alert(`刪除失敗：${error.message}`); return }
    await fetchItems()
  }

  const sortedItems = useMemo(() => items, [items])

  return (
    <div className="p-6 md:p-8 max-w-[900px] mx-auto min-h-screen space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
          <p className={`${accentClass} mt-1 font-mono text-sm uppercase`}>{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void fetchItems()} className="px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">重新整理</button>
          <Link href="/qa/options" className="px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">返回選項管理</Link>
        </div>
      </div>

      {/* 新增區 */}
      <div className={`bg-slate-900/60 border ${borderClass} rounded-2xl p-5`}>
        <p className="text-xs text-slate-400 mb-3">新增選項</p>
        <div className="flex gap-2">
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
            placeholder={`輸入${title}名稱...`}
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm"
          />
          <button onClick={() => void handleAdd()} className={`px-4 py-2 rounded ${bgClass} text-white font-bold text-sm`}>
            新增
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-bold">現有選項</h2>
          <span className="text-xs text-slate-500">共 {sortedItems.length} 筆</span>
        </div>

        {loading ? (
          <div className="text-center text-slate-500 py-8">載入中...</div>
        ) : sortedItems.length === 0 ? (
          <div className="text-center text-slate-500 py-8">尚無選項，請新增</div>
        ) : (
          sortedItems.map((item) => {
            const isEditing = editingId === item.id
            return (
              <div key={item.id} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-3 py-2">
                {isEditing ? (
                  <input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveEdit(item) }}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-sm text-slate-200">{item.option_value}</span>
                )}

                {/* 人員專屬：部門綁定 */}
                {type === 'personnel' && !isEditing && (
                  <select
                    value={item.department_value || ''}
                    onChange={async (e) => {
                      await supabase.from('qa_anomaly_option_items').update({ department_value: e.target.value }).eq('id', item.id)
                      await fetchItems()
                    }}
                    className="bg-slate-900 border border-cyan-700 rounded px-2 py-1 text-sm text-cyan-300 min-w-[120px]"
                  >
                    <option value="">未選部門</option>
                    {departments.map((dep) => (
                      <option key={dep.id} value={dep.option_value}>{dep.option_value}</option>
                    ))}
                  </select>
                )}

                {isEditing ? (
                  <>
                    <button onClick={() => void handleSaveEdit(item)} className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white">儲存</button>
                    <button onClick={() => { setEditingId(null); setEditingValue('') }} className="px-2 py-1 text-xs rounded border border-slate-700 text-slate-300 hover:bg-slate-800">取消</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(item.id); setEditingValue(item.option_value) }} className="px-2 py-1 text-xs rounded border border-cyan-700 text-cyan-300 hover:bg-cyan-900/30">編輯</button>
                    <button onClick={() => void handleDelete(item)} className="px-2 py-1 text-xs rounded border border-rose-700 text-rose-300 hover:bg-rose-900/30">刪除</button>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
