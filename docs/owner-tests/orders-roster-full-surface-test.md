# OWNER TEST — ORDERS ROSTER (the status vocabulary, and the filter that reads it)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance, no dashboard, no `git log`. *(GATE 0 · OP-15 · paid for on 2026-08-31: a whole
> session was spent hunting a defect in code that was never deployed.)*

**Capability:** 2.1 (orders / checkout) · 5.1 (inventory — available-to-sell)
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 8 covered.**

---

## ⛔ GATE 0 — DO THIS BEFORE READING ANY SCREEN (OP-15)

A failed Vercel build is **SILENT** — the last-good bundle keeps serving — and **Vercel deploys the TREE, not the COMMIT**. If the SHA under test is not live, every observation below is fiction.

1. `git log -1 --format=%h` on `main`.
2. Vercel dashboard: the deployment for **that exact SHA** reads **READY** (not a *different* push's Ready).
3. Open the app with `?debug=1` and confirm the **DebugPanel footer shows the same 7-char SHA**.
4. Hard-refresh.

If ①–③ do not agree, **STOP**. Do not record a pass or a fail.

---

## ✅ GATE 0b — THE DATA MIGRATION HAS RUN (2026-08-28)

This build is the one case where code and data had to ship together. **Run the dry run first and read it**, then apply:

```
node scripts/migrate-order-status-vocabulary.mjs            # reports, writes nothing
node scripts/migrate-order-status-vocabulary.mjs --apply
```

It **refuses to write** if the world has moved since the 2026-08-28 audit — the four settled walk-ins are re-verified by id against their own ledger rows, and a history line carrying a lot id aborts the run outright. A refusal is the script working, not a failure to route around.

✅ **APPLIED 2026-08-28. Result, for checking the cards below against:**

| tenant | after |
|---|---|
| LAWNS Tree Farm | `fulfilled` 1 · `invoiced` 8 |
| Test Dave's Tree Nest | `cancelled` 1 · `fulfilled` 5 · `invoiced` 10 · `pending` 17 |
| Test David's new Business | `pending` 1 |

**G5** zero rows read `confirmed` · **G3** LAWNS unchanged across all **447** lots · **G4** exactly **32** units newly committed across **4** lots, each attributed to one of the eight open orders.

⚠️ **G1 refused on its first run and it was the SCRIPT that was wrong, not the data** — it summed `aggregate_type='ORDER'` ledger rows, which carry **delta 0 by design** (D-52), making the guard unpassable. The sale rides `aggregate_type='INVENTORY'`, `kind='sale'`, `source_id = the order`. Fixed, re-verified: −2 · −2 · −4 · −5 against 2 · 2 · 4 · 5 units.

---

## SURFACE: the status vocabulary

### CARD 1 — `confirmed` is gone, everywhere
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #225

Open `/orders`.

- **No badge anywhere reads `Confirmed`.** The eight LAWNS history orders read **`Invoiced`**.
- Open one order. Its **Status** card offers exactly four buttons: **Pending · Invoiced · Fulfilled · Cancelled**.
- Open a customer with order history (`/customers/…`). Same four words, same colours.

🔴 **Why the rename could not ship on its own.** A deploy where the code says `invoiced` and the rows still say `confirmed` leaves Lauren looking at a screen of orders no chip can select. That is not hypothetical — it is the defect found in `user_stories.md` on 2026-08-27, where three stories carried a status the filter did not know and became reachable only under "all".

### CARD 2 — available-to-sell did not move for LAWNS
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #225

Open `/inventory`. Compare **Available** against the pre-migration numbers.

- **Nothing moves. Not one lot.**
- The migration asserts this itself (guard G3) and **exits 1** rather than reporting success if any LAWNS lot changed.

🔴 **This is the check that has caught two shipped defects in two days.** `confirmed` held a commitment and `invoiced` holds a commitment — `holdsCommitment()` still excludes exactly `fulfilled` and `cancelled` — so no reserved stock may move. LAWNS holds **zero** `invoiced` rows, so the customer's data cannot be touched by this at all.

### CARD 3 — the four settled walk-ins read `Fulfilled`
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #225

On the **f7ec5d67** test tenant, find orders `fdf522bd` · `dbf88429` · `1885f388` · `c9b192e3`.

- All four read **`Fulfilled`**.
- Their combined 13 units are **not** counted as committed anywhere.

🔴 **These are the rows the QuickBooks push corrupted.** Each was a walk-in — born `fulfilled`, on-hand decremented at checkout because the customer drove away with the trees — and then the invoice push overwrote the status. It was invisible while `invoiced` sat outside the enum. The day the enum was ratified those units would have been subtracted a second time, logically, on top of the physical decrement.

### CARD 4 — the eight open sales now hold their stock
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #225

On **f7ec5d67**, **four** lots move and **that is correct** — these are the numbers the applied migration actually produced:

| lot | available before → after | the order(s) responsible |
|---|---|---|
| Shoal Creek Vitex 30 | −12 → **−16** | `2661dbe4` install 4 |
| Live Oak 30 gal | 11 → **8** | `9a3cbc8b` install 3 |
| 'Sierra' Mexican Red Oak 15 | 22 → **15** | `2661dbe4` install 3 · `2f8846c4` install 4 |
| Shoal Creek Vitex 45 | 38 → **20** | `8792c641` 4 · `b8b546ec` 2 · `d38e27e1` 2 · `82faef45` 3 · `9a3cbc8b` 4 · `6b18c043` 3 |

- 4 + 3 + 7 + 18 = **32 units**, every one tied to an order id.
- **Any other lot moving is a defect** — guard G4 prints each mover with its order ids so this is checkable, not trusted.

⚠️ **FIVE lots were predicted and only FOUR moved. Alley Cat Redbud Espalier 15 stays 39 → 39**, because its only open contributors were two of the walk-ins that Write 1 sent to `fulfilled`. The earlier five-lot table described the state with all twelve `invoiced` rows open — the rename applied but the walk-ins not yet settled — which is a real intermediate moment and not the destination. Corrected here against the applied result rather than left to be discovered on the screen.

⚠️ **Shoal Creek Vitex 30 already read −12 before any of this.** Pre-existing, on a test tenant, **reported and deliberately not fixed**. Do **not** run `d52-remediate-committed-stock.mjs` against it casually.

---

## SURFACE: the filter

### CARD 5 — the default view hides nothing
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #225

Open `/orders` fresh.

- **Every order is visible.** `All` is the selected chip.
- The count reads a plain total — e.g. `9 orders` — with no "showing" clause.

🔴 **David's ruling.** Lauren's habit is the current screen; a default that hides rows on day one is how someone concludes an order vanished. The chips are the discovery, not a gate.

### CARD 6 — multi-select, and the count says what is hidden
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #225

- Tap **Pending**. The count changes to **`showing N of M`**.
- Tap **Invoiced** as well. **Both** kinds are listed — the chips union, they do not narrow to an intersection.
- Tap them both off. You are back to every order and the plain total.
- Tap **All** at any point. Same result, one tap.

Each chip carries its own count, so you can see how many rows a filter would reveal **before** tapping it.

### CARD 7 — a filter that matches nothing says so, and a failure does not
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #225

Select a status with a `0` count (e.g. **Cancelled** on a tenant with none).

- The screen reads **"No orders match these filters"** and tells you how many are hidden.
- A **Show all orders** button is right there.

Then, with DevTools open, throttle to offline and hit **Try again** on a reload:

- The screen reads **"Couldn't load orders"** with the error and a **Try again** button.
- 🔴 **It must NOT read "No orders match these filters."** Those two sentences say opposite things — one says your data is fine, the other says we could not read it — and showing the wrong one sends someone hunting an order that was never missing.

### CARD 8 — a status the vocabulary does not know is still reachable
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #225

You should not be able to produce this after the migration, and that is the point — the card exists so the guard is provable if it ever matters.

If an order ever carries a status outside the four (a legacy value, a hand-edit, a future migration mid-flight):

- It gets **its own chip**, in italics, with a **⚠️ icon**, labelled with its raw value.
- Hovering explains that the value is in your data but not one of the four.
- **The row is never invisible.** Zero orders are unreachable through the UI.

🔴 **This is the `needs-build` defect, prevented rather than repeated.** A chip list typed by hand goes stale the moment the data holds a value the list does not; these chips are derived from the vocabulary **unioned with the statuses actually present**. `orderRosterFilter.test.ts` §B asserts it, and the assertion was **proven red first** — with the union removed, six checks fail.
