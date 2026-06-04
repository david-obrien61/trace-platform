# Vertical Config Variable Inventory
**Date:** 2026-06-04
**Type:** Read-only audit. Zero code, schema, or config changes.
**Purpose:** Enumerate every dimension that legitimately varies per vertical; find where each currently lives; propose the single declarative config shape (VerticalConfig) that would hold them. This is the forward application of AC-1 — the refactor half is a post-demo task.
**Related task:** CLAUDE.md Part 4 § Housekeeping → Vertical Setup — Vertical Config Extraction

---

## Variable Inventory Table

| # | Dimension | Variable | Current location(s) | State | Proposed VerticalConfig key |
|---|---|---|---|---|---|
| 1 | Identity | `business_type` value | `businesses.business_type` (DB); `BusinessProvider` prop; `OwnerSignupConfig.businessType` | ✅ already-config | `identity.type` |
| 2 | Identity | `businessLabel` (noun shown to user: "nursery", "shop") | `OwnerSignupConfig.businessLabel` → used in OwnerSignup.tsx PIN copy, step headers | ✅ already-config | `identity.label` |
| 3 | Identity | Product name ("Cultivar OS", "Ignition OS") | Hardcoded in 15+ JSX files: `SavingsReport.jsx`, `notifications/templates/ignition.ts`, `Terms.tsx`, `Help.tsx` (15+ occurrences), `CoreApp.jsx`, `OnboardingWizard.jsx` | ❌ scattered / hardcoded | `identity.productName` |
| 4 | Identity | Logo / icon | `OwnerSignupConfig.logo` (emoji: `'🌿'` / `'⚡'`) | ✅ already-config | `identity.logo` |
| 5 | Theme | Primary color | `OwnerSignupConfig.primaryColor` (`#27500A` / `#22c55e`); hardcoded default in `Button.tsx`, `Badge.tsx`, `ProgressBar.tsx`, `AcceptInvite.tsx`, `Settings.tsx`, `statusColors.ts`, `notifications/templates/base.ts` | 🟡 scattered (config for signup; hardcoded default in shared primitives) | `theme.primaryColor` |
| 6 | Theme | Background color | `OwnerSignupConfig.backgroundColor` (`#EAF3DE` / `#020617`) | ✅ already-config (OwnerSignup only) | `theme.backgroundColor` |
| 7 | Theme | Card color | `OwnerSignupConfig.cardColor` (`#fff` / `#0f172a`) | ✅ already-config (OwnerSignup only) | `theme.cardColor` |
| 8 | Theme | Dark mode flag | `OwnerSignupConfig.darkMode` (false / true) | ✅ already-config | `theme.darkMode` |
| 9 | Copy | Signup business name placeholder | `OwnerSignupConfig.examples.businessName` (`'e.g. LAWNS Tree Farm'` / `"e.g. Dave's Auto Shop"`) | ✅ already-config | `copy.examples.businessName` |
| 10 | Copy | Signup address placeholder | `OwnerSignupConfig.examples.address` | ✅ already-config | `copy.examples.address` |
| 11 | Copy | Collect website field flag | `OwnerSignupConfig.collectWebsite` (true / false) | ✅ already-config | `copy.collectWebsite` |
| 12 | Copy | Collect phone flag | `OwnerSignupConfig.collectPhone` | ✅ already-config | `copy.collectPhone` |
| 13 | Copy | Collect address flag | `OwnerSignupConfig.collectAddress` | ✅ already-config | `copy.collectAddress` |
| 14 | Copy | Onboarding guidance copy | `packages/cultivar-os/src/pages/OnboardingWizard.tsx` line 166 (Cultivar-specific add-on guidance hardcoded); Ignition has separate WELCOME/DONE screens in its own OnboardingWizard | 🟡 scattered | `copy.onboardingGuidance` |
| 15 | Copy | DiscoveryGlimpse product name | `packages/shared/src/discovery/DiscoveryGlimpse.tsx` lines 121, 283 — "Cultivar OS" hardcoded | ❌ hardcoded in shared | `copy.productName` (same as #3) |
| 16 | Copy | Shared Settings page placeholder | `packages/shared/src/pages/Settings.tsx` line 316 — "LAWNS Tree Farm, LLC" hardcoded | ❌ hardcoded in shared | `copy.businessNamePlaceholder` |
| 17 | Vocabulary | Discovery industry context | `packages/shared/src/discovery/verticals/nursery.ts` — full nursery schema (industryContext, extractionHints, painPoints, typicalOfferings) | ✅ already-config (nursery only; no ignition schema exists yet) | `integrations.discoverySchema` |
| 18 | Vocabulary | Service offering categories | `service_offerings` table (DB); enum values generic: `'transport'|'addon'|'maintenance'|'inspection'|'subscription'` | ✅ already-config (DB) | DB-backed (no change needed) |
| 19 | Vocabulary | Price units per offering | `nursery.ts` typicalOfferings array — `'order'|'plant'|'visit'` | ✅ already-config (in nursery schema) | `integrations.discoverySchema.typicalOfferings` |
| 20 | Vocabulary | Transport method enum | `packages/cultivar-os/src/pages/PlantProfile.tsx` — `'pickup'|'delivery'|'install'` hardcoded in checkout | ❌ hardcoded in component | `vocabulary.transportMethods` |
| 21 | Modules | Default-enabled module keys | `modules` table seed data (Supabase, 10 modules for Cultivar); `nursery_modules` / `business_modules` table per business | ✅ already-config (DB) | DB-backed (no change needed) |
| 22 | Modules | Dashboard tile list + order | `packages/cultivar-os/src/pages/Dashboard.tsx` tileConfig array; `packages/ignition-os/modules/IgnitionOmniDashboard.jsx` hardcoded | 🟡 scattered (each vertical hard-defines its tile set in its own component) | `modules.defaultTileOrder` |
| 23 | Modules | Ignition module activation | No `business_modules` equivalent in ignition-os Supabase project yet; tiles hardcoded in React | ❌ not yet config-driven | DB-backed (matches Cultivar pattern once migration runs) |
| 24 | Auth | Member table name | `OwnerSignupConfig.memberTable` (`'business_members'` / `'shop_members'`) | ✅ already-config | `auth.memberTable` |
| 25 | Auth | Member FK column | `OwnerSignupConfig.memberFKColumn` (`'business_id'` / `'shop_id'`) | ✅ already-config | `auth.memberFKColumn` |
| 26 | Auth | Owner role name | `OwnerSignupConfig.ownerRole` (`'OWNER'` / `'ADMIN'`) | ✅ already-config | `auth.ownerRole` |
| 27 | Auth | Role definitions + permission bundles | `packages/cultivar-os/src/auth/roles.ts` (OWNER, MANAGER, STAFF — correct vertical-specific location); Ignition roles not yet formalized in equivalent file | 🟡 Cultivar done; Ignition gap | Vertical-package file (correct; does NOT go in shared VerticalConfig) |
| 28 | Auth | Sign-in path | `OwnerSignupConfig.signInPath` (`'/login'` / `'/'`) | ✅ already-config | `auth.signInPath` |
| 29 | Integrations | Accounting adapter type | `businesses.accounting_type` (DB, nullable; `'quickbooks'` only current value) | ✅ already-config (DB) | DB-backed |
| 30 | Integrations | QB token storage columns | `businesses` table: `accounting_token`, `accounting_refresh_token`, `accounting_token_expires_at`, `accounting_company_id` | ✅ already-config (DB, generic naming) | DB-backed |
| 31 | Integrations | Accounting connector support list | Not yet formalized; implicitly `['quickbooks']` for both | ❌ missing / implicit | `integrations.accountingAdapters` |
| 32 | Behavior | Tax rate | `businesses.tax_rate` (DB, correct) + `VITE_TAX_RATE=0.0825` (env var) + hardcoded `0.0825` constant in `packages/cultivar-os/src/lib/constants.ts` and 2 Ignition modules | 🟡 scattered (DB is right; code still duplicates it) | DB-backed (`businesses.tax_rate`); remove constants |
| 33 | Behavior | Default install price | `plants.install_price` (per plant, DB) + `nursery_profiles.default_install_price` (per business, DB) | ✅ already-config (DB) | DB-backed |
| 34 | Behavior | Netting add-on prompt trigger | Hardcoded in Cultivar checkout flow (per-plant threshold logic) | ❌ hardcoded (Cultivar-only, vertical-correct but not config-driven) | `behavior.addOnPrompts` array |
| 35 | Behavior | QB invoice number format | `packages/cultivar-os/api/qbo/invoice/cultivar.ts` line ~288 — `"COS-{month}-{count}"` pattern hardcoded | ❌ hardcoded | `behavior.invoicePrefix` |
| 36 | Behavior | Trial duration | `businesses.trial_started_at` (DB); Ignition hardcodes 14-day window in DataBridge | 🟡 scattered | `behavior.trialDays` |

---

## OwnerSignupConfig — Full Interface (current canonical fields)

```typescript
export interface OwnerSignupConfig {
  businessLabel:    string;          // noun: "nursery", "shop", "org"
  businessType:     string;          // stored in businesses.business_type
  logo?:            string;          // emoji or image URL
  primaryColor?:    string;          // defaults to #27500A
  backgroundColor?: string;          // defaults to #EAF3DE
  cardColor?:       string;          // defaults to white
  darkMode?:        boolean;         // when true, applies dark-palette transforms
  pinLength?:       number;          // defaults to 4
  memberTable:      'business_members' | 'shop_members';
  memberFKColumn:   'business_id'   | 'shop_id';
  ownerRole:        string;          // 'OWNER' | 'ADMIN'
  ownerPermissions: string[];
  signInPath:       string;          // '/login' | '/'
  collectPhone?:    boolean;         // default true
  collectAddress?:  boolean;         // default true
  collectWebsite?:  boolean;         // default true
  examples?: {
    businessName?:  string;
    address?:       string;
  };
  verticalSteps?:   VerticalStep[];  // post-signup onboarding
  onSuccess:        (businessId: string, memberId: string) => void;
}
```

**Cultivar passes (`SignUp.tsx:26–47`):** all fields; `collectWebsite: true`, examples with LAWNS copy, darkMode not set (defaults false).  
**Ignition passes (`OnboardingWizard.jsx:80–101`):** `darkMode: true`, `collectWebsite: false`, Dave's Auto Shop examples, `memberTable: 'shop_members'`, `memberFKColumn: 'shop_id'`, `ownerRole: 'ADMIN'`.

**The diff between them is the per-vertical variable set.** OwnerSignupConfig is the only formalized per-vertical config object in the codebase today.

---

## Proposed VerticalConfig Shape

A single typed object, keyed by `business_type`, agnostic by construction (no vertical noun in the shape — verticals are entries in a record, not field names).

```typescript
// packages/shared/src/config/VerticalConfig.ts

export interface VerticalConfig {
  identity: {
    type:         string;   // business_type value stored in DB
    label:        string;   // noun shown to users ("nursery", "shop")
    productName:  string;   // "Cultivar OS", "Ignition OS"
    logo:         string;   // emoji or URL
  };
  theme: {
    primaryColor:     string;
    backgroundColor:  string;
    cardColor:        string;
    darkMode:         boolean;
  };
  copy: {
    examples: {
      businessName: string;
      address:      string;
    };
    businessNamePlaceholder: string;  // for Settings page field
    collectPhone:    boolean;
    collectAddress:  boolean;
    collectWebsite:  boolean;
  };
  vocabulary: {
    transportMethods: string[];       // e.g. ['pickup','delivery','install']
    addOnPrompts:     AddOnPromptConfig[];
  };
  modules: {
    defaultTileOrder: string[];       // module_key list, display order
  };
  auth: {
    memberTable:   string;
    memberFKColumn: string;
    ownerRole:     string;
    signInPath:    string;
  };
  integrations: {
    accountingAdapters:  string[];   // ['quickbooks'], ['neon_one'], etc.
    discoverySchema:     VerticalSchema | null;
    invoicePrefix:       string;     // 'COS', 'IGN', etc.
  };
  behavior: {
    trialDays:         number;
    // tax_rate, install_price remain DB-backed per business — not in this config
  };
}

export const VERTICAL_CONFIGS: Record<string, VerticalConfig> = {
  nursery: { /* cultivar-os values */ },
  shop:    { /* ignition-os values */ },
};
```

This object collects what OwnerSignupConfig already handles (theme, copy, auth) and adds the missing dimensions (identity.productName, vocabulary.transportMethods, integrations, behavior.trialDays). Once built, each vertical passes `VERTICAL_CONFIGS[businessType]` as a single prop instead of constructing separate config objects per component.

---

## Readiness Assessment

**Out of 8 dimensions — how far is "new vertical = one config file"?**

| Dimension | Readiness | Blocker |
|---|---|---|
| Theme | ✅ 90% config-driven | Shared primitive defaults still hardcode `#27500A` (audit #15, AC-4; post-August 2026 fix) |
| Copy (signup) | ✅ 90% config-driven | Onboarding guidance + DiscoveryGlimpse product name still hardcoded (#14, #15, #16) |
| Modules | ✅ 85% database-backed | Ignition tile order still hardcoded in React component (#23) |
| Auth | ✅ 85% config-driven | Ignition roles not formalized in a roles.ts file (#27) |
| Identity | 🟡 50% — type/label config, product name scattered | 15+ hardcoded "Cultivar OS" / "Ignition OS" strings (#3) |
| Integrations | 🟡 50% — accounting generic, discovery schema only for nursery | No `ignition.ts` discovery schema; accounting adapter list not declared (#31, #17) |
| Vocabulary | 🟡 40% — offerings in DB, transport enum hardcoded | Transport method enum + add-on prompt trigger are in-component (#20, #34) |
| Behavior defaults | 🟡 40% — install price/tax in DB, TAX_RATE constant duplicated | `TAX_RATE` constant still in code; netting prompt trigger hardcoded; trial days scattered (#32, #34, #36) |

**Biggest single blocker:** Product name strings scattered across 15+ files (finding #3). A third vertical added today would require a find-and-replace hunt before shipping. Until a VerticalConfig.productName field is threaded through, every file that displays the product name is a manual edit.

**Second biggest:** No discovery schema for Ignition (#17). The discovery engine is shared and works correctly, but it requires a vertical schema. Adding Ignition to discovery is blocked until `packages/shared/src/discovery/verticals/shop.ts` exists.

**Good news:** OwnerSignupConfig is already well-designed and captures the majority of what VerticalConfig needs for theme, copy, and auth. The VerticalConfig build is largely a matter of extending what's there and collecting the scattered pieces into one object — not a ground-up build.

---

## AC-4 Findings (Design Variables Beyond Color)

AC-4 states: "The only per-vertical variables are tokens (color) and configured vocabulary." The following were found that vary per vertical beyond color:

| Finding | AC-4 Status | Assessment |
|---|---|---|
| Dark mode flag (darkMode boolean) | Within AC-4 | Dark mode derives all its values from the primary color token + a boolean flag. The structural design (spacing, sizing, typography) is uniform. This is a color-token-level variable, not a structural deviation. ✅ |
| PIN description copy varies (uses businessLabel) | Within AC-4 | Vocabulary variable — "nursery dashboard" vs "shop dashboard" — explicitly permitted. ✅ |
| Tailwind in Ignition / 2 shared files | Pre-existing, scheduled for conversion | Documented in CLAUDE.md Tech Debt #14. Not a new violation. ✅ |
| Transport method enum per vertical | AC-4 borderline | This is vocabulary (the set of options available for a transaction type varies by vertical). Acceptable as a vocabulary variable. Would be cleaner in VerticalConfig.vocabulary than hardcoded in PlantProfile. 🟡 |

**No hard AC-4 violations found.** The `darkMode` flag is the only design-adjacent variable, and it is justifiably a color-system concern (not a spacing/sizing deviation).

---

## Files to Change in the Post-Demo Refactor

| File | Change needed |
|---|---|
| `packages/shared/src/config/VerticalConfig.ts` | CREATE — define VerticalConfig type + VERTICAL_CONFIGS object |
| `packages/cultivar-os/src/pages/SignUp.tsx` | Replace inline cultivarConfig → `VERTICAL_CONFIGS['nursery']` |
| `packages/ignition-os/modules/OnboardingWizard.jsx` | Replace inline ignitionSignupConfig → `VERTICAL_CONFIGS['shop']` |
| `packages/shared/src/discovery/DiscoveryGlimpse.tsx` | Accept `productName` prop; remove hardcoded "Cultivar OS" strings (lines 121, 283) |
| `packages/shared/src/pages/Settings.tsx` | Replace "LAWNS Tree Farm, LLC" placeholder with config-driven value (line 316) |
| `packages/shared/src/components/Button.tsx` | Accept `color` prop with default from VerticalConfig; remove `#27500A` constant |
| `packages/shared/src/components/Badge.tsx` | Same |
| `packages/shared/src/components/ProgressBar.tsx` | Same |
| `packages/shared/src/auth/AcceptInvite.tsx` | Same |
| `packages/shared/src/notifications/templates/base.ts` | Replace `headerColor: '#27500A'` with config-driven value |
| `packages/cultivar-os/src/lib/constants.ts` | Remove `TAX_RATE` constant — read from `businesses.tax_rate` |
| `packages/shared/src/discovery/verticals/shop.ts` | CREATE — Ignition discovery schema (industry context, pain points, typical offerings for auto repair) |
| `packages/cultivar-os/src/auth/roles.ts` | No change needed (correctly vertical-isolated) |
| `packages/ignition-os/` (new file) | CREATE `auth/roles.ts` equivalent for shop roles |

**Not in scope for VerticalConfig (remain DB-backed as-is):**
- `businesses.tax_rate` — per-business, not per-vertical
- `plants.install_price` / `nursery_profiles.default_install_price` — per-business
- `business_modules` — per-business module state
- `service_offerings` — per-business offerings
