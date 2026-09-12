-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260911b — THE SHIP-TO ADDRESS BOOK (`customer_addresses`) · D-41's L2 HOOK · ledger #303
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, in the SQL EDITOR — never the table editor (§6 r17:
-- a table created in the table editor is owned by `supabase_admin`, whose default ACL hands `anon`
-- TRUNCATE and REFERENCES, and TRUNCATE is outside row-level security entirely).
--
-- ── WHAT THIS IS ────────────────────────────────────────────────────────────────────────────
-- D-41 (David, 2026-07-16) ruled the address model and named this table in the same breath:
--
--   "ADDRESS = L1. Billing address = COLUMNS on customers (one, stable). SHIPPING IS NOT ON THE
--    CUSTOMER RECORD — a customer does not have 'a shipping address'; AN ORDER DOES. Ship-to is
--    entered per-order and SNAPSHOTTED ONTO THE DELIVERY ROW. DO NOT add shipping_* columns to
--    customers. The saved ship-to address book (customer_addresses) is the L2 HOOK — documented
--    as a deferred follow-up, NOT built. L1→L2 is ADDITIVE."
--
-- This is that hook being taken up, and it is ADDITIVE: it changes nothing about L1.
--
-- 🔴 THE INVARIANT SURVIVES INTO L2, AND IT IS THE WHOLE POINT:
--       THE ORDER STILL SNAPSHOTS THE CHOSEN ADDRESS ONTO THE DELIVERY ROW.
-- `deliveries` keeps its own `address_line1/city/state/zip` and this table is NEVER a foreign key
-- the delivery resolves at read time. If a contractor edits their saved "Job site A" tomorrow,
-- last month's invoice must still show where the load ACTUALLY went. A book row is a SOURCE for
-- the picker; the delivery row remains the record of where something shipped.
-- ⚠️ And still NO `shipping_*` columns on `customers`. That was the L2-shaped mistake in July and
-- it is still a mistake — `20260713_customers_party_record.sql:21` says so in its own header.
--
-- ── WHY NOW (the argument is data quality, not convenience) ──────────────────────────────────
-- A typed-per-order address drifts; a picked-from-a-list address cannot. MEASURED by David from
-- LAWNS's QuickBooks export, 2026-09-11: 43 organizations have more than one invoice and 17 carry
-- more than one DISTINCT ship-to — but that raw count is inflated by TYPING, not by sites (AGAVE
-- LD LLC has 18 invoices and four spellings of ONE yard, two of them a phone number in Line1).
-- The clean signal is FIVE organizations with one bill-to and two-or-more real ship-tos: ABC Home
-- and Pest, Davey Tree, Capital Tree Care, Brian Finch, Daniel Zook.
--
-- ⚠️ DAVID IS OVERRIDING A WRITTEN TRIGGER, DELIBERATELY, AND IT IS RECORDED RATHER THAN QUIETLY
-- CROSSED. `docs/decisions/2026-09-09-bill-to-ship-to-and-the-site-object-recon.md` recommended
-- "A now, B on a measured trigger", and wrote the trigger down: *"Build B when the count of LAWNS
-- customers holding two or more DISTINCT delivery addresses passes ~25, or when a contractor
-- complains about re-typing a site."* The count is 17 raw / 5 clean, not 25. His reason, in his
-- own words: *"building it now with a customer willing to work with me and identify errors and
-- has good will beats some signal."* That is a judgement about WHEN to spend goodwill, which the
-- recon's arithmetic could not make. Recorded so nobody reads the trigger later and calls this drift.
--
-- ── NAME: `customer_addresses`, NOT `customer_sites` ─────────────────────────────────────────
-- The 2026-09-09 recon proposed `customer_sites` (§G10) and it is the better English. It is NOT
-- used, and the reason is that `customer_addresses` is the name in THREE standing artefacts that
-- a reader will search for: D-41 itself, `20260713_customers_party_record.sql:27-30`, and the
-- board row `user_stories.md:1630`. Renaming orphans the deferred-decision trail that makes this
-- table legible. AC-1 holds either way — neither name carries a vertical noun.
--
-- ── `line2` IS PRESENT AND NO SURFACE OFFERS IT. STATED, NOT HIDDEN ──────────────────────────
-- David's instruction: present from day one. The reason is tech-debt #254 — the QuickBooks
-- importer does not read `BillAddr.Line2`, where 456 values sit and 453 are real streets. When
-- that fix lands, the book needs somewhere to put them.
-- 🔴 AND THE HONEST HALF: `deliveries` HAS NO `address_line2`, so a `line2` typed here could not
-- be snapshotted onto a stop — it would silently disappear between the picker and the truck. So
-- NO FORM IN THIS BUILD OFFERS THE FIELD (§1.6 item 5 — no dead affordance), and nothing can put
-- a value in it. ⚠️ That makes it a live column nothing writes, which is EXACTLY tech-debt #267's
-- shape (`orders.install_date`). The difference, and it is the only one that matters: #267 was
-- declared with no plan and no owner, while this one is declared BECAUSE a named, filed defect
-- (#254) will fill it. Filed as tech-debt #279 so it cannot rot unnoticed if #254 never lands.
--
-- ── WHAT THIS MIGRATION DOES NOT DO ─────────────────────────────────────────────────────────
--   · It BACKFILLS NOTHING. See §4 — the sequencing decision, and it is the load-bearing one.
--   · It DEDUPLICATES NOTHING. AGAVE's four spellings stay four spellings on the invoices.
--   · It adds NO column to `customers` and NO column to `deliveries`.
--   · It MINTS NO PERMISSION STRING. See §2.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 THE TABLE ────────────────────────────────────────────────────────────────────────────
-- AC-1: no vertical noun. A "site" is a value of the relationship, not a Cultivar concept.
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id  uuid NOT NULL REFERENCES public.customers(id)  ON DELETE RESTRICT,
  -- What a person calls the place. "Job site A", "The yard", "Back gate".
  label        text NOT NULL,
  line1        text,
  line2        text,   -- see the header: present, offered by NO surface in this build.
  city         text,
  state        text,
  zip          text,
  notes        text,
  is_default   boolean NOT NULL DEFAULT false,
  -- R-133 (David, 2026-09-01): *"you can't delete, you can just mark deleted."* A site is
  -- RETIRED, never removed — an address that appears on a past delivery must stay resolvable.
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ⚠️ `ON DELETE RESTRICT` on customer_id, matching `orders_customer_id_fkey` (R-104): deleting a
-- customer who has saved sites ERRORS rather than silently taking the sites with it. R-104's own
-- finding was that RESTRICT erroring instead of degrading is the half that had to be proven.

COMMENT ON TABLE public.customer_addresses IS
  'D-41 L2: the saved ship-to address book. A SOURCE for the order-time picker, never the record '
  'of where a load went — the delivery row keeps its own snapshot. No shipping_* on customers.';
COMMENT ON COLUMN public.customer_addresses.line2 IS
  'Present for tech-debt #254 (the importer does not read BillAddr.Line2). NO surface offers it '
  'today because deliveries has no address_line2 to snapshot it into. Tech-debt #278.';
COMMENT ON COLUMN public.customer_addresses.active IS
  'R-133 soft-deactivate. A retired site disappears from the picker and stays readable.';

-- ── §2 RLS — THE 2026-09-10 SHAPE, AND NO NEW STRING ────────────────────────────────────────
-- 🔴 REUSE `customers:*`. DO NOT MINT `sites:*`. Two reasons, both standing:
--   (a) The 2026-07-31 ruling — *a permission gates a CAPABILITY, not a field* (tech-debt #84).
--       A saved site is a field of the customer relationship, not a capability of its own.
--   (b) R-22: a manifest flip alone changes nothing — a new string needs a funnel
--       re-materialisation before any live member holds it, so four new strings would ship a
--       table NOBODY could read on day one. `customers:read` is already held by every LAWNS
--       member including STAFF (`STAFF_DEFAULT_BUNDLE` — *"customers:read // where to deliver"*).
-- All three strings are `enforced` in `permissionManifest.ts`, measured 2026-09-11.
--
-- 🔴 NO RAW `owner_id` POLICY. `20260910b` repointed 49 → 12 the day before yesterday (R-119);
-- this is not the 50th. The owner reaches the table as an active member holding the string, which
-- is what R-22 ruled authority to be.
--
-- ⚠️ NO DELETE POLICY, DELIBERATELY. Retiring a site is an UPDATE of `active` (R-133), so DELETE
-- is unreachable for every member — fail-closed, and it is the STATE we want, not an omission.
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_addresses_member_select ON public.customer_addresses;
CREATE POLICY customer_addresses_member_select ON public.customer_addresses FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:read'));

DROP POLICY IF EXISTS customer_addresses_member_insert ON public.customer_addresses;
CREATE POLICY customer_addresses_member_insert ON public.customer_addresses FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:create'));

DROP POLICY IF EXISTS customer_addresses_member_update ON public.customer_addresses;
CREATE POLICY customer_addresses_member_update ON public.customer_addresses FOR UPDATE TO authenticated
  USING      (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:update'));

-- ── §3 INDEXES ──────────────────────────────────────────────────────────────────────────────
-- The picker's own read: every active site for one customer.
CREATE INDEX IF NOT EXISTS customer_addresses_customer_idx
  ON public.customer_addresses (business_id, customer_id) WHERE active;

-- 🔴 AT MOST ONE DEFAULT PER CUSTOMER, ENFORCED BY THE DATABASE RATHER THAN BY A CONVENTION.
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default
  ON public.customer_addresses (business_id, customer_id) WHERE is_default AND active;

-- 🔴 ONE LABEL PER CUSTOMER. Two sites both called "Job site A" is the drift this table exists to
-- prevent, arriving by a different door. Case-insensitive, active rows only.
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_label
  ON public.customer_addresses (business_id, customer_id, lower(label)) WHERE active;

-- ⚠️ THESE THREE PARTIAL UNIQUE INDEXES LAND CLEANLY, AND THAT IS NOT LUCK — IT IS THE ONE
-- CIRCUMSTANCE IN THIS REPO WHERE IT IS TRUE. Tech-debt #54, #58, #143 and #183 are all the same
-- blocked shape: *the durable fix is a partial unique index, and it cannot land until the live
-- rows are known clean.* Here the table is EMPTY BY CONSTRUCTION — it is created in this same
-- transaction and §4 forbids a backfill — so there is no row that can refuse the index. This is
-- the only moment such an index is free, which is the argument for writing all three NOW.

-- ── §4 🔴 THE SEQUENCING DECISION: NO BACKFILL. NOT NOW, NOT LATER BY THIS FILE ─────────────
-- The importer does not read `BillAddr.Line2` (tech-debt #254): 456 values are there, 453 of them
-- real streets, and 451 routable addresses currently land in the record as PHONE NUMBERS. AGAVE's
-- four spellings of one yard are that defect showing through.
--
-- 🔴 IF THIS BOOK WERE SEEDED FROM THOSE STRINGS, FOUR SPELLINGS WOULD BECOME FOUR SAVED SITES
-- AND THE DRIFT WOULD BE MADE PERMANENT INSTEAD OF FIXED — promoted from a typo on an old invoice
-- to a curated entry a person picks from a list. A book full of history's mistakes is worse than
-- no book, because it looks authoritative.
--
-- SO: THIS BUILD DOES NOT BACKFILL FROM HISTORY AT ALL. The table starts empty on every tenant
-- and records only addresses entered from today forward. It is TRUE IN THE CODE, not merely
-- promised here: no INSERT ... SELECT appears below, `customerAddresses.ts` reads `customers` and
-- `deliveries` for NOTHING, and `customerAddresses.test.ts` §F asserts the migration corpus
-- contains no seed of this table — a probe that goes red the day somebody adds one.
--
-- Whether a bounded, reviewed backfill happens AFTER #254 lands is David's call and a separate
-- build. It is not foreclosed; it is refused HERE, where it would be unreviewable.

-- ── §5 updated_at ───────────────────────────────────────────────────────────────────────────
-- Reuses the canonical `set_updated_at_generic()` from `20260604_business_modules.sql` (STD-011 —
-- one trigger function, not a per-table copy).
DROP TRIGGER IF EXISTS trg_customer_addresses_updated_at ON public.customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — run AFTER applying. Read-only. Paste ONE statement at a time: the SQL editor shows
-- only the LAST result set, and it opens a FRESH CONNECTION per run (so no temp tables).
-- ⚠️ NOT `SET LOCAL role authenticated` — that form has never worked here and FAILED on first use
-- with `permission denied to set role` (tech-debt #240). Setting the claims GUC alone is proven.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- V1 · the table exists with the columns this build expects, and `line2` is among them.
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'customer_addresses'
--  ORDER BY ordinal_position;

-- V2 · RLS is ON and exactly three policies exist, each naming its own string. A row here with a
-- `qual` mentioning `owner_id` would mean the 50th raw policy got in after all.
-- SELECT c.relrowsecurity AS rls_enabled, p.policyname, p.cmd, p.qual, p.with_check
--   FROM pg_policies p JOIN pg_class c ON c.relname = p.tablename
--  WHERE p.schemaname = 'public' AND p.tablename = 'customer_addresses'
--  ORDER BY p.policyname;

-- V3 · the three indexes are present and PARTIAL (the `WHERE` must appear in each definition).
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname = 'public' AND tablename = 'customer_addresses' ORDER BY indexname;

-- V4 · THE BOOK IS EMPTY. §4's claim, checkable. Anything but 0 means something backfilled it.
-- SELECT count(*) AS rows_in_the_book FROM public.customer_addresses;

-- V5 · `customers` gained NO shipping_* column, and `deliveries` gained nothing. D-41's redline,
-- asserted rather than assumed. Expect ZERO rows.
-- SELECT table_name, column_name FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND (column_name LIKE 'shipping%' OR (table_name = 'deliveries' AND column_name = 'address_line2'));
