'use client'

import { useParams } from 'next/navigation'
// 🔥 修正：這裡多加了一個 ../ (原本只有三個，現在改為四個)
import ProductionViewer from '../../../../components/ProductionViewer'
import { PRODUCTION_SECTIONS } from '../../../../config/productionSections'

export default function DashboardSectionPage() {
  const params = useParams()
  const sectionId = params?.sectionId as string

  const sectionInfo = PRODUCTION_SECTIONS.find(s => s.id === sectionId)

  if (!sectionInfo) {
    return <div className="p-10 text-center text-red-500">無效的生產區塊 ID</div>
  }

  return (
    <div className="p-4 h-screen bg-[#050b14]">
      {/* 使用唯讀元件 */}
      <ProductionViewer
        sectionId={sectionId} 
        sectionName={sectionInfo.name} 
      />
    </div>
  )
}