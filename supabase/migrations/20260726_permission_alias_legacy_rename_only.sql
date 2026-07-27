-- ════════════════════════════════════════════════════════════════════════════════
-- 20260726 — ALIAS LAYER CORRECTION: THE LEGACY SIDE IS RENAME-ONLY
-- ════════════════════════════════════════════════════════════════════════════════
-- CORRECTS: 20260726_permission_alias_layer.sql (same day). That file APPLIED and is NOT
--           edited — §6 rule 1, append-only. This file is the durable record of a defect
--           FOUND LIVE 2026-07-26 and CLOSED BY HAND in the SQL editor the same day; it
--           re-states that hand-fix as an idempotent, replayable migration so a fresh
--           database reaches the shape the live one is already in.
-- SPEC:     docs/resource-action-permission-spec.md (v3) §8.
-- PLAN:     docs/decisions/2026-07-26-rbac-build-plan.md SEQUENCE Phase 0.
--
-- ⚠️ SCOPE — WHAT THIS FILE DELIBERATELY DOES NOT DO (David, 2026-07-26 — scope split).
--   NO column rename. NO permissionManifest.ts edit. NO capP change. Those are a SEPARATE
--   FOLLOW-ON COMMIT. This file ships the correction and nothing else.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- THE SEMANTICS — DIRECTED, ONE HOP. READ THIS BEFORE CHANGING A ROW.
-- ════════════════════════════════════════════════════════════════════════════════
-- The table is NOT a symmetric equivalence set. Each row is a DIRECTED edge, read off the
-- resolver in 20260726_permission_alias_layer.sql §3:
--
--     permissions ?| (SELECT array_agg(a.implies_perm) WHERE a.from_perm = p_perm)
--
--   · from_perm    = THE STRING BEING CHECKED — p_perm, what the gate asks for.
--   · implies_perm = A STRING THE MEMBER MAY HOLD that satisfies that check.
--
-- Read a row as: "a gate checking <from_perm> is satisfied by a member holding <implies_perm>."
-- Resolution is ONE HOP. There is no transitive closure and none is wanted: implies_perm is
-- never itself re-resolved, so no chain of aliases can compound into a grant nobody wrote.
--
-- ⚠️ `permissionManifest.ts` ALIAS_PAIRS labels these two directions with its own comments
--    ("forward" / "reverse"), and those labels are INVERTED relative to the resolver above.
--    It did not matter while the set was symmetric. It matters now. Correcting that comment
--    (and the generator) is the FOLLOW-ON COMMIT — flagged here, not done here.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- THE DEFECT — THE CONSTRAINT WAS ON THE WRONG SIDE
-- ════════════════════════════════════════════════════════════════════════════════
-- A unique index `permission_aliases_one_reverse_target` had been placed on the NEW-CHECKED
-- side, forcing "one satisfier per resource:verb string". That is wrong in BOTH directions
-- at once:
--
--   (a) IT FORBIDS A LEGITIMATE ROW. `pricing_recipe:update` is a replacement of BOTH
--       `manage_settings` AND `view_pricing_config`. A member holding EITHER legacy string
--       genuinely satisfies a `pricing_recipe:update` check, so that from_perm carries TWO
--       satisfiers by design. The index made the second row unwritable, and one of the pair
--       was lost. §2 below puts it back.
--
--   (b) IT LEFT THE ACTUAL HOLE OPEN. The widening the layer's own header names — "a holder
--       of inventory:read satisfies a view_costs policy, which during the window also admits
--       cost_objects/receipts" — lives on the LEGACY-CHECKED side, which the index never
--       touched. A gate checking `view_costs` (a 1→14 SPLIT) was satisfied by holding ANY
--       ONE of the 14. That is not an alias; that is a grant the model never made.
--
-- THE ASYMMETRY, STATED ONCE:
--   · NEW-CHECKED (from_perm LIKE '%:%') — MANY satisfiers are CORRECT. A coarse legacy
--     string that decomposes INTO the fine one really does imply it. Containment holds.
--   · LEGACY-CHECKED (from_perm NOT LIKE '%:%') — exactly ONE satisfier, and only when the
--     mapping is a pure 1:1 RENAME. A SPLIT does not run backwards: holding one of fourteen
--     shards is not holding the bundle. Constrained by the partial unique index in §4.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- NEUTRALITY TODAY, AND THE ONE COST — BOTH STATED HONESTLY
-- ════════════════════════════════════════════════════════════════════════════════
-- NEUTRAL TODAY, by the same construction Phase 0 is neutral by: NO member holds a
-- resource:verb string yet (the backfill is Phase 6) and every live policy still checks a
-- legacy string, so the direct containment test hits and the rows deleted below have no
-- live reader. W5 measures that rather than asserting it.
--
-- THE COST: the layer's header claims order-independence between the flips and the backfill
-- because old and new "mutually satisfy each other's checks." After this correction that is
-- true for the 7 RENAMES and NOT true for the 9 SPLITS — a member backfilled to the 14 new
-- strings would FAIL a surviving `view_costs` gate. That does not break the plan, because
-- invariant (ii) already REQUIRES all capability flips (Phases 1–5) to complete BEFORE the
-- backfill (Phase 6). It does change invariant (ii) from prudent to LOAD-BEARING. Recorded
-- here so the next person does not discover it by reordering the phases.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- SUPERSEDES the verify blocks of the layer migration:
--   · ITS V1 (total 92 · distinct_from 61 · legacy_sources 16) is now W1 (53 · 52 · 7).
--   · ITS V2 (every pair has its mirror — EXPECT 0 rows) is now EXPECTED to return the 39
--     new-checked rows whose legacy mirror this file deletes. That is the intended shape,
--     not an orphan-edge defect. W2/W6 below replace it.
--   · Its V3–V8 stand unchanged.
--
-- APPLY AS: postgres (Supabase SQL editor, project bgobkjcopcxusjsetfob).
-- IDEMPOTENT: every statement is a no-op on a database already in the corrected shape —
-- which the LIVE database already is, by the 2026-07-26 hand-fix. Re-running is safe.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- §1 — DROP THE CONSTRAINT THAT WAS ON THE WRONG SIDE
-- ════════════════════════════════════════════════════════════════════════════════
-- Dropped FIRST: §2's insert is exactly the row this index forbade.
DROP INDEX IF EXISTS public.permission_aliases_one_reverse_target;

-- ════════════════════════════════════════════════════════════════════════════════
-- §2 — RESTORE THE ROW THE INDEX FORBADE
-- ════════════════════════════════════════════════════════════════════════════════
-- `pricing_recipe:update` is the replacement of BOTH manage_settings AND view_pricing_config.
-- Both satisfiers are correct; both must exist. (The view_pricing_config row survived and is
-- re-asserted here only so this file is self-contained and replayable.)
INSERT INTO public.permission_aliases (from_perm, implies_perm) VALUES
  ('pricing_recipe:update', 'manage_settings'),
  ('pricing_recipe:update', 'view_pricing_config')
ON CONFLICT (from_perm, implies_perm) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════════
-- §3 — DELETE THE LEGACY-CHECKED SPLITS (39 rows, 9 legacy strings)
-- ════════════════════════════════════════════════════════════════════════════════
-- Any legacy string carrying MORE THAN ONE satisfier is a SPLIT, and a split does not run
-- backwards. The predicate is the shape itself (>1 satisfier), not a hand-listed set, so it
-- stays correct if the seed changes. The 9 it removes today, for the record:
--   view_orders(4) · manage_orders(2) · manage_deliveries(4) · manage_customers(2)
--   manage_campaigns(2) · manage_settings(5) · view_costs(14) · view_pricing_config(2)
--   view_wages(4)
-- The 7 it LEAVES are the pure renames — a genuine 1:1 equivalence, safe in both directions:
--   qr_checkout · view_customers · view_margin · override_maintenance · apply_tax_exempt
--   apply_discount · import_pricing
-- Idempotent: after this runs, no legacy from_perm has >1 satisfier, so the subquery is empty.
DELETE FROM public.permission_aliases
 WHERE from_perm NOT LIKE '%:%'
   AND from_perm IN (
     SELECT from_perm
       FROM public.permission_aliases
      WHERE from_perm NOT LIKE '%:%'
      GROUP BY from_perm
     HAVING count(*) > 1
   );

-- ════════════════════════════════════════════════════════════════════════════════
-- §4 — THE CONSTRAINT, ON THE CORRECT SIDE
-- ════════════════════════════════════════════════════════════════════════════════
-- A legacy-checked string may carry AT MOST ONE satisfier. Partial: the new-checked side is
-- deliberately unconstrained (pricing_recipe:update carries two, correctly). This is the
-- durable form of the §3 delete — it makes a re-seed of the split rows REJECT rather than
-- silently reopen the widening.
CREATE UNIQUE INDEX IF NOT EXISTS permission_aliases_legacy_is_rename_only
  ON public.permission_aliases (from_perm)
  WHERE from_perm NOT LIKE '%:%';

COMMENT ON INDEX public.permission_aliases_legacy_is_rename_only IS
  'A LEGACY-checked permission may have AT MOST ONE satisfier, and only as a pure 1:1 RENAME. '
  'A SPLIT does not run backwards: holding one of view_costs''s 14 shards is not holding '
  'view_costs, and admitting it would widen every surviving legacy policy (cost_objects, '
  'receipts) to a shard-holder. PARTIAL BY DESIGN — the NEW-checked side is unconstrained, '
  'because a coarse legacy string that decomposes INTO a fine one genuinely implies it and '
  'pricing_recipe:update correctly carries two satisfiers (manage_settings, '
  'view_pricing_config). The predecessor index permission_aliases_one_reverse_target had this '
  'exactly backwards; found live and corrected 2026-07-26.';

-- ── the table comment, corrected where it is now false ──────────────────────────────────────
-- The layer migration's comment says "Seeded BOTH DIRECTIONS". That is no longer true of the
-- splits, and the next person reads this comment where they are standing — so it is corrected
-- here rather than left to a doc. The two invariants are PRESERVED VERBATIM in force.
COMMENT ON TABLE public.permission_aliases IS
  'Migration-window equivalence between the legacy permission vocabulary and resource:verb '
  '(spec v3 §8). DIRECTED, ONE HOP: a row means "a gate checking from_perm is satisfied by a '
  'member holding implies_perm". No transitive closure. ASYMMETRIC BY RULE (corrected '
  '2026-07-26): a NEW-checked string may have MANY satisfiers (a coarse legacy string that '
  'decomposes into it genuinely implies it); a LEGACY-checked string may have AT MOST ONE, and '
  'only as a pure RENAME — enforced by permission_aliases_legacy_is_rename_only. The 1-to-many '
  'SPLITS are seeded in ONE direction only (new-checked), because holding one shard is not '
  'holding the bundle. TWO INVARIANTS STILL CLOSE THE RESIDUAL WINDOW AND BOTH MUST HOLD: '
  '(i) BACKFILL IS RENAME-ONLY — no member receives a string whose legacy antecedent they did '
  'not already hold; NO BUNDLE SEEDING (the MANAGER/STAFF bundles seed FRESH roles, they are '
  'not migration targets). (ii) ALL CAPABILITY FLIPS (Phases 1-5) COMPLETE BEFORE BACKFILL '
  '(Phase 6) — now LOAD-BEARING, not merely prudent: with the split rows gone, a member '
  'backfilled ahead of a surviving legacy gate would FAIL that gate. ANYONE SEEDING DEFAULT '
  'BUNDLES INTO AN EXISTING TENANT BREAKS (i). Dropped at Phase 7 CONTRACT, behind two '
  'zero-checks.';

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════
-- DAVID-QUERY VERIFIES — run AFTER applying. Uncomment one block at a time.
-- ════════════════════════════════════════════════════════════════════════════════
-- The live database was already hand-corrected on 2026-07-26 and its shape was READ, not
-- assumed: 46 rows / 45 distinct new-checked · 7 rows / 7 distinct legacy-checked. W1 asserts
-- exactly that, so re-applying this file must leave those numbers unmoved.

-- ── W1 — THE SHAPE (supersedes the layer migration's V1) ─────────────────────────────────────
-- EXPECT: total 53 · distinct_from 52 · legacy_rows 7 · legacy_sources 7 · new_rows 46 ·
--         new_sources 45
--   53 = 46 new-checked + 7 legacy-checked (renames).  52 = 45 + 7.
--   new_rows 46 vs new_sources 45: pricing_recipe:update carries TWO satisfiers, correctly.
--   legacy_rows == legacy_sources is the §4 invariant, read as a number.
-- SELECT count(*)                                                          AS total,
--        count(DISTINCT from_perm)                                         AS distinct_from,
--        count(*)                  FILTER (WHERE from_perm NOT LIKE '%:%') AS legacy_rows,
--        count(DISTINCT from_perm) FILTER (WHERE from_perm NOT LIKE '%:%') AS legacy_sources,
--        count(*)                  FILTER (WHERE from_perm LIKE '%:%')     AS new_rows,
--        count(DISTINCT from_perm) FILTER (WHERE from_perm LIKE '%:%')     AS new_sources
--   FROM public.permission_aliases;

-- ── W2 — NO LEGACY STRING CARRIES A SECOND SATISFIER (the widening, closed) ──────────────────
-- EXPECT: 0 rows. This is what §4 makes structurally impossible; W2 proves the data agrees.
-- SELECT from_perm, count(*) AS satisfiers, array_agg(implies_perm ORDER BY implies_perm)
--   FROM public.permission_aliases
--  WHERE from_perm NOT LIKE '%:%'
--  GROUP BY from_perm
-- HAVING count(*) > 1;

-- ── W3 — THE INDEXES: the wrong one gone, the right one present ──────────────────────────────
-- EXPECT: exactly 2 rows — idx_permission_aliases_from and
--         permission_aliases_legacy_is_rename_only. permission_aliases_one_reverse_target
--         MUST NOT appear.
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname = 'public' AND tablename = 'permission_aliases'
--    AND indexname <> 'permission_aliases_pkey'
--  ORDER BY indexname;

-- ── W4 — THE ROW THE OLD INDEX FORBADE IS BACK, WITH ITS SIBLING ─────────────────────────────
-- EXPECT: 2 rows — manage_settings AND view_pricing_config both satisfy pricing_recipe:update.
-- SELECT * FROM public.permission_aliases WHERE from_perm = 'pricing_recipe:update';

-- ── W5 — NEUTRALITY: the deleted rows had NO LIVE READER (measured, not asserted) ────────────
-- EXPECT: 0 rows. No member holds a resource:verb string yet (the backfill is Phase 6), so a
-- legacy gate is satisfied by the DIRECT containment test and never consulted the rows §3
-- removed. If this returns ANY row, a member was backfilled early — STOP, and re-check
-- invariant (ii) before trusting any gate.
-- SELECT bm.business_id, bm.user_id, bm.role, bm.permissions
--   FROM public.business_members bm, jsonb_array_elements_text(bm.permissions) p
--  WHERE bm.active AND p LIKE '%:%';

-- ── W6 — THE SPLITS SURVIVE IN ONE DIRECTION ONLY (replaces the layer migration's V2) ────────
-- EXPECT: 39 rows, every one new-checked (from_perm LIKE '%:%'), covering the 9 split legacy
-- strings. These are the mirrors whose legacy edge §3 deleted — the INTENDED asymmetry, which
-- is why V2's "EXPECT 0 orphan edges" no longer applies. A row here with from_perm NOT LIKE
-- '%:%' would mean a legacy edge survived without its mirror: that WOULD be a defect.
-- SELECT a.from_perm, a.implies_perm
--   FROM public.permission_aliases a
--  WHERE NOT EXISTS (SELECT 1 FROM public.permission_aliases b
--                     WHERE b.from_perm = a.implies_perm AND b.implies_perm = a.from_perm)
--  ORDER BY a.implies_perm, a.from_perm;

-- ── W7 — THE RESOLVER STILL BEHAVES: a rename round-trips, a split shard does NOT ────────────
-- Runs as a real member (has_permission reads auth.uid(), NULL under postgres — impersonate).
-- EXPECT: rename_roundtrip = TRUE  · split_shard_grants_bundle = FALSE
-- BEGIN;
--   UPDATE public.business_members SET permissions = '["customers:read","inventory:read"]'::jsonb
--    WHERE user_id = '<A TEST MEMBER user_id>'
--      AND business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<THAT SAME TEST MEMBER user_id>"}';
--   SELECT public.has_permission('f7ec5d67-a9ef-4cb0-b807-438d67687d1b','view_customers') AS rename_roundtrip,
--          public.has_permission('f7ec5d67-a9ef-4cb0-b807-438d67687d1b','view_costs')     AS split_shard_grants_bundle;
-- ROLLBACK;   -- ⚠️ MANDATORY. The UPDATE must not survive; the backfill is Phase 6.
--
-- ⚠️ Same caveat as the layer migration's V4b: the authority-immutability trigger (#152)
--    refuses a permissions UPDATE from a JWT caller. Run the UPDATE as postgres
--    (auth.uid() IS NULL is the permitted service path), then SET LOCAL role for the reads.
