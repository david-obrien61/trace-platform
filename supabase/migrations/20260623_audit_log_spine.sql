-- Migration: the canonical append-only audit_log spine (accountability-grade)
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-06-23
-- Branch: main
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- ⚠️  APPLY NOTE FOR DAVID: run in the Supabase SQL editor as the default `postgres`
--   role. The immutability-guard function must be OWNED BY postgres + SECURITY DEFINER
--   (same load-bearing ownership rule as is_active_member / has_permission / the self-grant
--   trigger, 20260622/20260623). RLS is the read/write boundary; the trigger + REVOKE are
--   belt-and-suspenders so even a future policy mistake cannot rewrite or erase history.
--
-- PREREQ (must already be live):
--   • 20260622_is_active_member_canonical_rls.sql  (this migration calls public.is_active_member(uuid) in the INSERT policy).
--   • businesses table (FK target + owner_id read).
--
-- ── WHAT THIS IS ────────────────────────────────────────────────────────────────
-- The greenfield audit spine the recon (data/grower-scan/audit-spine-recon.md) found
-- MISSING: there is NO audit/event/activity table anywhere in 50 prior migrations. The two
-- "log" tables (business_service_log, pmi_service_logs) are OPERATIONAL business-fact records,
-- and [TRACE:*] console emits are ephemeral DEBUG — neither records who-exercised-authority.
-- This table is the durable, append-only, tenant-scoped record of governance / money / identity
-- / security actions: who · what · when · target · detail · outcome.
--
-- ── THE DEFINING PROPERTY: APPEND-ONLY IMMUTABILITY ─────────────────────────────
-- What separates an audit log from a regular log is that NO ONE can rewrite or delete history —
-- not members, not owners, not the app role. Enforced THREE ways (defense in depth, because this
-- is the one table where immutability is the whole point):
--   1. RLS: INSERT + SELECT policies only. NO UPDATE policy, NO DELETE policy → default-deny RLS
--      refuses every update/delete.
--   2. A BEFORE UPDATE OR DELETE trigger that RAISES → catches anything that slips past a future
--      policy mistake (e.g. someone adding a permissive UPDATE policy later by accident).
--   3. REVOKE UPDATE, DELETE on the table from authenticated/anon → the privilege itself is absent.
--
-- ── AUTHOR MODEL: client-side INSERT (accountability-grade) ─────────────────────
-- The owner/member appends audit rows from their own authenticated session (rides the existing
-- call sites — no Vercel-fn round-trip per event). Immutability — not write-authorship — is the
-- guarantee: a caller can APPEND a row but can never REWRITE one. The WITH CHECK pins the row to
-- the caller's own business AND own actor id, so a member cannot forge a row attributed to someone
-- else. This is designed to HARDEN to service-key-authored later (signing, ownership) WITHOUT
-- reshaping the envelope — chosen over service-key-only now (compliance-grade) as overkill.
--
-- ── ALERTING IS A CONSUMER, NOT PART OF THIS MIGRATION ──────────────────────────
-- The schema makes "denied attempts by this actor over time" a TRIVIAL, INDEXED query (A4) so the
-- once-vs-repeated detection is cheap. The notifier (email owner + system engineer on a repeated
-- denied-probe) is a SEPARATE follow-on that READS this log — deliberately NOT coupled to the
-- INSERT: an email failure must NEVER affect whether the audit row is written. Flagged, not built.
--
-- ── SIGNING INDEXES, IT DOES NOT ABSORB (MB_D-014, parked) ──────────────────────
-- When document signing is built, `document.signed` writes a NORMAL light audit row whose
-- target_type='document' and target_id points at a separate signing_records vault holding the
-- snapshot/hash/channel/consent evidence. The envelope already supports this — target_id is text
-- precisely so it can point at a future signing_records id (or any other target). signing_records
-- is NOT created here.
--
-- AC-1 (no vertical nouns) · AC-2 (membership-scoped) · AC-3 (tenant isolation absolute).


-- ════════════════════════════════════════════════════════════════════════════════
-- THE ENVELOPE
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, -- tenant scope (AC-3)
  actor_user_id uuid,                 -- who (auth.uid()); NULL = service / system / migration action
  actor_role    text,                 -- role AT TIME of action (snapshot string, NOT an FK — history must not move when roles change)
  action        text        NOT NULL, -- CONTROLLED vocabulary (see comment below)
  target_type   text,                 -- role / member / tile / cost_object / document / business
  target_id     text,                 -- the target's id as text (points at anything, incl. a future signing_records id)
  detail        jsonb       NOT NULL DEFAULT '{}'::jsonb, -- specifics / old→new (NO casual PII)
  outcome       text        NOT NULL DEFAULT 'success',   -- 'success' | 'denied'
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── A3 — controlled action vocabulary (documented convention, NOT a hard CHECK) ──
-- DECISION (stated): a documented convention + an index, NOT a CHECK constraint. A CHECK would
-- force a migration every time a new action type is added (tile.*, ownership.*, future verbs).
-- The convention below is the source of truth; the action index (A4) keeps queries fast. This
-- mirrors the cost_source / recovery_basis "no-CHECK, value-set grows by data" precedent (AC-4).
--
-- VOCABULARY (seed set — extend by convention, no migration needed):
--   role.created · role.cloned · role.permissions_changed · role.factory_reset
--   member.role_changed · member.removed
--   permission.self_elevation_denied
--   cost.applied · cost.apply_denied
--   tile.activated · tile.delegated · tile.revoked
--   ownership.transferred
--   document.signed
COMMENT ON COLUMN audit_log.action IS
  'Controlled vocabulary (convention, not CHECK): role.created|role.cloned|role.permissions_changed|role.factory_reset|member.role_changed|member.removed|permission.self_elevation_denied|cost.applied|cost.apply_denied|tile.activated|tile.delegated|tile.revoked|ownership.transferred|document.signed';
COMMENT ON COLUMN audit_log.outcome IS 'success | denied — denied is a first-class filterable value for security monitoring (A4)';
COMMENT ON TABLE  audit_log IS
  'Append-only, immutable, tenant-scoped who/what/when/target/detail/outcome record of governance/money/identity/security actions. NO UPDATE/DELETE (RLS + trigger + REVOKE). Client-INSERT, accountability-grade.';


-- ════════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════════════════
-- Per-tenant trail view (newest first).
CREATE INDEX IF NOT EXISTS audit_log_business_created_idx
  ON audit_log (business_id, created_at DESC);

-- A4 — DENIED-ATTEMPT QUERYABILITY (the security-monitoring foundation). Makes
-- "denied attempts by this actor, for this action kind, over this window" — the once-vs-repeated
-- count that distinguishes a fat-finger from a probe — a trivial INDEX-backed query. The `action`
-- vocab distinguishes denial KIND (permission.self_elevation_denied vs cost.apply_denied) so
-- role-wall probing and cost-wall probing are separable threat signatures.
CREATE INDEX IF NOT EXISTS audit_log_actor_action_idx
  ON audit_log (business_id, actor_user_id, action, created_at DESC);


-- ════════════════════════════════════════════════════════════════════════════════
-- RLS — INSERT + SELECT only (the absence of UPDATE/DELETE policies IS the immutability)
-- ════════════════════════════════════════════════════════════════════════════════
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- INSERT: an authenticated caller may append a row to THEIR OWN business (owner OR active member),
-- attributed to THEIR OWN actor id (or NULL for service/system context). The actor-id pin is the
-- accountability guard — a member cannot write a row claiming another user as the actor. Tenant
-- scope (AC-3) is the owner-or-active-member check.
CREATE POLICY audit_insert ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      OR public.is_active_member(business_id)
    )
    AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
  );

-- SELECT: owner-only read for now (STATED — the read-scope decision). The business owner sees the
-- full trail for their tenant. Whether active members may read their tenant's trail is deferred
-- (TBD); default owner-only keeps the trail from leaking governance history to staff until that
-- product decision is made. Widening later = one additional permissive SELECT policy, additive.
CREATE POLICY audit_owner_read ON audit_log
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- NOTE: there is intentionally NO `FOR UPDATE` and NO `FOR DELETE` policy. Under RLS, the absence
-- of a permissive policy for a command is a deny. That alone blocks mutation. The trigger + REVOKE
-- below are independent backstops.


-- ════════════════════════════════════════════════════════════════════════════════
-- IMMUTABILITY BACKSTOPS (belt-and-suspenders on the one table where it is the whole point)
-- ════════════════════════════════════════════════════════════════════════════════
-- (1) Trigger: any UPDATE or DELETE raises, regardless of RLS. Owned-by-postgres SECURITY DEFINER
--     per the load-bearing ownership convention. A pure RAISE needs no elevated reads, but keeping
--     it DEFINER + search_path='' matches the other audit/role functions and is harmless.
CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_log_mutation();

-- (2) REVOKE the mutation privileges entirely → even with a future accidental UPDATE/DELETE policy,
--     the underlying table privilege is absent. INSERT/SELECT remain (gated by the RLS policies above).
REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_log FROM anon;


-- ════════════════════════════════════════════════════════════════════════════════
-- CATALOG-VERIFICATION GATE (run AFTER apply, with a short-lived PAT) — CLAUDE.md §9
-- These hit the live catalog, never builder memory. Expected results in [brackets].
-- ════════════════════════════════════════════════════════════════════════════════
-- (A) table exists + RLS enabled:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'audit_log';   [true]
-- (B) the envelope columns + types are present:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_name = 'audit_log' ORDER BY ordinal_position;
--   [id uuid NO, business_id uuid NO, actor_user_id uuid YES, actor_role text YES,
--    action text NO, target_type text YES, target_id text YES, detail jsonb NO,
--    outcome text NO, created_at timestamptz NO]
-- (C) immutability = INSERT + SELECT policies ONLY, no UPDATE/DELETE policy:
--   SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'audit_log'::regclass ORDER BY polname;
--   [audit_insert 'a' (INSERT), audit_owner_read 'r' (SELECT)]   -- NO 'w'(UPDATE)/'d'(DELETE) rows
-- (D) immutability trigger live + fires on UPDATE and DELETE:
--   SELECT tgname, tgenabled, tgtype FROM pg_trigger
--   WHERE tgrelid = 'audit_log'::regclass AND tgname = 'trg_audit_log_immutable';
--   [1 row, tgenabled = 'O']
-- (E) trigger fn owned by postgres + SECURITY DEFINER:
--   SELECT proname, prosecdef, pg_get_userbyid(proowner) AS owner
--   FROM pg_proc WHERE proname = 'reject_audit_log_mutation';
--   [prosecdef = true, owner = postgres]
-- (F) UPDATE/DELETE privileges revoked from authenticated:
--   SELECT privilege_type FROM information_schema.role_table_grants
--   WHERE table_name = 'audit_log' AND grantee = 'authenticated' ORDER BY privilege_type;
--   [does NOT contain UPDATE or DELETE]  (INSERT/SELECT may be present)
-- (G) both indexes present (trail + denied-queryability):
--   SELECT indexname FROM pg_indexes WHERE tablename = 'audit_log'
--   AND indexname IN ('audit_log_business_created_idx','audit_log_actor_action_idx');   [2 rows]
-- (H) FK cascade on business_id:
--   SELECT confdeltype FROM pg_constraint
--   WHERE conrelid = 'audit_log'::regclass AND contype = 'f';   ['c' (CASCADE)]
-- (I) BEHAVIORAL immutability proof (the load-bearing assertion — insert one row, prove it can't move):
--   INSERT INTO audit_log (business_id, action) VALUES
--     ((SELECT id FROM businesses LIMIT 1), 'role.factory_reset');   -- [1 row]
--   UPDATE audit_log SET outcome = 'denied' WHERE action = 'role.factory_reset';  -- [ERROR insufficient_privilege]
--   DELETE FROM audit_log WHERE action = 'role.factory_reset';                    -- [ERROR insufficient_privilege]
--   (run as a non-superuser/anon-key session for the truest proof; as postgres the REVOKE doesn't
--    apply but the TRIGGER still raises — so even superuser cannot UPDATE/DELETE.)
