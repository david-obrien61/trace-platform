# Runbook: Shared OwnerSignup with PIN Gesture Layer
**Date:** 2026-06-03  
**Type:** Setup and architecture runbook  
**Branch:** multi-tenant-extraction  
**Status:** Complete ✅  

---

## What this session built

A platform-wide shared owner signup component that captures owner info, sets up a PIN, and optionally registers biometric — all in a multi-step vertical-configurable flow.

---

## Files created or modified

### New files

| File | Purpose |
|---|---|
| `packages/shared/src/auth/OwnerSignup.tsx` | Multi-step shared signup component: Owner Info → PIN → Biometric (optional) → vertical steps |
| `supabase/migrations/20260603_business_members_add_pin_hash.sql` | Adds `pin_hash` column to `business_members` in bgobkjcopcxusjsetfob |
| `packages/ignition-os/supabase/migrations/20260603_recreate_shop_members.sql` | Recreates `shop_members` in ufsgqckbxdtwviqjjtos with `pin_hash` + `active` + `email` columns |
| `docs/runbooks/auth-cleanup-orphaned-users-2026-06-03.md` | How to clean up orphaned auth users from failed partial signups |
| `docs/runbooks/shared-signup-with-pin-2026-06-03.md` | This file |

### Modified files

| File | What changed |
|---|---|
| `packages/shared/src/auth/index.ts` | Exports `OwnerSignup`, `OwnerSignupConfig`, `VerticalStep`, `VerticalStepProps` |
| `packages/shared/src/supabase/auth.ts` | Added `authenticateMember()`, `getMemberSession()`, `clearMemberSession()` for business_members PIN auth |
| `packages/cultivar-os/src/pages/SignUp.tsx` | Now uses shared `OwnerSignup` with Cultivar config |
| `packages/cultivar-os/src/pages/Dashboard.tsx` | Profile completion banner (amber) when phone/address null |
| `packages/ignition-os/modules/OnboardingWizard.jsx` | WELCOME + DONE steps retained; SHOP+ACCOUNT+PIN replaced with shared `OwnerSignup` |
| `PLATFORM_STRATEGY.md` | PIN characterization corrected: PIN is platform-wide standard (not Honest Debt) |
| `THOUGHTS.md` | New entry: PIN as Platform Gesture Standard + Partnership Dynamics |

---

## Database migrations to run manually

### Step 1: Cultivar — add pin_hash to business_members (bgobkjcopcxusjsetfob)

1. Open: https://supabase.com/dashboard/project/bgobkjcopcxusjsetfob/sql/new
2. Paste: `supabase/migrations/20260603_business_members_add_pin_hash.sql`
3. Run
4. Verify:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'business_members'
   ORDER BY ordinal_position;
   ```
   Expect `pin_hash` to appear as `text, nullable`.

### Step 2: Ignition — recreate shop_members (ufsgqckbxdtwviqjjtos)

Context: `20260602_ignition_drop_team_tables.sql` dropped `shop_members`. This migration recreates it with the columns OnboardingWizard expects.

1. Open: https://supabase.com/dashboard/project/ufsgqckbxdtwviqjjtos/sql/new
2. Paste: `packages/ignition-os/supabase/migrations/20260603_recreate_shop_members.sql`
3. Run
4. Verify:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'shop_members'
   ORDER BY ordinal_position;
   ```
   Expect columns: `id, shop_id, name, role, phone, email, permissions, pin_hash, active, joined_at, updated_at`.

---

## OwnerSignup config API

```typescript
interface OwnerSignupConfig {
  businessLabel:    string;           // "nursery" | "shop" | "org" — shown in copy
  businessType:     string;           // stored in businesses.business_type
  logo?:            string;           // emoji or image URL
  primaryColor?:    string;           // defaults to '#27500A' TRACE green
  pinLength?:       number;           // defaults to 4
  memberTable:      'business_members' | 'shop_members';
  memberFKColumn:   'business_id' | 'shop_id';
  ownerRole:        string;           // 'OWNER' | 'ADMIN' etc.
  ownerPermissions: string[];
  signInPath:       string;           // '/login' — shown in already-registered error
  collectPhone?:    boolean;          // default true
  collectAddress?:  boolean;          // default true
  collectWebsite?:  boolean;          // default true
  verticalSteps?:   VerticalStep[];   // optional additional steps after biometric
  onSuccess:        (businessId: string, memberId: string) => void;
}
```

**Cultivar config** (in `packages/cultivar-os/src/pages/SignUp.tsx`):
- `memberTable: 'business_members'`, `memberFKColumn: 'business_id'`
- `ownerRole: 'OWNER'`
- `onSuccess`: navigate to /dashboard

**Ignition config** (in `packages/ignition-os/modules/OnboardingWizard.jsx`):
- `memberTable: 'shop_members'`, `memberFKColumn: 'shop_id'`
- `ownerRole: 'ADMIN'`
- `onSuccess`: creates matching shops row (same UUID as businessId), seeds DataBridge, sets step DONE

---

## PIN hash algorithm

Both verticals use the same algorithm:

```
pin_hash = SHA-256("{entity_id}:{pin}")
```

Where `entity_id` is the `business_id` (for `business_members`) or the `shop_id` (for `shop_members`). The entity ID salts the hash so the same PIN at two businesses produces different hashes — prevents cross-tenant collisions.

Implementation: `hashPin(entityId: string, pin: string)` in `packages/shared/src/supabase/auth.ts`.

---

## Retry-aware signup (orphaned user handling)

If `supabase.auth.signUp()` returns "User already registered":
1. Component attempts `signInWithPassword` with the same email/password
2. If signIn succeeds AND no businesses row exists for that `owner_id`: continue with business creation
3. If signIn succeeds AND businesses row already exists: show "account exists, sign in at {signInPath}"
4. If signIn fails (wrong password): show "registered, try signing in at {signInPath}"

This handles the case where trace_ent@outlook.com partially signed up in Ignition — the auth user exists but no businesses row. The retry path completes the signup without error.

---

## Testing protocol

### Test A: Fresh Cultivar signup (new email not used anywhere)

1. Visit cultivar-os.vercel.app/signup
2. Step 1: Enter business name, owner name, email (fresh), password, phone, address
3. Step 2: Enter 4-digit PIN twice
4. Step 3: Skip biometric
5. Verify: navigate to /dashboard, Dashboard loads with LAWNS metrics replaced by new nursery
6. Verify in Supabase bgobkjcopcxusjsetfob:
   - auth.users row exists for email
   - businesses row has owner_id = auth.uid(), name, phone, address
   - business_members row has business_id, user_id, pin_hash (non-null), active=true, role='OWNER'

### Test B: Cultivar PIN daily login (after signup)

1. Open a fresh browser / clear localStorage
2. Visit cultivar-os.vercel.app/login
3. Enter email + password → should work (Supabase email/password login)
4. Note: PIN daily login UI is not yet implemented on the login page — this is a planned follow-up (build a PIN entry screen that calls `authenticateMember()`)

### Test C: Ignition fresh signup

1. Visit ignition-os.vercel.app
2. WELCOME screen → "Get started" → OwnerSignup renders (TRACE green theme, not dark)
3. Step 1: Enter shop name, owner name, email, PIN
4. Complete → onSuccess creates shops row in ufsgqckbxdtwviqjjtos + seeds DataBridge
5. DONE screen appears ("You're in.")
6. Verify in Supabase ufsgqckbxdtwviqjjtos:
   - businesses row exists (owner_id = auth.uid())
   - shops row exists (same UUID as businesses.id)
   - shop_members row exists (pin_hash non-null, active=true, role='ADMIN')
7. Verify DataBridge: `localStorage['IGNITION_OS_DATA']` contains shopId, shopName, current_user

### Test D: Orphaned auth user recovery (trace_ent@outlook.com)

1. Visit cultivar-os.vercel.app/signup
2. Enter trace_ent@outlook.com + the password used in the failed June 3 signup attempt
3. Expected: Component recovers via signIn path, creates businesses + business_members, proceeds to dashboard
4. If password is unknown: component shows "registered, try signing in" message — correct behavior

---

## What's still not done

1. **PIN daily login for Cultivar** — the Login page (`/login`) still uses email/password only. A PIN entry UI needs to be built that calls `authenticateMember(businessId, pin)`. This requires the business_id to be known before login (e.g., from URL or cached from prior session).

2. **Orphaned trace_ent@outlook.com auth users** — see `docs/runbooks/auth-cleanup-orphaned-users-2026-06-03.md` for manual cleanup steps.

3. **Biometric credential storage** — the biometric step in OwnerSignup registers the credential client-side (WebAuthn create) but does not persist the credential ID to the database. A future session should add a `webauthn_credentials` table and store the credential ID + public key post-registration.

---

*Branch: multi-tenant-extraction. Merge to main after David reviews.*
