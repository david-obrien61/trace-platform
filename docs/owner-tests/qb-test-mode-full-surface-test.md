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

**Board: 0 of 14.** Every card is `STATUS: owed` except **13**, which is `needs-test` with its
reason stated. Thunder never sets `covered` (OP-14).

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
      owner gate is not the only door and R-55's authority claim is false.
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
2. It says QuickBooks is not being written to, **and that orders are still being saved**, **and**
   that they are kept out of the sales figures.
3. **Scroll down.** It stays put — it is inside the sticky chrome.
4. **There is no × and no "dismiss".** Look for one.

**PASS:** the bar is on every page, says all three things, and cannot be closed.
🔴 **The banner is the feature; the toggle is the detail.** If only one of the two worked, this is
the one that must.
**FAIL:** any page without it · a close button · or wording that only says "test mode" without
saying the orders are still being saved. An owner who thinks their work is being thrown away will
stop working.

---

## CARD 2 — the switch says which mode you are in before it offers you a button
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

Settings → the Accounting card, with QuickBooks connected.

1. **Above** the three read buttons there is a section headed **Sending invoices to QuickBooks**.
2. It names the current state in a full sentence, in a coloured box, **before** any control.
3. In test mode it also explains, in plain words, what still works and what does not.

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

Sign in as a **manager** (not the owner). Settings → Accounting.

1. The current mode is still shown — a manager may **see** which mode the business is in.
2. There is **no switch**.
3. In its place is a sentence saying only the account owner can change it, **and why**.

**PASS:** state visible, control absent, reason given.
**FAIL:** a greyed-out button with no explanation (that reads as broken — §6 r13), **or** a working
button. If a manager can flip it, stop and surface it: the database policy is not what R-55 says it is.

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
🔴 **Point 2 is the card.** A row you cannot see is a row you assume passed. Hiding the unrun checks
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
