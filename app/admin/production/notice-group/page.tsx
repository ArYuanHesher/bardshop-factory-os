"use client";

import { useState } from "react";
import { useEffect } from "react";
import { supabase } from "../../../../lib/supabaseClient";

interface GroupConfig {
  name: string;
  sample_days: number;
  mass_days: number;
  summary?: string;
  mass_qty_standard?: number;
}

export default function ProductionNoticeGroupSettings() {
        // 儲存編輯
        const saveEdit = async (idx: number) => {
          if (!editGroup.name) return;
          const groupId = groups[idx]?.id;
          if (!groupId) return;
          const { data, error } = await supabase
            .from("production_notice_groups")
            .update(editGroup)
            .eq("id", groupId)
            .select();
          if (!error && data && data.length > 0) {
            setGroups(gs => gs.map((g, i) => (i === idx ? data[0] : g)));
          }
          setEditIdx(null);
          setEditGroup({ name: "", sample_days: 0, mass_days: 0, summary: "", mass_qty_standard: 0 });
        };
      // 取消編輯模式
      const cancelEdit = () => {
        setEditIdx(null);
        setEditGroup({ name: "", sample_days: 0, mass_days: 0, summary: "", mass_qty_standard: 0 });
      };
    // 進入編輯模式
    const startEdit = (idx: number) => {
      setEditIdx(idx);
      setEditGroup(groups[idx]);
    };
  const [groups, setGroups] = useState<any[]>([]);
  const [newGroup, setNewGroup] = useState<GroupConfig>({ name: "", sample_days: 0, mass_days: 0, summary: "", mass_qty_standard: 0 });
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editGroup, setEditGroup] = useState<GroupConfig>({ name: "", sample_days: 0, mass_days: 0, summary: "", mass_qty_standard: 0 });

  // (移除同步 addGroup，僅保留 async addGroup)

  // 讀取群組
  useEffect(() => {
    const fetchGroups = async () => {
      const { data } = await supabase.from("production_notice_groups").select("*").order("id");
      if (data) setGroups(data);
    };
    fetchGroups();
  }, []);

  // 新增群組
  const addGroup = async () => {
    if (!newGroup.name) return;
    const { data, error } = await supabase.from("production_notice_groups").insert([newGroup]).select();
    if (!error && data) setGroups(gs => [...gs, ...data]);
    setNewGroup({ name: "", sample_days: 0, mass_days: 0, summary: "", mass_qty_standard: 0 });
  };
  // 其餘函式（如 saveEdit, cancelEdit, deleteGroup）請依照 async/await 及 supabase 實作，暫略，確保 return 只在 function 內部。

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6">產期告示群組設定</h1>
      <div className="mb-8 p-4 bg-slate-900 border border-slate-700 rounded-xl">
        <h2 className="text-xl font-bold text-orange-400 mb-4">新增群組</h2>
        <div className="flex gap-4 items-end">
          <div className="flex flex-col w-96">
            <label className="block text-slate-300 mb-1">群組名稱</label>
            <input type="text" className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white w-full" value={newGroup.name} onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))} />
          </div>
          <div className="flex flex-col flex-1 min-w-[320px]">
            <label className="block text-slate-300 mb-1">工序概述</label>
            <input type="text" className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white w-full" value={newGroup.summary} onChange={e => setNewGroup(g => ({ ...g, summary: e.target.value }))} />
          </div>
          <div className="flex flex-col w-48">
            <label className="block text-slate-300 mb-1">打樣工作天數</label>
            <input type="number" className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white w-full" value={newGroup.sample_days} onChange={e => setNewGroup(g => ({ ...g, sample_days: Number(e.target.value) }))} />
          </div>
          <div className="flex flex-col w-48">
            <label className="block text-slate-300 mb-1">一般大貨工作天數</label>
            <input type="number" className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white w-full" value={newGroup.mass_days} onChange={e => setNewGroup(g => ({ ...g, mass_days: Number(e.target.value) }))} />
          </div>
          <div className="flex flex-col w-56">
            <label className="block text-slate-300 mb-1">大量大貨數量標準</label>
            <input type="number" className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white w-full" value={newGroup.mass_qty_standard} onChange={e => setNewGroup(g => ({ ...g, mass_qty_standard: Number(e.target.value) }))} />
          </div>
          <div className="flex items-end h-full">
            <button className="px-8 py-2 bg-orange-500 text-white rounded hover:bg-orange-600" style={{minWidth:'140px'}} onClick={addGroup}>新增群組</button>
          </div>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <h2 className="text-xl font-bold text-cyan-400 mb-6">群組列表</h2>
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-950 text-slate-200 uppercase font-mono text-xs">
            <tr>
              <th className="p-3 w-72 whitespace-nowrap">群組名稱</th>
              <th className="p-3 w-96 whitespace-nowrap">工序概述</th>
              <th className="p-3 w-40 whitespace-nowrap">打樣天數</th>
              <th className="p-3 w-40 whitespace-nowrap">大貨天數</th>
              <th className="p-3 w-56 whitespace-nowrap">大量大貨數量標準</th>
              <th className="p-3 w-40 whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, idx) => (
              <tr key={idx}>
                {editIdx === idx ? (
                  <>
                    <td className="p-3 w-72 whitespace-nowrap">
                      <input
                        type="text"
                        className="bg-slate-800 border border-slate-600 rounded px-4 py-2 text-white w-full"
                        value={editGroup.name}
                        onChange={e => setEditGroup(eg => ({ ...eg, name: e.target.value }))}
                      />
                    </td>
                    <td className="p-3 w-96 whitespace-nowrap">
                      <input
                        type="text"
                        className="bg-slate-800 border border-slate-600 rounded px-4 py-2 text-white w-full"
                        value={editGroup.summary}
                        onChange={e => setEditGroup(eg => ({ ...eg, summary: e.target.value }))}
                      />
                    </td>
                    <td className="p-3 w-40 whitespace-nowrap">
                      <input
                        type="number"
                        className="bg-slate-800 border border-slate-600 rounded px-4 py-2 text-white w-full"
                        value={editGroup.sample_days}
                        onChange={e => setEditGroup(eg => ({ ...eg, sample_days: Number(e.target.value) }))}
                      />
                    </td>
                    <td className="p-3 w-40 whitespace-nowrap">
                      <input
                        type="number"
                        className="bg-slate-800 border border-slate-600 rounded px-4 py-2 text-white w-full"
                        value={editGroup.mass_days}
                        onChange={e => setEditGroup(eg => ({ ...eg, mass_days: Number(e.target.value) }))}
                      />
                    </td>
                    <td className="p-3 w-56 whitespace-nowrap">
                      <input
                        type="number"
                        className="bg-slate-800 border border-slate-600 rounded px-4 py-2 text-white w-full"
                        value={editGroup.mass_qty_standard}
                        onChange={e => setEditGroup(eg => ({ ...eg, mass_qty_standard: Number(e.target.value) }))}
                      />
                    </td>
                    <td className="p-3 w-40 whitespace-nowrap flex gap-2">
                      <button className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700" onClick={() => saveEdit(idx)}>儲存</button>
                      <button className="px-3 py-1 bg-slate-600 text-white rounded hover:bg-slate-700" onClick={cancelEdit}>取消</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 w-72 whitespace-nowrap text-white">{g.name}</td>
                    <td className="p-3 w-96 whitespace-nowrap text-slate-300">{g.summary || '-'}</td>
                    <td className="p-3 w-40 whitespace-nowrap text-cyan-300">{g.sample_days}</td>
                    <td className="p-3 w-40 whitespace-nowrap text-orange-300">{g.mass_days}</td>
                    <td className="p-3 w-56 whitespace-nowrap text-yellow-300">{g.mass_qty_standard ?? '-'}</td>
                    <td className="p-3 w-40 whitespace-nowrap flex gap-2">
                      <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => startEdit(idx)}>編輯</button>
                      <button className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700" onClick={() => deleteGroup(idx)}>刪除</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}