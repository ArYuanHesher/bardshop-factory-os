-- 替代料號規則（單向）：
-- source_item_code 被 substitute_item_code 取代

create table if not exists public.material_substitute_rules (
  id bigserial primary key,
  source_item_code text not null,
  substitute_item_code text not null,
  priority integer not null default 1,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_substitute_rules_source_diff_substitute
    check (source_item_code <> substitute_item_code),
  constraint material_substitute_rules_priority_positive
    check (priority > 0),
  constraint material_substitute_rules_unique_pair
    unique (source_item_code, substitute_item_code)
);

alter table if exists public.material_substitute_rules
  add column if not exists priority integer;

update public.material_substitute_rules
set priority = 1
where priority is null or priority <= 0;

alter table public.material_substitute_rules
  alter column priority set default 1;

alter table public.material_substitute_rules
  alter column priority set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_substitute_rules_priority_positive'
      and conrelid = 'public.material_substitute_rules'::regclass
  ) then
    alter table public.material_substitute_rules
      add constraint material_substitute_rules_priority_positive
      check (priority > 0);
  end if;
end
$$;

create index if not exists idx_material_substitute_rules_source
  on public.material_substitute_rules (source_item_code);

create index if not exists idx_material_substitute_rules_substitute
  on public.material_substitute_rules (substitute_item_code);

create unique index if not exists idx_material_substitute_rules_source_priority
  on public.material_substitute_rules (source_item_code, priority);

create or replace function public.material_substitute_rules_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_material_substitute_rules_set_updated_at on public.material_substitute_rules;
create trigger trg_material_substitute_rules_set_updated_at
before update on public.material_substitute_rules
for each row
execute function public.material_substitute_rules_set_updated_at();

create or replace function public.material_substitute_rules_prevent_reverse()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.material_substitute_rules r
    where r.source_item_code = new.substitute_item_code
      and r.substitute_item_code = new.source_item_code
      and (tg_op = 'INSERT' or r.id <> new.id)
  ) then
    raise exception '已存在反向規則 % -> %，不可建立雙向替代', new.substitute_item_code, new.source_item_code;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_material_substitute_rules_prevent_reverse on public.material_substitute_rules;
create trigger trg_material_substitute_rules_prevent_reverse
before insert or update on public.material_substitute_rules
for each row
execute function public.material_substitute_rules_prevent_reverse();
