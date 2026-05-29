-- ─────────────────────────────────────────────────────────────────────────────
-- IGNITION OS — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- ── SHOPS (one row per shop, replaces hardcoded DataBridge shop_info) ─────────
create table if not exists shops (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text,
  email        text,
  address      text,
  usdot        text,
  bay_count    int default 4,
  tier         text default 'TRIAL' check (tier in ('TRIAL','STARTER','PROFESSIONAL','PREMIER')),
  trial_started_at timestamptz default now(),
  is_active    boolean default true,
  created_at   timestamptz default now()
);

-- ── USERS (techs, service writers, admins — per shop) ────────────────────────
create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid references shops(id) on delete cascade,
  name         text not null,
  pin_hash     text not null,
  role         text default 'TECHNICIAN' check (role in ('ADMIN','SERVICE','TECHNICIAN','DEVELOPER')),
  permissions  text[] default array['TECH'],
  is_active    boolean default true,
  created_at   timestamptz default now()
);

-- ── JOBS (was shop_db.json → jobs) ───────────────────────────────────────────
create table if not exists jobs (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid references shops(id) on delete cascade,
  wo_number    text,
  status       text default 'INTAKE',
  vehicle      jsonb,
  customer     jsonb,
  tech_id      uuid references users(id),
  parts        jsonb default '[]',
  labor        jsonb default '[]',
  notes        text,
  total        numeric(10,2) default 0,
  approved     boolean default false,
  signature    text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── PURCHASE ORDERS (vendor parts orders) ────────────────────────────────────
create table if not exists purchase_orders (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid references shops(id) on delete cascade,
  job_id       uuid references jobs(id),
  vendor_id    text,
  vendor_name  text,
  status       text default 'PENDING' check (status in ('PENDING','SENT','IN_TRANSIT','DELIVERED','RECEIVED')),
  line_items   jsonb default '[]',
  total        numeric(10,2) default 0,
  driver_token text unique,
  driver_lat   numeric(10,7),
  driver_lng   numeric(10,7),
  driver_last_ping timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── TOOLS (shop equipment, truck gear, tech-assigned tools) ──────────────────
create table if not exists tools (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid references shops(id) on delete cascade,
  barcode_id   text unique,
  name         text not null,
  type         text,
  brand        text,
  model        text,
  serial       text,
  assigned_to  jsonb,
  status       text default 'ACTIVE' check (status in ('ACTIVE','OVERDUE','OFFLINE_REPAIR','OFFLINE_MANAGER_HOLD')),
  photo_url    text,
  added_at     timestamptz default now()
);

-- ── PMI SCHEDULES (maintenance tasks per tool) ────────────────────────────────
create table if not exists pmi_schedules (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid references shops(id) on delete cascade,
  tool_id      uuid references tools(id) on delete cascade,
  tasks        jsonb default '[]',
  overrides    jsonb default '[]',
  created_at   timestamptz default now()
);

-- ── AI USAGE LOG (cost tracking per shop per call) ────────────────────────────
create table if not exists ai_usage (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid references shops(id) on delete cascade,
  task         text,
  provider     text,
  model        text,
  tokens_in    int default 0,
  tokens_out   int default 0,
  cost_usd     numeric(8,6) default 0,
  created_at   timestamptz default now()
);

-- ── FEATURE USAGE EVENTS (TRACE platform analytics — which shops use what) ──────
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

-- ── ROW LEVEL SECURITY (each shop sees only its own data) ─────────────────────
alter table shops           enable row level security;
alter table users           enable row level security;
alter table jobs            enable row level security;
alter table purchase_orders enable row level security;
alter table tools           enable row level security;
alter table pmi_schedules   enable row level security;
alter table ai_usage        enable row level security;
alter table feature_events  enable row level security;

-- Service-role bypass (your FastAPI backend uses the service key — full access)
-- Anon/frontend access is blocked until auth is wired up.
-- During pilot: use service key on backend, anon key on frontend with RLS policies added per shop.

-- ── UPDATED_AT auto-trigger ───────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists jobs_updated_at on jobs;
create trigger jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

drop trigger if exists po_updated_at on purchase_orders;
create trigger po_updated_at
  before update on purchase_orders
  for each row execute function set_updated_at();
