-- LIVE public SCHEMA SNAPSHOT — structure only, no rows. Generated 2026-09-17T15:01:15.659Z
-- @@
-- by scripts/sql-harness/snapshot-live-schema.mjs. Do not edit by hand; re-run the script.
-- @@
-- 62 tables · 49 functions · 44 triggers · 165 policies · 1 views
-- @@
SET check_function_bodies = off;
-- @@
CREATE TABLE public."addons" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price_per_plant" numeric(10,2) NOT NULL,
  "trigger_rule" text,
  "pre_selected" boolean NOT NULL,
  "active" boolean NOT NULL,
  "sort_order" integer NOT NULL,
  "business_id" uuid NOT NULL
);
-- @@
CREATE TABLE public."audit_log" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "actor_role" text,
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "detail" jsonb NOT NULL,
  "outcome" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_accounting_secrets" (
  "business_id" uuid NOT NULL,
  "accounting_token" text,
  "accounting_refresh_token" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "oauth_state" text,
  "oauth_state_at" timestamp with time zone
);
-- @@
CREATE TABLE public."business_context" (
  "business_id" uuid NOT NULL,
  "what_we_do" text,
  "who_we_serve" text,
  "known_for" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_discovery_profiles" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "source_url" text NOT NULL,
  "raw_extract" jsonb NOT NULL,
  "status" text NOT NULL,
  "extracted_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_display_standards" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "domain" text NOT NULL,
  "group_key" text NOT NULL,
  "chosen_label" text,
  "suggested_label" text,
  "population" integer,
  "decided_by" uuid,
  "decided_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_inventory" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "sku" text,
  "name" text NOT NULL,
  "description" text,
  "qty" integer NOT NULL,
  "unit_cost" numeric(10,2),
  "serial_number" text,
  "location" text,
  "status" text NOT NULL,
  "received_at" timestamp with time zone,
  "photo_url" text,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "receipt_id" uuid,
  "cost_confidence" text,
  "size" text,
  "variant_group" text,
  "sell_price" numeric(10,2),
  "reorder_point" integer,
  "price_basis" text,
  "attributes" jsonb,
  "unit_kind" text,
  "unit_value" numeric,
  "unit_value_max" numeric,
  "unit_name" text,
  "unit_parsed_from" text,
  "retired_at" timestamp with time zone,
  "retired_reason" text,
  "import_run_id" uuid,
  "retired_by_run_id" uuid,
  "qb_item_id" text
);
-- @@
CREATE TABLE public."business_inventory_ledger" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "inventory_id" uuid,
  "delta" integer NOT NULL,
  "kind" text NOT NULL,
  "reason" text,
  "source_type" text,
  "source_id" uuid,
  "actor_user_id" uuid,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "aggregate_type" text,
  "aggregate_id" uuid,
  "event_type" text
);
-- @@
CREATE TABLE public."business_members" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "user_id" uuid,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "role" text NOT NULL,
  "permissions" jsonb NOT NULL,
  "active" boolean NOT NULL,
  "invite_id" uuid,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "pin_hash" text,
  "person_id" uuid
);
-- @@
CREATE TABLE public."business_modules" (
  "business_id" uuid NOT NULL,
  "module_key" text NOT NULL,
  "enabled" boolean NOT NULL,
  "configured" boolean NOT NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_operating_days" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "weekday" integer,
  "on_date" date,
  "day_type" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_operations_config" (
  "business_id" uuid NOT NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_pmi_schedule" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "asset_id" uuid NOT NULL,
  "interval_days" integer,
  "tasks" jsonb NOT NULL,
  "overrides" jsonb NOT NULL,
  "last_service_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_position_responsibilities" (
  "id" uuid NOT NULL,
  "position_id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "responsibility_id" text NOT NULL,
  "frequency" text,
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_positions" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "title" text NOT NULL,
  "excellence_note" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_pricing_config" (
  "business_id" uuid NOT NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."business_service_log" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "asset_id" uuid NOT NULL,
  "service_type" text NOT NULL,
  "performed_by" text,
  "performed_at" timestamp with time zone NOT NULL,
  "cost" numeric(10,2),
  "receipt_id" uuid,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL,
  "result" text
);
-- @@
CREATE TABLE public."business_voice_samples" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "platform" text NOT NULL,
  "original_text" text NOT NULL,
  "edited_text" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "source" text NOT NULL
);
-- @@
CREATE TABLE public."businesses" (
  "id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "address" text,
  "email" text,
  "website" text,
  "logo_url" text,
  "business_type" text NOT NULL,
  "accounting_type" text,
  "accounting_token" text,
  "accounting_refresh_token" text,
  "accounting_token_expires_at" timestamp with time zone,
  "accounting_needs_reconnect" boolean NOT NULL,
  "accounting_company_id" text,
  "trial_started_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "qbo_writes_enabled" boolean NOT NULL
);
-- @@
CREATE TABLE public."campaign_posts" (
  "id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "platform" text NOT NULL,
  "scheduled_date" date,
  "copy_text" text NOT NULL,
  "image_prompt" text,
  "edited_copy" text,
  "status" text NOT NULL,
  "published_at" timestamp with time zone,
  "post_submission_id" text,
  "created_at" timestamp with time zone NOT NULL,
  "subject" text
);
-- @@
CREATE TABLE public."campaigns" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "name" text NOT NULL,
  "campaign_type" text NOT NULL,
  "start_date" date,
  "end_date" date,
  "target_category" text,
  "description" text,
  "status" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."channels" (
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "label" text NOT NULL,
  "guidance" text,
  "active" boolean NOT NULL,
  "sort_order" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."container_ladder" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "label" text NOT NULL,
  "aliases" text[] NOT NULL,
  "sort_order" integer NOT NULL,
  "volume_gallons" numeric,
  "handling_minutes" numeric,
  "handling_because" text NOT NULL,
  "active" boolean NOT NULL,
  "retired_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."cost_object_assignments" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "asset_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone,
  "conversion_cost" numeric(10,2),
  "basis_confidence" text,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."cost_object_edges" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "parent_id" uuid NOT NULL,
  "child_id" uuid NOT NULL,
  "edge_type" text NOT NULL,
  "use_fraction" numeric(7,6) NOT NULL,
  "basis_type" text,
  "basis_note" text,
  "basis_confidence" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."cost_objects" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "name" text NOT NULL,
  "asset_type" text,
  "make" text,
  "model" text,
  "serial_number" text,
  "year" integer,
  "barcode_id" text,
  "assigned_to" jsonb,
  "status" text NOT NULL,
  "acquisition_cost" numeric(10,2),
  "warranty_months" integer,
  "photo_url" text,
  "notes" text,
  "is_active" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "location" text,
  "cost_confidence" text,
  "node_type" text NOT NULL,
  "parent_id" uuid,
  "domain" text,
  "project_status" text,
  "product_status" text,
  "substantiation" text NOT NULL,
  "receipt_id" uuid,
  "cost_shape" text NOT NULL,
  "cadence" text,
  "recurring_amount" numeric(10,2),
  "cost_nature" text NOT NULL,
  "cost_source" text NOT NULL,
  "cost_category" text,
  "resource_id" uuid,
  "labor_hours" numeric,
  "recovery_basis" text,
  "recovery_basis_source" text,
  "estimated_value" numeric(10,2),
  "estimated_value_confidence" text
);
-- @@
CREATE TABLE public."cultivar_plants" (
  "id" uuid NOT NULL,
  "tag_id" text NOT NULL,
  "species" text NOT NULL,
  "common_name" text,
  "plant_type" text NOT NULL,
  "current_container" text NOT NULL,
  "location_zone" text,
  "warranty_months" integer NOT NULL,
  "photo_url" text,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "business_id" uuid NOT NULL,
  "inventory_id" uuid
);
-- @@
CREATE TABLE public."customer_addresses" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "label" text NOT NULL,
  "line1" text,
  "line2" text,
  "city" text,
  "state" text,
  "zip" text,
  "notes" text,
  "is_default" boolean NOT NULL,
  "active" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "kind" text NOT NULL,
  "source" text,
  "import_run_id" uuid
);
-- @@
CREATE TABLE public."customer_emails" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "label" text NOT NULL,
  "value" text NOT NULL,
  "value_norm" text,
  "is_primary" boolean NOT NULL,
  "source" text,
  "active" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "import_run_id" uuid
);
-- @@
CREATE TABLE public."customer_phones" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "label" text NOT NULL,
  "value" text NOT NULL,
  "value_norm" text,
  "note" text,
  "is_primary" boolean NOT NULL,
  "source" text,
  "active" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "import_run_id" uuid
);
-- @@
CREATE TABLE public."customers" (
  "id" uuid NOT NULL,
  "first_name" text,
  "last_name" text,
  "email" text,
  "phone" text,
  "address_line1" text,
  "city" text,
  "state" text,
  "zip" text,
  "qb_customer_id" text,
  "marketing_opt_in" boolean NOT NULL,
  "source" text NOT NULL,
  "lifetime_value" numeric(10,2) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "business_id" uuid NOT NULL,
  "person_id" uuid,
  "price_tier" text NOT NULL,
  "customer_type" text NOT NULL,
  "tax_exempt" boolean NOT NULL,
  "tax_exempt_reason" text,
  "tax_exempt_cert_ref" text,
  "organization_name" text,
  "display_name" text,
  "billing_line1" text,
  "billing_line2" text,
  "billing_city" text,
  "billing_state" text,
  "billing_zip" text,
  "tax_id" text,
  "tax_exempt_expires" date,
  "tax_exempt_cert_doc_url" text,
  "payment_terms" text,
  "credit_limit" numeric(12,2),
  "status" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "notes" text,
  "import_run_id" uuid
);
-- @@
CREATE TABLE public."deliveries" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "customer_id" uuid,
  "delivery_date" date,
  "address_line1" text,
  "city" text,
  "state" text,
  "zip" text,
  "status" text NOT NULL,
  "source" text,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL,
  "service_type" text,
  "order_id" uuid,
  "qb_invoice_id" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "review_asked_at" timestamp with time zone,
  "review_ask_outcome" text
);
-- @@
CREATE TABLE public."inventory_count_sessions" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "status" text NOT NULL,
  "counted_by" uuid,
  "item_count" integer NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."inventory_counts" (
  "id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "inventory_id" uuid,
  "plant_tag_id" text,
  "item_label" text NOT NULL,
  "counted_qty" integer NOT NULL,
  "was_unknown" boolean NOT NULL,
  "raw_scan" text,
  "counted_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."invitations" (
  "id" uuid NOT NULL,
  "token" text NOT NULL,
  "business_id" uuid NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "role" text NOT NULL,
  "used" boolean NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "person_id" uuid
);
-- @@
CREATE TABLE public."labor_resource_wages" (
  "resource_id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "base_wage" numeric(10,2),
  "burden" numeric(10,2),
  "cost_rate" numeric(10,2),
  "bill_rate" numeric(10,2),
  "rate" numeric(10,2),
  "pass_through_expenses" numeric(10,2),
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."labor_resources" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "resource_type" text NOT NULL,
  "name" text NOT NULL,
  "rate_basis" text NOT NULL,
  "base_wage" numeric(10,2),
  "burden" numeric(10,2),
  "cost_rate" numeric(10,2),
  "bill_rate" numeric(10,2),
  "rate" numeric(10,2),
  "pass_through_expenses" numeric(10,2),
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "person_id" uuid
);
-- @@
CREATE TABLE public."losses" (
  "id" uuid NOT NULL,
  "nursery_id" uuid NOT NULL,
  "plant_id" uuid,
  "reason" text NOT NULL,
  "estimated_value" numeric(10,2) NOT NULL,
  "notes" text,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."member_device_handoffs" (
  "id" uuid NOT NULL,
  "token" text NOT NULL,
  "business_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "issued_by" uuid NOT NULL,
  "device_fingerprint" text,
  "used" boolean NOT NULL,
  "used_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."member_devices" (
  "id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "device_label" text,
  "device_fingerprint" text,
  "biometric_enrolled" boolean NOT NULL,
  "is_active" boolean NOT NULL,
  "last_seen" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "credential_id" text,
  "credential_public_key" text,
  "credential_transports" text,
  "credential_enrolled_at" timestamp with time zone
);
-- @@
CREATE TABLE public."modules" (
  "id" uuid NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "icon" text,
  "tier_required" text,
  "setup_required" boolean,
  "sort_order" integer,
  "built" boolean,
  "created_at" timestamp with time zone
);
-- @@
CREATE TABLE public."nurseries" (
  "id" uuid NOT NULL,
  "owner_id" uuid,
  "name" text NOT NULL,
  "address" text,
  "phone" text,
  "email" text,
  "website" text,
  "logo_url" text,
  "tax_rate" numeric(6,4) NOT NULL,
  "qb_realm_id" text,
  "qb_access_token" text,
  "qb_refresh_token" text,
  "created_at" timestamp with time zone NOT NULL,
  "qb_token_expires_at" timestamp with time zone,
  "qb_needs_reconnect" boolean NOT NULL
);
-- @@
CREATE TABLE public."nursery_profiles" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "default_install_price" numeric(10,2),
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."opportunity_items" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" numeric(10,2) NOT NULL,
  "is_active" boolean NOT NULL,
  "sort_order" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."order_addons" (
  "id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "addon_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" numeric(10,2) NOT NULL,
  "subtotal" numeric(10,2) NOT NULL
);
-- @@
CREATE TABLE public."order_compliance_records" (
  "id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "service_offering_id" uuid,
  "business_id" uuid NOT NULL,
  "compliance_title_shown" text,
  "compliance_body_shown" text,
  "decision" text NOT NULL,
  "acknowledged_by" text,
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."order_items" (
  "id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" numeric(10,2) NOT NULL,
  "subtotal" numeric(10,2) NOT NULL,
  "business_inventory_id" uuid,
  "is_manual_override" boolean NOT NULL,
  "original_price" numeric(10,2),
  "price_leakage" numeric(10,2),
  "override_by" uuid,
  "override_reason" text,
  "retail_unit" numeric(10,2),
  "discount_pct" numeric(5,2),
  "discount_amt" numeric(10,2),
  "description" text,
  "sku" text
);
-- @@
CREATE TABLE public."order_service_selections" (
  "id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "service_offering_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price_at_time" numeric(10,2) NOT NULL,
  "subtotal" numeric(10,2) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "is_manual_override" boolean NOT NULL,
  "original_price" numeric(10,2),
  "price_leakage" numeric(10,2),
  "override_by" uuid,
  "override_reason" text
);
-- @@
CREATE TABLE public."orders" (
  "id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "employee_id" uuid,
  "qb_invoice_id" text,
  "qb_invoice_url" text,
  "transport_method" text NOT NULL,
  "transport_note" text,
  "netting_declined" boolean NOT NULL,
  "install_date" date,
  "subtotal" numeric(10,2) NOT NULL,
  "tax_amount" numeric(10,2) NOT NULL,
  "total_amount" numeric(10,2) NOT NULL,
  "addons_amount" numeric(10,2) NOT NULL,
  "status" text NOT NULL,
  "leakage_flag" boolean NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL,
  "business_id" uuid NOT NULL,
  "delivery_date" date,
  "tax_exempt_applied" boolean NOT NULL,
  "tax_exempt_reason" text,
  "tax_exempt_cert_ref" text,
  "tax_exempt_by" uuid,
  "order_kind" text,
  "source_document_number" text,
  "qb_doc_number" text,
  "sale_date" date,
  "receipt_id" uuid,
  "import_run_id" uuid
);
-- @@
CREATE TABLE public."people" (
  "id" uuid NOT NULL,
  "auth_user_id" uuid,
  "first_name" text,
  "last_name" text,
  "full_name" text,
  "email" text,
  "phone" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."permission_aliases" (
  "from_perm" text NOT NULL,
  "implies_perm" text NOT NULL
);
-- @@
CREATE TABLE public."plant_events" (
  "id" uuid NOT NULL,
  "plant_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "from_container" text,
  "to_container" text,
  "notes" text,
  "employee_id" text,
  "occurred_at" timestamp with time zone NOT NULL,
  "business_id" uuid NOT NULL
);
-- @@
CREATE TABLE public."platform_config" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "description" text,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."production_plan_lines" (
  "id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "source_inventory_id" uuid NOT NULL,
  "target_inventory_id" uuid,
  "from_unit_value" numeric NOT NULL,
  "to_unit_value" numeric NOT NULL,
  "qty_planned" integer NOT NULL,
  "qty_completed" integer NOT NULL,
  "sales_per_month" numeric,
  "cover_months" numeric,
  "cushion_pct" numeric,
  "grow_months" numeric,
  "scheduled_date" date,
  "completed_date" date,
  "completed_by" uuid,
  "backdate_reason" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."production_plans" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "name" text NOT NULL,
  "window_start" date,
  "window_end" date,
  "status" text NOT NULL,
  "batch_size" integer NOT NULL,
  "reason" text,
  "created_by" uuid,
  "committed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."receipts" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "image_url" text,
  "ocr_raw" jsonb,
  "vendor" text,
  "date" date,
  "amount" numeric(10,2),
  "category" text,
  "status" text NOT NULL,
  "accept_vs_edit" text,
  "ocr_cost_estimate" numeric(10,6),
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "line_items" jsonb,
  "line_items_original" jsonb,
  "amount_original" numeric(10,2),
  "reconcile_status" text,
  "reconcile_overridden_at" timestamp with time zone,
  "reconcile_delta" numeric(10,2),
  "header_amount_edited" boolean,
  "vendor_id" uuid,
  "receipt_number" text,
  "receipt_number_original" text
);
-- @@
CREATE TABLE public."role_definitions" (
  "id" uuid NOT NULL,
  "business_id" uuid,
  "role_key" text NOT NULL,
  "is_system" boolean NOT NULL,
  "label" text,
  "description" text,
  "permissions" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."service_offerings" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "timing" text NOT NULL,
  "price_type" text NOT NULL,
  "price_unit" text NOT NULL,
  "price" numeric(10,2) NOT NULL,
  "transport_mode" text,
  "trigger_transport_mode" text,
  "recurrence_days" integer,
  "requires_address" boolean NOT NULL,
  "pre_selected" boolean NOT NULL,
  "is_active" boolean NOT NULL,
  "sort_order" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "compliance_title" text,
  "compliance_body" text,
  "service_note" text
);
-- @@
CREATE TABLE public."social_drafts" (
  "id" uuid NOT NULL,
  "platform" text NOT NULL,
  "status" text NOT NULL,
  "scheduled_for" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "post_type" text,
  "business_id" uuid NOT NULL,
  "original_text" text,
  "edited_text" text,
  "cadence" text,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "subject_type" text,
  "subject_id" uuid,
  "copied_at" timestamp with time zone
);
-- @@
CREATE TABLE public."vendor_aliases" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "vendor_id" uuid NOT NULL,
  "alias" text NOT NULL,
  "source" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
-- @@
CREATE TABLE public."vendor_preferences" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "vendor_key" text NOT NULL,
  "vendor_label" text NOT NULL,
  "preference_kind" text NOT NULL,
  "preference_value" text,
  "preferred" boolean NOT NULL,
  "preference_note" text,
  "answered_by" uuid,
  "answered_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "vendor_id" uuid
);
-- @@
CREATE TABLE public."vendors" (
  "id" uuid NOT NULL,
  "business_id" uuid NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "account_number" text,
  "address_line1" text,
  "address_city" text,
  "address_state" text,
  "address_zip" text,
  "website" text,
  "preferred" boolean NOT NULL,
  "preference_note" text,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
-- @@
CREATE OR REPLACE FUNCTION public.adjust_inventory_manual(p_lot_id uuid, p_business_id uuid, p_new_qty integer, p_actor_user_id uuid, p_reason text DEFAULT NULL::text, p_kind text DEFAULT 'adjust'::text, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(new_qty integer, delta integer, ledger_id uuid, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current int;
  v_delta   int;
  v_ledger  uuid;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF p_new_qty IS NULL OR p_new_qty < 0 THEN
    RAISE EXCEPTION 'qty must be >= 0 (got %)', p_new_qty USING ERRCODE = 'check_violation';
  END IF;

  SELECT bi.qty INTO v_current
    FROM public.business_inventory bi
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::int, NULL::int, NULL::uuid, false, 'lot_not_found'::text;
    RETURN;
  END IF;

  v_delta := p_new_qty - v_current;

  IF v_delta = 0 THEN
    -- Nothing moved. No ledger row — the ledger records MOVEMENT, and a no-op is not one
    -- (a row here would make replay noisier without adding a fact).
    RETURN QUERY SELECT p_new_qty, 0, NULL::uuid, true, 'noop'::text;
    RETURN;
  END IF;

  UPDATE public.business_inventory bi
     SET qty = p_new_qty,
         status = CASE
                    WHEN bi.status IN ('available', 'depleted', 'reserved')
                      THEN CASE WHEN p_new_qty <= 0 THEN 'depleted' ELSE 'available' END
                    ELSE bi.status
                  END,
         updated_at = now()
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id;

  v_ledger := public.emit_inventory_movement(
    p_business_id, p_lot_id, v_delta, COALESCE(p_kind, 'adjust'),
    p_reason, 'manual', NULL, p_actor_user_id, p_occurred_at);

  RETURN QUERY SELECT p_new_qty, v_delta, v_ledger, true, 'applied'::text;
END $function$;
-- @@
CREATE OR REPLACE FUNCTION public.adjust_inventory_qty(p_lot_id uuid, p_business_id uuid, p_delta integer, p_actor_user_id uuid DEFAULT NULL::uuid, p_kind text DEFAULT 'sale'::text, p_reason text DEFAULT NULL::text, p_source_type text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(new_qty integer, new_status text, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_qty    int;
  v_status text;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- UNCHANGED from 20260713 — a SINGLE guarded UPDATE (implicit row lock), concurrency-safe,
  -- oversell guard intact, status derivation intact, manual damaged/returned preserved.
  UPDATE public.business_inventory bi
     SET qty = bi.qty + p_delta,
         status = CASE
                    WHEN bi.status IN ('available', 'depleted', 'reserved')
                      THEN CASE WHEN bi.qty + p_delta <= 0 THEN 'depleted' ELSE 'available' END
                    ELSE bi.status
                  END,
         updated_at = now()
   WHERE bi.id = p_lot_id
     AND bi.business_id = p_business_id
     AND bi.qty + p_delta >= 0     -- OVERSELL GUARD: never drive qty negative
   RETURNING bi.qty, bi.status INTO v_qty, v_status;

  IF FOUND THEN
    -- SAME TRANSACTION as the UPDATE above. This is the whole decision.
    PERFORM public.emit_inventory_movement(
      p_business_id, p_lot_id, p_delta, COALESCE(p_kind, 'sale'),
      p_reason, p_source_type, p_source_id, p_actor_user_id, p_occurred_at);
    RETURN QUERY SELECT v_qty, v_status, true, 'applied'::text;
    RETURN;
  END IF;

  -- 0 rows updated → distinguish an oversell refusal from a missing lot (honest signal).
  -- NO ledger row: nothing moved, so there is nothing to record. A refusal is not a movement.
  IF EXISTS (SELECT 1 FROM public.business_inventory
              WHERE id = p_lot_id AND business_id = p_business_id) THEN
    SELECT bi.qty, bi.status INTO v_qty, v_status
      FROM public.business_inventory bi
     WHERE bi.id = p_lot_id AND bi.business_id = p_business_id;
    RETURN QUERY SELECT v_qty, v_status, false, 'oversell_refused'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::int, NULL::text, false, 'lot_not_found'::text;
END $function$;
-- @@
CREATE OR REPLACE FUNCTION public.assert_movement_actor(p_business_id uuid, p_actor_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- (2) NO FORGERY — a client-direct caller may only write movements as themselves.
  IF auth.uid() IS NOT NULL AND p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'movement actor mismatch: a caller may only record movements as themselves (D-50 — the row carries the REAL actor)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- NULL actor = an honest system write. Reachable only under the service key, because an
  -- authenticated caller has a non-NULL auth.uid() and would have tripped the pin above.
  IF p_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  -- (1) MEMBERSHIP — trust-but-verify, by id (AC-2).
  IF NOT public.is_member_of(p_business_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'movement actor % is not the owner or an active member of business %', p_actor_user_id, p_business_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.assign_member_role(p_business_id uuid, p_actor_user_id uuid, p_member_id uuid, p_role_key text)
 RETURNS TABLE(applied boolean, reason text, role_before text, role_after text, perms_before jsonb, perms_after jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_resolved   jsonb;
  v_role_before text;
  v_perms_before jsonb;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = p_actor_user_id) THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'permission.self_elevation_denied', 'member', p_member_id::text,
            jsonb_build_object('attempted_role', p_role_key), 'denied');
    RETURN QUERY SELECT false, 'only the business owner may assign roles'::text,
      NULL::text, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  -- resolve the role's effective permissions (tenant override wins over floor).
  SELECT permissions INTO v_resolved
    FROM public.role_definitions
   WHERE role_key = p_role_key AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC
   LIMIT 1;
  IF v_resolved IS NULL THEN
    RETURN QUERY SELECT false, ('role ' || p_role_key || ' is not defined for this business')::text,
      NULL::text, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  SELECT role, permissions INTO v_role_before, v_perms_before
    FROM public.business_members
   WHERE id = p_member_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'member not found in this business'::text,
      NULL::text, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  PERFORM set_config('trace.authority_funnel', 'on', true);

  UPDATE public.business_members
     SET role = p_role_key, permissions = v_resolved
   WHERE id = p_member_id AND business_id = p_business_id;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, 'OWNER', 'member.role_changed', 'member', p_member_id::text,
          jsonb_build_object('before_role', v_role_before, 'after_role', p_role_key,
                             'before', v_perms_before, 'after', v_resolved),
          'success');

  RETURN QUERY SELECT true, NULL::text, v_role_before, p_role_key, v_perms_before, v_resolved;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.business_inventory_unit_projection_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.unit_parsed_from IS DISTINCT FROM NEW.size THEN
    NEW.unit_kind        := NULL;
    NEW.unit_value       := NULL;
    NEW.unit_value_max   := NULL;
    NEW.unit_name        := NULL;
    NEW.unit_parsed_from := NULL;
  END IF;
  RETURN NEW;
END $function$;
-- @@
CREATE OR REPLACE FUNCTION public.channels_validate_advert_channels()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  stray text;
BEGIN
  IF NEW.config IS NULL OR NOT (NEW.config ? 'advert_channels') THEN
    RETURN NEW;
  END IF;

  -- A malformed shape is refused by name rather than silently skipped: a non-array here would make
  -- every check below vacuously pass, which is the "check that cannot disagree" shape (§6 r19).
  IF jsonb_typeof(NEW.config->'advert_channels') <> 'array' THEN
    RAISE EXCEPTION 'advert_channels must be a JSON array, got %', jsonb_typeof(NEW.config->'advert_channels');
  END IF;

  SELECT string_agg(DISTINCT q.n, ', ') INTO stray
    FROM (SELECT jsonb_array_elements(NEW.config->'advert_channels')->>'name' AS n) q
   WHERE q.n IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.channels c WHERE c.name = q.n);

  IF stray IS NOT NULL THEN
    RAISE EXCEPTION
      'unknown channel name(s) in advert_channels: %. Add a row to public.channels in a migration first.', stray;
  END IF;

  RETURN NEW;
END $function$;
-- @@
CREATE OR REPLACE FUNCTION public.count_group_variant_sizes(p_business_id uuid, p_actor_user_id uuid, p_variant_group text, p_row_ids uuid[])
 RETURNS TABLE(grouped_count integer, requested_count integer, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_requested int;
  v_grouped   int;
BEGIN
  -- Same membership gate as §7b/§7c, and the same no-forgery rule: a client-direct caller may
  -- only act as themselves. Nothing here is looser than the two calls that already run beside it.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF p_variant_group IS NULL OR btrim(p_variant_group) = '' THEN
    RAISE EXCEPTION 'a grouping key is required (D-9 — never write a blank identity over a real one)'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_row_ids IS NULL OR array_length(p_row_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no rows named to group (a caller asking for nothing is a bug, not a no-op)'
      USING ERRCODE = 'check_violation';
  END IF;

  -- DISTINCT so a caller that names a row twice does not inflate the expected count and turn a
  -- successful grouping into a reported shortfall.
  SELECT count(DISTINCT id) INTO v_requested FROM unnest(p_row_ids) AS id;

  -- 🔴 ONE COLUMN. See THE BOUNDARY above. `business_id` is in the predicate, not the SET list —
  -- it scopes the write to the caller's own tenant (AC-3) and can never be moved by it.
  UPDATE public.business_inventory
     SET variant_group = p_variant_group
   WHERE id = ANY(p_row_ids)
     AND business_id = p_business_id;

  GET DIAGNOSTICS v_grouped = ROW_COUNT;

  -- The call site calls this "THE INVARIANT, in two writes that must both land." So a partial
  -- grouping is a REFUSAL, not a warning: a family half-keyed is the mixed-group state that makes
  -- the next scan resolve UNKNOWN, and it is better to stop the walk than to leave it there
  -- believing it succeeded. Replay-safe — re-running sets the same key on the same rows.
  IF v_grouped < v_requested THEN
    RETURN QUERY SELECT
      v_grouped, v_requested, false,
      format('grouped %s of %s rows — the rest are missing or belong to another business',
             v_grouped, v_requested)::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_grouped, v_requested, true, 'applied'::text;
END $function$;
-- @@
CREATE OR REPLACE FUNCTION public.count_promote_create_inventory(p_business_id uuid, p_actor_user_id uuid, p_name text, p_qty integer, p_size text DEFAULT NULL::text, p_variant_group text DEFAULT NULL::text, p_sku text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(inventory_id uuid, ledger_id uuid, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_lot    uuid;
  v_ledger uuid;
  v_kind   text;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF p_qty IS NULL OR p_qty < 0 THEN
    RAISE EXCEPTION 'new lot qty must be >= 0 (got %)', p_qty USING ERRCODE = 'check_violation';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'a new lot requires a name (D-9 — never mint an unnamed row)'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.business_inventory
    (business_id, name, qty, size, variant_group, sku, status, cost_confidence)
  VALUES
    (p_business_id, p_name, p_qty, p_size, p_variant_group, p_sku,
     CASE WHEN p_qty > 0 THEN 'available' ELSE 'depleted' END,
     'UNKNOWN')            -- mirrors InventoryCount.tsx:479-484 — cost is not known at count time
  RETURNING id INTO v_lot;

  v_kind := CASE WHEN p_qty > 0 THEN 'count_reconcile' ELSE 'opening_balance' END;

  v_ledger := public.emit_inventory_movement(
    p_business_id, v_lot, p_qty, v_kind,
    p_reason, 'inventory_count', p_source_id, p_actor_user_id, p_occurred_at);

  RETURN QUERY SELECT v_lot, v_ledger, true, 'applied'::text;
END $function$;
-- @@
CREATE OR REPLACE FUNCTION public.count_reconcile_inventory(p_lot_id uuid, p_business_id uuid, p_counted_qty integer, p_actor_user_id uuid, p_size text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(new_qty integer, delta integer, ledger_id uuid, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current int;
  v_delta   int;
  v_ledger  uuid;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF p_counted_qty IS NULL OR p_counted_qty < 0 THEN
    RAISE EXCEPTION 'counted qty must be >= 0 (got %) — a count asserts physical truth', p_counted_qty
      USING ERRCODE = 'check_violation';
  END IF;

  -- FOR UPDATE: lock the lot so a concurrent sale cannot land between the read and the write.
  -- This closes recon finding #1 — "a count committed while an order is being paid silently
  -- overwrites the decrement" — which is live today on every absolute-SET path.
  SELECT bi.qty INTO v_current
    FROM public.business_inventory bi
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::int, NULL::int, NULL::uuid, false, 'lot_not_found'::text;
    RETURN;
  END IF;

  v_delta := p_counted_qty - v_current;

  UPDATE public.business_inventory bi
     SET qty    = p_counted_qty,
         size   = COALESCE(p_size, bi.size),
         status = CASE
                    WHEN bi.status IN ('available', 'depleted', 'reserved')
                      THEN CASE WHEN p_counted_qty <= 0 THEN 'depleted' ELSE 'available' END
                    ELSE bi.status
                  END,
         updated_at = now()
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id;

  -- A zero-delta count is still a FACT worth recording ("counted, and it agreed"): it is the
  -- evidence that closes a reconcile window. Recorded, same transaction.
  v_ledger := public.emit_inventory_movement(
    p_business_id, p_lot_id, v_delta, 'count_reconcile',
    p_reason, 'inventory_count', p_source_id, p_actor_user_id, p_occurred_at);

  RETURN QUERY SELECT p_counted_qty, v_delta, v_ledger, true, 'applied'::text;
END $function$;
-- @@
CREATE OR REPLACE FUNCTION public.create_invitation(p_business_id uuid, p_actor_user_id uuid, p_name text, p_role_key text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text)
 RETURNS TABLE(applied boolean, reason text, invitation_id uuid, invite_token text, new_member_id uuid, resolved_permissions jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_resolved   jsonb;
  v_role       text := upper(coalesce(p_role_key, ''));
  v_name       text := nullif(btrim(coalesce(p_name, '')), '');
  v_inv_id     uuid;
  v_token      text;
  v_member_id  uuid;
  v_is_holder  boolean;
BEGIN
  -- Impersonation is a hard RAISE, not a recoverable denial (same as the two funnel RPCs).
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- ── AUTHORISE ────────────────────────────────────────────────────────────────────────────────
  -- has_permission_for, not has_permission: the actor is PASSED, and it has had no owner branch
  -- since 2026-07-30, so this is a pure "does this person hold the string" test.
  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'team:create') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                  target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'invitation.create_denied', 'invitation', NULL,
            jsonb_build_object('attempted_role', v_role, 'rule', 'team:create is required'), 'denied');
    RETURN QUERY SELECT false, 'you do not have permission to invite people to this business'::text,
      NULL::uuid, NULL::text, NULL::uuid, NULL::jsonb;
    RETURN;
  END IF;

  -- ── VALIDATE (§1.6 item 3 — refuse, never fabricate) ─────────────────────────────────────────
  IF v_name IS NULL THEN
    RETURN QUERY SELECT false, 'a name is required'::text,
      NULL::uuid, NULL::text, NULL::uuid, NULL::jsonb;
    RETURN;
  END IF;

  -- ── THE OWNER-PROMOTION GUARD (Stage 1 only — see the header) ────────────────────────────────
  SELECT EXISTS (SELECT 1 FROM public.businesses
                  WHERE id = p_business_id AND owner_id = p_actor_user_id)
    INTO v_is_holder;
  IF v_role = 'OWNER' AND NOT v_is_holder THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                  target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, 'OWNER', 'invitation.create_denied', 'invitation', NULL,
            jsonb_build_object('attempted_role', v_role,
                               'rule', 'inviting an OWNER is a promotion; Stage 1 keeps it with the account holder'),
            'denied');
    RETURN QUERY SELECT false,
      'only the account holder can invite someone as an owner'::text,
      NULL::uuid, NULL::text, NULL::uuid, NULL::jsonb;
    RETURN;
  END IF;

  -- ── RESOLVE THE ROLE, SERVER-SIDE. THE CLIENT NEVER SUPPLIES A PERMISSION ARRAY. ─────────────
  -- Identical resolution to assign_member_role: tenant override wins over the floor. Mints read
  -- the resolved floor (David's ruling 2026-07-23) — so an invite seeds from the SAME source the
  -- Roles tab renders and the funnel writes, and there is no fourth copy to drift (STD-011).
  SELECT permissions INTO v_resolved
    FROM public.role_definitions
   WHERE role_key = v_role AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC
   LIMIT 1;

  IF v_resolved IS NULL THEN
    RETURN QUERY SELECT false, ('role ' || v_role || ' is not defined for this business')::text,
      NULL::uuid, NULL::text, NULL::uuid, NULL::jsonb;
    RETURN;
  END IF;

  -- ── WRITE — both rows, one transaction ───────────────────────────────────────────────────────
  INSERT INTO public.invitations (business_id, name, email, phone, role)
  VALUES (p_business_id, v_name, nullif(btrim(coalesce(p_email, '')), ''),
          nullif(btrim(coalesce(p_phone, '')), ''), v_role)
  RETURNING id, token INTO v_inv_id, v_token;

  -- The paired INACTIVE member row acceptInvitation looks for by invite_id (acceptInvitation.ts:71).
  -- `active = false` and `user_id` NULL until the person accepts. The authority trigger is BEFORE
  -- UPDATE and does not fire on this INSERT; the array is safe because it came from the line above,
  -- not from a caller.
  INSERT INTO public.business_members
    (business_id, name, email, phone, role, permissions, active, invite_id)
  VALUES (p_business_id, v_name, nullif(btrim(coalesce(p_email, '')), ''),
          nullif(btrim(coalesce(p_phone, '')), ''), v_role, v_resolved, false, v_inv_id)
  RETURNING id INTO v_member_id;

  -- ── AUDIT — the accountability record (D-51 / the two-log split) ─────────────────────────────
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, 'OWNER', 'invitation.created', 'invitation',
          v_inv_id::text,
          jsonb_build_object('name', v_name, 'role', v_role,
                             'member_id', v_member_id,
                             'permission_count', jsonb_array_length(v_resolved),
                             'permissions', v_resolved,
                             'has_email', (nullif(btrim(coalesce(p_email, '')), '') IS NOT NULL),
                             'source', 'create_invitation'),
          'success');

  RETURN QUERY SELECT true, NULL::text, v_inv_id, v_token, v_member_id, v_resolved;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.discard_ledger_row_in_test_mode()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_writes boolean;
BEGIN
  BEGIN
    SELECT b.qbo_writes_enabled INTO v_writes
      FROM public.businesses b
     WHERE b.id = NEW.business_id;
  EXCEPTION WHEN OTHERS THEN
    v_writes := NULL;              -- could not read the flag → fail toward NOT writing
  END;
  IF v_writes IS TRUE THEN
    RETURN NEW;                    -- writes on: the ledger records as it always has
  END IF;
  RETURN NULL;                     -- test mode (or unknown): the row is discarded, silently
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.discovery_create_inventory(p_business_id uuid, p_name text, p_sku text DEFAULT NULL::text, p_size text DEFAULT NULL::text, p_variant_group text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(inventory_id uuid, ledger_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_lot    uuid;
  v_ledger uuid;
BEGIN
  INSERT INTO public.business_inventory
    (business_id, name, qty, sku, size, variant_group, status, cost_confidence)
  VALUES (p_business_id, p_name, 0, p_sku, p_size, p_variant_group, 'available', 'UNKNOWN')
  RETURNING id INTO v_lot;

  v_ledger := public.emit_inventory_movement(
    p_business_id, v_lot, 0, 'opening_balance',
    'catalog discovery birth (qty 0 — stock is never fabricated)',
    'discovery', p_source_id, NULL, p_occurred_at);

  RETURN QUERY SELECT v_lot, v_ledger;
END $function$;
-- @@
CREATE OR REPLACE FUNCTION public.discovery_rescan_clear(p_business_id uuid, p_sku_prefix text DEFAULT 'DISC-'::text, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(cleared integer, skipped integer, skipped_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_cleared int := 0;
  v_skipped uuid[] := ARRAY[]::uuid[];
  r         record;
BEGIN
  FOR r IN
    SELECT bi.id, bi.qty
      FROM public.business_inventory bi
     WHERE bi.business_id = p_business_id
       AND bi.sku LIKE p_sku_prefix || '%'
       AND bi.status <> 'deleted'
     FOR UPDATE
  LOOP
    IF r.qty <> 0
       OR EXISTS (SELECT 1 FROM public.business_inventory_ledger l
                   WHERE l.inventory_id = r.id AND l.kind <> 'opening_balance')
       OR EXISTS (SELECT 1 FROM public.inventory_counts ic
                   WHERE ic.inventory_id = r.id)
    THEN
      v_skipped := v_skipped || r.id;      -- HAS HISTORY → protected, and reported
      CONTINUE;
    END IF;

    UPDATE public.business_inventory
       SET status = 'deleted', updated_at = now()
     WHERE id = r.id;

    PERFORM public.emit_inventory_movement(
      p_business_id, r.id, 0, 'rescan_clear',
      'catalog re-scan cleared an uncounted discovery row (qty 0, no movement history)',
      'discovery', NULL, NULL, p_occurred_at);

    v_cleared := v_cleared + 1;
  END LOOP;

  -- COALESCE: array_length of an EMPTY array returns NULL, not 0 — an untreated NULL here
  -- would read as "unknown how many were skipped" on a clean run. Honest zero.
  RETURN QUERY SELECT v_cleared, COALESCE(array_length(v_skipped, 1), 0), v_skipped;
END $function$;
-- @@
CREATE OR REPLACE FUNCTION public.edit_receipt_line_items(p_receipt_id uuid, p_line_items jsonb, p_acknowledged_mismatch boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_receipt      public.receipts%ROWTYPE;
  v_actor        uuid := auth.uid();
  v_is_owner     boolean;
  v_line         jsonb;
  v_idx          int := 0;
  v_sum          numeric(12,2) := 0;
  v_any_no_amt   boolean := false;
  v_total        numeric(10,2);
  v_delta        numeric(10,2);
  v_abs          numeric(10,2);
  v_status       text;
  v_overridden   timestamptz;
  v_changes      jsonb := '[]'::jsonb;
  v_old_line     jsonb;
  v_field        text;
  v_old_v        jsonb;
  v_new_v        jsonb;
BEGIN
  -- ── the row, tenant-scoped by its own business_id (AC-3) ──────────────────────────────────
  SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'receipt not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- ── OWNER ONLY. Not a manager, not staff, and not "a member holding costs:update" ─────────
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = v_receipt.business_id AND owner_id = v_actor
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    -- 🔴 THE DENIAL IS *NOT* AUDITED HERE, AND THAT IS A CORRECTION, NOT AN OMISSION.
    -- This block used to INSERT a `receipt.line_edit_denied` row into audit_log and then RAISE.
    -- It cannot work: there is no enclosing EXCEPTION block, so the RAISE aborts the transaction
    -- and takes the INSERT with it. The row is never committed. The probe that guarded it asserted
    -- the STRING `receipt.line_edit_denied` was present in this file — which it was, doing nothing.
    -- That is R-33 / §6 r19 exactly: a check incapable of disagreeing, one layer out from the seven
    -- mutants this build already caught for the same reason.
    -- Shipping a statement that claims to record a refusal it cannot record is worse than not
    -- recording it, so it is REMOVED and the gap is named: tech-debt #150. A rollback-proof denial
    -- log needs a sink outside the aborting transaction (the durable options are a non-raising
    -- return the caller must inspect, or an out-of-transaction writer); neither is decided, and
    -- neither is invented inside this build.
    -- The REFUSAL itself is unaffected — it is hard, and `trg_receipts_snapshot_and_line_guard`
    -- refuses the same write again on every other path.
    RAISE EXCEPTION 'only the business owner may edit receipt line items'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── shape validation. A malformed payload is refused, never coerced ───────────────────────
  IF p_line_items IS NULL OR jsonb_typeof(p_line_items) <> 'array' THEN
    RAISE EXCEPTION 'line items must be a json array' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_line_items) LOOP
    IF jsonb_typeof(v_line) <> 'object' THEN
      RAISE EXCEPTION 'line % is not an object', v_idx USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- A description is required; quantity, unit_price and sku may legitimately be absent.
    -- 🔴 A BLANK IS AN ANSWER (David's ruling): a unit nobody knows stays unknown rather than
    -- being invented, and the arithmetic below reports incomplete rather than guessing.
    IF COALESCE(btrim(v_line->>'description'), '') = '' THEN
      RAISE EXCEPTION 'line % has no description', v_idx USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF v_line->>'amount' IS NULL OR btrim(v_line->>'amount') = '' THEN
      v_any_no_amt := true;
    ELSE
      BEGIN
        v_sum := v_sum + (v_line->>'amount')::numeric;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'line % has an unreadable amount', v_idx USING ERRCODE = 'invalid_parameter_value';
      END;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  -- ── SERVER-AUTHORITATIVE RECONCILE ────────────────────────────────────────────────────────
  v_total := v_receipt.amount;

  IF v_idx = 0 THEN
    -- no lines: the column stores NULL for this, exactly as the capture path does
    v_status := NULL; v_delta := NULL;
  ELSIF v_any_no_amt OR v_total IS NULL THEN
    -- 🔴 INCOMPLETE, NOT ZERO. A line with no amount makes the sum unassertable; storing a
    -- verdict computed as though the blank were $0.00 would be a fabricated measurement
    -- (D-9 — the same class as rendering a withheld figure as 0).
    v_status := NULL; v_delta := NULL;
  ELSE
    v_delta := v_sum - v_total;
    v_abs   := abs(v_delta);
    IF v_abs <= 0.02 THEN
      v_status := 'match';
    ELSIF v_abs < 5.00 OR (v_total > 0 AND (v_abs / v_total) < 0.10) THEN
      v_status := 'small_gap';
    ELSE
      IF NOT p_acknowledged_mismatch THEN
        RAISE EXCEPTION 'edit leaves lines % against a total of % — a gap of %; re-send with acknowledgement to save anyway',
          v_sum, v_total, v_abs
          USING ERRCODE = 'check_violation';
      END IF;
      v_status     := 'large_mismatch_overridden';
      v_overridden := now();
    END IF;
  END IF;

  -- ── the per-line diff, built BEFORE the write ─────────────────────────────────────────────
  -- WHO · WHEN · WHICH FIELD · FROM WHAT TO WHAT · ON WHICH RECEIPT. Descriptions and money are
  -- the substance of the change and are recorded; nothing else about a person is (the migration's
  -- "no casual PII" clause — no email, no phone, no address is touched by this path at all).
  FOR v_idx IN 0 .. GREATEST(
        jsonb_array_length(p_line_items),
        COALESCE(jsonb_array_length(v_receipt.line_items), 0)
      ) - 1 LOOP
    v_old_line := COALESCE(v_receipt.line_items, '[]'::jsonb) -> v_idx;
    v_line     := p_line_items -> v_idx;

    FOREACH v_field IN ARRAY ARRAY['description','amount','quantity','unit_price','sku'] LOOP
      v_old_v := CASE WHEN v_old_line IS NULL THEN NULL ELSE v_old_line -> v_field END;
      v_new_v := CASE WHEN v_line     IS NULL THEN NULL ELSE v_line     -> v_field END;
      -- 🔴 AN ABSENT KEY AND A PRESENT `null` ARE THE SAME ANSWER — "no value" — AND MUST NOT
      -- READ AS A CHANGE. `->` returns SQL NULL for a key that is not there and jsonb `null` for
      -- a key explicitly set to null, and `IS DISTINCT FROM` calls those two different. Every one
      -- of the 36 receipts captured before today stores TWO keys per line, while the edit form
      -- sends FIVE with nulls where blank — so without this fold, correcting one description on
      -- the Sudderth invoice would record ONE real change and NINE phantom ones (three lines x
      -- quantity/unit_price/sku, each "from nothing to nothing"), and the page would tell Lauren
      -- she changed ten values. Telling the owner she edited something she never touched is the
      -- same false accusation this build removed from the list's edit sentence; it does not get
      -- to reappear in the audit trail. `'null'::jsonb` on both sides collapses the two forms of
      -- absence onto each other and leaves every real change untouched.
      IF COALESCE(v_old_v, 'null'::jsonb) IS DISTINCT FROM COALESCE(v_new_v, 'null'::jsonb) THEN
        v_changes := v_changes || jsonb_build_object(
          'line',  v_idx,
          'field', v_field,
          'from',  v_old_v,
          'to',    v_new_v
        );
      END IF;
    END LOOP;
  END LOOP;

  -- ── the write. `line_items_original` and `amount_original` are NOT NAMED HERE, and the
  --    trigger above would refuse them if they were ────────────────────────────────────────
  UPDATE public.receipts
     SET line_items              = p_line_items,
         reconcile_status        = v_status,
         reconcile_delta         = v_delta,
         reconcile_overridden_at = COALESCE(v_overridden, reconcile_overridden_at),
         updated_at              = now()
   WHERE id = p_receipt_id;

  -- ── the audit row, in the SAME transaction as the write it describes ──────────────────────
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (
    v_receipt.business_id, v_actor, 'OWNER',
    'receipt.line_items_edited', 'receipt', p_receipt_id::text,
    jsonb_build_object(
      'changes',           v_changes,
      'change_count',      jsonb_array_length(v_changes),
      'line_count_before', COALESCE(jsonb_array_length(v_receipt.line_items), 0),
      'line_count_after',  jsonb_array_length(p_line_items),
      'reconcile_before',  v_receipt.reconcile_status,
      'reconcile_after',   v_status,
      'delta_after',       v_delta
    ),
    'success'
  );

  RETURN jsonb_build_object(
    'reconcile_status', v_status,
    'reconcile_delta',  v_delta,
    'line_sum',         CASE WHEN v_status IS NULL THEN NULL ELSE v_sum END,
    'total',            v_total,
    'change_count',     jsonb_array_length(v_changes)
  );
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.emit_inventory_movement(p_business_id uuid, p_inventory_id uuid, p_delta integer, p_kind text, p_reason text DEFAULT NULL::text, p_source_type text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_actor_user_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now(), p_aggregate_type text DEFAULT NULL::text, p_aggregate_id uuid DEFAULT NULL::uuid, p_event_type text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.business_inventory_ledger
    (business_id, inventory_id, delta, kind, reason, source_type, source_id, actor_user_id,
     occurred_at, aggregate_type, aggregate_id, event_type)
  VALUES
    (p_business_id, p_inventory_id, p_delta, p_kind, p_reason, p_source_type, p_source_id,
     p_actor_user_id, COALESCE(p_occurred_at, now()),
     COALESCE(p_aggregate_type, 'INVENTORY'),
     COALESCE(p_aggregate_id, p_inventory_id),
     COALESCE(p_event_type, p_kind))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.enforce_member_authority_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.permissions IS DISTINCT FROM OLD.permissions THEN

    -- (a) No JWT = service/migration/admin context → allowed (backfills, server service key).
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    -- (b) The permission funnel sets this transaction-local marker immediately before it
    --     re-materializes member rows. Only the funnel RPCs (SECURITY DEFINER) set it, and
    --     they authorize the OWNER first. missing_ok = true → unset reads as NULL, not error.
    IF current_setting('trace.authority_funnel', true) = 'on' THEN
      RETURN NEW;
    END IF;

    -- Otherwise: a direct JWT write of role/permissions — the owner's SQL side door OR a
    -- member self-elevation. Both are refused. (A direct-SQL RAISE cannot self-audit — a
    -- BEFORE-trigger RAISE rolls back the txn, and Postgres has no autonomous transaction —
    -- so the durable permission.self_elevation_denied row is written by the funnel RPC when a
    -- NON-owner CALLS it, which is the reachable app path; see §2/§3.)
    RAISE EXCEPTION
      'business_members.role/permissions may only be changed through the permission funnel (save_role_permissions / assign_member_role) — direct writes and self-elevation are blocked'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.enforce_vendor_preference_is_owner_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Nothing to guard unless a preference field actually changed. IS DISTINCT FROM is null-safe,
  -- so setting a note from NULL to a value is caught, and so is clearing it back to NULL.
  IF NEW.preferred IS NOT DISTINCT FROM OLD.preferred
     AND NEW.preference_note IS NOT DISTINCT FROM OLD.preference_note THEN
    RETURN NEW;
  END IF;

  -- auth.uid() IS NULL = the SQL editor / a service-key path. Permitted, and it mirrors the
  -- existing funnel precedent (20260723_permission_funnel.sql:144-147). Named here so it is a
  -- recorded decision rather than an accident: a seed or a support fix is not a manager.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_business_owner(NEW.business_id) THEN
    RAISE EXCEPTION
      'vendor preference is owner-only: preferred / preference_note may be changed only by the '
      'business owner (vendor %, business %)', NEW.id, NEW.business_id
      USING ERRCODE = '42501';   -- insufficient_privilege — the same code a policy refusal raises
  END IF;

  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.enforce_vendor_preference_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.preferred IS NOT TRUE AND NEW.preference_note IS NULL THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_business_owner(NEW.business_id) THEN
    RAISE EXCEPTION
      'vendor preference is owner-only: a new vendor may not be created already preferred '
      '(business %)', NEW.business_id
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.get_business_tax_rate(p_business_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN public.has_permission(p_business_id, 'tax_rate:read')
     AND public.is_active_member(p_business_id)
    THEN (SELECT (config->>'taxRate')::numeric FROM public.business_pricing_config
           WHERE business_id = p_business_id)
    ELSE NULL
  END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.get_my_permissions(p_business_id uuid)
 RETURNS TABLE(permissions jsonb, is_account_holder boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    COALESCE((SELECT bm.permissions
                FROM public.business_members bm
               WHERE bm.business_id = p_business_id
                 AND bm.user_id    = auth.uid()
                 AND bm.active
               LIMIT 1), '[]'::jsonb),
    EXISTS (SELECT 1 FROM public.businesses b
             WHERE b.id = p_business_id
               AND b.owner_id = auth.uid());
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.guard_customer_derived_contact()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_setting('trace.contact_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' AND (NEW.phone IS NOT NULL OR NEW.email IS NOT NULL
        OR NEW.billing_line1 IS NOT NULL OR NEW.billing_line2 IS NOT NULL OR NEW.billing_city IS NOT NULL
        OR NEW.billing_state IS NOT NULL OR NEW.billing_zip IS NOT NULL))
  OR (TG_OP = 'UPDATE' AND (NEW.phone IS DISTINCT FROM OLD.phone OR NEW.email IS DISTINCT FROM OLD.email
        OR NEW.billing_line1 IS DISTINCT FROM OLD.billing_line1 OR NEW.billing_line2 IS DISTINCT FROM OLD.billing_line2
        OR NEW.billing_city IS DISTINCT FROM OLD.billing_city OR NEW.billing_state IS DISTINCT FROM OLD.billing_state
        OR NEW.billing_zip IS DISTINCT FROM OLD.billing_zip)) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Not saved: a customer''s phone, email and billing address are kept in their contact lists, not on the customer row. Nothing was changed.',
      HINT    = 'Write customer_phones / customer_emails / customer_addresses (contactWriter). Ledger #335.';
  END IF;
  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.guard_receipt_snapshot_and_lines()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_is_owner boolean;
BEGIN
  -- (a) THE OCR SNAPSHOT IS IMMUTABLE FOR EVERYONE. Not owner-only — NOBODY, including the
  --     owner, including this migration's own RPC (which never names these columns). What the
  --     machine read is not editable by the party whose edits it exists to be compared against.
  IF NEW.line_items_original IS DISTINCT FROM OLD.line_items_original THEN
    RAISE EXCEPTION 'receipts.line_items_original is write-once: it is the record of what the OCR read'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.amount_original IS DISTINCT FROM OLD.amount_original THEN
    RAISE EXCEPTION 'receipts.amount_original is write-once: it is the record of what the OCR read'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- (b) CHANGING THE LINES IS OWNER-ONLY. The line items are the cost model's input; correcting
  --     one changes what a tree cost. `auth.uid()` resolves inside a SECURITY DEFINER function
  --     (it reads the request JWT, not the session role), so this holds for the RPC too — the
  --     RPC's own check is a second, earlier, better-worded refusal, not the only one.
  IF NEW.line_items IS DISTINCT FROM OLD.line_items THEN
    SELECT EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = OLD.business_id AND owner_id = auth.uid()
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
      RAISE EXCEPTION 'only the business owner may change receipt line items'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.has_permission(p_business_id uuid, p_perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- LITERAL. No implication, no aliases, no expansion. Holding the string is the whole test.
  -- This body is David's `has_permission_exact` (applied by hand 2026-09-09), entering version
  -- control for the first time, with the NULL guards the alias version carried retained — a NULL
  -- business id must not match a row, and `auth.uid()` is NULL for an unauthenticated caller.
  SELECT p_business_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.business_members bm
     WHERE bm.business_id = p_business_id
       AND bm.user_id     = auth.uid()
       AND bm.active      = true
       AND bm.permissions ? p_perm
  );
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.has_permission_for(p_business_id uuid, p_user_id uuid, p_perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p_user_id IS NOT NULL AND p_business_id IS NOT NULL AND (
    -- NO OWNER BRANCH (ruling 2026-07-30). An owner is an active member holding the string, like
    -- everyone else. `businesses.owner_id` is a fact about who owns the business, not a grant —
    -- and being single-valued it cannot express the TWO OWNERS ruled on 2026-07-26 anyway.
    EXISTS (SELECT 1 FROM public.business_members
             WHERE business_id = p_business_id AND user_id = p_user_id
               AND active = true
               AND (
                 permissions ? p_perm
                 OR permissions ?| COALESCE(
                      (SELECT array_agg(a.implies_perm)
                         FROM public.permission_aliases a
                        WHERE a.from_perm = p_perm),
                      ARRAY[]::text[]
                    )
               ))
  );
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.import_write_price(p_lot_id uuid, p_business_id uuid, p_actor_user_id uuid, p_sell_price numeric, p_price_basis text)
 RETURNS TABLE(applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'inventory:import_price') THEN
    RETURN QUERY SELECT false, 'inventory:import_price permission required — ask the owner to grant bulk price import on the Team page'::text;
    RETURN;
  END IF;

  UPDATE public.business_inventory
     SET sell_price  = COALESCE(p_sell_price, sell_price),
         price_basis = COALESCE(p_price_basis, price_basis)
   WHERE id = p_lot_id AND business_id = p_business_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'lot not found in this business'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.is_active_member(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_members
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND active = true
  );
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.is_business_owner(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    -- the account holder
    SELECT 1 FROM public.businesses
     WHERE id = p_business_id AND owner_id = auth.uid()
  ) OR EXISTS (
    -- an OWNER-ROLE member who is not the account holder (Lauren's case, 20260828's ruling)
    SELECT 1 FROM public.business_members
     WHERE business_id = p_business_id
       AND user_id = auth.uid()
       AND active = true
       AND upper(role) = 'OWNER'
  );
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.is_member_of(p_business_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p_user_id IS NOT NULL AND p_business_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.businesses
             WHERE id = p_business_id AND owner_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.business_members
                WHERE business_id = p_business_id AND user_id = p_user_id AND active = true)
  );
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.link_vendor_preference(p_preference_id uuid, p_vendor_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_business uuid;
BEGIN
  SELECT business_id INTO v_business FROM public.vendor_preferences WHERE id = p_preference_id;
  IF v_business IS NULL THEN RETURN false; END IF;

  -- AC-3: the vendor must belong to the SAME tenant. Without this a caller could point a
  -- preference at another business's vendor row, which is a cross-tenant write wearing a uuid.
  IF NOT EXISTS (SELECT 1 FROM public.vendors
                  WHERE id = p_vendor_id AND business_id = v_business) THEN
    RAISE EXCEPTION 'vendor % is not in business % — refusing a cross-tenant link',
      p_vendor_id, v_business USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_business_owner(v_business) THEN
    RAISE EXCEPTION 'linking a vendor preference is owner-only (business %)', v_business
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.vendor_preferences SET vendor_id = p_vendor_id, updated_at = now()
   WHERE id = p_preference_id;
  RETURN true;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.normalize_contact_value()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'customer_phones' THEN
    NEW.value_norm := NULLIF(regexp_replace(COALESCE(NEW.value, ''), '\D', '', 'g'), '');
  ELSE
    NEW.value_norm := NULLIF(lower(trim(COALESCE(NEW.value, ''))), '');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.record_order_event(p_business_id uuid, p_order_id uuid, p_event_type text, p_actor_user_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF p_order_id IS NULL OR p_event_type IS NULL THEN
    RAISE EXCEPTION 'record_order_event requires an order id and an event type';
  END IF;

  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  v_id := public.emit_inventory_movement(
    p_business_id    => p_business_id,
    p_inventory_id   => NULL,
    p_delta          => 0,
    p_kind           => p_event_type,
    p_reason         => p_reason,
    p_source_type    => 'order',
    p_source_id      => p_order_id,
    p_actor_user_id  => p_actor_user_id,
    p_occurred_at    => COALESCE(p_occurred_at, now()),
    p_aggregate_type => 'ORDER',
    p_aggregate_id   => p_order_id,
    p_event_type     => p_event_type
  );
  RETURN v_id;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.reject_inventory_ledger_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'business_inventory_ledger is append-only: % is not permitted (D-50 — a correction is a NEW row, never an edit)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.reset_invitation_expiry(p_business_id uuid, p_actor_user_id uuid, p_invitation_id uuid)
 RETURNS TABLE(applied boolean, reason text, new_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_new   timestamptz;
  v_name  text;
  v_role  text;
BEGIN
  -- Impersonation is a hard RAISE, not a recoverable denial (same as the three funnel RPCs).
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- ── AUTHORISE ────────────────────────────────────────────────────────────────────────────────
  -- has_permission_for, not has_permission: the actor is PASSED. It has had NO OWNER BRANCH since
  -- 2026-07-30 (20260730c:41-57), so this is a pure "does this person hold the string" test and
  -- `businesses.owner_id` grants nothing here — deliberately, because reintroducing an owner
  -- fallback in a new function is how a retired branch comes back one exception at a time.
  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'team:create') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                  target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'invitation.expiry_reset_denied', 'invitation',
            p_invitation_id::text,
            jsonb_build_object('rule', 'team:create is required'), 'denied');
    RETURN QUERY SELECT false,
      'you do not have permission to reset invitations for this business'::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- ── THE WRITE — David's statement, parameterised, and not one column wider ────────────────────
  -- `now() + interval '7 days'`, NOT `expires_at + interval '7 days'`. Extending from the OLD
  -- expiry would hand a five-day window to an invitation that died two days ago, and a
  -- three-week-old one would come back already dead. The clock restarts; it does not resume.
  --
  -- ⚠️ THE INTERVAL IS A THIRD REPRESENTATION OF SEVEN DAYS and that is known, not overlooked:
  -- the column default (20260602:97), this body, and `INVITE_TTL_DAYS` in invitations.ts. SQL
  -- cannot import a TypeScript constant (20260726:264-290 records the same wall for permissions),
  -- and a `current_setting` lookup would be a configuration mechanism nobody asked for. If the TTL
  -- ever moves, all three move together — stated here so the next person finds the other two.
  UPDATE public.invitations
     SET expires_at = now() + interval '7 days'
   WHERE id          = p_invitation_id
     AND business_id = p_business_id   -- AC-3. The editor statement had no such predicate and did
                                       -- not need one; a browser-supplied id makes it mandatory.
     AND used        = false           -- an accepted or withdrawn invitation has nothing to reset
  RETURNING expires_at, name, role INTO v_new, v_name, v_role;

  -- ── THE REFUSAL — zero rows is not success (E5) ───────────────────────────────────────────────
  -- Reached by every real miss: wrong tenant, already accepted, already revoked, no such row. They
  -- are deliberately ONE message rather than four: distinguishing "already used" from "not yours"
  -- would let a caller probe another tenant's invitation ids for existence (AC-3).
  IF v_new IS NULL THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                  target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'invitation.expiry_reset_denied', 'invitation',
            p_invitation_id::text,
            jsonb_build_object('rule', 'no pending invitation with that id in this business'),
            'denied');
    RETURN QUERY SELECT false,
      'that invitation can no longer be reset — it may have been accepted or withdrawn'::text,
      NULL::timestamptz;
    RETURN;
  END IF;

  -- ── AUDIT — who reset it, when, whose invitation (David's fourth bullet) ──────────────────────
  -- created_at supplies the WHEN (audit_log's own default); actor_user_id the WHO; target_id and
  -- the detail the WHOSE. The invited person's NAME is carried because an id is not a person to
  -- the human reading the trail six weeks later.
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type,
                                target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'invitation.expiry_reset', 'invitation',
          p_invitation_id::text,
          jsonb_build_object('invitation_id', p_invitation_id,
                             'invited_name', v_name,
                             'invited_role', v_role,
                             'new_expires_at', v_new,
                             'ttl_days', 7,
                             'source', 'reset_invitation_expiry'),
          'success');

  RETURN QUERY SELECT true, NULL::text, v_new;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.save_role_permissions(p_business_id uuid, p_actor_user_id uuid, p_role_key text, p_op text, p_label text, p_description text, p_permissions jsonb, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(applied boolean, reason text, member_id uuid, member_name text, perms_before jsonb, perms_after jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_before jsonb; v_resolved jsonb; v_existing uuid; v_action text;
  v_members jsonb := '[]'::jsonb; v_count int := 0; r record;
  v_cur_perms jsonb; v_cur_label text; v_cur_desc text; v_drifted int;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = p_actor_user_id) THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'permission.self_elevation_denied', 'role', p_role_key,
            jsonb_build_object('op', p_op, 'attempted_permissions', p_permissions, 'reason', p_reason), 'denied');
    RETURN QUERY SELECT false, 'only the business owner may change role permissions'::text,
      NULL::uuid, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  -- ══ THE OWNER ROLE IS LOCKED (ruling 2026-07-30) ═══════════════════════════════════════════
  -- Refuses save/create/delete on OWNER. `reset` is permitted: it deletes the tenant override so
  -- the computed floor shows through, which is the direction the lock wants to go, and it is the
  -- op 20260730a uses. Audited as an attempt, because a refused authority change is exactly the
  -- kind of act the accountability log exists for (D-51).
  IF upper(p_role_key) = 'OWNER' AND p_op <> 'reset' THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, 'OWNER', 'role.locked_write_refused', 'role', p_role_key,
            jsonb_build_object('op', p_op, 'attempted_permissions', p_permissions,
                               'reason', p_reason,
                               'rule', 'the OWNER role is computed from the permission manifest and is not editable'),
            'denied');
    RETURN QUERY SELECT false,
      'the OWNER role is locked — its permissions are computed from the model and cannot be edited'::text,
      NULL::uuid, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  IF p_op = 'save' THEN
    SELECT permissions, label, description
      INTO v_cur_perms, v_cur_label, v_cur_desc
      FROM public.role_definitions
     WHERE business_id = p_business_id AND role_key = p_role_key;

    IF v_cur_perms IS NOT NULL
       AND COALESCE(p_permissions, '[]'::jsonb) @> v_cur_perms
       AND v_cur_perms @> COALESCE(p_permissions, '[]'::jsonb)
       AND COALESCE(p_label, v_cur_label)       IS NOT DISTINCT FROM v_cur_label
       AND COALESCE(p_description, v_cur_desc)  IS NOT DISTINCT FROM v_cur_desc
    THEN
      SELECT count(*) INTO v_drifted
        FROM public.business_members bm
       WHERE bm.business_id = p_business_id AND bm.role = p_role_key AND bm.active = true
         AND NOT (COALESCE(bm.permissions, '[]'::jsonb) @> v_cur_perms
                  AND v_cur_perms @> COALESCE(bm.permissions, '[]'::jsonb));

      IF v_drifted = 0 THEN
        INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
        VALUES (p_business_id, p_actor_user_id, 'OWNER', 'role.permissions_changed', 'role', p_role_key,
                jsonb_build_object('before', v_cur_perms, 'after', v_cur_perms,
                                   'members_affected', 0, 'members', '[]'::jsonb,
                                   'reason', p_reason),
                'no_change');
        RETURN QUERY SELECT false, 'no-op'::text, NULL::uuid, NULL::text, v_cur_perms, v_cur_perms;
        RETURN;
      END IF;
    END IF;
  END IF;

  PERFORM set_config('trace.authority_funnel', 'on', true);

  SELECT permissions INTO v_before FROM public.role_definitions
   WHERE role_key = p_role_key AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC LIMIT 1;

  IF p_op IN ('reset', 'delete') THEN
    DELETE FROM public.role_definitions WHERE business_id = p_business_id AND role_key = p_role_key;
    v_action := CASE WHEN p_op = 'reset' THEN 'role.factory_reset' ELSE 'role.deleted' END;
  ELSE
    SELECT id INTO v_existing FROM public.role_definitions
     WHERE business_id = p_business_id AND role_key = p_role_key;
    IF v_existing IS NOT NULL THEN
      UPDATE public.role_definitions
         SET permissions = p_permissions,
             label       = COALESCE(p_label, label),
             description = COALESCE(p_description, description)
       WHERE id = v_existing;
    ELSE
      INSERT INTO public.role_definitions (business_id, role_key, is_system, label, description, permissions)
      VALUES (p_business_id, p_role_key, false, p_label, p_description, p_permissions);
    END IF;
    v_action := CASE WHEN p_op = 'create' THEN 'role.created' ELSE 'role.permissions_changed' END;
  END IF;

  SELECT permissions INTO v_resolved FROM public.role_definitions
   WHERE role_key = p_role_key AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC LIMIT 1;

  IF v_resolved IS NOT NULL THEN
    FOR r IN SELECT id, name, permissions AS before_perms FROM public.business_members
              WHERE business_id = p_business_id AND role = p_role_key AND active = true ORDER BY name
    LOOP
      UPDATE public.business_members SET permissions = v_resolved WHERE id = r.id;
      v_members := v_members || jsonb_build_object('id', r.id, 'before', r.before_perms, 'after', v_resolved);
      v_count := v_count + 1;
      RETURN QUERY SELECT true, NULL::text, r.id, r.name, r.before_perms, v_resolved;
    END LOOP;
  END IF;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, 'OWNER', v_action, 'role', p_role_key,
          jsonb_build_object('before', v_before, 'after', v_resolved,
                             'members_affected', v_count, 'members', v_members,
                             'reason', p_reason),
          'success');

  IF v_count = 0 THEN
    RETURN QUERY SELECT true, NULL::text, NULL::uuid, NULL::text, NULL::jsonb, NULL::jsonb;
  END IF;
  RETURN;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.seed_business_modules(p_business_id uuid, p_actor_user_id uuid, p_modules jsonb)
 RETURNS TABLE(applied boolean, reason text, expected integer, seeded integer, existing integer, trials_started integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_expected int;
  v_seeded   int := 0;
  v_trials   int := 0;
  v_bad      text;
  r          record;
BEGIN
  -- (1) NO FORGERY.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- (2) D-9 SHAPE VALIDATION, ahead of authority (20260801b's ordering).
  IF p_modules IS NULL OR jsonb_typeof(p_modules) <> 'array' THEN
    RETURN QUERY SELECT false, 'modules must be a JSON array'::text, 0, 0, 0, 0;
    RETURN;
  END IF;
  v_expected := jsonb_array_length(p_modules);
  IF v_expected = 0 THEN
    -- An empty catalog is a caller bug, not a tenant with nothing. Refuse it loudly rather than
    -- reporting a successful seed of nothing — `applied:true, seeded:0` would be a lie the caller
    -- has no way to distinguish from "already seeded".
    RETURN QUERY SELECT false, 'module catalog is empty — nothing to seed'::text, 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT string_agg(DISTINCT x.problem, '; ') INTO v_bad
    FROM (
      SELECT CASE
               WHEN jsonb_typeof(e.value) <> 'object'                      THEN 'every element must be an object'
               WHEN COALESCE(btrim(e.value->>'module_key'), '') = ''        THEN 'every element needs a non-blank module_key'
               -- ⚠️ COALESCE IS LOAD-BEARING. A MISSING key makes `->` return SQL NULL, so
               -- `jsonb_typeof(NULL) <> 'boolean'` evaluates to NULL — not TRUE — and the CASE
               -- would fall through to the next branch and out with no problem recorded. The
               -- element with no `enabled` at all would pass validation and then seed as NULL
               -- against a NOT NULL column. A missing field must fail the same way a wrong one does.
               WHEN COALESCE(jsonb_typeof(e.value->'enabled'),     '') <> 'boolean' THEN 'enabled must be a boolean'
               WHEN COALESCE(jsonb_typeof(e.value->'configured'),  '') <> 'boolean' THEN 'configured must be a boolean'
               WHEN COALESCE(jsonb_typeof(e.value->'start_trial'), '') <> 'boolean' THEN 'start_trial must be a boolean'
               WHEN COALESCE(jsonb_typeof(e.value->'trial_days'),  '') <> 'number'  THEN 'trial_days must be a number'
               -- 🔴 THE CROSS-FIELD ONE, and it is the only validation here that is about MONEY
               -- rather than about types: a module asking for a trial must carry the TERM of that
               -- trial. `start_module_trial` would refuse it downstream, but by then the row set is
               -- half-created — and the batch-refusal rule exists precisely so that never happens.
               WHEN (e.value->>'start_trial')::boolean
                AND COALESCE((e.value->>'trial_days')::numeric, 0) <= 0
                                                                    THEN 'a module starting a trial needs a positive trial_days — the term is snapshotted, so there is no default to fall back on'
             END AS problem
        FROM jsonb_array_elements(p_modules) e
    ) x
   WHERE x.problem IS NOT NULL;

  IF v_bad IS NOT NULL THEN
    RETURN QUERY SELECT false, ('malformed module catalog — ' || v_bad)::text, v_expected, 0, 0, 0;
    RETURN;
  END IF;

  -- (3) AUTHORITY — the SAME string the clock checks, and it must be, because this function starts
  --     clocks. A seed gated more loosely than `start_module_trial` would be a way to reach the
  --     clock through the back door with weaker authority.
  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'subscription:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'business_modules.seed_denied', 'business', p_business_id::text,
            jsonb_build_object('expected', v_expected), 'denied');
    RETURN QUERY SELECT false,
      'subscription:update permission required — seeding a tenant starts its trial clocks'::text,
      v_expected, 0, 0, 0;
    RETURN;
  END IF;

  -- (4) THE ROWS. `ON CONFLICT DO NOTHING` is what makes the whole thing re-runnable: an existing
  --     tenant's enabled/configured/config are NEVER clobbered by a re-seed. Seeding is a
  --     create-if-absent act — the same contract `seedPricingConfig` uses (`ignoreDuplicates`), and
  --     the reason is the same: the repair path and the create path must be the same call.
  INSERT INTO public.business_modules (business_id, module_key, enabled, configured, config)
  SELECT p_business_id, m.module_key, m.enabled, m.configured, '{}'::jsonb
    FROM jsonb_to_recordset(p_modules)
      AS m(module_key text, enabled boolean, configured boolean, start_trial boolean, trial_days integer)
  ON CONFLICT (business_id, module_key) DO NOTHING;
  GET DIAGNOSTICS v_seeded = ROW_COUNT;

  -- 🔴 `configured` COMES FROM THE CATALOG AND CORE SEEDS **TRUE** (David's ruling 2026-08-01,
  -- reversing the seed-false draft). `useModules.ts:104` renders `active` only on
  -- `enabled && configured`, so the draft's blanket `false` meant a seeded QR Checkout rendered
  -- `available` with an `[ENABLE]` button — **an invitation to set up a working feature that is
  -- already included.** That is the DEAD-AFFORDANCE class, and it is what the ruling names:
  -- **there is nothing to configure about being included.** It also means the seed now has a
  -- VISIBLE effect, which matters for a different reason — a build with no observable change reads
  -- as a failed deploy, and that is how a real deploy failure gets waved through (OP-15's whole
  -- subject).
  --
  -- ⚠️ ONE CASE WHERE `configured:true` IS ARGUABLE AND IS FLAGGED RATHER THAN QUIETLY SOFTENED:
  -- `qb_invoicing` genuinely HAS configuration — the QuickBooks OAuth link — and a green tile says
  -- "included", not "connected". It is not a false claim (the module IS included and the tile routes
  -- to /settings where the link is made), and the QB CONNECTION indicator is a separate surface
  -- reading `business_accounting_secrets`, not this flag. Recorded so the next reader knows it was
  -- considered, not missed.

  -- (5) THE CLOCKS. Delegated, never re-implemented: `start_module_trial` re-checks authority and
  --     writes its own audit row per module, so a trial start is findable in the log whether it
  --     came from a seed or from a click. That is deliberate volume, not noise — seven clocks
  --     starting is seven money events, and the row is the record of WHEN each one started.
  FOR r IN
    SELECT m.module_key, m.trial_days
      FROM jsonb_to_recordset(p_modules)
        AS m(module_key text, enabled boolean, configured boolean, start_trial boolean, trial_days integer)
     WHERE m.start_trial
  LOOP
    -- The TERM travels with the call. On a re-seed the clock refuses to rewrite it, so passing
    -- today's catalog number here cannot re-term a tenant who already has one.
    PERFORM * FROM public.start_module_trial(p_business_id, r.module_key, r.trial_days, p_actor_user_id);
    v_trials := v_trials + 1;
  END LOOP;

  -- (6) THE RECORD. STD-023 / the #74 ruling: a seed that created nothing is still an operator act
  --     worth keeping, but `outcome` must not assert an event that did not occur. A re-run over a
  --     fully-seeded tenant is `no_change`, which is exactly what a repair-that-found-nothing-wrong
  --     should read as.
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'business_modules.seeded', 'business', p_business_id::text,
          jsonb_build_object('expected', v_expected, 'seeded', v_seeded,
                             'existing', v_expected - v_seeded, 'trials_started', v_trials),
          CASE WHEN v_seeded = 0 THEN 'no_change' ELSE 'success' END);

  RETURN QUERY SELECT true, NULL::text, v_expected, v_seeded, v_expected - v_seeded, v_trials;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.set_business_members_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.set_business_module_state(p_business_id uuid, p_module_key text, p_enabled boolean, p_configured boolean, p_config_patch jsonb, p_actor_user_id uuid, p_trial_days integer DEFAULT NULL::integer)
 RETURNS TABLE(applied boolean, reason text, was_insert boolean, enabled_before boolean, enabled_after boolean, trial_started boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_before   boolean;
  v_existed  boolean;
  v_touches_config     boolean;
  v_touches_enablement boolean;
  v_trial_applied boolean := false;
  v_trial_already boolean := false;
  v_trial_reason  text;
BEGIN
  -- (1) NO FORGERY — a client-direct caller may only act as themselves. UNCHANGED.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- (2) D-9 value validation ahead of authority. UNCHANGED.
  IF p_module_key IS NULL OR btrim(p_module_key) = '' THEN
    RETURN QUERY SELECT false, 'module_key is required'::text, false, NULL::boolean, NULL::boolean, false;
    RETURN;
  END IF;
  IF p_config_patch IS NOT NULL AND jsonb_typeof(p_config_patch) <> 'object' THEN
    RETURN QUERY SELECT false, 'config patch must be a JSON object'::text, false, NULL::boolean, NULL::boolean, false;
    RETURN;
  END IF;

  SELECT bm.enabled INTO v_before
    FROM public.business_modules bm
   WHERE bm.business_id = p_business_id AND bm.module_key = p_module_key;
  v_existed := FOUND;

  v_touches_config     := (p_config_patch IS NOT NULL AND p_config_patch <> '{}'::jsonb)
                       OR (p_configured IS NOT NULL AND (NOT v_existed OR p_configured IS DISTINCT FROM
                             (SELECT bm.configured FROM public.business_modules bm
                               WHERE bm.business_id = p_business_id AND bm.module_key = p_module_key)));
  v_touches_enablement := p_enabled IS NOT NULL AND p_enabled IS DISTINCT FROM v_before;

  -- (3a) AUTHORITY — CONFIG. UNCHANGED: `settings:update`.
  IF v_touches_config
     AND NOT public.has_permission_for(p_business_id, p_actor_user_id, 'settings:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.update_denied', 'business_module', p_module_key,
            jsonb_build_object('attempted_configured', p_configured,
                               'attempted_config_keys',
                               COALESCE((SELECT array_agg(k) FROM jsonb_object_keys(COALESCE(p_config_patch, '{}'::jsonb)) k), ARRAY[]::text[])),
            'denied');
    RETURN QUERY SELECT false, 'settings:update permission required'::text, false, NULL::boolean, NULL::boolean, false;
    RETURN;
  END IF;

  -- (3b) AUTHORITY — ENABLEMENT. UNCHANGED, and it now also gates the clock: the trial below can
  --      only fire on an enablement change, which cannot reach this point without this permission.
  --      **The manager's refusal is unchanged and still names its reason.**
  IF v_touches_enablement
     AND NOT public.has_permission_for(p_business_id, p_actor_user_id, 'subscription:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.enablement_denied', 'business_module', p_module_key,
            jsonb_build_object('enabled_before', v_before, 'attempted_enabled', p_enabled,
                               'attempted_trial_days', p_trial_days), 'denied');
    RETURN QUERY SELECT false, 'subscription:update permission required — enabling or disabling a module changes what this business pays'::text,
                        false, v_before, v_before, false;
    RETURN;
  END IF;

  -- (4) THE WRITE. UNCHANGED, including the create path and the config MERGE.
  IF v_existed THEN
    UPDATE public.business_modules
       SET enabled    = COALESCE(p_enabled,    enabled),
           configured = COALESCE(p_configured, configured),
           config     = COALESCE(config, '{}'::jsonb) || COALESCE(p_config_patch, '{}'::jsonb)
     WHERE business_id = p_business_id AND module_key = p_module_key;
  ELSE
    INSERT INTO public.business_modules (business_id, module_key, enabled, configured, config)
    VALUES (p_business_id, p_module_key, COALESCE(p_enabled, false), COALESCE(p_configured, false),
            COALESCE(p_config_patch, '{}'::jsonb));
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════════════════════════
  -- (4b) 🔴 THE CLOCK — THE SAME ACT, INSIDE THE SAME TRANSACTION (ruling 2026-08-02 (8)).
  -- ══════════════════════════════════════════════════════════════════════════════════════════════
  -- THREE CONDITIONS, and each one is load-bearing:
  --   · `v_touches_enablement` — an ACTUAL change. **A re-enable of an already-on module does not
  --     touch enablement, so it cannot re-clock anything.** (`start_module_trial` refuses a restart
  --     too; this is the belt to that braces, and it is the one that also avoids the round trip.)
  --   · `p_enabled IS TRUE` — turning a module OFF never starts a clock.
  --   · `p_trial_days > 0` — 🔴 **THIS IS WHAT KEEPS `core` AND `core_optional` CLOCK-FREE.** The
  --     client passes 0 for both. Starting a countdown on Contractors — free, and nothing expires —
  --     would be the INVERSE defect arriving through the fix, which is precisely what David flagged.
  IF v_touches_enablement AND p_enabled IS TRUE AND COALESCE(p_trial_days, 0) > 0 THEN
    SELECT t.applied, t.was_already_running, t.reason
      INTO v_trial_applied, v_trial_already, v_trial_reason
      FROM public.start_module_trial(p_business_id, p_module_key, p_trial_days, p_actor_user_id) t;

    -- 🔴 A REFUSED CLOCK ROLLS THE ENABLE BACK. This is the ruling in one statement: the module must
    -- never end up live without something that ends it. `start_module_trial` returns applied:true
    -- for an ALREADY-RUNNING clock (was_already_running), so this fires only on a genuine anomaly —
    -- and on an anomaly, failing loudly beats a half-landed money change.
    IF NOT v_trial_applied THEN
      RAISE EXCEPTION 'module enabled but its trial could not start (%) — refusing to leave a billable module with no conversion date', v_trial_reason;
    END IF;
  END IF;

  -- (5) THE RECORD. UNCHANGED, plus the trial outcome so the act is reconstructable from one row.
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.state_changed', 'business_module', p_module_key,
          jsonb_build_object('was_insert', NOT v_existed, 'enabled_before', v_before,
                             'enabled_after', COALESCE(p_enabled, v_before),
                             'enablement_changed', v_touches_enablement,
                             'offered_trial_days', p_trial_days,
                             'trial_started', v_trial_applied AND NOT v_trial_already,
                             'trial_already_running', v_trial_already,
                             'config_keys_patched', COALESCE((SELECT array_agg(k) FROM jsonb_object_keys(COALESCE(p_config_patch, '{}'::jsonb)) k), ARRAY[]::text[])),
          CASE WHEN v_existed AND NOT v_touches_enablement AND NOT v_touches_config
               THEN 'no_change' ELSE 'success' END);

  RETURN QUERY SELECT true, NULL::text, NOT v_existed, v_before, COALESCE(p_enabled, v_before),
                      v_trial_applied AND NOT v_trial_already;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.set_business_profile(p_business_id uuid, p_actor_user_id uuid, p_name text, p_phone text, p_address text, p_email text, p_website text)
 RETURNS TABLE(applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'settings:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'settings.update_denied', 'business', p_business_id::text,
            jsonb_build_object('attempted', 'business_profile'), 'denied');
    RETURN QUERY SELECT false, 'settings:update permission required'::text;
    RETURN;
  END IF;

  -- D-9: a blank name is not a name. Everything else may legitimately be cleared to NULL.
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN QUERY SELECT false, 'business name is required'::text;
    RETURN;
  END IF;

  -- ⚠️ THE COLUMN LIST IS THE SECURITY BOUNDARY. owner_id, accounting_*, business_type and
  -- everything else on this table are UNREACHABLE from here BY CONSTRUCTION. Adding a column to
  -- this SET is granting a new capability — do it deliberately or not at all.
  UPDATE public.businesses
     SET name    = btrim(p_name),
         phone   = p_phone,
         address = p_address,
         email   = p_email,
         website = p_website
   WHERE id = p_business_id;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'settings.profile_changed', 'business', p_business_id::text,
          jsonb_build_object('name', btrim(p_name)), 'success');

  RETURN QUERY SELECT true, NULL::text;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.set_business_tax_rate(p_business_id uuid, p_rate numeric, p_actor_user_id uuid)
 RETURNS TABLE(applied boolean, reason text, rate_before numeric, rate_after numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_before numeric;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'tax_rate:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'tax_rate.update_denied', 'business', p_business_id::text,
            jsonb_build_object('attempted_rate', p_rate), 'denied');
    RETURN QUERY SELECT false, 'tax_rate:update permission required'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  -- D-9: refuse a nonsense rate rather than storing it. A negative or >1 rate is not a rate.
  IF p_rate IS NULL OR p_rate < 0 OR p_rate > 1 THEN
    RETURN QUERY SELECT false, 'tax rate must be a fraction between 0 and 1 (e.g. 0.0825)'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  SELECT (config->>'taxRate')::numeric INTO v_before
    FROM public.business_pricing_config WHERE business_id = p_business_id;

  UPDATE public.business_pricing_config
     SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{taxRate}', to_jsonb(p_rate), true)
   WHERE business_id = p_business_id;

  IF NOT FOUND THEN
    INSERT INTO public.business_pricing_config (business_id, config)
    VALUES (p_business_id, jsonb_build_object('taxRate', p_rate));
  END IF;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'tax_rate.changed', 'business', p_business_id::text,
          jsonb_build_object('before', v_before, 'after', p_rate), 'success');

  RETURN QUERY SELECT true, NULL::text, v_before, p_rate;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.set_people_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.set_role_definitions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.soft_delete_inventory(p_lot_id uuid, p_business_id uuid, p_actor_user_id uuid, p_reason text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(ledger_id uuid, audit_id uuid, prior_qty integer, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current int;
  v_sku     text;
  v_name    text;
  v_status  text;
  v_ledger  uuid;
  v_audit   uuid;
  v_role    text;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  SELECT bi.qty, bi.sku, bi.name, bi.status
    INTO v_current, v_sku, v_name, v_status
    FROM public.business_inventory bi
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::int, false, 'lot_not_found'::text;
    RETURN;
  END IF;

  IF v_status = 'deleted' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, v_current, false, 'already_deleted'::text;
    RETURN;
  END IF;

  -- THE TOMBSTONE — flip status, zero the on-hand. NO `DELETE FROM`. The row survives so
  -- history keeps its anchor (ledger.inventory_id stays populated).
  UPDATE public.business_inventory bi
     SET status = 'deleted', qty = 0, updated_at = now()
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id;

  -- The movement: whatever was on hand has left the book.
  v_ledger := public.emit_inventory_movement(
    p_business_id, p_lot_id, -v_current, 'delete_tombstone',
    p_reason, 'manual', NULL, p_actor_user_id, p_occurred_at);

  -- The DISCRETIONARY act (Layer 1). Role is a SNAPSHOT STRING at time of action, never an
  -- FK — history must not move when roles change (20260623_audit_log_spine.sql:66).
  SELECT bm.role INTO v_role
    FROM public.business_members bm
   WHERE bm.business_id = p_business_id AND bm.user_id = p_actor_user_id AND bm.active = true
   LIMIT 1;

  IF v_role IS NULL AND EXISTS (
    SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = p_actor_user_id
  ) THEN
    v_role := 'owner';
  END IF;

  INSERT INTO public.audit_log
    (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES
    (p_business_id, p_actor_user_id, v_role, 'inventory.delete', 'business_inventory',
     p_lot_id::text,
     jsonb_build_object(
       'sku', v_sku, 'name', v_name,
       'prior_qty', v_current, 'prior_status', v_status,
       'reason', p_reason, 'ledger_id', v_ledger),   -- ledger row id, per the R5 narrowing
     'success')
  RETURNING id INTO v_audit;

  RETURN QUERY SELECT v_ledger, v_audit, v_current, true, 'applied'::text;
END $function$;
-- @@
CREATE OR REPLACE FUNCTION public.start_module_trial(p_business_id uuid, p_module_key text, p_trial_days integer, p_actor_user_id uuid)
 RETURNS TABLE(applied boolean, reason text, started_at timestamp with time zone, trial_days integer, was_already_running boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_before      timestamptz;
  v_before_days integer;
  v_existed     boolean;
  v_after       timestamptz;
BEGIN
  -- (1) NO FORGERY — a client-direct caller may only act as themselves.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- (2) D-9 validation AHEAD of authority, matching 20260801b's ordering and for its reason: a
  --     garbage key must not produce a denial row that reads as an authority incident.
  IF p_module_key IS NULL OR btrim(p_module_key) = '' THEN
    RETURN QUERY SELECT false, 'module_key is required'::text, NULL::timestamptz, NULL::integer, false;
    RETURN;
  END IF;

  -- 🔴 THE TERM IS VALIDATED LIKE MONEY, BECAUSE IT IS THE OTHER HALF OF A PRICE. A NULL or
  -- non-positive `trial_days` would produce a trial that expires the instant it starts (or never),
  -- and the tenant would carry that term permanently — the pair is written once and never rewritten.
  -- Refuse it rather than store it (D-9); there is no honest default to fall back on, because the
  -- correct number is exactly what nobody has ratified (MASTER_BRIEF:243 says 14, Help.tsx:524 says
  -- 30). A caller that does not know the term must not be allowed to invent one.
  IF p_trial_days IS NULL OR p_trial_days <= 0 THEN
    RETURN QUERY SELECT false, 'trial_days must be a positive number of days'::text,
                        NULL::timestamptz, NULL::integer, false;
    RETURN;
  END IF;

  -- (3) AUTHORITY. See the header for why this is `subscription:update` and not `settings:update`.
  --     A denial is RECORDED — an attempt nobody can see is an attempt nobody can investigate.
  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'subscription:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'module_trial.start_denied', 'business_module', p_module_key,
            jsonb_build_object('attempted_module', p_module_key, 'attempted_trial_days', p_trial_days), 'denied');
    RETURN QUERY SELECT false,
      'subscription:update permission required — starting a trial schedules what this business will pay'::text,
      NULL::timestamptz, NULL::integer, false;
    RETURN;
  END IF;

  SELECT (bm.config->>'trial_started_at')::timestamptz, (bm.config->>'trial_days')::integer
    INTO v_before, v_before_days
    FROM public.business_modules bm
   WHERE bm.business_id = p_business_id AND bm.module_key = p_module_key;
  v_existed := FOUND;

  -- (4) 🔴 A RUNNING CLOCK IS NEVER RESTARTED. This is the assertion that makes it a clock rather
  --     than a field. Without it, the seeder's own repair re-run — the thing that makes a failed
  --     seed recoverable — would hand every module a fresh thirty days on every onboarding load,
  --     and a trial that renews itself is a trial that never ends. It is also the tamper answer:
  --     even a caller who HOLDS `subscription:update` cannot buy themselves another month.
  --     Reported as `applied:true, was_already_running:true` — the requested state HOLDS, and the
  --     caller asked for a started clock, which is what it has. That is not a failure.
  --
  -- 🔴 AND IT REFUSES TO REWRITE THE **TERM**, NOT ONLY THE START. This is the enforcement point of
  --     the pair ruling: `p_trial_days` is IGNORED here, deliberately, even when it differs from
  --     what is stored. **A tenant's terms are what they were given.** Without this clause the
  --     repair path — a re-seed after a catalog edit — would silently re-term every running trial,
  --     which is the retroactive-expiry hazard arriving through the mechanism built to fix failures.
  --     The audit row records BOTH what is stored and what was passed, so a divergence is findable
  --     rather than merely prevented.
  IF v_existed AND v_before IS NOT NULL THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'module_trial.started', 'business_module', p_module_key,
            jsonb_build_object('trial_started_at', v_before, 'trial_days', v_before_days,
                               'offered_trial_days', p_trial_days,
                               'term_rewrite_refused', v_before_days IS DISTINCT FROM p_trial_days,
                               'restart_refused', true), 'no_change');
    RETURN QUERY SELECT true, NULL::text, v_before, v_before_days, true;
    RETURN;
  END IF;

  -- (5) CREATE-IF-ABSENT, then the ONE write of the key. A module whose trial is being started must
  --     have a row to hold it; `ON CONFLICT DO NOTHING` means an existing row keeps its enabled /
  --     configured / config values untouched — starting a clock is not a state change.
  INSERT INTO public.business_modules (business_id, module_key, enabled, configured, config)
  VALUES (p_business_id, p_module_key, false, false, '{}'::jsonb)
  ON CONFLICT (business_id, module_key) DO NOTHING;

  -- ⬇⬇ THE ONLY OCCURRENCE OF `trial_started_at` AND `trial_days` AS WRITE TARGETS, PLATFORM-WIDE.
  --    Written as ONE object because they are ONE fact — the terms this tenant was granted.
  UPDATE public.business_modules
     SET config = COALESCE(config, '{}'::jsonb)
                  || jsonb_build_object('trial_started_at', now(), 'trial_days', p_trial_days)
   WHERE business_id = p_business_id AND module_key = p_module_key
  RETURNING (config->>'trial_started_at')::timestamptz INTO v_after;

  -- (6) THE RECORD. A trial starting is a money event; it gets a row with its own action name so it
  --     is findable without diffing two jsonb blobs. The TERM is in the row, so the answer to
  --     "what was this tenant actually promised" survives any later catalog edit.
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'module_trial.started', 'business_module', p_module_key,
          jsonb_build_object('trial_started_at', v_after, 'trial_days', p_trial_days,
                             'row_created', NOT v_existed), 'success');

  RETURN QUERY SELECT true, NULL::text, v_after, p_trial_days, false;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.sync_customer_flat_contact(p_customer_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_phone text; v_email text;
  v_line1 text; v_line2 text; v_city text; v_state text; v_zip text;
  n int;
BEGIN
  SELECT value INTO v_phone FROM public.customer_phones
   WHERE customer_id = p_customer_id AND active
   ORDER BY is_primary DESC, created_at ASC, id ASC LIMIT 1;

  SELECT value INTO v_email FROM public.customer_emails
   WHERE customer_id = p_customer_id AND active
   ORDER BY is_primary DESC, created_at ASC, id ASC LIMIT 1;

  -- The BILLING address only. A shipping-only site must never become the customer's billing
  -- address — that is the D-41 redline arriving through a new door, and `kind` is what holds it.
  SELECT line1, line2, city, state, zip INTO v_line1, v_line2, v_city, v_state, v_zip
    FROM public.customer_addresses
   WHERE customer_id = p_customer_id AND active AND kind IN ('billing', 'both')
   ORDER BY is_default DESC, created_at ASC, id ASC LIMIT 1;

  -- The flag tells the guard trigger on `customers` that THIS write is the derivation. It is
  -- transaction-local and switched off again straight after, so nothing else inherits it.
  PERFORM pg_catalog.set_config('trace.contact_sync', 'on', true);
  UPDATE public.customers
     SET phone         = v_phone,
         email         = v_email,
         billing_line1 = v_line1,
         billing_line2 = v_line2,
         billing_city  = v_city,
         billing_state = v_state,
         billing_zip   = v_zip
   WHERE id = p_customer_id
     -- Only when something changed, so `updated_at` moves only for a real change.
     AND (phone IS DISTINCT FROM v_phone OR email IS DISTINCT FROM v_email
          OR billing_line1 IS DISTINCT FROM v_line1 OR billing_line2 IS DISTINCT FROM v_line2
          OR billing_city IS DISTINCT FROM v_city OR billing_state IS DISTINCT FROM v_state
          OR billing_zip IS DISTINCT FROM v_zip);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_catalog.set_config('trace.contact_sync', 'off', true);
  RETURN n > 0;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.trg_sync_customer_flat_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- 🔴 TENANT CHECK (AC-3). The list tables' RLS checks `business_id` only, so a member could write
  -- a row carrying their OWN business_id and ANOTHER business's customer_id — and this function
  -- runs as the owner. Refuse unless the row's business owns the customer.
  IF TG_OP <> 'DELETE' AND NOT EXISTS (
       SELECT 1 FROM public.customers c WHERE c.id = NEW.customer_id AND c.business_id = NEW.business_id) THEN
    RAISE EXCEPTION 'REFUSED: this contact detail names a customer that does not belong to its business. Nothing was saved.';
  END IF;
  -- On UPDATE the customer_id could in principle move; sync both sides rather than assume it did not.
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_customer_flat_contact(OLD.customer_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_customer_flat_contact(NEW.customer_id);
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    PERFORM public.sync_customer_flat_contact(OLD.customer_id);
  END IF;
  RETURN NEW;
END;
$function$;
-- @@
CREATE OR REPLACE FUNCTION public.undo_import_run(p_business_id uuid, p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_held          int;
  v_live_orders   int;
  v_live_lines    int;
  v_live_stops    int;
  v_live_contacts int;
  v_contacts      int := 0;
  v_other         jsonb := '{}'::jsonb;
  v_other_total   int := 0;
  v_n             int;
  r               record;
  v_p_orders      int;
  v_p_lines       int;
  v_p_stops       int;
  v_inventory     int;
  v_customers     int;
  v_unretired     int;
BEGIN
  IF p_business_id IS NULL OR p_run_id IS NULL THEN
    RAISE EXCEPTION 'undo_import_run requires a business and a run id';
  END IF;

  -- Serialise two undos of the same tenant (a double press, two tabs). Released at COMMIT.
  PERFORM pg_advisory_xact_lock(hashtext('undo_import_run:' || p_business_id::text));

  -- ── PRE-FLIGHT — reads only ─────────────────────────────────────────────────────────────
  SELECT count(DISTINCT bi.id) INTO v_held
    FROM public.business_inventory bi
    JOIN public.business_inventory_ledger l ON l.inventory_id = bi.id
   WHERE bi.business_id = p_business_id AND bi.import_run_id = p_run_id;

  SELECT count(*) INTO v_live_orders
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
   WHERE o.business_id = p_business_id
     AND c.business_id = p_business_id AND c.import_run_id = p_run_id
     AND NOT (o.order_kind IS NOT DISTINCT FROM 'test' AND o.import_run_id IS NOT DISTINCT FROM p_run_id);

  SELECT count(*) INTO v_live_lines
    FROM public.order_items oi
    JOIN public.orders o             ON o.id = oi.order_id
    JOIN public.business_inventory bi ON bi.id = oi.business_inventory_id
   WHERE o.business_id = p_business_id
     AND bi.business_id = p_business_id AND bi.import_run_id = p_run_id
     AND NOT (o.order_kind IS NOT DISTINCT FROM 'test' AND o.import_run_id IS NOT DISTINCT FROM p_run_id);

  SELECT count(*) INTO v_live_stops
    FROM public.deliveries d
    JOIN public.customers c ON c.id = d.customer_id
   WHERE d.business_id = p_business_id
     AND c.business_id = p_business_id AND c.import_run_id = p_run_id
     AND NOT EXISTS (
       SELECT 1 FROM public.orders o
        WHERE o.id = d.order_id AND o.business_id = p_business_id
          AND o.order_kind = 'test' AND o.import_run_id = p_run_id);

  -- 🔴 #335: a run customer's CONTACT rows go with it only if they carry THIS run's id — the import
  -- (and the migrations/reload that stood in for it) tagged them. An untagged row was added by a
  -- person after the import: it is live, and the undo refuses rather than take it.
  SELECT (SELECT count(*) FROM public.customer_phones t JOIN public.customers c ON c.id = t.customer_id
           WHERE c.business_id = p_business_id AND c.import_run_id = p_run_id
             AND t.import_run_id IS DISTINCT FROM p_run_id)
       + (SELECT count(*) FROM public.customer_emails t JOIN public.customers c ON c.id = t.customer_id
           WHERE c.business_id = p_business_id AND c.import_run_id = p_run_id
             AND t.import_run_id IS DISTINCT FROM p_run_id)
       + (SELECT count(*) FROM public.customer_addresses t JOIN public.customers c ON c.id = t.customer_id
           WHERE c.business_id = p_business_id AND c.import_run_id = p_run_id
             AND t.import_run_id IS DISTINCT FROM p_run_id)
    INTO v_live_contacts;

  -- Every other single-column FK into the two parents, from the catalog.
  FOR r IN
    SELECT c.conrelid::regclass AS child, a.attname AS col, c.confrelid::regclass AS parent,
           (c.conrelid = c.confrelid) AS self_ref
      FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND array_length(c.conkey, 1) = 1
       AND c.confrelid IN ('public.business_inventory'::regclass, 'public.customers'::regclass)
       AND c.conrelid NOT IN ('public.business_inventory_ledger'::regclass, 'public.orders'::regclass,
                              'public.order_items'::regclass,         'public.deliveries'::regclass,
                              -- #335: counted above, by run tag, and removed below
                              'public.customer_phones'::regclass,     'public.customer_emails'::regclass,
                              'public.customer_addresses'::regclass)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %s t JOIN %s p ON p.id = t.%I '
      'WHERE p.business_id = $1 AND p.import_run_id = $2 %s',
      r.child, r.parent, r.col,
      CASE WHEN r.self_ref THEN 'AND t.import_run_id IS DISTINCT FROM $2' ELSE '' END)
      INTO v_n USING p_business_id, p_run_id;
    IF v_n > 0 THEN
      v_other := v_other || jsonb_build_object(r.child::text || '.' || r.col, v_n);
      v_other_total := v_other_total + v_n;
    END IF;
  END LOOP;

  IF v_held + v_live_orders + v_live_lines + v_live_stops + v_live_contacts + v_other_total > 0 THEN
    -- 🔴 NOTHING HAS BEEN WRITTEN. The caller turns these counts into one sentence.
    RETURN jsonb_build_object(
      'refused', true,
      'held_lots', v_held, 'live_orders', v_live_orders, 'live_order_lines', v_live_lines,
      'live_deliveries', v_live_stops, 'live_contact_rows', v_live_contacts,
      'other_references', v_other);
  END IF;

  -- ── WRITES — one transaction; any failure below rolls back every one of them ─────────────
  -- ① the run's PRACTICE orders and their children (the same children handleDelete removes,
  --   plus the delivery stop checkout scheduled for a delivery order — practice too).
  -- The practice set is re-derived in each statement (no temp table inside a SECURITY DEFINER
  -- function); `orders` is deleted LAST, so the set is identical in every statement.
  DELETE FROM public.order_compliance_records WHERE order_id IN (
    SELECT o.id FROM public.orders o
     WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id);
  DELETE FROM public.order_service_selections WHERE order_id IN (
    SELECT o.id FROM public.orders o
     WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id);
  WITH d AS (DELETE FROM public.order_items WHERE order_id IN (
               SELECT o.id FROM public.orders o
                WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id)
             RETURNING 1)
    SELECT count(*) INTO v_p_lines FROM d;
  WITH d AS (DELETE FROM public.deliveries
              WHERE business_id = p_business_id AND order_id IN (
                SELECT o.id FROM public.orders o
                 WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id)
             RETURNING 1)
    SELECT count(*) INTO v_p_stops FROM d;
  WITH d AS (DELETE FROM public.orders
              WHERE business_id = p_business_id AND order_kind = 'test' AND import_run_id = p_run_id
             RETURNING 1)
    SELECT count(*) INTO v_p_orders FROM d;

  -- ② products, ③ customers — products first: a practice line could only have anchored to them,
  --   and those lines are already gone.
  WITH d AS (DELETE FROM public.business_inventory
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT count(*) INTO v_inventory FROM d;
  -- #335: the run's contact rows, then the customers. customer_addresses is RESTRICT, so it MUST go
  -- first; phones and emails would cascade, but are removed explicitly so the count is reported.
  -- The pre-flight guaranteed every contact row of a run customer carries this run's id.
  WITH d AS (DELETE FROM public.customer_phones
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT v_contacts + count(*) INTO v_contacts FROM d;
  WITH d AS (DELETE FROM public.customer_emails
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT v_contacts + count(*) INTO v_contacts FROM d;
  WITH d AS (DELETE FROM public.customer_addresses
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT v_contacts + count(*) INTO v_contacts FROM d;
  WITH d AS (DELETE FROM public.customers
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT count(*) INTO v_customers FROM d;

  -- ④ un-retire — scoped on retired_by_run_id, never on a time window (20260906 header).
  WITH u AS (UPDATE public.business_inventory
                SET retired_at = NULL, retired_reason = NULL, retired_by_run_id = NULL
              WHERE business_id = p_business_id AND retired_by_run_id = p_run_id RETURNING 1)
    SELECT count(*) INTO v_unretired FROM u;

  RETURN jsonb_build_object(
    'refused', false,
    'practice_orders_deleted', v_p_orders, 'practice_lines_deleted', v_p_lines,
    'practice_deliveries_deleted', v_p_stops,
    'inventory_deleted', v_inventory, 'customers_deleted', v_customers,
    'contact_rows_deleted', v_contacts, 'unretired', v_unretired);
END;
$function$;
-- @@
ALTER TABLE public."addons" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."addons" ALTER COLUMN "price_per_plant" SET DEFAULT 0;
-- @@
ALTER TABLE public."addons" ALTER COLUMN "pre_selected" SET DEFAULT false;
-- @@
ALTER TABLE public."addons" ALTER COLUMN "active" SET DEFAULT true;
-- @@
ALTER TABLE public."addons" ALTER COLUMN "sort_order" SET DEFAULT 0;
-- @@
ALTER TABLE public."audit_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."audit_log" ALTER COLUMN "detail" SET DEFAULT '{}'::jsonb;
-- @@
ALTER TABLE public."audit_log" ALTER COLUMN "outcome" SET DEFAULT 'success'::text;
-- @@
ALTER TABLE public."audit_log" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_accounting_secrets" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_accounting_secrets" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_context" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_context" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_discovery_profiles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_discovery_profiles" ALTER COLUMN "raw_extract" SET DEFAULT '{}'::jsonb;
-- @@
ALTER TABLE public."business_discovery_profiles" ALTER COLUMN "status" SET DEFAULT 'extracted'::text;
-- @@
ALTER TABLE public."business_discovery_profiles" ALTER COLUMN "extracted_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_discovery_profiles" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_discovery_profiles" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_display_standards" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_display_standards" ALTER COLUMN "decided_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_display_standards" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_inventory" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_inventory" ALTER COLUMN "qty" SET DEFAULT 0;
-- @@
ALTER TABLE public."business_inventory" ALTER COLUMN "status" SET DEFAULT 'available'::text;
-- @@
ALTER TABLE public."business_inventory" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_inventory" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_inventory_ledger" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_inventory_ledger" ALTER COLUMN "occurred_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_inventory_ledger" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_members" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_members" ALTER COLUMN "permissions" SET DEFAULT '[]'::jsonb;
-- @@
ALTER TABLE public."business_members" ALTER COLUMN "active" SET DEFAULT false;
-- @@
ALTER TABLE public."business_members" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_members" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_modules" ALTER COLUMN "enabled" SET DEFAULT false;
-- @@
ALTER TABLE public."business_modules" ALTER COLUMN "configured" SET DEFAULT false;
-- @@
ALTER TABLE public."business_modules" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;
-- @@
ALTER TABLE public."business_modules" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_modules" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_operating_days" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_operating_days" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_operating_days" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_operations_config" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;
-- @@
ALTER TABLE public."business_operations_config" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_operations_config" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_pmi_schedule" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_pmi_schedule" ALTER COLUMN "tasks" SET DEFAULT '[]'::jsonb;
-- @@
ALTER TABLE public."business_pmi_schedule" ALTER COLUMN "overrides" SET DEFAULT '[]'::jsonb;
-- @@
ALTER TABLE public."business_pmi_schedule" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_pmi_schedule" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_position_responsibilities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_position_responsibilities" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_positions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_positions" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_positions" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_pricing_config" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;
-- @@
ALTER TABLE public."business_pricing_config" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_pricing_config" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_service_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_service_log" ALTER COLUMN "performed_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_service_log" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."business_voice_samples" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."business_voice_samples" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."businesses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."businesses" ALTER COLUMN "business_type" SET DEFAULT 'nursery'::text;
-- @@
ALTER TABLE public."businesses" ALTER COLUMN "accounting_needs_reconnect" SET DEFAULT false;
-- @@
ALTER TABLE public."businesses" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."businesses" ALTER COLUMN "qbo_writes_enabled" SET DEFAULT false;
-- @@
ALTER TABLE public."campaign_posts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."campaign_posts" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
-- @@
ALTER TABLE public."campaign_posts" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."campaigns" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."campaigns" ALTER COLUMN "campaign_type" SET DEFAULT 'seasonal'::text;
-- @@
ALTER TABLE public."campaigns" ALTER COLUMN "status" SET DEFAULT 'active'::text;
-- @@
ALTER TABLE public."campaigns" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."channels" ALTER COLUMN "active" SET DEFAULT true;
-- @@
ALTER TABLE public."channels" ALTER COLUMN "sort_order" SET DEFAULT 100;
-- @@
ALTER TABLE public."channels" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."container_ladder" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."container_ladder" ALTER COLUMN "aliases" SET DEFAULT '{}'::text[];
-- @@
ALTER TABLE public."container_ladder" ALTER COLUMN "handling_because" SET DEFAULT 'not timed — the yard-wide rate stands in'::text;
-- @@
ALTER TABLE public."container_ladder" ALTER COLUMN "active" SET DEFAULT true;
-- @@
ALTER TABLE public."container_ladder" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."container_ladder" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."cost_object_assignments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."cost_object_assignments" ALTER COLUMN "start_at" SET DEFAULT now();
-- @@
ALTER TABLE public."cost_object_assignments" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."cost_object_assignments" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."cost_object_edges" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."cost_object_edges" ALTER COLUMN "use_fraction" SET DEFAULT 1.0;
-- @@
ALTER TABLE public."cost_object_edges" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."cost_object_edges" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."cost_objects" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."cost_objects" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::text;
-- @@
ALTER TABLE public."cost_objects" ALTER COLUMN "is_active" SET DEFAULT true;
-- @@
ALTER TABLE public."cost_objects" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."cost_objects" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."cost_objects" ALTER COLUMN "node_type" SET DEFAULT 'ASSET'::text;
-- @@
ALTER TABLE public."cost_objects" ALTER COLUMN "substantiation" SET DEFAULT 'OWNER_ASSERTED'::text;
-- @@
ALTER TABLE public."cost_objects" ALTER COLUMN "cost_shape" SET DEFAULT 'ONE_TIME'::text;
-- @@
ALTER TABLE public."cost_objects" ALTER COLUMN "cost_nature" SET DEFAULT 'CAPEX'::text;
-- @@
ALTER TABLE public."cost_objects" ALTER COLUMN "cost_source" SET DEFAULT 'MANUAL'::text;
-- @@
ALTER TABLE public."cultivar_plants" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."cultivar_plants" ALTER COLUMN "warranty_months" SET DEFAULT 12;
-- @@
ALTER TABLE public."cultivar_plants" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."cultivar_plants" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."customer_addresses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."customer_addresses" ALTER COLUMN "is_default" SET DEFAULT false;
-- @@
ALTER TABLE public."customer_addresses" ALTER COLUMN "active" SET DEFAULT true;
-- @@
ALTER TABLE public."customer_addresses" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."customer_addresses" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."customer_addresses" ALTER COLUMN "kind" SET DEFAULT 'shipping'::text;
-- @@
ALTER TABLE public."customer_emails" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."customer_emails" ALTER COLUMN "label" SET DEFAULT 'main'::text;
-- @@
ALTER TABLE public."customer_emails" ALTER COLUMN "is_primary" SET DEFAULT false;
-- @@
ALTER TABLE public."customer_emails" ALTER COLUMN "active" SET DEFAULT true;
-- @@
ALTER TABLE public."customer_emails" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."customer_emails" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."customer_phones" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."customer_phones" ALTER COLUMN "label" SET DEFAULT 'main'::text;
-- @@
ALTER TABLE public."customer_phones" ALTER COLUMN "is_primary" SET DEFAULT false;
-- @@
ALTER TABLE public."customer_phones" ALTER COLUMN "active" SET DEFAULT true;
-- @@
ALTER TABLE public."customer_phones" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."customer_phones" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."customers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."customers" ALTER COLUMN "state" SET DEFAULT 'TX'::text;
-- @@
ALTER TABLE public."customers" ALTER COLUMN "marketing_opt_in" SET DEFAULT true;
-- @@
ALTER TABLE public."customers" ALTER COLUMN "source" SET DEFAULT 'qr-scan'::text;
-- @@
ALTER TABLE public."customers" ALTER COLUMN "lifetime_value" SET DEFAULT 0;
-- @@
ALTER TABLE public."customers" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."customers" ALTER COLUMN "price_tier" SET DEFAULT 'retail'::text;
-- @@
ALTER TABLE public."customers" ALTER COLUMN "customer_type" SET DEFAULT 'person'::text;
-- @@
ALTER TABLE public."customers" ALTER COLUMN "tax_exempt" SET DEFAULT false;
-- @@
ALTER TABLE public."customers" ALTER COLUMN "status" SET DEFAULT 'active'::text;
-- @@
ALTER TABLE public."customers" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."deliveries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."deliveries" ALTER COLUMN "status" SET DEFAULT 'scheduled'::text;
-- @@
ALTER TABLE public."deliveries" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."inventory_count_sessions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."inventory_count_sessions" ALTER COLUMN "status" SET DEFAULT 'in_progress'::text;
-- @@
ALTER TABLE public."inventory_count_sessions" ALTER COLUMN "item_count" SET DEFAULT 0;
-- @@
ALTER TABLE public."inventory_count_sessions" ALTER COLUMN "started_at" SET DEFAULT now();
-- @@
ALTER TABLE public."inventory_count_sessions" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."inventory_count_sessions" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."inventory_counts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."inventory_counts" ALTER COLUMN "was_unknown" SET DEFAULT false;
-- @@
ALTER TABLE public."inventory_counts" ALTER COLUMN "counted_at" SET DEFAULT now();
-- @@
ALTER TABLE public."inventory_counts" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."invitations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."invitations" ALTER COLUMN "token" SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text);
-- @@
ALTER TABLE public."invitations" ALTER COLUMN "used" SET DEFAULT false;
-- @@
ALTER TABLE public."invitations" ALTER COLUMN "expires_at" SET DEFAULT (now() + '7 days'::interval);
-- @@
ALTER TABLE public."invitations" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."labor_resource_wages" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."labor_resource_wages" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."labor_resources" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."labor_resources" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."labor_resources" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."losses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."losses" ALTER COLUMN "estimated_value" SET DEFAULT 0;
-- @@
ALTER TABLE public."losses" ALTER COLUMN "occurred_at" SET DEFAULT now();
-- @@
ALTER TABLE public."losses" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."member_device_handoffs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."member_device_handoffs" ALTER COLUMN "token" SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text);
-- @@
ALTER TABLE public."member_device_handoffs" ALTER COLUMN "used" SET DEFAULT false;
-- @@
ALTER TABLE public."member_device_handoffs" ALTER COLUMN "expires_at" SET DEFAULT (now() + '00:15:00'::interval);
-- @@
ALTER TABLE public."member_device_handoffs" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."member_devices" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."member_devices" ALTER COLUMN "biometric_enrolled" SET DEFAULT false;
-- @@
ALTER TABLE public."member_devices" ALTER COLUMN "is_active" SET DEFAULT true;
-- @@
ALTER TABLE public."member_devices" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."modules" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."modules" ALTER COLUMN "tier_required" SET DEFAULT 'starter'::text;
-- @@
ALTER TABLE public."modules" ALTER COLUMN "setup_required" SET DEFAULT false;
-- @@
ALTER TABLE public."modules" ALTER COLUMN "sort_order" SET DEFAULT 0;
-- @@
ALTER TABLE public."modules" ALTER COLUMN "built" SET DEFAULT true;
-- @@
ALTER TABLE public."modules" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."nurseries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."nurseries" ALTER COLUMN "tax_rate" SET DEFAULT 0.0825;
-- @@
ALTER TABLE public."nurseries" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."nurseries" ALTER COLUMN "qb_needs_reconnect" SET DEFAULT false;
-- @@
ALTER TABLE public."nursery_profiles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."nursery_profiles" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."opportunity_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."opportunity_items" ALTER COLUMN "is_active" SET DEFAULT true;
-- @@
ALTER TABLE public."opportunity_items" ALTER COLUMN "sort_order" SET DEFAULT 0;
-- @@
ALTER TABLE public."opportunity_items" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."order_addons" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."order_addons" ALTER COLUMN "quantity" SET DEFAULT 1;
-- @@
ALTER TABLE public."order_compliance_records" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."order_compliance_records" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."order_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."order_items" ALTER COLUMN "quantity" SET DEFAULT 1;
-- @@
ALTER TABLE public."order_items" ALTER COLUMN "is_manual_override" SET DEFAULT false;
-- @@
ALTER TABLE public."order_service_selections" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."order_service_selections" ALTER COLUMN "quantity" SET DEFAULT 1;
-- @@
ALTER TABLE public."order_service_selections" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."order_service_selections" ALTER COLUMN "is_manual_override" SET DEFAULT false;
-- @@
ALTER TABLE public."orders" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."orders" ALTER COLUMN "netting_declined" SET DEFAULT false;
-- @@
ALTER TABLE public."orders" ALTER COLUMN "subtotal" SET DEFAULT 0;
-- @@
ALTER TABLE public."orders" ALTER COLUMN "tax_amount" SET DEFAULT 0;
-- @@
ALTER TABLE public."orders" ALTER COLUMN "total_amount" SET DEFAULT 0;
-- @@
ALTER TABLE public."orders" ALTER COLUMN "addons_amount" SET DEFAULT 0;
-- @@
ALTER TABLE public."orders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
-- @@
ALTER TABLE public."orders" ALTER COLUMN "leakage_flag" SET DEFAULT false;
-- @@
ALTER TABLE public."orders" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."orders" ALTER COLUMN "tax_exempt_applied" SET DEFAULT false;
-- @@
ALTER TABLE public."people" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."people" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."people" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."plant_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."plant_events" ALTER COLUMN "occurred_at" SET DEFAULT now();
-- @@
ALTER TABLE public."platform_config" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."production_plan_lines" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."production_plan_lines" ALTER COLUMN "qty_completed" SET DEFAULT 0;
-- @@
ALTER TABLE public."production_plan_lines" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."production_plan_lines" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."production_plans" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."production_plans" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
-- @@
ALTER TABLE public."production_plans" ALTER COLUMN "batch_size" SET DEFAULT 40;
-- @@
ALTER TABLE public."production_plans" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."production_plans" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."receipts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."receipts" ALTER COLUMN "status" SET DEFAULT 'captured'::text;
-- @@
ALTER TABLE public."receipts" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."receipts" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."role_definitions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."role_definitions" ALTER COLUMN "is_system" SET DEFAULT false;
-- @@
ALTER TABLE public."role_definitions" ALTER COLUMN "permissions" SET DEFAULT '[]'::jsonb;
-- @@
ALTER TABLE public."role_definitions" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."role_definitions" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."service_offerings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."service_offerings" ALTER COLUMN "timing" SET DEFAULT 'at_checkout'::text;
-- @@
ALTER TABLE public."service_offerings" ALTER COLUMN "price_type" SET DEFAULT 'per_unit'::text;
-- @@
ALTER TABLE public."service_offerings" ALTER COLUMN "price" SET DEFAULT 0;
-- @@
ALTER TABLE public."service_offerings" ALTER COLUMN "requires_address" SET DEFAULT false;
-- @@
ALTER TABLE public."service_offerings" ALTER COLUMN "pre_selected" SET DEFAULT true;
-- @@
ALTER TABLE public."service_offerings" ALTER COLUMN "is_active" SET DEFAULT true;
-- @@
ALTER TABLE public."service_offerings" ALTER COLUMN "sort_order" SET DEFAULT 0;
-- @@
ALTER TABLE public."service_offerings" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."social_drafts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."social_drafts" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
-- @@
ALTER TABLE public."social_drafts" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."vendor_aliases" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."vendor_aliases" ALTER COLUMN "source" SET DEFAULT 'owner'::text;
-- @@
ALTER TABLE public."vendor_aliases" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."vendor_preferences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."vendor_preferences" ALTER COLUMN "preferred" SET DEFAULT true;
-- @@
ALTER TABLE public."vendor_preferences" ALTER COLUMN "answered_at" SET DEFAULT now();
-- @@
ALTER TABLE public."vendor_preferences" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."vendor_preferences" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."vendors" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
-- @@
ALTER TABLE public."vendors" ALTER COLUMN "preferred" SET DEFAULT false;
-- @@
ALTER TABLE public."vendors" ALTER COLUMN "created_at" SET DEFAULT now();
-- @@
ALTER TABLE public."vendors" ALTER COLUMN "updated_at" SET DEFAULT now();
-- @@
ALTER TABLE public."addons" ADD CONSTRAINT "addons_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."audit_log" ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_accounting_secrets" ADD CONSTRAINT "business_accounting_secrets_pkey" PRIMARY KEY (business_id);
-- @@
ALTER TABLE public."business_context" ADD CONSTRAINT "business_context_pkey" PRIMARY KEY (business_id);
-- @@
ALTER TABLE public."business_discovery_profiles" ADD CONSTRAINT "business_discovery_profiles_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_display_standards" ADD CONSTRAINT "business_display_standards_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_inventory" ADD CONSTRAINT "business_inventory_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_inventory_ledger" ADD CONSTRAINT "business_inventory_ledger_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_members" ADD CONSTRAINT "business_members_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_modules" ADD CONSTRAINT "business_modules_pkey" PRIMARY KEY (business_id, module_key);
-- @@
ALTER TABLE public."business_operating_days" ADD CONSTRAINT "business_operating_days_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_operations_config" ADD CONSTRAINT "business_operations_config_pkey" PRIMARY KEY (business_id);
-- @@
ALTER TABLE public."business_pmi_schedule" ADD CONSTRAINT "business_pmi_schedule_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_position_responsibilities" ADD CONSTRAINT "business_position_responsibilities_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_positions" ADD CONSTRAINT "business_positions_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_pricing_config" ADD CONSTRAINT "business_pricing_config_pkey" PRIMARY KEY (business_id);
-- @@
ALTER TABLE public."business_service_log" ADD CONSTRAINT "business_service_log_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_voice_samples" ADD CONSTRAINT "campaign_tone_samples_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."businesses" ADD CONSTRAINT "businesses_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."campaign_posts" ADD CONSTRAINT "campaign_posts_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."campaigns" ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."channels" ADD CONSTRAINT "channels_pkey" PRIMARY KEY (name);
-- @@
ALTER TABLE public."container_ladder" ADD CONSTRAINT "container_ladder_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."cost_object_assignments" ADD CONSTRAINT "cost_object_assignments_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."cost_object_edges" ADD CONSTRAINT "cost_object_edges_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."cultivar_plants" ADD CONSTRAINT "plants_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."customer_addresses" ADD CONSTRAINT "customer_addresses_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."customer_emails" ADD CONSTRAINT "customer_emails_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."customer_phones" ADD CONSTRAINT "customer_phones_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."customers" ADD CONSTRAINT "customers_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."inventory_counts" ADD CONSTRAINT "inventory_counts_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."labor_resource_wages" ADD CONSTRAINT "labor_resource_wages_pkey" PRIMARY KEY (resource_id);
-- @@
ALTER TABLE public."labor_resources" ADD CONSTRAINT "labor_resources_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."losses" ADD CONSTRAINT "losses_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."member_device_handoffs" ADD CONSTRAINT "member_device_handoffs_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."member_devices" ADD CONSTRAINT "member_devices_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."modules" ADD CONSTRAINT "modules_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."nurseries" ADD CONSTRAINT "nurseries_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."nursery_profiles" ADD CONSTRAINT "nursery_profiles_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."opportunity_items" ADD CONSTRAINT "opportunity_items_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."order_addons" ADD CONSTRAINT "order_addons_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."order_compliance_records" ADD CONSTRAINT "order_compliance_records_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."order_service_selections" ADD CONSTRAINT "order_service_selections_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."people" ADD CONSTRAINT "people_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."permission_aliases" ADD CONSTRAINT "permission_aliases_pkey" PRIMARY KEY (from_perm, implies_perm);
-- @@
ALTER TABLE public."plant_events" ADD CONSTRAINT "plant_events_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."platform_config" ADD CONSTRAINT "platform_config_pkey" PRIMARY KEY (key);
-- @@
ALTER TABLE public."production_plan_lines" ADD CONSTRAINT "production_plan_lines_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."production_plans" ADD CONSTRAINT "production_plans_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."role_definitions" ADD CONSTRAINT "role_definitions_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."service_offerings" ADD CONSTRAINT "service_offerings_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."social_drafts" ADD CONSTRAINT "social_drafts_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."vendor_aliases" ADD CONSTRAINT "vendor_aliases_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."vendor_preferences" ADD CONSTRAINT "vendor_preferences_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."vendors" ADD CONSTRAINT "vendors_pkey" PRIMARY KEY (id);
-- @@
ALTER TABLE public."business_discovery_profiles" ADD CONSTRAINT "business_discovery_profiles_business_id_source_url_key" UNIQUE (business_id, source_url);
-- @@
ALTER TABLE public."business_display_standards" ADD CONSTRAINT "business_display_standards_business_id_domain_group_key_key" UNIQUE (business_id, domain, group_key);
-- @@
ALTER TABLE public."business_position_responsibilities" ADD CONSTRAINT "business_position_responsibil_position_id_responsibility_id_key" UNIQUE (position_id, responsibility_id);
-- @@
ALTER TABLE public."cultivar_plants" ADD CONSTRAINT "plants_tag_id_key" UNIQUE (tag_id);
-- @@
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_token_key" UNIQUE (token);
-- @@
ALTER TABLE public."member_device_handoffs" ADD CONSTRAINT "member_device_handoffs_token_key" UNIQUE (token);
-- @@
ALTER TABLE public."modules" ADD CONSTRAINT "modules_key_key" UNIQUE (key);
-- @@
ALTER TABLE public."nursery_profiles" ADD CONSTRAINT "nursery_profiles_business_id_key" UNIQUE (business_id);
-- @@
ALTER TABLE public."people" ADD CONSTRAINT "people_auth_user_id_key" UNIQUE (auth_user_id);
-- @@
ALTER TABLE public."business_inventory" ADD CONSTRAINT "business_inventory_cost_confidence_check" CHECK ((cost_confidence = ANY (ARRAY['CONFIRMED'::text, 'DERIVED'::text, 'ESTIMATED'::text, 'UNKNOWN'::text])));
-- @@
ALTER TABLE public."business_inventory" ADD CONSTRAINT "business_inventory_unit_kind_check" CHECK (((unit_kind IS NULL) OR (unit_kind = ANY (ARRAY['container'::text, 'volume'::text, 'weight'::text, 'length'::text, 'each'::text]))));
-- @@
ALTER TABLE public."business_inventory" ADD CONSTRAINT "business_inventory_unit_projection_check" CHECK ((((unit_parsed_from IS NULL) AND (unit_kind IS NULL) AND (unit_value IS NULL) AND (unit_value_max IS NULL) AND (unit_name IS NULL)) OR ((unit_parsed_from IS NOT NULL) AND (NOT (unit_parsed_from IS DISTINCT FROM size)))));
-- @@
ALTER TABLE public."business_operating_days" ADD CONSTRAINT "business_operating_days_day_type_check" CHECK ((day_type = ANY (ARRAY['service'::text, 'delivery_only'::text, 'delivery_placement'::text, 'closed'::text])));
-- @@
ALTER TABLE public."business_operating_days" ADD CONSTRAINT "business_operating_days_one_kind" CHECK (((weekday IS NULL) <> (on_date IS NULL)));
-- @@
ALTER TABLE public."business_operating_days" ADD CONSTRAINT "business_operating_days_weekday_range" CHECK (((weekday IS NULL) OR ((weekday >= 0) AND (weekday <= 6))));
-- @@
ALTER TABLE public."business_service_log" ADD CONSTRAINT "business_service_log_result_check" CHECK ((result = ANY (ARRAY['PASS'::text, 'NEEDS_ATTENTION'::text, 'FAIL'::text])));
-- @@
ALTER TABLE public."campaign_posts" ADD CONSTRAINT "campaign_posts_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'reviewed'::text, 'scheduled'::text, 'published'::text, 'failed'::text])));
-- @@
ALTER TABLE public."campaigns" ADD CONSTRAINT "campaigns_campaign_type_check" CHECK ((campaign_type = ANY (ARRAY['seasonal'::text, 'holiday'::text, 'clearance'::text, 'product_launch'::text, 'custom'::text])));
-- @@
ALTER TABLE public."campaigns" ADD CONSTRAINT "campaigns_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'cancelled'::text])));
-- @@
ALTER TABLE public."container_ladder" ADD CONSTRAINT "container_ladder_handling_minutes_check" CHECK (((handling_minutes IS NULL) OR (handling_minutes > (0)::numeric)));
-- @@
ALTER TABLE public."container_ladder" ADD CONSTRAINT "container_ladder_volume_gallons_check" CHECK (((volume_gallons IS NULL) OR (volume_gallons > (0)::numeric)));
-- @@
ALTER TABLE public."cost_object_assignments" ADD CONSTRAINT "cost_object_assignments_basis_confidence_check" CHECK (((basis_confidence IS NULL) OR (basis_confidence = ANY (ARRAY['CONFIRMED'::text, 'DERIVED'::text, 'ESTIMATED'::text, 'UNKNOWN'::text]))));
-- @@
ALTER TABLE public."cost_object_assignments" ADD CONSTRAINT "cost_object_assignments_no_self" CHECK ((asset_id <> project_id));
-- @@
ALTER TABLE public."cost_object_assignments" ADD CONSTRAINT "cost_object_assignments_period" CHECK (((end_at IS NULL) OR (end_at >= start_at)));
-- @@
ALTER TABLE public."cost_object_edges" ADD CONSTRAINT "cost_object_edges_basis_confidence_check" CHECK (((basis_confidence IS NULL) OR (basis_confidence = ANY (ARRAY['CONFIRMED'::text, 'DERIVED'::text, 'ESTIMATED'::text, 'UNKNOWN'::text]))));
-- @@
ALTER TABLE public."cost_object_edges" ADD CONSTRAINT "cost_object_edges_basis_type_check" CHECK (((basis_type IS NULL) OR (basis_type = ANY (ARRAY['sqft'::text, 'percent'::text, 'usage'::text, 'miles'::text, 'labor_hours'::text, 'manual'::text]))));
-- @@
ALTER TABLE public."cost_object_edges" ADD CONSTRAINT "cost_object_edges_edge_type_check" CHECK ((edge_type = ANY (ARRAY['containment'::text, 'contribution'::text])));
-- @@
ALTER TABLE public."cost_object_edges" ADD CONSTRAINT "cost_object_edges_no_self" CHECK ((parent_id <> child_id));
-- @@
ALTER TABLE public."cost_object_edges" ADD CONSTRAINT "cost_object_edges_use_fraction_check" CHECK (((use_fraction > (0)::numeric) AND (use_fraction <= (1)::numeric)));
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "business_assets_cost_confidence_check" CHECK ((cost_confidence = ANY (ARRAY['CONFIRMED'::text, 'DERIVED'::text, 'ESTIMATED'::text, 'UNKNOWN'::text])));
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_cadence_check" CHECK (((cadence IS NULL) OR (cadence = ANY (ARRAY['ONE_OFF'::text, 'WEEKLY'::text, 'MONTHLY'::text, 'QUARTERLY'::text, 'ANNUAL'::text]))));
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_cost_nature_check" CHECK ((cost_nature = ANY (ARRAY['CAPEX'::text, 'COGS'::text, 'OPEX'::text])));
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_cost_shape_check" CHECK ((cost_shape = ANY (ARRAY['ONE_TIME'::text, 'RECURRING_FIXED'::text, 'PER_OCCASION'::text, 'PREPAID_AMORTIZED'::text, 'INCREMENTAL_PREPAID'::text, 'VARIABLE'::text])));
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_estimated_value_confidence_check" CHECK ((estimated_value_confidence = ANY (ARRAY['CONFIRMED'::text, 'DERIVED'::text, 'ESTIMATED'::text, 'UNKNOWN'::text])));
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_node_type_check" CHECK ((node_type = ANY (ARRAY['ASSET'::text, 'PROJECT'::text, 'PRODUCT'::text, 'COST'::text])));
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_product_status_check" CHECK (((product_status IS NULL) OR (product_status = ANY (ARRAY['active'::text, 'retired'::text]))));
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_project_status_check" CHECK (((project_status IS NULL) OR (project_status = ANY (ARRAY['open'::text, 'closed'::text, 'converted'::text]))));
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_status_check" CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'IN_REPAIR'::text, 'OFFLINE'::text, 'RETIRED'::text, 'IDLE'::text, 'UNASSIGNED'::text])));
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_substantiation_check" CHECK ((substantiation = ANY (ARRAY['SUBSTANTIATED'::text, 'OWNER_ASSERTED'::text])));
-- @@
ALTER TABLE public."cultivar_plants" ADD CONSTRAINT "plants_plant_type_check" CHECK ((plant_type = ANY (ARRAY['tree'::text, 'shrub'::text, 'perennial'::text, 'annual'::text, 'garden'::text])));
-- @@
ALTER TABLE public."customer_addresses" ADD CONSTRAINT "customer_addresses_kind_check" CHECK ((kind = ANY (ARRAY['billing'::text, 'shipping'::text, 'both'::text])));
-- @@
ALTER TABLE public."labor_resources" ADD CONSTRAINT "labor_resources_rate_basis_check" CHECK ((rate_basis = ANY (ARRAY['HOURLY'::text, 'FLAT_FEE'::text])));
-- @@
ALTER TABLE public."labor_resources" ADD CONSTRAINT "labor_resources_resource_type_check" CHECK ((resource_type = ANY (ARRAY['EMPLOYEE'::text, 'CONTRACTOR'::text])));
-- @@
ALTER TABLE public."modules" ADD CONSTRAINT "modules_tier_required_check" CHECK ((tier_required = ANY (ARRAY['starter'::text, 'growth'::text, 'enterprise'::text])));
-- @@
ALTER TABLE public."order_compliance_records" ADD CONSTRAINT "order_compliance_records_decision_check" CHECK ((decision = ANY (ARRAY['accepted'::text, 'declined'::text])));
-- @@
ALTER TABLE public."orders" ADD CONSTRAINT "orders_transport_method_check" CHECK ((transport_method = ANY (ARRAY['self'::text, 'delivery'::text, 'install'::text])));
-- @@
ALTER TABLE public."plant_events" ADD CONSTRAINT "plant_events_event_type_check" CHECK ((event_type = ANY (ARRAY['arrived'::text, 'repotted'::text, 'moved'::text, 'treated'::text, 'photo'::text, 'priced'::text, 'reserved'::text, 'sold'::text, 'lost'::text, 'returned'::text])));
-- @@
ALTER TABLE public."production_plan_lines" ADD CONSTRAINT "production_plan_lines_backdate_check" CHECK (((completed_date IS NULL) OR (completed_date >= (created_at)::date) OR ((backdate_reason IS NOT NULL) AND (btrim(backdate_reason) <> ''::text))));
-- @@
ALTER TABLE public."production_plan_lines" ADD CONSTRAINT "production_plan_lines_qty_check" CHECK (((qty_planned >= 0) AND (qty_completed >= 0) AND (qty_completed <= qty_planned)));
-- @@
ALTER TABLE public."production_plan_lines" ADD CONSTRAINT "production_plan_lines_rung_check" CHECK ((to_unit_value > from_unit_value));
-- @@
ALTER TABLE public."production_plans" ADD CONSTRAINT "production_plans_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'completed'::text, 'cancelled'::text])));
-- @@
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_accept_vs_edit_check" CHECK ((accept_vs_edit = ANY (ARRAY['accepted_as_is'::text, 'edited'::text])));
-- @@
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_reconcile_status_check" CHECK ((reconcile_status = ANY (ARRAY['match'::text, 'small_gap'::text, 'large_mismatch_overridden'::text])));
-- @@
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_status_check" CHECK ((status = ANY (ARRAY['captured'::text, 'confirmed'::text])));
-- @@
ALTER TABLE public."service_offerings" ADD CONSTRAINT "service_offerings_category_check" CHECK ((category = ANY (ARRAY['transport'::text, 'addon'::text, 'maintenance'::text, 'inspection'::text, 'subscription'::text])));
-- @@
ALTER TABLE public."service_offerings" ADD CONSTRAINT "service_offerings_price_type_check" CHECK ((price_type = ANY (ARRAY['flat'::text, 'per_unit'::text])));
-- @@
ALTER TABLE public."service_offerings" ADD CONSTRAINT "service_offerings_price_unit_shape" CHECK (((price_unit ~ '^[a-z][a-z0-9_]*$'::text) AND (length(price_unit) <= 40)));
-- @@
ALTER TABLE public."service_offerings" ADD CONSTRAINT "service_offerings_timing_check" CHECK ((timing = ANY (ARRAY['at_checkout'::text, 'post_purchase'::text, 'recurring'::text])));
-- @@
ALTER TABLE public."service_offerings" ADD CONSTRAINT "service_offerings_transport_mode_check" CHECK ((transport_mode = ANY (ARRAY['self'::text, 'staff'::text])));
-- @@
ALTER TABLE public."service_offerings" ADD CONSTRAINT "service_offerings_transport_requires_mode" CHECK (((category <> 'transport'::text) OR (transport_mode IS NOT NULL)));
-- @@
ALTER TABLE public."service_offerings" ADD CONSTRAINT "service_offerings_trigger_transport_mode_check" CHECK ((trigger_transport_mode = ANY (ARRAY['self'::text, 'staff'::text])));
-- @@
ALTER TABLE public."social_drafts" ADD CONSTRAINT "social_drafts_post_type_check" CHECK ((post_type = ANY (ARRAY['educational'::text, 'customer_story'::text, 'seasonal'::text])));
-- @@
ALTER TABLE public."social_drafts" ADD CONSTRAINT "social_drafts_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'edited'::text, 'approved'::text, 'copied'::text])));
-- @@
ALTER TABLE public."vendor_aliases" ADD CONSTRAINT "vendor_aliases_source_check" CHECK ((source = ANY (ARRAY['owner'::text, 'capture'::text])));
-- @@
ALTER TABLE public."addons" ADD CONSTRAINT "addons_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id);
-- @@
ALTER TABLE public."audit_log" ADD CONSTRAINT "audit_log_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_accounting_secrets" ADD CONSTRAINT "business_accounting_secrets_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_context" ADD CONSTRAINT "business_context_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_discovery_profiles" ADD CONSTRAINT "business_discovery_profiles_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_display_standards" ADD CONSTRAINT "business_display_standards_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_inventory" ADD CONSTRAINT "business_inventory_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_inventory" ADD CONSTRAINT "business_inventory_receipt_id_fkey" FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."business_inventory_ledger" ADD CONSTRAINT "business_inventory_ledger_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_inventory_ledger" ADD CONSTRAINT "business_inventory_ledger_inventory_id_fkey" FOREIGN KEY (inventory_id) REFERENCES business_inventory(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."business_members" ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_members" ADD CONSTRAINT "business_members_person_id_fkey" FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."business_members" ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."business_members" ADD CONSTRAINT "fk_business_members_invite_id" FOREIGN KEY (invite_id) REFERENCES invitations(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."business_modules" ADD CONSTRAINT "business_modules_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_operating_days" ADD CONSTRAINT "business_operating_days_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_operations_config" ADD CONSTRAINT "business_operations_config_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_pmi_schedule" ADD CONSTRAINT "business_pmi_schedule_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES cost_objects(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_pmi_schedule" ADD CONSTRAINT "business_pmi_schedule_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_position_responsibilities" ADD CONSTRAINT "business_position_responsibilities_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_position_responsibilities" ADD CONSTRAINT "business_position_responsibilities_position_id_fkey" FOREIGN KEY (position_id) REFERENCES business_positions(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_positions" ADD CONSTRAINT "business_positions_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_pricing_config" ADD CONSTRAINT "business_pricing_config_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_service_log" ADD CONSTRAINT "business_service_log_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES cost_objects(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_service_log" ADD CONSTRAINT "business_service_log_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."business_service_log" ADD CONSTRAINT "business_service_log_receipt_id_fkey" FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."business_voice_samples" ADD CONSTRAINT "campaign_tone_samples_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."businesses" ADD CONSTRAINT "businesses_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id);
-- @@
ALTER TABLE public."campaign_posts" ADD CONSTRAINT "campaign_posts_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."campaign_posts" ADD CONSTRAINT "campaign_posts_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."campaign_posts" ADD CONSTRAINT "campaign_posts_platform_fkey" FOREIGN KEY (platform) REFERENCES channels(name) ON UPDATE CASCADE ON DELETE RESTRICT;
-- @@
ALTER TABLE public."campaigns" ADD CONSTRAINT "campaigns_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."container_ladder" ADD CONSTRAINT "container_ladder_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."cost_object_assignments" ADD CONSTRAINT "cost_object_assignments_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES cost_objects(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."cost_object_assignments" ADD CONSTRAINT "cost_object_assignments_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."cost_object_assignments" ADD CONSTRAINT "cost_object_assignments_project_id_fkey" FOREIGN KEY (project_id) REFERENCES cost_objects(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."cost_object_edges" ADD CONSTRAINT "cost_object_edges_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."cost_object_edges" ADD CONSTRAINT "cost_object_edges_child_id_fkey" FOREIGN KEY (child_id) REFERENCES cost_objects(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."cost_object_edges" ADD CONSTRAINT "cost_object_edges_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES cost_objects(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "business_assets_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES cost_objects(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_receipt_id_fkey" FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."cost_objects" ADD CONSTRAINT "cost_objects_resource_id_fkey" FOREIGN KEY (resource_id) REFERENCES labor_resources(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."cultivar_plants" ADD CONSTRAINT "cultivar_plants_inventory_id_fkey" FOREIGN KEY (inventory_id) REFERENCES business_inventory(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."cultivar_plants" ADD CONSTRAINT "plants_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id);
-- @@
ALTER TABLE public."customer_addresses" ADD CONSTRAINT "customer_addresses_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
-- @@
ALTER TABLE public."customer_emails" ADD CONSTRAINT "customer_emails_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."customer_emails" ADD CONSTRAINT "customer_emails_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."customer_phones" ADD CONSTRAINT "customer_phones_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."customer_phones" ADD CONSTRAINT "customer_phones_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."customers" ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id);
-- @@
ALTER TABLE public."customers" ADD CONSTRAINT "customers_person_id_fkey" FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."deliveries" ADD CONSTRAINT "deliveries_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."inventory_counts" ADD CONSTRAINT "inventory_counts_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."inventory_counts" ADD CONSTRAINT "inventory_counts_inventory_id_fkey" FOREIGN KEY (inventory_id) REFERENCES business_inventory(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."inventory_counts" ADD CONSTRAINT "inventory_counts_session_id_fkey" FOREIGN KEY (session_id) REFERENCES inventory_count_sessions(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_person_id_fkey" FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."labor_resource_wages" ADD CONSTRAINT "labor_resource_wages_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."labor_resource_wages" ADD CONSTRAINT "labor_resource_wages_resource_id_fkey" FOREIGN KEY (resource_id) REFERENCES labor_resources(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."labor_resources" ADD CONSTRAINT "labor_resources_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."labor_resources" ADD CONSTRAINT "labor_resources_person_id_fkey" FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."losses" ADD CONSTRAINT "losses_nursery_id_fkey" FOREIGN KEY (nursery_id) REFERENCES nurseries(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."losses" ADD CONSTRAINT "losses_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES cultivar_plants(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."member_device_handoffs" ADD CONSTRAINT "member_device_handoffs_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."member_device_handoffs" ADD CONSTRAINT "member_device_handoffs_member_id_fkey" FOREIGN KEY (member_id) REFERENCES business_members(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."member_devices" ADD CONSTRAINT "member_devices_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."member_devices" ADD CONSTRAINT "member_devices_member_id_fkey" FOREIGN KEY (member_id) REFERENCES business_members(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."nurseries" ADD CONSTRAINT "nurseries_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."nursery_profiles" ADD CONSTRAINT "nursery_profiles_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."opportunity_items" ADD CONSTRAINT "opportunity_items_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."order_addons" ADD CONSTRAINT "order_addons_addon_id_fkey" FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE RESTRICT;
-- @@
ALTER TABLE public."order_addons" ADD CONSTRAINT "order_addons_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."order_compliance_records" ADD CONSTRAINT "order_compliance_records_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id);
-- @@
ALTER TABLE public."order_compliance_records" ADD CONSTRAINT "order_compliance_records_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."order_compliance_records" ADD CONSTRAINT "order_compliance_records_service_offering_id_fkey" FOREIGN KEY (service_offering_id) REFERENCES service_offerings(id);
-- @@
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_business_inventory_id_fkey" FOREIGN KEY (business_inventory_id) REFERENCES business_inventory(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."order_service_selections" ADD CONSTRAINT "order_service_selections_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."order_service_selections" ADD CONSTRAINT "order_service_selections_service_offering_id_fkey" FOREIGN KEY (service_offering_id) REFERENCES service_offerings(id);
-- @@
ALTER TABLE public."orders" ADD CONSTRAINT "orders_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id);
-- @@
ALTER TABLE public."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
-- @@
ALTER TABLE public."orders" ADD CONSTRAINT "orders_receipt_id_fkey" FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."people" ADD CONSTRAINT "people_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."plant_events" ADD CONSTRAINT "plant_events_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id);
-- @@
ALTER TABLE public."plant_events" ADD CONSTRAINT "plant_events_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES cultivar_plants(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."production_plan_lines" ADD CONSTRAINT "production_plan_lines_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."production_plan_lines" ADD CONSTRAINT "production_plan_lines_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES production_plans(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."production_plan_lines" ADD CONSTRAINT "production_plan_lines_source_inventory_id_fkey" FOREIGN KEY (source_inventory_id) REFERENCES business_inventory(id) ON DELETE RESTRICT;
-- @@
ALTER TABLE public."production_plan_lines" ADD CONSTRAINT "production_plan_lines_target_inventory_id_fkey" FOREIGN KEY (target_inventory_id) REFERENCES business_inventory(id) ON DELETE RESTRICT;
-- @@
ALTER TABLE public."production_plans" ADD CONSTRAINT "production_plans_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
-- @@
ALTER TABLE public."receipts" ADD CONSTRAINT "receipts_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
-- @@
ALTER TABLE public."role_definitions" ADD CONSTRAINT "role_definitions_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."service_offerings" ADD CONSTRAINT "service_offerings_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."social_drafts" ADD CONSTRAINT "social_drafts_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id);
-- @@
ALTER TABLE public."social_drafts" ADD CONSTRAINT "social_drafts_platform_fkey" FOREIGN KEY (platform) REFERENCES channels(name) ON UPDATE CASCADE ON DELETE RESTRICT;
-- @@
ALTER TABLE public."vendor_aliases" ADD CONSTRAINT "vendor_aliases_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."vendor_aliases" ADD CONSTRAINT "vendor_aliases_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."vendor_preferences" ADD CONSTRAINT "vendor_preferences_answered_by_fkey" FOREIGN KEY (answered_by) REFERENCES auth.users(id);
-- @@
ALTER TABLE public."vendor_preferences" ADD CONSTRAINT "vendor_preferences_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."vendor_preferences" ADD CONSTRAINT "vendor_preferences_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
-- @@
ALTER TABLE public."vendors" ADD CONSTRAINT "vendors_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- @@
CREATE INDEX audit_log_actor_action_idx ON public.audit_log USING btree (business_id, actor_user_id, action, created_at DESC);
-- @@
CREATE INDEX audit_log_business_created_idx ON public.audit_log USING btree (business_id, created_at DESC);
-- @@
CREATE INDEX business_display_standards_lookup_idx ON public.business_display_standards USING btree (business_id, domain);
-- @@
CREATE UNIQUE INDEX business_inventory_business_qb_item_uidx ON public.business_inventory USING btree (business_id, qb_item_id);
-- @@
CREATE INDEX business_inventory_import_run_idx ON public.business_inventory USING btree (business_id, import_run_id) WHERE (import_run_id IS NOT NULL);
-- @@
CREATE INDEX business_inventory_retired_by_run_idx ON public.business_inventory USING btree (business_id, retired_by_run_id) WHERE (retired_by_run_id IS NOT NULL);
-- @@
CREATE INDEX business_inventory_retired_idx ON public.business_inventory USING btree (business_id, retired_at DESC) WHERE (retired_at IS NOT NULL);
-- @@
CREATE INDEX business_inventory_unit_kind_idx ON public.business_inventory USING btree (business_id, unit_kind);
-- @@
CREATE INDEX business_inventory_variant_group_idx ON public.business_inventory USING btree (business_id, variant_group);
-- @@
CREATE INDEX business_inventory_ledger_aggregate_idx ON public.business_inventory_ledger USING btree (aggregate_type, aggregate_id, occurred_at);
-- @@
CREATE INDEX business_inventory_ledger_business_idx ON public.business_inventory_ledger USING btree (business_id, occurred_at DESC);
-- @@
CREATE INDEX business_inventory_ledger_lot_idx ON public.business_inventory_ledger USING btree (inventory_id, occurred_at);
-- @@
CREATE INDEX business_inventory_ledger_source_idx ON public.business_inventory_ledger USING btree (source_type, source_id);
-- @@
CREATE INDEX business_operating_days_business_idx ON public.business_operating_days USING btree (business_id);
-- @@
CREATE UNIQUE INDEX business_operating_days_exception_uniq ON public.business_operating_days USING btree (business_id, on_date) WHERE (on_date IS NOT NULL);
-- @@
CREATE UNIQUE INDEX business_operating_days_pattern_uniq ON public.business_operating_days USING btree (business_id, weekday) WHERE (weekday IS NOT NULL);
-- @@
CREATE INDEX bpr_position_idx ON public.business_position_responsibilities USING btree (position_id);
-- @@
CREATE UNIQUE INDEX business_positions_title_key ON public.business_positions USING btree (business_id, lower(title));
-- @@
CREATE INDEX container_ladder_business_active_idx ON public.container_ladder USING btree (business_id, active, sort_order);
-- @@
CREATE UNIQUE INDEX container_ladder_business_label_key ON public.container_ladder USING btree (business_id, lower(btrim(label)));
-- @@
CREATE UNIQUE INDEX container_ladder_business_sort_key ON public.container_ladder USING btree (business_id, sort_order);
-- @@
CREATE INDEX idx_cost_object_assignments_asset ON public.cost_object_assignments USING btree (asset_id);
-- @@
CREATE INDEX idx_cost_object_assignments_business ON public.cost_object_assignments USING btree (business_id);
-- @@
CREATE INDEX idx_cost_object_assignments_open ON public.cost_object_assignments USING btree (asset_id) WHERE (end_at IS NULL);
-- @@
CREATE INDEX idx_cost_object_assignments_project ON public.cost_object_assignments USING btree (project_id);
-- @@
CREATE INDEX idx_cost_object_edges_business ON public.cost_object_edges USING btree (business_id);
-- @@
CREATE INDEX idx_cost_object_edges_child ON public.cost_object_edges USING btree (child_id);
-- @@
CREATE INDEX idx_cost_object_edges_parent ON public.cost_object_edges USING btree (parent_id);
-- @@
CREATE INDEX idx_cost_objects_business_nature ON public.cost_objects USING btree (business_id, cost_nature);
-- @@
CREATE INDEX idx_cost_objects_business_node ON public.cost_objects USING btree (business_id, node_type);
-- @@
CREATE INDEX idx_cost_objects_parent ON public.cost_objects USING btree (parent_id);
-- @@
CREATE INDEX idx_plants_tag_id_lower ON public.cultivar_plants USING btree (lower(tag_id));
-- @@
CREATE INDEX customer_addresses_customer_idx ON public.customer_addresses USING btree (business_id, customer_id) WHERE active;
-- @@
CREATE UNIQUE INDEX customer_addresses_one_default ON public.customer_addresses USING btree (business_id, customer_id) WHERE (is_default AND active);
-- @@
CREATE UNIQUE INDEX customer_addresses_one_label ON public.customer_addresses USING btree (business_id, customer_id, lower(label)) WHERE active;
-- @@
CREATE INDEX idx_customer_addresses_import_run ON public.customer_addresses USING btree (business_id, import_run_id) WHERE (import_run_id IS NOT NULL);
-- @@
CREATE INDEX customer_emails_customer_idx ON public.customer_emails USING btree (business_id, customer_id) WHERE active;
-- @@
CREATE UNIQUE INDEX customer_emails_one_per_value ON public.customer_emails USING btree (business_id, customer_id, value_norm) WHERE (active AND (value_norm IS NOT NULL));
-- @@
CREATE UNIQUE INDEX customer_emails_one_primary ON public.customer_emails USING btree (business_id, customer_id) WHERE (is_primary AND active);
-- @@
CREATE INDEX idx_customer_emails_import_run ON public.customer_emails USING btree (business_id, import_run_id) WHERE (import_run_id IS NOT NULL);
-- @@
CREATE INDEX customer_phones_customer_idx ON public.customer_phones USING btree (business_id, customer_id) WHERE active;
-- @@
CREATE UNIQUE INDEX customer_phones_one_per_value ON public.customer_phones USING btree (business_id, customer_id, value_norm) WHERE (active AND (value_norm IS NOT NULL));
-- @@
CREATE UNIQUE INDEX customer_phones_one_primary ON public.customer_phones USING btree (business_id, customer_id) WHERE (is_primary AND active);
-- @@
CREATE INDEX idx_customer_phones_import_run ON public.customer_phones USING btree (business_id, import_run_id) WHERE (import_run_id IS NOT NULL);
-- @@
CREATE UNIQUE INDEX customers_business_qb_customer_uidx ON public.customers USING btree (business_id, qb_customer_id);
-- @@
CREATE INDEX customers_import_run_idx ON public.customers USING btree (business_id, import_run_id) WHERE (import_run_id IS NOT NULL);
-- @@
CREATE INDEX deliveries_business_date_idx ON public.deliveries USING btree (business_id, delivery_date);
-- @@
CREATE UNIQUE INDEX deliveries_business_qb_invoice_uidx ON public.deliveries USING btree (business_id, qb_invoice_id);
-- @@
CREATE INDEX idx_deliveries_date_service ON public.deliveries USING btree (business_id, delivery_date, service_type);
-- @@
CREATE INDEX idx_deliveries_order_id ON public.deliveries USING btree (order_id) WHERE (order_id IS NOT NULL);
-- @@
CREATE INDEX inventory_count_sessions_business_idx ON public.inventory_count_sessions USING btree (business_id, started_at DESC);
-- @@
CREATE INDEX inventory_counts_business_idx ON public.inventory_counts USING btree (business_id, counted_at DESC);
-- @@
CREATE INDEX inventory_counts_session_idx ON public.inventory_counts USING btree (session_id);
-- @@
CREATE INDEX idx_labor_resource_wages_business ON public.labor_resource_wages USING btree (business_id);
-- @@
CREATE INDEX idx_labor_resources_business ON public.labor_resources USING btree (business_id);
-- @@
CREATE INDEX idx_losses_nursery ON public.losses USING btree (nursery_id, occurred_at DESC);
-- @@
CREATE INDEX member_device_handoffs_business_idx ON public.member_device_handoffs USING btree (business_id);
-- @@
CREATE UNIQUE INDEX member_devices_credential_id_key ON public.member_devices USING btree (credential_id) WHERE (credential_id IS NOT NULL);
-- @@
CREATE INDEX idx_order_addons_order ON public.order_addons USING btree (order_id);
-- @@
CREATE INDEX compliance_records_business_idx ON public.order_compliance_records USING btree (business_id, created_at DESC);
-- @@
CREATE INDEX compliance_records_order_idx ON public.order_compliance_records USING btree (order_id);
-- @@
CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);
-- @@
CREATE INDEX idx_orders_import_run ON public.orders USING btree (business_id, import_run_id) WHERE (import_run_id IS NOT NULL);
-- @@
CREATE INDEX idx_orders_kind ON public.orders USING btree (business_id, order_kind) WHERE (order_kind IS NOT NULL);
-- @@
CREATE INDEX idx_orders_receipt_id ON public.orders USING btree (receipt_id) WHERE (receipt_id IS NOT NULL);
-- @@
CREATE INDEX idx_orders_sale_date ON public.orders USING btree (business_id, sale_date);
-- @@
CREATE UNIQUE INDEX uidx_orders_business_qb_invoice ON public.orders USING btree (business_id, qb_invoice_id);
-- @@
CREATE INDEX people_email_idx ON public.people USING btree (email) WHERE (auth_user_id IS NULL);
-- @@
CREATE INDEX people_phone_idx ON public.people USING btree (phone) WHERE (auth_user_id IS NULL);
-- @@
CREATE INDEX idx_permission_aliases_from ON public.permission_aliases USING btree (from_perm);
-- @@
CREATE UNIQUE INDEX permission_aliases_legacy_is_rename_only ON public.permission_aliases USING btree (from_perm) WHERE (from_perm !~~ '%:%'::text);
-- @@
CREATE INDEX idx_plant_events_plant ON public.plant_events USING btree (plant_id);
-- @@
CREATE INDEX idx_plant_events_timeline ON public.plant_events USING btree (plant_id, occurred_at);
-- @@
CREATE INDEX production_plan_lines_plan_idx ON public.production_plan_lines USING btree (plan_id);
-- @@
CREATE INDEX production_plan_lines_source_idx ON public.production_plan_lines USING btree (business_id, source_inventory_id);
-- @@
CREATE INDEX production_plans_business_status_idx ON public.production_plans USING btree (business_id, status);
-- @@
CREATE INDEX receipts_vendor_id_idx ON public.receipts USING btree (vendor_id);
-- @@
CREATE UNIQUE INDEX role_definitions_floor_key ON public.role_definitions USING btree (role_key) WHERE (business_id IS NULL);
-- @@
CREATE UNIQUE INDEX role_definitions_tenant_key ON public.role_definitions USING btree (business_id, role_key) WHERE (business_id IS NOT NULL);
-- @@
CREATE UNIQUE INDEX vendor_aliases_business_alias_uidx ON public.vendor_aliases USING btree (business_id, lower(btrim(alias)));
-- @@
CREATE INDEX vendor_aliases_vendor_idx ON public.vendor_aliases USING btree (vendor_id);
-- @@
CREATE UNIQUE INDEX vendor_preferences_one_per_vendor_kind_uidx ON public.vendor_preferences USING btree (business_id, vendor_key, preference_kind);
-- @@
CREATE INDEX vendor_preferences_vendor_id_idx ON public.vendor_preferences USING btree (vendor_id);
-- @@
CREATE UNIQUE INDEX vendors_business_name_uidx ON public.vendors USING btree (business_id, lower(btrim(name)));
-- @@
CREATE INDEX vendors_business_preferred_idx ON public.vendors USING btree (business_id, preferred);
-- @@
CREATE VIEW public."vendor_preferences_resolved" AS SELECT vp.id,
    vp.business_id,
    vp.vendor_key,
    vp.vendor_label,
    vp.preference_kind,
    vp.preference_value,
    vp.preferred,
    vp.preference_note,
    vp.answered_by,
    vp.answered_at,
    vp.created_at,
    vp.updated_at,
    vp.vendor_id,
    v.id AS resolved_vendor_id,
    v.name AS resolved_vendor_name,
    v.preferred AS vendor_is_preferred,
    vp.vendor_id IS NOT NULL AS joined_by_id
   FROM vendor_preferences vp
     LEFT JOIN vendors v ON v.business_id = vp.business_id AND (vp.vendor_id IS NOT NULL AND v.id = vp.vendor_id OR vp.vendor_id IS NULL AND lower(btrim(v.name)) = lower(btrim(vp.vendor_label)));
-- @@
CREATE TRIGGER trg_audit_log_immutable BEFORE DELETE OR UPDATE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();
-- @@
CREATE TRIGGER trg_audit_log_no_truncate BEFORE TRUNCATE ON public.audit_log FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_log_mutation();
-- @@
CREATE TRIGGER business_accounting_secrets_updated_at BEFORE UPDATE ON public.business_accounting_secrets FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER business_context_updated_at BEFORE UPDATE ON public.business_context FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER business_discovery_profiles_updated_at BEFORE UPDATE ON public.business_discovery_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER business_inventory_unit_projection BEFORE INSERT OR UPDATE ON public.business_inventory FOR EACH ROW EXECUTE FUNCTION business_inventory_unit_projection_guard();
-- @@
CREATE TRIGGER business_inventory_updated_at BEFORE UPDATE ON public.business_inventory FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER trg_inventory_ledger_immutable BEFORE DELETE OR UPDATE ON public.business_inventory_ledger FOR EACH ROW EXECUTE FUNCTION reject_inventory_ledger_mutation();
-- @@
CREATE TRIGGER trg_ledger_test_mode_guard BEFORE INSERT ON public.business_inventory_ledger FOR EACH ROW EXECUTE FUNCTION discard_ledger_row_in_test_mode();
-- @@
CREATE TRIGGER trg_business_members_authority_guard BEFORE UPDATE ON public.business_members FOR EACH ROW EXECUTE FUNCTION enforce_member_authority_immutability();
-- @@
CREATE TRIGGER trg_business_members_updated_at BEFORE UPDATE ON public.business_members FOR EACH ROW EXECUTE FUNCTION set_business_members_updated_at();
-- @@
CREATE TRIGGER business_modules_advert_channels_known BEFORE INSERT OR UPDATE OF config ON public.business_modules FOR EACH ROW EXECUTE FUNCTION channels_validate_advert_channels();
-- @@
CREATE TRIGGER business_modules_updated_at BEFORE UPDATE ON public.business_modules FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER business_operating_days_updated_at BEFORE UPDATE ON public.business_operating_days FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER business_operations_config_updated_at BEFORE UPDATE ON public.business_operations_config FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER business_pmi_schedule_updated_at BEFORE UPDATE ON public.business_pmi_schedule FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER business_positions_updated_at BEFORE UPDATE ON public.business_positions FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER business_pricing_config_updated_at BEFORE UPDATE ON public.business_pricing_config FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER container_ladder_set_updated_at BEFORE UPDATE ON public.container_ladder FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- @@
CREATE TRIGGER cost_object_assignments_updated_at BEFORE UPDATE ON public.cost_object_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER cost_object_edges_updated_at BEFORE UPDATE ON public.cost_object_edges FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER cost_objects_updated_at BEFORE UPDATE ON public.cost_objects FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER plants_updated_at BEFORE UPDATE ON public.cultivar_plants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- @@
CREATE TRIGGER trg_customer_addresses_sync AFTER INSERT OR DELETE OR UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION trg_sync_customer_flat_contact();
-- @@
CREATE TRIGGER trg_customer_addresses_updated_at BEFORE UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER trg_customer_emails_normalize BEFORE INSERT OR UPDATE ON public.customer_emails FOR EACH ROW EXECUTE FUNCTION normalize_contact_value();
-- @@
CREATE TRIGGER trg_customer_emails_sync AFTER INSERT OR DELETE OR UPDATE ON public.customer_emails FOR EACH ROW EXECUTE FUNCTION trg_sync_customer_flat_contact();
-- @@
CREATE TRIGGER trg_customer_phones_normalize BEFORE INSERT OR UPDATE ON public.customer_phones FOR EACH ROW EXECUTE FUNCTION normalize_contact_value();
-- @@
CREATE TRIGGER trg_customer_phones_sync AFTER INSERT OR DELETE OR UPDATE ON public.customer_phones FOR EACH ROW EXECUTE FUNCTION trg_sync_customer_flat_contact();
-- @@
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER trg_customers_derived_contact_guard BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION guard_customer_derived_contact();
-- @@
CREATE TRIGGER inventory_count_sessions_updated_at BEFORE UPDATE ON public.inventory_count_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER labor_resource_wages_updated_at BEFORE UPDATE ON public.labor_resource_wages FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER labor_resources_updated_at BEFORE UPDATE ON public.labor_resources FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER trg_people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION set_people_updated_at();
-- @@
CREATE TRIGGER production_plan_lines_updated_at BEFORE UPDATE ON public.production_plan_lines FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER production_plans_updated_at BEFORE UPDATE ON public.production_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER receipts_updated_at BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER trg_receipts_snapshot_and_line_guard BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION guard_receipt_snapshot_and_lines();
-- @@
CREATE TRIGGER trg_role_definitions_updated_at BEFORE UPDATE ON public.role_definitions FOR EACH ROW EXECUTE FUNCTION set_role_definitions_updated_at();
-- @@
CREATE TRIGGER vendor_preferences_updated_at BEFORE UPDATE ON public.vendor_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
CREATE TRIGGER vendors_preference_owner_only BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION enforce_vendor_preference_is_owner_only();
-- @@
CREATE TRIGGER vendors_preference_owner_only_insert BEFORE INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION enforce_vendor_preference_on_insert();
-- @@
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
-- @@
ALTER TABLE public."addons" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."audit_log" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_accounting_secrets" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_context" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_discovery_profiles" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_display_standards" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_inventory" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_inventory_ledger" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_members" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_modules" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_operating_days" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_operations_config" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_pmi_schedule" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_position_responsibilities" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_positions" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_pricing_config" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_service_log" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."business_voice_samples" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."businesses" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."campaign_posts" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."campaigns" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."channels" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."container_ladder" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."cost_object_assignments" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."cost_object_edges" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."cost_objects" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."cultivar_plants" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."customer_addresses" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."customer_emails" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."customer_phones" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."customers" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."deliveries" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."inventory_count_sessions" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."inventory_counts" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."invitations" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."labor_resource_wages" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."labor_resources" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."losses" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."member_device_handoffs" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."member_devices" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."modules" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."nurseries" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."nursery_profiles" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."opportunity_items" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."order_addons" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."order_compliance_records" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."order_items" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."order_service_selections" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."orders" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."people" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."permission_aliases" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."plant_events" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."platform_config" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."production_plan_lines" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."production_plans" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."receipts" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."role_definitions" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."service_offerings" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."social_drafts" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."vendor_aliases" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."vendor_preferences" ENABLE ROW LEVEL SECURITY;
-- @@
ALTER TABLE public."vendors" ENABLE ROW LEVEL SECURITY;
-- @@
CREATE POLICY "addons_business_owner" ON public."addons" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'service_offerings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'service_offerings:update'::text)));
-- @@
CREATE POLICY "addons_select_public" ON public."addons" AS PERMISSIVE FOR SELECT TO public USING (true);
-- @@
CREATE POLICY "anon_select_addons" ON public."addons" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
-- @@
CREATE POLICY "audit_insert" ON public."audit_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((((business_id IN ( SELECT businesses.id
   FROM businesses
  WHERE (businesses.owner_id = auth.uid()))) OR is_active_member(business_id)) AND ((actor_user_id IS NULL) OR (actor_user_id = auth.uid()))));
-- @@
CREATE POLICY "audit_owner_read" ON public."audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'audit_log:read'::text)));
-- @@
CREATE POLICY "bas_owner_all" ON public."business_accounting_secrets" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'accounting:connect'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'accounting:connect'::text)));
-- @@
CREATE POLICY "business_context_member_read" ON public."business_context" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_active_member(business_id));
-- @@
CREATE POLICY "business_context_settings_write" ON public."business_context" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "business_discovery_profiles_member_all" ON public."business_discovery_profiles" AS PERMISSIVE FOR ALL TO public USING (is_active_member(business_id)) WITH CHECK (is_active_member(business_id));
-- @@
CREATE POLICY "business_discovery_profiles_owner_all" ON public."business_discovery_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "business_display_standards_member_all" ON public."business_display_standards" AS PERMISSIVE FOR ALL TO "authenticated" USING (is_active_member(business_id)) WITH CHECK (is_active_member(business_id));
-- @@
CREATE POLICY "business_display_standards_owner_all" ON public."business_display_standards" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "business_inventory_member_delete" ON public."business_inventory" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:delete'::text)));
-- @@
CREATE POLICY "business_inventory_member_insert" ON public."business_inventory" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory:create'::text)));
-- @@
CREATE POLICY "business_inventory_member_select" ON public."business_inventory" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:read'::text)));
-- @@
CREATE POLICY "business_inventory_member_update" ON public."business_inventory" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text)));
-- @@
CREATE POLICY "business_inventory_ledger_member_all" ON public."business_inventory_ledger" AS PERMISSIVE FOR ALL TO public USING (is_active_member(business_id)) WITH CHECK (is_active_member(business_id));
-- @@
CREATE POLICY "business_inventory_ledger_owner_all" ON public."business_inventory_ledger" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory_ledger:read'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory_ledger:read'::text)));
-- @@
CREATE POLICY "bm_member_select" ON public."business_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'team:read'::text)));
-- @@
CREATE POLICY "bm_owner_all" ON public."business_members" AS PERMISSIVE FOR ALL TO public USING ((business_id IN ( SELECT businesses.id
   FROM businesses
  WHERE (businesses.owner_id = auth.uid()))));
-- @@
CREATE POLICY "bm_self_select" ON public."business_members" AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
-- @@
CREATE POLICY "bm_self_update" ON public."business_members" AS PERMISSIVE FOR UPDATE TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
-- @@
CREATE POLICY "business_modules_member_select" ON public."business_modules" AS PERMISSIVE FOR SELECT TO public USING (is_active_member(business_id));
-- @@
CREATE POLICY "business_operating_days_member_delete" ON public."business_operating_days" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "business_operating_days_member_insert" ON public."business_operating_days" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "business_operating_days_member_select" ON public."business_operating_days" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_active_member(business_id));
-- @@
CREATE POLICY "business_operating_days_member_update" ON public."business_operating_days" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "business_operations_config_member_insert" ON public."business_operations_config" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "business_operations_config_member_select" ON public."business_operations_config" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:read'::text)));
-- @@
CREATE POLICY "business_operations_config_member_update" ON public."business_operations_config" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "business_operations_config_owner_all" ON public."business_operations_config" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = business_operations_config.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = business_operations_config.business_id) AND (b.owner_id = auth.uid())))));
-- @@
CREATE POLICY "business_pmi_schedule_member_all" ON public."business_pmi_schedule" AS PERMISSIVE FOR ALL TO public USING (is_active_member(business_id)) WITH CHECK (is_active_member(business_id));
-- @@
CREATE POLICY "business_pmi_schedule_owner_all" ON public."business_pmi_schedule" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'pmi:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'pmi:update'::text)));
-- @@
CREATE POLICY "bpr_member_read" ON public."business_position_responsibilities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_active_member(business_id));
-- @@
CREATE POLICY "bpr_settings_write" ON public."business_position_responsibilities" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "business_positions_member_read" ON public."business_positions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_active_member(business_id));
-- @@
CREATE POLICY "business_positions_settings_write" ON public."business_positions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "bpc_member_select" ON public."business_pricing_config" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'pricing_recipe:read'::text)));
-- @@
CREATE POLICY "bpc_member_update" ON public."business_pricing_config" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'pricing_recipe:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'pricing_recipe:update'::text)));
-- @@
CREATE POLICY "bpc_owner_insert" ON public."business_pricing_config" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = business_pricing_config.business_id) AND (b.owner_id = auth.uid())))));
-- @@
CREATE POLICY "business_service_log_member_insert" ON public."business_service_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'pmi:update'::text)));
-- @@
CREATE POLICY "business_service_log_member_select" ON public."business_service_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'pmi:read'::text)));
-- @@
CREATE POLICY "business_service_log_member_update" ON public."business_service_log" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'pmi:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'pmi:update'::text)));
-- @@
CREATE POLICY "business_service_log_owner_all" ON public."business_service_log" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'pmi:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'pmi:update'::text)));
-- @@
CREATE POLICY "business_voice_samples_owner" ON public."business_voice_samples" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text)));
-- @@
CREATE POLICY "businesses_member_select" ON public."businesses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_active_member(id));
-- @@
CREATE POLICY "businesses_owner_insert" ON public."businesses" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((owner_id = auth.uid()));
-- @@
CREATE POLICY "businesses_owner_select" ON public."businesses" AS PERMISSIVE FOR SELECT TO public USING ((owner_id = auth.uid()));
-- @@
CREATE POLICY "businesses_owner_update" ON public."businesses" AS PERMISSIVE FOR UPDATE TO public USING ((owner_id = auth.uid()));
-- @@
CREATE POLICY "campaign_posts_member_insert" ON public."campaign_posts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text)));
-- @@
CREATE POLICY "campaign_posts_member_select" ON public."campaign_posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:read'::text)));
-- @@
CREATE POLICY "campaign_posts_member_update" ON public."campaign_posts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text)));
-- @@
CREATE POLICY "campaign_posts_owner" ON public."campaign_posts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text)));
-- @@
CREATE POLICY "campaigns_member_insert" ON public."campaigns" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text)));
-- @@
CREATE POLICY "campaigns_member_select" ON public."campaigns" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:read'::text)));
-- @@
CREATE POLICY "campaigns_member_update" ON public."campaigns" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text)));
-- @@
CREATE POLICY "campaigns_owner" ON public."campaigns" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text)));
-- @@
CREATE POLICY "channels_authenticated_select" ON public."channels" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
-- @@
CREATE POLICY "container_ladder_member_select" ON public."container_ladder" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_active_member(business_id));
-- @@
CREATE POLICY "container_ladder_settings_insert" ON public."container_ladder" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "container_ladder_settings_update" ON public."container_ladder" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "cost_object_assignments_member_delete" ON public."cost_object_assignments" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:delete'::text)));
-- @@
CREATE POLICY "cost_object_assignments_member_insert" ON public."cost_object_assignments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:create'::text)));
-- @@
CREATE POLICY "cost_object_assignments_member_select" ON public."cost_object_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:read'::text)));
-- @@
CREATE POLICY "cost_object_assignments_member_update" ON public."cost_object_assignments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text)));
-- @@
CREATE POLICY "cost_object_edges_member_delete" ON public."cost_object_edges" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:delete'::text)));
-- @@
CREATE POLICY "cost_object_edges_member_insert" ON public."cost_object_edges" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:create'::text)));
-- @@
CREATE POLICY "cost_object_edges_member_select" ON public."cost_object_edges" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:read'::text)));
-- @@
CREATE POLICY "cost_object_edges_member_update" ON public."cost_object_edges" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text)));
-- @@
CREATE POLICY "cost_objects_member_delete" ON public."cost_objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:delete'::text)));
-- @@
CREATE POLICY "cost_objects_member_insert" ON public."cost_objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:create'::text)));
-- @@
CREATE POLICY "cost_objects_member_select" ON public."cost_objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:read'::text)));
-- @@
CREATE POLICY "cost_objects_member_update" ON public."cost_objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text)));
-- @@
CREATE POLICY "anon_select_plants" ON public."cultivar_plants" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
-- @@
CREATE POLICY "cultivar_plants_member_delete" ON public."cultivar_plants" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:delete'::text)));
-- @@
CREATE POLICY "cultivar_plants_member_insert" ON public."cultivar_plants" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory:create'::text)));
-- @@
CREATE POLICY "cultivar_plants_member_update" ON public."cultivar_plants" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text)));
-- @@
CREATE POLICY "cultivar_plants_owner_select" ON public."cultivar_plants" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:read'::text)));
-- @@
CREATE POLICY "customer_addresses_member_insert" ON public."customer_addresses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'customers:create'::text)));
-- @@
CREATE POLICY "customer_addresses_member_select" ON public."customer_addresses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'customers:read'::text)));
-- @@
CREATE POLICY "customer_addresses_member_update" ON public."customer_addresses" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'customers:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'customers:update'::text)));
-- @@
CREATE POLICY "customer_emails_member_insert" ON public."customer_emails" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'customers:create'::text)));
-- @@
CREATE POLICY "customer_emails_member_select" ON public."customer_emails" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'customers:read'::text)));
-- @@
CREATE POLICY "customer_emails_member_update" ON public."customer_emails" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'customers:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'customers:update'::text)));
-- @@
CREATE POLICY "customer_phones_member_insert" ON public."customer_phones" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'customers:create'::text)));
-- @@
CREATE POLICY "customer_phones_member_select" ON public."customer_phones" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'customers:read'::text)));
-- @@
CREATE POLICY "customer_phones_member_update" ON public."customer_phones" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'customers:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'customers:update'::text)));
-- @@
CREATE POLICY "customers_business_owner" ON public."customers" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'customers:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'customers:update'::text)));
-- @@
CREATE POLICY "customers_member_insert" ON public."customers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'customers:create'::text)));
-- @@
CREATE POLICY "customers_member_select" ON public."customers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'customers:read'::text)));
-- @@
CREATE POLICY "customers_member_update" ON public."customers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'customers:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'customers:update'::text)));
-- @@
CREATE POLICY "deliveries_member_delete" ON public."deliveries" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'deliveries:update'::text)));
-- @@
CREATE POLICY "deliveries_member_insert" ON public."deliveries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'deliveries:create'::text)));
-- @@
CREATE POLICY "deliveries_member_select" ON public."deliveries" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'deliveries:read'::text)));
-- @@
CREATE POLICY "deliveries_member_update" ON public."deliveries" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'deliveries:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'deliveries:update'::text)));
-- @@
CREATE POLICY "inventory_count_sessions_member_all" ON public."inventory_count_sessions" AS PERMISSIVE FOR ALL TO public USING (is_active_member(business_id)) WITH CHECK (is_active_member(business_id));
-- @@
CREATE POLICY "inventory_count_sessions_owner_all" ON public."inventory_count_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text)));
-- @@
CREATE POLICY "inventory_counts_member_all" ON public."inventory_counts" AS PERMISSIVE FOR ALL TO public USING (is_active_member(business_id)) WITH CHECK (is_active_member(business_id));
-- @@
CREATE POLICY "inventory_counts_owner_all" ON public."inventory_counts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text)));
-- @@
CREATE POLICY "inv_owner_all" ON public."invitations" AS PERMISSIVE FOR ALL TO public USING ((business_id IN ( SELECT businesses.id
   FROM businesses
  WHERE (businesses.owner_id = auth.uid()))));
-- @@
CREATE POLICY "invitations_member_select" ON public."invitations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'team:create'::text)));
-- @@
CREATE POLICY "invitations_member_update" ON public."invitations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'team:create'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'team:create'::text)));
-- @@
CREATE POLICY "lrw_member_delete" ON public."labor_resource_wages" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'wages:delete'::text)));
-- @@
CREATE POLICY "lrw_member_insert" ON public."labor_resource_wages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'wages:create'::text)));
-- @@
CREATE POLICY "lrw_member_select" ON public."labor_resource_wages" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'wages:read'::text)));
-- @@
CREATE POLICY "lrw_member_update" ON public."labor_resource_wages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'wages:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'wages:update'::text)));
-- @@
CREATE POLICY "labor_resources_member_delete" ON public."labor_resources" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'wages:delete'::text)));
-- @@
CREATE POLICY "labor_resources_member_insert" ON public."labor_resources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'wages:create'::text)));
-- @@
CREATE POLICY "labor_resources_member_select" ON public."labor_resources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'wages:read'::text)));
-- @@
CREATE POLICY "labor_resources_member_update" ON public."labor_resources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'wages:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'wages:update'::text)));
-- @@
CREATE POLICY "losses_all_owner" ON public."losses" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM nurseries n
  WHERE ((n.id = losses.nursery_id) AND (n.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM nurseries n
  WHERE ((n.id = losses.nursery_id) AND (n.owner_id = auth.uid())))));
-- @@
CREATE POLICY "mdh_owner_all" ON public."member_device_handoffs" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'devices:manage'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'devices:manage'::text)));
-- @@
CREATE POLICY "mdh_self_insert" ON public."member_device_handoffs" AS PERMISSIVE FOR INSERT TO public WITH CHECK (((issued_by = auth.uid()) AND (member_id IN ( SELECT business_members.id
   FROM business_members
  WHERE ((business_members.user_id = auth.uid()) AND (business_members.business_id = member_device_handoffs.business_id) AND (business_members.active = true))))));
-- @@
CREATE POLICY "mdh_self_select" ON public."member_device_handoffs" AS PERMISSIVE FOR SELECT TO public USING ((issued_by = auth.uid()));
-- @@
CREATE POLICY "md_owner_all" ON public."member_devices" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'devices:manage'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'devices:manage'::text)));
-- @@
CREATE POLICY "md_self" ON public."member_devices" AS PERMISSIVE FOR ALL TO public USING ((member_id IN ( SELECT business_members.id
   FROM business_members
  WHERE ((business_members.user_id = auth.uid()) AND (business_members.active = true)))));
-- @@
CREATE POLICY "authenticated_select_modules" ON public."modules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
-- @@
CREATE POLICY "modules readable by authenticated users" ON public."modules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
-- @@
CREATE POLICY "authenticated_select_nurseries" ON public."nurseries" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((owner_id = auth.uid()));
-- @@
CREATE POLICY "nurseries_select_public" ON public."nurseries" AS PERMISSIVE FOR SELECT TO public USING (true);
-- @@
CREATE POLICY "nurseries_update_owner" ON public."nurseries" AS PERMISSIVE FOR UPDATE TO public USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
-- @@
CREATE POLICY "nursery_profiles_member_select" ON public."nursery_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:read'::text)));
-- @@
CREATE POLICY "nursery_profiles_owner" ON public."nursery_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'settings:update'::text)));
-- @@
CREATE POLICY "opportunity_items_owner" ON public."opportunity_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'service_offerings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'service_offerings:update'::text)));
-- @@
CREATE POLICY "order_addons_owner" ON public."order_addons" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_addons.order_id) AND is_active_member(o.business_id) AND has_permission(o.business_id, 'order_items:update'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_addons.order_id) AND is_active_member(o.business_id) AND has_permission(o.business_id, 'order_items:update'::text)))));
-- @@
CREATE POLICY "order_compliance_records_member" ON public."order_compliance_records" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'order_compliance_records:read'::text)));
-- @@
CREATE POLICY "order_items_member" ON public."order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((order_id IN ( SELECT o.id
   FROM orders o
  WHERE (is_active_member(o.business_id) AND has_permission(o.business_id, 'order_items:read'::text)))));
-- @@
CREATE POLICY "order_items_owner" ON public."order_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND is_active_member(o.business_id) AND has_permission(o.business_id, 'order_items:update'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND is_active_member(o.business_id) AND has_permission(o.business_id, 'order_items:update'::text)))));
-- @@
CREATE POLICY "order_service_selections_member" ON public."order_service_selections" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((order_id IN ( SELECT o.id
   FROM orders o
  WHERE (is_active_member(o.business_id) AND has_permission(o.business_id, 'order_service_selections:read'::text)))));
-- @@
CREATE POLICY "order_service_selections_owner" ON public."order_service_selections" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_service_selections.order_id) AND is_active_member(o.business_id) AND has_permission(o.business_id, 'order_service_selections:update'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_service_selections.order_id) AND is_active_member(o.business_id) AND has_permission(o.business_id, 'order_service_selections:update'::text)))));
-- @@
CREATE POLICY "orders_member_select" ON public."orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'orders:read'::text)));
-- @@
CREATE POLICY "people_self_all" ON public."people" AS PERMISSIVE FOR ALL TO "authenticated" USING ((auth_user_id = auth.uid())) WITH CHECK ((auth_user_id = auth.uid()));
-- @@
CREATE POLICY "plant_events_business_owner" ON public."plant_events" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text)));
-- @@
CREATE POLICY "production_plan_lines_member_insert" ON public."production_plan_lines" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory:create'::text)));
-- @@
CREATE POLICY "production_plan_lines_member_select" ON public."production_plan_lines" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:read'::text)));
-- @@
CREATE POLICY "production_plan_lines_member_update" ON public."production_plan_lines" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text)));
-- @@
CREATE POLICY "production_plan_lines_owner_all" ON public."production_plan_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = production_plan_lines.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = production_plan_lines.business_id) AND (b.owner_id = auth.uid())))));
-- @@
CREATE POLICY "production_plans_member_insert" ON public."production_plans" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory:create'::text)));
-- @@
CREATE POLICY "production_plans_member_select" ON public."production_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:read'::text)));
-- @@
CREATE POLICY "production_plans_member_update" ON public."production_plans" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'inventory:update'::text)));
-- @@
CREATE POLICY "production_plans_owner_all" ON public."production_plans" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = production_plans.business_id) AND (b.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM businesses b
  WHERE ((b.id = production_plans.business_id) AND (b.owner_id = auth.uid())))));
-- @@
CREATE POLICY "receipts_member_delete" ON public."receipts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:delete'::text)));
-- @@
CREATE POLICY "receipts_member_insert" ON public."receipts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:create'::text)));
-- @@
CREATE POLICY "receipts_member_select" ON public."receipts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:read'::text)));
-- @@
CREATE POLICY "receipts_member_update" ON public."receipts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text)));
-- @@
CREATE POLICY "rd_owner_write" ON public."role_definitions" AS PERMISSIVE FOR ALL TO "authenticated" USING (((business_id IS NOT NULL) AND (business_id IN ( SELECT businesses.id
   FROM businesses
  WHERE (businesses.owner_id = auth.uid()))))) WITH CHECK (((business_id IS NOT NULL) AND (business_id IN ( SELECT businesses.id
   FROM businesses
  WHERE (businesses.owner_id = auth.uid())))));
-- @@
CREATE POLICY "rd_read" ON public."role_definitions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((business_id IS NULL) OR is_active_member(business_id)));
-- @@
CREATE POLICY "service_offerings_member" ON public."service_offerings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'service_offerings:read'::text)));
-- @@
CREATE POLICY "service_offerings_member_insert" ON public."service_offerings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'service_offerings:create'::text)));
-- @@
CREATE POLICY "service_offerings_member_update" ON public."service_offerings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'service_offerings:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'service_offerings:update'::text)));
-- @@
CREATE POLICY "service_offerings_owner" ON public."service_offerings" AS PERMISSIVE FOR ALL TO public USING ((business_id IN ( SELECT businesses.id
   FROM businesses
  WHERE (businesses.owner_id = auth.uid()))));
-- @@
CREATE POLICY "social_drafts_business_owner" ON public."social_drafts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text)));
-- @@
CREATE POLICY "social_drafts_member_select" ON public."social_drafts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text)));
-- @@
CREATE POLICY "social_drafts_member_update" ON public."social_drafts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'campaigns:update'::text)));
-- @@
CREATE POLICY "vendor_aliases_member_insert" ON public."vendor_aliases" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM business_members
  WHERE ((business_members.business_id = vendor_aliases.business_id) AND (business_members.user_id = auth.uid()) AND (business_members.active = true)))));
-- @@
CREATE POLICY "vendor_aliases_member_select" ON public."vendor_aliases" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM business_members
  WHERE ((business_members.business_id = vendor_aliases.business_id) AND (business_members.user_id = auth.uid()) AND (business_members.active = true)))));
-- @@
CREATE POLICY "vendor_aliases_owner_all" ON public."vendor_aliases" AS PERMISSIVE FOR ALL TO public USING (is_business_owner(business_id)) WITH CHECK (is_business_owner(business_id));
-- @@
CREATE POLICY "vendor_preferences_member_insert" ON public."vendor_preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text)));
-- @@
CREATE POLICY "vendor_preferences_member_select" ON public."vendor_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:read'::text)));
-- @@
CREATE POLICY "vendor_preferences_member_update" ON public."vendor_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text)));
-- @@
CREATE POLICY "vendor_preferences_owner_all" ON public."vendor_preferences" AS PERMISSIVE FOR ALL TO "authenticated" USING ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text))) WITH CHECK ((is_active_member(business_id) AND has_permission(business_id, 'costs:update'::text)));
-- @@
CREATE POLICY "vendors_member_insert" ON public."vendors" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM business_members
  WHERE ((business_members.business_id = vendors.business_id) AND (business_members.user_id = auth.uid()) AND (business_members.active = true)))));
-- @@
CREATE POLICY "vendors_member_select" ON public."vendors" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM business_members
  WHERE ((business_members.business_id = vendors.business_id) AND (business_members.user_id = auth.uid()) AND (business_members.active = true)))));
-- @@
CREATE POLICY "vendors_member_update" ON public."vendors" AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM business_members
  WHERE ((business_members.business_id = vendors.business_id) AND (business_members.user_id = auth.uid()) AND (business_members.active = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM business_members
  WHERE ((business_members.business_id = vendors.business_id) AND (business_members.user_id = auth.uid()) AND (business_members.active = true)))));
-- @@
CREATE POLICY "vendors_owner_all" ON public."vendors" AS PERMISSIVE FOR ALL TO public USING (is_business_owner(business_id)) WITH CHECK (is_business_owner(business_id));
-- @@
RESET check_function_bodies;
