alter table if exists public.material_substitute_rules
  add column if not exists priority integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by source_item_code
      order by updated_at asc, id asc
    ) as rn
  from public.material_substitute_rules
)
update public.material_substitute_rules r
set priority = ranked.rn
from ranked
where r.id = ranked.id
  and (r.priority is null or r.priority <= 0);

alter table public.material_substitute_rules
  alter column priority set default 1;

update public.material_substitute_rules
set priority = 1
where priority is null or priority <= 0;

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

create unique index if not exists idx_material_substitute_rules_source_priority
  on public.material_substitute_rules (source_item_code, priority);
