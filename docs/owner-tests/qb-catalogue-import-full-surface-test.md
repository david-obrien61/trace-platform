# OWNER TEST — THE QUICKBOOKS CATALOGUE IMPORT: THE ADAPTER, THE APPLIER, THE RUN ID AND THE UNDO

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*

**Capability:** 2.3 / 5.1 (inventory) · **Ledger:** #277
**SHA THIS BOARD WAS WRITTEN AGAINST:** `0c277f2`. **`84bd7d5` (ledger #278, the customer import) is
a DESCENDANT of it and every card below still holds** — verified 2026-09-06: #278 added its own
modules and two router branches, touched none of `itemImportWriter.ts` / `qboItemAdapter.ts` /
`retiredFilter.ts` / any inventory reader, and my `items-preview` / `items-ingest` / `items-undo`
dispatch is intact at `router.ts:1091-1093`. On the merged tree: `npm run verify` **exit 0**,
232 probes green, **40/40 mutants caught**. ⚠️ **ONE CARD MOVED — CARD 22's stated REASON, not its
pass criterion.** See that card.

> 🔴 **BEFORE TUESDAY, READ THIS ONCE — IT IS ABOUT THE OTHER IMPORT, NOT THIS ONE.**
> **The customer import (#278) HAS NO UNDO ROUTE.** `undoCustomerImport` exists as a function with
> **zero HTTP reachability**: `customers:delete` is an UNMINTABLE verb (R2/A3), so there is no
> permission to gate the endpoint on, and #278's own guidance is *"import onto Test Dave's until
> David rules"* (its tech-debt #197).
>
> **So "import, look, wipe, reload" is TRUE OF THE CATALOGUE AND NOT YET TRUE OF THE CUSTOMERS.**
> If both are run on LAWNS on the day, half of it is reversible by button and half is not. That is
> a sequencing fact about the pair, and neither board says it alone.

**Story:** ⚠️ **OPEN — and I did not close it by inventing one.** `user_stories.md` has no heading
covering "import my product list out of my own accounting system". The nearest is the count-promotes
story, which is about walking a lot. **Recorded OPEN rather than papered over** (§9 story gate:
NO MATCH → a story is created first; this build was fired without one and says so).
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to
`covered`, with a date.**
**Board: 0 of 23 covered** (21 `owed` · 2 `needs-test`).
**TENANT:** LAWNS = `ed2e5933-45dc-4b9b-a331-ddfd125e7a74` · Test Dave's = `f7ec5d67-a9ef-4cb0-b807-438d67687d1b`.
**ACTOR:** the business OWNER on every card unless the card says otherwise. All three endpoints are
owner-gated (R-80) **and** require the verb permission — it is an AND, not an OR.

---

> 🔴 **THE UNDO IS THE THING BEING TESTED, NOT THE IMPORT. DAVID'S WORDS: *"If the wipe does not
> bring the tenant back clean, Tuesday does not happen."*** An import that works once is a demo; an
> import you can take back is a thing a customer can be handed. **The five cards that test the
> undo, in the order they must be run:**
>
> | | Card | What it proves |
> |---|---|---|
> | 1 | **CARD 5** | The whole loop — import, wipe, verify — on **Test Dave's FIRST**. R-97 permits a LAWNS rehearsal *because* the undo makes it restorable, and at that moment the undo has never met real data. |
> | 2 | **CARD 10** | 🔴 **THE WIPE.** 647 deleted, 447 un-retired, `leftovers` **empty**, receipts 111/111 and deliveries 31/31 before and after. |
> | 3 | **CARD 11** | 🔴 **THE RE-RUN.** Twice must not mean double — 647 again, not 1,294. |
> | 4 | **CARD 15** | The unique index **actually refuses** a duplicate. This is what makes CARD 11 believable rather than lucky, and it can only run after an import. |
> | 5 | **CARD 12** | The undo **REFUSES** once QuickBooks writes are on. |
>
> **CARD 23 is the closing sequence** — wipe, reload clean, writes on — the one you will actually
> perform on the day. It is last because it **deliberately closes the undo**.
>
> ⚠️ **CARD 10 step 4 is the one to read slowly.** `leftovers` being empty is a STRONGER claim than
> `inventoryDeleted: 647`, because under RLS a **refused** delete returns no error and zero rows —
> indistinguishable, to the caller, from "there was nothing to delete". The undo re-reads the tenant
> afterwards and counts what still carries the run id. A count of zero deleted with an empty
> `leftovers` is a clean tenant; a count of zero with a non-empty one is a refusal.

> ✅ **MIGRATION GATE — CLEARED 2026-09-06. ALL THREE APPLIED. CARDS 5–22 ARE NO LONGER BLOCKED.**
> David ran them in the SQL editor and returned the catalog. All three columns on
> `business_inventory` (`import_run_id` uuid · `qb_item_id` text · `retired_by_run_id` uuid) are
> **nullable with no default**, and **447 rows carry zero of them** — applying the migration
> stamped nothing, which is the check that matters (a migration that quietly wrote rows would be
> indistinguishable from the build working). `customers.import_run_id` likewise: **30 rows, 0
> stamped.** Both provenance indexes are PARTIAL; **both unique indexes are UNIQUE and NON-PARTIAL.**
>
> ✅ **AND R-93 IS VISIBLY INTACT IN THE CATALOG:** `business_inventory` carries exactly two
> triggers — `business_inventory_unit_projection` and `business_inventory_updated_at` — **neither
> of which emits a ledger row.** A plain INSERT stays undoable. That is the premise the whole test
> mode rests on, and it is now confirmed against the database rather than against the corpus.
>
> ✅ **DAVID SKIPPED `20260906c`'s BEFORE CHECKS AND HE WAS RIGHT TO.** His reasoning, verbatim:
> *"both unique indexes created WITHOUT ERROR, which is itself the proof there were no duplicates —
> an index cannot build over them."* **That is correct and it is the stronger proof**, not a
> shortcut: `CREATE UNIQUE INDEX` fails loudly on a duplicate, so a successful build IS the
> zero-duplicate assertion. The BEFORE queries only ever bought a friendlier error message.
> ⚠️ **One nuance worth knowing for next time, and it does not apply here:** `IF NOT EXISTS`
> matches on the index NAME alone, so had an index of that name already existed with different
> columns or without UNIQUE, the statement would have been **silently skipped** and proven nothing.
> The catalog paste rules that out — both are `UNIQUE (business_id, qb_item_id)` and
> `UNIQUE (business_id, qb_customer_id)` as written.
>
> ✅ **THE NULLS-ARE-DISTINCT PROOF IS ALREADY IN HIS PASTE: 11 customers with a NULL
> `qb_customer_id`, 447 inventory rows with a NULL `qb_item_id`.** Both far greater than one, under
> unique indexes that committed — so NULLS DISTINCT is confirmed, and CARD 16 is satisfied by the
> apply itself.
>
> 🔴 **STILL OWED, AND DAVID NAMED IT HIMSELF: the duplicate-refusal probe is a NO-OP TODAY.** No
> row carries a `qb_item_id` yet, so the SELECT returns nothing and the INSERT proves nothing. **It
> is CARD 15**, which already says exactly that in its own preamble and runs AFTER the first
> import. *An index nobody has watched refuse is a claim.*

> ⚠️ **WHAT THIS BUILD DOES NOT DO, STATED SO A MISSING THING IS NOT READ AS A BROKEN THING.**
> There is **no screen**. The three endpoints are reachable by URL (`/api/qbo/items/preview`,
> `/api/qbo/items/ingest`, `/api/qbo/items/undo`) and every card below drives them with `curl` or
> the SQL editor. **The customer merge is deliberately OUT** (§5 — it waits on a `customer_qb_links`
> join table, because one local customer can map to two QuickBooks ids and `qb_customer_id` is
> single-valued). **No `api/` function was minted** — 12/12 held; these are branches on the router
> that already exists. **No new permission string.**

> 🔴 **BEFORE CARD 5, SET THE HOLD, OR THE UNDO IS CLOSED AND YOU CANNOT WIPE.**
> `QBO_PUSH_HOLD` must be set in Vercel to `all` or to `ed2e5933-45dc-4b9b-a331-ddfd125e7a74`.
> Confirm it from `/api/qbo/status` (`push_held: true`) — **reading it there is the check; trusting
> that the env var propagated is not.** This is the same switch that already protects their books.

---

## CARD 1 — the preview reads the item list and writes nothing
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Signed in as the LAWNS owner, open the browser console on `cultivar-os.app` and run:

```js
const r = await fetch('/api/qbo/items/preview?business_id=ed2e5933-45dc-4b9b-a331-ddfd125e7a74', {
  headers: { Authorization: 'Bearer ' + (await window.supabase.auth.getSession()).data.session.access_token }
});
console.log(await r.json());
```

1. It returns `ok: true`.
2. `adapted.counts.readIn` is **685**.
3. `adapted.counts.categories` is **38**.
4. `adapted.counts.sellable` is **647**.
5. `wouldRetire` is **447**.
6. `wouldCreate` is **647**.

**PASS:** all six numbers match, and `committed` is `false`.
**FAIL:** any number differs — **write down which one**, because each names a different thing that
moved. `readIn ≠ 685` means their item list changed since 4 September and every other number below
should be re-derived rather than compared. `categories ≠ 38` means the folder filter is wrong.

---

## CARD 2 — 🔴 THE ONE THAT WOULD HAVE COST THE MOST: nothing was silently dropped
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
On the same response, read `adapted.collisions`.

1. `adapted.counts.collidingItems` is **24** (twelve pairs).
2. `adapted.counts.collisionsWithPriceDifference` is **7**.
3. Find the entry whose members are Ids **753** and **75**. Its `reason` names **both prices**.

**PASS:** `wouldCreate` (647) equals `adapted.counts.sellable` (647) — **every sellable item became
a row**, and the twelve collisions are reported rather than resolved.
🔴 **Read the sentence, do not just check the count.** For Lacey Oak 30 Gallon it must say
**$900** and **$350** — a $550 gap on one product name. Before this build the create loop kept
whichever came first, which for Lacey Oak 45 Gallon meant keeping **$375** and dropping **$1,250**.
There was no finding, no count, and nothing on screen.
**FAIL:** `wouldCreate` is less than `sellable` (something was dropped), or the reason says only
that a collision exists without naming what it costs.

---

## CARD 3 — the three size states, and the fertiliser rows tell the truth
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Same response:

1. `adapted.counts.sized` is **536**.
2. `adapted.counts.notStated` is **75**.
3. `adapted.counts.couldNotRead` is **36**.
4. 536 + 75 + 36 = **647** — the three states partition the catalogue exactly.
5. Find the item whose `sourceDescription` is `"Bermuda sod by the pallet, 450 sq. ft."`. Its
   `sizeState` is **`could_not_read`** and its `unreadSizeText` is **`450 sq. ft`**.
6. Find `"Deer Fencing"`. Its `sizeState` is **`not_stated`**.

**PASS:** steps 5 and 6 report **different** states.
🔴 **That difference is the card.** "We read it and there is no size" and "we found something that
looked like a size and could not interpret it" are different facts about somebody else's books, and
collapsing them would tell Lauren her fertiliser has no size when the truth is that we could not
read the one it has.
**FAIL:** both read the same, or `couldNotRead` is 0 (nothing is ever refusing, which means the
parse is guessing).

---

## CARD 4 — 🔴 the size that would have been confidently WRONG
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
In the same response find the item whose name is `SRO300`.

1. Its `size` is **`300gal`**.
2. Its `sizeState` is **`sized`**.
3. Its `name` is **`Shumard Red Oak`**.

**PASS:** the size is `300gal`.
🔴 **Before this build it read `48" Box`** — because the description is
`"Shumard Red Oak - 300gal (48" Box)"`, the scan reached the trailing parenthetical first, and
`box` is a real container unit. Not a refusal, not a blank: **a 300-gallon tree recorded as a
48 box.** It was found by a mutation harness, not by reading. Two Yaupon Hollies had the same shape
with a height remark and were refused outright when their size was plainly stated.
**FAIL:** the size is `48" Box)`, or `(48" Box)` is still on the end of the name.

---

## CARD 5 — the rehearsal happens on Test Dave's FIRST
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
🔴 **Do this one before CARD 6. R-97 permits a rehearsal on LAWNS *because the undo makes it
restorable* — and the undo has never been run against real data at this point.**

Run CARD 1's preview against `business_id=f7ec5d67-a9ef-4cb0-b807-438d67687d1b`, then the ingest
(CARD 6's shape) and the undo (CARD 10's shape) against that tenant.

1. Test Dave's has **130** inventory rows, so `wouldRetire` is 130, not 447.
2. The ingest creates 647 and retires 130.
3. The undo deletes 647 and un-retires 130.
4. Re-query: Test Dave's is back to **130** rows, none retired.

**PASS:** the tenant is byte-for-byte back where it started.
**FAIL:** any residue at all. **STOP — do not run CARD 6 on LAWNS.**

---

## CARD 6 — the import runs on LAWNS and reports what it did
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
🔴 **Write the run id down before you do anything else. The undo needs it and nothing else
recovers it except a query.**

```js
const r = await fetch('/api/qbo/items/ingest?business_id=ed2e5933-45dc-4b9b-a331-ddfd125e7a74', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + (await window.supabase.auth.getSession()).data.session.access_token }
});
const out = await r.json(); console.log(out.runId, out.created, out.retired, out.undoable);
```

1. `created` is **647**.
2. `retired` is **447**.
3. `committed` is `true`.
4. 🔴 `undoable` is **`true`**. If it is `false` the push hold is not set — **the import has
   landed and you cannot wipe it.** Fix the env var before going further.

**PASS:** 647 created, 447 retired, `undoable: true`, and you have the run id written down.
**FAIL:** `stoppedAt` is `'create'` (nothing was retired — the old catalogue is intact, run the
undo with the run id in the response and look at the error) or `'retire'` (both catalogues are
live — 1,094 rows; the undo removes the 647 it made).

---

## CARD 7 — 🔴 THE ONE QUERY THAT PROVES THE RETIRE WAS COMPLETE
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
SQL editor:

```sql
SELECT count(*) FROM public.business_inventory
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND retired_at IS NULL
   AND import_run_id IS DISTINCT FROM '<the run id>';
```

**EXPECT: 0.**

**PASS:** zero.
🔴 **This is R-94 in one query, and it is worded this way on purpose.** The retire is scoped
`business_id` + `retired_at IS NULL`, **not** a 447-row id list from a snapshot — Lauren is
uploading all weekend and a snapshot can go stale between the plan and the apply. So the assertion
is "nothing that is not this run's own work is still live", which stays true however many rows she
added in between.
**FAIL:** any non-zero count. Those rows are what the retire could not reach.

---

## CARD 8 — the two counted rows retired too, and that was the ruling
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

```sql
SELECT name, size, qty, retired_at IS NOT NULL AS retired
  FROM public.business_inventory
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND qty > 0 AND import_run_id IS NULL;
```

1. Two rows: **Brodie Juniper 30 gallon** and **Arizona Cypress, Blue Ice 30 gallon**, qty **1** each.
2. `retired` is **true** on both.

**PASS:** both retired, both still present with their qty intact.
🔴 **The count is not destroyed, it is HIDDEN — that is the whole difference.** R-94 retires them
because they are your widget-test data, one tree apiece; R-70 clause ① still forbids ever deleting
them. If you decide tomorrow that a count mattered, `retired_at` is a timestamp you can clear.
⚠️ **Both R-58 and R-70 say "four of the 447 carry a real count". It is two.** Corrected this pass.
**FAIL:** either row is missing, or its `qty` is now 0.

---

## CARD 9 — 🔴 THE CARD LAUREN ACTUALLY SEES: the catalogue is clean
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Open `/inventory` as the LAWNS owner. Hard-refresh first.

1. The grid shows **647** rows, not 1,094.
2. Search for `Lacey Oak`. **Two 30-gallon rows appear**, one at $900 and one at $350.
3. Search for `Brodie Juniper`. The `30 gallon` row with qty 1 is **NOT** there.

**PASS:** 647 rows.
🔴 **Step 1 is the point of the whole reader-side filter, and until this build nothing in the app
read `retired_at` at all** — the column shipped on 3 September with exactly one consumer (the uppot
planner), so retiring 447 rows would have left all 447 sitting on this screen.
🔴 **Step 2 is R-96 on screen.** Two rows for one name looks like a defect and is the opposite of
one: QuickBooks holds two separate products under that name at a $550 gap, and neither was chosen
for you. **If you would rather see one, that is a decision — say which, and it becomes a ruling.**
**FAIL:** ~1,094 rows (the filter is not applied anywhere), or only one Lacey Oak 30-gallon row
(something is still deduping silently).

---

## CARD 10 — 🔴 THE WIPE. This is the promise, and it must be exact.
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
🔴 **Count the receipts and the deliveries BEFORE you press it**, so the after-numbers are compared
against something you read rather than something this file claims:

```sql
SELECT (SELECT count(*) FROM public.receipts   WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS receipts,
       (SELECT count(*) FROM public.deliveries WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS deliveries;
```
Expected today: **111** and **31**. Then:

```js
const r = await fetch('/api/qbo/items/undo?business_id=ed2e5933-45dc-4b9b-a331-ddfd125e7a74&run_id=<the run id>', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + (await window.supabase.auth.getSession()).data.session.access_token }
});
console.log(await r.json());
```

1. `inventoryDeleted` is **647**.
2. `unretired` is **447**.
3. `customersDeleted` is **0**.
4. `leftovers` is an **empty array**.
5. `receiptsBefore`/`receiptsAfter` are **111 / 111**; `deliveriesBefore`/`deliveriesAfter` are **31 / 31**.
6. `ok` is `true`.
7. Re-run CARD 9: `/inventory` shows **447** rows again, and Brodie Juniper is back.

**PASS:** all seven.
🔴 **Step 4 is stronger than step 1 and it is the reason this card can be trusted.** Under RLS a
**refused** delete returns no error and zero rows — indistinguishable, to the caller, from "there
was nothing to delete". So the undo re-reads the tenant afterwards and counts what still carries
this run id. An empty `leftovers` means it actually landed; a non-empty one names what did not.
🔴 **Step 5 matters even though nothing in the undo can reach those tables.** They carry no run id,
so they are outside the delete by definition — and "cannot happen by construction" is how several
silent failures were described just before they happened. **13 of those 31 deliveries are scheduled
after today** (measured 2026-09-06; an earlier read said 3).
**FAIL:** `customersDeleted` is anything but 0 — **stop and look**, nothing should have created a
customer. Or `receiptsAfter ≠ 111` — stop entirely, something reached a table it cannot reach.

---

## CARD 11 — 🔴 THE RE-RUN. Twice must not mean double.
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Immediately after CARD 10, run CARD 6 again — a second import, a **new** run id.

1. `created` is **647** again, not 1,294.
2. `retired` is **447** again.
3. CARD 7's query returns **0** with the NEW run id.
4. `/inventory` shows **647**.

**PASS:** the second run reproduces the first exactly.
🔴 **This is what the unique index on `(business_id, qb_item_id)` is for.** Without it a second run
would create a second row per QuickBooks item and the catalogue would double. The index makes
re-runnability a database guarantee rather than a property of the code remembering what it did.
**FAIL:** ~1,294 rows, or the ingest errors on a duplicate key — the second means the first run's
rows were not deleted and CARD 10 lied.

---

## CARD 12 — 🔴 THE UNDO REFUSES WHEN WRITES ARE ON
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
🔴 **Run a fresh import first (CARD 6) so there is something to refuse to delete.** Then remove
`ed2e5933-…` from `QBO_PUSH_HOLD` in Vercel (or clear it), redeploy, confirm `/api/qbo/status`
reports `push_held: false`, and call the undo with the run id.

1. HTTP **409**, not 500 and not 200.
2. `refused` is `true`.
3. `error` says invoices may already have been sent and that **nothing was changed**.
4. Re-query: the 647 rows are **still there** and the 447 are **still retired**.

**PASS:** refused, and nothing moved.
🔴 **This is the whole safety model in one control.** The switch that turns QuickBooks writes on is
the switch that closes the undo — one control, not two, and it is the hold that already protects
their books rather than a second mechanism that could disagree with it.
⚠️ **RESTORE THE HOLD AFTERWARDS** and confirm it from `/api/qbo/status` before doing anything else.
**FAIL:** the undo proceeds. That is the one outcome that can destroy something real.

---

## CARD 13 — a MANAGER cannot run any of the three
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Sign in as the LAWNS **manager** and call all three endpoints.

1. Preview: **403**.
2. Ingest: **403**, `code: 'OWNER_ONLY'`.
3. Undo: **403**.

**PASS:** all three refused.
🔴 **R-80: importing a company's books is an owner act, the same class as the writes switch.**
⚠️ **The verb permission is an AND, not an OR** — an owner who somehow lacked `inventory:create`
would still be refused by it. And the undo additionally needs `inventory:delete`, which the manager
floor does not hold (measured: `20260727_align_floor_to_bundles.sql:48`).
**FAIL:** any of the three returns 200. Note **which**, because preview leaking is a different
severity from ingest leaking.

---

## CARD 14 — 🔴 the cross-tenant negative control
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
As the **LAWNS** owner, call the ingest with **Test Dave's** business id
(`f7ec5d67-a9ef-4cb0-b807-438d67687d1b`).

1. **403.**
2. Then query Test Dave's: its inventory row count is unchanged (130, or whatever CARD 5 left).

**PASS:** refused, and Test Dave's is untouched.
🔴 **AC-3 is absolute — cross-vertical resolution returns no-access, never a wrong-tenant record.**
This runs against the *live* endpoint rather than a probe because `callerIsBusinessOwner` compares
`businesses.owner_id`, and the only way to know it is wired is to be refused by it.
**FAIL:** a 200. Stop and do not run anything else.

---

## CARD 15 — the unique index actually refuses a duplicate
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
🔴 **Run this only after an import has put `qb_item_id` values in the table** — before that the
SELECT returns no rows and the INSERT is a silent no-op that proves nothing.

```sql
BEGIN;
  INSERT INTO public.business_inventory (business_id, name, qty, qb_item_id)
  SELECT business_id, 'DUP PROBE — ROLL THIS BACK', 0, qb_item_id
    FROM public.business_inventory
   WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND qb_item_id IS NOT NULL LIMIT 1;
ROLLBACK;
```

**EXPECT: `ERROR: duplicate key value violates unique constraint
"business_inventory_business_qb_item_uidx"`.**

**PASS:** the error fires, and you rolled back.
🔴 **A unique index nobody has watched refuse is a claim.** This is the one card that makes CARD 11
believable rather than lucky.
**FAIL:** the insert succeeds — `20260906c` did not apply, and re-running the import will double
the catalogue.

---

## CARD 16 — the NULLS-ARE-DISTINCT proof
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

```sql
SELECT (SELECT count(*) FROM public.customers
         WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND qb_customer_id IS NULL) AS cust_null,
       (SELECT count(*) FROM public.business_inventory
         WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND qb_item_id IS NULL) AS inv_null;
```

**EXPECT: 11 and 447** (the 447 before an import; after one, the retired rows).

**PASS:** both greater than 1.
🔴 **That the migration COMMITTED is itself the proof** — under a unique index treating NULLs as
equal, eleven customers sharing a NULL would have made `20260906c` fail. This query states the
numbers it survived, which is why the index needs no `WHERE … IS NOT NULL` predicate and why
tech-debt #54's proposed partial form was declined.
**FAIL:** either is 0 or 1 — the proof is vacuous and you have learned nothing.

---

## CARD 17 — a retired product cannot be SOLD
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
With an import live (after CARD 6), start a new order and search the picker for `Brodie Juniper`
(a retired row, qty 1).

1. It is **not offered**.
2. Search for a product that IS in the new catalogue — it is offered normally.

**PASS:** the retired lot is unreachable from the order picker and the live one is not.
🔴 **This is the half a grid filter alone would have missed.** Hiding a product on the catalogue
screen while a scan or a search still resolves it is the worse half of both worlds — a sale against
a lot Lauren cannot see. The filter lives in `stockLineResolver`, which the picker, the scanner and
the count walk all call.
**FAIL:** it appears. Note whether it came from the scan, the search or the type-ahead.

---

## CARD 18 — a retired product cannot be COUNTED
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
On a phone, open the count walk and try to count `Brodie Juniper`.

1. The lot is not offered and is not resolved by a scan of its tag.

**PASS:** the retired lot does not appear in the walk.
🔴 **DEVICE: phone, and provable without a console** — the capture loop happens in a lot, and a
check that needs DevTools never gets run there.
**FAIL:** it resolves. A count landing on a retired lot revives it into use with no trace.

---

## CARD 19 — the inventory VALUE does not count hidden rows
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
With an import live, open the dashboard as the owner and read the inventory tile.

1. The value and the plant count reflect the 647 live rows only.

**PASS:** the numbers move when the catalogue is replaced, and do not include retired rows.
⚠️ **At LAWNS today this is a weak card and that is stated rather than hidden:** every retired row
has qty 0, so the value is arithmetically identical either way. It is here because the filter is
correct in principle and the next tenant will have counted stock. **Mark it `covered` only if you
can see the row count change.**
**FAIL:** the count still reads ~1,094.

---

## CARD 20 — nothing wrote to the ledger
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
🔴 **Read the ledger count BEFORE CARD 6 and again after.**

```sql
SELECT count(*) FROM public.business_inventory_ledger
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
```

**EXPECT: the same number both times** (456 as of 2026-09-06).

**PASS:** identical.
🔴 **This is R-93, and it is the reason the import does not reuse `importWrites.ts`.** That path
creates a row via `count_promote_create_inventory`, which emits an `opening_balance` ledger row —
647 of them per run, in an **append-only** table whose trigger rejects even `postgres` and from
which `service_role` is REVOKEd (probed 2026-09-06: read 206, UPDATE **403 / 42501**). The undo
could never remove them, and each wipe-and-reload would leave permanent sediment. **In test mode
this import writes no ledger rows. The ledger begins when writes go on.**
**FAIL:** the count grew. The import is on the RPC path and the undo is not complete — **stop
before running CARD 11**, because every re-run adds more.

---

## CARD 21 — the front-loaded sizes are a KNOWN gap, not a surprise
**STATUS:** needs-test · **DEVICE:** desktop · **LAST-PROVEN:** —
**REASON IT IS `needs-test`:** there is no pass criterion yet because the decision has not been
made. In CARD 1's response, find `"50lb Bag: Micromax Granular Micronutrients"`.

1. Its `sizeState` is **`not_stated`**.
2. Roughly 30 items share that shape — fertiliser, compost and bags whose size is at the **front**
   of the description rather than the end.

**This is recorded, not repaired.** The extraction reads a size from the END of a description,
because that is where 536 of them are. A front-loaded size is a real shape in this catalogue and
this adapter does not read it. It reports `not_stated`, which is honest and incomplete.
**DAVID'S CALL:** is `50lb` the size of a bag of Micromax, or is `each` the size and 50lb a
property of it? The answer decides whether this is a parser change or a data question, and I did
not pick one. Tech-debt **#193**.

---

## CARD 22 — the customer half of the undo, when it exists
**STATUS:** needs-test · **DEVICE:** desktop · **LAST-PROVEN:** —
**REASON IT IS `needs-test`:** it cannot be proven by THIS build, and the reason changed under it.

✏️ **CORRECTED 2026-09-06 — THE ORIGINAL REASON IS NOW HALF FALSE.** It said *"`customers.import_run_id`
is NULL on all 30 rows because the customer merge is deliberately out of this build."* The column now
has a writer: **ledger #278's customer import (`customerImportWriter.ts:156`) stamps it on every
customer it CREATES** — and deliberately not on the narrow UPDATE that reconciles the 19 pre-existing
QuickBooks-linked rows, because a PostgREST upsert would have stamped those too and its own undo
would then have deleted real customers.

🔴 **CARD 10 STEP 3 IS STILL CORRECT AND STILL MEANINGFUL, AND THE REASON IS THE RUN ID.** A run id
is a fresh uuid per run, so a customer created by the customer import carries the CUSTOMER run's id
and can never match the ITEM run's id. `customersDeleted: 0` on CARD 10 remains the right expectation
no matter how many customer imports have happened first.

⚠️ **AND THE HAZARD THAT DOES EXIST IS A HUMAN ONE, NOT A CODE ONE: two undos, two run-id
namespaces, one uuid shape.** Handing `items-undo` a CUSTOMER run id deletes those customers and
reports `inventoryDeleted: 0, unretired: 0, ok: true` — which reads as *"an item import that made
nothing"* rather than as *"you undid the other import"*. It is not destructive (it performs the same
delete the customer undo would) but it is **misreported**. Keep the two run ids labelled.

**What this card becomes:** the day `customers:delete` is ruled and the customer import gets its own
undo route, prove that each undo touches only its own run. Until then a green check here would
assert a proof nobody performed.

**What this card becomes the day the merge lands:** import customers, undo, and confirm the run's
customers are gone while every hand-made customer and every previous run's customer survives.
Until then a green check here would assert a proof nobody performed.

---

## CARD 23 — 🔴 THE CLOSING SEQUENCE: wipe, reload clean, writes on
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
🔴 **RUN THIS LAST. IT DELIBERATELY CLOSES THE UNDO, AND AFTER IT THERE IS NO GOING BACK BY BUTTON.**
This is the sequence you actually perform on the day, after Lauren has finished experimenting.

1. **WIPE.** Run CARD 10 with the run id from her session. Confirm `leftovers` is empty and
   `/inventory` is back to **447**.
2. **RELOAD CLEAN.** Run CARD 6 once more — a fresh run id, 647 created, 447 retired. Write the new
   run id down. **This is the catalogue that becomes permanent.**
3. **LOOK BEFORE YOU LATCH.** Re-run CARD 9 (647 rows), CARD 2's collision list, and spot-check the
   sizes on CARD 3's numbers. **This is the last moment the undo is open.**
4. **WRITES ON.** Remove LAWNS from `QBO_PUSH_HOLD` in Vercel, redeploy, and confirm
   `/api/qbo/status` reports **`push_held: false`** — read it there, do not trust that the env var
   propagated.
5. **CONFIRM THE UNDO IS NOW CLOSED.** Call the undo with the run id from step 2.
   **EXPECT HTTP 409, `refused: true`, and the catalogue untouched.**

**PASS:** step 5 refuses, and `/inventory` still shows the 647.
🔴 **Step 5 is not a formality — it is the only thing that proves the safety model is a MECHANISM
and not a habit.** Up to step 4 the undo has been open every time you pressed it; step 5 is the
first time it must say no. If it proceeds, the switch is not wired to the door and a later
mis-click deletes rows behind invoices you have already sent.
⚠️ **If you need to change the catalogue after this point, it is a normal edit or a new import —
not an undo.** That is the trade you are making at step 4, deliberately.
**FAIL:** step 5 returns 200 — **stop, and re-set `QBO_PUSH_HOLD` immediately.** Or step 2's re-run
creates ~1,294 rows, which means step 1's wipe did not land and CARD 10 lied.
