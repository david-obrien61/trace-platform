# Asset ⟷ Node Schema Decision — RE-RUN through HAVE / NEED / WANT (RECON, A/B test)

**Created:** 2026-06-15 · **Type:** READ-ONLY recon. No schema, no migration, no code, no build.
**A/B against:** [ASSET-NODE-SCHEMA-DECISION.md](ASSET-NODE-SCHEMA-DECISION.md) (first run — bridge/subsume/rename).
**Same question:** how does the node model's `cost_objects` relate to the EXISTING `business_assets`?
**This run's discipline:** the THREE-LENS structure — HAVE (factual floor) / NEED (irreducible minimum) /
WANT (clean end-state) — kept strictly separated, then options presented across the NEED→WANT spectrum.
**Spine:** [COST-TO-PRODUCE-DESIGN.md §5](COST-TO-PRODUCE-DESIGN.md) · `business_assets` migrations.

**Bottom line (read first):** The three lenses produced **richer options and a sharper rationale, same final
recommendation (C, rename-in-place).** New from this run: (1) two options the first run never listed —
**D (minimal: add only `parent_id`+`node_type` in place, defer the rename)** and **E (view-bridge)**; (2) a
verified fact — **`business_assets` has no seed/insert path beyond the UI form → ~zero rows**, which collapses
B's "data migration" objection; (3) a new dominance — **A is dominated by E** (E gives A's "don't touch asset
code" benefit without A's per-asset dual-write); (4) the deepest finding — the §5.2 **attribution edges need a
unified node id-space, which pulls "one table" out of the WANT column and toward NEED** (it's load-bearing for
the accumulator's core mechanism, not mere tidiness). Net: C still wins, but now for a *structural* reason
(edges) rather than only a *drift* reason — and the cheap defer-path D is on the table if Core-1 must ship
before the naming question is settled.

---

## LENS 1 — HAVE (the factual floor, file:line)

### `business_assets` exact shape — verified against migration source, not the first-run doc
From [20260612_business_assets_inventory_pmi_service.sql:27-47](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql)
+ [..._cost_confidence.sql:32-35](../../supabase/migrations/20260612_business_assets_inventory_cost_confidence.sql):

| Column | Type | Null? | Default | Class |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | generic (node id) |
| `business_id` | uuid | NOT NULL | — | generic (RLS scope, FK→businesses CASCADE) |
| `name` | text | NOT NULL | — | generic (every node) |
| `asset_type` | text | nullable | — | asset-only |
| `make` | text | nullable | — | asset-only |
| `model` | text | nullable | — | asset-only |
| `serial_number` | text | nullable | — | asset-only |
| `year` | int | nullable | — | asset-only |
| `barcode_id` | text | nullable | — | asset-only |
| `assigned_to` | jsonb | nullable | — | asset-only |
| `status` | text | **NOT NULL** `'ACTIVE'` | CHECK `ACTIVE/IN_REPAIR/OFFLINE/RETIRED` | **asset-only enum (the one conflict)** |
| `acquisition_cost` | numeric(10,2) | nullable | — | **= node `purchase_cost`** |
| `warranty_months` | int | nullable | — | asset-only |
| `photo_url` | text | nullable | — | asset-only-ish |
| `notes` | text | nullable | — | generic |
| `is_active` | boolean | NOT NULL | `true` | generic |
| `created_at` | timestamptz | NOT NULL | `now()` | generic |
| `updated_at` | timestamptz | NOT NULL | `now()` | generic (trigger `set_updated_at_generic()`) |
| `location` | text | nullable | — | asset-ish (cost_confidence migration) |
| `cost_confidence` | text | nullable | — | CHECK `CONFIRMED/DERIVED/ESTIMATED/UNKNOWN` — **cross-type** |

**Tally:** 20 columns — 8 generic (serve every node), `acquisition_cost` (= node purchase_cost),
`cost_confidence` (cross-type), 1 conflicting enum (`status`), ~9 nullable asset-only.

### Node fields business_assets ALREADY has (vs net-new)
- **HAS:** `name`, `business_id`, `acquisition_cost` (=`purchase_cost`), `cost_confidence`, generic
  housekeeping. The ASSET node is **~80% already materialized** ([ACCUMULATOR-PRECONDITIONS.md Part 4](ACCUMULATOR-PRECONDITIONS.md)).
- **NET-NEW (no name collision — verified no existing `parent_id`):** `node_type`, `parent_id`, `domain`,
  `purchase_date`, `vendor_id`, `budget_estimate`, `unit_type`, `selling_price`
  ([design §5.1:253-274](COST-TO-PRODUCE-DESIGN.md)).

### Constraints / RLS / dependents
- **RLS ENABLED**, two `FOR ALL` policies — `business_assets_owner_all` (`businesses.owner_id=auth.uid()`,
  [:51-65](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql)) + `business_assets_member_all`
  (`business_members` active, [:67-83](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql)).
  AC-2 compliant, `business_id`-scoped → **reusable as-is** for a node table (same scope key).
- **Trigger:** `business_assets_updated_at` BEFORE UPDATE → `set_updated_at_generic()` ([:86-89](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql)).
- **2 FK dependents, both `asset_id … ON DELETE CASCADE`:**
  `business_pmi_schedule.asset_id` ([:166](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql)) and
  `business_service_log.asset_id` ([:229](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql) — the PM cost stream the accumulator reads).
  Both reference by **column** `asset_id` (unchanged by a *table* rename → auto-follow, proven on
  [plants→cultivar_plants](../../supabase/migrations/20260613_cultivar_plants_untangle.sql)).

### Asset UI — repoint blast radius (verified by grep, dist excluded)
`.from('business_assets')` = **6 call sites in 2 files**:
- [PMI.tsx:146, :215, :291, :361](../../packages/shared/src/modules/PMI.tsx) (4)
- [BusinessAssets.tsx:132 (select), :179 (insert)](../../packages/cultivar-os/src/pages/BusinessAssets.tsx) (2)

`asset_id` (9 refs in PMI.tsx) are FK-value uses, **unaffected by a table rename**.

### ⭐ NEW HAVE-FACT the first run never checked — ROW COUNT
`grep` for any seed/insert into `business_assets` across `scripts/ seed/ supabase/` and code: **the only write
path is the UI form** ([BusinessAssets.tsx:179](../../packages/cultivar-os/src/pages/BusinessAssets.tsx)) —
**no seed script, no demo fixture.** The cost_confidence migration's own header asserts "Both tables: ZERO
rows" at write time. So `business_assets` is **empty or near-empty** (only hand-entered rows, if any). The
first run reasoned about option B as "a real data migration (copy rows)" — **on a near-zero-row table that
copy is nearly free.** This single fact deflates B's main "Against."

---

## LENS 2 — NEED (irreducible minimum — preferences stripped out)

**The real requirement:** an asset participates in the cost tree and feeds the tile's loaded cost.

**What MUST exist for that — and nothing more:**
1. An asset row must carry a **`node_type`** so the rollup can classify it.
2. An asset row must carry a **`parent_id`** so it can be contained by a PROJECT/PRODUCT (the containment
   edge that makes "roll up" mean anything).
3. The rollup must be able to **read assets in the same id-space as the projects/products they roll into.**

**That is the whole NEED.** Strictly NOT required to satisfy it:
- ❌ Renaming the table. The rollup keys on `node_type`, not the table name.
- ❌ Adding `domain`, `purchase_date`, `vendor_id`, `budget_estimate`, `unit_type`, `selling_price` **to the
  asset rows** — those belong to other node types or are later-phase ASSET niceties.
- ❌ Resolving the `status` CHECK conflict — only bites if PROJECT rows are forced into this table.
- ❌ Moving or migrating any data.

So the **cheapest thing that meets NEED is: add two columns** (`parent_id`, `node_type DEFAULT 'ASSET'`) to
`business_assets` in place. Everything beyond that is WANT.

**⭐ But NEED #3 has teeth — and it's where the first run under-reasoned.** "Same id-space" is not free-form.
The §5.2 attribution edges (containment **and** contribution) are **inherently cross-node-type**: design's own
worked path is "flower-bed **ASSET** → office **PROJECT** → house **PRODUCT**"
([COST-TO-PRODUCE-DESIGN.md §5.2](COST-TO-PRODUCE-DESIGN.md)). A `parent_id` self-FK — and the separate edges
table — can only be a **clean foreign key if ASSET, PROJECT, and PRODUCT share one table.** Split them across
tables and every edge becomes **polymorphic** (`(node_table, node_id)`) with **no referential integrity** — a
silent-orphan surface, exactly the failure class this project keeps getting bitten by. So **"one node table"
is not a tidiness-WANT — the edge mechanism (the accumulator's core) pulls it into NEED-adjacent.** This is the
finding the three-lens split produced that the first run's flat A/B/C framing buried under "drift."

---

## LENS 3 — WANT (clean end-state — each labeled as a want, not smuggled in as need)

- **WANT-1 · Single physical node table** (§5.1 "One table. No `asset_objects`…"). *Value:* one query surface,
  clean self-FK edges. *(Per NEED above, this one is partly load-bearing, not pure want.)*
- **WANT-2 · AC-1 general name** — the table is called `cost_objects`, not `business_assets`, because it holds
  projects and products too. *Value:* honest naming; no vertical/category noun lying about contents.
- **WANT-3 · No two-source-of-truth / no per-entity dual-write.** *Value:* an asset is ONE row, not "an asset
  row + a node row kept in sync."
- **WANT-4 · Asset `status` stays honest** — `ACTIVE/IN_REPAIR/…` not polluted by `open/closed/converted`.
- **WANT-5 · No always-null column pile** — PROJECT/PRODUCT rows don't carry 9 meaningless asset columns.

Note WANT-2 and WANT-5 are in mild tension with WANT-1 under a rename: one table buys AC-1-general-name only
if you rename (WANT-2 ✅) but then PROJECT/PRODUCT rows sit in a table with asset columns (WANT-5 ✗, all
nullable — tolerable). The spectrum below shows who pays which.

---

## OPTIONS — ordered cheapest-meets-NEED → fullest-meets-WANT

### D — MINIMAL IN-PLACE: add `parent_id` + `node_type` to `business_assets`, defer the rename ⟵ NEW (first run had no D)
- **Satisfies:** NEED in full (asset gets node_type + parent + same-table rollup). Zero WANT.
- **Where do PROJECT/PRODUCT live?** Either also in `business_assets` (then the table is a multi-type node
  table that is *misnamed* — WANT-2 violated, AC-1 smell) **or** in a separate table (then you've reintroduced
  the split-id-space edge problem from NEED #3). Neither sub-path is stable — D is a **way-station, not a
  destination.**
- **Cost/risk:** lowest now — 2 `ADD COLUMN`s, no rename, no status fix, no repoint (asset queries keep
  working; add `.eq('node_type','ASSET')` only if/when other types land in the table).
- **Compose:** trivially — both columns are net-new, no collision, no NOT-NULL pain (`node_type DEFAULT
  'ASSET'`, `parent_id` nullable).
- **Blast radius:** ~0 code now. **BUT:** if PROJECT/PRODUCT later go into this same table you still owe the
  rename (WANT-2) → **D-then-C pays the repoint twice.** That double-cost is D's hidden price.

### E — VIEW-BRIDGE: node columns on `business_assets` + small `cost_objects` table for PROJECT/PRODUCT + a `cost_objects_all` VIEW ⟵ NEW (first run had no E)
- **Satisfies:** NEED + WANT-3 (no per-asset dual-write — assets are nodes *natively* via added columns) +
  WANT-4/WANT-5 (asset `status` untouched; projects/products in a clean purpose-built table, no null pile).
- **Misses:** WANT-1 (two physical tables) and — fatally — **NEED #3:** containment/contribution edges that
  cross ASSET↔PROJECT↔PRODUCT now span two tables, so the edges table FK must go **polymorphic** or the view
  must paper over broken referential integrity. A view gives a unified *read* surface but **cannot give a
  unified FK target for the edges.**
- **Cost/risk:** asset code barely changes (gains nullable columns); but you build + maintain a view AND a
  polymorphic edge scheme. Medium build, permanent structural compromise at the exact seam the accumulator
  depends on.
- **Dominance:** **E dominates A** — it delivers A's entire "don't disturb the working asset manager / give
  projects a clean schema" pitch **without A's per-asset dual-write.** So A is off the table (see below).

### A — FK BRIDGE: separate `cost_objects`, FK per asset → `business_assets`
- **Satisfies:** NEED (via join) + WANT-2/4/5 (asset table untouched, fresh node enum).
- **Misses:** WANT-1, WANT-3 hard. Every asset is **two rows** (the asset + its node) that must be created and
  kept in sync — the canonical silent-data-bug shape. Rollup permanently JOINs two tables to see assets.
- **Verdict: DOMINATED BY E** — E gets A's only real wins without the dual-write. A is eliminated. *(First run
  kept A as "the only real alternative"; the three-lens E option retires it.)*

### B — SUBSUME-MIGRATE: new `cost_objects`, copy asset rows in, drop `business_assets`
- **Satisfies:** full WANT (one renamed clean table) — **same end-state as C.**
- **Cost/risk:** with **~zero rows (new HAVE-fact), the "copy rows" step is ≈ empty.** What remains is the
  real cost: **drop & recreate both FK dependents** to retarget the new table (a *new* table can't auto-follow
  like a rename) + repoint UI by name. So B is cheaper than the first run implied, but still strictly more
  destructive than C for the **identical** result. **Dominated by C.**

### C — RENAME-IN-PLACE: `ALTER TABLE business_assets RENAME TO cost_objects` + add node columns ⟵ first run's pick
- **Satisfies:** full WANT-1 (one table) + WANT-2 (general name) + WANT-3 (one row per asset) + NEED #3
  (unified id-space → clean self-FK edges). **Trades WANT-4/WANT-5:** the `status` CHECK must be resolved and
  PROJECT/PRODUCT rows carry ~9 nullable asset columns.
- **Compose-or-conflict on the real fields:** generic 8 cols + `acquisition_cost` + `cost_confidence` compose
  for all types; 8 net-new node columns have **no name collision** (confirmed no existing `parent_id`); the
  ~9 asset-only columns are **all nullable** → PROJECT/PRODUCT leave them null (tidiness smell, not
  correctness). **Exactly ONE hard conflict: `status`** — NOT-NULL asset CHECK vs PROJECT `open/closed/
  converted`; fix = drop/broaden the CHECK and validate per `node_type`, **or** add `project_status`. One line,
  folded into the same migration.
- **Cost/risk:** one-time. FK dependents **auto-follow the rename** (no drop/recreate). RLS + trigger rename
  cosmetically with the table.
- **Blast radius:** 6 `.from()` sites in 2 files (PMI.tsx ×4, BusinessAssets.tsx ×2) → find-replace to new
  name + add `.eq('node_type','ASSET')` to the asset-scoped reads. Far below the 17-file plants repoint.

**Spectrum recap:** D (NEED only, unstable way-station) → E (NEED+some WANT, breaks the edge id-space) →
A (dominated by E) → B (=C's end, destructive) → **C (full WANT + the load-bearing NEED #3, one-time status
fix).**

---

## COMPARE TO THE FIRST RUN — the A/B finding (explicit)

**What's NEW (three lenses surfaced it; first run did not have it):**
1. **Two new options — D and E.** The first run enumerated only A/B/C (three end-states). Separating NEED
   from WANT forced the question "what's the *least* that works?" → **D** (the minimal defer-path). And asking
   "can we satisfy WANT-3/4/5 without WANT-1?" → **E** (view-bridge). Neither existed in the first run.
2. **A new fact — ~zero rows.** The first run asserted B requires "a real data migration (copy rows)" without
   checking. Grep shows no seed/insert path → B's copy is ≈ empty. B is cheaper than first-run claimed
   (though still dominated by C).
3. **A new dominance — A ⟸ E.** First run treated A as "the only real alternative to C." E retires A by
   delivering A's benefits without the per-asset dual-write. The real contest is now D vs E vs C, not A vs C.
4. **A re-classified driver — "one table" moved WANT→NEED.** First run argued C over A on *drift* (a
   correctness-hygiene point). The three-lens NEED analysis found the harder reason: the §5.2 **edges need a
   unified id-space** for clean FKs, so one-table is partly a NEED, not a tidiness WANT. This is a *stronger,
   more structural* argument for C than the first run had.

**What's the SAME:**
- The HAVE facts (20 cols, 2 FK dependents, 6 call sites, the lone `status` conflict, nullable null-pile).
- The dominance B ⟸ C (same end-state, destructive path).
- The final recommendation: **C, rename-in-place.**

**Did separating NEED from WANT change the recommendation, or just the framing?**
**It changed the *trade space and the rationale*, not the verdict.** Same answer (C), but: (a) the decision is
now correctly seen as a *sequencing* choice (could do D now, C later) rather than a flat one-of-three; (b) the
"why C" reason upgraded from "avoid drift" to "the edges structurally need one id-space"; (c) the runner-up
flipped from A to E. So the three-lens run is **richer** — more options, a sharper why, a corrected field —
while converging on the same destination. That is the honest A/B result: **the structure earned its keep on
rationale and option-coverage, not by overturning the call.**

---

## RECOMMENDATION

**C — rename-in-place to `cost_objects`** (unchanged from the first run; reinforced by this one).

**Deciding reason (sharper this time):** the accumulator's core mechanism is the §5.2 attribution edges, and
those edges are inherently cross-node-type — so they need ASSET/PROJECT/PRODUCT in **one FK-able id-space**.
That requirement (NEED #3) is what knocks out the fragmenting options E and A, and what makes the "one table"
end-state a near-NEED rather than a preference. Between the two unified options, C **dominates B** (same
end-state; C auto-carries the FK dependents and moves no rows, B drops/recreates them).

**The trade I'm explicitly making:** I give up **WANT-4 + WANT-5** (a clean asset-only `status`, and zero
always-null columns on PROJECT/PRODUCT rows) to buy **WANT-1 + NEED #3** (one FK-able node table) and **WANT-3**
(no dual-write). The cost of that trade is one bounded `status`-CHECK edit + a pile of *nullable* asset columns
on non-asset rows — a one-time, mechanical, low-risk price.

**What would tip it off C:**
- → **D**, only if **Core-1 is NOT already opening this schema** and David wants to ship the rollup before
  settling the name. Since [ACCUMULATOR-PRECONDITIONS.md](ACCUMULATOR-PRECONDITIONS.md) puts the node/edge/
  schema-gate work **inside Core-1**, the schema is open anyway → folding the rename in now is nearly free, and
  D-then-C would pay the 6-site repoint **twice.** So this tip-condition does **not** hold → C, not D.
- → **E**, only if a unified node id-space were genuinely undesirable — but NEED #3 says the opposite. Does
  not hold.

**Is it close?** No closer than the first run, and for a firmer reason. C wins on a structural NEED (edges),
not just a hygiene preference. **David decides A/B/C/D/E** — this is recon, no migration written.

---

## VERIFY (don't grade own homework)
- HAVE is file:line-backed: ✅ both migrations read directly (not via first-run doc); 6 call sites + 2 FK
  dependents + RLS/trigger lines cited; row-count claim grep-backed.
- NEED stripped to irreducible: ✅ reduced to node_type + parent_id + same-id-space rollup; everything else
  explicitly pushed to WANT; the one place NEED has teeth (edges → id-space) is called out, not padded.
- WANT labeled as want: ✅ 5 numbered WANTs, tensions between them noted.
- Options span NEED→WANT with compose/conflict + blast radius each: ✅ D/E/A/B/C ordered, each with
  satisfies-what + cost + compose result + repoint size.
- Compare-to-first-run explicit: ✅ 4 NEW items, 3 SAME items, the "framing vs verdict" question answered.
- Recommendation names the trade: ✅ C, trading WANT-4/WANT-5 for WANT-1/WANT-3/NEED #3, with both tip-offs.

**RESULT:** three-lens re-run — **NEED is "an asset carries `node_type` + `parent_id` and rolls up in one
FK-able id-space with projects/products"**; **options span D (minimal-defer) → E (view-bridge) → A (FK bridge,
now dominated) → B (subsume) → C (rename)**; it **surfaced two NEW options (D, E), one new fact (~zero rows),
and one new dominance (A⟸E)** vs the first run, and **upgraded the "why C" from drift-avoidance to a
structural edge-NEED**; **recommendation is C**, trading clean-status + no-null-pile (WANT-4/5) for a unified
node table (WANT-1 + NEED #3) + no dual-write (WANT-3). **It matches the first run's call — and yes, three
lenses gave more: a wider trade space and a firmer reason, without changing the destination.**

---
*TRACE Enterprises · Built with CAI · RECON artifact, not a build record. A/B test of the three-lens recon method.*
