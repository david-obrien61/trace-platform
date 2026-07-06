# PMI Deep Recon — Ignition (donor) vs Cultivar — READ-ONLY

**Date:** 2026-06-23 · **Author:** Thunder · **Mode:** read-only recon, ONE doc, no build
**Question:** Enumerate ALL of Ignition's PMI so nothing powerful is lost in placing/capturing PMI in Cultivar; map port-vs-build; resolve the override-permission David flagged; enumerate cross-links.
**Classification key:** PROVEN (works on real data) · HALF-BUILT (built, stranded/incomplete) · DESIGNED (schema/stub only) · ABSENT.

> **Ignition-DB-key need: NONE.** Ignition's PMI is **localStorage-only** (`DataBridge.load/save` over `pmi_assets` / `pmi_schedules` / `pmi_logs`) — the donor is entirely in the repo code. No Supabase read needed for PMI specifically. (`DataBridge.js:309-310` shows a `pmi_schedules` *Supabase* table for the tool-registry path, but PredictiveKey itself never touches it.)
>
> **Source clarification (corrected 2026-06-23):** the `~/Desktop/CAI/` archive was **RENAMED to `~/Desktop/CAI-archive/` — archived, NOT deleted** (that's why a `CAI/` search returned nothing). CLAUDE.md updated to match. The **live donor is `packages/ignition-os/`** (used here) — and it is the **COMPLETE, newer** capability: `PredictiveKey.jsx` is 710 lines vs the archive's 537, the diff being purely Tailwind classNames → inline styles (the web-build port) + added `STYLE_DEBUG`/`TRACE_API` instrumentation. DataBridge PMI methods identical (6/6). **No capability is truncated in the donor — it is a superset of the archive.** This recon stands on the complete donor; no need to reach into `CAI-archive`.

---

## SECTION 1 — IGNITION PMI (the donor — `packages/ignition-os/modules/PredictiveKey.jsx`, 710 lines)

Module header: *"PRED (Predictive PMI Engine) v2.0.0 — AI-powered preventive maintenance scheduling. Assets surface from active jobs and manual entries. Inspection logs, AI schedule generation via Claude Haiku, ROI tracking (savings + downtime avoided)."* It is a single self-contained component (asset cards + 2 modals). Storage = `DataBridge` PMI methods (`DataBridge.js:1047-1104`), all localStorage.

### 1.1 The maintenance calendar — **ABSENT**
There is **no calendar / M–F grid / weekday view** in Ignition. PredictiveKey renders an **asset card LIST** (`PredictiveKey.jsx:505-689`). Each card shows "Next PMI Due" (a single date string `asset.pmiDue`) + a status pill computed by `pmiStatus()` (`:33-39`): `OVERDUE` (diff<0) / `DUE_SOON` (≤14d) / `HEALTHY` / `NO_SCHEDULE`. The only `Calendar` icon in the whole app is `IgnitionIntake.jsx:11,638` (intake date field) — unrelated to PMI. **The "M–F display / which assets are down" calendar the brief expected does not exist in Ignition.** It would be net-new on either side.

### 1.2 Parts → asset attribution — **ABSENT in PMI**
PredictiveKey has **no part/purchase → asset link**. Assets carry no parts, no receipts, no cost. The schedule's tasks are labels ("Change oil"), not consumed parts. There is no "buy oil filter → attribute to vehicle" mechanism in Ignition's PMI. (Ignition has separate parts/procurement surfaces — `IgnitionProc`/`IgnitionStok`/`PartsList` — but they are job/estimate parts, not wired to PMI asset servicing.) **This receipt→asset categorization is net-new everywhere.**

### 1.3 Scheduled maintenance / intervals — **PROVEN (interval-based) · usage-based is label-only**
- `INTERVAL_DAYS = { daily:1, weekly:7, monthly:30, quarterly:90, annually:365 }` (`:25`).
- AI returns `tasks:[{name, interval, description}]`. **The due date is derived at inspection-log time, not schedule-creation time:** `LogModal.handleSave` (`:201-209`) maps each task's interval → days, takes `nextDays = Math.min(...intervals)`, and sets `asset.pmiDue = addDays(nextDays)`. So logging an inspection is what advances the schedule.
- A schedule is created by **AI only** (`requestAISchedule`, `:402-423`) — there is no manual interval field in the Add-Asset modal (`:59-79` collects name/type/managedBy only). Tuning = re-running AI; "accept" = it auto-saves (see 1.7).
- **Usage-based ("every N miles/hours")** appears only as a possible interval STRING; `INTERVAL_DAYS` has no mileage/hours key, so a usage interval has no day-conversion → it would not advance `pmiDue`. Usage-based is **DESIGNED (label) not PROVEN**.

### 1.4 Asset downtime — **ABSENT as a state · DESIGNED as a derived metric**
No asset has a DOWN / out-of-service state. The closest signals:
- `telematicsRisk` (0-100 health %, PRO-gated, `:556-566`) — a risk score, not a down flag; sourced from job health RED/YELLOW/GREEN (`DataBridge.js:1063`).
- ROI "Downtime Avoided" = `passed.length * 2.5` hrs (`:391`) — a **fabricated rollup metric** (2.5 hrs per passed inspection), not a real downtime model.
**Modeling an asset as DOWN (and the schedule impact of that) is net-new.**

### 1.5 OVERRIDE — the permission David flagged — **ABSENT in PMI · the AUTHORITY PATTERN is PROVEN elsewhere in Ignition**
PredictiveKey has **no override / defer / "use against schedule" mechanism at all**. But Ignition has a strong, reusable **manager-override authority pattern** in three places — the donor for what David wants:

1. **`CoreApp.jsx:459-498` — `AccessGatekeeper`** — the canonical pattern. A permission wall (`requiredPermissions.some(rp => userCapabilities.includes(rp))`). On denial → "Request Manager Override" → manager QR scan → **single-session grant** (`overrideActive=true`) + audit (`DataBridge.smartSync('MANAGER_OVERRIDE_GRANTED', {timestamp, requestedBy})`). "A system log will be generated."
2. **`IgnitionTools.jsx:388-416` — persisted bypass log** (the strongest analog to "use an asset against its rules"): a `bypassLog` of tool-checkout overrides, each row = `tool_name · tech_name · bypass_reason · bypass_by · created_at`, badged "Manager Override". **This is exactly the shape of an asset-use-against-schedule override record: what, who did it, who authorized, why, when.**
3. **`IgnitionKosk.jsx:399-424`** — "Manager Override Required" → **reason required** (`placeholder="Reason for override (required)"`) → "Confirm Override".

**Verdict:** the *concept* (a higher authority authorizes an action the current role can't, with a logged reason + authorizer + single-session scope) is **PROVEN and battle-shaped in Ignition** — just never applied to maintenance. Porting the *pattern* to PMI is the build.

### 1.6 Service log / history — **PROVEN**
`LogModal` (`:186-360`) → `DataBridge.logPMIInspection` (`:1099-1104`). An entry = `date · tech · notes · result (PASS/NEEDS_ATTENTION/FAIL) · per-task checklist (passed bool, seeded from the schedule's tasks)`. Logs are counted per asset and shown as a badge; ROI counts total inspections. Stored localStorage (`pmi_logs[assetId][]`).

### 1.7 AI / predictive bits — **PROVEN (code) but DARK IN PROD · NO review→accept gate**
- `AIEngine.suggestPMI(toolData, shopId, tier)` → `AIEngine.call('pmi_suggest', …)` (`AIEngine.ts:183-185`) → returns `{tasks, detected_type}`.
- **DARK IN PROD:** `requestAISchedule` logs `[TRACE:API] … DARK IN PROD (VITE_API_URL unset; AI schedule generation dead; TD#25)` (`PredictiveKey.jsx:404`). The Railway `ai_router.py` path is legacy/unwired for web.
- **No accept flow:** on success the result is **saved directly** (`DataBridge.savePMISchedule`, `:413`) and shown inline — no review/edit/accept step. The AI's word is taken as-is.
- `telematicsRisk` (1.4) is the other "predictive" surface — PRO-gated health %, no real telemetry feed (job-health derived).

### 1.8 Cross-links — **partial**
- **PMI ← Jobs (PROVEN):** `getPMIAssets` (`DataBridge.js:1049-1072`) auto-surfaces `j.inventory.specialized` items from `active_jobs` as PMI assets (`source:'JOB'`, telematicsRisk from item.health). This is Ignition's one real cross-link — jobs feed the asset registry.
- **PMI ↔ inventory/parts (ABSENT):** no parts-stock or receipt/cost link (see 1.2).
- **PMI ↔ scheduling/dispatch (ABSENT):** no downtime→job-impact wiring (see 1.4).
- **Tier-gating:** ROI dashboard + telematicsRisk are PRO/ELITE-gated (`:370, 473, 556`).

---

## SECTION 2 — CULTIVAR PMI (`packages/shared/src/modules/PMI.tsx`, 749 lines; wrapper `packages/cultivar-os/src/pages/PMI.tsx`, 28 lines)

Cultivar's PMI is a **clean Supabase rewrite** wired to the unified cost-object spine — strictly more architecturally mature than Ignition's localStorage version, but with two real strands.

**Storage (PROVEN, RLS-scoped):**
- Assets = `cost_objects WHERE node_type='ASSET' AND status != 'RETIRED'` (`PMI.tsx:155-161`). (Mahindra tractor, HP ProDesk = these rows.)
- Schedule = `business_pmi_schedule` (`20260612_…pmi_service.sql:163-173`): `interval_days int · tasks jsonb · overrides jsonb DEFAULT '[]' · last_service_at`. RLS owner_all + member_all (`:177-209`).
- Service log = `business_service_log` (`:226-...`): `service_type · performed_by · notes · cost · result · receipt_id · performed_at`. **Append-only / immutable** (no updated_at; "corrections create new rows"). The real "Filter Replacement" log lives here.

**What works (PROVEN):**
- Asset registry + add-asset form (manual `interval_days` via "PMI every (days)", `:682-684`).
- `getPMIStatus` (`:75-81`): `OVERDUE / DUE_SOON (within 7d) / OK / NONE` — requires **both** `interval_days` AND `last_service_at`.
- Log service (`handleLogService`, `:266-323`): writes service_log + bumps `last_service_at` on the schedule. Result PASS/NEEDS_ATTENTION/FAIL + per-task checklist.
- Service history list, overdue/due-soon count chips.

**What's stranded (HALF-BUILT) — two precise strands:**
1. **AI suggest never infers `interval_days`.** `/api/pmi/suggest` is **LIVE and real** (`packages/cultivar-os/api/pmi/suggest.ts`, Claude **Sonnet 4-6**, not Haiku; returns `{tasks:[{name, interval}]}` where interval is a human STRING incl. "every N miles/hours"). `handleSuggestSchedule` (`PMI.tsx:327-404`) writes the `tasks` into the schedule **but never sets `interval_days`**. Cultivar has **no `INTERVAL_DAYS` map / task-interval→days conversion** (grep-confirmed: only `interval_days` the column, never the conversion). Result: an AI-suggested asset shows its task list but `getPMIStatus` stays `NONE` (interval_days null) → **the suggested schedule never produces a due date / OVERDUE.** Ignition's `INTERVAL_DAYS` + `min(intervals)` (1.3) is the missing piece.
2. **No review→accept gate.** Like Ignition, the AI tasks are auto-written on success — there is no step to review/edit the suggestion before it's saved, and (combined with #1) no step where accepting the suggestion sets the cadence. The "stranded accept-flow" = (a) no preview/accept UI + (b) accepting doesn't derive interval_days.

**ABSENT in Cultivar (same as Ignition):** maintenance calendar; parts→asset attribution (the `receipt_id` column exists on service_log as the count-once seam — comment "linked by receipt flow later" `:283` — but is always written null); asset DOWN state / downtime; override mechanism; job/order auto-surfacing of assets; telematics/risk; ROI dashboard.

**Latent (DESIGNED, unused):** `business_pmi_schedule.overrides jsonb NOT NULL DEFAULT '[]'` (`20260612_…:169`) — **grep-confirmed read/written nowhere.** The schema already anticipated an override store. This is a ready home for the override record (1.5 / Section 3).

---

## SECTION 3 — PORT-VS-BUILD MAP + the OVERRIDE permission

| PMI bit | Ignition state | Cultivar state | Disposition | Notes |
|---|---|---|---|---|
| Asset registry | PROVEN (localStorage) | PROVEN (cost_objects ASSET) | **keep Cultivar** | Cultivar is the mature one; Ignition adds nothing here. |
| Interval schedule + status | PROVEN (pmiDue on asset) | PROVEN (interval_days + last_service_at) | **keep Cultivar** | Different model; Cultivar's is normalized. |
| **task-interval → interval_days conversion** | PROVEN (`INTERVAL_DAYS` + `min()`) | **ABSENT** | **PORT** | The fix for strand #1. Small, mechanical port of `PredictiveKey.jsx:25,204-206`. |
| Service log / history | PROVEN | PROVEN (+ result, immutable) | **keep Cultivar** | Cultivar superset (cost, receipt_id seam). |
| AI suggest schedule | PROVEN-code / DARK | LIVE (Sonnet) | **keep Cultivar** | Cultivar's endpoint actually runs. |
| **Review→accept gate** | ABSENT (auto-saves) | HALF-BUILT (auto-saves, inert) | **BUILD-NEW** | Neither has it; build a preview→edit→accept step that also derives interval_days. |
| Maintenance calendar (M–F / due-by-day) | ABSENT | ABSENT | **BUILD-NEW** | See shared-calendar note below. |
| Parts→asset attribution (receipt→asset) | ABSENT | DESIGNED (receipt_id col, null) | **BUILD-NEW** | Wire receipt line → service_log/asset. Net-new logic; the column seam exists. |
| Asset DOWN / downtime | DESIGNED (fabricated metric) | ABSENT | **BUILD-NEW** | Clean add: a `status` value on cost_objects (already filters RETIRED) or a schedule flag. |
| Override / use-against-schedule | ABSENT in PMI; **authority PATTERN PROVEN** (AccessGatekeeper + bypassLog) | ABSENT; **`overrides` jsonb latent** | **PORT pattern → BUILD on it** | See below. |
| Asset auto-surface from jobs | PROVEN (active_jobs) | ABSENT | **BUILD-NEW (defer)** | Cultivar has no jobs concept yet; revisit when orders/installs model maturity allows. |

### The OVERRIDE permission — proposal
**David's concept:** using/deferring an asset against its scheduled maintenance (tractor is due/down but needed to plant; truck needs an oil change but a run is scheduled) requires authority.

**Donor (PORT the pattern, not the code):** Ignition's manager-override authority — single-session grant + **reason-required + authorizer-logged** audit row (`IgnitionTools.jsx:388-416` bypassLog shape: *what · who · who-authorized · why · when*). Cultivar already has the store: `business_pmi_schedule.overrides jsonb` (latent, unused) is the natural home for these records.

**Permission fit with the registry + role-config console — CLEAN ADD, one nuance:**
- Propose a new permission string, e.g. **`override_maintenance`** (alt: `authorize_asset_use`). It gates the *action* of deferring/using an asset against its schedule.
- The role-config console (`RoleConfig.tsx:77`) builds its chip catalog from **`registryPermissions() ∪ ALL_FINANCIAL_PERMISSIONS` minus `owner-only`**. `registryPermissions()` (`tileRegistry.ts:274`) enumerates only permissions used as a **tile's `required_permission`**.
- **Nuance (flag):** because `override_maintenance` gates an *action*, not a *tile*, it will **NOT** auto-appear in the console from `registryPermissions()`. It must be registered in a canonical catalog the console unions in — **exactly the pattern `ALL_FINANCIAL_PERMISSIONS` already established** (financial-wall perms gate data/actions, not tiles, and are unioned in for that reason). So: add `override_maintenance` to a canonical action-permission list (or extend the financial-perms-style catalog) → it surfaces as a chip, is assignable per role, clone-not-mutate, factory-resettable — **the console needs zero new capability.** This is **not a special case**; it reuses an established seam. Default it OFF for STAFF, ON for OWNER/MANAGER in `DEFAULT_PERMISSIONS`.
- **Verdict:** fits the console **YES** — provided the permission is added to the catalog source (one-line, established pattern), not assumed to appear via tile-gating.

### The stranded accept-flow — what finishing it takes
1. Port `INTERVAL_DAYS` + `min(taskIntervals) → interval_days` (Ignition `:25,204-206`) into `handleSuggestSchedule`.
2. Insert a **preview/edit/accept** step between the AI response and the DB write (today the write is immediate). On accept: write `tasks` AND the derived `interval_days` → status begins computing → OVERDUE/DUE_SOON works.
3. (Optional) let the user override the derived interval before accept.

### Shared calendar component — worth observing (do NOT build)
A calendar grid would have **≥3 consumers**, all currently bespoke day-grouped lists, none reusable:
- **PMI** (net-new) — assets due by day/week.
- **Delivery** — `DeliverySchedule.tsx` already groups deliveries by day (bespoke).
- **Campaigns/Social** — `campaign_posts.scheduled_date`, `CampaignDetail.tsx`/`SocialSetup.tsx` (bespoke).
This is the same shape as the breadcrumb shared-component call: build **one shared `<Calendar>`** (day-grid + "items due/scheduled on day N") and feed it three data sources, rather than three one-off calendars. **Observation for design capture — not this build.**

---

## SECTION 4 — CROSS-LINKS (enumerate for capture, do NOT build)

David named three PMI relationships that are FEATURES, not nav. All are **net-new** in Cultivar (Ignition wires none of them either):

1. **PMI → Receipts** (maintenance cost via parts purchases categorized to the asset). Net-new. The seam exists (`business_service_log.receipt_id`, count-once design) but is never populated; no receipt-line → asset attribution logic anywhere. *(= the parts→asset attribution of 1.2/3.)*
2. **PMI → Assets** (what's maintained, what's down). The asset side is PROVEN (PMI reads cost_objects ASSET); the **"what's down" side is net-new** (no downtime state exists).
3. **PMI ↔ Delivery** (asset downtime → schedule impact: tractor down → planting delayed; truck due → override to make a run). **Fully net-new** — requires both the downtime state (3/1.4) and the override (1.5) before any delivery-impact wiring is meaningful. This is the surfacing-engine family (same as Regina urgency / Delivery route-opportunity) — a **design CAPTURE**, not this build.

**Ignition wires of these:** only **PMI ← Jobs** (asset auto-surface, 1.8) — which is a *source* link, not one of David's three. None of the three David named are wired in Ignition.

---

## CLOSING VERDICT (3 lines)

1. **Ports from Ignition's PMI:** the **task-interval→`interval_days` conversion** (`INTERVAL_DAYS` + `min()`) and the **manager-override authority pattern** (reason-required, authorizer-logged, single-session — `AccessGatekeeper` + `bypassLog` shape). Everything else in Ignition's PMI is *inferior to* Cultivar's already-built Supabase version — keep Cultivar; no UI/data port needed.
2. **Override-permission:** propose `override_maintenance` (records into the **latent `business_pmi_schedule.overrides jsonb`**) — **fits the registry + role-config console YES**, with one nuance: it gates an action not a tile, so it must be registered in a canonical catalog (the `ALL_FINANCIAL_PERMISSIONS` pattern), not assumed to surface via tile-gating. Clean add, established seam, zero new console capability.
3. **Net-new cross-links (capture, not build):** PMI→Receipts (parts→asset attribution), PMI→Assets "what's down" (downtime state), PMI↔Delivery (downtime→schedule impact + override-to-run). A **shared `<Calendar>` component** (3 consumers: PMI, Delivery, Campaigns) is worth a design capture.

**Decisions owed (David):** (a) the override-permission name + default role assignment; (b) port-scope this pass — minimal (finish accept-flow + interval_days) vs full (add downtime + override) ; (c) which cross-links graduate to a design capture. **No Ignition DB key needed.** No build performed.
