import OptionManager from '../_option-manager'

export default function CategoryPage() {
  return (
    <OptionManager
      type="category"
      title="異常分類"
      subtitle="QA CATEGORY // 異常回報分類選項"
      accentClass="text-amber-400"
      borderClass="border-amber-700/50"
      bgClass="bg-amber-600 hover:bg-amber-500"
    />
  )
}
