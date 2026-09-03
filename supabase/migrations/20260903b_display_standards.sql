-- ════════════════════════════════════════════════════════════════════════════════
-- 20260903b — WHERE THE OWNER'S DISPLAY DECISION LIVES (the MUTABLE half)
-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 APPLY AS: postgres, IN THE SQL EDITOR — NEVER the dashboard TABLE EDITOR. This migration
-- CREATES A TABLE, so CLAUDE.md §6 r17 is load-bearing here rather than belt-and-braces: a table
-- made in the table editor is owned by `supabase_admin`, whose default ACL grants TRUNCATE and
-- REFERENCES to `anon` — and RLS cannot filter TRUNCATE. The two paths produce tables that look
-- identical and are not. The SQL editor inherits the corrected `postgres` default (20260728b).
--
-- ── 🔴 WHY A TABLE AT ALL, WHEN THE DECISION IS ALREADY IN `audit_log` ───────────────
-- Because they are TWO THINGS and only one of them can answer "what is current".
--
--   `audit_log`  — HOW THE STANDARD WAS ARRIVED AT. Append-only, immutable by RLS + trigger +
--                  REVOKE. *"3 September: we suggested `30 gal`, the owner chose `30 Gallon`,
--                  applied to 214 items."* That row must never change, because it is the record
--                  of a decision somebody made.
--   THIS TABLE   — WHAT IS CURRENTLY TRUE. Mutable, one row per group, updated when they change
--                  their mind.
--
-- Deriving the current standard by reading the newest matching audit row is the tempting
-- shortcut and it is a projection over an append-only log — it breaks the first time two rows
-- land out of order, and it silently answers "what is current" with "what was written last",
-- which are different questions. §4's own words: *an immutable event log cannot express "this is
-- still current".*
--
-- ── 🔴 `chosen_label` IS NULLABLE ON PURPOSE, AND NULL IS AN ANSWER ──────────────────
-- "Leave it exactly as it is" is a DECISION. A row with `chosen_label IS NULL` means they were
-- asked and declined; NO ROW means they were never asked. Collapsing those two is what makes a
-- normalisation prompt return forever, which is the thing this build exists to stop.
--
-- ── 🔴 THE DISPLAY STANDARD NEVER REWRITES `business_inventory.size` ─────────────────
-- `size` keeps what the grower typed (R-50 / D-23), exactly as 20260830's unit projection does.
-- This table changes how a label is SHOWN. No SKU is invented either — 248 of 250 rows in their
-- pricing tab already match a QuickBooks `FullyQualifiedName`. Standardise the display, keep the
-- identifier.
--
-- ADDITIVE ONLY. One new table. NOTHING existing is altered or dropped.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.business_display_standards (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- Which vocabulary this decision is about. A value, never a table name (AC-1) — the next
  -- domain (a unit name, a category label) is a new value here, not a new table.
  domain        text        NOT NULL,
  -- The parsed-meaning signature the group was keyed by. Stable across imports, which is what
  -- lets a decision survive a re-import rather than being asked again.
  group_key     text        NOT NULL,
  -- NULL = asked and declined. See the header: absent row and NULL row are different facts.
  chosen_label  text,
  -- What we proposed at the time, kept beside what they picked so the row itself shows whether
  -- our suggestion was accepted or overridden without joining back to the log.
  suggested_label text,
  -- How many rows it covered when decided. A count, not a live join — it describes the decision.
  population    integer,
  decided_by    uuid,
  decided_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- One current answer per group. Changing their mind UPDATES this row; the history of that
  -- change lives in audit_log, which is the half that cannot be edited.
  UNIQUE (business_id, domain, group_key)
);

COMMENT ON TABLE public.business_display_standards IS
  'The CURRENT display standard per vocabulary group, per tenant. Mutable by design: audit_log '
  'holds how each standard was arrived at (immutable), this holds what is true now. Deriving '
  '"current" from the newest audit row is a projection over an append-only log and answers a '
  'different question. chosen_label NULL = asked and declined; no row = never asked.';

ALTER TABLE public.business_display_standards ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 TWO POLICIES, AND THE MEMBER ONE IS NOT OPTIONAL — IT IS THE LAUREN CASE.
-- ════════════════════════════════════════════════════════════════════════════════
-- An owner-only policy keyed on `businesses.owner_id` would LOCK LAUREN OUT OF HER OWN TENANT.
-- She holds `role = OWNER` in `business_members` at LAWNS with a `user_id` that is NOT
-- `businesses.owner_id` — the only such row in the database, and exactly what the 2026-08-28
-- ruling gave her. A first draft on the vendor branch tested `owner_id` alone and would have
-- refused her; that is measured, not hypothetical.
--
-- ⚠️ AND IT IS ALREADY LIVE ONE LAYER DOWN: `audit_log`'s `audit_owner_read` is `owner_id`-keyed,
-- so Lauren can WRITE the audit row for her own decision and cannot READ it back. Not fixed here
-- (this migration does not touch audit_log) — NAMED, because a build that silently inherits it
-- would make "the decision is recorded" true and "she can see it" false.
--
-- Mirrors `business_inventory`'s existing owner + active-member pair (20260612), so the two
-- tables cannot drift apart on who may act.
CREATE POLICY business_display_standards_owner_all ON public.business_display_standards
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()));

CREATE POLICY business_display_standards_member_all ON public.business_display_standards
  FOR ALL TO authenticated
  USING      (public.is_active_member(business_id))
  WITH CHECK (public.is_active_member(business_id));

CREATE INDEX IF NOT EXISTS business_display_standards_lookup_idx
  ON public.business_display_standards (business_id, domain);

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run AFTER applying. Catalog-backed, never the builder's memory (§9 gate).
-- ════════════════════════════════════════════════════════════════════════════════
--
-- V1 — the table exists and is owned by `postgres`, NOT `supabase_admin`.
--      🔴 EXPECT tableowner = 'postgres'. `supabase_admin` means it was made in the TABLE EDITOR
--      and carries the anon TRUNCATE/REFERENCES grant that RLS cannot filter (§6 r17).
-- SELECT tablename, tableowner FROM pg_tables
--  WHERE schemaname='public' AND tablename='business_display_standards';
--
-- V2 — 🔴 the anon ACL fingerprint. EXPECT NO rows. Any TRUNCATE/REFERENCES for anon = r17.
-- SELECT grantee, privilege_type
--   FROM (SELECT (aclexplode(relacl)).grantee::regrole::text AS grantee,
--                (aclexplode(relacl)).privilege_type AS privilege_type
--           FROM pg_class WHERE relname='business_display_standards') g
--  WHERE grantee='anon' AND privilege_type IN ('TRUNCATE','REFERENCES');
--
-- V3 — RLS is ON and BOTH policies exist. EXPECT rowsecurity=true and 2 rows.
--      🔴 If only the owner policy exists, Lauren is locked out of her own tenant — see above.
-- SELECT c.relrowsecurity AS rls_enabled FROM pg_class c
--   JOIN pg_namespace n ON n.oid=c.relnamespace
--  WHERE n.nspname='public' AND c.relname='business_display_standards';
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='business_display_standards' ORDER BY policyname;
--
-- V4 — the uniqueness that makes "one current answer per group" true. EXPECT 1 unique index.
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname='public' AND tablename='business_display_standards'
--    AND indexdef ILIKE '%UNIQUE%';
--
-- V5 — 🔴 NOTHING WAS DECIDED BY APPLYING THIS. EXPECT 0.
-- SELECT count(*) FROM public.business_display_standards;
