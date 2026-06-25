# CAPABILITY PACKAGE — GROUND-TRUTH RECON

> ↑ **FEEDER doc.** The canonical live-status front-page is `TRACE-SESSION-BOOTSTRAP.md` → 📋 24-CAPABILITY BOARD (this recon is its 2026-06-19 baseline, reconciled to today there). For current colors/state, read the board.

**Date:** 2026-06-19 · **Author:** Thunder (Claude Code) · **Type:** verify-first recon, READ-ONLY
**Verifies:** `docs/customer-onboarding-capability_v1.md` (Lightning's 24-capability synthesis)
**Method:** Four sources, only two are authority. (A) the v1 package = a claim. (B) `built-inventory.md` = a claim (same artifact-class as PLATFORM_STATE.md, which produced the phantom `pmi_assets`). (C) Cultivar code + tables + endpoints = authority. (D) Ignition code = authority for "already-proven-elsewhere." Every verdict below was formed from the CODE first (file:line), THEN compared to the flags. **Anti-anchoring held:** I did not confirm a flag because the doc said so.

> **Note on the count.** The v1 doc is titled "24-capability" but enumerates **25 rows**: L0/0.1 is the foundation ("the why under everything"), not a demo-touching capability. The 24 are L1–L5. This report covers all 25; headline math uses the 24 (L1–L5) with 0.1 broken out.

---

## 1. THE 25-ROW VERDICT TABLE (four-way)

Legend — **Cultivar (C):** LIVE / PARTIAL / NET-NEW / NOT-FOUND. **Ignition (D):** LIVE-C (lives in Cultivar) / EXTRACTABLE (liftable to shared) / REF-ONLY (welded, re-implement) / NET-NEW-ANYWHERE. **Reconcile:** ALL-AGREE / STATUS-DISAGREE / IN-PKG-NOT-INV / CODE-NOT-IN-DOCS / PHANTOM.

| ID | Capability | **My C verdict** | **D (Ignition)** | Lightning said | Agree? | A/B/C reconcile | Key evidence (file:line) |
|---|---|---|---|---|---|---|---|
| 0.1 | Capability-composition / vertical-as-pointer | **PARTIAL** | NET-NEW-ANYWHERE (typed config) | 🟡 PARTIAL | ✅ AGREE | ALL-AGREE | `businesses.business_type` `20260529_businesses_a:14`; `business_modules` `20260604`; **no** `shared/src/config/VerticalConfig.ts` (only TODO `Dashboard.tsx:11`) |
| 1.1 | Recognition "we know you" (+discrepancy) | **PARTIAL** (recognition LIVE / discrepancy NET-NEW) | NET-NEW-ANYWHERE | 🟡 PARTIAL | ✅ AGREE | ALL-AGREE | `discovery/adapters/website.ts:87-177` (live fetch); `engine.ts:24-158` (2-pass); discrepancy-compare grep = 0 hits |
| 1.2 | Sandbox — alive 7-day branded dashboard | **NOT-FOUND** | NET-NEW-ANYWHERE | 🔴 NET-NEW | ✅ AGREE | IN-PKG-NOT-INV (unbuilt) | `discovery/seed.ts:48-49` seeds `is_active:false, price:0` offerings only; never fires live (`ingest.ts:99` gated on businessId; `DiscoveryGlimpse.tsx:80` sends none) |
| 1.3 | Clear→real AI catalog-populate (D-9) | **NOT-FOUND** | NET-NEW-ANYWHERE | 🔴 NET-NEW | ✅ AGREE | IN-PKG-NOT-INV + **silent-coercion CONFIRMED** | engine extracts services not catalog (`types.ts:8`, `engine.ts:121`); `seed.ts:7-13` forces category→`addon`, `price:0`; D-9-in-discovery grep = 0 |
| 1.4 | AI-assisted questions → config | **PARTIAL** | REF-ONLY (Ignition wizard welded) | 🟡 PARTIAL | ✅ AGREE | ALL-AGREE | static scaffolding `verticals/nursery.ts` + `engine.ts:98-102`; no answer-capture/setup-write; `DiscoveryGlimpse` persists nothing |
| 1.5 | Handshake — one auth, two products | **PARTIAL** | NET-NEW-ANYWHERE (Ignition = PIN/local) | 🟡 PARTIAL | ✅ AGREE | ALL-AGREE; **`business_discovery_profiles` ABSENT** | one auth real `OwnerSignup.tsx:371,441`→`SignUp.tsx:44`; profile never persisted; table grep = 0 in all migrations |
| 2.1 | Cart / QR checkout, no money in-app | **LIVE** | LIVE-C | 🟢 LIVE | ✅ AGREE | ALL-AGREE | `PlantProfile→AddOns→CartReview→Confirmation`; `api/orders/submit.ts:142-157` status `pending`; **zero** stripe/charge calls |
| 2.2 | Compliance / netting (TX Ch.725) | **LIVE** (persisted, immutable) | LIVE-C | ⚪ CLAIMED | ❌ **DISAGREE (upgrade)** | STATUS-DISAGREE — code ⟹ LIVE | `NettingPrompt.tsx` (#A32D2D border, Ch.725 cite); `submit.ts:218-238` writes `order_compliance_records.decision`; `orders.netting_declined` |
| 2.3 | Walk-and-count inventory | **PARTIAL** (mostly net-new) | NET-NEW-ANYWHERE | 🟡 PARTIAL | ✅ AGREE | ALL-AGREE | OCR reusable `api/receipts/ocr.ts` + `imageCompression.ts`; **missing** count_session, size dim, catalog-match — grep = 0 |
| 3.1 | Leakage / missed-upsell visibility | **LIVE** | NET-NEW-ANYWHERE | ⚪ CLAIMED | ❌ **DISAGREE (upgrade)** | STATUS-DISAGREE; B-confirms (`built-inv:682,800,835`) | `submit.ts:128-129,154` writes `leakage_flag`; `Dashboard.tsx:160-165,694-717` alert tile |
| 3.2 | Suggestion engine (at-sale upsell) | **PARTIAL** (declarative trigger only) | NET-NEW-ANYWHERE | ⚪ CLAIMED (likely 🟡) | ✅ AGREE | ALL-AGREE; B `built-inv:1055` "tile exists, nothing built" | `trigger_transport_mode` rule `AddOns.tsx:39`; no engine in `business-logic/`; `post_purchase` offerings dead (`useServices.ts:31` filters `at_checkout`) |
| 3.3 | Post-sale service engine (triggers) | **PARTIAL** (dead schema scaffolding) | NET-NEW-ANYWHERE | 🔴 NET-NEW | 🟡 **MILD DISAGREE** | STATUS nuance — engine net-new, but `timing`/`recurrence_days` cols EXIST unconsumed | `service_offerings.timing/recurrence_days` `20260529_f:21-22,43`; templates exist (`templates/cultivar.ts:91`) but no scheduler/trigger fires |
| 3.4 | Scheduling (self-book + calendar) | **NOT-FOUND** | NET-NEW-ANYWHERE | 🔴 NET-NEW | ✅ AGREE | IN-PKG-NOT-INV | zero calendar/booking/slot table or code in either vertical |
| 3.5 | Routing / delivery management | **PARTIAL** | NET-NEW-ANYWHERE | ⚪ CLAIMED PARTIAL | ✅ AGREE | ALL-AGREE; B-confirms (`built-inv:839-851`) | `DeliveryRoute.tsx` loads delivery orders, multi-stop; transport configurable via `service_offerings`; **no** geocode/optimize/route-day (`buildMapsUrl:37-39`) |
| 3.6 | Insights / analytics dashboard | **LIVE** | REF-ONLY (`IgnitionOmniDashboard`) | ⚪ CLAIMED | ❌ **DISAGREE (upgrade)** | STATUS-DISAGREE; B-confirms | `Dashboard.tsx:128-194,662-686` 4 metric cards render; `api/dashboard.ts:28-43` |
| 4.1 | QuickBooks (invoice, refresh, source) | **LIVE** (code real; live-token caveat) | REF-ONLY (`IgnitionInvoice` = internal, not QB) | ⚪ CLAIMED LIVE | ✅ AGREE | ALL-AGREE; **migration gap** (see §4) | `useSubmitOrder.ts:66-83`→`api/qbo/invoice/cultivar.ts:88-330`; `refresh.ts:19-65` real; pull helpers `invoice.ts:36-72` unwired |
| 4.2 | Reconciliation double-whammy | **NOT-FOUND** | NET-NEW-ANYWHERE | 🔴 NET-NEW | ✅ AGREE | IN-PKG-NOT-INV | only `receiptReconciliation.ts` (receipt-internal lines-vs-total) — NOT count-vs-records; "variance" grep = 0 |
| 4.3 | Social media (post-gen + publish) | **PARTIAL** (gen LIVE, Blotato removed by design) | EXTRACTABLE (gen is already shared) | ⚪ CLAIMED mixed | 🟡 **RESOLVES mixed** | STATUS resolved; B-confirms (`built-inv:657`) | real SDK `execute.ts:70-78` via `social/generate-posts.ts`; tile WORKS (`SocialSetup.tsx:96`); Blotato inert seam `campaigns.ts:8-10` |
| 5.1 | Inventory management | **LIVE** (create+read; no inline edit) | REF-ONLY (`IgnitionStok` DTC-welded) | ⚪ CLAIMED (tile locked) | ❌ **DISAGREE (upgrade)** | STATUS-DISAGREE; B resolved-gap `built-inv:1084` | `BusinessInventory.tsx:119-168` real CRUD → `business_inventory`; route `/inventory` |
| 5.2 | Equipment PMI | **LIVE** (shared module) | EXTRACTABLE — **already extracted** | ⚪ CLAIMED (extract from Ignition) | ❌ **DISAGREE (already done)** | STATUS-DISAGREE; B resolved-gap `built-inv:1057,1085` | `shared/modules/PMI.tsx` (749 ln) + `cultivar PMI.tsx` (28 ln) + `api/pmi/suggest.ts`; Ignition origin `IgnitionTools.jsx`/`PredictiveKey.jsx` |
| 5.3 | Water system | **NOT-FOUND** | NET-NEW-ANYWHERE | 🔴 NET-NEW | ✅ AGREE | ALL-AGREE | no irrigation/zone/flush table or code (`queue.ts:84 flush()` = unrelated) |
| 5.4 | Greenhouse | **NOT-FOUND** | NET-NEW-ANYWHERE | 🔴 NET-NEW | ✅ AGREE | ALL-AGREE | only placeholder string "Greenhouse 2" `BusinessInventory.tsx:329`; no table/page |
| 5.5 | Seasonal | **NET-NEW** (tile-only stub) | NET-NEW-ANYWHERE | ⚪ CLAIMED (tile locked Phase-1) | ❌ **DISAGREE (overstated)** | STATUS-DISAGREE | `useModules.ts:41,50` tile only; no route/page/table; `'seasonal'` only a campaign_type enum |
| 5.6 | Online shop | **NET-NEW** (Coming-Soon stub) | REF-ONLY (Kiosk = vehicle-estimate, welded) | ⚪ CLAIMED (tile available Phase-1) | ❌ **DISAGREE (overstated)** | STATUS-DISAGREE; B-honest `built-inv:1054` "Enable stub" | `Dashboard.tsx:386 showComingSoon`; no `/shop` route |
| 5.7 | Contractors portal | **NET-NEW** (tile-only stub) | REF-ONLY (`CustomerApprovalPortal` welded) | ⚪ CLAIMED (tile locked Phase-2) | ✅ AGREE (locked = unbuilt) | ALL-AGREE; spec-only `built-inv:1095` | `useModules.ts:40,49` tile; no route/page; "contractor" elsewhere = labor model only |

---

## 2. PER-CAPABILITY DEPENDENCIES (infrastructure + capability)

Mark: **[E]** = EXISTS, **[M]** = MISSING.

- **0.1** — Infra: `businesses.business_type`[E], `business_modules`[E], `VerticalConfig.ts`/`config/` dir[M]. Cap deps: none (it's the substrate).
- **1.1** — Infra: website-read engine `fetchWebsiteContent`[E], AI gateway `execute.ts`[E], `ANTHROPIC_API_KEY`[E]. Discrepancy-compare logic[M]. Cap: none.
- **1.2** — Infra: target tables (`orders`/`cultivar_plants`/`customers`)[E], **a believable seeder**[M]. Cap: easier-after 1.1 (brand from site) but not blocked-by.
- **1.3** — Infra: catalog-extraction engine[M], `cultivar_plants` write path[E], D-9-in-discovery flagging[M], `business_discovery_profiles`[M]. Cap deps: 1.1 recognition[E-partial], 1.2 sandbox (clear step)[M].
- **1.4** — Infra: pain-point scaffolding[E], answer-capture + setup-write path[M], `business_discovery_profiles`[M]. Cap: 1.1[E-partial].
- **1.5** — Infra: Supabase auth[E], `businesses`/`business_members`[E], signup→onboarding redirect[E], **`business_discovery_profiles`[M]**, discovery-profile persistence[M]. Cap: 1.1[E-partial].
- **2.1** — Infra: `customers`/`orders`/`order_items`/`order_service_selections`[E] (⚠ first three NOT migration-tracked — §4). Cap: none. (LIVE.)
- **2.2** — Infra: `order_compliance_records`[E] (`20260529_g`), `service_offerings.compliance_title/body`[E], `orders.netting_declined`[E]. Cap: 2.1[E]. (LIVE.)
- **2.3** — Infra: OCR endpoint + compression[E], `business_inventory`[E], **count_session/snapshot table[M], size dimension[M], catalog-match table[M]**. Cap: easier-with 1.3 catalog (match target) but first-count can bootstrap → not hard-blocked.
- **3.1** — Infra: `orders.leakage_flag`[E], Dashboard[E]. Cap: 2.1[E]. (LIVE.)
- **3.2** — Infra: generalized suggestion engine[M]; `service_offerings.trigger_*`[E-declarative only]. Cap: 2.1[E].
- **3.3** — Infra: trigger-rule engine[M], scheduler/firing[M], action-queue table[M], `service_offerings.timing/recurrence_days`[E-unconsumed], email templates[E-static]. Cap: 3.2[M], 3.4[M] (self-book), shared notification scheduler[M].
- **3.4** — Infra: scheduler/calendar/booking table[M]. Cap: 3.3[M] (follow-up→book), 3.5[M] (route-day tie).
- **3.5** — Infra: `DeliveryRoute.tsx`[E], `service_offerings` transport[E]; geocoding/optimization[M], `orders.delivery_address`/`delivery_date` persistence[M]. Cap: 2.1[E].
- **3.6** — Infra: Dashboard + `api/dashboard.ts`[E], `business_inventory`/`orders`/`cultivar_plants`[E]. Cap: 3.1[E]. (LIVE.)
- **4.1** — Infra: `businesses.accounting_*` cols[E], QBO env[E-claimed], **live token/realm connection[?]** (un-verifiable from code), `orders.qb_invoice_id`/`customers.qb_customer_id` cols[E-live, not migrated — §4]. Cap: 2.1[E].
- **4.2** — Infra: variance-check engine[M]. Cap deps: **4.1 QB live[E-code]** AND a count source **2.3[M]** — double-blocked.
- **4.3** — Infra: AI gateway[E], `social_drafts`/`business_modules`/`advert_channels`[E]; publisher-adapter[M-removed]. Cap: none (gen standalone). (PARTIAL.)
- **5.1** — Infra: `business_inventory`[E]. Cap: none. (LIVE.)
- **5.2** — Infra: `cost_objects`(ASSET)/`business_pmi_schedule`/`business_service_log`[E], `api/pmi/suggest`[E]. Cap: none. (LIVE.)
- **5.3 / 5.4** — Infra: dedicated tables[M]. Cap: none. (NET-NEW.)
- **5.5** — Infra: seasonal-planning table[M], page/route[M]. Cap: none.
- **5.6** — Infra: storefront/public-catalog table[M], `/shop` route[M], public cart. Cap: reuses checkout 2.1 pattern[E]. (NET-NEW.)
- **5.7** — Infra: contractor-accounts/pricing-tier table[M], portal page[M]. Cap: none. (NET-NEW.)

**Shared infrastructure that many capabilities sit on (build-once, serves-many):**
1. **`business_discovery_profiles`** (MISSING) → underpins 1.3, 1.4, 1.5.
2. **Catalog-extraction engine + D-9-in-discovery** (MISSING) → 1.1 discrepancy, 1.3 populate, and the match target for 2.3.
3. **A believable sample-data seeder** (MISSING) → 1.2, and the "clear" half of 1.3.
4. **Trigger-rule + scheduler/firing engine over `service_offerings.timing`** (cols EXIST, consumer MISSING) → 3.2, 3.3, 3.4 all wait on this one engine.
5. **Count-session + size schema** (MISSING) → 2.3, and feeds 4.2.

---

## 3. DEPENDENCY ORDERING (topological read)

### Already-LIVE — nothing to build (7 + dashboard chain)
2.1, 2.2, 3.1, 3.6, 4.1 (code), 5.1, 5.2. These are demo-ready as code; 4.1 carries a **live-connection caveat** (token/realm state un-verifiable from code).

### Already-solved-in-Ignition — extract/re-implement (the fast/de-risked lane)
- **5.2 PMI** — the ONLY real Ignition-origin capability in this package, and it is **already extracted and live** in `shared/modules/PMI.tsx`. No work; the "extract from Ignition" flag is stale.
- That is the whole lane. Check-before-build finding: the things one might *assume* Ignition solved — suggestion engine (3.2), scheduling (3.4), follow-up (3.3) — it did **not**. `IgnitionCRM/Flux/Queue` are localStorage job-status boards, not reusable engines. 5.6/5.7 have only a **REF-ONLY** welded customer-authorization-portal pattern (not liftable).

### Buildable now — no unmet deps (all required infra EXISTS)
- **1.1 discrepancy-compare** — website-read engine + AI gateway already there; add a compare step.
- **1.2 sandbox seeder** — target tables exist; write a believable branded 7-day seeder.
- **3.5 polish** (geocode/route-day) — base delivery page exists; additive.
- (2.1 relabel "pay at office" — trivial, already effectively true.)

### Blocked until shared infra exists
- **1.3 catalog-populate** → blocked on catalog-extraction engine + D-9-in-discovery (+ ideally `business_discovery_profiles` and the 1.2 "clear" step).
- **1.4 ask→config** → blocked on answer-capture/setup-write + `business_discovery_profiles`.
- **1.5 handshake persistence** → blocked on `business_discovery_profiles`.
- **2.3 walk-count** → blocked on count_session + size dim (+ catalog-match; first-count can bootstrap, so soft-coupled to 1.3, not hard).
- **3.2 / 3.3 / 3.4** → blocked on the single trigger+scheduler engine over `service_offerings.timing`. 3.3↔3.4 are a **near-cycle** (follow-up self-book ↔ calendar) — build the trigger engine + scheduler together, not sequentially.
- **4.2 reconciliation** → double-blocked: needs 4.1 live AND a count source (2.3).

### Truly NET-NEW-ANYWHERE, no precedent (true unknowns / roadmap)
5.3 water, 5.4 greenhouse, 5.5 seasonal, 5.6 online shop, 5.7 contractors. (5.6 may reuse the 2.1 checkout pattern; 5.7 the labor model's CONTRACTOR enum — both as scaffolding, not as a built feature.)

**Cycles:** none hard. The only near-cycle is 3.3↔3.4 (resolve by co-building). 4.2→{4.1,2.3} is a chain, not a loop.

---

## 4. `built-inventory.md` CORRECTIONS NEEDED (for a future authorized update — NOT edited this pass)

**No PHANTOMS in this capability set.** Every "✅ built" claim in `built-inventory.md` touching the 24 was confirmed in code (5.1, 5.2, leakage, dashboard, delivery, social, QB refresh all real). The one superseded artifact (`pmi_assets`/`pmi_service_logs`) is self-documented as dead. This is the opposite of the PLATFORM_STATE.md `pmi_assets` phantom — the ledger is honest here.

Corrections are **migration-parity gaps** (live-only schema not in version control) + a few uncaptured depth items:

1. **`orders`, `customers`, `order_items` — NOT migration-tracked.** Written by `api/orders/submit.ts`, read app-wide, but no `CREATE TABLE` in `supabase/migrations/`. They exist live only. Inventory treats them as given; flag the parity gap.
2. **QB columns not migrated:** `orders.qb_invoice_id`, `orders.qb_invoice_url`, `customers.qb_customer_id` — written by `api/qbo/invoice/cultivar.ts:55,84,313`, no committed migration.
3. **Order columns not migrated:** `orders.leakage_flag`, `netting_declined`, `status`, `transport_note` — live-only, no `CREATE`/`ALTER` in repo.
4. **Uncaptured-but-built (CODE-NOT-IN-DOCS):** `order_compliance_records` (`20260529_g`) — the immutable accept/decline compliance ledger behind 2.2 — is migration-tracked but has no capability entry in `built-inventory.md`. Worth a line (it's the liability-protection persistence the netting story rests on).
5. **Uncaptured scaffolding:** `service_offerings.timing` / `recurrence_days` / `transport_mode` (`20260529_f`) — the dead-but-present schema 3.2/3.3 will sit on — isn't surfaced as the post-sale/suggestion foundation it is.

> Note: items 5.1 and 5.2 being flagged ⚪ CLAIMED in the **package** while `built-inventory.md` already lists them as **resolved gaps** (lines 1084, 1085) is a **package error, not an inventory error** — the v1 author didn't reconcile against the inventory's resolved-gaps section. No correction to the ledger; correct the package's flags to 🟢.

---

## 5. HEADLINE

Of the **24** demo-touching capabilities (L1–L5; 0.1 is the foundation, scored PARTIAL): **7 are LIVE in Cultivar** (2.1, 2.2, 3.1, 3.6, 4.1, 5.1, 5.2), **8 are PARTIAL** (1.1, 1.4, 1.5, 2.3, 3.2, 3.3, 3.5, 4.3), and **9 are NET-NEW/NOT-FOUND** (1.2, 1.3, 3.4, 4.2, 5.3, 5.4, 5.5, 5.6, 5.7). I **disagreed with 7 of Lightning's flags outright** (2.2, 3.1, 3.6, 5.1, 5.2 upgraded ⚪→LIVE; 5.5, 5.6 downgraded ⚪→NET-NEW) plus 2 nuance resolutions (3.3 🔴→PARTIAL on dead schema; 4.3 mixed→PARTIAL). The errors are **directional**: every *demo-blocking* ⚪ CLAIMED flag was **understated — actually LIVE** (netting, leakage, insights, and QB-code all real), so **Lightning's STEP-0 verify-first sweep comes back GREEN** — the demo spine is built, not phantom; while every *Layer-5 "Phase-1 tile"* ⚪ flag was **overstated — actually an unbuilt tile stub** (seasonal, online shop). **Zero claimed-built turned out PHANTOM** in this set — `built-inventory.md` is honest here (the corrections are migration-parity gaps + ~2 uncaptured depth items, not lies). **Two capabilities show built in code but live only outside version control** (`orders`/`customers`/`order_items` and several QB/leakage columns — applied directly to Supabase, no migration). And of the **9 NET-NEW-in-Cultivar, all 9 are effectively NET-NEW-ANYWHERE** — the de-risked Ignition lane is nearly empty: **5.2 PMI is the one real extraction and it is already banked**, while suggestion/scheduling/follow-up have **no Ignition precedent** (its CRM/Flux/Queue are localStorage job boards), and 5.6/5.7 offer only welded **REF-ONLY** patterns. The build cost concentrates on **one shared piece each in three places**: a discovery persistence/catalog/D-9 stack (1.3/1.4/1.5), a single trigger+scheduler engine (3.2/3.3/3.4), and a count-session schema (2.3→4.2).

---

*Recon only — no schema, code, build, or migration touched. The sole write is this file. `[TRACE:*]` instrumentation untouched (standing owner instruction). David sequences the build from §3.*
