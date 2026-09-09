# OWNER TEST — DISCOUNTS: WHAT WE FOUND, WHAT WE REFUSED, AND THE TAX RATE THAT MUST SURVIVE

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*

**Capability:** discounts / pricing config · **Ledger:** #279, corrected by **#280**
**Board: 2 of 25 covered** (22 `owed` · 1 `needs-test`) — **CARD 12 and CARD 15 proven live 2026-09-08.**

> 🔴 **EVERY CARD BELOW WAS WRITTEN AGAINST `2f94fbb`, WHICH RENDERED DOLLARS AS PERCENTAGES.**
> David owner-proved it 2026-09-07 15:53 and the screen read *"Military Discount · used on 9
> invoice lines, but at 6 different rates — 0% on 3, 2500% on 1, 3250% on 1, 6000% on 1, 9000% on
> 1, 18250% on 1."* **18250% is $182.50.** The rate was divided by `Qty`, which is 1 on every one
> of those lines, so every "percent" was the dollar amount ×100. **"0 we're sure about" was an
> artifact of the arithmetic**, and CD10%/CD15% were absent from the screen entirely because they
> have never been used as item lines. **Do not re-run this board against `2f94fbb`.** CARDS 4, 6
> and 23–25 are new or rewritten; the rest hold.
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
> | 0 | **CARD 23** | 🔴 **NO NUMBER ON THE SCREEN EXCEEDS 100%.** Ten seconds, and it is the whole of the 2026-09-07 defect. Do this before anything else. |
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

### CARD 4 — 🔴 THE EVIDENCE IS CHECKABLE, AND IT NOW COMES FROM THREE PLACES
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Read the **WE FOUND THESE AND WE'RE SURE** rows. Each carries up to three evidence lines, and the
chips say which is which:
- **YOUR PRODUCT LIST** — *"your books hold this as item 3, 'Contractor Discount, 10%', set up at
  10% off"*. **This is where the suggested percent comes from.** It is read, not worked out.
- **INVOICES** — *"a 10% discount was recorded on 14 invoices for 13 customers, $3,293.25 in
  total, last on 15 August 2026"*. QuickBooks recorded that rate itself.
- **WORKED OUT** (blue chip) — only where the discount was used as a product line. It spells the
  arithmetic out: *"$250 off $3,400 of other charges = 7.35%"*.

**EXPECT, on LAWNS:** six rows — Military Discount 5%, Military Discount 5 5%, FD10 10%, Customer
Discount 10%, **CD10% 10%, CD15% 15%**.
**PASS:** pick ONE row, open QuickBooks, find that item id, confirm the published rate. Then check
one WORKED OUT line's arithmetic yourself.
🔴 **CD10% AND CD15% ARE THE TWO THAT WERE MISSING BEFORE — they have no invoice item lines at all,
and they must still appear.** If either is absent, the screen is still building rows from the wrong
population.
**FAIL:** any number you cannot trace to your own books.

### CARD 5 — 🔴 THE SCREEN ADMITS WHAT IT CANNOT TELL YOU
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Read the INVOICES line on **CD10%**, **FD10** and **Customer Discount**.
**PASS:** each shows the same 14 invoices at 10% — **and each carries an amber warning naming the
other two**: *"2 other products (Customer Discount, FD10) are also set up at 10%, and QuickBooks
does not record which one a discount came from — so these may not all be this one."*
**Then read CD15%: it has NO such warning**, because nothing else is set up at 15%.
🔴 **WHY THIS CARD EXISTS:** a QuickBooks discount line carries a rate and **no name** — all 67 of
yours point at one account, *Discounts given*. Attributing those 14 lines to CD10% specifically
would be a number we made up. **FAIL:** the warning is missing on a shared rate, or present on
CD15%.

### CARD 6 — what we REFUSED, and why
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Look at **WE FOUND THESE AND WE CAN'T TELL YOU THE PERCENT**.
**EXPECT, on LAWNS: exactly one row — `MD10`** — saying its item has **no discount percent recorded
on it** *"even though its description mentions one"*. That is a real disagreement inside your books:
`MD10` is priced at **$0** while its description reads *"Military Discount  -10%"*. We will not pick
between them for you. The 10% worked out from its two invoice lines is shown as evidence, and you
can accept it by typing it.
**PASS:** the row carries **no suggested percent**, an empty box, and a reason in plain words.
🔴 **FAIL: a refused row showing a suggested number.** A rate we could not stand behind must never
appear as a suggestion, however plausible.

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
`STATUS: covered` · `DEVICE: desktop` · `LAST-PROVEN: 2026-09-08 (David, live)`

✅ **COVERED — David, live, 2026-09-08.** `taxRate` held at **0.0825** across the config write. The
STOP condition on this card did not fire: `mergePricingConfig` did not fail open, and no invoice was
left charging $0 tax under a redline.

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
`STATUS: covered` · `DEVICE: desktop` · `LAST-PROVEN: 2026-09-08 (David, live, Test Dave's)`

✅ **COVERED — David, live, 2026-09-08, Test Dave's.** The percent-discount defect (#280 — *the
percents were dollar amounts*) is **owner-proved fixed**. Review renders the three-line goods block
with **services untouched**, and **the button quotes the same total the confirmation charges**:
**$900 → −$90 → $810 → tax $61.56 → $871.56, on both screens.**
🔴 **The second half of that sentence is R-110 ① — the button quotes the order — proven here for the
first time on any tenant.** ⚠️ **It does NOT close `report-fidelity` CARD 1**, which is a different
tenant, a different customer and a different defect: LAWNS, `LEANDER AREA WHLS NRSY SPLY` on `CD10%`,
`DEVICE: phone`. That card stays `owed` and it is the one that matters for Tuesday.

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

---

## PART FOUR — THE 2026-09-07 CORRECTION. RUN CARD 23 FIRST.

### CARD 23 — 🔴 NO NUMBER ON THE SCREEN EXCEEDS 100%
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Read every percent on the whole page — the sure rows, the refused rows, the rates-nothing-names
section, the price column on the right.
**PASS:** the largest number on the page is **15%**. Nothing reads 2500%, 3250%, 18250% or anything
else above 100.
🔴 **THIS IS THE WHOLE DEFECT IN ONE LOOK, AND IT TAKES TEN SECONDS.** On `2f94fbb` every one of
those numbers was a dollar amount with a percent sign on it — `18250%` was $182.50. If you see any
number above 100 here, stop and tell me; the arithmetic is wrong again and nothing else on this
board is worth running.
**FAIL:** any percent above 100, anywhere on the page.

### CARD 24 — RATES YOUR BOOKS USED THAT NOTHING NAMES
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Find the section **YOUR INVOICES USED THESE RATES AND NOTHING NAMES THEM**.
**EXPECT, on LAWNS: three rows.**

| Rate | Times | Total | Customers |
|---|---|---|---|
| **20%** | 4 | **$15,173.00** | 3 |
| 25% | 1 | $650.00 | 1 |
| 50% | 1 | $250.00 | 1 |

🔴 **THE 20% ROW IS THE LARGEST MONEY ON THE PAGE AND NO SURFACE HAS EVER SHOWN IT TO YOU.**
$15,173 given away at a rate no product in your list is set up for. It is not seeded and no name is
invented for it — if it is a real programme, you name it.
**PASS:** all three rows, with those amounts. **FAIL:** the section is absent, or a rate that IS
named (5%, 10%, 15%) appears in it.

### CARD 25 — FIXED-DOLLAR DISCOUNTS ARE MONEY, NOT PERCENTAGES
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
Below that section.
**EXPECT, on LAWNS:** *"6 discounts were given as a flat amount rather than a percentage,
$1,162.03 in total."*
**PASS:** it says exactly that, and explains *"the invoice does not say what they were a percentage
of — turning one into a percent would be a guess."*
🔴 **FAIL: any of those six rendered as a percent.** $461.96 is not 46196%, and that conversion is
the same mistake that produced the defect this part of the board exists for.
