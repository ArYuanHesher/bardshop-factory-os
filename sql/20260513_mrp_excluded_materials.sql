-- =====================================================================
-- mrp_excluded_materials：MRP 計算時排除的原料料號
-- 可透過 MRP 測試區頁面自行新增 / 刪除
-- item_code  TEXT UNIQUE  — 被排除的原料料號
-- note       TEXT         — 排除原因說明（選填）
-- =====================================================================
create table if not exists public.mrp_excluded_materials (
  id         bigserial primary key,
  item_code  text not null unique,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists mrp_excl_item_code_idx
  on public.mrp_excluded_materials (item_code);

alter table public.mrp_excluded_materials enable row level security;

drop policy if exists "allow_read_mrp_excluded_materials" on public.mrp_excluded_materials;
drop policy if exists "allow_write_mrp_excluded_materials" on public.mrp_excluded_materials;

create policy "mrp_excluded_materials_all"
  on public.mrp_excluded_materials for all
  using (true) with check (true);
