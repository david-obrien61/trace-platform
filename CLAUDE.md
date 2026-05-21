# CLAUDE.md — TRACE Platform
# Multi-AI Handoff Workflow — Claude Code reads this every session
# Last updated: May 21, 2026 (Session 3)
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

**THE PLATFORM RULE:**
TRACE builds once and deploys everywhere. Every shortcut that
duplicates shared code costs double the work on the next vertical.
Enforce the shared-first rule on every line you write.

---

## 2. STATUS & ARCHITECTURE

- **Current phase:** Phase 0 — Cultivar OS demo prep (May 25 deadline)
- **Active vertical:** cultivar-os
- **Demo deadline:** ~May 25, 2026 — LAWNS Tree Farm LLC, Leander TX
- **Tech stack:** React + Vite + TypeScript · Supabase · FastAPI ·
  Vercel · Stripe · QuickBooks Online API
- **Source of truth:** Supabase PostgreSQL — never localStorage
- **Local state:** Zustand — scratchpad only, never source of truth
- **Repo:** github.com/david-obrien61/trace-platform (private)
- **Frontend deploy:** Vercel → cultivar-os.app
- **Backend deploy:** Railway → FastAPI

### Monorepo Structure

```
trace-platform/
├── PLATFORM_STRATEGY.md     ← read for full architecture
├── CLAUDE.md                ← this file
├── MASTER_BRIEF.md          ← company vision, team, revenue model
├── CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md  ← build sessions
├── CULTIVAR_OS_USER_STORIES_AND_DEMO.md ← acceptance criteria
├── packages/
│   ├── shared/              ← NEVER vertical-specific code here
│   │   └── src/
│   │       ├── supabase/    ← client, auth, types
│   │       ├── quickbooks/  ← oauth, invoice, customer
│   │       ├── stripe/      ← billing, trial
│   │       ├── notifications/ ← sms, email, templates
│   │       ├── qr/          ← generate, print
│   │       ├── pricing/     ← marginEngine (post-demo)
│   │       ├── components/  ← Button, Card, Badge, LockedOverlay
│   │       ├── onboarding/  ← shared shell (post-demo)
│   │       └── config/
│   │           └── verticalConfig.ts  ← THE MASTER SWITCH
│   ├── ignition-os/         ← DO NOT MODIFY without flagging
│   ├── cultivar-os/         ← ACTIVE BUILD
│   ├── conduit-os/          ← not started
│   ├── pantry-os/           ← not started
│   └── coolrunnings/        ← not started
```

### Auth Pattern

```
cultivar-os:  email/password → Supabase Auth
              roles: owner | manager | staff
              configureAuth({ vertical: 'cultivar-os', ... })
              DO NOT rebuild login — configure shared auth

ignition-os:  PIN-based → SHA-256 hash
              roles: owner | service_writer | tech
              DO NOT touch — dry run in progress
```

### Supabase Projects (SEPARATED May 21, 2026)

| Project | Ref ID | Used by |
|---|---|---|
| cultivar-os | bgobkjcopcxusjsetfob | cultivar-os ONLY |
| ignition-os | ufsgqckbxdtwviqjjtos | ignition-os ONLY |

cultivar-os URL: https://bgobkjcopcxusjsetfob.supabase.co
These are NEVER to be swapped or cross-referenced.

### Key Design Decisions (LOCKED — never reverse without flagging)

1. Supabase is source of truth — never localStorage as primary
2. TypeScript for all new shared modules
3. Integration failure never blocks an order
4. Netting prompt is pre-checked — opt-out not opt-in
5. Seasonal module windows are all configurable — nothing hardcoded
6. QB is RECOMMENDED not REQUIRED — app works without it
7. Per-plant unique asset model — trees are individuals, not stock qty
8. Each vertical has its OWN Supabase project — never share projects

---

## 3. HANDOFF

> Rewritten at the end of every session.
> The next Claude Code session reads this first.
> ALSO update GEMINI.md with the same content.

- **Completed this session (Session 3):** Supabase project separation.

  - SUPABASE SEPARATION (May 21, 2026):
    Cultivar OS now has its own dedicated Supabase project, completely
    separate from ignition-os. Old shared project ref: ufsgqckbxdtwviqjjtos.
    New cultivar-os project ref: bgobkjcopcxusjsetfob.
    New URL: https://bgobkjcopcxusjsetfob.supabase.co

  - SCHEMA CREATED (new project):
    10 tables: nurseries, plants, plant_events, customers, orders,
    order_items, order_addons, addons, losses, social_drafts.
    14 RLS policies. 16 indexes. All FK relationships intact.
    Updated_at trigger on plants. Clean customers table (no shop_id).
    owner_id column on nurseries (references auth.users, currently NULL).

  - SEED DATA LOADED:
    LAWNS Tree Farm LLC — nursery_id: a1b2c3d4-0000-0000-0000-000000000001
    10 plants (all status='available'): SCV-0031, NCM-0042, MS30-001,
    TLO-008, RED-011, BCA-015, TML-003, HMQ-009, AOT-022, CEL-028.
    SCV-0031 has 4 container progressions (demo timeline requirement met).
    4 addons: Netting (transport=self, pre_selected), Compost, Bio-Starter,
    5-Year Warranty (all always-shown, sort_order 0–3).
    Inventory value: $3,040 (10 plants × avg $304).

  - ENV VARS UPDATED:
    packages/cultivar-os/.env.local — all 4 Supabase keys updated.
    Vercel Production + Development — VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY, SUPABASE_URL all updated to new project.
    NOTE: Vercel Preview env vars need manual update in Vercel dashboard
    (CLI v54 requires interactive terminal for preview branch selection).

  - DEPLOYED:
    Build: 428 modules, 2.59s. Deployed: cultivar-os.vercel.app.
    Alias: cultivar-os.vercel.app → new project confirmed live.

  - TESTS PASSED:
    ✅ cultivar-os.vercel.app returns HTTP 200
    ✅ /plant/SCV-0031 route returns HTTP 200
    ✅ SCV-0031 data confirmed in new Supabase (30 gal, $400, available)
    ✅ SCV-0031 has exactly 4 growth timeline events
    ✅ All 4 addons loaded correctly (netting pre_selected=true)
    ✅ /api/qbo/status returns {connected:false} — expected (QB not yet re-linked)
    ✅ ignition-os package: zero references to either Supabase project URL
    ⚠️  Dashboard inventory value: $3,040 (10 plants). User expected $7,136.
        If $7,136 is required for demo, plant prices need adjustment in Supabase.

- **Next task:** QR code generation for SCV-0031, NCM-0042, MS30-001.
  Re-connect QuickBooks to new Supabase project (go to /dashboard → Connect QB).
  Create layna@lawnstrees.com in NEW Supabase project Auth dashboard.
  Set nurseries.owner_id to Layna's new UUID.
  Verify US-003 through US-007 checkout flow on phone.
  Full demo run-through under 4 minutes.

- **Last file edited:** CLAUDE.md (handoff + Supabase project separation docs)

- **Last command run:** npx vercel --prod (from repo root) — success, 428 modules

- **Tests passing:** Not yet configured

- **Blockers / Notes:**
  - QB must be re-connected on new Supabase project before demo day.
    Old tokens are in ignition-os project — they cannot be used here.
    Go to cultivar-os.vercel.app/login → login as Layna → Connect QuickBooks.
  - layna@lawnstrees.com must be created in the NEW Supabase project Auth dashboard.
    (Supabase dashboard → bgobkjcopcxusjsetfob → Authentication → Users → Add user)
    After creating, run: UPDATE nurseries SET owner_id = '<UUID>'
    WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';
  - Vercel Preview env vars not updated via CLI (interactive prompt required).
    Fix: Vercel dashboard → cultivar-os project → Settings → Environment Variables →
    add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL
    for Preview environment. Low priority — prod deployments are unaffected.
  - Railway not linked (railway login expired). FastAPI backend not active.
    VITE_API_URL is empty — the checkout and dashboard run entirely on
    Supabase + Vercel functions, so Railway is not blocking the demo.
    When Railway is needed: railway login → railway link → set SUPABASE_URL
    and SUPABASE_SERVICE_KEY to new values.
  - Inventory value discrepancy: user expected $7,136, seed data totals $3,040.
    If demo requires $7,136, adjust base_price on plants in Supabase SQL editor.
  - QB /invoice/cultivar uses tax-as-line-item (no TaxCode setup required).
    This is intentional for sandbox demo.
  - packages/cultivar-os/src/lib/shared/ still contains dead code (QB + auth).
    Leave alone until post-demo.

- **⚠️ Pending manual steps:**
  - Create layna@lawnstrees.com in NEW Supabase project Auth dashboard
    (project: bgobkjcopcxusjsetfob) — do NOT do this in SQL
  - David must run QB OAuth flow from dashboard before demo day:
    go to /dashboard → Connect QuickBooks → approve in Intuit popup
  - VITE_API_URL must be set in Vercel environment variables
    pointing to the Railway FastAPI deployment URL
  - cultivar-os.app DNS must point to Vercel deployment
  - Verify SCV-0031 row exists in Supabase with correct plant_events

- **Session ended by:** Claude Code — May 20, 2026

---

## 4. ACTIVE TASKS

### 🔴 DEMO CRITICAL — must work by May 25

- [x] US-001: QR scan → plant profile — route, hero, timeline, qty, offline cache DONE.
      SCV-0031 confirmed in new Supabase project (bgobkjcopcxusjsetfob). ✅
- [x] US-002: Growth timeline — PlantTimeline done. SCV-0031 has 4 events confirmed. ✅
- [ ] US-003: Quantity selector
- [ ] US-004: Netting prompt (red border, pre-checked, self-transport)
- [ ] US-006: Cart review (correct tax math — 8.25%)
- [ ] US-007: Customer capture (name, email required)
- [x] US-008: QB invoice auto-creation (sandbox) — DONE May 20.
      POST /api/qbo/invoice/cultivar built. Finds/creates QB customer,
      builds line items from Supabase order, pushes to sandbox, stores IDs.
- [x] US-009: Confirmation screen — DONE (was already complete).
      Shows invoice sent to email, QB link, fallback if QB not connected.
- [x] US-010: Leakage flag — DONE (was already correct in useSubmitOrder).
- [x] US-011: Owner dashboard — DONE May 20 (session 2).
      Plants tracked, inventory value, today's sales, installs this week.
      All queries direct to Supabase. Auth via configureAuth email strategy.
- [x] US-012: Leakage alert tile — DONE May 20 (session 2).
      Full-width amber tile (count > 0) or green tile (count = 0).
      Shows estimated missed revenue at $28/tree.
- [ ] QR codes generated and printed: SCV-0031, NCM-0042, MS30-001
- [ ] Full demo run-through under 4 minutes
- [ ] Mobile tested on iPhone

### 🟡 COMPLIANCE FIXES — in progress

- [x] Group 1: Swap local duplicates → @trace/shared imports
      (violations 1, 2, 8, 9, 10) — DONE May 20. Remaining 3 files in lib/shared
      are dead code + off limits (QB + auth). Nothing active imports them.
- [x] Group 2: Wire sendNotification() from shared
      (violations 4, 5, 6, 7) — DONE May 20
- [x] Group 3: Create missing shared modules
      (qr, components, supabase/types) — DONE May 20
- [x] Group 4: configureAuth() factory — DONE May 20 (session 2).
      packages/shared/src/auth/configureAuth.tsx. Supports 'email' and 'pin'
      strategies. Cultivar-os wired with email strategy.

### 🟢 POST-DEMO (Phase 1 — after May 25)

- [ ] verticalConfig.ts — the master switch
- [ ] configureAuth() — unified auth wrapper, both patterns
- [ ] QB refactor into QuickBooksAdapter (integration layer)
- [ ] Sized add-on engine (accessories sized to container)
- [ ] Post-sale service engine (configurable triggers)
- [ ] Seasonal perishable module (14-day clock, configurable windows)
- [ ] Business insights tile
- [ ] Onboarding flow (shared shell + vertical question sets)
- [ ] SOS amendment filed (technology/software services)

---

## 5. STRICT CODING GUIDELINES

1. **Never edit existing migrations** — append new SQL only
2. **No placeholder code** — fully functional or documented as mock
3. **UI system:**
   - Primary: deep forest green (#27500A)
   - Background: light sage (#EAF3DE)
   - Cards: white
   - Netting prompt: red border (#A32D2D), amber background
   - Buttons: full-width mobile, 48px min height
   - Typography: system-ui — no web fonts (slow on mobile)
   - No animations — fast render over motion
4. **Environment variables** — never hardcode URLs, keys, or localhost
5. **Database writes** — always handle errors, show user-facing state,
   never silently swallow failures
6. **No backwards-compat shims** — delete old version when replaced
7. **New migrations** — include DROP TRIGGER/POLICY IF EXISTS guards

---

## 6. APP PHILOSOPHY

**Golden Rule:** If it takes more steps than writing on paper,
nursery staff won't use it.

- QR scan must work on any phone — no app download required
- Netting must be unmissable — red border, pre-checked, can't scroll past
- Checkout must complete in under 2 minutes on mobile
- Dashboard must load in under 3 seconds
- Works offline after first plant profile load (cached)
- Integration failure (QB down) never blocks a sale

**The Regina Rule:**
Every add-on that can only be applied at planting time must have
urgency copy: "Goes in the hole — cannot add after planting."
The system closes the gap that cost Regina a 40-minute drive.

---

## 7. OFF LIMITS THIS SESSION

Update this at the start of each session with what's currently
being worked on. Clear it at the end of each session.

- packages/ignition-os/ — DO NOT MODIFY (dry run active)
- packages/shared/src/supabase/auth.ts — DO NOT MODIFY until
  configureAuth() wrapper is designed (post-demo)
- packages/shared/src/quickbooks/oauth.ts — DO NOT MODIFY until
  post-demo refactor (IGNITION_OS_DATA hardcoding — known issue)
- packages/cultivar-os/src/lib/shared/supabase/auth.ts — DO NOT MODIFY,
  same reason as above
- packages/cultivar-os/src/lib/shared/quickbooks/ — DO NOT MODIFY,
  same reason as above
- Any already-run Supabase migrations — append only

Session cleared. Next session: QR code generation (SCV-0031, NCM-0042, MS30-001),
verify checkout flow US-003 through US-007 on phone, full demo run-through.

---

## 8. COMPLIANCE GUARDRAILS

**PII we store:** Customer name, phone, email, address only.
**Where:** ONLY in designated Supabase tables with RLS enabled.
**Never:** localStorage for PII, raw PII to external LLMs,
           public storage buckets for customer data.
**Audit:** Log every bulk data access or export.
**Multi-tenant:** Every query must be scoped to nursery_id.
                  Every table must have RLS enabled.
                  No cross-tenant data leakage is acceptable.

---

## 9. KEY DATA — DEMO

| Item | Value |
|---|---|
| Demo URL | cultivar-os.app/plant/SCV-0031 |
| Demo plant | Shoal Creek Vitex — 30 gal — $400 |
| Demo nursery | LAWNS Tree Farm LLC |
| Nursery ID | a1b2c3d4-0000-0000-0000-000000000001 |
| Owner login | layna@lawnstrees.com |
| Netting price | $10/tree ($20 for 2) |
| Tax rate | 8.25% (Texas) |
| Invoice on hand | #3648.380 — $920.13 PAID |
| Meeting date | ~May 25, 2026 |
| Target close | $149/mo founding rate — locked forever |

---

## 10. DEFINITION OF DONE — DEMO

The demo is ready when ALL of these pass on a real phone
on the live URL (not localhost):

- [ ] cultivar-os.app/plant/SCV-0031 loads in < 3 seconds
- [ ] Growth timeline shows 4 container progressions
- [ ] Transport toggle shows netting when self-transport selected
- [ ] Netting is pre-checked with red border
- [ ] Cart math is correct: subtotal + (subtotal × 0.0825) = total
- [ ] Customer email is required — form won't submit without it
- [ ] QB invoice appears within 5 seconds of checkout submit
- [ ] Invoice line items match cart exactly
- [ ] Layna can log in and see dashboard
- [ ] Dashboard shows leakage alert
- [ ] Full flow timed under 4 minutes
- [ ] Tested on iPhone — no layout breaks

---

## 11. END-OF-SESSION PROTOCOL

Run this checklist before ending every session:

1. Update Part 3 (Handoff) in THIS file — CLAUDE.md
2. Update GEMINI.md with the same handoff content
3. Update Part 4 (Active Tasks) — check off completed items
4. Update Part 7 (Off Limits) — clear old, add current
5. Check .env.example is current if new variables were added
6. Confirm no hardcoded URLs, keys, or localhost in new code
7. Confirm no placeholder or mock code left undocumented
8. git add . && git commit -m "description of what was built"
9. git push
10. Write a plain English summary of the session

---

## 12. HOW TO START THE NEXT SESSION

Paste this at the start of every Claude Code session:

```
Read CLAUDE.md before we begin.
Read PLATFORM_STRATEGY.md for architecture context.

Current session: [SESSION NUMBER]
Today's goal: [specific deliverable from Active Tasks]

Confirm you have read both files and state:
1. What was completed last session (from Handoff)
2. What we are building today
3. Which shared modules this session will use
4. Confirm those modules exist before writing any code

Do not start coding until you have confirmed #3 and #4.
```

---

*TRACE Enterprises · Built with CAI*
*trace-platform · cultivar-os.app · builtwithcai.com*
*This file is the memory of the build.*
*Update it every session. Every time. No exceptions.*
