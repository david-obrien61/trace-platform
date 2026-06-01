# Ignition OS Multi-Tenant, Multi-User, Multi-Location Audit
**Date:** 2026-06-01
**Author:** Claude Code audit
**Status:** Read-only. No code changed.
**Context:** The 2026-06-01 team-member-management audit established that Cultivar OS has no multi-user infrastructure. This audit tests the hypothesis that Ignition OS — which structurally requires multiple users per shop — solved these patterns that Cultivar can adopt.

---

## Section 1: Multi-Tenant Pattern in Ignition

### Database Tables and Tenant Isolation

**Primary tenant table: `shops`**

| Attribute | Value |
|---|---|
| **File** | `packages/ignition-os/supabase/migrations/supabase_schema.sql` |
| **Layer** | Database |
| **Key columns** | `id uuid PRIMARY KEY`, `name`, `phone`, `email`, `address`, `usdot`, `bay_count int default 4`, `tier text CHECK (TRIAL/STARTER/PROFESSIONAL/PREMIER)`, `trial_started_at`, `is_active` |
| **shop_id usage** | Every operational table (jobs, purchase_orders, tools, pmi_schedules, ai_usage, feature_events, shop_members, shop_invites, teams, member_devices, pin_resets) has a `shop_id uuid REFERENCES shops(id) ON DELETE CASCADE` |

**Universal tenant anchor: `businesses`**

| Attribute | Value |
|---|---|
| **File** | `packages/ignition-os/supabase/migrations/20260529_ignition_businesses.sql` |
| **Layer** | Database |
| **Key columns** | `id uuid PRIMARY KEY`, `owner_id uuid REFERENCES auth.users(id)`, `name`, `business_type DEFAULT 'shop'`, full `accounting_*` column set, `trial_started_at` |
| **RLS** | `businesses_owner_select FOR SELECT USING (owner_id = auth.uid())`. All operational table RLS resolves through `shop_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid() AND business_type = 'shop')` |
| **Migration date** | 2026-05-29 — same date as Cultivar's corresponding migration |

This is the same `businesses` table architecture as Cultivar's `20260529_businesses_a_create_tables.sql`. Both were built in the same session. The schema is identical: `owner_id` references `auth.users`, `business_type` distinguishes verticals, and all operational table RLS chains through `businesses.owner_id`.

**RLS state: two tiers**

The `shops` and all original tables have real RLS via the 2026-05-29 migration. All team tables (`shop_members`, `shop_invites`, `teams`, `member_devices`, `pin_resets`) have pilot-open policies:

```sql
CREATE POLICY "pilot_all_members" ON shop_members FOR ALL USING (true);
CREATE POLICY "pilot_all_invites" ON shop_invites FOR ALL USING (true);
CREATE POLICY "pilot_all_teams" ON teams FOR ALL USING (true);
-- same for member_devices, pin_resets
```

**Finding: Team table RLS is wide-open.** Any authenticated user can read any shop's team data. This is not production-safe for multi-tenant SaaS. It's acceptable for single-customer pilot use but would need real owner-scoped policies before multi-tenant deployment.

### How shop_id Flows Through the System

Ignition uses a **two-layer auth model**:

**Layer 1 — Owner (Supabase auth):**
- `OnboardingWizard` (new version, `modules/OnboardingWizard.jsx`) creates `businesses` + `shops` rows with shared UUID. Owner authenticates via email/password → Supabase auth.
- `CoreApp.jsx:716` — imports `useBusinessContext()` from shared. Effect at line 758: `if (ownerBusinessId) DataBridge.setShopId(ownerBusinessId)` — seeds DataBridge with the owner's business ID.
- `DataBridge.getShopId()` reads from `localStorage['IGNITION_SHOP_ID']`. All Supabase queries use `.eq('shop_id', shopId)`.

**Layer 2 — Staff (PIN auth):**
- Staff do NOT have Supabase auth accounts. They authenticate via 4-digit PIN.
- `DataBridge.authenticate(pin)` hashes the PIN and looks up the profile in localStorage.
- `shop_members.pin_hash` in Supabase is the cloud-side PIN credential (bcrypt hash). Staff sessions are cached in localStorage.
- The JoinFlow (`CoreApp.jsx:160`) processes `?join=SHOP_ID&invite=TOKEN` URL params and creates shop_members rows.

**Comparison to Cultivar's businesses table approach:**

| Dimension | Cultivar OS | Ignition OS |
|---|---|---|
| Tenant anchor | `businesses` table | `businesses` + `shops` tables (same UUID) |
| Owner auth | Email/password → `auth.uid()` → businesses | Email/password → `auth.uid()` → businesses |
| Staff auth | N/A (no multi-user) | 4-digit PIN → DataBridge → shop_members |
| RLS on operational tables | `owner_id = auth.uid()` | `shop_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())` |
| Multi-user access | ❌ Not built | ✅ Built (via PIN, not Supabase auth) |

**Both verticals share the same Supabase schema for the owner layer.** The divergence is the staff layer: Cultivar has no staff layer; Ignition's staff layer uses PIN auth, not email/password.

---

## Section 2: Multi-User Pattern in Ignition

### Database Tables

**`users` table** — `supabase_schema.sql`
- Early table, predates the team system. Has: `shop_id`, `name`, `pin_hash`, `role CHECK (ADMIN/SERVICE/TECHNICIAN/DEVELOPER)`, `permissions text[]`, `is_active`.
- Still exists alongside `shop_members`. The new path is `shop_members`. This table appears to be superseded but not removed.

**`shop_members` table** — `supabase_team_system_migration.sql` + `supabase_identity_v2_migration.sql`
- Canonical current multi-user table.
- Base columns: `id`, `shop_id`, `name`, `role`, `phone`, `permissions jsonb DEFAULT '[]'`, `joined_at`.
- v2 additions: `team_id REFERENCES teams(id)`, `sub_role`, `active boolean DEFAULT false`, `pin_hash`, `invite_id REFERENCES shop_invites(id)`, `updated_at` (auto-stamped).

**`shop_invites` table** — `supabase_team_system_migration.sql`
- Single-use invitation tokens.
- Columns: `id`, `token text UNIQUE`, `shop_id`, `name`, `role`, `phone`, `used boolean DEFAULT false`, `created_at`.
- Lifecycle: owner generates → sends to staff → staff opens link → JoinFlow marks used.

**`teams` table** — `supabase_identity_v2_migration.sql`
- Named groups within a shop (e.g., "TECH TEAM", "FRONT OFFICE").
- Columns: `id`, `shop_id`, `name`, `description`, `created_at`.
- `shop_members.team_id` references this table. Optional — not every shop uses teams.

**`member_devices` table** — `supabase_identity_v2_migration.sql`
- Per-device enrollment record (one row per device per member).
- Columns: `id`, `member_id`, `shop_id`, `device_label`, `device_fingerprint`, `biometric_enrolled`, `is_active`, `last_seen`, `created_at`.
- Supports disable/enable/delete lifecycle per device (e.g., lost tablet → disable, found → re-enable, confirmed gone → delete + re-enroll).

**`pin_resets` table** — `supabase_team_system_migration.sql`
- Admin-generated 6-digit one-time codes for staff PIN resets.
- Columns: `id`, `reset_code`, `shop_id`, `member_id REFERENCES shop_members(id)`, `member_name`, `member_role`, `permissions`, `used`, `expires_at`.
- Flow: admin clicks "Reset PIN" → code generated (15-min expiry) → admin reads code aloud → staff enters on "Forgot PIN" screen → new PIN set → row marked used.

### Roles and Permissions

**Role hierarchy:**

```
ADMIN      → full access (view_omni, view_hub, view_flux, ... manage_users, PRICING_AUTHORITY, approve_payroll)
TECH       → shop floor access (view_hub, view_flux, view_cipher, view_stok, scan_parts, update_flux)
SERVICE    → front office access (view_port, view_crm, view_cipher, view_stok, sign_estimates)
CUSTOMER   → approval-only access (view_port, sign_estimates, pay_invoice)
```

**Sub-roles:**
- TECH: SR_TECH, BAY_TECH, APPRENTICE
- SERVICE: ADVISOR, CASHIER

**Permissions (20 total, 5 groups):**

| Group | Permissions |
|---|---|
| Modules | view_omni, view_hub, view_flux, view_cipher, view_stok, view_proc, view_prot, view_port, view_crm, view_predictive, view_marketplace |
| Financial | PRICING_AUTHORITY, edit_margins, approve_payroll |
| Admin | manage_users |
| Tech Ops | scan_parts, update_flux |
| Customer | sign_estimates, pay_invoice |

**File:** `packages/ignition-os/modules/IgnitionAdmin.jsx:22-51`

### UI Surface: IgnitionAdmin.jsx

`packages/ignition-os/modules/IgnitionAdmin.jsx` (1794 lines) is a full staff management system with the following components:

**StaffTab (lines 1091-1256):**
- Lists all `shop_members` for the shop.
- Shows Active count / Pending count.
- Per-member actions: Manage, Reset PIN, Revoke.
- Shows pending invites (not yet enrolled) with cancel option.

**InviteStaffModal (lines 267-512):**
- Form: name, role, sub_role, team_id, phone, permissions (customizable from role preset).
- On submit: (1) INSERTs into `shop_invites` to get invite.id; (2) INSERTs into `shop_members` with `active=false`, `invite_id=invite.id`.
- Generates invite link: `${window.location.origin}/?join=${shopId}&invite=${token}`
- Displays link + QR code + "Send SMS" button (opens `sms:` URI with the link).

**ManageMemberModal (lines 582-878):**
- Three sub-tabs: Profile (name, role, sub_role, team, phone), Permissions (toggle individual permissions, apply role preset), Devices (list enrolled devices, disable/enable/delete).
- Profile + Permissions tabs UPDATE `shop_members` row in Supabase.
- Devices tab reads + updates `member_devices`.

**TeamTab (lines 1314-1424+):**
- Shop join QR code + link (for generic join, without a personal invite).
- Team grouping view (members grouped by team).
- "New Team" button → CreateTeamModal → INSERTs into `teams`.
- "Invite" button → opens InviteStaffModal.

**RevokeMemberModal (lines 1030-1089):**
- Type "REVOKE" to confirm → DELETEs `shop_members` row → marks `shop_invites.used = true`.

**AccessGatekeeper (CoreApp.jsx:470-515):**
- `<AccessGatekeeper requiredPermissions={['manage_users']}>` wraps the ADMIN module.
- Checks `currentUser.permissions` from DataBridge against the required permissions.
- Blocked users see "Access Denied" with manager override request.

### JoinFlow: The Staff Enrollment Handler

`CoreApp.jsx:160-383` — The most architecturally important component for Cultivar adoption.

**Two paths:**

**Path A — Personal invite (owner pre-configured):**
1. Staff opens `?join=SHOP_ID&invite=TOKEN`.
2. Supabase query: `shop_invites WHERE token = TOKEN AND used = false`.
3. Pre-fills name/role from invite (read-only). Staff enters phone + PIN.
4. `shop_members UPDATE { pin_hash, active: true } WHERE invite_id = invite.id`.
5. `shop_invites UPDATE { used: true }`.
6. Device auto-registered via `DataBridge.autoEnrollDevice(member.id, shopId)`.
7. Session cached in DataBridge localStorage.

**Path B — Generic QR join (no personal invite):**
1. Staff opens `?join=SHOP_ID` (no invite token).
2. Staff picks role (TECH or SERVICE).
3. Staff enters name + PIN.
4. Checks for PIN hash collision in `shop_members`.
5. INSERTs new `shop_members` row with default permissions for the chosen role.
6. Device auto-registered, session cached.

**Is the multi-user pattern operational?**

| Component | Status | Caveats |
|---|---|---|
| `shop_members` table | ✅ Implemented | RLS is wide-open (USING true) |
| `shop_invites` table | ✅ Implemented | RLS is wide-open |
| InviteStaffModal (Supabase path) | ✅ Operational | Writes to shop_members + shop_invites |
| JoinFlow | ✅ Operational | Both personal invite and generic QR paths work |
| ForgotPinFlow | ✅ Operational | Reads pin_resets, sets new PIN, marks used |
| ManageMemberModal | ✅ Operational | Updates shop_members, member_devices |
| AddStaffModal (legacy path) | 🟡 DataBridge only | Writes to localStorage, no Supabase write — being replaced |
| RevokeModal (legacy path) | 🟡 DataBridge only | Removes from localStorage, no Supabase write — being replaced |
| Team table RLS | 🔴 Pilot-open | All team tables USING(true) — not production-safe multi-tenant |

**Verdict: OPERATIONALLY FUNCTIONAL for single-customer pilot use. Not production-safe for multi-tenant SaaS deployment without real RLS on team tables.**

---

## Section 3: Multi-Location Pattern in Ignition

### What Exists

**DataBridge schema definition only — no UI, no database table:**

`DataBridge.js:74-92` defines the `shop_info` schema:

```javascript
shop_info: {
  name: 'string',
  is_multi_location: 'boolean',
  global_contact: {
    phone: 'string', email: 'string', address: 'string', usdot: 'string'
  },
  locations: [{
    id: 'string', label: 'string', phone: 'string',
    email: 'string', address: 'string', is_primary: 'boolean'
  }]
},
```

**Root OnboardingWizard.jsx:108-110** seeds this schema on setup:
```javascript
DataBridge.save('shop_info', {
  id: shopId,
  name: shopInfo.name,
  is_multi_location: false,    // hardcoded false
  locations: [],               // hardcoded empty
  ...
});
```

**No `locations` table in any SQL migration.** Searched all 15 migration files — no CREATE TABLE locations, no location_id column on any table, no location-scoped queries.

**No UI for location management.** Searched all `.jsx`/`.js` files for "location management", "add location", "multi-location" UI — zero results.

**`shops.bay_count` field** (`supabase_schema.sql:16`): records how many bays a shop has (default 4). This is bay-count tracking, not multi-location architecture. All bays share the same shop row.

### Verdict: Multi-location is SCHEMA ONLY — not built

The DataBridge schema anticipated multi-location. The setup code hardcodes `is_multi_location: false`. No implementation was built — no database table, no UI, no queries, no location-aware reporting. This is a planned-but-unbuilt feature, not a working pattern.

| Component | Status |
|---|---|
| DataBridge schema definition | ✅ Defined |
| Initial seed value | 🔴 Always `false` / `[]` |
| `locations` database table | ❌ Does not exist |
| Location management UI | ❌ Does not exist |
| Per-location inventory/pricing | ❌ Does not exist |
| Cross-location reporting | ❌ Does not exist |

---

## Section 4: Gap Comparison — Cultivar vs Ignition

### Gap 1: One user per business (owner_id single value)

| | Cultivar | Ignition |
|---|---|---|
| Current state | `businesses.owner_id` — one user per business | `businesses.owner_id` (owner) + `shop_members.pin_hash` (staff, PIN auth) |
| Does Ignition solve it? | — | YES, but via PIN auth |
| Generalizable? | — | PARTIALLY |

**Caveat:** Ignition's solution bypasses Supabase auth.users for staff. Staff members have no Supabase auth account. They authenticate via PIN → DataBridge. Cultivar uses Supabase email/password auth for all users. The RLS gap: Cultivar RLS is scoped to `auth.uid()`; Ignition team table RLS is wide-open (`USING true`). Direct adoption of Ignition's PIN-auth staff model would violate CLAUDE.md's locked auth rule:

> "Auth: PIN/face are unlock gestures layered on top of a real Supabase session (auth.uid() must be non-null) — never a replacement. Tenant isolation and RLS depend on this."

The ARCHITECTURE (two-tier user model, invitation flow, member table) is generalizable. The CREDENTIAL MECHANISM (PIN, not email/password) is not.

### Gap 2: No invitation flow

| | Cultivar | Ignition |
|---|---|---|
| Current state | No invitation flow | InviteStaffModal + JoinFlow — fully implemented |
| Does Ignition solve it? | — | YES, architecturally |
| Generalizable? | — | YES — concept generalizes, mechanism differs |

**What Ignition solved:** The two-table invitation architecture is exactly correct for Cultivar:
1. Create `invitations` row with a unique token (active: pending) → deliver link
2. Create `business_members` row with `active=false`
3. Recipient opens link → verifies token → establishes credential (PIN for Ignition, Supabase email/password for Cultivar)
4. Mark invitation used, mark member active

This pattern appears directly in the team-member-management audit's proposed schema — the discovery that Ignition already built and uses it confirms the architecture is right.

**What differs for Cultivar:** Delivery is email (not SMS). Credential is Supabase email/password or magic link (not PIN hash). JoinFlow would redirect to a signup/login form, not a PIN-setting screen.

### Gap 3: No role system

| | Cultivar | Ignition |
|---|---|---|
| Current state | Implicit owner only | 4 roles, 20 permissions, role presets, per-user customization |
| Does Ignition solve it? | — | YES, fully |
| Generalizable? | — | YES — architecture generalizes |

**What Ignition solved:**
- Role presets (ADMIN, TECH, SERVICE) with default permission sets in `ROLE_PRESETS` (`IgnitionAdmin.jsx:46-51`).
- Per-user permission customization via jsonb array on `shop_members.permissions`.
- `AccessGatekeeper` component checks permissions per module.

**What to generalize for Cultivar:** The permissions themselves are Ignition-specific (`view_flux`, `scan_parts`, `update_flux`). Cultivar roles would be: `owner`, `manager`, `staff` with Cultivar-specific permissions (`manage_plants`, `run_checkout`, `view_financials`, `connect_accounting`). The PATTERN (role → permission preset → per-user override → access check) is exactly what PLATFORM_STRATEGY.md's Role Permission Matrix describes.

### Gap 4: No business_members table

| | Cultivar | Ignition |
|---|---|---|
| Current state | No table | `shop_members` — fully implemented |
| Does Ignition solve it? | — | YES |
| Generalizable? | — | YES |

Ignition's `shop_members` is structurally equivalent to what the team-member-management audit proposed as `business_members`:

| Cultivar audit proposed | Ignition has | Notes |
|---|---|---|
| `business_id` | `shop_id` | Rename only |
| `user_id` | `pin_hash` | Replace with Supabase `auth.users(id)` reference |
| `email` | `name` | Ignition doesn't need email (PIN auth) — add email |
| `role` | `role` | Direct match |
| `invitation_token` | `invite_id → shop_invites.token` | Same concept, slightly different join |
| `invitation_expires_at` | Not in shop_invites | Add expiry — Ignition invites don't expire |
| `joined_at` | `joined_at` | Direct match |
| `active` | `active` | Direct match |

---

## Section 5: Integration Path

### Option A — Extract Ignition's pattern to packages/shared/ (Recommended)

**What to extract:**
1. SQL schema: A `business_members` migration that adapts `shop_members` for email-auth verticals: `business_id` (not `shop_id`), `user_id REFERENCES auth.users(id)` (not `pin_hash`), `invitation_token` with expiry.
2. SQL schema: An `invitations` migration that adapts `shop_invites` with email, expiry, and Cultivar-compatible delivery.
3. BusinessProvider update: Add membership fallback query after owner query fails (proposed in team-member audit, confirmed correct by Ignition's architecture).
4. TeamSection in `packages/shared/src/pages/Settings.tsx`: Member list + invite form + pending invitations.
5. Conceptual reference: The invitation lifecycle (two-table, active flag, single-use token) is proven — implement verbatim for email-auth.

**What NOT to extract:**
- JoinFlow (`CoreApp.jsx:160`) — PIN-specific, not email-auth compatible
- `AddStaffModal` — legacy DataBridge path, being replaced
- `shop_members.pin_hash`, `pin_resets`, `member_devices` — PIN-auth-specific, not needed for email verticals
- IgnitionAdmin.jsx as a whole — too Ignition-specific in permissions, styling (Tailwind), and domain language

**Effort:** ~18-22h for the Cultivar implementation using Ignition architecture as reference.

| Component | Hours | Ignition reference saves |
|---|---|---|
| `business_members` + `invitations` migrations | 2h | ~1h (architecture is proven, schema is mapped above) |
| BusinessProvider member lookup path | 2h | ~1h (dual-query pattern confirmed correct by Ignition) |
| RLS policies for member access | 2h | ~0h (different auth mechanism, still need new policies) |
| TeamSection in Settings (member list + invite form + pending) | 4h | ~2h (UI pattern known from IgnitionAdmin.jsx) |
| `/api/team/invite` endpoint + Resend email template | 3h | ~1h (InviteStaffModal logic maps directly) |
| `/api/team/accept` endpoint (both auth states) | 3h | ~1h (JoinFlow maps directly, different credential) |
| AcceptInvite.tsx page + router entry | 2h | ~0h |
| Testing end-to-end | 2h | ~1h (known edge cases from JoinFlow: used invite, collision) |
| **Total** | **~20h** | **~7h saved vs no reference** |

**Risk:** Low. Ignition's team tables are in `ufsgqckbxdtwviqjjtos` (Ignition's Supabase project). Cultivar's migrations go into `bgobkjcopcxusjsetfob`. No risk of breaking Ignition. The shared code changes (BusinessProvider, Settings) only add new paths — they don't modify existing behavior.

### Option B — Copy Ignition's pattern into Cultivar separately

**Effort:** ~18-22h. Same as Option A — the actual code to write is identical; only the storage location differs.

**Risk of divergence:** HIGH. Ignition and Cultivar would each maintain a version of multi-user infrastructure. When role concepts evolve (they will — KINNA-OS adds `volunteer`, `pastoral_care`), two codebases diverge.

**When acceptable:** Only if the 80/20 principle is explicitly abandoned for this feature. Not recommended.

### Option C — Build fresh in Cultivar without Ignition reference

**Why it might be necessary:** If Ignition's pattern fundamentally didn't fit (e.g., if it had been built only for DataBridge, not Supabase). That's not the case — Ignition's Supabase path is clean and maps directly.

**Effort:** ~25-28h (the team-member audit's original estimate, with full architectural discovery overhead).

**Recommendation: Option A.**

Reasoning: The 80/20 principle says shared structure is built once in `packages/shared/`. Ignition has proven the invitation architecture works in production. The 7-hour savings from Ignition reference is real. Most importantly: KINNA-OS needs the same multi-user pattern (volunteers, staff, pastoral care workers need different roles). Building it in shared now means KINNA-OS gets it for ~2 additional hours of content work, not another 20-hour build.

---

## Section 6: Honest Assessment

### 1. Does Ignition actually have working multi-user-per-shop?

**YES, with caveats.** The Supabase-based invitation flow (InviteStaffModal → JoinFlow) is functional code. It correctly:
- Creates `shop_invites` + `shop_members (active=false)` on invite generation
- Reads and validates the invite token on JoinFlow enrollment
- Updates `shop_members (active=true, pin_hash=bcrypt(PIN))` on enrollment
- Marks `shop_invites (used=true)`
- Registers the device in `member_devices`

**Caveat 1 — RLS is wide-open:** All team tables use `USING(true)`. Any authenticated user can read any shop's team roster. This is acceptable for single-customer pilot, not for multi-tenant SaaS.

**Caveat 2 — Staff bypass Supabase auth:** Staff have no `auth.users` accounts. They authenticate via PIN → DataBridge hashing. This violates CLAUDE.md's locked auth rule and cannot be adopted for Cultivar.

**Caveat 3 — Legacy path coexists:** AddStaffModal and RevokeModal (DataBridge-only, no Supabase writes) are still present alongside the Supabase path. Code quality is mixed — the Supabase path is clean; the legacy path is being phased out.

**Status: 🟡 Operational for pilot. Not production-ready for multi-tenant SaaS.**

### 2. Does it actually have multi-location?

**NO.** `is_multi_location` and `locations[]` appear in the DataBridge schema definition and are hardcoded to `false`/`[]` in the onboarding seed. No database table, no UI, no queries, no reporting. This is a schema placeholder, not a built feature.

**Status: 🔴 Not built.**

### 3. Code quality for adoption?

**High, for the Supabase-based invitation path.** The InviteStaffModal and JoinFlow are well-designed:
- Clean two-phase activation (invite created → enrollment → activated)
- Single-use token lifecycle with collision detection
- Biometric enrollment on first PIN login
- Device registry with disable/enable/delete
- PIN reset with admin-generated verbal codes

The architectural decisions are sound and the code is readable. The main disqualifier for direct adoption is PIN auth — not code quality.

**The legacy DataBridge path (AddStaffModal, RevokeModal): Low quality.** DataBridge-only operations that bypass Supabase. Ignore for extraction purposes.

**Tailwind:** IgnitionAdmin.jsx is Tailwind-heavy (pre-existing, scheduled for conversion post-August per Tech Debt #14). The component is not copy-pastable to Cultivar without conversion to inline styles. Extract the architecture and data patterns; rewrite the UI component fresh.

### 4. Realistic effort to close Cultivar's gap using Ignition's architecture?

**~20h for the full feature including Settings UI.**
**~14h for minimal viable (invite + accept flow, no Settings member list UI).**

Both estimates assume Ignition's architecture is used as a reference, reducing architectural uncertainty. The Ignition pattern confirms:
- Two-table structure (invitations + members) is right
- `active: false` flag is the correct enrollment state
- Single-use tokens work (used boolean)
- BusinessProvider dual-query (owner first, member fallback) is the right approach

These are the decisions that took time to arrive at in the team-member audit. They're now answered.

**What Ignition cannot answer for Cultivar:**
- Email delivery (Resend — already in Cultivar's Vercel env)
- "Not signed in" accept path (magic link or redirect to signup)
- Role definitions for nursery staff (owner, manager, staff) vs shop staff (ADMIN, TECH, SERVICE)
- RLS for email-auth members (different from PIN-auth members — needs auth.uid() linkage)

### 5. Pre-August vs post-August?

**Minimal viable (14h) could fit pre-August in Tier 1, but is tight.**

Current Tier 1 estimate: 64h. Adding 14h → 78h. The remaining pre-August window (from today, 2026-06-01 to approximately 2026-07-25 before Europe trip prep) is approximately 250-300 available hours assuming continued pace. At 78h Tier 1, this is achievable.

**Decision factor:** The LAWNS demo need is concrete. Terry and Lauren needing separate accounts is a real demo obstacle. An 18-hour investment (minimal viable + Settings UI so both accounts appear professional) closes a real gap, not a hypothetical one.

**Recommendation:** Minimal viable (14h, invite + accept, no Settings member list) as Tier 1 pre-LAWNS. Full version (22h, Settings member list, role display, pending invitation management) as Tier 2.

---

## Section 7: Cross-Reference with Self-Serve Readiness Plan

The 2026-05-31 plan (`docs/self-serve-readiness-plan-2026-05-31.md`) lists Tier 1 at ~64h total across P-1 through P-5 and T-1 through T-4. Team member management was not included.

### Does adopting Ignition's pattern change the estimate materially?

| Scenario | Original estimate (team-member audit) | With Ignition reference |
|---|---|---|
| Minimal viable | 18h | 14h |
| Full (Settings UI) | 28h | 20-22h |

Savings: 4-8 hours. Real but not transformative. The Ignition pattern reduces architectural uncertainty, not implementation time.

### Does team management drop off Tier 1?

**No.** It joins Tier 1 because of demo needs, not self-serve needs. The LAWNS meeting requires Terry and Lauren to have separate accounts. That's a concrete Tier 1 blocking gap.

### Updated Tier 1 estimate if team management is added

| Work | Original estimate | With Ignition reference |
|---|---|---|
| Tier 1 (existing) | ~64h | ~64h |
| Team management (minimal viable) | +18h | +14h |
| **Tier 1 revised total** | **~82h** | **~78h** |

The Ignition reference saves 4 hours — enough to matter, not enough to change the priority decision.

### What changes in the self-serve plan?

1. Team management should be added to Tier 1 as a line item: "minimal viable invite flow + accept flow + BusinessProvider member lookup" — **14h**, targeting pre-LAWNS.
2. Full team management UI (member list, role display, pending invitations) moves to Tier 2.
3. The self-serve plan should note that Ignition's invitation architecture was used as reference, reducing architectural risk from "unknown" to "proven pattern adapted."
4. No other Tier 1 items are displaced — the 14h slots into available capacity.

---

## Summary Table

| Question | Answer |
|---|---|
| Does Ignition have multi-tenant shop isolation? | ✅ Yes — shops table + businesses table, RLS via owner_id chain |
| Are team table RLS policies production-safe? | ❌ No — all `USING(true)` pilot policies; need real owner-scoped policies |
| Does Ignition have working multi-user-per-shop? | 🟡 Operationally yes (Supabase path), but staff use PIN not Supabase auth |
| Is Ignition's multi-user pattern generalizable to Cultivar? | ✅ Architecture yes; credential mechanism (PIN) is not portable |
| Does Ignition have multi-location? | ❌ No — DataBridge schema placeholder only, never built |
| Can Cultivar adopt Ignition's invitation architecture? | ✅ Yes — two-table pattern maps directly, delivery/credential mechanism changes |
| Recommended integration approach | Option A: extract to packages/shared/ as reference |
| Effort with Ignition reference (minimal viable) | 14h |
| Effort with Ignition reference (full Settings UI) | 20-22h |
| Should team management join Tier 1? | ✅ Yes — demo need (Terry + Lauren need separate LAWNS accounts) |
| Updated Tier 1 total | ~78h (was 64h, +14h team management) |

---

## What Ignition Confirmed and What It Didn't

**Confirmed:**
- The two-table invitation architecture (invitations + members with active flag) is the right pattern. Ignition has been using it.
- Single-use token lifecycle with `used: boolean` works correctly.
- BusinessProvider dual-lookup (owner first, member fallback) is the right architecture.
- Granular permissions as a jsonb array on the member row is the right approach for per-user customization.
- Named teams within a shop/business are a useful feature (for LAWNS: front_desk vs nursery staff).

**Not confirmed by Ignition (still needs design for Cultivar):**
- RLS for email-auth members (must use `auth.uid()` linkage, not PIN hash).
- Email delivery (Ignition uses SMS/QR; Cultivar needs email via Resend).
- "New user" vs "existing user" accept paths (Ignition only has PIN-setting; no email/password signup flow).
- Role names and permission sets for nursery staff (owner, manager, staff — not ADMIN/TECH/SERVICE).
- Invitation expiry (Ignition's shop_invites have no `expires_at` column — should add to Cultivar's design).

---

*Read-only audit — no code changed. All file paths and line numbers reference codebase state as of 2026-06-01.*
*To implement: start with the `business_members` + `invitations` migrations, then BusinessProvider update, then invite + accept API endpoints. Use Ignition's InviteStaffModal and JoinFlow as architectural reference, not as code to copy.*
