# Customer / Party record → standard entity-completeness (2026-07-13)

**Proposed decision id:** D-41 (confirm the DECISIONS.md head is D-40 before assigning).
**Type:** schema + UI (ONE additive migration + grouped editor). Implements the party-model /
STD-015 line — this is entity-completeness, not a feature.
**Ledger:** row #118. **Migration:** `supabase/migrations/20260713_customers_party_record.sql` (gated).

---

## Why

`customers` had been growing REACTIVELY — one column at a time, each time a build hit a wall
(`customer_type` 20260702 when the OCR name-split broke on orgs; the `tax_exempt` trio 20260713 for
D-40). Each reactive ADD is a session, a gated migration, and a UI retrofit. This pass brings
`customers` to the complete industry-standard **party/customer record** in ONE migration so fields
stop being bolted on one at a time. It also closes the D-40 owner-prove blocker: with `tax_id` +
`tax_exempt_expires` present and a grouped editor built, the tax-exemption set became UI-editable
(it was settable only via SQL before).

## The diff — standard party record vs. prior columns

| Group | Prior (had) | ADDED this pass |
|---|---|---|
| Identity | first_name, last_name, customer_type, person_id | **organization_name, display_name** |
| Contact | email, phone | — |
| Address | address_line1/city/state/zip (unprefixed) | **billing_line1/line2/city/state/zip** |
| Tax | tax_exempt, tax_exempt_reason, tax_exempt_cert_ref (D-40) | **tax_id, tax_exempt_expires, tax_exempt_cert_doc_url (slot)** |
| Commercial | price_tier | **payment_terms, credit_limit** |
| Lifecycle | source, qb_customer_id, lifetime_value, created_at | **status, updated_at (+trigger), notes** |

15 new columns, all additive, all nullable or safely-defaulted, ZERO data destruction.

## Decisions made

1. **ADDRESS = L1 (billing columns, not a table).** A customer has ONE billing address → stable
   COLUMNS. **Shipping is NOT a customer attribute** — a customer does not "have a shipping
   address"; an ORDER does. Ship-to is entered per-order and snapshotted onto the `deliveries` row
   (which already carries its own address_line1/city/state/zip — 20260620). NO `shipping_*` columns
   on customers. The saved multi-site ship-to address book (a `customer_addresses` table an
   order-time picker reads) is the **L2 hook — deferred, not built**. L1→L2 is additive.
   - Evidence: the OCR invoice path already extracts a bill-to AND a ship-to (`billLine1`/`shipLine1`,
     ReceiptKeeper.tsx) and collapses them into the single unprefixed address today; the many-site
     need is already served at the transaction layer by per-delivery snapshots.
   - The existing unprefixed `address_line1/city/state/zip` are LEFT UNTOUCHED (a later cleanup
     decides whether they fold into billing — flagged follow-up (b)).

2. **AC-1: coded values are DATA, not schema.** `payment_terms` and `status` are string VALUES with
   NO CHECK constraint (value-sets grow as data — mirrors the `customer_type`/`price_tier`
   precedent). The UI offers suggestions (a datalist for terms, Active/Inactive for status) but the
   column accepts any string.

3. **RLS inherits (AC-3, STD-004).** Columns on an already-scoped table inherit
   `customers_business_owner` + `customers_member` — no new policy (D-40 migration is the precedent).
   The new PII (tax_id, credit_limit, billing address) is tenant-scoped by that RLS. **BENCH-C
   (PII, catastrophic — David's go)** applied: value-MASK `tax_id`/`credit_limit` in the
   `[TRACE:customers]` diagnostic (log the field name + "changed", never the EIN/credit figure).
   One masking source in `customerEdit.ts`, read by both write helpers (STD-011).

4. **STD-011 (one canonical rep):** the `updated_at` trigger reuses the canonical
   `set_updated_at_generic()` (20260604), not a new per-table function.

5. **UI = full grouped editor (`CustomerPartyEditor`), roster stays LEAN.** The DataSheet is
   hand-declared and the party record is ~18 fields — too many for inline grid columns. The full
   set lives in a grouped modal (Identity · Contact · Billing · Tax · Commercial terms · Status),
   opened from the roster by name or an Edit button. The roster surfaces only the at-a-glance
   columns (name · type · tier · tax badge · status). Tax section: the exempt toggle reveals
   reason/cert/expiry and cannot be saved exempt without a reason (mirrors D-40's server refusal).

## STANDARDS touched

STD-014 (honest-unset) — clear: the two NOT-NULL-DEFAULT cols (`status`='active', `updated_at`=now())
are universal system defaults, not one-tenant fabricated values; every tenant-supplied value is
nullable = honestly unset. STD-015 (tenant identity) — clear (all per-row data). BENCH-C — applied.
BENCH-G (immutable audit) — NOT triggered by adding current-state columns; remains the named future
hardening for exemption history.

## SEPARATE follow-ups (flagged, NOT built)

- **(a)** `organization_name` backfill — pull org names out of `first_name` (a data pass; not done
  here — new orgs get their own field going forward, existing rows untouched).
- **(b)** existing unprefixed `address_line1/*` → `billing_*` cleanup (decide fold vs keep).
- **(c)** `tax_exempt_cert_doc_url` ingest — the on-file cert document upload rides the STD-010
  file-upload pattern (Receipt Keeper); the column is the hook, no ingest built. The editor shows a
  disabled "Attach certificate document (coming soon)" affordance marking the slot.
- **(d)** L2 `customer_addresses` saved ship-to address book — an order-time shipping picker reads
  it later. L1→L2 additive; deferred.

## Is it a D-decision?

**Recommend yes — D-41.** It is a platform-level entity-model decision (the party record shape,
the L1/L2 address model, the shipping-is-order-time rule) that future builds must not re-litigate,
and it implements the STD-015 party-model line. Confirm the DECISIONS.md head before assigning.
