# RECON — The Audit Vault Has No Writers, and No Gate Requires One

**Type:** Read-only recon (LOOK, don't build). Zero code, zero schema, zero migration touched.
**Date:** 2026-07-17
**For:** David (ruling) · Lightning (render/spec)
**Sibling of:** `data/grower-scan/audit-spine-recon.md` (the recon that birthed the table)
**Rank:** David placed this ABOVE O1 (the sellable-predicate / reconcile grid work).
**Three-lens gate (OP-8 / §9 gate 10):** satisfied below — HAVE / NEED / WANT + OPTIONS spanning NEED→WANT, no pre-collapsed recommendation.

---

## THE NUMBER, IN FRONT OF THE RULING

`audit_log` landed **2026-06-23** (`868e78c`, "PART A GATED") and was owner-proven **2026-06-24**
(`ea70f98`, ledger #19 — 9/9 catalog verification + both immutability halves proven).

**Today is 2026-07-17. The table is 23 days old and has never received an application-authored row —
because no writer was ever built.** PART A shipped the *vault*; the first writer was split out as
**PART B and never started.**

The receipt is in our own ledger — `docs/CLOSE-OUT-LEDGER.md:71`, row **19B**:
> "Wire deleteTenantRole/console factory-reset to emit a role.factory_reset audit row… **UNBLOCKED — NOT STARTED** (spine #19 OWNER-PROVEN 2026-06-24)."

Unbuilt for 23 days.

---

## THE FOUR QUESTIONS, ANSWERED (all cited)

### 1. Does any write site call an audit writer? Is there a `logAudit`/`writeAudit` in shared, or was the migration the whole delivery?

**The migration was the whole delivery.**
- `packages/shared` grep for `logAudit|writeAudit|auditLog|insertAudit|recordAudit` → **ZERO hits.**
- All of `packages/` + `api/` grep for `.from('audit_log')` / any insert → **ZERO** (only matches:
  Ignition's unrelated `admin_audit_log` **localStorage** key at `packages/ignition-os/DataBridge.js:859`
  — different vertical, different mechanism — plus minified-bundle noise).
- Grep for the spine's own vocabulary strings (`role.factory_reset`, `cost.applied`, `tile.activated`,
  `member.role_changed`, …) across app code → **ZERO.**

There is no primitive and no call site. The birth recon (`audit-spine-recon.md:76`) had already
enumerated a **"redirect list" of ~8 governance writers** that "record nothing durable." None wired.

### 2. What does `[TRACE:LEAKAGE]` do with the payload — actor resolved server-side or client-only?

**`[TRACE:LEAKAGE]` has nothing to do with the audit table.** It is a `console.log` in
`packages/cultivar-os/api/orders/submit.ts:443` about price-override attribution — ephemeral DEBUG,
the class explicitly ruled "never redirect to the audit spine" (`audit-spine-recon.md:29`).

The useful part: **the actor IS resolved server-side** — `overrideBy = await resolveCallerUid(authHeader)`
at `submit.ts:200` (and `exemptBy` at `:262`). That server-resolved uid is written to
`order_service_selections.override_by`, **NOT** to `audit_log`. So **the server-side actor-resolution
machinery a server-authored audit would need already exists and is proven** — it is simply not pointed
at the spine.

### 3. RLS on `audit_log` — can a client insert, or server-write-only with no server path?

**A client CAN insert. By deliberate design** ("AUTHOR MODEL: client-side INSERT," migration lines 36–42).
- `audit_insert` policy (`20260623_audit_log_spine.sql:122`) lets `authenticated` append a row **to their
  own business, pinned to `actor_user_id = auth.uid()`** — a member can append but never forge another
  actor, and never rewrite (no UPDATE/DELETE policy + immutability trigger + REVOKE = triple immutability).
- Chosen *over* service-key-only as "compliance-grade overkill" for now; designed to harden to
  server-authored later "WITHOUT reshaping the envelope."

So it is the opposite of the third guess: not server-only-with-no-path — it is **client-writable, and
no client path was built either.** The vault is immutable, correct, catalog-proven, and **empty.**

---

## THE GATE QUESTION — THE REAL FORK

**Why there was no gate:** the close-out protocol has gates for built-inventory, close-out ledger,
owner-tests, STD-003, and three-lens recon — but **none says "a mutation to a governed surface must also
write `audit_log`."** PART A satisfied every existing gate (schema-verified, owner-proven, ledgered)
while delivering a store with no producers, and nothing flagged that as incomplete. This is exactly the
class named: the system relies on *remember to log*, and nobody remembered for 23 days.

### ⚠️ Correction that changes the gate's SIZE (decide this first)

The spine's controlled vocabulary is **governance / identity / authority**:
`role.*`, `member.*`, `permission.self_elevation_denied`, `cost.*`, `tile.*`, `ownership.transferred`,
`document.signed` (`20260623_audit_log_spine.sql:82-89`).

The write-site list in the prompt — `business_inventory`, `orders`, `order_items`, `inventory_counts`,
`customers`, pricing overrides — is **broader than what the spine was designed to record.** The spine is
a *who-exercised-authority* log, **not** a *what-data-changed* log. "Every mutation logs" is a real,
defensible target, but it is a **bigger thing** than PART B — it sets whether the gate covers **~8 writers
or ~every table.** Decide which log is being gated before sizing anything.

### Three lenses

| Lens | State |
|---|---|
| **HAVE** | Immutable append-only vault, owner-proven, **0 rows, 0 writers, 0 gate.** Server-side actor resolution proven in one place (`resolveCallerUid`, `submit.ts:200`) but pointed at `order_service_selections`, not the spine. |
| **NEED** (irreducible) | Governed actions leave a durable actor·action·target·outcome row that cannot be omitted by forgetting. |
| **WANT** (clean end-state) | A mutation to a governed surface is *physically incapable* of committing without its audit row — one transaction, enforced below the app. |

### Options — NEED→WANT (David's ruling; NOT pre-collapsed)

- **O-A — checklist gate (cheapest).** Add a §1.6 pre-flight item: *build touches a governed action → it
  emits an audit row.* Human/AI-enforced like the other 11. **Still "remember to log" wearing a gate's
  clothes** — proportionate only if that is accepted.

- **O-B — shared `writeAudit()` primitive + a `verify-universals` rule** that fails the build when a known
  governed write path lacks a `writeAudit` call (the same machinery that already ratchets quality).
  Enforce-by-test: near-by-construction, no DB reshape, fits the ratified **client-INSERT** author model.
  Wires PART B's ~8 writers behind ONE primitive so they cannot drift.

- **O-C — by-construction, true AC-4.** Route governed mutations through `SECURITY DEFINER` RPCs (or table
  triggers) that write the audit row *in the same transaction* as the mutation → a mutation literally
  cannot exist without its row. **BUT this reopens the ratified author-trust decision**: it makes the write
  **server-authored**, contradicting the client-INSERT model the spine was built around, and it is a large
  reshape. It does **not** hit the 12-fn ceiling (DB-side, not new `api/` files) — a point in its favor.

**The tension worth the eye:** O-C is the *only* option that makes "ship a mutation that doesn't log"
actually impossible — and it is the one that overturns a decision already ratified (client-INSERT). O-B is
the honest middle: enforced hard enough not to rot, without reopening authorship.

---

## BLOCKED (no local service key — same wall D-49 / #137 hit)

- **Exact current row count.** Cannot confirm whether the owner-proof `role.factory_reset` test row still
  sits there (DELETE *raises*, so it could not be removed) or was cleared by the person-spine cascade wipe
  (`scripts/wipe-for-person-spine.sql` truncates `audit_log` via CASCADE — `docs/built-inventory.md:623`).
  Either way, **app-authored rows = 0** for the table's whole life; the exact integer needs a live read.
- **Live RLS state today.** HIGH-confidence-not-blocked: the (A)–(I) catalog set was run live at
  owner-proof 2026-06-24 (9/9). Asserted from that proof, not re-read now.

---

## FLAGGED FOR DAVID (named, NOT built)

1. **Which log are you gating?** authority-only (~8 writers, PART B as scoped) vs every-mutation (much
   larger). Sets everything downstream — a decision, not a detail.
2. **O-C reopens the client-INSERT author-trust ruling.** If by-construction is wanted, that means
   choosing server-authored — say so explicitly so it is a decision, not a drift.
3. **The 23-day empty vault is itself the argument** for whatever gate is chosen: PART A cleared every gate
   we have and still shipped a store nobody feeds.

**No decision number proposed** (per doctrine — if David rules an option in, that is where a decision
mints). **No owner-prove owed** (a document has no live surface to drive).

---

## EVIDENCE INDEX (every claim → file:line)

| Claim | Source |
|---|---|
| Table added 2026-06-23; owner-proven 2026-06-24 | `git log --diff-filter=A` → `868e78c`, `ea70f98` |
| PART B first writer UNBLOCKED — NOT STARTED | `docs/CLOSE-OUT-LEDGER.md:71` (row 19B) |
| No writer in shared / app code | grep `packages/shared` + `packages/` + `api/` → 0 |
| ~8 governance writers record nothing durable | `data/grower-scan/audit-spine-recon.md:76` |
| Client-INSERT author model, deliberate | `supabase/migrations/20260623_audit_log_spine.sql:36-42` |
| `audit_insert` RLS — authenticated, own business, own actor | `…spine.sql:122-130` |
| Triple immutability (no UPDATE/DELETE policy + trigger + REVOKE) | `…spine.sql:140-171` |
| Controlled vocabulary = governance/authority only | `…spine.sql:82-89` |
| `[TRACE:LEAKAGE]` = console DEBUG, never redirect to spine | `submit.ts:443`; `audit-spine-recon.md:29` |
| Actor resolved server-side via `resolveCallerUid` | `packages/cultivar-os/api/orders/submit.ts:200,262` |
| …but written to `order_service_selections.override_by`, not audit_log | `submit.ts:493` |
| Cascade wipe truncates audit_log | `docs/built-inventory.md:623`; `scripts/wipe-for-person-spine.sql:31` |
