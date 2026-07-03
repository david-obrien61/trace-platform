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

---

## ARCHIVED

_Delivered or retired stories move here for history. They render muted and only appear in the All / Archived views._

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
