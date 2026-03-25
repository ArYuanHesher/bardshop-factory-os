import OptionManager from '../_option-manager'

export default function PersonnelPage() {
  return (
    <OptionManager
      type="personnel"
      title="人員名單"
      subtitle="QA PERSONNEL // 回報人 · 處理人 · 缺失人員"
      accentClass="text-cyan-400"
      borderClass="border-cyan-700/50"
      bgClass="bg-cyan-600 hover:bg-cyan-500"
    />
  )
}
