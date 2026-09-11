# OWNER TEST — SERVICES: WHAT WE FOUND, WHAT WE REFUSED, AND THE $0 THAT MUST NEVER LAND

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*

**Capability:** services / `service_offerings` · **Ledger:** #283 · #293
**Board: 5 of 25 covered** (20 `owed`) — **CARDS 1, 12 and 15 proven live 2026-09-08 on Test Dave's; CARD 10 on LAWNS; CARD 3 FAILED and then PASSED the same day**, both runs recorded on the card. 🔁 **CARD 13 flipped to `owed` 2026-09-11 (#293)** — the write it proved changed. **CARDS 19–25 are new (#293 · R-120), every one runnable by David now — start with CARD 19.**

**TENANT:** LAWNS = `ed2e5933-45dc-4b9b-a331-ddfd125e7a74` · Test Dave's = `f7ec5d67-a9ef-4cb0-b807-438d67687d1b`.
**ACTOR:** the business OWNER on every card unless the card says otherwise. The review is mounted at
the top of the Services card on `/settings/services`, which is gated `settings:read`; the write is a
`service_offerings` INSERT under that table's existing owner RLS fence. **No new permission string.**

**Story:** ⚠️ **NONE — and I did not invent one.** `user_stories.md` has no story for *"read my books
and tell me what I charge for."* The nearest written artefact is **ruling R-102** (*seed services from
`servicesFound`, not from `suggestedOfferings`*), which is about a different mechanism and is
superseded rather than satisfied by this build — see §3 and `docs/RULINGS.md`. Recorded OPEN rather
than papered over. **A story is owed for this surface.**

**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to
`covered`, with a date.**

---

> 🔴 **THE SIX ACCEPTANCE CRITERIA ARE ALL BROWSER-OBSERVED, AND THAT IS WHY THIS BOARD EXISTS.**
> 110 assertions and 48 mutants prove the *judgement* behind the screen. **Not one of them opens a
> browser**, and every acceptance criterion in the build prompt is a statement about what a person
> sees or what happens when they press something. The cards that carry them are named here:
>
> | | Card | The criterion it proves |
> |---|---|---|
> | 0 | **CARD 1** | 🔴 **NOTHING IS WRITTEN UNTIL A ROW IS PRESSED.** Ten seconds, and it is the whole promise of the screen. |
> | 1 | **CARD 12** | 🔴 **NO SERVICE EVER CARRIES A $0 PRICE** — the refusal, proven by trying to do it. |
> | 2 | **CARD 9** | Warranty replacement and DIW appear, unaddable, each with its reason on the row. |
> | 3 | **CARD 10** | The placement ladder offers itself **and** leaves what you already have alone. |
> | 4 | **CARD 5** | Every row names its evidence and its source. |
> | 5 | **CARD 14** | 🔴 **A SECOND PASS ADDING ONE SERVICE LEAVES THE FIRST PASS INTACT.** |

---

## PART ONE — THE READ

### CARD 1 — nothing has been read, and nothing has been written
`STATUS: covered` · `DEVICE: desktop` · `LAST-PROVEN: 2026-09-08 (David, live, Test Dave's)`

✅ **COVERED — David, live, 2026-09-08, Test Dave's.** the review card rendered above the Services list with one button, no rows and no numbers, and the `service_offerings` count was unchanged before and after opening the page. Nothing is written until a row is pressed.

Open `/settings/services` as the owner on **Test Dave's**. Before pressing anything, run in SQL:
`select count(*) from service_offerings where business_id = '<Test Dave's>';`
**PASS:** a card headed **"Find the services you already charge for"** sits above the existing
Services list. It explains what it will read, says in amber that it reads your whole invoice history
and **changes nothing in QuickBooks**, and has ONE button. No rows, no numbers, no prices. The SQL
count is unchanged from before you opened the page. **FAIL:** it fetched on load, or any suggestion
is on screen before you pressed anything, or the count moved.

### CARD 2 — the read runs, on Test Dave's first
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Press **Find my services**.
**PASS:** the button reads *Reading your books…*, then the review renders. **FAIL:** it hangs with no
state change, or an error appears that does not say which read failed.

### CARD 3 — the read on LAWNS, and the census line
`STATUS: covered` · `DEVICE: desktop` · `LAST-PROVEN: 2026-09-08` · David, live, LAWNS, after `bd94598`

🔴 **FAILED 2026-09-08, THEN PASSED 2026-09-08 AFTER `bd94598`. BOTH RUNS ARE RECORDED, IN ORDER —
this card is not collapsed to "covered", because a card that failed and was then fixed is a stronger
record than one that only ever passed.**

**RUN 1 — FAILED.** David, live, LAWNS, on a 30-page print of the screen. The census read
**500 · 140 · 7 · 0 · 38** against the required **564 · 73 · 8 · 2 · 38**, and **all 81 items printed
*"This item has no income account in QuickBooks."*** Two symptoms, **one root cause**: the
`IncomeAccountRef` read returned nothing, so `classifyDestination` had no axis to sort on and **trees
appeared on the services menu** — the precise failure R-112 was written to prevent.

**THE FIX — `bd94598`,** *"the item income account was never read — one word, and the axis was dead"*:
`incomeAccountName` → `incomeAccount`. The axis existed, was correct, and was being read off a field
name that did not exist. ✏️ *Nothing in the build could have caught it: 125 probes and 48 mutants all
built their observations from fixtures that spelled the field the way the parser expected. It took
her real books. This is #182's shape — the harness could not reach the thing.*

**RUN 2 — PASSED.** Census read **564 · 73 · 8 · 2 · 38**, summing to 685, with **0 no-account rows**.

✅ **COVERED — David, live, 2026-09-08, LAWNS, on `bd94598`.**

Same, on LAWNS. This is the real capture: 685 items, 1,481 invoices.
**PASS:** it completes, and the green box at the top reads **"Your QuickBooks holds 685 items, and
they are not all products"** followed by a split. On the 2026-09-04 capture that split is
**564 products · 73 services · 8 discounts · 2 bookkeeping · 38 folders.**
⚠️ **These five must add up to 685.** **FAIL:** they do not add up, or the read renders after
reporting itself incomplete.

### CARD 4 — an incomplete read shows nothing at all
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Not reproducible on demand; check it if you ever see it. **PASS:** an incomplete invoice walk
produces an error naming retrieved-of-expected and **no sections render**. **FAIL:** counts render
anyway — every one of them would be short and would look like a business that charges for less.

---

## PART TWO — WHAT IT CLAIMS, AND WHAT IT REFUSES TO

### CARD 5 — every row names its evidence and its source
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
On LAWNS, read three rows under **WE'RE SURE OF THE PRICE**.
**PASS:** each row carries (a) how many invoices, how many customers, how much money and the date
span; (b) the price and **the count behind it** — e.g. *"Charged $50 on 382 of 509 priced lines"*;
(c) **the QuickBooks account it is filed under**, in quotes. Pick one and check it in QuickBooks.
**FAIL:** any number on any row has no stated source.

### CARD 6 — the trip charge, the biggest one, and its unit
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Find **Trip Charge** (`TC`).
**PASS:** 522 invoices, $39,560, $50 on 382 of 509 priced lines, filed under *Delivery Income*, and
the **Charged** box reads **once per order**. **FAIL:** it reads *per plant* — that would multiply
one trip charge by the number of trees on the order.

### CARD 7 — the tree bubbler is priced, and is NOT ticked for you
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Find **Tree Bubbler** (`TB`) — $65 on 80 of 81 lines, the cleanest price in these books.
**PASS:** it is under **WE'RE SURE OF THE PRICE** with $65 filled in, its **Charged** box reads
**per plant**, and its checkbox is **EMPTY** with a small amber **NOT TICKED FOR YOU**. Below it, a
sentence says her books file it under *Sales of Product Income* — where she also books bags and
containers — and that we cannot tell from her books whether it is a thing she sells or a thing she
fits. **FAIL:** it is pre-ticked, or the amber note is missing. *(This is the difference between
"we know the price" and "we know what kind of thing it is". Only both together pre-tick a row.)*

### CARD 8 — we can't tell you the price, and we say why
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Read **WE CAN'T TELL YOU THE PRICE**. Expect Tree removal (`TR`, 85 invoices, $22,285),
Tailgate Delivery (125 invoices, $18,865), Stump removal (`SR`) and Tree removal-and-replant (`TRR`).
**PASS:** every row has an EMPTY price box, states how many different prices it saw across how many
lines, names the most common one, and says *we will not guess*. **FAIL:** any of them arrives with a
price filled in.

### CARD 9 — the two that are not offered at all, with their reasons on the row
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Read **WE'RE NOT SUGGESTING THESE**.
**PASS:** **WARRANTY** is there — *"you have billed this 19 times and charged nothing every time.
That is what this costs you, not something you sell"* — with **no checkbox and no price box**. So is
**DIW**, $64,466, saying every charge has been different (21 figures across 22 lines). `FDIW` and
`AH` are also expected here on the 2026-09-04 capture. **FAIL:** either has a price box, or either is
missing, or a reason is absent.

### CARD 10 — the placement ladder, offered without touching what you have
`STATUS: covered` · `DEVICE: desktop` · `LAST-PROVEN: 2026-09-08 (David, live, LAWNS)`

✅ **COVERED — David, live, 2026-09-08, LAWNS, `bd94598`.** After the press: **3 rows unchanged ·
tree placement still $125 · `default_install_price` still null · no placement row written · the
ladder wrote nothing.** Byte-identical before and after. 🔴 **This is the card that proves the
ladder is REPORTED and never SAVED** (tech-debt #220) — the section offers six rungs and the button
below it does not write one of them, which is the whole reason the ladder was allowed to ship as a
suggestion.

🔴 **Before pressing anything, write down what your placement price is today** — the Services list
below, and `nursery_profiles.default_install_price`.
**PASS:** a section **PUTTING THE TREE IN THE GROUND** says planting is not a line on any invoice,
that 193 of your plants have been sold both ways across 909 planted lines, and that a planted tree
costs about **2×** a collected one. A table gives a premium per pot size — on the 2026-09-04 capture:
**7 gal $101 · 15 gal $214 · 30 gal $418 · 45 gal $529 · 65 gal $650 · 95 gal $906**, each with the
lines and plants behind it. Under it, in amber: **this is a suggestion and it is NOT saved by the
button below**; whatever you have now stays as it is. **FAIL:** the ladder writes anything, or the
existing placement price changes, or a rung is printed with fewer than 3 lines behind it.

### CARD 11 — a discount never appears here
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Search the whole screen for `CD10%`, `CD15%`, `MD10`, `Military Discount`, `FD10`, `Customer
Discount`, `Credit`.
**PASS:** **not one of them is anywhere on this screen.** They belong on `/discounts`.
**FAIL:** any of them appears — `Military Discount 5%` carries a unit price of −$0.05, and accepting
it would put a **negative-priced row** on your checkout.

---

## PART THREE — THE WRITE

### CARD 12 — 🔴 A $0 SERVICE CANNOT BE SAVED
`STATUS: covered` · `DEVICE: desktop` · `LAST-PROVEN: 2026-09-08 (David, live, Test Dave's)`

✅ **COVERED — David, live, 2026-09-08, Test Dave's.** a $0 price was refused and **the whole press was refused with it** — no partial write, no good row landing beside the bad one. R-113 holds at the till.

Tick a row under **WE CAN'T TELL YOU THE PRICE** and leave its price box empty. Then type `0` into it.
**PASS:** an amber line appears above the button — *"a service saved at $0 tells a customer it is
free"* — and pressing the button saves **nothing** and says so. Then run
`select name, price from service_offerings where business_id = '<tenant>' order by created_at desc;`
and confirm no new row. **FAIL:** anything is written, or a $0 row lands, or a good row lands beside
the bad one *(the write is all-or-nothing on purpose)*.

### CARD 13 — the first pass writes what you ticked, and only that
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: — (was 2026-09-08)`

🔁 **FLIPPED `covered` → `owed` 2026-09-11 (#293).** The write this card proved changed: every row now
carries `transport_mode` · `requires_address` · `trigger_transport_mode`, and a Kind of **transport**
now demands a mode (that half is CARD 24). A green check on a moved surface asserts a proof nobody
performed (OP-14). **Re-run it as written with a Kind that is NOT transport.**

**WAS:** ✅ **COVERED — David, live, 2026-09-08, Test Dave's.** exactly one ticked service landed, at the price shown, `is_active = true`, and the Services list below reloaded to show it.

On **Test Dave's**, tick exactly ONE priced service, set its Charged and Kind, and press the button.
**PASS:** the confirmation names the count and how many services you already had, the Services list
below **reloads and shows the new row**, and the SQL shows exactly one new row with the price you
saw, `is_active = true`. **FAIL:** more than one row lands, or the row is inactive (you pressed a
button and nothing appears at checkout), or the list below does not refresh.

### CARD 14 — 🔴 A SECOND PASS LEAVES THE FIRST PASS INTACT
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Without leaving the page, press **Find my services** again. Then tick a DIFFERENT service and press.
**PASS:** ① the service you saved in CARD 13 is **not offered again** — instead a grey line near the
top reads *"Already on your menu, so not offered again: <name>"*; ② after the second press, SQL shows
**both** rows, and the first one's price is **exactly what it was**; ③ the confirmation says you can
run this again. **FAIL:** the first service is offered a second time, or its price changed, or a
second row with the same name appears.

### CARD 15 — the same name is refused, not overwritten
`STATUS: covered` · `DEVICE: desktop` · `LAST-PROVEN: 2026-09-08 (David, live, Test Dave's)`

✅ **COVERED — David, live, 2026-09-08, Test Dave's.** a renamed row matching an existing service was **refused by name, case-insensitively**, and nothing was written.

Rename a suggested row in its **Name on the menu** box so it matches a service already on your list
(try a different capitalisation — `tc` against `TC`). Tick it and press.
**PASS:** it refuses by name — *"already on your services list… edit the existing one on the Services
card below instead"* — and **nothing is written**. **FAIL:** a duplicate lands, or the existing row's
price changes.

### CARD 16 — correction, not undo
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Take a service you just added and change its price in the Services editor **directly below the review**.
**PASS:** the edit saves on the same page, no navigation, and the new price is what checkout uses.
**FAIL:** the fix is anywhere other than this card. *(There is no undo on this screen by design —
David's ruling: nothing to reverse, because nothing was decided for you.)*

### CARD 17 — the discount rule is stated where you agree to the prices
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**PASS:** a green box reads **"A discount comes off the tree price — never off services."**
**FAIL:** it is missing, or it implies the rule is settable per service. *(D-39, already enforced by
`tierPricing.ts` — this is saying it where she reads it, not deciding it here.)*

---

## PART FOUR — THE SECOND SOURCE

### CARD 18 — the website is a checklist, never a verdict
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Under **WHAT YOUR WEBSITE SAYS**, press **Read my website too** (LAWNS carries `lawnstrees.com`).
**PASS:** the services the site names are listed, each marked *an item in your list uses these words*
or *no item in your list uses these words*, **and no row carries a price**. A sentence says this is
a word search and to read it as a checklist, not a verdict. Crucially: **`deer protection` may say
"no item uses these words" while `DF` — *Deer Fencing* — is on the same screen as a priced service,
and that is correct.** **FAIL:** the screen asserts that you do not offer something, or a price
appears, or `service_offerings` gains any row from this press
*(the website read deliberately sends no `business_id`, because the discovery endpoint SEEDS when it
receives one)*.

---

## PART FIVE — A TRANSPORT SERVICE MUST SAY WHO TRANSPORTS (#293 · R-120)

> ✅ **DAVID CAN RUN EVERY CARD IN THIS PART NOW** — as owner on **Test Dave's**
> (`f7ec5d67-a9ef-4cb0-b807-438d67687d1b`), in the UI or the Supabase **SQL editor**. None needs
> Lauren's or Joel's login, and none needs a terminal. **Run CARD 19 first:** it only reads, and it
> needs no deploy. CARDS 20–24 need GATE 0 — the stamp must match the pushed SHA. **CARD 25 runs
> only after the migration is applied.**
>
> **Story:** *Template-driven service setup — a non-technical owner can't mis-shape a service* (MATCH,
> part-answered). **Ruling:** R-120 — *"pick transport, and the mode field appears and is required."*
> Every card proves a REFUSAL before an acceptance: a form only ever seen accepting is not a proven guard.

### CARD 19 — the half-bound transport rows that exist today — REPORTED, NOT REPAIRED
`STATUS: owed` · `DEVICE: desktop (SQL editor)` · `LAST-PROVEN: —`
**WHO:** David · **TENANT:** every tenant · **READ-ONLY** · **COVERS:** #293 · R-120 ④

Paste into the SQL editor. It changes nothing.
```sql
select b.name as business, so.name, so.category, so.transport_mode, so.requires_address,
       so.is_active, so.timing, so.price_type, so.price_unit, so.price, so.created_at, so.id
  from service_offerings so
  join businesses b on b.id = so.business_id
 where so.category = 'transport'
   and so.transport_mode is null
 order by b.name, so.created_at;
```
**PASS:** it runs. Write down every row: business, name, active. **Zero rows is a pass**, and it means
the migration may be applied. Any rows: each one is a service its customers cannot see at checkout.
**Do not fix them from this card** — which mode each carries is its owner's decision (R-120 ④), and
CARD 23 shows how such a row now looks on the Services list. **FAIL:** the query errors.
⚠️ *Thunder did not run it — no PAT in that session, and the credential read was refused.*

### CARD 20 — 🔴 THE REFUSAL: a transport service with no mode cannot be added
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David, as owner · **TENANT:** Test Dave's · **COVERS:** #293 · R-120 ①

1. Count first: `select count(*) from service_offerings where business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';`
2. `/settings/services` → **+ Add service**. Name `ZZ R-120 test`, price `1`, Category **Transport**.
3. A **Transport mode** select appears. **Leave it on "Choose who transports…"** and press **Add Service**.

**PASS:** the select turns red and reads *"Choose who transports — your staff, or the customer. A
transport service that does not say never appears at checkout."* The form stays open with what you
typed, and the count is **unchanged**. **FAIL:** a row is added — or the select was already on a mode
when it appeared, which is the silent `'staff'` default back.

### CARD 21 — the acceptance, and the address box following the mode
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David, as owner · **TENANT:** Test Dave's · **COVERS:** #293 · R-120 ②

Continue from CARD 20. Choose **Business provides transport (staff)**.
**PASS ①:** **Requires a destination address** ticks itself. Switch to **Customer provides own
transport (self)** — it unticks. Switch back to staff (it ticks), then **untick it by hand**, and
press **Add Service**. Then:
```sql
select name, category, transport_mode, requires_address, trigger_transport_mode, is_active
  from service_offerings
 where business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' and name = 'ZZ R-120 test';
```
**PASS ②:** one row — `transport` · `staff` · **`false`** (your override was kept) · `null` · `true`,
and the list row reads *· your staff transport*. **FAIL:** `transport_mode` null, `requires_address`
true (the override was lost), or a trigger value.
**CLEANUP** (Test Dave's only; refuses to delete anything ever sold):
```sql
delete from service_offerings
 where business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' and name = 'ZZ R-120 test'
   and not exists (select 1 from order_service_selections s where s.service_offering_id = service_offerings.id);
```

### CARD 22 — 🔴 THE REFUSAL ON EDIT: switching a service to Transport demands a mode
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David, as owner · **TENANT:** Test Dave's · **COVERS:** #293 · R-120 ①

On `/settings/services`, press **Edit** on any **add-on**. Change Category to **Transport**: the mode
select appears on **Choose who transports…**. Press **Save**.
**PASS:** refused with the same red sentence, and the editor stays open. Press **Cancel**, then:
```sql
select name, category, transport_mode from service_offerings
 where business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' and category = 'addon' order by name;
```
Every add-on is still an add-on with `transport_mode` null. **FAIL:** it saved as transport with any
mode, or the select opened already on a mode.

### CARD 23 — a half-bound row is SHOWN, cannot be turned On, and checkout NAMES it
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David, as owner · **TENANT:** Test Dave's · **COVERS:** #293 · R-120 ④ · §6 r18
⚠️ **Only BEFORE the migration is applied** — afterwards the row in step 1 cannot exist, and proving that is CARD 25.

1. Make one, switched OFF, on the test tenant:
```sql
insert into service_offerings (business_id, name, category, timing, price_type, price_unit, price, is_active, pre_selected, sort_order)
values ('f7ec5d67-a9ef-4cb0-b807-438d67687d1b', 'ZZ R-120 half-bound', 'transport', 'at_checkout', 'flat', 'order', 1, false, false, 999);
```
2. Reload `/settings/services`. **PASS ①:** under Transport, **ZZ R-120 half-bound** carries a red line —
   *"Customers never see this at checkout — it does not say who transports. Press Edit and choose one."*
3. Press its **Off** button. **PASS ②:** it stays Off and says *"Not turned on. Choose who transports…"*.
4. Press **Edit**. **PASS ③:** the mode select reads **Choose who transports…**, not staff. Press **Cancel**.
5. Make it live — `update service_offerings set is_active = true where business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' and name = 'ZZ R-120 half-bound';`
   — then start a checkout on Test Dave's and reach the services screen. **PASS ④:** the real branches are
   still offered with their real prices, and the amber **Heads up** line names **"ZZ R-120 half-bound"**
   and says it does not say who transports.

**FAIL:** the row is offered with a price, the Off button reports On, the editor opens on staff, or
nothing on either screen names the row.
**CLEANUP:** `delete from service_offerings where business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' and name = 'ZZ R-120 half-bound';`

### CARD 24 — 🔴 THE REVIEW PATH: pick transport, and the mode field appears and is required
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David, as owner · **TENANT:** Test Dave's (needs its QuickBooks read — CARD 2) · **COVERS:** #293 · R-120 ①

Press **Find my services**. On one row under **WE'RE SURE OF THE PRICE**, set **Kind** to `transport`
and tick it. Untick every other row. Count: `select count(*) from service_offerings where business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';`
**PASS ①:** a **Who transports** field appears on **choose…**, bordered red, beside a disabled **Needs a
delivery address** box, and an amber line above the button says a ticked transport service does not say
who transports. Press the button. **PASS ②:** refused, NAMING the row — *"… — Choose who transports…
Nothing was written."* — and the count is unchanged.
Now choose **Business provides transport (staff)**: the address box ticks. Press. **PASS ③:**
```sql
select name, category, transport_mode, requires_address, trigger_transport_mode
  from service_offerings where business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'
 order by created_at desc limit 1;
```
reads `transport` · `staff` · `true` · `null`. **FAIL:** the first press wrote anything, or the row
lands with `transport_mode` null — which is exactly the 2026-09-09 row.
⚠️ This leaves one real row on Test Dave's; remove it by name with CARD 21's cleanup if you do not want it.

### CARD 25 — 🔴 AFTER THE MIGRATION: the database itself refuses, and accepts
`STATUS: owed` · `DEVICE: desktop (SQL editor)` · `LAST-PROVEN: —`
**WHO:** David · **TENANT:** Test Dave's (nothing survives) · **COVERS:** #293 · R-120
⚠️ **Only after `20260911_service_offerings_transport_requires_mode.sql` is applied — and it applies only when CARD 19 returns 0 rows.**

**V1:**
```sql
select conname, convalidated, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.service_offerings'::regclass
   and conname = 'service_offerings_transport_requires_mode';
```
**PASS:** one row, `convalidated = true`, the definition saying `category <> 'transport' OR transport_mode IS NOT NULL`.

**V3 — paste the whole block; both inserts undo themselves:**
```sql
create temp table r120_proof (result text);
do $$
begin
  begin
    insert into service_offerings (business_id, name, category, price_type, price_unit, price)
    values ('f7ec5d67-a9ef-4cb0-b807-438d67687d1b', 'ZZ R-120 probe — no mode', 'transport', 'flat', 'order', 1);
    insert into r120_proof values ('FAIL refusal: a transport row with NO mode was ACCEPTED');
    raise exception 'r120-undo';
  exception
    when check_violation then insert into r120_proof values ('PASS refusal: ' || sqlerrm);
    when raise_exception then if sqlerrm <> 'r120-undo' then raise; end if;
  end;
  begin
    insert into service_offerings (business_id, name, category, price_type, price_unit, price, transport_mode, requires_address)
    values ('f7ec5d67-a9ef-4cb0-b807-438d67687d1b', 'ZZ R-120 probe — staff', 'transport', 'flat', 'order', 1, 'staff', true);
    raise exception 'r120-undo';
  exception
    when raise_exception then
      if sqlerrm = 'r120-undo' then insert into r120_proof values ('PASS acceptance: a transport row WITH a mode was accepted (then undone)');
      else raise; end if;
    when others then insert into r120_proof values ('FAIL acceptance: ' || sqlerrm);
  end;
end $$;
select * from r120_proof;
select count(*) as leftover from service_offerings where name like 'ZZ R-120 probe%';
```
**PASS:** two rows, both starting `PASS`, and `leftover = 0`. **FAIL:** any `FAIL` row or a non-zero
leftover. ⚠️ *Thunder has not watched this block run.* If the editor rejects the temp table, that is
the finding — record it here rather than rewording the card until it passes.

---

## WHAT THIS BOARD DOES NOT COVER

- **Not one card runs on a phone.** This is a desk screen by design (capture=mobile, reconcile=desktop).
- **The ladder is reported, never written.** No card proves a placement price landing anywhere,
  because nothing in this build writes one.
- **The 147→500 import correction is REPORTED, NOT BUILT.** `qboItemAdapter` still filters
  `Type: 'Category'` and nothing else, so the import button still says 647. See §3 item ①.
- **The checkout sentence for a business whose ONLY transport rows are mode-less** (#293) is proven by
  `transport.test.ts` §B/§E, not by a card: producing it live means switching off every real transport
  row on a tenant. CARD 23 proves the neighbouring case — the Heads-up line beside working rows.
- **The discovery seed holding back transport suggestions** (#293, closes #217) has no card: it is
  reachable only through onboarding's website read, which R-101 fences off LAWNS. Proven by
  `serviceOfferingShape.test.ts` §F against a double that refuses what Postgres refuses.
- **Tech-debt #251 — a second staff delivery is never offered** — is pinned by `transport.test.ts` §D and
  deliberately NOT carded: it is an open defect, and a card for it would pass by failing.
