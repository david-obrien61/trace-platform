# Dashboard "Today's Sales" Zero-Count Investigation
**Date:** 2026-05-27  
**Order in question:** CLV-20260527-2349 (~4:38 PM CDT)  
**Symptom:** Dashboard shows "0 — No orders yet today" after order confirmed in Supabase and QuickBooks

---

## Root Cause — HIGH CONFIDENCE

**Missing RLS SELECT policy on the `orders` table.**

The frontend Dashboard reads orders using the Supabase anon-key client (subject to Row Level Security). The `orders` table has RLS enabled but no SELECT policy was ever added for authenticated users. Supabase returns `[]` silently — no error, no exception, just an empty array.

This is the **exact same bug** that caused the tile state failure fixed on 2026-05-22:

> "Root cause: both tables have RLS enabled but no permissive read policies. Authenticated frontend reads return [] silently."  
> — `supabase/migrations/20260522_rls_modules_nursery_modules.sql`

The `orders` table has no equivalent migration. There are zero `CREATE POLICY` statements for `orders` in the entire `supabase/migrations/` directory.

---

## Evidence

### 1. The query path

`Dashboard.tsx:loadMetrics()` (lines 102–159) queries Supabase **directly** via the anon-key client:

```ts
// packages/shared/src/supabase/client.ts — anon key, RLS enforced
export const supabase = createClient(url ?? '', key ?? '');
```

The `orders` query (Dashboard.tsx lines 120–126):
```ts
supabase
  .from('orders')
  .select('id, total_amount')
  .eq('nursery_id', DEMO_NURSERY_ID)
  .neq('status', 'cancelled')
  .gte('created_at', today)
```

Write path (`api/orders/submit.ts` lines 6–10) uses the **service key**, which bypasses RLS entirely. Orders write successfully; reads are silently blocked.

### 2. The boundary calculation

`todayStart()` at Dashboard.tsx lines 16–20:
```ts
function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);  // midnight in BROWSER LOCAL time (CDT = UTC-5)
  return d.toISOString();   // converts local midnight to UTC: 2026-05-27T05:00:00.000Z
}
```

For a 4:38 PM CDT order (= 21:38 UTC), the filter `created_at >= 2026-05-27T05:00:00.000Z` would correctly include the order **if RLS were not blocking**. The timezone calculation is not the cause for this afternoon order.

Latent secondary bug: orders placed between 00:00 UTC and 05:00 UTC (7 PM–midnight CDT) will have a UTC date of "tomorrow" and would appear on the wrong dashboard day. Not triggered at 4:38 PM CDT.

### 3. The nursery_id is correct

`useSubmitOrder.ts` line 41:
```ts
const nurseryId = DEMO_NURSERY_ID;  // 'a1b2c3d4-0000-0000-0000-000000000001'
```
Matches `DEMO_NURSERY_ID` in Dashboard.tsx. No mismatch.

### 4. The order status is correct

`api/orders/submit.ts` line 130: `status: 'pending'`. Dashboard filter: `.neq('status', 'cancelled')`. `'pending'` passes this filter. No status mismatch.

### 5. The Refresh button re-fires the query (not a cache issue)

Dashboard.tsx lines 613–621:
```tsx
<button onClick={loadMetrics} ...>Refresh data</button>
```
`loadMetrics()` re-issues the Supabase queries from scratch. No caching. But if RLS blocks the query, every refresh returns `[]` identically. The button cannot help while the RLS policy is missing.

### 6. A dead server-side dashboard endpoint exists but is never called

`packages/cultivar-os/api/dashboard.ts` uses the **service key** (bypasses RLS) and fetches metrics server-side. It is never called by Dashboard.tsx. The frontend queries Supabase directly. This endpoint is dead code — but if wired up, it would sidestep both the RLS issue and the timezone edge case.

---

## Confirmation Query (David runs in Supabase SQL editor)

```sql
-- Verify: does the orders table have any SELECT policies?
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'orders';
-- Expected: zero rows (no policies)

-- Verify: is the order in the table?
SELECT id, nursery_id, status, total_amount, created_at
FROM orders
WHERE notes = 'CLV-20260527-2349';
-- Expected: one row, status='pending', nursery_id='a1b2c3d4-0000-0000-0000-000000000001'
```

---

## Fix

**Option A — Minimum viable (5 minutes). Recommended before demo.**

Create and apply `supabase/migrations/20260528_rls_orders_select.sql`:

```sql
-- RLS SELECT policy: orders table.
-- Root cause: orders table has RLS enabled but no permissive SELECT policy.
-- Authenticated frontend reads return [] silently, causing dashboard metrics to
-- show zero even when orders exist. Same root cause as the modules/nursery_modules
-- fix in 20260522_rls_modules_nursery_modules.sql.
-- TODO post-demo: tighten to nursery owner_id join once nurseries.owner_id populated.
CREATE POLICY "authenticated_select_orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (true);
```

Run in Supabase SQL editor (project bgobkjcopcxusjsetfob). No code changes required. Dashboard.tsx query logic is correct — it has been blocked, not wrong.

**Option B — Wire Dashboard.tsx to /api/dashboard (30–45 min). Better long-term.**

`packages/cultivar-os/api/dashboard.ts` already exists with service-key access and correct logic. Refactor `loadMetrics()` to call `fetch('/api/dashboard?nursery_id=...')` instead of querying Supabase directly. This eliminates RLS exposure and the midnight-UTC timezone edge case. Do post-demo.

---

## Demo Risk Assessment

**GUARANTEED failure on demo day.** Every order placed during the demo will show 0 on the dashboard. This is the "closed-loop" moment — Lauren/Terry watch a sale happen and then see the owner dashboard reflect it. If the count stays at 0, that moment fails completely.

This is not intermittent. RLS blocking is deterministic. Every dashboard load after any order will return 0.

---

## Workaround if Fix Cannot Be Applied in Time

Do not demo around this — the fix is 5 minutes. Apply Option A now.

If absolutely necessary: after placing the demo order, open a second tab to the Supabase Table Editor showing the orders table with the live row. Frame it as "here's the raw database — you can see the order hit." Poor substitute for the dashboard tile.

---

## Estimated Fix Time

Option A: 5 minutes (write migration file, paste into Supabase SQL editor, verify with confirmation query above).  
Option B: 30–45 minutes (post-demo refactor).

Apply Option A before the demo.

---

*Investigated by Claude Code — 2026-05-27*  
*TRACE Enterprises · Built with CAI*
