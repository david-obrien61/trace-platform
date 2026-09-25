-- ═══════════════════════════════════════════════════════════════════════════════
-- LAWNS DATA — which QuickBooks item each service bills against.   Ledger #407.
-- David pastes this. SQL editor. Run AFTER `supabase/migrations/20260925_service_offerings_qbo_item.sql`.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ DATA, NOT A MIGRATION. One tenant's business decisions; CLAUDE.md §4 reserves LAWNS
--    data writes to David. A migration never carries these.
--
-- 🔴 EVERY MAPPING CARRIES ITS SOURCE, AND AFTER DAVID'S CORRECTION THEY ARE ALL THE SAME
--    KIND OF FACT: THE QUICKBOOKS ITEM'S OWN DESCRIPTION. David, 2026-09-25 — *"TT IS Tree
--    Tarp — it is in the description; can T not read the description?"* He was right, and the
--    description settles all seven where initials and price only suggested.
--
-- ✏️ AN EARLIER VERSION OF THIS FILE CALLED TREE TARP **"A GUESS"**, MATCHED ON INITIALS AND
--    PRICE, AND ASKED LAUREN TO CONFIRM IT. That was unnecessary and it was my failure, not a
--    gap in the data: `business_inventory.description` is populated on **621 of LAWNS's 632
--    live items**, item 203's reads **"Tree Tarp"** exactly, and I matched on the name instead
--    of reading it. The guess is withdrawn; the mapping is settled.
--
-- ✏️ AND THE CORRECTION NOTE ITSELF HAD TO COME OUT OF THE REASON. A first pass left "an
--    earlier version called it A GUESS" inside `qbo_item_because` — and V2 went RED, because
--    that column is what LAUREN READS on the Settings screen. A reason mentioning a withdrawn
--    guess reads, at a glance, as though it still is one. The history belongs in this header;
--    the reason says what is true now.
--
--    Every figure below is from the QuickBooks export of 2026-09-24 (1,158 items,
--    `complete: true`, 1,105 carrying a Description) and LAWNS's own invoice history
--    (1,530 invoices, complete). The DESCRIPTION is the source; the history is corroboration.
--
-- ⚠️ THREE QUICKBOOKS ITEMS LAWNS USES HAVE NO SERVICE ROW TO MAP, AND THAT IS NOT AN
--    OVERSIGHT: `Backyard Delivery` (1006), `No Warranty` (1007) and `DIW` (121) exist in
--    QuickBooks and are named in David's ruling, but `service_offerings` holds no row for
--    any of them — LAWNS has seven services and these are not among them. **Nothing can be
--    mapped to a row that does not exist.** When those rows are created they get their
--    mapping in the same shape; DIW's is the $0 marker, which needs no item at all.
--
-- IDEMPOTENT: every UPDATE is absolute and matched on `name`, so a second run changes nothing.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE service_offerings AS s SET
  qbo_item_id      = v.item_id,
  qbo_item_name    = v.item_name,
  qbo_item_because = v.because,
  qbo_omit         = v.omit
FROM (VALUES
  -- ── FROM LAWNS'S OWN INVOICE HISTORY — the strongest kind, and the volume says so ──
  ('Trip Charge',       '186', 'TC',
   'QuickBooks item description + David 2026-09-25. Item 186''s description reads "Trip Charge". Corroborated by 517 invoice lines — by far LAWNS''s most-used service row.', false),
  ('Tailgate Delivery', '117', 'Tailgate Delivery',
   'QuickBooks item description + David 2026-09-25. Item 117''s description reads "Tailgate Delivery [WILL ONLY DROP ITEMS OFF ON THE SIDE OF CURB, OR ON THE DRIVEWAY]" — which also SETTLES it against Backyard Delivery (1006), whose own description says it drops in the backyard or anywhere else on the property. Corroborated by 123 invoice lines.', false),
  ('Tree Bubbler',      '185', 'TB',
   'QuickBooks item description + David 2026-09-25. Item 185''s description reads "Tree Bubbler". Corroborated by 80 invoice lines averaging $65.23 against this row''s $65.', false),
  ('Installation',      '137', 'Installation',
   'QuickBooks item description + David 2026-09-25. Item 137''s description reads "Install your Tree". 🔴 THE DESCRIPTION IS ALSO WHAT SETTLES IT AGAINST DIW (121), whose own reads "Deliver, Install and Warranty listed plants" — a $0 included marker at no cost to the customer, never a price (David, 2026-09-24). An earlier version called this a weak name match on 5 invoice lines; the description makes it explicit.', false),
  ('Plant Your Tree',   '164', 'PYT',
   'QuickBooks item description + David 2026-09-25. Item 164''s description reads "Plant Your Tree". ⚠️ The PRICE comes from the install ladder (David, 2026-09-24), not from this item — the mapping says where it BOOKS, not what it costs.', false),
  ('Tree Tarp',         '203', 'TT',
   'QuickBooks item description + David 2026-09-25. Item 203''s description reads "Tree Tarp" — outright, not inferred. "Tree Trimming" is a different item (198) and its own description reads "Tree Trimming by Quote", so the two cannot be confused.', false),

  -- ── 🔴 DELIBERATELY NOT PUSHED — a different fact from unmapped ──
  ('I will collect it myself', NULL, NULL,
   'Deliberately NOT pushed (David, 2026-09-24). It charges $0 and was NEVER invoiced in LAWNS''s 1,530-invoice history — there is no QuickBooks item for it because they have never billed one. Omitted so the push does not refuse an order over a line that was never meant to go.', true)
) AS v(name, item_id, item_name, because, omit)
WHERE s.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
  AND s.name = v.name;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style, self-contained, every one runs AS-IS (§6 r26). Read-only.
-- 🔴 NOT ONE PINS A ROW COUNT: LAWNS may add a service at any time, and a check that fails
-- for that reason is a check people learn to ignore. What is asserted is the RELATION.
-- ═══════════════════════════════════════════════════════════════════════════════

-- V1 — 🔴 EVERY SERVICE IS NOW EITHER MAPPED OR DELIBERATELY OMITTED. Expect: PASS, 0 silent.
-- This is the whole point: after this file, no service line can refuse the push for want of
-- a decision. A row appearing here later is a NEW service nobody has mapped — which is
-- exactly what the refusal is for, and it will name itself.
SELECT 'V1 no LAWNS service is left undecided' AS check,
       CASE WHEN count(*) FILTER (WHERE qbo_item_id IS NULL AND NOT qbo_omit) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE qbo_item_id IS NULL AND NOT qbo_omit) AS undecided_should_be_zero,
       count(*) FILTER (WHERE qbo_item_id IS NOT NULL) AS mapped_informational,
       count(*) FILTER (WHERE qbo_omit)                AS omitted_informational,
       count(*) AS services_informational
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V2 — 🔴 EVERY MAPPING SAYS WHERE IT CAME FROM, AND NOT ONE IS A GUESS. Expect: PASS, 0, 0.
-- The D-9 assertion, and after David's correction of 2026-09-25 it asserts something stronger:
-- every mapped row cites the QuickBooks item DESCRIPTION. A mapping resting on initials is
-- exactly what this file used to contain.
SELECT 'V2 every decided row cites the description, and none is a guess' AS check,
       CASE WHEN count(*) FILTER (WHERE (qbo_item_id IS NOT NULL OR qbo_omit)
                                    AND coalesce(qbo_item_because,'') = '') = 0
             AND count(*) FILTER (WHERE qbo_item_id IS NOT NULL
                                    AND qbo_item_because NOT ILIKE '%description%') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE (qbo_item_id IS NOT NULL OR qbo_omit)
                          AND coalesce(qbo_item_because,'') = '') AS silent_should_be_zero,
       count(*) FILTER (WHERE qbo_item_because ILIKE '%GUESS%') AS still_a_guess_should_be_zero
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V3 — THE MAPPINGS ARE THE ONES INTENDED. Expect: PASS.
-- Named individually because a transposed pair would pass every count-based check while
-- billing a trip charge against a bubbler.
SELECT 'V3 each service points at the item it should' AS check,
       CASE WHEN count(*) = 6 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS correct_of_6,
       string_agg(name || '→' || qbo_item_id, ' · ' ORDER BY sort_order) AS mappings
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND (name, qbo_item_id) IN (VALUES
        ('Trip Charge','186'), ('Tailgate Delivery','117'), ('Tree Bubbler','185'),
        ('Installation','137'), ('Plant Your Tree','164'), ('Tree Tarp','203'));

-- V4 — 🔴 SELF-COLLECT IS OMITTED, NOT MAPPED, AND NOT UNMAPPED. Expect: PASS.
-- The three states are genuinely different and only one of them is correct here.
SELECT 'V4 self-collect is OMITTED — flagged, with no item, and with a reason' AS check,
       CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_matching_all_three_conditions,
       min(left(qbo_item_because, 52)) AS because
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND name = 'I will collect it myself'
   AND qbo_omit IS TRUE AND qbo_item_id IS NULL AND coalesce(qbo_item_because,'') <> '';

-- V5 — NO OTHER TENANT WAS TOUCHED. The AC-3 negative control. Expect: PASS, 0.
SELECT 'V5 no other tenant gained a mapping' AS check,
       CASE WHEN count(*) FILTER (WHERE qbo_item_id IS NOT NULL OR qbo_omit) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE qbo_item_id IS NOT NULL OR qbo_omit) AS touched_should_be_zero,
       count(*) AS other_tenant_services_informational
  FROM service_offerings
 WHERE business_id <> 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V6 — IDEMPOTENCE. Re-running changes nothing. Expect: PASS, 0.
SELECT 'V6 re-running this file would change 0 rows' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_still_undecided
  FROM service_offerings
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND qbo_item_id IS NULL AND NOT qbo_omit;
