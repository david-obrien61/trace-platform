# Ignition OS — Reality Audit
**Date:** 2026-06-09  
**Type:** Read-only catalogue. No code changes, no builds this session.  
**Scope:** All .jsx/.js files in `packages/ignition-os/` (root + modules/ + hooks/)  
**Standard:** STD-010 (opaque name = debt; discovered build = must be catalogued)  
**Purpose:** docs/built-inventory.md was silent on all 30+ Ignition modules. This document establishes ground truth.

---

## STEP 1 — MODULE INVENTORY

### Legend

| Status | Meaning |
|--------|---------|
| BUILT-AND-WIRED | Works end-to-end in web production |
| BUILT-BUT-ORPHANED | Code exists; not connected / state lost / config mismatch |
| BUILT-BUT-DARK | Works but depends on Railway / VITE_API_URL (unset in Vercel prod) → silently returns `{ok:false}` |
| MOBILE-ONLY | Uses React Native; no web equivalent |
| DESIGNED-NEVER-BUILT | Referenced but absent or is an empty stub |

---

### Root-Level Files

#### `CoreApp.jsx` — Master Session Controller
**What it does:** PIN login, session routing, module-grid navigation, AccessGatekeeper (permission checks), TrialGatekeeper (subscription blur), ShopBanner. Routes to 19 modules. Contains sub-flows: ForgotPinFlow, JoinFlow, EnrollmentGate, IdentityMatrix.

**Status:** BUILT-AND-WIRED — except two sub-flows are BROKEN:
- `ForgotPinFlow` queries Supabase `pin_resets` table → **BROKEN** (table dropped 2026-06-02 by `20260602_ignition_drop_team_tables.sql`; NOT recreated)
- `JoinFlow` queries Supabase `shop_invites` table → **BROKEN** (same drop migration; NOT recreated)
- `EnrollmentGate` uses DataBridge `pending_users`/`users_table` → ORPHANED pattern (old mobile enrollment flow)

**Reads:** DataBridge `current_user`, `shop_policy`, `shop_info`, `system_subscriptions`. Supabase `shops`, `shop_members`, `businesses`, `pin_resets` (BROKEN), `shop_invites` (BROKEN).  
**Writes:** DataBridge `current_user`. Supabase `shops` (name seed), `shop_members` (pin_hash update).

**Workflow position:** Session gate — every module flows through here.

---

#### `DataBridge.js` — Local-First Data Layer
**What it does:** Central localStorage key-value store (`IGNITION_OS_DATA`). Fallback layer for all data. Canonical schema for ~20 keys. Supabase `db.*` async methods (never called directly by most modules — modules import DataBridge and call load/save). Tracks `API_URL` (set via `VITE_API_URL` — unset in Vercel prod).

**Status:** BUILT-AND-WIRED for localStorage. `pullCloudSync`/`pushCloudSync` fall back to FastAPI `${API_URL}/api/jobs` — DARK in production.

**Reads:** localStorage `IGNITION_OS_DATA`, IGNITION_SHOP_ID, IGNITION_SHOP_NAME.  
**Writes:** All of the above. Supabase: `feature_events`, `error_events`, `member_devices` (BROKEN — table dropped), `shop_members` (auth).

**Workflow position:** Infrastructure — underlies every module.

---

#### `MarginEngine.js` — Full Pricing Engine
**What it does:** 4-slab pricing (Consumables/Mid-Range/Heavy/Major), tier discounts (FLEET −10%, LEGACY −20%, FF −5%), `analyzeTransaction()` (suggested vs actual → leakage). Reads active slab config from DataBridge `margin_config`.

**Status:** BUILT-AND-WIRED (Ignition-local). NOTE: `packages/shared/src/business-logic/marginEngine.ts` is a 17-line stub that does NOT implement this logic (Tech Debt #16). The full engine lives here.

**Reads:** DataBridge `margin_config` (falls to DEFAULT_MARGIN_CONFIG if unset).  
**Writes:** Nothing — pure calculation.

**Workflow position:** Infrastructure — used by IgnitionEstimate, IgnitionPort, IgnitionProcure, IgnitionProt.

---

#### `ExternalBridge.js` — QB OAuth + CSV Import
**What it does:** QuickBooks OAuth initiation (opens popup → polls `${API_URL}/api/qbo/auth-url`) and CSV import parser (client-side, maps columns to customer fields, imports to DataBridge).

**Status:** BUILT-BUT-DARK for QB (API_URL unset). BUILT-AND-WIRED for CSV import (pure client-side).

**Reads:** DataBridge `external_connections`.  
**Writes:** DataBridge `external_connections` (QB connection state), `customers_directory` (CSV import). API calls to `${API_URL}` (DARK).

**Workflow position:** Support — QB integration (dark); customer data migration (CSV import works).

---

#### `IgnitionCore.js` — Web Session Guard + Sub-Router
**What it does:** 5-minute idle auto-lock (clears `current_user`, reloads). Sub-routes to IgnitionOmniDashboard, IgnitionKosk, IgnitionPort, OnboardingWizard based on role/context.

**Status:** BUILT-AND-WIRED.

**Reads:** DataBridge `shop_policy` (autoLockEnabled).  
**Writes:** DataBridge `current_user` (null on timeout).

**Workflow position:** Session infrastructure — wraps Kiosk/OMNI/Port sub-modes.

---

#### `OnboardingWizard.jsx` (root level) — ORPHANED DUPLICATE
**What it does:** Old enrollment flow using DataBridge `pending_users`/`users_table` enrollment token pattern. Creates `shops` row. Partially duplicates `modules/OnboardingWizard.jsx`.

**Status:** BUILT-BUT-ORPHANED. Not in CoreApp's routing. `modules/OnboardingWizard.jsx` is the canonical version.

**Workflow position:** Not in active flow.

---

#### `EnrollmentCatch.jsx` — Enrollment Token Handler
**What it does:** Catches `?enroll=TOKEN` query param, validates token against DataBridge `pending_users`, routes to PIN setup.

**Status:** BUILT-BUT-ORPHANED. Uses old DataBridge pending_users pattern; IgnitionAdmin.jsx now generates enrollment links but the receiver (this file) is wired to the legacy flow. IgnitionCore.js imports it, so it's connected but the underlying data model is legacy.

**Reads:** DataBridge `pending_users`.  
**Writes:** DataBridge `users_table`.

**Workflow position:** Staff onboarding (old pattern).

---

#### `PriceField.jsx` — Part Pricing Widget
**What it does:** Inline pricing component for estimate line items. Shows wholesale cost → retail price with MarginEngine markup. Tracks leakage when tech enters lower price.

**Status:** BUILT-AND-WIRED. Used inside IgnitionEstimate.

**Reads:** DataBridge (via MarginEngine).  
**Writes:** DataBridge `transaction_history` (leakage tracking).

**Workflow position:** Step 5 sub-component (Estimate build).

---

#### `App.js` — Mobile-Era Entry Point
**What it does:** Original React Native entry. Loads AsyncStorage, hydrates DataBridge, renders app shell.

**Status:** BUILT-BUT-ORPHANED. `main.jsx` is the web entry; this file is the mobile entry that no longer has a build target.

**Workflow position:** Not in web flow.

---

### modules/ — Business Modules

#### `IgnitionIntake.jsx` — New Repair Order Creation
**STD-010:** Name is clear. No rename needed.

**What it does:** Three-phase wizard: Customer lookup/create → Vehicle lookup/create → Job details (complaint, mileage, promised date, wait/drop). Creates the RO that all other modules operate on.

**Status:** BUILT-AND-WIRED.

**Reads:** Supabase `customers` (search), `customer_vehicles` (load existing). DataBridge `current_user`, `shop_info` (for shopId).  
**Writes:** Supabase `customers` (insert), `customer_vehicles` (insert or mileage update), `jobs` (insert with snapshots).

**Workflow position:** Step 1 — creates the RO.

---

#### `IgnitionFlux.jsx` — RO Queue / Workflow Board
**STD-010:** FLUX = Workflow queue. Opaque name — STD-010 naming debt candidate. Decoded: "Repair Order Status Board."

**What it does:** Live queue of all open ROs. Status-based routing: routes job to EVAL (new), ESTIMATES (eval done), Kiosk (authorized/in-repair), INVOICE (done). Central navigation hub.

**Status:** BUILT-AND-WIRED.

**Reads:** Supabase `jobs` (filtered by shop_id, ordered by updated_at).  
**Writes:** None (navigation only).

**Workflow position:** Step 2 — RO queue and central navigation.

---

#### `IgnitionEval.jsx` — Tech Evaluation Station
**What it does:** Tech performs the vehicle inspection. Clock-in/out tracking, tech notes, DTC code entry, work item documentation, photo capture (requires Supabase storage setup). Opens IgnitionVIN for VIN scan.

**Status:** BUILT-AND-WIRED (Supabase writes confirmed). Photo upload: likely AMBIGUOUS — requires Supabase Storage bucket configured in `ufsgqckbxdtwviqjjtos` project; not confirmed.

**Reads:** Supabase `evaluations` (existing draft), `labor_entries` (existing clock-in). DataBridge `current_user`, `shop_info`.  
**Writes:** Supabase `evaluations` (create/update), `dtc_codes` (insert per code), `eval_photos` (insert — storage-dependent), `labor_entries` (clock in/out).

**Workflow position:** Step 3 — tech evaluation after RO opens.

---

#### `IgnitionEstimate.jsx` — Service Writer Estimate Station
**What it does:** Full estimate editor. Reads evaluation data, populates line items (LABOR, PART, SUBLET, FEE, MISC), sends to customer for authorization. Contains CustomerApprovalPortal overlay for in-person sign-off.

**Status:** BUILT-BUT-DARK — two Railway calls are dead:
1. `POST ${API_URL}/api/estimate/build` — AI estimate skeleton from evaluation data (DARK)
2. `POST ${API_URL}/api/jobs/${id}/generate-pos` — auto-PO generation after authorization (DARK)

Manual estimate editing (add/edit/delete line items) and customer authorization work end-to-end.

**Reads:** Supabase `jobs`, `estimates`, `estimate_line_items`, `evaluations`. DataBridge (labor rate via `getSystemRates()`).  
**Writes:** Supabase `estimates`, `estimate_line_items`. Updates `jobs.status`.

**Workflow position:** Steps 5–7 — estimate build, pricing, customer authorization.

---

#### `IgnitionInvoice.jsx` — Invoice Creation + Payment
**What it does:** Converts authorized estimate to invoice. Selects payment method (CARD/CHECK/CASH/ACCOUNT), records mileage-out, creates invoice and line items. Shows print/PDF stub (button exists, no PDF generation implemented).

**Status:** BUILT-AND-WIRED.

**Reads:** Supabase `jobs` (authorized/in_repair/repair_done), `estimates`, `estimate_line_items`, `invoices` (existing check), `invoice_line_items`.  
**Writes:** Supabase `invoices`, `invoice_line_items`. Updates `jobs.status`.

**Workflow position:** Step 9 — final invoice and payment collection.

---

#### `IgnitionHub.jsx` — Dispatch / Fleet Tracking
**STD-010:** HUB = Dispatch hub. Mildly opaque — STD-010 naming debt candidate. Decoded: "Fleet Dispatch Board."

**What it does:** Live fleet/job map with simulated GPS positions. Shows all jobs with tech assignments and status. GPS positions are randomly generated near a hardcoded center (`randomNearby()`) — not real telematics.

**Status:** BUILT-BUT-ORPHANED. Reads DataBridge exclusively (no Supabase). GPS is simulated. `DataBridge.getFleetUnits()` returns whatever was saved by `DataBridge.saveFleetUnit()` — no module in the web build populates fleet_units from real telematics.

**Reads:** DataBridge `active_jobs` (via `getJobs()`), `user_profiles` (via `getProfiles()`), `fleet_units` (via `getFleetUnits()`).  
**Writes:** None.

**Workflow position:** Parallel — dispatch visibility. Disconnected from live data.

---

#### `IgnitionCipher.jsx` — DTC Code Decoder
**STD-010:** CIPHER/CODE — doubly opaque (file is "Cipher", UI label is "CODE"). STD-010 naming debt candidate. Decoded: "DTC Fault Code Decoder."

**What it does:** Translates DTC/SPN fault codes into repair context (parts list, labor hours, cost estimate). Local library covers exactly 3 codes (3216, 3251, 157). All other codes use `AIEngine.decodeDTC()` — DARK.

**Status:** BUILT-BUT-DARK. Local 3-code lookup works; AI decode for all other codes silently fails (`{ok:false}`).

**Reads:** DataBridge `current_user`, `getSystemRates()`, `getActiveMargin()`. Local fault library (hardcoded).  
**Writes:** None. Uses `onNavigateToStok` prop to open STOK with fault code pre-filled.

**Workflow position:** Step 4 support — DTC decode before/during evaluation.

---

#### `IgnitionStok.jsx` — Inventory Management
**STD-010:** STOK = Stock. Opaque — STD-010 naming debt candidate. Decoded: "Parts Inventory."

**What it does:** Shows shop inventory with part name, part number, quantity, bin location, cost. Search by name, part number, or fault code. Trial-gated (bin location + cost blurred if expired).

**Status:** BUILT-AND-WIRED.

**Reads:** Supabase `inventory` (filtered by shop_id). DataBridge `current_user` (for shop_id fallback).  
**Writes:** None (read-only view).

**Workflow position:** Support — parts lookup during estimate building. Navigated to from IgnitionCipher.

---

#### `IgnitionProt.jsx` — Financial Settings / Margin Config
**STD-010:** PROT = Protection (margins protect shop profit). Opaque — STD-010 naming debt candidate. Decoded: "Margin & Pricing Configuration."

**What it does:** Configures labor rates (base, overtime, diagnostic), margin slabs (the 4-tier multiplier table), tier discounts (FLEET/LEGACY/FF), and operational overhead (rent, electric, fuel, maintenance). Trial-gated.

**Status:** BUILT-AND-WIRED for DataBridge persistence. No Supabase writes. Confirms Tech Debt #16: overhead IS captured here but `calculateRetail()` ignores `prot_matrix`.

**Reads:** DataBridge `getSystemRates()`, `getMarginMatrix()`, `getOperationalCosts()`.  
**Writes:** DataBridge `setSystemRates()`, `setMarginMatrix()`, `setOperationalCosts()`. Logs changes to DataBridge `margin_change_log`.

**Workflow position:** Admin config — sets pricing parameters for all modules.

---

#### `IgnitionProc.jsx` — Vendor Directory
**STD-010:** PROC = Procurement. Mildly opaque — STD-010 naming debt candidate. Decoded: "Vendor Directory."

**What it does:** Shows approved vendor list (name, address, phone, account number, priority). Allows adding new vendors. "Initialize Purchase Order" button is a stub (no action). Trial-gated.

**Status:** BUILT-AND-WIRED (DataBridge-only). Purchase Order button stub is DESIGNED-NEVER-BUILT.

**Reads:** DataBridge `vendor_directory` (via `getVendors()`).  
**Writes:** DataBridge `vendor_directory` (via `addVendor()`).

**Workflow position:** Step 6 support — vendor lookup when sourcing parts.

---

#### `IgnitionProcure.jsx` — Parts Entry for Active Job
**What it does:** Form for adding a specific part (part number, vendor, wholesale cost, core charge) to the active job's `active_job_context.inventory.specialized`. Calculates retail via MarginEngine. Tracks core charges with UNRETURNED status.

**Status:** BUILT-BUT-ORPHANED. Not in CoreApp's module routing. Appears as a sub-component that can be invoked from IgnitionPort, but IgnitionPort doesn't import it — only IgnitionEstimate has PriceField. IgnitionProcure is a standalone component with no current caller in the web build.

**Reads:** DataBridge `active_job_context`.  
**Writes:** DataBridge `active_job_context` (adds to inventory.specialized).

**Workflow position:** Step 7 (parts entry) — ORPHANED.

---

#### `IgnitionCRM.jsx` — Customer Directory
**What it does:** Customer database with search, customer cards (name, phone, tier, vehicles), and new customer form. Trial-gated. Stores in DataBridge — NOT the same data store as Supabase `customers` (written by IgnitionIntake).

**Status:** BUILT-AND-WIRED (DataBridge-only). SPLIT-BRAIN: IgnitionIntake writes customers to Supabase `customers`; IgnitionCRM reads from DataBridge `customers_directory`. Customers created via Intake do NOT appear in CRM and vice versa.

**Reads:** DataBridge `customers_directory` (via `getCustomers()`).  
**Writes:** DataBridge `customers_directory` (via `addCustomer()`).

**Workflow position:** Standalone — CRM view. Not connected to RO workflow data.

---

#### `IgnitionCompliance.jsx` — 24-Point DOT Inspection
**What it does:** FMCSA-mandated pre-trip / inspection form. 24 items with PASS/FAIL/N/A status. FAIL requires either a photo or written notes (hard-stop enforcement). Submits via `DataBridge.smartSync('SUBMIT_PMI', payload)`. Photo capture is an `alert()` stub (no real camera).

**Status:** BUILT-AND-WIRED for form logic. Photo capture: DESIGNED-NEVER-BUILT (stub alert only). `smartSync` falls to offline queue (API_URL unset).

**Reads:** DataBridge `shop_info`, `current_user`.  
**Writes:** DataBridge sync queue (smartSync — never reaches backend in production).

**Workflow position:** Pre-release compliance gate (DOT-mandated shops). Also accessible as standalone module.

---

#### `IgnitionAdmin.jsx` — Staff Management + Shop Settings
**What it does:** Full staff management: view members, create member rows, set role+permissions, generate PIN reset links. Shop settings: update shop name/address. Devices tab: view/disable/re-enable `member_devices` (BROKEN). Roles tab: view role presets (ADMIN/TECH/SERVICE/CUSTOMER) with 20 granular permissions. Settings tab: shop config.

**Status:** BUILT-AND-WIRED for core staff management. BROKEN sub-features:
- Devices tab: reads/writes `member_devices` — BROKEN (table dropped June 2, not recreated)
- PIN reset admin: writes `pin_resets` — BROKEN (table dropped June 2, not recreated)

**Reads:** Supabase `shop_members`, `shops`, `member_devices` (BROKEN).  
**Writes:** Supabase `shop_members` (insert/update/delete), `shops` (update settings), `member_devices` (BROKEN), `pin_resets` (BROKEN).

**Workflow position:** Admin-only. Not in RO workflow chain.

---

#### `IgnitionAudit.jsx` — AI Invoice Leakage Scanner
**What it does:** Upload an invoice image → Claude Vision reads it → flags missing charges, uncharged inventory, fluid top-offs, consumables. DismissButton lets tech mark false positives and label them for concept-alias learning (cross-shop). "Log to OMNI" saves findings to DataBridge leakage log.

**Status:** BUILT-BUT-DARK. `AIEngine.auditInvoice()` calls the shared AIEngine which requires VITE_API_URL or ANTHROPIC_API_KEY — DARK in production. DismissButton Supabase writes (`concept_aliases`, `increment_alias_count` RPC) DO work if called, but the entire flow requires a successful AI call first.

**Reads:** DataBridge `shop_info` (shopId, tier), `invoice_audits` (history).  
**Writes:** `AIEngine.auditInvoice()` (DARK). On result: DataBridge `transaction_history`, `invoice_audits`. Supabase `concept_aliases` (DismissButton feedback). Supabase `feature_events` (DataBridge.trackEvent).

**Workflow position:** Standalone — invoice analysis tool. Not in RO workflow chain.

---

#### `IgnitionTools.jsx` — Shop Equipment Registry
**What it does:** Registers shop tools (name, type, brand, serial, barcode). Tracks PMI (preventive maintenance interval). Bay custody mode: when enabled, techs must check out tools via IgnitionKosk and any manager override is logged to `tool_signout_log`. PMI status badges (OVERDUE/DUE_SOON/OK).

**Status:** BUILT-AND-WIRED.

**Reads:** Supabase `tools`, `tool_signout_log` (bypass log). DataBridge `shop_policy` (enable_bay_custody), `current_user`.  
**Writes:** Supabase `tools` (insert/update). DataBridge `shop_policy.enable_bay_custody`.

**Workflow position:** Shop management — standalone tool registry.

---

#### `IgnitionPort.jsx` — Estimate Portal (DataBridge-Based)
**STD-010:** PORT = Front Office / Service Portal. Opaque — STD-010 naming debt candidate. Decoded: "Customer Estimate Portal."

**What it does:** Estimate builder operating entirely from DataBridge `active_job_context`. Prices parts from vendor list, builds task list, calculates incidentals. Submits to `CustomerApprovalPortal` for in-person signature. On authorization: auto-generates Purchase Order objects grouped by vendor (stored in DataBridge, not Supabase).

**Status:** BUILT-AND-WIRED (DataBridge-only). PARALLEL to IgnitionEstimate (which uses Supabase). These two modules serve the same workflow step but with different data sources — their outputs are not synchronized.

**Reads:** DataBridge `active_job_context`, `getVendors()`. MarginEngine.  
**Writes:** DataBridge `active_job_context` (priced parts, tasks, purchase orders, signature). Updates job status string locally.

**Workflow position:** Step 6–7 alternate path (DataBridge-based, parallel to IgnitionEstimate).

---

#### `IgnitionOmni.jsx` — Command Center / Dashboard
**STD-010:** OMNI = All-seeing command. Opaque — STD-010 naming debt candidate. Decoded: "Shop Command Dashboard."

**What it does:** Multi-section owner/manager dashboard: (1) Real-time stats (monthly revenue, job count, inventory value from DataBridge, efficiency from Supabase jobs); (2) Margin/leakage audit (reads Supabase invoices + invoice_line_items, calculates under-rate labor); (3) Velocity tracking (reads Supabase tech_hours — AMBIGUOUS, table may not exist); (4) DOT Compliance toggle (reads/writes `shops.is_dot_mandated`); (5) Legacy staff management via DataBridge `pending_users` (old pattern alongside IgnitionAdmin).

**Status:** BUILT-AND-WIRED. Velocity section reads Supabase `shop_members(name)` joined from labor data — AMBIGUOUS (depends on table structure).

**Reads:** Supabase `jobs`, `invoices`, `invoice_line_items`, `customers`, `shops`. DataBridge `system_subscriptions`, `transaction_history`, `inventory_items` (ORPHANED READ — no module writes this key).  
**Writes:** Supabase `shops` (is_dot_mandated). DataBridge `pending_users` (legacy staff enrollment).

**Workflow position:** Owner/manager command center — parallel to RO workflow.

---

#### `IgnitionOmniDashboard.jsx` — Telemetry / Mission Control
**STD-010:** OMNI DASHBOARD = Mission control telemetry. Decoded: "Shop Telemetry Dashboard."

**What it does:** Two tabs: SAVINGS (imports `<SavingsReport />`) and LIVE METRICS (reads DataBridge `transaction_history`, `active_job_context`, `shop_info`). PMI completion hardcoded at 82%.

**Status:** BUILT-BUT-BROKEN.
- SAVINGS tab: `import SavingsReport from './SavingsReport'` — **SavingsReport.jsx does not exist**. The SAVINGS tab crashes on render (Tech Debt #10).
- LIVE METRICS tab: BUILT-AND-WIRED (DataBridge only).

**Reads:** DataBridge `transaction_history`, `active_job_context`, `shop_info`.  
**Writes:** None.

**Workflow position:** Executive telemetry — parallel to RO workflow.

---

#### `IgnitionKosk.jsx` — Technician Floor Kiosk
**STD-010:** KOSK = Kiosk. Opaque — STD-010 naming debt candidate. Decoded: "Tech Floor Station."

**What it does:** High-contrast shop-floor UI. Clock in/out (labor entries), task checklist (from estimate_line_items), QC sign-off, repair logging (repair_logs), tool bay custody (tool_signout_log with manager bypass), voice commands (via useIgnitionVoice), job handover (IgnitionHandover modal), PowerSense (battery API for toolbox mode). SlideToComplete widget for critical completions.

**Status:** BUILT-AND-WIRED.

**Reads:** Supabase `labor_entries`, `estimate_line_items`, `repair_logs`, `tools`, `tool_signout_log`. DataBridge `current_user`, `shop_policy`.  
**Writes:** Supabase `labor_entries` (clock in/out), `repair_logs` (task completion), `tool_signout_log` (check in/out, manager bypass). DataBridge (if custody policy updated).

**Workflow position:** Step 8 — tech repair execution.

---

#### `IgnitionHandover.jsx` — Job Handover Modal
**What it does:** Modal for suspending a work order between shifts. Requires detailed status note. Safety flag: "Safe to Move" vs "Do Not Move." Returns `{ note, isOperable }` to parent. No DB writes.

**Status:** BUILT-AND-WIRED. Used inside IgnitionKosk.

**Reads:** `activeJob` prop.  
**Writes:** None (passes data via `onSubmit` callback).

**Workflow position:** Sub-component of IgnitionKosk (shift handover).

---

#### `PredictiveKey.jsx` — Predictive PMI Engine
**STD-010:** PREDICTIVE / PRED = Predictive preventive maintenance. Name is reasonably clear but abbreviated. Decoded: "AI Preventive Maintenance Scheduler."

**What it does:** Lists assets (from DataBridge `pmi_assets` + auto-surfaced from active jobs). For each asset: AI-generated PMI schedule, risk score, inspection log, savings-avoided tracking. Manual asset add. AI schedule generation via AIEngine (DARK).

**Status:** BUILT-BUT-DARK. DataBridge asset storage + risk UI works. AI schedule generation silently fails.

**Reads:** DataBridge `pmi_assets` (via `getPMIAssets()`), `active_jobs` (auto-surface assets).  
**Writes:** DataBridge `pmi_assets` (via `savePMIAsset()`). AI calls to AIEngine (DARK).

**Workflow position:** Standalone — preventive maintenance scheduling.

---

#### `AdminSubscription.jsx` — Module Subscription Marketplace
**What it does:** Displays all trial-able modules (FLUX, PREDICTIVE, ESTIMATOR, CODE, STOK, PROT, HUB, PROC) with pricing, trial start/end, and days-remaining countdown. Start/stop trial, upgrade to PRO. Manages `system_subscriptions` in DataBridge.

**Status:** BUILT-AND-WIRED.

**Reads:** DataBridge `system_subscriptions`.  
**Writes:** DataBridge `system_subscriptions` (trial start dates, tier).

**Workflow position:** Admin — module activation and billing.

---

#### `CustomerApproval.jsx` — EMPTY FILE
**What it does:** Nothing. File is 1 line.

**Status:** DESIGNED-NEVER-BUILT (empty stub).

**Workflow position:** N/A.

---

#### `CustomerApprovalPortal.jsx` — Customer Digital Signature Screen
**What it does:** Customer-facing (tablet turned toward customer). Loads estimate line items, lets customer approve/decline each item, collects digital signature (via `react-signature-canvas`), writes `customer_authorizations` to Supabase. Shows authorized confirmation screen. Used by both IgnitionEstimate and IgnitionPort.

**Status:** BUILT-AND-WIRED.

**Reads:** Supabase `estimates`, `estimate_line_items`, `jobs`. DataBridge `shop_info`.  
**Writes:** Supabase `customer_authorizations` (approved/declined items + signature blob).

**Workflow position:** Step 7 — customer authorization sign-off.

---

#### `SlideToComplete.jsx` — Drag-to-Confirm Widget
**What it does:** Physical drag interaction (with haptic feedback via `navigator.vibrate`) for confirming critical actions. Used inside IgnitionKosk. No DB.

**Status:** BUILT-AND-WIRED.

**Workflow position:** UI sub-component.

---

#### `IgnitionLegal.js` — Legal Contract Repository
**What it does:** Shows legal contract statuses and expiration alerts (hardcoded: SLA-001 City of Leander, WAIV-99 Hazmat Disposal).

**Status:** MOBILE-ONLY. Uses React Native (`View`, `Text`, `ScrollView`, `TouchableOpacity` from `react-native`). Hardcoded contracts — no DB. No web equivalent.

**Workflow position:** N/A (mobile-only).

---

#### `CSVImporter.jsx` — Customer Data Migration Tool
**What it does:** 4-phase CSV import wizard: Upload → Column mapping → Preview → Done. Auto-maps common column headers (name, phone, VIN, etc.). Imports to DataBridge via ExternalBridge.csv. Used in OnboardingWizard and accessible from OMNI as a standalone tool.

**Status:** BUILT-AND-WIRED (ExternalBridge.csv is pure client-side).

**Reads:** File input (CSV).  
**Writes:** DataBridge `customers_directory` via ExternalBridge.

**Workflow position:** Standalone — customer data migration on onboarding.

---

#### `IgnitionVIN.jsx` — VIN Scanner (Web Stub)
**What it does:** Web stub. Shows an alert: "VIN scanning requires the Ignition OS mobile app." No actual VIN decode functionality.

**Status:** BUILT-BUT-ORPHANED. Web stub is intentional (camera scanning is mobile-only) but provides zero value. No web VIN decode path exists.

**Workflow position:** Step 3 sub-tool (VIN decode) — STUB.

---

#### `modules/OnboardingWizard.jsx` — Owner Signup Wizard (Canonical)
**What it does:** Owner email/password signup via shared OwnerSignup component. Creates `shops` row (same UUID as `businesses.id`), seeds DataBridge, marks `onboarding_complete`. Two-step: shared OwnerSignup → DONE screen.

**Status:** BUILT-AND-WIRED.

**Reads:** Supabase `businesses` (OWNER SYNC).  
**Writes:** Supabase `shops`, `business_members`. DataBridge `shop_policy`, `shop_info`.

**Workflow position:** Initial setup — first-run only.

---

### hooks/

#### `useDataBridge.js` — ORPHANED State Hook
**What it does:** React state engine with hardcoded demo job ("PRE-FLIGHT TEST") and in-memory module registry. Was the original data layer before DataBridge.js existed.

**Status:** BUILT-BUT-ORPHANED. No module imports this hook in the current build. DataBridge.js replaced it.

**Workflow position:** Not in active flow.

---

#### `useIgnitionCipher.js` — PIN Auth Hook (ORPHANED LEGACY)
**STD-010:** CIPHER here = PIN authentication, not DTC decode. Same opaque name, completely different function. Naming collision. STD-010 naming debt — decoded: "Legacy PIN Auth Hook."

**What it does:** In-memory PIN profile store. Hardcoded profiles: 1111=A.MANAGER (ADMIN), 1234=T.OBRIEN (TECH), 2222=S.WRITER (SERVICE), 3333=L.PILOT (DEV). `authenticate(pin)` checks against hardcoded map.

**Status:** BUILT-BUT-ORPHANED. No module imports this hook. DataBridge.authenticate() (SHA-256 + Supabase shop_members) replaced it. Hardcoded PINs are a security issue if this hook were still active — it isn't.

**Workflow position:** Not in active flow.

---

#### `useIgnitionVoice.js` — Voice Recognition Hook
**What it does:** Web Speech API with wake word "ignition". Two modes: `PROXIMITY_WAKE` (continuous listening when plugged in) and `MANUAL_WAKE` (tap-to-talk). Calls `onCommand(transcript)` when wake word detected.

**Status:** BUILT-AND-WIRED. Browser support required (Chrome/Safari only).

**Reads:** `window.SpeechRecognition` / `window.webkitSpeechRecognition`.  
**Writes:** Nothing.

**Workflow position:** IgnitionKosk sub-feature — hands-free command input.

---

#### `usePowerSense.js` — Battery State Hook
**What it does:** Detects whether iPad is plugged in via Web Battery API (`navigator.getBattery()`). Plugged in → Toolbox Mode (neon borders, PROXIMITY_WAKE, no auto-lock). Unplugged → Field Mode (dim borders, MANUAL_WAKE, 5-min auto-lock).

**Status:** BUILT-AND-WIRED. Battery API support varies by browser (Chrome/Edge only; Firefox disabled; Safari limited).

**Workflow position:** IgnitionKosk environment detection.

---

## STEP 2 — WORKFLOW CHAIN MAP

The complete RO workflow from intake to invoice, annotated with module status:

```
STEP 1: NEW REPAIR ORDER
  Module: IgnitionIntake.jsx
  Status: ✅ WIRED
  Data: Supabase jobs INSERT, customers INSERT/search, customer_vehicles INSERT
  Note: Creates the RO that flows through every subsequent step.

STEP 2: RO QUEUE
  Module: IgnitionFlux.jsx
  Status: ✅ WIRED
  Data: Supabase jobs SELECT (real-time queue)
  Routes to: EVAL (new/queued), ESTIMATES (eval_done), KIOSK (authorized/in_repair), INVOICE (complete)

STEP 3: TECH EVALUATION
  Module: IgnitionEval.jsx
  Status: ✅ WIRED (photo upload: AMBIGUOUS — Supabase storage may need bucket setup)
  Data: Supabase evaluations, dtc_codes, labor_entries WRITE; eval_photos WRITE (storage)
  Note: Clock-in at start of eval creates labor_entry. VIN scan opens IgnitionVIN (STUB — alert only).

  ─ SUPPORT STEP 3.5: DTC DECODE
    Module: IgnitionCipher.jsx
    Status: ⚠️ BUILT-BUT-DARK (AI path). Local 3 codes work (3216/3251/157).
    Data: Local fault library. AIEngine.decodeDTC() → DARK.
    Note: For all codes outside the 3-code library, returns {ok:false} silently.

STEP 4: ESTIMATE BUILD
  Module: IgnitionEstimate.jsx
  Status: ⚠️ BUILT-BUT-DARK (AI skeleton)
  Data: Supabase estimates, estimate_line_items WRITE; jobs status UPDATE
  DARK link 1: POST ${API_URL}/api/estimate/build — AI auto-populates estimate from eval data.
               Tech must build estimate manually without this. The chain continues but slower.
  DARK link 2: POST ${API_URL}/api/jobs/${id}/generate-pos — auto-generates POs after auth.
               No POs are auto-created after authorization.

STEP 5: PARTS PRICING + VENDOR SOURCING
  Two parallel paths (not synchronized):
  PATH A — IgnitionPort.jsx (DataBridge-based):
    Status: ✅ WIRED (DataBridge only)
    Data: DataBridge active_job_context, vendor_directory. MarginEngine.
    Note: Generates purchase orders as DataBridge objects (NOT Supabase). Opens CustomerApprovalPortal.
  PATH B — IgnitionEstimate has PriceField.jsx inline:
    Status: ✅ WIRED (DataBridge leakage tracking)
    Data: DataBridge transaction_history (leakage log).

  ─ SUPPORT: VENDOR LOOKUP
    Module: IgnitionProc.jsx
    Status: ✅ WIRED (DataBridge vendor_directory). "Initialize PO" button = STUB.

  ─ SUPPORT: PARTS ADD TO JOB (ORPHANED)
    Module: IgnitionProcure.jsx
    Status: 🔴 BUILT-BUT-ORPHANED — not in CoreApp routing, no caller in web build.

STEP 6: CUSTOMER AUTHORIZATION
  Module: CustomerApprovalPortal.jsx
  Status: ✅ WIRED
  Data: Supabase estimate_line_items SELECT, customer_authorizations INSERT (signature + decisions)
  Note: Opens as overlay from IgnitionEstimate or IgnitionPort. Line-item approve/decline + digital sig.

STEP 7: TECH REPAIR EXECUTION
  Module: IgnitionKosk.jsx
  Status: ✅ WIRED
  Data: Supabase labor_entries (clock in/out), repair_logs (task completion), tool_signout_log (custody).
  Sub-features:
    - Voice commands: useIgnitionVoice (✅ browser-dependent)
    - Power detection: usePowerSense (✅ browser-dependent)
    - Handover: IgnitionHandover (✅ WIRED, no DB)
    - Tool custody: IgnitionTools must configure bay custody first.

  ─ COMPLIANCE GATE (if DOT-mandated):
    Module: IgnitionCompliance.jsx
    Status: ⚠️ BUILT (form works), photo = alert stub, smartSync queued but never sent (API_URL DARK)

STEP 8: INVOICE
  Module: IgnitionInvoice.jsx
  Status: ✅ WIRED
  Data: Supabase invoices INSERT, invoice_line_items INSERT. jobs status UPDATE.
  Note: PDF download stub (button present, no implementation).

  ─ QB SYNC (DARK):
    Module: ExternalBridge.qbo (called from Admin/Settings flow)
    Status: 🔴 DARK — API_URL unset + no Ignition QB Vercel functions exist (unlike cultivar-os).
    Note: Cultivar OS has api/qbo/* Vercel functions. Ignition OS has NONE. QB is fully dead in Ignition web.

PARALLEL CHAINS (not in the RO sequence):

COMMAND / LEAKAGE:
  Module: IgnitionOmni.jsx
  Status: ✅ WIRED (reads Supabase jobs, invoices, invoice_line_items, shops)
  Sub-features: leakage audit (✅), DOT toggle (✅), velocity (AMBIGUOUS), legacy staff mgmt (DataBridge old pattern)

TELEMETRY:
  Module: IgnitionOmniDashboard.jsx
  Status: 🔴 SAVINGS tab BROKEN (SavingsReport.jsx MISSING). LIVE METRICS tab ✅ (DataBridge).

INVOICE AI AUDIT:
  Module: IgnitionAudit.jsx
  Status: 🔴 DARK — AIEngine.auditInvoice() requires VITE_API_URL or server-side key. Silently fails.
  Note: DismissButton Supabase writes (concept_aliases) work in isolation but unreachable without audit output.

PMI SCHEDULING:
  Module: PredictiveKey.jsx
  Status: 🔴 DARK — AIEngine schedule generation dead. DataBridge asset storage works (save/load).

DISPATCH:
  Module: IgnitionHub.jsx
  Status: 🔴 BUILT-BUT-ORPHANED — GPS simulated, DataBridge-only, no real telematics.

STAFF MANAGEMENT:
  Module: IgnitionAdmin.jsx
  Status: ⚠️ PARTIAL — core staff/roles ✅, Devices tab 🔴 BROKEN (member_devices dropped).
  PIN reset admin: 🔴 BROKEN (pin_resets dropped).

SUBSCRIPTION:
  Module: AdminSubscription.jsx
  Status: ✅ WIRED (DataBridge trial management).

INVENTORY:
  Module: IgnitionStok.jsx
  Status: ✅ WIRED (Supabase inventory reads).

TOOLS REGISTRY:
  Module: IgnitionTools.jsx
  Status: ✅ WIRED (Supabase tools, tool_signout_log).

CSV MIGRATION:
  Module: CSVImporter.jsx
  Status: ✅ WIRED (ExternalBridge client-side CSV parse → DataBridge).
```

---

## STEP 3 — CROSS-CUTTING FINDINGS

### 3.1 DataBridge Key Map

#### Keys with active writers AND readers (healthy):

| Key | Writer(s) | Reader(s) |
|-----|-----------|-----------|
| `active_job_context` | IgnitionProcure, IgnitionPort, IgnitionKosk (status updates) | IgnitionPort, IgnitionKosk, IgnitionCipher, IgnitionOmniDashboard |
| `active_jobs` | DataBridge.pullCloudSync (from Supabase/FastAPI) | IgnitionHub (getJobs()), IgnitionOmni, PredictiveKey (auto-surface) |
| `current_user` | CoreApp (login), DataBridge.authenticate | All modules (shop_id, permissions) |
| `shop_info` | CoreApp OWNER SYNC (from Supabase shops), DataBridge.simulateTrialDay | All modules (shop_id, name) |
| `shop_policy` | modules/OnboardingWizard, IgnitionTools (custody toggle) | CoreApp (autoLockEnabled, onboarding_complete), IgnitionCompliance, IgnitionKosk |
| `margin_config` | IgnitionProt (setMarginConfig) | MarginEngine (getConfig) — all pricing |
| `prot_matrix` | IgnitionProt (setSystemRates) | DataBridge.getProtMatrix(), IgnitionCipher (getActiveMargin) |
| `system_subscriptions` | AdminSubscription | DataBridge.checkTrialStatus() — all TrialGated modules |
| `vendor_directory` | IgnitionProc (addVendor) | IgnitionPort (getVendors) |
| `customers_directory` | IgnitionCRM (addCustomer), ExternalBridge CSV import | IgnitionCRM (getCustomers) |
| `transaction_history` | IgnitionOmni (leakage rows), IgnitionAudit (saveToLeakage) | IgnitionOmniDashboard (LIVE METRICS) |
| `pmi_assets` | PredictiveKey (savePMIAsset) | PredictiveKey (getPMIAssets) |
| `invoice_audits` | IgnitionAudit (saveAuditResult) | IgnitionAudit (history view) |
| `fleet_units` | PredictiveKey (via saveFleetUnit — no, actually PredictiveKey only calls savePMIAsset, not saveFleetUnit) | IgnitionHub (getFleetUnits) |

#### Orphaned writes (key written but no consumer reads it):

| Key | Writer | Problem |
|-----|--------|---------|
| `margin_change_log` | DataBridge.setMarginConfig() | No module reads/displays audit log |
| `pending_users` | IgnitionOmni.StaffManagement (old enrollment) | EnrollmentCatch reads it but via legacy flow; new enrollment uses IgnitionAdmin + shop_members |

#### Orphaned reads (key read but no writer in current code):

| Key | Reader | Problem |
|-----|--------|---------|
| `fleet_units` | IgnitionHub (`DataBridge.getFleetUnits()`) | No module in web build writes fleet_units from real data. `DataBridge.saveFleetUnit()` exists but no caller. Hub shows empty unless manually seeded. |
| `inventory_items` | IgnitionOmni (stats section) | IgnitionStok reads from Supabase `inventory` — NOT DataBridge. IgnitionOmni's inventory value tile will always show $0. |
| `labor_guide` | DataBridge.getLaborGuide() | No module writes this key; always returns hardcoded defaults. |
| `Hardware` | Referenced in SCHEMA | No module reads or writes this in the web build. Legacy mobile pattern. |

#### Key naming inconsistency (STD-006 adjacent):

- `IgnitionOmni` reads `DataBridge.load('inventory_items')` but the key in SCHEMA is `Hardware`. `inventory_items` is written by no one. `Hardware` is written by no one in web build. Both are orphaned from different directions.
- IgnitionCipher reads `DataBridge.getActiveMargin('STANDARD')` which uses `prot_matrix.anchor`, but MarginEngine reads `margin_config.tierDiscounts`. Two separate config paths for margin — `prot_matrix` is the legacy path (IgnitionProt → IgnitionCipher), `margin_config` is the new path (IgnitionProt → MarginEngine). If both are set to different values, modules disagree on pricing.

---

### 3.2 RBAC Reality

Ignition OS has the most sophisticated RBAC of any TRACE vertical. It is DataBridge-local — not enforced at the Supabase RLS level.

**Permission enforcement location:** `CoreApp.jsx` — `AccessGatekeeper` component wraps each module and checks `DataBridge.load('current_user').permissions` against `requiredPermissions[]` prop.

**19 defined permissions** (from IgnitionAdmin.jsx `ALL_PERMISSIONS`):
- Module access: view_omni, view_hub, view_flux, view_cipher, view_stok, view_proc, view_prot, view_port, view_crm, view_predictive, view_marketplace
- Financial: PRICING_AUTHORITY, edit_margins, approve_payroll
- Admin: manage_users
- Tech Ops: scan_parts, update_flux
- Customer: sign_estimates, pay_invoice

**4 role presets** (IgnitionAdmin.jsx `ROLE_PRESETS`):
- ADMIN: all module views + financial + admin + tech ops
- TECH: view_hub, view_flux, view_cipher, view_stok, scan_parts, update_flux
- SERVICE: view_port, view_crm, view_cipher, view_stok, sign_estimates
- CUSTOMER: view_port, sign_estimates, pay_invoice

**Known permission gaps (audit findings):**
1. `IgnitionCompliance.jsx` has `requiredPermissions={[]}` in CoreApp routing → **any logged-in user can access DOT inspection, including CUSTOMER role.**
2. Permission checks are client-side only. A user with DataBridge manipulation could grant themselves any permission — no server-side enforcement.
3. `useIgnitionCipher.js` had its own hardcoded role list (`allowed: ['intake', 'queue',...]`) that does NOT map to the 19-permission system — completely different permission vocabulary. This hook is orphaned, so the mismatch is academic but confirms the auth system has been redesigned since the hook was written.

---

### 3.3 DARK Inventory — All AI Features Dead in Production

**Root cause:** `VITE_API_URL` is not set in the ignition-os Vercel project. `AIEngine.call()` returns `{ ok: false }` on every call. Railway still running but receives zero traffic from web build.

| Feature | Module | Call | Impact |
|---------|--------|------|--------|
| AI estimate skeleton | IgnitionEstimate.jsx | `POST ${API_URL}/api/estimate/build` | Techs must build estimates manually; no AI pre-fill |
| Auto-PO generation | IgnitionEstimate.jsx | `POST ${API_URL}/api/jobs/${id}/generate-pos` | No purchase orders auto-generated after authorization |
| DTC AI decode | IgnitionCipher.jsx | `AIEngine.decodeDTC()` | Only 3 hardcoded codes work; all others return nothing |
| Invoice leakage scan | IgnitionAudit.jsx | `AIEngine.auditInvoice()` | Entire AUDIT module is unusable |
| PMI AI scheduler | PredictiveKey.jsx | `AIEngine.*` | PMI schedule generation dead; only manual entry works |
| QB OAuth | ExternalBridge.js | `${API_URL}/api/qbo/auth-url` | QB integration fully dark (also: no Vercel QB functions for Ignition) |

**Additional dark note:** Even if VITE_API_URL were set to Railway, the agreed kill path (v7 §15) is to retire Railway and port to Vercel functions. The two highest-value tasks (`dtc_decode`, `estimate_draft`) are next per the agreed sequence. Invoice scan and VIN decode are retired orphans (per audit 5-6 findings).

---

### 3.4 Broken Features — Dropped Tables

These features compile, route, and render — but Supabase calls fail (table not found):

| Feature | Module | Table | Dropped By |
|---------|--------|-------|-----------|
| Forgot PIN flow | CoreApp.ForgotPinFlow | `pin_resets` | 20260602_ignition_drop_team_tables.sql |
| Staff join via token | CoreApp.JoinFlow | `shop_invites` | Same |
| Device management | IgnitionAdmin.jsx Devices tab | `member_devices` | Same |
| Device auto-enrollment | DataBridge.autoEnrollDevice() | `member_devices` | Same |

**Note:** `shop_members` WAS also dropped by this migration but was recreated by `20260603_recreate_shop_members.sql`. The other three tables have no corresponding recreate migration.

---

### 3.5 Supabase Tables Referenced — Full Inventory

Tables confirmed by code reads:

| Table | Module(s) that write | Module(s) that read | Migration status |
|-------|---------------------|---------------------|-----------------|
| `jobs` | IgnitionIntake, DataBridge.db.jobs | IgnitionFlux, IgnitionEstimate, IgnitionInvoice, IgnitionOmni, DataBridge.pullCloudSync | In ignition migrations ✓ |
| `customers` | IgnitionIntake | IgnitionOmni (customer names for leakage) | In ignition migrations ✓ |
| `customer_vehicles` | IgnitionIntake | — | Presumed ✓ |
| `evaluations` | IgnitionEval | IgnitionEstimate | Presumed ✓ |
| `dtc_codes` | IgnitionEval | — | **NO migration found — STD-008 gap** |
| `eval_photos` | IgnitionEval | — | **NO migration found — STD-008 gap** |
| `labor_entries` | IgnitionEval (clock), IgnitionKosk (clock) | IgnitionKosk | Presumed ✓ |
| `estimates` | IgnitionEstimate | IgnitionInvoice, CustomerApprovalPortal, IgnitionOmniDashboard | Presumed ✓ |
| `estimate_line_items` | IgnitionEstimate | IgnitionInvoice, IgnitionKosk, CustomerApprovalPortal | Presumed ✓ |
| `invoices` | IgnitionInvoice | IgnitionOmni | Presumed ✓ |
| `invoice_line_items` | IgnitionInvoice | IgnitionOmni | Presumed ✓ |
| `inventory` | — | IgnitionStok | Presumed ✓ |
| `shops` | OnboardingWizard, IgnitionOmni (is_dot_mandated), IgnitionAdmin | CoreApp OWNER SYNC, DataBridge.db.shop | 20260529_ignition_businesses.sql ✓ |
| `shop_members` | IgnitionAdmin | CoreApp (auth), DataBridge.authenticate | 20260603_recreate_shop_members.sql ✓ |
| `businesses` | — | CoreApp OWNER SYNC | 20260529_ignition_businesses.sql ✓ |
| `business_members` | modules/OnboardingWizard | — | 20260602_shared_members_a_create_tables.sql ✓ |
| `tools` | IgnitionTools | IgnitionKosk | **NO migration found — STD-008 gap** |
| `tool_signout_log` | IgnitionKosk | IgnitionTools | **NO migration found — STD-008 gap** |
| `repair_logs` | IgnitionKosk | IgnitionKosk (task completion check) | **NO migration found — STD-008 gap** |
| `customer_authorizations` | CustomerApprovalPortal | — | **NO migration found — STD-008 gap** |
| `concept_aliases` | IgnitionAudit (DismissButton) | — | **NO migration found — STD-008 gap** |
| `purchase_orders` | DataBridge.db.purchaseOrders (API available but no UI writes) | DataBridge.db.purchaseOrders | **NO migration found — STD-008 gap** |
| `pmi_schedules` | DataBridge.db.pmi | DataBridge.db.pmi | **NO migration found — STD-008 gap** |
| `ai_usage` | — | DataBridge.db.aiUsage.getCostSummary() | **NO migration found — STD-008 gap** |
| `feature_events` | DataBridge.trackEvent() | — | **NO migration found — STD-008 gap** |
| `error_events` | DataBridge.logError() | — | **NO migration found — STD-008 gap** |
| `member_devices` | DataBridge.autoEnrollDevice() | IgnitionAdmin Devices tab | DROPPED — not recreated |
| `pin_resets` | CoreApp ForgotPinFlow | CoreApp ForgotPinFlow | DROPPED — not recreated |
| `shop_invites` | — | CoreApp JoinFlow | DROPPED — not recreated |

**STD-008 gap summary:** 10 tables are referenced in production code with no committed migration in `packages/ignition-os/supabase/migrations/`. These tables either exist as hand-applied schema in `ufsgqckbxdtwviqjjtos` (STD-008 inverse gap) or do not exist at all (likely the newer additions like `concept_aliases`, `customer_authorizations`, `repair_logs`, `tools`).

---

### 3.6 STD-010 Naming Debt — Full List

All opaque module identifiers requiring a rename pass before Ignition onboards a second developer:

| Opaque Name | Location | Decoded Meaning |
|-------------|----------|-----------------|
| `FLUX` | IgnitionFlux.jsx | Repair Order Queue / Workflow Status Board |
| `CIPHER` | IgnitionCipher.jsx (file) | DTC Fault Code Decoder |
| `CODE` | CoreApp routing label | Same — UI calls it CODE, file calls it CIPHER |
| `STOK` | IgnitionStok.jsx | Parts Inventory |
| `PROT` | IgnitionProt.jsx | Margin & Pricing Configuration |
| `PROC` | IgnitionProc.jsx | Vendor Directory |
| `HUB` | IgnitionHub.jsx | Fleet Dispatch Board |
| `PORT` | IgnitionPort.jsx | Customer Estimate Portal / Front Office |
| `KOSK` | IgnitionKosk.jsx | Technician Floor Kiosk |
| `OMNI` | IgnitionOmni.jsx | Shop Command Dashboard |
| `PRED` | PredictiveKey.jsx (module named PRED in UI) | AI Preventive Maintenance Scheduler |
| `CIPHER` | useIgnitionCipher.js (hook) | **COLLISION** — same name, completely different function (PIN auth hook, not DTC decoder). This is the worst naming collision in the codebase. |
| `AUDIT` | IgnitionAudit.jsx | AI Invoice Leakage Scanner |

---

## APPENDIX — File Count Summary

| Location | File count | Status distribution |
|----------|-----------|---------------------|
| Root-level .jsx/.js | 13 | 7 WIRED, 3 ORPHANED, 2 infra, 1 MOBILE-ONLY |
| modules/ | 28 | 13 WIRED, 5 DARK, 5 ORPHANED, 3 BROKEN, 1 STUB, 1 MOBILE-ONLY |
| hooks/ | 4 | 2 WIRED, 2 ORPHANED |
| stubs/ | 5 | Build infrastructure (Vite aliases for react-native packages) |

**Total business modules:** 30 (root + modules, excluding stubs/infra)  
**Fully operational:** ~15  
**Degraded (DARK or ORPHANED):** ~10  
**Broken:** 3 (OmniDashboard SAVINGS, ForgotPin, JoinFlow)  
**Mobile-only:** 2 (IgnitionLegal.js, App.js)  
**Stub/empty:** 2 (CustomerApproval.jsx, IgnitionVIN.jsx)
