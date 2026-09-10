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
**Board: 0 of 11 covered · owed 9 · needs-test 2.**

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
| `20260910b_owner_id_policies_become_permissions.sql` | ✅ **APPLIED 2026-09-10 by David.** | **CARDS 2–9 ARE UNBLOCKED.** ⚠️ CARD 1 is now `needs-test` — see its own note. |
| `20260910c_get_my_permissions_capture.sql` | ✅ **APPLIED 2026-09-10 by David** (a `CREATE OR REPLACE` no-op capture). | The RPC is still **called by nothing**, deliberately — tech-debt #238. |

⚠️ **`has_permission_for` (the 3-arg form the RPCs use) still expands aliases** — deliberate and
narrow, tech-debt **#233**, not a gate.

✅ **THE MIGRATION IS IN, AND THE ACCEPTANCE QUERY WAS RE-MEASURED AGAINST THE CATALOG AFTERWARDS —
INDEPENDENTLY OF THE REPORT (Thunder, read-only, 2026-09-10):**

| | before | after |
|---|---|---|
| `permission_rows` | 31 | **31** |
| `lauren_refusals` | 3 | **0** |
| `david_refusals` | 3 | **0** |
| `joel_refusals` | 12 | **12** — HELD, which is the assertion that matters |
| `dead_permission_policies` | 31 | **0** |
| `surviving_dropped` | 10 | **0** |

Also measured post-apply: **OWNER floor = 59** · all four OWNER-role members = **59 and holding both
new strings** · every MANAGER and STAFF **unmoved and holding neither** · **V6 = 0 rows** (the
assumption the ten drops rest on) · **V8 = 8 policies, every one carrying its reason** · `bpc` has
exactly three policies and **no `bpc_member_insert`** · **raw-`owner_id` policies 49 → 12**, and the
twelve are exactly the 8 kept + `bpc_owner_insert` + the 3 on tables pending DROP.

🔴 **NONE OF THAT MARKS A CARD `covered`.** Every number above is the DATABASE agreeing with itself.
**Cards 3, 4 and 9 are about a person**, and only your run flips them.

⚠️ **LAWNS is read-only except what you run**, and it has real customers on it. Test Dave's Tree Nest
is `95c1b2e9-3b09-43dd-a9f8-ba0744ca4382`.

---

# ═══ SECTION A — DAVID CAN RUN THESE NOW, BEFORE APPLYING ANYTHING ═══
*SQL editor or your own login. No migration required. No terminal.*

### CARD 1 — 🔴 THE RED: read the acceptance query BEFORE you apply, so you have seen it fail
**STATUS:** needs-test · **DEVICE:** desktop (SQL editor) · **WHO:** **David** · **TENANT:** reads LAWNS's arrays, writes nothing
> 🔴 **THIS CARD CAN NO LONGER BE RUN, AND THAT IS A REAL LOSS RATHER THAN A TIDY-UP.** The migration
> was applied on 2026-09-10 before the card was run, so the RED it exists to show you is gone from
> the database. **Thunder measured it beforehand** (`dead_permission_policies 31 · surviving_dropped
> 10`, every `gate` reading `raw owner_id`) and that measurement is the only evidence the check could
> ever have failed — which is exactly the thing §6 r19 says a green result needs and a person is
> supposed to see for themselves. Marked `needs-test` with its reason rather than quietly `covered`
> off someone else's run. **CARD 2 below is the same query and IS runnable now.**
**THE SQL IS RIGHT HERE — do not go and find a file.** Select the whole block below, paste it into
the Supabase SQL editor, run it. **It is read-only: two `SELECT`s, no writes, no transaction.**

It is two statements. The **first** returns 53 rows — every policy, with `ADMIT`/`refuse` for Lauren,
David and Joel. The **second** returns **one row of six numbers**, which is the one that matters.
⚠️ **If your editor shows you only ONE result, it is the six-number summary** (editors that run a
whole script generally show the last result). To see the 53-row table, select and run only the part
above the `── THE ONE-LINE SUMMARY` comment.

```sql
WITH plan(tbl, pol, cmd, perm, kind) AS (VALUES
  ('addons','addons_business_owner','ALL','service_offerings:update','PERMISSION'),
  ('audit_log','audit_insert','INSERT','(account holder only)','OWNER_ID'),
  ('audit_log','audit_owner_read','SELECT','audit_log:read','PERMISSION'),
  ('business_accounting_secrets','bas_owner_all','ALL','accounting:connect','PERMISSION'),
  ('business_discovery_profiles','business_discovery_profiles_owner_all','ALL','settings:update','PERMISSION'),
  ('business_display_standards','business_display_standards_owner_all','ALL','settings:update','PERMISSION'),
  ('business_inventory','business_inventory_owner_all','ALL','(dropped)','GONE'),
  ('business_inventory_ledger','business_inventory_ledger_owner_all','ALL','inventory_ledger:read','PERMISSION'),
  ('business_members','bm_owner_all','ALL','(account holder only)','OWNER_ID'),
  ('business_operating_days','business_operating_days_owner_all','ALL','(dropped)','GONE'),
  ('business_pmi_schedule','business_pmi_schedule_owner_all','ALL','pmi:update','PERMISSION'),
  ('business_pricing_config','bpc_owner_insert','INSERT','(account holder only)','OWNER_ID'),
  ('business_service_log','business_service_log_owner_all','ALL','pmi:update','PERMISSION'),
  ('business_voice_samples','business_voice_samples_owner','ALL','campaigns:update','PERMISSION'),
  ('campaign_posts','campaign_posts_owner','ALL','campaigns:update','PERMISSION'),
  ('campaigns','campaigns_owner','ALL','campaigns:update','PERMISSION'),
  ('cost_object_assignments','cost_object_assignments_owner_all','ALL','(dropped)','GONE'),
  ('cost_object_edges','cost_object_edges_owner_all','ALL','(dropped)','GONE'),
  ('cost_objects','cost_objects_owner_all','ALL','(dropped)','GONE'),
  ('cultivar_plants','cultivar_plants_member_insert','INSERT','inventory:create','PERMISSION'),
  ('cultivar_plants','cultivar_plants_member_update','UPDATE','inventory:update','PERMISSION'),
  ('cultivar_plants','cultivar_plants_member_delete','DELETE','inventory:delete','PERMISSION'),
  ('cultivar_plants','cultivar_plants_owner_select','SELECT','inventory:read','PERMISSION'),
  ('customers','customers_business_owner','ALL','customers:update','PERMISSION'),
  ('deliveries','deliveries_member_insert','INSERT','deliveries:create','PERMISSION'),
  ('deliveries','deliveries_member_delete','DELETE','deliveries:update','PERMISSION'),
  ('inventory_count_sessions','inventory_count_sessions_owner_all','ALL','inventory:update','PERMISSION'),
  ('inventory_counts','inventory_counts_owner_all','ALL','inventory:update','PERMISSION'),
  ('invitations','inv_owner_all','ALL','(account holder only)','OWNER_ID'),
  ('labor_resource_wages','lrw_owner_all','ALL','(dropped)','GONE'),
  ('labor_resources','labor_resources_owner_all','ALL','(dropped)','GONE'),
  ('losses','losses_all_owner','ALL','(pending table DROP)','UNTOUCHED'),
  ('member_device_handoffs','mdh_owner_all','ALL','devices:manage','PERMISSION'),
  ('member_devices','md_owner_all','ALL','devices:manage','PERMISSION'),
  ('nurseries','authenticated_select_nurseries','SELECT','(pending table DROP)','UNTOUCHED'),
  ('nurseries','nurseries_update_owner','UPDATE','(pending table DROP)','UNTOUCHED'),
  ('nursery_profiles','nursery_profiles_owner','ALL','settings:update','PERMISSION'),
  ('nursery_profiles','nursery_profiles_member_select','SELECT','settings:read','PERMISSION'),
  ('opportunity_items','opportunity_items_owner','ALL','service_offerings:update','PERMISSION'),
  ('order_addons','order_addons_owner','ALL','order_items:update','PERMISSION'),
  ('order_compliance_records','compliance_records_owner_select','SELECT','(dropped)','GONE'),
  ('order_items','order_items_owner','ALL','order_items:update','PERMISSION'),
  ('order_service_selections','order_service_selections_owner','ALL','order_service_selections:update','PERMISSION'),
  ('orders','orders_business_owner','SELECT','(dropped)','GONE'),
  ('plant_events','plant_events_business_owner','ALL','inventory:update','PERMISSION'),
  ('receipts','receipts_owner_all','ALL','(dropped)','GONE'),
  ('role_definitions','rd_owner_write','ALL','(account holder only)','OWNER_ID'),
  ('service_offerings','service_offerings_owner','ALL','(account holder only)','OWNER_ID'),
  ('social_drafts','social_drafts_business_owner','ALL','campaigns:update','PERMISSION'),
  ('vendor_preferences','vendor_preferences_owner_all','ALL','costs:update','PERMISSION'),
  ('businesses','businesses_owner_insert','INSERT','(account holder only)','OWNER_ID'),
  ('businesses','businesses_owner_select','SELECT','(account holder only)','OWNER_ID'),
  ('businesses','businesses_owner_update','UPDATE','(account holder only)','OWNER_ID')
),
lawns(bid) AS (VALUES ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74'::uuid)),
mem(who, uid) AS (VALUES
  ('lauren', '790b31d2-7b65-45ec-953f-79855453a73e'::uuid),
  ('david',  '98f4e56b-cd27-4099-a9d8-5c8cbb63d00f'::uuid),
  ('joel',   '6f09038f-7966-49e3-b86a-1e3beb5e311f'::uuid)),
held AS (
  SELECT m.who, bm.active, bm.permissions
    FROM mem m
    LEFT JOIN public.business_members bm
           ON bm.user_id = m.uid AND bm.business_id = (SELECT bid FROM lawns)),
live AS (
  SELECT p.tbl, p.pol, p.cmd, p.perm, p.kind,
         count(gp.policyname) FILTER (
           WHERE p.kind <> 'PERMISSION'
              OR (coalesce(gp.qual,'') || coalesce(gp.with_check,'')) LIKE '%' || p.perm || '%') AS policy_live,
         max(CASE WHEN (coalesce(gp.qual,'') || coalesce(gp.with_check,'')) ~ 'owner_id'
                   AND (coalesce(gp.qual,'') || coalesce(gp.with_check,'')) !~ 'has_permission'
                  THEN 'raw owner_id'
                  WHEN (coalesce(gp.qual,'') || coalesce(gp.with_check,'')) ~ 'has_permission'
                  THEN 'permission'
                  ELSE '(absent)' END) AS gate
    FROM plan p
    LEFT JOIN pg_policies gp
           ON gp.schemaname = 'public' AND gp.tablename = p.tbl AND gp.policyname = p.pol
   GROUP BY 1,2,3,4,5)
SELECT l.tbl, l.pol, l.cmd, l.kind, l.perm, l.policy_live, l.gate,
       max(CASE WHEN h.who = 'lauren' THEN
              CASE WHEN l.kind <> 'PERMISSION' THEN '—'
                   WHEN coalesce(h.active,false) AND h.permissions ? l.perm THEN 'ADMIT'
                   ELSE 'refuse' END END) AS lauren,
       max(CASE WHEN h.who = 'david' THEN
              CASE WHEN l.kind <> 'PERMISSION' THEN '—'
                   WHEN coalesce(h.active,false) AND h.permissions ? l.perm THEN 'ADMIT'
                   ELSE 'refuse' END END) AS david,
       max(CASE WHEN h.who = 'joel' THEN
              CASE WHEN l.kind <> 'PERMISSION' THEN '—'
                   WHEN coalesce(h.active,false) AND h.permissions ? l.perm THEN 'ADMIT'
                   ELSE 'refuse' END END) AS joel
  FROM live l CROSS JOIN held h
 GROUP BY 1,2,3,4,5,6,7
 ORDER BY CASE l.kind WHEN 'PERMISSION' THEN 1 WHEN 'OWNER_ID' THEN 2 WHEN 'GONE' THEN 3 ELSE 4 END,
          l.tbl, l.pol;

-- ── THE ONE-LINE SUMMARY, so a wall of 50 rows cannot hide a single wrong cell ─────────────────
-- EXPECT AFTER APPLYING: permission_rows = 31 · lauren_refusals = 0 · david_refusals = 0 ·
--         joel_refusals = 12 · dead_permission_policies = 0 · surviving_dropped = 0
--
-- 🔴 THE RED, MEASURED BEFORE APPLYING (Thunder, 2026-09-10, read-only via the PAT — this is what
--    the same query said with the migration UNAPPLIED, and it is the proof the check can fail):
--         permission_rows = 31 · lauren_refusals = 3 · david_refusals = 3 · joel_refusals = 12 ·
--         dead_permission_policies = 31 · surviving_dropped = 10
--    Every PERMISSION row read `gate = raw owner_id`. The three refusals on Lauren AND David are
--    `accounting:connect` / `devices:manage` ×2 — strings that did not exist yet. §6 grants them,
--    which is exactly why the mint and the policies had to land in one transaction.
WITH plan(tbl, pol, cmd, perm, kind) AS (VALUES
  ('addons','addons_business_owner','ALL','service_offerings:update','PERMISSION'),
  ('audit_log','audit_insert','INSERT','(account holder only)','OWNER_ID'),
  ('audit_log','audit_owner_read','SELECT','audit_log:read','PERMISSION'),
  ('business_accounting_secrets','bas_owner_all','ALL','accounting:connect','PERMISSION'),
  ('business_discovery_profiles','business_discovery_profiles_owner_all','ALL','settings:update','PERMISSION'),
  ('business_display_standards','business_display_standards_owner_all','ALL','settings:update','PERMISSION'),
  ('business_inventory','business_inventory_owner_all','ALL','(dropped)','GONE'),
  ('business_inventory_ledger','business_inventory_ledger_owner_all','ALL','inventory_ledger:read','PERMISSION'),
  ('business_members','bm_owner_all','ALL','(account holder only)','OWNER_ID'),
  ('business_operating_days','business_operating_days_owner_all','ALL','(dropped)','GONE'),
  ('business_pmi_schedule','business_pmi_schedule_owner_all','ALL','pmi:update','PERMISSION'),
  ('business_pricing_config','bpc_owner_insert','INSERT','(account holder only)','OWNER_ID'),
  ('business_service_log','business_service_log_owner_all','ALL','pmi:update','PERMISSION'),
  ('business_voice_samples','business_voice_samples_owner','ALL','campaigns:update','PERMISSION'),
  ('campaign_posts','campaign_posts_owner','ALL','campaigns:update','PERMISSION'),
  ('campaigns','campaigns_owner','ALL','campaigns:update','PERMISSION'),
  ('cost_object_assignments','cost_object_assignments_owner_all','ALL','(dropped)','GONE'),
  ('cost_object_edges','cost_object_edges_owner_all','ALL','(dropped)','GONE'),
  ('cost_objects','cost_objects_owner_all','ALL','(dropped)','GONE'),
  ('cultivar_plants','cultivar_plants_member_insert','INSERT','inventory:create','PERMISSION'),
  ('cultivar_plants','cultivar_plants_member_update','UPDATE','inventory:update','PERMISSION'),
  ('cultivar_plants','cultivar_plants_member_delete','DELETE','inventory:delete','PERMISSION'),
  ('cultivar_plants','cultivar_plants_owner_select','SELECT','inventory:read','PERMISSION'),
  ('customers','customers_business_owner','ALL','customers:update','PERMISSION'),
  ('deliveries','deliveries_member_insert','INSERT','deliveries:create','PERMISSION'),
  ('deliveries','deliveries_member_delete','DELETE','deliveries:update','PERMISSION'),
  ('inventory_count_sessions','inventory_count_sessions_owner_all','ALL','inventory:update','PERMISSION'),
  ('inventory_counts','inventory_counts_owner_all','ALL','inventory:update','PERMISSION'),
  ('invitations','inv_owner_all','ALL','(account holder only)','OWNER_ID'),
  ('labor_resource_wages','lrw_owner_all','ALL','(dropped)','GONE'),
  ('labor_resources','labor_resources_owner_all','ALL','(dropped)','GONE'),
  ('losses','losses_all_owner','ALL','(pending table DROP)','UNTOUCHED'),
  ('member_device_handoffs','mdh_owner_all','ALL','devices:manage','PERMISSION'),
  ('member_devices','md_owner_all','ALL','devices:manage','PERMISSION'),
  ('nurseries','authenticated_select_nurseries','SELECT','(pending table DROP)','UNTOUCHED'),
  ('nurseries','nurseries_update_owner','UPDATE','(pending table DROP)','UNTOUCHED'),
  ('nursery_profiles','nursery_profiles_owner','ALL','settings:update','PERMISSION'),
  ('nursery_profiles','nursery_profiles_member_select','SELECT','settings:read','PERMISSION'),
  ('opportunity_items','opportunity_items_owner','ALL','service_offerings:update','PERMISSION'),
  ('order_addons','order_addons_owner','ALL','order_items:update','PERMISSION'),
  ('order_compliance_records','compliance_records_owner_select','SELECT','(dropped)','GONE'),
  ('order_items','order_items_owner','ALL','order_items:update','PERMISSION'),
  ('order_service_selections','order_service_selections_owner','ALL','order_service_selections:update','PERMISSION'),
  ('orders','orders_business_owner','SELECT','(dropped)','GONE'),
  ('plant_events','plant_events_business_owner','ALL','inventory:update','PERMISSION'),
  ('receipts','receipts_owner_all','ALL','(dropped)','GONE'),
  ('role_definitions','rd_owner_write','ALL','(account holder only)','OWNER_ID'),
  ('service_offerings','service_offerings_owner','ALL','(account holder only)','OWNER_ID'),
  ('social_drafts','social_drafts_business_owner','ALL','campaigns:update','PERMISSION'),
  ('vendor_preferences','vendor_preferences_owner_all','ALL','costs:update','PERMISSION'),
  ('businesses','businesses_owner_insert','INSERT','(account holder only)','OWNER_ID'),
  ('businesses','businesses_owner_select','SELECT','(account holder only)','OWNER_ID'),
  ('businesses','businesses_owner_update','UPDATE','(account holder only)','OWNER_ID')
),
mem(who, uid) AS (VALUES
  ('lauren', '790b31d2-7b65-45ec-953f-79855453a73e'::uuid),
  ('david',  '98f4e56b-cd27-4099-a9d8-5c8cbb63d00f'::uuid),
  ('joel',   '6f09038f-7966-49e3-b86a-1e3beb5e311f'::uuid)),
held AS (
  SELECT m.who, bm.active, bm.permissions FROM mem m
    LEFT JOIN public.business_members bm
           ON bm.user_id = m.uid AND bm.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74')
SELECT
  count(*) FILTER (WHERE p.kind = 'PERMISSION' AND h.who = 'lauren') AS permission_rows,
  count(*) FILTER (WHERE p.kind = 'PERMISSION' AND h.who='lauren'
                     AND NOT (coalesce(h.active,false) AND h.permissions ? p.perm)) AS lauren_refusals,
  count(*) FILTER (WHERE p.kind = 'PERMISSION' AND h.who='david'
                     AND NOT (coalesce(h.active,false) AND h.permissions ? p.perm)) AS david_refusals,
  count(*) FILTER (WHERE p.kind = 'PERMISSION' AND h.who='joel'
                     AND NOT (coalesce(h.active,false) AND h.permissions ? p.perm)) AS joel_refusals,
  count(*) FILTER (WHERE p.kind = 'PERMISSION' AND h.who='lauren' AND NOT EXISTS (
      SELECT 1 FROM pg_policies gp WHERE gp.schemaname='public' AND gp.tablename=p.tbl
        AND gp.policyname=p.pol
        AND (coalesce(gp.qual,'')||coalesce(gp.with_check,'')) LIKE '%'||p.perm||'%')) AS dead_permission_policies,
  count(*) FILTER (WHERE p.kind = 'GONE' AND h.who='lauren' AND EXISTS (
      SELECT 1 FROM pg_policies gp WHERE gp.schemaname='public' AND gp.tablename=p.tbl
        AND gp.policyname=p.pol)) AS surviving_dropped
  FROM plan p CROSS JOIN held h;
```

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
**Re-run the exact same block you pasted for CARD 1** — scroll up, it is inline there. Nothing about
it changes; the whole point is that the same query says something different once the migration is in.
Read both results.
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
