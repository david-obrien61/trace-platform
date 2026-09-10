-- MIGRATION APPLY-STATE — STAGE 3 CATALOG QUERY
-- Generated 2026-09-04 by: node scripts/verify-migration-apply-state.mjs --probe --sql
-- TENANT: LAWNS Tree Farm (business_id ed2e5933-45dc-4b9b-a331-ddfd125e7a74)
-- PROJECT REF: bgobkjcopcxusjsetfob  (cultivar-os — NOT the old ignition project ufsgqckbxdtwviqjjtos)
-- READ-ONLY. Catalogs only. Returns no customer row.

WITH expected(file, kind, name, tbl, claimants) AS (VALUES
  ('20260522_rls_modules_nursery_modules.sql', 'policy', 'authenticated_select_modules', 'modules', 1),
  ('20260522_rls_modules_nursery_modules.sql', 'policy', 'authenticated_select_nursery_modules', 'nursery_modules', 2),
  ('20260522_social_drafts_add_failed_status.sql', 'constraint', 'social_drafts_status_check', 'social_drafts', 2),
  ('20260522_social_drafts_rls.sql', 'policy', 'authenticated_select_social_drafts', 'social_drafts', 2),
  ('20260527_orders_authenticated_select_policy.sql', 'policy', 'authenticated_select_orders', 'orders', 2),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'authenticated_select_nurseries', 'nurseries', 1),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'anon_select_plants', 'plants', 1),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'authenticated_select_plants', 'plants', 1),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'anon_select_plant_events', 'plant_events', 1),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'authenticated_select_plant_events', 'plant_events', 1),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'anon_select_addons', 'addons', 1),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'authenticated_select_addons', 'addons', 1),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'authenticated_select_customers', 'customers', 1),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'authenticated_select_orders', 'orders', 2),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'authenticated_select_order_items', 'order_items', 1),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'authenticated_select_order_addons', 'order_addons', 1),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'authenticated_select_nursery_modules', 'nursery_modules', 2),
  ('20260528_per_tenant_rls_isolation.sql', 'policy', 'authenticated_select_social_drafts', 'social_drafts', 2),
  ('20260529_businesses_d_update_rls.sql', 'policy', 'plants_business_owner', 'plants', 1),
  ('20260529_businesses_d_update_rls.sql', 'policy', 'orders_business_owner', 'orders', 1),
  ('20260529_businesses_d_update_rls.sql', 'policy', 'addons_business_owner', 'addons', 1),
  ('20260529_businesses_d_update_rls.sql', 'policy', 'customers_business_owner', 'customers', 1),
  ('20260529_businesses_d_update_rls.sql', 'policy', 'plant_events_business_owner', 'plant_events', 1),
  ('20260529_businesses_d_update_rls.sql', 'policy', 'social_drafts_business_owner', 'social_drafts', 1),
  ('20260529_businesses_d_update_rls.sql', 'policy', 'nursery_modules_business_owner', 'nursery_modules', 1),
  ('20260529_businesses_d_update_rls.sql', 'index', 'nursery_modules_business_module_key', 'nursery_modules', 1),
  ('20260609_social_drafts_platform_check.sql', 'constraint', 'social_drafts_platform_check', 'social_drafts', 1),
  ('20260613_cultivar_plants_policy_cleanup.sql', 'policy', 'cultivar_plants_owner_all', 'cultivar_plants', 2),
  ('20260613_receipts_storage_rls.sql', 'policy', 'receipts_storage_insert', 'storage.objects', 2),
  ('20260613_receipts_storage_rls.sql', 'policy', 'receipts_storage_select', 'storage.objects', 2),
  ('20260613_receipts_storage_rls.sql', 'policy', 'receipts_storage_delete', 'storage.objects', 1),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'businesses_member_select', 'businesses', 1),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'receipts_member_all', 'receipts', 3),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'cost_objects_member_all', 'cost_objects', 2),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'business_inventory_member_all', 'business_inventory', 3),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'business_pmi_schedule_member_all', 'business_pmi_schedule', 2),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'business_service_log_member_all', 'business_service_log', 3),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'labor_resources_member_all', 'labor_resources', 3),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'cost_object_edges_member_all', 'cost_object_edges', 3),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'cost_object_assignments_member_all', 'cost_object_assignments', 3),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'business_discovery_profiles_member_all', 'business_discovery_profiles', 2),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'deliveries_member_all', 'deliveries', 2),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'business_modules_member_access', 'business_modules', 2),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'cultivar_plants_owner_select', 'cultivar_plants', 2),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'cultivar_plants_owner_all', 'cultivar_plants', 2),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'receipts_storage_insert', 'storage.objects', 2),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'receipts_storage_select', 'storage.objects', 2),
  ('20260622_is_active_member_canonical_rls.sql', 'policy', 'md_self', 'member_devices', 2),
  ('20260622_is_active_member_canonical_rls.sql', 'function', 'is_active_member', NULL, 1),
  ('20260624_nursery_profiles_business_id_unique.sql', 'constraint', 'nursery_profiles_business_id_key', 'nursery_profiles', 1),
  ('20260709_order_items_business_rls.sql', 'policy', 'order_items_owner', 'order_items', 1),
  ('20260709_order_items_business_rls.sql', 'policy', 'order_addons_owner', 'order_addons', 1),
  ('20260710_customers_member_read.sql', 'policy', 'customers_member', 'customers', 1),
  ('20260723_inventory_import_pricing_gate.sql', 'function', 'has_permission_for', NULL, 3),
  ('20260723_inventory_import_pricing_gate.sql', 'function', 'import_write_price', NULL, 2),
  ('20260723_permission_funnel.sql', 'function', 'enforce_member_authority_immutability', NULL, 2),
  ('20260723_permission_funnel.sql', 'function', 'save_role_permissions', NULL, 4),
  ('20260723_permission_funnel.sql', 'function', 'assign_member_role', NULL, 1),
  ('20260724_manager_visibility_gaps.sql', 'policy', 'service_offerings_member', 'service_offerings', 2),
  ('20260724_manager_visibility_gaps.sql', 'policy', 'orders_member_select', 'orders', 2),
  ('20260724_manager_visibility_gaps.sql', 'policy', 'order_items_member', 'order_items', 2),
  ('20260724_manager_visibility_gaps.sql', 'policy', 'order_service_selections_member', 'order_service_selections', 2),
  ('20260724_manager_visibility_gaps.sql', 'policy', 'order_compliance_records_member', 'order_compliance_records', 2),
  ('20260724_manager_visibility_gaps.sql', 'function', 'get_business_tax_rate', NULL, 2),
  ('20260726_permission_alias_layer.sql', 'table', 'permission_aliases', 'permission_aliases', 1),
  ('20260726_permission_alias_layer.sql', 'function', 'has_permission', NULL, 2),
  ('20260726_permission_alias_layer.sql', 'function', 'has_permission_for', NULL, 3),
  ('20260726_permission_alias_layer.sql', 'index', 'idx_permission_aliases_from', 'permission_aliases', 1),
  ('20260726_permission_alias_legacy_rename_only.sql', 'index', 'permission_aliases_legacy_is_rename_only', 'permission_aliases', 1),
  ('20260727_rbac_flip_corrections.sql', 'function', 'set_business_profile', NULL, 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'business_inventory_member_select', 'business_inventory', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'business_inventory_member_insert', 'business_inventory', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'business_inventory_member_update', 'business_inventory', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'business_inventory_member_delete', 'business_inventory', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_objects_member_select', 'cost_objects', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_objects_member_insert', 'cost_objects', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_objects_member_update', 'cost_objects', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_objects_member_delete', 'cost_objects', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_object_assignments_member_select', 'cost_object_assignments', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_object_assignments_member_insert', 'cost_object_assignments', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_object_assignments_member_update', 'cost_object_assignments', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_object_assignments_member_delete', 'cost_object_assignments', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_object_edges_member_select', 'cost_object_edges', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_object_edges_member_insert', 'cost_object_edges', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_object_edges_member_update', 'cost_object_edges', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'cost_object_edges_member_delete', 'cost_object_edges', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'receipts_member_select', 'receipts', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'receipts_member_insert', 'receipts', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'receipts_member_update', 'receipts', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'receipts_member_delete', 'receipts', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'business_service_log_member_select', 'business_service_log', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'business_service_log_member_insert', 'business_service_log', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'business_service_log_member_update', 'business_service_log', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'bpc_member_select', 'business_pricing_config', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'bpc_member_insert', 'business_pricing_config', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'bpc_member_update', 'business_pricing_config', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'labor_resources_member_select', 'labor_resources', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'labor_resources_member_insert', 'labor_resources', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'labor_resources_member_update', 'labor_resources', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'labor_resources_member_delete', 'labor_resources', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'lrw_member_select', 'labor_resource_wages', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'lrw_member_insert', 'labor_resource_wages', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'lrw_member_update', 'labor_resource_wages', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'lrw_member_delete', 'labor_resource_wages', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'customers_member_select', 'customers', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'customers_member_insert', 'customers', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'customers_member_update', 'customers', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'service_offerings_member', 'service_offerings', 2),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'orders_member_select', 'orders', 2),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'order_items_member', 'order_items', 2),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'order_service_selections_member', 'order_service_selections', 2),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'order_compliance_records_member', 'order_compliance_records', 2),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'deliveries_member_select', 'deliveries', 1),
  ('20260727_rbac_resource_action_flip.sql', 'policy', 'deliveries_member_update', 'deliveries', 1),
  ('20260727_rbac_resource_action_flip.sql', 'function', 'import_write_price', NULL, 2),
  ('20260727_rbac_resource_action_flip.sql', 'function', 'get_business_tax_rate', NULL, 2),
  ('20260727_rbac_resource_action_flip.sql', 'function', 'set_business_tax_rate', NULL, 1),
  ('20260727_rbac_resource_action_flip.sql', 'function', 'save_role_permissions', NULL, 4),
  ('20260727c_campaigns_member_and_plant_events_scope.sql', 'policy', 'campaigns_member_select', 'campaigns', 1),
  ('20260727c_campaigns_member_and_plant_events_scope.sql', 'policy', 'campaigns_member_insert', 'campaigns', 1),
  ('20260727c_campaigns_member_and_plant_events_scope.sql', 'policy', 'campaigns_member_update', 'campaigns', 1),
  ('20260727c_campaigns_member_and_plant_events_scope.sql', 'policy', 'campaign_posts_member_select', 'campaign_posts', 1),
  ('20260727c_campaigns_member_and_plant_events_scope.sql', 'policy', 'campaign_posts_member_insert', 'campaign_posts', 1),
  ('20260727c_campaigns_member_and_plant_events_scope.sql', 'policy', 'campaign_posts_member_update', 'campaign_posts', 1),
  ('20260727f_drop_ledger_events_view.sql', 'drop_view', 'business_inventory_ledger_events', 'business_inventory_ledger_events', 1),
  ('20260727g_social_drafts_member.sql', 'policy', 'social_drafts_member_select', 'social_drafts', 1),
  ('20260727g_social_drafts_member.sql', 'policy', 'social_drafts_member_update', 'social_drafts', 1),
  ('20260728c_funnel_no_op_short_circuit.sql', 'function', 'save_role_permissions', NULL, 4),
  ('20260730c_owner_branch_removed_and_owner_role_locked.sql', 'function', 'has_permission_for', NULL, 3),
  ('20260730c_owner_branch_removed_and_owner_role_locked.sql', 'function', 'save_role_permissions', NULL, 4),
  ('20260801_business_modules_write_narrowing.sql', 'policy', 'business_modules_member_select', 'business_modules', 1),
  ('20260801_business_modules_write_narrowing.sql', 'function', 'set_business_module_state', NULL, 3),
  ('20260801b_subscription_permission_and_enablement_split.sql', 'function', 'set_business_module_state', NULL, 3),
  ('20260801c_module_seed_and_trial_clock.sql', 'function', 'start_module_trial', NULL, 1),
  ('20260801c_module_seed_and_trial_clock.sql', 'function', 'seed_business_modules', NULL, 1),
  ('20260802c_enable_starts_the_clock.sql', 'function', 'set_business_module_state', NULL, 3),
  ('20260828_owner_role_carries_authority.sql', 'policy', 'service_offerings_member_insert', 'service_offerings', 1),
  ('20260828_owner_role_carries_authority.sql', 'policy', 'service_offerings_member_update', 'service_offerings', 1),
  ('20260828_owner_role_carries_authority.sql', 'policy', 'invitations_member_select', 'invitations', 1),
  ('20260828_owner_role_carries_authority.sql', 'policy', 'invitations_member_update', 'invitations', 1),
  ('20260828_owner_role_carries_authority.sql', 'policy', 'bm_member_select', 'business_members', 1),
  ('20260828_owner_role_carries_authority.sql', 'function', 'create_invitation', NULL, 1),
  ('20260830b_business_operating_days_check_and_comments.sql', 'constraint', 'business_operating_days_day_type_check', 'business_operating_days', 1),
  ('20260830c_count_group_variant_sizes.sql', 'function', 'count_group_variant_sizes', NULL, 1),
  ('20260831b_deliveries_qb_invoice_uidx_drop_predicate.sql', 'index', 'deliveries_business_qb_invoice_uidx', 'deliveries', 2),
  ('20260831c_orders_qb_invoice_uidx.sql', 'index', 'uidx_orders_business_qb_invoice', 'orders', 1),
  ('20260904b_reset_invitation_expiry.sql', 'function', 'reset_invitation_expiry', NULL, 1)
),
found AS (
  SELECT e.*,
    CASE e.kind
      WHEN 'policy'     THEN EXISTS (SELECT 1 FROM pg_policies p
                                      WHERE p.schemaname = 'public' AND p.policyname = e.name
                                        AND p.tablename = e.tbl)
      WHEN 'function'   THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                      WHERE n.nspname = 'public' AND p.proname = e.name)
      WHEN 'index'      THEN EXISTS (SELECT 1 FROM pg_indexes i
                                      WHERE i.schemaname = 'public' AND i.indexname = e.name)
      WHEN 'trigger'    THEN EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                                      JOIN pg_namespace n ON n.oid = c.relnamespace
                                      WHERE n.nspname = 'public' AND t.tgname = e.name AND NOT t.tgisinternal)
      WHEN 'constraint' THEN EXISTS (SELECT 1 FROM pg_constraint co JOIN pg_namespace n ON n.oid = co.connamespace
                                      WHERE n.nspname = 'public' AND co.conname = e.name)
      WHEN 'table'      THEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                      WHERE n.nspname = 'public' AND c.relname = e.name AND c.relkind IN ('r','p'))
      WHEN 'drop_view'  THEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                      WHERE n.nspname = 'public' AND c.relname = e.name AND c.relkind = 'v')
      ELSE NULL
    END AS ran
  FROM expected e
)
SELECT file,
       count(*)                                                  AS expected,
       count(*) FILTER (WHERE ran)                               AS present,
       count(*) FILTER (WHERE ran AND claimants > 1)              AS shared_names,
       CASE
         WHEN bool_or(ran IS NULL)                        THEN 'COULD NOT CHECK -- unhandled kind'
         WHEN bool_and(NOT ran)                           THEN 'FAIL -- NOT APPLIED'
         WHEN bool_or(NOT ran)                            THEN 'FAIL -- MIXED, read missing'
         WHEN bool_and(claimants > 1)                     THEN 'INCONCLUSIVE -- every name it declares is also declared by another migration, so presence cannot attribute it to THIS file'
         ELSE                                                  'PASS -- APPLIED'
       END                                                       AS verdict,
       coalesce(string_agg(kind || ' ' || name, ', ' ORDER BY name)
                FILTER (WHERE NOT ran), '')                      AS missing
FROM found
GROUP BY file
ORDER BY verdict, file;

-- 🔴 THE THIRD CATEGORY THIS QUERY CANNOT SETTLE EITHER, NAMED RATHER THAN OMITTED.
-- 17 unresolved migrations declare NO catalog object at all: their whole effect is a
-- data backfill (UPDATE/INSERT/DELETE), a GRANT/REVOKE, a COMMENT, an ALTER COLUMN
-- nullability change or a DROP CONSTRAINT. Apply-state for these is knowable only from
-- the ROWS or from privilege/constraint catalogs -- neither of which this exercise reads.
-- They stay COULD NOT CHECK after Stage 3, and that is the honest answer, not a gap:
--   . 20260521_make_shop_id_nullable.sql
--   . 20260608_advert_channels_config.sql
--   . 20260611_delete_debris_trace_enterprises_nursery.sql
--   . 20260614_cost_to_produce_restore_truncated_lines.sql
--   . 20260614_cost_to_produce_trace_seed.sql
--   . 20260624_audit_log_truncate_revoke.sql
--   . 20260715_orders_status_drop_check.sql
--   . 20260727_align_floor_to_bundles.sql
--   . 20260727b_align_floor_assets_retired.sql
--   . 20260728_revoke_truncate_references_public.sql
--   . 20260728b_default_privileges_truncate_references.sql
--   . 20260729_backfill_billing_from_legacy.sql
--   . 20260730_d52_r3_legacy_commitment_reconcile.sql
--   . 20260730a_owner_holds_all_backfill.sql
--   . 20260730b_owner_member_row_invariant.sql
--   . 20260802_trialling_modules_are_live.sql
--   . 20260802b_module_classification_corrections.sql
