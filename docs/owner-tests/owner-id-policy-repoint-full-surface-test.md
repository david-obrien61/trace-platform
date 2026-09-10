# OWNER TEST — LAUREN CAN DO HER WORK: 49 `owner_id` POLICIES, TRIAGED

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** 1.5 identity / roles / RBAC · 2.6 settings/profile · 3.5 team
**Ledger:** #289 · **Branch:** `main` · **Last updated:** 2026-09-10
**Story:** ⚠️ **NO STORY ON THE BOARD COVERS "an OWNER-ROLE member who is not the account holder
does her job", and one is OWED.** The nearest is R-22's archived *Hand over the keys — the owner
role outlives the person who opened the account*, which is about **transfer**, not about a second
owner working alongside the first. **Flagged, not invented** (§9 story-reconciliation gate). This
is the same gate the `owner-role-authority` board left open on 2026-09-04 and it is still open.
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 12 covered · owed 11 · needs-test 1.**

> 🔴 **EVERY CARD NAMES WHO RUNS IT AND ON WHICH TENANT, AND NOT ONE OF THEM IS A TERMINAL COMMAND.**
> David's interaction is the **Supabase SQL editor** or the **app UI**, and has been since July. A
> card naming a terminal is the same mistake as a card naming Lauren: it looks runnable and waits
> forever. The behavioural halves that genuinely cannot be reached from the SQL editor were **RUN BY
> THUNDER** and are recorded on the cards as builder verification — **that run marks nothing
> `covered`** (OP-14; `memberSession.mjs`: *"a machine proves the POLICY is correct; a human proves
> a REAL MEMBER is configured correctly"*).

---

## ⛔ GATE 0 — DO THIS BEFORE READING ANY SCREEN (OP-15)

1. `git log -1 --format=%h` on `main` — or read the SHA off the GitHub commit list.
2. Vercel: the deployment for **that exact SHA** reads **READY** (not a *different* push's Ready).
3. Open the app with `?debug=1`; the DebugPanel footer shows the same 7-char SHA. Hard-refresh.

If ①–③ disagree, **STOP.** Do not record a pass or a fail.

## ⛔ MIGRATION GATE — TWO MIGRATIONS, AND ONLY ONE OF THEM IS APPLIED

| Migration | State | Bearing on this board |
|---|---|---|
| `20260910_permission_literal_merge.sql` | ✅ **APPLIED** — David applied it in the SQL editor and measured `is_literal = true`, `still_expands = false`, `search_path` pinned, 59 policies, `has_permission_exact` gone (0 rows). **Independently re-measured off the catalog the same day.** | It is the PRE-FLIGHT for the one below: `20260910b` §0 **refuses to apply** unless `has_permission` is already the literal form. |
| `20260910b_owner_id_policies_become_permissions.sql` | 🔴 **WRITTEN, NOT APPLIED.** | **CARDS 2–9 ALL BLOCK ON IT.** Apply it as `postgres`, **in the SQL editor, never the table editor** (§6 r17). |

⚠️ **`has_permission_for` (the 3-arg form the RPCs use) still expands aliases** — deliberate and
narrow, tech-debt **#233**, not a gate.

**PROVE IT ON TEST DAVE'S TREE NEST FIRST** — `95c1b2e9-3b09-43dd-a9f8-ba0744ca4382`. **LAWNS is
read-only except what you run**, and it has real customers on it.

---

# ═══ SECTION A — DAVID CAN RUN THESE NOW, BEFORE APPLYING ANYTHING ═══
*SQL editor or your own login. No migration required. No terminal.*

### CARD 1 — 🔴 THE RED: read the acceptance query BEFORE you apply, so you have seen it fail
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** **David** · **TENANT:** reads LAWNS's arrays, writes nothing
Paste **`docs/decisions/2026-09-10-owner-id-repoint-acceptance.sql`** into the SQL editor and run it.
It is read-only. Read the **second** result (the six-number summary).
- ✅ **PASS (this is the RED, and it is what you want to see):** `dead_permission_policies = 31` ·
  `surviving_dropped = 10` · every `gate` column reads `raw owner_id`.
- 🔴 **FAIL:** anything else — someone has applied part of `20260910b` already, and Card 2 is not safe.
> Thunder ran exactly this against the catalog on 2026-09-10 and got
> `permission_rows 31 · lauren_refusals 3 · david_refusals 3 · joel_refusals 12 ·
> dead_permission_policies 31 · surviving_dropped 10`. **A check nobody has watched fail is a claim
> (§6 r19)** — this card is you watching it fail.

### CARD 10 — the two minted strings do not exist yet, so nothing can be holding them
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** **David** · **TENANT:** all
```sql
SELECT b.name AS business, m.role, m.name AS member,
       (m.permissions ?| ARRAY['accounting:connect','devices:manage']) AS holds_a_new_string
  FROM public.business_members m JOIN public.businesses b ON b.id = m.business_id
 WHERE m.active = true ORDER BY b.name, m.role, m.name;
```
- ✅ **PASS:** `holds_a_new_string` is **false on every row.**
- 🔴 **FAIL:** a true — a string is already in an array and did not come from this build.

---

# ═══ SECTION B — AFTER YOU APPLY `20260910b` ═══
*Apply it in the SQL editor as `postgres`. It runs in ONE transaction: if §0's pre-flight raises,
nothing lands. Then run these in order.*

### CARD 2 — 🔴 THE ACCEPTANCE CLAUSE. RUN THIS ONE AND IF IT PASSES YOU CAN BREATHE
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** **David** · **TENANT:** reads LAWNS
Re-run **`docs/decisions/2026-09-10-owner-id-repoint-acceptance.sql`**. Read both results.
- ✅ **PASS:** summary reads `permission_rows 31 · lauren_refusals 0 · david_refusals 0 ·
  joel_refusals 12 · dead_permission_policies 0 · surviving_dropped 0`, and in the big table every
  PERMISSION row shows `gate = permission` with `lauren = ADMIT` and `david = ADMIT`.
- 🔴 **FAIL — and this is the one that matters most:** `joel_refusals = 0`. **A gate that has only
  ever admitted is not a proven gate.** Joel must be refused on exactly TWELVE rows — and **two of them are the split policies** (`cultivar_plants_member_delete`, `deliveries_member_insert`), which is precisely where a single `FOR ALL` repoint would have handed him a verb the model separates.

### CARD 3 — 🔴 THE REFUSAL, UNDER A REAL SESSION. Joel is not admitted where he holds nothing
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** **David** · **TENANT:** LAWNS (read-only; the block ROLLS BACK)
> 🔴 **THE IMPERSONATION FORM IS THE CLAIMS GUC ALONE — *NOT* `SET LOCAL role authenticated`.**
> That form is written into three earlier V-blocks in this repo (`20260828` V7–V9) and **has never
> been run.** Thunder tried it on 2026-09-10 and it failed: `permission denied to set role
> "authenticated"`. Setting the claims is enough for anything that reads `auth.uid()`, and Thunder
> proved it works by getting three different real answers out of it.
```sql
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"6f09038f-7966-49e3-b86a-1e3beb5e311f"}';  -- Joel, MANAGER
  SELECT public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','devices:manage')  AS can_devices,
         public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','costs:update')    AS can_costs,
         public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','settings:update') AS can_settings;
ROLLBACK;
```
- ✅ **PASS:** `can_devices = false`, `can_costs = false`, **`can_settings = true`.** Add
  `has_permission(…,'inventory:delete')` → **false** and `has_permission(…,'inventory:update')` → **true**
  if you want the split's own proof in the same block.
- 🔴 **FAIL:** all three true (the gate admits everyone) **or** all three false (the claims line did
  not take — `has_permission` reads `auth.uid()`, so the `SET LOCAL` **is** the test).
> Thunder measured the array half of exactly this on 2026-09-10 via `get_my_permissions` under
> Joel's claims: **n = 25 · `costs:update` false · `settings:update` true.** What this card adds is
> that the FUNCTION agrees with the array — the half a read of `business_members` cannot show.

### CARD 4 — 🔴 THE HEADLINE, UNDER A REAL SESSION: Lauren reads the row she could not see
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** **David** · **TENANT:** LAWNS (rolls back)
**PART A — the permission half (claims only; this form is proven to work):**
```sql
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"790b31d2-7b65-45ec-953f-79855453a73e"}';  -- Lauren, OWNER role
  SELECT jsonb_array_length(permissions) AS n, is_account_holder
    FROM public.get_my_permissions('ed2e5933-45dc-4b9b-a331-ddfd125e7a74');
  SELECT public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','settings:update')       AS can_settings,
         public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','pricing_recipe:update') AS can_pricing,
         public.has_permission('ed2e5933-45dc-4b9b-a331-ddfd125e7a74','devices:manage')        AS can_devices;
ROLLBACK;
```
- ✅ **PASS:** `n = 59`, **`is_account_holder = false`** (she is an owner, not the account holder —
  that is the correct answer, not a bug), and all three booleans **true**.
- 🔴 **FAIL:** `n = 57` — `20260910b` §6's backfill did not run, and `can_devices` will be false.
> ✅ Thunder measured this pre-migration: **Lauren n=57 holder=FALSE · David n=57 holder=TRUE** —
> identical arrays, different boolean. The `59` is the only thing this card is waiting on.

**PART B — the row half. THIS one needs the role switch, and it may refuse:**
```sql
BEGIN;
  SET LOCAL role authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"790b31d2-7b65-45ec-953f-79855453a73e"}';
  SELECT count(*) AS nursery_profile_rows FROM public.nursery_profiles
   WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
ROLLBACK;
```
- ✅ **PASS:** `nursery_profile_rows = 1`. **LAWNS HAS A ROW — measured 2026-09-10.** A zero is the
  false empty still live: her install-price field renders blank and reads as *not set* (D-9).
- ⚠️ **If it errors `permission denied to set role "authenticated"`, STOP AND SAY SO** — that is the
  editor refusing, not a failure of the fix. Thunder then runs the anon-key harness and reports.
  **Part A still stands on its own.**
> Thunder proved the RED behaviourally on Test Dave's before the fix — an ephemeral OWNER-role
> principal holding `settings:read`/`settings:update` read **0 rows while the service key saw 1, with
> no error**. Builder verification only; it marks nothing `covered`.

### CARD 5 — 🔴 THE INSERT DOOR ON `business_pricing_config` IS STILL SHUT
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** **David** · **TENANT:** all
```sql
SELECT policyname, cmd FROM pg_policies
 WHERE schemaname='public' AND tablename='business_pricing_config' ORDER BY policyname;
```
- ✅ **PASS:** exactly three rows — `bpc_member_select` (SELECT) · `bpc_member_update` (UPDATE) ·
  `bpc_owner_insert` (INSERT). **No `bpc_member_insert`. No policy with cmd `ALL`.**
- 🔴 **FAIL:** a `bpc_member_insert`, or any `ALL` — a permission named *update* would then create
  a row, which is capP assertion 5 and the reason `pricing_recipe` has no create verb.

### CARD 6 — nobody but an OWNER-role member moved
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** **David** · **TENANT:** all
Run **V5** from the foot of the migration.
- ✅ **PASS:** every OWNER row `n = 59`; MANAGER `= 25`; STAFF `= 10`; `holds_a_new_string` **false
  on every non-OWNER row**.
- 🔴 **FAIL:** a MANAGER at 27 — the backfill over-granted.

### CARD 7 — 🔴 THE ASSUMPTION THE TEN DROPS REST ON
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** **David** · **TENANT:** all
Run **V6**. It asks whether any account holder is *not* an active member of their own business.
- ✅ **PASS:** **0 rows.** Ten policies were dropped on the strength of this sentence; this is the
  sentence being checked rather than believed.
- 🔴 **FAIL:** any row — that account holder just lost access to their own tables. **Re-add their
  member row before doing anything else.**

### CARD 8 — the eight kept-raw policies carry their reason
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** **David** · **TENANT:** all
Run **V8**.
- ✅ **PASS:** 8 rows, every `why` non-null and readable.
- 🔴 **FAIL:** a null — a deliberate residue that still reads as an un-migrated leftover, which is
  exactly how the next person "tidies" it away.

---

# ═══ SECTION C — IN THE APP, AS A PERSON ═══

### CARD 9 — Settings saves the default install price, as an OWNER-role member
**STATUS:** owed · **DEVICE:** desktop · **WHO:** 🔴 **LAUREN — this card WAITS on her login. David cannot run it.**
**TENANT:** LAWNS
Lauren opens **Settings**, reads the **default install price**, changes it, saves, and **reloads**.
- ✅ **PASS:** the field shows a value on arrival (not blank), the save succeeds, the value persists.
- 🔴 **FAIL:** a blank field (the false empty), or `new row violates row-level security policy`.
> **David's substitute for the DATABASE half is CARD 4**, which needs only the SQL editor. What Card
> 9 adds that Card 4 cannot is that **a real member is configured correctly** — the half a machine
> and an impersonation block both miss.

### CARD 11 — the QuickBooks connection and the device list are unchanged for everyone
**STATUS:** needs-test · **DEVICE:** desktop · **WHO:** **David** · **TENANT:** Test Dave's
**REASON IT IS `needs-test` AND NOT `owed`:** `accounting:connect` gates
`business_accounting_secrets`, and **every reader of that table is `api/qbo/*` running on the
SERVICE KEY, which bypasses RLS entirely** — so there is no client surface whose behaviour can
change, and no observation available that would distinguish pass from fail. The same is true of
`member_devices` until a device-management surface exists. **Writing this down is the test**: an
unrecorded hole is a lie by omission (OP-14 cl.2). It becomes a real card the day either surface
gets a client reader.
