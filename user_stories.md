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
The catalog-populate engine is BUILT (board 1.3 — 114 real varieties read live 06-21, D-9 honesty-flagged). This is the demo-facing activation: land LAWNS's own 116 rows as real, priced inventory so a walk-and-count / QR-checkout demo runs on real stock. _Grounded: board 1.3 (`discovery/catalog.ts`, migration-gated); the Woo CSV in hand; board 5.1 inventory live._

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

---

## ARC: asset-inventory-pmi

_Assets → inventory → walk-and-count → preventive-maintenance schedule → service log._

### Count the lot without paper
STATUS: needs-input
SCOPE: vertical:cultivar
BUILD: in-build
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: inventory_count, inventory_count_offline
NEEDS: David to expand into full day-in-the-life prose.
_Placeholder (David to expand into full day-in-the-life prose)._ The manager walks the lot with a phone, scanning each plant's QR tag, entering the on-hand count, saving, and moving straight to the next — until the lot is counted and a session summary closes it out. The loop must never dead-end: an unreadable tag falls back to manual entry, an unrecognized scan is handled gracefully (quick entry or skip-and-flag) rather than stalling. Counting in a field with no signal must still work (offline). _Grounded in ledger #54 — the scan→resolve→qty→save→next→complete loop is BUILDER-COMPLETE; the offline piece is still ahead._

### Count promotes size + qty into inventory (the count IS the catalog)
STATUS: written
BUILD: in-build
SCOPE: vertical:cultivar
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: size_picker, need_clarification_seam, count_promote, resolve_before_create
NEEDS: OWNER-PROVE (D-45). The count-side size-picker (L5 NEED_CLARIFICATION seam) is OWNER-PROVEN (ledger #72) — the old "gating landmine" is CLEARED.
Lauren walks the lot with a per-variety QR on each variety (the SAME QR across all its sizes). She scans Shoal Creek Vitex, the app resolves the VARIETY, she taps "30 gal" (or types it — a free label) and enters 45. Save. Scan the same tag, tap "45 gal", enter 12 — a SECOND stock row is born under the same variety. When she opens the inventory grid or rings up an order, BOTH sizes are there at their prices, because the count didn't just log a number — it PROMOTED size + qty into a `variant_group`-keyed `business_inventory` row (create-or-update), the one store the grid and the order picker actually read. A variety she's never seen, typed by hand with no QR, resolves to the right existing variety even if she spells it a little differently (token-set equality) instead of orphaning into duplicates. Nothing born unsellable-silently: a new size starts needs-price (the cart refuses $0), never a fabricated price. _Grounded: D-45 (`docs/decisions/2026-07-14-count-promote-D45.md`), ledger #124 — closes the count-size-persist bug (buildspec item 4, never shipped) + the `variant_group` orphan-read; reuses the #61 token-set resolver + the #72 size-picker (now folded into the review size-control). Built 2026-07-14, BUILDER-COMPLETE, owner-proof owed. HOOK named not built: per-size unit-multiplier (a "flat" = N plants)._

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

### On the lot — scan a tree, see the price because I'm here
STATUS: needs-input
SCOPE: vertical:cultivar
BUILD: active
MAPS-TO: 2.1, 3.4, 2.2
PIECES: geo_price_gate, tree_qr_lookup, jit_offers, self_checkout
NEEDS: David to set GEO-gate policy (radius/accuracy) + pay-online-vs-office-kiosk (the kiosk/online path is the QBO-inversion, see the banked cart story). No commerce arc exists (—).
A customer parks at LAWNS, wanders rows of trees, scans the QR on one — TRACE tells them about it, and because their phone is ON the property (GEO), the price shows automatically. They cart it as they walk, keep browsing, then choose pickup or delivery. Just-in-time offers ride along: pickup surfaces netting + fertilizer; delivery opens the schedulable slots. At the front office Lauren adds relationship detail, and a kiosk-mode payment closes it — or they paid online. Shares the AC-4 gated-price KEY (here = LOCATION) with its siblings below.

### On the web — register to see the price, then build a cart
STATUS: needs-input
SCOPE: vertical:cultivar, platform
BUILD: active
MAPS-TO: 2.1, 5.6
PIECES: registration_price_gate, cart, jit_offers, delivery_or_pickup
NEEDS: David to set the minimum details that unlock price + the origination fork (does this cart create the order upstream of QBO — the banked inversion).
A customer browses the LAWNS website, clicks a tree they want — but can't cart it or see the price. The move: a light registration (name, address, ZIP) is the KEY that unlocks price and moves them into a cart. There they accept the price, pick add-ons (netting, fertilizer), and choose delivered / delivered-and-planted / pickup — every option a just-in-time cost surfaced BEFORE checkout, not after. On submit it routes to fulfillment. Shares the AC-4 gated-price KEY (here = REGISTRATION). → 2.1 (cart) + 5.6 (online shop, stub).

### Contractor / tier pricing — set a tier, the discount actually comes off
STATUS: needs-sub-stories
SCOPE: vertical:cultivar, platform
BUILD: active
MAPS-TO: 3.7, 2.1
PIECES: tier_discount_apply, tier_assign_ui, tier_discount_map, contractor_program
NEEDS: (mechanism) DECIDED 2026-07-08 — tier→discount is PERCENT-OFF-BASELINE, owner-set per tier, default 0% (retail=0, contractor=10 owner-editable, wholesale owner-set); build flips the submit.ts AC-4 hold. Still owed → (config) an owner surface to set the per-tier % AND to ASSIGN a tier to a customer — today customers.price_tier is DISPLAY-ONLY (Customers.tsx:141-142), no assignment UI exists at all; (program) the full "Become a Contractor" register→verify→approve→notify→paid flow (§3/§4, all net-new, not demo-critical).
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
NEEDS: tier→discount MODEL now DECIDED (2026-07-08) — PERCENT-OFF-BASELINE, owner-set per tier, default 0%. STORAGE resolved by recon — rides business_pricing_config.config jsonb as a `pricingTiers` key, NO migration (financialDataAccess.ts:171/199). Still owed from David: WHERE the set-% control lives (likely CostToProduceSettings / Settings) and the tier-ASSIGNMENT surface (customers.price_tier is display-only today — Customers.tsx:141-142).
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
PIECES: qbo_readback, qbo_customer_dedup
NEEDS: David to scope — today QB integration is create-ONLY (push invoice/customer; no read-back, no de-dup against existing QBO customers). Read-back + matching an incoming customer to an existing QBO record (so TRACE doesn't create a duplicate in the customer's books) is net-new.
TRACE currently WRITES to QuickBooks (invoice + customer create, board 4.1 live) but never READS back. The gap: when an invoice comes in, match its customer to an existing QBO customer instead of minting a duplicate in the owner's system of record. TRACE-internal org-dedup exists (board 3.7); de-dup AGAINST QBO does not. _Grounded: board 4.1 (`api/qbo/*`, create-only); board 3.7 (internal dedup, different target)._

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
NEEDS: existing MANAGER member rows need a role re-save (or `seed-role-floor` re-run + re-apply) to hold newly-declared perms like `manage_orders`; owners unaffected (gated by `owner_id`), so the owner path proves today but a manager doesn't inherit a new perm until re-applied. Open item #3 (carried from ledger #100).
_Coverage placeholder, not a fabricated scenario._ A perm declared after a manager's role was created does not take effect for that manager until their role is re-applied. Honest-debt: fails closed/safe (a manager without the perm is refused, never wrongly granted), but the capability isn't complete until re-application is automatic.

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

### CSV catalog / customer import (GAP)
STATUS: gap
SCOPE: platform, vertical:cultivar
MAPS-TO: 1.3
PIECES: csv_import
NEEDS: distinguish from receipt-OCR (which is IMAGE-only). A catalog import exists (the Woo/discovery catalog path); a general CSV import for customers/inventory is the gap. A CSV mistakenly fed to the image-OCR path is not import — it's the wrong door.
_Coverage placeholder, not a fabricated scenario._ A first-class CSV import path for customers/inventory, distinct from the image-only receipt-OCR pipeline. The catalog-populate engine imports a Woo export; a general owner-facing CSV import is not built.

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
Must WORK IF POKED: an order's status (Pending → Confirmed → Fulfilled → Cancelled) is visible on the roster/detail and settable by owner/manager, with cancel releasing reserved stock. _Built path: order CRUD (ledger #100) + [[D-42]] restore-on-cancel._

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
**Reason:** The connector / gap-filler tile + integration-registry model is DECIDED (2026-05-23); `business_modules` is the partial impl and QBO-connect works — that's enough for the demo. A full connector-management console is **post-demo**, not a gap.

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
