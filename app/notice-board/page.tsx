
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NavButton } from "../../components/NavButton";
import { supabase } from "../../lib/supabaseClient.js";


export default function NoticeBoardHome() {
  type Notice = {
    id: number;
    item_code: string;
    notice_time: string;
    group_id: number;
  };
  type Group = {
    id: number;
    name: string;
    description?: string;
    summary?: string;
    sample_days?: number;
    mass_days?: number;
    mass_qty_standard?: number;
    notices?: Notice[];
  };
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState<Record<string, string> | null>(null);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [bomItems, setBomItems] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);

  // 取得BOM與群組資料
  useEffect(() => {
    async function fetchGroupsAndBom() {
      setLoading(true);
      // 分批載入 BOM 資料
      const [{ data: groupData }] = await Promise.all([
        supabase.from("production_notice_groups").select("*").order("order")
      ]);
      setGroups(groupData || []);
      let allBomItems: Record<string, string>[] = [];
      let from = 0;
      const pageSize = 1000;
      let done = false;
      while (!done) {
        const { data: bomData } = await supabase.from("bom").select("*").range(from, from + pageSize - 1);
        if (bomData && bomData.length > 0) {
          allBomItems = allBomItems.concat(bomData);
          if (bomData.length < pageSize) {
            done = true;
          } else {
            from += pageSize;
          }
        } else {
          done = true;
        }
      }
      setBomItems(allBomItems);
      setLoading(false);
    }
    fetchGroupsAndBom();
  }, []);

  // 搜尋BOM品項編碼
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearchSubmitted(true);
    if (!search.trim()) {
      setSearchResult(null);
      return;
    }
    const found = bomItems.find(item => item.product_code === search.trim());
    setSearchResult(found || null);
  };

  return (
      <div className="relative p-4 md:p-8 max-w-6xl mx-auto min-h-screen text-slate-200">
        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-10">
          <NavButton href="/" direction="home" title="回到首頁" className="px-4 py-2" />
        </div>
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 mb-6 md:mb-10 mt-10 md:mt-0">
        {/* 主卡片 */}
        <div className={`group flex-1 min-h-[240px] md:h-72 rounded-2xl border border-cyan-700 bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 md:p-8 transition-all duration-500 shadow-lg`}> 
          <div className="mb-6 p-4 rounded-full bg-slate-800 group-hover:bg-cyan-900/50 text-slate-400 group-hover:text-cyan-400 transition-colors">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl md:text-3xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">產期告示板</h1>
          <p className="text-slate-500 text-xs mb-6 group-hover:text-slate-300 px-2">
            生產交期公告與提醒。<br/>(Schedule Notice)
          </p>
          <form onSubmit={handleSearch} className="flex gap-2 justify-center mb-4">
            <input
              type="text"
              placeholder="搜尋品項編碼..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-4 py-2 rounded bg-slate-800 border border-slate-600 text-white w-48 md:w-64"
            />
            <button type="submit" className="px-4 py-2 rounded border border-slate-600 text-slate-300 text-xs font-mono bg-transparent hover:bg-cyan-600 hover:border-cyan-600 hover:text-white transition-all font-bold">
              搜尋 &rarr;
            </button>
          </form>
          {searchResult && (
            <div className="mt-6 p-4 bg-slate-900 rounded border border-cyan-700 w-full max-w-xl mx-auto text-left">
              <div className="mb-2">品項編碼：<span className="font-mono text-cyan-400">{searchResult.product_code}</span></div>
              <div className="mb-2">品項名稱：<span className="text-white">{searchResult.product_name}</span></div>
              <div className="mb-2">所屬群組：<span className="font-bold text-orange-400">{searchResult.group_name || '-'}</span></div>
              {(() => {
                const group = groups.find(g => g.name === searchResult.group_name);
                return group ? (
                  <>
                    <div className="mb-2">工序概述：<span className="text-slate-300">{group.summary || '-'}</span></div>
                    <div className="mb-2">打樣天數：<span className="text-cyan-300">{group.sample_days ?? '-'}</span></div>
                    <div className="mb-2">大貨天數：<span className="text-orange-300">{group.mass_days ?? '-'}</span></div>
                    <div className="mb-2">大量大貨數量標準：<span className="text-yellow-300">{group.mass_qty_standard ?? '-'}</span></div>
                  </>
                ) : null;
              })()}
            </div>
          )}
          {searchSubmitted && search && !searchResult && (
            <div className="mt-6 p-4 bg-red-900 rounded border border-red-700 w-full max-w-xl mx-auto text-center text-white">
              搜尋無結果<br />請檢查品項編碼輸入是否正確，或連繫物管及生管單位確認品項編碼已更新到最新版本
            </div>
          )}
        </div>

        {/* 時間試算 快速入口 */}
        <Link href="/estimation" className="group md:w-64 min-h-[160px] md:h-72 rounded-2xl border border-emerald-700 bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 md:p-6 transition-all duration-300 shadow-lg hover:border-emerald-500 hover:bg-emerald-900/20 hover:shadow-[0_0_24px_rgba(16,185,129,0.15)]">
          <div className="mb-4 p-3 rounded-full bg-slate-800 group-hover:bg-emerald-900/50 text-slate-400 group-hover:text-emerald-400 transition-colors">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">時間試算</h2>
          <p className="text-slate-500 text-xs mb-4 group-hover:text-slate-300 px-2">生產週期評估與計算<br/>(Estimator)</p>
          <span className="px-4 py-2 rounded border border-emerald-700 text-emerald-400 text-xs font-mono group-hover:bg-emerald-600 group-hover:border-emerald-600 group-hover:text-white transition-all">
            CALCULATE &rarr;
          </span>
        </Link>
      </div>
      {/* 群組資訊卡片 */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-6">
        <h2 className="text-lg md:text-xl font-bold text-cyan-400 mb-4 md:mb-6">群組列表</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-400 min-w-[700px]">
          <thead className="bg-slate-950 text-slate-200 uppercase font-mono text-xs">
            <tr>
              <th className="p-2 md:p-3 whitespace-nowrap">群組名稱</th>
              <th className="p-2 md:p-3 whitespace-nowrap">工序概述</th>
              <th className="p-2 md:p-3 whitespace-nowrap">打樣天數</th>
              <th className="p-2 md:p-3 whitespace-nowrap">大貨天數</th>
              <th className="p-2 md:p-3 whitespace-nowrap">大量大貨數量標準</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">載入中...</td></tr>
            ) : (
              groups.map((g, idx) => (
                <tr key={idx}>
                  <td className="p-2 md:p-3 whitespace-nowrap text-white">{g.name}</td>
                  <td className="p-2 md:p-3 whitespace-nowrap text-slate-300">{g.summary || '-'}</td>
                  <td className="p-2 md:p-3 whitespace-nowrap text-cyan-300">{g.sample_days}</td>
                  <td className="p-2 md:p-3 whitespace-nowrap text-orange-300">{g.mass_days}</td>
                  <td className="p-2 md:p-3 whitespace-nowrap text-yellow-300">{g.mass_qty_standard ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
