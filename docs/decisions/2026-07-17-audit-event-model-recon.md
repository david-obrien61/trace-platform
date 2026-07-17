# RECON — The Event Model: Which Discretionary Choices Capture What Today

**Type:** Read-only recon (LOOK, don't build). Zero code, zero schema, zero migration touched.
**Date:** 2026-07-17
**For:** David (ruling) · Lightning (render/spec)
**Companion to:** `docs/decisions/2026-07-17-audit-writer-gate-recon.md` (the empty-vault + gate recon) *(both relocated here 2026-07-17 from `data/grower-scan/` per David's ruling — the audit-vault recon trio belongs beside `2026-07-17-inventory-reconcile-confidence-recon.md` where the decision will mint; the `audit-spine-recon.md` sibling stays in `data/grower-scan/`)*
**Sibling of:** `data/grower-scan/audit-spine-recon.md` (the recon that birthed `audit_log`)
**Three-lens gate (OP-8 / §9 gate 10):** satisfied — HAVE / NEED / WANT + the one open fork, not pre-collapsed.

---

## WHY THIS EXISTS

Two independent reads (Thunder + Lightning) converged on the same three-layer model. Lightning closed
with five open questions about which discretionary levers capture an actor / reason / history today.
This doc answers all five **from the code**, then states the synthesis. Every claim carries `file:line`.

---

## THE MODEL BOTH READS AGREE ON — three layers, one failure mode

The failure mode is making one layer do all three jobs.

| Layer | Question it answers | Right shape | Our state |
|---|---|---|---|
| **1 — Authority audit** | who exercised power | append-only, immutable, `detail jsonb` | `audit_log` — built, **empty** (0 writers, 23 days) |
| **2 — Transactional fact** | how much, on what, why | columns on the record, joinable, **summable** | `override_by`/`override_reason` — partly built |
| **3 — Row history** | what did this value used to be | history table + trigger | **doesn't exist** |

Two guiding sentences from the reads:
- **"Leakage is a fact, not a log entry."** You don't want to *find* who/how-much/why — you want to
  **sum** it (per rep, per customer, per month). `detail jsonb` in an append-only log is the wrong shape
  for that report; columns on the order line are the right one. (Layer 2, not Layer 1.)
- **"Reason is the one field that cannot be derived, backfilled, or inferred — it exists only if you ask
  at the moment of the choice."** That is `user_stories.md:151`: *captured, not just applied.*

The gate that beats a checklist: **log where a human made a choice the system couldn't make for them —
discretion, not every mutation.** A count is an observation; a price override is a choice; a tier
promote is a choice; a desk qty edit is a choice.

---

## LIGHTNING'S FIVE OPEN QUESTIONS — ANSWERED FROM THE CODE

### Q1 — Does the plant/goods price override capture an actor like services do?
**There is no plant-price override to capture.** The D-48 override+reason machinery is **services-only** —
`applyOverride` (`submit.ts:460`) applies to the *planting offering* (a service) and writes to
`order_service_selections`. Goods lines (`submit.ts:645-654`) carry `unit_price` = the **server-authoritative
tiered sell_price** plus `retail_unit`/`discount_amt` (a *tier* discount, D-43). There is **no per-line
hand-override path for plants.** So goods discretion does not live on an override at all — it lives in two
*other* places that capture nothing: **which tier the customer sits in (Q3)** and **the catalog `sell_price`
desk-edit (the hole below).**

### Q2 — Does the D-42 order-edit-after-placement path capture an actor?
**No.** The edit branch (`submit.ts:871+`) is permission-*gated* (`callerHoldsPermission`), but
`resolveCallerUid` is called **only** on the override/exempt paths, never on the plain edit. The edit
recomputes pricing, re-adjusts qty via `adjustLotQty` (persists nothing durable — an RPC + a `[TRACE]`
console line), and updates `order_items` quantity/unit_price/subtotal (`submit.ts:1021`). **Who edited,
and the qty/total before, are recorded nowhere durable.** An order can be materially changed after
placement with zero provenance.

### Q3 — Does D-38 contractor tier promote/demote capture anything?
**Nothing.** `CustomerPartyEditor.tsx:392` — a dropdown `onChange` → `commitPatch({ price_tier })`, a
**client-direct update** of `customers.price_tier`. No actor, no reason, no prior value. Moving a
customer retail→contractor — a pure discretionary money decision, manual by design (D-38) — writes only
the new string. **This is the single cleanest "discretion, zero record" on the platform** — worse than
leakage, which at least has the data.

### Q4 — Does anything write a `reason` today?
**Yes — and it is an established, ENFORCED pattern, twice.** (The most important finding for the "capture
reason at the moment" argument — it is not aspirational, it is shipped.)
- `override_reason` (services, D-48, `20260708_service_override_leakage.sql:27`) — **required** at
  `submit.ts:509` ("its REQUIRED overrideReason").
- `tax_exempt_reason` (customers + orders, `20260713_customers_tax_exemption.sql:21` / `20260713_orders_tax_exemption.sql:46`)
  — migration text: **"Zeroing tax REQUIRES a recorded reason — enforced."**

Both use the identical idiom: nullable `text`, **NO CHECK** (reason-set grows as data, AC-4), **required at
the moment of the discretionary act.** What is missing is extending that same idiom to the levers with no
reason today: **tier change (Q3), desk qty/price edit (the hole), order edit (Q2).**

### Q5 — Can a history table + trigger coexist with the ratified client-INSERT model, or is it O-C in disguise?
**It coexists, and the codebase already proves the mechanism.** `20260623_role_definitions_and_self_grant_fix.sql:67`
is a `BEFORE UPDATE` trigger that reads **both `OLD` vs `NEW`** (lines 67-68) **and `auth.uid()`** (line 81).
Triggers that see old/new **and** the actor are already a working pattern here.

That dissolves the closing fear (a trigger-history = O-C, server-authored, overturning the ratified
client-INSERT decision by accident). It **does not** — because it is a *separate table for a separate job*:

| | `audit_log` | `*_history` (new) |
|---|---|---|
| Job | authority events | data-change trail |
| Author | client-INSERT (**ratified, untouched**) + server-INSERT from `submit.ts` for money events | trigger, server-authored **by construction** |
| Captures | who/what/when/outcome, at chosen call sites | OLD→NEW + `auth.uid()` + timestamp, **on every UPDATE, un-forgettable** |

The ratification was scoped to `audit_log`'s author model — it **only reopens if you make `audit_log`
itself trigger-authored.** A separate history table on its own trigger moves no ratified decision. And the
trigger is exactly the **"impossible to ship a mutation that doesn't log"** answer from the first recon:
it fires by construction, not by memory.

---

## WHAT WE ALREADY CAPTURE vs NOT — the grounded split

| Event | who | when | how much | old→new | why (reason) | durable + immutable? |
|---|---|---|---|---|---|---|
| **Service price override (leakage)** | ✅ `override_by` (server-resolved, `submit.ts:200`) | ✅ `created_at` | ✅ `price_leakage` | ✅ `original_price` | ✅ `override_reason` (required) | ⚠️ **mutable** row; scattered; not a summable trail |
| **Tax exemption** | ✅ `exemptBy` | ✅ | n/a | n/a | ✅ `tax_exempt_reason` (required) | ⚠️ mutable |
| **Inventory count (the walk)** | ✅ `counted_by` (session, `…sessions:5`) | ✅ `counted_at` | ✅ `counted_qty` | ❌ no prior qty | n/a (observation) | ✅ append-only `inventory_counts` |
| **Desk qty/price/cost edit** | ❌ none | ⚠️ `updated_at` only | ❌ | ❌ | ❌ | ❌ **nothing but a timestamp** (`inventoryEdit.ts:56`) |
| **Order edit after placement (D-42)** | ❌ none | ⚠️ | recomputed | ❌ | ❌ | ❌ nothing durable |
| **Tier promote/demote (D-38)** | ❌ none | ⚠️ | n/a | ❌ | ❌ | ❌ **nothing** (`CustomerPartyEditor.tsx:392`) |
| **Role / member / tile** | — | — | — | — | — | ❌ the 8 unwired writers (ledger #19B) |

**The pattern:** the **walk has provenance; the desk does not.** The surface where a number can be quietly
changed — at a desk, alone, no session, no scan — is the one with no record. That is the hole the leakage
instinct is actually pointing at.

---

## THE SYNTHESIS — clean division of labor, both halves already proven in-repo

The trigger and the reason-field split the work perfectly:

- **Who / when / old→new → a trigger, by construction.** Un-forgettable, server-authored, captures the
  actor. Proven feasible by the role self-grant trigger (`20260623:67`). This is the gate: a
  qty/cost/tier/price change *cannot* commit without its history row.
- **Why → the app, required at the moment.** A trigger can't see intent — `reason` only exists if you ask
  when the choice is made. Proven by `override_reason` + `tax_exempt_reason`, both required-enforced.

So the build is **not** "invent an audit system." It is **two established patterns pointed at the three
levers that capture nothing today** — tier change, desk edit, order edit — plus a one-line `price.overridden`
event so the *already-captured* leakage data becomes queryable and immutable.

### Homes for the two example events
- **Leakage discount** — data is fully captured on `order_service_selections` (migration-backed since
  `20260708`). Missing piece is a **Layer-1 event** (`price.overridden`, actor already server-resolved) so
  it is summable + immutable, emitted where `[TRACE:LEAKAGE]` already fires (`submit.ts:443`). **No
  migration** — the `audit_log` action vocab is convention, not CHECK.
- **Inventory update** — needs **Layer 3**. Minimum: `updated_by` + prior value on the write (cheap, but
  only ever holds the *last* toucher — useless for "Lauren said 33, Andrew said 30"). Right shape:
  **an append-only history/ledger via trigger** (before/after, every change). The four causes need the second.

### The insight worth stopping on
For inventory, **the audit trail and the reconcile source-of-truth are the same structure.** If
`on_hand = sum(deltas)`, a qty ledger is simultaneously (a) who-changed-what-when and (b) the derivable,
reconcilable on-hand — the exact currency/confidence problem the #137 reconcile recon was circling. Build
the audit answer and the reconcile answer as **one ledger**, not two features. Highest-leverage item here.

---

## THE ONE OPEN FORK (not pre-collapsed — David's ruling)

**One table or two for Layer 3?** Fold data-change history into the `audit_log` envelope
(`action='inventory.qty_changed'`, `detail={old,new,source}`) — one store, one reader, one gate — **vs** a
purpose-built history/ledger table beside it.

**Lean (both reads agree):** authority events + the leakage event + deletes → `audit_log` now (Layer 1,
low-volume, the spine was designed for it, no migration for new actions). Inventory → its **own** append-only
history/ledger (Layer 3), because it doubles as the reconcile source-of-truth and its volume/retention
profile is nothing like rare governance events. The cheaper path is one envelope for everything; the
tradeoff is mixing high-volume data churn into the immutable-forever spine.

---

## FLAGGED FOR DAVID (named, NOT built)

1. **Three discretionary levers capture nothing today** — tier promote/demote (D-38), desk qty/price/cost
   edit, order-edit-after-placement (D-42). These are the build targets; the patterns to point at them
   (trigger + required reason) already exist.
2. **The reason idiom is proven twice** (`override_reason`, `tax_exempt_reason`) — extend it, don't invent it.
3. **Leakage data is captured but on a MUTABLE row** (`order_service_selections`, owner RLS allows UPDATE)
   — small integrity gap; the Layer-1 event makes it immutable+summable.
4. **Q5 resolved:** a trigger-authored history table does **not** overturn the ratified client-INSERT
   `audit_log` model — separate table, separate job; the trigger mechanism is already proven in-repo.

**No decision number proposed** (per doctrine — if David rules the fork, that is where a decision mints).
**No owner-prove owed** (a document has no live surface to drive).

---

## EVIDENCE INDEX (every claim → file:line)

| Claim | Source |
|---|---|
| Service override is D-48, services-only, writes `order_service_selections` | `submit.ts:460,509,514`; `20260708_service_override_leakage.sql:23-27` |
| Goods lines carry tiered `unit_price` + `retail_unit`/`discount_amt`, no override path | `submit.ts:645-654` (D-43) |
| Order-edit path permission-gated but no `resolveCallerUid` / no durable actor | `submit.ts:871+,975-978,1021`; actor only at `:200,:262` |
| Tier change = client-direct patch, no actor/reason/history | `CustomerPartyEditor.tsx:392` |
| `override_reason` required | `submit.ts:509`; `20260708…:27,36` |
| `tax_exempt_reason` required-enforced, NO CHECK | `20260713_customers_tax_exemption.sql:15,21,31`; `20260713_orders_tax_exemption.sql:35,46` |
| Trigger reads OLD/NEW + auth.uid() (mechanism proven) | `20260623_role_definitions_and_self_grant_fix.sql:67-68,81` |
| `business_inventory` has only `updated_at`, generic trigger, no `updated_by` | `20260612_business_assets_inventory_pmi_service.sql:13,52-55` |
| Desk edit writes straight to `business_inventory` | `inventoryEdit.ts:56,76,112` |
| `inventory_counts` = append-only walk log; `counted_by` on the session | `20260626_inventory_count_sessions.sql:5 (session), :66 (counts)` |
| `audit_log` built, empty, PART-B writers unwired | `docs/CLOSE-OUT-LEDGER.md:70-71`; `20260623_audit_log_spine.sql` |
| Leakage actor server-resolved | `submit.ts:200` (`resolveCallerUid`) |
| `[TRACE:LEAKAGE]` = console DEBUG at the override site | `submit.ts:443` |
