# Grower Inventory Scan + Site Fingerprint — Report

**Run:** 2026-06-21 (UTC) · **Scope:** 28 growers (3 anchors — LAWNS, Backbone Valley, Tagawa — excluded as already done)
**Output:** one raw CSV per grower in `data/grower-scan/`, the index in `growers_index.csv`. CSVs are raw and un-normalized; all analysis lives here.

---

## 1. Roster summary

| Metric | Count |
|---|---|
| Growers in roster (ex-anchors) | 28 |
| Fingerprinted / attempted | 28 |
| **With a real catalog (has_catalog=Y)** | **8** |
| Empty-with-reason (has_catalog=N) | 20 |
| **Total items captured** | **1,378** |

**has_catalog=N breakdown:** 19 are genuinely empty (no published per-item data) and carry a single `#` comment row stating why. 1 — Austin Tree Farm — is a partial: 12 species **names** are published but with zero commercial data (no size/price/stock, no product pages), so it is marked `N` (no commercial catalog) while still carrying its 12 name rows. Nothing was fabricated, inferred, or padded anywhere.

**Items by grower (the 8 with catalogs):**

| Grower | Items | What's capturable at catalog grain |
|---|---:|---|
| Far South Wholesale | 647 | common name + container size + freshness/stock note; price/botanical blank |
| Native Texas Nursery | 204 | common + botanical + category; size/price/stock login-walled (blank) |
| Hill Country Water Gardens | 143 | named products, 8 categories; **price on listing for some**, blank for most |
| Vivero Growers | 129 | common name + category (some botanicals); no size/price/stock anywhere |
| 93 Nursery | 96 | common + botanical name + Details URL; **no** price/size/stock at listing |
| Hope Valley Tree Farm | 71 | **name + size/caliper + price + in-stock qty** (from a retail PDF) |
| Calloway's Nursery | 48 | name + item URL; price/size product-page-only |
| ATX Trees | 28 | name + 'From' price for ~12; per-size price/container product-page-only |

---

## 2. Fingerprint scorecard

**Normalization note (read this):** the seven scout agents labeled the same outcome inconsistently (some called a "predicted-rich → found-nothing" result `BROKEN`, others `NO-CATALOG`). For a coherent scorecard I applied one consistent rule across all 28, disclosed here:

- **CONFIRMED** — predicted a real/rich browsable catalog, and found one.
- **NO-CATALOG** — predicted *no* real catalog (wholesale-walled / social-only / thin landscape-or-supply-led), and that held.
- **BROKEN** — the prediction flipped in either direction (predicted rich → found nothing, **or** predicted barren → found a real catalog).

| Result | Count | Meaning |
|---|---:|---|
| **BROKEN** | 17 | fingerprint was wrong |
| **NO-CATALOG** | 7 | correctly predicted barren, held |
| **CONFIRMED** | 4 | correctly predicted a real catalog |

**Headline: the predictions were wrong more often than right (17 of 28 broke).** The single biggest miss is the cluster thesis itself:

### The "destination garden center = rich catalog" thesis mostly collapsed
Of the **15** destination garden centers predicted to carry rich catalogs, only **2** actually did:
- ✅ **Hill Country Water Gardens** (real WooCommerce catalog, 143 items) and **93 Nursery** (custom ColdFusion plant library, 96 captured of a much larger whole).
- ❌ The other **13 broke to no-catalog** — almost all turned out to be Wix/Squarespace/WordPress/Duda/PHP **brochure sites** with prose category pages, photo galleries, or "call/visit" copy and **no per-item data**. Several (Greensleeves, Lonesome Pine, Pflugerville Pfoliage) publish stock only on **Instagram/Facebook**, not the website.

This is the experiment's most useful finding: **a polished destination-garden-center brand is a poor predictor of a scrapable online catalog.** Web maturity here is bimodal — a grower either runs a genuine e-comm/catalog engine or runs a brochure. There is very little middle.

### Interesting individual breaks
- **Far South Wholesale** — predicted login-walled/no catalog; instead its `/available` page **publishes the full live availability list inline (647 rows)** with container sizes and freshness notes. The richest single capture in the run came from a grower predicted to have nothing. The biggest "barren → found a catalog" surprise.
- **ATX Trees** — predicted a thin tree-farm catalog; is a full **Wix Stores** shop (28 products, sitemap-enumerable).
- **Hope Valley Tree Farm** — predicted WooCommerce/thin; is a GoDaddy marketing site whose catalog lives in a **downloadable retail-price PDF** — and it's the **only grower in the entire run that exposes name + size + price + live stock-qty together** at capture grain. The most complete commercial data came from a PDF, not a storefront.
- **Vivero Growers** — predicted WooCommerce/Shopify; is a plain WordPress **photo gallery**, no e-commerce, "we do not ship."

### Where the "barren" predictions held (NO-CATALOG, 7)
Wholesale walls (Newton — free-registration portal + app; Casa Verde — register-only email list) and the indie/social/supply-led shops (Cosmic, Pflugerville Pfoliage, Cantu, Premium) all matched their predictions. Austin Tree Farm also effectively held (species names only, no commercial catalog).

---

## 3. Per-grower one-liners

**TREE FARMS**
- **Hope Valley Tree Farm** — GoDaddy site + retail-price PDF (BROKEN): **71** items with name, size/caliper, **price, and in-stock qty**; botanical/category blank.
- **ATX Trees** — Wix Stores e-comm (BROKEN): **28** products from store sitemap; 'From' price for ~12, per-size price/container product-page-only.
- **Austin Tree Farm** — Squarespace contact-for-quote (NO-CATALOG): **12** species names only, zero commercial data, has_catalog=N.
- **Newton Nurseries** — wholesale login-wall (NO-CATALOG): **0**; inventory/pricing behind free landscaper registration + app, public pages 403.
- **Far South Wholesale** — custom-CMS public availability list (BROKEN): **647** rows (name + container size + freshness/stock note); botanical/price blank (one $175/ft).
- **Native Texas Nursery** — public what-we-grow catalog (CONFIRMED): **204** at common+botanical+category; size/price/stock login-walled (blank).
- **Casa Verde Farms** — Wix register-only email list (NO-CATALOG): **0**; no public per-item data.
- **Vivero Growers** — WordPress photo gallery, no e-comm (BROKEN): **129** common name + category (some botanicals); size/price/stock absent.

**DESTINATION GARDEN CENTERS**
- **Barryhill Garden Center** — Wix informational (BROKEN): **0**; department prose pages, no items.
- **Hill Country Water Gardens** — WooCommerce (CONFIRMED): **143** named rows across 8 categories; price on listing for some, blank for most; ~200+ more un-paged.
- **Hillside Nursery** — Wix services site (BROKEN): **0**; no catalog/nav/prices.
- **McIntire's Garden Center** — Duda CMS informational (BROKEN): **0**; prose supply sections only.
- **Farmer's Nursery** — JS brochure (BROKEN): **0**; headings + generic prose, no items.
- **Round Rock Garden Center** — Wix brochure + photo gallery (BROKEN): **0**; gallery is photos only.
- **Snooper's Nursery** — WordPress, fetch-blocked (BROKEN): **0**; category pages timed out; snippets show only generic size text.
- **Greensleeves Nursery** — Wix brochure (BROKEN): **0**; stock published on Instagram only.
- **Sam's Nursery** — WordPress brochure (BROKEN): **0**; prose category descriptions only.
- **Friendly Natives** — Squarespace, cart but no grid (BROKEN): **0**; category size-ranges only, no items.
- **Earthscapes** — custom PHP brochure, anti-bot (BROKEN): **0**; category prose, in-person only.
- **Lonesome Pine Nursery** — no website (BROKEN): **0**; Facebook + directories only.
- **93 Nursery** — custom ColdFusion plant library (CONFIRMED): **96** of a 28-category, "thousands of plants" catalog; common+botanical+Details URL, no price/size at listing grain.
- **Garden City Nursery** — WordPress 4-page brochure (BROKEN): **0**; prose categories, phone/in-person.
- **Eldred's Nursery** — nonprofit WordPress, photo/prose category pages (BROKEN): **0**. **KINNA-adjacent — flag for Regina** (job-training facility for adults with disabilities).

**CHAIN / MULTI-LOCATION**
- **Calloway's Nursery** — WooCommerce plant encyclopedia (CONFIRMED): **48** representative rows (name + URL); price/size product-page-only; hundreds more items.

**SMALL INDIE PLANT SHOPS**
- **Cosmic Plant Co** — Squarespace brochure (NO-CATALOG): **0**; no shop, in-person only.
- **Pflugerville Pfoliage and Plants** — WordPress brochure + gallery, 403 (NO-CATALOG): **0**; in-person Zelle/Venmo only.
- **Cantu Nursery & Landscape** — landscape-led, category-only nursery section (NO-CATALOG): **0**; no per-item prices, 503.
- **Premium Landscape Supply** — Hibu supply brochure (NO-CATALOG): **0**; materials quote-request only, no plant catalog.

---

## 4. Deep-pass follow-up candidates (DO NOT run without David's go)

These growers have a real catalog where **price and/or size live only on individual product pages** — capturing them means a per-product-page pass, which is exactly the fan-out that blew up the Tagawa hand-pull. Flagged, not run:

| Grower | What a deep pass would recover | Rough scale |
|---|---|---|
| **93 Nursery** | price/size/container/stock on `/Plant-Name/` pages; ~26 uncaptured categories + deeper pages | Large — site advertises "thousands of plants"; whole catalog plausibly 1,000+ |
| **Hill Country Water Gardens** | price (for the ~60% of items priced product-page-only) + botanical/size/stock; ~200+ un-paged items in Trees/Shrubs/Herbs/Fruit/Vines | Medium — ~200+ items |
| **Calloway's Nursery** | price + size on `/product/` pages; hundreds of items beyond the 48 representative rows | Large — 191 shrubs / 409 annuals / etc. |
| **ATX Trees** | per-size price + container on the 28 product pages | Small — 28 products |

**Notes for the deep pass:** 93 Nursery's pagination did not resolve cleanly via fetch (`?page=2` echoed page 1) — it likely needs a scripted leaf-loop, not WebFetch. It is also unverified whether 93 Nursery's product pages even carry price. Hill Country and Calloway's are the cleanest ROI (confirmed price exists on product pages).

## 5. Caveats / data-quality notes
- **Fetch-blocked / anti-bot:** Snooper's (persistent timeouts), Earthscapes (ECONNREFUSED/403), Pflugerville Pfoliage (403), Cantu (503). Their no-catalog calls lean partly on search-indexed snippets + reviews rather than a clean fetch — noted in each CSV's comment row. None were fabricated.
- **Hope Valley** PDF parse had a couple of minor artifacts (e.g. one stray digit in a height value); data is otherwise faithful to the 6/10/2026 retail list.
- **CSVs are raw:** no dedupe, no cross-grower normalization, no derived columns — each grower stays exactly as published, per the work order. Blank = not exposed at catalog grain (not "unknown" in any modeled sense).
