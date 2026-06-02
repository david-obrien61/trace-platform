# Ignition OS Multi-User Infrastructure — Extraction Audit
**Date:** 2026-06-01  
**Author:** Claude Code audit  
**Status:** Read-only. No code changed.  
**Context:** Cultivar OS has zero multi-user infrastructure (confirmed by today's team-member-management audit). Ignition OS was built for multi-user shops. This document audits Ignition's pattern in detail sufficient for extraction to `packages/shared/` for Cultivar to consume.

**Files read:**
- `packages/ignition-os/supabase/migrations/supabase_team_system_migration.sql`
- `packages/ignition-os/supabase/migrations/supabase_identity_v2_migration.sql`
- `packages/ignition-os/modules/IgnitionAdmin.jsx` (full, 1794 lines)
- `packages/ignition-os/CoreApp.jsx` (full, 1337 lines)
- `packages/ignition-os/DataBridge.js` (lines 1–800)
- `packages/shared/src/context/BusinessProvider.tsx`
- `docs/team-member-management-audit-2026-06-01.md`
- `PLATFORM_STRATEGY.md`

---

## TASK 1 — Multi-User Data Model

### Tables (added in two migration files)

#### `shop_members` — one row per person who has joined the shop

**From `supabase_team_system_migration.sql` (original columns):**
```sql
CREATE TABLE IF NOT EXISTS shop_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  role        text        NOT NULL,
  phone       text,
  permissions jsonb       DEFAULT '[]'::jsonb,
  joined_at   timestamptz NOT NULL DEFAULT now()
);
```

**From `supabase_identity_v2_migration.sql` (columns added via ALTER):**
```sql
ALTER TABLE shop_members
  ADD COLUMN IF NOT EXISTS team_id    uuid        REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sub_role   text,
  ADD COLUMN IF NOT EXISTS active     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_hash   text,
  ADD COLUMN IF NOT EXISTS invite_id  uuid        REFERENCES shop_invites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
```

**Full column set (post-migration):**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `shop_id` | uuid FK → shops.id | Tenant anchor |
| `name` | text NOT NULL | Uppercased by UI |
| `role` | text NOT NULL | TECH / SERVICE / ADMIN / CUSTOMER |
| `sub_role` | text | SR_TECH, BAY_TECH, APPRENTICE, ADVISOR, CASHIER |
| `team_id` | uuid FK → teams.id | Nullable — not every shop uses teams |
| `phone` | text | Optional, used for SMS delivery |
| `permissions` | jsonb (array) | Granular permission list |
| `active` | boolean DEFAULT false | false=invited, true=enrolled (has set PIN) |
| `pin_hash` | text | SHA-256 of `shopId:PIN` — set on enrollment |
| `invite_id` | uuid FK → shop_invites.id | Back-ref to the invite that created this row |
| `joined_at` | timestamptz | Default: row creation time |
| `updated_at` | timestamptz | Auto-stamped via trigger on every UPDATE |

**Critical design: `active = false` on invitation, `active = true` after PIN enrollment.** The row exists before the user has accessed the system. The `active` flag is the gate.

---

#### `shop_invites` — single-use invitation tokens

```sql
CREATE TABLE IF NOT EXISTS shop_invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text        NOT NULL UNIQUE,
  shop_id    uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  role       text        NOT NULL,
  phone      text,
  used       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

| Column | Notes |
|---|---|
| `token` | `crypto.randomUUID()` — guaranteed unique by index |
| `used` | false=available, true=claimed or cancelled. JoinFlow sets true after enrollment. Owner can cancel pending invites from StaffTab. |
| `shop_id` | Matches `shop_members.shop_id` |

---

#### `pin_resets` — out-of-band PIN recovery

```sql
CREATE TABLE IF NOT EXISTS pin_resets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_code  text        NOT NULL,          -- 6-digit, displayed to admin
  shop_id     uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  member_name text        NOT NULL,          -- snapshot (fallback)
  member_role text        NOT NULL,          -- snapshot (fallback)
  permissions jsonb       DEFAULT '[]'::jsonb, -- snapshot (fallback)
  member_id   uuid        REFERENCES shop_members(id) ON DELETE SET NULL,
  used        boolean     NOT NULL DEFAULT false,
  expires_at  timestamptz NOT NULL,          -- 15 minutes from creation
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Admin generates a 6-digit code in the UI → reads it aloud to the staff member → staff enters it on the "Forgot PIN" screen → new PIN is set → reset marked used. No email or SMS — intentionally in-person for shops.

---

#### `teams` — named groups within a shop (optional)

```sql
CREATE TABLE IF NOT EXISTS teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

One shop can have multiple teams (e.g., "TECH TEAM", "FRONT OFFICE"). Optional feature — `shop_members.team_id` is nullable.

---

#### `member_devices` — per-device enrollment tracking

```sql
CREATE TABLE IF NOT EXISTS member_devices (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           uuid        NOT NULL REFERENCES shop_members(id) ON DELETE CASCADE,
  shop_id             uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  device_label        text,
  device_fingerprint  text,
  biometric_enrolled  boolean     NOT NULL DEFAULT false,
  is_active           boolean     NOT NULL DEFAULT true,
  last_seen           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

A member can be enrolled on multiple devices. Each login auto-creates or updates a device row (via `DataBridge.autoEnrollDevice()`). Admin can disable individual devices (lost/stolen), re-enable them, or delete (re-enrollment required). This enables biometric login (Face ID/Touch ID) per device without re-enrollment on new devices.

---

### How members link to businesses

The chain from the 2026-05-29 migration (`20260529_ignition_businesses.sql`):

```
auth.users.id
    ↓
businesses.owner_id       (one owner per business)
    ↓
businesses.id = shops.id  (same UUID — businesses and shops are the same entity)
    ↓
shop_members.shop_id      (many members per shop)
```

Staff members themselves do NOT have `auth.users` accounts. They authenticate via PIN only. The owner is the sole Supabase auth user — all staff are rows in `shop_members` with no corresponding `auth.users` row.

**This is the fundamental architectural difference that blocks direct adoption in Cultivar.** See Task 5 and Task 6.

---

### RLS policies — all pilot-open

Every team table uses the identical pilot policy:

```sql
CREATE POLICY "pilot_all_members" ON shop_members FOR ALL USING (true);
CREATE POLICY "pilot_all_invites" ON shop_invites FOR ALL USING (true);
CREATE POLICY "pilot_all_resets"  ON pin_resets   FOR ALL USING (true);
CREATE POLICY "pilot_all_teams"   ON teams         FOR ALL USING (true);
CREATE POLICY "pilot_all_member_devices" ON member_devices FOR ALL USING (true);
```

**Any authenticated user can read any shop's team data.** This is acceptable in a single-shop pilot where every user is known, but is not production-safe for multi-tenant SaaS. For Cultivar, every team table needs `business_id`-scoped RLS from day one.

---

## TASK 2 — Role System

### Role constants (IgnitionAdmin.jsx:22–58)

#### `ALL_PERMISSIONS` — 19 granular permissions

```javascript
const ALL_PERMISSIONS = [
  // Modules group
  { id: 'view_omni',        label: 'View OMNI (Command)' },
  { id: 'view_hub',         label: 'View HUB (Dispatch)' },
  { id: 'view_flux',        label: 'View FLUX (Workflow)' },
  { id: 'view_cipher',      label: 'View CIPHER (DTC)' },
  { id: 'view_stok',        label: 'View STOK (Inventory)' },
  { id: 'view_proc',        label: 'View PROC (Vendors)' },
  { id: 'view_prot',        label: 'View PROT (Margins)' },
  { id: 'view_port',        label: 'View PORT (Estimates)' },
  { id: 'view_crm',         label: 'View CRM (Clients)' },
  { id: 'view_predictive',  label: 'View PREDICTIVE' },
  { id: 'view_marketplace', label: 'View Marketplace' },
  // Financial group
  { id: 'PRICING_AUTHORITY', label: 'Edit Pricing Slabs' },
  { id: 'edit_margins',      label: 'Edit Margins (Legacy)' },
  { id: 'approve_payroll',   label: 'Approve Payroll' },
  // Admin group
  { id: 'manage_users',      label: 'Manage Staff' },
  // Tech Ops group
  { id: 'scan_parts',        label: 'Scan Parts' },
  { id: 'update_flux',       label: 'Update Job Status' },
  // Customer group
  { id: 'sign_estimates',    label: 'Sign Estimates' },
  { id: 'pay_invoice',       label: 'Pay Invoice' },
];
```

#### `ROLE_PRESETS` — permission bundles per role

```javascript
const ROLE_PRESETS = {
  ADMIN:    ['view_omni','view_hub','view_flux','view_predictive','view_cipher','view_stok',
             'view_proc','view_prot','view_port','view_crm','view_marketplace','edit_margins',
             'PRICING_AUTHORITY','manage_users','approve_payroll','scan_parts','update_flux'],
  TECH:     ['view_hub','view_flux','view_cipher','view_stok','scan_parts','update_flux'],
  SERVICE:  ['view_port','view_crm','view_cipher','view_stok','sign_estimates'],
  CUSTOMER: ['view_port','sign_estimates','pay_invoice'],
};
```

Presets are defaults. The owner can toggle individual permissions on/off before generating the invite, and can edit them later via ManageMemberModal. The final source of truth is `shop_members.permissions` (jsonb array).

#### `SUB_ROLES` — tier within a role

```javascript
const SUB_ROLES = {
  TECH:     ['SR_TECH', 'BAY_TECH', 'APPRENTICE'],
  SERVICE:  ['ADVISOR', 'CASHIER'],
  ADMIN:    [],
  CUSTOMER: [],
};
```

Sub-roles are informational only — no permission gating depends on sub_role. They appear in the team list and member card for organizational display.

---

### Where permission checks happen

**All enforcement is client-side. No server-side permission gating exists.**

#### Frontend: `AccessGatekeeper` component (CoreApp.jsx:470–515)

```javascript
const AccessGatekeeper = ({ requiredPermissions, children }) => {
  const currentUser = DataBridge.load('current_user');  // reads localStorage
  const rolesRegistry = DataBridge.getSystemRoles();
  const userCapabilities = currentUser.permissions.flatMap(role => rolesRegistry[role] || []);
  const hasAccess = requiredPermissions.some(rp => userCapabilities.includes(rp)) || overrideActive;
  if (hasAccess) return children;
  // renders "Access Denied" with manager override option
};
```

Usage throughout CoreApp.jsx:
```javascript
{activeModule === 'INTAKE' && (
  <AccessGatekeeper requiredPermissions={['view_flux']}>
    <IgnitionIntake ... />
  </AccessGatekeeper>
)}
```

Every module gate is a frontend conditional. A sophisticated user who can modify their localStorage `current_user.permissions` could bypass access control. In a shop context with trusted staff on shop devices, this is acceptable. For Cultivar with external members, API-level enforcement is also needed.

#### Frontend: `manage_users` permission gate (IgnitionAdmin.jsx)

IgnitionAdmin module itself is gated to the `ADMIN` permission check via `AccessGatekeeper`:
```javascript
{activeModule === 'ADMIN' && (
  <AccessGatekeeper requiredPermissions={['manage_users']}>
    <IgnitionAdmin ... />
  </AccessGatekeeper>
)}
```

Only users with `manage_users` in their permissions array can access the staff management UI. This prevents technicians from modifying other users' profiles.

#### RLS layer — not enforced

The Supabase RLS policies are all `USING(true)`. No permission checking happens at the database layer. A direct Supabase query from any authenticated session could read or modify any record on any table.

---

## TASK 3 — Invitation Flow

The full invitation flow is split between two files:

### Stage 1: Owner generates invite (IgnitionAdmin.jsx:267–512, `InviteStaffModal`)

```javascript
const generate = async () => {
  // 1. Create token
  const token = crypto.randomUUID();

  // 2. INSERT into shop_invites
  const { data: invite } = await supabase.from('shop_invites').insert({
    token,
    shop_id: shopId,
    name: form.name.trim().toUpperCase(),
    role: form.role,
    phone: form.phone.trim() || null,
  }).select('id').single();

  // 3. INSERT into shop_members with active=false
  await supabase.from('shop_members').insert({
    shop_id:     shopId,
    invite_id:   invite.id,        // ← back-reference
    name:        form.name.trim().toUpperCase(),
    role:        form.role,
    sub_role:    form.sub_role || null,
    team_id:     form.team_id || null,
    phone:       form.phone.trim() || null,
    permissions: form.permissions, // owner-configured before generating
    active:      false,            // ← not enrolled yet
  });

  // 4. Build invite URL
  setInviteLink(`${window.location.origin}/?join=${shopId}&invite=${token}`);
};
```

**Delivery options shown to owner after link is generated:**
- **Copy Link** — copies URL to clipboard
- **Send SMS** — opens native SMS compose via `window.open(`sms:${phone}?body=...`)`
- **QR Code** — rendered inline via `<QRCodeSVG value={inviteLink} size={28} />`

**There is no email delivery.** No Resend, no SendGrid, no SMTP. The delivery mechanism is either SMS (requires phone number) or in-person QR scan. This is appropriate for a shop context (admin hands tablet to new tech). For Cultivar, email delivery via Resend is required.

---

### Stage 2: Staff member opens link and enrolls (CoreApp.jsx:160–383, `JoinFlow`)

**URL parsing (CoreApp.jsx:856–864):**
```javascript
const urlParams   = new URLSearchParams(window.location.search);
const joinShopId  = urlParams.get('join');
const inviteToken = urlParams.get('invite');

// JOIN FLOW: Check BEFORE onboarding
if (joinShopId) {
  return <JoinFlow shopId={joinShopId} inviteToken={inviteToken} />;
}
```

`?join=SHOP_ID` always triggers JoinFlow regardless of whether `&invite=TOKEN` is present. This is intentional: the same URL pattern handles both personal invites and generic QR join.

**JoinFlow: personal invite path (inviteToken present):**
1. Loads `shop_invites` record matching token, confirms `used = false`
2. Pre-fills name and role from the invite (read-only — no editing)
3. User sets their 4-digit PIN
4. `finalize()` runs:
   ```javascript
   const pinHash = await DataBridge.hashPin(shopId, pin);
   // SHA-256 of `${shopId}:${pin}` — shop-salted to prevent cross-shop collisions

   await supabase.from('shop_members')
     .update({ pin_hash: pinHash, active: true })
     .eq('invite_id', inviteData.id);  // activates the pre-created row

   await supabase.from('shop_invites')
     .update({ used: true })
     .eq('id', inviteData.id);         // single-use enforcement
   ```
5. `DataBridge.autoEnrollDevice(member.id, shopId)` — registers browser fingerprint
6. `DataBridge.save('current_user', session)` — session stored in localStorage
7. `window.location.href = '/'` — lands in app as the enrolled member

**JoinFlow: generic QR path (no inviteToken):**
1. User selects TECH or SERVICE role from a 2-option card screen
2. User fills their name and sets a 4-digit PIN
3. `finalize()` checks for PIN hash collision (prevents duplicate PINs)
4. INSERTs a new `shop_members` row with `active: true` immediately
5. Default permissions applied based on selected role

**Security properties of the current implementation:**
- Token is a UUID (128-bit random) — not guessable
- Single-use enforced: `used = false` check in JoinFlow, set to `true` on enrollment
- No expiration on `shop_invites` — token stays valid indefinitely until used or cancelled
- Admin can cancel pending invites via StaffTab (marks `used = true`)
- PIN collision check ensures no two staff share a PIN at the same shop
- Shop-salted PIN hash prevents cross-shop PIN leakage (same PIN at two shops = different hashes)

**What's missing in Ignition that Cultivar will need:**
- Token expiration (`invitation_expires_at` column and check on redemption)
- Email delivery infrastructure (Resend, invitation template)
- Supabase auth account creation as part of enrollment (Cultivar members need real auth accounts, not just a PIN row)
- Business RLS linking (member must be able to read the business row, not just be in the members table)

---

## TASK 4 — Login-As-User Flow

### How it actually works

There is no admin impersonation. Every user genuinely logs in with their own PIN.

**Owner login:**
1. Owner visits the app
2. `useBusinessContext()` resolves their Supabase auth session → `businesses` table → `businessId`
3. Owner syncs DataBridge with `businessId` (CoreApp.jsx:758–767)
4. `DataBridge.load('current_user')` checks localStorage for a cached PIN session
5. If no session, `IdentityMatrix` renders — owner enters their PIN
6. `DataBridge.authenticate(pin)` → SHA-256 hash → SELECT from `shop_members` WHERE active=true
7. Owner lands in the app as an ADMIN member

**Staff login:**
1. Staff visits the app on any device that has the shopId in localStorage
2. No Supabase auth needed — `useBusinessContext()` resolves via the owner's shopId in DataBridge
3. `IdentityMatrix` renders — staff enters their PIN
4. Same `DataBridge.authenticate(pin)` flow
5. Staff lands in the app with their specific permissions

**User switching:**
- Click the lock icon in the header → `DataBridge.save('current_user', null); setCurrentUser(null)`
- `IdentityMatrix` appears again
- Anyone in the shop can now log in with their PIN
- This is how David "logged in as multiple users" — not impersonation but sequential PIN logins

**Biometric login (optional, per-device):**
- After first correct PIN login, app prompts to enroll Face ID/Touch ID (WebAuthn)
- Credential stored in localStorage as `bio_cred_id`
- On subsequent visits: WebAuthn challenge → on success, loads `shop_members` from Supabase directly
- Biometric is a shortcut to PIN auth, not an alternative credential

**What "David verifying workflows as multiple users" looks like:**
1. Open browser tab (or navigate to app)
2. Enter ADMIN owner PIN → verify admin behavior
3. Click lock icon → enter TECH staff PIN → verify tech experience
4. Click lock icon → enter SERVICE staff PIN → verify service experience
No session management beyond DataBridge `current_user` in localStorage.

---

## TASK 5 — What's Ignition-Specific vs. Shared

### Pure infrastructure (portable to any vertical)

| Concept | What it is | Why it's portable |
|---|---|---|
| Two-table invitation pattern | `invitations` (token, used) + `members` (active=false until enrolled) | Any business with staff needs invitations with state tracking |
| Active flag lifecycle | `active = false` on invite → `active = true` on enrollment | Universal: member exists before they've accessed the system |
| Single-use token | `used` boolean, checked and set atomically on enrollment | Universal security property |
| Business-member join | A member table referencing a business, enabling multiple users per tenant | Every multi-user vertical needs this |
| JoinFlow UX pattern | URL with `?join=BUSINESS_ID&invite=TOKEN`, displays business name, pre-fills name/role | The UX is universal; the URL structure is shareable |
| Permission presets | Role → default permission bundle, owner can customize | Every vertical will have role templates with per-role defaults |
| JSONB permissions column | Fine-grained permission storage as jsonb array | Universal: Cultivar needs (owner, admin, member) at minimum |
| Member device tracking | `member_devices` table with per-device disable/enable | Universal multi-device support |
| Admin member list UI | StaffTab rendering active + pending members, revoke flow | Any admin settings panel needs a team view |

### Ignition-specific content (stays in ignition-os)

| Concept | What it is | Why it stays in ignition-os |
|---|---|---|
| PIN-based authentication | `DataBridge.hashPin()`, `DataBridge.authenticate()`, `shop_members.pin_hash` | CLAUDE.md locked auth rule: staff in multi-tenant verticals must have Supabase auth.users accounts. PIN-only auth is the Ignition exception, not the pattern. |
| PIN reset codes | `pin_resets` table, 6-digit in-person code | Specific to PIN auth model — Cultivar uses Supabase email auth; reset is via Supabase's built-in reset flow |
| SMS delivery | `window.open('sms:...')` invite delivery | Shop context where everyone is co-located. Cultivar needs async email invitations (invitee may not be present) |
| Role names (TECH, SERVICE, ADMIN, CUSTOMER) | Auto shop roles | Module names, sub-roles, and permission IDs are shop-specific |
| Sub-roles (SR_TECH, BAY_TECH) | Tier within role | Ignition-specific hierarchy |
| Permission names (`view_hub`, `view_flux`, `scan_parts`) | Module access keys | Every Ignition permission maps to an Ignition module. Cultivar needs (view_orders, view_invoicing, manage_settings, etc.) |
| DataBridge as credential store | localStorage + sync | Ignition local-first architecture — Cultivar is Supabase-primary |
| Biometric enrollment | WebAuthn per-device | Optional enhancement for any vertical, but PIN-dependent in current form |
| teams table | Named groups within shop | Optional organizational layer, not needed for Cultivar MVP |

### What the shared layer should know

```
packages/shared/ knows about:
  - businesses (already exists: BusinessProvider.tsx)
  - business_members (new: business_id, user_id, email, role, invited_by)
  - invitations (new: token, business_id, email, role, expires_at, used)
  - Generic roles: 'owner', 'admin', 'member' (map to vertical-specific roles in vertical layer)
  - Invitation flow: create token → send delivery → accept token → link user_id

packages/cultivar-os/ knows about:
  - Nursery-specific roles if needed (currently owner/admin/member is enough for LAWNS)
  - Resend as the email delivery mechanism (already in shared/notifications, but template is vertical-specific)
  - AcceptInvite page (vertical-specific routing and post-accept redirect)

packages/ignition-os/ keeps:
  - PIN auth, DataBridge, shop_members.pin_hash
  - shop-specific roles and permissions
  - SMS delivery
```

---

## TASK 6 — Extraction Path Recommendation

### Option A — Extract architecture to packages/shared/ (Recommended)

**What moves where:**

**New database migration (Cultivar-specific, `packages/cultivar-os/` or `supabase/migrations/`):**
```sql
-- business_members: one row per person who belongs to a business
CREATE TABLE business_members (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id),   -- null until accepted
  email                 text NOT NULL,
  role                  text NOT NULL DEFAULT 'member'
                          CHECK (role IN ('owner', 'admin', 'member')),
  invited_by            uuid NOT NULL REFERENCES auth.users(id),
  invitation_token      text UNIQUE,                      -- null after accepted
  invitation_expires_at timestamptz,                      -- 7-day window
  joined_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, email)
);
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;

-- Owner can read/manage their own business's members
CREATE POLICY bm_owner_all ON business_members FOR ALL
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

-- Member can read their own row (to check their role)
CREATE POLICY bm_self_select ON business_members FOR SELECT
  USING (user_id = auth.uid());
```

*This migration is Ignition's `shop_members` + `shop_invites` pattern collapsed into one table, adapted for Cultivar's Supabase auth model. Ignition splits them into two tables; Cultivar can use one since the invitation state is tracked via `invitation_token IS NULL / NOT NULL` and `user_id IS NULL / NOT NULL`.*

**`packages/shared/src/context/BusinessProvider.tsx` — dual-query update:**

Ignition's pattern (owner-only query) stays for Ignition. BusinessProvider gets a new codepath for email-auth verticals:

```typescript
// Try 1: user is the owner
const { data: owned } = await supabase.from('businesses')
  .select('*').eq('owner_id', user.id).eq('business_type', businessType).single();
if (owned) { setBusinessId(owned.id); return; }

// Try 2: user is a member (email-auth verticals only)
const { data: membership } = await supabase.from('business_members')
  .select('business_id, role').eq('user_id', user.id).single();
if (membership) {
  const { data: business } = await supabase.from('businesses')
    .select('*').eq('id', membership.business_id).single();
  // requires RLS on businesses: allow members to read their business
  if (business) { setBusinessId(business.id); setMemberRole(membership.role); return; }
}
```

RLS on `businesses` also needs a member-read policy:
```sql
CREATE POLICY businesses_member_select ON businesses FOR SELECT
  USING (id IN (
    SELECT business_id FROM business_members WHERE user_id = auth.uid()
  ));
```

**New API endpoints (Cultivar-specific, `packages/cultivar-os/api/team/`):**

`invite.ts` — POST  
- Validates requesting user is owner or admin of the business  
- Creates `business_members` row: `user_id = null`, `invitation_token = randomUUID()`, `invitation_expires_at = now() + 7 days`  
- Sends Resend email: "David O'Brien has invited you to join LAWNS Tree Farm on Cultivar OS"  
- Invitation URL: `https://cultivar-os.vercel.app/invite/accept?token=TOKEN`  

`accept.ts` — GET + POST  
- Looks up `business_members` where `invitation_token = TOKEN` and `invitation_expires_at > now()`  
- Uses service key (bypasses RLS) to read + update the member row  
- If user is authenticated: links `user_id = auth.uid()`, clears token, sets `joined_at`  
- If not authenticated: redirects to `/signup?invitation_token=TOKEN`  
- After signup, the token is re-processed via the authenticated path  

`members.ts` — GET  
- Returns all `business_members` for a given `business_id`  
- Owner and admins can call this  

**New UI (Cultivar-specific):**

`packages/cultivar-os/src/pages/AcceptInvite.tsx` — new page  
- Route: `/invite/accept?token=X`  
- Authenticated: calls `/api/team/accept`, redirects to `/dashboard`  
- Unauthenticated: shows "Create your account to join [Business Name]", pre-fills email, redirects to `/signup?invitation_token=X` after signup  

`packages/shared/src/pages/Settings.tsx` — `TeamSection` block added  
- List of current members: name/email, role chip, Remove button  
- "Invite team member" form: email + role dropdown + Send Invite  
- Pending invitations list: email, expires, Cancel button  
- Adapts Ignition's `StaffTab` UI to inline Settings, without modals (or with simpler modals)  

**Backward compatibility for Ignition:**  
None required. Ignition's `shop_members`, `shop_invites`, `shop_invites` tables are unchanged. BusinessProvider's member-lookup codepath only activates when the vertical supports email auth (controlled by a `supportsEmailMembers` prop or similar). Ignition's DataBridge-based flow is untouched.

---

### Effort estimate (Option A)

| Component | Hours | Notes |
|---|---|---|
| `business_members` migration + RLS | 3h | Pattern confirmed correct by Ignition — no design debate |
| `businesses` member-read RLS policy | 0.5h | One additional policy |
| BusinessProvider dual-query | 2.5h | Known design from prior audit, Ignition confirms it |
| `/api/team/invite` endpoint + Resend template | 4h | Resend already in shared/notifications; template is new |
| `/api/team/accept` endpoint (both auth states) | 3h | Two code paths, service key for RLS bypass |
| `/api/team/members` endpoint | 1h | Simple SELECT with authorization check |
| `AcceptInvite.tsx` page + router entry | 2.5h | Adapted from Ignition's JoinFlow UX |
| `TeamSection` in shared `Settings.tsx` | 5h | Adapted from Ignition's StaffTab; simplified (no modals needed for MVP) |
| Testing (invite → email → accept → access) | 3h | Can be reduced by using David's own email for test |
| **Total (full with Settings)** | **24.5h** | Round to **25h** |
| **Minimal viable (no Settings member list)** | **15.5h** | Round to **16h** |

**Why these are lower than the prior audit's 18h/28h estimates:**
- The two-table pattern is confirmed correct — no time spent debating schema design
- The `active = false → true` lifecycle is proven — no re-derivation
- The JoinFlow UI template (adapted to email-auth) replaces UI design from scratch
- The RLS pattern is confirmed by Ignition's v2 migration comments

**Why these are not dramatically lower:**
- The credential mechanism changes completely (PIN hash → Supabase auth + email invite)
- Email delivery (Resend) is new infrastructure that Ignition doesn't have
- BusinessProvider dual-query needs careful testing (the RLS policies interact in non-obvious ways)
- AcceptInvite page has two code paths (authenticated and unauthenticated) that must both work

---

### Option B — Copy to Cultivar separately, refactor to shared later

- **Effort:** ~20–22h (slightly lower than Option A without the shared/ extraction overhead)
- **Divergence risk:** High. The moment Ignition also needs the shared pattern (Conduit OS Phase 1), there are now two implementations to reconcile.
- **Acceptable when:** The third vertical (Conduit) is 6+ months away and shared/ extraction is confirmed in the backlog.
- **Not recommended here** because BusinessProvider is already in shared and must be updated regardless. Doing this half in shared (BusinessProvider) and half in vertical (team API + UI) creates more split than doing the extraction fully.

---

### Option C — Refactor in-place during the move

**What cleanup Ignition needs (independent of Cultivar):**
1. Replace all team table `USING(true)` policies with `shop_id`-scoped policies through the businesses owner chain
2. Add `invitation_expires_at` to `shop_invites` (currently tokens never expire)
3. Extract permission names to a shared constants file

**Why not now:** These are Ignition cleanups, not Cultivar blockers. Running them concurrently adds scope to an already-scoped extraction task. Ignition's pilot-open RLS is acceptable for Ignition's current single-shop pilot use. Fix Ignition's RLS as a dedicated Ignition session after the LAWNS demo.

**Recommendation: Option A.** Do the extraction now with Ignition as the reference implementation. The architectural decisions are confirmed. The effort is bounded. The business case is clear (LAWNS has Terry and Lauren; they need separate accounts).

---

## TASK 7 — Compare Against Self-Serve Readiness Plan

**Prior plan state (from `docs/self-serve-readiness-plan-2026-05-31.md`):**
- Tier 1: 19 items, ~64 hours total
- Tier 2: 15 items
- Tier 3: 5 items
- Total pre-August budget: ~180 hours
- Team member management: **not on the list** (assumed built)

**Actual effort with Ignition adoption:**

| Version | Hours | Plan total |
|---|---|---|
| Minimal viable (invite + accept + BusinessProvider, no Settings list) | 16h | 64 + 16 = **80h** |
| Full (+ Settings TeamSection + member management) | 25h | 64 + 25 = **89h** |

**Does it fit within the 180h budget?**

Yes, comfortably. Both scenarios leave 90–100h of budget for Tier 2 work. The 180h ceiling is not threatened by either version.

**Does it displace anything currently in Tier 1?**

No. The prior Tier 1 of 64h was conservative — it fit within 180h with substantial buffer. Adding team management does not require removing any other Tier 1 item; it simply raises the Tier 1 total.

**Should minimal viable or full be targeted for the demo?**

The demo need (Terry and Lauren having separate accounts) requires minimal viable (16h). The full version (25h) is a Tier 2 quality-of-life improvement. Lauren needs to be able to see the team, but the demo doesn't require in-app member management — it requires that two users can simultaneously access LAWNS data.

**Honest assessment of timing:** At 16h of focused build time, team member management can be completed before the LAWNS meeting if there is a dedicated 2-day build session. At 25h, it requires 3 days. Given that the self-serve plan already anticipated a pre-August ship window, this is achievable. The risk is scope creep during the implementation session — hold the line at minimal viable (invite + accept + BusinessProvider) and defer the Settings member list.

---

## TASK 8 — Demo-Readiness Check

### Can Ignition's invitation flow be used today to add Erin to LAWNS?

**No.** Three reasons:

1. **Wrong app.** Ignition's invite URL is `ignition-os.vercel.app/?join=SHOP_ID&invite=TOKEN`. Clicking it opens Ignition OS — the diesel shop app — not Cultivar OS. Erin would see an automotive dispatch interface, not a nursery platform.

2. **Wrong Supabase project.** Cultivar OS uses `bgobkjcopcxusjsetfob`. Ignition OS uses `ufsgqckbxdtwviqjjtos`. LAWNS data (plants, orders, metrics) is in the Cultivar project. An Ignition invitation has no access to it.

3. **Wrong auth model.** Ignition staff get PIN accounts (no Supabase auth.users row). Cultivar's `businesses` RLS requires `owner_id = auth.uid()` — a Supabase session is mandatory. An Ignition-enrolled PIN user has no Supabase session and cannot pass Cultivar's RLS check regardless of what URL they visit.

---

### What is the minimum work to enable demo-level access for Erin today?

**The answer is: zero engineering. Use the Supabase SQL editor.**

The team-member-management audit documented this exactly. The manual workaround:

```sql
-- Step 1: Create Erin's Supabase auth account
-- (done via Supabase dashboard → Authentication → Users → Invite User, or she signs up herself)

-- Step 2: Get Erin's user.id from the auth.users table
-- (Supabase dashboard → Authentication → Users → copy the UUID)

-- Step 3: Set Erin as owner temporarily
UPDATE businesses
SET owner_id = '[ERIN_USER_ID]'
WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';

-- [Demo runs — Erin logs in, sees LAWNS dashboard, runs checkout]

-- Step 4: Restore David as owner
UPDATE businesses
SET owner_id = '[DAVID_USER_ID]'
WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';
```

**What Erin experiences:** Logs in at cultivar-os.vercel.app → BusinessProvider resolves LAWNS → full LAWNS dashboard with real metrics, plants, orders → can run QR checkout → can view orders.

**What doesn't work:**
- David and Erin cannot be in the system simultaneously (only one owner_id)
- Erin has full owner access — there's no role differentiation
- No in-app invitation record; no audit trail

**This is the correct answer for the demo.** 15 minutes of Supabase SQL editor time, not 16 hours of engineering.

**For the self-serve product where Erin is permanently a team member of LAWNS:** build the minimal viable invitation flow (16h, Option A, Task 6).

---

## Summary Table

| Question | Answer |
|---|---|
| Does Ignition have working multi-user per tenant? | **Yes** — `shop_members` + `shop_invites` + JoinFlow + IgnitionAdmin are all functional |
| Can Ignition's invitation mechanism be used directly in Cultivar? | **No** — wrong app, wrong Supabase project, wrong auth model |
| Can Ignition's ARCHITECTURE be adopted for Cultivar? | **Yes** — two-table pattern, active flag, single-use token, JoinFlow UX all transfer directly |
| What must change for Cultivar? | Credential: PIN hash → Supabase auth. Delivery: SMS → Resend email. RLS: pilot-open → business_id-scoped |
| Does permission enforcement happen server-side in Ignition? | **No** — all client-side via AccessGatekeeper + DataBridge localStorage |
| Should Cultivar also enforce server-side? | **Yes** — Cultivar has Supabase auth; use RLS to enforce member role, not just frontend conditionals |
| Recommended extraction path? | **Option A** — extract to shared/ using Ignition as template, adapt credential mechanism |
| Effort with Ignition reference? | **16h minimal viable** (invite + accept + BusinessProvider). **25h full** (+ Settings member list) |
| Does it fit in the self-serve plan budget? | **Yes** — 80–89h Tier 1 total, 180h budget, no displacement |
| How to add Erin for the demo today? | **SQL editor owner_id swap** — 15 minutes, zero engineering, documented in Section 6 of team-member-management-audit |

---

*Read-only audit — no code changed. All line numbers reference codebase state as of 2026-06-01.*  
*Build sequence if proceeding: (1) business_members migration, (2) RLS policies on businesses + business_members, (3) BusinessProvider dual-query, (4) invite + accept API endpoints, (5) AcceptInvite.tsx + router, (6) test chain end-to-end before touching Settings UI.*
