-- =============================================================================
-- Backfill customers.billing_* from the legacy unprefixed address columns
-- =============================================================================
-- ⚠️ APPLIED LIVE BY DAVID ON 2026-07-29, BEFORE THIS FILE EXISTED.
--    This file is its DURABLE FORM, not work to be run. It exists so a rebuild —
--    or a fresh tenant database — reproduces the same state. On the database it
--    was applied to it is a NO-OP by its own WHERE clause; on a fresh one it is
--    correct. (This is the #155 shape: a live-found fix whose file has to be
--    written afterwards or the repo stops describing the database.)
--
-- MEASURED, before → after (David, live):
--    legacy_only       15 → 0
--    legacy_only_orgs   3 → 0
--    all_orgs           3 (unchanged)
--    all_rows          16 (unchanged)
--
-- WHY IT WAS NEEDED — the D-47 reasoning, scoped:
--    `billing_*` is the CANONICAL home for a customer's billing address (D-41);
--    the unprefixed `address_line1/city/state/zip` are its legacy MIRROR, still
--    read by DeliveryRoute / DeliverySchedule / OrderDetail / ScanOrder. The
--    party editor writes BOTH. `customerUpsert` (checkout + OCR ingest) writes
--    only the legacy four — so a repeat checkout could diverge the two sets.
--
--    The ruling (2026-07-29) is that MACHINE WRITERS WRITE CANONICAL AND MIRROR
--    DOWN. That repoint has a hazard, and this backfill is what disarms it:
--    `customerUpsert`'s ORGANIZATION dedup key matches on
--        normalizeMatchKey(customer.first_name) + normalizeMatchKey(address_line1)
--    and its own comment calls that second field "BILLING address". Once writes
--    move to canonical, the key is comparing against a column that pre-existing
--    rows may never have had populated → no match → a new row per invoice. That
--    is EXACTLY the duplicate-organization defect D-47 / tech-debt #53 closed
--    ("Dave's Tree Svs → 3 duplicates", nine real invoices cross-billed).
--
--    With `billing_*` populated on every row that had a legacy address, the key
--    matches after the repoint and D-47 STAYS CLOSED. This migration is
--    therefore a PRECONDITION of the customerUpsert repoint (build phase D),
--    not an independent tidy-up.
--
-- SCOPE LIMIT, STATED RATHER THAN SILENT:
--    The predicate keys on `address_line1` — the same one the measurement used,
--    so the before/after numbers above describe THIS statement exactly. A row
--    holding a legacy `city` but NO `address_line1` is NOT covered. Zero such
--    rows existed at apply time (legacy_only went to 0). If one is ever created,
--    it is a new finding, not something this file silently handled.
--
-- NOT DONE HERE (its own decision): the legacy columns are NOT dropped. They are
--    still read by four surfaces; the read repoint is build phase D.
-- =============================================================================

BEGIN;

-- COALESCE per column so an already-populated billing field is never overwritten
-- — the backfill FILLS, it does not clobber (the same rule the ruling puts on
-- machine writers). Re-running this statement can only ever be a no-op.
UPDATE public.customers
   SET billing_line1 = COALESCE(billing_line1, address_line1),
       billing_city  = COALESCE(billing_city,  city),
       billing_state = COALESCE(billing_state, state),
       billing_zip   = COALESCE(billing_zip,   zip)
 WHERE address_line1 IS NOT NULL
   AND billing_line1 IS NULL;

COMMIT;

-- =============================================================================
-- VERIFICATION — run after apply. Catalog/data reads, never the builder's memory.
-- =============================================================================

-- V1 — the defect is gone: no row has a legacy address without its canonical twin.
--      EXPECT 0.
-- SELECT count(*) AS legacy_only
--   FROM public.customers
--  WHERE address_line1 IS NOT NULL AND billing_line1 IS NULL;

-- V2 — the row that matters for D-47: organizations, which are the ONLY rows the
--      dedup key touches. EXPECT 0.
-- SELECT count(*) AS legacy_only_orgs
--   FROM public.customers
--  WHERE address_line1 IS NOT NULL AND billing_line1 IS NULL
--    AND customer_type = 'organization';

-- V3 — POSITIVE CONTROL: nothing was destroyed. The legacy columns are intact and
--      the row/org totals are unchanged. EXPECT all_rows 16, all_orgs 3 on the
--      2026-07-29 database (both counts are data, not invariants — a later tenant
--      will differ; what must hold is that this migration did not change them).
-- SELECT count(*) AS all_rows,
--        count(*) FILTER (WHERE customer_type = 'organization') AS all_orgs,
--        count(*) FILTER (WHERE address_line1 IS NOT NULL)      AS legacy_intact
--   FROM public.customers;

-- V4 — the pairs actually agree where both are present (spot the mirror, not just
--      its presence). EXPECT 0 disagreements.
-- SELECT count(*) AS mirror_disagrees
--   FROM public.customers
--  WHERE address_line1 IS NOT NULL AND billing_line1 IS NOT NULL
--    AND billing_line1 IS DISTINCT FROM address_line1;
