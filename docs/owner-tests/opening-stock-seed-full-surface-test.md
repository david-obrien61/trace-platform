# OWNER TEST — THE OPENING STOCK SEED: A STARTING NUMBER THAT NEVER PRETENDS TO BE A COUNT

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** An amber **`PREVIEW <branch>`**, **`prod⚠ <branch>`**,
> **`env?`** or **`local`** is **not production** — a preview serves the RIGHT CODE at the WRONG
> TARGET, and the SHA being right does not rescue it (tech-debt **#280 ②**). **If the chip is
> amber, stop.**
> *(GATE 0 · OP-15.)*

**Capability:** 5.1 inventory (the seed) · 3.5 QuickBooks (the rule and its storage).
**Story:** `user_stories.md` → *The imported catalogue can be sold from* (ARC: `cost-to-produce`).
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 17 covered** (16 `owed` · 1 `needs-test`; CARDS 15–16 added by #342, CARD 17 by #366).
**DEVICE:** mostly `desktop` — this is a setup surface and setup is a desk job. CARD 11 is
`DEVICE: phone`, because the picker is where the original defect was visible and it must be
provable **without a console**.

> 🔴 **MIGRATION GATE — CARDS 4, 5 AND 12 ARE BLOCKED UNTIL YOU APPLY ONE FILE.**
> `supabase/migrations/20260908_books_report_runs.sql` creates `books_report_runs` and
> `books_report_results`. It is in your tree and **has not been run.** Apply it **as `postgres`,
> in the SQL editor — never the dashboard TABLE EDITOR** (§6 r17: a table made in the table editor
> arrives with TRUNCATE and REFERENCES granted to `anon`, which RLS cannot filter).
>
> **Un-applied, nothing here breaks and that is exactly the hazard:** the seed screen falls back to
> *"we have no sales history to go on"*, which is a REAL and HONEST answer it gives legitimately —
> so an un-applied migration is indistinguishable from a business with no invoices. **Run the
> file's own V1–V6 verification block afterwards and paste the output back.**
>
> ⚠️ **NO OTHER MIGRATION IS NEEDED BY THIS BUILD.** The seed's ledger kind
> (`opening_stock_seed`) needs none: `business_inventory_ledger.kind` carries **no CHECK
> constraint**, deliberately — its own migration says *"the value set grows without a migration"*
> (`20260720_inventory_movement_ledger.sql:159`). **No schema, no policy, no permission string.**

> ✏️ **LEDGER #342 (2026-09-16) — IN TEST MODE THE SEED WRITES NO LEDGER ROW.** David: *"we must never
> allow them to write to the actual record during testing."* In test mode the seed sets qty on
> **imported rows only** and writes nothing permanent, so the import **can still be undone** — the
> paragraph below, and CARDS 8 and 13, describe **LIVE mode** only. CARDS 15–16 are the test-mode half.
> ⚠️ The opening line owed after the switch is **not written by anything yet** (tech-debt #308).

> 🔴 **(LIVE MODE) ORDER MATTERS AND IT IS NOT REVERSIBLE. DO THE CATALOGUE IMPORT FIRST, THE SEED LAST.**
> The import writes `qty 0` and no ledger rows, so it can be wiped and reloaded freely (R-93). The
> **seed writes a permanent ledger row against every product it touches** — and a lot with ledger
> history **cannot be deleted**: `business_inventory_ledger.inventory_id` is `ON DELETE SET NULL`,
> SET NULL is an UPDATE, and the append-only trigger refuses UPDATEs with no exemption
> (`20260720…:136-151`, *observed live*). **So once you seed, "Undo the import" will fail on the
> seeded rows.** The panel says this in its own closing sentence. See CARD 13, which is the card
> that proves it, and tech-debt **#304**.

---

## CARD 1 — the panel is there, and it explains the state before it asks for anything
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Sign in as the **owner**. Go to **Settings → Accounting**, scroll past *Import products & services*.

1. A panel headed **Starting numbers** is there.
2. Its first paragraph names **two numbers** — how many products have no count, out of how many
   products you have — and calls what came from QuickBooks a **price card**.
3. It says those products read **“None in stock”** and cannot be added to an order.

**PASS:** you can tell, without being told by us, why the catalogue is unusable right now.
**FAIL:** the panel is missing, or it opens by asking for a number before saying why.

---

## CARD 2 — 🔴 THE REASON THE NUMBER SHOULD BE LOW IS ON THE SCREEN, NOT IN A DOC
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Still on the panel, read the paragraph above the input box.

1. It tells you to pick a **low** number.
2. It gives the reason: a low number **runs out sooner**, and running out is what **sends somebody
   out to count** — which is the only thing that puts a true number in.
3. It says a big number stops anything running out, and the guess becomes the answer.

**PASS:** the reason is there in words an owner would use.
🔴 **This is the whole mechanism, not a nicety.** A suggestion without its reason is a number
somebody will simply raise the first time it blocks a sale.
**FAIL:** the number is asked for with no reason, or the reason is ours ("for safety") rather than
theirs.

---

## CARD 3 — the ceiling refuses, and says why
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Type **500** into the box.

1. The **Set starting numbers** button greys out.
2. Red text appears saying **50 is the most**, and gives the reason — a big starting number stops
   anything running out.
3. Type **0** → refused, *"a starting number of zero is the state you are already in."*
4. Type **2.5** → refused, *"Enter a whole number of units."*
5. Type **50** → accepted, button goes green.

**PASS:** all four refusals appear, each with a sentence.
**FAIL:** any of them is accepted, or a refusal appears with no explanation.

---

## CARD 4 — what your own books say (needs the migration AND a books read)
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Apply the migration first (gate above). Then, in **Settings → Accounting**, press **Read my
QuickBooks data** and let all three walks finish. Come back to **Starting numbers** and reload.

1. A line reads **“Your own invoices say a typical product moves N a month”**.
2. It names how many products that was measured across, and the date it was read.
3. The input box is **pre-filled** with that number (rounded, floored at 1, capped at 50).

**PASS:** a number computed from LAWNS's own invoice history is on the screen.
**FAIL:** the line is absent after a successful read, or the box is empty.
⚠️ If it still says *"we have no sales history"* after a successful read, the **migration is not
applied** — that is the gate above, not a defect in this panel.

---

## CARD 5 — 🔴 NO SALES HISTORY IS AN ANSWER, NOT A BLANK
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
On a tenant that has **never** had a books read (Test Dave's, or before CARD 4 on LAWNS).

1. The panel says **“We have no sales history to go on”** and that it is **not going to pretend to
   suggest a number**.
2. The input box is **empty** — not pre-filled with anything.
3. You can still type a number and press the button.

**PASS:** the absence is stated plainly and the screen still works.
🔴 **FAIL if a number is suggested anyway.** A suggestion invented from nothing looks exactly like
a measured one, and this is the case that tells them apart.

---

## CARD 6 — 🔴 THE SEED ITSELF: 647 PRODUCTS STOP SAYING “NONE IN STOCK”
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Type a low number — **5** is a good one — and press **Set starting numbers**.

1. A progress line counts up (*"N of M products"*).
2. When it finishes the panel reads **“Done — N products start at 5”**.
3. It says what happens next: **every movement is tracked from this moment**, and when you count,
   it will show **only the part it cannot explain**.
4. Go to **Inventory**. The products now show **5** on hand.

**PASS:** the catalogue has numbers and the panel told you what it just committed you to.
**FAIL:** it finishes silently, or the count in the message does not match what Inventory shows.

---

## CARD 7 — the products it LEFT ALONE, and why
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Read the last line of the **Done** message.

1. If any products were skipped, it says how many, split into **already held stock** and **already
   sold or counted**.
2. Check one of the skipped ones in Inventory — its number is **unchanged**.

**PASS:** the skips are counted and explained.
🔴 **FAIL if a product that already held stock now reads 5.** Overwriting a real number with a
placeholder is the one thing this must never do — and it would be invisible afterwards.

---

## CARD 8 — 🔴 IT IS A LEDGER ROW, NOT A BARE NUMBER
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
In the **SQL editor**, run:

```sql
SELECT kind, count(*), min(delta), max(delta), min(occurred_at)
  FROM public.business_inventory_ledger
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND kind = 'opening_stock_seed'
 GROUP BY kind;
```

1. The count matches the number in the **Done** message.
2. `min(delta)` and `max(delta)` are both the number you chose.
3. Now prove the derivation holds — on-hand IS the replay:

```sql
SELECT bi.id, bi.name, bi.qty, COALESCE(SUM(l.delta), 0) AS replay
  FROM public.business_inventory bi
  LEFT JOIN public.business_inventory_ledger l ON l.inventory_id = bi.id
 WHERE bi.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
 GROUP BY bi.id, bi.name, bi.qty
HAVING bi.qty <> COALESCE(SUM(l.delta), 0);
```

**PASS:** the first query matches the message, and **the second returns ZERO ROWS**.
🔴 **The second query is the real card.** D-50 says on-hand derives from replay; a seed that wrote
a bare `qty` would show up here as a lot whose book and ledger disagree, and nothing on any screen
would say so.
**FAIL:** any row comes back from the second query.

---

## CARD 9 — 🔴 THE PLACEHOLDER SAYS SO, WHEREVER THE NUMBER APPEARS
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Go to **Inventory → Reconcile** (the count-vs-book screen).

1. A seeded product's row says **“starting number, not counted”** rather than a bare figure.
2. A product you have genuinely counted before does **not** say that.

**PASS:** both halves. The note is on the seeded rows and absent from the counted ones.
🔴 **FAIL if it appears on everything** — a label that is always on carries no information, and
**FAIL if it appears on nothing**, which is the lie this build exists to prevent.

---

## CARD 10 — 🔴 THE RECONCILE HANDS YOU THE RESIDUAL AND ASKS NOTHING
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
This is the acceptance test for the whole build. On a seeded product: **sell 3** through checkout,
then **add 4** through the Inventory grid (edit the number up by 4). Seeded at 5, so the book now
reads **6**. Go to **Inventory → Reconcile** and enter a count of **11**.

1. The row shows **started at 5**, and **we tracked it to 6**.
2. The column **“Since the starting point”** shows the sales and the additions — *3 sold · 4
   received* or similar.
3. The math cell shows **+5 — the part we cannot explain**, and says the number it started from was
   a starting number, so this is expected and your count replaces it.
4. Open **Accept**. The sheet is headed **First real count**, and **does NOT ask you to attribute
   the gap to dead / loss / found**.

**PASS:** all four. The arithmetic nets the movements and the tone asks nothing of you.
🔴 **FAIL if it demands an attribution.** That would write a permanent, immutable `loss` row for
stock that was never established to exist — and the log cannot be retracted.
**FAIL** if the evidence column is missing: without it, +5 is a number with no story.

---

## CARD 11 — the picker, on the phone, with no console
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
On a **phone**, open **Scan / Order** and search for a seeded product.

1. It is **offered** — not greyed out, no *"Can't be added"*.
2. Its sub-line shows the availability **and** the words **starting number, not counted**.
3. Tap it. The review sheet shows the same qualification.

**PASS:** sellable AND qualified, both visible without opening anything.
🔴 **This is where the original defect was visible** — 647 rows reading *"None in stock"* — so it is
where over-correcting into false confidence would do the most damage.
**FAIL:** it is still blocked, or it is offered with a bare number and no qualification.

---

## CARD 12 — the count replaces the placeholder, permanently
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Finish CARD 10 by pressing **Accept** on the count of 11.

1. Inventory now shows **11**.
2. Return to **Reconcile**: the row **no longer** says *"starting number, not counted"*.
3. Its mode is now the ordinary counted one — a further count reconciles against the count of 11,
   not against the seed.

**PASS:** the placeholder is gone for good on that product.
🔴 **FAIL if it still calls itself a starting number.** The flag is derived from the ledger for
exactly this reason — a stored boolean is the copy nobody remembers to clear.

---

## CARD 13 — 🔴 THE COST, PROVEN RATHER THAN PROMISED: THE UNDO NOW REFUSES
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

> ✏️ **REWRITTEN IN PART 2026-09-15 (ledger #337) — THIS CARD'S OPEN QUESTION IS ALREADY ANSWERED,
> AND THE ANSWER CAME FROM THE CODE RATHER THAN FROM A RUN.** The card below asks which of two
> things happens, and says *"this card is what tells us."* **It was always the VISIBLE REFUSAL, and
> never the silent success:** `itemImportWriter.ts` checks `inv.error` and throws, and the leftover
> re-read is a second, independent net that counts what still carries the run id.
>
> 🔴 **WHAT NOBODY HAD NAMED — AND IT IS WORSE THAN EITHER OPTION ON THIS CARD — IS THAT THE UNDO
> DELETED THE CUSTOMERS FIRST.** They are separate statements in separate transactions, so the run
> removed the customers, then threw on the inventory. **A half-wiped tenant** — and the report said
> `customersDeleted: 0`, because the catch returns zeroed counts. **FIXED 2026-09-15: GATE 2 reads
> the ledger before any write and refuses the whole run.**
>
> ⚠️ **AND THE SEED IS NOT WHAT MADE IT LIVE.** Order `6a60a0ca` (LAWNS, 2026-09-09, `order_kind =
> test`, $1,875) moved stock against an imported lot six days before this board was written. **One
> test order against one imported lot was enough.**
>
> ✅ **STILL WORTH RUNNING, FOR A DIFFERENT REASON.** The question is no longer *which behaviour* —
> it is whether the refusal **reads as a deliberate protection** to somebody who just seeded, and
> whether **the numbers beside it are right**. Add the check the fix makes possible: **after the
> refusal, confirm in SQL that the CUSTOMER count did not move.** A dropped customer count is the
> half-wipe and means GATE 2 did not run.
>
> **THE ORIGINAL CARD, UNCHANGED, FOLLOWS.**
⚠️ **Do this on a tenant you are willing to leave in this state — Test Dave's, not LAWNS.**
After seeding, go back to **Import products & services** and press **Undo this import**.

1. It **fails**, and names the failure rather than reporting a clean undo.
2. The products are **still there**, with their numbers.

**PASS:** the refusal is visible and the panel says what is still there.
🔴 **FAIL — and this is the serious one — if it reports SUCCESS while the rows are still there.**
That is a silent half-undo, and every later count would be reconciling against a catalogue somebody
believes was removed. Filed as tech-debt **#304**; this card is what tells us which of the two
happens in practice.

---

## CARD 14 — the manager is told why, not shown a button that refuses
**STATUS:** needs-test · **DEVICE:** desktop · **LAST-PROVEN:** —
**REASON IT IS `needs-test` RATHER THAN `owed`:** it needs a **second live login** — Lauren's, as a
manager — which does not exist on LAWNS today. The same blocker as every other manager-side card in
this corpus. Written now so the hole is recorded rather than discovered later.

Sign in as a **manager** (not the owner) and open **Settings → Accounting**.

1. The **Starting numbers** panel is there.
2. It says only the **owner** can set a starting number, and **why** — it writes a permanent line
   against every product.
3. There is **no input box and no button**.

**PASS:** the refusal is an explanation, not a greyed control.
**FAIL:** a manager sees the button, or the panel vanishes with no word (a missing panel reads as a
broken feature, not as a permission).

---

## CARD 15 — 🔴 TEST MODE: THE PANEL SAYS SO, AND THE STOCK RECORD STAYS EMPTY (ledger #342)
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** — · **COVERS:** #342
On **Test Dave's** (test mode), after a fresh import, open **Settings → Accounting → Starting numbers**.

1. The first line reads **You are in test mode.** and says nothing is written to your stock record, and that
   you can still undo the import.
2. Set **5**. The **Done** box repeats the test-mode sentence in amber.
3. In the SQL editor — the count must be **0**:

```sql
SELECT count(*) FROM public.business_inventory_ledger
 WHERE business_id::text LIKE 'f7ec5d67%' AND kind = 'opening_stock_seed'
   AND created_at > now() - interval '1 hour';
```

4. Press **Undo this import** (CARD 39's panel). It **succeeds**.

**PASS:** the products read 5, the query returns 0, and the undo goes through.
🔴 **FAIL:** any seed row appears — the record was written during testing.

---

## CARD 16 — test mode leaves a hand-made product alone
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** — · **COVERS:** #342
On **Test Dave's**, add one product **by hand** (not from QuickBooks) with **0** in stock, then run CARD 15's seed.

**PASS:** the hand-made product still reads **0**, and the Done box counts it under *not created by your
QuickBooks import*. **FAIL:** it reads 5.


---

## CARD 17 — 🔴 THE PANEL FOLLOWS THE CATALOGUE: UNDO, IMPORT, AND IT NEVER SHOWS YESTERDAY'S COUNT (ledger #366)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #366

**This is the defect David hit on 2026-09-21, in his own words: the panel read "44 of your 631
products have no count" after an Undo had removed all 631.** Pressing Set then tried to write to
44 product ids that no longer existed, and blamed his permissions for it.

1. **Settings → Accounting.** Read the Starting-numbers panel and note the sentence — *"N of your
   M products have no count"*. Write both numbers down.
2. Press **UNDO THIS IMPORT** and wait for it to report what it removed.
3. **Without reloading the browser**, look at the panel again.

**PASS:** the panel goes to its loading state and comes back describing the catalogue *as it is
now* — after a full undo that is **no products to give a starting number to**. The old numbers are
gone from the screen **before** the new ones arrive; at no point does it show the pre-undo count.

**FAIL:** it still reads "44 of your 631". That is the original defect.

4. Press **PREVIEW**, then **IMPORT**, and wait for it to report.
5. **Without reloading the browser**, look again, then press **SET STARTING NUMBERS**.

**PASS:** the panel now describes the freshly imported catalogue, and Set works — on 2026-09-21's
data that was **512 started · 45 not stock · 75 under production**. No browser reload anywhere in
this card.

**FAIL:** Set refuses with *"a batch of N was not written at all"*. That means the panel was still
holding the old product ids.

**PASS (the message, if you can make it refuse):** if a Set ever does refuse, the sentence must
name **which** refusal it hit — *"those N products are no longer in your catalogue"* when the rows
are gone, or *"N of them are still there, so this is your permissions refusing the change"* when
they are not. **FAIL:** the old wording that named both causes and let you pick.

