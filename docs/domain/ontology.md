# Nursery Domain Ontology — the canonical reference

**Type:** The first deep reference under the [domain knowledge base MAP](README.md). The canonical trade vocabulary + structures the platform reasons against and the local lexicon ([[D-26]]) maps onto.
**Created:** 2026-06-29 (THUNDER master bank, 27–29 June session).
**Scope:** Nursery / green-goods trade (Cultivar's domain). Texas-anchored where sourcing is concrete.
**Depth of each section is tracked in the [MAP](README.md).**

> This is the canonical layer. A grower's local words ([[D-26]] dual lexicon) and idiosyncratic descriptions ([[D-24]] blob) sit on top of this; this is what the system **joins on** to talk to suppliers and to reason across growers.

---

## §1 SIZE 🟢 {#1-size}

There are **three size systems**, chosen by **how the plant was grown**, all governed by **ANSI Z60.1** (the American Standard for Nursery Stock, maintained by AmericanHort — §9).

### Container ("gallon") — the trade-label trap
**"Gallon" is a TRADE LABEL, not a real volume.** A "#1" / "1-gallon" container actually holds **≈ 0.7 real gallons** — a post-WWII legacy of surplus food cans repurposed as pots. The number is a **size CLASS**, not a measurement. The container ladder (small → large):

> plug / liner → quart → **#1** → **#2** → **#3** → **#5** → **#7** → **#10** → **#15** → **#25** → **#30** → **#45** → **#65** → **#95** → **#300+**

- **Liner / plug** stock is sized by **tray cell-count** instead: 18s / 32s / 72s / 128s (cells per tray; higher number = smaller plug).

### Field-grown — caliper + height
Trees grown in the ground are sized by:
- **CALIPER** — trunk diameter in inches, measured **6" up** the trunk for trees **≤ 4" caliper**, and **12" up** for trees **> 4"**.
- **HEIGHT** — in feet (for plants where height is the salient dimension).
Field stock is delivered **B&B** (balled-and-burlapped) or in a **fabric grow-bag**.

### Platform implication (the build rule)
- `business_inventory.size` is **TEXT** ([[D-24]] spine column), because one column must span container-class, caliper, and height vocabularies.
- **Normalization** collapses the gallon family: `#1` = `1 gal` = `1G` = `1-gallon` = "trade gallon" → one canonical form (ledger #62 `normalizeSize`: gallon family → "N Gallon"; **non-gallon caliper/height passes through as TEXT** — never force a caliper into the gallon canon).
- **A grower's size list is a SUBSET** of this universe — derive it per-grower (`SELECT DISTINCT size`), never impose a global enum ([[OP-10]]/[[AC-1]] — variation in data, not schema).

---

## §2 NAMING & NOMENCLATURE 🟢 {#2-naming}

Three naming layers coexist for one plant:

1. **Botanical** — `Genus species 'Cultivar'` (the precise trade form), optionally trailing **®/™/PP#** (trademark / plant-patent marks). Precise, supplier-facing, the future canonical key.
2. **Common** — retail speech ("Shoal Creek Vitex", "Live Oak"). **Word order drifts** ("Shoal Creek Vitex" ↔ "Vitex, Shoal Creek").
3. **Cultivar / trade name** — the marketed name, sometimes distinct from the botanical cultivar.

### The resolver (what this grounds — ledger #61 `canonicalName.ts`)
- **Token-set key:** treat a name as the **SET of its tokens** (common ∪ botanical), **order-insensitive**, **keep ALL tokens.**
- **Keep all tokens** because dropping any creates the **7× Redbud collision** — multiple distinct Redbud cultivars share the word "Redbud"; only the full token set distinguishes them (`Cercis canadensis 'Forest Pansy'` vs `'Oklahoma'` vs …). A name-EXACT or stemmed-fuzzy key over-merges them.
- **Strip trademark noise** (®/™/PP#, stray `&amp;`/`amp` entities, punctuation) before comparing.
- **EQUALITY first, guarded-subset second** ([[D-9]] honesty seam): exact token-set equality resolves cleanly; >1 candidate → **NEED-CLARIFICATION**, never auto-pick. (L4 equality is built and owner-proven; guarded-fuzzy L5/L6 is the fast-follow.)
- **Botanical name = the future canonical join key** (also the [[D-26]] dual-lexicon join key and the sourcing key, §4).

---

## §3 CATEGORY 🟢 {#3-category}

The working category set (drives reconciliation rhythm — §below):

- **Shrubs** — the backbone volume of most yards.
- **Trees** — shade / ornamental / fruit; container OR B&B.
- **Perennials** (incl. grasses) · **Ornamental grasses** (sometimes split out).
- **Roses** — bare-root + container.
- **Annuals / bedding / "color"** — seasonal, fast-turn.
- **Tropicals / palms / citrus** — climate-bound, quarantine-bound.
- **Conifers / evergreens** · **Natives / adapted.**
- **Vegetables / herbs / edibles** — seasonal.
- **Groundcovers / vines** · **Succulents / cactus.**

### The split that matters: SEASONAL vs SPECIMEN
This is the axis that drives **reconciliation rhythm** (the open research item, §5 / business-mechanics):
- **Seasonal / fast-turn** (annuals, color, veg) — **fast clock, markdown-or-lose** ("in the ground by end of June").
- **Specimen / slow-turn** (trees, specimen shrubs) — **slow clock, carries over, the stock APPRECIATES in value while held.**
- **Tropicals** — **inverse seasonal**: must be moved OUT before winter (cold kills the held stock).

---

## §4 SOURCING MAP 🟡 {#4-sourcing}

The "who stocks it" layer (Texas wholesale — grounds Tier-0 sourcing suggestions, [[D-25]]). **All trade-only** — buying requires a **Sales Tax Permit + TDA Floral Certificate** (§9).

**General / natives:**
- Mortellaro's (San Antonio) · Greenleaf (El Campo) · Texas Wholesale (East TX) · Native Texas (Austin).

**Tree farms:**
- Texas Grown (Mexia — B&B, 1–10" caliper) · PermaVista (Brenham — 30–500 gal) · Cedar Creek.

**Seasonal:**
- Spring Creek (Waller) · ColorSpot / Altman.

**Roses:** Certified (Tyler). **RGV tropicals / citrus:** Rio Grande Valley growers.

**Master directory:** the **TNLA Green Buyer's Guide** (§9).

**Order grammar (the "cartons of" trade unit):** wholesalers set **minimums in multiples by container class** — e.g. Greenleaf: **×10 #1s, ×5 #2-and-up, ×12 qt/6", ×20 4".** This is the trade's multiple-by-class counting grammar (it shows up again in the spoken-count stories — "six cartons of six" = 36).

**Upstream (🔴 stubbed):** liner propagators, genetics/patent holders (the PP# on a tag), pot / media / tag / irrigation manufacturers. Needed for the QR-tag-printer thread and full cost-to-produce upstream attribution.

---

## §5–§9 — see the [MAP](README.md) for depth status

- **§5 Growing calendar & climate** 🟡 — framework: ZIP → USDA hardiness zone → local season → what's seasonal here. Per-zone planting-window data is the **first deepening candidate** (the Tier-0 day-one hook, [[D-25]]).
- **§6 Plant lifecycle & culture** 🟡 — the pot-size lifecycle ladder (a liner grows up the §1 container ladder); culture notes are blob-resident ([[D-24]] edge) for the AI to read.
- **§7 Business mechanics** 🟡 — markup / margin / cash-flow (seasonal float; appreciating carry-over stock). **Second deepening candidate.**
- **§8 Pests / disease / regulatory** 🔴 — quarantine, spray records, regulatory holds. Research before any build touches it.
- **§9 Trade institutions & standards** 🟢 — **ANSI Z60.1** (AmericanHort — the size standard, §1) · **TNLA Green Buyer's Guide** (the supplier directory, §4) · **TDA Floral Certificate + Sales Tax Permit** (the trade-buying credentials, §4).

---

## HOW THIS FEEDS THE BUILD (one-line each)

- **§1 size vocab** → the `size` column ([[D-24]]) + voice/scan size normalization (ledger #62).
- **§2 naming** → the resolver token-set design (ledger #61); botanical = the future canonical key.
- **§4 sourcing** → Tier-0 sourcing suggestions ("low on 15-gal Live Oak → PermaVista / Texas Grown"); order minimums = the "cartons of" count grammar.
- **§3 seasonal categories + §5 zone** → "tomato window closes end of June — reorder 100, not 500" ([[D-25]] suggest-buy-less).

---

*Canonical layer for [[D-26]] (the local lexicon maps onto this). Deepen sections INTO this doc as builds demand the facts; raise the depth tag in the [MAP](README.md) when you do.*
