# Platform Naming & Vertical-Leak Audit
**Date:** 2026-06-03 (run 2026-06-04)
**Type:** Read-only — no code or schema changes made
**Auditor:** Claude Code (audit session; no Part 9 propagation of code changes)

---

## Purpose

TRACE is one platform, many verticals. The multi-tenant extraction moved `shops`/`nurseries` → `businesses` and team tables → `business_members`, but vertical-specific nouns remain leaked into shared/platform layers where they cause bugs. This audit inventories every such leak before they surface in front of a customer.

**Classification rule:** A vertical noun is FINE inside that vertical's own package. It is a LEAK when it appears in `packages/shared/**`, any DB table/policy serving ALL verticals, or any shared component.

---

## Findings Table

| # | Category | Leak — what + where (file/table/line) | Scope | Severity | Blast radius | Already biting? |
|---|---|---|---|---|---|---|
| 1 | DB — Table | `nursery_modules` table: platform-wide module enablement named for one vertical. Used by social/enable, social/publish, generate-posts, campaigns APIs. | DB-platform | **HIGH** | Renaming requires migration + all consumer queries updated (5+ files). Cross-vertical module enablement impossible under current name without cognitive confusion. | Yes — caused `updated_at` column bug (May 22). Bug fixed; name remains wrong. |
| 2 | DB — Table | `nursery_profiles` table: vertical-specific config (default_install_price) under a vertical noun. No equivalent pattern exists for Ignition or KINNA yet. | DB-platform | **HIGH** | When Ignition needs per-shop config (e.g., default labor rate), code will need to create a parallel table or shoehorn into `nursery_profiles`, neither of which is correct. | No — Ignition doesn't use this table today. |
| 3 | DB — Columns | `nursery_id` column: Mid-migration debt. The multi-tenant migration added `business_id` but left `nursery_id` on operational tables until cleanup migration E runs. | DB-platform | **MED** | Cleanup migration `20260529_businesses_e_cleanup.sql` drops these columns. Migration E is already written; it just needs to be applied post-smoke-test. | No — code uses `business_id` in all new queries. |
| 4 | DB — RLS | Policy names carry vertical nouns: `nursery_modules_business_owner`, `nursery_profiles_owner`, `authenticated_select_nursery_modules` (already dropped). In `20260529_businesses_d_update_rls.sql` and `20260522_rls_modules_nursery_modules.sql`. | DB-platform | **LOW** | Admin/cosmetic only. Policy names don't appear in query code. Makes RLS audit harder as platform scales. | No. |
| 5 | Code — Shared | `packages/shared/src/qr/print.ts` lines 5, 24, 46, 62, 69, 77, 92: `nurseryName?: string` parameter, `nurseryName` variable, `.nursery` CSS class. QR code printing is platform-wide; auto shops and nonprofits will need QR labels too. | shared-layer | **HIGH** | When Ignition or KINNA prints QR labels, the `nurseryName` parameter must be renamed to `businessName` (or a generic equivalent). CSS class `.nursery` in the injected HTML will ship to every vertical. |  No — QR label printing is Cultivar-only today. |
| 6 | Code — Shared | `packages/shared/src/ai/AIEngine.ts` lines 79, 113, 163–197: `shop_id?: string` in `AIPayload`, all public methods accept `shopId: string` parameter (`decodeVIN`, `decodeDTC`, `transcribeVoice`, `extractParts`, `readToolLabel`, `suggestPMI`, `auditInvoice`, `draftEstimate`, `savingsReport`). | shared-layer | **MED** | When Cultivar uses AIEngine (e.g., plant disease ID), the API signature requires `shopId` — semantically wrong and confusing. Should be `businessId`. Server-side AI router maps `shop_id` to the tenant; a mismatch here is invisible but grows into a real bug when Cultivar adds AI features. | No — Cultivar calls Claude API directly today, bypassing AIEngine. |
| 7 | Code — Shared | `packages/shared/src/pages/Settings.tsx` line 316: `placeholder="LAWNS Tree Farm, LLC"` hardcoded in the shared Settings page Business name field. | shared-layer | **MED** | Ignition OS or KINNA using the shared Settings page will display "LAWNS Tree Farm, LLC" as a field placeholder. Low functional risk (it's a placeholder, not a default value), but confusing and unprofessional for other verticals. | No — Ignition has its own settings flow today. |
| 8 | Code — Shared | `packages/shared/src/discovery/DiscoveryGlimpse.tsx` line 121: `"pricing signals, and where Cultivar OS can help most."` and line 283: `"Suggested in Cultivar OS"` — hardcoded product name in shared discovery component. | shared-layer | **MED** | When Ignition or KINNA uses DiscoveryGlimpse, it will display "Cultivar OS" branding to non-Cultivar prospects. Should accept a `productName` config prop. | No — discovery is Cultivar-only today. |
| 9 | Code — Shared | `packages/shared/src/discovery/index.ts` line 5: `export { nurserySchema } from './verticals/nursery'` — the shared discovery index barrel exports only the nursery vertical schema. | shared-layer | **LOW** | When Ignition or KINNA needs discovery, the index barrel makes only nurserySchema available at import. Requires adding shopSchema, kinnaSchema to this file. | No. |
| 10 | Code — Shared | `packages/shared/src/supabase/auth.ts` line 93: comment `// shop_id column — nurseries use nursery_id at DB level`. This comment is stale — the platform migrated to `business_id`; `nursery_id` columns are in cleanup migration E. Line 6: comment `SHA-256 hash salted by shop/nursery ID`. Line 252: doc comment references `shop_policy / nursery_policy`. Line 175: `"Used by Cultivar OS..."`. | shared-layer | **LOW** | Comments only — no runtime effect. But stale comments create wrong mental models for the next developer reading this file. | No. |
| 11 | Code — Shared | `packages/shared/src/notifications/types.ts` line 36: `tenantId?: string; // nurseryId, shopId, etc.` — comment lists vertical-specific ID names instead of the generic `businessId`. | shared-layer | **LOW** | Comment only. | No. |
| 12 | Code — Shared | `packages/shared/src/notifications/templates/cultivar.ts` lines 6–7, 39, 43, 62–63, 71, 97, 130, 155, 164, 168, 201: `"LAWNS Tree Farm"` hardcoded in the Cultivar notification template. | shared-layer (acceptable pattern) | **LOW** | This is intentional — `cultivar.ts` is a vertical-specific template file, not a generic shared template. The customer name and address should eventually come from the businesses table dynamically rather than being baked into the template, but this is pre-existing tech debt, not a naming leak. | No. |
| 13 | Code — BusinessProvider | `packages/shared/src/context/BusinessProvider.tsx` line 80: owner path filters `.eq('business_type', businessType)`. The **member path** (lines 87–98) queries `business_members` but does **NOT** filter by `business_type`. A user who is a Cultivar business member, logging into an Ignition app, would receive a nursery Business object back from the member path. | shared-layer | **HIGH** | Cross-vertical member scenario: Cultivar member logs into Ignition app with same email → member path fires → returns Cultivar nursery business → Ignition app gets wrong business type, wrong data model. Not currently exploitable (users don't share accounts across verticals), but it will be when TRACE has customers in multiple verticals. | No — currently not exploitable in production. Will become HIGH when multi-vertical users exist. |
| 14 | Code — API | `packages/cultivar-os/api/social/enable.ts` line 47, `api/social/publish.ts` line 32, `api/social/generate-posts.ts` line 59, `api/campaigns.ts` line 132: all hardcode `from('nursery_modules')`. Social and campaigns are platform-wide capabilities but their API handlers are locked to the Cultivar module table. | vertical-only (cultivar-os/api/) — but positioned for shared extraction | **MED** | When social or campaigns are extracted to `packages/shared/`, these table references must be parameterized or renamed. If extraction happens without addressing this, social will fail for Ignition/KINNA. | No — these APIs are Cultivar-only today (correctly isolated to `cultivar-os/api/`). |
| 15 | Code — Theme | `packages/shared/src/auth/AcceptInvite.tsx` line 42: `green = '#27500A'` hardcoded. `packages/shared/src/components/Button.tsx` lines 16–22: `#27500A`. `packages/shared/src/components/Badge.tsx` line 17: `#27500A`. `packages/shared/src/components/ProgressBar.tsx` line 14: `color = '#27500A'` default. `packages/shared/src/pages/Settings.tsx` line 5: `GREEN = '#27500A'`. `packages/shared/src/utils/statusColors.ts` line 7: `#27500A`. `packages/shared/src/notifications/templates/base.ts` line 16: `headerColor: '#27500A'`. | shared-layer | **MED** | Every shared component defaults to Cultivar's forest green. Ignition uses lime green (#22c55e). When Ignition (or KINNA) uses AcceptInvite, Button, Badge, ProgressBar, or Settings, it gets Cultivar green unless actively overridden. OwnerSignup already accepts backgroundColor/cardColor in config; the other shared primitives do not. | Partially — Ignition's own components don't use these shared primitives today. Will bite when shared components are adopted platform-wide. |
| 16 | Config — Env vars | `VITE_DEMO_NURSERY_ID` and `VITE_DEMO_BUSINESS_ID` both exist in Vercel env vars (per CLAUDE.md Section 2). Code reads: `usePlant.ts` reads `VITE_DEMO_NURSERY_ID` in fallback logic (verify); `packages/cultivar-os/src/lib/constants.ts` exports `DEMO_BUSINESS_ID` from `VITE_DEMO_BUSINESS_ID`. Both point to `a1b2c3d4-0000-0000-0000-000000000001`. | Cultivar-only (not shared) | **LOW** | Two env vars for the same UUID is confusing. `VITE_DEMO_NURSERY_ID` is stale vocabulary (pre-migration); `VITE_DEMO_BUSINESS_ID` is the correct post-migration name. If any shared code accidentally imports the nursery-named env var, it's a cross-vertical leak. | No. |

---

## Category 5 Detailed Analysis — business_type String Literals and the Ignition Loop

### What is stored vs. what is queried

| Vertical | Written by | Stored value | Queried by | Queried value | Match? |
|---|---|---|---|---|---|
| Cultivar | `App.tsx:9` → BusinessProvider prop; `OnboardingWizard.tsx:468` INSERT | `'nursery'` | `BusinessProvider.tsx:80` `.eq('business_type', 'nursery')` | `'nursery'` | ✅ |
| Ignition | `main.jsx:21` → BusinessProvider prop; `OnboardingWizard.jsx:82` OwnerSignup config | `'shop'` | `BusinessProvider.tsx:80` `.eq('business_type', 'shop')` | `'shop'` | ✅ |

### Is a business_type mismatch the root cause of the Ignition sign-in loop?

**No — not the root cause.** Both verticals correctly write and query their own `business_type` value. The strings match on both sides.

**The actual root cause (now fixed):** The OWNER SYNC effect in `CoreApp.jsx` waited for `ownerBusinessId` from BusinessProvider, but never called `setOnboardingDone(true)` when it resolved. A returning owner on a new device would have their businessId correctly resolved, but `onboardingDone` stayed `false` because the effect didn't set it. The fix (commit `a419bb8`) added `setOnboardingDone(true)` inside the OWNER SYNC effect.

**A latent risk remains (Finding #13):** The member path in BusinessProvider does NOT filter by `business_type`. If a user is a member of a Cultivar nursery and somehow has the same auth account used in Ignition, the member path would return the wrong business. This is not currently exploitable in production but is a structural gap.

**A historical risk (now inert):** If any test accounts were created during development by signing up through Cultivar's flow (writing `business_type='nursery'`) and then attempting to log in via the Ignition app (which queries `business_type='shop'`), the owner path would return null and the loop would fire. This was likely the observed behavior during development. The fix is: any such test account needs its businesses row updated to `business_type='shop'` manually.

---

## Do-Now vs. Post-Demo Recommendations

### Do Now (before LAWNS demo or before any second-vertical build begins)

| # | Finding | Action | Effort |
|---|---|---|---|
| 5 | QR print `nurseryName` | Rename parameter to `businessName`, rename CSS class `.nursery` to `.business-name` in `packages/shared/src/qr/print.ts`. Update one call site in Cultivar's PlantProfile. | Small — one file, one call site. |
| 7 | Settings placeholder "LAWNS Tree Farm, LLC" | Replace with generic `"e.g. Acme Business LLC"` or accept a `placeholder` prop. | Trivial — one line. |
| 13 | BusinessProvider member path: no business_type filter | Add `.eq('business_type', businessType)` to the business_members join query — or filter the returned `businesses` row by type after retrieval. One-line fix, significant structural correctness gain. | Small — one additional filter clause. |
| 8 | DiscoveryGlimpse "Cultivar OS" hardcoded | Accept `productName` prop; pass from Cultivar's SignUp.tsx config. | Small — one prop added. |

### Post-Demo (before second vertical ships)

| # | Finding | Action | Effort |
|---|---|---|---|
| 1 | `nursery_modules` table name | Write migration to rename → `business_modules`. Update all consumer queries (5 API files). Add column `business_type text` to distinguish which module catalog applies per vertical if needed. | Medium — migration + 5 files. Plan before doing. |
| 2 | `nursery_profiles` table name | Rename → `vertical_profiles` or `business_profiles`. Update OnboardingWizard and Settings consumers. | Medium — migration + consumer files. |
| 6 | AIEngine `shopId` parameter | Rename to `businessId` in all public method signatures and the `AIPayload` interface. Update the 3 Ignition modules that already import these methods (`IgnitionAudit`, `IgnitionCipher`, `PredictiveKey`). | Medium — shared interface change, multiple callers. |
| 15 | Color defaults (#27500A) in shared primitives | Add a design token system (`packages/shared/src/design-system/tokens.ts` — per CLAUDE.md roadmap). Shared components accept `theme` prop instead of hardcoding Cultivar green. | Large — per CLAUDE.md, scheduled post-August 2026. |
| 3 | `nursery_id` columns | Apply cleanup migration E (`20260529_businesses_e_cleanup.sql`) after smoke test. | Trivial — migration already written. |
| 16 | Dual demo env vars | Retire `VITE_DEMO_NURSERY_ID` from Vercel once confirmed no code reads it. | Trivial — Vercel dashboard change. |

### Do Not Touch Yet (post-KINNA Phase 1 build)

| # | Finding | Reason |
|---|---|---|
| 14 | social/campaigns APIs hardcode `nursery_modules` | These are correctly isolated to `cultivar-os/api/` today. Extract to shared only when a second vertical needs social/campaigns. At that point, also address Finding #1 (table rename). |
| 9 | Discovery index exports only nurserySchema | Add other schemas when those verticals need discovery. No structural change needed now. |

---

## Factual Corrections vs. Assertions in Other Docs

No corrections needed to `PLATFORM_STRATEGY.md` or `PLATFORM_AUDIT.md` based on this audit. The assertions about the multi-tenant extraction being complete are accurate. The audit confirms `business_id` is used in all new queries and the `nursery_id` cleanup migration is written but not yet applied — consistent with what CLAUDE.md states.

**One factual note:** CLAUDE.md's Handoff for 2026-06-04 says the Ignition sign-in loop was fixed by `setOnboardingDone(true)` in the OWNER SYNC effect. This audit confirms that is the correct root cause and fix. The business_type filter is NOT the root cause — both sides are correctly aligned.

---

## Conclusion

The platform has **4 do-now fixes** (all small) and **6 post-demo migrations** (medium effort) before vertical #3 (KINNA or Conduit) can be built without hitting naming-driven bugs. The most structurally important is **Finding #1** (`nursery_modules` rename) because the social/campaigns module system will be one of the first capabilities extracted to shared for multi-vertical use. Fix #13 (member path business_type filter) is the easiest high-value fix — one additional query clause closes a latent cross-vertical data bleed.

The Ignition sign-in loop is **confirmed fixed by commit `a419bb8`** and is not a naming-leak issue.
