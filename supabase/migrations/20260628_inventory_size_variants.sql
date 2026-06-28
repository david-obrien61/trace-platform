-- ── B-CLEAN SIZE VARIANTS on business_inventory ────────────────────────────────
-- Decision: docs/decisions/2026-06-27-discovery-size-variants.md · CLOSE-OUT-LEDGER #62
--
-- Size is part of COUNT IDENTITY — a nursery counts "Vitex 15gal: 20, Vitex 45gal: 45"
-- (same plant, different sizes, separate counts). The catalog model becomes ONE
-- business_inventory row per (variety × size); `variant_group` groups the sibling
-- sizes under one parent plant (the product slug), `size` holds the grower's own
-- published size value.
--
-- ⚠️ DAVID APPLIES AS postgres (project bgobkjcopcxusjsetfob). The schema-verification
--    gate (CLAUDE.md §9) runs AFTER apply — verify queries (A)-(C) embedded below.
--
-- Append-only + additive: two NULLABLE text columns, NO CHECK constraint. Size spans
-- systems across growers (container gallons / caliper inches / height) → keep it
-- TEXT and flexible; the value varies per grower, never a global enum (AC-1). The two
-- columns inherit business_inventory's existing owner/member RLS unchanged — no policy
-- change. Existing rows stay size NULL / variant_group NULL (they are parent rows; no
-- backfill required).

ALTER TABLE business_inventory
  ADD COLUMN IF NOT EXISTS size          text,
  ADD COLUMN IF NOT EXISTS variant_group text;

-- Helper index for the per-grower size list + sibling grouping reads
-- (e.g. SELECT DISTINCT size FROM business_inventory WHERE variant_group = $1).
CREATE INDEX IF NOT EXISTS business_inventory_variant_group_idx
  ON business_inventory (business_id, variant_group);

-- ── VERIFY (David runs after apply — catalog-backed, not from memory) ───────────────
-- (A) both columns exist, text, nullable:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'business_inventory' AND column_name IN ('size','variant_group')
--   ORDER BY column_name;
--   → 2 rows; data_type 'text'; is_nullable 'YES' for both.
--
-- (B) NO new CHECK constraint was added on them (flexible by design):
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'business_inventory'::regclass AND contype = 'c';
--   → no constraint referencing size / variant_group.
--
-- (C) grouping index present:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'business_inventory'
--     AND indexname = 'business_inventory_variant_group_idx';
--   → 1 row.
