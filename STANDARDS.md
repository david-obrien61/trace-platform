# STANDARDS.md — TRACE Engineering Standards
# Version: 2.4
# Created: 2026-06-04
# Last updated: 2026-07-16 (STD-019 added + ACTIVATED — external identity binds on the field the external system guarantees unique; ambiguity never auto-links; a stored link is a CACHE, not a FACT. Scar: an email-only QBO match with no name verification and a never-re-checked stored link cross-billed NINE real invoices to the wrong person over two months — silent because every TRACE surface showed the correct customer. D-47.)
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

- **ACTIVE** (on the field — enforced now): STD-001 through STD-019 below. Each has
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

### STD-011 — ONE CANONICAL REPRESENTATION PER FACT (no ambiguity in state/access/value)

**Rule:** A fact with a single true meaning MUST have exactly ONE canonical
representation across the entire platform — one column, one enum, one predicate, one
helper function — referenced everywhere, never re-derived, re-spelled, or duplicated.
When the fact changes, it changes in ONE place and the whole platform inherits it
correctly, because nothing else CONTAINS the fact to drift out of sync.

**Why this is a security/correctness standard, not style:** Two representations of one
fact can disagree, and when they disagree nothing errors — it silently does the wrong
thing. In access, tenant-boundary, and value facts, that silence IS the leak. Examples
of the disease, all the same root (duplicated representation of a single fact):
- "active member" spelled `active = true` (EXISTS) AND `IN (...)` AND one policy
  omitting the active filter entirely (the `md_self` leak — a revoked member kept
  access).
- tax rate as both a `VITE_TAX_RATE` env var (unread) and a hardcoded `TAX_RATE`
  constant (the one actually used) — the documented knob is decorative; the real value
  is buried.
- model ids split across `platform_config`, inline `CAPABILITIES` literals, and a
  hardcoded endpoint — no single source, drift-prone (the opus-4-1 vs 4-8 near-miss).
- `unit_cost` meaning both private cost AND public sell price on the same column.

**Encoding (how to make a fact canonical):**
- Boolean/state fact → ONE column, checked via ONE shared helper (e.g. SECURITY DEFINER
  `is_active_member(business_id)` — referenced by every member-scoped RLS policy, never
  re-written inline). Helpers also resolve RLS recursion safely.
- Enum/status fact → ONE definition of the allowed value set (DB CHECK or enum), one
  source the app and UI reference — never re-spell the values in app constants or UI
  literals.
- Config/driftable value (model ids, rates, thresholds) → ONE findable, swappable home
  per the config doctrine; never inline-and-forgotten, never duplicated.

**Enforcement:**
- New sensitive columns/policies that re-derive a fact instead of referencing its
  canonical form are INCOMPLETE — same force as the two-bar and verify-before-build
  gates.
- A consistency sweep (auditing every representation of a fact) is a recognized
  hardening tool: it finds CORRECTNESS bugs, not just style. The membership-active
  sweep found a live leak (`md_self`) and a functional cliff (Staff blocked from
  owner-only operational tables) that single-instance fixing would have missed.

**Cross-references:**
- AC-4 (settle once, encode as variable) — this is AC-4 promoted to a data-integrity
  invariant with a security consequence.
- AC-2/AC-3 (membership-scoped RLS, tenant isolation absolute).
- Config doctrine (one home per driftable value) — same disease, value-fact flavor.

**Recorded open items spawned by the first application of this standard:**
- Owner-only operational tables (`orders`, `customers`, plants, `order_items`,
  pre-2026-06 operational tables) have NO member policy → STAFF resolves but is
  RLS-blocked from `orders`/`customers` despite `view_orders`/`qr_checkout`. NEXT
  hardening item: decide and apply Staff-appropriate member RLS — a PRODUCT decision
  (what does Staff see, scoped how, PII?), not a mechanical refactor. Link to this
  standard + the member-rls audit (`data/grower-scan/member-rls-consistency-audit.md`).

**Scope:** Every fact with a single true meaning that is read in more than one place —
access/state booleans (membership, active, role), tenant-boundary predicates, enum/
status value sets, and driftable config values (model ids, rates, thresholds). Every
new sensitive column, RLS policy, or shared predicate.

---

### STD-012 — SERVER-AUTHORITATIVE PRICING, ONE COMPUTATION

**Rule:** Any price, discount, or tax a customer is charged is computed by ONE
server-authoritative function. The client never holds a pricing computation that can
diverge from the server; an interactive surface may recompute ONLY by calling the same
function with the same inputs. Every display surface (review, confirmation, invoice,
QBO, email) renders from that one output — no surface re-derives.

**PERSISTENCE CLAUSE (2026-07-13, D-43):** For any charge breakdown a customer or owner
must SEE after the transaction (discount, tax, per-line detail), the computation is
PERSISTED on the order at submit; post-transaction surfaces RENDER the stored breakdown,
they do not recompute. Recompute-per-surface is the anti-pattern — it fragments into N
copies that drift, and any surface that computes NOTHING (order-detail, QBO) simply shows
nothing. An invoice stores its own lines; you don't recompute an invoice every time you
view it. Frozen-at-charge: a later tier/price change cannot make a displayed discount
disagree with the total, because surfaces read history, not a live recompute. Pre-submit
surfaces (Review) legitimately compute live — nothing is stored yet — but they call the
SAME function, so their preview equals what will be persisted. A stored breakdown must
reconcile to what was charged (retail_total − discount_amt === net_total per line);
historical rows that never stored a breakdown render net only — never a fabricated
partial discount line (D-9 omit-not-fake).

**Scar (2026-07-10):** The Review page ran its own pricing (`Σ raw sell_price × qty`,
tier never applied) and showed $124/each + a $3539.78 total, while submit/QBO applied
the tier correctly at $115.20/each + $3418.54 — ~$121 hidden inside a Review that looked
fine. The bug recurred a second time (`orderTier` null on the CustomerCapture path →
Review silently priced at retail). Fixed by `computeOrderPricing` as the single shared
function (D-39), with the client resolving the tier from the same authoritative inputs
submit uses (E1).

**Scar (2026-07-13 — the persistence gap, D-43):** The tier discount was CHARGED
correctly ($115.20) but the show-the-work discount LINE rendered only on Review and
Confirmation, NOT on order-detail (`/orders/:id`) or the QBO invoice — because submit
COMPUTED the full per-line breakdown (`computeOrderPricing`) then DISCARDED it, persisting
only the net `unit_price`/`subtotal` ([submit.ts:615-616]). Every downstream surface had
nothing to read, so it could not show the discount; "recompute per surface" would have
fragmented the one computation into copies. This resurfaced repeatedly. Fixed (D-43) by
PERSISTING the breakdown on `order_items` (`retail_unit`/`discount_pct`/`discount_amt`) at
submit — on create AND edit (STD-016) — and having order-detail + both QBO surfaces RENDER
the stored fact (no recompute). This scar is why the PERSISTENCE CLAUSE above exists: the
STEP 0 roster-match now catches "are you persisting the breakdown or recomputing it
downstream?" on every future pricing-display build.

**In practice:**
- One pricing function in `packages/shared`; submit is the tamper-defended authority.
- A client surface that must show live totals calls THAT function with THE SAME inputs —
  never a parallel/preview calc.
- Read-only surfaces render the server's returned numbers; they do not recompute.
- Any client-held pricing snapshot (tier, rate) is a divergence risk: resolve from
  authoritative inputs, treat the snapshot as a fast-path only.
- PERSIST the breakdown at submit (per-line retail/discount/net) so post-transaction
  surfaces (order-detail, invoice, QBO, email) RENDER the stored fact instead of
  recomputing or showing nothing. Persist on the edit path too, or the stored breakdown
  goes stale vs the re-charged net (STD-016). Enforce the reconcile invariant on write
  (retail_total − discount_amt === net_total). Render net-only for historical rows that
  never stored a breakdown — never a fabricated partial discount line.

**Relationship:** Extends STD-011 (one canonical representation) from a stored fact to a
computed output — pricing is a fact-in-motion, and two computations of it drift exactly as
two representations of a fact do (see AC-4).

**Scope:** Every build touching order pricing, discounts, or tax on more than one surface.

---

### STD-013 — MONEY-AFFECTING OVERRIDES ARE REASON-CODED, GATED, AND LOGGED

**Rule:** No money-affecting override (price override, discount application, tax
exemption, waiver) may zero or alter a charge without: (1) a recorded REASON, (2) a
grantable named permission gating who may do it, and (3) an actor + timestamp on the
record. A $0 with no reason is indistinguishable from a mistake or fraud — never allow it.

**Territory / scar (2026-07-13):** Tax exemption forced this into the open — zeroing tax
must record WHY (resale / ag / nonprofit / gov / other-with-free-text), under a grantable
`apply_tax_exempt`, logged with the actor. The same shape governs the discount override
and the placement-price override already in the product (the leakage-override gate,
ledger #108 / #115). The anon/public path can NEVER self-apply an override — the server
ignores it and logs the refusal (tamper defense).

**In practice:**
- Override authority = a named action permission in `actionPermissions.ts` (declare-and-
  union), server-enforced, defaulted per role.
- Zeroing/reducing a charge REQUIRES a reason field (free-text mandatory for "other").
- Actor via `resolveCallerUid` written to the record; the public/anon path is refused
  and logged.
- Build sibling authorities as a matched pair — a legal exemption and a commercial
  discount are delegated and audited differently; do not collapse them into one grant.

**Scope:** Every build that lets a user reduce, zero, or override a computed charge.

---

### STD-014 — SOURCED CONFIG, HONEST-UNSET (NEVER A FABRICATED DEFAULT)

**Rule:** A per-tenant operational value the platform cannot legitimately KNOW (tax rate,
locale, jurisdiction settings) is SUPPLIED DATA, never a hardcoded default. "Unset" must
be a real, distinguishable state that surfaces honestly (redlined "not identified"), never
silently coerced to one tenant's value. A `NOT NULL DEFAULT <one-tenant's-value>` on such
a field is the anti-pattern.

**Scar (2026-07-13):** `businesses.tax_rate` was `NOT NULL DEFAULT 0.0825` (TX = LAWNS's
rate). Every tenant who never set it was silently given Texas's rate — and "chose 8.25%"
was indistinguishable from "never set it." Compounded by a hardcoded "Tax (8.25%)" literal
in the shared customer-facing email → every non-TX tenant's customer saw a wrong tax. Prior
ancestor: the `VITE_TAX_RATE` decorative env var (STD-011). Fixed by moving the rate to
`config.taxRate` jsonb where ABSENCE = "not identified" for free, forcing every tenant
(incl. LAWNS) to honestly re-confirm; the owner enters their own rate (linked to the
official jurisdiction locator — the platform never computes it).

**In practice:**
- Home the value where absence is expressible (jsonb key absent = unset), not a
  NOT-NULL-defaulted column.
- Capture it from the owner; where correctness depends on jurisdiction, link the owner to
  the authoritative external source — never guess it for them.
- Unset renders a LOUD redline ("not identified — set it in Settings"), never $0-as-fact,
  never blank, never a fabricated number (this is D-9 omit-not-fake made explicit).

**Relationship:** Descends from STD-011's `VITE_TAX_RATE` ancestor but carries a distinct
lesson: STD-011 forbids DUPLICATING a value across representations; STD-014 forbids
FABRICATING a default for a value the platform cannot know, and requires that "unset" be
honest.

**Scope:** Every per-tenant value the platform cannot compute from first principles —
tax rate, locale, jurisdiction, regulatory settings.

---

### STD-015 — NO TENANT IDENTITY IN SHARED OR CUSTOMER-FACING CODE

**Rule:** No specific tenant's brand, name, address, phone, email, or contact may be a
literal in shared code or on a customer-facing surface. Tenant identity is threaded as a
per-tenant, `business_id`-scoped data token; when a field is unresolvable, OMIT it (fall
to platform default) — never substitute another tenant's value.

**Scar (2026-07-13):** The shared notification templates were fully LAWNS-hardcoded —
subject, body, SMS, footer chrome — so every non-LAWNS tenant's customer received an email
branded "LAWNS Tree Farm." A prior checkout-UI sweep (register H1–H9) had cleared the
visible surfaces but never scoped the notification templates. A full sweep then confirmed
zero customer-facing tenant hardcodes remain and no cross-tenant DB read exists; the
residue is bounded owner-UI placeholders. Fixed (ledger #116) by threading a
`NotifyBusiness` token from the active business context, omit-not-fake on missing fields.

**In practice:**
- Tenant identity = a token resolved from the active `business_id`-scoped context, never a
  literal in `packages/shared`.
- Unresolvable field → omit (or platform default) — NEVER another tenant's value.
- New hardcodes of this class are registered in `HARDCODED-REGISTER.md`; notification
  templates are now in scope for that register.
- Applies to EVERY customer-facing surface: email, SMS, invoice, QBO, receipt, opt-in copy.

**Relationship:** Extends AC-1 (STD-006 — vertical-agnostic identifiers) and AC-3 (tenant
isolation absolute) to the customer-facing RENDER layer: STD-006 forbids vertical NOUNS in
shared schema/code; STD-015 forbids a specific TENANT's identity as a literal on any
surface a customer sees.

**Scope:** Every shared module and every customer-facing render path.

---

### STD-016 — ORDER EDITS RECOMPUTE THROUGH THE CANONICAL PRICING PATH

**Rule:** Editing an existing order (qty, lines, services, delivery) recomputes the WHOLE
money boundary through the same canonical pricing function a new order uses — tier, basis,
taxability, tax, exemption — never a partial or off-seam recompute.

**Scar (ongoing — ledger #107 / #114):** `submit.ts handleUpdate` (roster order edit)
recomputed baseline `sell_price` only — not tier/basis-aware — and computed tax off-seam
(`subtotal × taxRate` directly, bypassing `computeOrderPricing`). An edited tiered order
could silently drop its discount or mis-tax. The gap has been carried across multiple
builds; D-40 folds the off-seam tax back through the one computation.

**In practice:**
- The order-edit path calls the SAME `computeOrderPricing` as create — no separate math.
- Re-resolve tier, taxability, and exemption on edit; preserve no stale line math.

**Relationship:** This is STD-012 applied specifically to the edit path — the place it
keeps regressing. It is kept as its own standard (rather than a clause of STD-012) so the
ongoing, recurring `handleUpdate` regression carries its own roster line and its own
ACTIVATE trigger (an order-edit build), which is what a repeatedly-recurring scar needs to
be matched at STEP 0. (David may fold this into STD-012 as a clause if he prefers.)

**Scope:** Every build touching order editing / update after creation.

---

### STD-017 — A FIX IS COMPLETE ONLY WHEN TRUE ON EVERY SURFACE THE CAPABILITY TOUCHES

**Rule:** A capability renders, persists, or reads on multiple surfaces. A fix is NOT
complete when it is true on the surface that motivated it — it is complete only when true
on EVERY surface that capability touches. Before building a fix, ENUMERATE the capability's
surfaces (all display surfaces for a value; the capture surface AND every reader for a
field; create AND edit paths for an order). The build makes the fix true on all of them, or
explicitly scopes which and flags the rest. OWNER-PROVE tests EVERY surface, not the
motivating one.

**Corollary (capture-persist-read continuity):** entered data is not "captured" until it
reaches the table its reader queries; a column that is written-but-never-read or
read-but-never-written is an orphan and a defect.

**Scar (2026-07-14, six instances in one validation sweep):** the tier discount showed on
Review/Confirmation but NOT on the real QBO push (customer's actual invoice showed net with
no discount line); order EDIT dropped the D-43 breakdown that CREATE persisted; count
captured size/qty into `inventory_counts` but the order picker read `business_inventory`
(counted data invisible); `variant_group` was READ by the picker but no UI WROTE it; tax
exemption set in the editor didn't render consistently across all display surfaces; `billing_*`
and `tax_id` were captured in the customer editor but read by nothing. One discipline gap —
no surface-consistency check — expressed six times. Each fix had been verified on ONE surface
and assumed complete.

**In practice:**
- Before a fix: list the capability's surfaces (grep the value/field/table across the
  codebase). The prompt fixes all, or scopes explicitly.
- STEP 0 roster-match asks: "this fix touches capability X; X renders/persists/reads on
  surfaces A,B,C,D — is the change true on all of them?"
- Owner-prove enumerates surfaces: "discount shows on Review AND Confirmation AND
  order-detail AND real QBO AND email" — not "discount shows [where I looked]."
- Orphan check: any column written-but-not-read or read-but-not-written is flagged (not
  necessarily fixed, but recorded, never silently shipped).
- Extends STD-012 (one computation) with surface-completeness: computing once is not enough
  if only some surfaces render it.

**Relationship:** STD-012 says compute pricing ONCE; STD-017 says a fix (pricing or
otherwise) is true on EVERY surface the capability touches. STD-012's persistence clause is
the pricing-shaped instance of this general rule — persist once so all surfaces render the
same fact; STD-017 generalizes it to any capability with more than one surface (a captured
field and its readers, a value's display surfaces, an order's create vs edit paths).

**Scope:** Every fix or build touching a capability that has more than one surface (any
pricing/tax value; any customer/order field; any create-vs-edit path; any capture-then-read
flow).

---

### STD-018 — A CAPABILITY SHIPS ITS FULL ENTRY SURFACE (CRUD is C+R+U+D, enumerated at build time)

**Rule:** A capability that lets an owner MANAGE data must ship its FULL entry surface — the manual
CRUD (Create, Read, Update, Delete) **plus** any automated / sensory entry paths its workflow needs
(scan, OCR, import). **Update and Delete are not optional and are enumerated at BUILD time, not
discovered at USE.** When a build introduces or touches an owner-managed entity, it states the entity's
full entry surface and either implements each operation or explicitly scopes-and-flags what is deferred
(and why). "Create works" is not "the capability is built."

**Scar (2026-07-14):** Inventory. **Create** was built three separate ways (the Add-Item form, the
D-45 scan-count promote, the discovery CSV import), while **Update** was partial (no clean per-size
qty/price edit surface, no "add another size" affordance) and **Delete was entirely missing**. The gap
surfaced only when David needed to add a second size to an existing variety and found no path — and even
manual entry of a second row would have left the sizes ungrouped, so the checkout size-picker never
fired. The same shape recurs across the platform: Create+Read got built at first need; Update+Delete
were skipped and rediscovered later at the point of use, each as its own "why can't I edit/delete this?"
moment. One discipline gap — the entry surface was never enumerated — expressed as a class of missing
operations.

**In practice:**
- At build time, LIST the entity's entry surface: Create · Read · Update · Delete · (+ scan / OCR /
  import if the workflow uses them). The build implements each or records an explicit, reasoned deferral.
- **Update means the FULL owner-editable field set**, reachable through ONE editor surface (STD-011),
  not a subset that forces the owner to a workaround for the rest.
- **Delete means a real, safe delete policy** — decide soft (deactivate/archive, preserve referenced
  history) vs hard (remove when unreferenced) by checking the entity's FKs; confirm-first; log the actor.
- A capability whose Update or Delete is missing is INCOMPLETE — same force as the surface-completeness
  (STD-017) and capture-persist-read gates. It does not render green while an entry operation is absent
  without a recorded reason.

**Relationship:** STD-017 says a fix is true on every SURFACE a capability touches; STD-018 says a
capability ships every OPERATION its entry surface requires. STD-011 supplies the "one editor, not
parallel forms" shape that makes a complete Update+Create tractable. Together: one entity, one editor,
every operation, every surface.

**Scope:** Every build that introduces or touches an owner-managed entity (a table the owner creates,
edits, and removes rows in — inventory, customers, assets, service offerings, and the like).

---

### STD-019 — EXTERNAL IDENTITY BINDS ON THE GUARANTEED-UNIQUE FIELD; AMBIGUITY NEVER AUTO-LINKS; A STORED LINK IS A CACHE, NOT A FACT

**Rule:** When a TRACE record is bound to a record in an external system (a QBO customer, a Stripe
customer, a supplier's catalog item), three clauses hold:

1. **Bind on the field the external system GUARANTEES unique.** Identify what that system enforces
   unique versus what it merely permits to collide, and key identity on the former. A field the
   external system explicitly allows to collide is not an identity key — it is a hint.
2. **Two independent fields must CONCUR before binding.** One matching field is a hint, not an
   identity. Ambiguity resolves to **CREATE** or **SURFACE** — never a guessed link. This is
   asymmetric on purpose: the costs are asymmetric (a duplicate record is annoying and fixable in
   seconds; a mis-bind is money, trust, and legal). When the two directions cost differently, the
   rule leans toward the cheap failure.
3. **A stored external link is a CACHE, not a FACT — verify before use.** Re-check the cached
   foreign id against the live external record before acting on it. A binding that is written once
   and trusted forever converts a single bad match into an unbounded run of them.

**Scar (2026-07-15, PROVEN LIVE — nine invoices, two months):** `findOrCreateQBCustomer` resolved a
TRACE customer → a QBO customer with `select * from Customer where PrimaryEmailAddr = '<email>'`
→ `Customer[0]`. **`DisplayName` was not in the predicate; no name was ever compared.** TRACE
"TERRENCE OBRIEN" / david_obrien2016@outlook.com bound to QBO customer **81 = "Andrew O'Brien"**
because they share an email. **NINE real invoices** in TRACE Enterprises' production QuickBooks
were billed to Andrew for sales that never happened.

Three failures compounded, one per clause:
- **Clause 1 —** QBO enforces `DisplayName` UNIQUE and does **NOT** enforce unique email. TRACE
  matched on the one field QBO permits to collide (families share an email — literally the case
  here; an office shares one across staff) and ignored the one it guarantees.
- **Clause 2 —** a single field decided the bind, and `Customer[0]` — an arbitrary first hit —
  broke the tie when several records shared the email.
- **Clause 3 —** once `qb_customer_id` was stored, every later push **skipped find-or-create
  entirely** and billed the stored id with no re-verification. The mis-link was made once, on
  invoice #1, and never questioned again for nine invoices. **This is the clause that earned the
  standard:** clauses 1 and 2 cost one wrong invoice; clause 3 is what made it nine.

**Why it was silent — the property that makes this class dangerous:** every TRACE surface showed the
correct customer throughout. Review, Confirmation, order-detail, the roster — all correct. The
mis-billing existed **only in the external system**. It surfaced after two months, when David opened
QuickBooks and read the name. **No amount of testing TRACE's own surfaces would ever have caught
it.** A binding defect lives at the boundary — the one place our own surfaces never look back at —
so STD-017's "true on every surface" does not reach it. The external record IS a surface.

**In practice:**
- Before building any external binding, **state which field that system guarantees unique** and bind
  on it. If the answer isn't known, find it in the provider's docs — do not assume email/name/phone.
- Query the external system on **both** fields and resolve the union; resolving on one reintroduces
  single-field blindness.
- Normalize both sides before comparing, and make **absence a non-match** — two blank names both
  reduce to the empty set, and naive equality calls that agreement (D-9 applied to identity: absence
  is not agreement).
- Ambiguity → CREATE or SURFACE. **Surface it as an owner-actionable refusal** (not a generic 500):
  a real ambiguity is a decision only the owner can make, and refusing is recoverable where
  mis-binding is not.
- **Re-verify the stored link before every use.** Drift or unreadable → refuse and flag loudly.
- **Guard the collision:** two TRACE records must never carry one external id. (Race-proof form: a
  partial unique index on `(business_id, <external_id>)`.)
- Never route around a collision by manufacturing a junk record (the retired
  email-as-DisplayName fallback) — that hides the collision from the owner, which is the disease.

**Relationship:** STD-007 governs derived connection STATE (is the token alive) — this governs
identity BINDING (is it the right party). STD-011 governs one canonical representation of an
INTERNAL fact — this governs which field of an EXTERNAL system carries identity, and what to do when
it is ambiguous. STD-017 says a fix must be true on every surface a capability touches; this extends
that reach **past our own boundary**: the external record is a surface, and it is the one our
testing never sees. D-9 (omit-not-fake) is the parent principle — applied to identity, it reads:
never guess a person.

**Scope:** Every build that binds a TRACE record to a record in an external system — QBO
customers/items/accounts, a payment processor's customer (BENCH-A territory), a supplier catalog,
any future connector. Fires on the first bind, not at volume.

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
| STD-011 | Every fact read in more than one place (access/state booleans, tenant predicates, enum/status sets, driftable config values); every new sensitive column/policy/shared predicate | One canonical representation referenced everywhere; new column/policy re-deriving a fact instead of referencing its canonical form = INCOMPLETE |
| STD-012 | Every build touching order pricing/discounts/tax on more than one surface | One server-authoritative pricing fn; interactive surfaces call it with the same inputs, read-only surfaces render its output — no surface re-derives |
| STD-013 | Every build that lets a user reduce/zero/override a computed charge | Recorded reason + grantable named permission (server-enforced) + actor/timestamp logged; anon/public path refused and logged |
| STD-014 | Every per-tenant value the platform cannot compute from first principles (tax rate, locale, jurisdiction) | Value sourced from data; absence expressible and honestly redlined; no `NOT NULL DEFAULT <one-tenant's-value>` |
| STD-015 | Every shared module + every customer-facing render path (email/SMS/invoice/QBO/receipt/opt-in) | No tenant identity literal; identity threaded as a `business_id`-scoped token; unresolvable → omit, never another tenant's value |
| STD-016 | Every build touching order editing/update after creation | Edit recomputes the whole money boundary through the same canonical pricing fn as create (tier/basis/tax/exemption) |
| STD-017 | Every fix/build touching a capability with more than one surface (pricing/tax value, customer/order field, create-vs-edit path, capture-then-read flow) | Enumerate the capability's surfaces before building; fix true on ALL (or explicitly scoped + rest flagged); owner-prove enumerates EVERY surface; orphan columns (written-not-read / read-not-written) flagged |
| STD-018 | Every build introducing/touching an owner-managed entity (a table the owner creates/edits/removes rows in — inventory, customers, assets, service offerings) | Enumerate the full entry surface at build time (C+R+U+D + scan/OCR/import as the workflow needs); implement each or explicitly scope-and-flag the deferral; Update = full field set via ONE editor (STD-011); Delete = safe soft/hard policy by FK check, confirm-first, actor logged |
| STD-019 | Every build that binds a TRACE record to an external system's record (QBO customer/item/account, payment-processor customer, supplier catalog, any connector) | Bind on the field the external system GUARANTEES unique (never one it permits to collide); two independent fields must concur before binding; ambiguity → CREATE or SURFACE, never a guessed link; a stored external id is a CACHE — re-verify against the live record before acting on it; collision-guard the id; absence is never agreement |
| BENCH-A, BENCH-C, BENCH-D, BENCH-F | Every session (STEP 0 roster match against ACTIVATE WHEN triggers) | Catastrophic-class match → stop and ask David; hygiene-class match → apply and report |
| BENCH-E | Any session that adds an external AI provider call that is user-facing | Apply try-chain pattern; provider 3 slot in comments; operator log on fallback; clean user error on all-fail |
| BENCH-G | Any session adding/altering a compliance action whose history is auditable (tax exemption apply/remove, waiver, money-authority grant) | Hygiene: write the immutable event row alongside current-state columns; escalates to catastrophic (BENCH-F) if it touches an issued invoice |

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

**TRACE scar (2026-06-11):** `ocr.ts` used `gemini-1.5-flash` (no fallback). Google
deprecated the model. Google API returned HTTP 404. The old non-OK branch in `ocr.ts`
mapped any non-OK Gemini response to `res.status(502)` — our OWN code, not a Vercel
hard-kill. Every OCR request on a real receipt returned 502 to the user. The failure
was invisible until David tested with a real receipt photo. Because there was no fallback
chain, the feature was 100% dark the moment the model was deprecated. Fixed 2026-06-11:
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

### BENCH-F — INVOICE LIFECYCLE: SEQUENTIAL, IMMUTABLE, VOID-NOT-DELETE

**ACTIVATE WHEN:** a build adds invoice editing after send, invoice deletion, invoice
numbering, or a "correct/cancel an issued invoice" flow.
**CLASS:** 🔴 CATASTROPHIC — stop and get David's go before proceeding.

**Rule (when active):** Invoices carry gap-free per-tenant sequential numbers; a SENT
invoice is immutable — corrections happen by VOID + credit-note + reissue, never by
editing or deleting the original. Invoice state is an explicit lifecycle
(draft → sent → paid → void), not an ad-hoc flag.

**Territory (enterprise scar — not yet a TRACE scar):** Invoicing is a compliance surface.
Editing or deleting a sent invoice, or non-sequential numbering, is an audit failure in
every jurisdiction — a scar the whole industry has already bled for; we inherit the lesson
without re-bleeding. TRACE computes and sends invoices (QBO push, confirmation) but does
not yet enforce numbering immutability or a void/credit path — an order edit today
recomputes in place (STD-016; ledger #107 / #114) rather than void-and-reissue.

**In practice (when activated):**
- Per-tenant sequential numbering, gaps disallowed; a voided number stays consumed.
- Sent invoice is read-only; corrections = void + credit note + new invoice.
- Explicit state machine; transitions logged.
- Reconcile with the QBO boundary (D-37): TRACE originates the charge; the void/credit
  must round-trip to QBO honestly.

**Scope:** Any invoice generation, editing, numbering, or cancellation build.

---

### BENCH-G — IMMUTABLE AUDIT RECORD FOR COMPLIANCE-AFFECTING ACTIONS

**ACTIVATE WHEN:** exemption/waiver volume becomes material, OR a build adds a compliance
action whose HISTORY (not just current state) could be audited — removal of a standing
exemption, retroactive waiver, changing an issued charge.
**CLASS:** 🟡 HYGIENE — apply and report. (Escalates to catastrophic if it touches an
already-issued invoice — then BENCH-F governs.)

**Rule (when active):** A compliance-affecting event (tax exemption applied or REMOVED, a
legal waiver, a permission grant on money authority) is recorded as an IMMUTABLE event row
capturing who / when / why / evidence — not merely the current-state columns on the mutable
parent record. Current-state columns show what IS; an audit needs what HAPPENED.

**Territory:** The risk case is a REMOVED exemption — mutable columns on the order show the
current state, not the event that a standing-exempt customer was un-exempted for one order.
The `order_compliance_records` immutable-row pattern (the netting accept/decline precedent)
is the proven shape. D-40 ships exemption on order columns for Level 1 (sufficient to render
+ attribute); the immutable record is the named hardening.

**In practice (when activated):**
- Append-only row per compliance event: `{ entity, action, reason, cert/evidence, actor,
  timestamp }`, mirroring `order_compliance_records`.
- The mutable parent still carries current state for rendering; the row carries history.

**Scope:** Tax exemption, legal waivers, money-authority grants, any charge alteration
whose history is auditable.

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
| 1.7 | 2026-06-11 | BENCH-E added — EXTERNAL AI PROVIDER RESILIENCE (provider chain / graceful degradation). TRACE scar: `gemini-1.5-flash` deprecated mid-session → Google 404 → our own `res.status(502)` on every receipt OCR request until the model was updated. No fallback existed → feature was 100% dark on model deprecation. Fixed 2026-06-11: `ocr.ts` now uses `gemini-2.0-flash` (primary) + Claude Haiku 4.5 vision (fallback) + clean 503 all-fail. Rule: try-chain with isolated catches, one-failure-never-kills-chain, all-fail clean user error, operator-greppable fallback log, provider 3+ slot in comments. Hygiene-class: apply and report, no stop-and-ask. |
| 1.8 | 2026-06-11 | BENCH-E Rule 7 added — MODEL NAMES ARE VALUES, NOT SOURCE CONSTANTS. Second scar added: `gemini-2.0-flash` deprecated 3 days after the first fix, again requiring a source-code edit + deploy cycle. Fix: model names externalized to `platform_config` table (Layer 1) → `OCR_PRIMARY_MODEL` env var (Layer 2) → hardcoded default (Layer 3, last resort). Model is now `gemini-2.5-flash` (validated in bake-off). A future deprecation = one DB row edit, no code change. |
| 1.9 | 2026-06-22 | STD-011 added — ONE CANONICAL REPRESENTATION PER FACT. Origin: the membership-active RLS consistency sweep (`data/grower-scan/member-rls-consistency-audit.md`) found "active member" spelled 3 ways across policies, with one (`md_self`) omitting the active filter entirely → a revoked member kept self-device access (live leak). Same disease as the `VITE_TAX_RATE` decorative env var, split model ids, and `unit_cost` dual-meaning. Rule: a single-meaning fact has exactly ONE canonical representation (one column/enum/predicate/helper) referenced everywhere, never re-derived. Promotes AC-4 to a data-integrity invariant with a security consequence; a consistency sweep is a recognized correctness-hardening tool. Open item recorded: owner-only operational tables have no member policy → Staff RLS-blocked despite perms (a product decision, next hardening item). |
| 2.0 | 2026-07-13 | STD-012 added — SERVER-AUTHORITATIVE PRICING, ONE COMPUTATION. Scar (2026-07-10): the Review page ran its own pricing (`Σ raw sell_price`, tier never applied) → $124/ea, $3539.78 while submit/QBO applied the tier at $115.20/ea, $3418.54 — ~$121 hidden in a Review that looked fine; recurred (`orderTier` null on CustomerCapture → retail). Fixed by `computeOrderPricing` as the single shared fn (D-39) + client resolving the tier from the same authoritative inputs (E1). Extends STD-011 to a computed output. |
| 2.1 | 2026-07-13 | STD-012 PERSISTENCE CLAUSE added (D-43). Scar: the tier discount was CHARGED correctly but the show-the-work discount LINE rendered only on Review/Confirmation, NOT on order-detail or QBO — submit computed the full breakdown then DISCARDED it, persisting only net `unit_price`/`subtotal`; downstream surfaces had nothing to read. Resurfaced repeatedly. Fixed by PERSISTING the breakdown on `order_items` (`retail_unit`/`discount_pct`/`discount_amt`) at submit (create AND edit — STD-016) and having order-detail + both QBO surfaces RENDER the stored fact (no recompute). The clause: for any post-transaction charge breakdown, compute ONCE at submit, persist, render stored — recompute-per-surface is the anti-pattern. Reconcile invariant: retail_total − discount_amt === net_total; historical (null) rows render net only (D-9). |
| 2.0 | 2026-07-13 | STD-013 added — MONEY-AFFECTING OVERRIDES ARE REASON-CODED, GATED, AND LOGGED. Territory/scar (2026-07-13): tax exemption forced it open — zeroing/reducing a charge requires a recorded reason + grantable named permission (server-enforced) + actor/timestamp; a $0 with no reason is indistinguishable from a mistake or fraud; the anon/public path can never self-apply (server ignores + logs). Same shape governs the discount + placement-price overrides. |
| 2.0 | 2026-07-13 | STD-014 added — SOURCED CONFIG, HONEST-UNSET (NEVER A FABRICATED DEFAULT). Scar (2026-07-13): `businesses.tax_rate` was `NOT NULL DEFAULT 0.0825` (TX/LAWNS) → every unset tenant silently given Texas's rate; "chose 8.25%" indistinguishable from "never set it"; compounded by a hardcoded "Tax (8.25%)" email literal. Ancestor: the `VITE_TAX_RATE` decorative env var (STD-011). Fixed by `config.taxRate` jsonb (absence = "not identified"); owner enters own rate, platform never computes it. |
| 2.0 | 2026-07-13 | STD-015 added — NO TENANT IDENTITY IN SHARED OR CUSTOMER-FACING CODE. Scar (2026-07-13): the shared notification templates were fully LAWNS-hardcoded (subject/body/SMS/footer) → every non-LAWNS tenant's customer emailed "LAWNS Tree Farm"; the checkout-UI sweep (H1–H9) missed the templates. Fixed (ledger #116) by a `NotifyBusiness` token from the active business context, omit-not-fake. Extends AC-1/STD-006 + AC-3 to the customer-facing render layer. |
| 2.0 | 2026-07-13 | STD-016 added — ORDER EDITS RECOMPUTE THROUGH THE CANONICAL PRICING PATH. Scar (ongoing, ledger #107 / #114): `submit.ts handleUpdate` recomputed baseline `sell_price` only (not tier/basis-aware) and computed tax off-seam (`subtotal × taxRate`, bypassing `computeOrderPricing`) → an edited tiered order could silently drop its discount or mis-tax; D-40 folds the off-seam tax back through the one computation. STD-012 applied to the edit path (kept as its own roster line for the recurring regression). |
| 2.0 | 2026-07-13 | BENCH-F added — INVOICE LIFECYCLE: SEQUENTIAL, IMMUTABLE, VOID-NOT-DELETE (🔴 catastrophic). Territory (enterprise scar): editing/deleting a sent invoice or non-sequential numbering is an audit failure in every jurisdiction; TRACE sends invoices (QBO/confirmation) but doesn't yet enforce numbering immutability or a void/credit path (order edits recompute in place today — STD-016). ACTIVATE WHEN a build adds invoice editing-after-send, deletion, numbering, or an issue-cancel flow. |
| 2.0 | 2026-07-13 | BENCH-G added — IMMUTABLE AUDIT RECORD FOR COMPLIANCE-AFFECTING ACTIONS (🟡 hygiene; escalates to catastrophic on an issued invoice → BENCH-F). Territory: the risk case is a REMOVED exemption — mutable columns show current state, not the event; `order_compliance_records` (netting precedent) is the proven immutable-row shape. D-40 ships exemption on order columns for Level 1; the immutable record is the named hardening. ACTIVATE WHEN exemption/waiver volume is material or a build adds an auditable-history compliance action. |
| 2.4 | 2026-07-16 | **STD-019 added + ACTIVATED (David's explicit go)** — EXTERNAL IDENTITY BINDS ON THE GUARANTEED-UNIQUE FIELD; AMBIGUITY NEVER AUTO-LINKS; A STORED LINK IS A CACHE, NOT A FACT. Scar (2026-07-15, proven live): `findOrCreateQBCustomer` matched on EMAIL ALONE (`where PrimaryEmailAddr = '<email>'` → `Customer[0]`, `DisplayName` never compared) → TRACE "TERRENCE OBRIEN" bound to QBO 81 "Andrew O'Brien" because they share an email → **NINE real invoices cross-billed to the wrong person over two months**. Three failures, one per clause: (1) QBO enforces `DisplayName` UNIQUE and does NOT enforce unique email — we matched on the one field it permits to collide (families/offices share one); (2) a single field decided the bind and an arbitrary `Customer[0]` broke ties; (3) **the stored `qb_customer_id` was never re-checked** — every later push skipped find-or-create and billed it, turning one bad match into nine. **Clause 3 is what earned the standard.** Silent because every TRACE surface showed the correct customer — the defect lived only in the external system, the one place our own surfaces never look back at, so STD-017's "every surface" does not reach it (the external record IS a surface). Fixed by D-47's three-way rule (query email AND DisplayName; concur→LINK, email-YES/name-NO→CREATE, name-YES/email-no→SURFACE, neither→CREATE; stored links verified-before-use; collision guard; 6240 surfaces; the junk email-as-DisplayName fallback retired). Generalizes to ANY external identity binding — Stripe (BENCH-A territory), supplier catalogs, any connector — not just QBO. |
| 2.3 | 2026-07-14 | STD-018 added — A CAPABILITY SHIPS ITS FULL ENTRY SURFACE (CRUD is C+R+U+D, enumerated at build time, not discovered at use). Scar (2026-07-14): inventory Create was built THREE ways (Add-Item form, D-45 scan-promote, discovery CSV) while Update was partial (no per-size edit surface, no add-size affordance) and Delete was entirely missing — surfaced only when David needed to add a second size to an existing variety and found no path. Rule: enumerate the entity's entry surface at build time; Update = the full field set via ONE editor (STD-011); Delete = a real soft/hard policy by FK check, confirm-first, actor logged. |
| 2.2 | 2026-07-14 | STD-017 added — A FIX IS COMPLETE ONLY WHEN TRUE ON EVERY SURFACE THE CAPABILITY TOUCHES. Scar (2026-07-14, six instances in ONE all-surfaces validation sweep): discount showed on Review/Confirmation but not on the real QBO push; order EDIT dropped the D-43 breakdown CREATE persisted; count captured size/qty into `inventory_counts` but the order picker read `business_inventory`; `variant_group` was read by the picker but written by no UI; tax exemption didn't render consistently across display surfaces; `billing_*`/`tax_id` were captured but read by nothing. One discipline gap — no surface-consistency check — expressed six times; each fix had been verified on ONE surface and assumed complete. Rule: enumerate a capability's surfaces before a fix; make it true on all (or scope + flag the rest); owner-prove every surface. Corollary (capture-persist-read continuity): a column written-but-never-read or read-but-never-written is an orphan and a defect. Extends STD-012's one-computation logic to surface-completeness. |

---

*TRACE Enterprises · Built with CAI*
*Update this file when a new scar earns a standard. Never adopt standards by reputation.*
