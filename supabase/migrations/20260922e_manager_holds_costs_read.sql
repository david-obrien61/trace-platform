-- ═════════════════════════════════════════════════════════════════════════════
-- APPLIED 2026-09-23, verified live 2026-09-24T16:57Z.
--
-- LANDED IN VERSION CONTROL 2026-09-24, TWO DAYS AFTER IT RAN — a CLAUDE.md §6 r22
-- breach being closed, not a new migration. Until today this file existed ONLY as an
-- untracked file in David's working folder: on no branch, on no remote, absent from
-- `origin/main` while its effect was live on production. *"An applied migration on an
-- unmerged branch is a database nobody can read the source of"* — this was a step worse,
-- because it was on no branch at all.
--
-- ⚠️ THE APPLY DATE IS "2026-09-23", NOT A CLOCK TIME, AND THE REASON IS RECORDED RATHER
-- THAN ROUNDED: both rows this migration wrote now read `updated_at = 2026-09-23
-- 17:18:04.682925+00` — IDENTICAL on the floor row and the member row, which is the
-- signature of the LATER grant `20260923g_manager_holds_order_discount_apply.sql`
-- overwriting it in one transaction. So the database no longer carries the moment THIS
-- file ran; it carries the moment the next one did. Nothing else stored it: these are raw
-- UPDATEs and write no audit row.
--
-- VERIFIED LIVE BEFORE THIS FILE WAS COMMITTED — the file's own seven V-blocks, extracted
-- VERBATIM from the text below (never re-typed) and executed against production:
--   V1 PASS · V2 PASS · V3 PASS (3 of 3 MANAGER members hold it) · V4 PASS (STAFF still
--   refused, 0 of 2) · V5 PASS (STAFF floor 10, OWNER floor 59, both unchanged) ·
--   V6 PASS (`cost_objects_member_select`, ONE SELECT policy, qual live and unchanged:
--   `(is_active_member(business_id) AND has_permission(business_id, 'costs:read'::text))`) ·
--   V7 PASS (re-running would change 0 rows).
--   `has_permission`'s live body was read too and is the LITERAL form — no alias, no
--   expansion — so holding the string is genuinely the whole test.
--
-- ⚠️ TWO STATED FIGURES BELOW ARE SUPERSEDED AND THE VERDICTS STILL PASS. V1's comment
-- expects 25 strings before / V2's expects 26 after; live reads **27** on both the MANAGER
-- floor and the LAWNS member. The 27th is `order_discount:apply`, granted by `20260923g`
-- the day after this ran. No verdict asserts the count, so all seven still PASS.
--
-- 🔴 ONE CLAIM IN THE HEADER BELOW IS FALSE AND IT WAS FALSE WHEN IT WAS WRITTEN. It says
-- *"Triggers on business_members / role_definitions: NONE (checked — nothing can silently
-- reject or rewrite these updates)."* Live there are **THREE**, and every one predates the
-- claim by months:
--   · `trg_business_members_authority_guard` BEFORE UPDATE → `enforce_member_authority_
--     immutability()` (corpus: 20260623 · 20260625 · 20260723 · 20260828)
--   · `trg_business_members_updated_at` BEFORE UPDATE (corpus: 20260602 · 20260623)
--   · `trg_role_definitions_updated_at` BEFORE UPDATE (corpus: 20260623)
-- 🔴 THE FIRST ONE WOULD HAVE REFUSED STATEMENT 2 OUTRIGHT, not silently: any UPDATE
-- changing `permissions` RAISEs `insufficient_privilege` — *"may only be changed through
-- the permission funnel"* — UNLESS `auth.uid()` IS NULL or the transaction-local marker
-- `trace.authority_funnel` is `'on'`. It ran because the SQL editor has no JWT, so
-- `auth.uid()` is NULL and clause (a) returns NEW. **The migration is correct; its stated
-- reason for being safe was not.** Anyone re-running this from an authenticated context
-- gets `insufficient_privilege`, and the second trigger does rewrite `updated_at` on every
-- pass. Recorded here rather than edited below: the SQL is byte-identical to what ran
-- (§6 r1), and this stamp is the only new text in the file. [[R-26]]'s class — a written
-- declaration nobody checked against reality, inside a migration that then executed.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 20260922e_manager_holds_costs_read.sql
-- ledger #382 · David's ruling, 2026-09-22
--
-- PURPOSE: give the MANAGER floor `costs:read`, and give it to every existing
--   MANAGER member who lacks it. Nothing else changes.
--
-- 🔴 WHY THIS IS A GRANT AND NOT A PROJECTION — DAVID'S RULING, 2026-09-22:
--   "the asset cost is NOT confidential: it is TRACE's ESTIMATE, not the purchase
--    price, and the real price is between the owner and the accountant."
--   The measurement that prompted it: LAWNS's MANAGER (joel joiner) holds 25
--   permission strings and not `costs:read`, so `cost_objects_member_select` —
--     (is_active_member(business_id) AND has_permission(business_id,'costs:read'))
--   — refuses him EVERY equipment row. /pmi and /assets therefore showed him a
--   redaction card and nothing else: the maintenance schedule and service log are
--   already readable by him (`business_pmi_schedule` is member-scoped,
--   `business_service_log` needs `pmi:read`, which he holds), but the UI can only
--   reach them THROUGH a selected asset, and he had no asset to select.
--
-- ⚠️ WHAT THIS DELIBERATELY DOES **NOT** DO, and it is the point of the design:
--   · It does NOT widen `cost_objects`' policy.
--   · It does NOT add a view or a SECURITY DEFINER reader.
--   · It does NOT touch STAFF, the OWNER floor, or any per-business role override.
--   The row-level wall stays exactly as written; the MANAGER simply holds the
--   string now. One grant fixes /pmi and /assets together, which is why it beats
--   two projections — and it leaves nothing new to keep in sync.
--
-- MEASURED LIVE IMMEDIATELY BEFORE WRITING (2026-09-22, read-only):
--   role_definitions, system floor (business_id IS NULL, is_system = true):
--     OWNER   59 strings · costs:read = true
--     MANAGER 25 strings · costs:read = FALSE   ← the row this migration edits
--     STAFF   10 strings · costs:read = false
--   role_definitions, per-business override rows:
--     f7ec5d67… (Test Dave's) MANAGER 40 · costs:read = TRUE  ← already holds it
--     f7ec5d67… (Test Dave's) STAFF   10 · costs:read = false
--   business_members, role = MANAGER, platform-wide — THREE rows:
--     ed2e5933… (LAWNS)      joel joiner  25 · costs:read = FALSE ← the only one changed
--     f7ec5d67… (Test Dave's) test obrien 40 · costs:read = true
--     f7ec5d67… (Test Dave's) Erin O'Brien 40 · costs:read = true
--   Triggers on business_members / role_definitions: NONE (checked — nothing can
--   silently reject or rewrite these updates).
--
-- ⚠️ PER-BUSINESS OVERRIDE ROWS ARE LEFT ALONE ON PURPOSE. A business that has
--   customised its own MANAGER role owns that choice; the floor is the platform
--   default, not a mandate. Today the only override (Test Dave's) already holds
--   `costs:read`, so nothing is stranded — but if a future tenant customises
--   MANAGER *without* it, its members keep the grant they get here while its role
--   definition does not, and that divergence is theirs to resolve on /team.
--
-- IDEMPOTENT: every statement is guarded by `NOT (permissions ? 'costs:read')`,
--   so a second run changes zero rows. Re-runnable without effect.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. THE MANAGER FLOOR ──────────────────────────────────────────────────────
-- The system row (business_id IS NULL) is the default every tenant inherits when
-- it has not minted its own. LAWNS has no override, which is exactly why Joel's
-- 25 strings ARE the floor's 25.
UPDATE role_definitions
   SET permissions = permissions || '["costs:read"]'::jsonb,
       updated_at  = now()
 WHERE role_key   = 'MANAGER'
   AND business_id IS NULL
   AND is_system   = true
   AND NOT (permissions ? 'costs:read');

-- ── 2. EXISTING MANAGER MEMBERS ───────────────────────────────────────────────
-- The floor governs what a NEW member is given; it does not reach back into rows
-- already written. Without this, Joel keeps his 25 and the ruling changes nothing
-- for the one person it was made for.
UPDATE business_members
   SET permissions = permissions || '["costs:read"]'::jsonb
 WHERE role = 'MANAGER'
   AND NOT (permissions ? 'costs:read');

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Each returns a ROW that says PASS or FAIL in words,
-- so the evidence is the result grid and not a notice anyone has to scroll for.
-- Run these AFTER the migration. They are read-only.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE MANAGER FLOOR NOW HOLDS IT. Expect: PASS.
SELECT 'V1 manager floor holds costs:read' AS check,
       CASE WHEN (permissions ? 'costs:read') THEN 'PASS' ELSE 'FAIL' END AS verdict,
       jsonb_array_length(permissions) AS strings_now,
       25 AS strings_before_expected
  FROM role_definitions
 WHERE role_key = 'MANAGER' AND business_id IS NULL AND is_system = true;

-- V2 — JOEL HOLDS IT. The named person the ruling is about. Expect: PASS, 26.
SELECT 'V2 LAWNS MANAGER holds costs:read' AS check,
       CASE WHEN bool_and(permissions ? 'costs:read') THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS manager_rows_at_lawns,
       min(jsonb_array_length(permissions)) AS strings_now
  FROM business_members
 WHERE role = 'MANAGER'
   AND business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V3 — EVERY MANAGER PLATFORM-WIDE HOLDS IT. Expect: PASS, 3 of 3.
SELECT 'V3 every MANAGER member holds costs:read' AS check,
       CASE WHEN count(*) FILTER (WHERE NOT (permissions ? 'costs:read')) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS manager_rows_total,
       count(*) FILTER (WHERE permissions ? 'costs:read') AS holding
  FROM business_members
 WHERE role = 'MANAGER';

-- V4 — 🔴 STAFF IS STILL REFUSED. The negative control: this migration must not
-- have widened anything beyond MANAGER. Expect: PASS, 0 holding.
SELECT 'V4 STAFF still refused costs:read' AS check,
       CASE WHEN count(*) FILTER (WHERE permissions ? 'costs:read') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS staff_rows,
       count(*) FILTER (WHERE permissions ? 'costs:read') AS holding_should_be_zero
  FROM business_members
 WHERE role = 'STAFF';

-- V5 — 🔴 THE STAFF AND OWNER FLOORS ARE UNTOUCHED. Expect: PASS — STAFF 10
-- strings without it, OWNER 59 strings with it (it always had it).
SELECT 'V5 STAFF floor unchanged, OWNER floor unchanged' AS check,
       CASE WHEN bool_and(
                  (role_key = 'STAFF' AND NOT (permissions ? 'costs:read') AND jsonb_array_length(permissions) = 10)
               OR (role_key = 'OWNER' AND     (permissions ? 'costs:read') AND jsonb_array_length(permissions) = 59))
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS floors_checked
  FROM role_definitions
 WHERE business_id IS NULL AND is_system = true AND role_key IN ('STAFF','OWNER');

-- V6 — 🔴 THE WALL ITSELF IS UNCHANGED. The whole design claim: no policy was
-- widened. `cost_objects_member_select` must still read exactly as it did.
-- Expect: PASS — still gated on costs:read, still one SELECT policy.
SELECT 'V6 cost_objects SELECT policy untouched' AS check,
       CASE WHEN count(*) = 1 AND bool_and(qual LIKE '%costs:read%')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS select_policies,
       min(policyname) AS policy
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'cost_objects' AND cmd = 'SELECT';

-- V7 — IDEMPOTENCE. Re-running the grant changes nothing. Expect: PASS, 0 rows.
SELECT 'V7 re-running the grant would change 0 rows' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_that_would_still_change
  FROM business_members
 WHERE role = 'MANAGER' AND NOT (permissions ? 'costs:read');
