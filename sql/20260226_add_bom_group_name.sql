-- 新增 item_routes item_name 欄位
alter table if exists public.item_routes
  add column if not exists item_name text;

-- 新增 BOM group_name 欄位
alter table if exists public.bom
  add column if not exists group_name text;
