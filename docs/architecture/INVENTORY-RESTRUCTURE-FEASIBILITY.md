# INVENTORY RESTRUCTURE — FEASIBILITY TEST (RECON ARTIFACT)

**Created:** 2026-06-14 (THUNDER) · **Type:** read-only feasibility test, NOT a restructure.
**Question:** Does David's proposed BUILT-INVENTORY restructure — a **SHARED** section + a
**VERTICAL** section, items classified by where their code lives, a grep-derived **used-by**
column, and a **promotion rule** (when a vertical item is extracted to shared, its entry MOVES
to the shared section) — hold up against the real code?

**Method:** every classification + used-by below is `file:line`-backed by `rg` over
`packages/`, or marked "not found". Vocabulary matches
[LAYER-DEFINITIONS.md](LAYER-DEFINITIONS.md): **TWO layers only — SHARED** (`packages/shared`,
`business_`/`platform_`) and **VERTICAL** (`packages/cultivar-os`, `packages/ignition-os`,
`cultivar_`/`ignition_`). No third "core" layer.

**Authority rule:** the inventory + this doc are CLAIMS; the code is authority. Where the
inventory's hand-written "used by" disagrees with grep, grep wins (and the inventory is wrong —
see Tile System).

---

## BOTTOM LINE (read this first)

**(a) Does the layer-split + promotion model WORK against the real code?**
**PARTLY — it works for the ~majority of single-file items and BREAKS on two things:**
1. **Split-layer artifacts** (5 of them) live in BOTH `packages/shared` AND a vertical package
   simultaneously. "Classify by code location" can't sort a thing that has two locations.
2. **The promotion trigger is ambiguous as stated** ("when a 2nd vertical needs it"). In the
   real code, *extraction-to-shared* (a location event) and *a-2nd-vertical-adopting-it* (a
   usage event) are **different, non-simultaneous events** — almost every shared module is
   already in `shared/` but still used by exactly ONE vertical.

**(b) Where it breaks + the fix:**
- Break 1 (split artifacts) → fix: section by where the **reusable/engine code** lives, and make
  every entry **enumerate all files across layers** (`surfaces:` sub-list). One entry, sectioned
  by its authority layer, never hiding the other half.
- Break 2 (promotion trigger) → fix: **promotion triggers on the CODE FILE moving into
  `packages/shared/`** (git-detectable, unambiguous), NOT on adoption. Adoption is the separate
  **used-by** column, which may legitimately read "1" for a long time.
- Cross-cutting fix: **used-by MUST be grep-derived, never hand-written** — the current
  inventory already contains a FALSE cross-vertical claim (Tile System, below).

**(c) Shared-but-≤1-vertical items** (the column that makes/breaks the model — full list in Part 3).
Headline: only **4** shared items are genuinely used by BOTH verticals
(`BusinessProvider`/context, `OwnerSignup`, `businessGuards` transitively, `supabase/client`).
**Every other shared module is used by exactly ONE vertical** (almost all Cultivar; `AIEngine.ts`
is the lone Ignition-only). All are **correctly shared, adoption pending** — none are
"wrongly shared, should be vertical." Two are unused: `DemoLaunchButton` (zero callers,
waiting-for-adoption) and the broken shared `SavingsReport.jsx` (orphaned, broken import).

**(d) Recommended classification rule** (survives the edges) — see Part 5.

---

## PART 1 — Every current entry, classified by code location

`L` = layer by location. ✅ = naming-layer correct. Split = code in shared AND a vertical.

| # | Entry | Code location (file:line / pkg) | L (location) | Naming |
|---|---|---|---|---|
| 1 | AI Engine | `shared/src/ai/AIEngine.ts` | shared | ✅ |
| 2 | FastAPI AI Backend (legacy) | `CAI/ai_router.py` (archive) | vertical (ignition) | ✅ |
| 3 | Receipt / Expense Storage | `receipts` table (shared schema) **+** `cultivar-os/src/pages/ReceiptKeeper.tsx` | **SPLIT** | ✅ (TD#29: `receipts`→`business_receipts`) |
| 4 | Business Asset Layer | `business_*` tables (shared schema) **+** `cultivar-os/src/pages/BusinessAssets.tsx`,`BusinessInventory.tsx` | **SPLIT** | ✅ |
| 5 | Cost-to-Produce (Config+Tile) | engine `shared/src/business-logic/CostToProduce.ts` + `shared/src/components/CostToProduceSettings.tsx` **+** `cultivar-os/src/pages/CostToProduce.tsx` + tile in `useModules.ts` | **SPLIT** | ✅ |
| 6 | Margin Engine | `shared/src/business-logic/MarginEngine.ts` | shared | ✅ |
| 7 | Subscription Tiers + Pricing | `CAI/docs/pricing_sheet.html` (doc) | vertical (ignition) | ✅ |
| 8 | AdminSubscription / Marketplace | `ignition-os/modules/AdminSubscription.jsx` | vertical (ignition) | ✅ |
| 9 | Trial Clock | `ignition-os/modules/AdminSubscription.jsx` + DataBridge | vertical (ignition) | ✅ |
| 10 | DataBridge | `ignition-os/DataBridge.js` | vertical (ignition) | ✅ |
| 11 | Tile System | `shared/src/components/tiles/TileGrid.tsx`,`Tile.tsx` | shared | ✅ |
| 12 | configureAuth Factory | `shared/src/auth/configureAuth.tsx` | shared | ✅ |
| 13 | Multi-Tenant Auth System | `shared/src/auth/` (members/invitations/accept) | shared | ✅ |
| 14 | BusinessProvider | `shared/src/context/BusinessProvider.tsx` | shared | ✅ |
| 15 | QB Token Refresh | `shared/src/quickbooks/refresh.ts` | shared | ✅ |
| 16 | Notification System | `shared/src/notifications/send.ts`,`queue.ts` | shared | ✅ |
| 17 | Social Media Module | generator `shared/src/social/generate.ts` **+** `cultivar-os/api/social/*`, Dashboard widget | **SPLIT** | ✅ |
| 18 | QR Checkout Flow | `cultivar-os/src/pages/*` + `cultivar-os/api/orders/*` | vertical (cultivar) | ✅ |
| 19 | OwnerSignup | `shared/src/auth/OwnerSignup.tsx` | shared | ✅ |
| 20 | Business Creation Abuse Guards | `shared/src/auth/businessGuards.ts` | shared | ✅ |
| 21 | Pain-Point Onboarding Wizard | `ignition-os/OnboardingWizard.jsx` (root) | vertical (ignition) | ✅ |
| 22 | DemoLaunchButton | `shared/src/onboarding/DemoLaunchButton.tsx` | shared | ✅ |
| 23 | OnboardingWizard — Auth Signup | `ignition-os/modules/OnboardingWizard.jsx` | vertical (ignition) | ✅ |
| 24 | OnboardingWizard (Cultivar) | `cultivar-os/src/pages/OnboardingWizard.tsx` | vertical (cultivar) | ⚠️ writes `nursery_profiles` (Noun-Purge) |
| 25 | Settings Page (Cultivar) | `cultivar-os/src/pages/Settings.tsx` (wraps shared `pages/Settings.tsx`) | **SPLIT** (shared page + cultivar wrapper) | ⚠️ `nurseries`/`nursery_profiles` refs |
| 26 | Orders Page (Cultivar) | `cultivar-os/src/pages/Orders.tsx` | vertical (cultivar) | ✅ |
| 27 | Delivery Routing (Cultivar) | `cultivar-os/src/pages/DeliveryRoute.tsx` | vertical (cultivar) | ✅ |
| 28 | Campaign Scheduler (Cultivar) | `cultivar-os/src/pages/Campaigns.tsx` + `cultivar-os/api/campaigns.ts` + generator `shared/src/campaigns/generate.ts` | **SPLIT** | ✅ |
| 29 | Discovery Module | engine `shared/src/discovery/*` **+** `cultivar-os/api/discovery/ingest.ts`,`src/pages/DiscoveryInspect.tsx` | **SPLIT** | ✅ |
| 30 | CoolRunnings | separate repo (not in monorepo) | N/A | N/A |
| 31 | Ignition Workflow Modules (~35-row table) | `ignition-os/` (root + `modules/` + `hooks/`) | vertical (ignition) | mixed (opaque names = STD-010 debt) |

**Naming-layer flags (vertical noun on a shared/general thing):** none in the *shared* section —
all shared entries already use `business_`/neutral names. The live AC-1 violations are
**inside vertical files** (`nursery_profiles`/`nurseries` in cultivar Settings.tsx +
OnboardingWizard.tsx; `nursery_modules` table pending DROP) — already tracked in the Noun-Purge
backlog, not new. The registry-naming case (`nursery_modules`→`business_modules`) is the one
true "general concept wore a vertical noun" — already migrated.

---

## PART 2 — USED-BY (grepped callers per SHARED item) — the core test

Every row below is grep-verified. "Cultivar uses a different gateway" etc. are confirmed absences.

| Shared item | Used-by (grepped) | Call sites |
|---|---|---|
| **BusinessProvider / context** | **BOTH** ✅ | cultivar `src/App.tsx:3`, `context/NurseryProvider.tsx:1`, + ~12 pages via `useBusinessContext`; ignition `main.jsx:7`, `CoreApp.jsx:13` |
| **OwnerSignup** | **BOTH** ✅ | cultivar `pages/SignUp.tsx:3`, `pages/AddBusiness.tsx:3`; ignition `modules/OnboardingWizard.jsx:2` |
| **Abuse Guards** (`businessGuards`) | **BOTH** ✅ (transitive) | only caller is `shared/src/auth/OwnerSignup.tsx:266` → inherited by every vertical that mounts OwnerSignup |
| **supabase/client** | **BOTH** ✅ | cultivar `src/lib/supabase.ts:1`; ignition `supabase.js:1` |
| **AI Engine** (`AIEngine.ts`) | **ignition only** | ignition `modules/IgnitionAudit.jsx:16`, `IgnitionCipher.jsx:10`, `PredictiveKey.jsx:16`. **Cultivar does NOT import AIEngine** (grep clean) — it uses the separate `ai/execute.ts` gateway |
| **AI gateway** (`ai/execute.ts`, sub-part of #1) | **cultivar only** (transitive) | `shared/src/{social,campaigns,discovery}/*` → cultivar `api/social/*`, `api/campaigns.ts`, `api/discovery/*` |
| **Margin Engine** (`MarginEngine.ts`) | **cultivar only** | via `shared/src/business-logic/CostToProduce.ts:37` ← cultivar `pages/CostToProduce.tsx:29`. Ignition uses its own local `ignition-os/MarginEngine.js` (🔴 deprecated, migration pending) |
| **Tile System** (`tiles/`) | **cultivar only** ⚠️ | cultivar `pages/Dashboard.tsx:8-9`. **Inventory claims "Used by: Ignition AdminSubscription.jsx" — FALSE.** `rg` over `packages/ignition-os` for Tile/TileGrid → **zero hits** |
| **configureAuth** | **cultivar only** | cultivar `src/lib/auth.ts:1`. Ignition uses PIN/DataBridge path |
| **Multi-Tenant Auth** (members/invitations) | **cultivar only** | cultivar `pages/Settings.tsx:13`, `router.tsx:29`. Ignition has its own `shop_members` path |
| **QB Token Refresh** | **cultivar only** | cultivar `api/qbo/invoice/cultivar.ts:2`, `api/qbo/router.ts:15`. Ignition has NO QB Vercel functions at all |
| **Notification System** | **cultivar only** | cultivar `api/orders/submit.ts:2`, `api/discovery/ingest.ts:7`, `src/hooks/useSubmitOrder.ts:2` |
| **Social generator** (`social/generate.ts`) | **cultivar only** | cultivar `api/social/generate-posts.ts:2` |
| **Campaigns generator** (`campaigns/generate.ts`) | **cultivar only** | cultivar `api/campaigns.ts:2` |
| **Discovery engine** (`discovery/*`) | **cultivar only** | cultivar `api/discovery/ingest.ts:3-6` |
| **Cost-to-Produce engine** (`CostToProduce.ts`) | **cultivar only** | cultivar `pages/CostToProduce.tsx:29` |
| **CostToProduceSettings** | **cultivar only** | cultivar `pages/Settings.tsx:4` |
| **shared `pages/Settings.tsx`** | **cultivar only** | cultivar `pages/Settings.tsx:3` (`SharedSettings`) |
| **DemoLaunchButton** | **NEITHER** | `rg DemoLaunchButton packages/{cultivar,ignition}` → no callers (definition only) |
| **shared `components/SavingsReport.jsx`** | **NEITHER (broken)** | imports `../MarginEngine` → `packages/shared/src/MarginEngine.*` **does not exist**. Ignition renders a *local* `./SavingsReport` (`IgnitionOmniDashboard.jsx:14`), not the shared one |

**Cross-vertical isolation confirmed:** cultivar never imports ignition, ignition never imports
cultivar (`rg` both directions → clean). All cross-vertical sharing flows through `shared/` only,
exactly as the two-layer model intends. → no "secretly cross-vertical vertical item" exists today.

---

## PART 3 — Shared-but-≤1-vertical (David's specific question)

### Used by ZERO verticals
| Item | Verdict |
|---|---|
| **DemoLaunchButton** | **Waiting-for-adoption** (not premature-by-mistake). Its own header declares the seam: "any vertical that implements a pain-point wizard + handles `?demo=` can share this button." Ignition's pain-point wizard exists but hasn't wired it. Correctly shared, zero adopters yet. |
| **shared `SavingsReport.jsx`** | **Broken orphan.** Import path dead (`../MarginEngine` missing); no vertical renders it. Not a clean "premature extraction" — it's a half-migrated artifact. Fix the import or delete; do not list as a usable shared capability. |

### Used by exactly ONE vertical — all "correctly shared, adoption pending"
| Item | Used-by | Correctly shared vs wrongly shared |
|---|---|---|
| AI Engine (`AIEngine.ts`) | ignition | **Correctly shared.** Built as a vertical-agnostic multi-provider router; Cultivar simply chose the newer `execute.ts` gateway. Used-by-one (ignition), by design general. |
| Margin Engine | cultivar | **Correctly shared.** TRACE-customer-zero pricing engine; Ignition migration is on the published checklist (`MarginEngine.js` 🔴 deprecated). Adoption pending, not misplaced. |
| Tile System | cultivar | **Correctly shared.** Vertical-agnostic primitive. Ignition's shell is flat-file JSX and hasn't adopted it. (Inventory's "used by ignition" is wrong — see Part 4.4.) |
| configureAuth | cultivar | **Correctly shared.** Explicitly multi-strategy (email + PIN). Ignition uses the PIN/DataBridge path directly today; the factory is the intended convergence point. |
| Multi-Tenant Auth | cultivar | **Correctly shared.** Generic invite/member model; Ignition still on `shop_members`. Adoption pending. |
| QB Token Refresh | cultivar | **Correctly shared.** Generic `business_id` token refresh; Ignition has no QB functions yet. Adoption pending. ⚠️ assumes a token store Ignition lacks — see failure mode 2. |
| Notification System | cultivar | **Correctly shared.** Provider-agnostic sender. Adoption pending. |
| Social generator | cultivar | **Correctly shared.** `business_type`-parameterized (variation is data). Adoption pending. |
| Campaigns generator | cultivar | **Correctly shared.** Same parameterized pattern. Adoption pending. |
| Discovery engine | cultivar | **Correctly shared.** Explicitly cross-vertical engine, admin surface is Cultivar-only today. Adoption pending. |
| Cost-to-Produce engine | cultivar | **Correctly shared.** Per LAYER-DEFINITIONS, general by design (TRACE-zero + both verticals). Adoption pending. |
| CostToProduceSettings | cultivar | **Correctly shared.** Config surface for the above. Adoption pending. |
| shared `pages/Settings.tsx` | cultivar | **Correctly shared.** Page-level shared surface with `verticalSection` slot; Ignition hasn't adopted it. |

**There are ZERO "wrongly shared, should be vertical" items.** Every shared module is genuinely
general by design. The asymmetry is purely **adoption**: Cultivar is the active TS build and
consumes the shared layer broadly; Ignition is the older flat-JSX build and consumes only 4
shared things (context, AIEngine, OwnerSignup, supabase client).

---

## PART 4 — Does the proposal WORK? (with named failure modes)

### 4.1 Does "classify by code location" cleanly sort every entry?
**No — 5+ entries resist because they have TWO locations** (code in `shared/` AND a vertical):
- #3 Receipt/Expense (shared schema + `cultivar/ReceiptKeeper.tsx`)
- #4 Business Asset Layer (shared schema + `cultivar` Assets/Inventory UIs)
- #5 Cost-to-Produce (shared engine+settings + `cultivar` page+tile)
- #17 Social Media (shared generator + `cultivar` API/widget)
- #28 Campaign Scheduler (shared generator + `cultivar` page/API)
- #29 Discovery (shared engine + `cultivar` API/admin page)
- #25 Settings (shared `pages/Settings.tsx` + `cultivar` wrapper)

A binary SHARED-or-VERTICAL section forces each of these into one box and **hides the other half**
— the exact rebuild risk the inventory exists to prevent.

### 4.2 Does "promotion = move the entry when extracted to shared" have a clean trigger?
**The stated rationale is ambiguous; a corrected trigger is clean.** David frames promotion as
"when a 2nd vertical needs it." But the data shows **extraction** (code physically in `shared/`)
and **2nd-vertical adoption** (used-by flips to ≥2) are **different events that rarely coincide**:
~13 shared modules are already extracted yet still used-by-ONE. If the trigger is "a 2nd vertical
needs it," none of those 13 would qualify for the shared section even though they live there.
- **Precise trigger that actually works:** *promotion fires when the CODE FILE moves into
  `packages/shared/`* — a location event, git-detectable, unambiguous. **Adoption is NOT the
  trigger; it is the `used-by` column** (which may read "1" indefinitely and that's fine).

### 4.3 Does the split actually shrink the scannable list for verify-before-build?
**Partially.** Rough counts: **SHARED section ≈ 18–20 entries** (incl. split artifacts);
**VERTICAL section ≈ 12 named cultivar/ignition entries + the ~35-row Ignition module table**.
- For someone about to build a **shared** capability: yes, they scan ~20 shared entries instead
  of 50+. Real win.
- For overall size: the Ignition module table (~35 rows) just relocates into the vertical section
  — bulk moves, doesn't shrink. The split **re-files**, it doesn't **reduce**.

### 4.4 Failure modes found in the actual data
1. **Hand-written used-by is already WRONG.** Tile System's inventory line says
   "Used by: Cultivar Dashboard.tsx, Ignition AdminSubscription.jsx." Grep: **zero Ignition
   Tile usage.** A reader trusts "proven in both verticals" and reuses assuming a cross-vertical
   contract that has never been exercised. → **used-by must be grep-derived, regenerated on audit.**
2. **Used-by-one in the shared section invites unsafe reuse.** `QB Token Refresh` sits in shared,
   looks "general," but only Cultivar runs it — and it assumes an `accounting_token_expires_at`
   store on a `business_id` that **Ignition does not have** (no QB functions). An Ignition builder
   who "reuses the shared QB refresh" wires against a contract that isn't there. Same shape for
   `configureAuth` (Ignition's PIN path) and Multi-Tenant Auth (Ignition's `shop_members`).
   → the shared section needs a visible **`used-by: cultivar only — adoption unproven`** tag.
3. **Split artifacts get mis-sectioned and half-hidden** (4.1). Put Cost-to-Produce wholly in
   SHARED → a builder misses `cultivar/pages/CostToProduce.tsx` + the tile and rebuilds the
   surface. Put it in VERTICAL → they miss the shared engine and rebuild the math.
4. **Secretly-cross-vertical vertical item:** **not present today** (verticals don't import each
   other — confirmed). Low risk now, but the model has no guardrail if a vertical ever imports
   another vertical's file; the grep-derived used-by column is what would catch it.

---

## PART 5 — Recommended classification rule (survives the edges found)

1. **Section = code location of the REUSABLE/engine unit.** `packages/shared` → SHARED section;
   `packages/<vertical>` → that vertical's section. Deterministic, matches LAYER-DEFINITIONS.
2. **Split artifacts: ONE entry, sectioned by the engine/authority layer, with a mandatory
   `surfaces:` sub-list enumerating every file across layers.** e.g. Cost-to-Produce → SHARED
   (engine is authority) · `surfaces: cultivar/pages/CostToProduce.tsx, tile in useModules.ts`.
   Nothing is half-hidden; the binary box stops dropping the other half.
3. **`used-by` is grep-derived `{cultivar | ignition | both | neither}`, never hand-written,**
   regenerated each audit. Fixes failure modes 1, 2, 4 in one move.
4. **Tag every shared entry with adoption state:** `used-by: both` (proven cross-vertical) vs
   `used-by: <one> — adoption pending/unproven` vs `used-by: neither — seam only`. The shared
   section is then honest about which "shared" code is actually battle-tested across verticals
   (only 4 today).
5. **Promotion triggers on the file moving into `packages/shared/`** (location event), NOT on a
   second adopter. Adoption is reflected by the used-by column flipping to `both`, independently.
6. **Carry the existing flags:** broken/orphaned shared artifacts (`SavingsReport.jsx`) marked
   `BROKEN`, not listed as usable; Noun-Purge naming debt stays flagged on the vertical entries.

**Does this match?** It keeps David's two-section + promotion intent, and adds exactly three
guardrails the real data proved necessary: (a) section split artifacts by engine layer with a
cross-layer `surfaces:` list, (b) grep-derive the used-by column, (c) trigger promotion on
file-location not adoption. With those, the model holds against every entry in the current 975-line
inventory. **This is the feasibility verdict — not a restructure. Restructuring is a separate,
approved task.**

---
*RECON ARTIFACT · read-only · no inventory restructure performed · THUNDER 2026-06-14*
