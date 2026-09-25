-- ─────────────────────────────────────────────────────────────────────────────
-- 20260925c_transport_pairing_and_service_rows.sql          ·  ledger #408
--
-- 🔴 WHAT DAVID SAW AT THE COUNTER ON 2026-09-25, AND WHY NO PRICE CHANGE COULD HAVE FIXED IT.
--   Checkout offered **"Trip Charge + installation"** AND **"Tailgate Delivery + installation"**.
--   `transport.ts` builds the branches by `price_type`: every staff `flat` row becomes "a
--   delivery", the single staff `per_unit` row becomes "planting", and it pairs them —
--   **so it offered installation with EVERY delivery, because nothing in the data said which
--   one installation belongs to.** David's ruling of 2026-09-18 is that TC pairs with install;
--   tailgate and backyard never do. **That fact had no home. This migration gives it one.**
--
-- ── THE FOUR COLUMNS ─────────────────────────────────────────────────────────
--
--   ① `service_offerings.offers_installation`
--      🔴 THE PAIRING, DECLARED IN DATA AND NEVER INFERRED (David, 2026-09-25). It sits on the
--      DELIVERY row, not on installation, and that direction is deliberate: a business may one
--      day offer install with a second delivery kind, and then it is one more `true` rather than
--      a code change. Inference by `price_type` is what produced the defect.
--
--   ② `service_offerings.amount_required_at_sale`
--      For BACKYARD: *"tailgate fee + an amount set at the point of sale, with a required
--      reason"* (David, 2026-09-12, restated 2026-09-25). TRUE means the counter must state the
--      amount before the order can go — the row's `price` is the floor it starts from, never the
--      answer. ⚠️ Distinct from Trip Charge, which has a real default ($50) and MAY be changed.
--
--   ③ `service_offerings.quantity_editable`
--      For TREE TARP, and it is the column the old contradiction needed. David, 2026-09-25:
--      *"PER ORDER, with a quantity a person sets — the human needs to identify if 1 or more due
--      to loading."* A `flat`/`order` row normally means quantity 1 and nothing to decide; this
--      says the quantity is a human's call. 🔴 **NEVER the plant count** — the whole point is
--      that tarps are about the LOAD, not the trees.
--
--   ④ `order_service_selections.line_rows`
--      🔴 FOR PLANT YOUR TREE, AND IT IS THE FIX FOR A DEFECT I SHIPPED. Ledger #404 made PYT
--      price from the install ladder — but from the rung of the plant IN THE CART, because PYT
--      had nothing of its own to read. David tested it and it charged the 15 gal price of a Flip
--      Side Vitex for planting trees that were already in his yard. **PYT is for trees ALREADY
--      ON SITE that LAWNS never delivered** (David, 2026-09-17), so it needs its OWN rows of
--      size × quantity — `[{"size":"30 gal","qty":2},{"size":"45 gal","qty":1}]` — each priced
--      from the ladder for ITS size, never from the purchase.
--      ⚠️ ON THE SELECTION ROW RATHER THAN A NEW TABLE: one service on one order is already
--      exactly one row here, and these rows have no life of their own — no id anything cites, no
--      lifecycle, no history. A table would buy nothing and add a join to every read.
--      ⚠️ A row whose size is unknown is legal and carries no price: *"size to be confirmed on
--      install day"* (David, 2026-09-24), amended later.
--
-- ⚠️ THIS MIGRATION SETS NO VALUES. Every column arrives at its neutral default on every
--   tenant; LAWNS's own figures are a DATA file David runs (CLAUDE.md §4). A migration never
--   carries one tenant's business decisions. V5 asserts that afterwards.
--
-- ⚠️ **Rule 29 (pending filing)** — crew-link files it tonight; every figure these columns
--   govern is editable in Settings, which is what r29 will say.
--
-- ADDITIVE AND IDEMPOTENT throughout.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE service_offerings
  ADD COLUMN IF NOT EXISTS offers_installation      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS amount_required_at_sale  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantity_editable        boolean NOT NULL DEFAULT false;

ALTER TABLE order_service_selections
  ADD COLUMN IF NOT EXISTS line_rows jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN service_offerings.offers_installation IS
  'TRUE = choosing this transport also offers installation. DECLARED, never inferred: inferring it from price_type is what made checkout offer installation with every delivery (David, 2026-09-25). On LAWNS only Trip Charge is true.';
COMMENT ON COLUMN service_offerings.amount_required_at_sale IS
  'TRUE = the counter must state the amount before the order can go; `price` is the floor, not the answer. Backyard Delivery is the case: the tailgate fee plus an amount set at the point of sale, with a reason.';
COMMENT ON COLUMN service_offerings.quantity_editable IS
  'TRUE = a per-order row whose QUANTITY is a human''s call, not 1 and not the plant count. Tree Tarp is the case: tarps are about the load, not the trees (David, 2026-09-25).';
COMMENT ON COLUMN order_service_selections.line_rows IS
  'Size x quantity rows this service is charged for, INDEPENDENT of the cart: [{"size":"30 gal","qty":2}]. Plant Your Tree is the case — trees already on site that LAWNS never delivered, so the purchase''s size must never price it. A row with no size is legal and unpriced: confirmed on install day.';

-- ── THE NAMED CHECKS (tech-debt #91 — an inline CHECK is auto-named and unfindable) ──────────
-- 🔴 ONLY A TRANSPORT ROW MAY OFFER INSTALLATION. An addon that claimed to would put
-- installation on a branch that does not deliver anything.
ALTER TABLE service_offerings
  DROP CONSTRAINT IF EXISTS service_offerings_installation_pairs_transport_check;
ALTER TABLE service_offerings
  ADD CONSTRAINT service_offerings_installation_pairs_transport_check
  CHECK (NOT offers_installation OR category = 'transport');

-- 🔴 `line_rows` IS AN ARRAY OR IT IS NOTHING. A jsonb object here would read as one row to
-- some callers and as none to others, which is the shape that makes a total quietly wrong.
ALTER TABLE order_service_selections
  DROP CONSTRAINT IF EXISTS order_service_selections_line_rows_is_array_check;
ALTER TABLE order_service_selections
  ADD CONSTRAINT order_service_selections_line_rows_is_array_check
  CHECK (jsonb_typeof(line_rows) = 'array');

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style, self-contained, every one runs AS-IS (§6 r26).
-- 🔴 NOT ONE PINS A ROW COUNT. Live figures print in columns carrying no verdict.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — THE FOUR COLUMNS, WITH THE RIGHT DEFAULTS. Expect: PASS, 4.
-- Every one is NOT NULL with a NEUTRAL default, so an existing row's behaviour cannot change
-- by the act of adding the column — which is the only safe way to add a behaviour flag.
SELECT 'V1 the four columns exist, NOT NULL, defaulting to neutral' AS check,
       CASE WHEN count(*) = 4 AND bool_and(is_nullable = 'NO' AND column_default IS NOT NULL)
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS columns_found,
       string_agg(table_name || '.' || column_name || ' = ' || column_default, ' · ' ORDER BY column_name) AS shape
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND ((table_name = 'service_offerings'
         AND column_name IN ('offers_installation','amount_required_at_sale','quantity_editable'))
     OR (table_name = 'order_service_selections' AND column_name = 'line_rows'));

-- V2 — BOTH NAMED CHECKS EXIST AND ARE FINDABLE BY NAME. Expect: PASS, 2.
SELECT 'V2 both named CHECKs exist' AS check,
       CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS constraints_found,
       string_agg(conname, ' · ' ORDER BY conname) AS names
  FROM pg_constraint
 WHERE conname IN ('service_offerings_installation_pairs_transport_check',
                   'order_service_selections_line_rows_is_array_check');

-- V3 — 🔴 RUN THIS ONE ALONE. AN ERROR IS THE PASS.
-- An ADDON claiming to offer installation. Expect: ERROR 23514, naming
-- service_offerings_installation_pairs_transport_check.
UPDATE service_offerings SET offers_installation = true
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND category = 'addon';

-- V4 — 🔴 RUN THIS ONE ALONE TOO. AN ERROR IS THE PASS.
-- `line_rows` given an object instead of an array. Expect: ERROR 23514, naming
-- order_service_selections_line_rows_is_array_check.
UPDATE order_service_selections SET line_rows = '{"size":"30 gal"}'::jsonb
 WHERE id = (SELECT id FROM order_service_selections LIMIT 1);

-- V5 — 🔴 THE MIGRATION CHANGED NO BEHAVIOUR ANYWHERE. Expect: PASS, 0 / 0 / 0 / 0.
-- The negative control, and the reason it matters: these are BEHAVIOUR flags. One set true by
-- the migration would change what checkout offers on a tenant nobody asked.
SELECT 'V5 no tenant gained a behaviour by this migration' AS check,
       CASE WHEN count(*) FILTER (WHERE offers_installation) = 0
             AND count(*) FILTER (WHERE amount_required_at_sale) = 0
             AND count(*) FILTER (WHERE quantity_editable) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE offers_installation)     AS offers_install_should_be_zero,
       count(*) FILTER (WHERE amount_required_at_sale) AS amount_required_should_be_zero,
       count(*) FILTER (WHERE quantity_editable)       AS qty_editable_should_be_zero,
       count(*) AS service_rows_informational,
       count(DISTINCT business_id) AS tenants_informational
  FROM service_offerings;

-- V6 — EVERY EXISTING SELECTION GOT AN EMPTY ARRAY, NOT NULL AND NOT AN OBJECT. Expect: PASS, 0.
SELECT 'V6 every existing order selection carries an empty array' AS check,
       CASE WHEN count(*) FILTER (WHERE line_rows IS NULL
                                     OR jsonb_typeof(line_rows) <> 'array') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE line_rows IS NULL
                          OR jsonb_typeof(line_rows) <> 'array') AS wrong_shape_should_be_zero,
       count(*) FILTER (WHERE line_rows <> '[]'::jsonb) AS non_empty_should_be_zero,
       count(*) AS selections_informational
  FROM order_service_selections;

-- V7 — THE EXISTING SERVICE COLUMNS ARE UNTOUCHED. The blast-radius control, as an invariant.
SELECT 'V7 every service still has its name, category and price source' AS check,
       CASE WHEN count(*) FILTER (WHERE coalesce(name,'') = ''
                                     OR coalesce(category,'') = ''
                                     OR coalesce(price_source,'') = '') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE coalesce(name,'') = '') AS nameless_should_be_zero,
       count(*) AS rows_informational
  FROM service_offerings;
