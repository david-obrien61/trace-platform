# RECON · qty-write emit points + audit-log writer — the live map D-50's ledger must cover

**Date:** 2026-07-20 (recon run) · **Feeds:** `docs/decisions/2026-07-19-inventory-movement-ledger-D50.md` (D-50, ACCEPTED)
**Type:** READ-AND-REPORT. Zero app code, zero schema, zero migration, zero api-fn (12/12 untouched, confirmed live: the deploy inspect lists 5 + 7 hidden = 12 lambdas).
**Baseline SHA:** `b0903c3` (the D-50 docs commit, pushed + Vercel READY — see the deploy note at the end).
**Rule of this doc:** every claim carries a `file:line` or is flagged **DAVID-QUERY**. Nothing from memory.

---

## R1 — QTY-WRITE EMIT POINTS

**14 live application sites write `business_inventory.qty` (or destroy a row carrying it). They collapse to FIVE chokepoints.** That collapse is the useful number — the ledger writer has five seams to cover, not fourteen call sites.

### Chokepoint 1 — the D-42 RPC `adjust_inventory_qty` (4 sites, all `+delta`)

All four route through one helper, `adjustLotQty` (`packages/cultivar-os/api/orders/submit.ts:95-119`), which calls the RPC at `:100`. Execution path for all four: **server-side, service key → SECURITY DEFINER postgres function.**

| # | file:line | Op | Verbatim |
|---|---|---|---|
| 1 | `api/orders/submit.ts:792` | +delta (negative) | `await adjustLotQty(db, businessId, lotId, -rl.quantity, 'order-paid decrement');` |
| 2 | `api/orders/submit.ts:990` | +delta (signed, `old − new` per lot) | `await adjustLotQty(db, businessId, lotId, delta, 'order edit');` |
| 3 | `api/orders/submit.ts:1090` | +delta (restore) | `await adjustLotQty(db, businessId, it.business_inventory_id, Number(it.quantity), 'order delete restore');` |
| 4 | `api/orders/submit.ts:1139` | +delta (restore) | `await adjustLotQty(db, businessId, it.business_inventory_id, Number(it.quantity), 'order cancel restore');` |

⚠️ **The prompt's line numbers were STALE for one:** the edit adjust is at **:990**, not :986. The other three are current. Site 2 sums per-lot deltas into `editDeltas` (`submit.ts:981-989`) before applying — one RPC call can represent several line-item changes, which matters for ledger granularity.

The function body (`supabase/migrations/20260713_inventory_decrement_and_reorder.sql:54-104`) — the load-bearing lines:

```sql
UPDATE public.business_inventory bi
   SET qty = bi.qty + p_delta,
       status = CASE ... END,
       updated_at = now()
 WHERE bi.id = p_lot_id AND bi.business_id = p_business_id
   AND bi.qty + p_delta >= 0     -- OVERSELL GUARD: never drive qty negative
 RETURNING bi.qty, bi.status INTO v_qty, v_status;
```
Grants (`:100-104`): `REVOKE ALL ... FROM public, anon, authenticated; GRANT EXECUTE ... TO service_role;`

**This is the only postgres function that writes `business_inventory.qty`.** The only trigger on the table is `business_inventory_updated_at` (`supabase/migrations/20260612_business_assets_inventory_pmi_service.sql:151-154`) which writes `updated_at` only.

### Chokepoint 2 — the count path, via SyncEngine (3 sites)

`packages/cultivar-os/src/pages/InventoryCount.tsx` (note: `src/pages/`, not `src/components/`). Decision logic is pure in `packages/shared/src/inventory/countPromote.ts` (zero IO — it writes nothing). Execution path for all three: **client-direct browser write under RLS, queued through `SyncEngine`.**

| # | file:line | Op | Verbatim |
|---|---|---|---|
| 5 | `InventoryCount.tsx:427-429` | **SET** (absolute) | `const set: Record<string, unknown> = { qty };` → `engine.update({ table: 'business_inventory', set, match: { id: target.rowId, business_id: businessId } })` |
| 6 | `InventoryCount.tsx:438-440` | **SET** (D-49 stub fill: qty + size) | `const set: Record<string, unknown> = { qty, size: target.size };` → same `engine.update` |
| 7 | `InventoryCount.tsx:479-484` | **INSERT** (mints a sibling lot) | `variant_group: target.variantGroup, qty, status: 'available', cost_confidence: 'UNKNOWN',` → `engine.insert({ table: 'business_inventory', row, clientId: newId })` |

The prompt's "InventoryCount.tsx:425" is confirmed — the SET is at **427/429**. (`:451-455` also updates `variant_group` on regroup, but touches no qty.)

### Chokepoint 3 — the desk / manual grid CRUD (3 qty sites + 2 destructive)

All funnel through `packages/cultivar-os/src/components/inventory/inventoryEdit.ts`. Execution path: **client-direct browser write under member/owner RLS.**

| # | file:line | Op | Verbatim |
|---|---|---|---|
| 8 | `BusinessInventory.tsx:173` → `inventoryEdit.ts:56` | **SET** (inline grid cell) | `void doPatch(row, { qty: value });` → `supabase.from('business_inventory').update(patch).eq('id', id).eq('business_id', businessId)` |
| 9 | `InventoryEditor.tsx:232` (via `saveNumber('qty',…)` :225, wired :473) → `inventoryEdit.ts:56` | **SET** (edit-mode field blur) | `persistInventoryPatch({ id: draft.id, businessId: businessId!, patch: { [field]: v } })` |
| 10 | `InventoryEditor.tsx:291`, insert at `:311` → `inventoryEdit.ts:76` | **INSERT** (create form) | `qty: draft.qty,` → `insertInventory({ businessId, values })` |
| 11 | `inventoryEdit.ts:145-148` | **ARCHIVE** (`status='archived'`; qty survives on the row) | `.update({ status: ARCHIVED_STATUS })` |
| 12 | `inventoryEdit.ts:154` | **HARD DELETE** | `supabase.from('business_inventory').delete().eq('id', id).eq('business_id', businessId)` |

**#12 is an emit point the prompt's list did not name, and it is the sharpest one:** a hard delete removes stock from existence with no movement row and no tombstone. Under D-50's "no quantity moves without a ledger row, ever," a delete IS a movement (on-hand → 0) and it also orphans every historical ledger row's `inventory_id`. Flagged as a design question for the writer, not answered here.

### Chokepoint 4 — catalog populate (2 INSERT + 2 DELETE)

`packages/shared/src/discovery/populate.ts`. Execution path: **server-side service key** (client built at `api/discovery/ingest.ts:133`).

| # | file:line | Op | Verbatim |
|---|---|---|---|
| 13 | `populate.ts:119` (row) → `:248` (insert) | **INSERT** at qty 0 | `qty: 0,  // never fabricate stock` |
| 14 | `populate.ts:258` | **INSERT** at qty 0 (degraded parent-only fallback) | `.insert(parentRows)` |
| — | `populate.ts:73`, `:82-86` | **DELETE** (`clearSandbox` `SMPL-%`, `clearDiscovery` `DISC-%`) | `.delete({ count: 'exact' }) … .like('sku', \`${DISC_SKU_PREFIX}%\`)` |

Births at qty 0 are arguably not movements. **But `clearDiscovery` is a mass delete** — and per CLAUDE.md §3's standing finding, `populate` clears prior discovery on re-run, so a re-scrape wipes every `DISC-` row. Against D-50 that is a mass movement event with no ledger row and a cascade risk to `inventory_counts.inventory_id`. **Flagged, not designed.**

### Chokepoint 5 — scripts / one-off SQL (out of the app, in the data)

Not application paths, but they DO move live qty and a ledger that ignores them will replay wrong: `scripts/seed-sandbox.mjs:104-109` (INSERT `qty: 4 + i*3`), `scripts/seed-size-variants.mjs:103` (INSERT) and `:143` (**SET `qty = 99`**), `scripts/populate-catalog.ts:114`, `scripts/verify-cost-discovery.ts:57-60`, `scripts/verify-checkout-tamper.mjs:51-53` (INSERT `qty: 100`), and the remediation SQL `docs/decisions/2026-07-16-d49-stub-fold-remediation.sql:185-190` (**SET `qty = ch.qty`**) + `:201-205` (DELETE). All service-key or manual-postgres.

### Confirmed NON-writers (checked, so the map is a claim not a guess)
`AssetCapture.tsx` / `utils/assetCapture.ts` write `business_assets`, **not** `business_inventory` — **there is no receiving/asset-intake path that writes `business_inventory.qty`.** Also read-only: `stockLineResolver.ts`, `countPromote.ts`, `variantGroup.ts`, `dupSize.ts` (all pure), `api/dashboard.ts:22`, and the plant/cart/order UI surfaces. `costDiscovery.ts:300-304` writes `unit_cost`/`cost_confidence` only.

### ⚠️ Two findings that fall out of the map (not asked for, load-bearing for D-50)

1. **The RPC is the only concurrency-safe path. Every other qty write is a last-writer-wins absolute SET.** Sites 5, 6, 8, 9 read `qty` at one moment and write it back later with no read-modify-write guard — `InventoryCount.tsx:342/352` seed the input from the sibling's current `qty`. **A count committed while an order is being paid silently overwrites the decrement.** This is D-50's disagreement #1 ("replay vs on-hand must be ZERO by construction") already violable today, and it is invisible when it happens.
2. **The oversell guard and the status derivation exist ONLY inside the RPC.** Client validation is `value < 0` (`BusinessInventory.tsx:171`) and `v < 0` (`InventoryEditor.tsx:228`). So a desk SET of `qty = 0` leaves `status = 'available'`, and nothing stops a manual SET contradicting outstanding order commitments.

---

## R2 — ATOMICITY SEAM (per emit point)

**Classification: (a) = already inside a DB function, a ledger INSERT can be added atomically today · (b) = app-side JS write, atomicity needs an RPC.**

| Chokepoint | Sites | Class | Evidence |
|---|---|---|---|
| 1 — `adjust_inventory_qty` RPC | 1–4 | **(a)** | plpgsql function body, `migrations/20260713_…sql:54-104`. A `plpgsql` function runs in the caller's transaction; a second `INSERT` inside `BEGIN…END` commits or rolls back with the `UPDATE`. **Ready to hold the ledger row today with no restructuring.** |
| 2 — count via SyncEngine | 5–7 | **(b)** — worst case | `syncEngine.ts:174` and `:181` execute **one** `.insert(...)` or `.update(...)` per queued op. Ops drain in a loop (`:150-160`) that `break`s on the first failure. Two writes = two HTTP round-trips, two transactions, **and an offline queue between them.** |
| 3 — desk grid/editor | 8–12 | **(b)** | `inventoryEdit.ts:56` / `:76` / `:154` are single PostgREST calls. Atomic per statement; a second insert is a second round-trip. |
| 4 — populate | 13–14 | **(b)** | `populate.ts:248` bulk `.insert(rows)` — atomic within the one statement, no transaction spanning a companion write. |
| 5 — scripts / SQL | — | mixed | Manual `psql` blocks can be wrapped in `BEGIN/COMMIT`; the `.mjs` scripts cannot without an RPC. |

**Count: 4 of 14 sites can hold an atomic ledger insert today. 10 need an RPC (or a PostgREST-callable `SECURITY DEFINER` function).**

### ⚠️ The seam already fails, in production, with a console warning that says so

This is the single most important line in the recon. `InventoryCount.tsx:612-614`:

```
if (tablesAbsent || !sessionId || !engine) {
  if (TRACE_COUNT) console.warn('[TRACE:COUNT] count record SKIPPED (tables absent / no session) — inventory already updated:', row.item_label);
  return;
}
```

`recordCount` is a **separate** `engine.insert` into `inventory_counts` (`:617-620`), fired *after* the qty write at `:429/:440/:484` already returned. The code **states in its own warning** that inventory can be updated while its record is skipped. That is exactly D-50's forbidden state — a quantity moved with no durable row explaining it — **live today, on the primary capture path, acknowledged in the trace.** D-50 is not a hypothetical hardening; it closes an observed hole.

---

## R3 — ACTOR IDENTITY (per emit point)

**The prompt's premise on the count path is WRONG in our favour — correcting it, because it changes the build.**

| Chokepoint | Actor at write time | In-DB `auth.uid()` | Verdict |
|---|---|---|---|
| 2 — count | **REAL, already captured.** `const { data: { user } } = await supabase.auth.getUser(); setUserId(user?.id ?? null);` (`InventoryCount.tsx:208-209`), passed into SyncEngine (`:194`), written to `counted_by` (`:231`: `row: { …, counted_by: userId }`), and the walk is **gated** on it (`:221`: `if (!userId) { setError('Confirming your sign-in — one moment.'); return; }`) | **real** (client-direct under RLS) | **Free. No new plumbing.** |
| 3 — desk grid/editor | client-direct browser session | **real** | **Free. No new plumbing.** |
| 1 — order RPC | `auth.uid()` is **NULL** — writes run on `adminDb()` (`submit.ts:23-27`, `SUPABASE_SERVICE_KEY`, the only `createClient` in the file). BUT the real uid is **already resolved and already carried as a value**: `resolveCallerUid(authHeader)` at `submit.ts:200` (and `:262`), written to `override_by` at `:493` | **null** | **Available — but must be passed as an RPC PARAM**, never read from `auth.uid()`. |
| 4 — populate / 5 — scripts | no human actor exists | null | **Honest answer is NULL + a system/source marker.** Defaulting these to the owner would fabricate an actor — D-9, and D-50 §11 explicitly forbids "defaulted to the owner." |

So: **`actor_user_id` is real on every path where a human acted.** It is not theater. The count path needed no work at all, and the order path needs one parameter.

### ⚠️ FACTUAL CORRECTION — CLAUDE.md:409 states the mechanism wrongly

CLAUDE.md:409 (finding **d**) says: *"`submit.ts` resolves the caller via `resolveCallerUid(authHeader)` → a service-role client → `auth.uid()` is NULL for server writes."*

`resolveCallerUid` does **not** use a service-role client. `packages/shared/src/auth/callerPermission.ts:89-97` builds an **anon-key client carrying the caller's Bearer token** and calls `auth.getUser()`:
```ts
const caller = createClient(e.url, e.anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
const { data } = await caller.auth.getUser();
```
The file header (`:6-9`) says so explicitly: *"Both run under the caller's **anon-key+token**."*

**The conclusion still holds, for a different reason:** the uid is resolved by that anon call, then hand-carried as a *value* into writes that execute on `adminDb()` (service key) — so a `supa_audit`-style trigger firing on those writes would still see `auth.uid() = NULL`. The note's *implication* is correct; its *sentence* is not. Worth fixing, since it is the sentence a future session would design from. (The note's own instruction — *"Verify… the service-key inference"* — is exactly why this was checked.)

### One timing caveat the ledger design must absorb
The count path is **offline-capable**. A queued op applies when connectivity returns, so a DB-side `now()` default on `occurred_at` would record the *sync* time, not the *count* time. **`occurred_at` must be captured client-side at the event and carried**, or the replay timeline is wrong by however long the lot walk was offline.

---

## R4 — AUDIT LOG: CURRENT STATE + THE PRIOR RECON

### (a) The vault is complete, hardened, and **empty**

`supabase/migrations/20260623_audit_log_spine.sql:63-74` — columns: `id · business_id (NOT NULL, FK CASCADE) · actor_user_id · actor_role (snapshot string, NOT an FK) · action (NOT NULL) · target_type · target_id (text) · detail jsonb NOT NULL DEFAULT '{}' · outcome NOT NULL DEFAULT 'success' · created_at`.

Immutability is **already a DB guarantee**, which is notable because D-50 asks for exactly this:
- `:151-160` — `reject_audit_log_mutation()` + `CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ... RAISE EXCEPTION 'audit_log is append-only: % is not permitted'`
- `:167-171` — `REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;` (and `anon`)
- `:140-142` — no `FOR UPDATE`/`FOR DELETE` policy, deliberately: *"the absence of a permissive policy for a command is a deny"*
- `20260624_audit_log_truncate_revoke.sql:25` — `REVOKE TRUNCATE ... FROM anon, authenticated, service_role;` because (`:16-20`) *"TRUNCATE is a FOURTH mutation path that bypasses BOTH RLS AND FOR EACH ROW triggers."*

Its ratified authorship model (`:36-42`): *"AUTHOR MODEL: client-side INSERT (accountability-grade)… Immutability — not write-authorship — is the guarantee… designed to HARDEN to service-key-authored later."* **Hold that sentence — it is the crux of R5.**

**Writers: ZERO. Readers: ZERO.** Repo-wide grep found no `.from('audit_log')`, no `INSERT INTO audit_log`, no `logAudit`/`writeAudit`/`auditEvent` helper, no function or trigger inserting to it. The only INSERT anywhere is a commented-out example at `20260623_audit_log_spine.sql:208-209`. False positives excluded: `packages/ignition-os/DataBridge.js:859-902` and `IgnitionAdmin.jsx:869-871` use a **localStorage** key named `admin_audit_log` in another vertical; `scripts/wipe-for-person-spine.sql:163` is a row count. **The empty-table finding is CONFIRMED — and it is now 27 days empty** (created 2026-06-23, today 2026-07-20).

**DAVID-QUERY — live confirmation (nothing here was run against the live DB):**
```sql
-- structure + nullability
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='audit_log' ORDER BY ordinal_position;
-- the emptiness claim, and whether anything ever landed
SELECT count(*) AS rows, min(created_at) AS first, max(created_at) AS last FROM public.audit_log;
-- immutability actually in force
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid='public.audit_log'::regclass AND NOT tgisinternal;
SELECT grantee, privilege_type FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name='audit_log' ORDER BY grantee, privilege_type;
-- is supa_audit even available in this project?
SELECT * FROM pg_available_extensions WHERE name LIKE '%audit%';
SELECT extname FROM pg_extension;
```

### (b) The prior recons — their conclusions, not re-derived

All three located. Two **moved** to `docs/decisions/` on 2026-07-17 (`CLOSE-OUT-LEDGER.md:18`); the third stayed put:
- `docs/decisions/2026-07-17-audit-event-model-recon.md` (197 lines)
- `docs/decisions/2026-07-17-audit-writer-gate-recon.md` (160 lines)
- `data/grower-scan/audit-spine-recon.md` (190 lines)

**THE EVENT MODEL — three layers, one failure mode** (`event-model-recon.md:20-28`): *"The failure mode is making one layer do all three jobs."*

| Layer | Question | Right shape | State |
|---|---|---|---|
| 1 — Authority audit | who exercised power | append-only, immutable, `detail jsonb` | `audit_log` — built, **empty** |
| 2 — Transactional fact | how much, on what, why | columns on the record, joinable, **summable** | `override_by`/`override_reason` — partly built |
| 3 — Row history | what did this value used to be | history table + trigger | **doesn't exist** |

Two governing sentences (`:31-35`): *"**'Leakage is a fact, not a log entry.'** You don't want to find who/how-much/why — you want to **sum** it… `detail jsonb` in an append-only log is the wrong shape for that report."* And: *"**'Reason is the one field that cannot be derived, backfilled, or inferred — it exists only if you ask at the moment of the choice.'**"*

The taxonomy gate (`:38-40`): *"log where a human made a choice the system couldn't make for them — **discretion, not every mutation.** **A count is an observation**; a price override is a choice; a tier promote is a choice; a desk qty edit is a choice."*

**⚠️ It already predicted D-50** (`:151-161`) — the one fork it left open, with its lean: *"authority events + the leakage event + deletes → `audit_log` now (Layer 1…). Inventory → its **own** append-only history/ledger (Layer 3), because it doubles as the reconcile source-of-truth."*

**WHERE THE FIRST WRITER BELONGS** — two answers, and the prompt conflated them:
- *Which call site* (`audit-spine-recon.md:153-154`, section "(c) First writer wired"): **`deleteTenantRole` → `role.factory_reset`** — *"the immediate need; doctrine already calls reset 'audited,' and the RoleConfig console (PART B, `661dcfa`) that triggers it is live."* Order (`:150-151`): factory-reset (1) → other `role.*` (2) → `member.*` (3) → `cost.*` incl. denied (4) → `tile.*` (5) → ownership/signing (6–7).
- *Which seam enforces it* (`writer-gate-recon.md:99-116`) — the real fork: **O-A** a §1.6 checklist item (*"Still 'remember to log' wearing a gate's clothes"*); **O-B** a shared `writeAudit()` + a `verify-universals` rule failing the build when a governed path lacks it; **O-C** *"Route governed mutations through `SECURITY DEFINER` RPCs (or table triggers) that write the audit row **in the same transaction** as the mutation… **BUT this reopens the ratified author-trust decision**."* Its verdict (`:114-116`): *"O-C is the only option that makes 'ship a mutation that doesn't log' actually impossible — and it is the one that overturns a decision already ratified (client-INSERT). O-B is the honest middle."*

**PART B's scope** (`audit-spine-recon.md:76-88`): ~8 governance writers, each *"a one-line INSERT added at the existing call site."* The writer-gate recon then flagged the scope creep (`:83-87`): *"The write-site list in the prompt — `business_inventory`, `orders`, … — is **broader than what the spine was designed to record.** The spine is a who-exercised-authority log, **not** a what-data-changed log… it sets whether the gate covers **~8 writers or ~every table.**"*

**Its one atomicity caveat** (`audit-spine-recon.md:88`): *"the refusal is a `RAISE EXCEPTION` inside a `BEFORE UPDATE` trigger, which rolls back the whole transaction — an audit INSERT in the same transaction would roll back with it… **denied-by-trigger is the one case that can't be a naive in-line INSERT.**"*

**Actor** (`writer-gate-recon.md:57-65`): the `audit_insert` policy lets `authenticated` append *"pinned to `actor_user_id = auth.uid()` — a member can append but never forge another actor… it is **client-writable, and no client path was built either.** The vault is immutable, correct, catalog-proven, and **empty.**"* And the through-line (`event-model-recon.md:114-116`): *"**the walk has provenance; the desk does not.** The surface where a number can be quietly changed — at a desk, alone, no session, no scan — is the one with no record."* **R3 above confirms that empirically: the count captures a real actor; the desk grid captures nothing but a timestamp.**

**The ranking** (`writer-gate-recon.md:7`): *"**Rank:** David placed this ABOVE O1 (the sellable-predicate / reconcile grid work)."* Backed by `:17-24`: *"The table is 23 days old and has never received an application-authored row — because no writer was ever built."* And `:71-75`: *"the close-out protocol has gates for built-inventory, close-out ledger, owner-tests, STD-003, and three-lens recon — but **none says 'a mutation to a governed surface must also write `audit_log`.'**"*

**Row 19B, verbatim** (`docs/CLOSE-OUT-LEDGER.md:73` — note the recons cite it as `:71`, which has drifted as the ledger grew): status = `**UNBLOCKED** — NOT STARTED (spine #19 OWNER-PROVEN 2026-06-24)`; scope = *"Wire `deleteTenantRole`/console factory-reset to emit a `role.factory_reset` audit row (audit-then-delete order); rollback-safe catch-then-write for denied events…"*; blockers = *"None — ready to build (spine proven)."*

### (c) supa_audit — the note is directionally right, mechanically wrong

Exactly one mention repo-wide: `CLAUDE.md:409`. Its design catch — *"client-direct writes (grid edit, tier dropdown) get the actor free but server writes need an app-level event — which is why industry runs both layers"* — **is CONFIRMED by R3**: chokepoints 2 and 3 have a real `auth.uid()`; chokepoint 1 does not. Its mechanism sentence is wrong (see the R3 correction). Its own instruction stands: **verify extension availability in `bgobkjcopcxusjsetfob` before planning around it** — the DAVID-QUERY above includes the check. It also carries a stale pointer, calling the recons *"the two untracked `data/grower-scan/audit-*-recon.md` files"* after they were relocated the same day.

---

## R5 — THE RELATIONSHIP QUESTION (RECOMMENDATION — Lightning + David rule)

**Recommended: (b), narrowed — a distinct movement ledger that does NOT emit one `audit_log` row per movement.** `audit_log` receives a row only where a human exercised **discretion**, carrying the ledger row's id as `target_id`.

### Why not (a) — movement as the inventory slice of `audit_log`

Four independent objections, each grounded:
1. **Summability.** `event-model-recon.md:31-33` already rejected this shape: *"you want to **sum** it… `detail jsonb` in an append-only log is the wrong shape."* D-50 derives on-hand by replay — that is `SUM(delta)`, which needs a typed `int` column, not a jsonb field.
2. **Taxonomy self-contradiction.** `event-model-recon.md:38-40` classifies **a count as an observation, not a choice**, and scopes the log to *"discretion, not every mutation."* Chokepoint 1 (an automatic sale decrement) is not discretion either. Folding them in breaks the log's own admission rule.
3. **Authorship collision.** `audit_log`'s ratified model is **client-side INSERT** (`20260623_audit_log_spine.sql:36-42`). D-50 §7 requires the row *"written in the same transaction as the qty change"* — the writer-gate recon's **O-C**, which it flagged as *"the one that overturns a decision already ratified."* One table forces one authorship model onto both. Shape (b) lets D-50 take O-C **for movement only**, where it is cheap, and leaves the ratified client-INSERT model intact for authority events.
4. **Volume.** Every sale line writes a movement row. A low-volume authority log you can scan loses that property the moment it carries retail traffic.

### Why not pure (c) — `audit_log` adopts the pattern, movement specializes it

It is the cleanest *concept* and the most expensive *move*: it reopens the ratified authorship decision for **all** governed writes, before a single writer exists, and pulls PART B (row 19B, ~8 governance writers, ranked ABOVE O1) into D-50's scope. It also collides with the one caveat at `audit-spine-recon.md:88` — denied-by-trigger events **cannot** be a same-transaction insert, so a universal same-transaction rule has a known exception on the authority side that movement does not have. **Not rejected on merit — deferred as out of scope.** If David wants the unified pattern, it should be its own decision after D-50's ledger proves the mechanism.

### Why (b)-narrowed, and not (b)-literal

A mirror `audit_log` row per movement is **STD-011 — two representations of one fact**, and drift between them would be undetectable. So the narrowing matters: the ledger is the **sole** record of movement; `audit_log` records only the discretionary act *around* a movement — the desk override, the reconcile classification of a gap as dead/loss/found/miscount (which D-50 §16 requires a human to supply), and hard deletes. Those are `event-model-recon.md`'s Layer 1 by its own test. Ledger rows are Layer 3 — the layer that recon said *"doesn't exist"* and lean­ed toward giving inventory its own home.

### What the seams say (the evidence, per D-50's requirements)

| D-50 requirement | Seam verdict |
|---|---|
| same-transaction emission | 4 sites free (chokepoint 1 — plpgsql), **10 need an RPC**. Movement is the *smaller* surface to convert; the ~8 governance writers are a separate cost. Favours a movement-scoped ledger. |
| DB-level immutability | **The pattern is already written and owner-proven** — `reject_audit_log_mutation()` + `REVOKE UPDATE, DELETE` + `REVOKE TRUNCATE` (`20260623:151-171`, `20260624:25`). Copy it verbatim; do not re-derive. It costs the same whether the ledger is its own table or not, so it does **not** argue for (a). |
| real actor, never defaulted | Free on chokepoints 2–3; one RPC param on chokepoint 1; honestly NULL on 4–5. Works identically under all three shapes — **actor capture does not discriminate**, and saying so is more useful than pretending it favours the recommendation. |
| on-hand + expected derive | Requires typed `delta` + indexed `(inventory_id, occurred_at)`. Argues **against** (a). |

**Two build sub-questions this recon surfaces and does not answer:** (i) hard delete (site 12) — tombstone row, or block deletes on ledgered rows? (ii) `clearDiscovery`'s mass delete on re-scrape (chokepoint 4) — exempt as a system reset, or ledgered? Both need a ruling before the migration.

---

## R6 — BOARD LINE ADDED

Inserted into `TRACE-SESSION-BOOTSTRAP.md` ⚡ ACTIVE STATUS immediately after the D-49 line (line 76), keeping the D-45/D-49/D-50 family together. Exact line added, verbatim:

```
- 🔴 **INVENTORY MOVEMENT LEDGER + the audit-log FIRST WRITER — the debt that sat as rotted note row 19B (D-50 ACCEPTED `b0903c3`; absorbs close-out row 19B, UNBLOCKED–NOT STARTED since 2026-06-24, 27 days empty)** · NOT STARTED — recon done, migration + writer owed · **HIGH** (David ranked the writer-gate ABOVE O1) · reuse: `adjust_inventory_qty` RPC seam (4 of 14 qty-writes can hold an atomic ledger insert TODAY) + `audit_log`'s proven immutability pattern (`reject_audit_log_mutation` + REVOKE UPDATE/DELETE/TRUNCATE) · deps: David rules R5 (ledger-vs-audit_log relationship) + 10 of 14 emit points need an RPC to write atomically · → `docs/decisions/2026-07-19-inventory-movement-ledger-D50.md`, `docs/decisions/2026-07-19-qty-write-and-audit-emit-recon.md`
```

This is the only board write. No other row was touched.

---

## SUMMARY

**14 live qty-write emit points across 5 chokepoints (plus 6 script/SQL sites); 4 can hold an atomic ledger insert today (the `adjust_inventory_qty` RPC), 10 need an RPC. Actor is REAL and free on the count and desk paths (correcting the prompt's premise), one param away on the order path, honestly NULL for system writes. `audit_log` confirmed 27 days empty, zero writers, zero readers — but its immutability pattern is built and reusable verbatim. R5 recommendation: shape (b) narrowed — a distinct movement ledger as the sole record of movement, with `audit_log` rows only for discretionary acts, because summability, the recon's own "discretion not every mutation" taxonomy, and `audit_log`'s ratified client-INSERT authorship all argue against folding movement in.**

**The finding that outranks the map:** `InventoryCount.tsx:612-614` already logs *"count record SKIPPED … inventory already updated"* — a quantity moving with no durable record is not a risk D-50 prevents, it is a state the code warns about today, on the primary capture path.

---

### Deploy note (OP-15 discipline on this recon's baseline)
`b0903c3` pushed 2026-07-20 ~10:56 CDT; `origin/main` == `HEAD` verified. Vercel deployment `dpl_2WxQqRqUsU3Jx5Di3YFxDgzM4yMK` created 10:58:42 CDT, status **● Ready**, aliased to `cultivar-os.vercel.app`. **⚠️ The SHA itself could NOT be mechanically confirmed** — `vercel inspect` does not print the git commit, so the match rests on timing plus it being the only deploy in 3 days. That gap is precisely what tech-debt #60's flagged SHA-stamp (`VERCEL_GIT_COMMIT_SHA` → `define` → DebugPanel) would close. Recorded rather than claimed as verified.
