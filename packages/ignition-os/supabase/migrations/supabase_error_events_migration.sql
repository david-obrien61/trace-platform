-- ── ERROR EVENTS TABLE ────────────────────────────────────────────────────────
-- Captures frontend crashes, unhandled promise rejections, and AI call failures.
-- TRACE uses this to detect problems before shops complain.

create table if not exists error_events (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid references shops(id) on delete set null,
  error_type text not null, -- RENDER | UNHANDLED | PROMISE | AI_CALL | NETWORK
  message    text,
  stack      text,
  user_agent text,
  metadata   jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists error_events_shop_id_idx  on error_events(shop_id);
create index if not exists error_events_type_idx     on error_events(error_type);
create index if not exists error_events_created_idx  on error_events(created_at desc);

alter table error_events enable row level security;
drop policy if exists "pilot_all" on error_events;
create policy "pilot_all" on error_events
  for all using (true) with check (true);

-- ── TRACE MONITORING QUERIES ──────────────────────────────────────────────────

-- Errors in last 24 hours by type
-- select error_type, count(*), max(created_at) as last_seen
-- from error_events
-- where created_at > now() - interval '24 hours'
-- group by error_type order by count desc;

-- Shops with errors today (at-risk shops)
-- select s.name, e.error_type, e.message, e.created_at
-- from error_events e
-- join shops s on s.id = e.shop_id
-- where e.created_at > now() - interval '24 hours'
-- order by e.created_at desc;

-- Recurring errors (same message 3+ times = systemic bug)
-- select message, count(*), min(created_at) as first_seen, max(created_at) as last_seen
-- from error_events
-- group by message having count(*) >= 3
-- order by count desc;
