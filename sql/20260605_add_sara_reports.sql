-- SARA report list (data/report)
create table if not exists public.sara_reports (
  report_id      text         primary key,
  mo_nbr         text,
  lot_nbr        text,
  item_no        text,
  product_name   text,
  job_name       text,
  job_sequence   integer,
  resource_id    integer,
  resource_name  text,
  reported_qty   numeric,
  good_qty       numeric,
  ng_qty         numeric,
  started_on     timestamptz,
  ended_on       timestamptz,
  reported_at    timestamptz,
  operator_id    text,
  operator_name  text,
  status         text,
  raw            jsonb,
  synced_at      timestamptz  not null default now()
);

create index if not exists sara_reports_mo_idx       on public.sara_reports (mo_nbr);
create index if not exists sara_reports_lot_idx      on public.sara_reports (lot_nbr);
create index if not exists sara_reports_item_idx     on public.sara_reports (item_no);
create index if not exists sara_reports_reported_idx on public.sara_reports (reported_at);

alter table public.sara_reports enable row level security;
drop policy if exists sara_reports_all on public.sara_reports;
create policy sara_reports_all on public.sara_reports for all using (true) with check (true);
