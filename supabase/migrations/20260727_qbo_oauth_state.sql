-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727 — SIGNED, SINGLE-USE OAuth STATE FOR THE QBO CALLBACK
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres (Supabase SQL editor, project bgobkjcopcxusjsetfob).
--
-- WHY. The QBO OAuth callback is the ONE hop in the platform that cannot be deleted: Intuit
-- redirects the BROWSER to it, so no Bearer token can ever exist there. Every other member of the
-- 2026-07-27 service-key class was closed with a caller gate, and the last one (qbo/invoice) was
-- closed by removing the hop entirely. This one needs the request itself to be provable.
--
-- The state it used was `${businessId}__${random}` — it CARRIED the tenant but was NEITHER SIGNED
-- NOR SINGLE-USE. Anyone could construct one for any business id and have the callback write that
-- tenant's QuickBooks tokens.
--
-- ⚠️ SINGLE-USE IS ENFORCED BY STORAGE, NOT BY TTL (David's ruling). A TTL narrows a replay
-- window; storage closes it. The state is cleared on first successful validation, so a replay
-- finds nothing to match.
--
-- WHY HERE AND NOT A NEW TABLE: an OAuth state is a short-lived SECRET for exactly one business,
-- and `business_accounting_secrets` is already the owner-only home for this integration's secrets
-- (20260622 relocation). One column beside them, not a new table with its own RLS to get wrong.
--
-- 🔴 THE CLEANUP PATH, DECIDED (David asked which and why): DELETE-ON-VALIDATE, plus a timestamp
-- checked on read. Abandoned states DO NOT ACCUMULATE — this is ONE COLUMN ON ONE ROW PER
-- BUSINESS, not a table of pending rows, so a connect that is started and never finished leaves a
-- single stale value that the NEXT mint overwrites. There is nothing to sweep and no cron to
-- forget. `oauth_state_at` makes a stale value inert on read (10-minute window) rather than
-- merely old, so an abandoned state cannot be resurrected days later.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.business_accounting_secrets
  ADD COLUMN IF NOT EXISTS oauth_state    text,
  ADD COLUMN IF NOT EXISTS oauth_state_at timestamptz;

COMMENT ON COLUMN public.business_accounting_secrets.oauth_state IS
  'PENDING, SINGLE-USE OAuth state for the QuickBooks connect flow. Minted by /api/qbo/auth-url — '
  'which is gated on settings:update, so only an AUTHENTICATED caller can ever create one — and '
  'CLEARED on first successful callback validation. Single-use is enforced HERE, by storage: a '
  'replayed state finds NULL and is refused. NULL is the normal resting state; a non-NULL value '
  'means a connect is in flight or was abandoned, and the next mint overwrites it.';
COMMENT ON COLUMN public.business_accounting_secrets.oauth_state_at IS
  'When oauth_state was minted. Read-side staleness check (10 minutes) so an abandoned state goes '
  'inert rather than merely old. Not the security boundary — the signature and the single-use '
  'clear are; this only bounds how long a legitimate connect may take.';

COMMIT;

-- ── V1 — the columns exist and are nullable. EXPECT 2 rows, both is_nullable = YES.
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='business_accounting_secrets'
--    AND column_name IN ('oauth_state','oauth_state_at');

-- ── V2 — NEGATIVE: no state is left behind after a successful connect.
-- EXPECT 0 rows once a connect has completed.
-- SELECT business_id, oauth_state_at FROM public.business_accounting_secrets
--  WHERE oauth_state IS NOT NULL;

-- ── V3 — the table is still owner-only (the relocation's guarantee is unchanged by this ALTER).
-- EXPECT: bas_owner_all, and NO member policy.
-- SELECT policyname, cmd, qual FROM pg_policies
--  WHERE schemaname='public' AND tablename='business_accounting_secrets';
