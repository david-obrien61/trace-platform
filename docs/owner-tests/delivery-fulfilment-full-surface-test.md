# OWNER TEST — THE FULFILMENT TAP, AND THE REVIEW ASK

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** 3.4 (scheduling) · 3.5 (delivery / routing) · the first capability behind `followup_engine`
**Story:** `user_stories.md` → *The stop is done — one tap, and a moved stop says where it went* (PIECES `fulfilment_tap`, `delivery_complete_state`) · *Ask for a review at the door* (new this build)
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 12 covered** (11 `owed` · 1 `needs-test`).
**DEVICE:** CARDS 1–7 and CARD 12 are **`DEVICE: phone`** — this is a crew surface in a customer's garden, and every one of them is provable **without a console**. CARDS 8–10 are `DEVICE: desktop` (the owner's settings). CARD 11 is `needs-test`.

---

## ⛔ GATE 0b — THE MIGRATION IS NOT APPLIED, AND THE SCREEN WILL TELL YOU SO

🔴 **`supabase/migrations/20260831d_deliveries_fulfilment_and_review_ask.sql` is GATED and UNAPPLIED.** Four nullable columns on `deliveries`. Until you run it in the **SQL editor** (§6 r17 — *not* the table editor, whose default ACL hands `anon` TRUNCATE and REFERENCES, a privilege RLS cannot filter):

- the delivery list still loads — it falls back to the pre-migration column set rather than blanking, which is deliberate;
- and every stop card reads **"Marking stops done isn't available yet — the database update (20260831d) hasn't been applied."**

✅ **That sentence is itself CARD 1.** If you see the buttons before running the migration, something is wrong with the fallback, not with the migration.

The migration carries its own pre-write and post-apply verification queries, including the §6 r17 privilege fingerprint. Run them; do not take the apply on trust.

---

## CARD 1 — the pre-migration state is honest, not silently missing
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
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

## CARD 6 — the ask appears once the tile is on and the link is set
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
Do CARD 8 first (turn the tile on, save a review link). Then mark a stop done on a phone.
1. A centered card appears: **"Ask for a review?"** with **`Show the code`** and **`Not this one`**.
2. Tap **`Show the code`**.

**PASS:** the screen goes fully white and shows *Thanks for choosing …*, the guidance line, and a **large scannable QR**. Scanning it with another phone opens **your review page directly** — no rating step, no questions, no in-between screen.
**FAIL:** any screening step appears before the review page; or the QR is missing, tiny, or does not scan.
⚠️ **Turn Wi-Fi and mobile data OFF and repeat.** The QR is drawn on the device and must still render — that is the point of it on twenty acres.

---

## CARD 7 — 🔴 "Not this one" is one tap and asks nothing
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
Mark another stop done and tap **`Not this one`**.

**PASS:** the prompt closes immediately. **No reason field. No confirmation. No "are you sure".** The card afterwards reads `· review not asked`.
**FAIL:** anything asks the crew to justify the skip.
🔴 **Why:** some jobs end badly. A crew that cannot skip cleanly will either ask at the wrong moment or stop tapping done altogether — and `fulfilled` feeds four other things.

---

## CARD 8 — the owner enters the one new field, and bad copy is REFUSED
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Open `/settings/all` as the owner → **Asking for reviews**.
1. Paste your Google review link. Save.
2. Leave *What the customer reads* **blank** and confirm the placeholder shows the shipped default: **"If you have a moment, we'd appreciate a review."**
3. Now type: **`Mention the crew by name and get 10% off`**.
4. Then replace it with: **`It helps if you mention how quickly we arrived.`**

**PASS:** at step ③ the Save button **goes dead** and red text names the problems in words, quoting the policy. **At step ④ it is STILL refused** — that line names no staff and no product, and is the same prohibited act. Clearing the field re-enables Save.
**FAIL:** either line saves, or step ④ passes because the check only looks for words like "crew".
🔴 **Step ④ is the one that matters.** David's ruling (R-34): *"anything of the form 'it helps if you mention…' is the prohibited construction whatever follows it."* A check that only caught the crew and the plants would be enforcing a word list, not Google's clause — which prohibits requesting that specific content be included and does **not** enumerate which content.
⚠️ **Also confirm the refusal QUOTES the policy** rather than saying "not allowed". The owner should be able to check the refusal against the words.

## CARD 9 — the tile-off settings card tells the owner the truth
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
With `followup_engine` OFF, open the same settings card.

**PASS:** it says the plan doesn't include the Follow-Up module, that **nothing is shown to a crew or a customer**, and that the settings are saved for when it is turned on. The fields still work.
**FAIL:** the card claims reviews are being asked for, or hides itself entirely (the owner then has no way to see what would happen).
*(§6 r18 — a header is a claim, and it must hold for every state the section can be in, including this one.)*

---

## CARD 10 — the same customer is not asked twice
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
On Test Dave's, find a customer with **two** stops (or schedule a second one for a customer you already asked).
1. Mark the first done → **`Show the code`**.
2. Mark the second done.

**PASS:** the second stop shows **no prompt at all**. LAWNS has 1,936 customers with real repeat trade; being asked every visit is how a business trains its customers to ignore the ask. The window is 180 days.
**FAIL:** the prompt appears again.

---

## CARD 11 — the QuickBooks-ingested stops can be marked done
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

## What this test deliberately does NOT cover

- 🔴 **THE INVENTORY COMPOSITION ITSELF — AND NO GREEN RUN OF CARD 12 STANDS IN FOR IT.** CARD 12 proves the *sentence* appears. It does **not** prove the divergence it describes, and **it cannot be proven with any data that exists today.** The two-directional error only occurs for an order whose lines carry a real `business_inventory_id`, and **there is no such delivery order in the tenant**: the nineteen QuickBooks-ingested stops and Saturday 2026-08-29's six receipt-captured stops **all carry NULL lots on every line**, so they commit nothing going in and decrement nothing coming out — they are invisible to inventory in both directions. Proving the composition needs a **real Cultivar checkout delivery order** (transport ≠ walk-in, a lot-anchored line), taken through checkout → crew tap → order status, watching `business_inventory.qty` and available-to-sell at each step. **Until such an order exists, this is UNPROVEN, and a card covered by data that cannot exercise it is a false green in its third variety.** Stated here rather than left to be assumed.
- **The reschedule half of the story.** *A reschedule is not a deletion* — a moved stop must say where it went and why — and the `why` vocabulary is **owed by David** (free text, or a closed set: weather · customer · crew · truck · stock-not-ready). Not built, not tested.
- **The other three consumers of the tap** — contractor pay, material consumption, and the day-actuals readout. All hang off this same write; none is built.
- **Saturday 2026-08-29's six real LAWNS stops.** They happened and Lauren will want to mark them. **That is David's to run, not a builder's.**
- **Whether the tap should also appear on the route screen** (`/deliveries`). The story names this as owed by David, with the constraint *"the answer must not be both, built twice."* It is mounted in ONE place — `DeliverySchedule`, which the operations calendar also renders as its day drill-in, so today's mount already serves both the day list and the calendar with one implementation. The route screen is a one-line mount of the same component when David rules.
- **A scroll or focus behaviour of the customer screen** — a render condition inside a `.tsx` cannot be asserted (tech-debt #134); these cards are the only proof that exists.
