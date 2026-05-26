# TRACE Platform Baseline Audit

## Scope & Hierarchy

This document owns current code state — what exists, what's stubbed, what needs extracting. This doc is the source of truth for any question about what is actually built right now.

When this doc conflicts with another:
- For target state and architectural intent, see PLATFORM_STRATEGY.md
- For strategy, revenue, and demo plan, see MASTER_BRIEF.md
- For current infrastructure specifics (Supabase projects, env vars, deployment URLs, recent session work), see CLAUDE.md
- For the discovery module's specification, see DISCOVERY_MODULE_BRIEF.md (created Session 1b)

When this audit says X exists and another doc says Y exists, the audit wins. Other docs are intent; this doc is reality.

**Date:** May 23, 2026  
**Scope:** ignition-os · cultivar-os · packages/shared  
**Purpose:** Blueprint for shared/ before Conduit OS is built  
**Philosophy:** Every capability is a CONNECTOR (links to existing tools) or GAP-FILLER (adds what no tool gives)

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
| Settings access by role | Admin-gated via DataBridge `current_user.role === 'OWNER'` | No settings page yet | None | BUILD NEW |
| Who sees what on dashboard | Role-based module visibility in DataBridge `shop_policy.active_modules` | Single owner view | None | EXTRACT |
| QR join / team onboarding | `OnboardingWizard` TEAM_QR step: QR + share link → `/?join=<shopId>` | Not built | `qr/generate.ts` available | BUILD NEW |
| Multi-account login | PIN picker (any registered PIN unlocks session) | Single owner login | None | IGNORE (vertical-specific) |

**Notes:**
- Cultivar OS has no concept of staff roles yet. Lauren (manager) vs Terry (owner) will need different access levels post-demo.
- The `configureAuth` factory is well-designed but Cultivar OS bypasses it partially — `src/lib/auth.ts` uses it correctly.
- STORAGE_KEY = `'IGNITION_OS_DATA'` is hardcoded in `packages/shared/src/quickbooks/oauth.ts` — OFF LIMITS until post-demo fix.

---

## 2. SETTINGS & CONFIGURATION

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Settings page / module | `AdminSubscription.jsx` doubles as settings + marketplace | No settings page (post-demo task) | None | BUILD NEW |
| Business-level config | `DataBridge.save('shop_info', {...})` — name, phone, address, USDOT | `nurseries` table row — hardcoded nursery ID in env var | None | EXTRACT |
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
| Customer lookup at checkout | By name/phone in CRM | No lookup — always creates new record | None | BUILD NEW |
| Export | ❌ | ❌ | None | BUILD NEW |

**Notes:**
- Cultivar OS creates a new customer row every checkout with no deduplication. "Terry" from five purchases exists five times in the DB. A lookup + merge pattern is needed.
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
| Tile system | ✅ Extracted from CAI (`IgnitionHub.jsx`) — dark theme (slate-950) | ✅ Extracted → `useModules.ts` + `TileGrid.tsx` | ✅ `tiles/TileGrid.tsx` + `tiles/Tile.tsx` — 3 states + count badge | CONFIGURE ✅ |
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
| Token refresh handling | ❌ | ❌ (QB tokens in `nurseries.qb_access_token` — no refresh logic) | None | BUILD NEW |
| Integration health indicators | ❌ | QB status dot on tile (active/available) | None | BUILD NEW |
| Webhook handling | ❌ | ❌ | None | BUILD NEW |
| CSV import | ✅ `CSVImporter.jsx` + `ExternalBridge.csv.parse/map/import` | ❌ | None | EXTRACT |
| Telematics (Samsara/Geotab/Motive) | 🟡 Button exists in `AdminSubscription`, not wired | ❌ | None | IGNORE (auto vertical) |
| VIN OCR | 🟡 Button in `AdminSubscription`, `AIEngine.decodeVIN()` | ❌ | `AIEngine.ts` task: `vin_decode` | IGNORE (auto vertical) |
| Social media (Blotato) | ❌ | ✅ `api/social/publish.ts`, `api/social/generate-posts.ts` | None | CONNECTOR |
| QuickBooks | 🟡 In Ignition Onboarding only, incomplete | ✅ Full OAuth + invoice creation + customer lookup | `quickbooks/oauth.ts`, `invoice.ts`, `customer.ts` | CONFIGURE ✅ |

**Notes:**
- The `ExternalBridge.js` pattern (a single object with `.qbo`, `.csv`, `.telematics` namespaces) is the right architecture for an integration registry. Extract the **pattern** to shared, not the file — it's deeply Ignition-specific.
- Cultivar OS has no token refresh. QuickBooks access tokens expire in 60 minutes. This is a live production bug waiting to happen.

---

## 10. DATA & MULTI-TENANCY

| Feature | Ignition OS | Cultivar OS | Shared | Action |
|---|---|---|---|---|
| Tenancy model | Single shop: `shop_id` in localStorage | Single nursery: `VITE_DEMO_NURSERY_ID` env var | `tenant_id` on all shared type definitions | EXTRACT |
| RLS pattern | ❌ (localStorage — no DB-enforced tenancy) | ✅ RLS on modules, nursery_modules, social_drafts | None | CONFIGURE |
| Audit logging | ❌ | ❌ | `NotificationLog`, `AIUsageLog` types defined | EXTRACT |
| Soft delete | ❌ | ❌ | None | BUILD NEW |
| Data export per tenant | ❌ | ❌ | None | BUILD NEW |
| Cross-tenant isolation | N/A (localStorage per device) | Partial: nursery_id where clause, loose RLS (any authenticated user can read nursery_modules) | `tenant_id` in types | EXTRACT |
| Schema migration discipline | N/A | ✅ Append-only migrations in `supabase/migrations/` | None | CONFIGURE ✅ |
| Concept alias learning | ✅ `concept_aliases` table in `IgnitionAudit.jsx` (cross-shop AI improvement) | ❌ | `AIUsageLog` type | IGNORE (auto vertical) |

**Notes:**
- Cultivar OS currently enforces tenancy by `nursery_id` in queries, not by `auth.uid()` in RLS. The `authenticated_select_nursery_modules` policy allows ANY authenticated user to read ANY nursery's modules. This is intentionally loose (post-demo fix) but must be locked before going multi-tenant.
- The `VITE_DEMO_NURSERY_ID` env var approach hard-wires a single nursery — fine for demo, breaks for multi-nursery. The right model is: nursery_id from authenticated user's profile row, not an env var.

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
| **Anthropic / Claude** | 🟡 `AIEngine.ts` routing — not used in production yet | ✅ `api/social/generate-posts.ts` — Claude Sonnet 4.6 with prompt caching | Active ✅ | DONE |
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
| Delivery routing | ❌ | `delivery_routing` | Growth | BUILD NEW |
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
2. **Multi-nursery / multi-tenant** — the current `VITE_DEMO_NURSERY_ID` architecture is single-tenant by design. What does the auth → nursery_id lookup look like when LAWNS has a second location?
3. **`configureAuth` for Cultivar staff roles** — Lauren (manager) needs different access than Terry (owner). Does the email strategy in configureAuth support roles, or does role come from the `nurseries` table?
4. **QB token refresh** — access tokens expire in 60 min. No refresh logic exists. Who is responsible for re-auth in a production scenario?
5. **Conduit OS vertical** — what is Conduit's equivalent of a "plant"? (A load? A shipment? A lane?) The abstract asset model can't be extracted until the second vertical's asset shape is known.

---

*TRACE Enterprises · Platform Audit · May 23, 2026*  
*Every decision about shared/ references this document.*
