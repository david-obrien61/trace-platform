# RLS Audit + Demo Closed-Loop Readiness
**Date:** 2026-05-28  
**Scope:** Read-only. No code modified. No commits.  
**Method:** Traced actual call paths through migrations, frontend hooks, API handlers, and page components.

---

## PART A — Systematic RLS Audit

### A.1 — How the client split works

| Client | Where created | Key used | Subject to RLS? |
|---|---|---|---|
| `supabase` (shared client) | `packages/shared/src/supabase/client.ts:10` | `VITE_SUPABASE_ANON_KEY` | YES |
| `adminDb()` in serverless functions | per-function inline | `SUPABASE_SERVICE_KEY` | NO — bypasses RLS entirely |

All frontend page components and hooks (`Dashboard.tsx`, `usePlant`, `useModules`, `useAddons`, `useNursery`) import from `packages/cultivar-os/src/lib/supabase.ts` which re-exports the shared anon-key client. All serverless API handlers (`api/orders/submit.ts`, `api/qbo/*`, `api/social/*`) call `adminDb()` with the service key.

### A.2 — Table RLS status

The repo contains **no CREATE TABLE migrations**. The schema was built directly in Supabase. Only ALTER/policy migrations exist. RLS state for tables without a migration is marked **UNKNOWN (inferred)** — inferred from whether the table currently works for the frontend.

| Table | RLS enabled? | Has SELECT policy? | Read by frontend (anon)? | Risk level |
|---|---|---|---|---|
| `orders` | YES (pre-existing) | YES — `authenticated_select_orders` (20260527) | YES — Dashboard.tsx:121/128/135 | ✅ RESOLVED (was active bug until 2026-05-27) |
| `modules` | YES (20260522) | YES — `authenticated_select_modules` (20260522) | YES — useModules:92 | ✅ RESOLVED |
| `nursery_modules` | YES (20260522) | YES — `authenticated_select_nursery_modules` (20260522) | YES — useModules:87 | ✅ RESOLVED |
| `social_drafts` | YES (20260522) | YES — `authenticated_select_social_drafts` (20260522) | YES — Dashboard.tsx:165 | ✅ RESOLVED |
| `nurseries` | UNKNOWN (inferred OFF or has policy) | UNKNOWN | YES — Dashboard.tsx:109, useModules:81, useNursery:13 | ⚠️ UNVERIFIED — currently working |
| `plants` | UNKNOWN (inferred OFF or has policy) | UNKNOWN | YES — Dashboard.tsx:115, usePlant:62/83 | ⚠️ UNVERIFIED — currently working |
| `plant_events` | UNKNOWN (inferred OFF or has policy) | UNKNOWN | YES — usePlant:77 | ⚠️ UNVERIFIED — currently working |
| `addons` | UNKNOWN (inferred OFF or has policy) | UNKNOWN | YES — useAddons:25 | ⚠️ UNVERIFIED — currently working |
| `customers` | UNKNOWN | n/a | NO — service key only (submit.ts:35/55) | LOW — not exposed to anon key |
| `order_items` | UNKNOWN | n/a | NO — service key only (submit.ts:139) | LOW — not exposed to anon key |
| `order_addons` | UNKNOWN | n/a | NO — service key only (submit.ts:150/158) | LOW — not exposed to anon key |
| `losses` | UNKNOWN | n/a | NO — not referenced in any frontend code | LOW — dead code or unbuilt |

### A.3 — Tables in auth.ts that do NOT apply to cultivar-os

`packages/cultivar-os/src/lib/shared/supabase/auth.ts` (the old Ignition OS PIN auth) references `member_devices` and `shop_members`. **This file is never imported by any cultivar-os page or hook.** The cultivar-os auth path is `lib/auth.ts → configureAuth({ strategy: 'email' })`. The PIN auth file is dormant in the cultivar-os package and carries no runtime risk, but it should not exist here (it belongs in ignition-os only).

### A.4 — Key finding: four tables have unverified RLS state

**`nurseries`, `plants`, `plant_events`, `addons`** are read by the frontend via the anon key and their RLS state is not documented in any migration. They currently work. Three possibilities:

1. RLS is disabled on these tables (most likely — they predate the RLS discipline introduced May 22).
2. RLS is enabled and they have SELECT policies that were set directly in the Supabase dashboard.
3. RLS is enabled with no policy → silent empty (this would have broken the demo, so effectively ruled out).

**These four tables are the systemic audit gap.** A one-query check in the Supabase SQL editor would close it permanently:

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

And to list existing policies:

```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Run both in the bgobkjcopcxusjsetfob project SQL editor. If any of the four tables show `rowsecurity = true` with no SELECT policy, it's a latent bug even if it works now (Supabase auth session state could change its behavior).

---

## PART B — Demo Closed-Loop Reality Check

### Step 1 — Customer entry / browse / scan

**WORKS.** Evidence: [PlantProfile.tsx:9-12](../packages/cultivar-os/src/pages/PlantProfile.tsx#L9-L12) reads `tagId` from the URL param. [usePlant.ts:61-65](../packages/cultivar-os/src/hooks/usePlant.ts#L61-L65) queries `plants` via `.ilike('tag_id', tagId)`. Inventory is DB-sourced, not hardcoded. A 24-hour localStorage cache is layered on top — first load hits the network; subsequent loads in the same browser session are served from cache.

One confirmed tech debt: [PlantProfile.tsx:108](../packages/cultivar-os/src/pages/PlantProfile.tsx#L108) hardcodes `LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336` as a footer string. Per CLAUDE.md Tech Debt Log #4, this should read from the nursery object. For the demo it displays correctly, but would show LAWNS data for any future customer. Does not affect the closed-loop test.

### Step 2 — Pricing (product + install)

**WORKS.** All prices are DB-sourced:

- `plant.base_price` — comes from the `plants` table row, fetched by `usePlant` ([usePlant.ts:62](../packages/cultivar-os/src/hooks/usePlant.ts#L62))
- `plant.install_price` — comes from the same `plants` row, used in [submit.ts:94](../packages/cultivar-os/api/orders/submit.ts#L94) and [CartReview.tsx](../packages/cultivar-os/src/pages/CartReview.tsx)
- Add-on prices (`netting`, `compost`, etc.) — DB-sourced from `addons` table via [useAddons.ts:24-29](../packages/cultivar-os/src/hooks/useAddons.ts#L24-L29)

**One partial fallback:** [AddOns.tsx:39](../packages/cultivar-os/src/pages/AddOns.tsx#L39) hardcodes `nettingPrice = nettingCartAddon?.addon.price_per_plant ?? 10`. If `addons` returns empty (RLS issue or timeout), netting displays as $10 and the order proceeds with the fallback price. This is a deliberate defensive design, not a bug, but it means netting price could diverge from DB if the addons query fails silently.

### Step 3 — Order placement

**WORKS.** Full path confirmed:

1. [useSubmitOrder.ts:44](../packages/cultivar-os/src/hooks/useSubmitOrder.ts#L44) — `fetch('/api/orders/submit', { method: 'POST', ... })`
2. [api/orders/submit.ts](../api/orders/submit.ts) re-exports from [packages/cultivar-os/api/orders/submit.ts](../packages/cultivar-os/api/orders/submit.ts)
3. [submit.ts:29](../packages/cultivar-os/api/orders/submit.ts#L29) — `adminDb()` creates a **service-key** client (bypasses RLS)
4. [submit.ts:116-133](../packages/cultivar-os/api/orders/submit.ts#L116-L133) — inserts into `orders`; on success returns `orderId`
5. [submit.ts:139-165](../packages/cultivar-os/api/orders/submit.ts#L139-L165) — inserts into `order_items` and `order_addons`
6. [submit.ts:169-172](../packages/cultivar-os/api/orders/submit.ts#L169-L172) — updates the plant's status to `reserved`

All five writes use the service key. RLS state of those tables does not matter for writes.

### Step 4 — Confirmation screen

**WORKS with two Surface Honesty flags:**

**Flag 4a — hardcoded "sandbox" label (MEDIUM priority):**  
[Confirmation.tsx:187-191](../packages/cultivar-os/src/pages/Confirmation.tsx#L187-L191):

```tsx
<a href={`/demo/quickbooks-invoice?orderId=${state.orderId}&total=${total}&invoiceNumber=${invoiceNumber}`} ...>
  View QuickBooks sandbox preview →
</a>
```

This link text says **"sandbox"** regardless of environment. QBO_ENVIRONMENT is `production` in Vercel (confirmed by Session K audit 2026-05-27). The link goes to the internal `/demo/quickbooks-invoice` page, which is an internal mock — not a real QB URL. For the demo, Lauren or Terry tapping this button sees a page labeled "QuickBooks sandbox view — demo only" ([DemoQBInvoice.tsx:16](../packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L16)).

This is fine for the demo IF the context is set properly. But showing "sandbox preview" when the actual QB environment is production is a Surface Honesty violation that should be fixed before the demo run.

**Flag 4b — "Layna" reference in DemoQBInvoice (HIGH priority):**  
[DemoQBInvoice.tsx:134](../packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L134):

```
In the live demo, Layna sees this invoice in her real QuickBooks account.
```

Per CLAUDE.md (Key Contacts section): **"Layna" was a miscommunication and is not a real contact. Do not reintroduce.** The correct name is Lauren Bishop. If Terry or Lauren taps this link during the demo, they will see "Layna" — which is the wrong name for the person sitting across the table. This is a demo-critical factual error.

**QB invoice path (conditional):** If QB is connected, `qbInvoiceUrl` is populated and the "View invoice in QuickBooks" button ([Confirmation.tsx:167-173](../packages/cultivar-os/src/pages/Confirmation.tsx#L167-L173)) links to the real QB invoice URL. The `/demo/quickbooks-invoice` link is displayed as a secondary fallback below it in all cases — even when the real QB link is shown. That means both a real QB link and the "sandbox preview" link are visible simultaneously if QB is connected. The demo viewer would need to know which to tap.

### Step 5 — Dashboard reflects the sale

**WORKS** (with one timezone note).

Path confirmed:  
[Dashboard.tsx:102-158](../packages/cultivar-os/src/pages/Dashboard.tsx#L102-L158) — `loadMetrics()` runs three `orders` queries via the anon-key client. The `authenticated_select_orders` RLS policy is now in place (applied 2026-05-27 to bgobkjcopcxusjsetfob), so the queries return real data.

**Today's Sales query** ([Dashboard.tsx:121-126](../packages/cultivar-os/src/pages/Dashboard.tsx#L121-L126)):

```ts
supabase
  .from('orders')
  .select('id, total_amount')
  .eq('nursery_id', DEMO_NURSERY_ID)
  .neq('status', 'cancelled')
  .gte('created_at', today)   // today = todayStart()
```

`todayStart()` ([Dashboard.tsx:16-20](../packages/cultivar-os/src/pages/Dashboard.tsx#L16-L20)):

```ts
function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);   // midnight LOCAL browser time
  return d.toISOString();    // converts to UTC ISO string
}
```

**Timezone edge case (noted, not a demo blocker):**  
The `todayStart()` function computes midnight in the **browser's local timezone** and converts to UTC. For a browser in CDT (UTC-5), midnight CDT = 05:00 UTC. Supabase stores `created_at` in UTC. An order placed at 11:30 PM CDT shows a `created_at` of 04:30 UTC the next calendar day — which IS after 05:00 UTC "today" and would appear in today's count. This means for the demo in Texas, the logic is correct.

The edge case matters if the dashboard is viewed from a timezone ahead of CDT (e.g., an owner reviewing remotely from UTC+0). That is out of scope for the LAWNS demo.

**Revenue calculation:** [Dashboard.tsx:153](../packages/cultivar-os/src/pages/Dashboard.tsx#L153) sums `total_amount` from the `orders` rows. `total_amount` is written by `submit.ts:100` which includes plants + addons + tax. The number is end-to-end consistent.

---

## PART C — Environment

### Which project does the demo link point at?

| Property | Value |
|---|---|
| Demo URL | `cultivar-os.vercel.app` |
| Vercel project | `cultivar-os` |
| Supabase project ref | `bgobkjcopcxusjsetfob` |
| Supabase URL | `https://bgobkjcopcxusjsetfob.supabase.co` |
| QBO_ENVIRONMENT | `production` (confirmed 2026-05-27 by Vercel dashboard inspection) |

### Is the orders RLS SELECT policy in that environment?

**YES.** Per CLAUDE.md Session K notes and git log (`fd56a18`): the `authenticated_select_orders` policy was applied manually to the `bgobkjcopcxusjsetfob` project on 2026-05-27. The dashboard dry-run that surfaced the bug was run against the live Vercel/Supabase stack and confirmed working after the fix.

**One migration file caveat:**  
[20260527_orders_authenticated_select_policy.sql](../supabase/migrations/20260527_orders_authenticated_select_policy.sql) contains a `NOTE:` comment appended after the SQL terminator on line 17. This would cause a migration runner to fail, but since it was applied manually it has no impact on the live project. The file is advisory only. Do not run it through `supabase db push` without removing the trailing NOTE block first.

### DEMO_NURSERY_ID — hardcoded vs. env var

[constants.ts:3](../packages/cultivar-os/src/lib/constants.ts#L3): `export const DEMO_NURSERY_ID = 'a1b2c3d4-0000-0000-0000-000000000001';`

The value is **hardcoded**, not read from `VITE_DEMO_NURSERY_ID` (which is set in Vercel but not imported). The hardcoded value matches the Vercel env var and the actual LAWNS nursery row ID in the database — so for the demo, this is correct. The discrepancy (env var set but not used) should be noted for the post-demo cleanup.

---

## Summary Table

### Critical issues to fix before demo

| # | File | Issue | Severity |
|---|---|---|---|
| 1 | [DemoQBInvoice.tsx:134](../packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L134) | "Layna" — wrong name, should be "Lauren" | **CRITICAL** |
| 2 | [Confirmation.tsx:187-191](../packages/cultivar-os/src/pages/Confirmation.tsx#L187-L191) | Link text says "sandbox preview" but env is production | Medium |
| 3 | [DemoQBInvoice.tsx:16,28](../packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L16) | "QuickBooks sandbox view / Sandbox — LAWNS" — env is production | Medium |

### Closed-loop verdict

| Step | Status | Notes |
|---|---|---|
| Scan plant profile | WORKS | DB-sourced; 24h localStorage cache |
| Prices displayed | WORKS | DB-sourced; netting has $10 fallback if addons fail |
| Order writes to DB | WORKS | Service key; RLS irrelevant for writes |
| Confirmation shown | WORKS | Two Surface Honesty flags (see above) |
| Dashboard reflects sale | WORKS | RLS policy confirmed in live project |

### RLS unverified tables (action required)

Run the two SQL queries in Section A.4 against project `bgobkjcopcxusjsetfob` to confirm the RLS state of `nurseries`, `plants`, `plant_events`, and `addons`. If any show `rowsecurity = true` with no SELECT policy, treat as an active bug — the same fix pattern as `modules` and `orders` applies.

---

*Audit complete. Read-only. No files modified.*
