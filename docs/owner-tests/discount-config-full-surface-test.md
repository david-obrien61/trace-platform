# OWNER TEST — DISCOUNTS: WHAT WE FOUND, WHAT WE REFUSED, AND THE TAX RATE THAT MUST SURVIVE

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*

**Capability:** discounts / pricing config · **Ledger:** #279
**Board: 0 of 22 covered** (21 `owed` · 1 `needs-test`).
**TENANT:** LAWNS = `ed2e5933-45dc-4b9b-a331-ddfd125e7a74` · Test Dave's = `f7ec5d67-a9ef-4cb0-b807-438d67687d1b`.
**ACTOR:** the business OWNER on every card unless the card says otherwise. `/discounts` is gated
`pricing_recipe:update`; nothing here mints or asserts any other permission.

**Story:** ⚠️ **OPEN — and I did not close it by inventing one.** `user_stories.md` has a written
story for contractor pricing (*"Set what each contractor tier saves"*, `needs-input`) whose own
`NEEDS:` line asks **where the set-% control lives** — a placement call that is David's and is
unmade. This build does not answer it: it adds a REVIEW above the existing editor and changes no
control's home. The story's settled half is honoured exactly — **[[D-55]]** percent-off-baseline,
**[[D-38]]** flat and owner-managed, storage on `business_pricing_config.config` as a `pricingTiers`
/ `discountTypes` key with **no migration**. Recorded OPEN rather than papered over.

**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to
`covered`, with a date.**

---

> 🔴 **WHY THIS BOARD EXISTS, IN ONE MEASUREMENT.** `business_pricing_config` for LAWNS holds
> `{"taxRate": 0.0825}` and **nothing else** — the whole row, measured 2026-09-07. That single key
> is what checkout prices from, so every customer resolves to the retail floor and a contractor is
> charged retail. Nothing is broken; the config says this business gives no discounts and the app
> believes it.
>
> **THE FIVE CARDS THAT MATTER, IN THE ORDER THEY MUST BE RUN:**
>
> | | Card | What it proves |
> |---|---|---|
> | 1 | **CARD 4** | The evidence is REAL — the percents, counts and dates on screen come from her invoices, and you can check one against QuickBooks. |
> | 2 | **CARD 12** | 🔴 **THE TAX RATE SURVIVES THE WRITE.** Read `taxRate` before and after in SQL. If it moves, stop. |
> | 3 | **CARD 15** | A tagged customer is charged the discount **on the trees and not on the delivery** — the whole rule, at the till. |
> | 4 | **CARD 17** | 🔴 **THE TRAP, PROVEN DELIBERATELY.** One letter's case wrong on the customer tag and they silently pay full price. You need to have SEEN this. |
> | 5 | **CARD 19** | The write REFUSES when the config cannot be read — the failure that would otherwise delete the tax rate. |

---

## PART ONE — THE READ

### CARD 1 — the invitation, before anything is read
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Open `/discounts` as the owner on **Test Dave's**. Above the editor there is a card headed
**"Find the discounts you already give"**.
**PASS:** it explains what it will read, says in amber that it reads your whole invoice history and
**changes nothing in QuickBooks**, and has ONE button. Nothing has been read yet — no rows, no
numbers. **FAIL:** it fetched on load, or it shows any suggestion before you pressed anything.

### CARD 2 — the read runs, on Test Dave's first
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Press **Find my discounts**.
**PASS:** the button says *Reading your books…*, then the review renders. **FAIL:** it hangs with no
state change, or an error appears with no explanation of which read failed.

### CARD 3 — the read on LAWNS
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Same, on LAWNS. This is the real capture: ~1,480 invoices.
**PASS:** it completes and shows sections. **FAIL:** an incomplete read renders anyway — the screen
must REFUSE with *"the invoice read came back incomplete — N of M"* rather than show short counts.

### CARD 4 — 🔴 THE EVIDENCE IS CHECKABLE
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Read the **WE FOUND THESE AND WE'RE SURE** rows. Each says: used on **N invoice lines** at a clean
**X%** every time, last used **a date**, and (where the item matched) *"your books hold it as item
`<id>`, '<description>', published at X%"*.
**PASS:** pick ONE row, open QuickBooks, find that item id, and confirm the published rate. Then
confirm the "last used" date against a recent invoice carrying it.
🔴 **THE POINT OF THIS CARD: nothing on this screen is typed into our code.** Every number was
measured from your books. If a count looks wrong, the finding is real and I want to know.
**FAIL:** any number you cannot trace to your own books.

### CARD 5 — two sources, and the screen says when they agree
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**PASS:** a row whose QuickBooks item publishes `−0.10` and whose invoices did 10% says
*"— which agrees with what the invoices did"*. A row where they do NOT agree says only what each
one says, and claims no agreement. **FAIL:** an agreement claimed where one side has no number.

### CARD 6 — what we REFUSED, and why
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Look at **WE FOUND THESE AND WE CAN'T TELL YOU THE PERCENT**.
**PASS:** each row names its reason in plain words — *"used on N lines, but at 3 different rates —
10% on 8, 15% on 2, 20% on 1"*, or *"not one of them records what the percentage was taken from"* —
and carries **no percent at all**, with an empty box for you to type one.
🔴 **FAIL: a refused row showing a number.** A rate we could not measure must never appear as a
suggestion, however plausible.

### CARD 7 — your spreadsheet's tiers, and why they are missing
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Look at **YOU NAMED THESE AND WE'RE NOT SUGGESTING THEM**.
**PASS:** *Contractor 35%* and *Contractor 25%* are both listed, each marked **not created**, each
saying *"there is no such item in your books and no invoice has ever charged it"*.
**FAIL:** they are silently absent, or they were seeded as tiers. *(Two real tiers beat four
half-real ones — David, and this section is the answer to the question he predicted you'd ask.)*

### CARD 8 — 🔴 THE RULE IS ON THE SCREEN
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**PASS:** a green box reads **"A discount comes off the tree price — never off services."** and names
delivery, placement, trip charge and add-ons as always charged in full, and says you do not set this
per tier. **FAIL:** it is absent, or it implies the rule is configurable.

### CARD 9 — the exact-string warning
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**PASS:** an amber box says the tier name is matched letter for letter including capitals, and shows
the `cd10%` vs `CD10%` example. **FAIL:** absent. This warning is what CARD 17 proves is true.

---

## PART TWO — THE WRITE

### CARD 10 — editing a row before accepting
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Press **Edit** on a sure row. Change the discount type, the tier name and the percent.
**PASS:** the price column follows what you typed; a blank or non-numeric percent reads **"you set
it"** in amber rather than `0%` or `NaN%`. **FAIL:** an empty percent renders as a number.

### CARD 11 — the footer counts what YOU ticked
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Untick a row.
**PASS:** the button text changes to *"Add the N I've ticked"*; unticking everything disables it and
it reads *Nothing selected*. **FAIL:** the button offers to add rows you unticked.

### CARD 12 — 🔴 THE TAX RATE SURVIVES. RUN THIS ONE CAREFULLY.
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**BEFORE**, in the Supabase SQL editor:
```sql
SELECT config->'taxRate' AS tax, config ? 'discountTypes' AS has_discounts,
       jsonb_object_keys(config) AS keys
FROM business_pricing_config WHERE business_id = '<tenant>';
```
Then press **Add the N I've ticked**. Then run it again.
**PASS:** `tax` is **byte-identical** before and after (`0.0825` on LAWNS), `has_discounts` is now
true, and the plumbing keys (`version`, `unitLabel`, `denominators`, `margin`, `locations`,
`priceReference`) are present. The screen says *"…and your sales-tax rate is untouched at 8.25%"*.
🔴 **FAIL — AND THIS IS A STOP: `tax` is absent or changed.** `mergePricingConfig` fails open on an
unreadable row, and a lost tax rate means every invoice after it charges $0 tax under a redline.
If this fails, do not take an order until it is fixed.

### CARD 13 — the plumbing arrived empty, not guessed
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
```sql
SELECT config->'margin'->>'baseline' AS baseline,
       config->'locations'->0->'labor' AS labour
FROM business_pricing_config WHERE business_id = '<tenant>';
```
**PASS:** `baseline` is `0.40`, and `labour` reads `{"rate": null, "hours": null, …}` — **null, not
0**. A zero wage is a claim; null is an honest "not set". **FAIL:** any labour number was invented.

### CARD 14 — the editor below now shows what you accepted
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**PASS:** without reloading, the Discount-types editor underneath re-reads and shows the new type(s)
and tier(s), each with its percent, all editable as normal. **FAIL:** you have to refresh to see them.

### CARD 15 — 🔴 THE DISCOUNT AT THE TILL, ON THE TREES ONLY
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Tag a customer with one of the new tiers on the Customers page — **copy the name exactly**. Ring up
an order with a tree AND a delivery or placement service. Reach the confirmation screen.
**PASS:** the totals read `Goods subtotal (retail)` → `<your tier> −$X` → `Goods after discount`,
then a **Services · no tier discount** heading with the service at full price.
**FAIL:** the discount touched a service line, or no discount applied at all (if so → CARD 17).

### CARD 16 — the same maths on the order afterwards
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Open that order from the roster.
**PASS:** the identical three-line goods block and the services heading. It is the same renderer
reading the stored breakdown — nothing is recomputed. **FAIL:** the two screens disagree by a penny.

### CARD 17 — 🔴 THE TRAP. PROVE IT DELIBERATELY, ONCE.
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Tag a test customer with the tier name **in the wrong case** — `cd10%` where the tier is `CD10%`.
Ring up a tree.
**PASS (i.e. the trap is real):** they are charged **full price**, with **no warning anywhere**.
🔴 **THIS CARD PASSES BY SHOWING YOU SOMETHING BAD.** `customers.price_tier` is matched exactly and
case-sensitively; an unrecognised tier resolves to the retail floor, silently, by design (an
unknown tier must never discount). That is why CARD 9's warning is on the screen. **Undo the tag
before you move on.**

### CARD 18 — nothing already configured is offered twice
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Press **Find my discounts** again, after CARD 12.
**PASS:** the tiers you just added appear under *"Already set up, so not offered again"*, not as new
suggestions. **FAIL:** the same tier is offered a second time.

---

## PART THREE — THE FAILURE PATHS, WHICH ARE THE POINT

### CARD 19 — 🔴 AN UNREADABLE CONFIG REFUSES TO WRITE
`STATUS: needs-test` · `DEVICE: desktop` · `LAST-PROVEN: —`
**REASON IT IS `needs-test`:** forcing this state live means revoking `pricing_recipe:read` from the
owner mid-session, and there is no safe way to do that on a tenant you are about to demo. It is
proven in the harness instead — `discountReview.test.ts` §E ① and mutant **P1**, which deletes the
refusal and is caught. **If you want it live:** sign in as a MANAGER (who lacks the grant), reach
`/discounts` — the route gate should stop you first, which is itself the answer.
**PASS:** the write refuses with *"we could not read this business's pricing settings, so nothing
was written… writing now would replace the whole record — including your sales-tax rate"*.

### CARD 20 — a save that lands nothing says so
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**PASS:** if the write is refused by policy, the screen says *"the save reported no error but nothing
came back changed, which usually means permission was refused. Nothing was written."*
🔴 **FAIL: a green "Saved" with nothing in the table.** `writePricingConfig` upserts without
`.select()`, so a refused write returns no error — the only honest confirmation is the read-back.

### CARD 21 — QuickBooks disconnected
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
On a tenant with no QuickBooks connection, press **Find my discounts**.
**PASS:** a plain error naming what failed, and the editor below still works — you can add tiers by
hand. **FAIL:** the screen shows suggestions it could not have read, or blocks the editor.

### CARD 22 — ✏️ THE BOOKS FINDING NO LONGER CALLS CORRECT BEHAVIOUR BROKEN
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Settings → Accounting → read the invoice books → find **"discounts that do not work"**.
**PASS:** it no longer says *"5 discount items did not take their percentage off the whole invoice…
some customers got less off than the name suggests"*. Instead it says taking the percentage off part
of the invoice **is CORRECT** — *"it comes off the trees and never off delivery, placement or a trip
charge"* — and only flags a discount that does not record what it was worked out from, or one worked
out on more than the whole invoice.
🔴 **WHY THIS CHANGED:** the old rule scored the INTENT as a defect and then offered to "fix" it,
which would have meant discounting your own labour.
**FAIL:** the old sentence, or a question asking you to fix tree-only discounting.
