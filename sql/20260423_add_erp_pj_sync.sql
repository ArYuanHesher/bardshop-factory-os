-- ERP PJ 同步區：儲存從 ARGO PJ_PROJECT / PJ_PROJECTDETAIL 同步的四類單據
-- doc_type: '銷售訂單' | '製令單號' | '採購單號' | '委外製令'

create table if not exists public.erp_pj_sync (
  id            bigint generated always as identity primary key,
  doc_type      text         not null,  -- 單據類型標籤
  doc_no        text         not null,  -- 主單號
  sub_no        text         not null default '',  -- 子序號（可空）
  item_code     text,
  description   text,
  qty           numeric      default 0,
  unit          text,
  status        text,
  start_date    text,
  end_date      text,
  customer_vendor text,
  remark        text,
  extra         jsonb,                  -- 其餘欄位一律存 JSON
  synced_at     timestamptz  not null default now(),
  unique (doc_type, doc_no, sub_no)
);

create index if not exists erp_pj_sync_doc_type_idx on public.erp_pj_sync (doc_type);
create index if not exists erp_pj_sync_doc_no_idx   on public.erp_pj_sync (doc_no);
create index if not exists erp_pj_sync_item_code_idx on public.erp_pj_sync (item_code);

-- RLS: 允許已登入使用者讀取，service role 寫入
alter table public.erp_pj_sync enable row level security;

create policy "erp_pj_sync_select" on public.erp_pj_sync
  for select using (true);
