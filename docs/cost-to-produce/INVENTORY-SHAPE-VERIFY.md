<!-- RECON ARTIFACT — NOT A DESIGN DOC.
     Findings only. Evidence-backed claims. No migrations, no proposals.
     Authority: live migration files + TypeScript type definitions.
     Design doc (COST-TO-PRODUCE-DESIGN.md) predates business_inventory and
     may be stale — the live schema is the authority wherever they conflict.
     Date: 2026-06-13 (THUNDER VERIFY) -->

# business_inventory — Inventory Shape Verification

**Session:** THUNDER VERIFY — READ-ONLY audit  
**Date:** 2026-06-13  
**Auditor:** Claude Code  
**Scope:** business_inventory vs. settled qty-of-SKU model; plants table classification; MarginEngine orphan state  
**Output:** RECON ARTIFACT. No migrations written. No code changed.

---

## STEP 0 GATE — confirmed

**Session Starter checks echoed before any read:**

1. **Last Handoff (CLAUDE.md Part 3):** 2026-06-13 — THUNDER VALIDATE-THEN-CLOSE.
   business_voice_samples catalog proof persisted + PLATFORM_STATE WIRED.
   Docs-only session. No blocking open items.

2. **Shared modules this session touches:** READ-ONLY audit — no modules edited.
   business_inventory verification reads migration files and TypeScript types only.
   No packages/shared/src/ files touched.

3. **Off Limits / Part 7:** Not touching oauth.ts, supabase/auth.ts,
   old Supabase project ufsgqckbxdtwviqjjtos, any already-run migrations,
   or nursery_modules RLS policy. This is a docs-write only.

---

## CHECK 1 — business_inventory: full column dump + grain classification

**FOUND.** Two migration files define the table.

**Source files:**
- Base: `supabase/migrations/20260612_business_assets_inventory_pmi_service.sql` lines 97–154
- ALTER: `supabase/migrations/20260612_business_assets_inventory_cost_confidence.sql` lines 55–59

### Full column list (as-migrated)

| Column | Type | Nullable | Default | Role |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | gen_random_uuid() | PK |
| `business_id` | uuid | NOT NULL | — | FK → businesses(id) CASCADE |
| `sku` | text | nullable | — | **SKU/type identifier** |
| `name` | text | NOT NULL | — | **SKU display name** |
| `description` | text | nullable | — | metadata |
| `qty` | int | NOT NULL | 0 | **QTY — stock count** |
| `unit_cost` | numeric(10,2) | nullable | — | **COST — flat unit cost** |
| `serial_number` | text | nullable | — | **SERIAL — nullable (set on install-event transfer)** |
| `location` | text | nullable | — | **LOCATION** |
| `status` | text | NOT NULL | 'available' | lifecycle state |
| `received_at` | timestamptz | nullable | — | when stock arrived |
| `photo_url` | text | nullable | — | metadata |
| `notes` | text | nullable | — | metadata |
| `created_at` | timestamptz | NOT NULL | now() | audit |
| `updated_at` | timestamptz | NOT NULL | now() | audit (trigger wired) |
| `receipt_id` | uuid | nullable | — | **RECEIPT LINK** → receipts(id) ON DELETE SET NULL |
| `cost_confidence` | text | nullable | — | CHECK IN ('CONFIRMED','DERIVED','ESTIMATED','UNKNOWN') |

**Evidence:** `20260612_business_assets_inventory_pmi_service.sql`:97–113 (base);
`20260612_business_assets_inventory_cost_confidence.sql`:55–59 (ALTER).

### RLS policies

Two policies (no SELECT-only policy — uses USING for all operations):

- `business_inventory_owner_all`: `USING(EXISTS(SELECT 1 FROM businesses WHERE id = business_inventory.business_id AND owner_id = auth.uid()))` + matching WITH CHECK.
- `business_inventory_member_all`: `USING(EXISTS(SELECT 1 FROM business_members WHERE business_id = business_inventory.business_id AND user_id = auth.uid() AND active = true))` + matching WITH CHECK.

**Evidence:** `20260612_business_assets_inventory_pmi_service.sql`:117–148.

### FKs and CHECKs

- `business_id` → `businesses(id)` ON DELETE CASCADE
- `receipt_id` → `receipts(id)` ON DELETE SET NULL (nullable)
- CHECK: `cost_confidence IN ('CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN')`

### Grain verdict

**MATCHES qty-of-SKU model.** The table has:
- `qty` int NOT NULL — stock count at SKU grain ✅
- `sku` text nullable + `name` text NOT NULL — SKU identifier ✅
- `serial_number` text nullable — serial field, nullable per design ("set on install-event transfer") ✅
- `unit_cost` numeric(10,2) nullable — flat unit cost ✅
- `location` text nullable — location ✅
- `receipt_id` uuid nullable — receipt link (count-once dedup seam) ✅

The table is correctly structured as a qty-of-SKU batch grain, not an individual-item grain.

---

## CHECK 2 — COST on the inventory row: flat-only or accrual-capable?

**FLAT-ONLY. No accrual mechanism exists.**

### What IS present

- `unit_cost numeric(10,2)` — flat unit cost field. Supports FLAT cost today.
  **Evidence:** `20260612_business_assets_inventory_pmi_service.sql`:104
- `cost_confidence text CHECK(...)` — epistemic status of unit_cost.
  **Evidence:** `20260612_business_assets_inventory_cost_confidence.sql`:57–59
- `receipt_id uuid REFERENCES receipts(id)` — the count-once dedup seam.
  This is a single receipt link, NOT a cost accumulator. It marks "this stock
  purchase came from this receipt" and prevents double-counting cost vs. QB expense.
  **Evidence:** `20260612_business_assets_inventory_cost_confidence.sql`:56

### What is NOT present (accrual capability)

- No `cost_object_id` FK — no link to a cost-object node or accumulator
- No `accrued_cost` column — no running stage-cost total on the row
- No `cost_event` FK — no event/history table linked
- No `stage` or `lot` columns — no stage-cost ladder metadata
- No cost history table referenced from business_inventory

**Grep result for accrual keywords** (`cost_object`, `accrual`, `stage`, `ladder`,
`lot`, `accrued`, `cost_event`) across `supabase/migrations/`, `packages/shared/src/`,
`packages/cultivar-os/src/` — **ZERO hits.**

### Verdict

`business_inventory` supports FLAT unit cost only. The `receipt_id` field is the dedup
seam for the count-once rule (per design §5.4) but is NOT an accrual accumulator. The
stage-cost ladder / lot-horizon / CARRY path are all DESIGN (no code, no schema, no
migration). `unit_cost` is the only cost field; it holds a point-in-time value, not an
accumulated total.

---

## CHECK 3 — COST-OBJECT / ACCUMULATOR link

**NOT FOUND.**

No cost-object table, no accumulator, no attribution edges, no stage-cost ladder exist
in any migration, in `packages/shared/src/`, or in `packages/cultivar-os/src/`.

Keywords searched: `cost_object`, `accrual`, `stage_cost`, `cost_event`, `accrued`,
`lot_cost`, `ladder`. **All zero-hit.**

The design doc (`COST-TO-PRODUCE-DESIGN.md` §13) confirms:
> "Items listed in this design that have zero code, schema, or migration:
>  Cost-object node model (`cost_objects` table, attribution edges)"

The gap is explicit and consistent: `business_inventory` can carry a FLAT `unit_cost`
today. The cost-object accumulator (the source of ACCRUING cost for lot-stage verticals
like Cultivar) does not exist yet. This is the key delta between today's schema and the
settled model's full capability.

---

## CHECK 4 — plants table: identity/profile vs. stock fact; FK to business_inventory

**FOUND (standalone de-facto inventory — NOT a clean join table).**

### Source

No `CREATE TABLE plants` exists in any `.sql` migration file in `supabase/migrations/`.
The table predates the migrations directory or was created directly in Supabase.

Plant columns inferred from TypeScript type definition (authoritative for query shape):
**Source:** `packages/cultivar-os/src/types/plant.ts` lines 1–19.

### Column classification

| Column | Type | Classification |
|---|---|---|
| `id` | string | PK |
| `nursery_id?` | string \| undefined | legacy vertical noun — AC-1 violation (pending purge) |
| `business_id` | string | tenant FK |
| `tag_id` | string | **IDENTITY** — QR scan key |
| `species` | string | **IDENTITY** — botanical identity |
| `common_name` | string \| null | **IDENTITY** |
| `plant_type` | enum string | **IDENTITY** — growth form |
| `current_container` | string | **IDENTITY** — container size/type |
| `location_zone` | string \| null | **IDENTITY** — physical zone in nursery |
| `warranty_months` | number | **IDENTITY/PROFILE** — warranty term |
| `status` | enum string | **STOCK FACT** — lifecycle state (available/reserved/sold/lost/donated) |
| `base_price` | number | **STOCK FACT** — selling price |
| `install_price` | number | **STOCK FACT** — add-on price |
| `arrived_at` | string \| null | **STOCK FACT** — receipt date |
| `photo_url` | string \| null | metadata |
| `notes` | string \| null | metadata |
| `created_at` | string | audit |
| `updated_at` | string | audit |

### FK to business_inventory

**ABSENT.** No `inventory_id` or `business_inventory_id` column exists on plants.
Plants is entirely disconnected from business_inventory.

**Evidence:** `packages/cultivar-os/src/types/plant.ts` — no FK column to inventory.
`packages/cultivar-os/src/hooks/usePlant.ts`:63–66 — `.from('plants').select('*')` — no join to business_inventory.

### Grain discrepancy

Plants uses an **individual-item grain** (one row per physical plant/tag_id). Available
count is derived by counting rows with matching species+container+status='available'
(`usePlant.ts`:84–90). This is a different grain from business_inventory's qty-of-SKU
batch grain (one row + qty field). The two tables use incompatible grain assumptions.

### De-facto inventory verdict

Plants IS acting as de-facto inventory for the Cultivar vertical:
- Holds stock facts (status, base_price, arrived_at) that the settled model places on business_inventory
- Has NO FK link to business_inventory
- Uses individual-item grain, not SKU-batch grain

**Untangling required** before a plant record can use business_inventory.unit_cost as its
cost input: a FK from plants → business_inventory (or vice versa) must be added, and
stock facts must be reconciled between the two tables.

### Cost column on plants

**ABSENT.** `cost_price` does not exist on plants. Neither does `unit_cost` or any cost field.
`base_price` and `install_price` are SELLING PRICES, not cost fields.
**Evidence:** `packages/cultivar-os/src/types/plant.ts` — no cost column in the type.

---

## CHECK 5 — cost_price target: is the design doc §15 Step 1 stale?

**YES. STALE.**

### What the design doc says

`COST-TO-PRODUCE-DESIGN.md` §15 Build Sequencing Step 1:
> "`plants.cost_price` column migration → unblocks first Cultivar MarginEngine caller"

§9 also:
> "First Cultivar caller blocker: `plants.cost_price` column does not exist."

### Why it is stale

1. `business_inventory` now EXISTS with `unit_cost numeric(10,2)` — the correct home for
   flat unit cost per the settled model. The design doc was written 2026-06-12, the same
   day the migration was created — the doc may predate or have been written in parallel
   with the migration without reconciling.

2. The settled model places cost on the **shared inventory row** (business_inventory.unit_cost),
   NOT on the vertical identity table (plants). Adding `plants.cost_price` would duplicate
   cost storage in the vertical layer and bypass the shared model entirely — an AC-1 violation
   (vertical table holding a stock fact that belongs to shared inventory).

3. The REAL blocker for a Cultivar MarginEngine caller is not a missing column on plants —
   it is the **missing FK** between plants and business_inventory. Until a plant row can
   resolve to a business_inventory row, there is no read path to `business_inventory.unit_cost`.

### Corrected location for cost

**`business_inventory.unit_cost`** — already present. No new column needed.

The missing piece is the **join between plants and business_inventory**:
- One option: add `inventory_id uuid REFERENCES business_inventory(id)` to plants
  (plants FK → inventory row; inventory row carries qty + unit_cost).
- Alternative: build a lookup by sku (plants.species + container → inventory.sku) without
  a hard FK, if the business prefers a softer join.

The design doc's Step 1 (`plants.cost_price`) should be replaced with:
"Wire plants → business_inventory FK (or sku-based lookup) to enable reads of
`business_inventory.unit_cost` as the MarginEngine `cost` input."

---

## CHECK 6 — MarginEngine input: Cultivar caller trace

**ORPHANED — confirmed. No read path to cost exists.**

### MarginEngine interface

`packages/shared/src/business-logic/MarginEngine.ts`:49–54  
`analyzeTransaction(tx: MarginTransaction, config)` — requires `tx.cost: number`.

### Cultivar callers

Grep for `import.*MarginEngine` or `from.*MarginEngine` in `packages/cultivar-os/`:
**ZERO results.** MarginEngine is NOT imported by any Cultivar file.

**Evidence:** Confirmed by grep scan of packages/cultivar-os/ (no output).
Consistent with PLATFORM_STATE.md: "Business-Logic · MarginEngine.ts | ORPHANED".

### What a Cultivar caller would read cost FROM today

Today: **no path exists.** A caller would need to:
1. Know the plant's inventory identity (via a FK or sku-based lookup that doesn't exist)
2. Read `business_inventory.unit_cost` from the resolved row
3. Pass that value as `tx.cost` to `analyzeTransaction()`

Step 1 has no schema support. The FK between plants and business_inventory is absent.
The column on business_inventory exists; the join does not.

### MarginEngine orphan state: confirmed

MarginEngine is BUILT and ORPHANED for Cultivar. The unlock requires:
- business_inventory.unit_cost: **PRESENT** ✅
- plants → business_inventory FK (or sku lookup): **ABSENT** ❌
- MarginEngine import in cultivar caller: **ABSENT** ❌

Both the join and the caller must be added before MarginEngine can operate in Cultivar.

---

## BOTTOM LINE (4 lines)

**(a) Does business_inventory match the settled qty-of-SKU model?**  
YES. `qty` int + `sku`/`name` SKU identifier + `serial_number` nullable + `unit_cost` + `location` + `receipt_id` dedup seam. Grain and column shape match.

**(b) Flat-only or accrual-capable?**  
FLAT-ONLY. `unit_cost` is a point-in-time value; no cost-object FK, no event history, no stage-cost ladder. `receipt_id` is a dedup seam, not an accumulator. Accrual is entirely DESIGN (no code, no migration, no table).

**(c) Is plants a clean join or de-facto-inventory untangle?**  
DE-FACTO-INVENTORY untangle. Plants holds its own stock facts (status, base_price, arrived_at), uses individual-item grain (not SKU-batch), and has NO FK to business_inventory. Adding cost to Cultivar requires wiring plants → business_inventory, not adding a cost column to plants.

**(d) Corrected home for cost_price.**  
`business_inventory.unit_cost` — already exists. Design doc §15 Step 1 (`plants.cost_price`) is STALE. The correct Step 1 is: add `inventory_id` FK from plants → business_inventory (or establish a sku-based lookup), enabling reads of the already-present `business_inventory.unit_cost` as the MarginEngine `cost` input.

---

## CORRECTION — 2026-06-13 (THUNDER UNTANGLE session)

**CHECK 4 conclusion was correct but the proposed fix was framed as a join-option exploration.
The actual execution resolved it definitively.**

The following is now DONE (migration `20260613_cultivar_plants_untangle.sql`, test-data-only):

1. `plants` RENAMED to `cultivar_plants`. The `cultivar_` prefix marks vertical identity join per AC-1.
2. `inventory_id uuid REFERENCES business_inventory(id)` ADDED (nullable; lot population sequenced separately).
3. Stock-fact columns DROPPED from `cultivar_plants`: `status`, `arrived_at`, `base_price`, `install_price`.
4. `nursery_id` DROPPED (AC-1 violation — vertical noun as column value, not identity).
5. RLS policy updated: `authenticated_select_plants` (referenced `nursery_id`) → `cultivar_plants_owner_select` (uses `business_id`, membership-scoped, consistent with business_assets/business_inventory pattern).
6. All code repointed: `usePlant`, `PlantHero`, `PlantCard`, `PlantProfile`, `AddOns`, `CartReview`, `Confirmation`, `useSubmitOrder`, `dashboard.ts`, `submit.ts`, `qbo/invoice/cultivar.ts`, `social/generate-posts.ts`, `Orders.tsx`, `DeliveryRoute.tsx`.

**The premise in CHECK 4 ("Grain discrepancy — Plants uses an individual-item grain") is now resolved.**
cultivar_plants is identity-only (tag_id, species, container, zone, warranty_months).
Stock grain (qty-of-SKU) lives entirely on business_inventory. The tables are now on separate grains by design.

**This doc's CHECK 5 ("design doc §15 Step 1 is stale") is also now resolved.**
The FK exists. The correct cost read path for a future Cultivar MarginEngine caller is:
`cultivar_plants.inventory_id → business_inventory.unit_cost`.

**What this untangle does NOT do (sequenced separately):**
- Does NOT populate inventory_id on existing cultivar_plants rows (lot population step)
- Does NOT build the stage-cost ladder / accrual model (still DESIGN)
- Does NOT wire MarginEngine in a Cultivar caller (requires lot population first)
