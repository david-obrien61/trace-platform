# D-50 · Inventory movement ledger — movement is the truth; on-hand and expected derive from it

**Date:** 2026-07-19 · **Status:** ACCEPTED (David ratified in session) · **Class:** ARCHITECTURE — platform primitive
**Supersedes:** the `expected_qty`-snapshot approach scoped in `docs/decisions/2026-07-19-count-reconcile-recon.md` (a snapshot column is a second representation of movement — STD-011 — so it is dropped in favour of derivation).
**Amends:** D-45 — the count still PROMOTES size+qty (the D-45 invariant stands), but the qty write stops being a bare SET (`InventoryCount.tsx:425`) and becomes a ledger-emitting reconcile event (see below).

**Decision.** Every change to an inventory quantity — receive, sale-decrement, count reconcile, manual adjust, dead/damage/return — writes ONE row to a new append-only **inventory movement ledger** (`business_id`, `inventory_id`, `delta`, `kind`, `reason`, `source_id`, `actor_user_id`, `occurred_at`). The row is written **in the same transaction** as the qty change: no quantity moves without a ledger row, ever.

- **On-hand and expected both DERIVE from the ledger.** `business_inventory.qty` is the running on-hand; "expected at any past instant" is a replay of the ledger to that timestamp (start point + receipts − sales ± adjustments). There is NO stored `expected_qty` — it is a query, so it cannot drift and there is nothing to keep in sync (STD-011: one representation of the fact "what moved").
- **The ledger is immutable at the DATABASE.** `REVOKE UPDATE, DELETE` plus a trigger that refuses row mutation. Immutability is a DB guarantee, not an app convention — a rule that depends on remembering is the empty-`audit_log` failure (detected, noted, and rotted for 23 days). This defends against our own future code as much as any actor: a "let owners fix a bad row" button is rejected by the database, so a correction must be a NEW row.
- **Every row carries the REAL actor.** `actor_user_id` is the person who drove the action, not the service key and not defaulted to the owner. (The current count runs as owner and the sale path writes through a service key with `auth.uid()` null — so capturing the true actor on the service-key and offline-sync paths is a named build sub-question, not assumed solved.)
- **The count is a RECONCILE EVENT, not a SET.** A count asserts PHYSICAL truth (counted qty, dated), computes the delta against ledger-replay, and requires the human to ACCOUNT for any difference in ledger rows (dead / loss / found / miscount) before book and physical reconverge. The prior on-hand is never destroyed, because it was never a scalar to overwrite — it lives in the ledger.

**The two disagreements (this is WHY the count stops being a SET).**
1. **Replay vs on-hand must be ZERO, by construction.** These state the same fact; same-transaction emission makes a gap structurally impossible. Any gap here is a BUG, not shrinkage — and it is the worst failure mode because it looks fine, so it must be prevented, not monitored.
2. **Replay vs physical count is the PRODUCT.** This gap is real-world reality diverging from the book — the leakage signal. Because counts and movements are both dated, the gap is BOUNDED to the window between two counts and ATTRIBUTABLE to that window's actors. The human closes it with reconcile lines that are themselves immutable ledger rows — so the record permanently states not just that on-hand became N, but that X was called death and Y called loss, by whom, on what date.

**One primitive, five debts closed.** `expected_qty` snapshot (gone → derived) · `orders` has no paid-time (irrelevant → the ledger row IS the timestamped sale event, written where the D-42 decrement already fires) · sold-vs-unexplained (fact, not approximation) · the empty `audit_log` for inventory (filled by the same writer) · leakage/shrink detection (falls out of replay-vs-count).

**Honest ceiling (do not oversell).** The ledger makes leakage VISIBLE and BOUNDED, not self-explaining. A mis-ring (sell 5, ring 3) corrupts the book before the count even starts, so a count gap can be real-loss + under-ring mixed. The system surfaces the window and the actors; it does NOT attribute intent. Show the window and the names — never pretend the math assigns blame.

**Reasoning.** STD-011 (single representation of movement) · the provenance through-line (the artifact must carry its own provenance — inventory rows could not say who changed them) · D-9 (never guess a delta — surface it and require a human account) · the "surface the between" thesis applied to the nursery's own stock.

**Distinct from** the pricing/margin-leakage epic (`user_stories.md` "Platform economics"): that captures discount-override on PRICE; this captures physical movement on QTY. Different axes, same thesis.

**Companion (not this decision):** blind-capture as a per-session MODE — a count session is blind (both on-hand leak sites hidden) or quick-check (visible), defaulting blind; a setting on `inventory_count_sessions`, its own build item and owner-test.
