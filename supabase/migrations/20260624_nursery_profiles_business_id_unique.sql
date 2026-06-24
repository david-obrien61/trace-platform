-- Migration: add UNIQUE constraint on nursery_profiles.business_id
-- Project: bgobkjcopcxusjsetfob (cultivar-os) — run in Supabase SQL editor as postgres
-- GATED — David applies. Do NOT auto-run.
--
-- WHY: OnboardingWizard finalize() upserts nursery_profiles with
--   .upsert({ business_id }, { onConflict: 'business_id' })
-- but business_id has no unique/exclusion constraint, so Postgres raises 42P10
-- ("no unique or exclusion constraint matching the ON CONFLICT specification")
-- → PostgREST 400 on every onboarding completion. A nursery_profiles row is 1:1
-- with a business, so business_id SHOULD be unique — this both fixes ON CONFLICT
-- and enforces the real invariant.
--
-- PRE-APPLY CHECK (must return zero rows, else dedup first):
--   SELECT business_id, count(*) FROM nursery_profiles
--   GROUP BY business_id HAVING count(*) > 1;

ALTER TABLE nursery_profiles
  ADD CONSTRAINT nursery_profiles_business_id_key UNIQUE (business_id);

-- VERIFY (catalog-backed, run after apply):
--   SELECT conname, contype FROM pg_constraint
--   WHERE conrelid = 'nursery_profiles'::regclass AND contype = 'u';
--   -- expect: nursery_profiles_business_id_key | u
