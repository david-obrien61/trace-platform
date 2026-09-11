# OWNER TEST — ONE STOP, THREE SCREENS

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** 3.4 (scheduling) · 3.5 (delivery / routing) · 3.6 · 2.1 (checkout)
**Story:** `user_stories.md` → *One stop, the same on every screen — and where it goes can change* (ledger #301)
**Surfaces:** the ONE `<StopCard>` as it renders on **`/delivery-schedule`**, **`/deliveries?date=`** and **`/orders/:id`** — and the checkout stop it must show.
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 10 covered** (9 `owed` · 1 `needs-test`).

> 🔴 **WHO CAN RUN WHAT, AND ON WHICH TENANT.**
> **David can run these now, SQL editor, read-only, no phone:** CARD 1 (every tenant).
> **David's own login, LAWNS, LOOKING ONLY — tap nothing, save nothing:** CARDS 2, 3, 4, 10.
> **David's own login, Test Dave's — these WRITE:** CARDS 5, 6, 7, 9. 🔴 **Never on LAWNS**: a ship-to edit there moves a real customer's truck, and a checkout there pushes a real invoice.
> **Needs a login David does not hold:** CARD 8 (a STAFF member without `order_items:read`) — `needs-test`.
>
> **🔴 RUN CARD 1 FIRST.** It writes nothing and tells you what every other card should show.

---

### CARD 1 — the census: which stops will show lines, and which will say why not
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #301
SIGNAL: `[TRACE:STOP] read { stops, linkedOrders, ordersWithLines, linesRead: true }`

**Supabase SQL editor.** Paste and run — one statement, it writes nothing:

```sql
SELECT b.name AS business,
       count(*) AS stops,
       count(*) FILTER (WHERE d.order_id IS NULL) AS says_no_order,
       count(*) FILTER (WHERE d.order_id IS NOT NULL
                          AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = d.order_id)) AS says_no_items,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = d.order_id)) AS shows_lines,
       count(*) FILTER (WHERE d.source = 'checkout') AS from_checkout,
       count(*) FILTER (WHERE d.source = 'checkout' AND d.order_id IS NULL) AS checkout_without_order
FROM deliveries d
JOIN businesses b ON b.id = d.business_id
WHERE d.status <> 'cancelled'
GROUP BY b.name
ORDER BY stops DESC;
```

**PASS** — the LAWNS row reads what Thunder measured on 2026-09-11 (any later change must be a real new stop):
`stops 39 · says_no_order 1 · says_no_items 0 · shows_lines 38 · from_checkout 0`.
Test Dave's reads `from_checkout 2 · checkout_without_order 2` — **those two were written before this build and are expected**; CARD 7 adds the first one that must NOT be counted there.
**FAIL:** LAWNS `shows_lines` below 38, or any number you cannot explain.

---

### CARD 2 — 🔴 a stop on the schedule shows what is on its order
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #301 · DeliveryDayIssue9Sep0943hrsL.pdf

**LAWNS, your own login, looking only.** On the phone, open **`/delivery-schedule`** and scroll to **Saturday 12 September**.

**PASS — every stop card on that day, all four:**
1. a grey block headed **`ON THIS ORDER · N LINES`**;
2. each line shows a **code** (e.g. `Oak:MO95`), the **description with its size** (e.g. *Monterrey Oak - 95 gallon*) and **×quantity**;
3. **no prices** anywhere on the card;
4. under the lines, the amber sentence **"Copied from the invoice, so any trip charge, fee or discount on it is listed too — nothing yet marks which lines go on the truck."**

**FAIL:** a card with an address and nothing about the order · a blank block · a price.

---

### CARD 3 — the stop with nothing to show says so, in words
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #301

**LAWNS, looking only.** On the calendar pick **Tuesday 8 September**. Find **David Forero** (the one LAWNS stop with no order — CARD 1's `says_no_order`).

**PASS:** in amber, **"No order is linked to this stop, so nothing records what goes on the truck."**
**FAIL:** an empty space where the order block should be — a blank reads as *nothing to load*.

---

### CARD 4 — 🔴 the SAME stop reads the SAME on the schedule, the route, and the order
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #301 · STD-017

**LAWNS, looking only — press no button on any card.** Pick one Saturday 12 September stop and write down: customer name · ship-to address · the lines · the status label · which buttons show.

1. `/delivery-schedule` → the stop (the day's own heading is this screen's only addition).
2. Press **Route this day** → `/deliveries?date=2026-09-12` → the same stop (a checkbox and a number are this screen's only addition).
3. `/orders` → open that customer's order → scroll below **Delivery & totals** → **Delivery stop** (the money above is this screen's only addition).

**PASS:** name, address, every line, status and buttons are **identical on all three.**
**FAIL:** anything present on one and absent on another. 🔴 **The route showing only a name and an address is the defect this board exists for.**

---

### CARD 5 — 🔴 change the ship-to: the stop moves, the customer's billing does not, and the change is kept
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #301 · D-41 L1

**Test Dave's only — this writes.**

**① Pick a stop.** SQL editor:

```sql
SELECT d.id AS stop_id, d.delivery_date, d.address_line1, d.city, c.first_name, c.last_name
FROM deliveries d
LEFT JOIN customers c ON c.id = d.customer_id
WHERE d.business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'
  AND d.customer_id IS NOT NULL AND d.status <> 'cancelled'
ORDER BY d.delivery_date DESC NULLS LAST
LIMIT 10;
```

**② Read it BEFORE.** Replace `PASTE-STOP-ID` with one `stop_id` and run. Keep the result.

```sql
SELECT d.address_line1 AS stop_street, d.city AS stop_city, d.zip AS stop_zip,
       c.billing_line1 AS billing_street, c.billing_city, c.billing_zip,
       c.address_line1 AS customer_street_mirror, c.city AS customer_city_mirror,
       (SELECT count(*) FROM audit_log a
         WHERE a.action = 'delivery.ship_to_changed' AND a.target_id = d.id::text) AS ship_to_changes,
       (SELECT a.detail FROM audit_log a
         WHERE a.action = 'delivery.ship_to_changed' AND a.target_id = d.id::text
         ORDER BY a.created_at DESC LIMIT 1) AS latest_change
FROM deliveries d
LEFT JOIN customers c ON c.id = d.customer_id
WHERE d.id = 'PASTE-STOP-ID';
```

**③ In the app**, open that stop on `/delivery-schedule` → **Change address** → set **Street** to `2020 Saco St` and **City** to `Liberty Hill` → **Save address**.

**④ Run ② again.**

**PASS — all four:**
1. `stop_street` = `2020 Saco St`, `stop_city` = `Liberty Hill`;
2. 🔴 **`billing_street`, `billing_city`, `billing_zip`, `customer_street_mirror` and `customer_city_mirror` are EXACTLY what they were in ②**;
3. `ship_to_changes` went up by **1**;
4. `latest_change` shows `customer_id`, `before` (the old street) and `after` (`2020 Saco St`).

**FAIL:** any customer column changed · no history row · the card still shows the old address.

---

### CARD 6 — the route's Google Maps link carries the new address
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #301 · ledger #286 (a link must not outlive what it was built from)
SIGNAL: `[TRACE:ROUTE] stop changed — rebuilding the route from the re-read`

**Test Dave's only — this writes.** Use a day with **at least one stop that has an address**.

1. `/deliveries?date=<that day>` → **Route N Stops** → wait for the route card.
2. On a **selected** stop, **Change address** → a different real street and city → **Save address**.

**PASS:** the route card disappears and **comes back by itself**, the numbered list shows the new address, and **Open in Google Maps** shows the new street among the destinations.
**FAIL:** the old address in the link, or a route card that did not rebuild.

---

### CARD 7 — 🔴 an order rung up at checkout lands a stop that shows its order
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #301 · the checkout gap (`scheduleCheckoutDelivery` wrote no `order_id`)

**Test Dave's only — a checkout pushes an invoice.**

1. Ring up **two** of one plant, choose **Delivery only**, a customer with an address, and a delivery date you will recognise. Complete it.
2. Open `/delivery-schedule` on that date.

**PASS (screen):** the new stop shows **`ON THIS ORDER · 1 LINE`** with the plant's name **and size** and **×2** — and **no** amber "copied from the invoice" sentence (a checkout order's trip charge lives in its services, never in its lines).

**PASS (SQL)** — run this, it writes nothing:

```sql
SELECT d.created_at, d.source, d.order_id,
       (SELECT count(*) FROM order_items oi WHERE oi.order_id = d.order_id) AS lines
FROM deliveries d
WHERE d.business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'
  AND d.source = 'checkout'
ORDER BY d.created_at DESC
LIMIT 3;
```
The **newest** row has a non-empty `order_id` and `lines` ≥ 1.
**FAIL:** "No order is linked to this stop" on the new stop, or `order_id` empty on the newest row.

---

### CARD 8 — a viewer who may not read the order is told so, not told it is empty
STATUS: needs-test
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #301 · six-state ruling 2026-07-30

**Why `needs-test`:** it needs a member **without `order_items:read`**, and David holds only the owner login. The decision is proven by probe (`stopLoad.test.ts` B3/B4, `stopRead.test.ts` C1/C2): no lines query is sent, and the card reads **"What's on this order"** withheld, naming the permission — never *"No items recorded"*.
**When a STAFF login exists:** open `/delivery-schedule` as that member. **PASS:** the withheld notice naming `order_items:read`. **FAIL:** *"No items recorded on this order."*

---

### CARD 9 — an address the map cannot find is refused in words
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #301 · §1.6 item 3

**Test Dave's only.** Open any stop → **Change address**.

1. Clear **Street** → **Save address**. **PASS:** *"A delivery address needs a street."* and nothing saved.
2. Put a street back, clear **City** AND **ZIP** → **Save address**. **PASS:** *"Add a city or a ZIP code — without one the map cannot find this address."*
3. **Cancel.** **PASS:** the card shows the address it had before.

**FAIL:** a save that went through, or a silent button.

---

### CARD 10 — a fee line is shown as what it is, never as something to load
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: R-144 · tech-debt #139

**LAWNS, looking only.** Find a Saturday 12 September stop whose order carries **`TC` Trip Charge**.

**PASS — both:** the trip charge line **is listed** (nothing is hidden by its name), and the heading reads **"On this order"** — nowhere on the card does it say *load* or *on the truck* except the amber sentence warning that fees may be among the lines.
**FAIL:** the trip charge silently missing (a name filter), or a heading that calls these lines the load.
