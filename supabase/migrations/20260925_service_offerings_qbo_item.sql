-- ─────────────────────────────────────────────────────────────────────────────
-- 20260925_service_offerings_qbo_item.sql               ·  ledger #407
--
-- PURPOSE: let a SERVICE carry its own QuickBooks item, so a service line can be pushed
--   at all. Today **every service line on every tenant is refused** for want of one —
--   `service_offerings` has 22 columns and not a single `qb_*` among them, measured
--   2026-09-25. #394 fixed the GOODS half; this is the other.
--
-- ✅ THE BUILDER ALREADY DOES THE RIGHT THING AND NEEDS NO CHANGE, WHICH IS WHY THIS FILE
--   IS A MIGRATION AND NOT A REWRITE. `cultivar.ts` already passes the offering itself as
--   `backingRow` on all four service paths (`:571`, `:600`, `:625`, `:647`), and
--   `qboItemMappingOf` already reads `qbo_item_id`/`qbo_item_name` off whatever it is given.
--   The embed is `service_offerings(*)`, a star select, so a new column arrives without a
--   query change. **The only missing thing was the column.**
--
-- 🔴 THE VALUE IS THE SERVICE'S OWN, NOT A POINTER (STD-019). It is stored ON the offering
--   row, so it survives a reload and cannot drift from whatever some other table happens to
--   say today. That is the same rule #394 landed on for goods: the id FROZEN on the row that
--   is charged, never chased through an embed.
--
-- ── THE FOUR COLUMNS, AND WHY EACH EARNS ITSELF ──────────────────────────────
--   `qbo_item_id`      — the Intuit item. NULL = not mapped.
--   `qbo_item_name`    — QuickBooks' OWN name for it, so Lauren recognises the row she is
--                        confirming. Without it the Settings screen shows her a bare number.
--   `qbo_item_because` — 🔴 DAVID ASKED FOR THIS BY NAME: *"show each mapping with its source
--                        so Lauren can change it in Settings."* An unlabelled mapping cannot
--                        be checked, and this one was derived from invoice history rather
--                        than chosen — she deserves to see which.
--   `qbo_omit`         — 🔴 DELIBERATELY NOT PUSHED, which is a DIFFERENT FACT FROM UNMAPPED
--                        and must not look like one. David: *"Self-collect ($0, omitted from
--                        push)."* Without this column a $0 self-collect is indistinguishable
--                        from a service nobody has mapped yet, and the push would refuse an
--                        order for a line that was never meant to go.
--
-- ⚠️ A $0 "INCLUDED" MARKER NEEDS NO COLUMN AND DOES NOT GET ONE. `isDocumentationAmount`
--   already turns any zero amount into a `DescriptionOnly` line carrying NO ItemRef — which
--   is exactly what DIW is, and it matches LAWNS's own books (194 DescriptionOnly lines in
--   their history). Adding a third mode for something already handled would be a second
--   representation of one fact.
--
-- 🔴 AND NOTHING IS MAPPED BY THIS FILE. The columns arrive empty on every tenant; the LAWNS
--   values are a DATA file David runs (CLAUDE.md §4 reserves LAWNS data writes to him), so a
--   migration never carries one tenant's business decisions.
--
-- ADDITIVE AND IDEMPOTENT: ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS before ADD.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE service_offerings
  ADD COLUMN IF NOT EXISTS qbo_item_id      text,
  ADD COLUMN IF NOT EXISTS qbo_item_name    text,
  ADD COLUMN IF NOT EXISTS qbo_item_because text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS qbo_omit         boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN service_offerings.qbo_item_id IS
  'The Intuit item this service bills against, held as the service''s OWN value (STD-019) so it survives a reload. NULL = not mapped: the push REFUSES the line and names it, rather than guessing.';
COMMENT ON COLUMN service_offerings.qbo_item_name IS
  'QuickBooks'' own name for that item, so the Settings screen shows a name rather than a bare number.';
COMMENT ON COLUMN service_offerings.qbo_item_because IS
  'Where this mapping came from — invoice history, the owner''s choice, or nobody yet. Shown beside it in Settings so it can be checked and changed.';
COMMENT ON COLUMN service_offerings.qbo_omit IS
  'TRUE = deliberately NOT pushed to QuickBooks. A different fact from unmapped, and it must not look like one: a $0 self-collect is not a line nobody mapped.';

-- ── THE NAMED CHECK — THE TWO STATES CANNOT BOTH BE TRUE ─────────────────────
-- 🔴 A row that is BOTH mapped and omitted is a contradiction, and whichever the reader
-- believes, the other is wrong. NAMED per tech-debt #91 — an inline CHECK is auto-named,
-- so its name is never typed anywhere and no sweep matching on `conname` can find it.
ALTER TABLE service_offerings
  DROP CONSTRAINT IF EXISTS service_offerings_qbo_mapped_or_omitted_check;
ALTER TABLE service_offerings
  ADD CONSTRAINT service_offerings_qbo_mapped_or_omitted_check
  CHECK (NOT (qbo_omit AND qbo_item_id IS NOT NULL));

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style, self-contained, every one runs AS-IS (§6 r26).
-- 🔴 NOT ONE PINS A ROW COUNT. Live figures print in columns carrying no verdict.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE FOUR COLUMNS, WITH THE RIGHT NULLABILITY. Expect: PASS, 4.
-- The two ids are nullable because "not mapped" is a real state; the reason and the flag are
-- NOT NULL because a row must always be able to say which it is.
SELECT 'V1 the four columns exist with the right nullability' AS check,
       CASE WHEN count(*) = 4
             AND bool_and(CASE WHEN column_name IN ('qbo_item_id','qbo_item_name')
                               THEN is_nullable = 'YES'
                               ELSE is_nullable = 'NO' AND column_default IS NOT NULL END)
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS columns_found,
       string_agg(column_name || ' null=' || is_nullable, ' · ' ORDER BY column_name) AS shape
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'service_offerings'
   AND column_name IN ('qbo_item_id','qbo_item_name','qbo_item_because','qbo_omit');

-- V2 — THE CHECK EXISTS AND IS FINDABLE BY NAME. Expect: PASS, 1.
SELECT 'V2 service_offerings_qbo_mapped_or_omitted_check exists BY NAME' AS check,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS constraints_found,
       coalesce(string_agg(pg_get_constraintdef(oid), ' · '), '(none)') AS definition
  FROM pg_constraint
 WHERE conrelid = 'service_offerings'::regclass
   AND conname  = 'service_offerings_qbo_mapped_or_omitted_check';

-- V3 — 🔴 RUN THIS ONE ALONE. AN ERROR IS THE PASS.
-- [[R-33]]: a guard nobody has watched refuse is a claim. This tries to make a row BOTH mapped
-- and omitted. Expect: ERROR 23514, naming service_offerings_qbo_mapped_or_omitted_check.
UPDATE service_offerings SET qbo_omit = true, qbo_item_id = '999'
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND sort_order = (SELECT min(sort_order) FROM service_offerings
                      WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74');

-- V4 — 🔴 NOTHING WAS MAPPED BY THIS MIGRATION. Expect: PASS, 0 and 0.
-- The negative control: a migration that quietly mapped one tenant's services would be a
-- business decision smuggled into schema. The LAWNS values come from a DATA file David runs.
SELECT 'V4 the migration mapped nothing and omitted nothing, on any tenant' AS check,
       CASE WHEN count(*) FILTER (WHERE qbo_item_id IS NOT NULL) = 0
             AND count(*) FILTER (WHERE qbo_omit) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE qbo_item_id IS NOT NULL) AS mapped_should_be_zero,
       count(*) FILTER (WHERE qbo_omit)                AS omitted_should_be_zero,
       count(*) AS service_rows_informational,
       count(DISTINCT business_id) AS tenants_informational
  FROM service_offerings;

-- V5 — THE EXISTING COLUMNS ARE UNTOUCHED. The blast-radius control, as an invariant.
-- Expect: PASS — every row still has the name, category and price_source it had.
SELECT 'V5 every service still has its name, category and price source' AS check,
       CASE WHEN count(*) FILTER (WHERE coalesce(name,'') = ''
                                     OR coalesce(category,'') = ''
                                     OR coalesce(price_source,'') = '') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE coalesce(name,'') = '') AS nameless_should_be_zero,
       count(*) AS rows_informational,
       string_agg(DISTINCT price_source, ' · ') AS price_sources_informational
  FROM service_offerings;

-- V6 — IDEMPOTENCE. Re-running leaves exactly one such constraint and four columns.
SELECT 'V6 re-running this file changes nothing' AS check,
       CASE WHEN (SELECT count(*) FROM pg_constraint
                   WHERE conrelid = 'service_offerings'::regclass
                     AND conname = 'service_offerings_qbo_mapped_or_omitted_check') = 1
             AND (SELECT count(*) FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='service_offerings'
                     AND column_name IN ('qbo_item_id','qbo_item_name','qbo_item_because','qbo_omit')) = 4
            THEN 'PASS' ELSE 'FAIL' END AS verdict;
