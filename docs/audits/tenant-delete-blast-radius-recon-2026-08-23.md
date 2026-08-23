# RECON — CAN A TEST TENANT BE DELETED WITHOUT TOUCHING THE OTHERS?

**Date:** 2026-08-23 · **HEAD at recon:** `f0e195f` · **Type:** LOOK-ONLY recon. Nothing built,
nothing deleted, no migration written, no cap added.
**Scope bar honoured:** zero diff under `packages/`, `api/`, `supabase/`. One document — this one.

---

## 🔴 THE ONE-LINE ANSWER

> **NO — not today, and the reason is not a missing feature. A plain `DELETE FROM businesses`
> CANNOT SUCCEED for any tenant that has ever been used, because `audit_log` and
> `business_inventory_ledger` cascade from `businesses` AND carry a `BEFORE UPDATE OR DELETE`
> append-only trigger that RAISES. The cascade reaches the guarded table, the guard fires, the
> whole transaction aborts. Nothing is deleted. That is the platform working as designed.**

The second reason, independent of the first: **five core tables carry `business_id` with NO
`ON DELETE` clause** (`orders`, `customers`, `plant_events`, `addons`, `social_drafts`) — that is
`NO ACTION`, which **blocks** rather than cascades. Either fuse alone stops the delete.

**The delete is fail-closed in both directions. David's fear — "one FK too wide destroys real work" —
is the OPPOSITE of the actual risk.** The actual risk is that someone, meeting the refusal, reaches
for the tool that got past it last time. That tool exists in this repo and it is a full-database
nuke. See Q9.

---

## HAVE / NEED / WANT (OP-8)

### HAVE
- **No tenant-delete path of any kind.** 21 `businesses` access sites in `packages/*/src` + `api/`;
  **zero deletes** (Q9). No `delete_business` RPC, no admin surface, no cleanup script.
- **One tenant-teardown artifact: `scripts/wipe-for-person-spine.sql` — a FULL-DATABASE NUKE.**
  Its own header: *"⚠️ DESTRUCTIVE — this deletes ALL tenant data AND ALL auth users."*
  🔴 **This is almost certainly the thing David remembers.** It is not a per-tenant tool and was
  never intended as one.
- **Two append-only guards that refuse DELETE**, one of which (`audit_log`) is reached by cascade
  from `businesses` on essentially every tenant.
- **A proven, already-run set of catalog queries** for the FK graph, the guard list, and the
  `business_id` table list — inside that same wipe script, STEP A. Reused below rather than
  reinvented (§6 r8).

### NEED (irreducible minimum to answer the question, no preference)
- **The catalog queries below, run by David.** Repo-side reading cannot close this, and the reason
  is specific and severe — see the METHOD WARNING.
- A per-tenant row count (Q5) proving the two throwaway tenants are as empty as believed.

### WANT (labelled as want)
- A **tombstone** (`businesses.deleted_at`) — hides a tenant everywhere without removing rows,
  needs no guard disabled, destroys no history, and is reversible.
- If hard delete is ever genuinely required: a **gated, name-checked, transactional migration**
  (Q10), and a ruling on the append-only guards first (Q4).

---

## 🔴 METHOD WARNING — WHY THE REPO CANNOT ANSWER THIS

STD-021: *a claim about a database object is sourced from the catalog or it is not made.*
Here that rule is not a formality — **the repo is structurally blind to the exact tables that
matter most:**

**NINE core tenant tables have NO `CREATE TABLE` migration anywhere in `supabase/migrations/`:**

`orders` · `order_items` · `customers` · `cost_objects` · `plant_events` · `cultivar_plants` ·
`order_addons` · `addons` · `social_drafts`

That is tech-debt **#39** (live schema not in version control) landing directly on this task. Five of
the nine picked up a `business_id` FK later via
[20260529_businesses_c_add_business_id.sql:36-40](../../supabase/migrations/20260529_businesses_c_add_business_id.sql#L36-L40);
**four (`order_items`, `order_addons`, `cost_objects`, `cultivar_plants`) have no FK to `businesses`
declared anywhere in the repo at all.** Whether they carry one live is UNKNOWN from here — and
unknown-FK is exactly Q3's orphan class.

Second proof the repo lies: **`opportunity_items` appears with BOTH `CASCADE` and `NO ACTION`**
across different migrations. Only the catalog knows which one is live.

> **Every FK claim below is a REPO-SIDE HYPOTHESIS labelled as such. Q1's query is what converts it
> into a fact. Do not act on this document's FK table — act on the query's output.**

---

## THE TWELVE QUESTIONS

### Q1 — THE FULL FK GRAPH INTO `businesses`
**Repo-side hypothesis (MUST be catalog-confirmed):** 33 declared FKs to `businesses(id)` —
**30 `ON DELETE CASCADE`**, **3+ with NO `ON DELETE`** (= `NO ACTION`, blocks).

| Action | Tables (repo-side) |
|---|---|
| **CASCADE (30)** | `audit_log` · `business_accounting_secrets` · `business_assets` · `business_discovery_profiles` · `business_inventory` · `business_inventory_ledger` · `business_members` · `business_modules` · `business_pmi_schedule` · `business_pricing_config` · `business_service_log` · `campaign_posts` · `campaign_tone_samples` · `campaigns` · `cost_object_assignments` · `cost_object_edges` · `deliveries` · `inventory_count_sessions` · `inventory_counts` · `invitations` · `labor_resource_wages` · `labor_resources` · `member_device_handoffs` · `member_devices` · `nursery_profiles` · `opportunity_items` · `pmi_assets` · `receipts` · `role_definitions` · `service_offerings` |
| **🔴 NO ACTION — BLOCKS** | `orders` · `customers` · `plant_events` · `addons` · `social_drafts` · `nursery_modules` · `plants`/`cultivar_plants` (all from `20260529_c:36-42`, no `ON DELETE`) · plus `order_compliance_records`, `pmi_service_logs`, `opportunity_items` (conflicting decl.) |
| **UNKNOWN — no repo declaration** | `order_items` · `order_addons` · `cost_objects` |

**Expected shape of the answer:** one row per constraint, `confdeltype` in `{a,r,c,n}` —
`a`=no action, `r`=restrict, `c`=cascade, `n`=set null. **Anything that is not `c` blocks the delete.**

### Q2 — THE SECOND HOP
Confirmed repo-side: `order_service_selections.order_id` and `order_compliance_records.order_id`
are **`ON DELETE CASCADE` from `orders`**
([20260529_f:68](../../supabase/migrations/20260529_businesses_f_service_offerings.sql#L68),
[20260529_g:31](../../supabase/migrations/20260529_businesses_g_compliance_and_customer_match.sql#L31)).
`social_drafts.order_id` is `ON DELETE SET NULL`.

**But the second hop never runs**, because the FIRST hop (`orders.business_id`) is `NO ACTION` and
blocks first. **A single `NO ACTION` anywhere in the chain aborts the entire statement** — Postgres
evaluates the whole delete as one transaction; there is no partial delete. Q2's query below walks
the graph to depth 3.

### Q3 — 🔴 ORPHAN TABLES (business_id with NO FK)
**Among the 96 tables the repo CAN see: ZERO.** No migrated table declares `business_id uuid`
without a `REFERENCES` clause (verified — every no-FK hit was a function parameter, not a column).

**🔴 That is a clean result for the wrong population.** The orphan class, if it exists, lives
entirely inside the nine unmigrated tables — and `order_items`, `order_addons`, `cost_objects` and
`cultivar_plants` are the named suspects, because no FK for them exists in the repo at all.
**Q3's query is the one that must be run; the repo cannot answer it.**

Two further known orphan-shaped surfaces, both real:
- **`storage.objects`** — see Q7. Carries the business id as a path STRING, never an FK.
- **Legacy `nursery_id`** — these tables still carry BOTH `nursery_id` and `business_id`
  (`20260529_c:44-49` backfilled one from the other). A row is reachable by two parent columns, and
  `nurseries` is itself pending DROP. Cascade from `businesses` does not see the `nursery_id` edge.

### Q4 — 🔴 THE APPEND-ONLY LEDGER: THIS IS THE DECIDING ANSWER
**It refuses DELETE. Explicitly. In the trigger's own `FOR` clause.**

```
CREATE TRIGGER trg_inventory_ledger_immutable
  BEFORE UPDATE OR DELETE ON business_inventory_ledger      -- ← DELETE
  FOR EACH ROW EXECUTE FUNCTION public.reject_inventory_ledger_mutation();
```
[20260720_inventory_movement_ledger.sql:196-212](../../supabase/migrations/20260720_inventory_movement_ledger.sql#L196-L212)
— raises `insufficient_privilege`: *"business_inventory_ledger is append-only: % is not permitted
(D-50 — a correction is a NEW row, never an edit)"*.

**The identical guard exists on `audit_log`**
([20260623_audit_log_spine.sql:151-167](../../supabase/migrations/20260623_audit_log_spine.sql#L151-L167)).

🔴 **AND HERE IS THE PART THAT DECIDES THE WHOLE TASK: BOTH TABLES CASCADE FROM `businesses`.**
A FK cascade **is** a DELETE. It fires the row trigger. So:

> **`DELETE FROM businesses WHERE id = <any tenant with one audit_log row or one ledger row>`
> → cascade reaches the guarded table → trigger RAISES → transaction ABORTS → nothing deleted.**

`audit_log` gets a row on essentially every role/permission/module act, so **a tenant that has been
touched at all almost certainly cannot be deleted.** The wipe script confirms this happened in
anger: *"a first run of STEP B rolled back on it"* — the guard has already stopped a teardown once.

**Also revoked, deliberately, as a fourth path:**
`REVOKE UPDATE, DELETE ON business_inventory_ledger FROM authenticated, anon, service_role;` and
`REVOKE TRUNCATE ... FROM anon, authenticated, service_role;` (`:220-227`).

**PLAINLY, as instructed:** *a tenant carrying ledger or audit history is NOT DELETABLE without
disabling an append-only guard.* Per the 2026-07-20 ruling (*"an append-only ledger row is immutable
including against `postgres`"*), **disabling that guard is a RULING, not a step.**
**This changes the answer from "delete" to "tombstone."**

### Q5 — WHAT DO THE THREE TENANTS ACTUALLY HOLD?
Cannot be answered from the repo — the three UUIDs in the prompt are **unconfirmed** and must be
read from the catalog, not taken from the prompt. Query below generates a per-tenant count across
every table carrying `business_id`, dynamically. **The prompt's IDs are treated as claims.**

### Q6 — AUTH USERS
`businesses.owner_id uuid NOT NULL REFERENCES auth.users(id)` — **no `ON DELETE`**
([20260529_businesses_a_create_tables.sql:6](../../supabase/migrations/20260529_businesses_a_create_tables.sql#L6)).

Two consequences, both confirmed by the wipe script's header:
1. **Deleting a business does NOT delete its `auth.users` row.** A user whose only membership was the
   doomed tenant is left belonging to nothing — able to log in, resolving to no business.
2. **The reverse is BLOCKED:** the auth user cannot be deleted while the business exists. Order is
   forced — business first, then user.

**In scope?** Partially. `auth` is a separate schema Supabase owns; we must not cascade into it. The
correct handling is **explicit and manual** (Supabase dashboard → Authentication → delete user), done
**after** the business is gone, and **only** for users with no other membership. Q6's query below
identifies exactly those users. **Do not automate this** — an `auth.users` delete is not ours to
cascade.

### Q7 — 🔴 STORAGE: ORPHANED *AND* UNREACHABLE
The `receipts` bucket keys on the business id as the **first path segment of the object name**,
not as a foreign key:
```
(split_part(name, '/', 1))::uuid IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
```
[20260613_receipts_storage_rls.sql:30-48](../../supabase/migrations/20260613_receipts_storage_rls.sql#L30-L48)

So the id IS carried — as a string. **No cascade can reach `storage.objects`.** Deleting the row:
- orphans every receipt image for that tenant, **and**
- 🔴 **makes them permanently unreachable through the app** — the policy's subquery resolves against
  `businesses`/`business_members`; with the row gone it returns nothing, so SELECT and DELETE both
  fail for everyone. **You lose the ability to clean them up by the normal path.**

The wipe script calls these *"harmless orphans"* — **true only in a full nuke, where every business
goes.** In a per-tenant delete it is a hidden, undeletable residue holding the tenant's receipt
images. **Files must be removed BEFORE the row, or they cannot be removed at all.**
`receipts` is the only bucket with policies in the repo; Q7's query confirms the live bucket list.

### Q8 — RPCs AND SECURITY DEFINER FUNCTIONS
**80 `SECURITY DEFINER` declarations across the migration corpus; 27 distinct functions take a
`p_business_id`.** The load-bearing ones — `is_active_member`, `has_permission`,
`has_permission_for`, `is_member_of`, `get_business_tax_rate`, `assert_movement_actor` — all resolve
membership or config **by looking the business up**.

**The failure mode is different from a broken FK and worth stating:** a `SECURITY DEFINER` function
reading a deleted tenant does not error — it **returns empty, and empty reads as "not permitted"**.
That is fail-closed and therefore safe, but it is also **silent**. It will not tell anyone the row is
missing; it will tell them they lack permission. Q8's query lists every definer function so David can
see the surface; **none of them needs to change for a tombstone**, which is a point in the
tombstone's favour.

### Q9 — 🔴 IS THERE ALREADY A PATH? **NO. AND THAT IS THE FINDING.**
- **No `delete_business` / `drop_business` / `purge_business` RPC.** No such identifier in
  `packages/`, `api/`, `scripts/`, or `supabase/`.
- **No app code deletes a business** — 21 `from('businesses')` sites in source, zero `.delete()`.
- **No admin surface.**

**The only artifact is `scripts/wipe-for-person-spine.sql` — the full nuke.** And its own header
names the successor that was supposed to replace it:

> *"The real LAWNS demo comes back as a FRESH load through the new structure via
> **Build B (the per-tenant seed/reset function, queued — not built yet)**."* — 2026-06-25

🔴 **Build B was never built. Two months later, the only tool that has ever removed a tenant is still
the one that removes all of them.** That is the whole answer to "why did we reset the entire db last
time": *there was nothing else to reach for, and there still isn't.*

**Note what the nuke actually does, because it is the thing not to repeat:** it disables every
append-only guard in a `DO` block, `TRUNCATE ... CASCADE`s every `business_id` table, re-enables the
guards, then `DELETE FROM auth.users`. It is careful, transactional, and correct **for its stated
one-time purpose** — and it is scoped to the entire database, with no `WHERE` anywhere.

### Q10 — 🔴 WHAT A SAFE DELETE WOULD LOOK LIKE (DOCUMENT ONLY — NOT WRITTEN TO `supabase/migrations/`)
**⚠️ THIS IS NOT RUNNABLE AND MUST NOT BE PASTED AS-IS. It is a shape for review.** It is deliberately
NOT in `supabase/migrations/` so it can never replay (the wipe script's own precedent).

```sql
-- ⚠️⚠️ DESTRUCTIVE — DO NOT RUN. REVIEW ARTIFACT ONLY. ⚠️⚠️
-- Preconditions that MUST be true first (see "WHAT MUST BE TRUE" below).
BEGIN;

  -- GUARD 1 — the id and the NAME must agree, in the same statement.
  -- A wrong uuid cannot survive this: no name match, zero rows, explicit abort.
  DO $$
  DECLARE v_id uuid := '<PASTE-ID>'; v_expect text := '<PASTE-EXACT-NAME>'; v_actual text;
  BEGIN
    SELECT name INTO v_actual FROM businesses WHERE id = v_id;
    IF v_actual IS NULL THEN RAISE EXCEPTION 'ABORT: no business %', v_id; END IF;
    IF v_actual <> v_expect THEN
      RAISE EXCEPTION 'ABORT: id % is "%", not "%"', v_id, v_actual, v_expect;
    END IF;
    -- GUARD 2 — refuse outright if this tenant has history.
    IF EXISTS (SELECT 1 FROM audit_log WHERE business_id = v_id)
    OR EXISTS (SELECT 1 FROM business_inventory_ledger WHERE business_id = v_id) THEN
      RAISE EXCEPTION 'ABORT: tenant has append-only history — tombstone, do not delete';
    END IF;
  END $$;

  -- BEFORE: David READS these counts and confirms them before continuing.
  -- (the Q5 query, scoped to the one id)

  -- Ordered child deletes, innermost first, EVERY ONE scoped by business_id,
  -- EVERY ONE with RETURNING so the count is read, never assumed.
  --   ... order_items via orders ... order_addons ... orders ... customers ...
  --   ... plant_events ... cultivar_plants ... social_drafts ... addons ...
  -- (the exact list and order come from Q1/Q2's OUTPUT, not from this document)

  DELETE FROM businesses WHERE id = '<PASTE-ID>' RETURNING id, name;

  -- AFTER: re-run the Q5 counts. Every table must read 0 for this id,
  -- and every OTHER tenant's counts must be UNCHANGED from the BEFORE read.

ROLLBACK;  -- ← deliberately ROLLBACK. Change to COMMIT only after the AFTER block is read.
```

**WHAT WOULD HAVE TO BE TRUE before this is safe to apply:**
1. Q1/Q2/Q3 run against the catalog, and the child list built from **their output**, not from here.
2. Q3 returns an empty orphan set — or every orphan is deleted explicitly by `business_id`.
3. The tenant has **zero** `audit_log` and **zero** `business_inventory_ledger` rows (Q4). If not:
   **stop — this is a tombstone, and the guard ruling is owed.**
4. Storage objects under `<id>/` removed FIRST (Q7), or they become unreachable.
5. Rehearsed on a throwaway tenant with `ROLLBACK`, and the AFTER counts read — **not skimmed**.

### Q11 — 🔴 BLAST RADIUS IF THE ID IS WRONG
**Say it in those words, as instructed:**

> **If David pastes the wrong uuid into an unguarded cascading delete, EVERYTHING UNDER THAT TENANT
> IS DESTROYED, IRREVERSIBLY, IN ONE STATEMENT — and there is no undo.** For `f7ec5d67` that is 907
> plants, 129 inventory rows, 11 customers, every order, every receipt, and the QBO connection.

**Three things make that impossible, and the recommendation is to require all three:**
1. **A NAME CHECK IN THE SAME STATEMENT** (GUARD 1 above) — the strongest of the three, because it
   fails on the *typo itself* rather than on its consequences. A wrong uuid does not match the
   expected name, and the statement aborts before touching a row.
2. **A DRY-RUN COUNT FIRST** — the Q5 query for that single id, read by a human. If it says 907
   plants, the id is wrong for a test tenant, and it says so before anything happens.
3. **`RETURNING id, name` HE MUST READ** — the delete announces what it removed, by name. Combined
   with `BEGIN … ROLLBACK`, the rehearsal is free.

🔴 **The honest caveat: today, guard (1) does not exist and neither do (2) or (3) — because no delete
path exists at all (Q9).** Whatever gets built must carry them from birth. And note the real
protection standing right now is the accidental one: **the append-only guards and the `NO ACTION`
FKs would abort a wrong-uuid delete on the live tenant too** — `f7ec5d67` has both history and
customers, so a mis-pasted `DELETE FROM businesses` against it **fails rather than destroys.**
That is luck by good design, not a control, and it should not be relied on.

### Q12 — 🔴 IS DELETE EVEN THE RIGHT ANSWER? **NO. TOMBSTONE.**

| | **HARD DELETE** | **TOMBSTONE (`deleted_at`)** |
|---|---|---|
| Append-only guards | 🔴 must be **disabled** — a ruling, and it contradicts D-50 | ✅ untouched |
| History | 🔴 destroyed, including the audit log of its own destruction | ✅ preserved |
| Reversible | 🔴 never | ✅ set the column back |
| Wrong-uuid blast radius | 🔴 total, irreversible | ✅ one column; undo it |
| Storage orphans | 🔴 orphaned **and unreachable** (Q7) | ✅ still reachable, still cleanable |
| `auth.users` | 🔴 stranded users (Q6) | ✅ unchanged |
| `SECURITY DEFINER` fns | fail silently-closed (Q8) | ✅ unaffected |
| Cost | a migration + 5 preconditions + a guard ruling | one column + read filters |
| Disk reclaimed | ✅ yes | ❌ no (irrelevant at this scale) |

**RECOMMENDATION: TOMBSTONE. David rules.**

The reasoning is not new — **it is the reasoning David already used to rule out the campaign
delete**: *a deleted thing destroys its own history.* Here it is stronger, because the platform has
already encoded that belief in two triggers that will physically refuse the delete. **Hard-deleting a
tenant requires overruling a control we built on purpose and ruled on 2026-07-20.**

⚠️ **The honest cost of the tombstone, stated rather than buried:** it is not free. Every read that
lists businesses must filter `deleted_at IS NULL`, and a tombstoned tenant that still appears
somewhere is a worse bug than a slow cleanup — that is `verify-write-paths`' class arriving on the
read side. **It is one column and N read sites, and the N is the work.**

**For Wednesday's throwaway tenant specifically:** neither option is needed. **Create it, walk the
provisioning path, and leave it.** It costs nothing, it is the honest state (it existed; it was a
test), and it is the only option that requires no ruling and no new code before Wednesday.

---

## THE READ-ONLY QUERIES DAVID RUNS
**Every query below is a plain `SELECT`. None writes. None is destructive. Run in the Supabase SQL
editor on `bgobkjcopcxusjsetfob`.** Q1/Q3/Q4's shapes are reused from `scripts/wipe-for-person-spine.sql`
STEP A, which has already been run in anger (§6 r8 — reuse, don't fork).

```sql
-- ── Q1 — EVERY FK INTO businesses, WITH ITS ON DELETE ACTION ────────────────────
-- confdeltype: a=NO ACTION(blocks) r=RESTRICT(blocks) c=CASCADE n=SET NULL
SELECT conrelid::regclass AS referencing_table,
       a.attname         AS referencing_column,
       conname           AS constraint_name,
       CASE confdeltype WHEN 'a' THEN 'NO ACTION (BLOCKS)'
                        WHEN 'r' THEN 'RESTRICT (BLOCKS)'
                        WHEN 'c' THEN 'CASCADE'
                        WHEN 'n' THEN 'SET NULL'
                        WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
FROM pg_constraint c
JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f' AND c.confrelid = 'public.businesses'::regclass
ORDER BY on_delete, referencing_table;

-- ── Q2 — THE GRAPH TO DEPTH 3 (where a BLOCK anywhere stops everything) ─────────
WITH RECURSIVE g AS (
  SELECT conrelid::regclass::text AS tbl, confrelid::regclass::text AS parent,
         confdeltype AS act, 1 AS depth
  FROM pg_constraint WHERE contype='f' AND confrelid='public.businesses'::regclass
  UNION ALL
  SELECT c.conrelid::regclass::text, c.confrelid::regclass::text, c.confdeltype, g.depth+1
  FROM pg_constraint c JOIN g ON c.confrelid::regclass::text = g.tbl
  WHERE c.contype='f' AND g.depth < 3 AND c.conrelid <> c.confrelid
)
SELECT DISTINCT depth, parent, tbl,
       CASE act WHEN 'c' THEN 'CASCADE' ELSE '🔴 BLOCKS/SETNULL — '||act END AS on_delete
FROM g ORDER BY depth, parent, tbl;

-- ── Q3 🔴 — ORPHANS: business_id columns with NO foreign key ────────────────────
SELECT c.table_name, c.column_name
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.column_name='business_id'
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint k
    JOIN unnest(k.conkey) AS ck(attnum) ON true
    JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=ck.attnum
    WHERE k.contype='f' AND k.conrelid = to_regclass('public.'||c.table_name)
      AND a.attname='business_id')
ORDER BY 1;
-- ALSO run for the legacy parent — these are invisible to a businesses cascade:
SELECT table_name FROM information_schema.columns
WHERE table_schema='public' AND column_name='nursery_id' ORDER BY 1;

-- ── Q4 — THE APPEND-ONLY GUARDS: what they cover, and are they ON ───────────────
SELECT c.relname AS guarded_table, t.tgname, p.proname,
       t.tgenabled AS enabled_flag,          -- 'O' = ON, 'D' = DISABLED
       CASE WHEN (t.tgtype & 8)>0 THEN 'DELETE ' ELSE '' END ||
       CASE WHEN (t.tgtype & 16)>0 THEN 'UPDATE ' ELSE '' END ||
       CASE WHEN (t.tgtype & 4)>0 THEN 'INSERT' ELSE '' END AS covers
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
WHERE n.nspname='public' AND NOT t.tgisinternal AND p.proname ILIKE 'reject%mutation'
ORDER BY 1;

-- ── Q5 🔴 — PER-TENANT ROW COUNTS ACROSS EVERY business_id TABLE ────────────────
-- Generates the counting SQL. READ the output, then run it. Nothing here writes.
SELECT string_agg(
  format('SELECT %L AS tbl, business_id::text, count(*) FROM public.%I GROUP BY 2',
         table_name, table_name), E'\nUNION ALL\n' ORDER BY table_name) || E'\nORDER BY 1,2;'
FROM information_schema.columns
WHERE table_schema='public' AND column_name='business_id'
  AND to_regclass('public.'||table_name) IS NOT NULL;

-- and the tenant list itself — CONFIRM the three uuids here, do not trust a prompt:
SELECT id, name, business_type, owner_id, created_at FROM businesses ORDER BY created_at;

-- ── Q6 — USERS WHO WOULD BE LEFT BELONGING TO NOTHING ───────────────────────────
SELECT u.id, u.email,
       (SELECT count(*) FROM business_members m WHERE m.user_id=u.id AND m.active) AS memberships,
       (SELECT count(*) FROM businesses b WHERE b.owner_id=u.id)                   AS owns
FROM auth.users u ORDER BY 3, 4;

-- ── Q7 — STORAGE: buckets, and objects per tenant folder ────────────────────────
SELECT id, name, public FROM storage.buckets;
SELECT bucket_id, split_part(name,'/',1) AS business_folder, count(*), sum(coalesce((metadata->>'size')::bigint,0)) AS bytes
FROM storage.objects GROUP BY 1,2 ORDER BY 1,2;

-- ── Q8 — SECURITY DEFINER FUNCTIONS THAT TAKE A BUSINESS ID ─────────────────────
SELECT p.proname, pg_get_function_arguments(p.oid) AS args, p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND pg_get_function_arguments(p.oid) ILIKE '%business_id%'
ORDER BY p.prosecdef DESC, p.proname;
```

---

## 🔴 RULINGS OWED BEFORE ANYTHING RUNS

| # | Ruling owed | Blocks |
|---|---|---|
| **T-A** | 🔴 **DELETE OR TOMBSTONE?** Recommendation: **tombstone**, on the reasoning David already used for the campaign delete. | everything below |
| **T-B** | 🔴 **MAY AN APPEND-ONLY GUARD EVER BE DISABLED TO REMOVE A TENANT?** The 2026-07-20 ruling says a ledger row is immutable *including against `postgres`*. The wipe script disabled the guards once, as an explicitly-labelled one-time environment teardown. **Is a per-tenant delete a second such case, or is the guard absolute?** If absolute, **hard delete is off the table for any used tenant** and T-A is answered by construction. |  any hard delete |
| **T-C** | **IS `Build B` STILL OWED?** Named in `wipe-for-person-spine.sql` on 2026-06-25 as *"the per-tenant seed/reset function, queued — not built yet"*; never built. It is the actual missing capability behind this whole recon. Build it, or file it `scoped-out` with a reason — **the four-unmintable-deletes precedent says an unfiled no comes back as a question that costs a recon.** | the Wednesday walk-through, and the next one |
| **T-D** | **DOES THE THROWAWAY TENANT NEED REMOVING AT ALL?** Recommendation: **no** — create it, walk it, leave it. Requires no ruling and no code before Wednesday. | Wednesday only |
| **T-E** | **WHO MAY DO THIS?** There is no permission string and, per the 2026-07-30 ruling, `isOwner` is DISPLAY-ONLY and not an authority mechanism. If a tenant-removal surface is ever built, its gate is a genuinely new model question — **the same one still open for `campaigns:delete`.** | any UI |

---

## WHAT I DID NOT DO
- Ran no SQL. **Reading `.env.local` was denied by the sandbox and I did not work around it** — so
  every catalog claim here is explicitly a hypothesis, and Q1–Q8's queries are David's to run.
- Wrote no migration, disabled no trigger, deleted nothing, touched `f7ec5d67` in no way at all.
- Did not propose disabling the append-only guard as a step. **It is filed as ruling T-B.**
