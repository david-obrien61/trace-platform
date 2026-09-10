-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 20260910b — THE 49 RAW `owner_id` POLICIES ARE TRIAGED: WORK BECOMES A PERMISSION, ENTITY STAYS.
-- 2026-09-10 · David's test: "Is this about the BUSINESS ENTITY, or about the WORK?"
--              ENTITY — who owns it, who is billed, who it transfers to. Nobody delegates these.
--              WORK   — pricing, inventory, orders, customers, settings. Delegable by SOME business.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes. (CLAUDE.md §6 r1.)
--
-- ── THE PROBLEM, IN ONE SENTENCE ────────────────────────────────────────────────────────────────
-- Lauren Bishop is an ACTIVE OWNER-ROLE member of LAWNS holding all 57 permission strings, and she
-- is NOT `businesses.owner_id` (David is). 49 live policies compare the raw column instead of
-- calling `is_business_owner()` (which 20260828 widened, and whose own comment names her case), so
-- every one of them refuses her for reasons that were never about ownership.
--
-- ── THE DISPOSITION OF ALL 49 — no policy is left unaccounted for ───────────────────────────────
--   28  REPOINTED  at the permission string the triage named (24 in place · 2 split PER VERB ·
--                  1 narrowed to INSERT-on-owner_id · 1 repointed + a new read policy)
--   10  DROPPED    as redundant — every command they span is already gated per-verb on the right
--                  string by a sibling member policy. Repointing a FOR ALL policy at ONE string
--                  would GRANT DELETE ON THAT STRING, widening past the per-verb set it duplicates.
--    8  KEPT RAW   with the comment none of them had, saying WHY (entity · authority store · R2)
--    3  UNTOUCHED  on EMPTY tables pending DROP (`losses`, `nurseries` ×2 — GATED 20260727d)
--   ──
--   49  docs/decisions/2026-09-10-owner-id-repoint-plan.md carries the row-by-row table, and
--       `scripts/verify-owner-id-repoint.mjs` FAILS THE BUILD if this file and that table disagree
--       in either direction.
--
-- 🔴 THE DIVERGENCE FROM THE LITERAL INSTRUCTION, STATED RATHER THAN BURIED (§6 r10). The build
--    prompt said each of the 46 WORK policies "becomes USING(is_active_member AND has_permission)".
--    Ten of them cannot: they are `FOR ALL` policies on tables that ALREADY carry a complete
--    per-verb member set (`business_inventory` has four, `receipts` four, `cost_objects` four …).
--    A `FOR ALL` policy gated on `costs:update` would let an update-string holder DELETE — the
--    exact separation those four policies exist to make. So on those ten the repoint is a DROP,
--    and the sibling policies are named in the drop comment as the proof access is preserved.
--
-- ── WHAT THIS DOES NOT DO, AND WHY ──────────────────────────────────────────────────────────────
-- ⚠️ `business_members`, `role_definitions` and `invitations` KEEP raw owner_id. They are not
--    "work" — they ARE the authority store, and 20260828's header already ruled on the mechanism:
--    the permission trigger is `BEFORE UPDATE` ONLY, so a member INSERT policy on
--    `business_members` is a permission-granting side door with no funnel and no audit row. A
--    repoint would open it. Their triage string (`team:update`) is ALSO `declared-unwired`
--    (tech-debt #90), so the repoint would in fact admit NOBODY — including the account holder.
-- ⚠️ `service_offerings_owner` KEEPS raw owner_id. 20260828's own V6 asserts that NO member DELETE
--    policy may appear on that table (R2 — a service is retired, not deleted). A FOR ALL repoint
--    creates one. Lauren already reads, adds and edits services through the three member policies.
-- ⚠️ `businesses_owner_update` KEEPS raw owner_id — ROUTE A. See §5.
-- ⚠️ `audit_log.audit_insert` KEEPS raw owner_id. `audit_log:write` is deliberately NOT minted:
--    the system writes the log as a side effect of a permitted action, so no human needs the
--    string, and a string that must never be granted is `pricing_recipe:create` again.
--
-- ── 🔴 WHY THIS DOES NOT STRAND A NEW ACCOUNT HOLDER — MEASURED, NOT ASSUMED ────────────────────
-- Every repointed policy now requires a `business_members` row rather than `businesses.owner_id`.
-- That is only safe if creating a business also creates that row. It does, on BOTH create paths:
-- `OnboardingWizard.tsx:559` inserts the OWNER member row seeded from the resolved floor, and
-- OwnerSignup covers the modern path (the comment at :557 says so). `bm_owner_all` — the policy
-- that INSERT rides — is one of the eight kept raw, deliberately.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §0 — PRE-FLIGHT. Fail LOUDLY rather than half-applying.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
DO $preflight$
DECLARE
  v_missing text;
BEGIN
  -- (a) both predicates must exist, or every policy below silently fails to create.
  IF to_regprocedure('public.is_active_member(uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_active_member(uuid) is absent — refusing to write the 31 policies that call it.';
  END IF;
  IF to_regprocedure('public.has_permission(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'has_permission(uuid, text) is absent — refusing to write the 31 policies that call it.';
  END IF;

  -- (b) 🔴 has_permission MUST already be LITERAL (20260910). If it still expands aliases, the
  --     strings below do not mean what this file says they mean.
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_permission'
                   AND prosrc LIKE '%permissions ? p_perm%') THEN
    RAISE EXCEPTION 'has_permission is not the LITERAL form — apply 20260910_permission_literal_merge.sql first.';
  END IF;

  -- (c) the OWNER floor row must exist — §6 UPDATEs it, and an UPDATE matching zero rows is silent.
  IF NOT EXISTS (SELECT 1 FROM public.role_definitions
                  WHERE business_id IS NULL AND role_key = 'OWNER') THEN
    RAISE EXCEPTION 'the OWNER floor row (business_id IS NULL) is absent — §6 would silently grant nothing.';
  END IF;

  -- (d) every table this migration writes a policy on must exist.
  SELECT string_agg(t, ', ') INTO v_missing FROM (
    SELECT unnest(ARRAY['addons','audit_log','business_accounting_secrets','business_discovery_profiles',
                        'business_display_standards','business_inventory','business_inventory_ledger',
                        'business_operating_days','business_pmi_schedule','business_pricing_config',
                        'business_service_log','business_voice_samples','campaign_posts','campaigns',
                        'cost_object_assignments','cost_object_edges','cost_objects','cultivar_plants',
                        'customers','deliveries','inventory_count_sessions','inventory_counts',
                        'labor_resource_wages','labor_resources','member_device_handoffs','member_devices',
                        'nursery_profiles','opportunity_items','order_addons','order_compliance_records',
                        'order_items','order_service_selections','orders','plant_events','receipts',
                        'social_drafts','vendor_preferences','businesses','business_members',
                        'role_definitions','invitations','service_offerings']) AS t
  ) x WHERE to_regclass('public.' || t) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'these tables are absent and the plan named them: %', v_missing;
  END IF;
END $preflight$;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §1 — CAPTURE BEFORE CHANGE. Two of the policies below live in NO migration.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- David's ruling (2026-09-10): CAPTURE-THEN-DECIDE. `docs/decisions/2026-09-10-policy-reconciliation.md`
-- found TEN live policies created by nothing in the corpus — legacy, pre-migration or hand-applied.
-- Two of the ten are in this pass, and one of them is DROPPED here, so without this section its
-- definition would leave the database having never been written down anywhere.
--
-- 🔴 These are RECORDED, not executed. They are what the catalog held on 2026-09-10, read with the
--    PAT, verbatim from `pg_policies`:
--
--   business_voice_samples.business_voice_samples_owner  [ALL, TO public]
--     USING (business_id IN (SELECT businesses.id FROM businesses
--                             WHERE businesses.owner_id = auth.uid()))
--     WITH CHECK: NULL  (so USING governed writes too)
--
--   cost_objects.cost_objects_owner_all  [ALL, TO public]
--     USING      (EXISTS (SELECT 1 FROM businesses
--                          WHERE businesses.id = cost_objects.business_id
--                            AND businesses.owner_id = auth.uid()))
--     WITH CHECK (EXISTS (SELECT 1 FROM businesses
--                          WHERE businesses.id = cost_objects.business_id
--                            AND businesses.owner_id = auth.uid()))
--
-- The OTHER EIGHT undocumented policies are NOT touched by this migration and remain uncaptured:
-- `addons_select_public`, `cultivar_plants.anon_select_plants`, `losses_all_owner`,
-- `modules readable by authenticated users`, `nurseries_select_public`, `nurseries_update_owner`,
-- `plant_events.anon_select_plant_events`, `plant_events_select_public`. Five of those are the open
-- `USING(true)` public-QR grants and they are their own decision (out of scope, David's ruling).

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §2 — THE 28 REPOINTS. WORK becomes a permission.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Shape, uniform and deliberate: `TO authenticated` (was `TO public` on most — a tightening that
-- costs nothing, since has_permission returns false for a NULL auth.uid() anyway), and
-- `is_active_member(business_id) AND has_permission(business_id, '<string>')` on USING, and on
-- WITH CHECK where the command has one. `is_active_member` is strictly redundant — has_permission
-- already requires `bm.active = true` — and it is kept because the pair states the intent in the
-- policy body, where the next reader is standing.
DROP POLICY IF EXISTS addons_business_owner ON public.addons;
CREATE POLICY addons_business_owner ON public.addons
  FOR ALL TO authenticated
  USING (public.is_active_member(addons.business_id)
         AND public.has_permission(addons.business_id, 'service_offerings:update'))
  WITH CHECK (public.is_active_member(addons.business_id)
         AND public.has_permission(addons.business_id, 'service_offerings:update'));
COMMENT ON POLICY addons_business_owner ON public.addons IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + service_offerings:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS audit_owner_read ON public.audit_log;
CREATE POLICY audit_owner_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_active_member(audit_log.business_id)
         AND public.has_permission(audit_log.business_id, 'audit_log:read'));
COMMENT ON POLICY audit_owner_read ON public.audit_log IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + audit_log:read. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS bas_owner_all ON public.business_accounting_secrets;
CREATE POLICY bas_owner_all ON public.business_accounting_secrets
  FOR ALL TO authenticated
  USING (public.is_active_member(business_accounting_secrets.business_id)
         AND public.has_permission(business_accounting_secrets.business_id, 'accounting:connect'))
  WITH CHECK (public.is_active_member(business_accounting_secrets.business_id)
         AND public.has_permission(business_accounting_secrets.business_id, 'accounting:connect'));
COMMENT ON POLICY bas_owner_all ON public.business_accounting_secrets IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + accounting:connect. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS business_discovery_profiles_owner_all ON public.business_discovery_profiles;
CREATE POLICY business_discovery_profiles_owner_all ON public.business_discovery_profiles
  FOR ALL TO authenticated
  USING (public.is_active_member(business_discovery_profiles.business_id)
         AND public.has_permission(business_discovery_profiles.business_id, 'settings:update'))
  WITH CHECK (public.is_active_member(business_discovery_profiles.business_id)
         AND public.has_permission(business_discovery_profiles.business_id, 'settings:update'));
COMMENT ON POLICY business_discovery_profiles_owner_all ON public.business_discovery_profiles IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + settings:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS business_display_standards_owner_all ON public.business_display_standards;
CREATE POLICY business_display_standards_owner_all ON public.business_display_standards
  FOR ALL TO authenticated
  USING (public.is_active_member(business_display_standards.business_id)
         AND public.has_permission(business_display_standards.business_id, 'settings:update'))
  WITH CHECK (public.is_active_member(business_display_standards.business_id)
         AND public.has_permission(business_display_standards.business_id, 'settings:update'));
COMMENT ON POLICY business_display_standards_owner_all ON public.business_display_standards IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + settings:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS business_inventory_ledger_owner_all ON public.business_inventory_ledger;
CREATE POLICY business_inventory_ledger_owner_all ON public.business_inventory_ledger
  FOR ALL TO authenticated
  USING (public.is_active_member(business_inventory_ledger.business_id)
         AND public.has_permission(business_inventory_ledger.business_id, 'inventory_ledger:read'))
  WITH CHECK (public.is_active_member(business_inventory_ledger.business_id)
         AND public.has_permission(business_inventory_ledger.business_id, 'inventory_ledger:read'));
COMMENT ON POLICY business_inventory_ledger_owner_all ON public.business_inventory_ledger IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + inventory_ledger:read. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS business_pmi_schedule_owner_all ON public.business_pmi_schedule;
CREATE POLICY business_pmi_schedule_owner_all ON public.business_pmi_schedule
  FOR ALL TO authenticated
  USING (public.is_active_member(business_pmi_schedule.business_id)
         AND public.has_permission(business_pmi_schedule.business_id, 'pmi:update'))
  WITH CHECK (public.is_active_member(business_pmi_schedule.business_id)
         AND public.has_permission(business_pmi_schedule.business_id, 'pmi:update'));
COMMENT ON POLICY business_pmi_schedule_owner_all ON public.business_pmi_schedule IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + pmi:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS business_service_log_owner_all ON public.business_service_log;
CREATE POLICY business_service_log_owner_all ON public.business_service_log
  FOR ALL TO authenticated
  USING (public.is_active_member(business_service_log.business_id)
         AND public.has_permission(business_service_log.business_id, 'pmi:update'))
  WITH CHECK (public.is_active_member(business_service_log.business_id)
         AND public.has_permission(business_service_log.business_id, 'pmi:update'));
COMMENT ON POLICY business_service_log_owner_all ON public.business_service_log IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + pmi:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS business_voice_samples_owner ON public.business_voice_samples;
CREATE POLICY business_voice_samples_owner ON public.business_voice_samples
  FOR ALL TO authenticated
  USING (public.is_active_member(business_voice_samples.business_id)
         AND public.has_permission(business_voice_samples.business_id, 'campaigns:update'))
  WITH CHECK (public.is_active_member(business_voice_samples.business_id)
         AND public.has_permission(business_voice_samples.business_id, 'campaigns:update'));
COMMENT ON POLICY business_voice_samples_owner ON public.business_voice_samples IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + campaigns:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS campaign_posts_owner ON public.campaign_posts;
CREATE POLICY campaign_posts_owner ON public.campaign_posts
  FOR ALL TO authenticated
  USING (public.is_active_member(campaign_posts.business_id)
         AND public.has_permission(campaign_posts.business_id, 'campaigns:update'))
  WITH CHECK (public.is_active_member(campaign_posts.business_id)
         AND public.has_permission(campaign_posts.business_id, 'campaigns:update'));
COMMENT ON POLICY campaign_posts_owner ON public.campaign_posts IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + campaigns:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS campaigns_owner ON public.campaigns;
CREATE POLICY campaigns_owner ON public.campaigns
  FOR ALL TO authenticated
  USING (public.is_active_member(campaigns.business_id)
         AND public.has_permission(campaigns.business_id, 'campaigns:update'))
  WITH CHECK (public.is_active_member(campaigns.business_id)
         AND public.has_permission(campaigns.business_id, 'campaigns:update'));
COMMENT ON POLICY campaigns_owner ON public.campaigns IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + campaigns:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS cultivar_plants_owner_select ON public.cultivar_plants;
CREATE POLICY cultivar_plants_owner_select ON public.cultivar_plants
  FOR SELECT TO authenticated
  USING (public.is_active_member(cultivar_plants.business_id)
         AND public.has_permission(cultivar_plants.business_id, 'inventory:read'));
COMMENT ON POLICY cultivar_plants_owner_select ON public.cultivar_plants IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + inventory:read. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS customers_business_owner ON public.customers;
CREATE POLICY customers_business_owner ON public.customers
  FOR ALL TO authenticated
  USING (public.is_active_member(customers.business_id)
         AND public.has_permission(customers.business_id, 'customers:update'))
  WITH CHECK (public.is_active_member(customers.business_id)
         AND public.has_permission(customers.business_id, 'customers:update'));
COMMENT ON POLICY customers_business_owner ON public.customers IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + customers:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS inventory_count_sessions_owner_all ON public.inventory_count_sessions;
CREATE POLICY inventory_count_sessions_owner_all ON public.inventory_count_sessions
  FOR ALL TO authenticated
  USING (public.is_active_member(inventory_count_sessions.business_id)
         AND public.has_permission(inventory_count_sessions.business_id, 'inventory:update'))
  WITH CHECK (public.is_active_member(inventory_count_sessions.business_id)
         AND public.has_permission(inventory_count_sessions.business_id, 'inventory:update'));
COMMENT ON POLICY inventory_count_sessions_owner_all ON public.inventory_count_sessions IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + inventory:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS inventory_counts_owner_all ON public.inventory_counts;
CREATE POLICY inventory_counts_owner_all ON public.inventory_counts
  FOR ALL TO authenticated
  USING (public.is_active_member(inventory_counts.business_id)
         AND public.has_permission(inventory_counts.business_id, 'inventory:update'))
  WITH CHECK (public.is_active_member(inventory_counts.business_id)
         AND public.has_permission(inventory_counts.business_id, 'inventory:update'));
COMMENT ON POLICY inventory_counts_owner_all ON public.inventory_counts IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + inventory:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS mdh_owner_all ON public.member_device_handoffs;
CREATE POLICY mdh_owner_all ON public.member_device_handoffs
  FOR ALL TO authenticated
  USING (public.is_active_member(member_device_handoffs.business_id)
         AND public.has_permission(member_device_handoffs.business_id, 'devices:manage'))
  WITH CHECK (public.is_active_member(member_device_handoffs.business_id)
         AND public.has_permission(member_device_handoffs.business_id, 'devices:manage'));
COMMENT ON POLICY mdh_owner_all ON public.member_device_handoffs IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + devices:manage. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS md_owner_all ON public.member_devices;
CREATE POLICY md_owner_all ON public.member_devices
  FOR ALL TO authenticated
  USING (public.is_active_member(member_devices.business_id)
         AND public.has_permission(member_devices.business_id, 'devices:manage'))
  WITH CHECK (public.is_active_member(member_devices.business_id)
         AND public.has_permission(member_devices.business_id, 'devices:manage'));
COMMENT ON POLICY md_owner_all ON public.member_devices IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + devices:manage. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS nursery_profiles_owner ON public.nursery_profiles;
CREATE POLICY nursery_profiles_owner ON public.nursery_profiles
  FOR ALL TO authenticated
  USING (public.is_active_member(nursery_profiles.business_id)
         AND public.has_permission(nursery_profiles.business_id, 'settings:update'))
  WITH CHECK (public.is_active_member(nursery_profiles.business_id)
         AND public.has_permission(nursery_profiles.business_id, 'settings:update'));
COMMENT ON POLICY nursery_profiles_owner ON public.nursery_profiles IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + settings:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS nursery_profiles_member_select ON public.nursery_profiles;
CREATE POLICY nursery_profiles_member_select ON public.nursery_profiles
  FOR SELECT TO authenticated
  USING (public.is_active_member(nursery_profiles.business_id)
         AND public.has_permission(nursery_profiles.business_id, 'settings:read'));
COMMENT ON POLICY nursery_profiles_member_select ON public.nursery_profiles IS
  'THE READ IS GATED ON THE READ STRING, NOT THE WRITE STRING (tech-debt #236). Before this, the '
  'table carried ONE policy — raw owner_id — so a member read ZERO ROWS and the install-price field '
  'rendered BLANK, indistinguishable from not-set (D-9).';

DROP POLICY IF EXISTS opportunity_items_owner ON public.opportunity_items;
CREATE POLICY opportunity_items_owner ON public.opportunity_items
  FOR ALL TO authenticated
  USING (public.is_active_member(opportunity_items.business_id)
         AND public.has_permission(opportunity_items.business_id, 'service_offerings:update'))
  WITH CHECK (public.is_active_member(opportunity_items.business_id)
         AND public.has_permission(opportunity_items.business_id, 'service_offerings:update'));
COMMENT ON POLICY opportunity_items_owner ON public.opportunity_items IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + service_offerings:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS order_addons_owner ON public.order_addons;
CREATE POLICY order_addons_owner ON public.order_addons
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o
                 WHERE o.id = order_addons.order_id
                   AND public.is_active_member(o.business_id)
                   AND public.has_permission(o.business_id, 'order_items:update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o
                 WHERE o.id = order_addons.order_id
                   AND public.is_active_member(o.business_id)
                   AND public.has_permission(o.business_id, 'order_items:update')));
COMMENT ON POLICY order_addons_owner ON public.order_addons IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + order_items:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS order_items_owner ON public.order_items;
CREATE POLICY order_items_owner ON public.order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o
                 WHERE o.id = order_items.order_id
                   AND public.is_active_member(o.business_id)
                   AND public.has_permission(o.business_id, 'order_items:update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o
                 WHERE o.id = order_items.order_id
                   AND public.is_active_member(o.business_id)
                   AND public.has_permission(o.business_id, 'order_items:update')));
COMMENT ON POLICY order_items_owner ON public.order_items IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + order_items:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS order_service_selections_owner ON public.order_service_selections;
CREATE POLICY order_service_selections_owner ON public.order_service_selections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o
                 WHERE o.id = order_service_selections.order_id
                   AND public.is_active_member(o.business_id)
                   AND public.has_permission(o.business_id, 'order_service_selections:update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o
                 WHERE o.id = order_service_selections.order_id
                   AND public.is_active_member(o.business_id)
                   AND public.has_permission(o.business_id, 'order_service_selections:update')));
COMMENT ON POLICY order_service_selections_owner ON public.order_service_selections IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + order_service_selections:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS plant_events_business_owner ON public.plant_events;
CREATE POLICY plant_events_business_owner ON public.plant_events
  FOR ALL TO authenticated
  USING (public.is_active_member(plant_events.business_id)
         AND public.has_permission(plant_events.business_id, 'inventory:update'))
  WITH CHECK (public.is_active_member(plant_events.business_id)
         AND public.has_permission(plant_events.business_id, 'inventory:update'));
COMMENT ON POLICY plant_events_business_owner ON public.plant_events IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + inventory:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS social_drafts_business_owner ON public.social_drafts;
CREATE POLICY social_drafts_business_owner ON public.social_drafts
  FOR ALL TO authenticated
  USING (public.is_active_member(social_drafts.business_id)
         AND public.has_permission(social_drafts.business_id, 'campaigns:update'))
  WITH CHECK (public.is_active_member(social_drafts.business_id)
         AND public.has_permission(social_drafts.business_id, 'campaigns:update'));
COMMENT ON POLICY social_drafts_business_owner ON public.social_drafts IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + campaigns:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';

DROP POLICY IF EXISTS vendor_preferences_owner_all ON public.vendor_preferences;
CREATE POLICY vendor_preferences_owner_all ON public.vendor_preferences
  FOR ALL TO authenticated
  USING (public.is_active_member(vendor_preferences.business_id)
         AND public.has_permission(vendor_preferences.business_id, 'costs:update'))
  WITH CHECK (public.is_active_member(vendor_preferences.business_id)
         AND public.has_permission(vendor_preferences.business_id, 'costs:update'));
COMMENT ON POLICY vendor_preferences_owner_all ON public.vendor_preferences IS
  'WORK, not ownership (2026-09-10 triage). Was raw businesses.owner_id; now membership + costs:update. '
  'An OWNER-ROLE member who is not the account holder is admitted by the string she holds.';


-- ── 🔴 TWO OF THE 28 ARE SPLIT PER VERB, NOT REPOINTED AS ONE `FOR ALL` POLICY ─────────────────
-- Same reason the ten drops exist, arriving from the other side. A `FOR ALL` policy gated on ONE
-- string grants EVERY verb on that string, and on these two tables that would hand a live principal
-- a verb the model deliberately separates:
--   · `deliveries`      — repointed at `deliveries:update` it would grant INSERT. `deliveries` has a
--                         distinct `create` verb, and Joel (MANAGER) holds update and NOT create.
--                         Read and update are already covered by the two member policies, so only
--                         INSERT and DELETE were ever uncovered. DELETE rides `deliveries:update`,
--                         the resource having no delete verb — the same convention
--                         `business_operating_days_member_delete` already uses for `settings`.
--   · `cultivar_plants` — worse: the table has NO member policies at all, so a `FOR ALL` repoint at
--                         `inventory:update` would grant DELETE to an update-string holder, and
--                         `inventory` separates all four verbs.
--     ⚠️ AND THIS ONE NARROWS FOR STAFF, DELIBERATELY. `cultivar_plants_owner_all` read
--        `owner_id OR is_active_member(business_id)`, so ANY active member could write the
--        CATALOGUE — including STAFF, who hold `inventory:read` and nothing else. After this they
--        cannot. The count/promote path writes `business_inventory`, not `cultivar_plants`, so
--        nothing on the walk-and-count loop depends on it. **Named because it is a real change to
--        who can do what, not because it is in doubt.**

DROP POLICY IF EXISTS cultivar_plants_owner_all ON public.cultivar_plants;
DROP POLICY IF EXISTS cultivar_plants_member_insert ON public.cultivar_plants;
CREATE POLICY cultivar_plants_member_insert ON public.cultivar_plants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(cultivar_plants.business_id)
         AND public.has_permission(cultivar_plants.business_id, 'inventory:create'));
COMMENT ON POLICY cultivar_plants_member_insert ON public.cultivar_plants IS
  'WORK, not ownership (2026-09-10 triage) — and SPLIT PER VERB rather than repointed as one FOR ALL '
  'policy, because a FOR ALL gated on ONE string grants EVERY verb on that string. INSERT tests inventory:create.';
DROP POLICY IF EXISTS cultivar_plants_member_update ON public.cultivar_plants;
CREATE POLICY cultivar_plants_member_update ON public.cultivar_plants
  FOR UPDATE TO authenticated
  USING (public.is_active_member(cultivar_plants.business_id)
         AND public.has_permission(cultivar_plants.business_id, 'inventory:update'));
COMMENT ON POLICY cultivar_plants_member_update ON public.cultivar_plants IS
  'WORK, not ownership (2026-09-10 triage) — and SPLIT PER VERB rather than repointed as one FOR ALL '
  'policy, because a FOR ALL gated on ONE string grants EVERY verb on that string. UPDATE tests inventory:update.';
DROP POLICY IF EXISTS cultivar_plants_member_delete ON public.cultivar_plants;
CREATE POLICY cultivar_plants_member_delete ON public.cultivar_plants
  FOR DELETE TO authenticated
  USING (public.is_active_member(cultivar_plants.business_id)
         AND public.has_permission(cultivar_plants.business_id, 'inventory:delete'));
COMMENT ON POLICY cultivar_plants_member_delete ON public.cultivar_plants IS
  'WORK, not ownership (2026-09-10 triage) — and SPLIT PER VERB rather than repointed as one FOR ALL '
  'policy, because a FOR ALL gated on ONE string grants EVERY verb on that string. DELETE tests inventory:delete.';

DROP POLICY IF EXISTS deliveries_owner_all ON public.deliveries;
DROP POLICY IF EXISTS deliveries_member_insert ON public.deliveries;
CREATE POLICY deliveries_member_insert ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(deliveries.business_id)
         AND public.has_permission(deliveries.business_id, 'deliveries:create'));
COMMENT ON POLICY deliveries_member_insert ON public.deliveries IS
  'WORK, not ownership (2026-09-10 triage) — and SPLIT PER VERB rather than repointed as one FOR ALL '
  'policy, because a FOR ALL gated on ONE string grants EVERY verb on that string. INSERT tests deliveries:create.';
DROP POLICY IF EXISTS deliveries_member_delete ON public.deliveries;
CREATE POLICY deliveries_member_delete ON public.deliveries
  FOR DELETE TO authenticated
  USING (public.is_active_member(deliveries.business_id)
         AND public.has_permission(deliveries.business_id, 'deliveries:update'));
COMMENT ON POLICY deliveries_member_delete ON public.deliveries IS
  'WORK, not ownership (2026-09-10 triage) — and SPLIT PER VERB rather than repointed as one FOR ALL '
  'policy, because a FOR ALL gated on ONE string grants EVERY verb on that string. DELETE tests deliveries:update.';


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §3 — THE OTHER SPLIT: `bpc_owner_all` → `bpc_owner_insert`. THE INSERT DOOR STAYS SHUT.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 THE INSTRUCTION THIS OBEYS, VERBATIM: "MUST NOT quietly restore a member INSERT — that
--    re-creates capP assertion 5, which is why `bpc_member_insert` was dropped in the first place."
-- `business_pricing_config` already carries `bpc_member_select` (pricing_recipe:read) and
-- `bpc_member_update` (pricing_recipe:update). `bpc_owner_all` adds exactly two things: INSERT and
-- DELETE. Repointing it FOR ALL at `pricing_recipe:update` would hand a permission named *update*
-- the power to CREATE — which is the assertion, and the reason `pricing_recipe` has no create verb
-- at all (20260727_rbac_flip_corrections.sql:85, deliberate).
--
-- So the policy is NARROWED to INSERT and KEPT on raw owner_id. The row is seeded once per tenant
-- (`seedPricingConfig` at both create paths); after that nothing inserts.
-- ⚠️ THE CONSEQUENCE, STATED: on a tenant whose config row is missing, ONLY the account holder can
--    create it. Lauren can edit LAWNS's row (it exists) and could not create one from nothing. That
--    is deliberate here and it is the shape of tech-debt #231 — flagged, not silently accepted.
-- ⚠️ AND DELETE IS NOW UNREACHABLE FOR EVERYONE on this table. Nothing deletes a pricing config;
--    if something ever should, it is a new policy with its own reason, not a side effect of this.
DROP POLICY IF EXISTS bpc_owner_all ON public.business_pricing_config;
CREATE POLICY bpc_owner_insert ON public.business_pricing_config
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b
                       WHERE b.id = business_pricing_config.business_id
                         AND b.owner_id = auth.uid()));
COMMENT ON POLICY bpc_owner_insert ON public.business_pricing_config IS
  'SEEDING ONLY, account holder only. Was bpc_owner_all (FOR ALL, raw owner_id). It is NOT '
  'repointed at pricing_recipe:update because that would let a permission named UPDATE create a '
  'row — capP assertion 5, and the reason pricing_recipe has no create verb. Reads and edits are '
  'bpc_member_select / bpc_member_update. DELETE is now reachable by nobody, deliberately.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §4 — THE 10 REDUNDANT POLICIES ARE DROPPED. Each names the siblings that preserve the access.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Read the divergence note in the header first. In one line: these ten are `FOR ALL` (or a
-- duplicate SELECT) on tables whose member policies ALREADY gate every command per-verb on the
-- right string. Repointing a FOR ALL policy at a single string would grant DELETE on that string —
-- a widening past the very separation the per-verb set exists to make. Dropping is the repoint.
--
-- 🔴 EVERY ONE OF THESE IS A DELETION OF ACCESS FOR EXACTLY ONE PRINCIPAL: `businesses.owner_id`
--    acting WITHOUT a member row. There is no such principal — both business-create paths insert
--    the OWNER member row (see the header) — and V6 below PROVES it against live data before you
--    trust that sentence.

DROP POLICY IF EXISTS business_inventory_owner_all ON public.business_inventory;
-- preserved by: business_inventory_member_select/insert/update/delete (inventory:read/create/update/delete)
DROP POLICY IF EXISTS business_operating_days_owner_all ON public.business_operating_days;
-- preserved by: business_operating_days_member_select (is_active_member) + _insert/_update/_delete (settings:update)
DROP POLICY IF EXISTS cost_object_assignments_owner_all ON public.cost_object_assignments;
-- preserved by: cost_object_assignments_member_select/insert/update/delete (costs:read/create/update/delete)
DROP POLICY IF EXISTS cost_object_edges_owner_all ON public.cost_object_edges;
-- preserved by: cost_object_edges_member_select/insert/update/delete (costs:read/create/update/delete)
DROP POLICY IF EXISTS cost_objects_owner_all ON public.cost_objects;
-- preserved by: cost_objects_member_select/insert/update/delete (costs:read/create/update/delete)
-- ⚠️ UNDOCUMENTED — its definition is captured verbatim in §1 above before this line removes it.
DROP POLICY IF EXISTS lrw_owner_all ON public.labor_resource_wages;
-- preserved by: lrw_member_select/insert/update/delete (wages:read/create/update/delete)
DROP POLICY IF EXISTS labor_resources_owner_all ON public.labor_resources;
-- preserved by: labor_resources_member_select/insert/update/delete (wages:read/create/update/delete)
DROP POLICY IF EXISTS receipts_owner_all ON public.receipts;
-- preserved by: receipts_member_select/insert/update/delete (costs:read/create/update/delete)
DROP POLICY IF EXISTS compliance_records_owner_select ON public.order_compliance_records;
-- preserved by: order_compliance_records_member — SAME command, SAME string (order_compliance_records:read)
DROP POLICY IF EXISTS orders_business_owner ON public.orders;
-- preserved by: orders_member_select — SAME command, SAME string (orders:read)

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §5 — THE EIGHT THAT KEEP RAW `owner_id`, AND THE COMMENT NONE OF THEM HAD.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Not one line of these policies changes. A COMMENT is the entire change, and it is the point:
-- every one of them read like an un-migrated leftover, which is how a deliberate residue gets
-- "tidied up" by the next person.

-- ── ENTITY (2) ──────────────────────────────────────────────────────────────────────────────────
COMMENT ON POLICY businesses_owner_insert ON public.businesses IS
  'ENTITY, NOT WORK — KEPT RAW owner_id DELIBERATELY (2026-09-10 triage). Creating a business IS '
  'becoming its owner: owner_id = auth.uid() on INSERT states "you may create businesses you will '
  'own". That is the entity origin, not work inside one, and nobody delegates it in any business.';

COMMENT ON POLICY businesses_owner_select ON public.businesses IS
  'ENTITY, NOT WORK — KEPT RAW owner_id DELIBERATELY (2026-09-10 triage). The account holder''s own '
  'read of the entity row: who owns it, who is billed, who it transfers to. ⚠️ NEARLY REDUNDANT — '
  'businesses_member_select already admits every active member, so this grants nothing an '
  'OWNER-ROLE member lacks. Reported rather than dropped: dropping it is a separate decision.';

-- ── THE COARSE ONE — ROUTE A (1) ────────────────────────────────────────────────────────────────
COMMENT ON POLICY businesses_owner_update ON public.businesses IS
  'KEPT RAW owner_id DELIBERATELY — ROUTE A (David, 2026-09-10). This ONE policy gates UPDATE on '
  'the WHOLE businesses row, which means it gates the profile fields AND two dangerous columns: '
  'owner_id (SET owner_id = self) and qbo_writes_enabled (live writes to a customer''s real '
  'QuickBooks). RLS HAS NO COLUMN-LEVEL RESTRICTION, so repointing this at settings:update would '
  'hand that permission both. 🔴 THE FUNCTION''S COLUMN LIST *IS* THE COLUMN-LEVEL POLICY: '
  'set_business_profile writes name/phone/address/email/website and NOTHING else (verified against '
  'the live body 2026-09-10), gated on settings:update, audited. It is the ONLY write path to the '
  'profile fields. This policy is the entity half that remains — a deliberate residue, not an '
  'un-migrated leftover.';

-- ── THE AUTHORITY STORE (3) ─────────────────────────────────────────────────────────────────────
COMMENT ON POLICY bm_owner_all ON public.business_members IS
  'THE AUTHORITY STORE — KEPT RAW owner_id DELIBERATELY (2026-09-10 triage). This table holds the '
  'permission arrays every other policy tests. The permission trigger is BEFORE UPDATE ONLY '
  '(20260723:169), so INSERT is not covered: a member INSERT policy here is a permission-granting '
  'side door with no funnel and no audit row — 20260828''s header rules on exactly this. The '
  'triage string (team:update) is ALSO declared-unwired (tech-debt #90), so a repoint would admit '
  'NOBODY, including the account holder. Roster writes go through the funnel RPCs.';

COMMENT ON POLICY rd_owner_write ON public.role_definitions IS
  'THE AUTHORITY STORE — KEPT RAW owner_id DELIBERATELY (2026-09-10 triage). This table IS the '
  'permission arrays. save_role_permissions is the only writer, and it is what produces the audit '
  'row. Same declared-unwired problem as bm_owner_all (team:update, tech-debt #90). rd_read '
  '(is_active_member) already gives every member the read.';

COMMENT ON POLICY inv_owner_all ON public.invitations IS
  'THE AUTHORITY STORE — KEPT RAW owner_id DELIBERATELY (2026-09-10 triage). 20260828 §2 states it '
  'outright: "THERE IS DELIBERATELY NO INSERT POLICY. create_invitation is SECURITY DEFINER … an '
  'INSERT policy here would let a client mint an invitation row whose paired member row it then '
  'controls." A FOR ALL repoint restores exactly that door. Members already read and revoke via '
  'invitations_member_select / invitations_member_update (team:create).';

-- ── THE SIDE-EFFECT WRITE (1) ───────────────────────────────────────────────────────────────────
COMMENT ON POLICY audit_insert ON public.audit_log IS
  'KEPT AS IS DELIBERATELY (David, 2026-09-10). audit_log:write is NOT minted and will not be: the '
  'system writes the log as a SIDE EFFECT of a permitted action, so no human needs the string, and '
  'a string that must never be granted is pricing_recipe:create again. The policy already admits '
  'any active member (owner_id OR is_active_member) and pins actor_user_id to auth.uid(). The READ '
  'half is a permission — audit_owner_read now tests audit_log:read.';

-- ── THE NO-DELETE INVARIANT (1) ─────────────────────────────────────────────────────────────────
COMMENT ON POLICY service_offerings_owner ON public.service_offerings IS
  'KEPT RAW owner_id DELIBERATELY (2026-09-10 triage) — and the reason is DELETE, not ownership. '
  '20260828''s V6 asserts that exactly ONE FOR ALL/DELETE policy may exist on this table and that a '
  'member DELETE policy appearing means R2 was violated (a service is RETIRED, not deleted). A FOR '
  'ALL repoint at service_offerings:update would create one. Lauren reads, adds and edits services '
  'through service_offerings_member / _member_insert / _member_update; only the DELETE stays here.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §6 — TWO STRINGS ARE MINTED, AND THEY REACH A REAL ARRAY IN THE SAME TRANSACTION.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- David's ruling (2026-09-10): mint `accounting:connect` and `devices:manage`. NOT `audit_log:write`.
--
-- 🔴 THE HALF THAT IS EASY TO FORGET AND MAKES THE MINT INERT: a permission string that reaches no
--    permission ARRAY grants nothing. §2 above now gates three policies on these two strings; if
--    nobody holds them, those three tables become reachable by NOBODY — a lock-out, not a tighten.
--    So the floor grows 57 → 59 and every OWNER-role member is re-materialised THROUGH THE FUNNEL
--    in the same transaction. (Pass 2 nearly shipped a mint without this; it is why the clause is
--    written out rather than assumed.)
--
-- ⚠️ MANAGER AND STAFF DO NOT MOVE. Whether a manager should connect the books or manage devices is
--    a RULING David has not made, and a bundle is where that ruling would land. The strings are
--    `enforced` and `operational`/`owner-only` in the manifest; granting one to MANAGER is one line
--    in a later migration, through the funnel, with its own audit row. V5 asserts the non-movement.
--
-- ⚠️ THE COMPLETE SET, NEVER A DELTA. capA assertion 3 compares FULL EQUALITY between
--    OWNER_DEFAULT_BUNDLE and the newest migration carrying an $OWNER$[…]$OWNER$ literal, so a
--    delta-shaped migration fails loudly rather than half-materialising. This file is now that
--    newest carrier.
UPDATE public.role_definitions
   SET permissions = $OWNER$[
  "accounting:connect", "audit_log:read", "campaigns:read", "campaigns:update", "costs:create",
  "costs:delete", "costs:read", "costs:update", "customers:create", "customers:read",
  "customers:update", "deliveries.route:read", "deliveries:create", "deliveries:read",
  "deliveries:update", "devices:manage", "inventory:create", "inventory:delete",
  "inventory:import_price", "inventory:read", "inventory:update", "inventory_ledger:read",
  "margin:read", "order_compliance_records:create", "order_compliance_records:read",
  "order_compliance_records:update", "order_discount:apply", "order_items:create",
  "order_items:delete", "order_items:read", "order_items:update",
  "order_service_selections:create", "order_service_selections:delete",
  "order_service_selections:read", "order_service_selections:update", "orders:create",
  "orders:delete", "orders:read", "orders:update", "pmi:read", "pmi:update",
  "pricing_recipe:read", "pricing_recipe:update", "service_offerings:create",
  "service_offerings:read", "service_offerings:update", "settings:read", "settings:update",
  "subscription:read", "subscription:update", "tax_exempt:apply", "tax_rate:read",
  "tax_rate:update", "team:create", "team:read", "wages:create", "wages:delete", "wages:read",
  "wages:update"
]$OWNER$::jsonb,
       description = 'Holds every enforced permission in the manifest. LOCKED — computed from the '
                  || 'model, not curated. A new enforced permission is inherited automatically; no '
                  || 'permission can be removed, including by the owner (ruling 2026-07-30). '
                  || 'Grown to 59 on 2026-09-10: accounting:connect and devices:manage, minted so '
                  || 'the QuickBooks-secret and device tables are gated by a permission instead of '
                  || 'businesses.owner_id (ruling 2026-09-10).',
       updated_at  = now()
 WHERE business_id IS NULL
   AND role_key    = 'OWNER';

-- ── EVERY BUSINESS RESETS ITS OWNER ROLE ONTO THE NEW FLOOR, THROUGH THE FUNNEL ─────────────────
-- Identical mechanism to 20260828 §6, 20260801b §3 and 20260730a §2, for identical reasons: the
-- funnel is the only way a role→permission fact changes, and it is what produces the audit row.
-- The actor is the REAL account holder — auth.uid() is NULL in the SQL editor, so a NULL actor
-- would fail the membership check and name a system ghost in the log.
DO $reset$
DECLARE
  b record;
  v_rows int;
  v_skipped int := 0;
BEGIN
  SELECT count(*) INTO v_skipped FROM public.businesses WHERE owner_id IS NULL;
  IF v_skipped > 0 THEN
    RAISE WARNING 'owner-mint: % business(es) have owner_id IS NULL and were SKIPPED — their '
                  'OWNER-role members do NOT receive the two new strings. Run V7.', v_skipped;
  END IF;

  FOR b IN
    SELECT id, name, owner_id FROM public.businesses WHERE owner_id IS NOT NULL ORDER BY name
  LOOP
    SELECT count(*) INTO v_rows
      FROM public.save_role_permissions(
             b.id, b.owner_id, 'OWNER', 'reset', NULL, NULL,
             '[]'::jsonb,                          -- ignored by `reset`; the floor is the source
             'owner-id-policies-become-permissions' -- p_reason — the audit says WHY
           );
    RAISE NOTICE 'OWNER reset · % (%) · members re-materialised=%', b.name, b.id, v_rows;
  END LOOP;
END $reset$;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — RUN EVERY ONE AFTER APPLYING. Catalog-backed (§9 SCHEMA VERIFICATION GATE).
-- Thunder cannot run these under a real session; they are David's. Paste the OUTPUT, not a
-- sentence saying it passed. Anything not matching its stated expectation is a STOP, not a note.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 V0 — THE ACCEPTANCE QUERY IS THE MAIN EVENT AND IT LIVES IN ITS OWN FILE:
--      docs/decisions/2026-09-10-owner-id-repoint-acceptance.sql
--    It prints all 50 rows (49 policies + the added nursery_profiles read) with ADMIT/refuse for
--    Lauren, David and Joel, plus a six-number summary. RUN IT FIRST. The V-checks below are the
--    structural half it does not cover.
--
-- ⚠️ PROVE ON TEST DAVE'S TREE NEST FIRST — 95c1b2e9-3b09-43dd-a9f8-ba0744ca4382.
--    LAWNS is read-only except what you run.
--
-- ── V1 — NO REPOINTED POLICY STILL COMPARES owner_id. EXPECT 0 rows.
-- SELECT tablename, policyname FROM pg_policies
--  WHERE schemaname = 'public'
--    AND policyname IN ('addons_business_owner','audit_owner_read','bas_owner_all',
--        'business_discovery_profiles_owner_all','business_display_standards_owner_all',
--        'business_inventory_ledger_owner_all','business_pmi_schedule_owner_all',
--        'business_service_log_owner_all','business_voice_samples_owner','campaign_posts_owner',
--        'campaigns_owner','cultivar_plants_owner_all','cultivar_plants_owner_select',
--        'customers_business_owner','deliveries_owner_all','inventory_count_sessions_owner_all',
--        'inventory_counts_owner_all','mdh_owner_all','md_owner_all','nursery_profiles_owner',
--        'nursery_profiles_member_select','opportunity_items_owner','order_addons_owner',
--        'order_items_owner','order_service_selections_owner','plant_events_business_owner',
--        'social_drafts_business_owner','vendor_preferences_owner_all')
--    AND (coalesce(qual,'') || coalesce(with_check,'')) ~ 'owner_id';
--
-- ── V2 — ALL 28 EXIST AND CALL has_permission. EXPECT n = 28.
-- SELECT count(*) AS n FROM pg_policies
--  WHERE schemaname='public'
--    AND policyname IN (/* the same 28 names as V1 */)
--    AND (coalesce(qual,'') || coalesce(with_check,'')) ~ 'has_permission\(';
--
-- ── V3 — 🔴 THE INSERT DOOR ON business_pricing_config IS STILL SHUT.
-- EXPECT exactly TWO rows: bpc_member_update (UPDATE) and bpc_owner_insert (INSERT, owner_id).
-- NO row may be named bpc_member_insert, and NO policy on this table may be FOR ALL.
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
--  WHERE schemaname='public' AND tablename='business_pricing_config' AND cmd <> 'SELECT'
--  ORDER BY policyname;
--
-- ── V4 — THE TEN DROPS ARE GONE. EXPECT 0 rows.
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND policyname IN
--   ('business_inventory_owner_all','business_operating_days_owner_all',
--    'cost_object_assignments_owner_all','cost_object_edges_owner_all','cost_objects_owner_all',
--    'lrw_owner_all','labor_resources_owner_all','receipts_owner_all',
--    'compliance_records_owner_select','orders_business_owner');
--
-- ── V5 — 🔴 NOBODY BUT AN OWNER-ROLE MEMBER MOVED. CORPUS: every active member, all tenants.
-- EXPECT: every OWNER row n = 59; MANAGER = 25; STAFF = 10; and holds_a_new_string = false on
-- EVERY non-OWNER row. A true there is an over-grant.
-- SELECT b.name AS business, m.role, m.name AS member, jsonb_array_length(m.permissions) AS n,
--        (m.permissions ?| ARRAY['accounting:connect','devices:manage']) AS holds_a_new_string
--   FROM public.business_members m JOIN public.businesses b ON b.id = m.business_id
--  WHERE m.active = true ORDER BY b.name, m.role, m.name;
--
-- ── V6 — 🔴 THE ASSUMPTION THE TEN DROPS REST ON, PROVEN RATHER THAN ASSERTED.
-- Every account holder must ALSO be an active member of their own business, or a drop removed the
-- only thing admitting them. EXPECT 0 rows.
-- SELECT b.id, b.name FROM public.businesses b
--  WHERE b.owner_id IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM public.business_members m
--                     WHERE m.business_id = b.id AND m.user_id = b.owner_id AND m.active);
--
-- ── V7 — WAS ANY TENANT SKIPPED BY THE §6 RESET? EXPECT 0 rows.
-- SELECT id, name FROM public.businesses WHERE owner_id IS NULL;
--
-- ── V8 — THE EIGHT KEPT-RAW POLICIES NOW CARRY THEIR REASON. EXPECT 8 rows, every one non-null.
-- SELECT p.polrelid::regclass AS tbl, p.polname, obj_description(p.oid, 'pg_policy') AS why
--   FROM pg_policy p
--  WHERE p.polname IN ('businesses_owner_insert','businesses_owner_select','businesses_owner_update',
--                      'bm_owner_all','rd_owner_write','inv_owner_all','audit_insert',
--                      'service_offerings_owner')
--  ORDER BY 1, 2;
--
-- ── 🔴 THE IMPERSONATION FORM, AND IT IS NOT WHAT THIS REPO HAS BEEN WRITING ────────────────────
-- `SET LOCAL role authenticated` appears in three earlier V-blocks here (20260828 V7–V9) and HAS
-- NEVER BEEN RUN. Thunder tried it 2026-09-10: `permission denied to set role "authenticated"`.
-- **Setting the CLAIMS GUC ALONE is enough for anything that reads auth.uid()** — proven the same
-- night by getting three different real answers out of get_my_permissions. The role switch is only
-- needed to make RLS actually filter ROWS, which is what V11 is for; if it refuses in the editor,
-- that is the editor, not the fix, and Thunder runs the anon-key harness instead.
--
-- ── V9 — 🔴 THE BEHAVIOURAL HALF, WHICH NO CATALOG QUERY CAN REACH. Impersonate Joel and prove a
-- REFUSAL. has_permission reads auth.uid(), so with no claims set it returns false for everyone and
-- proves nothing — the SET LOCAL is the whole test.
-- EXPECT: can_devices = false, can_costs = false, can_settings = TRUE.
-- BEGIN;
--   SET LOCAL request.jwt.claims = '{"sub":"6f09038f-7966-49e3-b86a-1e3beb5e311f"}';
--   SELECT public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','devices:manage')  AS can_devices,
--          public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','costs:update')    AS can_costs,
--          public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','settings:update') AS can_settings;
--   SELECT count(*) AS device_rows FROM public.member_devices;   -- EXPECT: only his own, via md_self
-- ROLLBACK;
--
-- ── V10 — THE SAME, AS LAUREN. THE HEADLINE. EXPECT all three TRUE and n = 59.
-- ✅ Thunder measured the array half PRE-migration: Lauren n=57 is_account_holder=FALSE,
--    David n=57 is_account_holder=TRUE. Identical arrays, different boolean — which is the entire
--    triage in one row. The 59 is what this migration adds.
-- BEGIN;
--   SET LOCAL request.jwt.claims = '{"sub":"790b31d2-7b65-45ec-953f-79855453a73e"}';
--   SELECT jsonb_array_length(permissions) AS n, is_account_holder
--     FROM public.get_my_permissions('ed2e5933-45dc-4b9b-a331-ddfd125e7a74');
--   SELECT public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','settings:update')       AS can_settings,
--          public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','pricing_recipe:update') AS can_pricing,
--          public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','devices:manage')        AS can_devices;
-- ROLLBACK;
--
-- ── V11 — 🔴 THE ROW HALF, AND THE ONLY CHECK HERE THAT NEEDS THE ROLE SWITCH. Before this
-- migration Lauren's read of nursery_profiles returned ZERO ROWS WITH NO ERROR while the row
-- existed — a FALSE EMPTY, proven behaviourally by Thunder on Test Dave's. EXPECT: 1.
-- ⚠️ If this errors `permission denied to set role "authenticated"`, that is the editor refusing.
--    Say so; it is not a failure of the fix, and V10 stands on its own.
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"790b31d2-7b65-45ec-953f-79855453a73e"}';
--   SELECT count(*) AS nursery_profile_rows FROM public.nursery_profiles
--    WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
-- ROLLBACK;
