# Domain Knowledge Base — the MAP

**Type:** The index + foundation for domain-correctness. Keeps builds from solving into a corner, and keeps the product **credible** by letting it speak the owner's language.
**Created:** 2026-06-29 (THUNDER master bank of the 27–29 June session).
**Status:** Active · living. The MAP is the index; [`ontology.md`](ontology.md) is its first deep reference; [`field-notes-barryhill-2026-06.md`](field-notes-barryhill-2026-06.md) is the first primary-source grower field-research entry.

> **Why this exists.** The [NORTH STAR](../../NORTH-STAR.md) §4 job is to **reason in the gap** — the owner half-says a thing, the system completes it from domain knowledge. That completion is only possible if the domain knowledge is real and correct. A scraper that drops size variants, a resolver that can't tell a Redbud cultivar from its parent, a Tier-0 suggestion that names a plant out of its zone — all are domain-knowledge failures, not code failures. This base is where that knowledge lives so builds conform to the trade instead of rediscovering it.

> **THE RULE (binding):** **before any domain-touching build, check the relevant section's depth tag below.** Building on a 🔴 stub means you are guessing at the trade; flag it and deepen the section first, or build narrowly and record the gap.

**Depth legend:** 🟢 researched (load-bearing facts grounded) · 🟡 scaffold (framework clear, data to fill) · 🔴 stub (named, not yet researched).

---

## THE 9 SECTIONS

| § | Section | Depth | What it grounds (the build it keeps correct) |
|---|---|---|---|
| 1 | **Size & measurement** | 🟢 | The `business_inventory.size` column ([[D-24]] spine) + voice/scan size normalization (ledger #62 `normalizeSize`). ANSI Z60.1 container/caliper systems. → [ontology §1](ontology.md#1-size) |
| 2 | **Naming & nomenclature** | 🟢 | The token-set name resolver (ledger #61 `canonicalName.ts`) — botanical / common / cultivar layers, the 7× Redbud collision, trademark-noise stripping. → [ontology §2](ontology.md#2-naming) |
| 3 | **Category taxonomy** | 🟢 | Category-driven reconciliation rhythm (seasonal vs specimen) — **field-CONFIRMED per-category** ([Barryhill notes §5](field-notes-barryhill-2026-06.md)); the catalog category field. → [ontology §3](ontology.md#3-category) |
| 4 | **Supply chain** | 🟡 | Tier-0 sourcing suggestions ("low on 15-gal Live Oak → these wholesalers"). Grower-tier is researched; **upstream stubbed** (liner propagators, genetics/patents, pot/media/tag/irrigation makers). → [ontology §4](ontology.md#4-sourcing) |
| 5 | **Growing calendar & climate** | 🟡 | The day-one **Tier-0 hook** ([[D-25]] — ZIP→zone→season→what's-seasonal-here). Framework clear; **per-zone planting-window data to fill.** |
| 6 | **Plant lifecycle & culture** | 🟡 | Pot-size lifecycle ladder (a liner becomes a #1 becomes a #5); culture notes the AI reads from the blob ([[D-24]] edge). |
| 7 | **Business mechanics** | 🟡 | Margin / markup / cash-flow advice (the anti-Nelson cost surfacing). **Suggest-LESS doctrine field-validated** — a savvy practitioner already runs lean + sees overextension as the industry's disease ([Barryhill notes §7](field-notes-barryhill-2026-06.md)); grocery-inventory crossover noted. Framework clear; **per-category markup + cash-flow norms still to fill.** |
| 8 | **Pests / disease / regulatory** | 🔴 | Quarantine (citrus/tropicals), spray records, regulatory holds. Not yet researched — flag before any build touches it. |
| 9 | **Trade institutions & standards** | 🟢 | The standards bodies the system speaks to: ANSI Z60.1 (AmericanHort), TNLA Green Buyer's Guide, TDA Floral Cert, Sales Tax Permit. → [ontology §1/§4](ontology.md) |

---

## First deepening candidates (highest build-leverage)

When time is spent enriching this base, do these first — they directly unlock near-term builds:

1. **§5 — per-zone planting windows.** The day-one Tier-0 hook ([[D-25]]). "Tomato window closes end of June, reorder 100 not 500" needs real per-zone calendar data.
2. **§7 — markup / cash-flow.** Margin advice (the cost-surfacing thesis pointed at the grower) needs per-category markup norms and the nursery cash-flow cycle (seasonal float, carry-over of appreciating tree stock).
3. **§4 — pot / tag suppliers.** The QR-printer thread (who supplies the tags/pots a grower reorders) needs the upstream supplier layer.

---

## How this base feeds the platform (the connection map)

- **[[OP-10]] Structure-Last** — the latent structure in a grower's "mess" is recoverable *because* the domain shape is known (a name-only catalog is resolvable because §2 tells us how names work).
- **[[D-24]] Rigid spine / flexible edge** — §1 size → spine column; §6 culture notes → blob. This base tells you which is which.
- **[[D-25]] Intelligence Tiers** — §5 climate + §4 sourcing ARE Tier 0 (world knowledge, day one, no owner input).
- **[[D-26]] Dual lexicon** — §1/§2/§9 are the **canonical** layer the owner's local lexicon ("Happy hose," "trade gallon") maps onto.
- **[[OP-9]] Regina Principle / suggestion engine** — every surfaced suggestion ("reorder", "seasonal markdown", "zone-appropriate") stands on a fact from this base, not a guess.

---

*Maintain like any reference: when a build needs a fact this base doesn't have, research it INTO the relevant section (raise its depth tag) rather than hard-coding the fact in app code. Domain truth lives here; code reads it.*

> **NO PII IN THE REPO (standing rule):** no phone numbers, personal emails, or home addresses in version control — git history is permanent (a number deleted from a file later still lives in the commit log forever). Contact details live outside version control. Field notes record the *fact* of a contact, never the details.
