# RECON — inventory count reconciliation (schema + surfaces + blind-capture)

**Date:** 2026-07-19 · **Branch:** `main` · **SHA:** `c416dac` · **Type:** RECON ONLY — read-and-report
**Actor:** Thunder · **Consumers:** Lightning + David (they design; this doc does not propose)

**Scope discipline:** zero code edited, zero schema, zero migration, zero api-fn (12/12 untouched).
Every answer below is grounded in a quoted `file:line` or explicitly flagged **DAVID-QUERY**.
Nothing here is stated from memory or expectation.

---

## R1 — SCHEMA AS COMMITTED

**Source confirmed:** `supabase/migrations/20260626_inventory_count_sessions.sql` (129 lines) — the ledger's
citation is correct and it is the **only** migration that creates these tables.

**Later ALTERs: NONE.** A repo-wide grep for `ALTER TABLE (public.)?inventory_count` returns only the two
`ENABLE ROW LEVEL SECURITY` lines inside the creating migration itself
([:42](../../supabase/migrations/20260626_inventory_count_sessions.sql#L42), [:83](../../supabase/migrations/20260626_inventory_count_sessions.sql#L83)).
The only other SQL mention repo-wide is a passing comment in
`supabase/migrations/20260715_orders_status_drop_check.sql:27`. **As committed, the schema is exactly what
the 06-26 migration declares.** (Whether LIVE matches — see R2.)

### `inventory_count_sessions` ([:27–37](../../supabase/migrations/20260626_inventory_count_sessions.sql#L27-L37))

| column | type | nullable |
|---|---|---|
| `id` | uuid | NOT NULL (PK, `gen_random_uuid()`) |
| `business_id` | uuid | NOT NULL → `businesses(id)` ON DELETE CASCADE |
| `status` | text | NOT NULL DEFAULT `'in_progress'` |
| `counted_by` | uuid | **nullable** |
| `item_count` | int | NOT NULL DEFAULT 0 |
| `started_at` | timestamptz | NOT NULL DEFAULT `now()` |
| `completed_at` | timestamptz | **nullable** |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |
| `updated_at` | timestamptz | NOT NULL DEFAULT `now()` |

Notes carried by the migration itself: `status` has **no CHECK** — "AC-4, value set grows without migration"
([:30](../../supabase/migrations/20260626_inventory_count_sessions.sql#L30)); `counted_by` is
"auth.uid() of the counter at start (nullable; informational, **not an FK to auth.users**)"
([:31](../../supabase/migrations/20260626_inventory_count_sessions.sql#L31)); `item_count` is explicitly
**denormalized** ([:32](../../supabase/migrations/20260626_inventory_count_sessions.sql#L32)).

### `inventory_counts` ([:66–78](../../supabase/migrations/20260626_inventory_count_sessions.sql#L66-L78))

| column | type | nullable |
|---|---|---|
| `id` | uuid | NOT NULL (PK, `gen_random_uuid()`) |
| `session_id` | uuid | NOT NULL → `inventory_count_sessions(id)` ON DELETE CASCADE |
| `business_id` | uuid | NOT NULL → `businesses(id)` ON DELETE CASCADE |
| `inventory_id` | uuid | **nullable** → `business_inventory(id)` ON DELETE SET NULL |
| `plant_tag_id` | text | **nullable** |
| `item_label` | text | NOT NULL |
| `counted_qty` | int | NOT NULL |
| `was_unknown` | boolean | NOT NULL DEFAULT `false` |
| `raw_scan` | text | **nullable** |
| `counted_at` | timestamptz | NOT NULL DEFAULT `now()` |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

Table is **append-only by design** — "a count is a historical fact; no updated_at trigger needed"
([:99–100](../../supabase/migrations/20260626_inventory_count_sessions.sql#L99-L100)).

### Present-or-absent, per the prompt

| # | field | `inventory_count_sessions` | `inventory_counts` |
|---|---|---|---|
| (a) | **EXPECTED / prior on-hand** (book qty at count time) | **ABSENT** | **ABSENT** |
| (b) | **DELTA** | **ABSENT** | **ABSENT** |
| (c) | **CAPTURED-AT distinct from written-at** | ABSENT (`started_at`/`created_at` both DEFAULT `now()`) | **PRESENT IN FORM, ABSENT IN SEMANTICS — see (c) below** |
| (d) | **SOLD / order reference** (orders / order_items) | **ABSENT** | **ABSENT** |
| (e) | `was_unknown` | n/a | **PRESENT** ([:74](../../supabase/migrations/20260626_inventory_count_sessions.sql#L74)) |
| (e) | session FK | n/a | **PRESENT** — `session_id` NOT NULL CASCADE ([:68](../../supabase/migrations/20260626_inventory_count_sessions.sql#L68)) |
| (e) | `business_id` | **PRESENT** ([:29](../../supabase/migrations/20260626_inventory_count_sessions.sql#L29)) | **PRESENT** ([:69](../../supabase/migrations/20260626_inventory_count_sessions.sql#L69)) |
| (e) | `inventory_id` | n/a | **PRESENT**, nullable, ON DELETE **SET NULL** ([:70](../../supabase/migrations/20260626_inventory_count_sessions.sql#L70)) |

**(a)/(b) are absent BY DESIGN, and the migration says so in its own header:** *"A physical count SETS
business_inventory.qty (on-hand) AND is recorded here so a later RECONCILIATION pass (counted vs expected:
sold/dead/missing) can read what was counted… **Reconciliation itself is DEFERRED — this only leaves room
for it.**"* ([:7–10](../../supabase/migrations/20260626_inventory_count_sessions.sql#L7-L10)). The count
page repeats the boundary at [InventoryCount.tsx:67](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L67):
*"SCOPE: count loop ONLY. Reconciliation (counted vs expected) is DEFERRED."*

**⚠️ (c) — THE FINDING THAT MATTERS MOST IN R1.** `counted_at` exists and *looks* like a capture timestamp,
but **nothing ever sets it** — so it records WRITE time, and under offline replay it records **SYNC** time.
Two pieces of evidence:

1. The only writer, `recordCount`, spreads a row that has **no `counted_at` key** — its parameter type is
   `{ inventory_id, plant_tag_id, item_label, counted_qty, was_unknown, raw_scan }`
   ([InventoryCount.tsx:608–611](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L608-L611)) and the
   insert is `row: { session_id: sessionId, business_id: businessId, ...row }`
   ([:618](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L618)). `counted_at` therefore always
   falls through to the DB `DEFAULT now()`.
2. That insert is **routed through the offline sync engine**, not a direct write —
   `engine.insert({ table: 'inventory_counts', … })` ([:616–619](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L616-L619)).
   `SyncEngine` is *"write-through-WHEN-online OR enqueue-WHEN-offline + reconnect drain"*
   ([syncEngine.ts:2](../../packages/shared/src/sync/syncEngine.ts#L2)); offline writes return
   `{ status: 'queued' }` ([:129](../../packages/shared/src/sync/syncEngine.ts#L129)) and land only on a
   later drain ([:88–93](../../packages/shared/src/sync/syncEngine.ts#L88-L93)).

**Consequence:** count a lot in a dead zone at 9am, drive back and sync at 4pm → the row reads
`counted_at = 16:00`. The store-and-hold case the prompt names is precisely the case where the column lies.
The distinct capture-vs-write pair the prompt asks about is **effectively ABSENT**. (Reported, not fixed.)

---

## R2 — LIVE SCHEMA GAP (query for David to run)

Per tech-debt #39, committed ≠ live, so the R1 table is **the committed truth only**. Not run here: the
service key is empty locally and anon is RLS-blocked (the D-49 lesson). **DAVID-QUERY — run as `postgres`
in the Supabase SQL editor (project `bgobkjcopcxusjsetfob`) and paste back.**

The query covers the two count tables **and** `orders` / `order_items`, because R5 cannot be closed without
the latter (`orders` has no CREATE TABLE in the repo — see R5).

```sql
-- R2 — live column inventory for the count tables + the two order tables R5 depends on.
-- Read-only. Run as postgres.
SELECT table_name,
       ordinal_position,
       column_name,
       data_type,
       is_nullable,
       column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name IN ('inventory_count_sessions',
                      'inventory_counts',
                      'orders',
                      'order_items')
 ORDER BY table_name, ordinal_position;
```

**What to look for when it comes back:** any column on the two count tables **not** in the R1 table above is
a live-only addition (the #39 class). Specifically worth scanning for: an expected/prior-qty column, a delta
column, or any order reference — R1 says all three are absent as committed; only this query can say whether
they are absent **live**.

---

## R3 — EXISTING RECONCILE SURFACE

**NONE FOUND. The count tables are WRITE-ONLY today.**

A repo-wide grep for `inventory_counts` / `inventory_count_sessions` / `was_unknown` across
`*.ts *.tsx *.js *.jsx *.mjs *.html *.sql` (node_modules excluded) returns exactly four files:

| file | role |
|---|---|
| `supabase/migrations/20260626_inventory_count_sessions.sql` | the DDL |
| `supabase/migrations/20260715_orders_status_drop_check.sql:27` | a passing comment, not a reader |
| `docs/decisions/2026-07-16-d49-stub-fold-remediation.sql` | the stale/unapplied #133 fold SQL, not a surface |
| `packages/cultivar-os/src/pages/InventoryCount.tsx` | **the writer** |

Every reference inside the writer is a WRITE or a guard — session insert
([:230](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L230)), count insert
([:617](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L617)), `item_count` bump
([:626](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L626)), completion update
([:637](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L637)). **No `.select()` anywhere** — a
grep for `from('inventory_count` returns zero hits repo-wide (the writes go through
`engine.insert({ table })`, so they don't match that pattern either).

**So:** no page, component, route, query, or export reads a count back. `was_unknown` is written at
[:504](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L504), [:545](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L545),
[:583](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L583) — **and never read by anything.**
The flag the ledger describes as "flagged for later" has, to date, no later.

**Degradation note (relevant to any reader design):** the writer treats the tables as optional. If they are
absent it sets `tablesAbsent` and **skips the audit record while still updating on-hand**
([:612–615](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L612-L615)), warning
*"count record SKIPPED (tables absent / no session) — inventory already updated"*
([:613](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L613)), with a user-facing banner at
[:676](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L676). **A reader cannot assume
`business_inventory.qty` has a matching `inventory_counts` row** — by design, on-hand can move without one.

---

## R4 — BLIND-CAPTURE QUESTION (reported, unchanged)

**Yes — the capture UI shows the counter the current on-hand, and it does so in TWO places, not one.**
This is worth stating plainly because a decision to "gate or drop it" that only addresses the obvious line
would leave the second, arguably more prominent, disclosure in place.

**Surface 1 — the explicit line.** [InventoryCount.tsx:745–747](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L745-L747):

```tsx
{matchedSib?.qty != null && (
  <p style={S.subtle}>On-hand now: <strong>{matchedSib.qty}</strong></p>
)}
```

**Conditional, not always-on.** It renders only when `matchedSib?.qty != null`. Feed:
`const matchedSib = resolved ? resolved.siblings.find(s => sameSize(s.size, sizeInput.trim() || null)) : undefined;`
([:650](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L650)) — i.e. the sibling stock row whose
size matches what is currently typed/picked. The value is that lot's stored `qty` (the book on-hand). It
appears **above** the "How many did you count?" input ([:749–751](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L749-L751)),
so it is on screen *before* the counter types a number. A virgin/size-less row shows nothing (no match → no line).

**Surface 2 — the size chips, which carry qty inline.** [:723–729](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L723-L729):

```tsx
{sizeChips.map((s, i) => (
  <button … onClick={() => pickSizeChip(s)}>
    {s.size}{s.qty != null ? ` · ${s.qty}` : ''}
  </button>
))}
```

Each chip renders `size · qty` — so **every known size's on-hand is visible at once**, before a size is even
chosen, whenever `sizeChips.length > 0` (feed: `resolved.siblings` filtered to rows with a non-empty size,
[:652](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L652)). The chip handler is described at
[:349](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L349) as *"Tap an existing size chip → fill
the size + its current on-hand."*

**Reported for the decision, not acted on:** gating or dropping only line 746 would still leave the chip row
disclosing on-hand for every size. Both are conditional on there being existing sized siblings. No edit made.

---

## R5 — SOLD-SINCE-SNAPSHOT COMPUTABILITY

**Answer: the LOT JOIN exists; the TIME WINDOW cannot be confirmed from the repo; and even granting the
window, the arithmetic is NOT reliably reconstructable today. Details below, each with evidence.**

### What EXISTS (good news, from artifacts)

- **`order_items.business_inventory_id` — a real FK to the lot.** Added by
  `supabase/migrations/20260707_order_items_stock_line_anchor.sql:29`:
  `ADD COLUMN IF NOT EXISTS business_inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL`.
  It is now **the sole line anchor** — `20260709_drop_order_items_plant_id.sql:7` states
  *"business_inventory_id is the sole line anchor"* after `plant_id` was dropped. So an order line joins to
  the same `business_inventory.id` that `inventory_counts.inventory_id` points at. **The lot key is shared —
  that half is solved.**
- **The decrement path is real and per-unit (D-42).** `submit.ts:792` calls
  `adjustLotQty(db, businessId, lotId, -rl.quantity, 'order-paid decrement')`, which invokes the
  `adjust_inventory_qty` RPC ([submit.ts:100](../../packages/cultivar-os/api/orders/submit.ts#L100)). The
  migration header names reconciliation as its purpose: *"A real per-unit qty decrement is the FOUNDATION
  reconciliation sits on (counted vs expected = last count − sold)"*
  ([20260713:13–14](../../supabase/migrations/20260713_inventory_decrement_and_reorder.sql#L13-L14)).

### Blocker 1 — the time window is UNREADABLE from the repo → **DAVID-QUERY**

`orders` is a **live-only table with no CREATE TABLE migration**, stated twice in the repo:
`20260708_orders_delivery_date.sql:16` — *"⚠️ `orders` is a LIVE-ONLY table (tech-debt #39 — no CREATE TABLE
migration in the repo)"* — and again at `20260715_orders_status_drop_check.sql:6`.

Therefore **I cannot state from any artifact whether `orders` carries a `paid_at` (or equivalent) timestamp.**
A grep for `paid_at` in `submit.ts` returns nothing, and the status transition is written as a bare
`db.from('orders').update({ status })` with **no timestamp column set**
([submit.ts:1143](../../packages/cultivar-os/api/orders/submit.ts#L1143)). What that shows is that **the code
does not write a paid-time**; whether the *table* defaults one is exactly what the R2 query will reveal.

- If `orders` has only `created_at`, then "paid time" ≈ order-creation time — **an approximation, not a fact**,
  and it silently breaks for any order created pending and paid later.
- **This is the single highest-value cell in the R2 result.** Read it before designing the window.

### Blocker 2 — even WITH a window, the sum is not faithful (three reasons, all from code)

1. **No decrement ledger exists.** `adjust_inventory_qty` mutates `qty` in place —
   `SET qty = bi.qty + p_delta` ([20260713:68](../../supabase/migrations/20260713_inventory_decrement_and_reorder.sql#L68))
   — and writes **no history row**. Every decrement is therefore reconstructable only by *re-deriving* it
   from `order_items`, never by reading what actually happened.
2. **`order_items.quantity` is CURRENT, not historical.** The edit path recomputes a delta from the live row
   and re-adjusts (`submit.ts:986–990`), so an order edited from 5 → 2 leaves `quantity = 2`. Summing
   `quantity` therefore reconstructs the *present* state of orders, not the units that moved during the window.
3. **Restores are invisible to a naive sum.** Delete (`submit.ts:1090`) and cancel (`submit.ts:1139`) both
   push units *back* via `adjustLotQty(..., +quantity, ...)`. A cancelled order's line may still exist; the
   cancel path guards on `status !== 'cancelled'` (`submit.ts:1087`), so any "sold" query must filter status
   correctly or it will double-count returns as sales.
4. **A decrement can silently not have happened.** The RPC no-ops when absent (`reason: 'rpc_absent'`,
   `submit.ts:106`), when there is no lot (`'no_lot'`, `submit.ts:98`), and when it would go negative
   (`'oversell_refused'`, `submit.ts:91` / migration `:77`). Each is logged, none is persisted — so
   `business_inventory.qty` and "sum of order_items" can legitimately disagree with **no stored record of why**.

### Verdict

**The sold-vs-unexplained split is NOT computable from existing data as a trustworthy figure.**
A *rough* sold estimate is derivable today (join `order_items.business_inventory_id` → the lot, bound by
whatever `orders` timestamp exists, filtered by status), but it is an approximation whose error modes are
edits, cancels, and un-applied decrements — and it rests on a time column this recon **cannot confirm exists**.
Closing it faithfully needs either (i) a decrement ledger, or (ii) an expected-qty snapshot captured at count
time — **both are design questions for Lightning + David, and this doc deliberately proposes neither.**

This also sharpens R1(a): with no `expected` column on `inventory_counts`, the book qty at the moment of the
count is **never preserved**, and the count itself immediately overwrites it — `business_inventory.qty` is SET
to `counted_qty` ([InventoryCount.tsx:425](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L425):
*"Existing (variety × size) → SET on-hand (a physical count sets qty; NOT a decrement)"*). **The prior value is
destroyed by the write that would have needed it.** Reconstructing it after the fact requires the same
unreliable sold-arithmetic above, run backwards.

---

## R6 — RLS (as committed)

**Both tables: RLS enabled, membership-scoped to `business_id`, two policies each — the ledger's claim is
CONFIRMED as committed.** (Live-state confirmation is a separate check; verification block (A)/(B) at
[:106–113](../../supabase/migrations/20260626_inventory_count_sessions.sql#L106-L113) is the intended proof.)

- **`inventory_count_sessions` — RLS ENABLED** ([:42](../../supabase/migrations/20260626_inventory_count_sessions.sql#L42)).
- **`inventory_count_sessions_owner_all`** ([:44–52](../../supabase/migrations/20260626_inventory_count_sessions.sql#L44-L52)) — `USING` + `WITH CHECK`, both `EXISTS (SELECT 1 FROM businesses WHERE id = …business_id AND owner_id = auth.uid())`. ✅ owner_all.
- **`inventory_count_sessions_member_all`** ([:54–56](../../supabase/migrations/20260626_inventory_count_sessions.sql#L54-L56)) — `USING`/`WITH CHECK` = `public.is_active_member(…business_id)`. ✅ the canonical primitive.
- **`inventory_counts` — RLS ENABLED** ([:83](../../supabase/migrations/20260626_inventory_count_sessions.sql#L83)).
- **`inventory_counts_owner_all`** ([:85–93](../../supabase/migrations/20260626_inventory_count_sessions.sql#L85-L93)) — same owner shape, scoped to `inventory_counts.business_id`. ✅
- **`inventory_counts_member_all`** ([:95–97](../../supabase/migrations/20260626_inventory_count_sessions.sql#L95-L97)) — `public.is_active_member(inventory_counts.business_id)`. ✅

**AC-2/AC-3:** every policy predicate is `business_id`-scoped; there is no `USING(true)` on either table. The
migration asserts the same at [:18–21](../../supabase/migrations/20260626_inventory_count_sessions.sql#L18-L21)
(*"AC-2 (business_id scoped) + AC-3 (tenant isolation absolute)"*), with `public.is_active_member(uuid)` named
as a live pre-req. **One note for a reader build:** all four policies are `FOR ALL` (no verb specified), so
SELECT is covered — a reconcile reader will **not** hit the missing-SELECT-policy trap of open decision #11.

---

## SUMMARY

**R1 (a)–(e):** of the five, **only (e) exists in full** — `was_unknown`, `session_id`, `business_id`, and
`inventory_id` are all present as committed. **(a) expected/prior on-hand, (b) delta, and (d) sold/order
reference are ABSENT from both tables** (absent by design — the migration defers reconciliation explicitly).
**(c) is present in form but not in substance:** `counted_at` exists, but no writer ever sets it, and the
insert routes through the offline sync engine — so it records write/sync time, not capture time.
**R5: NOT reliably computable today** — the lot join exists (`order_items.business_inventory_id`), but the
time window sits on the live-only `orders` table this recon cannot read (**DAVID-QUERY, R2**), and there is
no decrement ledger, so edits, cancels, and un-applied decrements make any derived "sold" figure an
approximation rather than a fact.
</content>
</invoke>
