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
> STATUS: written | needs-input | needs-sub-stories | gap
> SCOPE: <one or more of: north-star | platform | vertical:cultivar | vertical:coolrunnings | vertical:kinna | vertical:ignition — comma-separated, primary first>
> BUILD: active | in-build | archived          (OPTIONAL — build progress; default active)
> ARC: <one of the 8 arc ids below — or omit for a cross-cutting item>
> MAPS-TO: <status-board capability id(s), e.g. 2.3, 5.1 — comma-separated — or — for none yet>
> PIECES: <comma-separated build-piece names, e.g. inventory_count, inventory_count_offline>
> NEEDS: <one line — what input / sub-story / decision is owed; used when STATUS is not "written">
> <narrative + details in markdown prose / bullets, until the next ### or ##>
> ```
>
> - **STATUS** — the OWED axis (where the story is in its own lifecycle):
>   - `written` — complete, captured, no open questions.
>   - `needs-input` — drafted / stubbed but BLOCKED on a decision, detail, or direction from David
>     (the "Lightning needs David" queue).
>   - `needs-sub-stories` — the top-level story exists but the sub-stories under it are missing / incomplete.
>   - `gap` — a capability that EXISTS (in code, on the status board, or in the plan) but has **NO story yet**
>     (a coverage gap). A `gap` entry is a one-line "this needs a story," **not** a fabricated scenario.
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
_Coverage placeholder, not a fabricated scenario._ The identity/roles/security spine (auth principal → membership resolution → role/permission chokepoint → RLS wall → audit) is built, but has **no day-in-the-life story** behind it.

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

### Count-side size-picker (the gating next-build)
STATUS: needs-sub-stories
SCOPE: vertical:cultivar
ARC: asset-inventory-pmi
MAPS-TO: 2.3
PIECES: size_picker, need_clarification_seam
NEEDS: The "Count the lot" story's missing sub-story — and a LIVE LANDMINE. Build this BEFORE any per-size rows are populated.
_Coverage placeholder, not a fabricated scenario._ The size-variant migration (`20260628`) is APPLIED (cols `size` / `variant_group` live, EMPTY), but **per-size rows must NOT be populated into `business_inventory` until this picker exists** — else a multi-size scan (e.g. Shoal Creek Vitex 5/15/30/45 gal) returns >1 same-name match → `InventoryCount.tsx:263` treats `matches.length>1` as AMBIGUOUS → regresses to UNKNOWN → **breaks the OWNER-PROVEN grower-resolve** (Vitex→DISC-1105→count-45, ledger #61). The picker IS the L5 NEED_CLARIFICATION seam — the **gating next-build**. → CLOSE-OUT-LEDGER LANDMINE + ARC-MAP arc-8.

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

### Set what each contractor tier saves
STATUS: needs-input
SCOPE: vertical:cultivar
BUILD: active
MAPS-TO: 3.7
PIECES: tier_discount_map, tier_assignment
NEEDS: David to fix the tier→discount model (fixed % per tier? per-category? owner-editable) + where it's managed.
The owner defines what each contractor tier is worth — tier 1 / 2 / 3 each map to a discount % on all products — and assigns a contractor to a tier. "Contractor" is a customer price_tier, not a new entity (the column already exists), so this is the owner-side management surface on top of it, not a schema change. Set once, it flows to every price that contractor sees and every order they place. → 3.7 (rides customers.price_tier, AC-4).

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
