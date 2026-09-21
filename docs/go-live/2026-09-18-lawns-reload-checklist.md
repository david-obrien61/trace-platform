# LAWNS GO-LIVE RELOAD — checklist for David (do before 12:00 Friday)

**Written 2026-09-17 (ledger #346). Nothing here has been run.** Do the steps in order. If any
result is different from what is written, **stop** and send it to Thunder before the next step.
Where it says "SQL editor", use Supabase → SQL editor (never the table editor).

> ⏰ **TIMING — run the reload TONIGHT or EARLY FRIDAY, before training.** The undo refuses while a
> LIVE CAPTURE sits on an imported customer (a captured invoice or receipt is never removed), and
> training is when those appear. Measured live 2026-09-17: **0** captured orders on imported
> customers. Everything else people type while testing — phones, emails, addresses, practice orders —
> is taken by the wipe and never blocks it (ledger #348).
>
> ✅ **Test on LAWNS as much as you like.** Typing, editing and practice orders during testing are
> expected, and the reload clears them. Nothing here asks anyone to hold back.
>
> 🔴 **The product import INSERTS. Never press Import twice without an Undo in between** — a second
> press adds a second copy of every product. (Customers are matched on their QuickBooks id and would
> not double, but products would.)

---

## 1 · Backup check
Supabase dashboard → **Database → Backups**. **Pass:** a backup dated **today** is listed.
No backup today → stop.

## 2 · Counts before (SQL editor)
```sql
SELECT
 (SELECT count(*) FROM customers          WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS customers,
 (SELECT count(*) FROM customer_phones    WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS phones,
 (SELECT count(*) FROM customer_emails    WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS emails,
 (SELECT count(*) FROM customer_addresses WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS addresses,
 (SELECT count(*) FROM business_inventory WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND retired_at IS NULL) AS products_live,
 (SELECT count(*) FROM business_inventory WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS products_all,
 (SELECT count(*) FROM business_inventory_ledger WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS ledger,
 (SELECT count(*) FROM orders     WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS orders,
 (SELECT count(*) FROM deliveries WHERE business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS deliveries;
```
**Expect (as of 2026-09-17):** customers 1977 · phones 1513 · emails 1722 · addresses 1456 ·
products_live 647 · products_all 1094 · ledger 470 · orders 44 · deliveries 44.
Write down what you get — step 4 compares against it.

## 3 · Undo run eab7fbd2 — DRY RUN first, then real
**3a · Dry run (SQL editor).** It always ends in an error on purpose; the error IS the result, and
nothing is kept.
```sql
DO $$
DECLARE r jsonb;
BEGIN
  r := public.undo_import_run('ed2e5933-45dc-4b9b-a331-ddfd125e7a74'::uuid,
                              'eab7fbd2-04cd-45e5-b771-cbb07f662f6f'::uuid);
  RAISE EXCEPTION 'DRY RUN (nothing kept) %', r;
END $$;
```
**Expect** the error to read `DRY RUN (nothing kept)` followed by `"refused": false`,
`"customers_deleted": 1936`, `"contact_rows_deleted": 4609`, `"inventory_deleted": 647`,
`"unretired": 447`, and the three `practice_…` counts `0`.
**If it says `"refused": true` → do not run 3b.** The message names what blocked it. Run this to see
each blocker in plain words, then send it to Thunder. **It only reads — it deletes nothing.**
```sql
WITH run AS (SELECT 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'::uuid AS biz,
                    'eab7fbd2-04cd-45e5-b771-cbb07f662f6f'::uuid AS r)
SELECT 'a captured or live order on an imported customer — never removed; the reload must wait for it to be re-attached'
       AS what_is_blocking, o.id::text AS item, coalesce(o.notes, '(no number)') AS detail
  FROM orders o JOIN customers c ON c.id = o.customer_id, run
 WHERE o.business_id = run.biz AND c.import_run_id = run.r
   AND NOT (o.order_kind = 'test' AND o.import_run_id = run.r)
UNION ALL
SELECT 'a delivery stop on an imported customer', d.id::text, coalesce(d.address_line1, '(no address)')
  FROM deliveries d JOIN customers c ON c.id = d.customer_id, run
 WHERE d.business_id = run.biz AND c.import_run_id = run.r
UNION ALL
SELECT 'a product from this import that has stock history (a count or a movement)', b.id::text, b.name
  FROM business_inventory b JOIN business_inventory_ledger l ON l.inventory_id = b.id, run
 WHERE b.business_id = run.biz AND b.import_run_id = run.r
UNION ALL
SELECT 'a phone, email or address someone typed onto an imported customer — only blocks while writes to QuickBooks are ON',
       t.customer_id::text, t.value
  FROM (SELECT customer_id, import_run_id, value FROM customer_phones
        UNION ALL SELECT customer_id, import_run_id, value FROM customer_emails
        UNION ALL SELECT customer_id, import_run_id, coalesce(line1, label) FROM customer_addresses) t
  JOIN customers c ON c.id = t.customer_id, run
 WHERE c.business_id = run.biz AND c.import_run_id = run.r AND t.import_run_id IS DISTINCT FROM run.r
ORDER BY 1;
```
**What to do with it:** an order, a stop or a product with stock history means the reload waits (send it
to Thunder). A typed phone, email or address blocks **only** if writes to QuickBooks are ON — turn them
off in Settings and run 3a again; once `20260917b` is applied it never blocks at all.

**3b · Real undo (SQL editor)** — only if 3a matched:
```sql
SELECT public.undo_import_run('ed2e5933-45dc-4b9b-a331-ddfd125e7a74'::uuid,
                              'eab7fbd2-04cd-45e5-b771-cbb07f662f6f'::uuid);
```
**Expect** the same numbers as 3a, with no error.

## 4 · Counts after the undo
Run the step 2 query again. **Expect:** customers **41** · phones **34** · emails **7** ·
addresses **41** · products_live **447** · products_all **447** · ledger **470** (unchanged) ·
orders **44** (unchanged) · deliveries **44** (unchanged).
(Rehearsed on a copy of LAWNS on 2026-09-17: exactly these numbers.)

## 5 · Import — ONE press
1. The app → **Settings** → the QuickBooks section → panel **"Your customers and product list from
   QuickBooks"**. Check the page still shows **test mode** (writes to QuickBooks off).
2. Tap **Preview your books**. Wait for it to finish. **Write down the button's numbers** — it reads
   **"Import N customers and M products"**.
3. Tap **Import N customers and M products** — **once**. Wait for "Importing…" to finish.
   Do not tap again, even if it seems slow.

## 6 · Counts after the import
Run the step 2 query again. **Expect:**
- customers = **41 + N**
- products_live = **M** · products_all = **447 + M**
- ledger **470** · orders **44** · deliveries **44** — all unchanged
- phones, emails, addresses higher than step 4

And this — every contact row of the new customers carries the new run (**expect `untagged = 0`**):
```sql
SELECT count(*) AS untagged FROM (
  SELECT p.import_run_id AS r, c.import_run_id AS cr FROM customer_phones p JOIN customers c ON c.id = p.customer_id
   WHERE c.business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND c.import_run_id IS NOT NULL
  UNION ALL
  SELECT e.import_run_id, c.import_run_id FROM customer_emails e JOIN customers c ON c.id = e.customer_id
   WHERE c.business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND c.import_run_id IS NOT NULL
  UNION ALL
  SELECT a.import_run_id, c.import_run_id FROM customer_addresses a JOIN customers c ON c.id = a.customer_id
   WHERE c.business_id='ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND c.import_run_id IS NOT NULL
) x WHERE r IS DISTINCT FROM cr;
```

## 7 · Spot-check 3 customers
Pick three customers you know in QuickBooks (one person, one company, one with two phone numbers).
In the app: **Customers** → search the name → open it.
**Pass:** the **Phones**, **Emails** and **Addresses** lists show what QuickBooks shows, with the main
number marked **Main**, and there is only **one** row for that name in the Customers list.

## 8 · Spot-check 3 products
Pick three products (one tree, one service or fee, one bag/soil item).
In the app: **Inventory** → search the name.
**Pass:** name, size and price match QuickBooks; quantity is **0** (the import brings a price list,
not stock); there is **one** row for that product, not two.

---

## 9 · THE CURRENT RUN ID — the one the NEXT wipe uses

🔴 **`8ac868b3-4acf-4371-9883-cec6af5e5880`** — the run the **2026-09-21 16:11 UTC** reload created
(1,963 customers · 632 products · 512 seeded at 10). Verified live straight after: the previous
run `bffc7713` holds **zero** rows, the stock ledger is **still 470**, the not-stock list is
**empty**, and **all 127 captured receipts survived** the wipe.

Use it in the dry-run block below in place of the id shown there. ⚠️ **Every reload mints a new
id, so the one written here is stale the moment the next import runs** — read it back with:

```sql
SELECT DISTINCT import_run_id, count(*) OVER (PARTITION BY import_run_id) AS customers
  FROM customers
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND import_run_id IS NOT NULL;
```

<details><summary>Superseded: the 2026-09-17 run</summary>

## 9b · THE 2026-09-17 RUN ID — SUPERSEDED, kept for the record

**`bffc7713-d275-436c-bf8c-1ff29f3d14b9`** — the run the 2026-09-17 20:16 UTC import created
(1,956 customers · 631 products). The old run `eab7fbd2` is gone: zero customers, zero products,
zero contact rows, zero rows retired by it — measured read-only after the reload.

**Use it, not `eab7fbd2`, for the next undo.** Dry run first — this block CANNOT change anything,
because it always ends by raising, which rolls the whole thing back:

```sql
DO $$
DECLARE r jsonb;
BEGIN
  r := public.undo_import_run(
         'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'::uuid,
         'bffc7713-d275-436c-bf8c-1ff29f3d14b9'::uuid);
  RAISE EXCEPTION 'DRY RUN — nothing was kept. Result: %', r::text;
END $$;
```

Read the `refused` value in the error text. `refused: false` means the real undo would run and
what it would remove is listed beside it. `refused: true` names what is holding it.

⚠️ **The starting-number seed does not change this.** In test mode the seed writes **no ledger
row** (R-158 / #342), so the seeded rows carry no history and the undo still takes them.

</details>

---
**If anything went wrong after step 5:** undo the CURRENT run — step 9 has its id and the dry-run
block. Do **not** press Import again first.
