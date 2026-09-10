-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ACCEPTANCE — THE 49 POLICIES, BOTH DIRECTIONS, ON REAL USER IDS. PASTE INTO THE SQL EDITOR.
-- 2026-09-10 · #289 · run AFTER applying 20260910b_owner_id_policies_become_permissions.sql
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WHAT THIS PROVES AND WHAT IT DOES NOT.
-- It reads the CATALOG (does the policy exist, and does its body test the string the plan named?)
-- and the ARRAYS (does each of the three real LAWNS members hold that string, and are they
-- active?). Those two facts together are the whole of the decision `has_permission` makes, and
-- both are readable as `postgres`. What it does NOT do is issue the query as them — `has_permission`
-- reads `auth.uid()`, which is NULL for the SQL editor's role, so calling the function here returns
-- false for everyone and proves nothing. The behavioural half is CARD 4 on the owner-test board.
--
-- 🔴 A GATE THAT HAS ONLY EVER ADMITTED IS NOT A PROVEN GATE. Read the `joel` column: it must show
-- `refuse` on TWELVE rows. If every cell in it says ADMIT, the migration granted more than it
-- should have and this query is the thing that says so.
--
-- EXPECTED, stated BEFORE you run it (that is the point of stating it):
--   · lauren = ADMIT on every PERMISSION row.               (OWNER-role, all 59 strings)
--   · david  = ADMIT on every PERMISSION row.               (OWNER-role member AND owner_id)
--   · joel   = ADMIT where he holds the string, `refuse` where he does not — MANAGER, 25 strings.
--              refuse on TWELVE rows: addons · audit_log · business_accounting_secrets ·
--              cultivar_plants_member_delete (he holds inventory:update, NOT inventory:delete) ·
--              deliveries_member_insert (deliveries:update, NOT :create) · member_device_handoffs ·
--              member_devices · opportunity_items · order_addons · order_items ·
--              order_service_selections · vendor_preferences.  ADMIT on the settings / inventory
--              read-create-update / campaigns / pmi / customers / deliveries rows.
--    🔴 THE TWO SPLIT ROWS ARE THE MOST INFORMATIVE CELLS ON THE WHOLE BOARD: they are where a
--       single FOR ALL policy would have handed him a verb the model separates, and the split is
--       what stops it.
--   · policy_live = 1 on every PERMISSION row (the policy exists AND its body names that string).
--   · policy_live = 0 on every GONE row (dropped), 1 on OWNER_ID and UNTOUCHED rows.
--   · gate = 'raw owner_id' on every OWNER_ID row — those are the eight kept deliberately.
--
WITH plan(tbl, pol, cmd, perm, kind) AS (VALUES
  ('addons','addons_business_owner','ALL','service_offerings:update','PERMISSION'),
  ('audit_log','audit_insert','INSERT','(account holder only)','OWNER_ID'),
  ('audit_log','audit_owner_read','SELECT','audit_log:read','PERMISSION'),
  ('business_accounting_secrets','bas_owner_all','ALL','accounting:connect','PERMISSION'),
  ('business_discovery_profiles','business_discovery_profiles_owner_all','ALL','settings:update','PERMISSION'),
  ('business_display_standards','business_display_standards_owner_all','ALL','settings:update','PERMISSION'),
  ('business_inventory','business_inventory_owner_all','ALL','(dropped)','GONE'),
  ('business_inventory_ledger','business_inventory_ledger_owner_all','ALL','inventory_ledger:read','PERMISSION'),
  ('business_members','bm_owner_all','ALL','(account holder only)','OWNER_ID'),
  ('business_operating_days','business_operating_days_owner_all','ALL','(dropped)','GONE'),
  ('business_pmi_schedule','business_pmi_schedule_owner_all','ALL','pmi:update','PERMISSION'),
  ('business_pricing_config','bpc_owner_insert','INSERT','(account holder only)','OWNER_ID'),
  ('business_service_log','business_service_log_owner_all','ALL','pmi:update','PERMISSION'),
  ('business_voice_samples','business_voice_samples_owner','ALL','campaigns:update','PERMISSION'),
  ('campaign_posts','campaign_posts_owner','ALL','campaigns:update','PERMISSION'),
  ('campaigns','campaigns_owner','ALL','campaigns:update','PERMISSION'),
  ('cost_object_assignments','cost_object_assignments_owner_all','ALL','(dropped)','GONE'),
  ('cost_object_edges','cost_object_edges_owner_all','ALL','(dropped)','GONE'),
  ('cost_objects','cost_objects_owner_all','ALL','(dropped)','GONE'),
  ('cultivar_plants','cultivar_plants_member_insert','INSERT','inventory:create','PERMISSION'),
  ('cultivar_plants','cultivar_plants_member_update','UPDATE','inventory:update','PERMISSION'),
  ('cultivar_plants','cultivar_plants_member_delete','DELETE','inventory:delete','PERMISSION'),
  ('cultivar_plants','cultivar_plants_owner_select','SELECT','inventory:read','PERMISSION'),
  ('customers','customers_business_owner','ALL','customers:update','PERMISSION'),
  ('deliveries','deliveries_member_insert','INSERT','deliveries:create','PERMISSION'),
  ('deliveries','deliveries_member_delete','DELETE','deliveries:update','PERMISSION'),
  ('inventory_count_sessions','inventory_count_sessions_owner_all','ALL','inventory:update','PERMISSION'),
  ('inventory_counts','inventory_counts_owner_all','ALL','inventory:update','PERMISSION'),
  ('invitations','inv_owner_all','ALL','(account holder only)','OWNER_ID'),
  ('labor_resource_wages','lrw_owner_all','ALL','(dropped)','GONE'),
  ('labor_resources','labor_resources_owner_all','ALL','(dropped)','GONE'),
  ('losses','losses_all_owner','ALL','(pending table DROP)','UNTOUCHED'),
  ('member_device_handoffs','mdh_owner_all','ALL','devices:manage','PERMISSION'),
  ('member_devices','md_owner_all','ALL','devices:manage','PERMISSION'),
  ('nurseries','authenticated_select_nurseries','SELECT','(pending table DROP)','UNTOUCHED'),
  ('nurseries','nurseries_update_owner','UPDATE','(pending table DROP)','UNTOUCHED'),
  ('nursery_profiles','nursery_profiles_owner','ALL','settings:update','PERMISSION'),
  ('nursery_profiles','nursery_profiles_member_select','SELECT','settings:read','PERMISSION'),
  ('opportunity_items','opportunity_items_owner','ALL','service_offerings:update','PERMISSION'),
  ('order_addons','order_addons_owner','ALL','order_items:update','PERMISSION'),
  ('order_compliance_records','compliance_records_owner_select','SELECT','(dropped)','GONE'),
  ('order_items','order_items_owner','ALL','order_items:update','PERMISSION'),
  ('order_service_selections','order_service_selections_owner','ALL','order_service_selections:update','PERMISSION'),
  ('orders','orders_business_owner','SELECT','(dropped)','GONE'),
  ('plant_events','plant_events_business_owner','ALL','inventory:update','PERMISSION'),
  ('receipts','receipts_owner_all','ALL','(dropped)','GONE'),
  ('role_definitions','rd_owner_write','ALL','(account holder only)','OWNER_ID'),
  ('service_offerings','service_offerings_owner','ALL','(account holder only)','OWNER_ID'),
  ('social_drafts','social_drafts_business_owner','ALL','campaigns:update','PERMISSION'),
  ('vendor_preferences','vendor_preferences_owner_all','ALL','costs:update','PERMISSION'),
  ('businesses','businesses_owner_insert','INSERT','(account holder only)','OWNER_ID'),
  ('businesses','businesses_owner_select','SELECT','(account holder only)','OWNER_ID'),
  ('businesses','businesses_owner_update','UPDATE','(account holder only)','OWNER_ID')
),
lawns(bid) AS (VALUES ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74'::uuid)),
mem(who, uid) AS (VALUES
  ('lauren', '790b31d2-7b65-45ec-953f-79855453a73e'::uuid),
  ('david',  '98f4e56b-cd27-4099-a9d8-5c8cbb63d00f'::uuid),
  ('joel',   '6f09038f-7966-49e3-b86a-1e3beb5e311f'::uuid)),
held AS (
  SELECT m.who, bm.active, bm.permissions
    FROM mem m
    LEFT JOIN public.business_members bm
           ON bm.user_id = m.uid AND bm.business_id = (SELECT bid FROM lawns)),
live AS (
  SELECT p.tbl, p.pol, p.cmd, p.perm, p.kind,
         count(gp.policyname) FILTER (
           WHERE p.kind <> 'PERMISSION'
              OR (coalesce(gp.qual,'') || coalesce(gp.with_check,'')) LIKE '%' || p.perm || '%') AS policy_live,
         max(CASE WHEN (coalesce(gp.qual,'') || coalesce(gp.with_check,'')) ~ 'owner_id'
                   AND (coalesce(gp.qual,'') || coalesce(gp.with_check,'')) !~ 'has_permission'
                  THEN 'raw owner_id'
                  WHEN (coalesce(gp.qual,'') || coalesce(gp.with_check,'')) ~ 'has_permission'
                  THEN 'permission'
                  ELSE '(absent)' END) AS gate
    FROM plan p
    LEFT JOIN pg_policies gp
           ON gp.schemaname = 'public' AND gp.tablename = p.tbl AND gp.policyname = p.pol
   GROUP BY 1,2,3,4,5)
SELECT l.tbl, l.pol, l.cmd, l.kind, l.perm, l.policy_live, l.gate,
       max(CASE WHEN h.who = 'lauren' THEN
              CASE WHEN l.kind <> 'PERMISSION' THEN '—'
                   WHEN coalesce(h.active,false) AND h.permissions ? l.perm THEN 'ADMIT'
                   ELSE 'refuse' END END) AS lauren,
       max(CASE WHEN h.who = 'david' THEN
              CASE WHEN l.kind <> 'PERMISSION' THEN '—'
                   WHEN coalesce(h.active,false) AND h.permissions ? l.perm THEN 'ADMIT'
                   ELSE 'refuse' END END) AS david,
       max(CASE WHEN h.who = 'joel' THEN
              CASE WHEN l.kind <> 'PERMISSION' THEN '—'
                   WHEN coalesce(h.active,false) AND h.permissions ? l.perm THEN 'ADMIT'
                   ELSE 'refuse' END END) AS joel
  FROM live l CROSS JOIN held h
 GROUP BY 1,2,3,4,5,6,7
 ORDER BY CASE l.kind WHEN 'PERMISSION' THEN 1 WHEN 'OWNER_ID' THEN 2 WHEN 'GONE' THEN 3 ELSE 4 END,
          l.tbl, l.pol;

-- ── THE ONE-LINE SUMMARY, so a wall of 50 rows cannot hide a single wrong cell ─────────────────
-- EXPECT AFTER APPLYING: permission_rows = 31 · lauren_refusals = 0 · david_refusals = 0 ·
--         joel_refusals = 12 · dead_permission_policies = 0 · surviving_dropped = 0
--
-- 🔴 THE RED, MEASURED BEFORE APPLYING (Thunder, 2026-09-10, read-only via the PAT — this is what
--    the same query said with the migration UNAPPLIED, and it is the proof the check can fail):
--         permission_rows = 31 · lauren_refusals = 3 · david_refusals = 3 · joel_refusals = 12 ·
--         dead_permission_policies = 31 · surviving_dropped = 10
--    Every PERMISSION row read `gate = raw owner_id`. The three refusals on Lauren AND David are
--    `accounting:connect` / `devices:manage` ×2 — strings that did not exist yet. §6 grants them,
--    which is exactly why the mint and the policies had to land in one transaction.
WITH plan(tbl, pol, cmd, perm, kind) AS (VALUES
  ('addons','addons_business_owner','ALL','service_offerings:update','PERMISSION'),
  ('audit_log','audit_insert','INSERT','(account holder only)','OWNER_ID'),
  ('audit_log','audit_owner_read','SELECT','audit_log:read','PERMISSION'),
  ('business_accounting_secrets','bas_owner_all','ALL','accounting:connect','PERMISSION'),
  ('business_discovery_profiles','business_discovery_profiles_owner_all','ALL','settings:update','PERMISSION'),
  ('business_display_standards','business_display_standards_owner_all','ALL','settings:update','PERMISSION'),
  ('business_inventory','business_inventory_owner_all','ALL','(dropped)','GONE'),
  ('business_inventory_ledger','business_inventory_ledger_owner_all','ALL','inventory_ledger:read','PERMISSION'),
  ('business_members','bm_owner_all','ALL','(account holder only)','OWNER_ID'),
  ('business_operating_days','business_operating_days_owner_all','ALL','(dropped)','GONE'),
  ('business_pmi_schedule','business_pmi_schedule_owner_all','ALL','pmi:update','PERMISSION'),
  ('business_pricing_config','bpc_owner_insert','INSERT','(account holder only)','OWNER_ID'),
  ('business_service_log','business_service_log_owner_all','ALL','pmi:update','PERMISSION'),
  ('business_voice_samples','business_voice_samples_owner','ALL','campaigns:update','PERMISSION'),
  ('campaign_posts','campaign_posts_owner','ALL','campaigns:update','PERMISSION'),
  ('campaigns','campaigns_owner','ALL','campaigns:update','PERMISSION'),
  ('cost_object_assignments','cost_object_assignments_owner_all','ALL','(dropped)','GONE'),
  ('cost_object_edges','cost_object_edges_owner_all','ALL','(dropped)','GONE'),
  ('cost_objects','cost_objects_owner_all','ALL','(dropped)','GONE'),
  ('cultivar_plants','cultivar_plants_member_insert','INSERT','inventory:create','PERMISSION'),
  ('cultivar_plants','cultivar_plants_member_update','UPDATE','inventory:update','PERMISSION'),
  ('cultivar_plants','cultivar_plants_member_delete','DELETE','inventory:delete','PERMISSION'),
  ('cultivar_plants','cultivar_plants_owner_select','SELECT','inventory:read','PERMISSION'),
  ('customers','customers_business_owner','ALL','customers:update','PERMISSION'),
  ('deliveries','deliveries_member_insert','INSERT','deliveries:create','PERMISSION'),
  ('deliveries','deliveries_member_delete','DELETE','deliveries:update','PERMISSION'),
  ('inventory_count_sessions','inventory_count_sessions_owner_all','ALL','inventory:update','PERMISSION'),
  ('inventory_counts','inventory_counts_owner_all','ALL','inventory:update','PERMISSION'),
  ('invitations','inv_owner_all','ALL','(account holder only)','OWNER_ID'),
  ('labor_resource_wages','lrw_owner_all','ALL','(dropped)','GONE'),
  ('labor_resources','labor_resources_owner_all','ALL','(dropped)','GONE'),
  ('losses','losses_all_owner','ALL','(pending table DROP)','UNTOUCHED'),
  ('member_device_handoffs','mdh_owner_all','ALL','devices:manage','PERMISSION'),
  ('member_devices','md_owner_all','ALL','devices:manage','PERMISSION'),
  ('nurseries','authenticated_select_nurseries','SELECT','(pending table DROP)','UNTOUCHED'),
  ('nurseries','nurseries_update_owner','UPDATE','(pending table DROP)','UNTOUCHED'),
  ('nursery_profiles','nursery_profiles_owner','ALL','settings:update','PERMISSION'),
  ('nursery_profiles','nursery_profiles_member_select','SELECT','settings:read','PERMISSION'),
  ('opportunity_items','opportunity_items_owner','ALL','service_offerings:update','PERMISSION'),
  ('order_addons','order_addons_owner','ALL','order_items:update','PERMISSION'),
  ('order_compliance_records','compliance_records_owner_select','SELECT','(dropped)','GONE'),
  ('order_items','order_items_owner','ALL','order_items:update','PERMISSION'),
  ('order_service_selections','order_service_selections_owner','ALL','order_service_selections:update','PERMISSION'),
  ('orders','orders_business_owner','SELECT','(dropped)','GONE'),
  ('plant_events','plant_events_business_owner','ALL','inventory:update','PERMISSION'),
  ('receipts','receipts_owner_all','ALL','(dropped)','GONE'),
  ('role_definitions','rd_owner_write','ALL','(account holder only)','OWNER_ID'),
  ('service_offerings','service_offerings_owner','ALL','(account holder only)','OWNER_ID'),
  ('social_drafts','social_drafts_business_owner','ALL','campaigns:update','PERMISSION'),
  ('vendor_preferences','vendor_preferences_owner_all','ALL','costs:update','PERMISSION'),
  ('businesses','businesses_owner_insert','INSERT','(account holder only)','OWNER_ID'),
  ('businesses','businesses_owner_select','SELECT','(account holder only)','OWNER_ID'),
  ('businesses','businesses_owner_update','UPDATE','(account holder only)','OWNER_ID')
),
mem(who, uid) AS (VALUES
  ('lauren', '790b31d2-7b65-45ec-953f-79855453a73e'::uuid),
  ('david',  '98f4e56b-cd27-4099-a9d8-5c8cbb63d00f'::uuid),
  ('joel',   '6f09038f-7966-49e3-b86a-1e3beb5e311f'::uuid)),
held AS (
  SELECT m.who, bm.active, bm.permissions FROM mem m
    LEFT JOIN public.business_members bm
           ON bm.user_id = m.uid AND bm.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74')
SELECT
  count(*) FILTER (WHERE p.kind = 'PERMISSION' AND h.who = 'lauren') AS permission_rows,
  count(*) FILTER (WHERE p.kind = 'PERMISSION' AND h.who='lauren'
                     AND NOT (coalesce(h.active,false) AND h.permissions ? p.perm)) AS lauren_refusals,
  count(*) FILTER (WHERE p.kind = 'PERMISSION' AND h.who='david'
                     AND NOT (coalesce(h.active,false) AND h.permissions ? p.perm)) AS david_refusals,
  count(*) FILTER (WHERE p.kind = 'PERMISSION' AND h.who='joel'
                     AND NOT (coalesce(h.active,false) AND h.permissions ? p.perm)) AS joel_refusals,
  count(*) FILTER (WHERE p.kind = 'PERMISSION' AND h.who='lauren' AND NOT EXISTS (
      SELECT 1 FROM pg_policies gp WHERE gp.schemaname='public' AND gp.tablename=p.tbl
        AND gp.policyname=p.pol
        AND (coalesce(gp.qual,'')||coalesce(gp.with_check,'')) LIKE '%'||p.perm||'%')) AS dead_permission_policies,
  count(*) FILTER (WHERE p.kind = 'GONE' AND h.who='lauren' AND EXISTS (
      SELECT 1 FROM pg_policies gp WHERE gp.schemaname='public' AND gp.tablename=p.tbl
        AND gp.policyname=p.pol)) AS surviving_dropped
  FROM plan p CROSS JOIN held h;
