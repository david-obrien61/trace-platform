# OWNER TEST — THE FULFILMENT TAP, AND THE REVIEW ASK

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** 3.4 (scheduling) · 3.5 (delivery / routing) · the first capability behind `followup_engine`
**Story:** `user_stories.md` → *The stop is done — one tap, and a moved stop says where it went* (PIECES `fulfilment_tap`, `delivery_complete_state`) · *Ask for a review at the door* (ledger #247; the link moved to Business Profile in #300)
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 17 covered** (15 `owed` · 2 `needs-test`). ✏️ **#300 (2026-09-11) added CARDS 13–17 and re-aimed CARDS 6, 8, 9 and 10** — the link field moved to Business Profile, and a stop marked done after its own date no longer prompts.
**DEVICE:** CARDS 2–7, 10, 12 and 17 are **`DEVICE: phone`** — a crew surface in a customer's garden, every one provable **without a console**. CARDS 8, 9, 14 and 15 are `DEVICE: desktop`. CARDS 13 and 16 are the **SQL editor**. CARDS 1 and 11 are `needs-test`.

> 🔴 **WHO CAN RUN WHAT, AND ON WHICH TENANT.**
> **David can run these now, no phone:** CARD 13 (SQL editor, read-only, every tenant) · CARD 14 (your own login, **LAWNS** — pasting LAWNS's real link is the point) · CARD 15 (your own login, Test Dave's) · CARD 16 (SQL editor, **Test Dave's only** — turns Follow-Up on so the crew half can be seen) · CARDS 8 and 9 (your own login, Test Dave's).
> **Needs a phone — your own login, Test Dave's:** CARDS 2–7, 10, 12 and 17. **Never on LAWNS:** a tap there stamps a completion time on a real customer's job.
> **Waits on David's decision:** the ask firing on **LAWNS**. Follow-Up is off there and **no screen can turn it on** — `/subscription` lists it under Coming (tech-debt #270).
>
> **🔴 RUN THIS FIRST: CARD 13.** It is the history check this build rests on, and it writes nothing.

---

## ⛔ GATE 0b — ✅ THE MIGRATION IS APPLIED. THIS GATE IS CLOSED.

✅ **APPLIED — verified live 2026-09-02 by selecting all four columns through PostgREST (`started_at`, `completed_at`, `review_asked_at`, `review_ask_outcome` — all PRESENT; an absent column returns `42703`). Population: 30 LAWNS `deliveries` rows.** It had been carried forward as *unapplied* through three sessions without anyone re-checking — a status inherited rather than measured, which is [[R-26]]'s exact shape and the same defect this board already records against `20260830b`. **CARD 1 below tested the pre-migration state and can no longer be run.**

⚠️ **The tap itself is entirely UNRUN, so cards 2–12 are all live:** 0 of 30 deliveries carry `started_at`, 0 carry `completed_at`, 0 carry `review_asked_at`, and all 30 read `scheduled`.

<details><summary>The original gate text, kept because it was true when written</summary>

🔴 **`supabase/migrations/20260831d_deliveries_fulfilment_and_review_ask.sql` is GATED and UNAPPLIED.** Four nullable columns on `deliveries`. Until you run it in the **SQL editor** (§6 r17 — *not* the table editor, whose default ACL hands `anon` TRUNCATE and REFERENCES, a privilege RLS cannot filter):

- the delivery list still loads — it falls back to the pre-migration column set rather than blanking, which is deliberate;
- and every stop card reads **"Marking stops done isn't available yet — the database update (20260831d) hasn't been applied."**

✅ **That sentence is itself CARD 1.** If you see the buttons before running the migration, something is wrong with the fallback, not with the migration.

The migration carries its own pre-write and post-apply verification queries, including the §6 r17 privilege fingerprint. Run them; do not take the apply on trust.

---

</details>

---

## CARD 1 — the pre-migration state is honest, not silently missing
**STATUS:** needs-test · **DEVICE:** phone · **LAST-PROVEN:** —

⚠️ **PRECONDITION CLOSED UNRUN — measured live 2026-09-02 (ledger #253 merge session), not inherited.** `20260831d` is APPLIED, so the pre-migration state this card describes no longer exists and reproducing it would mean dropping four live columns. **Do not run it; it cannot pass and its failure would mean nothing.** Recorded rather than deleted — the fallback it tested was real and shipped, and a card quietly removed reads as a card that was never owed.
1. **Before** applying `20260831d`, open `/delivery-schedule`.
2. The stops still list — names, addresses, dates, "Route this day" all as before.

**PASS:** the list is intact AND each card says marking stops done isn't available yet, naming `20260831d`.
**FAIL:** the list is empty or errors (the fallback did not fire) — or the card silently shows no control at all, which is the dishonest version of the same state.

---

## CARD 2 — a crew member marks a stop done
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
Apply the migration first. On **Test Dave's**, on a phone, open `/delivery-schedule`.
1. Pick a scheduled stop. It shows **`Start this stop`** (outline, full width, at least 48px tall).
2. Tap it. The button becomes **`Mark done`**.
3. Tap **`Mark done`**.

**PASS:** the buttons disappear and the card shows a green **`Done`** chip. The stop stays in the list — it is not hidden.
**FAIL:** the control persists after tapping, an error appears, or the stop vanishes.

---

## CARD 3 — 🔴 the times are stamped, and the number is the assertion
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
Do CARD 2 but leave a real gap — **wait at least two minutes** between `Start this stop` and `Mark done`.

**PASS:** the done card reads **`N min on site`**, and N matches the wall clock.
🔴 **This is the whole reason the build stamps times.** The capacity model rests on *one minute per gallon*, invented on 2026-08-26 and never measured. This card is the first real measurement.
**FAIL:** no minutes appear, or the number is wrong.

---

## CARD 4 — 🔴 an unmeasured stop says nothing rather than "0 min"
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
Take a **fresh** stop and tap **`Start this stop`** then **`Mark done`** immediately, within a second.

**PASS:** the card shows the `Done` chip and **NO minutes figure at all.**
**FAIL:** it reads **`0 min on site`**. That is a fabricated measurement entering the dataset this feature exists to measure honestly — both stamps landing at the same instant means *we do not know how long it took*, not *it took no time*.

---

## CARD 5 — 🔴 THE PAYWALL TEST. With the tile OFF, the crew screen is byte-identical
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
`followup_engine` is **off by default** — `enabled:false, configured:false` at seed — so this is the state Test Dave's is already in unless you have turned it on.
1. With the tile OFF, run CARD 2 end to end.

**PASS:** marking a stop done does **exactly** what CARD 2 describes and **nothing else happens** — no prompt, no greyed button, no "upgrade to ask for reviews", no placeholder, nothing about reviews anywhere on the screen.
**FAIL:** anything at all about reviews is visible to the crew.
🔴 **Why this is the card that matters most:** a paywall on a crew member's phone is one the *customer* can read over their shoulder. The code makes it unrepresentable — `crewStopModel` takes no module state — but this card is what proves it in the real app.

---

## CARD 6 — the ask appears once Follow-Up is on, the link is set, and the stop is today's
**STATUS:** owed · **DEVICE:** phone · **WHO:** David, your own login · **TENANT:** Test Dave's · **LAST-PROVEN:** —
✏️ **RE-AIMED 2026-09-11 (#300).** This card used to say *"turn the tile on"* — **there is no control that does that**: `/subscription` lists Follow-Up under Coming (tech-debt #270). So: do **CARD 16** first (turns it on for Test Dave's, in the SQL editor), then **CARD 14's steps on Test Dave's** (save a review link on Business Profile). Then, on a phone, mark done a stop **dated today**.
1. A centered card appears: **"Ask for a review?"** with **`Show the code`** and **`Not this one`**.
2. Tap **`Show the code`**.

**PASS:** the screen goes fully white and shows *Thanks for choosing …*, the guidance line, and a **large scannable QR**. Scanning it with another phone opens **your review page directly** — no rating step, no questions, no in-between screen.
**FAIL:** any screening step appears before the review page; or the QR is missing, tiny, or does not scan.
⚠️ **Turn Wi-Fi and mobile data OFF and repeat.** The QR is drawn on the device and must still render — that is the point of it on twenty acres.
⚠️ **No prompt at all? Check the stop's date before anything else.** A stop dated two or more days ago does not prompt — that is CARD 17, and it is on purpose.

---

## CARD 7 — 🔴 "Not this one" is one tap and asks nothing
**STATUS:** owed · **DEVICE:** phone · **WHO:** David, your own login · **TENANT:** Test Dave's · **LAST-PROVEN:** —
Mark another stop **dated today** done and tap **`Not this one`**.

**PASS:** the prompt closes immediately. **No reason field. No confirmation. No "are you sure".** The card afterwards reads `· review not asked`.
**FAIL:** anything asks the crew to justify the skip.
🔴 **Why:** some jobs end badly. A crew that cannot skip cleanly will either ask at the wrong moment or stop tapping done altogether — and `fulfilled` feeds four other things.

---

## CARD 8 — the customer's line is REFUSED when it breaks Google's policy, and the link lives elsewhere
**STATUS:** owed · **DEVICE:** desktop · **WHO:** David, your own login · **TENANT:** Test Dave's · **LAST-PROVEN:** —
✏️ **RE-AIMED 2026-09-11 (#300):** the review link is no longer entered on this card — that is **CARD 14**, on Business Profile. This card keeps the copy refusal.
Open `/settings/all` as the owner → **Asking for reviews**.
1. The card says your Google review link is entered on **Business Profile**, with an **`Open Business Profile →`** button. Tap it, confirm it lands on Business Profile, and come back.
2. Leave *What the customer reads* **blank** and confirm the placeholder shows the shipped default: **"If you have a moment, we'd appreciate a review."**
3. Now type: **`Mention the crew by name and get 10% off`**.
4. Then replace it with: **`It helps if you mention how quickly we arrived.`**

**PASS:** at step ① the button opens `/settings/business` and **no link field remains on this card**. At step ③ the Save button **goes dead** and red text names the problems in words, quoting the policy. **At step ④ it is STILL refused** — that line names no staff and no product, and is the same prohibited act. Clearing the field re-enables Save.
**FAIL:** a second link field is still on this card; either line saves; or step ④ passes because the check only looks for words like "crew".
🔴 **Step ④ is the one that matters.** David's ruling (R-34): *"anything of the form 'it helps if you mention…' is the prohibited construction whatever follows it."* A check that only caught the crew and the plants would be enforcing a word list, not Google's clause — which prohibits requesting that specific content be included and does **not** enumerate which content.
⚠️ **Also confirm the refusal QUOTES the policy** rather than saying "not allowed". The owner should be able to check the refusal against the words.

## CARD 9 — with Follow-Up OFF, both settings surfaces tell the owner the truth
**STATUS:** owed · **DEVICE:** desktop · **WHO:** David, your own login · **TENANT:** Test Dave's (before CARD 16) or LAWNS (read only — do not Save) · **LAST-PROVEN:** —
✏️ **RE-AIMED 2026-09-11 (#300):** there are now two places that must say it — the *Asking for reviews* card, and the link's hint on Business Profile.
With `followup_engine` OFF:
1. Open `/settings/all` → **Asking for reviews**.
2. Open **Business Profile** and read the line under **Google review link**.

**PASS:** ① says the plan doesn't include the Follow-Up module, that **nothing is shown to a crew or a customer**, and that the settings are saved for when it is turned on — and the customer's line still saves. ② says **Follow-Up isn't on for this business, so nothing is shown to a crew or a customer yet — the link is kept for when it is.**
**FAIL:** either surface implies reviews are being asked for; or either hides itself (the owner then has no way to see what would happen).
*(§6 r18 — a header is a claim, and it must hold for every state the section can be in, including this one.)*

---

## CARD 10 — the same customer is not asked twice
**STATUS:** owed · **DEVICE:** phone · **WHO:** David, your own login · **TENANT:** Test Dave's · **LAST-PROVEN:** —
Needs CARD 16 and a saved link. Find a customer with **two** stops **both dated today** (or move a second stop for a customer you already asked onto today).
1. Mark the first done → **`Show the code`**.
2. Mark the second done.

**PASS:** the second stop shows **no prompt at all**. LAWNS has 1,936 customers with real repeat trade; being asked every visit is how a business trains its customers to ignore the ask. The window is 180 days.
**FAIL:** the prompt appears again.
⚠️ **A SKIP COUNTS TOO, TODAY.** Tap **`Not this one`** on the first stop instead and the second still shows no prompt: the window reads the ask record, and a skip writes it. **Whether a skip should start the window is owed to David** — a customer the crew chose not to ask was not asked.

---

## CARD 11 — the QuickBooks-ingested stops can be marked done
> ⚠️ **THE LIST BEHIND THIS CARD CHANGED 2026-09-01 (ledger #251) AND THE CARD ITSELF DID NOT.** The
> delivery list is now bounded — a selected day is asked for BY DATE, and the unfiltered list reaches
> thirty days back plus everything ahead — instead of reading the oldest 200 rows with no date bound
> at all. Nothing on this card should behave differently **today**; the change exists so that nothing
> on it behaves differently **after 564 past deliveries are imported**, when the old read would have
> pushed every stop on this card off the screen. **If any stop you expect is missing, that is this
> change and it is CARD 16 on the operations-calendar board, not a fulfilment defect.**
**STATUS:** needs-test · **DEVICE:** phone · **LAST-PROVEN:** —
**Reason it is `needs-test` rather than `owed`:** the nineteen rows the #246 ingest wrote are **LAWNS production data describing real customers and real future dates**, and this build has not been proven anywhere yet. Marking one done would write a completion time to a job that may not have happened. **This card becomes runnable once CARDS 1–10 pass on Test Dave's** — and even then it is David's call, not a builder's, because it is a claim about work at a real customer.

---

## CARD 12 — 🔴 a completed stop SAYS that the stock has not moved yet
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —

**Why this card exists.** `deliveries.status` and `orders.status` are two columns with no code path between them. Marking a stop done writes the first and never reads the second, so a completed stop can sit against an order that is still **open** — which under D-52 still **holds its commitment**. For a stop whose order came from Cultivar checkout and carries real lot ids, that is wrong in **both directions at once**: available understated (holding stock that has left) and on-hand overstated (counting stock that has left). **David ruled 2026-09-01 that the tap stays inventory-inert and the decrement gets its own build — so until that build lands, this sentence is the entire mitigation.** Wrong in both directions, invisibly, is what this fortnight's rulings are about.

1. Mark a stop done whose card is linked to an order that is still Pending or Invoiced.
2. Read the card.

**PASS:** an amber block appears under the status chip reading **exactly** *"Marked done. The order is still open — stock has not been taken out yet."*

**ALSO PASS (the silences, and they matter as much):** a stop with **no linked order** shows **nothing** — no amber block, no empty box. A stop whose order already reads Fulfilled or Cancelled shows **nothing**.

**FAIL:** the notice appears on a stop that is not done · the notice appears where there is no linked order · a completed stop against an open order shows nothing · the wording differs from the sentence above (it is David's, verbatim, and `deliveryFulfilment.test.ts` I2 pins it).

---

## CARD 13 — 🔴 NOTHING HAS EVER FIRED ON HISTORY (run this first)
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** David, SQL editor · **TENANT:** every tenant · **LAST-PROVEN:** —
**Read-only.** Paste into the Supabase SQL editor and run. Nothing is written.
```sql
-- CARD 13 — read-only. Has a review ever been asked on a stop dated before 2026-08-29?
SELECT b.name AS business,
       count(*) FILTER (WHERE d.delivery_date <  DATE '2026-08-29')                                   AS stops_before_aug29,
       count(*) FILTER (WHERE d.delivery_date <  DATE '2026-08-29' AND d.status = 'scheduled')        AS before_still_scheduled,
       count(*) FILTER (WHERE d.delivery_date <  DATE '2026-08-29' AND d.status = 'fulfilled')        AS before_fulfilled,
       count(*) FILTER (WHERE d.delivery_date <  DATE '2026-08-29' AND d.review_asked_at IS NOT NULL) AS asked_on_history,
       count(d.review_asked_at)                                                                       AS asked_ever
  FROM deliveries d
  JOIN businesses b ON b.id = d.business_id
 GROUP BY b.name
 ORDER BY b.name;
```
**PASS:** `asked_on_history` is **0** on every row.
**FAIL:** any `asked_on_history` above 0.
⚠️ **`before_still_scheduled` above 0 is NOT a fail** — it is why #300 added the date check: those stops still show a Mark done button, and marking one done no longer prompts (CARD 17). ⚠️ **`before_fulfilled` should be 0** — R-37's history import, the thing that would land past stops as `fulfilled`, is not built. If it is not 0, something else wrote them; tell Thunder.
*(Thunder could not run this: the read-only database key was not available in the build session, so the history check is yours.)*

---

## CARD 14 — 🔴 THE ACCEPTANCE CLAUSE: paste LAWNS's review link on Business Profile, and the Save reports per table
**STATUS:** owed · **DEVICE:** desktop · **WHO:** David, your own login · **TENANT:** **LAWNS** (then Test Dave's for the refusal half) · **LAST-PROVEN:** —
1. Admin → **Business Profile** (`/settings/business`). Under the sales tax rate there is a **Google review link** field.
2. Paste LAWNS's link exactly as Google gave it. **Touch nothing else.** Press **Save Profile**.
3. Reload the page.

**PASS:** the message reads exactly **`Saved`**; after reload the link is still in the field; the hint under it says **Follow-Up isn't on for this business, so nothing is shown to a crew or a customer yet** — true on LAWNS today. *(Optional, desktop console:* `[TRACE:TAX] business profile save — per-table outcome` *shows* `reviewLink: "written (set)"` *and* `taxRate: "not written — unchanged (0.0825)"`*.)*
**FAIL:** any other message; the link is gone after reload; or the trace says the tax rate was written.

**The refusal half — on Test Dave's, not LAWNS:** type `g.page/r/abc/review` (no `https://`) into the field. The hint turns **red** and says the link won't be saved. Change the phone number too, then **Save Profile**, then reload.
**PASS:** the message is **`Error: only part of this was saved. Saved: your business details. Not saved: the review link — it isn’t a web address — copy the whole link from Google, starting with https://.`** After reload the new phone number is there and the stored link is unchanged.
**FAIL:** `Saved`; the bad text is stored; or the phone change was lost with it.
⚠️ Any address starting `https://` is accepted — Google has issued several link shapes, and refusing one we don't recognise would lock the owner out.

---

## CARD 15 — an unchanged link is not written, and a link can be removed
**STATUS:** owed · **DEVICE:** desktop · **WHO:** David, your own login · **TENANT:** Test Dave's · **LAST-PROVEN:** —
With a link already saved on Test Dave's, change **only the phone number**, Save, and read the console line `[TRACE:TAX] business profile save — per-table outcome`.
**PASS:** `reviewLink: "not written — unchanged"` and the message is `Saved`.
**FAIL:** `reviewLink: "written (…)"` — the Save wrote a table nobody edited, the exact defect the profile Save was fixed for on 2026-09-10.
Then **empty the link field completely**, Save, reload.
**PASS:** the field stays empty, the message is `Saved`, and the trace says `written (clear)`.
**FAIL:** the old link comes back after reload.

---

## CARD 16 — turn Follow-Up on for Test Dave's, in the SQL editor, so the crew half can be seen
**STATUS:** owed · **DEVICE:** desktop (SQL editor) · **WHO:** David, SQL editor · **TENANT:** **Test Dave's only** · **LAST-PROVEN:** —
🔴 **Why this is SQL and not a button:** no screen can turn Follow-Up on (tech-debt #270). This calls the same narrow function the screens use, so it checks your permission and writes an audit row, and **it starts no trial clock** (`p_trial_days => NULL`). **Do not run it for LAWNS** — whether LAWNS gets Follow-Up, and on what terms, is your decision, not a test step.

Step 1 — confirm exactly one business matches (expect **one** row):
```sql
SELECT id, name FROM businesses WHERE name ILIKE 'Test Dave%';
```
Step 2 — turn it on:
```sql
SELECT * FROM public.set_business_module_state(
  p_business_id   => (SELECT id FROM businesses WHERE name ILIKE 'Test Dave%'),
  p_module_key    => 'followup_engine',
  p_enabled       => true,
  p_configured    => NULL,
  p_config_patch  => NULL,
  p_actor_user_id => (SELECT id FROM auth.users WHERE email = 'david_obrien2016@outlook.com'),
  p_trial_days    => NULL
);
```
**PASS:** one row back with `applied = true` and `enabled_after = true`.
**FAIL:** `applied = false` — read `reason`, which names the permission it wanted; or *"more than one row returned"* — step 1 matched more than one business, so stop.
To turn it off again afterwards, run step 2 with `p_enabled => false`.

---

## CARD 17 — 🔴 a stop marked done after its own date does NOT prompt
**STATUS:** owed · **DEVICE:** phone · **WHO:** David, your own login · **TENANT:** Test Dave's · **LAST-PROVEN:** —
Needs CARD 16 (Follow-Up on) and a review link saved on Test Dave's.
1. On `/delivery-schedule`, find a scheduled stop **dated two or more days ago**. If there isn't one, move a stop's date back three days, or use any earlier stop the list already shows.
2. Tap **`Start this stop`**, then **`Mark done`**.

**PASS:** the stop shows **Done** and **no prompt appears at all** — no *"Ask for a review?"* card — and the stop never reads `· review asked` or `· review not asked`.
**FAIL:** the prompt appears.
Then do the same on a stop **dated today**. **PASS:** the prompt appears (that is CARD 6).
🔴 **Why:** somebody catching up the record at a desk has no customer to hand the phone to. The only honest tap there would be *Not this one*, which records a skip nobody chose and stops that customer being asked on their next real visit. The same check is what keeps every stop dated before 2026-08-29 from ever prompting, whatever wrote the row.

---

## What this test deliberately does NOT cover

- 🔴 **THE INVENTORY COMPOSITION ITSELF — AND NO GREEN RUN OF CARD 12 STANDS IN FOR IT.** CARD 12 proves the *sentence* appears. It does **not** prove the divergence it describes, and **it cannot be proven with any data that exists today.** The two-directional error only occurs for an order whose lines carry a real `business_inventory_id`, and **there is no such delivery order in the tenant**: the nineteen QuickBooks-ingested stops and Saturday 2026-08-29's six receipt-captured stops **all carry NULL lots on every line**, so they commit nothing going in and decrement nothing coming out — they are invisible to inventory in both directions. Proving the composition needs a **real Cultivar checkout delivery order** (transport ≠ walk-in, a lot-anchored line), taken through checkout → crew tap → order status, watching `business_inventory.qty` and available-to-sell at each step. **Until such an order exists, this is UNPROVEN, and a card covered by data that cannot exercise it is a false green in its third variety.** Stated here rather than left to be assumed.
- **The reschedule half of the story.** *A reschedule is not a deletion* — a moved stop must say where it went and why — and the `why` vocabulary is **owed by David** (free text, or a closed set: weather · customer · crew · truck · stock-not-ready). Not built, not tested.
- **The other three consumers of the tap** — contractor pay, material consumption, and the day-actuals readout. All hang off this same write; none is built.
- **Saturday 2026-08-29's six real LAWNS stops.** They happened and Lauren will want to mark them. **That is David's to run, not a builder's.**
- **Whether the tap should also appear on the route screen** (`/deliveries`). The story names this as owed by David, with the constraint *"the answer must not be both, built twice."* It is mounted in ONE place — `DeliverySchedule`, which the operations calendar also renders as its day drill-in, so today's mount already serves both the day list and the calendar with one implementation. The route screen is a one-line mount of the same component when David rules.
- **A scroll or focus behaviour of the customer screen** — a render condition inside a `.tsx` cannot be asserted (tech-debt #134); these cards are the only proof that exists.
