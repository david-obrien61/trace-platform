-- ─────────────────────────────────────────────────────────────────────────────
-- IGNITION OS — Job Lifecycle Migration
-- Run after: supabase_schema.sql
--             supabase_team_system_migration.sql
--             supabase_identity_v2_migration.sql
--             supabase_rls_pilot.sql
--
-- What this adds:
--   NEW TABLE  bays                  — physical service bays in the shop
--   NEW TABLE  customers             — CRM record (moved out of localStorage)
--   NEW TABLE  customer_vehicles     — VIN history per customer
--   ALTER      jobs                  — full job lifecycle columns
--   NEW TABLE  evaluations           — tech eval document + status
--   NEW TABLE  dtc_codes             — structured fault codes per evaluation
--   NEW TABLE  eval_photos           — photo evidence URLs per evaluation
--   NEW TABLE  estimates             — agent-built estimate container
--   NEW TABLE  estimate_line_items   — one row per part/labor/sublet/fee
--   NEW TABLE  customer_authorizations — legal record of customer approval
--   NEW TABLE  labor_entries         — clock-in/out per tech per job
--   NEW TABLE  repair_logs           — what was actually done during repair
--   NEW TABLE  invoices              — derived from authorized line items
--   NEW TABLE  invoice_line_items    — snapshot of authorized items at invoice time
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── BAYS ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bays (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  status     text        NOT NULL DEFAULT 'available',
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bays_shop_idx    ON bays(shop_id);
CREATE INDEX IF NOT EXISTS bays_status_idx  ON bays(shop_id, status);

ALTER TABLE bays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_bays" ON bays;
CREATE POLICY "pilot_all_bays" ON bays FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS bays_updated_at ON bays;
CREATE TRIGGER bays_updated_at
  BEFORE UPDATE ON bays
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── CUSTOMERS ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  first_name  text        NOT NULL,
  last_name   text,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_shop_idx    ON customers(shop_id);
CREATE INDEX IF NOT EXISTS customers_phone_idx   ON customers(shop_id, phone);
CREATE INDEX IF NOT EXISTS customers_name_idx    ON customers(shop_id, last_name, first_name);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_customers" ON customers;
CREATE POLICY "pilot_all_customers" ON customers FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── CUSTOMER_VEHICLES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_vehicles (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       uuid  NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id   uuid  NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vin           text,
  year          text,
  make          text,
  model         text,
  trim          text,
  color         text,
  license_plate text,
  mileage_last  integer,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_vehicles_shop_idx      ON customer_vehicles(shop_id);
CREATE INDEX IF NOT EXISTS customer_vehicles_customer_idx  ON customer_vehicles(customer_id);
CREATE INDEX IF NOT EXISTS customer_vehicles_vin_idx       ON customer_vehicles(shop_id, vin);

ALTER TABLE customer_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_customer_vehicles" ON customer_vehicles;
CREATE POLICY "pilot_all_customer_vehicles" ON customer_vehicles FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS customer_vehicles_updated_at ON customer_vehicles;
CREATE TRIGGER customer_vehicles_updated_at
  BEFORE UPDATE ON customer_vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── JOBS — extend existing table ─────────────────────────────────────────────
-- Status lifecycle:
--   intake → queued → in_eval → eval_done → estimating → pending_auth
--   → authorized → in_repair → supplement → repair_done → invoiced → closed
--   void (any stage)

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS customer_id        uuid        REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_id         uuid        REFERENCES customer_vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_writer_id  uuid        REFERENCES shop_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_id          uuid        REFERENCES shop_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bay_id             uuid        REFERENCES bays(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS complaint          text,
  ADD COLUMN IF NOT EXISTS mileage_in         integer,
  ADD COLUMN IF NOT EXISTS mileage_out        integer,
  ADD COLUMN IF NOT EXISTS promised_at        timestamptz,
  ADD COLUMN IF NOT EXISTS waiting_status     boolean     NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS jobs_customer_idx       ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS jobs_vehicle_idx        ON jobs(vehicle_id);
CREATE INDEX IF NOT EXISTS jobs_member_idx         ON jobs(member_id);
CREATE INDEX IF NOT EXISTS jobs_service_writer_idx ON jobs(service_writer_id);
CREATE INDEX IF NOT EXISTS jobs_bay_idx            ON jobs(bay_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx         ON jobs(shop_id, status);

-- jobs_updated_at trigger already created in supabase_schema.sql; no-op here.


-- ─── EVALUATIONS ──────────────────────────────────────────────────────────────
-- status: draft | submitted | superseded

CREATE TABLE IF NOT EXISTS evaluations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  shop_id      uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  tech_id      uuid        REFERENCES shop_members(id) ON DELETE SET NULL,
  status       text        NOT NULL DEFAULT 'draft',
  complaint    text,
  tech_notes   text,
  transcript   jsonb,
  work_items   jsonb,
  submitted_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evaluations_job_idx    ON evaluations(job_id);
CREATE INDEX IF NOT EXISTS evaluations_shop_idx   ON evaluations(shop_id);
CREATE INDEX IF NOT EXISTS evaluations_tech_idx   ON evaluations(tech_id);
CREATE INDEX IF NOT EXISTS evaluations_status_idx ON evaluations(shop_id, status);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_evaluations" ON evaluations;
CREATE POLICY "pilot_all_evaluations" ON evaluations FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS evaluations_updated_at ON evaluations;
CREATE TRIGGER evaluations_updated_at
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── DTC_CODES ────────────────────────────────────────────────────────────────
-- Structured fault codes — queryable rows, not buried in transcript JSONB.
-- system: POWERTRAIN | CHASSIS | BODY | NETWORK
-- severity: HIGH | MEDIUM | LOW | INFO

CREATE TABLE IF NOT EXISTS dtc_codes (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid  NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  job_id        uuid  NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  shop_id       uuid  NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  code          text  NOT NULL,
  description   text,
  system        text,
  severity      text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dtc_codes_evaluation_idx ON dtc_codes(evaluation_id);
CREATE INDEX IF NOT EXISTS dtc_codes_job_idx        ON dtc_codes(job_id);
CREATE INDEX IF NOT EXISTS dtc_codes_shop_idx       ON dtc_codes(shop_id);
CREATE INDEX IF NOT EXISTS dtc_codes_code_idx       ON dtc_codes(shop_id, code);

ALTER TABLE dtc_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_dtc_codes" ON dtc_codes;
CREATE POLICY "pilot_all_dtc_codes" ON dtc_codes FOR ALL USING (true) WITH CHECK (true);


-- ─── EVAL_PHOTOS ──────────────────────────────────────────────────────────────
-- photo_type: OVERVIEW | DAMAGE | DTC_SCREEN | PART | OTHER

CREATE TABLE IF NOT EXISTS eval_photos (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid  NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  job_id        uuid  NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  shop_id       uuid  NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  storage_url   text  NOT NULL,
  caption       text,
  photo_type    text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eval_photos_evaluation_idx ON eval_photos(evaluation_id);
CREATE INDEX IF NOT EXISTS eval_photos_job_idx        ON eval_photos(job_id);
CREATE INDEX IF NOT EXISTS eval_photos_shop_idx       ON eval_photos(shop_id);

ALTER TABLE eval_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_eval_photos" ON eval_photos;
CREATE POLICY "pilot_all_eval_photos" ON eval_photos FOR ALL USING (true) WITH CHECK (true);


-- ─── ESTIMATES ────────────────────────────────────────────────────────────────
-- parent_estimate_id set on supplement estimates (mid-repair additional findings).
-- status: building | ready | sent | authorized | declined | voided

CREATE TABLE IF NOT EXISTS estimates (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  shop_id            uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  evaluation_id      uuid        REFERENCES evaluations(id) ON DELETE SET NULL,
  parent_estimate_id uuid        REFERENCES estimates(id) ON DELETE SET NULL,
  status             text        NOT NULL DEFAULT 'building',
  agent_version      text,
  agent_notes        text,
  subtotal           numeric(10,2),
  tax                numeric(10,2),
  total              numeric(10,2),
  sent_at            timestamptz,
  authorized_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimates_job_idx    ON estimates(job_id);
CREATE INDEX IF NOT EXISTS estimates_shop_idx   ON estimates(shop_id);
CREATE INDEX IF NOT EXISTS estimates_status_idx ON estimates(shop_id, status);
CREATE INDEX IF NOT EXISTS estimates_parent_idx ON estimates(parent_estimate_id);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_estimates" ON estimates;
CREATE POLICY "pilot_all_estimates" ON estimates FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS estimates_updated_at ON estimates;
CREATE TRIGGER estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── ESTIMATE_LINE_ITEMS ──────────────────────────────────────────────────────
-- auth_status per row — customer can approve some lines and decline others.
-- item_type: PART | LABOR | SUBLET | FEE | MISC
-- auth_status: pending | approved | declined

CREATE TABLE IF NOT EXISTS estimate_line_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id  uuid        NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  job_id       uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  shop_id      uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  item_type    text        NOT NULL,
  description  text        NOT NULL,
  part_number  text,
  supplier     text,
  quantity     numeric(8,2)  NOT NULL DEFAULT 1,
  unit_cost    numeric(10,2),
  unit_price   numeric(10,2),
  labor_hours  numeric(6,2),
  labor_rate   numeric(8,2),
  line_total   numeric(10,2),
  auth_status  text        NOT NULL DEFAULT 'pending',
  sort_order   integer     NOT NULL DEFAULT 0,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimate_line_items_estimate_idx ON estimate_line_items(estimate_id);
CREATE INDEX IF NOT EXISTS estimate_line_items_job_idx      ON estimate_line_items(job_id);
CREATE INDEX IF NOT EXISTS estimate_line_items_shop_idx     ON estimate_line_items(shop_id);
CREATE INDEX IF NOT EXISTS estimate_line_items_auth_idx     ON estimate_line_items(estimate_id, auth_status);

ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_estimate_line_items" ON estimate_line_items;
CREATE POLICY "pilot_all_estimate_line_items" ON estimate_line_items FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS estimate_line_items_updated_at ON estimate_line_items;
CREATE TRIGGER estimate_line_items_updated_at
  BEFORE UPDATE ON estimate_line_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── CUSTOMER_AUTHORIZATIONS ──────────────────────────────────────────────────
-- Legal record of customer approval. Immutable after creation.
-- authorized_line_ids / declined_line_ids are UUID array snapshots
-- so the legal record survives future edits to estimate_line_items.
-- method: IN_PERSON | SMS_LINK | PHONE | EMAIL

CREATE TABLE IF NOT EXISTS customer_authorizations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id         uuid        NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  job_id              uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  shop_id             uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id         uuid        REFERENCES customers(id) ON DELETE SET NULL,
  method              text        NOT NULL,
  authorized_line_ids uuid[]      NOT NULL DEFAULT '{}',
  declined_line_ids   uuid[]      NOT NULL DEFAULT '{}',
  authorized_total    numeric(10,2),
  signature_url       text,
  customer_name       text,
  authorized_at       timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_authorizations_estimate_idx ON customer_authorizations(estimate_id);
CREATE INDEX IF NOT EXISTS customer_authorizations_job_idx      ON customer_authorizations(job_id);
CREATE INDEX IF NOT EXISTS customer_authorizations_shop_idx     ON customer_authorizations(shop_id);
CREATE INDEX IF NOT EXISTS customer_authorizations_customer_idx ON customer_authorizations(customer_id);

ALTER TABLE customer_authorizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_customer_authorizations" ON customer_authorizations;
CREATE POLICY "pilot_all_customer_authorizations" ON customer_authorizations FOR ALL USING (true) WITH CHECK (true);


-- ─── LABOR_ENTRIES ────────────────────────────────────────────────────────────
-- Clock in/out per tech per job. clocked_out NULL = currently on the clock.
-- duration_minutes set on clock-out for fast reporting.

CREATE TABLE IF NOT EXISTS labor_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  shop_id          uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  tech_id          uuid        NOT NULL REFERENCES shop_members(id) ON DELETE CASCADE,
  clocked_in       timestamptz NOT NULL DEFAULT now(),
  clocked_out      timestamptz,
  duration_minutes integer,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labor_entries_job_idx   ON labor_entries(job_id);
CREATE INDEX IF NOT EXISTS labor_entries_shop_idx  ON labor_entries(shop_id);
CREATE INDEX IF NOT EXISTS labor_entries_tech_idx  ON labor_entries(tech_id);
CREATE INDEX IF NOT EXISTS labor_entries_open_idx  ON labor_entries(shop_id, tech_id) WHERE clocked_out IS NULL;

ALTER TABLE labor_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_labor_entries" ON labor_entries;
CREATE POLICY "pilot_all_labor_entries" ON labor_entries FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS labor_entries_updated_at ON labor_entries;
CREATE TRIGGER labor_entries_updated_at
  BEFORE UPDATE ON labor_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── REPAIR_LOGS ──────────────────────────────────────────────────────────────
-- What the tech actually did. One row per work item.
-- outcome: completed | partial | deferred | supplement
-- supplement outcome triggers new estimate branch.

CREATE TABLE IF NOT EXISTS repair_logs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  shop_id               uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  tech_id               uuid        NOT NULL REFERENCES shop_members(id) ON DELETE CASCADE,
  estimate_line_item_id uuid        REFERENCES estimate_line_items(id) ON DELETE SET NULL,
  description           text        NOT NULL,
  outcome               text        NOT NULL DEFAULT 'completed',
  parts_used            jsonb,
  tech_notes            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS repair_logs_job_idx   ON repair_logs(job_id);
CREATE INDEX IF NOT EXISTS repair_logs_shop_idx  ON repair_logs(shop_id);
CREATE INDEX IF NOT EXISTS repair_logs_tech_idx  ON repair_logs(tech_id);
CREATE INDEX IF NOT EXISTS repair_logs_line_idx  ON repair_logs(estimate_line_item_id);

ALTER TABLE repair_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_repair_logs" ON repair_logs;
CREATE POLICY "pilot_all_repair_logs" ON repair_logs FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS repair_logs_updated_at ON repair_logs;
CREATE TRIGGER repair_logs_updated_at
  BEFORE UPDATE ON repair_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── INVOICES ─────────────────────────────────────────────────────────────────
-- Derived from authorized estimate_line_items. Immutable once created (void, don't edit).
-- status: draft | open | paid | voided
-- payment_method: CASH | CARD | CHECK | FINANCING | OTHER

CREATE TABLE IF NOT EXISTS invoices (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  shop_id        uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  estimate_id    uuid        REFERENCES estimates(id) ON DELETE SET NULL,
  customer_id    uuid        REFERENCES customers(id) ON DELETE SET NULL,
  status         text        NOT NULL DEFAULT 'open',
  subtotal       numeric(10,2) NOT NULL DEFAULT 0,
  tax            numeric(10,2) NOT NULL DEFAULT 0,
  total          numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text,
  payment_ref    text,
  paid_at        timestamptz,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_job_idx      ON invoices(job_id);
CREATE INDEX IF NOT EXISTS invoices_shop_idx     ON invoices(shop_id);
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx   ON invoices(shop_id, status);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_invoices" ON invoices;
CREATE POLICY "pilot_all_invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── INVOICE_LINE_ITEMS ───────────────────────────────────────────────────────
-- Immutable snapshot of authorized items at invoice creation time.
-- source_line_item_id links to estimate_line_items for traceability
-- but is never updated — the legal record is frozen at invoice time.

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  job_id              uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  shop_id             uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  source_line_item_id uuid        REFERENCES estimate_line_items(id) ON DELETE SET NULL,
  item_type           text        NOT NULL,
  description         text        NOT NULL,
  part_number         text,
  quantity            numeric(8,2)  NOT NULL DEFAULT 1,
  unit_price          numeric(10,2),
  labor_hours         numeric(6,2),
  labor_rate          numeric(8,2),
  line_total          numeric(10,2),
  sort_order          integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_idx ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_line_items_job_idx     ON invoice_line_items(job_id);
CREATE INDEX IF NOT EXISTS invoice_line_items_shop_idx    ON invoice_line_items(shop_id);
CREATE INDEX IF NOT EXISTS invoice_line_items_source_idx  ON invoice_line_items(source_line_item_id);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_invoice_line_items" ON invoice_line_items;
CREATE POLICY "pilot_all_invoice_line_items" ON invoice_line_items FOR ALL USING (true) WITH CHECK (true);


-- ─── REFERENCE: full job lifecycle state machine ──────────────────────────────
--
-- ZONE 1 — INTAKE (Service Writer)
--   intake       Customer arrives / call comes in
--                INSERT customers + customer_vehicles
--                INSERT jobs (status = intake, complaint, mileage_in, promised_at)
--   queued       Tech assigned: jobs.member_id + bay_id → status = queued
--
-- ZONE 2 — EVALUATION (Tech, localStorage primary / Supabase checkpoint)
--   in_eval      Tech opens job → jobs.status = in_eval
--                INSERT evaluations (status = draft)
--                DTC scan → INSERT dtc_codes
--                Photos   → INSERT eval_photos
--                Labor clock-in → INSERT labor_entries (clocked_out = NULL)
--   eval_done    Tech submits → evaluations.status = submitted, jobs.status = eval_done
--                Labor clock-out → UPDATE labor_entries (clocked_out, duration_minutes)
--
-- ZONE 3 — ESTIMATE → AUTH → REPAIR → CLOSEOUT
--   estimating   Estimate agent triggered (Railway endpoint)
--                INSERT estimates (status = building)
--                Agent reads evaluations + dtc_codes + work_items
--                Agent writes estimate_line_items → estimates.status = ready
--                jobs.status = estimating
--   pending_auth Service writer sends to customer → estimates.status = sent
--                jobs.status = pending_auth
--   authorized   Customer responds via CustomerApprovalPortal or in-person
--                UPDATE estimate_line_items.auth_status per line
--                INSERT customer_authorizations (legal snapshot)
--                estimates.status = authorized → jobs.status = authorized
--   in_repair    Tech begins → jobs.status = in_repair, labor clock-in
--                Tech writes repair_logs as work completes
--   supplement   New finding → repair_logs.outcome = supplement
--                INSERT estimates (parent_estimate_id = original) → loops back
--   repair_done  Tech marks done → jobs.status = repair_done, labor clock-out
--   invoiced     Service writer generates invoice
--                INSERT invoices + invoice_line_items (snapshot of approved lines)
--                jobs.status = invoiced
--   closed       Payment collected → invoices.status = paid
--                jobs.mileage_out set → jobs.status = closed
