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
**Board: 2 of 33 covered** (29 `owed` · 2 `needs-test`) — CARD 5 and CARD 14a proven live 2026-09-07. *(CARD 14 split into 14a READ / 14b WRITE — they are refused by different gates and only the read half was proven.)*
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
> | 1 | **CARD 5** | 🔴 **THE MECHANISM, on Test Dave's — 1 item in, 1 out, 130 rows restored with all 25 counts.** Not the scale: Test Dave's realm holds ONE item, and the original card conflated it with LAWNS's 647. Every moving part runs; LAWNS is then the scale test, with the undo already proven. |
> | 2 | **CARD 10** | 🔴 **THE WIPE.** 647 deleted, 447 un-retired, `leftovers` **empty**, receipts 111/111 and deliveries 31/31 before and after. |
> | 3 | **CARD 11** | 🔴 **THE RE-RUN.** Twice must not mean double — 647 again, not 1,294. |
> | 4 | **CARD 15** | The unique index **actually refuses** a duplicate. This is what makes CARD 11 believable rather than lucky, and it can only run after an import. |
> | 5 | **CARD 12** | The undo **REFUSES** once QuickBooks writes are on. |
>
> **CARD 23 is the closing sequence** — wipe, reload clean, writes on — the one you will actually
> perform on the day. It is last because it **deliberately closes the undo**.
>
> 🔴 **AND CARDS 24–33 ARE PART TWO: THE SAME LOOP THROUGH THE BUTTON.** Cards 1–23 proved the
> mechanism through console calls, which is a work-around and not the path Lauren takes. The
> surface builds the request, holds the run id, renders the counts and decides when to offer the
> undo — **none of which cards 1–23 touch.** Run PART TWO before she does.
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

> ✅ **GATE 1 — CLOSED 2026-09-06, AND IT NEEDED A CODE FIX, NOT AN ENV VAR.**
>
> **This gate originally said: set `QBO_PUSH_HOLD` in Vercel and confirm `push_held: true`.
> THAT WAS WRONG, and David found it by asking which switch `undoable` reads.**
>
> There are **TWO** switches and they belong to different people:
> - **`QBO_PUSH_HOLD`** (env) — the OPERATOR's deploy-wide hold. David's.
> - **`businesses.qbo_writes_enabled`** (`20260902…:65`, NOT NULL DEFAULT false) — **the OWNER's own
>   decision.** It is what the Test Mode switch flips, what the TEST MODE banner reads, and what
>   `api/orders/submit.ts:856` gates the real checkout push on. **LAWNS = `false` today.**
>
> 🔴 **The first build read only the env var.** At LAWNS — owner's switch OFF, env unset — it
> computed `undoable: false` and **the undo refused in exactly the state it exists to serve.** The
> gate is now `!pushPermitted({ writesEnabled, platformHeld })`, the predicate that already existed
> in `business-logic/testMode.ts` and whose own header says *"Either one saying no means no."*
>
> **WHAT TO DO NOW: nothing. Set no env var.** LAWNS is in test mode, so the undo is open.
>
> **CHECK IT LIKE THIS —** `/api/qbo/status` now reports all three:
> ```
> push_held:        false   ← the operator's env hold (unset, and that is fine)
> writes_enabled:   false   ← the OWNER's switch. THIS is the one that matters.
> writes_permitted: false   ← the two, AND-ed once. false = nothing reaches their books
> ```
> 🔴 **`writes_permitted: false` IS GATE 1.** It is the same predicate the undo uses, read from the
> same deployment, so if it says false the undo is open. **Read it; do not assume it.**
> ⚠️ **`push_held` alone is NOT the check and never was** — it was the only field this endpoint
> reported before today, which is why the question could not be answered from it.
>
> ⚠️ **AND IF THE STATUS READ FAILS, THE UNDO REFUSES** — with a sentence saying *we could not
> check*, deliberately worded differently from *you are live*. A person who cannot tell those two
> apart acts on the wrong one.

---

> 🔴 **RUN THIS FIRST IN THE CONSOLE — EVERY CARD BELOW USES `T`.**
>
> ✏️ **CORRECTED 2026-09-07: the original snippet on this board called
> `window.supabase.auth.getSession()` AND IT THROWS.** The client is module-scoped —
> `packages/shared/src/supabase/client.ts` exports it and **nothing assigns it to `window`** —
> so every card needing a token was unrunnable as written. David found it by getting a token out of
> localStorage himself. The session lives under supabase-js's default key,
> `sb-<project-ref>-auth-token`; this reads it without hardcoding the ref.
>
> ```js
> const K = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
> if (!K) throw new Error('No Supabase session in localStorage — are you signed in on THIS origin?');
> const T = 'Bearer ' + JSON.parse(localStorage.getItem(K)).access_token;
> const LAWNS    = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
> const TESTDAVE = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
> ```
>
> ⚠️ **Run it on the SAME ORIGIN you are testing** (`cultivar-os.app`), signed in as the owner —
> localStorage is per-origin, and a token from a different origin will 401 in a way that reads like
> a permission bug.

---

## CARD 1 — the preview reads the item list and writes nothing
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Signed in as the LAWNS owner, open the browser console on `cultivar-os.app` and run:

```js
const r = await fetch('/api/qbo/items/preview?business_id=ed2e5933-45dc-4b9b-a331-ddfd125e7a74', {
  headers: { Authorization: T }
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

1. `adapted.counts.collidingItems` is **22** (eleven pairs).
2. `adapted.counts.collisionsWithPriceDifference` is **6**.
3. `adapted.collisions.length` is **11**.
4. Find the entry whose members are Ids **753** and **75**. Its `reason` names the **product** and
   **both prices**.

> ✏️ **CORRECTED 2026-09-07, AND THE STALE NUMBERS HERE CAUSED A FALSE ALARM.** This card said
> **24** and **7**. The true figures are **22** and **6** — I measured 12 groups / 24 / 7 before
> adding the trailing-parenthetical strip (which fixed `SRO300` and two Yaupon Hollies) and **never
> re-measured**. David read 22/6 off a live run against a board asserting 24/7, found a real
> colliding pair on the Inventory screen, and reasonably concluded the detector was under-counting.
> **It was not. The board was.** R-26's shape — a written declaration nobody checked against
> reality, steering a decision — in my own card. Tech-debt #204.

**Here are all eleven, so nothing has to be inferred from a count** (re-measured 2026-09-07 against
the complete 2026-09-04 capture, through the shipped adapter):

| # | Product | Ids | Sizes as written | Prices |
|---|---|---|---|---|
| 1 | 💲 **Brodie Juniper** | 631 · 1128 | `45 gallon` · `45G` | **$1,400 vs $1,250** |
| 2 | Chinese Pistache | 689 · 85 | `95 gallon` · `95 gallon` | $1,000 both |
| 3 | Japanese Black Pine | 138 · 746 | `45 gallon` · `45 gallon` | $1,250 both |
| 4 | 💲 **Lacey Oak** | 75 · 753 | `30 gallon` · `30 Gallon` | **$350 vs $900** |
| 5 | 💲 **Lacey Oak** | 76 · 756 | `45 Gallon` · `45 Gallon` | **$375 vs $1,250** |
| 6 | Mexican Buckeye | 110 · 111 | `10/15 gallon` both | $90 both |
| 7 | Military Discount 5% | 8 · 9 | none | −$0.05 both |
| 8 | 💲 **Natchez Crape Myrtle** | 859 · 150 | `30 gallon` both | **$900 vs $350** |
| 9 | 💲 **Native Female Yaupon Holly** | 834 · 836 | `45 gallon` · `45 Gallon` | **$650 vs $0** |
| 10 | 💲 **Skyward Holly** | 1087 · 1104 | `5 gallon` · `5G` | **$65 vs $60** |
| 11 | Tree Replacement | 196 · 207 | none | $0 both |

🔴 **ROWS 1 AND 10 ARE THE PROOF THAT THE PARSED SIZE IS WHAT GROUPS, NOT THE SIZE TEXT.**
`45G` and `45 gallon` are different strings and the same shelf; the key is the unit projection
(`container/45/gallon`), which is exactly what R-27 built it for. A detector keyed on the size
STRING would report nine groups and miss both.

**PASS:** `wouldCreate` (647) equals `adapted.counts.sellable` (647) — **every sellable item became
a row** — and all eleven collisions above are present.
🔴 **Read the sentence, do not just check the count.** For Lacey Oak 30 Gallon it must name
the product and say **$900** and **$350** — a $550 gap on one product name. Before this build the create loop kept
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

## CARD 5 — 🔴 PROVE THE UNDO ON TEST DAVE'S BEFORE LAWNS
**STATUS:** covered · **DEVICE:** desktop · **LAST-PROVEN:** 2026-09-07 (David, live, Test Dave's)
> ✅ **COVERED — ALL EIGHT STEPS, run id `b020759d`.** Fingerprint identical before and after,
> zero residue. **The undo is proven**, which is what CARD 6 was waiting on.
> ✏️ *It failed first on STEP 3 under run id `435f52b5` — `source` is not a column on
> `business_inventory` — and **the guard held**: create-before-retire meant a stopped run rather
> than 130 hidden rows with nothing created. Both defects fixed in `5e16a89` (tech-debt #202, #203)
> before the covering run. That ordering earned its place.*
**TENANT:** Test Dave's Tree Nest · **ACTOR:** owner · **TIME:** about ten minutes.

**What you are proving:** that an import can be taken back completely. One item in, one item out,
130 rows restored with every quantity intact. **Nothing here touches LAWNS.**

Eight steps. Run them in order. Each says what to run, what you must see, and what it means if you
see something else.

---

### STEP 0 — get a token
Sign in to `cultivar-os.app` as the owner. Open the browser console and paste this:

```js
const K = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
if (!K) throw new Error('Not signed in on this origin.');
const T = 'Bearer ' + JSON.parse(localStorage.getItem(K)).access_token;
const TD = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
const call = (path) => fetch('/api/qbo/items/' + path, {
  method: path.startsWith('preview') ? 'GET' : 'POST', headers: { Authorization: T },
}).then(r => r.json());
console.log('token ok');
```

**SEE:** `token ok`.
**IF NOT:** you are signed out, or on the wrong origin. localStorage is per-origin — a token from
anywhere else 401s in a way that reads like a permission bug.

---

### STEP 1 — take the baseline
SQL editor. **This is the number you will compare against at the end, so read it now.**

```sql
SELECT count(*)                                       AS rows_total,
       count(*) FILTER (WHERE qty > 0)                AS counted,
       count(*) FILTER (WHERE retired_at IS NOT NULL) AS retired,
       md5(string_agg(id::text || ':' || coalesce(qty, -1)::text, ',' ORDER BY id)) AS fingerprint
  FROM public.business_inventory
 WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
```

**SEE:** `rows_total` **130** · `counted` **25** · `retired` **0** · a `fingerprint` hash.
🔴 **WRITE THE FINGERPRINT DOWN.** It is every row id paired with its quantity, hashed. Counting 25
counted rows proves 25 rows have *a* count; the fingerprint proves they have *the same* counts.
That is the difference between the undo restoring rows and restoring rows correctly.

**IF `retired` IS NOT 0:** a previous run left rows hidden. Stop and find out which before importing
anything on top of it.

---

### STEP 2 — preview (this writes nothing)
```js
const p5 = await call('preview?business_id=' + TD);
console.log(p5.adapted.counts, 'wouldRetire', p5.wouldRetire, 'wouldCreate', p5.wouldCreate);
```

**SEE:** `readIn` **1** · `categories` **0** · `sellable` **1** · `wouldCreate` **1** ·
`wouldRetire` **130**.

⚠️ **`readIn: 1` IS CORRECT.** Test Dave's QuickBooks company holds exactly one item. You are
reading *its* books, not LAWNS's.

**IF `wouldCreate` IS 647:** you called it against LAWNS. Check the id in the URL and stop.

---

### STEP 3 — run the import
```js
const r5 = await call('ingest?business_id=' + TD);
console.log('RUN ID →', r5.runId, '| created', r5.created, '| retired', r5.retired, '| undoable', r5.undoable);
```

**SEE:** `created` **1** · `retired` **130** · `undoable` **true**.
🔴 **WRITE THE RUN ID DOWN.** Step 6 needs it and nothing else recovers it.

**IF `undoable` IS false:** stop. The import has landed and the undo will refuse. Check
`/api/qbo/status` → `writes_permitted` must be **false**.
**IF `retired` IS NOT 130:** the retire did not reach every row. Do not continue to CARD 6.

---

### STEP 4 — confirm the retire was complete
SQL editor, pasting your run id in:

```sql
SELECT count(*) FROM public.business_inventory
 WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'
   AND retired_at IS NULL
   AND import_run_id IS DISTINCT FROM '<RUN ID>';
```

**SEE: 0.**
This says: nothing is still visible except what this run made. It stays true however many rows
existed, which is why it is worded this way rather than as "130".

---

### STEP 5 — look at the row it created
```js
console.log(p5.adapted.items[0]);
```

**SEE:** name `Services` · size **null** · `sizeState` **`could_not_read`**.

⚠️ **THAT IS CORRECT, NOT A FAILURE.** That item carries no description, so there was nothing to
read a size from — and the honest answer is "could not read", not a blank.
🔴 **IF IT COMES BACK WITH A SIZE, THAT IS THE DEFECT** — nothing in the source could have supplied
one, so it was invented.

---

### STEP 6 — take it back
```js
const u5 = await call('undo?business_id=' + TD + '&run_id=' + r5.runId);
console.log(u5);
```

**SEE:** `inventoryDeleted` **1** · `unretired` **130** · `customersDeleted` **0** ·
`leftovers` **[]** · `ok` **true**.

**IF `leftovers` IS NOT EMPTY:** a write was refused. The message names which one. This is the undo
catching itself rather than reporting a clean wipe it did not perform.
**IF `customersDeleted` IS NOT 0:** stop and look. Nothing here should touch a customer.

---

### STEP 7 — 🔴 THE CARD. Is the tenant actually back?
Re-run **the exact query from STEP 1**.

**SEE:** `130` · `25` · `0` · **and the SAME FINGERPRINT you wrote down.**

**PASS:** all four match. The import was completely reversible.
**FAIL:**
- **Fingerprint differs, counts match** → the rows came back but a quantity did not. 🔴 **This is
  the failure this card exists to catch, and counting alone would have missed it.**
- `retired` is not 0 → the un-retire is incomplete. **The undo is not trustworthy at any scale —
  do not run CARD 6.**
- `rows_total` is 131 → the created row was not deleted.

---

### STEP 8 — leave it clean
```sql
SELECT count(*) FROM public.business_inventory
 WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'
   AND (import_run_id IS NOT NULL OR retired_by_run_id IS NOT NULL);
```
**SEE: 0.** No trace of the run remains on the tenant.

---

**WHEN ALL EIGHT PASS:** the undo is proven and CARD 6 on LAWNS is safe to run. That is the whole
purpose of doing this here first.

---

> ⚠️ **TWO NOTES, NEITHER OF WHICH YOU NEED TO ACT ON.**
>
> **① Why this card is one item and not 647.** It previously said the ingest here *"creates 647 and
> retires 130"* — 647 is LAWNS's QuickBooks company, 130 is Test Dave's inventory. Two companies,
> one sentence, and it was my error. `/api/qbo/items/preview` always reads the tenant's own
> QuickBooks connection, and Test Dave's holds one item. There is no file to load instead: the
> capture-file door exists only in the browser and only for the READ (R-60's import half was never
> built). **So this card proves the mechanism; LAWNS proves the scale** — which is the right order
> anyway, because by then the undo is proven rather than assumed. Tech-debt #201.
>
> **② What this card cannot prove: the RESTRICT path.** `20260905_production_planning.sql` is not
> applied, so `production_plan_lines` does not exist and the one foreign key that would REFUSE a
> delete cannot fire. Every other reference to `business_inventory` is `ON DELETE SET NULL`. When
> that migration lands, an imported lot held by an open plan will refuse deletion — and that refusal
> is the correct answer; the undo surfaces it in `leftovers` rather than swallowing it.

## CARD 6 — the import runs on LAWNS and reports what it did
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

> 🔴 **STEP ZERO — TAKE A FINGERPRINT BASELINE. DAVID'S ADDITION, 2026-09-07, AND THE BOARD WAS
> WRONG NOT TO ASK FOR IT.** CARD 10 verified the wipe by counting rows and eyeballing one variety.
> That proves rows came back; it does not prove they came back *unchanged*.
>
> ```sql
> SELECT count(*)                                       AS rows_total,
>        count(*) FILTER (WHERE qty > 0)                AS counted,
>        count(*) FILTER (WHERE retired_at IS NOT NULL) AS retired,
>        md5(string_agg(id::text || ':' || coalesce(qty, -1)::text, ',' ORDER BY id)) AS fingerprint
>   FROM public.business_inventory
>  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
> ```
> **EXPECT: `447` · `2` · `0` · a hash. WRITE THE HASH DOWN — CARD 10 step 8 compares against it.**

> ⚠️ **WHAT I WOULD WATCH ON THIS RUN, AND IT IS NOT PROVEN EITHER WAY: 647 ROWS GO IN ONE
> `INSERT`.** CARD 5 proved the mechanism at **one** row. This writer does not batch —
> `itemImportWriter.ts:382` is a single `.insert(rows).select('id')` — while the sibling customer
> import chose **500** as its ceiling (`customerImportWriter.ts:85`, `CUSTOMER_INSERT_BATCH`) for a
> 1,946-row load. **647 is above that number, and nobody has run this size.**
>
> 🔴 **IF IT FAILS, IT FAILS CLEANLY — BY DESIGN, NOT BY LUCK.** A single statement is atomic:
> either all 647 land or none do. The run stops at `create`, **the retire never runs**, and your 447
> are untouched — exactly what happened on CARD 5's first attempt. You would see `ok: false`,
> `created: 0`, `stoppedAt: "create"` and a message. **Nothing to undo.**
> ✏️ *A single statement is also SAFER than batching here: a batched failure leaves a partial
> catalogue behind. If 647 does prove too large the fix is a batch — #278 has already proven that
> shape at 500 — but I am not pre-emptively adding one against a problem that may not exist.*

🔴 **Write the run id down before you do anything else. The undo needs it and nothing else
recovers it except a query.**

```js
const r = await fetch('/api/qbo/items/ingest?business_id=ed2e5933-45dc-4b9b-a331-ddfd125e7a74', {
  method: 'POST',
  headers: { Authorization: T }
});
const out = await r.json(); console.log(out.runId, out.created, out.retired, out.undoable);
```

1. `created` is **647**.
2. `retired` is **447**.
3. `committed` is `true`.
4. 🔴 `undoable` is **`true`**. If it is `false`, **STOP — the import has landed and you cannot
   wipe it.** Check `/api/qbo/status` → `writes_permitted` must be **`false`**. ✏️ *Do NOT reach for
   the env var: `undoable` reads BOTH switches now, and at LAWNS the owner's `qbo_writes_enabled`
   is what holds it open. A `false` here means either the Test Mode switch got flipped on, or the
   status read failed — and those are different problems.*

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
  headers: { Authorization: T }
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
8. 🔴 **RE-RUN CARD 6'S FINGERPRINT QUERY. IT MUST RETURN THE SAME HASH YOU WROTE DOWN**, with
   `447` · `2` · `0`.
   **This is the strongest step on the card and it is David's addition, not mine.** Steps 1–7 prove
   the rows came back; step 8 proves they came back **unchanged** — every id still paired with the
   same quantity. A fingerprint that differs while the counts match means the undo restored rows
   and lost a number, and counting cannot see that. It caught nothing on Test Dave's, which is
   exactly the point: **a check that has only ever passed is still a check, provided it could have
   failed.**

**PASS:** all eight.
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
🔴 **Run a fresh import first (CARD 6) so there is something to refuse to delete.** Then **flip the
owner's Test Mode switch OFF** (`qbo_writes_enabled = true`) — that is the real go-live control and
the one to test — confirm `/api/qbo/status` reports **`writes_permitted: true`**, and call the undo
with the run id.
✏️ *Corrected 2026-09-06. This card previously told you to clear an env var, which tested the
OPERATOR's hold and left the OWNER's switch — the one Lauren actually flips — unproven.*

1. HTTP **409**, not 500 and not 200.
2. `refused` is `true`.
3. `error` says invoices may already have been sent and that **nothing was changed**.
4. Re-query: the 647 rows are **still there** and the 447 are **still retired**.

**PASS:** refused, and nothing moved.
🔴 **This is the whole safety model in one control.** The switch that turns QuickBooks writes on is
the switch that closes the undo — one control, not two, and it is the hold that already protects
their books rather than a second mechanism that could disagree with it.
⚠️ **PUT TEST MODE BACK ON AFTERWARDS** (`qbo_writes_enabled = false`) and confirm
`/api/qbo/status` reports **`writes_permitted: false`** before doing anything else.
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

## CARD 14a — 🔴 cross-tenant READ is refused
**STATUS:** covered · **DEVICE:** desktop · **LAST-PROVEN:** 2026-09-07 (David, live)
> ✅ **COVERED, INCIDENTALLY, AND THE EVIDENCE IS EXACT.** Signed in as
> **`95c1b2e9`** — verified against the catalog as the OWNER of Test Dave's
> (`f7ec5d67`) and **not a member of LAWNS in any role** — the **preview** against LAWNS returned
> **403**. Cross-tenant read refusal is live.

Signed in as the owner of one tenant, call **preview** with a **different** tenant's business id.

1. **403.**
2. Nothing is read: the response carries no counts, no items, no collision list.

**PASS:** refused.
🔴 **THE GATE HERE IS MEMBERSHIP, NOT OWNERSHIP** — `handleItemsPreview` checks
`callerCan(auth, businessId, 'inventory:read')`, and a caller with no membership row for that
business fails it. **Expect `code: 'FORBIDDEN'`.** ⚠️ *If you ever see `OWNER_ONLY` from the
preview, something has been re-ordered — that code belongs to the write path.*
**FAIL:** a 200, or any response body carrying the other tenant's counts.

---

## CARD 14b — 🔴 cross-tenant WRITE is refused. **THIS IS THE ONE THAT MATTERS.**
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

> ⚠️ **CARD 14a DOES NOT COVER THIS, AND THE DIFFERENCE IS THE WHOLE POINT.** They are different
> endpoints refused by different gates: the preview is stopped by **membership** (`callerCan` →
> `FORBIDDEN`), the ingest by **ownership** (`refuseUnlessOwner` → `callerIsBusinessOwner` →
> `OWNER_ONLY`). A read leaking is bad; **a write landing in the wrong tenant is unrecoverable in a
> way a read never is.** The read door being shut says nothing about the write door.

🔴 **YOU CAN RUN THIS FROM THE SEAT YOU ARE ALREADY IN — no account switch needed.** Still signed in
as Test Dave's owner (`95c1b2e9`), call **ingest** against **LAWNS**:

```js
const bad = await fetch('/api/qbo/items/ingest?business_id=ed2e5933-45dc-4b9b-a331-ddfd125e7a74',
  { method: 'POST', headers: { Authorization: T } });
console.log(bad.status, await bad.json());
```

1. **403**, with **`code: 'OWNER_ONLY'`** — not `FORBIDDEN`, because the owner gate runs first.
2. LAWNS is untouched: re-run CARD 6's fingerprint query and it is unchanged.
3. No run id was minted — there is nothing to undo.

**PASS:** 403 `OWNER_ONLY`, LAWNS fingerprint identical.
🔴 **AC-3 is absolute — cross-tenant resolution returns no-access, never a wrong-tenant record.**
This runs against the *live* endpoint rather than a probe because `callerIsBusinessOwner` compares
`businesses.owner_id`, and the only way to know it is wired is to be refused by it.

⚠️ **SAID PLAINLY BECAUSE IT IS A REAL COST, NOT A THEORETICAL ONE: if the guard is broken, this
call runs a full import on LAWNS.** It is undoable — writes are held, so the undo is open — but you
would be doing CARD 6 by accident, under a run id the response gives you. Take the fingerprint
baseline first and you are covered either way.
**FAIL:** a 200. Stop, note the run id, and undo it before anything else.

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
4. **WRITES ON.** Flip the owner's **Test Mode switch OFF** (`qbo_writes_enabled = true`) and
   confirm `/api/qbo/status` reports **`writes_permitted: true`** — read it there, do not assume it.
   ✏️ *Corrected 2026-09-06: this step named the env var. It is a switch in the product, per
   business, and it is Lauren's to flip — not a Vercel redeploy.*
5. **CONFIRM THE UNDO IS NOW CLOSED.** Call the undo with the run id from step 2.
   **EXPECT HTTP 409, `refused: true`, and the catalogue untouched.**

**PASS:** step 5 refuses, and `/inventory` still shows the 647.
🔴 **Step 5 is not a formality — it is the only thing that proves the safety model is a MECHANISM
and not a habit.** Up to step 4 the undo has been open every time you pressed it; step 5 is the
first time it must say no. If it proceeds, the switch is not wired to the door and a later
mis-click deletes rows behind invoices you have already sent.
⚠️ **If you need to change the catalogue after this point, it is a normal edit or a new import —
not an undo.** That is the trade you are making at step 4, deliberately.
**FAIL:** step 5 returns 200 — **stop, and put Test Mode back on immediately** (`qbo_writes_enabled = false`). Or step 2's re-run
creates ~1,294 rows, which means step 1's wipe did not land and CARD 10 lied.


---

# PART TWO — THE SURFACE (cards 24–33)

> 🔴 **CARDS 1–23 PROVED THE MECHANISM THROUGH CONSOLE CALLS. THAT IS NOT THE PATH.**
> David: *"I proved the endpoints via console calls — a work-around, not the path. The button
> builds the request, holds the run id, renders the counts and decides when to offer the undo, and
> none of that has been exercised."* Everything below runs **only** through
> **Settings → Accounting → "Your product list from QuickBooks"**. **No console. No `curl`.**
> If a step here cannot be done by pressing something, that is the finding.
>
> **TENANT:** LAWNS · **ACTOR:** the owner, signed in normally.
> **BEFORE YOU START:** take CARD 6's fingerprint. Every card below compares against it.

---

## CARD 24 — the panel is there, and only for the owner
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Settings → Accounting.

1. Below **Preview the loads / Record 0 loads** there is a section headed
   **"Your product list from QuickBooks"**.
2. It has **two** buttons: *Preview your product list* and *Import*.
3. **Import is greyed out.** Nothing has been previewed.
4. There is **no Undo button.**
5. Sign in as the **manager** and open the same page: the section is **not there at all**.

**PASS:** all five.
🔴 **Step 3 and step 4 are the card.** A button that can only error should not be pressable, and
an Undo offered before anything exists to undo invites a press that teaches her the screen lies.
⚠️ *Step 5 is courtesy, not the control — the server refuses a manager regardless (CARD 13). If the
panel shows for a manager that is a real bug, but it is not a security hole.*
**FAIL:** Import is pressable with nothing previewed, or Undo is visible.

---

## CARD 25 — Preview, and read the numbers off the screen
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Press **Preview your product list**. It says *"Reading QuickBooks…"* while it works.

1. **Read 685 items. 38 are category folders, not products, and are skipped. That leaves 647.**
2. **create 647** and **hide 447**, in those words.
3. Sizes: **536** read · **78** with no size given · **33** we could not read.
4. **Import** is now pressable and reads **"Import 647 products"**.
5. Nothing has changed: `/inventory` still shows **447** rows.

**PASS:** the numbers match CARD 1's, read off a screen instead of a console.
🔴 **Step 5 matters.** Preview is a read. If the catalogue moved, the button did something the
panel did not say it would.
**FAIL:** any number differs from CARD 1 — note which, they mean different things.

---

## CARD 26 — 🔴 the counted rows you are about to hide are NAMED
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Still on the preview.

1. An amber block reads **"2 rows you have counted will be hidden"**.
2. It lists them by name, size and quantity: **Brodie Juniper · 30 gallon — 1 on hand** and
   **Arizona Cypress, Blue Ice · 30 gallon — 1 on hand**.
3. It says **"Hidden, not deleted. The count is still there and the undo brings it back."**

**PASS:** both rows named with their numbers.
🔴 **A count is the one number nobody can recreate**, so if one is about to leave the grid it is
named here — not summarised as "2 rows", and not left as a figure to go looking for.
**FAIL:** a bare count with no names, or no block at all.

---

## CARD 27 — 🔴 the eleven collisions, money first
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Still on the preview.

1. **"11 products appear twice in QuickBooks — 6 with different prices."**
2. A list of eleven, each naming the product and both prices.
3. **The six with a price gap are at the TOP, in red, biggest gap first:**
   Lacey Oak 45 Gallon **($875 apart)** · Native Female Yaupon Holly 45 **($650)** ·
   Lacey Oak 30 **($550)** · Natchez Crape Myrtle 30 **($550)** · Brodie Juniper 45 **($150)** ·
   Skyward Holly 5 **($5)**.
4. The five tidy-ups are below them in grey — **still listed, not dropped**.

**PASS:** eleven listed, six red and first.
🔴 **This is R-101 on the screen she reads before committing.** Six of these are two prices for one
product in a catalogue she is about to sell from — not tidiness.
**FAIL:** a count with no list, or the money ones not leading, or fewer than eleven.

---

## CARD 28 — Import, and what it says when it lands
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Press **Import 647 products**.

1. It says *"Importing…"* while it works.
2. Then, in green: **"Imported. 647 products created, 447 of your old rows hidden."**
3. It tells you to look at your Inventory screen and says your receipts and delivery schedule are
   not touched either way.
4. **An "Undo this import" button has appeared.**
5. 🔴 **You were never shown a run id and never asked to write one down.**

**PASS:** all five.
🔴 **Step 5 is the card.** A person asked to copy a uuid between two screens will eventually paste
the wrong one, and the undo is keyed on exactly that value.
**FAIL:** a uuid on screen, or no Undo button, or the counts disagreeing with CARD 6's.

---

## CARD 29 — 🔴 REFRESH THE PAGE. The Undo must survive it.
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
With the import live, **reload the browser** and go back to Settings → Accounting.

1. The **Undo this import** button is **still there**.
2. Above it: *"There is an import already in your catalogue from an earlier session. You can undo
   it, or preview and import again to replace it."*
3. Press it. It undoes the run you made before the refresh.

**PASS:** the button survives and works.
🔴 **THIS WAS BROKEN AND DAVID NAMED IT BEFORE IT WAS TESTED.** The run id lived in page state, so a
reload left 647 rows live with **no route back through any surface**. It is now recovered by
*deriving* it — a live row carrying an import run id IS an undoable run — rather than cached, so it
cannot go stale. Fixed in `cb3c0bf`.
⚠️ **Also try it from a second device or a different browser.** Same answer: the run is in the data,
not in a tab.
**FAIL:** no Undo after the reload. Note the run id from CARD 28's response before re-testing, or
you will have no way to clean up.

---

## CARD 30 — the wipe, through the button
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Press **Undo this import**.

1. *"Undoing…"*, then green: **"Undone. 647 imported products removed, 447 of your own rows brought back."**
2. It names your receipts and deliveries with their counts and says the undo cannot reach them.
3. The **Undo button is gone** — there is nothing left to undo.
4. `/inventory` shows **447**.
5. 🔴 **Re-run CARD 6's fingerprint query. Same hash, `447 · 2 · 0`.**

**PASS:** all five, and the hash matches.
**FAIL:** the hash differs while the counts match — rows came back and a quantity did not.

---

## CARD 31 — 🔴 press Undo twice
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Import again (CARD 28), then press **Undo this import** and, the moment it returns, look for the
button and try to press it a second time.

1. While it is working the button is **disabled** — a second click does nothing.
2. After it succeeds the button is **gone**, so there is nothing to press.
3. No error appears, and nothing is deleted twice.

**PASS:** the second press is impossible rather than merely harmless.
🔴 **A run that has been consumed must not be pressable again.** The undo is keyed on a run id; a
second call against a spent one would report zero rows removed, which reads as a failure and is not.
**FAIL:** the button stays and a second press errors.

---

## CARD 32 — the re-run, through the surface
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Straight after CARD 30: **Preview → Import** again.

1. Preview reads **the same numbers** — 685 / 38 / 647, create 647, hide 447.
2. Import lands **647 created, 447 hidden** — not 1,294.
3. `/inventory` shows **647**.
4. Undo it once more and the fingerprint matches again.

**PASS:** the loop closes twice.
🔴 **THIS IS THE LOOP DAVID PROMISED HER** — *"import, look, wipe, reload as many times as it
takes"* — done entirely by pressing things.
**FAIL:** ~1,294 rows, which means CARD 30's wipe did not land.

---

## CARD 33 — 🔴 the two stopped states, and the undo refusing
**STATUS:** needs-test · **DEVICE:** desktop · **LAST-PROVEN:** —
**REASON IT IS `needs-test`:** two of these three cannot be provoked from the surface — they need a
deliberate fault injected, and there is no way to do that by pressing a button. Recorded rather
than skipped, because an untested error path is exactly what shipped `source` and `ok: true`.

**(a) THE UNDO REFUSING — this one you CAN do.** Import, then turn the **Test Mode switch off**
(`qbo_writes_enabled = true`) at the top of the same page, then press **Undo this import**.
- **EXPECT:** a red block, **"Undo is closed."**, and a sentence saying an imported product may
  already be on an invoice you have sent and that **nothing was changed**.
- The 647 are still there. **Put Test Mode back on afterwards.**

**(b) STOPPED AT `create`** — the shape CARD 5's first attempt hit. The panel must say
**"Nothing was imported — it stopped while creating the new products"** and
**"Your current catalogue is untouched — nothing was hidden."**
*Not provokable from the surface. If you ever see it for real, that sentence is what to check.*

**(c) STOPPED AT `retire`** — the worse one. The panel must say it stopped while hiding the old
rows, that **the new rows did land**, that the catalogue now holds both lists, and **offer Undo.**
*Not provokable from the surface either.*

⚠️ **(b) and (c) are covered by probes and mutants** (`itemImportWriter.test.ts` §D2, mutants
W28/W29) — the code is proven to distinguish them by `ok` alone. What is untested is the WORDING
on screen, and that is what this card is holding open.
