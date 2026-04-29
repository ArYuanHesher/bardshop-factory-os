-- ============================================================
-- 開單異常統計：下拉選項 & 紀錄主表
-- 執行時間：2026-04-29
-- ============================================================

-- 1. 下拉選單選項表
create table if not exists public.order_anomaly_options (
  id            bigserial primary key,
  option_type   text      not null
                  check (option_type in ('category', 'department', 'person')),
                  -- category   = 異常分類
                  -- department = 權責部門
                  -- person     = 異常發生人員
  option_value  text      not null,
  created_at    timestamptz default now()
);

-- 2. 開單異常紀錄主表
create table if not exists public.order_anomaly_records (
  id                      bigserial primary key,
  anomaly_date            date,           -- 異常日期
  anomaly_category        text,           -- 異常分類
  responsible_department  text,           -- 權責部門
  responsible_person      text,           -- 異常發生人員
  anomaly_description     text,           -- 異常狀況概述（手動輸入）
  resolution              text,           -- 處理結果（手動輸入）
  attachments             text[] default '{}', -- 圖片/檔案公開 URL 陣列
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ============================================================
-- RLS（若有使用 Supabase Auth，可依實際需求修改）
-- ============================================================

alter table public.order_anomaly_options enable row level security;
alter table public.order_anomaly_records  enable row level security;

-- 開放所有人讀寫（開發階段）；正式環境請改為 auth.role() = 'authenticated'
drop policy if exists "order_anomaly_options_all" on public.order_anomaly_options;
create policy "order_anomaly_options_all"
  on public.order_anomaly_options
  for all
  using (true)
  with check (true);

drop policy if exists "order_anomaly_records_all" on public.order_anomaly_records;
create policy "order_anomaly_records_all"
  on public.order_anomaly_records
  for all
  using (true)
  with check (true);

-- ============================================================
-- 補欄位（若資料表已存在，補上後來新增的欄位）
-- ============================================================

alter table public.order_anomaly_records
  add column if not exists anomaly_date date;

-- ============================================================
-- 索引
-- ============================================================

create index if not exists order_anomaly_records_category_idx
  on public.order_anomaly_records (anomaly_category);

create index if not exists order_anomaly_records_dept_idx
  on public.order_anomaly_records (responsible_department);

create index if not exists order_anomaly_records_person_idx
  on public.order_anomaly_records (responsible_person);

create index if not exists order_anomaly_records_created_idx
  on public.order_anomaly_records (created_at desc);

create index if not exists order_anomaly_options_type_idx
  on public.order_anomaly_options (option_type, option_value);

-- ============================================================
-- Storage Bucket（於 Supabase Dashboard 手動建立，或執行下方 SQL）
-- 使用與品保異常相同的 bucket: anomaly-attachments
-- 路徑前綴: order-anomaly/
-- 若尚未建立 bucket，請在 Supabase Storage 建立 bucket name = anomaly-attachments
-- ============================================================

-- ============================================================
-- 初始預設選項（可依需求修改或移除）
-- ============================================================

insert into public.order_anomaly_options (option_type, option_value) values
  -- 異常分類
  ('category', '開單錯誤'),
  ('category', '規格異常'),
  ('category', '數量異常'),
  ('category', '交期異常'),
  ('category', '客戶需求變更'),
  -- 權責部門
  ('department', '業務部'),
  ('department', '生管部'),
  ('department', '工程部'),
  ('department', '採購部'),
  ('department', '品保部'),
  -- 異常發生人員（預設空，由使用者新增）
  ('person', '待指定')
on conflict do nothing;
