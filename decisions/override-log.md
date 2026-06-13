# TRACE — OVERRIDE LOG

> Append-only, dated record of red-team passes on load-bearing decisions: which seat objected, the objection, and — when David overrode it — the reasoning. Companion to Section 14 of `docs/operating-doctrine/lightning-david-partnership.md` (the pre-commit red-team pass). **Append-only on purpose:** the value is that the reasoning can't be quietly edited after a bad call. You don't get to retcon the reasoning once first-contact proves the seat was right.

> **Why every override is logged.** An override is not a failure of the method — it's the method working (David is the Kirk seat; overriding informed-Spock is his job). An *undocumented* override is the dangerous thing. Three reasons: (1) **it's the audit trail on whether the red team is real** — override every objection and the log proves it's theater; override some and the log shows genuine friction; (2) **first-contact failures are overrides coming home** — when a buyer rejects something weeks out, the log shows the moment the objection got waved off, which turns blame into learning; (3) **it's Surface Honesty applied to the decision layer** — a decision made by overriding a documented objection is a claim, and the claim plus its basis stay visible, not hidden.

## Entry format
- **Date** —
- **Decision** —
- **Seat that objected** —
- **Objection (one line)** —
- **Outcome** — seat won (course adjusted) / overridden (proceeded anyway) / open
- **Reasoning** (if overridden) —
- **To revisit** —

## Entries

### 2026-06-08 — advert_channels build
- **Date** — 2026-06-08
- **Decision:** Build `advert_channels` as the campaign-channel config table now.
- **Seat that objected:** Contrarian.
- **Objection (one line):** Don't build it yet — leave the generator hardcoded, delete the dead channel from the string, ship; there are zero customers to justify the table.
- **Outcome:** Seat won — course adjusted (not killed). Build narrowed to two channel types, no speculative columns.
- **Reasoning:** n/a — not an override; the objection refined the build and David accepted it.
- **To revisit:** Whether the two-type model holds once a real customer's channel mix is known.

### 2026-06-08 — campaign generator priority (generated voice vs. margin-engine port)
- **Date** — 2026-06-08
- **Decision:** Ship the `advert_channels` plumbing first; margin-engine port stays next in the queue.
- **Seat that objected:** Customer-first-contact.
- **Objection (one line):** A perfectly-routed post in a robot voice still gets rejected by Lauren — making the generated voice good enough to survive first contact may outrank the margin port as the next priority.
- **Outcome:** OPEN as of 2026-06-10 — override-vs-honor was not yet decided. **DAVID: verify current state and close this entry** (did the margin port proceed, or did voice work jump the queue?).
- **Reasoning:** (pending David's call)
- **To revisit:** Lauren's reaction to the generated voice on the first real send.
