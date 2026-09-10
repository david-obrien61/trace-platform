-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 20260910c — CAPTURE: `get_my_permissions(uuid)` ENTERS VERSION CONTROL.
-- 2026-09-10 · David applied this BY HAND on the live database. This migration is that function,
--              transcribed from `pg_get_functiondef` so the repo stops being wrong about itself.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes. (CLAUDE.md §6 r1.)
--
-- ── WHAT THIS IS, AND WHAT IT IS NOT ────────────────────────────────────────────────────────────
-- 🔴 THIS CHANGES NOTHING. It is a CAPTURE — `CREATE OR REPLACE` of a body byte-identical to the
--    one already live, so applying it is a no-op and NOT applying it is also fine. Its whole job is
--    that the corpus stops disagreeing with the database.
--
-- ⚠️ IT IS CALLED BY NOTHING. Grepped `packages/`, `api/`, `scripts/`, `supabase/` and `docs/` on
--    2026-09-10: **zero references outside this file.** It exists so the CLIENT can one day
--    RECEIVE its permission array from the server instead of computing `OWNER_LOCKED_SET` in the
--    browser. **It is deliberately NOT wired this pass.** Recorded here because an uncalled
--    function and a dead function look identical, and the next person to run knip on the database
--    would be right to ask.
--
-- ── 🔴 WHY IT EXISTS — THE CLIENT CURRENTLY DERIVES AN AUTHORITY THE SERVER NEVER GAVE IT ───────
-- `[TRACE:PERM]` reports `source: 'OWNER_LOCKED_SET (computed from the manifest)'` with **58**
-- entries. MEASURED against the catalog the same night: Lauren **57**, David **57**, Joel **25**.
-- The 58th is the `owner-only` SENTINEL — a string that **exists in no array, is checked by 0
-- policies and 0 functions**, and is appended to the computed set in the browser. So the client can
-- render a surface the now-LITERAL `has_permission` refuses. Client and server are deriving
-- authority from two different places, which is the 2026-07-30 defect's exact class.
--
-- THE END STATE THIS RPC IS FOR: `can(x)` becomes `array.includes(x)`, `OWNER_LOCKED_SET` is
-- DELETED, and the `owner-only` sentinel becomes the `is_account_holder` boolean this call already
-- returns. Client and server then cannot disagree, because there is only one array.
--
-- 🔴 AND THE ONE RULING THAT MUST COME FIRST — DAVID'S, NOT OURS. **CAN AN OWNER REMOVE A
--    PERMISSION FROM THEMSELVES?** It is the reason the locked set exists at all: if the stored
--    array is the only truth and an owner drops their own `settings:update`, they cannot grant it
--    back. Lightning's read is **NO** — the grant surface refuses to remove a string from the
--    account holder's own row, and a new business seeds the owner's array complete — which puts the
--    guard at the **WRITE**, not a computed set at the READ. **Until that is ruled, this stays
--    unwired.** Wiring it first would trade a client that over-claims for an owner who can lock
--    themselves out, and the second failure is not recoverable from the UI.
--
-- ── WHY CAPTURING A HAND-APPLIED FUNCTION IS ITS OWN JOB ────────────────────────────────────────
-- The 2026-09-10 reconciliation measured 142 live policies against 161 derived from the corpus and
-- found **TEN live objects created by nothing in version control** — legacy, or typed into a
-- dashboard. `has_permission_exact` was the same shape one week earlier: applied by hand, in no
-- migration, and the ONE convention it silently dropped was `SET search_path = ''`. Nobody noticed
-- until a migration went looking.
-- ✅ **THIS ONE DID NOT DROP IT.** `proconfig = {search_path=""}`, SECURITY DEFINER, STABLE, owner
--    `postgres` — verified against `pg_proc` before this file was written, not assumed.
--
-- ── ⚠️ THE ONE DIVERGENCE FROM THIS CORPUS'S CONVENTION, FLAGGED AND NOT SILENTLY "FIXED" ───────
-- Its ACL is the POSTGRES DEFAULT — `=X/postgres`, i.e. **PUBLIC (and therefore `anon`) holds
-- EXECUTE.** Every other SECURITY DEFINER function here follows `REVOKE ALL … FROM public;
-- GRANT EXECUTE … TO authenticated, service_role;` (see 20260910 §1).
--
-- 🔴 IT IS A CONVENTION GAP, NOT A HOLE, AND THE DIFFERENCE IS THE REASON IT IS NOT FIXED HERE:
--    the body filters on `bm.user_id = auth.uid()`, and `auth.uid()` is NULL for an anon caller, so
--    an anon call returns `('[]'::jsonb, false)` — it cannot name a member, a business or a string.
--    The REVOKE/GRANT pair is written out below, COMMENTED, because tightening a live grant is a
--    behavioural change on a production database and the instruction was to MATCH. **David's
--    one-line decision; uncomment it or say no.** Filed as tech-debt #237.
--
-- ── THE SHAPE, FOR THE CLIENT THAT WILL EVENTUALLY CALL IT ──────────────────────────────────────
-- RETURNS TABLE(permissions jsonb, is_account_holder boolean) — ONE row, always.
--   · `permissions`       the member's stored array, or `[]` when there is no active member row.
--     🔴 `[]` IS NOT AN ERROR AND IT IS NOT "EVERYTHING" — it is "you are not an active member of
--     this business". Any future caller must render that as a REFUSAL, never as an empty state
--     (D-9), which is precisely the false-empty defect #236 was.
--   · `is_account_holder` `businesses.owner_id = auth.uid()`. A SEPARATE FACT from the array, and
--     keeping them separate is the whole 2026-09-10 triage in one return type: Lauren Bishop is an
--     OWNER-ROLE member holding every string with `is_account_holder = false`, and the two answers
--     must not be collapsed into one.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_permissions(p_business_id uuid)
RETURNS TABLE(permissions jsonb, is_account_holder boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    COALESCE((SELECT bm.permissions
                FROM public.business_members bm
               WHERE bm.business_id = p_business_id
                 AND bm.user_id    = auth.uid()
                 AND bm.active
               LIMIT 1), '[]'::jsonb),
    EXISTS (SELECT 1 FROM public.businesses b
             WHERE b.id = p_business_id
               AND b.owner_id = auth.uid());
$function$;

-- ⚠️ THE CONVENTION LINES — DELIBERATELY COMMENTED. See the header. David's call, tech-debt #237.
-- REVOKE ALL ON FUNCTION public.get_my_permissions(uuid) FROM public, anon;
-- GRANT EXECUTE ON FUNCTION public.get_my_permissions(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_permissions(uuid) IS
  'THE SERVER TELLS THE CLIENT WHAT IT HOLDS. Returns ONE row: the caller''s stored permission '
  'array for this business (or [] when they are not an active member — a REFUSAL, never an empty '
  'state, D-9) and whether they are businesses.owner_id. Applied BY HAND 2026-09-10 and captured '
  'into version control by 20260910c. NOT CALLED BY ANYTHING YET, deliberately: it exists so the '
  'client can RECEIVE its array instead of computing OWNER_LOCKED_SET in the browser. The two '
  'return columns are kept separate on purpose — an OWNER-ROLE member can hold every string with '
  'is_account_holder = false, which is the whole 2026-09-10 owner_id triage in one return type.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run AFTER applying. Catalog-backed (§9 SCHEMA VERIFICATION GATE).
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- V1 — the shape and the conventions. EXPECT: prosecdef = true, provolatile = 's',
--      proconfig = {search_path=""}, and the argument/return types as declared.
-- SELECT p.oid::regprocedure::text AS sig, p.prosecdef, p.provolatile, p.proconfig,
--        pg_get_function_result(p.oid) AS returns
--   FROM pg_proc p WHERE p.proname = 'get_my_permissions';
--
-- V2 — 🔴 THE CAPTURE IS FAITHFUL. EXPECT: true. If this is false, the live function moved between
--      the read and the apply and THIS FILE is now the thing that is wrong.
-- SELECT pg_get_functiondef(p.oid) LIKE '%COALESCE((SELECT bm.permissions%'
--    AND pg_get_functiondef(p.oid) LIKE '%b.owner_id = auth.uid()%' AS body_matches
--   FROM pg_proc p WHERE p.proname = 'get_my_permissions';
--
-- ✅ V3–V6 WERE RUN BY THUNDER ON 2026-09-10, BEFORE THIS FILE WAS FINISHED. The results are
--    recorded inline. Re-run them after applying — a capture that has drifted is worse than none.
--
-- 🔴 THE IMPERSONATION FORM MATTERS AND IT IS **NOT** `SET LOCAL role authenticated`. That form was
--    written into this repo's V-blocks before (20260828 V7–V9) and **has never been run**. It
--    FAILED here: `permission denied to set role "authenticated"`. Setting the CLAIMS GUC ALONE is
--    enough for anything that reads `auth.uid()`, needs no role membership, and is what every check
--    below uses. (A ROW-COUNT check under RLS still needs the role switch — that is a different
--    test, and it is Card 4 on the owner-test board with its own escape hatch.)
--
-- V3 — 🔴 IT ANSWERS FOR A REAL PERSON, AND THE TWO COLUMNS DISAGREE — WHICH IS THE WHOLE POINT.
-- ✅ MEASURED 2026-09-10 (pre-20260910b): Lauren n=57 is_account_holder=FALSE ·
--    David n=57 is_account_holder=TRUE. **Identical arrays, different boolean** — two owners, one
--    account holder, and the RPC says so in one row. AFTER 20260910b both read 59.
-- BEGIN;
--   SET LOCAL request.jwt.claims = '{"sub":"790b31d2-7b65-45ec-953f-79855453a73e"}';  -- Lauren
--   SELECT jsonb_array_length(permissions) AS permission_count, is_account_holder
--     FROM public.get_my_permissions('ed2e5933-45dc-4b9b-a331-ddfd125e7a74');
-- ROLLBACK;
--
-- V4 — THE MANAGER. ✅ MEASURED: Joel n=25, is_account_holder=FALSE,
--      `permissions ? 'costs:update'` = FALSE, `permissions ? 'settings:update'` = TRUE.
-- BEGIN;
--   SET LOCAL request.jwt.claims = '{"sub":"6f09038f-7966-49e3-b86a-1e3beb5e311f"}';  -- Joel
--   SELECT jsonb_array_length(permissions) AS n, is_account_holder,
--          permissions ? 'costs:update' AS costs, permissions ? 'settings:update' AS settings
--     FROM public.get_my_permissions('ed2e5933-45dc-4b9b-a331-ddfd125e7a74');
-- ROLLBACK;
--
-- V5 — NEGATIVE: NO CALLER, NO ANSWER. ✅ MEASURED: `permissions = []`, `is_account_holder = false`
--      with no claims set — which is also what it returns to the SQL editor's own role, because
--      `auth.uid()` is NULL there. **An empty array in the editor is CORRECT, not a defect.**
--      This is why the default ACL is a convention gap and not a hole — but run it, do not take the
--      sentence's word for it.
-- SELECT permissions, is_account_holder
--   FROM public.get_my_permissions('ed2e5933-45dc-4b9b-a331-ddfd125e7a74');
--
-- V6 — 🔴 NEGATIVE, AC-3: IT DOES NOT ANSWER FOR A TENANT YOU ARE NOT IN. Nobody asked for this
--      check and it is the one that would have mattered most if it failed.
-- ✅ MEASURED: Lauren asking about Test Dave's → `[]`, false. Not an error, not another tenant's
--    array — the same answer a stranger gets.
-- BEGIN;
--   SET LOCAL request.jwt.claims = '{"sub":"790b31d2-7b65-45ec-953f-79855453a73e"}';  -- Lauren
--   SELECT jsonb_array_length(permissions) AS n, is_account_holder
--     FROM public.get_my_permissions('95c1b2e9-3b09-43dd-a9f8-ba0744ca4382');  -- Test Dave's
-- ROLLBACK;
--
-- V7 — NEGATIVE: still nobody calls it. EXPECT: no hits outside this file.
--      (grep, not SQL: `grep -rn get_my_permissions packages api scripts` → nothing.)
