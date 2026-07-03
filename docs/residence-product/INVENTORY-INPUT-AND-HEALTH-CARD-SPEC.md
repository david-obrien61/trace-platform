# Spec — Inventory Input Doors + Health Card

> We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

**For:** Andrew (barcode scanner) + Thunder integration.
**Status:** Proposed. Prototype exists (mocked) in the Kitchen Loop tile.
**Decision context:** "Andrew's app vs. Receipt Keeper" is a false choice — they are
different doors into the same inventory. Keep both.

---

## 1. The three input doors (buy side)

An inventory item's quantity goes UP through one of three doors. None replaces another.

| Door | Best for | Mechanism | Confidence of identity |
|------|----------|-----------|------------------------|
| **Receipt** (Receipt Keeper) | Bulk hauls (Costco run, 40 items) | OCR receipt → many line items at once | from receipt |
| **Barcode** (Andrew's scanner) | A single packaged item | UPC → national product DB lookup | DERIVED (DB may be wrong) |
| **OCR fallback** | No-barcode items (ranch bird, produce) | photo → review → manual | manual |

Down side (consume) is unchanged: menu cook-to-deplete + fill-bar tap.

**Dedup seam:** all three resolve to the same item row. Reuse the `receipt_id` FK
count-once mechanic so a haul isn't double-counted across doors.

## 2. Andrew's barcode door — what it returns, and the honest caveat

Andrew's scanner fires a UPC at a national database and gets back: product name,
brand, size, and (where available) ingredients + nutrition/additive data.

Andrew's own words: "a database that may or may not be true." He's right, and that's
the design constraint, not a bug. Community/national product DBs (e.g. Open Food
Facts) have gaps and stale entries. A Yuka reviewer caught a product scored as clean
that listed six preservatives on the physical label.

**Therefore:** a barcode lookup is a *claim*, not a fact. Stamp everything it returns
**DERIVED**. This is the existing `cost_confidence` pattern (CONFIRMED / DERIVED /
ESTIMATED / UNKNOWN) applied to a second axis — product/health data.

**Conflict rule:** the physical label wins over the DB. Same posture as
"audit wins on conflicts" for the repo. If a user corrects a DERIVED field against the
jar in hand, that field promotes to CONFIRMED.

## 3. The Health Card

A pantry item can carry a health card: `{ score 0–100, grade A–D, ingredients[],
additives[{name,risk,why}], nutriFlags[], confidence, door }`.

Two doors fill it:

- **HOMEMADE** → from the item's make-recipe clean ingredient list → **CONFIRMED**
  (you know exactly what went in; there is no label to be wrong).
- **BARCODE** → from the national-DB payload → **DERIVED**.
- No data → **UNKNOWN**.

### Scoring — ours, not Yuka's

We compute our OWN score from open additive/nutrition data. We do **not** call Yuka:
- Yuka has **no public API**; its database is its core business and revenue (subs).
- So "fire it off to Yuka" is not buildable. Don't depend on a locked door.
- Yuka's *method* is public (≈60% nutrition / 30% additives / 10% organic). We use a
  simple, transparent, in-house variant and call it our own health card — never
  "the Yuka rating" (their trademark / black box).

Prototype scoring (transparent, tune later): start 100; subtract per additive by risk
(high −30 / moderate −12 / low −4) and per nutri flag (−8); clamp 0–100;
A≥75 B≥50 C≥25 else D.

### The structural edge (why this beats a scanner-only app)

Yuka and every barcode app are **blind to anything without a barcode** — the
ranch bird, garden produce, Regina's batch meals. Those are the *healthiest* items in
the house. Our tile sees them because the user made them, and their card is CONFIRMED.
The make-vs-buy view already shows this as a second axis: homemade is cheaper AND
cleaner, provable because the homemade side has no hidden label.

## 4. Data model deltas (Thunder)

- `health_card` fields on the inventory item (or a 1:1 side table): score, grade,
  ingredients (text[]), additives (jsonb), nutri_flags (text[]), confidence enum, door.
- `barcode_lookup` connector: UPC in → normalized payload out, all DERIVED.
  Source is swappable (Open Food Facts first; commercial DB later) via `platform_config`,
  same pattern as the OCR model-name externalization (D-009 lineage).
- Homemade card derives from the existing make-recipe `homeLabel`.

## 5. Explicitly NOT now

- No Yuka integration (no API; do not scrape).
- No live barcode DB in the prototype (mocked, stamped DERIVED).
- Scoring weights are placeholder; settle once and encode as a variable (AC-4).

## 6. Open question for Andrew

Which barcode DB does your scanner currently hit, and does its payload include
ingredient/additive data or only name+size? That determines whether the health card's
BARCODE door is real on day one or needs a second source (Open Food Facts) joined in.
