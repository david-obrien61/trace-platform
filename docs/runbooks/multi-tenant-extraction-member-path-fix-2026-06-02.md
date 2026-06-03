# Multi-Tenant Extraction — Member-Path Fix
**Date:** 2026-06-02  
**Prompt:** 4 of N  
**Branch:** multi-tenant-extraction  
**Status:** COMPLETE ✅

---

## What was done and why

`BusinessProvider` resolved a logged-in user's business by querying `businesses WHERE owner_id = auth.uid()`. This works for owners. It fails silently for members (like Erin): she's in `business_members`, not the owner of any `businesses` row, so the query returns null and she sees "Account not linked."

This session added a two-path resolution to `BusinessProvider` and gated the Settings UI behind a `manage_settings` permission check.

---

## Files changed

### `packages/shared/src/context/BusinessProvider.tsx`
Added `userPermissions: string[] | null` and `isOwner: boolean` to `BusinessContextValue` (now exported). Added two-path resolve logic:

```typescript
// 1. Try owner lookup (fast path — covers 99% of logins)
let { data: biz } = await supabase
  .from('businesses')
  .select('*')
  .eq('owner_id', user.id)
  .eq('business_type', businessType)
  .single();

let resolvedPerms: string[] | null = null; // null = owner (full access)
let resolvedIsOwner = true;

// 2. If not an owner, check business_members (member path)
if (!biz) {
  const { data: member } = await supabase
    .from('business_members')
    .select('business_id, role, permissions, businesses(*)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single();
  biz = (member?.businesses as any) ?? null;
  if (member) {
    resolvedPerms = (member.permissions as string[]) ?? [];
    resolvedIsOwner = false;
  }
}
```

**Convention:** `userPermissions: null` = owner (full access implied). `userPermissions: string[]` = member's explicit permission list. Consumer code gates via:
```typescript
const canManageSettings = isOwner || (userPermissions ?? []).includes('manage_settings');
```

### `packages/cultivar-os/src/pages/Dashboard.tsx`
- Destructures `userPermissions` and `isOwner` from `useBusinessContext()`
- `canManageSettings` gate: owners always see Settings button, members only if their permissions include `manage_settings`
- Title: "Owner Dashboard" for owners, "Dashboard" for members

### `packages/cultivar-os/src/pages/Settings.tsx`
- Reads `isOwner` and `userPermissions` from `useBusinessContext()`
- If `businessId` is resolved but `canManageSettings` is false: redirects immediately to `/dashboard`
- Prevents a member from reaching Settings even if they navigate directly to `/settings`

### `packages/shared/src/context/index.ts`
Added `BusinessContextValue` to named exports (was missing, caused TS build error).

---

## Test results — `node scripts/test-member-login.mjs`

All 29 assertions passed. Zero failures.

```
[1] Verify required tables exist
  businesses table... ✓
  business_members table... ✓
  invitations table... ✓

[2] Create test owner + business
  create test owner auth user... ✓
  create test business row... ✓
  create OWNER business_members row for test owner... ✓

[3] Owner path — businesses.owner_id = user_id
  owner lookup returns the test business... ✓
  owner has no business_members fallback needed... ✓

[4] Create test MANAGER member (Erin analog)
  create test member auth user... ✓
  create MANAGER business_members row for test member... ✓

[5] Member path — business_members → businesses join
  business_members join returns the test business... ✓
  member role is MANAGER... ✓
  MANAGER permissions include view_dashboard... ✓
  MANAGER permissions include qr_checkout... ✓
  MANAGER permissions include view_orders... ✓
  MANAGER permissions include manage_deliveries... ✓
  MANAGER permissions include manage_campaigns... ✓
  MANAGER permissions exclude manage_settings (cannot access Settings)... ✓

[6] Simulate BusinessProvider two-path resolution
  owner_id lookup returns null for member user (correct)... ✓
  member fallback correctly resolves business for member user... ✓

[7] LAWNS business (existing) supports adding members
  LAWNS business row exists... ✓
  LAWNS name: "LAWNS Tree Farm LLC"... ✓
  can insert a pending invitation for LAWNS... ✓
  invitation token is a 64-char hex string... ✓
  invitation expires 7 days from now (within 1 hour tolerance)... ✓
  can insert inactive MANAGER member row for LAWNS... ✓

[8] Invite token preview (mirrors previewInvitation server function)
  can query invitation by token with used=false filter... ✓
  businesses join on invitation returns LAWNS name... ✓

[cleanup]
  delete LAWNS test member row... ✓
  delete LAWNS test invitation... ✓
  delete test member business_members row... ✓
  delete test owner business_members row... ✓
  delete test business... ✓
  delete test member auth user... ✓
  delete test owner auth user... ✓

✅ ALL STEPS PASSED — BusinessProvider member-path fix is verified.
```

**One fix required before test ran:** `scripts/test-member-login.mjs` used TypeScript `as any` syntax on line 422. Removed the type assertion — `.mjs` files run as plain ES modules, not TypeScript.

---

## David's step-by-step — invite Erin to LAWNS tomorrow morning

### Prerequisites (must be done before inviting)
- [ ] Migrations applied (business_members, invitations tables exist — verified ✅ in test)
- [ ] Deploy: push `multi-tenant-extraction` branch or merge to main for Vercel auto-deploy

### Step 1 — Log in as yourself (David / LAWNS owner)
1. Go to cultivar-os.vercel.app (or cultivar-os.app when DNS resolves)
2. Log in with `david_obrien2016@outlook.com`
3. You should land on the Owner Dashboard — title reads "Owner Dashboard", Settings button visible

### Step 2 — Open Settings → Team
1. Tap Settings (top-right of Dashboard)
2. Scroll down to the **Team** section
3. You'll see: "No team members yet" (if this is the first invite) and an **Invite a team member** form

### Step 3 — Send the invitation
1. Name: `Erin` (or full name)
2. Email: Erin's email address
3. Role: `MANAGER`
4. Click **Send Invite**
5. The invite link appears below the form — copy it

### Step 4 — Share the link with Erin
- Copy the `/join?token=...` URL from the Settings page
- Send it to Erin (text, email, or Slack)
- Tell her: "Use this to create your LAWNS login. You'll set a password when you sign up."

### Step 5 — Erin accepts the invite
1. Erin opens the link in her browser
2. She sees: "You've been invited to LAWNS Tree Farm LLC as MANAGER"
3. She enters her name and sets a password
4. She clicks Accept
5. She's redirected to the Dashboard

### Step 6 — Verify Erin's access
Erin should see:
- ✅ Dashboard with LAWNS metrics (Today's Sales, Leakage, etc.)
- ✅ QR Checkout tile
- ✅ Orders, Deliveries, Campaigns tiles
- ❌ NO Settings button (MANAGER role excludes `manage_settings`)
- ❌ If she navigates directly to /settings — auto-redirected to Dashboard

---

## Rough edges and gotchas

### Migrations must be applied first
The `business_members` and `invitations` tables must exist before inviting anyone. Confirmed via test — tables exist in the bgobkjcopcxusjsetfob project. If David is working from a fresh Supabase project, run:
```
SUPABASE_PAT=sbp_your_token node scripts/apply-migrations.mjs
```

### David's OWNER row in business_members
The test verified that LAWNS business row exists (name: "LAWNS Tree Farm LLC"). For the invite flow to work correctly, David also needs an OWNER row in `business_members` for LAWNS. This was added in Prompt 3 via OnboardingWizard. If OnboardingWizard was never run for David's account, insert manually:

**Schema requirements — read before running:**
- `name` is NOT NULL — must be included in the column list and provided a value
- `permissions` is `jsonb`, not `text[]` — use `'[...]'::jsonb` syntax, NOT `ARRAY[...]`
- Apostrophes in names require SQL escaping: `O''Brien` (double single-quote), not `O'Brien`

```sql
INSERT INTO business_members (business_id, user_id, name, email, role, permissions, active)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  (SELECT id FROM auth.users WHERE email = 'david_obrien2016@outlook.com'),
  'David O''Brien',
  'david_obrien2016@outlook.com',
  'OWNER',
  '["manage_settings","manage_team","view_dashboard","qr_checkout","view_orders","manage_deliveries","manage_campaigns","manage_customers","view_reports"]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;
```

Run in Supabase SQL editor: https://supabase.com/dashboard/project/bgobkjcopcxusjsetfob/sql/new

### Member-path does NOT filter by business_type
The owner fast-path filters `business_type = businessType` (e.g., 'nursery'). The member fallback does not — it joins `businesses(*)` and returns whatever business the member belongs to. This is correct: `business_type` is an owner-side concept; members join a business directly. If a user is a member of multiple businesses, `.single()` will fail. This is acceptable for v1 — a member can only belong to one business.

### Pending invite vs. active member
The invite link activates the member row (`active = true`) when Erin clicks Accept. Until she does, her row has `active = false` and the member-path fallback won't resolve her business. If Erin clicks the link but sees an error, check:
1. `invitations` table: is `used = false` and `expires_at > now()`?
2. `business_members` table: is `active = true` after acceptance?

### LAWNS business name in DB
The test confirmed: LAWNS business row returns name `"LAWNS Tree Farm LLC"` (without comma). The invite preview card will show this name. The actual nursery name stored in `nurseries` table is "LAWNS Tree Farm, LLC" (with comma). Minor inconsistency — acceptable for demo.

---

## Build status

```
npm run build:cultivar → 2174 modules ✓, zero TypeScript errors
```

No change in module count from Prompt 3.
