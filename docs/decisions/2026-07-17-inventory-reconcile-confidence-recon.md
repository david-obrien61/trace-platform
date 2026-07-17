# RECON — the count record, the confidence primitive, and the reconcile-to-sellable model

**Type:** RECON (report only — NOT a decision). No code, no schema, no migration written.
**Date:** 2026-07-17
**Author:** Claude Code (Thunder)
**Serves:** `user_stories.md:362` (the grower with no system — the count builds the catalog) and `user_stories.md:370` (the real spoken-count spec — Billy Bob + the messy walk). Both `STATUS: written`.
**Method:** every claim below carries a `file:line` or a `table.column`. A claim with no citation is labelled **(inference)**. Where a fact could not be determined without a live catalog read it is labelled **BLOCKED** with what would unblock it. This recon exists because a design was being built against an unread table — so the discipline is: look, cite, then decide.

> **The correction this recon delivers, one line:** the model David has been designing is **mostly two columns and a filter on a table that already exists** — and the single most expensive piece of it (the missing sizes AND the missing prices) is **not two problems, it is one**, and its size half is **already built in code and merely not run against the live catalog**. Details below, all cited.

---

## 0. WHAT I OPENED (STEP 0 gate)

- **Migration `supabase/migrations/20260626_inventory_count_sessions.sql`** — read verbatim. Both tables (`inventory_count_sessions`, `inventory_counts`), full columns, FKs, RLS, indexes.
- **`packages/shared/src/inventory/countPromote.ts`** (191 lines) — the pure promote decision. Read whole.
- **`packages/shared/src/inventory/stockLineResolver.ts`** (194 lines) — the resolve ladder + `detectSizeCollision`. Read whole.
- **`packages/cultivar-os/src/pages/InventoryCount.tsx`** (900 lines) — the count writer. Read whole.
- **`packages/cultivar-os/src/pages/BusinessInventory.tsx`** (436 lines) — the grid / "reconcile surface". Read whole.
- **`packages/shared/src/discovery/populate.ts`** + **`catalog.ts`** variant/size functions — read the relevant spans.
- **`supabase/migrations/20260612_business_assets_inventory_pmi_service.sql`** + **`..._cost_confidence.sql`** — the `business_inventory` base schema + the confidence column.
- Live LAWNS product page (read-only WebFetch) for the price hypothesis (§E).
- Sub-agents (read-only) for the sellable predicate (§C), the confidence ladders (§B), and voice/ASR (§F).

**Off Limits honoured:** touched no `.ts`/`.tsx`, no migration, no QB oauth, no ignition-os code, no old Supabase project. This is a document.

---

## A. THE COUNT RECORD MODEL — `inventory_counts`

### A1. Full column list (verbatim from `20260626_inventory_count_sessions.sql`)

**`inventory_counts`** (migration lines 66–78):

| column | type | null? | default | FK / note |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `session_id` | uuid | NOT NULL | — | → `inventory_count_sessions(id)` **ON DELETE CASCADE** |
| `business_id` | uuid | NOT NULL | — | → `businesses(id)` **ON DELETE CASCADE** |
| `inventory_id` | uuid | **NULL ok** | — | → `business_inventory(id)` **ON DELETE SET NULL** — "null = unrecognized / no lot" |
| `plant_tag_id` | text | NULL ok | — | scanned `cultivar_plants.tag_id`, if a tag resolved it |
| `item_label` | text | **NOT NULL** | — | "display name counted, e.g. 'Shoal Creek Vitex, 30 gal'" |
| `counted_qty` | int | **NOT NULL** | — | "the number Lauren counted (becomes the new on-hand)" |
| `was_unknown` | boolean | NOT NULL | `false` | "true = scan did not resolve to a known item (flagged for later)" |
| `raw_scan` | text | NULL ok | — | raw scanned string, for audit / re-resolution |
| `counted_at` | timestamptz | NOT NULL | `now()` | — |
| `created_at` | timestamptz | NOT NULL | `now()` | — |

**`inventory_count_sessions`** (migration lines 27–37): `id` (uuid PK), `business_id` (uuid NOT NULL, CASCADE), `status` (text NOT NULL DEFAULT `'in_progress'` — **no CHECK**, comment line 30: "AC-4, value set grows without migration"), `counted_by` (uuid NULL — `auth.uid()`, not an FK), `item_count` (int NOT NULL DEFAULT 0, denormalized), `started_at`, `completed_at` (**nullable**), `created_at`, `updated_at`.

### A2. Timestamp — and the trap in it

`inventory_counts.counted_at` exists (NOT NULL DEFAULT `now()`). **But it records when the ROW was WRITTEN, not when the human counted.** `recordCount` ([InventoryCount.tsx:616-619](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L616)) inserts `{ session_id, business_id, ...row }` and **never sets `counted_at`** — so it takes the DB default. Under the SyncEngine, an **offline** count is queued and the INSERT runs at **drain time** (on reconnect), so `counted_at` = sync time, not lot-walk time. The envelope *does* carry a capture timestamp — `clientTs: new Date().toISOString()` at enqueue ([syncEngine.ts:105](../../packages/shared/src/sync/syncEngine.ts#L105)) — but it is used only for last-writer SET ordering ([sync/types.ts:31](../../packages/shared/src/sync/types.ts#L31)) and is **not written into `counted_at`**.

→ **For David's `qty_as_of` model: the timestamp you'd read is drain-time, not capture-time, and it lives on `inventory_counts`, not on `business_inventory`.** `business_inventory` itself has only `updated_at` (bumps on ANY edit — price, location, status — not just a count) and `received_at`. There is **no** column anywhere named `qty_as_of` / `last_counted` / `as_of` / `last_verified` (grepped repo-wide, `--include=*.sql,*.ts,*.tsx` — **zero hits**).

### A3. Does it carry the captured NAME? — **YES, and this is load-bearing.**

`item_label text NOT NULL` (migration line 72) stores what was counted, e.g. `"Shoal Creek Vitex, 30 gal"`, **independent of `inventory_id`**. So even when `inventory_id IS NULL` (the FK is `ON DELETE SET NULL`, and the unknown path writes it null), the row is **not** a nameless orphan — it carries the human's label. This is the fact that makes §D2 possible.

### A4. `inventory_count_sessions` — status/complete

`status` (text, no CHECK, default `'in_progress'`) + `completed_at` (nullable) + `item_count` (denormalized). `complete()` ([InventoryCount.tsx:633-645](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L633)) writes `{ status: 'completed', completed_at: new Date().toISOString(), item_count: counted.length }`. So the session HAS a lifecycle (`in_progress` → `completed`; `abandoned` is a documented-but-unused value, migration line 30).

### A5. Is a count row EVER read back? — **NO. It is a write-only audit log today.**

Grepped every reference to `inventory_counts` in `packages/`, `api/`, `scripts/` (`.ts/.tsx/.mjs`). The **only** access is the INSERT in `recordCount` ([InventoryCount.tsx:617](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L617)) and the session-`item_count` bump. **There is no `.from('inventory_counts').select(...)` anywhere.** The migration header itself says so (lines 8-10): "recorded here so a later RECONCILIATION pass … can read what was counted … Reconciliation itself is DEFERRED — this only leaves room for it."

→ **`inventory_counts` is a write-only table. Nothing reads it. It is a room built for a tenant who has not moved in.**

### A6. Cross-session "already counted this one"? — **Within ONE session only. Confirmed.**

The dedup is React state, not a DB relation: `sessionCounts: Record<string, number>` ([InventoryCount.tsx:175](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L175)), keyed by `countKey` ([:356-360](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L356)), **reset to `{}` on every `startCount`** ([:247](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L247)). The Conflict sheet ("Already counted this one") fires only when the same `(variety×size)` key is already in *this session's* map ([:385-390](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L385)). **Nothing associates two counts of the same (variety×size) across sessions or devices** — there is no such query and no unique constraint that would surface it. (The ledger-#54 "already counted this one" is correctly session-scoped, as the prompt suspected.)

---

## B. THE CONFIDENCE PRIMITIVE — is the ladder shared, or one column's local habit?

### B1. Where `cost_confidence` is defined — **a DB CHECK constraint. This is the AC-1 finding.**

`supabase/migrations/20260612_business_assets_inventory_cost_confidence.sql` (lines 55-59):

```sql
ALTER TABLE business_inventory
  ADD COLUMN cost_confidence  text
    CHECK (cost_confidence IN ('CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'));
```

Same four-value CHECK on `business_assets.cost_confidence` (lines 32-35). **The vocabulary is baked into the schema.** Adding a fifth level — or a `qty_confidence` that reuses these words — is a **migration** (an `ALTER … DROP CONSTRAINT … ADD CONSTRAINT`), not a code change.

→ **This is the exact AC-1 test the prompt flagged.** Contrast with `business_inventory.status` (migration `..._pmi_service.sql:107`): `status text NOT NULL DEFAULT 'available'` — **no CHECK**; and `inventory_count_sessions.status` — no CHECK ("AC-4, value set grows without migration"). So the platform already has **both patterns side by side**: `status` is a free-text ladder that grows without a migration (AC-4-clean); `cost_confidence` is a CHECK-locked ladder that does not. **The confidence ladder is the one place a vocabulary is schema-baked.** If David wants an identity ladder or a qty ladder that can *grow* (CONFIRMED → DESCRIBED-by-fruit → TAG-READ → UNKNOWN is a 4-rung ladder that WILL grow), it must not be modelled as a CHECK.

### B2. Who writes / reads / renders `cost_confidence`

- **WRITES:** discovery scrape sets `'UNKNOWN'` for every row ([populate.ts:121](../../packages/shared/src/discovery/populate.ts#L121)); the count-create sets `'UNKNOWN'` ([InventoryCount.tsx:481](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L481)); the grid derives it from a cost edit — typing a cost sets `'CONFIRMED'`, clearing it sets `'UNKNOWN'` ([BusinessInventory.tsx:188-190](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L188)), and the confidence dropdown writes it directly and clears cost on `'UNKNOWN'` ([:197-202](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L197)).
- **READS/RENDERS:** the grid `Conf.` column ([BusinessInventory.tsx:289-290](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L289)) via `SelectCell` + `confidenceStyleFor` + `confidenceLabel` ([:76-79](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L76)). The TS type is a **local union** `type CostConfidence = 'CONFIRMED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN'` ([:43](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L43)) — declared in the page file, **not a shared type**.

### B3. Other confidence / ESTIMATED / honesty ladders — **4 distinct vocabularies, NO shared DB primitive. This is the STD-011 finding, and it is worse than one column's habit.**

The dominant 4-value epistemic ladder (`CONFIRMED | DERIVED | ESTIMATED | UNKNOWN`) is **not** modelled once — it is **5 literal CHECK clauses copy-pasted across 3 migrations**, with no shared DB enum/domain:

- `cost_confidence` ×2 (business_assets + business_inventory) — `20260612_..._cost_confidence.sql:34,58`.
- `basis_confidence` ×2 (cost_edges + cost_assignments, nullable variant) — `20260615_cost_objects_rename_and_node_schema.sql:143,198`.
- `estimated_value_confidence` ×1 (cost_objects — "what it's worth", distinct from "what was paid") — **also a CHECK**, `20260701_cost_objects_estimated_value.sql:44-49`. (This replaces my earlier hedge — it is confirmed a CHECK, same 4 values, its own repeated clause.)

On the TS side there is a canonical `CostConfidence` type ([business-logic/CostToProduce.ts:48](../../packages/shared/src/business-logic/CostToProduce.ts#L48), aliased `AmountConfidence` in `CountOnceSeam.ts:75`) — **but it is forked by literal re-declaration in ≥4 files**: `discovery/costDiscovery.ts:42`, `InventoryEditor.tsx:47`, `BusinessInventory.tsx:43`, `BusinessAssets.tsx:43`. The **only** genuinely shared, reused primitive is the render-side badge styler `confidenceStyleFor` ([DataSheet.tsx:506](../../packages/cultivar-os/src/components/datasheet/DataSheet.tsx#L506)) — and even that is forked once (`CostToProduceSettings.tsx:75`).

Three OTHER, genuinely different ladders exist:
- **`substantiation`** — a 2-value ladder `SUBSTANTIATED | OWNER_ASSERTED`, DB CHECK (`20260615_cost_objects_substantiation_d5.sql:45-46`); TS forked too (`CountOnceSeam.ts:78` vs `CostToProduceSettings.tsx:86`).
- **OCR / AI-Vision self-report** — a 3-value `HIGH | MEDIUM | LOW`, **free-text, informational, never persisted into a graded column** (`api/receipts/ocr.ts:131` → `assetCapture.ts:44`).
- **Discovery extraction JSONB** — per-item `confidence` free-text, **explicitly unconstrained** ("NO CHECK — the value-set grows without a migration", `20260621_business_discovery_profiles.sql:30,37`). This is the AC-4-clean pattern applied to a confidence value — proving the platform already knows how to do a growable ladder.

**Searched and NOT FOUND: any identity-resolution / person-spine / tax-classification confidence ladder.** `person_spine.sql` and the customer party record have **no** `*_confidence` / `match_confidence` / `identity_confidence` column. So the identity ladder David's model wants (`user_stories.md:376`: CONFIRMED → DESCRIBED-by-fruit → TAG-READ → UNKNOWN) **does not exist in any form today.**

→ **STD-011 reading:** one *intended* 4-value ladder, realized as a **distributed literal-string convention** (5 DB CHECK copies + ≥4 TS forks) rather than a single DB domain/type — plus three unrelated ladders. **A new `qty_confidence` / `identity_confidence` has no primitive to reuse; it would become the 6th CHECK copy (migration + AC-1 debt) unless the ladder is first modelled as growable free-text** — which the discovery-JSONB precedent shows is already an accepted pattern here.

### B4. Could `qty_confidence` / `identity_confidence` reuse the primitive, or fork it?

There is nothing to reuse — see B3. To **unify first** you would: (a) lift `CostConfidence` into a shared type in `packages/shared`; (b) decide the ladder is **free-text, not a CHECK** (so it can grow: the identity ladder has 4 rungs today and the spoken-walk spec at `user_stories.md:376` already implies more). The count-create already writes `cost_confidence: 'UNKNOWN'` as a string, so a free-text model changes no writer. **The cheapest correct move is: model any NEW confidence column as free-text `status`-style, NOT as a CHECK, and do not retro-migrate `cost_confidence` unless a 5th cost rung is actually needed.**

---

## C. THE SELLABLE PREDICATE — the rule that refused Chinkapin

### C1–C2. Where it lives + what it tests — **inline, duplicated 3×, no shared function.**

The refusal "No sale price set for … — set a price in Inventory before selling" is produced in **three independently-written places**:

- **`packages/cultivar-os/api/orders/submit.ts:366`** (new order, server, HTTP 400 `code: 'NO_SELL_PRICE'`) — tests `serverSellPriceRaw == null || serverSellPrice <= 0` ([:360](../../packages/cultivar-os/api/orders/submit.ts#L360)).
- **`submit.ts:915`** (order-EDIT path, server) — tests `k.r.sellPrice == null || k.r.sellPrice <= 0` ([:914](../../packages/cultivar-os/api/orders/submit.ts#L914)).
- **`packages/cultivar-os/src/pages/CartReview.tsx:595`** (client banner) — tests `sellPriceOf(i) <= 0` where `sellPriceOf` null-coalesces to 0 ([:130-131](../../packages/cultivar-os/src/pages/CartReview.tsx#L130)).

The rule everywhere is **`sell_price == null || sell_price <= 0`**. The qty/oversell refusal is a *separate* check ([submit.ts:377](../../packages/cultivar-os/api/orders/submit.ts#L377)). **There is NO shared `isSellable` / `canSell` / `hasPrice` predicate in `packages/shared`** (searched; the only `NO_SELL_PRICE` hits are the two inline submit.ts sites). `tierPricing.applyTierPrice` passes non-positive prices through untouched with a comment that "submit.ts refuses it upstream" — confirming the rule lives only at the checkout boundary.

### C3. Can the grid call it? — **No; rendering "can't be sold" on the grid would FORK a 4th copy.**

`BusinessInventory.tsx` imports no such predicate (none exists to import) and only reads/writes `sell_price` as an editable column ([:285-286](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L285), [:192-195](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L192)). **This is the whole question for the grid-display fix:** to show a "not yet sellable" state on the grid you must either (a) extract `sell_price == null || <= 0` into ONE shared predicate that both checkout and grid call, or (b) copy the rule and accept STD-011 drift **at the money surface** — the worst place to have two rules that can disagree.

### C4. Existing `status` / draft concept on `business_inventory`?

Yes, partial, and it is **separate from the price rule**:
- `status` is free-text (values enumerated in code, no CHECK): `['available', 'reserved', 'depleted', 'damaged', 'returned', 'archived']` ([BusinessInventory.tsx:46](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L46)); discovery adds `'review'` (flagged) vs `'available'` ([populate.ts:122](../../packages/shared/src/discovery/populate.ts#L122)).
- **`status` IS read as a sell gate — but only on the storefront, not server-enforced.** `PlantProfile.tsx:80` gates the customer "Add to cart" button on `inventoryStatus === 'available'`. The **server order path does NOT gate on status** — submit.ts refuses only on price and qty ("qty is the truth regardless of the lot's current status", submit.ts:372-373). Soft-delete uses `status='archived'` = "not sellable" ([BusinessInventory.tsx:212](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L212)).

→ **A "sellable-ish" state already half-exists** as the pair (`status`, `sell_price`), but the two facts are enforced in different places (status on the storefront UI, price at the server), and **neither is exposed on the reconcile grid as "this row cannot be sold yet."** Deriving a THIRD sellable concept is the drift risk; the honest move is one shared predicate over the two facts that already exist.

---

## D. THE UNKNOWN / TYPED PATH — voice's ancestor, live today

### D1. "Didn't recognize this" → typed variety+size+count → Save — what it writes

`saveUnknown(true)` ([InventoryCount.tsx:552-599](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L552)): validates name (required), qty (≥0), **size (required — ledger #135)**, then runs **resolve-before-create** (`resolveStockLine` on the typed NAME, [:576](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L576)) and calls `commitCount(ctx, size, qty)`. That performs the shared `resolveCountTarget` decision and does the IO: `update` / `fill` / `create` a `business_inventory` row, **then** `recordCount(...)` an `inventory_counts` row. **Order: `business_inventory` first, `inventory_counts` second** ([:499-506](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L499)).

### D2. **"Skip & flag for later" — what it writes. THE highest-leverage answer in this recon.**

`saveUnknown(false)` ([InventoryCount.tsx:542-550](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L542)) writes **exactly one row, to `inventory_counts`, and NOTHING to `business_inventory`**:

```
recordCount({ inventory_id: null, plant_tag_id: unknownTag || null,
              item_label: `Unrecognized — flagged (${unknownTag})`,
              counted_qty: 0, was_unknown: true, raw_scan: unknownRaw })
```

So the "pending capture" it produces is: an `inventory_counts` row with `inventory_id IS NULL`, `was_unknown = true`, a human `item_label`, a `raw_scan`, a `plant_tag_id`, and `counted_qty` (0 for skip&flag; the real qty for the ambiguous-typed case at [:583](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L583)).

→ **The reconcile / pending-capture queue ALREADY EXISTS as a set of rows: `inventory_counts WHERE was_unknown = true`.** It has a name (`item_label`), a raw scan, a tag, a qty, a session, a timestamp. **But per §A5, NOTHING READS IT.** It is a queue with items in it that no screen ever displays. **This is the single biggest correction to the design: a large part of "build a reconcile queue" is "build a READER for a table that is already being written."** Caveats, cited: for skip&flag the label is only the tag (`"Unrecognized — flagged (SCV-0031)"`), not a real variety, and `counted_qty = 0`; for the ambiguous-typed case the label is the typed name + size + "(ambiguous — flagged)". So the queue is real but its rows are of uneven richness.

### D3. "We'll match this to an existing variety…" — **is that claim TRUE? YES, the code is real; it is just unproven live.**

The typed sheet's promise ([InventoryCount.tsx:814](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L814)) is implemented: `saveUnknown` calls `resolveStockLine(supabase, businessId, name)` ([:576](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L576)) — the **same** shared resolver the scan path uses — BEFORE minting a new group, and on an ambiguous >1 it records-only + flags rather than risking a third orphan ([:578-586](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L578)). The resolver is token-set **equality** ([stockLineResolver.ts:118-129](../../packages/shared/src/inventory/stockLineResolver.ts#L118)); the code comment is honest that it handles case/word-order/punctuation but NOT extra-word/plural-stem variance ([:570-575](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L570)). **So: the claim is code-true, boundary-honest, and — as the owner-test board says — `owed`/never-proven-live, not `missing`.** Voice's safety does rest on this path, and it exists.

### D4. A typed name that matches nothing → what confidence is recorded?

New variety, new group (`groupKey = slugify(name)`), new row ([:589-592](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L589)) → `commitCount` → `create` writes `cost_confidence: 'UNKNOWN'`, `sell_price` omitted (null), `status: 'available'` ([:479-482](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L479)). **There is NO qty/identity confidence recorded** — the qty is stored as a bare int; nothing marks "this qty is a firm count" vs "estimated" vs "the identity itself is a guess." **Confirmed: today, none.** This is the gap the spoken-walk spec (`user_stories.md:376`, the ESTIMATED / DESCRIBED-by-fruit ladder) wants to fill and the schema currently cannot express without a new column.

---

## E. THE SCRAPE SOURCE — this resizes the whole reconcile

### E1. What `populate.ts` reads and discards

It fetches the site, AI-extracts VARIETIES (parents), clears sandbox+prior discovery, and writes `business_inventory` rows that are deliberately **`qty: 0`, `unit_cost: null`, `cost_confidence: 'UNKNOWN'`, `status` `available`/`review`** ([populate.ts:119-123](../../packages/shared/src/discovery/populate.ts#L119)). It refuses to fabricate qty or price (D-9 honesty, [:28-30](../../packages/shared/src/discovery/populate.ts#L28)).

### E2. **The size AND price hypothesis — and the code already answers half of it.**

**Sizes are NOT discarded — they are already being read.** `populateCatalog` calls `fetchProductVariants` ([populate.ts:198](../../packages/shared/src/discovery/populate.ts#L198)), which visits each `/product/<slug>` page and reads its size options via `extractSizeVariants` ([catalog.ts:436](../../packages/shared/src/discovery/catalog.ts#L436)), matches them to varieties by the same token-set key the resolver uses ([populate.ts:202-213](../../packages/shared/src/discovery/populate.ts#L202)), and writes **one row per (variety × size)** ([:228-234](../../packages/shared/src/discovery/populate.ts#L228)). **LAWNS is WooCommerce** (confirmed: the size data is the `data-product_variations` JSON attribute and the size `<select>`, [catalog.ts:383-385, 446-459](../../packages/shared/src/discovery/catalog.ts#L383); the LAWNS host is `lawnstrees.com`, [catalog-variants.test.ts:91](../../packages/shared/src/discovery/catalog-variants.test.ts#L91)).

**And here is the hypothesis, confirmed from the code itself:** in Woo, PRICE and SIZE live on the **same variation object** in that same JSON blob. The repo's own test fixture proves it — [catalog-variants.test.ts:35](../../packages/shared/src/discovery/catalog-variants.test.ts#L35) shows a real variation object shape: `{"attributes":{"attribute_pa_tree-size":"5-gallon"},"display_price":0}`. The parser at [catalog.ts:451-456](../../packages/shared/src/discovery/catalog.ts#L451) loops over exactly these objects and reads **only** the `attribute_*siz*` key — **`display_price` is in hand and thrown away.** So: **size and price are ONE structure, already parsed, already in memory. Reading price is reading one more key off an object the code already holds.** This is why "103 unpriced stubs + missing sizes" is **one missing capability, not two.**

**BUT — the honest half the code cannot answer, so I read the live page (read-only WebFetch of `lawnstrees.com/product/shoal-creek-vitex/`):** the page lists the four sizes (5/15/30/45 Gallon) and **displays NO prices for any size.** Consistent with the test fixture's `display_price: 0` — **LAWNS is a catalog-only wholesale site that does not publish prices.** So the price is *structurally where the size is*, but its **value is 0/absent** for LAWNS specifically.

### E3. Homework or a demo?

→ **For LAWNS: it is homework, not review.** The scrape can recover **sizes** (that capability is built) but **cannot recover prices, because LAWNS has none to publish.** So Lauren must **enter** ~all prices, not merely **review** them. The optimistic "she reviews 450 rows" is false for this tenant; "she prices N rows" is the truth. (For a *retail* nursery whose Woo variations carry real `display_price`, the same code — plus reading one more JSON key — would flip it to review. LAWNS is the wholesale exception.)

### E-⚠️. **The live catalog is stale relative to the code — a real "built but not applied" finding.**

`countPromote.ts:24` and the D-49 handoff assert "scrape-reads-variations was never built" and that the live catalog holds **103 size-less stubs**. But `fetchProductVariants` / `extractSizeVariants` / the per-size insert **exist and are wired into `populateCatalog` today** (§E2). The reconciliation: the size-enrichment code **landed after** the live catalog was last populated, OR the variant crawl isn't matching LAWNS's product URLs at run time. **Either way the SIZE-scrape capability is BUILT in code and simply has not been (re-)run against the live catalog** — the 103 stubs are stale data, not a missing feature. **BLOCKED on which:** confirming requires either a live re-run of `populateCatalog` against LAWNS or a live catalog read (no service key locally — see §BLOCKED).

---

## F. VOICE — what exists

### F1–F2. The Ignition tech-notes voice path — **exists as donor code; the cultivar `voice_capture` target does not.**

- **Real transcription integration (frozen donor):** `packages/ignition-os/modules/IgnitionVoice.native.js:37` records mic audio (`expo-audio`) and POSTs the `.m4a` to `http://192.168.1.14:8000/transcribe` (an **external LAN dev machine, NOT in this repo**), reading back `data.transcription` + extracted tasks. Wired into `packages/ignition-os/App.js`. This IS the "tech-notes voice path" `user_stories.md:376` refers to — but it calls an off-repo server.
- **Real local Whisper CLI, off-repo, not app-wired:** `/Users/terrenceobrien/whisper-local/transcribe.sh` runs `faster_whisper.WhisperModel("medium", cpu, int8)`. A dev utility, not a product integration.
- **`voice_capture` (the cultivar PROMOTE target with carton-math + turn-separation) is NOT built** — it exists only as a spec token in `user_stories.md:367,375-376`.

### F3. **The ceiling implication — a hard constraint, not a footnote.**

- **Browser Web Speech API needs NO server** and is **already live in cultivar today**: `packages/cultivar-os/src/components/RhythmLogger.tsx` uses `window.SpeechRecognition ?? webkitSpeechRecognition` for on-device dictation, wired into `App.tsx` behind a `?rhythm=1` flag (David-only). **This is the zero-endpoint precedent.**
- **A server-side Whisper endpoint would hit the ceiling.** `api/` is at **12/12** (§6 r11); the 12 handlers listed contain no audio route, and `receipts/ocr.ts` is image-only. A `/transcribe` Vercel function would be **#13 = silent deploy failure**. So server-side transcription cannot ship without consolidating a function or going off-Vercel.

→ **Voice's viable near-term path is browser ASR (already proven to work in RhythmLogger) — zero new endpoints, ceiling-safe.** A Whisper server (better accuracy, carton-math parsing) is an off-Vercel or consolidate-a-function decision, and is squarely a separate build. **Voice is NOT a small addition to the reconcile work; it is a distinct build with an infra decision in front of it.**

---

## G. THE RECONCILE SURFACE

### G1. Does a reconcile / variance surface exist? — **NO (confirmed against code, not the doc).**

Grepped `reconcile|reconciliation|variance|qty_as_of` across `cultivar-os/src` + `shared/src`. The only "reconcile" is **`receiptReconciliation.ts`** — receipt line-items-vs-total math ([computeReconcile](../../packages/cultivar-os/src/utils/receiptReconciliation.ts#L25)), an OCR concern, **unrelated** to inventory counted-vs-expected. **There is no inventory reconcile/variance surface.** (`user_stories.md:360` said "deferred and not yet built"; the code agrees — trap #3 avoided.)

### G2. Could the reconcile surface BE `/inventory` filtered? — **YES; the grid already declares itself the reconcile surface.**

`BusinessInventory.tsx` header line 2: **"board 5.1 reconcile surface … the desktop-primary RECONCILE + full-CRUD surface."** It already has: full inline edit of qty/size/variant_group/location/unit_cost/sell_price/status/reorder_point ([:270-307](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L270)); the shared `<DataSheet>` engine with search, sort, column-hide, status filter ([:312-324](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L312)); a dup-size flag column + banner ([:271-272, 334-348](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L271)); create/edit/add-size/delete via one `InventoryEditor`. **What it does NOT have:** any column or filter for "never counted" (no `qty_as_of` to read — §A2), "counted but no price" (the §C predicate isn't called here), or "still a stub." **The reconcile surface is the grid plus two derived columns and a filter — not a new screen.**

---

# THE DELIVERABLE

## 1. HAVE (what exists, cited)

| Piece David's model needs | Status | Evidence |
|---|---|---|
| A durable count record | **BUILT** (write-only) | `inventory_counts`, migration 20260626; write at InventoryCount.tsx:617 |
| A pending-capture / unknown queue | **BUILT as rows, UNREAD** | `inventory_counts WHERE was_unknown=true`, written at InventoryCount.tsx:545; **no reader (§A5)** |
| Structure-commits-at-capture, qty-is-a-count | **BUILT** | `resolveCountTarget` update/fill/create, countPromote.ts; size required (#135) |
| Resolve-before-create (spellings converge) | **BUILT, unproven live** | InventoryCount.tsx:576; owner-test board = `owed` |
| Identity ladder (mint at the confidence you have) | **NOT BUILT** | no qty/identity confidence column; qty is a bare int (§D4) |
| Currency-is-a-null (`qty_as_of`) | **NOT BUILT** | no such column anywhere (§A2); `counted_at` is drain-time and lives on the wrong table |
| Reconcile = promotion to sellable | **NOT BUILT as a gate** | sellable rule inline ×3, not shared, not on the grid (§C) |
| The reconcile SURFACE | **BUILT (the grid), missing 2 columns + a filter** | BusinessInventory.tsx is "board 5.1 reconcile surface"; lacks never-counted / no-price signals (§G2) |
| Scrape reads sizes | **BUILT in code, not run on live catalog** | fetchProductVariants + per-size insert (§E2, §E-⚠); 103 live stubs are stale data |
| Scrape reads prices | **NOT BUILT, and would not help LAWNS** | `display_price` parsed-then-discarded (§E2); LAWNS publishes no prices (§E3) |
| Voice | **browser ASR live (RhythmLogger); `voice_capture` not built** | §F; server transcription blocked by 12/12 ceiling |

## 2. NEED — the irreducible minimum for David's model

**It is genuinely close to "two columns and a filter," plus one reader and one shared predicate.** Concretely:

1. **One shared sellable predicate.** Extract `sell_price == null || sell_price <= 0` into ONE function in `packages/shared` and have checkout (3 sites) AND the grid call it. **This is a refactor of existing code, not new capability** — and it's the prerequisite for showing "not sellable yet" anywhere without STD-011 drift at the money surface (§C).
2. **A currency signal.** David's "currency is a null" wants a `business_inventory.qty_as_of timestamptz NULL` column (one migration, nullable, zero backfill) set by the count promote. **OR** — cheaper, no migration — derive "never counted" as `NOT EXISTS (a inventory_counts row for this lot)` by finally **reading the table that is already written** (§A5/§D2). Either gives the grid a "never verified" filter.
3. **A grid filter/column** over #1 and #2: "needs price," "never counted," "still a stub" (`isVarietyStub` already exists, [countPromote.ts:76](../../packages/shared/src/inventory/countPromote.ts#L76)). No new screen (§G2).

**What the NEED does NOT require:** a new reconcile screen; a new confidence enum/migration; a voice build; a scrape-price build. **Named-as-already-built that David may think needs building:** the unknown/pending queue (rows exist, just unread — §D2), resolve-before-create (built, unproven — §D3), the reconcile surface itself (the grid — §G2), and size-scraping (built, unrun — §E-⚠).

## 3. WANT — the full spec (labelled WANT, not NEED)

- **A `qty_as_of` column** (not derived) so currency is a first-class, indexable fact; count promote sets it, any manual qty edit nulls it (matching David's "the absence IS the flag").
- **A qty/identity confidence ladder** modelled as **free-text (NOT a CHECK)** — so it can grow (`COUNTED` / `ESTIMATED` / `DESCRIBED` / `UNKNOWN`) without a migration, reusing a lifted-to-shared `Confidence` type (§B4). AI proposes the rung ("should be about forty" → `ESTIMATED`); the DB stores the string; money + identity stay deterministic.
- **`voice_capture`** via browser ASR (ceiling-safe), routing name → the token-set resolver and size → the grower's size list, preserving carton-math and speaker turns (`user_stories.md:376`). Its own build, its own infra call.
- **A true reconcile pass** (counted-vs-expected: sold/dead/missing) that reads `inventory_counts` history against `business_inventory.qty` — the deferred 4.2 double-whammy (`user_stories.md:355`).
- **Scrape-reads-price** for retail Woo tenants (one JSON key, §E2) — useless for LAWNS, valuable for the next vertical.

## 4. OPTIONS — NEED → WANT

| Option | What it buys | What it leaves | Cost |
|---|---|---|---|
| **O1 — Filter-only (cheapest NEED).** Extract the shared sellable predicate; add a grid filter "needs price / never counted (derived from `inventory_counts`) / still a stub." Read the already-written queue. | Bur Oak & Chinkapin become **visible** as stuck-between-captured-and-sellable, on the surface that already exists. The unknown queue gets its first reader. | No `qty_as_of` column (currency is derived, a bit slower); no confidence ladder; no voice. | **Small.** One shared fn + one reader + grid config. No migration. |
| **O2 — O1 + `qty_as_of` column.** Add the nullable timestamp; promote sets it; manual qty edit nulls it. | Currency is a first-class, indexable null — David's model, literally. | No confidence ladder; no voice; no counted-vs-expected variance. | **Small-medium.** One nullable migration (zero backfill) + promote/edit wiring. |
| **O3 — O2 + free-text confidence ladder.** Lift `Confidence` to shared; add a free-text `qty_confidence`/`identity_confidence` (NOT a CHECK). AI proposes the rung. | "Mint at the confidence you have" (`user_stories.md:376`) becomes representable; the ladder can grow without migrations. | No voice; no full variance reconcile. | **Medium.** Migration(s) + AI rung mapping + grid rendering. |
| **O4 — Full WANT.** O3 + `voice_capture` (browser ASR) + counted-vs-expected reconcile + scrape-price for retail. | The whole spoken-walk + reconcile vision. | — | **Large, multi-build.** Voice has an infra decision (§F3); variance reconcile is 4.2; scrape-price is its own pass. |

## 5. THE OVER-DESIGN ANSWER — is the model heavier than the problem?

**Partly yes — and the heaviness is concentrated in two places, both avoidable.**

- **Where it's RIGHT-sized:** "a count is an observation, structure commits at capture, qty defers, reconcile is promotion-to-sellable" — this maps almost 1:1 onto what exists. `resolveCountTarget` already commits structure at capture; `inventory_counts` already records the observation; the grid is already the promotion surface. The gap is genuinely **a reader, a shared predicate, and a filter** (O1). **For the problem in front of you — Bur Oak and Chinkapin invisible on the grid — O1 is the whole fix, and it is small.**
- **Where it's OVER-designed for today:** (a) **"currency is a null" as a new column** is elegant but you can *derive* "never counted" from the table you're already writing and not read yet — the column is a WANT, not a NEED (§A5/D2). (b) **A confidence ladder** is real for the *spoken walk* but the *typed/scan* path David is staring at (Bur Oak/Chinkapin) doesn't need it — qty there is a firm count, not an estimate. Building the ladder now is designing for `user_stories.md:376` while the live pain is `user_stories.md:362`'s simpler sibling. (c) **Voice** is a separate build with an infra decision in front of it — folding it into "the reconcile model" over-scopes both.
- **The one thing that is UNDER-appreciated, not over-designed:** the **queue already exists and nobody reads it** (§D2). The model keeps describing a pending-capture store to build; the store is built. That's the opposite of over-design — it's under-recognition of what's already there.

**Recommendation (mine, David rules):** ship **O1**, then **O2** if the derived-currency proves too slow or David wants the null to be literal. Treat the confidence ladder (O3) and voice (O4) as the `user_stories.md:376` build, separate and later. **Do not build a new screen, a new enum, or a migration to answer "why is Chinkapin stuck?" — answer it with a filter on the grid that already exists.**

## 6. BLOCKED — what I could not determine, and what unblocks it

- **Whether the 103 live stubs are (a) pre-enrichment stale data or (b) the variant crawl failing to match LAWNS URLs at run time (§E-⚠).** Unblock: a live re-run of `populateCatalog` against `lawnstrees.com`, or a read-only live catalog query (row counts by `size IS NULL`). **No `SUPABASE_SERVICE_KEY` locally** (empty in env; anon is correctly RLS-blocked — same block D-49 hit). David can run the read, or mint a short-lived PAT.
- **Whether real LAWNS `data-product_variations` JSON literally contains `display_price` keys (value 0) vs omits them.** The test fixture has them=0; the live WebFetch (via a small model on rendered markdown) reported no price data and possibly did not see the raw JSON attribute. Unblock: `curl -s https://lawnstrees.com/product/shoal-creek-vitex/ | grep -o 'data-product_variations="[^"]*"'` (read-only, no key needed). Does not change the E3 conclusion (LAWNS has no prices either way) but confirms the exact shape.
- **B3's full cross-ladder inventory** beyond `cost_confidence` (the DB-CHECK finding in B1 is firm; the enumeration of every *other* honesty ladder was still being swept as this was written). Does not affect the O1/O2 recommendation.

## 7. THE ORDER — what must land before what, and why

1. **The shared sellable predicate (C) is the keystone — it must land FIRST.** Every "not sellable yet" signal on the grid depends on it, and building it later means the grid forks a 4th copy of the money rule (§C3). It is also independently correct (kills 3-way inline drift).
2. **Then the grid reader/filter (O1).** Depends on #1 and on reading `inventory_counts` (§A5) — no migration, unblocks the live pain immediately.
3. **`qty_as_of` (O2) only if derived-currency is insufficient** — it's a nullable migration, orderable any time after #2, not before.
4. **The confidence ladder (O3) is gated on a decision, not on code order:** decide free-text-vs-CHECK FIRST (§B1/B4) — if it lands as a CHECK it inherits `cost_confidence`'s AC-1 debt. Build only when the *spoken walk* (`user_stories.md:376`) is the active story.
5. **Voice (O4) is gated on the 12/12 ceiling decision (§F3)** — browser ASR (ceiling-safe) vs off-Vercel Whisper (accuracy) — a David call before any code.

### Does E (scrape prices) change the size of the reconcile build?
**No — it makes it SMALLER for LAWNS, in the honest direction.** The scrape can recover **sizes** (built, §E-⚠) but **not prices** (LAWNS has none, §E3), so pricing stays manual regardless — which means the reconcile build must assume "Lauren prices rows," and O1's "needs price" filter is therefore **more** important, not less. Re-running the (already-built) size scrape would shrink the *stub* problem (fewer size-less rows to fill), but that's a `populateCatalog` re-run, not part of the reconcile build.

### Does D2 (skip & flag) mean the queue already exists?
**YES — unambiguously.** `inventory_counts WHERE was_unknown = true` is the pending-capture queue, written today (§D2), read by nothing (§A5). **The reconcile design is, in large part, a FILTER and a READER over a table that already has rows in it** — not a new store. That is the headline correction this recon was asked to make.

---

*Recon only. No decision number proposed (per instruction). If David rules any of O1–O4 in, that is where a decision (and a story-cited build spec) gets minted.*
