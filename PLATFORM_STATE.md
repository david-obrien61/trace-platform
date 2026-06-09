# PLATFORM_STATE.md
<!-- INDEX of VERIFIED platform state. Every row cites LEVEL + LOCATION + EVIDENCE.
     PRESUMED/UNKNOWN are quarantined below — never in the verified table.
     Read first every session. Update the relevant line after any state change.
     Never round a level up. -->
<!-- Last verified: 2026-06-10 (THUNDER · instrumentation pass) -->
<!-- Detail docs: built-inventory.md, CLAUDE.md, STANDARDS.md, PLATFORM_STRATEGY.md -->

## VERIFICATION KEY
- **EXISTS** — file present; Claude read it. Cite path.
- **WIRED** — EXISTS + has caller(s) in a vertical; grep found them. Cite caller file:line.
- **WORKS** — WIRED + concrete evidence of correct output (passing test, confirmed-live use, or build-verified runtime path). Name the evidence.
- **ORPHANED** — EXISTS; zero callers in either vertical (dead code, honest flag).
- **BROKEN** — EXISTS but import or runtime path is provably severed (missing dep, wrong path).

---

## SHARED LAYER (`packages/shared/src/`)

| ITEM | LEVEL | LOCATION | EVIDENCE | → DETAIL |
|---|---|---|---|---|
| **AI · AIEngine.ts** | WIRED | `ai/AIEngine.ts` | 3 callers: IgnitionAudit:16, IgnitionCipher:10, PredictiveKey:16 — build ✅ · **DARK in Ignition prod** (VITE_API_URL unset → every call returns {ok:false}) | CLAUDE.md TD#25 |
| **AI · capabilities.ts** | WIRED | `ai/capabilities.ts` | Called by `ai/execute.ts` (internal only) | CLAUDE.md §HANDOFF |
| **AI · execute.ts** | WORKS | `ai/execute.ts` | 4 internal callers (engine.ts, synthesis.ts, social/generate.ts, campaigns/generate.ts) · social_drafts confirmed live 2026-06-08 via REST API | CLAUDE.md §HANDOFF 2026-06-05 |
| **AI · parseJson.ts** | WIRED | `ai/parseJson.ts` | Called by `ai/execute.ts` (internal) | — |
| **Auth · AcceptInvite.tsx** | WIRED | `auth/AcceptInvite.tsx` | cultivar-os router.tsx:30 — /join route renders it | built-inventory.md |
| **Auth · OwnerSignup.tsx** | WIRED | `auth/OwnerSignup.tsx` | SignUp.tsx:52 (Cultivar), modules/OnboardingWizard.jsx:262 (Ignition) · **add-a-business path added 2026-06-11**: detects existing session → skips signUp → creates second businesses row under same auth.uid() | built-inventory.md |
| **Auth · acceptInvitation.ts** | WIRED | `auth/acceptInvitation.ts` | api/members/invite.ts:15,25 + api/members/accept-invite.ts:18 + api/members/preview-invite.ts:17 | built-inventory.md |
| **Auth · configureAuth.tsx** | WIRED | `auth/configureAuth.tsx` | cultivar-os/src/lib/auth.ts:1 | built-inventory.md |
| **Auth · invitations.ts** | WIRED | `auth/invitations.ts` | Settings.tsx: createInvitation:171, getPendingInvitations:147, revokeInvitation:200 | CLAUDE.md §HANDOFF 2026-06-02 |
| **Auth · members.ts** | WIRED | `auth/members.ts` | Settings.tsx: getMembersByBusiness:146, removeMember:209 | CLAUDE.md §HANDOFF 2026-06-02 |
| **Auth · permissions.ts** | ORPHANED | `auth/permissions.ts` | Zero callers in either vertical — callers not yet migrated (TD#28 blocks this) | CLAUDE.md TD#28 |
| **Auth · types.ts** | WIRED | `auth/types.ts` | Settings.tsx: type imports (Member, Invitation) | — |
| **Business-Logic · MarginEngine.ts** | ORPHANED | `business-logic/MarginEngine.ts` | EXISTS, built correctly, zero callers — non-destructive phase; migration checklist pending | CLAUDE.md TD#16 · `docs/audits/margin-engine-migration-checklist-2026-06-10.md` |
| **Campaigns · generate.ts** | WIRED | `campaigns/generate.ts` | api/campaigns.ts:2 (generateCampaignPosts called on generate action) | built-inventory.md |
| **Campaigns · types.ts** | WIRED | `campaigns/types.ts` | Campaigns.tsx:5, CampaignDetail.tsx:5 (type imports Campaign, CampaignPost) | — |
| **Components · Card.tsx** | WIRED | `components/Card.tsx` | Dashboard.tsx:3 — `import { Card }` | — |
| **Components · Tile.tsx** | WIRED | `components/tiles/Tile.tsx` | Dashboard.tsx:9 — `import { Tile }` | — |
| **Components · TileGrid.tsx** | WIRED | `components/tiles/TileGrid.tsx` | Dashboard.tsx:8 — `import { TileGrid }` · rendered at line 716 | built-inventory.md |
| **Components · SavingsReport.jsx** | BROKEN | `components/SavingsReport.jsx` | Imports `'../DataBridge'` and `'../MarginEngine'` — neither exists at that path in shared/src/. Also: IgnitionOmniDashboard.jsx:14 imports `'./SavingsReport'` which is missing from `modules/` (TD#10) | CLAUDE.md TD#10 |
| **Components · Button/Badge/Card/FormField/ProgressBar/Skeleton/LockedOverlay** | EXISTS | `components/*.tsx` | Exported via shared/src/index.ts barrel; no direct imports found in either vertical's source files (index.ts barrel itself has zero callers confirmed) | — |
| **Components · QuickBooksConnector.jsx** | EXISTS | `components/QuickBooksConnector.jsx` | Zero callers in either vertical's source confirmed | — |
| **Context · BusinessProvider.tsx** | WORKS | `context/BusinessProvider.tsx` | App.tsx:9 (Cultivar, businessType="nursery"), main.jsx:7 (Ignition, businessType="shop") · 29/29 test assertions passed 2026-06-03 · **multi-business 2026-06-11**: both paths now array-resolve; auto-select 1-biz (regression gate); picker 2+-biz + localStorage persistence; `[TRACE:BUSINESS]` born ON; builds green | CLAUDE.md §HANDOFF |
| **Design · tokens.ts** | EXISTS | `design-system/tokens.ts` | Zero callers in either vertical confirmed | — |
| **Discovery · DiscoveryGlimpse.tsx** | WIRED | `discovery/DiscoveryGlimpse.tsx` | SignUp.tsx:16 — `<DiscoveryGlimpse />` as verticalStep during signup | CLAUDE.md §HANDOFF 2026-06-05 |
| **Discovery · engine.ts** | WORKS | `discovery/engine.ts` | api/discovery/ingest.ts:3 (runIdentity, runAnalysis) · generation confirmed 2026-06-08 (social_drafts rows with period_start populated) | CLAUDE.md §HANDOFF 2026-06-08 |
| **Discovery · synthesis.ts** | WIRED | `discovery/synthesis.ts` | api/discovery/ingest.ts:4 (runSynthesis) | CLAUDE.md §HANDOFF 2026-06-05 |
| **Discovery · seed.ts** | WIRED | `discovery/seed.ts` | api/discovery/ingest.ts:6 (seedServiceOfferings) — fires only when businessId in POST body | CLAUDE.md §HANDOFF 2026-06-05 |
| **Discovery · adapters/website.ts** | WIRED | `discovery/adapters/website.ts` | api/discovery/ingest.ts:2 | — |
| **Discovery · verticals/nursery.ts** | WIRED | `discovery/verticals/nursery.ts` | api/discovery/ingest.ts:5 (nurserySchema) | — |
| **Discovery · types.ts** | WIRED | `discovery/types.ts` | api/discovery/ingest.ts:8, DiscoveryInspect.tsx:2 (type imports) | — |
| **Modules · PMI.tsx** | WIRED | `modules/PMI.tsx` | cultivar-os/src/pages/PMI.tsx:1 — `import { PMI as PMIModule }` | — |
| **Notifications · send.ts** | WORKS | `notifications/send.ts` | api/orders/submit.ts:2, api/discovery/ingest.ts:7 · order confirmation emails confirmed operational (2026-05-27) | built-inventory.md |
| **Notifications · queue.ts (sendSilently)** | WORKS | `notifications/queue.ts` | useSubmitOrder.ts:2 — fire-and-forget after QB call · confirmed operational 2026-05-27 | CLAUDE.md §HANDOFF 2026-05-23 |
| **Notifications · templates/cultivar.ts** | WIRED | `notifications/templates/cultivar.ts` | Used by send.ts template dispatch (order_confirmation, silent_partner_analysis) | — |
| **Notifications · templates/ignition.ts** | EXISTS | `notifications/templates/ignition.ts` | No confirmed callers in Ignition production code | — |
| **Onboarding · DemoLaunchButton.tsx** | ORPHANED | `onboarding/DemoLaunchButton.tsx` | Zero callers — CoreApp.jsx uses ?demo= URL param + OnboardingWizard.jsx directly | CLAUDE.md §HANDOFF 2026-06-10 |
| **Pages · Settings.tsx** | WIRED | `pages/Settings.tsx` | cultivar-os/src/pages/Settings.tsx:3 — `<SharedSettings … />` wrapper | CLAUDE.md §HANDOFF 2026-05-29 |
| **Pricing · marginEngine.ts** | ORPHANED | `pricing/marginEngine.ts` | Self-annotated: "Zero live callers confirmed." Exported in index.ts; index.ts barrel itself has no confirmed consumer. Replaced by business-logic/MarginEngine.ts | CLAUDE.md TD#16 |
| **QR · generate.ts** | EXISTS | `qr/generate.ts` | Mentioned in Help.tsx prose only; no code imports it | — |
| **QR · print.ts** | EXISTS | `qr/print.ts` | No confirmed callers in either vertical source | CLAUDE.md §1.5 (nurseryName rename deferred) |
| **QuickBooks · refresh.ts** | WIRED | `quickbooks/refresh.ts` | api/qbo/status.ts:2, api/qbo/invoice/cultivar.ts:2 | CLAUDE.md §HANDOFF 2026-06-08 |
| **QuickBooks · oauth.ts** | EXISTS | `quickbooks/oauth.ts` | OFF LIMITS per CLAUDE.md §7. Exported in index.ts; no direct callers confirmed outside the barrel | CLAUDE.md §7 |
| **QuickBooks · invoice.ts** | ORPHANED | `quickbooks/invoice.ts` | Exported in index.ts; cultivar invoice handler reimplements inline in api/qbo/invoice/cultivar.ts — no direct callers | CLAUDE.md TD#2 |
| **QuickBooks · customer.ts** | ORPHANED | `quickbooks/customer.ts` | Same as invoice.ts — no direct callers; cultivar handler has inline findOrCreateQBCustomer at line 39 | — |
| **Social · generate.ts** | WORKS | `social/generate.ts` | api/social/generate-posts.ts:2 (generateSocialDrafts) · 2 fresh rows confirmed in social_drafts 2026-06-08 via REST API | CLAUDE.md §HANDOFF 2026-06-08 |
| **Supabase · client.ts** | WIRED | `supabase/client.ts` | cultivar-os/src/lib/supabase.ts:1 (re-exports supabase), ignition-os/supabase.js (re-exports) | — |
| **Supabase · auth.ts** | EXISTS | `supabase/auth.ts` | OFF LIMITS per CLAUDE.md §7 · exported in index.ts; authenticateMember + autoEnrollDevice are the target of identity reconciliation | CLAUDE.md §7 |
| **Utils · formatCurrency.ts** | EXISTS | `utils/formatCurrency.ts` | Exported in index.ts; no confirmed direct imports in either vertical | — |
| **Utils · dateHelpers.ts** | EXISTS | `utils/dateHelpers.ts` | Exported in index.ts; no confirmed direct imports | — |
| **Utils · statusColors.ts** | EXISTS | `utils/statusColors.ts` | Exported in index.ts; no confirmed direct imports | — |

---

## CULTIVAR OS (`packages/cultivar-os/`)

| ITEM | LEVEL | LOCATION | EVIDENCE | → DETAIL |
|---|---|---|---|---|
| **Build** | WORKS | `packages/cultivar-os/` | 2177 modules, zero errors — 2026-06-10 | — |
| **Vercel deploy** | WORKS | cultivar-os.vercel.app | GitHub push → auto-deploy ● Ready (23s) · confirmed 2026-06-03 | CLAUDE.md §HANDOFF 2026-06-03 |
| **Vercel functions (11)** | WORKS | `api/*.ts` + subdirs | 11 live functions: campaigns, dashboard, discovery/ingest, members/invite, orders/submit, qbo/auth-url, qbo/callback, qbo/invoice/cultivar, qbo/status, social/enable, social/generate-posts · **1 slot below 12-function Hobby limit** | CLAUDE.md §HANDOFF 2026-06-03 |
| **QR checkout → QB invoice** | WORKS | `src/pages/PlantProfile → CartReview → api/orders/submit + api/qbo/invoice/cultivar` | Confirmed end-to-end 2026-05-27 (Terry demo run) · Invoice #3648.380 $920.13 generated | CLAUDE.md §Key Data |
| **BusinessProvider / tenant isolation** | WORKS | `src/App.tsx + context/NurseryProvider.tsx` | businessType="nursery" · cross-vertical member filter applied · 29/29 test assertions 2026-06-03 · **multi-business (Option B) added 2026-06-11**: .single() replaced on both paths; auto-select for 1 business (regression gate ✓); picker for 2+ with localStorage persistence; `[TRACE:BUSINESS]` born ON; builds green Cultivar ✓ Ignition ✓ | CLAUDE.md §HANDOFF |
| **OwnerSignup** | WIRED | `src/pages/SignUp.tsx` | Renders shared OwnerSignup with cultivarConfig · → /onboarding on success | CLAUDE.md §HANDOFF 2026-06-04 |
| **Dashboard tile grid** | WORKS | `src/pages/Dashboard.tsx` | TileGrid + Tile from shared · QB reconnect banner wired to accounting_token_expires_at · confirmed operational demo 2026-05-27 | CLAUDE.md TD#15 resolved |
| **QB dead-connection detection** | WORKS | `api/qbo/status.ts` | Proactive expiry check + refreshQBToken() on every dashboard load · TD#15 resolved 2026-06-08 commit 444fbb1 | CLAUDE.md TD#15 |
| **Social drafts generation** | WORKS | `api/social/generate-posts.ts` | generateSocialDrafts called with advert_channels · 2 fresh rows confirmed 2026-06-08 via REST API (cadence, period_start populated) | CLAUDE.md §HANDOFF 2026-06-08 |
| **Social campaign generator** | WIRED | `api/campaigns.ts` | generateCampaignPosts with advertChannels · build passes · **→ needs David operational check** (advert_channels config migration may be pending) | CLAUDE.md TD#22 |
| **advert_channels config** | WIRED | `api/social/enable.ts + src/pages/SocialSetup.tsx` | SocialSetup writes advert_channels array · social generate-posts reads it · **→ David must apply 20260608_advert_channels_config.sql + verify** | CLAUDE.md TD#22 |
| **social_drafts platform_check** | EXISTS | `supabase/migrations/20260609_social_drafts_platform_check.sql` | Migration written (instagram/facebook/tiktok/twitter/sms) · **→ David must apply to bgobkjcopcxusjsetfob + verify** | CLAUDE.md TD#22 |
| **Team member invite / AcceptInvite** | WIRED | `api/members/invite.ts + src/router.tsx (/join)` | previewInvitation + acceptInvitation wired · AcceptInvite renders on /join · → operational check blocked pending David adding OWNER row to business_members | CLAUDE.md §HANDOFF 2026-06-03 |
| **Settings page (team + nursery)** | WIRED | `src/pages/Settings.tsx` | Wraps SharedSettings · member list + invite form at Settings.tsx:146-200 | CLAUDE.md §HANDOFF 2026-06-03 |
| **Discovery (admin, /discovery/inspect)** | WIRED | `src/pages/DiscoveryInspect.tsx + api/discovery/ingest.ts` | Two-pass (Haiku identity + Sonnet analysis) · admin-only URL-gated · DiscoveryGlimpse wired in SignUp.tsx as verticalStep | CLAUDE.md §HANDOFF 2026-06-05 |
| **Campaigns UI** | WIRED | `src/pages/Campaigns.tsx + CampaignDetail.tsx` | Renders campaign_posts with Copy caption + edit flow · status→'copied' on handleCopy · **→ needs David operational check** | built-inventory.md |
| **OnboardingWizard (5-path)** | WIRED | `src/pages/OnboardingWizard.tsx` | /onboarding route in router · existing businesses row detected → starts at CHOOSE_PATH | CLAUDE.md §HANDOFF 2026-05-29 |
| **Delivery routing** | WIRED | `src/pages/DeliveryRoute.tsx` | /deliveries route · fetches pending delivery orders + customer addresses · Google Maps multi-stop URL | CLAUDE.md §HANDOFF 2026-05-29 |
| **Orders page** | WIRED | `src/pages/Orders.tsx` | /orders route · last 50 orders with leakage_flag coloring | CLAUDE.md §HANDOFF 2026-05-29 |
| **PMI page** | WIRED | `src/pages/PMI.tsx` | /pmi route · uses shared PMI module (useBusinessContext for businessId) | — |
| **business_modules table (RLS)** | WORKS | `supabase/migrations/20260604_business_modules.sql` | Membership-scoped RLS · all 6 API/hook callers repointed from nursery_modules · build ✅ · **→ David must run DROP TABLE nursery_modules CASCADE after smoke test** | CLAUDE.md §1.5, TD (resolved 2026-06-04) |
| **QB OAuth (production)** | WORKS | `api/qbo/auth-url.ts + api/qbo/callback.ts` | QBO_ENVIRONMENT=production in Vercel · tokens in businesses.accounting_* columns · confirmed connected 2026-05-22 (renewed post audit) | CLAUDE.md §Vercel Env |

---

## IGNITION OS (`packages/ignition-os/`)

| ITEM | LEVEL | LOCATION | EVIDENCE | → DETAIL |
|---|---|---|---|---|
| **Build** | WORKS | `packages/ignition-os/` | 1838 modules, zero errors — 2026-06-10 | — |
| **Tailwind removed** | WORKS | `packages/ignition-os/index.html + 34 converted files` | CDN script tag removed · grep for className= in .jsx with non-ign- classes → zero results · build ✅ 2026-06-10 | CLAUDE.md TD#14 resolved · `docs/tailwind-conversion-progress.md` |
| **ignition-theme.css** | WORKS | `packages/ignition-os/ignition-theme.css` | Provides ign-btn-*, ign-card-hover, ign-pulse/spin/bounce, ign-scroll, ign-backdrop · imported via main.jsx | CLAUDE.md §HANDOFF 2026-06-10 |
| **RO workflow (8-step chain)** | WIRED | `CoreApp.jsx:14-33` | 18 modules wired: IgnitionFlux, IgnitionIntake, IgnitionEval, IgnitionEstimate, IgnitionKosk, IgnitionInvoice, IgnitionPort + 11 more · build ✅ | `docs/ignition-trace-coverage.md` |
| **[TRACE:*] instrumentation** | WORKS | 21 files, `packages/ignition-os/` | 5 subsystems: MARGIN/AUTH/DATA/WORKFLOW/API · all gated behind named const (TRACE_X = true) · build ✅ 2026-06-10 | CLAUDE.md §HANDOFF 2026-06-10 · `docs/ignition-trace-coverage.md` |
| **OnboardingWizard (?demo= path)** | WIRED | `packages/ignition-os/CoreApp.jsx + OnboardingWizard.jsx (root)` | ?demo=true → 5-step flow · ?demo=quick → CHOOSE_PATH direct · MarginPath uses local MarginEngine.js (correct slabs) | CLAUDE.md §HANDOFF 2026-06-10 |
| **DataBridge (localStorage)** | WIRED | `packages/ignition-os/DataBridge.js` | Core session/state storage · imported by CoreApp, all workflow modules · **4 orphaned keys (TD#26)** | CLAUDE.md TD#26 |
| **AI features (6 modules)** | WIRED | `IgnitionAudit:16, IgnitionCipher:10, PredictiveKey:16 + ExternalBridge` | Code wired to AIEngine.call() · **ALL DARK IN PROD**: VITE_API_URL unset → {ok:false} silently | CLAUDE.md TD#25 |
| **Ignition QB** | EXISTS | `ExternalBridge.js` | VITE_API_URL dark · **zero api/qbo/* Vercel functions exist for Ignition** (unlike Cultivar) · QB is not just dark — it doesn't exist | CLAUDE.md TD#25 |
| **pilot_all RLS (19+ tables)** | EXISTS | `packages/ignition-os/supabase/migrations/supabase_rls_pilot.sql` | USING(true) WITH CHECK(true) on all tables except shop_members · client-side enforcement only · SECURITY DEBT | CLAUDE.md TD#28 |
| **shop_members (scoped RLS)** | WIRED | `packages/ignition-os/supabase/migrations/20260603_recreate_shop_members.sql` | shop_owner_all (EXISTS businesses.owner_id=auth.uid()) + shop_member_self_select | CLAUDE.md §Auth Architecture |
| **MarginEngine.js (A path — local)** | WIRED | `packages/ignition-os/MarginEngine.js` | 6 callers: IgnitionPort, IgnitionProcure, PriceField, OnboardingWizard (root+modules), IgnitionCipher · **DEPRECATED 🔴 · migration to shared pending** | CLAUDE.md TD#16 |
| **IgnitionOmniDashboard SAVINGS tab** | BROKEN | `packages/ignition-os/modules/IgnitionOmniDashboard.jsx:14` | Imports `'./SavingsReport'` · file does not exist at `packages/ignition-os/modules/SavingsReport.jsx` · SAVINGS tab broken at runtime | CLAUDE.md TD#10 |
| **10 tables: no committed migration** | EXISTS | `ufsgqckbxdtwviqjjtos` (DB only) | dtc_codes, eval_photos, tools, tool_signout_log, repair_logs, customer_authorizations, concept_aliases, purchase_orders, pmi_schedules, ai_usage — in code, no `packages/ignition-os/supabase/migrations/*.sql` | CLAUDE.md TD#27 |
| **3 dropped tables (ForgotPin/JoinFlow/Devices)** | BROKEN | `CoreApp.jsx:52, CoreApp.jsx:87, IgnitionAdmin.jsx:1122 + 602,636,640` | pin_resets / shop_invites / member_devices — dropped 2026-06-02, never recreated · features compile + route but fail at runtime | CLAUDE.md TD#27 |
| **shared/src/auth/permissions.ts** | ORPHANED | `packages/shared/src/auth/permissions.ts` | Built; zero callers migrated · blocked on TD#28 (pilot_all replacement) | CLAUDE.md TD#28 |

---

## IN-FLIGHT (building now / pending David operational check)

| ITEM | STATUS | BLOCKER / NEXT ACTION |
|---|---|---|
| **advert_channels migration** | David must apply | `supabase/migrations/20260608_advert_channels_config.sql` → bgobkjcopcxusjsetfob · run VERIFICATION QUERY |
| **social_drafts platform_check** | David must apply | `supabase/migrations/20260609_social_drafts_platform_check.sql` → bgobkjcopcxusjsetfob · run VERIFICATION QUERY |
| **nursery_modules DROP** | David must run | After smoke test passes: `DROP TABLE nursery_modules CASCADE;` in bgobkjcopcxusjsetfob |
| **MarginEngine callers migration** | Next build session | Checklist: `docs/audits/margin-engine-migration-checklist-2026-06-10.md` · order: B barrel → A callers → SavingsReport → D → C (price change last) |
| **Receipt Keeper v1** | Not started | Gemini Flash OCR · local receipts table · confirm-before-commit |
| **Railway decommission** | Blocked | Port dtc_decode + estimate_draft to Vercel functions first · then kill Railway · see TD#12 kill path |
| **Ignition QB** | Not started | No api/qbo/* functions exist for Ignition · must build from scratch (not port from Cultivar) |
| **STD-008 inverse sweep** | David must run | `docs/audits/std008-inverse-sweep-2026-06-09.sql` in ufsgqckbxdtwviqjjtos SQL editor |
| **business_members pin_hash verify (TD#18)** | David must run | `SELECT column_name FROM information_schema.columns WHERE table_name = 'business_members'` → confirm pin_hash present in bgobkjcopcxusjsetfob |

---

## HARVEST MAP — shared organs (levels)

| ORGAN | LEVEL | NOTES |
|---|---|---|
| AI gateway (execute.ts + capabilities.ts) | WORKS | Cultivar only; Ignition VITE_API_URL unset |
| BusinessProvider | WORKS | Both verticals |
| Notifications (send + queue) | WORKS | Cultivar only (Ignition: no Supabase auth session for email) |
| OwnerSignup | WIRED | Both verticals wired; Ignition operational confirm pending |
| Discovery engine (2-pass) | WIRED | Cultivar only |
| Social generator | WORKS | Cultivar only |
| Campaign generator | WIRED | Cultivar only |
| QuickBooks refresh | WIRED | Cultivar only |
| MarginEngine.ts (canonical) | ORPHANED | Built; callers not migrated yet |
| permissions.ts | ORPHANED | Built; callers not migrated (TD#28 blocker) |
| TileGrid + Tile | WIRED | Cultivar only |
| Card | WIRED | Cultivar only |
| QB invoice.ts / customer.ts | ORPHANED | Cultivar reimplements inline |
| QR generate.ts / print.ts | EXISTS | No confirmed callers |
| FormField / Button / Badge / ProgressBar / Skeleton / LockedOverlay | EXISTS | No confirmed direct callers in either vertical |
| Utils (formatCurrency / dateHelpers / statusColors) | EXISTS | Exported in index.ts; no confirmed direct callers |
| design-system/tokens.ts | EXISTS | No confirmed callers |
| DemoLaunchButton | ORPHANED | No callers; CoreApp uses URL param + OnboardingWizard.jsx directly |

---

## STANDARDS

| STD | NAME | STATUS | → FULL TEXT |
|---|---|---|---|
| STD-001 | Prove Before You Act | Active | STANDARDS.md |
| STD-002 | Red-Test-First | Active | STANDARDS.md |
| STD-003 | Instrumentation Preserved | Active | STANDARDS.md |
| STD-004 | Tenant Isolation Bar | Active | STANDARDS.md |
| STD-005 | Verbatim Decisions | Active | STANDARDS.md |
| STD-006 | Vertical-Agnostic | Active | STANDARDS.md |
| STD-007 | Derived Connection State | Active — TD#15 resolved 2026-06-08 | STANDARDS.md |
| STD-008 | Committed Migration ≠ Applied | Active — inverse extension added 2026-06-09 | STANDARDS.md |
| STD-009 | No Hardcoded Config in Generation | Active — advert_channels router applied 2026-06-08 | STANDARDS.md |
| STD-010 | Decoded Names in Built Inventory | Active — 13 Ignition naming candidates in TD#24 | STANDARDS.md |

---

## ⚠️ NOT YET VERIFIED

Items believed true but not machine-confirmed during this session. Never blend with the verified table above.

| ITEM | BELIEVED STATE | WHAT'S MISSING |
|---|---|---|
| **business_members.pin_hash** (bgobkjcopcxusjsetfob) | Probably applied (29/29 test passed 2026-06-03) | `SELECT column_name FROM information_schema.columns WHERE table_name = 'business_members'` not run post-migration — TD#18 |
| **advert_channels config migration** | Migration written; live DB state unknown | David must apply 20260608_advert_channels_config.sql + run VERIFICATION QUERY |
| **social_drafts platform_check migration** | Migration written; live DB state unknown | David must apply 20260609_social_drafts_platform_check.sql + run VERIFICATION QUERY |
| **Ignition shop_members schema (ufsgqckbxdtwviqjjtos)** | Recreated migration committed 2026-06-03 | No confirmed information_schema check post-apply |
| **10 Ignition tables (ufsgqckbxdtwviqjjtos)** | Probably hand-applied (code compiles and routes) | David must run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'` in ufsgqckbxdtwviqjjtos — TD#27 |
| **QR tags (SCV-0031, NCM-0042, MS30-001)** | Printed per handoff notes | Not machine-verifiable |
| **cultivar-os Vercel social/publish.ts** | Was removed; campaigns.ts now handles copy-post | social/publish.ts not in api/ tree — confirmed by find; TD#21 (orphaned campaigns/ subdir files) still present |
| **RLS policies on nurseries/plants/plant_events/addons** | Migrations ported; assumed to work | "never confirmed via a frontend read" per TD#8 — not verified this session |
| **STYLE_DEBUG flags** | Some converted files still have STYLE_DEBUG=true | Tailwind pass handoff notes this was incomplete — non-blocking but not clean |
