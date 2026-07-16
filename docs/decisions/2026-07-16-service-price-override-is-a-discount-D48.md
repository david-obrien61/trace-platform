# D-48 (proposed) — A SERVICE PRICE OVERRIDE **IS A DISCOUNT**: the retail baseline is preserved and the concession rides the line's `discountAmt`

**Date:** 2026-07-16 · **Status:** proposed · **Ledger:** #131
**Type:** App code — 1 shared spine + 6 cultivar files. **ZERO migration** · **ZERO new api-fn (12/12)**
**Implements:** STD-012 (+ persistence clause) · STD-013 · STD-011 · STD-017 · D-9 · D-43 (its invariant)
**Bar:** BUILDER-COMPLETE — committed + PUSHED **`5f16c42`**; **DEPLOYED bar owed**, then owner-proof.
**New-code signals (check BEFORE testing — committed ≠ live):** `invariantOk` on every `[TRACE:PRICE]` line · `[TRACE:QBO] service price-override line (D-48)`. If the Placement line still logs `discountAmt: 0` or the push still 6070s, you are on a stale bundle — do NOT declare pass/fail (ledger #128/#129 scar).
**Supersedes:** the "leakage ≠ discount" modelling of a service override (D-39's service branch).

---

## THE SCAR (proven live 2026-07-16 — order CLV-20260716-1156, do NOT re-derive)

`[TRACE:PRICE]`, Placement Service line:

```
{ kind: 'service', name: 'Placement Service',
  retailUnit: 225, qty: 7, retailTotal: 1575,
  discountPct: 0, discountAmt: 0,
  netTotal: 1000 }          ← the owner's price override
```

**`retailTotal 1575 − discountAmt 0 ≠ netTotal 1000`. The line contradicted itself inside TRACE's
own model.** The override wrote `netTotal` and left `discountAmt` at zero, so the record said, in one
breath, both "this line is 7 × $225 with nothing off" and "this line costs $1000."

**QuickBooks was the first thing downstream that multiplied.** It received `UnitPrice 225 × Qty 7 =
1575`, saw `Amount 1000`, and REJECTED the invoice:

```
QB invoice push failed (400): {"Message":"Amount calculation incorrect in the request.",
 "Detail":"Amount is not equal to UnitPrice * Qty. Supplied value:1,000","code":"6070",
 "element":"Line.Amount"}
```

Reproduced on two pushes (16:57, 17:19). **The invoice does not exist in QBO.**

**Why nothing caught it earlier:** every TRACE surface rendered $1000 and reconciled cleanly
(Subtotal $2020 · Tax 7.6% $153.52 · Total $2173.52 — all arithmetically correct). The *totals* were
right. **No TRACE surface checks that a LINE is internally consistent** — every surface renders the
net and sums it, and a sum of nets is right regardless of whether each line's own arithmetic holds.
QBO checks. That is the whole lesson: the defect lived in a relationship *within* a line, and every
check we had looked at *aggregates across* lines.

## THE ROOT (the general form)

**An invariant that is only verified in a migration is not enforced.** D-43 SPECCED
`retail_total − discount_amt === net_total` and verified it in its migration's step (E) — which
passed **only because no override existed yet**. Nothing enforced it where lines are BORN
(`computeOrderPricing`), so the first override to arrive walked straight through the spec, through
persistence, through five surfaces, and into Intuit's validator.

## THE RULING (David — an override IS a discount; not re-litigated)

The UI already computed it: the editor renders **"Baseline $1575.00 · giving away $575.00"**. It
KNEW the override was a $575 concession — it just stored it as a bare overwrite of `netTotal`.
Express it as a discount and everything falls out:

```
retailUnit 225 · qty 7 · retailTotal 1575 · discountAmt 575 · discountPct 36.51 · netTotal 1000
```

No new machinery: D-43 already persists `discount_pct`/`discount_amt` per line, and the QBO push
already emits a negative-Amount discount line for the tier discount.

---

## THE DECISION

### 1. The override is expressed as the line's discount (`tierPricing.ts`)

The retail baseline (`retailUnit`/`qty`/`retailTotal`) is **PRESERVED** — which is what makes the
giveaway visible AND what lets QBO multiply rate × qty and agree. The concession lands in
`discountAmt`:

```
discountAmt = retailTotal − overriddenTotal        (1575 − 1000 = 575)
discountPct = round2(discountAmt / retailTotal × 100)   (36.51)   ← rounding convention, STATED
netTotal    = overriddenTotal                      (1000)
```

The tier still **never** touches a service line. A service's `discountAmt` is the OWNER's
concession; a goods line's is the CUSTOMER's tier discount.

### 2. The D-43 invariant is ENFORCED AT COMPUTE TIME, and THROWS

`retailTotal − discountAmt === netTotal` is asserted on **every** line inside `computeOrderPricing`,
with a half-cent tolerance (`round2` of a float difference leaves sub-cent dust:
`0.3 − round2(0.3 − 0.1) ≠ 0.1`). A violation **throws** — it cannot fire by construction, so it is
the guard against the NEXT branch that forgets. Throwing is correct: a self-contradictory money line
is a programming error, and refusing the order beats billing an incoherent one.

### 3. An UPWARD override is a NEGATIVE discount (a surcharge) — **ALLOWED**

Decided and stated per the build spec. **Allowed**, not refused, because:
- **Refusing would REGRESS an ability the owner has today** — the current code caps nothing, so an
  owner can already override upward and be charged more. It is also a legitimate act (a rocky site
  costing extra labour).
- It stays internally consistent: `1575 − (−425) = 2000`. The invariant holds unchanged.
- It pushes to QBO as a POSITIVE "price adjusted" line through the same mechanism, no branch.

`discountPct` is honest-negative (−26.98%), which is a real number with a real meaning, **not**
nonsense. No surface renders it as "% off": the display and the QBO description use neutral
**"price adjusted"** wording that reads correctly in both directions, and the CartReview note now
reads "charging extra $425.00" rather than the old `Math.max(0, …)` which silently rendered
**nothing** for a surcharge.

### 4. `discountTotal` is GOODS-ONLY — the structural finding the spec did not anticipate

**This was a live trap.** `discountTotal`'s contract already SAID "Σ discountAmt (goods only)" — but
it summed **every** line and merely got away with it *because services were hardcoded to
`discountAmt: 0`*. The moment a service override became a discount, the $575 would have leaked into
the roll-up that Review/Confirmation render as **"<tier> — N% off"** against `goodsRetailSubtotal` —
producing "Contractor tier 1 — 10% off −$714.60" on a customer whose tier discount was $139.60. Two
proven surfaces would have started lying, and the totals would still have summed correctly.

So: `discountTotal` = Σ **goods** `discountAmt` (its documented meaning, now its actual behaviour),
plus a NEW `serviceAdjustmentTotal` = Σ **service** `discountAmt`. **STD-011**: a tier discount and
an owner concession are two different facts — different authority (customer's tier vs owner's act),
different label, different audit trail (STD-013 reason). Collapsing them into one number is exactly
the "two representations of one fact" disease inverted: *one representation of two facts*.

### 5. A reason is REQUIRED (STD-013) — reuses D-40's exemption pattern

David applied a $575 giveaway with the reason **blank** and it went through; the field was a
**placeholder**, not a requirement. Now:
- **UI** — `saveEditor` blocks Apply without a reason, labelled `Reason *` with a surfaced error
  ("A reason is required to change this price — it goes on the invoice and the record"), not a
  silent no-op (§6 r15 / M2).
- **Server** — `submit.ts applyOverride` REFUSES a reasonless override, logs it, and charges the
  **BASELINE**. Same shape as D-40's reasonless-exemption refusal. The UI gate is defense-in-depth;
  **this** is the control.
- **Spine** — `computeOrderPricing` independently enforces it, so the two gates agree *by
  construction* rather than by convention, and the Review preview cannot diverge from the charge.
- **Refusal charges MORE, never less** — the money-safe direction.
- **NO MIGRATION**: `override_reason` already exists on `order_service_selections` AND `order_items`
  ([20260708_service_override_leakage.sql:27,36]) and is applied; submit already WROTE it. It was
  never *required*.

### 6. QBO gets a line that multiplies (FIX 2)

An overridden service pushes the service at its **RETAIL baseline** (`225 × 7 = 1575` — internally
consistent, so QBO accepts it) plus the concession on the **SAME** negative-Amount mechanism the tier
discount already uses, described as `"Placement Service — price adjusted (reason: loyal contractor)"`.
**STD-011:** the reduction-line construction was extracted to ONE `discountLine()` helper used by
BOTH the goods tier discount (D-43) and the service override — no forked second discount path.
**GATED** on an override applying, so a normal order pushes byte-identical to before (zero
regression — `unit_price_at_time × quantity === subtotal` holds for every non-overridden row, since
flat services store qty 1). A NEW reconcile check asserts the assembled lines **sum to the order
total** before pushing — so a discount line can never double-count against an already-netted line —
and REFUSES the push rather than sending an amount TRACE never charged.

### 7. QBO failures are reported honestly (FIX 4 — D-9)

The push hard-failed (400) and Confirmation rendered *"⏱ Invoice will sync to QuickBooks shortly —
Connect QuickBooks from the owner dashboard to enable automatic sync."* Wrong twice: QBO **was**
connected (it had created customer 84 seconds earlier), and nothing would **ever** sync. The cause
was structural — the type was `'success' | 'pending'`, so **there was no failed state to render**;
every failure fell into a bucket that promised a sync.

Now THREE honest states (`QbSyncStatus`): **`success`** · **`not_connected`** (503 only — the connect
prompt is right *here, and only here*) · **`failed`** (400/409/500/throw — say so, name the reason,
give the owner the action). Scoped by audience via `ownerView`: the owner sees the actual error and
what to do; the customer sees a true neutral state ("Order confirmed — invoice to follow. Your order
is saved. <Business> will send your invoice.") — no internals, and **no owner instruction**, which
the old copy was handing to customers on the public QR path.

---

## THE TEST THAT BLESSED THE BUG (recorded)

`tierPricing.test.ts` test 16 asserted, in as many words:

```ts
ok(p.lines[1].netTotal === 1000 && p.lines[1].discountAmt === 0,
   'override $1000 charged, discountAmt 0 (leakage ≠ discount)');
```

**The defect was tested IN and blessed** — that is why it survived a green suite. The suite asked
whether the override *replaced the charge* (it did) and never whether the LINE *still added up* (it
didn't). A test can only catch what it asserts. Test 16 is REWRITTEN to assert the invariant, with
that history recorded in the file so nobody re-derives it.

## STANDARDS

**STD-012** (the override runs through the ONE canonical computation — not a UI-side overwrite;
persisted breakdown is what every surface renders) · **STD-013** (reason required, gated, logged,
actor via `override_by`) · **STD-011** (ONE `discountLine()` construction; ONE reason mechanism
reusing D-40's shape; two facts kept in two representations) · **STD-017** (Review · Confirmation ·
order-detail · QBO all render the override + its reason) · **D-9** (a hard failure is reported as a
failure; historical overrides with no reason show the adjustment and omit the reason rather than
invent one) · **D-43** (its invariant, now enforced) · **AC-3** (business-scoped, unchanged).

## SURFACED, NOT SILENT

- **`CartReview` fed `overrideTotal` without `overrideReason`** — caught during the build. Under the
  new rule the Review preview would have REFUSED the override and shown $1575 while submit charged
  $1000: the exact Review-vs-submit divergence STD-012 exists to prevent, re-created by the fix for
  a different bug. Fixed in the same pass.
- **`apply_discount` is DECLARED but NOT the gate** (`actionPermissions.ts:55`) — the override rides
  `manage_orders` + the server owner/manager token gate, which its own comment documents as
  deliberate. STD-013's "grantable named permission" is satisfied in substance by `manage_orders`.
  NOT wired this pass: OWNER/MANAGER default to both, so wiring changes nothing observable for LAWNS
  today (zero value now), while changing *who may override* in the same commit that changes *what an
  override means* would make a failed owner-prove ambiguous between two causes (non-zero risk now).
  **Flagged for David** — §6 r10 surfaced divergence, already documented-with-reason.
- **Goods overrides don't exist yet** — `overrideTotal` is service-only by contract, the goods branch
  ignores it, `serviceOverrides` is keyed by *offering* id, `canOverride` reaches only `ServiceRow`.
  **So there is no stacking question today, and nothing was guessed.** The 20260708 migration
  schema-readied `order_items` for a future plant-line override; **when that is built it WILL be a
  stacking question** — the tier discount already occupies a goods line's `discountAmt`, so a goods
  line carrying BOTH a tier discount and an owner override needs a decision (stack? separate
  columns? override wins?). **David decides then; not guessed now.**

## SCOPE HELD

Money/tax/tier arithmetic otherwise UNTOUCHED — this fix **moves no money** (the scar order still
totals $2173.52 to the penny). `submit.ts handleUpdate` (roster edit) remains baseline-only and not
tier/basis-aware — the carried STD-016 gap from #107/#114, out of scope, unchanged.

## OPEN ITEM #4 — **cannot be confirmed; the referenced item does not appear to exist**

The build spec asked whether this closes "the long-running open item #4 territory
(placement/planting labor edit)." **Searched; no such #4 found.** Reporting what IS there rather
than claiming a close:

| Where a "#4" exists | What it actually is | Related? |
|---|---|---|
| `docs/tech-debt-log.md` #4 | *"Hardcoded nursery footer in PlantProfile.tsx line 108 — `LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336`"* — an AC-1 hardcode | **No** — unrelated |
| CLAUDE.md → Open Architecture Decisions | **has no #4** — the table runs 1, 2, 3, **5**, 6, 7… | n/a |
| "buildspec item 4" (cited in the D-45 handoff) | count-size-persist — **closed by D-45** | No |

The nearest real items are the two **unnumbered** CLAUDE.md §4 POST-DEMO entries — *"Settings page:
Lauren can set default install price at nursery level"* and *"Per-plant install price override on
plant detail page"*. **Neither is closed here**: those are about configuring a *default/stored*
install price, whereas this is an *order-time* override of a computed service charge. Different
surface, different fact.

**What this build closes, stated plainly:** the service **price**-override defect — the broken
invariant, the QBO 6070, the missing reason, and the dishonest failure report. It does **not** touch
the service **qty**-edit path (`serviceQuantities` / the "Adjust quantity" stepper), which is a
separate surface and remains as-is.

**For David:** if the "#4" you meant is a real item on a board I haven't found, point me at it and
I'll reconcile it — I'd rather leave it open than mark it closed on a guess.
