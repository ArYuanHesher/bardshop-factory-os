-- =====================================================================
-- app_settings：全站共用設定儲存表
-- key   TEXT PRIMARY KEY  — 設定鍵名
-- value JSONB             — 任意 JSON 值
-- =====================================================================
create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- 初始預設值：盤數優先前綴
insert into app_settings (key, value)
values ('material_prep_plate_prefixes', '["MACRT"]'::jsonb)
on conflict (key) do nothing;

-- RLS：登入使用者可讀寫（依需求可收緊）
alter table app_settings enable row level security;

create policy "allow_read_app_settings"
  on app_settings for select
  using (true);

create policy "allow_write_app_settings"
  on app_settings for all
  using (auth.role() = 'authenticated');
