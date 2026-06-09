# Ignition OS — Trace Coverage Ledger
# Session: THUNDER instrumentation pass
# Date: 2026-06-10
# Tags: [TRACE:MARGIN] [TRACE:AUTH] [TRACE:DATA] [TRACE:WORKFLOW] [TRACE:API]
# Scope: packages/ignition-os/ ONLY

---

## ⚠️ BLIND SPOTS ON CUT-LINES

Files that sit on teardown cut-lines but could not be fully covered, or where the
instrumentation is partial. These are the highest-risk gaps for disassembly work.

| File | Cut-Line | Gap | Risk |
|---|---|---|---|
| `modules/IgnitionOmniDashboard.jsx` | WORKFLOW (SavingsReport DARK tab) | Renders `<SavingsReport />` — that import is BROKEN (TD#10). The SAVINGS tab silently renders nothing. No TRACE_WORKFLOW added here because there are no status transitions in this file; the gap is the broken SavingsReport import. | LOW — visual gap only; no data writes |
| `ExternalBridge.js` — invoice/customers paths | TRACE_API | `qbo.syncInvoices()` and `qbo.syncCustomers()` paths not individually logged — only `initiateOAuth` and `getStatus` got traces. All paths share the same DARK-IN-PROD root cause (no Vercel /api/qbo/* functions). | LOW — same root cause; `initiateOAuth` trace fires first and blocks the rest |
| `hooks/useIgnitionCipher.js` | TRACE_AUTH (orphaned) | This hook is the STD-010 worst naming collision (same "CIPHER" name as IgnitionCipher.jsx DTC decoder, but completely different function). It is DEAD/ORPHANED — pure in-memory useState, nothing in the web build imports it. Not instrumented because it never executes. | NONE in prod; CONFUSION RISK during codebase reads |
| `modules/IgnitionEval.jsx` — dtcCount | TRACE_WORKFLOW | The `submitEval` log uses `window._evalDtcCodes` as a workaround (DTC count not in scope there). Actual DTC count may show as `undefined` in the log. | LOW — cosmetic log gap; job status transition IS logged |

---

## INSTRUMENTED FILES (21 files)

### Core / Infrastructure

| File | Tags | Cut-Lines Covered |
|---|---|---|
| `MarginEngine.js` | `[TRACE:MARGIN]` | `getConfig()`, `getSlabForCost()`, `calculateRetail()` (A PATH TEARDOWN TARGET), `analyzeTransaction()` |
| `DataBridge.js` | `[TRACE:MARGIN]` `[TRACE:AUTH]` `[TRACE:DATA]` | `save/load` (teardown-target keys), `getMarginConfig` (NEW PATH), `setMarginConfig`, `getProtMatrix` (LEGACY C PATH), `getActiveMargin` (LEGACY C PATH), `calculateRetail` (LEGACY C PATH), `recordTransaction`, `authenticate` (FORMAT DETECTOR: capability-string vs role-badge), `getProfiles` (SEED: role-badge FORMAT-COLLISION note), `getSystemRoles` (EXPANSION MAP: TD#28 format-collision note) |
| `CoreApp.jsx` | `[TRACE:AUTH]` `[TRACE:WORKFLOW]` | AccessGatekeeper FORMAT-COLLISION DETECTOR, `loginWithBio` SUCCESS path (capability-string NEW format note), `fetchCloudData` (DataBridge cloud-sync coupling), `handleUpdateJob` (DataBridge active_job_context coupling) |
| `ExternalBridge.js` | `[TRACE:API]` | `qbo.initiateOAuth` (DARK IN PROD — no Ignition /api/qbo/* Vercel functions), `qbo.getStatus` (DARK IN PROD) |

### Margin Callers (A PATH — MarginEngine.js LOCAL)

| File | Tags | Cut-Lines Covered |
|---|---|---|
| `PriceField.jsx` | `[TRACE:MARGIN]` | `suggestedPrice` calculation (A PATH TEARDOWN TARGET) |
| `modules/IgnitionPort.jsx` | `[TRACE:MARGIN]` | Part pricing in render (A PATH TEARDOWN TARGET) |
| `modules/IgnitionProcure.jsx` | `[TRACE:MARGIN]` | `retailPrice` calculation (A PATH TEARDOWN TARGET) |
| `OnboardingWizard.jsx` (root) | `[TRACE:MARGIN]` | `MarginPath` A PATH calculation, `DiagnosePath` C PATH calculation (with PRICE WILL CHANGE warning) |

### Margin Callers (C PATH — DataBridge prot_matrix)

| File | Tags | Cut-Lines Covered |
|---|---|---|
| `modules/IgnitionCipher.jsx` | `[TRACE:MARGIN]` `[TRACE:API]` | `handleTranslate` C PATH entry (prot_matrix percent-of-cost, PRICE WILL CHANGE warning), local library path (`DataBridge.calculateRetail` C PATH), AI decode path (DARK IN PROD — 3 hardcoded codes only) |

### Margin Callers (D PATH — flat-percent fallback)

| File | Tags | Cut-Lines Covered |
|---|---|---|
| `modules/IgnitionEstimate.jsx` | `[TRACE:MARGIN]` `[TRACE:API]` `[TRACE:WORKFLOW]` | `markupPercent` D PATH (flat-percent TEARDOWN TARGET), `buildEstimate` Railway fetch (DARK IN PROD — VITE_API_URL unset) |

### Margin Callers (E PATH — display-only shops.margin_config)

| File | Tags | Cut-Lines Covered |
|---|---|---|
| `modules/IgnitionOmni.jsx` | `[TRACE:MARGIN]` | `fetchData` shops.margin_config READ (E PATH DISPLAY-ONLY note), `handleUpdateMarginConfig` shops.margin_config WRITE (E PATH DISPLAY-ONLY note) |

### Margin Config Source

| File | Tags | Cut-Lines Covered |
|---|---|---|
| `modules/IgnitionProt.jsx` | `[TRACE:MARGIN]` | `useEffect` LOAD (rates + matrix + costs from DataBridge; overhead_config.monthly note), `handleSave` SAVE (upstream source for MarginEngine.getConfig() + overheadPerUnit) |

### Auth / Permission

| File | Tags | Cut-Lines Covered |
|---|---|---|
| `modules/IgnitionAdmin.jsx` | `[TRACE:AUTH]` | `shop_members.insert` (capability-string format NEW — FORMAT-COLLISION note; these members break AccessGatekeeper.userCapabilities flatMap via getSystemRoles) |

### AI / DARK Inventory

| File | Tags | Cut-Lines Covered |
|---|---|---|
| `modules/IgnitionAudit.jsx` | `[TRACE:API]` | `runAudit` → `AIEngine.auditInvoice()` (DARK IN PROD — entire module unusable; TD#25) |
| `modules/PredictiveKey.jsx` | `[TRACE:API]` | `requestAISchedule` → `AIEngine.suggestPMI()` (DARK IN PROD — AI schedule dead; TD#25) |

### Workflow Chain (34-step RO)

| File | Tags | Cut-Lines Covered |
|---|---|---|
| `modules/IgnitionFlux.jsx` | `[TRACE:WORKFLOW]` | `fetchJobs` query + result, `navigateToJob` routing decision |
| `modules/IgnitionIntake.jsx` | `[TRACE:WORKFLOW]` | Before `jobs.insert` (SPLIT-BRAIN NOTE: Supabase customers ≠ DataBridge customers_directory; TD#26), after job created |
| `modules/IgnitionEval.jsx` | `[TRACE:WORKFLOW]` | `startEval` → jobs.update(status=in_eval) STEP 2, `submitEval` → jobs.update(status=eval_done) STEP 3 |
| `modules/CustomerApprovalPortal.jsx` | `[TRACE:WORKFLOW]` | `handleAuthorize` → jobs.update(status=authorized) STEP 4 (gates KOSK in_repair start) |
| `modules/IgnitionKosk.jsx` | `[TRACE:WORKFLOW]` | BEGIN REPAIR → onUpdateJob(status=in_repair) STEP 5 |
| `modules/IgnitionInvoice.jsx` | `[TRACE:WORKFLOW]` | `generateInvoice` → jobs.update(status=invoiced) STEP 7, `processPaymentAndClose` → jobs.update(status=closed) STEP 8 (terminal) |

---

## NOT INSTRUMENTED — SKIPPED-LOW-RISK

Files that are in the web build but have no margin/auth/data/workflow/API paths on
the teardown cut-lines. No TRACE tags needed; their behavior is stable and not being disassembled.

| File | Reason |
|---|---|
| `ErrorBoundary.jsx` | React error boundary UI only; no pricing, auth, or DB calls |
| `EnrollmentCatch.jsx` | Digital signature capture; `DataBridge.save('enrollment_signature')` is not a teardown-target key |
| `modules/IgnitionHandover.jsx` | Modal for work order hand-off notes; pure UI, no DB calls, no status transitions |
| `modules/SlideToComplete.jsx` | Gesture UI widget only; no data paths |
| `modules/AdminSubscription.jsx` | Subscription management UI; `DataBridge.load/save('system_subscriptions')` is not a teardown-target key |
| `modules/CSVImporter.jsx` | `ExternalBridge.csv.*` customer import; not a margin/auth teardown target |
| `modules/IgnitionCRM.jsx` | `DataBridge.getCustomers()` — reads `customers_directory` key (TD#26 orphaned key, already documented); no pricing paths |
| `modules/IgnitionHub.jsx` | `DataBridge.getFleetUnits()` — reads `fleet_units` key (TD#26 orphaned key, already documented); no pricing paths |
| `modules/IgnitionProc.jsx` | `DataBridge.getVendors()` — vendor directory reads; not a teardown target |
| `modules/IgnitionCompliance.jsx` | PMI compliance checks; `DataBridge.smartSync('SUBMIT_PMI')` — not a teardown target |
| `modules/IgnitionTools.jsx` | `supabase.from('tools')` — tool checkout/management; no margin pricing paths |
| `modules/IgnitionStok.jsx` | `supabase.from('inventory')` — inventory management; no margin pricing paths |
| `modules/CustomerApproval.jsx` | Thin wrapper/routing component; no DB calls |
| `modules/IgnitionOmniDashboard.jsx` | DataBridge.load for shop telemetry; no pricing code; renders `<SavingsReport />` DARK tab (documented in BLIND SPOTS above) |
| `main.jsx` | Entry point; wraps `<CoreApp>` in `<BusinessProvider>` and `<ErrorBoundary>`; no business logic |
| `supabase.js` | Single re-export of `@trace/shared/supabase/client`; 1 line |
| `hooks/useIgnitionVoice.js` | Browser SpeechRecognition hook for KOSK voice commands; no data paths |
| `hooks/usePowerSense.js` | `DataBridge` load for `is_dot_mandated` + tool custody toggle; not a teardown target |
| `PriceField.js` | 1-line re-export of `PriceField.jsx`; no logic |

---

## NOT INSTRUMENTED — SKIPPED-DEAD

Files that are dead code, orphaned, or not executed in the web build.

| File | Reason |
|---|---|
| `App.js` | MOBILE-ONLY — React Native / Expo entry point; imports `react-native`, `expo-haptics`, `lucide-react-native`; not built by Vite |
| `IgnitionCore.js` | DEAD IN WEB BUILD — `main.jsx` imports `CoreApp.jsx` directly; `IgnitionCore.js` is never imported; describes itself as "web core router" but is superseded by CoreApp |
| `hooks/useIgnitionCipher.js` | DEAD/ORPHANED — pure in-memory `useState` PIN auth hook; nothing in the web build imports it; STD-010 worst naming collision (same "CIPHER" name as `IgnitionCipher.jsx` DTC decoder); legacy from mobile era |
| `hooks/useDataBridge.js` | DEAD IN WEB BUILD — in-memory `useState` job/module state with hardcoded `JOB-999` seed; CoreApp.jsx uses Supabase directly; this hook is not imported anywhere in the web build |
| `modules/IgnitionVIN.jsx` | WEB STUB — 27 lines; displays "VIN camera scanning available in mobile app only; use manual entry"; no pricing/auth/data paths |
| `PriceField.native.js` | NATIVE ONLY — React Native `<TextInput>` wrapper |
| `IgnitionCore.native.js` | NATIVE ONLY |
| `EnrollmentCatch.native.js` | NATIVE ONLY |
| `useIgnitionVoice.native.js` | NATIVE ONLY |
| `modules/CustomerEstimate.native.js` | NATIVE ONLY |
| `modules/CustomerKiosk.native.js` | NATIVE ONLY |
| `modules/IgnitionAdmin.native.js` | NATIVE ONLY |
| `modules/IgnitionCompliance.native.js` | NATIVE ONLY |
| `modules/IgnitionHandover.native.js` | NATIVE ONLY |
| `modules/IgnitionOmni.native.js` | NATIVE ONLY |
| `modules/IgnitionOmniDashboard.native.js` | NATIVE ONLY |
| `modules/IgnitionPort.native.js` | NATIVE ONLY |
| `modules/IgnitionProcure.native.js` | NATIVE ONLY |
| `modules/IgnitionQueue.native.js` | NATIVE ONLY |
| `modules/IgnitionVIN.native.js` | NATIVE ONLY |
| `modules/IgnitionVendor.native.js` | NATIVE ONLY |
| `modules/IgnitionVoice.native.js` | NATIVE ONLY |
| `modules/InventoryAI.native.js` | NATIVE ONLY |
| `modules/PartsList.native.js` | NATIVE ONLY |
| `modules/SlideToComplete.native.js` | NATIVE ONLY |
| `modules/TechKeypad.native.js` | NATIVE ONLY |
| `modules/ToolChecklist.native.js` | NATIVE ONLY |
| `modules/TriageOptimizer.native.js` | NATIVE ONLY |
| `modules/IgnitionLegal.native.js` | NATIVE ONLY |
| `stubs/asyncStorage.js` | BUILD STUB — Vite alias target for `@react-native-async-storage/async-storage` |
| `stubs/audio.js` | BUILD STUB — Vite alias target for `expo-audio` |
| `stubs/camera.js` | BUILD STUB — Vite alias target for `expo-camera` |
| `stubs/empty.js` | BUILD STUB — catch-all empty module for unresolved native deps |
| `stubs/haptics.js` | BUILD STUB — Vite alias target for `expo-haptics` |
| `vite.config.js` | BUILD CONFIG — Vite configuration; defines aliases and stubs; not runtime code |
| `modules/OnboardingWizard.jsx` (in `modules/`) | DISTINCT FILE from root `OnboardingWizard.jsx`; this is the 3-step auth-based signup flow; it routes through shared `OwnerSignup` and has no pricing code; no TRACE_MARGIN needed. (Root `OnboardingWizard.jsx` IS instrumented.) |
| `modules/IgnitionLegal.js` | DEAD IN WEB BUILD — no code in the web build routes to this module (confirmed by STD-010 reality audit 2026-06-09) |

---

## COVERAGE SUMMARY

| Category | Count | Notes |
|---|---|---|
| **INSTRUMENTED** | **21 files** | 16 from session 1 (pre-compaction) + 5 from session 2 (post-compaction) |
| SKIPPED-LOW-RISK | 19 files | In web build; no teardown-target paths |
| SKIPPED-DEAD | 37 files | Native-only, stubs, build config, orphaned/dead in web build |
| **Total classified** | **77 files** | 100% of `packages/ignition-os/` |

---

## HOW TO READ THE TAGS IN BROWSER CONSOLE

Filter by tag prefix to isolate each subsystem:

```
Console filter: [TRACE:MARGIN]   → all pricing calls + teardown targets
Console filter: [TRACE:AUTH]     → role/permission/PIN paths + format-collision detector
Console filter: [TRACE:DATA]     → DataBridge save/load for teardown-target keys
Console filter: [TRACE:WORKFLOW] → 34-step RO chain status transitions
Console filter: [TRACE:API]      → AIEngine/external calls — the DARK inventory
```

## HOW TO SILENCE A SUBSYSTEM (STD-003)

Each file has a named `const TRACE_X = true;` at module scope.
**Comment out the const** — the log calls become dead code and emit nothing.
Do NOT delete the logs. David controls per-subsystem. Claude does not silence on its own;
may suggest "MARGIN migration proven, want it off?" but David calls it.

Example — silence MARGIN in DataBridge.js:
```js
// const TRACE_MARGIN = true;   ← comment this out
```

Files with TRACE_MARGIN (10):
`MarginEngine.js`, `DataBridge.js`, `PriceField.jsx`, `OnboardingWizard.jsx` (root),
`modules/IgnitionCipher.jsx`, `modules/IgnitionEstimate.jsx`, `modules/IgnitionOmni.jsx`,
`modules/IgnitionPort.jsx`, `modules/IgnitionProcure.jsx`, `modules/IgnitionProt.jsx`

Files with TRACE_AUTH (3):
`DataBridge.js`, `CoreApp.jsx`, `modules/IgnitionAdmin.jsx`

Files with TRACE_DATA (1):
`DataBridge.js`

Files with TRACE_WORKFLOW (8):
`CoreApp.jsx`, `modules/IgnitionEval.jsx`, `modules/IgnitionEstimate.jsx`,
`modules/IgnitionFlux.jsx`, `modules/IgnitionIntake.jsx`, `modules/IgnitionInvoice.jsx`,
`modules/IgnitionKosk.jsx`, `modules/CustomerApprovalPortal.jsx`

Files with TRACE_API (6):
`ExternalBridge.js`, `modules/IgnitionAudit.jsx`, `modules/IgnitionCipher.jsx`,
`modules/IgnitionEstimate.jsx`, `modules/PredictiveKey.jsx`

---

## TEARDOWN READINESS CHECKLIST

Before disassembling each subsystem, confirm these cut-lines are emitting in console:

**MARGIN TEARDOWN (migrate A→B callers to shared MarginEngine.ts):**
- [ ] `[TRACE:MARGIN] MarginEngine.calculateRetail (LOCAL-IGNITION)` — fires for every A PATH call
- [ ] `[TRACE:MARGIN] PriceField (A PATH)` — fires when estimate line item has cost
- [ ] `[TRACE:MARGIN] IgnitionPort part pricing (A PATH)` — fires in portal render
- [ ] `[TRACE:MARGIN] IgnitionProcure (A PATH)` — fires on wholesale cost input
- [ ] `[TRACE:MARGIN] OnboardingWizard.MarginPath (A PATH)` — fires in demo wizard
- [ ] `[TRACE:MARGIN] IgnitionCipher.handleTranslate (C PATH)` — fires with PRICE WILL CHANGE warning
- [ ] `[TRACE:MARGIN] IgnitionProt.useEffect LOAD` + `handleSave` — fires for overhead source

**AUTH TEARDOWN (fix format-collision TD#28):**
- [ ] `[TRACE:AUTH] AccessGatekeeper: format=capability-string (NEW → userCapabilities=[])` — fires for real shop_members users proving the bug
- [ ] `[TRACE:AUTH] IgnitionAdmin.createMember → shop_members.insert` — fires when admin adds staff (confirms new capability-string format)
- [ ] `[TRACE:AUTH] DataBridge.authenticate → FORMAT: capability-string (NEW)` — fires at login

**WORKFLOW TEARDOWN (unwire DataBridge from workflow chain):**
- [ ] `[TRACE:WORKFLOW] IgnitionIntake.submitIntake → creating RO` (with SPLIT-BRAIN note)
- [ ] `[TRACE:WORKFLOW] IgnitionFlux.navigateToJob → routing to module`
- [ ] `[TRACE:WORKFLOW] IgnitionEval.startEval → jobs.update(status=in_eval) STEP 2`
- [ ] `[TRACE:WORKFLOW] CustomerApprovalPortal.handleAuthorize → jobs.update(status=authorized) STEP 4`
- [ ] `[TRACE:WORKFLOW] IgnitionKosk BEGIN REPAIR → onUpdateJob(status=in_repair) STEP 5`
- [ ] `[TRACE:WORKFLOW] IgnitionEstimate.buildEstimate` (with DARK IN PROD note)
- [ ] `[TRACE:WORKFLOW] IgnitionInvoice.generateInvoice → jobs.update(status=invoiced) STEP 7`
- [ ] `[TRACE:WORKFLOW] IgnitionInvoice.processPaymentAndClose → jobs.update(status=closed) STEP 8`

**API/DARK TEARDOWN (port Railway endpoints to Vercel functions):**
- [ ] `[TRACE:API] IgnitionAudit.runAudit → AIEngine.auditInvoice() — DARK IN PROD`
- [ ] `[TRACE:API] IgnitionCipher.handleTranslate → AIEngine.decodeDTC — DARK IN PROD`
- [ ] `[TRACE:API] PredictiveKey.requestAISchedule → AIEngine.suggestPMI — DARK IN PROD`
- [ ] `[TRACE:API] IgnitionEstimate.buildEstimate → POST ...Railway — DARK IN PROD`
- [ ] `[TRACE:API] ExternalBridge.qbo.initiateOAuth — DARK IN PROD` (no Vercel /api/qbo/* functions)
