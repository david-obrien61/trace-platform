-- ── CONCEPT ALIAS LEARNING TABLE ─────────────────────────────────────────────
-- Cross-shop learning: when shops dismiss false positives and name the real label,
-- those aliases accumulate here and get promoted into the audit prompt.

create table if not exists concept_aliases (
  id             uuid primary key default gen_random_uuid(),
  concept        text not null,
  alias          text not null,
  shop_id        uuid references shops(id) on delete set null,
  status         text not null default 'PENDING', -- PENDING | ACTIVE | REJECTED
  confirmed_count int not null default 1,
  created_at     timestamptz default now(),
  unique(concept, alias)
);

create index if not exists concept_aliases_concept_idx on concept_aliases(concept);
create index if not exists concept_aliases_status_idx  on concept_aliases(status);

alter table concept_aliases enable row level security;
drop policy if exists "pilot_all" on concept_aliases;
create policy "pilot_all" on concept_aliases
  for all using (true) with check (true);

-- Function to increment confirmed_count when a second shop submits the same alias
create or replace function increment_alias_count(p_concept text, p_alias text)
returns void language plpgsql as $$
begin
  update concept_aliases
  set confirmed_count = confirmed_count + 1
  where concept = p_concept and alias = p_alias;
end;
$$;

-- ── TRACE ADMIN QUERIES ───────────────────────────────────────────────────────

-- View pending aliases ready for review (3+ shops confirmed = auto-promote candidate)
-- select concept, alias, confirmed_count, status
-- from concept_aliases
-- order by confirmed_count desc, created_at desc;

-- Promote an alias to active (run manually after review)
-- update concept_aliases set status = 'ACTIVE' where concept = 'WASTE_DISPOSAL_FEE' and alias = 'Recovery Fee';

-- See all active aliases for a concept (used to build audit prompt dynamically)
-- select alias from concept_aliases where concept = 'WASTE_DISPOSAL_FEE' and status = 'ACTIVE';
