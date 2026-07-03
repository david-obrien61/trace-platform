# Spec — Repurchase Choice (Variant & Size Memory)

> We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

**For:** Thunder + Andrew. **Status:** Working demo in the tile (Orders tab → "Low — pick
before you buy"); honey (variant) and ketchup (size) are the worked examples.
**Origin:** Two real Costco receipts (May 15 + Apr 6, 2026, Liberty Hill #1767) + David's
question: "when honey is low, surface that we have Kirkland Wildflower AND Texas Raw
Unfiltered and let us choose — and for ketchup, the 44oz vs the 24oz."

---

## 1. The problem
"Honey" is not one item. The household buys Kirkland Wildflower honey AND Kirkland Texas
Raw Unfiltered honey — both from Costco, both "honey." A naive reorder writes "honey" and
either makes you guess at the warehouse or silently picks wrong. That's the Regina
tree-netting failure: the system knew something useful and didn't surface it at the moment
of decision. The fix: **a reorder is a CHOICE among the variants you've actually bought,
shown with what you know about each.**

## 2. Two axes of "same item, different choice"
1. **VARIANT** — different products treated as one need (Wildflower vs. Texas Raw). Remember
   both; offer the choice. No "better," just *which this time*.
2. **SIZE** — same product, different pack (Ketchup 44oz vs 24oz). Here the honest
   comparison is **per-unit price** (the Cost-to-Produce engine, pointed at pack size):
   show $/oz, flag the cheaper, but caveat *only size up if you'll use it before it turns*.

## 3. Smart default: "same as last time"
The most-recently-bought option is pre-selected (driven by `lastBought` date). The user
changes it only if they want something different. Zero-friction for the common case,
full control when it matters.

## 4. Where the data comes from (this is the moat)
**Receipt history**, not manual entry. The two sample receipts already prove it:
- Repeat purchases: Doritos 3oz appears twice on one receipt; A2 milk twice; two pork loins.
- Price variation by trip: pork loin $18.13 vs $17.69 — the system learns the real range.
The Receipt Keeper does double duty: inventory + price + **variant memory**, all from one
scan. No competitor has this because no competitor reads your actual receipts.

### The SKU seam (honest about the hard part)
Costco lines carry a stable **item number** (e.g. `1462714 KS ORG A2 PR`). Two receipts with
the same number are provably the same product → variant matching is clean. BUT a free-text
whiteboard capture ("honey") has no number. So:
- Reorder tied back to a receipt SKU → variants resolve automatically.
- Free-text capture → gentle "which one did you mean?" disambiguation against known variants.
Design for both; don't pretend the free-text case is automatic.

## 5. Data model (sketch)
```
variant_group: { key, need_label, axis: "variant"|"size" }
variant_option: {
  sku,            // stable retailer item number (the join key)
  group_key,      // → variant_group
  name, store, size, unit, price, last_bought   // price/date refreshed from each receipt
}
```
- `last_bought` + `price` updated on every receipt reconcile (count-once via receipt_id).
- Per-unit = price / size, computed; cheapest flagged.
- Confidence: receipt-sourced price = CONFIRMED; typed = ESTIMATED (D-009 / cost_confidence).

## 6. Confidence & honesty (unchanged discipline)
- Prices/dates from receipts → **CONFIRMED**.
- A variant the user typed but we've never seen on a receipt → **ESTIMATED**, labeled.
- Never auto-pick silently; "same as last time" is a *default*, visibly changeable.
- Per-oz "best" is a fact; the use-it-before-it-turns caveat keeps it honest (bigger ≠
  always better).

## 7. Not now
- Don't infer variants the user never bought (no "you might like clover honey" — that's
  recommendation creep; this is *memory*, not suggestion).
- Don't merge variants into one SKU to "simplify" — the whole point is they stay distinct.
- Shelf-life / spoilage modeling for the size caveat is future; for now the caveat is a
  static nudge, not a computed expiry.

## 8. Open question for Andrew
Does the barcode scanner / receipt payload expose the retailer item number (SKU) reliably?
That number is the join key that makes variant memory automatic instead of fuzzy-matched.
