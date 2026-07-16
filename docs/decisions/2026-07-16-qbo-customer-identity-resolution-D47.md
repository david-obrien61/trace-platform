# D-47 (proposed) — QBO CUSTOMER IDENTITY RESOLUTION: the three-way rule

**Date:** 2026-07-16
**Status:** PROPOSED (confirm the DECISIONS.md head, then assign — D-46 is the current head)
**Bar:** BUILDER-COMPLETE · owner-proof owed
**Implements:** D-9 (applied to identity) · STD-011 · STD-013 · D-37 (money boundary) · STD-017
**Proposes:** **STD-019** — ✅ **ACTIVATED 2026-07-16** on David's explicit go (STANDARDS.md v2.4, ACTIVE roster + ENFORCEMENT table). See § THE ROOT LESSON.
**Closes:** tech-debt #53
**Scope:** ZERO migration · ZERO new api-fn (12/12 held) · app code only

---

## THE SCAR (proven live, not theorized)

TRACE customer **"TERRENCE OBRIEN"** / `david_obrien2016@outlook.com` was bound to QBO customer
**81 = "Andrew O'Brien"**. **NINE real invoices** in TRACE Enterprises' production QuickBooks
(2026-05-22 ×4, 05-23, 05-27, 05-29, 07-15) were ALL billed to Andrew O'Brien — sales that never
happened, to the wrong person, for **two months**.

**Why it was silent:** every TRACE surface showed the correct customer throughout. Review,
Confirmation, order-detail, the roster — all correct. The mis-billing existed ONLY in QuickBooks.
It surfaced only when David opened QuickBooks and read the name. No amount of testing TRACE's own
surfaces would ever have caught it — the defect lived at the boundary, in the one place TRACE
never looked back at.

### The mechanism

```
findOrCreateQBCustomer:
  select * from Customer where PrimaryEmailAddr = '<email>' MAXRESULTS 1  →  Customer[0]
```

1. **Match predicate was EMAIL ALONE.** `DisplayName` was not in the predicate. No name
   comparison happened before reusing the record.
2. **Selection was arbitrary.** `Customer[0]` — the first hit — is meaningless when several QBO
   customers share an email.
3. **No collision guard.** Two TRACE customers could adopt the same `qb_customer_id`.
4. **The link was STICKY.** Once `qb_customer_id` was stored, every later push SKIPPED
   find-or-create entirely and billed the stored id with **no re-verification**. The mis-link was
   made once, on invoice #1, and never questioned again for nine invoices.

---

## THE ROOT ASYMMETRY (the actual lesson)

> **QBO enforces `DisplayName` UNIQUE. QBO does NOT enforce unique email.**

TRACE matched on the ONE field QBO permits to collide, and ignored the ONE it guarantees.

Email is not an identity key in QuickBooks. **Families share an email** (this is literally the
case here — the O'Briens). **An office shares one across staff.** A contractor uses
`office@company.com` for every employee. Matching on email is matching on a field whose collisions
the external system explicitly allows.

This is not a QBO quirk to work around — it is the external system telling us which field carries
identity. We were reading the wrong column.

---

## THE SAFETY HIERARCHY (David's ruling — settled, do not re-litigate)

| Outcome | Cost |
|---|---|
| **Mis-billing the wrong customer** | **CATASTROPHIC** — money, trust, legal |
| **A duplicate QBO customer** | **ANNOYING** — and fixable in QuickBooks in 30 seconds |

**Therefore every ambiguous case resolves toward CREATE or SURFACE — never toward a guessed link.**

A false-negative (we create a duplicate for someone who already existed) costs a merge. A
false-positive (we link onto the wrong person) costs nine invoices billed to Andrew. The rule is
asymmetric because the consequences are asymmetric.

---

## THE DECISION — the three-way rule

**Two independent fields must CONCUR before TRACE binds an identity.**

| email match | name match | action |
|-------------|------------|--------------------------------------------------------|
| yes         | yes        | **LINK** — two independent fields concur, safe |
| no          | no         | **CREATE** — new party |
| **YES**     | **NO**     | **CREATE** — ← *the Terrence case. NEVER link.* |
| no          | YES        | **SURFACE** — could be a 2nd David Smith; the owner decides |

Plus two cases the table implies:

- **email→record A, name→record B** (different records) → **SURFACE**. Two signals pointing at two
  different records is the definition of ambiguity.
- **several records match BOTH** → **SURFACE**. QBO's unique-DisplayName should make this
  impossible; if it happens we do not pick one arbitrarily — that arbitrary pick *is* the scar.

### Both fields are queried, not just one

TRACE now issues **two** QBO queries and resolves against their **union**:
- `where PrimaryEmailAddr = '<email>'`
- `where DisplayName = '<name>'` ← the field QBO actually guarantees unique

Resolving against only one of them would reintroduce the single-field blindness that caused the scar.

### A stored link is a CACHE, not a fact

Before billing a stored `qb_customer_id`, TRACE **fetches that QBO customer and re-checks the name**.
Drift → **REFUSE the push** and flag loudly. Unreadable (deleted/merged) → REFUSE.

**This is the check that would have caught the Terrence bug on invoice #1 instead of #9.** The
sticky, never-re-verified link is what turned one bad match into two months of cross-billing.

### Ambiguity refuses the push (409, not 500)

A real ambiguity is not a server fault — it is a decision only the owner can make. The push returns
**409 `qb_customer_identity_conflict`** with owner-actionable prose ("QuickBooks already has X with
this name but a different email — correct it, or rename one, then push again"). Failing the push is
correct here: the order already exists and is unharmed; billing the wrong person is not recoverable
by comparison. (Note: §6 rule 6 "integration failure never blocks an order" governs *order
placement*, not the invoice push — the order is already placed and safe.)

### The email-as-DisplayName fallback is RETIRED

The old code, on any create failure, silently created a QBO customer named
`david_obrien2016@outlook.com`. That routed around a duplicate-name collision by manufacturing a
junk record and hiding the collision from the owner. Now an exact DisplayName collision (**QBO
error 6240**) SURFACES. QBO's name namespace spans customer/vendor/employee, so 6240 is also the
backstop for any collision the queries missed.

---

## WHAT WAS BUILT

| File | Change |
|---|---|
| `packages/shared/src/utils/personName.ts` | **NEW** — `personNameTokenSet` / `personNamesMatch`. Person-name canonical key. |
| `packages/shared/src/quickbooks/customerIdentity.ts` | **NEW** — `resolveQboCustomerMatch`, the ONE decision fn (pure, testable). |
| `packages/shared/src/quickbooks/customerIdentity.test.ts` | **NEW** — 22 assertions incl. the live Terrence/Andrew case. |
| `packages/cultivar-os/api/qbo/invoice/cultivar.ts` | Matcher replaced; stored-link verification; collision guard; 6240 surfacing; BillAddr from D-41; 409 on conflict. |
| `packages/shared/src/index.ts` | Barrel exports. |

**Separation:** the DECISION is pure and lives in `shared` (testable without QBO); the IO (queries,
create, write-back) stays in the cultivar endpoint. ONE resolution path (STD-011).

---

## ⚠️ A REASONED DIVERGENCE — the #61 resolver does NOT handle apostrophes

The build prompt assumed the #61 L4 token-set resolver (`canonicalName.nameTokenSet`) could be
reused for name comparison ("case-fold, strip punctuation/apostrophes"). **It cannot.** Verified
empirically 2026-07-16:

```
nameTokenSet("O'Brien") → {brien}    // apostrophe splits it, then the 1-char filter drops "o"
nameTokenSet("OBrien")  → {obrien}
⇒ "TERRENCE OBRIEN" vs "Terrence O'Brien" = NO MATCH
```

`nameTokenSet` treats every non-alphanumeric as a token **boundary** and drops 1-char tokens (to
kill the botanical hybrid marker `x`). That is **correct for plants and wrong for surnames**.

**Decision:** a separate `personName.ts` that **ELIDES** the intra-word apostrophe
(`O'Brien → obrien`) and **REUSES the one equality engine** (`tokenSetsEqual`). Rationale: "is this
the same PERSON?" and "is this the same PLANT?" are two different facts with two different
normalization rules — so this is a distinct function, not a duplicated one (STD-011 forbids two
representations of ONE fact; it does not force two different facts through one rule). Botanical
connectors (`var`/`ssp`/`subsp`/`cv`) are meaningless for people and are not applied.

**`nameTokenSet` was NOT modified** — the plant resolver is D-45/D-46 owner-proven territory and
changing its key is a separate, provable build.

### 🚩 FLAGGED — a REAL bug in the plant resolver, CONFIRMED IN LIVE DATA (tech-debt #55, not fixed)

The same apostrophe blind spot breaks **possessive** variety names at scan. **David confirmed
against live data: 4 of 6 apostrophe varieties are BROKEN** —

| Variety | slug tokens | catalog tokens | result |
|---|---|---|---|
| **Basham's Party Pink Crape Myrtle** | `{bashams,…}` | `{basham,…}` | ❌ false UNKNOWN |
| **Evey's Pride Mimosa** | `{eveys,…}` | `{evey,…}` | ❌ false UNKNOWN |
| **Summer's Tower Redbud** | `{summers,…}` | `{summer,…}` | ❌ false UNKNOWN |
| **Hearts A'fire Redbud** | `{afire,…}` | `{fire,…}` | ❌ false UNKNOWN |
| `'Sierra' Mexican Red Oak` | `{sierra,…}` | `{sierra,…}` | ✅ works |

**All four broken rows carry `variant_group` NULL and have never been counted.**

**Why it hid:** *wrapping quotes survive* (`'Sierra'` → `{sierra}` — the quotes sit at word
boundaries either way), so the cultivar-quote case, the one anybody eyeballs, works. **Possessives
don't:** the apostrophe splits the word and the 1-char filter then eats the orphaned `s`
(`Basham's` → `{basham}` vs slug `{bashams}`).

This is precisely the class `canonicalName` exists to fix (the LAWNS false-UNKNOWN). The fix is the
same **elide-don't-split** rule `personName.ts` just proved. **Not fixed here** — the plant resolver
is D-45/D-46 **owner-proven** territory; re-keying it changes live scan behavior and needs its own
provable build (red-test the four varieties first per STD-002), not a drive-by. → **tech-debt #55**.

---

## Standards / constraints held

- **D-9 applied to IDENTITY** — never guess a person. Ambiguity → CREATE or SURFACE. An **empty
  name never matches** (two blanks both reduce to the empty set, and set-equality would call that a
  match — absence is not agreement).
- **STD-011** — ONE resolution path (`resolveQboCustomerMatch`); reuses `tokenSetsEqual`.
- **STD-013** — the push refusal is logged with the actor/record via `[TRACE:QBO]`.
- **D-37** — QBO owns the invoice/customer record; TRACE originates. Unchanged.
- **STD-017** — the fix is on the REAL push (`invoice/cultivar.ts`), not a preview. The DemoQBInvoice
  preview surface renders order data and does not resolve customer identity → not a surface of this
  capability.
- **AC-3** — the collision guard and all reads are `business_id`-scoped.
- **§6 r11** — ZERO new api-fn (12/12 held).
- **BENCH-C (PII)** — `[TRACE:QBO]` logs names/emails. **This is pre-existing behavior in this
  file** (the 97606e8 trail already logged them) and it is the operator-only Vercel function log,
  not a customer surface. **Flagged, not silently widened** — see § Follow-ups.

---

## THE ROOT LESSON → **STD-019** (✅ ACTIVATED 2026-07-16, David's go — STANDARDS.md v2.4)

> **EXTERNAL IDENTITY RESOLVES ON THE FIELD THE EXTERNAL SYSTEM GUARANTEES UNIQUE; AMBIGUITY NEVER
> AUTO-LINKS; A STORED LINK IS A CACHE, NOT A FACT.**

Three clauses, all earned by this scar:

1. **Match on the guaranteed-unique field.** Identify what the external system enforces unique
   (QBO: `DisplayName`) versus what it permits to collide (QBO: email). Never key identity on a
   field the external system allows to collide.
2. **Two independent fields must concur before binding.** One matching field is a hint, not an
   identity. Ambiguity resolves to CREATE or SURFACE — never a guessed link. (Asymmetric-cost rule:
   a duplicate is fixable; a mis-bind is catastrophic.)
3. **Verify a stored external link before acting on it.** A cached foreign id must be re-checked
   against the external record, not trusted forever. A sticky unverified link turns one bad match
   into an unbounded run of them.

**Why a new STD and not a clause:** STD-011 governs ONE canonical representation of an INTERNAL
fact; STD-007 governs derived connection STATE (is the token alive), not identity binding. Neither
covers "which field of an external system carries identity, and what to do when it's ambiguous."
This is genuinely new territory, it has a named dated scar (nine invoices, two months), a rule that
would have caught it (name verification on push #1), and a defined scope.

**✅ ACTIVATED 2026-07-16** on David's explicit go — STANDARDS.md **v2.4**, ACTIVE roster
(STD-001…STD-019) + ENFORCEMENT table row + CHANGELOG. Full rule text lives in STANDARDS.md; this
doc is its scar record.

**Note recorded during activation:** STD-018's CHANGELOG row was **missing** (the header read v2.3
while the changelog stopped at 2.2 — STD-017). Backfilled as row 2.3 in the same pass, so the
version history is contiguous again.

**Scope:** every build that binds a TRACE record to an external system's record — QBO
customers/items/accounts, a payment processor's customer (BENCH-A territory), a supplier catalog,
any future connector. **Fires on the first bind, not at volume.**

---

## REMEDIATION (David applies — gated, NOT auto-run)

**Blast radius: ZERO rows.** Confirmed by a read-only probe against live Supabase, 2026-07-16:

```
customers WITH a qb_customer_id: 0
qb_customer_id collisions:       none
TRACE customers sharing an email: 0   (16 customers total)
TERRENCE OBRIEN (dd7e2201…):     qb_customer_id = NULL  ← David cleared it 2026-07-15
```

Nothing to remediate in the platform. Inspect any future links with:

```sql
SELECT id, first_name, last_name, email, qb_customer_id FROM customers
 WHERE business_id = '<BID>' AND qb_customer_id IS NOT NULL;
```

**Why clearing the link now WORKS (and did not before):** under the OLD logic, clearing
`qb_customer_id` just regenerated the same bad link on the next push — the email still hit Andrew
and the name was still ignored. **That trap is what this fix removes.** Terrence now re-resolves
CORRECTLY: email hits Andrew (81) → name disagrees → **CREATE** a new "TERRENCE OBRIEN".

**David's own bookkeeping (NOT a platform action):** nine invoices in TRACE Enterprises' real QBO
are billed to Andrew O'Brien for sales that never happened. **His call whether to void them.**

---

## Follow-ups NAMED (not built)

- **(a) Race-proof collision guard → tech-debt #54.** The guard is a read-then-write check (TOCTOU) —
  proportionate at a single-owner nursery's push volume, not race-proof. The durable form is a
  partial unique index `UNIQUE (business_id, qb_customer_id) WHERE qb_customer_id IS NOT NULL`,
  which the DB enforces atomically. That is a **migration**; this build was scoped migration-free and
  the blast radius is zero, so it is recorded rather than taken. **Needed before real billing volume.**
- **(b) The plant-resolver apostrophe bug → tech-debt #55** — CONFIRMED in live data, 4 of 6
  apostrophe varieties broken (see above). 🔴 it silently breaks real scans today.
- **(c) BENCH-C review of `[TRACE:QBO]` PII.** Names/emails in operator logs — pre-existing, now
  more prominent. Worth a deliberate call on masking before the trail is made permanent.
- **(d) Dead readback code.** `pullQBOCustomers` (`packages/shared/src/quickbooks/customer.ts`) +
  `ExternalBridge.qbo.pullCustomers` + `QuickBooksConnector.jsx` are orphaned Railway-era code
  calling a deleted endpoint. The 2026-06-01 QBO audit already recommends DELETE. Out of scope.
- **(e) A QBO customer readback** would let the owner import existing QBO customers and link them
  deliberately, rather than resolving at push time. See § THE READBACK QUESTION below.

---

## THE READBACK QUESTION (asked at recon; answered NO)

The recon asked whether a QBO customer readback already imports and links customers — because if it
did, the push would only ever need to CREATE, and match-at-push-time would be **redundant machinery
whose only function is to cause this bug**. That would have made the answer "delete the matcher,"
which beats "fix the matcher."

**Answer: no readback exists.** Nothing reads QBO customers into TRACE's `customers` table. The
only `select * from Customer` in live code is the push path itself. The three artifacts that look
like a readback are all dead (see follow-up (d)), and even in their working state they merged into
localStorage and never wrote `qb_customer_id`.

**Therefore the matcher is load-bearing and must be fixed, not deleted.** Without it, a TRACE
customer whose party already exists in QBO (the normal case — LAWNS has QBO customers predating
TRACE) would hit duplicate-DisplayName **6240 on every push**. The three-way rule is the right
build.
