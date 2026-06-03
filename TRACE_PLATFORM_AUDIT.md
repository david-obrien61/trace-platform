# TRACE Platform Baseline Audit

## Scope & Hierarchy

This document owns current code state — what exists, what's stubbed, what needs extracting. This doc is the source of truth for any question about what is actually built right now.

When this doc conflicts with another:
- For target state and architectural intent, see PLATFORM_STRATEGY.md
- For strategy, revenue, and demo plan, see MASTER_BRIEF.md
- For current infrastructure specifics (Supabase projects, env vars, deployment URLs, recent session work), see CLAUDE.md
- For the discovery module's specification, see DISCOVERY_MODULE_BRIEF.md (created Session 1b)

When this audit says X exists and another doc says Y exists, the audit wins. Other docs are intent; this doc is reality.

## TRACE — Who We Are

TRACE is a family. Terrence, Regina, Andrew, Connor, Erin. We named the company after ourselves around a kitchen table, because what we are building is meant to last longer than any one of us and meant to belong to all of us.

Who builds it today. David O'Brien — Terrence — is the builder today. 23 years 9 months military service, 30 years federal service in knowledge management, a lifetime as an electrician, mechanic, and builder. He writes the platform working with Claude and Claude Code as engineering partners. Andrew lives in the house and builds his own products alongside David. He established TRACE's foundation — set up Git, GitHub, Supabase, and Railway, and the working stack TRACE runs on. Before that setup, code was being lost. After it, every commit was preserved. The velocity that followed is built on the substrate Andrew laid down. Erin also lives in the house when she's not on travel nursing assignments; she's currently on an ER rotation in California. Connor visits regularly from out of state and is on call by video any time the work needs him. Regina is the program director at Operation Liberty Hill, the anchor pilot customer for KINNA-OS, and the voice the platform answers to on what it means to treat people as kin.

The five of us are not yet all on payroll. We are a family company in formation. The founder builds; the family is within reach; the runway to bring everyone in is what we are building toward.

The craft. Every TRACE product is Built with CAI — our signature on the work. The signature is literal: this software is built with composable AI as the engineering partner, used carefully, used well, used by people who know what good work looks like because they've done it with their hands for forty years.

The product line. We don't sell platforms. We sell the operating system for your kind of business: Cultivar OS for nurseries and garden centers, Ignition OS for diesel and auto repair shops, Conduit OS for HVAC, plumbing, and electrical, KINNA-OS for community nonprofits, CoolRunnings for homes. Each is its own product. Each is also part of the same family of software underneath — the way a small dedicated family ships fast and stays consistent.

The silent partner. We are not here to replace what you have. You already have QuickBooks, or Square, or Neon One, or a notebook full of phone numbers. You already have a business that works. What you don't have is enough hours in the day, and the gaps between your tools are where your time and your money are leaking out.

We come alongside, quietly. We connect what you already use. We fill the gaps no one else fills. We give you back your evenings. Your customers see you — not us. We are the silent partner that powers you to soar. For nonprofits, that partnership often shows up as "Powered by KINNA" — a quiet credential visible to funders and peers. For commercial businesses, it usually doesn't need a label at all. The OS is just the tool you use to run your day, made by a family who built it because they needed it themselves.

The one-sentence version: We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself.

**Date:** May 23, 2026  
**Scope:** ignition-os · cultivar-os · packages/shared  
**Purpose:** Blueprint for shared/ before Conduit OS is built  
**Philosophy:** Every capability is a CONNECTOR (links to existing tools) or GAP-FILLER (adds what no tool gives)

---

## Reuse ratio — corrected ground truth (2026-05-28)

Reuse percentages cited in prior sessions (78% / 68% reuse, 12% refactor, 20% vertical) were verbal estimates that drifted across sessions and were never committed as counted results. Claude Code flagged the figure as aspirational as early as 2026-05-22. The counted breakdown from this audit's 135 feature rows is:

| Label | Row count | Approximate % | Meaning |
|---|---|---|---|
| CONFIGURE (in shared/, needs config only) | 26 rows | ~19% | "already shared" |
| EXTRACT (in one vertical, move to shared) | 33 rows | ~24% | "needs refactor" |
| BUILD NEW (does not exist anywhere yet) | 56 rows | ~41% | "net-new" |
| IGNORE (intentionally vertical-specific) | 17 rows | ~13% | — |
| CONNECTOR (external integration) | 3 rows | — | — |

Ground truth: current extracted reuse is ~19%, with a large (~41%) BUILD NEW backlog. The "75-80% reuse" target is the proven-platform **destination**, not the current state. Honest external framing: "platform thesis validated, ~20% extracted today, clear path to 75%+" — NOT "80% reuse proven across 3 verticals." This note is the single source of truth for reuse ratio; do not cite remembered figures.

---

## HOW TO READ THIS DOCUMENT

**Actions:**
- `EXTRACT` → move to packages/shared (both verticals need it)
- `CONFIGURE` → already in shared, needs vertical config
- `BUILD NEW` → gap-filler unique to cultivar-os
- `CONNECTOR` → integration with external tool
- `IGNORE` → vertical-specific, stays where it is

**Status abbreviations:**
- ✅ Built and live
- 🟡 Stubbed / designed, not wired
- ❌ Not started

---

## 1. AUTHENTICATION & ROLES

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Authentication strategy | PIN (4-digit), localStorage-first | Email/password, Supabase session | `configureAuth.tsx` factory — email + PIN strategies | CONFIGURE |
| Session management | `DataBridge.getProfiles()` + `current_user` in localStorage | `useAuth.ts` → Supabase `onAuthStateChange` | `configureAuth.tsx` returns `useSession` hook | CONFIGURE |
| Route protection | `EnrollmentCatch.jsx` | `PrivateRoute.tsx` | `configureAuth.tsx` returns PrivateRoute | CONFIGURE |
| Role definitions | OWNER, TECH, FRONT_OFFICE, ADMIN in `OnboardingWizard` finalize() | Owner-only (single role implied, no role table) | None | EXTRACT |
| Permission mapping | Per-role `allowed` array: `['intake','queue','vin','estimates',...]` | No permissions beyond auth/unauth | None | EXTRACT |
| Settings access by role | Admin-gated via DataBridge `current_user.role === 'OWNER'` | ✅ Permission gate: `isOwner \|\| perms.includes('manage_settings')`. MANAGER role excluded. Auto-redirect to /dashboard. | `userPermissions` + `isOwner` in BusinessProvider context | ✅ BUILT (2026-06-02) |
| Who sees what on dashboard | Role-based module visibility in DataBridge `shop_policy.active_modules` | Single owner view | None | EXTRACT |
| QR join / team onboarding | `OnboardingWizard` TEAM_QR step: QR + share link → `/?join=<shopId>` | ✅ `/join?token=...` route (AcceptInvite from shared). Email-based invite flow. | `packages/shared/src/auth/AcceptInvite.tsx` | ✅ BUILT (2026-06-02) |
| Multi-account login | PIN picker (any registered PIN unlocks session) | Single owner login | None | IGNORE (vertical-specific) |

**Notes:**
- ~~Cultivar OS has no concept of staff roles yet.~~ **(updated 2026-06-02)** OWNER / MANAGER / STAFF roles are live in `packages/cultivar-os/src/auth/roles.ts`. MANAGER = day-to-day ops (no settings). STAFF = QR checkout + orders only. Permission arrays stored in `business_members.permissions` column.
- The `configureAuth` factory is well-designed but Cultivar OS bypasses it partially — `src/lib/auth.ts` uses it correctly.
- STORAGE_KEY = `'IGNITION_OS_DATA'` is hardcoded in `packages/shared/src/quickbooks/oauth.ts` — OFF LIMITS until post-demo fix.

---

## 2. SETTINGS & CONFIGURATION

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Settings page / module | `AdminSubscription.jsx` doubles as settings + marketplace | ✅ `Settings.tsx` — NurserySection, AccountingSection, SalesPromptsSection, TeamSection. Permission-gated (MANAGER redirected). | None | ✅ BUILT (2026-05-29 + 2026-06-02) |
| Business-level config | `DataBridge.save('shop_info', {...})` — name, phone, address, USDOT | `businesses` table row, resolved via `BusinessProvider` (auth.uid() → owner or member lookup) | `BusinessProvider` in shared context | ✅ BUILT (2026-05-29) |
| Tax rate config | Not visible (auto-calculated) | `VITE_TAX_RATE=0.0825` in env var — not UI-editable | None | BUILD NEW |
| Default pricing config | Margin rules in `DataBridge` (`shop_policy.prot_matrix`) | `install_price` per plant in seed data, no UI | `pricing/marginEngine.ts` | BUILD NEW |
| Module enable/disable | `AdminSubscription.jsx` — trial start button per module | `nursery_modules` table, `api/social/enable.ts` wizard | None | CONFIGURE |
| Integration management UI | `OnboardingWizard` MigratePath → QB connect button | QB OAuth via tile "Connect QuickBooks" link | `QuickBooksConnector.jsx` in shared | CONFIGURE |
| Role-based settings access | OWNER PIN required for admin screens | N/A — single owner | None | BUILD NEW |
| Multi-location toggle | `shop_info.is_multi_location` in DataBridge schema | Not built | None | BUILD NEW |

**Notes:**
- Cultivar OS needs a `/settings` page. Minimum for post-demo: default install price, tax rate UI, nursery name/contact.
- The `QuickBooksConnector.jsx` in shared is JSX (not TS) and needs to be evaluated for use in Cultivar.

---

## 3. NOTIFICATIONS & COMMUNICATIONS

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Email templates | `templates/ignition.ts` (exists) | Uses `cultivar.ts` templates via `useSubmitOrder.ts` | `templates/cultivar.ts` — 5 templates ✅ | CONFIGURE |
| Order confirmation | ❌ not wired | ✅ `order_confirmation` template sent on checkout | ✅ Template defined | CONFIGURE |
| SMS/Twilio | Referenced in `queue.ts` | Referenced but not confirmed active | `send.ts` + `queue.ts` — provider-agnostic | CONFIGURE |
| Email provider (Resend) | Referenced | Referenced but not confirmed active | `send.ts` — provider-agnostic | CONFIGURE |
| Notification queue | ❌ | `sendSilently()` used in `useSubmitOrder.ts` | `queue.ts` with `sendSilently` ✅ | CONFIGURE |
| Notification log | `notifications_log` table in shared types | Not wired to DB | `NotificationLog` type in `supabase/types.ts` | EXTRACT |
| Communication history per customer | ❌ | ❌ | None | BUILD NEW |
| Opt-in/opt-out tracking | ❌ | `emailOptIn`, `smsOptIn` in order flow | `templates/cultivar.ts` checks opt-in | BUILD NEW |
| Netting waiver reminder | ❌ | Template defined, not scheduled | ✅ `netting_waiver_reminder` SMS template | BUILD NEW |
| 30-day care tips | ❌ | Template defined, not scheduled | ✅ `care_tips_30d` email template | BUILD NEW |
| Seasonal offer | ❌ | Template defined, not scheduled | ✅ `seasonal_offer` template | BUILD NEW |
| Delivery scheduled | ❌ | Template defined, not wired | ✅ `delivery_scheduled` template | BUILD NEW |
| Campaign engine | ❌ | ❌ | `campaigns/index.ts` stub ✅ | BUILD NEW |

**Notes:**
- The shared notification system is the most complete infrastructure investment after the tile system. Five cultivar templates exist but only `order_confirmation` is actively sent.
- `NotificationLog` table type exists in shared but no migration has created it in Supabase yet.
- Twilio and Resend are referenced but confirmation of env vars / active wiring is needed.

---

## 4. CUSTOMER MANAGEMENT

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Customer record creation | `IgnitionCRM.jsx` — full form (name, phone, email, address, tier, contract#) | `CustomerCapture.tsx` — name, phone, email only at checkout | None | EXTRACT |
| Customer directory | `IgnitionCRM.jsx` — searchable grid with type (Personal/Contract) and tier | `customers` table — no UI browser | None | BUILD NEW |
| Customer tiers | STANDARD, FF (Friends & Family), FLEET | None | None | IGNORE for now |
| Purchase history | Vehicle → jobs mapping in DataBridge | `orders` + `order_items` tables — no UI | None | BUILD NEW |
| Follow-up queue | ❌ | `followup_engine` tile — available, not built | None | BUILD NEW |
| Communication history | ❌ | ❌ | None | BUILD NEW |
| Customer lookup at checkout | By name/phone in CRM | ✅ Email-based dedup in `api/orders/submit.ts` (lines 34-75) — existing customer updated, new row only created on no match (updated 2026-05-28) | None | ✅ DONE |
| Export | ❌ | ❌ | None | BUILD NEW |

**Notes:**
- **(updated 2026-05-28)** Customer dedup is confirmed working: `api/orders/submit.ts` performs email-based lookup before insert — existing customers are updated, new rows only created when no email match is found. The prior note ("Terry exists five times in the DB") was written May 23 before Session K verified dedup on May 27. The customer directory UI gap (no browser for Lauren to view/search customers) remains open.
- The `IgnitionCRM` pattern (directory view + onboarding form) maps cleanly to what Cultivar needs for Lauren to view customers.

---

## 5. ANALYTICS & REPORTING

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Dashboard metrics | `IgnitionHub.jsx` — full hub (not read) | `Dashboard.tsx` + `api/dashboard.ts` — revenue, orders, leakage count | `SavingsReport.jsx` (JSX) | EXTRACT |
| Revenue reporting | Exists via `transaction_history` in DataBridge | Total revenue from `orders` table | `SavingsReport.jsx` | CONFIGURE |
| Missed revenue / leakage | Margin leak in `OnboardingWizard` MarginPath | `leakage_flag` on orders, count badge on dashboard | `pricing/marginEngine.ts` | EXTRACT |
| Daily/weekly/monthly filter | ❌ confirmed | ❌ | None | BUILD NEW |
| Data export | `CSVImporter.jsx` (import only) | ❌ | None | BUILD NEW |
| AI savings report | `savings_report` task in AIEngine | ❌ | `AIEngine.ts` → `savings_report` → Claude Sonnet | CONFIGURE |
| Invoice audit | `IgnitionAudit.jsx` — photo upload → Claude vision → flags missing charges | ❌ | `AIEngine.ts` → `invoice_audit` task | IGNORE (auto vertical) |

**Notes:**
- `api/dashboard.ts` is the most business-critical reporting endpoint for the demo. It should be the template for all verticals' dashboard APIs.
- `SavingsReport.jsx` in shared is JSX, not TypeScript — evaluate for reuse or port to TS before using in Cultivar or Conduit OS.

---

## 6. ONBOARDING FLOW

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| New account setup wizard | ✅ `OnboardingWizard.jsx` — 5 steps: Welcome → ShopSetup → ChoosePath → PathExperience → TeamQR | Login/SignUp pages only — no wizard | None | EXTRACT |
| Trial clock initialization | ✅ In `OnboardingWizard.finalize()` — 14-day trial, writes to Supabase `shops` table | ❌ | `SubscriptionTier` type in `supabase/types.ts` | EXTRACT |
| "Magic moment" path selection | ✅ 3 paths: Margin leak / Live diagnosis / Data migration | ❌ | None | EXTRACT pattern |
| QR join flow | ✅ TEAM_QR step — QR code + `/?join=<shopId>` link, copy + SMS share | ❌ | `qr/generate.ts` | EXTRACT |
| Initial data seeding | ✅ Manual entry + QB pull + CSV import in MigratePath | Supabase seed SQL (manual) | None | IGNORE (vertical-specific) |
| Integration connection wizard | ✅ MigratePath QB connect flow | `SocialSetup.tsx` wizard for Blotato | None | EXTRACT |
| Multi-location setup | `shop_info.is_multi_location` field in DataBridge | ❌ | None | BUILD NEW |
| First-run data migration | QB pull / CSV drag-drop / manual entry | ❌ | `CSVImporter.jsx` in Ignition only | EXTRACT |

**Notes:**
- The `OnboardingWizard.jsx` is the best-designed piece of the Ignition OS codebase. The 3-path "magic moment" pattern (prove value in 30 min before asking for commitment) is the core TRACE acquisition mechanic and **must** be extracted to shared before Conduit OS is built.
- The TeamQR step is the Ignition growth mechanism — scan once, entire team is in. Applicable to any multi-user vertical.

---

## 7. BILLING & SUBSCRIPTION ENGINE

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Trial clock (14-day) | ✅ `OnboardingWizard.finalize()` sets `trial_started_at` / `trial_ends_at` | ❌ | `SubscriptionTier` type — `trial_started_at` field | EXTRACT |
| Trial expiry check | ✅ `DataBridge.checkTrialStatus(moduleId)` returns `{ isExpired }` | ❌ | None | EXTRACT |
| Data blur on expiry | ✅ `filter blur-md pointer-events-none opacity-30` wrapper in every module | ❌ | None | EXTRACT |
| Stripe base subscription | ❌ (localStorage-based, no actual billing) | ❌ | `stripe_customer_id`, `stripe_subscription_id` in `SubscriptionTier` type | BUILD NEW |
| Per-module billing add-ons | ✅ `AdminSubscription.jsx` — module list with "Start Free Trial" | ❌ | `GrowthGoal` type has category + status | BUILD NEW |
| Per-module trial (30-day) | ✅ `calculateDaysLeft()` — 30-day module trial distinct from platform trial | ❌ | None | EXTRACT |
| Tier gating on tiles | ✅ `DataBridge.checkTrialStatus('MODULE_ID')` in each module | Partial: `tier_required` field in modules table, `nurseryPlan` hardcoded to `'starter'` in `useModules.ts` | `AIEngine.ts` `TIER_TASKS` gating | CONFIGURE |
| Founding rate lock | ❌ | ❌ ($149/mo target, post-demo) | None | BUILD NEW |
| Subscription tiers | TRIAL, STARTER, PROFESSIONAL, PREMIER in DataBridge | TRIAL, starter (hardcoded string) | `SubscriptionTierName` type: TRIAL / STARTER / PROFESSIONAL / PREMIER | CONFIGURE |
| Umbrella fee config | `$299/mo` in `AdminSubscription.jsx` UI | ❌ | None | BUILD NEW |
| Enable → charge flow | ❌ (no Stripe) | ❌ | None | BUILD NEW |

**Notes:**
- The Ignition OS billing engine is entirely frontend localStorage — no Stripe, no server-side enforcement. The **types** in shared are forward-looking (stripe fields) but nothing is wired.
- `useModules.ts` line 100: `const nurseryPlan = 'starter'; // post-demo: fetch from subscription table` — this is the exact seam where Stripe gating plugs in.
- The data-blur pattern in Ignition is powerful UX — wrap any expired module's content in a blur div. Extract this pattern.

---

## 8. UI & NAVIGATION PATTERNS

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Tile system | ✅ Extracted from CAI — dark tabs (NOT tiles); conversion to shared tile standard is scheduled tech debt (see PLATFORM_STRATEGY.md Part 16) | ✅ Platform standard — `useModules.ts` + `TileGrid.tsx` + `Tile.tsx`, 3 states, count badge, all 10 handlers wired | ✅ `tiles/TileGrid.tsx` + `tiles/Tile.tsx` — canonical implementation | STANDARD ✅ |
| Mobile navigation | Bottom tab nav in Ignition Native (`.native.js` files) | ❌ (post-demo task) | None | BUILD NEW |
| Desktop layout | Dark sidebar + content area pattern | Green top navbar + content | None | IGNORE (theme-specific) |
| Form component library | `Input`, `ProgressBar`, `ResultCard` inline in OnboardingWizard | Inline in each page (no shared form components) | `Button.tsx`, `Card.tsx`, `Badge.tsx`, `LockedOverlay.tsx` | EXTRACT |
| Loading / error states | Inline per module | Inline per page | None | EXTRACT |
| Data blur (trial expiry) | ✅ `filter blur-md pointer-events-none opacity-30` wrapper | ❌ | None | EXTRACT |
| Progress bar / wizard shell | `ProgressBar` in OnboardingWizard | ❌ | None | EXTRACT |
| Color system | Dark: slate-950, indigo-500 accents | Light: #27500A forest green, #EAF3DE sage | None (theme per vertical) | IGNORE |
| QR display / print | ✅ `QRCodeSVG` in OnboardingWizard TEAM_QR | ❌ on-screen; print via shared `qr/print.ts` | `qr/generate.ts` + `qr/print.ts` ✅ | CONFIGURE |
| Notification badge on tile | ✅ amber count badge, top-left | ✅ amber count badge, top-left | ✅ `Tile.tsx` has `count` prop | CONFIGURE ✅ |

**Notes:**
- Cultivar OS has no shared form component library — every page inlines its own inputs. Before Conduit OS, extract at minimum: `Input`, `Select`, `Textarea`, `FormLabel`, `ErrorMessage`, `ProgressBar`.
- The `LockedOverlay.tsx` + data-blur pattern together form the "you're on trial" experience. These need to be consistent across all verticals.

---

## 9. INTEGRATION FRAMEWORK

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Integration registry | `ExternalBridge.js` — QB, CSV, Telematics, VIN OCR, Samsara/Geotab/Motive | No registry — direct API calls per endpoint | None | EXTRACT |
| OAuth connect/disconnect flow | ✅ `ExternalBridge.qbo.initiateOAuth()` — opens popup, polls for connected state | ✅ `api/qbo/auth-url.ts` + `callback.ts` + `status.ts` | `quickbooks/oauth.ts` (has `IGNITION_OS_DATA` hardcode — OFF LIMITS) | EXTRACT |
| Token refresh handling | ❌ | ✅ `packages/shared/src/quickbooks/refresh.ts` — proactive check, wired into `api/qbo/invoice/cultivar.ts`; sets `qb_needs_reconnect=true` if refresh token is dead (updated 2026-05-28) | `quickbooks/refresh.ts` ✅ | ✅ DONE |
| Integration health indicators | ❌ | QB status dot on tile (active/available) | None | BUILD NEW |
| Webhook handling | ❌ | ❌ | None | BUILD NEW |
| CSV import | ✅ `CSVImporter.jsx` + `ExternalBridge.csv.parse/map/import` | ❌ | None | EXTRACT |
| Telematics (Samsara/Geotab/Motive) | 🟡 Button exists in `AdminSubscription`, not wired | ❌ | None | IGNORE (auto vertical) |
| VIN OCR | 🟡 Button in `AdminSubscription`, `AIEngine.decodeVIN()` | ❌ | `AIEngine.ts` task: `vin_decode` | IGNORE (auto vertical) |
| Social media (Blotato) | ❌ | ✅ `api/social/publish.ts`, `api/social/generate-posts.ts` | None | CONNECTOR |
| QuickBooks | 🟡 In Ignition Onboarding only, incomplete | ✅ Full OAuth + invoice creation + customer lookup | `quickbooks/oauth.ts`, `invoice.ts`, `customer.ts` | CONFIGURE ✅ |

**Notes:**
- The `ExternalBridge.js` pattern (a single object with `.qbo`, `.csv`, `.telematics` namespaces) is the right architecture for an integration registry. Extract the **pattern** to shared, not the file — it's deeply Ignition-specific.
- **(updated 2026-05-28)** Token refresh is resolved: `packages/shared/src/quickbooks/refresh.ts` (`refreshQBToken()`) performs a proactive check at the start of every invoice call — refreshes if tokens are missing or within 10 minutes of expiry, writes new token + `qb_token_expires_at` back to the `nurseries` row, sets `qb_needs_reconnect=true` and returns `null` if the refresh token is dead. Prior note ("live production bug") was accurate as of May 23; confirmed fixed by Session K audit May 27.

---

## 10. DATA & MULTI-TENANCY

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Tenancy model | Single shop: `shop_id` in localStorage | Single nursery: `VITE_DEMO_NURSERY_ID` env var | `tenant_id` on all shared type definitions | EXTRACT |
| RLS pattern | ❌ (localStorage — no DB-enforced tenancy) | ✅ RLS on modules, nursery_modules, social_drafts, orders (orders SELECT policy added 2026-05-27 — updated 2026-05-28) | None | CONFIGURE |
| Audit logging | ❌ | ❌ | `NotificationLog`, `AIUsageLog` types defined | EXTRACT |
| Soft delete | ❌ | ❌ | None | BUILD NEW |
| Data export per tenant | ❌ | ❌ | None | BUILD NEW |
| Cross-tenant isolation | N/A (localStorage per device) | Partial: nursery_id where clause, loose RLS (any authenticated user can read nursery_modules) | `tenant_id` in types | EXTRACT |
| Schema migration discipline | N/A | ✅ Append-only migrations in `supabase/migrations/` | None | CONFIGURE ✅ |
| Concept alias learning | ✅ `concept_aliases` table in `IgnitionAudit.jsx` (cross-shop AI improvement) | ❌ | `AIUsageLog` type | IGNORE (auto vertical) |

**Notes:**
- Cultivar OS currently enforces tenancy by `business_id` in queries. The `authenticated_select_nursery_modules` policy allows ANY authenticated user to read ANY nursery's modules — intentionally loose (post-demo fix). Must be locked to `owner_id` join before going multi-tenant.
- ~~The `VITE_DEMO_NURSERY_ID` env var approach hard-wires a single nursery.~~ **(updated 2026-05-28 + 2026-06-02)** `BusinessProvider` resolves business via `auth.uid() → businesses.owner_id` (owner path) or `auth.uid() → business_members → businesses` (member path). `VITE_DEMO_NURSERY_ID` is still in Vercel env vars as a fallback reference but is no longer used in production code paths.
- **(updated 2026-05-28 — Area 10 reflects May 23 snapshot)** The orders table had no SELECT RLS policy from its creation (May 17) until May 27, when the missing policy was identified during a demo dry-run (dashboard "Today's Sales" showed 0 after a confirmed order). Policy was applied manually in the Supabase SQL editor; migration `20260527_orders_authenticated_select_policy.sql` committed for future projects. Full incident record in CLAUDE.md Tech Debt Log entry #7. This is the third occurrence of the same root cause (modules + nursery_modules fixed May 22; orders fixed May 27) — see Open Architecture Decision #11 in CLAUDE.md for systemic prevention options.

---

## 11. PMI — PREVENTIVE MAINTENANCE

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Asset service schedules | ✅ `IgnitionProt.jsx` (protection/warranty), `ToolChecklist.jsx` | ❌ | `AIEngine.ts` → `pmi_suggest` task | BUILD NEW |
| Overdue alerts | ✅ In `IgnitionProt.jsx` | ❌ | None | BUILD NEW |
| Service history log | ✅ Via `active_jobs` history | ❌ | None | EXTRACT |
| Bypass with reason | ✅ `SlideToComplete.jsx` gesture + reason capture | ❌ | None | EXTRACT |
| Barcode/QR per asset | ✅ `IgnitionVIN.jsx` — VIN scan/barcode per vehicle | ✅ Plants have QR codes | `qr/generate.ts` + `qr/print.ts` | CONFIGURE |
| AI-assisted schedule suggestion | ✅ `AIEngine.suggestPMI()` | ❌ | `AIEngine.ts` → `pmi_suggest` | CONFIGURE |
| Equipment PMI (cultivar-specific) | N/A | ❌ Needed: tractors, water filters, water lines, greenhouses, irrigation | None | BUILD NEW |
| Greenhouse climate PMI | N/A | ❌ | None | BUILD NEW |

**Notes:**
- PMI for Cultivar OS is a major gap-filler. A nursery's entire physical operation (irrigation, filters, sprayers, tractors) needs service schedules. No external tool does this for nurseries.
- The PMI model maps directly to the abstract asset model (Area 12). Build the asset model first, attach PMI schedules as a property of any asset.
- `AIEngine.suggestPMI()` already exists — it takes `toolData` and returns a suggested schedule. Cultivar would pass `equipmentData` instead.

---

## 12. ASSET MANAGEMENT

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Abstract asset model | Vehicles (`IgnitionVIN.jsx`) + Parts inventory (`IgnitionStok.jsx`) | Plants (`plants` table + `plant_events`) | None | EXTRACT |
| QR tag per asset | ✅ VIN scan / barcode per vehicle | ✅ QR per plant (`/plant/:sku`) | `qr/generate.ts` + `qr/print.ts` | CONFIGURE ✅ |
| Service history per asset | ✅ Job history per vehicle | ✅ `plant_events` table (timeline) | None | EXTRACT |
| Cost tracking per asset | ✅ Estimate total per job per vehicle | ❌ Plant cost not tracked post-purchase | None | BUILD NEW |
| Asset categorization | Vehicles (make/model/year/VIN) | Plants (species/container/SKU) | None | EXTRACT abstraction |
| Physical location tracking | ❌ | ❌ (no field or greenhouse location on plants) | None | BUILD NEW |
| Condition rating | ❌ | ❌ | None | BUILD NEW |
| AI photo identification | 🟡 `part_photo_id` in AIEngine | ❌ | `AIEngine.ts` → `part_photo_id` | CONFIGURE |

**Notes:**
- The abstract asset model is one of the most valuable extractions. Both verticals have: (QR tag → asset record → event history). The shape is identical; only the fields differ.
- Abstract model: `{ id, tenant_id, sku, category, qr_url, created_at }` + `asset_events: { asset_id, event_type, notes, actor_id, created_at }`.
- Cultivar needs `location` (greenhouse #, bed row, field section) on plant records. This is a pure gap-filler — no nursery software tracks this.

---

## 13. ROUTING & DELIVERY

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Delivery option at checkout | N/A (service shop, not delivery) | ✅ `TransportToggle.tsx` — self/delivery/install | None | IGNORE |
| Delivery radius config | ❌ | ❌ (Lauren question pending) | None | BUILD NEW |
| Route optimization | ❌ | ❌ | None | CONNECTOR (Google Maps) |
| Driver/staff assignment | ❌ | ❌ | None | BUILD NEW |
| Delivery scheduling | ❌ | `delivery_scheduled` template exists, no UI | None | BUILD NEW |
| GPS tracking | ❌ | ❌ | None | CONNECTOR (Google Maps) |
| Delivery confirmation | ❌ | ❌ | None | BUILD NEW |
| Delivery fee calculation | N/A | ❌ (delivery is free / TBD by nursery) | None | BUILD NEW |
| Installation scheduling | N/A | 🟡 `transport='install'` in checkout, price captured, no scheduling | None | BUILD NEW |

**Notes:**
- Delivery is a full tile module in Cultivar OS (`delivery_routing` in `MODULE_META`) but nothing is built yet.
- Before building: answer Lauren's open questions on delivery radius, fee structure, and whether LAWNS uses staff or contractors.
- Installation service is partially built (price captured, QB line item created) but scheduling is missing.

---

## 14. CONNECTOR INVENTORY

| Connector | Ignition OS | Cultivar OS | Status | Priority |
|---|---|---|---|---|
| **QuickBooks Online** | 🟡 In OnboardingWizard Migrate path (ExternalBridge stub) | ✅ Full OAuth, invoice creation, customer creation, status check | Active ✅ | DONE |
| **Blotato (Social)** | ❌ | ✅ `api/social/publish.ts` — Instagram/Facebook/TikTok/Twitter | Active ✅ | DONE |
| **Anthropic / Claude** | 🟡 `AIEngine.ts` routing — wired, backend ready, no live calls yet | ✅ `api/social/generate-posts.ts` — Claude Sonnet 4.6 with prompt caching | Active ✅ | DONE |
| **Supabase** | 🟡 Referenced in `OnboardingWizard.finalize()` for `shops` upsert | ✅ Full Supabase-first architecture | Active ✅ | DONE |
| **Resend (Email)** | 🟡 Referenced in `notifications/send.ts` | 🟡 Referenced, `order_confirmation` may be sending | Needs verification 🟡 | HIGH |
| **Twilio (SMS)** | 🟡 Referenced in `notifications/send.ts` | 🟡 Referenced, `netting_waiver_reminder` not wired | Needs verification 🟡 | MEDIUM |
| **Stripe (Billing)** | ❌ (DataBridge localStorage only, no actual billing) | ❌ | Not started ❌ | POST-DEMO |
| **Google Maps (Delivery)** | ❌ | ❌ | Not started ❌ | POST-DEMO |
| **Gemini (Vision AI)** | 🟡 `AIEngine.ts` routes `vin_decode`, `invoice_scan` to Gemini 2.0 Flash | ❌ | Routed, not used ❌ | IGNORE for Cultivar |
| **OpenAI / Whisper (Voice)** | 🟡 `AIEngine.ts` routes `voice_transcribe`, `parts_nlp` | ❌ | Routed, not used ❌ | IGNORE for Cultivar |
| **Samsara / Geotab / Motive (Telematics)** | 🟡 Button in AdminSubscription, not wired | ❌ | Not started ❌ | IGNORE (auto vertical) |
| **Google Calendar** | ❌ | ❌ | Not started ❌ | POST-DEMO (delivery scheduling) |

**Connectors needed that no vertical has yet:**
- **Stripe** — billing, subscriptions, per-module charges
- **Google Maps** — delivery radius, route optimization, ETA
- **Google Calendar** — delivery/install appointment scheduling
- **Mailchimp / Klaviyo** — seasonal campaign automation (Cultivar nurture sequences)

---

## 15. MODULE BILLING REGISTRY

| Module | Ignition OS ID | Cultivar OS Key | Tier | Action |
|---|---|---|---|---|
| Core platform | CORE (always active) | `qr_checkout` (always active) | Free / Base | CONFIGURE |
| QuickBooks invoicing | HUB (hub module) | `qb_invoicing` | Free / Base | CONFIGURE |
| Social media / marketing | ❌ | `social_media` | Starter add-on | BUILD NEW |
| Online shop | ❌ | `online_shop` | Starter add-on | BUILD NEW |
| Customer follow-up | ❌ | `followup_engine` | Starter add-on | BUILD NEW |
| Delivery routing | ❌ | ✅ `delivery_routing` — `DeliveryRoute.tsx` at `/deliveries`. Multi-stop Google Maps URL, SMS-to-driver, per-stop checkbox. | None | ✅ BUILT (2026-05-29) |
| Contractor management | FLEET tier | `contractor_tiers` | Growth | BUILD NEW |
| Seasonal / perishable | ❌ | `seasonal_module` | Growth | BUILD NEW |
| Business insights | PREDICTIVE module | `business_insights` | Growth | BUILD NEW |
| Inventory intake | ❌ | `inventory_intake` | Growth | BUILD NEW |
| Estimator (auto) | ESTIMATOR module | N/A | Professional | IGNORE |
| AI invoice audit | AUDIT module (IgnitionAudit) | N/A | Professional | IGNORE |
| Procurement | PROC module | N/A | Premier | IGNORE |
| Inventory (stock) | STOK module | N/A | Starter | IGNORE |
| PMI / maintenance | PROT module | Equipment PMI (cultivar) | Growth | BUILD NEW |

**Billing engine requirements:**
- Trial: 14 days, all modules unlocked, data blur after expiry
- Per-module trial: 30-day, shows "X days remaining" badge
- Enable module → Stripe subscription item (metered or flat)
- Disable module → cancel subscription item at period end
- Founding rate lock: $149/mo forever, stored as `monthly_amount` in `SubscriptionTier`
- `useModules.ts` is the right place to gate by tier — the `nurseryPlan` const at line 100 is the exact seam for Stripe integration

---

## 16. AIENGINE — SHARED AI ROUTER

**File:** `packages/shared/src/ai/AIEngine.ts`  
**Status:** ✅ Built and ready — TypeScript port of `CAI/AIEngine.js` (archive)  
**Backend:** `CAI/ai_router.py` — **LEGACY.** Was Railway FastAPI for mobile build. Web build uses Vercel serverless functions. Port endpoints before activating AI features. See Tech Debt #12 in CLAUDE.md.  
**Cultivar OS use:** Not wired yet — social post generation uses Claude directly in `api/social/generate-posts.ts`  
**Import path for any vertical:** `import AIEngine from '@trace/shared/ai/AIEngine'`

### What it does

AIEngine is the single unified interface through which any TRACE vertical calls AI. Rather than each module importing a provider SDK directly, every AI call goes through AIEngine by task name. AIEngine routes to the correct provider, enforces tier gating, and returns a typed `AIResult`. Provider SDK details are invisible to callers.

### Task registry (13 tasks)

| Task key | Provider | Model | What it does |
|---|---|---|---|
| `vin_decode` | Gemini | gemini-2.0-flash | Photo of VIN plate → decoded vehicle info |
| `invoice_scan` | Gemini | gemini-2.0-flash | Photo of shop invoice → structured line items |
| `label_read` | Gemini | gemini-2.0-flash | Photo of tool/fluid label → part name + spec |
| `part_photo_id` | Gemini | gemini-2.0-flash | Photo of part → identification + compatibility |
| `invoice_audit` | Claude | claude-sonnet-4-6 | Invoice photo → flags missing charges (fluids, consumables, disposal) |
| `dtc_decode` | Claude | claude-sonnet-4-6 | DTC code(s) → plain-language diagnosis + next steps |
| `estimate_draft` | Claude | claude-sonnet-4-6 | Job description → draft line-item estimate |
| `compliance_check` | Claude | claude-sonnet-4-6 | Document → DOT/regulatory flag summary |
| `customer_summary` | Claude | claude-sonnet-4-6 | Customer history array → brief relationship summary |
| `pmi_suggest` | Claude | claude-sonnet-4-6 | Tool/equipment data → suggested maintenance schedule |
| `predictive_analysis` | Claude | claude-sonnet-4-6 | Job history → pattern summary + risk flags |
| `savings_report` | Claude | claude-sonnet-4-6 | Shop job history → total jobs, flagged, recoverable margin, top leaks |
| `voice_transcribe` | OpenAI | whisper-1 | Audio blob → transcript |
| `parts_nlp` | OpenAI | gpt-4o | Free-text parts description → structured part list |
| `intent_classify` | OpenAI | gpt-4o | Customer message → intent category |

### Tier gating

```
TRIAL       → all 13 tasks unlocked
STARTER     → [] (no AI tasks — STARTER is the no-AI tier)
PROFESSIONAL→ 12 tasks (all except intent_classify)
PREMIER     → all 13 tasks unlocked
```

`AIEngine.canUse(task, tier)` — returns `boolean`. Call before running any task to enforce tier gate in the UI.

### Convenience wrappers

`decodeVIN(payload)` · `decodeDTC(payload)` · `transcribeVoice(payload)` · `extractParts(payload)` · `readToolLabel(payload)` · `suggestPMI(payload)` · `auditInvoice(payload)` · `draftEstimate(payload)` · `savingsReport(payload)`

Each wrapper calls the underlying task and returns `AIResult`. No provider knowledge required by the caller.

### Haiku fallback

If a Claude Sonnet call fails and `options.fallback = true`, AIEngine retries with `claude-haiku-4-5-20251001` before giving up. This is opt-in per call.

### Backend dependency

**AIEngine fails gracefully** — `catch` block returns `{ ok: false, error: message }` and logs to console. Never throws. App continues working; AI features show error states.

**For web builds (current):** Do NOT set `VITE_API_URL`. AI features return `ok: false` silently. Activate by porting `ai_router.py` endpoints to Vercel serverless functions under `packages/ignition-os/api/`. See Tech Debt #12 in CLAUDE.md.

The backend (when active) logs every call to `ai_usage` (cost tracked in `cost_usd`) and errors to `error_events` (non-fatal). Cost visibility exists from day one.

### What's missing before Ignition OS AI features go live

1. Port `ai_router.py` endpoints to TypeScript Vercel functions — `dtc_decode` and `estimate_draft` first (text-only)
2. `SavingsReport.jsx` — React display component for `savings_report` task output — still missing (API task is complete; display work only)

Steps 1 and 2 in CLAUDE.md "What's missing" (items 2 and 3) are now complete: import paths fixed, `../AIEngine` → `@trace/shared/ai/AIEngine` in all 3 modules.

### Cultivar OS path when AI is needed

Call Claude / Gemini directly from Vercel serverless functions — the pattern already used in `api/social/generate-posts.ts`. Do not route through `ai_router.py`.

---

## UI Surface State — Cultivar OS (May 25 snapshot)

**Source:** Static code analysis conducted 2026-05-25 — every handler traced to execution against the Cultivar OS codebase as deployed to `cultivar-os.vercel.app` at the time of audit. **Original file:** Preserved at `docs/audits/2026-05-25_BUTTON_AUDIT_DEMO.md` (relocated 2026-05-26 during Session 1b doc reconciliation). **Scope:** All interactive elements across the QR checkout flow, dashboard, and social setup pages.

**6-state classification used in this section:**

| State | Meaning |
|---|---|
| **WORKS** | The action does what its label implies — fully wired end to end |
| **PARTIAL** | Executes but with a known gap (e.g., updates local state but not the database) |
| **STUB** | Renders and accepts interaction but the handler is an empty function — no visible effect |
| **BROKEN** | Handler exists and is non-empty but produces an error or incorrect result |
| **DISABLED** | Intentionally non-interactive (e.g., locked tier tile with `onClick={undefined}`) |
| **HIDDEN** | Does not render under current conditions — conditionally suppressed |

No BROKEN instances were found at the time of this audit.

---

### 1. Fast-Lookup Table

| Page | Button / Element | State | Notes at time of audit |
|---|---|---|---|
| `/plant/SCV-0031` | Add to cart — $X | **WORKS** | Click freely |
| `/plant/SCV-0031` | QtySelector +/− | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | ← Back | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | Transport toggle (Self/Delivery/Install) | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | I understand the risk — no thanks (netting) | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | Actually, add netting back | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | Addon card checkboxes | **WORKS** | Click freely |
| `/plant/SCV-0031/addons` | Review my cart — $X | **WORKS** | Click freely |
| `/checkout/customer` | ← Back | **WORKS** | Click freely |
| `/checkout/customer` | Review my order (submit form) | **WORKS** | Click freely |
| `/checkout/review` | ← Back | **WORKS** | Click freely |
| `/checkout/review` | Edit (customer info) | **WORKS** | Click freely |
| `/checkout/review` | Send invoice + pay online — $X | **WORKS** | Click freely |
| `/checkout/review` | I'll pay at the office | **WORKS** | Click freely |
| `/checkout/confirm` | View invoice in QuickBooks | **WORKS** | Conditional on QB connected at order time |
| `/checkout/confirm` | View QuickBooks sandbox preview → | **WORKS** | Safe fallback — always present |
| `/checkout/confirm` | Scan another plant | **WORKS** | Click freely |
| `/dashboard` | Sign out | **WORKS** | Ends session — explain rather than click during demos |
| `/dashboard` | Connect QuickBooks (banner) | **WORKS** | Safe to demo live if QB is disconnected |
| `/dashboard` | Disconnect (QB banner) | **PARTIAL** | Local state only — token stays live in DB |
| `/dashboard` | Refresh data | **WORKS** | Click freely |
| `/dashboard` | Publish (social draft card) | **WORKS** | Click freely if drafts exist |
| `/dashboard` | QR Checkout tile (tap) | **STUB** | Does nothing — handler is empty stub |
| `/dashboard` | QuickBooks tile (tap) | **STUB** | Does nothing — QB managed via banner above |
| `/dashboard` | Social Media tile (tap, when active) | **STUB** | Does nothing — drafts appear below tile grid |
| `/dashboard` | Social Media tile "Enable" (when not yet set up) | **WORKS** | Routes to setup wizard |
| `/dashboard` | Online Shop tile "Enable" | **STUB** | Does nothing — next roadmap item |
| `/dashboard` | Follow-Up tile "Enable" | **STUB** | Does nothing |
| `/dashboard` | Delivery tile "Enable" | **STUB** | Does nothing |
| `/dashboard` | Contractors / Seasonal / Insights / Inventory tiles | **DISABLED** | Locked — no click handler |
| `/social/setup` | ← Back | **WORKS** | Click freely |
| `/social/setup` | Platform checkboxes | **WORKS** | Click freely |
| `/social/setup` | Enable Social Media (save) | **WORKS** | Click freely |

---

### 2. Surface State Narrative

**What works**

The entire QR-to-confirmation checkout flow is solid. Every button from scanning SCV-0031 through submitting an order is real and tested — Add to Cart, transport toggle, netting prompt, add-on cards, customer form, cart review, submit. Both payment paths (online invoice, pay at office) work. The QB invoice creation is non-blocking: if it succeeds, the confirmation screen shows a real "View invoice in QuickBooks" link; if it fails (token issue, network), the order still completes and a sandbox preview link appears as fallback. "Scan another plant" clears the cart and returns to the dashboard. The dashboard metrics (plants tracked, inventory value, today's sales, installs this week, leakage) all load from Supabase. Sign-out works. Connect QuickBooks (the banner at the top of the dashboard) runs a full OAuth popup and polls until connected. The social drafts panel and Publish button work when drafts exist.

**What doesn't work**

The tile grid is decorative when tiles are active. Tapping an active QR Checkout tile, QuickBooks tile, or Social Media tile does literally nothing — the `handleNavigate` handler is an empty function stub. This is intentional (post-demo work) but confusing if a customer taps it expecting something to happen. The same applies to "Enable" buttons on tiles other than Social Media — clicking "Enable" on Online Shop, Follow-Up, or Delivery calls a handler that does nothing (only 'social_media' is wired). The "Disconnect" button on the QB banner only resets local state — it does not revoke the token in Supabase, so if someone clicks it by accident, reconnecting immediately still works. The Publish flow calls Blotato's API — if Blotato is down or the account ID is wrong, the button will try, return an error in the console, and the draft will stay in the panel (no visible error shown to the user).

**Suggested language when a gap is encountered**

- **Someone taps an active tile and nothing happens:** "These are your active modules — QR Checkout, QuickBooks, Social. We'll be adding deep-links into each module's history and settings view in the next sprint. For now, QR Checkout is running through the scan flow you just saw, and social drafts appear right below the tile grid."
- **QB isn't connected:** "Let me show you the one-time setup — this takes about 30 seconds and then every order auto-creates an invoice." Then click Connect QuickBooks in the banner. If the popup gets blocked, the redirect falls back to the same tab automatically.
- **Order submits but no QB invoice URL appears on the confirmation screen:** "The invoice is queued — QuickBooks processes it within a few seconds. You can use this sandbox preview to see the format." Click "View QuickBooks sandbox preview →".
- **Social posts don't appear in the drafts panel after an order:** "The AI post generation can take a few seconds — let me hit Refresh data." If still nothing: "The social module is enabled and connected. Posts will appear here as we process that order. Let me show you an existing draft."

---

### 3. Detailed Button Inventory

#### PLANT PROFILE — `/plant/:tagId`

**"Add to cart — $X"**
- File: [PlantProfile.tsx:78](packages/cultivar-os/src/pages/PlantProfile.tsx#L78)
- Handler: `handleAddToCart()` → `setItem(plant, qty)` → `navigate('/plant/${tagId}/addons')`
- Only renders when `plant.status === 'available'`. If plant is reserved/sold, renders a grey "This plant is [status]" block with no button.
- State: **WORKS**

**QtySelector +/− buttons**
- File: [QtySelector.tsx](packages/cultivar-os/src/components/checkout/QtySelector.tsx)
- Handler: `onChange(qty + 1)` / `onChange(qty - 1)`, clamped to [1, max]
- State: **WORKS**

---

#### ADD-ONS — `/plant/:tagId/addons`

**"← Back"**
- File: [AddOns.tsx:72](packages/cultivar-os/src/pages/AddOns.tsx#L72)
- Handler: `navigate('/plant/${tagId}')`
- State: **WORKS**

**Transport toggle (Self-transport / Delivery / Installation)**
- File: [TransportToggle.tsx](packages/cultivar-os/src/components/checkout/TransportToggle.tsx), wired via `setTransport` from useCart
- Handler: updates `transport` in cart Zustand store
- State: **WORKS**
- Note: Changing transport shows/hides netting prompt and changes price.

**"I understand the risk — no thanks" (netting decline)**
- File: [NettingPrompt.tsx:65](packages/cultivar-os/src/components/checkout/NettingPrompt.tsx#L65)
- Handler: `handleNettingToggle()` → toggles `nettingDeclined` in cart, updates netting addon
- State: **WORKS**

**"Actually, add netting back"**
- File: [NettingPrompt.tsx:110](packages/cultivar-os/src/components/checkout/NettingPrompt.tsx#L110)
- Handler: same toggle, flips back
- State: **WORKS**

**Addon card checkboxes (e.g., Native compost blend)**
- File: [AddonCard.tsx](packages/cultivar-os/src/components/checkout/AddonCard.tsx), wired via `toggleAddon(id)`
- Handler: flips `selected` boolean in cart addons array
- State: **WORKS**
- Note: Add-ons load from Supabase; if DB is empty, section doesn't render.

**"Review my cart — $X"**
- File: [AddOns.tsx:177](packages/cultivar-os/src/pages/AddOns.tsx#L177)
- Handler: `navigate('/checkout/customer')`
- State: **WORKS**

---

#### CUSTOMER CAPTURE — `/checkout/customer`

**"← Back"**
- File: [CustomerCapture.tsx:109](packages/cultivar-os/src/pages/CustomerCapture.tsx#L109)
- Handler: `navigate('/plant/${tagId}/addons')`
- State: **WORKS**

**"Review my order" (form submit)**
- File: [CustomerCapture.tsx:257](packages/cultivar-os/src/pages/CustomerCapture.tsx#L257)
- Handler: validates required fields (first name, last name, valid email format) → `setCustomer()` → `navigate('/checkout/review')`
- State: **WORKS**
- Note: Shows red borders on invalid fields. Phone and address are optional.

---

#### CART REVIEW — `/checkout/review`

**"← Back"**
- File: [CartReview.tsx:78](packages/cultivar-os/src/pages/CartReview.tsx#L78)
- Handler: `navigate('/checkout/customer')`
- State: **WORKS**

**"Edit" (customer section)**
- File: [CartReview.tsx:181](packages/cultivar-os/src/pages/CartReview.tsx#L181)
- Handler: `navigate('/checkout/customer')`
- State: **WORKS**

**"Send invoice + pay online — $X"**
- File: [CartReview.tsx:210](packages/cultivar-os/src/pages/CartReview.tsx#L210)
- Handler: `handleSubmit(true)` → `submit()` hook → POST `/api/orders/submit` → on success, `navigate('/checkout/confirm', { state: {...} })`
- Disabled during submission. Shows "Sending…"
- State: **WORKS**
- Note: If submit fails (network, Supabase down), `submitError` renders in a red box above the buttons. Order does not complete on error.

**"I'll pay at the office"**
- File: [CartReview.tsx:218](packages/cultivar-os/src/pages/CartReview.tsx#L218)
- Handler: `handleSubmit(false)` — same flow, different `payOnline` flag passed to confirmation
- Disabled during submission. Shows "Creating order…"
- State: **WORKS**

---

#### CONFIRMATION — `/checkout/confirm`

**"View invoice in QuickBooks" (link)**
- File: [Confirmation.tsx:167](packages/cultivar-os/src/pages/Confirmation.tsx#L167)
- Renders ONLY when `payOnline === true && qbInvoiceUrl` is truthy (QB was connected AND invoice creation returned a URL)
- Handler: `<a href={qbInvoiceUrl} target="_blank">` — opens QB invoice directly
- State: **WORKS** (conditional on QB being connected at time of order)

**"View QuickBooks sandbox preview →" (link)**
- File: [Confirmation.tsx:186](packages/cultivar-os/src/pages/Confirmation.tsx#L186)
- Always renders. Routes to `/demo/quickbooks-invoice?orderId=...&total=...&invoiceNumber=...`
- State: **WORKS**

**"Scan another plant"**
- File: [Confirmation.tsx:193](packages/cultivar-os/src/pages/Confirmation.tsx#L193)
- Handler: `handleDone()` → `clear()` (clears all cart state) → `navigate('/', { replace: true })` → redirects to `/dashboard`
- State: **WORKS**

---

#### DASHBOARD — `/dashboard`

**"Sign out" (header)**
- File: [Dashboard.tsx:332](packages/cultivar-os/src/pages/Dashboard.tsx#L332)
- Handler: `handleSignOut()` → `auth.signOut()` → `navigate('/login')`
- State: **WORKS**

**"Connect QuickBooks" (QB banner, when not connected)**
- File: [Dashboard.tsx:361](packages/cultivar-os/src/pages/Dashboard.tsx#L361)
- Handler: `handleConnect()` — opens a blank popup via `window.open()` synchronously (before any await, preserving the user-gesture chain), fetches `/api/qbo/auth-url`, navigates popup to Intuit OAuth, polls `/api/qbo/status` every 2 seconds until connected or popup closes
- Disabled during connection. Shows "Opening QuickBooks…"
- State: **WORKS**
- Note: Popup may be blocked by browser. If blocked, `popup.location.href = url` fails silently; code falls back to `window.location.href = url` (same-tab redirect). Errors from `/api/qbo/auth-url` are shown on-screen with `[step:X]` prefix.

**"Disconnect" (QB banner, when connected)**
- File: [Dashboard.tsx:396](packages/cultivar-os/src/pages/Dashboard.tsx#L396)
- Handler: `onClick={() => { setQbConnected(false); setQbCompany(''); }}`
- What this actually does: resets local state only. Does NOT revoke the token in Supabase or set `qb_needs_reconnect=true`. If clicked, the UI shows the "Connect QuickBooks" banner again, but the token is still valid in the database.
- State: **PARTIAL**

**QB reconnect warning banner**
- File: [Dashboard.tsx:502](packages/cultivar-os/src/pages/Dashboard.tsx#L502)
- Only renders when `qb_needs_reconnect === true` (read from Supabase `nurseries.qb_needs_reconnect`). Not interactive — informational banner only.
- State: **HIDDEN** (won't appear unless token has genuinely expired during refresh)

**Metric cards (Plants tracked, Inventory value, Today's sales, Installs this week)**
- Display only. No interactive elements. Data loads from Supabase on mount via `loadMetrics()`.

**Leakage alert tile**
- File: [Dashboard.tsx:453](packages/cultivar-os/src/pages/Dashboard.tsx#L453)
- Only renders when `leakageCount > 0`. No buttons — informational.
- State: **HIDDEN** if no leakage orders this week.

**Tile grid — active tiles (QR Checkout, QuickBooks, Social Media when enabled)**
- File: [Tile.tsx:36](packages/shared/src/components/tiles/Tile.tsx#L36), [Dashboard.tsx:289](packages/cultivar-os/src/pages/Dashboard.tsx#L289)
- Handler chain: `handleClick()` → `onNavigate()` → `handleNavigate(key)` → empty stub (`// post-demo: route to module-specific pages`)
- State: **STUB**
- Note: Tapping an active tile does nothing visible. No error, no navigation.

**Tile grid — "Enable" button on Social Media tile (when not yet set up)**
- File: [Tile.tsx:149](packages/shared/src/components/tiles/Tile.tsx#L149), [Dashboard.tsx:283](packages/cultivar-os/src/pages/Dashboard.tsx#L283)
- Handler: `onEnable()` → `handleEnable('social_media')` → `navigate('/social/setup')`
- State: **WORKS**

**Tile grid — "Enable" button on Online Shop, Follow-Up, Delivery tiles**
- File: [Dashboard.tsx:283](packages/cultivar-os/src/pages/Dashboard.tsx#L283)
- Handler: `onEnable()` → `handleEnable(key)` → falls into the `if (key === 'social_media')` branch → no match → function returns without doing anything
- State: **STUB**

**Tile grid — locked tiles (Contractors, Seasonal, Insights, Inventory)**
- File: [Tile.tsx:44](packages/shared/src/components/tiles/Tile.tsx#L44)
- These tiles have `isLocked = true`. The wrapping div has `onClick={undefined}`. No handler fires.
- State: **DISABLED**

**"Publish" button (social draft cards)**
- File: [Dashboard.tsx:589](packages/cultivar-os/src/pages/Dashboard.tsx#L589)
- Handler: `handlePublish(draftId)` → POST `/api/social/publish` → on success, removes draft from array → badge decrements
- Disabled during submission ("Posting…"). Whole drafts panel only renders when `socialDrafts.length > 0`.
- State: **WORKS** (subject to Blotato API availability)
- Note: If Blotato returns an error, `console.warn` fires and the draft stays in the panel. No visible error shown to user.

**"Refresh data"**
- File: [Dashboard.tsx:613](packages/cultivar-os/src/pages/Dashboard.tsx#L613)
- Handler: `loadMetrics()` — re-fetches all metric queries from Supabase. Does NOT reload social drafts.
- State: **WORKS**
- Note: Social drafts panel does not refresh on this button — requires page reload to pick up new drafts.

---

#### SOCIAL SETUP — `/social/setup`

**"← Back"**
- File: [SocialSetup.tsx:75](packages/cultivar-os/src/pages/SocialSetup.tsx#L75)
- Handler: `navigate('/dashboard')`
- State: **WORKS**

**Platform checkboxes (Instagram, Facebook, TikTok, Twitter/X)**
- Handler: `togglePlatform(key)` — toggles entries in `platforms` Set state
- State: **WORKS**
- Note: At least one platform required to save.

**Blotato Account ID input**
- Handler: `setAccountId(value)` on change
- State: **WORKS**
- Note: Wrong account ID will cause Publish to fail silently later.

**"Enable Social Media" (save button)**
- File: [SocialSetup.tsx:176](packages/cultivar-os/src/pages/SocialSetup.tsx#L176)
- Handler: `handleSave()` → validates (≥1 platform, non-empty account ID) → POST `/api/social/enable` → on success, `navigate('/dashboard')`
- Disabled during save ("Saving…")
- State: **WORKS**

---

### 4. Cross-Cutting Findings

**The critical tile behavior nobody will expect**

Active tiles look tappable (they have a green status dot, full color, box shadow). They are not. The `handleNavigate` handler in Dashboard.tsx is an explicit stub marked "post-demo." This affects: QR Checkout, QuickBooks, and Social Media (when active). Brief any prospect before they see the dashboard that tiles are status indicators, not navigation buttons — actual workflows run through the scan flow and the dashboard panels below the grid.

**"Enable" vs. status indicator — what "enable" means on each tile**

The word "Enable" appears below every tile in the `available` state. It is a call to action (click to set up this module), not a status indicator. After a module is enabled and configured, the tile transitions to `active` state and the "Enable" button disappears (replaced by the green dot). At the time of this audit, only Social Media's "Enable" is wired. The others render the button but clicking does nothing.

**Env vars and their failure modes**

All API routes are serverless functions deployed to Vercel. Missing env vars fail silently (return error JSON, never throw to browser):
- `ANTHROPIC_API_KEY` missing → generate-posts returns `{ok:false}`, no social drafts created, order still completes
- `BLOTATO_API_KEY` missing → publish.ts updates draft status to 'failed', no visible user error
- `QBO_CLIENT_ID/SECRET/REDIRECT_URI` missing → auth-url.ts returns 500, QB connect shows error on-screen with step prefix
- `SUPABASE_SERVICE_KEY` missing → all order writes fail, full error shown on CartReview

**Root `/api` files are re-export wrappers**

The `/api/` directory at repo root (Vercel functions) are all one-liners that re-export from `packages/cultivar-os/api/`. The actual logic is in the package. This is intentional for the monorepo build.

**Social drafts panel doesn't refresh on "Refresh data"**

The "Refresh data" button calls `loadMetrics()` only — it does NOT reload `loadSocialDrafts()`. If you submit an order and then click "Refresh data," the social drafts panel won't update. A page reload is required to see new drafts.

**QB "Disconnect" creates a confusing state**

If anyone clicks "Disconnect" on the QB banner: UI shows "not connected," but the token is still valid in Supabase. Clicking "Connect QuickBooks" immediately re-completes the OAuth flow and returns to connected state. The only risk is if someone disconnects and then navigates away thinking QB is broken.

---

### 5. Pre-Demo Verification Checklist

**1. Confirm plant SCV-0031 is available and loads correctly**
Navigate to `cultivar-os.vercel.app/plant/SCV-0031`. Verify: plant name, container size, base price, timeline events, and "Add to cart" button all render. If plant status is not 'available', the Add to Cart button won't appear — update the status in Supabase.

**2. Run one complete order from SCV-0031 start to finish**
Scan/navigate to the plant, add 1 tree, self-transport, keep netting on, use any real email (it'll receive a confirmation). Submit as "I'll pay at the office." Verify the confirmation screen appears with an invoice number. Check that the order appears in Supabase `orders` table.

**3. Confirm QB is connected (or pre-connect it)**
Log in as `david_obrien2016@outlook.com`. Load the dashboard. If the QB banner shows "Connect QuickBooks," connect it before the demo. Verify the banner flips to "QuickBooks connected." The token is good for 60+ minutes; the proactive refresh will extend it automatically.

**4. Check whether social_drafts migration has been applied**
In Supabase SQL editor on project `bgobkjcopcxusjsetfob`, run:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'social_drafts' AND column_name IN ('order_id', 'post_type');
```
If you get 0 rows, the migration from BLOCKER #1 in CLAUDE.md has not been applied and post-order social generation will fail silently.

**5. Verify the dashboard metrics show real data**
After running the test order in check #2, reload the dashboard. Confirm "Today's sales" increments. The nursery ID is hardcoded as `DEMO_NURSERY_ID = a1b2c3d4-0000-0000-0000-000000000001` in constants.ts — verify it matches the actual LAWNS nursery row in Supabase.

---

**Technical debt note:** The STUB and PARTIAL states documented in this section are technical debt under the Surface Honesty principle (see PLATFORM_STRATEGY.md Design Principles). Per that principle, every UI element must be WORKS, LABELED, or HIDDEN — the fourth state (looks active, clicks, does nothing) is explicitly forbidden. The STUB states catalogued above represent the backlog to be cleared before any subsequent prospect demo of Cultivar OS. No new STUB states should be introduced after the date of this audit.

---

## SUMMARY: Top 10 Things to Extract to shared/ Before Conduit OS

Ranked by: (a) needed by 2+ verticals, (b) hard to rebuild, (c) highest strategic value.

### 1. `OnboardingWizard` shell — the 3-path magic moment framework
- Extract: `ProgressBar`, `WizardShell`, `WelcomeStep`, `ShopSetupStep`, `TeamQRStep`
- Each vertical provides its own path experience (Margin/Diagnose/Migrate for Auto; Season Preview/Order Demo/Import for Cultivar; Load/Route/Bill for Conduit)
- The welcome → setup → path → team QR structure is universal
- File target: `packages/shared/src/onboarding/WizardShell.tsx`

### 2. Trial clock + data blur + module gating engine
- Extract: `checkTrialStatus(moduleId)`, `DataBlur` wrapper component, tier-to-module gate map
- Currently: Ignition has it in DataBridge (localStorage), Cultivar has the data seam in `useModules.ts` but no enforcement
- File target: `packages/shared/src/billing/useTrial.ts` + `TrialGate.tsx`

### 3. Abstract asset model — QR → record → event history
- Extract: `Asset`, `AssetEvent` types; `useAsset(id)` hook; `AssetTimeline` component
- Cultivar has plants+plant_events; Ignition has vehicles+jobs; Conduit will have loads+legs
- Same shape every time: create → tag with QR → log events → display timeline
- File target: `packages/shared/src/assets/`

### 4. Customer record + purchase history pattern
- Extract: `Customer` type, `useCustomer(id)` hook, `CustomerCard`, `PurchaseHistory`
- Cultivar captures customers at checkout but has no directory or dedup; Conduit needs shippers/receivers
- File target: `packages/shared/src/customers/`

### 5. Integration registry + OAuth connect/disconnect UI pattern
- Extract: `IntegrationRegistry` type, `useIntegration(key)` hook, `ConnectButton` + `DisconnectButton`
- Both verticals need: connect → poll for status → show health → disconnect
- Fix `IGNITION_OS_DATA` hardcode in `quickbooks/oauth.ts` at same time
- File target: `packages/shared/src/integrations/`

### 6. Form component library
- Extract: `Input`, `Select`, `Textarea`, `FormLabel`, `ErrorMessage`, `ProgressBar`
- Every page in both verticals inlines these — the duplication is already severe
- File target: `packages/shared/src/components/forms/`

### 7. Settings page pattern
- Extract: `SettingsShell`, `SettingsSection`, `SettingsRow`, `IntegrationToggle`
- Every vertical needs: business info, tax/pricing config, module on/off, integration management
- File target: `packages/shared/src/settings/`

### 8. Dashboard metrics + leakage tracking pattern
- Extract: `MetricsBar`, `useMetrics(tenantId)` hook, `LeakageAlert`
- `api/dashboard.ts` in Cultivar is the right template — parameterize by vertical
- File target: `packages/shared/src/dashboard/`

### 9. Notification log + communication history per customer
- Extend existing: `NotificationLog` type already in `supabase/types.ts`
- Add: migration for `notification_log` table, `useCommunicationHistory(customerId)` hook, `CommunicationTimeline` component
- File target: `packages/shared/src/notifications/` (extend existing)

### 10. RLS policy templates + multi-tenancy pattern
- Extract: SQL template for `authenticated_select_<table>` policies scoped to `owner_id = auth.uid()`
- Document the two-phase approach: loose RLS (any auth user) for demo → tight RLS (owner_id join) post-demo
- Every new vertical must follow this same migration pattern
- File target: `packages/shared/docs/rls-pattern.md` + template SQL

---

## INTEGRATION REGISTRY (All Connectors with Status)

| Connector | What it does | Cultivar Status | Ignition Status | Env Vars |
|---|---|---|---|---|
| QuickBooks Online | Invoice creation, customer sync, OAuth | ✅ Live | 🟡 Onboarding only | `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT` |
| Blotato | Social media post publishing | ✅ Live | ❌ | `BLOTATO_API_KEY` |
| Anthropic / Claude | AI post generation, analysis | ✅ Live | 🟡 Routed, not in production | `ANTHROPIC_API_KEY` |
| Supabase | Database, auth, storage | ✅ Live (bgobkjco project) | 🟡 Shops table only | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` |
| Resend | Transactional email | 🟡 In `send.ts`, unconfirmed | ❌ | `RESEND_API_KEY` (verify) |
| Twilio | SMS notifications | 🟡 In `send.ts`, unconfirmed | ❌ | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (verify) |
| Stripe | Billing + subscriptions | ❌ | ❌ | Not set |
| Google Maps | Delivery routing, geocoding | ❌ | ❌ | Not set |
| Gemini | Vision AI (VIN, invoice scan) | ❌ | 🟡 Routed in AIEngine | Not set |
| OpenAI / Whisper | Voice transcription, NLP | ❌ | 🟡 Routed in AIEngine | Not set |
| Samsara / Geotab | Fleet telematics | ❌ | 🟡 UI button only | Not set |
| Google Calendar | Scheduling | ❌ | ❌ | Not set |

---

## GAP-FILLER REGISTRY (Capabilities We Own — No External Dependency)

These are TRACE-owned capabilities that don't depend on any external service. Each one is a competitive moat.

| Capability | Description | Cultivar Status | Ignition Status | Location |
|---|---|---|---|---|
| **Missed revenue / leakage detection** | Identifies add-ons declined, transport upgrades skipped, margin underpricing | ✅ `leakage_flag` on orders, dashboard count | ✅ MarginPath in OnboardingWizard | Cultivar: `api/orders/submit.ts`; Shared: `pricing/marginEngine.ts` |
| **Plant growth timeline** | Visual history of every event on a plant from planting to sale | ✅ `plant_events` table + `PlantTimeline.tsx` | N/A | `packages/cultivar-os/src/components/plant/PlantTimeline.tsx` |
| **Urgency copy engine (Regina Rule)** | Add-on prompts with urgency language for time-sensitive services | ✅ Netting prompt: red border, pre-checked, urgency copy | ✅ MarginEngine suggestion in OnboardingWizard | `packages/cultivar-os/src/components/checkout/NettingPrompt.tsx` |
| **QR → checkout → QB invoice in one flow** | Scan a plant QR, check out, QB invoice auto-created, email sent | ✅ Full flow live | ❌ | `cultivar-os/api/orders/submit.ts` + `api/qbo/invoice/cultivar.ts` |
| **AI social post generation (cached)** | Claude generates 3 platform-optimized posts per order, system prompt cached | ✅ Live | ❌ | `api/social/generate-posts.ts` |
| **Module tile system (3 states)** | Active / Available (enable) / Locked (upgrade) — per-nursery config from Supabase | ✅ Live | ✅ Adapted in AdminSubscription | `packages/shared/src/components/tiles/` |
| **Multi-provider AI router** | Single interface routes to Claude / Gemini / OpenAI by task type, with tier gating and fallback | 🟡 Not used in Cultivar yet | 🟡 Designed, not in production | `packages/shared/src/ai/AIEngine.ts` |
| **Invoice audit (AI invoice reader)** | Upload photo of shop invoice → Claude vision flags uncaptured charges, fluids, consumables | ❌ for Cultivar | ✅ `IgnitionAudit.jsx` (concept_aliases learning) | `packages/ignition-os/modules/IgnitionAudit.jsx` |
| **QR team join flow** | Scan one QR to create an account, set a PIN, and join your shop's workspace | ❌ | ✅ OnboardingWizard TEAM_QR step | `packages/ignition-os/OnboardingWizard.jsx` |
| **ROI / savings report** | Calculates time saved × rate, margin recovered, shows dollar value of TRACE | 🟡 `SavingsReport.jsx` in shared (JSX) | ✅ MarginPath shows annual leakage | `packages/shared/src/components/SavingsReport.jsx` |

---

## OPEN QUESTIONS BEFORE CONDUIT OS

1. **Resend and Twilio** — are they actually wired with working API keys? The `send.ts` file references them but no env var confirmation in CLAUDE.md. Verify before any notification feature is demo'd.
2. ~~**Multi-nursery / multi-tenant** — the current `VITE_DEMO_NURSERY_ID` architecture is single-tenant by design.~~ **(resolved 2026-06-02)** `BusinessProvider` resolves business from `auth.uid()` — owner path or member path. Multi-tenant member login fully verified via E2E test. `business_members` table is the join point for non-owners.
3. ~~**`configureAuth` for Cultivar staff roles**~~ **(resolved 2026-06-02)** Roles live in `packages/cultivar-os/src/auth/roles.ts`. Permissions stored in `business_members.permissions`. `isOwner` and `userPermissions` exposed through `BusinessProvider` context. MANAGER and STAFF roles are defined and gating is enforced.
4. ~~**QB token refresh** — access tokens expire in 60 min. No refresh logic exists.~~ **(resolved 2026-05-23)** `packages/shared/src/quickbooks/refresh.ts` (`refreshQBToken()`) performs proactive refresh at the start of every invoice call. Sets `accounting_needs_reconnect = true` if refresh token is dead. Dashboard shows amber banner when reconnect is needed.
5. **Conduit OS vertical** — what is Conduit's equivalent of a "plant"? (A load? A shipment? A lane?) The abstract asset model can't be extracted until the second vertical's asset shape is known.

---

*TRACE Enterprises · Platform Audit · May 23, 2026*  
*Every decision about shared/ references this document.*
