# End-of-Session Protocol — TRACE Platform

> Read this at the END of every session — not at session open.
> Full text lives here; CLAUDE.md §9 contains only the pointer + file-size check.

---

## FILE SIZE & ORGANIZATION CHECK (before editing any file during the session)

Before adding to or editing a file, note its current line count. If the file exceeds ~800 lines
OR is clearly handling multiple distinct concerns, **STOP and ASK David**:

> "This file is [N] lines and handles [concerns A, B, C] — should we reorganize it into
> smaller modules before adding more, or edit in place for now?"

Rules:
- Line count is a **trigger to ask**, not an automatic action. Do NOT silently refactor a large file.
- The real concern is whether a file does too many jobs to reason about and edit cleanly.
- Context-thrash guard: reading an oversized file whole on every edit overflows the session context.
  Prefer viewing only the relevant range (use `offset` + `limit` on Read).

This check applies at the moment of opening a file to edit it — not retrospectively at session end.

---

## SCHEMA VERIFICATION GATE (mid-session — triggers on any table-touching change)

**A migration is NOT "done" and NOT committable-as-working until Thunder produces catalog-backed verification output showing the change STUCK.**

This gate fires during the session, not at close — the moment you create or alter a table, column, policy, constraint, FK, or trigger. Verification queries hit the live catalog (`information_schema` / `pg_catalog`), NEVER the builder's memory. Structure AND security must both be proven. RLS is MANDATORY — it is the failure that does not announce itself and leaks tenant data silently.

**Standard verify query set** — use these verbatim; all fields are real catalog fields:

```sql
-- 1. RLS enabled (the silent-danger check):
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = '<table>';
-- relrowsecurity MUST be true.

-- 2. Policies present + scoped:
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = '<table>';
-- confirm owner + member policies, both USING (qual) and WITH CHECK present and
-- scoped to business_id.

-- 3. Foreign keys bound:
SELECT conname, conrelid::regclass AS tbl, confrelid::regclass AS references_table
FROM pg_constraint
WHERE contype = 'f' AND conrelid = '<table>'::regclass;

-- 4. CHECK constraints:
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE contype = 'c' AND conrelid = '<table>'::regclass;

-- 5. Columns (structure):
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '<table>'
ORDER BY ordinal_position;

-- 6. REST liveness (Thunder runs directly):
--    GET /rest/v1/<table>?limit=0  →  expect HTTP 200.
```

**Rule on query safety:** NEVER reference fields that do not exist. There is NO `check_constraints` column in `information_schema.columns` — CHECK definitions live in `pg_constraint`. Sanity-check every verify query references real catalog fields BEFORE handing it to David.

**Output format:** For each table, produce a result table showing RLS on/off, policies list, FK list, CHECK list, columns list. End with a per-table **CLEAN** or **HOLES-FOUND** verdict. A missing RLS policy or a policy not scoped to `business_id` is CRITICAL — name it exactly, do NOT auto-fix without David's go.

**pg_catalog note:** `pg_policies`, `pg_class`, `pg_constraint` are NOT available via REST API — they require the Supabase SQL editor. Thunder provides the SQL and produces output once David pastes and returns results. REST liveness (query 6) Thunder runs directly.

---

## MANDATORY CLOSE CHECKLIST (steps 1–16)

1. Update Part 3 (Handoff) in CLAUDE.md
2. Update Part 4 (Active Tasks) — check completed
3. Update Part 7 (Off Limits) — clear old, add current
4. Confirm no hardcoded URLs or keys in new code
5. git add CLAUDE.md
6. git commit -m "Update CLAUDE.md — [date] [what was built]"
7. git push
8. Write 3-sentence plain English summary

9. **Tailwind drift check** — run:
   ```
   git diff --name-only $SESSION_START_COMMIT HEAD -- 'packages/**/*.tsx' 'packages/**/*.jsx' | xargs grep -l 'className=' 2>/dev/null
   ```
   - `packages/ignition-os/`: pre-existing Tailwind is expected (deprecated, post-August conversion)
   - `packages/shared/src/components/SavingsReport.jsx` or `QuickBooksConnector.jsx`: same — pre-existing
   - Any other file or package: `className=` with Tailwind utility classes = policy violation
   If new Tailwind found: convert to inline styles before committing OR document in commit message AND add to `docs/tailwind-conversion-progress.md`.

10. **Documentation propagation check** — For any session that built, modified, or removed a customer-facing widget, page, or feature, answer all five:

   1. Does `packages/cultivar-os/src/pages/Help.tsx` (or vertical equivalent) need a new Q&A or update?
   2. Does the onboarding flow reference this widget/feature accurately?
   3. Does `docs/built-inventory.md` reflect current state?
   4. Are there any `// FLAG:` placeholders this session's work fulfills? If so, replace with real content.
   5. Does any error message or in-app help text need to be added or updated?

   **If yes to any:** make the updates in this session's commit. Propagation is part of the work.
   **If no to all:** state explicitly: "No customer-facing documentation propagation needed for this session."
   This step is mandatory.

11. **Factual correction capture** — Triggered when:
   - An audit revealed something different from what was previously asserted
   - Claude discovered a file in a different state than expected
   - David said "I think X works this way" and Claude verified it works differently
   - A user-facing description was found to be inaccurate after checking the code
   - Tech Debt entries were found to be already-fixed or no-longer-relevant

   When triggered: (1) Identify the wrong claim (quote it). (2) Identify what's actually true (cite file/line). (3) Update the source-of-truth doc. (4) Append a brief entry to `THOUGHTS.md`.

   Mandatory: session not complete until either a correction is captured OR the session explicitly states "no factual corrections surfaced in this session."

12. **Runbook capture** — For any session that performed environment setup, deployment configuration, repository migration, package installation, database migrations, or infrastructure changes: produce a runbook at `docs/runbooks/{operation-name}-{YYYY-MM-DD}.md`.

   Runbook covers: what + why, steps taken, how to verify each step, what failed and how it was resolved, gotchas. Write for replay, not narrative.

   If purely code changes: state "No runbook needed — pure code session."

13. **Architecture-constants compliance check** — Before closing, confirm:
   - No new vertical nouns in `packages/shared/**` or any shared DB migration (AC-1).
   - Any RLS policy deviation has WHY documented inline AND in PLATFORM_STRATEGY.md Exception Log (AC-2).
   - No cross-vertical data path opened without an explicit isolation check (AC-3).
   - Any new per-vertical variable is a token or vocabulary item, not a structural deviation (AC-4).

   If violation introduced intentionally: add to Known Open Violations in CLAUDE.md §1.5 with remediation trigger.
   If session did not touch shared schema/code/RLS: state "No AC compliance issues — session did not touch shared schema, RLS, or shared identifiers."
   Mandatory.

14. **STANDARDS compliance check** — Answer for each applicable standard:

   **STD-001 (Prove Before You Act):** Did any fix happen before read-only diagnosis confirmed root cause?

   **STD-002 (Red-Test-First):** For any bug fix — was the broken state made visible BEFORE the fix was applied?

   **STD-003 (Instrumentation Preserved):** Were any `[SM-TRACE]`-style logs added? If yes: consistently prefixed? Gated behind `const <PREFIX>_DEBUG = false` if fix verified?

   **STD-004 (Tenant Isolation Bar):** Did any feature touching business-scoped data ship? If yes: is a two-email isolation proof in the Handoff?

   **STD-005 (Verbatim Decisions):** Were any decisions reversed or updated? If yes: was prior text explicitly struck through or replaced (not just supplemented)?

   **STD-006 (Vertical-Agnostic):** Covered by AC-1 / Step 13.

   **STD-007 (Derived Connection State):** Did session work touch any surface displaying integration status (QB, Blotato, any OAuth token)? If yes: confirm it derives state proactively from an expiry timestamp, not a cached boolean.

   **STD-008 (Committed Migration ≠ Applied Migration):** Did session work apply a DB migration? If yes: applied to live DB? `information_schema.columns` verification query run? Live schema confirmation logged in Handoff? State one of: "Migration applied and verified — live schema confirmed [columns listed]" OR "Migration written; David must apply; verification query included in migration file."

   **STD-009 / STD-010:** See STANDARDS.md for full text.

   Do not skip silently for any standard. State "N/A" explicitly. Full standard text in STANDARDS.md.
   Mandatory.

---

## GAP vs DEBT ROUTING

**TECH DEBT** → `docs/tech-debt-log.md` (with standard-ID): built WRONG. Shortcut, hardcode, compromise.

**NAMED GAP** → `docs/built-inventory.md` `remaining:`: built as a labeled, honest shell. A 'suggested'/hollow-but-labeled thing is a gap, NOT debt — it's working-as-designed at this phase.

A labeled gap is roadmap. Tech debt is a defect. Don't conflate them.

**GAP GRADUATION** — each built-inventory `remaining:` gap carries a stated horizon. A gap 30+ days PAST ITS STATED HORIZON has stopped being roadmap and is now a defect-in-practice — graduate it to `docs/tech-debt-log.md` with a standard-ID and remove from `remaining:`. (30 days past horizon, NOT 30 days from creation.)

---

15. **Gap graduation sweep** — Scan all `remaining:` gaps in `docs/built-inventory.md`; graduate any that are 30+ days past their stated horizon to `docs/tech-debt-log.md` (with a standard-ID) and remove from `remaining:`. If no gaps are past horizon, state explicitly: "No gap graduations this session."

16. **PLATFORM_STATE.md update** — After any session that changes the level of a tracked item (new file added, caller wired, build confirmed, migration applied, orphaned file deleted), update the relevant row:
    - Advance the level only when you have evidence (WIRED → WORKS requires a test result, confirmed-live use, or build-verified runtime path).
    - Move anything to "⚠️ NOT YET VERIFIED" if evidence is lost or stale.
    - Never mark David's operational checks done on his behalf.
    - Add new items with all required columns (LEVEL + LOCATION + EVIDENCE).
    If no items changed level: state explicitly "No PLATFORM_STATE.md level changes this session."

17. **BUILT-INVENTORY.md update** — For every capability built, changed, or disproven THIS session (derive from this session's commits + PLATFORM_STATE level changes), add or update its entry in `docs/built-inventory.md`:
    - New capability built → add or update the capability section: what is built, schema/location/evidence.
    - Capability disproven ("was thought WORKS, confirmed BROKEN") → add a `⚠️` discovery note with date.
    - Capability promoted (gap → resolved) → move from "What Is NOT Yet Built" to "✅ Resolved Gaps."
    - No capability changed this session → write `<!-- No capability changes: YYYY-MM-DD -->` as the last line of the file before the footer.
    - **Always:** bump `Last updated:` on line 4 to today's date.

    **VERIFY before committing:** open line 4 of `docs/built-inventory.md` — if the date is not today's date, this step was skipped.

    **Session STEP 0 check (read-in, not write-out):** at session open, run `head -4 docs/built-inventory.md`. If `Last updated:` is older than the latest commit that added, changed, or removed a capability (schema/page/migration/module), FLAG it as stale before trusting it to answer "was X built?" — a stale index is the re-audit cost this rule was written to prevent.

18. **Standing inventory update** — For each accumulation type touched this session, update the matching inventory doc and bump its `Last updated:` line to today:
    - Added or removed a serverless function → `docs/inventory-functions.md`
    - Added, removed, or reclassified a Vercel env var → `docs/inventory-env.md`
    - Added or changed an AI feature (model, route, status) → `docs/inventory-ai.md`
    - Added or removed a DB table → update PLATFORM_STATE.md (canonical for table state); also update `CLAUDE.md §2` table quick-reference list.
    - If none of the above: state explicitly "No standing inventory changes this session."

    **Rule:** these docs are lean — one line per item. Pointers to deeper docs, never inline depth.
    **VERIFY before committing:** `head -2 docs/inventory-functions.md docs/inventory-env.md docs/inventory-ai.md` — date on line 2 of each touched doc must equal today.

---

*This file is the authoritative source for the end-of-session protocol. CLAUDE.md §9 contains only the pointer.*
