-- ============================================================================================
-- 20260923i — A WARRANTY CLAIM IS CREATED FROM THE ORIGINAL LINE, AND THE CHAIN IS WALKABLE
--             ledger #392 · David's ruling 2026-09-23 · tech-debt #345's family
--
-- ✅ APPLIED 2026-09-24 BY DAVID in the SQL editor (§6 r17). His results, verbatim:
--      V1 rls true, 3 policies · V2 5 indexes (pkey, business_status, one_open_per_line,
--         original_item, owed) · V3 0 seeded
--      V4 "V4 PASSED — sizeless refused, duplicate open claim refused, chain accepted once
--         answered" — the error IS the pass, by design · V5 0 rows left behind
--
-- ✅ EVERY V-BLOCK BELOW WAS RUN IN PGLITE AGAINST THE REAL CHAIN BEFORE THIS FILE WENT NEAR THE
--    SQL EDITOR, and V4 was extracted VERBATIM from the comments rather than re-typed:
--      V1 rls=true, 3 policies · V2 5 indexes · V3 0 seeded
--      V4 PASSED — sizeless refused, duplicate open claim refused, chain accepted once answered
--      V5 rows before 0 → after 0: the probe left nothing behind
--    ⚠️ Building that probe also surfaced two NOT NULLs the harness would otherwise have let me
--    miss — `orders.transport_method` and `order_items.subtotal`. A double more forgiving than
--    live is tech-debt #138's class; these failed loudly instead.
--
-- THE INDUSTRY STANDARD DAVID ASKED FOR: a replacement is created FROM the original document,
-- never typed fresh. So the claim's spine is a pointer to the ORIGINAL LINE, and the variety and
-- size are COPIED FROM IT rather than re-entered.
--
-- 🔴 WHY THAT REMOVES A WHOLE DEFECT CLASS, MEASURED NOT ARGUED. Run through the platform's own
--    resolver, **24 of 33** historical zero-priced replacement lines carry NO readable size — 31 of
--    41 trees. Every one is a stop whose mix figure is short with nothing saying so. A replacement
--    that inherits its original's size cannot be sizeless. (A parser fix would recover some of the
--    17 a human can read and still leave bare "TREE REPLACEMENT" with nothing.)
--
-- 🔴 THE FORWARD LINK IS REQUIRED, NOT OPTIONAL, AND HERE IS THE EVIDENCE. Of the 27 historical
--    replacement orders, **26 cannot be classified done or owed from anything stored**: `status` is
--    `invoiced` on 1,519 of 1,530 history orders (an import artefact carrying no fulfilment
--    information), `install_date` is null on all of them, and only 1 has a stop. Without
--    `replacement_order_id` / `replacement_order_item_id`, "still owed" is underivable — which is
--    exactly the hole the history is sitting in. Going forward it is derivable, and never stored.
-- ============================================================================================

CREATE TABLE IF NOT EXISTS public.warranty_claims (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id   uuid        NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  -- WHERE the tree goes. 🔴 THE ADDRESS RECORD, NEVER A STOP COORDINATE (CONTACTS-349, via David):
  -- a stop's coordinate is historical evidence of where the truck went that day, so matching on it
  -- finds where customers USED to be. ON DELETE RESTRICT — losing the address must not orphan a debt.
  address_id    uuid        REFERENCES public.customer_addresses(id) ON DELETE RESTRICT,

  -- ── THE SPINE: the line that died ─────────────────────────────────────────────────────────
  original_order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  original_order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  -- Copied FROM that line at claim time, never re-typed, and never re-derived later: if the
  -- catalogue is renamed afterwards the claim still says what was actually owed.
  variety       text        NOT NULL,
  -- 🔴 NOT NULL, AND THAT IS THE POINT. A claim cannot exist without a size, so a replacement order
  -- generated from it cannot be sizeless. A sizeless original must be resolved BEFORE a claim
  -- exists — the generator asks Lauren; the database simply cannot hold the broken shape.
  size          text        NOT NULL CHECK (btrim(size) <> ''),
  qty           integer     NOT NULL CHECK (qty > 0),

  -- ── WHO SAID YES ──────────────────────────────────────────────────────────────────────────
  approved_by   uuid,
  approved_at   timestamptz,
  status        text        NOT NULL DEFAULT 'proposed'
                            CHECK (status IN ('proposed', 'approved', 'declined', 'void')),

  -- ── THE CHAIN, BOTH DIRECTIONS ────────────────────────────────────────────────────────────
  -- A replacement that dies gets its OWN claim: `original_order_item_id` points at the REPLACEMENT's
  -- line, and `replaces_claim_id` at the claim that produced it. The chain is never reset, so
  -- "this is the third tree at this address" is answerable.
  replaces_claim_id uuid REFERENCES public.warranty_claims(id) ON DELETE SET NULL,
  -- 🔴 THE FORWARD LINK. What the platform actually DID about the claim. NULL = nothing yet, which
  -- is what makes `owed` derivable rather than stored.
  replacement_order_id      uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  replacement_order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,

  -- ⚠️ PRESUMPTION AS A FLAG, NOT BAKED INTO ROWS (David, 2026-09-23). The 26 UNKNOWN historical
  -- orders are PRESUMED DONE while he asks Lauren whether a $0 invoice is raised on promise or on
  -- planting. Her answer may flip them to owed-proposals. `presumed_from_invoice` marks a row whose
  -- state was INFERRED rather than observed, so one flag flips the whole cohort and no row has to be
  -- rewritten. A screen showing such a row says "presumed from invoice — Lauren can reopen".
  presumed_from_invoice boolean NOT NULL DEFAULT false,
  -- Lauren has not yet confirmed the original line. C proposes; she validates. Never preselected.
  unvalidated   boolean     NOT NULL DEFAULT false,

  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS warranty_claims_business_status_idx
  ON public.warranty_claims (business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS warranty_claims_owed_idx
  ON public.warranty_claims (business_id) WHERE replacement_order_id IS NULL AND status = 'approved';
CREATE INDEX IF NOT EXISTS warranty_claims_original_item_idx
  ON public.warranty_claims (original_order_item_id);

-- 🔴 ONE OPEN CLAIM PER ORIGINAL LINE. Without this, two calls about the same dead tree make two
-- debts and the exposure figure double-counts. A DECLINED or VOID claim does not block a new one,
-- and neither does a claim already answered by a replacement order.
CREATE UNIQUE INDEX IF NOT EXISTS warranty_claims_one_open_per_line
  ON public.warranty_claims (original_order_item_id)
  WHERE replacement_order_id IS NULL AND status IN ('proposed', 'approved');

COMMENT ON TABLE public.warranty_claims IS
  'A tree owed under warranty, created FROM the original order line (ledger #392). variety/size are '
  'copied from that line so a replacement can never be sizeless. owed is DERIVED: an approved claim '
  'with no replacement_order_id. presumed_from_invoice marks an inferred state, flippable as a cohort.';

ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warranty_claims_member_select ON public.warranty_claims;
CREATE POLICY warranty_claims_member_select ON public.warranty_claims
  FOR SELECT TO authenticated USING (public.has_permission(business_id, 'deliveries:read'));

-- Validating a claim is part of running the day, so it rides `deliveries:update` — the same string
-- that routes a day and assigns a stop to a team. It is NOT a costs permission: a claim carries no
-- money, and the exposure figures are computed from prices the caller can already see.
DROP POLICY IF EXISTS warranty_claims_member_write ON public.warranty_claims;
CREATE POLICY warranty_claims_member_write ON public.warranty_claims
  FOR INSERT TO authenticated WITH CHECK (public.has_permission(business_id, 'deliveries:update'));
DROP POLICY IF EXISTS warranty_claims_member_update ON public.warranty_claims;
CREATE POLICY warranty_claims_member_update ON public.warranty_claims
  FOR UPDATE TO authenticated
  USING (public.has_permission(business_id, 'deliveries:update'))
  WITH CHECK (public.has_permission(business_id, 'deliveries:update'));

-- ============================================================================================
-- V-BLOCKS — David pastes these AFTER applying. Each states the answer it must give.
-- 🔴 EVERY REFUSAL IS PROVED IN ONE SELF-CONTAINED `DO` BLOCK THAT ROLLS ITSELF BACK, because the
--    V3-V5 lesson of 20260922c was that a verification step must never leave a row behind on a
--    customer's database. The PASS arrives AS AN ERROR, deliberately.
-- ============================================================================================
-- V1 · the table, its RLS and its policies → expect rls = true, 3 policies
-- SELECT c.relrowsecurity AS rls, count(p.polname) AS policies FROM pg_class c
--   LEFT JOIN pg_policy p ON p.polrelid = c.oid
--  WHERE c.oid = 'public.warranty_claims'::regclass GROUP BY 1;
--
-- V2 · the indexes exist, including the two partial ones → expect 5 rows.
--      ⚠️ FIVE, NOT FOUR: the PRIMARY KEY's index counts. A first draft of this line said 4 and
--      was wrong — the same slip #362's V1 made ('V1 returns 3, not 2 — the count includes the
--      primary key'). Caught by RUNNING it in PGlite, not by re-reading it.
-- SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='warranty_claims' ORDER BY 1;
--
-- V3 · nothing is seeded → expect 0
-- SELECT count(*) AS rows_seeded FROM public.warranty_claims;
--
-- V4 · 🔴 THE REFUSALS, all in one rolled-back block. Expect ONE error reading
--      "V4 PASSED — ..." Anything reading "V4 FAILED — ..." names what did not hold.
-- DO $probe$
-- DECLARE v_biz uuid; v_cust uuid; v_ord uuid; v_item uuid; v_a uuid; v_b uuid;
-- BEGIN
--   SELECT id INTO v_biz FROM public.businesses ORDER BY created_at LIMIT 1;
--   SELECT id INTO v_cust FROM public.customers WHERE business_id = v_biz LIMIT 1;
--   SELECT o.id, oi.id INTO v_ord, v_item FROM public.orders o
--     JOIN public.order_items oi ON oi.order_id = o.id WHERE o.business_id = v_biz LIMIT 1;
--   IF v_item IS NULL THEN RAISE EXCEPTION 'V4 FAILED — no order line to probe against'; END IF;
--
--   -- (a) a sizeless claim is impossible
--   BEGIN
--     INSERT INTO public.warranty_claims (business_id, customer_id, original_order_id,
--       original_order_item_id, variety, size, qty)
--     VALUES (v_biz, v_cust, v_ord, v_item, 'Probe Oak', '   ', 1);
--     RAISE EXCEPTION 'V4 FAILED — a claim with a BLANK size was accepted; a generated replacement could be sizeless.';
--   EXCEPTION WHEN check_violation THEN NULL; END;
--
--   -- (b) a real claim inserts
--   INSERT INTO public.warranty_claims (business_id, customer_id, original_order_id,
--     original_order_item_id, variety, size, qty, status)
--   VALUES (v_biz, v_cust, v_ord, v_item, 'Probe Oak', '45 gal', 1, 'approved') RETURNING id INTO v_a;
--
--   -- (c) a SECOND open claim on the same original line is refused
--   BEGIN
--     INSERT INTO public.warranty_claims (business_id, customer_id, original_order_id,
--       original_order_item_id, variety, size, qty, status)
--     VALUES (v_biz, v_cust, v_ord, v_item, 'Probe Oak', '45 gal', 1, 'approved');
--     RAISE EXCEPTION 'V4 FAILED — a SECOND open claim on the same line was accepted; the exposure figure would double-count.';
--   EXCEPTION WHEN unique_violation THEN NULL; END;
--
--   -- (d) …but once answered by a replacement order, a new claim on that line is allowed
--   UPDATE public.warranty_claims SET replacement_order_id = v_ord WHERE id = v_a;
--   INSERT INTO public.warranty_claims (business_id, customer_id, original_order_id,
--     original_order_item_id, variety, size, qty, status, replaces_claim_id)
--   VALUES (v_biz, v_cust, v_ord, v_item, 'Probe Oak', '45 gal', 1, 'approved', v_a) RETURNING id INTO v_b;
--
--   RAISE EXCEPTION
--     'V4 PASSED — sizeless refused, duplicate open claim refused, chain accepted once answered. Probe rows discarded (rollback expected — this error IS the pass).';
-- END $probe$;
--
-- V5 · confirm it left nothing → expect the same number as V3
-- SELECT count(*) AS rows_in_table FROM public.warranty_claims;
