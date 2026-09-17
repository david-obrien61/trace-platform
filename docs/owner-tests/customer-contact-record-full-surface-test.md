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

> 🔴 **NOTHING ON THIS BOARD HAS BEEN RUN. ALL THREE MIGRATIONS ARE WRITTEN AND NOT APPLIED.**
> This build touched no database. Every card below is `owed`.

> 🔴 **THE APPLY ORDER IS NOT OPTIONAL — THREE FILES, IN THIS ORDER** *(amended 2026-09-16)*:
> **①** `20260915_backfill_legacy_customer_address.sql` — copies a legacy-only value into `billing_*`
> **②** `20260915_contact_record.sql` — **seeds the three lists from the flat columns**, then derives them
> **③** `20260915b_drop_legacy_customer_address.sql` — drops the legacy four
> ② seeds from `billing_*` and never reads the legacy four, so **a value that is still legacy-only when
> ② runs never reaches the list, and ③ then destroys it** — that is why ① is first. ③ removes columns
> ②'s trigger replaces; applied before ②, `customers` has no address at all in between.

> ✏️ **CHANGED 2026-09-16 — TECH-DEBT #306 IS FIXED ON THIS BRANCH** (the writer reads what each
> customer holds and adds only what is new; a seeded billing row that disagrees with QuickBooks is
> retired and replaced). **It was the writer's defect, and the writer's tests now prove the fix.**
> ✏️ **CHANGED AGAIN 2026-09-16 (David's Step-4 rulings) — EVERY WRITER NOW GOES THROUGH THE CONTACT
> WRITER, AND THE DATABASE REFUSES ONE THAT DOES NOT.** The QuickBooks customer import, OCR capture,
> checkout, delivery ingest, the customer editor and the ship-to picker all write the lists; a direct
> write to `customers.phone` / `email` / `billing_*` is refused with a sentence (② §5e). **Cards 7, 8, 9
> and 12 are runnable once this branch is merged and deployed.**
> 🔴 **THE SEED NOW CLASSIFIES (② §5b):** a phone typed into a street goes to the PHONE list (words
> beside it kept as its note), never the address list; an email field holding several addresses
> becomes one row each. Measured on the LAWNS snapshot: **465** street fields were only a phone, **10**
> were a phone with words, **15** held a phone different from the phone field (4 of those customers
> had no phone at all), **1** email field held three addresses.

> 🔴 **WHO CAN RUN WHAT, AND ON WHICH TENANT.**
> **David can run these now, Supabase SQL editor, no phone:** CARDS 1, 2, 3, 3b, 4, 4b, 4c, 5a, 5, 6, 13.
> **David's own login, Test Dave's — these WRITE:** CARD 10 · and **7, 8, 9, 12 only once the import calls the contact writer** (see above).
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

**IF IT FAILS (it did, 2026-09-15 — 20 rows: 19 `state='TX'` alone, plus Paul `58e9e0f9…` with a real
street): apply ① `20260915_backfill_legacy_customer_address.sql` in the SQL editor, then run this
card again.** ① copies each legacy-only value into its empty `billing_*` column and refuses its own
transaction if any row is left over. **PASS after ①: zero rows.**
⚠️ **This card does not see a row where BOTH columns hold a value and they DISAGREE** — ③ discards the
legacy side of such a row silently. That blind spot is **tech-debt #305**. On 2026-09-15 there was one
such row (Test Dave's, both addresses fabricated) and David ruled it needs nothing.

---

### CARD 2 — apply `20260915_contact_record.sql`, in the SQL editor
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

**Supabase SQL editor — NOT the table editor** (§6 r17: a table made in the table editor is owned by
`supabase_admin`, whose default ACL hands `anon` TRUNCATE, and TRUNCATE is outside RLS entirely).

Paste everything from `BEGIN;` to `COMMIT;`. The V-block below it is commented out — leave it.

**PASS:** completes with no error, and the messages show `SEEDED: N billing address row(s)`. It is
idempotent; a second run is a no-op.
**PASS, equally:** it REFUSES with `REFUSED: … hold a billing address, … a phone and … an email with NO
list row` — the whole transaction is undone and nothing changed. That is §5c refusing to install a
trigger that would blank those values; report it, do not work around it.

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

### CARD 3b — 🔴 THE SEED LANDED, CLASSIFIED: every value has a list row, and no street is a phone
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

✏️ **REWRITTEN 2026-09-16** for the classifying seed. **Run it straight after CARD 2.** The apply itself
printed a line starting `SEEDED:` — these numbers should match it.

```sql
SELECT
  (SELECT count(*) FROM public.customer_addresses WHERE source = 'migrated:customers.billing_*') AS seeded_addresses,
  (SELECT count(*) FROM public.customer_phones WHERE source = 'migrated:customers.phone')        AS phones_from_phone_field,
  (SELECT count(*) FROM public.customer_phones
    WHERE source IN ('migrated:customers.billing_line1','migrated:customers.billing_line2','migrated:customers.address_line1')) AS phones_from_a_street,
  (SELECT count(*) FROM public.customer_phones WHERE source LIKE 'migrated:%' AND note IS NOT NULL) AS phones_with_a_note,
  (SELECT count(*) FROM public.customer_emails WHERE source = 'migrated:customers.email')        AS seeded_emails,
  (SELECT count(*) FROM public.customer_addresses
    WHERE line1 ~ '^\s*(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*$')          AS addresses_whose_street_is_a_phone,
  (SELECT count(*) FROM public.customers
    WHERE billing_line1 ~ '^\s*(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\s*$')    AS customers_showing_a_phone_as_street;
```

**PASS on LAWNS** (measured on the 2026-09-16 snapshot — the live numbers add the few customers of
other tenants and any LAWNS customer added since): `seeded_addresses` about **1,456** ·
`phones_from_phone_field` about **1,497** · `phones_from_a_street` about **16** · `phones_with_a_note`
about **5** · `seeded_emails` about **1,722** · 🔴 **`addresses_whose_street_is_a_phone` = 0** ·
🔴 **`customers_showing_a_phone_as_street` = 0.**
If either of the last two is not 0, **stop and report it** — the migration's own check should have
refused.

Then Paul, the one real address the backfill rescued:

```sql
SELECT label, kind, line1, city, state, zip, is_default, source
  FROM public.customer_addresses
 WHERE customer_id = '58e9e0f9-6ac6-49c5-a954-0061f201d134';
```

**PASS:** one row — `20401 Gilbert Cove`, `Lago Vista`, **`TX`**, **no ZIP**, `kind = billing`,
`is_default = true`.
✏️ **CORRECTED 2026-09-17: Paul has NO ZIP and never had one** — the 2026-09-16 snapshot shows his ZIP
empty in both the legacy and the billing column. Only his STATE was legacy-only, and the backfill
moved it (verified live 2026-09-17: `billing_state = TX`, `billing_zip` empty). An empty ZIP here is
correct. 🔴 **A blank STATE here means ② ran before ①** — stop before CARD 5.

---

### CARD 4 — 🔴 THE TRIGGER ACTUALLY DERIVES. This is the one that proves the mechanism.
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

Run it whole. **It always ends in an error on purpose — that error IS the result, and it undoes
everything, so nothing is kept.** ✏️ 2026-09-17: was `BEGIN … ROLLBACK`, which keeps the change if the
`ROLLBACK` line is not run.

```sql
DO $$
DECLARE v_id uuid; v_flat text; v_list text; v_norm text; v_street text;
BEGIN
  SELECT id INTO v_id FROM public.customers
   WHERE COALESCE(btrim(billing_line1),'') <> '' ORDER BY created_at, id LIMIT 1;
  UPDATE public.customer_phones SET is_primary = false WHERE customer_id = v_id;
  INSERT INTO public.customer_phones (business_id, customer_id, label, value, is_primary, source)
  SELECT business_id, id, 'mobile', '(512) 555-0142', true, 'v-block' FROM public.customers WHERE id = v_id;
  SELECT c.phone, p.value, p.value_norm, c.billing_line1 INTO v_flat, v_list, v_norm, v_street
    FROM public.customers c JOIN public.customer_phones p ON p.customer_id = c.id AND p.source = 'v-block'
   WHERE c.id = v_id;
  RAISE EXCEPTION 'CARD 4 (nothing kept): flat phone = % · list value = % · value_norm = % · street after = %',
    v_flat, v_list, v_norm, v_street;
END $$;
```

**PASS:** the message reads `flat phone = (512) 555-0142 · list value = (512) 555-0142 · value_norm =
5125550142 · street after = <a street, not NULL>`.
🔴 **A NULL street after the write is the defect the seed exists to prevent.** Stop and report it.
🔴 **If the flat phone is NULL or the old value, the trigger is not firing.** Stop and report it.
---

### CARD 4b — 🔴 A DIRECT WRITE IS REFUSED (the guard)
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

Run it whole. **It always ends in an error, which undoes everything.**

```sql
DO $$
BEGIN
  UPDATE public.customers SET phone = '(512) 555-0199'
   WHERE id = (SELECT id FROM public.customers ORDER BY created_at LIMIT 1);
  RAISE EXCEPTION 'GUARD MISSING — the direct write was ACCEPTED (and has been undone by this error).';
END $$;
```

**PASS:** it stops with **`Not saved: a customer's phone, email and billing address are kept in their
contact lists, not on the customer row. Nothing was changed.`**
🔴 **If it says `GUARD MISSING` instead, the guard is not installed** — an old writer could then set a phone
that the next list write silently throws away. Stop and report it.

---

### CARD 4c — 🔴 THE PHONES THAT WERE IN STREETS ARE PHONES NOW
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

```sql
SELECT c.id, c.phone, c.billing_line1, c.billing_city,
       (SELECT string_agg(p.value || CASE WHEN p.is_primary THEN ' (primary)' ELSE '' END
                          || coalesce(' — ' || p.note, ''), ' · ' ORDER BY p.is_primary DESC)
          FROM public.customer_phones p WHERE p.customer_id = c.id AND p.active) AS phones
  FROM public.customers c
 WHERE EXISTS (SELECT 1 FROM public.customer_phones p
                WHERE p.customer_id = c.id AND p.source LIKE 'migrated:customers.%line%')
 ORDER BY c.phone NULLS FIRST
 LIMIT 25;
```

**PASS:** every row lists **two** phones (the phone field as primary, the street's number beside it)
**or one** primary phone for the few customers who had none — and `billing_line1` is a real street or
empty, **never a phone**. Rows with a note show it after a dash (`— cell`).

---

### CARD 5a — 🔴 NOTHING FROM THE SNAPSHOT WAS LOST (run before CARD 5)
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

Open **`~/Desktop/trace-platform/supabase/local-data/2026-09-16_lawns_snapshot_proof.sql`** (it holds
customer data — it lives only on this Mac and is never committed), paste the whole file into the SQL
editor, run it. Thunder can also run it read-only and paste you the result.

**PASS:** one row — `misses` = **0** (about 10,800 expectations). Any miss is listed as
`<customer id> <kind>`; **do not run CARD 5** until it is 0.

---

### CARD 5 — apply `20260915b_drop_legacy_customer_address.sql`
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

🔴 **CARD 5a must be 0 misses, CARD 2 and `20260916d` must be done, and this branch must be merged and
deployed first.** This one is destructive and it is LAST.
✏️ 2026-09-16: its pre-flight now counts a legacy street that moved to the PHONE list as safe — the
465 legacy "streets" that are phone numbers are in `customer_phones`, and the check reads them there.

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

**PASS:** identical before and after, **and the import finishes without an error on any customer.**
✏️ **CHANGED 2026-09-16 (tech-debt #306).** This card used to say the partial unique indexes did the
work. **They cannot** — measured: the old write raised a duplicate-key error on the second run. The
import now reads what each customer already holds and adds only what is new; the indexes stay as
the backstop, so a collision shows up as an error, never as a duplicate row.

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

### CARD 15 — Test Dave's, checkout: a second phone is KEPT, the first stays shown
STATUS: owed
LAST-PROVEN: —
DEVICE: phone
COVERS: ledger #335

1. Start a checkout for an existing Test Dave's customer who has a phone.
2. On the customer step, type a **different** phone number. Finish the order.
3. Open that customer on /customers.

**PASS:** the customer still shows the **original** phone; the new number is on file as a second
phone. The order went through with no error.

---

### CARD 16 — Test Dave's, customer editor: changing the phone REPLACES it, and a ship-to save keeps it
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

1. /customers → open a Test Dave's customer → change **Phone**, **Email** and **Street** → Save.
2. Reload. The three new values show.
3. Start a checkout for that customer and **save a new ship-to site** ("Job site", any street + city).
4. Reload the customer.

**PASS:** after step 4 the customer still shows the phone, email and street from step 1 — **nothing
blanked, nothing reverted.** (This is the exact failure the Step-4 report reproduced.)

---

### CARD 17 — Test Dave's, OCR capture: a new customer keeps everything after a ship-to save
STATUS: owed
LAST-PROVEN: —
DEVICE: desktop
COVERS: ledger #335

1. Capture an invoice that creates a **new** customer with a phone, email and street.
2. Save a ship-to site for that customer (as in CARD 16 step 3).
3. Open the customer.

**PASS:** phone, email and street are all still there.

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

> **COVERAGE: 0 of 21.** Thunder may never mark a card `covered` — only David's live run flips one,
> with a date. **Cards 1–6 (with 3b, 4b, 4c, 5a) and 12–13 are SQL and need no deploy; cards 7–11 and 15–17 need the
> build in front of you, and GATE 0 is what settles which build that is.**
