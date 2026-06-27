# Discovery — capturing SIZE variants from the grower's catalog

**Date:** 2026-06-27 · **Author:** Thunder · **Type:** LOOK + RECOMMEND (verify-before-build). **Build decision: STOPPED — structural, needs David's pick on the data model + a gated migration.** No code, no schema, no `[TRACE:*]` written this pass.

**Settled going in (NOT re-litigated):** size is a CONFIRMED real dimension of a nursery's stock. A nursery counts "Vitex 15gal: 20, Vitex 45gal: 45" — same plant, different sizes, **separate counts**. The count model is one countable line **per plant-per-size**. This doc is the discovery-capture half: why the scraper dropped the sizes, and how to capture them from the grower's own site.

---

## THE LOOK (#1–3) — why size variants were dropped

### #1 — Where discovery scrapes the catalog, and what it extracts
The catalog scraper is `packages/shared/src/discovery/catalog.ts`, fed by the website adapter `packages/shared/src/discovery/adapters/website.ts`, written by `packages/shared/src/discovery/populate.ts`. Flow:

1. **Crawl** — `fetchCatalogPages` ([catalog.ts:138](../../packages/shared/src/discovery/catalog.ts#L138)) raw-fetches the entry page, finds catalog/category links via `discoverCatalogLinks` ([catalog.ts:77](../../packages/shared/src/discovery/catalog.ts#L77)) matching `CATALOG_LINK_RE` ([catalog.ts:74](../../packages/shared/src/discovery/catalog.ts#L74) — includes `/product-category`, `/product`, `/shop`), does a bounded 2-level hub expansion, then **prioritizes `/product-category/` listing pages first** and caps at 30 ([catalog.ts:173-176](../../packages/shared/src/discovery/catalog.ts#L173)).
2. **Fetch per page** — each page goes through `fetchWebsiteContent` ([website.ts:87](../../packages/shared/src/discovery/adapters/website.ts#L87)), which `stripHtml`-s the markup ([website.ts:27](../../packages/shared/src/discovery/adapters/website.ts#L27)) and returns **only the cleaned text, capped at 10,000 chars** (`MAX_CONTENT_CHARS` [website.ts:2](../../packages/shared/src/discovery/adapters/website.ts#L2)). The raw HTML is discarded.
3. **Extract** — `extractCatalog` ([catalog.ts:321](../../packages/shared/src/discovery/catalog.ts#L321)) sends that stripped text to the AI (`discovery_catalog`) with `CATALOG_SYSTEM` ([catalog.ts:203](../../packages/shared/src/discovery/catalog.ts#L203)). The extraction schema is **`{ variety, botanical, category, confidence }`** ([catalog.ts:225-231](../../packages/shared/src/discovery/catalog.ts#L225)). There is **no `size` / `variant` field**, and the prompt explicitly tells the model **"Never report a price, a quantity, or a stock number"** ([catalog.ts:208](../../packages/shared/src/discovery/catalog.ts#L208)).
4. **Write** — `catalogItemToInventoryRow` ([populate.ts:78](../../packages/shared/src/discovery/populate.ts#L78)) writes **one `business_inventory` row per variety** with a synthetic `sku = DISC-####` ([populate.ts:89](../../packages/shared/src/discovery/populate.ts#L89)), `name = item.variety`, `qty = 0`, `unit_cost = null`. Parent-only. No size anywhere.

### #2 — WHY the variants are dropped (two independent causes)
**Confirmed live** against `https://lawnstrees.com/product/shoal-creek-vitex/` (raw HTML, browser UA). The Shoal Creek Vitex is a WooCommerce **variable product** and the size options are present **deterministically** in two places in the raw HTML:
- `<form class="variations_form cart" data-product_variations="[{...JSON, one object per size...}]">` — each variation carries `attributes.attribute_pa_tree-size` (`"5-gallon"`, `"15-gallon"`, `"30-gallon"`, `"45-gallon"`).
- `<select name="attribute_pa_tree-size">` with `<option value="5-gallon">5 Gallon</option>` … `45 Gallon`.

Cause **(a) — wrong page / wrong layer.** The crawl is **listing-first** (prioritizes `/product-category/` pages). A WooCommerce category page renders product **cards** (name + thumbnail + price) — the size dropdown **only exists on the single product page**. So the parent name "Shoal Creek Vitex" is read; the sizes are never on the page that's read.

Cause **(b) — the size data is destroyed and has no slot even if reached.** Even on a product page that *is* fetched:
- `stripHtml` removes **all tags** via `.replace(/<[^>]+>/g, ' ')` ([website.ts:44](../../packages/shared/src/discovery/adapters/website.ts#L44)). The `data-product_variations` JSON lives **inside** the `<form>` tag (an attribute) → it is **stripped away entirely**. (The `<option>5 Gallon</option>` *text* would survive stripping, but the product page is ~146 KB raw → far past the 10 KB text cap, and there is no guarantee the options survive the truncation.)
- The AI extraction schema has **no size field** and is instructed to extract *varieties*, not sizes → any surviving "5 Gallon" text is correctly treated as non-variety noise and dropped.

**Net:** sizes are dropped because the scraper reads category-listing text through an HTML-stripping, AI-variety-only pipe that (a) usually never sees the size selector and (b) has nowhere to put it and is told not to.

### #3 — Does the catalog/inventory model carry size today? **ABSENT.**
`business_inventory` ([20260612_business_assets_inventory_pmi_service.sql](../../supabase/migrations/20260612_business_assets_inventory_pmi_service.sql)) columns: `id, business_id, sku, name, description, qty, unit_cost, serial_number, location, status, received_at, photo_url, notes, created_at, updated_at` (+ `cost_confidence` added by [20260612_business_assets_inventory_cost_confidence.sql](../../supabase/migrations/20260612_business_assets_inventory_cost_confidence.sql)). **No `size`, no `variant`, no `parent_sku`, no `variant_group`.** `populate.ts` writes name + `DISC-####` only; size is carried by **nothing**. (Note: the walk-count loop already *displays* size in a free-text label — `inventory_counts.item_label` e.g. `"Shoal Creek Vitex, 30 gal"` [20260626_inventory_count_sessions.sql](../../supabase/migrations/20260626_inventory_count_sessions.sql) — but that's a typed label string, not a structured per-size lot.)

---

## RECOMMEND (#4) — how to capture the variants (structure-last: read THEIR sizes)

For a WooCommerce variable product, harvest the sizes **deterministically — no AI**. Two sources, both in the raw product-page HTML (confirmed live):

1. **Primary:** parse the `data-product_variations` JSON attribute on `<form class="variations_form">`. It's an array of variation objects; pull each `attributes.attribute_pa_tree-size` (or any `attribute_*` whose `<select>` label is "Size"/"Tree Size"). This gives the exact, ordered size set the grower published.
2. **Fallback:** parse `<select name="attribute_pa_*">` `<option>` labels (e.g. "5 Gallon"). Use when the JSON attribute is absent (older themes / AJAX-only variation data).

The catch: **both live inside HTML attributes/tags that the current adapter destroys**, on the **product page** (which the listing-first crawl deprioritizes). So capture requires:
- the crawl to **descend to individual `/product/<slug>` pages** (the regex already matches them — they're just deprioritized + uncapped-away), and
- the adapter to **retain the raw HTML for product pages** (today `fetchWebsiteContent` returns only stripped text), and
- a **new deterministic `extractSizeVariants(rawHtml)`** parser run on that raw HTML (NOT the stripped text, NOT the AI).

This keeps the division of labour honest: **the AI finds the variety set; a deterministic parser reads the grower's own size set per variety.** Sizes are never invented or hand-listed — they come straight off the grower's variation data. A variety with no variation form (a simple product) honestly captures **no size** (null), not a fabricated default.

---

## RECOMMEND (#5) — the data-model call: **Option B** (one row per plant-per-size)

**Recommendation: B.** Size is part of **count identity** — per-size on-hand is the entire point ("Vitex 15gal: 20, Vitex 45gal: 45"). Option A (size as metadata on a single row) structurally **cannot hold per-size counts** — one `qty` per row means one count per plant, which collapses exactly the distinction the grower walks the yard to make. A is rejected on the settled requirement, not on preference.

`business_inventory` is **already the per-lot / per-countable-line table** — the walk-count loop sets `qty` per inventory row. So Option B = write **one `business_inventory` row per (variety × size)**, each its own countable lot. Two ways to do B:

- **B-clean (recommended) — add structured columns.** `ALTER TABLE business_inventory ADD COLUMN size text` (the grower's own value, e.g. `"15 Gallon"`, nullable for simple products) **+ a grouping key** so the UI/count sheet can collapse siblings under one plant — either `variant_group text` (e.g. a stable parent slug `shoal-creek-vitex`) or a self-ref `parent_id uuid REFERENCES business_inventory(id)`. SKUs become per-variant (`DISC-1105-15GAL`). **Size is a first-class, queryable field** → the per-grower size list is `SELECT DISTINCT size WHERE business_id = ?`. **This is a migration → FLAGGED, NOT applied.** Append-only `ADD COLUMN`; `size` carries **no CHECK** (values are per-grower, AC-1/AC-4 — value not enum).
- **B-minimal (no migration, fragile) — encode in existing fields.** One row per variety×size, size baked into `name` (`"Shoal Creek Vitex — 15 Gallon"`) and a per-size `sku` (`DISC-1105-15GAL`); grouping inferred by string-parsing the name/sku. Works without schema change but: size isn't queryable, the per-grower size list needs string parsing, and grouping is brittle. Acceptable as a stopgap; **not** the durable answer.

**Schema implication (B-clean):** a `size text` column + a grouping key (`variant_group text` *or* `parent_id uuid`). My lean within B-clean is `variant_group text` holding the parent product slug — simpler than a self-ref, no parent "header" row to manage, and the slug is already available from the product URL during the crawl. **Migration flagged, not written, not applied** — David picks A/B and (if B-clean) `variant_group` vs `parent_id` first.

---

## CONFIRM (#6) — the size list is PER-GROWER, derived from their own site
Honored. LAWNS publishes 5/15/30/45 Gallon on their WooCommerce variations; another grower (Billy Bob's pots: 4in/6in/12in) publishes theirs. Because sizes are **read from each grower's own variation data** and stored as a **free-text `size` value** (no global enum, no hardcoded size table — AC-1: the value varies, the schema doesn't), the per-grower-owned-size-list decision is preserved end to end. A grower's size list is simply `SELECT DISTINCT size FROM business_inventory WHERE business_id = ?` — derived, never hand-built, never shared across tenants (AC-3).

---

## BUILD DECISION — STOPPED (structural), did NOT build
This is **not** a trivial fork-free change. Capturing variants requires (1) the adapter to retain raw product-page HTML, (2) the crawl to descend to product pages, (3) a new deterministic variation parser, and (4) the row-per-size data model + a gated migration. Per the brief, that's RECOMMEND-and-STOP, not build-on-spec. **Awaiting David's pick: Option A vs B, and (if B-clean) `variant_group` vs `parent_id`.** Then the capture path + parser + migration get built and proven on the LAWNS Vitex page (must capture 5/15/30/45). `[TRACE:POPULATE]` gains a variant-capture emit when built; any migration is flagged, never auto-applied.
