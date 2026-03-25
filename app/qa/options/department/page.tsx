import OptionManager from '../_option-manager'

export default function DepartmentPage() {
  return (
    <OptionManager
      type="department"
      title="部門選單"
      subtitle="QA DEPARTMENT // 回報部門 · 處理部門"
      accentClass="text-indigo-400"
      borderClass="border-indigo-700/50"
      bgClass="bg-indigo-600 hover:bg-indigo-500"
    />
  )
}
