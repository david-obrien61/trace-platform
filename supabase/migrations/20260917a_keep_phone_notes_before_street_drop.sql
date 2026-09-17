-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260917a — NO PHONE NOTE IS LOST WHEN THE OLD STREET COLUMN IS DROPPED · ledger #346
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ✅ APPLIED 2026-09-17 BY DAVID, in the SQL editor, before `20260915b`. V1: five = 5 · V2: mismatched = 0.
--    (Was: "WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR, BEFORE `20260915b` (§6 r17).")
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────────────────
-- Nine LAWNS customers hold a phone number WITH WORDS beside it in the old street column
-- (`customers.address_line1`), e.g. a number followed by a short label. `20260915_contact_record`
-- seeded those words as the phone's NOTE — but only when the number was ADDED as a new row. For
-- FIVE customers the number in the street was the SAME as their phone column, so no new row was
-- added and the words were kept nowhere else. Measured live 2026-09-17 (ids and shapes only):
--   492e0cda · 5fa0c32e · 5fd58cd9 · 7c775806 · c395e570 — each: one active phone row
--   (`migrated:customers.phone`) whose number matches the street's, note empty.
-- The other four keep their words on the added row. `20260915b` drops `address_line1`, and until
-- this file runs, those five notes would go with it.
--
-- ── WHAT THIS DOES ──────────────────────────────────────────────────────────────────────────
-- For exactly those five customers, copies the words onto the matching phone row, only where that
-- row's note is empty. The words are read with the SAME function the seed used (copied verbatim
-- from `20260915_contact_record.sql` §5b.1), so "the words beside the number" means what it meant
-- when the lists were seeded.
--   · REFUSES unless the set of customers needing a note is exactly those five (or is empty because
--     this already ran), each with exactly one matching phone row.
--   · Writes only `customer_phones.note`. The phone list's triggers re-derive nothing from a note,
--     so `customers.phone` is unchanged.
--   · Idempotent: a second run finds nothing to do and says so.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── the seed's phone reader, verbatim (20260915_contact_record.sql §5b.1) ───────────────────
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
  expected constant uuid[] := ARRAY[
    '492e0cda-b9fb-4549-ac5c-c24d5c46c368',
    '5fa0c32e-cc60-480d-883b-293d16881f2c',
    '5fd58cd9-9bd9-4fd9-91c0-64632628dba6',
    '7c775806-f3c2-463d-abbe-814e7b7f46b8',
    'c395e570-23ac-4a4d-89e1-f43f9d79b2de'
  ]::uuid[];
  cand record;
  n_cand int;
  n_rows int;
  n_done int;
  bad text;
BEGIN
  -- Every phone-with-words in an old street, with the ONE active phone row holding that number,
  -- where no active phone row of that customer already holds the words.
  CREATE TEMP TABLE _note_fix ON COMMIT DROP AS
  SELECT c.id AS customer_id, p.id AS phone_id, q.note
    FROM public.customers c
   CROSS JOIN LATERAL pg_temp.phones_in_text(c.address_line1) q
    JOIN public.customer_phones p
      ON p.customer_id = c.id AND p.active
     AND p.value_norm = regexp_replace(q.phone, '\D', '', 'g')
   WHERE q.note IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.customer_phones h
                      WHERE h.customer_id = c.id AND h.active AND btrim(h.note) = btrim(q.note));

  SELECT count(DISTINCT customer_id), count(*) INTO n_cand, n_rows FROM _note_fix;

  IF n_cand = 0 THEN
    -- Already applied? Then all five hold a note on a phone row.
    SELECT count(DISTINCT customer_id) INTO n_done
      FROM public.customer_phones WHERE customer_id = ANY (expected) AND active AND note IS NOT NULL;
    IF n_done = 5 THEN
      RAISE NOTICE 'NOTHING TO DO: the five notes are already on their phone rows.';
      RETURN;
    END IF;
    RAISE EXCEPTION 'REFUSED: no customer needs a note, but only % of the five hold one. Nothing changed.', n_done;
  END IF;

  SELECT string_agg(customer_id::text, ', ') INTO bad
    FROM (SELECT DISTINCT customer_id FROM _note_fix
          WHERE NOT (customer_id = ANY (expected))) x;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSED: a customer outside the expected five needs a note (%). Nothing changed.', bad;
  END IF;
  IF n_cand <> 5 THEN
    RAISE EXCEPTION 'REFUSED: % of the expected five need a note, not 5. Nothing changed.', n_cand;
  END IF;
  IF n_rows <> 5 THEN
    RAISE EXCEPTION 'REFUSED: % matching phone rows for five customers — each must have exactly one. Nothing changed.', n_rows;
  END IF;

  UPDATE public.customer_phones p
     SET note = f.note
    FROM _note_fix f
   WHERE p.id = f.phone_id AND p.note IS NULL;
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  IF n_rows <> 5 THEN
    RAISE EXCEPTION 'REFUSED: wrote % notes, not 5 — rolled back. Nothing changed.', n_rows;
  END IF;
  RAISE NOTICE 'NOTES COPIED: 5 phone rows now hold the words from their old street value.';
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the five each hold a note on a phone row. EXPECT one row: five = 5.
-- SELECT count(DISTINCT customer_id) AS five
--   FROM public.customer_phones
--  WHERE active AND note IS NOT NULL
--    AND customer_id IN ('492e0cda-b9fb-4549-ac5c-c24d5c46c368', '5fa0c32e-cc60-480d-883b-293d16881f2c',
--                        '5fd58cd9-9bd9-4fd9-91c0-64632628dba6', '7c775806-f3c2-463d-abbe-814e7b7f46b8',
--                        'c395e570-23ac-4a4d-89e1-f43f9d79b2de');
--
-- V2 · no customer's main phone changed. EXPECT one row: mismatched = 0.
-- SELECT count(*) AS mismatched
--   FROM public.customers c
--   JOIN LATERAL (SELECT value FROM public.customer_phones p
--                  WHERE p.customer_id = c.id AND p.active
--                  ORDER BY p.is_primary DESC, p.created_at, p.id LIMIT 1) m ON true
--  WHERE c.phone IS DISTINCT FROM m.value;
