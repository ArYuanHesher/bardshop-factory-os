import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface GroupConfig {
  id: number;
  name: string;
  sample_days: number;
  mass_days: number;
  summary?: string;
  order: number;
}

interface Props {
  groups: GroupConfig[];
  onOrderChange?: (newOrder: GroupConfig[]) => void;
}

export default function GroupOrderDragList({ groups, onOrderChange }: Props) {
  const [dragList, setDragList] = useState(groups);
  React.useEffect(() => {
    setDragList(groups);
  }, [groups]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const moveItem = async (idx: number, direction: "up" | "down") => {
    const newList = [...dragList];
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newList.length) return;
    // 交換順序
    [newList[idx], newList[targetIdx]] = [newList[targetIdx], newList[idx]];
    setDragList(newList);
    // 更新順序到 Supabase
    await Promise.all(
      newList.map((g, i) =>
        supabase.from("production_notice_groups").update({ order: i }).eq("id", g.id)
      )
    );
    if (onOrderChange) onOrderChange(newList);
  };

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {dragList.map((g, idx) => (
        <li
          key={g.id}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            margin: "4px 0",
            background: "#334155",
            color: "#fff",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          <button
            style={{ marginRight: 8, background: "#f59e42", color: "#334155", border: "none", borderRadius: "4px", padding: "2px 6px", cursor: idx === 0 ? "not-allowed" : "pointer" }}
            disabled={idx === 0}
            onClick={() => moveItem(idx, "up")}
            title="上移"
          >▲</button>
          <button
            style={{ marginRight: 8, background: "#f59e42", color: "#334155", border: "none", borderRadius: "4px", padding: "2px 6px", cursor: idx === dragList.length - 1 ? "not-allowed" : "pointer" }}
            disabled={idx === dragList.length - 1}
            onClick={() => moveItem(idx, "down")}
            title="下移"
          >▼</button>
          {g.name}
        </li>
      ))}
    </ul>
  );
}
