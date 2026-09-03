-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE CONSOLIDATION — `vendor_preferences` GETS A REAL KEY INSTEAD OF A FOLD
-- 2026-09-02 · R-65: "THE VENDOR STORE CONSOLIDATES INTO `vendors`. ONE STORE, NOT TWO."
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
--
-- APPLY ORDER (it matters, and the guard below enforces it rather than trusting it):
--   1. 20260902_vendor_identity_and_preference.sql        (creates `vendors`)
--   2. 20260902_receipt_line_edit_and_vendor_preference.sql (creates `vendor_preferences`)
--   3. THIS FILE
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
-- Two sessions built a per-vendor answer on 2026-09-02. R-65 ruled that `vendors` survives, and
-- named the obstacle precisely: the two sides FOLD VENDOR NAMES DIFFERENTLY, so "a backfill joining
-- on the fold drops or doubles whichever side disagrees." `vendor_preferences.vendor_key`'s own
-- comment anticipates this file: *"the join key a future vendor table re-points on."*
--
-- 🔴 THE FOLD DISAGREEMENT IS CLOSED, AND R-65'S EXAMPLE OF IT WAS BACKWARDS. Measured 2026-09-02
--    over 28 vendor strings through both folds:
--      · R-65 records `vendorKey()` folding "Sudderth Brothers Contracting, Inc." and "Sudderth
--        Brothers" to ONE key. It does NOT — `contracting` is not in `VENDOR_SUFFIXES`, so they
--        fold to `sudderth brothers contracting` and `sudderth brothers`. TWO keys.
--      · It was the OTHER side (`looseVendorKey`) that merged them, by carrying `contracting` in a
--        suffix list where it does not belong. That has been corrected to `vendorKey()`'s exact
--        algorithm, and `vendorFoldAgreement.test.ts` now FAILS THE BUILD if the two ever diverge —
--        which is the mechanical guard R-65's own status line records as not existing.
--    So the two stores did disagree; not in the direction the ruling records, and no longer at all.
--
-- ── WHAT THIS DOES AND DELIBERATELY DOES NOT DO ────────────────────────────────────────────────
-- ADDS: `vendor_preferences.vendor_id` (nullable FK → vendors, ON DELETE CASCADE) + an index.
-- DOES NOT: drop `vendor_key`, drop the fold-keyed unique index, or rewrite a single existing row.
--
-- ⚠️ `vendor_key` IS KEPT, NOT REPLACED, and the reason is the same one that keeps `receipts.vendor`
--    beside `receipts.vendor_id`: the fold records WHAT WAS ASKED at the moment it was asked, and a
--    resolved id does not. A preference answered before a vendor row existed is still a real answer.
--
-- ⚠️ NO BACKFILL RUNS HERE. Neither table has a row today (both migrations unapplied, measured
--    2026-09-02: `vendors` ABSENT, `vendor_preferences` ABSENT, against a negative control that
--    proved ABSENT was distinguishable from a failed read). A backfill with nothing to fill is a
--    statement of intent, not a migration — and writing one now would be untested against the only
--    data that matters, which is the data that does not exist yet. The linking pass belongs with
--    the first real answer, and §3 below is the function that performs it, one row at a time,
--    where a human is present.
--
-- ⚠️ NOT EDITED: 20260902_receipt_line_edit_and_vendor_preference.sql, which belongs to another
--    session's work (R-62 — one writer per branch). This is additive and stands beside it.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0. PRE-FLIGHT — both tables must exist. An ALTER against a missing table aborts the whole
--    transaction with a bare 42P01, which is how a migration silently fails to be the thing it
--    claimed (the 2026-06-22 lesson: a policy in a file is not a live table).
-- ════════════════════════════════════════════════════════════════════════════════════════════════
DO $preflight$
BEGIN
  IF to_regclass('public.vendors') IS NULL THEN
    RAISE EXCEPTION 'consolidation pre-flight FAILED — `vendors` does not exist. '
                    'Apply 20260902_vendor_identity_and_preference.sql first.';
  END IF;
  IF to_regclass('public.vendor_preferences') IS NULL THEN
    RAISE EXCEPTION 'consolidation pre-flight FAILED — `vendor_preferences` does not exist. '
                    'Apply 20260902_receipt_line_edit_and_vendor_preference.sql first.';
  END IF;
END
$preflight$;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. THE JOIN KEY
-- ════════════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE vendor_preferences
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS vendor_preferences_vendor_id_idx ON vendor_preferences (vendor_id);

COMMENT ON COLUMN vendor_preferences.vendor_id IS
  'The consolidated key (R-65). NULL on any row answered before the vendor was resolved — which is '
  'an honest state, not a defect: the answer was real when it was given. `vendor_key` is KEPT '
  'beside this for the same reason `receipts.vendor` is kept beside `receipts.vendor_id` — the fold '
  'records what was actually asked, and a resolved id does not.';

-- ⚠️ THE UNIQUE INDEX IS NOT MOVED TO vendor_id, AND THAT IS A DECISION, NOT AN OMISSION.
-- `vendor_preferences_one_per_vendor_kind_uidx (business_id, vendor_key, preference_kind)` is what
-- makes "asked once" STRUCTURAL. Re-keying it on a NULLABLE vendor_id would silently weaken it:
-- Postgres treats NULLs as distinct in a unique index, so every unresolved row would be free to
-- duplicate and the question would start being asked twice — the exact failure both builds exist to
-- prevent. It moves when vendor_id is NOT NULL and backfilled, and not before.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. READING BOTH STORES AS ONE
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The consuming page joins through this rather than re-implementing the fold in a third place
-- (STD-011). Resolves by id where one exists, else falls back to the fold — so a preference
-- answered before its vendor row existed is still found.
CREATE OR REPLACE VIEW vendor_preferences_resolved AS
  SELECT
    vp.*,
    v.id            AS resolved_vendor_id,
    v.name          AS resolved_vendor_name,
    v.preferred     AS vendor_is_preferred,
    (vp.vendor_id IS NOT NULL) AS joined_by_id   -- honest about WHICH key found the row
  FROM vendor_preferences vp
  LEFT JOIN vendors v
    ON v.business_id = vp.business_id
   AND (
        (vp.vendor_id IS NOT NULL AND v.id = vp.vendor_id)
     OR (vp.vendor_id IS NULL AND lower(btrim(v.name)) = lower(btrim(vp.vendor_label)))
   );

COMMENT ON VIEW vendor_preferences_resolved IS
  'Both vendor stores read as one (R-65). Joins on vendor_id where present, else on the STRICT '
  'name fold — deliberately the strict one, matching vendors_business_name_uidx, because a LOOSE '
  'join here would merge two vendors on an inference and D-47 forbids exactly that. '
  '`joined_by_id` tells a reader which key matched rather than making them guess.';

-- ⚠️ A VIEW INHERITS THE RLS OF ITS BASE TABLES ONLY IF IT IS NOT SECURITY DEFINER. This one is
--    not, so `vendor_preferences`' owner policy and `vendors`' owner+member policies both still
--    apply to whoever selects from it. Stated because a view over an RLS-protected table is a
--    classic way to hand out a bypass by accident.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. LINK ONE ROW — the per-row pass that replaces a blind backfill
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER so the owner check is the FUNCTION's, not the caller's ambient RLS; it writes
-- exactly one column on exactly one row and returns whether it did.
CREATE OR REPLACE FUNCTION public.link_vendor_preference(p_preference_id uuid, p_vendor_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_business uuid;
BEGIN
  SELECT business_id INTO v_business FROM public.vendor_preferences WHERE id = p_preference_id;
  IF v_business IS NULL THEN RETURN false; END IF;

  -- AC-3: the vendor must belong to the SAME tenant. Without this a caller could point a
  -- preference at another business's vendor row, which is a cross-tenant write wearing a uuid.
  IF NOT EXISTS (SELECT 1 FROM public.vendors
                  WHERE id = p_vendor_id AND business_id = v_business) THEN
    RAISE EXCEPTION 'vendor % is not in business % — refusing a cross-tenant link',
      p_vendor_id, v_business USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_business_owner(v_business) THEN
    RAISE EXCEPTION 'linking a vendor preference is owner-only (business %)', v_business
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.vendor_preferences SET vendor_id = p_vendor_id, updated_at = now()
   WHERE id = p_preference_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.link_vendor_preference(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.link_vendor_preference(uuid, uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (schema-verification gate, §9)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- (A) the column and its FK:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name='vendor_preferences' AND column_name IN ('vendor_id','vendor_key');
--   -- expect BOTH: vendor_id uuid YES, vendor_key text NO
--
-- (B) the fold-keyed unique index SURVIVES (it is what makes "asked once" structural):
--   SELECT indexname FROM pg_indexes WHERE tablename='vendor_preferences';
--   -- expect vendor_preferences_one_per_vendor_kind_uidx STILL PRESENT
--
-- (C) the view resolves and is not SECURITY DEFINER:
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname='vendor_preferences_resolved';
--   SELECT * FROM vendor_preferences_resolved LIMIT 5;   -- expect 0 rows today, no error
--
-- (D) the link function refuses a cross-tenant vendor:
--   SELECT public.link_vendor_preference('<a pref in business A>', '<a vendor in business B>');
--   -- expect 42501, NOT a silent success
