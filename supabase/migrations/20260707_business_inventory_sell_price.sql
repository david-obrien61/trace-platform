-- ── SELL_PRICE on business_inventory (D-35) ────────────────────────────────────
-- Decision: docs/DECISIONS.md D-35 · spec docs/decisions/2026-07-07-inventory-sale-pipeline-buildspec.md item 1 · CLOSE-OUT M1
--
-- The variety×size stock line gets a stored `sell_price` — the retail price the
-- customer pays — DISTINCT from `unit_cost` (what the grower PAID, sourced from
-- receipts). The MarginEngine (unit_cost + margin + overhead) SUGGESTS a price, but
-- the STORED sell_price is authoritative and editable; the cart reads sell_price,
-- NEVER unit_cost (D-35). Industry standard: Shopify variant.price, Square
-- item_variation.price_money, WooCommerce _regular_price — price is a stored field
-- on the variant, not a computed value.
--
-- ⚠️ DAVID APPLIES AS postgres (project bgobkjcopcxusjsetfob). The schema-verification
--    gate (CLAUDE.md §9) runs AFTER apply — verify queries (A)-(B) embedded below.
--
-- Append-only + additive: ONE NULLABLE numeric column, NO default, NO CHECK. Nullable
-- by design — a row with no sell_price set is REFUSED at checkout (Surface Honesty,
-- D-9), never silently sold at 0. It inherits business_inventory's existing owner/member
-- RLS unchanged — no policy change. Existing rows stay sell_price NULL (unpriced until
-- the grower sets a price). DISTINCT from unit_cost — cost and price never conflate.

ALTER TABLE business_inventory
  ADD COLUMN IF NOT EXISTS sell_price numeric(10,2);

-- ── VERIFY (David runs after apply — catalog-backed, not from memory) ───────────────
-- (A) sell_price exists, numeric, nullable, DISTINCT from unit_cost (both present):
--   SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'business_inventory' AND column_name IN ('sell_price','unit_cost')
--   ORDER BY column_name;
--   → 2 rows; sell_price numeric(10,2), is_nullable 'YES'; unit_cost unchanged.
--
-- (B) NO new CHECK constraint was added on sell_price (nullable/flexible by design;
--     the $0/null refusal is enforced at checkout, not by the column):
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'business_inventory'::regclass AND contype = 'c';
--   → no constraint referencing sell_price.
