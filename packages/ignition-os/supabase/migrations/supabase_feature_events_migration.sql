-- Run this in Supabase SQL Editor to add feature usage tracking

create table if not exists feature_events (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid references shops(id) on delete cascade,
  user_role  text,
  module     text not null,
  action     text not null,
  metadata   jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists feature_events_shop_id_idx  on feature_events(shop_id);
create index if not exists feature_events_module_idx   on feature_events(module);
create index if not exists feature_events_created_idx  on feature_events(created_at desc);

alter table feature_events enable row level security;

-- Pilot open policy (same as all other tables for now)
drop policy if exists "pilot_all" on feature_events;
create policy "pilot_all" on feature_events
  for all using (true) with check (true);

-- TRACE admin query — cross-shop usage (run with service key):
-- select module, action, count(*), avg((metadata->>'recovery_potential')::numeric)
-- from feature_events
-- group by module, action
-- order by count desc;
