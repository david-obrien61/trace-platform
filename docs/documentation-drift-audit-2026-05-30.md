# Documentation Drift Audit — 2026-05-30
# 14-day repo scan (2026-05-22 → 2026-05-30) against canonical docs
# READ ONLY — no code was modified to produce this report

---

## TASK 1 — Inventory of recent additions (grouped by package)

### packages/cultivar-os/ — USER-VISIBLE (new pages/routes/components)

| File | First commit | Description |
|---|---|---|
| `src/pages/Orders.tsx` | 2026-05-28 | Last 50 orders list — green/red leakage border, transport icons, customer + amount. Route: `/orders` |
| `src/pages/OnboardingWizard.tsx` | 2026-05-28 | 5-step first-run: WELCOME → NURSERY_SETUP → CHOOSE_PATH (4 paths) → PATH_EXPERIENCE → DONE. Writes to `businesses` + `nursery_profiles` on finalize |
| `src/pages/DeliveryRoute.tsx` | 2026-05-28 | Delivery stop planner — checkbox per stop, inline address entry, Google Maps multi-stop URL, Text to Driver SMS. Route: `/deliveries` |
| `src/pages/Settings.tsx` | 2026-05-29 | Cultivar wrapper around shared Settings — Business Profile, QB connection, service_offerings management, default install price. Route: `/settings` |
| `src/pages/Campaigns.tsx` | 2026-05-29 | Campaign list/create — browse campaigns by type (seasonal/holiday/etc.), tone samples, entry point to CampaignDetail. Route: `/campaigns` |
| `src/pages/CampaignDetail.tsx` | 2026-05-29 | Per-campaign post generation — AI drafts from brief + tone samples, review, publish via Blotato. Route: `/campaigns/:id` |
| `src/pages/PMI.tsx` | 2026-05-29 | Cultivar wrapper around shared PMI — equipment types (Tractor, Truck, Sprayer…), `assetLabel="Equipment"`. Route: `/pmi` |
| `src/pages/DiscoveryInspect.tsx` | 2026-05-29 | David-only internal tool — URL + vertical + pain point → website ingestion → AI "silent partner" analysis email. URL is the auth gate. Route: `/discovery/inspect` |
| `src/components/checkout/CompliancePrompt.tsx` | 2026-05-29 | Generic legal/compliance notice at checkout — title, body, price per unit, accept/decline. Covers TX TCC Ch.725, DOT, EPA patterns. Replaces hardcoded NettingPrompt |

### packages/cultivar-os/ — INFRASTRUCTURE

| File | First commit | Description |
|---|---|---|
| `src/hooks/useServices.ts` | 2026-05-29 | Fetches `service_offerings` for a `businessId` (replaces useAddons pattern) |
| `src/hooks/useBusiness.ts` | 2026-05-29 | Queries `businesses` table directly for current owner |
| `src/context/NurseryProvider.tsx` | 2026-05-29 | Converted to thin re-export shim → `useBusinessContext()` |
| `src/lib/constants.ts` | 2026-05-29 | `DEMO_NURSERY_ID` → `DEMO_BUSINESS_ID` |

### packages/shared/ — USER-VISIBLE (components users see)

| File | First commit | Description |
|---|---|---|
| `src/modules/PMI.tsx` | 2026-05-29 | Shared PMI component — asset list with OVERDUE/DUE_SOON/OK status badges, detail view, service log form. Inline styles. Props: `{ businessId, assetLabel, assetTypes, serviceTypes }` |
| `src/pages/Settings.tsx` | 2026-05-29 | Shared Settings page — Business Profile (editable), Accounting section (QB connect/disconnect), service_offerings management (add/edit/toggle), `verticalSection` injection point |

### packages/shared/ — INFRASTRUCTURE

| File | First commit | Description |
|---|---|---|
| `src/context/BusinessProvider.tsx` | 2026-05-29 | auth.uid() → `businesses` table → `businessId`. Replaces NurseryProvider. `businessType` prop selects vertical |
| `src/campaigns/generate.ts` | 2026-05-29 | Claude Sonnet 4.6 post generation from campaign brief + tone sample few-shots |
| `src/campaigns/types.ts` | 2026-05-29 | `Campaign`, `CampaignPost`, `ToneSample` types |
| `src/discovery/` (6 files) | 2026-05-29 | Website ingestion engine: fetch → parse → synthesize via Claude → return `BusinessDiscoveryProfile` + `SilentPartnerAnalysis` |
| `src/utils/formatCurrency.ts` | 2026-05-29 | `formatDollars`, `formatMoney`, `formatMoneyOrDash` |
| `src/utils/dateHelpers.ts` | 2026-05-29 | `formatDateShort`, `formatDateTimeShort`, `todayRange`, `daysBetween` |
| `src/utils/statusColors.ts` | 2026-05-29 | `STATUS_COLORS`, `PMI_STATUS_COLORS`, `ORDER_STATUS_COLORS` token maps |
| `src/components/FormField.tsx` | 2026-05-29 | Label + required marker + error + hint wrapper; shared `inputStyle` constant |
| `src/components/ProgressBar.tsx` | 2026-05-29 | Accessible progress bar; configurable fill/track/height |
| `src/components/Skeleton.tsx` | 2026-05-29 | Pulsing skeleton block + `SkeletonCard` variant |
| `src/pricing/marginEngine.ts` | 2026-05-29 | `calculateRetail` (slab 4×/2×/1.5×/1.25×), `calculateMargin` |

### packages/ignition-os/ — USER-VISIBLE

| File | First commit | Description |
|---|---|---|
| `modules/OnboardingWizard.jsx` | 2026-05-29 | Ignition new-shop flow: WELCOME → SHOP → ACCOUNT → PIN → DONE. Creates `businesses` + `shops` + `shop_members`; seeds DataBridge |

### supabase/migrations/ — INFRASTRUCTURE

All added 2026-05-29: `businesses_a` through `businesses_g` (Cultivar multi-tenant schema), `campaigns.sql`, `pmi_shared.sql`, `ignition_businesses.sql`.

---

## TASK 2 — Cross-reference against built-inventory.md

`built-inventory.md` was **created on 2026-05-28 and has not been updated since** (confirmed: `git log -- docs/built-inventory.md` shows zero commits after `8b151fdf` on 2026-05-28). All work from 2026-05-29 onward is undocumented in the inventory.

| File / Capability | In built-inventory.md? | Section (if yes) | Notes |
|---|---|---|---|
| Orders page (`/orders`) | ❌ No | — | Inventory's "Not Yet Built" gap table doesn't mention it; just appeared |
| Cultivar OnboardingWizard | ⚠️ Wrong | "What Is NOT Yet Built" — "Signup → nursery row creation: new accounts show error" | Inventory explicitly says this is not built; it IS built and creates the business row |
| DeliveryRoute (`/deliveries`) | ❌ Wrong | "What Is NOT Yet Built" — "Delivery routing: Tile exists, nothing built" | Inventory says not built; it IS built |
| Settings page (Cultivar + shared) | ❌ Wrong | "What Is NOT Yet Built" — "Settings page: No UI for default install price…" | Inventory says not built; it IS built |
| Campaigns + CampaignDetail | ❌ No | — | Not mentioned anywhere in inventory |
| Campaign Scheduler (shared generate.ts) | ❌ No | — | Not mentioned |
| PMI module (shared) | ❌ No | — | Not mentioned; `pmi_suggest` AI task is in inventory but not the built PMI module |
| PMI page (Cultivar) | ❌ No | — | Not mentioned |
| DiscoveryInspect tool | ⚠️ Partial | DISCOVERY_MODULE_BRIEF.md mentions it | Brief exists but was written same session as the build; describes design intent, not built state |
| CompliancePrompt component | ❌ No | — | Not mentioned |
| BusinessProvider + businesses table | ❌ No | — | Multi-tenant phase 1 not reflected |
| service_offerings pattern | ❌ No | — | Mentioned as future work in memory files; not in inventory |
| Shared utilities (7 files) | ❌ No | — | None of the utility extractions are in inventory |
| Ignition OnboardingWizard (new version) | ⚠️ Stale | "OnboardingWizard (Ignition OS)" section exists | Inventory describes 3 paths + TeamQR step; current code has 4 steps (no TeamQR), PIN step added, creates `businesses` not just `shops` |

**Summary:** 3 items in built-inventory.md's "Not Yet Built" table are actually built. 10+ user-visible additions from 2026-05-29 have zero inventory coverage.

---

## TASK 3 — The four Cultivar pain-point paths

Found in `packages/cultivar-os/src/pages/OnboardingWizard.tsx`, lines 530–602 (the `renderChoosePath` function). Type definition at line 411: `type Path = 'LEAKAGE' | 'CHECKOUT' | 'SETUP' | 'DELIVERY'`.

Exactly **four** paths exist. None use ingested website data — all are static or user-entered.

**Path 1 — LEAKAGE** (`LeakagePath`)
- UI title: "Show me what I'm losing"
- Hook: "Calculate the add-on revenue leaving with every declined netting or install" · Badge: "Most impactful"
- What it does: User enters netting price and avg trees/week → calculates weekly and annual missed revenue projection. Static math, no live data.
- Data source: User input (no discovery/ingestion)
- Route: `/onboarding` (internal step, not a separate route)
- First commit: `0720ba8` — 2026-05-28

**Path 2 — CHECKOUT** (`CheckoutPath`)
- UI title: "Show me how checkout works"
- Hook: "Walk through QR scan → add-ons → QuickBooks invoice in under a minute" · Badge: "Fastest demo"
- What it does: 4-slide visual walkthrough with hardcoded slide content: "QR Tag on Every Tree" → "Customer Scans → Sees Plant Profile" → "Add-Ons Prompted Automatically" → "QuickBooks Invoice Auto-Created"
- Data source: Static hardcoded content
- Route: `/onboarding`
- First commit: `0720ba8` — 2026-05-28

**Path 3 — SETUP** (`SetupPath`)
- UI title: "Set up my nursery"
- Hook: "Connect QuickBooks, review your inventory, and get ready for the first scan" · Badge: "Full setup"
- What it does: QB connection teaser using nurseryInfo entered in the NURSERY_SETUP step (name, phone, address)
- Data source: User-entered nursery info from prior step
- Route: `/onboarding`
- First commit: `0720ba8` — 2026-05-28

**Path 4 — DELIVERY** (`DeliveryWizardPath`)
- UI title: "Route my deliveries"
- Hook: "Enter stops, build an optimized route, and text it to your driver in one tap" · Badge: "New"
- What it does: Demo delivery stops → generates Google Maps multi-stop URL → native SMS to driver
- Data source: Demo stops (static or inline-entered, not pulled from orders table)
- Route: `/onboarding`
- First commit: `0d09963` — 2026-05-28

**None** of the four paths are documented in built-inventory.md, CLAUDE.md (mentioned only as "4 paths" in handoff), or session-summary-2026-05-29-30.md at the path level. The path names, hooks, and data behavior exist only in the code.

---

## TASK 4 — Documentation drift patterns

**Pattern 1 — The inventory has no update trigger.** `built-inventory.md` was built once, on a single session, and then never touched. The session-end protocol in CLAUDE.md (Part 9) lists 7 mandatory steps — none of them mention built-inventory.md. The inventory was designed to be authoritative but has no mechanism to stay current. The result: 3 entries in the "Not Yet Built" table are now built, making the most critical section of the doc actively wrong.

**Pattern 2 — Headlines get documented; sub-components don't.** Session summaries and CLAUDE.md handoffs capture the page-level work ("Campaigns page built," "OnboardingWizard built") but miss the supporting layer: the four specific path names and behaviors inside OnboardingWizard, the CompliancePrompt replacing the NettingPrompt, the useServices hook replacing useAddons, the specific slides inside CheckoutPath. These sub-components require reading the code to discover.

**Pattern 3 — Shared infrastructure is invisible to the inventory.** The 7 utility extractions (formatCurrency, dateHelpers, statusColors, FormField, ProgressBar, Skeleton, MarginEngine) are fully in the codebase but not in built-inventory.md. The inventory is organized by user-facing capability, which means horizontal infrastructure never gets an entry. This will cause future sessions to re-implement things that already exist.

**Pattern 4 — "Not Yet Built" entries are never closed.** The gap table has no lifecycle. Once something is added to gaps, nothing removes it when it's built. The gap table currently says Delivery routing and Settings are not built — both shipped two days after the table was written. This is the highest-risk drift: a future Claude Code session reading the inventory will be told to build something from scratch that already exists.

**Pattern 5 — Internal tools have no documentation home.** `DiscoveryInspect.tsx` — a full production-deployed page — exists in no inventory doc. It's mentioned in DISCOVERY_MODULE_BRIEF as a design intent, but its built state, route, and data behavior are undocumented. The same will be true of any future internal tooling.

---

## TASK 5 — Proposed process fix

**Adopt the proposed session-end git diff check, with one addition: close gaps explicitly.**

The proposed check is correct and cheap. Here is the tightened version:

**Step 1 — Run at session end (30 seconds):**

```bash
git diff --name-only $SESSION_START_COMMIT HEAD -- \
  'packages/*/src/pages/*.tsx' \
  'packages/*/src/components/**/*.tsx' \
  'packages/*/modules/*.jsx' \
  'packages/*/src/modules/*.tsx'
```

This produces the list of user-visible files touched in the session. Any file on this list must satisfy ONE of:
- It is mentioned by filename in `docs/built-inventory.md`, OR
- It is explicitly added to a `## Deferred for documentation` section at the bottom of the current session's commit message

**Step 2 — Close gaps explicitly (additional, same cost):**

For each file on the list, also run:
```bash
grep -c "FILENAME" docs/built-inventory.md
```
If the count is zero, the operator must either add a one-line inventory stub OR write `DEFERRED: filename — reason` in the commit. This is the gate the current protocol is missing.

**Step 3 — Close "Not Yet Built" entries that shipped:**

Add one line to CLAUDE.md Part 9 (End-of-Session Protocol): "Check the 'What Is NOT Yet Built' table in built-inventory.md — strike any item you built this session." This takes under 2 minutes and eliminates Pattern 4.

**Why this works:** It produces a commit-level artifact (the message addition or inventory update) that is visible in `git log`. It is mechanical — a filename either appears in built-inventory.md or it doesn't. It does not require judgment about what counts as "important enough to document." It runs at the END of the session when the diff is concrete, not throughout.

**Why the current protocol fails:** CLAUDE.md Part 9 has 7 mandatory steps, none of which reference built-inventory.md. The inventory was designed with the right intent but was disconnected from the workflow that was supposed to keep it current.

---

*Audit produced by Claude Code — read-only investigation, no code modified.*  
*Commit this doc only. Do not update built-inventory.md as part of this audit.*
