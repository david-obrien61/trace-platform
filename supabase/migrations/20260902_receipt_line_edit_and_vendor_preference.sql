-- supabase/migrations/20260902_receipt_line_edit_and_vendor_preference.sql
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-09-02
-- Branch: thunder/receipt-detail-view
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- ⚠️  APPLY NOTE FOR DAVID: run in the Supabase SQL editor as the default `postgres` role.
--   Both functions must be OWNED BY postgres + SECURITY DEFINER — the same load-bearing
--   ownership rule as is_active_member / has_permission / reject_audit_log_mutation.
--
-- PREREQ (must already be live):
--   • 20260612_receipts.sql · 20260613_receipts_add_line_items.sql · 20260614_receipts_reconciliation.sql
--   • 20260623_audit_log_spine.sql   (this migration INSERTs into audit_log)
--   • 20260622_is_active_member_canonical_rls.sql   (is_active_member / has_permission)
--
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT THIS IS, AND THE MEASUREMENT THAT MADE IT NECESSARY
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- /receipts/:id lets the OWNER correct a line the OCR misread. Three things had to be true
-- before an editable line was safe, and none of them was:
--
--  (1) 🔴 EDITING WAS NOT OWNER-ONLY, AND STILL IS NOT AT THE POLICY LAYER. `receipts_member_all`
--      (the dual FOR-ALL policy) was DROPPED 2026-07-27 by 20260727_rbac_resource_action_flip.sql
--      and replaced with four per-command policies; UPDATE is `receipts_member_update`, gated on
--      **`costs:update`** — NOT `costs:read`. MEASURED 2026-09-02 against the live tenant: a
--      MANAGER on `Test Dave's Tree Nest` holds all four `costs:*` verbs, so that manager may
--      UPDATE any receipt row in that business today. Owner-only had to be ENFORCED, not assumed.
--
--  (2) 🔴 `line_items_original` HAD NOTHING PROTECTING IT. Its own migration says "Set once from
--      OCR output; never updated after the row is written" (20260614:31-38) — a sentence in a
--      comment, which is not a guard. It is the record of what the MACHINE read; overwrite it and
--      the evidence the whole surface rests on is gone, irrecoverably.
--
--  (3) 🔴 A CLIENT-SIDE `.update()` PLUS A SEPARATE CLIENT-SIDE AUDIT INSERT CAN HALF-LAND. Two
--      statements, no transaction: the edit persists and the audit row does not, and an audit
--      trail with a hole in it is worse than none because it reads as complete. permissionManifest
--      already rules that audit rows are written "inside the funnel/RPCs as a side effect of an
--      audited action" and that `audit_log:create` is NOT a grantable verb — this honours it.
--
-- THE SHAPE: one SECURITY DEFINER RPC does the owner check, the write, the SERVER-AUTHORITATIVE
-- reconcile recompute and the audit append in ONE transaction; and one BEFORE UPDATE trigger
-- enforces the same two rules against EVERY path, including a direct PostgREST update that never
-- goes near the RPC. Defence in depth, exactly as audit_log's own immutability is done three ways.
--
-- AC-1 (no vertical noun) · AC-2 (business_id-scoped) · AC-3 (tenant isolation absolute).


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- §1 · THE GUARD — enforced against every path, not only the sanctioned one
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WHY A TRIGGER AND NOT A POLICY: RLS grants or denies a whole ROW; it cannot say "this
-- member may change `vendor` but not `line_items`". The requirement is per-COLUMN, so the guard
-- has to be a trigger. This is the same conclusion 20260823's cost-wall ruling reached from the
-- other direction (column GRANTs cannot distinguish an owner from a manager in this stack,
-- because every signed-in user connects as the single role `authenticated`).
CREATE OR REPLACE FUNCTION public.guard_receipt_snapshot_and_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_owner boolean;
BEGIN
  -- (a) THE OCR SNAPSHOT IS IMMUTABLE FOR EVERYONE. Not owner-only — NOBODY, including the
  --     owner, including this migration's own RPC (which never names these columns). What the
  --     machine read is not editable by the party whose edits it exists to be compared against.
  IF NEW.line_items_original IS DISTINCT FROM OLD.line_items_original THEN
    RAISE EXCEPTION 'receipts.line_items_original is write-once: it is the record of what the OCR read'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.amount_original IS DISTINCT FROM OLD.amount_original THEN
    RAISE EXCEPTION 'receipts.amount_original is write-once: it is the record of what the OCR read'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- (b) CHANGING THE LINES IS OWNER-ONLY. The line items are the cost model's input; correcting
  --     one changes what a tree cost. `auth.uid()` resolves inside a SECURITY DEFINER function
  --     (it reads the request JWT, not the session role), so this holds for the RPC too — the
  --     RPC's own check is a second, earlier, better-worded refusal, not the only one.
  IF NEW.line_items IS DISTINCT FROM OLD.line_items THEN
    SELECT EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = OLD.business_id AND owner_id = auth.uid()
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
      RAISE EXCEPTION 'only the business owner may change receipt line items'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receipts_snapshot_and_line_guard ON public.receipts;
CREATE TRIGGER trg_receipts_snapshot_and_line_guard
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.guard_receipt_snapshot_and_lines();


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- §2 · THE EDIT — owner check + write + recompute + audit, in ONE transaction
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- THE RECONCILE THRESHOLDS ARE THE CLIENT'S, RESTATED HERE BECAUSE THE SERVER IS AUTHORITATIVE
-- (§1.6 item 10 — a mutation touching money recomputes server-side as tamper defence). They
-- mirror `computeReconcile` in packages/cultivar-os/src/utils/receiptReconciliation.ts exactly:
--   match      : |delta| <= 0.02          (rounding noise)
--   small_gap  : |delta| < 5.00  OR  |delta| / total < 0.10
--   otherwise  : a large mismatch
-- ⚠️ TWO COPIES OF ONE RULE IS STD-011 AND IT IS ACCEPTED HERE WITH A STATED REASON: the client
-- copy renders a live readout as the owner types, the server copy is what gets STORED, and a
-- round trip per keystroke is not a UI. `receiptDetail.test.ts` §T asserts the two agree on a
-- shared table of cases, so the duplication is watched rather than merely admitted.
--
-- 🔴 THE STORED VOCABULARY HAS NO PLAIN `large_mismatch`. The CHECK constraint admits only
-- 'match' | 'small_gap' | 'large_mismatch_overridden' (20260614:47-48), and the third value
-- asserts something specific: the owner WAS SHOWN the conflict and saved anyway. So this
-- function REFUSES a large mismatch unless the caller passes p_acknowledged_mismatch — the
-- stored value stays true rather than becoming the only value that fits.
CREATE OR REPLACE FUNCTION public.edit_receipt_line_items(
  p_receipt_id            uuid,
  p_line_items            jsonb,
  p_acknowledged_mismatch boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_receipt      public.receipts%ROWTYPE;
  v_actor        uuid := auth.uid();
  v_is_owner     boolean;
  v_line         jsonb;
  v_idx          int := 0;
  v_sum          numeric(12,2) := 0;
  v_any_no_amt   boolean := false;
  v_total        numeric(10,2);
  v_delta        numeric(10,2);
  v_abs          numeric(10,2);
  v_status       text;
  v_overridden   timestamptz;
  v_changes      jsonb := '[]'::jsonb;
  v_old_line     jsonb;
  v_field        text;
  v_old_v        jsonb;
  v_new_v        jsonb;
BEGIN
  -- ── the row, tenant-scoped by its own business_id (AC-3) ──────────────────────────────────
  SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'receipt not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- ── OWNER ONLY. Not a manager, not staff, and not "a member holding costs:update" ─────────
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = v_receipt.business_id AND owner_id = v_actor
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    -- The refusal is itself an audited event: a denied attempt on a money surface is exactly
    -- what audit_log's A4 index exists to make countable (once vs repeated).
    INSERT INTO public.audit_log (business_id, actor_user_id, action, target_type, target_id, detail, outcome)
    VALUES (v_receipt.business_id, v_actor, 'receipt.line_edit_denied', 'receipt', p_receipt_id::text,
            jsonb_build_object('reason', 'not_business_owner'), 'denied');
    RAISE EXCEPTION 'only the business owner may edit receipt line items'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── shape validation. A malformed payload is refused, never coerced ───────────────────────
  IF p_line_items IS NULL OR jsonb_typeof(p_line_items) <> 'array' THEN
    RAISE EXCEPTION 'line items must be a json array' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_line_items) LOOP
    IF jsonb_typeof(v_line) <> 'object' THEN
      RAISE EXCEPTION 'line % is not an object', v_idx USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- A description is required; quantity, unit_price and sku may legitimately be absent.
    -- 🔴 A BLANK IS AN ANSWER (David's ruling): a unit nobody knows stays unknown rather than
    -- being invented, and the arithmetic below reports incomplete rather than guessing.
    IF COALESCE(btrim(v_line->>'description'), '') = '' THEN
      RAISE EXCEPTION 'line % has no description', v_idx USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF v_line->>'amount' IS NULL OR btrim(v_line->>'amount') = '' THEN
      v_any_no_amt := true;
    ELSE
      BEGIN
        v_sum := v_sum + (v_line->>'amount')::numeric;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'line % has an unreadable amount', v_idx USING ERRCODE = 'invalid_parameter_value';
      END;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  -- ── SERVER-AUTHORITATIVE RECONCILE ────────────────────────────────────────────────────────
  v_total := v_receipt.amount;

  IF v_idx = 0 THEN
    -- no lines: the column stores NULL for this, exactly as the capture path does
    v_status := NULL; v_delta := NULL;
  ELSIF v_any_no_amt OR v_total IS NULL THEN
    -- 🔴 INCOMPLETE, NOT ZERO. A line with no amount makes the sum unassertable; storing a
    -- verdict computed as though the blank were $0.00 would be a fabricated measurement
    -- (D-9 — the same class as rendering a withheld figure as 0).
    v_status := NULL; v_delta := NULL;
  ELSE
    v_delta := v_sum - v_total;
    v_abs   := abs(v_delta);
    IF v_abs <= 0.02 THEN
      v_status := 'match';
    ELSIF v_abs < 5.00 OR (v_total > 0 AND (v_abs / v_total) < 0.10) THEN
      v_status := 'small_gap';
    ELSE
      IF NOT p_acknowledged_mismatch THEN
        RAISE EXCEPTION 'edit leaves lines % against a total of % — a gap of %; re-send with acknowledgement to save anyway',
          v_sum, v_total, v_abs
          USING ERRCODE = 'check_violation';
      END IF;
      v_status     := 'large_mismatch_overridden';
      v_overridden := now();
    END IF;
  END IF;

  -- ── the per-line diff, built BEFORE the write ─────────────────────────────────────────────
  -- WHO · WHEN · WHICH FIELD · FROM WHAT TO WHAT · ON WHICH RECEIPT. Descriptions and money are
  -- the substance of the change and are recorded; nothing else about a person is (the migration's
  -- "no casual PII" clause — no email, no phone, no address is touched by this path at all).
  FOR v_idx IN 0 .. GREATEST(
        jsonb_array_length(p_line_items),
        COALESCE(jsonb_array_length(v_receipt.line_items), 0)
      ) - 1 LOOP
    v_old_line := COALESCE(v_receipt.line_items, '[]'::jsonb) -> v_idx;
    v_line     := p_line_items -> v_idx;

    FOREACH v_field IN ARRAY ARRAY['description','amount','quantity','unit_price','sku'] LOOP
      v_old_v := CASE WHEN v_old_line IS NULL THEN NULL ELSE v_old_line -> v_field END;
      v_new_v := CASE WHEN v_line     IS NULL THEN NULL ELSE v_line     -> v_field END;
      IF v_old_v IS DISTINCT FROM v_new_v THEN
        v_changes := v_changes || jsonb_build_object(
          'line',  v_idx,
          'field', v_field,
          'from',  v_old_v,
          'to',    v_new_v
        );
      END IF;
    END LOOP;
  END LOOP;

  -- ── the write. `line_items_original` and `amount_original` are NOT NAMED HERE, and the
  --    trigger above would refuse them if they were ────────────────────────────────────────
  UPDATE public.receipts
     SET line_items              = p_line_items,
         reconcile_status        = v_status,
         reconcile_delta         = v_delta,
         reconcile_overridden_at = COALESCE(v_overridden, reconcile_overridden_at),
         updated_at              = now()
   WHERE id = p_receipt_id;

  -- ── the audit row, in the SAME transaction as the write it describes ──────────────────────
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (
    v_receipt.business_id, v_actor, 'OWNER',
    'receipt.line_items_edited', 'receipt', p_receipt_id::text,
    jsonb_build_object(
      'changes',           v_changes,
      'change_count',      jsonb_array_length(v_changes),
      'line_count_before', COALESCE(jsonb_array_length(v_receipt.line_items), 0),
      'line_count_after',  jsonb_array_length(p_line_items),
      'reconcile_before',  v_receipt.reconcile_status,
      'reconcile_after',   v_status,
      'delta_after',       v_delta
    ),
    'success'
  );

  RETURN jsonb_build_object(
    'reconcile_status', v_status,
    'reconcile_delta',  v_delta,
    'line_sum',         CASE WHEN v_status IS NULL THEN NULL ELSE v_sum END,
    'total',            v_total,
    'change_count',     jsonb_array_length(v_changes)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.edit_receipt_line_items(uuid, jsonb, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.edit_receipt_line_items(uuid, jsonb, boolean) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- §3 · THE VENDOR UNIT ANSWER — asked once, per vendor, re-pointable later
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- David's ruling (Option C, 2026-09-02): a per-VENDOR preference carrying a `preferred` flag and
-- a `preference_note`. NOT a per-product matrix.
--
-- 🔴 THE ANSWER DELIBERATELY DOES NOT LAND IN `unit_kind` / `unit_value` / `unit_name`. Those are
-- a SYSTEM-MANAGED PROJECTION of `business_inventory.size` (20260830, ruling R-27) — derived on
-- every write, never independently editable, registered in systemManagedFields.ts. A human's
-- answer about how a VENDOR bills is a different fact about a different subject, and writing it
-- into a projection would make that projection a second truth, which R-27 exists to forbid.
--
-- ⚠️ `unit_kind`'s closed taxonomy (container|volume|weight|length|each, the NAMED
-- business_inventory_unit_kind_check) is NOT reused as a constraint here either: the vendor
-- question's answers are `yard` / `ton` / `load` / not-sure, and `hour` — which a vendor could
-- plausibly bill by — is not expressible in that taxonomy. Extending the enum is a separate
-- decision (David, 2026-09-02: "do not offer `hour`"), so this column takes NO CHECK rather than
-- borrowing a constraint that would have to be widened the first time the answer is `hour`.
--
-- ── HOW IT RE-POINTS AT A REAL VENDOR ROW LATER (asked for explicitly, answered explicitly) ──
-- 🔴 THERE IS NO DANGLING `vendor_id` COLUMN, AND THAT IS THE DESIGN, NOT AN OMISSION. Adding a
-- nullable FK that nothing populates is tech-debt #144's exact shape — `cost_objects.receipt_id`
-- is 0 of 5 and `business_inventory.receipt_id` is 0 of 447, three migrations describe them as
-- the join that prevents double-counting, and a seam nothing writes prevents nothing.
-- Instead the key is BOTH halves of what we actually have:
--   · `vendor_label` — the vendor string EXACTLY as stored on the receipt, never normalised away;
--   · `vendor_key`   — a deterministic fold of it (lower-cased, punctuation and corporate
--                      suffixes stripped) computed by ONE shared pure function, `vendorKey()`.
-- So "Sudderth Brothers Contracting, Inc." and "Sudderth Brothers" answer to the same key today,
-- and when a vendor table lands the re-point is a single UPDATE joining on `vendor_key` — which
-- is derivable from both sides — plus one added FK. Nothing has to be re-asked, and nothing is
-- carrying a column that nobody fills in the meantime.
CREATE TABLE IF NOT EXISTS vendor_preferences (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vendor_key       text        NOT NULL,           -- the deterministic fold; the join key
  vendor_label     text        NOT NULL,           -- the vendor string as it was stored, verbatim
  preference_kind  text        NOT NULL,           -- 'billing_unit' today; the axis grows by data (audit_log's precedent)
  preference_value text,                           -- 'yard' | 'ton' | 'load' | NULL when "not sure"
  preferred        boolean     NOT NULL DEFAULT true,
  preference_note  text,
  answered_by      uuid        REFERENCES auth.users(id),
  answered_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ASKED ONCE. The unique index is what makes that true structurally rather than by the UI
-- remembering to check — one answer per (tenant, vendor, question).
CREATE UNIQUE INDEX IF NOT EXISTS vendor_preferences_one_per_vendor_kind_uidx
  ON vendor_preferences (business_id, vendor_key, preference_kind);

COMMENT ON COLUMN vendor_preferences.preference_value IS
  'NULL is a real answer here ("not sure"), distinguished from "never asked" by the ROW existing. A caller must not read NULL as unanswered.';
COMMENT ON COLUMN vendor_preferences.vendor_key IS
  'Deterministic fold of vendor_label (vendorKey() in packages/cultivar-os/src/lib/vendorKey.ts). The join key a future vendor table re-points on; there is deliberately no nullable vendor_id FK (tech-debt #144).';

ALTER TABLE vendor_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_preferences_owner_all ON vendor_preferences
  FOR ALL TO authenticated
  USING      ( business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) )
  WITH CHECK ( business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) );

-- Reading the answer is what makes it useful on the NEXT invoice, so any member who can see the
-- receipt can see the answer. Writing it needs costs:update — the same verb that gates changing
-- a receipt, because this answer changes how a cost is read.
CREATE POLICY vendor_preferences_member_select ON vendor_preferences
  FOR SELECT TO authenticated
  USING ( public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:read') );

CREATE POLICY vendor_preferences_member_insert ON vendor_preferences
  FOR INSERT TO authenticated
  WITH CHECK ( public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update') );

CREATE POLICY vendor_preferences_member_update ON vendor_preferences
  FOR UPDATE TO authenticated
  USING      ( public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update') )
  WITH CHECK ( public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update') );

DROP TRIGGER IF EXISTS vendor_preferences_updated_at ON vendor_preferences;
CREATE TRIGGER vendor_preferences_updated_at
  BEFORE UPDATE ON vendor_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- CATALOG-VERIFICATION GATE (run AFTER apply — CLAUDE.md §9). Expected results in [brackets].
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- (A) both functions exist, are SECURITY DEFINER, owned by postgres:
--   SELECT proname, prosecdef, pg_get_userbyid(proowner) AS owner FROM pg_proc
--   WHERE proname IN ('edit_receipt_line_items','guard_receipt_snapshot_and_lines');
--   [2 rows, prosecdef = true, owner = postgres]
-- (B) the guard trigger is live on receipts and fires BEFORE UPDATE:
--   SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'receipts'::regclass
--   AND tgname = 'trg_receipts_snapshot_and_line_guard';   [1 row, tgenabled = 'O']
-- (C) vendor_preferences exists with RLS ON:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'vendor_preferences';   [true]
-- (D) its four policies + the ask-once unique index:
--   SELECT polname, polcmd FROM pg_policy WHERE polrelid='vendor_preferences'::regclass ORDER BY polname;
--   [vendor_preferences_member_insert 'a', _member_select 'r', _member_update 'w', _owner_all '*']
--   SELECT indexname FROM pg_indexes WHERE tablename='vendor_preferences';
--   [includes vendor_preferences_one_per_vendor_kind_uidx]
-- (E) 🔴 BEHAVIOURAL — the snapshot cannot be moved, BY ANYONE, including postgres (the trigger
--     raises regardless of role, exactly as audit_log's does):
--   UPDATE receipts SET line_items_original = '[]'::jsonb WHERE id = (SELECT id FROM receipts LIMIT 1);
--   [ERROR: receipts.line_items_original is write-once]
-- (F) 🔴 BEHAVIOURAL — a non-owner member cannot change the lines. Run in a session signed in as
--     the MANAGER on `Test Dave's Tree Nest` (the principal measured 2026-09-02 to hold all four
--     costs:* verbs — i.e. the one who WOULD get through if the guard were absent):
--   SELECT edit_receipt_line_items('<a receipt id in that business>', '[{"description":"x","amount":1}]'::jsonb);
--   [ERROR: only the business owner may edit receipt line items]   + one audit_log row,
--    action = 'receipt.line_edit_denied', outcome = 'denied'
--   ⚠️ A MANAGER WHO HOLDS NO `costs:*` PROVES NOTHING HERE — they would be refused by the read
--   before ever reaching the guard, and the test would pass on a deleted guard (R-33).
