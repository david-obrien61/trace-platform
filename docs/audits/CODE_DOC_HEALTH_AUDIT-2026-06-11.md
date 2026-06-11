# Code & Doc Health Audit — 2026-06-11

**Type:** RECON ONLY — no files modified, no refactors applied.  
**Method:** `find + wc -l` for line counts; `git log` for churn; import/export/heading scans (first 60 lines + grep) for concerns.  
**Ranking:** concerns × churn (not raw size — a big cohesive file is often fine; a small file with 6 unrelated jobs is the problem).

---

## Part 1 — CODE FILE TRIAGE

### Ranked table (highest priority first)

| # | File | Lines | Concerns | Churn (90d) | Rec | Rationale |
|---|---|---|---|---|---|---|
| 1 | `packages/cultivar-os/src/pages/Dashboard.tsx` | 936 | 5+ | 27 commits | **SPLIT** | Most-churned file in the entire repo × 5 concerns evolving at different rates |
| 2 | `packages/ignition-os/modules/IgnitionAdmin.jsx` | 1670 | 8 | 4 commits | **SPLIT** | 7 self-contained modal components + 4 tab components + root — 12 logical files crammed in one |
| 3 | `packages/ignition-os/CoreApp.jsx` | 1201 | 5 | 8 commits | **SPLIT** | Auth flows, access gating, enrollment, shop identity, routing shell all in one file — 3 active teardown flags |
| 4 | `packages/shared/src/auth/OwnerSignup.tsx` | 919 | 5 | 7 commits | **SPLIT** | Abuse guard block (~60 lines), biometric step, and vertical step runner are extractable; active churn amplifies the risk |
| 5 | `packages/ignition-os/modules/IgnitionEstimate.jsx` | 804 | 4 | 5 commits | **SPLIT** | 3 sub-views (list, builder, approval) × 3 active teardown flags (TRACE_WORKFLOW + TRACE_MARGIN + TRACE_API) = not cohesive yet |
| 6 | `packages/ignition-os/modules/IgnitionOmni.jsx` | 813 | 4 | 5 commits | **SPLIT** | 4 full UI panel sub-components (StaffManagement, ComplianceGuard, LeakageAudit, VelocityLeaderboard) each 80–185 lines — all extractable |
| 7 | `packages/cultivar-os/src/pages/OnboardingWizard.tsx` | 735 | 4 | 6 commits | **WATCH** | 4 wizard paths already cleanly separated; fine now, extract paths to `pages/onboarding/` before a 5th path is added |
| 8 | `packages/cultivar-os/src/pages/ReceiptKeeper.tsx` | 727 | 3–4 | 12 commits | **WATCH** | Splitting is already in progress (985→727 last session); continue extracting — image capture, OCR call, reconciliation, line-item editing still co-located |
| 9 | `packages/ignition-os/modules/IgnitionAudit.jsx` | 778 | 3 | 6 commits | **WATCH** | `AuditResult` sub-component alone is ~203 lines and extractable; same-domain concerns (invoice audit), not urgent |
| 10 | `packages/ignition-os/modules/PredictiveKey.jsx` | 710 | 3 | 5 commits | **WATCH** | `AddAssetModal` (125 lines) + `LogModal` (175 lines) + main component — modals extractable when file is next touched |
| 11 | `packages/ignition-os/OnboardingWizard.jsx` | 1011 | 3 | 5 commits | **WATCH** | Ignition demo wizard — 3 paths + QR generator + DataBridge calls. Not on critical path; extract when adding a 4th path |
| 12 | `packages/shared/src/pages/Settings.tsx` | 725 | 3 | 3 commits | **WATCH** | Customer-match section (lines 242–591, ~350 lines) is fully self-contained and extractable; low churn, not urgent |
| 13 | `packages/ignition-os/DataBridge.js` | 1123 | 10+ | 3 commits | **LEAVE** | CLAUDE.md §Shared Extraction explicitly defers: "too coupled to Ignition mobile/local-first — extract pieces as needed." Rule overrides size concern. |
| 14 | `packages/cultivar-os/src/pages/Help.tsx` | 830 | 1 | stable | **BIG-BUT-FINE** | Pure FAQ content + section layout. Large by volume of text, not complexity. No logic, no churn risk. Leave alone. |

---

### Detailed notes on SPLIT candidates

#### #1 — Dashboard.tsx (936 lines, 27 commits)
The highest-risk file: most-churned file in the repo and handles 5 unrelated concerns:

- **Data loading** — `loadMetrics()` pulls orders, installs, leakage, revenue from Supabase (~66 lines of query code)
- **Social drafts** — `loadCampaignDrafts()`, `loadSocialDrafts()`, `handleSaveEdit()`, `handleCopyCaption()`, `handleGeneratePosts()` (~70 lines, entirely separate from metrics)
- **QB integration** — `checkQbStatus()`, `handleConnect()` (~80 lines, integration layer)
- **Tile navigation** — `handleNavigate()`, `handleEnable()`, `showComingSoon()` (~30 lines)
- **Auth** — `handleSignOut()` + business context
- **3 embedded sub-components** — `MetricCard`, `SkeletonCard`, date helpers at top-of-file

Social draft management and QB status have nothing to do with each other. Both have been changed 10+ times independently. The natural split is: `Dashboard.tsx` (shell + tile grid + nav) + `useDashboardMetrics.ts` (hook) + `useSocialDrafts.ts` (hook) + sub-components to `components/`.

**Recommend: address in the next active Dashboard session.**

---

#### #2 — IgnitionAdmin.jsx (1670 lines, 4 commits)
The largest file in the repo. Internal structure is actually well-organized (section headings are clear) but 12 logical files are concatenated:

- `constants/permissions.ts` — `ALL_PERMISSIONS`, `ROLE_PRESETS`, `SUB_ROLES` (60 lines)
- `modals/AddStaffModal.jsx` — 140 lines
- `modals/InviteStaffModal.jsx` — 205 lines (largest modal)
- `modals/CreateTeamModal.jsx` — 52 lines
- `modals/ManageMemberModal.jsx` — 255 lines
- `modals/RevokeModal.jsx` — 56 lines
- `modals/EditPermissionsModal.jsx` — 75 lines
- `modals/RevokeMemberModal.jsx` — 58 lines
- `tabs/StaffTab.jsx` — 138 lines
- `tabs/MemberCard.jsx` — 41 lines
- `tabs/TeamTab.jsx` — 132 lines
- `tabs/RolesTab.jsx` — 103 lines
- `tabs/ShopTab.jsx` — 141 lines
- `IgnitionAdmin.jsx` — root component wrapping the tabs (~80 lines)

Two STD-003 flags still ON (`STYLE_DEBUG`, `TRACE_AUTH`) — active migration target. Edit risk is high: editing ManageMemberModal requires loading 1670 lines into context.

**Recommend: split before any next edit to IgnitionAdmin.**

---

#### #3 — CoreApp.jsx (1201 lines, 8 commits)
The Ignition "umbrella" with 5 distinct responsibilities:

- **Auth flows**: `ForgotPinFlow` (~110 lines), `JoinFlow` (~190 lines) — these change when auth migration happens
- **Enrollment**: `EnrollmentGate` (~70 lines) — changes when shop onboarding changes
- **Access gating**: `AccessGatekeeper` (~55 lines) — targeted by the permissions.ts migration (Tech Debt #28)
- **Shop identity display**: `ShopBanner`, `IdentityMatrix` (~185 lines combined)
- **Shell / routing / module dispatch**: `CoreApp` (~500 lines)

Three active teardown flags (`STYLE_DEBUG`, `TRACE_AUTH`, `TRACE_WORKFLOW`). The auth flows and gating logic will be touched when permissions.ts migration proceeds — splitting them first reduces the edit surface.

**Recommend: split auth flows and gating out before permissions migration.**

---

#### #4 — OwnerSignup.tsx (919 lines, 7 commits)
Single-component architecture is intentional (multi-step wizard), but two blocks are self-contained enough to extract:

- **Abuse guards** (`createBusinessAndMember` lines 262–322, ~60 lines of rate-limit + duplicate-check logic) — candidate for `shared/auth/signupGuards.ts`
- **Biometric step** (lines 476–512, `advanceFromBiometric`) — candidate for a `BiometricStep.tsx` sub-component if the step gets more complex

The rest of the component (step orchestration, form state, navigation) is genuinely cohesive. Don't over-split.

**Recommend: extract abuse guards when signup flow is next touched.**

---

#### #5 — IgnitionEstimate.jsx (804 lines, 5 commits)
Three distinct views (list, builder, signature approval) with separate data paths, plus API calls to AI pre-fill and PO generation. The tell: 3 active teardown flags = 3 open migration fronts = the file is doing too many things that are each "in progress."

**Recommend: split list view and approval view out when estimate flow is next active.**

---

#### #6 — IgnitionOmni.jsx (813 lines, 5 commits)
Four embedded sub-components that are full UI panels:

- `StaffManagement` (~120 lines) — partial overlap with IgnitionAdmin
- `ComplianceGuard` (~80 lines)
- `LeakageAudit` (~150 lines) — substantial, has its own state
- `VelocityLeaderboard` (~185 lines) — has its own data rows and coloring logic
- `IgnitionOmni` main (~240 lines)

Each panel evolves independently. `StaffManagement` here and `StaffTab` in IgnitionAdmin are probably converging toward a collision.

**Recommend: extract sub-panels to `modules/omni/` before next Omni feature work.**

---

### STD-003 instrumentation debt (cross-cutting)

**53 instances** of `= true` debug flags across **30+ files** (`STYLE_DEBUG`, `TRACE_AUTH`, `TRACE_MARGIN`, `TRACE_WORKFLOW`, `TRACE_API`). Per STD-003, these should be `false` once the fix is verified.

These flags being ON signals "this code is mid-migration." For files where the migration is complete (e.g., Tailwind conversion is resolved per Tech Debt #14), the corresponding `STYLE_DEBUG = true` in each file should be set to `false`. A targeted sweep — file by file, confirming "is this migration done?" before flipping — would close a lot of open signals.

**Known files where migration is resolved but flag remains ON:**
- All 34 Tailwind-converted files still have `STYLE_DEBUG = true` — Tech Debt #14 is marked 🟢 RESOLVED but flags were not flipped.
- `IgnitionAudit.jsx` — `TRACE_API = true` but Railway is dead and AI is dark; flag is noise.

**Recommend: plan a single flag-sweep session post-demo. One commit per file, state the reason.**

---

## Part 2 — DOC HEALTH TRIAGE

| Doc | Lines | Status | Recommendation |
|---|---|---|---|
| `CLAUDE.md` | 788 | ⚠️ Over the ~600 line threshold defined in §1 of this file itself | **FLAG** — CLAUDE.md §1 says to flag before proceeding when over ~600 lines. Trim handoff history that predates the archive trigger (pre-2026-06-11 entries are already in `docs/handoff-archive.md`). |
| `THOUGHTS.md` | 2353 | Session log, 21 commits in 30 days (~112 lines/session) | **WATCH** — never load whole; always read by date range (`grep` or `offset+limit`). Entries >90 days old could be archived. Not a blocker. |
| `PLATFORM_STRATEGY.md` | 1628 | Architecture reference, 21 commits in 90d | **BIG-BUT-NECESSARY** — read in sections only. The right size for its job. |
| `docs/handoff-archive.md` | 5595 | Archive by design — never loaded at session start | **FINE** — archive by design. Never read whole. |
| `CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md` | 978 | Single initial commit (never updated after 0c3194e). Zero external references — self-referential only. Superseded by CLAUDE.md. | **ARCHIVE CANDIDATE** — CLAUDE.md §10 session starter no longer references this file. Confirm with David that it's superseded, then move to `docs/legacy/` or delete. Loading it by mistake fills 978 lines of context for nothing. |
| `CULTIVAR_OS_USER_STORIES_AND_DEMO.md` | 1096 | Single initial commit (same as above). | **CHECK** — still useful for demo prep? If the demo script is current and David uses it, keep at root. If superseded by PLATFORM_STATE.md + MASTER_BRIEF.md, archive. |
| `docs/built-inventory.md` | 897 | Frequently updated (21 commits in 90d), current-state source of truth | **WATCH** — read in chunks only; approaching the size where it needs `offset+limit` on every session open. |
| `PLATFORM_STATE.md` | 238 | Lean, high-churn canonical state doc | **FINE** — well-sized for its job. |

---

## Part 3 — SUMMARY

**Immediate action candidates** (address before the next heavy build session):

1. **Dashboard.tsx** — split social drafts and QB status logic out (or into hooks). 27-commit churn on a 936-line file with 5 concerns is the highest active risk.
2. **IgnitionAdmin.jsx** — extract modals and tabs before the next permissions migration edit. 1670 lines, 12 logical files.
3. **CLAUDE.md** — is 788 lines; the §1 rule says flag at ~600. Next housekeeping session: trim pre-June handoff history that's already in `docs/handoff-archive.md`.

**Hold for post-demo** (splitting mid-demo prep creates merge risk):

4. **CoreApp.jsx** — split auth flows + gating before the permissions.ts migration.
5. **OwnerSignup.tsx** — extract abuse guards when signup is next touched.
6. **IgnitionEstimate.jsx / IgnitionOmni.jsx** — split when each is next active.

**STD-003 cleanup** (one targeted session post-demo):

7. Flip all `STYLE_DEBUG = true` flags to `false` in the 34 Tailwind-converted files (Tech Debt #14 marked RESOLVED).
8. Audit remaining TRACE_* flags file by file — flip to `false` where the migration is done.

**Archive candidates** (confirm with David):

9. `CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md` (978 lines, never updated, zero external refs)
10. `CULTIVAR_OS_USER_STORIES_AND_DEMO.md` (1096 lines, same vintage) — keep if demo script is still live; archive if superseded.

---

*Audit completed 2026-06-11. Recon-only — zero files modified.*  
*Comparable audit format: `docs/audits/2026-06-06-audits-1-4.md` + `docs/audits/ignition-reality-audit-2026-06-09.md`.*
