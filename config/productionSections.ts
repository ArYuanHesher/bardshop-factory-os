// 定義六大生產區塊
export const PRODUCTION_SECTIONS = [
  { id: 'printing', name: '印刷', color: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500' },
  { id: 'laser', name: '雷切', color: 'bg-red-500', text: 'text-red-400', border: 'border-red-500' },
  { id: 'post', name: '後加工', color: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500' },
  { id: 'packaging', name: '包裝', color: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500' },
  { id: 'outsourced', name: '委外', color: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-500' },
  { id: 'changping', name: '常平', color: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500' },
] as const;

export type SectionId = typeof PRODUCTION_SECTIONS[number]['id'];