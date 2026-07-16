-- ############################################################################################
-- ##  ⛔ DO NOT APPLY — THIS FILE IS STALE AS OF 2026-07-16 (ledger #135). DO NOT RUN IT.   ##
-- ##                                                                                        ##
-- ##  It was written against a catalog of 118 rows. David's catalog is at 123, and its row  ##
-- ##  count moved EIGHT TIMES during the D-49 owner-prove. Its hard-coded ids no longer     ##
-- ##  describe the data, and its SCOPE has grown: the remediation now owes the four orphan  ##
-- ##  pairs PLUS Acoma's CASE-5 twin (DISC-1002 / DISC-1002-15G, same group same size) PLUS ##
-- ##  the compounded DISC-1003-30G-45G — none of which existed when this was written.       ##
-- ##                                                                                        ##
-- ##  Applying a hard-coded-id DELETE against a moving catalog is the exact scar this file  ##
-- ##  was careful to avoid in its own guards. It gets REGENERATED against a SETTLED catalog ##
-- ##  AFTER the ledger-#135 fixes are owner-proven — not before. The code fix is what stops ##
-- ##  new damage; this file only ever repaired old damage, and the old damage has changed.  ##
-- ##                                                                                        ##
-- ##  Kept, not deleted: its guard structure (G1-G5) and its ORDERING lesson (repoint       ##
-- ##  inventory_counts BEFORE the fold — the FK is ON DELETE SET NULL, so deleting first    ##
-- ##  silently orphans the count record rather than erroring) are the template the          ##
-- ##  regenerated version should be built from.                                             ##
-- ############################################################################################
--
-- ============================================================================================
-- D-49 DATA REMEDIATION — fold the four orphan children back into their variety parents
--
-- WHAT HAPPENED (live, 2026-07-16): owner-proving the #55 apostrophe fix, David counted the four
-- possessive varieties. Each RESOLVED to its scraped parent at L4 — and then the promote CREATED a
-- second row beside it, because the parent's size was NULL and the count's match predicate is
-- (variety × size). Inventory climbed 114 → 118. The re-scan of each slug then returned UNKNOWN:
-- two token-equal rows, one grouped + one not, one sized + one not → detectSizeCollision correctly
-- refuses to guess. Counting a variety made it permanently unscannable.
--
-- THE CODE FIX (D-49, shipped with this file) stops it happening again: a count on a variety STUB
-- fills the stub in place. This file repairs the four rows already broken.
--
-- WHY FOLD INTO THE PARENT (not delete the count, not keep both):
--   The PARENT is the row worth keeping — it carries the DISC-#### SKU, the scrape lineage
--   (notes/description/source URL) and its 2026-06-26 populate timestamp. The CHILD carries only
--   the size + qty David just counted, and no SKU. So: move the count ONTO the parent, then remove
--   the child. Nothing David counted is lost — the numbers move, the row they live on changes.
--
-- ORDER IS LOAD-BEARING. inventory_counts.inventory_id is ON DELETE SET NULL: delete the child
-- first and the count-history row silently loses its subject — no error, just an orphan. So the
-- repoint happens BEFORE the delete, inside one transaction.
--
-- SAFETY:
--   • ONE transaction. Any guard failing → RAISE EXCEPTION → the whole thing rolls back.
--   • Every value is COPIED FROM THE CHILD ROW, never retyped from a prompt. If the live size/qty
--     differ from what anyone wrote down, this script still moves the truth.
--   • Guards abort on: wrong row count, an unexpected order_items reference, a parent that is not
--     a stub, a child that is not the count-created sibling, or a cross-tenant id.
--   • This is DATA remediation, NOT a schema migration — no DDL, nothing to append to migrations/.
--
-- SCOPE — deliberately small. The 103 scraped stubs and 5 ungrouped rows measured today are NOT
-- broken and get NO SQL: the code fix makes their first count correct. Do not remediate them.
--
-- APPLY AS: postgres (Supabase SQL editor). GATED — David applies + verifies, THEN Thunder commits.
-- EXPECTED: 119 → 115 rows; each of the four = ONE row carrying its SKU **and** its count.
-- ============================================================================================

\set BIZ 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- PART 0 — PRE-FLIGHT (READ-ONLY). Run this ALONE first and read it. Change nothing yet.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- (0a) The eight rows. Expect 4 parents (qty 0, size NULL, group NULL, DISC- sku) and
--      4 children (qty>0, sized, grouped, sku NULL). NOTE the `status` column: a scrape flags
--      some rows 'review'. The fold does NOT change status (it mirrors the code's fill branch
--      exactly) — so if a parent reads 'review' here, it will still read 'review' after, and
--      that is a separate pre-existing condition, not something this script silently "fixes".
SELECT id, sku, name, qty, size, variant_group, sell_price, unit_cost, status, created_at
  FROM public.business_inventory
 WHERE business_id = :'BIZ'::uuid
   AND id IN ('91be4388-6932-4aba-b859-c4f95ed76dfd','e92aedb2-0c79-4957-8556-c5c70019139a',
              '970aa781-49ae-4184-afe7-15268d7a3138','6b2a0c2a-2fef-40af-826a-a00bd9500da9',
              '076a20a1-f1b9-40bd-9de8-7580468d586f','39935907-1732-4032-9183-bca7c5f24455',
              '518dd451-faf7-4214-837e-a46afd3785d8','17a3867b-69eb-4a1a-b2b5-08a017f9e0c7')
 ORDER BY name, created_at;

-- (0b) Every reference to any of the eight. order_items MUST be zero (these were never sold —
--      prove it, don't assume). inventory_counts should show the 4 rows David's counts wrote.
SELECT 'order_items' AS tbl, count(*) FROM public.order_items
 WHERE business_inventory_id IN ('91be4388-6932-4aba-b859-c4f95ed76dfd','e92aedb2-0c79-4957-8556-c5c70019139a',
       '970aa781-49ae-4184-afe7-15268d7a3138','6b2a0c2a-2fef-40af-826a-a00bd9500da9',
       '076a20a1-f1b9-40bd-9de8-7580468d586f','39935907-1732-4032-9183-bca7c5f24455',
       '518dd451-faf7-4214-837e-a46afd3785d8','17a3867b-69eb-4a1a-b2b5-08a017f9e0c7')
UNION ALL
SELECT 'cultivar_plants', count(*) FROM public.cultivar_plants
 WHERE inventory_id IN ('91be4388-6932-4aba-b859-c4f95ed76dfd','e92aedb2-0c79-4957-8556-c5c70019139a',
       '970aa781-49ae-4184-afe7-15268d7a3138','6b2a0c2a-2fef-40af-826a-a00bd9500da9',
       '076a20a1-f1b9-40bd-9de8-7580468d586f','39935907-1732-4032-9183-bca7c5f24455',
       '518dd451-faf7-4214-837e-a46afd3785d8','17a3867b-69eb-4a1a-b2b5-08a017f9e0c7')
UNION ALL
SELECT 'inventory_counts', count(*) FROM public.inventory_counts
 WHERE inventory_id IN ('91be4388-6932-4aba-b859-c4f95ed76dfd','e92aedb2-0c79-4957-8556-c5c70019139a',
       '970aa781-49ae-4184-afe7-15268d7a3138','6b2a0c2a-2fef-40af-826a-a00bd9500da9',
       '076a20a1-f1b9-40bd-9de8-7580468d586f','39935907-1732-4032-9183-bca7c5f24455',
       '518dd451-faf7-4214-837e-a46afd3785d8','17a3867b-69eb-4a1a-b2b5-08a017f9e0c7');

-- (0c) The row count BEFORE. Read it from the catalog — do not trust any number written down
--      (the prompt said 111 and it was 116; then 114 and it was 119).
SELECT count(*) AS rows_before FROM public.business_inventory WHERE business_id = :'BIZ'::uuid;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- PART 1 — THE FOLD (WRITES). One transaction. Run after PART 0 reads clean.
-- ════════════════════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE d49_pairs (parent uuid, child uuid, variety text) ON COMMIT DROP;
INSERT INTO d49_pairs (parent, child, variety) VALUES
  ('91be4388-6932-4aba-b859-c4f95ed76dfd','e92aedb2-0c79-4957-8556-c5c70019139a', 'Basham''s Party Pink Crape Myrtle'),
  ('970aa781-49ae-4184-afe7-15268d7a3138','6b2a0c2a-2fef-40af-826a-a00bd9500da9', 'Evey''s Pride Mimosa'),
  ('076a20a1-f1b9-40bd-9de8-7580468d586f','39935907-1732-4032-9183-bca7c5f24455', 'Summer''s Tower Redbud'),
  ('518dd451-faf7-4214-837e-a46afd3785d8','17a3867b-69eb-4a1a-b2b5-08a017f9e0c7', 'Hearts A''fire Redbud');

-- ── GUARDS — every one of these aborts the whole transaction ────────────────────────────────
DO $$
DECLARE n int; bad text;
BEGIN
  -- G1: all 8 rows exist AND belong to this tenant (AC-3 — never touch another tenant's row).
  SELECT count(*) INTO n FROM public.business_inventory bi
   WHERE bi.business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'::uuid
     AND (bi.id IN (SELECT parent FROM d49_pairs) OR bi.id IN (SELECT child FROM d49_pairs));
  IF n <> 8 THEN
    RAISE EXCEPTION 'G1 ABORT: expected 8 rows for this tenant, found %. Re-read PART 0 — the data moved.', n;
  END IF;

  -- G2: NOTHING was ever sold from either row. The FK is ON DELETE SET NULL, so a delete would
  --     silently blank an order line rather than error. Never trust "they were never sold" —
  --     prove it here, where proving it is free.
  SELECT count(*) INTO n FROM public.order_items
   WHERE business_inventory_id IN (SELECT parent FROM d49_pairs UNION SELECT child FROM d49_pairs);
  IF n <> 0 THEN
    RAISE EXCEPTION 'G2 ABORT: % order_items reference these rows. STOP — folding would rewrite sales history. Surface to David.', n;
  END IF;

  -- G3: every PARENT is still a genuine stub (qty 0, no size, no group). If one is not, the
  --     world changed since the read and the fold's premise is void.
  SELECT string_agg(bi.id::text || ' (' || bi.name || ')', ', ') INTO bad
    FROM public.business_inventory bi JOIN d49_pairs p ON p.parent = bi.id
   WHERE NOT (coalesce(bi.qty,0) = 0
              AND coalesce(btrim(bi.size),'') = ''
              AND coalesce(btrim(bi.variant_group),'') = '');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'G3 ABORT: parent(s) no longer a variety stub: %. Do not fold.', bad;
  END IF;

  -- G4: every CHILD is the count-created sibling (sized, grouped, no SKU). Guards against
  --     folding a row someone hand-made and gave a real SKU to.
  SELECT string_agg(bi.id::text || ' (' || bi.name || ')', ', ') INTO bad
    FROM public.business_inventory bi JOIN d49_pairs p ON p.child = bi.id
   WHERE NOT (coalesce(btrim(bi.size),'') <> ''
              AND coalesce(btrim(bi.variant_group),'') <> ''
              AND coalesce(btrim(bi.sku),'') = '');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'G4 ABORT: child row(s) are not the count-created sibling: %. Do not fold.', bad;
  END IF;

  -- G5: parent and child are genuinely the same variety (name equality, case/space-insensitive).
  SELECT string_agg(p.variety, ', ') INTO bad FROM d49_pairs p
    JOIN public.business_inventory a ON a.id = p.parent
    JOIN public.business_inventory b ON b.id = p.child
   WHERE lower(btrim(a.name)) <> lower(btrim(b.name));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'G5 ABORT: parent/child name mismatch for: %. These are not the same variety.', bad;
  END IF;

  RAISE NOTICE 'D-49 guards G1-G5 passed — 8 rows, 0 sales, 4 stub parents, 4 count children, names agree.';
END $$;

-- ── STEP 1: REPOINT the count history child → parent. MUST precede the delete (ON DELETE SET
--            NULL would otherwise silently orphan the record of the count David just did).
WITH moved AS (
  UPDATE public.inventory_counts ic
     SET inventory_id = p.parent
    FROM d49_pairs p
   WHERE ic.inventory_id = p.child
   RETURNING ic.id
)
SELECT count(*) AS count_records_repointed FROM moved;

-- ── STEP 2: FOLD — the parent takes the child's size/qty/variant_group. Values are COPIED FROM
--            THE CHILD ROW, never retyped. Mirrors the code's `fill` branch exactly (qty, size,
--            variant_group — status deliberately untouched, see PART 0a).
WITH folded AS (
  UPDATE public.business_inventory par
     SET qty           = ch.qty,
         size          = ch.size,
         variant_group = ch.variant_group
    FROM d49_pairs p
    JOIN public.business_inventory ch ON ch.id = p.child
   WHERE par.id = p.parent
     AND par.business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'::uuid
   RETURNING par.id, par.sku, par.name, par.qty, par.size, par.variant_group
)
SELECT * FROM folded ORDER BY name;

-- ── STEP 3: DELETE the now-redundant children. Safe: the count history was repointed in STEP 1
--            and G2 proved nothing was ever sold from them.
WITH removed AS (
  DELETE FROM public.business_inventory bi
   USING d49_pairs p
   WHERE bi.id = p.child
     AND bi.business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'::uuid
   RETURNING bi.id
)
SELECT count(*) AS children_deleted FROM removed;   -- expect 4

-- ── FINAL GUARD: no count record was orphaned by the delete. If this fires, ROLLBACK.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.inventory_counts ic
   WHERE ic.business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'::uuid
     AND ic.inventory_id IS NULL
     AND ic.item_label ILIKE ANY (ARRAY['%Basham%','%Evey%','%Summer''s Tower%','%Hearts A%']);
  IF n > 0 THEN
    RAISE EXCEPTION 'ABORT: % count record(s) orphaned (inventory_id NULL). The repoint missed them — rolling back.', n;
  END IF;
END $$;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- PART 2 — CATALOG VERIFY (READ-ONLY). Run after PART 1. All five must read as stated.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- (A) Each variety is now ONE row carrying BOTH its SKU and its count. Expect exactly 4 rows:
--     DISC-1009 / 30 gal / 25 · DISC-1070 / 5 gal / 42 · DISC-1099 / 15 gal / 38 · DISC-1091 / 45 gal / 39
SELECT sku, name, qty, size, variant_group, status
  FROM public.business_inventory
 WHERE business_id = :'BIZ'::uuid
   AND sku IN ('DISC-1009','DISC-1070','DISC-1099','DISC-1091')
 ORDER BY name;

-- (B) The children are gone. Expect 0.
SELECT count(*) AS orphan_children_remaining
  FROM public.business_inventory
 WHERE id IN ('e92aedb2-0c79-4957-8556-c5c70019139a','6b2a0c2a-2fef-40af-826a-a00bd9500da9',
              '39935907-1732-4032-9183-bca7c5f24455','17a3867b-69eb-4a1a-b2b5-08a017f9e0c7');

-- (C) No same-name family remains for these four (that duplication IS the UNKNOWN). Expect 0 rows.
SELECT lower(btrim(name)) AS variety, count(*) AS rows
  FROM public.business_inventory
 WHERE business_id = :'BIZ'::uuid
   AND lower(btrim(name)) IN (lower('Basham''s Party Pink Crape Myrtle'), lower('Evey''s Pride Mimosa'),
                              lower('Summer''s Tower Redbud'), lower('Hearts A''fire Redbud'))
 GROUP BY 1 HAVING count(*) > 1;

-- (D) Every count record still points at a real row — David's counts survived the fold. Expect 0.
SELECT count(*) AS counts_orphaned
  FROM public.inventory_counts
 WHERE business_id = :'BIZ'::uuid AND inventory_id IS NULL
   AND item_label ILIKE ANY (ARRAY['%Basham%','%Evey%','%Summer''s Tower%','%Hearts A%']);

-- (E) The row count AFTER. Expect rows_before − 4 (119 → 115 if the before-read was 119).
--     Compare against (0c)'s number — trust the catalog, not the arithmetic written here.
SELECT count(*) AS rows_after FROM public.business_inventory WHERE business_id = :'BIZ'::uuid;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ┌────────────────────────────────────────────────────────────────────────────────────────┐
-- │ PART 3 — OPTIONAL, INDEPENDENT: SKU lineage backfill for the two REAL size-siblings.    │
-- │ FENCED FROM THE FOLD ON PURPOSE. Apply it or skip it; PART 1 does not depend on it and  │
-- │ it does not depend on PART 1. Nothing breaks if you never run it.                       │
-- └────────────────────────────────────────────────────────────────────────────────────────┘
--
-- WHO THESE ARE — AND WHY THEY ARE **NOT** FOLDED: 'Sierra' Mexican Red Oak (30 gal) and Arizona
-- Cypress Blue Ice (30) were minted by the SAME count-promote CREATE (their sku NULL is that
-- path's fingerprint) — but they are GENUINE SECOND SIZES under parents that already carried a
-- variant_group. They work: the picker fires on both today. They are real lots, not orphans.
-- **DO NOT FOLD THEM.** They lack only the SKU lineage that D-46's deriveSiblingSku gives a
-- sibling (#127) — the count path never called it until this build.
--
-- Matched BY PREDICATE (variant_group + size + sku IS NULL), not by id, because their ids were
-- not in the live read — the predicate is exact for these two and matches nothing else.
-- Suffixes are what the shipped skuSizeSuffix() produces: '30 gal' → 30G, '30' → 30G.
--
-- Uncomment and run to apply:
--
-- BEGIN;
-- WITH backfilled AS (
--   UPDATE public.business_inventory bi
--      SET sku = CASE bi.variant_group
--                  WHEN 'sierra-mexican-red-oak'    THEN 'DISC-1001-30G'
--                  WHEN 'arizona-cypress-blue-ice'  THEN 'DISC-1005-30G'
--                END
--    WHERE bi.business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'::uuid
--      AND bi.variant_group IN ('sierra-mexican-red-oak','arizona-cypress-blue-ice')
--      AND coalesce(btrim(bi.sku),'') = ''            -- only the sku-less sibling, never the parent
--      AND btrim(bi.size) IN ('30 gal','30')
--    RETURNING bi.id, bi.name, bi.size, bi.sku
-- )
-- SELECT * FROM backfilled;                            -- expect 2 rows
-- -- Guard: the derived SKUs must not already exist elsewhere (never a silent duplicate).
-- DO $$
-- DECLARE n int;
-- BEGIN
--   SELECT count(*) INTO n FROM public.business_inventory
--    WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'::uuid
--      AND sku IN ('DISC-1001-30G','DISC-1005-30G');
--   IF n <> 2 THEN RAISE EXCEPTION 'ABORT: expected exactly 2 rows to carry the derived SKUs, found %.', n; END IF;
-- END $$;
-- COMMIT;
--
-- VERIFY (read-only): each family = the base SKU + one derived sibling; the picker still fires.
-- SELECT variant_group, sku, size, qty FROM public.business_inventory
--  WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'::uuid
--    AND variant_group IN ('sierra-mexican-red-oak','arizona-cypress-blue-ice')
--  ORDER BY variant_group, size;
-- ============================================================================================
