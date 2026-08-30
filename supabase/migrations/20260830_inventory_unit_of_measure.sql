-- ════════════════════════════════════════════════════════════════════════════════
-- 20260830 — UNITS OF MEASURE: what a quantity on business_inventory actually MEANS
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17:
-- the table editor's `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and
-- RLS cannot filter TRUNCATE). Nothing here creates a table, so this is belt-and-braces, but the
-- rule is stated where the actor stands.
--
-- ADDITIVE ONLY. Five NULLABLE columns with no default. Two CHECK constraints, both of which
-- EVERY EXISTING ROW ALREADY SATISFIES (all five columns are NULL on every row that exists today,
-- which is branch 1 of the projection check). One BEFORE-write trigger. NO policy change — the new
-- columns inherit business_inventory's existing owner/member RLS unchanged, exactly as the 20260628
-- (size/variant_group), 20260707 (sell_price) and 20260723 (price_basis/attributes) precedents did.
-- NOTHING IS DROPPED. `size` is untouched: no CHECK on it, no rewrite of a single stored value.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────────
-- `business_inventory.size` is free text and was built for ONE unit family. 20260628's own header
-- says so: *"Size spans systems across growers (container gallons / caliper inches / height) → keep
-- it TEXT and flexible."* It anticipated three flavours of CONTAINER. LAWNS's real catalogue carries
-- at least six FAMILIES:
--
--   CONTAINER  "15 gallon" · "#30" · "15#" · "#3/5" · "10/15 gallon" · "10.0 Qt" · "24 box"
--   VOLUME     "1/2 Yard Scoop" · "1 Yard Scoop" · "by the yard"
--   WEIGHT     "50lb Bag" · "4lb Bottle" · "1.5lb Bottle"
--   LENGTH     "5/8\" flat Rope by the roll"
--   EACH/KIT   "[2 T-Posts]"
--
-- The case that forces it: Fertile Compost Mix sells as a 15/30/45 GALLON BUCKET **and** as a
-- HALF-YARD and FULL-YARD SCOOP — FCMB15/30/45 + SFCM1/SFCM2. One pile of compost, five sale units,
-- and a yard is roughly thirteen 15-gallon buckets of the same pile. Until a row says which unit it
-- is counted in, "300" is not a quantity, it is a number. And the QuickBooks import is about to
-- write 685 items into that one text field.
--
-- ── 🔴 THE RULE THIS SCHEMA EXISTS TO ENFORCE: THIS IS A PROJECTION, NEVER A PARALLEL TRUTH ─────
-- `size` REMAINS the stored value (D-23 / faithful-before-connected — we do not rewrite what the
-- grower typed; `sizeLabel.ts`'s header says the same of normalizeSize). The five columns below are
-- DERIVED FROM `size` by exactly ONE function — `unitColumnsFor()` in
-- `packages/shared/src/inventory/unitOfMeasure.ts` — and by nothing else, ever. They are never
-- independently editable: no field, no cell, no API, no grid, and they are registered in
-- `systemManagedFields.ts` so the day one is rendered it locks with an explanation.
--
-- `unit_parsed_from` is what makes the projection PROVE ITSELF. It holds the exact string the parse
-- was computed from, so `unit_parsed_from = size` means "these columns describe THIS label". The
-- CHECK below asserts that invariant and the trigger keeps it true. A second materialisation of one
-- fact — two things claiming to describe the same reality and free to disagree — is the defect
-- shape this platform has paid for repeatedly (tech-debt #71: one `status` column, two authors).
--
-- ── 🔴 WHY A TRIGGER RATHER THAN JUST A CHECK, AND WHY IT NULLS INSTEAD OF RAISING ──────────────
-- The count path writes `size` through `count_reconcile_inventory(p_size)` (20260720 §7b), a
-- SECURITY DEFINER function this pass is scoped OUT of touching. With the CHECK alone, a count that
-- fills a stub's size on an already-parsed row would violate it and **the count would fail** — i.e.
-- adding this migration would change the behaviour of a live surface, which is precisely the thing
-- this build promised not to do. So the trigger absorbs it: when `size` moves without a fresh
-- derive, the projection NULLS ITSELF rather than describing a string that is no longer there.
--
-- The consequence is the honest one and it is stated rather than hidden: **the columns are either
-- correct or ABSENT — never stale-and-wrong.** A count- or import-RPC-born row lands unparsed, and
-- `scripts/backfill-inventory-units.mjs` (re-runnable by design) fills it. `--verify` on that script
-- re-derives every row and reports any disagreement; it is expected to report zero mismatches and a
-- non-zero "not yet parsed" count until the backfill is run again.
--
-- ── VERIFY (run AFTER apply — catalog-backed, never from memory; queries at the foot) ───────────
-- STORY: user_stories.md → *A quantity that means something — the unit of measure behind `size`*.
-- Ledger #234. Stage 0 recon 2026-08-30 (25 readers of `size` across 22 files; none changes here).
-- ════════════════════════════════════════════════════════════════════════════════


-- ── §1 — THE COLUMNS ──────────────────────────────────────────────────────────────
-- All five NULLABLE, no defaults. Existing rows stay entirely NULL and are not rewritten.
ALTER TABLE business_inventory
  ADD COLUMN IF NOT EXISTS unit_kind        text,
  ADD COLUMN IF NOT EXISTS unit_value       numeric,
  ADD COLUMN IF NOT EXISTS unit_value_max   numeric,
  ADD COLUMN IF NOT EXISTS unit_name        text,
  ADD COLUMN IF NOT EXISTS unit_parsed_from text;

COMMENT ON COLUMN business_inventory.unit_kind IS
  'DERIVED from size by unitColumnsFor() — container|volume|weight|length|each. NEVER hand-edited. NULL = the parser has not run, or ran and refused (see unit_parsed_from).';
COMMENT ON COLUMN business_inventory.unit_value IS
  'DERIVED. The unit quantity, or the LOW end of a range. NULL when the label names a unit but states no quantity ("by the yard").';
COMMENT ON COLUMN business_inventory.unit_value_max IS
  'DERIVED. The HIGH end of a range ("10/15 gallon" -> 10..15, "#3/5" -> 3..5). NULL when the label names one size. A range is NEVER collapsed to one end.';
COMMENT ON COLUMN business_inventory.unit_name IS
  'DERIVED. The canonical unit: gallon|quart|box|yard|lb|oz|inch|foot|roll|post|flat|tray|each. Deliberately NO CHECK — this vocabulary grows with the catalogue; unit_kind is the closed axis.';
COMMENT ON COLUMN business_inventory.unit_parsed_from IS
  'DERIVED. The EXACT size string the four columns above were computed from. unit_parsed_from = size is the proof that the projection describes the current label. NOT NULL with the others NULL means "parsed and refused" (an honest, queryable state); ALL NULL means "not yet parsed".';


-- ── §2 — THE CLOSED TAXONOMY ──────────────────────────────────────────────────────
-- 🔴 NAMED, NOT INLINE. An inline CHECK is auto-named by Postgres, so its name is never typed and a
-- `conname` grep can never find it — that is exactly why ~129 inline CHECKs are invisible to the
-- tech-debt #23 sweep and how the #91 platform-vocabulary disagreement went unmeasured for months.
-- Five kinds is a genuinely CLOSED axis (a taxonomy, not a per-grower vocabulary), so unlike
-- `size`, `price_basis` and `unit_name` it EARNS a constraint. Adding a sixth is a migration, and
-- it should be.
ALTER TABLE business_inventory
  DROP CONSTRAINT IF EXISTS business_inventory_unit_kind_check;
ALTER TABLE business_inventory
  ADD  CONSTRAINT business_inventory_unit_kind_check
  CHECK (unit_kind IS NULL OR unit_kind IN ('container', 'volume', 'weight', 'length', 'each'));


-- ── §3 — THE PROJECTION INVARIANT ─────────────────────────────────────────────────
-- A row is in exactly ONE of two honest states:
--   (a) NOT PARSED  — all five NULL. Nothing was derived and nothing claims to have been.
--   (b) PARSED      — unit_parsed_from IS NOT NULL and EQUALS size. The four value columns then
--                     describe THIS label; if they are also NULL, the parser read it and refused,
--                     which is a real answer and must stay distinguishable from (a).
-- There is no third state, and in particular there is no "these columns describe some OTHER string".
ALTER TABLE business_inventory
  DROP CONSTRAINT IF EXISTS business_inventory_unit_projection_check;
ALTER TABLE business_inventory
  ADD  CONSTRAINT business_inventory_unit_projection_check
  CHECK (
    (unit_parsed_from IS NULL
       AND unit_kind IS NULL AND unit_value IS NULL
       AND unit_value_max IS NULL AND unit_name IS NULL)
    OR
    (unit_parsed_from IS NOT NULL AND unit_parsed_from IS NOT DISTINCT FROM size)
  );


-- ── §4 — THE GUARD: SIZE MOVES, THE PROJECTION LETS GO ────────────────────────────
-- One rule, and deliberately NO PARSER IN SQL. A PL/pgSQL parser would be a SECOND implementation
-- of the parse rule, which is the very thing §3 exists to prevent — so this function does not know
-- what a gallon is. It only knows that a projection describing a string that is no longer there is
-- not a projection. Absent beats wrong (D-9).
CREATE OR REPLACE FUNCTION public.business_inventory_unit_projection_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.unit_parsed_from IS DISTINCT FROM NEW.size THEN
    NEW.unit_kind        := NULL;
    NEW.unit_value       := NULL;
    NEW.unit_value_max   := NULL;
    NEW.unit_name        := NULL;
    NEW.unit_parsed_from := NULL;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.business_inventory_unit_projection_guard() IS
  'Keeps the unit_* columns a PROJECTION of size. A write that moves size without supplying a fresh derive gets NULLs, never a stale unit. Holds no parser by design — the ONE parse rule lives in packages/shared/src/inventory/unitOfMeasure.ts.';

-- BEFORE, so it can correct NEW in place rather than reject the write. That is what lets the
-- existing count/import RPCs keep working UNCHANGED — they set size, they know nothing about
-- units, and they simply produce an unparsed row for the backfill to pick up.
DROP TRIGGER IF EXISTS business_inventory_unit_projection ON business_inventory;
CREATE TRIGGER business_inventory_unit_projection
  BEFORE INSERT OR UPDATE ON business_inventory
  FOR EACH ROW EXECUTE FUNCTION public.business_inventory_unit_projection_guard();


-- ── §5 — READ INDEX ───────────────────────────────────────────────────────────────
-- The reads this pays for: "what is unparsed in this tenant" (the backfill report) and "which
-- families carry more than one kind" (the multi-unit flag). Both are business-scoped walks.
CREATE INDEX IF NOT EXISTS business_inventory_unit_kind_idx
  ON business_inventory (business_id, unit_kind);


-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — David runs these AFTER apply. Catalog-backed, not from memory (CLAUDE.md §9).
-- ════════════════════════════════════════════════════════════════════════════════
--
-- (A) all five columns exist, correct types, all NULLABLE:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'business_inventory'
--     AND column_name IN ('unit_kind','unit_value','unit_value_max','unit_name','unit_parsed_from')
--   ORDER BY column_name;
--   → 5 rows. unit_value/unit_value_max = 'numeric'; the other three = 'text'; is_nullable 'YES' on all five.
--
-- (B) BOTH constraints landed, BY NAME (the #91 lesson — a name you can grep):
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'business_inventory'::regclass AND contype = 'c'
--   ORDER BY conname;
--   → includes business_inventory_unit_kind_check and business_inventory_unit_projection_check.
--   → ⚠️ and NOTHING referencing `size` itself — size gains no constraint in this migration.
--
-- (C) the trigger is live and fires BEFORE both INSERT and UPDATE:
--   SELECT tgname, pg_get_triggerdef(oid)
--   FROM pg_trigger
--   WHERE tgrelid = 'business_inventory'::regclass AND NOT tgisinternal
--   ORDER BY tgname;
--   → 2 rows: business_inventory_updated_at (pre-existing, unchanged) and
--     business_inventory_unit_projection (BEFORE INSERT OR UPDATE ... FOR EACH ROW).
--
-- (D) NO row was rewritten and NO row was lost — every existing row is in state (a):
--   SELECT count(*) AS total,
--          count(*) FILTER (WHERE unit_parsed_from IS NOT NULL) AS parsed
--   FROM business_inventory;
--   → total = the same count as before apply; parsed = 0 (the backfill has not run yet).
--
-- (E) RLS policies UNCHANGED in number and shape (no policy added, dropped or altered):
--   SELECT policyname, cmd, qual IS NOT NULL AS has_using, with_check IS NOT NULL AS has_check
--   FROM pg_policies WHERE tablename = 'business_inventory' ORDER BY policyname;
--   → the identical set to before apply (business_inventory_owner_all + business_inventory_member_all).
--
-- (F) 🔴 THE GUARD ACTUALLY GUARDS — the one behaviour worth proving by hand, on a throwaway row.
--     Run inside a transaction and ROLL BACK; it writes nothing permanent.
--   BEGIN;
--     INSERT INTO business_inventory (business_id, name, size, unit_kind, unit_value, unit_name, unit_parsed_from)
--     VALUES ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', '__unit guard probe__', '45 gal',
--             'container', 45, 'gallon', '45 gal')
--     RETURNING unit_kind, unit_value, unit_parsed_from;
--     → container | 45 | 45 gal      (a consistent projection SURVIVES the trigger)
--
--     UPDATE business_inventory SET size = '1 Yard Scoop'
--      WHERE name = '__unit guard probe__'
--     RETURNING size, unit_kind, unit_value, unit_parsed_from;
--     → 1 Yard Scoop | NULL | NULL | NULL
--       🔴 THIS IS THE WHOLE POINT: size moved without a fresh derive, so the projection LET GO
--          rather than continuing to claim the row is a 45-gallon container.
--   ROLLBACK;
--
-- (G) after `node scripts/backfill-inventory-units.mjs` has been run, the two honest states:
--   SELECT business_id,
--          count(*)                                                        AS rows,
--          count(*) FILTER (WHERE unit_kind IS NOT NULL)                   AS parsed,
--          count(*) FILTER (WHERE unit_parsed_from IS NOT NULL
--                             AND unit_kind IS NULL)                       AS parsed_and_refused,
--          count(*) FILTER (WHERE unit_parsed_from IS NULL AND size IS NOT NULL) AS not_yet_parsed
--   FROM business_inventory GROUP BY business_id ORDER BY rows DESC;
--   → LAWNS is ed2e5933-45dc-4b9b-a331-ddfd125e7a74. `not_yet_parsed` should be 0 immediately
--     after a run and will grow again as the count/import RPCs mint rows — that is the named,
--     expected behaviour, not a defect. Re-run the backfill; it is idempotent.
