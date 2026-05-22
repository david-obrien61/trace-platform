-- RLS SELECT policies: modules catalog + nursery module config.
--
-- Root cause: both tables have RLS enabled but no permissive read
-- policies. Authenticated frontend reads return [] silently, causing
-- all module tile states to fall through to 'available'.
--
-- modules: public catalog data. Any authenticated user may read.
--
-- nursery_modules: any authenticated user may read.
-- TODO post-demo: tighten nursery_modules policy to owner_id
-- join once nurseries.owner_id is populated
-- See CLAUDE.md Part 7 Off Limits for post-demo refactor list

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE nursery_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_modules"
  ON modules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_select_nursery_modules"
  ON nursery_modules
  FOR SELECT
  TO authenticated
  USING (true);
