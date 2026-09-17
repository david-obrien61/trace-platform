-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260915b — THE LEGACY FOUR ARE DROPPED FROM `customers` · ledger #335, commit 3 of 3
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, in the SQL EDITOR — never the table editor (§6 r17).
--
-- ⚠️ APPLY `20260917a_keep_phone_notes_before_street_drop.sql` BEFORE THIS (ledger #346): five phone
-- notes live only in `address_line1` until it runs, and §1b below refuses while they do.
--
-- ⚠️ APPLY `20260915_contact_record.sql` FIRST. This migration removes the columns that file's
-- trigger REPLACES; applying them out of order leaves `customers` with no address at all between
-- the two. They are two files rather than one because the first is additive and reversible and
-- this one is neither — a reviewer should be able to read the destructive half on its own.
--
-- ── WHAT THIS DOES ──────────────────────────────────────────────────────────────────────────
-- DROPS `customers.address_line1`, `.city`, `.state`, `.zip`.
--
-- D-41 (2026-07-16) ruled *"Billing address = COLUMNS on customers (one, stable)"* and the legacy
-- four were kept as a MIRROR of the canonical `billing_*` four, written alongside them by every
-- writer. David superseded that mechanism on 2026-09-15: the address LIST is the truth,
-- `billing_*` is its derived view (maintained by `20260915`'s trigger), and a third representation
-- of one address is the second-copy defect this platform logs weekly.
--
-- 🔴 THE MIRROR HAD THREE HAND-MAINTAINED COPIES, WHICH IS THE ARGUMENT IN ONE LINE:
--     · `customerFieldRegistry.ts:130`  `CUSTOMER_BILLING_MIRROR`   canonical → legacy
--     · `customerUpsert.ts:154`         `CANONICAL`                 legacy → canonical (inverted)
--     · `customerImportWriter.ts:208`   `billing_line1: c.address_line1`  (a third, inline)
--   Three copies of one mapping, across four independent writers. All three are deleted.
--
-- 🔴 AND IT WAS ALREADY COSTING SOMETHING, LIVE: `CartReview.tsx:617-619` read the LEGACY four
--   with NO billing fallback, so a customer whose address lived in `billing_*` and not in the
--   legacy columns showed NO ADDRESS AT ALL on the review screen — while the delivery row, the
--   invoice push and the checkout form all resolved it correctly. Four surfaces, one address, one
--   of them reading the wrong column set. Fixed in the same commit as this migration.
--
-- ── WHY THIS IS SAFE TO DO NOW AND WOULD NOT BE LATER (David's reasoning, recorded) ─────────
-- *"There is ONE tenant of test data and D-41 follow-up (b) has been open since July. If it does
-- not happen now it happens against a live customer with real orders pointing at those columns."*
-- The bulk import has never run. There is nothing to protect and no migration risk to weigh.
--
-- ── HOW THE REPOINT WAS REVIEWED (the part that is not obvious) ──────────────────────────────
-- 🔴 THE COMPILER CATCHES 13 OF ~140 SITES. Measured: deleting the four fields from
-- `types/customer.ts` took tsc from 3 pre-existing errors to 16. The rest are invisible because
-- only FOUR files import the shared `Customer` type while SIX declared their own inline row shape;
-- three were PostgREST select-string literals, where dropping a column does not error but returns
-- `undefined` (R-19's exact failure); and the writers build `Record<string, unknown>` payloads.
--
-- So a cap was built FIRST and proven RED against the real corpus — 109 sites, 14 files — and the
-- repoint was driven against it until it went green: `scripts/verify-customer-address-columns.mjs`,
-- in `npm run verify`. David: *"the cap is the reviewer."*
--
-- ⚠️ THE CAP WAS WRONG THREE TIMES AND EACH FIX IS A PROBE, because a cap with false positives is
-- one people argue with rather than obey: it flagged a DELIVERIES row nested in a customer-handling
-- function (fixed: innermost block); a delivery INTERFACE that merely nests a `customers` join
-- (fixed: a block is judged on its own level, not its children's); and a delivery row whose values
-- are READ from a resolved billing object (fixed: naming a customer field as a KEY declares a
-- customer shape, reading one is consumption). 25 probes, both directions.
--
-- ── WHAT THIS DOES NOT DO ───────────────────────────────────────────────────────────────────
--   · It does NOT touch `deliveries.address_line1/city/state/zip`. Those are a DIFFERENT table and
--     they are D-41's surviving invariant: THE ORDER STILL SNAPSHOTS THE CHOSEN ADDRESS ONTO THE
--     DELIVERY ROW, so a past invoice keeps saying where the load actually went.
--   · It does NOT touch `vendors`, `receipts` or `businesses`, which carry their own address
--     columns of the same names.
--   · It BACKFILLS NOTHING and SEEDS NOTHING.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 PRE-FLIGHT — REFUSE IF THE DERIVED COLUMNS ARE NOT POPULATED ─────────────────────────
-- 🔴 A DESTRUCTIVE MIGRATION THAT CANNOT REFUSE IS NOT SAFE TO HAND TO ANYONE. If any customer
-- holds a legacy address that `billing_*` does not, dropping the column DESTROYS it. This refuses
-- the whole transaction rather than discovering it afterwards, when there is nothing to discover
-- it from. (§6 r19 — the check must be able to disagree.)
DO $$
DECLARE
  n_at_risk integer;
BEGIN
  -- ✏️ 2026-09-16: `20260915_contact_record` now moves a phone typed into a street field to the
  -- PHONE list, so `billing_line1` is (correctly) empty for those customers while the legacy
  -- `address_line1` still holds the number. A legacy street is therefore at risk only when its
  -- value is in NEITHER list: not an active address line, and — by digits — not an active phone.
  SELECT count(*) INTO n_at_risk
    FROM public.customers c
   WHERE (COALESCE(btrim(c.address_line1), '') <> '' AND COALESCE(btrim(c.billing_line1), '') = ''
          AND NOT EXISTS (SELECT 1 FROM public.customer_addresses a
                           WHERE a.customer_id = c.id AND a.active
                             AND lower(btrim(c.address_line1)) IN (lower(a.line1), lower(a.line2)))
          AND NOT (length(regexp_replace(c.address_line1, '\D', '', 'g')) >= 10
                   AND EXISTS (SELECT 1 FROM public.customer_phones p
                                WHERE p.customer_id = c.id AND p.active
                                  AND position(p.value_norm IN regexp_replace(c.address_line1, '\D', '', 'g')) > 0)))
      OR (COALESCE(btrim(c.city),  '') <> '' AND COALESCE(btrim(c.billing_city),  '') = '')
      OR (COALESCE(btrim(c.state), '') <> '' AND COALESCE(btrim(c.billing_state), '') = '')
      OR (COALESCE(btrim(c.zip),   '') <> '' AND COALESCE(btrim(c.billing_zip),   '') = '');

  IF n_at_risk > 0 THEN
    RAISE EXCEPTION
      'REFUSED: % customer row(s) hold a legacy address value that billing_* does not. Dropping '
      'the columns would destroy it. Run the SELECT in the V-BLOCK to see them, copy the values '
      'across (or import them into customer_addresses), then re-run this migration.', n_at_risk;
  END IF;
END $$;

-- ── §1b PRE-FLIGHT — REFUSE IF WORDS BESIDE A PHONE WOULD BE LOST (ledger #346, 2026-09-17) ───
-- §1 accepts a legacy street that is a phone held in the list — by its DIGITS. It did not look at
-- the WORDS beside the number ("(512) 555-0100 - cell"), and for five LAWNS customers those words
-- were held nowhere else: this file would have dropped them. Measured live, proven red on a copy.
-- A phone-with-words is safe only when an active phone row of the same customer holds the words
-- as its note (or holds the whole text as its value). Read with the seed's own reader, verbatim.
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

DO $$
DECLARE
  n_lost integer;
  ids text;
BEGIN
  SELECT count(DISTINCT c.id), string_agg(DISTINCT left(c.id::text, 8), ', ')
    INTO n_lost, ids
    FROM public.customers c
   CROSS JOIN LATERAL pg_temp.phones_in_text(c.address_line1) q
   WHERE q.note IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.customer_phones p
                      WHERE p.customer_id = c.id AND p.active
                        AND (btrim(p.note) = btrim(q.note) OR lower(btrim(p.value)) = lower(btrim(c.address_line1))));

  IF n_lost > 0 THEN
    RAISE EXCEPTION
      'REFUSED: % customer(s) hold words beside a phone in the old street column that no phone row '
      'keeps (%). Dropping the column would lose them. Apply 20260917a first. Nothing changed.', n_lost, ids;
  END IF;
END $$;

-- ── §2 THE DROP ─────────────────────────────────────────────────────────────────────────────
-- 🔴 NO `CASCADE`, DELIBERATELY. If a view, index or constraint still depends on one of these
-- columns, this must FAIL and name it rather than silently taking the dependent object with it.
-- A destructive migration that quietly widens its own blast radius is the thing to avoid here.
ALTER TABLE public.customers DROP COLUMN IF EXISTS address_line1;
ALTER TABLE public.customers DROP COLUMN IF EXISTS city;
ALTER TABLE public.customers DROP COLUMN IF EXISTS state;
ALTER TABLE public.customers DROP COLUMN IF EXISTS zip;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — run AFTER applying. Read-only. Paste ONE statement at a time.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- V0 · 🔴 RUN THIS BEFORE APPLYING, NOT AFTER. It is §1's refusal, as a list you can read: every
-- customer that would LOSE an address value. Expect ZERO rows. Anything here must be settled first.
-- SELECT id, first_name, organization_name,
--        address_line1, billing_line1, city, billing_city, state, billing_state, zip, billing_zip
--   FROM public.customers
--  WHERE (COALESCE(btrim(address_line1),'') <> '' AND COALESCE(btrim(billing_line1),'') = '')
--     OR (COALESCE(btrim(city),         '') <> '' AND COALESCE(btrim(billing_city), '') = '')
--     OR (COALESCE(btrim(state),        '') <> '' AND COALESCE(btrim(billing_state),'') = '')
--     OR (COALESCE(btrim(zip),          '') <> '' AND COALESCE(btrim(billing_zip),  '') = '');

-- V0b · 🔴 ALSO BEFORE APPLYING (ledger #346): customers whose street holds words beside a phone
-- that no phone row keeps. Expect ZERO rows once 20260917a has run. (§1b's refusal, as a count —
-- it needs the seed's reader, so it is the migration's own check; this is the same question
-- asked with the digits only, for a quick look.)
-- SELECT c.id, p.value, p.note FROM public.customers c
--   JOIN public.customer_phones p ON p.customer_id = c.id AND p.active
--  WHERE COALESCE(btrim(c.billing_line1), '') = '' AND COALESCE(btrim(c.address_line1), '') ~ '[A-Za-z]'
--    AND position(p.value_norm IN regexp_replace(c.address_line1, '\D', '', 'g')) > 0
--  ORDER BY c.id;

-- V1 · the four are GONE from `customers`. Expect ZERO rows.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'customers'
--    AND column_name IN ('address_line1', 'city', 'state', 'zip');

-- V2 · the canonical four are still there. Expect FOUR rows.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'customers'
--    AND column_name IN ('billing_line1', 'billing_city', 'billing_state', 'billing_zip')
--  ORDER BY column_name;

-- V3 · 🔴 `deliveries` IS UNTOUCHED — D-41's surviving invariant. Expect FOUR rows.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'deliveries'
--    AND column_name IN ('address_line1', 'city', 'state', 'zip')
--  ORDER BY column_name;

-- V4 · and so are the other tables that carry the same column names. Expect rows for each.
-- SELECT table_name, column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND column_name IN ('address_line1','city','state','zip')
--  ORDER BY table_name, column_name;

-- V5 · the derivation still works end to end: the flat column matches the list's default billing
-- row for every customer that has one. Expect ZERO rows (every one agrees).
-- SELECT c.id, c.billing_line1 AS flat, a.line1 AS list
--   FROM public.customers c
--   JOIN public.customer_addresses a
--     ON a.customer_id = c.id AND a.active AND a.is_default AND a.kind IN ('billing','both')
--  WHERE c.billing_line1 IS DISTINCT FROM a.line1;
