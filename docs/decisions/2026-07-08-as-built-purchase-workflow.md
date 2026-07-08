# AS-BUILT — the purchase / checkout workflow (read-only recon)

**Date:** 2026-07-08 · **Type:** read-only code recon (no code/schema/behavior change).
**Purpose:** what the CODE ACTUALLY DOES today, step by step, as user stories + current
behavior with `file:line` cites. `[GAP]` marks where the code is incomplete, broken, stubbed,
or diverges from the intended workflow. Plain and factual — no redesign.

**The path:** plant select → services/transport → netting/decline → customer capture → review →
confirmation → order roster. Two entry doors: `/plant/:tagId` (single item, **public**) and
`/checkout/scan` (multi-item scan loop, **private/`qr_checkout`**). Both converge on
`/checkout/addons → /checkout/customer → /checkout/review → /checkout/confirm`
([router.tsx:85-92, 129-132](../../packages/cultivar-os/src/router.tsx#L85-L132)).

---

## 1. Plant selection

### 1a. Single-item — `/plant/:tagId` (PUBLIC)
**As a customer scanning a pot's QR, I land on the plant profile and add it to my cart.**

**Currently:** `usePlant(tagId)` resolves in two lanes — (L1) a real `cultivar_plants` specimen
row via `ilike(tag_id)`/`maybeSingle` wins ([usePlant.ts:96-121](../../packages/cultivar-os/src/hooks/usePlant.ts#L96-L121)); (L2→L5) on a miss, if a
`businessId` is present, `resolveStockLine` (SKU → name-token → size-collision) synthesizes a
plant-shape from a `business_inventory` lot ([usePlant.ts:123-140](../../packages/cultivar-os/src/hooks/usePlant.ts#L123-L140)). `availableCount` = the lot's
`qty` ([usePlant.ts:110](../../packages/cultivar-os/src/hooks/usePlant.ts#L110)). `PlantHero` renders `sell_price` (D-35, never `unit_cost`); null/0 shows an
honest "Not set", not $0 ([PlantHero.tsx:88-95](../../packages/cultivar-os/src/components/plant/PlantHero.tsx#L88-L95)). Multi-size collision → a "Which size?" chooser
renders *instead of* the profile until picked ([PlantProfile.tsx:30-58](../../packages/cultivar-os/src/pages/PlantProfile.tsx#L30-L58)). "Add to cart" → `setItem`
(REPLACE cart with one line) → `/plant/:tagId/addons` ([PlantProfile.tsx:80-83](../../packages/cultivar-os/src/pages/PlantProfile.tsx#L80-L83)). Qty selector shown
when `availableCount > 1`, capped at `availableCount` ([PlantProfile.tsx:95-112](../../packages/cultivar-os/src/pages/PlantProfile.tsx#L95-L112)).

**Currently (unavailable/error):** no inventory row or `status !== 'available'` → CTA hidden,
"This plant is `<status>`" / "Availability not set up yet" ([PlantProfile.tsx:78, 124-138](../../packages/cultivar-os/src/pages/PlantProfile.tsx#L124-L138)). No
plant/error → "Plant not found" ([PlantProfile.tsx:60-72](../../packages/cultivar-os/src/pages/PlantProfile.tsx#L60-L72)).

- **[GAP]** An **available lot with `sell_price` 0/null can still be added to cart** — the
  profile button reads "Add to cart — $0" and proceeds ([PlantProfile.tsx:114-116](../../packages/cultivar-os/src/pages/PlantProfile.tsx#L114-L116)); the $0 refusal
  only fires later at review/submit (§5). The hero says "Not set" but the CTA doesn't block.
- **[GAP]** The **nursery footer is hardcoded** "LAWNS Tree Farm, LLC · Leander, TX ·
  (512) 450-3336" ([PlantProfile.tsx:142-145](../../packages/cultivar-os/src/pages/PlantProfile.tsx#L142-L145)) — not read from the `businesses` row (vertical/tenant
  leak; also a different phone than elsewhere in the docs).
- **[GAP]** A **true-anonymous scan** (no session) can't use the L2→L5 stock-line fallback —
  `business_inventory` has owner/member RLS, so a discovery-catalog lot with no `cultivar_plants`
  row falls through to "Plant not found" for a logged-out customer ([usePlant.ts:126-131 comment](../../packages/cultivar-os/src/hooks/usePlant.ts#L126-L131)).

### 1b. Multi-item — `/checkout/scan` (PRIVATE, `qr_checkout`)
**As owner/staff, I scan item after item into ONE order, passing on anything I don't want.**

**Currently:** `ScanOrder` runs a scan→resolve→**Add / Pass** loop. `resolveStockLine`
(STOCK_LINE_COLUMNS) → `resolved` opens a review sheet; `collision` opens a size-picker;
`miss` shows "Didn't recognize this — keep scanning" ([ScanOrder.tsx:49-79](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L49-L79)). "Add to order" →
`addLine` (merge-by-anchor: re-scanning a lot bumps its qty) ([ScanOrder.tsx:94-99](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L94-L99)). "Review order →"
→ `/checkout/addons` ([ScanOrder.tsx:107-110](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L107-L110)). Cancel → `clear()` + back to `/orders` ([ScanOrder.tsx:112-115](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L112-L115)).

- **Note:** every scanned line is a **stock-line anchor** (`stock_line_id` set, synthesized
  plant) — this matters for the roster gap in §7.

---

## 2. Transport selection (three-branch radio)

**As the buyer, I pick one of: Delivery + planting / Delivery only / No thank you (I'll haul it).**

**Currently:** `AddOns` fetches `service_offerings` (`timing='at_checkout'`, active), splits into
transport vs addon ([useServices.ts:26-42](../../packages/cultivar-os/src/hooks/useServices.ts#L26-L42)). `resolveTransportRoles` classifies transport rows **by
shape** — self (`transport_mode='self'`), delivery (`staff` + `flat`/`order`), planting (`staff`
+ `per_unit`/`plant`) ([transport.ts:53-88](../../packages/cultivar-os/src/lib/transport.ts#L53-L88)). `availableChoices` builds the radio; branch 1 attaches
delivery (flat ×1) + planting (per_unit ×N), branch 2 delivery only, branch 3 self ([transport.ts:91-125](../../packages/cultivar-os/src/lib/transport.ts#L91-L125)).
`TransportToggle` renders only the available branches with price hints ([TransportToggle.tsx:44-107](../../packages/cultivar-os/src/components/checkout/TransportToggle.tsx#L44-L107)).
Initial branch = the `pre_selected` transport row's mode (the seed pre-selects "Pick up myself"
→ the **self/netting branch is the default**) ([AddOns.tsx:50-58](../../packages/cultivar-os/src/pages/AddOns.tsx#L50-L58)).

**Which branches are live vs flagged/hidden — depends entirely on the business's
`service_offerings` DATA, not code:**
- With the **migration-seed shape** (self flat/order $0 · "We deliver" staff flat/order · "We
  deliver and plant" staff per_unit/plant $225 · netting addon — [20260529_..._f_service_offerings.sql:95-129](../../supabase/migrations/20260529_businesses_f_service_offerings.sql#L95-L129))
  → all **three branches are live**.
- With the **current LAWNS demo drift** (a fused per-plant row `db24be2e` + a mis-shaped
  Delivery *addon* `a7933609`, per the CLAUDE.md handoff): there is a planting (per_unit) row but
  **no delivery flat/order row** → `resolveTransportRoles` returns `fused` + a `flags` entry
  ([transport.ts:66-73](../../packages/cultivar-os/src/lib/transport.ts#L66-L73)). Result: **"Delivery only" is HIDDEN**, and **"Delivery + planting" runs on the
  single fused per-plant row** (one ×N line, no separate per-order delivery fee) ([transport.ts:107-124](../../packages/cultivar-os/src/lib/transport.ts#L107-L124)).
  AddOns surfaces the flag as an amber "Heads up:" note ([AddOns.tsx:167-171](../../packages/cultivar-os/src/pages/AddOns.tsx#L167-L171)) and `[TRACE:CART]`
  ([AddOns.tsx:40-45](../../packages/cultivar-os/src/pages/AddOns.tsx#L40-L45)).

- **[GAP]** Until the demo `service_offerings` rows are reshaped into a delivery (flat/order) +
  planting (per_unit/plant) pair, **branch 1's two-line math (delivery ×1 + planting ×N) is not
  demonstrable** and **"Delivery only" does not appear**. The workflow FLAGs this and best-efforts
  on the fused row; it does NOT hand-migrate the data (that's the separate Settings-editor task).
- **[GAP]** A transport offering's **`requires_address` field is never enforced** — nothing in the
  flow forces an address for a delivery/planting branch (see §4).
- **[GAP]** If **no transport rows exist**, AddOns shows "No transport options are set up…" and the
  cart can't proceed with a transport choice ([AddOns.tsx:127-131](../../packages/cultivar-os/src/pages/AddOns.tsx#L127-L131)) — an empty-catalog dead-end.

---

## 3. Netting / decline (the Regina mechanic)

**As a self-transport buyer, I'm shown the "secure your load" notice and either add the tarp or
decline — and my decline is recorded.**

**Currently:** on the self branch, `AddOns` renders `CompliancePrompt` (red 3px `#A32D2D` border)
with the offering's `compliance_title`/`compliance_body` (LAWNS = TX Transportation Code Ch.725),
or a hardcoded fallback if the offering carries no compliance copy ([AddOns.tsx:137-165](../../packages/cultivar-os/src/pages/AddOns.tsx#L137-L165)). Netting is
**pre-checked** when self is selected (`nettingActive` defaults true) ([AddOns.tsx:70-71](../../packages/cultivar-os/src/pages/AddOns.tsx#L70-L71)). Decline via
`setNettingDeclined`, which also de-selects the self-gated addon ([useCart.ts:117-126](../../packages/cultivar-os/src/hooks/useCart.ts#L117-L126)). On submit the
decline is **captured three ways**: `orders.netting_declined` + `orders.transport_note` ("…netting
declined, Texas TCC Ch.725 waiver acknowledged") ([submit.ts:23-27, 201-202](../../packages/cultivar-os/api/orders/submit.ts#L201-L202)) + an immutable
`order_compliance_records` row (`decision: accepted|declined`, with the exact title/body shown)
for every offering carrying a compliance notice ([submit.ts:283-300](../../packages/cultivar-os/api/orders/submit.ts#L283-L300)). `[TRACE:PRICE]` logs the
decision ([submit.ts:189-196](../../packages/cultivar-os/api/orders/submit.ts#L189-L196)).

- **[GAP]** The **fallback netting prompt** (shown when NO netting `service_offering` exists —
  [AddOns.tsx:152-165](../../packages/cultivar-os/src/pages/AddOns.tsx#L152-L165)) captures `orders.netting_declined` but writes **no `order_compliance_records`
  row** (that loop only runs over offerings with a `compliance_title` — [submit.ts:284-297](../../packages/cultivar-os/api/orders/submit.ts#L284-L297)). So a
  decline against the hardcoded fallback isn't in the immutable audit log.
- **Note:** netting only appears on the **self** branch; choosing delivery/planting never shows it
  (by design — staff handle the load).

---

## 4. Customer capture — `/checkout/customer`

**As the buyer, I enter who the invoice goes to before I review.**

**Currently:** `first_name`, `last_name`, and a valid `email` are **required**; everything else is
optional ([CustomerCapture.tsx:78-83](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L78-L83)). `phone` is only saved when it's exactly 10 digits, else dropped
([CustomerCapture.tsx:93](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L93)). `state` defaults to `'TX'` ([CustomerCapture.tsx:96](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L96)). Copy states no payment is taken
now ([CustomerCapture.tsx:230-232](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L230-L232)). Submit → `setCustomer` → `/checkout/review` ([CustomerCapture.tsx:101-102](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L101-L102)). Back →
`/plant/:tagId/addons` (single) or `/checkout/addons` (multi) ([CustomerCapture.tsx:111](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L111)).

- **[GAP]** **Address is always optional**, even when the chosen transport is delivery/planting
  (which logically needs a ship-to). The offering's `requires_address` is never consulted here —
  a delivery order can be placed with a blank address.
- **Note:** the same three-required-field rule applies to a delivery order — nothing conditional on
  the transport branch.

---

## 5. Review itemization — `/checkout/review`

**As the buyer, I see the full itemization — plants + each service netted — and adjust before
sending.**

**Currently:** `CartReview` requires `items` + `customer`, else redirects ([CartReview.tsx:64-71](../../packages/cultivar-os/src/pages/CartReview.tsx#L64-L71)). Plant
lines are qty-editable and (multi-item) removable ([CartReview.tsx:178-204](../../packages/cultivar-os/src/pages/CartReview.tsx#L178-L204)). Services render as adjustable
rows: transport, then **planting as its own line** (per_unit ×N, add/remove within branch 1),
netting (include/decline), other addons ([CartReview.tsx:216-278](../../packages/cultivar-os/src/pages/CartReview.tsx#L216-L278)). Each service's netted qty honors an
owner override, else the attach rule (`nettedQuantity`) ([CartReview.tsx:40-41, 84-89](../../packages/cultivar-os/src/pages/CartReview.tsx#L84-L89)). Tax = the
business's `tax_rate` (fallback 0.0825) ([CartReview.tsx:74](../../packages/cultivar-os/src/pages/CartReview.tsx#L74)). Two actions: "Send invoice + pay online" and
"I'll pay at the office" — both call `handleSubmit`, differing only in a `payOnline` flag
([CartReview.tsx:338-355](../../packages/cultivar-os/src/pages/CartReview.tsx#L338-L355)).

**Currently (refusal):** any line with `sell_price <= 0` → a red "No sale price set…" banner and
**both pay buttons disabled** ([CartReview.tsx:79-80, 322-329, 343](../../packages/cultivar-os/src/pages/CartReview.tsx#L322-L329)); the server independently returns 400
`NO_SELL_PRICE` if it slips through ([submit.ts:119-130](../../packages/cultivar-os/api/orders/submit.ts#L119-L130)).

- **Note (price authority):** the server re-reads `business_inventory.sell_price` per line and
  charges the SERVER value, ignoring the client-posted price (tamper defense) ([submit.ts:111-117](../../packages/cultivar-os/api/orders/submit.ts#L111-L117)).
- **[GAP]** `price_tier` (retail/contractor/wholesale) is **read but never applied** — the
  tier→adjustment math is undefined, so checkout charges the baseline `sell_price` (AC-4 hold)
  ([submit.ts:65-72, 132](../../packages/cultivar-os/api/orders/submit.ts#L65-L72)).
- **Note (leakage):** `leakage_flag` is set when a large-container line goes out with zero add-ons
  ([submit.ts:182-183](../../packages/cultivar-os/api/orders/submit.ts#L182-L183)); surfaced later in the roster.

---

## 6. Confirmation — `/checkout/confirm`

**As the buyer, I get an order-confirmed screen with the invoice + QB status.**

**Currently:** reads nav-state; no state → redirect home ([Confirmation.tsx:54-59](../../packages/cultivar-os/src/pages/Confirmation.tsx#L54-L59)). A QB invoice object
is **not required** — when QB is absent (not connected / 503 / `qbStatus` pending) it renders an
honest amber "Invoice will sync to QuickBooks shortly", never a crash/blank ([Confirmation.tsx:70-74, 96-110](../../packages/cultivar-os/src/pages/Confirmation.tsx#L96-L110)).
Transport status badge: staff → "LAWNS handling delivery/install"; self+netting → "Trees
protected"; self+no-netting → "No netting — drive carefully" Ch.725 ([Confirmation.tsx:113-127](../../packages/cultivar-os/src/pages/Confirmation.tsx#L113-L127)).
Order-detail plant lines are read from the **still-held cart `items`** ([Confirmation.tsx:135-141](../../packages/cultivar-os/src/pages/Confirmation.tsx#L135-L141)); totals
come from nav-state. Actions: "View invoice in QuickBooks" (payOnline + url) / "Invoice emailed" /
"See you at the office" ([Confirmation.tsx:157-175](../../packages/cultivar-os/src/pages/Confirmation.tsx#L157-L175)). "Start another order" → `clear()` + home ([Confirmation.tsx:77-80, 185-187](../../packages/cultivar-os/src/pages/Confirmation.tsx#L185-L187)).

- **[GAP]** The **plant-line detail depends on the cart still being populated** — a page reload (or
  any `clear()`) empties `items`, so the order-detail plant rows vanish (nav-state carries totals
  but not line items) ([Confirmation.tsx:136](../../packages/cultivar-os/src/pages/Confirmation.tsx#L136)).
- **[GAP]** The **"View QuickBooks sandbox preview →"** link points at a hardcoded
  `/demo/quickbooks-invoice?…` demo route ([Confirmation.tsx:178-183](../../packages/cultivar-os/src/pages/Confirmation.tsx#L178-L183)) — a demo/stub surface always shown,
  even in a real order.
- **[GAP]** **Both pay paths fire the QBO invoice call** (pay-at-office also POSTs to QB) — flagged
  as an open design decision (R3) in the CLAUDE.md handoff, not resolved.

---

## 7. Order roster — `/orders` (PRIVATE, `qr_checkout`)

**As owner/staff, I see recent checkouts.**

**Currently:** a **read-only** list — the 50 most recent orders for the business, `created_at`
desc ([Orders.tsx:43-60](../../packages/cultivar-os/src/pages/Orders.tsx#L43-L60)). Each card shows customer name/email, total, invoice # (from `notes`), a
transport icon/label, a leakage "Add-ons declined" flag, and the date ([Orders.tsx:133-188](../../packages/cultivar-os/src/pages/Orders.tsx#L133-L188)). "New
order" → `/checkout/scan` ([Orders.tsx:83-92](../../packages/cultivar-os/src/pages/Orders.tsx#L83-L92)).

- **[GAP — significant] Stock-line orders show "Unknown plant".** The roster joins
  `order_items → cultivar_plants (tag_id, common_name, species)` ([Orders.tsx:51](../../packages/cultivar-os/src/pages/Orders.tsx#L51)), i.e. via `plant_id`.
  But stock-line-anchored orders (the discovery-catalog path AND **every `/checkout/scan`
  order**) write `order_items.business_inventory_id` with `plant_id = null` ([submit.ts:227-232](../../packages/cultivar-os/api/orders/submit.ts#L227-L232)).
  So the join returns null → the card renders "Unknown plant" + tag "—" ([Orders.tsx:117-120](../../packages/cultivar-os/src/pages/Orders.tsx#L117-L120)).
  The roster cannot name items for what is now the primary order path.
- **[GAP] CRUD is READ-ONLY** — no edit, no delete, no status change, no order-detail view. The
  `status` column is fetched but **never displayed** ([Orders.tsx:14, 48](../../packages/cultivar-os/src/pages/Orders.tsx#L14)); no order ever leaves `pending`
  (no status-transition code exists anywhere in the flow).
- **[GAP] Only the first line item is shown** — the card renders `order_items[0]` + "+N more"
  ([Orders.tsx:116, 165](../../packages/cultivar-os/src/pages/Orders.tsx#L116)); a multi-item order's other lines aren't listed (no drill-in).
- **[GAP] Services aren't surfaced anywhere post-submit.** `order_service_selections` is written
  ([submit.ts:243-278](../../packages/cultivar-os/api/orders/submit.ts#L243-L278)) but never read/displayed on the roster (or elsewhere) — transport/planting/
  netting/addons don't appear in the roster, only the `transport_method` icon.
- **Note:** the `transport_method` label map handles `self`/`delivery`/`install` ([Orders.tsx:19-29](../../packages/cultivar-os/src/pages/Orders.tsx#L19-L29));
  `install` now covers both "delivery + planting" and a fused per-plant row ([submit.ts:17-23](../../packages/cultivar-os/api/orders/submit.ts#L17-L23)).

---

## Cross-cutting notes

- **Order write is one endpoint** (`api/orders/submit.ts`) that loops the cart lines, writes one
  `order_items` row per line on its correct anchor (stock line vs specimen), writes
  `order_service_selections` + `order_compliance_records`, reserves inventory lots, and fires a
  leakage SMS to the owner ([submit.ts:194-345](../../packages/cultivar-os/api/orders/submit.ts#L194-L345)). QB invoice + confirmation email are non-blocking
  ([useSubmitOrder.ts:62-137](../../packages/cultivar-os/src/hooks/useSubmitOrder.ts#L62-L137)).
- **The `/plant/*` and `/checkout/*` (addons/customer/review/confirm) routes are PUBLIC**;
  `/orders` and `/checkout/scan` are gated on `qr_checkout` ([router.tsx:85-92, 129-132](../../packages/cultivar-os/src/router.tsx#L85-L132)).
- **The biggest as-built vs. intended gaps:** (1) the roster can't name stock-line/scan orders
  (§7); (2) with the current demo `service_offerings` data, "Delivery only" is hidden and
  "Delivery + planting" runs fused (§2); (3) delivery orders never require an address (§4); (4) no
  order status lifecycle beyond `pending` (§7); (5) fallback-netting declines skip the compliance
  audit row (§3).
