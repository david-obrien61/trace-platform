# CLAUDE.md — TRACE Platform
# Multi-AI Handoff Workflow — Claude Code reads this every session
# Last updated: May 27, 2026
# Current AI: Claude Code

> CRITICAL: Read this entire file before touching any code.
> Update the Handoff section (Part 3) before ending every session.
> Update GEMINI.md with the same changes if Gemini is in use.

---

## Scope & Hierarchy

This document owns session-by-session handoff state, current infrastructure specifics, and the active task list. Read this first at the start of every Claude Code session.

When this doc conflicts with another:
- For strategy, demo plan, or revenue questions, see MASTER_BRIEF.md
- For architecture or where things should live, see PLATFORM_STRATEGY.md
- For what's actually built in code, see TRACE_PLATFORM_AUDIT.md
- For the discovery module, see DISCOVERY_MODULE_BRIEF.md (created Session 1b)

Update the handoff section at the end of every session.

---

## 1. CORE MANDATE

You are building the TRACE platform — a composable AI operating
system for owner-operated small businesses. One codebase. One
deployment. Infinite verticals. Each vertical is a configured
instance of the same shared platform.

**CRITICAL RULES — NON-NEGOTIABLE:**

1. Before writing ANY new module, check packages/shared/src/ first
2. If it exists in shared → import and configure. Never rebuild.
3. If it needs to be shared → build it IN shared/ first, then import
4. Never hardcode a vertical name inside a shared module
5. Never duplicate auth, QB, QR, notifications, or UI primitives
6. Never modify packages/ignition-os without flagging it first
7. Never end a session without updating this Handoff section
8. Commit after every completed task

---

## 2. STATUS & ARCHITECTURE

### Key Contacts

**LAWNS Tree Farm (Leander, TX)** — Cultivar OS prospect, prototype demo customer
- Terry: owner, 65, retiring soon, tech-shy, approval gatekeeper
- Lauren Bishop: manager, the real operational buyer, the champion who feels the pain
- "Layna" was a miscommunication and is not a real contact. Do not reintroduce.

**Operation Liberty Hill (Liberty Hill, TX)** — KINNA-OS anchor pilot customer
- Regina O'Brien: Program Director, anchor pilot user. Holds active job offer; planning graceful exit. David's wife.
- Hard target: Back to School distribution, Saturday August 1, 2026

- **Current phase:** Phase 0 — Cultivar OS demo prep
- **Demo meeting:** Next week — LAWNS Tree Farm LLC, Leander TX
- **Key contacts:** Terry (owner), Lauren (manager)
- **Active vertical:** cultivar-os
- **Tech stack:** React + Vite + TypeScript · Supabase · Vercel
- **Source of truth:** Supabase PostgreSQL (NEW project)
- **Repo:** github.com/david-obrien61/trace-platform (private)
- **Frontend deploy:** Vercel → cultivar-os.vercel.app
- **Backend:** Vercel serverless functions (api/ at repo root)
- **Railway:** Ignition OS only — do NOT use for cultivar-os

### Supabase Projects — TWO SEPARATE PROJECTS

```
cultivar-os (NEW — active):
  Project ref: bgobkjcopcxusjsetfob
  URL: https://bgobkjcopcxusjsetfob.supabase.co
  Tables: nurseries, plants, plant_events, orders,
          order_items, order_addons, addons, losses,
          customers, social_drafts, modules,
          nursery_modules
  Auth: email/password, email confirmation OFF

ignition-os (OLD — do not touch):
  Project ref: ufsgqckbxdtwviqjjtos
  Contains: all Ignition OS tables
  Status: active for Ignition OS dry run
  RULE: never modify from cultivar-os code
```

### Vercel Environment Variables (cultivar-os project)

```
VITE_SUPABASE_URL      = https://bgobkjcopcxusjsetfob.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGc... (new project anon key)
SUPABASE_SERVICE_KEY   = eyJhbGc... (new project service key)
SUPABASE_URL           = https://bgobkjcopcxusjsetfob.supabase.co
QBO_CLIENT_ID          = set ✅
QBO_CLIENT_SECRET      = set ✅
QBO_REDIRECT_URI       = https://cultivar-os.vercel.app/api/qbo/callback
QBO_ENVIRONMENT        = sandbox
BLOTATO_API_KEY        = blt_Wq7URDauPd5CdJzJfvRWgJSGrBdjZYIuOXNLb/ePic8=
VITE_DEMO_NURSERY_ID   = a1b2c3d4-0000-0000-0000-000000000001
VITE_TAX_RATE          = 0.0825
```

### Key Data — Demo

```
Demo URL:      cultivar-os.vercel.app/plant/SCV-0031
Demo nursery:  LAWNS Tree Farm, LLC
Nursery ID:    a1b2c3d4-0000-0000-0000-000000000001
Test login:    david_obrien2016@outlook.com
Netting price: $10/tree
Tax rate:      8.25% (Texas)
Invoice:       #3648.380 — $920.13 PAID (bring printed copy)
Meeting:       Next week — 400 Honeycomb Mesa, Leander TX 78641
Close target:  $149/mo founding rate — locked forever
TRACE phone:   (512) 456-3632
TRACE email:   david@trace-enterprises.com
```

### Registered Domains (as of 2026-05-26)

All domains registered at GoDaddy under David's account.

| Domain | Protection | Status / Use |
|---|---|---|
| trace-enterprises.com | None | Parent company domain |
| builtwithcai.com | Full Protection | Methodology brand; hosts discovery.builtwithcai.com (planned subdomain) |
| cultivar-os.com | None | Cultivar OS (nursery vertical) — currently forwards to cultivar-os.app |
| cultivar-os.app | None | Cultivar OS production app (live) |
| ignition-os.com | Full Protection | Ignition OS (diesel/auto vertical) |
| ignition-os.app | None | Ignition OS (alternate TLD) |
| conduit-os.com | None | Conduit OS (HVAC/electrical vertical) |
| conduit-os.app | None | Conduit OS (alternate TLD) |
| kinna-os.com | None | KINNA-OS (faith-based and direct-service nonprofit vertical) |
| kinna-os.app | None | KINNA-OS (alternate TLD) |

**WHOIS privacy status:** Domains marked "None" do NOT have WHOIS privacy enabled, meaning David's registration address is publicly queryable. Plan: defer privacy upgrades to the Cloudflare transfer window opening July 1-2, 2026, which provides free WHOIS privacy as a benefit of the transfer. Current annual cost of GoDaddy WHOIS privacy across the unprotected domains would be approximately $13/yr each.

**Open: which domain hosts the KINNA-OS production app when Phase 1 ships.** Options include kinna-os.app (matches Cultivar's pattern), kinna-os.com (matches Ignition's pattern), or a subdomain of builtwithcai.com (matches the discovery surface pattern). Decision deferred to pre-build.

---

## Open Architecture Decisions

Decisions that have been deferred but must be resolved before specific build milestones. Update this list when decisions are made or new ones are deferred.

| # | Decision | Deferred From | Resolve Before | Notes |
|---|---|---|---|---|
| 1 | "Surface Honesty" principle name | 2026-05-26 (Session 1b) | 60 days of use, then review | Substance is locked; only the name is provisional |
| 2 | "Honest Friction" principle name | 2026-05-26 (Session 1b) | 60 days of use, then review | Substance is locked; only the name is provisional |
| 3 | KINNA-OS production app domain | 2026-05-26 | KINNA-OS Phase 1 build | Options: kinna-os.app, kinna-os.com, subdomain of builtwithcai.com |
| 5 | PLATFORM_STRATEGY.md file metadata claiming to be authoritative | 2026-05-26 (Session 1a noticed-but-not-touched) | Next PLATFORM_STRATEGY edit pass | Mildly inconsistent with the new Scope & Hierarchy preamble; soften or remove |
| 6 | PANTRY_OS.md file rename (if file is re-created) | 2026-05-26 | If/when a Pantry OS-named file is re-created in the repo | File was not found in the repo at Session 1a, but the question of its potential return is logged |
| 7 | "Honest Velocity" principle name | 2026-05-27 (Brand framing session) | 60 days of use, then review | Substance is locked; only the name is provisional. Joins Surface Honesty and Honest Friction as a coherent family of design principles. |
| 8 | "Epistemic Humility" principle name | 2026-05-27 (Brand framing session) | 60 days of use, then review | Substance is locked; only the name is provisional. Fourth design principle. |
| 9 | Family-member role descriptions in canonical docs | 2026-05-27 (Brand framing session) | Before any public-facing copy uses them | Andrew, Connor, Erin, Regina each get to review and edit their own paragraph in the TRACE — Who We Are block. David sends each their section. |

---

## Tech Debt Log

Intentional workarounds that violate architectural intent for a real-world reason. Each entry documents the workaround, the correct architecture, and what triggers the repair. Tech debt is acknowledged here so it doesn't become silent debt.

This log is created and maintained per the Honest Friction principle (see PLATFORM_STRATEGY.md Design Principles).

| # | Workaround | Introduced | Correct Architecture | Trigger for Repair |
|---|---|---|---|---|
| 1 | Cultivar OS dashboard tiles show active state but `handleNavigate(_key)` is an empty stub (flash and nothing) | Pre-2026-05-25 (inherited from build sessions) | Per Surface Honesty: each tile is WORKS, LABELED, or HIDDEN — never flash-and-nothing | Before any next prospect demo of Cultivar OS |
| 2 | QB integration is hardcoded with `IGNITION_OS_DATA` reference | Pre-2026-05-23 (per Session 1a audit findings) | AccountingAdapter interface per PLATFORM_STRATEGY.md target architecture; vertical-agnostic | When second vertical (KINNA-OS Phase 1) needs QB or alternative accounting connector |
| 3 | Social module lives in cultivar-os/api/, not packages/shared/ | Pre-2026-05-23 (per audit findings, Cultivar-only by accident) | Per PLATFORM_STRATEGY.md target: extract to packages/shared/src/social/ | Before Conduit OS or KINNA-OS need social composer |

**Initial entries above are seeded from the Session 1a audit findings and the button audit folded into TRACE_PLATFORM_AUDIT.md in this session (1b). Future entries are added by Claude Code or David whenever Honest Friction surfaces a workaround that is intentionally executed against architectural intent.**

---

## 3. HANDOFF

> Rewritten at the end of every session.
> The next Claude Code session reads this first.

- **Completed this session:** Major infrastructure work May 21-22:
  - Supabase project separation COMPLETE
    cultivar-os now on separate project bgobkjco
    ignition-os project untouched
  - All compliance fixes Groups 1-4 complete
  - Shared auth: configureAuth() factory built
    packages/shared/src/auth/configureAuth.tsx
    Email strategy for cultivar-os
    PIN strategy for ignition-os
  - Tile system extracted from CAI/Ignition OS
    packages/shared/src/components/tiles/TileGrid.tsx
    packages/shared/src/components/tiles/Tile.tsx
    3 states: active / available / locked
  - useModules.ts built — reads from Supabase
  - Dashboard tile grid live and verified on device
  - modules table seeded (10 modules)
  - nursery_modules seeded for LAWNS
  - QB reconnected to new project ✅
  - End-to-end checkout verified on new project ✅
  - QB invoice creation verified ✅
  - Blotato account created, API key in Vercel ✅
  - social_drafts table created ✅

- **Completed this session (May 22 continued):**
  - QB OAuth audit complete — no Grove-OS hardcoding found,
    sandbox→production is env var only (flip QBO_ENVIRONMENT,
    swap client ID/secret). One cosmetic: 'QuickBooks Sandbox'
    fallback string in callback.ts — non-blocking.
  - /privacy page live: cultivar-os.vercel.app/privacy ✅
  - /terms page live: cultivar-os.vercel.app/terms ✅
    Required for Intuit production app approval.
    Both use #27500A / #EAF3DE branding, mention QB integration,
    data storage (Supabase), user rights, contact email.
  - QR Checkout tile state bug FIXED ✅
    Root cause: modules + nursery_modules tables had RLS
    enabled but no SELECT policy for authenticated role.
    Frontend queries returned [] silently.
    Fix: migration 20260522_rls_modules_nursery_modules.sql
    — added authenticated_select_modules and
    authenticated_select_nursery_modules policies.
    No code changes — useModules.ts logic was correct.

- **Completed this session (May 22 — Social Media module COMPLETE):**
  - Social Media module STEPS 1-3 COMPLETE ✅
  - STEP 1: Enable → wizard ✅
    SocialSetup.tsx — platform checkboxes (Instagram, Facebook,
    TikTok, Twitter/X) + Blotato Account ID input
    api/social/enable.ts — upserts nursery_modules enabled+configured
    Social tile: Enable → /social/setup → save → tile goes active
  - STEP 2: Post generation on order complete ✅
    api/social/generate-posts.ts — claude-sonnet-4-6
    System prompt cached via cache_control ephemeral
    Generates 3 posts: educational, customer_story, seasonal
    Writes to social_drafts (status='pending')
    On API failure: writes status='failed', never blocks order
    Guards ANTHROPIC_API_KEY missing — returns ok:false silently
    useSubmitOrder.ts — fire-and-forget after QB call
  - STEP 3: Dashboard pending count badge ✅
    Tile.tsx — amber notification badge (top-left) when count > 0
    Dashboard.tsx — pendingSocialCount state, loadSocialCount(),
    count prop wired to Social tile
    RLS migration: supabase/migrations/20260522_social_drafts_rls.sql
  - STEP 4 (Publish flow): ON HOLD — Blotato API structure confirmed
    POST https://backend.blotato.com/v2/posts
    Header: blotato-api-key: KEY
    Payload: {post: {accountId, content: {text, platform},
             target: {targetType}}}
    Do NOT build until David approves
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅

- **Completed this session (May 22 — social_drafts bug fix):**
  - Root cause diagnosed: generate-posts.ts inserted `generated_at`
    (column doesn't exist), `order_id` (didn't exist), `post_type`
    (didn't exist). Postgres rejected every insert silently.
  - Migration written: 20260522_social_drafts_add_order_post_type.sql
    Adds order_id uuid REFERENCES orders(id) ON DELETE SET NULL
    Adds post_type text CHECK IN ('educational','customer_story','seasonal')
    ⚠️ MUST be run manually in Supabase SQL editor — see pending steps
  - generate-posts.ts fixed:
    Removed generated_at from both inserts (success + failure paths)
    created_at is auto-populated by Supabase — never set manually
    order_id and post_type now correctly included in both inserts
  - No generated_at references remain anywhere in codebase
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅

- **Completed this session (May 22 — social_drafts status constraint fix):**
  - Bug: inserts failing with social_drafts_status_check constraint violation
    Root cause: code inserted status='pending' but social_drafts table
    CHECK constraint only allows 'draft' (not 'pending') as initial state
  - generate-posts.ts fixed: status 'pending' → 'draft' in success inserts
  - Dashboard.tsx fixed: badge count query updated to match
  - social_drafts status lifecycle: 'draft' → 'published' | 'failed'
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅

- **Completed this session (May 22 — Social Media STEP 4 — Blotato publish flow):**
  - STEP 4 COMPLETE ✅
  - api/social/publish.ts — new endpoint
    Accepts: draft_id
    Reads social_drafts row (content, platform)
    Reads nursery_modules.config.blotato_account_id
    POSTs to https://backend.blotato.com/v2/posts
    Header: blotato-api-key (from BLOTATO_API_KEY env var)
    Payload: {post:{accountId, content:{text,mediaUrls:[],platform},
              target:{targetType}}} — platform=targetType='instagram'
    On success: updates status='published', returns postSubmissionId
    On failure: updates status='failed', returns ok:false reason
    Never throws — always 200
  - api/social/publish.ts (root re-export) — wires Vercel routing
  - Dashboard.tsx refactored:
    pendingSocialCount + loadSocialCount() → socialDrafts[] + loadSocialDrafts()
    Single query for both badge count and panel content
    Social Drafts panel: appears below tile grid when drafts exist
    Each draft: post_type chip (Educational/Customer Story/Seasonal)
    Content preview (3-line clamp) + Publish button
    handlePublish(): calls /api/social/publish, removes from list on success
    publishingId state: disables button + shows 'Posting…' during in-flight
    Badge auto-decrements as drafts are published (derived from array length)
  - Blotato API confirmed at help.blotato.com/api/llm.md:
    platform and targetType must match exactly
    Instagram requires no extra fields (no pageId, no privacyLevel)
    Response: { postSubmissionId: uuid }
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅

- **Current tile states:**
  - QR Checkout: active ✅
  - QuickBooks: active ✅
  - Social Media: available → becomes active after setup wizard ✅
  - Online Shop: available
  - Follow-Up: available
  - Delivery: available
  - Contractors/Seasonal/Insights/Inventory: locked

- **Next tasks in order:**
  1. Online Shop (/shop):
     All available plants, filterable
     Same checkout flow
     Delivery radius check at address entry
  3. Mobile responsive fix:
     Tile grid tablet/desktop only (768px+)
     Mobile: core metrics + bottom nav only

- **Completed this session (May 22 — publish status='failed' constraint fix):**
  - Root cause: social_drafts CHECK constraint only allowed 'draft'+'published',
    not 'failed'. Supabase JS returns { error } silently (no throw), so all
    status='failed' writes in publish.ts were dropped without logging.
  - Migration written: supabase/migrations/20260522_social_drafts_add_failed_status.sql
    DROP CONSTRAINT + ADD CONSTRAINT with ('draft','published','failed')
    ⚠️ MUST be run manually in Supabase SQL editor — see pending steps
  - publish.ts: added error logging on all 5 status update calls
    (was: silently ignored; now: logs constraint violations to Vercel logs)
  - Deployed: cultivar-os.vercel.app ✅

- **Last files edited:**
  packages/cultivar-os/api/social/publish.ts (error logging on status updates)
  supabase/migrations/20260522_social_drafts_add_failed_status.sql (new)
- **Last command run:** npx vercel --prod from repo root — deployed ✅
  NOTE: always deploy from repo root (/trace-platform/), not from
  packages/cultivar-os/ — the @trace/shared alias breaks otherwise
- **Build status:** Clean — 2156 modules, zero TS errors

- **Blockers / Notes:**
  - social_drafts schema migration (order_id + post_type columns) NOT yet
    applied in Supabase — generate-posts inserts will fail until David runs it
  - social_drafts status constraint migration NOT yet applied —
    status='failed' writes will still fail until David runs it (see pending steps)
  - ANTHROPIC_API_KEY confirmed in Vercel ✅
  - BLOTATO_API_KEY in Vercel ✅
  - QB tokens stored in nursery.qb_access_token on new project ✅
  - social_drafts status lifecycle: 'draft' → 'published' | 'failed'

- **⚠️ Pending manual steps (David):**
  - ⚠️ BLOCKER #1: Run in Supabase SQL editor (bgobkjcopcxusjsetfob):
    supabase/migrations/20260522_social_drafts_add_order_post_type.sql
    SQL:
      ALTER TABLE social_drafts
        ADD COLUMN order_id  uuid REFERENCES orders(id) ON DELETE SET NULL,
        ADD COLUMN post_type text CHECK (post_type IN ('educational','customer_story','seasonal'));
    THEN test: place order at cultivar-os.vercel.app/plant/SCV-0031
    THEN query:
      SELECT id, post_type, status, content FROM social_drafts ORDER BY created_at DESC LIMIT 10;
    Expect 3 rows: educational, customer_story, seasonal — all status='draft'
  - ⚠️ BLOCKER #2: Run in Supabase SQL editor (bgobkjcopcxusjsetfob):
    supabase/migrations/20260522_social_drafts_add_failed_status.sql
    SQL:
      ALTER TABLE social_drafts DROP CONSTRAINT IF EXISTS social_drafts_status_check;
      ALTER TABLE social_drafts ADD CONSTRAINT social_drafts_status_check
        CHECK (status IN ('draft', 'published', 'failed'));
    Required for publish errors to be recorded — without this, failed
    publishes stay as status='draft' and Lauren can't see what needs attention.
  - Print QR tags: SCV-0031, NCM-0042, MS30-001
  - Print invoice #3648.380
  - Print FOUNDING_CUSTOMER_AGREEMENT.md
  - Print ROI one-pager (to be written)
  - Full demo run-through timed — Sunday
  - Practice Regina story out loud 3 times

- **Completed this session (May 23 — QB token refresh):**
  - QB token refresh COMPLETE ✅ — demo-critical, blocks invoice creation after 60 min
  - Migration: supabase/migrations/20260523_qb_token_expires_at.sql APPLIED ✅
    ALTER TABLE nurseries
      ADD COLUMN qb_token_expires_at timestamptz,
      ADD COLUMN qb_needs_reconnect  boolean NOT NULL DEFAULT false;
  - packages/shared/src/quickbooks/refresh.ts — new server-side shared utility
    refreshQBToken(nurseryId, tokens) — proactive check: refreshes if missing
    or within 10 min of expiry. Writes new token + expires_at back to nurseries.
    Sets qb_needs_reconnect=true and returns null if refresh token is dead.
  - packages/cultivar-os/api/qbo/callback.ts updated:
    Now stamps qb_token_expires_at + qb_needs_reconnect=false on every connect.
    Ensures tokens are always tracked from first OAuth handshake.
  - packages/cultivar-os/api/qbo/invoice/cultivar.ts updated:
    Imports refreshQBToken from shared. Calls it proactively at handler start.
    Returns 503 { error: 'qb_token_expired' } if refresh fails (non-blocking —
    useSubmitOrder.ts catches this; order completes, invoice skipped).
    Removed doRefresh() function and both reactive 401 retry blocks.
    Removed now-unused QBO_CLIENT_ID / QBO_CLIENT_SECRET / QBO_TOKEN_URL constants.
  - packages/cultivar-os/src/pages/Dashboard.tsx updated:
    Reads qb_needs_reconnect from nurseries row in loadMetrics().
    Shows amber warning banner above tile grid when true:
    "QuickBooks needs reconnection — reconnect from the QuickBooks tile above."
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅ (Vercel compiled all 9 API routes cleanly)

- **Completed this session (May 23 — install price bug fix):**
  - Bug: transport='install' never added install_price to cart total
    Root cause: all four calculation points (CartReview, submit API,
    useSubmitOrder email calc, QB invoice builder) ignored install_price.
  - Fix applied across 4 files, no migration needed:
    CartReview.tsx: isInstall + installAmount = install_price × qty;
      added "✓ Installation service · N plant(s)  $225.00" OrderLine;
      plain delivery still shows "✓ LAWNS handling transport — " with dash
    api/orders/submit.ts: installAmount folded into addonsAmount;
      correct subtotal/tax/total written to DB; leakageFlag
      correctly false when install selected (addonsAmount > 0)
    useSubmitOrder.ts: installAmount included in email addonsTotal
    api/qbo/invoice/cultivar.ts: transport='install' → priced QB line
      "Installation service · N plant(s)" at install_price per plant;
      transport='delivery' → keeps existing $0 "LAWNS staff transport" line
  - install_price read from plants.install_price (already in Plant type)
  - SCV-0031 install_price = $225.00 (set in seed data)
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅

- **Last files edited:**
  packages/cultivar-os/src/pages/CartReview.tsx
  packages/cultivar-os/api/orders/submit.ts
  packages/cultivar-os/src/hooks/useSubmitOrder.ts
  packages/cultivar-os/api/qbo/invoice/cultivar.ts
- **Last command run:** npx vercel --prod from repo root — deployed ✅
  NOTE: always deploy from repo root (/trace-platform/), not from
  packages/cultivar-os/ — the @trace/shared alias breaks otherwise
- **Build status:** Clean — 2156 modules, zero TS errors

- **Completed this session (May 23 — platform audit):**
  - TRACE_PLATFORM_AUDIT.md written to repo root ✅
    Full 15-area comparison: ignition-os vs cultivar-os vs shared
    Top 10 extract-to-shared priorities identified before Conduit OS
    Full connector inventory + gap-filler registry
    Open questions for Conduit OS documented
    Key finding: OnboardingWizard shell + trial clock + abstract asset model
    are the three most critical extractions before building a third vertical
  - No code changes — audit only

- **Last files edited:**
  supabase/migrations/20260523_qb_token_expires_at.sql (new — applied ✅)
  packages/shared/src/quickbooks/refresh.ts (new)
  packages/cultivar-os/api/qbo/callback.ts (qb_token_expires_at + qb_needs_reconnect)
  packages/cultivar-os/api/qbo/invoice/cultivar.ts (proactive refresh, removed doRefresh)
  packages/cultivar-os/src/pages/Dashboard.tsx (amber reconnect banner)
  CLAUDE.md (this update)
- **Last command run:** npx vercel --prod from repo root — deployed ✅
  NOTE: always deploy from repo root (/trace-platform/), not from
  packages/cultivar-os/ — the @trace/shared alias breaks otherwise
- **Build status:** Clean — 2156 modules, zero TS errors

- **Session ended by:** Claude Code — May 23, 2026

### 2026-05-26 — Session 1a: Doc reconciliation foundation

Completed:
- PART 1: Scope & Hierarchy preambles added to MASTER_BRIEF, PLATFORM_STRATEGY, AUDIT, CLAUDE
- PART 2: Identical TRACE Philosophy paragraph synced across MASTER_BRIEF, PLATFORM_STRATEGY, AUDIT
- PART 3: Pantry OS → KINNA-OS rename across all docs + KINNA-OS identity section added to MASTER_BRIEF
- PART 4: Layna references corrected (now Terry/Lauren) + Key Contacts section in CLAUDE.md
- PART 5: Current Customer State section in MASTER_BRIEF capturing LAWNS, OLH, Ignition OS

Not in this session (Session 1b):
- DISCOVERY_MODULE_BRIEF.md creation
- Surface Honesty principle in PLATFORM_STRATEGY
- Button audit findings fold-in to TRACE_PLATFORM_AUDIT
- BUTTON_AUDIT_DEMO.md → docs/audits/ relocation as dated artifact
- PANTRY_OS.md file rename (confirmed not needed — file does not exist in repo)

Noticed but not touched (log only):
- PLATFORM_STRATEGY.md metadata line "Status: Authoritative — supersedes scattered references
  in all other briefs" is mildly inconsistent with the new four-doc hierarchy. Not load-bearing;
  consider removing or softening in Session 1b.
- "clients" table name in KINNA-OS schema (PLATFORM_STRATEGY.md) directly contradicts the KINNA
  philosophy — people are kinna, not clients. Consider renaming clients → kinna or another option
  in Session 1b. Requires architecture discussion.
- "### KINNA-OS — Food Pantry/Nonprofit" section subtitle in PLATFORM_STRATEGY.md is now
  inaccurate — the vertical covers pastoral care, financial assistance, clothing, dreams, and more
  beyond food. Consider updating subtitle to "Faith-Based and Direct-Service Nonprofits" or
  similar in Session 1b.

Next session: Session 1b (net-new content + button audit + discovery brief).

### 2026-05-26 — Session 1b: Net-New Content Reconciliation

Completed:
- PART 1: DISCOVERY_MODULE_BRIEF.md created (placeholder; detailed UX, question schema, and full build plan deferred to dedicated session)
- PART 2: Surface Honesty AND Honest Friction principles added to PLATFORM_STRATEGY.md (both names provisional)
- PART 3: BUTTON_AUDIT_DEMO findings folded into TRACE_PLATFORM_AUDIT.md as UI Surface State section
- PART 4: BUTTON_AUDIT_DEMO.md relocated to docs/audits/2026-05-25_BUTTON_AUDIT_DEMO.md as dated artifact
- PART 5: KINNA-OS schema clients → people with rationale note
- PART 6: Domain inventory added to CLAUDE.md infrastructure section
- PART 7: Open Architecture Decisions + Tech Debt Log sections added to CLAUDE.md

Decisions locked:
- KINNA-OS approved by Regina O'Brien on 2026-05-26 (name and definition both)
- KINNA-OS person-record table named `people` (not `clients`, not `kinna`, not `kinna_customer`)
- Surface Honesty principle (provisional name) is in force; existing dead-button states are technical debt
- Honest Friction principle (provisional name) is in force; this session enforced it on itself
- Discovery v0 timing: three weeks from 2026-05-26 (pre-Aug-1), scope is Layers 1+4 plus /admin transcript review
- Discovery brief is a placeholder; dedicated session needed for detailed UX, question bank, build plan beyond v0

Noticed but not touched (log only):
- PLATFORM_STRATEGY.md verticalConfig (Part 5) still has `itemLabel: 'Client'`, `itemLabelPlural: 'Clients'`, and `trialReportFocus: 'clients_served_and_units_distributed'` for kinna-os — these are config strings, not table names; flagged per David's instruction, not changed here
- BUTTON_AUDIT_DEMO.md was untracked in git (never previously committed), so PART 4 used `mv` + `git add` rather than `git mv` — functionally equivalent; noted for the record

Next session: TBD. Likely candidates: task inventory + master list, LAWNS prototype Terry-readiness polish, KINNA-OS Phase 1 scoping, or the dedicated discovery session.

### 2026-05-27 — Brand framing update (doc-only session)

Completed:
- MASTER_BRIEF.md: "TRACE Philosophy" block replaced with "TRACE — Who We Are" (family architecture, built with CAI as craft signature, silent partner philosophy as primary)
- MASTER_BRIEF.md: "What We Are" subsection updated to match new framing
- MASTER_BRIEF.md: PART 1.5 — THE OPERATING MODEL added (Velocity as Evidence, Geographic Freedom, Resilience)
- MASTER_BRIEF.md: Changelog entry added; version bumped to v3
- PLATFORM_STRATEGY.md: Same "TRACE — Who We Are" block synced
- PLATFORM_STRATEGY.md: PART 1 paragraph updated (beachhead now nursery vertical, Built with CAI as craft signature)
- PLATFORM_STRATEGY.md: `### KINNA-OS — Food Pantry/Nonprofit` → `### KINNA-OS — Faith-Based and Direct-Service Nonprofits` (resolves Open Architecture Decision #4)
- DISCOVERY_MODULE_BRIEF.md: Same "TRACE — Who We Are" block synced (replaces the "Inherited from…" placeholder reference)
- CLAUDE.md Open Architecture Decisions: Item #4 resolved and removed; item #7 added (family member sign-off on role descriptions pending)

Decisions locked:
- "TRACE — Who We Are" is the canonical name for the philosophy/identity block across all docs, replacing "TRACE Philosophy"
- Built with CAI is positioned as craft signature, not the company name — TRACE is the company
- Silent partner framing is the primary commercial pitch positioning
- Family architecture (Terrence, Regina, Andrew, Connor, Erin) is in the canonical docs
- KINNA-OS subtitle in PLATFORM_STRATEGY.md is now "Faith-Based and Direct-Service Nonprofits" — decision #4 resolved

Pending:
- Family member personal sign-off on their individual descriptions in "TRACE — Who We Are" before any external publication (tracked as Open Architecture Decision #7)

---

## 4. ACTIVE TASKS

### ✅ DEMO CRITICAL — ALL COMPLETE

- [x] US-001: QR scan → plant profile ✅
- [x] US-002: Growth timeline ✅
- [x] US-003: Quantity selector ✅
- [x] US-004: Netting prompt (red border, pre-checked) ✅
- [x] US-006: Cart review (8.25% tax) ✅
- [x] US-007: Customer capture ✅
- [x] US-008: QB invoice auto-creation ✅
- [x] US-009: Confirmation screen ✅
- [x] US-010: Leakage flag ✅
- [x] US-011: Owner dashboard ✅
- [x] US-012: Leakage alert tile ✅
- [x] Supabase project separation ✅
- [x] Tile system live on device ✅
- [ ] QR codes printed: SCV-0031, NCM-0042, MS30-001
- [ ] Full demo run-through timed under 5 min
- [ ] Mobile tested — all screens

### 🔴 BUILDING THIS WEEK (before meeting)

- [x] Fix QR Checkout tile state bug ✅ (RLS migration May 22)
- [x] Social Media module Steps 1-3 ✅ (wizard, post gen, count badge)
- [x] Social Media Step 4 — Blotato publish flow ✅
- [x] QB token refresh — proactive, never blocks orders ✅ (May 23)
- [ ] Online Shop (/shop page)
- [ ] Customer follow-up engine
- [ ] Delivery routing (after Lauren answers questions)
- [ ] Mobile responsive fix (tile grid desktop only)

### 🟢 POST-DEMO (Phase 1 — after signing)

- [ ] Settings page: Lauren can set default install price at nursery level
      (nurseries.default_install_price column + /settings UI)
      Install price currently hardcoded per plant in seed data at $225
- [ ] Per-plant install price override on plant detail page
      (plants.install_price editable in plant profile UI)
- [ ] Tighten nursery_modules RLS policy — replace
      authenticated_select_nursery_modules with owner_id join:
      EXISTS (SELECT 1 FROM nurseries WHERE id = nursery_id
        AND owner_id = auth.uid())
      Requires: populate nurseries.owner_id first
- [ ] Populate nurseries.owner_id for LAWNS row
      (currently NULL — blocks owner-scoped RLS)
- [ ] Contractor tier management
- [ ] Seasonal perishable module
- [ ] Business insights tile
- [ ] Measure & photo intake
- [ ] configureAuth() vertical wrapper
- [ ] verticalConfig.ts master switch
- [ ] Separate Supabase project for ignition-os
- [ ] SOS amendment filed
- [ ] builtwithcai.com product page live
- [ ] Calendly booking link set up

---

## 5. WHAT'S BUILT — SHARED MODULES

```
packages/shared/src/
  auth/
    configureAuth.tsx    ✅ factory — email + PIN strategies
    index.ts             ✅
  components/
    Button.tsx           ✅
    Card.tsx             ✅
    Badge.tsx            ✅
    LockedOverlay.tsx    ✅
    tiles/
      TileGrid.tsx       ✅ extracted from CAI
      Tile.tsx           ✅ 3 states
  notifications/
    send.ts              ✅
    queue.ts             ✅ sendSilently
    templates/
      cultivar.ts        ✅ order_confirmation
  qr/
    generate.ts          ✅
    print.ts             ✅
  supabase/
    client.ts            ✅
    auth.ts              ✅ (PIN — ignition-os)
    types.ts             ✅
  quickbooks/
    oauth.ts             ✅ (known: IGNITION_OS_DATA hardcoded — browser-side only)
    refresh.ts           ✅ refreshQBToken() — server-side, proactive token refresh
    invoice.ts           ✅
    customer.ts          ✅
```

---

## 6. STRICT CODING GUIDELINES

1. Never edit existing migrations — append only
2. No placeholder code — fully functional or documented
3. UI system:
   - Primary: #27500A (forest green)
   - Background: #EAF3DE (sage)
   - Netting prompt: #A32D2D border, amber bg
   - Buttons: 48px min height, full-width mobile
   - No web fonts, no animations
4. Never hardcode URLs, keys, or localhost
5. Database writes: always handle errors
6. Integration failure never blocks an order
7. Tile grid: desktop/tablet only (768px+)

---

## 7. OFF LIMITS THIS SESSION

- packages/ignition-os/ — DO NOT MODIFY
- packages/shared/src/quickbooks/oauth.ts
  (IGNITION_OS_DATA hardcoding — post-demo fix)
- packages/shared/src/supabase/auth.ts
  (PIN auth — post-demo refactor)
- Old Supabase project ufsgqckbxdtwviqjjtos
  — never reference in cultivar-os code
- Any already-run Supabase migrations
- nursery_modules RLS policy authenticated_select_nursery_modules
  (intentionally loose — allows any authenticated user to read;
  tighten to owner_id join post-demo once nurseries.owner_id
  is populated. See Part 4 post-demo tasks.)

---

## 8. APP PHILOSOPHY

Golden Rule: If it takes more steps than writing on paper,
nursery staff won't use it.

The Regina Rule: Every add-on that can only be applied at
planting time must have urgency copy. The system closes
the gap that cost Regina a 40-minute drive home.

Lauren's ROI: 29 hours/month in manual work eliminated.
$149/month cost. Net benefit: $1,906/month month 1.

---

## 9. END-OF-SESSION PROTOCOL

MANDATORY before ending every session:

1. Update Part 3 (Handoff) in CLAUDE.md
2. Update Part 4 (Active Tasks) — check completed
3. Update Part 7 (Off Limits) — clear old, add current
4. Confirm no hardcoded URLs or keys in new code
5. git add CLAUDE.md
6. git commit -m "Update CLAUDE.md — [date] [what was built]"
7. git push
8. Write 3-sentence plain English summary

---

## 10. SESSION STARTER

Paste this at the start of every Claude Code session:

```
Read CLAUDE.md before we begin.

Current session: [describe task]
Today's goal: [specific deliverable]

Before writing any code confirm:
1. What was completed last session (from Handoff)
2. What shared modules this session needs
3. Those modules exist in packages/shared/src/

Do not start until you confirm all three.
Do not touch ignition-os, old Supabase project,
or QB oauth.ts.
```

---

*TRACE Enterprises · Built with CAI*
*cultivar-os.vercel.app · builtwithcai.com*
*(512) 456-3632 · david@trace-enterprises.com*
*Update this file every session. No exceptions.*
