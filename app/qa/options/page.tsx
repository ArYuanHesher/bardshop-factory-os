// QA 專區異常單選項頁面
'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

type OptionType = 'personnel' | 'category' | 'department'

interface OptionItem {
  id: number
  option_type: OptionType
  option_value: string
  created_at: string
  department_value?: string
}

const TYPE_CONFIG: Record<OptionType, { title: string }> = {
  personnel: { title: '人員名單' },
  category: { title: '異常分類' },
  department: { title: '部門選單' },
}

const ALL_TYPES: OptionType[] = ['personnel', 'category', 'department']

export default function QAOptionsPage() {
  const [items, setItems] = useState<OptionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newValueByType, setNewValueByType] = useState<Record<OptionType, string>>({
    personnel: '',
    category: '',
    department: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('qa_anomaly_option_items')
      .select('id, option_type, option_value, created_at, department_value')
      .order('option_type', { ascending: true })
      .order('option_value', { ascending: true })

    if (error) {
      console.error(error)
      setItems([])
    } else {
      setItems(((data as OptionItem[]) || []).filter((item) => ALL_TYPES.includes(item.option_type)))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const grouped = useMemo(() => ({
    personnel: items.filter((item) => item.option_type === 'personnel'),
    category: items.filter((item) => item.option_type === 'category'),
    department: items.filter((item) => item.option_type === 'department'),
  }), [items])

  const handleAdd = async (type: OptionType) => {
    const value = newValueByType[type].trim()
    if (!value) return
    const { error } = await supabase.from('qa_anomaly_option_items').insert({ option_type: type, option_value: value })
    if (error) {
      alert(`新增失敗：${error.message}`)
      return
    }
    setNewValueByType((prev) => ({ ...prev, [type]: '' }))
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

  return (
    <div className="p-6 md:p-8 max-w-[1500px] mx-auto min-h-screen space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">下拉選項管理</h1>
          <p className="text-teal-400 mt-1 font-mono text-sm uppercase">QA DROPDOWN OPTION MANAGER</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void fetchItems()} className="px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">重新整理</button>
          <Link href="/qa" className="px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">返回品保專區</Link>
        </div>
      </div>

      {loading ? (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-8 text-center text-slate-400">載入中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {ALL_TYPES.map((type) => {
            const config = TYPE_CONFIG[type]
            const list = grouped[type]

            return (
              <div key={type} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 space-y-3">
                <h2 className="text-white font-bold">{config.title}</h2>

                <div className="flex gap-2">
                  <input
                    value={newValueByType[type]}
                    onChange={(e) => setNewValueByType((prev) => ({ ...prev, [type]: e.target.value }))}
                    placeholder={`新增${config.title}選項`}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                  />
                  <button onClick={() => void handleAdd(type)} className="px-3 py-2 rounded bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold">新增</button>
                </div>

                <div className="space-y-2">
                  {list.length === 0 ? (
                    <div className="text-xs text-slate-500">尚無選項</div>
                  ) : (
                    list.map((item) => {
                      const isEditing = editingId === item.id

                      return (
                        <div key={item.id} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-2 py-2">
                          {isEditing ? (
                            <input
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                            />
                          ) : (
                            <span className="flex-1 text-sm text-slate-200">{item.option_value}</span>
                          )}

                          {type === 'personnel' && (
                            <select
                              value={item.department_value || ''}
                              onChange={async (e) => {
                                await supabase.from('qa_anomaly_option_items').update({ department_value: e.target.value }).eq('id', item.id)
                                await fetchItems()
                              }}
                              className="bg-slate-900 border border-cyan-700 rounded px-2 py-1 text-sm text-cyan-300 min-w-[120px]"
                            >
                              <option value="">未選擇</option>
                              {grouped.department.map(dep => (
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
          })}
        </div>
      )}
    </div>
  )
}
