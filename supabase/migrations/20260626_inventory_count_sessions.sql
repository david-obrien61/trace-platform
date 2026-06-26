-- ============================================================
-- Migration: inventory_count_sessions + inventory_counts
-- Date: 2026-06-26
-- Purpose: durable record for the walk-and-count inventory loop
--   (scan → resolve → qty → save → next → complete).
--
--   A physical count SETS business_inventory.qty (on-hand) AND is recorded
--   here so a later RECONCILIATION pass (counted vs expected: sold/dead/missing)
--   can read what was counted, for which item, by whom, when, in which session.
--   Reconciliation itself is DEFERRED — this only leaves room for it.
--
-- GATED: WRITTEN, NOT APPLIED by Thunder. David applies AS `postgres` in the
--   Supabase SQL editor (project bgobkjcopcxusjsetfob), then mints a short-lived
--   PAT for catalog verification, then revokes it. Verification queries at the
--   foot of this file (information_schema / pg_catalog — never builder memory).
--
-- SAFE: two new tables only. No ALTER/DROP on any existing table. Zero rows to
--   backfill. RLS mirrors the established member-table standard (owner_all +
--   is_active_member canonical primitive, 20260622). AC-2 (business_id scoped)
--   + AC-3 (tenant isolation absolute).
--   Pre-req live function: public.is_active_member(uuid)  (20260622).
--   Pre-req live trigger fn: public.set_updated_at_generic()  (used elsewhere).
-- ============================================================

-- ── TABLE 1: inventory_count_sessions ──────────────────────
-- One row per "Start count → … → Complete" walk.
CREATE TABLE inventory_count_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'in_progress',  -- in_progress | completed | abandoned (no CHECK — AC-4, value set grows without migration)
  counted_by   uuid,       -- auth.uid() of the counter at start (nullable; informational, not an FK to auth.users)
  item_count   int         NOT NULL DEFAULT 0,              -- denormalized count of inventory_counts rows in this session
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_count_sessions_business_idx
  ON inventory_count_sessions (business_id, started_at DESC);

ALTER TABLE inventory_count_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_count_sessions_owner_all ON inventory_count_sessions
  USING (
    EXISTS (SELECT 1 FROM businesses
            WHERE id = inventory_count_sessions.business_id AND owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses
            WHERE id = inventory_count_sessions.business_id AND owner_id = auth.uid())
  );

CREATE POLICY inventory_count_sessions_member_all ON inventory_count_sessions
  USING      ( public.is_active_member(inventory_count_sessions.business_id) )
  WITH CHECK ( public.is_active_member(inventory_count_sessions.business_id) );

DROP TRIGGER IF EXISTS inventory_count_sessions_updated_at ON inventory_count_sessions;
CREATE TRIGGER inventory_count_sessions_updated_at
  BEFORE UPDATE ON inventory_count_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();


-- ── TABLE 2: inventory_counts ──────────────────────────────
-- One row per scanned/entered item within a session. THE durable count record.
CREATE TABLE inventory_counts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES inventory_count_sessions(id) ON DELETE CASCADE,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  inventory_id  uuid        REFERENCES business_inventory(id) ON DELETE SET NULL,  -- the resolved lot whose qty was set (null = unrecognized / no lot)
  plant_tag_id  text,       -- the scanned cultivar_plants.tag_id, if a plant tag resolved it
  item_label    text        NOT NULL,    -- display name counted, e.g. "Shoal Creek Vitex, 30 gal"
  counted_qty   int         NOT NULL,    -- the number Lauren counted (becomes the new on-hand for the lot)
  was_unknown   boolean     NOT NULL DEFAULT false,  -- true = scan did not resolve to a known item (flagged for later)
  raw_scan      text,       -- the raw scanned string (URL or code) for audit / re-resolution
  counted_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_counts_session_idx  ON inventory_counts (session_id);
CREATE INDEX inventory_counts_business_idx ON inventory_counts (business_id, counted_at DESC);

ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_counts_owner_all ON inventory_counts
  USING (
    EXISTS (SELECT 1 FROM businesses
            WHERE id = inventory_counts.business_id AND owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses
            WHERE id = inventory_counts.business_id AND owner_id = auth.uid())
  );

CREATE POLICY inventory_counts_member_all ON inventory_counts
  USING      ( public.is_active_member(inventory_counts.business_id) )
  WITH CHECK ( public.is_active_member(inventory_counts.business_id) );

-- inventory_counts rows are append-only by design (a count is a historical fact);
-- no updated_at trigger needed.


-- ============================================================
-- VERIFICATION (run as postgres / with PAT after applying — expect all green)
-- ============================================================
-- (A) Both tables exist + RLS enabled:
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('inventory_count_sessions','inventory_counts');
--   -- expect 2 rows, relrowsecurity = t for both
--
-- (B) Policies present (expect 2 per table = 4):
--   SELECT tablename, policyname FROM pg_policies
--   WHERE tablename IN ('inventory_count_sessions','inventory_counts') ORDER BY 1,2;
--
-- (C) FK behaviour:
--   SELECT conname, confdeltype FROM pg_constraint
--   WHERE conrelid = 'inventory_counts'::regclass AND contype='f';
--   -- inventory_id → SET NULL (n); session_id + business_id → CASCADE (c)
--
-- (D) Columns + types:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns WHERE table_name='inventory_counts' ORDER BY ordinal_position;
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns WHERE table_name='inventory_count_sessions' ORDER BY ordinal_position;
--
-- (E) is_active_member primitive present (RLS depends on it):
--   SELECT proname FROM pg_proc WHERE proname='is_active_member';
-- ============================================================
