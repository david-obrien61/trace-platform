-- ════════════════════════════════════════════════════════════════════════════════
-- RBAC TRANSITION — THE FOUR FUNNEL CALLS (run AFTER the flip migration, SAME session)
-- ════════════════════════════════════════════════════════════════════════════════
-- RUN AS: postgres, Supabase SQL editor, project bgobkjcopcxusjsetfob.
-- ORDER:  apply 20260727_rbac_resource_action_flip.sql FIRST, then this file, ideally in the
--         SAME transaction so gates and arrays move together and there is no window.
--
-- 🔴 STEP 0 IS A HALT GATE, NOT A PRINT (David, 2026-07-27).
--   The MANAGER row at f7ec5d67 has moved ELEVEN TIMES IN THREE DAYS, most recently
--   2026-07-26 18:02 when manage_settings came off and three financial strings went on. The
--   35 → 43 arithmetic was derived against ONE SPECIFIC 13-string array. If that array has moved
--   again, someone touched the Roles page and the whole arithmetic needs re-deriving WITH DAVID'S
--   EYES ON IT. STEP 0 therefore RAISES and aborts the transaction — it does not print a warning,
--   it does not proceed against whatever it finds, and it does NOT silently recompute.
--
-- WHY the calls still read live rows despite the halt gate: the gate proves the INPUT is the one
-- the arithmetic assumed; the calls then DERIVE from that input rather than from a typed list, so
-- the two can never disagree. A number in a document is a claim; a derivation is not.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 0 — THE HALT GATE. Aborts unless the inputs are EXACTLY what was reckoned.
-- ════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_biz   uuid;
  v_mgr   jsonb;
  v_staff jsonb;
  v_mgr_expected   jsonb := '["view_dashboard","qr_checkout","view_orders","manage_deliveries","manage_campaigns","override_maintenance","view_customers","import_pricing","view_costs","manage_customers","view_margin","view_wages","view_pricing_config"]'::jsonb;
  v_staff_expected jsonb := '["view_dashboard","qr_checkout","view_orders"]'::jsonb;
BEGIN
  SELECT id INTO v_biz FROM public.businesses WHERE id::text LIKE 'f7ec5d67%';
  IF v_biz IS NULL THEN
    RAISE EXCEPTION 'HALT — tenant f7ec5d67 not found. Nothing was written.';
  END IF;

  SELECT permissions INTO v_mgr FROM public.business_members
   WHERE business_id = v_biz AND role = 'MANAGER' AND active = true;
  SELECT permissions INTO v_staff FROM public.business_members
   WHERE business_id = v_biz AND role = 'STAFF' AND active = true;

  -- SET equality, not array equality: order is not meaningful in a permissions array, and a
  -- reordering is not a change. Anything else IS.
  IF v_mgr IS NULL OR NOT (
       (SELECT count(*) FROM jsonb_array_elements_text(v_mgr)) = (SELECT count(*) FROM jsonb_array_elements_text(v_mgr_expected))
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_mgr) x(s)
                        WHERE NOT v_mgr_expected ? x.s)) THEN
    RAISE EXCEPTION E'HALT — THE MANAGER ARRAY HAS MOVED. Nothing was written.\n  expected (13): %\n  found:        %\nSomeone touched the Roles page since the arithmetic was derived. Re-derive the 35 → 43 with David before re-running. DO NOT edit the expected literal to match.',
      v_mgr_expected, COALESCE(v_mgr::text, '(no active MANAGER row)');
  END IF;

  IF v_staff IS NULL OR NOT (
       (SELECT count(*) FROM jsonb_array_elements_text(v_staff)) = (SELECT count(*) FROM jsonb_array_elements_text(v_staff_expected))
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_staff) x(s)
                        WHERE NOT v_staff_expected ? x.s)) THEN
    RAISE EXCEPTION E'HALT — THE STAFF ARRAY HAS MOVED. Nothing was written.\n  expected (3): %\n  found:       %\nRe-derive the 5 → 10 with David before re-running.',
      v_staff_expected, COALESCE(v_staff::text, '(no active STAFF row)');
  END IF;

  RAISE NOTICE 'STEP 0 PASSED — MANAGER 13 and STAFF 3 are exactly as reckoned. Proceeding.';
END $$;

-- ════════════════════════════════════════════════════════════════════════════════
-- THE DECOMPOSITION — derived from permission_aliases, never typed
-- ════════════════════════════════════════════════════════════════════════════════
-- decomposition(L) = every NEW-checked row whose satisfier is L. Retired strings drop out
-- automatically (they have no alias rows); R-B2 removes the declared-unwired outputs.
CREATE OR REPLACE FUNCTION pg_temp.decompose(p_legacy jsonb) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_agg(DISTINCT a.from_perm), '[]'::jsonb)
    FROM jsonb_array_elements_text(p_legacy) AS legacy(s)
    JOIN public.permission_aliases a ON a.implies_perm = legacy.s
   WHERE a.from_perm LIKE '%:%'
     AND a.from_perm NOT IN (
       'maintenance:override', 'deliveries.route:update', 'deliveries:create',
       'campaigns:create', 'service_offerings:create', 'service_offerings:update',
       'team:create', 'team:update', 'team:delete'
     );
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- CALL 1 — MANAGER RENAME (R-A). 13 legacy → 35 new. A BACKFILL. No authority added.
-- ════════════════════════════════════════════════════════════════════════════════
SELECT f.* FROM public.businesses b,
  LATERAL public.save_role_permissions(
    b.id, b.owner_id, 'MANAGER', 'save', 'Manager',
    'Day-to-day ops — checkout, deliveries, campaigns, orders',
    pg_temp.decompose((SELECT permissions FROM public.business_members
                        WHERE business_id = b.id AND role = 'MANAGER' AND active)),
    'rbac-migration:rename'
  ) f
 WHERE b.id::text LIKE 'f7ec5d67%';

-- ════════════════════════════════════════════════════════════════════════════════
-- CALL 2 — MANAGER GRANT. 35 → 43. NEW AUTHORITY David decided to give.
-- ════════════════════════════════════════════════════════════════════════════════
-- The 8: orders:update · orders:delete · order_discount:apply · service_offerings:read ·
-- tax_rate:read · tax_rate:update · settings:read · settings:update.
-- orders:delete and order_discount:apply are DEPARTURES from spec §5's bundle, which is
-- read/create/update only — owner calls, not bundle defaults. Recorded as such.
SELECT f.* FROM public.businesses b,
  LATERAL public.save_role_permissions(
    b.id, b.owner_id, 'MANAGER', 'save', 'Manager',
    'Day-to-day ops — checkout, deliveries, campaigns, orders',
    (SELECT COALESCE(jsonb_agg(DISTINCT x.s), '[]'::jsonb) FROM (
       SELECT jsonb_array_elements_text((SELECT permissions FROM public.business_members
                WHERE business_id = b.id AND role = 'MANAGER' AND active)) AS s
       UNION SELECT unnest(ARRAY['orders:update','orders:delete','order_discount:apply',
                                 'service_offerings:read','tax_rate:read','tax_rate:update',
                                 'settings:read','settings:update'])
     ) x),
    'rbac-migration:grant'
  ) f
 WHERE b.id::text LIKE 'f7ec5d67%';

-- ════════════════════════════════════════════════════════════════════════════════
-- CALL 3 — STAFF RENAME (R-A). 3 legacy → 5 new.
-- ════════════════════════════════════════════════════════════════════════════════
-- ⚠️ MINTS A TENANT STAFF OVERRIDE — none exists at f7ec5d67 today. From this write, this
-- tenant's STAFF stops tracking the system floor. Same one-way door MANAGER crossed on 07-23.
SELECT f.* FROM public.businesses b,
  LATERAL public.save_role_permissions(
    b.id, b.owner_id, 'STAFF', 'save', 'Staff',
    'Fulfilment — take an order, pull it, deliver it',
    pg_temp.decompose((SELECT permissions FROM public.business_members
                        WHERE business_id = b.id AND role = 'STAFF' AND active)),
    'rbac-migration:rename'
  ) f
 WHERE b.id::text LIKE 'f7ec5d67%';

-- ════════════════════════════════════════════════════════════════════════════════
-- CALL 4 — STAFF FULFILMENT SET. 5 → 10.
-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 READ THE REASON STRING CORRECTLY. It is tagged `staff-narrow` because that names the INTENT
-- of the whole change — but THIS CALL IS ADDITIVE to the array. STAFF never held a delivery
-- STRING; they held unrestricted create/update/DELETE on deliveries through
-- `deliveries_member_all [ALL]`, a policy with NO permission string at all.
-- THE REVOCATION IS DELIVERED BY THE MIGRATION'S §1.15 POLICY SPLIT, NOT BY THIS CALL.
-- An auditor reading this additive row alone would conclude nothing was taken away. It was.
SELECT f.* FROM public.businesses b,
  LATERAL public.save_role_permissions(
    b.id, b.owner_id, 'STAFF', 'save', 'Staff',
    'Fulfilment — take an order, pull it, deliver it',
    (SELECT COALESCE(jsonb_agg(DISTINCT x.s), '[]'::jsonb) FROM (
       SELECT jsonb_array_elements_text((SELECT permissions FROM public.business_members
                WHERE business_id = b.id AND role = 'STAFF' AND active)) AS s
       UNION SELECT unnest(ARRAY['customers:read','inventory:read','deliveries:read',
                                 'deliveries:update','deliveries.route:read'])
     ) x),
    'rbac-migration:staff-narrow'
  ) f
 WHERE b.id::text LIKE 'f7ec5d67%';

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 9 — THE POST-STATE HALT GATE. Fails loudly if the arithmetic did not land.
-- ════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_biz uuid; v_m int; v_s int; v_legacy int; v_unwired int;
BEGIN
  SELECT id INTO v_biz FROM public.businesses WHERE id::text LIKE 'f7ec5d67%';
  SELECT jsonb_array_length(permissions) INTO v_m FROM public.business_members
   WHERE business_id = v_biz AND role = 'MANAGER' AND active;
  SELECT jsonb_array_length(permissions) INTO v_s FROM public.business_members
   WHERE business_id = v_biz AND role = 'STAFF' AND active;

  IF v_m <> 43 THEN RAISE EXCEPTION 'HALT — MANAGER landed at % strings, expected 43. ROLLBACK and re-derive.', v_m; END IF;
  IF v_s <> 10 THEN RAISE EXCEPTION 'HALT — STAFF landed at % strings, expected 10. ROLLBACK and re-derive.', v_s; END IF;

  SELECT count(*) INTO v_legacy FROM public.business_members bm, jsonb_array_elements_text(bm.permissions) x(s)
   WHERE bm.business_id = v_biz AND bm.active AND bm.role IN ('MANAGER','STAFF') AND x.s NOT LIKE '%:%';
  IF v_legacy > 0 THEN RAISE EXCEPTION 'HALT — % legacy string(s) survived the rename.', v_legacy; END IF;

  SELECT count(*) INTO v_unwired FROM public.business_members bm, jsonb_array_elements_text(bm.permissions) x(s)
   WHERE bm.business_id = v_biz AND bm.active
     AND x.s IN ('maintenance:override','deliveries.route:update','deliveries:create','campaigns:create',
                 'service_offerings:create','service_offerings:update','team:create','team:update','team:delete');
  IF v_unwired > 0 THEN RAISE EXCEPTION 'HALT — % declared-unwired string(s) landed in a live array. These are UN-REMOVABLE through the UI.', v_unwired; END IF;

  RAISE NOTICE 'POST-STATE PASSED — MANAGER 43, STAFF 10, zero legacy, zero declared-unwired.';
END $$;

COMMIT;   -- ← or ROLLBACK if any RAISE fired. Nothing partial can survive; it is one transaction.


-- ════════════════════════════════════════════════════════════════════════════════
-- LEDGER EVIDENCE — 🔴 PASTE RAW OUTPUT, NEVER THE WORD "passed" (David, 2026-07-27)
-- ════════════════════════════════════════════════════════════════════════════════
-- V5, V5b, V4, V7 and V9 of the flip migration go into the ledger row as RAW RESULTS.
-- V5/V5b are the two surfaces capQ CANNOT reach — it reads TypeScript, not the database — and a
-- declared-unwired string in a live array is the un-removable defect this whole invariant exists
-- to prevent. A sentence saying they passed is exactly the unstated-corpus claim this program has
-- produced three times.
--
-- ── the reason strings landed (proves the two-call split is legible a year from now) ──
-- SELECT created_at, target_id, detail->>'reason' AS reason,
--        detail->'members_affected' AS members,
--        jsonb_array_length(detail->'before') AS n_before,
--        jsonb_array_length(detail->'after')  AS n_after
--   FROM public.audit_log
--  WHERE action = 'role.permissions_changed' AND detail->>'reason' LIKE 'rbac-migration:%'
--  ORDER BY created_at;
-- EXPECT 4 rows: rename/MANAGER 13→35 · grant/MANAGER 35→43 · rename/STAFF 3→5 ·
--                staff-narrow/STAFF 5→10.
