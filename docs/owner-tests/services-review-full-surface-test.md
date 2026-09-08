# OWNER TEST — SERVICES: WHAT WE FOUND, WHAT WE REFUSED, AND THE $0 THAT MUST NEVER LAND

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*

**Capability:** services / `service_offerings` · **Ledger:** #283
**Board: 0 of 18 covered** (18 `owed`).

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
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
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
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
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
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
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
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Tick a row under **WE CAN'T TELL YOU THE PRICE** and leave its price box empty. Then type `0` into it.
**PASS:** an amber line appears above the button — *"a service saved at $0 tells a customer it is
free"* — and pressing the button saves **nothing** and says so. Then run
`select name, price from service_offerings where business_id = '<tenant>' order by created_at desc;`
and confirm no new row. **FAIL:** anything is written, or a $0 row lands, or a good row lands beside
the bad one *(the write is all-or-nothing on purpose)*.

### CARD 13 — the first pass writes what you ticked, and only that
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
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
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
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

## WHAT THIS BOARD DOES NOT COVER

- **Not one card runs on a phone.** This is a desk screen by design (capture=mobile, reconcile=desktop).
- **The ladder is reported, never written.** No card proves a placement price landing anywhere,
  because nothing in this build writes one.
- **The 147→500 import correction is REPORTED, NOT BUILT.** `qboItemAdapter` still filters
  `Type: 'Category'` and nothing else, so the import button still says 647. See §3 item ①.
