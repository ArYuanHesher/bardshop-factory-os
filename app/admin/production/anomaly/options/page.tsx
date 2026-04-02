'use client'

import Link from 'next/link'
import { NavButton } from '../../../../../components/NavButton'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../../lib/supabaseClient'

type OptionType = 'personnel' | 'category' | 'department'

interface OptionItem {
  id: number;
  option_type: OptionType;
  option_value: string;
  created_at: string;
  department_value?: string;
}

const TYPE_CONFIG: Record<OptionType, { title: string; color: string }> = {
  personnel: { title: '人員名單', color: 'teal' },
  category: { title: '異常分類', color: 'fuchsia' },
  department: { title: '部門選單', color: 'cyan' },
}

const ALL_TYPES: OptionType[] = ['personnel', 'category', 'department']

const DEFAULT_OPTION_SEED: Array<{ option_type: OptionType; option_value: string }> = [
  { option_type: 'personnel', option_value: '王小明' },
  { option_type: 'personnel', option_value: '李小華' },
  { option_type: 'personnel', option_value: '陳建宏' },
  { option_type: 'personnel', option_value: '課長A' },
  { option_type: 'personnel', option_value: '主管B' },
  { option_type: 'personnel', option_value: '品保C' },
  { option_type: 'personnel', option_value: '作業員A' },
  { option_type: 'personnel', option_value: '作業員B' },
  { option_type: 'personnel', option_value: '技術員C' },
  { option_type: 'category', option_value: '品質異常' },
  { option_type: 'category', option_value: '製程異常' },
  { option_type: 'category', option_value: '資料異常' },
  { option_type: 'department', option_value: '品保部' },
  { option_type: 'department', option_value: '生產部' },
  { option_type: 'department', option_value: '工程部' },
]

export default function QaOptionManagerPage() {
  const [items, setItems] = useState<OptionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newValueByType, setNewValueByType] = useState<Record<OptionType, string>>({
    personnel: '',
    category: '',
    department: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const fetchItems = useCallback(async (allowSeed = true) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('qa_anomaly_option_items')
      .select('id, option_type, option_value, created_at, department_value')
      .order('option_type', { ascending: true })
      .order('option_value', { ascending: true })

    if (error) {
      console.error(error)
      alert(`載入選項失敗：${error.message}`)
      setItems([])
    } else {
      const filtered = ((data as OptionItem[]) || []).filter((item) => ALL_TYPES.includes(item.option_type))

      if (allowSeed && filtered.length === 0) {
        const { error: seedError } = await supabase
          .from('qa_anomaly_option_items')
          .insert(DEFAULT_OPTION_SEED)

        if (!seedError) {
          // Re-fetch without seeding
          const { data: data2, error: error2 } = await supabase
            .from('qa_anomaly_option_items')
            .select('id, option_type, option_value, created_at, department_value')
            .order('option_type', { ascending: true })
            .order('option_value', { ascending: true })
          if (!error2) {
            setItems(((data2 as OptionItem[]) || []).filter((item) => ALL_TYPES.includes(item.option_type)))
          }
          setLoading(false)
          return
        }

        console.error(seedError)
      }

      setItems(filtered)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchItems()
  }, [fetchItems])

  const grouped = useMemo(() => {
    return {
      personnel: items.filter((item) => item.option_type === 'personnel'),
      category: items.filter((item) => item.option_type === 'category'),
      department: items.filter((item) => item.option_type === 'department'),
    }
  }, [items])

  const handleAdd = async (type: OptionType) => {
    const value = newValueByType[type].trim()
    if (!value) return

    const { error } = await supabase
      .from('qa_anomaly_option_items')
      .insert({ option_type: type, option_value: value })

    if (error) {
      alert(`新增失敗：${error.message}`)
      return
    }

    setNewValueByType((prev) => ({ ...prev, [type]: '' }))
    await fetchItems()
  }

  const startEdit = (item: OptionItem) => {
    setEditingId(item.id)
    setEditingValue(item.option_value)
  }

  const handleSaveEdit = async (item: OptionItem) => {
    const value = editingValue.trim()
    if (!value) {
      alert('選項內容不可為空')
      return
    }

    const { error } = await supabase
      .from('qa_anomaly_option_items')
      .update({ option_value: value })
      .eq('id', item.id)

    if (error) {
      alert(`更新失敗：${error.message}`)
      return
    }

    setEditingId(null)
    setEditingValue('')
    await fetchItems()
  }

  const handleDelete = async (item: OptionItem) => {
    if (!confirm(`確定刪除選項「${item.option_value}」？`)) return

    const { error } = await supabase
      .from('qa_anomaly_option_items')
      .delete()
      .eq('id', item.id)

    if (error) {
      alert(`刪除失敗：${error.message}`)
      return
    }

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
          <NavButton href="/qa" direction="back" title="返回品保專區" className="px-3 py-2" />
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
                  <button
                    onClick={() => void handleAdd(type)}
                    className="px-3 py-2 rounded bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold"
                  >
                    新增
                  </button>
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

                          {/* 部門下拉選單 */}
                          {type === 'personnel' && (
                            <select
                              value={item.department_value || ''}
                              onChange={async (e) => {
                                const dep = e.target.value;
                                await supabase
                                  .from('qa_anomaly_option_items')
                                  .update({ department_value: dep })
                                  .eq('id', item.id);
                                await fetchItems();
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
                              <button
                                onClick={() => {
                                  setEditingId(null)
                                  setEditingValue('')
                                }}
                                className="px-2 py-1 text-xs rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(item)} className="px-2 py-1 text-xs rounded border border-cyan-700 text-cyan-300 hover:bg-cyan-900/30">編輯</button>
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
