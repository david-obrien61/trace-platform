# Runbook: Multi-Tenant Extraction Foundation
**Date:** 2026-06-02  
**Branch:** `multi-tenant-extraction`  
**Operator:** Claude Code  
**Status:** Migration files written. Step 2b (Supabase application) is a MANUAL step — David must apply.

---

## What Was Being Done and Why

Ignition OS has working multi-user-per-tenant infrastructure (shop_members, shop_invites, teams, member_devices, pin_resets). Cultivar OS has zero multi-user infrastructure — only a single `owner_id` on the `businesses` table. Lauren Bishop cannot be added to LAWNS without hacking the `businesses.owner_id` field.

This session is Step 1 of a multi-session extraction. The goal: create shared, vertical-agnostic database tables that replace Ignition's PIN-centric tables with email/Supabase-auth-centric equivalents, usable by any vertical.

The fundamental architectural difference being resolved: Ignition staff have no Supabase auth accounts (PIN only). Cultivar members must have real Supabase auth accounts — the CLAUDE.md Auth Architecture locked rule requires `auth.uid()` to be non-null for any vertical handling multi-tenant customer data.

---

## Files Created This Session

| File | Purpose | Target Project |
|---|---|---|
| `supabase/migrations/20260602_shared_members_a_create_tables.sql` | Creates `business_members`, `invitations`, `member_devices` with real RLS | bgobkjcopcxusjsetfob (cultivar-os) |
| `packages/ignition-os/supabase/migrations/20260602_ignition_drop_team_tables.sql` | Drops old Ignition team tables | ufsgqckbxdtwviqjjtos (ignition-os) |
| `docs/runbooks/multi-tenant-extraction-foundation-2026-06-02.md` | This file | — |

---

## Step-by-Step: What Was Done

### Step 0 — CLAUDE.md Step 12 Added

Added new Step 12 (Runbook capture for setup operations) to Part 9 of CLAUDE.md before the Section 10 divider. Edit was applied directly to the file.

**Verify:** Search CLAUDE.md for "Step 12" — should find it in Part 9 between Step 11 and the `---` separator.

---

### Step 1 — Branch Created

```bash
git checkout -b multi-tenant-extraction
```

**Verify:**
```bash
git branch --show-current
# Expected: multi-tenant-extraction
```

---

### Step 2a — Migration Files Written

Two migration files written to disk. Neither has been applied to a live Supabase project yet.

**Verify files exist:**
```bash
ls supabase/migrations/20260602_shared_members_a_create_tables.sql
ls packages/ignition-os/supabase/migrations/20260602_ignition_drop_team_tables.sql
```

---

### Step 2b — MANUAL: Apply Shared Tables Migration (David)

**Target:** bgobkjcopcxusjsetfob (cultivar-os Supabase project)  
**Method:** Supabase SQL editor → paste and run

1. Open: https://supabase.com/dashboard/project/bgobkjcopcxusjsetfob/sql/new
2. Read `supabase/migrations/20260602_shared_members_a_create_tables.sql`
3. Paste the full contents into the SQL editor
4. Click **Run**
5. Expected result: `Success. No rows returned.`
6. Run the verification queries below

**Verification queries (run in SQL editor after migration):**

```sql
-- 1. Tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('business_members', 'invitations', 'member_devices')
ORDER BY table_name;
-- Expected: 3 rows

-- 2. RLS is enabled on all three
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('business_members', 'invitations', 'member_devices');
-- Expected: all three show rowsecurity = true

-- 3. Policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('business_members', 'invitations', 'member_devices')
ORDER BY tablename, policyname;
-- Expected: 5 policies total:
--   business_members: bm_owner_all, bm_self_select, bm_self_update
--   invitations:      inv_owner_all
--   member_devices:   md_owner_all, md_self

-- 4. FK constraint exists
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE constraint_name = 'fk_business_members_invite_id';
-- Expected: 1 row

-- 5. Trigger exists
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_business_members_updated_at';
-- Expected: 1 row

-- 6. invite_id column token default works (sanity check)
SELECT length(encode(gen_random_bytes(32), 'hex')) AS token_length;
-- Expected: 64
```

---

### Step 2c — MANUAL: Drop Ignition Team Tables (David)

**Target:** ufsgqckbxdtwviqjjtos (ignition-os Supabase project)  
**Prerequisite:** Step 2b must complete successfully first.  
**Confirmed:** David confirmed on 2026-06-02 that Ignition team table data is disposable.

1. Open: https://supabase.com/dashboard/project/ufsgqckbxdtwviqjjtos/sql/new
2. Read `packages/ignition-os/supabase/migrations/20260602_ignition_drop_team_tables.sql`
3. Paste the full contents into the SQL editor
4. Click **Run**
5. Run the verification query:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('pin_resets', 'member_devices', 'shop_members', 'shop_invites', 'teams');
-- Expected: 0 rows (all tables dropped)
```

---

## Schema Design Decisions

### 1. Why `business_members` instead of `shop_members`

Ignition's `shop_members` anchors to `shops`. The TRACE shared layer anchors to `businesses`. The rename is semantically correct and prevents confusion when the table is imported by Cultivar (`businesses` is the tenant) vs. Ignition (`shops` is the legacy name).

### 2. Why `invitations` instead of `shop_invites`

Same logic. Vertical-agnostic name. The pattern is the same (single-use token, used flag, business_id), but the name doesn't carry Ignition's vertical context.

### 3. Why no `pin_resets` table in shared

Cultivar uses Supabase email/password auth. PIN reset is Ignition-specific. If Ignition needs PIN reset post-extraction, it belongs in `packages/ignition-os/supabase/migrations/` as a vertical-specific table — not in shared. The CLAUDE.md Auth Architecture rule locks this: auth.uid() must be non-null.

### 4. Why no `teams` table in shared v1

Teams are optional in Ignition (team_id is nullable on shop_members). No vertical has requested teams yet. Adding `teams` now would be premature abstraction. Add when Cultivar or another vertical explicitly needs named sub-groups within a business.

### 5. Why `token` uses `encode(gen_random_bytes(32), 'hex')`

64-char hex string. Unguessable, unique by index. Avoids UUID collision concerns. `gen_random_bytes` is available in all Supabase projects (pgcrypto). Short enough to appear in a URL without encoding issues.

### 6. Why `invitations.expires_at` defaults to 7 days

Ignition had no expiration on tokens — just a `used` flag. For Cultivar's email-based invites, indefinite tokens are a security risk. 7 days is standard practice (Stripe, Vercel, Linear all use 7 days for email invitations). If Lauren doesn't accept in 7 days, the owner sends a new invite. Simple.

### 7. RLS design — why owner-only write, self-only read for members

To avoid recursive RLS evaluation (the "can a member see other members" query would need to query business_members itself, causing recursion), v1 uses a simple split:
- **Owner:** full access to all member rows for their businesses
- **Member:** can SELECT and UPDATE their own row (`user_id = auth.uid()`)
- **Cross-member reads** (e.g., "show me all 3 staff members"): done via Vercel serverless endpoint using service key (bypasses RLS). This is the existing pattern for all writes in Cultivar.

This can be tightened in v2 with a `SECURITY DEFINER` helper function once the member flow is working end-to-end.

### 8. Why `member_devices.business_id` is denormalized

Could be derived via `business_members.business_id`. Denormalized for two reasons: (1) simpler RLS — `business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())` is a clean, indexed lookup without a join through business_members; (2) performance on large member sets. Cost is a second FK that must stay in sync — enforced by CASCADE from businesses.

### 9. Drop order for Ignition tables

Ignition's `shop_members` has FKs to both `shop_invites` (invite_id) and `teams` (team_id). The correct drop order is:
1. `pin_resets` (references shop_members, shops)
2. `member_devices` (references shop_members, shops)
3. `shop_members` (references shop_invites, teams, shops)
4. `shop_invites` (references shops)
5. `teams` (references shops)

Using `CASCADE` on each DROP handles any remaining FK dependencies.

---

## What Failed / Gotchas

### Supabase CLI not available

`supabase` CLI is not in PATH on this machine. All migrations must be applied manually via the Supabase SQL editor. This is the existing practice for all TRACE migrations — not a new constraint.

### Cannot auto-verify migration application

Because there are no Supabase credentials in the repo (they live in Vercel), Claude Code cannot verify that the migration applied cleanly. David must run the verification queries in Step 2b manually.

### Both projects require separate manual steps

The cultivar-os migration (new shared tables) goes to bgobkjcopcxusjsetfob. The Ignition drop migration goes to ufsgqckbxdtwviqjjtos. They are different projects and require separate SQL editor sessions. Do NOT apply the cultivar-os migration to the Ignition project or vice versa.

---

## What to Check Before the Next Prompt

Before continuing to the next session (React components, API endpoints, invite flow):

- [ ] `git branch --show-current` returns `multi-tenant-extraction`
- [ ] `supabase/migrations/20260602_shared_members_a_create_tables.sql` exists
- [ ] Step 2b verification queries all pass in bgobkjcopcxusjsetfob
- [ ] Step 2c verification query returns 0 rows in ufsgqckbxdtwviqjjtos
- [ ] `npm run build:cultivar` still produces zero errors (migration doesn't touch frontend code)

If Step 2b fails with an error:
- Most likely cause: `businesses` table doesn't exist yet or has a different schema than expected. Verify by running `SELECT * FROM businesses LIMIT 1;` first.
- If `gen_random_bytes` is not found: run `CREATE EXTENSION IF NOT EXISTS pgcrypto;` before the migration.
- If the trigger function already exists (e.g., from a prior failed attempt): add `DROP FUNCTION IF EXISTS set_business_members_updated_at() CASCADE;` before the `CREATE OR REPLACE FUNCTION` line.

---

## How to Replicate This From Scratch

If this needs to be done again (different Supabase project, new vertical), the pattern is:

1. Create `supabase/migrations/{date}_shared_members_a_create_tables.sql` with the three table definitions
2. Adjust `businesses` FK to point to the correct table name for the vertical
3. Apply in Supabase SQL editor → run verification queries
4. If dropping old tables from a different project, use `packages/{vertical}/supabase/migrations/{date}_drop_old_team_tables.sql`
5. The RLS pattern (owner_all + self_select + self_update) is the canonical starting point — tighten to `SECURITY DEFINER` cross-member reads in v2

---

*This runbook was produced per CLAUDE.md Part 9, Step 12 (added this session).*
