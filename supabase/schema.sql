-- Run once in your own Supabase project's SQL Editor. No browser database access.
create table if not exists public.gip_state (
  id text primary key check (id = 'main'),
  version bigint not null default 0,
  data jsonb not null
);
alter table public.gip_state enable row level security;
revoke all on public.gip_state from public, anon, authenticated;
grant select, insert, update on public.gip_state to service_role;

create or replace function public.gip_cas(expected_version bigint, next_state jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare changed integer;
begin
  update public.gip_state set data = next_state, version = version + 1
    where id = 'main' and version = expected_version;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.gip_cas(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.gip_cas(bigint, jsonb) to service_role;
