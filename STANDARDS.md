# STANDARDS.md — TRACE Engineering Standards
# Version: 1.8
# Created: 2026-06-04
# Last updated: 2026-06-11
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

## THE ROSTER MODEL

Standards exist in three states. The point is not to hold every industry standard —
it is to hold the ones that apply to *our* stack, activate them at the right moment,
and never carry noise.

- **ACTIVE** (on the field — enforced now): STD-001 through STD-010 below. Each has
  a confirming scar and is enforced every relevant session. Two origins:
    - *TRACE scars* — failures from this codebase (the QB lying flag, the
      hand-applied constraint, the hardcoded channels).
    - *Enterprise scars* — failures the whole industry already bled for; we inherit
      the lesson without re-bleeding (secrets in code, tenant isolation).
  An active standard is enforced regardless of origin — the origin only tells you
  whether the scar is ours or the field's.

- **BENCH** (identified, applies to our stack, dormant until triggered): standards
  we KNOW will apply when we reach certain territory, written ahead of time so we
  adopt the proven path instead of improvising under pressure. Each bench standard
  carries an **ACTIVATE WHEN** trigger (a recognizable build condition) and a
  **CLASS** (catastrophic = stop-and-ask before proceeding; hygiene = apply-and-
  report). A bench standard is not enforced until its trigger fires and it is
  promoted to ACTIVE.

- **N/A** (not on our roster): the rest of the industry's standards that don't apply
  to our stack (React/TS, Supabase/Postgres, Vercel serverless, multi-tenant SaaS,
  AI gateway). Deliberately not listed — listing them is the noise we reject.

**Promotion (Bench → Active):** when a bench standard's trigger fires, it is promoted
to ACTIVE with the date and the triggering build noted. Catastrophic-class promotions
require David's explicit go (it's a conscious decision on a high-cost change). Hygiene-
class promotions: Thunder applies and reports.

**This file is also the document handed to new team members (Erin, Andrew, Connor).**
Every standard carries its scar or its territory — the *why* — so it is understood,
not blindly obeyed. A reader is invited to disagree-with-reasoning (red-team) and
David holds the override. A standard without its story is a rulebook; a standard with
its story is a lesson. Write them as lessons.

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

**Rule:** Diagnostic logs are prefixed by subsystem tag (e.g. `[TRACE:MARGIN]`,
`[TRACE:AUTH]`, `[TRACE:DATA]`, `[TRACE:WORKFLOW]`, `[TRACE:API]`) and follow the
on-by-birth lifecycle:

- **Born ON.** Instrumentation goes in AS code is written, ON and emitting, while
  the code is unproven. It is NOT born silenced behind a false flag.
- **On until proven.** It stays on, emitting, until the behavior is proven correct
  in operation — not just in a build. "Builds pass" is NOT "proven." Operational
  and visual acceptance is David's call. Thunder may suggest "this looks proven,
  want to comment it out?" but does not silence unilaterally.
- **Commented out when earned.** Once David says proven, the log lines are
  COMMENTED OUT (dormant, re-enableable by uncommenting) — not deleted, not left
  gated behind a false flag.
- **Tag by subsystem** where many traces run simultaneously so the console stays
  filterable — signal, not flood.

**The flag-gate pattern is RETIRED as the resting state.** `const SM_DEBUG = false;
if (SM_DEBUG) console.log(...)` is the old model. The resting state for an earned
(proven) log is COMMENTED OUT, not silenced behind a false const.

**Implementation pattern (current):**
```ts
// ACTIVE while unproven — born ON, emitting:
console.log('[TRACE:MARGIN] calculateRetail — cost:', cost, 'tier:', tier);

// After David says proven — COMMENTED OUT (not deleted, not flagged false):
// console.log('[TRACE:MARGIN] calculateRetail — cost:', cost, 'tier:', tier);
```

**Scars:**
- *Re-derivation scar:* Every non-trivial bug required re-deriving which state to
  instrument. The Ignition loop, the SM enable error, the orders SELECT RLS gap —
  all required fresh probe points each time because prior diagnostics were deleted.
- *Born-silent scar (Tailwind pass, 2026-06-10):* The Tailwind conversion session
  shipped instrumentation born SILENT (`STYLE_DEBUG = false`), which is on-by-birth's
  opposite — the instrument couldn't catch anything because it never spoke. The
  flag-gate pattern produced instruments that were defensive at birth instead of
  diagnostic.

**Preservation rule:**
- Never delete instrumentation — it documents WHERE the failure was and HOW to
  re-examine it
- When David says proven: comment out the log lines (not delete, not set flag false)
- Note the subsystem tag and file paths in the session Handoff so future sessions
  can re-enable by uncommenting

**Active instrumentation (currently ON — not yet proven):**
- `[TRACE:MARGIN]` — all A/C/D/E margin engine call sites.
  Files: `MarginEngine.js`, `PriceField.jsx`, `IgnitionPort.jsx`, `IgnitionProcure.jsx`,
  `IgnitionCipher.jsx`, `DataBridge.js`, `IgnitionEstimate.jsx`, `IgnitionOmni.jsx`,
  `IgnitionProt.jsx`, `OnboardingWizard.jsx` (root).
- `[TRACE:AUTH]` — `DataBridge.js`, `CoreApp.jsx`, `IgnitionAdmin.jsx`.
- `[TRACE:DATA]` — `DataBridge.js` (save/load for teardown-target keys).
- `[TRACE:WORKFLOW]` — `CoreApp.jsx`, `IgnitionFlux.jsx`, `IgnitionIntake.jsx`,
  `IgnitionEval.jsx`, `CustomerApprovalPortal.jsx`, `IgnitionKosk.jsx`,
  `IgnitionEstimate.jsx`, `IgnitionInvoice.jsx`.
- `[TRACE:API]` — `ExternalBridge.js`, `IgnitionAudit.jsx`, `IgnitionCipher.jsx`,
  `IgnitionEstimate.jsx`, `PredictiveKey.jsx`.

**Scope:** Every bug-fix prompt. Any instrumentation added during diagnosis. All new
code paths in non-trivial modules.

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

### STD-008 — DEPLOYED SCHEMA == ON-DISK MIGRATIONS (BOTH DIRECTIONS)

**Rule:** The constraint is bidirectional:
1. **Committed-not-applied:** A migration file committed to the repo is NOT done
   until its application to the live DB is verified. Code must never assume a column
   exists based on a migration file.
2. **Live-not-in-migration (INVERSE):** A live DB object (CHECK constraint, trigger,
   RLS policy, index) that exists in the live DB but has no corresponding committed
   migration is the same category of gap — the deployment is not reproducible and the
   object is invisible to code review, audits, and future migration sessions.

Both directions break reproducibility. Both are STD-008 violations. Deployed schema
== on-disk migrations is a release gate in BOTH directions, not an assumption.

**Scar (original — committed-not-applied):** `20260604_social_drafts_voice_learning.sql`
was committed but never applied to `bgobkjcopcxusjsetfob`. `generate-posts.ts`
inserted `original_text`/`cadence` — PostgREST 400 on every INSERT. social_drafts
stayed at ~0 rows across multiple sessions, undetected. Fixed by
`20260608_social_drafts_subject_ref.sql`.

**Scar (inverse — live-not-in-migration):** `social_drafts_platform_check` existed
in the live DB but in NO committed migration — hand-applied when the table was created
pre-migration-era. When `advert_channels` enabled 'sms', `generate-posts.ts` attempted
`INSERT platform='sms'`. The batch insert is atomic; one sms row rolled back all rows
(instagram + tiktok included). Confirmed 2026-06-09: zero rows written per run.
Fixed by `20260609_social_drafts_platform_check.sql` — drops and recreates the
constraint including 'sms', bringing it under migration control.

**Verification pattern:**
```sql
-- After applying a column migration — run in Supabase SQL editor:
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = '<table_name>'
 ORDER BY ordinal_position;
-- Cross-check: every column the code writes must appear here.

-- Sweep for undocumented live-DB objects (run periodically or before a migration session):
SELECT tc.table_name, tc.constraint_name, cc.check_clause
  FROM information_schema.table_constraints tc
  JOIN information_schema.check_constraints cc USING (constraint_name, constraint_schema)
 WHERE tc.table_schema = 'public' AND tc.constraint_type = 'CHECK'
 ORDER BY tc.table_name, tc.constraint_name;
```

**In practice:**
- After applying a migration, run the verification query and compare against
  every `INSERT`/`UPDATE`/`SELECT` in code that touches the affected table
- Add a `-- VERIFICATION QUERY:` block as a comment at the end of every migration
  file so the check is self-documenting
- Log the verification result in the session Handoff: "migration applied and
  verified — live schema confirmed via information_schema query"
- Never mark a migration as complete in docs without this confirmation
- Before any migration session that touches a pre-migration-era table, run the
  sweep query to identify undocumented live objects; bring any found object under
  migration control in the same session (drop + recreate = migration-controlled)

**Scope:** Every migration session. Part 9 gate: migration applied → verification
query shown → confirmation logged in Handoff before session closes. Sweep for
undocumented live objects at least once per table that predates the migration era.

---

### STD-009 — CONFIG-HONESTY IN GENERATION PATHS

**Rule:** Generation and output paths must derive business-specific choices —
which channels to generate for, cadence, post counts, publish behavior — from
the single configured source of truth (`business_modules.config.advert_channels`).
These choices must NEVER be hardcoded into a prompt string, AI call, or
output-assembly path.

**Scar:** `packages/shared/src/campaigns/generate.ts` hardcoded
`"2 Instagram posts, 2 Facebook posts, 1 SMS"` directly into the AI prompt and
never fetched `business_modules.config`. A business with Facebook disabled and
TikTok enabled would receive Facebook posts and no TikTok posts — the exact
inverse of their configuration. The social-posts path (`generate-posts.ts`)
correctly read config; campaigns did not. Both paths called Claude; one honored
business config, one ignored it entirely. Fixed 2026-06-08: `generateCampaignPosts()`
now accepts `advertChannels: AdvertChannel[]` (passed from the handler after
fetching config), builds per-channel instructions from that array, and derives
post counts from campaign duration rather than a hardcoded integer.

**LEXICON RULE (adopted 2026-06-08):** `"platform"` is RESERVED for the
top-level TRACE substrate (builtwithCAI). Inside the product — config fields,
API parameters, UI labels, DB columns on business-owned tables — use `"channel"`
or `"advert_channel"`. No config field, table, or identifier inside the product
may be named `"platform"`. Violation: writing `config.platforms` when you mean
`config.advert_channels`.

**In practice:**
- Every generation path (social, campaign, future notification) receives its
  channel/cadence/count configuration from the caller, not from literals in the
  generator
- No channel name may appear in a hardcoded count expression
  (`"2 Instagram posts"` is a violation; `"${count} × ${channelGuidance}"` is correct)
- Count per channel must be derived from a business-set or campaign-derived
  parameter — never a literal integer in the generator
- The single config field is `advert_channels: AdvertChannel[]`; all generation
  paths consume it via the caller

**Sweep findings (2026-06-08 — log only, not yet fixed per session scope):**
- `packages/shared/src/campaigns/generate.ts:129` — `?? 'instagram'` fallback
  when AI omits `channel` field in PostDraft. Hardcoded channel name in output
  assembly. → Tech Debt #19.
- `packages/shared/src/campaigns/types.ts:18` — `CampaignPost.platform` union is
  `'instagram' | 'facebook' | 'sms' | 'email'`, missing `'tiktok'` and `'twitter'`.
  Type doesn't reflect all channels the generator can now produce — TypeScript
  will silently widen or error depending on usage. → Tech Debt #20.
- `packages/cultivar-os/api/campaigns/publish-post.ts` — Orphaned file (action
  consolidated into `api/campaigns.ts`). Contains SMS-specific branching on
  `post.platform === 'sms'`. Dead code; not a generation path; safe to delete
  in a cleanup session. → Tech Debt #21.

**Scope:** Every AI generation path that produces channel-specific output. Every
config field that stores business channel preferences. Every API that accepts or
returns channel selections.

---

### STD-010 — FILE UPLOAD / INGEST SAFETY

**Promoted from BENCH-B:** 2026-06-10 — triggered by Receipt Keeper v1 (Gemini
Flash vision ingest path). David's explicit go confirmed 2026-06-10.

**Rule:** Any code path that accepts a file from a user or customer must:
1. **Validate real content-type** — read magic bytes or rely on a trusted server-
   side check; never trust the client-declared MIME type or file extension alone.
2. **Enforce an explicit size limit** — reject before processing; do not consume a
   payload to discover its size.
3. **Never execute or trust the content** — treat all uploaded content as untrusted
   input at the system boundary; no eval, no shell-out, no path traversal.
4. **Scope storage per-tenant** — a file uploaded by Business A must never be
   accessible to Business B; rides on STD-004 isolation. Storage path pattern:
   `{bucket}/{business_id}/{file_id}` — never a flat shared bucket.
5. **Do not surface raw uploads as executable code** — a stored upload must never
   be served from a URL that a browser treats as a script or HTML resource.
6. **For OCR / AI ingest paths:** the structured result is the artifact, not the
   raw file. Prefer not persisting the raw upload unless there is a specific
   retention requirement. If persisted, apply rules 1–5 in full.

**Territory (enterprise scar — not yet a TRACE scar):** File upload vulnerabilities
are a persistent top-10 class (content-type spoofing is trivial — any client can
set `Content-Type: image/jpeg` on a PHP shell). Unrestricted upload → code
execution is an established critical path. Size-limit absence → storage exhaustion
/ denial of service. Tenant-scoped storage is a data-boundary requirement in the
same class as STD-004. Receipt Keeper is the triggering build; these rules apply
to all future upload paths.

**Receipt Keeper — triggering build:** Gemini Flash vision accepts images via
base64 payload; the raw image need not be stored in a user-accessible location at
all. The OCR result (structured JSON: merchant, date, amount, line items) is the
artifact. If images are persisted for audit purposes, they must be in a
per-tenant path in Supabase Storage (`receipts/{business_id}/`) with an RLS
policy that mirrors STD-004.

**In practice:**
- Every Vercel function receiving a file: validate content-type header AND magic
  bytes before forwarding to Gemini or storing
- Size limit: set explicitly in the handler (e.g., reject > 10 MB) before any
  buffer read or base64 encode
- Storage writes: `business_id` in the path, RLS policy on the bucket — verify
  via two-tenant isolation proof per STD-004 before shipping
- Receipt Keeper's confirm-before-commit UX (user sees parsed result, confirms
  before anything is written) is ALSO a partial implementation of this standard —
  the "never trust the content" rule is satisfied by showing the parse result to
  the human before committing it as a financial record

**Scope:** Every code path that accepts a file from a user (POST body binary,
multipart, base64-encoded image). Every Vercel function that calls an OCR or vision
AI endpoint. Every storage write that originates from user-supplied content.

---

## ENFORCEMENT

| Standard | Applies to | Gate type |
|---|---|---|
| STD-001 | Every bug-fix or data-change prompt | STEP 0 hard gate in session prompt |
| STD-002 | Every bug-fix prompt | Before/after artifact in Handoff |
| STD-003 | Every instrumentation added | Born ON; commented out only when David says proven |
| STD-004 | Every business-scoped feature | Two-email proof in Handoff |
| STD-005 | Every decision recorded in docs | Review prior text before writing |
| STD-006 | Every shared schema/code change | Step 13 AC-1 check in Part 9 |
| STD-007 | Every integration with expiring credentials | Proactive expiry derivation, not reactive flag |
| STD-008 | Every migration session | Verification query in SQL editor; confirmation in Handoff |
| STD-009 | Every AI generation path + every config field for channel/cadence/count | Config-read required; no hardcoded channel names or counts in generator |
| STD-010 | Every file-accepting code path, every OCR/vision ingest, every storage write from user-supplied content | Content-type validation + size limit + per-tenant storage path + no raw-file trust |
| BENCH-A, BENCH-C, BENCH-D | Every session (STEP 0 roster match against ACTIVATE WHEN triggers) | Catastrophic-class match → stop and ask David; hygiene-class match → apply and report |
| BENCH-E | Any session that adds an external AI provider call that is user-facing | Apply try-chain pattern; provider 3 slot in comments; operator log on fallback; clean user error on all-fail |

**Part 9 addition:** A `STANDARDS compliance` line is now required alongside the
existing Step 13 AC check at session end. See CLAUDE.md Part 9, Step 14.

---

## GROWTH POLICY

New ACTIVE entries require:
1. A named scar (a real failure, dated)
2. A rule that would have caught it
3. A defined scope (not "always" — that dilutes everything)

New BENCH entries require:
1. An ACTIVATE WHEN trigger (a recognizable build condition)
2. A CLASS (catastrophic/hygiene)
3. A territory explanation — the scar or the industry's accumulated lesson that
   justifies the standard. A bench entry without its story is just a rule.

Bench standards without a confirming TRACE scar carry their territory (the industry's
accumulated lesson) in place of a scar — the lesson is earned by the field, not by us
specifically, and that is sufficient.

---

## THE BENCH

Identified, dormant — activate when the trigger fires.

These apply to our stack and will bite if unaddressed when we reach their territory.
They are written now so we adopt the proven path rather than improvise. Thunder reads
these every session (STEP 0) and matches builds against the ACTIVATE WHEN triggers.

---

### BENCH-A — PAYMENT DATA SAFETY (PCI / tokenization)

**ACTIVATE WHEN:** any code accepts money, handles card/bank data, or integrates a
payment processor (Stripe, etc.).
**CLASS:** 🔴 CATASTROPHIC — stop and get David's go before proceeding.

**Rule (when active):** Never touch, store, or log raw card/bank numbers. Use the
processor's tokenization (hosted fields / payment intents). Verify webhook signatures.
Use idempotency keys on charge operations (a double-tap must not double-charge).

**Territory (enterprise scar — not yet a TRACE scar):** The whole industry has bled
here — leaked card data is existential (PCI liability, customer trust, possibly
company-ending). This is the canonical "adopt the proven path, do not improvise"
standard. When we reach payments, we lift a proven integration; we do not invent one.

---

### BENCH-B — FILE UPLOAD / INGEST SAFETY

✅ **PROMOTED → STD-010 (2026-06-10).** Triggered by Receipt Keeper v1. David's
explicit go confirmed 2026-06-10. Full rule text lives in STD-010 above.

---

### BENCH-C — PII HANDLING

**ACTIVATE WHEN:** code stores, displays, exports, or transmits customer personal data
(names, addresses, phone, vehicle/customer records, anything identifying a real person).
**CLASS:** 🔴 CATASTROPHIC — stop and get David's go before proceeding.

**Rule (when active):** PII is tenant-scoped (rides on STD-004 isolation). Never log
PII in plaintext diagnostics or TRACE output. Never put PII in URL params/query strings.
Honor the customer-departure policy (customer takes what they paid for; identifiable
data removed; only aggregate patterns retained). Minimize what's collected and exposed.

**Territory:** Every vertical holds customer PII. Cultivar has customer records; Ignition
has customers + vehicles. The cross-vertical exposure bug (STD-004 scar) was a PII
near-miss. This formalizes the handling rules beyond just isolation.

---

### BENCH-D — EXTERNAL CALLBACK / WEBHOOK VERIFICATION

**ACTIVATE WHEN:** an external service calls back into our system (payment webhooks,
QB callbacks, any inbound POST from a third party).
**CLASS:** 🔴 CATASTROPHIC — stop and get David's go before proceeding.

**Rule (when active):** Verify the signature/secret on every inbound webhook before
acting on it. Never trust an unsigned callback. Treat the payload as untrusted input
(validate before use). Idempotency on webhook handlers (the same event may arrive twice).

**Territory (enterprise scar):** QB integration already exists; payment processors are
coming (BENCH-A). An unverified webhook is an open door for forged events (fake "payment
succeeded"). Industry scar — well-documented, catastrophic if skipped.

---

### BENCH-E — EXTERNAL AI PROVIDER RESILIENCE (provider chain / graceful degradation)

**ACTIVATE WHEN:** a Vercel function or server-side handler makes a live call to an
external AI provider (Gemini, Anthropic, OpenAI, Azure Vision, etc.) and the result is
user-facing — meaning the user receives a success/failure message based on whether the
call succeeds.
**CLASS:** 🟡 HYGIENE — apply and report. No stop-and-ask.

**Rule (when active):**
1. **Try-chain, not single-point.** If more than one provider can do the job, try them
   in sequence — each in its own isolated try/catch + timeout. One provider failing must
   NEVER propagate as an exception to the next; the chain continues.
2. **One failure never kills the chain.** A 404 (deprecated model), 429 (rate limit),
   500 (upstream error), or timeout from Provider A causes a log and fallthrough to
   Provider B — not a re-throw, not a crash.
3. **All-fail → clean user error.** If every provider fails, the response to the user is
   actionable and human ("Couldn't read this receipt — try a clearer photo or better
   lighting"), never a raw HTTP error code or exception message.
4. **Operator-greppable fallback log.** When a fallback fires, log:
   `[TRACE:<SUBSYSTEM>] provider-fallback fired: <primary>→<fallback>, reason: <first 120 chars of error>`.
   This is the operator signal — not a user-facing message.
5. **Never trust provider stability.** AI providers deprecate models without grace
   periods (confirmed: `gemini-1.5-flash` deprecated mid-session, returned HTTP 404 with
   no prior notice). ALWAYS check provider release notes when deploying AI features.
   Pinning to a specific model version without a fallback is a single-point-of-failure.
6. **Provider 3+ slot in comments.** When building a two-provider chain, leave a
   documented slot for a third provider (`// provider 3 slot: { name: 'azure', ... }`)
   so future expansion requires only a new entry in the array, not a new control-flow design.
7. **Model names are values, not source constants.** Never hardcode a model string as a
   TypeScript constant in the source file. A model swap must be a config change — edit a
   `platform_config` DB row or an env var (`OCR_PRIMARY_MODEL`) — not a source code edit,
   build, and deploy cycle. Resolution order: `platform_config` table → env var → hardcoded
   default (last resort only). The hardcoded default exists so the feature still works when
   the config table is not yet applied; it is NOT the intended configuration path.

**TRACE scar (2026-06-12):** `ocr.ts` used `gemini-1.5-flash` (no fallback). Google
deprecated the model. Google API returned HTTP 404. The old non-OK branch in `ocr.ts`
mapped any non-OK Gemini response to `res.status(502)` — our OWN code, not a Vercel
hard-kill. Every OCR request on a real receipt returned 502 to the user. The failure
was invisible until David tested with a real receipt photo. Because there was no fallback
chain, the feature was 100% dark the moment the model was deprecated. Fixed 2026-06-12:
model updated to `gemini-2.0-flash` + provider chain: Gemini 2.0 Flash primary →
Claude Haiku 4.5 vision fallback → clean 503 with actionable user message.

**TRACE scar (2026-06-11, second deprecation):** `gemini-2.0-flash` was deprecated within
3 days of the first fix, again returning 404. The pattern (hardcoded model constant in
source = code edit required on every deprecation) recurred immediately. Fix: externalized
model names to `platform_config` table (Layer 1) + `OCR_PRIMARY_MODEL` env var (Layer 2) +
hardcoded default (Layer 3, last resort). Model is now `gemini-2.5-flash` (validated in
bake-off against McCoy's receipt, scored PERFECT). A future deprecation requires only:
`UPDATE platform_config SET value='gemini-2.6-flash' WHERE key='ocr_primary_model';` — no
code edit, no deploy.

**In practice:**
- Every AI provider call that is user-facing: wrap in the try-chain pattern
- Provider selection array: `[{ name, canHandle, fn }]` — iterate, catch, continue
- `canHandle` gate prevents fruitless attempts (missing key, unsupported type for provider)
- For vision providers: Claude only supports jpeg/png/gif/webp — check before queuing;
  skip silently (counts as "canHandle: false"), not as an error
- Session checklist: before shipping any AI-backed user feature, ask "what happens when
  this provider returns 404, 429, or 503?"

**Scope:** Every Vercel function that makes a live external AI call and returns a
user-facing success/failure response. Receipt Keeper, future document parsers, vision
analysis features, AI generation paths that could surface provider errors to users.

---

## THUNDER INTELLIGENCE — match, flag, and propose

Standards are not a static list Thunder obeys — they are a roster Thunder matches
every build against. Per STEP 0, Thunder reads the FULL roster (Active + Bench)
every session.

**1. Match builds against the Bench.** While building, if the work matches a bench
standard's ACTIVATE WHEN trigger, Thunder surfaces it:
- **Catastrophic-class match:** STOP and ask David before proceeding. State the
  standard, why it applies, and that it's catastrophic-class. (Rare, high-value —
  these are the only mandatory stops; they are not noise, they are the guardrail working.)
- **Hygiene-class match:** apply the standard and report it ("applied BENCH-X because
  this build does Y"). No stop — reversible, low-cost, move-and-report.

**2. Flag general-knowledge candidates (catch scars before they bite).** Thunder's
training carries the full body of industry standards (the N/A set we didn't roster).
If a build touches territory that USUALLY has a safeguard and we have NO standard
(active or bench) for it, Thunder flags it: "this build does X; that territory usually
has a safeguard; we have no standard for it — want me to bench a candidate?" This is
how the roster grows ahead of the scar instead of after it.

**3. Never round up a standard's application.** Applying a standard partially and
calling it done is the half-truth class (see STD-001 / the no-round-up principle).
If a standard can't be fully applied, say so explicitly — do not mark it satisfied.

**4. David owns activation and override.** Thunder may SUGGEST promoting a bench
standard or benching a candidate. David decides. Overrides (choosing not to apply an
applicable standard) are documented per STD-005 in the override log, with the reasoning
and a revisit trigger — a conscious, recorded exception, never a silent skip.

**STEP 0 gate addition:** Every session prompt must include: "Read STANDARDS.md in
full, INCLUDING the Bench. While building, match the work against bench ACTIVATE WHEN
triggers and flag matches (catastrophic = stop-and-ask, hygiene = apply-and-report).
Flag any unsafe territory we have no standard for as a bench candidate. Never round up
a standard's application."

---

## CHANGELOG

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-04 | Created. Six standards seeded from session scars. Adopted immediately. |
| 1.1 | 2026-06-08 | STD-007 added. Scar: QB `accounting_needs_reconnect` lying flag — reactive-only flag kept dead connection silent. Fixed by proactive `accounting_token_expires_at` check in `qbo/status.ts`. |
| 1.2 | 2026-06-08 | STD-008 added. Scar: `20260604_social_drafts_voice_learning.sql` committed-but-unapplied — every generate-posts INSERT failed silently; loadSocialDrafts 400'd; ~0 rows across multiple sessions. STD-008 adds live-schema verification gate. |
| 1.3 | 2026-06-08 | STD-009 added. Scar: `campaigns/generate.ts` hardcoded '2 Instagram posts, 2 Facebook posts, 1 SMS' in AI prompt; never read `business_modules.config`. Business channel selections ignored by campaign generator for entire feature lifetime. LEXICON RULE added: "platform" reserved for top-level substrate; use "channel" inside the product. |
| 1.4 | 2026-06-09 | STD-008 extended bidirectionally. Renamed "DEPLOYED SCHEMA == ON-DISK MIGRATIONS (BOTH DIRECTIONS)". Inverse scar added: `social_drafts_platform_check` existed in live DB but in no committed migration; 'sms' not in allowed list; atomic batch INSERT rolled back all rows (instagram + tiktok + sms) when SMS enabled. Fixed by `20260609_social_drafts_platform_check.sql`. Sweep query added to verification pattern. |
| 1.5 | 2026-06-10 | Roster model added (Active/Bench/N/A). CANDIDATES section formalized into the trigger-tagged Bench: BENCH-A payments/PCI, BENCH-B file-upload (TRIGGER FIRING — Receipt Keeper v1; catastrophic-class; David's confirmation required before ship), BENCH-C PII, BENCH-D webhook verification. Thunder intelligence instructions added (match bench triggers, flag general candidates, never round up, David owns activation/override). STD-003 amended to corrected on-by-birth / commented-when-proven policy; flag-gate pattern retired as resting state; Tailwind born-silent scar added; active instrumentation subsystem tags listed. ENFORCEMENT table updated with BENCH-A–D row. Growth Policy updated for bench entries. File reframed as team-onboarding document (Erin/Andrew/Connor) — every standard carries its scar or territory as a lesson. |
| 1.6 | 2026-06-10 | BENCH-B promoted to STD-010 (FILE UPLOAD / INGEST SAFETY). David's explicit go confirmed 2026-06-10 — triggered by Receipt Keeper v1 Gemini Flash vision ingest path. STD-010 rule: real content-type validation, explicit size limits, per-tenant storage path, never-trust-content, OCR result is the artifact (not the raw file). BENCH-B entry replaced with promotion tombstone. ENFORCEMENT table: STD-010 row added; bench row updated to BENCH-A, BENCH-C, BENCH-D. |
| 1.7 | 2026-06-12 | BENCH-E added — EXTERNAL AI PROVIDER RESILIENCE (provider chain / graceful degradation). TRACE scar: `gemini-1.5-flash` deprecated mid-session → Google 404 → our own `res.status(502)` on every receipt OCR request until the model was updated. No fallback existed → feature was 100% dark on model deprecation. Fixed 2026-06-12: `ocr.ts` now uses `gemini-2.0-flash` (primary) + Claude Haiku 4.5 vision (fallback) + clean 503 all-fail. Rule: try-chain with isolated catches, one-failure-never-kills-chain, all-fail clean user error, operator-greppable fallback log, provider 3+ slot in comments. Hygiene-class: apply and report, no stop-and-ask. |
| 1.8 | 2026-06-11 | BENCH-E Rule 7 added — MODEL NAMES ARE VALUES, NOT SOURCE CONSTANTS. Second scar added: `gemini-2.0-flash` deprecated 3 days after the first fix, again requiring a source-code edit + deploy cycle. Fix: model names externalized to `platform_config` table (Layer 1) → `OCR_PRIMARY_MODEL` env var (Layer 2) → hardcoded default (Layer 3, last resort). Model is now `gemini-2.5-flash` (validated in bake-off). A future deprecation = one DB row edit, no code change. |

---

*TRACE Enterprises · Built with CAI*
*Update this file when a new scar earns a standard. Never adopt standards by reputation.*
