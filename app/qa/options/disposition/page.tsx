import OptionManager from '../_option-manager'

export default function DispositionPage() {
  return (
    <OptionManager
      type="disposition"
      title="缺失處置"
      subtitle="QA DISPOSITION // 缺失處置方式選項"
      accentClass="text-rose-400"
      borderClass="border-rose-700/50"
      bgClass="bg-rose-700 hover:bg-rose-600"
    />
  )
}
