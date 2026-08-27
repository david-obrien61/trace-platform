-- ════════════════════════════════════════════════════════════════════════════════
-- 20260827 — HISTORY ORDERS: a captured invoice becomes an order, without becoming a SALE EVENT
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres. ADDITIVE ONLY — every column is NULLABLE with NO DEFAULT, so not one
-- existing row is rewritten and no constraint added here can reject a row that exists today.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────────
-- LAWNS went live 26 Aug 2026 and scanned six customer invoices. Each produced a customer and a
-- delivery and NO ORDER, so `orders` held zero rows for the tenant and the dashboard reported 0
-- installs against five real ones and $0 against $14,370.21 of captured sales.
--
-- David's ruling on storage: a captured sale is a HISTORY ORDER — a DISTINCT KIND. It is already
-- paid, already in LAWNS's own QuickBooks, and the stock left the farm before Cultivar existed.
-- A history order NEVER pushes to QuickBooks and NEVER moves inventory.
--
-- ── 🔴 THE LANDMINE THIS SCHEMA IS SHAPED AROUND (D-52 / inventoryStates.ts:82-109) ──
-- COMMITTED STOCK IS DERIVED, NOT STORED. `available = on-hand − committed`, and `committed` is a
-- live join order_items → orders summing quantity for every order in an OPEN status. So an order
-- row inserted as pending/confirmed carrying a `business_inventory_id` SILENTLY REDUCES WHAT LAWNS
-- CAN SELL — no decrement, no ledger row, nothing to reverse and nothing to notice.
--
-- The schema cannot enforce the escape, so it is recorded here and enforced by the writers:
--   (1) `business_inventory_id` STAYS NULL on every history line — the derivation `continue`s on a
--       null lot (:99), and NULL is also the HONEST value: these are document SKUs transcribed off
--       a piece of paper, not lots this platform ever held.
--   (2) status = 'fulfilled' — holdsCommitment() is false only for 'fulfilled' and 'cancelled',
--       and 'fulfilled' is semantically true: the plants left the property before we existed.
-- BOTH, not either. ⚠️ Do NOT reach for 'invoiced' as a third escape: it is live on 12 rows, is
-- written ONLY by the QBO push (cultivar.ts:717), and is ABSENT from ORDER_STATUSES — it starts
-- counting as open the day that enum is ratified (R-STATUS, orderStatus.ts:7-8).
--
-- ── WHAT IS DELIBERATELY *NOT* HERE ──────────────────────────────────────────────
-- No CHECK on `order_kind`. The vocabulary is young and R-STATUS is an open ruling; a CHECK minted
-- today is a constraint we would be editing next month, and §6 r1 makes migrations append-only.
-- The writers own the vocabulary; this column stores it.
--
-- No DEFAULT on `order_kind`. NULL means "an ordinary checkout order" and every one of the 34
-- existing rows is exactly that (submit.ts:866 is the only INSERT into this table). Stamping them
-- 'checkout' by default would be ASSERTING a fact about rows this migration never read — the
-- assertion happens to be true, which is precisely why it is tempting and why it is still a
-- rewrite of meaning rather than an addition of one (A9 / D-9).

BEGIN;

-- ── orders ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  -- The discriminator. No such column existed: `transport_method` is HOW GOODS MOVE, and `notes`
  -- is already load-bearing (it holds the Cultivar invoice number CLV-{YYYYMMDD}-{seq}, minted at
  -- submit.ts:829, read back at cultivar.ts:641). NULL = ordinary checkout order. 'history' = a
  -- sale transcribed off a document that predates this platform.
  ADD COLUMN IF NOT EXISTS order_kind text,

  -- The number printed on the SOURCE DOCUMENT — for a history order that is LAWNS's own QuickBooks
  -- number (e.g. '3648.629'). 🔴 TWO NUMBERING SCHEMES NOW COEXIST IN THIS TABLE AND THE RULE IS:
  -- ours lives in `notes`, theirs lives here. A history order NEVER gets a minted CLV number —
  -- inventing one would assert that Cultivar issued an invoice it did not issue.
  ADD COLUMN IF NOT EXISTS source_document_number text,

  -- QuickBooks' own human-readable invoice number (DocNumber). The push has ALWAYS had this value
  -- in hand — cultivar.ts:710 captures it, :723 returns it, the confirmation screen renders it
  -- once, and nothing ever persisted it. Distinct from `qb_invoice_id`, which is QB's INTERNAL
  -- txn id (the ?txnId= in the URL) and is not the number a customer sees on their invoice.
  ADD COLUMN IF NOT EXISTS qb_doc_number text,

  -- WHEN THE SALE ACTUALLY HAPPENED, off the source document — NOT when the row was created.
  -- This is what the dashboard keys on. Without it, six invoices backfilled on one afternoon
  -- report as that afternoon's revenue, and a confidently wrong number is worse than a zero.
  ADD COLUMN IF NOT EXISTS sale_date date,

  -- 🔴 THE POINT OF THE MIGRATION (with deliveries.order_id below). Receipt and delivery are
  -- written a second apart by one function and share NO key, so the only way to pair them was a
  -- heuristic on the OCR'd customer name inside `ocr_raw` — which dies on a duplicate name and
  -- dies entirely on the Claude OCR fallback (ocr.ts:292 discards rawText). This replaces it with
  -- a real key. SET NULL rather than RESTRICT, matching the three FKs that already point at
  -- `receipts` (business_inventory, cost_objects, business_service_log) — §6 r10, follow the
  -- established platform pattern rather than mint a stricter one here.
  ADD COLUMN IF NOT EXISTS receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL;

-- ── order_items ──────────────────────────────────────────────────────────────────
-- The OCR line carries sku, quantity, unit_price, amount AND description. Four of those had
-- columns; description and sku did not, so a transcribed line would have had to drop them or
-- smuggle them into a blob. David's call: they land in real columns.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sku text;

-- ── deliveries ───────────────────────────────────────────────────────────────────
-- The other half of the key. Matches deliveries.customer_id's ON DELETE SET NULL: a delivery is a
-- physical event that stays true even if the paperwork behind it is removed.
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

-- ── indexes ──────────────────────────────────────────────────────────────────────
-- sale_date: the dashboard's "today's sales" window filters on it on every load.
-- delivery_date: "installs this week" gains a bounded range scan (it had NO end bound at all).
-- the two FK columns: Postgres does NOT auto-index the referencing side, and both are join keys.
CREATE INDEX IF NOT EXISTS idx_orders_sale_date        ON public.orders (business_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_orders_receipt_id       ON public.orders (receipt_id)   WHERE receipt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_kind             ON public.orders (business_id, order_kind) WHERE order_kind IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id     ON public.deliveries (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_date_service ON public.deliveries (business_id, delivery_date, service_type);

COMMENT ON COLUMN public.orders.order_kind IS
  'Order origin. NULL = ordinary checkout order (submit.ts). ''history'' = a sale transcribed off a captured source document that predates this platform: NEVER pushes to QuickBooks (gated at cultivar.ts), NEVER moves inventory (business_inventory_id stays NULL on its lines and status is ''fulfilled'', so the D-52 committed-stock derivation cannot see it).';
COMMENT ON COLUMN public.orders.source_document_number IS
  'The invoice/receipt number printed on the SOURCE document — for a history order, the seller''s own QuickBooks number. Cultivar''s own minted number lives in `notes` (CLV-YYYYMMDD-seq). Two schemes, two columns, never mixed.';
COMMENT ON COLUMN public.orders.qb_doc_number IS
  'QuickBooks'' human-readable invoice number (DocNumber), persisted by the push. Distinct from qb_invoice_id, which is QB''s internal transaction id.';
COMMENT ON COLUMN public.orders.sale_date IS
  'When the sale actually happened, per the source document. The dashboard keys on this, NOT created_at — otherwise a backfill reports as today''s revenue.';
COMMENT ON COLUMN public.order_items.sku IS
  'Item code as transcribed from the source document. Free text: it is the SELLER''s code on a piece of paper, not a key into business_inventory.';

COMMIT;
