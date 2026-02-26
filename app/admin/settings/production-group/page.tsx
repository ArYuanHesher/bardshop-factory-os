
"use client";

import { useState } from "react";

interface GroupConfig {
	name: string;
	sample_days: number;
	mass_days: number;
}

export default function ProductionGroupSettings() {
	const [groups, setGroups] = useState<GroupConfig[]>([]);
	const [newGroup, setNewGroup] = useState<GroupConfig>({ name: "", sample_days: 0, mass_days: 0 });

	// 新增群組
	const addGroup = () => {
		if (!newGroup.name) return;
		setGroups([...groups, { ...newGroup }]);
		setNewGroup({ name: "", sample_days: 0, mass_days: 0 });
	};

	return (
		<div className="p-8 max-w-3xl mx-auto">
			<h1 className="text-3xl font-bold text-white mb-6">產期告示群組設定</h1>
			<div className="mb-8 p-4 bg-slate-900 border border-slate-700 rounded-xl">
				<h2 className="text-xl font-bold text-orange-400 mb-2">新增群組</h2>
				<div className="flex gap-4 items-end">
					<div>
						<label className="block text-slate-300 mb-1">群組名稱</label>
						<input type="text" className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white" value={newGroup.name} onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))} />
					</div>
					<div>
						<label className="block text-slate-300 mb-1">打樣工作天數</label>
						<input type="number" className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white" value={newGroup.sample_days} onChange={e => setNewGroup(g => ({ ...g, sample_days: Number(e.target.value) }))} />
					</div>
					<div>
						<label className="block text-slate-300 mb-1">一般大貨工作天數</label>
						<input type="number" className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white" value={newGroup.mass_days} onChange={e => setNewGroup(g => ({ ...g, mass_days: Number(e.target.value) }))} />
					</div>
					<button className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600" onClick={addGroup}>新增群組</button>
				</div>
			</div>
			<div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
				<h2 className="text-xl font-bold text-cyan-400 mb-4">群組列表</h2>
				<table className="w-full text-left text-sm text-slate-400">
					<thead className="bg-slate-950 text-slate-200 uppercase font-mono text-xs">
						<tr>
							<th className="p-3">群組名稱</th>
							<th className="p-3">打樣天數</th>
							<th className="p-3">大貨天數</th>
						</tr>
					</thead>
					<tbody>
						{groups.map((g, idx) => (
							<tr key={idx}>
								<td className="p-3 text-white">{g.name}</td>
								<td className="p-3 text-cyan-300">{g.sample_days}</td>
								<td className="p-3 text-orange-300">{g.mass_days}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

