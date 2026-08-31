# QUICKBOOKS DELIVERY INGEST — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and an
> unmerged branch looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel
> deploys the TREE and any push to `main`, docs included, moves the stamp. *(GATE 0 · OP-15.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and
> holds no data of its own).
>
> **This file is the ONLY source of truth for delivery-ingest owner-tests.** It is STANDING, not
> dated — run it after any change to `shipmentIngest.ts`, `deliveryIngestWriter.ts`, or the two
> `deliveries-*` branches of `api/qbo/router.ts`.

**DEVICE: desktop** — the ingest is a reconcile-shaped act performed at a desk, per
`capture=mobile / reconcile=desktop`. It reads eighteen rows of addresses; it is not a lot task.

---

## 🔴 GATE 0 — TWO THINGS BEFORE ANY CARD

**① READ THE STAMP** (above). **② THE MIGRATION MUST BE APPLIED.**
`supabase/migrations/20260831_deliveries_qb_invoice_id.sql`, in the **SQL editor** (not the table
editor — §6 r17). Until it is applied the panel says so **by name** and the Ingest button stays
disabled; that is CARD 2 and it is worth reading before you apply it, because it is the only
chance to see the refusal working.

---

## 🔴 WHY THIS BOARD EXISTS

Lauren was scheduling September off a calendar showing **one stop**. Eighteen invoices in her own
QuickBooks carry a future `ShipDate` — Sep 5 alone has two worth $13,200 — and she was about to
**photograph them**, which would have minted a duplicate of every one. The data was already there.

**The failure this board is actually guarding against is not a missing stop. It is a wrong
address.** A delivery at the wrong house sends a crew and a $7,000 tree to a stranger. Every card
below that looks pedantic is guarding that.

---

## CARD 1 — Eighteen stops, and the denominator is on screen
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Settings → Accounting → **Preview scheduled deliveries**.

- The line reads **"N of 1,469 invoices carry a ship date today or later"** — both numbers visible.
  A completeness claim you cannot see is one nobody checks.
- Every row shows customer, date, a **real street address**, and a phone or the words
  *"none on the invoice"* — never an empty cell.
- **Nothing has been written.** Reload the page: the table is gone and the calendar is unchanged.

---

## CARD 2 — Before the migration, it refuses and NAMES the blocker
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Run the preview **before** applying the migration.

- An amber panel names `20260831_deliveries_qb_invoice_id.sql` and says why: without it the ingest
  cannot recognise its own previous work and a second run would duplicate every stop.
- **The Ingest button is disabled.** It does not write "as best it can".

---

## CARD 3 — 🔴 THE REFUSALS ARE ABOVE THE STOPS, AND THEY SHOW THEIR WORKING
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

If any invoice's address could not be read, its row appears **first**, in red, with the **raw
QuickBooks lines** printed underneath.

- The reason is in words you can act on — *"Two lines both look like a street"*, not *"parse error"*.
- 🔴 **TRACE must never have guessed.** A row here is one you fix in QuickBooks or add by hand.
- **If there are zero refusals, that is a pass** — but read two or three addresses against
  QuickBooks anyway. This is the card where a silent wrong answer would hide.

---

## CARD 4 — 🔴 ARIEL THIRY. Your correction survives, and no second stop appears
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

**This is the card this build was rewritten for.** You moved Thiry to **19 September** in Cultivar;
invoice **3648.622** still reads **2 September**. Her row was entered by hand, so it carries no
QuickBooks id — the idempotency key **cannot see it**.

After ingesting:

- Thiry is still on **19 September**. Not 2 September.
- There is **exactly one** Thiry stop. Not two.
- She appears in the **"already on your calendar — left untouched"** table, with `19 Sep` under
  *On your calendar* and `2 Sep (stale)` under *On the invoice*.

🔴 **If you see two Thiry stops, or the 2nd, stop and report it — that is the whole ruling failing:
Cultivar owns the delivery date, QuickBooks owns the money.**

---

## CARD 5 — Ingest, then look at the calendar
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Press **Ingest**. Then open the operations calendar.

- The stops are there, on their dates, with the customer's name on each.
- **Sep 5 shows two.**
- ⚠️ **Three are OCTOBER — Robert Dees and Inez Vance on the 3rd, Lydia Yustman on the 17th — and
  they fall outside the calendar's current four-week window.** They are in the database and they
  will appear when the navigation work lands. **Their absence from the screen is not a failure.**
  Confirm them on `/deliveries` instead.

---

## CARD 6 — 🔴 RUN IT TWICE
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Press **Preview**, then **Ingest**, a second time.

- **Zero written.** The line says every stop was already there.
- The calendar is **unchanged** — same count, same dates.
- 🔴 **If the number of stops doubled, stop immediately.** That is the thirty-six-stop failure and
  it is the reason the migration exists.

---

## CARD 7 — The phone came across, and it did not overwrite one you had
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Open two customers created by the ingest on `/customers`.

- A customer who had **no** phone now has the ship-to number — that is the call-ahead working.
- A customer who **already had** a phone still has **their** number, not the invoice's.
- ⚠️ The **billing address is unchanged**. The ship-to is on the *delivery*, not on the customer —
  a ship-to varies per job site and must not overwrite a billing address.

---

## CARD 8 — 🔴 NOTHING ELSE MOVED
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

The acceptance criterion that matters most, and the one you can check in a minute.

- `/orders` — **no new orders.** None. This ingest creates calendar stops and nothing else.
- Inventory — **available-to-sell is identical to before the run.** Committed stock is derived
  from open orders; no order was created, so nothing can have moved.
- 🔴 **If any lot's available-to-sell changed, stop.** That is the D-52 landmine and it would mean
  a future-dated delivery is holding stock LAWNS could otherwise sell.

---

## CARD 9 — Other tenants are untouched
STATUS: needs-test · DEVICE: desktop · LAST-PROVEN: —
**REASON it is `needs-test` rather than `owed`:** proving this properly needs a second tenant with
its own QuickBooks connection, which does not exist today. The ingest resolves `business_id` from
the caller's Bearer token and every read is business-scoped, and the RLS policies on `deliveries`
are unchanged by this build — but that is an argument, not an observation, and this board does not
record arguments as passes.

---

## WHAT THIS BOARD DOES NOT COVER, NAMED RATHER THAN ASSUMED

- **The write-back.** Because Cultivar now owns the date, their QuickBooks invoices go stale every
  time Lauren moves a stop. Thiry is already an instance. That fix is a **write to their books** —
  D-37 territory — and it **needs David's ruling before it is built.** It is not in this build.
- **A re-sync.** There is deliberately none, and `ShipDate` is not read again after this seed.
