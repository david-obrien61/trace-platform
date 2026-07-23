# RECON — the demo's opening beat: create tenant → scrape catalog → show their site

**Date:** 2026-07-22 · **Type:** RECON ONLY — zero code, zero schema, zero writes, no scrape executed.
**Question:** David demos at LAWNS as one motion — create a LAWNS tenant, scrape `lawnstrees.com`,
show Lauren HER data on her proposed Cultivar site, then inventory + order. Steps 3–4 are OWNER-PROVEN.
Steps 1–2 are not, and they run FIRST, in front of the buyer.

**Grounding rule applied:** every behavioral claim below carries a `file:line`. Where the answer requires
the live database (has a function ever *executed*?), it is flagged **DAVID-QUERY** rather than asserted.
Nothing here is stated from a code comment — one comment is corrected below.

---

## R1 — IS IT ONE MOTION OR TWO?

**Verdict: ONE motion in the UI, TWO operations underneath, joined by a wizard step and a re-read.**
The seam is real but it is *mostly* hidden. There is one place it becomes visible, and it is a demo risk.

### The creation entry point

Exactly one UI path INSERTs a `businesses` row:
`packages/shared/src/auth/OwnerSignup.tsx:248-347` → `createBusinessAndMember(userId)`.
The insert object, `OwnerSignup.tsx:254-263`:

```ts
const bizInsert: Record<string, unknown> = {
  owner_id: userId, name: businessName.trim(),
  email: email.trim(), business_type: businessType,
};
…
if (collectWebsite && website.trim()) bizInsert.website = website.trim();
```

Writes `businesses` (`OwnerSignup.tsx:282-286`) + `business_members` (`:320-339`) + `people` via
`findOrCreatePerson` (`:304-310`, non-blocking). It does **not** write `nursery_profiles`.

**The website IS a field on the create form** — `OwnerSignup.tsx:709-715`, `type="url"`, labeled
"Website (optional)", gated on `collectWebsite` (default `true`, `:92`).

### The discovery entry point

The scrape is fired from `DiscoveryGlimpse`, which runs as `VERTICAL_0` — a **wizard step after
creation**, not part of it (`SignUp.tsx:13-24`, `:43` `verticalSteps: [discoveryStep]`).

It does not receive the URL from the form. It **re-reads it back out of the row that was just written**:

```
packages/shared/src/discovery/DiscoveryGlimpse.tsx:67-71
  .from('businesses').select('website').eq('id', businessId)
```

Then two separate HTTP calls to `/api/discovery/ingest`:
1. **profile analysis** — `DiscoveryGlimpse.tsx:102-106`, body `{ url, vertical, businessId }`
2. **catalog seed** — `DiscoveryGlimpse.tsx:154-158`, body `{ action: 'populate', businessId, url }`,
   fired only on analysis success (`:127` → `startSeed`).

Server: `packages/cultivar-os/api/discovery/ingest.ts:128-149`, `action === 'populate'` →
`populateCatalog(businessId, url, db, { apiKey })` at `:138`. Deliberately **ungated** — no permission
check (comment `ingest.ts:124-127`), service-key write (`:132`).

### Where the seam becomes VISIBLE — flag for the dress rehearsal

`startSeed` is **explicitly non-blocking and non-fatal** — `DiscoveryGlimpse.tsx:147-148`:

> *"Non-fatal: a failure just leaves the empty dashboard… never blocks 'Open my dashboard'"*

**A catalog scrape that fails, times out, or returns zero rows produces NO error in front of the buyer.**
It produces an empty dashboard that looks like a working product with nothing in it. In a demo that is
worse than an error, because the failure is silent and David will be narrating over it.

Second visible seam: if the website field was left blank, `DiscoveryGlimpse.tsx:77` sets
`phase('no_website')` and renders a **second website input** (`:216-226`) plus a
**"Skip for now →"** button (`:247-255`). Asking Lauren for her URL twice in ninety seconds reads as a
seam. Filling the field at creation avoids this branch entirely.

### What wiring them into one flow would touch

Small, and worth stating: the URL already survives the hop (it is on the `businesses` row).
One flow would mean `OwnerSignup`'s submit calling `populate` directly rather than deferring to
`VERTICAL_0` — which changes `OwnerSignup` (shared, cross-vertical) for a Cultivar-specific reason.
**The cheaper demo fix is not rewiring; it is making the seed's failure LOUD** rather than silent.
That is a `DiscoveryGlimpse` copy/state change, not an architecture change.

---

## R2 — FRESH TENANT vs EXISTING TENANT

**Verdict: they are NOT different code paths. `populateCatalog` runs the same sequence unconditionally.**
There is no `if existing`, no count check, no branch. Confirmed by reading the function top to bottom —
`populate.ts:190-330`.

Every run, in order (`populate.ts:240-241`):

```ts
const sandboxCleared   = await clearSandbox(businessId, supabase);
const discoveryCleared = await clearDiscovery(businessId, supabase);
```

- `clearSandbox` — `populate.ts:66-78`. Hard DELETEs on `[SANDBOX]` orders, `SMPL-` plants/inventory,
  `source='sandbox'` customers.
- `clearDiscovery` — `populate.ts:88-108`. **Not a raw delete** — RPC `discovery_rescan_clear`
  (`populate.ts:89-92`), defined `supabase/migrations/20260720_inventory_movement_ledger.sql:827-874`.
  It tombstones (`status='deleted'`, `:859-861`) only lots that are genuinely untouched, and **SKIPS**
  any lot where `qty <> 0`, or that has a ledger row of kind other than `opening_balance`, or that has
  an `inventory_counts` row (`:851-856`).

**On a tenant with ZERO rows** (LAWNS): `clearSandbox` deletes 0, `clearDiscovery` returns `cleared: 0`,
then the full row set inserts fresh at `populate.ts:268`. **Clean. Nothing engages, nothing to go wrong.**
This is the good news of this recon — the LAWNS path is the *simple* path.

**On a tenant with existing DISC- rows** (the two test tenants): uncounted rows are tombstoned, counted
rows survive, and then a **fresh full insert runs with SKUs restarting at `DISC-1001`**
(`populate.ts:136`, `skuIdx` reset at `:246`). There is no dedup, no merge, no `onConflict` on the
inventory insert.

> **⚠️ Consequence, grounded, and it matters for the rehearsal.** If David rehearses by re-scraping a
> test tenant that has any COUNTED DISC- row, that row is protected from the clear (`:851`) and the new
> insert mints **a second row carrying the same SKU, name, variant_group and size**. The rehearsal
> would exercise a duplicate-manufacturing path that the LAWNS demo will never touch — and would look
> like a bug in the thing being demoed. **Rehearse on a fresh empty tenant, not on a test tenant.**

The only dedup anywhere in the path is by variety name *within a single extraction run*
(`catalog.ts:355-359`). `findDuplicateSizeGroups` (`populate.ts:260`) detects `(variant_group, size)`
collisions **within the new batch only** and merely logs and reports them — both rows are still written,
by design (comment `populate.ts:256-259`). It cannot see pre-existing surviving rows.

---

## R3 — WHAT HAS NEVER RUN (the 2026-07-17 finding, re-checked)

Four claims were on the record. Three hold. **One is wrong, and the correction changes the risk picture.**

### ✅ The enrichment functions exist and ARE wired — this refutes "defined-but-unwired"

- `extractSizeVariants` — `packages/shared/src/discovery/catalog.ts:436`. Deterministic, no AI.
  PRIMARY: parses the WooCommerce `data-product_variations` attribute (`:446`), collecting any
  attribute key matching `/siz/i` (`:454`). FALLBACK: size `<select>` option labels (`:463-474`).
- `fetchProductVariants` — `catalog.ts:513`. Bounded second-pass crawl: entry page →
  `discoverProductLinks` (`:528`) → category pages capped at `maxCategoryScan` default 25 (`:515`) →
  fetch each `/product/<slug>/` and read sizes (`:547-556`).

**Live call chain, fully connected** — I traced it end to end:
`ingest.ts:128` → `ingest.ts:138 populateCatalog` → `populate.ts:197 fetchCatalogPages` →
`populate.ts:198 extractCatalog` → **`populate.ts:218 fetchProductVariants(...)`** →
`catalog.ts:550 extractSizeVariants(html)`.
Match by `canonicalNameKey(slug)` ↔ `canonicalNameKey(variety)` (`populate.ts:223, 226`);
row expansion one-per-(variety × size) at `populate.ts:249-253`.

Both landed in **one commit**: `9f1063e`, **2026-06-28**, *"feat(discovery): capture WooCommerce size
variants into the catalog (B-clean, ledger #62)"*. `fe9360b`, **2026-06-30**, added the dup-size
data-quality surface.

### ⚠️ CORRECTION — `countPromote.ts` is not "FALSE", it is STALE, and the difference matters

The 07-17 finding recorded the comment as **FALSE**. Read in full, it is **historically accurate and
presently misleading** — a sharper and more useful diagnosis. The actual text,
`packages/shared/src/inventory/countPromote.ts:23-25`:

> *"The scrape (populate.ts) minted ~103 of these under the D-9 honesty contract — qty 0, no cost, no
> size — **because scrape-reads-variations was never built.**"*

At the time those ~103 rows were minted, that was **true** — the scrape's only write was 2026-06-26,
and `fetchProductVariants` did not exist until 2026-06-28 (`9f1063e`). The sentence correctly explains
*why the existing data looks the way it does*. It reads as present tense, which is how it fed two days
of wrong reasoning. **The capability was built; it has simply never re-run.** Calling it "false" invites
deleting the comment; calling it stale invites tensing it — which is the right fix. Comment-only,
tech-debt **#61**, unchanged in scope.

### 🔴 Has the enrichment ever EXECUTED? — **DAVID-QUERY**

I cannot ground this. It requires the live database and I made no network calls and ran no scrape.
The evidence needed:

```sql
-- has any scrape run since 2026-06-28?
select max(created_at), count(*) from business_inventory where sku like 'DISC-%';
-- how many scraped rows carry a size (the enrichment's only observable output)?
select (size is not null) as has_size, count(*)
  from business_inventory where sku like 'DISC-%' group by 1;
```

If the second query returns **all-null**, no scrape has run since 06-28 and the enrichment has never
executed in production — which is what the 07-17 finding recorded and what the ~103 stub count implies.

### Tests — they exist, they pass, and they do NOT run under the project runner

Both Woo fixture suites exist and are green **when run their documented way** (esbuild → node,
all fetches injected, no network):

- `packages/shared/src/discovery/catalog.test.ts` — **35 passed, 0 failed**
- `packages/shared/src/discovery/catalog-variants.test.ts` — **31 passed, 0 failed**

`catalog-variants.test.ts` is a **hand-written Woo fixture, not a live URL**: `VITEX_JSON_HTML` at
`:33-40` is an entity-escaped `data-product_variations` attribute with `attribute_pa_tree-size` values
`5/15/30/45-gallon`. It asserts JSON-primary extraction (`:55`), `<select>` fallback with placeholder
skipped (`:60-62`), simple-product → `[]` (`:67-68`), gallon normalization incl. `#15`/`15G`/`15gal`
(`:73-78`), the bounded crawl over an injected in-memory site map (`:103-117`), and 4 sizes → 4 rows
with `variant_group='shoal-creek-vitex'` (`:128-134`).

> **⚠️ But `npx vitest run packages/shared/src/discovery/` reports `6 failed (6) · no tests`.**
> All six discovery `.test.ts` files fail identically with *"No test suite found in file"*. They are
> plain top-level scripts with a hand-rolled `ok()` counter (`catalog.test.ts:22-26`) and a `setTimeout`
> reporter (`:162`) — no `describe`/`it`. Their own headers say so (`:9-11`).
> **`npm run verify` therefore proves nothing about the discovery parser.** The green Woo coverage is
> real but invisible to the gate — a fixture that passes in a runner nobody invokes is one refactor away
> from silently rotting. Not a demo blocker; worth a debt row.

---

## R4 — WHAT LANDS, AND IS IT DEMOABLE?

**This is the demo risk, and it is sharper than "rows land size-less".**

The only insert object in the path — `packages/shared/src/discovery/populate.ts:130-149`, quoted:

```ts
const row = {
  business_id:     businessId,
  sku:             `${DISC_SKU_PREFIX}${String(1001 + index)}`,   // DISC-1001…
  name:            item.variety,
  description:     descParts.join(" · ") || null,
  qty:             0,                     // never fabricate stock
  unit_cost:       null,                  // site has no prices → UNKNOWN, never 0
  cost_confidence: 'UNKNOWN',
  status:          item.flagged ? 'review' : 'available',
  notes:           noteParts.join(' · '),
};
if (size !== undefined)         row.size = size;
if (variantGroup !== undefined) row.variant_group = variantGroup;
```

| Field | Lands? | Source | Line |
|---|---|---|---|
| `name` | ✅ reliably | `item.variety`, AI-extracted common name (size NOT appended) | `populate.ts:137` |
| `sku` | ✅ always | synthetic `DISC-` + `1001+index` | `:136` |
| `description` | ⚠️ often null | `[botanical, category].join(' · ') \|\| null` | `:121,138` |
| `size` | ⚠️ **only if the product is a Woo VARIABLE product** | `extractSizeVariants` | `:147` |
| `variant_group` | ⚠️ same condition | `item.sourceSlug` (the Woo product slug) | `:148`, set `:228` |
| `qty` | 🔴 **hardcoded `0`** | never scraped | `:139` |
| `unit_cost` | 🔴 **hardcoded `null`** | never scraped | `:140` |
| **`sell_price`** | 🔴 **NEVER WRITTEN AT ALL** | — | see below |
| **photo / image** | 🔴 **NEVER WRITTEN — no column exists** | — | see below |

### The two hard zeros

**`sell_price` is never written by any line in the discovery path.** The column exists
(`supabase/migrations/20260707_business_inventory_sell_price.sql:22`) and `grep -rn "sell_price"
packages/shared/src/discovery/` returns **zero hits**. This is not an oversight — prices are *actively
refused*: the extraction prompt forbids them (`catalog.ts:210, 236`), and `extractSizeVariants` reads
only `attribute_*siz*` keys (`catalog.ts:454`), parsing straight past the `display_price` field that is
visibly present in the Woo variations JSON (fixture, `catalog-variants.test.ts:35`).

**There is no image column on `business_inventory`.** `grep 'ADD COLUMN.*\(photo\|image\)'
supabase/migrations/*.sql` → zero hits. No image extraction exists in `catalog.ts` — image extensions are
explicitly *excluded* from link discovery (`catalog.ts:95`). And `synthesizePlant` hardcodes
`photo_url: null` (`packages/cultivar-os/src/lib/stockLinePlant.ts:31`), so **every discovery-seeded lot
renders the 🌳 emoji placeholder, always** (`PlantHero.tsx:34-52`).

### What Lauren actually sees, stated plainly

Answering the question as asked — *"if 100 rows land nameless-sized-priceless, Lauren sees a broken
catalog in the first two minutes"*:

**Rows will NOT land nameless.** Names are the one thing the scrape does reliably, and names are the
thing Lauren recognizes as hers. That is the demo's actual asset.

**Rows WILL land priceless and photoless — 100% of them, by design, not by defect.** Sizes land only
for variable products. This is the D-9 honesty contract working exactly as written (`:139-141`
comments), and it is defensible *if narrated* — "we read your site and pulled your varieties; we don't
invent your prices, you set those." It is indefensible if David clicks into the grid expecting numbers.

**The sharp edge:** `packages/cultivar-os/src/lib/inventoryStates.ts:183-198` refuses to sell on both
axes — `sell_price <= 0` → `'No price set — set it in Inventory before this can be sold.'` (`:185-189`),
and `qty` 0 → `'None in stock.'` (`:191-198`). **A freshly scraped LAWNS catalog is 100% unsellable on
arrival.** Since steps 3–4 of the demo are *inventory + order*, the bridge from step 2 to step 4
requires David to hand-set price and qty on at least one lot, live. **That hand-off is the demo's
weakest joint and it is not currently scripted.**

---

## R5 — THE SITE RENDER (step 3)

**Verdict: the surface the demo script assumes — "her proposed Cultivar site", a browsable catalog —
DOES NOT EXIST.**

`CLAUDE.md:443` carries `- [ ] Online Shop (/shop page)` unchecked. **The unchecked box is accurate.**
Grepping `packages/` for `'/shop'`, `/catalog`, `storefront` returns only import paths for the *scraper*
module `packages/shared/src/discovery/catalog.ts` — zero route, zero page component. There is no
`Shop.tsx`, `Catalog.tsx`, or `Storefront.tsx` in `packages/cultivar-os/src/pages/`.

The customer-facing surface is `/plant/:tagId` (`router.tsx:87` → `PlantProfile.tsx`) — a **single-SKU
page reached by scanning a physical QR tag**, then a linear checkout
(`/plant/:tagId/addons` → `/checkout/customer` → `/checkout/review` → `/checkout/confirm`,
`router.tsx:88-93`). **There is no browse or index surface anywhere in the router.**

### And an anonymous scan of a scraped lot resolves to "Plant not found"

`usePlant` resolves in two lanes:
- **L1 specimen** — `cultivar_plants` by `tag_id` (`packages/cultivar-os/src/hooks/usePlant.ts:96-100`).
- **L2 stock-line fallback** — `business_inventory` via `resolveStockLine`, **guarded by
  `if (businessId)`** (`usePlant.ts:130-131`). The comment at `:127-129` states the reason:
  *"needs a business session (business_inventory has owner/member RLS, no anon read) — an anon scan with
  no session simply falls through to 'not found'."*

Corroborated in SQL, not taken from the comment: `business_inventory` carries only
`business_inventory_owner_all` (`20260612_business_assets_inventory_pmi_service.sql:117`) and
`business_inventory_member_all` (`20260622_is_active_member_canonical_rls.sql:137-139`) — **no anon
policy**. `cultivar_plants` by contrast retains `anon_select_plants … TO anon USING (true)`
(`20260528_per_tenant_rls_isolation.sql:37-42`).

**A discovery-seeded tenant has `business_inventory` rows and ZERO `cultivar_plants` rows.** So an anon
QR scan hits neither lane → `PlantProfile.tsx:65-77` renders **"Plant not found."**

> **Demo-relevant nuance:** on **David's logged-in device** the L2 fallback engages and the page renders
> — name, 🌳 placeholder, empty CONTAINER stat, and the honest **"Not set"** price
> (`PlantHero.tsx:88-95`). **If he hands the phone to Lauren on her own device, or scans signed-out, it
> reads "Plant not found."** The same physical action produces two different outcomes depending on
> session. That is the single most likely way the demo breaks in front of the buyer.

Null-handling on the surfaces that do render is graceful, not crashy: name falls back
`common_name ?? species` (`PlantHero.tsx:68-73`, blank if both null); photo → 🌳 box (`:34-52`); size →
label over empty space (`:77`); price → honest **"Not set"**, never `$0` (`:88-95`, per the D-35 comment
`:24-27`).

`/discovery/inspect` (`router.tsx:208`) is **not** a storefront — it is the prospecting tool. It POSTs
`{ url, vertical, painPoint }` with **no `businessId`** (`DiscoveryInspect.tsx:84-88`), so
`ingest.ts:205` skips all persistence. It renders a `SilentPartnerAnalysis` email. It touches no tenant
data and no catalog. **It may nonetheless be the best "show them their own site" beat available**, since
it needs no tenant at all — but it shows an *analysis*, not a catalog.

---

## R6 — D-52/D-50 ON A FRESH TENANT

**The 2A finding still holds, and it is worse than "manual-create has no RPC": the intended emitter
exists, is correct, and has ZERO callers.**

**`populate.ts:268` is a bare insert.** No ledger write:

```ts
let { error: insErr } = await supabase.from('business_inventory').insert(rows);
```

Repo-wide, `business_inventory_ledger` appears in app code **exactly once** — a READ at
`packages/cultivar-os/src/pages/InventoryReconcile.tsx:182`. There is no INSERT trigger on
`business_inventory` (the only trigger is `business_inventory_updated_at`, **BEFORE UPDATE**,
`20260612_business_assets_inventory_pmi_service.sql:151-153`).

**The orphan.** `supabase/migrations/20260720_inventory_movement_ledger.sql:776` defines
`public.discovery_create_inventory(...)`, which inserts the lot (`:788-791`) and then emits:

```sql
v_ledger := public.emit_inventory_movement(
  p_business_id, v_lot, 0, 'opening_balance',
  'catalog discovery birth (qty 0 — stock is never fabricated)',
  'discovery', p_source_id, NULL, p_occurred_at);
```

Its header names this exact job — *"populate births … emit points 13, 14"* — and cites `populate.ts:119`
(`:771-773`). **It has zero callers.** `grep -rn "discovery_create_inventory" --include="*.ts"
--include="*.tsx" --include="*.mjs"` returns exactly one hit, and it is a comment *declining* to use it:
`packages/cultivar-os/src/components/inventory/inventoryEdit.ts:116`.

### Does it matter for the demo? — mostly no, with one live edge

**Replay-vs-on-hand still holds, for a specific reason.** A scraped row is born `qty = 0`, and the
genesis row that *should* exist would be a **zero-delta** `opening_balance` (that is exactly what
`discovery_create_inventory` emits — delta `0`, `:797-800`). So `qty (0) == SUM(delta) (0 rows = 0)`.
**The invariant is satisfied by accident of the value being zero, not by the ledger being correct.**
It holds through the first count too: D-50 2A routes qty writes through the movement RPCs
(`ef6239e`, 2026-07-20), so the first count on a scraped lot writes its own `count_reconcile` movement
and book and replay stay in step. **The reconcile screen will behave on a fresh LAWNS tenant.**

**The live edge worth flagging.** `discovery_rescan_clear`'s protection predicate keys off
`l.kind <> 'opening_balance'` (`:851-852`) — *a predicate over rows this path never writes*. The guard
still works, because it also tests `qty <> 0` and the `inventory_counts` existence (`:851-856`), and a
counted lot trips both. But one of its three conditions is currently dead by construction. That is a
latent correctness gap in the re-scan protection, **not** a demo blocker — and it does not fire at all on
the fresh-tenant path.

**Net for the demo: no action needed.** Net for the arc: `populate` births lots with no genesis row while
the function to do it correctly sits written and unwired — a one-line call site, but a code change, and
this is a recon.

---

## VERDICT

**The create→scrape→site path is ONE motion in the UI and TWO operations underneath — the seam is
survivable, and it is not the biggest risk.**

**The single biggest risk to the first two minutes: step 3 has no surface.** There is no `/shop`, no
catalog, no storefront — only `/plant/:tagId`, one SKU at a time, reachable by scanning a physical QR
tag that a brand-new LAWNS tenant does not have printed. And because scraped rows live only in
`business_inventory` (no anon RLS policy, `20260612…:117`) with zero `cultivar_plants` rows, **the same
scan renders for David signed-in and reads "Plant not found" on Lauren's own phone**
(`usePlant.ts:130-131`).

Runner-up, and the one that bites even if step 3 is re-scoped: **a freshly scraped catalog is 100%
unsellable by design** — `qty: 0` and no `sell_price` on every row (`populate.ts:139-140`), both refused
at `inventoryStates.ts:183-198`. Getting from step 2 to the OWNER-PROVEN steps 4 requires David to
hand-set price and qty on a lot, live, in front of the buyer. That bridge is currently unscripted.

**Three things worth deciding before the dress rehearsal (David's call, no build implied):**
1. **What IS step 3?** Re-scope it to the inventory grid ("here is your catalog, in your system") rather
   than a customer-facing site — or accept that `/shop` is a build.
2. **Rehearse on a fresh empty tenant.** Re-scraping a test tenant exercises a duplicate-manufacturing
   path (R2) that LAWNS will never hit and that looks like a bug.
3. **Make the seed's failure loud.** `DiscoveryGlimpse.tsx:147-148` swallows it into an empty dashboard —
   silent failure narrated over is the worst outcome available.

**DAVID-QUERY (needs the live DB, unanswerable from code):** has any scrape run since 2026-06-28, and do
any `DISC-` rows carry a non-null `size`? Two queries in R3. That answer determines whether the
06-28 enrichment is *untested in production* or merely *unproven* — and it is the difference between
"sizes will land for LAWNS" and "nobody knows."
