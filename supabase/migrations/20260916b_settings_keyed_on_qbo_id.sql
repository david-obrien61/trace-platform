-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 NOT APPLIED — RETIRED IN PLACE 2026-09-24. DO NOT APPLY.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- Superseded in part by David's 2026-09-21 ONE-COLUMN ruling: `order_items.qbo_item_id`, meaning
-- "the QuickBooks item this line is for", written from the invoice on captured lines and from the
-- lot on live lines. **`lot_qb_item_id` must NOT be created as well** — and this file adds it to
-- both `order_items` and `inventory_counts`, so as written it contradicts the ruling.
--
-- The OTHER half — `customer_qb_id` on `orders`, `deliveries` and `customer_addresses` — is
-- PENDING David's ruling. It is neither approved nor abandoned.
--
-- MEASURED LIVE 2026-09-24: none of the five columns this file adds exists on any of those tables.
-- The file is in the corpus, on `main`, and not in the database — which is why every guard that
-- derives a column list from the corpus disagreed with production until this marker existed.
--
-- Retired in place following tech-debt #248's precedent (David, 2026-09-11): a migration that will
-- not run is MARKED, not deleted, so apply-state checks stop reporting it beside migrations that
-- genuinely wait. **COMMENT ONLY — no SQL below this header is touched** (§6 r1).
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- DRAFT — NOT FOR APPLY
-- 20260916b — RECORDS THAT MUST SURVIVE A WIPE-AND-RELOAD, KEYED ON THE QUICKBOOKS ID · ledger #342
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 HELD BY DAVID'S INSTRUCTION. The first statement below RAISES, so pasting this file into the SQL
--    editor changes nothing. It is here to be read and ruled on, not run. When it is ruled, the
--    guard is removed in a NEW, dated migration — this file stays a draft (§6 r1).
--
-- ── DAVID'S RULING ③ (2026-09-16) ───────────────────────────────────────────────────────────
-- *"Settings and records that must survive a wipe-and-reload are keyed on the QuickBooks Id, not
-- internal row ids."*
--
-- ── WHAT THE RELOAD SURVEY (ledger #342 §1i) FOUND AT RISK — AND ONLY THAT ──────────────────
-- An undo deletes business_inventory and customers rows by run. The live FK set (discovery 10a)
-- and the corpus give the population that points at them:
--   AT RISK (a live record holds an INTERNAL id of an imported row):
--     orders.customer_id               RESTRICT (live-only FK)  — CAPTURED ORDERS: the first case
--     deliveries.customer_id           SET NULL                 — Lauren's stops
--     customer_addresses.customer_id   RESTRICT, NOT NULL       — saved ship-tos
--     order_items.business_inventory_id SET NULL                — live lines (captured lines are NULL)
--     inventory_counts.inventory_id    SET NULL                 — real counts
--     production_plan_lines.{source,target}_inventory_id RESTRICT
--     business_inventory_ledger.inventory_id  (undeletable — the undo refuses; not re-keyable,
--                                              the table is append-only)
--     audit_log.target_id / detail->>customer_id  (text, append-only — history, left as written)
--   NOT AT RISK (hold names, codes or their own keys — no imported row id):
--     service_offerings · business_pricing_config (tiers and discount types by NAME) ·
--     customers.price_tier (a NAME, on the row itself) · vendor_preferences · vendor_aliases ·
--     container_ladder.aliases · order_service_selections · receipts · cost_objects.
--   So this draft touches no settings table. "Settings" survive a reload today by construction.
--
-- ── THE SHAPE: A SNAPSHOT OF THE QUICKBOOKS ID BESIDE EVERY AT-RISK INTERNAL ID ──────────────
-- The internal FK stays (joins, RLS and every reader keep working). Beside it, the QuickBooks Id
-- of the row it pointed at, captured at write time and backfilled once. On reload, a record whose
-- FK went NULL is re-attached by matching that id to the NEW run's row. The QuickBooks Id is the
-- identity both importers already rely on: unique per tenant (20260906c:74-78).
--
-- ── WHAT THE IMPORTERS MUST CHANGE (per table) ──────────────────────────────────────────────
--   orders (captured)  — customerImportWriter: after inserting a run's customers, call
--       reattach_by_qbo_id(business, run) (§4). The undo must stop REFUSING on a captured order
--       and instead DETACH it: orders_customer_id_fkey RESTRICT → SET NULL (§3). Every WRITER of
--       orders.customer_id must also write customer_qb_id (submit.ts, customers/create.ts,
--       historyOrderWriter.ts) — or a trigger does it (§2, chosen here so no writer can forget).
--       ⚠️ customerImportWriter.existingQbIds() SKIPS any qb id the tenant still holds. An
--       ALTERNATIVE to this whole file: the undo KEEPS a live-referenced customer (releases it from
--       the run instead of deleting it) and the reload re-uses it by that skip. No schema change,
--       no re-attach — but the wipe is no longer a wipe. David's call.
--   deliveries        — the same trigger + reattach; the undo's live-stop refusal becomes a detach.
--   customer_addresses— customer_id is NOT NULL and RESTRICT: it cannot be detached. Either the
--       column becomes nullable with SET NULL (§3, drafted), or the keep-and-reuse alternative.
--   order_items / inventory_counts / production_plan_lines — itemImportWriter ALWAYS INSERTS and
--       retires the rest; with `business_inventory_business_qb_item_uidx` a kept row would COLLIDE
--       with the reload's insert. So the item importer must either (a) re-attach after insert
--       (this file), or (b) match-and-update by qb_item_id instead of insert-and-retire.
--       production_plan_lines is RESTRICT and NOT NULL on source: same choice as addresses.
-- ════════════════════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  RAISE EXCEPTION '20260916b is a DRAFT — NOT FOR APPLY (ledger #342). Nothing was changed.';
END $$;

BEGIN;

-- ── §1 the snapshot columns ──────────────────────────────────────────────────────────────────
ALTER TABLE public.orders             ADD COLUMN IF NOT EXISTS customer_qb_id text;
ALTER TABLE public.deliveries         ADD COLUMN IF NOT EXISTS customer_qb_id text;
ALTER TABLE public.customer_addresses ADD COLUMN IF NOT EXISTS customer_qb_id text;
ALTER TABLE public.order_items        ADD COLUMN IF NOT EXISTS lot_qb_item_id text;
ALTER TABLE public.inventory_counts   ADD COLUMN IF NOT EXISTS lot_qb_item_id text;

UPDATE public.orders o SET customer_qb_id = c.qb_customer_id
  FROM public.customers c WHERE c.id = o.customer_id AND o.customer_qb_id IS NULL AND c.qb_customer_id IS NOT NULL;
UPDATE public.deliveries d SET customer_qb_id = c.qb_customer_id
  FROM public.customers c WHERE c.id = d.customer_id AND d.customer_qb_id IS NULL AND c.qb_customer_id IS NOT NULL;
UPDATE public.customer_addresses a SET customer_qb_id = c.qb_customer_id
  FROM public.customers c WHERE c.id = a.customer_id AND a.customer_qb_id IS NULL AND c.qb_customer_id IS NOT NULL;
UPDATE public.order_items i SET lot_qb_item_id = b.qb_item_id
  FROM public.business_inventory b WHERE b.id = i.business_inventory_id AND i.lot_qb_item_id IS NULL AND b.qb_item_id IS NOT NULL;
UPDATE public.inventory_counts k SET lot_qb_item_id = b.qb_item_id
  FROM public.business_inventory b WHERE b.id = k.inventory_id AND k.lot_qb_item_id IS NULL AND b.qb_item_id IS NOT NULL;

-- ── §2 keep the snapshot current at write time (no writer can forget) ────────────────────────
CREATE OR REPLACE FUNCTION public.snapshot_customer_qb_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    NEW.customer_qb_id := (SELECT qb_customer_id FROM public.customers WHERE id = NEW.customer_id);
  END IF;   -- a NULL customer (a detach) KEEPS the snapshot: that is what re-attaches it
  RETURN NEW;
END $$;
CREATE TRIGGER orders_customer_qb_id     BEFORE INSERT OR UPDATE OF customer_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_customer_qb_id();
CREATE TRIGGER deliveries_customer_qb_id BEFORE INSERT OR UPDATE OF customer_id ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_customer_qb_id();
CREATE TRIGGER addresses_customer_qb_id  BEFORE INSERT OR UPDATE OF customer_id ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_customer_qb_id();
-- (the two lot snapshots take the same shape against business_inventory.qb_item_id — elided in the draft)

-- ── §3 detach instead of refuse (THE DECISION THIS FILE ASKS FOR) ────────────────────────────
-- ALTER TABLE public.orders DROP CONSTRAINT orders_customer_id_fkey,
--   ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
-- ALTER TABLE public.customer_addresses ALTER COLUMN customer_id DROP NOT NULL,
--   DROP CONSTRAINT customer_addresses_customer_id_fkey,
--   ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
-- …and undo_import_run (20260916c) stops counting these as refusals.

-- ── §4 re-attach after a reload ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reattach_by_qbo_id(p_business_id uuid, p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_o int; v_d int; v_a int; v_i int; v_k int;
BEGIN
  WITH u AS (UPDATE public.orders o SET customer_id = c.id FROM public.customers c
              WHERE o.business_id = p_business_id AND o.customer_id IS NULL AND o.customer_qb_id IS NOT NULL
                AND c.business_id = p_business_id AND c.import_run_id = p_run_id AND c.qb_customer_id = o.customer_qb_id
             RETURNING 1) SELECT count(*) INTO v_o FROM u;
  WITH u AS (UPDATE public.deliveries d SET customer_id = c.id FROM public.customers c
              WHERE d.business_id = p_business_id AND d.customer_id IS NULL AND d.customer_qb_id IS NOT NULL
                AND c.business_id = p_business_id AND c.import_run_id = p_run_id AND c.qb_customer_id = d.customer_qb_id
             RETURNING 1) SELECT count(*) INTO v_d FROM u;
  WITH u AS (UPDATE public.customer_addresses a SET customer_id = c.id FROM public.customers c
              WHERE a.business_id = p_business_id AND a.customer_id IS NULL AND a.customer_qb_id IS NOT NULL
                AND c.business_id = p_business_id AND c.import_run_id = p_run_id AND c.qb_customer_id = a.customer_qb_id
             RETURNING 1) SELECT count(*) INTO v_a FROM u;
  WITH u AS (UPDATE public.order_items i SET business_inventory_id = b.id FROM public.business_inventory b, public.orders o
              WHERE o.id = i.order_id AND o.business_id = p_business_id
                AND i.business_inventory_id IS NULL AND i.lot_qb_item_id IS NOT NULL
                AND b.business_id = p_business_id AND b.import_run_id = p_run_id AND b.qb_item_id = i.lot_qb_item_id
             RETURNING 1) SELECT count(*) INTO v_i FROM u;
  WITH u AS (UPDATE public.inventory_counts k SET inventory_id = b.id FROM public.business_inventory b
              WHERE k.business_id = p_business_id
                AND k.inventory_id IS NULL AND k.lot_qb_item_id IS NOT NULL
                AND b.business_id = p_business_id AND b.import_run_id = p_run_id AND b.qb_item_id = k.lot_qb_item_id
             RETURNING 1) SELECT count(*) INTO v_k FROM u;
  RETURN jsonb_build_object('orders', v_o, 'deliveries', v_d, 'customer_addresses', v_a,
                            'order_items', v_i, 'inventory_counts', v_k);
END $$;
REVOKE ALL ON FUNCTION public.reattach_by_qbo_id(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reattach_by_qbo_id(uuid, uuid) TO service_role;

COMMIT;
