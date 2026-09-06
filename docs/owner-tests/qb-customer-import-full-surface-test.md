# OWNER TEST — THE QUICKBOOKS CUSTOMER IMPORT: THE 1,946, AND THE 27 WHO MUST NOT BE CHARGED TAX

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*

**Capability:** 3.5 (QuickBooks) · **Ledger:** #278
**Story:** ⚠️ **OPEN — and I did not close it by inventing one.** `user_stories.md` has no heading
covering "bring my customer list across from my accounting system". The same gap #277 recorded for
the catalogue import. **Recorded OPEN rather than papered over** (§9 story gate).
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to
`covered`, with a date.**
**Board: 0 of 17 covered** (15 `owed` · 2 `needs-test`).
**TENANT:** LAWNS = `ed2e5933-45dc-4b9b-a331-ddfd125e7a74` · Test Dave's = `f7ec5d67-a9ef-4cb0-b807-438d67687d1b`.
**ACTOR:** the business OWNER on every card unless the card says otherwise. The ingest is
owner-gated (R-80) **and** requires `customers:create` + `customers:update` — an AND, not an OR.

---

> ✅ **NO MIGRATION. NOTHING TO APPLY. THIS BUILD IS CODE ONLY.**
> Every column it writes already exists on `customers`, verified against the live catalog
> 2026-09-06: `tax_exempt` · `tax_exempt_reason` · `tax_exempt_cert_ref` · `qb_customer_id` ·
> `import_run_id` · `display_name` · `organization_name` · `billing_*`. The two things #277's
> migrations added — `customers.import_run_id` and the non-partial
> `customers_business_qb_customer_uidx` — are **applied and confirmed**, and this build is the
> first thing that writes either.

> 🔴 **THE ONE THAT MATTERS IS CARD 4, AND IT IS NOT THE IMPORT — IT IS THE SIX.**
> Twenty-one customers are exempt on their invoices. **Twenty-seven are exempt on the record.**
> The six the invoices could never have shown you have never yet been *billed* exempt:
> Austin Outdoor Design · Craig · Leaf Tree Services · Paul's Lawn & Landscape ·
> Silver Drop Irrigation and Landscape Services LLC · The Austin Groundskeeper Inc.
> If CARD 4 comes back 21, the import read the wrong source and **those six get charged tax on
> their next sale.**

> ⚠️ **THERE IS NO UNDO ROUTE, DELIBERATELY, AND CARD 17 IS WHERE THAT DECISION LIVES.**
> `undoCustomerImport` is written and probe-covered but **is not wired to any endpoint**, because
> `customers:delete` is one of the five UNMINTABLE deletes (`permissionManifest.ts` R2/A3: *"must
> be UNFINDABLE by grep"*), gated on *first answering the FK-cascade query* — and that query
> **cannot be answered from the repo**: `orders.customer_id` is live-only schema (tech-debt #39)
> and its `ON DELETE` rule is in no migration. **Import onto Test Dave's until David rules.**

> ⚠️ **THERE IS NO SCREEN, AND SAYING SO STOPS A MISSING THING READING AS A BROKEN ONE.**
> The two endpoints are reachable by URL (`/api/qbo/customers/preview`, `/api/qbo/customers/ingest`)
> and every card below drives them from the **browser console** or the **SQL editor** — exactly as
> #277's catalogue-import board does, and for the same reason: the panel is a separate build.
> **No `api/` function was minted** — 12/12 held; these are two branches on the router that already
> exists. **No new permission string** — `customers:read` / `:create` / `:update` all pre-date this.
>
> **THE CALL, used by every card that says "run the preview" or "run the ingest":**
> ```js
> const r = await fetch('/api/qbo/customers/preview?business_id=<tenant>', {   // or /ingest, POST
>   method: 'GET',                                                            // ingest: method: 'POST'
>   headers: { Authorization: 'Bearer ' + (await window.supabase.auth.getSession()).data.session.access_token }
> });
> console.log(await r.json());
> ```

---

## CARD 1 — the preview writes nothing · `STATUS: owed` · `DEVICE: desktop`
**COVERS: #278**
1. Sign in as the OWNER on `cultivar-os.app`. Note `SELECT count(*) FROM customers WHERE business_id = '<tenant>';`
2. Run the **PREVIEW** call above.
3. Run the same count again.
**PASS:** the count is **identical**, and the response carries a plan — `toCreate`, `toReconcile`,
`wrote: false`. A preview that changes the count is a commit wearing a plan's label.

## CARD 2 — the walk is complete or it refuses · `STATUS: owed` · `DEVICE: desktop`
**PASS:** the preview reports `readable: 1946` against LAWNS. If QuickBooks returns fewer than it
counted, the call must come back **INCOMPLETE and refuse** — never a shorter list with a caveat.

## CARD 3 — 🔴 the exempt count is 27, not 21 · `STATUS: owed` · `DEVICE: desktop`
**PASS:** the preview says `exemptCount: 27`. **21 is the failure**, and it is the failure that
looks most like success — it is the number the invoices give.

## CARD 4 — 🔴 THE SIX WHO HAVE NEVER BEEN BILLED EXEMPT · `STATUS: owed` · `DEVICE: desktop`
After a commit, in the SQL editor:
```sql
SELECT display_name, tax_exempt, tax_exempt_reason
  FROM customers
 WHERE business_id = '<tenant>' AND tax_exempt = true
   AND display_name IN ('Austin Outdoor Design','Craig','Leaf Tree Services',
                        'Paul''s Lawn & Landscape',
                        'Silver Drop Irrigation and Landscape Services, LLC',
                        'The Austin Groundskeeper, Inc.');
```
**PASS: all six come back, `tax_exempt = true`.** Fewer than six means the exemption was derived
from invoices and these customers will be charged tax they do not owe.

## CARD 5 — 🔴 four readable reasons, twenty-three honestly unnamed · `STATUS: owed` · `DEVICE: desktop`
```sql
SELECT tax_exempt_reason, count(*) FROM customers
 WHERE business_id = '<tenant>' AND tax_exempt = true GROUP BY 1 ORDER BY 2 DESC;
```
**PASS:** exactly **four** rows read as a word — `GOVT` · `School` · `Ag` · `City Of Liberty`, each
followed by `(QuickBooks reason N)` — and **23** begin `reason not identified`.
🔴 **A permit number (`32093937053`, `2-4629800259`, `#32063706967`) appearing as a reason is a
FAIL.** Those are carried in `tax_exempt_cert_ref`, never rendered as a reason.

## CARD 6 — the certificate is kept even when the reason is not named · `STATUS: owed` · `DEVICE: desktop`
```sql
SELECT display_name, tax_exempt_reason, tax_exempt_cert_ref FROM customers
 WHERE business_id = '<tenant>' AND tax_exempt_cert_ref IS NOT NULL;
```
**PASS: nine rows.** Five read `reason not identified` **and still carry their permit number**.
Do-not-interpret is not do-not-keep.

## CARD 7 — 🔴 taxability never reads off a "3" · `STATUS: owed` · `DEVICE: desktop`
```sql
SELECT count(*) FROM customers WHERE business_id = '<tenant>' AND tax_exempt = true;
```
**PASS: 27.** If it returns **1,946**, the import read `DefaultTaxCodeRef` (which is `"3"` on every
customer, taxable ones included) instead of `Taxable`. That is the single most consequential
misreading available here, and it makes the whole book tax-free.

## CARD 8 — 🔴 THE PRE-EXISTING NINETEEN ARE NEVER STAMPED · `STATUS: owed` · `DEVICE: desktop`
**Run BEFORE the import** and keep the output:
```sql
SELECT id, qb_customer_id, email FROM customers
 WHERE business_id = '<tenant>' AND qb_customer_id IS NOT NULL ORDER BY qb_customer_id;
```
Import, then run again adding `import_run_id`.
**PASS: every one of those rows still has `import_run_id IS NULL`, and the same `id`.** They are
matched and reconciled, never re-created.
🔴 **A run id on any of them is a data-loss defect, not a cosmetic one** — the undo is keyed on it,
so those customers, with their orders and deliveries, become deletable.

## CARD 9 — a curated value survives the import · `STATUS: owed` · `DEVICE: desktop`
1. Before importing, pick one of the 19 and **edit its email in the UI** to something distinctive.
2. Import.
**PASS:** the edited email is **unchanged**, and that row's `tax_exempt` now matches QuickBooks.
An existing row gets its tax status reconciled and nothing else — name, email, phone and address
may have been corrected locally, and QuickBooks is not automatically the better copy.

## CARD 10 — the count goes up by exactly the right number · `STATUS: owed` · `DEVICE: desktop`
**PASS:** `customers` for the tenant rises to **30 + (1,946 − 19) = 1,957** on LAWNS, and the run
report's `created` equals `stampedWithThisRun`. Those two being different means rows were claimed
that did not land.

## CARD 11 — 🔴 TWICE MUST NOT MEAN DOUBLE · `STATUS: owed` · `DEVICE: desktop`
Run the import **a second time** without undoing.
**PASS:** the count does **not** move, `created` is **0**, `toReconcile` is 1,946. The non-partial
unique index plus the partition is what makes this true; if the second run creates anything, the
identity is not holding.

## CARD 12 — the unique index actually refuses · `STATUS: owed` · `DEVICE: desktop`
After an import, run and then **ROLL BACK**:
```sql
BEGIN;
  INSERT INTO customers (business_id, first_name, qb_customer_id)
  SELECT business_id, 'DUP PROBE — ROLL BACK', qb_customer_id FROM customers
   WHERE business_id = '<tenant>' AND qb_customer_id IS NOT NULL LIMIT 1;
ROLLBACK;
```
**PASS:** `ERROR: duplicate key value violates unique constraint
"customers_business_qb_customer_uidx"`. A unique index nobody has watched refuse is a claim
(§6 r19b). ⚠️ Run it only **after** an import — before that the SELECT matches little and proves less.

## CARD 13 — 🔴 THE 72 ARE SHOWN AND NOTHING IS MERGED · `STATUS: owed` · `DEVICE: desktop`
**PASS:** the preview reports `duplicateRecordCount: 72` — *not 54*, which was phones alone — and
after the commit **every one of them exists as its own row**. Spot-check
that **Heller Landscapes Inc. and Ronnie Heller are BOTH present**, and both **ATX Property
Management and Brandon Diggs**. A company and its owner sharing a mailbox is the
one-person-many-accounts model, not a duplicate.

## CARD 14 — a job site never becomes a billing address · `STATUS: owed` · `DEVICE: desktop`
```sql
SELECT count(*) FROM customers
 WHERE business_id = '<tenant>' AND import_run_id IS NOT NULL AND billing_line1 IS NOT NULL;
```
**PASS: about 1,448**, not 1,946. `ShipAddr` is present on all 1,946 records but only 754 carry a
`Line1`; the rest are id-only husks. A number near 1,946 means `ShipAddr` was used as a fallback,
and some customers are now billed at a work site.

## CARD 15 — 🔴 A MANAGER CANNOT IMPORT · `STATUS: owed` · `DEVICE: desktop` · **ACTOR: MANAGER**
Sign in as the MANAGER and run the **ingest** call.
**PASS:** refused — **403**, `code: FORBIDDEN`. ⚠️ **The PREVIEW call should still return 200**
(it needs only `customers:read`).
🔴 The manager floor holds `customers:create`, so the verb alone is not the gate — `owner_id` is
(R-80). If a manager can commit, the owner check is not firing.

## CARD 16 — the run is nameable afterwards · `STATUS: owed` · `DEVICE: desktop`
```sql
SELECT import_run_id, count(*) FROM customers
 WHERE business_id = '<tenant>' AND import_run_id IS NOT NULL GROUP BY 1;
```
**PASS:** one run id, one count, matching the report. This is the only handle that exists on what
the run made — see CARD 17.

## CARD 17 — ⚠️ THERE IS NO UNDO, AND THIS CARD RECORDS WHY · `STATUS: needs-test` · `DEVICE: desktop`
**REASON IT IS `needs-test` RATHER THAN A CHECK:** `undoCustomerImport` exists, refuses while
QuickBooks writes are on (R-95), is scoped to its own run id, and is proven by 23 mutants — **but
it is wired to no route.** `customers:delete` is one of the five UNMINTABLE deletes (R2/A3), and
the manifest conditions any future one on *first answering the FK-cascade query*, which
**`orders.customer_id` cannot answer from the repo** (live-only schema, tech-debt #39).
**DAVID RULES.** Until he does: **import onto Test Dave's, not LAWNS**, because on LAWNS there is
no supported way to take 1,927 rows back out.

---

## NOT COVERED, AND SAID SO
- **`people` rows.** This import creates none, on purpose (`people` has no `import_run_id`, so they
  could never be undone). Nothing on this board asserts that from the UI; probe §H asserts it
  against a recording client.
- **The merge.** Not built, and not merely unbuilt: `customers.qb_customer_id` is single-valued, so
  one local customer cannot hold two QuickBooks ids. Waits on `customer_qb_links`.
- **Terms and discounts.** Deliberately not imported. `SalesTermRef` is on **2 of 1,946** customer
  records; the 96% / "50% Down" pattern is invoice-level and belongs to a different build.
- **`customer_type`.** Classified by a stated rule (DisplayName == CompanyName, or no personal
  name), not by anything QuickBooks records. ~559 of 1,946 land as organizations. No card proves
  it because there is no external truth to check it against — **David's eye on the list is the test.**
