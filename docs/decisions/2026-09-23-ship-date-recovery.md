# Recovering QuickBooks ShipDate onto the imported history

**Ledger #392 · David's F-task, 2026-09-23 · crew-link**

---

## 🔴 F1 COULD NOT BE EXECUTED — THERE IS NO QUICKBOOKS TOKEN

I was asked to read LAWNS's QuickBooks read-only and report ShipDate coverage across the 1,484
invoices of run `8ac868b3`. **I cannot: there is no credential to read with.** Measured
2026-09-23 against the live `businesses` table, all three tenants:

| business | `accounting_token` | `accounting_refresh_token` | `expires_at` | `needs_reconnect` | realm |
|---|---|---|---|---|---|
| LAWNS Tree Farm, LLC | **null** | **null** | 2026-09-23T21:44:15 | `false` | 9341455222430707 |
| Test Dave's Tree Nest | **null** | **null** | 2026-09-22T16:06:13 | `false` | 9341453505617600 |
| Test David's new Business | **null** | **null** | null | `false` | — |

**No coverage figure is reported, because any number I produced would be invented.** This is the
one thing F1 asked for and it is honestly unavailable until David reconnects QuickBooks.

### 🔴 AND THE PLATFORM CURRENTLY CLAIMS IT IS CONNECTED

`Dashboard.tsx:294` computes the banner as `accounting_needs_reconnect || tokenExpired`. For LAWNS
`needs_reconnect` is `false` and `accounting_token_expires_at` is **in the future**, so
`tokenExpired` is false too — **the dashboard shows the QuickBooks connection as healthy while both
tokens are NULL and no read can authenticate.** A reconnect banner that stays silent when the
credential is absent is the exact shape of a false green: the screen answers "is QuickBooks
connected?" with yes, on the strength of a timestamp rather than a token.

**Filed as a finding, not fixed here** — it is a dashboard-honesty defect on a different surface
from this task, and guessing at its right behaviour (does a null token mean expired, or never
connected?) is David's call.

---

## F2 · Where the ship date lands, and why the backfill is NOT a migration

**THE CALL: a new `orders.ship_date` column — `supabase/migrations/20260923j_orders_ship_date.sql`,
WRITTEN and HELD.** Not `delivery_date`, because `delivery_date` is a PLANNING field that the
schedule and the route page read, and writing 1,484 historical ShipDates into it would make years of
finished invoices appear on Lauren's schedule as scheduled delivery days. Measured: `delivery_date`
is populated on 43 of 1,530 history orders and the stop machinery writes it; `install_date` is
populated on 0 and is a third fact again.

**THE BACKFILL IS DATA-ONLY AND LIVES HERE, NOT IN `supabase/migrations/`.** Two reasons, and the
second is the load-bearing one:

1. It writes no schema — it is an `UPDATE` keyed on `qb_invoice_id`.
2. 🔴 **It cannot run yet, and an unrunnable file in the migrations folder is a trap.** Its source
   is a live QuickBooks read that currently has no token. Dropped in `supabase/migrations/` it would
   sit in the apply-state list looking pending, and whoever ran it would get **0 rows updated with
   no error** — a silent no-op indistinguishable from success. That is §6 r24's failure mode
   (an empty result reading as an answer) expressed as a migration.

### The runnable form, for when the token is back

```sql
-- PRE-FLIGHT — refuses rather than no-ops. Run this FIRST; it must return can_run = true.
SELECT (SELECT accounting_token IS NOT NULL FROM public.businesses WHERE name ILIKE 'LAWNS%' LIMIT 1) AS token_present,
       (SELECT count(*) FROM public.orders WHERE order_kind='history' AND qb_invoice_id IS NOT NULL) AS matchable_rows,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema='public' AND table_name='orders' AND column_name='ship_date') = 1 AS column_exists;
```

Then, per invoice read from QuickBooks (`Id` → `qb_invoice_id`, `ShipDate` → `ship_date`):

```sql
UPDATE public.orders SET ship_date = $2::date
 WHERE business_id = $3 AND qb_invoice_id = $1 AND ship_date IS DISTINCT FROM $2::date;
-- Report rows-matched AND rows-updated separately. A run that matches 1,484 and updates 0 has
-- either already run or read nothing; those are different facts and must not share a number.
```

⚠️ **State the denominator with the numerator.** The report must read *"ShipDate recovered on N of
1,484"*, never a bare N — the same discipline the existing invoice walk already applies with its
"18 of 1,469".

---

## F3 · Where the import must be fixed so the NEXT load carries ShipDate

**Precisely located, and smaller than expected: the field is already parsed and then dropped.**

| step | file | state |
|---|---|---|
| Read it from Intuit | `packages/shared/src/quickbooks/shipmentIngest.ts:134` — `shipDate: str(r?.ShipDate)` | ✅ **already carried** on `QboShipmentRow.shipDate` (`:71`) |
| Carry it into the history plan | `packages/shared/src/quickbooks/historyOrderWriter.ts:309` — maps `documentDate: invoice.txnDate` | 🔴 **never reads `shipDate`** |
| Write it | the order insert in the same writer | 🔴 no `ship_date` in the column list |

**Size: small — one field through one existing path.** Add `ship_date` to the writer's order shape
and its insert, thread it from `invoice.shipDate`, and register the path per §6 r21 with an
end-to-end test that enters a ShipDate at the real entry point and reads it back from the database.
No new module, no new endpoint, `api/` unchanged at 12/12.

⚠️ **The parse is NOT the gap and must not be "fixed".** `parseShipmentList` maps every invoice with
no filter and has carried `shipDate` all along — the "18 of 1,469" in `router.ts` is a *later*
future-dated filter for the deliveries preview, not a coverage figure for ShipDate. Anyone reading
that comment as "only 18 invoices have a ShipDate" would draw the wrong conclusion.

---

## What this changes about the warranty window

The window's date-source order becomes: **stop Done timestamp → `ship_date` → `delivery_date` →
`sale_date`**, and the screen says which it used. Until the token is restored and the next load
runs, `ship_date` is NULL on every row, so the window falls through to `sale_date` — which David
judged tolerable on 2026-09-01 (a few days' error on a six-month window). **The screen must still
name `sale_date` as the source**, so nobody reads a fallback as a measurement.


---

# ✅ F1 ANSWERED FROM THE EXPORT — 2026-09-24

The live pull was impossible (no token; see above, still NULL as of 2026-09-24 15:47 UTC). David
supplied today's QuickBooks export instead. **Every figure below is labelled `QB export 2026-09-24`
and is a SNAPSHOT, not live** (Rule 25) — the final reload still runs through the live connection.

Source: `~/Downloads/24SepLawns/qbo-invoices-…json`, `queried_at 2026-09-24T16:17:51Z`,
`complete: true`, **1,530 of 1,530** invoices retrieved. Parsed count equals `retrieved_total`, so
the read is complete and the figures below are not computed off a short page.
⚠️ Read in place. No customer data was copied into chat or into this repository.

## Coverage  [QB export 2026-09-24]

| | count |
|---|---|
| invoices in the export | **1,530** |
| **carrying `ShipDate`** | **630** (41.2%) |
| `ShipDate` format | **`YYYY-MM-DD` on all 630** — no other shape occurs |

## Matching against what we imported  [QB export 2026-09-24]

| | count |
|---|---|
| our history orders | 1,546 |
| carrying a `qb_invoice_id` | **1,503** |
| 🔴 **matched to an export invoice** | **1,503 — every one. ZERO unmatched.** |
| 🔴 **ship date therefore recoverable on** | **603 of 1,546** |
| matched, but QuickBooks holds no ShipDate | 900 |
| no `qb_invoice_id` at all — unmatchable by any key | **43** |

**The key is sound**: `qb_invoice_id` → `Invoice.Id` matched 1,503 of 1,503 with no misses, so the
backfill is not guessing at its join. The ceiling is QuickBooks' own coverage, not ours: **900
invoices simply never had a ShipDate entered**, and 43 of our rows carry no invoice id to match on.

⚠️ **603, not 630.** The export's 630 includes invoices we did not import (the export is 1,530 and
our history is 1,546 — the two sets are not the same population, and neither is a subset of the
other). Quoting 630 as "recoverable" would overstate it by 27.

⚠️ **The pairs run to 2026-10-28** — future-dated ShipDates exist in the books. `ship_date` is
therefore not "when it shipped" for every row; for future dates it is when it is *due to* ship.
Anything reading it as a planting date must say so, which is why the warranty window labels its
source.

## The backfill

Generated from the export as **603 explicit `(qb_invoice_id, ShipDate)` pairs** — self-contained, so
it needs no QuickBooks call to run. One `BEGIN … COMMIT`, a temp table, and:

* it **REFUSES** if `orders.ship_date` is absent, or if **0 pairs match** — a backfill that matches
  nothing and reports success is §6 r24's failure mode wearing a migration's clothes;
* it reports **matched and updated separately**, because "matched 603, updated 0" means *already
  applied* and must never share a number with *read nothing*;
* the post-run verify asserts **shape and run-time reads only** — no pinned live count, after
  `20260923j`'s V3 pinned 43 and read 59 on the day David ran it (§6 r26).

🔴 **THE GENERATED FILE IS DELIVERED TO DAVID'S FOLDER ONLY AND IS NOT COMMITTED.** It carries 603
invoice ids and dates drawn from a customer's books; David's instruction was to keep export data out
of the repo. What is committed is this method plus the generator, so the file is reproducible from
the export without the data living in git.
