-- ════════════════════════════════════════════════════════════════════════════════
-- 2026-07-28 — CALL 5: CLEAR THE `assets:*` PHANTOMS FROM THE LIVE TENANT
-- ════════════════════════════════════════════════════════════════════════════════
-- Ledger #163. Companion to `supabase/migrations/20260727b_align_floor_assets_retired.sql`.
--
-- WHY THIS EXISTS AS A FUNNEL CALL AND NOT A LINE IN THE MIGRATION.
-- 20260727b fixes the FLOOR (`role_definitions WHERE business_id IS NULL`) and the alias table.
-- It cannot fix a live member: `business_members.permissions` and a TENANT `role_definitions`
-- row are only ever written through `save_role_permissions`, in one transaction, with an
-- `audit_log` row naming the actor (#152 — the funnel is the only door, and the §1 trigger
-- refuses a direct JWT UPDATE). A cleanup that skipped the funnel would be the side door we
-- closed on ourselves.
--
-- WHAT IT CLEARS. f7ec5d67's MANAGER holds `assets:create` / `assets:read` / `assets:update`
-- right now — 43 strings where the model defines 40. They were minted by CALL 1 (the rename) on
-- 2026-07-27: the decomposition joins `ON a.implies_perm = legacy.s`
-- (`20260727_rbac_resource_action_flip.sql:518`), the surviving `assets:read → view_costs` rows
-- matched, and R-B2's output filter does not name `assets:*`. The R4 retirement was true in the
-- repo and false in the database. Nothing gates on these strings today — `/assets` and `/pmi`
-- both moved to `costs:read` — so this REMOVES INERT STRINGS, it does not revoke a capability.
--
-- ORDER (both halves, or neither):
--   1. apply `20260727b_align_floor_assets_retired.sql` as postgres   → floor + alias rows
--   2. run THIS file                                                  → tenant row + member arrays
-- Running 2 without 1 leaves the alias rows in place, and the NEXT rename at ANY tenant re-mints
-- exactly what this file just cleared. The STEP 0 gate below refuses to proceed in that state.
--
-- ⚠️ ONE-WAY DOOR ALREADY CROSSED: f7ec5d67's MANAGER is a TENANT OVERRIDE (minted 2026-07-23),
-- so it does not track the floor and the migration's floor fix will never reach it. That is why
-- both halves are required.

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 0 — READ-ONLY. Look at these before running anything.
-- ════════════════════════════════════════════════════════════════════════════════

-- 0a — the floor must already be corrected. EXPECT OWNER 52 · MANAGER 25 · STAFF 10.
SELECT role_key, jsonb_array_length(permissions) AS n
  FROM public.role_definitions WHERE business_id IS NULL ORDER BY role_key;

-- 0b — the alias rows must already be gone. EXPECT 0 rows.
SELECT from_perm, implies_perm FROM public.permission_aliases
 WHERE from_perm LIKE 'assets:%' OR implies_perm LIKE 'assets:%';

-- 0c — the tenant state this call is about to change. EXPECT tenant RD 43, member 43, and the
-- three strings present in both.
SELECT 'tenant_role_definition' AS src, jsonb_array_length(rd.permissions) AS n,
       (SELECT count(*) FROM jsonb_array_elements_text(rd.permissions) s WHERE s LIKE 'assets:%') AS n_assets
  FROM public.role_definitions rd
  JOIN public.businesses b ON b.id = rd.business_id
 WHERE b.id::text LIKE 'f7ec5d67%' AND rd.role_key = 'MANAGER'
UNION ALL
SELECT 'member_array', jsonb_array_length(bm.permissions),
       (SELECT count(*) FROM jsonb_array_elements_text(bm.permissions) s WHERE s LIKE 'assets:%')
  FROM public.business_members bm
  JOIN public.businesses b ON b.id = bm.business_id
 WHERE b.id::text LIKE 'f7ec5d67%' AND bm.role = 'MANAGER' AND bm.active;

-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 CORRECTED 2026-07-28 AFTER THE GATE FAILED IN PRODUCTION — READ THIS BEFORE RUNNING.
-- ════════════════════════════════════════════════════════════════════════════════
-- The first version of this file put the halt gate in a `DO $$` block SITTING BESIDE the call.
-- On 2026-07-28 the file was run a second time, 88 seconds after the real work; the tenant held
-- ZERO `assets:*`; the gate's own rule said refuse — and CALL 5 executed anyway, writing a
-- 40 → 40 audit row with outcome `success`. **An audit row that records a change where none
-- occurred asserts an event nobody caused** — the same class as a green check on a moved surface.
--
-- WHY IT DID NOT HOLD, from source. Two independent structural bypasses, neither of them
-- operator error:
--   (1) THE GUARD WAS A STATEMENT BESIDE THE WRITE, NOT A CONDITION OF IT. Nothing bound them.
--       `DO $$ … RAISE $$;` and the `SELECT … save_role_permissions(…)` were separate top-level
--       statements with no transaction around them, so whether the RAISE stopped the call was a
--       property of the CLIENT, not of this file: psql without `ON_ERROR_STOP=on` runs straight
--       past a failed statement, and highlighting the call alone in a SQL editor never reaches
--       the gate at all. A guard the write does not DEPEND on is advice, not a gate.
--   (2) `save_role_permissions` ITSELF ACCEPTS A NO-OP. There is no `IS DISTINCT FROM` check
--       anywhere in the function; it writes the `audit_log` row unconditionally. So even a
--       perfect guard here protects only THIS FILE — **the /team Roles tab writes a
--       `role.permissions_changed` row every time Save is pressed with nothing changed.**
--       That half is a FUNNEL fix (migration, all 13 write sites) and is David's ruling —
--       flagged in the ledger and tech-debt, deliberately not taken here.
--
-- THE FIX APPLIED BELOW, both halves:
--   · The whole run is wrapped in an EXPLICIT `BEGIN … COMMIT`, so a RAISE in either gate rolls
--     the call back regardless of client error-handling.
--   · **The premise is now part of the write's own statement** — CALL 5 selects from a subquery
--     that returns ZERO ROWS when the tenant holds no `assets:*`, so the LATERAL function is
--     never invoked. You cannot highlight-and-run past this one; there is nothing to run.
-- The 40 → 40 row is NOT deleted. It is the evidence that the gate needed fixing.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 1 — THE HALT GATE. Re-reads every premise at RUN TIME and RAISEs rather than
-- proceeding on a stale assumption. (#159 / #162: the guard lives in the file, not in the
-- conversation. This one is not irreversible, but it is auditable, and a wrong audit row is
-- permanent.) NOW INSIDE THE TRANSACTION — a RAISE here aborts the call below.
-- ════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_biz uuid; v_alias int; v_floor int; v_rd int; v_rd_assets int; v_members int; v_divergent int;
BEGIN
  SELECT id INTO v_biz FROM public.businesses WHERE id::text LIKE 'f7ec5d67%';
  IF v_biz IS NULL THEN RAISE EXCEPTION 'HALT: tenant f7ec5d67 not found'; END IF;

  -- (1) the migration must have landed first, or this cleanup is undone by the next rename.
  SELECT count(*) INTO v_alias FROM public.permission_aliases
   WHERE from_perm LIKE 'assets:%' OR implies_perm LIKE 'assets:%';
  IF v_alias > 0 THEN
    RAISE EXCEPTION 'HALT: % assets alias row(s) still present — apply 20260727b FIRST, or the next rename re-mints what this file clears', v_alias;
  END IF;

  SELECT jsonb_array_length(permissions) INTO v_floor FROM public.role_definitions
   WHERE business_id IS NULL AND role_key = 'MANAGER';
  IF v_floor <> 25 THEN
    RAISE EXCEPTION 'HALT: floor MANAGER is %, expected 25 — 20260727b has not been applied', v_floor;
  END IF;

  -- (2) the tenant override must exist and must actually hold the phantoms.
  SELECT jsonb_array_length(rd.permissions),
         (SELECT count(*) FROM jsonb_array_elements_text(rd.permissions) s WHERE s LIKE 'assets:%')
    INTO v_rd, v_rd_assets
    FROM public.role_definitions rd WHERE rd.business_id = v_biz AND rd.role_key = 'MANAGER';
  IF v_rd IS NULL THEN RAISE EXCEPTION 'HALT: no tenant MANAGER role_definition at f7ec5d67'; END IF;
  IF v_rd_assets = 0 THEN
    RAISE EXCEPTION 'HALT: tenant MANAGER holds no assets:* string — already clean, or a different defect. Do not write an audit row for a no-op';
  END IF;

  -- (3) the member arrays must AGREE with the template before a template-shaped rewrite. If they
  -- have diverged, WIPE-not-merge would silently overwrite the divergence and the audit row would
  -- describe a change nobody intended.
  SELECT count(*) INTO v_members FROM public.business_members
   WHERE business_id = v_biz AND role = 'MANAGER' AND active;
  SELECT count(*) INTO v_divergent FROM public.business_members bm
   WHERE bm.business_id = v_biz AND bm.role = 'MANAGER' AND bm.active
     AND bm.permissions IS DISTINCT FROM (SELECT rd.permissions FROM public.role_definitions rd
                                           WHERE rd.business_id = v_biz AND rd.role_key = 'MANAGER');
  IF v_divergent > 0 THEN
    RAISE EXCEPTION 'HALT: % of % active MANAGER member array(s) differ from the tenant template — reconcile before a WIPE-not-merge rewrite', v_divergent, v_members;
  END IF;

  RAISE NOTICE 'GATE PASSED — tenant % · template % strings (% assets) · % active MANAGER member(s) in agreement', v_biz, v_rd, v_rd_assets, v_members;
END $$;

-- ════════════════════════════════════════════════════════════════════════════════
-- CALL 5 — ASSETS RETIREMENT CLEANUP. 43 → 40. A REMOVAL OF INERT STRINGS.
-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 READ THE REASON STRING CORRECTLY (same discipline as CALL 4's note). This row is a
-- SUBTRACTION and the audit before/after will show 43 → 40 — but NO AUTHORITY IS LOST. The
-- three strings gate nothing: `assets` has no table (`business_assets` was renamed to
-- `cost_objects` on 2026-06-15) and no policy, and the `/assets` route + tile now gate on
-- `costs:read`. An auditor reading this row alone would conclude the manager was narrowed.
-- She was not — the model never granted these; a decomposition minted them.
--
-- The permissions argument is read from the TENANT TEMPLATE at execution time (not from this
-- document, and not from the member row) — §11.6's live-read rule: any number written down here
-- is stale before it is read. The gate above has already proved template == member arrays.
--
-- 🔴 THE NO-OP GUARD IS THE `FROM` CLAUSE, NOT A COMMENT AND NOT A NEIGHBOURING STATEMENT.
-- The driving subquery yields a row ONLY IF the tenant actually holds an `assets:*` string. On a
-- second run it returns zero rows, the LATERAL `save_role_permissions(…)` is never invoked, and
-- no audit row is written. Expressed as a subquery rather than a trailing `WHERE … EXISTS` on
-- purpose: with the filter inside the driving relation, "zero rows in ⇒ function not called" is
-- a property of the query SHAPE, not a planner choice about when to apply a qual to a lateral
-- join against a VOLATILE function.
-- EXPECT: one row on the first run, ZERO ROWS (and no audit row) on every run after.
SELECT f.* FROM (
  SELECT b.id, b.owner_id
    FROM public.businesses b
   WHERE b.id::text LIKE 'f7ec5d67%'
     AND EXISTS (SELECT 1
                   FROM public.role_definitions rd,
                        jsonb_array_elements_text(rd.permissions) s
                  WHERE rd.business_id = b.id
                    AND rd.role_key = 'MANAGER'
                    AND s LIKE 'assets:%')
) b,
  LATERAL public.save_role_permissions(
    b.id, b.owner_id, 'MANAGER', 'save', 'Manager',
    'Day-to-day ops — checkout, deliveries, campaigns, orders',
    (SELECT COALESCE(jsonb_agg(DISTINCT x.s), '[]'::jsonb)
       FROM (SELECT jsonb_array_elements_text(rd.permissions) AS s
               FROM public.role_definitions rd
              WHERE rd.business_id = b.id AND rd.role_key = 'MANAGER') x
      WHERE x.s NOT LIKE 'assets:%'),
    'rbac-cleanup:assets-retired'
  ) f;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 2 — POST-STATE. Fails loudly if the arithmetic did not land.
-- ════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_biz uuid; v_rd int; v_bad int; v_floor int; v_alias int;
BEGIN
  SELECT id INTO v_biz FROM public.businesses WHERE id::text LIKE 'f7ec5d67%';

  SELECT jsonb_array_length(permissions) INTO v_rd FROM public.role_definitions
   WHERE business_id = v_biz AND role_key = 'MANAGER';
  IF v_rd <> 40 THEN RAISE EXCEPTION 'POST: tenant MANAGER is %, expected 40', v_rd; END IF;

  SELECT count(*) INTO v_bad FROM public.business_members bm,
         jsonb_array_elements_text(bm.permissions) s
   WHERE bm.business_id = v_biz AND bm.active AND s LIKE 'assets:%';
  IF v_bad > 0 THEN RAISE EXCEPTION 'POST: % member string(s) still assets:*', v_bad; END IF;

  SELECT jsonb_array_length(permissions) INTO v_floor FROM public.role_definitions
   WHERE business_id IS NULL AND role_key = 'MANAGER';
  IF v_floor <> 25 THEN RAISE EXCEPTION 'POST: floor MANAGER is %, expected 25', v_floor; END IF;

  SELECT count(*) INTO v_alias FROM public.permission_aliases
   WHERE from_perm LIKE 'assets:%' OR implies_perm LIKE 'assets:%';
  IF v_alias > 0 THEN RAISE EXCEPTION 'POST: % assets alias row(s) survive', v_alias; END IF;

  RAISE NOTICE 'POST-STATE CLEAN — tenant MANAGER 40 · zero assets:* in any member array · floor 25 · zero alias rows';
END $$;

COMMIT;

-- ⚠️ EXPECTED BEHAVIOUR ON ANY RUN AFTER THE FIRST: STEP 1 RAISEs
-- `HALT: tenant MANAGER holds no assets:* string — already clean…`, the transaction aborts, and
-- NOTHING is written. That is the file working, not the file broken. CALL 5's zero-row driving
-- subquery is the second, independent guard behind it — defence in depth, because on 2026-07-28
-- the single-guard version of this file wrote a 40 → 40 row.

-- ── V-audit — the reason string landed, and the row reads as a subtraction with a stated cause.
-- EXPECT one row, reason `rbac-cleanup:assets-retired`, before 43 → after 40.
-- SELECT created_at, actor_id, detail->>'reason' AS reason,
--        jsonb_array_length(detail->'before') AS n_before,
--        jsonb_array_length(detail->'after')  AS n_after
--   FROM public.audit_log WHERE action = 'role.permissions_changed'
--  ORDER BY created_at DESC LIMIT 1;

-- ── V-negative — `assets:*` now appears NOWHERE: not floor, not tenant, not member, not alias.
-- EXPECT 0 rows.
-- SELECT 'role_definitions' AS src, rd.role_key FROM public.role_definitions rd,
--        jsonb_array_elements_text(rd.permissions) s WHERE s LIKE 'assets:%'
-- UNION ALL SELECT 'business_members', bm.role FROM public.business_members bm,
--        jsonb_array_elements_text(bm.permissions) s WHERE s LIKE 'assets:%'
-- UNION ALL SELECT 'permission_aliases', from_perm FROM public.permission_aliases
--  WHERE from_perm LIKE 'assets:%' OR implies_perm LIKE 'assets:%';
