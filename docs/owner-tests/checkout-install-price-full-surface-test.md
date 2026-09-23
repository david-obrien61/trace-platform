# OWNER TEST — BASIC CHECKOUT: FOUR TRANSPORT CHOICES, AND AN INSTALL PRICED BY THE TREE'S SIZE

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** An amber **`PREVIEW <branch>`**, **`prod⚠ <branch>`**,
> **`env?`** or **`local`** is **not production**, and a matching SHA does not rescue it. *(tech-debt #280 ②.)*

**Capability:** 2.1 Cart / QR checkout · container sizes · **Ledger:** #386 · **Rulings:** R-171 (a)–(f), R-172
**Board: 0 of 14 covered** (14 `owed`). Thunder writes the cards and sets `owed`; **only David's live run flips a card to `covered`, with a date.**

**TENANT:** LAWNS = `ed2e5933-45dc-4b9b-a331-ddfd125e7a74` · Test Dave's = `f7ec5d67-a9ef-4cb0-b807-438d67687d1b`.

🔴 **THREE MIGRATIONS ARE WRITTEN AND HELD. NOTHING BELOW CARD 1 CAN RUN UNTIL YOU APPLY THEM, IN THIS ORDER:**
1. `supabase/migrations/20260923_container_ladder_install_price.sql` — the per-rung price + LAWNS's seed
2. `supabase/migrations/20260923b_service_offerings_price_source.sql` — how a service says where its price comes from
3. `supabase/migrations/20260923c_manager_holds_order_discount_apply.sql` — the MANAGER's counter permission
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
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David (OWNER) · **TENANT:** a tenant with QuickBooks connected · **COVERS:** R-171 (d)(f)

Push CARD 12's order to QuickBooks.

**PASS:** the invoice is **accepted**, and shows the install at its **retail** figure with a separate
**discount** line. **FAIL:** QuickBooks rejects it with **6070 — "Amount is not equal to UnitPrice *
Qty"**. 🔴 **This is the card that matters most and the one nothing in the repo could prove:** it is
the 2026-07-16 scar, and ruling (d) reopened the same door from a different side. It needs a
discount-tier customer AND an install — a combination nobody rings up by accident.

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
