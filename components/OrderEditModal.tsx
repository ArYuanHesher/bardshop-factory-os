'use client'

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { 
  DndContext, 
  closestCenter,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabaseClient'
import { PRODUCTION_SECTIONS } from '../config/productionSections'

interface StageItem {
  id: number
  order_number: string
  item_code: string
  item_name: string
  quantity: number
  customer: string
  delivery_date: string
  doc_type: string
  designer: string
  handler: string
  issuer: string
  plate_count: string
  op_name: string
  assigned_section: string
  total_time_min: number
  status: string
  created_at: string
}

interface SplitStageDraft {
  tempId: number
  sourceId: number
  op_name: string
  assigned_section: string
  quantity: number
}

type ModalMode = 'edit' | 'split' | 'separate'

function getBaseOrderNumber(orderNo: string) {
  return orderNo.replace(/\(\d+\)$/, '')
}

type EditableField = 'op_name' | 'assigned_section' | 'total_time_min'

// --- 可排序的單一工序列 ---
function SortableItem({ item, onDelete, onUpdate }: { item: StageItem, onDelete: (id: number) => void, onUpdate: (id: number, field: EditableField, val: string | number) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative'
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-slate-800 p-2 rounded mb-2 border border-slate-700 flex items-center gap-3 shadow-sm select-none">
      {/* 拖曳手把 */}
      <div {...attributes} {...listeners} className="cursor-grab text-slate-500 hover:text-white px-2 py-1 text-xl">
        ☰
      </div>

      {/* 工序名稱 */}
      <div className="flex-1">
        <label className="text-[9px] text-slate-500 block mb-0.5">工序名稱</label>
        <input 
          type="text" 
          value={item.op_name} 
          onChange={(e) => onUpdate(item.id, 'op_name', e.target.value)}
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white w-full focus:border-blue-500 outline-none"
        />
      </div>

      {/* 負責單位 */}
      <div className="w-32">
        <label className="text-[9px] text-slate-500 block mb-0.5">負責區塊</label>
        <select 
          value={item.assigned_section || ''} 
          onChange={(e) => onUpdate(item.id, 'assigned_section', e.target.value)}
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white w-full focus:border-blue-500 outline-none"
        >
            {PRODUCTION_SECTIONS.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
            ))}
        </select>
      </div>

      {/* 工時 */}
      <div className="w-24">
        <label className="text-[9px] text-slate-500 block mb-0.5">工時(分)</label>
        <input 
          type="number" 
          value={item.total_time_min} 
          onChange={(e) => onUpdate(item.id, 'total_time_min', parseInt(e.target.value) || 0)}
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-emerald-400 font-mono w-full text-right focus:border-emerald-500 outline-none"
        />
      </div>

      <button 
        onClick={() => onDelete(item.id)} 
        className="text-slate-600 hover:text-red-500 p-2 mt-4 transition-colors"
        title="刪除此工序"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  )
}

// --- 編輯視窗主體 ---
export default function OrderEditModal({ orderNumber, isOpen, onClose, onSaveSuccess }: { orderNumber: string, isOpen: boolean, onClose: () => void, onSaveSuccess: () => void }) {
  const [stages, setStages] = useState<StageItem[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ModalMode>('edit')
  const [splitStages, setSplitStages] = useState<SplitStageDraft[]>([])
  const [separateSelectedIds, setSeparateSelectedIds] = useState<number[]>([])
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchStages = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('station_time_summary')
      .select('*')
      .eq('order_number', orderNumber)
      .order('id', { ascending: true }) // 預設依 ID 排序，如有 sort_order 欄位更佳
    
    if (data) setStages(data as StageItem[])
    setLoading(false)
  }, [orderNumber])

  useEffect(() => {
    if (isOpen && orderNumber) {
      const timer = setTimeout(() => {
        void fetchStages()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isOpen, orderNumber, fetchStages])

  // --- CRUD 操作 ---
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    if (active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id)
        const newIndex = items.findIndex(i => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleDeleteStage = async (id: number) => {
    if(!confirm('確定刪除此工序？')) return
    const { error } = await supabase.from('station_time_summary').delete().eq('id', id)
    if (!error) {
        setStages(prev => prev.filter(s => s.id !== id))
    } else {
        alert(error.message)
    }
  }

  const handleUpdateStage = (id: number, field: EditableField, val: string | number) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s))
  }

  const handleAddStage = async () => {
    if (stages.length === 0) return alert('無法新增 (需至少有一筆資料作為模板)')
    const template = stages[0]
    
    // 複製同訂單的基本資料
    const newStage = {
        order_number: template.order_number,
        item_code: template.item_code,
        item_name: template.item_name,
        quantity: template.quantity,
        customer: template.customer,
        delivery_date: template.delivery_date,
        doc_type: template.doc_type,
        designer: template.designer,
        handler: template.handler,
        issuer: template.issuer,
        plate_count: template.plate_count,
        op_name: '新工序',
        assigned_section: 'printing',
        total_time_min: 30,
        status: 'active',
        created_at: new Date().toISOString()
    }

    const { data, error } = await supabase.from('station_time_summary').insert([newStage]).select()
    if (!error && data) {
        setStages(prev => [...prev, data[0]])
    } else {
        alert('新增失敗: ' + error?.message)
    }
  }

  const handleOpenSplitMode = () => {
    if (stages.length === 0) return

    const drafts: SplitStageDraft[] = stages.map((stage, index) => ({
      tempId: -1 * (index + 1),
      sourceId: stage.id,
      op_name: stage.op_name,
      assigned_section: stage.assigned_section,
      quantity: 0,
    }))

    setSplitStages(drafts)
    setMode('split')
  }

  const handleOpenSeparateMode = () => {
    if (stages.length === 0) return
    setSeparateSelectedIds([])
    setMode('separate')
  }

  const handleToggleSeparateStage = (stageId: number) => {
    setSeparateSelectedIds(prev => prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId])
  }

  const getNextOrderSuffix = async (baseOrderNo: string) => {
    const { data, error } = await supabase
      .from('station_time_summary')
      .select('order_number')
      .like('order_number', `${baseOrderNo}%`)

    if (error) {
      throw new Error(`查詢訂單尾碼失敗: ${error.message}`)
    }

    const list = data || []
    let maxSuffix = 0

    list.forEach((row) => {
      const orderNo = (row as { order_number?: string }).order_number || ''
      const match = orderNo.match(/\((\d+)\)$/)
      if (match) {
        maxSuffix = Math.max(maxSuffix, parseInt(match[1], 10))
      } else if (orderNo === baseOrderNo) {
        maxSuffix = Math.max(maxSuffix, 1)
      }
    })

    return maxSuffix + 1
  }

  const handleUpdateSplitQty = (tempId: number, value: string) => {
    const parsed = parseInt(value, 10)
    const nextQty = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    setSplitStages(prev => prev.map(s => s.tempId === tempId ? { ...s, quantity: nextQty } : s))
  }

  const handleDeleteSplitDraft = (tempId: number) => {
    setSplitStages(prev => prev.filter(s => s.tempId !== tempId))
  }

  const handleApplySplit = async () => {
    const selectedSplit = splitStages.filter(s => s.quantity > 0)
    if (selectedSplit.length === 0) {
      alert('請至少設定一筆拆單數量。')
      return
    }

    for (const draft of selectedSplit) {
      const source = stages.find(s => s.id === draft.sourceId)
      const sourceQty = Number(source?.quantity) || 0
      if (!source || draft.quantity >= sourceQty) {
        alert(`工序「${draft.op_name}」拆單數量不可大於或等於原本數量。`)
        return
      }
    }

    setLoading(true)

    const originalSnapshot = stages.map(s => ({ id: s.id, quantity: s.quantity, total_time_min: s.total_time_min }))
    const rowsToInsert: Array<Omit<StageItem, 'id'>> = []
    const sourceOrderNo = stages[0]?.order_number || orderNumber
    const baseOrderNo = getBaseOrderNumber(sourceOrderNo)
    const orderNo1 = `${baseOrderNo}(1)`
    const orderNo2 = `${baseOrderNo}(2)`

    try {
      for (const stage of stages) {
        const { error: orderRenameError } = await supabase
          .from('station_time_summary')
          .update({ order_number: orderNo1 })
          .eq('id', stage.id)

        if (orderRenameError) {
          throw new Error(`更新原訂單號失敗: ${orderRenameError.message}`)
        }
      }

      for (const draft of selectedSplit) {
        const source = stages.find(s => s.id === draft.sourceId)
        if (!source) continue

        const sourceQty = Number(source.quantity) || 0
        const sourceTime = Number(source.total_time_min) || 0
        const splitQty = draft.quantity
        const remainQty = sourceQty - splitQty
        const splitTime = sourceQty > 0 ? Math.round((sourceTime * splitQty) / sourceQty) : 0
        const remainTime = sourceTime - splitTime

        const { error: updateError } = await supabase
          .from('station_time_summary')
          .update({ quantity: remainQty, total_time_min: remainTime })
          .eq('id', source.id)

        if (updateError) {
          throw new Error(`更新原工序失敗: ${updateError.message}`)
        }

        rowsToInsert.push({
          order_number: orderNo2,
          item_code: source.item_code,
          item_name: source.item_name,
          quantity: splitQty,
          customer: source.customer,
          delivery_date: source.delivery_date,
          doc_type: source.doc_type,
          designer: source.designer,
          handler: source.handler,
          issuer: source.issuer,
          plate_count: source.plate_count,
          op_name: source.op_name,
          assigned_section: source.assigned_section,
          total_time_min: splitTime,
          status: source.status,
          created_at: new Date().toISOString(),
        })
      }

      const { error: insertError } = await supabase.from('station_time_summary').insert(rowsToInsert)
      if (insertError) {
        throw new Error(`新增拆單工序失敗: ${insertError.message}`)
      }

      await onSaveSuccess()
      setMode('edit')
      setSplitStages([])
      alert(`✅ 拆單完成：已建立 ${orderNo1} 與 ${orderNo2}`)
      onClose()
    } catch (error) {
      for (const snapshot of originalSnapshot) {
        await supabase
          .from('station_time_summary')
          .update({ quantity: snapshot.quantity, total_time_min: snapshot.total_time_min, order_number: sourceOrderNo })
          .eq('id', snapshot.id)
      }

      const message = error instanceof Error ? error.message : '未知錯誤'
      alert('拆單失敗: ' + message)
    } finally {
      setLoading(false)
    }
  }

  const handleApplySeparate = async () => {
    if (separateSelectedIds.length === 0) {
      alert('請至少勾選一個工序。')
      return
    }

    if (separateSelectedIds.length === stages.length) {
      alert('不可全部分單，請至少保留一個工序在原訂單。')
      return
    }

    setLoading(true)
    const sourceOrderNo = stages[0]?.order_number || orderNumber
    const baseOrderNo = getBaseOrderNumber(sourceOrderNo)

    try {
      const nextSuffix = await getNextOrderSuffix(baseOrderNo)
      const targetOrderNo = `${baseOrderNo}(${nextSuffix})`

      for (const stageId of separateSelectedIds) {
        const { error } = await supabase
          .from('station_time_summary')
          .update({ order_number: targetOrderNo })
          .eq('id', stageId)

        if (error) {
          throw new Error(`分單更新失敗: ${error.message}`)
        }
      }

      await onSaveSuccess()
      setMode('edit')
      setSeparateSelectedIds([])
      alert(`✅ 分單完成：已移出 ${separateSelectedIds.length} 個工序至 ${targetOrderNo}`)
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知錯誤'
      alert('分單失敗: ' + message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAll = async () => {
    setLoading(true)
    // 這裡我們透過 delete + re-insert 或者 update 來保存順序
    // 為了簡單起見，我們更新每一筆資料的內容 (如果未來有 sort_order 欄位，也要在這裡更新)
    const promises = stages.map((stage) => {
        return supabase.from('station_time_summary').update({
            op_name: stage.op_name,
            assigned_section: stage.assigned_section,
            total_time_min: stage.total_time_min,
            // sort_order: index // 若資料庫有此欄位可啟用
        }).eq('id', stage.id)
    })

    await Promise.all(promises)
    setLoading(false)
    alert('✅ 工序結構與內容已儲存！')
    onSaveSuccess()
    onClose()
  }

  const handleDeleteEntireOrder = async () => {
    if(!confirm(`⚠️ 嚴重警告：\n您確定要刪除整張訂單 [${orderNumber}] 嗎？\n此動作將刪除該訂單下的「所有工序」，且無法復原！`)) return
    
    const { error } = await supabase.from('station_time_summary').delete().eq('order_number', orderNumber)
    if (!error) {
        alert('🗑️ 整單刪除成功。')
        onSaveSuccess()
        onClose()
    } else {
        alert('刪除失敗: ' + error.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-950 rounded-t-2xl">
            <div>
                <h2 className="text-xl font-bold text-white">{mode === 'split' ? '拆單模式' : mode === 'separate' ? '分單模式' : '編輯工序結構'}</h2>
                <div className="flex gap-2 mt-1">
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-900/30 px-1.5 py-0.5 rounded border border-cyan-700">{orderNumber}</span>
                  <span className="text-xs text-slate-400">{mode === 'split' ? '左側原工序 / 右側拆出工序（可刪除不要拆的工序）' : mode === 'separate' ? '勾選工序後移到新訂單號（獨立工序）' : '拖曳調整順序，或修改工序內容'}</span>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white bg-slate-800 rounded-full w-8 h-8">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-900/50">
            {loading && <div className="text-center py-4 text-slate-500">處理中...</div>}

            {mode === 'split' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-slate-700 rounded-xl bg-slate-900/70 p-3">
                  <div className="text-sm font-bold text-slate-200 mb-3">左側：原本工序</div>
                  <div className="space-y-2">
                    {stages.map((stage) => (
                      <div key={stage.id} className="bg-slate-800 rounded border border-slate-700 p-2 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-white">{stage.op_name}</div>
                          <div className="text-[11px] text-slate-500">{PRODUCTION_SECTIONS.find(s => s.id === stage.assigned_section)?.name || stage.assigned_section}</div>
                        </div>
                        <div className="text-xs font-mono text-slate-300">數量：{stage.quantity}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-700 rounded-xl bg-slate-900/70 p-3">
                  <div className="text-sm font-bold text-slate-200 mb-3">右側：拆出工序（預設數量 0）</div>
                  <div className="space-y-2">
                    {splitStages.length === 0 ? (
                      <div className="text-xs text-slate-500 py-6 text-center">已無可拆工序</div>
                    ) : (
                      splitStages.map((draft) => (
                        <div key={draft.tempId} className="bg-slate-800 rounded border border-slate-700 p-2 flex items-end gap-2">
                          <div className="flex-1">
                            <div className="text-sm font-bold text-white">{draft.op_name}</div>
                            <div className="text-[11px] text-slate-500">{PRODUCTION_SECTIONS.find(s => s.id === draft.assigned_section)?.name || draft.assigned_section}</div>
                          </div>
                          <div className="w-24">
                            <label className="text-[10px] text-slate-500 block mb-1">拆出數量</label>
                            <input
                              type="number"
                              min={0}
                              value={draft.quantity}
                              onChange={(e) => handleUpdateSplitQty(draft.tempId, e.target.value)}
                              className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white w-full text-right outline-none focus:border-amber-500"
                            />
                          </div>
                          <button
                            onClick={() => handleDeleteSplitDraft(draft.tempId)}
                            className="text-slate-500 hover:text-red-400 p-2 transition-colors"
                            title="不拆此工序"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : mode === 'separate' ? (
              <div className="border border-slate-700 rounded-xl bg-slate-900/70 p-3">
                <div className="text-sm font-bold text-slate-200 mb-3">勾選要移出成獨立訂單的工序</div>
                <div className="space-y-2">
                  {stages.map((stage) => {
                    const checked = separateSelectedIds.includes(stage.id)
                    return (
                      <label key={stage.id} className={`flex items-center justify-between gap-3 rounded border p-2 cursor-pointer transition-colors ${checked ? 'bg-amber-900/30 border-amber-600/60' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleSeparateStage(stage.id)}
                            className="w-4 h-4 accent-amber-500"
                          />
                          <div>
                            <div className="text-sm font-bold text-white">{stage.op_name}</div>
                            <div className="text-[11px] text-slate-500">{PRODUCTION_SECTIONS.find(s => s.id === stage.assigned_section)?.name || stage.assigned_section}</div>
                          </div>
                        </div>
                        <div className="text-xs font-mono text-slate-300">數量：{stage.quantity}</div>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : (
              <>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                        {stages.map(stage => (
                            <SortableItem 
                                key={stage.id} 
                                item={stage} 
                                onDelete={handleDeleteStage}
                                onUpdate={handleUpdateStage}
                            />
                        ))}
                    </SortableContext>
                </DndContext>

                <button 
                    onClick={handleAddStage}
                    className="w-full py-3 mt-4 border-2 border-dashed border-slate-700 text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-900/10 rounded-xl transition-all font-bold text-sm flex items-center justify-center gap-2"
                >
                    <span>+ 新增工序</span>
                </button>
              </>
            )}
        </div>

        <div className="p-5 border-t border-slate-700 bg-slate-950 rounded-b-2xl flex justify-between items-center">
            <button 
                onClick={handleDeleteEntireOrder}
              disabled={mode !== 'edit'}
                className="px-4 py-2.5 bg-red-950 hover:bg-red-900 text-red-400 border border-red-800/50 rounded-lg font-bold text-xs transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                整單刪除
            </button>
            <div className="flex gap-3">
                <button onClick={onClose} className="px-5 py-2.5 text-slate-400 hover:text-white font-bold text-sm transition-colors">取消</button>
                {mode === 'split' ? (
                  <>
                    <button
                      onClick={() => {
                        setMode('edit')
                        setSplitStages([])
                      }}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-sm transition-colors"
                    >
                      返回編輯
                    </button>
                    <button
                      onClick={handleApplySplit}
                      className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-amber-900/50 transition-all"
                    >
                      確認拆單
                    </button>
                  </>
                ) : mode === 'separate' ? (
                  <>
                    <button
                      onClick={() => {
                        setMode('edit')
                        setSeparateSelectedIds([])
                      }}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-sm transition-colors"
                    >
                      返回編輯
                    </button>
                    <button
                      onClick={handleApplySeparate}
                      className="px-6 py-2.5 bg-fuchsia-700 hover:bg-fuchsia-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-fuchsia-900/50 transition-all"
                    >
                      確認分單
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleOpenSplitMode}
                      className="px-6 py-2.5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-amber-900/50 transition-all"
                    >
                      拆單
                    </button>
                    <button
                      onClick={handleOpenSeparateMode}
                      className="px-6 py-2.5 bg-fuchsia-800 hover:bg-fuchsia-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-fuchsia-900/50 transition-all"
                    >
                      分單
                    </button>
                    <button 
                        onClick={handleSaveAll}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-900/50 transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        儲存變更
                    </button>
                  </>
                )}
            </div>
        </div>

      </div>
    </div>
  )
}