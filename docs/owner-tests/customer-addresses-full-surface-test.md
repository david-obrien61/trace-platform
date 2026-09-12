# OWNER TEST — THE SHIP-TO ADDRESS BOOK (`customer_addresses`)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** 3.7 (customers) · 2.1 (checkout) · 3.5 (delivery)
**Ruling:** **D-41** (2026-07-16) — *"ADDRESS = L1 … the saved ship-to address book (`customer_addresses`) is the L2 HOOK — documented as a deferred follow-up, NOT built."* This build takes it up.
**Story:** ⚠️ **NO MATCH — and a story is OWED to David.** See the note at the foot of this board.
**Surfaces:** the order-time picker on the checkout customer step · the *"Save this as a site"* offer on the `<StopCard>` · the migration.

> ✏️ **CORRECTED 2026-09-12 — THIS BOARD SAID THE OFFER RENDERED ON *"all three screens"* AND THAT WAS
> FALSE WHEN IT SHIPPED.** CARD 4 was run live on 2026-09-12 (build `fe24e68`, Test Dave's, OWNER) and
> **FAILED**: the address saved and the green panel never appeared. Measured cause — the offer was held
> in `<StopCard>`'s own `useState`, and `saveShipTo` awaits `onChanged()`, which on the **schedule**
> (`DeliverySchedule.tsx:176`) and the **route** (`DeliveryRoute.tsx:622`) sets `loading = true` and
> renders the card list behind `{!loading && …}`. The card was **UNMOUNTED mid-save**, its state went
> with it, and the setter that ran when the promise resolved was called on a dead instance — which
> React discards silently. It worked on **`/orders/:id` only**, whose refresh never touches `loading`.
> **Fixed** by moving the offer to `useStopActions`, which the PAGE owns and the refresh does not
> destroy; it now renders on all three for the first time. 🔴 **Re-prove CARD 4 on the SCHEDULE, not
> on the order screen** — the order screen is the one that was never broken.
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 12 covered** (10 `owed` · 2 `needs-test`).

> 🔴 **NOTHING ON THIS BOARD EXCEPT CARD 2 CAN RUN UNTIL THE MIGRATION IS APPLIED.**
> `customer_addresses` does not exist yet. Until it does the picker renders nothing and the save
> offer never appears — which is the correct degraded state, not a bug, and CARD 2 is how you
> confirm it.

> 🔴 **WHO CAN RUN WHAT, AND ON WHICH TENANT.**
> **David can run these now, Supabase SQL editor, no phone:** CARD 1 (applies) · CARDS 3, 10, 11.
> **David's own login, Test Dave's — these WRITE:** CARDS 2, 4, 5, 6, 7, 8.
> 🔴 **Never on LAWNS**: a checkout there pushes a real invoice, and a ship-to edit there moves a real customer's truck.
> **David's own login, LAWNS, LOOKING ONLY:** CARD 9.
> **Needs a login David does not hold:** CARD 8b (a STAFF member) — `needs-test`, with its reason.
>
> **🔴 ORDER: CARD 1 → CARD 3 → the screens.** (CARD 2 is `needs-test` — its window cannot open on a single database.)

---

### CARD 1 — apply the migration, in the SQL editor
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #303

**Supabase SQL editor — NOT the table editor** (§6 r17: a table made in the table editor is owned
by `supabase_admin`, whose default ACL hands `anon` TRUNCATE, and TRUNCATE is outside RLS entirely).

Open `supabase/migrations/20260911b_customer_addresses.sql`, paste everything from `BEGIN;` to
`COMMIT;` — the V-block below it is commented out, leave it — and run.

**PASS:** it completes with no error. It is idempotent; a second run is a no-op, not an error.
**FAIL:** any error. It is one transaction, so nothing was written — report the message and stop.

---

### CARD 2 — 🔴 BEFORE APPLYING: nothing is broken and nothing is promised
STATUS: needs-test
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #303

🔴 **CLOSED BY DAVID, 2026-09-11 — THE WINDOW THIS CARD TESTS CAN NEVER OPEN.** His words: *"single
database, no unmigrated tenant exists, so the pre-apply window can never open."* There is ONE
Supabase project (`bgobkjcopcxusjsetfob`); applying the migration applies it for every tenant at
once. So the state this card describes — the app running against a database where
`customer_addresses` does not exist — has no moment in which to be observed once CARD 1 is run, and
before CARD 1 it is the only state there is.

⚠️ **`needs-test` rather than deleted, and rather than `covered`.** The degraded path it describes
is REAL and still shipped — `ShipToPicker` returns null when the read fails or the book is empty,
so an absent table renders nothing rather than an error. That behaviour is asserted in
`shipToSurfaces.test.ts` §B (B4/B5) and by mutant R3. **What is unprovable is the LIVE observation,
not the behaviour** — and recording that honestly is the point (OP-14 clause 2: an unrecorded hole
is a lie by omission). Thunder does not mark it `covered`; nobody ran it.

**What it WOULD have checked, kept for the record:** on Test Dave's, a delivery order for an
existing customer taken as far as the customer step shows the address form exactly as it always
was — **no saved-sites block, no error, and no empty "Saved delivery sites" heading over nothing**
(§6 r18: a header promising saved sites above an empty row is a claim that is not true).

---

### CARD 3 — the shape, the policies and the indexes are what was written
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #303

**Supabase SQL editor.** Paste and run — **one statement**, it writes nothing. (The editor shows
only the LAST result set and opens a fresh connection per run, so this is a single CTE returning
text rows rather than four separate queries.)

```sql
WITH rls AS (
  SELECT 0 AS ord, '' AS sub, 'RLS     enabled = ' || c.relrowsecurity::text AS line
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'customer_addresses'
), cols AS (
  SELECT 1, column_name,
         'COLUMN  ' || rpad(column_name, 14) || data_type ||
         CASE WHEN is_nullable = 'NO' THEN '  NOT NULL' ELSE '' END
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'customer_addresses'
), pol AS (
  SELECT 2, policyname,
         'POLICY  ' || rpad(policyname, 34) || '[' || cmd || ']  ' || coalesce(qual, with_check, '(none)')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_addresses'
), idx AS (
  SELECT 3, indexname, 'INDEX   ' || indexdef
    FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'customer_addresses'
), rows_now AS (
  SELECT 4, '', 'ROWS    ' || count(*)::text || '   (must be 0 — nothing backfills this book)'
    FROM public.customer_addresses
), leak AS (
  SELECT 5, column_name, 'LEAK    ' || table_name || '.' || column_name || '   🔴 THIS MUST NOT EXIST'
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND (column_name LIKE 'shipping%' OR (table_name = 'deliveries' AND column_name = 'address_line2'))
)
SELECT line FROM (
  SELECT * FROM rls UNION ALL SELECT * FROM cols UNION ALL SELECT * FROM pol
  UNION ALL SELECT * FROM idx UNION ALL SELECT * FROM rows_now UNION ALL SELECT * FROM leak
) x(ord, sub, line) ORDER BY ord, sub;
```

**PASS — all six at once:**
1. `RLS enabled = true`.
2. **14 COLUMN rows**, including `line2`, `is_default` and `active`.
3. **Exactly THREE POLICY rows** — `_member_select [SELECT]`, `_member_insert [INSERT]`,
   `_member_update [UPDATE]` — each naming `is_active_member` **and** a `customers:` string.
   🔴 **No policy mentions `owner_id`** (`20260910b` took the raw-owner policies 49 → 12 three days
   ago; this must not be the 50th), and **there is no DELETE policy** — retiring is an UPDATE.
4. **Three INDEX rows beyond the primary key, and TWO of them say `UNIQUE`** —
   `customer_addresses_one_default` and `customer_addresses_one_label`.
5. `ROWS 0`.
6. 🔴 **NO `LEAK` row at all.** One would mean a `shipping_*` column exists somewhere — D-41's
   redline — or that `deliveries` grew an `address_line2` this build deliberately did not add.

**FAIL:** any of the six. A fourth policy, a missing `UNIQUE`, a non-zero row count, or any LEAK row.

---

### CARD 4 — 🔴 a site is saved as a by-product of moving a stop
STATUS: owed
LAST-PROVEN: never — ❌ **RUN AND FAILED 2026-09-12 on `fe24e68`** (see below)
DEVICE: phone
COVERS: ledger #303

> ❌ **THIS CARD FAILED ITS FIRST LIVE RUN, AND THE RECORD OF THAT STAYS HERE.** 2026-09-12, Test
> Dave's, OWNER, stop `06dfb114`, three saves: the address saved every time and **step 2 never
> happened.** The panel could not appear on this screen — see the correction at the top of this
> board. Fixed on branch `fix/stop-site-offer-unmount`; the card is `owed` again, not `covered`,
> because a fix Thunder wrote is a claim until David drives it (OP-14).
>
> 🔴 **RUN IT ON THE SCHEDULE.** `/orders/:id` passed on the broken build and would pass on a
> reverted one, so proving it there proves nothing about the defect.

**Test Dave's, your own login. This WRITES.** Open the **delivery schedule** (`/delivery-schedule`,
NOT the order screen), find a stop that has a customer, tap **Change address**, change the street,
and **Save address**.

**PASS:**
1. The address saves as it always did — this is #301's behaviour, unchanged.
2. **Then** a green panel appears: *"Save this address as a delivery site for &lt;customer&gt;?"*
   with an **empty** name box.
3. It is a question, not a pre-ticked box: **nothing has been saved yet.**
4. Type **`Job site A`** and press **Save as a site**.
5. It reports *"Saved as "Job site A". It will be offered next time you take an order for
   &lt;customer&gt;."*

**FAIL:** the panel appears **before** the address saved · a name is pre-filled · the panel appears
on a stop with no customer · pressing **Not this one** still saves (check with CARD 10) · 🔴 **the
panel never appears at all — the 2026-09-12 failure; if you see this again the fix did not take, and
check the build stamp against `git log --oneline origin/main -1` before anything else (GATE 0).**

⚠️ **THEN REPEAT IT ON `/deliveries?date=…` (the route).** Same gesture, same expected panel. That
screen carried the identical defect and is the second half of what was fixed — a pass on the
schedule alone does not cover it.

**SIGNAL:** `[TRACE:SITES] saved { id, label: 'Job site A', isDefault: true }`

---

### CARD 5 — a site with no name is refused, in words
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #303

**Test Dave's.** Repeat CARD 4 on a different stop, then press **Save as a site** with the name box
**empty**.

**PASS:** it refuses in a sentence — *"Give this place a name so it can be picked later…"* — and
saves nothing. 🔴 **This is the rule that keeps the book from filling with one-off drops:** a
delivery to a customer's mother is not a site, and saving requires a name a person chose.
**FAIL:** anything is saved, or a Postgres error string reaches the screen.

---

### CARD 6 — 🔴 THE SAME PLACE TWICE IS NOT TWO SITES
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #303

**Test Dave's.** On another stop for **the same customer as CARD 4**, set the address to CARD 4's
address **typed in lower case** (`501 county road 107` / `georgetown`), save it, and answer the
offer with a **different** name — `The yard`.

**PASS:** no second row is written. It says *"This address is already saved for &lt;customer&gt; as
"Job site A"."*
🔴 **This is the whole argument for the table.** AGAVE LD LLC carries four spellings of one yard
across eighteen invoices; the book must not reproduce the drift it exists to stop.
**FAIL:** a second site appears (confirm with CARD 10), or it refuses with a red error rather than
naming the site they already have.

---

### CARD 7 — 🔴 THE PICKER OFFERS THE SITE, AND A NEW ADDRESS IS STILL TYPEABLE
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #303

**Test Dave's. This WRITES an order.** Start a **delivery** order and, at the customer step,
**search for and select the customer from CARD 4**. (Do not type a new customer — a new one has no
book, correctly.)

**PASS:**
1. Above the address fields: a green block, **"Saved delivery sites for this customer"**, with
   **Job site A · default** and its address.
2. Tapping it **fills the four address fields below**, so you can see where the truck is being sent
   rather than trusting a chip.
3. The sentence under it reads *"Delivering to Job site A. Edit the address below to send this
   order somewhere else."*
4. 🔴 **Type over the street.** The sentence changes to *"The address below is not one of the saved
   sites — this order will go where the fields say."* **Free entry still works: the book is a
   convenience, never a gate.**

**FAIL:** no block for a customer who has a site · tapping fills nothing · the fields become
read-only · the block appears on a **self-collect** order.

**SIGNAL:** `[TRACE:SITES] picker loaded { ok: true, sites: 1 }` then `site chosen at checkout`

---

### CARD 8 — 🔴 THE ORDER GOES WHERE THE SCREEN SAID, NOT WHERE THE CUSTOMER RECORD SAYS
STATUS: owed
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #303

🔴 **This is the card that proves the picker means something, and it closes a live defect nobody
had named.** Before this build, a delivery address typed at checkout for a customer who **already
had one on file** never reached the stop: `customerUpsert` is fill-never-clobber, so the customer
row kept the old address, and the stop was then addressed **from that row**. The typed address was
silently discarded and the truck went to the billing address.

**Test Dave's.** First make sure the CARD 4 customer's **billing address differs** from Job site A
(set it on the customer record if not). Then complete the CARD 7 order with **Job site A** chosen.

**PASS:** open the new stop on the delivery schedule. Its address is **Job site A's**, not the
customer's billing address.
**FAIL:** the stop shows the billing address. The picker is then decoration and the build has not
landed.

**SIGNAL:** `[TRACE:DELIVERY] checkout — scheduling a stop { addressFrom: "the order's own ship-to" }`

---

### CARD 8b — a STAFF member can pick a site and cannot save one
STATUS: needs-test
LAST-PROVEN: never
DEVICE: phone
COVERS: ledger #303

⚠️ **`needs-test`, with its reason: this needs a login David does not hold.**

The asymmetry is real and deliberate. A STAFF member holds `customers:read` and
`deliveries:update` but **not** `customers:create` — so Joel can see the saved sites, fill an
address from one, and move a stop, and he cannot add to the customer's book.

It is asserted in `shipToSurfaces.test.ts` §C against the **real default bundles**, both ways — the
manager admitted, the staff member refused. 🔴 **That is a proof about the code, not about a live
session**, and this card is the gap that would close it. The prompt's own acceptance says why it
matters: *a gate that has only ever admitted is not a proven gate.*

**Would PASS:** as STAFF — the checkout picker shows the saved sites and fills the fields; editing a
stop's address works; **no "Save this address as a delivery site" panel ever appears.**

---

### CARD 9 — LAWNS is untouched
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #303

**LAWNS, your own login, LOOKING ONLY — tap nothing, save nothing.** Open the delivery schedule,
and take a checkout as far as the customer step without submitting.

**PASS:** every LAWNS screen behaves exactly as before, and **no saved-sites block appears
anywhere** — the book is empty on every tenant because nothing backfills it (CARD 3 §5).
**FAIL:** any saved site is offered on LAWNS. That would mean something seeded the book from
history — the one thing this build refuses to do. The importer does not read `BillAddr.Line2`
(tech-debt #254), so 451 routable addresses currently sit in the record as phone numbers, and
seeding from those strings would promote four typos to four curated sites and make the drift
permanent instead of fixing it.

---

### CARD 10 — the book holds what you think it holds
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #303

**Supabase SQL editor.** Paste and run — one statement, writes nothing:

```sql
SELECT b.name AS business,
       coalesce(c.display_name, c.organization_name, concat_ws(' ', c.first_name, c.last_name)) AS customer,
       a.label, a.is_default, a.active,
       concat_ws(', ', a.line1, a.city, a.state, a.zip) AS address,
       a.line2 AS line2_must_be_null,
       a.created_at
  FROM customer_addresses a
  JOIN businesses b ON b.id = a.business_id
  JOIN customers  c ON c.id = a.customer_id
 ORDER BY b.name, customer, a.is_default DESC, a.label;
```

**PASS after CARDS 4–6:** exactly **ONE** Test Dave's row — `Job site A`, `is_default = true`,
`active = true`, `line2_must_be_null` empty. **No LAWNS rows at all.**
**FAIL:** two rows for the CARD 4 customer (CARD 6 did not hold) · a row you did not create · any
LAWNS row · a non-null `line2` (no surface offers that field — tech-debt #279).

---

### CARD 11 — 🔴 THE INVARIANT: EDITING A SAVED SITE DOES NOT MOVE A PAST DELIVERY
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #303 · D-41

🔴 **This is the acceptance clause, and it is proved by ACT rather than by inspection.** If a
contractor edits their saved "Job site A" next month, last month's invoice must still show where
the trees actually went.

**Supabase SQL editor, after CARD 8.** Run these **one at a time** — the editor shows only the last
result set.

**Step 1 — write down what the stop says now:**
```sql
SELECT id, concat_ws(', ', address_line1, city, state, zip) AS stop_address
  FROM deliveries WHERE source = 'checkout' ORDER BY created_at DESC LIMIT 1;
```

**Step 2 — change the saved site out from under it. This is the only write on this card:**
```sql
UPDATE customer_addresses
   SET line1 = '9999 Nowhere Rd', city = 'Elsewhere'
 WHERE label = 'Job site A'
 RETURNING label, line1, city;
```

**Step 3 — read the stop again:**
```sql
SELECT id, concat_ws(', ', address_line1, city, state, zip) AS stop_address
  FROM deliveries WHERE source = 'checkout' ORDER BY created_at DESC LIMIT 1;
```

**PASS:** 🔴 **step 3 returns EXACTLY what step 1 returned.** The stop is unchanged, because the
delivery row carries its own copy and points at nothing.
**FAIL:** the stop address became `9999 Nowhere Rd`. That would mean a stop resolves a saved site at
read time — which D-41 forbids, and which would make every past invoice unreliable.

**Then put it back:**
```sql
UPDATE customer_addresses SET line1 = '501 County Road 107', city = 'Georgetown'
 WHERE label = 'Job site A' RETURNING label, line1, city;
```

---

## ⚠️ THE STORY GATE — NO MATCH, AND A STORY IS **OWED TO DAVID**

§9's story gate was run, and the honest answer is **NO MATCH**. No story was invented to satisfy it.

- **`user_stories.md:1630`** carries `customer_addresses` as **`STATUS: scoped-out`**, reasoned from
  D-40 (Texas is origin-based; the platform never computes a jurisdiction rate). **This build
  inverts that row** — a status flip David makes, not one a build makes quietly.
- **`user_stories.md:524` and `:608`** name the missing piece by its own name: the
  **`conditional-address-on-delivery`** sub-story — *"whether the ship-to should ever differ from
  the customer's billing address at checkout — today it cannot."* This build is the answer to that
  question, arriving before the question was written down.
- The 2026-09-09 recon reached the same conclusion and filed it as **owed to David, not to Thunder.**

**What is owed:** flip `:1630` off `scoped-out`, and write the `conditional-address-on-delivery`
sub-story. Thunder does not dictate stories.
