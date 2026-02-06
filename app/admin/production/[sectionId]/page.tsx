'use client'

import { useParams } from 'next/navigation'
import ProductionScheduler from '../../../../components/ProductionScheduler'
import { PRODUCTION_SECTIONS } from '../../../../config/productionSections'

export default function DynamicSectionPage() {
  // 1. 抓取網址上的參數，例如 /admin/production/printing -> sectionId = "printing"
  const params = useParams()
  const sectionId = params?.sectionId as string

  // 2. 從設定檔找對應的中文名稱
  const sectionInfo = PRODUCTION_SECTIONS.find(s => s.id === sectionId)

  if (!sectionInfo) {
    return <div className="p-10 text-center text-red-500">無效的生產區塊 ID</div>
  }

  return (
    <div className="p-4 h-screen bg-[#050b14]">
      {/* 直接套用我們剛寫好的萬用排程組件 */}
      <ProductionScheduler 
        sectionId={sectionId} 
        sectionName={sectionInfo.name} 
      />
    </div>
  )
}