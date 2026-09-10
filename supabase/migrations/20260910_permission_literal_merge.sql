-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 20260910 — THE PERMISSION CHECK BECOMES LITERAL. ONE FUNCTION, NOT TWO.
-- 2026-09-10 · David's ruling: "if a user has 'x perm' then the user should be able to perform
--              that task." Authority must not live in more places than it has to.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
-- Nothing here creates a table, so that rule is belt-and-braces; it is stated where the actor stands.
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes. (CLAUDE.md §6 r1.)
--
-- ── WHAT THIS DOES, IN ONE LINE ─────────────────────────────────────────────────────────────────
-- `has_permission` stops expanding aliases and tests the array literally. `has_permission_exact` —
-- which David applied BY HAND on 2026-09-09 and which is in NO migration — is DROPPED, because after
-- this change `has_permission` IS it. **ZERO POLICIES ARE TOUCHED.** All 59 live policies that call
-- `has_permission` get literal semantics without being rewritten, which is the entire point of
-- changing the function rather than the policies.
--
-- ── 🔴 WHY THIS IS SAFE, MEASURED AGAINST THE LIVE CATALOG AND NOT REASONED ─────────────────────
-- Removing the alias expansion REVOKES access from anyone holding only a legacy string. That would
-- be a SILENT revocation — the exact failure class this work exists to prevent — so it was checked
-- against the catalog (PAT, 2026-09-10) in four directions, and all four came back empty:
--
--   (1) EVERY distinct string held by ANY `business_members` row, in EVERY tenant, active or not:
--       57 strings, and every one is `resource:verb`. ZERO legacy strings.
--   (2) `business_members` rows carrying a non-`resource:verb` string: 0 rows.
--   (3) `role_definitions` — the OTHER array store, checked because one store is not the corpus:
--       0 rows carrying a legacy string.
--   (4) Function bodies calling `has_permission*` with a legacy literal: 0.
--       Live policies calling `has_permission*` with a legacy literal: 0 of 142.
--
-- So the alias layer resolves NOTHING today. This migration therefore changes ZERO access decisions
-- for ZERO people, and its behavioural diff on the live database is empty. That claim is the reason
-- it is safe to make, and it is why it was measured rather than assumed.
--
-- ⚠️ `permission_aliases` (the TABLE) IS NOT DROPPED and its seed is not touched. Dropping the
-- reader is reversible in one statement; dropping the data is not. It becomes unread, and removing
-- it is a separate decision on a later pass.
--
-- ── ⚠️ WHAT THIS DELIBERATELY DOES NOT TOUCH: `has_permission_for` ──────────────────────────────
-- `has_permission_for(business, user, perm)` STILL EXPANDS ALIASES. It is the three-argument form
-- the RPCs use (`create_invitation`, `import_write_price`, `set_business_tax_rate`,
-- `set_business_profile`, `set_business_module_state`, `seed_business_modules`,
-- `start_module_trial`, `reset_invitation_expiry`). Leaving it is a DELIBERATE, NARROW call and not
-- an oversight:
--   · By the same four measurements above, its alias join also resolves nothing, so the two
--     functions AGREE on every live input today. There is no divergence to observe.
--   · Changing it was not part of the ruling, and a permission function is the wrong place to take
--     unauthorised scope.
-- 🔴 BUT THE DIVERGENCE IS REAL IN SHAPE, AND IT IS THE 2026-07-30 DEFECT'S EXACT CLASS — *"Two
-- authorisation functions disagreeing about the same person is not a design."* Filed as tech-debt
-- #233 so it is a decision on a board rather than a difference nobody wrote down.
--
-- ── SEARCH PATH ─────────────────────────────────────────────────────────────────────────────────
-- `SET search_path = ''` is carried through. The live `has_permission` already had it; the
-- hand-applied `has_permission_exact` did NOT, which was the sole divergence from a convention this
-- corpus otherwise keeps without exception. The surviving function has it, so the gap closes by the
-- drop rather than by a patch.

-- ── §1 — THE LITERAL TEST ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_permission(p_business_id uuid, p_perm text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  -- LITERAL. No implication, no aliases, no expansion. Holding the string is the whole test.
  -- This body is David's `has_permission_exact` (applied by hand 2026-09-09), entering version
  -- control for the first time, with the NULL guards the alias version carried retained — a NULL
  -- business id must not match a row, and `auth.uid()` is NULL for an unauthenticated caller.
  SELECT p_business_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.business_members bm
     WHERE bm.business_id = p_business_id
       AND bm.user_id     = auth.uid()
       AND bm.active      = true
       AND bm.permissions ? p_perm
  );
$$;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.has_permission(uuid, text) IS
  'LITERAL permission test — the array contains the string, or the answer is no. No alias '
  'expansion (removed 2026-09-10 after the catalog proved zero legacy strings held anywhere). '
  'Replaces has_permission_exact, which was applied by hand 2026-09-09 and is dropped by the same '
  'migration. NOTE: has_permission_for (3-arg) still expands aliases — tech-debt #233.';

-- ── §2 — THE SECOND AUTHORITY SITE IS REMOVED ───────────────────────────────────────────────────
-- Verified against the catalog before writing this line: has_permission_exact has ZERO callers —
-- no policy (0 of 142) and no function references it. Dropping it removes a site, not a capability.
DROP FUNCTION IF EXISTS public.has_permission_exact(uuid, text);

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run these AFTER applying. Catalog-backed (§9 SCHEMA VERIFICATION GATE).
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- V1 — the body is literal and carries search_path. EXPECT: contains 'permissions ? p_perm',
--      does NOT contain 'permission_aliases', proconfig = {search_path=}
-- SELECT prosrc LIKE '%permissions ? p_perm%' AS is_literal,
--        prosrc LIKE '%permission_aliases%'   AS still_expands,
--        proconfig
--   FROM pg_proc WHERE proname = 'has_permission';
--
-- V2 — NEGATIVE: has_permission_exact is gone. EXPECT 0 rows.
-- SELECT proname FROM pg_proc WHERE proname = 'has_permission_exact';
--
-- V3 — NEGATIVE: nothing lost a gate. EXPECT the same 59 as before the change.
-- SELECT count(*) FROM pg_policies
--  WHERE schemaname='public' AND (coalesce(qual,'')||coalesce(with_check,'')) ~ 'has_permission\(';
--
-- V4 — THE REFUSAL, PROVEN AGAINST REAL DATA rather than asserted. Joel holds inventory:read and
--      NOT costs:read. EXPECT: holds_read = true, holds_costs = false.
--      (has_permission itself reads auth.uid(), so it cannot be exercised from the SQL editor —
--      this asserts the ARRAY the function tests, which is the half SQL can see. The function's
--      own refusal is proven by the owner-test card under a real session.)
-- SELECT bm.permissions ? 'inventory:read' AS holds_read,
--        bm.permissions ? 'costs:read'     AS holds_costs
--   FROM public.business_members bm
--   JOIN auth.users u ON u.id = bm.user_id
--  WHERE bm.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND u.email = 'joel@lawnstrees.com';
--
-- V5 — the alias table still EXISTS and is simply unread (nothing was destroyed). EXPECT > 0.
-- SELECT count(*) AS alias_rows_preserved FROM public.permission_aliases;
