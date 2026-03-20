"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../../lib/supabaseClient";

interface DiffItem {
  code: string;
  source: "工序母資料庫" | "BOM表";
}

export default function MaterialCodeDiffPage() {
  const [diffs, setDiffs] = useState<DiffItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAndCompare() {
      setLoading(true);
      // 假設工序母資料庫的品項編碼欄位為 item_code，表名為 operation_items
      // BOM表的品項編碼欄位為 product_code，表名為 bom
      const [{ data: opData }, { data: bomData }] = await Promise.all([
        supabase.from("operation_items").select("item_code"),
        supabase.from("bom").select("product_code")
      ]);
      const opCodes = (opData || []).map((x: { item_code: string }) => x.item_code);
      const bomCodes = (bomData || []).map((x: { product_code: string }) => x.product_code);
      const opSet = new Set(opCodes);
      const bomSet = new Set(bomCodes);
      const onlyInOp = opCodes.filter(code => !bomSet.has(code)).map(code => ({ code, source: "工序母資料庫" as const }));
      const onlyInBom = bomCodes.filter(code => !opSet.has(code)).map(code => ({ code, source: "BOM表" as const }));
      setDiffs([...onlyInOp, ...onlyInBom]);
      setLoading(false);
    }
    fetchAndCompare();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-cyan-600">品項編碼差異比對</h1>
      <p className="text-slate-400 mb-4">僅顯示只存在於其中一個表的品項編碼。</p>
      {loading ? (
        <div className="text-slate-400">載入中...</div>
      ) : diffs.length === 0 ? (
        <div className="text-green-500">兩表品項編碼皆有對應，無差異。</div>
      ) : (
        <table className="w-full text-left text-sm text-slate-300 border border-slate-700 rounded">
          <thead className="bg-slate-800 text-cyan-300">
            <tr>
              <th className="p-3">品項編碼</th>
              <th className="p-3">出現於</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-700">
                <td className="p-3 font-mono">{item.code}</td>
                <td className="p-3">{item.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
