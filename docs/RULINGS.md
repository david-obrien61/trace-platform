# RULINGS

**What this is:** every ruling David has made, ONE LINE EACH, newest first.
**What this is NOT:** the reasoning. Reasoning lives in the decision docs, and each line points at
its own. This file exists to be READ IN FULL at the start of every session — CLAUDE.md §10 STEP 0
— so it must stay short enough that reading it is free. **A ruling that needs a paragraph here is a
ruling whose decision doc is missing.**

**Why it exists:** four rulings evaporated between the session that made them and the session that
built against them (2026-07-30). Not disputed — forgotten, because a ruling lived only in the prose
of a close-out entry that scrolled out of §3 at N=3. A decision the platform has to re-derive is a
decision nobody made.

**Columns.** `STATE` is one of:
- **IMPLEMENTED** — the ruling is in code or schema, and the `GUARD` column names what keeps it there.
- **PARTIAL** — some of it landed; the line says which part did not.
- **OPEN** — ruled, nothing built yet.
- **OWED** — the ruling itself is owed *by David*; the question is on the table and unanswered.

`GUARD` names the mechanical check, if one exists. **A ruling with no guard is a ruling waiting to
be broken by someone who knows it** — including its author (2026-07-29: four self-catches in 24
hours, three by the author of the rule). `—` is an honest answer and it renders as debt.

| Date | Ruling | State | Guard | Source |
|---|---|---|---|---|
| 2026-07-30 | **Six surface states.** A page without access RENDERS AND SAYS SO — it never redirects. Withheld data ANNOUNCES its redaction; never an empty list, never a zero. NOT PERMITTED names what is needed. | IMPLEMENTED — `SurfaceState.tsx` + `PermissionRoute` (26 routes) + the menu. **BEING BUILT is built but NOT MOUNTED** (card 12, `needs-test`) | — **owed: capB** (nothing yet fails the build on a silent refusal; the 27→0 conversion was done by hand and a 28th could be added tomorrow) | Phase 3 · ledger #171 |
| 2026-07-30 | **Permissions are ALWAYS checked; there is no exception path.** OWNER holds every enforced permission, LOCKED, COMPUTED from the manifest — never stored, never curated. `owner_id` is a fact about who owns the business, NOT an authority mechanism. Two owners = two members holding the same locked set. | IMPLEMENTED (client) · **migrations GATED — David applies a→b→c** | **capA** (3 assertions, 16 probes) + `permissionManifest.test.ts` (5) | Phases 1–2 · ledger #171 |
| 2026-07-30 | **E2E browser tests are not built.** The gap is named and accepted, not silently absent. | IMPLEMENTED *(as a recorded decision)* | — | [2026-07-30-e2e-browser-tests-not-built.md](decisions/2026-07-30-e2e-browser-tests-not-built.md) |
| 2026-07-29 | **TRACE is not a record system.** Capture a document only to EXTRACT DATA from it; pass the document through to the system that IS the record. A tax certificate has nothing to extract → keep the reference and the expiry, never the file. | PARTIAL — the certificate upload shell is removed; the **receipt → QuickBooks buy-side push** (`Purchase`/`Bill`) is NOT built, so a receipt's data is as stranded as its image | — | MASTER_BRIEF PART 1 · ledger #167 |
| 2026-07-29 | **A write path is a FILE, not a call site**, and more than one per table fails the build unless declared. 17 failing tables = **17 decisions owed, not 17 builds** — most resolve to a declaration. | IMPLEMENTED | `verify-write-paths` (ratchet) | ledger #167 · [platform-architecture-standard.md](standards/platform-architecture-standard.md) A2 |
| 2026-07-29 | **An unenforced rule is a placeholder for a cap**, not a finished control. A1/A3/A5/A6/A9 are review-only and the standard says so on each. | IMPLEMENTED *(as doctrine)* | — *(that is the point of the ruling)* | [platform-architecture-standard.md](standards/platform-architecture-standard.md) §5 |
| 2026-07-28 | **A Save that changed nothing is an operator act worth keeping**, but `success` on `role.permissions_changed` asserts an event that did not occur → short-circuit the write, KEEP the audit row, `outcome='no_change'`. Compare as SETS, not arrays — a pure reordering is not a change. | IMPLEMENTED | STD-023 · `20260728c` V3 | tech-debt #74 · ledger #163 |
| 2026-07-28 | **Create tables through migrations, not the dashboard table editor** — the table editor's `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and RLS cannot filter TRUNCATE. The SQL editor is NOT the gap (proven by the V4 probe, not assumed). | IMPLEMENTED *(as a rule)* | — *(owed: the schema-snapshot checker; `verify-universals` cannot host it — it reads repo `.sql`, not the catalog)* | CLAUDE.md §6 r17 · ledger #160b |
| 2026-07-27 | **A staff member READS what they need to do the work, and WRITES nothing without an explicit grant.** | IMPLEMENTED | capP · `STAFF_DEFAULT_BUNDLE` | [rbac-transition-execution-plan.md](decisions/2026-07-27-rbac-transition-execution-plan.md):359 |
| 2026-07-27 | **Eleven delivery permissions** — read + update on both delivery resources. | IMPLEMENTED | manifest | [rbac-transition-execution-plan.md](decisions/2026-07-27-rbac-transition-execution-plan.md):821 |
| 2026-07-27 | **Owner-masking is definitively ruled OUT** — `is_owner=false` for a manager is not simulated by hiding; the manager IS a distinct session. | IMPLEMENTED | — | [rbac-transition-execution-plan.md](decisions/2026-07-27-rbac-transition-execution-plan.md):308 |
| 2026-07-27 | **No default bundle, role definition, or member array may hold a `declared-unwired` string** — the Roles page filters it out, so a held one is UN-REMOVABLE through the UI. | IMPLEMENTED | capQ (a)(b) · V5 | [permissionManifest.ts](../packages/shared/src/auth/permissionManifest.ts):918 |
| 2026-07-26 | **TWO OWNERS.** An LLC has two owners — David and Regina; Lauren at LAWNS holds owner-level access. `businesses.owner_id` is single-valued and CANNOT express that. | IMPLEMENTED | capA | this build · the ruling Lightning acknowledged and then designed on `owner_id` anyway |
| 2026-07-26 | **R1–R9** — the resource:action model: create is free of read, `margin:read` is derived, the unmintable five have no delete verb, `view_dashboard` retires into the `member` sentinel. | IMPLEMENTED | capP · capQ | [resource-action-permission-spec.md](resource-action-permission-spec.md) v3 |
| 2026-07-23 | **The funnel is the ONLY way a role→permission fact changes** (OPTION 1) — template write + member re-materialisation + audit row, one transaction. Direct writes are refused by the side-door trigger. | IMPLEMENTED | `20260723` §1 trigger | [roleFunnel.ts](../packages/shared/src/auth/roleFunnel.ts) |
| 2026-07-23 | **Mints read the resolved floor** — `DEFAULT_PERMISSIONS` retired; an invite and an owner-signup seed from the SAME resolution the Roles tab renders. | PARTIAL — `OnboardingWizard:561` and `Settings:205` comply; **`SignUp.tsx` still writes a hardcoded literal** | — | [roleDefinitions.ts](../packages/shared/src/auth/roleDefinitions.ts):122 |
| 2026-07-22 | **Over-commit OVERRIDE: default REFUSE**, owner/manager permission to proceed, audit row per D-51. **`reserved` is removed from the lot-status vocabulary.** | OPEN | — | D-51 · D-52 |
| 2026-07-21 | **The middle inventory state is RESERVED in DISPLAY** — the column name is irrelevant; what the owner reads is what is ruled. | OPEN | — | [D-52](decisions/2026-07-21-inventory-states-onhand-committed-available-D52.md) |
| 2026-07-21 | **Two logs split by RETENTION** — event log is the source of truth (replay), audit log is the accountability record (nothing computed from it). A discretionary act writes BOTH. | OPEN — **docs only, nothing built**; zero code, zero schema | — | [D-51](decisions/2026-07-21-event-log-audit-log-retention-split-D51.md) |
| 2026-07-20 | **An append-only ledger row is immutable including against `postgres`** — genesis rows are not re-dated; fix at the consumer. | IMPLEMENTED | `20260720` trigger · V3(b) | [D-50](decisions/2026-07-19-inventory-movement-ledger-D50.md) · tech-debt #70 |
| 2026-07-17 | **Owner-prove STEP ZERO** — confirm the deploy for THIS SHA is live before any observation counts as evidence. Homed where DAVID stands (GATE 0 on the board), not only in a protocol doc. | IMPLEMENTED | SHA stamp → DebugPanel footer | OP-15 · tech-debt #60 |
| 2026-07-16 | **§3 HANDOFF retains N=3**; overflow moves VERBATIM to the archive. CLAUDE.md line 3 is a POINTER, never a summary. | IMPLEMENTED | §9 close step 0 | OP-13 |

## OWED — the ruling itself is the deliverable

These are on David's table. Each blocks something concrete; none is rhetorical.

| Question | What it blocks | Source |
|---|---|---|
| **E5** — should a write that matches ZERO rows report success? Today every write on `customers` does. Latent under owner-only RLS; live the moment a non-owner writes. | customer-edit card 7 (`needs-test` because the behaviour is not fixed) | ledger #167 · [ui-control-standards.md](standards/ui-control-standards.md) §4 |
| **#75** — a device check that FAILS OPEN. Convenience → fine. Authorisation → security defect. Which is it, and which call fails? | the guarded surface, unknown | tech-debt #75 |
| **R-STATUS** — is the 4-state order lifecycle right? Should cancel auto-release (today: yes) and un-cancel auto-re-reserve (today: no)? | a DB CHECK constraint on `orders.status`; #71's lifecycle-field fix | DECISIONS-INDEX |
| **R-QBSTALE** — an edited order's QB invoice goes stale. Leave the banner, or auto re-issue? | the edit→QBO loop | DECISIONS-INDEX |
| **#71** — one `status` column, two authors (D-42 derive vs D-52 tombstone). Lifecycle state wants its own field — a migration. | a deleted lot reads `depleted`; the grid offers Delete on a tombstone | tech-debt #71 |
| **OP-13 amendment** — the CLAUDE.md budget measures LINES, and line 3 was ONE line and ~1,400 tokens. Switch to characters? | the still-open §4 "lean CLAUDE.md" item | CLAUDE.md §4 |
| **#59** — `TRACE-SESSION-BOOTSTRAP.md` has the duplicate-header disease AND is loaded every session. Does the pointer-not-summary clause extend to it? | a per-session token tax | tech-debt #59 |
| **#67 / #68** — blind capture as a per-session mode, and session-scoped reconcile. Named in D-50's own story as build inputs, explicitly owed. | the count-then-review loop the story describes | tech-debt #67, #68 |
