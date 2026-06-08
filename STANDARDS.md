# STANDARDS.md — TRACE Engineering Standards
# Version: 1.0
# Created: 2026-06-04
# Owner: David O'Brien / TRACE Enterprises

> Every standard on this list traces to a real failure that bit us.
> We do not adopt best-practices by reputation.
> A standard earns its place by preventing a specific scar.
> It loses its place if it adds friction without catching a real failure.

---

## PREAMBLE

This team is finite (solo + family). Every standard must trace to a real failure
that bit us. We do not adopt best-practices by reputation. We fail fast, learn,
adjust. A standard earns its place by preventing a specific scar; it loses its
place if it adds friction without catching a real failure.

---

## THE STANDARDS

---

### STD-001 — PROVE BEFORE YOU ACT

**Rule:** No destructive action, data change, or fix until the diagnosis
justifying it is confirmed read-only first. Instrument/inspect, prove, THEN
change.

**Scar:** Nearly cleared the Blotato config before confirming it was the cause.
Three separate missing-column bugs (modules, nursery_modules, orders) shipped on
reasoning rather than verification — each required a follow-up session to find
the real root cause.

**In practice:**
- Before any `ALTER TABLE`, `DROP`, or data write: read the current state first
- Before any bug fix: identify the exact line/condition causing the failure
- The "STEP 0 hard gate" pattern in session prompts enforces this

**Scope:** Every bug-fix prompt. Every migration that modifies or drops data.

---

### STD-002 — RED-TEST-FIRST

**Rule:** Before a fix, make the bug visible with a failing check —
instrumentation trace showing the bad behavior, or a test that fails. Fix. Show
the SAME check now passes. No "fixed" claim without a before/after artifact.

**Scar:** "Shipped ✅ but never exercised." The Social Media bounce, the Ignition
sign-in loop, and missing columns (orders SELECT policy, social_drafts constraints)
were all "fixed" without first proving the broken state was observable. Some
required re-investigation because the fix could not be verified against the
original failure.

**In practice:**
- For a runtime bug: add [SM-TRACE]-style instrumentation, capture the failure
  output, THEN fix, THEN capture the passing output
- For a data bug: run the verification query showing the broken state, THEN
  apply the migration, THEN run the same query showing the corrected state
- Artifact: before-screenshot or console dump + after-screenshot or console dump,
  both included in the session Handoff

**Scope:** Every bug-fix prompt.

---

### STD-003 — INSTRUMENTATION IS A PRESERVED ASSET

**Rule:** Diagnostic logs are prefixed (e.g. `[SM-TRACE]`, `[BP-TRACE]`), and
after a fix is verified they are PRESERVED behind a debug flag rather than
deleted. Production builds must produce zero diagnostic output.

**Implementation pattern:**
```ts
const SM_DEBUG = false;  // flip to true locally to re-enable trace
if (SM_DEBUG) console.log('[SM-TRACE] SocialSetup MOUNTED — businessId:', businessId);
```

**Scar:** Every non-trivial bug required re-deriving which state to instrument.
The Ignition loop, the SM enable error, the orders SELECT RLS gap — all required
fresh probe points each time because prior diagnostics were deleted.

**Preservation rule:**
- After a fix is verified: wrap every `console.log('[SM-TRACE]...')` in
  `if (SM_DEBUG)`, set `SM_DEBUG = false`
- Never delete instrumentation — it documents WHERE the failure was and HOW to
  re-examine it
- Note the flag name and file path in the session Handoff so future sessions can
  re-enable without re-deriving

**Flag naming convention:** `<PREFIX>_DEBUG` where prefix matches the log prefix.
Current active debug flags:
- `SM_DEBUG` — Social Media setup lifecycle trace
  - Files: `packages/cultivar-os/src/pages/SocialSetup.tsx`,
    `packages/shared/src/context/BusinessProvider.tsx`,
    `packages/cultivar-os/src/pages/Dashboard.tsx`
  - Re-enable: set `SM_DEBUG = false` → `true` in each file (or add the flag
    where not yet gated — see STD-003 adoption note below)

**Scope:** Every bug-fix prompt. Any instrumentation added during diagnosis.

---

### STD-004 — TENANT ISOLATION IS THE ACCEPTANCE BAR

**Rule:** Any feature touching business-scoped data ships with a two-email /
two-business isolation proof: create or enable as business A, confirm the result
is invisible to business B. Reasoned-correct RLS is necessary, not sufficient —
exercise it live.

**Scar:** Audit finding #13 (Session 2026-06-04) — the `BusinessProvider` member
path had no `business_type` filter. A Cultivar member logging into Ignition could
resolve to the nursery business (cross-tenant data exposure). The RLS policies
were correct on paper but the code-level filter was missing. Fixed in commit
`8792c71` — but was shipped unverified.

**Proof artifact format:**
```
A: [email-a@test.com] → business_id [aaa...] → sees row [row-id]: YES
B: [email-b@test.com] → business_id [bbb...] → sees row [row-id]: NO (correct isolation)
```

**Scope:** Every feature that writes to or reads from a business-scoped table
(any table with a `business_id` column). Platform-wide RLS policy changes.

---

### STD-005 — RECORD DECISIONS VERBATIM, NOT PARAPHRASED

**Rule:** When a decision is written to docs, it is recorded in the exact words
it was decided in. No summarizing a decision into something subtly different.

**Scar:** `business_modules` timing drift — the Handoff said "migration not yet
applied" but also said "WILL PASS" for all checks, creating ambiguity about
whether the migration was live. The `PIN-as-Honest-Debt` characterization
persisted in `PLATFORM_STRATEGY.md` after the decision was reversed, because the
reversal was summarized into a soft update rather than a clean replacement.
Stale tail-300 recovery: a THOUGHTS.md entry was partially updated but the old
phrasing remained, causing re-derivation in a later session.

**In practice:**
- When reversing a decision: find the original text, strike it through or delete
  it, write the new decision immediately after with a date marker
- When a decision is "provisional" (names, not substance): mark it explicitly
  with `(provisional — substance locked)` so future sessions know what can and
  cannot change
- Never leave contradictory text in two sections of the same doc

**Scope:** Every edit to CLAUDE.md, PLATFORM_STRATEGY.md, MASTER_BRIEF.md,
THOUGHTS.md. Any session that reverses a prior documented decision.

---

### STD-006 — VERTICAL-AGNOSTIC IDENTIFIERS

**Rule:** No vertical nouns in shared schema, code, or identifiers. Vertical
identity is a value (`business_type`), never a table name, column, or identifier.

**Scar:** `nursery_modules` served all verticals but was named for Cultivar. It
directly caused the `updated_at` bug (the column missing from `nursery_modules`
was not caught until the Social Media enable flow broke in production). The full
noun-leak audit (2026-06-03) found 16 additional instances. Each one is a latent
bug for the second vertical.

**Already enforced via:** Architecture Constant AC-1 (PLATFORM_STRATEGY.md) +
Step 13 in the Part 9 session-end protocol. Listed here so the standards set is
complete and cross-referenced.

**Scope:** Every shared schema change. Every new file in `packages/shared/`.

---

### STD-007 — DERIVED CONNECTION STATE, NOT CACHED FLAGS

**Rule:** State flags that reflect the status of an external connection or
resource (OAuth tokens, API keys, integrations) must be DERIVED from real
evidence — e.g., by comparing a stored expiry timestamp against the current
time, or by proactively attempting a refresh — and surfaced proactively. A
cached boolean that only updates reactively (on a mid-use 401 or failure call)
is a Surface Honesty violation: the system is making a claim it cannot prove.

**Scar:** `businesses.accounting_needs_reconnect` read `false` while David's
QuickBooks token had been expired for 10+ days. The flag only flipped on a 401
during an active invoice call (in `refreshQBToken()`, called only from
`invoice/cultivar.ts`). An owner could see "QuickBooks connected" on the
dashboard while their connection was dead. The first signal was a failed invoice
during a customer sale — the worst possible moment. Fixed 2026-06-08:
`qbo/status.ts` now proactively checks `accounting_token_expires_at` against
`Date.now()` on every dashboard load; if expired, it attempts a silent refresh;
if refresh fails, it sets `accounting_needs_reconnect = true` and returns
`needsReconnect: true` to the client immediately. `Dashboard.tsx loadMetrics()`
also derives a client-side early estimate from `accounting_token_expires_at` so
the banner appears without waiting for the status check to complete.

**In practice:**
- Store expiry timestamps for all external tokens/credentials, not just the
  token itself
- On load of any surface that depends on a live connection, compare stored
  expiry against `Date.now()` before displaying a "connected" state
- Attempt a silent refresh if the token is expired and a refresh token exists
- Surface the reconnect prompt proactively — before the user tries to use the
  integration and before any request to the external service fails

**Scope:** Every integration that holds an OAuth token, API key with expiry,
or any credential that can silently lapse. Any dashboard or settings surface
that displays connection status.

---

## ENFORCEMENT

| Standard | Applies to | Gate type |
|---|---|---|
| STD-001 | Every bug-fix or data-change prompt | STEP 0 hard gate in session prompt |
| STD-002 | Every bug-fix prompt | Before/after artifact in Handoff |
| STD-003 | Every instrumentation added | Debug-flag wrap after fix verified |
| STD-004 | Every business-scoped feature | Two-email proof in Handoff |
| STD-005 | Every decision recorded in docs | Review prior text before writing |
| STD-006 | Every shared schema/code change | Step 13 AC-1 check in Part 9 |
| STD-007 | Every integration with expiring credentials | Proactive expiry derivation, not reactive flag |

**Part 9 addition:** A `STANDARDS compliance` line is now required alongside the
existing Step 13 AC check at session end. See CLAUDE.md Part 9, Step 14.

---

## GROWTH POLICY

New entries require:
1. A named scar (a real failure, dated)
2. A rule that would have caught it
3. A defined scope (not "always" — that dilutes everything)

Proposed standards without a scar go in the "Candidates" section below and wait
for a confirming incident before promotion.

---

## CANDIDATES (not yet promoted — no confirming scar yet)

*None at v1.*

---

## CHANGELOG

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-04 | Created. Six standards seeded from session scars. Adopted immediately. |
| 1.1 | 2026-06-08 | STD-007 added. Scar: QB `accounting_needs_reconnect` lying flag — reactive-only flag kept dead connection silent. Fixed by proactive `accounting_token_expires_at` check in `qbo/status.ts`. |

---

*TRACE Enterprises · Built with CAI*
*Update this file when a new scar earns a standard. Never adopt standards by reputation.*
