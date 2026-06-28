# TRACE Built Inventory
# Flat catalog of every major capability built across all TRACE repos
# Read this before starting any build session — the thing you're about to build may already exist
# Last updated: 2026-06-28 (DISCOVERY SIZE-VARIANT CAPTURE — B-clean [ledger #62, `9f1063e`, BUILDER-COMPLETE, owner-proof owed after David applies the gated migration]: the catalog scraper now CAPTURES WooCommerce size variants instead of dropping them. NEW deterministic [no-AI] parsers in `packages/shared/src/discovery/catalog.ts` — `extractSizeVariants(rawHtml)` [PRIMARY: `data-product_variations` JSON attr → every `attribute_*siz*` value across variations; FALLBACK: size `<select>` option labels; de-duped, page order], `normalizeSize` [gallon family → "N Gallon"; "5-gallon"/"5 gal"/"#5"/"5G" collapse; non-gallon caliper/height pass through as TEXT — ANSI Z60.1 trade label], `productSlugFromUrl`, `fetchProductVariants` [bounded second-pass crawl: entry→category/shop pages→`/product/<slug>` pages, raw-fetch each, read sizes; returns only VARIABLE products]. `fetchCatalogPages` signature UNTOUCHED [tested CatalogPage[] — proven variety path undisturbed]. `populate.ts` matches sizes→varieties by the resolver's `canonicalNameKey(slug)==canonicalNameKey(variety)` [the SAME token-set key L4 uses], then writes ONE `business_inventory` row per (variety × size) — `size`=grower's published value, `variant_group`=parent slug, `name` stays the variety [so L4 still resolves the parent], each its own qty/sku; products with no variants stay single parent rows [size omitted]. GATED migration `supabase/migrations/20260628_inventory_size_variants.sql` [ADD COLUMN size text + variant_group text, nullable, NO CHECK, + grouping index — DAVID APPLIES AS postgres, schema-verification gate OWED; verify queries A-C embedded]. DEPLOY-WINDOW SAFE: if columns absent the insert collapses to parent rows [`populated-no-sizes`], so populate never hard-fails pre-migration [mirrors the deliveries pattern]. New `[TRACE:POPULATE]` variant emits [crawl/captured/matched, ON]. PROVEN: `catalog-variants.test.ts` 31/0 [JSON+select both yield 5/15/30/45 on the LAWNS Vitex shape; normalizeSize forms; bounded crawl finds the product page; per-(variety×size) expansion with variant_group; parent row omits size keys], `catalog.test.ts` 35/0 unchanged, `npm run verify` exit 0 zero NET-NEW [tsc 10 / eslint 266 / knip 10·14·15], ingest.ts bundles clean. COUNT-SIDE size-picker = REQUIRED FOLLOW-ON, NOT built [flagged]: per-size rows make a Vitex scan return >1 same-name candidate → L4 `InventoryCount.tsx:263` AMBIGUOUS→UNKNOWN [the L5 NEED_CLARIFICATION seam the code already anticipates]; the picker + sequencing [land picker before populating per-size rows live] is the next build. NO existing-table data touched.) · 2026-06-28 (CUSTOMER-ZERO RHYTHM LOGGER — instrument, not a product feature [ledger #63, `8839502`, BUILDER-COMPLETE, phone owner-proof owed]: a data-gathering instrument modeled on the field-debug capture [#60]. NEW shared `packages/shared/src/rhythm/{rhythmBuffer.ts,index.ts}` — bounded localStorage RING [5000 entries, survives reload/close via pagehide+visibilitychange flush] capturing per-entry LOCATION [lat/lng/accuracy], NARRATION [voice/text], SHAPE [buy|task|inventory-check|project] + free-text thread; `haversineMeters` move-detect; `getRhythmText`/`getRhythmJSON`/`downloadRhythm`/`shareRhythm` export. NEW `packages/cultivar-os/src/components/RhythmLogger.tsx` — `?rhythm=1`-gated [sticky] bottom-LEFT 🟢 panel [start/stop logging, 🎤/text note, shape chips, thread input, live pts/notes count, Share/JSON/TXT/Clear], mounted beside DebugPanel in App.tsx. `watchPosition` logs a point on >10m move + 60s heartbeat while still [so "sat at desk 2h" shows in the data]; voice via feature-detected Web Speech [text always the fallback]. HONEST CONSTRAINT [code+UI]: FOREGROUND-ONLY — web can't track a locked phone; background = future NATIVE build, flagged not faked. Data stays LOCAL until David explicitly exports [nothing auto-uploads]; David-only, not tenant-wired, not in nav. Purpose: gather real rhythm data [where + what + thread] to design the north-star TIMING LAYER. New `[TRACE:RHYTHM]` ON. `npm run verify` exit 0 zero NET-NEW [tsc 10 / eslint 266 / knip 10·14·15]; build:cultivar clean 2237 modules +2. NO schema/migration/RLS/auth.) · 2026-06-27 (GROWER-RESOLVE L4 — name token-set EQUALITY [ledger #61, `6e75b66`, BUILDER-COMPLETE, phone owner-proof owed]: the EQUALITY-FIRST cut of recon #59 — fixes the LAWNS walk-and-count FALSE-UNKNOWN. NEW shared `packages/shared/src/utils/canonicalName.ts` [+barrel export] = the ONE canonical-key normalizer voice/typed/QR all resolve through: `nameTokenSet` [lowercase → `&`/`&amp;`→space + drop stray `amp` entity → every non-alnum a token boundary → drop 1-char tokens + botanical connectors var/ssp/subsp/cv → Set], `canonicalNameKey` [sorted stable string], `tokenSetsEqual` [order-insensitive]. WIRED as **L4** in `InventoryCount.handleScan` after L1 `cultivar_plants.tag_id`/L2 `business_inventory.sku` and before UNKNOWN: scan-slug tokens == each candidate's NAME tokens → 1 match resolves [`{vitex,shoal,creek}` == "Shoal Creek Vitex"], >1 equal-token candidate → UNKNOWN [never auto-pick = the L5 NEED_CLARIFICATION seam], empty scannedKey skips. ROOT CAUSE [verify-first]: discovery's `populate.ts:87-98` writes the proper name + synthetic `DISC-####` sku and NO `cultivar_plants` row [`:30-33`] → a QR product-slug shared zero chars with the catalog except the name's WORDS, never compared. L3 stored-slug DEFERRED [no `source_slug` column]; L5 guarded subset/superset + L6 stemmed DEFERRED with the seam left at L4 — the FAST-FOLLOW [guarded-fuzzy + NEED_CLARIFICATION picker UI] is the next resolver build. EQUALITY-ONLY = zero false-match / no Cercis-Redbud collision exposure. NO schema/migration/auth/RLS. New `[TRACE:RESOLVE]` ON [shows the layer that hit]. 21/21 `canonicalName.test.ts` [esbuild→node: LAWNS word-order, ®/quotes/parens/`&`-amp normalization, cultivar-discriminator collision-safety, subset≠equality, empty guards]; `npm run verify` exit 0 zero NET-NEW [tsc 10 / eslint 266 / knip 10·14·15]; `build:cultivar` clean.) · 2026-06-27 (FIELD-DEBUG CAPTURE — entry-level [ledger #60, `e8c9998`, BUILDER-COMPLETE, phone owner-proof owed]: NEW shared `packages/shared/src/debug/captureBuffer.ts` (+barrel) — a console interceptor installed at boot that tees every `console.*` (so all ~500 scattered `[TRACE:*]` emits, zero per-site edits) into a 600-entry localStorage RING BUFFER that SURVIVES reload/white-screen [window.onerror + unhandledrejection flush immediately] + `getCaptureText/clearCapture/downloadCapture/shareCapture`. NEW `packages/cultivar-os/src/components/DebugPanel.tsx` — a `?debug=1`-gated [sticky] floating 🐞 panel with Share [OS share sheet → .txt to Lightning] / Download / Copy / Clear; demos stay clean [Lauren's link has no `?debug=1`]. Wired: `main.tsx` [`installCapture()` before React], `App.tsx` [`<DebugPanel/>`], shared index. Solves the field-debug pain [phone console David can't see/send → downloadable trail as DATA]. Decoupled from any PWA wrap [share/download/localStorage all work in a mobile TAB]. New `[TRACE:CAPTURE]` ON. Recon also delivered [`docs/decisions/2026-06-27-wrap-and-capture.md`]: emit mechanism = scattered console.* no central emitter; PWA wrap = thin ~3-4h additive no native shell; SEQUENCING CALL = capture now → fix resolver+session naked → wrap PWA last. `npm run verify` exit 0 zero NET-NEW [tsc 10 / eslint 266 / knip 10·14·15]; build:cultivar clean 2233 modules; node smoke proven [verbatim capture, crash-flush, survive-reload, clear]. NO schema/migration/RLS/auth.) · 2026-06-26 (SOMETIMES-CONNECTED SYNC + OFFLINE WALK-AND-COUNT [ledger #57, `73d49a0`, BUILDER-COMPLETE, owner-proof owed on a phone]: NEW shared capability `packages/shared/src/sync/` — store.ts [namespaced local store `trace:sync:<businessId>:<domain>`, de-keyed from Ignition's single IGNITION_OS_DATA blob; localStorage→in-memory fallback] + offlineQueue.ts [typed FIFO op queue, persisted, idempotent-enqueue by clientId] + syncEngine.ts [write-through-WHEN-online OR enqueue-WHEN-offline + reconnect drain: `online` listener + manual syncNow(), FIFO replay, idempotent via insert-PK=clientId so a replay 23505 = already-applied — NO existing-table schema change] + types/barrel. Minimum slice from recon #55, built NEW in shared; packages/ignition-os/DataBridge.js LEFT UNTOUCHED [44 Ignition imports, donor-reference] — the persistence half DataBridge had is lifted+de-keyed, the sync-on-reconnect half it never finished is now BUILT. WIRED into the count loop: all 5 InventoryCount.tsx writes route through the engine → the dead-zone :181 abort is GONE [offline=queued/never-fails, online=applied-now]; identity-stamp [every op envelope carries userId+clientTs; count START guarded authenticated+online]; same-lot-twice-this-session Save SURFACES a conflict [Keep-first/Keep-new, never silent overwrite]. I&A heavy-sync NOT built [identity-stamp only]. npm run verify exit 0 zero NET-NEW; build:cultivar clean 2230 modules; [TRACE:SYNC] added + [TRACE:COUNT] kept ON.) · 2026-06-26 (WALK-AND-COUNT inventory loop [cap 2.3, ledger #54, BUILDER-COMPLETE, owner-proof owed]: scan→resolve→qty→save→next→complete — new QrScanner [jsQR live decode + URL-strip + manual fallback] + InventoryCount page [/inventory/count] + "Start count" on /inventory; SETS business_inventory.qty AND records each count to the GATED 20260626_inventory_count_sessions migration [inventory_count_sessions+inventory_counts — HANDED TO DAVID, NOT applied]; UNKNOWN scan handled; RECONCILIATION DEFERRED; [TRACE:COUNT] ON; verify-first homed in docs/decisions/walk-and-count-inventory-verify-first.md; npm run verify zero NET-NEW; NO auth/RLS/existing-schema touched.) · 2026-06-26 (NAV FIX — persistent chrome stack + full IA tree + Delivery sub-pages findable [AUTH-FREE]: header+nav wrapped in ONE sticky .appchrome-stack so the nav no longer slides under the banner [was two independent sticky siblings both at top:0]; AppNav rewritten to render the full NAV_IA tree [Dashboard home + promoted dashboard surfaces each with sub-pages + Admin + Settings] instead of the 3-item collapsed rail — still reads the ONE registry IA; hamburger now at every width; nav_delivery_route 'Route a day'→'Route' [key unchanged → cap #n intact] so Delivery › Route is findable. `4c6308a`, `npm run verify` exit 0 zero NET-NEW, build clean 2219 modules, cap #n PASS; BUILDER-COMPLETE, owner-proof owed; ledger #49.) · 2026-06-26 (FRONT-DOOR ARC PROMOTION, synchronous + AUTH-FREE — verify-first found Cultivar onboarding was ALREADY two progressive flows [SignUp→OwnerSignup reveal-step → OnboardingWizard demo chooser] with the reveal ALREADY wired, so only the genuine gaps were built: (C) compareEnteredVsSite gained an `address` field + was WIRED into the reveal via api/discovery/ingest.ts [reads businesses entered-data service-key, reuses already-fetched content, returns `discrepancies`]; DiscoveryGlimpse 'done' phase renders hedged conflicts with owner-RLS "Use site value" write-back. (D) populateCatalog WIRED as `action=populate` on the SAME ingest fn [12-fn ceiling → no new endpoint], fired foreground from the reveal with an "Added N items" status. (E×4 bug-fixes) demo route builder OnboardingWizard.DeliveryWizardPath now bookends business→stops→business; businesses.tax_rate drives BOTH CartReview display AND authoritative orders/submit.ts [was 2× hardcoded 0.0825] + Confirmation label derived; "Delivery Routing"→"Delivery"; new shared useQboConnect hook = ONE connect action in Dashboard AND Settings [fixes the dead-`<a href>` broken Settings QBO path]. Auth boundary never crossed [no signUp/businesses-insert/acceptInvitation]. `npm run verify` exit 0 zero NET-NEW [eslint 267→266 locked]; BUILDER-COMPLETE, owner-proof owed on one deploy; ledger #47.) · 2026-06-25 (delivery bookend ADDRESS DATA FIX — businesses.address for Test Lawns completed "770 Co Rd 284"→"770 Co Rd 284, Liberty Hill, TX 78642", closes FIX 4's blocker; A multi-stop assembly + B round-trip bookend confirmed already-built, no code delta; bookend URL proven business→stops→business · demo-fixes batch: discovery fail-loud + persistence FIX1 c8094e1 · onboarding address round-trip FIX2 2c7bf08 · leakage relabel FIX3 0a18ca1 · delivery round-trip anchor FIX4 769933f · OCR-into-inventory reuse-verify recon · canonical status front-page built in TRACE-SESSION-BOOTSTRAP.md)

**Purpose:** Sessions keep rebuilding things that exist. This document is the single answer to "was X ever built?" Organized by capability, not by file. For file locations, see PLATFORM_AUDIT.md.

> ↑ **FEEDER doc.** The canonical live-status front-page is `TRACE-SESSION-BOOTSTRAP.md` → ⚡ ACTIVE STATUS / 📋 board. This answers "was X *ever* built?"; the front-page answers "what's in-flight / demo-critical *now*." Update the front-page line whenever an entry here changes state.

**Convention:** This is a LEAN index. Each entry = capability + status + one-line location + POINTER to the authoritative doc for detail. Never inline audit/spec content here — link to it. Keep this file scannable.

**Widget-header standard (binding — partnership doc §15, gated at end-of-session-protocol.md Step 10 + Step 17):** every built artifact (widget·tile·component·module·page·endpoint) carries an in-code HEADER declaring **PURPOSE** (one line) · **DEPENDENCIES** (modules/tables/env/capabilities; cross-vertical `requires X`) · **OUTPUTS** (what it produces/returns/writes). Each entry added below describes an artifact that must carry that header in code — the inventory makes a thing *findable*, the header makes it *knowable*. Verify-before-build is the companion: before building, check this index + grep the codebase; if it exists, extend, don't rebuild. A listing without a header — or a header without a listing — is an incomplete task.

> **⚠️ Header backfill debt (flagged 2026-06-14, Tech Debt #33):** the widget-header standard is now binding going forward, but existing artifacts predate it. Top 3 header-less load-bearing widgets to backfill first: (1) `packages/shared/src/campaigns/generate.ts` — David's referenced "campaign widget", no header; (2) `packages/cultivar-os/src/pages/Campaigns.tsx` — customer-facing campaign widget, no header; (3) `packages/shared/src/discovery/engine.ts` — discovery engine, no header. NOT backfilling all now — flagged as debt; backfill on next touch of each file. See `docs/tech-debt-log.md` #33.

> **Audit reconciliation (2026-06-05):** Three stale bootstrap beliefs corrected. (1) AI Engine is already shared, NOT trapped in Ignition — promote already happened; what remains is unifying a split-brain. (2) RBAC is split — identity/invites shared; enforcement still Ignition-side and duplicated. (3) DataBridge footprint confirmed (~45 files, load-bearing) but characterization disputed: this doc says "localStorage-first, intentionally not shared," bootstrap says "offline-sync engine, promote" — unresolved, see NEEDS DAVID'S CALL.
>
> **File-type reality:** Ignition (`packages/ignition-os/`) is entirely `.jsx`/`.js`, ZERO `.ts`. Shared is `.ts`. Audit Ignition with `--include=*.jsx --include=*.js`, never `.ts`. Ignition's `src/` is empty; code lives at package root + `modules/`.

**Column guide:**
- **Vertical** — `ignition` | `cultivar` | `shared` (`shared` = promoted to the platform shared layer; it's a location, not a vertical)
- **Type** — `tile` (customer-facing dashboard tile/module) | `infrastructure` (plumbing: auth, QR, Supabase types, adapters) | `capability` (backend/feature that isn't a tile and isn't pure plumbing)
- Reading the table: `Vertical:shared` = platform baseline. `Vertical:shared AND Type:tile` = every vertical inherits these tiles for free. See "NEEDS DAVID'S CALL" section at bottom for ambiguous entries.

---

## AI Engine

**What:** Unified multi-provider AI router. Single interface for all AI tasks across all verticals.  
**Status:** 🪦 BACKEND-DEAD / MODULE-STRANDED — **REMOVAL BLOCKED** (deprecated in place, do NOT delete) · ⚠️ lifecycle below  
**Vertical:** shared | **Type:** capability  

> **Lifecycle (2026-06-21) — DEPRECATED IN PLACE, removal blocked:**
> - **Backend dead, logic has no replacement.** Railway backend is killed; AIEngine's client-side task routing + tier-gating (TRIAL/STARTER/PROFESSIONAL/PREMIER) logic has **NO replacement**. The new shared AI gateway (`capabilities.ts` / `execute.ts`) covers **Cultivar server-side tasks only** — the 9 Ignition tasks and the tier-gating logic are **unique to AIEngine** and live nowhere else.
> - **3 live callers in the active build target `ignition-os`** — deleting now breaks `build:ignition`:
>   - `packages/ignition-os/modules/IgnitionAudit.jsx:16` (import) / `:459` (`AIEngine.auditInvoice`)
>   - `packages/ignition-os/modules/IgnitionCipher.jsx:10` (import) / `:74` (`AIEngine.decodeDTC`)
>   - `packages/ignition-os/modules/PredictiveKey.jsx:16` (import) / `:406` (`AIEngine.suggestPMI`)
>   - barrel re-export `packages/shared/src/index.ts:15-16`
> - **DARK in prod but live code.** No endpoint (`VITE_API_URL` unset) → every `AIEngine.call()` returns `{ ok: false }`. Features are dark, but the code is wired and compiled into `build:ignition`.
> - **Stale `gemini-2.0-flash` ×4** (`AIEngine.ts:35-38`) are **harmless while the backend is dead** — they are never called. They are eliminated on eventual removal, **not before** (see config-ground-truth.md store #4).
> - **REMOVAL UNBLOCKED BY:** porting the 9 Ignition tasks + tier-gating to Vercel serverless functions, then repointing the 3 modules. Until then this entry stays BACKEND-DEAD / MODULE-STRANDED, NOT resolved.
> - **Links:** `MASTER_BRIEF.md:444` (Ignition-AI→Vercel port) · Tech Debt #25 + #12 (`docs/tech-debt-log.md`).

**Location:** `packages/shared/src/ai/AIEngine.ts`  
**Original source:** `CAI/AIEngine.js` (archive — do not edit)  
**Backend:** `CAI/ai_router.py` (FastAPI, Railway) — **LEGACY for web builds.** AIEngine.call() fails gracefully (`{ ok: false }`) when no backend is reachable. Port to Vercel serverless functions when activating AI features. See Tech Debt #12 in CLAUDE.md.  
**Import:** `import AIEngine from '@trace/shared/ai/AIEngine'`

**13 tasks:**

| Task | Provider | What it does |
|---|---|---|
| `vin_decode` | Gemini 2.0 Flash | Photo → vehicle info |
| `invoice_scan` | Gemini 2.0 Flash | Photo → line items |
| `label_read` | Gemini 2.0 Flash | Tool/fluid label → spec |
| `part_photo_id` | Gemini 2.0 Flash | Part photo → ID + compatibility |
| `invoice_audit` | Claude Sonnet 4.6 | Invoice → uncaptured charges flagged |
| `dtc_decode` | Claude Sonnet 4.6 | DTC codes → plain-language diagnosis |
| `estimate_draft` | Claude Sonnet 4.6 | Job description → draft estimate |
| `compliance_check` | Claude Sonnet 4.6 | Document → DOT/regulatory flags |
| `customer_summary` | Claude Sonnet 4.6 | History array → relationship summary |
| `pmi_suggest` | Claude Sonnet 4.6 | Equipment data → maintenance schedule |
| `predictive_analysis` | Claude Sonnet 4.6 | Job history → risk patterns |
| `savings_report` | Claude Sonnet 4.6 | Shop history → margin recovery report |
| `voice_transcribe` | OpenAI Whisper | Audio → transcript |
| `parts_nlp` | OpenAI GPT-4o | Free-text parts → structured list |
| `intent_classify` | OpenAI GPT-4o | Customer message → intent category |

**Tier gating:**
- TRIAL: all tasks
- STARTER: none (no-AI tier)
- PROFESSIONAL: 12 tasks
- PREMIER: all tasks

`AIEngine.canUse(task, tier)` → boolean. Call before running any task.

**Convenience wrappers:** `decodeVIN`, `decodeDTC`, `transcribeVoice`, `extractParts`, `readToolLabel`, `suggestPMI`, `auditInvoice`, `draftEstimate`, `savingsReport`

**Haiku fallback:** Pass `options.fallback = true` to retry failed Sonnet calls with Haiku.

**Not yet built:** `SavingsReport.jsx` — React display component for `savings_report` output. API is complete; only display work remains.

**✅ Split-brain resolved (2026-06-05):** The four server-side files (`shared/campaigns/generate.ts`, `shared/discovery/engine.ts`, `shared/discovery/synthesis.ts`, `cultivar-os/api/social/generate-posts.ts`) now route through `packages/shared/src/ai/execute.ts` → `CAPABILITIES` registry → Anthropic SDK directly on Vercel (no Railway). This is the new shared AI gateway — separate from AIEngine.ts, which remains the Ignition-specific router for Railway-backed tasks. AIEngine.ts Ignition consumers (`IgnitionAudit.jsx`, `IgnitionCipher.jsx`, `PredictiveKey.jsx`) are unchanged. See `packages/shared/src/ai/` for gateway implementation.

**⚠️ AIEngine is DARK in Ignition production (Audit 2, 2026-06-06):** `VITE_API_URL` is NOT set in the ignition-os Vercel project. Every `AIEngine.call()` in Ignition OS web production returns `{ ok: false }`. Railway is still running but receives zero traffic from the web build. No Ignition AI feature has ever produced real output for a web user. See Tech Debt #12 (expanded) + `docs/audits/2026-06-06-audits-1-4.md` §2a.

**⚠️ `invoice_scan` has ZERO callers (Audit 2, 2026-06-06):** The `invoice_scan` task in the AIEngine routing table is orphaned — no component, hook, or API handler invokes it anywhere. It was never wired. **Do not confuse with `invoice_audit`:** that IS built (two-stage Gemini→Claude on Railway), a leakage tool that reads OUTGOING invoices to flag uncaptured charges. `invoice_scan` → retire. `invoice_audit` → keep in scope for future Ignition (port to Vercel when Railway is killed). See `docs/audits/2026-06-06-audits-1-4.md` §2b.

**⚠️ VIN OCR is a placeholder (Audit 2, 2026-06-06):** The VIN decode feature resolves to `alert('OCR Scanning initializing...')`. No Gemini vision call is ever made. The Gemini vision pipeline has never been proven end-to-end on Vercel — Receipt Keeper v1 will be the first confirmed live Vercel vision pipeline. See `docs/audits/2026-06-06-audits-1-4.md` §2c.

---

## FastAPI AI Backend (ai_router.py) — LEGACY

**What:** FastAPI router that handles all actual AI provider API calls.  
**Status:** ⚠️ Legacy — built for the React Native mobile app where API keys couldn't live in the bundle. Now that Ignition OS is a Vercel web app, keys live in Vercel env vars and functions handle them server-side. Railway is not needed.  
**Vertical:** ignition | **Type:** infrastructure  
**Location:** `CAI/ai_router.py` (archive)  
**Forward path:** Port the 11 endpoints to TypeScript Vercel functions under `packages/ignition-os/api/`. Start with `dtc_decode` and `estimate_draft` (text-only, no vision complexity). See Tech Debt #12 in CLAUDE.md.  
**Exception:** `voice_transcribe` sends audio files — Vercel's 4.5MB payload limit needs evaluation before porting.

**Endpoints:**
- Gemini: `POST /ai/vin_decode`, `/ai/invoice_scan`, `/ai/label_read`, `/ai/part_photo_id`
- Claude: `POST /ai/dtc_decode`, `/ai/estimate_draft`, `/ai/pmi_suggest`, `/ai/invoice_audit`, `/ai/savings_report`
- OpenAI: `POST /ai/voice_transcribe`, `/ai/parts_nlp`, `/ai/intent_classify`

**Cost tracking:** `_log_usage()` writes to `ai_usage` table (includes `cost_usd` per call).  
**Error tracking:** `_log_error()` writes to `error_events` table. Non-fatal — calls never block.

---

## Receipt / Expense Storage

**What:** Tables and storage for vendor receipt capture (`receipts`), structured expense records (`expenses`), and owner-declared allocation inputs for cost calculations (`cost_profile`).
**Status:** ✅ BUILT (receipts + bucket, Receipt Keeper v1 = WORKS 2026-06-11) | ❌ expenses + cost_profile NOT YET BUILT
**Vertical:** shared | **Type:** infrastructure

**What is built (2026-06-11):**
- `receipts` table — 14 cols + 6 reconciliation cols. Migrations: `20260612_receipts.sql`, `20260613_receipts_add_line_items.sql`, `20260614_receipts_reconciliation.sql`. All applied to bgobkjcopcxusjsetfob 2026-06-11 (confirmed live test).
- `receipts` Supabase storage bucket — RLS: `20260613_receipts_storage_rls.sql` (3 policies).
- `platform_config` table — `20260611_platform_config.sql`. Holds `ocr_primary_model` + `ocr_fallback_model` (swappable without code change per BENCH-E Rule 7).
- Receipt Keeper v1 UI: `src/pages/ReceiptKeeper.tsx` + extracted modules: `src/utils/receiptReconciliation.ts`, `src/utils/imageCompression.ts`, `src/components/LineItemGrid.tsx`, `src/components/ConflictDialog.tsx`.
- API: `api/receipts/ocr.ts` — Gemini 2.5 Flash primary → Claude Haiku 4.5 fallback → 503.

**Wave 2 — mobile-native invoice capture + infer-then-confirm router (2026-06-20, BUILDER-COMPLETE / owner-proof owed):**
- **Device-aware capture** (`ReceiptKeeper.tsx` `useIsMobile`): MOBILE → camera-first (big "Take Photo", `<input capture="environment">`) + "choose from photos/files" secondary; DESKTOP → drag-drop file upload (no camera). `[TRACE:OCR]`.
- **Relabel** — killed the "Capture truck receipts" Ignition leak. Copy now from `CAPTURE_COPY` (nursery default "Snap a receipt or invoice"); marked for VerticalConfig when that lands.
- **Invoice-shape OCR** (`api/receipts/ocr.ts`): `shape` param (`receipt` default = unchanged for all existing callers | `invoice` new). Invoice prompt is a superset — keeps vendor/date/line_items(+sku)/subtotal/tax/total, ADDS customer_name/phone/email, bill_to + ship_to addresses, due_date, delivery_date. Same provider chain (Gemini→Haiku, platform_config models, image-to-Supabase write). UNKNOWN/null for absent fields (D-9, never 0/fabricated).
- **Review-before-write**: the confirm screen now shows the invoice fields (customer, bill-to/ship-to, due/delivery dates) as editable inputs for human validation before any write.
- **OCR → INVENTORY intake (cap 2.3, NEXT build — reuse-verified 2026-06-25):** recon verdict 🟡 reuse-and-wire (~70% reuse), NOT net-new. The OCR provider chain (`api/receipts/ocr.ts`, writes nothing, `shape:'invoice'` already extracts `line_items[]{description,sku,quantity,unit_price,amount}`) + mobile capture/compress are 100% reusable; the genuine net-new is a small `line_items → business_inventory` mapper + N-row confirm grid + multi-insert (the `business_inventory` insert already reserves `receipt_id`, `BusinessInventory.tsx:154`). No migration needed. Full scope: `docs/decisions/OCR-into-inventory-reuse-verify.md`. **Recon only — build nothing yet.**
- **WALK-AND-COUNT inventory loop (cap 2.3 — BUILDER-COMPLETE 2026-06-26, ledger #54, owner-proof owed):** the physical-count complement to OCR intake (intake fills the catalog; walk-and-count verifies on-hand). Lauren walks the lot on a phone → scan a plant tag QR → app strips the `/plant/<tag>` URL & resolves the item (never navigates) → enter qty → Save→Next reopens the camera → Complete ends the session. One item at a time, full focus (D-21). **New:** `components/inventory/QrScanner.tsx` (live `getUserMedia`+`jsQR` decode; jsqr chosen over BarcodeDetector — unsupported on iOS Safari, our target, §6 r10 standard-by-value; always-present manual tag-entry fallback) · `pages/InventoryCount.tsx` (`/inventory/count`, under the existing view_costs route gate; idle→scanning→reviewing/unknown→done; resolve order = `cultivar_plants.tag_id` → `business_inventory.sku` → UNKNOWN; Save→Next SETS `business_inventory.qty` AND records the count; UNKNOWN = quick variety/size OR skip-&-flag) · "Start count" entry on `/inventory`. **Record model = GATED migration handed to David (NOT applied):** `supabase/migrations/20260626_inventory_count_sessions.sql` adds `inventory_count_sessions` + `inventory_counts` (durable per-item count: counted_qty, item_label, inventory_id, plant_tag_id, was_unknown, session, timestamp — what RECONCILIATION will later read), RLS owner_all + `is_active_member` member_all (AC-2/AC-3). Deploy-window safe: tables absent → on-hand still updates, count-record skipped with a loud `[TRACE:COUNT]` warning (mirrors deliveries `service_type` fallback). **RECONCILIATION (counted-vs-expected, sold/dead/missing) NOT BUILT** — record model leaves room. NO auth/RLS/existing-table-schema touched. `[TRACE:COUNT]` ON. Verify-first answers homed: `docs/decisions/walk-and-count-inventory-verify-first.md`.
- **Infer-then-confirm router** (`[TRACE:ROUTER]`): after OCR, infers doc type (customer present → "invoice for a customer" else "receipt/expense"), presents destinations multi-select, best-guess pre-checked, always overridable — **Add customer** (functional) + Schedule delivery / Analyze sale (shown, marked "coming"). Question-depth dial-able.
- **OCR → standalone customer create**: `findOrCreateCustomer` extracted to `packages/shared/src/business-logic/customerUpsert.ts` (the cart's customer write, now callable without an order). New endpoint `api/customers/create.ts` (+ cultivar impl). Confirming "Add customer" creates/updates a customer tagged `source='ocr-invoice'`. The CART path (`api/orders/submit.ts`) now calls the SAME shared fn (`source='qr-scan'`) — regression-proven still creating customers. **Dedup upgraded to PERSON-based (Person-spine, 2026-06-25, `c1f8be3`):** resolves the global person at SOURCE (email→phone) then dedups the customer WITHIN the business by `person_id` — a phone-only repeat no longer double-inserts (the old email-only dedup let it through). Graceful fallback to legacy email-dedup if the person layer is unavailable. See the Person Spine section.
- **NO migration** — writes existing `customers` columns only. Proof: `scripts/verify-customer-upsert.mjs` (service-key, 7/7 PASS: ocr-invoice create + tag, dedup-by-email, cart path resolves, provenance preserved, email-less safe, cleanup). `[TRACE:OCR]`/`[TRACE:ROUTER]` ON until owner-proven.
- **Owner-proof owed**: real photographed LAWNS invoices on David's phone — camera-first few-tap capture, invoice fields extracted + shown, image in storage, confirm "Add customer" creates the customer.
- **Date-field fix (2026-06-20, owner-proof owed):** invoice Date/Due/Delivery rendered EMPTY — OCR returned dates "as printed" (US MM/DD/YYYY) but `<input type="date">` requires ISO YYYY-MM-DD (read worked, parse was the bug). New `src/utils/dateParse.ts` `toISODate` normalizes (MM/DD/YYYY · M/D/YYYY · dash/dot seps · 2-digit year · textual month · ISO passthrough); absent/unparseable → '' (D-9). Applied to all three date fields + `[TRACE:OCR] date parse` raw→iso log. Proof: `scripts/verify-date-parse.mjs` 14/14 (06/22/2026→2026-06-22, 06/25/2026→2026-06-25).

**Delivery loop — OCR invoice → scheduled delivery → day view → route map (2026-06-20, BUILDER-COMPLETE / schema gated / owner-proof owed):** closes the loop the invoice capture opened. The router's "Schedule delivery — coming" badge is now FUNCTIONAL. `[TRACE:DELIVERY]`.
- **Schema (APPLIED + CATALOG-PROVEN 2026-06-20):** `supabase/migrations/20260620_deliveries.sql` — new `deliveries` table (id, business_id, customer_id FK→customers ON DELETE SET NULL, delivery_date, address_line1/city/state/zip, status default 'scheduled' NO CHECK per AC-4, source, notes, created_at) + `deliveries_business_date_idx` + membership-scoped RLS (owner_all + member_all, AC-2/AC-3). **No existing table altered.** Catalog gate `scripts/verify-deliveries.mjs` **14/14 GREEN** (A) table, (B) columns+types, (C) FKs (customer SET NULL / business CASCADE), (D) RLS+rowsecurity, (E) status default+NO-CHECK, (F) day index + round-trip insert. PAT applied-then-revoked.
- **Write path (B2) — CONSOLIDATED 2026-06-20 (Vercel 12-function ceiling, tech-debt #41):** "Schedule delivery" is a live checkbox. On confirm, `doSave` (`ReceiptKeeper.tsx`) makes ONE call to `/api/customers/create` with the customer fields + (when scheduling) a `delivery` block; the endpoint resolves the customer once (findOrCreateCustomer) AND creates the single linked delivery in the same request. **No-double-create is now structural** (one call → one customer → at most one delivery). The standalone `api/deliveries/create.ts` was REMOVED to stay ≤12 serverless functions (it was the 13th → silent failed deploys; see #41). Checkboxes coupled (schedule→on forces add-customer; add-customer→off clears schedule). Delivery uses ship-to (falls back to bill-to) + ISO delivery_date.
- **Day view (B3):** `src/pages/DeliverySchedule.tsx` (`/delivery-schedule`) — scheduled deliveries grouped by `delivery_date` (soonest day forward, undated last; local-midnight parse so the day never slips). Reachable from the dashboard `delivery_routing` tile (repointed `/deliveries`→`/delivery-schedule`). Each day has "Route this day →".
- **Route map (B4 — REUSED, not rebuilt):** `DeliveryRoute.tsx` gains a `?date=YYYY-MM-DD` branch that loads the `deliveries` table for that day, maps each row into the existing `DeliveryOrder` shape, and routes via the **existing `buildMapsUrl` (DeliveryRoute.tsx:37)** + existing route UI — the cart-order path (no `date` param) is unchanged (regression-safe).
- **Scope fence:** NO live tracking, GPS, dispatch board, route optimization, re-sequencing, or add-a-stop. Loop closes at: delivery exists with a date → shows under its day → plots on the existing map.
- **Marcus Webb end-to-end proof (service-key, 6/6 GREEN):** resolve customer twice → ONE created, second REUSES (no double-create) → exactly 1 customer row → delivery created 2026-06-25 Wimberley linked to Marcus Webb → day-view read groups it under Jun 25, 2026 → cleanup. Migration is now APPLIED to live DB.

**service_type — planting vs delivery_only (2026-06-20, BUILDER-COMPLETE / migration GATED / owner-proof owed):** classifies a scheduled delivery. `[TRACE:DELIVERY]`.
- **DIAGNOSIS (the owner's "Schedule delivery — coming" on phone) — ROOT CAUSE = FAILED DEPLOY, not unwired code:** the toggle was already functional in `253cf49` (no "coming" badge). The real cause: `253cf49` added `api/deliveries/create.ts` as the **13th** serverless function, exceeding Vercel Hobby's 12-function limit → every deploy since FAILED silently while prod kept serving the pre-`253cf49` bundle (tech-debt #41). Proven by fetching the live bundle and grepping (old copy present, new absent). FIX = consolidate to 12 functions (fold deliveries→customers) so the deploy succeeds.
- **Schema (APPLIED + CATALOG-PROVEN 2026-06-20):** `supabase/migrations/20260620_deliveries_service_type.sql` — `ALTER TABLE deliveries ADD COLUMN service_type text` (nullable, NO CHECK per AC-4). Append-only, no other table touched. Catalog gate `verify-deliveries.mjs` **17/17 GREEN** incl. (G) service_type text/nullable/no-CHECK + round-trip persists service_type. Marcus Webb e2e **5/5** (inference→no-double-create→delivery svc=planting linked→day view [planting]→cleanup). PAT applied-then-revoked.
- **Inference + UI (`ReceiptKeeper.tsx`):** `inferServiceType(lines)` — any INSTALL/WARRANTY/plant line → `'planting'`, else `'delivery_only'`. Shown on the confirm screen (when "Schedule delivery" checked) as a correctable `<select>` defaulting to the inference (D-9). Passed in the delivery body to the endpoint.
- **Endpoint (`api/customers/create.ts`, consolidated):** writes `service_type` on the delivery created in the same call. **Migration-window-resilient:** on a missing-column error (42703/PGRST204) it retries WITHOUT service_type so delivery creation never breaks before the column is applied (honest debt, logged — column now applied; fallback can be removed next touch).
- **Day view:** `DeliverySchedule.tsx` shows a service_type badge (planting=blue, delivery_only=green).
- **Owner-proof owed (on phone, after Vercel deploys `main` ≥634b990):** snap the Marcus Webb invoice → "Schedule delivery" is LIVE (no "coming") → service type shows inferred + correctable → confirm → Marcus Webb under Jun 25, 2026 with the service_type badge → "Route this day" plots.

**What is NOT yet built:**
- `expenses (id, business_id, receipt_id, source CHECK IN ('receipt','bank_csv','manual'), amount, category, occurred_at)` — structured expense records from all sources
- `cost_profile (id, business_id, home_office_pct, business_time_pct, labor_rate, fixed_overheads jsonb, asset_amortization jsonb)` — owner-declared allocation inputs

All tables anchor to `business_id` — AC-1 ✅, AC-2 via `business_id`-scoped RLS ✅.

**Build path:** ✅ Receipt Keeper v1 done. Business Asset Layer done (2026-06-12). Receipt Keeper v2 + Cost-to-Produce tile adds `expenses` + `cost_profile`. See `docs/audits/2026-06-06-audits-1-4.md` §3.

⚠️ **PENDING REQUIREMENTS — must implement when consent surface / data-entry activation widget is built:**

**REQ-1 — WIDGET CONSENT-TO-USE (REQUIRED):**
When a customer activates the Receipt Keeper data-entry widget (e.g. opens the file picker / initiates data entry), the widget MUST present an upfront consent-to-use surface BEFORE data entry proceeds — consent to use the tool and how their data is handled. This must appear at the moment of activation, not buried in a settings page or terms link. Do NOT build the activation step without this surface.
Code anchor: `// FLAG: REQ-1` in `packages/cultivar-os/src/pages/ReceiptKeeper.tsx` at the idle step entry point.

**REQ-2 — HANDWRITTEN-RECEIPT KNOWN-LIMITATION DISCLOSURE (REQUIRED):**
That same upfront consent surface MUST state clearly that HANDWRITTEN receipts are a known issue and must be carefully inspected by the user before saving — handwriting capture is unreliable. Do not suppress or minimize this limitation.
Evidence (2026-06-11): a handwritten Schrock's A/C invoice read all line items as $0.00, missed the $395 handwritten total, missed a "pd Venmo" payment annotation, and fell to the Claude Haiku fallback. Printed receipts read cleanly. This is not an edge case — it is a known failure mode.
Code anchor: `// FLAG: REQ-2` in `packages/cultivar-os/src/pages/ReceiptKeeper.tsx` at the idle step entry point.

**Framing discipline:** These are CAPTURE/DISCLOSURE requirements — state the limitation and require human inspection. Do NOT add business advice about how to handle receipts or what to do about the limitation. Consistent with TRACE's capture-not-rule line and the Surface Honesty principle.

---

## Business Asset Layer (Cost-to-Produce)

**What:** Schema + UI layer for tracking business-owned assets and inventory. Foundation for the Cost-to-Produce tile. Part of the same receipt-anchored cost model as Receipt Keeper — receipts can link to inventory rows via the COUNT-ONCE dedup seam.  
**Status:** ✅ WIRED 2026-06-13 — schema applied, manual-entry UIs live, PMI module rewired onto live tables; AI suggest endpoint added. ⚠️ David must run `20260613_business_service_log_result.sql` before using the log result field.  
**Core-1 (2026-06-15 built; APPLIED + catalog-proven 2026-06-16):** `business_assets` → `cost_objects` rename-in-place + node/edge schema + D-5 substantiation axis. Migrations `20260615_cost_objects_rename_and_node_schema.sql` + `20260615_cost_objects_substantiation_d5.sql` applied to live (bgobkjcopcxusjsetfob); `node scripts/verify-cost-objects.mjs` catalog gate 22/22 green. See "Core-1 — Cost-Object Node Model" subsection below.  
**Vertical:** cultivar (UI surfaces today; schema AC-1 clean, business_id-scoped) | **Type:** infrastructure

**What is built (2026-06-12):**
- `business_assets` table — RLS: `owner_all` + `member_all` dual-policy (matches receipts pattern). FK→businesses CASCADE. BEFORE UPDATE trigger. Status CHECK (ACTIVE/IN_REPAIR/OFFLINE/RETIRED). Columns: name, asset_type, make, model, serial_number, **barcode_id**, year, location, status, acquisition_cost, cost_confidence, notes. Migration: `supabase/migrations/20260612_business_assets_inventory_pmi_service.sql`. Applied + structurally verified 2026-06-12.
- `business_inventory` table — same migration. Columns: name, sku, qty, unit_cost, location, status, serial_number, cost_confidence, received_at, notes. **+`receipt_id` FK→receipts (SET NULL)** — COUNT-ONCE dedup seam: when linked, receipt line item is authoritative cost; inventory's unit_cost is secondary.
- `business_pmi_schedule` table — same migration. 2 FKs (→businesses CASCADE, →business_assets CASCADE). columns: tasks jsonb (AI-suggest writes here), overrides jsonb, last_service_at, interval_days. **WIRED 2026-06-13**: PMI.tsx handleAddAsset() INSERTs when interval set; handleLogService() UPDATEs last_service_at; handleSuggestSchedule() UPSERTs tasks from /api/pmi/suggest response.
- **PMI accept-flow fix (2026-06-24, BUILDER-COMPLETE, owner-proof owed):** the AI suggest path no longer writes immediately — it now opens a **preview→accept gate**. `/api/pmi/suggest` returns human interval STRINGS; the new shared helper `packages/shared/src/modules/pmiInterval.ts` (`deriveIntervalDays`/`INTERVAL_DAYS`/`pmiStatusFrom`) derives `interval_days` = soonest convertible task cadence (`min`), and **on ACCEPT** writes `tasks` AND `interval_days` → `getPMIStatus` finally computes OVERDUE/DUE_SOON/OK (the "NO SCHEDULE" stuck-NONE bug fixed). **Honest about usage-based intervals**: "every N miles/hours" do NOT convert and never fabricate a day cadence (donor did `|| 30` — we don't) — they're flagged "no automatic due date" in the preview; the user can override the derived number before accepting. Interval-conversion LOGIC ported from Ignition `PredictiveKey.jsx` (NOT its tool-registry structure — Cultivar PMI stays standalone). Tests: `packages/shared/src/modules/pmiInterval.test.ts` 27/0. `[TRACE:pmi] schedule accept` emits — ON by standing owner instruction. NOT built this pass: the override MECHANISM, downtime state, PMI↔Delivery cross-links (captured separately, ledger #21).
- `business_service_log` table — same migration + `supabase/migrations/20260613_business_service_log_result.sql` (adds `result text CHECK(PASS/NEEDS_ATTENTION/FAIL)`). 3 FKs (→businesses CASCADE, →business_assets CASCADE, →receipts SET NULL). Append-only ledger (no `updated_at` trigger — corrections add new rows). receipt_id = COUNT-ONCE dedup seam. **WIRED 2026-06-13**: PMI.tsx handleLogService() INSERTs. ⚠️ `result` column requires 20260613 migration — David must apply before using log result.
- `cost_confidence` enum — migration `20260612_cost_confidence.sql`. Values: `ESTIMATED`, `CONFIRMED`, `UNKNOWN`. Applied 2026-06-12. Surface Honesty enforcement: manual entry defaults ESTIMATED; CONFIRMED requires a receipt link; UNKNOWN = entered but source not known.
- `BusinessAssets.tsx` UI — INSERT form (name, asset_type, make, model, year, serial_number, location, status, acquisition_cost, cost_confidence, notes) + LIST view at `/assets`. businessId from `useBusinessContext()`. Commit b924800. **INLINE EDIT added 2026-06-18 (THUNDER editable-assign pass):** each ASSET row now has 4 inline controls writing immediately under RLS (reassign() pattern, `.eq(node_type,'ASSET')`-guarded) — **project** (parent_id → PROJECT node / Company-level), **category** (shared Schedule C `CATEGORY_OPTS`), **amount** (acquisition_cost, commit on blur), **confidence** (cost_confidence, full set). Coherence: UNKNOWN ⟺ no amount (→UNKNOWN clears amount; amount on UNKNOWN → ESTIMATED). Feeds /costs by-project drill-in (capex bucket + category split). `[TRACE:assets]` emits `edit {assetId,field,from→to}` — ON by standing owner instruction (do NOT comment out). Service-key proven: TRACE uncategorized 15→12, flat capex unchanged, reassign moves both group totals ($259.80 Cool↔Farm). Owner-proof owed (David, live RLS).
- `packages/shared/src/business-logic/costCategories.ts` — **shared canonical Schedule C category set** (`CATEGORY_OPTS`, 14 lowercase values) + `categoryLabel` (null/blank → "Uncategorized"). Created 2026-06-18 to de-dup the former local copy in `CostToProduceSettings.tsx` (now imports it) and feed the new `/assets` capital-row picker — the two surfaces can no longer drift. Exported via `@trace/shared/business-logic`. (`labor`/`contract-labor` intentionally excluded — auto-applied by the labor model.) Note: `ProjectCostDrillIn.tsx` keeps its own tiny `categoryLabel` (owner-proven, out of scope) — fold into shared when next touched.
- `BusinessInventory.tsx` UI — INSERT form (name, sku, qty, unit_cost, location, status, serial_number, cost_confidence, received_at, notes; receipt_id intentionally absent — linked by receipt flow) + LIST view at `/inventory`. Commit b924800.
- `OperatingCosts.tsx` UI at `/operating-costs` — **NEW 2026-06-18 (THUNDER): the datasheet HOME for recurring, non-labor operating costs** (subscriptions/utilities/fees — Claude Pro, Gemini, domains, TX tax), sibling to `/assets` (capital) + `/inventory` (materials). LIST + Add-Cost bottom-sheet + per-row inline edits, each an immediate write under RLS (`node_type='COST'` guarded): **amount** (recurring_amount, commit on blur), **cadence** (WEEKLY/MONTHLY/QUARTERLY/ANNUAL), **category** (shared `CATEGORY_OPTS`), **project** (parent_id → PROJECT node / Company-level), **confidence** (full set), **remove** (hard delete, owner-confirmed). Inserts mirror the estimator's proven recPayload (`cost_shape` RECURRING_FIXED, `cost_nature` OPEX, `cost_source` MANUAL, `substantiation` OWNER_ASSERTED, `acquisition_cost` null) → all CHECK constraints satisfied. Coherence: UNKNOWN ⟺ no amount. **LABOR excluded** (cost_category `labor`/`contract-labor` filtered on load + never targeted — stays owned by the Settings labor block, D-12). Built so recurring costs have a real entry surface BEFORE the cost-to-produce estimator (CostToProduceSettings Block 1) was severed. **OWNER-PROVEN 2026-06-18** (writes/edits/deletes work, unknowns hold, annual cadence works, labor excluded). **Now the SOLE writer of recurring COST rows** — the Settings Block 1 sever landed 2026-06-19 (D-14.6). Entry point: a "Manage recurring & operating costs →" button on `/costs`. `[TRACE:opcosts]` emits on load/edit/add/delete — ON by standing owner instruction.
- Router: `/assets`, `/inventory`, and `/operating-costs` registered as PrivateRoute children in `packages/cultivar-os/src/router.tsx`.

**What was NOT yet built (as of 2026-06-12) — now updated:**
- ~~PMI module UI — BROKEN~~ → **WIRED 2026-06-13**: `packages/shared/src/modules/PMI.tsx` fully rewired onto business_assets + business_pmi_schedule + business_service_log. barcode_id, task checklist, PASS/NEEDS_ATTENTION/FAIL result, AI suggest. See PMI Module section below.
- ~~`pmi_suggest` AIEngine route DARK~~ → **New Vercel endpoint 2026-06-13**: `api/pmi/suggest.ts` (Claude Sonnet 4.6, text-only). Input: `{businessId, name, asset_type, make, model, year}`. Output: `{ok: true, tasks: [{name, interval}]}`. ⚠️ 13th Vercel function — exceeds Hobby limit; David must upgrade to Pro or free a slot.
- ~~Business Service Log UI — no app module~~ → **WIRED 2026-06-13**: PMI.tsx handleLogService() writes to business_service_log (result column requires 20260613 migration).
- ~~**Cost-to-Produce tile** — the dashboard tile that aggregates all four tables into margin insight.~~ → **BUILT (config + display + tune loop) 2026-06-14** — see "Cost-to-Produce — Config + Tile" section below. (Asset-table aggregation into the rollup remains future; this build is the period-pool engine + honest display + tune loop. Design doc: `docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md`.)

**Core-1 — Cost-Object Node Model (2026-06-15 built; APPLIED + catalog-proven 2026-06-16):**
- `business_assets` **RENAMED → `cost_objects`** in place (approach C, settled). Pre-verified live: business_assets = 0 rows (no data migration). FK dependents `business_pmi_schedule.asset_id` + `business_service_log.asset_id` auto-carry with CASCADE intact; child columns **stay named `asset_id`** (asset-maintenance tables reference ASSET nodes specifically — documented in migration). Policies/trigger/pkey renamed for hygiene; RLS behaviour unchanged.
- **Node fields added:** `node_type` (ASSET|PROJECT|PRODUCT, NOT NULL default ASSET), `parent_id` (self-FK, ON DELETE SET NULL — containment tree, NULL=root/domain §5.0), `domain` (Farm/Software/RealEstate fallback holder §5.9). Index `(business_id, node_type)` for the asset-UI hot path.
- **Separate status columns** (§5.9, asset outlives product): `status` ASSET-only (added **IDLE + UNASSIGNED** to enum), `project_status` (open/closed/converted, nullable), `product_status` (active/retired, nullable). node_type selects which applies. Never polymorphic.
- **`cost_object_edges`** — attribution DAG (§5.2 containment + contribution). Carries `use_fraction` (numeric(7,6), the ONE primitive shared by carve-out §5.7 AND multi-location — built once) + `basis_type`/`basis_note`/`basis_confidence`. RLS owner_all+member_all, business_id-scoped. Indexes on parent/child/business.
- **`cost_object_assignments`** — time-bounded asset→project (§5.9). `start_at`/`end_at` (end NULL = open period; idle gap = no open assignment → fallback-to-domain OP-6), `conversion_cost` (repurpose cost event lands on receiving project), `basis_confidence` (AI-inferred vs owner-confirmed, OP-7). RLS owner_all+member_all. Partial index on open assignments.
- **Code repointed:** `BusinessAssets.tsx` (×2) + `PMI.tsx` (×4) `.from('business_assets')` → `.from('cost_objects')` + `.eq('node_type','ASSET')` on reads + `node_type:'ASSET'` on inserts. `[TRACE:assets]` / `[TRACE:pmi]` instrumentation ON (STD-003, stays on until OWNER-PROVEN). Widget headers added to both files. Builds green (cultivar + ignition); touched files tsc-clean.
- **Deferred (honest-debt):** §5.1 node-carry fields (budget_estimate, unit_type, selling_price, purchase_date, vendor_id) NOT added — add alongside the PROJECT/PRODUCT node UIs (no writer yet). Design: `docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md` §5/§5.2/§5.7/§5.9; decision: `ASSET-NODE-SCHEMA-DECISION-3LENS.md`.
- **D-5 substantiation axis — APPLIED + catalog-proven 2026-06-16** (migration `20260615_cost_objects_substantiation_d5.sql`, Option 2). Adds the SECOND D-5 axis to `cost_objects`: `substantiation text NOT NULL DEFAULT 'OWNER_ASSERTED' CHECK (IN 'SUBSTANTIATED','OWNER_ASSERTED')` + `receipt_id uuid REFERENCES receipts(id) ON DELETE SET NULL`. Code-matched to `CountOnceSeam.ts` (Substantiation union :78; `fromCostObject` reads `row.substantiation` + `row.receipt_id` independently). The table already carried `cost_confidence` (axis 1, amountConfidence) — now both D-5 axes are live. Option 3 (substantiated_at/by, document_url) deferred (no writer). **Live state at apply:** Core-1 rename was ALREADY applied → this is the ALTER only, no double-apply. `NOT NULL DEFAULT` backfilled the one pre-existing real row (owner-entered "tractor mahindra") to OWNER_ASSERTED — default proven on real data. **Verified INDEPENDENTLY** against live catalog (`information_schema`/`pg_catalog`, not builder memory): `scripts/verify-cost-objects.mjs` **22/22 green** — extended with (G) substantiation type/null/default, (H) CHECK both values, (I) receipt_id FK SET NULL; old-name round-trip soft-check fixed (head:true → real row-select → PGRST205). Catalog-PROVEN; OWNER-PROOF of the seam-fed tile path is the separate next bar.
- **Real CoolRunnings inventory seeded 2026-06-16** into `cost_objects` (tenant 45830ba7 "TRACE Enterprises", owner ba7cf242…cd2db1ecb9ba — real active OWNER membership, NOT fabricated). Real hardware from `docs/coolrunnings-hardware-spend-2026-06-02.md` as `node_type='ASSET'`: NSPanel Pro 120 ×2 ($259.80, CONFIRMED/SUBSTANTIATED) + MINI Duo-L ×3 ($65.70, CONFIRMED/SUBSTANTIATED) sharing the real Amazon Order #114-2466808 receipt (→ exercises `sameCost` DISTINCT: same receipt, different line amounts); meross MTS300HK ($91.81, DERIVED/OWNER_ASSERTED, no receipt → axis-2 typed cost); HP ProDesk 600 G6 (cost NULL not zeroed, UNKNOWN/OWNER_ASSERTED). Alongside the pre-existing owner-entered tractor. Seam-fed OWNER-PROOF through the live tile under RLS = the next separate step.

**Unified Cost Model — shape × nature × source (BUILD steps 0-3, 2026-06-17 — SCHEMA WRITTEN/GATED + read-path safe):** the spine that makes recurring costs first-class. Per `DECISION-small-business-cost-accounting-model.md` (canonical) + `DECISION-unified-cost-model-option2.md` + the verify-first recon (`THUNDER-PROMPT-unified-cost-model-verify-first.md`). THREE orthogonal tags on every cost: **PROJECT** (`parent_id`, built 20260615) × **NATURE** (CapEx/COGS/OpEx — drives the three business views + payback/margin) × **SHAPE** (the six shapes — how money behaves over time). STAGED: steps 0-3 (safe foundation) done; steps 4-8 (backfill → flip → re-point write → owner-prove) HELD for David's fresh confirm.
- **Step 0 — BEFORE-NUMBER anchor captured** (`scripts/capture-cost-before.ts`, read-only, mirrors the live tile EXACTLY: config + inventory + `cost_objects`→`fromCostObject`→rollupEvents→`analyze`). Live capture: tenant 45830ba7 (TRACE) **KNOWN $12,239.67/mo** (floor $12,223.00 + estimated $16.67, unknown=5, capexExcluded $10,417.31 from 7 cost_objects) — matches the OWNER-PROVEN figure. Snapshot → `docs/cost-to-produce/BEFORE-NUMBER-snapshot.json`. This is the trust-but-verify gate: after the data-move (step 5) the flat total MUST still match this per tenant, or STOP.
- **Step 1 — schema delta APPLIED + CATALOG-PROVEN 2026-06-17** (`supabase/migrations/20260617_cost_objects_shape_nature_source.sql`, append-only, applied to live bgobkjcopcxusjsetfob by David). Adds: `cost_shape text NOT NULL DEFAULT 'ONE_TIME' CHECK(6 values)` · `cadence text CHECK(5 values, nullable)` · `recurring_amount numeric(10,2)` (DISTINCT from `acquisition_cost` — never overload capex onto recurring) · `cost_nature text NOT NULL DEFAULT 'CAPEX' CHECK(CAPEX|COGS|OPEX)` · `cost_source text NOT NULL DEFAULT 'MANUAL'` (provenance SEAM for the connect-via-API layer; intentionally NO CHECK so sources grow without a migration) · `node_type` CHECK WIDENED with `'COST'`. NOT NULL defaults are TRUE for every pre-existing row. **SCHEMA-VERIFICATION GATE SATISFIED:** `scripts/verify-cost-objects.mjs` (extended with catalog checks (J)-(P)) run with PAT against the live catalog (`information_schema`/`pg_catalog`, not memory) → **32/32 green**. (P) confirms all 7 pre-existing rows (5 ASSET + 2 PROJECT) defaulted ONE_TIME/CAPEX/MANUAL — no row mis-tagged. Post-apply before-number re-capture = byte-identical ($12,239.67/mo unchanged — ADD COLUMN moved no data). Shapes 4-6 carry columns (amortize term/start, increment_size, scales_with) DEFERRED honest-debt (no writer yet).
- **Step 2 — `fromCostObject` made SHAPE-AWARE** (`CountOnceSeam.ts`, the $0-collapse pivot): RECURRING_FIXED/PER_OCCASION → ONE `MONTHLY_POOL` event from `recurring_amount` normalized to monthly by `cadence`; ONE_TIME/absent/other → CAPEX from `acquisition_cost` (unchanged). **BYTE-IDENTICAL proven:** until the migration is applied AND the read path selects `cost_shape`, every live row arrives shape-absent → CAPEX branch → identical. Before/after capture diff (git-stash the change, re-run, diff) = **byte-identical** ($12,239.67/mo unchanged). New unit tests 8a-8e in `CountOnceSeam.test.ts` (50→**62** assertions, each catches its bug: pool-feed, ANNUAL÷12 normalization, byte-identical CAPEX regression, UNKNOWN→null never $0, the pool-not-capex pivot). Siblings unbroken (CostRollup 21 / CostToProduce 17 / ProjectLens 26). `build:cultivar` clean (2197 modules); `tsc --noEmit` clean for changed files (pre-existing Orders.tsx/SocialSetup.tsx errors unrelated). `[TRACE:COST]` instrumentation ON at the `analyze()` boundary (emits `fedFromRollup`/`capexExcluded`).
- **Step 4 — BACKFILL APPLIED 2026-06-17** (`scripts/backfill-recurring-costs.mjs`, service-key DML, idempotent guard + dry-run default). Tenant 45830ba7: 8 recurring config lines → 8 `cost_objects` rows `node_type='COST'` · `cost_nature='OPEX'` · `cost_source='MANUAL'` · `cost_shape='RECURRING_FIXED'` · `cadence`←period (monthly→MONTHLY, annual→ANNUAL) · `recurring_amount`←amount (NULL/UNKNOWN preserved as NULL, never $0; real $0 free-tier preserved as 0) · `cost_confidence`←confidence · `substantiation='OWNER_ASSERTED'` · `acquisition_cost=NULL` · `parent_id=NULL` (company-level). Lossless. **Labor NOT migrated** (stays in config — R3, flagged not dropped).
- **Step 5 — EQUIVALENCE GATE PASSED 2026-06-17** (`scripts/verify-backfill-equivalence.ts`). Simulates the post-flip read (config recurring emptied + labor kept from config + ALL `cost_objects` fed shape-aware through the count-once seam) and checks against the locked before-number: floor **$12,223.00** · estimated **$16.67** · KNOWN **$12,239.67/mo** · capexExcluded **$10,417.31** — ALL match the anchor to the cent. Catalog-count: **8 COST rows == 8 config recurring lines**. Seam flags 1 possible-duplicate (the two $100 CONFIRMED costs Claude Pro vs Claude API) — counts both (honest flag, not merged), total unaffected, same as pre-backfill. **Lossless proven → safe to flip.**
- **Step 6 — READ SOURCE FLIPPED 2026-06-17** (`packages/cultivar-os/src/pages/CostToProduce.tsx` + the capture mirror). The page now selects `cost_shape`/`cadence`/`recurring_amount`, feeds RECURRING_FIXED COST rows as the monthly pool via the shape-aware `fromCostObject`, and **stops counting `config.recurring[]`** (labor/margin/denominators stay in config — R3) so the pool is fed from exactly ONE source (no R2 double-count). **R1-SAFE GUARD:** `config.recurring[]` is dropped ONLY when migrated COST rows exist for that business (`hasMigratedRecurring`); an un-migrated tenant keeps the legacy config path byte-identical — the flip never zeroes anyone. **LIVE post-flip read proven** (`scripts/capture-cost-before.ts` flipped to mirror the page, reads live via service key → `AFTER-FLIP-snapshot.json`): tenant 45830ba7 live KNOWN **$12,239.67/mo == the locked anchor**. `build:cultivar` clean (2197 modules); `tsc` clean for the page. `[TRACE:COST]` tile-load now emits `flippedToCostObjects`/`configRecurringCounted`. **NOTE on bars:** this is BUILDER-COMPLETE — the live proof is a SERVICE-KEY read (proves data + computation). OWNER-PROOF through the browser UI under real RLS (anon key, logged-in owner) is step 8, David's bar.
- **Step 7 — WRITE PATH RE-POINTED 2026-06-17** (`packages/shared/src/components/CostToProduceSettings.tsx`, rewritten). The recurring-cost editor now reads/writes `cost_objects` rows (node_type='COST', cost_source='MANUAL') instead of `config.recurring[]` — closing the step-6 disconnect (tile reads cost_objects; editor must write them). Per-row entry gains: **nature picker** (CAPEX/COGS/OPEX, default OPEX) · **shape selector** (RECURRING_FIXED/PER_OCCASION only — the other 3 shapes withheld, their carry-columns are deferred, offering them = fake surface D-9) · **cadence** (WEEKLY/MONTHLY/QUARTERLY/ANNUAL) · **project picker** writing `parent_id` (lists REAL PROJECT nodes only — "CoolRunnings"/"Farm" — + "None (company-level)"; no fabrication, no inline creation — that's D-10 ProjectsManager) · **substantiation** (OWNER_ASSERTED default / SUBSTANTIATED). UNKNOWN ⇒ amount NULL (never $0). Labor/margin/denominators/overhead/reference STAY in `config` (R3); `config.recurring` PRESERVED untouched (dormant backup). **TRUNCATION-GUARD INTENT preserved in the row model:** per-row INSERT (new) / UPDATE-by-id (existing) / DELETE-by-id (ONLY explicit removals, tracked in `removedIds`) — NO bulk array overwrite, so a short/failed read cannot silently drop costs; a failed `cost_objects` read BLOCKS saving (loadError). **VERIFIED (service-key round-trip):** payload with all new fields + project `parent_id` FK passes every CHECK; UNKNOWN→null works; cleanup restored exactly 8 COST rows (no pollution). `build:cultivar` clean (2197 modules); `tsc` clean for the component. `[TRACE:COST]` emits on settings load + save (inserts/updates/deletes). **BUILDER-COMPLETE — service-key proof; OWNER-PROOF (step 8) is David's bar.**
- **HELD — Step 8 OWNER-PROOF (David, through the live UI under RLS):** the whole loop, logged in as the owner (anon key, real RLS) — see the step-8 checklist in the 2026-06-17 handoff. Step 8 OWNER-PROVEN 2026-06-18. **Labor was DEFERRED here** (rate×hours stayed in config this pass) → migrated in D-11/D-12 Stage 3 below.

**D-11 cost category + D-12 labor model FOUNDATION (Stages 1-3, 2026-06-18 — OWNER-PROVEN; Stage 4 owed):** the fourth P&L axis + the robust labor spine. Per `DECISION-cost-category-dimension.md` (D-11) + `DECISION-labor-cost-model.md` (D-12). Now FOUR orthogonal tags on a cost: PROJECT (`parent_id`) × NATURE (`cost_nature`) × SHAPE (`cost_shape`) × **CATEGORY** (`cost_category` — the Schedule C / QBO-mappable line-item axis, NEW).
- **Schema (Stage 2, migration `20260618_cost_category_and_labor_resources.sql`, applied + catalog-proven Q-W by David):** `cost_objects.cost_category text` (nullable, NO CHECK — per-business value set, AC-1, grows without migration). `labor_resources` table (robust D-12 shape: `resource_type` EMPLOYEE|CONTRACTOR · `rate_basis` HOURLY|FLAT_FEE · employee `base_wage`/`burden`/`cost_rate`/`bill_rate` · contractor `rate`/`pass_through_expenses`; RLS `labor_resources_owner_all`+`_member_all` membership-scoped AC-2; `set_updated_at_generic` trigger; business_id index). `cost_objects.resource_id` FK→labor_resources ON DELETE SET NULL + `cost_objects.labor_hours` numeric (nullable, NO default — NULL = not a labor row). `verify-cost-objects.mjs` extended with catalog checks (Q)-(W). Built robust now; only owner/contractor populate in TRACE — **Ignition** populates full depth (Sr/Tech/Jr roles, real burden/bill) without re-migration (the labor exemplar).
- **Owner labor migrated (Stage 3, OWNER-PROVEN):** the single owner-labor config line ($75×160=$12,000/mo CONFIRMED) pulled config→`cost_objects` as a real projectable cost (`cost_category='labor'`, OPEX, RECURRING_FIXED, MONTHLY, recurring_amount 12000, parent_id NULL, resource_id→"Owner", labor_hours 160). `hasMigratedLabor` R1-safe guard in BOTH the read path (`CostToProduce.tsx`) AND the capture mirror (`capture-cost-before.ts`): strip `config.labor` IFF a COST row with `cost_category IN ('labor','contract-labor')` (exact lowercase) exists; un-migrated tenants keep config.labor (byte-identical). **Proven:** 3a guard-dormant + 3b guard-active BOTH read floor **$12,123** / known **$12,280.67** (`LABOR-3a/3b-snapshot.json`) — guard prevented the $24,123 double-count. Seed: `seed-owner-labor.mjs` (idempotent, service-key). David owner-proved live `/costs` under RLS.
- **Stage 4 OWED (not built):** Settings reorg into 4 distinct blocks (RECURRING & OPERATING / LABOR / MARGIN POLICY / TARGET CUSTOMERS) + contractor entry UI (rate basis + pass-through) + category picker (Schedule C ~15-20, real values only, D-9) + re-point the write path off `config.labor`. Margin engine + categorized P&L block + spreadsheet grid DEFERRED onto the robust schema (no re-migration). `[TRACE:COST]`/`[TRACE:SEAM]` ON until Stage 4 owner-proof.

**D-16 Pricing Model B — recovery_basis split (Phase 2a, 2026-06-19 — SCHEMA WRITTEN/GATED, backfill in-migration):** the cost-to-serve vs platform-investment flag Model B requires, which the D-16 verify-first recon found is NOT cleanly derivable from existing columns (`cost_nature` too coarse — owner labor and per-tenant subs are both OPEX). Migration `20260619_cost_objects_recovery_basis.sql` (gated/unapplied — David applies + catalog-proves via short-lived PAT, then revokes). Adds FIFTH axis to `cost_objects`: **`recovery_basis`** (`COST_TO_SERVE` feeds the ÷N price | `PLATFORM_INVESTMENT` feeds the separate payback line — NEVER divided into per-unit price; text, nullable, NO CHECK — AC-4) + **`recovery_basis_source`** (`DERIVED` = system's default guess, owner un-vetted | `EXPLICIT` = owner-set; the "derived first, then explicit" honesty axis). **Backfill (in-migration, derived-default rule):** EMPLOYEE owner/founder labor (`cost_category='labor'` AND `resource_id`→`labor_resources.resource_type='EMPLOYEE'`) → PLATFORM_INVESTMENT; everything else → COST_TO_SERVE; `recovery_basis_source='DERIVED'` for ALL. Live TRACE split (45830ba7, 21 rows): **1 PLATFORM_INVESTMENT** (Owner labor) + **20 COST_TO_SERVE** (Connor/Andrew contract-labor are CONTRACTOR → cost-to-serve, + subs + 5 ASSET + 3 PROJECT + TX-tax). **A CLASSIFICATION, not an amount — moves NO total:** the tile SELECT/`fromCostObject` never read recovery_basis → floor stays **$11,323/mo**, known **$12,930.67/mo**, capex **$6,917.31** (byte-identical gate). **NO UI this pass** — flag + backfill only; Phase 2b makes it owner-overridable (→ EXPLICIT) + wires the cost-to-serve pool feed + payback line. **Known limitation (by design):** labor=investment proxy holds only for a two-person business; a future customer-serving EMPLOYEE or owner per-tenant support time needs an explicit override — that is exactly why the flag exists. `verify-cost-objects.mjs` extended with catalog checks (X)-(Z) — run with PAT after apply (the schema-verification gate).

**D-16 Pricing Model B — price split + payback line + overridable flag (Phase 2b/2c, 2026-06-19 — COMPUTE + UI, BUILDER-COMPLETE, owner-proof owed):** wires the Phase-2a `recovery_basis` flag into the live price. **NO schema, NO migration** (the flag already exists). **2c (compute, the money math):** the count-once seam (`CountOnceSeam.ts`) now partitions the monthly pool by `recovery_basis` — `enforceCountOnce` emits `poolCostToServeFloorMonthly`/`poolCostToServeKnownMonthly`/`poolInvestmentMonthly` (unrounded accumulators → reconcile to `poolKnownMonthly` by construction); `CostEvent`/`CountedEvent` carry `recoveryBasis` (default COST_TO_SERVE = Model A); `fromCostObject` reads `row.recovery_basis`. The engine (`CostToProduce.ts`) repoints the ÷N sensitivity table to **COST_TO_SERVE only** — `costFloor/costKnown = costToServe ÷ N`, price via the unchanged `MarginEngine.calculateRetail` single-slab — and adds `costToServeMonthly` + `platformInvestmentMonthly` to the result + per-N `contributionMonthly` (= priceKnown×N − costToServe, the $/mo toward the investment). The `/costs` page (`CostToProduce.tsx`) SELECTs `recovery_basis`, feeds it through, **rewrites the footnote** ("Cost-to-serve ÷ N at margin; platform investment shown separately") and adds a **Payback Card** (investment $/mo + per-N contribution + "covers it / X% of it"). The honest-totals block (floor/known/capex) is UNCHANGED — it shows total cost truth. **2b (overridable, the learning loop):** `/operating-costs` + Settings Block-2 LABOR each gain a per-row **recovery-basis control** (cost to serve | investment) with a **derived/explicit tag** — an owner override writes `recovery_basis_source='EXPLICIT'` immediately (the Owner-labor PLATFORM_INVESTMENT row lives in Settings Block 2, so the control is there; the 20 recurring COST rows are on /operating-costs). **N-list (Block 4):** now accepts an arbitrary list (1, 5, 20, 100, 500, 1000) via a text buffer, **dedupe+sort on blur**, one table row per value. **Proven (service-key, live TRACE 45830ba7):** honest-totals UNCHANGED (floor $11,323 · est $1,607.67 · known $12,930.67 · capex $6,917.31 · unknown 2); **split cost-to-serve $1,730.67 + investment $11,200 = $12,930.67 (`splitReconciles: true`)**; price moved exactly as the investment left the divide — **N=20: Model A ~$1,077.56 → Model B $144.99** (floor $10.99), N=1 $21,551→$2,884.99, N=5 $4,310→$576.99; **override round-trip** (Gemini Advanced COST_TO_SERVE→PLATFORM_INVESTMENT) flipped source→EXPLICIT, moved cts −$20 / inv +$20, known conserved, then **restored** (TRACE data untouched). Tests: `CostToProduce.test.ts` 17→**25** (new test 5: PLATFORM_INVESTMENT leaves the divide, stays in known, reconciles); CountOnceSeam **62** / CostRollup **21** / ProjectLens **26** unbroken. `build:cultivar` clean (2200 modules); changed files tsc-clean. Proof script: `scripts/verify-model-b-split.ts`. `[TRACE:COST]`/`[TRACE:SEAM]`/`[TRACE:opcosts]` emit the split — ON (standing). **NEXT (Phase 2d, deferred):** per-PROJECT N + margin dials (today business-level); LAWNS per-item feed.

**Seams declared:**
- `cost_objects.cost_source` — provenance SEAM for the connect-via-API layer (MANUAL now; QUICKBOOKS/BANK/RECEIPT/… later, no migration needed — loose by design).
- `business_inventory.receipt_id` FK→`receipts.id` (SET NULL) — COUNT-ONCE dedup seam. Presence = receipt is authoritative cost; absence = inventory's `unit_cost` stands. receipt_id is intentionally absent in the manual-entry form; linked only through the receipt flow.
- `business_service_log.receipt_id` — same COUNT-ONCE pattern. Receipt present = receipt is authoritative cost source for this service event.
- `cost_confidence` on both assets + inventory — Surface Honesty flag per PLATFORM_STRATEGY.md. ESTIMATED = human-typed number. CONFIRMED = receipt-linked. UNKNOWN = entered, source not known.

**AC compliance:** AC-1 ✅ — all table/column names use `business_` prefix; no vertical nouns. businessId from session context, never hardcoded. AC-2 ✅ — dual RLS policies (owner_all + member_all) match the receipts table pattern.

**remaining:** NAMED GAP — **Stage-cost ladder ↔ accumulator schema mapping (UNVERIFIED, load-bearing).** CLAIM (David, high-confidence, not yet proven): the LAWNS grower stage-cost ladder — cost attaches to growth STAGE, not species, ~6 stages (seed→liner→1gal→…) — maps onto the Core-2 accumulator as `cost_objects` node + sequential time-bounded `cost_object_assignments` ([[D-4]] temporal edge) + per-transition `conversion_cost`, the SAME model the SUB-2 temporal rollup validated (tractor: cost conserved across rabbit→idle→chicken, $4,999.95 ≈ $5,000, idle surfaced). If true: ONE cost engine serves both customer-zero's expense accumulator AND LAWNS inventory (AC-4 settle-once, two verticals). **VERIFICATION OWED before LAWNS inventory is built on this:** map the 6 stages onto assignment periods + conversion costs against a real nursery plant (seed→liner→1gal→… with cost added per stage), confirm conservation holds and the stage-cost number reads honest — same eyeball SUB-2 got. Until verified, treat as high-confidence direction, NOT a built guarantee. **Horizon:** before any LAWNS inventory/grower-stage capability is built on the accumulator (verify-before-build gate). NOT a defect — the schema (`cost_objects` + `cost_object_assignments` + `conversion_cost`) exists and is roadmap-ready; the unverified seam is whether the grower stage ladder reads honest on top of it. Cross-link [[D-4]] (dual-edge: structural `cost_object_edges` vs temporal `cost_object_assignments`) + §5.9 asset-lifecycle (`COST-TO-PRODUCE-DESIGN.md`).

⚠️ **Tech Debt #29 (OPEN):** `receipts` table should be renamed `business_receipts` for full AC-1 compliance. All receipt callers reference `receipts` currently. Deferred until after LAWNS demo. See `docs/tech-debt-log.md` #29.

---

## Cost-to-Produce — Config + Tile (period-pool engine + honest display + tune loop)

**What:** The Cost-to-Produce CONFIG (Settings) + DISPLAY (dashboard tile), MarginEngine-fed. Accumulates loaded monthly cost by confidence grade, divides by N target customers, and suggests a price at the configured margin — as a confidence-aware RANGE, never a false-precise single number.
**Status:** ✅ BUILT 2026-06-14 (THUNDER). Engine numerically verified; cultivar production build passes. ⚠️ David must run the seed migration to activate the TRACE tile.
**Vertical:** built into cultivar (forward vertical); engine + config panel are shared/general (promotable). **Type:** business-logic + UI
**Scope boundary:** config + engine + honest display + tune loop ONLY. **NOT** leakage capture, **NOT** per-sale actor/override store, **NOT** scan→QBO — all separate, sequenced after.

**What is built (2026-06-14):**
- `packages/shared/src/business-logic/CostToProduce.ts` — period-pool engine (the §3 "ACCUMULATOR/POOL" fork). `accumulate()` buckets cost lines by confidence (CONFIRMED+DERIVED floor / ESTIMATED soft / UNKNOWN never-zeroed); `analyze()` runs the sensitivity curve (cost ÷ N → suggested price via shared `MarginEngine.calculateRetail` with a target-margin slab); `marginConfigForTarget()` bridges margin→MarginEngine config. Pure, no DB/React. Exported via shared barrel + `business-logic` barrel.
- **D-14.6 SEVER (2026-06-19, `CostToProduceSettings.tsx`):** Block 1 (recurring & operating costs) is now a **READ-ONLY pricing scratchpad** — it DISPLAYS the recurring costs and links "Manage recurring & operating costs →" to `/operating-costs` (the sole writer); it **no longer inserts/updates/deletes `cost_objects`** (recurring write block + `removedIds` delete removed from `save()`; `addRow`/`editRow`/`removeRow`/`newLine` removed; editable inputs replaced with a read-only list). Ends the two-surface / two-save-model split. **Block 2 (LABOR, D-12) UNTOUCHED** — still writes `labor_resources` + applied-labor `cost_objects` via the Settings Save; Blocks 3/4 still write `business_modules.config`. `[TRACE:COST]` save log now reports `recurring: READ_ONLY (severed)` — emit kept ON (standing instruction). **Service-key proven (TRACE 45830ba7):** (b) labor write+edit round-trips; (c) `/operating-costs` recurring write+edit+delete round-trips; named recurring + labor rows byte-identical untouched (21→21, no leak). build:cultivar clean; tsc clean. **OWNER-PROOF owed (David, live RLS).**
- `packages/shared/src/components/CostToProduceSettings.tsx` — the TUNE surface. Reads/writes `business_modules.config` (module_key='cost_to_produce'). On mount it LOADS the stored config and renders every existing recurring line as an editable row (edit-in-place by index; save upserts on `business_id,module_key` — no duplicate append). Editable: recurring lines (label/amount/period/confidence — selecting UNKNOWN clears the amount), labor (rate×hours), overheadPerUnit, margin baseline + per-tier policy, denominator sensitivity set, reference price. Mounted in Cultivar `pages/Settings.tsx` verticalSection (shared slot). **2026-06-14 punch-list FIX 2:** money fields (labor rate, cost-line amount, overhead, reference price) display as `$X.XX` on blur via a local `MoneyInput` (raw numeric while focused; stored value stays numeric, cents-rounded). **2026-06-14 punch-list FIX 3 (data-loss):** the load previously swallowed read errors and silently substituted EMPTY on any null/odd-shape read, and save overwrote `recurring[]` unconditionally — so a short load was persisted as permanent truncation (it destroyed 8 of TRACE's 10 cost lines once). Now the load captures the read error (blocks editing instead of substituting EMPTY) + parses string configs, and save RE-READS the stored array and REFUSES to write fewer recurring lines than are stored unless the user explicitly deleted them (`removedCount`). Verified by live DB round-trip (DB→edit→save→DB, count held at 10; short-load save refused).
- `packages/cultivar-os/src/pages/CostToProduce.tsx` — the SEE-IT surface at `/costs`. Reads config + `business_inventory` (unit_cost/cost_confidence), runs the engine, displays: confidence mix (floor + estimated + UNKNOWN list), sensitivity table (cost & price per N as a range), material-cost panel. Surface Honesty: non-computable (no floor) → LABELED empty state, never a fake $0 price.
- Tile registry: ~~`cost_to_produce` added to `useModules.ts` MODULE_META + MODULE_ORDER (Calculator icon). Dashboard `handleNavigate` → `/costs`; `handleEnable` → `/settings`.~~ **SUPERSEDED 2026-06-23** — MODULE_META/MODULE_ORDER/the Dashboard switches are gone; `cost_to_produce` is now a first-class entry in the single `tileRegistry.ts` (route `/costs`, required_permission `view_costs`). See the Tile Registry entry in the Role Machine section. Route still registered in `router.tsx`.
- Seed: `supabase/migrations/20260614_cost_to_produce_trace_seed.sql` — TRACE tenant-zero real numbers into `business_modules.config` (idempotent, data-only, no schema change).
- Restore: `supabase/migrations/20260614_cost_to_produce_restore_truncated_lines.sql` — re-applies the canonical 10-line array to business 45830ba7 after the truncation bug destroyed 8 lines; preserves David's confirmed Claude Pro $100 + Gemini $20. Data-only, idempotent. Applied to the live cultivar DB this session AFTER the panel fix.

**Verified (executed, not asserted):** engine run against the exact seed (`scripts/verify-cost-to-produce.ts`): floor **$40.00/mo**, suggested price at N=1/5/20/100 = **$66.99 / $13.99 / $3.99 / $0.99** (40% margin), **6 UNKNOWN** costs surfaced (not zeroed); tune proof (labor 75×10hr → **$790/mo** recompute); all-unknown → **non-computable, no fake price**. `npm run build:cultivar` passes (2192 modules).

**Config home:** `business_modules.config` (business_id-scoped JSON; reversible). Multi-location-capable: `config.locations[]` array from day one (engine sums across all locations); UI edits a single default location but persists in the array, so N locations are not precluded (per `docs/strategy/MULTI-LOCATION-OPERATING-MODEL.md`).

**[NEEDS DAVID]:** (1) Claude Pro $17 vs Pro Max ~$100 — verify current plan. (2) Labor hours/month (seeded 0 → labor contributes $0 until set). (3) Tiered pricing ($149/$199/$249/$299) vs flat — tiers stored as policy, default tier priced. (4) Seed resolver targets `business_type='general'`/name ILIKE 'TRACE%' — confirm target business. (5) Settings-UI tuning needs David as an active `business_members` row for the TRACE business (membership-scoped RLS).

**Follow-up (flagged, not done):** `docs/trace-expenses.md` is the single-source-of-truth for expenses; the tile config should eventually read from it (today the config holds the values).

**Instrumentation (STD-003, 2026-06-15 — the gate's first live test):** `[TRACE:COST]` logging is ON BY DEFAULT across all three artifacts — config panel emits on LOAD (lines read + business_id, or load-FAILED→save-blocked) and SAVE (lines in/out + the truncation guard's REFUSED/OK decision); the tile emits `tile load` (config found? · inventory rows · unknown count); the shared engine `analyze()` emits `compute` (loaded cost · N set · per-N cost+price). This is the instrument David reads to OWNER-PROVE the save path through the real UI under RLS. Engine `compute` emit verified firing standalone (David's shape: $120 floor, 2 unknowns); load/save/tile emits are BUILDER-COMPLETE (compile + code-path), pending owner-proof. Stays ON until proven — then commented out, not deleted.

## Project-Lens — Cost-to-Produce BY PROJECT (Cultivar `/costs`) — D-10

**PURPOSE:** the "By project" lens on `/costs` — re-cuts the SAME honest captured cost data BY PROJECT as a collapsible tree (DECISION-project-lens-ui-design.md). Tenant business-NAME as visual root (rendered, NOT stored), `parent_id`-null costs under it as "Platform overhead", each PROJECT node with its rollup total (capex one-time vs /mo honestly separated, unknowns surfaced never $0). The flat company top-line is RETAINED above it (D-10: project cut ADDED, not substituted).
**Status:** ✅ BUILDER-COMPLETE — 2026-06-16 (THUNDER · D-10); OWNER-PROVEN. **Display/input refinement 2026-06-17** (THUNDER): full-inline edit + column headers + confidence↔amount coherence — see below.

**Display/input refinement (2026-06-17 — BUILDER-COMPLETE, owner-proof owed):** after owner-proof David found three display/edit gaps in the live tree (engine UNTOUCHED — these are render/input only). Fixed in `ProjectCostTree.tsx`:
- **(A) Column headers** — Cost · Confidence · Project · Amount, so the table explains itself.
- **(B) Amount column reads the REAL value + is inline-editable.** Root cause of the "CONFIRMED…unknown" contradiction: the column read `acquisition_cost` for EVERY row, so recurring COST rows (value in `recurring_amount`) showed "unknown". Fix: the tree now SELECTs `cost_shape`/`cadence`/`recurring_amount` and maps them into `ProjectLensRow` (which already extends `CostObjectNodeRow`) — so the already-shape-aware `fromCostObject`/`CostRollup` engine buckets recurring rows into the monthly pool. **NO engine change.** Amount shows `recurring_amount` + cadence suffix ($/mo·$/yr) for recurring, `acquisition_cost` (one-time) for capex; "unknown" ONLY when genuinely null. Inline number editor (click → input → blur/Enter commits, Esc cancels). Beneficial side effect: group rollup totals + the root "Captured" line now include recurring (overhead $279.67/mo, was $0).
- **(C) Confidence↔amount coherence (D-9 enforced at input — CONFIRMED-but-unknown is now UNREACHABLE):** UNKNOWN ⟺ no amount. → UNKNOWN clears the amount; → any other grade on an amountless row opens the amount editor to collect the number first (David's HP ProDesk flow); setting an amount on an UNKNOWN row bumps it to ESTIMATED. Display surfaces a pre-existing incoherent row (live: `HP ProDesk 600 G6` = ESTIMATED + no amount, from an earlier inline edit) but never fabricates — David resolves it by clicking the amount.
- **Verified:** `build:cultivar` clean (2197 modules); `tsc` clean for `ProjectCostTree.tsx`. Data-level proof (service-key, mirrors the tree map → `buildProjectLens`): Claude Pro $100/mo, Claude API $110/mo, domains $200/yr, capex one-time; group totals correct. `[TRACE:PROJECTLENS]` STAYS ON (David's standing decision — until Andrew's asset/inventory add widget is online + tested; NOT commented out by this fix). **Owner-proof owed** (David, live UI under RLS — steps in the 2026-06-17 handoff).

**Group-ordering + unknown-accounting fix (2026-06-17 — BUILDER-COMPLETE, owner-proof owed):** two display/input fixes on the same surface (engine UNTOUCHED). Fixed in `ProjectCostTree.tsx` (+ a 1-line input filter in `CostToProduce.tsx`):
- **(FIX 1) Group order.** Overhead (company-level) PINNED to the top — it's the base layer serving the whole business, not a project competing alphabetically. Projects below, sorted alphanumerically (A-Z, numeric-aware `localeCompare`). Owner-controlled order with NO new UI: prefix a project "1."/"A." and the prefix becomes the sort key (no drag-reorder, no order column). Display-only sort over `view.groups`; the adapter still returns input order.
- **(FIX 2) One honest definition of "unknown" everywhere** (`isUnknownCost` = an ASSET/COST node with genuinely no amount; NEVER a project, NEVER a non-unknown cost). The top unquantified-costs block, the resolve modal, the per-group pills, AND the root count all read this ONE set, so they can never disagree. Before: the analyze card OVER-counted (listed PROJECT nodes CoolRunnings/Farm as "unknown costs") while group pills UNDER-counted (`rollup.seam.unknownLines` dropped COST-typed nulls like Resend/Twilio).
  - **(2a) Top block** lists the genuine unknown COSTS grouped by project-as-LABEL (`"CoolRunnings: HP ProDesk"` / `"Company-level: Resend, Twilio"`) — the project gives context, is never itself a listed cost; count = real unknown costs.
  - **(2b) Group pills** count `g.children.filter(isUnknownCost)` (display-layer count; engine untouched), so they include COST-typed nulls and match the block.
  - **(2c) Click-to-resolve modal** — clicking the block opens a focused worklist of JUST the unknown costs with the same 4 columns and the SAME coherent inline editor (the row JSX extracted to a shared `CostRow` used by both the tree and the modal — one editor, not two). Resolving one (set amount/confidence) drops it off the live canonical set → the block + modal shrink.
  - **`CostToProduce.tsx` analyze-card fix:** `rollupEvents` now filters to `node_type ASSET|COST` before `fromCostObject`, so PROJECT/PRODUCT buckets stop surfacing as phantom unquantified costs. NO dollar change — a null-amount bucket contributed $0; this only stops it inflating the unknown count.
- **Verified:** `build:cultivar` clean (2197 modules); `tsc` clean for both files. `[TRACE:PROJECTLENS]` STAYS ON (+ emits on resolve-worklist open). **Owner-proof owed** (David, live UI under RLS).

**Small-fixes pass (2026-06-17 — BUILDER-COMPLETE, owner-proof owed):** three display/input fixes from David's live owner-proof of the ordering build (engine UNTOUCHED). `ProjectCostTree.tsx` + `CostToProduce.tsx`:
- **(FIX 1) Page top-line count no longer goes stale on resolve.** The page-level "What we know" unquantified count comes from `analyze()` (keyed on `businessId`); resolving a cost in the by-project modal updated the tree (bottom) but not the page card (top showed 3, bottom 2 until refresh). `ProjectCostTree` now fires an `onChanged` callback after every WRITE (`reloadAll`), and `CostToProduce` bumps a `reloadKey` in the `analyze()` effect deps → the page count recomputes from the same fresh `cost_objects` immediately, no refresh.
- **(FIX 2) One resolve modal, reachable from top OR bottom.** The resolve modal is now CONTROLLED by the page (`resolveOpen`/`onResolveOpenChange` props on `ProjectCostTree`, internal-state fallback when omitted). The page-level "N unquantified costs" block is now a clickable button that opens the SAME modal the tree's block opens — one modal, one canonical set, no second editor (still the shared `CostRow`). Single source of truth ⇒ structural fix for FIX 1's drift.
- **(FIX 3) Clickable section titles → edit surface.** "Cost & price by target customers (N)" title → `/settings` (the `CostToProduceSettings` margin/target-N/reference editor). "Material costs (inventory)" title → `/inventory` (the existing `BusinessInventory` list/add page — clickable even when the section is empty, so David can hand-jam test rows). `SectionTitle` gained an optional `onClick` (renders as a green button with a `›` chevron when navigable).
- **Verified:** `build:cultivar` clean (2197 modules); `tsc` clean for both changed files. `[TRACE:PROJECTLENS]` STAYS ON; `[TRACE:COST]` emits on page-block resolve-open. **Owner-proof owed** (David, live UI under RLS).
**Files:**
- `packages/shared/src/business-logic/ProjectLens.ts` — pure grouping adapter (`buildProjectLens`). **PATH A (settled with David):** synthesizes containment edges (`use_fraction=1.0`) from `cost_objects.parent_id` and rolls each group up THROUGH `CostRollup.rollup()` + the count-once seam. **The load-bearing wiring note:** `CostRollup` traverses the `cost_object_edges` *table* (`graph.edges`), NOT the `parent_id` column — the adapter bridges them at read time. Single-parent + fraction 1.0 ⇒ identical number to a direct seam group today; composes for free when real `cost_object_edges`/`cost_object_assignments` rows arrive (shared costs, asset reuse, idle capital). Exported from `business-logic/index.ts`.
- `packages/cultivar-os/src/components/ProjectCostTree.tsx` — the tree section (collapse/expand, click-to-edit confidence + parent-reassignment, honest flags surfaced).
- `packages/cultivar-os/src/components/ProjectsManager.tsx` — entry-side PROJECT-bucket CRUD modal (create/rename/deactivate `node_type='PROJECT'` nodes; deactivate re-points children `parent_id → null` → fall back to company-level, never cascade-destroyed). AC-4 minimal: name only.
- `packages/cultivar-os/src/pages/CostToProduce.tsx` — renders `<ProjectCostTree>` below the flat top-line (reads `cost_objects` directly, so it shows even before the cost-to-produce config is set).
**Row controls (§4):** confidence + parent render as badges → dropdowns ON CLICK. **Cadence DEFERRED** (David-agreed): no `cost_objects` column (recurring lives in `business_modules.config`), so a cadence dropdown would be a fake surface (D-9). Built only when recurring costs are captured as `cost_objects`.
**Reassignment (§5):** parent dropdown → `UPDATE cost_objects.parent_id` (a MOVE, never a copy — single-parent §3) → reload → rebuild lens → recompute BOTH affected totals through the seam (honest re-derive, no local +/−).
**Verified (executed):** `packages/shared/src/business-logic/ProjectLens.test.ts` — **26 assertions, 0 failures**; each computes what a BUGGY adapter would produce and asserts the real one differs (parent-id grouping, overhead bucket, UNKNOWN-cost asset surfaced never $0, reassignment-as-MOVE with both totals recomputing, single-parent no-double-count, dangling-parent fallback+flag, flat company total count-once). Bug caught + fixed during the run: a PROJECT node's null own cost was leaking into the flat total as a phantom unknown — now filtered (mirrors `CostRollup` gather step 1). Sibling suites unbroken: CostRollup **21** / CountOnceSeam **50** / CostToProduce **17**. `npm run build:cultivar` passes (2197 modules); `tsc --noEmit` clean for all four new/changed files (pre-existing `Confirmation.tsx` errors are unrelated).
**Instrumentation (STD-003):** `[TRACE:PROJECTLENS]` ON BY DEFAULT — emits on load / reassign / regrade / project create/rename/deactivate. Stays ON until owner-proven, then commented out (not deleted).
**[NEEDS DAVID — two-tenant owner-proof]:** (TRACE tenant `45830ba7…`) create CoolRunnings + BuiltWithCAI projects, assign the seeded hardware, watch project + overhead totals recompute on reassignment, confirm nothing double-counted, collapse/expand + click-to-edit work. (LAWNS tenant) confirm TRACE's hardware is correctly ABSENT — the "right kind of empty" proves the tenant boundary (RLS, AC-3). No schema/honesty-engine change — wires existing bones. Cross-link [[D-10]] [[D-1]] [[D-4]] [[D-7]] [[D-9]]; tech-debt sibling #38.

### Per-project cost-to-produce DRILL-IN — D-14 Phase 1 (Cultivar `/costs`)

**PURPOSE:** select ONE project group in the By-project tree → see ITS cost-to-produce in isolation (the company "What we know — honestly" view scoped to one project). Cost-only (D-14: cost truth ≠ price strategy); pricing/margin/N is Phase 2 and is intentionally OMITTED (no dead panel — Surface Honesty).
**Status:** ✅ BUILDER-COMPLETE 2026-06-18 (THUNDER · D-14 Phase 1) — service-key reconciliation proof PASSED on real TRACE tenant; **OWNER-PROVEN owed** (David, live UI under RLS).
**ZERO SCHEMA, ZERO RECOMPUTE:** the two headline figures (Monthly pool, One-time capital) are taken VERBATIM from the selected group's existing `rollup` (`group.rollup.poolKnownMonthly` / `.capexKnown`) — the SAME `NodeRollup` the tree already renders — so the number CANNOT change between tree and drill-in (the reconciliation contract). The by-category split is a pure view-layer group-by over the project's child rows, normalized through the SAME shared `fromCostObject`; "Other recurring" is derived as the remainder (pool − labor) so the parts ALWAYS sum to the authoritative pool.
**Shows:** project name header · two headline figures · monthly pool by category (Labor `cost_category ∈ {labor, contract-labor}` / Other recurring / Capital shown separately as one-time) · confidence mix for THIS project (floor / estimated / unknown labels). Money via `Intl.NumberFormat('en-US', USD)`, right-aligned.
**Files:**
- `packages/cultivar-os/src/components/ProjectCostDrillIn.tsx` — NEW. The drill-in modal + pure `summarizeGroup(group, children)`. Widget-header present.
- `packages/cultivar-os/src/components/ProjectCostTree.tsx` — adds `cost_category` to the SELECT + a widened `LensRowWithCat` row type (carried onto `group.children` at runtime), a per-group "Cost to produce" trigger button, and renders `<ProjectCostDrillIn>`.
**Verified (executed):** service-key proof `scripts/verify-project-drill-in.ts` (bundle via esbuild → node) — ALL groups reconcile ✅ on real TRACE tenant `45830ba7…`: Platform overhead $12,124/mo (labor $12,000 + other $124), CoolRunnings $450/mo + $917.31 capex, Farm $6,000 capex, **BuiltWithCAI $1,156.67/mo (labor $1,000 + other $156.67), 2 unknown (Resend, Twilio)** — drill-in pool/capex == tree pool/capex in every group. `build:cultivar` clean (2199 modules); `tsc` clean for both files.
**Instrumentation (STD-003):** `[TRACE:PROJECTLENS] drill-in open` (projectId, headline figures, category split, confidence mix) + a `reconcile-drift` 🟡 warn if the confidence-mix sum diverges from the authoritative pool (possible seam-merged dup). ON BY DEFAULT until OWNER-PROVEN.
**[NEEDS DAVID — owner-proof]:** open `/costs` → By-project → click "Cost to produce" on BuiltWithCAI (or any project) → confirm the headline pool/capital MATCH that group's row in the tree, the Labor/Other split sums to the pool, the confidence mix + unknown labels look right, and there is NO pricing panel. Cross-link [[D-14]] [[D-10]] [[D-4]]; Phase 2 = pricing layer (settable N + margin + cross-branch carve-out).

**Phase 1.1 — aggregates EXPAND to line items (2026-06-18 — BUILDER-COMPLETE, owner-proof owed):** Labor / Other recurring / Captured capital are click-to-expand (read-only); each line item shows name · amount (Intl USD) · confidence badge · `cost_category` · 🧾 receipt link if `receipt_id`. **HONESTY FIX (the point of the feature):** "Other recurring" is now a REAL positive group-by of non-labor monthly rows — NOT pool-minus-labor; a null/blank `cost_category` surfaces as its own **Uncategorized** line item (amber-flagged, never absorbed in a remainder). Reconciliation holds two ways: Σ line items === each aggregate, AND labor+other === pool / Σ capital === capex (the tree totals). `receipt_id` added to the tree's existing SELECT (+1 column, carried by reference — no new query); `LensRowWithCat` widened. Receipt link → `/receipts` (Receipt Keeper); per-receipt deep-link `/receipts/:id` does not exist → 🟡 honest-debt. SCOPE FENCE held: read-only, no inline edit / reassign / project-assignment (the banked `/assets` gap). **Service-key proof PASSED** (`scripts/verify-project-drill-in.ts` extended): all groups reconcile both ways on real TRACE tenant — CoolRunnings capital $917.31 itemizes to 4 hardware rows (2 with receipts), BuiltWithCAI Other $156.67 itemizes to 4 real non-labor rows. **UNCATEGORIZED surfaced widely** (nearly all non-labor rows are currently untagged) — honest visibility, the feature working as intended, NOT a failure. `[TRACE:PROJECTLENS] drill-in expand` (projectId, aggregate, lineItemCount, anyUncategorized) + `reconcile-drift` guard ON. `build:cultivar` clean (2199 modules); `tsc` clean. Files: `ProjectCostDrillIn.tsx`, `ProjectCostTree.tsx`. **[NEEDS DAVID]:** expand each aggregate live under RLS → line items sum visibly to the aggregate; confirm the Uncategorized rows are the real mistagged costs (a prompt to categorize them — but categorization itself is the separate `/assets` write gap, not this read-only pass).

---

**remaining:** ~~NAMED GAP — **Project-grouped cost view + parent-picker on cost entry — UNBUILT**~~ ✅ **BUILT 2026-06-16** (see "Project-Lens — Cost-to-Produce BY PROJECT" above; builder-complete, owner-proof owed). Original gap text retained for provenance: Decision [[D-10]]: the primary `/costs` lens should be **Company → Project (CoolRunnings / BuiltWithCAI / each vertical) → its costs**, with cost entry able to ASSIGN an item to a project. The flat ÷N business pool is correct as the **company-total top-line** and stays; the project cut is **added**, not substituted. **This is surfacing existing bones, not new architecture:** `cost_objects.node_type` already has PROJECT, `parent_id` self-FK exists ([[D-1]] Core-1), and `CostRollup.ts` (Core-2b SUB-2) already traverses both edge tables ([[D-4]]) for a per-node rollup — "CoolRunnings + all under it" already computes; it just isn't surfaced as a grouped view. **VERIFY-FIRST DONE (read-only, 2026-06-16): CONFIRMED FLAT.** The only `cost_objects` insert path is the asset form `packages/cultivar-os/src/pages/BusinessAssets.tsx:173-194`, which hardcodes `node_type:'ASSET'` and **never writes `parent_id`** → every UI row is a flat parentless ASSET node; no UI creates PROJECT nodes or sets `parent_id`; `CostToProduce.tsx:96` reads `node_type` but selects no `parent_id` and does no grouping. **The three pieces of work (scope):** (a) cost entry lets you pick the **PROJECT** (`parent_id`) an item belongs to — and create PROJECT nodes; (b) `/costs` gains a **by-project grouping** reading through the existing rollup (per-PROJECT-node), with the flat company total **retained** as the top-line; (c) the **DAG-diamond double-count seam** (already flagged in `CostRollup.ts` — rollup-sum double-counts shared children) must be honored when grouping. **NOT a defect** — the schema axes + rollup exist and are roadmap-ready; the gap is purely the entry-side `parent_id`/PROJECT write + the grouped read surface. Distinct from the honesty engine ([[D-9]]), which is **OWNER-PROVEN correct as-is**. Cross-link [[D-10]] (decision + reasoning), [[D-1]] (node table), [[D-4]] (dual-edge rollup), [[D-7]] (flat top-line is count-once truth). Tech-debt sibling: #38 (frictionless multi-channel cost capture — capture≠classification).

---

## Count-Once Slice Seam (Shared) — Core-2a SPIKE → Core-2b full matcher

**What:** The accumulator→period-pool count-once enforcement primitive — the highest-risk seam in the cost-to-produce arc (`COST-TO-PRODUCE-DESIGN.md` §14 SLICE SEAM). §14 states the rule as INTENT only (§3 query-time, §5.4 source-of-truth, §5.2 DAG) and names one signal (`receipt_id`); this implements it as a **query-time reconciliation gate over cost EVENTS**. Proven in ISOLATION against real CoolRunnings data BEFORE any rollup depends on it.
**Status:** ✅ BUILDER-COMPLETE — 2026-06-15 (THUNDER · Core-2a spike). **NOT yet OWNER-PROVEN.** Spike only: does NOT build the rollup, wire the tile-feed, or read the DB.
**Vertical:** shared | **Type:** business-logic (pure)
**Location:** `packages/shared/src/business-logic/CountOnceSeam.ts`
**Barrel:** `packages/shared/src/business-logic/index.ts`

**What the seam does:**
- Enforces both §14 double-count shapes: **Shape 1** (same cost in BOTH `cost_objects` accumulator AND `config.recurring[]` pool → counted ONCE) and **Shape 2** (CAPEX `acquisition_cost`/`conversion_cost` BARRED from the ÷N monthly pool — accumulates separately on the node).
- **Event is the unit of truth:** `sameCost(a,b)` — **upgraded to the full Core-2b matcher (2026-06-15)**: returns a `CostMatch` (MERGE | DISTINCT | NEED_CLARIFICATION) + epistemic bucket (D-9: KNOW/THINK/REASON/NEED-CLARIFICATION) + reasoning + cost SHAPE (D-8: RECURRING_FIXED/PER_OCCASION) + a suggested disposition on NEED_CLARIFICATION (Core-2a returned a bare SAME/DIFFERENT/UNSURE string). `receipt_id` is a SIGNAL, not the key — a receipt is a *container* of line events, so equal `receipt_id` is confirmed at line level (amount) before collapsing (NSPanel + meross share one order but are distinct items → DISTINCT). FLAG-don't-merge when unsure (over-correction that drops real cost is the moat-killer failure). Single swappable function; only `enforceCountOnce` consumes it. See **Cost-Object Matcher + Rollup + Seam-Feed — Core-2b** below.
- **Two independent axes preserved** (do NOT collapse — Core-2b needs both): `amountConfidence` (CONFIRMED/DERIVED/ESTIMATED/UNKNOWN) and `substantiation` (SUBSTANTIATED = has a receipt vs OWNER_ASSERTED = typed, no proof). The seam COUNTS owner-asserted cost AND rolls up `substantiatedTotal` vs `ownerAssertedTotal` so a later layer can flag "counted + at-risk". Makes cost visible; asserts nothing about deductibility (design §1/§2).
- **Graceful degradation (OP-5/OP-6):** UNKNOWN amounts surfaced never zeroed; UNCONFIRMED realization ("is this even a cost yet?") surfaced as uncertainty never a silent $0; net-zero reversals (purchase+return) net to $0 with no negative pool leak.

**Proving corpus:** `packages/shared/src/business-logic/__fixtures__/coolrunnings-corpus.ts` — real CoolRunnings hardware (business 45830ba7) from `docs/coolrunnings-hardware-spend-2026-06-02.md`, shaped as `cost_objects` ASSET rows. NOT inserted into the live DB (seam is pure/isolated; migration apply is David's gate). Deliberately-messy cases: NSPanel ($259.80 CONFIRMED/SUBSTANTIATED), meross ($91.81 DERIVED/SUBSTANTIATED), HP ProDesk (UNKNOWN/OWNER_ASSERTED), Ecobee (net-zero return), Apollo MSR-2 (UNCONFIRMED status conflict).

**Verified (executed, not asserted):** `packages/shared/src/business-logic/CountOnceSeam.test.ts` — adversarial seam tests, **50 assertions, 0 failures** (Core-2a was 32; Core-2b added car-wash / card+receipt / shape / spacing cases); each computes what a BUGGY seam would output and asserts the real seam differs (proves the assertion has teeth). Run: `node_modules/.bin/esbuild <test> --bundle --platform=node --format=cjs | node`. `tsc --noEmit --strict` clean; `npm run build:cultivar` passes (2194 modules). **Number against the CoolRunnings corpus (owner-does-nothing):** capex floor **$351.61** (NSPanel $259.80 + meross $91.81, both substantiated), monthly pool **$6.50** (Nabu Casa, owner-asserted), **1 UNKNOWN** surfaced (HP ProDesk — not zeroed), **1 UNCONFIRMED** (Apollo — not silent-$0), **1 net-zero pair** (Ecobee), capex correctly excluded from the ÷N pool.

**Instrumentation (STD-003):** `enforceCountOnce()` emits `[TRACE:SEAM] reconcile` ON BY BIRTH, unconditional (no env-gate) — events in/survivors, capex vs pool totals, unknown/unconfirmed/deduped/net-zero counts, substantiated vs owner-asserted split. Matches the `[TRACE:COST]` uppercase-area convention. Stays ON until David owner-proves the seam through the real UI under RLS — then commented out, not deleted.

**[NEEDS DAVID — owner-proof]:** eyeball the corpus number for believability ($351.61 capex / $6.50/mo / HP+Apollo flagged). **Core-2b status (2026-06-15):** full `sameCost` matcher ✅ + dual-edge rollup ✅ + seam-feed ✅ all BUILDER-COMPLETE (see Core-2b section below). Remaining: live corpus seeding into `cost_objects` (gated on migration apply) + owner-proof of the seam-fed live tile.

---

## Cost-Object Matcher + Rollup + Seam-Feed (Shared) — Core-2b

**What:** The three sub-builds that turn the Core-2a count-once spike into a working accumulator→pool path: (1) the full multi-signal `sameCost` matcher, (2) the dual-edge rollup, (3) the live Cost-tile seam-feed.
**Status:** ✅ BUILDER-COMPLETE — 2026-06-15 (THUNDER · Core-2b). **NOT yet OWNER-PROVEN.** Code committed deploy-safe; the seam-feed is DORMANT until the `cost_objects` migration is applied + data captured (deliberate, separate step — HELD by David).
**Vertical:** shared (engine) + cultivar-os (tile wiring) | **Type:** business-logic (pure) + one page

**SUB-1 — full `sameCost` matcher** (`packages/shared/src/business-logic/CountOnceSeam.ts`):
- Three honest outcomes **MERGE | DISTINCT | NEED_CLARIFICATION**, each carrying epistemic bucket (D-9) + reasoning + cost SHAPE (D-8: `classifyShape()` reads explicit `cadence`/pool-provenance, OR infers from date spacing — ~weekly/monthly/quarterly/annual windows). NEED_CLARIFICATION carries a **suggested disposition** (proposed home + question + candidate interpretations + reasoning) as DATA, phrased so acceptance is cheap; it rides through to `possibleDuplicates[].match` so the downstream accept/reject workflow (#38) needs no recomputation. SCOPE: data only — no accept/reject UI, no counting-on-acceptance (downstream).
- **Canonical case — car-wash subscription (the under-count trap):** two $9.99 same-merchant charges a month apart → NEED_CLARIFICATION + RECURRING_FIXED + disposition "two separate subscriptions (e.g. two vehicles / business+personal), or one subscription across two periods?". Does NOT merge (no under-count), does NOT treat as per-occasion, recurring shape reachable from spacing alone.

**SUB-2 — dual-edge rollup** (`packages/shared/src/business-logic/CostRollup.ts`):
- `rollup(targetId, graph)` traverses BOTH edge tables (D-4): **structural** `cost_object_edges` (containment + contribution, `use_fraction` allocation, §5.2/§5.5/§5.7) AND **temporal** `cost_object_assignments` (asset→project period-share, conversion_cost on receiving project, §5.9). Feeds attributed events THROUGH `enforceCountOnce` (capex out of pool, dedup) — the rollup is a SOURCE into the seam, not a bypass. Surfaces allocation provenance, flagged unconfirmed *allocations* (basis_confidence, separate axis from $ confidence), and **idle capital** (asset life not attributed to any project → held by domain, OP-6). Pure; no DB. Known open seam flagged in-code: DAG-diamond fraction-scaled double-count (§5.2/§14).
- **Worked numbers (rabbit/tractor, §5.9):** $5,000 tractor across rabbit (181d) → idle (31d) → chicken (318d, open) — rabbit $1,707.55 + chicken $3,000 (+$300 conversion) + idle $292.45 = **$4,999.95 ≈ $5,000 (conservation holds)**. Structural install PROJECT = $351.61 capex, HP (0.6×UNKNOWN) surfaced UNKNOWN, Apollo UNCONFIRMED surfaced.

**SUB-3 — live Cost-tile seam-feed** (`CostToProduce.ts` engine + `cultivar-os/src/pages/CostToProduce.tsx`):
- `accumulate()`/`analyze()` gained optional `{ rollupEvents }`. When real captured `cost_objects` events are fed, the typed config (`recurring[]`+labor) AND those go through the ONE `enforceCountOnce`: **CAPEX excluded** from the ÷N monthly pool (surfaced as "captured capital, one-time"), cross-source duplicates **counted once** (ambiguous look-alikes flagged, not silently doubled/merged), captured recurring folds into the pool. The tile is the business-level **flat count-once feed** of captured objects' own events (NOT a `rollup()` traversal sum — that double-counts parent+child at business level; `rollup()` stays the per-node surface).
- **Deploy-safe / DORMANT:** `cost_objects` migration is gated/unapplied. Tile fetch → relation error / no rows → `rollupEvents=[]` → **byte-identical** to the proven config-only path. Zero behavioral change until David applies the migration + captures data. New `[TRACE:COST]` fields: `fedFromRollup`, `rollupEventsIn`, `capexExcluded`, `possibleDuplicateCount`.
- **receipt_id un-blindfolded on the LIVE path (2026-06-18, BUILDER-COMPLETE):** the live `/costs` SELECT (`CostToProduce.tsx:105`) had OMITTED `receipt_id`, so `enforceCountOnce` ran live but never received the seam's strongest dedup signal. Fix = add `receipt_id` to the SELECT + pass it into `fromCostObject` (which already maps it → `event.receiptId`). **Dedup logic UNCHANGED** — only the signal is now delivered. SELECT-only; no schema (column EXISTS, D-5). Service-key before/after proof on the seeded 264f9e5f pair (NSPanel $259.80 + MINI Duo-L $65.70, one Amazon order): `sameCost` verdict upgraded **DISTINCT via `amount` → DISTINCT via `receipt_id`** (authoritative "distinct line items on one order", bucket KNOW) — correctly **NOT merged**. **No total moved** (byte-identical): knownMonthly $13,730.67, floor $12,123, capexExcluded $6,917.31, survivors 16→16, deduped 0→0, possibleDuplicates 0→0 — identical before/after, justified (the pair was already kept separate; now for the right reason). The sibling ProjectCostTree/lens path already fed receipt_id (D-14). `[TRACE:SEAM]` reconcile now summarizes receipt_id-aware dedup. **OWNER-PROOF owed** (David, live `/costs` under RLS).

**Verified (executed, not asserted):** three pure-function suites, `tsc --noEmit --strict` clean, `npm run build:cultivar` passes (2194 modules):
- `CountOnceSeam.test.ts` — **50 assertions** (was 32; + car-wash NEED_CLARIFICATION, card+receipt MERGE, one-off-vs-subscription SHAPE, spacing-alone recurring inference).
- `CostRollup.test.ts` — **21 assertions** (containment/contribution, use_fraction, period-share, conversion-on-receiving, conservation + idle).
- `CostToProduce.test.ts` — **17 assertions** (config-only regression, capex-excluded, count-once, recurring-fold).
Each test computes what a buggy build would output and asserts the real one differs (assertions have teeth).

**Instrumentation (STD-003):** `[TRACE:ROLLUP]` (rollup) ON by birth, unconditional; `[TRACE:SEAM]` + `[TRACE:COST]` carry the new seam-feed fields. All stay ON until David owner-proves the live seam-fed tile under RLS — then commented out, not deleted.

**[NEEDS DAVID — activation + owner-proof, HELD]:** apply `supabase/migrations/20260615_cost_objects_rename_and_node_schema.sql` → `SUPABASE_PAT=… node scripts/verify-cost-objects.mjs` (catalog gate) → seed real cost_objects → exercise the live `/costs` tile under RLS and judge the seam-fed number honest. Until then the seam-feed is dormant and the live tile is unchanged.

---

## Margin Engine (Shared)

**What:** Shared margin calculation engine — 4-slab markup, tier discounts, overhead-per-unit wire, leakage detection.
**Status:** ✅ BUILT — 2026-06-10 (THUNDER · Build 1). Replaces 17-line dead stub.
**Vertical:** shared | **Type:** capability
**Location:** `packages/shared/src/business-logic/MarginEngine.ts` (canonical)
**Barrel:** `packages/shared/src/business-logic/index.ts`

**What the engine has:**
- 4-slab table (Consumables/Mid-Range/Heavy/Major) — matches `MarginEngine.js` (A) exactly
- Tier discounts by name string (AC-1: FLEET/LEGACY/FF are config DATA, not TS identifiers)
- `overheadPerUnit` field wired into loaded cost before slab selection — TD#16 overhead slot
- Charm rounding: `Math.ceil(retail) - 0.01` (matches A; stub used broken `Math.floor+0.99`)
- `analyzeTransaction()` — leakage detection, profit margin %
- Pure functions, no DataBridge, no Supabase, no vertical imports

**Unit check (acceptance criteria):**
- `cost=$6, STANDARD, overheadPerUnit=0` → $23.99 ✓ (matches A)
- `cost=$6, STANDARD, overheadPerUnit=$2` → loaded=$8, $31.99 ✓ (overhead wired)

**Deprecated implementations (all marked 🔴, not deleted):**
- A: `packages/ignition-os/MarginEngine.js` — source of canonical slab logic; marked deprecated; callers migrate import path
- B: `packages/shared/src/pricing/marginEngine.ts` — dead 17-line stub with broken rounding; zero live callers; delete after migrating barrel export
- C: `DataBridge.getActiveMargin()` / `.calculateRetail()` — prot_matrix percent model (DIFFERENT pricing); callers will see price change at migration (accepted)
- D: `IgnitionEstimate.jsx` `markup_percent` — flat percent fallback
- E: `IgnitionOmni.jsx` `shops.margin_config` — display-only storage, not a pricing calc

**Overhead wire status:** Slot built. Source = `DataBridge.overhead_config.monthly` (rent + electric + fuel + insurance + maintenance). Caller must compute `sum(monthly) / avg_monthly_part_count` and write to engine config. Wiring UI (IgnitionProt → DataBridge `margin_config.overheadPerUnit`) is the first step of the Cost-to-Produce tile session.

**Migration checklist:** `docs/audits/margin-engine-migration-checklist-2026-06-10.md` — full caller map, ordered by risk, price-change warnings for C callers.

---

## Subscription Tiers + Pricing

**What:** Pricing tiers and module matrix defining what's included at each tier.  
**Status:** ✅ Documented — `CAI/docs/pricing_sheet.html` (printable, authoritative)  
**Vertical:** ignition | **Type:** infrastructure  
*⚠️ NEEDS DAVID'S CALL — see bottom: pricing tiers are currently Ignition-specific from CAI; whether they apply platform-wide or each vertical has its own tier structure is unresolved.*

**Authoritative detail:** [`CAI/docs/pricing_sheet.html`](../CAI/docs/pricing_sheet.html) — printable, authoritative tier/add-on/module matrix.

> ⚠️ DEPRECATED — canonical source is `CAI/docs/pricing_sheet.html` above; remove this inlined copy in a later cleanup pass.
>
> | Tier | Price | Users | AI |
> |---|---|---|---|
> | STARTER | $149/mo | 3 | None |
> | PROFESSIONAL | $299/mo | 8 | AI Bundle (12 tasks) |
> | PREMIER | $499/mo | Unlimited | Full AI (13 tasks) |
> | Trial | Free, 14 days | Unlimited | Full PREMIER access |
>
> **Add-ons:**
> - Extra Location: +$99/mo
> - 5-User Block: +$49/mo
> - SMS: +$29/mo
> - API Access: +$99/mo
>
> **Module matrix (PROFESSIONAL tier includes):**
> VIN Decode, Scribe AI, DTC Cipher, Parts & Manifest, Procurement, Stock AI, CRM, OMNI Summary
>
> **PREMIER adds:**
> Full OMNI, HUB Dispatch, DOT Compliance, Tools+PMI, Predictive Maintenance, Multi-Location, White-Label Portal
>
> **Trial:** 14 days full PREMIER, no card required, hardware kit included.

---

## AdminSubscription / Marketplace UI

**What:** Owner-facing module marketplace. Shows all modules, trial status, pricing. Admin can start trials, see days remaining, configure umbrella subscription price.  
**Status:** ✅ Built (JSX, Ignition OS only — not yet in shared or Cultivar)  
**Vertical:** ignition | **Type:** capability  
*⚠️ NEEDS DAVID'S CALL — see bottom: could be tile (if it appears as a dashboard tile in OmniDashboard) or capability (if it's reached via settings/admin nav).*  
**Location:** `packages/ignition-os/modules/AdminSubscription.jsx`  
**Default umbrella price:** $299/mo (state variable, admin-adjustable in UI)

**Module keys and display names:**
- `FLUX` → Workflow
- `PREDICTIVE` → Predict
- `ESTIMATOR` → Estimator
- `CODE` → DTC Cipher
- `STOK` → Inventory
- `PROT` → Margins
- `HUB` → Dispatch
- `PROC` → Vendors

**Per-module state shape:**
```js
{ active: boolean, tier: 'NONE'|'BASIC'|'PRO', trialActive: boolean, trialStartedAt: ISOString|null }
```

**startTrial():** Sets `active=true`, `tier='PRO'`, `trialActive=true`, `trialStartedAt=now`  
**calculateDaysLeft():** `Math.max(0, 30 - daysSinceStart)` — 30-day module trial window

---

## Trial Clock

**What:** Two-tier trial system — 14-day platform trial and 30-day per-module trial.  
**Status:** ✅ Built (Ignition OS only — not yet extracted to shared or used in Cultivar)  
**Vertical:** ignition | **Type:** infrastructure  

**Two distinct trial concepts:**

1. **Platform trial (14-day):** Full PREMIER access. Set in `OnboardingWizard.finalize()`. Stored in Supabase `shops` table as `trial_started_at` / `trial_ends_at`. After expiry: data blur on all modules.

2. **Per-module trial (30-day):** Each module independently. `calculateDaysLeft()` in `AdminSubscription.jsx`. Stored in `DataBridge` as `modules[MODULE_ID].trialStartedAt`.

**Data blur on expiry:** `filter blur-md pointer-events-none opacity-30` wrapper around module content. Ignition only. Not yet extracted to shared or used in Cultivar.

**Shared type:** `SubscriptionTier` in `packages/shared/src/supabase/types.ts` has `trial_started_at` field — the seam where this plugs in.

---

## DataBridge

**What:** localStorage-first data layer for Ignition OS. Single key `IGNITION_OS_DATA` stores all shop state: profiles, jobs, modules, trial clocks, integrations.  
**Status:** ✅ Built (JavaScript, Ignition OS only — intentionally not shared)  
**Vertical:** ignition | **Type:** infrastructure  
**Location:** `packages/ignition-os/DataBridge.js`

**Key methods:**
- `DataBridge.save(key, value)` — persist to localStorage
- `DataBridge.getProfiles()` — list of shop user profiles
- `DataBridge.checkTrialStatus(moduleId)` — returns `{ isExpired }`
- `DataBridge.get('shop_info')` — shop name, phone, USDOT, etc.
- `DataBridge.get('shop_policy')` — active modules, margin rules, tier

**Important:** `STORAGE_KEY = 'IGNITION_OS_DATA'` is hardcoded in `packages/shared/src/quickbooks/oauth.ts`. This is Tech Debt #2 in CLAUDE.md — OFF LIMITS until post-demo fix.

**Footprint (audit 2026-06-05):** ~45 files reference DataBridge across nearly every Ignition module (`DataBridge.js`, `CoreApp.jsx`, `IgnitionAdmin.jsx`, `IgnitionOmni.jsx`, `IgnitionCRM.jsx`, and many more). Load-bearing. No shared equivalent.

**⚠️ CHARACTERIZATION CONFLICT (unresolved):** This doc says "localStorage-first wrapper, intentionally not shared." The bootstrap spec says "offline-sync engine, promote to shared." These are opposite post-demo jobs. Footprint (~45 files) is confirmed. Function and promote decision are not. A ~30-line read of `DataBridge.js` settles the function question; the promote question is David's. Do not open DataBridge for RBAC extraction or any shared promotion until this is resolved. → **NEEDS DAVID'S CALL.**

---

## Tile System

**What:** 3-state tile grid for module navigation. States: active (works), available (can enable), locked (upgrade required). Supports count badge for notifications.  
**Status:** ✅ Built and live — TypeScript/React  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/components/tiles/TileGrid.tsx` + `Tile.tsx`  
**Used by:** Cultivar OS Dashboard.tsx, Ignition OS AdminSubscription.jsx

**Tile states:**
- `active` — module is enabled and configured. Green dot. onClick routes to module (currently a stub).
- `available` — module can be enabled. Shows "Enable" button. onClick triggers setup flow.
- `locked` — requires tier upgrade. `onClick={undefined}`. LockedOverlay visible.

**Count badge:** `count` prop on Tile. Amber badge top-left. Used by Social Media tile to show pending draft count.

---

## configureAuth Factory

**What:** Vertical-agnostic auth factory. Returns `useSession` hook + `PrivateRoute` + `AuthProvider` configured for either email/password (Cultivar) or PIN/localStorage (Ignition).  
**Status:** ✅ Built — TypeScript  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/auth/configureAuth.tsx`

**Email strategy (Cultivar OS):** Supabase email/password. `auth.uid()` is non-null. Required for RLS to work.  
**PIN strategy (Ignition OS):** localStorage-first. `auth.uid()` is always null. **Do not use in any multi-tenant context.**

---

## Cross-Vertical Capability Gate (`verify-universals`)

**What:** A mechanical build gate that asserts five UNIVERSAL platform capabilities are present per vertical (Ignition, Cultivar). The capability list lives AS ASSERTIONS in the test, not as a prose doc — the first run IS the cross-vertical audit. Structural only (reads migration SQL + source); needs NO live DB / service key / network.  
**Status:** ✅ Built 2026-06-22 — `scripts/verify-universals.mjs` + `npm run verify:universals` (HEADER: PURPOSE/scope/OUTPUTS in-file).  
**Vertical:** shared (audits ignition + cultivar) | **Type:** infrastructure  
**Capabilities asserted:** (1) persistent identity indicator mounted in the per-page layout/header · (2) financial/cost tables gated by `has_permission` on every read path · (3) dual RLS (owner + `is_active_member`) on every tenant table · (4) membership filters use canonical `is_active_member` (no hand-spelled `active = true`) · (5) confidence enum honored (no silent $0).  
**Scope honesty:** caps 2–5 are multi-tenant-RLS capabilities → IN SCOPE for Cultivar, reported **SKIP-with-reason** for Ignition (single-device PIN vertical, documented "Auth Architecture — Locked Rule" exception — visible in the matrix, not silently passed). Documented owner-only operational tables (orders/customers/…) print as **KNOWN-GAP** (tracked product decision, fail-closed), not a hard FAIL.  
**MATRIX (current, 2026-06-22 — caps grew to 7):** Ignition #1 PASS · #2–7 SKIP (single-device PIN vertical, documented exception). Cultivar **#1–7 ALL PASS** → gate exits **0**. (#1 flipped **FAIL → PASS** 2026-06-22 when the shared `<AppHeader>` was mounted once via `AppLayout` around the PrivateRoute routes; #6 read-wall + #7 write-wall added with Gate-3.) #2 PASS (9 financial policies gated) · #3 PASS (12 member-scoped tables dual-RLS; 9 owner-only tables KNOWN-GAP) · #4 PASS (14 member policies canonical; `md_self` documented exception) · #5 PASS. NOT auto-chained into `build:*` — run as its own gate.  
**OUTPUTS:** colored PASS/FAIL/SKIP/KNOWN-GAP matrix + `process.exit(1)` on any in-scope FAIL.

---

## Quality Gate — ESLint + knip (baseline-and-ratchet)

**What:** Two standing build gates mapped to bug CLASSES the platform has actually hit (dead code, unused vars, swallowed async errors, stale-closure deps) — NOT a style linter. Baseline-and-ratchet: records current debt and fails the build on NET-NEW only.
**Status:** ✅ Built 2026-06-24 — commit `73d82a0`. Fail-on-new PROVEN both directions (probe file → eslint 267→269 + knip 10→11 files, gate exit 1; removed → green exit 0).
**Vertical:** shared (root tooling) | **Type:** infrastructure
**Files:** `eslint.config.mjs` (flat config), `knip.json`, `packages/shared/tsconfig.json` (lint-only, NOT a build tsc), `quality-baseline.json`, `scripts/quality-gate.mjs` (HEADER in-file). npm scripts: `lint`, `knip`, `quality:gate`, `quality:baseline`, `verify`.
**ESLint rules (bug-class only):** `no-unused-vars`, `no-unreachable`, **`@typescript-eslint/no-floating-promises` + `no-misused-promises`** (type-aware — scoped to the active TS `src` dirs with tsconfigs: cultivar-os/shared/trace-app; api/+scripts/ get non-typed rules), `react-hooks/rules-of-hooks` + `exhaustive-deps`. **`no-explicit-any` deliberately OFF** (type-hygiene, not a bug class — would bury the signal under ~200 hits).
**knip scope:** accurate dead-code on cultivar-os + trace-app; `shared` = **all-entry** (deep-import lib consumed via relative `../../../shared/src/...` from api/ that knip can't trace cross-workspace → file claims suppressed to keep the ratchet trustworthy); ignition-os/assessment/coolrunnings ignored (frozen donor / empty); root `scripts/**` + `*.test.*` declared entries.
**Baseline (2026-06-24):** tsc **10** (8 cultivar + 2 trace-app, all documented pre-existing) · eslint **267** (84 unused-vars, 69 floating-promises, 67 misused-promises, 24 exhaustive-deps, rest minor) · knip **10** orphan files + **14** unused exports + **15** unused types. `npm run verify` = quality-gate + verify-universals; fails on NET-NEW only; `npm run quality:baseline` re-snapshots when debt drops.
**Out of scope (separate value-review, NOT installed):** jscpd, Prettier, npm-audit gate, test suite.
**OUTPUTS:** per-metric baseline-vs-current table + `process.exit(1)` on any net-new.

---

## Field-Debug Capture (Shared + Cultivar surface) — 2026-06-27, ledger #60

**What:** On-by-default capture so a phone's `[TRACE:*]` console trail becomes a downloadable/shareable file David can hand Lightning — not a screenshot of the symptom, the actual cause as DATA.

- **`packages/shared/src/debug/captureBuffer.ts` (+ `debug/index.ts` barrel):** a **console interceptor** installed once at boot. Taps `console.log/info/warn/error` itself, so all ~500 scattered `[TRACE:*]` sites (40 area tags) are captured **with zero per-site edits**. Tees into a **600-entry ring buffer persisted to localStorage** that SURVIVES reload / white-screen / close-reopen. `window.onerror` + `unhandledrejection` are captured and flushed immediately (crashes are caught). Exports: `getCaptureText` (with a url/ua/online/timestamp header), `clearCapture`, `downloadCapture` (Blob → `.txt`), `shareCapture` (`navigator.share` files → text → download fallback). `[TRACE:CAPTURE]` emitted via the ORIGINAL console (anti-recursion). Reusable by Ignition.
- **`packages/cultivar-os/src/components/DebugPanel.tsx`:** a floating 🐞 panel (Share / Download / Copy / Clear + live tail) gated behind `?debug=1` (sticky via localStorage), so Lauren's demo link stays clean. Mounted once in `App.tsx`; `installCapture()` runs before React in `main.tsx`.
- **Decoupled from any PWA wrap** — `navigator.share`, Blob download, and localStorage all work in a mobile Safari/Chrome tab today; wrapping does not unlock richer capture (recon `docs/decisions/2026-06-27-wrap-and-capture.md`).
- **How David uses it:** open with `?debug=1` → 🐞 → use the app → tap 🐞 → tap Share → send the `.txt` to Lightning.

**Privacy:** the export carries tenant identifiers (business_id, ids, emails) — internal David→Lightning use, surfaced in the panel; redaction is a named step-up, not built.

**Proofs:** `build:cultivar` clean (2233 modules, +2); `npm run verify` exit 0 zero NET-NEW (tsc 10 / eslint 266 / knip 10·14·15); eslint clean on changed files; deterministic node smoke (stubbed browser globals): captures `[TRACE:*]` verbatim with tenant ids, levels preserved, header carries url/ua/online, **crash flushes to storage**, buffer **survives reload**, clear empties.

**Instrumentation (STD-003 + standing TRACE-stays-on):** `[TRACE:CAPTURE]` ON BY BIRTH — installed/cleared/download/shared/share-fallback. Stays ON until David owner-proves the panel on the phone.

**Bar:** BUILDER-COMPLETE. **OWNER-PROVEN owed:** David on the phone — `?debug=1` → 🐞 → trail shows → Share → `.txt` reaches Lightning.

---

## Person Spine — global human backbone (Shared) — Person-spine build 2026-06-25

**What:** A global `people` table (one row per human) behind every role a person plays — lead/customer/member/invited-worker/labor-resource. The three-entity identity standard: Person × Organization (`businesses`) × Membership/role. `person_id` is an **OVERLAY, NEVER the auth principal** — RLS stays on `user_id = auth.uid()` (documented divergence, §6.10: textbook would make the person id the principal; we don't, because RLS is proven on auth.uid() and person↔auth is 1:many).
**Status:** ✅ BUILDER-COMPLETE (CP1 `8eda8e3` + CP2 `c1f8be3`); migration + full-nuke wipe STAGED (David applies as postgres) — schema-verification gate + owner-proof OWED. Close-out ledger rows #31/#32.
**Vertical:** shared | **Type:** infrastructure
**Location:** `supabase/migrations/20260625_person_spine.sql` · `scripts/wipe-for-person-spine.sql` · `packages/shared/src/business-logic/personUpsert.ts` · recon `data/grower-scan/person-spine-recon.md`

**Schema (cultivar-os Supabase project — bgobkjcopcxusjsetfob, STAGED):**
- `people` (NEW) — `id` (person_id), `auth_user_id` (nullable UNIQUE FK→auth.users ON DELETE SET NULL — nullable because invited-not-enrolled workers / captured customers have no auth account), `first_name`/`last_name`/`full_name`, `email`/`phone`. **NO `business_id`** (global). RLS `people_self_all` (FOR ALL, `auth_user_id = auth.uid()`) — self-only; customer/worker persons (auth-less) created server-side with the service key. updated_at trigger + auth-less `email`/`phone` lookup indexes.
- Nullable `person_id` overlay (FK→people ON DELETE SET NULL) added to `business_members`, `customers`, `labor_resources`, `invitations`. `customers.price_tier` (text, default `'retail'`, no CHECK — AC-4; retail/wholesale/contractor as a TIER not an entity). Nothing forced NOT NULL.
- Migration ALTERS no existing policy/function/trigger (is_active_member, has_permission, bm_* , self-grant trigger, customers_business_owner all untouched — overlay only).
- **Full-nuke wipe** (`scripts/wipe-for-person-spine.sql`, run once before the migration): enumerates every `business_id`-bearing table from the live catalog + discovers append-only guarded tables (`reject_*_mutation` triggers) → **STEP B2 privileged one-time teardown** (disable guards → `TRUNCATE … CASCADE` → re-enable guards, one transaction so a failure auto-restores the guard) → `DELETE FROM auth.users` → **STEP C verifies guards back ON** + 0 rows. `audit_log` is append-only (its guard rejected the first wipe — working as designed) and FK-cascades from businesses, so it's cleared inside the labeled teardown window, never as a quiet workaround; David owner-proves the guard is restored (manual `UPDATE audit_log` post-reset must be rejected). David chose FULL NUKE (all data expendable); the real LAWNS demo returns via Build B (per-tenant seed/reset, queued).

**Create-or-link — ONE shared function (§6.8):** `findOrCreatePerson(db, input)` resolves a human to one person row. Precedence: (1) `auth_user_id` (strongest); (2) auth-less → email then phone (global, auth-less-only); (3) no identifier → insert (D-9, never fabricate a key). `[TRACE:PERSON]` on every create/link/resolve. Wired (CP2) into: OwnerSignup (browser-RLS, links `business_members.person_id`), acceptInvitation (service-key, links `invitations.person_id` + activated member), customerUpsert (service-key, person-based dedup). All non-blocking (overlay; rule 6 — never blocks an order). **Fixes the email-only-dedup bug:** a phone-only customer repeat matches the existing person by phone → no second customer (Marcus-Webb-dupe class), with graceful fallback to legacy email-dedup if the person layer is unavailable.

## Multi-Tenant Auth System (Shared)

**What:** Full invite-based team management for any vertical. Owner invites members by email; member receives a `/join?token=...` link, creates a Supabase account, and is linked to the owner's business.  
**Status:** ✅ Built — TypeScript (merged to main 2026-06-03)  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/auth/`

**Schema (cultivar-os Supabase project — bgobkjcopcxusjsetfob):**
- `business_members` — links `auth.uid()` to a `businesses.id`. Columns: `role`, `permissions` (text[]), `active`, `pin_hash` (added 2026-06-03). RLS: owner full access, member reads own row.
- `invitations` — pending invite tokens. 7-day expiry. `used` flag prevents replay. RLS: owner full access.
- `member_devices` — optional device tracking (denormalized `business_id` for RLS without join).
- **Migration pending (David):** `supabase/migrations/20260603_business_members_add_pin_hash.sql` adds `pin_hash` to business_members in bgobkjcopcxusjsetfob.

**Shared TypeScript modules:**
- `auth/types.ts` — `Member`, `Invitation`, `Role`, `VerticalAdapter`, `AcceptInviteResult`, `InvitePreview`
- `auth/members.ts` — `getMembersByBusiness`, `updateMemberRole`, `removeMember`, `checkPermission(permissions[], name)`
- `auth/invitations.ts` — `createInvitation`, `revokeInvitation`, `getPendingInvitations`, `expireInvitations`
- `auth/acceptInvitation.ts` — `previewInvitation`, `acceptInvitation` (service-key server functions)
- `auth/AcceptInvite.tsx` — React accept-invite page component (inline styles, TRACE green)
- `auth/OwnerSignup.tsx` — Multi-step signup with PIN: Owner Info → PIN Setup → Biometric (optional) → vertical steps. Config-driven. Added 2026-06-03. Updated 2026-06-04: `backgroundColor`, `cardColor`, `examples` fields added to config (removes hardcoded Cultivar sage/white; enables Ignition dark theme).
- `auth/permissions.ts` — Pure permission check helpers (added 2026-06-10, THUNDER · BUILD 2):
  - `can(session, permId)` — null-safe check for a permission string in session.permissions[]
  - `hasRole(session, roleName)` — null-safe session.role equality check
  - `canAccessModule(allowed, moduleKey)` — checks the Ignition-specific `allowed[]` shortlist (derived from view_* permissions by auth.ts authenticate())
  - `expandRoles(policy, roleNames)` — expands role-badge strings → flat union of permission strings; replaces the DataBridge.getSystemRoles() + flatMap pattern in CoreApp.jsx
  - `deriveAllowed(permissions)` — strips 'view_' prefix; matches the derivation in auth.ts and CoreApp.jsx JoinFlow
  - `PermissionPolicy` interface — vertical passes `{ roles: Record<string, string[]> }` as config data (AC-1: role names are string values, not TypeScript identifiers)
  - These are drop-in replacements for inline checks; callers NOT migrated yet (Ignition migration deferred to post-pilot_all fix, TD#28)
- `discovery/DiscoveryGlimpse.tsx` — Client-only React component (VerticalStep). Loads website from businesses table, fires /api/discovery/ingest, renders REAL profile findings only. Import directly (not from barrel) to avoid bundling server-side SDK deps. Added 2026-06-04. **FAIL-LOUD + persistence 2026-06-25 (`c8094e1`, FIX 1):** it previously collapsed no-profile/API-error/network-failure into `phase='done'` and rendered canned `NURSERY_SEED_INSIGHTS` as "Strengths" under "Here's what we found" (canned copy as findings; the `'error'` Phase had no render branch). Now: a real returned profile is the only path to `done`; failures land on a new honest `error` phase (retry / manual-entry / skip); analyzing-phase teasers reframed "What we look for"; **businessId is now passed in the POST body so `ingest.ts:171 seedServiceOfferings` persists** (was omitted → analysis ran, nothing saved). `[TRACE:DISCOVERY]` on run/success/failure. BUILDER-COMPLETE; owner-proof owed.
- `auth/index.ts` — barrel export
- `supabase/auth.ts` — `hashPin()`, `authenticate()` (queries shop_members, returns AuthSession with role/permissions/allowed), `authenticateMember()` (queries business_members, returns MemberSession), `getMemberSession()`, `clearMemberSession()`, `getTrialStatus()`.

**Cultivar OS integration:**
- `api/members/preview-invite.ts` / `accept-invite.ts` — Vercel handlers (consolidated into `/api/members/invite` as GET+POST)
- `src/pages/Settings.tsx` TeamSection — invite form, member list, pending invitations, copy-link UI
- `src/router.tsx` — public `/join` route → `AcceptInvite` component
- `src/auth/roles.ts` — OWNER / MANAGER / STAFF role definitions with permission arrays

**Permission model — Cultivar OS (business_members table):**
- `null` permissions = owner (full access implied). `string[]` = member's explicit DB-stored permissions.
- Gate expression: `const canX = isOwner || (userPermissions ?? []).includes('permission_key')`
- MANAGER excludes `manage_settings` by design — cannot reach Settings page

**Permission model — Ignition OS (shop_members table, PILOT phase):**
- Roles: TECH / SERVICE / ADMIN (canonical, from shop_members); SUB_ROLES: SR_TECH/BAY_TECH/APPRENTICE (TECH), ADVISOR/CASHIER (SERVICE)
- `allowed[]` = permissions filtered to view_* → strip prefix. Gate: `session.allowed.includes('flux')` etc.
- Role presets defined in `IgnitionAdmin.jsx:ROLE_PRESETS` (TECH/SERVICE/ADMIN → capability string arrays)
- `DataBridge.getSystemRoles()` uses OLD role-badge format (ADMIN/TECH/CUSTOMER); JoinFlow members use NEW capability-string format — these two formats are incompatible in the `userCapabilities` expansion path
- ⚠️ All enforcement is CLIENT-SIDE ONLY — see Tech Debt #28 (pilot_all wide-open RLS)

**Test coverage:** `scripts/test-member-login.mjs` — 8 sections, 29 assertions against live DB. Verified: owner path, member path, MANAGER permission exclusions, LAWNS-specific invite flow.

---

## BusinessProvider (Shared Context)

**What:** React context that resolves the logged-in user's business and exposes it across the app. Two-path resolution: owner fast-path, member fallback.  
**Status:** ✅ Built — TypeScript  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/context/BusinessProvider.tsx`  
**Exports:** `BusinessProvider`, `useBusinessContext`, `Business`, `BusinessContextValue` (from `packages/shared/src/context/index.ts`)

**Resolution logic:**
1. Owner path (fast): `businesses WHERE owner_id = auth.uid() AND business_type = $type`
2. Member fallback (if owner returns null): `business_members WHERE user_id = auth.uid() AND active = true` with `businesses(*)` PostgREST join, filtered post-fetch to `business_type === businessType`

**Context values:**
- `business: Business | null` — full businesses row
- `businessId: string | null`
- `businessError: string | null` — `'no_business'` when both paths genuinely return zero rows; `'read_error'` when a resolution SELECT ERRORED (data=null, rows may exist). Distinct since 2026-06-24 (`97118ef`): the owner + member SELECTs capture `{ error }` and emit `[TRACE:BUSINESS] owner/member path ERROR {code,message,details,hint}`, so an errored read no longer masquerades as `no_business`. Query shape + RLS unchanged.
- `loading: boolean` — stays `true` across the **bounded write-then-read retry** (2026-06-24 `56c7f81`): a fresh signup runs the resolution read ~1ms before the create write is visible (HAR-confirmed — every read 200, just empty). The owner+member resolution (`attemptResolution()`) re-runs up to `RESOLVE_MAX_ATTEMPTS=3` times, `~500ms` apart (~1s total), stopping early on first non-empty result or a real query error; `no_business` is set only after retries exhaust (SETTLED). Emits `[TRACE:BUSINESS] resolution retry {attempt, reason:'empty_with_session'}`. Consumers (Dashboard) redirect to `/onboarding` ONLY when settled (`loading===false`), so the first transient empty read no longer bounce-loops onboarding.
- `reload: () => void`
- `userPermissions: string[] | null` — null = owner, string[] = member's DB-stored permissions
- `isOwner: boolean`

**Consumed by:** `packages/cultivar-os/src/App.tsx` (`<BusinessProvider businessType="nursery">`), all Cultivar pages via `useBusinessContext()`.

**Security note (fixed 2026-06-04, commit 8792c71):** Member path filters by `business_type` after fetching — `memberBiz?.business_type === businessType` must match before the member resolution is accepted. This prevents cross-vertical data exposure (audit finding #13). If a user is a member of multiple businesses in the same vertical, `.single()` will fail — acceptable for v1.

---

## QB Token Refresh

**What:** Proactive QuickBooks token refresh. Checks expiry before any invoice call. Refreshes if missing or within 10 min of expiry. Sets `qb_needs_reconnect=true` and returns null if refresh token is dead.  
**Status:** ✅ Built — TypeScript  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/quickbooks/refresh.ts`  
**Used by:** `packages/cultivar-os/api/qbo/invoice/cultivar.ts`

**⚠️ QB integration scope: receivables only (Audit 6, 2026-06-06).** The current QB integration (`api/qbo/`) covers invoices (money IN) and customer lookup/create. Payables (money OUT — expense write, Attachable image archive, Chart of Accounts query, Purchase/Bill write) are confirmed API-capable but NOT yet wired in TRACE code. Payables wire-up = Receipt Keeper v2 scope. See `docs/audits/2026-06-06-audits-5-6-quickbooks.md` §6b.

**✅ RESOLVED 2026-06-08 — proactive expiry surfacing live.** `qbo/status.ts` now checks `accounting_token_expires_at` on every dashboard load; attempts silent `refreshQBToken()` if expired; returns `needsReconnect: true` if refresh fails. `Dashboard.tsx` derives the banner immediately from `accounting_token_expires_at` client-side and applies the authoritative server result from `checkQbStatus()`. A dead/expired connection now announces itself on page load — no mid-use 401 required. STD-007 added as the class-of-bug record.

**✅ RESOLVED 2026-06-19 — QB routes 500 root-caused + fixed (commit `14a9a82`, tech-debt #34).** Both `/api/qbo/auth-url` and `/api/qbo/status` returned `FUNCTION_INVOCATION_FAILED`. Root cause: `packages/cultivar-os/api/qbo/router.ts:15` imported `refreshQBToken` from `../../../../shared/...` (FOUR `../` → nonexistent `<repo-root>/shared/`); router.ts sits at `api/qbo/` so the correct depth is THREE `../` (now `../../../shared/src/quickbooks/refresh` — confirmed `router.ts:15`). The unresolved import crashed the function at module load → 500 on every qbo route regardless of token state. Proven via esbuild (old path fails resolution, new bundles clean). Connect flow now reaches the auth-url link instead of 500.

---

## Notification System

**What:** Provider-agnostic notification sender + queue. Supports Resend (email) and Twilio (SMS).  
**Status:** 🟡 Built but unconfirmed active — env vars not verified  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/notifications/send.ts` + `queue.ts`

**Templates (Cultivar OS):** `packages/shared/src/notifications/templates/cultivar.ts`
- `order_confirmation` — sends after checkout (only one actively wired)
- `netting_waiver_reminder` — template exists, not scheduled
- `care_tips_30d` — template exists, not scheduled
- `seasonal_offer` — template exists, not scheduled
- `delivery_scheduled` — template exists, not wired

**sendSilently():** Fire-and-forget. Used in `useSubmitOrder.ts`. Never blocks order flow.

---

## Social Media Module (shared + Cultivar OS surface)

**What:** Period-based AI social post generator. Aggregates the week's sales into platform-specific captions. Owner edits, copies to clipboard, posts manually.  
**Status:** ✅ Generator moved to shared 2026-06-08 — business_type-parameterized, Sonnet via gateway. Table de-nouned (AC-1). Edit/save widget live.  
**Vertical:** shared (generator) + cultivar (surface) | **Type:** tile  

**Backend:**
- `packages/shared/src/social/generate.ts` — `generateSocialDrafts()` — business_type-parameterized, Sonnet via AI gateway. `BUSINESS_DESCRIPTORS` map: variation is data, not code. `[TRACE:socialdraft]` behind `SOCIALDRAFT_DEBUG`.
- `packages/cultivar-os/api/social/generate-posts.ts` — thin Vercel handler: reads context (orders, plants, config) → calls shared generator → inserts to `social_drafts` with `subject_type='inventory'`, `subject_id=null`.
- `packages/cultivar-os/api/social/enable.ts` — upserts `business_modules` with `{ advert_channels: AdvertChannel[], cadence }`. No blotato_account_id. `advert_channels` is the single source of truth for all channel config (social + SMS).

**social_drafts table (de-nouned 2026-06-08):**
- Columns: `id, business_id, platform, original_text, edited_text, status, subject_type, subject_id, cadence, period_start, period_end, copied_at, post_type, created_at`
- `original_text`: immutable AI proposal. `edited_text`: what owner saved (null until edited).
- `subject_type`/`subject_id`: AC-1 compliant subject ref (value, not column name). Cultivar writes `subject_type='inventory'`, `subject_id=null` for period aggregates.
- Status lifecycle: `draft → edited → approved → copied` (+ `copied_at` timestamp).
- **No** `content`, `order_id`, `plant_id` (all retired 2026-06-08).
- **`social_drafts_platform_check` (2026-06-09):** CHECK constraint now migration-controlled. Hand-applied pre-migration-era; original allowed list was `(instagram, facebook, tiktok, twitter)`. Extended to include `'sms'` by `supabase/migrations/20260609_social_drafts_platform_check.sql`. ⚠️ Migration pending David apply + verify. Without this: SMS-enabled generation runs write zero rows (atomic batch rolls back when sms row violates constraint).

**Dashboard edit/save widget:**
- Generate button → calls `/api/social/generate-posts` → inserts drafts → `loadSocialDrafts()` reloads.
- Draft card: editable textarea (original_text); on blur → `handleSaveEdit()` → writes `edited_text + status='edited'`.
- [Copy] button → copies to clipboard + `status='copied' + copied_at` → removes from queue.
- [Download image] — stub, disabled (seam declared below).
- [Open platform] — links to platform URL.
- Edited drafts show green border + "✓ Edited" chip.

**Voice-delta captured (seam declared):**  
`original_text` vs `edited_text` = the training delta, accumulating now, no consumer yet.  
**remaining:** voice-learning BI — query original vs edited pairs to detect voice patterns. Horizon: v2/later. NOT a defect — data is flowing cleanly; the analysis surface is the unfilled seam.

**Aggregation/cadence generator (seam declared):**  
`cadence` is stored per module config; `period_start`/`period_end` captured per draft. The generator that reads `config.cadence` and auto-triggers a new generation window (preventing per-purchase overwhelm) is the next step.  
**remaining:** cadence-triggered generation — scheduler that fires generate-posts on cadence rhythm. Horizon: Social Rhythm (next social session). NOT a defect — the data model is ready; the trigger is the unfilled seam.

**advert_channels config (2026-06-08):**
`business_modules.config.advert_channels: [{type:'social'|'sms', name:string, enabled:boolean}]` — flat typed list. `generate-posts.ts` reads this and generates ONLY for enabled channels. SMS is a separate entry (`type:'sms'`, always one post, no image prompt). LEXICON RULE: "platform" is reserved for the top-level TRACE substrate; "channel"/"advert_channel" is used inside the product.

**Not built:** image generation. Direct social publishing — Blotato removed 2026-06-08 (misrepresented capability).

**Hidden seams declared (inert, demand-gated, priced — see `api/campaigns.ts` preamble):**
- `auto-publish seam` — wire a vetted publisher adapter at activation. No refactor needed. Gate: demand + pricing.
- `sms-auto-send seam` — TCPA/10DLC/opt-out compliance is real work at activation; adopt provider model. Gate: demand + pricing + provider selection.

---

## QR Checkout Flow (Cultivar OS)

**What:** Complete scan-to-invoice flow. QR scan → plant profile → add-ons → customer capture → cart review → order submit → QB invoice → email confirmation.  
**Status:** ✅ Built and live — end-to-end  
**Vertical:** cultivar | **Type:** tile  
**Route:** `/plant/:sku` → `/plant/:sku/addons` → `/checkout/customer` → `/checkout/review` → `/checkout/confirm`

**Key files:**
- `PlantProfile.tsx` — plant detail, add to cart
- `AddOns.tsx` — transport toggle (self/delivery/install), netting prompt, addon checkboxes
- `CustomerCapture.tsx` — name, phone, email
- `CartReview.tsx` — order summary, submit
- `Confirmation.tsx` — invoice link, scan another
- `api/orders/submit.ts` — writes order + order_items + order_addons, customer dedup by email
- `api/qbo/invoice/cultivar.ts` — creates QB invoice + customer

**Install price:** Legacy `plants.install_price` column DROPPED 2026-06-13 (THUNDER UNTANGLE). QB install line now defaults to $0 until install pricing is wired through service_offerings (correct long-term model). Scheduling not built.  
**Leakage flag:** Set in `api/orders/submit.ts` when add-ons declined and transport is self-only.

**Checkout payment-copy relabel (2026-06-19):** `CustomerCapture.tsx:230` now reads "We'll email your invoice here. No payment is taken now — pay in person at the office, or online from the invoice we send." (was "You can pay now or when you get home"). Wording-only — no behavior change; checkout already takes no money and CartReview offers email-invoice vs pay-at-office.

---

## OwnerSignup (Shared)

**What:** Multi-step shared owner signup component with PIN gesture layer. Step 1: Owner Info (business name, owner name, email, password, phone, address, website). Step 2: PIN setup. Step 3: Biometric registration (optional, skippable). Optional vertical steps array.  
**Status:** ✅ Built 2026-06-03 — shared, consumed by both Cultivar and Ignition  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/auth/OwnerSignup.tsx`

**Config-driven:** Each vertical provides an `OwnerSignupConfig` specifying `memberTable`, `memberFKColumn`, `ownerRole`, `ownerPermissions`, `pinLength`, `backgroundColor`, `cardColor`, `examples` (per-vertical placeholder text), `verticalSteps` (optional post-biometric steps), and an `onSuccess` callback. The vertical's `onSuccess` handles post-signup vertical-specific setup (e.g., Ignition creates the matching `shops` row and seeds DataBridge; Cultivar navigates to /onboarding).

**PIN hash:** SHA-256 of `{businessId}:{pin}` — consistent with `hashPin()` in `packages/shared/src/supabase/auth.ts`.

**Retry-aware:** If "User already registered" → attempts signIn → if no businesses row → continues business creation. Handles orphaned auth users from partial prior signups.

**Person-name (full_name) layer — 2026-06-24 (`73498ca`):** the LOCKED identity model is implemented at the name write/seed layer. PERSON NAME source of truth = `auth.user_metadata.full_name`; `business_members.name` = invite-bootstrap / display-fallback only; display precedence everywhere = `full_name → member.name → email`. `signUp` now seeds `options.data.full_name` from the typed ownerName (was stranded — wrote only to the member row). Same `full_name` seed mirrored in the legacy `configureAuth.tsx` and `OnboardingWizard.tsx` signup paths. `acceptInvitation.ts` seeds `user_metadata.full_name` for new invitees and bridges an existing user who has no `full_name` yet (never overwrites a real name). `Profile.tsx` member self-edit writes `auth.updateUser({full_name})` first (unified with the owner path; member.name kept in sync as fallback; authority boundary held — name/phone/email only, never role/permissions). `BusinessProvider` member display precedence corrected to `authName ?? memberName ?? email`. NO schema/RLS/owner_id changes. **BUILDER-COMPLETE; owner-proof owed** (new owner signup → header shows name not email; member name self-edit persists/displays; invite accept carries name).

**Onboarding bounce-loop fixes — 2026-06-24 (`97118ef`):** two independent swallow fixes in `OnboardingWizard.finalize()` + a gated migration. (1) **finalize now checks the `nursery_profiles` upsert `{ error }`** — on error it emits `[TRACE:BUSINESS] onboarding finalize: nursery_profiles upsert ERROR` and sets `finalizeError` (blocking the false "is live"/DONE screen) instead of advancing over a failed write. (2) **`20260624_nursery_profiles_business_id_unique.sql`** (gated, NOT applied) adds `UNIQUE (business_id)` so the `onConflict:'business_id'` upsert stops raising 42P10 → 400 (a `nursery_profiles` row is 1:1 with a business). Pre-existing bugs, NOT caused by `73498ca`. **BUILDER-COMPLETE; owner-proof owed** (apply the migration as postgres + catalog-verify the UNIQUE; finalize over a failed write shows an error, not "is live"). See also the `BusinessProvider` `read_error` distinction above (the masked dashboard-read error that caused the bounce).

**Phone-field consolidation — 2026-06-24 (`b7ed4b7`):** phone recon mapped 3 inputs → 2 real destinations + 1 dead field + 1 latent duplicate-create hazard; this consolidates without merging the two genuine destinations (business phone vs personal phone). (1) **Dead onboarding phone removed** — the `OnboardingWizard` "Your Nursery" Phone field only wrote inside `finalize()`'s skipped `if(!businessId)` legacy branch, so the typed value was dropped on every normal signup; removed end-to-end. (2) **Duplicate-create guard** — that legacy `businesses` INSERT now re-resolves the user's business at finalize before inserting (settled re-read), so the write-then-read race can no longer create a SECOND `businesses` row; genuinely business-less manual-nav still creates (branch GUARDED not removed). (3) **Owner-profile phone** — `Profile.tsx` owner branch gains an editable Phone row wired to the EXISTING `saveMemberField('phone')` writer (`business_members.phone`, own row). Owners DO have a member row (OwnerSignup creates it; `BusinessProvider:341` dedupes it out of resolution) — so the proven writer just needed a trigger; authority boundary held (name/phone/email only). (4) **Shared `normalizePhone(raw)`** (`packages/shared/src/utils/normalizePhone.ts`, exported from the barrel + `@trace/shared/utils/normalizePhone`) — the rule-of-three storage normalizer (trim · collapse whitespace · empty→null) now called by all three phone writes (R1 OwnerSignup, R3 Settings, Profile); distinct from the SMS E.164 normalizer (`send.ts`) and the live-input display formatter (`CustomerCapture.formatPhone`). NO schema/RLS/owner_id/full_name/login-email changes. **BUILDER-COMPLETE; owner-proof owed** (no onboarding phone field; owner `/profile` phone persists to `business_members.phone`; no duplicate `businesses` row creatable). Close-out ledger row #28.

**Onboarding address round-trip + leakage relabel — 2026-06-25 (FIX 2 `2c7bf08` / FIX 3 `0a18ca1`):** (FIX 2) the wizard load effect SELECTed only `id,name`, so `businesses.address` never populated the field/review and the normal `finalize()` path never wrote a typed address back (only the legacy create branch did) → a typed address was silently dropped. Now the load effect SELECTs `address` (both biz-from-url + fallback branches) and seeds `nurseryInfo.address`; `finalize()` writes it back via an owner-scoped `businesses.address` UPDATE on every path (idempotent on the legacy create). `[TRACE:ONBOARD]` on address load/save. (FIX 3) the slider-driven LeakagePath result, "Annual revenue left on the table," read like a finding about the user's real business — relabeled "Estimated annual leakage at your volume" + weekly line reframed as a projection (wording only, no logic). NO schema/RLS changes. **BUILDER-COMPLETE; owner-proof owed** (typed onboarding address persists to `businesses.address`; leakage reads as an estimate). Close-out ledger rows #34/#35.

---

## Business Creation Abuse Guards (Shared)

**What:** Three opt-in guards that run at the `createBusinessAndMember()` chokepoint in `OwnerSignup.tsx` before any `businesses` row is inserted. All three ship **OFF by default** (`false`). OFF = clean base case, zero queries, zero effect. ON = fully enforces. No partial state.  
**Status:** ✅ Built 2026-06-11 — wired into OwnerSignup.tsx; all flags OFF  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/auth/businessGuards.ts`  
**Entry point:** `runBusinessCreationGuards(userId, supabase)` — runs A → B → C in order; first non-allowed result short-circuits; passes merge `insertPatch` to caller

**Guards:**

| Guard | Flag | Default | Behavior when ON |
|---|---|---|---|
| **GUARD_A** `PER_IDENTITY_FREE_TIER` | `GUARD_A_PER_IDENTITY_FREE_TIER` | `false` | Queries `businesses` for prior rows by this owner. If ≥1 prior business exists → sets `insertPatch: { trial_started_at: null }` — new business skips free trial. First business is unaffected. |
| **GUARD_B** `CREATION_RATE_LIMIT` | `GUARD_B_CREATION_RATE_LIMIT` | `false` | Queries `businesses` for rows created in last 24 h by this owner. If recentCount ≥ 5 → returns `{ allowed: false, error: '…' }` — blocks creation with a user-visible message. |
| **GUARD_C** `SUSPICIOUS_PATTERN_REVIEW` | `GUARD_C_SUSPICIOUS_PATTERN_REVIEW` | `false` | Queries `businesses` for last-24h rows. If count ≥ 10 AND all have `trial_started_at IS NOT NULL` → returns `{ allowed: true, heldForReview: true }`. Creation proceeds but caller receives flag for admin surfacing. ⚠️ Requires `businesses.status` column before activating `insertPatch: { status: 'review_pending' }`. |

**Fail-open discipline:** Guard query errors return `{ allowed: true }` — guard infrastructure failures never block a legitimate business creation.

**Activation discipline (documented in file, not yet activated):**
1. Prove base add-business flow with all three guards OFF (David + second business test, unimpeded).
2. Turn each guard ON one-at-a-time in isolation. David says "proven" → leave ON.
3. GUARD_C prerequisite before activation: `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';` then uncomment `insertPatch` line in `checkGuardC()`.

**⛔ HARD LAUNCH GATE — must be ON-and-tested before public self-serve business creation opens:**
While creation is private/invite-only (David + family), guards may stay OFF — no abuse surface. When self-serve opens, all three guards must be individually activated, tested, and proven by David. This is a **launch prerequisite**, not a suggestion.

**`[TRACE:GUARD_A/B/C]` logs:** fire only when the respective flag is `true`. In default OFF state, zero logs emitted (clean base case per STD-003).

---

## Pain-Point Onboarding Wizard (Ignition OS — NOW ACTIVATED via ?demo=)

**What:** Full 5-step demo-first onboarding wizard. Three pain-point scenarios show dollar value within 30 minutes — no prior data entry required.  
**Status:** ✅ ACTIVATED 2026-06-10 — wired to `?demo=true` and `?demo=quick` URL params in CoreApp  
**Vertical:** ignition | **Type:** capability  
**Location:** `packages/ignition-os/OnboardingWizard.jsx` (root level)

**Steps (STEPS array):**
- `WELCOME` — "Done leaving money on the table" + 3 pain-point teasers
- `SHOP_SETUP` — shop name, owner name, 4-digit PIN (skipped in quickMode)
- `CHOOSE_PATH` — scenario picker (3 choices)
- `PATH_EXPERIENCE` — chosen scenario runs live
- `TEAM_QR` — "Shop is live" — QR code + role picker (Tech/Front Office) + invite link

**Three scenarios in PATH_EXPERIENCE:**
1. **MARGIN** (`MarginPath`) — enter vendor cost + price charged → `MarginEngine.calculateRetail()` → suggested price + "margin leak detected" + annual $ via weekly-parts slider
2. **DIAGNOSE** (`DiagnosePath`) — pick fault code from FAULT_LIBRARY (6 codes) or type own → full estimate (parts + labor + margin) → save as first work order
3. **MIGRATE** (`MigratePath`) — import customers from QuickBooks / CSV / manual entry

**Launch URLs:**
- `?demo=true` — full walkthrough from WELCOME (5 steps, owner enters real shop name + PIN)
- `?demo=quick` — jump to CHOOSE_PATH; pre-filled with "Demo Shop" / PIN 1234 (zero typing required for fast demoing)

**finalize() behavior:** generates new shopId (UUID), seeds DataBridge (localStorage), upserts to Supabase `shops` table, saves owner PIN to `DataBridge.user_profiles`. After `onComplete()` → CoreApp clears URL param + enters main app.

**Margin engine used:** `packages/ignition-os/MarginEngine.js` (FULL engine — 4 slabs, tier discounts, analyzeTransaction). NOT the shared 17-line stub. Demo output is accurate.

**quickMode prop:** `<DemoWizard quickMode={true} />` — skips WELCOME and SHOP_SETUP, initializes `stepIndex=2` (CHOOSE_PATH), pre-fills shopInfo/ownerName/ownerPin defaults.

---

## DemoLaunchButton (shared)

**What:** Neutral shared button component that navigates to `?demo=true` or `?demo=quick`. AC-1 clean — zero vertical nouns, all copy and color are caller-supplied props.  
**Status:** ✅ NEW 2026-06-10  
**Vertical:** shared | **Type:** capability  
**Location:** `packages/shared/src/onboarding/DemoLaunchButton.tsx`

**Props:** `label`, `description`, `quick` (bool), `baseUrl`, `primaryColor`, `style`  
**Usage:** Import as `import { DemoLaunchButton } from '@trace/shared/onboarding'`. Place anywhere — a settings page, admin panel, or landing tile. On click navigates to `baseUrl?demo=true|quick`.

**Seam:** Any vertical that implements a pain-point onboarding wizard and handles `?demo=` in its router can share this button. The button is the shared piece; the wizard content is the vertical's data/config.

---

## OnboardingWizard — Auth Signup (Ignition OS)

**What:** 3-step flow wrapping shared OwnerSignup. Welcome screen (dark Ignition theme) → OwnerSignup (TRACE green theme, full account + PIN setup) → Done screen (dark Ignition theme).  
**Status:** ⚠️ 2026-06-03 — uses shared OwnerSignup. Requires `shop_members` recreation migration in ufsgqckbxdtwviqjjtos (David manual step, unconfirmed). This path is UNREACHABLE when onboardingDone=true in DataBridge; bypassed entirely by ?demo= URL flow.  
**Vertical:** ignition | **Type:** capability  
**Location:** `packages/ignition-os/modules/OnboardingWizard.jsx`

**onSuccess callback:** Creates matching `shops` row (same UUID as `businesses.id`) in ufsgqckbxdtwviqjjtos, seeds DataBridge with shopId + shopName + current_user session, marks onboarding_complete=true.

**Migration required:** `packages/ignition-os/supabase/migrations/20260603_recreate_shop_members.sql` must be applied to ufsgqckbxdtwviqjjtos before new Ignition signups work.

**Extraction target:** `packages/shared/src/onboarding/WizardShell.tsx` (see PLATFORM_AUDIT.md Top 10 #1) — post-August

---

## OnboardingWizard (Cultivar OS)

**What:** 4-path demo experience for new nursery owners. Flow after signup: after OwnerSignup completes → /onboarding → detects existing businesses row → starts at CHOOSE_PATH (skips Welcome + NurserySetup). Legacy path (direct /onboarding without prior signup): starts at WELCOME → NURSERY_SETUP → CHOOSE_PATH → PATH_EXPERIENCE → DONE.  
**Status:** ✅ Updated 2026-06-04 — detects existing business on mount; signup routes here instead of /dashboard  
**Vertical:** cultivar | **Type:** capability  
**Location:** `packages/cultivar-os/src/pages/OnboardingWizard.tsx`  
**Route:** `/onboarding` (private, all new signups redirect here; Dashboard redirects here when no business row)

**4 paths:**
- LEAKAGE — leakage calculator: shows annual missed add-on revenue
- CHECKOUT — 4-slide visual walkthrough of the QR checkout flow
- SETUP — QuickBooks integration teaser
- DELIVERY — demo delivery stops → Google Maps route → SMS driver link

**finalize() behavior:** If business row exists (OwnerSignup path), skips businesses.insert and business_members.insert. Always upserts nursery_profiles. DONE screen uses name loaded from businesses table.

---

## Settings Page (Cultivar OS)

**What:** Owner-facing settings. Business profile, accounting (QB connect/disconnect), sales prompts (netting, install price), and team management.  
**Status:** ✅ Built — TypeScript  
**Vertical:** cultivar | **Type:** capability  
**Location:** `packages/cultivar-os/src/pages/Settings.tsx`  
**Route:** `/settings` (private; members without `manage_settings` are auto-redirected to `/dashboard`)

**Sections:**
- **NurserySection** — nursery name, phone, address, email, website, tax rate. Reads from `businesses` table.
- **AccountingSection** — QuickBooks connect/disconnect button. Shows connection status.
- **SalesPromptsSection** — default install price (`nursery_profiles.default_install_price`), netting prompt toggle.
- **TeamSection** — active member list, pending invitations, invite form (name/email/role), invite link copy button.

**Permission gate:** `canManageSettings = isOwner || userPermissions.includes('manage_settings')`. MANAGER role does not include `manage_settings` by design.

---

## Orders Page (Cultivar OS)

**What:** Last 50 orders with leakage highlighting. Shows transport icon, customer name, amount, leakage flag.  
**Status:** ✅ Built — TypeScript  
**Vertical:** cultivar | **Type:** capability  
**Location:** `packages/cultivar-os/src/pages/Orders.tsx`  
**Route:** `/orders` (private)

**Features:** Green border = no leakage, red border = leakage flagged. Transport icons: 🚗 self / 🚚 delivery / 🌿 install. Queries `orders` joined with `customers`.

---

## Delivery Routing (Cultivar OS)

**What:** Generate a multi-stop delivery route from pending delivery orders. Checkbox selection per stop, inline address override for missing addresses, numbered stops list, Google Maps URL, SMS-to-driver.  
**Status:** ✅ Built — TypeScript  
**Vertical:** cultivar | **Type:** tile  
**Location:** `packages/cultivar-os/src/pages/DeliveryRoute.tsx`  
**Route:** `/deliveries` (private)

**Actions:** Open in Google Maps (multi-stop URL), Text to Driver (native SMS with route link), Copy Route Link.

**Round-trip anchor — 2026-06-25 (`769933f`, FIX 4):** `buildMapsUrl` joined only customer stop addresses (no origin/destination). Now `load()` reads `businesses.address` as the origin (both scheduled + cart modes) and `buildRoute()` injects it as BOTH start and end (round-trip: farm → stops → farm; stops preserved in entered order). **SEAM (AC-4, deferred, NOT built):** an `endpointMode` variable (`round_trip` default | `one_way` | `custom_end`) + stop-order optimization — encoded so round-trip is the default, not the only possibility. `[TRACE:ROUTE]` on anchor injection. BUILDER-COMPLETE; owner-proof owed. Close-out ledger row #36.

**Bookend address DATA FIX — 2026-06-25 (closes FIX 4's blocker; no code delta):** FIX 4's bookend couldn't prove because the origin was unresolvable — `businesses.address` for Test Lawns (`ed2e5933…`) was the bare fragment `"770 Co Rd 284"` (no city/state/zip → Google can't geocode it). VERIFY-FIRST confirmed both A (multi-stop assembly: "Route this day" → DeliveryRoute scheduled mode loads ALL of a day's `deliveries` and `buildRoute()` passes every selected stop, [DeliveryRoute.tsx:88-192]) and B (round-trip bookend, [:177-191]) were ALREADY built — **so this was a data fix, not code.** Completed the address (service-key DML, read-back confirmed): → `"770 Co Rd 284, Liberty Hill, TX 78642"` (David-confirmed city/zip). Bookend proven against the exact page logic — the live day 2026-06-25 and a simulated 3-stop set both render `business → stops → business` (origin at index 0 AND last). NO geocoding / API key / seeder added (Google geocodes the strings inside the Maps URL, as today). `npm run verify` exit 0 (zero net-new). `[TRACE:ROUTE]` stays ON. **⚠️ Flagged to David:** live DB has **1 delivery / 1 day** (not the prompt's "6 invoices, 2–3 per day") — the 1-stop bookend is provable now; a *live multi-stop* owner-proof needs David to snap 2+ invoices onto one day (seeder barred). Close-out ledger row #42.

**Capability gap:** Delivery addresses use `customer.address_line1`. If a customer didn't provide an address at checkout, the page shows an inline override field (local state only — not persisted). Persisted delivery addresses require a `delivery_address` column on `orders` and capture at checkout for `transport_method = 'delivery'`. Migration not yet written.

**Capability gap:** No `delivery_date` on orders. Route shows all pending delivery orders with no scheduled date filtering.

---

## Campaign Scheduler (Cultivar OS)

**What:** Schedule, generate, and track social media campaigns. AI-generated post drafts with tone learning from copied posts. Owner copies text and posts manually — no auto-publish.  
**Status:** ✅ Built — TypeScript (Cultivar OS only). advert_channels router live 2026-06-08. Blotato removed.  
**Vertical:** cultivar | **Type:** tile  
**Location:** `packages/cultivar-os/src/pages/Campaigns.tsx` + `CampaignDetail.tsx`  
**Route:** `/campaigns` + `/campaigns/:id` (private)

**Backend:**
- `packages/cultivar-os/api/campaigns.ts` — combined action handler (action: 'generate' | 'copy-post'). **generate:** reads `business_modules.config.advert_channels`, generates ONLY for enabled channels, derives post count from campaign duration. No hardcoded channel names. **copy-post (handoff model):** copies text, marks status='published' (= owner reviewed, NOT auto-posted), saves edited pairs for tone learning.
- `packages/shared/src/campaigns/generate.ts` — `generateCampaignPosts({ advertChannels, ... })`. `CHANNEL_GUIDANCE` map keyed by channel name. `postsPerChannel()` derives count from campaign days. `ADVERT_DEBUG` gated.

**Handoff controls (CampaignDetail.tsx):**
- [Edit] → inline textarea → save draft edits locally.
- [Copy caption] → clipboard + calls copy-post action → status='published'. SMS label: "Copy text".
- [↓ Image] → stub, disabled (image generation seam).
- [Open ↗] → opens channel URL in new tab (social channels only; no Open for SMS).

**Schema:** `campaigns`, `campaign_posts`, `business_voice_samples` tables + RLS. Migration: `supabase/migrations/20260529_campaigns.sql` (original); `supabase/migrations/20260613_business_voice_samples.sql` (renamed + source column).
- `campaign_posts.platform` stores the channel name (from `advert_channels[].name`).
- `business_voice_samples`: `(business_id, platform, original_text, edited_text, source)` — accumulates with every copy-post where owner edited. `source='campaign_generate'`. VERIFIED 2026-06-13 (C1–C6 CLEAN). Proof: `docs/verification/20260613_business_voice_samples_verification.md`.

**Dashboard integration:** "Campaign Scheduler" card shows green border when drafts are pending.

**Hidden seams declared (inert — see `api/campaigns.ts` SEAM DECLARATIONS):**
- `auto-publish seam` — wire adapter here when activated. Gate: demand + pricing.
- `sms-auto-send seam` — TCPA/consent compliance at activation; adopt provider model. Gate: demand + pricing + provider.

**⚠️ David must apply migration:** `supabase/migrations/20260608_advert_channels_config.sql` migrates existing `{ platforms, cadence }` config to `{ advert_channels, cadence }`. Run VERIFICATION query in migration file after applying.

---

## Discovery Module (Cultivar OS — v0)

**What:** Silent partner analysis engine. Fetches a prospect's website, runs a two-pass AI analysis (fast identity extraction + deep profile), and generates a "silent partner" email: what the business is doing well, what could amplify it. David sends the analysis to the prospect; they receive something real and specific regardless of whether they ever sign up.  
**Status:** ✅ v0 built — TypeScript (2026-06-05). See DISCOVERY_MODULE_BRIEF.md for full spec.  
**Vertical:** cultivar (admin surface today; cross-vertical engine) | **Type:** capability  
**Location:** `packages/shared/src/discovery/` + `packages/cultivar-os/api/discovery/ingest.ts` + `packages/cultivar-os/src/pages/DiscoveryInspect.tsx`

**v0 flow (fully operational):**
1. David opens `/discovery/inspect` (internal, URL is the gate — no auth wall)
2. Enters prospect URL, vertical, optional pain point
3. Engine runs: website fetch → Haiku identity pass → Sonnet deep analysis → Sonnet synthesis email
4. David reviews profile + draft email in DiscoveryInspect
5. Enters prospect email → clicks "Send analysis" → Resend delivers the silent partner email

**Engine:**
- `discovery/adapters/website.ts` — fetches URL, extracts text (Chrome headers, fallbacks to /about)
- `discovery/engine.ts` — `runIdentity()` (Haiku, fast), `runAnalysis()` (Sonnet, deep); routes through `packages/shared/src/ai/execute.ts`
- `discovery/synthesis.ts` — `runSynthesis()`: BusinessDiscoveryProfile → SilentPartnerAnalysis; routes through `execute.ts`
- `discovery/seed.ts` — `seedServiceOfferings()`: maps suggestedOfferings → `service_offerings` rows with `is_active=false`; idempotent

**API (cultivar-os):**
- `api/discovery/ingest.ts` — POST `/api/discovery/ingest`
  - Default: fetch → identity → analysis → synthesis → `{ identity, profile, analysis, seeded }`
  - `businessId` in body → seeds service_offerings in-memory immediately after analysis (no DB lookup)
  - `action='send'` in body → delivers analysis email via notifications module (no new Vercel function)

**Admin surface:**
- `pages/DiscoveryInspect.tsx` — form (URL + vertical + pain point) → loading stages → profile display → analysis preview → Copy button + Send section (recipient email input + "Send analysis" button)

**Notification template:**
- `notifications/templates/cultivar.ts` → `silent_partner_analysis` — transactional email, TRACE default branding (not LAWNS). Pre-rendered HTML from synthesis passes through.

**⚠️ Env vars required for live email delivery (not yet set in Vercel):** `RESEND_API_KEY` + `FROM_EMAIL`. Without them, `sendNotification` runs in demo mode: logs the send, returns `{ ok: true, demo: true }` — no actual email delivery.

**remaining:**
- Discovery persistence — NOT built. `seed.ts` wired in-memory via `ingest.ts`; v0 admin sends analysis live with no retained copy. DB persistence (`discovery_sessions`, `business_discovery_profiles`), seed-at-signup via lookup, and retained session copies = v2 (gated surface + one-auth). GAP not debt. Horizon: v2/later.

### Discrepancy-Compare — entered data vs LIVE site (capability 1.1) — added 2026-06-19

**What:** During onboarding, compares the business data an owner ENTERED against what their OWN live website actually says, and surfaces honest, **hedged** discrepancies ("Your site shows X for your phone, but you entered Y — should we update it?"). Closes the gap between stale entered data and the public site without ever asserting a correction.
**Status:** ✅ BUILDER-COMPLETE (2026-06-19); owner-proof = run against a real entered-vs-site mismatch. **Type:** capability | **Vertical:** cross-vertical (shared).
**Location:** `packages/shared/src/discovery/compare.ts` (+ `compare.test.ts`, 17/17), exported from `discovery/index.ts`; AI capability `discovery_compare` in `ai/capabilities.ts`.
- `compareEnteredVsSite(entered, {apiKey})` — interrogates the **LIVE** site via `fetchWebsiteContent` (no cache/history; `fetchedAt` carried through proves freshness), extracts site values through the AI gateway, returns D-9-gated discrepancies.
- **Honesty (D-9), three gates in `filterDiscrepancies`:** (1) site must state a value; (2) entered vs site must genuinely differ (`looksSame` ignores case/punctuation/spacing); (3) confidence must clear threshold (default drops `low`). The owner-facing message is built by `buildDiscrepancyMessage` — always a QUESTION, never declares which value is correct (hedge = code guarantee, not model prose). Unreachable site → zero fabricated discrepancies, AI not even called.
- Emits `[TRACE:DISCOVERY]` (compare:start / compare:unreachable / compare:done) ON by default.

### Sandbox Seeder — branded 7-day sample data (capability 1.2, onboarding Phase 2) — added 2026-06-19

**What:** Makes a brand-new vertical's dashboard ALIVE on arrival instead of empty — seeds a believable, BRANDED 7-day slice of sample sales/activity under the business's own name. Every row is labelled sample/sandbox so it is unmistakable and EXACTLY removable; the label "comes off" when real data loads (`clear()`). Also the reusable `clear()` the Wave-2 real-populate will call.
**Status:** ✅ BUILDER-COMPLETE (2026-06-19) — `--verify` proves seed→count→clear leaves exactly zero sandbox rows and real data untouched (run against demo tenant: 6 customers / 5 plants / 5 inventory lots / 12 orders incl. 2 leakage, branded "LAWNS Tree Farm LLC"). **Type:** tool/script | **Vertical:** cultivar (tenant-agnostic by `business_id`).
**Location:** `scripts/seed-sandbox.mjs` — `seed()` / `clear()` for one `business_id`.
- Markers (clear deletes ONLY these, never real rows): `customers.source='sandbox'`, `cultivar_plants.tag_id LIKE 'SMPL-%'`, `business_inventory.sku LIKE 'SMPL-%'`, `orders.notes LIKE '[SANDBOX]%'`.
- Seeds: customers, cultivar_plants (identity), business_inventory (lots — also lights up the empty-5.1 inventory surface), orders spread over the last 7 days (varied totals, 2 leakage flags) → Dashboard today-revenue / week-orders / leakage tiles all populate.
- Emits `[TRACE:SEED]` (seed/clear with counts) ON by default.
- Usage: `node scripts/seed-sandbox.mjs --business=<uuid>` (clear+seed), `--clear`, `--verify`.

### Catalog-Populate — read live site → write their REAL catalog (capability 1.3, the onboarding wow) — added 2026-06-21

**What:** Reads a nursery's LIVE website, extracts their REAL catalog (varieties + category, per-item extraction confidence), CLEARS the sandbox sample data, and writes their actual varieties into `business_inventory` — so a new dashboard shows THEIR trees, not generic samples. The existing discovery engine extracts services/identity only; this is the missing CATALOG cut.
**Status:** ✅ BUILDER-COMPLETE (2026-06-21) — proven live against **lawnstrees.com**: 30 pages crawled → **114 real varieties** extracted (Oak, Crape Myrtle, Cypress, Redbud, Vitex …) → written to `business_inventory`, idempotent (clear→populate→clear leaves 0 orphans), real LAWNS rows untouched. **OWNER-PROOF owed** (David: run on his LAWNS tenant with the Vercel ANTHROPIC key, watch the catalog materialize on `/inventory`, then clear). **Type:** capability | **Vertical:** cross-vertical (shared), proven on cultivar.
**Location:** `packages/shared/src/discovery/catalog.ts` (crawler + AI extractor + D-9 mapping) + `discovery/populate.ts` (orchestration) + `catalog.test.ts` (35/35 adversarial), exported from `discovery/index.ts`; AI capability `discovery_catalog` (Haiku) in `ai/capabilities.ts`; runner `scripts/populate-catalog.ts`; gated table `business_discovery_profiles` (migration `20260621`, gate `scripts/verify-discovery-profiles.mjs`).
- **Crawl:** `fetchCatalogPages` does a bounded 2-level crawl (entry → hub pages like `/shop/` → category pages), reuses `fetchWebsiteContent` per page; generic link heuristics (WooCommerce `/product-category/` + hand-rolled patterns); degrades to the entry page when no catalog links exist.
- **Extract:** `extractCatalog` runs the `discovery_catalog` model per batched page → `{variety, botanical, category, confidence}`; dedups by variety (keeps highest confidence; tie-breaks prefer a SPECIFIC category over a catch-all like "All Trees", and an item carrying a botanical name).
- **Honesty (D-9 — the whole contract):** low-confidence OR no-clear-category items are **FLAGGED** (`status='review'`, reason in `notes`), never silently coerced; **price is UNKNOWN** (`unit_cost=null`, `cost_confidence='UNKNOWN'`) — never 0 (the site has no prices); **qty=0** (never fabricated); **`cultivar_plants` deliberately NOT populated** (per-specimen/QR identity doesn't exist on a bare-domain QR — writing it would be fabrication). The dashboard's `status` + `cost_confidence` badges visibly separate "sure" from "verify me".
- **Idempotent markers:** `business_inventory.sku LIKE 'DISC-%'` / `notes LIKE '[DISCOVERY]%'`. Populate clears BOTH the 1.2 sandbox (`SMPL-`/`[SANDBOX]`, reusing `clearSandbox`) and prior discovery rows before writing.
- **`business_discovery_profiles`** (gated migration) stores the full `raw_extract` (items + confidences + counts) as the honesty/audit trail — upsert on `(business_id, source_url)`.
- Emits `[TRACE:POPULATE]` (crawl / extract / clear / populate) ON by default.

### Cost-Discovery — cost-to-produce reasoning (Opus) → `business_inventory` cost + confidence — added 2026-06-21

**What:** A discovery capability that drives a short question flow REASONING about a grower's cost-to-produce for ONE inventory line (e.g. the LAWNS 30-gal Live Oak) and writes `business_inventory.unit_cost` + `cost_confidence`. Each owner answer re-runs the reasoning, so confidence SHARPENS as inputs accumulate — typically ESTIMATED (a stated guess) → DERIVED (computed from confirmed inputs). Routed to **Opus** (reasoning-under-uncertainty) via the existing per-capability model routing, with the per-business `business_modules.config` override still honored. Mirrors the catalog-discovery honesty posture, pointed at COST instead of variety. NOT a schema change — `unit_cost` (nullable) + `cost_confidence` (CONFIRMED|DERIVED|ESTIMATED|UNKNOWN) already exist (`20260612_business_assets_inventory_cost_confidence.sql`).
**Status:** ✅ BUILDER-COMPLETE (2026-06-21) — `costDiscovery.test.ts` **26/26** adversarial (no live AI) + `scripts/verify-cost-discovery.ts` **9/9** against LIVE `business_inventory` on the service key (ESTIMATED written → SHARPENS to DERIVED → forced-CONFIRMED **BLOCKED**, row unchanged → UNKNOWN leaves the line as-is → cleanup). **OWNER-PROOF owed** (David: run a cost-discovery pass through real UI under real RLS on a real line, watch confidence move ESTIMATED→DERIVED as he answers, and see it refuse to claim CONFIRMED without a receipt — needs a small UI panel on `/inventory` as the surface). **Type:** capability | **Vertical:** cross-vertical (shared), proven on cultivar.
**Location:** `packages/shared/src/discovery/costDiscovery.ts` (engine: prompt + code honesty-guard + turn driver + writer) + `costDiscovery.test.ts` (26/26), exported from `discovery/index.ts`; AI capability `discovery_cost` (**Opus `claude-opus-4-8`**) in `ai/capabilities.ts`; wired into the existing `api/discovery/ingest.ts` as `action='cost-discovery'` (one turn) + `action='cost-apply'` (write) — **no new Vercel function** (12-fn ceiling, tech-debt #41); proof `scripts/verify-cost-discovery.ts`.
- **Honesty contract (enforced in CODE, not just the prompt — the real risk surface):**
  - **NEVER CONFIRMED:** `guardReasoning` RAISES `CostConfidenceViolation` on any model attempt to claim CONFIRMED (reserved for receipt-linked cost, D-9 count-once seam); the writer re-rejects it at the DB boundary. Proven: a forced-CONFIRMED model output is blocked and the row is left untouched.
  - **NEVER fabricate:** a missing / non-numeric / zero / negative cost collapses to UNKNOWN (null) — unknown stays UNKNOWN, never written as $0.
  - **ESTIMATED vs DERIVED:** ESTIMATED = owner's stated guess; DERIVED = computed from confirmed inputs and carries the `derivation` arithmetic. A DERIVED claim with no shown arithmetic is DEMOTED to ESTIMATED — a guess is never dressed up as a derivation.
  - **Declined leaves it where it was:** `applyCostReasoning` makes NO write on an UNKNOWN turn — the line is left exactly as it was, honestly labeled (never clobbered, never fabricated).
- **Tenant-safe write:** updates `business_inventory` scoped by `(id, business_id)` — never cross-tenant.
- Emits `[TRACE:COSTDISC]` (turn / guard / apply) ON by default per the standing owner instruction.

### Design Record — Grower Import, Margin Referee, Role×Device Visibility (DOC ONLY) — added 2026-06-21

**What:** Durable capture of the 2026-06-21 grower-scan design session — NOT a build. Records the experiment result (28 growers / 1378 items / 0 fabrication; import BLOCKED on a cost-ledger schema with no home for sell price, price basis, or size) and the locked design for: grower import, the **margin referee** (cost + sell price + floor, fires only at CONFIRMED/DERIVED, verdict always carries confidence), **role×device visibility** (ROLE = security ceiling enforced at the DATA layer × CONTEXT/DEVICE = owner-tunable focus — one additive mobile-flag column on Ignition's role→field config), AI routing by kind of cognition (OCR=cheap extraction / cost discovery=Opus reasoning), the onboarding honesty gradient, and the CSV-at-OCR-door rule.
**Status:** ✅ Doc written. Design LOCKED; **schema gap unbuilt** (needs additive nullable `sell_price` + `price_basis` PAIR + `size_or_container` — D-9 UNKNOWN-never-zero, overlaps tech-debt #42 residual). **Type:** decision record | **Vertical:** cross-vertical.
**Location:** [docs/decisions/2026-06-21-grower-import-and-mobile-roles.md](decisions/2026-06-21-grower-import-and-mobile-roles.md). Source data: `data/grower-scan/grower-scan-report.md` + `data/grower-scan/inventory-fit-map.md`.
- **Promotion flags (pending David):** MASTER_BRIEF (viability-at-scale, honesty-as-moat, operating-vs-capital pricing) · STANDARDS (margin-verdict-carries-confidence; role enforced at data layer not render) · PLATFORM_AUDIT (schema gap + additive delta when built) · tech-debt #42 (sell_price/size ALTER overlaps its residual).

---

### Decision Record — Role-Based Financial Permissions v1 (DOC ONLY) — added 2026-06-21

**What:** Sign-off artifact for the role-permission hardening build that follows — NOT a build. Records the verified problem (role enforcement is RENDER-ONLY: `business_members.permissions` JSONB read into context but consulted by no RLS policy or API; exactly one render gate fires; ~26 sensitive columns across 6 tables sit owner_all+member_all only; tenant isolation AC-2/AC-3 intact and SEPARATE). Decides the **four permissions** (view_wages, view_pricing_config, view_costs, view_margin — view_margin requires view_costs), **role defaults** (Owner=all four; Manager=costs+margin not pricing-config/wages; Tech=none), and the **hybrid enforcement by data class** (HARD data-layer wall via RLS + column masking for wages + pricing_config; ROLE-AWARE RESPONSE SHAPING for costs + margin because the server consumes unit_cost in checkout #11/#12 + dashboard rollups and a flat RLS-deny would NULL totals across 14 multi-role SELECT sites; render gates are the top convenience layer only). Binding doctrine: DEFAULT-DENY · SINGLE CHOKEPOINT (can()/checkPermission()) · RESTRICTIVE-FIRST/EXPAND-ONLY · PROOF BAR (low-role direct query refused at network response, not render-absence).
**Status:** ✅ Doc written. Decision LOCKED; **enforcement unbuilt** (build owes: mint+seed four permissions + backfill current owners before flipping on · wire dormant chokepoint · column-masking approach chosen at build · per-site hand-verify the 14 SELECT sites · resolve checkout public-path unit_cost shaping). Two-bar / RLS gates N/A this pass; the build owes both bars. **Type:** decision record | **Vertical:** cross-vertical.
**Location:** [docs/decisions/2026-06-21-role-financial-permissions.md](decisions/2026-06-21-role-financial-permissions.md). Source recon: `data/grower-scan/role-enforcement-ground-truth.md`.

---

### Standard — STD-011 ONE CANONICAL REPRESENTATION PER FACT (DOC ONLY) — added 2026-06-22

**What:** New numbered standard in STANDARDS.md — NOT a build. A single-meaning fact (access/state booleans, tenant predicates, enum/status value sets, driftable config values) MUST have exactly ONE canonical representation referenced everywhere, never re-derived or duplicated; two representations of one fact can silently disagree, and in access/boundary/value facts that silence IS the leak. Encodes: state→one column via one shared helper (e.g. SECURITY DEFINER `is_active_member()`, which also resolves RLS recursion); enum→one allowed-value definition; config→one home per the config doctrine. Enforcement: a new sensitive column/policy re-deriving a fact = INCOMPLETE; a consistency sweep is a recognized correctness-hardening tool. Promotes AC-4 to a data-integrity invariant with a security consequence.
**Status:** ✅ Standard written into STANDARDS.md (§STD-011 + ENFORCEMENT row + CHANGELOG v1.9). **Type:** standard | **Vertical:** cross-vertical.
**Origin:** the membership-active RLS consistency sweep — `data/grower-scan/member-rls-consistency-audit.md` (3 spellings of "active member"; `md_self` omitted the active filter → revoked member kept self-device access). **Recorded open item:** owner-only operational tables (orders/customers/plants/order_items + pre-2026-06 tables) have NO member policy → Staff RLS-blocked despite `view_orders`/`qr_checkout`; next hardening item is a PRODUCT decision (what does Staff see, scoped how, PII?). Cross-pointer in tech-debt only.
**Cross-refs:** [STANDARDS.md](../STANDARDS.md) §STD-011 · AC-4 / AC-2 / AC-3 · config doctrine.

---

### Financial Permission Wall — data-layer enforcement (RLS primitives + child-table splits) — updated 2026-06-22

**What:** The data-layer enforcement of the role-financial-permissions decision (above). Two SECURITY DEFINER primitives + per-table RLS so a low-role member's cost/wage/pricing read is refused at the DATA layer (network response), not just hidden at render.
- **Primitives (canonical, owned by postgres, `search_path=''`, EXECUTE→authenticated):** `is_active_member(business_id)` (membership truth — `20260622_is_active_member_canonical_rls.sql`) + `has_permission(business_id, perm)` (active membership AND `permissions ? perm`, jsonb array-of-strings — `20260622_oauth_secrets_relocation_and_cost_wall.sql`). Policies compose them: `is_active_member(X) AND has_permission(X,'view_costs')` (membership-then-permission, composed not fused).
- **HARD-WALL child-table splits (`20260621_financial_wall_phase2.sql`):** `labor_resource_wages` (HR pay, gated `view_wages`) + `business_pricing_config` (pricing recipe, gated `view_pricing_config`) — sensitive values moved off the member-readable parent into role-gated child rows; member policies decomposed onto the two primitives 2026-06-22.
- **view_costs table gates (2026-06-22):** 6 cost tables (`cost_objects`, `business_inventory`, `cost_object_edges`, `cost_object_assignments`, `business_service_log`, `receipts`) + `labor_resources` (view_wages) — member policy = `is_active_member AND has_permission`. (The view_costs data gate was NEVER built before this — cost tables had been membership-only; recon `data/grower-scan/cost-wall-leak-scope.md`.)
- **Render layer (top convenience tier only, NOT the boundary):** `PermissionRoute permission={VIEW_COSTS}` wraps `/costs /inventory /assets /operating-costs /pmi` (`packages/cultivar-os/src/router.tsx`); chokepoint `can()`/`has_permission()` in `BusinessProvider`. Permission constants: `packages/shared/src/auth/financialPermissions.ts`.

**Status:** ✅ READ-WALL OWNER-PROVEN (Staff HAR: cost reads return 200 [], RLS row-filter; tamper 3/0; migrations live). ✅ WRITE-WALL — data-layer ENFORCED + the one bypass CLOSED (Gate-3b, 2026-06-22): the cost/wage member policies are `FOR ALL` with `has_permission` in `USING`+`WITH CHECK` (`20260622_…cost_wall.sql:141-212`) → anon-key INSERT/UPDATE/DELETE refused for a member lacking the permission (recon-confirmed; write-tamper proof `scripts/verify-write-wall.ts`). The lone service-key bypass (costDiscovery `cost-apply`) is now caller-permission-gated (`api/discovery/ingest.ts` requires `view_costs` resolved from the auth context). Residual: render-layer button gates (operating-cost "+cost" shown to staff though the write is RLS-refused) = defense-in-depth, tech-debt #46.2. Enforces the D-009 moat on reads AND writes. Staff HAR detail: `trace_staff_only`, `isOwner:false`, `effectivePermissions` Array(3), no `view_costs`; every cost read (`cost_objects`, `business_inventory…unit_cost`, `business_pricing_config`) returned `200 []`. Artifact: `cultivar-os_vercel_app.har`. **Type:** capability (RLS/security) | **Vertical:** shared.

**Phase 3 Part A (render layer)** — ⏳ BUILDER-COMPLETE, OWNER-PROVEN OWED-AFTER-DEPLOY. Code committed (`8918fe8`): `router.tsx:82` wraps `/costs|/inventory|/assets|/operating-costs|/pmi` in `<PermissionRoute permission={VIEW_COSTS}>`; `Dashboard.tsx:145` shapes the query (`.select(canViewCosts ? 'qty, unit_cost' : 'qty')`). In local `dist`; LIVE Vercel deploy + fresh Staff HAR owed: expect cost requests absent from the dashboard, the dashboard inventory query qty-only, and direct nav to gated routes redirects. (Part C grower-import — checkout cost-as-price is the 2nd symptom of the `sell_price`/`price_basis` gap → `docs/decisions/2026-06-21-grower-import-and-mobile-roles.md` + `data/grower-scan/inventory-fit-map.md`.)
**Cross-refs:** recon `data/grower-scan/cost-wall-leak-scope.md` · decision `docs/decisions/2026-06-21-role-financial-permissions.md` · STD-011.

---

### QB OAuth Secret Storage — owner-only `business_accounting_secrets` — added 2026-06-22

**What:** QuickBooks bearer secrets (`accounting_token` + `accounting_refresh_token`) relocated out of the member-readable `businesses` row into an owner-only table (Gate-3 credential leak: `businesses_member_select` exposed live QB tokens to active members). `business_accounting_secrets` (PK business_id FK→businesses CASCADE; `bas_owner_all` owner-only RLS, NO member policy). Realm ID + expiry + reconnect-flag + provider stay on `businesses` (non-secret, client-read). Shared accessor `packages/shared/src/quickbooks/secrets.ts` (`readQBSecrets`/`writeQBSecrets`, secrets-table-first + businesses-column fallback for deploy-window safety); repointed `quickbooks/refresh.ts`, `api/qbo/router.ts`, `api/qbo/invoice/cultivar.ts`. Migration: `20260622_oauth_secrets_relocation_and_cost_wall.sql` Part 1.

**Status:** ✅ APPLIED (as postgres) — `business_accounting_secrets` owner-only (`bas_owner_all`, no member policy); bearer tokens out of member reach. QB reconnect repointed to `writeQBSecrets`/`readQBSecrets` (`router.ts:133`, `refresh.ts:59`, `router.ts:182`, `invoice/cultivar.ts:112`); no bearer-token writes to `businesses` except `secrets.ts` deploy-window fallback. No regression. (Businesses columns NULLed; DROP = gated follow-up — see tech-debt log.) **Type:** infrastructure (security) | **Vertical:** shared. **Header:** `secrets.ts` carries PURPOSE/DEPENDENCIES/OUTPUTS.
**Cross-refs:** recon `data/grower-scan/cost-wall-leak-scope.md` (out-of-scope side finding) · Off-Limits exception authorized by Gate-3.

---

### Role Machine — PLANNED (doctrine D-010..D-015; seeded 2026-06-22)

*Doctrine settled in MASTER_BRIEF.md D-010 through D-015. Checkable acceptance lives in `scripts/verify-universals.mjs` (assertions a–h + cap #1), not duplicated here. All ⬜ PLANNED — not built.*

- **Role Machine = the role/permission TEST HARNESS** (built first; the bench every gate is proven against). — ⬜ PLANNED.
- **Tile Registry (single source)** — ✅ **BUILDER-COMPLETE 2026-06-23** (verify-universals **caps #a + #e FAIL→live PASS**; OWNER-PROVEN owed). `packages/cultivar-os/src/registry/tileRegistry.ts` is THE one declared source — `TILE_REGISTRY: TileEntry[]` (`key · label · group · kind · placement · nav_eligible · required_permission · status · depends_on` + icon/color/route/module_key) — read by every surface via selectors (`dashboardTiles`, `dashboardReadouts`, `tilesForPlacement`, `allTiles`, `tileByKey`, `requiredPermissionFor`, `registryPermissions`). **Registry HOME = code, not the `modules` DB table** (an icon is a React component + a route is a navigate call — neither fits a Postgres row; a DB home would force a parallel code map → drift returns. Decision in the file header). The **three drift-lists are GONE**: `MODULE_META` + `MODULE_ORDER` deleted from `useModules.ts` (now reads `dashboardTiles()` + overlays per-tenant `business_modules` enablement + gates on `can(required_permission)`); the Dashboard `handleEnable`/`handleNavigate` **switch statements replaced** by one registry-route `openTile`. Dashboard READOUTS now registry-gated (`metric_today_sales` **GATED → view_costs**, was ungated revenue; leakage→view_orders; qb_status→manage_settings; plants/installs→view_dashboard). The 6 registry-gap surfaces (PMI/assets/operating-costs/receipts/inventory + cost-to-produce index) are now first-class dashboard tiles for view_costs holders; planned tiles (online_shop/services/opportunities/followup/insights/campaigns/contractors/seasonal) seeded greyed. `required_permission` LOCKED (financial→view_costs); other fields adjustable. Settings/admin/role-config/marketplace read the same selectors (no parallel hardcoded list). `[TRACE:*]` (existing `[TRACE:PERM]`/`[TRACE:BUSINESS]`) ON. (D-012, MB_D-012). **OWNER-PROVEN owed:** David sees the registry-driven grid live — owner sees all live tiles incl. the 6 financial surfaces; a Staff (no view_costs) session sees neither the cost tiles nor today's-sales/inventory-value readouts.
  - **VERTICAL-AWARE 2026-06-23 (additive, no migration):** each entry gains a `vertical` (scope) field — `general` (shared spine, every business) / `cultivar` / `ignition` / `conduit` / `kinna`. Every CURRENT entry is `general` (the platform spine is mostly general; verticals add a thin specific layer). Enablement is now vertical-aware: `useModules` reads the business's `businesses.business_type` (existing column — `general`/`nursery`, `NOT NULL DEFAULT 'nursery'`), maps it via `verticalsForBusinessType` (general→[general], nursery→[general,cultivar], diesel/auto→[general,ignition]) and renders only `dashboardTilesForVerticals(...)` — so a generalist (TRACE) gets general-only, a nursery (LAWNS) gets general+cultivar, an auto shop gets general+ignition, from ONE registry by DATA not forks. Unknown/null business_type fails SAFE to `[general]`. **This is the Ignition-reconnection bridge:** VIN/DTC/compliance-waiver/tooling tiles will live in this one registry tagged `ignition` (tag→enable, not rebuild). `required_permission` still LOCKED; `vertical`/`placement` adjustable. No business-vertical schema gap — the column exists. (commit `__PENDING__`)
- **Role-config UI (visibility axis)** — ✅ **BUILDER-COMPLETE 2026-06-23** (verify-universals **#s/#f/#g live PASS + #e exercised**; OWNER-PROVEN owed). The owner console at **`/roles`** (`packages/cultivar-os/src/pages/RoleConfig.tsx`, owner-gated via `PermissionRoute manage_settings`; reached from Settings → "Manage roles →"). Cultivar-native rebuild of Ignition's RolesTab visual (forest-green tokens). **Registry-fed chips (B2):** the permission catalog is `registryPermissions()` (tile-gating perms) ∪ `ALL_FINANCIAL_PERMISSIONS` (canonical financial-wall perms — defined ONCE in the shared module, they gate DATA not a tile) ∪ `ALL_ACTION_PERMISSIONS` (behavior-gating action perms — `packages/shared/src/auth/actionPermissions.ts`; gate an ACTION not a tile, so absent from `registryPermissions()`) minus `owner-only` — NO hardcoded list, so a new tile's permission surfaces as a chip with no edit (cap #e). Chips grouped by the tile `group`. **Reuses the single `can()` chokepoint** (no second permission source) and the existing shared **`updateMemberRole()`** for member→role assignment. **Three-tier store** = shared `roleDefinitions.ts` over the `role_definitions` table (floor `business_id IS NULL` / per-tenant override / custom). **MB_D-010 behaviors:** system roles LOCKED (no delete/rename), **clone-not-mutate** (tuning a system role writes a SEPARATE tenant override; the floor is never mutated), **factory-reset = delete the tenant override** row (floor shows through). `[TRACE:ROLECFG]` ON. **Security underpinning (PART A, APPLIED + 8/8 catalog-verified):** migration `20260623_role_definitions_and_self_grant_fix.sql` closed the `bm_self_update` self-grant hole (USING-only → added `WITH CHECK` + a `BEFORE UPDATE` trigger `enforce_member_authority_immutability` blocking any role/permissions change except by the owner — MB_D-015) and created `role_definitions` (partial unique indexes for floor vs tenant; RLS `rd_read` floor+member-scoped / `rd_owner_write` owner-only, floor never tenant-writable; 3-role floor seed OWNER 12/MANAGER 9/STAFF 3, data-extensible to TECH/SERVICE). **OWNER-PROVEN owed:** David configures a STAFF role live, switches to it → cost tiles + today's-sales/inventory-value readouts vanish + cost writes refuse + self-elevation refuses. **SCOPE: visibility axis ONLY** — not activation authority / marketplace / Stripe. (D-010, D-011, MB_D-015)
- **Action-permission catalog (`override_maintenance`)** — ✅ **DECLARED 2026-06-24** (mechanism NOT built). New shared `packages/shared/src/auth/actionPermissions.ts` mirrors `financialPermissions.ts` for perms that gate a BEHAVIOR not a tile. First entry: **`override_maintenance`** (defer/use an asset against its PMI schedule) — default **OWNER ✓ / MANAGER ✓ / STAFF ✗** (`ACTION_ROLE_DEFAULTS` + cultivar `DEFAULT_PERMISSIONS`). Unioned into the role-config chip catalog (above), so it is assignable / clone-not-mutate / factory-resettable today. **The override MECHANISM (the defer/reason-required `overrides jsonb` write + audit) is NOT built** — declared only so the permission exists and is grantable; the mechanism waits for the PMI↔Delivery coupling build (ledger #21). Test: `pmiInterval.test.ts` asserts catalog-visibility + the role defaults. (D-011, ledger #20/#21)
- **Tile Marketplace + activation authority (money axis)** — ⬜ PLANNED. `trial → active → lapsed-fuzzy`; activation owner-default/delegable/audited/live-revocable; Stripe human-confirmed. BUILDS shared `stripe/{billing,trial}.ts` (do not assume they exist — they DON'T; only `supabase/types.ts` carries `stripe_customer_id`/`stripe_subscription_id` columns. Recon-confirmed 2026-06-22). (D-011, D-013)
- **Persistent identity header** — ✅ **BUILDER-COMPLETE 2026-06-22** (verify-universals **cap #1 FAIL → PASS**; OWNER-PROVEN owed-after-deploy). Shared `<AppHeader>` (`packages/shared/src/components/AppHeader.tsx`) — a sticky strip showing active business name + signed-in person name + role badge (OWNER/MANAGER/STAFF, the 3 Cultivar runs today; inherits the 5-role model for free when Role Machine lands because it reads the resolved role, not a hardcoded list). Mounted ONCE via `AppLayout` (`packages/cultivar-os/src/components/layout/AppLayout.tsx`) wrapping the PrivateRoute routes (`router.tsx`) — one mount, every authenticated page, not per-page. Identity comes from the canonical BusinessProvider context (exposes `userName`/`userEmail`/`role`); the header NEVER fetches on its own. As of Nav C2 (2026-06-24) it shows the **person name** (member `business_members.name` / owner auth-metadata name) primary with the email demoted to the hover title. `[TRACE:HEADER]` ON. Cultivar-native rebuild of the Ignition ShopBanner/IDENTITY MATRIX strip (shape ported, not code).
- **Navigation system — breadcrumb + hamburger from ONE IA (Model C2)** — ✅ **BUILDER-COMPLETE 2026-06-24** (verify-universals **cap #n PASS**, #a/#e still PASS; build clean 2215 modules; OWNER-PROVEN owed-after-deploy). The IA is registry DATA — `NAV_IA` in `packages/cultivar-os/src/registry/tileRegistry.ts` (the SAME single source as the tile grid — NOT a parallel nav list). A nav node that IS a tile references it by `tileKey` and inherits its label/route/permission (security gate can't drift); the non-tile surfaces (3 section roots, `/settings` root, `/roles`, `/deliveries` route-a-day, `/campaigns/:id` detail) are declared inline. Selectors: `breadcrumbForPath`, `navSections`, `navByKey`, `navChildrenOf`, `navLabel/navRoute/navPermission`, `navNodeForPath`. **One breadcrumb** (`components/nav/Breadcrumb.tsx`, "up" not "back", ancestors link / current doesn't, responsive full→`‹ parent` collapse) + **one hamburger/nav-rail** (`components/nav/AppNav.tsx`, TOP-LEVEL sections Dashboard·Settings·Admin only; **Admin renders iff the session can see ≥1 owner-scoped child** — Staff never sees an empty Admin). Both mounted ONCE in `AppLayout` (sticky `.appchrome` bar in `styles/globals.css`, 768px breakpoint). **8 hand-rolled back variants + 1 inline DELETED** (Orders/BusinessAssets/BusinessInventory/OperatingCosts/DeliveryRoute/DeliverySchedule/SocialSetup/Campaigns/CampaignDetail header/ReceiptKeeper ×3/Settings `onBack`/CostToProduce inline); **PMI + `/roles` GAIN a breadcrumb** (had none); **wizard step-backs untouched** (OnboardingWizard/AddOns/CartReview/CustomerCapture/Confirmation). Access changes: tile `qr_checkout` label `QR Checkout`→**Orders**; `cost_to_produce` placement `dashboard`→**admin** + `view_costs`→**owner-only** (nav AND the `/costs` route — own `PermissionRoute permission="owner-only"`, out of the view_costs group). `[TRACE:NAV]` ON. **OWNER-PROVEN owed:** David navigates surfaces — consistent breadcrumb everywhere incl. PMI + `/roles`, working hamburger on mobile, Admin hidden from a Staff session, person-name in header, Cost-to-Produce gone from a Staff session (nav + URL). (Nav C2, close-out ledger #17.)
  - **FIX-PASS 2026-06-24** (`eee3146`, BUILDER-COMPLETE, owner-proof owed — ledger #23): owner-proof of STAGE 2 found gaps. **FIX 1 (access):** Cost-to-Produce was unreachable in the Admin rail — root cause NAVIGATIONAL not permission (the `'owner-only'` gate resolves correctly: owner→true). AppNav previously rendered only top-level sections and collapsed the landing-less Admin section to its first child (Add Business), stranding Cost-to-Produce. AppNav now renders a section with NO landing route (Admin) as a heading + each visible child as a sub-link (`.appnav-group`/`.appnav-heading`/`.appnav-sublink`, `display:contents` so it flows in rail + drawer). required_permission stays `owner-only`. **FIX 2 (orphan):** `/help` had no rail/breadcrumb — added `nav_help` NAV_IA node (parent Dashboard → "Dashboard / Help"); Help mounts `<AppNav/>`+`<Breadcrumb/>` itself (kept PUBLIC, not moved into AppLayout, so prospects keep access). verify-universals cap #n now requires `nav_help`. **FIX 3 (header name):** read path confirmed correct (no change); write-path gap reported (OwnerSignup `signUp` sets no `user_metadata.full_name`). **DECISIONS A/B (duplicate dashboard nav row; parents-list-children) recon posted, NOT built — awaiting David.**
  - **PROFILE + AVATAR-MENU 2026-06-24** (`33f8324`, BUILDER-COMPLETE, owner-proof owed — ledger #24): the standard identity surface, and the WRITER FIX-PASS #3 deferred. **`/profile` page** (`packages/cultivar-os/src/pages/Profile.tsx`, in `AppLayout` so it carries nav chrome) branches on `isOwner`: OWNER edits **name only** → `supabase.auth.updateUser({ data:{ full_name } })` (owners have no member row; login email read-only) — **this is the missing owner display-name writer** (fix-pass #3 found the read path correct but no writer; OwnerSignup still sets no metadata); STAFF edits **name/phone/email** → own `business_members` row scoped to `user_id`+`business_id` via `bm_self_update` RLS. **Authority boundary absolute:** the profile update lists name/phone/email ONLY — role/permissions are never written (a self-edit of name/phone/email does not trip `enforce_member_authority_immutability`). On save → optimistic local state + context `reload()` so the header switches from email to name immediately. `[TRACE:PROFILE]` ON (load + save). **`nav_profile` NAV_IA node** (Settings / Your Profile, `view_dashboard` → reachable by every authenticated role incl. STAFF) — the SECONDARY entry. **Header avatar menu** (`packages/shared/src/components/AppHeader.tsx`) — the PRIMARY entry: the name/role/avatar area is now a button → dropdown (card: name + email + role badge; items **Your Profile · Help · + Business**[owner] **· Sign out**; click-out backdrop). Settings deliberately OMITTED from the menu (it's a nav-rail section — listing it here re-creates the duplicate-nav bug). **Old Dashboard account-action row DELETED** (Help · Settings · Receipts · + Business · Sign out at `Dashboard.tsx`) + `handleSignOut` removed → **RESOLVES nav Decision A (Settings listed twice)**. **FLAG (reported, not changed):** + Business now appears in BOTH the avatar menu AND Admin (`add_business`) — left as-is this pass (interacts with the pending Cost-to-Produce/Admin permission fix). **OWNER-PROVEN owed:** David sets his name on `/profile` via the avatar menu → header shows "David" not email; a STAFF session opens `/profile`, edits own contact, never touches role/permissions.
  - **NAV FIX — persistent chrome + full IA tree + Delivery sub-pages findable 2026-06-26** (`4c6308a`, BUILDER-COMPLETE, owner-proof owed — ledger #49): the 2026-06-26 owner-prove found the owner "lost on entry" — three issues, ONE root cause (nav structure). **(1) Persistent:** `AppHeader` (sticky top:0 z-20) and `.appchrome` (sticky top:0 z-15) were two INDEPENDENT sticky siblings both pinned to top:0, so the lower-z nav slid UNDER the higher-z banner on scroll. FIX: `AppLayout` wraps `<AppHeader>`+`.appchrome` in ONE sticky `.appchrome-stack` (z-20); `.appchrome`→`position:relative` (keeps the drawer's positioning context, no second sticky) → header + nav pin together as one unit, page scrolls beneath, nav never hides. **(2) Structure:** AppNav previously rendered only `navSections()` [Dashboard·Settings·Admin] and collapsed any section WITH a route to a single link → the entire dashboard branch (Delivery/Operating Costs/Social/PMI/Orders + their sub-pages) was never surfaced. AppNav rewritten to render the full `NAV_IA` tree — Dashboard home + the dashboard branch's surfaces PROMOTED to top-level peers, each EXPANDED to its sub-pages (Delivery→Route; Operating Costs→Assets/Inventory/Receipts; Social→Campaigns) + Admin + Settings; **still reads the ONE registry IA (no parallel list)**, every node gated via `can(navPermission)`. The hamburger is now visible at EVERY width (a 3-level tree reads as a vertical drawer on phone + desktop); the old desktop horizontal rail was dropped (it couldn't represent the structure). **(3) Delivery discoverability:** the Delivery group shows its sub-pages in the tree; `nav_delivery_route` label `Route a day`→`Route` (KEY unchanged → cap #n + breadcrumb intact) so the owner reaches **Delivery › Route** without guessing. Help kept OUT of the structural nav (lives in the header account menu — avoids the duplicate-surface class). **AUTH/schema/RLS NEVER touched.** `[TRACE:NAV]` stays ON (now emits `[TRACE:NAV] menu`). `npm run verify` exit 0 zero NET-NEW; build clean 2219 modules; cap #n PASS. **OWNER-PROVEN owed:** David opens the nav → it stays put (no slide under the banner), shows the real top-level structure, and reaches Delivery Route from the nav without guessing. **FLAGGED follow-up (not built):** an always-visible desktop top-level rail (optional — hamburger covers discoverability today) + the registry-driven version is already in place, so no second nav list to reconcile.
- **Gate-3b WRITE-WALL** — scope CORRECTED by recon (2026-06-22): the **data-layer write wall ALREADY HOLDS** — the cost/wage member policies are `FOR ALL` with `has_permission(...)` in BOTH `USING` and `WITH CHECK` (`20260622_oauth_secrets_relocation_and_cost_wall.sql:141-212`), so a member lacking the permission is RLS-refused INSERT/UPDATE/DELETE, not just SELECT. The operating-cost "+cost" button is **render-layer LEAKAGE** (shown to staff, but the write is RLS-refused — not a data-layer breach). The ONE real hole was the **costDiscovery cost-apply service-key endpoint** (bypassed RLS, no caller check). Gate-3b = (1) gate that endpoint [done — see below]; (2) write-tamper proof [done]; (3) render-layer button gates [defense-in-depth, tech-debt #46.2]. (D-015 / MB_D-015, tech-debt #46, verify-universals assertion (h))

**Type:** capability (PLANNED) | **Vertical:** shared. **Cross-refs:** MASTER_BRIEF D-010..D-015 · PLATFORM_STRATEGY § Role / Marketplace Layer · STD-011 · tech-debt #46.

---

## CoolRunnings

**What:** Separate vertical for homes. Not part of trace-platform monorepo.  
**Status:** Active development, separate repo  
**Vertical:** N/A (separate repo — not in the trace-platform shared layer) | **Type:** N/A  
*⚠️ NEEDS DAVID'S CALL — see bottom: this entry is a reference pointer, not a built capability in this repo. No type classification applies.*  
**Repo:** `david-obrien61/CoolRunning` on GitHub  
**Desktop folder:** `~/Desktop/CoolRunning/`  
**Assessment tool:** `~/Desktop/trace-assessment-app/` — standalone, no git

---

## Repo Map (Desktop → GitHub)

*Reference section — no Vertical/Type classification applies.*

| Desktop Folder | GitHub Repo | What's in it | Status |
|---|---|---|---|
| `~/Desktop/trace-platform/` | `david-obrien61/trace-platform` | Cultivar OS (active) · ignition-os (active — web build complete 2026-05-28) | Active — primary monorepo. Only folder that deploys to Vercel. Both verticals deploy from here. |
| `~/Desktop/CAI/` | `david-obrien61/CAI` | Ignition OS (original JavaScript source) | **Archive (2026-05-28)** — web build migrated to `packages/ignition-os/`. Read-only. Keep for `ai_router.py` reference until Railway is decommissioned. |
| `~/Desktop/CoolRunning/` | `david-obrien61/CoolRunning` | CoolRunnings vertical | Active — separate vertical. |
| `~/Desktop/IgnitionMobile/` | `david-obrien61/ignition` (archived) | Ignition OS mobile prototype | Archive — rename folder to `IgnitionMobile-archive`. |
| `~/Desktop/Cultivar-os/` | (none) | Empty | Safe to delete. |
| `~/Desktop/trace-assessment-app/` | (none) | CoolRunnings assessment tool | Standalone, no git. |

---

## Ignition OS — Workflow Modules (2026-06-09 Reality Audit)

**Audit date:** 2026-06-09 | **Standard:** STD-010 (opaque name = debt; discovered build = catalogue it) | **Scope:** all .jsx/.js in `packages/ignition-os/` (root + modules/ + hooks/) | **Full report:** `docs/audits/ignition-reality-audit-2026-06-09.md`

> **Root-cause notes before the table:**
> - **DARK root cause:** `VITE_API_URL` not set in ignition-os Vercel project → every `AIEngine.call()` returns `{ ok: false }`. Railway running but receives zero Vercel traffic.
> - **BROKEN root cause:** `20260602_ignition_drop_team_tables.sql` dropped `pin_resets`, `shop_invites`, `member_devices`. Only `shop_members` was recreated (`20260603_recreate_shop_members.sql`). The other three tables have no recreate migration.
> - **SPLIT-BRAIN root cause:** `IgnitionIntake` writes customers to Supabase `customers`. `IgnitionCRM` reads from DataBridge `customers_directory`. These are entirely separate stores — intake customers never appear in CRM.

**Authoritative detail:** [`docs/audits/ignition-reality-audit-2026-06-09.md`](audits/ignition-reality-audit-2026-06-09.md) — full module table, workflow chain, RBAC, and DataBridge orphaned keys.

> ⚠️ DEPRECATED — the module table, workflow chain, RBAC section, and DataBridge orphaned keys below are bulk copies from the audit doc above. Remove in a later cleanup pass; read the audit doc for authoritative detail.

### Module Status Table

| Module / File | STD-010 Decoded Name | Status | Workflow Position |
|---|---|---|---|
| `CoreApp.jsx` | Master Session Controller | WIRED (ForgotPinFlow + JoinFlow sub-flows BROKEN) | Session gate — every module flows through |
| `DataBridge.js` | Local-First Data Layer | WIRED (cloud sync DARK — API_URL unset) | Infrastructure |
| `MarginEngine.js` | Full Pricing Engine | WIRED — 🔴 DEPRECATED 2026-06-10; superseded by `packages/shared/src/business-logic/MarginEngine.ts`. Migrate callers via checklist. | Infrastructure |
| `ExternalBridge.js` | QB OAuth + CSV Import | QB path DARK / CSV WIRED | Support — QB dead; CSV migration works |
| `IgnitionCore.js` | Web Session Guard + Sub-Router | WIRED | Session infrastructure |
| `PriceField.jsx` | Part Pricing Widget | WIRED | Sub-component of IgnitionEstimate (Step 4) |
| `modules/OnboardingWizard.jsx` | Owner Signup Wizard (canonical) | WIRED | Initial setup (first-run) |
| `modules/IgnitionIntake.jsx` | New Repair Order Creation | WIRED | Step 1 — creates the RO |
| `modules/IgnitionFlux.jsx` | RO Queue / Workflow Status Board | WIRED | Step 2 — job queue + routing |
| `modules/IgnitionEval.jsx` | Tech Evaluation Station | WIRED (photo upload: AMBIGUOUS — Supabase storage bucket unconfirmed) | Step 3 — DTC, photos, labor clock |
| `modules/IgnitionCipher.jsx` | DTC Fault Code Decoder | DARK (AI path). Local 3-code lookup (3216/3251/157) works. | Step 3.5 support — DTC decode |
| `modules/IgnitionEstimate.jsx` | Service Writer Estimate Station | DARK (AI skeleton + auto-PO). Manual estimate editing WIRED. | Steps 4–5 — estimate build |
| `modules/IgnitionPort.jsx` | Customer Estimate Portal (DataBridge path) | WIRED (DataBridge-only; parallel to IgnitionEstimate, incompatible data) | Steps 5–6 alternate path |
| `modules/CustomerApprovalPortal.jsx` | Customer Digital Signature Screen | WIRED | Step 6 — customer authorization |
| `modules/IgnitionKosk.jsx` | Technician Floor Station | WIRED | Step 7 — tech repair execution |
| `modules/IgnitionHandover.jsx` | Job Handover Modal | WIRED | Sub-component of IgnitionKosk |
| `modules/SlideToComplete.jsx` | Drag-to-Confirm Widget | WIRED | UI sub-component |
| `modules/IgnitionInvoice.jsx` | Invoice Creation + Payment | WIRED (PDF download stub) | Step 8 — final invoice |
| `modules/IgnitionStok.jsx` | Parts Inventory | WIRED | Support — parts lookup |
| `modules/IgnitionProt.jsx` | Margin & Pricing Configuration | WIRED (DataBridge; overhead captured but `calculateRetail()` ignores it — Tech Debt #16) | Admin config |
| `modules/IgnitionTools.jsx` | Shop Equipment Registry + PMI | WIRED | Shop management |
| `modules/IgnitionOmni.jsx` | Shop Command Dashboard | WIRED (inventory_items stat always $0 — orphaned DataBridge read) | Owner command center |
| `modules/IgnitionOmniDashboard.jsx` | Shop Telemetry Dashboard | SAVINGS tab BROKEN (SavingsReport.jsx missing — Tech Debt #10). LIVE METRICS WIRED. | Executive telemetry |
| `modules/IgnitionAudit.jsx` | AI Invoice Leakage Scanner | DARK (AIEngine.auditInvoice() requires API_URL) | Standalone — invoice analysis |
| `modules/PredictiveKey.jsx` | AI Preventive Maintenance Scheduler | DARK (AI schedule generation). DataBridge asset storage WIRED. | Standalone — PMI |
| `modules/IgnitionCompliance.jsx` | 24-Point DOT Inspection | WIRED (form only). Photo = alert stub. smartSync queued but never sent. | Compliance gate |
| `modules/IgnitionAdmin.jsx` | Staff Management + Shop Settings | WIRED (core). Devices tab + PIN reset: BROKEN (member_devices/pin_resets dropped). | Admin |
| `modules/AdminSubscription.jsx` | Module Subscription Marketplace | WIRED (DataBridge trial management) | Admin — module activation |
| `modules/IgnitionProc.jsx` | Vendor Directory | WIRED (DataBridge). "Initialize PO" button: STUB. | Step 5 support |
| `modules/IgnitionCRM.jsx` | Customer Directory (DataBridge) | WIRED (DataBridge-only). SPLIT-BRAIN from intake Supabase data. | Standalone |
| `modules/CSVImporter.jsx` | Customer Data Migration Tool | WIRED (client-side CSV → DataBridge) | Onboarding / migration |
| `modules/IgnitionHub.jsx` | Fleet Dispatch Board | ORPHANED (DataBridge-only; GPS simulated; fleet_units has no real writer in web build) | Parallel — dispatch |
| `modules/IgnitionProcure.jsx` | Parts Entry for Active Job | ORPHANED (not in CoreApp routing; no caller in web build) | Step 6 — ORPHANED |
| `hooks/useIgnitionVoice.js` | Voice Recognition Hook | WIRED (browser-dependent: Chrome/Safari) | IgnitionKosk sub-feature |
| `hooks/usePowerSense.js` | Battery State Hook | WIRED (Chrome/Edge only) | IgnitionKosk environment detection |
| `OnboardingWizard.jsx` (root) | Pain-Point Demo Wizard (5-step) | ✅ ACTIVATED 2026-06-10 — `?demo=true` (full) or `?demo=quick` (jump to scenario picker). `modules/OnboardingWizard.jsx` = separate auth-based signup. | First-run + demo |
| `EnrollmentCatch.jsx` | Enrollment Token Handler | ORPHANED (legacy DataBridge pending_users pattern) | Staff onboarding — old pattern |
| `hooks/useDataBridge.js` | Legacy State Hook | ORPHANED (pre-DataBridge.js; hardcoded demo job) | Not in active flow |
| `hooks/useIgnitionCipher.js` | Legacy PIN Auth Hook | ORPHANED. **⚠️ NAMING COLLISION** — same name "CIPHER" as IgnitionCipher.jsx (DTC decoder) but completely different function. Hardcoded PINs (1111/1234/2222/3333). | Not in active flow |
| `App.js` | Mobile-Era Entry Point | ORPHANED (main.jsx is web entry) | Not in web flow |
| `modules/IgnitionLegal.js` | Legal Contract Repository | MOBILE-ONLY (React Native imports; no web build) | N/A |
| `modules/CustomerApproval.jsx` | (empty) | DESIGNED-NEVER-BUILT (1-line stub file) | N/A |
| `modules/IgnitionVIN.jsx` | VIN Scanner Web Stub | DESIGNED-NEVER-BUILT (`alert()` stub; no decode; mobile-only feature) | Step 3 sub-tool — STUB |

### Workflow Chain Summary

The RO chain is **mostly operational** end-to-end. Key degradation points:

```
Step 1 (Intake) → ✅ Step 2 (Queue) → ✅ Step 3 (Eval) → ⚠️ DTC decode (3 codes only, rest DARK)
→ Step 4 (Estimate: manual works, AI skeleton DARK, auto-PO DARK)
→ Step 5 (Pricing: PORT path DataBridge, Estimate path Supabase — NOT SYNCHRONIZED)
→ Step 6 (Customer Auth: ✅ digital signature)
→ Step 7 (Kiosk: ✅ labor/repair/custody)
→ Step 8 (Invoice: ✅ Supabase; PDF = stub; QB = DARK + no Vercel functions)
```

**QB note:** Cultivar OS has `api/qbo/*` Vercel functions. Ignition OS has NONE. QB is not just DARK — the server-side functions do not exist for Ignition.

**Two parallel estimate paths (incompatible):** `IgnitionEstimate.jsx` (Supabase `estimates/estimate_line_items`) and `IgnitionPort.jsx` (DataBridge `active_job_context`). The same workflow step has two separate, unsynchronized data stores. Customer authorization via `CustomerApprovalPortal` works from both but writes to `customer_authorizations` (Supabase) in both cases.

### RBAC — 19 Permissions, 4 Role Presets, Client-Side Only

Defined in `IgnitionAdmin.jsx ALL_PERMISSIONS`. Enforced by `CoreApp AccessGatekeeper` which checks DataBridge `current_user.permissions`. No Supabase RLS enforcement. Notable gap: `IgnitionCompliance.jsx` has `requiredPermissions={[]}` in CoreApp routing — any logged-in user (including CUSTOMER role) can access the DOT inspection form.

### DataBridge Orphaned Keys

| Type | Key | Problem |
|---|---|---|
| Orphaned write | `margin_change_log` | Written by `DataBridge.setMarginConfig()`. No module reads or displays it. |
| Orphaned write | `pending_users` | Written by IgnitionOmni legacy staff enrollment. Only `EnrollmentCatch` reads it — via an orphaned flow. |
| Orphaned read | `inventory_items` | IgnitionOmni reads for stats. IgnitionStok reads from Supabase `inventory` — not DataBridge. Inventory value tile = always $0. |
| Orphaned read | `fleet_units` | IgnitionHub reads. No module in web build writes real fleet unit data. Hub shows empty GPS grid. |
| Orphaned read | `labor_guide` | `DataBridge.getLaborGuide()` always returns hardcoded defaults — no module has ever written a real labor guide. |

---

## What Is NOT Yet Built (High-Priority Gaps)

| Capability | Who needs it | Notes |
|---|---|---|
| SavingsReport.jsx | Ignition OS | React display component for `savings_report` task. API complete. Display work only. (Tech Debt #10) |
| Stripe billing | All verticals | Types exist in shared. No Stripe calls anywhere. localStorage placeholder in Ignition. |
| Customer directory | Cultivar OS | `customers` table exists, no browse/search UI. Lauren needs this. |
| Online Shop | Cultivar OS | Tile exists, "Enable" stub. Next roadmap item. |
| Follow-Up engine | Cultivar OS | Tile exists, nothing built. |
| ~~Abstract asset model~~ | ~~Shared~~ | ✅ RESOLVED 2026-06-12: `business_assets`, `business_inventory`, `business_pmi_schedule`, `business_service_log` tables built (AC-1 clean, `business_id`-scoped RLS). BusinessAssets.tsx + BusinessInventory.tsx WIRED at `/assets` + `/inventory`. Schema is the concrete instantiation of the pattern. Full shared extraction (QR→record→event as a shared module) remains a future step — see "✅ Resolved Gaps" below. |
| ~~PMI module (`shared/src/modules/PMI.tsx`)~~ | ~~Cultivar OS~~ | ✅ **WIRED 2026-06-13:** Rewired off dead `pmi_assets` onto `business_assets` + `business_pmi_schedule` + `business_service_log`. barcode_id field. Task checklist from tasks jsonb. PASS/NEEDS_ATTENTION/FAIL result on service log. AI suggest via new `api/pmi/suggest.ts` (Claude Sonnet 4.6, text-only). Build clean. ⚠️ David must run `20260613_business_service_log_result.sql` + verify in browser. See resolved gap entry below. |
| ~~Business Service Log UI~~ | ~~Cultivar OS~~ | ✅ **WIRED 2026-06-13:** PMI.tsx handleLogService() writes to `business_service_log`. See PMI module row above. |
| ~~Business PMI Schedule UI~~ | ~~Cultivar OS~~ | ✅ **WIRED 2026-06-13:** PMI.tsx reads/writes `business_pmi_schedule` (INSERT on add, UPDATE last_service_at on log, UPSERT tasks on AI suggest). See PMI module row above. |
| Onboarding wizard (shared) | Shared | Two separate OnboardingWizard implementations (Ignition + Cultivar). Extract WizardShell to shared before Conduit OS. |
| Trial clock enforcement | Cultivar OS | Seam exists in useModules.ts line 100 (`nurseryPlan = 'starter'`). No blur, no Stripe. |
| Delivery address persistence | Cultivar OS | DeliveryRoute.tsx shows inline address override but does not persist it. Needs `delivery_address` column on `orders` and capture at checkout for delivery transport. |
| Delivery date scheduling | Cultivar OS | No `delivery_date` on orders. Route shows all pending with no date filtering. |
| Per-plant install price edit | Cultivar OS | `plants.install_price` DROPPED 2026-06-13 (THUNDER UNTANGLE — stock fact). Install pricing moves to service_offerings. Post-demo. |
| ~~Tighten nursery_modules RLS~~ | ~~Cultivar OS~~ | ✅ RESOLVED 2026-06-04: `business_modules` created with membership-scoped RLS (`business_members.user_id = auth.uid() AND active = true`). `authenticated_select_nursery_modules` (loose) retired. |
| Port ai_router.py to Vercel functions | Ignition OS | Railway is legacy for web build. Agreed kill path: retire orphaned tasks (invoice_scan, vin_decode), port real tasks (dtc_decode, estimate_draft first). (Tech Debt #12) |
| ~~Receipt storage~~ | ~~All verticals~~ | ✅ RESOLVED 2026-06-11: `receipts` table + bucket built, Receipt Keeper v1 = WORKS (McCoy's live test). See Receipt / Expense Storage section above. |
| Expense / Cost-Profile storage | All verticals | `expenses` + `cost_profile` tables do not exist. No migration. Receipt Keeper v2 + Cost-to-Produce tile scope. |
| ~~Margin Engine (shared — real)~~ | ~~All verticals~~ | ✅ BUILT 2026-06-10 — `packages/shared/src/business-logic/MarginEngine.ts`. 5 old impls marked 🔴. Callers migrate via checklist. |
| QB payables wiring | Cultivar OS → all | QB can write expenses (Purchase/Bill), archive receipt images (Attachable), query Chart of Accounts. None wired today. Receipt Keeper v2 scope. |
| Stage-cost ladder ↔ accumulator mapping | Cultivar OS (LAWNS inventory) | UNVERIFIED, gates LAWNS inventory. High-confidence (David) but unproven; verification owed before any grower-stage capability builds on the accumulator. See full entry under Business Asset Layer / Core-1 Node Model (**remaining:**) — single-sourced there, not duplicated here. |
| ~~Proactive QB reconnect detection~~ | ~~Cultivar OS~~ | ✅ RESOLVED 2026-06-08 — `qbo/status.ts` now checks token expiry on load, attempts silent refresh, surfaces banner proactively. Tech Debt #15 closed. STD-007 added. |
| ~~Gemini vision pipeline (proven on Vercel)~~ | ~~Ignition OS, shared~~ | ✅ RESOLVED 2026-06-11: Receipt Keeper v1 `api/receipts/ocr.ts` is the confirmed first Vercel → Gemini vision pipeline. Live test: provider=gemini, 3-4s, 5 line items structured. VIN OCR (Ignition) remains a placeholder — still unresolved for Ignition. |

## ✅ Resolved Gaps (previously listed as Not Yet Built)

| Capability | Resolved | How |
|---|---|---|
| Signup → nursery row creation | 2026-05-29 | OnboardingWizard (Cultivar OS) creates `businesses` + `nursery_profiles` rows on finalize(). New accounts redirect to /onboarding. |
| Settings page (Cultivar OS) | 2026-05-29 + 2026-06-02 | Settings.tsx built with NurserySection, AccountingSection, SalesPromptsSection, TeamSection. Permission gate added 2026-06-02. |
| Delivery routing (Cultivar OS) | 2026-05-29 | DeliveryRoute.tsx at /deliveries. Multi-stop Google Maps URL, SMS-to-driver. |
| Multi-tenant member login | 2026-06-02 | BusinessProvider two-path resolution. Members land on Dashboard, not "Account not linked" wall. |
| Cross-vertical member isolation | 2026-06-04 | BusinessProvider member path now filters by `business_type` post-fetch (commit 8792c71). |
| Abstract asset model / Business Asset Layer | 2026-06-12 | `business_assets` + `business_inventory` + `business_pmi_schedule` + `business_service_log` tables applied to bgobkjcopcxusjsetfob. `cost_confidence` enum. BusinessAssets.tsx + BusinessInventory.tsx WIRED (commit b924800). AC-1 clean. Surface Honesty: cost_confidence defaults ESTIMATED for manual entry; CONFIRMED requires receipt link. COUNT-ONCE dedup seam: `business_inventory.receipt_id` + `business_service_log.receipt_id` FKs→receipts. |
| PMI module rewired + AI suggest endpoint | 2026-06-13 | `packages/shared/src/modules/PMI.tsx` rewired off dead `pmi_assets`/`pmi_service_logs` onto 3 live tables. barcode_id in add form. Task checklist from `business_pmi_schedule.tasks` jsonb. Inspection result PASS/NEEDS_ATTENTION/FAIL on service log (requires 20260613 migration). `api/pmi/suggest.ts` (Claude Sonnet 4.6, text-only, proven receipts/ocr.ts gateway pattern). Build clean 2187 modules. Zero dead-table refs (grep verified). ⚠️ **David must:** (1) run `20260613_business_service_log_result.sql`; (2) navigate `/pmi` and verify in browser; (3) confirm Vercel function count / upgrade to Pro for 13th function. |

---

## 📋 Specifications and User Stories

Working product specifications describing intended behavior. These are design intent, not built features. When a spec is implemented, update this entry and the spec document with implementation notes.

| Document | Covers | Status |
|---|---|---|
| [docs/user-stories/cultivar-flows-and-contractor-program-2026-06-03.md](user-stories/cultivar-flows-and-contractor-program-2026-06-03.md) | Delivery module config, contractor onboarding/tiers, online customer purchase flow, in-person LAWNS QR flow, delivery routing intelligence | 2026-06-03 — working spec, not yet implemented |

---

## 📂 Discovery Documents

Quantitative, citable research artifacts. Used in sales conversations, product development, and investor context.

| Document | Subject | Key finding |
|---|---|---|
| [docs/discovery/conduit-margin-evidence-2026-06-03.md](discovery/conduit-margin-evidence-2026-06-03.md) | Contractor markup analysis — Liberty Hill masonry project (Capital Land Design vs. actual) | 3.3× average materials markup; 57% savings ($2,629 on $4,651 quote); first documented data point for Conduit margin intelligence thesis |
| [docs/discovery/onboarding-flow-findings-2026-06-03.md](discovery/onboarding-flow-findings-2026-06-03.md) | Real user testing of Ignition OS and Cultivar OS new-owner signup flows | Critical: Ignition blocked by missing shop_members table. High: Cultivar TeamSection not visible, signup form missing owner data. Navigation/onboarding shape inconsistencies between verticals. |

---

## ⚠️ NEEDS DAVID'S CALL

Entries where the correct Vertical or Type tag is ambiguous. Best guess noted.

| Entry | Ambiguity | Best guess |
|---|---|---|
| **Subscription Tiers + Pricing** | Currently documented from Ignition/CAI perspective. Question: does the STARTER/PROFESSIONAL/PREMIER tier structure apply platform-wide, or does each vertical have its own pricing model? Cultivar currently uses a flat $149/mo founding rate. | If platform-wide → `Vertical: shared`. If Ignition-only → `Vertical: ignition`. Tagged `ignition` for now. |
| **AdminSubscription / Marketplace UI** | Is this a dashboard tile in the Ignition OmniDashboard tile grid, or is it reached via an admin/settings navigation separate from the tile grid? | If it appears in the tile grid → `Type: tile`. If admin nav → `Type: capability`. Tagged `capability` for now. |
| **CoolRunnings** | This entry is a reference pointer to a separate repo, not a built capability inside trace-platform. No Vertical/Type classification is meaningful. | Could be removed from this inventory (it's not in this repo) or kept as a cross-reference note. Tagged `N/A` for now. |
| **DataBridge — promote or keep local** | This doc says localStorage-first wrapper intentionally not shared. Bootstrap spec says offline-sync engine, promote. These are opposite post-demo jobs. ~45-file footprint confirmed; function and promote decision are not. RBAC enforcement entangled inside DataBridge (grep confirmed co-location). | Read ~30 lines of `DataBridge.js` to settle the function question. David decides promote vs. keep-local. Until resolved: treat as Ignition-only, do not open for RBAC extraction or shared promotion. |

---

*TRACE Enterprises · Built Inventory · Created 2026-05-28 · Audit-reconciled 2026-06-05*  
*Update this document when something new is confirmed built or confirmed missing.*
