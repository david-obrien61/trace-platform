-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260915 — THE CONTACT RECORD · `customer_phones` + `customer_emails` + `customer_addresses`
--            GAINS `kind`/`source` · THE FLAT COLUMNS BECOME DERIVED · ledger #335
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, in the SQL EDITOR — never the table editor (§6 r17:
-- a table created in the table editor is owned by `supabase_admin`, whose default ACL hands `anon`
-- TRUNCATE and REFERENCES, and TRUNCATE is outside row-level security entirely).
--
-- ── WHAT THIS IS ────────────────────────────────────────────────────────────────────────────
-- The customer record takes the shape QuickBooks, iPhone Contacts, Outlook and Salesforce all
-- already use: ONE IDENTITY, REPEATING TYPED PROPERTIES. Phones are a list. Emails are a list.
-- Addresses are a list. Each entry carries a label and one of each kind is primary.
--
-- David, 2026-09-15: *"THE IMPORT TAKES EVERYTHING. Every QuickBooks phone becomes a phone with
-- its label. Every address becomes an address. Nothing is chosen between and nothing is dropped."*
--
-- 🔴 WHY THE SHAPE, AND IT IS NOT VOLUME — MEASURED ON THE COMPLETE 2026-09-10 CAPTURE
-- (1,959 of 1,959, `complete: true`), DRIVEN THROUGH THE SHIPPED `classifyValueShape`:
--     · 22 records would hold MORE THAN ONE phone (21 two, 1 three). Not 704.
--       Of the 704 `Mobile` numbers, 651 are the SAME number as `PrimaryPhone` and 38 are
--       Mobile-with-no-Primary, which `heldPhoneOf` ALREADY falls back to. 15 carry new information.
--     · 11 records hold a genuine SECOND address; 3 get their ONLY street from `ShipAddr`.
--       725 of 736 resolved ship streets are IDENTICAL to the billing street.
--     · 0 records hold two email FIELDS — QuickBooks' Customer entity has exactly one.
--     · 9 phone numbers are buried in address lines and held NOWHERE else.
--
-- ⚠️ SO THE CASE IS NOT VOLUME AND THIS MIGRATION SAYS SO RATHER THAN OVERSTATING IT. The case is
-- that the OLD SHAPE FORCES A LOSS. `qboCustomerAdapter`'s `phone-would-be-lost` branch existed for
-- exactly 5 records where recovering a street meant discarding a phone number held nowhere else —
-- a collision that exists ONLY because `customers` has ONE phone column. Under a list there is
-- nothing to choose between, so the branch and the ruling it owed both disappear.
--
-- ── D-41: THE MECHANISM IS SUPERSEDED, THE INVARIANT IS NOT ─────────────────────────────────
-- D-41 (2026-07-16) ruled: *"Billing address = COLUMNS on customers (one, stable)."* David
-- superseded THAT CLAUSE on 2026-09-15 — the list is the truth and the columns derive from it.
--
-- 🔴 D-41's OTHER CLAUSE IS UNTOUCHED AND IS THE LOAD-BEARING ONE:
--       THE ORDER STILL SNAPSHOTS THE CHOSEN ADDRESS ONTO THE DELIVERY ROW.
-- `deliveries` keeps its own `address_line1/city/state/zip`. This table is NEVER a foreign key the
-- delivery resolves at read time. If a contractor edits "Job site A" tomorrow, last month's invoice
-- must still show where the load ACTUALLY went. Still NO `shipping_*` column on `customers`.
-- `customerAddresses.test.ts` §E proves it by ACT, and this migration does not weaken it.
--
-- ── THE FLAT COLUMNS SURVIVE AS A DERIVED VIEW, AND A TRIGGER IS WHY ────────────────────────
-- `customers.phone` / `.email` / `.billing_*` keep working because §4's trigger recomputes them
-- from the lists. They are REAL columns, not a view, because they are MATCH KEYS: `customerUpsert`
-- does `.eq('email', …)` and `normalizeMatchKey(billing_line1)`, and the QuickBooks push reads
-- `customer.email` for the D-47 three-way rule that fixed nine cross-billed invoices (#53).
--
-- 🔴 A TRIGGER, NOT AN APPLICATION-LEVEL MIRROR, AND THE REPO PROVES WHY. The existing `billing_*`
-- mirror is app-level and is ALREADY DUPLICATED: `customerFieldRegistry.ts:130` holds
-- `CUSTOMER_BILLING_MIRROR` and `customerUpsert.ts:154` holds its own inverted copy called
-- `CANONICAL`. Two hand-maintained copies of one fact (STD-011), across four independent writers.
-- A fifth representation maintained the same way would repeat it. R-116: derive it so the link is
-- STRUCTURALLY INCAPABLE of drifting.
--
-- ── WHAT THIS MIGRATION DOES NOT DO ─────────────────────────────────────────────────────────
--   · It DROPS NOTHING. The legacy four (`address_line1`/`city`/`state`/`zip`) fall in the
--     REPOINT migration, after every reader moves. This one is purely additive.
--   · It BACKFILLS NOTHING FROM DELIVERY HISTORY. See §6 — `20260911b` §4 stands, re-scoped.
--   · It MINTS NO PERMISSION STRING. See §3.
--   · It adds NO column to `deliveries`.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 THE TWO NEW LISTS ────────────────────────────────────────────────────────────────────
-- AC-1: no vertical noun. A phone is a property of a party, not a Cultivar concept.
--
-- ⚠️ `ON DELETE CASCADE` on customer_id, DELIBERATELY UNLIKE `customer_addresses`, which is
-- RESTRICT (R-104). The difference is what the row MEANS: a saved ADDRESS may appear on a past
-- delivery and must stay resolvable, so deleting a customer who has one must ERROR. A phone number
-- is a property OF the customer and nothing else references it — when the customer goes, it goes.
CREATE TABLE IF NOT EXISTS public.customer_phones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id  uuid NOT NULL REFERENCES public.customers(id)  ON DELETE CASCADE,
  -- WHAT KIND of number it is, in the reader's words. vCard's TEL;TYPE=.
  label        text NOT NULL DEFAULT 'main',
  -- The number AS WRITTEN. Never reformatted — what the owner typed is what prints on the invoice.
  value        text NOT NULL,
  -- 🔴 DIGITS ONLY, and it is the load-bearing column. Dedup and every match key need a
  -- normalised form, and normalising at READ time cannot be indexed. Written by §5's trigger,
  -- never by hand — a normalisation maintained in two places is the defect this build is fixing.
  value_norm   text,
  is_primary   boolean NOT NULL DEFAULT false,
  -- WHERE IT CAME FROM, kept distinct from `label`. `label` is what kind of number it is;
  -- `source` is how it reached us — 'quickbooks:PrimaryPhone', 'quickbooks:BillAddr.Line1',
  -- 'manual', 'checkout'. Conflating them would make provenance unreadable the moment an owner
  -- relabels an imported number, which they will.
  source       text,
  -- R-133: *"you can't delete, you can just mark deleted."*
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_emails (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id  uuid NOT NULL REFERENCES public.customers(id)  ON DELETE CASCADE,
  label        text NOT NULL DEFAULT 'main',
  value        text NOT NULL,
  -- Lower-cased and trimmed. The local part of an address is case-SENSITIVE per RFC 5321, but no
  -- mail system anyone bills has ever relied on that, and `customerUpsert` already dedups on a
  -- raw `.eq('email', …)` — so normalising here makes an existing match key MORE correct, not less.
  value_norm   text,
  is_primary   boolean NOT NULL DEFAULT false,
  source       text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customer_phones IS
  'The contact record''s phone list (ledger #335). One row per number, labelled, one primary. '
  'customers.phone is a DERIVED view of the primary — see the sync trigger. The list is the truth.';
COMMENT ON TABLE public.customer_emails IS
  'The contact record''s email list (ledger #335). One row per address, labelled, one primary. '
  'customers.email is a DERIVED view of the primary and remains a dedup match key.';
COMMENT ON COLUMN public.customer_phones.value_norm IS
  'Digits only, written by the sync trigger. The dedup and match key — normalising at read time '
  'cannot be indexed. Never written by application code.';
COMMENT ON COLUMN public.customer_phones.source IS
  'Provenance, distinct from `label`: quickbooks:PrimaryPhone, quickbooks:BillAddr.Line1, manual, '
  'checkout. Survives an owner relabelling the number.';

-- ── §2 `customer_addresses` GAINS `kind` AND `source` ───────────────────────────────────────
-- 🔴 APPENDED, NOT EDITED. `20260911b` was APPLIED 2026-09-12 and catalog-verified (ledger #312),
-- so §6 r1 forbids touching it. Its `is_default`, `label` and `active` are REUSED as they stand —
-- renaming `is_default` to `is_primary` for symmetry with the two new tables would be a cosmetic
-- change to an applied table that breaks `customerAddresses.ts`, its board and its 195 assertions.
-- Two names for one idea is a cost; a rename here is a bigger one.
ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS kind   text NOT NULL DEFAULT 'shipping';
ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS source text;

-- The vocabulary, NAMED rather than inline. Tech-debt #91: an inline CHECK is auto-named by
-- Postgres, so the name is never typed and a name-grep can never find it — ~129 in this corpus
-- share that property. This one can be found, read and dropped by name.
ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_kind_check;
ALTER TABLE public.customer_addresses ADD CONSTRAINT customer_addresses_kind_check
  CHECK (kind IN ('billing', 'shipping', 'both'));

COMMENT ON COLUMN public.customer_addresses.kind IS
  'billing | shipping | both. The customer''s BILLING address now lives here as kind IN '
  '(billing,both) and customers.billing_* is DERIVED from it (ledger #335, superseding D-41''s '
  'column mechanism). D-41''s invariant is untouched: the ORDER still snapshots onto the delivery.';

-- ⚠️ DEFAULT 'shipping' IS CORRECT FOR EVERY EXISTING ROW BECAUSE THERE ARE NONE. The table is
-- empty — 0 rows, catalog-verified 2026-09-12 (board CARD 3) — so this default colours no history.
-- It is the right default going forward too: `customerAddresses.ts` and `<ShipToPicker>` write
-- ship-to sites, and they are unchanged by this migration.

-- ── §3 RLS — THE 2026-09-11 SHAPE, AND NO NEW STRING ────────────────────────────────────────
-- 🔴 REUSE `customers:*`. DO NOT MINT `phones:*` / `emails:*`. Both reasons are standing:
--   (a) The 2026-07-31 ruling — *a permission gates a CAPABILITY, not a field* (tech-debt #84).
--       A phone number is a field of the customer relationship, not a capability of its own.
--   (b) R-22: a manifest flip alone changes nothing — a new string needs a funnel
--       re-materialisation before any live member holds it, so new strings would ship two tables
--       NOBODY could read on day one. `customers:read` is already held by every LAWNS member
--       including STAFF (`STAFF_DEFAULT_BUNDLE` — "customers:read // where to deliver").
-- This is the same argument `20260911b` §2 made for `customer_addresses`, and it is quoted rather
-- than referenced because the next reader should not have to open that file to check it.
--
-- 🔴 NO RAW `owner_id` POLICY. `20260910b` repointed 49 → 12 (R-119); these are not the 50th and
-- 51st. The owner reaches these tables as an active member holding the string — R-22's authority.
--
-- ⚠️ NO DELETE POLICY, DELIBERATELY. Retiring a number is an UPDATE of `active` (R-133), so DELETE
-- is unreachable for every member — fail-closed, and it is the STATE we want, not an omission.
-- (The FK is CASCADE, which is a different path: the database removing a child when its parent
-- goes, not a member deleting a row.)
ALTER TABLE public.customer_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_phones_member_select ON public.customer_phones;
CREATE POLICY customer_phones_member_select ON public.customer_phones FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:read'));

DROP POLICY IF EXISTS customer_phones_member_insert ON public.customer_phones;
CREATE POLICY customer_phones_member_insert ON public.customer_phones FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:create'));

DROP POLICY IF EXISTS customer_phones_member_update ON public.customer_phones;
CREATE POLICY customer_phones_member_update ON public.customer_phones FOR UPDATE TO authenticated
  USING      (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:update'));

DROP POLICY IF EXISTS customer_emails_member_select ON public.customer_emails;
CREATE POLICY customer_emails_member_select ON public.customer_emails FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:read'));

DROP POLICY IF EXISTS customer_emails_member_insert ON public.customer_emails;
CREATE POLICY customer_emails_member_insert ON public.customer_emails FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:create'));

DROP POLICY IF EXISTS customer_emails_member_update ON public.customer_emails;
CREATE POLICY customer_emails_member_update ON public.customer_emails FOR UPDATE TO authenticated
  USING      (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:update'));

-- ── §4 INDEXES ──────────────────────────────────────────────────────────────────────────────
-- The read every consumer performs: every active entry for one customer.
CREATE INDEX IF NOT EXISTS customer_phones_customer_idx
  ON public.customer_phones (business_id, customer_id) WHERE active;
CREATE INDEX IF NOT EXISTS customer_emails_customer_idx
  ON public.customer_emails (business_id, customer_id) WHERE active;

-- 🔴 AT MOST ONE PRIMARY PER CUSTOMER, ENFORCED BY THE DATABASE RATHER THAN BY A CONVENTION.
CREATE UNIQUE INDEX IF NOT EXISTS customer_phones_one_primary
  ON public.customer_phones (business_id, customer_id) WHERE is_primary AND active;
CREATE UNIQUE INDEX IF NOT EXISTS customer_emails_one_primary
  ON public.customer_emails (business_id, customer_id) WHERE is_primary AND active;

-- 🔴 ONE ENTRY PER NORMALISED VALUE PER CUSTOMER. This is what makes "the import takes everything"
-- safe to run twice: re-importing a record cannot mint a second copy of the same number. It is
-- keyed on `value_norm`, not `value`, so `(512) 456-3632` and `512-456-3632` are ONE number.
CREATE UNIQUE INDEX IF NOT EXISTS customer_phones_one_per_value
  ON public.customer_phones (business_id, customer_id, value_norm) WHERE active AND value_norm IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customer_emails_one_per_value
  ON public.customer_emails (business_id, customer_id, value_norm) WHERE active AND value_norm IS NOT NULL;

-- ⚠️ THESE SIX PARTIAL INDEXES LAND CLEANLY, AND IT IS NOT LUCK — IT IS THE ONE MOMENT IT IS TRUE.
-- Tech-debt #54, #58, #143 and #183 are all the same blocked shape: *the durable fix is a partial
-- unique index and it cannot land until the live rows are known clean.* Here both tables are
-- created in this transaction and `customer_addresses` is empty, so no row can refuse an index.
-- That is the argument for writing all six NOW rather than after the first import.

-- ── §5 🔴 THE DERIVATION — ONE TRIGGER, AND THE FLAT COLUMNS CANNOT DRIFT FROM THE LIST ──────
-- `value_norm` is written HERE, never by application code, so the normalisation has exactly one
-- home. `regexp_replace(value, '\D', '', 'g')` for a phone; `lower(trim(value))` for an email.
CREATE OR REPLACE FUNCTION public.normalize_contact_value() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'customer_phones' THEN
    NEW.value_norm := NULLIF(regexp_replace(COALESCE(NEW.value, ''), '\D', '', 'g'), '');
  ELSE
    NEW.value_norm := NULLIF(lower(trim(COALESCE(NEW.value, ''))), '');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_phones_normalize ON public.customer_phones;
CREATE TRIGGER trg_customer_phones_normalize
  BEFORE INSERT OR UPDATE ON public.customer_phones
  FOR EACH ROW EXECUTE FUNCTION public.normalize_contact_value();

DROP TRIGGER IF EXISTS trg_customer_emails_normalize ON public.customer_emails;
CREATE TRIGGER trg_customer_emails_normalize
  BEFORE INSERT OR UPDATE ON public.customer_emails
  FOR EACH ROW EXECUTE FUNCTION public.normalize_contact_value();

-- 🔴 THE FLAT COLUMNS, RECOMPUTED FROM THE LIST ON EVERY CHANGE.
--
-- ⚠️ THE RESOLUTION IS `primary, ELSE OLDEST ACTIVE` AND THE FALLBACK IS THE HALF THAT MATTERS.
-- The unique index guarantees AT MOST one primary; nothing guarantees AT LEAST one. Retiring the
-- primary while other numbers remain would, on a bare `WHERE is_primary` read, blank
-- `customers.phone` while the customer plainly still has a phone — a derived column reporting
-- ABSENT for a record that is present, which is D-9 inverted and exactly the class of defect this
-- build exists to remove. `ORDER BY is_primary DESC, created_at ASC` is total: a list with any
-- active row always derives a value, and it is deterministic.
CREATE OR REPLACE FUNCTION public.sync_customer_flat_contact(p_customer_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_phone text; v_email text;
  v_line1 text; v_city text; v_state text; v_zip text;
BEGIN
  SELECT value INTO v_phone FROM public.customer_phones
   WHERE customer_id = p_customer_id AND active
   ORDER BY is_primary DESC, created_at ASC, id ASC LIMIT 1;

  SELECT value INTO v_email FROM public.customer_emails
   WHERE customer_id = p_customer_id AND active
   ORDER BY is_primary DESC, created_at ASC, id ASC LIMIT 1;

  -- The BILLING address only. A shipping-only site must never become the customer's billing
  -- address — that is the D-41 redline arriving through a new door, and `kind` is what holds it.
  SELECT line1, city, state, zip INTO v_line1, v_city, v_state, v_zip
    FROM public.customer_addresses
   WHERE customer_id = p_customer_id AND active AND kind IN ('billing', 'both')
   ORDER BY is_default DESC, created_at ASC, id ASC LIMIT 1;

  UPDATE public.customers
     SET phone         = v_phone,
         email         = v_email,
         billing_line1 = v_line1,
         billing_city  = v_city,
         billing_state = v_state,
         billing_zip   = v_zip
   WHERE id = p_customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_customer_flat_contact() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- On UPDATE the customer_id could in principle move; sync both sides rather than assume it did not.
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_customer_flat_contact(OLD.customer_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_customer_flat_contact(NEW.customer_id);
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    PERFORM public.sync_customer_flat_contact(OLD.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

-- AFTER, and STATEMENT-SAFE per row: the flat column must reflect the list as it now stands,
-- which is only knowable once the row has landed.
DROP TRIGGER IF EXISTS trg_customer_phones_sync ON public.customer_phones;
CREATE TRIGGER trg_customer_phones_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_phones
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_customer_flat_contact();

DROP TRIGGER IF EXISTS trg_customer_emails_sync ON public.customer_emails;
CREATE TRIGGER trg_customer_emails_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_emails
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_customer_flat_contact();

DROP TRIGGER IF EXISTS trg_customer_addresses_sync ON public.customer_addresses;
CREATE TRIGGER trg_customer_addresses_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_customer_flat_contact();

-- ⚠️ NO RECURSION: these triggers write `customers`, and no trigger on `customers` writes back to
-- any list. `customers`' own `set_updated_at_generic` fires and stops there.

-- ── §6 🔴 NO BACKFILL FROM DELIVERY HISTORY — `20260911b` §4 STANDS, RE-SCOPED RATHER THAN LIFTED
-- `20260911b` §4 refused to seed `customer_addresses` because *"AGAVE LD LLC's four spellings of
-- one yard would become four curated sites and the drift would be made permanent."* That reasoning
-- is CORRECT and this migration does not touch it: nothing here seeds any table, and
-- `customerAddresses.test.ts` §F still fails the build the day a migration does.
--
-- 🔴 WHAT CHANGED IS THE SCOPE OF THE OBJECTION, MEASURED AGAINST THE CAPTURE RATHER THAN ASSUMED.
-- AGAVE's four spellings came from EIGHTEEN INVOICES. In the customer capture AGAVE LD LLC is ONE
-- record with ONE address — `501 County Road 107`, Georgetown — its BillAddr and ShipAddr identical:
--     Id 45 | AGAVE LD LLC
--       Bill: ["501 County Road 107", "(737) 348-9534", "Georgetown"]
--       Ship: ["501 County Road 107", "(737) 348-9534", "Georgetown"]
-- A QuickBooks Customer HAS NO ADDRESS LIST. It can contribute AT MOST TWO address blocks, both
-- curated in QuickBooks' own customer record. The failure mode §4 names cannot occur through the
-- customer-import door — it is a DELIVERY-HISTORY hazard, and seeding from delivery history stays
-- forbidden. The import writes what the customer record actually holds, per record, shape-ruled.
--
-- ⚠️ AND BECAUSE THE IMPORTER WRITES THROUGH THE CLIENT, §F COULD NOT SEE IT EITHER WAY — a corpus
-- probe reads `.sql` files, not `db.from(...)`. §F would have gone on asserting "nothing seeds this
-- table" while something populated it on every run: TRUE, and MISLEADING, which is worse than red.
-- `contactRecord.test.ts` §G widens it — the writers of all three tables are an ENUMERATED set,
-- asserted by driving each against a recording client, so a fifth writer fails the build.

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — run AFTER applying. Read-only. Paste ONE statement at a time: the SQL editor shows
-- only the LAST result set, and it opens a FRESH CONNECTION per run (so no temp tables).
-- ⚠️ NOT `SET LOCAL role authenticated` — that form has never worked here and FAILED on first use
-- with `permission denied to set role` (tech-debt #240). Setting the claims GUC alone is proven.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- V1 · both tables exist with the columns this build expects.
-- SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name IN ('customer_phones','customer_emails')
--  ORDER BY table_name, ordinal_position;

-- V2 · `customer_addresses` gained `kind` and `source`, and `kind` carries its NAMED check.
-- SELECT column_name, column_default, is_nullable FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='customer_addresses' AND column_name IN ('kind','source');
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.customer_addresses'::regclass AND conname = 'customer_addresses_kind_check';

-- V3 · RLS is ON and each new table has exactly three policies naming `customers:*`. A row whose
-- `qual` mentions `owner_id` would mean a raw owner policy got in after all.
-- SELECT c.relrowsecurity AS rls_enabled, p.tablename, p.policyname, p.cmd, p.qual, p.with_check
--   FROM pg_policies p JOIN pg_class c ON c.relname = p.tablename
--  WHERE p.schemaname='public' AND p.tablename IN ('customer_phones','customer_emails')
--  ORDER BY p.tablename, p.policyname;

-- V4 · the six indexes are present and PARTIAL (a `WHERE` must appear in each definition).
-- SELECT tablename, indexname, indexdef FROM pg_indexes
--  WHERE schemaname='public' AND tablename IN ('customer_phones','customer_emails')
--  ORDER BY tablename, indexname;

-- V5 · BOTH LISTS ARE EMPTY and the address book still is. §6's claim, checkable.
-- SELECT 'phones' AS list, count(*) FROM public.customer_phones
--  UNION ALL SELECT 'emails', count(*) FROM public.customer_emails
--  UNION ALL SELECT 'addresses', count(*) FROM public.customer_addresses;

-- V6 · 🔴 THE TRIGGER ACTUALLY DERIVES — the one V that proves the mechanism rather than its
-- presence. Run it whole; it rolls itself back and writes nothing.
-- BEGIN;
--   INSERT INTO public.customer_phones (business_id, customer_id, label, value, is_primary, source)
--   SELECT business_id, id, 'mobile', '(512) 555-0142', true, 'v-block'
--     FROM public.customers ORDER BY created_at LIMIT 1;
--   SELECT c.id, c.phone AS derived_flat_column, p.value AS list_value, p.value_norm
--     FROM public.customers c JOIN public.customer_phones p ON p.customer_id = c.id
--    WHERE p.source = 'v-block';
--   -- EXPECT: derived_flat_column = '(512) 555-0142'  ·  value_norm = '5125550142'
-- ROLLBACK;

-- V7 · `customers` gained NO shipping_* column and `deliveries` gained nothing. D-41's surviving
-- redline, asserted rather than assumed. Expect ZERO rows.
-- SELECT table_name, column_name FROM information_schema.columns
--  WHERE table_schema='public'
--    AND (column_name LIKE 'shipping%' OR (table_name='deliveries' AND column_name='address_line2'));

-- V8 · the legacy four are STILL PRESENT after this migration. They drop in the REPOINT migration,
-- not this one — this V exists so an interrupted apply is distinguishable from a completed one.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='customers'
--    AND column_name IN ('address_line1','city','state','zip') ORDER BY column_name;
