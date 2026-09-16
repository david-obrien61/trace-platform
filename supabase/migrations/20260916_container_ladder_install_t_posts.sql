-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- 20260916_container_ladder_install_t_posts — T-POSTS LIVE ON THE RUNG, NOT ON A THRESHOLD
-- Ledger #343 · David's rulings 2026-09-12 (install BOM) and 2026-09-16 (one location, many reads)
--
-- WHY. The load list decided T-posts with a THRESHOLD in code — `gallons <= 65 ? 2 : 4`
-- (`loadList.ts` BOM_RULES, before this build). David, 2026-09-16: *"ONE LOCATION, MANY READS,
-- EXTREMELY FLEXIBLE. Every size is read from the ladder; each consumer applies its own math. No
-- second list of sizes, no size thresholds, no size parsed outside the resolver."* So the post count
-- becomes a property of the RUNG, and a grower who stakes a 45 with three posts edits one row.
--
-- 🔴 NOT NULL DEFAULT 0, AS DAVID SPECIFIED. A rung nobody has set takes no posts. The PROVENANCE
-- column says so in words, in the same shape as `handling_because`, so a 0 that nobody entered is
-- never mistaken for a 0 somebody measured (A9 — absent is not empty, carried by the reason).
--
-- 🔴 NO HISTORY MOVES. Nothing stores a post count computed from a rung: the load list is a print
-- view computed at read time, and `production_plan_lines` snapshots its own numerics (D-41). A
-- corrected post count changes the NEXT printed list and nothing already written.
--
-- ⚠️ NOT APPLIED. Written, not run. David applies it — AND THE CODE ON `feat/ladder-one-source`
-- MUST NOT MERGE BEFORE THIS COLUMN EXISTS: the ladder reader selects it, so on a database without
-- it every ladder read fails (the pages say "could not read sizes" rather than guessing, but every
-- surface that reads the ladder loses it). Order: apply this → run the verify block → merge.
-- ══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.container_ladder
  ADD COLUMN IF NOT EXISTS install_t_posts_per_tree integer NOT NULL DEFAULT 0
    CHECK (install_t_posts_per_tree >= 0);

ALTER TABLE public.container_ladder
  ADD COLUMN IF NOT EXISTS install_t_posts_because text NOT NULL
    DEFAULT 'not set — no posts until somebody enters them';

COMMENT ON COLUMN public.container_ladder.install_t_posts_per_tree IS
  'T-posts to stake ONE tree of this size at install. Read by the load list. 0 = none. Where the figure came from is install_t_posts_because.';
COMMENT ON COLUMN public.container_ladder.install_t_posts_because IS
  'Where install_t_posts_per_tree came from, in words. Shown beside the number on Settings → Container sizes.';

-- ─── BACKFILL — LAWNS, DAVID 2026-09-12 ───────────────────────────────────────────────────────
-- *"T-posts 2 per tree up to and including 65 gal, 4 at 95 gal and anything larger."* Written per
-- RUNG, by label, so the threshold is gone from the data as well as the code. Scoped BY NAME so it
-- cannot land on another tenant, and only on rows still carrying the column default — a re-run
-- never overwrites a figure somebody has since edited.
UPDATE public.container_ladder cl
   SET install_t_posts_per_tree = v.posts,
       install_t_posts_because  = 'LAWNS, David 2026-09-12'
  FROM public.businesses b,
       (VALUES ('slip', 0), ('4 in', 0), ('3/5 gal', 0),
               ('15 gal', 2), ('30 gal', 2), ('45 gal', 2), ('65 gal', 2),
               ('95/100', 4), ('200 gal', 4)) AS v(label, posts)
 WHERE b.id = cl.business_id
   AND b.name = 'LAWNS Tree Farm, LLC'
   AND cl.label = v.label
   AND cl.install_t_posts_because = 'not set — no posts until somebody enters them';

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run these AFTER applying. Catalog-backed, never the builder's memory (§9 gate).
-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the two columns, their types, nullability and defaults
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='container_ladder'
--      AND column_name IN ('install_t_posts_per_tree','install_t_posts_because')
--    ORDER BY column_name;
--   -- EXPECT 2 rows: install_t_posts_because text NO 'not set — …' · install_t_posts_per_tree integer NO 0
--
-- V2 · the CHECK refuses a negative (run inside a rolled-back tx)
--   BEGIN;
--   UPDATE public.container_ladder SET install_t_posts_per_tree = -1
--    WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND label = '15 gal';
--   -- EXPECT: new row … violates check constraint "container_ladder_install_t_posts_per_tree_check"
--   ROLLBACK;
--
-- V3 · LAWNS's nine rungs carry David's posts, in ladder order
--   SELECT label, volume_gallons, install_t_posts_per_tree, install_t_posts_because
--     FROM public.container_ladder
--    WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    ORDER BY sort_order;
--   -- EXPECT: slip 0 · 4 in 0 · 3/5 gal 0 · 15 gal 2 · 30 gal 2 · 45 gal 2 · 65 gal 2 · 95/100 4 · 200 gal 4,
--   --         every row 'LAWNS, David 2026-09-12'
--
-- V4 · still exactly three policies — the new columns ride them, no policy was added or dropped
--   SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.container_ladder'::regclass ORDER BY 1;
--   -- EXPECT: container_ladder_member_select r · container_ladder_settings_insert a · container_ladder_settings_update w
