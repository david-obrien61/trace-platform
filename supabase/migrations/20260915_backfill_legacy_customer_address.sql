-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260915 (backfill) — THE LEGACY ADDRESS VALUES ARE COPIED INTO `billing_*` BEFORE THE DROP
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, in the SQL EDITOR — never the table editor (§6 r17).
--
-- 🔴 THE APPLY ORDER, AND THIS FILE IS FIRST:
--       ①  20260915_backfill_legacy_customer_address.sql   ← THIS FILE
--       ②  20260915_contact_record.sql
--       ③  20260915b_drop_legacy_customer_address.sql
--
--    The name sorts before `20260915_contact_record.sql` ('b' < 'c'), so a tool that enumerates
--    this directory alphabetically also gets the order right. ⚠️ THAT IS A CONVENIENCE, NOT THE
--    GUARANTEE — these are applied BY HAND, so the banner is the guarantee.
--
-- ── WHY IT EXISTS ───────────────────────────────────────────────────────────────────────────
-- ③'s §1 REFUSES while any customer holds a legacy address value that `billing_*` does not, and
-- on 2026-09-15 it would refuse: CARD 1 returned TWENTY rows.
--
--   · 19 hold `state = 'TX'` and nothing else — no street, no city, no zip. Two letters on a
--     customer with no address to attach them to.
--   · 🔴 ONE IS A REAL ADDRESS: `58e9e0f9-6ac6-49c5-a954-0061f201d134` — Paul, 20401 Gilbert Cove,
--     Lago Vista. Street and city are in BOTH column sets; STATE and ZIP are legacy-only. Dropping
--     the legacy four takes TX and the postcode off a customer who has a real, complete address.
--
-- 🔴 SO THE GUARD IS SATISFIED ON THE DATA RATHER THAN WAIVED. The alternative — editing ③'s §1 to
-- tolerate the rows, or hand-patching the 20 in the table editor — makes a destructive migration
-- pass by having its check lowered, which is the one thing a destructive migration must not do
-- (§6 r19: a check that cannot disagree is not a check). This file moves the DATA so the check
-- passes for the right reason, and the check is left exactly as written.
--
-- ── WHY BEFORE ②, AND NOT MERELY BEFORE ③ ───────────────────────────────────────────────────
-- ⚠️ THE HARD REQUIREMENT IS ONLY "BEFORE ③", AND THIS FILE SAYS SO RATHER THAN OVERSTATING ITS
-- OWN DEPENDENCY. Mechanically it also works between ② and ③: ②'s three triggers are on
-- `customer_phones`, `customer_emails` and `customer_addresses`, so an UPDATE of `customers` fires
-- none of them. The argument for putting it first is about the MODEL, not about breakage:
--
--   · BEFORE ②, `billing_*` are plain data columns. This is then an ordinary data repair that
--     finishes D-41's mirror before the mirror is retired — uncontested, and final.
--   · AFTER ②, `billing_*` are a DERIVED VIEW of `customer_addresses`, recomputed by
--     `sync_customer_flat_contact`. A hand-written value in a derived column is correct only until
--     something recomputes it, so the same UPDATE becomes a write the platform does not consider
--     authoritative.
--
-- ✏️ AMENDED 2026-09-15 (David). THIS FILE WAS COSMETIC FOR ABOUT AN HOUR, AND IS NOT ANY MORE.
-- As first written it copied legacy → `billing_*` and stopped, which satisfied ③'s guard and then
-- EVAPORATED: ② made `billing_*` a derived view of `customer_addresses`, that table held ZERO rows,
-- and so the first phone or email written against a customer blanked the value this file had just
-- copied. David's ruling: *"a migration that moves addresses into a list must move the addresses
-- into the list."* ② now SEEDS the three contact lists from the flat columns (② §5b).
--
-- 🔴 WHICH MAKES THIS FILE LOAD-BEARING RATHER THAN DECORATIVE, AND THE ORDER IS WHY.
-- ② seeds `customer_addresses` from `billing_*`. It reads NOTHING from the legacy four — it has no
-- reason to know they exist. So a value sitting ONLY in a legacy column at the moment ② runs is a
-- value that never reaches the list, and ③ then drops the column it was living in.
--
--   ①  consolidates every address value into `billing_*`   ← this file
--   ②  moves `billing_*` into `customer_addresses`, then derives `billing_*` back from it
--   ③  drops the legacy four, which by then hold nothing that is not in the list
--
-- 🔴 PAUL IS THE ROW THAT PROVES THE ORDER MATTERS. His TX and his postcode are legacy-only. Run ②
-- before ①, and his billing address enters the list as a street and a city with NO STATE AND NO
-- ZIP — and ③ then destroys the only copy of the two missing fields. The address survives looking
-- complete enough that nobody would go checking. Run ① first and the list gets all four.
--
-- ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────────────────────
--   · It does NOT drop, alter or add a column. It is pure UPDATE.
--   · It does NOT touch `deliveries`, `vendors`, `receipts` or `businesses`.
--   · It does NOT seed `customer_addresses`, `customer_phones` or `customer_emails`.
--   · It does NOT overwrite a populated `billing_*` value. Where both sides hold a value, BILLING
--     WINS and the legacy value is left alone — see §3's NOTICE, which counts the disagreements.
--   · It is IDEMPOTENT: a second run matches zero rows and changes nothing.
--
-- ⚠️ IT DOES MOVE `updated_at` on the rows it touches — `customers_updated_at`
-- (`20260713_customers_party_record.sql:86`) is a BEFORE UPDATE trigger and it will fire.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 REPORT WHAT IS ABOUT TO MOVE ─────────────────────────────────────────────────────────
-- Prints before it writes, so the number is on screen next to the write that used it.
DO $$
DECLARE
  n_rows integer; n_line1 integer; n_city integer; n_state integer; n_zip integer;
BEGIN
  SELECT count(*) INTO n_rows FROM public.customers
   WHERE (COALESCE(btrim(address_line1), '') <> '' AND COALESCE(btrim(billing_line1), '') = '')
      OR (COALESCE(btrim(city),          '') <> '' AND COALESCE(btrim(billing_city),  '') = '')
      OR (COALESCE(btrim(state),         '') <> '' AND COALESCE(btrim(billing_state), '') = '')
      OR (COALESCE(btrim(zip),           '') <> '' AND COALESCE(btrim(billing_zip),   '') = '');

  SELECT count(*) INTO n_line1 FROM public.customers
   WHERE COALESCE(btrim(address_line1), '') <> '' AND COALESCE(btrim(billing_line1), '') = '';
  SELECT count(*) INTO n_city  FROM public.customers
   WHERE COALESCE(btrim(city),          '') <> '' AND COALESCE(btrim(billing_city),  '') = '';
  SELECT count(*) INTO n_state FROM public.customers
   WHERE COALESCE(btrim(state),         '') <> '' AND COALESCE(btrim(billing_state), '') = '';
  SELECT count(*) INTO n_zip   FROM public.customers
   WHERE COALESCE(btrim(zip),           '') <> '' AND COALESCE(btrim(billing_zip),   '') = '';

  RAISE NOTICE 'BACKFILL: % customer row(s) to touch — line1 %, city %, state %, zip % value(s) to copy',
    n_rows, n_line1, n_city, n_state, n_zip;
END $$;

-- ── §2 THE COPY — legacy → billing_*, ONLY where billing is empty and legacy is not ─────────
-- 🔴 THE `WHERE` IS CARD 1'S PREDICATE, CHARACTER FOR CHARACTER. The rows this touches are
-- exactly the rows CARD 1 lists, which is what makes the two readable against each other.
--
-- Per-column `CASE`, not a blanket assignment: a row in the population because of `state` must not
-- have its other three columns rewritten as a side effect. `btrim` on the way in, because ③'s guard
-- compares trimmed values and a copied ' TX' would satisfy the guard while storing the untrimmed
-- string the guard was written to ignore.
-- ✏️ 2026-09-16: once `20260915_contact_record` is applied its GUARD refuses any direct write to
-- `billing_*` — and this file is exactly such a write. That only matters on the RECOVERY path (a
-- restore of the 2026-09-16 snapshot, then this file, then 20260915_contact_record again), so the
-- guard is switched off for this transaction if it exists, and back on before COMMIT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.customers'::regclass
              AND tgname = 'trg_customers_derived_contact_guard') THEN
    ALTER TABLE public.customers DISABLE TRIGGER trg_customers_derived_contact_guard;
  END IF;
END $$;

UPDATE public.customers SET
  billing_line1 = CASE WHEN COALESCE(btrim(address_line1), '') <> ''
                        AND COALESCE(btrim(billing_line1), '') =  ''
                       THEN btrim(address_line1) ELSE billing_line1 END,
  billing_city  = CASE WHEN COALESCE(btrim(city),          '') <> ''
                        AND COALESCE(btrim(billing_city),  '') =  ''
                       THEN btrim(city)          ELSE billing_city  END,
  billing_state = CASE WHEN COALESCE(btrim(state),         '') <> ''
                        AND COALESCE(btrim(billing_state), '') =  ''
                       THEN btrim(state)         ELSE billing_state END,
  billing_zip   = CASE WHEN COALESCE(btrim(zip),           '') <> ''
                        AND COALESCE(btrim(billing_zip),   '') =  ''
                       THEN btrim(zip)           ELSE billing_zip   END
 WHERE (COALESCE(btrim(address_line1), '') <> '' AND COALESCE(btrim(billing_line1), '') = '')
    OR (COALESCE(btrim(city),          '') <> '' AND COALESCE(btrim(billing_city),  '') = '')
    OR (COALESCE(btrim(state),         '') <> '' AND COALESCE(btrim(billing_state), '') = '')
    OR (COALESCE(btrim(zip),           '') <> '' AND COALESCE(btrim(billing_zip),   '') = '');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.customers'::regclass
              AND tgname = 'trg_customers_derived_contact_guard') THEN
    ALTER TABLE public.customers ENABLE TRIGGER trg_customers_derived_contact_guard;
  END IF;
END $$;

-- ── §3 PROVE IT, IN THE SAME TRANSACTION ────────────────────────────────────────────────────
-- 🔴 THIS CAN FAIL, WHICH IS THE POINT (§6 r19). If §2's CASE arms and its WHERE ever disagree —
-- a mistyped column, a fifth field added later to one and not the other — the population is not
-- cleared, ③ still refuses, and the reason would otherwise surface two migrations later.
DO $$
DECLARE
  n_left integer; n_conflict integer;
BEGIN
  SELECT count(*) INTO n_left FROM public.customers
   WHERE (COALESCE(btrim(address_line1), '') <> '' AND COALESCE(btrim(billing_line1), '') = '')
      OR (COALESCE(btrim(city),          '') <> '' AND COALESCE(btrim(billing_city),  '') = '')
      OR (COALESCE(btrim(state),         '') <> '' AND COALESCE(btrim(billing_state), '') = '')
      OR (COALESCE(btrim(zip),           '') <> '' AND COALESCE(btrim(billing_zip),   '') = '');

  IF n_left > 0 THEN
    RAISE EXCEPTION
      'REFUSED: % customer row(s) STILL hold a legacy address value that billing_* does not. The '
      'copy did not cover its own population — do not proceed to 20260915b.', n_left;
  END IF;

  -- ⚠️ A NOTICE, NOT A REFUSAL — AND IT IS A DIFFERENT QUESTION FROM THE ONE ③ ASKS.
  -- ③'s guard (and CARD 1) only catch legacy-non-empty AND billing-EMPTY. A row where BOTH are
  -- populated and they DISAGREE loses the legacy value on the drop, silently, and neither the
  -- guard nor CARD 1 lists it. This file does not resolve those — billing wins by D-41 and picking
  -- a winner per row is a ruling, not a backfill — but it will not let them go unseen either.
  SELECT count(*) INTO n_conflict FROM public.customers
   WHERE (COALESCE(btrim(address_line1), '') <> '' AND COALESCE(btrim(billing_line1), '') <> ''
          AND btrim(address_line1) IS DISTINCT FROM btrim(billing_line1))
      OR (COALESCE(btrim(city),  '') <> '' AND COALESCE(btrim(billing_city),  '') <> ''
          AND btrim(city)  IS DISTINCT FROM btrim(billing_city))
      OR (COALESCE(btrim(state), '') <> '' AND COALESCE(btrim(billing_state), '') <> ''
          AND btrim(state) IS DISTINCT FROM btrim(billing_state))
      OR (COALESCE(btrim(zip),   '') <> '' AND COALESCE(btrim(billing_zip),   '') <> ''
          AND btrim(zip)   IS DISTINCT FROM btrim(billing_zip));

  IF n_conflict > 0 THEN
    RAISE NOTICE '⚠️ % customer row(s) hold a legacy value that DISAGREES with a populated '
      'billing_* value. CARD 1 does not list these and 20260915b does not refuse on them — the '
      'legacy side is discarded by the drop. Run V3 to read them BEFORE applying 20260915b.',
      n_conflict;
  ELSE
    RAISE NOTICE 'No legacy/billing disagreements — every populated pair matches.';
  END IF;

  RAISE NOTICE 'CARD 1 now returns ZERO rows. 20260915b §1 will pass on the data.';
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — read-only. Paste ONE statement at a time.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- V0 · 🔴 RUN THIS BEFORE APPLYING: how many rows, and which columns move. This is the count.
--       Expect 20 rows on 2026-09-15 — 19 state-only, plus Paul.
-- SELECT count(*) AS rows_to_touch,
--        count(*) FILTER (WHERE COALESCE(btrim(address_line1),'') <> '' AND COALESCE(btrim(billing_line1),'') = '') AS copy_line1,
--        count(*) FILTER (WHERE COALESCE(btrim(city),         '') <> '' AND COALESCE(btrim(billing_city), '') = '') AS copy_city,
--        count(*) FILTER (WHERE COALESCE(btrim(state),        '') <> '' AND COALESCE(btrim(billing_state),'') = '') AS copy_state,
--        count(*) FILTER (WHERE COALESCE(btrim(zip),          '') <> '' AND COALESCE(btrim(billing_zip),  '') = '') AS copy_zip
--   FROM public.customers
--  WHERE (COALESCE(btrim(address_line1),'') <> '' AND COALESCE(btrim(billing_line1),'') = '')
--     OR (COALESCE(btrim(city),         '') <> '' AND COALESCE(btrim(billing_city), '') = '')
--     OR (COALESCE(btrim(state),        '') <> '' AND COALESCE(btrim(billing_state),'') = '')
--     OR (COALESCE(btrim(zip),          '') <> '' AND COALESCE(btrim(billing_zip),  '') = '');

-- V1 · CARD 1, re-run. After applying, expect ZERO rows.
-- SELECT id, first_name, organization_name,
--        address_line1, billing_line1, city, billing_city, state, billing_state, zip, billing_zip
--   FROM public.customers
--  WHERE (COALESCE(btrim(address_line1),'') <> '' AND COALESCE(btrim(billing_line1),'') = '')
--     OR (COALESCE(btrim(city),         '') <> '' AND COALESCE(btrim(billing_city), '') = '')
--     OR (COALESCE(btrim(state),        '') <> '' AND COALESCE(btrim(billing_state),'') = '')
--     OR (COALESCE(btrim(zip),          '') <> '' AND COALESCE(btrim(billing_zip),  '') = '');

-- V2 · 🔴 PAUL, THE ONE ROW THAT IS A REAL ADDRESS. Expect state = 'TX' and a zip on BOTH sides,
--       and the street and city unchanged from what they already were.
-- SELECT id, first_name, organization_name,
--        address_line1, billing_line1, city, billing_city, state, billing_state, zip, billing_zip
--   FROM public.customers WHERE id = '58e9e0f9-6ac6-49c5-a954-0061f201d134';

-- V3 · ⚠️ THE ROWS NEITHER CARD 1 NOR 20260915b's GUARD LOOKS AT: both sides populated and
--       DISAGREEING. The legacy value here is discarded by the drop, unguarded. §3 counts these;
--       this lists them. Read it before applying 20260915b.
-- SELECT id, first_name, organization_name,
--        address_line1, billing_line1, city, billing_city, state, billing_state, zip, billing_zip
--   FROM public.customers
--  WHERE (COALESCE(btrim(address_line1),'') <> '' AND COALESCE(btrim(billing_line1),'') <> '' AND btrim(address_line1) IS DISTINCT FROM btrim(billing_line1))
--     OR (COALESCE(btrim(city),         '') <> '' AND COALESCE(btrim(billing_city), '') <> '' AND btrim(city)          IS DISTINCT FROM btrim(billing_city))
--     OR (COALESCE(btrim(state),        '') <> '' AND COALESCE(btrim(billing_state),'') <> '' AND btrim(state)         IS DISTINCT FROM btrim(billing_state))
--     OR (COALESCE(btrim(zip),          '') <> '' AND COALESCE(btrim(billing_zip),  '') <> '' AND btrim(zip)           IS DISTINCT FROM btrim(billing_zip));

-- V4 · 🔴 RUN THIS AFTER ②, NOT AFTER THIS FILE. It is the durability check, and since ② §5b it
--       has a right answer: ZERO rows. It lists customers holding a billing value with NO active
--       `customer_addresses` row to derive it from — every one of those would have `billing_*`
--       blanked by the sync trigger on the first phone or email written against them.
--       ⚠️ ②'s §5c refuses the whole transaction if this is non-zero, so a non-zero answer here
--       means ② has not been applied yet — not that it failed.
-- SELECT c.id, c.first_name, c.organization_name, c.billing_line1, c.billing_state, c.billing_zip,
--        (SELECT count(*) FROM public.customer_addresses a
--          WHERE a.customer_id = c.id AND a.active) AS address_rows
--   FROM public.customers c
--  WHERE COALESCE(btrim(c.billing_state), '') <> ''
--    AND NOT EXISTS (SELECT 1 FROM public.customer_addresses a
--                     WHERE a.customer_id = c.id AND a.active)
--  ORDER BY c.billing_line1 NULLS LAST;
