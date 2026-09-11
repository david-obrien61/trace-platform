# OWNER TEST — PMI: THE EQUIPMENT, ITS SCHEDULE, AND THE GENERATOR THAT WRITES IT

**Capability:** 5.2 Equipment PMI — `/pmi`, the schedule generator (`/api/pmi/suggest`), `business_pmi_schedule`, `business_service_log`
**Ledger:** #297 · **Branch:** `main` · **Rulings:** R-139 (the retired migration) · R-140 (usage recurrence required) · R-141 (the interval belongs on the task) · R-142 (a duty generates, a task is its instance) · R-131 (a task appears, no assignee)
**Tech-debt:** #261 (the endpoint checks no login) · #262 (`pmi:*` without `costs:read` sees nothing) · #263 (intervals the converter cannot read) · #264 (hour intervals have nowhere to live) · #265 (one cadence, and NO SCHEDULE beside real tasks)
**Last updated:** 2026-09-11
**Proven:** 0 of 10 · **Owed:** 9 · **needs-test:** 1

> Thunder never marks a card `covered`. Only David's live run does, with a date.
>
> 🔴 **RUN CARD 1 FIRST.** It is one paste into the SQL editor, it changes nothing, and it settles the question this whole board rests on: whether the three schedules point at real equipment.
>
> ⚠️ **Cards 1–8 David can run now. Cards 9 and 10 need another person's login** — they are at the bottom for that reason, not because they matter less.

---

## GATE 0 — IS THE THING YOU ARE TESTING ACTUALLY LIVE? (OP-15)

1. **Nothing in #297 changed app code.** It retired a migration that never ran and wrote documents. The UI cards test code that has been live for weeks.
2. **Still hard-refresh the tab** before a UI card. An open tab does not reload itself.
3. **No migration needs applying for this board.** `20260529_pmi_shared.sql` is retired — do **not** paste it; it is all comments now and would do nothing anyway.

---

## WHO IS WHERE — measured 2026-09-11, read-only

| Tenant | Who holds maintenance rights | Can they see the equipment? |
|---|---|---|
| **LAWNS Tree Farm** `ed2e5933` | OWNER (account holder — David) · OWNER (not account holder — Lauren) · **MANAGER** | Owners yes. 🔴 **The MANAGER no** — holds `pmi:read` + `pmi:update`, not `costs:read` |
| **Test Dave's Tree Nest** `f7ec5d67` | OWNER (account holder — David) · MANAGER | Both yes — this tenant's MANAGER role was given `costs:read` |

So: **the locked-list card (9) can only be reproduced at LAWNS.** At Test Dave's the manager sees everything and the card would prove nothing.

---

## A · DAVID CAN RUN THESE NOW

### CARD 1 — the three schedules point at real equipment, in their own business
**STATUS:** owed · **DEVICE:** desktop
**TENANT:** both (read-only) · **ACTOR:** David · **WHERE:** Supabase → SQL editor
**WHY:** the #297 prompt said no asset table exists and these three rows point at nothing. This card is the measurement that says otherwise.
1. Open the SQL editor. Paste and run:
```sql
select b.name as business, co.name as asset, co.make, co.model,
       jsonb_array_length(s.tasks) as tasks, s.interval_days, s.last_service_at,
       co.id is not null as asset_exists,
       co.business_id = s.business_id as same_tenant
  from business_pmi_schedule s
  join businesses b on b.id = s.business_id
  left join cost_objects co on co.id = s.asset_id
 order by s.created_at;
```
2. Expect **exactly 3 rows**, in this order:
   - Test Dave's Tree Nest · **Mahindra 4025 tractor** · Mahindra · 4025 · **11** tasks · 30
   - Test Dave's Tree Nest · **Craftsman CMXECXM331 air compressor** · Craftsman · CMXECXM331 · **8** tasks · 1
   - LAWNS Tree Farm, LLC · **tractor** · Kubota · L4802HST · **8** tasks · 30
3. Expect `last_service_at` empty on all three, and **`asset_exists` = true and `same_tenant` = true on all three.**
**FAIL LOOKS LIKE:** any `asset_exists` = false. That would mean the prompt's premise was right after all, R-139's correction is wrong, and a real orphan exists — **stop and tell Thunder.**

### CARD 2 — the retired migration created nothing, and both asset keys point at `cost_objects`
**STATUS:** owed · **DEVICE:** desktop
**TENANT:** none (catalog only) · **ACTOR:** David · **WHERE:** SQL editor
1. Paste and run:
```sql
select 'retired tables that must NOT exist' as what, count(*)::text as result
  from information_schema.tables
 where table_schema = 'public' and table_name in ('pmi_assets','pmi_service_logs')
union all
select conrelid::regclass::text || '.asset_id', pg_get_constraintdef(oid)
  from pg_constraint
 where contype = 'f'
   and conname in ('business_pmi_schedule_asset_id_fkey','business_service_log_asset_id_fkey');
```
2. Expect **3 rows**: the first reads **0**; the other two both read **`FOREIGN KEY (asset_id) REFERENCES cost_objects(id) ON DELETE CASCADE`**.
**FAIL LOOKS LIKE:** a count above 0 (someone ran the old file before it was retired), or a key pointing anywhere but `cost_objects`.

### CARD 3 — who can maintain equipment, and which of them can see it
**STATUS:** owed · **DEVICE:** desktop
**TENANT:** all (read-only) · **ACTOR:** David · **WHERE:** SQL editor
1. Paste and run:
```sql
select b.name as business, m.role,
       (b.owner_id = m.user_id) as account_holder,
       m.permissions ? 'pmi:read'   as pmi_read,
       m.permissions ? 'pmi:update' as pmi_update,
       m.permissions ? 'costs:read' as costs_read,
       m.active
  from business_members m
  join businesses b on b.id = m.business_id
 where m.permissions ? 'pmi:read' or m.permissions ? 'pmi:update'
 order by 1, 2;
```
2. Expect **6 rows**. The one that matters: **LAWNS Tree Farm, LLC · MANAGER · account_holder false · pmi_read true · pmi_update true · 🔴 costs_read FALSE · active true.**
3. Every other row reads `costs_read` true.
**WHAT THIS PROVES:** the hole in tech-debt #262 is in LAWNS's real data today, not a hypothetical. **Card 9 is what that person actually sees.**

### CARD 4 — what kind of interval each saved task has
**STATUS:** owed · **DEVICE:** desktop
**TENANT:** both (read-only) · **ACTOR:** David · **WHERE:** SQL editor
1. Paste and run:
```sql
select case
         when lower(trim(t->>'interval')) in ('daily','weekly','monthly','quarterly','annually')
           then '1 · calendar — gets a due date'
         when t->>'interval' ~* '\m(mile|miles|mi|hour|hours|hr|hrs|km|kilometer|kilometers)\M'
           then '2 · usage — no due date (R-140)'
         else '3 · calendar the converter cannot read (#263)'
       end as kind,
       count(*) as tasks,
       string_agg(distinct t->>'interval', ' · ') as intervals
  from business_pmi_schedule s
  cross join lateral jsonb_array_elements(s.tasks) t
 group by 1
 order by 1;
```
2. Expect **3 rows**:
   - `1 · calendar — gets a due date` · **15** · annually · daily · monthly · weekly
   - `2 · usage — no due date (R-140)` · **10** · every 100 hours · every 200 hours · every 400 hours · every 50 hours
   - `3 · calendar the converter cannot read (#263)` · **2** · every 2 years · every 3 months
**WHAT THIS PROVES:** R-140 is not an edge case — **10 of 27** real maintenance tasks cannot get a due date from a calendar.

### CARD 5 — LAWNS's tractor shows its eight tasks — and says NO SCHEDULE beside them
**STATUS:** owed · **DEVICE:** desktop or phone (no console)
**TENANT:** LAWNS · **ACTOR:** David, signed in to LAWNS · 🔴 **LOOK ONLY — do not press Suggest Schedule, Accept, Log Service or + Add on LAWNS**
1. Hard refresh. Open **`/pmi`**. Expect the heading **Equipment Registry**.
2. Expect six machines, among them **tractor** with *Kubota L4802HST* under it.
3. On the **tractor** card expect a grey chip reading **NO SCHEDULE**, and below it *"Every 30d"* and *"8 tasks scheduled"*.
4. Tap it. Under **PMI Task Checklist** expect eight tasks, starting *Check engine oil level — DAILY* and including *Replace hydraulic fluid and filter — EVERY 400 HOURS*.
**THIS CARD RECORDS A DEFECT, IT DOES NOT PASS ONE:** step 3's chip says there is no schedule directly above a line saying eight tasks are scheduled. The real state is *"no service logged yet"* (tech-debt #265). Mark it proven if you **see** that contradiction; it flips to a different expectation when #265 is fixed.
**FAIL LOOKS LIKE:** no tractor in the list (then Card 1 lied, or you are signed in to the wrong business), or the list is replaced by a lock (you are not signed in as an owner).

### CARD 6 — ask for a schedule on a machine that has none, then Discard — nothing is written
**STATUS:** owed · **DEVICE:** desktop
**TENANT:** Test Dave's · **ACTOR:** David, signed in to Test Dave's · 💲 **one billable AI call**
1. **Before:** paste and run in the SQL editor:
```sql
select co.name, co.make, co.model,
       count(s.id) as schedules,
       max(jsonb_array_length(s.tasks)) as tasks,
       max(s.interval_days) as interval_days
  from cost_objects co
  left join business_pmi_schedule s on s.asset_id = co.id
 where co.business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'
   and co.node_type = 'ASSET'
 group by co.id, co.name, co.make, co.model
 order by co.name;
```
   Expect 5 rows; the row **tractor · mako · 4045** reads **schedules 0**.
2. In the app: **`/pmi`** → tap **tractor** (*mako 4045* — not the Mahindra).
3. Under **PMI Task Checklist** press **✦ Suggest Schedule**. The button reads **Thinking…**.
4. Expect a blue-bordered box **REVIEW SUGGESTED SCHEDULE** listing tasks, each with its interval on the right. Any task measured in hours carries the orange line *"usage-based — no automatic due date"*.
5. Expect **Service every (days) — derived from the soonest task**, prefilled with a number.
6. Press **Discard**. The box closes and the checklist still reads *No tasks — click "Suggest Schedule" to generate with AI.*
7. **After:** run the step 1 query again. **tractor · mako · 4045 still reads schedules 0.**
**FAIL LOOKS LIKE:** a red error under the button (the call failed — note the words); or step 7 reads schedules 1 — **Discard wrote something, which is the defect the preview gate exists to prevent.**

### CARD 7 — Accept writes the tasks, and the cadence you typed rather than the one it suggested
**STATUS:** owed · **DEVICE:** desktop
**TENANT:** Test Dave's · **ACTOR:** David, signed in to Test Dave's · 💲 **one billable AI call** · **MUST BE TRUE FIRST:** Card 6 passed
1. On the same **tractor** (*mako 4045*) press **✦ Suggest Schedule** again. Count the tasks in the review box and write the number down.
2. Clear **Service every (days)** and type **45**.
3. Press **Accept schedule**. The box closes and the checklist now lists the tasks.
4. Run Card 6's query. **tractor · mako · 4045 reads schedules 1, tasks = your count, interval_days 45.**
5. Go back to the list. The **tractor** card reads *"Every 45d"*, *"N tasks scheduled"* — and the chip still reads **NO SCHEDULE** (tech-debt #265, as on Card 5).
**FAIL LOOKS LIKE:** interval_days reads the suggested number instead of 45 — the edit was not honoured; or tasks is empty.
**THIS CARD CANNOT PROVE:** that the saved row records 45 was typed rather than derived — **nothing does** (tech-debt #265).

### CARD 8 — the generator answers a caller who is not signed in
**STATUS:** needs-test · **DEVICE:** desktop
**TENANT:** none · **ACTOR:** —
**WHY NO RUNNABLE STEPS:** proving it means sending a request **with no session at all**, which is neither the SQL editor nor the app — the app always sends the signed-in user's context. The evidence today is the code: `packages/cultivar-os/api/pmi/suggest.ts` reads no `Authorization` header and checks no membership (tech-debt #261). **Owed:** a harness probe that posts with no token and expects a refusal — written **red first** against today's endpoint, so it is seen to fail before the fix lands (§6 r19).

---

## B · NEEDS A DESK VISIT — another person's login

### CARD 9 — LAWNS's manager opens `/pmi` and cannot reach a single machine
**STATUS:** owed · **DEVICE:** phone or desktop (no console)
**TENANT:** LAWNS · **ACTOR:** **Joel** — LAWNS's only MANAGER, active (measured 2026-09-11; Card 3 is his row) · 🔴 **not David, not Lauren: both are owners and see everything**
1. Signed in as that manager, open **`/pmi`**.
2. Expect a padlock and **"Equipment list hidden — cost-basis access required"**.
3. Expect **no machine to tap** — so no Log Service and no ✦ Suggest Schedule anywhere.
4. Read the paragraph under the padlock. It says *"Your maintenance schedule and service history above are complete and unaffected."* **Look above it. There is no schedule and no history** — only the heading and a **+ Add** button.
5. Press **+ Add**, fill in a name, press **Add Equipment**. Expect a red refusal (row-level security) — the manager cannot create a `cost_objects` row.
**THIS CARD RECORDS A DEFECT, IT DOES NOT PASS ONE (tech-debt #262):** this person holds maintenance rights at LAWNS and the screen gives them nothing to maintain, then describes content that is not there. Mark it proven if you see steps 2–5 as written. It gets a different expectation once David answers *who may see the equipment list without seeing what it cost*.
**FAIL LOOKS LIKE:** the machines are visible — then the manager's rights changed since 2026-09-11; re-run Card 3.

### CARD 10 — Lauren opens the LAWNS tractor and sees what David sees
**STATUS:** owed · **DEVICE:** phone or desktop (no console)
**TENANT:** LAWNS · **ACTOR:** **Lauren** (OWNER role, not the account holder) · 🔴 **LOOK ONLY** — no Suggest, Accept, Log Service or Add on LAWNS
1. Signed in as Lauren, open **`/pmi`**.
2. Expect the same six machines as Card 5, including **tractor** — *Kubota L4802HST*, *"8 tasks scheduled"*.
3. Tap it; expect the same eight tasks as Card 5 step 4.
**WHAT THIS PROVES:** that seeing equipment follows the permission she holds (`costs:read`), not the account-holder flag — the same line R-22 and R-119 draw. **FAIL LOOKS LIKE:** the padlock from Card 9, which would mean her real account lacks `costs:read` even though Card 3 says it holds it.

---

## WHAT THIS BOARD DOES NOT COVER

- **Logging a service** (`+ Log Service`, the PASS / NEEDS ATTN / FAIL result, the task checklist in the form). `business_service_log` is empty on every tenant; no card is written for it in #297 because #297 did not touch it. Owed with the task build.
- **The Kubota Hours link** — nothing exists to test (tech-debt #264).
- **Converting the two card lists to grids** — reported, blocked on tech-debt #157 (`docs/decisions/2026-09-07-vendors-pmi-card-lists-report.md`).
