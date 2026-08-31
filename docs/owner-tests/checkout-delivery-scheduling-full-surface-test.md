# CHECKOUT → SCHEDULED DELIVERY — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
> stamp. *(GATE 0 · OP-15 · paid for twice on 2026-08-31: once hunting a defect in code that
> was never deployed, once by a pinned SHA going stale on the very next commit.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for checkout-delivery-scheduling owner-tests.** It is
> STANDING, not dated — **run it after any change to `api/orders/submit.ts` or to what
> `/delivery-schedule` and `/deliveries` read.** A per-build proof is a FILTER on this board
> (`COVERS: #NNN`), never a second document (STD-011).

**Purpose:** prove that an order taken at the counter for delivery actually BECOMES a stop — and
that an order the customer hauls away does NOT.

**🔴 WHY THIS BOARD EXISTS.** Before 2026-08-25 `orders` and `deliveries` were **unconnected**.
Every row on `/delivery-schedule` and `/deliveries` arrived through the OCR-invoice door
(`api/customers/create.ts`), so **a real order placed today appeared on neither screen.** Measured
on order `9a3cbc8b-db56-49d6-bdd5-c07c9bcd2888` (`transport_method` `install`, `delivery_date`
2026-09-04): present in `orders`, absent from every delivery surface. The truck's day was assembled
from captured paper only.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Trustworthy. |
| `STATUS: owed` | 🟡 A test is written but has not been run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 The surface EXISTS and has NO test. A known hole, annotated, not an oversight. |
| `LAST-PROVEN: never` | Nobody has ever run this against the real UI. |
| `DEVICE:` | `desktop` — checkout and both delivery surfaces are read on a real screen. |
| `COVERS:` | The tech-debt row / ledger entry this check defends. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS below is visible without a console. |

🔴 **Thunder NEVER marks a card `covered` (OP-14).** Thunder writes the check and sets `owed`; only
David's live run flips it, with a date. **Changing a surface flips its card back to `owed`.**

---

## ⛔ GATE 0 — CONFIRM YOU ARE TESTING THE DEPLOYED CODE (OP-15 — owner-prove STEP ZERO)

> **This is STEP ZERO. Before you ring up a single order: confirm the deploy for the SHA under
> test is live.** If the SHA you are testing is not live, **everything below is fiction** — and on
> this board a wrong answer means real orders written against old code.

- [ ] **① SHA is live — READ IT OFF THE SCREEN.** The bottom of every Cultivar screen carries
      **`built <date> · <sha>`**. Compare to `git log -1 --format=%h`.
      App: `________` Intended: `________` — **they must MATCH.**
- [ ] **② The Vercel deploy for THAT SHA reads READY** — not a different push's Ready. A failed
      build is SILENT; Vercel keeps serving last-good, and **Vercel deploys the TREE, not the COMMIT.**
- [ ] **③ The new-code signal:** a checkout for delivery now produces a row on `/delivery-schedule`
      **within seconds, with no invoice photographed.** If the schedule is unchanged after a
      delivery order, you are on old code — **STOP.**

---

### CARD 1 — 🔴 A DELIVERY ORDER BECOMES A STOP
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #216 · the delivery half of the gap
SIGNAL: `[TRACE:DELIVERY] checkout delivery SCHEDULED — proven by the returned row { deliveryId: …, rowsReturned: 1, serviceType: 'delivery_only' }`

**As the OWNER**, ring up a normal order: pick a plant, choose **Delivery only**, pick a customer
who has an address on file, **set a delivery date you will recognise** (e.g. the second Thursday
from today). Complete the checkout and note the invoice number on the confirmation screen
(`CLV-…`).

**Then open `/delivery-schedule`.**

- **PASS — all five:**
  1. **exactly ONE new stop** appears (count the day's stops before and after — see CARD 5);
  2. it is bucketed under **the date you picked**;
  3. it shows the customer's **address, city, state and zip**;
  4. its service badge reads **Delivery only**;
  5. its notes carry **the invoice number from the confirmation screen**.
- **FAIL:** no new stop · two new stops · the wrong day · a blank address · a `Planting` badge.

---

### CARD 2 — 🔴 A DELIVERY-AND-PLANTING ORDER BECOMES A PLANTING JOB
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #216 · the `install → planting` mapping
SIGNAL: `[TRACE:DELIVERY] checkout delivery SCHEDULED … serviceType: 'planting'`

Same as CARD 1 but choose **Delivery + planting**.

- **PASS:** exactly ONE new stop, and its badge reads **Planting** — **not** Delivery only.
- **FAIL:** the badge reads Delivery only (the mapping is inverted or constant), or no stop appears.

🔴 **This is a separate card from CARD 1 on purpose.** A build that wrote every stop as
`delivery_only` would pass CARD 1 completely and lose the distinction the route planner uses to
decide how much of a day a job consumes.

---

### CARD 3 — 🔴 A SELF-HAUL ORDER CREATES NO STOP AT ALL
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #216 · the negative case — **the one most likely to break silently**
SIGNAL: `[TRACE:DELIVERY] checkout — self-transport, NO delivery row written (correct)`

Ring up an order choosing **No thank you / self-haul** (the netting prompt appears — answer it
either way, it does not matter here).

- **PASS:** `/delivery-schedule` and `/deliveries` are **completely unchanged.** No new stop, on
  any day, including undated.
- **FAIL:** a stop appears. **A customer who drove away with their tree is now on a delivery
  route**, and Lauren will plan a truck around a load that left hours ago.

⚠️ **Check the UNDATED bucket too**, not just the day you were looking at.

---

### CARD 4 — 🔴 THE STOP AND THE ORDER AGREE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #216 · order → stop traceability without an FK
SIGNAL: —

Take the stop from CARD 1 and the order behind it side by side (`/orders` → the order's drill-in).

- **PASS:** the invoice number on the stop's notes is the **same string** as the order's, the
  delivery dates match, and it is the **same customer**.
- **FAIL:** any mismatch. ⚠️ **There is no `order_id` column** (tech-debt **#108**) — the invoice
  number is the ONLY link, so if it is wrong the trail is gone.

---

### CARD 5 — 🔴 THE COUNT, NOT THE IMPRESSION
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-12 (a write must prove it wrote) · tech-debt #108
SIGNAL: `rowsReturned: 1` in the SCHEDULED line above — **exactly one, never "at least one."**

🔴 **This card exists because "a stop appeared" is not the same claim as "one stop appeared."**
Before each of CARDS 1–3, **write down the number of stops on the target day.** After, write it
again.

- **PASS:** delivery **+1** · install **+1** · self-haul **+0**.
- **FAIL — and this is the one to watch for: +2.** Re-submitting or editing an order can mint a
  second stop for one load, because there is no natural key. If you see it, **it is tech-debt #108
  and it is expected** — record it here rather than refiling it.

---

### CARD 6 — ⚠️ A CUSTOMER WITH NO ADDRESS ON FILE STILL GETS A STOP
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: A9 (absent is not empty) · the honest-blank case
SIGNAL: `[TRACE:DELIVERY] checkout — scheduling a stop { addressPresent: false }`

`needs-test` **with its reason: this needs a customer record deliberately created with no address,
which is a fixture nobody has set up.** The unit test proves the behaviour (`G2`/`G3`: the row is
written, the address columns are NULL, never an empty string); nothing has proven it through the
real UI.

- **INTENDED:** the stop still appears — **the truck still goes out** — with a visibly blank
  address rather than a fabricated one.
- **WRONG EITHER WAY:** no stop at all (the sale is invisible to the route), or an address that
  came from somewhere the platform does not actually hold.

---

### CARD 7 — ⚠️ THE EXISTING OCR-CAPTURED STOPS ARE UNTOUCHED
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: the MUST-NOT-DO half of ledger #216
SIGNAL: —

`needs-test` **with its reason: this is a proof of ABSENCE, and nothing in the build can
demonstrate it — only David's own data can.** No code in this pass reads, edits, de-duplicates or
re-dates an existing `deliveries` row, and `/delivery-schedule`'s rendering and `/deliveries`'
filter were not changed.

- **INTENDED:** every stop that was on the board before this deploy is still there, on the same
  day, with the same address and badge.
- **The only new thing** is that some stops now carry `source = 'checkout'` instead of
  `'ocr-invoice'` — a distinction that is **not rendered anywhere today.**

---

## WHAT THIS BOARD DOES NOT COVER (said out loud, so absence is not read as coverage)

- **The route map (`/deliveries`).** Its filter was deliberately not touched, so whether a
  checkout-sourced stop appears there depends on that filter's existing rules. **Unverified — no
  card written**, because changing the filter was out of scope.
- **Editing or cancelling an order.** `handleUpdate` / `handleDelete` do **not** touch the stop
  they created: an edited delivery date changes `orders.delivery_date` and leaves the
  `deliveries` row on its original day, and a deleted order leaves its stop standing. **Known,
  out of scope, tech-debt #108.**
- **A permission gate.** There is none, deliberately — the 2026-07-31 capability-not-a-field
  ruling. Nothing here tests a refusal, because there is no refusal to test.
- **Whether the ship-to may differ from the billing address.** It cannot today. That is the
  In-store purchase workflow story's owed `conditional-address-on-delivery` sub-story.
