# OWNER TEST — THE CONTACT RECORD (`customer_phones` · `customer_emails` · `customer_addresses.kind`)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** Anything else is **not production**, and the SHA being
> right does not rescue it: an amber **`PREVIEW <branch>`** chip, an amber **`prod⚠ <branch>`**
> (production, but built from a branch), **`env?`** (target unknown), or **`local`**. **A preview
> serves the RIGHT CODE at the WRONG TARGET — the stamp's SHA matches and the screen is still not
> evidence.** That is tech-debt **#280 ②**, and ledger **#303** was recorded complete on
> preview-only deploys. **If the chip is amber, stop.** *(ledger #321.)*
> *(GATE 0 · OP-15.)*

**Capability:** 3.7 (customers) · 2.1 (checkout) · 3.5 (delivery) · 3.9 (QuickBooks import)
**Ruling:** **David, 2026-09-15** — *"REBUILD THE CUSTOMER AS A CONTACT RECORD… One identity, repeating typed properties… THE IMPORT TAKES EVERYTHING."* Supersedes **[[D-41]]**'s *mechanism* (billing address as columns) and preserves its *invariant* (the order snapshots onto the delivery row).
**Story:** ⚠️ **NO MATCH — a story is OWED to David.** `user_stories.md:1862` still carries the saved address book as `STATUS: scoped-out`, which `20260911b` already inverted and this build inverts further. **A status flip is David's, not Thunder's.**
**Surfaces:** the two new tables + the derived-column trigger · the QuickBooks customer import · the checkout customer step · Cart Review · Order detail · the delivery route · the stop card · the customer roster and search.

> 🔴 **NOTHING ON THIS BOARD HAS BEEN RUN. BOTH MIGRATIONS ARE WRITTEN AND NOT APPLIED.**
> This build touched no database. Every card below is `owed`.

> 🔴 **THE APPLY ORDER IS NOT OPTIONAL — `20260915` FIRST, THEN `20260915b`.**
> The second DROPS the four columns the first's trigger REPLACES. Applied out of order, `customers`
> has **no address at all** in between. They are two files precisely so the destructive half can be
> read on its own before it is run.

> 🔴 **WHO CAN RUN WHAT, AND ON WHICH TENANT.**
> **David can run these now, Supabase SQL editor, no phone:** CARDS 1, 2, 3, 4, 5, 6, 12, 13.
> **David's own login, Test Dave's — these WRITE:** CARDS 7, 8, 9, 10.
> 🔴 **Never on LAWNS** until CARD 14: a checkout there pushes a real invoice.
> **David's own login, LAWNS, LOOKING ONLY:** CARD 11, CARD 14.

---

### CARD 1 — 🔴 RUN THIS BEFORE APPLYING ANYTHING: who would LOSE an address?
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

This is `20260915b` §1's refusal, as a list you can read. **Expect ZERO rows.** Anything here must
be settled before the drop migration runs, because dropping the column destroys the value.

```sql
SELECT id, first_name, organization_name,
       address_line1, billing_line1, city, billing_city, state, billing_state, zip, billing_zip
  FROM public.customers
 WHERE (COALESCE(btrim(address_line1),'') <> '' AND COALESCE(btrim(billing_line1),'') = '')
    OR (COALESCE(btrim(city),         '') <> '' AND COALESCE(btrim(billing_city), '') = '')
    OR (COALESCE(btrim(state),        '') <> '' AND COALESCE(btrim(billing_state),'') = '')
    OR (COALESCE(btrim(zip),          '') <> '' AND COALESCE(btrim(billing_zip),  '') = '');
```

**PASS:** zero rows.
**FAIL:** any row — **do not run CARD 5.** The migration will refuse anyway (it raises), but the
point of running it here is to see the list while you can still do something about it.

---

### CARD 2 — apply `20260915_contact_record.sql`, in the SQL editor
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

**Supabase SQL editor — NOT the table editor** (§6 r17: a table made in the table editor is owned by
`supabase_admin`, whose default ACL hands `anon` TRUNCATE, and TRUNCATE is outside RLS entirely).

Paste everything from `BEGIN;` to `COMMIT;`. The V-block below it is commented out — leave it.

**PASS:** completes with no error. It is idempotent; a second run is a no-op.

---

### CARD 3 — the tables, the policies and the indexes are what the build says
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

```sql
SELECT c.relname AS table, c.relrowsecurity AS rls_on,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.qual LIKE '%owner_id%') AS owner_id_policies,
       (SELECT count(*) FROM pg_indexes i WHERE i.tablename = c.relname AND i.indexdef LIKE '%UNIQUE%') AS unique_indexes,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.cmd = 'DELETE') AS delete_policies
  FROM pg_class c
 WHERE c.relname IN ('customer_phones','customer_emails') AND c.relnamespace = 'public'::regnamespace;
```

**PASS, for BOTH rows:** `rls_on = true` · `policies = 3` · `owner_id_policies = 0` ·
`unique_indexes = 2` · `delete_policies = 0`.
🔴 **`owner_id_policies` must be 0** — `20260910b` took the raw owner policies 49 → 12 and these are
not the 50th and 51st. **`delete_policies` must be 0** — retiring is an UPDATE of `active` (R-133),
so the absent policy is fail-closed by design, not an omission.

---

### CARD 4 — 🔴 THE TRIGGER ACTUALLY DERIVES. This is the one that proves the mechanism.
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

Run it whole. **It rolls itself back and writes nothing.**

```sql
BEGIN;
  INSERT INTO public.customer_phones (business_id, customer_id, label, value, is_primary, source)
  SELECT business_id, id, 'mobile', '(512) 555-0142', true, 'v-block'
    FROM public.customers ORDER BY created_at LIMIT 1;
  SELECT c.id, c.phone AS derived_flat_column, p.value AS list_value, p.value_norm
    FROM public.customers c JOIN public.customer_phones p ON p.customer_id = c.id
   WHERE p.source = 'v-block';
ROLLBACK;
```

**PASS:** `derived_flat_column` = `(512) 555-0142` and `value_norm` = `5125550142`.
🔴 **If `derived_flat_column` is NULL or the old value, the trigger is not firing** — and the whole
"the list is the truth, the columns are a view" claim is false. Stop and report it.

---

### CARD 5 — apply `20260915b_drop_legacy_customer_address.sql`
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

🔴 **CARD 1 must be zero rows and CARD 2 must be done first.** This one is destructive.

**PASS:** completes with no error.
**PASS, equally:** it REFUSES with `REFUSED: N customer row(s) hold a legacy address value that
billing_* does not` — that is the guard doing its job, not a defect. Go back to CARD 1.

---

### CARD 6 — the legacy four are gone, and nothing else lost an address
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

```sql
SELECT table_name, column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND column_name IN ('address_line1','city','state','zip')
 ORDER BY table_name, column_name;
```

**PASS:** **NO rows for `customers`** — and rows for `deliveries` (four), `vendors`, `receipts` and
`businesses` are all still there. 🔴 **`deliveries` keeping its four is D-41's surviving invariant:
the stop holds its own snapshot, so a past invoice still says where the load actually went.**

---

### CARD 7 — Test Dave's: the import takes every phone, and reports what it could not read
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

Run a QuickBooks customer import on **Test Dave's**. On the preview screen, read the panel.

**PASS:** it names what was found and what was NOT taken — a phone recovered from an address line,
an email that looks like it holds several, an address line it could not place. **A clean capture
still says so in words; a blank panel is a FAIL**, because a blank is indistinguishable from a
check that did not run.

---

### CARD 8 — Test Dave's: a customer with two phones actually has two
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

After CARD 7, pick a customer whose QuickBooks record had both a `PrimaryPhone` and a *different*
`Mobile`.

```sql
SELECT p.label, p.value, p.value_norm, p.is_primary, p.source
  FROM public.customer_phones p
 WHERE p.customer_id = '<the id>' ORDER BY p.is_primary DESC, p.created_at;
```

**PASS:** two rows, different `value_norm`, exactly one `is_primary = true`, and `source` names
where each came from. 🔴 **This is the case that was impossible before** — one phone column meant
one of these two numbers had to be discarded.

---

### CARD 9 — 🔴 Test Dave's: THE FIVE THAT USED TO COLLIDE
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

```sql
SELECT c.id, c.first_name, c.organization_name,
       (SELECT count(*) FROM public.customer_phones p WHERE p.customer_id = c.id AND p.active) AS phones,
       (SELECT string_agg(p.source, ' | ') FROM public.customer_phones p WHERE p.customer_id = c.id AND p.active) AS sources,
       a.line1 AS street
  FROM public.customers c
  LEFT JOIN public.customer_addresses a ON a.customer_id = c.id AND a.is_default AND a.active
 WHERE EXISTS (SELECT 1 FROM public.customer_phones p
                WHERE p.customer_id = c.id AND p.source LIKE '%BillAddr%')
 ORDER BY phones DESC;
```

**PASS:** the records whose `BillAddr.Line1` held a phone have **both** the phone (sourced
`quickbooks:BillAddr.Line1`) **and** a real street. 🔴 **Under the old shape these five records had
to give up one or the other, and the choice was a ruling you were owed. There is nothing to rule on
now** — that is the whole point of the build, and this card is where you see it.

---

### CARD 10 — Test Dave's: the checkout still fills the address, and Cart Review shows it
STATUS: owed
LAST-PROVEN: —
DEVICE: phone
COVERS: ledger #335

Ring up an order on **Test Dave's**. At the customer step, search for a customer who has an address
and select them.

**PASS:** street, city, state and ZIP all fill. Continue to **Cart Review** — **the address is
printed under the customer's name.**
🔴 **CART REVIEW IS THE ONE THAT MATTERS HERE.** It read the legacy columns with no fallback, so a
customer whose address lived in `billing_*` showed **no address at all** on this screen while the
truck and the invoice both had it. **A blank address line under the name is a FAIL.**
⚠️ **Provable without a console** — it is on the screen or it is not.

---

### CARD 11 — LAWNS, LOOKING ONLY: the roster still finds people by address
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

On **LAWNS**, open `/customers` and search for a street name you know is on file.

**PASS:** the customer comes back. 🔴 **The searchable address fields changed from the legacy four
to `billing_*`; if that had been missed, this search would match NOTHING and say nothing about
why** — a cashier types a street, gets no hit, and the screen looks fine.
**Nothing here writes.**

---

### CARD 12 — a second import run changes nothing
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

Note the counts, then run the **same** import on Test Dave's again.

```sql
SELECT (SELECT count(*) FROM public.customer_phones)    AS phones,
       (SELECT count(*) FROM public.customer_emails)    AS emails,
       (SELECT count(*) FROM public.customer_addresses) AS addresses;
```

**PASS:** identical before and after. 🔴 **Idempotence is enforced by the partial unique indexes,
not by the code checking first** — a read-then-write is a race (tech-debt #54). This card is what
proves the index is doing it.

---

### CARD 13 — the derived column agrees with the list
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

```sql
SELECT c.id, c.billing_line1 AS flat, a.line1 AS list
  FROM public.customers c
  JOIN public.customer_addresses a
    ON a.customer_id = c.id AND a.active AND a.is_default AND a.kind IN ('billing','both')
 WHERE c.billing_line1 IS DISTINCT FROM a.line1;
```

**PASS:** zero rows. Every flat column matches the list row it derives from.

---

### CARD 14 — 🔴 LAWNS, AND ONLY AFTER EVERY CARD ABOVE IS GREEN
STATUS: needs-test
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

**Reason it is `needs-test` rather than written:** the LAWNS bulk import **has never run**, and when
it does it is **Lauren who runs it, live, with David standing behind her** ([[R-69]] — *"David does
not run the import"*). The card that covers that run belongs to that session, written against what
the preview actually says on her data. **Writing it now would be inventing the steps of a test
nobody has designed yet**, which is the thing OP-14's `needs-test` state exists to record honestly.

---

> **COVERAGE: 0 of 14.** Thunder may never mark a card `covered` — only David's live run flips one,
> with a date. **Cards 1–6 and 12–13 are SQL and need no deploy; cards 7–11 need the build in front
> of you, and GATE 0 is what settles which build that is.**
