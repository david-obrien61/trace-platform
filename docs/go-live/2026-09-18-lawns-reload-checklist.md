# LAWNS GO-LIVE RELOAD — checklist for David (do before 12:00 Friday)

**Written 2026-09-17 (ledger #346). Nothing here has been run.** Do the steps in order. If any
result is different from what is written, **stop** and send it to Thunder before the next step.
Where it says "SQL editor", use Supabase → SQL editor (never the table editor).

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
**If it says `"refused": true` → stop** and send the whole message (someone added something by hand to
an imported customer or product since Thursday).

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
**If anything went wrong after step 5:** the new run can be undone the same way as step 3, with its
own run id — ask Thunder for the exact line. Do **not** press Import again first.
