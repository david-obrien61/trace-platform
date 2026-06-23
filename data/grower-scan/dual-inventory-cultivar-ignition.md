# Dual Deep Inventory — Cultivar + Ignition (deployed reality)

**Author:** Thunder (Claude Code) · **Date:** 2026-06-23 · **Mode:** READ-ONLY recon, both repos + both Supabase projects · multi-pass
**Purpose:** (1) seed the tile registry HONESTLY from deployed reality (the module grid is lossy — it missed PMI/assets); (2) give David an equal-depth view of both projects to decide what reconnects Ignition to the platform spine. **Facts here; verdicts are David's. No promote/rebuild/discard column.**

## Method & evidence basis (read this first — it bounds every claim below)

Enumerated from **deployed reality**, not curated lists:
- **Cultivar** (`bgobkjcopcxusjsetfob`): router (`packages/cultivar-os/src/router.tsx`) walked route-by-route + **live DB probed with the service key** (full row visibility). Every "data?" claim is a live count/sample.
- **Ignition** (`ufsgqckbxdtwviqjjtos`): `CoreApp.jsx`/`App.js`/`modules/` walked + migrations read + **live DB probed with the ANON key only** (no service key available locally). Anon sees row counts on the 16 PILOT-OPEN (`USING(true)`) tables; tables under scoped RLS return `null` (can't distinguish "exists-but-RLS-blocked" from "absent" via anon — flagged where it matters).

**⚠️ The single most important deployed-reality fact:** **Ignition's operational tables are EMPTY.** Live anon probe: `shops`=4, `shop_members`=1, `error_events`=9, `feature_events`=2 — and **`jobs`=0, `estimates`=0, `customers`=0, `inventory`=0, `invoices`=0, `evaluations`=0, `dtc_codes`=0, everything else operational = 0.** Ignition is **built + deployed + schema-live but not yet operated** (the "Ignition dry run" in CLAUDE.md has not produced data). So Ignition modules below are **wired-in-code** but **NOT data-proven in deployment** — a different bar than Cultivar, which has real rows in every operational table. I use **WIRED (code-complete, deployment data-empty)** for these rather than PROVEN, because the rubric's PROVEN requires owner-usable + resolving, and there is no operated evidence. This distinction is the spine of the comparison.

Build-state legend: **PROVEN** = wired, route/screen resolves, owner-usable with live data · **WIRED** = code-complete + reachable, but no deployed operational data to prove use (Ignition's norm) · **HALF-BUILT** = code exists, incomplete/stranded/unwired (last-working → first-missing given) · **DESIGNED-ONLY** = scaffold/doc/migration-not-applied · **ORPHANED** = file exists, not imported/mounted · **ABSENT**.

---

# SECTION 1 — CULTIVAR (deployed)

Live businesses in the DB: **TRACE Tree Sales** (nursery), **E's Trees** (nursery), **LAWNS Tree Farm LLC** (nursery, the demo tenant `a1b2c3d4…0001`), **TRACE Enterprises** (general `45830ba7…` — the dogfood tenant where the cost/PMI/asset data lives).

## 1A. Public checkout flow (no auth) — the demo spine

| Capability | Route | State | Backing tables (live data?) | Notes |
|---|---|---|---|---|
| **Plant Profile** | `/plant/:tagId` | PROVEN | `cultivar_plants` (10), `plant_events` (16), `business_inventory` | QR scan → plant profile + growth timeline. Demo-critical, owner-proven. |
| **Add-Ons** | `/plant/:tagId/addons` | PROVEN | service-offerings / `addons` (4) | Netting prompt (red border, pre-checked) — the Regina Rule surface. |
| **Customer Capture** | `/checkout/customer` | PROVEN | `customers` (6) | "No payment now — pay in person / online from invoice" (relabeled 2026-06-19). |
| **Cart Review** | `/checkout/review` | PROVEN | `orders` (pending) | 8.25% TX tax; email-invoice vs pay-at-office. |
| **Confirmation** | `/checkout/confirm` | PROVEN | `orders` (1), `order_items` (1), `order_addons` (1) | QB invoice ref + leakage flag captured. |

## 1B. Authenticated operational

| Capability | Route | State | Entry point | Backing tables (live data?) | Notes / defects |
|---|---|---|---|---|---|
| **Dashboard** | `/dashboard` | PROVEN | root redirect | `businesses` (4), `business_modules` (12), `orders`, `social_drafts` (10) | Renders the "Your Modules" tile grid (see 1F). Leakage alert tile live. |
| **Orders** | `/orders` | PROVEN | tile `qr_checkout` → /orders; header | `orders` (1), `order_items`, `customers`, `cultivar_plants` | Read-only list (no per-order edit/cancel). |
| **Delivery Routing (legacy)** | `/deliveries` | PROVEN | `delivery_routing` tile; DeliverySchedule "Route this day"; footer | `orders` (transport=delivery) + `deliveries` when `?date=` | Builds Google Maps URL; writes nothing. `buildMapsUrl` reused. |
| **Delivery Schedule** | `/delivery-schedule` | PROVEN | `delivery_routing` tile (repointed here) | `deliveries` (1), `customers` | Day-grouped view + service_type badge (planting/delivery_only). OCR→delivery loop closed 2026-06-20. |
| **Receipt Keeper (OCR)** | `/receipts` | PROVEN | **header button (owner only)** — ⚠️ no tile | `receipts` (8) | Invoice-shaped OCR (Gemini→Haiku fallback). "Schedule delivery" toggle live. **Dead-ends at `receipts`** — does NOT spawn a cost_object (the receipt→cost bridge is the named next build). **Mobile-image-intake pattern (see closing).** |
| **Social Setup** | `/social/setup` | PROVEN | `social_media` tile | `business_modules.config`, `social_drafts` (10) | Channel toggles + cadence + Blotato publish. `campaign_posts`=10. |
| **Campaigns** | `/campaigns` · `/campaigns/:id` | HALF-BUILT | dashboard "Campaign Scheduler" | `campaigns` (3), `campaign_posts` (10) | List/detail resolve; **first-missing:** no create/edit/publish UI for campaigns themselves (drafts come from the generate-posts endpoint). |
| **Onboarding Wizard** | `/onboarding` | HALF-BUILT | auto-redirect when no business resolves | `businesses`, `business_modules`, `business_pmi_schedule` | 4-path first-run. Functional but intentionally not a repeatable tile. |
| **Add Business** | `/add-business` | DESIGNED-ONLY | header "Add Business" (owner) | `businesses`, `business_members` (8) | Route+page exist; multi-business creation flow is a stub. |
| **Settings** | `/settings` | PROVEN | header (owner/manage_settings) | `businesses`, `nursery_profiles` (1), `labor_resources` (3), `business_modules.config` | Member mgmt (invite/role), QB connect/disconnect, Cost-to-Produce config (4 blocks), default install price. Labor model (D-12) owner-proven. |

## 1C. Financial / cost surfaces — `PermissionRoute(VIEW_COSTS)`-gated (router.tsx:85)

All five gated at the router AND (per Gate-3) at the DB via `has_permission(business_id,'view_costs')`. **All five are nav-dead from the dashboard grid** — reachable only by URL or via a link inside `/costs` / header. This is the registry gap's financial cluster.

| Capability | Route | State | Backing tables (live data?) | Notes / defects |
|---|---|---|---|---|
| **Cost-to-Produce** | `/costs` | PROVEN | `cost_objects` (21: PROJECT 3 / COST 13 / ASSET 5), `business_modules.config`, `business_inventory` | Flat company pool + by-project tree (Project-Lens) + drill-in to line items. Model B price split (cost-to-serve ÷N vs payback). `cost_to_produce` is enabled for TRACE Enterprises. count-once seam wired + live. |
| **Operating Costs** | `/operating-costs` | PROVEN | `cost_objects` node_type='COST' (13 rows; non-labor) | The recurring-cost HOME (Claude Pro, Gemini, domains, TX tax…). Inline add/edit/delete; recovery-basis controls. Labor excluded structurally. `[TRACE:opcosts]`. |
| **Assets (capital)** | `/assets` | PROVEN | `cost_objects` node_type='ASSET' (5: tractor mahindra, HP ProDesk 600 G6 home server, +3) | Read + inline edit (reassign project, categorize, amount, confidence). No create/delete in UI. **Ported-from-Ignition lineage** (see 1E). |
| **Inventory (materials)** | `/inventory` | PROVEN | `business_inventory` (1 — LAWNS test row) | List + ADD form (sku/qty/unit_cost/confidence/status). No edit of existing rows. `receipt_id` left null ("linked by receipt flow later"). **Mobile-image-intake pattern (closing).** |
| **PMI** | `/pmi` | **HALF-BUILT** | `cost_objects` ASSET (5) + `business_pmi_schedule` (2) + `business_service_log` (1) | **LIVE DATA CONFIRMED:** 2 AI-generated schedules — one against `tractor mahindra`, one against the `HP ProDesk 600 G6 (Home Assistant server)`; service log has a real `Filter Replacement` / "fuel filter replaces" entry. **Ported-from-Ignition** (dark Ignition skin). **Defect → see 1G.** |

## 1D. Internal / demo

| Capability | Route | State | Notes |
|---|---|---|---|
| **QB Invoice Demo** | `/demo/quickbooks-invoice` | DESIGNED-ONLY | Static QB invoice preview, demo fallback. |
| **Discovery Inspect** | `/discovery/inspect` | DESIGNED-ONLY (internal) | David-only; URL is the gate (no auth). Tests discovery/catalog recon. `business_discovery_profiles`=0 (table empty / discovery-catalog migration gated). |
| **Accept Invite** | `/join` | PROVEN (shared) | Member invitation link handling. `business_members`=8. |

## 1E. Ported-from-Ignition surfaces in Cultivar (the category that slipped last time)

The dashboard grid is NOT the index; several capabilities arrived via the shared layer or the Ignition skin and never got a tile:

1. **PMI** (`packages/shared/src/modules/PMI.tsx`) — the KNOWN one. Renders on the Ignition **dark theme** (`#020617` bg, not Cultivar green). The suggest→accept defect (1G) is inherited.
2. **Assets / cost_objects spine** — `/assets` reads the renamed `cost_objects` table (Core-1 rename of `business_assets`, 2026-06-15). The asset node-type model (ASSET/COST/PROJECT/PRODUCT, `asset_type`, `make`/`model`/`serial`) mirrors Ignition's hardware-ledger shape.
3. **AppHeader ← ShopBanner** — the new persistent identity header (2026-06-22) is a **Cultivar-native rebuild of Ignition's ShopBanner** (shape ported, code rewritten; not a skin copy).
4. **MarginEngine** — shared pure calculator; Ignition is the original exemplar, Cultivar's `/costs` feeds the same engine.
5. **QB OAuth router** — shared multi-vertical OAuth (`qbo/router.ts`), not Ignition-specific but common to both.

## 1F. The Dashboard "Your Modules" grid — what it actually renders (the lossy index)

The grid maps over the **`modules` master table** (10 rows) joined to per-business `business_modules`. The 10 master keys:
`business_insights, contractor_tiers, delivery_routing, followup_engine, inventory_intake, online_shop, qb_invoicing, qr_checkout, seasonal_module, social_media`.

Navigable today (state=active → handleNavigate): `qr_checkout`→/orders · `social_media`→/social/setup · `delivery_routing`→/delivery-schedule · `qb_invoicing`→/settings · `cost_to_produce`→/costs (rendered via hardcoded META, **not** in the `modules` master). The rest are "coming soon."

LAWNS tenant enablement: `qr_checkout✓ qb_invoicing✓ social_media✓` + 7 off. TRACE Enterprises: `cost_to_produce✓ social_media✓`.

## 1G. PMI defect — classified

**Classification: HALF-BUILT (stranded accept-flow).** Last-working: asset list + "Suggest Schedule" (Claude Haiku via `api/pmi/suggest`) renders tasks; manual `interval_days` entry creates a schedule row; the service-log form writes `business_service_log` (the live "Filter Replacement" entry proves this path works). First-missing: there is **no review/accept/confirm UI** for an AI suggestion — the suggested `tasks[]` write directly with **no `interval_days` inferred from the suggestion** (Haiku returns task cadences like "quarterly"; the page never extracts them into `interval_days`), and overwriting an existing schedule has no conflict guard. So: the *reader* works and a schedule *can* exist (the 2 live rows prove it), but the suggested-schedule **cannot be reviewed-then-accepted as a first-class action** — it's bug-adjacent half-built, not merely a missing feature. (Cross-ref tech-debt #36: `/assets` + `/pmi` are also nav-dead.)

## 1H. Cultivar serverless API (12 functions — at the Vercel Hobby ceiling, #41)
`campaigns · customers/create (delivery folded in) · dashboard · discovery/ingest (perm-gated) · members/invite · orders/submit · pmi/suggest (Haiku) · qbo/router (+invoice/cultivar) · receipts/ocr (Gemini→Haiku) · social/enable · social/generate-posts (Haiku)`. All service-key server-side except auth flows.

---

# SECTION 2 — IGNITION (deployed)

**Deployment posture:** web build (`main.jsx`→`App.js`→`CoreApp.jsx`), PIN auth (local-first, bypasses Supabase Auth — known AC exception). **DB is operationally empty** (see Method): `shops`=4, `shop_members`=1, `error_events`=9, `feature_events`=2; all job/estimate/invoice/customer/inventory/eval tables = 0. So every operational module below is **WIRED** (code-complete + reachable in the shell) but has **no deployed data proving an owner ran it**. The `.native.js` files are the retired React-Native mobile prototype — noted ORPHANED, not the deployed web reality.

## 2A. Deployed navigation (from CoreApp.jsx)
Bottom nav: `DASHBOARD · INTAKE · ESTIMATES · FLUX · HUB · PORT · OMNI`. Dashboard tile grid mounts ~18 apps (several trial-gated with a blur overlay via TrialGatekeeper).

## 2B. Job lifecycle (the core workflow — INTAKE→EVAL→ESTIMATE→AUTH→REPAIR→INVOICE→CLOSED)

| Capability | Module | State | Backing tables (anon-probe) | AI | Notes |
|---|---|---|---|---|---|
| **Intake** | IgnitionIntake | WIRED | `jobs` (0 rows) | — | Creates a job → routes to FLUX. |
| **Workflow queue** | IgnitionFlux | WIRED | `jobs` (0) | — | Status-filtered job board; DataBridge cloud-sync coupling being phased out (`[TRACE:WORKFLOW]`). |
| **Evaluation** | IgnitionEval | WIRED | `evaluations` (0), `eval_photos` (0) | **VIN decode (Claude Vision), voice transcription, parts extraction** — wired in code | VIN module folded in (standalone `IgnitionVIN.jsx` orphaned). |
| **Estimate** | IgnitionEstimate | WIRED | `estimates` (0), `estimate_line_items` (0) | **draftEstimate** | Line-item pricing → kiosk auth. |
| **Customer auth (kiosk)** | IgnitionKosk | WIRED | `customer_authorizations` (0) | — | Signature/biometric pickup auth. Separate kiosk UI container. |
| **Invoice** | IgnitionInvoice | WIRED | `invoices` (0), `invoice_line_items` (0) | — | Orphaned `delivery_scheduled` notification template (defined, never invoked). |
| **Pricing portal** | IgnitionPort | WIRED | `estimates` (0), `customers` (0) | — | Nav `PORT`; duplicate "Estimates" label with nav ESTIMATES. |
| **Dispatch** | IgnitionHub | WIRED | reads active-job context | — | Google Maps route builder (same shape as Cultivar DeliveryRoute). |

## 2C. Inventory / parts / vendor

| Capability | Module | State | Tables | Notes |
|---|---|---|---|---|
| **Inventory matrix** | IgnitionStok | WIRED (trial-gated) | `inventory` (0) | Stock levels, reorder points; feeds estimate line-item picker. |
| **Vendor / procurement** | IgnitionProc | WIRED (trial-gated) | `purchase_orders` (0) | `IgnitionProcure.jsx` is an ORPHANED alternate variant. |
| **CSV import** | CSVImporter | WIRED-but-unmounted | `customers/jobs/inventory` bulk | Imported but not in nav/grid; admin/mobile-only. |

## 2D. CRM / customer

| Capability | Module | State | Tables | Notes |
|---|---|---|---|---|
| **Client directory** | IgnitionCRM | WIRED (trial+perm `view_crm`) | `customers` (0), `customer_vehicles` (0) | Contacts + vehicle history; auto-populate in intake. |
| **Customer approval** | CustomerApproval / CustomerApprovalPortal | ORPHANED | — | Not imported; redundant with kiosk (Portal would need its own route/auth). |

## 2E. AI / intelligence

| Capability | Module | State | AI engine | Notes |
|---|---|---|---|---|
| **Invoice audit** | IgnitionAudit | WIRED (perm `view_omni`) | `auditInvoice` (Claude Vision) | Upload invoice image → flags missing charges / free fluids / leakage; concept-alias learning → `concept_aliases` (0 rows). |
| **DTC decoder** | IgnitionCipher | **HALF-BUILT / DARK** | `decodeDTC` | **`dtc_codes` table = 0 rows → the 3 working codes (3216, 3251, 157) are HARDCODED IN APP CODE.** Unknown codes call the AI path which is **dark** (`VITE_API_URL` unset; Railway `ai_router.py` legacy path unfinished). `[TRACE:API]` ON. |
| **PMI / predictive** | PredictiveKey | WIRED (trial-gated PREMIER) | `suggestPMI` (Claude Haiku) | **Same engine Cultivar's PMI uses.** Asset modal + inspection logs; no DB writes observed in deployed shell (local state). |
| **Savings report** | IgnitionOmni | DARK | `savingsReport` | Defined in AIEngine; OMNI shows a day-15 "report ready" nudge but the call site is not wired. Trial-gated display. |
| **Voice** | useIgnitionVoice / `.native` | mixed | transcription | Web path wired into Eval; `.native` retired. |

## 2F. Admin / config / lifecycle

| Capability | Module | State | Tables | Notes |
|---|---|---|---|---|
| **Team admin** | IgnitionAdmin | WIRED | `shop_members` (1), `pin_resets` (RLS-null), `shop_invites` (RLS-null) | Enroll/PIN-reset/permissions; sets `onboarding_complete`. The 1 live member is the enrolled owner. |
| **Tooling / custody** | IgnitionTools | WIRED (perm) | `tools` (0), `tool_signout_log` (0) | Hardware/bay custody. |
| **Compliance / legal** | IgnitionCompliance / IgnitionLegal | WIRED | display-only / local | Waiver + terms acceptance. |
| **Subscription / marketplace** | AdminSubscription | WIRED | `system_subscriptions` (DataBridge local; RLS-null) | Module tier selection + trial → feeds TrialGatekeeper blur gates. |
| **Margins** | IgnitionProt | WIRED | `margin_config` (DataBridge local; RLS-null) | Margin tiers (FLEET/LEGACY/FF + slabs) → shared MarginEngine. `[TRACE:MARGIN]`. |
| **Onboarding** | OnboardingWizard | WIRED | `shop_policy.onboarding_complete` | Role→PIN→waiver→enrollment; blocks app until done. |
| **Command center** | IgnitionOmni / IgnitionOmniDashboard | WIRED / ORPHANED | display | OmniDashboard is an orphaned alternate. |

## 2G. Orphaned Ignition files (exist, not wired into the web shell)
`CustomerApproval, CustomerApprovalPortal, IgnitionVIN (folded into Eval), IgnitionHandover, IgnitionOmniDashboard, IgnitionProcure, SlideToComplete`, plus the entire `*.native.js` set (retired RN prototype: CustomerEstimate, CustomerKiosk, IgnitionQueue, InventoryAI, PartsList, TechKeypad, ToolChecklist, TriageOptimizer, IgnitionVendor, IgnitionVoice, etc.).

## 2H. Ignition schema + RLS posture
~21+ tables across the migrations (`supabase_schema`, `_inventory`, `_job_lifecycle`, `_labor_phases`, `_team_system`, `_hardware_ledger`, `_identity_v2`, `_price_override`, `_shop_settings`, `_monitoring_alerts`, `_error_events`, `_feature_events`, `_concept_aliases`, `_rls_pilot`, `20260529_ignition_businesses`, `20260603_recreate_shop_members`). **RLS: 16 tables are PILOT-OPEN `USING(true)`** (anon could count them → all 0 except telemetry) — intentional pre-Phase-1, violates AC-2, "post-demo tighten" (CLAUDE.md §1.5). Scoped: `shop_members` (self+owner), `shops`, `businesses`, `jobs`/`purchase_orders` (business_id). Tables returning `null` to anon (RLS-scoped or absent — unverifiable without service key): `teams, member_devices, pin_resets, shop_invites, hardware_ledger, price_overrides, shop_settings, margin_config, system_subscriptions`.

---

# SECTION 3 — COMPARISON TABLE (facts only — David draws the verdicts)

| capability | Cultivar: state + tables + data? | Ignition: state + tables + data? | shared dependency | notes |
|---|---|---|---|---|
| **Onboarding wizard** | HALF-BUILT · businesses/business_modules · used | WIRED · shop_policy · 1 member onboarded | both have own OnboardingWizard (not shared) | two separate implementations |
| **Identity / member mgmt** | PROVEN · businesses(4)/business_members(8) · real | WIRED · shop_members(1) · 1 row | AppHeader←ShopBanner shape | Cultivar = Supabase Auth + RLS; Ignition = PIN local-first |
| **Job/order intake** | PROVEN · orders(1)/order_items · real (QR checkout) | WIRED · jobs(0) · empty | — | different domains (retail checkout vs repair order) but same "intake→record" shape |
| **Workflow/queue board** | partial (Orders list, read-only) | WIRED · jobs(0) · empty (IgnitionFlux) | — | Ignition has the richer status-machine; Cultivar has none |
| **Estimate generation** | ABSENT | WIRED · estimates(0) · empty · AI draftEstimate | MarginEngine (shared) | Ignition-only capability |
| **Customer auth / signature** | ABSENT (checkout takes no payment) | WIRED · customer_authorizations(0) · IgnitionKosk | — | Ignition-only |
| **Invoicing (QB)** | PROVEN · orders.qb_invoice_id · real, owner-proven | WIRED · invoices(0) · empty | qbo/router + MarginEngine (shared) | shared QB OAuth; Cultivar live, Ignition unrun |
| **Inventory** | PROVEN · business_inventory(1) · 1 test row | WIRED · inventory(0) · empty (IgnitionStok) | — | both list+add; Cultivar has image-intake stub, Ignition has reorder points |
| **Assets / capital** | PROVEN · cost_objects ASSET(5) · real (tractor, server) | WIRED · hardware_ledger(RLS-null) · unverified | cost_objects ↔ hardware-ledger shape | Cultivar's `/assets` is the ported descendant of Ignition's hardware ledger |
| **PMI / preventive maint.** | HALF-BUILT · business_pmi_schedule(2)+service_log(1) · **real data** | WIRED · local state · empty (PredictiveKey) | **`suggestPMI` (Claude Haiku) — SHARED engine** | same AI; **Cultivar has the live data, Ignition has the richer UI**; both lack accept-flow |
| **Vendor / procurement** | ABSENT | WIRED · purchase_orders(0) · empty (IgnitionProc) | — | Ignition-only |
| **CRM / customer directory** | partial (customers(6) via checkout) | WIRED · customers(0)/customer_vehicles(0) · empty (IgnitionCRM) | — | Ignition has dedicated CRM; Cultivar accretes customers from orders |
| **Cost-to-produce / margin** | PROVEN · cost_objects(21)/labor_resources(3) · real, owner-proven | WIRED · margin_config(local) · IgnitionProt | **MarginEngine (shared)** | Cultivar has the full cost spine (Model B); Ignition has margin tiers only |
| **Operating costs (recurring)** | PROVEN · cost_objects COST(13) · real | partial (margin/shop_settings) | — | Cultivar-only as a dedicated surface |
| **Receipt/invoice OCR** | PROVEN · receipts(8) · real (Gemini→Haiku) | — | — | Cultivar-only; Ignition's IgnitionAudit is the invoice-image analog |
| **Invoice/document audit (AI)** | ABSENT | WIRED · concept_aliases(0) · Claude Vision (IgnitionAudit) | AIEngine | Ignition-only; conceptually adjacent to Cultivar's leakage flag |
| **VIN decode (AI Vision)** | ABSENT | WIRED · evaluations(0) · Claude Vision | AIEngine | Ignition-only |
| **DTC code decode (AI)** | ABSENT | HALF-BUILT/DARK · dtc_codes(0, hardcoded) | AIEngine (dark path) | Ignition-only; 3 codes hardcoded, AI path dark |
| **Delivery routing** | PROVEN · deliveries(1)+orders · real (Maps URL) | WIRED · IgnitionHub (Maps URL) | buildMapsUrl shape | near-identical route-builder shape both sides |
| **Social media** | PROVEN · social_drafts(10)/campaign_posts(10) · real (Blotato) | ABSENT | — | Cultivar-only |
| **Subscription / trial gating** | DESIGNED (Role Machine seeded, stripe not built) | WIRED · system_subscriptions(local) · TrialGatekeeper | trial clock (shared roadmap) | Ignition has a working blur-gate; Cultivar's is doctrine-only |
| **Margin engine (calc)** | PROVEN (feeds /costs) | WIRED (feeds IgnitionProt) | **MarginEngine.js (SHARED)** | the one already-shared business-logic core |
| **Tooling / custody** | ABSENT | WIRED · tools(0)/tool_signout_log(0) | — | Ignition-only |
| **Compliance / legal waiver** | static /terms /privacy | WIRED · IgnitionCompliance | — | Ignition has an interactive waiver flow |
| **Savings report (AI)** | partial (leakage tile) | DARK · savingsReport defined, uncalled | AIEngine | both gesture at it; neither fully live |
| **RLS / tenant isolation** | PROVEN · business_id + has_permission · enforced | PILOT-OPEN · 16 tables USING(true) | AC-2/AC-3 doctrine | the sharpest divergence: Cultivar enforces, Ignition is open |

---

# CLOSING LISTS

## A. Registry-gap list (Cultivar capabilities with route + live data that the module grid MISSED)
The `modules` master table has 10 keys; these have a resolving route **and live data** but are **not in that index**, so the Dashboard grid can never surface them:

1. **PMI** (`/pmi`) — `business_pmi_schedule`=2 + `business_service_log`=1 (real tractor/server schedules). Not in `modules` master, not a `business_modules` key → URL-only.
2. **Assets** (`/assets`) — `cost_objects` ASSET=5 (real). Not a module → reachable via `/costs` drill-in or URL.
3. **Operating Costs** (`/operating-costs`) — `cost_objects` COST=13 (real). Not a module → link from `/costs` only.
4. **Receipt Keeper** (`/receipts`) — `receipts`=8 (real). Not in `modules` master → owner header-button only, no tile.
5. **Cost-to-Produce** (`/costs`) — enabled in `business_modules` for TRACE Enterprises **but absent from the `modules` master table** → renders only via hardcoded `MODULE_META`, an index inconsistency to ratify.
6. **Inventory ambiguity** — `inventory_intake` IS in the master (Camera icon "Inventory") but is the *image-intake* concept; the live `/inventory` (BusinessInventory) page is a different surface. Decide whether they unify or are two registry entries.

→ These 6 are the honest seed for the tile registry. The grid was never the index; the router + `cost_objects` node-types + `business_*` tables are.

## B. Mobile-image-intake pattern (observe only)
Three surfaces are **instances of one shape — mobile + image-capture + estimated-cost**, and should not be built three different ways:
- **`receipt_keeper`** (`/receipts`) — camera→OCR→`receipts`, invoice/receipt shape, Gemini→Haiku, confidence-tagged. The most complete instance.
- **`inventory_intake`** (master key; `/inventory` ADD form) — currently manual; `receipt_id` deliberately left null "for the receipt flow later" → it is *waiting* for this pattern.
- **assets-intake** (Andrew is building this per handoff) — capital capture into `cost_objects` ASSET; same camera→extract→estimated-cost→confidence shape.
Ignition's **IgnitionAudit** (invoice-image→Claude Vision→concept extraction) and **IgnitionEval** (VIN photo→Vision) are the donor instances of the same shape on the repair side. One shared "image → AI-extract → confidence-flagged cost/record" primitive would serve all five. **Observation only — not a recommendation to build.**

---

## Summary
- **Cultivar:** ~28 capabilities across public-checkout / operational / financial / config / internal. Operationally LIVE (real rows in orders, plants, receipts, cost_objects(21), PMI, deliveries, social). 1 confirmed half-built defect (PMI accept-flow).
- **Ignition:** ~24 wired modules + 7 orphaned files + the retired `.native` set. Code-complete shell with the richer repair workflow + 6 AI features, but **deployment is operationally EMPTY** (shops=4, shop_members=1, telemetry only; all job/estimate/invoice/customer/inventory tables = 0); DTC AI path dark, RLS pilot-open.
- **Registry-gap items found:** 6 (PMI, assets, operating-costs, receipts, cost-to-produce index inconsistency, inventory_intake-vs-/inventory).
- **PMI defect:** HALF-BUILT — stranded accept-flow (reader + manual schedule work and have live data; AI suggestion can't be reviewed-then-accepted and never infers `interval_days`). Shared root with Ignition's PredictiveKey (same Haiku engine).
- **Shared spine today:** only MarginEngine + QB OAuth + the AppHeader/PMI shapes. The comparison table marks every capability's shared-dependency column so David can see where reconnection is cheap (shared engine already exists) vs net-new.

*Read-only recon. Facts from Thunder; verdicts from David. [TRACE:*] stays ON.*
