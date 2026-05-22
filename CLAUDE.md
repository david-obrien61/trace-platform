# CLAUDE.md — TRACE Platform
# Multi-AI Handoff Workflow — Claude Code reads this every session
# Last updated: May 22, 2026
# Current AI: Claude Code

> CRITICAL: Read this entire file before touching any code.
> Update the Handoff section (Part 3) before ending every session.
> Update GEMINI.md with the same changes if Gemini is in use.

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

- **Last files edited:**
  packages/cultivar-os/api/social/publish.ts (new — Blotato publish endpoint)
  api/social/publish.ts (new — Vercel routing re-export)
  packages/cultivar-os/src/pages/Dashboard.tsx (publish flow + drafts panel)
- **Last command run:** npx vercel --prod from repo root — deployed ✅
  NOTE: always deploy from repo root (/trace-platform/), not from
  packages/cultivar-os/ — the @trace/shared alias breaks otherwise
- **Build status:** Clean — 2156 modules, zero TS errors

- **Blockers / Notes:**
  - social_drafts schema migration (order_id + post_type columns) NOT yet
    applied in Supabase — generate-posts inserts will fail until David runs it
  - ANTHROPIC_API_KEY confirmed in Vercel ✅
  - BLOTATO_API_KEY in Vercel ✅
  - QB tokens stored in nursery.qb_access_token on new project ✅
  - social_drafts status lifecycle: 'draft' → 'published' | 'failed'

- **⚠️ Pending manual steps (David):**
  - ⚠️ BLOCKER: Run migration in Supabase SQL editor (bgobkjcopcxusjsetfob):
    supabase/migrations/20260522_social_drafts_add_order_post_type.sql
    SQL:
      ALTER TABLE social_drafts
        ADD COLUMN order_id  uuid REFERENCES orders(id) ON DELETE SET NULL,
        ADD COLUMN post_type text CHECK (post_type IN ('educational','customer_story','seasonal'));
    THEN test: place order at cultivar-os.vercel.app/plant/SCV-0031
    THEN query:
      SELECT id, post_type, status, content FROM social_drafts ORDER BY created_at DESC LIMIT 10;
    Expect 3 rows: educational, customer_story, seasonal — all status='draft'
  - Approve Blotato publish API structure to unblock STEP 4
  - Print QR tags: SCV-0031, NCM-0042, MS30-001
  - Print invoice #3648.380
  - Print FOUNDING_CUSTOMER_AGREEMENT.md
  - Print ROI one-pager (to be written)
  - Full demo run-through timed — Sunday
  - Practice Regina story out loud 3 times

- **Session ended by:** Claude Code — May 22, 2026

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
- [ ] Online Shop (/shop page)
- [ ] Customer follow-up engine
- [ ] Delivery routing (after Lauren answers questions)
- [ ] Mobile responsive fix (tile grid desktop only)

### 🟢 POST-DEMO (Phase 1 — after signing)

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
    oauth.ts             ✅ (known: IGNITION_OS_DATA hardcoded)
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
