-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260911 — A TRANSPORT SERVICE MUST SAY WHO TRANSPORTS (R-120 · ledger #292)
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, in the SQL EDITOR — never the table editor (§6 r17).
--
-- WHY. On 2026-09-09 LAWNS's Trip Charge was written `category = 'transport'` with `transport_mode`
-- NULL and DID NOT APPEAR ON AN ORDER AT ALL. Checkout sorts transport rows by mode and nothing else,
-- so a NULL row matches no role and falls out without an error. The app now refuses that row on every
-- writer it has (`serviceOfferingShape.ts`, asked by the Settings editor, the books review and the
-- discovery seed). THIS is the only form of the rule a FOURTH writer cannot forget — tech-debt #218
-- says the next writer is coming, and every writer so far has restated the table's rules its own way.
--
-- WHAT IT DOES NOT DO — AND THIS IS THE HALF THAT MATTERS.
--   · It REPAIRS NOTHING. A half-bound row is the owner's decision (staff? self? not transport at all?)
--     and a row that has been invisible for weeks is a finding to see, not one to quietly start billing.
--   · So §0 REFUSES to run while any half-bound row exists, and names them. Settle those first.
--   · It is NOT `NOT VALID`. A NOT VALID constraint is still enforced on UPDATE, which would stop an
--     owner turning a broken row OFF — the one thing they should always be able to do.
--
-- ⚠️ ONE DIRECTION ONLY. It does not require a NON-transport row to carry NULL; that is the app's
-- clearing rule, never measured live, and a constraint on unmeasured rows is a guess (R-111).
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- §0 PRE-FLIGHT — refuse while any half-bound row exists. Repairs nothing.
DO $$
DECLARE
  n     int;
  names text;
BEGIN
  SELECT count(*), string_agg(format('%s [%s, active=%s]', so.name, b.name, so.is_active), '; ')
    INTO n, names
    FROM service_offerings so
    JOIN businesses b ON b.id = so.business_id
   WHERE so.category = 'transport' AND so.transport_mode IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'REFUSED — % transport service(s) carry no transport_mode: %. Each is the owner''s decision; settle them in Settings → Services, then run this again. Nothing was changed.', n, names;
  END IF;
END $$;

-- §1 THE CONSTRAINT — named explicitly. An inline CHECK is auto-named, and a grep for its name
-- could never find it (tech-debt #91). Idempotent: a second run is a no-op, not an error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.service_offerings'::regclass
       AND conname  = 'service_offerings_transport_requires_mode'
  ) THEN
    ALTER TABLE service_offerings
      ADD CONSTRAINT service_offerings_transport_requires_mode
      CHECK (category <> 'transport' OR transport_mode IS NOT NULL);
  END IF;
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — run AFTER applying. Read-only except V3, which writes nothing that survives.
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- V1 — the constraint exists, is VALIDATED, and says what the app says. EXPECT one row, convalidated = true.
-- SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
--   FROM pg_constraint
--  WHERE conrelid = 'public.service_offerings'::regclass
--    AND conname  = 'service_offerings_transport_requires_mode';
--
-- V2 — no half-bound row exists anywhere. EXPECT 0.
-- SELECT count(*) FROM service_offerings WHERE category = 'transport' AND transport_mode IS NULL;
--
-- V3 — THE REFUSAL, AND THE ACCEPTANCE, ON TEST DAVE'S. Both inserts are rolled back inside their own
-- sub-block, so NOTHING is left behind. EXPECT two rows, both starting PASS.
-- CREATE TEMP TABLE r120_proof (result text);
-- DO $$
-- BEGIN
--   BEGIN
--     INSERT INTO service_offerings (business_id, name, category, price_type, price_unit, price)
--     VALUES ('f7ec5d67-a9ef-4cb0-b807-438d67687d1b', 'ZZ R-120 probe — no mode', 'transport', 'flat', 'order', 1);
--     INSERT INTO r120_proof VALUES ('FAIL refusal: a transport row with NO mode was ACCEPTED');
--     RAISE EXCEPTION 'r120-undo';
--   EXCEPTION
--     WHEN check_violation THEN INSERT INTO r120_proof VALUES ('PASS refusal: ' || SQLERRM);
--     WHEN raise_exception THEN IF SQLERRM <> 'r120-undo' THEN RAISE; END IF;
--   END;
--   BEGIN
--     INSERT INTO service_offerings (business_id, name, category, price_type, price_unit, price, transport_mode, requires_address)
--     VALUES ('f7ec5d67-a9ef-4cb0-b807-438d67687d1b', 'ZZ R-120 probe — staff', 'transport', 'flat', 'order', 1, 'staff', true);
--     RAISE EXCEPTION 'r120-undo';
--   EXCEPTION
--     WHEN raise_exception THEN
--       IF SQLERRM = 'r120-undo' THEN INSERT INTO r120_proof VALUES ('PASS acceptance: a transport row WITH a mode was accepted (then undone)');
--       ELSE RAISE; END IF;
--     WHEN OTHERS THEN INSERT INTO r120_proof VALUES ('FAIL acceptance: ' || SQLERRM);
--   END;
-- END $$;
-- SELECT * FROM r120_proof;
-- -- and confirm nothing survived — EXPECT 0:
-- SELECT count(*) FROM service_offerings WHERE name LIKE 'ZZ R-120 probe%';
