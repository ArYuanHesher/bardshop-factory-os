'use client'

export default function SchedulePage() {
  const stages = [
    { name: '準備中 (Pending)', count: 5, color: 'border-l-gray-400' },
    { name: '裁斷 (Cutting)', count: 2, color: 'border-l-blue-500' },
    { name: '車縫 (Sewing)', count: 8, color: 'border-l-purple-500' },
    { name: '包裝 (Packing)', count: 3, color: 'border-l-green-500' },
  ]

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">產程監控表</h1>
        <p className="text-slate-500 mt-1">LIVE SCHEDULE // 即時生產進度看板</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {stages.map((stage) => (
          <div key={stage.name} className={`bg-white p-6 rounded-lg shadow-md border-l-4 ${stage.color}`}>
            <h3 className="text-slate-500 text-sm uppercase font-bold">{stage.name}</h3>
            <div className="text-4xl font-mono font-bold text-slate-800 mt-2">{stage.count} <span className="text-sm text-slate-400 font-sans">單</span></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-lg border p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-2 h-6 bg-cyan-500 rounded"></span>
          進行中訂單 (Active Orders)
        </h2>
        
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col md:flex-row items-center gap-4 p-4 border rounded-lg hover:shadow-md transition-all">
              <div className="w-32 font-mono font-bold text-blue-600">ORD-2026-{100+i}</div>
              <div className="flex-1 w-full">
                <div className="flex justify-between text-xs mb-1 text-slate-500">
                  <span>進度: {i * 20}%</span>
                  <span>預計完成: 14:00</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${i * 20}%` }}></div>
                </div>
              </div>
              <div className="w-32 text-right">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">車縫中</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}