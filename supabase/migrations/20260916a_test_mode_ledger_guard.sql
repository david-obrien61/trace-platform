-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260916a — IN TEST MODE, NOTHING REACHES THE STOCK LEDGER · ledger #344
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it TONIGHT, as `postgres`, in the SQL EDITOR (§6 r17).
--    STANDALONE: it depends on no unmerged branch and no other 20260916 file. Apply it on its own.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────────────────
-- David, 2026-09-16: *"you have to protect the customer from themselves; they don't know any
-- better and testing to them is testing"* — and ruling ②: *"we must never allow them to write to
-- the actual record during testing."* The code-level guards built so far (checkout orders, the
-- opening-stock seed) cover two writers. Lauren's desk delete of Lacey Oak 30 gallon on
-- 2026-09-16 at 20:27 UTC wrote a permanent `delete_tombstone` ledger row through a third.
--
-- ── WHAT IT DOES ────────────────────────────────────────────────────────────────────────────
-- ONE trigger on `business_inventory_ledger` itself: BEFORE INSERT, if the row's business has
-- `qbo_writes_enabled = false` — or the flag cannot be read — the row is DISCARDED (RETURN NULL).
--   · The calling statement SUCCEEDS. The qty / status change the person made still applies and
--     shows; only the permanent ledger line is not written.
--   · It covers every writer, present and future, including scripts under the service key,
--     because it sits on the table, not in any one function. The per-writer guards (orders, seed)
--     stay as a second layer.
--   · The audit log is untouched: actions are still recorded.
--   · Writes ON: the row is written exactly as today.
--   · SECURITY DEFINER with a fixed search_path, so it reads `businesses.qbo_writes_enabled`
--     whatever the caller's RLS.
--
-- ── WHAT WAS CHECKED BEFORE WRITING IT (live, 2026-09-16) ────────────────────────────────────
-- 1. DATABASE WRITERS. The ONLY function that inserts into the ledger is
--    `emit_inventory_movement` (`INSERT … RETURNING id INTO v_id; RETURN v_id`). With the row
--    discarded, `RETURNING` yields no row and `v_id` is NULL — plain `INTO`, not `INTO STRICT`, so
--    it does NOT raise. Its eight callers — adjust_inventory_manual, adjust_inventory_qty,
--    count_promote_create_inventory, count_reconcile_inventory, discovery_create_inventory,
--    discovery_rescan_clear, record_order_event, soft_delete_inventory — only pass that id back
--    (soft_delete_inventory also puts it in its audit row's detail as `ledger_id`, which becomes
--    null). None of them checks it, none reads a ledger sum to set qty: each UPDATEs qty/status
--    directly. Nothing throws.
-- 2. APP / API WRITERS. No code inserts into the table directly. The callers of those functions
--    read only `applied`, `reason`, `new_qty`, `prior_qty`, `inventory_id` or `error`; the one
--    reader of the returned `ledger_id` (InventoryReconcile.tsx) only logs it.
-- 3. CAPTURE. OCR invoice capture (api/customers/create.ts), receipt OCR (api/receipts/ocr.ts),
--    the history-order writer and the receipt line editor write no ledger rows — unaffected.
-- 4. READERS. With no ledger rows for a test-mode lot: the reconcile screen treats the lot as
--    "no prior count" (its baseline mode); the count-conflict and seeded-lot flags stay empty; the
--    import undo finds no stock history, so it does not refuse. Nothing reads an absent row as
--    an error.
--
-- ⚠️ CONSEQUENCE, STATED: the day writes go on, every lot's qty stands with no ledger line behind
--    it. That is tech-debt #308 (an opening line at switch-on), unchanged by this file.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'businesses'
                    AND column_name = 'qbo_writes_enabled') THEN
    RAISE EXCEPTION 'REFUSED: businesses.qbo_writes_enabled does not exist. Nothing changed.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.discard_ledger_row_in_test_mode() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_writes boolean;
BEGIN
  BEGIN
    SELECT b.qbo_writes_enabled INTO v_writes
      FROM public.businesses b
     WHERE b.id = NEW.business_id;
  EXCEPTION WHEN OTHERS THEN
    v_writes := NULL;              -- could not read the flag → fail toward NOT writing
  END;
  IF v_writes IS TRUE THEN
    RETURN NEW;                    -- writes on: the ledger records as it always has
  END IF;
  RETURN NULL;                     -- test mode (or unknown): the row is discarded, silently
END;
$$;

COMMENT ON FUNCTION public.discard_ledger_row_in_test_mode() IS
  'Ledger #344: while a business has qbo_writes_enabled = false (or the flag cannot be read), a new '
  'business_inventory_ledger row is discarded. The calling statement still succeeds. David, 2026-09-16.';

DROP TRIGGER IF EXISTS trg_ledger_test_mode_guard ON public.business_inventory_ledger;
CREATE TRIGGER trg_ledger_test_mode_guard
  BEFORE INSERT ON public.business_inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION public.discard_ledger_row_in_test_mode();

DO $$
DECLARE n_test int; n_live int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT qbo_writes_enabled), count(*) FILTER (WHERE qbo_writes_enabled)
    INTO n_test, n_live FROM public.businesses;
  RAISE NOTICE 'LEDGER GUARD ON: % business(es) in test mode write no ledger rows; % with writes on are unchanged.',
    n_test, n_live;
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only in effect: V2 always rolls itself back.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the trigger exists and is enabled. EXPECT one row, tgenabled = O.
-- SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
--   FROM pg_trigger WHERE tgname = 'trg_ledger_test_mode_guard';
--
-- V2 · a ledger row for LAWNS (test mode) is NOT written. Run it whole. It ALWAYS ends with an
--      error on purpose — that error IS the result, and it undoes everything, so nothing is kept
--      even if the guard were missing.
--      EXPECT the message:  GUARD CHECK (nothing kept): LAWNS writes on = false · rows written = 0
-- DO $$
-- DECLARE n int; w boolean;
-- BEGIN
--   SELECT qbo_writes_enabled INTO w FROM public.businesses WHERE id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--   WITH ins AS (
--     INSERT INTO public.business_inventory_ledger (business_id, inventory_id, delta, kind, reason, source_type)
--     VALUES ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', NULL, 0, 'guard_probe', 'verify block — never kept', 'manual')
--     RETURNING 1)
--   SELECT count(*) INTO n FROM ins;
--   RAISE EXCEPTION 'GUARD CHECK (nothing kept): LAWNS writes on = % · rows written = %', w, n;
-- END $$;
--
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- TO SWITCH THE GUARD OFF IN AN EMERGENCY (ledger rows are then written again in test mode):
-- DROP TRIGGER IF EXISTS trg_ledger_test_mode_guard ON public.business_inventory_ledger;
-- ════════════════════════════════════════════════════════════════════════════════════════════
