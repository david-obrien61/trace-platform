# D-51 · Event log and audit log are two physical tables, split by retention

**Date:** 2026-07-21 · **Status:** ACCEPTED (David ratified in session) · **Class:** ARCHITECTURE — platform primitive
**Extends:** D-50. D-50 established one immutable event log; D-51 splits accountability out by RETENTION, while the event log remains the sole source of truth for state.

---

## Decision

There are TWO append-only, DB-immutable logs, distinguished by PURPOSE and RETENTION:

1. **Event log** (`business_inventory_ledger`) — the SOURCE OF TRUTH for state. On-hand and expected derive from it by replay (D-50). High-volume: every sale, count, adjust, receipt. Retention: **checkpoint-and-archive** — periodic snapshot rows let pre-snapshot movements be folded into a checkpoint and cold-archived WITHOUT breaking replay. It is never trimmed (that would break state); it is compacted.

2. **Audit log** (`audit_log`) — the ACCOUNTABILITY record. Who did what, for discretionary/security-relevant acts (delete, override, tier change, permission change). Low-volume. NOTHING is computed from it. Retention: **retained** — kept for compliance/forensics, its own policy, NOT archived on the event log's schedule.

---

## Why two physical tables, not one queried apart (the retention reason)

They are conceptually separable by query (`event_type` discriminates), and one table would be simpler. But they need OPPOSITE retention: the event log gets checkpoint-and-archive (fold millions of routine movements into snapshots); the audit log gets retained-for-years (hundreds of discretionary acts, kept). **Retention is a table-level property — one table cannot hold two retention policies.** The volume mismatch (millions of movements vs hundreds of discretionary acts) makes the split correct, not premature.

---

## The relationship — a discretionary act writes to BOTH

A soft-delete is a STATE event (stock left → event log) AND an accountability act (someone chose to delete → audit log). It writes both, same transaction.

**The audit log is NOT events moved out of the source of truth** — the event log must never lose a state event or replay breaks. The audit log is an ADDITIONAL, retained record of the human choice behind certain events. State events that carry no discretion (a routine sale) write ONLY the event log.

---

## Timing — split NOW, on test data

Executed while the tables hold ~130 test rows and zero live users, because the ONLY cheap window to split is before live customers depend on a no-downtime system. Splitting later = a migration with data in flight on a live system — the exact operation D-51 exists to avoid. Build-once: the live system is born already-split.

---

## Retention mechanisms (named here, built when volume demands)

- **Event-log snapshot-compaction** — periodic snapshot row + cold-archive of pre-snapshot movements.
- **Audit-log retention policy** — kept, not archived.

Both additive, both later; **D-51 makes the SCHEMA ready now so neither needs a live migration.**

---

## Reasoning

Event sourcing and audit logging are distinct standard patterns that share only append-only-ness — measured against the standard, not invented. **STD-011** (state has one source: the event log). **D-9** (the audit log surfaces who, never a fabricated actor — anonymous stays null). The provenance through-line: **the event log carries what moved; the audit log carries who chose it.**
