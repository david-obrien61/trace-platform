-- READ-ONLY DISCOVERY. WRITES NOTHING.
--
-- Question: which container-ladder rungs are stored for LAWNS and Test Dave's, in ladder order?
--
-- ✅ THE TABLE EXISTS — ✏️ UPDATED 2026-09-16. David applied `20260914_container_ladder.sql` on
-- 2026-09-16 and ran V1–V4 (12 columns · RLS with three policies r/a/w, no delete · nine LAWNS rungs ·
-- a duplicate label refused); `verify-migration-apply-state.mjs --catalog` lists it APPLIED. Q1 is
-- therefore UNCOMMENTED and runs. The paragraph below is what this file said when it was written, kept
-- because it records the mistake: the four files it quotes were wrong, and I did not read the database.
--
-- ⚠️ (AS WRITTEN) THE TABLE MAY NOT EXIST. Everything on disk says `public.container_ladder` has NOT been applied
-- (measured on origin/main 2a2f862, 2026-09-16):
--   · supabase/migrations/20260914_container_ladder.sql:32 — "⚠️ NOT APPLIED. Written, not run."
--   · docs/open-questions.md:165 — "BLOCKING — THE MIGRATION IS NOT APPLIED."
--   · TRACE-SESSION-BOOTSTRAP.md:592 — "MIGRATION … NOT APPLIED — CARDS 22–27 BLOCKED"
--   · docs/owner-tests/uppot-planning-full-surface-test.md:476 — "MIGRATION GATE … IS NOT APPLIED."
-- None of those is a catalog read. So this file ASKS the catalog first (Q0) and, because a SELECT
-- from a missing table is an error rather than an empty result, Q1 is commented out.
--
-- HOW TO RUN
--   Run the whole file. Q0 should return true; Q1 returns the rungs.
--
-- WHAT Q1 SHOWS (measured read-only 2026-09-16 — it matches V3): nine LAWNS rows (slip · 4 in · 3/5 gal · 15 gal ·
-- 30 gal · 45 gal · 65 gal · 95/100 · 200 gal, sort_order 10…90) and ZERO rows for Test Dave's — the
-- seed is scoped `WHERE b.name = 'LAWNS Tree Farm, LLC'` (20260914_container_ladder.sql:144).
-- Columns are every column the migration creates (20260914_container_ladder.sql:35-67); no T-post,
-- mix-ratio or other BOM column exists on this table YET. ⚠️ Branch `feat/ladder-one-source` (ledger
-- #343) adds `install_t_posts_per_tree` and `install_t_posts_because` in
-- `20260916_container_ladder_install_t_posts.sql`; once that is applied, add both to Q1. They are
-- left out here because naming a column that does not exist yet makes the whole query fail.

-- ── Q0 · does the table exist? ────────────────────────────────────────────────────────────────────
SELECT to_regclass('public.container_ladder') IS NOT NULL AS table_exists;

-- ── Q1 · every rung, both tenants, in ladder order ─────────────────────────────────────────────────
SELECT
  b.name                AS business_name,
  cl.id,
  cl.business_id,
  cl.label,
  cl.aliases,
  cl.sort_order,
  cl.volume_gallons,
  cl.handling_minutes,
  cl.handling_because,
  cl.active,
  cl.retired_at,
  cl.created_at,
  cl.updated_at
FROM public.container_ladder cl
JOIN public.businesses b ON b.id = cl.business_id
WHERE cl.business_id IN (
  'ed2e5933-45dc-4b9b-a331-ddfd125e7a74',  -- LAWNS Tree Farm, LLC
  'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'   -- Test Dave's Tree Nest
)
ORDER BY b.name, cl.sort_order;
