# Grower-CSV → Inventory Schema Fit Map

**Type:** Verify-first recon, READ-ONLY. No migrations, no code, no schema changes.
**Run:** 2026-06-21 · **Author:** Thunder (Claude Code)
**Question:** Can the LAWNS-built, cost-first inventory model ingest a real grower's *published* (sell-side) catalog without lying?
**Authority:** live migration source + the 28 raw CSVs in `data/grower-scan/`. Memory was not used. Where the schema contradicts the prompt's framing, the schema wins (flagged inline).

**One-line verdict:** The two hypotheses both **CONFIRM**, but the load-bearing finding is the one the prompt didn't ask about — **`business_inventory` is a COST ledger (`unit_cost` + `cost_confidence` + `receipt_id`), and every grower catalog publishes SELL price.** A drop-in import doesn't just lose size/price-basis; it **inverts the meaning of the one numeric column that fits.** This needs a mapping layer AND a small schema delta, not just a parser.

---

## 1. Schema snapshot — `business_inventory` as it LIVES

Source: `supabase/migrations/20260612_business_assets_inventory_pmi_service.sql:97-113`, altered by `20260612_business_assets_inventory_cost_confidence.sql`.

| Column | Type | Notes (as written in migration) |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `business_id` | uuid NOT NULL | FK → businesses, CASCADE. **RLS scopes everything to this** (owner_all + member_all). |
| `sku` | text (nullable) | no uniqueness constraint |
| `name` | text **NOT NULL** | the only required business field |
| `description` | text | free-text |
| `qty` | int **NOT NULL DEFAULT 0** | on-hand count |
| `unit_cost` | **numeric(10,2)** | **what the business PAID** — cost basis, not sell price (see §3 / the cost_confidence migration comment: "unit_cost is derived from that receipt") |
| `serial_number` | text | |
| `location` | text | free-text, "owner knows their own layout" |
| `status` | text **NOT NULL DEFAULT 'available'** | **no CHECK** — but seeded/used as a workflow state ('available'…), not a stock-freshness note |
| `received_at` | timestamptz | when stock arrived |
| `photo_url` | text | |
| `notes` | text | |
| `receipt_id` | uuid → receipts(id) SET NULL | **count-once dedup seam** — links stock cost to its receipt |
| `cost_confidence` | text CHECK (CONFIRMED/DERIVED/ESTIMATED/UNKNOWN) | epistemic status **of `unit_cost`** — a COST axis, not a price axis |
| `created_at` / `updated_at` | timestamptz | |

### Lot-model grain (the part the prompt asked to confirm)

**The `business_inventory` row IS the SKU/lot. Size is NOT a column — it does not exist anywhere on the inventory table.** (Schema contradicts the prompt's "is size an attribute or its own row" framing: it is *neither* — there is no size field at all.)

The plant identity model is a **separate** table, `cultivar_plants` (renamed from `plants`, `20260613_cultivar_plants_untangle.sql`):
- Surviving columns: `id, business_id, inventory_id (FK→business_inventory SET NULL), tag_id, species, common_name, plant_type, current_container, location_zone, warranty_months, photo_url, notes`.
- **Stock facts deliberately MOVED OUT of it into `business_inventory`** (`:5-6`: "Stock facts (status, arrived_at, base_price, install_price) move to business_inventory"). `base_price`/`install_price`/`status` were *dropped* from `cultivar_plants`.
- It is a per-specimen **identity/QR** join table (one tagged plant), pointing AT an inventory lot — not a catalog row. There is **no published-catalog table** anywhere.

⚠️ Note on `current_container`: it lives on `cultivar_plants`, the identity table, as a *single* container for *one tagged specimen*. It is **not** an inventory attribute and cannot hold a per-lot size ladder. So even the one "size-ish" field in the whole schema is on the wrong table and the wrong grain for catalog ingest.

---

## 2. Field-fit table

All 28 CSVs share one normalized header (the scout pre-canonicalized them):
`grower_name, common_name, botanical_name, category, size_or_container, price, price_unit, stock_status, item_url, source_page_url, fetched_at`.

| Grower field | Destination column | Meaning match? | Verdict |
|---|---|---|---|
| `common_name` | `name` (NOT NULL) | exact | **FIT** |
| `botanical_name` | — (none) | no botanical/species column on inventory | **NO-HOME** (forceable → `description`/`notes`, loses queryability). *Has a real home on `cultivar_plants.species`, but that's the identity table, not inventory.* |
| `category` | — (none) | no category/type column on inventory | **NO-HOME** (forceable → `notes`; `cultivar_plants.plant_type` exists but, again, wrong table) |
| `size_or_container` | — (none) | **no size/container/caliper column exists** | **NO-HOME** — the H1 break (see §3) |
| `price` | `unit_cost` | **MEANING INVERTS** — `unit_cost` = what the business *paid*; catalog `price` = what the grower *sells for* | **FORCE (mislead)** — lands numerically, lies semantically. The deepest mismatch. |
| `price_unit` | — (none) | no basis/UOM column; `unit_cost` is a bare `numeric(10,2)` | **NO-HOME** — the H2 break (see §3) |
| `stock_status` | `status` / `qty` | `status` is a workflow enum default 'available'; catalog values are freshness/availability prose ("In stock (qty 62)", "nice/bud & bloom", "info-page-only", "From") with qty **embedded in text** | **FORCE** for the label; `qty` (int) exists but the number is buried inside the `stock_status` string → needs extraction |
| `qty` (Hope Valley only, inside `stock_status`) | `qty` (int, exists) | exact once parsed out | **FIT-after-parse** |
| `item_url` | — (none) | no source/listing-url column | **NO-HOME** (forceable → `notes`) |
| `source_page_url`, `fetched_at`, `grower_name` | — | provenance/run metadata, not item data | **N/A** (drop or → provenance) |

**Tally:** 1 clean FIT (`common_name→name`), 1 FIT-after-parse (`qty`), 1 meaning-inverting FORCE (`price→unit_cost`), 1 lossy FORCE (`stock_status→status`), 5 NO-HOME (botanical, category, **size**, **price_unit**, item_url).

---

## 3. Hypothesis check

### H1 — SIZE LADDER → **CONFIRMED (the grain collides).**
One species at N sizes/prices is real and common in the data. Hope Valley, Crape Myrtle "Muskogee (Lavender)" is literally three rows (`hope-valley-tree-farm.csv`):

```
Muskogee (Lavender)  5'-6' 1"-1.5"   $80.00   In stock (qty 62)
Muskogee (Lavender)  5'-6' 2.5"      $295.00  In stock (qty 111)
Muskogee (Lavender)  8'-10' 3.5"+    $495.00  In stock (qty 90)
```
Same species → 3 distinct size/price/qty rows. Far South does the same with container grades (`#1`, `#15`, `#30`). **Can these land as 5 distinct inventory rows? Yes — `business_inventory` has no uniqueness on `(business_id, name)`, so N rows per species insert fine.** BUT they become **N rows that are indistinguishable** — `name` is identical, and **there is no `size`/`container`/`caliper` column to tell them apart.** The differentiator (`5'-6' 2.5"` vs `8'-10' 3.5"+`) has nowhere to live except shoved into `name` or `notes`. **Verdict: rows don't collide on insert; they collide on identity.** Size/stage is **not** a real column. H1's premise ("does the grain collide") confirms — the ladder survives as rows but loses the rung labels.

### H2 — PRICE BASIS → **CONFIRMED (it flattens and misleads).**
`price_unit` carries genuinely different bases across catalogs (verified distinct values):
- `each` (Hope Valley) — firm per-unit ✅ the only basis `unit_cost` could hold honestly
- `each (from)` (ATX Trees) — a **starting** price, not a firm one ("From" — per-size price lives on the product page)
- `$/ft` (Far South) — **per-foot**, scales with plant height. `Yucca Rostrata #15 → 175 $/ft`. A 4-ft specimen is ~$700, not $175.
- `USD` (Hill Country) — listing price for the priced minority

`business_inventory.unit_cost` is a single bare `numeric(10,2)` with **no basis/UOM column**. Dropping `175` from a `$/ft` row into `unit_cost` records "$175" for a plant that costs $700+ — a silent, material lie. A "from" price recorded as firm is the same failure, softer. **There is no home for per-ft / "from" / per-container basis → it flattens, and the flattening misleads.** H2 confirms.

---

## 4. Worst-fit vs best-fit (of the 8 real catalogs)

**Best fit — Hope Valley Tree Farm (71 items).** The only grower in the entire run exposing **name + size + price + live qty together**. `common_name→name` ✅, `price→unit_cost` (as *price*, with the §3 caveat), `qty` parseable from `stock_status` ✅, `price_unit='each'` (the one honest basis). Even the best case needs: a size column (or it loses the ladder, H1), a price-vs-cost rename (or it lies, §3), and a qty-extraction parser. It's the *cleanest* and it still can't land losslessly today.

**Worst fit (that still has data) — Far South Wholesale (647 items)** and **Vivero (129)**.
- Far South: richest row count, but **price almost entirely blank** + the priced rows are `$/ft` (the H2 trap) + size is container-grade prose (`#1`…`#30`). Maximum rows, maximum NO-HOME/FORCE pressure.
- Vivero / Hill Country / 93 / Native Texas / Calloway's: **price/size/stock are blank at catalog grain** (gallery, login-wall, or product-page-only). These import as **name + maybe botanical + category** and nothing else — i.e. straight into the **UNKNOWN-cost** path (`unit_cost` null, `cost_confidence='UNKNOWN'`). Honest, but nearly empty: a name list, not an inventory.

**The spread itself is the finding:** real grower catalogs range from "name only" (most) to "name+size+price+qty" (exactly one). The schema handles the empty end honestly (UNKNOWN) and the rich end badly (no size, price-as-cost).

---

## 5. Minimal delta — smallest additions to import without lying

Distinguishing **"needs a column"** from **"needs a parser/mapping layer"**:

**Needs a COLUMN (schema) — the irreducible set to stop lying:**
1. **`size_or_container text`** — without it, H1's ladder collapses into indistinguishable rows. The single most important add.
2. **A SELL-price home distinct from `unit_cost`** — e.g. `list_price numeric(10,2)` + `price_basis text` (each / from / $/ft / $/container). This is what keeps `price` out of the cost column. `price_basis` also absorbs H2. (Schema-truth: the table is cost-first by design — see the cost_confidence migration comment. Sell price is a genuinely new concept here, not a relabel.)

**Strongly wanted columns (cheap, prevent FORCE-into-notes):**
3. `botanical_name text` (or write to `cultivar_plants.species` via the existing `inventory_id` link).
4. `category text`.
5. `source_url text` (provenance for catalog-sourced rows).

**Does NOT need a column — already present:** `name` (✓), `qty` (✓ int), `cost_confidence` (✓ — reuse: catalog price = `UNKNOWN`/`ESTIMATED` cost, never CONFIRMED), `status`/`notes` (✓).

> I am **naming, not building** these. Note alignment with tech-debt #42's residual ("nullable price + price_confidence needs an ALTER") and the existing D-9 honesty pattern (flag, don't coerce) — a catalog import should land sell-price rows as `cost_confidence='UNKNOWN'`, never fabricate a cost.

---

## 6. Parser verdict

**A dropped grower CSV needs BOTH a field-mapping layer AND a small schema delta — not one or the other, and not "drop-in to existing tables."** Three of the eleven fields map cleanly-ish (`common_name→name`, `qty` after a regex pull from `stock_status`, `category`/`botanical` if columns 3-4 are added). But the two fields growers actually publish to sell — **size and price** — have no honest home: size has no column at all (H1), and price would land in `unit_cost`, inverting cost↔sell (§3), with `price_unit` basis silently dropped (H2). A pure mapping layer over today's schema would therefore either discard the size ladder or write retail prices into the cost ledger — i.e. it would lie. So: the **CSV-import feature is a mapping/ingestion parser (per-grower header is already normalized, so the parser is light) sitting on top of ~2 required new columns (`size_or_container`, a sell-price + basis pair)**. The schema delta is small and additive; the parser is real but modest because the scout already canonicalized all 28 headers to one shape. Until those columns exist, the only *honest* import is the degenerate one — name + qty + `UNKNOWN` cost — which is exactly the "name list, not an inventory" worst case in §4.

---

*READ-ONLY recon. Nothing was altered. All claims trace to migration source (`supabase/migrations/`) or the raw CSVs (`data/grower-scan/`). Schema beat memory wherever they disagreed — flagged inline.*
