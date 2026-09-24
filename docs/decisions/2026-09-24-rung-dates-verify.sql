-- ══════════════════════════════════════════════════════════════════════════════════
-- FINISHING 20260924a's PROOF — the three checks that could not run.
-- Ledger #391 · David pastes this WHOLE FILE into the Supabase SQL editor, once, as postgres.
-- ══════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 WHY THIS FILE EXISTS, AND IT IS MY DEFECT, NOT THE EDITOR'S.
-- `20260924a` applied cleanly and its V1, V2, V3 and V5 all passed. V4, V4b and V6 COULD NOT RUN:
-- I wrote them with psql-style placeholders — `:bid`, `:lot`, `':bid_of_that_user'` — which the
-- Supabase SQL editor cannot fill. David got `42601 syntax error at or near ":"` and
-- `22P02 invalid input syntax for type uuid`. So the append-only guard, the "current is the latest"
-- tiebreak and the tenant-isolation probe were never actually proven against the live database.
--
-- 🔴 AND MY OWN HARNESS COULD NOT HAVE CAUGHT IT. `rung-dates-391.pglite.mjs` proved the same
-- behaviours by issuing its own SQL with real ids substituted in — it never executed the V-block
-- TEXT. A check that runs a different statement from the one a human will run is a check that
-- cannot fail on the thing that broke: tech-debt #182's shape, inside my verification. §6 r26 is
-- sharpened for this: a V-block must run AS-IS, and the harness must execute exactly what is pasted.
--
-- ══════════════════════════════════════════════════════════════════════════════════
-- HOW TO READ THE RESULT — 🔴 EVERY BLOCK BELOW ENDS IN A RED ERROR, AND THAT IS BY DESIGN.
-- Each check writes a row, probes it, and then RAISEs its verdict. The RAISE is what ROLLS THE
-- WRITE BACK, so nothing is left behind — the error IS the report.
--    **READ THE MESSAGE TEXT.** It begins with `V4 PASS ✅` or `V4 FAIL 🔴` (and the same for V4b,
--    V6). PASS means the check succeeded. There is nothing to clean up either way.
-- ⚠️ Run the file WHOLE. Each block is independent; none depends on another's data.
-- ══════════════════════════════════════════════════════════════════════════════════


-- ── V4 — THE APPEND-ONLY TRIGGER REFUSES AN UPDATE AND A DELETE ───────────────────────────────
DO $v4$
DECLARE
  v_bid uuid; v_lot uuid; v_id uuid;
  v_upd_refused boolean := false; v_del_refused boolean := false;
  v_upd_err text := '(the UPDATE SUCCEEDED — it was not refused)';
  v_del_err text := '(the DELETE SUCCEEDED — it was not refused)';
BEGIN
  -- Look the ids up INSIDE the check. Nothing is passed in and nothing is typed by hand.
  SELECT bi.business_id, bi.id INTO v_bid, v_lot
  FROM public.business_inventory bi ORDER BY bi.created_at, bi.id LIMIT 1;

  -- 🔴 THE POPULATION GUARD. Without it, a database with no inventory would sail through: the
  -- UPDATE would match zero rows, raise nothing, and the check would report a refusal it never saw.
  IF v_lot IS NULL THEN
    RAISE EXCEPTION 'V4 CANNOT RUN ⚠️ — there is no row in business_inventory to hang a date on. This is NOT a pass.';
  END IF;

  INSERT INTO public.production_rung_dates (business_id, inventory_id, entered_on, note)
  VALUES (v_bid, v_lot, DATE '2026-06-25', 'V4 probe — rolled back')
  RETURNING id INTO v_id;

  BEGIN
    UPDATE public.production_rung_dates SET entered_on = DATE '2020-01-01' WHERE id = v_id;
  EXCEPTION WHEN OTHERS THEN
    v_upd_refused := (SQLERRM LIKE '%append-only%'); v_upd_err := SQLERRM;
  END;

  BEGIN
    DELETE FROM public.production_rung_dates WHERE id = v_id;
  EXCEPTION WHEN OTHERS THEN
    v_del_refused := (SQLERRM LIKE '%append-only%'); v_del_err := SQLERRM;
  END;

  IF v_upd_refused AND v_del_refused THEN
    RAISE EXCEPTION 'V4 PASS ✅ — the append-only trigger refused BOTH an UPDATE and a DELETE by name. A correction must be a new row. (probe row rolled back)';
  ELSE
    RAISE EXCEPTION 'V4 FAIL 🔴 — a statement of fact can be rewritten. UPDATE: % | DELETE: %', v_upd_err, v_del_err;
  END IF;
END
$v4$;


-- ── V4b — "CURRENT" IS THE LATEST, AND TWO ROWS IN ONE STATEMENT RESOLVE BY `seq` ─────────────
-- Both rows below share a `recorded_at`: `now()` is TRANSACTION time. `seq` is the only thing that
-- can separate them, and without it "current" was decided by a random uuid — measured wrong 7 times
-- in 12 before this column existed.
DO $v4b$
DECLARE
  v_bid uuid; v_lot uuid; v_current date; v_rows int;
BEGIN
  SELECT bi.business_id, bi.id INTO v_bid, v_lot
  FROM public.business_inventory bi ORDER BY bi.created_at, bi.id LIMIT 1;
  IF v_lot IS NULL THEN
    RAISE EXCEPTION 'V4b CANNOT RUN ⚠️ — no row in business_inventory. This is NOT a pass.';
  END IF;

  -- ONE statement, two rows: this is the tie the tiebreak exists for.
  INSERT INTO public.production_rung_dates (business_id, inventory_id, entered_on, note) VALUES
    (v_bid, v_lot, DATE '2026-06-25', 'V4b earlier — rolled back'),
    (v_bid, v_lot, DATE '2026-07-02', 'V4b correction — rolled back');

  SELECT entered_on INTO v_current
  FROM public.production_rung_dates
  WHERE inventory_id = v_lot AND note LIKE 'V4b %'
  ORDER BY recorded_at DESC, seq DESC LIMIT 1;

  SELECT count(DISTINCT recorded_at) INTO v_rows
  FROM public.production_rung_dates WHERE inventory_id = v_lot AND note LIKE 'V4b %';

  IF v_current = DATE '2026-07-02' AND v_rows = 1 THEN
    RAISE EXCEPTION 'V4b PASS ✅ — both rows share ONE recorded_at (so the tie is real), and `seq` resolves current to the CORRECTION, 2026-07-02. Nothing was overwritten. (rolled back)';
  ELSIF v_rows <> 1 THEN
    RAISE EXCEPTION 'V4b INCONCLUSIVE ⚠️ — the two rows did not share a recorded_at (% distinct), so this run did not exercise the tiebreak at all. NOT a pass.', v_rows;
  ELSE
    RAISE EXCEPTION 'V4b FAIL 🔴 — current resolved to % , not the correction 2026-07-02.', v_current;
  END IF;
END
$v4b$;


-- ── V6 — TENANT SCOPING: THE PREDICATE THE POLICIES REST ON ANSWERS PER BUSINESS ──────────────
-- ⚠️ WHAT THIS PROVES AND WHAT IT DOES NOT, said plainly rather than implied.
-- It runs as `postgres`, for whom RLS is not enforced, so it CANNOT demonstrate a refused SELECT.
-- What it CAN do is call the function every one of this table's member policies is built on —
-- `is_active_member`, which is SECURITY DEFINER and reads `auth.uid()` — under a real member's
-- claims, and show it answers TRUE for their own business and FALSE for another. That is the
-- scoping the policy delegates to. A full cross-tenant SELECT proof needs a real signed-in session
-- and belongs on the owner-test board, not in the SQL editor.
-- (`SET LOCAL ROLE authenticated` is deliberately NOT used: it fails with `permission denied to set
--  role` on this project — tech-debt #240 — and setting the claims GUC alone is the proven form.)
DO $v6$
DECLARE
  v_user uuid; v_own uuid; v_other uuid;
  v_own_answer boolean; v_other_answer boolean; v_policies int;
BEGIN
  SELECT bm.user_id, bm.business_id INTO v_user, v_own
  FROM public.business_members bm
  WHERE bm.active
    AND (SELECT count(DISTINCT b2.business_id) FROM public.business_members b2
          WHERE b2.user_id = bm.user_id AND b2.active) = 1
  ORDER BY bm.user_id LIMIT 1;

  SELECT b.id INTO v_other FROM public.businesses b WHERE b.id <> v_own ORDER BY b.id LIMIT 1;

  IF v_user IS NULL OR v_other IS NULL THEN
    RAISE EXCEPTION 'V6 CANNOT RUN ⚠️ — needs an active member of exactly ONE business, and a second business to test against. This is NOT a pass.';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  v_own_answer   := public.is_active_member(v_own);
  v_other_answer := public.is_active_member(v_other);

  SELECT count(*) INTO v_policies FROM pg_policies
  WHERE tablename = 'production_rung_dates' AND qual LIKE '%is_active_member%';

  IF v_own_answer AND NOT v_other_answer AND v_policies >= 1 THEN
    RAISE EXCEPTION 'V6 PASS ✅ — under a real member''s claims, is_active_member is TRUE for their own business and FALSE for another, and % member policy/policies on production_rung_dates are built on it. Tenant scoping holds where the policies delegate it.', v_policies;
  ELSE
    RAISE EXCEPTION 'V6 FAIL 🔴 — own=% other=% policies_using_is_active_member=%. Expected true / false / at least 1.', v_own_answer, v_other_answer, v_policies;
  END IF;
END
$v6$;


-- ══════════════════════════════════════════════════════════════════════════════════
-- AFTERWARDS — nothing should be left. Expect 0. (This one is an ordinary query, not an error.)
--   SELECT count(*) AS probe_rows_left_behind
--   FROM public.production_rung_dates WHERE note LIKE 'V4%probe%' OR note LIKE 'V4b %';
-- ══════════════════════════════════════════════════════════════════════════════════
