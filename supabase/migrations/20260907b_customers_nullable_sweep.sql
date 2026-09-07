-- ════════════════════════════════════════════════════════════════════════════════
-- 20260907b — EVERY NOT NULL ON `customers` THE IMPORT CAN LEGITIMATELY LEAVE EMPTY,
--             ENUMERATED IN ONE PASS AND FIXED IN ONE MIGRATION.
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (§6 r17).
-- DEPENDS ON: 20260907_customers_last_name_nullable.sql (apply that first if you have not).
--
-- 🔴 DAVID, AFTER THE SECOND STOP IN AN HOUR: *"BEFORE YOU WRITE ANOTHER ALTER: enumerate every
--    NOT NULL column on `customers` that has no default, and check the WHOLE adapter payload
--    against it in one pass. Give me ONE migration covering everything the adapter can legitimately
--    emit as NULL, not another single-column fix."*
--
-- ── HOW THE LIST WAS OBTAINED, BECAUSE THE REPO CANNOT ANSWER IT ─────────────────
-- `customers` has NO `CREATE TABLE` anywhere in `supabase/migrations` (tech-debt #39 — live-only
-- schema), so no repo-parsing cap can see its constraints and the widened §A2 check is
-- structurally blind here. The list below was walked EMPIRICALLY against the live table: post the
-- adapter's full payload with every value NULL, read which column Postgres names, satisfy it,
-- repeat until the insert is accepted. **Five NOT NULL columns without a default are reachable
-- that way:** `first_name` · `state` · `source` · `customer_type` · `tax_exempt`.
--
-- ⚠️ AND THE WALK WROTE A ROW, WHICH IS RECORDED RATHER THAN QUIETLY TIDIED. `Prefer: tx=rollback`
-- was sent and was NOT honoured on the accepted insert (this PostgREST does not have
-- `db-tx-end=rollback-allowed`). One row landed on LAWNS — `first_name = 'PROBE'`, id
-- a17a3149-438d-4f1e-9ec8-7867212ccc36 — and was deleted immediately; the tenant was verified back
-- at 30 customers with zero PROBE rows. **Do not assume tx=rollback works here.**
--
-- ══════════════════════════════════════════════════════════════════════════════════
-- 🔴 ONLY **TWO** OF THE FIVE CHANGE, AND THE OTHER THREE ARE NAMED SO NOBODY WIDENS
--    THIS FURTHER "TO BE SAFE". A constraint dropped without a reason is a constraint
--    nobody can put back.
-- ══════════════════════════════════════════════════════════════════════════════════
--   · `first_name`  → DROP. David's ruling: *"an organization has no first name and no last name.
--                     NULL is the true value for both. Do not reach for '' on either."*
--                     `qboCustomerAdapter` emits `first_name: null` for every organization.
--   · `state`       → DROP. `str(a.CountrySubDivisionCode)` returns NULL when QuickBooks holds no
--                     address, or an address with no state. A customer with no address is ordinary.
--   · `source`      → KEPT. `rowForCustomer` always writes `CUSTOMER_IMPORT_SOURCE`. Never null.
--   · `customer_type` → KEPT. Always `'person'` or `'organization'`; the classifier has no third
--                     answer and no null branch.
--   · `tax_exempt`  → KEPT. Typed `boolean` (not `boolean | null`) on the adapter, and both return
--                     paths set `true` or `false`. `Taxable` is present on all 1,946 records.
--
-- ⚠️ NOT A BACKFILL. Nothing existing is rewritten — see 20260907's V2/V3 for the three legacy
-- organization rows that are deliberately being left for a separate cleanup.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.customers ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.customers ALTER COLUMN state      DROP NOT NULL;

COMMENT ON COLUMN public.customers.first_name IS
  'Given name. NULL for an ORGANIZATION — a company has no given name, and putting its display '
  'name here is what LAWNS''s three legacy organization rows do wrong (David, 2026-09-07). The '
  'company name belongs in organization_name and display_name, which this import is the first '
  'thing on the platform to fill correctly.';

COMMENT ON COLUMN public.customers.state IS
  'State/province, NULL when the record carries no address or an address without one. QuickBooks '
  'holds plenty of both; a customer with no address is ordinary, not an error.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run AFTER applying. TENANT: LAWNS = ed2e5933-45dc-4b9b-a331-ddfd125e7a74.
-- ════════════════════════════════════════════════════════════════════════════════
--
-- V1 — 🔴 THE WHOLE POINT: run David's own query and read the WHOLE table at once, so the next
--      required column is found here rather than by a third failed import.
-- SELECT column_name, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='customers'
--  ORDER BY ordinal_position;
--      EXPECT: `first_name`, `last_name` and `state` all is_nullable='YES'. The only remaining
--      NOT-NULL-without-default columns should be `source`, `customer_type`, `tax_exempt` — each
--      of which the writer always supplies. **If a fourth appears, STOP: the payload has grown.**
--
-- V2 — 🔴 NOTHING WAS REWRITTEN. EXPECT 30 total, 3 still carrying '' in last_name, 0 nulls.
-- SELECT count(*) AS total,
--        count(*) FILTER (WHERE last_name = '')    AS still_empty_string,
--        count(*) FILTER (WHERE first_name IS NULL) AS first_name_null
--   FROM public.customers WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 — 🔴 AN ORGANIZATION-SHAPED ROW IS NOW ACCEPTED. Run it, then ROLL IT BACK BY HAND.
--      ⚠️ `Prefer: tx=rollback` is NOT honoured on this PostgREST — a successful INSERT COMMITS.
--      In the SQL editor a real transaction does work, so use one:
-- BEGIN;
--   INSERT INTO public.customers (business_id, first_name, last_name, state, display_name,
--                                 organization_name, customer_type, source, tax_exempt)
--   VALUES ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', NULL, NULL, NULL, 'PROBE CO',
--           'PROBE CO', 'organization', 'probe', false);
-- ROLLBACK;
--      EXPECT: INSERT 0 1, no error. Before this migration it raised 23502 on first_name.
--      🔴 CONFIRM THE ROLLBACK: SELECT count(*) FROM public.customers WHERE display_name='PROBE CO';
--         must be 0.
