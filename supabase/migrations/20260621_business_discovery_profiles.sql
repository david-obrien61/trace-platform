-- ============================================================
-- Migration: business_discovery_profiles
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Capability 1.3 — catalog-populate. Stores the structured CATALOG
--   extracted from a business's LIVE website (the audit/source-of-truth
--   for what was pulled, with per-item extraction confidence), so a
--   populate run is replayable and the honesty trail is preserved.
-- AC-1: no vertical nouns — business_ prefix only. raw_extract is a
--   value (jsonb), never a vertical-named column.
-- AC-2: RLS scoped to businesses.owner_id + active business_members.
-- AC-3: tenant isolation — a profile is reachable ONLY through the
--   owning business; no cross-tenant path.
-- Date: 2026-06-21 (verified via `date` command).
-- ⚠️  APPLY MANUALLY in Supabase SQL editor — do NOT execute without
--     David's explicit "run it" approval. NEW TABLE ONLY — this migration
--     ADDS one table and touches NO existing table's columns or data
--     (byte-identical discipline: no ALTER, no backfill, no DROP).
-- ============================================================
-- Pre-write verify (completed before writing):
--   business_discovery_profiles → ABSENT (404) — new table ✅
--   businesses                  → PRESENT — FK target + owner_id RLS target ✅
--   business_members            → PRESENT — business_id/user_id/active RLS target ✅
--   set_updated_at_generic()    → PRESENT (20260604_business_modules.sql) — reused ✅
-- ============================================================

CREATE TABLE business_discovery_profiles (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_url   text         NOT NULL,
  -- The full structured extraction: { items: [{ variety, category, confidence,
  --   flagged, flagReason }], counts, crawl meta }. The honesty trail — what was
  --   pulled, how sure we were, and what got flagged for review. jsonb so the
  --   shape can grow without a migration (AC-1: variation is a value).
  raw_extract  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  -- Lifecycle of the populate: 'extracted' (pulled, not yet written),
  --   'populated' (written to inventory), 'cleared' (rows removed). Free text,
  --   NO CHECK — the value-set grows without a migration (cost_source precedent).
  status       text         NOT NULL DEFAULT 'extracted',
  extracted_at timestamptz  NOT NULL DEFAULT now(),
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  -- One live profile per (business, source site) — re-runs upsert in place.
  UNIQUE (business_id, source_url)
);

ALTER TABLE business_discovery_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_discovery_profiles_owner_all ON business_discovery_profiles
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_discovery_profiles.business_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = business_discovery_profiles.business_id
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY business_discovery_profiles_member_all ON business_discovery_profiles
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = business_discovery_profiles.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = business_discovery_profiles.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  );

-- updated_at trigger — reuses set_updated_at_generic() (20260604_business_modules.sql)
DROP TRIGGER IF EXISTS business_discovery_profiles_updated_at ON business_discovery_profiles;
CREATE TRIGGER business_discovery_profiles_updated_at
  BEFORE UPDATE ON business_discovery_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

-- ============================================================
-- END OF MIGRATION
-- Verification (run after applying):
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name='business_discovery_profiles';
--   -- expect 1 row
--   SELECT relrowsecurity FROM pg_class WHERE relname='business_discovery_profiles';
--   -- expect t
--   Full catalog-backed proof: node scripts/verify-discovery-profiles.mjs
-- ============================================================
