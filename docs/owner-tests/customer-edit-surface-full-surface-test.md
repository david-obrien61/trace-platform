# CUSTOMER EDIT SURFACE — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance, no dashboard, no `git log`. *(GATE 0 · OP-15 · paid for on 2026-08-31: a whole
> session was spent hunting a defect in code that was never deployed.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for the customer edit-surface owner-tests.** It is STANDING —
> run it after any change to `CustomerPartyEditor`, `CustomerEditModal`, `customerEdit.ts`, the
> `/customers` roster's inline cells, **the roster's SEARCH** (cards 12–13), or **the checkout
> customer picker's search** (cards 14–15). A per-build proof is a FILTER (`COVERS: #NNN`), never a
> second doc.

**Purpose:** prove the customer form actually WRITES what it says it writes. Every card below is a
`STATUS: owed` — the whole board is **0 of 19**.

**Scope note (2026-08-25, ledger #217):** cards 1–8 cover the customer EDIT surfaces
(`CustomerPartyEditor` / `customerEdit.ts` / the roster cells). **Cards 9–11 cover a different
writer on the same table** — `customerUpsert.ts`, the shared find-or-create the CHECKOUT and the OCR
door both call. They live here because the artifact the owner reads is the same one (the customer
row on `/customers`), and a second document answering "did the customer record save?" would drift
(STD-011). ⚠️ **Card 7 was NOT flipped by #217** — it tests `customerEdit.ts`, which that build did
not touch.

**Scope note (2026-08-25, ledger #219):** **cards 14–15 leave `/customers` entirely** — they are run at
the register, on the checkout customer picker (`CustomerSearch.tsx`, the customer step of `/checkout/*`).
They live on this board anyway because **card 15 is a COMPARISON between the two screens and cannot be
run from only one of them**, and because a second document answering *"can I find this customer?"* would
drift from cards 12–13 (STD-011). ⚠️ **#219 changed ONLY which fields the picker searches** — not its
columns, its `.limit(25)`, its ordering, its three-state permission handling, or what selecting a
customer does — so no existing card moved and none was flipped.

**Scope note (2026-08-25, ledger #218):** **cards 12–13 are the first READ cards on this board** — every
other card asks *"did it save?"*, these ask *"can I find them?"*. They live here rather than in a new file
because the surface is the same screen (`/customers`) and a second document about that screen would drift
(STD-011). **Nothing about the list QUERY changed** — #218 changed only which fields the search reads, so no
existing card moved and none was flipped.

**Why this exists (the defect these cards defend against):** `CustomerPartyEditor` compared each
edited field against `draft` — the ON-SCREEN working copy that `input()` had already updated on every
keystroke. The unchanged-check therefore asked *"does what I typed equal what I typed?"*, answered
yes, and returned without writing. **Every plain text field in the one customer form silently wrote
nothing in edit mode, while the footer read "Changes save automatically as you edit."** Separately,
the Tax group alone required a "Save exemption" button that the same footer told the owner did not
exist — a certificate number typed there was lost on close. Cards 1–4 are the live proofs of the
write; cards 5–8 prove the rules that survived the change.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 Written but not run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 Surface exists, no test — a known hole. |
| `LAST-PROVEN: never` | Nobody has ever run this against the real UI. |
| `DEVICE:` | `phone` (capture) · `desktop` (reconcile/admin) · `either`. |
| `COVERS:` | The ledger row / gap / card this check defends. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS must be visible without a console. |

**PASS = every card in scope is `covered` with today's date.** Thunder never sets `covered` (OP-14).

---

## ⛔ GATE 0 — CONFIRM YOU ARE TESTING THE DEPLOYED CODE (OP-15 — owner-prove STEP ZERO)

> **STEP ZERO. Before you read any screen as evidence: confirm the deploy for the SHA under test is
> live.** A failed Vercel build is SILENT — it keeps serving the last-good bundle, and Vercel deploys
> the TREE not the COMMIT. If the SHA under test is not live, every observation below is fiction.

- [ ] **① SHA is live** — the `?debug=1` DebugPanel stamp matches `git log -1 --format=%h`.
- [ ] **② no migration needed** — this build is app-code only. Nothing to apply.
- [ ] **③ you are the OWNER for cards 1–6.** `customers` RLS is owner-only FOR ALL; a non-owner
      cannot write it at all. Card 7 is the one that deliberately uses a non-owner session.

---

## THE CARDS

### CARD 1 — a text edit actually persists (the defect, head-on)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the commitText working-copy defect (2026-07-29)
SIGNAL: `[TRACE:customers] edit {field: 'email', from: …, to: …}`

**REWRITTEN 2026-07-29 for phase B — the panel is now a FORM.** Open `/customers` → **Edit** →
change **Email** → **press Save changes** → **reload the page** → re-open.
**PASS:** the new email is there. **FAIL (the old behaviour):** the old email is back.
Reload is the whole point — the original defect left the value on screen while writing nothing, so
*not* reloading is exactly how it hid.

### CARD 2 — the same, on a field in every other group
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the commitText working-copy defect — group coverage

Change one field in every group, then press **Save changes ONCE**, then reload: **Identity** (Display name) ·
**Contact** (Phone) · **Billing address** (City) · **Commercial terms** (Payment terms) ·
**Status** (Notes). **PASS:** all five survive the reload **from a single Save** — that is the phase-B
claim, that one commit carries the whole record. One group missing means the diff skipped a field.

### CARD 3 — the Tax group commits with no button (the fold)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the tax-group commit-model fold (2026-07-29)

**REWRITTEN 2026-07-29.** Edit a customer → tick **Tax-exempt** → set a **Reason** → type a
**Certificate #** → set **Cert expires** → press **Save changes** → reload → re-open.
**PASS:** all four are there, saved by the SAME button as every other field — the tax group has no
button of its own and needs none. **This is the card that proves the lost-certificate defect is
dead**: the number used to require a "Save exemption" press the footer said was unnecessary, and now
there is exactly one Save for the whole record.

### CARD 4 — the roster reflects it without a manual refresh
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the `onSaved()` reload path

With the editor open over the roster, change the **Tax** state → **Save changes**.
**PASS:** the dialog closes and the roster's **Tax** column already reads the new state — no refresh.

### CARD 5 — NEGATIVE: exempt without a reason is REFUSED, and says so
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: D-40 (never zero tax without a recorded reason) — survives the fold
SIGNAL: no `[TRACE:customers] edit` line is emitted

Edit a customer → tick **Tax-exempt** → set Reason to **Other** → leave the free-text box **empty** →
click outside it. **PASS:** the inline message *"A reason is required to make a customer tax-exempt"*
appears **and nothing is written** — close, reload, re-open: the customer is still **Taxable**.
**FAIL:** the customer comes back exempt with a blank reason. This is the rule the removed button
used to carry; it now lives in `commitExemption` and must still hold.

### CARD 6 — NEGATIVE: first name cannot be blanked, and Save says why
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: first_name is identity + D-9 + M2 (validation surfaced, never silent)

**REWRITTEN 2026-07-29 — the rule moved.** Under per-field auto-save this snapped the input back on
blur; under one Save it is a validation failure at Save, which is the honest shape (you can hold an
invalid draft on screen, you just cannot commit it).
Edit a customer → clear **First name** → press **Save changes**.
**PASS:** *"First name is required."* appears, the dialog STAYS OPEN, and nothing is written —
reload and the old name is intact. **FAIL:** it saves, or the button does nothing with no message.

### CARD 8 — CANCEL DISCARDS, and it never did before
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: A3/E2 phase B — Cancel meant "stop, keeping every write so far"

Edit a customer → change **Phone**, **City** and the **Tier** → press **Cancel** → confirm the
discard prompt → reload → re-open.
**PASS:** none of the three changed. **FAIL (the old behaviour):** some or all of them persisted —
which is what the X used to do, while looking exactly like discard.
Then the guard's negative: open a customer, change **nothing**, press **Cancel**. **PASS:** it closes
with NO prompt — a confirm on a clean form trains people to dismiss it.

### CARD 7 — NEGATIVE: a save that cannot write must NOT say it saved
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: A8 · ui-control-standards E5 · STD-023's class
SIGNAL: `[TRACE:customers] edit AFFECTED ZERO ROWS — refused or missing`

**This card was `needs-test` until 2026-07-29 because the behaviour did not exist. It does now.**
`customers_member_update` gates on `customers:update`. A STAFF member holds `customers:read` and NOT
`customers:update`, so their UPDATE matches zero rows — and PostgREST returns **no error**, which is
why the form used to report success.

> ### 🤖 MACHINE HALF — the POLICY is proven; this card proves the SCREEN
> `npm run verify:rls` → **`scripts/rls/customer-write-permission.rls.mjs`** · **11/11 green
> 2026-07-30**, and observed RED under mutation (withhold `customers:update` from the granted
> principal → 4 assertions fire).
>
> It signs in as an **ephemeral STAFF member** with the **anon key** under real RLS, edits a
> **throwaway customer** (minted and deleted in a `finally` — nothing touches a real customer row),
> and proves: zero rows affected **AND no error** on the denied write · the old value survives a
> reload · one row affected once `customers:update` is granted **on the same session** · and the
> write closes again when it is revoked, so the gate is the PERMISSION and not mere membership.
>
> **⚠️ THIS DOES NOT MARK THE CARD `covered` (OP-14).** It proves the POLICY refuses. This card
> proves the SCREEN tells the truth when it is refused — the error copy below, on the real form.
> A machine can do the first; only David's live run does the second. **STATUS stays `owed`.**

**SETUP:** sign in as a STAFF member of tenant `f7ec5d67` (not the MANAGER, not the owner). Confirm on
`/team` that the member holds `customers:read` and does **not** hold `customers:update`.

Open a customer, change **Phone**, click outside the field.
**PASS:** an error appears — *"That change was not saved. You may not have permission to edit this
customer, or it may have been removed."* — and after a reload the old phone is still there.
**FAIL (the defect):** the field shows the new value, no error, and the reload reverts it.

Then the **grid** half, which is the same defect one surface over: on `/customers`, change a **Tier**
cell as the same STAFF member. **PASS:** *"That tier change was not saved…"*. **FAIL:** the cell
repaints as if it landed.

**POSITIVE CONTROL — run it in the same sitting or the card proves nothing:** repeat both edits as the
MANAGER `df7723be` (who DOES hold `customers:update`). Both must save silently and survive a reload.
*A refusal message that also fires for the permitted user is a new defect, not a fix.*

---

---

### CARD 9 — THE CHECKOUT EMAIL LANDS IN THE ROW (the defect, head-on)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #217 · R-12
SIGNAL: `[TRACE:PERSON] fill: writing only fields blank on the stored row` — **and `email` must appear in its `filled` array**

🔴 **READ THE ROW, NOT THE SCREEN. "The confirmation screen showed the email" IS THE DEFECT, not the
proof** — the typed value lives in client state and renders correctly whether or not anything was
written. Diane Foster's invoice was SENT to an address the database never held.

1. **GATE 0 first** (top of this file): the SHA on screen == `git log -1`, Vercel READY for THAT SHA.
2. Pick a customer whose stored email is BLANK. The measured one is **Diane Foster
   `0ee368fe-5b2f-4458-a75d-d4498024a605`**; `/customers` → their Email cell is empty.
3. Ring up an order for them through checkout and **type an email** at the Customer step.
4. Complete the order.
5. Go to `/customers`, open that same customer, **read the Email field.**

**PASS:** the email you typed is stored on the row.
**FAIL:** the field is still blank — or holds a different address than you typed.
⚠️ **Also check no SECOND customer row was created** (search the name; there must be exactly one).

---

### CARD 10 — 🔴 NEGATIVE: A BLANK EMAIL AT CHECKOUT MUST NOT BLANK A STORED ONE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #217 · A9 (absent is not empty)
SIGNAL: the `filled` array in `[TRACE:PERSON] fill:` **must NOT contain `email`**

**THE CARD THAT PROTECTS YOU, AND THE MORE IMPORTANT OF THE PAIR.** A fix that persists a typed
email but wipes a stored one on the next silent checkout is WORSE than the defect it replaced — it
destroys a curated value instead of failing to capture a new one.

1. Pick a customer who **already HAS an email** (Card 9's customer, after Card 9 passes, is ideal).
2. Ring up a second order for them.
3. At the Customer step, **leave the email box EMPTY** (or reach them by a path that does not ask).
4. Complete the order.
5. Read the row on `/customers`.

**PASS:** their stored email is **UNCHANGED**.
**FAIL:** the field is now blank, or holds an empty string.

---

### CARD 11 — AN EDITED EMAIL REPLACES THE STORED ONE (supplied-wins, and it is deliberate)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #217 · §6 r10 (a stated divergence)
SIGNAL: `filled` contains `email`; the row afterwards holds the NEW address

⚠️ **THIS IS THE ONE FIELD ON THE CHECKOUT WRITE PATH THAT DOES NOT FOLLOW FILL-NEVER-CLOBBER, and
that is a decision, not an accident.** Every other field (phone, address, city…) fills a blank and
REFUSES to overwrite a curated value. Email replaces, because the register is where a customer says
"that one's old" — and the invoice is sent to whatever was typed. If you decide that is wrong, the
change is one line: move `'email'` out of `SUPPLIED_WINS` and into `FILLABLE`.

1. Pick a customer with a stored email.
2. Ring up an order and type a **DIFFERENT** email.
3. Complete it, then read the row.

**PASS:** the row holds the NEW email.
**FAIL:** it still holds the old one (the fix landed as fill-only), **or** a second customer row was
created (the person spine failed to match — that is #112's territory, not this card's).

⚠️ **KNOWN AND FILED, so do not re-file it as a bug:** after this card, `customers.email` and
`people.email` may disagree — the spine never backfills an email onto a person it matched by phone
(**tech-debt #112**).


### CARD 12 — AN ORGANIZATION CUSTOMER CAN BE FOUND BY THE NAME THE LIST SHOWS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #218
SIGNAL: `[TRACE:customers] loadCustomers ok` — its `searchable` field now lists **10** fields and must include `organization_name`

🔴 **THE DEFECT WAS THAT THE ROW WAS VISIBLE AND UNFINDABLE.** It printed its own name on the roster
and typing that name into the box directly above it returned nothing. So the proof is not "a search
works" — it is *"the thing I can see, I can search for."*

1. **GATE 0 first** (top of this file): the SHA on screen == `git log -1`, Vercel READY for THAT SHA.
2. Open `/customers`. Find any customer whose **Type** column reads **Organization**. Note the exact
   name shown in the Name column.
3. Type a word from that name — one that is NOT the contact's first or last name — into the search box.

**PASS:** that customer appears.
**FAIL:** the list goes empty, or the count pill reads `0 of N shown`.
⚠️ If no organization customer exists on this tenant, add one first (Add Customer → Type:
Organization) — otherwise this card proves nothing and should be reported as **not run**, not as pass.

---

### CARD 13 — 🔴 NEGATIVE: A SEARCH THAT MATCHES TWO CUSTOMERS RETURNS TWO
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #218
SIGNAL: the DataSheet **count pill** — `2 of N shown` — is the whole assertion; read the number, not the rows

🔴 **THIS IS THE CARD THAT PROTECTS YOU, AND IT IS NOT ABOUT THE BUG THAT WAS FIXED.** It fails the
day anyone adds a dedup, a DISTINCT, or a collapse-by-name to this list. **What a duplicate customer
IS remains your ruling — this card only guarantees the roster stops deciding it for you.**

1. **GATE 0 first.**
2. Open `/customers`. Search **`foster`**.
3. **Read the count pill**, not the rows.

**PASS:** the pill reads **`2 of N shown`** and **both** Diane Foster rows are listed, with different
records behind them (click each name — the two detail pages must have different URLs).
**FAIL:** the pill reads `1 of N shown`. That is either the original defect or a new dedup.

4. Now **clear the search box.**

**PASS:** the pill reads **`N customers`** where N is every customer this business has — the roster
loads the whole table unfiltered.
**FAIL:** N is smaller than the table's row count.

⚠️ **`foster` is the measured term on the current test tenant.** On a tenant without it, use any term
you know matches exactly two customers and assert that number instead.

---

### CARD 14 — THE REGISTER FINDS THE CUSTOMER THE ROSTER SHOWS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #219
SIGNAL: `[TRACE:customers] search` — its `searchableFields` must now read **10** (it read 6 before this build)

🔴 **THE DEFECT WAS A DISAGREEMENT BETWEEN TWO SCREENS ABOUT WHO EXISTS.** Measured on `8b26348`:
the roster returned TWO rows for `cedar` and the register returned ONE. The row the register could
not see matched on its **city** — so the cashier's honest next move is to create a customer who is
already there, which is the duplicate `CustomerSearch` exists to prevent.

1. **GATE 0 first** (top of this file): the SHA on screen == `git log -1`, Vercel READY for THAT SHA.
2. Open `/customers` and search **`cedar`**. Note **every** name returned and the count pill.
3. Now start an order and reach the customer step (scan or `/checkout/*` → the customer screen).
4. Search **`cedar`** there.

**PASS:** the register returns **the same customers, by name**, as the roster did in step 2 — in
particular the one whose *address* is in Cedar Park, not just the one with Cedar in its name.
**FAIL:** the register returns fewer.
⚠️ **If `cedar` is not a live term on this tenant**, use any term you can see in the **City** or
**Address** column of a customer on `/customers` and that appears in NO part of their name. A term
that is also in the name proves nothing — the old six-field list already matched names.

---

### CARD 15 — 🔴 THE RULE: THE SAME TERM, THE SAME CUSTOMERS, ON BOTH SCREENS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #219
SIGNAL: the roster's count pill vs the register's result list — the assertion is that they AGREE

🔴 **THIS IS THE CARD THAT PROTECTS YOU, AND IT IS NOT A TEST OF THE FIX.** It fails the day anyone
adds a field to one search and not the other — which is the state that existed for the whole of the
last two builds and was invisible until you typed the same word into two boxes.

1. **GATE 0 first.**
2. Pick **three** terms from `/customers`: one from a **name**, one from a **city or address**, one
   from a **phone or email**.
3. Search each on `/customers`. Write down the names returned.
4. Search each at the register's customer step.

**PASS:** all three terms return **the same customers** on both screens.
**FAIL:** any term returns a customer on one screen and not the other.

⚠️ **THREE KNOWN EXCEPTIONS — these are NOT failures, they are what the two mechanisms genuinely
are, and they are recorded so you do not report them as bugs:**
- **A term with a SPACE that spans two fields** (typing `diane foster`, where `Diane` is the first
  name and `Foster` the last) matches on the ROSTER and not at the register. The roster joins the
  fields into one string; the register asks the database about one column at a time. **Use
  single-word terms for this card.**
- **More than 25 matches.** The register stops at 25; the roster does not. Use a term that matches a
  handful of customers.
- **A term containing `%` or `,`.** The two clean it up differently.

---

## WHAT THIS BOARD DOES NOT COVER (stated, not silent)

- **`CustomerEditModal`** (the 8-field editor mounted from `DeliverySchedule`) is a SECOND edit
  surface over the same record — a live A1/E1 violation. It was **not changed** by this build and has
  **no cards here**. It never had the working-copy defect (it keeps `draft` persisted and `form`
  working, which is how the defect was diagnosed). **It DOES still have the A8 defect** — it writes
  through `persistCustomerField`, so it inherits the fix, but its own error surfacing is unproven.
  Cards arrive when the merge does.
- **The roster inline cells** now carry the A8 check (card 7's second half); no other card.
- **The roster's SORT, its column show/hide, and its `sources` quick-filter** were NOT touched by #218
  and have **no cards**. ⚠️ **The eleven OTHER lists that narrow silently** — `/delivery-schedule`,
  `/deliveries`, the dashboard's revenue read and eight more — are **tech-debt #114** and are NOT covered
  here; the roster is the one surface that already states `N of M shown`, which is why it is the only one
  with a card that can read a count.
- ✅ **THE THIRD CUSTOMER SEARCH NOW HAS A CARD AND IS NO LONGER NARROW — CARD 19.** `ScanOrder.tsx`'s
  customer-attach strip used to match on **`first_name` and `last_name` only** (tech-debt #116) and was
  scoped OUT of #219. #220 replaced it with the SAME component the register uses, so cards 14–15 now
  reach it too. **The card promised here has arrived, as promised.**
- **Create mode** ("Add Customer") buffers to one INSERT and was not the defect; no card.
- **The other 80 unchecked mutation sites platform-wide** are held by
  `zero-row-writes-baseline.json` and are NOT covered here — they are rows on the architecture
  backlog, not customer-surface tests.

---

### CARD 16 — 🔴 THE ADDRESS ARRIVES WITH THE CUSTOMER (R-19's headline)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #220
SIGNAL: City and ZIP are FILLED after you pick someone — the boxes that were blank on `f1c26ef`

⚠️ **READ THIS FIRST, because the last report described it wrongly and the correction changes what
you are looking for.** `123 Oak Creek Dr` was **never data**. It is the grey PLACEHOLDER text on the
empty address box (`CustomerCapture.tsx:377`, its only occurrence in the entire repo). The field was
**blank**, not wrong — nothing incorrect ever reached an invoice or a delivery row. **So what you are
checking is that the boxes are now FILLED, not that a wrong value is gone.**

1. **GATE 0 first** — the SHA on screen matches `git log -1`, and Vercel is READY for THAT SHA.
2. Pick a customer on `/customers` who **has an address**. Note their street, city, state and ZIP.
3. Start an order, reach the customer step, search for them, and select them.

**PASS:** First name, Last name, Email, Phone, **Delivery address, City, State and ZIP** are all
filled, and the address matches what `/customers` shows.
**FAIL:** any of the four address boxes is empty (grey placeholder text = empty) while the customer
has that value on `/customers`.

⚠️ **If the customer has NO address on file, the boxes SHOULD be empty** — that is correct, not a
failure. Pick someone with an address, or the card proves nothing.

---

### CARD 17 — 🔴 SELECT A, THEN B — NOTHING OF A SURVIVES
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #220
SIGNAL: after switching customers, no box holds the previous customer's value

🔴 **THIS IS THE ONE THAT WOULD PUT THE WRONG ADDRESS ON A REAL INVOICE.** A leftover value is worse
than a blank one, because a plausible address is never looked at twice.

1. **GATE 0 first.**
2. Reach the customer step and select **customer A — one WITH a full address.** Note every box.
3. Go **Back**, then forward again to the customer step, and select **customer B — one with NO
   address, or a different one.**

**PASS:** every box shows **B's** values. Any field B does not have is **EMPTY**.
**FAIL:** any of A's values is still on screen — especially City, State or ZIP.

⚠️ **State is included deliberately.** A blank form defaults to `TX` for a customer being typed in
from scratch; selecting a customer we HAVE ON FILE shows **their** state, even when that is blank.
Asserting `TX` about a customer whose state we never recorded is inventing a fact about them.

---

### CARD 18 — 🔴 THE REGISTER SAYS WHEN IT IS ONLY SHOWING YOU SOME
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #220
SIGNAL: an amber banner ABOVE the results reading "Showing 25 of N matches"

🔴 **THIS IS THE ONE DAVID NAMED AS THE WORRY, AND IT IS ABOUT THE PHONE CALL AFTER YOU LEAVE.** With
~1,900 customers a cashier searches `smith`, sees a full-looking list, decides the person is not
there, and creates a duplicate. The register now says so instead.

1. **GATE 0 first.**
2. At the register's customer step, search a term that matches **more than 25** customers — a single
   common letter or a very common surname will do.

**PASS:** an amber notice appears **above** the list reading *"Showing 25 of N matches"* with a real
N, and telling you to add a last name, phone or address to narrow it.
**FAIL:** exactly 25 rows and no notice.

⚠️ **If nothing you can type matches more than 25 customers, this card is NOT RUN — say so, do not
pass it.** ⚠️ **And the notice must NOT appear when the result is complete** (search something that
matches 2 or 3 people — no banner).

---

### CARD 19 — 🔴 THE SCAN DOOR AND THE REGISTER ARE NOW THE SAME SEARCH
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #220
SIGNAL: the scan screen's attach panel looks like the register's customer step — same box, same
result rows, same "Add a new customer" fallback

🔴 **THIS CARD REPLACES THE "NOT COVERED" NOTE THAT USED TO SIT AT THE BOTTOM OF THIS BOARD.** The
scan door used to match on first and last name ONLY — `hoa` found Cedar Park HOA there and Cedar Park
HOA **plus Diane Foster** on the roster.

1. **GATE 0 first.**
2. Open the **scan** screen and tap to attach a customer.
3. Search a term that appears in a customer's **CITY or ADDRESS and in no part of their name.**
4. Search the same term on `/customers`.

**PASS:** the same customers come back on both.
**FAIL:** the scan screen returns fewer.

5. **Then paste a phone number WITH parentheses** — `(512) 555-0101` — into the scan screen's search.
   **PASS:** it finds that customer. **FAIL:** an error, or nothing.
6. **Then attach a customer and check the strip:** for an ORGANIZATION customer it must show the
   **organization's** name, not the contact's.

⚠️ **PRESERVED AND WORTH CONFIRMING WHILE YOU ARE THERE:** the **"+ Add a new customer"** form on
that sheet, and its **"Discount for this order"** dropdown, must both still be there and still work.
The discount is order-scoped and must NOT appear at the register's customer step.
