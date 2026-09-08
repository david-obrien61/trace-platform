# OWNER TEST — REPORT FIDELITY: FIVE SURFACES THAT ASSERTED WHAT THEY DID NOT MEASURE

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*
>
> ✅ **MERGED TO `main` 2026-09-08 and DEPLOYED — confirmed, not assumed.** The work landed as
> `592a039`; the live bundle was then polled until it carried the SHA of main's HEAD, observed
> moving `ac90ec9` → `592a039` → the current head. ⚠️ **Match the stamp to
> `git log --oneline origin/main -1`, NEVER to a SHA written here** — every push to `main`, docs
> included, rebuilds the tree and moves the stamp, so a SHA typed into a file goes stale the next
> time anyone commits.

**Capability:** checkout · customers roster · catalogue import · person-name display
**Ledger:** #282 · **Rulings:** [[R-110]], [[R-111]]
**Board: 0 of 11 covered** (10 `owed` · 1 `needs-test`).

> 🔴 **NOT ONE ASSERTION IN THIS BUILD OPENED A BROWSER, AND FOUR OF THE FIVE DEFECTS ARE THINGS A
> PERSON READS.** 42 probes and 13 mutants prove the code says the right thing. They cannot prove
> the screen does. **Two of these surfaces are customer-facing and Terry sees them on Tuesday.**

**TENANT:** LAWNS = `ed2e5933-45dc-4b9b-a331-ddfd125e7a74` · Test Dave's = `f7ec5d67-a9ef-4cb0-b807-438d67687d1b`.
**ACTOR:** the business OWNER unless a card says otherwise. **No new permission string** is minted
or asserted anywhere in this build.

**Story:** ⚠️ **OPEN, and not invented.** `user_stories.md` carries no story for "a surface reports
what it did". These five are defect repairs against surfaces whose stories already exist
(checkout, the customers roster, the catalogue import); none of those stories' settled behaviour
changes. Recorded OPEN rather than papered over — same call as #277 and #278.

---

## ① THE REVIEW PAGE — the button must quote the order

### CARD 1 — a tiered customer is charged what the button said
`STATUS: owed` · `DEVICE: phone` · `LAST-PROVEN: —`
On **LAWNS**, start an order for **LEANDER AREA WHLS NRSY SPLY** (the one customer on `CD10%`).
Add one tree. Go to `/checkout/review`. **Write the button's number down.** Place the order.
**PASS:** the total on `/checkout/confirm` is **the same number that was on the button** — and
Review showed `Goods subtotal (retail)` → `CD10% — 10% off` → `Goods after discount` → tax → total
before you pressed it. **FAIL:** the two differ by any amount. *(This is the defect that was live:
$974.25 on the button, $876.83 charged. It is money the customer reads.)*

### CARD 2 — the tier survives being typed in rather than attached
`STATUS: owed` · `DEVICE: phone` · `LAST-PROVEN: —`
Same customer, but reach checkout through **CustomerCapture** — type an email that is **not** on
their record (theirs is blank).
**PASS:** Review still shows the CD10% discount and the correct total. **FAIL:** Review shows
retail. *(This is the exact path that broke: the tier used to be looked up by EMAIL, and this
customer has none, so it silently resolved to retail while the server charged CD10%.)*

### CARD 3 — a retail customer is not given a discount that does not exist
`STATUS: owed` · `DEVICE: phone` · `LAST-PROVEN: —`
Repeat CARD 1 with any of the other 29 LAWNS customers (all `retail`).
**PASS:** no discount lines appear, no tier badge, and Review's total equals Confirm's.
**FAIL:** a discount line or badge appears. *(The negative control: a fix that made everything
discounted would pass CARD 1 and be worse than the bug.)*

### CARD 4 — the covering sentence is gone
`STATUS: owed` · `DEVICE: phone` · `LAST-PROVEN: —`
Read the Review page carefully, top to bottom.
**PASS:** nothing says *"applies at checkout — the invoice total reflects it."* **FAIL:** it is
still there. *(Review IS checkout. The sentence was covering for a total that did not include the
discount, and a promise that the real number comes later is how a wrong number survives a test.)*

---

## ② THE CONFIRMATION — nothing claims a send that did not happen

### CARD 5 — test mode, pay at the office
`STATUS: owed` · `DEVICE: phone` · `LAST-PROVEN: —`
With QuickBooks writes OFF (LAWNS is `qbo_writes_enabled = false` today, measured), place an order
and choose **"I'll pay at the office"**.
**PASS:** the green header says **"Order saved for <email>"** and **nothing anywhere on the page
says an invoice was sent or emailed.** **FAIL:** any wording claiming a send. *(It used to read
"Invoice sent to leander@mail.com" directly above a badge saying the invoice was NOT sent.)*

### CARD 6 — writes on, invoice created
`STATUS: needs-test` · `DEVICE: phone` · `LAST-PROVEN: —`
**REASON IT IS NOT `owed`:** proving this needs `qbo_writes_enabled = true` on a real tenant, which
raises a real invoice in LAWNS's live QuickBooks. That is a decision, not a test step. When it is
run: the header should say **"Invoice created in QuickBooks for <email>"** — created, never *sent*.
⚠️ **THE PLATFORM STILL DOES NOT EMAIL THE INVOICE**, in any state: the push sets `BillEmail` and
never calls QuickBooks' send endpoint. If a real send is ever wired, the copy may change and
`reportFidelity.test.ts` §C is the probe that will tell you.

---

## ③ THE UNDO REPORT — it may not invent a number

### CARD 7 — the undo says what it did, and proves it
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
🔴 **RUN THIS WITH THE BROWSER CONSOLE OPEN — that is the point of the card.** On **Test Dave's**,
run the full loop: Preview → Import → Undo.
**PASS:** the sentence names a real number of customers, and beneath it reads **"Checked
afterwards: no customer row still carries this run."** **FAIL:** it says `0 imported customers`
over a run that created thousands — in which case **capture `[TRACE:CUSTIMPORT] undo` and
`[TRACE:QBITEMS] ui` from the console.**
⚠️ **THIS IS THE ONE DEFECT OF THE FIVE THAT IS NOT FIXED.** The live mechanism was not reproduced
— every link in the chain was verified and each carries the right number — so what changed is that
the surface can no longer print a number it was not given. **Those two log lines are what tech-debt
#213 needs**: they distinguish "`customers` arrived null" from "`deleted` arrived 0", which are
different bugs.

---

## ④ THE CUSTOMERS HEADER — a list may not report its cap as the truth

### CARD 8 — the header counts the table, not the page
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Import the customers so the roster exceeds 1,000 rows, then open `/customers`.
**PASS:** the header reads **`showing 1000 of 1964 customers`** (or the full count if every row
loaded). **FAIL:** it reads `1000 of 1000`. *(The screen was not truncating — it was asserting. The
1,000th customer was the last one that existed as far as the roster could tell.)*

### CARD 9 — 🔴 INVENTORY WAS ALREADY RIGHT AND MUST NOT BE MADE TO HEDGE
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Open `/inventory` on LAWNS.
**PASS:** the header still reads **`647 of 647 items`** — plain, no "showing". **FAIL:** it now
says "showing", or the number changed. *(Inventory told the truth in the same session for one
reason: 647 is under the cap. A fix that made every grid hedge would have regressed the screen that
was already correct.)*

---

## ⑤ NAMES — a person with one name is not called "null"

### CARD 10 — the 39 mononyms
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
After a customer import, open `/customers` and search for **Tina**, **Syed**, **Wade**, **Leonel**,
**Kenny**.
**PASS:** each renders as just their name. **FAIL:** any row reads `<name> null`.
⚠️ **CANNOT BE PROVEN AT BASELINE** — LAWNS holds 30 customers today and **all 30 carry both
names** (measured: zero rows with a NULL `last_name`). The 39 arrive with the import, which is why
this card needs one.

### CARD 11 — the same name everywhere else
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
With a mononym customer, look at: their **customer detail** page, an **order** they appear on,
`/orders`, `/deliveries`, the **operations calendar**, and the **delivery route** list.
**PASS:** the same name, no `null`, on every one. **FAIL:** any surface shows `null` or a stray
double space. *(There were twelve places assembling a name by hand. Two were already guarded, which
is why this looked intermittent rather than broken — and a JSX `{a} {b}` renders null as nothing
while a template literal renders it as four characters.)*
