-- Migration: customers → complete standard PARTY RECORD (entity-completeness, ONE pass)
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-07-13
-- Branch: main
-- Apply: in the Supabase SQL editor AS the default `postgres` role. GATED — David applies +
--        runs the verification block below BEFORE the reader/editor code is owner-proven.
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- WHY: bring `customers` to the complete industry-standard party/customer record in ONE additive
-- migration, so fields stop being added reactively one at a time (customer_type 20260702, tax_exempt
-- trio 20260713 were each a reactive single-field ADD). This is ENTITY-COMPLETENESS, not a feature.
-- Also closes the D-40 owner-prove blocker: with tax_id + tax_exempt_expires present the tax set
-- becomes fully UI-editable (exemption was settable only via SQL until the paired UI ships).
--
-- ── ADDRESS MODEL (approved L1) ─────────────────────────────────────────────────
-- BILLING address = stable COLUMNS on the customer (a customer has ONE billing address).
-- SHIPPING is deliberately NOT on the customer record — a customer does not "have a shipping
-- address"; an ORDER does. Ship-to is entered per-order and snapshotted onto the delivery row
-- (`deliveries` already carries its own address_line1/city/state/zip — 20260620). That stays the
-- mechanism. NO shipping_* columns here. The saved ship-to address book (a customer_addresses
-- table an order-time picker reads) is the L2 hook — a DEFERRED follow-up, NOT built. L1→L2 is
-- additive (adding the table later touches nothing here).
--
-- The existing UNPREFIXED address_line1/city/state/zip are LEFT UNTOUCHED this pass; a later
-- cleanup decides whether they fold into billing_* (flagged follow-up (b)). No data destruction.
--
-- ── RLS-INTACT (AC-3) ───────────────────────────────────────────────────────────
-- ADD COLUMN only (+ ONE reused updated-at trigger). ALTERS NO policy/function's existing body.
-- customers RLS is unchanged: customers_business_owner (owner FOR ALL) + customers_member
-- (is_active_member AND has_permission('view_customers'), 20260710). The new PII columns (tax_id,
-- credit_limit, billing address) inherit this tenant-scoped RLS — no new policy (D-40 migration is
-- the precedent). BENCH-C (PII) rides STD-004 isolation; value-masking of tax_id/credit_limit in
-- diagnostics is enforced in the app-layer [TRACE:customers] trace, not here.
--
-- ── AC-1 (coded values are DATA, not schema) ────────────────────────────────────
-- payment_terms + status are string VALUES with NO CHECK constraint (value-sets grow as data —
-- mirrors the customer_type 20260702 and price_tier 20260625 precedent). No enum baked in schema.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS · CREATE TRIGGER guarded by a DROP IF EXISTS.

-- ── IDENTITY ────────────────────────────────────────────────────────────────────
-- organization_name: the org's legal name. Orgs are currently stuffed whole into first_name
-- (customer_type='organization', last_name=''); this gives them their own field. NOT backfilled
-- this pass — the "Cedar Park HOA out of first_name" cleanup is a SEPARATE data pass (follow-up a).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS organization_name text;
-- display_name: the name to show on an invoice / receipt (overrides the first/last or org default).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS display_name text;

-- ── BILLING ADDRESS (L1 — columns; unprefixed address_* left untouched) ──────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_line1 text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_line2 text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_city  text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_state text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_zip   text;

-- ── TAX (tax_exempt / tax_exempt_reason / tax_exempt_cert_ref already exist — D-40 20260713) ──
-- tax_id: EIN / resale / tax-registration number. PII — value-masked in diagnostics (BENCH-C).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id text;
-- tax_exempt_expires: certificates lapse — the date this exemption cert stops being valid.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_exempt_expires date;
-- tax_exempt_cert_doc_url: SLOT ONLY for the on-file cert document. Populating it rides the
-- STD-010 file-upload/ingest pattern (Receipt Keeper) as a SEPARATE build (follow-up c) — the
-- column is the hook; NO ingest is built here.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_exempt_cert_doc_url text;

-- ── COMMERCIAL TERMS ────────────────────────────────────────────────────────────
-- payment_terms: string VALUE (e.g. 'net_30','due_on_receipt') — AC-1, NO CHECK.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms text;
-- credit_limit: money — PII-adjacent, value-masked in diagnostics (BENCH-C).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit numeric(12,2);

-- ── LIFECYCLE / HYGIENE ─────────────────────────────────────────────────────────
-- status: soft-deactivate (never hard-delete). 'active' is a universal system default (NOT
-- STD-014 territory — it is not a per-tenant value the platform can't know). NO CHECK (AC-1).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
-- updated_at: the table LACKS one today (recon-confirmed). Add the column AND wire the CANONICAL
-- set_updated_at_generic() (STD-011 — one canonical representation; created 20260604_business_modules,
-- reused by receipts/business_assets; do NOT mint a new per-table function). NOT NULL DEFAULT now()
-- backfills every existing row (mirrors the people spine's updated_at).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- notes: internal memo (not customer-facing).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes text;

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

COMMENT ON COLUMN customers.organization_name IS
  'Party record (2026-07-13): the org legal name for customer_type=organization. Orgs were previously '
  'stuffed whole into first_name; NOT backfilled here (separate data pass).';
COMMENT ON COLUMN customers.billing_line1 IS
  'Party record (2026-07-13): L1 billing address (a customer has ONE billing address). Shipping is '
  'NOT on the customer — it is order-time, snapshotted onto the delivery row (deliveries table).';
COMMENT ON COLUMN customers.tax_exempt_cert_doc_url IS
  'Party record (2026-07-13): SLOT for the on-file exemption cert document. Ingest rides STD-010 '
  '(separate build) — the column is the hook; no upload path is wired yet.';

-- ============================================================================
-- VERIFICATION (run after apply — read-only; catalog + isolation)
-- ============================================================================
-- (A) all 15 new columns exist with the right type/nullability/default:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name='customers'
--      AND column_name IN ('organization_name','display_name','billing_line1','billing_line2',
--        'billing_city','billing_state','billing_zip','tax_id','tax_exempt_expires',
--        'tax_exempt_cert_doc_url','payment_terms','credit_limit','status','updated_at','notes')
--    ORDER BY column_name;
--   -- expect: status text NO 'active'::text; updated_at timestamptz NO now(); credit_limit numeric YES;
--   --         tax_exempt_expires date YES; everything else text YES NULL.
--
-- (B) NO shipping_* columns were added (L1 — shipping is order-time only):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='customers' AND column_name LIKE 'shipping_%';                 -- expect 0 rows
--
-- (C) NO CHECK constraint on payment_terms / status (value-sets are DATA, AC-1):
--   SELECT conname FROM pg_constraint
--    WHERE conrelid='customers'::regclass AND contype='c'
--      AND (pg_get_constraintdef(oid) ILIKE '%payment_terms%'
--        OR pg_get_constraintdef(oid) ILIKE '%status%');                            -- expect 0 rows
--
-- (D) the updated-at trigger fires and reuses the CANONICAL function (STD-011):
--   SELECT t.tgname, p.proname
--     FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
--    WHERE t.tgrelid='customers'::regclass AND NOT t.tgisinternal;
--   -- expect: customers_updated_at | set_updated_at_generic
--
-- (E) RLS-INTACT — existing customers policies unchanged by this migration:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename='customers'
--    ORDER BY policyname;
--   -- expect: customers_business_owner | ALL ; customers_member | SELECT  (both present, unchanged)
--
-- (F) round-trip: an owner can persist the new fields on their own customer + updated_at stamps:
--   UPDATE customers SET organization_name='Cedar Park HOA', payment_terms='net_30',
--          billing_line1='100 Main St', billing_city='Leander', billing_state='TX', billing_zip='78641',
--          tax_id='EIN-88-1234567', status='active'
--    WHERE id='<a customer id in your business>';
--   SELECT organization_name, payment_terms, billing_line1, tax_id, status, updated_at
--     FROM customers WHERE id='<same>';  -- updated_at now ~= the UPDATE time (trigger fired)
