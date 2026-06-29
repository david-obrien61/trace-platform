# 📖 TRACE — Story Board (source of truth)

> **What this is.** The second lens beside the Status Board.
> The **Status Board** (`status.html` ← `TRACE-SESSION-BOOTSTRAP.md`) shows what is **BUILT** —
> capabilities, green/amber/red. **This file** shows what we are **BUILDING TOWARD** —
> the user's lived need, told as day-in-the-life narrative.
> They LINK by **capability id** (`MAPS-TO`) and **arc**, so at a glance we can see which
> capabilities have a story (and which don't = build-blind) and which stories have no built
> pieces yet (= gaps).
>
> **One-source discipline (same as the status board):** THIS markdown is the only source of
> truth. `stories.html` is a PURE RENDERER — it is never edited. Add stories HERE, then
> re-open `stories.html` (file-pick this file) to see them.
>
> ---
>
> **Format — each story uses these exact tags so the renderer can parse it:**
>
> ```
> ### <story title>
> STATUS: active | in-build | archived
> ARC: <one of the 8 arc ids below>
> MAPS-TO: <status-board capability id(s), e.g. 2.3, 5.1 — comma-separated — or — for none yet>
> PIECES: <comma-separated build-piece names, e.g. inventory_count, inventory_count_offline>
> <narrative + details in markdown prose / bullets, until the next ### or ##>
> ```
>
> - **STATUS** — `active` (a need we hold, not yet in build) · `in-build` (a build is advancing it now) ·
>   `archived` (delivered / retired; moves to `## ARCHIVED`, drops from the Active view).
> - **ARC** — one of the 8 canonical arc ids: `front-door` · `ocr-doc-routing` · `cost-to-produce` ·
>   `suggestion` · `delivery` · `discovery` · `identity-roles-sec` · `asset-inventory-pmi`.
> - **MAPS-TO** — the KEY LINK. Names the Status-Board capability id(s) this story maps to
>   (e.g. `2.3` walk-and-count, `5.1` inventory, `3.5` delivery). Multiple allowed, comma-separated.
>   `—` means **no capability exists yet** — a visible gap.
> - **PIECES** — the named build-pieces that make the story real (chips on the card).
>
> The `## ARC:` headings below carry the stories. A story's own `ARC:` tag wins if present;
> otherwise it inherits the section it sits under. Completed stories move to `## ARCHIVED`.

---

## ARC: front-door

_Register → invite → scrape-while-away → return → reveal → validate/conflict → seed → vertical → alive dashboard._

<!-- Add front-door stories here. -->

---

## ARC: ocr-doc-routing

_Capture → extract (one engine) → infer type → confirm → fan-out to many destinations._

### Snap a document, let TRACE route it
STATUS: active
ARC: ocr-doc-routing
MAPS-TO: —
PIECES: ocr_capture, ocr_infer_type, ocr_fanout
_Placeholder (David to expand into full day-in-the-life prose)._ The owner photographs whatever paper lands in their hands — a vendor invoice, a receipt, a delivery slip — and TRACE reads it once, infers what kind of document it is, asks for a one-tap confirm, and routes it onward to the right destination (a cost, an inventory intake, a scheduled delivery) instead of dead-ending in a pile. Today capture + OCR exist (receipt-shaped); type-inference and fan-out routing are the gap.

---

## ARC: cost-to-produce

_Recurring/operating costs → labor → margin → compute → (forward-run) suggestion engine._

<!-- Add cost-to-produce stories here. -->

---

## ARC: suggestion

_Pattern-surfacing from owned data (the Regina Principle — the product north star)._

<!-- Add suggestion / surfacing stories here. -->

---

## ARC: delivery

_Schedule → day-group → select stops → bookend (business→stops→business) → Google Maps handoff._

<!-- Add delivery stories here. -->

---

## ARC: discovery

_Website read → two-pass (Haiku identity / Sonnet analysis) → synthesis email → seed.ts → catalog-populate._

<!-- Add discovery stories here. -->

---

## ARC: identity-roles-sec

_Auth principal → membership resolution → role/permission chokepoint → RLS wall → audit._

<!-- Add identity / roles / security stories here. -->

---

## ARC: asset-inventory-pmi

_Assets → inventory → walk-and-count → preventive-maintenance schedule → service log._

### Count the lot without paper
STATUS: in-build
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: inventory_count, inventory_count_offline
_Placeholder (David to expand into full day-in-the-life prose)._ The manager walks the lot with a phone, scanning each plant's QR tag, entering the on-hand count, saving, and moving straight to the next — until the lot is counted and a session summary closes it out. The loop must never dead-end: an unreadable tag falls back to manual entry, an unrecognized scan is handled gracefully (quick entry or skip-and-flag) rather than stalling. Counting in a field with no signal must still work (offline). _Grounded in ledger #54 — the scan→resolve→qty→save→next→complete loop is BUILDER-COMPLETE; the offline piece is still ahead._

### Receive the truck
STATUS: active
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: inventory_truck, inventory_invoice, inventory_receipt
_Placeholder (David to expand into full day-in-the-life prose)._ A delivery truck arrives; the owner checks what physically came off it against the vendor's invoice, captures the invoice/receipt image, and lands the received stock into inventory — so what's on the shelf and what was billed line up from the moment the truck pulls away. This is the OCR-intake sibling the count loop's ledger note (#54) flags as NEXT.

### Reconcile counted vs expected
STATUS: active
ARC: asset-inventory-pmi
MAPS-TO: 4.2
PIECES: inventory_reconcile
_Placeholder (David to expand into full day-in-the-life prose)._ After a count, TRACE compares counted-on-hand against what the books expected and surfaces the difference — sold, dead, or missing — so shrinkage and miscounts become visible instead of silently eroding margin. The count loop (#54) deliberately shaped its record model so reconciliation can read it later; reconciliation itself (the 4.2 double-whammy) is deferred and not yet built.

### Inventory — the grower with no system (the count builds the catalog)
STATUS: active
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: inventory_count, catalog_accrete, name_pick_fast, voice_capture
The grower who has **no system at all** — name-only stock, no SKU, no QR, stock "tracked in their heads" — is the **~88% case, confirmed in the field at Barryhill** (a 4.5★ full-service garden center: "no official inventory system," the POS is sales-only and never decrements, "QR is not even set up"). For them we do **not resolve** an existing structure — we **CREATE** it, one scan at a time: **the walk IS the structuring** ([[OP-10]] structure-last). There's no QR to scan, so the loop asks **"what is this?"** → the grower **types or says the name** → the first time, that **creates the catalog entry** (`catalog_accrete`); the next time, it's a one-tap recently-used button. **QR comes AFTER, not before.** This runs on the **same screen** as the structured grower — the unknown/name branch is the *exception* for LAWNS but the **normal path here**. Make-or-break: nobody thumb-types 400 names in the sun, so the **name path (autocomplete / recently-used / voice) must be fast enough to BE primary**, not a fallback. _Grounds: ledger #61 (L4 token-set resolve) is the structured-grower path; this is its no-structure sibling — the catalog-accrete + fast-name-pick pieces are the build-out._

### Inventory — the real spoken-count spec (Billy Bob + the messy walk)
STATUS: active
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: voice_capture, catalog_accrete, name_pick_fast, inventory_count
Built from **two real spoken walks**, this is the spec for counting a lot **by talking**. The clean walk — **Billy Bob at Lucy's Nursery, tidy rows** — gives the arithmetic grammar: **carton/multiplier math** ("six cartons of six" = 36, the trade's multiple-by-class unit from [ontology §4](../docs/domain/ontology.md#4-sourcing)); **running tallies** ("4, 6, 8, 12, 16" → 16); **self-correction** (last value wins); **uncertainty markers → confidence** ("should be" / "look like" → ESTIMATED on the [[D-9]] ladder); **out-of-order, keyword-anchored** parse; the **pot-size lifecycle ladder**; **resolve-by-sight**; and **counting = truth, pricing = later**. The **second walk — tomato/citrus, messy-real** — adds the hard parts: an **unidentified-pending state** ("four I don't know yet"); **location-spanning tallies** (same variety here + in the greenhouse, summed); a **lost-tag-with-reasoning** recovery ("tag's gone but it had to be a pollinator pair" → domain knowledge recovers identity — the [NORTH STAR §4](../NORTH-STAR.md) reason-in-the-gap move); a **4-level IDENTITY-confidence ladder** (CONFIRMED → DESCRIBED-by-fruit → TAG-READ-brand → UNKNOWN); an **estimated-size flag** ("looks like a gallon or so"); **task-capture mid-count** ("need to buy water today" — a stray thread caught, [NORTH STAR §2](../NORTH-STAR.md)); and **ambiguous terms** ("Oliveira plants" — captured as spoken, **flagged, not assumed**). **Design calls:** preserve the **arithmetic** ("6×6=36", not just 36); `voice_capture` is a **PROMOTE** from the Ignition tech-notes voice path, routing the name through the §2 token-set resolver and the size through the grower's own size list into `catalog_accrete`. **CARDINAL REQUIREMENT (field lesson):** a real two-speaker capture (the Barryhill conversation) had **NO speaker separation**, so turns were unrecoverable — `voice_capture` **must handle speaker/turn**; capture must **never silently drop or mis-attribute** what was said.

---

## ARCHIVED

_Delivered or retired stories move here for history. They render muted and only appear in the All / Archived views._

<!-- No archived stories yet. -->
