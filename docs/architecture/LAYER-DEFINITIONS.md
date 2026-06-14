# CANONICAL LAYER DEFINITIONS — what is what

**The authority for layer/placement questions.** If code conflicts with this doc, the
**CODE wins** and this doc gets corrected (audit-wins rule). Re-validate when structure
changes. Created 2026-06-14.

This doc exists to stop the re-litigation. We keep re-deriving the same architecture
(shared vs core, dashboard vs settings, where cost-to-produce lives). It is written
once, here, as canonical — and verified against the live repo (see Verification section
at the bottom) so it is fact, not memory.

---

## TWO LAYERS (there is no third "core" layer — shared IS the general/core layer)

- **SHARED = GENERAL = CORE** — one thing; these words are synonyms. Lives in
  `packages/shared/`. Tables use the **`business_`** prefix (`business_id`-scoped, every
  vertical). This is the **intersection** of the verticals — the common tiles/functions
  both Ignition and Cultivar need.
- **VERTICAL** — the per-vertical layer **on top of** shared. Lives in
  `packages/cultivar-os/`, `packages/ignition-os/`, etc. Tables use the vertical prefix
  (`cultivar_`, `ignition_`). Verticals supply **CONFIG** and **FEEDS** on top of the
  shared engine.
- **`platform_`** = global / not-tenant-scoped — the third *prefix*, but not a "layer"
  in this sense.
- **Naming rule (already locked):** `<layer>_<thing>`, never `<feature>_<thing>`.

---

## DASHBOARD / TILES / SETTINGS (the surface model — Operational Command Grid pattern)

- **DASHBOARD** = the command grid. It **DISPLAYS** information. It does **NOT** configure.
  The grid SHELL (layout, identity bar, active-asset cycling, bottom nav) is meant to be
  SHARED; the TILE CONTENTS are vertical.
- **TILES** = what populates the dashboard. Each tile is a **CONNECTOR** or a
  **GAP-FILLER**. A tile only shows as **ACTIVE** if its capability actually works
  (Surface Honesty — no cosmetic tiles).
- **SETTINGS** = the config surface, **OFF** the dashboard. Any tile that needs
  configuration presents that config in Settings, not on the dashboard. Tiles are
  activated/deactivated in Settings.
- **FUZZ MECHANIC:** a deactivated/unconfigured tile still DISPLAYS on the dashboard,
  FUZZED — showing an aggregate dollar estimate (real data, detail hidden) of what
  activating it is worth. Honest about the value, honest that it's off.

---

## COST-TO-PRODUCE PLACEMENT (settled)

- Cost-to-Produce is **GENERAL/SHARED** (in the intersection): Ignition (job costing),
  Cultivar (lot costing), and TRACE-pricing-itself (absorption ÷ N) all need it. So the
  **engine + config surface belong in the SHARED layer**; each vertical layers its
  **FEED + DENOMINATOR** on top.
- **Business type does NOT select the costing engine.** It selects the **FEED** (what
  costs flow in) and the **DENOMINATOR** (unit to divide by). Variation in **DATA**, not
  engine logic (AC-1).
- **MarginEngine ALREADY lives in shared**
  (`packages/shared/src/business-logic/MarginEngine.ts`).
- **TRACE is customer-zero:** TRACE's own cost-to-produce (recurring + labor ÷ N →
  platform price) is the SAME problem as a grower's (loaded lot cost). Solve once, layer
  the feed.

---

## PROT (the ancestor — context)

PROT (Ignition "Shop Economics & Pricing Config": labor rates, overhead, margin slabs) is
the v1 sketch of the cost-to-produce CONFIG surface. Its **FIELD LIST is the input spec**
for the shared Cost-to-Produce Settings surface. **Harvest the fields; don't restore the
orphaned screen.**

---

## RE-VALIDATION RULE

This doc is a **CLAIM**. The code is the **authority**. When we reference it to make a
placement decision, and when structure changes, re-run the Verification pass below and
correct the doc if code has moved.

---

## Verification 2026-06-14 (read-only, against live code)

Method: read-only inspection of `packages/`, `supabase/migrations/`. Each claim is
file:line-backed. Where the doc and code disagree, the **code wins** and the doc line is
flagged for correction.

### 1. SHARED layer + MarginEngine

**CONFIRMED.** `packages/shared/` exists and holds the shared code. MarginEngine is at
[packages/shared/src/business-logic/MarginEngine.ts](../../packages/shared/src/business-logic/MarginEngine.ts)
— header confirms it is the canonical engine (THUNDER · Build 1 · 2026-06-10) that
replaced the Ignition `MarginEngine.js`, the dead `pricing/marginEngine.ts` stub, and the
`DataBridge` prot_matrix model. Exported from
[packages/shared/src/index.ts:33](../../packages/shared/src/index.ts#L33).

What else is genuinely in shared today (`packages/shared/src/`):
- **business-logic/** — `MarginEngine.ts` (the cost/pricing engine).
- **components/** — primitives: `Button`, `Card`, `Badge`, `FormField`, `ProgressBar`,
  `Skeleton`, `LockedOverlay`, `QuickBooksConnector`, `SavingsReport`, and
  **tiles/** (`Tile.tsx`, `TileGrid.tsx`).
- **pages/** — `Settings.tsx` (a full shared Settings PAGE, see §3).
- **context/** — `BusinessProvider.tsx` (`useBusinessContext` → `business_id`).
- **auth/** — `configureAuth`, `OwnerSignup`, member/invitation/permission logic.
- **ai/** — `AIEngine.ts`, capabilities, execute.
- **qr/**, **quickbooks/**, **notifications/**, **discovery/**, **social/**,
  **campaigns/**, **modules/** (`PMI.tsx`), **supabase/**, **design-system/tokens.ts**,
  **utils/**, **onboarding/**.

### 2. Grid SHELL + SETTINGS surface — WHERE they live (the key question)

**DIFFERENT from the doc's implied "shell is shared" wording — flag.** The doc says the
grid shell "is meant to be SHARED." Reality is **split**:

- **Tile PRIMITIVES are shared:** `Tile` and `TileGrid` at
  [packages/shared/src/components/tiles/TileGrid.tsx](../../packages/shared/src/components/tiles/TileGrid.tsx)
  and `Tile.tsx`, exported from
  [packages/shared/src/index.ts:63-66](../../packages/shared/src/index.ts#L63-L66).
- **The dashboard GRID SHELL (layout) is VERTICAL-LOCAL, not extracted:**
  - Cultivar: [packages/cultivar-os/src/pages/Dashboard.tsx](../../packages/cultivar-os/src/pages/Dashboard.tsx)
    (938 lines) — it *consumes* the shared `TileGrid`/`Tile`
    ([imports at lines 8-9](../../packages/cultivar-os/src/pages/Dashboard.tsx#L8-L9),
    used at [743-759](../../packages/cultivar-os/src/pages/Dashboard.tsx#L743-L759)) but
    the shell layout itself is Cultivar-local.
  - Ignition: shell is flat-file modules
    [packages/ignition-os/modules/IgnitionHub.jsx](../../packages/ignition-os/modules/IgnitionHub.jsx)
    and `IgnitionOmniDashboard.jsx` — NOT migrated into a `src/` tree
    (`packages/ignition-os/src/` holds only `.gitkeep`), and a separate codebase from
    Cultivar's shell.
- **The SETTINGS surface IS shared (page-level):**
  [packages/shared/src/pages/Settings.tsx:92](../../packages/shared/src/pages/Settings.tsx#L92)
  — `export function Settings({ onBack, verticalSection, accountingConnectUrl })`. It
  renders `SectionCard` blocks for **Business Profile**, **Accounting**, and **Services**
  ([lines 315/341/378](../../packages/shared/src/pages/Settings.tsx#L315-L378)) and takes
  a **`verticalSection` slot** so a vertical injects its own section into the shared page.

**Bottom line for this item:** tile primitives + the Settings page are shared; the
dashboard grid *layout* is vertical-local (two separate shells, Cultivar TS / Ignition
flat-JSX).

### 3. Does Cultivar have a Settings + dashboard grid today?

**CONFIRMED — and Cultivar already consumes the shared surfaces.**
- Cultivar Settings:
  [packages/cultivar-os/src/pages/Settings.tsx:3](../../packages/cultivar-os/src/pages/Settings.tsx#L3)
  imports `Settings as SharedSettings` from `@trace/shared/pages/Settings` and wraps it,
  adding Cultivar member-management. So Cultivar's Settings IS the shared page + a
  vertical section.
- Cultivar Dashboard:
  [packages/cultivar-os/src/pages/Dashboard.tsx](../../packages/cultivar-os/src/pages/Dashboard.tsx)
  exists and renders the shared `TileGrid`/`Tile` (see §2). The grid is real, not
  Ignition-only.

### 4. business_ vs vertical prefix — naming-rule spot-check

**CONFIRMED, with the known/tracked legacy violations still present.**
- Correct `business_` prefixes (recent migrations): `business_assets`,
  `business_inventory`, `business_service_log`, `business_voice_samples`,
  `business_modules`; `platform_config` for global. Correct vertical prefix:
  `cultivar_plants` (`20260613_cultivar_plants_untangle.sql`).
- **Known open AC-1 violations (already tracked in CLAUDE.md §1.5 Noun Purge), still
  live:** the legacy `nurseries` / `nursery_modules` (pending DROP) / `nursery_profiles`
  nouns are still referenced in
  [packages/cultivar-os/src/pages/Settings.tsx](../../packages/cultivar-os/src/pages/Settings.tsx)
  and
  [packages/cultivar-os/src/pages/OnboardingWizard.tsx](../../packages/cultivar-os/src/pages/OnboardingWizard.tsx).
  These are the documented Noun-Purge backlog, not new findings.

---

## BOTTOM LINE (2026-06-14)

**(a) Is the two-layer model as-written accurate to the code?**
Yes. Shared = general/core (`packages/shared/`, `business_` tables); verticals layer
config + feeds on top (`cultivar_`/`ignition_` tables). MarginEngine and a shared Settings
page already live in shared. The only correction: the doc implies the grid *shell* is
shared — in reality only the tile **primitives** and the Settings **page** are shared; the
dashboard **layout** is still vertical-local.

**(b) Where does the grid/settings shell live, and is it shared or vertical-only?**
- Settings: **SHARED page** (`shared/src/pages/Settings.tsx`) with a `verticalSection`
  slot; Cultivar already consumes it.
- Dashboard grid: **tile primitives shared** (`shared/src/components/tiles/`), but the
  **shell layout is vertical-local** — Cultivar `Dashboard.tsx` (consumes the shared
  primitives) and Ignition `IgnitionHub.jsx`/`IgnitionOmniDashboard.jsx` (flat files).

**(c) Can a shared Cost-to-Produce tile + settings be built into an existing shared shell,
or does the shell need extracting/porting first?**
**Drop-in for the config/settings side; no shell extraction blocking the tile.**
- **Settings config:** drop-in — add a new `SectionCard` (or feed the `verticalSection`
  slot) in the shared `Settings.tsx`; the engine (`MarginEngine.ts`) is already shared.
- **The tile:** add a Cost-to-Produce tile to each vertical's local dashboard using the
  **shared `Tile`/`TileGrid` primitives** — this is normal vertical-layer wiring, not a
  blocker. No full dashboard-shell extraction is required to ship a shared Cost-to-Produce
  capability. (Extracting the dashboard *layout* into shared remains separate, optional
  housekeeping — it is not on the critical path for Cost-to-Produce.)
