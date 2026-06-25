# Person-entity spine — recon & why-record

**Author:** Thunder (Claude Code) · **Date:** 2026-06-25 · **For:** the Person-spine build (Checkpoints 1–2)
**Status:** architecture record — keep. This documents WHY the spine is shaped the way it is and
the one non-negotiable rule (person_id is an OVERLAY, never the auth principal).

---

## The decision

Adopt a global **Person** entity (`people` table) as the single human backbone behind every role a
human plays in the platform: a **lead** (future), a **customer**, a **team member**, an **invited
worker**, a **labor resource**. Today those identities are scattered — `business_members.name`,
`customers.first_name/last_name`, `labor_resources.name`, `invitations.name`, `auth.user_metadata.
full_name` — each a denormalized copy with no shared id. The Person spine gives every human ONE row
and lets the role rows point at it (`person_id`), so "John the customer" and "John the contractor at
another business" can resolve to one person, N memberships/customer rows.

This is the **three-entity identity standard**: **Person** (the human) × **Organization** (`businesses`)
× **Membership/role** (`business_members`, `customers`, `labor_resources`). We adopt it because the
value is real and near: the lead→customer→enterprise backbone the product needs.

---

## Standard-by-value (§6.10) — what we adopt and the divergence we record

- **ADOPTED (on value):** the Person/Org/Membership three-entity model. Value = the lead/customer/
  enterprise backbone; without it every human fact is a denormalized copy that drifts (the exact
  class that produced the dead R2 phone field, the 3 phone writers, the Marcus-Webb customer dupe).
- **DOCUMENTED DIVERGENCE (below the textbook):** `person_id` is an **OVERLAY, NOT the auth principal.**
  The textbook Person-spine would make the person id the security principal. We do **not**. RLS stays
  on `user_id = auth.uid()`, unchanged.
  - **Why the divergence is correct here:** (1) RLS is already proven on `auth.uid()` across the whole
    surface (is_active_member, has_permission, the self-grant trigger, owner-only customers) — repointing
    it onto `person_id` would re-open every one of those proofs for zero gain. (2) The relationship is
    **person ↔ auth is 1:many** — a person can have an auth account or not (an invited-not-enrolled
    worker has a `people` row with `auth_user_id = NULL`), and `auth_user_id` (UNIQUE, nullable) is the
    bridge. The auth principal is the right security anchor; the person id is the right *identity*
    anchor. They are different jobs.
  - **Cost accepted:** person-level authorization (e.g. "this person across all their businesses") is
    not expressible in RLS directly — it would need an app-layer resolve. We don't need it yet.
  - **Trigger to converge:** if/when a feature genuinely needs person-scoped authorization at the DB,
    revisit — but only by ADDING a person-aware policy, never by moving the existing auth-principal RLS.

---

## R1 — shape

`people` (NEW, global spine):
- `id` uuid PK (the `person_id`)
- `auth_user_id` uuid **nullable, UNIQUE**, FK→`auth.users` **ON DELETE SET NULL**
  (nullable because some persons have no auth account — invited-not-enrolled worker, a captured
  customer; UNIQUE because one auth account = one person; SET NULL so deleting an auth user never
  blocks or destroys the person record)
- name fields: `first_name`, `last_name`, `full_name`
- contact: `email`, `phone`
- `created_at`, `updated_at`
- **NO `business_id`** — a person is global, not tenant-scoped. Tenant scoping lives on the role rows
  (`business_members.business_id`, `customers.business_id`, …), which keep their existing RLS.

Role rows each gain a **nullable** `person_id` FK→`people` **ON DELETE SET NULL** (additive overlay;
nothing forced NOT NULL; a person delete never cascades into a membership/customer):
- `business_members.person_id`
- `customers.person_id`  (+ `price_tier` — see below)
- `labor_resources.person_id`
- `invitations.person_id`

`customers.price_tier` (the contractor-discount-as-**TIER** concept: `retail` / `wholesale` /
`contractor` — a tier on the customer relationship, **NOT** a separate entity). text, default
`'retail'`, **no CHECK** (AC-4: the value-set grows without a migration).

> **Naming flag (§6.10 divergence, surfaced for David):** the prompt named the field
> "customer_type / price_tier". One concept (the price tier), so ONE column was added, named
> `price_tier` (matches the "a tier, NOT an entity" emphasis). If a *separate* general
> `customer_type` classifier is wanted later, add it then — a redundant second column now would be
> debt. Flagged, not silently decided.

---

## R2 / R3 — dedup & backfill: MOOT

All current data is throwaway stress-test scaffolding. The build does a **FULL NUKE** (Checkpoint 1)
and lets fresh accounts flow through the new structure from the start. Therefore: **no merge logic,
no dedup of existing rows, no backfill.** The only "dedup" built is **dedup-on-CREATE going forward**
(the shared person-create-or-link function — see create-path map), which is the fix for the
email-only-dedup / phone-only-customer-dupe bug at SOURCE, not a migration of old data.

The real LAWNS demo data will be a **fresh load** through the new structure via a separate seed
function (**Build B**, queued in CLOSE-OUT-LEDGER — not built here).

---

## R4 — RLS to protect (DO NOT CHANGE)

The overlay must not touch any existing policy or function. The migration ADDS a new table + its own
RLS + nullable columns ONLY. The following stay byte-for-byte as they are:

- `is_active_member(p_business_id)` — SECURITY DEFINER, owned by postgres, `user_id = auth.uid()
  AND active = true`. (20260622_is_active_member_canonical_rls.sql)
- `has_permission(p_business_id, p_perm)` — the cost/wall gate. (20260622_oauth_secrets_relocation_and_cost_wall.sql)
- `bm_owner_all` / `bm_self_select` / `bm_self_update` on `business_members`. (20260602)
- `enforce_member_authority_immutability` self-grant trigger + `bm_self_update` WITH CHECK. (20260623)
- `customers_business_owner` — owner-only customers RLS (`business_id IN (SELECT id FROM businesses
  WHERE owner_id = auth.uid())`). (20260529_businesses_d_update_rls.sql)
- `businesses_owner_select/_insert/_update` + `businesses_member_select`. (20260529 / 20260622)
- every member-scoped policy standardized onto `is_active_member`. (20260622)

**`people` gets its own minimal RLS — self-only, keyed on the auth principal:**
```
CREATE POLICY people_self_all ON people
  FOR ALL TO authenticated
  USING      (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
```
- An authenticated user manages **their own** person row (auth_user_id = self). This is what lets the
  browser-side OwnerSignup create the owner's person under RLS (the owner's `auth_user_id` = the
  session uid → WITH CHECK passes).
- Customer-persons and invited-worker-persons (`auth_user_id = NULL`) are created **server-side with
  the service key** (customerUpsert, acceptInvitation) — RLS bypassed; the self-only policy never
  blocks them, and never exposes one person's row to another user. No cross-tenant leak: `people` has
  no business_id and the policy exposes only the caller's own row (AC-3 holds — a person row is never
  visible to a different authenticated user).
- We deliberately do **not** add a broader read policy yet (e.g. "owner can read their members'
  persons"). Reads of other humans' names still flow through the role rows' existing RLS
  (`business_members.name`, `customers.first_name`), which already work. Add a scoped person-read
  policy only when a real join needs it (standard-by-value: don't build RLS we don't use).

---

## R5 — FK surface (what the migration adds)

| Table | Column added | FK | On delete | Why nullable |
|---|---|---|---|---|
| `people` | (new table) | `auth_user_id`→`auth.users` | SET NULL | person may have no auth account |
| `business_members` | `person_id` | →`people` | SET NULL | overlay; never cascade-delete a membership |
| `customers` | `person_id` | →`people` | SET NULL | overlay |
| `customers` | `price_tier` (text, default `retail`, no CHECK) | — | — | tier on the relationship |
| `labor_resources` | `person_id` | →`people` | SET NULL | overlay |
| `invitations` | `person_id` | →`people` | SET NULL | overlay |

No FK is RESTRICT; no column is NOT NULL. The overlay can be added without touching any write path,
and a person delete never breaks a role row.

---

## Create-path map — ONE shared function (§6.8 semantic-dup)

Three sources create-or-link a person. They share **one** function
`findOrCreatePerson(db, input)` in `packages/shared/src/business-logic/personUpsert.ts` — not three
copies. Each emits `[TRACE:PERSON]` on create / link / resolve.

| Source | Client | Resolve key | Notes |
|---|---|---|---|
| Owner signup (`OwnerSignup.createBusinessAndMember`) | browser anon (RLS) | `auth_user_id` | person created under `people_self_all`; link `business_members.person_id`. Non-blocking: a person failure degrades gracefully, signup still lands (the proven onboarding path must hold). |
| Invite accept (`acceptInvitation`) | service key | `auth_user_id` | link `invitations.person_id` + the activated `business_members.person_id`. Non-blocking. |
| Customer upsert (`findOrCreateCustomer`) | service key | email → phone (auth-less only) | **the bug fix**: resolve the person first, then resolve the customer in the business by `person_id`. A phone-only repeat matches the existing person by phone → no second customer (the Marcus-Webb-dupe class). Graceful fallback to the legacy email-dedup if person resolution fails (rule 6 — integration failure never blocks an order). |

**Resolve precedence inside `findOrCreatePerson`:**
1. If `auth_user_id` given → match `people.auth_user_id` (the auth principal is the strongest key).
2. Else (customer / invited worker, no auth) → match by `email`, then `phone`, **among auth-less
   people only** (`auth_user_id IS NULL`) so a customer never silently collapses onto an owner's
   account-person. Global (no business scope) — same human across businesses = one person.
3. No identifier at all → always insert (D-9: never fabricate a key to match on).

---

## The wipe (Checkpoint 1) — why full nuke + cascade order

`businesses.owner_id` is `NOT NULL REFERENCES auth.users(id)` with **no ON DELETE** (RESTRICT), and
`customers.business_id`→`businesses` is also RESTRICT. So the test `auth.users` (incl. the
`ba7cf242…` anchor) cannot be deleted while any business they own — or any customer of that business —
still exists. David's call: **FULL NUKE** (all data expendable; real demo comes back via Build B).

Order that satisfies the FK web:
1. Enumerate every `public` table carrying a `business_id` column **against the live catalog** (do not
   trust a hand-list) + `businesses` + the legacy `nurseries` anchor + **discover every append-only
   guarded table** (any `reject_*_mutation` trigger, via `pg_trigger`).
2. **Privileged one-time teardown (labeled STEP B2):** DISABLE every append-only guard → `TRUNCATE …
   RESTART IDENTITY CASCADE` the set (guarded tables excluded from the explicit list but emptied via
   cascade) → RE-ENABLE every guard — all in ONE transaction (a failure auto-restores the guards).
3. `DELETE FROM auth.users` (now unreferenced by `businesses.owner_id`; Supabase cascades
   `auth.identities/sessions/refresh_tokens`).
4. **Verify (STEP C):** every guard is back ON (`pg_trigger.tgenabled <> 'D'`) + 0 rows everywhere.

**Append-only guard (audit_log) — why a privileged teardown, not a workaround.** `audit_log` is
append-only: a `reject_*_mutation` guard rejects mutation/TRUNCATE (a first wipe run rolled back on
it — the guard working as designed). David's decision: the orphaned audit rows must NOT persist
(they would reference non-existent business IDs and weaken the LAWNS-demo audit log's credibility).
So `audit_log` is cleared as an EXPLICIT, ONE-TIME, PRIVILEGED teardown of the whole test
environment — loud, labeled, on the record — never a quiet/reusable normal-path move. It FK-cascades
from `businesses` (ON DELETE CASCADE), so truncating `businesses` necessarily truncates `audit_log`
via cascade — which is why the guard-disabled window must bracket the whole truncate, then restore +
verify. David owner-proves restoration: a manual `UPDATE` on `audit_log` after the reset must be
rejected.

Storage objects (receipt files) are path-based, not FK-linked — left as harmless orphans for David to
clear via the dashboard if desired.
