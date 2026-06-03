# Runbook: Cleanup Orphaned Auth Users
**Date:** 2026-06-03  
**Type:** Manual cleanup runbook  
**Status:** Pending — David must execute manually  

---

## What "orphaned auth user" means

When a signup attempt fails after the Supabase auth user is created but before the businesses/shops rows are written, the result is an orphaned auth user: the email exists in Supabase auth but has no associated data record. Any future signup attempt with the same email hits "User already registered."

The `OwnerSignup` component (built June 3) handles this automatically in most cases by attempting `signInWithPassword` and continuing with business creation. But if the original password is unknown, or if David wants to clean up the auth state manually, the steps below apply.

---

## Known orphaned user as of 2026-06-03

**Email:** trace_ent@outlook.com  
**Created by:** Failed Ignition OS signup attempt on June 3 (shop_members table was missing)  
**Present in:** ufsgqckbxdtwviqjjtos (Ignition Supabase project)  
**Also possibly in:** bgobkjcopcxusjsetfob (Cultivar — second test pass on same email)

---

## Option A: Delete the auth user (quick, for testing)

This frees the email for reuse in testing. Use when you need the email back and don't care about the account.

### In ufsgqckbxdtwviqjjtos (Ignition):

1. Open: https://supabase.com/dashboard/project/ufsgqckbxdtwviqjjtos/auth/users
2. Search for `trace_ent@outlook.com`
3. Click the user row → "Delete user"
4. Confirm deletion

### In bgobkjcopcxusjsetfob (Cultivar — if present):

1. Open: https://supabase.com/dashboard/project/bgobkjcopcxusjsetfob/auth/users
2. Search for `trace_ent@outlook.com`
3. Click the user row → "Delete user"
4. Confirm deletion

**Or via SQL (bgobkjcopcxusjsetfob SQL editor):**
```sql
-- First check: does the user exist?
SELECT id, email, created_at
FROM auth.users
WHERE email = 'trace_ent@outlook.com';

-- If exists and no businesses row: delete
-- (only run if the SELECT above returns a row with no businesses.owner_id match)
DELETE FROM auth.users
WHERE email = 'trace_ent@outlook.com';
```

---

## Option B: Complete the signup (correct path)

If you want to keep the email and finish setting up the account:

1. Visit cultivar-os.vercel.app/signup
2. Enter trace_ent@outlook.com + the original password from the June 3 attempt
3. OwnerSignup will detect "already registered," attempt signIn, find no businesses row, and continue with business creation
4. Complete the signup flow normally

If the original password is not known, Option A (delete) is the right path — then re-register with a fresh account.

---

## Prevention going forward

The OwnerSignup component has retry-aware logic that prevents this from being a user-facing dead end in most cases. The remaining gap is when the original password is unknown.

Future improvement: A `/recover-signup` route that accepts an email, sends a password reset link, and upon reset completion checks for an incomplete signup and offers to resume it. This is a post-demo enhancement.

---

## Using a different email for testing

Until trace_ent@outlook.com is cleaned up, use a different email (e.g., trace_ent+test2@outlook.com, or a Gmail address) for further signup testing.

---

*Related: docs/discovery/onboarding-flow-findings-2026-06-03.md Section 3.6*
