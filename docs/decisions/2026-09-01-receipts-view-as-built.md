# The receipts view — as built, and the numbers re-measured at close-out

**Ledger #250.** Branch `thunder/receipts-view`, off `main` at `84cc695`. BUILDER-COMPLETE;
owner-proof owed (`docs/owner-tests/receipts-view-full-surface-test.md`, 11 cards, 0 covered).

---

## 1 · What shipped

| File | What |
|---|---|
| `packages/cultivar-os/src/lib/receiptsList.ts` | **NEW, pure.** The projection, the banked-verdict read-back, the outcome chain, the honest count, and the step at which the list is on screen. Every DECISION lives here because a render condition in a `.tsx` cannot be asserted (tech-debt #134). |
| `packages/cultivar-os/src/lib/receiptsList.test.ts` | **NEW. 87 assertions**, probes both directions (STD-022). |
| `packages/cultivar-os/src/components/receipts/ReceiptsList.tsx` | **NEW.** One `.select()`, `[TRACE:receipts-list]` ON, and honest loading / failed-read / empty states. |
| `packages/cultivar-os/src/pages/ReceiptKeeper.tsx` | **+11 lines.** An import and one mount. The seven-state wizard is otherwise byte-identical. |
| `scripts/measure-receipts-view.mjs` | **NEW, read-only.** The census below. Writes nothing. |

**No migration · no `api/` function (12/12 untouched) · no new permission · no write of any kind.**
`/receipts` already gates on `costs:read` (`router.tsx`, the `PermissionRoute` wrapper) and
`receipts` already carries dual owner+member RLS on `business_id`
(`20260612_receipts.sql:31-63`).

`npm run verify` **exit 0, ZERO net-new** (tsc 5 · eslint 245 · knip 10/12/15) ·
**58/58 test files, 2994 assertions** · `build:cultivar` clean.

**14/14 mutants caught, measured against a green CONTROL run.** The harness keys off the EXIT
CODE, never a word-grep of the runner's output — #248's lesson, where *"RED — 1 test file(s)
failing"* was read as a survivor. 🔴 **One mutant genuinely SURVIVED first:** coercing an
unusable number to `0` instead of to absent. Every "never fabricate a figure" probe had been
written against `null`, which short-circuits on the first guard **before reaching the coercion** —
so the guarantee was proven for one input and assumed for the rest. Closed by E5b/E5c and
re-measured. The two joins are the ones the prompt asked to plant against: **M1** (orders embed
removed) and **M2** (deliveries embed removed) both go red, and so does **M13** (the six
write-only columns dropped from the projection).

---

## 2 · The numbers, re-measured

🔴 **The recon's figures were a snapshot taken on 1 September and Lauren is still uploading, so
they are re-measured here rather than carried forward as facts.** Re-measured
**2026-09-01T17:31Z** by `scripts/measure-receipts-view.mjs`. **Population is stated for every
count** — rows examined, not only rows matching.

| Measure | Snapshot, 1 Sep | **Re-measured 17:31Z** | Population | Drift |
|---|---|---|---|---|
| `receipts` rows, LAWNS | 17 | **17** | 36 rows read | none |
| `receipts` rows, all tenants | 36 | **36** | 36 rows read | none |
| Receipts that produced an order | 11 | **11** | 17 LAWNS receipts | none |
| Receipts that produced no order | 6 | **6** | 17 LAWNS receipts | none |
| Order kinds produced | 10 invoiced + 1 fulfilled, all `history` | **10 `history/invoiced` + 1 `history/fulfilled`** | 11 receipt-linked orders | none |
| Duplicate pairs by content key (vendor + date + amount) | 2 | **2** — `bwi\|2026-07-29\|1283.88` (`e301ece1`, `83dc023d`) · `bailey bark materials, inc.\|2026-07-07\|2316.03` (`e509fb65`, `fb27da2d`) | 17 LAWNS rows bucketed | none |
| `reconcile_status` distribution | 17/17 `match` | **17/17 `match`** | 17 LAWNS rows | none |
| `reconcile_delta` distribution | 17/17 zero | **17/17 zero, 0 NULL** | 17 LAWNS rows | none |
| `accept_vs_edit` distribution | 17/17 `edited`, 0 `accepted_as_is` | **17/17 `edited`** | 17 LAWNS rows | none |
| `reconcile_overridden_at` populated | 0/17 | **0/17** | 17 LAWNS rows | none |
| `deliveries` with `source='ocr-invoice'` | 11 | **11** | 30 LAWNS deliveries | none |
| …of those, `delivery_date` NULL | 2 | **2** | 11 ocr-invoice deliveries | none |
| `cost_objects.receipt_id` populated | 0/5 | **0/5** | 5 LAWNS `cost_objects` rows | none |
| `business_inventory.receipt_id` populated | 0/447 | **0/447** | 447 LAWNS `business_inventory` rows | none |
| Vendor distribution | LAWNS ×9 · bwi ×4 · Bailey Bark ×3 · Sudderth ×1 | **`LAWNS Tree Farm, LLC.` ×9 · `bwi` ×4 · `Bailey Bark Materials, Inc.` ×3 · `Sudderth Brothers Contracting, Inc.` ×1** | 17 LAWNS rows | none — ⚠️ the stored strings are longer than the recon's shorthand, which matters because the screen prints them verbatim |
| 🔴 **Does `receipts` carry ANY origin/shape/source column?** | not reported by the recon | 🔴 **NO — none of `origin` / `shape` / `source` / `doc_type` / `document_type` / `kind`.** The 21 live columns are `accept_vs_edit, amount, amount_original, business_id, category, created_at, date, header_amount_edited, id, image_url, line_items, line_items_original, ocr_cost_estimate, ocr_raw, reconcile_delta, reconcile_overridden_at, reconcile_status, status, updated_at, uploaded_by, vendor` | 21 live columns examined via `select *` | **answered** |

**⚠️ Zero drift across 24 minutes** — every figure held. That is a fact about the window, not
about the future: the same script re-run tomorrow is the only thing that can say so again.

### Three measurements the recon did not have

1. 🔴 **`receipts with >1 order` = 0 of 17.** The recon reported the bwi duplicate as producing
   orders `dc943a79` and `eb3ab2b0`, which reads as one receipt with two orders. It is not:
   **two receipts, one order each**, both carrying document number **19837964**, both with a
   delivery whose `delivery_date` is NULL. The screen therefore shows them as **two rows with one
   order apiece** — which is the acceptance criterion, and the reason it is worth stating is that
   a build aimed at the other shape would have rendered it wrong.
2. 🔴 **`header_amount_edited` is FALSE on 17 of 17** while `accept_vs_edit` reads `edited` on
   17 of 17. **This narrows the open question without answering it:** whatever the owner changed
   before saving, **it was never the total.** (`ReceiptKeeper.tsx` sets `edited` if any of vendor,
   date, amount, category **or the line items** changed.) The question stays OPEN and is David's.
3. **`deliveries.source` distribution: `qbo-shipdate` = 19 · `ocr-invoice` = 11**, and **all 30
   LAWNS deliveries carry an `order_id`.** The receipts view only ever reaches the 11.

---

## 3 · The two open questions, untouched

Both were named as out of scope and are recorded here so they are not answered by accident:

1. **Why `accept_vs_edit` reads `edited` on every row.** Narrowed as above. ⚠️ Lightning's
   hypothesis — that it may be an accurate signal rather than a broken one, because if OCR never
   parses cleanly then every capture gets edited, making it the same fact as the parse-failure
   banner — is recorded **for the record and not to be built against**.
2. **Why the 1 September captures wrote receipts but no orders.** Measured: **8 receipts captured
   that day; 2 produced orders** (the bwi 2026-07-29 pair, at 15:49 and 15:51), 6 did not. Whether
   that is correct behaviour on a purchase invoice or a defect is exactly what the screen is
   forbidden from deciding.

---

## 4 · What was deliberately not done

| Not done | Why |
|---|---|
| Repair the two duplicate captures | Live customer data. David's call, not a step inside a view build. |
| Backfill `cost_objects.receipt_id` / `business_inventory.receipt_id` | Same — and it is now logged as tech-debt **#144**, because the seam has been designed since 12 June and written by nothing. |
| Re-stamp or re-evaluate any reconcile column | Option E, out of scope by instruction. `line_items` is not even selected, so it is impossible rather than discouraged. |
| Derive a document type on the stored rows | [[R-48]]. No column exists to hold one; retro-classifying from the vendor name works on these 17 rows and is not a rule. |
| A per-receipt detail view (`/receipts/:id`) | Option D. `ProjectCostDrillIn` still degrades to `/receipts` with its comment intact — tech-debt **#145**. |
| Render receipt images | The `receipts` **bucket** is not the `receipts` **table**; `ReceiptKeeper.tsx`'s `supabase.storage.from('receipts')` is a bucket call and a name-grep miscounts it. |
