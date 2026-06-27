# Grower Resolve Design — format-agnostic scan-identifier → catalog-row

**Date:** 2026-06-26 · **Author:** Thunder · **Type:** RECON / DESIGN (read-only — no build, no schema, no migration)
**Corpus:** `data/grower-scan/` (28 grower catalogs + index; desktop-only test data, NOT committed)
**Triggered by:** walk-and-count owner-prove FALSE-UNKNOWN — LAWNS QR slug `vitex-shoal-creek` fell to UNKNOWN even though the catalog holds it as `Shoal Creek Vitex` / `DISC-1105`.
**Doctrine it extends:** the existing QR rule (strip-URL → resolve, tenant-scoped, URL-agnostic) → now *normalize every grower's identifier scheme onto ONE canonical catalog key.* This is an AC-1 statement: the variation lives in the **data**, not the resolver logic or schema.

---

## 0. The problem at the right altitude

This is **not** a LAWNS fix. A scanned identifier (QR slug, SKU, typed code) and a catalog row must resolve to the same plant — but across ~100 growers they will **never share a format**. The current resolver bakes in a hidden assumption (`scanned tag == cultivar_plants.tag_id` OR `== business_inventory.sku`), which holds for TRACE-issued tags but breaks the moment a discovery-populated catalog is in play: the QR carries the grower's product slug, the catalog carries a proper name + a *synthetic* `DISC-` SKU, and the two have **zero characters in common** except the words of the name itself.

**Ground-truth resolver today** (`pages/InventoryCount.tsx:171-218`):
```
extractTag(raw)                                   # strips any URL → last path segment (already format-agnostic ✓)
 → cultivar_plants.tag_id  ilike tag   (L1)       # per-specimen TRACE QR
 → business_inventory.sku  ilike tag   (L2)       # exact sku
 → UNKNOWN                              (L3)
```
**Why LAWNS missed:** discovery's `populateCatalog` (`packages/shared/src/discovery/populate.ts`) **does not write `cultivar_plants`** (L1 empty) and stores `sku: 'DISC-1105'` (L2: `vitex-shoal-creek` ≠ `DISC-1105`). The plant *name* — the one field both sides share — is **never compared**. The scan's `/plant/<tag>` regex also doesn't even match a `/product/<slug>` URL, but the generic last-segment fallback does yield `vitex-shoal-creek` correctly; the strip is fine, the **join** is the gap.

---

## 1. Corpus inventory

| Metric | Value |
|---|---|
| Grower catalogs scanned | 28 (LAWNS / Backbone / Tagawa anchors excluded) |
| Growers with a real per-item catalog | **8** |
| Growers empty (brochure / social-only / wholesale-walled / PDF-less) | 20 |
| **Total catalog rows** | **1,382** |
| Uniform scan schema (all CSVs) | `grower_name, common_name, botanical_name, category, size_or_container, price, price_unit, stock_status, item_url, source_page_url, fetched_at` |

**Platform spread (the format diversity that matters):** WooCommerce (Calloway's, Hill Country, *LAWNS*), Wix Stores (ATX Trees), custom ColdFusion plant library (93 Nursery), WordPress photo gallery (Vivero), custom-CMS inline availability list (Far South, 647 rows), **retail PDF** (Hope Valley), plus Squarespace / Duda / PHP / Facebook-only brochures (the 20 empties). The 8 catalog-bearing growers:

| Grower | Rows | item_url? | botanical? | identity-bearing fields present |
|---|---:|:---:|:---:|---|
| Far South Wholesale | 647 | ✗ | 491 | name (+ botanical for ~75%) |
| Native Texas Nursery | 204 | ✗ | 204 | name + botanical |
| Hill Country Water Gardens | 143 | ✗ | 0 | name only |
| Vivero Growers | 129 | ✗ | 21 | name (+ some botanical) |
| 93 Nursery | 96 | **95** | 96 | name + botanical + **product URL** |
| Hope Valley Tree Farm | 71 | ✗ | 70 | name + botanical (from PDF) |
| Calloway's Nursery | 48 | **48** | 2 | name + **product URL** |
| ATX Trees | 28 | **28** | 0 | name + **product URL** |

---

## 2. Identifier-scheme distribution — the core finding

**Two numbers decide the whole design:**

- **Per-item URL (slug-capable): 171 / 1,382 rows = 12.4%** — and *all* of it from just 3 growers (93 Nursery, ATX, Calloway's).
- **Name-only: 1,211 / 1,382 rows = 87.6%** — no per-item URL, no SKU.
- **Real POS SKU across the entire corpus: 0.** The only "sku" anywhere is the *synthetic* `DISC-####` discovery mints. (`business_inventory.sku` exists, but no scraped grower supplies one.)

**Slug formats, where they exist (each grower different — that's the point):**

| Grower | URL pattern | Slug word order | Example name → example slug |
|---|---|---|---|
| LAWNS (WooCommerce) | `/product/<slug>/` | **genus-first** | `Shoal Creek Vitex` → `vitex-shoal-creek` |
| Calloway's (WooCommerce) | `/<slug>/` | common-first | `African Violet` → `african-violet` |
| ATX (Wix Stores) | `/product-page/<slug>` | common-first | `Shumard Red Oak Tree` → `shumard-red-oak-tree` |
| 93 Nursery (ColdFusion) | `/Plant-Name/<Botanical-Common>` | **botanical-prefixed CamelCase-hyphen** | `'Red Wood' Coral Bark Japanese Maple` → `Acer-palmatum-Red-Wood-Coral-Bark-Japanese-Maple` |

**Name format:** proper-case common name, frequently **cultivar-first** ("Shoal Creek Vitex"), peppered with `®`/`™`/`℠`, quoted cultivars (`'Bloodgood'`), parentheticals (`Air Plants (Tillandsia)`), and `&` (which leaks into slugs as the HTML-entity token `amp`, e.g. `Rise & Shine™` → `Rise-amp-Shine`).

**The mismatch quantified against the candidate keys:**

| Candidate canonical key | Corpus coverage | Verdict |
|---|---|---|
| Stored product **slug** (exact slug==slug) | 12.4% (3 growers) | High precision **where present** — but cannot be the base; 87.6% have no slug |
| Exact **SKU** | 0% real (only synthetic `DISC-`) | Dead as a join key today; reserve for future real-POS growers |
| **Normalized name token-set** (name ∪ botanical) | **~100%** (every catalog row has a name) | **THE canonical base key** |
| Normalized-text exact (lowercased, punct-stripped) | ~100% but order-sensitive | Subsumed by — and inferior to — token-set equality (it would miss LAWNS' word-order flip) |

---

## 3. The empirical test — does token-set actually resolve the corpus?

I ran the normalized token-set matcher (lowercase; strip `®™℠`, quotes, the `amp` entity leak; drop botanical connectors `var/x/ssp/subsp/cv`; tokenize) over the 3 slug-bearing growers, comparing **scan-slug tokens** vs **catalog name ∪ botanical tokens**:

| Grower | url-rows | EXACT set-equal | subset | superset | **token-resolved** | partial-overlap | miss |
|---|---:|---:|---:|---:|---:|---:|---:|
| 93 Nursery | 96 | 89 | 1 | 3 | **93 (96%)** | 3 | 0 |
| ATX Trees | 28 | 28 | 0 | 0 | **28 (100%)** | 0 | 0 |
| Calloway's | 48 | 42 | 4 | 0 | **46 (95%)** | 2 | 0 |
| **Total** | **172** | 159 | 5 | 3 | **167 (~97%)** | 5 | 0 |

- **The LAWNS case is caught by token-set EQUALITY alone** — `{vitex,shoal,creek}` == `{shoal,creek,vitex}`. The cheapest correct layer above SKU-exact already fixes the bug.
- **subset/superset** carries the 93-Nursery botanical-prefixed slugs (`{red,wood,coral,bark,japanese,maple}` ⊆ `{acer,palmatum,…}`) and dropped-parenthetical cases.
- The **5 residual partial-overlaps are NOT format-regime failures** — they are source typos (`Bottlebush`/`Bottlebrush`, `Tommorow`/`Tomorrow`), plural/possessive drift (`Bird's Nest Fern` vs `birds-nest-ferns`), and one genuinely-different common name (`Sweet Almond Verbena` vs slug `Sweet-Almond-Bush`). These are exactly the legitimate fuzzy/unknown tail — not silent mis-matches.

**Collision safety (the danger of token-set):** distinct plants normalizing to the *same* token-set across 1,258 rows = **effectively zero** (the lone "collision" — Far South `Gayfeather Texas` vs `Gayfeather, Texas` — is the *same* plant, a comma artifact). The full name∪botanical set is highly discriminating because the **cultivar token is the discriminator** — e.g. 93 Nursery lists ~7 `Cercis canadensis … Redbud` cultivars and each stays distinct on its cultivar word. **This is the load-bearing constraint: never match on genus+common alone — keep every token.**

---

## 4. The canonical join key (recommendation)

> **Canonical key = the normalized NAME token-set (common-name ∪ botanical-name).** It is the only field present for ~100% of catalog rows, resolves ~97% of real scans, and produces ~0 false merges. The **stored product slug** is a high-precision *boost* layer where discovery can capture it (12%); the **exact SKU** is reserved for the (currently empty, eventually real) POS-grower case.

Normalization contract (one function, applied identically to both the scanned identifier and the catalog name at index time):
1. lowercase
2. `&`/`&amp;` → space; strip the stray `amp` token (slug entity leak)
3. strip `®` `™` `℠`, quotes/apostrophes, all non-alphanumerics → token boundaries
4. drop botanical connectors (`var` `x` `ssp` `subsp` `cv`) and 1-char tokens
5. (boost) optional light stemming for plural/possessive (`ferns→fern`, `bird's→bird`) — recovers the Calloway's/93 tail
6. result = a **set** of tokens

---

## 5. The layered resolver (most-specific → least)

| # | Layer | Catches | Corpus reach | Honesty rule |
|---|---|---|---|---|
| L1 | `cultivar_plants.tag_id` exact | per-specimen TRACE-issued QR | Regime B primary | unchanged |
| L2 | `business_inventory.sku` exact | real POS SKU encoded in QR | ~0% today, real later | unchanged |
| L3 | **stored product-slug exact** (norm scan-slug == stored `source_slug`) | WooCommerce/Wix where discovery captured the href | 12% (Regime A), ~100% precision | requires the §6 capture change |
| L4 | **token-set EQUALITY** (scan tokens == catalog name∪botanical tokens) | **the LAWNS word-order fix; universal base** | ~92% of name-bearing scans | ~0 false merges (proven §3) |
| L5 | **token-set SUBSET/SUPERSET + single-candidate guard** | botanical-prefixed slugs, dropped qualifiers | +~5% | **if >1 candidate → NEED_CLARIFICATION** (present the candidate list, ask) — never a silent pick (AC-3: never resolve to a *wrong* record) |
| L6 | (optional) **stemmed token-set** | plural/possessive drift | the Calloway's/93 tail | same single-candidate guard |
| L7 | **UNKNOWN** → promote-to-inventory | genuinely new plant / source typo / name≠slug | residual ~3% of slug-rows + true new stock | the existing UNKNOWN branch — this is what it's *for* |

This mirrors the already-shipped `sameCost` epistemic model in `CountOnceSeam.ts` (MERGE / DISTINCT / NEED_CLARIFICATION): a match that is ambiguous resolves to a **candidate set + a question**, never a guess.

**Coverage the design achieves:** L3 resolves the 12% slug-rows at ~100% precision (where captured); L4–L6 resolve ~97% of name-bearing scans at ~0 false-merge; **residual TRUE-unknown ≈ 3% of slug-rows** (typos, variant common names) **plus** genuinely-new plants absent from the catalog — which is precisely the population the promote-to-inventory path exists to absorb. UNKNOWN becomes *rare and genuine*, not a format artifact.

---

## 6. What discovery must capture (recommend — do NOT build yet)

The capture gap, confirmed in code:
- **`packages/shared/src/discovery/catalog.ts`** — `CatalogItem` is `{ variety, botanical, category, confidence, sourceUrl }`. `sourceUrl` is the *listing/category* page, **not** the per-product URL. The extraction prompt asks for name/botanical/category only. **But `fetchCatalogPages` already harvests every `href` from the listing HTML (`catalog.ts:79`)** to decide what to crawl — then **discards** the per-product links. The product slug is *seen and thrown away*.
- **`packages/shared/src/discovery/populate.ts`** — `catalogItemToInventoryRow` writes `sku: 'DISC-####'` and buries `from <sourceUrl>` inside the free-text `notes` string. No matchable slug column; no normalized-name key.

**Recommended capture change (naming the files, not editing them):**
1. **`catalog.ts`** — when a listing exposes a per-item product href, associate it with the extracted item and carry `sourceSlug` (the last path segment of `/product/<slug>`) on `CatalogItem`. The hrefs are already in hand at line 79 — this is association, not a new per-product fan-out, for listing-based stores. (For the 87.6% name-only growers there is **no product URL to capture** — and extraction must not invent one; the §5 name-token floor carries them honestly.)
2. **`populate.ts`** — store the slug in a **dedicated matchable column** on `business_inventory` (e.g. `source_slug`), and store a derived normalized-name key alongside it — *not* in `notes`. This is what lets L3 (exact-slug) and L4 (token-set) join by construction instead of by free-text scraping. A new column = a gated migration, schema-verification gate applies — **flagged for a future build, not taken here.**

The principle: **make the scan and the catalog share one key at write time**, so resolution is a lookup, not a rescue.

---

## 7. Cross-grower landmines (the ugly cases, with evidence)

| Landmine | Example (grower) | Handling |
|---|---|---|
| **Word-order drift** (pervasive) | `Shoal Creek Vitex` ↔ `vitex-shoal-creek` (LAWNS); `Japanese Maple 'Emperor'` ↔ `Acer-palmatum-Japanese-Maple-Emperor` (93) | L4 token-set equality |
| **Trademark/quote/paren noise** | `'Summer Red®' Red Maple` → slug `…Summer-Red-Red-Maple` (93); `Air Plants (Tillandsia)` → `air-plants` (Calloway's) | normalization step 3 |
| **`&` → `amp` entity leak** | `Rise & Shine™ Redbud` → slug `…Rise-amp-Shine-Redbud` (93) | normalization step 2 |
| **Cultivar collisions** (the real danger) | 7× `Cercis canadensis … Redbud` cultivars (93) | **keep ALL tokens; never genus+common only**; L5 single-candidate guard → NEED_CLARIFICATION |
| **Botanical-prefixed slug** | name has 4 tokens, slug has 6 incl. `Acer palmatum` (93) | L5 subset (scan ⊇ catalog) |
| **Source typos** | `Bottlebush`/`Bottlebrush`, `Tommorow`/`Tomorrow` (93) | residual UNKNOWN — honest, not forced |
| **Plural/possessive** | `Bird's Nest Fern` ↔ `birds-nest-ferns` (Calloway's) | L6 stemming |
| **name ≠ slug** | `Sweet Almond Verbena` ↔ slug `Sweet-Almond-Bush` (93) | NEED_CLARIFICATION / UNKNOWN — refuses to guess |
| **No identifier at all** | 87.6% name-only growers (Far South, Hope Valley PDF, Native Texas, Hill Country, Vivero) | QR must be a TRACE-issued `tag_id` (L1) or typed name (L4); no slug to encode |
| **Comma-in-name CSV artifact** | `Ajuga, Chocolate Chip` split across columns (Far South / Native Texas / Hope Valley) | a *capture/parse* note, not a resolver concern — flag for the scraper |

---

## 8. Recommendation

**Adopt the normalized name token-set as the canonical join key** (§4), behind the layered resolver (§5: tag_id → sku → stored-slug → token-set equality → guarded subset → stemmed → UNKNOWN), with the discovery-capture change (§6) so scan and catalog share a key by construction. This holds across the ~100-grower corpus because it rests on the **only universally-present field (the name)** and uses slug/SKU as precision boosters where the platform happens to expose them — variation in the data, one resolver.

**Build nothing until David confirms the canonical key.** When greenlit, the build splits cleanly: (a) the resolver layers L3–L6 in `InventoryCount.tsx` (no schema), and (b) the discovery-capture column `source_slug` + normalized-name key in `catalog.ts`/`populate.ts` (gated migration → schema-verification gate). The LAWNS false-UNKNOWN is fixed by L4 alone — the rest is the ~100-grower generalization.
