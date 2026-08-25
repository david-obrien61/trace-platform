# RECON — WHY LISTS SHOW FEWER ROWS THAN THE TABLE HOLDS, AND HOW AN ADDRESS IS COMPOSED

**Date:** 2026-08-25 · **HEAD at recon:** `df988cc` · **Branch:** `main`
**Type:** LOOK ONLY. No code, no schema, no migration, no policy, no cap. Nothing under
`packages/` `api/` `supabase/` changed — proven by `git diff --stat` at close.
**Tenant measured by David:** Test Dave's `f7ec5d67-a9ef-4cb0-b807-438d67687d1b`

> ⚠️ **THIS MACHINE HAS NO CATALOG ACCESS.** Per the 2026-08-22 ruling — *a claim about the database
> is sourced from the catalog or it is not made* — every statement below about a column's shape cites
> the migration that declares it, and where the migration cannot settle a question the answer is a
> **branch table plus the query that settles it**, never a headline. `orders` and `social_drafts` have
> **no `CREATE TABLE` in version control at all** (tech-debt #39 / #27), so their column shapes are
> genuinely unknowable from this repo and are presented as branches.

> ⚠️ **STATED DEVIATION (§9 gate 10 · §6 r10).** The three-lens recon gate requires HAVE / NEED / WANT
> and OPTIONS spanning NEED→WANT. David's prompt said **"Do NOT propose options — findings only, both
> parts."** Honored. This document reports HAVE only. Options for every finding here are **owed** and
> are produced when David asks for a build. Recorded rather than silently taken.

> ⚠️ **CONCURRENT SESSION.** `packages/shared/src/business-logic/customerUpsert.ts` was already
> modified in the working tree at session open and was **not touched**. Where this recon cites that
> file it quotes **`git show HEAD:`**, not the working copy, so no in-progress edit is reported as fact.

---

## THE HEADLINE, BOTH PARTS IN ONE SENTENCE EACH

**PART A.** The customers roster and the delivery schedule shrink for **two entirely different
reasons at two different layers**, and only one of them is silent: the roster **announces** its own
filtering (`"1 of 17 shown"`) and the missing Diane Foster is not hidden by any query — she is
**not matched**, because the search reads a field set that omits the two identity columns the Name
column itself renders. The delivery schedule hides rows **server-side and says nothing at all**.

**PART B.** 🔴 **David's composite reading survives contact with the source exactly, and the site is
one line: `ScanOrder.tsx:93` takes the street from `billing_line1` while `:94-96` take city, state
and zip from the legacy columns.** It is not a fallback that happened to mix — it is an
unconditional split, four sibling fields, one written to the D-41 rule and three left behind.

🔴 **AND THE PART THAT MATTERS MORE THAN THE COMPOSITE ITSELF — B3's ANSWER:** the `deliveries` row
does **NOT** inherit the composite. `submit.ts:271-274` re-reads the customer from the database and
applies billing-preferred-legacy-fallback to **all four** fields. So for Diane Foster the review
screen says **Georgetown 78628** and the stop written for the truck says **Leander 78641** — two
towns about fifteen miles apart, and **nothing on either screen says they disagree.** The defect is
display-only in the sense that no data is corrupted; it is **not** display-only in the sense that
matters, because the person who confirms the order and the person who drives the truck are reading
two different addresses.

---

# PART A · LISTS RETURN FEWER ROWS THAN THE TABLE HOLDS

## A1 — THE CUSTOMER LIST / SEARCH

### The list query — it filters nothing

[`Customers.tsx:117-138`](../../packages/cultivar-os/src/pages/Customers.tsx#L117-L138), the whole of `loadCustomers`:

```ts
const run = (cols: string) => supabase.from('customers').select(cols)
  .eq('business_id', businessId).order('created_at', { ascending: false });
let { data, error } = await run(FULL);
if (error && (code === '42703' || code === 'PGRST204')) ({ data, error } = await run(CORE));
```

**There is no `DISTINCT`, no `GROUP BY`, no `.single()`, no `.limit()`, no status predicate and no
dedup in JS after the fetch.** The only predicate is `business_id`. The FULL→CORE retry is a
deploy-window fallback on a *missing column*, not a row filter. **Both Diane Foster rows are in
`customers` state after this call.**

### The search — client-side, substring, over eight fields

The engine is the shared `<DataSheet>`. [`DataSheet.tsx:145-160`](../../packages/cultivar-os/src/components/datasheet/DataSheet.tsx#L145-L160):

```ts
const q = search.trim().toLowerCase();
let out = rows;
if (statusFilter && status !== 'all') out = out.filter(r => statusFilter.get(r) === status);
if (q) out = out.filter(r => searchText(r).toLowerCase().includes(q));
```

`status` initialises to `'all'` ([`:104`](../../packages/cultivar-os/src/components/datasheet/DataSheet.tsx#L104)), so the quick-filter is inert until clicked. Everything therefore turns on
`searchText`, supplied by the roster at [`Customers.tsx:263`](../../packages/cultivar-os/src/pages/Customers.tsx#L263):

```ts
searchText={r => [r.first_name, r.last_name, r.phone, r.email,
                  r.address_line1, r.city, r.state, r.zip].filter(Boolean).join(' ')}
```

### 🔴 THE COLUMN RESPONSIBLE — AND IT IS AN ABSENCE, NOT A PREDICATE

**`searchText` omits `organization_name` and `display_name`. The Name column renders them.**
[`Customers.tsx:204-207`](../../packages/cultivar-os/src/pages/Customers.tsx#L204-L207):

```ts
const displayName = (r: CustomerRow) =>
  r.customer_type === 'organization'
    ? (r.organization_name?.trim() || r.first_name)
    : `${r.first_name} ${r.last_name}`.trim() || r.first_name;
```

So **the roster searches a different set of fields than it displays.** A row whose identity lives in
`organization_name` renders as its organization name in the Name column and is **unreachable by
typing that name into the box directly above it.**

The reasoning is airtight in one direction and I will state its limit in the other. Since the query
filters nothing and the quick-filter is inert, *the only way `"foster"` can match one row and not the
other* is that the second row's **eight searched fields contain no `foster` substring** — which means
her name is carried in `organization_name` and/or `display_name`, or her name columns are spelled
differently. **Which of those it is, is a data fact, and this machine cannot read the catalog.**

| Branch | What David sees | Settles it |
|---|---|---|
| Name lives in `organization_name` / `display_name` | Roster row reads "Diane Foster"; search misses it | `select id, first_name, last_name, organization_name, display_name, customer_type from customers where id in ('0ee368fe-5b2f-4458-a75d-d4498024a605','194a582c-…');` |
| Name columns spelled differently (`Foster ` / `Fostor` / trailing char) | Same symptom, different cause | same query |
| Something else entirely | The count pill (below) will disagree with 17 | same query |

### ✅ THE ROSTER IS THE ONE SURFACE IN THIS RECON THAT TELLS THE USER

[`DataSheet.tsx:296`](../../packages/cultivar-os/src/components/datasheet/DataSheet.tsx#L296):

```tsx
<span style={S.countPill}>{view.length} of {rows.length}{status !== 'all' || search ? ' shown' : ` ${itemNoun}`}</span>
```

Searching `foster` renders **`1 of 17 shown`**. Both numbers, side by side. **This is the honest
shape and it is worth naming as the counter-example**, because every finding in A2 and A4 is the same
class of question answered the opposite way.

🔴 **AND IT GIVES DAVID A ONE-GLANCE DISCRIMINATOR THAT COSTS NOTHING: clear the search box and read
the pill.** If it says **`17 customers`**, the second Diane is on the roster, she is not hidden, the
defect is the search field-set alone — and *"reachable only by direct URL"* is true of the search box,
not of the list. If it says fewer than 17, the query is dropping rows and everything above is
incomplete; that would be a new finding and I would want to know.

### The corroborating fact, from a second direction

There are **two customer searches over one table and they read different field sets.**
[`CustomerSearch.tsx:93-100`](../../packages/cultivar-os/src/components/customers/CustomerSearch.tsx#L93-L100) — the checkout search — **does** include both:

```ts
`first_name.ilike.${like}`, `last_name.ilike.${like}`,
`organization_name.ilike.${like}`, `display_name.ilike.${like}`,
`email.ilike.${like}`, `phone.ilike.${like}`,
```

So the same query typed at the register would find her and the same query typed on the roster does
not. That is drift between two implementations of one operation (§6 r8), and it is what tells you the
roster's omission is an oversight rather than a decision.

⚠️ **A second omission in the same line, smaller but the same shape:** `searchText` also omits
`billing_line1 / billing_city / billing_state / billing_zip` while the placeholder promises
*"Search name, phone, email, city…"* ([`:264`](../../packages/cultivar-os/src/pages/Customers.tsx#L264)). A customer whose address lives only in the
canonical billing columns cannot be found by city — and the canonical columns are the ones the party
editor writes.

---

## A2 — THE DELIVERY SCHEDULE

### The query

[`DeliverySchedule.tsx:119-128`](../../packages/cultivar-os/src/pages/DeliverySchedule.tsx#L119-L128):

```ts
const { data, error: err } = await supabase
  .from('deliveries')
  .select(`id, customer_id, delivery_date, address_line1, city, state, zip, status, service_type, notes,
           customers ( first_name, last_name, phone, email, address_line1, city, state, zip,
                       billing_line1, billing_city, billing_state, billing_zip )`)
  .eq('business_id', businessId!)
  .neq('status', 'cancelled')          // ← 🔴 line 126
  .order('delivery_date', { ascending: true, nullsFirst: false })
  .limit(200);
```

### The label and the rendered rows are computed from the SAME array

- Header count: [`:200`](../../packages/cultivar-os/src/pages/DeliverySchedule.tsx#L200) — `` `${rows.length} scheduled deliver${…}` ``
- Grouping: [`:180-192`](../../packages/cultivar-os/src/pages/DeliverySchedule.tsx#L180-L192) — a plain bucket by `delivery_date`, `groups.find(x => x.date === key)`. **No dedup, no `Set`, no key on customer or name.**
- Per-day count: [`:241`](../../packages/cultivar-os/src/pages/DeliverySchedule.tsx#L241) — `` `· ${group.items.length} stop${…}` ``
- Rendered cards: [`:263`](../../packages/cultivar-os/src/pages/DeliverySchedule.tsx#L263) — `group.items.map(d => …)`, keyed `d.id`

**So the label and the list are the same set.** They cannot disagree, and they don't. Everything is
decided at the query, one line above.

### 🔴 ONE EXPLANATION, AND IT FITS ALL THREE DAYS WITH NO RESIDUAL

`.neq('status','cancelled')` at `:126` is the only thing between 16 rows and 13.

| Day | Rows in table | Stops rendered | Excluded by `:126` |
|---|---|---|---|
| 06-25 — Marcus Webb ×3, three different `customer_id` | 3 | **1** | 2 |
| 06-27 — Diane ×2 (different ids) + Robert ×1 | 3 | **2** | 1 |
| 07-15 — Cedar Park HOA ×4, **all one `customer_id`** | 4 | **4** | 0 |
| — | **16** | **13** | **3** |

**16 − 3 = 13, and the three excluded rows sit exactly on the two days that shrank.** The arithmetic
closes with nothing left over.

**It also explains why the two disproved theories looked right for as long as they did.** A
name-collapse predicts 3 Marcus → 1 ✅ and Diane+Diane+Robert → 2 ✅ — *and then predicts Cedar Park's
four one-customer rows → 1, which is where it dies.* `status` has no relationship to the customer at
all, so four rows for one customer survive intact while three rows for three different customers
collapse to one. **Both observations are the same predicate, and the predicate is not about people.**

### What `status` can actually hold — sourced, and the branch stated where it cannot be

[`20260620_deliveries.sql:34`](../../supabase/migrations/20260620_deliveries.sql#L34) declares:

```sql
status        text         NOT NULL DEFAULT 'scheduled',  -- AC-4: NO CHECK
```

| If the live column matches the migration | Then |
|---|---|
| `NOT NULL` holds | `.neq` excludes **only** rows whose status is literally `'cancelled'` |
| `NOT NULL` does **not** hold (constraint dropped, or the column differs from the file) | 🔴 `.neq` **also silently excludes every NULL** — `NULL <> 'cancelled'` evaluates to `NULL`, not `TRUE`, so PostgREST drops the row. **A NULL-status row is invisible and nothing anywhere says why.** |

**Settle it with:** `select status, count(*) from deliveries where business_id = 'f7ec5d67-…' group by status order by 2 desc;`
Expect the three missing rows to name themselves.

### 🔴 THE FACT THAT MAKES THE `'cancelled'` BRANCH INTERESTING RATHER THAN ROUTINE

**Nothing in this application ever writes `deliveries.status` after insert.** Verified by reading
every one of the six sites that touch the table:

| Site | What it does to `status` |
|---|---|
| [`submit.ts:274`](../../packages/cultivar-os/api/orders/submit.ts#L274) — checkout insert | sets `'scheduled'` |
| [`customers/create.ts:111`](../../packages/cultivar-os/api/customers/create.ts#L111) — OCR insert | sets `'scheduled'` |
| [`DeliverySchedule.tsx:149-154`](../../packages/cultivar-os/src/pages/DeliverySchedule.tsx#L149-L154) — the only UPDATE | writes `delivery_date` **only** |
| `DeliverySchedule.tsx:120`, `DeliveryRoute.tsx:391`, `DeliveryRoute.tsx:427` | reads |

**There is no cancel button, no status control, no RPC.** So a `deliveries` row that is not
`'scheduled'` was put in that state **outside this application** — the SQL editor or the dashboard.
That is worth knowing before anyone concludes the filter is doing its job: it is filtering on a value
the product cannot produce, which is why the exclusion reads as arbitrary from the screen.

### ⚠️ AND SAID PLAINLY, BECAUSE IT IS THE ACTUAL DEFECT REGARDLESS OF WHICH BRANCH IS TRUE

**Whichever value is hiding those three rows, the screen does not mention them.** The header asserts
*"13 scheduled deliveries"* — a claim about the business, not about the filter — and the day header
asserts *"1 stop"* on a day the table holds three rows for. There is no *"3 cancelled hidden"*, no
count of what was filtered, nothing. This is the six-state ruling's own clause (*withheld data
ANNOUNCES its redaction*) and §6 r18 (*a section header is a claim*) arriving on a screen neither was
applied to. **The roster twelve files away does it correctly in one line.**

---

## A3 — ARE A1 AND A2 THE SAME MECHANISM?

🔴 **NO. Two different things, at two different layers, with opposite honesty.** They are not
variants of one bug and fixing either would not touch the other.

| | **A1 — customers** | **A2 — deliveries** |
|---|---|---|
| Layer | **CLIENT**, after the fetch | **SERVER**, in the PostgREST query |
| Mechanism | a substring test over a field list that omits two rendered columns | a `.neq` predicate on a status column |
| Does the query drop rows? | **No** — every row is fetched | **Yes** — the row never arrives |
| Is the row recoverable in-page? | **Yes** — clear the search | **No** — reload the page and it is still gone |
| Does the user get told? | ✅ **Yes** — `"1 of 17 shown"` | 🔴 **No** — `"13 scheduled deliveries"` |
| What a fix would touch | `Customers.tsx:263` | `DeliverySchedule.tsx:126` + copy |

The one thing they share is a *category*, not a mechanism: both are **a projection narrower than the
thing it describes**. In A1 the projection is the searched field set; in A2 it is the row set. That
shared category is what makes them feel like one bug and it is not enough to treat them as one.

---

## A4 — EVERY OTHER LIST OF THE SAME SHAPE

Swept `packages/cultivar-os/src` and `packages/shared/src` for `.limit(`, `.neq(`, `.not(`, `.in(`,
`.is(` and status predicates on list reads. **`⚠️` = the user is not told.**

| # | Site | What it hides | Told? |
|---|---|---|---|
| 1 | [`DeliverySchedule.tsx:126`](../../packages/cultivar-os/src/pages/DeliverySchedule.tsx#L126) | `status = 'cancelled'` (+ NULL, on the branch above) | 🔴 **No** — header claims a total |
| 2 | [`DeliveryRoute.tsx:398`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L398) — scheduled mode (`?date=`) | same predicate, plus **`.limit(50)`** | 🔴 **No** |
| 3 | [`DeliveryRoute.tsx:437`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L437) — default mode (`/deliveries`) | `.neq('status','cancelled')` on **`orders`** + **`.limit(30)`** | 🔴 **No** |
| 4 | 🔴 [`DeliveryRoute.tsx:436`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L436) — same query | **`.eq('transport_method','delivery')` — every `install` order is absent from the route list**, though `submit.ts:221` maps `install → 'planting'`, i.e. the truck goes out for it | 🔴 **No** |
| 5 | [`Orders.tsx:60`](../../packages/cultivar-os/src/pages/Orders.tsx#L60) | **`.limit(50)`**; header reads `"{orders.length} recent checkouts"` ([`:92`](../../packages/cultivar-os/src/pages/Orders.tsx#L92)) | ⚠️ **Half** — *"recent"* hints at a cut, but at 50+ orders the screen says *"50 recent checkouts"* and never that the cap was reached |
| 6 | [`Dashboard.tsx:188`](../../packages/cultivar-os/src/pages/Dashboard.tsx#L188) | `.neq('status','cancelled')` on **`orders`** — feeds **today's revenue** | 🔴 **No** |
| 7 | [`Dashboard.tsx:250`](../../packages/cultivar-os/src/pages/Dashboard.tsx#L250) | `.not('status','eq','copied')` on **`social_drafts`** | 🔴 **No** |
| 8 | [`InventoryReconcile.tsx:125`](../../packages/cultivar-os/src/pages/InventoryReconcile.tsx#L125) | `.neq('status','archived')` on `business_inventory` | 🔴 **No** — and the reason **is** written, in a code comment at [`:118-120`](../../packages/cultivar-os/src/pages/InventoryReconcile.tsx#L118-L120), where the owner cannot read it |
| 9 | [`PMI.tsx:182`](../../packages/shared/src/modules/PMI.tsx#L182) | `.neq('status','RETIRED')` on `cost_objects` | 🔴 **No** |
| 10 | [`InventoryImport.tsx:148`](../../packages/cultivar-os/src/pages/InventoryImport.tsx#L148) | `.neq('status','deleted')` — **not a displayed list**, it is the catalog the importer dedups against | ⚠️ **N/A as a list — a different consequence:** a `deleted` lot is invisible to the dedup, so the import can mint a second row for something that already exists |
| 11 | [`ScanOrder.tsx:187`](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L187) | **`.limit(10)`** on the checkout attach search | 🔴 **No** |
| 12 | [`CustomerSearch.tsx:108`](../../packages/cultivar-os/src/components/customers/CustomerSearch.tsx#L108) | **`.limit(25)`** on the checkout customer search | 🔴 **No** |

### ✅ AND THE ONES THAT ARE CLEAN, because a sweep that only names failures is not a measurement

- **[`Customers.tsx:128`](../../packages/cultivar-os/src/pages/Customers.tsx#L128)** — no limit, no status filter, and the count pill states both numbers.
- **[`BusinessInventory.tsx:161-164`](../../packages/cultivar-os/src/pages/BusinessInventory.tsx#L161-L164)** — no limit, **no status filter at all**: `/inventory` shows `deleted` and `archived` lots. ⚠️ Which means `/inventory` and `/inventory-reconcile` legitimately hold different totals, and **only the inventory screen's count pill explains itself.**
- **`PMI`'s cost redaction** — `"equipment list hidden — cost-basis access required"` is a withheld list that names why. **The pattern already exists in this codebase; it is applied to the permission axis and to no other.**

### 🔴 THE SHAPE UNDER THE TABLE, WHICH IS WORTH MORE THAN ANY SINGLE ROW

**Eleven of twelve narrowing reads say nothing, and the platform already owns the control that would
fix all of them.** `DataSheet` renders `"{view.length} of {rows.length} shown"` in **one line**, and
every surface built on it inherits an honest count for free. **Every silent row in the table above is
a hand-rolled list that is not a `DataSheet`.** The divergence is not a series of oversights about
copy — it is what happens when a shared control carries a standard and half the surfaces are not
built on the shared control.

⚠️ **Two rows carry a shape this repo cannot settle: rows 3, 6 (`orders`) and row 7 (`social_drafts`)
have NO `CREATE TABLE` in version control** — tech-debt #39 and #27. So whether `.neq` on those
tables also drops NULL-status rows **cannot be answered from the repo at all**, only from the catalog.
That is #39 producing a concrete unanswerable question, on the query that computes today's revenue.

---

# PART B · AN ADDRESS COMPOSED FROM TWO DIFFERENT ADDRESSES

## B1 — WHERE THE STRING IS COMPOSED

🔴 **It is not composed in `CartReview`. It is composed one screen earlier, in `ScanOrder`, and it is
four adjacent lines.**

[`ScanOrder.tsx:87-102`](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L87-L102) — `customerToInput`, which converts a chosen customer row into
the cart's `CustomerInput`:

```ts
function customerToInput(r: CustomerHit): CustomerInput {
  return {
    …
    address_line1: r.billing_line1 ?? r.address_line1 ?? undefined,   // ← 93 · BILLING preferred
    city:          r.city ?? undefined,                              // ← 94 · LEGACY only
    state:         r.state ?? undefined,                             // ← 95 · LEGACY only
    zip:           r.zip ?? undefined,                               // ← 96 · LEGACY only
    …
```

`CartReview` then renders whatever it was handed, making no field choice of its own —
[`CartReview.tsx:577-580`](../../packages/cultivar-os/src/pages/CartReview.tsx#L577-L580):

```tsx
{customer.address_line1 && (
  <p …>{customer.address_line1}{customer.city ? `, ${customer.city}` : ''}
       {customer.state ? ` ${customer.state}` : ''}{customer.zip ? ` ${customer.zip}` : ''}</p>
)}
```

### ✅ CONFIRMING DAVID'S READING, FIELD BY FIELD

| Displayed part | Line | Column read | Diane `0ee368fe` |
|---|---|---|---|
| `100 Main St` | `:93` | **`billing_line1`** | 100 Main St |
| `, Georgetown` | `:94` | **`city`** (legacy) | Georgetown |
| ` TX` | `:95` | **`state`** (legacy) | TX |
| ` 78628` | `:96` | **`zip`** (legacy) | 78628 |

**`"100 Main St, Georgetown TX 78628"`.** Street from billing, city/state/zip from the primary
address, an address that exists in neither record and that nobody typed. **The reading is correct and
the correction is only to its location: `ScanOrder.tsx:93-96`, not the review screen.**

### 🔴 AND IT IS NOT A NEAR-MISS — THE DATA WAS ALREADY IN HAND AND THREE FIELDS IGNORED IT

- `CustomerHit` **declares** all four canonical columns — [`ScanOrder.tsx:62`](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L62).
- The select **fetches** all four — [`ScanOrder.tsx:191`](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L191).
- The comment immediately above that select **states the rule for all four** — [`:190`](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L190):
  *"D-41: canonical billing_* first, legacy as fallback (see the invoice's billAddrFrom)."*

`billing_city`, `billing_state` and `billing_zip` are typed, selected, carried across the wire, and
then **read by nothing**. This is the shape of one line being repointed and its three siblings being
missed — and the file's own comment asserts the rule the file then breaks in three of four places.

## B2 — EVERY PLACE A CUSTOMER ADDRESS IS COMPOSED

`orders` carries no address columns, so every address is composed at read or write time. All eight
sites, with the field set each reads:

| # | Site | Reads | Verdict |
|---|---|---|---|
| 1 | 🔴 **checkout review** — [`ScanOrder.tsx:93-96`](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L93-L96) composes, [`CartReview.tsx:577-580`](../../packages/cultivar-os/src/pages/CartReview.tsx#L577-L580) renders | **MIX** — line1 billing-first; city/state/zip legacy-only | **the defect** |
| 2 | **order confirmation** — [`CustomerCapture.tsx:92-95`](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L92-L95) → [`:230-233`](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L230-L233) | **INHERITS #1** — seeds its form from the `CustomerInput` already in cart state and writes the same four fields back out | 🔴 **carries the mix forward, and now it is inside editable boxes** |
| 3 | **QuickBooks invoice payload** — [`qbo/invoice/cultivar.ts:102-106`](../../packages/cultivar-os/api/qbo/invoice/cultivar.ts#L102-L106) | billing `??` legacy, **all four** | ✅ consistent |
| 4 | **the `deliveries` row written by `df988cc`** — [`submit.ts:271-274`](../../packages/cultivar-os/api/orders/submit.ts#L271-L274) | `pick(billing, legacy)`, **all four** | ✅ consistent — see B3 |
| 5 | **the `deliveries` row written by the OCR door** — [`customers/create.ts:107-110`](../../packages/cultivar-os/api/customers/create.ts#L107-L110) | **neither** — the invoice's own extracted ship-to (`delivery.address`) | ✅ and it is the *declared* model (B4) |
| 6 | **route map + `/deliveries`** — [`DeliveryRoute.tsx:39-40`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L39-L40) | billing `??` legacy, **all four** | ✅ consistent |
| 7 | **order detail** — [`OrderDetail.tsx:314-316`](../../packages/cultivar-os/src/pages/OrderDetail.tsx#L314-L316) | billing `??` legacy, **all four** | ✅ consistent |
| 8 | **delivery schedule cards** — [`DeliverySchedule.tsx:69-71`](../../packages/cultivar-os/src/pages/DeliverySchedule.tsx#L69-L71) | the **delivery row's own** columns, not the customer's | ✅ correct by design |

### The customer profile page — its header vs its edit form

| | Reads / writes | On Diane `0ee368fe` |
|---|---|---|
| **Header** — [`CustomerDetail.tsx:148`](../../packages/cultivar-os/src/pages/CustomerDetail.tsx#L148) | `[email, phone, customer.city]` — **legacy `city` only, and no street at all** | shows **Georgetown** |
| **Edit form** — [`CustomerPartyEditor.tsx:250-267`](../../packages/cultivar-os/src/components/customers/CustomerPartyEditor.tsx#L250-L267) | edits **`billing_*` only** | shows **100 Main St / Leander / TX / 78641** |

**So the profile header and the profile's own edit form show different cities for the same customer,
on the same screen, one click apart.** The header is the only surface in the platform that reads a
legacy address column with **no canonical fallback whatsoever.**

### 🔴 THE FINDING THAT CAME OUT OF THE SWEEP AND NOT OUT OF THE QUESTION

**Every write path in this application keeps `billing_*` and the legacy four IN SYNC.** Both of them,
always together, in both create and edit:

- [`customerEdit.ts:170-172`](../../packages/cultivar-os/src/components/customers/customerEdit.ts#L170-L172) — *"a canonical billing field carries its legacy twin with it"*, and
  [`:163`](../../packages/cultivar-os/src/components/customers/customerEdit.ts#L163) refuses to let the legacy column be edited on its own (*"legacy mirrors are derived, never edited"*).
- [`customerUpsert.ts` (HEAD) `:120-135`](../../packages/shared/src/business-logic/customerUpsert.ts#L120-L135) — rule **(c) CANONICAL + MIRROR**, `offer()` writes the twin
  on every address field, *"so the two column sets cannot diverge at the source."*

**Which means Diane's row — where the two sets hold two different towns — could not have been
produced by any door in this product.** It came from a direct database edit or from data seeded
before the mirror existed. That matters for how this is read: **`ScanOrder.tsx:93-96` is a latent
defect that only fires on rows the application is not supposed to be able to create** — so it will
show up on migrated data, on hand-seeded test tenants, and on anything touched in the SQL editor,
and it will look like nothing at all on a row created through the UI. That is precisely the kind of
bug that survives a demo and appears at a customer.

## B3 — 🔴 WHAT ADDRESS LANDS ON THE `deliveries` ROW

**It takes ONE field set cleanly — and the answer is still not "display-only".**

[`submit.ts:258-275`](../../packages/cultivar-os/api/orders/submit.ts#L258-L275), the row written by `df988cc`:

```ts
const c = args.customerRow ?? {};
const pick = (canonical: unknown, legacy: unknown): string | null => {
  for (const v of [canonical, legacy]) if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
};
const row = {
  …
  address_line1: pick(c.billing_line1, c.address_line1),
  city:          pick(c.billing_city,  c.city),
  state:         pick(c.billing_state, c.state),
  zip:           pick(c.billing_zip,   c.zip),
```

Two facts make this clean and both are load-bearing:

1. **The rule is applied to all four fields, not one.** Unlike `ScanOrder.tsx:93-96`.
2. **`args.customerRow` is not the client's composite — it is a fresh database read.**
   [`submit.ts:442-443`](../../packages/cultivar-os/api/orders/submit.ts#L442-L443) does `db.from('customers').select('*').eq('id', customerId).maybeSingle()` with the
   service key, and that row is handed to the scheduler at [`:1138`](../../packages/cultivar-os/api/orders/submit.ts#L1138). **The mixed string the cashier
   read on Review never reaches the write.**

**For Diane Foster `0ee368fe`, all four billing fields are populated, so every `pick` takes the
canonical value and the stop is written as `100 Main St, Leander, TX 78641` — a clean billing
address.**

### 🔴 AND THAT IS THE PROBLEM, NOT THE RELIEF

| Surface | Shows | Source |
|---|---|---|
| Checkout **Review** — what the cashier reads back to the customer | `100 Main St, **Georgetown** TX **78628**` | `ScanOrder.tsx:93-96` |
| The `deliveries` row — where the truck is sent | `100 Main St, **Leander** TX **78641**` | `submit.ts:271-274` |

**Two towns roughly fifteen miles apart, from one click, and neither screen says the other exists.**
The order is confirmed against one address and the stop is created at another. **A stop at a street
from one town and the city of another** — the failure David named — is the *composite* case; this is
the *divergence* case, and it is worse in one specific way: **the composite is visibly wrong to
anyone who knows the customer, and the divergence is invisible to everyone**, because each screen is
internally plausible and nobody sees both at once.

### ⚠️ THE `deliveries` ROW CAN STILL BE A COMPOSITE — by a different rule

`pick()` is **per-field**, so a customer with `billing_line1` set and `billing_city` blank gets
**billing street + legacy city** on the stop. That is a real composite landing on a real truck
route. It requires *partially* populated canonical columns rather than *fully divergent* ones, and it
is the same D-41 half-migration hazard from the other side.

### ✅ TWO THINGS THAT ARE **NOT** WRONG, checked rather than assumed

- **The composite is never written back to `customers`.** On the attach path
  [`submit.ts:409-416`](../../packages/cultivar-os/api/orders/submit.ts#L409-L416) resolves the id and **does not upsert** — the posted customer object is not
  used. And even if it were, `customerUpsert`'s rule **(b) FILL, NEVER CLOBBER** lands a supplied
  value only where the stored one is blank, so a populated `billing_city` cannot be overwritten.
  **No data-corruption path exists.** ⚠️ One edge worth naming: if the attached id fails the AC-3
  same-business check, [`:418`](../../packages/cultivar-os/api/orders/submit.ts#L418) falls through to `findOrCreateCustomer(…, customer, …)` with the composite
  object — still guarded by (b), still worth knowing.
- **A checkout-sourced stop does reach the route map.** [`DeliveryRoute.tsx:391-400`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L391-L400) filters on
  `business_id`, `delivery_date` and `status` only — **no `source` filter** — so `source:'checkout'`
  rows plot. This answers the open question flagged in `#216`'s handoff item (h). ⚠️ Subject to A4
  rows 2 and 4: the `?date=` mode caps at 50, and the **separate** `/deliveries` default mode reads
  `orders` and excludes `install` entirely.

## B4 — IS THERE DECLARED INTENT?

**Yes — explicit, twice, and the current behaviour is a documented substitute for it rather than an
accident.**

[`docs/decisions/2026-07-13-customer-party-record.md:35-41`](2026-07-13-customer-party-record.md#L35-L41), decision 1, quoted rather than paraphrased:

> **ADDRESS = L1 (billing columns, not a table).** A customer has ONE billing address → stable
> COLUMNS. **Shipping is NOT a customer attribute** — a customer does not "have a shipping address";
> an ORDER does. **Ship-to is entered per-order and snapshotted onto the `deliveries` row** (which
> already carries its own address_line1/city/state/zip — 20260620). NO `shipping_*` columns on
> customers. The saved multi-site ship-to address book … is the **L2 hook — deferred, not built**.

Restated as current-state in [`2026-08-24-customer-overlay-display-only-recon.md:338`](2026-08-24-customer-overlay-display-only-recon.md#L338):
*"No `shipping_*` on the customer, by design — ship-to is an ORDER fact snapshotted onto `deliveries`."*

### Measured against what is built

| Door | Ship-to source | Matches the decision? |
|---|---|---|
| **OCR invoice** — [`customers/create.ts:107-110`](../../packages/cultivar-os/api/customers/create.ts#L107-L110) | the address extracted from **that invoice** | ✅ **yes** — a per-order ship-to, snapshotted |
| **Checkout** — [`submit.ts:271-274`](../../packages/cultivar-os/api/orders/submit.ts#L271-L274) | the **customer's billing address** | ⚠️ **a substitute** — checkout has no ship-to field to enter |

So the choice is **not incidental**: the model is written down, the OCR door implements it, and the
checkout door copies billing **because there is nowhere to type a ship-to.** The gap is already named
on the board — [`user_stories.md:228`](../../user_stories.md#L228), the `STATUS: gap` story written with `#216`, lists as its
second owed item *"whether the ship-to should ever differ from the customer's billing address at
checkout — today it cannot."*

⚠️ **What is NOT declared anywhere, and is the reason B1 exists:** nothing states which of the two
address column sets a *display* surface should read. The rule exists only as a repeated comment
(`ScanOrder.tsx:190`, `DeliveryRoute.tsx:33-38`, `submit.ts:258-261`) and as a claim in a recon
(`2026-08-24…:335` — *"The read order is canonical-first, legacy-fallback"*, citing `DeliveryRoute`).
**That claim is true of six sites and false of two** (`ScanOrder.tsx:94-96`, `CustomerDetail.tsx:148`).
A rule carried in comments is a rule that half the sites will implement — which is the shape §6 r8
and STD-011 both describe, and no cap reads a comment.

---

# WHAT WAS NOT DONE, AND WHY

- **Nothing was fixed.** No dedup, no filter change, no copy change, no field-set change.
- **The OCR customer-creation path was not touched.** It was **read** (`customers/create.ts:100-135`)
  because B2 asks where every address is composed and that door composes one; nothing was modified.
- **No options proposed** — David's instruction, deviating from §9 gate 10, stated at the top.
- **No owner-test card marked `covered`.**
- **Nothing estimated that was not opened.** Every `file:line` in this document was read.
- 🔴 **Deciding what a duplicate customer IS remains David's ruling and is not touched here.** The
  duplicate rows are treated only as the input that made the mechanisms visible.

# TECH-DEBT FILED

- **#113** — `Customers.tsx:263` searches a narrower field set than the roster displays.
- **#114** — eleven of twelve narrowing list reads announce nothing; `DataSheet`'s count pill is the
  pattern the platform already owns.
- **#115** — `ScanOrder.tsx:93-96` composes an address from two column sets; `CustomerDetail.tsx:148`
  reads legacy with no canonical fallback.

> ⚠️ **NUMBERED 113-115 AFTER A COLLISION, RECORDED BECAUSE IT IS A FACT ABOUT THIS TREE, NOT ABOUT
> THESE ROWS.** They were drafted as #110-#112 against a log whose highest id was #109 at session
> open. **A concurrent session filed its own #110-#112 into the working copy while this recon was
> being written** (its rows cite ledger **#217**, one past the `#216` at `HEAD`). Renumbered and
> placed after that block so the log stays strictly ordered and **not one character of the other
> session's work was altered.** Same call as CLAUDE.md §6 r18 and §9 step 12: ids are APPENDED,
> because other documents cite them by number.
