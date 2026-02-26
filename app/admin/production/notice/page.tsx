"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";

interface BomItem {
  id: number;
  product_code: string;
  product_name: string;
  group_name?: string;
  sample_days?: number;
  mass_days?: number;
}

interface GroupConfig {
  name: string;
  sample_days: number;
  mass_days: number;
}

export default function ProductionNoticeSettings() {
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [batchGroup, setBatchGroup] = useState("");
  const [showUngrouped, setShowUngrouped] = useState(false);

  useEffect(() => {
    // 取得BOM表資料
    const fetchBom = async () => {
      const { data } = await supabase.from("bom").select("id, product_code, product_name, group_name");
      if (data) setBomItems(data);
    };
    // 取得群組資料
    const fetchGroups = async () => {
      const { data } = await supabase.from("production_notice_groups").select("*").order("id");
      if (data) setGroups(data);
    };
    fetchBom();
    fetchGroups();

    // Supabase 群組資料即時訂閱
    const groupSub = supabase
      .channel('production_notice_groups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_notice_groups' }, payload => {
        fetchGroups();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(groupSub);
    };
  }, []);

  // 設定BOM品項的群組
  const setItemGroup = async (itemId: number, groupName: string) => {
    // 更新本地狀態
    setBomItems(items => items.map(item => item.id === itemId ? { ...item, group_name: groupName } : item));
    // 更新 Supabase
    await supabase.from("bom").update({ group_name: groupName }).eq("id", itemId);
  };

  // 取得群組設定
  const getGroupConfig = (groupName: string) => groups.find(g => g.name === groupName);

  // 勾選切換
  const toggleSelect = (id: number) => {
    setSelected(sel => sel.includes(id) ? sel.filter(i => i !== id) : [...sel, id]);
  };

  // 全選/全不選
  const toggleSelectAll = (ids: number[]) => {
    setSelected(sel => sel.length === ids.length ? [] : ids);
  };

  // 批量設定群組
  const batchSetGroup = async () => {
    if (!batchGroup) return;
    // 更新本地狀態
    setBomItems(items => items.map(item => selected.includes(item.id) ? { ...item, group_name: batchGroup } : item));
    // 批量更新 Supabase
    await Promise.all(selected.map(id => supabase.from("bom").update({ group_name: batchGroup }).eq("id", id)));
    setSelected([]);
    setBatchGroup("");
  };

  let filtered = bomItems.filter(item =>
    item.product_code.includes(search) ||
    item.product_name.includes(search)
  );
  if (showUngrouped) {
    filtered = filtered.filter(item => !item.group_name);
  }
  const allIds = filtered.map(item => item.id);

  return (
    <div className="p-8 max-w-full mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6">產期告示設定</h1>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center mb-4 gap-4">
          <h2 className="text-xl font-bold text-cyan-400 flex-1">BOM生產品項</h2>
          <input
            type="text"
            className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-white w-64"
            placeholder="搜尋編碼或名稱..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            className={`px-3 py-1.5 rounded font-bold ${showUngrouped ? 'bg-orange-600 text-white' : 'bg-slate-700 text-orange-200 hover:bg-orange-500 hover:text-white'}`}
            onClick={() => setShowUngrouped(v => !v)}
          >
            顯示未設定群組品項
          </button>
          <select className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white" value={batchGroup} onChange={e => setBatchGroup(e.target.value)}>
            <option value="">批量設定群組...</option>
            {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
          </select>
          <button className="px-3 py-1.5 rounded bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:bg-slate-700" onClick={batchSetGroup} disabled={!batchGroup || selected.length === 0}>套用</button>
        </div>
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-950 text-slate-200 uppercase font-mono text-xs">
            <tr>
              <th className="p-3 w-32 whitespace-nowrap">
                <input type="checkbox" checked={selected.length === allIds.length && allIds.length > 0} onChange={() => toggleSelectAll(allIds)} />
              </th>
              <th className="p-3 w-80 whitespace-nowrap">編碼</th>
              <th className="p-3 w-128 whitespace-nowrap">名稱</th>
              <th className="p-3 w-128 whitespace-nowrap">群組</th>
              <th className="p-3 w-96 whitespace-nowrap">BOM群組</th>
              <th className="p-3 w-192 whitespace-nowrap">工序概述</th>
              <th className="p-3 w-56 whitespace-nowrap">打樣天數</th>
              <th className="p-3 w-56 whitespace-nowrap">大貨天數</th>
              <th className="p-3 w-72 whitespace-nowrap">大量大貨數量</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const group = getGroupConfig(item.group_name || "");
              return (
                <tr key={item.id}>
                  <td className="p-3 w-32 whitespace-nowrap">
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                  </td>
                  <td className="p-3 w-80 whitespace-nowrap font-mono text-slate-300">{item.product_code}</td>
                  <td className="p-3 w-128 whitespace-nowrap text-white">{item.product_name}</td>
                  <td className="p-3 w-128 whitespace-nowrap">
                    <select className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white w-full" value={item.group_name || ""} onChange={e => setItemGroup(item.id, e.target.value)}>
                      <option value="">未設定</option>
                      {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                    </select>
                  </td>
                  <td className="p-3 w-96 whitespace-nowrap text-cyan-200">{item.group_name ?? '-'}
                  </td>
                  <td className="p-3 w-192 whitespace-nowrap overflow-x-auto text-slate-300" style={{maxWidth:'64rem'}}>{group?.summary ?? "-"}</td>
                  <td className="p-3 w-56 whitespace-nowrap text-cyan-300">{group?.sample_days ?? "-"}</td>
                  <td className="p-3 w-56 whitespace-nowrap text-orange-300">{group?.mass_days ?? "-"}</td>
                  <td className="p-3 w-72 whitespace-nowrap text-yellow-300">{group?.mass_qty_standard ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}