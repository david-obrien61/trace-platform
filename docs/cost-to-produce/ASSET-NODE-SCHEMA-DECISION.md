# Asset ⟷ Node Schema Decision — bridge vs subsume vs rename-in-place (RECON)

**Created:** 2026-06-15 · **Type:** READ-ONLY decision recon. No schema, no migration, no code, no build.
**Question (discovered Q-C in [ACCUMULATOR-PRECONDITIONS.md:168-174](ACCUMULATOR-PRECONDITIONS.md)):** how does the
node model's `cost_objects` table relate to the EXISTING `business_assets` table?
**Spine:** [COST-TO-PRODUCE-DESIGN.md](COST-TO-PRODUCE-DESIGN.md) §5 (node model) · `business_assets` migrations.

**Bottom line (read first):** `business_assets` is **literally the ASSET-node already built** — its columns
COMPOSE cleanly with the node fields with exactly **ONE conflict** (`status`, an asset-only NOT-NULL CHECK
enum). The code blast-radius for a table rename is **~6 call sites across 2 files** (vs. the 17-file plants
repoint), and Postgres auto-carries the 2 FK dependents on a rename (proven on plants→cultivar_plants).
**Recommendation: C (rename-in-place → `cost_objects`)** — because **B and C reach the SAME end state**
(one table, all node types) but C gets there with NO data migration, and **A's two-source-of-truth is a
permanent cost the design explicitly rejects** (§5.1: "One table"). The one-time friction of C (broaden the
`status` CHECK + add a `node_type='ASSET'` filter to 2 existing asset queries) is cheaper than A's permanent
join/drift and safer than B's migrate+drop.

---

## PART 1 — `business_assets`: exact current shape

### Columns (from [20260612_business_assets_inventory_pmi_service.sql:27-47](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql) + [20260612_..._cost_confidence.sql:32-35](../../supabase/migrations/20260612_business_assets_inventory_cost_confidence.sql))

| Column | Type | Null? | Default | Note |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `business_id` | uuid | NOT NULL | — | FK → `businesses(id)` ON DELETE CASCADE; RLS scope |
| `name` | text | NOT NULL | — | generic — every node has a name |
| `asset_type` | text | nullable | — | free-text (vehicle/tool/equipment/property…) — **asset-only** |
| `make` | text | nullable | — | **asset-only** |
| `model` | text | nullable | — | **asset-only** |
| `serial_number` | text | nullable | — | **asset-only** |
| `year` | int | nullable | — | **asset-only** |
| `barcode_id` | text | nullable | — | **asset-only** |
| `assigned_to` | jsonb | nullable | — | **asset-only** |
| `status` | text | **NOT NULL** | `'ACTIVE'` | **CHECK** (`ACTIVE`/`IN_REPAIR`/`OFFLINE`/`RETIRED`) — **⚠ asset-only enum** |
| `acquisition_cost` | numeric(10,2) | nullable | — | = the node model's ASSET `purchase_cost` |
| `warranty_months` | int | nullable | — | **asset-only** |
| `photo_url` | text | nullable | — | **asset-only-ish** |
| `notes` | text | nullable | — | generic |
| `is_active` | boolean | NOT NULL | `true` | generic |
| `created_at` | timestamptz | NOT NULL | `now()` | generic |
| `updated_at` | timestamptz | NOT NULL | `now()` | generic (trigger `set_updated_at_generic()`) |
| `location` | text | nullable | — | added in cost_confidence migration |
| `cost_confidence` | text | nullable | — | **CHECK** (`CONFIRMED`/`DERIVED`/`ESTIMATED`/`UNKNOWN`) — generic, useful for ALL node types |

### Constraints / indexes / RLS
- **PK:** `id`.
- **FK out:** `business_id` → `businesses(id)` ON DELETE CASCADE.
- **CHECKs:** `status` (4-value asset enum), `cost_confidence` (4-value epistemic enum).
- **Indexes:** none declared beyond the PK in the migration (no explicit `CREATE INDEX`).
- **RLS:** ENABLED. Two policies, both `FOR ALL` (USING + WITH CHECK): `business_assets_owner_all`
  (`businesses.owner_id = auth.uid()`) and `business_assets_member_all` (`business_members` active row).
  ([:49-83](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql)) — AC-2 compliant,
  business_id-scoped. **These policies are reusable as-is for `cost_objects`** (same `business_id` scope).
- **Trigger:** `business_assets_updated_at` BEFORE UPDATE → `set_updated_at_generic()`.

### The 2 FK DEPENDENTS (tables that FK INTO `business_assets`)
1. **`business_pmi_schedule.asset_id`** → `business_assets(id)` ON DELETE CASCADE
   ([:166](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql)) — the maintenance
   PLAN (interval, tasks) per asset.
2. **`business_service_log.asset_id`** → `business_assets(id)` ON DELETE CASCADE
   ([:229](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql)) — the cost-carrying
   service EVENTS (`cost` + `receipt_id` count-once seam). **This is the PM cost stream the accumulator reads.**

Both reference by `asset_id` (column name does **not** change on a table rename) → a Postgres `ALTER TABLE …
RENAME` auto-carries both FKs (the constraint targets the table OID, not its name). Proven on the
plants→cultivar_plants untangle ([20260613_cultivar_plants_untangle.sql](../../supabase/migrations/20260613_cultivar_plants_untangle.sql)).

### The ASSET UI — repoint blast-radius (the cost of rename/subsume)
**`.from('business_assets')` appears in exactly 2 code files, ~6 call sites total** (grep over `packages/`,
`api/`; `dist/` artifact ignored):

| File | Call sites | What they do |
|---|---|---|
| [`packages/cultivar-os/src/pages/BusinessAssets.tsx`](../../packages/cultivar-os/src/pages/BusinessAssets.tsx) (374 ln) | `:132` select, `:179` insert | the asset manager form (read list + insert one asset) |
| [`packages/shared/src/modules/PMI.tsx`](../../packages/shared/src/modules/PMI.tsx) | `:146`, `:215`, `:291`, `:361` (`business_assets`) + 6× `business_pmi_schedule` + 1× `business_service_log` insert | PM module — reads assets, reads/writes schedule + service log |

**Blast-radius verdict: SMALL.** A table rename = a `business_assets` → `cost_objects` find-replace across 2
files (vs. the 17-file plants repoint). **The one extra step beyond pure find-replace:** because a renamed
`cost_objects` would also hold PROJECT/PRODUCT rows, the existing asset queries must add `.eq('node_type',
'ASSET')` so the asset manager and PMI don't surface projects/products. That is ~6 query edits in the same 2
files — still small, still confined. `asset_id` references in PMI are unaffected (column name unchanged).

---

## PART 2 — `cost_objects`: the node fields the model needs

From [COST-TO-PRODUCE-DESIGN.md §5.1:253-274](COST-TO-PRODUCE-DESIGN.md) + the two resolved schema questions
in [ACCUMULATOR-PRECONDITIONS.md Part 2](ACCUMULATOR-PRECONDITIONS.md):

| Node field | Needed on | `business_assets` ALREADY has it? |
|---|---|---|
| `node_type` text CHECK (`ASSET`/`PROJECT`/`PRODUCT`) | all | **NET-NEW** (discriminator) |
| `parent_id` uuid nullable FK → self (containment) | all | **NET-NEW** (no existing `parent_id`) |
| `domain` text CHECK (`business`/`personal`/`household`) | all (carve-out, Part 2A) | **NET-NEW** |
| `name` | all | ✅ **EXISTS** (NOT NULL) |
| `business_id` (RLS scope) | all | ✅ **EXISTS** |
| `purchase_cost` (ASSET) | ASSET | ✅ **EXISTS as `acquisition_cost`** (name differs, same concept) |
| `purchase_date` (ASSET) | ASSET | **NET-NEW** (nullable) |
| `vendor_id` (ASSET) | ASSET | **NET-NEW** (nullable) |
| `cost_confidence` | all (genuinely cross-type) | ✅ **EXISTS** |
| `budget_estimate` (PROJECT) | PROJECT | **NET-NEW** (nullable) |
| `status` open/closed/converted (PROJECT) | PROJECT | ⚠ **COLLIDES** with the asset `status` enum (see Part 3) |
| `unit_type` item/customer-month/billable-hour (PRODUCT) | PRODUCT | **NET-NEW** (nullable) |
| `selling_price` (PRODUCT) | PRODUCT | **NET-NEW** (nullable) |

**Edge fields are NOT on `cost_objects`.** `use_fraction` / `basis_label` / `basis_kind` (the attribution
edge primitive, [ACCUMULATOR Part 2B](ACCUMULATOR-PRECONDITIONS.md)) live on a **separate, net-new edges
table** (§5.2 containment + contribution). They do not touch `business_assets` either way — neutral to this
decision.

---

## PART 3 — THE COMPOSE-OR-CONFLICT TEST (the deciding factor)

Laying `business_assets`'s columns beside the node fields:

**COMPOSES cleanly (the bulk):**
- Generic columns serve every node type as-is: `id`, `business_id`, `name`, `notes`, `is_active`,
  `created_at`, `updated_at`, `cost_confidence`. No name or meaning collision.
- `acquisition_cost` IS the ASSET node's `purchase_cost` — usable directly (name difference is cosmetic;
  the rollup reads it for ASSET rows).
- The net-new node columns (`node_type`, `parent_id`, `domain`, `purchase_date`, `vendor_id`,
  `budget_estimate`, `unit_type`, `selling_price`) have **no existing column of the same name** in
  `business_assets` — in particular there is **no existing `parent_id`** meaning anything else, so the
  containment edge column drops in with zero collision.

**The always-null pile (tolerable):** PROJECT and PRODUCT rows would carry ~9 asset-only columns that are
always null for them — `asset_type`, `make`, `model`, `serial_number`, `year`, `barcode_id`, `assigned_to`,
`warranty_months`, `photo_url` (and `location` is asset-ish). **All are NULLABLE**, so PROJECT/PRODUCT rows
simply leave them null. "Some null columns = fine" — this is a moderate, not fatal, pile. It is a mild
tidiness smell, not a correctness problem.

**THE ONE REAL CONFLICT — `status`:**
- `business_assets.status` is **NOT NULL DEFAULT 'ACTIVE'** with a **CHECK constrained to the asset
  vocabulary** (`ACTIVE`/`IN_REPAIR`/`OFFLINE`/`RETIRED`).
- The node model's PROJECT type needs a DIFFERENT status vocabulary: `open`/`closed`/`converted`
  (§5.1:271). PRODUCT has no status concept in that column at all.
- So a PROJECT row inserted into a renamed table would be **forced to carry an asset status that is
  meaningless for it**, and the CHECK would **reject** `'converted'`. This column does NOT compose.

**Resolution for the conflict (small, one-time):** at rename time, EITHER (a) broaden the CHECK to the union
of asset + project statuses, OR (b) drop the table-level CHECK and validate status per `node_type` in the
app/rollup, OR (c) add a separate `project_status` column and leave `status` asset-only. (b) or (c) is
cleanest — keeps asset `status` honest and gives projects their own lifecycle field. This is a single
CHECK/column alter folded into the same migration that adds the node columns — NOT a separate project.

**Compose verdict: COMPOSES with one bounded conflict (`status`).** This is exactly the profile where
RENAME-IN-PLACE is viable: the existing rows ARE the ASSET nodes, the generic columns serve all types, the
asset-only columns are nullable, and the single enum conflict is a one-line CHECK fix.

---

## PART 4 — THE THREE OPTIONS, RE-ARGUED ON THE REAL DATA

### First, the dominance insight that collapses the field
**B (subsume-migrate) and C (rename-in-place) have the SAME end state:** one `cost_objects` table holding
ASSET + PROJECT + PRODUCT (+ residence root), asset columns present, node columns added. The ONLY difference
is the *path* to that state:
- **C** reaches it by `ALTER TABLE business_assets RENAME TO cost_objects` + `ADD COLUMN …` — **no rows
  move, FK dependents auto-follow, existing UI keeps working** (post-rename + node_type filter).
- **B** reaches it by CREATE new table → COPY rows → DROP+RECREATE both FK dependents to point at the new
  table → DROP `business_assets` → repoint UI by table name **and** restructure.

Since the destinations are identical, **C dominates B**: same model, strictly less risk and less work. **B is
eliminated** unless there is a reason to want a different physical structure than C produces — and there
isn't (the asset columns must live somewhere regardless).

### C — RENAME-IN-PLACE → `cost_objects` ✅ RECOMMENDED
**For:**
- **No data migration.** Existing asset rows stay put and become `node_type='ASSET'` (set a DEFAULT/backfill
  on the new column). The ASSET-node half is "~80% already built" ([ACCUMULATOR Part 4](ACCUMULATOR-PRECONDITIONS.md)) —
  rename makes that literal instead of re-deriving it.
- **FK dependents auto-follow** the rename (both `asset_id` FKs target the OID) — proven on
  plants→cultivar_plants. No FK drop/recreate.
- **Small, confined code repoint:** ~6 `.from()` call sites in 2 files (BusinessAssets.tsx, PMI.tsx) +
  add `.eq('node_type','ASSET')` to the existing asset queries. Far below the 17-file plants repoint.
- **RLS policies reusable as-is** (business_id-scoped owner_all + member_all) — just renamed with the table.
- **Aligns with the design's stated intent** — §5.1: "No `asset_objects`, `project_objects` … One table."
- **AC-1 satisfied** by renaming to the GENERAL concept (`cost_objects` / `business_cost_objects`), not a
  hybrid like `business_assets_cost_object`.

**Against:**
- The `status` CHECK conflict must be resolved in the same migration (broaden / drop / split — Part 3).
  One-line, but it IS a change to a constraint on a live (currently zero-row) table.
- PROJECT/PRODUCT rows carry ~9 always-null asset columns (mild tidiness smell, all nullable).
- The asset-manager + PMI queries must learn to scope by `node_type='ASSET'` so they don't surface
  projects/products. ~6 query edits, same 2 files.

### A — BRIDGE (new `cost_objects`, FK ↔ `business_assets`)
**For:**
- Zero migration of the working asset manager — BusinessAssets.tsx + PMI.tsx untouched.
- `cost_objects` gets a purpose-built schema for PROJECT/PRODUCT/root with only the fields they need — no
  asset null-pile, no `status` conflict (fresh enum).

**Against:**
- **Two sources of truth for "a cost object."** An ASSET is now a `business_assets` row AND a bridging
  `cost_objects` row, joined by FK. The §5.4 count-once rollup and the §5.2 DAG must permanently JOIN two
  tables to see assets.
- **Drift risk:** create an asset → must also create its `cost_objects` node, or the asset is invisible to
  the rollup. Every asset is two rows that must stay in sync — exactly the silent, data-shaped failure class
  the project keeps getting bitten by.
- **Contradicts the design** ("One table"). Keeps two tables for what §5.1 says should be one.
- The "no migration" win is real but **buys a permanent architectural cost to dodge a one-time one.**

### B — SUBSUME-MIGRATE (move assets into new `cost_objects`, drop `business_assets`)
**For:** clean single model, one source of truth (same destination as C).
**Against:** a real **data migration** (copy rows) + **drop & recreate both FK dependents** to retarget the
new table (cannot auto-follow — it's a new table, not a rename) + repoint UI by name AND restructure. Highest
risk path. **Dominated by C** (same end state, more risk). Eliminated.

### RECOMMENDATION: **C — rename-in-place to `cost_objects`.**
**Deciding reason:** the end state TRACE wants is one table (§5.1). Of the two paths to it, C requires **no
data movement and auto-carries the FK dependents**, while B does a destructive migrate+drop for the identical
result — so B is dominated. Against A, C trades a **one-time, bounded** cost (resolve the `status` CHECK +
tolerate a nullable asset-column pile + scope 2 files by node_type) for elimination of a **permanent**
two-source-of-truth/drift cost that the design explicitly rejects. The fields COMPOSE with exactly one
conflict, and that conflict is a one-line constraint fix — this is the textbook profile for rename-in-place,
the same move that worked on plants→cultivar_plants.

**Is it close?** A is the only real alternative, and it is **not 50/50** — A wins ONLY if you weight
"touch zero existing asset code now" above "avoid permanent dual-write drift forever." Given the project's
repeated silent-data-bug history, the permanent-drift cost is the heavier one. What would tip it toward A:
if the asset manager were large/fragile and the `node_type` filtering risked regressions — but it is 2 small
files with 6 call sites, so that tip-condition does not hold.

**Build-prompt notes if C is chosen (for whoever writes Core-1):**
1. `ALTER TABLE business_assets RENAME TO cost_objects;` (or `business_cost_objects`) — pick the final name.
2. `ADD COLUMN node_type … DEFAULT 'ASSET'` (backfill existing rows to ASSET), `parent_id`, `domain`,
   `purchase_date`, `vendor_id`, `budget_estimate`, `unit_type`, `selling_price`.
3. Resolve `status`: drop the asset-only CHECK and validate per `node_type` in app, OR add `project_status`.
4. Rename RLS policies + trigger with the table (cosmetic).
5. Repoint `.from('business_assets')` → new name in BusinessAssets.tsx (2) + PMI.tsx (4); add
   `.eq('node_type','ASSET')` to the asset-scoped queries.
6. **Schema verification gate** (catalog-backed) per §9 — structure AND RLS proven post-rename.

---

## VERIFY (don't grade own homework)
- Both field lists complete, file:line/migration-backed: ✅ `business_assets` (20-col table, migration-cited);
  node fields (§5.1:253-274 + ACCUMULATOR Part 2).
- 2 FK dependents named precisely: ✅ `business_pmi_schedule.asset_id`, `business_service_log.asset_id` (both
  ON DELETE CASCADE, line-cited).
- Asset-UI repoint blast-radius assessed: ✅ 2 files, ~6 `.from()` call sites + node_type filter; SMALL.
- Compose-or-conflict answered explicitly: ✅ composes with ONE conflict (`status` asset-only NOT-NULL CHECK)
  + a tolerable nullable asset-column pile.
- Three options re-argued on real data with reasoned recommendation: ✅ B eliminated (dominated by C);
  A vs C decided for **C**, with the tip-condition for A named.

**RESULT:** `business_assets` has [20 cols: 8 generic, ~10 nullable asset-only, `acquisition_cost`=node
purchase_cost, `cost_confidence` cross-type]; node fields **compose cleanly except `status`** (asset-only
NOT-NULL CHECK enum vs project open/closed/converted); rename-in-place is **viable & best** (FK dependents
auto-follow, 2-file repoint, end state == subsume's at no migration cost); **recommendation is C** because
B is dominated (same destination, destructive path) and A's permanent two-source-of-truth costs more than
C's one-time `status`-CHECK fix — and it aligns with §5.1's "one table." David decides A/B/C.

---
*TRACE Enterprises · Built with CAI · RECON artifact, not a build record.*
