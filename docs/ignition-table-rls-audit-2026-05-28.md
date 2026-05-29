# Ignition OS — Table & RLS Audit
**Date:** 2026-05-28
**Scope:** packages/ignition-os/ + packages/shared/src/supabase/auth.ts
**Auditor:** Claude Code
**Context:** Cultivar OS hit the same RLS silent-empty bug three times (modules May 22,
nursery_modules May 22, orders May 27). This audit checks whether Ignition OS has the same
latent issue. Read-only — no changes made.

---

## 1. Project Identification

**Ignition OS Supabase project ref:** `ufsgqckbxdtwviqjjtos`
**URL:** `https://ufsgqckbxdtwviqjjtos.supabase.co`
**Source:** Confirmed from `.env.vercel.local` — `VITE_SUPABASE_URL=https://ufsgqckbxdtwviqjjtos.supabase.co`

Separate project from Cultivar OS (`bgobkjcopcxusjsetfob`). The two projects share no tables.

---

## 2. Migration Files — None Exist for Ignition OS

`supabase/migrations/` contains 7 files. All are Cultivar OS, dated 2026-05-21 onward:

```
20260521_make_shop_id_nullable.sql
20260522_rls_modules_nursery_modules.sql
20260522_social_drafts_add_failed_status.sql
20260522_social_drafts_add_order_post_type.sql
20260522_social_drafts_rls.sql
20260523_qb_token_expires_at.sql
20260527_orders_authenticated_select_policy.sql
```

**Zero Ignition OS migration files exist.** The schema — all tables, all RLS settings, all
policies — was built directly in the Supabase SQL editor. The repo has no record of whether
RLS is enabled on any Ignition OS table, nor whether any SELECT policies exist. Same pattern
as early Cultivar OS, which produced the three silent-empty bugs that motivated this audit.

---

## 3. Supabase Client Instantiation

**File:** `packages/ignition-os/DataBridge.js:8`

```js
import { supabase } from './supabase';
```

This resolves to `packages/ignition-os/supabase.js` — **which does not exist in the repo**
(see Finding A in Section 7). The Ignition OS build is currently broken at the import level.
The correct shared client at `packages/shared/src/supabase/client.ts` creates the client
using `VITE_SUPABASE_ANON_KEY`.

**No service key is configured for Ignition OS.** `.env.vercel.local` shows
`SUPABASE_SERVICE_KEY=""` (empty). There is no Ignition OS serverless API layer — unlike
Cultivar OS, which has `api/` routes that use a service key to bypass RLS.

**Every Supabase call in Ignition OS uses the anon key and is fully subject to RLS.**

---

## 4. Tables Accessed — 29 Tables + 1 Storage Bucket

`eval-photos` is a Supabase Storage bucket accessed via `supabase.storage.from('eval-photos')`.
Bucket access control is separate from table RLS. Excluded from the table analysis.

| # | Table | SELECT read? | Writes? | Primary source file(s) |
|---|-------|-------------|---------|------------------------|
| 1 | `jobs` | ✅ | ✅ | DataBridge.js, IgnitionFlux, IgnitionEstimate, IgnitionEval, IgnitionInvoice, CustomerApprovalPortal |
| 2 | `shops` | ✅ | ✅ | DataBridge.js, CoreApp.jsx, IgnitionOmni, OnboardingWizard, App.js |
| 3 | `users` | ✅ | ✅ | DataBridge.js |
| 4 | `shop_members` | ✅ | ✅ | DataBridge.js (authenticate), CoreApp.jsx, IgnitionAdmin |
| 5 | `member_devices` | ✅ | ✅ | DataBridge.js (autoEnrollDevice), IgnitionAdmin |
| 6 | `shop_invites` | ✅ | ✅ | CoreApp.jsx, IgnitionAdmin |
| 7 | `pin_resets` | ✅ | ✅ | CoreApp.jsx, IgnitionAdmin |
| 8 | `teams` | ✅ | ✅ | IgnitionAdmin |
| 9 | `purchase_orders` | ✅ | ✅ | DataBridge.js |
| 10 | `tools` | ✅ | ✅ | DataBridge.js, IgnitionKosk, IgnitionTools |
| 11 | `tool_signout_log` | ✅ | ✅ | IgnitionTools (SELECT), IgnitionKosk (INSERT) |
| 12 | `pmi_schedules` | ✅ | ✅ | DataBridge.js |
| 13 | `customers` | ✅ | ✅ | IgnitionIntake, IgnitionOmni |
| 14 | `customer_vehicles` | ✅ | ✅ | IgnitionIntake |
| 15 | `customer_authorizations` | — | ✅ | CustomerApprovalPortal (INSERT only) |
| 16 | `estimates` | ✅ | ✅ | IgnitionEstimate, IgnitionInvoice, CustomerApprovalPortal |
| 17 | `estimate_line_items` | ✅ | ✅ | IgnitionEstimate, IgnitionKosk, IgnitionInvoice, CustomerApprovalPortal |
| 18 | `evaluations` | ✅ | ✅ | IgnitionEval, IgnitionEstimate |
| 19 | `eval_photos` | ✅ | ✅ | IgnitionEval |
| 20 | `dtc_codes` | ✅ | ✅ | IgnitionEval |
| 21 | `labor_entries` | ✅ | ✅ | IgnitionEval, IgnitionKosk, IgnitionOmni |
| 22 | `repair_logs` | ✅ | ✅ | IgnitionKosk (SELECT + INSERT) |
| 23 | `invoices` | ✅ | ✅ | IgnitionInvoice, IgnitionOmni |
| 24 | `invoice_line_items` | ✅ | ✅ | IgnitionInvoice |
| 25 | `inventory` | ✅ | — | IgnitionStok (SELECT only; no INSERT found) |
| 26 | `ai_usage` | ✅ | ✅ | DataBridge.js |
| 27 | `concept_aliases` | — | ✅ | IgnitionAudit (upsert only) |
| 28 | `error_events` | — | ✅ | DataBridge.js (fire-and-forget INSERT) |
| 29 | `feature_events` | — | ✅ | DataBridge.js (fire-and-forget INSERT) |

**Total: 24 tables have frontend SELECT reads via anon key.** All are subject to RLS.

---

## 5. RLS State

**RLS state cannot be determined from the repo.** No migration files, no CREATE TABLE
statements, no CREATE POLICY statements exist anywhere in the repository for any Ignition
OS table.

### The three possible states for each table

| State | rowsecurity in pg_tables | SELECT policy in pg_policies | Effect |
|-------|--------------------------|------------------------------|--------|
| RLS off | false | — | Reads return all rows matching the .eq() filter |
| RLS on + SELECT policy | true | present | Reads return rows matching both filter and policy |
| **RLS on + no SELECT policy** | **true** | **absent** | **Reads return [] silently — the Cultivar bug** |

The third state is the target risk. It produces no error; the query succeeds with empty results.
The Cultivar OS experience shows this is easy to create accidentally when enabling RLS on a
table that was previously open.

### Critical: auth model incompatibility with standard RLS patterns

Ignition OS uses PIN-based auth. Users log in by querying `shop_members.pin_hash` directly —
they never call `supabase.auth.signIn*()`. As a result, **`auth.uid()` is always `null` at
the database level for every Ignition OS request.**

Consequence: any RLS policy written in the standard pattern — `USING (auth.uid() = user_id)`
or `USING (auth.uid() = owner_id)` — will silently filter out every row for every query.
The only policy expression that permits reads in Ignition OS's auth model is `USING (true)`.

If Supabase has RLS enabled on any Ignition OS table but the policy uses an `auth.uid()`
check, it will behave identically to the "no SELECT policy" case: reads return [] silently.

**This is not a fix request — it is a documentation of the risk the SQL queries in Section 6
need to expose.**

---

## 6. SQL Queries to Close the Gap

Run both in the Supabase SQL editor for project `ufsgqckbxdtwviqjjtos`.

**Query 1 — RLS enable/disable state per table:**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Query 2 — All existing RLS policies:**

```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

### How to interpret the results

A table is at risk if **both** conditions are true:

1. `rowsecurity = true` in Query 1, AND
2. No row in Query 2 has `tablename = '<that table>'` and `cmd IN ('SELECT', 'ALL')`

Any at-risk table that also appears in the SELECT column of Section 4 is an active silent-empty
bug. Any at-risk table that only has writes would block INSERTs and UPDATEs from the anon key
(a different class of failure, not silent).

Additionally: for any SELECT policy that does exist, check that `qual` (the USING expression)
does not contain `auth.uid()`. Due to the PIN auth model, `auth.uid()` is always null, so such
a policy would pass the "policy present" check but still silently empty all reads.

---

## 7. Incidental Findings

Not the RLS focus. Logged per scope instructions.

### Finding A — supabase.js is missing from packages/ignition-os/ (build-blocker)

Every Ignition OS Supabase consumer imports from a file that does not exist:

| File | Import statement |
|------|-----------------|
| `packages/ignition-os/DataBridge.js:8` | `import { supabase } from './supabase'` |
| `packages/ignition-os/CoreApp.jsx:10` | `import { supabase } from './supabase'` |
| `packages/ignition-os/modules/IgnitionAdmin.jsx:17` | `import { supabase } from '../supabase'` |
| `packages/ignition-os/modules/IgnitionAudit.jsx:17` | `import { supabase } from '../supabase'` |
| `packages/ignition-os/modules/IgnitionEval.jsx:17` | `import { supabase } from '../supabase'` |
| `packages/ignition-os/modules/IgnitionEstimate.jsx:17` | `import { supabase } from '../supabase'` |
| `packages/ignition-os/modules/IgnitionFlux.jsx:3` | `import { supabase } from '../supabase'` |
| `packages/ignition-os/modules/IgnitionIntake.jsx:14` | `import { supabase } from '../supabase'` |
| `packages/ignition-os/modules/IgnitionInvoice.jsx:2` | `import { supabase } from '../supabase'` |
| `packages/ignition-os/modules/IgnitionKosk.jsx:14` | `import { supabase } from '../supabase'` |
| `packages/ignition-os/modules/IgnitionOmni.jsx:7` | `import { supabase } from '../supabase'` |
| `packages/ignition-os/modules/IgnitionStok.jsx:32` | `const { supabase } = await import('../supabase')` |
| `packages/ignition-os/modules/IgnitionTools.jsx:4` | `import { supabase } from '../supabase'` |
| `packages/ignition-os/modules/CustomerApprovalPortal.jsx:22` | `import { supabase } from '../supabase'` |

No `supabase.js` or `supabase.ts` exists at `packages/ignition-os/`. The file was presumably
present locally during active development but was never committed. This is consistent with
CLAUDE.md's note that Ignition OS is "feature-complete, development paused."

The shared client at `packages/shared/src/supabase/client.ts` exports `{ supabase }` and
would be the natural target for a shim, but no import path in Ignition OS currently routes
to it.

### Finding B — packages/shared/src/supabase/auth.ts is not wired into Ignition OS

`auth.ts` implements `authenticate()`, `autoEnrollDevice()`, `hashPin()`, and
`getTrialStatus()` — all Ignition OS concepts, extracted from DataBridge. No Ignition OS
file imports from it (verified: no `@trace/shared` import found in any ignition-os file).

Ignition OS uses the inline DataBridge implementations at lines 672–775 of DataBridge.js.
The two implementations are functionally equivalent but independently maintained. Any fix
or change applied to `auth.ts` will not take effect in Ignition OS until Ignition OS is
updated to import from the shared module.

Not a bug today — a maintenance risk once Ignition OS is re-activated.

### Finding C — pushCloudSync swallows upsert errors silently

`DataBridge.pushCloudSync()` at line 237 awaits the upsert:

```js
await supabase.from('jobs').upsert(rows, { onConflict: 'id' });
```

The `{ data, error }` return is not captured. A constraint violation, RLS block, or network
error is swallowed by the catch block at line 239, which only logs a warning and falls back
to FastAPI. This is intentional local-first design but means sync failures are invisible to
the user and to the operator's logs. Logged per scope instruction; not a finding to chase.

### Finding D — authenticate() un-awaited in voice module (pre-existing)

Per the prior voice audit at docs/ignition-os-voice-audit-2026-05-27.md: `authenticate()` is
not awaited in at least one voice-hook code path. Not re-investigated here; logged for
continuity.

---

## 8. Summary Table

| Item | Finding |
|------|---------|
| Supabase project ref | `ufsgqckbxdtwviqjjtos` (confirmed) |
| Migration files for Ignition OS | **None** — schema entirely in Supabase, not in repo |
| RLS state determinable from repo? | **No** — requires live SQL queries (Section 6) |
| Tables with frontend SELECT reads | **24** — all via anon key, all subject to RLS |
| Service key configured? | **No** — SUPABASE_SERVICE_KEY="" in all local env files |
| auth.uid() available for RLS? | **No** — PIN auth bypasses Supabase Auth; uid() always null |
| Valid RLS policy pattern | Only `USING (true)` works with PIN auth |
| At-risk if RLS enabled | All 24 SELECT tables, plus any table with RLS + `auth.uid()` check |
| supabase.js present? | **No** — build-blocker (Finding A) |
| Shared auth.ts wired in? | **No** — inline DataBridge copies are the active implementation |

**Action required before any Ignition OS dry-run or reactivation:** Run the two SQL queries
in Section 6 against project `ufsgqckbxdtwviqjjtos` and report the results. For any table
where RLS is enabled, verify a SELECT policy with `USING (true)` is present. Resolve
Finding A (missing supabase.js) before attempting a build.
