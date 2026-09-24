# OWNER TEST — BASIC CHECKOUT: FOUR TRANSPORT CHOICES, AND AN INSTALL PRICED BY THE TREE'S SIZE

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** An amber **`PREVIEW <branch>`**, **`prod⚠ <branch>`**,
> **`env?`** or **`local`** is **not production**, and a matching SHA does not rescue it. *(tech-debt #280 ②.)*

**Capability:** 2.1 Cart / QR checkout · container sizes · **Ledger:** #386, #399, **#404** · **Rulings:** R-171 (a)–(f), R-172
**Board: 0 of 19 covered** — 18 `owed`, **1 `needs-test` with its reason (CARD 13: a prerequisite I could not establish — read it before planning that run).** Thunder writes the cards and sets `owed`; **only David's live run flips a card to `covered`, with a date.**

🔴 **CARDS 15–18 ARE LEDGER #399 — PLANT YOUR TREE, PRICED BY CONTAINER SIZE.** They need ONE more
migration and ONE more piece of data, both listed at CARD 15. They are the same surface as CARDS 1–14
and deliberately not a second board (STD-011: two documents answering one question drift).

**TENANT:** LAWNS = `ed2e5933-45dc-4b9b-a331-ddfd125e7a74` · Test Dave's = `f7ec5d67-a9ef-4cb0-b807-438d67687d1b`.

🔴 **THREE MIGRATIONS ARE WRITTEN AND HELD. NOTHING BELOW CARD 1 CAN RUN UNTIL YOU APPLY THEM, IN THIS ORDER:**
1. `supabase/migrations/20260923e_container_ladder_install_price.sql` — the per-rung price + LAWNS's seed
2. `supabase/migrations/20260923f_service_offerings_price_source.sql` — how a service says where its price comes from
3. `supabase/migrations/20260923g_manager_holds_order_discount_apply.sql` — the MANAGER's counter permission
Each carries its own verdict-style V-blocks. **Run them in the SQL editor, never the table editor** (§6 r17).

⚠️ **AND ONE PIECE OF DATA: `docs/decisions/2026-09-23-step0-lawns-transport-rows.sql`** — LAWNS's three
missing transport rows. It is DATA, not a migration, and it is what makes CARDS 3–8 have anything to click.

⚠️ **WHAT IS NOT PROVEN BY ANY TEST IN THE REPO.** 40 + 95 + 73 + 27 assertions prove the *judgement*
behind these screens. **Not one of them opens a browser**, and every card below is a statement about
what a person sees or what happens when they press something.

**Story:** ⚠️ **NONE, and I did not invent one.** `user_stories.md` has no story for *"price a service
by the size of the thing being sold."* Recorded OPEN rather than papered over — **a story is owed for
this surface** (§9 story-reconciliation gate: IN CODE BUT NOT ON THE BOARD → flag it and write it).

---

## David can run these now — on **Test Dave's**, with nothing applied

### CARD 1 — the branch wiring, before any migration
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David (OWNER) · **TENANT:** Test Dave's · **COVERS:** #386 · R-171 (e)

Test Dave's already has three transport rows (Delivery staff/flat $125 · Placement Service
staff/per_unit $225 · Self Pickup self/$0). Ring up a 2-tree order and stop at the transport radio.

**PASS:** you see **three** branches — "Delivery + planting", "Delivery only", and the self one — and
each shows a price hint. **This is the unchanged behaviour and that is the point:** one per-order row
means the generic labels are still true, so they are still used (§6 r18).
**FAIL:** any branch is missing, or two read the same words.

### CARD 2 — Placement Service is NOT re-priced by this build
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David (OWNER) · **TENANT:** Test Dave's · **COVERS:** #386 · R-171 (b)

Same order, choose "Delivery + planting", go to Review.

**PASS:** Placement Service reads **`per plant · ×2`** and charges **$450.00** (2 × $225) — exactly as
it did before. **THIS IS THE NEGATIVE CONTROL FOR THE WHOLE BUILD:** Placement Service is the same
SHAPE as LAWNS's new install (staff, per_unit, per plant) and it must keep its flat price, because
per-size pricing is **opt-in per row** and nothing opted it in.
**FAIL:** it says "per container size", or the amount is not $450.00. That means shape is being
inferred instead of read, and some other tenant's service just changed price.

---

## After you apply the three migrations — still on **Test Dave's**

### CARD 3 — the V-blocks
`STATUS: owed` · `DEVICE: desktop (SQL editor)` · `LAST-PROVEN: —`
**WHO:** David · **READ-ONLY after the apply** · **COVERS:** #386

Run each migration, then its V-blocks. **PASS:** every verdict cell reads `PASS`.
🔴 **`20260923b` V5 is different and must be run ON ITS OWN: it is EXPECTED TO ERROR** with
`23514 check_violation`. **That error IS the pass** — it is the constraint refusing a value it should
refuse. If it says `UPDATE 1` instead, the check is not working; the `ROLLBACK` on the next line
undoes the write either way.
**FAIL:** any `FAIL` cell, or V5 succeeding.

### CARD 4 — the MANAGER can now type an amount (R-171 (a))
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** a MANAGER login at Test Dave's · **TENANT:** Test Dave's · **COVERS:** R-171 (a)

🔴 **THIS NEEDS A SECOND LOGIN. Do not run it as the owner** — the owner has always held this string,
so an owner session proves nothing about the ruling.
Sign in as a MANAGER, ring up an order with a service on it, and open Review.

**PASS:** the price-override control is **visible** on the service row, and entering an amount **with
a reason** changes the total. Before this migration a manager saw no such control at all.
**FAIL:** the control is absent (the migration did not reach `business_members`), or it is visible and
the write is refused (the server and client disagree — that is the exact defect the comment at
`CartReview` `canOverride` describes).

### CARD 5 — 🔴 a STAFF login still cannot
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** a STAFF login at Test Dave's · **COVERS:** R-171 (a) — the negative control

**PASS:** no override control anywhere on Review. **FAIL:** it is there. The migration widened one
role and must not have widened two; V4 asserts this in SQL, this asserts it on the screen.

---

## On **LAWNS** — after the step-0 data too

### CARD 6 — five branches, and Tailgate is one of them (R-171 (e))
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David (OWNER) · **TENANT:** LAWNS · **COVERS:** #386 · R-171 (e) · tech-debt #251

Run the step-0 SQL. Ring up a LAWNS order and stop at the transport radio.

**PASS:** **five** branches. Two of them are named **"Trip Charge"** and **"Tailgate Delivery"** — by
their own names, not "Delivery only" twice — plus each of those with planting, plus self-collect.
🔴 **Before this build LAWNS got ONE branch, and Tailgate would not have appeared at all.**
**FAIL:** three branches, or two rows sharing one label. Either means #251 is not actually fixed on
the bundle you are looking at.

### CARD 7 — self-collect exists, and it brings the netting offer back
`STATUS: owed` · `DEVICE: phone` · `LAST-PROVEN: —`
**WHO:** David · **TENANT:** LAWNS · **COVERS:** #386

Choose the self-collect branch. **PASS:** no transport charge, and the netting/tarp offer appears —
LAWNS has never had this branch. **FAIL:** it is missing, or it charges something.
*(Provable without a console: it is all on the screen.)*

### CARD 8 — 🔴 THE PER-SIZE PRICE, SHOWING ITS WORK (R-171 (b))
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David (OWNER) · **TENANT:** LAWNS · **COVERS:** #386 · R-171 (b)

Put **one 15 gal tree and one 45 gal tree** in the cart, choose a branch with planting, go to Review.

**PASS:** the install line reads **`per container size`**, and beneath it one row per tree naming its
RUNG — `1 × <name> · 15 gal … $204.00` and `1 × <name> · 45 gal … $450.00` — totalling **$654.00**.
**FAIL:** one multiplier for both trees, or a total that is 2 × either price. That would mean the
size is not reaching the price.

### CARD 9 — 🔴 A RUNG WITH NO PRICE SAYS "not set" AND BLOCKS THE SEND (R-171 (c))
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David (OWNER) · **TENANT:** LAWNS · **COVERS:** #386 · R-171 (c)

Add a **3/5 gal** tree (88 live LAWNS lots are on that rung and it is deliberately unpriced) to the
same cart.

**PASS, all four:** ① its breakdown row reads **`not set`**, in those words — **never `$0.00`**;
② an amber banner names the tree AND the rung; ③ **both Send buttons are disabled**; ④ the banner
tells you the two ways out — type an amount here, or set the price in Settings → Container sizes.
**FAIL:** a `$0.00`, or a Send button you can still press. **A $0 here is the whole defect the ruling
exists to prevent**, and a pressable Send means the order would go out under-priced.

### CARD 10 — typing the amount releases it
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David (OWNER) · **TENANT:** LAWNS · **COVERS:** R-171 (c)

On CARD 9's cart, use the override on the install row: enter an amount **and a reason**.

**PASS:** the banner turns green, the Send buttons come back, and the total uses your figure.
Then **remove the reason** — **PASS:** it refuses again. (The reason is not decoration: the server
refuses a reasonless override and charges the baseline, STD-013.)
**FAIL:** it accepts an amount with no reason.

### CARD 11 — turning planting OFF is also a way out
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David (OWNER) · **TENANT:** LAWNS · **COVERS:** R-171 (c)

On CARD 9's blocked cart, remove the planting service instead of typing an amount.

**PASS:** the Send buttons come back immediately. **FAIL:** they stay dead — that would mean an
unpriced rung had made the order unsellable, which is the *"never refused"* half of the ruling broken.

### CARD 12 — 🔴 A CONTRACTOR'S INSTALL IS STILL DISCOUNTED (R-171 (d))
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David (OWNER) · **TENANT:** LAWNS · **COVERS:** R-171 (d)

LAWNS has exactly one customer on `CD10%`. Attach them, add a 45 gal tree, choose planting.

**PASS:** the install shows **$450.00** as its baseline and the order charges **$405.00** for it —
the tier reaches the install. **FAIL:** $450.00 is charged. That is a contractor's price silently
going UP because the install moved out of the plant SKU, which is precisely what ruling (d) forbids.

### CARD 13 — 🔴 AND THE QUICKBOOKS INVOICE SURVIVES IT
`STATUS: needs-test` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David (OWNER) · **TENANT:** a tenant with QuickBooks connected · **COVERS:** R-171 (d)(f)

🔴 **`needs-test`, NOT `owed`, AND THE REASON IS A PREREQUISITE I COULD NOT ESTABLISH.** This is the
card that matters most and the one nothing in the repo can prove — and before it can be run at all,
someone has to confirm that a TRACE→QuickBooks push currently succeeds for any order. **I could not
confirm that, and I am recording the measurements rather than assuming either way.**

**WHAT WAS MEASURED, 2026-09-23, read-only:**
- `qboItemMappingOf` (`invoiceLineShapes.ts`) reads **`qbo_item_id`**. A revenue line whose backing
  row lacks it is REFUSED with `QBO_ITEM_UNMAPPED` (422) — deliberately: *"TRACE will not pick one
  — that is how every tree came to book as generic income."*
- `qbo_item_id` exists on **exactly one table: `order_items`** (3,679 of 3,958 populated).
- The goods line passes `backingRow: item.business_inventory`, and `business_inventory` carries
  **`qb_item_id`** (no `o`) — LAWNS **632 of 632** populated with real Intuit ids.
- The service line passes `backingRow: offering`, and **`service_offerings` carries neither column.**
  The install IS a service line, so this is directly in CARD 13's path.
- 19 LAWNS and 14 Test Dave's orders carry a `qb_invoice_id`, **but that does not settle it**: LAWNS's
  came in through the OCR/QuickBooks history door, where the invoice id is READ FROM QuickBooks
  rather than written by a push. Test Dave's most recent is 2026-08-25, three days before the
  item-ref change of 2026-08-30.

**THE ONE CHEAP CHECK THAT SETTLES IT — do this first, on Test Dave's, and it needs no setup:**
ring up ANY ordinary order and press push.
- If it **pushes**, the mapping path works and CARD 13 is merely `owed` — set it up as below.
- If it returns **`QBO_ITEM_UNMAPPED` (422)** naming the lines, then the QuickBooks push is blocked
  for every order on every tenant, CARD 13 cannot run, **and that is a finding worth its own build**
  — it is not caused by #386 and #386 does not fix it.

**IF IT PUSHES — what to set up on Test Dave's, since LAWNS has one CD10% customer in 2,007:**
1. **The tier already exists.** `Contractor tier 1` (10% off retail) with **three** customers on it —
   e.g. **Hillside Landscapes (contractor)**. Nothing to create.
2. **Give Test Dave's a container ladder.** It has **none** (LAWNS is the only tenant with one).
   Settings → Container sizes → add at least `15 gal`, `30 gal` and `45 gal`, and **set an install
   price on each** (any figure; $204 / $425 / $450 mirrors LAWNS). Their sellable stock is sized
   `15`, `30`, `45` — bare numbers, which the resolver reads by number without an alias.
3. **Make an install service that prices from the ladder.** Either flip `Placement Service` to
   `price_source = 'container_ladder'`, **or** — better, because it keeps CARD 2's negative control
   intact — add a NEW transport row: category `transport`, mode `staff`, `per_unit` / `plant`,
   `price_source = 'container_ladder'`.
   ⚠️ **There is no UI for `price_source` yet.** It is one UPDATE in the SQL editor:
   ```sql
   update service_offerings set price_source = 'container_ladder'
    where business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' and name = '<the row you chose>';
   ```
   🔴 **If you flip `Placement Service`, CARD 2 stops being a valid negative control** — say so on
   that card rather than letting it read as passing.
4. **Ring it up:** attach Hillside Landscapes, add ONE 45 gal tree, choose the branch with planting.
   Review should show install at **$450 baseline, $405 charged**.
5. **Push it.**

**PASS:** the invoice is **accepted**, and shows the install at its **retail** figure with a separate
**discount** line.
**FAIL:** QuickBooks rejects it with **6070 — "Amount is not equal to UnitPrice * Qty"**. That is the
2026-07-16 scar; ruling (d) reopened the same door from a different side, and the fix is in this
build. The unit test (`qboInvoiceLines` §J, mutant = the pre-#386 condition) proves the payload
shape; **only this card proves QuickBooks accepts it.**

### CARD 14 — 🔴 IT CHANGES WHAT THE CUSTOMER SEES (R-171 (f))
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** R-171 (f)

Look at CARD 13's invoice as the customer will.

**PASS:** you are content that the install now appears as its **own line** rather than fused into the
tree's price as `Monterrey Oak - 45 gallon (Install & Warranty)`. **History is untouched** — this
applies only to invoices written from TRACE from now on.
🔴 **THIS CARD IS A DECISION, NOT A CHECK.** David's ruling (f) says to flag it before the first real
invoice, *"it changes what the customer sees."* **If you do not like it, say so before LAWNS bills
anybody this way** — it is far cheaper to change now than after a customer has seen both shapes.

---

## LEDGER #399, CORRECTED BY #404 — PLANT YOUR TREE PRICES FROM THE **INSTALL** LADDER

✏️ **THIS SECTION IS REWRITTEN AND ITS PREMISE CHANGED. READ THIS BEFORE THE CARDS.**
#399 gave Plant Your Tree **its own price column** and deliberately seeded none of it, so every
rung read *"not set"*. **David corrected it on 2026-09-24:** *"PLANT YOUR TREE uses the INSTALL
LADDER'S PRICES per container size… 15 gal → the install from ladder."* There is **one price per
rung** and every service that prices by size reads it. The separate "Plant Your Tree price" field
that was in Settings for four hours is **gone**.

🔴 **BEFORE CARD 15, TWO THINGS, IN THIS ORDER:**
1. **`supabase/migrations/20260924e_container_ladder_install_price_check.sql`** — SQL editor, never
   the table editor (§6 r17). It adds the CHECK `install_price` never had, and documents
   `pyt_price` as NOT USED in the database itself. **V3 is live SQL that must ERROR `23514` — that
   error IS the pass.** Measured before it was written: 9 rungs, **0 at zero, 0 negative**, so it
   cannot reject a row.
2. **`docs/decisions/2026-09-24-lawns-pyt-prices-by-size.sql` — the version at SHA `1b7fce4a…`.**
   🔴 **NOT the earlier `624db4da…`** — identical SQL, but it was written when `price_source`
   routed this service to the empty second column. **Run it only AFTER #404 is merged and
   deployed.**

✅ **AND THE PRICES ARE ALREADY THERE, WHICH IS THE WHOLE POINT OF THE CORRECTION.** LAWNS's install
ladder is priced on **6 of its 9 rungs** — 15 gal $204 · 30 $425 · 45 $450 · 65 $650 · 95/100 $800 ·
200 gal $1,800. `slip`, `4 in` and `3/5 gal` carry no price and will ask.

### CARD 15 — a 15 gal Plant Your Tree charges the 15 gal INSTALL price
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #404

Start an order on **Test Dave's**, add ONE 15-gallon tree, and turn on **Plant Your Tree**.
*(Set Test Dave's 15 gal install price first if it has none — Settings → Container sizes.)*

**PASS:** the Plant Your Tree line shows **the same amount as that rung's install price**, and
beside it the words **`by container size · 1 of 1 priced`** instead of *"per plant · ×1"*.
🔴 **FAIL IF IT SHOWS $125** — that is the old scalar price, which means the data file has not run
or the deploy is not live. **$125 is David's own demo figure and nothing should charge it again.**
🔴 **FAIL IF IT SHOWS "not set" ON A RUNG THAT HAS AN INSTALL PRICE** — that is the #399 defect this
build exists to correct, and it is the single thing most worth looking for.

### CARD 15b — 🔴 THERE IS NO SECOND PRICE TO EDIT
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #404 · STD-011

**Settings → Container sizes → any size → Edit.**

**PASS:** there is **exactly one** price field — *"Install price for one tree of this size"* — and
its note says **every service that prices by size reads this one number**. There is **no** separate
"Plant Your Tree price" field.
⚠️ **WHY THIS IS A CARD:** a leftover second field would be editable, would save, and would be read
by nothing — the dead affordance §1.6 item 5 forbids, and the one that drifts is always the field
fewer people look at.

### CARD 16 — 🔴 "I DON'T KNOW WHAT IT'S POTTED IN" SAVES THE ORDER ANYWAY
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #399 — David 2026-09-24

**This is the card the whole build is for.** Same order, but add a tree whose **size is blank or a
size the ladder does not carry** (a 7 gallon does it — LAWNS has no 7 gal rung).

**PASS — all four, and the fourth is the one that matters:**
1. The Plant Your Tree line reads **`Size to be confirmed on install day — priced then, by
   amendment.`** — not *"no size recorded"*, which would read as somebody's mistake.
2. A **blue** box names the tree and says how many are not priced yet.
3. It says **"The order can still be sent"**, and tells you what IS being charged today.
4. 🔴 **THE SEND BUTTON IS LIVE.** Send it.

🔴 **CONTRAST THIS WITH CARD 9 AND SATISFY YOURSELF THE DIFFERENCE IS DELIBERATE.** An unpriced
**install** kills the Send button until somebody types an amount — *"never $0, never a guess, never
refused"*, your ruling of 2026-09-23. An unpriced **planting** does not, by your ruling of
2026-09-24: *"the installer identifies it on the install day and LAWNS AMENDS the order."* **Two
opposite behaviours on one screen is the kind of thing that is right once and confusing forever —
say now if the contrast reads wrong to you.**

### CARD 17 — the unpriced trees are charged NOTHING today, and the total says so
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #399 · STD-012

Take CARD 16's order to the end and look at the total, then open the order again from **Orders**.

**PASS:** the Plant Your Tree line contributes **only the priced trees** (the 15 gal at $90, nothing
for the 7 gal), and the same figure appears on the saved order — **the screen's number and the
server's number agree**, because both ran the same function.
🔴 **WHAT MAKES A $0 CONTRIBUTION HONEST IS THE BLUE BOX ON CARD 16 — NOTHING ELSE.** If you can
reach a total that silently omits a tree *without* that box on screen, **that is a fail and it is the
serious kind**: a customer charged nothing for work LAWNS will do.

### CARD 18 — an unpriced rung says WHY, at a glance, without opening it
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #399 · R-170 / D-9

**Settings → Container sizes.** Read the list without clicking Edit on anything.

**PASS:** on **Settings → Container sizes**, under each size's name and beside its caliper, you see a
new line reading **`install $204.00 (…)`** — the price on screen, followed by the sentence saying
where it came from, with **`not set` shown in amber rather than as a blank**. The Plant Your Tree reasons should say LAWNS has five historical lines and none of them
carries a size.
⚠️ **THE INSTALL PRICE WAS NOT ON THIS LIST BEFORE TODAY** — it has been editable since #386 and
readable only one rung at a time, so *"which sizes do we not price?"* — the exact question the null
path exists to make answerable — took nine clicks. It is **one** number now, because every
ladder-priced service reads it.
