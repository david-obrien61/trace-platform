# Team Member Management Audit
**Date:** 2026-06-01
**Author:** Claude Code audit
**Status:** Read-only. No code changed.
**Context:** David tried to add Erin as a demo user under the LAWNS business in Cultivar and could not find a way to do it through the UI. This audit determines exactly what exists, what's missing, and what would be needed to build a working invitation flow.

---

## Section 1: Existing Team/Member Infrastructure

**Verdict: None exists. The feature does not exist at any layer.**

### Database (Supabase migrations)

All migrations in `supabase/migrations/` were searched for: `business_member`, `invitation`, `invite`, `team_member`, `employee`, `role`, `ADMIN`, `MEMBER`, `OWNER`.

**Zero results.** No `business_members` table. No `invitations` table. No role enum. No invitation token column on any table. The businesses table (created in `supabase/migrations/20260529_businesses_a_create_tables.sql`) has a single `owner_id uuid NOT NULL REFERENCES auth.users(id)` — one owner per business, enforced at the column level.

### Frontend

Search across `packages/cultivar-os/` and `packages/shared/` for all the same terms:

**Zero results in cultivar-os/** (excluding compiled dist/ and node_modules). No team member UI, no invite button, no role-based display, no invitation acceptance page.

**In packages/shared/**: The matches that appeared in the search were for unrelated uses — "role" in `configureAuth.tsx` refers to Ignition's PIN role model (Ignition-specific, not multi-user), "role" in `discovery/synthesis.ts` refers to Claude's system role. No team/member infrastructure in shared.

### API layer

`packages/cultivar-os/api/` contains: `campaigns/`, `dashboard.ts`, `discovery/`, `orders/`, `qbo/`, `services/`, `social/`.

No `team/`, `members/`, `invite/`, or `invitation/` directory or file exists.

### Summary table

| Layer | Exists? | Notes |
|---|---|---|
| `business_members` table | ❌ | Not in any migration |
| `invitations` table | ❌ | Not in any migration |
| Role column on any table | ❌ | No role concept anywhere |
| Team UI in Settings | ❌ | Settings has no team section |
| Invite API endpoint | ❌ | No endpoint exists |
| Accept-invite page/route | ❌ | Not in router.tsx |
| RLS policies for member access | ❌ | All policies use `owner_id = auth.uid()` only |

---

## Section 2: Current Signup Flow

### What happens step by step

1. **Auth account created:** User enters email + password at `/signup` → Supabase creates auth account → email confirmation is OFF (CLAUDE.md) → user is immediately authenticated

2. **Redirect to dashboard:** Post-signup currently lands on dashboard. Dashboard checks for a businesses row; if none found, `Dashboard.tsx` redirects to `/onboarding`.

3. **OnboardingWizard.finalize() runs:**
   - `supabase.auth.getUser()` → gets `user.id`
   - Generates `newBusinessId = crypto.randomUUID()`
   - Inserts into `businesses`: `{ id: newBusinessId, owner_id: user.id, name, phone, address, business_type: 'nursery', trial_started_at: now() }`
   - Inserts into `nursery_profiles`: `{ business_id: newBusinessId }`
   - Navigates to DONE step, then to `/dashboard`

4. **No `business_member` row created.** The only link between the user and the business is the `owner_id` column on the businesses row. There is no secondary membership table.

5. **BusinessProvider resolves the business:**
   ```typescript
   supabase.from('businesses')
     .select('*')
     .eq('owner_id', user.id)
     .eq('business_type', businessType)
     .single()
   ```
   This query uses `owner_id = auth.uid()`. Erin's `auth.uid()` is not LAWNS's `owner_id`. The query returns no rows. Erin sees the `businessError: 'no_business'` error state — the same error a brand-new user sees before running the wizard. She cannot access LAWNS data at all.

### Is the signup flow one-business-per-user or multi-user?

**Strictly one-business-per-user.** The `BusinessProvider` uses `.single()` — it expects exactly one businesses row matching `owner_id = auth.uid()`. If Erin signs up, she gets her own empty businesses row (or is redirected to the wizard to create one). She has no path to access David's LAWNS row. The signup flow has no concept of "join an existing business."

The RLS policy on businesses (`owner_id = auth.uid()`) enforces this at the database level — even with a direct Supabase query, Erin's auth token cannot read David's businesses row.

---

## Section 3: Settings Page

`packages/cultivar-os/src/pages/Settings.tsx` is a thin wrapper (117 lines) that imports `Settings as SharedSettings` from `@trace/shared/pages/Settings` and renders it with props:
- `onBack` → navigate to /dashboard
- `accountingConnectUrl` → /api/qbo/auth-url?business_id=X
- `verticalSection` → NurserySection component (default install price)

`packages/shared/src/pages/Settings.tsx` (726 lines) renders four sections:

| Section | What it contains |
|---|---|
| **Business Profile** | Name, phone, address, email, website, tax rate + "Save Profile" button |
| **Accounting** | Connect/Reconnect QuickBooks link; shows connected state |
| **Services** | Service offerings list (transport, add-ons, other); add/edit/toggle/delete; customer match AI |
| **Nursery Settings** (vertical) | Default install price field + save |

**No team member section. No invite button. No user management of any kind. No hidden or feature-flagged team section in the codebase.**

The Settings page was searched with `grep -n "invitation\|invite\|member\|role\|team"` — zero matches in either file.

---

## Section 4: API Endpoints for Invitations

The full `packages/cultivar-os/api/` directory tree:

```
api/
  campaigns/
  dashboard.ts
  discovery/
  orders/
  qbo/
    auth-url.ts
    callback.ts
    invoice/
      cultivar.ts
    status.ts
  services/
    customer-match.ts
  social/
    enable.ts
    generate-posts.ts
    publish.ts
```

**No invitation-related endpoint exists at any path.** There is no `team/`, `invite/`, `members/`, or `accept` handler anywhere in the API layer.

---

## Section 5: Minimum Viable Invitation Flow

The feature required: "David adds Erin's email to LAWNS, Erin gets an invitation link, Erin clicks it, creates her account, lands in LAWNS' Cultivar instance as a MEMBER."

### Database changes required

**New table: `business_members`**

```sql
CREATE TABLE business_members (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id              uuid REFERENCES auth.users(id),          -- null until accepted
  email                text NOT NULL,
  role                 text NOT NULL DEFAULT 'member'            -- 'owner', 'admin', 'member'
                         CHECK (role IN ('owner', 'admin', 'member')),
  invited_by           uuid NOT NULL REFERENCES auth.users(id),
  invitation_token     text UNIQUE,                              -- null after accepted
  invitation_expires_at timestamptz,
  joined_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, email)
);
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
```

**RLS policies needed:**
- Members can SELECT their own membership rows
- Business owner can SELECT/INSERT/DELETE members on their business
- Invitation accept endpoint uses service key (bypasses RLS to match token + set user_id)

**BusinessProvider must be updated** to also query `business_members` for the current user — a member user needs to resolve to the LAWNS business even though `owner_id ≠ auth.uid()`. The query becomes:

```typescript
// First try: are you the owner?
const { data: owned } = await supabase.from('businesses')
  .select('*').eq('owner_id', user.id).eq('business_type', businessType).single();

// Second try: are you a member?
if (!owned) {
  const { data: membership } = await supabase.from('business_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .single();
  if (membership) {
    const { data: business } = await supabase.from('businesses')
      .select('*').eq('id', membership.business_id).single();
    // Note: requires RLS to allow member to read their business's row
  }
}
```

### New UI components required

**In `packages/shared/src/pages/Settings.tsx`:**
- New `TeamSection` component (or add a new `SectionCard` block)
  - List current members (name/email, role chip, Remove button)
  - "Invite a team member" form: email input + Role dropdown (Admin/Member) + Send Invite button
  - Pending invitations list (email, expires date, Resend/Cancel)

### New API endpoints required

**`packages/cultivar-os/api/team/invite.ts`** — POST handler
- Takes: `business_id`, `email`, `role`
- Validates: requesting user is owner or admin of that business
- Creates `business_members` row with `invitation_token = randomUUID()`, `invitation_expires_at = now() + 7 days`
- Sends invitation email via Resend: "David O'Brien has invited you to join LAWNS Tree Farm on Cultivar OS. Click to accept: [link]"
- Returns `{ ok: true }`

**`packages/cultivar-os/api/team/accept.ts`** — GET handler (or POST after user signs in)
- Takes: `token` query param
- Looks up `business_members` where `invitation_token = token` AND `invitation_expires_at > now()`
- Two paths:
  - User is already signed in: links `user_id = auth.uid()` on the member row, clears token
  - User is not signed in: redirects to `/signup?invitation_token=X` → after signup, the token is processed
- Sets `joined_at = now()`, clears `invitation_token`, sets `user_id`

**`packages/cultivar-os/api/team/members.ts`** — GET handler
- Returns all `business_members` rows for a given `business_id`
- Used by the TeamSection component to render the member list

**`packages/cultivar-os/src/pages/AcceptInvite.tsx`** — new page
- Route: `/invite/accept?token=X`
- If user is authenticated: calls accept API directly
- If not authenticated: shows "Create your account to join LAWNS Tree Farm" with email pre-filled from the token's business_members row
- After signup completes: calls accept API, redirects to `/dashboard`

### Email infrastructure

Resend is already referenced in `packages/shared/src/notifications/send.ts`. A new invitation email template is needed in `packages/shared/src/notifications/templates/cultivar.ts` (or a shared template). Template content:

```
Subject: You've been invited to join [Business Name] on Cultivar OS

Hi [Erin],

David O'Brien has invited you to join LAWNS Tree Farm on Cultivar OS as a team member.

[Accept invitation →]  (link expires in 7 days)

Cultivar OS helps nurseries track leakage, run QR checkout, and auto-create QuickBooks invoices.

If you weren't expecting this, you can safely ignore this email.
```

### Effort estimate

| Component | Hours |
|---|---|
| Database migration (business_members table + RLS) | 3h |
| BusinessProvider update (member access path) | 3h |
| TeamSection in Settings UI (list + invite form + pending) | 6h |
| `/api/team/invite` endpoint + invitation email template | 4h |
| `/api/team/accept` endpoint (both auth states) | 4h |
| `/api/team/members` endpoint | 1h |
| `AcceptInvite.tsx` page + router entry | 3h |
| Testing end-to-end (invite send → email → accept → access) | 4h |
| **Total** | **28 hours** |

This assumes:
- Resend env var is active (already in Vercel — per CLAUDE.md)
- Supabase email confirmation remains OFF
- Role access control is simple (members can read/view, owners can manage — no fine-grained per-feature permissions)
- The accept flow handles the "user already has an account" and "new user" paths but not edge cases like invitation to an email with an existing Cultivar account in a different business

### What could be descoped to reduce effort

**Minimal viable version (invite-only, no role management, 14 hours):**
- Database: add `invited_emails text[]` column to businesses table — no separate table, no roles (owner: David, everyone else: member)
- API: one endpoint that sends Resend invitation email with a magic link (Supabase magic link flow)
- On magic link click: user authenticates, but BusinessProvider still fails for them (owner_id mismatch)
- This does NOT actually work — the RLS problem still exists without the business_members table

**True minimum that actually works (18 hours):**
- business_members table (3h)
- BusinessProvider updated to check membership (3h)
- Invite endpoint + email (4h)
- Accept endpoint (3h)
- AcceptInvite page (2h)
- Testing (3h)
- Settings UI reduced to: "Invite by email" input only, no member list, no role management

---

## Section 6: Manual Workaround for Demo

**Honest answer: there is no clean manual workaround that gives David and Erin simultaneous access to LAWNS data.** The current RLS policy on businesses uses `owner_id = auth.uid()` — exactly one user can access any given business row.

The options available today, with their trade-offs:

### Option A — Temporarily change owner_id (breaks David's access)

1. In Supabase dashboard → Authentication → Users: invite Erin's email (or create her account directly via the Supabase Auth UI)
2. Copy Erin's new `user.id` UUID
3. In Supabase dashboard → Table Editor → `businesses`: find the LAWNS row, update `owner_id` to Erin's UUID
4. Erin can now log in and see LAWNS data
5. **David now cannot.** His auth token no longer matches `owner_id` on the businesses row. He sees the "no business" error.

This works for a demo where only Erin is using the account at a time. Swap owner_id back to David's UID before David needs to use it.

### Option B — Run the OnboardingWizard as Erin (creates duplicate data)

1. Create Erin's auth account
2. She signs up → OnboardingWizard runs → creates a NEW businesses row under Erin's user_id with LAWNS's data manually entered
3. Erin now has her own LAWNS-named business, but it's a separate row in the businesses table with no plants, no orders, no real LAWNS data

This gives Erin her own isolated Cultivar instance that looks like LAWNS but shares nothing with David's actual LAWNS data. Works for showing the interface, not for showing actual LAWNS orders or metrics.

### Option C — Disable RLS on businesses temporarily (dangerous)

Run in Supabase SQL editor:
```sql
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
```

All authenticated users can now read all businesses rows. David or Erin can hard-code the business_id and see the same data. **This exposes every other customer's data to every other user — never do this in production.** Only acceptable in an isolated demo account with no real customers.

### Recommended workaround for demo

**Option A with a swap back:** Before the demo involving Erin, update `businesses.owner_id` to Erin's UID. After the demo, update it back to David's UID. This requires two SQL editor trips and careful coordination but has no side effects on real data.

**SQL to swap:**
```sql
-- Set Erin as owner (run before Erin's demo):
UPDATE businesses
SET owner_id = '[ERIN_USER_ID]'
WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';

-- Restore David as owner (run after Erin's demo):
UPDATE businesses
SET owner_id = '[DAVID_USER_ID]'
WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';
```

**What Erin experiences after the swap:**
- Logs in at cultivar-os.vercel.app with her email/password
- BusinessProvider resolves the LAWNS businesses row (owner_id now matches her UID)
- She sees the LAWNS dashboard, metrics, orders, plants — the full LAWNS environment
- Can run QR checkout, view orders, use all LAWNS features

**What still won't work:**
- Erin cannot use the platform simultaneously as David (only one owner_id at a time)
- Erin has no distinct role/permission different from owner — she has full owner access
- No email notification that she was added — she needs to receive her login credentials directly from David

---

## Section 7: Cross-Reference with Self-Serve Readiness Plan

The self-serve readiness plan (`docs/self-serve-readiness-plan-2026-05-31.md`) does not mention team member management anywhere in its 19 Tier 1 items, 15 Tier 2 items, or 5 Tier 3 items. It was not on the radar when the plan was written.

**Where it would fit:**

| If added to the plan | Tier | Rationale |
|---|---|---|
| For demo purposes (LAWNS Lauren + Terry can both use it) | **Tier 1** | A nursery with 2 staff cannot run on one shared login. Lauren runs checkout; Terry owns the QB account. Shared credentials are a Surface Honesty problem. |
| For self-serve customers (any business with employees) | **Tier 2** | Self-serve customers with more than one staff member cannot use the product without this. But a solo owner-operator can. Tier 2 covers quality/retention, not baseline access. |

**Demo-specific urgency:** LAWNS Tree Farm has at minimum Terry (owner) and Lauren (manager). The demo scenario where Lauren runs checkout and Terry approves the QB connection requires two accounts. If both must share David's login credentials, the demo quality degrades. For the LAWNS close, being able to show Terry and Lauren their own accounts accessing the same nursery data is a legitimate demo need.

**Effort impact on the plan:** At 28 hours (full flow) or 18 hours (minimal viable), team member management would add meaningfully to Tier 1's 64-hour total. If descoped to the 18-hour minimum, Tier 1 becomes 82 hours — still within the 180-hour available capacity with buffer.

**Recommendation:** Add the minimal viable version (18 hours, no role management, no Settings member list — just invite-by-email + accept flow + BusinessProvider membership check) to Tier 1 before the LAWNS meeting. The full version (28 hours, member list, role display, pending invitation management) can be Tier 2. The gap between demo needs and self-serve needs is real — LAWNS specifically, and every multi-staff nursery generally, cannot use the product in its current form.

---

## Summary

| Question | Answer |
|---|---|
| Does any team/member infrastructure exist? | **No.** Not in the database, not in the UI, not in the API. |
| Can David add Erin to LAWNS today? | **Not cleanly.** Only by temporarily transferring owner_id in Supabase SQL editor, which removes David's access simultaneously. |
| Is there a Settings UI section for team members? | **No.** Settings has four sections: Business Profile, Accounting, Services, Nursery Settings. |
| Does the signup flow support joining an existing business? | **No.** `BusinessProvider` assumes `owner_id = auth.uid()`. Members of another business resolve to "no business" today. |
| Is team member management in the self-serve plan? | **No.** It was not identified as a gap when the plan was written. |
| Minimum viable build effort? | **18 hours** (invite email + accept flow + BusinessProvider update). Full version with Settings UI: **28 hours**. |
| Where does it fit in priority? | **Tier 1 for demo** (Terry + Lauren need separate accounts). **Tier 2 for self-serve** (solo owners can use the product without it). |

---

*Read-only audit — no code changed. All findings reflect codebase state as of 2026-06-01.*
*To build the minimal viable invitation flow, start with the `business_members` migration (database change required before any code), then BusinessProvider update (so member access resolves correctly), then the invite + accept API endpoints, then the AcceptInvite page. Build and test this chain before touching Settings UI.*
