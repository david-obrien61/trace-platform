# CANONICAL TILE CLASSIFICATION — general / vertical / cross-vertical

**The authority for where a tile belongs.** Companion to
[LAYER-DEFINITIONS.md](LAYER-DEFINITIONS.md). **Code wins on conflict** (audit rule);
re-validate when tiles move. **Reference only — classifying tiles is NOT building the App
Store** (NORTH-STAR: don't build the store until there's a shelf worth browsing). Created
2026-06-14.

This doc exists to stop the re-derivation. We keep re-asking "is this tile general or
vertical or cross-vertical?" Answer it once, here, grounded in the App Store model and the
layer definitions, and verified against the live code (see Verification at the bottom).

---

## THE THREE CLASSES

Grounded in the App Store model layered on the two-layer architecture from
LAYER-DEFINITIONS.md (SHARED = general/core; VERTICAL = per-vertical config + feeds).

- **GENERAL** — lives in the shared substrate; every vertical gets it. Maps to the
  **SHARED layer** (`packages/shared/`, `business_`/`platform_` tables). It is the
  *intersection* of the verticals — capability both Ignition and Cultivar need. A general
  tile must carry **no vertical noun** (AC-1). Examples: Settings, RBAC/Admin,
  Cost-to-Produce/Margins, the tile primitives, the module registry, the onboarding
  pattern.

- **VERTICAL** — specific to one collection/vertical; only meaningful there. Maps to the
  **vertical layer** (`cultivar_`/`ignition_` tables, vertical-local pages). Examples:
  Cultivar QR Plant Checkout, Plant Events, Seasonal/Greenhouse; Ignition Compliance/USDOT,
  Dispatch (fleet GPS), Cipher (DTC fault codes), the vehicle-intake flow.

- **CROSS-VERTICAL** — built in/for one vertical but installs into others; **may DECLARE A
  DEPENDENCY** ("requires X"). The App Store handles these like "this app requires X" and
  enforces the dependency gracefully. The capability is general (shared engine) even though
  the first consumer was one vertical. Examples: Campaign Engine (shared infra serving
  Cultivar Seasonal + Pantry campaigns), QuickBooks, Social composer, Invoice Vision/Leakage
  Audit, Cost-to-Produce.

**General vs cross-vertical — the practical test:** GENERAL = present everywhere by
default, no dependency to declare (Settings, Admin, the registry itself). CROSS-VERTICAL =
an *installable* capability whose engine is shared but which a vertical opts into and which
may require another capability/integration to be present. Both live in shared code; the
difference is whether it's substrate (always there) or an app on the shelf (installs,
declares deps).

---

## CLASSIFICATION TABLE — Cultivar OS grid tiles

Source registry: `business_modules` table (renamed from `nursery_modules` 2026-06-04;
seed rows at `supabase/migrations/20260604_business_modules.sql:82-92`). UI metadata:
`MODULE_META` at `packages/cultivar-os/src/hooks/useModules.ts:33-50`. Rendered at
`packages/cultivar-os/src/pages/Dashboard.tsx:743-759`.

| Tile (`module_key`) | Class | Where the capability lives | Naming-layer correctness | Notes |
|---|---|---|---|---|
| `qr_checkout` | **Vertical** | Cultivar `pages/Orders.tsx` + `api/orders/submit.ts`; tables `orders`/`order_items`/`customers`. QR **primitive** is shared (`shared/src/qr/`). | OK at registry (`business_modules`). The shared QR primitive is general; the checkout flow is vertical. | Plant-scan → order is cultivar POS. The general piece (QR gen/print) is already in shared. |
| `qb_invoicing` | **Cross-vertical** | Shared `shared/src/quickbooks/` (oauth/refresh/invoice/customer); consumed by Cultivar `api/qbo/router.ts:1` and Ignition INVOICE. | OK. ⚠️ `oauth.ts` hardcodes `IGNITION_OS_DATA` storage key (AC-1, post-demo — Part 7/tech-debt). | Declares dependency: "requires QuickBooks connection." Classic store "requires X." |
| `online_shop` | **Vertical** | Not built (coming-soon modal). Intended cultivar storefront. | n/a yet | Locked on starter tier. |
| `social_media` | **Cross-vertical** | Shared `shared/src/social/generate.ts` + `ai/execute.ts`; Cultivar `pages/SocialSetup.tsx` + `api/social/*`. Only Cultivar consumes today. | OK. Engine is `businessType`-driven (AC-1 clean). | Engine general; Ignition has no social module yet — installable there. |
| `followup_engine` | **Cross-vertical** (concept) | Not built. Customer follow-up is a general concept. | n/a yet | Locked on starter tier. |
| `delivery_routing` | **Vertical** (today) | Cultivar `pages/DeliveryRoute.tsx`; tables `orders`/`customers`. | OK | Routing concept is generalizable, but impl is cultivar-local. |
| `contractor_tiers` | **Vertical** | Not built. | n/a yet | Locked on starter tier. |
| `seasonal_module` | **Cross-vertical** | Not built as a tile; the **Campaign Engine** it would drive is shared (`shared/src/campaigns/`), serving Cultivar Seasonal + Pantry. | OK | Prime cross-vertical example: shared campaign infra, vertical feed. |
| `business_insights` | **General** (concept) | Not built. Cross-business insights is substrate. | n/a yet | Locked on starter tier. |
| `inventory_intake` | **Cross-vertical** | Not built as a tile; backing table `business_inventory` is shared/general. | OK (`business_` table) | Inventory is a general capability; intake UI would be vertical-flavored. |

**Cultivar non-tile dashboard surfaces** (rendered inline, not in the grid): metric cards,
leakage alert (`Dashboard.tsx:666-710`), QB status, social drafts, campaign scheduler card
(→ `/campaigns`). The **Campaign scheduler** is the live surfacing of the shared
(cross-vertical) Campaign Engine.

---

## CLASSIFICATION TABLE — Ignition OS grid tiles

Source registry: hardcoded `DASH_APPS` array at
`packages/ignition-os/CoreApp.jsx:53-73` (no DB registry — flat-file, not migrated to a
`src/` tree). Rendered at `CoreApp.jsx:1085-1120`.

| Tile (ID) | Label | Class | Where the capability lives | Notes |
|---|---|---|---|---|
| `INTAKE` | New RO | **Vertical** | `modules/IgnitionIntake.jsx` — customer+vehicle+VIN intake | Auto-specific. |
| `ESTIMATES` | Estimates | **Vertical** | `modules/IgnitionEstimate.jsx` | Repair estimates. |
| `EVAL` | Tech Eval | **Vertical** | `modules/IgnitionEval.jsx` | |
| `INVOICE` | Invoice | **Cross-vertical** | `modules/IgnitionInvoice.jsx` — QB via shared `quickbooks/` | Requires QuickBooks. |
| `OMNI` | Command | **Vertical** | `modules/IgnitionOmni.jsx` — ignition command center | Vertical dashboard, not the shared shell. |
| `HUB` | Dispatch | **Vertical** | `modules/IgnitionHub.jsx` — fleet GPS/telematics map | Fleet-specific. |
| `FLUX` | Workflow | **Vertical** | `modules/IgnitionFlux.jsx` — job stage tracking | |
| `PREDICTIVE` | Predict | **Cross-vertical** | `modules/PredictiveKey.jsx` — preventive-maintenance + ROI; PMI engine is shared (`shared/src/modules/PMI.tsx`, `business_pmi_schedule`); uses shared `AIEngine`. | PMI is a general concept (`business_` tables); Ignition supplies fleet feed. |
| `CIPHER` | Cipher | **Vertical** | `modules/IgnitionCipher.jsx` — DTC fault-code lookup; uses shared `AIEngine` | Auto-specific data; general engine. |
| `STOK` | Inventory | **Vertical** | `modules/IgnitionStok.jsx` — bins tied to fault codes | Inventory concept general; impl auto-specific. |
| `PROC` | Vendors | **Vertical** | `modules/IgnitionProcure.jsx` | Procurement concept generalizable. |
| `CRM` | Clients | **General** (concept) | `modules/IgnitionCRM.jsx` — ignition-local impl | Customer directory is substrate; not yet shared. |
| `PROT` | Margins | **Cross-vertical / General** | `modules/IgnitionProt.jsx` — labor/overhead/margin config; uses shared `MarginEngine.ts` | The **v1 sketch of the shared Cost-to-Produce config surface** (LAYER-DEFINITIONS §PROT). Harvest fields, don't restore the orphan. |
| `PORT` | Estimates | **Cross-vertical** | `modules/IgnitionPort.jsx` — customer portal + signature; uses shared `MarginEngine` | |
| `COMPLIANCE` | Compliance | **Vertical** | `modules/IgnitionCompliance.jsx` — 24-pt DOT/USDOT audit | Auto/trucking-specific. |
| `MARKETPLACE` | Market | **General** | `modules/AdminSubscription.jsx` — module trials, umbrella fee (billing/subscription) | Billing substrate; baseline for shared billing layer. |
| `AUDIT` | Audit | **Cross-vertical** | `modules/IgnitionAudit.jsx` — invoice vision/leakage; uses shared `AIEngine` | Leakage detection is general; Cultivar has its own leakage flag. |
| `ADMIN` | Admin | **General** | `modules/IgnitionAdmin.jsx` — team/permissions/config | Maps to shared auth/RBAC + Settings. Ignition-local impl today. |
| `TOOLS` | Tools | **Vertical** | `modules/IgnitionTools.jsx` — dev utilities | Local. |

---

## SHARED / CROSS-VERTICAL CAPABILITIES (not all surfaced as tiles yet)

| Capability | Class | Shared home | Consumers today |
|---|---|---|---|
| Tile primitives (`Tile`, `TileGrid`) | **General** | `shared/src/components/tiles/` | Cultivar grid (Ignition uses flat-file grid) |
| Settings page | **General** | `shared/src/pages/Settings.tsx` (`verticalSection` slot) | Cultivar wraps it (`cultivar-os/src/pages/Settings.tsx:3`) |
| Auth / RBAC / OwnerSignup | **General** | `shared/src/auth/` | Cultivar (full), Ignition (partial; PIN exception) |
| Cost-to-Produce / Margins | **General** | `shared/src/business-logic/MarginEngine.ts` | Ignition PROT/PORT; Cultivar not yet wired |
| QuickBooks | **Cross-vertical** | `shared/src/quickbooks/` | Cultivar (api), Ignition (INVOICE) |
| Social composer | **Cross-vertical** | `shared/src/social/` | Cultivar only (installable in Ignition) |
| Campaign Engine | **Cross-vertical** | `shared/src/campaigns/` | Cultivar (Seasonal); designed for Pantry too |
| Notifications | **General** | `shared/src/notifications/` (per-vertical templates) | Cultivar (orders/discovery); Ignition local |
| Discovery | **General** engine | `shared/src/discovery/` (pluggable `verticals/` adapters) | Cultivar only today |
| PMI (preventive maintenance) | **General** | `shared/src/modules/PMI.tsx` (`business_assets`/`business_pmi_schedule`/`business_service_log`) | Cultivar imports component; Ignition has its own audit |
| Receipt Keeper | **Vertical** (today) | none — `cultivar-os/src/pages/ReceiptKeeper.tsx` + `receipts` table | Cultivar only; not shared |
| Billing / Subscription | **General** | not extracted — Ignition `AdminSubscription.jsx` is the baseline | Ignition |

---

## RULES THAT FALL OUT

1. **A general tile must not carry a vertical noun (AC-1).** A GENERAL capability sitting in
   a vertical-named table/module is a layer-naming smell. The **module/tile registry** is
   the archetypal case: a registry of installable tiles is a *general* concept — it was
   named `nursery_modules` (vertical noun on a general thing). Correct name is
   `business_modules` (already migrated 2026-06-04); the legacy table still exists **pending
   DROP**. See Verification §3.

2. **Cross-vertical tiles declare dependencies.** The substrate + store enforce "requires X"
   gracefully (e.g. INVOICE / `qb_invoicing` requires a QuickBooks connection; a campaign
   tile requires the Campaign Engine). Model the dependency explicitly; don't hardcode the
   prerequisite into the consumer.

3. **Promotion pipeline (NORTH-STAR — concept only, do NOT build):** a tile born private in
   one vertical can be promoted private → public. **Widget + intelligence promote; data
   never does.** All current tiles are **public**. The machinery to promote is not built and
   is not in scope here.

4. **Cost-to-Produce is GENERAL.** It sits at the intersection of Ignition job-cost, Cultivar
   lot-cost, and TRACE pricing-itself (absorption ÷ N). The **engine is shared**
   (`MarginEngine.ts`); the **vertical supplies the feed + the denominator** (DATA varies,
   engine does not — AC-1). Nothing in the current code forces it to be vertical (see
   Verification §4).

---

## BOTTOM LINE

**(a) Tile list by class.**
- **General:** the tile primitives, Settings, Auth/RBAC (Ignition ADMIN), Billing
  (Ignition MARKETPLACE), Cost-to-Produce/Margins, the module **registry** itself,
  Notifications, Discovery engine, PMI, CRM-as-concept, `business_insights`.
- **Cross-vertical:** QuickBooks (`qb_invoicing` / Ignition INVOICE), Social composer,
  Campaign Engine (Cultivar `seasonal_module`), Invoice Vision/Leakage (Ignition AUDIT),
  PreventiveKey, PORT, `followup_engine`, `inventory_intake`.
- **Vertical:** Cultivar `qr_checkout`/`online_shop`/`delivery_routing`/`contractor_tiers`;
  Ignition INTAKE/ESTIMATES/EVAL/OMNI/HUB/FLUX/CIPHER/STOK/PROC/COMPLIANCE/TOOLS; Cultivar
  Receipt Keeper.

**(b) Naming-layer violations to fix later (flag only — do NOT rename now):**
- **The tile registry table name** — `nursery_modules` (general concept, vertical noun).
  Already migrated to `business_modules`; finish the `DROP TABLE nursery_modules CASCADE`
  (CLAUDE.md §1.5 / Noun Purge). This is the prime suspect and it is confirmed.
- `Dashboard.tsx:540` — UI text "Complete your nursery profile" (should be "business").
- Tracked Noun-Purge backlog (unchanged): `nursery_profiles` → `business_profiles`;
  `AIEngine.ts` `shopId`/`shop_id` → `businessId`/`business_id`; `qr/print.ts` `nurseryName`
  → `businessName`; `quickbooks/oauth.ts` `IGNITION_OS_DATA` storage key.

**(c) Cost-to-Produce is GENERAL** and drops into the **shared `Settings.tsx`**
(`verticalSection` slot / a new `SectionCard`) + a **dashboard tile built from the shared
`Tile`/`TileGrid` primitives** — exactly as LAYER-DEFINITIONS.md concluded. No vertical code
forces it otherwise; the engine is already shared. **Do NOT build** — this doc classifies; it
does not implement.

---

## Verification 2026-06-14 (read-only, against live code)

Method: read-only enumeration of the live tile registries and capability code in
`packages/`, plus `supabase/migrations/`. Each row above is file:line-backed. CONFIRMED /
DIFFERENT noted where the code disagreed with assumptions.

### 1. Cultivar tiles enumerated — CONFIRMED
10 tiles in the registry. UI metadata `MODULE_META`/`MODULE_ORDER` at
`packages/cultivar-os/src/hooks/useModules.ts:33-50`; state logic at `useModules.ts:127-143`;
rendered via shared `TileGrid` at `packages/cultivar-os/src/pages/Dashboard.tsx:743-759`. Seed
rows for LAWNS at `supabase/migrations/20260604_business_modules.sql:82-92` (qr_checkout +
qb_invoicing + social_media enabled; the other 7 disabled). Per-tile capability locations
confirmed (Orders/SocialSetup/DeliveryRoute exist; online_shop / followup / contractors /
seasonal / insights / inventory route to a coming-soon modal — not yet built).

### 2. Ignition tiles enumerated — CONFIRMED
19 tiles hardcoded in `DASH_APPS` at `packages/ignition-os/CoreApp.jsx:53-73`, rendered at
`CoreApp.jsx:1085-1120`. **No DB registry** — flat array, and the modules live in
`packages/ignition-os/modules/*.jsx` (NOT a `src/` tree — confirms LAYER-DEFINITIONS: Ignition
shell is flat-file, separate from Cultivar's). Class assigned per where each module's code
actually lives: shared-engine consumers = PROT/PORT (MarginEngine), AUDIT/CIPHER/PREDICTIVE
(AIEngine), INVOICE (quickbooks). Roughly 11 of 19 are vertical (auto/fleet-specific).

### 3. Naming-layer violation (registry) — CONFIRMED, as suspected
The tile **registry** is a GENERAL concept that was named with a VERTICAL noun
(`nursery_modules`). Migration `supabase/migrations/20260604_business_modules.sql` renames it
to `business_modules` with membership-scoped RLS (`business_modules_member_access`, AC-2
clean), and 6 API/hook files were repointed (CLAUDE.md handoff 2026-06-04). The legacy
`nursery_modules` table **still EXISTS pending DROP** (CLAUDE.md §1.5 + PLATFORM_STATE
IN-FLIGHT). Additional live vertical-noun reference: `Dashboard.tsx:540` UI text. → flagged
as debt; **not renamed here.**

### 4. Cost-to-Produce class — CONFIRMED GENERAL
`MarginEngine.ts` is in the shared layer
(`packages/shared/src/business-logic/MarginEngine.ts`, exported from
`shared/src/index.ts`). It is `businessType`/config-driven — tier and slab names are DATA
(config strings), never enum/switch labels — so nothing in the code forces it to a vertical.
Ignition PROT/PORT consume it; Cultivar does not yet. The shared `Settings.tsx`
(`packages/shared/src/pages/Settings.tsx:92`) exposes a `verticalSection` slot + `SectionCard`
blocks, so the config surface is a drop-in. Matches LAYER-DEFINITIONS.md §Cost-to-Produce.

**Result statement:** tiles classified general / vertical / cross-vertical and verified
against the live registries (Cultivar `business_modules` + `useModules.ts`; Ignition
`CoreApp.jsx` `DASH_APPS`), with every row file:line-backed; the registry-naming debt
(`nursery_modules` → `business_modules`, DROP pending) is flagged as the prime violation; and
Cost-to-Produce is confirmed GENERAL with a shared engine and a drop-in shared-Settings home.
Nothing was built or renamed. — Does it match?
