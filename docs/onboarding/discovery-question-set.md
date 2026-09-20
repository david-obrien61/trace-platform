# THE ONBOARDING DISCOVERY QUESTION SET — what a new business is ASKED, before anything is built

**Filed 2026-09-18 · David's instruction · PLATFORM, not LAWNS-specific · tech-debt #350**

> **WHY THIS EXISTS.** Every question below comes from something LAWNS surprised us with **this week** —
> after months of building. David, 2026-09-18: *"these must be asked during analysis, not discovered
> months in."* Each one cost a build, a correction, or a wrong number on a printed sheet. A new tenant
> is asked all of them before their catalogue is imported and before any BOM is configured.
>
> ⚠️ **AN ANSWER IS A CONFIGURATION, NOT A NOTE.** Every question names where its answer lands. A
> question whose answer has nowhere to go is listed here as **NO HOME YET**, deliberately, rather than
> collected into a document nothing reads (that is [[R-26]]'s shape).

---

## HOW IT IS RUN, TODAY AND LATER

**Today (manual, and that is honest):** the analysis David and Lightning do with a new business, before
`QboCatalogueImport` runs. This document is the script for that conversation. Its answers are written
into the tenant's `business_operations_config`, its `container_ladder`, and its service rows.

**Where it belongs as the platform grows, in order:**
1. **`docs/customer-onboarding-capability_v1.md` → LAYER 1** — the onboarding arc's deep spec. §1.4 there
   is *"AI-assisted questions — the onboarding IS the demo"*; **this set is the content §1.4 has never
   had.** A pointer sits there now.
2. **`DISCOVERY_MODULE_BRIEF.md` / `api/discovery/ingest.ts`** — the discovery module already reads a
   business's website and proposes what it sells. These questions are what it must ASK once it has
   guessed: the guess is the draft, the answer is the fact.
3. **`OnboardingWizard.tsx`** — the fourth path (a business setting itself up) ends where these begin.
   🔴 **NO STORY EXISTS FOR THIS YET** (`user_stories.md` has no onboarding-questions story). One is
   written before any screen is built — §9's story-reconciliation gate.

---

## THE QUESTIONS

### 1 · Is there a delivery fee, and how is it worked out?
- **Ask:** is delivery charged? **Mileage-based, a radius, or zones?** If rings — **how far is each ring
  from the yard, and what does each cost?**
- **Ask:** **calculated from WHICH address** — and **if a customer has more than one address, which one?**
- **Why:** LAWNS charges a Trip Charge whose ring nobody had written down; the customer's billing address
  and their ship-to are different rows, and the delivery is to the ship-to.
- **Where the answer lands:** the transport service row + its ring/zone table. 🔴 **NO HOME YET for the
  rings** — there is no ring table and no stored coordinates (tech-debt #323, the address check).
- **Sharp edge:** a business with one address per customer will not think of this. Ask it anyway.

### 2 · Do the things you sell come in more than one size or variant?
- **Ask:** does one product exist in several sizes? Is the size in the item's NAME, its description, a
  SKU suffix, or a field?
- **Why:** LAWNS's sizes are in the item description, spelled **56 different ways** across 631 items, and
  the size is what every material figure multiplies.
- **Where the answer lands:** `container_ladder` (the size list) + the catalogue import's size parse.

### 3 · Are there SERVICES as well as products?
- **Ask:** what do you sell that is work rather than a thing? Is it charged per job, per hour, per tree,
  or per visit?
- **Why:** LAWNS sells install, planting, removal, trimming and tailgate delivery; all four arrived as
  `category='addon'` because nothing else fitted.
- **Where the answer lands:** the service rows (`service_offerings` in design; `addons` today).

### 4 · Does anything you sell DEPEND on something else?
- **Ask:** does choosing one thing require another? Does a service imply a fee?
- **Why:** 🔴 **at LAWNS, an install requires a Trip Charge** — and nothing in the platform knew, so the
  TC line is what tells us an order is an install at all (ledger #353, [[R-164]]).
- **Where the answer lands:** 🔴 **NO HOME YET.** There is no "requires" edge between two sellable rows.
  This is the single largest gap this question set exposes.

### 5 · Are there install or placement fees, and how are they priced?
- **Ask:** is fitting or placing charged separately? Per item, per size, or flat?
- **Why:** LAWNS's install price was hardcoded at $225 per plant in seed data, and the real figure is
  per size.
- **Where the answer lands:** the install price setting (per business, per size).

### 6 · Is anything you sell a KIT made of parts — and is there more than one kind?
- **Ask:** which sold items are assembled from parts? Are the parts stocked? Who assembles them, and when?
- **Why:** LAWNS's **water monitor kit** (24" of 1" PVC, drilled, plus a 3 ft bamboo stick) and its
  **bubbler** are both manufactured on site and sold as one line. The load list must print the KIT, never
  the parts (David, 2026-09-18).
- **Where the answer lands:** 🔴 **NO HOME YET** — the recipe builder is parked; the one kit spec we have
  lives in `docs/recipes/water-monitor-kit.md` and nothing reads it.

### 7 · Can a kit's parts be bought separately — at a different price?
- **Ask:** can a customer buy the part on its own? Does it cost the same as inside the kit?
- **Why:** the same question decides whether stock moves once or twice, and whether a price is one number
  or two.
- **Where the answer lands:** 🔴 **NO HOME YET** (same gap as 6).

### 8 · ✏️ ADDED FROM THE SAME WEEK — is an item BOTH fitted on a job and sold over the counter?
- **Ask:** of everything in 5–7: is it ever sold on its own, with no service attached?
- **Why:** measured 2026-09-18 across LAWNS's orders in TRACE — **trunk protection appears on an order with
  NO trip charge** (invoice 3648.606: one 30 gal tree and one Trunk Protection at $13). David: *"if an item
  is both fitted on installs AND sold over the counter, it is a product and a service, and the checkout
  and the load list must both know that."*
- **Where the answer lands:** 🔴 **NO HOME YET** — an item is a product or a service row, not both.

---

## WHAT THIS SET WOULD HAVE CAUGHT AT LAWNS, HAD IT BEEN ASKED

| Question | What it would have caught | What it cost instead |
|---|---|---|
| 1 | the trip charge's rings, and which address they measure from | rings still unknown; no coordinates stored |
| 2 | 56 spellings of 7 sizes | the size list, the resolver, and a display formatter still owed |
| 4 | install requires TC | 16 QuickBooks installs typed as delivery; 6 water monitor kits missing from Saturday's sheet |
| 6 | two kits, assembled on site | the bubbler counted per tree for a week; the kit missing from the sheet entirely |
| 8 | trunk protection sold both ways | one sleeve type on the sheet, three in the yard (tech-debt #349) |
