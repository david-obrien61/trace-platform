# Recon — the 3 customer-identity paths (feeding contractor/tier pricing)

**Date:** 2026-07-09 · **Type:** READ-ONLY recon (no code, no migration, no behavior change)
**Scope:** vertical:cultivar + platform · **Feeds:** the contractor/tier pricing shipped this session (D-35 addendum, ledger #107 — `applyTierDiscount` + config Block 5 + editable customer tier).
**Grounds Path 3 in:** the contractor-program concept = `docs/user-stories/cultivar-flows-and-contractor-program-2026-06-03.md` **§3** (onboarding/verification/login) + **§4** (config/monetization).

**The gap this maps.** Tier pricing (L1+L2) is built, but a discount only fires if the customer's IDENTITY (their `customers.price_tier`) is known at pricing time. The checkout flow captures customers as **fresh fields**, not as identified records. David defined THREE paths that each IDENTIFY the customer differently but converge on the ONE `applyTierDiscount` mechanism. This doc extracts each path's current state (file:line), marks the `[GAP]`, and PROPOSES a sequence. **Nothing is designed or built here.**

---

## Headline finding (read this first)

**The pricing mechanism is DONE — these are IDENTITY builds, not pricing rebuilds (R5).** And crucially: **Path 2's CHARGE is already wired end-to-end.** The checkout already resolves an existing customer at submit and reads that row's tier:

- `api/orders/submit.ts:132` — `const { customerId } = await findOrCreateCustomer(db, businessId, customer, 'qr-scan')` **matches an existing customer** (by person-spine email→phone, or org name+billing) or creates one.
- `submit.ts:141-143` — reads `price_tier` off THAT resolved `customerId`; `:206` applies `applyTierDiscount`.
- `customerUpsert.ts:168` — a matched row is updated with `fields` (name/phone/address/customer_type) **but NOT `price_tier`** (not in `CustomerInput`) → a matched contractor's stored tier is preserved.

⟹ **A returning contractor who enters the same email/phone at checkout is ALREADY charged their tier price today** (the mechanism landed this session). What's missing across the paths is (a) SURFACING/SELECTING identity at capture time (so it's deliberate, not a silent contact-match), and (b) SHOWING the discounted price before submit. The builds are about making identity *visible and selectable*, per path.

| Path | Who / where | Identity today | Charge tier-correct today? | Build delta |
|---|---|---|---|---|
| **1 — Manager lookup** | Authenticated staff/owner at the register (ScanOrder → checkout) | `[GAP]` CustomerCapture is new-fields-only, **zero** customer query | Only if the manager retypes the exact matching email/phone | **Medium, demo-critical.** Add a customer-search/autocomplete to the customer step (manager-gated) → select → autopopulate + SHOW tier. No schema. |
| **2 — Anonymous QR self-order** | Public checkout tail (no session) | Silent match at submit (email→phone) | **YES — already wired** (see headline) | **Small.** Surface "contractor pricing applied" post-match + confirm the retail-if-no-match path. No new match logic. |
| **3 — Logged-in contractor** | ROADMAP — contractor logs in, sees an order-only view, live cart repricing | `[GAP]` no customer-facing auth; no restricted view; cart doesn't reprice live | n/a (unbuilt) | **Largest, roadmap.** Customer-facing auth accounts (person `auth_user_id`) + restricted contractor view + live cart repricing. Propose only. |

**One likely gated migration? — NO for Paths 1+2** (both ride existing `customers` + `business_pricing_config` + the shipped mechanism). Path 3 (roadmap) MAY need a customer-account surface — a downstream build decision, not flagged here.

---

## R1 — PATH 1: MANAGER LOOKUP

**How CustomerCapture identifies the customer today: it doesn't — it's a NEW-fields-only form.**
- `packages/cultivar-os/src/pages/CustomerCapture.tsx:80-88` — plain `useState` fields (first/last/email/phone/address/city/state/zip), seeded only from `useCart` `saved` (a prior in-cart entry), never from the `customers` table. **`grep from('customers')` in this file = 0 matches** → no search, no autocomplete, no price_tier awareness. `:110` `hasErrors` validates the fields; `:126-129` builds the `CustomerInput` payload. The customer is resolved LATER, at submit, by `findOrCreateCustomer`.
- **Both the anonymous QR path AND the manager path land here.** ScanOrder (`packages/cultivar-os/src/pages/ScanOrder.tsx:157`) navigates to `/checkout/addons` → the same AddOns → CustomerCapture → CartReview → Confirmation tail (`router.tsx:90-93`). So there is ONE customer step; the manager isn't offered anything the anon customer isn't.

**What exists to build "type last name → autocomplete from roster → select → autopopulate incl. price_tier":**
- **A roster + search already exists, but it's client-side over pre-loaded rows, not a reusable lookup.** `Customers.tsx:229-230` passes `searchText`/`searchPlaceholder` to the shared `<DataSheet>`, which filters the ALREADY-loaded `customers` rows in memory (`loadCustomers` selects the whole business's customers at `:89-93`). There is **no server-side customer-search endpoint** anywhere (`grep from('customers') … ilike/textSearch/.or` = 0). So the reusable pieces are: the `customers` SELECT shape (`Customers.tsx:91`, already includes `price_tier`) and the RLS scope; a name-prefix query is net-new (a small `.ilike('last_name', …)` or load-then-filter).
- **Session distinction is already available.** `CustomerCapture.tsx:4` imports `useBusinessContext` (→ `isOwner`/role/`can`), and `useSubmitOrder.ts:53-58` already attaches a Bearer token "when a session exists" (anon customer has none). So a lookup UI can be gated to an authenticated staff/owner session and hidden from the anonymous customer (privacy — R2).

**Build delta (Path 1):** add a manager-gated customer-search field to CustomerCapture (or a pre-step) → query `customers` by name (business_id-scoped, RLS) → on select, autopopulate the editable fields AND carry `price_tier` into the flow so CartReview can SHOW the tier price before submit. The charge already honors the resolved tier (headline); this makes selection deliberate + visible, and avoids a typo missing the match. **No schema.** Demo-critical (a manager at the register is the LAWNS experience, §6).

---

## R2 — PATH 2: ANONYMOUS QR / CUSTOMER SELF-ORDER

**How the QR/scan checkout captures the customer, and the existing match logic:**
- The customer-facing checkout tail (`/checkout/addons` `/checkout/customer` `/checkout/review` `/checkout/confirm`, `router.tsx:87-93`) is **PUBLIC** — outside the `PrivateRoute` block (`:107`), so an anonymous scanner reaches it with no session. A self-serve customer **cannot** browse the roster (privacy) — correct; Path 1's lookup must stay manager-gated.
- **The match already runs at submit:** `findOrCreateCustomer` (`customerUpsert.ts:74`) → for a PERSON it resolves via the people spine (`personUpsert.ts:15-20`: match `auth_user_id` → else email → else phone among auth-less people), then falls back to email; for an ORG it matches normalized name + BILLING address, then email (`:134-165`). A hit returns the existing `customerId` (`:177`); a miss inserts (`:193`).
- **The tier then applies with no extra wiring:** `submit.ts:141-143` reads `price_tier` off the resolved id and `:206` discounts. A matched contractor → contractor price; no match → a fresh retail row (`customers.price_tier` DB default `'retail'`) → 0% → full price. **This is exactly David's decision ("enter info → match by phone/email → apply tier if found, retail if not") and it is already the behavior.**

**Build delta (Path 2):** essentially **display + confirmation, not match logic.** (a) Optionally SHOW "contractor pricing applied" on CartReview/Confirmation when the resolved tier ≠ retail (today the discount is silent — honest but invisible to the customer pre-submit). (b) Note the match key is contact-based, so an anon contractor must enter the SAME email/phone the nursery has on file — worth a small "already a contractor? use your registered email/phone" hint. **No new endpoint, no schema.** Smallest of the three at the charge level (already done); the only real work is surfacing.

---

## R3 — PATH 3: LOGGED-IN CONTRACTOR (ROADMAP — grounded in the concept doc)

**What the concept doc intends (`cultivar-flows-and-contractor-program-2026-06-03.md`):**
- §3 flow: contractor registers ("Become a Contractor" CTA, business name/contact/address/phone/email/business-type/verification docs) → owner reviews + verifies + **assigns a tier** → contractor is notified → **step 8: "Contractor can now access contractor pricing on any subsequent order."**
- §4: "App displays contractor-tier pricing on **all product pages**" — i.e. LIVE, logged-in, discounted pricing everywhere, not just at submit. Monetization Option A (free) ships first. `:99` notes this is the "Phase 3 contractor portal" (`PLATFORM_STRATEGY.md`; `PLATFORM_AUDIT.md` `contractor_tiers` FLEET-tier BUILD NEW).

**What Path 3 requires, mapped to the existing spine (PROPOSE only):**
1. **Customer-facing auth accounts.** A contractor is a CUSTOMER, not business staff — so this is NOT `business_members` (that spine is for a tenant's staff, `roles.ts`/`callerPermission.ts`). The bridge that DOES exist is the **people spine's `auth_user_id`**: `personUpsert.ts:15` matches `auth_user_id` as the strongest key. So a contractor Supabase Auth account, linked to their `people` row (`auth_user_id`), and thence to their `customers` row(s) per business, is the natural model. This is a **new auth surface** (customer accounts / a contractor portal login), distinct from the staff/member auth. Per the Auth Architecture Locked Rule (real Supabase session; no PIN-only for multi-tenant customer data), it must be a real session.
2. **A restricted contractor view** ("sees ONLY an order form, nothing else"). Net-new: a locked-down route/layout that renders the inventory-as-order-form and nothing of the owner console — gated to a contractor session. The existing `PermissionRoute` machinery is staff-permission-based; a contractor gate is a different axis (customer identity, not a tenant role).
3. **Live cart repricing reading the logged-in tier.** Today pricing is server-authoritative at SUBMIT (`applyTierDiscount` in `submit.ts`). §4 wants the discounted price shown LIVE as items are added. That means the CLIENT cart (`useCart`/AddOns/CartReview) must read the logged-in contractor's `price_tier` + the business `pricingTiers` and apply the SAME `applyTierDiscount` for DISPLAY, with the server still authoritative at submit (display ≠ trust). The shared `applyTierDiscount` (`tierPricing.ts`) is reusable for the client display — the mechanism converges (R5); the new part is *live client-side display for a known-logged-in tier*.

**This is the biggest build and it is ROADMAP — propose, do not schedule now.** It also subsumes the Layer-3 contractor PROGRAM (register→verify→approve→notify, still net-new per the ledger #107 out-of-scope note). Sequencing note: Path 3's "live pricing display" is a superset of Path 2's "show the discount" — build the display seam once (R2) and Path 3 reuses it.

---

## R4 — THE TIER MODEL (multi-tier contractor) — the SMALL, READY piece

**`pricingTiers` already supports arbitrary named tiers with NO schema change.** The shape is `[{ name, discountPercent, isDefault }]` (`tierPricing.ts` / MarginEngine `PricingTier`), stored in `business_pricing_config.config.pricingTiers` (jsonb). `normalizePricingTiers` preserves ANY names → `contractor_1/2/3` at 10/20/30% is just three more entries; `applyTierDiscount` looks up by name, no code change. AC-4 (value-set grows without a migration) already covers this.

**What the two UIs need to show multiple contractor tiers:**
- **Block 5 config (`CostToProduceSettings.tsx:746`)** renders `tiers.map(...)` — it will display however many tiers exist, but today it only **edits existing tiers' %**; there is **no add/remove-tier affordance**, and the seed is a fixed 3 (`DEFAULT_PRICING_TIERS` retail/contractor/wholesale, `:228`). **Delta: add an "＋ Add tier" (name + %) / remove control to Block 5** so an owner can create `contractor_1/2/3`. Small, self-contained, no schema.
- **Customers tier picker (`Customers.tsx`, the shipped `SelectCell`)** reads the configured tier names ∪ the row's current value → it will offer `contractor_1/2/3` automatically once they're in config. **Zero delta** beyond R4's config-add.

**Flag: R4 is the smallest, most-ready piece** — it's a config-UI affordance on top of an already-general data shape. It unblocks "10/20/30% contractor tiers" for Paths 1 and 2 immediately.

---

## R5 — THE SHARED MECHANISM (scope the sequence right)

**All three paths converge on the SAME `applyTierDiscount(price, price_tier, pricingTiers)`** (`tierPricing.ts`), applied server-authoritatively at `submit.ts:206`. The IDENTITY differs per path — a manager SELECTS the customer (R1), an anon customer is MATCHED by contact (R2), a contractor is KNOWN by login (R3) — but the customer row's `price_tier` and the business's `pricingTiers` are the same two inputs every time. **⟹ These are IDENTITY builds, not pricing rebuilds.** No path re-implements pricing; each just establishes *which customer* at pricing time, then (for live display) reuses the one shared function. Scope every path accordingly: the pricing engine is frozen.

---

## PROPOSED SEQUENCE (recommend; David decides — do NOT execute)

1. **R4 — multi-tier config (contractor_1/2/3).** Smallest, ready, no schema; an "＋ Add tier" affordance on Block 5 + it flows to the Customers picker automatically. Unblocks the 10/20/30% model the owner-prove wants. **Do first.**
2. **R1 — manager lookup at checkout.** Demo-critical (the register experience, §6): manager-gated customer search in the customer step → select → autopopulate + carry `price_tier` → CartReview SHOWS the tier price. Reuses the `customers` SELECT + RLS; adds a name query + a manager-gated UI. **Do second.**
3. **R2 — anon QR: surface the applied discount.** The CHARGE is already correct (headline); this is display + a "use your registered email/phone" hint on the public customer step. Small; builds the display seam Path 3 will reuse. **Do third.**
4. **R3 — logged-in contractor portal.** Roadmap, largest: customer-facing auth (person `auth_user_id`), a restricted contractor view, and live client-side repricing (reusing #3's display seam + `applyTierDiscount`). Subsumes the Layer-3 program (register→verify→approve→notify). **Do last, as a deliberate roadmap arc, not now.**

**Dependencies:** R4 unblocks the tier VALUES for R1/R2. R2's display seam is a prerequisite-reuse for R3's live pricing. R3 needs a customer-auth decision (a new axis vs the staff/member spine) BEFORE any build — flag it to David as its own design gate. None of R1/R2/R4 needs a migration; R3 might need a customer-account surface (downstream decision).

**Cross-refs:** ledger #107 (mechanism) · D-35 addendum `docs/decisions/2026-07-09-tier-pricing-mechanism.md` · recon `docs/decisions/2026-07-08-as-built-contractor-pricing.md` (Layers 1/2/3) · concept `docs/user-stories/cultivar-flows-and-contractor-program-2026-06-03.md` §3/§4 · `customerUpsert.ts` + `personUpsert.ts` (match spine) · `CustomerCapture.tsx` (the capture step) · `Customers.tsx` (roster + shipped tier picker) · `CostToProduceSettings.tsx` Block 5 (tier config).
