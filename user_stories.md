# 📖 TRACE — Story Board (source of truth)

> **What this is.** The second lens beside the Status Board.
> The **Status Board** (`status.html` ← `TRACE-SESSION-BOOTSTRAP.md`) shows what is **BUILT** —
> capabilities, green/amber/red. **This file** shows what we are **BUILDING TOWARD** —
> the user's lived need, told as day-in-the-life narrative — **and now what is OWED.**
> They LINK by **capability id** (`MAPS-TO`) and **arc**, so at a glance we can see which
> capabilities have a story (and which don't = build-blind) and which stories have no built
> pieces yet (= gaps).
>
> **It is a QUEUE, not just a gallery.** Every story (and every gap) carries a **STATUS** (is it
> owed?) and a **SCOPE** (what altitude does it live at?). `stories.html` has a **WHAT'S OWED**
> view that surfaces everything not yet `written`, filterable by status and by altitude — so the
> board answers *"what stories do we still need?"*, not only *"what stories do we have?"*
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
> STATUS: written | demo-operational | needs-input | needs-sub-stories | gap | scoped-out
> SCOPE: <one or more of: north-star | platform | vertical:cultivar | vertical:coolrunnings | vertical:kinna | vertical:ignition — comma-separated, primary first>
> BUILD: active | in-build | archived          (OPTIONAL — build progress; default active)
> ARC: <one of the 8 arc ids below — or omit for a cross-cutting item>
> MAPS-TO: <status-board capability id(s), e.g. 2.3, 5.1 — comma-separated — or — for none yet>
> PIECES: <comma-separated build-piece names, e.g. inventory_count, inventory_count_offline>
> NEEDS: <one line — what input / sub-story / decision is owed; used when STATUS is not "written">
> <narrative + details in markdown prose / bullets, until the next ### or ##>
> ```
>
> - **STATUS** — the lifecycle axis. Three states are TERMINAL (not owed — `written`, `demo-operational`,
>   `scoped-out`); three are OWED (`needs-input`, `needs-sub-stories`, `gap`):
>   - `written` — complete, captured, no open questions (TERMINAL, built + storied).
>   - `demo-operational` — a standard capability that must **WORK IF POKED** at the demo (owner asks
>     "can it do X?" → yes, and it functions), even if it isn't in the *scripted* flow. TERMINAL / built,
>     not owed. **Distinct from demo-critical** (which is *in* the scripted flow).
>   - `needs-input` — drafted / stubbed but BLOCKED on a decision, detail, or direction from David
>     (the "Lightning needs David" queue).
>   - `needs-sub-stories` — the top-level story exists but the sub-stories under it are missing / incomplete.
>   - `gap` — a capability that EXISTS (in code, on the status board, or in the plan) but has **NO story yet**
>     (a coverage gap). A `gap` entry is a one-line "this needs a story," **not** a fabricated scenario.
>   - `scoped-out` — a standard capability **DELIBERATELY not built**, carrying its **one-line reason**.
>     TERMINAL, not owed. The **anti-recurrence** entry: it stops a scoped-out decision from re-appearing
>     later as a "gap." (The reason lives in the prose as **`Reason:`** so the card SHOWS why.)
> - **SCOPE** — the ALTITUDE the story lives at (this is a nested-scope project; discussions flip between altitudes):
>   - `north-star` — the vision above the platform (spotlight brain, timing layer, trust tiers).
>   - `platform` — the whole composable-AI platform (one source / many views, the shared spine, cross-vertical).
>   - `vertical:cultivar` · `vertical:coolrunnings` · `vertical:kinna` · `vertical:ignition` — a specific vertical.
>   - If a story spans scopes, tag the **primary** one first + note the others.
> - **BUILD** *(optional)* — build progress, the old axis kept so the "a build is advancing it now" signal isn't lost:
>   `active` (a need we hold, no build running) · `in-build` (a build is advancing it now) · `archived` (delivered / retired).
>   Default `active` when omitted. Archived stories move to `## ARCHIVED` and render muted.
> - **ARC** — one of the 8 canonical arc ids: `front-door` · `ocr-doc-routing` · `cost-to-produce` ·
>   `suggestion` · `delivery` · `discovery` · `identity-roles-sec` · `asset-inventory-pmi`.
>   Cross-cutting items (no single build-arc) live under `## NEEDED` and render under "Unfiled".
> - **MAPS-TO** — the KEY LINK. Names the Status-Board capability id(s) this story maps to
>   (e.g. `2.3` walk-and-count, `5.1` inventory, `3.5` delivery). Multiple allowed, comma-separated.
>   `—` means **no capability exists yet** — a visible gap.
> - **PIECES** — the named build-pieces that make the story real (chips on the card).
>
> The `## ARC:` headings below carry the stories. A story's own `ARC:` tag wins if present;
> otherwise it inherits the section it sits under. Completed stories move to `## ARCHIVED`.
> Format-example tags inside this blockquote are quoted prose, not parsed stories.

---

## ARC: front-door

_Register → invite → scrape-while-away → return → reveal → validate/conflict → seed → vertical → alive dashboard._

### Front-door — the first-run journey has no story yet
STATUS: needs-input
SCOPE: platform
ARC: front-door
MAPS-TO: —
PIECES: register, invite, scrape_while_away, reveal, seed
NEEDS: David to pick async-vs-sync scope before this becomes a written story. The SYNCHRONOUS reveal (reveal → address-conflict → catalog-seed → alive dashboard) is BUILT (ledger #47, owner-proof owed); the ASYNC choreography (register → invite → scrape-while-away → return-later) is conversation-only and inverts today's account→business order (the auth landmine).
_Coverage placeholder, not a fabricated scenario._ The whole front-door arc — a prospect's first run from "I typed my URL" to "my dashboard is alive" — has built pieces at the reveal end and nothing at the async end, but **no day-in-the-life story** to build against. See `docs/decisions/2026-06-26-front-door-arc-recon.md` and ARC-MAP arc-1.

### Lauren's first run — scan a QR, no URL, no password
STATUS: needs-input
SCOPE: platform, vertical:cultivar
BUILD: active
ARC: front-door
MAPS-TO: 1.5
PIECES: invite_token, qr_login, magic_link, pin_first_use
NEEDS: David to set token policy — one-time, short-TTL, bind-to-first-device. The invite is a BEARER CREDENTIAL (whoever holds it IS Lauren until the PIN is set) — the front-door arc's known auth landmine.
Lauren never types a URL or a password. At the counter the desktop shows a QR; she scans it with her phone camera and lands in-app already recognized. Remotely the same invite arrives by email/SMS as a tap-LINK (a QR is useless on the phone meant to scan it) — one tap, same landing. On first use she sets her 4-digit PIN; from then on PIN (and face-unlock) is how she returns. One token behind both doors. DEMO-PATH — this is how "onboarding-arc prove" starts.

---

## ARC: ocr-doc-routing

_Capture → extract (one engine) → infer type → confirm → fan-out to many destinations._

### Snap a document, let TRACE route it
STATUS: needs-input
SCOPE: vertical:cultivar, platform
ARC: ocr-doc-routing
MAPS-TO: —
PIECES: ocr_capture, ocr_infer_type, ocr_fanout
NEEDS: David to expand into full day-in-the-life prose. Built in Cultivar today, but the capture→infer→route pattern is cross-vertical (platform).
_Placeholder (David to expand into full day-in-the-life prose)._ The owner photographs whatever paper lands in their hands — a vendor invoice, a receipt, a delivery slip — and TRACE reads it once, infers what kind of document it is, asks for a one-tap confirm, and routes it onward to the right destination (a cost, an inventory intake, a scheduled delivery) instead of dead-ending in a pile. Today capture + OCR exist (receipt-shaped); type-inference and fan-out routing are the gap.

### Receipt-keeper discount-line model is wrong (fix owed)
STATUS: gap
SCOPE: vertical:cultivar
ARC: ocr-doc-routing
MAPS-TO: —
PIECES: ocr_lineitem_model
NEEDS: LOOK before fixing (may be the OCR adapter or the line-item type). Recon-first, found 2026-06-28 on a real Lowe's receipt.
_Coverage placeholder, not a fabricated scenario._ The parser models "DISCOUNT EACH" as standalone negative line items instead of a per-unit modifier on the line above, and drops qty/unit-price ("2 @ 6.28") → a false "$3.06 below total — possibly tax/tip" warning on a receipt that actually reconciles. OCR read fine; the **line-item MODEL** is wrong (needs qty + unit_price + per_unit_discount + extended net). Discounts are cost-to-produce signal. → CLOSE-OUT-LEDGER GENUINELY OPEN.

### The receipt reaches QuickBooks — the throughput's missing second half
STATUS: gap
SCOPE: vertical:cultivar, platform
BUILD: active
ARC: ocr-doc-routing
MAPS-TO: —
PIECES: qbo_buyside_push, receipts_qb_link_column, qbo_attachable_upload
NEEDS: OWN BUILD SLOT — a QBO integration build, NOT part of an RBAC/UI pass. Ordered: (1) buy-side transaction push, then (2) the attachment. Read Intuit's live portal for the file-size cap + allowed-extension list before (2) is scoped (the doc pages are JS-rendered and truncate on fetch — do not assert them from memory). Corpus verified 2026-07-29.
_The owner photographs a receipt, TRACE reads it — and then the cost stops there._ **The receipt's DATA is as stranded as its image.** TRACE captures a document only to extract data from it and pass it through to the system that is the record (MASTER_BRIEF § *TRACE Is Not a Record System*); for a receipt that system is QuickBooks, and today **nothing reaches it**. Verified: zero occurrences of `receipt` in the QBO directories, zero of `qbo`/`quickbooks` in `ReceiptKeeper.tsx` or `api/receipts/`, and **no `qb_*` column on `receipts` across all four of its migrations** — no field exists that could even hold the destination id. The two QBO call sites that exist are connect/status (`api/qbo/router.ts`) and invoice push (`api/qbo/invoice/cultivar.ts`).

**TWO BUILDS, ORDERED — and (1) is the real one.** **(1) BUY-SIDE TRANSACTION PUSH** — receipt → QBO `Purchase`/`Bill`, storing the returned id on `receipts` in the `qb_*` column that does not exist. *This is what makes the cost data reach the record system at all.* **(2) ATTACHABLE UPLOAD** against that id — `POST /v3/company/{realmId}/upload`, `multipart/form-data` (`file_metadata_nn` + `file_content_nn`), linked via `AttachableRef[].EntityRef {type, value}`. **(2) is unbuildable without (1) and secondary to it:** an `Attachable` needs a transaction to point at, **we create Invoices only — sell-side** — and a receipt is buy-side. The image is not "an upload we never wired"; it is **a document with no parent to attach to**.

**CARRY THE INVERSION — it will be missed otherwise.** Today the image is **LOAD-BEARING**: a storage failure aborts the receipt row entirely (`ReceiptKeeper.tsx:403-408`). Once QBO is the record that **inverts** — the TRANSACTION must not fail, and the image becomes droppable after it lands. Same shape as the order/QBO ordering settled at `a3439a6`: **the durable fact commits first, the integration follows and can fail without taking anything with it.** A deliberate change, not a side effect. _Grounded: the 2026-07-29 corpus report (`packages/shared/src/quickbooks/`, `packages/cultivar-os/api/qbo/**`, `api/**`, `supabase/migrations/*.sql`); Intuit Attachable API reference._

### A captured invoice is a sale that happened — and the dashboard says so
STATUS: written
SCOPE: vertical:cultivar, platform
BUILD: in-build
ARC: ocr-doc-routing
MAPS-TO: 2.3, 3.5
PIECES: ocr_fanout, history_order, dashboard_when_it_happened, addon_banner_states
NEEDS: —
_Written AS-BUILT on 2026-08-27 (§9 story-reconciliation gate: in code, not on the board). The build shipped under David's direct spec; this captures it so the behaviour is not re-derived later._

LAWNS went live 26 Aug 2026 and scanned six real customer invoices. Each produced a customer and a delivery and **NO ORDER** — their tenant held zero rows in `orders`. So on the morning after their first real week the dashboard told them they had made **0 installs against five real ones**, **$0 of sales against $14,370.21** they had actually invoiced, and showed a **green check certifying "every large-container sale included an add-on" over a set of zero sales**. Every number on the page was wrong, and the page looked confident.

**A captured sale is a HISTORY ORDER — a distinct KIND, and the distinction is the whole story.** It is already paid, already in the seller's own QuickBooks, and its stock left the property before Cultivar existed. So it must be a first-class sale record for reporting while tripping **none** of the machinery a real checkout trips: **it never pushes to QuickBooks** (that would create a second invoice for a settled sale, in the customer's real accounting, under the seller's real name) and **it never moves inventory**.

🔴 **The inventory half is subtler than "don't decrement," and this is the part that will be missed.** Committed stock is **DERIVED, not stored** (D-52): `available = on-hand − committed`, where committed is a live join over open orders. So a history order needs no decrement to do damage — merely existing in an open status with a lot id on its lines silently reduces what the business can sell, with no ledger row and nothing on any screen. **Two independent escapes, both taken:** `business_inventory_id` stays NULL on every line (it is also the honest value — these are SKUs transcribed off paper, not lots we ever held), and status is `fulfilled`. The proof is arithmetic, not assertion: available-to-sell is snapshotted across every lot before and after the write and must be identical.

🔴 **And the sale must be dated when it HAPPENED, not when it was typed.** Both dashboard tiles keyed on `created_at`. That is harmless only while every order is born at its own checkout; the moment captured invoices become orders, six sales made across five earlier days and backfilled in one afternoon report as **that afternoon's revenue**. A confidently wrong number is worse than a zero because nobody goes looking for it. Sales key on `sale_date` (the document's own date, falling back to `created_at` where absent); **installs key on `delivery_date` and are counted off `deliveries`, not orders** — an install is a physical event and lives in the delivery record whichever door created it, so counting orders left the tile structurally blind to the OCR door forever.

**The add-on banner had two states and needed four.** `leakageCount > 0 ? amber : green` meant every unenumerated situation fell into the green branch, so an empty week certified a universal positive over an empty set (§6 r18 — a header is a claim that must hold for every row beneath it). Leakage is computed at checkout from resolved catalog lines and container sizes; a transcribed document line has neither, so a history order's `leakage_flag` of `false` means **unevaluated**, not **clean**. The banner now distinguishes: read failed · no sales this week · sales exist but none assessable · genuine miss · clean — and the clean branch names its own denominator.

**A document with NO customer produces NO order.** A vendor receipt for hose, oil or emitters is a real captured document and a real cost, but it is nobody's sale. _Grounded: ledger #223; migration `20260827_history_orders.sql`; `packages/shared/src/business-logic/historyOrder.ts` (+ its 45 probes); `packages/cultivar-os/src/lib/dashboardWindows.ts` (+ 23); `scripts/backfill-history-orders.mjs`._

### The receipt-cost meter — what it costs, and is the OCR good enough
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
ARC: ocr-doc-routing
MAPS-TO: —
PIECES: cost_meter, usage_ledger, ocr_quality_signal
NEEDS: David to decide metering unit + cap-vs-overage + whether retakes (2 calls for 1 receipt, often OUR miss) are billed. Cost feeds cost-to-produce (built); the per-customer usage meter has NO board id yet (— = capability candidate, platform-scope: every vertical hits the gateway).
David runs a batch of real receipts through and learns three things from the [TRACE:CAPTURE] trail: (1) what 100 reads cost (Gemini Flash ~$0.0001/read → extrapolate a customer's monthly AI bill); (2) whether a customer is over allotment (the "1000 calls, then a penny more" tier — needs per-customer counts to monitor, guard abuse, bill); (3) whether the OCR is good enough — straight-through submit = OCR nailed it, image RETAKEN = a PHOTO problem not OCR, fields EDITED on a good image = OCR misread. The three signals log APART, because an edit isn't always a failure (the user sometimes adds what OCR couldn't know).

---

### The email the register types is the email the business holds
STATUS: gap
SCOPE: platform
ARC: ocr-doc-routing
MAPS-TO: 3.7
PIECES: checkout_customer_capture, customer_upsert_fill_rules, person_spine_contact_fields
NEEDS: David to promote this off `gap` — it is written AS-BUILT from the 2026-08-25 defect and prompt, not dictated. The open question inside it is the one the build had to answer without a story: **is email SUPPLIED-WINS (a typed value replaces the stored one) or FILL-ONLY (it only ever fills a blank)?** Shipped as supplied-wins, on the reasoning below; a different ruling is a one-line change.
A repeat customer is rung up at the counter. The cashier looks them up, sees the form, and types or corrects the email — and **the invoice is sent to that address**. So the business must afterwards HOLD that address: the next campaign, the next statement, the next receipt has to reach the same inbox the customer just gave. Before 2026-08-25 it did not — the shared find-or-create built its UPDATE payload from a list of offered fields and `email` was not one of them, so a NEW customer got their email (the INSERT carried it separately) and **a REPEAT customer's typed email was silently discarded**, invoice already sent. _Measured: customer `0ee368fe` — `email` `''`, `updated_at` the same second as the order, billing address from the same payload persisted correctly._ **The rule that makes this safe rather than destructive: an email left BLANK must never blank a stored one** — absent is not empty (A9), and a checkout that simply did not collect one must leave a curated address alone. Email is deliberately the ONE field on this path that a supplied value REPLACES rather than fills, because the register is where a customer corrects it; every other field stays fill-never-clobber. _Distinct from the `Owner-configurable form fields + missing-data flag` story, which is about email being ABSENT AT THE SOURCE on OCR'd invoices — this one is about a typed email failing to persist._ _Grounded: ledger #217; `packages/shared/src/business-logic/customerUpsert.ts`; owner-test cards 9–11; tech-debt #112 (the `people.email` divergence this leaves open)._

## ARC: cost-to-produce

_Recurring/operating costs → labor → margin → compute → (forward-run) suggestion engine._

### Cost-to-produce has no story yet
STATUS: gap
SCOPE: vertical:cultivar, platform
ARC: cost-to-produce
MAPS-TO: —
NEEDS: David/owner to narrate the owner's lived cost-to-produce need. Build-blind in reverse — heavily BUILT, no story.
_Coverage placeholder, not a fabricated scenario._ The cost-to-produce spine (recurring/operating costs → labor → margin → compute, plus the by-project drill-in) is among the most-built parts of the platform, yet there is **no day-in-the-life story** behind it. The narrative the build should answer is owed.

### Platform economics — the pricing / margin / leakage engine, re-leveled (EPIC)
STATUS: needs-input
SCOPE: platform
BUILD: active
ARC: cost-to-produce
MAPS-TO: —
PIECES: model_b_pricing, overhead_carveout, display_surfaces, leakage_actor_capture
NEEDS: POST-DEMO. David to (1) re-level TRACE Enterprises to BuiltWithCAI/general and (2) re-enter the infra cost floor wiped with the old DB — Model B needs per-tenant cost-to-serve to compute. Then the leakage/actor-capture layer (override CAPTURE, not just APPLY) is the forward build. See "David actions" below.
The whole owner-economics engine as ONE tracked epic — distinct from the (still-owed) day-in-the-life cost-to-produce NARRATIVE above: **Model B** pricing ([[D-16]], cost-to-serve ÷ N ÷ (1−margin) + payback line) + **overhead carve-out** ([[D-14]] / [[D-18]]) + **four display surfaces / three audiences** ([[D-17]] — owner /costs · what-if estimator · customer price view · decision record) + **margin-leakage capture** (the override must be CAPTURED, not just applied, before a leakage report can aggregate it). The engine was PROVEN pre-wipe against business `45830ba7` (snapshots BEFORE-NUMBER / AFTER-FLIP / LABOR-3a/3b); recovery requires re-leveling + infra-cost re-entry. _Grounded: DECISIONS D-14/D-16/D-17/D-18; `docs/cost-to-produce/MARGIN-LEAKAGE-PRECONDITIONS.md` (override APPLIED-vs-CAPTURED); the pre-wipe snapshots. Cross-ref the "Cost-to-produce has no story yet" gap above — that is the BACKWARD narrative; this is the FORWARD engine._

---

## ARC: suggestion

_Pattern-surfacing from owned data (the Regina Principle — the product north star)._

### The timing layer — capture when noticed, surface when actionable
STATUS: gap
SCOPE: north-star
ARC: suggestion
MAPS-TO: —
PIECES: timing_capture, timing_surface
NEEDS: David to expand into the surfacing story. The genuinely-NEW unbuilt north-star piece — no capability exists yet.
_Coverage placeholder, not a fabricated scenario._ The system captures a thread the moment it's noticed and re-surfaces it at the moment it's **actionable** (the Regina principle — closing the gap that cost the 40-minute drive home). This is the one net-new unbuilt piece in `NORTH-STAR.md` §5. The customer-zero rhythm logger (ledger #63) is the instrument gathering David's day-rhythm to design it.

### Resurface the offers — configure and seed what surfaces at sale (the Regina anchor)
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
ARC: suggestion
MAPS-TO: 3.2, 2.2
PIECES: offer_config_editor, offer_seed, jit_trigger
NEEDS: David to configure-through-the-editor as the owner-prove, and to seed the demo tenant (`f7ec5d67…`) — netting (self-trigger) + an active self-transport offering. Recon: **0 active `service_offerings` today**, so the at-sale surfacing engine (board 3.2, netting LIVE) has nothing to surface until offers are seeded/configured.
The netting companion-offer already fires at checkout (board 3.2, `AddOns.tsx:39`, `trigger_transport_mode`) — but only when an offer EXISTS and is ACTIVE. This is the owner's side of that: a Settings-level editor to define which offers surface, on which trigger, with what urgency copy (the Regina rule — the reminder that closes the 40-minute-drive-home gap), and the seed that lights the demo tenant up so the anchor demo actually shows an offer. _Grounded: tech-debt #47; `service_offerings` live; [[D-16]]/[[D-17]] pricing surfaces; MASTER_BRIEF Regina anchor (:327)._

### Just-in-time completeness — surface the add-on before the window closes
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
ARC: suggestion
MAPS-TO: 3.2
PIECES: jit_completeness, timing_window_enforce
NEEDS: David to decide the model — **copy-only** (urgency prompt; owner/customer still free to skip) vs **enforced** (the timing window actually gates the flow). Today the Regina rule is urgency COPY; whether completeness is ever hard-enforced is open.
Some add-ons can only be applied at a specific moment — netting at planting time, fertilizer at delivery. The completeness engine notices the window is open and surfaces the offer while it still matters, then lets it go once the moment passes, so the owner never discovers a missed upsell after the truck has left. This is the timing discipline on top of the offer-config surface above. _Grounded: MASTER_BRIEF Regina rule (urgency copy) + three suggestion types (:403); board 3.2; App Philosophy "The Regina Rule."_
**TILE HOME:** `opportunities` / `follow-up` (`followup_engine`) — both dashboard tiles PLANNED/unbuilt in `tileRegistry.ts`. The JIT-completeness engine is these tiles' intended function: surface-while-the-window-is-open (fertilizer at delivery, netting at planting) = `opportunities`; catch the missed add-on AFTER the window closed (the upsell discovered after the truck left) = `follow-up`.

---

### Build one order from many plants — scan, add or pass, then net the services
STATUS: written
SCOPE: vertical:cultivar, platform
BUILD: in-build
ARC: suggestion
MAPS-TO: QR Checkout Flow (multi-item)
PIECES: scan_order_loop, attach_rule_netting, interactive_review
NEEDS: David's owner-prove on live (below). Fertilizer quantity-with-spec ("5 × 30gal each") is banked (own recon + a small additive migration).
Lauren walks the lot with one order open. She scans a tree — Add. Scans the next — that one's not going today, Pass. Scans a third — Add. Five trees, one order, no URL typing. At review the app has already done the arithmetic the right way: the delivery fee is charged once (one truck for the whole load), the planting fee is charged per tree (five plantings, five fees), netting per tree — and it SHOWS her each with its rule so nothing is silently applied. She bumps one line's quantity, drops a service she doesn't want, and sends it. Each line lands on the order anchored to its own stock line or specimen; the total reflects the netting. _Grounded: recon R1–R5 (the per-order/per-plant attach rule already lives on `service_offerings.price_type`/`price_unit` — zero migration); D-34 per-line anchor; D-9/Regina surface-not-silent (the review PROPOSES, the owner adjusts); §6.8 reuse (QrScanner + resolveStockLine + synthesizePlant reused, the order write rides the existing submit.ts). Built 2026-07-08, BUILDER-COMPLETE, owner-proof owed._

---

## ARC: delivery

_Schedule → day-group → select stops → bookend (business→stops→business) → Google Maps handoff._

### The order I just rang up is on Thursday's truck
STATUS: gap
SCOPE: vertical:cultivar
BUILD: in-build
ARC: delivery
MAPS-TO: 2.1, 3.4, 3.5
PIECES: checkout_delivery_row, service_type_from_transport, order_to_stop_traceability
NEEDS: 🔴 **WRITTEN BY THUNDER 2026-08-25 AS THE AS-BUILT / GAP CASE — DAVID OWNS PROMOTING IT OFF `gap`.** The §9 story gate found NO MATCH: every delivery story on this board sources its stops from the OCR-invoice door, and none said a checkout order becomes a scheduled delivery. The behaviour below is exactly what David's build prompt dictated, written down so the build is not a re-derivation. **Two things are genuinely owed and are NOT decided here: (a) the no-natural-key question** — `deliveries` has no `order_id`, so an edited or re-submitted order can mint a second stop (tech-debt #108); **(b) whether the ship-to should ever differ from the customer's billing address at checkout** — today it cannot, and the "conditional-address-on-delivery" sub-story owed by the In-store purchase workflow story is the same question from the other side.
Lauren rings up a customer at the counter for delivery next Thursday. The order is taken, the invoice pushes, the customer drives off — and **the stop is already on Thursday's schedule**, without anyone re-typing an address or waiting for a piece of paper to be photographed. A delivery-and-planting job shows as a planting job; a plain drop-off shows as a drop-off; a customer hauling it themselves creates no stop at all, because no truck goes out. The stop carries the invoice number, so anyone looking at Thursday's route can trace a load back to the order that made it. _Grounded: the delivery day view and the route map already exist and are OWNER-PROVEN (archived "Route the day's deliveries"); the ONLY missing piece was that `orders` and `deliveries` were unconnected — every stop arrived through `api/customers/create.ts` (the OCR door), so an order placed today appeared on neither screen. Built 2026-08-25, BUILDER-COMPLETE, owner-proof owed — `api/orders/submit.ts` `scheduleCheckoutDelivery`, ZERO migrations (`deliveries` already carried every column). Permission-gate deliberately ABSENT per the 2026-07-31 capability-not-a-field ruling, which named `deliveries:create` as the wrong string for this exact line._

### Joel can see the whole month, and the calendar says when a day's work is the wrong kind of work
STATUS: written
SCOPE: vertical:cultivar, platform
BUILD: in-build
ARC: delivery
MAPS-TO: 3.4, 3.5
PIECES: four_week_grid, day_type_rules, activity_type_tag, conflict_flag, activity_source_seam, window_navigation, day_view_in_view, cell_count_summary
NEEDS: nothing to start — the day-type shape, its permissions and the surface decision were settled 2026-08-28. 🔴 **What is genuinely owed and is NOT decided here: the three activity sources that do not exist.** Uppotting/graduation has no dated table and is a WINDOW not a day (Terry's uppot window runs November to March and is two months wide for a batch), so it lands as a PENDING DECISION beside the grid — *"Lacey Oak 3/5 → 15 gal — window open, needs scheduling"* — never as a cell. Spray has nothing anywhere. PMI has a table but no dated data: `business_pmi_schedule` has no date column and derives its due date from `last_service_at`, which is null on every row platform-wide because `business_service_log` is empty. Each is a separate build; the seam is declared and rendered so none of them arrives as a surprise.
Lauren wrote the farm's week down herself — Monday is service and maintenance, Tuesday and Wednesday are delivery only, Thursday through Sunday are delivery and placement — because the team just grew and **Terry has bought an RV and is starting to travel**. The knowledge that lived in one head is about to be off site. Joel is the operations manager and this is his primary screen; Terry described the same need for himself: *"I need to see varieties and when things need to get done. I don't need to see the money."* So: four weeks at a glance, this one and the three ahead, every day named, every piece of scheduled work showing what KIND of work it is. 🔴 **And the point is the mismatch, not the colour** — a calendar that prints "Monday — maintenance" and stays silent while four deliveries sit on that Monday has built the decoration and skipped the feature. A day whose work contradicts its type says so, in words, naming which stops are the problem. 🔴 **It warns; it never blocks.** David on a trailer flagged red for brake maintenance: *"today I'm taking the damn trailer."* The schedule advises, the owner decides, and every flagged stop still edits, still routes, still saves. A single day can be overridden without moving the pattern, because a big delivery will land on a maintenance Monday eventually and the answer is one exception, not a rule change that silently moves every other Monday. ⚠️ **It is NOT a replacement for Google Calendar** — Lauren's carries a PTA meeting, birthdays and a personal calendar. This is the OPERATIONS calendar; it imports nothing and syncs nothing. _Grounded: built 2026-08-28 on branch `feat/operations-calendar`, BUILDER-COMPLETE, owner-proof owed — `packages/cultivar-os/src/lib/operationsCalendar.ts` (pure model, 103 probes, 10/10 red-first) + `pages/OperationsCalendar.tsx` + `supabase/migrations/20260828_business_operating_days.sql` (GATED). It REPLACES `/delivery-schedule` per David's ONE DELIVERY LIST ruling — the day-grouped list is now its drill-in for a selected day, with every affordance unmoved._
🔴 **THE WINDOW MOVES, AND THAT CLAUSE WAS ADDED 2026-08-31 (ledger #244) BECAUSE THE FIRST BUILD READ *"four weeks at a glance"* AS A CAGE RATHER THAN AS A DEFAULT.** Fixed at this week and the three ahead with no way forward and **no way back at all**, the grid could not reach **Saturday 2026-08-29 — seven stops, six made, one rescheduled** — one day before the window, while the drill-in beneath it counted *"9 scheduled in total"* and offered one. **Nine deliveries existed and eight were unreachable**, which is not an inconvenience: a calendar that counts work it will not show you is hiding it. So the window moves a whole window at a time, back and forward, with one press home — and because Terry reads this from an RV and Joel from the yard, **the control is placed by device: a dropdown on the desktop, arrows on the phone and tablet** (David, 2026-08-31: *"the desktop already has dropdown navigation and does not need arrows. Arrows are for the phone and the tablet in the yard, where they are the whole interface."*). ⚠️ **And two display corrections in the same pass:** the selected day rendered at the BOTTOM of the page below the sources footnote, so clicking a day appeared to do nothing (it now sits under the grid and scrolls into view — **no new day screen was built**, because the one that existed was correct and complete); and a cell now prints **the count** when there is more than one stop, because three truncated names identify nobody.
⚠️ **NOT THIS STORY, AND NAMED SO IT IS FILED RATHER THAN REDISCOVERED (David, 2026-08-31): a four-week grid is a PLANNING tool and it is currently the LANDING.** First thing in the morning nobody wants September — they want today; last thing at night, tomorrow. **So *today* and *the calendar* become two screens with two jobs**, and the calendar becomes the one you visit deliberately. That is its own story and its own build; #244 deliberately did nothing that would make it more expensive, which is the main reason a bigger day view was NOT built. 🔴 **When it lands, an empty today must say WHY it is empty** — the same job the *"What this calendar shows"* panel does here, which is the most honest thing on the screen and keeps its shape.
**SHARES DATA WITH** *"Offer delivery slots that actually work"* (below): that story's `working_days_config` piece and this story's day-type rules are **ONE setting with two consumers** — the same `business_operating_days` rows that flag an internal mismatch here are what tell a customer-facing booking screen which days LAWNS can serve. Whoever builds the slot algorithm reads this table rather than minting a second one.
⚠️ **SCOPE OF THE COUNT, and it is a named gap rather than a silent one:** this reads `deliveries` ONLY. `orders.delivery_date` is a second record of the same fact with no reliable key joining the two (tech-debt #108), so a delivery scheduled at the counter that never produced a `deliveries` row is absent — on Test Dave's that is 18 of them. The screen says so in its own footnote. Inventing a dedupe rule on a table pair with no natural key inside a calendar build is how the calendar becomes where the duplicate-delivery bug lives.

### The stop is done — one tap, and a moved stop says where it went
STATUS: written
SCOPE: vertical:cultivar, platform
BUILD: active
ARC: delivery
MAPS-TO: 3.4, 3.5, 2.1
PIECES: fulfilment_tap, delivery_complete_state, reschedule_records_destination, reschedule_reason, day_actuals_readout
NEEDS: 🔴 **THE RULE IS SETTLED AND IS NOT WHAT IS OWED** — David, 2026-08-30: *"A RESCHEDULE IS NOT A DELETION. The trees were staged, the route was built around it and the customer was given a date. Moving a stop must say WHERE IT WENT and WHY."* ⚠️ **WRITTEN BY THUNDER 2026-08-30 (ledger #235) AS THE NO-MATCH CASE — and the absence is itself the finding: this story was referred to as *"the fulfilled-tap story"* and DID NOT EXIST on the board.** The nearest thing was a clause inside the will-call story (`:1028`), which is exactly how a requirement gets re-derived. **What IS owed by David:** (1) the `why` vocabulary — free text, or a closed set (weather · customer · crew · truck · stock-not-ready), and **a closed set here is the opposite call from `day_type`'s**, so it should be made deliberately rather than by analogy; (2) whether the tap lives on the route screen, the calendar drill-in, or both — **and the answer must not be "both, built twice"**.
🔴 **Saturday 2026-08-29 is the evidence, and it is not hypothetical.** All seven of that day's deliveries still read `status = 'scheduled'`. **Six were made and one was rescheduled** — and the system records neither. Two days later David could not say which stop moved, **and neither could the database.** Lauren's paper sheet is the only record of what happened on a real install day at a real customer.
Someone finishing a stop marks it done — **one tap, in the place they are already standing** — and that single act is what the rest of the platform reads. When a stop instead MOVES, the record does not go quiet: it says **which date it went to and why**, so a day can be read back honestly afterwards as *"seven booked · six completed · one moved to the 5th, customer rescheduled"* rather than as seven identical rows that all still say `scheduled`.
🔴 **THE TAP NOW HAS FIVE CONSUMERS, WHICH IS WHY IT IS ONE ACTION AND NOT FIVE (§6 r8):** the **review request** (you cannot ask for a review for a job that has not happened) · **completion status** (`historyOrderStatus()` already routes `complete`/`completed`/`delivered`/`fulfilled`/`done` → the order becomes `fulfilled`, so the order half needs no second rule) · **contractor pay** (paid on work done, not work scheduled) · **material consumption** (on-hand drops when the truck rolls, per [[D-52]] — the fulfil-time decrement this story is the trigger for) · and **"what actually happened on a given day"** (the operations calendar reads `deliveries` and today can only ever say what was *booked*).
✅ **BUILT 2026-08-31 (ledger #247), TWO OF THE FIVE PIECES: `fulfilment_tap` + `delivery_complete_state`.** A crew member marks a stop done on a phone; the write stamps `started_at`/`completed_at` and sets `status='fulfilled'` — the word `historyOrder.ts`'s `DELIVERY_COMPLETE` list was already written to accept, so the order half needed no second rule, exactly as this story predicted. **Mounted in ONE place** — `DeliverySchedule`, which the operations calendar renders as its day drill-in, so one implementation already serves both the day list and the calendar. 🔴 **`reschedule_records_destination` and `reschedule_reason` are NOT built and are still owed by David** (the `why` vocabulary), and `day_actuals_readout` waits on them — a day cannot be read back as *"six completed · one moved to the 5th"* until a move can say where it went. **BUILDER-COMPLETE, owner-proof owed** (`docs/owner-tests/delivery-fulfilment-full-surface-test.md`).
⚠️ **THIS IS THE SAME ACTION THE WILL-CALL STORY NAMES** (*"one fulfilment action, three contexts — DO NOT BUILD THREE"*, `:1028`): the crew at a stop, the counter at a walk-in, and a customer collecting. **A spec that names three is the thing to stop.** It is also the missing half that makes tech-debt **#121** live — `deliveries.status` holds `scheduled` and ONLY `scheduled` across every tenant, because the only writes to the column are the two INSERTs — and #121's trigger, *"the first Monday after a real delivery Saturday"*, **is 2026-08-31.**


### Ask for a review at the door — without telling anyone what to say
STATUS: written
SCOPE: vertical:cultivar, platform
BUILD: active
ARC: delivery
MAPS-TO: 3.5
PIECES: review_ask_prompt, customer_facing_qr, one_tap_skip, ask_record, repeat_customer_window, review_link_setting, skip_rate_readout
NEEDS: ⚠️ **WRITTEN BY THUNDER 2026-08-31 (ledger #247) AS THE NO-MATCH CASE, from David's own dictation in the build prompt.** The tap it hangs off had a story; the ask did not. 🔴 **WHAT IS OWED BY DAVID — and it is a COPY decision, not an engineering one:** the proposed guidance line was *"It helps most if you mention what we planted and how the crew did."* **Google's Rating Manipulation policy prohibits exactly that** — *"nor should they request that specific content be included"*, and expressly *"content that identifies a staff member"* (support.google.com/business/answer/7400114, read 2026-08-31). **The build ships a neutral default and REFUSES that line at the settings field.** David rules on what the default should say instead, knowing the constraint. **(2)** the repeat-customer window is set at **180 days** by reasoning, not by measurement — one growing season plus a margin; a real answer needs Lauren.
**THE CREW MAY NOT READ OR SPEAK CONFIDENT ENGLISH** — David's observation of the real crews, and the man who lives on site speaks none. **So there is no spoken script and no instruction to say anything.** The crew taps and turns the phone around; the customer-facing screen carries the ask in full by itself. ⚠️ **The crew's buttons and the customer's screen are SEPARATELY LANGUAGED — two audiences, one device — and nothing may assume one language per tenant**, because Cuto and the office are one business and more than one language. Full translation is a later story; this build's obligation was not to write down an assumption that must later be undone, and it does not (there is no language column anywhere, and the only hardcoded locale in the neighbouring positions feature sits at the document layer).
A crew member finishes a job and is asked one question: **ask for a review?** Two buttons. **Show the code** turns the phone into a customer-facing screen — a thank-you, one guidance line the business wrote itself, and a QR that opens their review page **directly**. **Not this one** is a single tap that asks nothing: no reason, no confirmation. Some jobs end badly — a fence came down and went back imperfectly — and **a crew that cannot skip cleanly will either ask at the wrong moment or stop marking stops done altogether**, which would cost four other things that read the same tap. The same customer is not asked again inside a window; a business with 1,936 customers and real repeat trade would otherwise train them to ignore it.
🔴 **THREE RULES THAT ARE NOT PREFERENCES, AND THEY ARE GOOGLE'S, NOT OURS.** **NO SCREENING** — the *"rate us 1-5, and if it's 4+ here's the link"* pattern is review gating and is prohibited; the code shows the review destination or shows nothing, and **the crew's judgement is the only filter**. **NO INCENTIVES ANYWHERE** — not in the copy, not in the configurable line. **NO CONTENT DIRECTION** — the least obvious of the three and the first thing anyone will add back. All three are stated **in a comment at the code** with the policy URL, because this is what somebody "improves" in six months by adding a helpful screening question.
🔴 **AND THE CLAIM THE PLATFORM MAY NEVER MAKE: that a review was LEFT.** Google does not report which customer left which review, so a tile reading *"12 reviews generated"* would invent a number nobody can know. **The system records THE ASK** — asked and skipped — and lets the public count speak for itself. ⚠️ **The skip rate is the signal nobody expects: if crews skip a third of jobs, that is a job problem, not a review problem**, and it is only readable because the skip writes a row instead of doing nothing.
⚠️ **THIS IS A TILE, NOT CORE, AND THE SPLIT IS BUILT IN FROM THE START — retrofitting it is what makes a paywall leak.** Marking a stop done is core (*"did this happen?"* is not purchasable). The ask is the first capability behind **`followup_engine`** — declared in `MODULE_CATALOG` at $19/mo, `status:'planned'`, seeded `enabled:false` with **no trial clock** (David's 2026-08-02 ruling: a clock counting down against a tile that does not exist has nothing to decide). 🔴 **With the tile off the crew screen is BYTE-IDENTICAL — proven by construction, not by comparison:** the function that builds the crew's screen takes no module state, so there is no input through which the two cases could differ. A paywall a customer can read over a crew member's shoulder is the worst place for one. _Grounded: build 2026-08-31, ledger #247, BUILDER-COMPLETE, owner-proof owed (`docs/owner-tests/delivery-fulfilment-full-surface-test.md`, CARD 5 is the paywall test)._

### Offer delivery slots that actually work
STATUS: needs-input
SCOPE: vertical:cultivar
BUILD: active
ARC: delivery
MAPS-TO: 3.4, 3.5
PIECES: working_days_config, geo_slot_clustering, service_type_capacity
NEEDS: David to settle the slot algorithm (working-days flag × geo-cluster × service-type capacity) + how far ahead slots open. Absorbs the banked working-days-config + service-type-aware-scheduling items.
A customer scheduling a delivery shouldn't see every calendar day — only the slots LAWNS can serve. Open slots = the business's working days (LAWNS delivers Tue/Thu) filtered by geo-clustering: "nothing Tuesday, but we'll be in your ZIP Thursday." A planting job consumes more of a day's capacity than a drop-off, so a day fills by WORK, not stop-count. This is the just-in-time delivery intelligence that turns the raw routing engine into an offer the customer picks from. → 3.4 (scheduling, net-new) + 3.5 (routing, live).

### See the opportunity along the route — service overlay on the map
STATUS: needs-input
SCOPE: vertical:cultivar
BUILD: active
ARC: delivery
MAPS-TO: 3.5, 3.2
PIECES: service_overlay, proximity_opportunity
NEEDS: David to scope what the overlay surfaces — past customers near today's stops (warranty / upsell / inspection) vs due-services vs both — and whether it's a passive readout or a suggested add-stop.
While routing the day, TRACE overlays SERVICE context on the map: past customers near the route, warranties coming due, inspections owed — turning the route from pure logistics into the capacity/opportunity readout (MASTER_BRIEF "routing IS the capacity readout"). The map becomes the demo that SHOWS the owner she's driving past opportunity, not just logistics. _Grounded: MASTER_BRIEF routing-as-capacity (:375) + map-is-the-demo (:382); proximity-opportunities memory; board 3.5 route live / 3.2 suggestion._
**TILE HOME:** `opportunities` (dashboard tile, PLANNED/unbuilt in `tileRegistry.ts` — no route/component yet) — this story is its intended function ("I'll be in your area, want your trees looked at?"; the registry note ties `opportunities` into the Delivery context). The outreach leg (reaching out to that nearby customer) lands on `follow-up` (`followup_engine`).

### Clickable route pins — tap a stop for its detail (polish, not demo-critical)
STATUS: needs-input
SCOPE: vertical:cultivar
BUILD: active
ARC: delivery
MAPS-TO: 3.5
PIECES: pin_infowindow, pin_edit_customer
NEEDS: RECLASSIFIED OUT of demo-critical → POLISH (per 2026-07-03). Enhancement 2 (clickable pins → stop-info InfoWindow, with an "Edit customer" popup opening the existing `CustomerEditModal`) is RECON'd, NOT built — a nice-to-have after the demo, not a blocker.
On the delivery map, tapping a numbered pin opens a small InfoWindow with that stop's detail (customer, address, service) and an "Edit customer" action that opens the SAME modal the delivery card uses. Deferred as polish — the route, pins, and driving line are already owner-proven (the archived "Route the day's deliveries" story). _Grounded: ARC-5 Enhancement 2 (recon'd, not built); ledger #82 CustomerEditModal (forward-fit target); board 3.5._

### In-store purchase workflow — plant → transport → checkout → confirm → order
STATUS: needs-sub-stories
SCOPE: vertical:cultivar
BUILD: in-build
ARC: delivery
MAPS-TO: 2.1
PIECES: transport_radio, netting_decline, compliance_record, customer_capture, review_itemize, confirmation, order_roster
NEEDS: sub-stories owed for the remaining open gaps (conditional-address-on-delivery, confirmation itemization, fallback-decline audit-row). BUILT 2026-07-08 (roster sub-stories — builder-complete, owner-proof owed): (a) **roster names every order** — the drill-in + roster resolve item names by the D-34 dual anchor (specimen `cultivar_plants` wins, else stock-line `business_inventory.name`), closing the "Unknown plant" gap on scan/stock-line orders; (b) **full order CRUD** — a `/orders/:id` drill-in shows all lines + all services (`order_service_selections`, previously written-but-never-shown) + customer + delivery date + status + totals; owner/manager can edit line quantities + delivery date, remove lines, change status, and delete — each server-recomputed (re-read sell_price, re-net services) with inventory RE-RESERVED (release old, reserve new) / RELEASED on delete; staff read-only, enforced server-side (submit.ts action gate: owner OR `manage_orders`). _Grounded: as-built recon §7; Orders.tsx, OrderDetail.tsx, api/orders/submit.ts (action=update|delete|status)._
Lauren rings up a customer at the lot: take a plant order, offer transport and services correctly priced, capture a netting-decline for liability, produce a confirmed order — complete, correctly priced, legally covered. Originally built + owner-proven May-18 (transport toggle, netting prompt with TX Transportation Code Ch.725, decline tracking); regressed by the multi-item rewrite; restored 2026-07-08. Transport is a single-select radio: Delivery+planting (delivery flat ×1 per order + planting per_unit ×N per plant), Delivery only (delivery ×1, no planting), No thank you / self-haul (netting offer). Netting fires ONLY on self-haul: tarp offered (size/qty is a staff judgment at the lot, system surfaces — does not auto-calc); accept adds the tarp, decline shows the Ch.725 message AND writes an immutable liability record (who/what/when/sale) — the legal shield, the Regina-story origin mechanic, must persist not merely display. Deep flow detail lives in docs/user-stories/cultivar-flows-and-contractor-program-2026-06-03.md §5 (online) + §6 (in-person QR); canonical behavior in docs/specs/SPEC-transport-netting-decline-workflow-2026-07-08.md. _Grounded: restore commit (#97), lib/transport.ts, order_compliance_records; as-built recon docs/decisions/2026-07-08-as-built-purchase-workflow.md._

---

## ARC: discovery

_Website read → two-pass (Haiku identity / Sonnet analysis) → synthesis email → seed.ts → catalog-populate._

### Discovery has no story yet
STATUS: gap
SCOPE: platform
ARC: discovery
MAPS-TO: —
NEEDS: Owner to narrate the discovery need (the "TRACE already knows my business" moment). BUILT but un-storied.
_Coverage placeholder, not a fabricated scenario._ The discovery engine (website read → identity/analysis passes → synthesis → seed → catalog-populate) is built, but has **no day-in-the-life story** behind it.

### Populate LAWNS's real catalog — the 116-row Woo export becomes priced stock
STATUS: needs-input
SCOPE: vertical:cultivar
BUILD: active
ARC: discovery
MAPS-TO: 1.3, 5.1
PIECES: catalog_import, priced_offerings_activate
NEEDS: David to activate the 116-row LAWNS WooCommerce catalog (already in hand as a CSV export) as priced offerings on the live demo tenant, so the demo dashboard shows LAWNS's ACTUAL trees, not sample data.
The catalog-populate engine is BUILT (board 1.3 — 114 real varieties read live 06-21, D-9 honesty-flagged). **The MECHANISM this story was waiting on is now built:** the CSV catalog import (ledger #148, `/inventory/import`) is BUILDER-COMPLETE (owner-proof owed) — it maps the Woo export's columns, resolves each row against the catalog, and lands it as REAL PRICED stock through the D-50 ledger (never overwriting a physical count without an explicit per-row say-so). This is the demo-facing activation path: feed LAWNS's own 116-row CSV through `/inventory/import`. _Grounded: board 1.3 (`discovery/catalog.ts` + the new `packages/shared/src/import/` core); the Woo CSV in hand; board 5.1 inventory live._

---

## ARC: identity-roles-sec

_Auth principal → membership resolution → role/permission chokepoint → RLS wall → audit._

### Identity / roles / security has no story yet
STATUS: gap
SCOPE: platform
ARC: identity-roles-sec
MAPS-TO: —
NEEDS: Narrate the owner/manager/staff lived need behind the wall (who sees costs, who can't, why). BUILT but un-storied.
_Coverage placeholder, not a fabricated scenario._ The identity/roles/security spine (auth principal → membership resolution → role/permission chokepoint → RLS wall → audit) is built, but has **no day-in-the-life story** behind it. _Update 2026-07-06 (OP-11): the owner-facing SURFACE is now OWNER-PROVEN — the agnostic member/device console at `/team` (Users/Roles/Devices; ledger #86), the per-user detail view + owner PIN-reset (#87), and email-read-only-login-cred + owner-manages-member-phone (#88). The narrative (who sees costs, who can't, why) is still owed — STATUS stays `gap` until a real story is written._

### Manage how I unlock — change my PIN, unlock with my face
STATUS: needs-input
SCOPE: platform, vertical:cultivar
BUILD: active
ARC: identity-roles-sec
MAPS-TO: —
PIECES: pin_self_change, biometric_unlock, auto_lock_reauth
NEEDS: David to confirm the biometric MECHANISM — WebAuthn passkey against the device platform authenticator (Face-ID-gated, key in the Secure Enclave, TRACE stores only a public key; NO camera face-match, NO templates). Recommended: face PRIMARY, PIN FALLBACK, riding the existing auto-lock timeout. WebAuthn works in the Safari tab now (no PWA-wrap dependency). No discrete auth/session board id (— ; nearest 1.5 + the RBAC auto-lock setting — dedicated device-auth capability may be warranted).
A LAWNS worker is out on the lot — gloves, dirty hands, a smudged screen; thumbing a PIN is the wrong tool. The app auto-locks after idle; the worker unlocks with their FACE, PIN as the fallback when a face check fails. From their OWN Settings › Your Profile (user-self, D-22 — not Admin, which is the owner resetting a staff PIN) each person can CHANGE THEIR PIN (re-auth first) and ENROLL / REMOVE face-unlock on that device. _Screenshot 2026-07-03: Your Profile shows Name/Phone/Login-Email; PIN + face-unlock are the missing controls._
See [[D-30]] — shared-device auth design note (personal-device "A" is this story; shared-terminal "B" = PIN-swap / face-swap-preferred / face-recognition do-not-build).
_Update 2026-07-06 (OP-11): the OWNER-side reset leg referenced above (the owner resetting a staff PIN from the member-detail view) is now BUILT + OWNER-PROVEN — agnostic PIN-reset spine, reset-screen path (ledger #87, `5ab0c50`; SMS-coded-link path stubbed pending Twilio)._
_Update 2026-07-07 (OP-11): the SELF-change-PIN leg is now BUILT + OWNER-PROVEN too — a member changes their own PIN from Your Profile (current → new → log in with the new PIN; `changeOwnPin`, ledger #90(1), `25be6f7`). Device management alongside it is OWNER-PROVEN: self-device-handoff via QR (add own device by scanning, no typing — ledger #91, `f83c937`) + self-service device management (see + remove own devices from Profile, current-device guarded — ledger #92, `d794bad`). This story's ONLY remaining scope is **biometric face-unlock**: the credential-store migration `20260706_member_devices_webauthn_credential` is now APPLIED+verified (columns/index/RLS live, 0 enrolled) but the ENROLLMENT BUILD (persist the WebAuthn credential + set `biometric_enrolled` + a Profile "Enable face unlock" control + auto-lock/re-auth) is NOT YET BUILT — queued next. STATUS stays `needs-input` only for that biometric mechanism._

### Migrate shop_ (Ignition) tables into the platform DB — WITH RLS as they land (a SECURITY EVENT, not a lift-and-shift)
STATUS: needs-input
SCOPE: platform, vertical:ignition
BUILD: active
ARC: identity-roles-sec
MAPS-TO: —
PIECES: shop_tables_rls, business_id_scoping, ignition_onto_shared_auth
NEEDS: David to set timing (undecided). A recon is owed to scope it table-by-table. Likely trigger: **before Ignition adopts the spine OR before any paying customer touches the platform DB, whichever comes first.**
Under [[D-31]] (platform DB + spine-first), Ignition retires onto the shared spine and drops its own `DataBridge.authenticate` login; its `shop_` (Ignition-specific, the 20%) tables move into the platform DB. **This is a SECURITY EVENT, not a lift-and-shift:** the `shop_` tables currently **LACK RLS**, so migrating them into a multi-tenant DB that enforces tenant isolation on everything else means **adding `business_id` scoping + owner/member RLS to EVERY `shop_` table AS IT LANDS** ([[AC-2]]/[[AC-3]]) — or an unsecured hole is imported into the shared DB. A serious, careful build — **OP-12 territory**: once a reference environment exists, it goes through reference first, with the reference-proven migration promoted byte-identical to live. Grounds: [[D-31]], AC-2/AC-3, the Auth Architecture Locked Rule.

### Three positions at LAWNS have no starting set — and the sets we have are the people David met
STATUS: gap
SCOPE: platform, vertical:cultivar
BUILD: active
ARC: identity-roles-sec
MAPS-TO: —
PIECES: yard_hand_set, onsite_maintenance_set, second_business_sets
NEEDS: 🔴 **NOTHING FROM A BUILDER AND EVERYTHING FROM A VISIT.** These sets cannot be derived — that is the entire lesson of tech-debt **#133**, where five sets were tuned until they hit five stated counts and *"the matching counts are not evidence the membership matches."* Writing Cuto's set from a two-sentence description would repeat it exactly. What is owed is **watching the person do the job**, the same way the 2026-08-29 workbook was produced.

The five starting sets came from the 2026-08-29 workbook, and the workbook came from watching **one** business. The header always said so. What it could not say is *which people that sample contained* — and on 2026-08-31 the answer arrived: **it contained the people David met.** Three positions at LAWNS were not among them, and all three surfaced within hours of one another.
🔴 **The yard hand.** Found by asking why the workbook withheld *"walk the lot and count stock"* (`INV-01`) from the crew, which sat oddly beside the staff-count-walk build (#238, tech-debt #67). David's answer: **the crew set is DRIVERS; walking the lot to count is a YARD job.** The withholding was right and the question was wrong — ✏️ **the gap is a missing POSITION, not a missing row.** This is the position #238 exists to serve, and it has no description to hand anyone.
🔴 **On-site maintenance — CUTO.** He lives on site at LAWNS, does the maintenance and the handy work, **and does not speak English.** He is not crew and he is not the production manager. There is no set that describes him, and the document this capability produces is one he cannot currently read.
🔴 **Whatever customer two turns out to have** — named as unknown rather than guessed at. A second business is the only thing that can separate *this is how nurseries work* from *this is how LAWNS works*, and until one exists that distinction is unmeasured.
⚠️ **This is evidence ABOUT the sets, not a defect IN them.** Nothing in the workbook is wrong; it is incomplete in a way only a second look could show — and ✏️ **a count-based check is structurally blind to it.** Adding `INV-01` to the drivers would have left every set holding a plausible number and the count probe green. `MISSING_STARTING_POINTS` (in `positionStartingPoints.ts`) declares all three and **self-prunes**: an entry whose key has since been built is stale and FAILS the build, so whoever writes the yard-hand set has to come back and strike the line. _Grounded: ledger #245, `5c21182` — declaration + probes F13/F13b/F13c/F14/F14b/F15, 4/4 mutants._
🔴 **DO NOT ASSUME ONE LANGUAGE PER TENANT, and Cuto is the counter-example INSIDE one business.** Two stories are being filed against this by David — **a Spanish-language interface where the choice is made BY THE PERSON, on the invitation screen**, and the on-site maintenance position itself. ✅ Measured 2026-08-31 so nobody re-derives it: **nothing in this repo assumes one language per tenant today** — there is no language or locale column on any business table, and the only hardcoded locale in the positions feature is `positionDescription.ts`'s `toLocaleDateString('en-US', …)`, which sits at the **DOCUMENT** layer, i.e. exactly where a per-person choice will need to reach it. **A tenant-level language setting would be the wrong shape and would have to be undone.**

### Know what my job is — a position gets a description before a person gets the job
STATUS: needs-input
SCOPE: platform, vertical:cultivar
BUILD: in-build
ARC: identity-roles-sec
MAPS-TO: —
PIECES: responsibility_catalogue, position_picker, position_description_doc, business_context, position_starting_points, context_proposal
NEEDS: Lauren's corrections to David's four hand-written descriptions — **her reaction to that paper is the specification**, and until it comes back the acceptance bar is asserted rather than met. Also owed: whether `settings:update` is the right write gate (Thunder's derivation, flagged for overrule); **the workbook the per-role responsibility sets came from** (#241 derived them from the catalogue and tuned to David's stated counts, because it is not in the repository); and whether an identity read should feed the context proposal automatically (the crawl exists and is deployed — see the correction below).

⚠️ **FILED WITH `STATUS: needs-build`, WHICH IS NOT IN THIS BOARD'S VOCABULARY — corrected to `needs-input` at filing, and the recurrence is recorded rather than the instance.** `needs-build` is **[[R-26]] instance 1**: three stories carried it, it was absent from the documented six values and from the renderer's filter, and all three went unreachable on the owed view. It was written again on 2026-08-31, by the same person, ten weeks later. **A vocabulary that is documented in prose and enforced by nothing gets retyped** — the mechanisable fix R-26 already names (derive the filter from the data unioned with the declared enum) is unbuilt for this board.

🔴 **THE PROBLEM IS NOT A PERMISSIONS PROBLEM, AND THAT IS THE WHOLE INSIGHT.** LAWNS has **no written position descriptions at all**. Joel arrives as operations manager with nothing to hand him; Tyler arrives as external sales the same way. And when the system asked who should be able to do what, **everyone became an owner** — not from laziness, but because **configuring permissions asks a harder question than the one they could not answer.**

**THE INVERSION: ask what a person DOES.** Every owner can answer that. Lauren ticks what a position is responsible for and how often, gives it a title, and gets a description she can hand to the person — **so they know what their job is.**

⚠️ **RULED CORE, not a paid tile** (David, 2026-08-31). If role configuration sits behind a paywall, unpaid tenants have bad permissions — which is exactly how LAWNS ended up with everyone an owner. The printable description and the later gap analysis may be packaged separately; **the picker and the derived permissions may not.**

**What the platform must NOT ask for, because it already knows:** days closed lives in `business_operating_days` and is READ onto every description; headcount is counted from `business_members`; name, address, phone and website are on `businesses`. The context form is **three boxes**, and the subtraction is the feature — asking an owner to retype what they already told us is the labour inversion TRACE exists to end, aimed at TRACE.

**The bar is not "it renders".** It is: *would Lauren hand this to Joel on Monday?* A generated document that reads as filler teaches the person the feature is decoration, and that is harder to undo than not shipping it. Two things carry that weight and only this business can supply them: the operating rhythm, and **the owner's own sentence about what doing the job well looks like here**, quoted verbatim and never rewritten.

**Built 2026-08-31 (#240) — BUILDER-COMPLETE, owner-proof OWED:** the 93-row catalogue (ten areas, 77 core / 16 nursery), the three marks derived from the manifest (SENSITIVE · CANNOT BE DELEGATED · NO CAPABILITY YET, all in consequences and never in permission strings), the picker at `/admin/positions`, and the printed description. **It creates no role and grants nothing.**

🔴 **NOT BUILT, AND EACH IS OUT OF SCOPE FOR A NAMED REASON, NOT AN OVERSIGHT:** the permission PREVIEW (R-22 Stage 2 is OPEN, so no role can be created by anyone but the account holder anyway) · the *"what nobody holds"* gap analysis (it needs two positions to say anything, and there were none).

🔴 **CORRECTED 2026-08-31 (#241) — *"any website scrape"* WAS THE WRONG CONCLUSION FROM TWO TRUE FACTS.** `AIEngine.ts` IS dark and there IS no `api/ai/*` route — both correct, and both left standing. But *a website identity read* does not depend on either: **`runIdentity` and `runAnalysis` (`shared/src/discovery/engine.ts`) extract exactly these fields from a live site — `businessName`, `location`, `yearsInBusiness`, `staffSize`, `servicesFound`, `certifications`, `tone`, `strengths` — and they are WIRED AND DEPLOYED** on the default path of `api/discovery/ingest.ts:176-179`, one of the twelve live functions, keyed on `ANTHROPIC_API_KEY` with an explicit refusal when it is absent. ✏️ **This is R-26's shape with a twist worth naming: the facts were true and the conclusion drawn from them in the same sentence was not** — it named the two places a scrape ISN'T and inferred there is none. **What is genuinely missing is smaller than "its own build": the mapping from a `BusinessIdentity` to the three owner-facing sentences, and somewhere to keep it** — `business_discovery_profiles.raw_extract` is NOT that place (it holds the product catalogue, `{items, counts}`, written by `populate.ts:328`, unique per `source_url`). ⚠️ **No URL was fetched in #241** — the scope bar forbade it, and this is a repo measurement, not a live run.

**Extended 2026-08-31 (#241) — NEVER SHOW A BLANK PAGE, and the finding is that the flow was the defect rather than the rendering.** The first live run created "Production Manager", met 93 rows with nothing pre-selected, ticked nothing, and got a document reading *"Nothing has been ticked for this position yet · 0 responsibilities."* **A list of 93 with nothing selected is a blank form, and the whole story exists because blank forms do not get filled in.** Four pieces: **starting points** that pre-tick a set the owner adjusts (offered, **never inferred from the typed title** — "Production Manager", "Operations Manager" and "Yard Manager" are one job and a string match would be wrong silently); **ten collapsed areas** with per-area tick counts and a running total, collapsed but **never filtered**, because part of the value is reading a responsibility and realising nobody does it; a **proposed business context** with its source shown beside each value and **nothing written until the owner saves**; and an **empty description that does not offer itself as a document.** ✅ **The read-don't-ask rule worked on its first outing and that is the harder half** — the week's shape rendered from `business_operating_days` rather than being asked for.

⚠️ **STILL OWED, AND IT IS THE SAME ITEM AS BEFORE:** Lauren's corrections. **And now a second: the starting sets' MEMBERSHIP is Thunder's derivation, not the workbook's** — the counts are David's measurement, the workbook is not in the repository, and the sets were tuned until each hit its stated count, so *the matching counts are not evidence the membership matches*.

---

### Hand over the keys — the owner role outlives the person who opened the account
STATUS: written
SCOPE: platform
BUILD: in-build
ARC: identity-roles-sec
MAPS-TO: —
PIECES: owner_role_access, invite_funnel, roster_read, owner_role_authority, owner_id_protected
NEEDS: nothing from David — ruled 2026-08-28 in full. Stage 1 (ACCESS) is BUILDER-COMPLETE and owner-proof is OWED; Stage 2 (AUTHORITY — an OWNER-role actor may assign roles) is a separate commit and not yet built.

David is the account holder at LAWNS and he is not going to be the one running it. **Lauren is.** She is the manager who feels the pain, she holds the OWNER role, and until 2026-08-28 that role was a badge: the client computed her full permission set and the database refused her on three surfaces, because the fences were on `businesses.owner_id` — **a single column that names ONE person and cannot describe a business with two owners, a departure, or a succession.** She could read the sell-side menu and not change a price on it. She could not invite anybody. And the team page told her the business had **one member** — herself — so an invitation already sitting there was invisible to her, and she had no way to know it.

David, ruling: _"Currently I'm the owner. Lauren needs all perms and authority to act. So changing a role from manager to owner is a decision the owner makes, then the new 'owner' can administer the system and assign all roles. Once the 'owner' leaves a new 'owner' can be promoted. If the original owner_id departs someone has to take that place. So the perms need allow the role to assume the perms within that role."_

**So `owner_id` stops being an authority mechanism and becomes what it should always have been: the account holder of last resort.** Authority travels with the ROLE. What that has to survive is the ordinary thing that happens to every small business — the founder steps back, someone else runs it, and nobody wants to phone the vendor to get a password changed. This is the same ruling as [[2026-07-30]] (_permissions are always checked; the owner holds every enforced permission, computed, locked_) followed one step further: **that one made the owner pass the check like everyone else; this one lets the check reach everything the role is supposed to hold.**

Two stages, deliberately split — ACCESS before AUTHORITY, so that every act which CREATES an owner goes through one audited door rather than arriving early through an invite:
- **① ACCESS (built 2026-08-28).** Member policies for the three refused surfaces: `service_offerings` INSERT/UPDATE, `invitations` SELECT/UPDATE, `business_members` SELECT. `team:create` and `service_offerings:create/update` flip from declared-unwired to enforced — **and the flip is only half the change**, because `has_permission()` reads a STORED array while the client computes from the manifest, so the same migration re-materialises every OWNER-role member through the funnel (54 → 57 strings). Invitations move behind `create_invitation`, a SECURITY DEFINER RPC that resolves the invitee's permission array server-side instead of accepting one from the browser.
- **② AUTHORITY (not yet built).** `save_role_permissions` and `assign_member_role` accept an actor who holds the OWNER ROLE, not only `businesses.owner_id`. **One guard: no actor may change the role of the `owner_id` holder** — without it the delegate can demote the account holder and lock the vendor out of a live customer's tenant.

**Three roster controls stay with the account holder and say so on screen** — Remove, Deactivate, Set-phone are direct writes fenced on `owner_id`, and shipping the roster READ without locking them would have handed Lauren a full team list with three buttons that refuse ([[§1.6 item 5]]). They render disabled with the reason, not greyed in silence. _David, 2026-08-28: `removeMember` and `setMemberActive` are ACCESS CONTROL, not data edits — they belong in the funnel beside `assign_member_role`. That is the next move, not this one._

---

## ARC: asset-inventory-pmi

_Assets → inventory → walk-and-count → preventive-maintenance schedule → service log._

### Operator scan — one shape, two endings (count or sale)
STATUS: written
SCOPE: vertical:cultivar, platform
BUILD: active
ARC: asset-inventory-pmi
MAPS-TO: 2.3, 2.1
PIECES: operator_scan, scan_resolve_ladder, size_pick, qty_entry, tag_printing
NEEDS: nothing to decide — the model is settled ([[D-34]] anchor, [[D-53]] resolve). The ONE gap is a BUILD: nothing in the platform PRINTS a tag.
Lauren stands in the lot with her phone, signed in. She scans a tag, picks a size, sets a quantity. **That is the whole shape, and it is the SAME shape whether the walk ends in a count or a sale — because it IS the order path.** The lot is the SKU ([[D-34]]), size is a variant of it, and qty is the count. What differs is only the ENDING, and both endings are operator-initiated: a **COUNT** (walk-and-count on the phone, reconcile at the desk — see "Count the lot without paper" + "Count promotes size + qty into inventory" below) or a **SALE** (the counter flow that exists today — see "Ring up the sale" in ARCHIVED). The resolve in the middle is URL-agnostic and column-agnostic by design: strip the URL, keep the identifying part, run the ladder — specimen tag → lot SKU → variety name → size-picker ([[D-53]]). Capture and count never touch the customer-facing URL. **STATUS: BUILT. This is the flow that works, and the one the demo shows.** 🔴 **The one gap, and it is a real one: nothing in the platform PRINTS a tag.** `generatePlantQR` and `printQRLabel` exist in `packages/shared/src/qr/` with **zero callers** — the only live QR consumers are team-invite and profile links. Every tag Lauren scans was produced outside TRACE. (Latent, if that generator is ever wired: `generatePlantQR(plantId)` builds its URL from an **id**, while the route and every resolver lane key on a **tag/sku**.) _Grounded: `scanTag.ts` (the strip), `stockLineResolver.ts` L2/L4/L5 + the callers' L1 (the ladder), `usePlant.ts`, `InventoryCount.tsx`; [[D-53]] captured 2026-08-01, ruled 2026-06-18; [[D-34]]. This story exists to state the ONE shape that its two ending-stories share — it does not replace either._

### Count the lot without paper
STATUS: needs-input
SCOPE: vertical:cultivar
BUILD: in-build
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: inventory_count, inventory_count_offline
NEEDS: David to expand into full day-in-the-life prose.
_Placeholder (David to expand into full day-in-the-life prose)._ The manager walks the lot with a phone, scanning each plant's QR tag, entering the on-hand count, saving, and moving straight to the next — until the lot is counted and a session summary closes it out. The loop must never dead-end: an unreadable tag falls back to manual entry, an unrecognized scan is handled gracefully (quick entry or skip-and-flag) rather than stalling. Counting in a field with no signal must still work (offline). _Grounded in ledger #54 — the scan→resolve→qty→save→next→complete loop is BUILDER-COMPLETE; the offline piece is still ahead._

### A quantity that means something — the unit of measure behind `size`
STATUS: written
BUILD: in-build
SCOPE: vertical:cultivar, platform
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: unit_taxonomy, unit_parse, unit_projection_guard, unit_backfill, multi_unit_family_flag
NEEDS: Lauren to answer whether compost is STOCKED in yards or in buckets — that fact, and only that fact, unlocks conversion. Joel/Lauren to resolve the trade codes the parser refuses (`3GP`, `1DP`, `2DP`). David to rule whether LAWNS's 447 existing rows are REPLACED by the QuickBooks catalogue or reconciled with it (the backfill is re-runnable either way).
As a grower, when I record 300 of something, I want the system to know whether that is 300 buckets, 300 yards or 300 bags — so a count means something, a price can be computed, and selling a yard of compost does not leave the bucket count untouched.

**WHY NOW.** LAWNS's real catalogue carries at least six unit families — container gallons, yard scoops, weight bags, liquid bottles, by the roll, and kits of N. `business_inventory.size` is free text built for exactly one of them (container gallons; its own migration says so). The QuickBooks import is about to write 685 items and would put every one of them into that field, where each would then have to be redone.

**THE CASE THAT DEFINES IT.** Fertile Compost Mix sells as a 15, 30 and 45 gallon bucket AND as a half-yard and a full-yard scoop — `FCMB15` / `FCMB30` / `FCMB45` / `SFCM1` / `SFCM2`. One pile of compost, five sale units, and a yard is roughly thirteen 15-gallon buckets of it. Regular Compost Mix is the same five. This story RECORDS the units and FLAGS the family. It does NOT reconcile them: reconciling needs a fact nobody has — whether compost is stocked in yards or in buckets — and that is Lauren's to answer, not ours to default.

**THE RULE THAT MAKES IT SAFE.** The unit columns are a PARSE OF `size`, never a parallel truth. `size` remains the stored value (D-23 — never rewrite what the grower stored). The unit columns are DERIVED from it on every write, are never independently editable by anyone, and `unit_parsed_from` records the exact string they were computed from so the projection can prove itself. Change `size` without a fresh derive and the projection NULLs itself rather than describing a string that is no longer there.

**NOT THIS STORY** — named so they are not folded in by accident: conversion between units of one product · product grouping so five compost SKUs are one thing · stock held in a base unit with sale units deriving from it. The first of those is the per-size unit-multiplier hook already named in *Count promotes size + qty into inventory* below, and it is still owed there.

_Neighbours, cross-referenced deliberately and NOT folded into: **Count promotes size + qty into inventory** (below) carries the per-size unit-multiplier hook — the WANT half of this; and **The growing ladder — potted, waiting, ready, and up a size** (`needs-input`) is waiting on Joel for the container sizes in order, which a closed container taxonomy feeds. Grounded: Stage 0 recon 2026-08-30 — 25 production readers of `size` across 22 files, 12 of them deciders; ledger #234._

### Count promotes size + qty into inventory (the count IS the catalog)
STATUS: written
BUILD: in-build
SCOPE: vertical:cultivar
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: size_picker, need_clarification_seam, count_promote, resolve_before_create
NEEDS: OWNER-PROVE (D-45). The count-side size-picker (L5 NEED_CLARIFICATION seam) is OWNER-PROVEN (ledger #72) — the old "gating landmine" is CLEARED.
Lauren walks the lot with a per-variety QR on each variety (the SAME QR across all its sizes). She scans Shoal Creek Vitex, the app resolves the VARIETY, she taps "30 gal" (or types it — a free label) and enters 45. Save. Scan the same tag, tap "45 gal", enter 12 — a SECOND stock row is born under the same variety. When she opens the inventory grid or rings up an order, BOTH sizes are there at their prices, because the count didn't just log a number — it PROMOTED size + qty into a `variant_group`-keyed `business_inventory` row (create-or-update), the one store the grid and the order picker actually read. A variety she's never seen, typed by hand with no QR, resolves to the right existing variety even if she spells it a little differently (token-set equality) instead of orphaning into duplicates. Nothing born unsellable-silently: a new size starts needs-price (the cart refuses $0), never a fabricated price. _Grounded: D-45 (`docs/decisions/2026-07-14-count-promote-D45.md`), ledger #124 — closes the count-size-persist bug (buildspec item 4, never shipped) + the `variant_group` orphan-read; reuses the #61 token-set resolver + the #72 size-picker (now folded into the review size-control). Built 2026-07-14, BUILDER-COMPLETE, owner-proof owed. HOOK named not built: per-size unit-multiplier (a "flat" = N plants)._

🔴 **CORRECTED 2026-08-30 (ledger #238) — THIS STORY WAS ONLY TRUE FOR SOMEONE HOLDING `inventory:update`, AND NOTHING SAID SO.** The promote's `variant_group` write — the *"BOTH sizes are there"* half, the whole point of the story — was a plain UPDATE on `business_inventory`, a table gated on `inventory:update`. **A STAFF member holds `inventory:read` and not that.** An RLS-refused PostgREST update matches **zero rows and returns no error**, so nothing failed and nothing was said: the count landed, the family was never keyed, and **the next scan resolved UNKNOWN** — which is precisely the *"orphaning into duplicates"* outcome this story exists to prevent, arriving through a door nobody had looked at. Now resolved server-side by `count_group_variant_sizes` (`20260830c`), membership-gated like the two RPCs already on this screen, setting that column and nothing else. ✏️ **The lesson for the board, not just this story: a story written about *what the system does* is silently scoped to *who was testing it*.** Every surface here had been proven by an owner. **NOT YET ON THE BOARD AND OWED — the role story itself:** *a staff member counts and the manager reconciles*, which needs blind capture (tech-debt #67) to be true at all, since the count screen applies itself at capture today. File it with that build.

### Assets + camera capture (Andrew's branch) — and the local-storage distinction
STATUS: needs-input
SCOPE: vertical:cultivar, platform
ARC: asset-inventory-pmi
MAPS-TO: —
PIECES: asset_capture, camera_pipeline, offline_store_push
NEEDS: David to clarify the local-disk-vs-offline-push distinction + the camera-production story before merge.
_Coverage placeholder, not a fabricated scenario._ Andrew's `assets` branch (ledger #69) adds a camera capture tool, currently `localhost:8000` + local-disk (tech-debt #41, 12-fn ceiling). Two different "local storage" ideas need to be told apart: a **dev-only local-disk pipeline** vs **offline-store-then-push** that reconciles to central Supabase truth — and the latter is a **PLATFORM pattern** (the same sometimes-connected sync the walk-and-count loop already uses), not just Cultivar. The production camera story is owed before the branch merges. → `docs/decisions/2026-06-29-assets-branch-review.md`.

### Receive the truck
STATUS: needs-input
SCOPE: vertical:cultivar
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: inventory_truck, inventory_invoice, inventory_receipt
NEEDS: David to expand into full day-in-the-life prose.
_Placeholder (David to expand into full day-in-the-life prose)._ A delivery truck arrives; the owner checks what physically came off it against the vendor's invoice, captures the invoice/receipt image, and lands the received stock into inventory — so what's on the shelf and what was billed line up from the moment the truck pulls away. This is the OCR-intake sibling the count loop's ledger note (#54) flags as NEXT.

### Reconcile counted vs expected
STATUS: needs-input
SCOPE: vertical:cultivar
ARC: asset-inventory-pmi
MAPS-TO: 4.2
PIECES: inventory_reconcile
NEEDS: David to expand into full day-in-the-life prose.
_Placeholder (David to expand into full day-in-the-life prose)._ After a count, TRACE compares counted-on-hand against what the books expected and surfaces the difference — sold, dead, or missing — so shrinkage and miscounts become visible instead of silently eroding margin. The count loop (#54) deliberately shaped its record model so reconciliation can read it later; reconciliation itself (the 4.2 double-whammy) is deferred and not yet built.

### Reconcile the count against the ledger — leakage becomes arithmetic
STATUS: needs-input
SCOPE: platform, vertical:cultivar
BUILD: active
ARC: asset-inventory-pmi
MAPS-TO: 2.3, 5.1
PIECES: inventory_movement_ledger, count_as_reconcile, reconcile_reader, blind_capture_mode
NEEDS: two BUILD inputs owed before/at build (the D-50 decision itself is made): (1) where the REAL actor comes from on the service-key and offline-sync write paths; (2) confirm blind-capture ships as a per-session mode, default blind.
Lauren walks the lot and counts; the number she enters is a physical fact, dated to this walk. The system replays every movement since her last count — receipts added, sales subtracted — to show what the book says should be on hand. Where physical and book agree, the row is done. Where they differ, the system does not guess: it shows the gap, bounded to the window between the two counts, with every actor who touched that row in between, and Lauren accounts for it — 4 dead, 3 unexplained loss — each becoming a permanent, un-editable ledger line. Six months later, "why did we lose 7 Vitex in March" has a dated, named answer. Because the ledger cannot be altered, the trail of who-touched-what can't be quietly cleaned up before the owner looks — so shrinkage stops being a vibe and becomes arithmetic. _Grounded: D-50 (`docs/decisions/2026-07-19-inventory-movement-ledger-D50.md`); amends D-45; the count tables (`20260626`) become readers-plus-reconcile; the D-42 decrement (`submit.ts:792`) becomes a ledger emit point._

### The log that proves what happened outlives the log that proves what's on hand
STATUS: needs-input
SCOPE: platform
BUILD: active
ARC: asset-inventory-pmi
MAPS-TO: 2.3, 5.1
PIECES: event_log_source_of_truth, audit_log_retained, dual_write_on_discretion, snapshot_compaction (later), audit_retention_policy (later)
NEEDS: build input — confirm which discretionary acts dual-write to audit_log at split time (delete is in; override / tier-change / permission-change to confirm).
The system keeps two records. One is the truth of what's on the shelf — every movement, replayed to a number, checkpointed and archived as it grows so it stays fast without ever losing the state it computes. The other is the truth of who did what — the deletes, the overrides, the price changes — kept for years, never folded away, because when something looks wrong months later the question is not "how many" but "who, and when, and why." A routine sale touches only the first. A deletion touches both: the stock left (state) and someone chose to remove it (accountability). Split into two tables now, while it is test data and free, so the live system customers depend on is born correct and never needs a migration under load. _Grounded: D-51; extends D-50._

### A plant sold isn't a plant gone — on-hand, committed, available
STATUS: needs-input
SCOPE: platform, vertical:cultivar
BUILD: active
ARC: asset-inventory-pmi
MAPS-TO: 2.3, 5.1
PIECES: committed_state, decrement_at_fulfill, available_derivation, walkin_collapse, oversell_on_available, pending16_remediation
NEEDS: build input — how committed is stored (derived from open orders vs a stored column); the 16-pending remediation approach.
When a customer buys a tree for delivery next week, the tree is sold but still in the yard — watered, moved, insured, and physically present. The books have to know all three things at once: what's on the property (on-hand), what's promised (committed), and what's still sellable (available). A new customer sees only available, so the promised tree can't be sold twice. On-hand drops the day the truck rolls, not the day the order is written — which is also the day the walk-in pays and drives away, the two just happen together for him. The gap between promised and gone is a real interval the owner can measure: how long did this sit, and why. _Grounded: D-52 (industry standard: Shopify/Oracle/Dynamics/ERPAG/Sellbrite); supersedes D-42 timing; the fulfill-time on-hand decrement is what reconcile (D-50) dates against._

### Inventory — the grower with no system (the count builds the catalog)
STATUS: written
SCOPE: vertical:cultivar, platform
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: inventory_count, catalog_accrete, name_pick_fast, voice_capture
The grower who has **no system at all** — name-only stock, no SKU, no QR, stock "tracked in their heads" — is the **~88% case, confirmed in the field at Barryhill** (a 4.5★ full-service garden center: "no official inventory system," the POS is sales-only and never decrements, "QR is not even set up"). For them we do **not resolve** an existing structure — we **CREATE** it, one scan at a time: **the walk IS the structuring** ([[OP-10]] structure-last). There's no QR to scan, so the loop asks **"what is this?"** → the grower **types or says the name** → the first time, that **creates the catalog entry** (`catalog_accrete`); the next time, it's a one-tap recently-used button. **QR comes AFTER, not before.** This runs on the **same screen** as the structured grower — the unknown/name branch is the *exception* for LAWNS but the **normal path here**. Make-or-break: nobody thumb-types 400 names in the sun, so the **name path (autocomplete / recently-used / voice) must be fast enough to BE primary**, not a fallback. _Grounds: ledger #61 (L4 token-set resolve) is the structured-grower path; this is its no-structure sibling — the catalog-accrete + fast-name-pick pieces are the build-out._

### Inventory — the real spoken-count spec (Billy Bob + the messy walk)
STATUS: written
SCOPE: vertical:cultivar
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: voice_capture, catalog_accrete, name_pick_fast, inventory_count
Built from **two real spoken walks**, this is the spec for counting a lot **by talking**. The clean walk — **Billy Bob at Lucy's Nursery, tidy rows** — gives the arithmetic grammar: **carton/multiplier math** ("six cartons of six" = 36, the trade's multiple-by-class unit from [ontology §4](../docs/domain/ontology.md#4-sourcing)); **running tallies** ("4, 6, 8, 12, 16" → 16); **self-correction** (last value wins); **uncertainty markers → confidence** ("should be" / "look like" → ESTIMATED on the [[D-9]] ladder); **out-of-order, keyword-anchored** parse; the **pot-size lifecycle ladder**; **resolve-by-sight**; and **counting = truth, pricing = later**. The **second walk — tomato/citrus, messy-real** — adds the hard parts: an **unidentified-pending state** ("four I don't know yet"); **location-spanning tallies** (same variety here + in the greenhouse, summed); a **lost-tag-with-reasoning** recovery ("tag's gone but it had to be a pollinator pair" → domain knowledge recovers identity — the [NORTH STAR §4](../NORTH-STAR.md) reason-in-the-gap move); a **4-level IDENTITY-confidence ladder** (CONFIRMED → DESCRIBED-by-fruit → TAG-READ-brand → UNKNOWN); an **estimated-size flag** ("looks like a gallon or so"); **task-capture mid-count** ("need to buy water today" — a stray thread caught, [NORTH STAR §2](../NORTH-STAR.md)); and **ambiguous terms** ("Oliveira plants" — captured as spoken, **flagged, not assumed**). **Design calls:** preserve the **arithmetic** ("6×6=36", not just 36); `voice_capture` is a **PROMOTE** from the Ignition tech-notes voice path, routing the name through the §2 token-set resolver and the size through the grower's own size list into `catalog_accrete`. **CARDINAL REQUIREMENT (field lesson):** a real two-speaker capture (the Barryhill conversation) had **NO speaker separation**, so turns were unrecoverable — `voice_capture` **must handle speaker/turn**; capture must **never silently drop or mis-attribute** what was said.

**🔴 DESIGN CALL (2026-08-23) — THE TWO TALLY CLAUSES ABOVE ARE BOTH CORRECT, THEY ARE DIFFERENT ACTS, AND THE DISCRIMINATOR IS *PLACE*.** Lauren's question — *she counts 3, finds 6 more, finds 5 more: does it make 14, or does it replace?* — is answered by this story twice, and the two answers do not conflict. **A running tally** (*"4, 6, 8, 12, 16" → 16, last value wins*) is **one person counting up in one spot**: each number restates the total so far, so the last one IS the total. **A location-spanning tally** (*same variety here + in the greenhouse, summed*) is **the same variety found in two places**, so it adds. **Lauren's walk is the second act at fine grain** — same row, different clumps — which is why the running-tally reading gets it wrong. **The application cannot know which act she is performing**, because both look identical at the keypad: a second number typed against a lot already counted. **So it must ASK — and the conflict sheet ALREADY DOES.** What it is missing is a third option: it offers **REPLACE** (the running-tally reading) and **KEEP** (abandon the new number) and has **no ADD**, so the one act this story explicitly specifies is the one the sheet cannot express. **The build adds ADD to that sheet.** ⚠️ Two things ride with it, recorded here so they are not rediscovered: **(1)** the sheet's *"first count"* label goes FALSE after the first recount — on her third pass it reads *"first count 6"* when 6 was the second (tech-debt **#93**); **(2)** the ledger takes **ONE row at session close** carrying whatever she chose — the three passes are session detail living in `inventory_counts`, not three ledger events (**R-A, ruled 2026-08-23**). _Grounds: recon [count-session-multi-pass-recon-2026-08-23](../docs/audits/count-session-multi-pass-recon-2026-08-23.md); ledger #198 · #205._

---

## NEEDED — cross-cutting (no single build-arc)

_Owed items that don't belong to one of the 8 build-arcs. They render under "Unfiled" but surface in the WHAT'S OWED view and the status/scope filters._

### No form ever fails silently — validate required fields, say why, everywhere
STATUS: written
SCOPE: platform
BUILD: active
MAPS-TO: —
PIECES: required_field_validation, modal_centering, forms_audit_backlog
NEEDS: convention A ("always center") is now adopted for the datasheet-add camp — Add Inventory/Customer/Asset centered 2026-07-09 via the shared `sheetStyles.modal` lever. Residual retrofit backlog: the own-copy bottom-sheets (OperatingCosts, ProjectsManager, InventoryCount) + the 3 open validation surfaces (OnboardingWizard nursery step, CustomerEditModal, ProjectsManager/ReceiptKeeper to confirm).
The standing quality rule made concrete: when an owner saves a form with a required field empty, the app BLOCKS the save, HIGHLIGHTS the offending field, and SAYS WHY — never a silent reject and never a greyed-out button that won't explain itself (the exact defect: saving a service with a blank Price failed silently; a $0/free service needs 0 typed, blank ≠ free). The paired rule: modals are CENTERED, not off-center (David: "why isn't the centering standard applied always?" — the Add Inventory modal was a bottom-sheet). **Reference implementation shipped 2026-07-09:** the Settings service editor now blocks + red-borders + inline-messages on both create and edit (`validateServiceForm` in `packages/shared/src/pages/Settings.tsx` — other forms copy this shape). **Second application 2026-07-09:** the Add Inventory create form adopted the same pattern — required `sell_price` (D-35, so nothing's born unsellable) blocks + red-borders + inline-messages (`validateInventoryForm`/`errBorder`/`FieldError`), and the shared datasheet-add modals were centered (convention A). **Backlog:** `docs/decisions/2026-07-09-forms-and-modals-compliance-audit.md` — 16 surfaces rated on BOTH axes; 3 validation gaps (OnboardingWizard nursery step, CustomerEditModal, + 2 to confirm) and the own-copy bottom-sheets remain. Adjacent to the owner-configurable-required-fields story (§ missing-email) — both want a shared field-config primitive, not per-form code. _Grounded: FIX 5 build 2026-07-09; §1.6 pre-flight items 3 + 5._

### On-lot guest scan — presence is the key, and the cart can go to the office
STATUS: needs-input
SCOPE: vertical:cultivar
BUILD: active
MAPS-TO: 2.1, 3.4, 2.2
PIECES: geo_price_gate, tree_qr_lookup, jit_offers, self_checkout, anon_scan_resolve, office_handoff
NEEDS: **the price MODEL is DECIDED — [[D-54]], KEY = LOCATION. Two things remain, both David's:** (1) the geofence **radius + accuracy policy** (an accuracy-unknown read must fail CLOSED — #75's class); (2) **the HAND-OFF MECHANISM** for pay-in-office — the flow spec names three candidates and picks none (order queue on submit · Lauren searches by name/number · a code the customer shows). Open since 2026-06-03. No commerce arc exists (—).
A customer parks at LAWNS, wanders rows of trees, scans the QR on one — TRACE tells them about it, and **because they are standing in the yard, the price shows: presence IS the key** ([[D-54]], KEY = LOCATION; the sibling story below uses KEY = REGISTRATION, and they are siblings, not rivals). They cart it as they walk, keep browsing, then choose pickup or delivery. Just-in-time offers ride along: pickup surfaces netting + fertilizer; delivery opens the schedulable slots. **Two endings: pay online in the app, OR HAND THE CART TO THE OFFICE** — where Lauren adds relationship detail and closes it at a kiosk. 🔴 **STATUS: UNBUILT AT BOTH ENDS, precisely:** **· ENTRY —** `usePlant.ts:137` gates the stock-line lane on `if (businessId)`, so an anon scan falls through to `cultivar_plants`, which is **EMPTY platform-wide and has no application writer** (the discovery flow deliberately does not populate it — `populate.ts:39-42`, writing per-specimen rows off a bare domain would be fabrication). **A guest scan can only ever return "not found."** **· EXIT —** *"I'll pay at the office"* (`CartReview.tsx:646-650`) **is a STRING.** `payOnline` never reaches the server — it rides in `navigate()` state and picks one of two lines on the confirmation screen (`Confirmation.tsx:267` *"See you at the office!"*), while `useSubmitOrder.ts:193` hardcodes `payOnline: false`. **Both buttons perform the identical server act: create the order and push a QuickBooks invoice. There is no unpaid state, no hand-off, no kiosk, and nothing that later marks an order paid** (order status is set by TRANSPORT, not payment — `submit.ts:697`, D-52). **· MIDDLE —** the five checkout screens ARE built and ARE public routes (`router.tsx:91-97`); what exists is the counter flow (see "Ring up the sale", ARCHIVED), where the person tapping the button is STAFF and issuing the invoice on the spot is correct. 🔴 **And the price gate runs BACKWARDS today** — price renders on screen 1 of 5 (`PlantHero.tsx:88`, `PlantProfile.tsx:145`) while `CustomerCapture` is screen 3; no geofence exists anywhere. _Grounded: flow spec §6 (the 14-step flow + the pay-in-office sub-flow + its own open sync question) and §9.4; [[D-54]] (captured 2026-08-01, ruled 2026-06-03); [[D-53]] (the resolve is not the problem — the anon gate is)._

### Remote browse — register to see the price, then build a cart
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
MAPS-TO: 2.1, 5.6
PIECES: registration_price_gate, cart, jit_offers, delivery_or_pickup
NEEDS: **the price MODEL is DECIDED — [[D-54]], KEY = REGISTRATION (name, address, ZIP).** Still David's: the origination fork (does this cart create the order upstream of QBO — the banked inversion). The "minimum details" question is CLOSED by D-54.
A customer **not on the property** browses the LAWNS catalogue — they see the plant, the care information, and the size options, **but NO PRICE**. The move: a light registration (**name, address, ZIP**) is the KEY that unlocks price and moves them into a cart ([[D-54]], KEY = REGISTRATION; the on-lot sibling above substitutes physical presence for exactly these details). There they accept the price, pick add-ons (netting, fertilizer), and choose delivered / delivered-and-planted / pickup — every option a just-in-time cost surfaced BEFORE checkout, not after. On submit it routes to fulfillment. 🔴 **STATUS: NEEDS-BUILD — the screens exist, the gate does not, and price currently renders FIRST.** `PlantHero.tsx:88` and `PlantProfile.tsx:145` render price on screen 1 of 5 while `CustomerCapture` is screen 3 — **the inverse of this story.** US-001's acceptance criteria (`CULTIVAR_OS_USER_STORIES_AND_DEMO.md:29-46`) demand unconditional price on the scan page, and that older story is what the current code was built to; it predates [[D-54]] and is superseded by it on this point. The flow spec said so about itself in June: *"The pricing gate (cart required before prices show) is new behavior not yet implemented."* → 2.1 (cart) + 5.6 (online shop, stub). _Grounded: flow spec §5 steps 5-6; [[D-54]]._

### Contractor / tier pricing — set a tier, the discount actually comes off
STATUS: needs-sub-stories
SCOPE: vertical:cultivar, platform
BUILD: active
MAPS-TO: 3.7, 2.1
PIECES: tier_discount_apply, tier_assign_ui, tier_discount_map, contractor_program
NEEDS: **nothing to DECIDE — two things to BUILD.** (1) **config** — an owner surface to set the per-tier % AND to ASSIGN a tier to a customer; today `customers.price_tier` is DISPLAY-ONLY (Customers.tsx:141-142) and no assignment UI exists at all. (2) **program** — the full "Become a Contractor" register→verify→approve→notify→paid flow (§3/§4, all net-new, not demo-critical). *(The MECHANISM is settled — see the body. It used to be stated in this NEEDS line, which is why this story read as open at a glance.)*
🔵 **SETTLED, DO NOT RE-DERIVE:** the tier math is **[[D-55]]** — PERCENT-OFF-BASELINE, owner-set per tier, default 0% (retail=0, contractor=10 owner-editable, wholesale owner-set), off the stored `sell_price` ([[D-35]]). WHO decides a tier is **[[D-38]]** — flat, owner-managed, manual promote/demote, **no progression engine**. How the discount RENDERS is **[[D-39]]** (an explicit line, never a netted price), persisted by [[D-43]]. Both D-55 and D-38 were numbered 2026-08-01, having been decided 2026-07-09/07-10 — *the decisions were never in doubt; their register rows were missing, and "DECIDED 2026-07-08" buried in a NEEDS line beside `STATUS: needs-sub-stories` read as open.*
Umbrella for the contractor-discount thread — the piece that makes "contractor pricing" real. "Contractor" is NOT a new entity: it's a customer `price_tier` (retail | contractor | wholesale), and the column already exists (customers, 20260625_person_spine.sql:106 — NOT NULL default 'retail', no CHECK / AC-4). Three separable layers, only the plumbing half-built and the pipe capped:
- **MECHANISM (the AC-4 hold, now decided):** at checkout the tier's percent comes off the stored `sell_price`. Today submit.ts READS the tier and logs it but applies NOTHING (submit.ts:72-77, and :137 `unitPrice = serverSellPrice; // tier HOLD`). DECIDED: percent-off-baseline. The proven arithmetic already lives in the shared MarginEngine — `tierDiscount` + `price × (1 − discount/100)` (MarginEngine.ts:100-135) — BUT it derives price from COST via slabs, whereas cultivar charges a STORED sell_price, so the reuse is the tiny percent-off step against sell_price (extract `applyTierDiscount`), not the whole engine. This is the smallest, most buildable piece. → 2.1 (checkout) + 3.7 (tiers).
- **CONFIG:** where the % lives + who's which tier. Rides the existing gated `business_pricing_config.config` jsonb (readPricingConfig/writePricingConfig, financialDataAccess.ts:171/199) as a `pricingTiers` key — NO migration. Sub-story: "Set what each contractor tier saves" (below). The tier-assignment surface is a GAP (price_tier display-only — R5).
- **PROGRAM:** register→verify→approve→notify→paid. All net-new (grep-empty). Sub-story: "Come on board as a contractor" (5.7, 3.7, 1.5). Flow detail: flow spec §3 (8-step onboarding) + §4 (monetization A/B/C — ship A free).
_Grounded: as-built recon docs/decisions/2026-07-08-as-built-contractor-pricing.md (R1-R5); submit.ts AC-4 hold; MarginEngine tierDiscount; business_pricing_config + financialDataAccess; flow spec §3/§4._

### Set what each contractor tier saves
STATUS: needs-input
SCOPE: vertical:cultivar
BUILD: active
MAPS-TO: 3.7
PIECES: tier_discount_map, tier_assignment
NEEDS: **the MODEL and the STORAGE are both settled — what is owed is a BUILD and one placement call.** Owed from David: **WHERE the set-% control lives** (likely CostToProduceSettings / Settings) — a placement preference, not a model question. Owed as build: the tier-ASSIGNMENT surface (`customers.price_tier` is display-only today — Customers.tsx:141-142).
🔵 **SETTLED, DO NOT RE-DERIVE:** the math is **[[D-55]]** (PERCENT-OFF-BASELINE, owner-set per tier, default 0%); the model is **[[D-38]]** (flat, owner-managed, no progression); **STORAGE was resolved by recon** — rides `business_pricing_config.config` jsonb as a `pricingTiers` key, **NO migration** (financialDataAccess.ts:171/199). *Tag history, corrected 2026-08-27: re-tagged `needs-input` → `needs-build` on 2026-08-01 to say that the MODEL was settled — **but `needs-build` was never a documented STATUS value** (it is absent from the vocabulary at :37 and from `stories.html`'s filter at :170-177, so the card fell out of every status view), and the NEEDS line above still names an owed decision from David — **WHERE the set-% control lives.** Back to `needs-input`, which is what one owed placement call is. **The 08-01 point stands and is unchanged: the MATH and the STORAGE are settled and must not be re-derived** — the tag is about the placement call alone.*
The owner defines what each contractor tier is worth — each tier maps to a % off all products — and assigns a contractor to a tier. "Contractor" is a customer price_tier, not a new entity (the column already exists), so this is the owner-side management surface on top of it, not a schema change. Set once, it flows to every price that contractor sees and every order they place. The CONFIG sub-story of the contractor/tier-pricing umbrella above. → 3.7 (rides customers.price_tier, AC-4).

### Template-driven service setup — a non-technical owner can't mis-shape a service
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
MAPS-TO: 2.1
PIECES: service_templates, guided_editor, shape_validation
NEEDS: David to decide the template set (delivery / planting / inspection / netting / subscription…) + how prescriptive the guided editor is (pick-a-template-then-tweak vs free-form-with-guardrails) + where it lives relative to the current Settings service editor (#98).
Surfaced 2026-07-08 during the checkout-fixes owner-prove: the Settings service editor (#98) is CAPABLE — it exposes every category + un-conflated price_type/price_unit + category-scoped rule fields — but it is NOT foolproof. A non-technical owner (Terry/Lauren) can still shape a service wrongly: a fused "We deliver and plant" per-plant row instead of a delivery (flat/order) + planting (per_unit/plant) pair (the exact drift the transport workflow FLAGS and best-efforts around — see #97 / lib/transport.ts roles.flags), or a delivery service with requires_address unset so the checkout never demands a ship-to. The move: TEMPLATES — "Add a delivery service" / "Add a planting service" pre-shape the correct price_type/price_unit/transport_mode/requires_address, so the owner fills in a price and a name, not a rule matrix. The editor stays for power users; the templates are the guardrail that makes the demo-data reshape (#97/#98) something an owner does right the first time. → 2.1 (the purchase workflow depends on correctly-shaped transport services).

### Come on board as a contractor — invited, verified, unlock my price
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
MAPS-TO: 5.7, 3.7, 1.5
PIECES: contractor_notify, contractor_verify, tier_assign, paid_access, contractor_portal
NEEDS: David to close (a) demo-safe READ-ONLY pricing view vs full ordering portal, (b) $4.99 who-collects (TRACE/LAWNS) + one-time-vs-recurring + free-vs-paid, (c) verification = manual owner-vet (likely) vs automated, and what proof counts as "verified."
A contractor gets an SMS/email that LAWNS has an app; they open it, say they're a contractor, and give the business details LAWNS needs to verify them (address, business info). Verified, they're assigned a tier (e.g. tier-1 → 10% off all products) and can see contractor pricing and order from a contractor tile — order trees, get them delivered, at their discount. The twist: a small paid access ($4.99, one-time or monthly) "registers" them at LAWNS and unlocks the reduced price + maybe extra tree photos — a symbiotic trade: the fee buys better pricing, LAWNS gets time back. Ordering rides the same gated-cart mechanism as the on-lot/web stories (KEY = TIER). → 5.7 (portal, stub) + 3.7 (tiers) + 1.5 (verify).

### Originate the order — cart + invoice ahead of QBO  (BANKED — customer-gated)
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
MAPS-TO: 2.1, 5.6, 4.1
PIECES: shopping_cart, invoice_origination, qbo_feed
NEEDS: NOT for the LAWNS demo. Adjudicate ONLY if the customer explicitly asks TRACE to own the shopping-cart + invoice-creation step UPSTREAM of QBO (their system of record). This INVERTS the loose-coupling pitch — today Cultivar ingests invoices READ-ONLY for scheduling and billing stays in the customer's books; this makes TRACE the front-of-house that CREATES the order/invoice and FEEDS QBO, a bigger commitment / higher switching-cost, so it's opt-in BY them. Open before build: LAWNS already runs a WooCommerce store (the 116-row catalog is a Woo export) — does TRACE replace / wrap / bypass that cart? and pin QBO's role (books vs POS). The redundant per-trip charge-consolidation item is GATED BEHIND this. NOTE: the contractor-portal + tiered-discount thread (see 3.7 future work) is the most likely trigger for this story.
_Coverage placeholder, not a fabricated scenario. Grounded: HANDOFF 2026-07-03 scope boundary + banked trip-charge item; board 2.1 / 5.6 / 4.1._

### Local-trust tier — your own LLM on your own box
STATUS: gap
SCOPE: north-star, vertical:coolrunnings
MAPS-TO: —
PIECES: local_llm, trust_tier
NEEDS: David to expand. Standing task: query the local-LLM frontier (`NORTH-STAR.md` §5). No capability yet.
_Coverage placeholder, not a fabricated scenario._ The premium trust tier from the north star — intelligence that runs on the owner's **own hardware** (own-LLM-on-own-box) so the most sensitive data never leaves the premises. Web-tier now; local-tier is the paid step-up. The hearing-aid hardware path and the two-tier trust architecture in `NORTH-STAR.md` are the home.

### Rhythm-logger reconnect recovery (honest-debt)
STATUS: gap
SCOPE: vertical:cultivar
MAPS-TO: —
PIECES: rhythm_logger
NEEDS: Small fix — the watcher should retry/re-subscribe on reconnect. Honest-debt, not blocking.
_Coverage placeholder, not a fabricated scenario._ In airplane mode the CoreLocation watcher throws `kCLErrorDomain 0`; after connectivity returns the error persists in the UI until the logger is restarted (the watcher does not retry/re-subscribe on reconnect). The rhythm logger (ledger #63) is the north-star TIMING-LAYER instrument. → CLOSE-OUT-LEDGER GENUINELY OPEN.

### The market tile — show a prospect the price, not the plumbing
STATUS: needs-input
SCOPE: platform, vertical:cultivar
BUILD: active
MAPS-TO: —
PIECES: market_tile, tier_price_sheet, module_pricing_display
NEEDS: DEMO-CRITICAL. David to ratify the recovered price sheet as demo-facing — STARTER $149 / PROFESSIONAL $299 / PREMIER $499 + the per-module add-on numbers (MASTER_BRIEF:210-292) — as the PROSPECT view. This is [[D-17]] **surface #3** (customer/prospect price view): tiers + value ONLY, **NEVER** cost-to-serve, labor, margin, or payback. SEPARATE from — but downstream of — the platform-economics epic (which owns the owner-side engine).
A prospect (Lauren, an Ignition buyer) opens the market/pricing tile and sees THEIR price and what it buys — clean tiers and module pricing — with none of the owner economics behind it. This is the price SHEET, not the pricing ENGINE: it presents settled numbers, it does not compute them. _Grounded: MASTER_BRIEF:210-292 (tiers + module economy); [[D-17]] surface #3 (`docs/DECISION-pricing-display-surfaces.md`); board 5.6-adjacent (no dedicated cap yet, —)._

### Pay on the business's own rail — no card capture on the web (Rail A)
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
MAPS-TO: 5.6, 2.1
PIECES: rail_a_business_pay, no_web_card_capture
NEEDS: SETTLED in principle (customer pays the BUSINESS on the business's existing rail; TRACE does NOT capture a card on the web). Open: which existing rail each business uses + how the online cart hands off to it. Rides the on-web / on-lot gated-cart stories.
When a customer checks out online, the money moves on LAWNS's OWN payment rail — TRACE never captures a card in the web flow. The online cart (the on-web story) originates the order and routes to fulfillment + the business's existing payment method, keeping TRACE out of the card-handling path. This is the B2C rail (customer → business), the sibling of Rail B below (business → TRACE). _Grounded: HANDOFF 2026-07-03 (rails settled); board 2.1 checkout live / 5.6 online-shop stub; ⚡ on-web story._

### Platform billing — the business pays TRACE (Rail B)
STATUS: needs-input
SCOPE: platform
BUILD: active
MAPS-TO: —
PIECES: rail_b_platform_billing, stripe_subscription, module_metering
NEEDS: GATED on David's Stripe account under the TRACE EIN (see "David actions" below). Then: subscription + add-on module billing (the tier + per-module numbers from the market tile), founding-rate lock, trial clock. Baseline = Ignition's `AdminSubscription.jsx`.
The B2B SaaS rail: the business pays TRACE for the platform — base tier + billable add-on modules, metered and adjusted (Stripe). Blocked until the TRACE Stripe account clears verification. Sibling of Rail A above (customer → business). _Grounded: MASTER_BRIEF subscription tiers + module economy (:210-292); `project-billing-ignition-baseline` memory; gated on the Stripe David-action._

### QuickBooks read-back + customer de-dup against the books
STATUS: needs-input
SCOPE: vertical:cultivar, platform
MAPS-TO: 4.1
PIECES: qbo_item_read, qbo_customer_read, qbo_invoice_readback, qbo_itemref_mapping
NEEDS: David to scope the REMAINING half — **the item→line mapping.** ✅ **THE INVOICE READ-BACK LANDED 2026-08-29 (ledger #231)**, so the question is no longer *whether* it lands: `GET /api/qbo/invoices` reads the complete history, and its date range, item quantities, item-`1` line count and discount-base verdicts are the mapping pass's last missing inputs. ⚠️ **PREMISE CORRECTED 2026-08-29 (ledger #229): this story read *"today QB integration is create-ONLY … no read-back, no de-dup against existing QBO customers"*, and BOTH halves of that sentence had been false for six weeks.** The §9 story gate's IN-CODE-NOT-ON-BOARD case, found by the recon that preceded the item read rather than by anyone reading the board.
🔴 **WHAT IS ALREADY BUILT, against the belief above that it was not.** **(1) CUSTOMER READ-BACK AND DE-DUP SHIPPED 2026-07-16 as [[D-47]]** — `api/qbo/invoice/cultivar.ts:74` runs `select * from Customer where … MAXRESULTS 20` against the live books and `:82` re-reads a stored link by id to VERIFY it before billing it; the three-way rule (stored link · email · name) decides link-vs-create and REFUSES on a real ambiguity rather than guessing. It exists because email-alone matching cross-billed nine real invoices (tech-debt #53). So "never READS back" was wrong, and "mints a duplicate in the owner's system of record" is the defect that resolution was written to prevent. **(2) THE ITEM LIST IS READABLE as of 2026-08-29** — `GET /api/qbo/items` (`api/qbo/router.ts`, `_route=items`), gated on `settings:read`, **storing nothing**. ⚠️ **CORRECTED SAME DAY (ledger #230): the first version read ONE PAGE and its own flag was right — it returned `maxResults: 100` with ids past 1127, truncated and silent about it.** Both reads now `select count(*)` FIRST and **REFUSE** when retrieved ≠ expected (R-24a). **(3) THE CUSTOMER LIST IS READABLE as of 2026-08-29** — `GET /api/qbo/customers`, same router, same gate, same client, **zero new Vercel functions**. 🔴 It is ~1,900 real people and is **summarised, never listed**: field coverage, duplicate sizing (shared email / shared phone), five example rows, and a verbatim capture file outside the repo. Nothing personal reaches a log (R-24b/c). **This is what lets an import be SIZED before a resolver is designed for it.**
✅ **(5) THE PUSH IS DISARMED as of 2026-08-30 (ledger #237, [[R-28]]) — AND THE FIX WAS NOT THE ONE THIS STORY EXPECTED.** The twelve literals are gone, replaced by ONE rule: **a $0 line is a `DescriptionOnly` NOTE carrying no ItemRef; a line carrying money is REVENUE and must resolve an Intuit **Id** off its backing row, or the push REFUSES** (422 `QBO_ITEM_UNMAPPED`, naming every unmapped line and the money at stake). 🔴 **The read settled why a refusal rather than a better guess: item `1` EXISTS, is named "Sales" — NOT "Services" — and books to LAWNS's generic income account, so the push would have SUCCEEDED and silently misfiled every tree rather than failing.** Two of the twelve were the wrong SHAPE, not the wrong id, and both now use **the customer's own construct**: the discount is native `DiscountLineDetail` (they use it 66× for $31,985) and SALES TAX left the line list for `TxnTaxDetail` (they carry 194 `DescriptionOnly` lines) — booking tax as a revenue line INFLATED their income by the tax amount. ⚠️ **PREMISE CORRECTED AT BUILD TIME ([[R-26]] instance 13): the scope bar said a row "carries its QuickBooks SKU" — `ItemRef.value` takes an Intuit `Id`, `Item.Sku` is a different field our read does not retain, and `business_inventory.sku` is TRACE's OWN generated identifier.**
🔴 **WHAT IS STILL OPEN — AND IT IS NOW ONE THING WITH A WRITTEN SPEC, NOT AN UNSCOPED QUESTION: `qbo_item_id` DOES NOT EXIST ON ANY TABLE, so every revenue line refuses today.** That is pass ②, specced at `docs/decisions/2026-08-30-qbo-item-mapping-spec.md`: **THREE tables, not one** (`business_inventory` the tree · `service_offerings` · `addons`), holding the **Id**; and it is **smaller than it looks** because the 685-item import gets the Id **for free at write time** — only pre-existing rows need mapping, and `service_offerings` has ONE row at LAWNS. ✅ **THE LEGACY INSTALLATION LINE IS SETTLED AND GONE (#239, 2026-08-30) — it STOPPED BEING PUSHED, which was one of its two named outcomes.** It was backed by NO ROW, so nothing could ever have carried an id for it. Removed on three independent measurements, not on preference: unreachable from checkout **by construction** (`submit.ts`'s `{transport_mode:'self'}` fallback forces a service-selection row onto every `install` order, so the legacy branch is never entered), refused outright on history orders, and **zero occurrences across LAWNS's 1,469 captured invoices / 5,371 lines**. 🔴 **The customer's own books decided it:** LAWNS bill installation either baked into the plant's line (**624 invoices**) or as a real priced item, `137 · Installation`, $200–$4,500 (**4 invoices**) — **never a $0 line**. We were not preserving a path they use; we were preserving one they have never used. When install pricing is re-wired it returns as a `service_offerings` row, with a row that CAN carry an id. **So ② is now three tables and NO orphan line.** **Persisting a customer's chart of items remains a separate ruling nobody has made** ([[R-23]] clause b). ⚠️ **THE HOLD STAYS ON** until David has watched one invoice land correctly. ORIGINAL, TRUE UNTIL 2026-08-30: The invoice push carries **TWELVE hardcoded `ItemRef: { value: '1', name: 'Services' }` literals**, so every line it writes — the trees included — lands in the customer's books as generic "Services", collapsing the Sales-of-Nursery-Stock vs Services split the cost model rests on. Reading the item list is what makes the real ids knowable; **mapping to them is the next build and needs David's scope**, because only ~5 of the twelve want an item id at all (5 are $0 documentation lines wanting `DescriptionOnly`, 1 is a discount wanting `DiscountLineDetail`, and 1 is SALES TAX wanting `TxnTaxDetail` rather than a revenue line). **Persisting a customer's chart of items is a separate ruling and has not been made** — the read holds nothing on purpose. 🔴 **(4) THE INVOICE HISTORY IS READABLE as of 2026-08-29** — `GET /api/qbo/invoices`, same router, same gate, same walk, **zero new Vercel functions**, and it answers Terry's *"how many trees did we plant last year"*: the date range FIRST (how far back the history goes at all), a per-month seasonality curve including the empty months, top items by quantity, how many lines book against item `1`, the `DIW`/`FDIW` bundle counts, and — per **R-25a** — what each discount was actually calculated on, **with the excluded item NAMED**. 🔴 **Not one invoice record reaches the screen and there is no preview**: `QboInvoiceRow` has no customer-name field at all, so the buyer's name is dropped at the PARSE (R-24b/c). ⚠️ **PREMISE CORRECTED IN THE SAME COMMIT (#231): this sentence read *"an Invoice `GET` … is only worth reading once the ItemRefs mean something"*, and the ordering was backwards.** Reading the history is what tells us what the ItemRefs SHOULD mean — which items the trees actually sold as, and whether placement sits inside the discounted base. **The read was the mapping's input, not its reward**, and treating it as the reward is why it was scoped out twice. _Grounded: `api/qbo/router.ts` (_route=items) · `api/qbo/invoice/cultivar.ts` → `findOrCreateQBCustomer` ([[D-47]]) · `docs/decisions/2026-07-16-qbo-customer-identity-resolution-D47.md` · the twelve literals — **all removed by #237, and the line numbers that once located them are all stale ([[R-29]]: cite the construct, not the number)**. They lived in `buildQboInvoiceLines`; what stands there now is `resolveQboItemRef`, which has no fallback branch._

### Kitchen Loop / Residence Product — the house as the smallest business (EPIC)
STATUS: needs-input
SCOPE: platform
MAPS-TO: —
PIECES: residence_view, kitchen_loop, household_sharing, receipt_price_spine
NEEDS: David to sequence the phased build (P0 schema first, per the BUILD-PLAN). DESIGN + prototype COMPLETE and filed; UNBUILT as code; front-door wiring (`home.builtwithcai.app`) DEFERRED on the core `.app` standing up first.
The Residence Product ("Kitchen Loop") is a residence-scoped VIEW of the ONE shared engine — BuiltWithCAI level, sibling to CoolRunnings, `business_type = residence` skinned at runtime ([[D-27]]). It inherits shared auth/RLS + PIN gesture + Receipt Keeper for free; receipts are the neutral confirmed price spine ([[D-28]] API neutrality); capture works offline on the honest gradient ([[D-29]]). Registered here as ONE epic — the full design package is already filed, so do NOT explode into sub-stories yet. _Grounded: `docs/residence-product/` (RESIDENCE-PRODUCT-MASTER-BRIEF.md + RESIDENCE-PRODUCT-BUILD-PLAN.md + 7 specs + prototypes); DECISIONS D-27 / D-28 / D-29. Customer-zero = David's own house._

### Owner-configurable form fields + missing-data flag
STATUS: needs-input
SCOPE: platform
MAPS-TO: —
PIECES: field_config_primitive, missing_data_flag, configurable_required
NEEDS: David to confirm with LAWNS whether their invoices can carry email (improves OCR capture at source) before the "should email be required" half is settled. Build wants a recon: does any field-config mechanism already exist (the #98 service editor + the platform validation rule are adjacent)? Build as a GENERIC field-config primitive, not per-form.
Customers ingested from invoice scans carry phone but often no email (the invoices didn't include it) — so nulls are honest to the source, not sloppiness. Forcing email-required would break ingestion or fabricate data. But fully-optional leaves incomplete, invisible customer records (can't email an HOA you only have a phone for). Two paired mechanisms: (1) MISSING-DATA FLAG — nulls allowed, but the absence is SURFACED (a "missing contact method" indicator + a roster filter/count, same spirit as cost_confidence marking ESTIMATED vs CONFIRMED) so the owner sees the gap and fills it over time, never blocked. (2) OWNER-CONFIGURABLE REQUIRED — the owner can toggle certain fields (email/phone/address) required-on/off for their business, set once, applies to their form — solving the requirement in config not per-customer code (AC-4). CONSTRAINT: only DESIGNATED fields are configurable — structural fields (first_name-never-blank, business_id, anchors) are never toggleable, to prevent turning off a field the system depends on. Demo value: showcases OCR→DB capture ("we pulled these off your invoices; email wasn't on them, so it's flagged; flip this to require it going forward"). Build as a shared field-config primitive so every form inherits it (not a per-form toggle — same lesson as the service editor + validation rule). _Grounded: observed 2026-07-08 on /customers (invoice-scan customers missing email); adjacent to #98 service editor + the platform required-field validation rule._

### Margin-aware pricing intelligence — traffic-light the price field, tell me WHY
STATUS: needs-input
SCOPE: platform, vertical:cultivar
BUILD: active
MAPS-TO: 5.1, 3.7
PIECES: ambient_signal, drill_in_modal, operational_reasons, margin_target_setting, overhead_allocation
NEEDS: three open dependencies to flag (none block the floor case): (1) PER-UNIT OVERHEAD ALLOCATION — the [[D-14]] carve-out / [[D-16]] Model B (cost-to-serve ÷ N) / cost_objects model, still OPEN platform-wide; gates the FULL traffic-light (true green/yellow/red vs landed cost). Partial signal (margin-vs-unit_cost, pre-overhead) works without it. (2) MARGIN-TARGET SETTING — the owner sets a desired margin %; where the green/yellow threshold lives (likely rides business_pricing_config.config jsonb, no migration — David sets the surface + granularity). (3) CONFIRM Layer-3 data coverage — plant_events is per-cultivar_plants specimen, but the dominant anchor is now the stock-line business_inventory lot ([[D-34]]/[[D-36]]) which may have no specimen events, so "plants dying on this line" may be sparse; age (created_at/received_at) is solid.
Point-of-entry pricing intelligence with graceful degradation — a 3-layer interaction tying pricing health to OPERATIONAL health, right where the owner types a `sell_price`. **The price field IS the dashboard**, advisory-only (never blocks the save — Surface Honesty + owner-authority). **Layer 1 — ambient signal:** the field's BACKGROUND COLOR is the traffic light — 🟢 above margin target / 🟡 below target (thin) / 🔴 below cost+overhead (losing money) / ⚪ neutral when there's no cost basis to judge. Glanceable, always on, no interaction. **Layer 2 — drill-in:** a clickable icon → a modal with the math, state-dependent — GREEN shows % margin + profit-per-item ("42% margin · $53 each"), YELLOW adds a suggested price to reach green ("18% — suggest $145"), RED shows negative margin + recovery price + the Layer-3 reasons. **Layer 3 — the operational WHY (the differentiator):** red/yellow isn't just margin math — it connects price to operational health, surfacing reasons from operational data: too long in stock (aging → carrying cost, from inventory created_at/received_at), plants dying/declining (reuse plant_events decline tracking), great losses/shrinkage on the line (plant_events 'lost'), extensible. "This plant is bad business + here's why," not just "you priced it wrong." **Graceful degradation (mirrors cost_confidence + fidelity tiers):** no cost+overhead → NEUTRAL, accept the owner's price on trust, form fully works; unit_cost known → partial signal (vs cost, pre-overhead); + overhead → full traffic-light; + operational data → Layer 3 reasons light up. Intelligence appears as data arrives, NEVER blocks the floor case. **Reuse:** the shared MarginEngine for margin/suggested-price math (NOT its slab model — cultivar stores an explicit sell_price, so extract the small margin helpers, don't force the whole engine); existing plant_events + inventory timestamps for Layer 3. Full design: `docs/concepts/margin-aware-pricing-intelligence.md`. _Grounded: business_inventory.unit_cost/sell_price/created_at ([[D-35]]); plant_events (packages/cultivar-os/src/types/plant.ts); MarginEngine.ts; cost_confidence seam; open overhead model [[D-14]]/[[D-16]]._

### Arbor Day — plan the season once, change it when Terry changes his mind
STATUS: needs-input
SCOPE: platform, vertical:cultivar, vertical:kinna
BUILD: active
MAPS-TO: —
PIECES: campaign_create, campaign_call_to_action, campaign_edit, campaign_cancel, campaign_generate_more, campaign_list_honest_read
NEEDS: David to rule EDIT is limited to dates and focus BEFORE publication, and that a published campaign which lands badly is ANSWERED AND RESTARTED rather than silently rewritten (Regina's bad-press scenario, 2026-08-23 — "my bad, we didn't give you all the details, thank you for bringing that to our attention"). Lauren to confirm the scene and the ask Wednesday.
It is early September and Lauren has forty minutes. July and August were dead — heat,
vacations, back to school — and fall is when people actually plant. **Texas Arbor Day is
the first Friday in November** (Nov 6 in 2026), and it exists on that date precisely
because a tree planted in April has no chance against a Texas summer. For a nursery it
is not a symbolic holiday. It is the opening of the selling season.

She names a campaign — *Arbor Day 2026* — sets it seasonal, runs it through the first
week of November, and points it at the varieties that are actually sellable. TRACE drafts
posts for the channels she's enabled, written off her real sales, and she edits them to
sound like her before she copies and posts. The winterization, the fertilizing, the
courtesy tree inspection — the services nobody knows they offer — ride along in the copy.

**A campaign is not a run of posts. It is an ASK, and the posts carry it.** Lauren's ask
writes itself from her own trees: the west wall cooking the house through a Texas
afternoon, the fast-growing shade varieties she has in sellable sizes right now, and a
percentage off until Arbor Day. She states it once and every post carries it. Without the
ask it is decoration.

**Generated copy carries no invented facts.** TRACE writes captions from her real sales. It
does not write statistics. Any number in a post is one she supplied or one from her own
data — a fabricated energy-saving percentage in her Instagram feed is her liability, not
ours.

Then Terry wakes up and decides something different. A variety sells out. The weather
turns. **She changes the campaign** — dates, focus — and the plan follows her. Halfway
through she wants a few more posts, so she asks for more posts *for this campaign* and
gets them, in the campaign she already made. A campaign that gets shelved she **cancels**,
and it stays on the list, marked, because next September the first thing she opens is
what she ran last year and what she didn't.

A campaign never features stock that cannot leave. **Under production is not for sale** —
a block potted up in August is six to eight months from being sellable, and promoting it
sells a tree that can't go on a truck.

### Generating "more posts for this campaign" creates a second campaign, silently (fix owed)
STATUS: needs-input
SCOPE: platform, vertical:cultivar
BUILD: active
MAPS-TO: —
PIECES: campaign_generate_more
NEEDS: David to rule whether generate-more appends to the open campaign or is removed until it can.
The button on a campaign's own page reads *"✦ Generate more posts for this campaign."*
It takes the CREATE branch, mints a **second** campaign, and navigates onto it — with no
error surface at all. David produced two identical "arbor day" rows three hours apart
this way and neither appeared in the list, because that screen renders a zero-post
campaign as "All posts published ✓". A missing lifecycle does not stay missing; it gets
impersonated by the path that exists. This is the story-shaped half of that finding.

### Deleting a campaign — deliberately not built
STATUS: scoped-out
SCOPE: platform, vertical:cultivar
MAPS-TO: —
PIECES: —
Reason: a deleted campaign destroys its own history, and the history is the product.
Arbor Day recurs every November — the value of the 2026 campaign, **including a cancelled
one**, is that it tells Lauren what to do in 2027. CANCEL is the verb; the row stays and
carries its state. Ruled by David twice and enforced in the build: `verify-universals`
fails on the literal `campaigns:delete`. The owner can still remove a row at the database
as `postgres` — that is an operator act, not a product capability.

### Which channel actually brought them — a code per channel
STATUS: needs-input
SCOPE: platform, vertical:cultivar, vertical:kinna
BUILD: active
MAPS-TO: —
PIECES: campaign_channel_codes, campaign_code_redeem, campaign_attribution_readout
NEEDS: David to rule where a campaign code lives against the existing discount model (`discountTypes` in business_pricing_config, `order_discount:apply`) — a new discount kind, or an existing one carrying a source. And whether a code is per-channel-per-campaign or per-campaign only.
Regina, on the campaign she ran: *"a special code for Instagram, a special code for
Facebook, a special code for X — then you can say your code came from Facebook. I've got
85% of my people came from Facebook, that's the area I really need to concentrate on. I
didn't get anything from Twitter."*

The campaign issues a **different code per channel**. A customer redeems one at checkout,
and the order carries where it came from. After a season Lauren opens one readout and sees
which channels produced customers and which produced nothing — and stops spending evenings
on the ones that produce nothing.

It settles a live disagreement rather than a theoretical one. Regina watched four customers
walk into LAWNS in one day: **all older, all with money, no thirty-to-forty-year-olds except
ones accompanying their parents.** TikTok and Instagram skew young. Today that is two
opinions about who her buyer is. With codes it is arithmetic.

This is the first thing on the board that closes the loop **campaign → post → code → order**
— the point where marketing effort becomes a number instead of a feeling.

### Give it to me in my language — Spanish for the people doing the work
STATUS: needs-input
SCOPE: platform
BUILD: active
MAPS-TO: —
PIECES: i18n_locale_switch, i18n_crew_surfaces
NEEDS: David to rule scope — crew-facing surfaces only, or the whole app — and whether locale is a per-user setting or a per-device one. Someone to confirm which surfaces the LAWNS crew actually touches.
A man has worked at LAWNS for ten years and does not speak English at home. He is one of
the people who would be walking the rows with a phone — counting a block, marking a
rotation date, working a delivery route. Terry gives him instructions in person and it
works. **An app is not a person, and it does not adapt.**

Regina named it plainly: *"you need to make sure he has the capability of it in English and
translate to his language so he can move on."* And she named the timing, which is the part
that matters: **"if you don't put it in there, you can't really easily [add it later]."**
She is right. A locale switch designed in at the start is small. Retrofitted across every
surface after the fact, it is a rewrite.

This is platform, not Cultivar. Every vertical has crew — the nursery has planters, the
auto shop has technicians, the kitchen has staff. The owner reads English and the work does
not care.

### Truth in advertising — suggest facts, never censor, keep the record
STATUS: needs-input
SCOPE: platform, vertical:cultivar, vertical:kinna
BUILD: active
MAPS-TO: —
PIECES: claim_check, claim_verdict_surface, copy_suggestion_audit
NEEDS: David to rule retention — how long the suggestion/edit record is kept — and whether the check runs on every generation or only when the owner supplies a factual claim. Confirm the audit record reuses the `receipts.accept_vs_edit` pattern rather than inventing a second mechanism.
Lauren types into the campaign box: *"electricity is up 12%, and we're in a water
restriction area."* One of those is her market knowledge. The other is a number, and a
number in her Instagram feed is a claim she is making to her customers.

**TRACE never originates an unverified factual claim.** Not as a setting, not as an option.
If the tool writes "shade trees cut cooling costs 13%" out of nowhere, that is the platform
putting a fabricated number in her mouth, on her own feed, under her name.

**And TRACE never censors her.** She knows her market and she may know things a search does
not. The check flags; it does not refuse. Surface, don't decide.

Three verdicts, not two — because the middle one is where the value is. ✅ **verified**,
with the source attached. ⚠️ **couldn't substantiate — and here is the nearest thing that
does check out.** ❌ **contradicted**, with what says otherwise. The electricity claim above
fails as stated, and underneath it sits a true and better one: the regulated delivery charge
rose about 9% on 1 June and no customer can shop around it. A binary pass/fail throws that
away. The same discipline as CONFIRMED / DERIVED / UNKNOWN on cost — unverified is never
silently false, exactly as unknown is never silently zero.

**A verdict with no source is just a second opinion with more confidence.** Every check
shows its work, so she can disagree with it — and sometimes she should. A search can be
stale, ambiguous, or wrong about a local market.

**The record is hers and it is visible.** What was suggested, what she published, and the
delta between them. Not a hidden log and never a scorecard — *"here's what changed"*, never
*"here's what you overrode."* If she feels her corrections are being graded she will stop
correcting, and the corrections are the most valuable thing in the system: the delta between
draft and published IS her voice, captured without asking her to fill in a form.

**One honest limit, stated in the design rather than discovered later:** the record captures
what LEFT TRACE, not what was published. She copies a caption into Instagram and may edit it
there. This is not a record of publication and must never be labelled as one.

### The growing ladder — potted, waiting, ready, and up a size
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
ARC: asset-inventory-pmi
MAPS-TO: —
PIECES: growth_ladder_config, rotation_date, under_production_state, uppot_schedule
NEEDS: Joel to supply the numbers — the container sizes in order, which are never sold, and maturation plus hold per rung (per variety where he knows it). David to rule whether UNDER PRODUCTION is a new value in the lot-status vocabulary or a derived state, and whether up-potting is modelled as a transformation or as a movement out and in.
Lauren corrected David on this, and the correction is the whole model. He had them
repotting every six months. She said: *"I had that backwards. We don't repot them every six
months. It takes six to eight months to grow into their pots, and then they can live in
their pots for say a year."*

So a block of trees goes round a loop, not down a pipeline. It is potted into a size, spends
six to eight months **under production** — her word — rooting into that pot and not for sale
at any price. Then it is sellable, and holds at that size about a year. Then it has to move
up a pot whether or not anyone bought it, and the loop starts again one size bigger. Fifteen
gallon to thirty to forty-five to sixty-five to ninety-five. Eighteen to twenty months a
rung, several years to the top.

**Everything derives from one date and two numbers per size.** Joel says when a block went
into its pots; the rung's maturation says when it can be sold; the hold says when it must
move up. Nobody types a ready-for-purchase date — it is arithmetic, and a typed one would
just be a second answer that can disagree with the first.

**A blank interval means UNKNOWN and stops the schedule.** Lauren said plainly *"I don't know
the actual numbers or how fast they."* Joel knows some varieties and not others. A variety
with no interval says so rather than quietly assuming six months, exactly as an unknown cost
is never counted as zero.

**The tool prompts a look; it never declares a tree ready.** Lauren's real trigger is her
eyes — *"we look at things and we're like, oh, those need to be repotted."* The system knows
when to send someone down the row. Joel decides what he finds there.

Two things fall out of it. The counting unit is the **block** — variety by size, the physical
row — because that is how the yard is laid out and how anyone would count it. And the
scheduling leverage is real: pot up in August, in the dead heat when nobody is buying, and
the block comes sellable in March when everybody is. Pot up in January and it lands in July,
into the deadest month of the year. Same work, same crew, months of difference in when the
money shows up.

**Today the platform would call an under-production block available**, because anything on
hand and uncommitted computes as sellable. Forty trees that cannot leave for six months would
be offered for sale.

### What's in it when it sells — cost that accumulates over years
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
ARC: cost-to-produce
MAPS-TO: —
PIECES: rung_cost_inputs, batch_labour, block_origin, cost_accumulation
NEEDS: David to rule whether ORIGIN (grown / bought in) is a field on the lot or derived from whether an acquisition cost exists, and how per-tree accumulated cost relates to the existing cost_objects model. Lauren and Joel to supply real numbers for one batch.
David, to Lauren: *"you have seeds, you buy seeds, you have containers, you have labour. You
have a thousand seeds, you have so much dirt, three employees, it took four hours, the
employees were paid this much — so you have this much sunk into your seeds. Now you water it.
You have a well, you have electricity."*

Cost here does not arrive as an invoice. It **accumulates**, over years, one rung at a time,
and by the time a ninety-five gallon oak is sellable it has been through the loop four times.

Two shapes, and the difference is where the block came from. **Bought in** is one line on a
vendor invoice and joins the ladder partway up — David captured exactly such an invoice on
2026-08-22. **Grown from seed** starts at the bottom and picks up cost at every rung: pot and
soil per tree, the crew's hours spread across the batch, water and power for every month it
sits there. Same tree at the same size, two completely different cost shapes.

**Labour is per batch; materials are per tree.** Three people for four hours across a thousand
seeds is a fraction of a cent each. Across two hundred it is not. The batch size is what makes
the labour number mean anything, so it is not optional.

**Kit bought once and reused is not in this.** The timer, the happy pipe, the weed mat, the
well — David named them as sunk cost and he is right that they should not divide into a
per-tree number. That is capital, and Cost-to-Produce already says so on its own screen:
one-time capital is shown separately and never inflates the per-unit figure.

**And some of it is genuinely unknowable.** David said it himself: *"I don't know if we'll know
if you had to go to the store to get the seed."* We won't. So a cost with an empty box is a
FLOOR and the surface says so — the real number is higher. Never a guess, never a zero. That
is the honest answer to a business that currently estimates cost from what a vendor charged
them, and it is the same discipline the 117-unquantified-costs banner already applies.

The payoff is a sentence Terry has never had: **this forty-five gallon Shumard has this much
of you in it, it took three years to get there, and you sell it for that.**

### Tell me before I run out — reorder from what I actually use
STATUS: needs-input
SCOPE: platform, vertical:cultivar
BUILD: active
ARC: suggestion
MAPS-TO: —
PIECES: consumable_tracking, consumption_forecast, draft_purchase_order
NEEDS: David to rule whether a drafted order is ever sent by TRACE or only ever prepared for the owner to send, and where consumables live — a kind of inventory row, or their own thing. Lauren to name which consumables actually run out on her.
David, to Lauren: *"you run through labels for your QR and your printer, and we can say
you've printed so many QR labels that you're running out. It's time to reorder based on your
past history."*

Lauren runs out of things and finds out at the worst moment — standing at the printer with a
block of trees waiting to be tagged. Pots, soil, labels, fertiliser. Nobody counts them until
they are gone.

TRACE already knows the consumption, because it knows the work. **Every QR label printed is a
label used. Every up-pot is a pot used.** The schedule from the growing ladder says forty
blocks come due in October, which says how many pots and how many labels October needs —
before October. That is a forecast from her own operation, not from a burn rate somebody
guessed.

So the surface warns while there is still time to order, and then goes one step further: it
**drafts the order** from what she has bought before and puts it in a queue. She opens it,
adjusts what is wrong, and sends it. **TRACE prepares; Lauren sends.** Nothing leaves the
building on its own.

This is the business-intelligence layer doing the least glamorous and most useful thing it
can do: noticing something ordinary before it becomes a problem, and having the paperwork
ready.


### Every incident that does not complete the intended action
STATUS: needs-input
SCOPE: platform
BUILD: active
MAPS-TO: —
PIECES: incident_log_table, write_open_read_closed_policy, failed_intent_capture, fire_and_forget_emit, incident_review_and_archive, abuse_guard_rate_limit_size_cap
NEEDS: **the RULE is settled and is not what is owed** — David: *"every incident that doesn't complete the intended action this is a log we can review and archive."* Three things are open, and 🔴 **none may be answered by picking a default in code:** (1) **the write-open/read-closed policy shape and its abuse surface** — an openly writable table needs a proper SECURITY RECON, not a patch, and rate limiting + a size cap belong in the same conversation (REQ §5); (2) **retention and archival** — how long a row is kept, and what *"archive"* means here; (3) **whether the write rides an existing endpoint** — `api/` is at **12/12** and §6 r11 makes minting #13 a STOP-and-surface event, so this is a constraint on the shape, not a detail of it.

**The product has launched. LAWNS have it. When something fails in their office, nobody watching can see why.**

🔴 **The proving case is not hypothetical — it is the morning this was restated.** On 2026-08-26/27 Lauren could not invite Joel. Her console held the entire diagnosis: a `refresh_token` 400, repeated *"no local session — settled logged-out (wipe)"*, a 403 on `GET /rest/v1/invitations`, and the SHA she was running. **That trail survived only because David asked her to copy it out of the browser by hand. One closed tab and the morning is unexplainable.** The same week, owner-test findings had to be reconstructed from screenshots.

**What counts is a failed intent** — someone (or the system) meant to do a thing and it did not happen: a write refused by RLS, a constraint or a permission · a read refused 401/403 · a request that failed on network, timeout, 4xx or 5xx · a session lost, wiped, or failed to refresh · an action gated off and abandoned · a queued item that did not drain · an import row refused · anything the app catches and shows as an error. **Not renders, not navigation, not successful reads or writes.** 🔴 **If it completed, it does not go in.**

**A row carries what this incident actually needed:** `occurred_at` · `build_sha` (*half of this week's confusion was stale builds*) · `business_id`, null if unknown · `user_id`, where **null is the interesting case** · `route` · `intent`, in plain words · `outcome` · `error_text`, **raw and unprettified — the value of Lauren's console was that it was verbatim** · `context` (session status, permissions, ids). **Append-only, following [[D-50]]'s existing pattern: a correction is a new row.**

🔴 **THE TRAP THAT MUST BE SOLVED FIRST, AND IT IS WHY THIS IS BLOCKED RATHER THAN READY: THE LOG MUST BE WRITABLE BY SOMEONE WHOSE AUTH IS BROKEN.** A null `auth.uid()` is precisely the failure most worth capturing — it is what this incident turned on — so **a table RLS-gated on `auth.uid()` cannot record the events that matter most.** That builds a black box that goes quiet during the crash. Required shape: **write-open, read-closed** — anyone may insert; only the owner of the business may read; rows with no `business_id` are readable only by the platform. ⚠️ **That is a deliberate, unusual policy and it is an [[AC-2]] exception, so it carries a WHY.**

**It fires for a GUEST, and that is a requirement rather than a consequence.** An online shopper who hits an error never reports it — they leave. Gating capture on being signed in loses exactly the population that cannot tell you.

**Four things it must not do:** do not log everything (TRACE emits on every render — failed intents only) · **do not make it block** — a logging failure must never break the action it was describing, fire and forget · do not prettify the error · **do not gate it behind a module.** 🔴 **This is CORE. An owner does not subscribe to knowing why their software failed** — and per R-13, core carries no on/off switch.

**What exists today, recorded so nobody re-discovers it:**
- **A capture tool that is BUILDER-COMPLETE (owner-proof owed) and does not satisfy this**, for one reason: **it never leaves the device.** A console interceptor tees all ~500 `[TRACE:*]` sites into a **600-entry `localStorage` ring buffer** (`captureBuffer.ts:20`) with a `window.onerror`/`unhandledrejection` crash-flush, read through a floating 🐞 panel offering Copy / Share / Download (`docs/decisions/2026-06-27-wrap-and-capture.md:126-129`). ✏️ **Precisely: the BUFFER is not gated — `installCapture()` runs in `main.tsx` before React, so the pre-login trail IS recorded — it is the VIEWER that is DEVGATE'd (`DebugPanel.tsx:40`, `useDevSurface('debug')`).** So the data exists in the guest's own browser, is never transmitted, and is readable only by whoever is holding that device. **That is the manual copy-out Lauren performed, and it is the step this story deletes.**
- **`audit_log` ([[D-51]]) and `business_inventory_ledger` ([[D-50]]) are DOMAIN event tables and neither takes an exception or a failed call.** `audit_log` records discretionary/security-relevant acts (delete, override, tier change, permission change); the ledger records movements. An error has no home in either. ⚠️ **Distinct from *"The log that proves what happened outlives the log that proves what's on hand"* above** — that story is accountability for discretionary acts, this one is diagnostics for failures. Adjacent, not the same table.
- **`api/` is at 12/12** (§6 r11, tech-debt #41), which constrains any DB sink that would otherwise want its own endpoint.

**Why it went missing, and the process fix this story IS.** David asked for this before and it was not built: as far as can be seen, the request landed as **console instrumentation — thorough, and not persisted.** 🔴 **Nothing in the process surfaces an unbuilt request.** Rulings are filed, tech debt is filed, owner-test cards prove built surfaces work — but a request that never became a story in this file has **nowhere to live and nothing that raises it again.** So: **file the story first, then build.** If the build slips, the story still exists and shows up in the next reconciliation. _Grounded: REQ-incident-log.md (David, restated 2026-08-27) · the 2026-08-26/27 invitation incident · `docs/decisions/2026-06-27-wrap-and-capture.md` · STD-003._

### Online shop — a stranger buys trees, and the money never touches TRACE
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
MAPS-TO: 5.6, 2.1, 5.1, 4.1
PIECES: guest_storefront, guest_checkout_form, atomic_availability_check, order_invoice_split, fulfilment_choice, qbo_pay_online_link, guest_visible_field_set, under_production_not_sellable
NEEDS: 🔴 **THIS STORY CONTRADICTS [[D-54]] AND THE *Remote browse* STORY ABOVE IT, AND THAT IS DAVID'S TO RESOLVE BEFORE ANY BUILD SPEC** — D-54 rules that ON THE WEB the key is REGISTRATION, *"name, address, ZIP before any price renders"*, and *Remote browse* narrates a catalog shown deliberately **with NO PRICE** until that registration; this requirement says the guest browses *"like Lowes or Homedepot"* and **sees prices at checkout**, submitting their details **after**. Same surface, opposite order. ⚠️ **D-54's row is `OPEN` and its own state cell says the platform honours NEITHER key today** (price renders on screen 1 of 5), so this is a live fork rather than a regression. Also owed, and each blocks a different piece: 🔴 **guest identity — a guest submitting details either creates a customer record (which is where duplicates come from) or an order with no customer (which breaks the delivery path); THIS NEEDS THE CUSTOMER-MATCHING RULING FIRST, the same question as the OCR import and the 1,927-row customer import**; the **guest-visible field set** (R-19's class pointed outward); and **under-production stock must not be sellable online** — R-16's deferred naming becomes load-bearing the day a guest can see a catalog.

**A public storefront where someone who is not a member of the tenant browses the nursery's catalog, chooses how they get their trees, and pays — with the money going through the nursery's own QuickBooks, never through TRACE.**

**`online_shop`, $19/mo, NON-CORE**, switchable like any other non-core tile (`tileRegistry.ts:391` — `add_on`, 30-day trial; the tile is `status:'planned'` at `:230`). **A nursery that doesn't want to sell online doesn't pay for it and doesn't see it.**

🔴 **THE GUEST IS THE DESIGN; THE SHOP IS THE SCREEN ON TOP OF IT.** A guest has **no login, no role and no membership** — a new kind of user, because every rule so far governs what a *member* can do. ⚠️ **The precedent exists and works: the anon QR path `/plant/:tagId` is already a public route where someone with no token scans a tag and buys.** Online Shop extends that from one plant to a catalog. **A guest has NO PRICING TIER — they see retail.** No contractor discount, no military, no family; a contractor who wants their price rings the yard. **What a guest may see: the catalog and retail prices. 🔴 What a guest must never see: cost, other customers, under-production stock, anything behind `costs:read` — this is #81's family arriving from outside the building instead of inside it.**

🔴 **THE SEQUENCE IS THE REQUIREMENT, NOT A DETAIL.** Browse → checkout (see prices) → choose fulfilment → **submit all required data on a checkout form** → 🔴 **WAIT, while the system checks availability** → **CONFIRMATION**, order accepted, confirmation email sent → **THEN payment.** **Availability is confirmed BEFORE the card is charged, and that is precisely what makes a negated sale cost nothing and involve no refund.** ⚠️ **This is a change from today's checkout, where creating the order and pushing the QuickBooks invoice happen in ONE action** — the shop needs them split: order → check → confirm → invoice.

**Fulfilment is three choices already modelled, and introduces no new concept** — the guest picks one and it writes the value every order already carries (`orders.transport_method`): *drop by and pick it up* → `self` · *request delivery* → `delivery` · *request placement / planting* → `install`. **The delivery row a `delivery` or `install` order writes is the same one proven on 2026-08-25 (#216).**

🔴 **THERE IS NO RESERVATION. NOTHING IS HELD FOR AN ONLINE SHOPPER.** If the last vitex is loaded into a customer's truck at the yard, **that sale wins**; an online order placed just after registers as *last available sold* and is **negated**. David: *"this is common business practice."* **The mechanism already exists** — TRACE counts trees **available** and **committed** ([[D-52]]), an online order **commits** rather than depletes, and the shop links into that capability rather than inventing one. 🔴 **The availability check runs SERVER-SIDE, AT SUBMIT, ATOMICALLY** — not while browsing, not in the browser: **if it can run twice concurrently and both pass, the same tree is sold twice with nothing to catch it.** `computeOrderPricing` already runs server-side at submit, which is the same seam. **The "wait" is that check** — not dead time to apologise for, but the moment the system actually looks, and the reason the confirmation means something.

🔴 **TRACE DOES NOT ACCEPT, HOLD, PROCESS OR RECONCILE PAYMENT — [[D-37]] HOLDS UNCHANGED.** The confirmed order creates a **QuickBooks invoice, which already carries a pay-online link** (Apple Pay, cards, bank). **Intuit takes the card. Intuit holds the money. Intuit handles the chargeback.** The customer's experience is identical to any online store, and the liability is neither TRACE's nor the nursery's software problem. **It is also the better commercial answer** — *"payments run through your QuickBooks, where your money already lives"* reads to an owner as safer, not as a limitation.

⚠️ **If asked before it exists:** *"It's on the roadmap as a switchable module — nineteen a month if you want it, nothing if you don't. Payment would run through your QuickBooks, so the money goes where it already goes. And nothing gets held for an online shopper — if it leaves the yard, it's sold."* A complete answer that promises nothing unbuilt. _Grounded: REQ-online-shop.md (David, ruled 2026-08-25 and 2026-08-26) · [[D-37]] money boundary · [[D-52]] on-hand/committed/available · `tileRegistry.ts:230,391` · MASTER_BRIEF:308._

### Will-call — a customer orders online and collects it themselves
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
MAPS-TO: 5.6, 2.1, 5.1, 3.5
PIECES: will_call_fulfilment_choice, hold_on_purchase, fulfilment_action_no_delivery_row, arrival_identify_and_load
NEEDS: 🔴 **NOTHING IN THIS STORY IS OWED BY DAVID — the will-call rule itself is SETTLED by [[R-21]] and the four questions below are answered and closed. What is owed is everything it stands on:** the **online shop** that originates the order (`online_shop` is `status:'planned'`, and its own story is `needs-input`); the **price-gate ruling**, still OPEN — browse with prices like Lowes, or identify first per [[D-54]] — the live fork the online-shop story names; and **customer identity for a registering guest**, the same customer-matching ruling the OCR import and the 1,927-row customer import both wait on. ⚠️ **The one piece that is this story's own and not inherited: the fulfilment action must work with NO delivery row, and it must be the SAME action used at a delivery stop and at the register — a spec that names three is the thing to stop.**

**A guest registers on the online shop, orders, and chooses pickup rather than delivery. The order is paid and lands at `invoiced`. It holds the stock. It creates no delivery row, because LAWNS are not taking it anywhere. When the customer arrives, someone identifies the stock, loads it, and marks the order collected — and that is fulfilment.**

David, verbatim: *"will call is an online order for pickup which is what they want customer (guest) who registers, orders online and says i will pickup the customer arrives the stock is identified, loaded and customer departs (will call) fullfilled"*.

**What it needs:**
- 🔴 **No new order status.** `pending` → `invoiced` → `fulfilled` already covers it ([[R-20]]) — **will-call simply WAITS at `invoiced`**. A fifth status would be scheduling state leaking into the lifecycle, which is exactly what R-20 pushed onto the delivery row.
- 🔴 **The order carries a lot id, per [[R-21]]** — so available-to-sell drops **the moment it is paid**, not when it is collected. This is the half of R-21 that has no guard yet, and it is what stops the same tree being sold at the register while it sits paid-for in the yard.
- 🔴 **A fulfilment action that works with NO delivery row.** ⚠️ **This is the SAME action the crew takes at a stop and the same one a walk-in takes at the register — one fulfilment action, three contexts. DO NOT BUILD THREE.** (§6 r8, and the live reason it matters: nothing in the platform can mark a delivery complete today — tech-debt #121 — so the stop-context half of this action does not exist either.)

**Answered by David — RECORDED, DO NOT RE-ASK:**
- ✅ **A specific plant is NOT set aside. A QUANTITY is held against the lot**; the physical tree is chosen at pickup.
- ⚠️ **Individual-tree selection is REAL at LAWNS but happens a different way** — a customer who walks the lot sometimes picks an exact tree and **IT IS MARKED WITH A RIBBON**. Inventory is **lot-level with a quantity and has no per-plant concept**. 🔴 **Recorded as CONTEXT ONLY: it is NOT in scope and nothing is to be built for it.**
- ✅ **A paid will-call nobody collects is a CUSTOMER-SERVICE ISSUE FOR LAUREN, not a system problem. No expiry, no automatic release.** Closed by David — **do not raise it as an open question.**
- ✅ **The hold does not contradict *"no reservation, first purchase wins"*** — that rule governs **browsing and carting**; the hold begins **at purchase**, and a will-call order is a completed purchase ([[R-21]] corollary).

**Dependencies — NAME them, do not build them:**
- **The online shop itself** — `online_shop`, `status:'planned'`, `$19/mo` non-core (`tileRegistry.ts:230,391`); story *Online shop — a stranger buys trees, and the money never touches TRACE*.
- **The price-gate ruling, still OPEN** — browse with prices, or identify first ([[D-54]]).
- **Customer identity for a registering guest** — David's model is already ruled: **not identified, no discount; identified, the account they choose decides the terms.**

_Grounded: David 2026-08-28 (verbatim above) · [[R-21]] origin decides the hold · [[R-20]] the four-word status vocabulary · [[D-52]] on-hand / committed / available · [[D-37]] money boundary · the *Online shop* story's fulfilment-choice piece (`orders.transport_method` = `self`)._
---

## PLATFORM STANDARD CAPABILITIES

_The three-category capability roster the platform-standard **gap analysis** (2026-07-14, David) surfaced: the
boards had captured what David INTENDED to build but not (a) the industry-standard capabilities still MISSING nor
(b) the ones deliberately scoped OUT — so gaps ambushed one demo-surface at a time. This section closes that by
putting ALL THREE on the boards from the ONE source: what's **BUILT** (`written`), what's **BUILDING / a GAP**
(`gap`), what must be **DEMO-OPERATIONAL if poked** (`demo-operational`), and what is deliberately **SCOPED-OUT**
with the reason (`scoped-out`). These are terse capability lines (not day-in-the-life narratives — those live in
the arc sections above), and where a capability already has a fuller arc story, the roster line `MAPS-TO` the same
id rather than re-telling it (STD-011 — one canonical narrative, this is the capability-index VIEW). Rendered on
`stories.html` (Cross-cutting) + the live `cultivar_demo_kanban.html` (grouped into Built / Building / Demo-op /
Scoped-out columns)._

### Server-authoritative pricing & discount (BUILT)
STATUS: written
SCOPE: platform, vertical:cultivar
MAPS-TO: 2.1
PIECES: computeOrderPricing, discount_showwork
ONE shared server-authoritative pricing function; every surface renders its output, and the per-line breakdown is PERSISTED at submit and RENDERED downstream (never recomputed per surface). _Built: [[D-39]] (one computation) + [[D-43]] (persist the show-the-work breakdown); STD-012._

### Tax rate + exemption (BUILT)
STATUS: written
SCOPE: platform, vertical:cultivar
MAPS-TO: 2.1
PIECES: per_tenant_tax_rate, tax_exemption, override_gate
Per-tenant tax rate (honest-unset, redlined when not set — no fabricated default), taxability on the goods/service line-kind seam, party exemption on `customers`, per-order override — each reason-coded, permission-gated, actor-logged. _Built: [[D-40]]; STD-013 (money-affecting overrides) + STD-014 (sourced config, honest-unset)._

### Customer party record (BUILT)
STATUS: written
SCOPE: platform, vertical:cultivar
MAPS-TO: —
PIECES: customer_party_record, party_editor
`customers` brought to the complete standard party/customer record (identity · billing · tax · terms · lifecycle) in ONE migration + a grouped `CustomerPartyEditor` (create + edit, one form) — fields stop being added reactively. _Built: [[D-41]]; STD-011 (Add + Edit render the SAME editor)._

### Inventory decrement-on-paid (BUILT)
STATUS: written
SCOPE: platform, vertical:cultivar
MAPS-TO: 5.1
PIECES: atomic_decrement_rpc, oversell_refuse, lifecycle_restore
Per-unit stock depletion at order-paid via one atomic guarded RPC (concurrency-safe, can't go negative), status derives from qty, oversell refused (`INSUFFICIENT_STOCK`), whole lifecycle coherent (edit/cancel/delete restore). The Amazon model — committed at payment, not delivery. _Built: [[D-42]]._

### Customer detail + order history (BUILT)
STATUS: written
SCOPE: platform, vertical:cultivar
MAPS-TO: —
PIECES: customer_detail_page, order_ledger
`/customers/:id` detail page with the customer's order history — customer history IS order history (no separate touch-log). _Built: [[D-44]] (ledger #122)._

### Money boundary — TRACE charges, never processes payment (BUILT)
STATUS: written
SCOPE: platform
MAPS-TO: —
PIECES: charge_computation, no_payment_processing
The platform COMPUTES a charge (price/discount/tax) and hands off; it never captures a card or processes a payment on the web. Tax is a charge computation, not payment processing. _Built: [[D-37]]; cf. Rail A / Rail B stories (payment moves on the business's own rail)._

### Multi-tenant RLS isolation (BUILT)
STATUS: written
SCOPE: platform
MAPS-TO: 1.4
PIECES: business_id_scoping, is_active_member, tenant_isolation
Every business-scoped table is `business_id`-scoped with owner/active-member RLS via the ONE canonical `is_active_member` predicate; cross-tenant resolution returns no-access, never a wrong-tenant record. _Built: AC-2 / AC-3; STD-004 (isolation is the acceptance bar) + STD-011 (one canonical membership predicate)._

### Roles / permissions (BUILT)
STATUS: written
SCOPE: platform
MAPS-TO: —
PIECES: role_chokepoint, permission_gate, member_console
One `can()` role/permission chokepoint gating visibility + write authority (owner/manager/staff), the agnostic member/device console at `/team`, and a three-tier role store (floor → override → custom). _Built: RBAC spine (ledger #86–#88); OP-11._

### Order create / edit with server recompute (BUILT)
STATUS: written
SCOPE: platform, vertical:cultivar
MAPS-TO: 2.1
PIECES: order_crud, server_recompute, inventory_rereserve
Full order CRUD — create + `/orders/:id` drill-in edit (qty / lines / services / delivery / status / delete), each SERVER-recomputed (re-read sell_price, re-net services, re-tax) with inventory re-reserved/released; staff read-only, enforced server-side. _Built: STD-016 (edit recomputes through the canonical path); the edit-drops-tier facet is the GAP below._

### Manager permissions effective after account creation (GAP)
STATUS: gap
SCOPE: platform
MAPS-TO: —
PIECES: manager_perms_apply, role_reapply
NEEDS: existing member rows need a role re-save (or `seed-role-floor` re-run + re-apply) to hold newly-declared perms. Open item #3 (carried from ledger #100).
_Coverage placeholder, not a fabricated scenario._ A perm declared after a role was materialised does not take effect for its members until that role is re-applied. Honest-debt: fails closed/safe (a member without the perm is refused, never wrongly granted), but the capability isn't complete until re-application is automatic.

✏️ **CORRECTED 2026-08-28 — this card carried a sentence that had been FALSE for four weeks, and the correction is left visible rather than quietly overwritten.** It read _"owners unaffected (gated by `owner_id`), so the owner path proves today"_. The [[2026-07-30]] ruling **removed the owner branch from both permission functions**: an owner passes because their stored array contains the string, exactly like everyone else, which means **the owner is affected by this gap in precisely the same way a manager is** — and that is not a hypothetical, it is why the 2026-08-28 pass had to ship a funnel re-materialisation alongside its manifest flip rather than the flip alone. The card was the one place on the board still describing owners as exempt; it was found by the pass that would have been broken by believing it. See [[Hand over the keys — the owner role outlives the person who opened the account]].

### Placement / service-line increment edit persists (GAP)
STATUS: gap
SCOPE: vertical:cultivar
MAPS-TO: 2.1
PIECES: service_line_edit, qty_increment_persist
NEEDS: LOOK before fixing — recon the order-edit service-line path (submit.ts `handleUpdate` + `order_service_selections`). Open item #4.
_Coverage placeholder, not a fabricated scenario._ Editing a service line's increment/quantity on an existing order does not reliably persist through the recompute. A facet of the order-edit path — the money recompute is built (above), this specific service-line increment edit is the open gap.

### Order edit re-applies the tier (edit-drops-tier) (GAP)
STATUS: gap
SCOPE: platform, vertical:cultivar
MAPS-TO: 2.1, 3.7
PIECES: handleupdate_tier, edit_pricing_reapply
NEEDS: fold the roster order-edit path through `computeOrderPricing` tier/basis-aware (today `handleUpdate` recomputes baseline `sell_price` only, not tier-aware). Carried across builds (#107 / #114); STD-016 names it as its own recurring line.
_Coverage placeholder, not a fabricated scenario._ An edited tiered order can silently drop its discount because `submit.ts handleUpdate` recomputes baseline price only, not tier-aware. The canonical fix is to route the edit through the same `computeOrderPricing` a create uses (STD-016).

### Inventory reconciliation — counted vs expected (GAP)
STATUS: gap
SCOPE: vertical:cultivar
MAPS-TO: 4.2
PIECES: inventory_reconcile
NEEDS: capability-roster line — the fuller day-in-the-life is the **"Reconcile counted vs expected"** story (ARC asset-inventory-pmi, 4.2). UNBLOCKED by [[D-42]] (real per-unit depletion now exists = expected-on-hand is computable) but the reconcile surface (sold / dead / missing) is not built.
_Counted-on-hand vs what the books expected, surfacing shrinkage — deferred, not built. Roster entry for the Built/Building view; the narrative lives in the 4.2 story above._

### Reorder threshold / low-stock alert (GAP)
STATUS: gap
SCOPE: platform, vertical:cultivar
MAPS-TO: 5.1
PIECES: reorder_point, low_stock_alert
NEEDS: the `reorder_point` stub column exists (additive, [[D-42]]) but carries no threshold logic yet. David to set whether the alert is a dashboard readout, a notification, or both.
_Coverage placeholder, not a fabricated scenario._ A low-stock threshold on the `reorder_point` stub that flags when a lot needs reordering. The schema slot was homed with the decrement build; the logic is the next build.

### Data export / portability — owner gets their data (GAP)
STATUS: gap
SCOPE: platform
MAPS-TO: —
PIECES: data_export_csv, portability
NEEDS: David to scope — on-thesis for the loose-coupling / no-lock-in pitch (the owner can always take their data). Concept only today; no export path built.
_Coverage placeholder, not a fabricated scenario._ The owner can export their own data (customers, inventory, orders) as CSV — portability that backs the "we don't lock you in" promise. Not built; a standard capability the roster now tracks so it isn't ambushed later.

### CSV catalog / customer import (INVENTORY HALF BUILT — customer half still GAP)
STATUS: written
SCOPE: platform, vertical:cultivar
BUILD: active
MAPS-TO: 1.3
PIECES: csv_import
NEEDS: the CUSTOMER half. Distinguish from receipt-OCR (which is IMAGE-only); a CSV mistakenly fed to the image-OCR path is not import — it's the wrong door.
_The INVENTORY half is BUILDER-COMPLETE (2026-07-23, ledger #148 + #149, owner-proof owed):_ `/inventory/import` (VIEW_COSTS-gated per #149, desktop, its own door) — a user with inventory access uploads a grower price-list CSV, maps its columns to the catalog spine (a 4-rung ladder over ONE platform-wide synonym dictionary), reviews a per-row plan (FILL/UPDATE/CREATE/AMBIGUOUS/CONFLICT/REFUSED — a physical count is never overwritten without an explicit per-row action, David 2026-07-23), and Accepts. Writes ride the D-50 ledger RPCs (qty, kind='import') + the patch path (attributes/size); zero new api-fn. Pure core in `packages/shared/src/import/`. **BULK PRICE import is a separate authority — `import_pricing` (#149, David's ruling 2026-07-23):** defaults OWNER-only, grantable to a manager on /team; a manager without it imports QUANTITIES while prices show as won't-be-written; enforced SERVER-SIDE by the `import_write_price` RPC (a blast-radius control on bulk writes, NOT a price wall — a view_costs manager can already edit sell_price one cell at a time). **STILL A GAP: a first-class CUSTOMER CSV import** — the same door shape, distinct from this inventory path and from the image-only receipt-OCR pipeline.

### Tax exemption reachable + working via the customer editor (DEMO-OPERATIONAL)
STATUS: demo-operational
SCOPE: platform, vertical:cultivar
MAPS-TO: 2.1
PIECES: exemption_ui, customer_editor
Must WORK IF POKED: marking a customer tax-exempt (reason required) through the `CustomerPartyEditor` UI actually zeroes their order tax and shows "Tax exempt — [reason] · cert" on every surface. _Built path: [[D-40]] + [[D-41]] UI; not necessarily in the scripted demo flow but functions if the owner tries it._

### Order status lifecycle visible + settable (DEMO-OPERATIONAL)
STATUS: demo-operational
SCOPE: platform, vertical:cultivar
MAPS-TO: 2.1
PIECES: order_status, status_transitions
Must WORK IF POKED: an order's status (Pending → Invoiced → Fulfilled → Cancelled) is visible on the roster/detail and settable by owner/manager, with cancel releasing reserved stock. ⚠️ **VOCABULARY CORRECTED 2026-08-28 (R-STATUS ratified, David): `Confirmed` → `Invoiced`.** This story read `Confirmed` and would have sent a reader to a status that no longer exists — the §9 story gate's CONFLICT case, resolved by the ruling that supersedes it rather than by a build choice. The four now match QuickBooks; out of `pending` an order goes to `invoiced` and onto the schedule, and scheduling lives on the DELIVERY row rather than in a fifth status. _Built path: order CRUD (ledger #100) + [[D-42]] restore-on-cancel + ledger #225 (rename + data migration)._

### Filter the orders roster by status
STATUS: written
SCOPE: platform, vertical:cultivar
ARC: delivery
MAPS-TO: 2.1
PIECES: order_roster, status_filter_chips, roster_count_sentence
Lauren works the orders screen daily and it shows every order, always — she created an estimate on it with a customer standing in front of her. She needs to narrow it: one chip per status, multi-select, and one tap back to all. The default is EVERY order (David's ruling — her habit is the unfiltered screen, and a default that hides rows on day one is how someone concludes an order vanished); the chips are the discovery. Whenever a filter is on the screen SAYS what it is hiding — "showing N of M" — and it names the 50-row page cap rather than reporting a ceiling as a total. **The chip set is DERIVED from ORDER_STATUSES unioned with the statuses actually present in the data, never typed**, so no order can exist that no chip selects: that is the `needs-build` defect (2026-08-27) prevented rather than repeated. A filtered list that fails to load renders as "couldn't load orders", never as "no orders match" — the two sentences say opposite things. Shipped WITH the R-STATUS vocabulary rename, deliberately: filtering against the old words would have meant building it twice and leaving an in-between state whose chips did not match its data. _Grounded: ledger #225; orderRosterFilter.ts + orderRosterFilter.test.ts (30 probes, proven red-first), Orders.tsx; owner test docs/owner-tests/orders-roster-full-surface-test.md._

### Discount shows as a line on order-detail + QBO (DEMO-OPERATIONAL)
STATUS: demo-operational
SCOPE: platform, vertical:cultivar
MAPS-TO: 2.1
PIECES: discount_line, order_detail_render, qbo_render
Must WORK IF POKED: the persisted per-line discount breakdown renders as a visible discount line on `/orders/:id` AND the QBO invoice (not just Review/Confirmation) — the receipt reconciles to what was charged. _Built path: [[D-43]] persistence; STD-012 persistence clause._

### Document / file HOSTING (SCOPED-OUT)
STATUS: scoped-out
SCOPE: platform
MAPS-TO: —
PIECES: —
**Reason:** TRACE stores **references / links**, not files — hosting (certs, EIN, contracts) is the customer's (Google Drive, etc.). `tax_exempt_cert_doc_url` is a LINK field, not an upload. Deliberate non-goal, not a gap.

### Inbound customer communication / support inbox (SCOPED-OUT)
STATUS: scoped-out
SCOPE: platform
MAPS-TO: —
PIECES: —
**Reason:** The platform is **send-only** (transactional out only) — the owner's email is Gmail/Outlook, which owns the inbound side. No support-inbox / two-way messaging is built or planned.

### CRM interaction / touch-log per customer (SCOPED-OUT)
STATUS: scoped-out
SCOPE: platform
MAPS-TO: —
PIECES: —
**Reason:** Customer history **IS order history** ([[D-44]] `/customers/:id`) — there is no separate per-customer interaction/touch-log. Deliberate: the order ledger is the record.

### Customer segments / lists (SCOPED-OUT)
STATUS: scoped-out
SCOPE: platform
MAPS-TO: —
PIECES: —
**Reason:** Deferred WITH the planned SMS/social work — not a standalone capability. Segments/lists arrive (if at all) as part of that thread, not as an independent build.

### Invoice numbering / void / credit-note / refund (SCOPED-OUT)
STATUS: scoped-out
SCOPE: platform
MAPS-TO: —
PIECES: —
**Reason:** LAWNS uses **QBO**, and QBO owns the invoice lifecycle (numbering, void, credit-note, refund) — the [[D-37]] money boundary. TRACE ORIGINATES cart/QR orders and hands off; it does not run the invoice lifecycle.

### Connector-management CONSOLE — full UI (SCOPED-OUT)
STATUS: scoped-out
SCOPE: platform
MAPS-TO: —
PIECES: —
**Reason:** The connector / gap-filler tile + integration-registry model is DECIDED (2026-05-23); `business_modules` is the partial impl and QBO-connect works — that's enough for the demo. A full connector-management console is **post-demo**, not a gap. 🔴 **WHAT THIS ROW DOES *NOT* COVER (amended 2026-08-23, ledger #203 — the row STANDS, its boundary is now stated):** this is about a CONSOLE — connection health, credentials, per-module configuration. **It was never about a module's ON/OFF SWITCH, and that switch is IN SCOPE.** It is the unfinished half of David's own 2026-08-02 `core_optional` ruling — *"core-with-a-switch: it ships with the platform and a nursery that gives contractor discounts turns it on"* (`docs/RULINGS.md`) — and `docs/built-inventory.md` states `core_optional` means *"OFF until the owner switches it"*. ⚠️ **The DATABASE already documents a feature the PRODUCT lacks: the RPC's own refusal string at `20260802c:127` reads *"enabling **or disabling** a module changes what this business pays"*, while #201 found ZERO callers pass `false` and no off affordance exists anywhere.** **So a build of the off switch does NOT contradict this row and does not need it flipped.** Rulings R-1 … R-4 (2026-08-23) govern that switch: core cannot be switched off · the disabled tile is the fuzz · the route renders the fuzz rather than blocking · marketplace scope is a set.

### Multi-currency (SCOPED-OUT)
STATUS: scoped-out
SCOPE: platform
MAPS-TO: —
PIECES: —
**Reason:** Single-currency by design; multi-currency is deferred. Not needed for the LAWNS demo or the near-term verticals.

### Level-2 address-based tax API / saved ship-to address book (SCOPED-OUT)
STATUS: scoped-out
SCOPE: platform, vertical:cultivar
MAPS-TO: —
PIECES: —
**Reason:** TX is **origin-based** for in-state sellers — one rate at the seller's location is legally correct ([[D-40]]). Destination-jurisdiction resolution + a saved `customer_addresses` ship-to book are **Level-2, post-demo**, hooked at the `resolveTaxRate` seam. The platform never computes a jurisdiction rate; the owner enters theirs.

### Immutable compliance-audit row for exemptions (SCOPED-OUT)
STATUS: scoped-out
SCOPE: platform
MAPS-TO: —
PIECES: —
**Reason:** The order columns are sufficient for Level-1 exemption ([[D-40]]); an immutable per-exemption compliance-audit row (BENCH-G) is a **volume-justified hardening**, deliberately deferred until scale warrants it — not a Level-1 gap.

---

## ARCHIVED

_Delivered or retired stories move here for history. They render muted and only appear in the All / Archived views._

### Capture an invoice from where I manage deliveries (the second door)
STATUS: written
SCOPE: vertical:cultivar, platform
BUILD: archived
ARC: ocr-doc-routing
MAPS-TO: 3.5
PIECES: capture_invoice_launcher, ocr_second_door
The owner is standing on the delivery-schedule / route screen and a vendor invoice lands in hand — a persistent owner-gated **"Capture invoice"** button in the header opens the SAME invoice OCR→infer→route pipeline (ReceiptKeeper, `shape:'invoice'`) as the Receipts tile, then returns them to the route with the new stop bucketed. ONE pipeline, two doors — the entry point moved, nothing was rebuilt (mirrors the asset-capture two-door pattern). _Grounded: ledger #85, commit 134bacd (`CaptureInvoiceLauncher.tsx`); renders on BOTH delivery/route + delivery/schedule (mobile + desktop), both doors open the existing flow, `[TRACE:ROUTER] entered-from:route`; OWNER-PROVEN 2026-07-06. Board 3.5 · ARC-2 / ARC-5._

### Route the day's deliveries
STATUS: written
SCOPE: vertical:cultivar
BUILD: archived
ARC: delivery
MAPS-TO: 3.5, 3.6
PIECES: delivery_geocode, delivery_map_pins, route_optimize
The owner has several stops on one working day. TRACE geocodes each customer's address, drops numbered pins on an embedded map anchored at the farm (400 Honeycomb Mesa, Leander), and draws a REAL road-following driving route — origin=farm, waypoints=stops, back to farm — with the stops reordered shortest-path (optimizeWaypoints) so the pins, the on-card list, and the route all agree. The card summarizes total miles + drive time. Directions error / >25 waypoints degrades to a straight polyline, then to an "Open in Google Maps" URL card — never a stuck map. _Grounded: 420e0bc (optimized route, proven Jun 27), f7f65cb (map + geocoded pins), OWNER-PROVEN 2026-07-03. Board 3.5/3.6._

### The repeat customer — same contractor, three job sites
STATUS: written
SCOPE: vertical:cultivar
BUILD: archived
ARC: delivery
MAPS-TO: 3.7, 3.5
PIECES: org_dedup, person_org_classifier, customer_one_source
Dave's Tree Service orders three loads in one week, shipping to three different job sites — Leander, Georgetown, Dripping Springs. The owner ingests three invoices; TRACE sees one billing identity (name + billing address), not three new customers, and lands three DELIVERIES under the one CUSTOMER — never splitting the contractor across sites, never minting a duplicate. The sibling case proves the other direction: Cedar Park HOA repeats to the SAME site → still one customer, deliveries multiply. Because identity lives on the customer and destination on the delivery, fixing the name once reflects everywhere. Orgs keep their whole name and skip the people spine; a person splits first/last. _Grounded: b33786c (dedup, proven both cases), person/org classifier, one-source edit — OWNER-PROVEN 2026-07-03._

### See and fix my customers, without leaving the route
STATUS: written
SCOPE: vertical:cultivar
BUILD: archived
ARC: delivery
MAPS-TO: 3.7, 3.5
PIECES: customer_roster, customer_edit_modal, delivery_date_edit
The owner opens /customers and sees every customer on one roster — the 3rd DataSheet consumer after inventory and assets — sort, search, hide-columns, inline-edit name/phone/email/address, owner-only. From a delivery card the owner taps "Edit customer" and a modal opens OVER the current route/map (per-field-on-blur, no Save button) instead of yanking them to the roster. The same card carries an inline date field to MOVE a delivery to another working day (the invoice router had scheduled one on a Sunday) — it re-groups under the new day. One form body, one rule set, shared between roster and modal. _Grounded: 52997c0 (roster), 3e7806a (modal), b2621a6 (date-edit), OWNER-PROVEN 2026-07-03. Board 3.7/3.5._

### Ring up the sale — QR to cart to a real QuickBooks invoice
STATUS: written
SCOPE: vertical:cultivar
BUILD: archived
MAPS-TO: 2.1, 4.1
PIECES: qr_checkout, cart_review, customer_capture, qbo_invoice
The counter flow that started the demo: scan a plant's QR → add-ons (netting) → quantity → cart review with 8.25% TX tax → capture the customer → and a REAL QuickBooks invoice is created automatically (production Intuit approval), with a confirmation screen and the leakage flag if netting was declined. TRACE creates the invoice and feeds it forward into the customer's books — the base commerce loop, distinct from the BANKED "originate ahead of QBO" inversion (which would make TRACE the upstream system of record). _Grounded: 817b316 (US-003→US-010 full checkout + QB invoice), `qbo/invoice/cultivar.ts` QBO push; re-proven on the recovered tenant 2026-07-03; board 2.1 cart live / 4.1 QuickBooks live._

---

## DAVID ACTIONS — owner wall-clock (NOT builds)

_Owner-side actions that GATE stories above. These are not builds Thunder can do — they are David's to execute (account setup, verification lags, domain wiring, data re-entry). Listed here so the blocking dependencies are tracked in one place beside the stories they unblock. (Not `###` stories — they do not render as cards; the story renderer only parses `###` headings.)_

- **Stripe account under the TRACE EIN** — verification lag. **GATES Rail B** (platform billing). Until it clears, the business-pays-TRACE rail cannot be built or tested.
- **Re-level TRACE Enterprises to BuiltWithCAI / general** — the pre-wipe snapshots show TRACE computed as a FLAT tenant; the [[D-14]] overhead carve-out is DECIDED but NOT built, and TRACE needs to sit at the BuiltWithCAI/general level. Also **wire the BuiltWithCAI domains** (`.com` explains / `.app` entry; `home.builtwithcai.app` pointer deferred on the core `.app`, per [[D-27]]). Feeds the platform-economics epic + the residence front-door.
- **Re-enter the infra cost floor** — the per-tenant infra costs were WIPED with the old DB; **Model B ([[D-16]]) needs per-tenant cost-to-serve** to compute a price. Until re-entered, the pricing engine has no cost floor to divide.
- **Stand up the REFERENCE / build environment** (a cheap disposable duplicate — no paying-customer data, break-freely). **TRIGGER: before LAWNS's data becomes real** (go-live prep), NOT sooner. Open shape (recon when triggered, not now): two-project (cleanest isolation, ~doubles some infra) vs Supabase branching vs seed/reset of a reference tenant — cost kept low since no paying customer. The hard part is not the copy; it's the promotion discipline ([[OP-12]] / the DEPLOY TO LIVE completion bar) that keeps reference and live schemas from drifting.
- **Provision SMS (Twilio) for PIN-reset delivery** — the agnostic PIN-reset spine (ledger #87) has an SMS-coded-link path that is STUBBED today ("Send reset code by SMS — not configured", references `business_members.phone`). Standing up Twilio (~$5–15/mo floor + A2P carrier registration) lights it up (and future notifications). **GATES** the SMS leg of the "Manage how I unlock" story; the owner-arm → member `/reset-pin` reset-screen path already works without it.
- **PWA-wrapper DECISION (recorded 2026-07-07): PWA now / Capacitor post-demo** — per the Aug-4 constraint, wrap as a thin PWA now (manifest + icons + apple-meta + app-shell SW, ~3–4h additive, no native shell) and move to Capacitor post-demo when a native shell (passive background capture, locked-phone rhythm logging) is worth it. **Build not started** — sequence AFTER the resolver + session fixes (the SW interacts with the offline/session surface). See 🔴 PWA wrap in `TRACE-SESSION-BOOTSTRAP.md` ⚡ ACTIVE STATUS.
- **Pending CLAUDE.md addition (David-flagged, not yet added): Thunder must EXECUTE its own migration verification queries before presenting them** — surfaced by the polname/comment typo incident (a verification query was presented that would not have run as written). Record here as the pending standing-instruction; add to CLAUDE.md §9 (schema-verification gate) in a future edit pass.
