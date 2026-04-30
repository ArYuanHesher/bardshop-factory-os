-- ============================================================
-- 產期詢問記錄：升版為多品項設計
-- 執行時間：2026-04-29
-- ============================================================

-- 補欄位（若 schedule_inquiries 已存在）
alter table public.schedule_inquiries
  add column if not exists inquiry_date     date,           -- 詢問日期
  add column if not exists items            jsonb default '[]'::jsonb,
                                                            -- 產品資訊陣列
                                                            -- [{item_code, item_name, quantity}]
  add column if not exists planner_reply    text
    check (planner_reply in ('approved', 'rejected'));      -- 生管回覆

-- 索引
create index if not exists schedule_inquiries_inquiry_date_idx
  on public.schedule_inquiries (inquiry_date desc);

create index if not exists schedule_inquiries_planner_reply_idx
  on public.schedule_inquiries (planner_reply);
