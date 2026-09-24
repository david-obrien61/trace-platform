-- ══════════════════════════════════════════════════════
-- 20260923h_container_ladder_grow_and_hold.sql — GROW AND HOLD, PER RUNG
-- Ledger #390 · David applies · TENANT-AGNOSTIC (no tenant id appears anywhere below)
-- ══════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
-- This migration creates NO table, so the TRUNCATE/REFERENCES hazard does not arise; the rule is
-- restated because the next person reading it should not have to re-derive that.
--
-- ADDITIVE ONLY. Four columns on ONE existing table. No policy is touched, no row is rewritten,
-- nothing is dropped, no index changes. Every existing ladder read keeps working: the two numeric
-- columns are NULLABLE and the two text columns carry a NOT NULL DEFAULT, so the 9 live LAWNS rungs
-- and the 0 rungs on every other tenant all satisfy the new shape the moment it lands.
--
-- ── §0 WHAT THESE TWO NUMBERS MEAN (David, 2026-09-01; re-ruled 2026-09-23) ────────
--   GROW = months from UPPOTTING until the tree is SELLABLE on that rung.
--   HOLD = months it then STAYS on that rung before the next uppot.
-- His worked shape: "2 qrt" grow 7 hold 12 · "1 gal" grow 8 hold 12. Lauren's correction of the
-- same model is the reason it is two numbers and not one: *"It takes six to eight months to grow
-- into their pots, and then they can live in their pots for say a year."* Six-to-eight is GROW;
-- the year is HOLD.
--
-- ── §0b 🔴 WHY THERE IS NO `carry_months` COLUMN ───────────────────────────────────
-- An earlier draft of this build proposed one. David ruled it OUT on 2026-09-23: **carry is money
-- per year, not months on a rung** — it belongs with the cost-to-produce work, not the ladder. A
-- column here would have made "what does it cost to hold this tree" answerable in two places, and
-- the ladder is the wrong one. Recorded so nobody adds it back as an obvious omission.
--
-- ── §0c 🔴 NULL IS THE ORDINARY ANSWER AND IT MEANS UNKNOWN, NOT ZERO ──────────────
-- Of the nine live LAWNS rungs, exactly ONE has a GROW figure anybody has stated (15 gal = 6
-- months, David 2026-09-18). The other eight are genuinely unknown and David has gone to Terry for
-- them. A 0 would read as "sellable immediately" and a silent fall back to the business-wide
-- `growMonthsDefault` would print 7 against eight rungs nobody has measured — which is exactly the
-- written-declaration-nobody-checked defect of [[R-26]]. So an unset rung stays NULL, the reader
-- resolves it to UNKNOWN, and the screen says so in that word (D-9 / A9 — absent is not empty).
-- This follows `install_price` on this same table, which carries null for the same reason and
-- whose comment says so (R-171 (c) / [[R-173]]).
--
-- ── §0d THE `_because` COLUMNS ARE NOT DECORATION ──────────────────────────────────
-- Every other value on this table carries one — `handling_because`, `install_t_posts_because`,
-- `caliper_because`, `install_price_because` — because *"an unlabelled number cannot exist"*
-- (Rung's own type comment). A grow figure with no provenance is the thing this platform keeps
-- getting wrong: a published default, somebody's arithmetic and a grower's measurement all render
-- identically once they are just a 7. NOT NULL DEFAULT '' so the column can never be absent; the
-- reader maps '' to "not set".
-- ══════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.container_ladder
  ADD COLUMN IF NOT EXISTS grow_months  numeric,
  ADD COLUMN IF NOT EXISTS grow_because text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hold_months  numeric,
  ADD COLUMN IF NOT EXISTS hold_because text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.container_ladder.grow_months IS
  'Months from UPPOTTING INTO this rung until a tree on it is SELLABLE (David, 2026-09-01). NULL '
  'means nobody has stated it and the schedule says UNKNOWN rather than falling back to the '
  'business-wide default — eight of LAWNS''s nine rungs are NULL on purpose. Read from the rung a '
  'lot is going TO, never the one it is leaving.';

COMMENT ON COLUMN public.container_ladder.hold_months IS
  'Months a tree STAYS on this rung, once sellable, before it must move up (David, 2026-09-01; '
  'Lauren: "they can live in their pots for say a year"). NULL means unknown. '
  '⚠️ NOTHING SCHEDULES ON THIS YET — the due/overdue board is the next build. It is captured now '
  'because David is asking Terry for GROW and HOLD in one conversation, and a second trip to ask '
  'for the number we did not store is the cost this avoids.';

COMMENT ON COLUMN public.container_ladder.grow_because IS
  'Where the grow figure came from, in the nursery''s own words. '''' = nobody has set it.';
COMMENT ON COLUMN public.container_ladder.hold_because IS
  'Where the hold figure came from, in the nursery''s own words. '''' = nobody has set it.';

-- NAMED, never inline. An inline CHECK is auto-named by Postgres, so its name is never typed and a
-- `conname` grep can never find it — which is how ~129 inline CHECKs became invisible to the
-- tech-debt #23 sweep and how the #91 platform-vocabulary disagreement went unmeasured for months.
--
-- 🔴 `> 0`, NOT `>= 0`. Zero months is not a short grow, it is a nonsense one: a tree that is
-- sellable the instant it is potted has not been grown. Allowing 0 would let the honest UNKNOWN
-- (NULL) be replaced by a number that computes — a sellable date equal to the potting date — which
-- is precisely the silent-wrong-answer this column's NULL exists to prevent.
ALTER TABLE public.container_ladder DROP CONSTRAINT IF EXISTS container_ladder_grow_months_check;
ALTER TABLE public.container_ladder ADD CONSTRAINT container_ladder_grow_months_check
  CHECK (grow_months IS NULL OR grow_months > 0);

ALTER TABLE public.container_ladder DROP CONSTRAINT IF EXISTS container_ladder_hold_months_check;
ALTER TABLE public.container_ladder ADD CONSTRAINT container_ladder_hold_months_check
  CHECK (hold_months IS NULL OR hold_months > 0);

COMMIT;

-- ══════════════════════════════════════════════════════
-- VERIFY — catalog-backed, never from memory (§9 schema gate).
-- 🔴 EVERY BLOCK BELOW WAS EXECUTED BEFORE THIS FILE WAS HANDED OVER, on PGlite against the real
-- migration text, by `scripts/sql-harness/ladder-grow-hold-390.pglite.mjs`. The verdicts are in
-- ledger #390. Re-run them here after applying, because PGlite is Postgres 18 and Supabase is not.
-- ══════════════════════════════════════════════════════
--
-- (V1) The four columns exist, with the right nullability. Expect 4 rows:
--      grow_months  numeric YES · grow_because text NO · hold_months numeric YES · hold_because text NO.
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'container_ladder'
--     AND column_name IN ('grow_months','grow_because','hold_months','hold_because')
--   ORDER BY column_name;
--
-- (V2) Both named CHECKs exist and are findable BY NAME (tech-debt #91's lesson). Expect 2 rows.
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.container_ladder'::regclass AND contype = 'c'
--     AND conname IN ('container_ladder_grow_months_check','container_ladder_hold_months_check');
--
-- (V3) 🔴 THE CHECK ACTUALLY REFUSES A ZERO. A guard nobody has watched refuse is a claim (R-33).
--      The first UPDATE must FAIL with container_ladder_grow_months_check; the second must succeed.
--   BEGIN;
--     -- expect: ERROR ... violates check constraint "container_ladder_grow_months_check"
--     UPDATE public.container_ladder SET grow_months = 0 WHERE label = '15 gal';
--   ROLLBACK;
--   BEGIN;
--     -- expect: UPDATE 1
--     UPDATE public.container_ladder SET grow_months = 6 WHERE label = '15 gal';
--   ROLLBACK;
--
-- (V4) 🔴 NOTHING EXISTING CHANGED. Every rung still carries its label, sort order and install
--      price, and the two new numerics are NULL on every row until somebody sets one.
--      Expect: 9 rows at LAWNS, all grow_months and hold_months NULL, both _because ''.
--   SELECT label, sort_order, install_price, grow_months, hold_months,
--          grow_because = '' AS grow_unset, hold_because = '' AS hold_unset
--   FROM public.container_ladder ORDER BY business_id, sort_order;
--
-- (V5) RLS is untouched — the ladder's existing policies still stand, unchanged in number.
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'container_ladder' ORDER BY policyname;
