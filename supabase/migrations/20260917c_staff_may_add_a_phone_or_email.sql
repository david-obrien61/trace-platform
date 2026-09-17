-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260917c — A STAFF MEMBER MAY ADD A PHONE OR AN EMAIL · ledger #349 · tech-debt #317 · [[R-162]]
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHY (David's ruling, 2026-09-17) ────────────────────────────────────────────────────────
-- *"STAFF MAY ADD a phone or email — never Edit, Make main or Remove. Adding cannot destroy
-- anything, and refusing it means a counter staff member cannot write down a new mobile at all."*
--
-- Measured live 2026-09-17: a STAFF member holds `customers:read` and neither `customers:create`
-- nor `customers:update`. The contact lists' INSERT policies ask for `customers:create` (tech-debt
-- #312), so a staff member standing at the counter could see a customer and could not add the
-- number they had just been given. The UPDATE policies already ask for `customers:update`, which
-- is what Edit / Make main / Remove go through, so this file does not touch them.
--
-- ── WHAT CHANGES — TWO POLICIES, INSERT ONLY ────────────────────────────────────────────────
--   `customer_phones_member_insert`  and  `customer_emails_member_insert`
--     FROM: is_active_member(business_id) AND has_permission(business_id, 'customers:create')
--       TO: is_active_member(business_id) AND (has_permission(business_id, 'customers:read')
--             OR has_permission(business_id, 'customers:create')
--             OR has_permission(business_id, 'customers:update'))
--   `customers:read` is what the customer page itself requires, so this says: a member who may SEE
--   a customer may ADD a way to reach them. `create` and `update` are kept in the list so nobody
--   who can add today loses it (a role could hold create without read).
--
-- ── WHAT DOES NOT CHANGE, DELIBERATELY ──────────────────────────────────────────────────────
--   · `customer_addresses_member_insert` — still `customers:create`. The ruling names a phone or an
--     email; an address is the delivery and billing destination and stays where it was.
--   · Every UPDATE policy — Edit, Make main and Remove remain `customers:update`. A staff member
--     cannot change or retire what is there.
--   · No DELETE policy exists on these tables and none is added: a row is retired, never deleted
--     (R-133), and only the import undo removes rows (SECURITY DEFINER, not a policy).
--   · No permission string is minted. No column, table, trigger or function changes.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                  AND tablename = 'customer_phones' AND policyname = 'customer_phones_member_insert') THEN
    RAISE EXCEPTION 'REFUSED: customer_phones_member_insert does not exist — apply 20260915_contact_record first. Nothing changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                  AND tablename = 'customer_emails' AND policyname = 'customer_emails_member_insert') THEN
    RAISE EXCEPTION 'REFUSED: customer_emails_member_insert does not exist — apply 20260915_contact_record first. Nothing changed.';
  END IF;
END $guard$;

DROP POLICY IF EXISTS customer_phones_member_insert ON public.customer_phones;
CREATE POLICY customer_phones_member_insert ON public.customer_phones
  FOR INSERT TO authenticated
  WITH CHECK (is_active_member(business_id)
              AND (has_permission(business_id, 'customers:read')
                OR has_permission(business_id, 'customers:create')
                OR has_permission(business_id, 'customers:update')));

DROP POLICY IF EXISTS customer_emails_member_insert ON public.customer_emails;
CREATE POLICY customer_emails_member_insert ON public.customer_emails
  FOR INSERT TO authenticated
  WITH CHECK (is_active_member(business_id)
              AND (has_permission(business_id, 'customers:read')
                OR has_permission(business_id, 'customers:create')
                OR has_permission(business_id, 'customers:update')));

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the two INSERT policies now accept a reader; the address one does not. EXPECT three rows:
--      customer_emails … true · customer_phones … true · customer_addresses … false
-- SELECT tablename, policyname, with_check LIKE '%customers:read%' AS accepts_a_reader
--   FROM pg_policies
--  WHERE schemaname = 'public' AND cmd = 'INSERT'
--    AND tablename IN ('customer_phones', 'customer_emails', 'customer_addresses')
--  ORDER BY tablename;
--
-- V2 · nothing else moved: every UPDATE policy on the three lists still asks for customers:update.
--      EXPECT three rows, all true.
-- SELECT tablename, policyname, qual LIKE '%customers:update%' AS still_needs_update
--   FROM pg_policies
--  WHERE schemaname = 'public' AND cmd = 'UPDATE'
--    AND tablename IN ('customer_phones', 'customer_emails', 'customer_addresses')
--  ORDER BY tablename;
--
-- V3 · and there is still no DELETE policy on any of them. EXPECT zero rows.
-- SELECT tablename, policyname FROM pg_policies
--  WHERE schemaname = 'public' AND cmd = 'DELETE'
--    AND tablename IN ('customer_phones', 'customer_emails', 'customer_addresses');
