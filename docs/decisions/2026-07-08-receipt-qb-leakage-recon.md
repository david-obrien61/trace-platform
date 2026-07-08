# RECON — receipt / QB-on-the-fly / attributed price-override leakage (2026-07-08)

**Type:** read-only recon. NO code, NO migration, NO schema. Feeds three DECIDED builds (David):
(a) QB invoice PREVIEW must generate from the REAL order, not a hardcoded stub; (b) price-override
leakage must MIRROR Ignition's existing attributed pattern (extract, don't invent); (c) the receipt
must show the service row's REAL name, not a hardcoded branch label.

**Story:** purchase-workflow #231 (MAPS-TO 2.1), §6 receipt/QB + a NEW leakage-on-override sub-story.
**Scope note:** the recon confirms the pattern + the two cultivar display sources + the exact fix
paths. It does NOT write them. One cross-cutting finding surfaced (the real QB push shares the
D-34 anchor-naming bug — §R3.4).

---

## R1 — IGNITION'S ATTRIBUTED-LEAKAGE PATTERN (the model to mirror)

Ignition captures a price give-away as **per-line override columns on the line-item table, linked
to a job + an actor-bearing parent**. It is a real, shipped pattern — extract it, don't reinvent.

**The columns** — [`supabase/migrations/supabase_price_override_migration.sql:5-8`](../../packages/ignition-os/supabase/migrations/supabase_price_override_migration.sql#L5-L8), on `estimate_line_items`:
| column | type | meaning |
|---|---|---|
| `is_manual_override` | `boolean NOT NULL DEFAULT false` | this line's price was hand-changed |
| `original_calculated_price` | `numeric(10,2)` | the margin-engine baseline BEFORE the override |
| `price_leakage` | `numeric(10,2)` | the amount given away (baseline − final) |

**The AMOUNT** = `price_leakage`. Computed in the UI, not the DB:
[`PriceField.jsx:44-51`](../../packages/ignition-os/PriceField.jsx#L44-L51) — `isOverride = newPrice < suggestedPrice; leakage = isOverride ? (suggestedPrice - newPrice) : 0`, handed up via `onUpdate({ finalPrice, isOverride, suggestedPrice, leakage })`.

**The WRITE** — [`IgnitionEstimate.jsx:228-238`](../../packages/ignition-os/modules/IgnitionEstimate.jsx#L228-L238) `handlePriceOverride` persists `{ unit_price, line_total, is_manual_override, original_calculated_price, price_leakage }` to `estimate_line_items`.

**The ACTOR (who) — attributed at the PARENT, not the line.** The line item carries `estimate_id`
+ `job_id` + `shop_id` ([`IgnitionEstimate.jsx:266`](../../packages/ignition-os/modules/IgnitionEstimate.jsx#L266)); the estimate carries **`tech_id uuid references users(id)`** ([`supabase_schema.sql:41`](../../packages/ignition-os/supabase/migrations/supabase_schema.sql#L41)) — that is the actor link. WHO-may-override is enforced in the UI: the override field only unlocks for an ADMIN — [`PriceField.jsx:32-33`](../../packages/ignition-os/PriceField.jsx#L32-L33) (`currentUser = DataBridge.load('current_user'); isAdmin = currentUser.permissions.includes('ADMIN')`) and `readOnly={isLocked}` on the input ([`PriceField.jsx:127`](../../packages/ignition-os/PriceField.jsx#L127)).

**The AGGREGATION** — [`IgnitionOmniDashboard.jsx:63-72`](../../packages/ignition-os/modules/IgnitionOmniDashboard.jsx#L63-L72) sums `standardPrice − actualPrice` across transactions into a headline "leakage" metric.

**HONEST LIMITS of the Ignition pattern (so we mirror knowingly, don't over-claim):**
- **No `reason` column.** The give is captured (amount + baseline + flag), the WHY is not.
- **Actor is estimate-grain (`tech_id`), not per-line.** Fine when one advisor owns the estimate.
- **`price_leakage` lives on the LINE ITEM**, not a separate leakage-event table — so it rides the
  line's lifecycle (edited/deleted with it). Good enough for Ignition; a design choice to make
  consciously for cultivar (see R2).

**⇒ The template to mirror:** `is_manual_override` + `original_price` + `price_leakage` on the
sale line, amount = baseline − final, actor attributed via the acting user id, linked to the
order/job. (For cultivar, add a `reason` — the Regina-story context — since the give is discretionary.)

---

## R2 — CULTIVAR'S LEAKAGE GAP + why the service price isn't editable

### R2a — today's `leakage_flag` is a DIFFERENT, un-attributed concept
Cultivar's `orders.leakage_flag` is a **boolean only**, and it means "a large-container plant went
out with NO add-ons" (a MISSED-UPSELL signal), not a price give-away:
- Set: [`submit.ts:194`](../../packages/cultivar-os/api/orders/submit.ts#L194) — `leakageFlag = anyLargeContainer && (nettingTotal + otherTotal) === 0`.
- Written: [`submit.ts:223`](../../packages/cultivar-os/api/orders/submit.ts#L223) — `leakage_flag: leakageFlag` on the order.
- **No amount, no actor, no baseline, no reason.** And it's order-grain, not line-grain.

**Delta to bring Ignition's ATTRIBUTED pattern here** (for a real price override, e.g. planting
6×$225=$1350 → flat $1000 = a **$350 give**):
| dimension | Ignition has | Cultivar has today | delta to add |
|---|---|---|---|
| override flag | `is_manual_override` (line) | — | per-line flag on the sale line |
| baseline price | `original_calculated_price` | server re-reads authoritative price | store the baseline that was overridden |
| leakage amount | `price_leakage` | — (only a boolean) | `price_leakage` = baseline − final |
| actor (who) | `estimates.tech_id → users` | — (create path has NO caller identity) | capture the acting member id |
| order/job link | `estimate_id`/`job_id` | `order_id` (have it) | reuse |
| reason | — (none) | — | ADD a reason (Regina context) |

**Where would the columns live?** The give can be on a PLANT line (`order_items`) OR a SERVICE line
(`order_service_selections`) — the $350 planting example is a SERVICE give → the override columns
belong on `order_service_selections` (and, for a plant-price give, `order_items`). Both are
live-only tables (tech-debt #39) → additive `ALTER`s, gated (a BUILD, not this recon).

### R2b — the ACTOR problem is real: the checkout submit path has NO caller identity
Ignition reads the actor from `DataBridge.load('current_user')` (local session). Cultivar's order
WRITE ([`api/orders/submit.ts`](../../packages/cultivar-os/api/orders/submit.ts)) runs with the **SERVICE KEY and NO Bearer token** — it is
anon-createable (a public QR customer can submit). So an override's actor can't be derived server-side
today. **The mechanism already exists in-repo:** the #100 CRUD gate resolves the caller from the
Bearer token — `callerIsBusinessOwner` / `callerHoldsPermission` ([`packages/shared/src/auth/callerPermission.ts`](../../packages/shared/src/auth/callerPermission.ts)). A price
override is an owner/manager act, so the override must travel a token-bearing path (like the CRUD
actions) so the server resolves `auth.uid()` → the acting member = the attribution. Mirror that, not
a client-posted member id.

### R2c — why the service/plant price is NOT editable today (only the stepper)
The cart is **quantity-editable only; price is display-only, server-authoritative:**
- Plant line: a `<Stepper>` for qty ([`CartReview.tsx:199`](../../packages/cultivar-os/src/pages/CartReview.tsx#L199)); price = `sell_price` (read-only, [`CartReview.tsx:187,196`](../../packages/cultivar-os/src/pages/CartReview.tsx#L187-L196)).
- Service line: `ServiceRow` exposes `{ name, rule, amount, editable, qty, onQty, included, onToggle }`
  — **there is no `price`/`onPrice` prop** ([`CartReview.tsx:421-433`](../../packages/cultivar-os/src/pages/CartReview.tsx#L421-L433)); `editable` gates only a qty `<Stepper>` ([`CartReview.tsx:432-433`](../../packages/cultivar-os/src/pages/CartReview.tsx#L432-L433)). The amount is `offering.price × netted-qty`.
- The server is authoritative + tamper-defended: [`submit.ts:111-135`](../../packages/cultivar-os/api/orders/submit.ts#L111-L135) re-reads `business_inventory.sell_price` and charges the SERVER value, **ignoring any client-posted price**; service amounts come from `offering.price` via `lineSubtotal` ([`submit.ts:162-181`](../../packages/cultivar-os/api/orders/submit.ts#L162-L181)).

**What's needed to make it owner/manager-editable (the build, not this recon):** (1) a price-input
affordance gated to owner/manager (mirror Ignition's `PriceField` isAdmin lock/unlock — [`PriceField.jsx:68-111`](../../packages/ignition-os/PriceField.jsx#L68-L111)); (2) submit must ACCEPT the override for a **token-verified** owner/manager caller
(not blindly re-read the baseline) while STILL refusing a client price from an unauthenticated caller
(tamper defense stays for the public path); (3) on accept, compute `price_leakage = baseline − final`
and persist the override columns + actor + reason (R2a/R2b). The baseline = the authoritative
`sell_price`/`offering.price` the server already computes — so "original price" is free.

---

## R3 — QB: GENERATE THE PREVIEW ON THE FLY (kill the stub)

### R3.1 — the stub (the demo-killer)
[`pages/DemoQBInvoice.tsx`](../../packages/cultivar-os/src/pages/DemoQBInvoice.tsx) renders **hardcoded line items for EVERY order** — it reads only
`total` + `invoiceNumber` from the query string ([`DemoQBInvoice.tsx:5-6`](../../packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L5-L6)) and prints three FIXED rows
regardless of what was actually bought:
- "Shoal Creek Vitex — 30 gal" @ $400 ([`:84`](../../packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L84))
- "Protective travel netting × 1" @ $10 ([`:90`](../../packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L90))
- "Native compost blend × 1" @ $28 ([`:96`](../../packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L96))

So a $473 planting order shows a $400 Vitex + $10 netting + $28 compost — **fake lines, same for any
order.** (Also hardcodes bill-to "Customer", the from-address, and the retired "**Layna**" contact at
[`:134`](../../packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L134) — the contact the docs say to never reintroduce.) Reached from Confirmation's "View
QuickBooks sandbox preview →" ([`Confirmation.tsx:178-183`](../../packages/cultivar-os/src/pages/Confirmation.tsx#L178-L183)).

### R3.2 — the REAL push is already order-driven (leave it alone)
[`api/qbo/invoice/cultivar.ts:124-176`](../../packages/cultivar-os/api/qbo/invoice/cultivar.ts#L124-L176) fetches the real `orders` + `order_items` + `order_service_selections`
and builds QB `SalesItemLineDetail` lines from actual data (unit_price/qty/subtotal per line). This
is the correct behavior — the DECISION is only about the PREVIEW, which must match it.

### R3.3 — the fix path (preview from real order data; do NOT touch the real integration)
`Confirmation.tsx:179` already passes **`orderId`** in the preview link. So `DemoQBInvoice` should:
1. Read `orderId` from the query string (already available).
2. Fetch that order's real lines the same way the detail drill-in does — `order_items` (dual-anchor
   named via [`lib/orderItemName.ts`](../../packages/cultivar-os/src/lib/orderItemName.ts)) + `order_service_selections → service_offerings(name)` +
   `customers` — under owner RLS (the preview is an owner-facing surface).
3. Render the real rows in the existing QB-styled chrome (keep the visual shell; swap the hardcoded
   `<tbody>` for the fetched lines; drop the "Layna" note + hardcoded bill-to).

This changes ONLY `DemoQBInvoice.tsx` (a display component) — `api/qbo/invoice/cultivar.ts` (the real
integration) is untouched. Net: any order shows ITS OWN correct invoice preview, matching what the
real push sends to QB. **Rename candidate:** `DemoQBInvoice` → an order-backed `QBInvoicePreview`
(the "demo" framing is what let it stay fake).

### R3.4 — ⚠️ CROSS-CUTTING FINDING (surfaced, not in scope to fix here): the REAL push shares the D-34 anchor bug
[`qbo/invoice/cultivar.ts:137`](../../packages/cultivar-os/api/qbo/invoice/cultivar.ts#L137) joins `order_items` to **`cultivar_plants(*)` ONLY** (via `plant_id`), then
[`:165-167`](../../packages/cultivar-os/api/qbo/invoice/cultivar.ts#L165-L167) reads `const plant = item.cultivar_plants; Description: \`${plant.common_name || plant.species} — ${plant.current_container}\``.
For a **stock-line / scan order** (`plant_id` null, `business_inventory_id` set — the PRIMARY path),
`item.cultivar_plants` is null → this **null-derefs / prints "undefined — undefined"** on the real QB
invoice. This is the SAME dual-anchor class as Part A ("Unknown plant") and #100b ("PLANTS (0)"),
now a THIRD layer — the REAL invoice mis-names/breaks on the primary order path. **The preview fix
(R3.3) should reuse `orderItemName.ts` so the preview is correct; the real push needs the same
dual-anchor fix as a separate build** (touches the real integration → its own gated pass, flagged
here so it isn't lost).

---

## R4 — SERVICE NAME LABEL (real name, not a hardcoded branch label)

### Where the hardcoded branch labels live
[`lib/transport.ts:108-112`](../../packages/cultivar-os/src/lib/transport.ts#L108-L112) — `CHOICE_META`:
```
delivery_planting: { label: 'Delivery + planting',  sub: 'We deliver and plant it in for you' }
delivery_only:     { label: 'Delivery only',        sub: 'We bring it to your property' }
self:              { label: "No thank you — I'll haul it myself", sub: '…' }
```
These are the **radio-choice** labels, rendered by `TransportToggle` ([`:88`](../../packages/cultivar-os/src/components/checkout/TransportToggle.tsx#L88) `{meta.label}`). As a
BRANCH SELECTOR label they're fine (they describe the choice). The problem is when a branch label
stands in for the SERVICE on a receipt.

### The receipt gap (Confirmation)
The Confirmation "receipt" ([`Confirmation.tsx:113-154`](../../packages/cultivar-os/src/pages/Confirmation.tsx#L113-L154)) represents transport as a **hardcoded status
badge** — staff → `"LAWNS handling delivery/install"` ([`:116`](../../packages/cultivar-os/src/pages/Confirmation.tsx#L116)) — and the "Order detail" block itemizes
**plants only** ([`:136-141`](../../packages/cultivar-os/src/pages/Confirmation.tsx#L136-L141)); the SERVICE lines (with real names like "Placement Service") are folded into
the subtotal and never itemized by name. So the receipt shows a hardcoded branch/status phrase where
the real service line(s) should appear.

### The real name IS available at that display point
- **In checkout:** the offering rows carry it — `selectedTransport.name`, `plantingOffering.name`,
  `nettingSel.offering.name`. `CartReview` ALREADY renders these correctly ([`CartReview.tsx:225,239,262`](../../packages/cultivar-os/src/pages/CartReview.tsx#L225-L262)) —
  so the review page is right; the Confirmation receipt is the one that collapses to a badge.
- **Post-submit:** `order_service_selections → service_offerings(name)` (what the real QB push
  [`qbo/invoice/cultivar.ts:143`](../../packages/cultivar-os/api/qbo/invoice/cultivar.ts#L143) and the #100 drill-in already read).

### What's needed (the build, not this recon)
The receipt (Confirmation) — and the QB preview (R3) — should ITEMIZE services by their real
`service_offerings.name` + amount, sourced from the cart's offering rows (checkout) or
`order_service_selections` (post-submit). Any place that needs a service label reads `offering.name`,
NOT `CHOICE_META.label`. Keep `CHOICE_META` for the radio; never let it stand in for the service name
on a receipt/invoice. ("Placement Service" is a `service_offerings.name` VALUE — AC-1: the label is
data, not code.)

---

## ⚑ SURFACED FOR DAVID TO RATIFY (not written this pass): the anti-hardcoding rule needs teeth

The QB stub (`DemoQBInvoice`) was flagged in the as-built recon §6 (2026-07-08) — a "demo/stub
surface always shown, even in a real order" — but it was **only flagged, never removed**, and it
went on to bite the owner-prove. A flag on the gap board is not a fix; hardcoded fakes AGE there.

**Proposed rule tightening (for ratification, do NOT self-adopt):** a surface flagged as
hardcoded/stub must be **REMOVED, or DOCUMENTED-WITH-REASON (why the stub is acceptable + its removal
trigger), before the build that flagged it ships** — not carried forward as an open gap-board item.
Candidate home: CLAUDE.md §6 coding guidelines (rule 2 "No placeholder code — fully functional or
documented" already gestures at this; the teeth = "flagged-hardcoded is a ship BLOCKER, resolved or
reasoned, not aged"). This is a §6/STD-class decision for David — surfaced, not enacted.

---

## FIX-PATH SUMMARY (all DECIDED; builds owed, none written here)
| # | fix | file(s) | touches real integration? | schema? |
|---|---|---|---|---|
| R3 | QB PREVIEW from the real order (reuse `orderItemName.ts`); drop hardcoded lines + "Layna" | `DemoQBInvoice.tsx` | NO | NO |
| R4 | receipt itemizes services by real `service_offerings.name`, not `CHOICE_META.label` | `Confirmation.tsx` (+ the R3 preview) | NO | NO |
| R2 | attributed price-override leakage (flag + baseline + amount + actor + reason), mirroring Ignition | `order_service_selections`/`order_items` (+ALTER), `CartReview`/`ServiceRow` (PriceField-style, owner/manager-gated), `submit.ts` (token-verified override accept + leakage write) | override-accept needs a token path (not the anon service-key create) | YES (gated additive ALTERs) |
| R3.4 | real QB push dual-anchor plant naming (stock-line vs specimen) | `api/qbo/invoice/cultivar.ts` | YES (own gated pass) | NO |

**STOP — recon only. No code, no migration.** Ignition leakage pattern cited at
`supabase_price_override_migration.sql:5-8` + `IgnitionEstimate.jsx:228-238` + `PriceField.jsx:44-51`
+ `supabase_schema.sql:41` (actor).
