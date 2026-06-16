-- ============================================================
-- Migration: cost_objects — D-5 substantiation axis (Option 2)
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-06-15
--
-- Adds the SECOND D-5 axis. The table already carries cost_confidence
-- (amountConfidence — "how sure of the $ figure"). This adds:
--   substantiation — independent axis: "is there a receipt/document, or
--                    typed-from-memory" (SUBSTANTIATED | OWNER_ASSERTED).
--   receipt_id     — the count-once dedup seam join (mirrors the proven
--                    business_inventory / business_service_log seam).
--
-- CODE-MATCHED, not invented:
--   • Substantiation union  → packages/shared/src/business-logic/CountOnceSeam.ts:78
--       export type Substantiation = 'SUBSTANTIATED' | 'OWNER_ASSERTED';
--   • Independent reads      → fromCostObject (CountOnceSeam.ts:598-607):
--       substantiation: row.substantiation ?? 'OWNER_ASSERTED'  (default = no proof)
--       receiptId:      row.receipt_id ?? null                  (separate signal)
--   • receipt_id seam pattern → 20260612_business_assets_inventory_cost_confidence.sql:56-57
--       uuid REFERENCES receipts(id) ON DELETE SET NULL
--   Option 3 (substantiated_at / substantiated_by / document_url) DEFERRED as
--   honest-debt — no writer in code today; would be an always-null pile (same
--   anti-pattern 20260615 deferred for budget_estimate et al.).
--
-- PRE-WRITE LIVE STATE (service-key catalog probe, 2026-06-15 — PROVEN not asserted):
--   business_assets        → GONE (PGRST205)        ← Core-1 rename already applied
--   cost_objects           → present + node fields  ← Core-1 already applied; do NOT re-apply rename
--   cost_objects.substantiation → ABSENT (42703)    ← this migration adds it
--   cost_objects.receipt_id     → ABSENT (42703)    ← this migration adds it
--   receipts               → present                ← FK target exists
--   table row count        → 0                      ← NOT NULL DEFAULT add is instant, no backfill
--
-- ⚠️  APPLY to the live DB (Supabase SQL editor OR Management API). After
--     applying, run the catalog proof (independent schema-verification gate —
--     hits the live catalog, NOT the builder's memory):
--         SUPABASE_PAT=sbp_xxx node scripts/verify-cost-objects.mjs
-- ============================================================

BEGIN;

ALTER TABLE cost_objects
  -- Axis 2 (D-5). Independent of cost_confidence. NOT NULL DEFAULT 'OWNER_ASSERTED'
  -- encodes the code default `row.substantiation ?? 'OWNER_ASSERTED'` — no proof
  -- claimed unless stated — and mirrors the table's own node_type NOT NULL DEFAULT.
  ADD COLUMN substantiation text NOT NULL DEFAULT 'OWNER_ASSERTED'
    CHECK (substantiation IN ('SUBSTANTIATED','OWNER_ASSERTED')),
  -- Count-once dedup seam join. uuid FK → receipts, ON DELETE SET NULL (losing the
  -- receipt must not destroy the cost record). Byte-for-byte the inventory/service_log
  -- seam; serializes to the `string | null` the matcher reads.
  ADD COLUMN receipt_id uuid REFERENCES receipts(id) ON DELETE SET NULL;

COMMENT ON COLUMN cost_objects.substantiation IS
  'D-5 axis 2 (independent of cost_confidence): SUBSTANTIATED (has a receipt/document) | OWNER_ASSERTED (typed, no proof). The seam COUNTS owner-asserted cost (true cost is not under-stated) but flags it at-risk. Default OWNER_ASSERTED — no proof claimed unless stated. Mirrors Substantiation type, CountOnceSeam.ts:78.';
COMMENT ON COLUMN cost_objects.receipt_id IS
  'Count-once dedup seam (Cost-to-Produce design): links a cost node to the receipt that documents it. ONE high-confidence signal sameCost() uses for container rules (same receipt+amount -> MERGE; different receipt -> DISTINCT). ON DELETE SET NULL. Mirrors business_inventory.receipt_id / business_service_log.receipt_id.';

COMMIT;

-- ============================================================
-- SCHEMA-VERIFICATION GATE — run AFTER applying (live catalog, NOT memory).
-- ============================================================
-- (G) substantiation column — type / nullability / default / CHECK:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='cost_objects'
--      AND column_name IN ('substantiation','receipt_id') ORDER BY column_name;
--   Expect: substantiation text, is_nullable=NO, default 'OWNER_ASSERTED';
--           receipt_id uuid, is_nullable=YES, no default.
--
-- (H) substantiation CHECK enumerates exactly the two values:
--   SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
--    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_substantiation_check';
--   Expect: CHECK (substantiation = ANY (ARRAY['SUBSTANTIATED','OWNER_ASSERTED'])).
--
-- (I) receipt_id FK → receipts with ON DELETE SET NULL:
--   SELECT tc.constraint_name, ccu.table_name AS refs, rc.delete_rule
--     FROM information_schema.table_constraints tc
--     JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
--     JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
--     JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name
--    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name='cost_objects'
--      AND kcu.column_name='receipt_id';
--   Expect: refs=receipts, delete_rule=SET NULL.
-- ============================================================
