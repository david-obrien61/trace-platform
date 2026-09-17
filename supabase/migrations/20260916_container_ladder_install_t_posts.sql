-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- 20260916_container_ladder_install_t_posts — T-POSTS LIVE ON THE RUNG, NOT ON A THRESHOLD
-- Ledger #343 · David's rulings 2026-09-12 (install BOM), 2026-09-16 (one location, many reads) and
-- 2026-09-17 (staff may read the planting figures; prepare a per-size "large" flag)
--
-- THREE PARTS, ONE FILE, SO ONE APPLY:
--   §1 install T-posts per size (+ where the figure came from), LAWNS backfilled.
--   §2 a per-size "large" flag (+ where it came from), LAWNS backfilled 30 gal and above = large.
--      🔴 NOTHING READS IT YET. `api/orders/submit.ts` still uses its own LARGE_CONTAINERS list for
--      the leakage flag until David confirms the switch (tech-debt #310). Prepared, not wired.
--   §3 `get_planting_materials(business_id)` — a READ-ONLY function so any active member (the yard
--      person included) can read the four planting figures the load list multiplies by, without
--      being granted the rest of `business_operations_config` (tech-debt #309).
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

-- ════════════════════════════════════ §1 — INSTALL T-POSTS ═════════════════════════════════════
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

-- ════════════════════════════════════ §2 — THE "LARGE" FLAG ════════════════════════════════════
-- Which sizes count as a LARGE tree for the checkout leakage flag. A column, not a threshold, for the
-- same reason posts are (David, 2026-09-16: "no size thresholds"). ⚠️ PREPARED ONLY — see the header.
ALTER TABLE public.container_ladder
  ADD COLUMN IF NOT EXISTS is_large boolean NOT NULL DEFAULT false;

ALTER TABLE public.container_ladder
  ADD COLUMN IF NOT EXISTS is_large_because text NOT NULL
    DEFAULT 'not set — not large until somebody says so';

COMMENT ON COLUMN public.container_ladder.is_large IS
  'A LARGE tree for the checkout leakage flag. Prepared by ledger #343; not read until David confirms it replaces submit.ts LARGE_CONTAINERS (tech-debt #310).';

-- LAWNS default, David 2026-09-17: "30 gal and above = large". Scoped by name; a re-run never
-- overwrites a figure somebody has since edited.
UPDATE public.container_ladder cl
   SET is_large = v.large,
       is_large_because = 'LAWNS, David 2026-09-17 — 30 gal and above'
  FROM public.businesses b,
       (VALUES ('slip', false), ('4 in', false), ('3/5 gal', false), ('15 gal', false),
               ('30 gal', true), ('45 gal', true), ('65 gal', true), ('95/100', true), ('200 gal', true)) AS v(label, large)
 WHERE b.id = cl.business_id
   AND b.name = 'LAWNS Tree Farm, LLC'
   AND cl.label = v.label
   AND cl.is_large_because = 'not set — not large until somebody says so';

-- ═════════════════════════════ §3 — THE PLANTING FIGURES, READ-ONLY ═════════════════════════════
-- `business_operations_config` is gated `settings:read`, and STAFF hold no `settings:*` string
-- (tech-debt #188) — so the person carrying the load list could not read what it multiplies by.
-- David, 2026-09-17: staff may READ the four planting figures. This returns EXACTLY those (plus the
-- gallons-per-cubic-yard figure the same page converts with), to any ACTIVE member of the business,
-- and nothing else from the row. It writes nothing. No permission string is minted.
--   · not a member (or no session)   → NULL   (a refusal, never an empty object)
--   · a member, nothing saved        → '{}'   (the page then uses the standard figures and says so)
--   · a member, figures saved        → only the saved keys among the five
CREATE OR REPLACE FUNCTION public.get_planting_materials(p_business_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN NOT public.is_active_member(p_business_id) THEN NULL
    ELSE COALESCE((
      SELECT jsonb_strip_nulls(jsonb_build_object(
        'installMixContainerVolumesPerTree', c.config -> 'installMixContainerVolumesPerTree',
        'ropeFeetPerTPost',                  c.config -> 'ropeFeetPerTPost',
        'bubblersPerTree',                   c.config -> 'bubblersPerTree',
        'deerFenceTPostsPerTree',            c.config -> 'deerFenceTPostsPerTree',
        'trueGallonsPerCubicYard',           c.config -> 'trueGallonsPerCubicYard'))
        FROM public.business_operations_config c
       WHERE c.business_id = p_business_id), '{}'::jsonb)
  END
$$;

-- anon must not hold EXECUTE (tech-debt #237: the default ACL grants it to anon unless revoked).
REVOKE ALL ON FUNCTION public.get_planting_materials(uuid) FROM public;
REVOKE ALL ON FUNCTION public.get_planting_materials(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_planting_materials(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_planting_materials(uuid) IS
  'Read-only: the load list planting figures for any active member (ledger #343, tech-debt #309). NULL = not a member.';

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run these AFTER applying. Catalog-backed, never the builder's memory (§9 gate).
-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the four new columns, their types, nullability and defaults
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='container_ladder'
--      AND column_name IN ('install_t_posts_per_tree','install_t_posts_because','is_large','is_large_because')
--    ORDER BY column_name;
--   -- EXPECT 4 rows: install_t_posts_because text NO 'not set — …' · install_t_posts_per_tree integer NO 0 ·
--   --                is_large boolean NO false · is_large_because text NO 'not set — …'
--
-- V2 · the CHECK refuses a negative (run inside a rolled-back tx)
--   BEGIN;
--   UPDATE public.container_ladder SET install_t_posts_per_tree = -1
--    WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND label = '15 gal';
--   -- EXPECT: new row … violates check constraint "container_ladder_install_t_posts_per_tree_check"
--   ROLLBACK;
--
-- V3 · LAWNS's nine rungs carry David's posts and the large flag, in ladder order
--   SELECT label, volume_gallons, install_t_posts_per_tree, install_t_posts_because, is_large
--     FROM public.container_ladder
--    WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    ORDER BY sort_order;
--   -- EXPECT posts: slip 0 · 4 in 0 · 3/5 gal 0 · 15 gal 2 · 30 gal 2 · 45 gal 2 · 65 gal 2 · 95/100 4 · 200 gal 4,
--   --         every row 'LAWNS, David 2026-09-12'
--   -- EXPECT is_large: false for slip, 4 in, 3/5 gal, 15 gal · true for 30, 45, 65, 95/100, 200
--
-- V4 · the policies are unchanged, and the read function exists, is not callable by anon, and refuses a non-member
--   SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.container_ladder'::regclass ORDER BY 1;
--   -- EXPECT: container_ladder_member_select r · container_ladder_settings_insert a · container_ladder_settings_update w
--   SELECT has_function_privilege('anon', 'public.get_planting_materials(uuid)', 'EXECUTE') AS anon_can,
--          has_function_privilege('authenticated', 'public.get_planting_materials(uuid)', 'EXECUTE') AS auth_can,
--          public.get_planting_materials('ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS as_sql_editor;
--   -- EXPECT: anon_can false · auth_can true · as_sql_editor NULL
--   --   (the SQL editor has no signed-in user, so it is not a member — NULL is the refusal, working)
