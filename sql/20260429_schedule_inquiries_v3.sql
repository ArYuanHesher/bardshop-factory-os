-- ============================================================
-- 產期詢問記錄：新增詢問業務欄位及業務選項表
-- 執行時間：2026-04-29
-- ============================================================

-- 1. 在主表補上 salesperson 欄位
alter table public.schedule_inquiries
  add column if not exists salesperson text;   -- 詢問業務

-- 2. 業務選項表
create table if not exists public.schedule_inquiry_salespersons (
  id         bigserial primary key,
  name       text not null,
  created_at timestamptz default now(),
  constraint schedule_inquiry_salespersons_name_unique unique (name)
);

-- RLS
alter table public.schedule_inquiry_salespersons enable row level security;

drop policy if exists "schedule_inquiry_salespersons_all" on public.schedule_inquiry_salespersons;
create policy "schedule_inquiry_salespersons_all"
  on public.schedule_inquiry_salespersons
  for all
  using (true)
  with check (true);

-- 3. 將舊有 NOT NULL 欄位改為可空
--    (admin 頁面使用 items jsonb 取代原本的單品欄位，不再強制填寫)
alter table public.schedule_inquiries
  alter column customer_name drop not null,
  alter column product_name  drop not null,
  alter column author_name   drop not null;

-- 4. 將 planner_reply 的 check constraint 擴展以允許 'completed'
alter table public.schedule_inquiries
  drop constraint if exists schedule_inquiries_planner_reply_check;

alter table public.schedule_inquiries
  add constraint schedule_inquiries_planner_reply_check
    check (planner_reply in ('approved', 'rejected', 'completed'));

-- 索引
create index if not exists schedule_inquiries_salesperson_idx
  on public.schedule_inquiries (salesperson);
