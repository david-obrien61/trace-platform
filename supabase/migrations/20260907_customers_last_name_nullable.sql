-- ════════════════════════════════════════════════════════════════════════════════
-- 20260907 — A COMPANY HAS NO FAMILY NAME. `customers.last_name` BECOMES NULLABLE.
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
--
-- 🔴 DAVID'S RULING, 2026-09-07, after the customer import died on its first row:
--    *"A company has no family name. NULL is the true value; '' is a value pretending to be one.
--    And it is already lying on three rows — importing 120 more bakes it in."*
--
-- ── WHAT FAILED, AND WHY THE CONSTRAINT IS THE DEFECT RATHER THAN THE WRITER ─────
-- `customer insert failed at row 0: null value in column "last_name" of relation "customers"
-- violates not-null constraint`. **MEASURED: `FamilyName` is on 1,826 of LAWNS's 1,946 QuickBooks
-- customers, so 120 have none**, and row 0 is one of them.
--
-- 🔴 `qboCustomerAdapter.ts` WAS ALREADY CORRECT. It emits `last_name: null` for an organization
-- and for a person QuickBooks gives no FamilyName. The adapter told the truth and the column
-- refused it. **The schema was the thing that was wrong**, and this is the one-line fix.
--
-- ── WHY NOT '' — THE EXISTING CONVENTION, WHICH THIS RULING RETIRES ──────────────
-- `customerUpsert.ts:186` writes `last_name: ''` on insert with the comment *"last_name is NOT NULL
-- in the schema; on INSERT it must be present even when blank."* That was a correct workaround for
-- a constraint that should not have existed. It keeps working after this migration — `''` is still
-- a legal value — so **nothing that writes today changes behaviour**. New writers say NULL.
--
-- ⚠️ NOT A BACKFILL, DELIBERATELY, AND DAVID SAID SO. LAWNS's three organization rows carry the
-- company name in `first_name` and `''` in `last_name`, with `organization_name` and `display_name`
-- both NULL: LEANDER AREA WHLS NRSY SPLY, Steve & Sue Williams, Nancy & Bob Ramsay. They are wrong.
-- **Two of the three are also vendor-invoice residue with a separate cleanup owed**, so they are
-- REPORTED and LEFT. A migration that quietly rewrote three customer rows on the way past would be
-- doing a data decision under cover of a schema change.
--
-- ── BLAST RADIUS, MEASURED RATHER THAN ESTIMATED ────────────────────────────────
-- 76 source references to `last_name`. Almost every read already guards —
-- `${first_name ?? ''} ${last_name ?? ''}`.trim(). **Exactly ONE interpolated it unguarded**
-- (`api/orders/submit.ts:1159`), which would have rendered "Bob null"; fixed in the same commit.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.customers ALTER COLUMN last_name DROP NOT NULL;

COMMENT ON COLUMN public.customers.last_name IS
  'Family name. NULL where there genuinely is none — an organization, or a person QuickBooks holds '
  'with no FamilyName (120 of LAWNS''s 1,946). NULL is the true value; '''' is a value pretending to '
  'be an answer (David, 2026-09-07). Existing '''' rows are left as they are: correcting them is a '
  'data decision with its own cleanup, not a side effect of a schema change.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run AFTER applying. TENANT: LAWNS = ed2e5933-45dc-4b9b-a331-ddfd125e7a74.
-- ════════════════════════════════════════════════════════════════════════════════
--
-- V1 — the column is nullable now. EXPECT is_nullable = 'YES'.
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='customers' AND column_name='last_name';
--
-- V2 — 🔴 NOTHING WAS REWRITTEN. EXPECT 30 total and 3 still carrying ''.
--      A migration that quietly fixed the three legacy rows would be indistinguishable from one
--      that only changed the constraint, and David ruled they are LEFT.
-- SELECT count(*) AS total,
--        count(*) FILTER (WHERE last_name = '')   AS still_empty_string,
--        count(*) FILTER (WHERE last_name IS NULL) AS now_null
--   FROM public.customers WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 — the three rows this deliberately did NOT touch, named so the cleanup can find them.
--      EXPECT 3 rows, each with the company name in first_name and NULL organization_name.
-- SELECT first_name, last_name, organization_name, display_name, customer_type
--   FROM public.customers
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND customer_type = 'organization';
--
-- V4 — 🔴 A NULL IS NOW ACCEPTED. Run it, read the error (there should be none), ROLL BACK.
--      A constraint change nobody has watched accept is a claim (§6 r19b).
-- BEGIN;
--   INSERT INTO public.customers (business_id, first_name, last_name, customer_type)
--   VALUES ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', 'NULL PROBE — ROLL BACK', NULL, 'person');
-- ROLLBACK;
--      EXPECT: INSERT 0 1, no error. Before this migration it raised 23502.
