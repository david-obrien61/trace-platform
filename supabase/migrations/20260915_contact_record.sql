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
--     ⚠️ It DOES seed the three contact lists from `customers`' own flat columns (§5b) — one
--     existing value per customer, column to row. That is the MOVE this migration is named for,
--     not a backfill: without it the derivation it installs has nothing to derive from and blanks
--     every customer's address, phone and email on the first list write.
--   · It MINTS NO PERMISSION STRING. See §3.
--   · It adds NO column to `deliveries`.
--
-- ── ADDED 2026-09-16 (David's Step-4 rulings) ───────────────────────────────────────────────
--   · §5b CLASSIFIES as it seeds: a phone sitting in a street field goes to the phone list (with
--     any words beside it as a `note`), never to the address list; a split email field becomes one
--     row per address. §5c refuses unless every existing value is in a list afterwards.
--   · §5d recomputes every customer's flat fields once, so they say what the lists say.
--   · §5e GUARD: a direct INSERT/UPDATE of `customers.phone`, `email` or `billing_*` is REFUSED.
--     Every writer goes through the lists (`contactWriter`); a missed one fails loudly instead of
--     having its value silently overwritten by the next list write.
--   · The derivation is SECURITY DEFINER, and checks the list row's business owns the customer.
--   · 🔴 APPLY ONLY TOGETHER WITH THE CODE THAT WRITES THROUGH THE LISTS (feat/contact-record).
--     Code still writing `customers.phone` directly will have those writes refused.
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
  -- Words that sat beside the number in the same field ("cell", "gate 1234"). The seed and the
  -- import keep them here rather than dropping them (David, 2026-09-16: *"never lost"*).
  note         text,
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

-- ── §5b 🔴 THE MOVE ITSELF — THE FLAT VALUES ARE SEEDED INTO THE LISTS THEY DERIVE FROM ──────
-- 🔴 WITHOUT THIS BLOCK THE MIGRATION DELETES EVERY CUSTOMER'S CONTACT DETAILS ON THE FIRST LIST
-- WRITE, AND DOES IT SILENTLY. `sync_customer_flat_contact` below recomputes ALL SIX flat fields
-- from the three lists. `customer_addresses` holds ZERO rows (catalog-verified 2026-09-12, §2's own
-- comment says so) and the two list tables are created EMPTY in this transaction — so for every
-- customer the derivation resolves to NULL. The first phone the import writes therefore does not
-- "fill in a phone": it fires the sync, which blanks that customer's address AND email in the same
-- statement. The import writes phones and emails for every record it touches. The blast radius is
-- not the 20 rows CARD 1 lists, it is EVERY CUSTOMER ROW.
--
-- 🔴 AND THIS IS NOT `20260911b` §4's REFUSAL BEING LIFTED. §4 refused to backfill from DELIVERY
-- HISTORY, because AGAVE LD LLC's four spellings of one yard across eighteen invoices would become
-- four curated sites and the drift would be made permanent. §6 below already draws the distinction
-- and already states the conclusion — *"the failure mode §4 names cannot occur through the
-- customer-import door … seeding from delivery history stays forbidden"* — it simply never applied
-- it to this migration. What moves here is ONE EXISTING VALUE PER CUSTOMER, already the
-- authoritative one, already chosen, travelling from a COLUMN to a ROW. There is no second
-- spelling to choose between, no invoice to read, and no judgement being made. **A migration that
-- moves an address into a list must move the address into the list.**
--
-- ⚠️ SCOPE BEYOND THE ADDRESS, AND IT IS DELIBERATE: phones and emails carry the IDENTICAL hole —
-- `customers.phone` and `customers.email` are derived by the same function from two tables created
-- empty one screen above. Seeding only the address would leave the sync blanking phone and email
-- instead, which is the same defect with a different column name. The three INSERTs are written
-- separately so any one can be struck on its own.
--
-- ⚠️ PLACEMENT IS LOAD-BEARING — AFTER the normalize triggers, BEFORE the sync trigger:
--   · AFTER normalize, so `value_norm` is written by its one owner (§5) rather than by this block.
--     Seeded above it, every row would carry a NULL `value_norm`, and the partial unique index that
--     makes the import idempotent (`WHERE value_norm IS NOT NULL`) would not cover a single row.
--   · BEFORE sync, so no seeded row fires a recompute. Seeded after it, the first INSERT of the
--     three would blank the two fields the other two INSERTs had not reached yet — correct by the
--     end of the transaction, but only by accident of ordering, and unreadable to the next person.
-- When the trigger is created below, the lists and the flat columns ALREADY agree, so nothing has
-- to run to make them agree.
--
-- ⚠️ IDEMPOTENT by the `NOT EXISTS` guard, matching CARD 2's promise that a second run is a no-op.
-- It is not `ON CONFLICT`: the unique indexes here are PARTIAL, so inference needs their predicate
-- restated, and a guard that reads in English is worth more than one that reads in index syntax.

-- ── §5b.1 🔴 THE SEED CLASSIFIES — DAVID'S RULING, 2026-09-16 ────────────────────────────────
-- On LAWNS 465 billing "streets" are phone numbers and 10 more are a phone with words beside it
-- (measured on the 2026-09-16 snapshot with the #331 classifier). Copying them into the address
-- list as streets would give 475 customers an address that cannot go on a truck. So:
--   · a billing street that is PHONE-BEARING is seeded into the PHONE list — non-primary when the
--     customer already has a primary — and NOT into the address list. Words beside the number
--     are kept as that phone's `note`, never lost. Duplicates of a number already held collapse.
--   · the first remaining street is line 1, the next line 2. The legacy `address_line1` is used
--     only when no billing street survives (the snapshot holds no other real street: the 15
--     "streets" in `city` are town names like "Cedar Park", which the classifier reads as a street
--     because of the word "park" — they are NOT used).
--   · city/state/ZIP are seeded even when the street moved away, so no customer loses their town.
--   · an email field holding several addresses becomes one row each.
-- 🔴 THE RULE IS `contactRecordFromFlat` IN `contactRecord.ts`, MIRRORED HERE. The functions below
-- are `classifyValueShape` / `phonesInText` / `splitEmails` in SQL, and the contact-seed harness
-- runs this file on the LAWNS snapshot and asserts the rows equal the TypeScript rule's rows for
-- every customer. They live in `pg_temp`, so they vanish with the session and leave no second copy
-- of the rule in the schema (STD-011).

CREATE OR REPLACE FUNCTION pg_temp.clean_text(raw text) RETURNS text
LANGUAGE sql IMMUTABLE AS $f$
  SELECT NULLIF(regexp_replace(raw, '^\s+|\s+$', '', 'g'), '')
$f$;

-- `classifyValueShape` (importFieldAudit.ts), line for line.
CREATE OR REPLACE FUNCTION pg_temp.contact_shape(raw text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE v text; at_pos int; has_letter boolean; digits text;
BEGIN
  v := pg_temp.clean_text(raw);
  IF v IS NULL THEN RETURN 'other'; END IF;
  at_pos := position('@' in v);
  IF at_pos > 1 AND at_pos < length(v) AND v !~ '\s' AND position('.' in substr(v, at_pos + 1)) > 0 THEN
    RETURN 'email';
  END IF;
  has_letter := v ~ '[A-Za-z]';
  digits := regexp_replace(v, '\D', '', 'g');
  IF NOT has_letter AND (length(digits) = 10 OR (length(digits) = 11 AND left(digits, 1) = '1')) THEN
    RETURN 'phone';
  END IF;
  IF NOT has_letter AND (v ~ '^\d{5}$' OR v ~ '^\d{5}-\d{4}$') THEN RETURN 'postcode'; END IF;
  IF has_letter THEN
    IF v ~ '^\d+[A-Za-z]?\s+\S*[A-Za-z]' THEN RETURN 'street'; END IF;
    IF v ~* '\y(st|street|rd|road|dr|drive|ln|lane|ave|avenue|blvd|boulevard|hwy|highway|ct|court|cir|circle|way|trl|trail|pkwy|parkway|ste|suite|apt|unit|box|loop|cove|cv|pass|path|bend|ridge|creek|park|plaza|terrace|ter|place|pl|county|cr|fm|rr)\y' THEN
      RETURN 'street';
    END IF;
    IF v !~ '\d' THEN RETURN 'wordlike'; END IF;
  END IF;
  RETURN 'other';
END
$f$;

-- `phonesInText` (contactRecord.ts). No rows = not phone-bearing.
CREATE OR REPLACE FUNCTION pg_temp.phones_in_text(raw text)
RETURNS TABLE (ord int, phone text, note text)
LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE v text; shape text; rest text; m text; i int := 0;
  pat constant text := '(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}';
BEGIN
  v := pg_temp.clean_text(raw);
  IF v IS NULL THEN RETURN; END IF;
  shape := pg_temp.contact_shape(v);
  IF shape = 'phone' THEN ord := 1; phone := v; note := NULL; RETURN NEXT; RETURN; END IF;
  IF shape = 'street' THEN RETURN; END IF;
  rest := regexp_replace(v, pat, ' ', 'g');
  rest := regexp_replace(rest, '\s+', ' ', 'g');
  rest := NULLIF(regexp_replace(rest, '^[\s–—/,;:()-]+|[\s–—/,;:()-]+$', '', 'g'), '');
  FOR m IN SELECT x[1] FROM regexp_matches(v, '(' || pat || ')', 'g') AS x LOOP
    IF pg_temp.contact_shape(m) = 'phone' THEN
      i := i + 1; ord := i; phone := m; note := rest; RETURN NEXT;
    END IF;
  END LOOP;
END
$f$;

-- `splitEmails` (contactRecord.ts).
CREATE OR REPLACE FUNCTION pg_temp.split_emails(raw text)
RETURNS TABLE (ord int, email text)
LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE v text; parts text[]; seen text[] := '{}'; p text; i int := 0;
BEGIN
  v := pg_temp.clean_text(raw);
  IF v IS NULL THEN RETURN; END IF;
  SELECT coalesce(array_agg(t ORDER BY n), '{}') INTO parts
    FROM regexp_split_to_table(v, '[;,]|\s+') WITH ORDINALITY AS x(t, n) WHERE t <> '';
  IF NOT (cardinality(parts) >= 2 AND NOT EXISTS (SELECT 1 FROM unnest(parts) q WHERE position('@' in q) = 0)) THEN
    parts := ARRAY[v];
  END IF;
  FOREACH p IN ARRAY parts LOOP
    IF lower(p) = ANY (seen) THEN CONTINUE; END IF;
    seen := seen || lower(p);
    i := i + 1; ord := i; email := p; RETURN NEXT;
  END LOOP;
END
$f$;

-- `contactRecordFromFlat`, phone half.
CREATE OR REPLACE FUNCTION pg_temp.seed_phones(p_phone text, l1 text, l2 text, legacy text)
RETURNS TABLE (ord int, label text, value text, note text, source text)
LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE seen text[] := '{}'; n int := 0; d text; r record; q record;
BEGIN
  IF pg_temp.clean_text(p_phone) IS NOT NULL THEN
    n := 1; seen := seen || regexp_replace(pg_temp.clean_text(p_phone), '\D', '', 'g');
    ord := 1; label := 'main'; value := pg_temp.clean_text(p_phone); note := NULL;
    source := 'migrated:customers.phone'; RETURN NEXT;
  END IF;
  FOR r IN SELECT * FROM (VALUES (1, 'billing_line1', l1), (2, 'billing_line2', l2), (3, 'address_line1', legacy)) t(k, col, val) ORDER BY k LOOP
    FOR q IN SELECT * FROM pg_temp.phones_in_text(r.val) ORDER BY 1 LOOP
      d := regexp_replace(q.phone, '\D', '', 'g');
      IF d = ANY (seen) THEN CONTINUE; END IF;
      seen := seen || d; n := n + 1;
      ord := n; label := 'other'; value := q.phone; note := q.note;
      source := 'migrated:customers.' || r.col; RETURN NEXT;
    END LOOP;
  END LOOP;
END
$f$;

-- `contactRecordFromFlat`, address half. No row when there is nothing to hold.
CREATE OR REPLACE FUNCTION pg_temp.seed_address(l1 text, l2 text, legacy text, p_city text, p_state text, p_zip text)
RETURNS TABLE (line1 text, line2 text, city text, state text, zip text)
LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE streets text[] := '{}'; c text;
BEGIN
  FOREACH c IN ARRAY ARRAY[pg_temp.clean_text(l1), pg_temp.clean_text(l2)] LOOP
    IF c IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_temp.phones_in_text(c))
       AND NOT (lower(c) = ANY (SELECT lower(x) FROM unnest(streets) x)) THEN
      streets := streets || c;
    END IF;
  END LOOP;
  IF cardinality(streets) = 0 THEN
    c := pg_temp.clean_text(legacy);
    IF c IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_temp.phones_in_text(c)) THEN streets := ARRAY[c]; END IF;
  END IF;
  line1 := streets[1]; line2 := streets[2];
  city := pg_temp.clean_text(p_city); state := pg_temp.clean_text(p_state); zip := pg_temp.clean_text(p_zip);
  IF line1 IS NULL AND line2 IS NULL AND city IS NULL AND state IS NULL AND zip IS NULL THEN RETURN; END IF;
  RETURN NEXT;
END
$f$;

-- ── §5b.2 THE THREE SEEDS — each reads FROM public.customers and nothing else ────────────────
-- 🔴 ON A RE-RUN THE DERIVATION TRIGGERS ALREADY EXIST (created further down, on the first run), and
-- each seeded row would recompute its customer MID-SEED — blanking the phone and email the next seed
-- statement still has to read. Measured: a restore followed by a re-run seeded 800 phones of 1,513.
-- So they are switched off for the seed; the DROP/CREATE below re-creates them, enabled.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customer_phones_sync') THEN
    ALTER TABLE public.customer_phones DISABLE TRIGGER trg_customer_phones_sync;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customer_emails_sync') THEN
    ALTER TABLE public.customer_emails DISABLE TRIGGER trg_customer_emails_sync;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customer_addresses_sync') THEN
    ALTER TABLE public.customer_addresses DISABLE TRIGGER trg_customer_addresses_sync;
  END IF;
END $$;

-- The BILLING address: one row, kind 'billing', flagged default — which is exactly what
-- `sync_customer_flat_contact` reads back (`kind IN ('billing','both') ORDER BY is_default DESC`).
INSERT INTO public.customer_addresses
  (business_id, customer_id, label, kind, line1, line2, city, state, zip, is_default, source, active)
SELECT c.business_id, c.id, 'Billing', 'billing', s.line1, s.line2, s.city, s.state, s.zip,
       true, 'migrated:customers.billing_*', true
  FROM public.customers c
 CROSS JOIN LATERAL pg_temp.seed_address(c.billing_line1, c.billing_line2, c.address_line1,
                                         c.billing_city, c.billing_state, c.billing_zip) s
 WHERE NOT EXISTS (SELECT 1 FROM public.customer_addresses a
                    WHERE a.customer_id = c.id AND a.active);

-- The phones: the phone field as written (primary), then every number from a street field.
INSERT INTO public.customer_phones
  (business_id, customer_id, label, value, note, is_primary, source, active)
SELECT c.business_id, c.id, s.label, s.value, s.note, s.ord = 1, s.source, true
  FROM public.customers c
 CROSS JOIN LATERAL pg_temp.seed_phones(c.phone, c.billing_line1, c.billing_line2, c.address_line1) s
 WHERE NOT EXISTS (SELECT 1 FROM public.customer_phones p
                    WHERE p.customer_id = c.id AND p.active);

-- The emails, one row per address. Still a dedup match key for `customerUpsert`.
INSERT INTO public.customer_emails
  (business_id, customer_id, label, value, is_primary, source, active)
SELECT c.business_id, c.id, 'main', e.email, e.ord = 1, 'migrated:customers.email', true
  FROM public.customers c
 CROSS JOIN LATERAL pg_temp.split_emails(c.email) e
 WHERE NOT EXISTS (SELECT 1 FROM public.customer_emails m
                    WHERE m.customer_id = c.id AND m.active);

-- ── §5c PROVE THE MOVE, IN THE SAME TRANSACTION ─────────────────────────────────────────────
-- 🔴 THIS CAN FAIL, WHICH IS THE POINT (§6 r19). Every value a customer holds today must be in a
-- list afterwards, on the same customer — or the transaction refuses and nothing changes:
--   · every phone field, and every number found in a street field (by digits);
--   · every email address in the email field;
--   · every street that is not phone-bearing (as line 1 or line 2 of a billing row);
--   · every billing city / state / ZIP;
--   · and NO seeded address row whose street is phone-bearing.
DO $$
DECLARE
  n_phone int; n_email int; n_street int; n_place int; n_addr_phone int;
  n_addr int; n_street_phones int; n_split int; n_notes int;
BEGIN
  SELECT count(*) INTO n_phone FROM (
    SELECT c.id, pg_temp.clean_text(c.phone) AS v FROM public.customers c
     WHERE pg_temp.clean_text(c.phone) IS NOT NULL
    UNION ALL
    SELECT c.id, q.phone FROM public.customers c
     CROSS JOIN LATERAL (VALUES (c.billing_line1), (c.billing_line2), (c.address_line1)) l(v)
     CROSS JOIN LATERAL pg_temp.phones_in_text(l.v) q
  ) x
   WHERE NOT EXISTS (SELECT 1 FROM public.customer_phones p
                      WHERE p.customer_id = x.id AND p.active
                        AND (p.value = x.v OR p.value_norm = NULLIF(regexp_replace(x.v, '\D', '', 'g'), '')));

  SELECT count(*) INTO n_email FROM public.customers c
   CROSS JOIN LATERAL pg_temp.split_emails(c.email) e
   WHERE NOT EXISTS (SELECT 1 FROM public.customer_emails m
                      WHERE m.customer_id = c.id AND m.active AND m.value_norm = lower(e.email));

  SELECT count(*) INTO n_street FROM public.customers c
   CROSS JOIN LATERAL (VALUES (c.billing_line1), (c.billing_line2)) l(v)
   WHERE pg_temp.clean_text(l.v) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_temp.phones_in_text(l.v))
     AND NOT EXISTS (SELECT 1 FROM public.customer_addresses a
                      WHERE a.customer_id = c.id AND a.active AND a.kind IN ('billing', 'both')
                        AND lower(pg_temp.clean_text(l.v)) IN (lower(a.line1), lower(a.line2)));

  SELECT count(*) INTO n_place FROM public.customers c
   WHERE (pg_temp.clean_text(c.billing_city) IS NOT NULL OR pg_temp.clean_text(c.billing_state) IS NOT NULL
          OR pg_temp.clean_text(c.billing_zip) IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.customer_addresses a
                      WHERE a.customer_id = c.id AND a.active AND a.kind IN ('billing', 'both')
                        AND a.city  IS NOT DISTINCT FROM pg_temp.clean_text(c.billing_city)
                        AND a.state IS NOT DISTINCT FROM pg_temp.clean_text(c.billing_state)
                        AND a.zip   IS NOT DISTINCT FROM pg_temp.clean_text(c.billing_zip));

  SELECT count(*) INTO n_addr_phone FROM public.customer_addresses a
   WHERE a.source = 'migrated:customers.billing_*'
     AND (EXISTS (SELECT 1 FROM pg_temp.phones_in_text(a.line1))
       OR EXISTS (SELECT 1 FROM pg_temp.phones_in_text(a.line2)));

  IF n_phone > 0 OR n_email > 0 OR n_street > 0 OR n_place > 0 OR n_addr_phone > 0 THEN
    RAISE EXCEPTION
      'REFUSED: % customer(s) hold a billing address value (% street, % city/state/ZIP), % a phone '
      'and % an email with NO list row to derive it from, and % seeded address row(s) still hold a '
      'phone as their street. Nothing has been changed.',
      n_street + n_place, n_street, n_place, n_phone, n_email, n_addr_phone;
  END IF;

  SELECT count(*) INTO n_addr FROM public.customer_addresses WHERE source = 'migrated:customers.billing_*';
  SELECT count(*) INTO n_street_phones FROM public.customer_phones
   WHERE source IN ('migrated:customers.billing_line1', 'migrated:customers.billing_line2', 'migrated:customers.address_line1');
  SELECT count(*) INTO n_notes FROM public.customer_phones WHERE source LIKE 'migrated:%' AND note IS NOT NULL;
  SELECT count(*) INTO n_split FROM (
    SELECT customer_id FROM public.customer_emails WHERE source = 'migrated:customers.email'
     GROUP BY customer_id HAVING count(*) > 1) z;
  RAISE NOTICE 'SEEDED: % address row(s) · % phone(s) taken out of street fields (% with a note) · '
    '% customer(s) whose email field was split · 0 address rows with a phone as the street.',
    n_addr, n_street_phones, n_notes, n_split;
END $$;

-- 🔴 THE FLAT COLUMNS, RECOMPUTED FROM THE LIST ON EVERY CHANGE.
--
-- ⚠️ THE RESOLUTION IS `primary, ELSE OLDEST ACTIVE` AND THE FALLBACK IS THE HALF THAT MATTERS.
-- The unique index guarantees AT MOST one primary; nothing guarantees AT LEAST one. Retiring the
-- primary while other numbers remain would, on a bare `WHERE is_primary` read, blank
-- `customers.phone` while the customer plainly still has a phone — a derived column reporting
-- ABSENT for a record that is present, which is D-9 inverted and exactly the class of defect this
-- build exists to remove. `ORDER BY is_primary DESC, created_at ASC` is total: a list with any
-- active row always derives a value, and it is deterministic.
CREATE OR REPLACE FUNCTION public.sync_customer_flat_contact(p_customer_id uuid) RETURNS boolean
LANGUAGE plpgsql
-- 🔴 SECURITY DEFINER (2026-09-16): a derivation must not depend on who triggered it. As INVOKER the
-- UPDATE below ran under the caller's RLS, so a member allowed to add a phone but not to update
-- `customers` would write the list row while the flat column silently stayed stale. The trigger
-- that calls this checks the row's business matches the customer's first (see below).
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone text; v_email text;
  v_line1 text; v_line2 text; v_city text; v_state text; v_zip text;
  n int;
BEGIN
  SELECT value INTO v_phone FROM public.customer_phones
   WHERE customer_id = p_customer_id AND active
   ORDER BY is_primary DESC, created_at ASC, id ASC LIMIT 1;

  SELECT value INTO v_email FROM public.customer_emails
   WHERE customer_id = p_customer_id AND active
   ORDER BY is_primary DESC, created_at ASC, id ASC LIMIT 1;

  -- The BILLING address only. A shipping-only site must never become the customer's billing
  -- address — that is the D-41 redline arriving through a new door, and `kind` is what holds it.
  SELECT line1, line2, city, state, zip INTO v_line1, v_line2, v_city, v_state, v_zip
    FROM public.customer_addresses
   WHERE customer_id = p_customer_id AND active AND kind IN ('billing', 'both')
   ORDER BY is_default DESC, created_at ASC, id ASC LIMIT 1;

  -- The flag tells the guard trigger on `customers` that THIS write is the derivation. It is
  -- transaction-local and switched off again straight after, so nothing else inherits it.
  PERFORM pg_catalog.set_config('trace.contact_sync', 'on', true);
  UPDATE public.customers
     SET phone         = v_phone,
         email         = v_email,
         billing_line1 = v_line1,
         billing_line2 = v_line2,
         billing_city  = v_city,
         billing_state = v_state,
         billing_zip   = v_zip
   WHERE id = p_customer_id
     -- Only when something changed, so `updated_at` moves only for a real change.
     AND (phone IS DISTINCT FROM v_phone OR email IS DISTINCT FROM v_email
          OR billing_line1 IS DISTINCT FROM v_line1 OR billing_line2 IS DISTINCT FROM v_line2
          OR billing_city IS DISTINCT FROM v_city OR billing_state IS DISTINCT FROM v_state
          OR billing_zip IS DISTINCT FROM v_zip);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_catalog.set_config('trace.contact_sync', 'off', true);
  RETURN n > 0;
END;
$$;

-- Nobody calls the derivation directly; only the trigger below does (it runs as the owner).
REVOKE ALL ON FUNCTION public.sync_customer_flat_contact(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_sync_customer_flat_contact() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 🔴 TENANT CHECK (AC-3). The list tables' RLS checks `business_id` only, so a member could write
  -- a row carrying their OWN business_id and ANOTHER business's customer_id — and this function
  -- runs as the owner. Refuse unless the row's business owns the customer.
  IF TG_OP <> 'DELETE' AND NOT EXISTS (
       SELECT 1 FROM public.customers c WHERE c.id = NEW.customer_id AND c.business_id = NEW.business_id) THEN
    RAISE EXCEPTION 'REFUSED: this contact detail names a customer that does not belong to its business. Nothing was saved.';
  END IF;
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

-- ── §5d THE FLAT COLUMNS NOW SAY WHAT THE LISTS SAY ─────────────────────────────────────────
-- The seed changed what some customers' flat values should be: 465 billing "streets" that were a
-- phone are now empty (or the real street), 4 customers with no phone gain the one from their
-- street field, and the split email field shows its first address. Recompute every customer once.
-- A customer whose values already agree is not touched, so `updated_at` moves only where it should.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM public.customers LOOP
    IF public.sync_customer_flat_contact(r.id) THEN n := n + 1; END IF;
  END LOOP;
  RAISE NOTICE 'DERIVED: % customer row(s) now show the value their lists hold.', n;
END $$;

-- ── §5e 🔴 THE GUARD — A DIRECT WRITE TO A DERIVED FIELD FAILS LOUDLY ───────────────────────
-- David, 2026-09-16: every writer goes through the contact lists, and *"a missed writer fails
-- loudly"*. Without this, an old writer that sets `customers.phone` succeeds — and the next list
-- write for that customer recomputes the column from the list and silently throws the value away
-- (proved on PGlite: an OCR-style insert, then a ship-to save, blanked phone, email and address).
-- With it, that write is REFUSED at the moment it happens, with a sentence a person can act on.
-- The derivation above is the one permitted writer: it raises `trace.contact_sync` around its own
-- UPDATE. A PostgREST client cannot set that flag — it has no SQL, and `set_config` is not exposed.
-- ⚠️ Writing NULL on INSERT is allowed (a new customer arrives with no contact fields and the lists
-- fill them); an empty string '' is a value and is refused, so writers must OMIT absent fields.
CREATE OR REPLACE FUNCTION public.guard_customer_derived_contact() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('trace.contact_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' AND (NEW.phone IS NOT NULL OR NEW.email IS NOT NULL
        OR NEW.billing_line1 IS NOT NULL OR NEW.billing_line2 IS NOT NULL OR NEW.billing_city IS NOT NULL
        OR NEW.billing_state IS NOT NULL OR NEW.billing_zip IS NOT NULL))
  OR (TG_OP = 'UPDATE' AND (NEW.phone IS DISTINCT FROM OLD.phone OR NEW.email IS DISTINCT FROM OLD.email
        OR NEW.billing_line1 IS DISTINCT FROM OLD.billing_line1 OR NEW.billing_line2 IS DISTINCT FROM OLD.billing_line2
        OR NEW.billing_city IS DISTINCT FROM OLD.billing_city OR NEW.billing_state IS DISTINCT FROM OLD.billing_state
        OR NEW.billing_zip IS DISTINCT FROM OLD.billing_zip)) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Not saved: a customer''s phone, email and billing address are kept in their contact lists, not on the customer row. Nothing was changed.',
      HINT    = 'Write customer_phones / customer_emails / customer_addresses (contactWriter). Ledger #335.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_derived_contact_guard ON public.customers;
CREATE TRIGGER trg_customers_derived_contact_guard
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_derived_contact();

-- ── §6 🔴 NO BACKFILL FROM DELIVERY HISTORY — `20260911b` §4 STANDS, RE-SCOPED RATHER THAN LIFTED
-- `20260911b` §4 refused to seed `customer_addresses` because *"AGAVE LD LLC's four spellings of
-- one yard would become four curated sites and the drift would be made permanent."* That reasoning
-- is CORRECT and this migration does not touch it: §5b seeds the contact lists from
-- `customers`' OWN FLAT COLUMNS and from nothing else — no invoice, no delivery, no history.
--
-- ✏️ CORRECTED 2026-09-15 (David). THIS PARAGRAPH READ *"nothing here seeds any table"* AND THE
-- MIGRATION HAD NO SEED, WHICH WAS THE DEFECT — not a scope choice. The flat columns were made
-- DERIVED while the tables they derive from were left EMPTY, so the sync trigger's first firing
-- blanked every customer's address, phone and email. See §5b. The refusal §4 actually made is
-- unchanged and is now CHECKABLE rather than absolute: `customerAddresses.test.ts` §F declares the
-- one file permitted to seed and fails the build BOTH ways — an undeclared seeder, a declaration
-- that no longer seeds, or a seed whose source names delivery history.
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

-- V5 · WHAT THE SEED WROTE. Compare with the SEEDED notice the apply printed.
-- SELECT 'addresses' AS what, count(*) FROM public.customer_addresses WHERE source = 'migrated:customers.billing_*'
--  UNION ALL SELECT 'phones (phone field)', count(*) FROM public.customer_phones WHERE source = 'migrated:customers.phone'
--  UNION ALL SELECT 'phones (from a street field)', count(*) FROM public.customer_phones
--             WHERE source IN ('migrated:customers.billing_line1','migrated:customers.billing_line2','migrated:customers.address_line1')
--  UNION ALL SELECT 'phones with a note', count(*) FROM public.customer_phones WHERE note IS NOT NULL
--  UNION ALL SELECT 'emails', count(*) FROM public.customer_emails WHERE source = 'migrated:customers.email'
--  UNION ALL SELECT 'customers with a split email', count(*) FROM (SELECT customer_id FROM public.customer_emails
--             WHERE source = 'migrated:customers.email' GROUP BY customer_id HAVING count(*) > 1) z;
-- MEASURED on the LAWNS 2026-09-16 snapshot (PGlite, the real file): addresses 1,456 · phone field
-- 1,497 · from a street 16 · with a note 5 · emails 1,722 · split 1. The live numbers are those plus
-- whatever the other tenants hold (17 customers outside LAWNS on 2026-09-16), and plus any LAWNS
-- customer added after the snapshot.

-- V5b · 🔴 ZERO address rows whose street is a phone number. Expect 0.
-- SELECT count(*) FROM public.customer_addresses
--  WHERE active AND (line1 ~ '^\s*(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*$'
--                 OR line2 ~ '^\s*(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*$');

-- V5c · the guard REFUSES a direct write. Run it whole; it rolls itself back.
-- BEGIN;
--   UPDATE public.customers SET phone = '(512) 555-0199'
--    WHERE id = (SELECT id FROM public.customers ORDER BY created_at LIMIT 1);
-- ROLLBACK;
-- EXPECT: ERROR  Not saved: a customer's phone, email and billing address are kept in their contact lists …

-- V6 · 🔴 THE TRIGGER ACTUALLY DERIVES — the one V that proves the mechanism rather than its
-- presence. Run it whole; it rolls itself back and writes nothing.
-- BEGIN;
--   INSERT INTO public.customer_phones (business_id, customer_id, label, value, is_primary, source)
--   SELECT c.business_id, c.id, 'mobile', '(512) 555-0142', true, 'v-block'
--     FROM public.customers c
--    WHERE NOT EXISTS (SELECT 1 FROM public.customer_phones p WHERE p.customer_id = c.id AND p.active)
--    ORDER BY c.created_at LIMIT 1;   -- a customer with no phone yet, so the new one is the primary
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
