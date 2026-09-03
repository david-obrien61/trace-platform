# QUICKBOOKS TEST MODE & THE ORDER-COUNTING PRIMITIVE — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
> stamp. *(GATE 0 · OP-15.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own).
>
> **This file is the ONLY source of truth for the test-mode owner-tests.** It is STANDING — run it
> after any change to `orderKind.ts`, `testMode.ts`, the `pushQboInvoice` guards, the write switch,
> the banner, or any surface that counts orders. A per-build proof is a FILTER (`COVERS: #NNN`),
> never a second doc.

**Purpose:** prove three things, in this order of consequence.
**(1)** A test order reaches a customer's QuickBooks **in no way whatsoever** — not as an invoice
and **not as a customer**, which is the half people forget.
**(2)** A test order is excluded from every count, **as a property of the row rather than a filter
somebody remembered**, and it stays excluded after go-live.
**(3)** Nobody can be in test mode without knowing it — because the expensive failure is not fake
data reaching real books, it is somebody working in test mode for a week believing they are live.

**Board: 0 of 15.** Every card is `STATUS: owed` except **13**, which is `needs-test` with its
reason stated. **Card 15 is R-63's** — it was added after David ruled the stock sentence, and it is
the one that closes the question this build raised and could not decide. Thunder never sets `covered` (OP-14).

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 Written but not run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 Surface exists, no test — a known hole, recorded rather than hidden. |
| `DEVICE:` | `phone` (capture) · `desktop` (reconcile/admin) · `either`. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS must be visible without a console. |

---

## ⛔ GATE 0 — CONFIRM YOU ARE TESTING THE DEPLOYED CODE (OP-15)

- [ ] **① SHA is live** — the `?debug=1` DebugPanel stamp matches `git log -1 --format=%h`.
- [ ] **② 🔴 THE MIGRATION IS APPLIED.** `20260902_business_qbo_writes_switch.sql`, in the Supabase
      **SQL editor** as `postgres` — *not* the table editor (§6 r17).
      **Run its VERIFY block, all four queries.** Query 3 is the one that matters: if `pg_policies`
      lists any UPDATE policy on `businesses` other than `businesses_owner_update`, **stop** — the
      owner gate is not the only door and R-56's authority claim is false.
      ⚠️ **Until it is applied, every order is written as a test order** (a failed read of the
      switch means test mode — the safe direction, stated at `submit.ts`). That is by design, and
      it means an unapplied migration looks like a working feature. Confirm, do not assume.
- [ ] **③ 🔴 KNOW WHICH TENANT YOU ARE IN.** Cards 1–8 are safe anywhere. **Cards 9 and 10 push to
      a real QuickBooks company** — run them on **Test Dave's**, never on LAWNS.

---

## CARD 1 — the banner is there, and it cannot be got rid of
**STATUS:** owed · **DEVICE:** either · **LAST-PROVEN:** —

As the owner, with the switch OFF (its default), sign in and look at the top of the screen.

1. An amber bar sits under the header on **every** page — dashboard, orders, inventory, settings.
2. 🔴 **Read it word for word. It must say exactly:**
   *"TEST MODE — nothing you do here reaches QuickBooks, and your tree counts do not change."*
3. **Scroll down.** It stays put — it is inside the sticky chrome.
4. **There is no × and no "dismiss".** Look for one.

**PASS:** the bar is on every page, reads exactly that sentence, and cannot be closed.
🔴 **The banner is the feature; the toggle is the detail.** If only one of the two worked, this is
the one that must.
🔴 **THE SECOND HALF OF THE SENTENCE IS THE NEW PART AND IT IS THE ANSWER TO A QUESTION THIS BUILD
COULD NOT DECIDE:** a test order does **not** move stock, and R-63 is that the screen has to say so
rather than leave you to notice. **Card 14b is the other half of it — do not treat this card as
covering that one.**
**FAIL:** any page without it · a close button · or any paraphrase. The wording is the ruling here,
not the meaning — if it differs, check whether David changed it before assuming the code is wrong.

---

## CARD 2 — the switch says which mode you are in before it offers you a button
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

Settings → the Accounting card, with QuickBooks connected.

1. **Above** the three read buttons there is a section headed **Sending invoices to QuickBooks**.
2. It names the current state in a full sentence, in a coloured box, **before** any control.
3. 🔴 **In test mode that sentence is the SAME sentence as the banner** — word for word, not a
   shorter version of it. (It used to be a second, shorter copy, and that copy went stale the day
   the wording changed: two screens describing one mode differently.)
4. Below it, the longer explanation **includes the stock caveat** and does **not** claim you can use
   every part of the system exactly as you would for real — because you cannot; stock is the part
   that is switched off.

**PASS:** you can tell which mode you are in without pressing anything.
**FAIL:** the state has to be inferred from the label on a button. That is how somebody spends a
week not knowing which mode they are in.

---

## CARD 3 — turning writes on tells you what will happen, and what will not
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

Press **Turn on sending to QuickBooks…**.

1. A confirmation appears **before** anything changes.
2. It names **your business by name**.
3. It says, in the future tense, that **every order you ring up will be written to QuickBooks as a
   real invoice**.
4. It says an invoice **cannot be undone** — one deleted in QuickBooks still uses up its number.
5. 🔴 **It says the test orders you have already made are NOT affected** — they stay marked as
   tests and are never sent.
6. It never says *"Are you sure?"*.
7. Press **Not yet**. Nothing changed.

**PASS:** all seven.
🔴 **Point 5 is the one to read carefully.** It is the half a confirmation usually omits, and it is
the half an owner will actually worry about.
**FAIL:** any of the five sentences missing, or an "Are you sure?" — that asks somebody to
re-affirm a decision without telling them what it does.

---

## CARD 4 — a manager cannot flip it, and is told why rather than shown a dead button
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

🔴 **RUN THIS ON TEST DAVE'S, NOT ON LAWNS — AND THE REASON IS A CORRECTION, NOT A PREFERENCE.**
**Lauren is not a manager.** She holds `role = OWNER` at LAWNS with a `user_id` that is not
`businesses.owner_id` — the only such row in the database, and exactly what the 2026-08-28 ruling
gave her. So signing in as Lauren tests the OWNER path and would pass this card while proving
nothing. ⚠️ **The only active MANAGER anywhere is `test obrien` at `f7ec5d67`** — `joel joiner` is a
manager at LAWNS but `active = false`, and an inactive member is not a test subject either.
✏️ **Measured by the vendor session, not by me** — a first draft on that branch tested `owner_id`
alone and **would have refused Lauren on her own tenant.** If this card ever seems to need Lauren,
the card is wrong, not the database.

Sign in as **`test obrien` (manager) on Test Dave's**. Settings → Accounting.

1. The current mode is still shown — a manager may **see** which mode the business is in.
2. There is **no switch**.
3. In its place is a sentence saying only the account owner can change it, **and why**.

**PASS:** state visible, control absent, reason given.
**FAIL:** a greyed-out button with no explanation (that reads as broken — §6 r13), **or** a working
button. If a manager can flip it, stop and surface it: the database policy is not what R-56 says it is.
🔴 **ALSO A FAIL: running this as Lauren and recording a pass.** Owner-role is the path she is on;
this card is about the path she is not.

---

## CARD 5 — a test order is born marked, and says so on its own confirmation
**STATUS:** owed · **DEVICE:** either · **LAST-PROVEN:** —

With the switch OFF, ring up a complete order through checkout — real items, real customer, finish it.

1. The order completes normally. Nothing about the flow is degraded.
2. The confirmation screen does **not** say the QuickBooks push failed, and does **not** tell you to
   reconnect QuickBooks.
3. It says this was a test order and nothing was sent.

**PASS:** the order is saved and complete, and the QuickBooks line reads as a deliberate choice
rather than a fault.
🔴 **"Failed" would send you hunting a problem that does not exist; "not connected" would tell you
to reconnect a QuickBooks that is connected.** Neither is what happened.
**SIGNAL:** `[TRACE:TESTMODE] order born — { writesEnabled: false, order_kind: 'test' }`.
**FAIL:** an error, a "reconnect QuickBooks" message, or no mention of it at all.

---

## CARD 6 — 🔴 the order reached QuickBooks in no way whatsoever
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

🔴 **Run this on Test Dave's.** Immediately after Card 5, **in QuickBooks itself — not in our logs**:

1. **Before** you rang the order up you should have noted the invoice count and the customer count.
   If you did not, ring up a second test order now and note them first.
2. Open QuickBooks → **Sales → Invoices**. **No new invoice.**
3. Open QuickBooks → **Customers**. 🔴 **No new customer**, even if the person you rang up was
   somebody QuickBooks had never heard of.

**PASS:** both counts unchanged.
🔴 **POINT 3 IS THE CARD.** An order that creates a QuickBooks customer and no invoice **has still
written to their books** — a real name in a real chart of customers that somebody has to notice and
delete. The guard is placed above the customer create for exactly this, and a probe asserts the
ordering, but a probe reads source and this reads their books.
🔴 **This must be proven by READING QUICKBOOKS, never by reading our own logs.** A log saying we did
not write is a claim about the thing under test.
**FAIL:** anything new in either list. **Stop everything and tell David.**

---

## CARD 7 — the dashboard does not count the test order
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

Note today's **sales count** and **today's revenue** on the dashboard. Ring up a test order for a
real amount. Reload.

1. **Today's sales** is unchanged.
2. **Today's revenue** is unchanged.
3. The add-on banner's numbers are unchanged.

**PASS:** all three unmoved.
🔴 **A test order that shows up as revenue is the whole reason for the exclusion.** She will ring up
a dozen of these; if they land in her figures, the figures are worthless for the week she most needs
to trust them.
**FAIL:** any of the three moved.

---

## CARD 8 — 🔴 the test order is STILL excluded after go-live
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

With a test order already in the system from Card 5, turn the switch **ON** (Card 3). Reload the
dashboard.

1. Today's sales, today's revenue and the add-on numbers are **still** unchanged by that test order.
2. Ring up a NEW order. **That** one moves the numbers.

**PASS:** the old test order stays out forever; the new live order counts.
🔴 **This is the property, not the filter.** The mark is in the row, so going live cannot
retroactively make a week of experiments into revenue. If the old test order suddenly appears in
the figures, the exclusion is reading a mode rather than the row, and everything else on this board
is worth less than it looks.
**FAIL:** the figures jump when you flip the switch.

---

## CARD 9 — a live order DOES reach QuickBooks
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

🔴 **Test Dave's only.** With writes ON, ring up a real order.

1. The confirmation reports a QuickBooks invoice number.
2. It is in QuickBooks.

**PASS:** it is there.
🔴 **This card exists because Cards 6 and 7 would both pass if the push were simply broken.** A guard
that works by everything being broken is not a guard, and nothing else on this board can tell the
difference. **Do not skip it.**
⚠️ If `QBO_PUSH_HOLD` still names this tenant the push is held by David's own switch and this card
cannot run — that is a correct refusal, not a failure. Clear the env var first or record it as
blocked.
**FAIL:** no invoice, with the hold confirmed off.

---

## CARD 10 — going back to test mode stops the writes again
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

🔴 **Test Dave's.** After Card 9, press **Go back to test mode**. Ring up another order.

1. The banner returns on every page.
2. Nothing new in QuickBooks — invoices **or** customers.

**PASS:** the switch works in both directions.
**FAIL:** the banner does not return, or the order pushes anyway.

---

## CARD 11 — the review says what it found, and its silences are honest
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

Settings → Accounting. Press **Read item list** ONLY — not the other two. Scroll to
**What we found in your books**.

1. It says how many of the checks could be run — a number **out of** the total, not just a count.
2. Rules needing the customer or invoice reads appear **in grey**, saying *"Not checked"* and
   **naming the read that is missing in your own words** (*"your invoice history"*), not a field name.
3. Now press **Read customer list** and **Read invoice history**. More checks turn from grey to black.
   **The earlier reads do not disappear** — the panel accumulates.

**PASS:** all three.
🔴 **Point 2 is the card, and here is the failure mode in one line: A FINDING MISSING IS THE
FAILURE, NOT A FINDING BEING WRONG.** This surface fails toward REASSURANCE — every way it can break
makes the screen shorter, calmer and more confident than the truth, and a calm screen looks like good
news. **So looking at it can never find them.** Four of the five mutants that survived the first run
were exactly this shape. A row you cannot see is a row you assume passed. Hiding the unrun checks
would give a shorter, calmer, more confident screen than the truth — which is exactly why it would
never be noticed.
**FAIL:** unrun checks are hidden · a check reports a clean result over a read that never happened ·
or reading a second list wipes the first.

---

## CARD 12 — every finding names its population and its quoted figure
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

With all three reads done, read the findings.

1. Every black (measured) row shows **"N of M <things>"** — never a bare number.
2. Every row, grey or black, carries **"29 Aug analysis said: …"** in amber beside it.
3. Read three sentences aloud. **No field names** — no `DocNumber`, no `UnitPrice`, no `ShipDate`.
4. The order is **Worth money → Worth checking → Worth knowing**, and a big number in the last
   section never appears above a small one in the first.

**PASS:** all four.
🔴 **Point 2 is not decoration.** Those sixteen figures came from a 29 August analysis and **none was
re-measured before it was written down.** Showing both is the only way the drift is visible instead of
a stale number quietly passing as a current fact (R-26). **Where the two differ a lot, that gap is
itself worth telling David about.**
🔴 **Point 4 is the difference between help and an audit.** Twelve things wrong with her books sorted
by how wrong they are reads as a judgement of her work.
**FAIL:** a bare number with no denominator · a missing quote · a field name in a sentence · or
worst-first ordering.

---

## CARD 13 — a finding cannot stop the import
**STATUS:** needs-test · **DEVICE:** desktop · **LAST-PROVEN:** —

🔴 **`needs-test`, and the reason is the finding:** proving that findings cannot block requires
running an actual ingest with findings on screen, and the ingest panels below the review
(`QboDeliveryIngest`, `QboOrderIngest`) have their own standing boards and their own preconditions.
Asserting a pass here from *"the button was not greyed out"* would be a green check on a proof
nobody performed.

**What it will be:** with unresolved findings on screen, run a delivery ingest end to end and confirm
it completes. **What is provable today, and is worth eyeballing while you are on Card 12:** nothing
on the review panel is a checkbox, nothing says *"resolve these first"*, and the ingest buttons below
it are not disabled.

---

## CARD 14 — the build wrote nothing to anybody's books, and nothing to ours
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

After running Cards 11 and 12 (three reads + the review), and **without** ringing anything up:

1. In QuickBooks: no new invoice, no new customer, no changed item.
2. In Cultivar: `/orders` has no new row and `/inventory` is unchanged.
3. The review panel's own last line says so: *"Nothing on this panel changed anything in QuickBooks
   or here. It is a read."*

**PASS:** nothing moved anywhere.
🔴 **The review is a READ.** If reading somebody's books changes them, the whole sequence in §9 —
import, then configure, then go live — is built on sand.
**FAIL:** anything changed.

---

## CARD 15 — 🔴 the screen says what test mode is NOT proving
**STATUS:** owed · **DEVICE:** either · **LAST-PROVEN:** —

With the switch OFF, build a cart and go to the review screen — the one with **Send invoice + pay
online** and **I'll pay at the office**.

1. Directly **above those two buttons** there is a quieter amber note.
2. 🔴 **It reads exactly:** *"Because stock does not move in test mode, this is not a test of whether
   the system tracks your trees. That happens after you switch writes on."*
3. Turn the switch ON and come back to the same screen. **The note is gone.**

**PASS:** all three.
🔴 **THIS IS THE CARD THE WHOLE STOCK QUESTION COMES DOWN TO, AND IT IS NOT THE BANNER'S JOB.** The
banner says what is PROTECTED. This says what is **not being proven** — and without it somebody can
ring up practice orders for a week, watch everything behave, and conclude the system tracks their
trees. It does not, yet. They would find out after go-live, on real stock.
🔴 **A note that says "stock is unaffected" is a FAIL, not a near-miss.** That reads as a feature
being offered. The point is the opposite: a capability you care about is deliberately switched off,
and you should know which one.
**FAIL:** no note · a note below the buttons (a caveat read after the action is not a caveat) · any
paraphrase · or a note that is still there once writes are on.

---

## CARD 16 — 🔴 the file door opens, and it is visibly a test facility
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

On **Test Dave's**, Settings → the QuickBooks accounting panel.

1. Below the three green read buttons there is an **amber, dashed** box whose first line reads
   **TEST FACILITY — load a saved read instead of connecting**.
2. It says, in its own words, that QuickBooks is **not contacted**, that nothing is imported, and
   that **it is not a way to bring data in**.
3. Choose a `qbo-*.json` file saved earlier from LAWNS. It loads, and a green line names how many
   records came in and from which file.
4. 🔴 **An amber strip appears above the findings:** *"Showing a SAVED read loaded from a file — not
   a live pull from QuickBooks."*

**PASS:** all four.
🔴 **STEP 4 IS THE ONE THAT MATTERS AND IT IS EASY TO SKIM PAST.** Everything below the read is
shape-identical to a live pull *by design* — that is the whole point of the harness. Which means
that without that strip, a rehearsal and real books are indistinguishable on screen, and somebody
will eventually read one as the other.
**FAIL:** the box looks like the rest of the page (a file loader that blends in becomes how people
import things) · no strip · or the strip appears on a **live** read.

---

## CARD 17 — 🔴 a file that disagrees with itself is REFUSED, by name
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

Take a saved `qbo-invoices-*.json`, open it in a text editor, and **delete one whole page object**
from the `pages` array (leave the header numbers alone). Save it as a copy. Load that copy.

1. It is **refused**. Nothing loads — no counts, no findings, no partial list.
2. The refusal names the problem in a sentence, with **both numbers** — what the file claims and
   what is actually in it.
3. The findings panel is **unchanged** from before you tried.

**PASS:** all three.
🔴 **A HALF-LOADED FILE BEHIND A WARNING IS THE FAILURE THIS CARD EXISTS TO CATCH.** A truncated
download looks exactly like this, and a books review computed over 61% of a business's invoices is
confidently wrong about a real company. A warning printed above a table gets read as a footnote to
the table — which is the #229 defect arriving by post.
**FAIL:** it loads with a warning · it loads silently · a generic "could not read that file" that
does not say what disagreed.

---

## CARD 18 — 🔴 the findings are ordered by MONEY, and the money is on screen
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

With all three reads loaded (live or from file), look at the findings panel.

1. Findings are grouped **money → risk → the shape of your business**.
2. Inside the money group, each finding that has a dollar figure shows **"$N at stake"**, and they
   are in **descending** order of it.
3. A finding with **no** dollar figure shows **nothing** there — not "$0".
4. 🔴 At the very bottom there is a section headed **What we could not work out**, and it says these
   are neither good news nor bad.

**PASS:** all four.
🔴 **STEP 3 IS NOT A DETAIL.** "Worth nothing" and "not a money question" are different answers, and
a $0 in that spot asserts the first when we mean the second.
🔴 **STEP 4 IS THE MOST VALUABLE SECTION IN THE PANEL** — it is the list of questions your books
cannot answer today. **If it is missing, that is the failure**, because a silent omission reads as a
clean bill of health.
**FAIL:** any group out of order · a "$0 at stake" · the not-computed section absent or interleaved
with the real findings.

---

## CARD 19 — 🔴 Visualize produces something you would show your accountant
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

Press **Visualize**. A new tab opens with the report.

1. It is headed **DATA ANALYSIS: FIRST LOOK PRIOR TO INGEST** and states the date it was generated.
2. 🔴 It states **which corrections it reflects** — today that line reads **"no corrections"**,
   because nothing records them yet. **A missing line is a FAIL, not a pass.**
3. **What this is built on** names each of the three reads in your words — *your products &
   services*, *your customers*, *your invoice history* — and each says whether it was read **in
   full**, with its count. A read you did not run says **"not read"**.
4. Read it end to end. 🔴 **It asks you for nothing** — no Accept, no Ingest, no button at all.
5. Print it (⌘P → Save as PDF). It paginates without cutting a finding in half.
6. Go back to the app. **Visualize is still there** and still works.

**PASS:** all six.
🔴 **STEP 2 AND STEP 3 ARE THE HONESTY OF THE DOCUMENT.** It outlives this session and gets emailed
to somebody who cannot ask it a question — so a read that was never run must be **named**, not left
out, and a report with no corrections must **say so** rather than going quiet. Absence reads as
"none were needed".
🔴 **AND READ IT AS A NURSERY OWNER.** If any line names a database field, a table, or an Intuit
word (`DocNumber`, `UnitPrice`, `Invoice`), that is a FAIL.
**FAIL:** no date · no corrections line · a walk missing rather than named · any control asking for
a decision · jargon on the page · Visualize consumed by being pressed once.

---

## CARD 20 — 🔴 nothing was written, and QuickBooks is where you check
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

Do a full pass: load all three files, read the findings, press Visualize, print the report.

1. Open **QuickBooks itself**. No new invoice. No new customer. No new item.
2. In the app, nothing appeared in inventory, orders, customers or deliveries.

**PASS:** both.
🔴 **CHECK QUICKBOOKS, NOT OUR LOGS.** A log line saying we did not write is a claim made by the
thing under test. This whole surface is a READ, and the only proof of that is the other system's
own screen.
**FAIL:** anything at all appeared in either place.

---

## CARD 21 — 🔴 the retirement column lands, and retires nothing by landing
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

Apply **`supabase/migrations/20260903_inventory_retire_lifecycle.sql`** in the Supabase **SQL
editor** (not the table editor — §6 r17). Then run its VERIFY block, V1 through V5.

1. **V1** — `retired_at` and `retired_reason` both exist, both nullable, neither with a default.
2. 🔴 **V2 — `already_retired` is `0`.** Applying the migration retired nothing.
3. **V3** — the index exists and its definition contains `WHERE (retired_at IS NOT NULL)`.
4. 🔴 **V4 — the policy list is UNCHANGED**: `business_inventory_owner_all` and
   `business_inventory_member_all`, and nothing else.
5. **V5** — record the three numbers it returns. This is the baseline the replacement is judged
   against, and it is worth having *before* anything runs.

**PASS:** all five.
🔴 **STEP 2 IS THE ONE THAT MATTERS AND IT LOOKS LIKE A FORMALITY.** A migration that quietly
retired rows would be indistinguishable from the feature working — you would see rows disappear and
conclude it had run correctly. Nothing should have moved yet.
🔴 **STEP 5 IS NOT OPTIONAL EITHER.** If the counts come back materially different from ~447 total
and ~4 with a real count, **stop** — the data has changed since the ruling was made, and the plan
was written against those numbers.
**FAIL:** any column with a default · anything already retired · a changed policy list · a
non-partial index.

---

## CARD 22 — 🔴 the display-standards table, and the policy that decides whether Lauren is locked out
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

Apply **`supabase/migrations/20260903b_display_standards.sql`** in the **SQL editor**. This one
**creates a table**, so the editor you use changes what you get. Run V1–V5.

1. 🔴 **V1 — `tableowner` is `postgres`, not `supabase_admin`.** `supabase_admin` means it was made
   in the table editor, and it arrives carrying a TRUNCATE grant for `anon` that RLS cannot filter.
2. **V2** — no `anon` TRUNCATE/REFERENCES rows come back at all.
3. 🔴 **V3 — RLS is on AND BOTH policies exist** — `..._owner_all` **and** `..._member_all`.
4. **V4** — one unique index on `(business_id, domain, group_key)`.
5. **V5** — the table is empty. Applying it decided nothing.

**PASS:** all five.
🔴 **STEP 3 IS THE LAUREN CASE AND IT IS WHY THIS CARD EXISTS.** An owner-only policy keyed on
`businesses.owner_id` would lock Lauren out of her own tenant: she holds `role = OWNER` in
`business_members` at LAWNS with a `user_id` that is **not** `businesses.owner_id` — the only such
row in the database. **If only the owner policy is there, stop.** A first draft elsewhere tested
`owner_id` alone and would have refused her; that is measured, not hypothetical.
⚠️ **AND A KNOWN GAP TO READ, NOT TEST:** `audit_log`'s read policy *is* `owner_id`-keyed, so Lauren
can write the record of her own decision and **cannot read it back**. Not fixed here and not a
failure of this card — named so it is not discovered as a surprise.
**FAIL:** owner `supabase_admin` · any anon TRUNCATE · a missing member policy · no unique index.

---

## CARD 23 — the two screens do not exist yet
**STATUS:** needs-test · **DEVICE:** desktop · **LAST-PROVEN:** —

**REASON THIS IS `needs-test` RATHER THAN A CHECK:** #262 built the two **decisions** and the two
**places they live** — the plan that decides what is retired, adopted, carried and created, and the
questions that ask an owner how a size should read. **Neither has a screen, and nothing yet writes
`retired_at`, creates the 685, or applies a chosen label.** There is no surface to drive.

**What is owed before this becomes a real card:**
- the applier that walks the plan and writes it, and the reader-side filter that hides a retired row
  (a retired row that still appears everywhere is not retired)
- the screen that asks the normalisation questions and records the answer in **both** places —
  `audit_log` (how it was decided) and `business_display_standards` (what is true now)
- the report that states **retired · created · carried**, which is the third clause of R-70 and is
  the only way an owner can check the replacement did what it said

🔴 **WRITING THIS DOWN IS THE POINT.** An unrecorded hole looks exactly like a covered surface on a
board where every other row is green, and #262 could otherwise read as "retire-and-replace: done."
