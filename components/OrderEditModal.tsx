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

      {/* 刪除按鈕 */}
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
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-950 rounded-t-2xl">
            <div>
                <h2 className="text-xl font-bold text-white">編輯工序結構</h2>
                <div className="flex gap-2 mt-1">
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-900/30 px-1.5 py-0.5 rounded border border-cyan-700">{orderNumber}</span>
                    <span className="text-xs text-slate-400">拖曳調整順序，或修改工序內容</span>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white bg-slate-800 rounded-full w-8 h-8">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-900/50">
            {loading && <div className="text-center py-4 text-slate-500">處理中...</div>}
            
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
        </div>

        <div className="p-5 border-t border-slate-700 bg-slate-950 rounded-b-2xl flex justify-between items-center">
            <button 
                onClick={handleDeleteEntireOrder}
                className="px-4 py-2.5 bg-red-950 hover:bg-red-900 text-red-400 border border-red-800/50 rounded-lg font-bold text-xs transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                整單刪除
            </button>
            <div className="flex gap-3">
                <button onClick={onClose} className="px-5 py-2.5 text-slate-400 hover:text-white font-bold text-sm transition-colors">取消</button>
                <button 
                    onClick={handleSaveAll}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-900/50 transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    儲存變更
                </button>
            </div>
        </div>

      </div>
    </div>
  )
}