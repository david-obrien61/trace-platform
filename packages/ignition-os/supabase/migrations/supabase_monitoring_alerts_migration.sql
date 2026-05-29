-- ── MONITORING ALERTS TABLE ───────────────────────────────────────────────────
-- Persists every intervention alert fired by monitor.py daily cron.
-- TRACE reviews and marks actioned = true once handled.

create table if not exists monitoring_alerts (
  id          uuid primary key default gen_random_uuid(),
  alert_type  text not null,  -- TRIAL_AT_RISK | TRIAL_DAY_12 | TRIAL_EXPIRED | ERROR_SPIKE | AI_FAILURE_STREAK
  shop_id     uuid references shops(id) on delete set null,
  shop_name   text,
  detail      text,
  actioned    boolean default false,
  created_at  timestamptz default now()
);

create index if not exists monitoring_alerts_actioned_idx   on monitoring_alerts(actioned);
create index if not exists monitoring_alerts_shop_id_idx    on monitoring_alerts(shop_id);
create index if not exists monitoring_alerts_created_idx    on monitoring_alerts(created_at desc);
create index if not exists monitoring_alerts_type_idx       on monitoring_alerts(alert_type);

alter table monitoring_alerts enable row level security;
drop policy if exists "pilot_all" on monitoring_alerts;
create policy "pilot_all" on monitoring_alerts
  for all using (true) with check (true);

-- ── TRACE REVIEW QUERIES ──────────────────────────────────────────────────────

-- All open (unactioned) alerts, newest first
-- select alert_type, shop_name, detail, created_at
-- from monitoring_alerts
-- where actioned = false
-- order by created_at desc;

-- Mark alert handled
-- update monitoring_alerts set actioned = true where id = '<uuid>';

-- Alert frequency by type (last 30 days)
-- select alert_type, count(*) as fires
-- from monitoring_alerts
-- where created_at > now() - interval '30 days'
-- group by alert_type order by fires desc;
