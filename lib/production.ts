export type TaskStatus = 'active' | 'completed' | 'pending' | 'returned' | string

export interface ProductionMachine {
  id: number
  name: string
  daily_minutes?: number | null
  category?: string | null
  is_active?: boolean
}

export interface ProductionTask {
  id: number
  source_order_id?: number | null
  order_number?: string | null
  item_code?: string | null
  quantity: number
  completed_quantity?: number | null
  status?: TaskStatus | null
  scheduled_date?: string | null
  production_machine_id?: number | null
  op_name?: string | null
  station?: string | null
  assigned_section?: string | null
  customer?: string | null
  item_name?: string | null
  total_time_min?: number | null
  basis_text?: string | null
  delivery_date?: string | null
  doc_type?: string | null
  plate_count?: number | null
  handler?: string | null
  designer?: string | null
  issuer?: string | null
  production_machines?: { name?: string | null } | null
}

export type TaskUpdate = Partial<
  Pick<ProductionTask, 'status' | 'completed_quantity' | 'scheduled_date' | 'production_machine_id' | 'total_time_min' | 'assigned_section'>
>

export const PRODUCTION_CATEGORY_MAP: Record<string, string> = {
  printing: '印刷',
  laser: '雷切',
  post: '後加工',
  packaging: '包裝',
  packing: '包裝',
  outsourced: '委外',
  changping: '常平'
}

export const getCurrentWeekStart = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - (day === 0 ? 6 : day - 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}
