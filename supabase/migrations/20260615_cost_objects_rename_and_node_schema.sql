-- ============================================================
-- Migration: business_assets → cost_objects  (RENAME-IN-PLACE)
--            + node / edge schema for the cost-object DAG
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Core-1 — Schema approach C (rename-in-place). SETTLED, not re-litigated.
-- Date: 2026-06-15
--
-- AC-1: no vertical nouns. node_type / domain are VALUES, never table names.
-- AC-2: RLS scoped to business_id membership (owner_all + member_all).
-- AC-3: tenant isolation absolute — every new table is business_id-scoped.
--
-- ⚠️  APPLY MANUALLY in Supabase SQL editor — do NOT execute without
--     David's explicit "run it" approval. After applying, run the catalog
--     proof (this is the independent schema-verification gate — it hits the
--     live catalog, not the builder's memory):
--         SUPABASE_PAT=sbp_xxx node scripts/verify-cost-objects.mjs
-- ============================================================
-- Pre-write verify (LIVE catalog, service key, 2026-06-15 — PROVEN not asserted):
--   business_assets        → 0 rows   ← no data migration needed
--   business_pmi_schedule  → 0 rows   ← FK dependent .asset_id (ON DELETE CASCADE)
--   business_service_log   → 0 rows   ← FK dependent .asset_id (ON DELETE CASCADE)
--
-- Design source:  docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md §5, §5.2, §5.7, §5.9
-- Decision:       docs/cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md (option C)
-- Proven pattern: plants → cultivar_plants rename (2026-06-13) — FK auto-carry confirmed.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. RENAME business_assets → cost_objects (in place)
--
--    The two FK dependents — business_pmi_schedule.asset_id and
--    business_service_log.asset_id — reference this table by OID, so they
--    AUTO-CARRY across the rename with ON DELETE CASCADE intact. No FK
--    rewrite is needed (proven on plants → cultivar_plants, 2026-06-13).
--
--    FK COLUMN-NAME DECISION (documented per Core-1 ask): the child columns
--    STAY named `asset_id` — NOT renamed to `cost_object_id`. Why:
--      • business_pmi_schedule and business_service_log are ASSET-maintenance
--        tables. They reference ASSET-type nodes specifically, never
--        PROJECT/PRODUCT nodes — so `asset_id` is semantically correct.
--      • Renaming would churn PMI.tsx (8+ references, type interfaces) for
--        zero functional gain.
--      • The parent-table rename is transparent to the child column name.
--    CASCADE is preserved (the constraint is untouched; only its parent
--    table's name changes). Verified by the catalog proof, query (C).
-- ------------------------------------------------------------
ALTER TABLE business_assets RENAME TO cost_objects;

-- Name hygiene: rename the auto-carried policies / trigger / pkey so the
-- labels match the new table. (Definitions follow the table automatically;
-- only the *names* are stale. RLS *behaviour* is unchanged — same predicates.)
ALTER POLICY  business_assets_owner_all  ON cost_objects RENAME TO cost_objects_owner_all;
ALTER POLICY  business_assets_member_all ON cost_objects RENAME TO cost_objects_member_all;
ALTER TRIGGER business_assets_updated_at ON cost_objects RENAME TO cost_objects_updated_at;
ALTER TABLE   cost_objects RENAME CONSTRAINT business_assets_pkey TO cost_objects_pkey;
-- NOTE: business_assets_cost_confidence_check and business_assets_business_id_fkey
-- keep their old labels harmlessly (functional, not cosmetic-blocking). Left as-is
-- to minimise rename surface; they reference cost_objects correctly post-rename.

-- ------------------------------------------------------------
-- 2. NODE fields — type discriminator + containment tree + domain holder
--    (§5.1 one-table discriminator; §5.0 residence-root; §5.9 fallback-to-domain)
-- ------------------------------------------------------------
ALTER TABLE cost_objects
  ADD COLUMN node_type text NOT NULL DEFAULT 'ASSET'
    CHECK (node_type IN ('ASSET','PROJECT','PRODUCT')),
  ADD COLUMN parent_id uuid REFERENCES cost_objects(id) ON DELETE SET NULL,
  ADD COLUMN domain    text;

COMMENT ON COLUMN cost_objects.node_type IS
  'AC-1 discriminator: ASSET | PROJECT | PRODUCT. Variation lives in data, not schema (no asset_objects/project_objects/product_objects tables). Selects which *_status column is meaningful for the row.';
COMMENT ON COLUMN cost_objects.parent_id IS
  'Containment tree (§5.2): child cost rolls up into parent. NULL = root/domain node (e.g. the residence-root, §5.0). ON DELETE SET NULL — deleting a parent orphans children up to root, never cascade-destroys them.';
COMMENT ON COLUMN cost_objects.domain IS
  'The Farm/Software/RealEstate holder a node falls back to when unassigned (§5.9 fallback-to-domain, OP-6). Free-text; the owner names their own domains. AC-1: a value, not a RESIDENCE node type.';

-- §5.1 also lists node-type CARRY fields (budget_estimate, unit_type,
-- selling_price, purchase_date, vendor_id). NOT added here — deferred to when
-- PROJECT/PRODUCT node UIs are built. acquisition_cost already serves the
-- ASSET purchase_cost role. Adding them now = an always-null pile with no
-- writer. Honest-debt note: add alongside the PROJECT/PRODUCT build.

-- ------------------------------------------------------------
-- 3. SEPARATE STATUS COLUMNS (§5.9 — asset outlives product).
--    Never one polymorphic column. node_type selects which applies.
--    (Non-asset rows carry the asset `status` default 'ACTIVE' harmlessly —
--     it is simply not the meaningful column for that node_type.)
-- ------------------------------------------------------------
-- 3a. status — ASSET-only. Add IDLE + UNASSIGNED to the enum (§5.9 idle capital:
--     owned, functional, serving no current project — the state the old enum lacked).
ALTER TABLE cost_objects DROP CONSTRAINT business_assets_status_check;
ALTER TABLE cost_objects ADD  CONSTRAINT cost_objects_status_check
  CHECK (status IN ('ACTIVE','IN_REPAIR','OFFLINE','RETIRED','IDLE','UNASSIGNED'));

-- 3b. project_status — PROJECT-only (open / closed / converted). Nullable.
ALTER TABLE cost_objects
  ADD COLUMN project_status text
    CHECK (project_status IS NULL OR project_status IN ('open','closed','converted'));

-- 3c. product_status — PRODUCT-only (active / retired). Nullable.
ALTER TABLE cost_objects
  ADD COLUMN product_status text
    CHECK (product_status IS NULL OR product_status IN ('active','retired'));

COMMENT ON COLUMN cost_objects.status IS
  'ASSET-only lifecycle. ACTIVE/IN_REPAIR/OFFLINE/RETIRED + IDLE/UNASSIGNED (§5.9 idle-capital state). Meaningful only when node_type=ASSET.';
COMMENT ON COLUMN cost_objects.project_status IS
  'PROJECT-only lifecycle (open/closed/converted, §5.1/§5.3). NULL for non-PROJECT rows.';
COMMENT ON COLUMN cost_objects.product_status IS
  'PRODUCT-only lifecycle (active/retired, §5.9). A retired product closes its ledger but its ASSETS do not retire with it — that is why these are separate columns.';

-- Index for the asset-UI hot path: WHERE business_id = ? AND node_type = 'ASSET'.
CREATE INDEX idx_cost_objects_business_node ON cost_objects (business_id, node_type);
CREATE INDEX idx_cost_objects_parent        ON cost_objects (parent_id);

-- ------------------------------------------------------------
-- 4a. ATTRIBUTION EDGE — containment + contribution DAG (§5.2).
--     Carrier of the use_fraction + basis_* primitive (§5.5 allocation, §5.7 carve-out).
--     use_fraction is THE single primitive shared by carve-out AND multi-location —
--     built ONCE here, not duplicated (SETTLED).
--       • containment: child ⊂ parent, cost rolls up (the strict-tree edge).
--       • contribution: one asset → many products (shared cost → the DAG part).
-- ------------------------------------------------------------
CREATE TABLE cost_object_edges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id)    ON DELETE CASCADE,
  parent_id     uuid NOT NULL REFERENCES cost_objects(id)  ON DELETE CASCADE,  -- RECEIVES cost
  child_id      uuid NOT NULL REFERENCES cost_objects(id)  ON DELETE CASCADE,  -- CONTRIBUTES cost
  edge_type     text NOT NULL CHECK (edge_type IN ('containment','contribution')),
  -- use_fraction: share of the child's cost attributed to the parent. 1.0 = whole.
  --   carve-out (§5.7): a 100%-personal-origin cost where only this fraction
  --   crosses into the business; the remainder stays personal, outside the rollup.
  --   multi-location: the same primitive splits a cost across locations.
  use_fraction  numeric(7,6) NOT NULL DEFAULT 1.0
                CHECK (use_fraction > 0 AND use_fraction <= 1),
  basis_type    text CHECK (basis_type IS NULL OR basis_type IN
                  ('sqft','percent','usage','miles','labor_hours','manual')),
  basis_note    text,
  -- allocation confidence (§5.9 — cost_confidence extended to allocation, not just $):
  --   is the fraction owner-confirmed, or AI-inferred and unconfirmed?
  basis_confidence text CHECK (basis_confidence IS NULL OR basis_confidence IN
                  ('CONFIRMED','DERIVED','ESTIMATED','UNKNOWN')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cost_object_edges_no_self CHECK (parent_id <> child_id)
);

ALTER TABLE cost_object_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_object_edges_owner_all ON cost_object_edges
  USING (EXISTS (SELECT 1 FROM businesses
                 WHERE id = cost_object_edges.business_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses
                 WHERE id = cost_object_edges.business_id AND owner_id = auth.uid()));

CREATE POLICY cost_object_edges_member_all ON cost_object_edges
  USING (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = cost_object_edges.business_id
                   AND user_id = auth.uid() AND active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = cost_object_edges.business_id
                   AND user_id = auth.uid() AND active = true));

DROP TRIGGER IF EXISTS cost_object_edges_updated_at ON cost_object_edges;
CREATE TRIGGER cost_object_edges_updated_at
  BEFORE UPDATE ON cost_object_edges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

CREATE INDEX idx_cost_object_edges_parent   ON cost_object_edges (parent_id);
CREATE INDEX idx_cost_object_edges_child    ON cost_object_edges (child_id);
CREATE INDEX idx_cost_object_edges_business ON cost_object_edges (business_id);

-- ------------------------------------------------------------
-- 4b. ASSIGNMENT EDGE — time-bounded asset → project (§5.9).
--     Cost allocates across SEQUENTIAL projects by assignment PERIOD (TIME axis,
--     distinct from the simultaneous-node DAG of §5.2).
--       • start_at / end_at make it temporal and many-over-time.
--       • IDLE GAP = the absence of an open assignment (end_at IS NULL).
--         Fallback-to-domain is automatic — the owner fires no "revert" (OP-6).
--       • conversion_cost = §5.9 "conversion is a cost event": additional cost
--         (repurpose labour + materials) accruing on the RECEIVING project.
--       • basis_confidence = the assignment can be AI-inferred/unconfirmed vs
--         owner-confirmed (OP-7 infer→propose→confirm).
--     use_fraction deliberately NOT duplicated here — the period IS the
--     allocation mechanism on the time axis; the carve-out/multi-location
--     fraction lives once on cost_object_edges (SETTLED "build once").
-- ------------------------------------------------------------
CREATE TABLE cost_object_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES businesses(id)   ON DELETE CASCADE,
  asset_id        uuid NOT NULL REFERENCES cost_objects(id) ON DELETE CASCADE,  -- the ASSET node
  project_id      uuid NOT NULL REFERENCES cost_objects(id) ON DELETE CASCADE,  -- the PROJECT node
  start_at        timestamptz NOT NULL DEFAULT now(),
  end_at          timestamptz,            -- NULL = currently assigned (open period)
  conversion_cost numeric(10,2),          -- §5.9 cost event on repurpose (lands on receiving project)
  basis_confidence text CHECK (basis_confidence IS NULL OR basis_confidence IN
                    ('CONFIRMED','DERIVED','ESTIMATED','UNKNOWN')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cost_object_assignments_no_self  CHECK (asset_id <> project_id),
  CONSTRAINT cost_object_assignments_period   CHECK (end_at IS NULL OR end_at >= start_at)
);

ALTER TABLE cost_object_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_object_assignments_owner_all ON cost_object_assignments
  USING (EXISTS (SELECT 1 FROM businesses
                 WHERE id = cost_object_assignments.business_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses
                 WHERE id = cost_object_assignments.business_id AND owner_id = auth.uid()));

CREATE POLICY cost_object_assignments_member_all ON cost_object_assignments
  USING (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = cost_object_assignments.business_id
                   AND user_id = auth.uid() AND active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = cost_object_assignments.business_id
                   AND user_id = auth.uid() AND active = true));

DROP TRIGGER IF EXISTS cost_object_assignments_updated_at ON cost_object_assignments;
CREATE TRIGGER cost_object_assignments_updated_at
  BEFORE UPDATE ON cost_object_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

CREATE INDEX idx_cost_object_assignments_asset    ON cost_object_assignments (asset_id);
CREATE INDEX idx_cost_object_assignments_project  ON cost_object_assignments (project_id);
CREATE INDEX idx_cost_object_assignments_business ON cost_object_assignments (business_id);
-- Open-assignment lookup ("what is this asset on right now?" / idle detection):
CREATE INDEX idx_cost_object_assignments_open
  ON cost_object_assignments (asset_id) WHERE end_at IS NULL;

COMMIT;

-- ============================================================
-- SCHEMA-VERIFICATION GATE — run AFTER applying (live catalog, NOT memory).
-- scripts/verify-cost-objects.mjs runs these via the Management API (PAT).
-- Reproduced here so the proof set is in the migration itself.
-- ============================================================
-- (A) Rename landed — old name gone, new name present:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name IN ('business_assets','cost_objects');
--   Expect: cost_objects only.
--
-- (B) New node + status columns present:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='cost_objects'
--      AND column_name IN ('node_type','parent_id','domain','status','project_status','product_status')
--    ORDER BY column_name;
--   Expect 6 rows; node_type NOT NULL default 'ASSET'; others as designed.
--
-- (C) FK dependents AUTO-CARRIED with CASCADE intact (the load-bearing claim):
--   SELECT tc.table_name, kcu.column_name, ccu.table_name AS refs, rc.delete_rule
--     FROM information_schema.table_constraints tc
--     JOIN information_schema.key_column_usage kcu       ON tc.constraint_name = kcu.constraint_name
--     JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
--     JOIN information_schema.referential_constraints rc  ON tc.constraint_name = rc.constraint_name
--    WHERE tc.constraint_type='FOREIGN KEY'
--      AND tc.table_name IN ('business_pmi_schedule','business_service_log')
--      AND kcu.column_name='asset_id';
--   Expect both rows: refs = cost_objects, delete_rule = CASCADE.
--
-- (D) status CHECK includes IDLE + UNASSIGNED:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_status_check';
--   Expect: IN (...,'IDLE','UNASSIGNED').
--
-- (E) RLS present + business_id-scoped on all three (rename + 2 new):
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname='public'
--      AND tablename IN ('cost_objects','cost_object_edges','cost_object_assignments')
--    ORDER BY tablename, policyname;
--   Expect 6 policies (owner_all + member_all × 3); rowsecurity = true on each.
--
-- (F) Edge tables present with use_fraction + start/end:
--   SELECT table_name, column_name FROM information_schema.columns
--    WHERE table_schema='public'
--      AND table_name IN ('cost_object_edges','cost_object_assignments')
--      AND column_name IN ('use_fraction','basis_confidence','start_at','end_at','conversion_cost')
--    ORDER BY table_name, column_name;
--   Expect: edges→use_fraction,basis_confidence ; assignments→start_at,end_at,conversion_cost,basis_confidence.
-- ============================================================
