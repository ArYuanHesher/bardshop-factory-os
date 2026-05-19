-- 發料狀態追蹤表（獨立於 ARGO 同步，每次 sync 不會被清除）
-- 以 slip_no + line_no 為主鍵，標記哪些批備料明細已完成發料
create table if not exists public.erp_material_issue_status (
  slip_no   text not null,
  line_no   int  not null,
  issued_at timestamptz default now(),
  primary key (slip_no, line_no)
);

alter table public.erp_material_issue_status enable row level security;

create policy "service_role full access" on public.erp_material_issue_status
  for all to service_role using (true) with check (true);
