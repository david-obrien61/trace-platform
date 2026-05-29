# Runbook: Make a Vertical Multi-Tenant + Isolated

**Purpose:** Repeatable procedure for promoting any TRACE vertical from single-tenant/hardcoded to
real multi-tenant with per-row DB isolation. Cultivar OS is the worked example throughout.

**Date first written:** 2026-05-28  
**Status:** Verified for Cultivar OS through Track 1 + Track 1.5. Not yet applied to other verticals.

---

## PRECONDITION GATE — do not skip

This runbook works ONLY for a vertical that meets both of the following criteria:

**1. The codebase builds cleanly.**  
A vertical with build errors cannot be safely refactored. Fix the build first.

**2. Real Supabase session auth — `auth.uid()` must be non-null after login.**  
Supabase RLS policies run `USING (owner_id = auth.uid())`. If `auth.uid()` is null (PIN-only auth,
local-first auth, or no auth at all), every policy expression evaluates against a null uid. The
only policy that returns any rows is `USING (true)`, which is no isolation at all.

**Ignition OS FAILS this gate on both counts** as of 2026-05-28:
- Missing `supabase.js` is a build blocker.
- Auth model is PIN-only with no real Supabase session (`auth.uid()` = null).

If the vertical is PIN-only, it must first adopt the shared auth model — PIN/face as an unlock
gesture layered on top of a real Supabase session — before this runbook applies. See CLAUDE.md
"Auth Architecture — Locked Rule" for the rationale. Do not apply this runbook to Ignition OS
until both blockers are resolved.

---

## The Procedure

### Step 1 — Populate `owner_id` on the tenant root row

Every vertical has a "root" table that represents the tenant (Cultivar: `nurseries`, Ignition:
`shops`, KINNA: `organizations`, etc.). This table must have an `owner_id uuid` column that stores
the Supabase `auth.uid()` of the account that owns the tenant.

**Confirm or add the column:**

```sql
ALTER TABLE <tenant_table> ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);
```

**Populate it for each existing row** by either:
- Running `UPDATE <tenant_table> SET owner_id = '<user-uuid>' WHERE id = '<tenant-id>'`; or
- Having the user go through the normal signup flow and relying on the TenantProvider (Step 2) to
  set it on first login.

For existing demo/seed rows, update manually. Never leave `owner_id = NULL` on a row that real
data belongs to — it makes every `owner_id = auth.uid()` policy filter that row out silently.

**Cultivar example:**
```sql
UPDATE nurseries
SET owner_id = 'ba7cf242-660a-4d28-8469-cd2db1ecb9ba'
WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';

-- Verify:
SELECT id, name, owner_id FROM nurseries WHERE id = 'a1b2c3d4-0000-0000-0000-000000000001';
-- Must return 1 row with owner_id = ba7cf242-660a-4d28-8469-cd2db1ecb9ba
```

---

### Step 2 — Build a TenantProvider context

Create a React context that:

1. Reads `auth.uid()` from the Supabase session.
2. Queries the tenant root table for a row where `owner_id = auth.uid()`.
3. Exposes `{ tenantId, tenant, loading, error }`.
4. Handles three explicit states — loading, no-match (error), and resolved — with no silent
   fallback to a hardcoded ID. A missing tenant must be a loud, visible error.
5. Re-resolves on auth state change (login/logout).

**Why no silent fallback:** a hardcoded default ID hides misconfigured accounts and makes the
app appear to work while serving the wrong tenant's data. The error state surfaces it immediately.

**Cultivar example:** `packages/cultivar-os/src/context/NurseryProvider.tsx`

The provider wraps the authenticated portion of the app in `App.tsx`:
```tsx
<PrivateRoute>
  <NurseryProvider>
    <Dashboard />
    {/* ... other authenticated pages */}
  </NurseryProvider>
</PrivateRoute>
```

The hook it exports (`useNursery()`) is consumed wherever `nurseryId` is needed.

---

### Step 3 — Replace every hardcoded tenant-ID constant

Search the entire codebase for the hardcoded constant:

```bash
grep -r "DEMO_NURSERY_ID\|DEMO_SHOP_ID\|<vertical>_ID" --include="*.ts" --include="*.tsx" .
```

For each occurrence:
- Import `useNursery()` (or the vertical's equivalent hook) in the component.
- Replace the constant with `nurseryId` from the context.
- Remove any default parameter fallbacks (`nurseryId ?? DEMO_NURSERY_ID`) — a missing tenant
  should be a loud error, not a silent fallback to a hardcoded value.
- Verify the component renders correctly under `NurseryProvider`.

**Cultivar example:** 19 occurrences of `VITE_DEMO_NURSERY_ID` were replaced across pages, hooks,
and API calls. After the replacement, `import.meta.env.VITE_DEMO_NURSERY_ID` was removed from
`.env` and `vite-env.d.ts`. The build must stay clean after this step — TypeScript errors here
indicate missed occurrences.

---

### Step 4 — Write per-tenant RLS SELECT policies

**File:** `supabase/migrations/<YYYYMMDD>_per_tenant_rls_<vertical>.sql`

**Policy template by table type:**

```sql
-- Tenant root table (has owner_id directly):
CREATE POLICY "authenticated_select_<table>"
  ON <table>
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Tenant data table with nursery_id/shop_id/org_id:
CREATE POLICY "authenticated_select_<table>"
  ON <table>
  FOR SELECT TO authenticated
  USING (<tenant_id_col> IN (
    SELECT id FROM <tenant_root_table> WHERE owner_id = auth.uid()
  ));

-- Child table without a tenant_id col (e.g. order_items → orders → nursery_id):
CREATE POLICY "authenticated_select_<table>"
  ON <table>
  FOR SELECT TO authenticated
  USING (
    <parent_id_col> IN (
      SELECT id FROM <parent_table>
      WHERE <tenant_id_col> IN (
        SELECT id FROM <tenant_root_table> WHERE owner_id = auth.uid()
      )
    )
  );
```

**Public-route exception:** If some tables are read by unauthenticated users (e.g., a public
product catalog accessed via QR code), add a separate `TO anon USING (true)` policy for those
tables alongside the authenticated policy. Document which tables have anon access and why.

**Never leave USING(true) on the authenticated role for a tenant data table.** That is not
isolation — any authenticated user can read any tenant's data.

**Never modify existing migration files** — append only.

**Cultivar example:** `supabase/migrations/20260528_per_tenant_rls_isolation.sql`

Tables covered:

| Table | Column path | Note |
|---|---|---|
| `nurseries` | `owner_id = auth.uid()` | Root table |
| `plants` | `nursery_id → nurseries.owner_id` | anon + authenticated |
| `plant_events` | `nursery_id → nurseries.owner_id` | anon + authenticated |
| `addons` | `nursery_id → nurseries.owner_id` | anon + authenticated |
| `customers` | `nursery_id → nurseries.owner_id` | authenticated only |
| `orders` | `nursery_id → nurseries.owner_id` | authenticated only |
| `order_items` | `order_id → orders.nursery_id → nurseries.owner_id` | child table |
| `order_addons` | `order_id → orders.nursery_id → nurseries.owner_id` | child table |
| `nursery_modules` | `nursery_id → nurseries.owner_id` | authenticated only |
| `social_drafts` | `nursery_id → nurseries.owner_id` | authenticated only |

---

### Step 5 — VERIFY with the cross-tenant test

Isolation is not real until this test passes. Do not skip it.

**5a. Same-tenant smoke test (app must still work):**

1. Apply the migration in the Supabase SQL editor.
2. Log into the app as the demo user.
3. Confirm the dashboard loads with correct data (plants, orders, modules).
4. Place a test order and confirm it appears in Today's Sales immediately after.

If any tile shows 0 or the dashboard is blank, a policy is over-restrictive or the `owner_id`
column is NULL. Check `nurseries.owner_id` and the policy expressions.

**5b. Cross-tenant isolation test (exact SQL for Supabase SQL editor):**

```sql
-- ── SETUP: insert Tenant B data (service role bypasses RLS) ──────────────────

INSERT INTO nurseries (id, name, owner_id, tax_rate)
VALUES (
  'bbbb0000-0000-0000-0000-000000000002',
  'Tenant B Test Nursery',
  'bbbb0000-1111-0000-0000-000000000000',
  0.0825
);

INSERT INTO customers (id, nursery_id, first_name, last_name, email, source)
VALUES (
  'cccc0000-0000-0000-0000-000000000002',
  'bbbb0000-0000-0000-0000-000000000002',
  'Test', 'B', 'tenantb@trace-test.local', 'qr-scan'
);

INSERT INTO orders (
  id, nursery_id, customer_id, transport_method, transport_note,
  netting_declined, subtotal, tax_amount, total_amount, addons_amount,
  leakage_flag, status, notes
) VALUES (
  'dddd0000-0000-0000-0000-000000000002',
  'bbbb0000-0000-0000-0000-000000000002',
  'cccc0000-0000-0000-0000-000000000002',
  'self', 'cross-tenant-test', false,
  100.00, 8.25, 108.25, 0.00, false, 'pending', 'cross-tenant-test-marker'
);

-- ── TEST A: user A cannot see Tenant B's order ────────────────────────────────
-- (Replace the sub value with the actual demo user's auth.uid)

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ba7cf242-660a-4d28-8469-cd2db1ecb9ba","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT id, nursery_id, notes
FROM orders
WHERE notes = 'cross-tenant-test-marker';

-- PASS: 0 rows
-- FAIL: 1 row (isolation not working — investigate policy + owner_id)

-- ── TEST B: user B can see their own order ────────────────────────────────────

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"bbbb0000-1111-0000-0000-000000000000","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT id, nursery_id, notes
FROM orders
WHERE notes = 'cross-tenant-test-marker';

-- PASS: 1 row
-- FAIL: 0 rows (policy is over-restrictive — check subquery join path)

-- ── CLEANUP ───────────────────────────────────────────────────────────────────
-- Run as service role after confirming tests above

RESET ROLE;
DELETE FROM orders   WHERE notes  = 'cross-tenant-test-marker';
DELETE FROM customers WHERE email  = 'tenantb@trace-test.local';
DELETE FROM nurseries WHERE id     = 'bbbb0000-0000-0000-0000-000000000002';
```

**Definition of PASS:** Test A returns 0 rows AND Test B returns 1 row. Both must pass. If only
one passes, check whether the policy is correctly scoped to the authenticated role.

---

## Common Failure Modes

**1. Silent empty result — wrong or NULL `owner_id`**

Every policy containing `owner_id = auth.uid()` returns 0 rows when `owner_id` is NULL.
Symptom: app loads but tiles show 0, metrics are blank, or the nursery context resolves to null.
Fix: `UPDATE <tenant_table> SET owner_id = '<uid>' WHERE owner_id IS NULL`.

This is the most common failure mode in this codebase. It has occurred three times:
- modules/nursery_modules (May 22) — RLS enabled, no SELECT policy
- orders (May 27) — RLS enabled, no SELECT policy
- Track 1.5 (May 28) — policies exist but USING(true), not per-tenant

**2. USING(true) left on a tenant table for authenticated role**

Symptom: the app works correctly (because frontend code already filters by nurseryId), but any
authenticated user can read any tenant's data via direct API call or SQL. The cross-tenant test
will fail (Test A returns 1 row when it should return 0).
Fix: replace `USING(true)` with the owner_id subquery expression.

**3. Skipping the cross-tenant test**

Isolation cannot be verified by looking at the app's normal behavior. A correctly coded frontend
that always passes `nurseryId` looks exactly the same whether RLS is filtering at the DB level
or not. The cross-tenant test is the only way to confirm DB-level enforcement.
Fix: always run Step 5b before marking isolation complete.

**4. TenantProvider fallback to hardcoded ID**

Symptom: the app works for the seed tenant but crashes or shows wrong data for a real second
tenant, because a new user's `nursery_id` resolves to NULL and the code falls back to the
hardcoded demo ID.
Fix: make the no-match case an explicit error, never a fallback.

**5. PIN-only auth — auth.uid() is always null**

Symptom: all RLS policies filter out every row. The app shows empty state everywhere.
Fix: adopt the shared session auth model before applying this runbook.

---

## Per-Vertical Instantiation Checklist

Copy this block and fill it in for each vertical before marking the vertical as multi-tenant isolated.

```
Vertical: _______________
Date started: ___________
Engineer: _______________

[ ] Precondition gate passed (build clean + real Supabase session auth)
[ ] owner_id column exists on tenant root table
[ ] owner_id populated for all existing rows (no NULLs)
[ ] TenantProvider context built: resolves uid → tenantId post-login, loud error on no-match
[ ] All hardcoded tenant-ID constants replaced with context value (grep confirms 0 remaining)
[ ] RLS migration written and applied: per-tenant authenticated SELECT on all tenant tables
[ ] Public-route tables documented: anon USING(true) added where needed, no others
[ ] Same-tenant smoke test passed: dashboard loads correct data after migration
[ ] Cross-tenant isolation test passed: Test A = 0 rows, Test B = 1 row
[ ] Cleanup SQL run: test rows removed from nurseries/customers/orders
[ ] Tech Debt Log updated in CLAUDE.md: 🟡 items resolved to 🟢
```

---

## Cultivar OS — Completion Status (as of 2026-05-28)

| Step | Status | Notes |
|---|---|---|
| Precondition gate | ✅ | Build clean; Supabase email/password auth with real session |
| owner_id populated | ✅ | LAWNS row confirmed: `ba7cf242-...` |
| TenantProvider built | ✅ | `packages/cultivar-os/src/context/NurseryProvider.tsx` |
| Hardcoded constants replaced | ✅ | 19 DEMO_NURSERY_ID sites — Track 1 |
| RLS migration written | ✅ | `supabase/migrations/20260528_per_tenant_rls_isolation.sql` |
| Migration applied | ⏳ | David runs in Supabase SQL editor — bgobkjcopcxusjsetfob |
| Same-tenant smoke test | ⏳ | Run after migration applied |
| Cross-tenant test | ⏳ | Run Step 5b SQL after migration applied |
| Tech Debt Log updated | ⏳ | Resolve items #8 and the USING(true) note on #7 |

---

## Ignition OS — Gate Status (as of 2026-05-28)

| Gate | Status | Blocker |
|---|---|---|
| Build clean | ❌ | Missing `supabase.js` — unresolved build error |
| Real Supabase session auth | ❌ | PIN-only auth; `auth.uid()` is always null |
| Runbook applicable | ❌ | Both gates must pass first |

Do not start the Ignition OS multi-tenant work until both blockers are resolved. The correct
sequence is: (1) fix build, (2) migrate auth to shared session model per CLAUDE.md locked rule,
(3) then run this runbook.
