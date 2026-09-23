-- ─────────────────────────────────────────────────────────────────────────────
-- 20260923f_service_offerings_price_source.sql     ·  ledger #386  ·  R-171 (b)
--
-- PURPOSE: let a service say WHERE its price comes from, so an install can be
--   priced from the tree's container size instead of from one scalar.
--
-- 🔴 WHY A COLUMN AND NOT AN INFERENCE. The obvious shortcut is "the per-plant
--   staff transport row always prices from the ladder." It is wrong, and the live
--   data says why: Test Dave's `Placement Service` is exactly that shape — staff,
--   per_unit, per plant — and is a flat $225 that must keep working as $225.
--   Inferring would silently re-price another tenant's live service. The row says
--   what it means instead.
--
-- 🔴 AND IT IS THE HOOK DAVID NAMED, NOT A ONE-OFF FOR LAWNS. David, 2026-09-23:
--   *"Don't tailor to LAWNS: a new tenant answers 'how do you price install?' —
--   per size / flat / percentage of plants. Same code above."* Two of those three
--   values ship here. The third — `percent_of_goods`, which is the 2026-09-10
--   install-is-100%-of-plants ruling (R-172) demoted from THE rule to ONE option —
--   is a value added to this CHECK and a branch in one pure function. David ruled
--   it *"NOT a blocker"*, so it is deliberately absent rather than half-built.
--
-- ⚠️ AC-1: `container_ladder` is a TABLE NAME, not a vertical noun. Containers are
--   generic — any vertical selling a sized unit has them — and the value names the
--   platform table the price is read from, exactly as `price_unit` names a unit.
--   Nothing here says nursery, plant or tree.
--
-- ADDITIVE, AND THE DEFAULT IS THE WORLD AS IT IS: every existing row becomes
--   'fixed', which is precisely what every existing row already does. NOT NULL with
--   a default, so no row is left saying nothing. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE service_offerings
  ADD COLUMN IF NOT EXISTS price_source text NOT NULL DEFAULT 'fixed';

-- A NAMED constraint, not an inline one — tech-debt #91: an inline CHECK is
-- auto-named by Postgres, so its name is never typed and a name-grep can never
-- find it. 129 inline CHECKs in this corpus already have that property.
ALTER TABLE service_offerings
  DROP CONSTRAINT IF EXISTS service_offerings_price_source_check;
ALTER TABLE service_offerings
  ADD CONSTRAINT service_offerings_price_source_check
  CHECK (price_source IN ('fixed', 'container_ladder'));

COMMENT ON COLUMN service_offerings.price_source IS
  'Where this service''s price comes from. fixed = the price column (every row before 2026-09-23). container_ladder = per container size, read from the rung the line lands on; the price column is then unused and a rung with no price makes the counter type an amount (R-171 (c)).';

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Read-only. Run AFTER the migration.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE COLUMN EXISTS, NOT NULL, DEFAULT 'fixed'. Expect: PASS.
SELECT 'V1 price_source NOT NULL DEFAULT fixed' AS check,
       CASE WHEN count(*) = 1 AND bool_and(is_nullable = 'NO' AND column_default LIKE '%fixed%')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       string_agg(data_type || ' null=' || is_nullable || ' default=' || coalesce(column_default,'(none)'), '') AS shape
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'service_offerings' AND column_name = 'price_source';

-- V2 — THE CONSTRAINT IS NAMED AND ADMITS EXACTLY TWO VALUES. Expect: PASS.
SELECT 'V2 the CHECK is NAMED (not inline) and admits two values' AS check,
       CASE WHEN count(*) = 1
             AND bool_and(pg_get_constraintdef(oid) LIKE '%fixed%'
                      AND pg_get_constraintdef(oid) LIKE '%container_ladder%')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       min(conname) AS constraint_name,
       min(pg_get_constraintdef(oid)) AS definition
  FROM pg_constraint
 WHERE conrelid = 'service_offerings'::regclass
   AND conname = 'service_offerings_price_source_check';

-- V3 — 🔴 EVERY EXISTING ROW IS 'fixed'. The no-silent-repricing control.
-- Expect: PASS, and container_ladder = 0. This migration must change no price.
SELECT 'V3 every existing service is still priced the way it was' AS check,
       CASE WHEN count(*) FILTER (WHERE price_source <> 'fixed') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS services_total,
       count(*) FILTER (WHERE price_source = 'fixed')            AS fixed,
       count(*) FILTER (WHERE price_source = 'container_ladder') AS ladder_should_be_zero
  FROM service_offerings;

-- V4 — 🔴 TEST DAVE'S PLACEMENT SERVICE IS UNTOUCHED. The named negative control.
-- It is the row that proves inference would have been wrong: staff, per_unit, per
-- plant, $225 — the exact shape LAWNS's install will take — and it must stay fixed.
SELECT 'V4 Placement Service is still a flat $225 per plant' AS check,
       CASE WHEN count(*) = 1 AND bool_and(price_source = 'fixed' AND price = 225.00)
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       min(name) AS row_name,
       min(price_source) AS price_source,
       min(price)::text AS price,
       min(price_type) || '/' || min(price_unit) AS shape
  FROM service_offerings
 WHERE name = 'Placement Service';

-- V5 — 🔴 THE CHECK CAN REFUSE. §6 r19: *"a check nobody has seen refuse is a
-- claim."* RUN THIS BLOCK ON ITS OWN.
--
--   EXPECTED RESULT: **an ERROR** — `23514 check_violation`, naming
--   `service_offerings_price_source_check`. That error IS the PASS, and it is the
--   most visible verdict there is.
--   IF IT INSTEAD SAYS `UPDATE 1`, the constraint is NOT doing its job — and the
--   ROLLBACK on the next line undoes the write either way, so the probe is safe
--   whichever way it goes. Nothing is committed under any outcome.
--
-- ⚠️ `percent_of_goods` is not an arbitrary bad value — it is the THIRD pricing
--   strategy David deferred. When it is built, this probe must be changed to a
--   value that is still invalid, or it will start failing for the right reason at
--   the wrong time.

BEGIN;
UPDATE service_offerings
   SET price_source = 'percent_of_goods'
 WHERE id = (SELECT id FROM service_offerings ORDER BY created_at LIMIT 1);
ROLLBACK;
