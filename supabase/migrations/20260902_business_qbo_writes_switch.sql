-- ════════════════════════════════════════════════════════════════════════════════
-- 20260902 — THE WRITE SWITCH: a business decides when its orders start reaching QuickBooks
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, in the Supabase SQL EDITOR — not the table editor (CLAUDE.md §6 r17: a
-- table created through the table editor is owned by supabase_admin, whose default ACL grants
-- TRUNCATE and REFERENCES to anon, and RLS cannot filter TRUNCATE).
--
-- ADDITIVE ONLY. One nullable-in-effect column with a DEFAULT; no row is rewritten, no
-- constraint added here can reject a row that exists today, and nothing is dropped.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────────
-- An owner evaluating this platform will ring up fake orders all week to see what comes out.
-- That is what a careful buyer does, and it is the only way they build confidence in it. It is
-- safe ONLY if those orders never reach their real accounting — and today the sole thing
-- standing between a checkout and a live company's books is `QBO_PUSH_HOLD`, an ENV VAR that
-- only David can set. The owner has no way to say "not yet", and no way to say "now".
--
-- 🔴 THE FAILURE THIS IS SHAPED AROUND IS THE REVERSE OF THE OBVIOUS ONE. The obvious fear is
-- test data reaching their books. The expensive one is the opposite: somebody works in test
-- mode for a week believing they are live, none of their real sales ever reaches QuickBooks,
-- and two weeks later the bookkeeper finds a hole nobody can reconstruct. That is why the state
-- is STORED PER BUSINESS and rendered as a banner on every screen that touches money, rather
-- than being an invisible platform setting: a mode you cannot see is a mode you can be wrong
-- about for a fortnight.
--
-- ── WHY `false` IS THE DEFAULT, AND WHAT THAT CHANGES ────────────────────────────
-- A new business starts in TEST MODE and turns writes on deliberately. The alternative —
-- default on — makes the first accidental checkout a real invoice in a real company, which is
-- unrecoverable in exactly the way §9's phasing exists to prevent (import → configure in test
-- mode → go live).
--
-- ⚠️ IT IS A BEHAVIOUR CHANGE FOR EVERY EXISTING ROW AND THAT IS STATED, NOT SLIPPED IN. Any
-- business connected to QuickBooks today stops pushing invoices the moment this is applied,
-- until its owner switches writes on. For LAWNS this changes nothing observable — the platform
-- hold (`QBO_PUSH_HOLD`) already stops their pushes, and it stays. The two are AND-ed: David's
-- hold and the owner's switch must BOTH permit a push. Belt and braces, because each alone is
-- one edit away from failing.
--
-- ── WHY NO NEW TABLE, AND NO `order_kind` CHECK ──────────────────────────────────
-- This is one boolean about one business, and `businesses` already carries every other
-- accounting-connection fact (accounting_company_id, accounting_needs_reconnect,
-- accounting_token_expires_at). A settings table minted for one column would be a second home
-- for a fact that has one (STD-011).
--
-- `order_kind = 'test'` needs NOTHING here. 20260827_history_orders.sql added the column as
-- nullable text with no CHECK and no DEFAULT, and said why: "The vocabulary is young… The
-- writers own the vocabulary; this column stores it." `idx_orders_kind` already indexes it.
--
-- ── AUTHORITY: NO NEW POLICY, AND THE EXISTING ONE IS THE GATE ───────────────────
-- `businesses` carries exactly one UPDATE policy — `businesses_owner_update`, USING
-- (owner_id = auth.uid()) from 20260529 — and the only member-facing policy added since is
-- `businesses_member_select`, a READ (20260622). So a manager cannot flip this column and an
-- owner can, enforced at the database, with no new policy and no permission string.
--
-- ⚠️ THAT IS THE CLAIM, AND IT IS PROVEN RATHER THAN ASSERTED (R-31 — a permission string with
-- no enforcement behind it may not be cited as evidence). The VERIFY block at the bottom of
-- this file reads pg_policies and must show UPDATE on businesses restricted to the owner. Run
-- it; do not take this paragraph for it.
--
-- AC-1 (no vertical noun: `businesses`, not `nurseries`) · AC-2 (owner-scoped) · AC-3.

BEGIN;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS qbo_writes_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.businesses.qbo_writes_enabled IS
  'FALSE = this business is in TEST MODE: orders it rings up are written with order_kind = ''test'', they are excluded from every count by the shared orderKind primitive, and pushQboInvoice refuses them (422 TEST_ORDER_NOT_PUSHABLE) BEFORE the invoice POST and BEFORE findOrCreateQBCustomer. TRUE = live: new orders are ordinary checkout orders and push normally. Owner-only via the businesses_owner_update policy (20260529). AND-ed with the platform hold QBO_PUSH_HOLD — both must permit a push. Defaults FALSE so a new business cannot write to a real company''s books by accident on its first checkout.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run these AFTER the migration. Every claim above is checkable.
-- ════════════════════════════════════════════════════════════════════════════════
-- 1. The column exists, is NOT NULL, and defaults false:
--      SELECT column_name, data_type, is_nullable, column_default
--        FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='businesses'
--         AND column_name='qbo_writes_enabled';
--    Expected: boolean · NO · false
--
-- 2. 🔴 EVERY EXISTING BUSINESS IS NOW IN TEST MODE — confirm it, do not assume it:
--      SELECT count(*) FILTER (WHERE qbo_writes_enabled) AS live,
--             count(*) FILTER (WHERE NOT qbo_writes_enabled) AS test_mode,
--             count(*) AS total
--        FROM public.businesses;
--    Expected: live = 0, test_mode = total. If live > 0, something set it — find out what.
--
-- 3. 🔴 THE AUTHORITY CLAIM. UPDATE on businesses must be owner-only:
--      SELECT policyname, cmd, qual
--        FROM pg_policies
--       WHERE schemaname='public' AND tablename='businesses';
--    Expected: exactly one row with cmd='UPDATE', named businesses_owner_update, whose qual
--    reads (owner_id = auth.uid()). 🔴 If ANY other UPDATE policy is listed, the owner gate is
--    not the only door and this migration's authority paragraph is FALSE — stop and surface it
--    rather than shipping the switch.
--
-- 4. No order rows were touched (this migration writes none):
--      SELECT order_kind, count(*) FROM public.orders GROUP BY 1 ORDER BY 2 DESC;
--    Expected: the same distribution as before applying — NULL and 'history' only, no 'test'.
