-- ══════════════════════════════════════════════════════
-- 20260923k_rung_sellability.sql — WHICH RUNGS ARE SOLD AT ALL
-- Ledger #391 · David applies · TENANT-AGNOSTIC
-- ══════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR (CLAUDE.md §6 r17). Creates no table; ADDITIVE ONLY, two
-- columns on `container_ladder`. Every existing read keeps working — both columns are NOT NULL with
-- defaults that preserve today's behaviour exactly (see §0b).
-- ⚠️ DEPENDS ON `20260923h_container_ladder_grow_and_hold.sql` only in the sense that both touch
-- this table; they are independent and may be applied in either order.
--
-- ── §0 THE RULING ──────────────────────────────────────────────────────────────────
-- David, 2026-09-23, from LAWNS: *"RUNGS NEVER SOLD: slips, 4-inch, plugs. 3/5 gallon sells rarely
-- and stays sellable."* This closes the `user_stories.md` NEEDS item open since 2026-09-14 —
-- *"which rungs are never sold — the ladder has no such column, deliberately, because nobody has
-- said which they are."* Somebody has now said.
--
-- ── §0a 🔴 WHY THREE VALUES AND NOT A BOOLEAN ──────────────────────────────────────
-- `is_large` on this same table is a boolean, and a boolean was the obvious thing to copy. It would
-- have LOST a fact David stated in the same sentence: 3/5 gallon *sells rarely*. Under a boolean
-- that is either `true` (indistinguishable from 15 gal, the rung LAWNS actually sells) or `false`
-- (which would stop the schedule offering it — flatly wrong, and ruling 4 turns on the difference).
-- ⚠️ AND THE THIRD VALUE CHANGES NO BEHAVIOUR TODAY, WHICH IS SAID HERE RATHER THAN DISCOVERED:
-- `rarely_sold` reads as SELLABLE everywhere. It earns its place by recording an owner's statement
-- that would otherwise survive only in prose, and it is a closed axis, so it gets a NAMED CHECK —
-- an inline one is auto-named by Postgres and a `conname` grep can never find it (tech-debt #91).
--
-- ── §0b 🔴 THE DEFAULT IS `sold`, SO NOTHING CHANGES ON APPLY ──────────────────────
-- Every one of the 9 live LAWNS rungs becomes `sold` the moment this lands, which is exactly what
-- the platform assumes today. The two rungs David named are set by the step-0 SQL he pastes, not by
-- this migration: a migration that quietly decided `slip` was never sold would be this platform
-- stating a tenant's operating fact on its behalf, which is [[R-26]].
-- ══════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.container_ladder
  ADD COLUMN IF NOT EXISTS sellability         text NOT NULL DEFAULT 'sold',
  ADD COLUMN IF NOT EXISTS sellability_because text NOT NULL DEFAULT '';

ALTER TABLE public.container_ladder DROP CONSTRAINT IF EXISTS container_ladder_sellability_check;
ALTER TABLE public.container_ladder ADD CONSTRAINT container_ladder_sellability_check
  CHECK (sellability IN ('sold', 'rarely_sold', 'never_sold'));

COMMENT ON COLUMN public.container_ladder.sellability IS
  'sold | rarely_sold | never_sold. A PRODUCTION-ONLY rung (slip, 4 in, plug — David 2026-09-23) is '
  'never_sold: stock passes through it and is not offered at it, so the uppot plan says "not sold at '
  'this size" rather than UNKNOWN. rarely_sold IS sellable and behaves identically to sold '
  'everywhere today — it records that LAWNS sells 3/5 gal seldom, which is a fact about the '
  'business, not a rule the code branches on.';

COMMENT ON COLUMN public.container_ladder.sellability_because IS
  'Where that came from, in the nursery''s own words. '''' = nobody has said, and the default '
  '"sold" is then the platform''s assumption rather than the owner''s statement.';

COMMIT;

-- ══════════════════════════════════════════════════════
-- VERIFY — executed on PGlite before hand-over by `scripts/sql-harness/rung-dates-391.pglite.mjs`.
-- ══════════════════════════════════════════════════════
--
-- (V1) Both columns exist, NOT NULL, with the behaviour-preserving defaults. Expect 2 rows.
--   SELECT column_name, is_nullable, column_default FROM information_schema.columns
--   WHERE table_name = 'container_ladder' AND column_name IN ('sellability','sellability_because');
--
-- (V2) The CHECK exists and is findable BY NAME. Expect 1 row.
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.container_ladder'::regclass AND conname = 'container_ladder_sellability_check';
--
-- (V3) 🔴 THE CHECK REFUSES A VALUE OUTSIDE THE THREE. The ERROR IS THE PASS.
--   BEGIN;
--     -- expect: ERROR … violates check constraint "container_ladder_sellability_check"
--     UPDATE public.container_ladder SET sellability = 'sometimes' WHERE label = '15 gal';
--   ROLLBACK;
--
-- (V4) 🔴 NOTHING CHANGED ON APPLY — every rung reads `sold` with an empty reason, so the plan
--      behaves exactly as it did yesterday until somebody says otherwise. Expect 9 rows at LAWNS,
--      all sold / ''.
--   SELECT label, sort_order, sellability, sellability_because
--   FROM public.container_ladder ORDER BY business_id, sort_order;
