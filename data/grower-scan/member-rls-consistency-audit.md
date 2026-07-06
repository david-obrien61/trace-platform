# THUNDER RECON — Member-RLS predicate consistency audit

**Date:** 2026-06-22 · **Type:** Verify-first recon, READ-ONLY (no code/schema/policy changed)
**Question:** How many distinct ways is "this user is an active member of this business" expressed across the platform's RLS? Divergence = silent tenant-leak risk.

**Headline:** Across all member-scoped tables there are **2 distinct but semantically-equivalent CORRECT expressions** (an `EXISTS` form and an `IN` form, both `… AND active = true`), plus **1 divergent INCORRECT expression that omits the `active` filter** (`md_self` on `member_devices` — a leak). Separately, **a whole class of tables has NO member policy at all** (owner-only) — `businesses` (the known bug) plus every legacy operational table (`orders`, `customers`, `plants`, `addons`, `plant_events`, `social_drafts`, `order_items`, `order_service_selections`, `order_compliance_records`, `nurseries`, `nursery_profiles`, `pmi_assets`, `pmi_service_logs`). A single SECURITY DEFINER `is_active_member(business_id)` helper is feasible and fits every common-case table identically; only `md_self` needs a different (self-scoped) treatment.

---

## 1. `business_members` schema — the source of truth for "active"

Live columns (service-key dump, 8 rows):

```
id, business_id, user_id, name, email, phone, role, permissions,
active, invite_id, created_at, updated_at, pin_hash
```

- **Membership-state column:** `active boolean NOT NULL DEFAULT false` (`20260602_shared_members_a_create_tables.sql:37`). **There is NO `status` column** (confirmed: `SELECT status` errors `column business_members.status does not exist`). `active` is the *sole* state encoder.
- **Values in use:** `active` = `true` ×7, `false` ×1 (the one inactive row = invited-but-not-enrolled, per the table comment `:18-19`: `active=false: invited, not yet enrolled` / `active=true: enrolled`). `role` is free-form text: `OWNER` ×4, `STAFF` ×3, `MANAGER` ×1 (`role` is NOT used in any RLS predicate — only `active` + `user_id` are).
- **`business_members`' own RLS** (`20260602_shared_members_a_create_tables.sql:48-61`):

```sql
CREATE POLICY bm_owner_all ON business_members           -- :48-53  (FOR ALL)
  FOR ALL USING (
    business_id IN ( SELECT id FROM businesses WHERE owner_id = auth.uid() ) );  -- ⚠ subqueries businesses
CREATE POLICY bm_self_select ON business_members         -- :56-57
  FOR SELECT USING (user_id = auth.uid());               -- ✅ non-recursive, self-scoped
CREATE POLICY bm_self_update ON business_members         -- :60-61
  FOR UPDATE USING (user_id = auth.uid());
```

The non-recursive membership-read path is **`bm_self_select` (`user_id = auth.uid()`)**. **`bm_owner_all` (FOR ALL) sub-queries `businesses`** — this is the recursion footgun for any `businesses` policy that sub-queries `business_members` (see §4).

---

## 2. Every member-scoped RLS predicate, enumerated (verbatim)

### FORM A — `EXISTS (… WHERE business_id = <table>.business_id AND user_id = auth.uid() AND active = true)`  ✅ filters active

| Table | Policy | file:line |
|---|---|---|
| `receipts` | `receipts_member_all` | `20260612_receipts.sql:47-62` |
| `business_assets` → renamed `cost_objects` | `business_assets_member_all` → `cost_objects_member_all` | `20260612_business_assets_inventory_pmi_service.sql:67-81`; renamed `20260615_cost_objects_rename_and_node_schema.sql:55` |
| `business_inventory` | `business_inventory_member_all` | `20260612_…:133-147` |
| `business_pmi_schedule` | `business_pmi_schedule_member_all` | `20260612_…:193-207` |
| `business_service_log` | `business_service_log_member_all` | `20260612_…:257-271` |
| `labor_resources` | `labor_resources_member_all` | `20260618_cost_category_and_labor_resources.sql:115-121` |
| `cost_object_edges` | `cost_object_edges_member_all` | `20260615_…:158-164` |
| `cost_object_assignments` | `cost_object_assignments_member_all` | `20260615_…:215-221` |
| `business_discovery_profiles` | `business_discovery_profiles_member_all` | `20260621_business_discovery_profiles.sql:64-78` |
| `deliveries` | `deliveries_member_all` | `20260620_deliveries.sql:62-76` |
| `cultivar_plants` | `cultivar_plants_owner_select` / `_owner_all` (OR-branch) | `20260613_cultivar_plants_untangle.sql:42-47`; `20260613_cultivar_plants_policy_cleanup.sql:39-63` |

Canonical exemplar (`receipts_member_all`, `20260612_receipts.sql:49-54`):

```sql
USING (
  EXISTS (
    SELECT 1 FROM business_members
    WHERE business_id = receipts.business_id
      AND user_id = auth.uid()
      AND active = true
  )
)
```

### FORM B — `business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid() AND active = true)`  ✅ filters active (semantically identical to A; `IN`-syntax instead of `EXISTS`)

| Table | Policy | file:line |
|---|---|---|
| `business_modules` | `business_modules_member_access` (FOR ALL) | `20260604_business_modules.sql:113-122` |
| `storage.objects` (receipts bucket) | `receipts_storage_insert` / `_select` / `_delete` | `20260613_receipts_storage_rls.sql:44-45, 66-67, ~78` |

Verbatim (`business_modules`, `20260604_business_modules.sql:114-121`):

```sql
USING (
  business_id IN (
    SELECT business_id
    FROM business_members
    WHERE user_id = auth.uid()
      AND active = true
  )
)
```

### FORM C — `member_id IN (SELECT id FROM business_members WHERE user_id = auth.uid())`  ❌ DOES NOT filter active — LEAK

| Table | Policy | file:line |
|---|---|---|
| `member_devices` | `md_self` (FOR ALL) | `20260602_shared_members_a_create_tables.sql:154-158` |

Verbatim:

```sql
CREATE POLICY md_self ON member_devices
  FOR ALL USING (
    member_id IN (
      SELECT id FROM business_members WHERE user_id = auth.uid()   -- ⚠ NO  AND active = true
    )
  );
```

### NO member policy (owner-only) — the `businesses`-bug class (members blocked entirely)

| Table | Owner-only predicate | file:line |
|---|---|---|
| **`businesses`** | `owner_id = auth.uid()` (SELECT/INSERT/UPDATE) — **NO member policy** | `20260529_businesses_a_create_tables.sql:27-32` |
| `orders` | `business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())` (FOR SELECT) | `20260529_businesses_d_update_rls.sql:15-17` |
| `customers` | same shape (FOR ALL) | `20260529_…d:29-31` |
| `plants` | same shape (FOR ALL) | `20260529_…d:8-10` |
| `addons` | same shape (FOR ALL) | `20260529_…d:22-24` |
| `plant_events` | same shape (FOR ALL) | `20260529_…d:36-38` |
| `social_drafts` | same shape (FOR ALL) | `20260529_…d:43-45` |
| `order_items` | owner-only | `20260528_per_tenant_rls_isolation.sql:120` |
| `order_service_selections` | `order_service_selections_owner` | `20260529_businesses_f_service_offerings.sql:78` |
| `order_compliance_records` | `compliance_records_owner_select` | `20260529_businesses_g_compliance_and_customer_match.sql:52` |
| `nursery_profiles` | `nursery_profiles_owner` (owner-only) | `20260529_businesses_a_create_tables.sql:43-45` |
| `pmi_assets`, `pmi_service_logs` | owner-only (legacy Ignition-era) | `20260529_pmi_shared.sql:23-25, 42-44` |

---

## 3. Divergence table (the headline)

| Table | Member policy? | Active-check expression (verbatim core) | Filters `active`? | Matches the common form? |
|---|---|---|---|---|
| receipts | Y | `EXISTS(… business_id = receipts.business_id AND user_id = auth.uid() AND active = true)` | ✅ Y | ✅ Form A |
| cost_objects (was business_assets) | Y | `EXISTS(… AND active = true)` | ✅ Y | ✅ Form A |
| business_inventory | Y | `EXISTS(… AND active = true)` | ✅ Y | ✅ Form A |
| business_pmi_schedule | Y | `EXISTS(… AND active = true)` | ✅ Y | ✅ Form A |
| business_service_log | Y | `EXISTS(… AND active = true)` | ✅ Y | ✅ Form A |
| labor_resources | Y | `EXISTS(… AND active = true)` | ✅ Y | ✅ Form A |
| cost_object_edges | Y | `EXISTS(… AND active = true)` | ✅ Y | ✅ Form A |
| cost_object_assignments | Y | `EXISTS(… AND active = true)` | ✅ Y | ✅ Form A |
| business_discovery_profiles | Y | `EXISTS(… AND active = true)` | ✅ Y | ✅ Form A |
| deliveries | Y | `EXISTS(… AND active = true)` | ✅ Y | ✅ Form A |
| cultivar_plants | Y | owner `OR EXISTS(… AND active = true)` | ✅ Y | ✅ Form A (OR-branch) |
| business_modules | Y | `business_id IN (SELECT business_id … AND active = true)` | ✅ Y | ⚠ Form B (IN, same semantics) |
| storage.objects (receipts) | Y | `business_id IN (SELECT business_id … AND active = true)` | ✅ Y | ⚠ Form B (IN, same semantics) |
| **member_devices (`md_self`)** | Y | `member_id IN (SELECT id … user_id = auth.uid())` | ❌ **N** | ❌ **Form C — LEAK** |
| **businesses** | **N** | — (owner-only) | — | ❌ **MISSING (staff-resolve bug)** |
| orders / customers / plants / addons / plant_events / social_drafts | **N** | — (owner-only) | — | ❌ **MISSING (members blocked)** |
| order_items / order_service_selections / order_compliance_records / nursery_profiles | **N** | — (owner-only) | — | ❌ MISSING |
| pmi_assets / pmi_service_logs | **N** | — (owner-only, legacy) | — | ❌ MISSING (legacy) |

### Headline counts
- **Distinct expressions of "active member": 3** — Form A (`EXISTS … active = true`), Form B (`IN … active = true`), Form C (`IN`, **no active**).
- **Distinct CORRECT semantics: 1** — "a `business_members` row exists for this business + `user_id = auth.uid()` + `active = true`." Forms A and B both encode it (EXISTS vs IN is cosmetic). **Form C does not.**

### 🔴 LEAK FLAGS (membership checked, `active` NOT filtered)
- **`member_devices` `md_self` — `20260602_shared_members_a_create_tables.sql:154-158`.** Omits `AND active = true`. A **deactivated/invited-but-not-enrolled** member (`active = false`) whose `user_id` is set still satisfies `member_id IN (SELECT id FROM business_members WHERE user_id = auth.uid())`, so they retain **FOR ALL** access to their own `member_devices` rows. Scope is self-limited (their own devices via `member_id`, not cross-tenant), so it is **not** a cross-business leak — but a revoked member should lose device management and currently does not. This is the *only* member policy that checks membership without `active`.

### Wrong/nonexistent column
- **None.** Every predicate uses `active` (which exists). No policy references `status` (which does not exist) or any other wrong column. The divergence is *omission* (Form C) and *syntax* (A vs B), not a wrong-column bug.

### Note on the owner-only class (not a leak — the opposite: over-restriction)
The `businesses` member-gap (staff-resolve-bug.md) is **one instance of a broader pattern**: every pre-2026-06 operational table (`orders`, `customers`, `plants`, `addons`, `plant_events`, `social_drafts`, `order_items`, etc.) is **owner-only**. A `STAFF` member holding `view_orders`/`qr_checkout` permissions would be blocked at the RLS layer from reading `orders`/`customers` even after the `businesses` fix lands. Not a leak (fails closed), but a functional gap that will surface the moment members start resolving. Recorded for the cluster; out of scope to fix here.

---

## 4. Canonical-function feasibility (findings, NOT a build)

### What the single canonical predicate MUST encode
> The caller has an **enrolled** membership in the target business:
> `EXISTS (SELECT 1 FROM business_members WHERE business_id = $1 AND user_id = auth.uid() AND active = true)`
> returning `boolean`. The `active = true` clause is **mandatory** (it is the one thing Form C drops). `role` is irrelevant to the predicate (permissions are enforced separately, in the app/`can()` chokepoint).

### SECURITY DEFINER `is_active_member(business_id uuid) → boolean` — feasible, resolves BOTH problems
- **(a) One definition, no per-table divergence.** Every Form-A and Form-B table calls `is_active_member(<that table>.business_id)`; `businesses` calls `is_active_member(businesses.id)`. The 10 EXISTS-form + 2 IN-form tables are the *identical* common case — one helper fits them all, and future tables call the same function instead of hand-copying the EXISTS block (which is how Form B / Form C drift crept in).
- **(b) Recursion footgun resolved.** A `businesses` policy that inlined `EXISTS(SELECT … FROM business_members …)` would mutually recurse: `businesses → business_members → bm_owner_all (FOR ALL, subqueries businesses) → businesses → …` → Postgres `42P17 "infinite recursion detected"` at rewrite time (would break the owner SELECT too). A **SECURITY DEFINER** function reads `business_members` with definer rights → RLS is **not** applied inside it (verified: no table has `FORCE ROW LEVEL SECURITY`, so the `postgres` owner bypasses RLS), so `bm_owner_all` is never expanded and the cycle is broken. This is exactly why the only safe way to give `businesses` a member-read policy is via such a helper.
  - Hardening: `STABLE`, `SET search_path = ''`, fully-qualified `public.business_members` + `auth.uid()`, `EXECUTE` granted only to `authenticated`, function owned by `postgres` (ownership is load-bearing — it is what bypasses RLS).

### Tables whose needs DIFFER from the common case
- **`member_devices` `md_self` — DOES differ; do NOT blanket-standardize onto `is_active_member(business_id)`.** Its scope is "**my own** devices" (`member_id` = the caller's own membership rows), not "any device in a business I belong to." Swapping it to `is_active_member(business_id)` would *widen* access (a member could see every device in the business). The correct fix for `md_self` is narrow: add `AND active = true` to its existing `member_id` subquery — not adopt the business-wide helper. (Separate one-line fix; flagged here, not done.)
- **Combined owner-OR-member policies** (`cultivar_plants`): the helper replaces only the member `EXISTS` branch; the `owner_id = auth.uid()` branch stays. Composes cleanly.
- **`businesses`**: passes its own PK as the arg (`is_active_member(businesses.id)`); otherwise identical to the common case.
- **Everything else (all Form-A + Form-B tables): SAME case, no divergence.** Standardizing them onto `is_active_member` is a pure refactor with identical semantics.
- **Owner-only operational tables** (`orders`, `customers`, …): adopting the helper would be a *behavior change* (granting members read), not a consistency refactor — a product decision (which roles/permissions should read orders?), not part of "one canonical active-member predicate." Keep separate.

### Plain statement
If you exclude `md_self` (genuinely different scope) and the owner-only tables (no member policy to standardize), **all 13 member-scoped tables already encode the same single semantic** — they just spell it two ways (EXISTS vs IN). One SECURITY DEFINER `is_active_member(business_id)` covers every one of them identically, eliminates the EXISTS/IN drift, prevents future Form-C-style `active`-omission, and is the only recursion-safe way to extend membership-read to `businesses`.

---

*READ-ONLY recon. No policy written, no schema/code/build changed. Fix/standardization is a separate, owner-approved pass. The one live correctness flag is `md_self` (`member_devices`) missing `active = true`.*
