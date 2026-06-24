-- Migration: REVOKE TRUNCATE on audit_log from untrusted roles (append-only hardening)
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-06-24
-- Branch: main
--
-- ⚠️  REPO-AUTHORITY RECORD — ALREADY APPLIED MANUALLY, DO NOT RE-RUN BLINDLY.
--   This statement was applied manually by the owner (David) as the `postgres` role on
--   2026-06-24 during the audit_log spine (#19) owner-proof. It is recorded here so the repo
--   matches deployed reality and a fresh rebuild reproduces the fix. It is idempotent and safe
--   to re-run (REVOKE of an absent privilege is a no-op). postgres (table owner) intentionally
--   RETAINS TRUNCATE.
--
-- ── WHY THIS EXISTS (the flag the catalog gate caught) ──────────────────────────────
-- The audit_log spine (20260623_audit_log_spine.sql) enforces append-only immutability THREE
-- ways: RLS (INSERT+SELECT policies only, no UPDATE/DELETE), a BEFORE UPDATE OR DELETE row
-- trigger, and REVOKE UPDATE, DELETE. But TRUNCATE is a FOURTH mutation path that bypasses BOTH
-- RLS AND FOR EACH ROW triggers — the row-level immutability trigger never fires on TRUNCATE.
-- The post-apply grantee check found TRUNCATE held by anon, authenticated, service_role, postgres
-- — a live hole through which history could be erased wholesale. Revoking it from the three
-- untrusted roles closes the side door; the row trigger + REVOKE UPDATE,DELETE cover the rest.
--
-- LESSON (durable): append-only tables must REVOKE TRUNCATE from untrusted roles — the
-- immutability trigger alone is insufficient because the row trigger does not fire on TRUNCATE.

REVOKE TRUNCATE ON public.audit_log FROM anon, authenticated, service_role;

-- ── POST-APPLY VERIFICATION (already confirmed 2026-06-24) ──────────────────────────
-- Grantee for TRUNCATE on audit_log is now `postgres` ONLY:
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name = 'audit_log' AND privilege_type = 'TRUNCATE';   [grantee = postgres only]
