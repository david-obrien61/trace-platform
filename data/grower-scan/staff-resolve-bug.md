# THUNDER DIAGNOSE — Active Staff member resolves to `no_business`

**Date:** 2026-06-22 · **Type:** Verify-first diagnosis, READ-ONLY (no code/schema/build changed)
**Verdict:** ROOT CAUSE FOUND AND NAMED. RLS on the `businesses` table has **no member-read policy** — the member can read their `business_members` row (count = 1) but cannot read the embedded `businesses(*)` join (returns null) → row dropped → `no_business`.

---

## 1. The `business_members` row for user `9d0d2123-3226-4d0f-a4e2-657aaa96c298`

Ground truth, read via service key (bypasses RLS), `business_members` table:

```json
{
  "id": "581cbd77-82bd-4979-85bd-bee2f65a51be",
  "business_id": "45830ba7-9961-403f-b048-77f022fb48dc",
  "user_id": "9d0d2123-3226-4d0f-a4e2-657aaa96c298",
  "name": "Terrence Test",
  "email": "trace_staff_only@outlook.com",
  "role": "STAFF",
  "permissions": ["view_dashboard", "qr_checkout", "view_orders"],
  "active": true,
  "invite_id": "0f5c5aa1-b456-40df-9401-dbd965b7d9e6",
  "created_at": "2026-06-22T14:24:39Z",
  "updated_at": "2026-06-22T14:25:42Z"
}
```

- **Is it ACTIVE?** YES — `active: true`. (The team panel showing "Active" is correct; the row is real and valid.)
- **Which business?** `business_id = 45830ba7-9961-403f-b048-77f022fb48dc`.

The business that `business_id` points to (service-key read of `businesses`):

```json
{ "id": "45830ba7-9961-403f-b048-77f022fb48dc",
  "name": "TRACE Enterprises",
  "owner_id": "ba7cf242-660a-4d28-8469-cd2db1ecb9ba",
  "business_type": "general" }
```

**⚠️ Correction to the prompt's premise:** the active membership points to **TRACE Enterprises** (`45830ba7…`, type `general`), **NOT** TRACE Tree Sales (`0edb3b55-90f4-437b-8e3a-1470bdfee149`). The prompt's stated target business is wrong. This does **not** change the resolve bug — the membership is active and points to a real, existing business — but it is recorded here because it matters for the owner-side test setup (the staff account was invited into TRACE Enterprises, owned by David's user `ba7cf242…`).

---

## 2. The two divergent reads — it is ONE query, count vs. embed

The "count" and the "resolve" are **not two separate queries**. They are the **outer rows vs. the embedded join inside a single Supabase request** in `BusinessProvider`.

**The query** — `packages/shared/src/context/BusinessProvider.tsx:245-249`:

```ts
const { data: memberships } = await supabase
  .from('business_members')
  .select('business_id, role, permissions, businesses(*)')   // ← embedded to-one join
  .eq('user_id', user.id)
  .eq('active', true);
```

**The COUNT (returns 1)** — `BusinessProvider.tsx:251-255`:

```ts
console.log('[TRACE:BUSINESS] member path', {
  userId: user.id, businessType,
  membershipCount: memberships?.length ?? 0,   // ← counts the OUTER business_members rows
});
```

`memberships.length` counts the **outer `business_members` rows**. The member can read their own row via RLS policy `bm_self_select` (`FOR SELECT USING (user_id = auth.uid())`, migration `20260602_shared_members_a_create_tables.sql:56`). → **1**.

**The RESOLVE (returns nothing)** — `BusinessProvider.tsx:257-270`:

```ts
const ownedIds = new Set(resolved.map(r => r.business.id));
for (const m of (memberships ?? [])) {
  const memberBiz = (m.businesses as any) as Business | null;
  if (!memberBiz) continue;          // ← 45830ba7 DROPS HERE: m.businesses is null
  if (ownedIds.has(memberBiz.id)) continue;
  resolved.push({ business: memberBiz, isOwner: false,
                  permissions: (m.permissions as string[]) ?? [] });
}
```

The resolve reads `m.businesses` — the **embedded `businesses(*)` row**. That embedded resource is filtered by the **`businesses` table's own RLS**, evaluated as the member. Because the member is not the owner, the embed comes back **`null`**, so `if (!memberBiz) continue` drops the row. `resolved.length` stays 0 → `no_business` (`BusinessProvider.tsx:274-280`).

**What the resolve applies that the count doesn't:** it dereferences the **embedded join to `businesses`**, a second RLS-gated table read. The outer `business_members` read (count) passes RLS; the inner `businesses` embed (resolve) does not. The embed is a default (non-`!inner`) to-one join, so Supabase returns the parent row **with `businesses: null`** rather than filtering the parent out — which is exactly why the count still sees 1 while the resolve sees nothing.

---

## 3. RLS finding — the `businesses` table has NO member-read policy

`businesses` table policies — `supabase/migrations/20260529_businesses_a_create_tables.sql:25-32` (the **only** place `businesses` table policies are defined; no later migration adds another):

```sql
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY businesses_owner_select ON businesses
  FOR SELECT USING (owner_id = auth.uid());     -- ← ONLY select path = owner
CREATE POLICY businesses_owner_insert ON businesses
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY businesses_owner_update ON businesses
  FOR UPDATE USING (owner_id = auth.uid());
```

There is **exactly one SELECT policy** on `businesses`, and it requires `owner_id = auth.uid()`.

- Owner David (`ba7cf242…`) reads `45830ba7` fine → owner panel works, owner login works.
- Staff member (`9d0d2123…`) is **not** the owner → the `businesses` SELECT returns **no row** → the embedded `businesses(*)` join is `null`.

This is asymmetric with every other tenant table, which **were** given dual owner+member RLS. Confirmed present elsewhere but **absent on `businesses` itself**:
- `receipts` — "Dual RLS: owner + member" (`20260612_receipts.sql:7`)
- `cultivar_plants` — "owner … OR active business_members row" (`20260613_cultivar_plants_untangle.sql:32`)
- `business_discovery_profiles` — "owner + active business_members" (`20260621_business_discovery_profiles.sql:10`)
- `business_members` itself — `bm_self_select` lets the member read their own membership row.

The core `businesses` anchor table was **missed** in the member-RLS rollout. A Staff member can read their membership row but cannot read the business record that row points to.

This is the same class as **Open Architecture Decision #11** (missing-SELECT-RLS-policy pattern) and the AC-2 dual-RLS convention — `businesses` never got the member SELECT path.

---

## 4. ROOT CAUSE (named, with evidence)

> **An active membership resolves to `no_business` because the `businesses` table's only SELECT RLS policy is `businesses_owner_select` (`owner_id = auth.uid()`) — there is no policy permitting a member to read the business their membership points to. The member-path query (`BusinessProvider.tsx:245`) reads `business_members` with an embedded `businesses(*)` join in one request: the outer `business_members` row passes RLS via `bm_self_select` (so `membershipCount = 1`), but the embedded `businesses` row is RLS-filtered to `null` for a non-owner, so the resolve loop (`if (!memberBiz) continue`, line 260) drops it and `resolved.length` is 0 → `setBusinessError('no_business')`.**

**Count finds / resolve drops** is precisely the count-counts-the-readable-outer-row vs. resolve-needs-the-RLS-blocked-inner-row split. Evidence chain:
1. Row is `active: true`, points to a real business → §1.
2. Count = outer `business_members` length, member can read it (`bm_self_select`) → 1 → §2.
3. Resolve = embedded `businesses(*)`, gated by `businesses_owner_select` only → `null` for non-owner → dropped → §2 + §3.

**Two valid fixes (NOT applied — diagnosis only):**
- **(A) Schema fix (root):** add a member-read SELECT policy to `businesses`, e.g.
  `FOR SELECT USING (id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid() AND active))`,
  mirroring the dual-RLS convention already on receipts/cultivar_plants. *(Mind recursion/`SECURITY DEFINER` if `business_members`'s own policies reference `businesses`; the existing `bm_self_select` is `user_id`-only, so a plain subquery should be safe — verify before applying.)*
- **(B) Code fix:** the member path could fetch the business by id with the service role / a SECURITY DEFINER RPC instead of relying on the RLS-gated client embed. (A) is the cleaner root fix and restores the intended AC-2 model.

**Confirmation note (READ-ONLY boundary):** the live in-browser repro the prompt already provided (`membershipCount: 1` → `no_business`) is itself the runtime proof. Fully reproducing the RLS-null embed under the member's JWT would require signing in as `trace_staff_only@outlook.com` (no password available here) — described, not executed. The policy text + row values make the chain airtight without it.

---

## Bug-cluster notes (recorded, NOT fixed)

- **Auto-select / switcher:** auto-select fires on the **combined** `resolved.length === 1` (`BusinessProvider.tsx:285`), which mixes owned + member businesses. The "owned-count not total-membership-count" symptom seen earlier with `trace_ent` would surface for a user with 1 owned + ≥1 member business: they would not get `resolved.length === 1`, but if member businesses keep dropping to `null` via this same RLS bug, the member side never contributes — masking/compounding the switcher behavior. Worth re-checking **after** the `businesses` member-RLS fix, since member businesses currently never resolve at all.
- **Permission wall rides the SAME failing path.** `effectivePermissions` and the `can()` chokepoint are computed from `activeResolved`, which comes from the same `resolvedBusinesses` list the member path failed to populate:
  - `can()` — `BusinessProvider.tsx:346-353` (reads `activeResolved.isOwner` / `.permissions`)
  - `[TRACE:PERM]` effect — `BusinessProvider.tsx:357-367`
  When the member resolves to `no_business`, `activeResolved` is `null` → `isOwnerActive = false`, `activePermissions = null` → `applyFinancialDependencies([])` → empty → **every** `can()` check returns false. So the financial wall's permission resolution is downstream of this same RLS failure: fix the `businesses` member-read policy and the member's permissions (`view_dashboard`, `qr_checkout`, `view_orders`) start resolving through the chokepoint. Until then the member has neither a business nor any permissions.

---

*READ-ONLY diagnosis. No migration written, no code changed. Fix options described in §4; owner decides.*
