# Spec — Acquisition Intelligence (the household BI layer)

> We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

**For:** Thunder + Andrew. **Status:** Working demo (`DeliveryVsDrive.jsx`) — the flagship
calculation. Sits on the same `business_` spine as Ignition/Cultivar.
**Origin:** David — "the household is a small business; capture receipts chick-chick-chick
and you're done, then the BI behind the scenes says you've been buying from location A but
B is smarter, or delivery actually beats driving once you count mileage and your time."

---

## 1. The thesis (why the spine fits)
A household is the smallest business, rooted at the primary residence (matches our
residence-rooted node model). It has:
- **cost of goods** → groceries/supplies (receipts = accounts payable)
- **inventory** → pantry / freezers
- **suppliers** → HEB, Costco, ranch, Amazon
- **make-vs-buy** → already built
- **a labor cost** → the owner's time

So the same spine that runs Ignition/Cultivar runs the house. We're not bolting a kitchen
feature onto a business platform — we're recognizing the house *is* a business.

## 2. The shape: dumb capture, smart BI
- **Capture is effortless** — snap receipts, chick-chick-chick, done. No forms, no "enter
  reorder level." The human does only the unavoidable thing (they already have the receipt).
- **The BI runs behind the scenes** — across all captured receipts, it surfaces what the
  owner can't compute by hand. This is the value; capture is just the toll to get there.

This is the anti-Nelson move: flip the labor from owner to tool (the accountant who pushed
work back onto David is the cautionary tale).

## 3. What the BI surfaces (from receipts alone)
- **Store-of-record cost comparison** — "you buy X at A; B is cheaper for your basket."
  Per-unit, per-store, cheapest flagged. (Cost engine, already built, pointed house-wide.)
- **Consumption rate** — "you go through a bag of ground beef a week" (repeat purchases
  across receipts → cadence → proactive low alerts before you ask).
- **Variant/size memory** — honey wildflower vs. Texas raw; ketchup 44oz vs 24oz per-oz.
  (See REPURCHASE-CHOICE-SPEC.md.)
- **Acquisition decision** — the flagship below.

## 4. FLAGSHIP — Delivery vs. Drive (total cost of acquisition)
No grocery app makes this call honestly; Instacart wants delivery, the store wants you
in-store. We compute *which is actually cheaper for you, this trip*. Inputs:

| Input | Source | Confidence |
|-------|--------|------------|
| Basket price | receipt | CONFIRMED |
| In-store discount (e.g. −10%) | observed across receipts | CONFIRMED/DERIVED |
| Delivery fee + markup | the service screen | CONFIRMED |
| Mileage cost | distance(ZIP→store) × per-mile | DERIVED |
| Your time | household sets $/hr × minutes | **ASSUMPTION (set by user)** |
| "Already at the store" | context toggle → drive cost = 0 | user |

### The honesty rule (this is what makes it trustworthy, not manipulative)
Show TWO verdicts side by side: **money-only** (CONFIRMED hard numbers) and
**money + time** (adds the one labeled assumption). The verdict can **flip** between them —
that flip is the teaching moment, and showing both is what stops the app from silently
assigning a value to someone's time and pushing a recommendation they don't trust.
- Time value is never baked into a single number — it lives in its own column, labeled.
- Show the work: "Delivery wins by $6 — assuming $20/hr and 24 mi. Change either."
- Context override: if you're already near the store, drive cost = 0 and the math flips
  back. The recommendation respects where you actually are.

This is the household twin of Ignition's "$3,115 revenue leak" — a number the owner
couldn't see, surfaced by the BI, that changes a real decision.

## 5. Data model (sketch — ⚠️ RECONCILED to live schema 2026-07-03; NO `business_` prefix on receipts)
```
receipts          { id, business_id, vendor, date, amount, image_url, line_items(JSON) }  // EXISTS — Receipt Keeper writes it
receipt_lines     { receipt_id, sku, name, qty, size, unit, price }  // shared-core (no vertical noun); TODAY these live as receipts.line_items JSON. count-once via receipt_id
suppliers         { id, business_id, name, channel, zip|address }    // shared-core (no vertical noun); PROPOSED, not built
household_settings{ business_id, time_value_per_hr, per_mile_cost, home_zip }  // residence-layer; ⚠️ residence prefix NOT yet locked
```
> The `business_receipt` / `business_receipt_line` / `business_supplier` names in the original
> draft used a `business_` prefix the schema convention forbids. Corrected above: the receipt
> spine is the existing `receipts` table (line items = `line_items` JSON today); a normalized
> `receipt_lines` / `suppliers` table, if built, is shared-core with no vertical noun.
- Consumption rate = derived from repeat receipt_lines over time (not stored, computed).
- Distance = home_zip → supplier (a maps/geocode connector — metered, swappable, D-009).

## 6. Connectors (hold the coupling discipline)
- **Maps/distance** (ZIP→store mileage, "find sources near me") — a connector with a key
  and limits, same as Spoonacular. Swappable via platform_config; never welded in.
- **Delivery fees** — likely entered/observed, not API'd (Instacart has no open price API);
  treat as user-confirmed input, not a live feed, until proven otherwise.

## 7. Confidence & honesty (unchanged)
- Receipt money → CONFIRMED. Mileage → DERIVED. Time → ASSUMPTION, labeled, user-set.
- A recommendation is only as honest as its weakest input; surface the inputs, don't hide
  them. Surface Honesty applies to *claims*, not just UI.

## 8. Not now
- Don't auto-pick delivery or drive — present both verdicts, let the human decide.
- Don't model traffic/time-of-day yet (minutes is user-set, not predicted).
- Don't infer the time-value silently from income or anything else — too presumptuous,
  breaks trust. Ask, default sensibly, label always.

## 9. Open questions for Andrew
- Receipt payload: does it expose SKU + size reliably (the join key for everything above)?
- Maps/distance connector preference + whether a key is already on hand.
