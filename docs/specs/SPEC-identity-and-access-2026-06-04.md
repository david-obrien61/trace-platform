# SPEC — Shared Identity & Access Capability

**Date:** 2026-06-04
**Status:** SPEC (not yet built). Decision locked this session: build once in `packages/shared`, both verticals consume. Demo pushed to land this polished.
**Author:** Lightning (strategy session) — to be built by Thunder against this spec.
**Supersedes:** the per-vertical auth/PIN/device code currently in Ignition and Cultivar. This is the third build of this feature; this time it is specced first and built shared.

---

## 0. Why this exists (the decision)

This capability has now been built **twice** — once in Ignition, once (rebuilt from scratch) in Cultivar. That double-build is what proved it is a *shared platform capability*, not a vertical feature. The lesson is paid for. This spec is collecting on it.

Tonight's lockout (signed in as owner, but trapped at the PIN gate with an empty `shop_members` table, `member_devices`/`pin_resets` 404ing) was not a random bug. It was the **device/member layer being half-built** — and it is half-built because the multi-tenant extraction (`20260602_ignition_drop_team_tables.sql`) dropped `shop_members`, `member_devices`, and `pin_resets`, while the code kept calling them. `shop_members` was later recreated; `member_devices` and `pin_resets` were not. The feature has no single source of truth.

**The rule this spec enforces (AC-4):** settle the access model once, encode it as shared tables + a shared component + config variables, and have every vertical *consume* it. Never reimplement per vertical. This is the forcing function that also resolves the `businesses`-vs-`shops` / `users`-vs-`employees`-vs-`shop_members` split-brain.

---

## 1. The model: two layers, named clearly

Access is **two distinct layers**. Tonight's bugs all came from these two being conflated or half-wired.

### Layer 1 — Identity ("who are you, as a person")
- **Mechanism:** Supabase Auth, email + password. One identity per human, platform-wide (one auth user per email per project — this is fixed by Supabase, do not fight it).
- **Used for:** establishing the person, password recovery, the durable account.
- **Recovery:** email-based password reset (Section 5a).
- **Frequency:** rare — at first setup, on a new device, after logout, on password reset.

### Layer 2 — Device Session ("quick re-entry on THIS device")
- **Mechanism:** a per-member PIN, unlocking a **registered device**.
- **Used for:** fast re-entry on shared/known hardware — the counter tablet, the tech's shop phone, the owner's personal phone — without re-typing a password every time.
- **Recovery:** manager-issued reset code (Section 5b), **with an owner self-recovery path** (the gap that locked David out tonight — the owner has no manager above them).
- **Frequency:** constant — every shift change, every pickup of the counter tablet.

**Why two layers (the real-business rationale):** a small business is inherently multi-person and multi-device with shared hardware. Password-per-action would be miserable on a counter tablet used by whoever's on shift. The PIN layer exists precisely so identity is established once (Layer 1) and re-entry is fast per device (Layer 2). This is correct modeling of how a shop/nursery actually operates — not over-design.

---

## 2. The device model — `member_devices` (the missing spine)

This is the table whose absence caused tonight's 404s. It is the spine that ties **members** to **devices** and makes "own mobile / business mobile / business tablet / own tablet" real.

### Device classes to support (from David's model)
- **Own mobile** — a member's personal phone (owner checking from home)
- **Business mobile** — a shared shop/nursery phone (tech in the bay)
- **Business tablet** — the counter/POS tablet, shared across shift workers
- **Own tablet** — a member's personal tablet

A member may register **N devices**. A device belongs to a **business** and is associated with the **member(s)** allowed to unlock it.

### Proposed shape (vertical-agnostic — AC-1)
```
member_devices
  id            uuid    PK
  business_id   uuid    NOT NULL  FK -> businesses(id)   -- NOT shop_id / nursery_id
  member_id     uuid    nullable  FK -> business_members(id)  -- who enrolled / owns it
  device_name   text    NOT NULL  -- "Counter tablet", "David's iPhone"
  device_class  text    NOT NULL  -- own_mobile | business_mobile | business_tablet | own_tablet
  device_token  text    -- opaque per-device identifier (NOT a credential)
  trusted       boolean NOT NULL DEFAULT false
  last_seen_at  timestamptz
  revoked       boolean NOT NULL DEFAULT false
  created_at    timestamptz NOT NULL DEFAULT now()
```

### Lifecycle to spec & build
- **Enroll:** first time a device is used, register it (named, classed, associated to business + member).
- **Trust:** a device can be marked trusted (e.g. shop-owned hardware) vs. one-off.
- **Revoke:** owner/manager can revoke a device (lost phone, departed employee) — kills its sessions.
- **List:** Admin → Devices view showing all registered devices per business, who/what, last seen.

> NOTE: the current code GETs/POSTs `/rest/v1/member_devices` and 404s because the table was dropped June 2 and never recreated. Recreate it under the **business_id-scoped, vertical-agnostic** shape above — do not recreate the old `shop_`-named version.

---

## 3. PIN model — done right (bcrypt, not fast SHA-256)

### Current state (to replace)
- PIN stored in `shop_members.pin_hash` as **SHA-256 of `"{shopId}:{pin}"`**, compared by string equality (`DataBridge.js`, `shared/src/supabase/auth.ts`).
- **Problem:** SHA-256 is a *fast* hash. A 4-digit PIN has only 10,000 possible values. Anyone with read access to `pin_hash` can brute-force the PIN back to its 4 digits in milliseconds (hash `{id}:0000`..`{id}:9999`, match). The `{id}:` prefix acts as a per-tenant salt — it blocks a shared rainbow table across businesses, but does **not** stop a targeted brute-force of one row. Effectively the PINs are recoverable by anyone who can read the table.

### Target
- **Hash with bcrypt or argon2** (deliberately slow → brute-forcing 10,000 candidates becomes meaningfully expensive).
- Per-member, salted by the hashing algorithm's own salt (not a hand-rolled prefix).
- **Lockout after N failed attempts** (e.g. 5) with a cooldown — a 4-digit space *needs* rate limiting regardless of hash, since 10,000 is small.
- Verify = bcrypt/argon2 compare, not string equality.

### Storage note (the `1234` incident)
The plaintext `1234` seen in `pin_hash` tonight was **manually hand-entered by David during debugging** (typed the PIN into the hash field by mistake) — it is **not** evidence of a code path writing plaintext. Action item is *verify* the normal signup write path hashes correctly, not *fix* a known plaintext bug. (Still: with bcrypt migration, re-confirm the write path.)

---

## 4. Identity table reconciliation (kills the split-brain)

You cannot build shared auth on two competing org models. Speccing this **forces** the choice. Resolve these before/while building:

| Concept | Competing tables seen | Canonical (proposed) | Notes |
|---|---|---|---|
| The business/org | `businesses` (Cultivar/shared) vs `shops` (Ignition) | **`businesses`** | `business_type` discriminates (`'nursery'`, `'shop'`). `shops` should be retired or be a view. Sign-in already resolves against `businesses`. |
| People at the business | `business_members` (shared) vs `shop_members` (Ignition) vs `users` vs `employees` | **`business_members`** | The PIN gate currently reads `shop_members` while identity resolves via `businesses.owner_id` — that mismatch *is* the split-brain. Unify on `business_members`. |
| Per-business config | `nursery_profiles` (erroring 406 in Cultivar tonight) | **`business_profiles`** or `vertical_profiles` | Already flagged in the June-3 naming audit (Finding #2). |
| Devices | `member_devices` (dropped, 404ing) | **`member_devices`** (recreated, `business_id`-scoped) | Section 2. |

**The split-brain, stated plainly:** tonight you could *sign in* (owner path → `businesses`) but could not *pass the PIN* (PIN gate → empty `shop_members`). Two halves of one auth system reading two different tables. Unifying on `business_members` + `member_devices`, both `business_id`-scoped, is the cure.

---

## 5. Recovery flows (both layers)

### 5a. Password reset (Layer 1 — Identity) — David's spec, verbatim intent
1. User clicks "Forgot password" → enters email.
2. System sends a recovery link: `supabase.auth.resetPasswordForEmail()`.
3. Link opens a "set new password" screen (the link itself creates a temporary recovery session — that's how Supabase authorizes the change).
4. User sets new password: `supabase.auth.updateUser({ password })`.
5. **Explicitly sign out** after the change.
6. Route to login; user signs in fresh with the new password.

- **Shared:** build in `packages/shared` (e.g. `shared/src/auth/PasswordReset.tsx` + the screen for step 3). Every vertical consumes it. **Do not** build local-to-Ignition.
- **Keep separate from PIN reset** — different layer, different mechanism. Do not merge.

### 5b. PIN reset (Layer 2 — Device) — fix the owner gap
- **Existing design (good UX):** FORGOT PIN → "Ask your manager to generate a reset code in Admin → Team" → enter 6-digit code → set new PIN. The screen exists and the set-new-PIN path works.
- **Backing table:** references `pin_resets`, which **does not exist** (dropped June 2). The recovery flow is currently **non-functional** — recreate the table (`business_id`-scoped) or repoint to the canonical reset store.
- **Reset codes must be hashed + short-lived** — the 1-hour expiry is good; the codes were plaintext (`reset_code text`), so hash them too.
- **AUTHORIZATION GAP (important):** the verify step matches `reset_code + shop_id + used=false + expires_at >= now()` with **no check that the requester is authorized to reset this business's PIN.** Anyone who can write a `pin_resets` row (or read a code) can mint ADMIN access. This is an unauthenticated privilege-escalation path. Add an authorization check tied to identity (the requesting member / owner), not just code-match.
- **OWNER SELF-RECOVERY (the gap that locked David out):** the reset generator lives in Admin → Team, which is *behind* the PIN gate. A staffer locked out has a manager above them to generate a code. The **top-level owner has nobody above them** → chicken-and-egg lockout. Spec an owner self-recovery path: e.g. owner re-verifies via their **Layer-1 identity (email/password or email link)** to generate their own device reset code. Identity should always be able to rescue Device.

---

## 6. Vertical-agnostic requirement (AC-1) — non-negotiable

Everything in this capability lives in `packages/shared` and is consumed identically by all verticals. Concretely:
- Tables: `business_members`, `member_devices`, `business_profiles` — **`business_id`-scoped, no `shop_`/`nursery_` nouns** in tables, columns, RLS policy names, routes, or identifiers.
- Component: one shared sign-in / PIN / device flow, configured per vertical only by **color token + `business_type` + labels** (the design-standard pattern — structure shared, color the only vertical variable).
- RLS: membership-scoped to `business_id` by default (AC-2); any looser policy documented with WHY + Exception Log.
- This is what makes "build once, both consume" real instead of "copy Ignition to Cultivar" (which produced the divergence in the first place).

---

## 7. Acceptance criteria (STD-002 — prove it, both verticals)

The capability is **Promise-Complete**, not Screen-Complete, when ALL of these pass in **both Ignition and Cultivar**, on a **cleared session**:

1. **New owner signup** → identity created → `business_members` row created (insert failure HALTS, does not silently `onSuccess`) → device enrolled → reach dashboard.
2. **Returning owner, session cleared** → email/password sign-in → reach dashboard.
3. **PIN unlock on a registered device** → correct PIN → in; wrong PIN → rejected; N wrong → lockout.
4. **Password reset** → email link → set new password → logged out → sign in fresh with new password → in.
5. **PIN reset (staff)** → manager generates code in Admin → enter → set new PIN → in.
6. **PIN reset (owner, no manager)** → owner self-recovery via identity → set new PIN → in. *(closes tonight's gap)*
7. **Device list/revoke** → owner sees registered devices, can revoke one, revoked device's session dies.
8. **Tenant isolation** (STD-004) → two businesses, no data bleed across either layer.
9. **No 404/400s** from `member_devices`, `pin_resets`, or member/profile lookups in either console.

---

## 8. Build sequencing (post-demo)

This is foundational (everything sits on auth) — build it carefully, not tired, likely with Andrew. Suggested order:

1. **Reconcile identity tables** (Section 4) — canonical `businesses` + `business_members`, retire/`view` the `shop_*` duplicates. *Prerequisite for everything.*
2. **Recreate `member_devices` + `pin_resets`** under `business_id`-scoped shape (Section 2, 5b).
3. **bcrypt/argon2 PIN hashing + lockout** (Section 3), migrate existing hashes.
4. **Shared sign-in / PIN / device component** in `packages/shared` (Section 6).
5. **Both reset flows** (Section 5), including owner self-recovery + authorization fix.
6. **Wire both verticals to consume** the shared component; delete per-vertical auth code.
7. **Acceptance run** (Section 7) on both verticals.

---

## 9. Out of scope (explicitly)
- SSO / passkeys / biometrics (future; the layer model leaves room — Device layer could later accept passkey instead of PIN).
- Cross-vertical single identity (one human, businesses in multiple verticals) — separate decision; schema already permits multiple businesses per owner (no unique constraint on `owner_id`), but the app resolves to one. Park per prior sessions.
- Multi-business switcher UI — related but separate capability.

---

*This spec is the standard. Verticals consume it; they do not reimplement it. Third build — this time, once, done right.*
