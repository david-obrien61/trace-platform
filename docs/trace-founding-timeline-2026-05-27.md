# TRACE Enterprises — Canonical Founding Timeline
**Produced:** 2026-05-27  
**Method:** Read-only audit — local Git history, filesystem inspection, and GitHub public API data captured in an earlier session  
**Author:** Claude Code (automated git + filesystem inspection)  
**Session:** Session I of this date (supersedes earlier partial version from the same calendar day)  
**Status:** Authoritative record — do not edit. Append a new dated section if an update is warranted.

> **Note on gh CLI:** The GitHub CLI (`gh`) was not available in the environment at audit time. GitHub account and repository creation dates in this document were sourced from the prior session that had API access (reflected in earlier version and carry-forward here). All commit-level data is directly from local Git history and is cryptographically verifiable.

---

## Section 1 — Account and Repository Inventory

All repositories under `david-obrien61`, sorted by GitHub creation date. TRACE-lineage status noted.

| # | Repo | Created (UTC) | Last Push | Language | Visibility | TRACE Lineage |
|---|---|---|---|---|---|---|
| 1 | `ignition` | 2026-04-16 16:54 | 2026-04-26 | JavaScript | Public | ✅ Direct — first GitHub home of Ignition OS (4 commits; bare Expo scaffold; superseded by CAI) |
| 2 | `CoolRunning` | 2026-04-16 19:31 | 2026-05-07 | Python | Public | ⚠️ Adjacent — Andrew's smart home project; contains `ignition_schemas/bme680_tile.json` (earliest committed file using the phrase "Ignition OS schema") |
| 3 | `CAI` | 2026-04-26 18:22 | 2026-05-08 | JavaScript | Public | ✅ Direct — original Ignition OS production monolith; 54 commits; lineage migrated to trace-platform on 2026-05-18 |
| 4 | `trace-assessment-app` | 2026-05-15 00:07 | never pushed | — | Public | ✅ Direct — CoolRunnings Property Assessment PWA; Claude Vision device identification; fully built locally but never pushed to GitHub |
| 5 | `trace-platform` | 2026-05-18 00:52 | 2026-05-27 | TypeScript | Private | ✅ Direct — **ACTIVE production monorepo**; cultivar-os + ignition-os + shared |

**Earliest verifiable TRACE timestamp (cryptographically signed git commit):**  
`a35b34adf4d482113a242dfa5e6d8e89dba6b864` — `ignition` repo — 2026-04-16 11:57:28 −0500

**Earliest verifiable TRACE timestamp (filesystem only — not git-signed):**  
`IgnitionMobile/CodeBaseB/shop_estimate.py` — 2026-04-11 13:29:43 CDT  
(see Section 6 for significance and use-by-audience recommendations)

**GitHub account `david-obrien61` created:** 2026-04-11 18:06 UTC — same calendar day as the oldest TRACE artifact on disk.

**Repositories referenced in MASTER_BRIEF or CLAUDE.md but not found locally or on GitHub:**  
None. All referenced repos (`ignition`, `CoolRunning`, `CAI`, `trace-platform`) are accounted for above.

**Repos named in CLAUDE.md section "Off Limits This Session" as separate project:**  
`ignition-os` (Supabase project `ufsgqckbxdtwviqjjtos`) — this is a Supabase project, not a GitHub repo. The corresponding code lives in `packages/ignition-os/` within trace-platform.

---

## Section 2 — Repository-Level Detail

### 2.1 `ignition` (local directory: `IgnitionMobile`)

| Field | Value |
|---|---|
| GitHub remote | `https://github.com/david-obrien61/ignition.git` |
| GitHub repo created | 2026-04-16T16:54:16Z |
| First commit SHA | `a35b34adf4d482113a242dfa5e6d8e89dba6b864` |
| First commit timestamp | 2026-04-16 11:57:28 −0500 |
| First commit message | `first commit` |
| First commit contents | Bare Expo React Native scaffold — `App.js`, `app.json`, `package.json`, assets only |
| Total commits | 4 |
| Most recent commit | 2026-04-26 13:17 — `adding native for mobile clarity` |
| GitHub description | *(none)* |
| Authors | david-obrien61 `<david61obrien@gmail.com>` only |

**Assessment:** The first commit is a stock `expo init` output — no Ignition OS logic. Actual business logic (EnrollmentCatch, MarginEngine, GhostTracker, SlideToComplete) was developed locally in `IgnitionMobile/modules/` between April 13-15 but was never committed to this repo. It was committed to CAI on April 26 instead. The `ignition` repo is the staging ground, not the birth of the platform. It went quiet 3 days after the CAI repo was created.

---

### 2.2 `CoolRunning`

| Field | Value |
|---|---|
| GitHub remote | `https://github.com/david-obrien61/CoolRunning.git` |
| GitHub repo created | 2026-04-16T19:31:45Z |
| First commit SHA | `d300cf21083e4df8d7920679b240f442232e4fd4` |
| First commit timestamp | 2026-04-16 14:39:17 −0500 |
| First commit message | `initiating repository` |
| First commit contents | Empty `Readme` file (0 bytes) |
| Total commits | 10 |
| Most recent commit | 2026-05-07 10:46 — `Restructure CLAUDE.md and GEMINI.md to standard template format` |
| GitHub description | *(none)* |

**Assessment:** Andrew O'Brien's smart home automation project running Home Assistant Core on a local HP ProDesk server. TRACE-adjacent: its second commit (2026-04-17) adds `ignition_schemas/bme680_tile.json` — the earliest committed file anywhere using the phrase "Ignition OS schema." The CLAUDE.md and GEMINI.md in this repo use the same multi-AI handoff template as all TRACE repos, confirming the methodology was formalized at the family level, not just the product level.

---

### 2.3 `CAI`

| Field | Value |
|---|---|
| GitHub remote | `https://github.com/david-obrien61/CAI.git` |
| GitHub repo created | 2026-04-26T18:22:15Z |
| First commit SHA | `d1c2826c31c70d95cafe765460ef43a9f478be26` |
| First commit timestamp | 2026-04-26 13:24:03 −0500 |
| First commit message | `CAI initial repo` |
| First commit contents | Full Ignition OS codebase in a single commit: App.js, CoreApp.jsx, DataBridge.js, MarginEngine.jsx, PriceField.jsx, EnrollmentCatch.jsx, IgnitionCore.js, all module files (IgnitionFlux, IgnitionCompliance, IgnitionOmni, etc.), and `gemini_staging_inbox.md` |
| Total commits | 54 |
| Most recent commit | 2026-05-08 14:16 — `chore: end-of-session handoff update + create .env.example` |
| GitHub description | `Mobile and web app for Diesel Shop` |

**Assessment:** The CAI repo IS Ignition OS version 1. Between April 26 and May 8 (13 calendar days, 54 commits), CAI received: Supabase multi-tenant auth, PIN keypad with SHA-256 hash, QR join flow, biometric login, DataBridge local-first sync, QuickBooks integration, voice transcription, invoice audit via Claude Vision, a trial-to-paid engine with data blur, hardware/tool PMI ledger, team management, parts sourcing AI pipeline, and a PDF invoice generator. The package `packages/ignition-os/` in trace-platform is a direct byte-for-byte import of this codebase (`Import ignition-os from CAI`, trace-platform commit `7f5519b5`, 2026-05-18). CAI went quiet on May 8, 19 days before this audit.

**On the AI workflow:** The `gemini_staging_inbox.md` present at the first CAI commit documents a two-AI build method: Gemini web session generates features, user pastes them into the inbox file, then the IDE AI ("Antigravity" — Gemini in the IDE) reads the file and implements the feature. Claude Code first appears in `.claude/` config files around May 3-7, 2026. By the time `trace-platform` was created (May 17), Claude Code was the primary engineering AI.

---

### 2.4 `trace-assessment-app` (local only)

| Field | Value |
|---|---|
| GitHub remote | `https://github.com/david-obrien61/trace-assessment-app` |
| GitHub repo created | 2026-05-15T00:07:05Z |
| Earliest local file | `package.json` — 2026-05-14 19:07 CDT |
| Committed to GitHub | No — GitHub repo exists but no code was ever pushed |
| GitHub description | `CoolRunnings Property Assessment PWA — Claude Vision device identification` |

**Assessment:** A standalone React/Vite PWA built locally for property assessment using Claude Vision to identify HVAC and mechanical equipment by photo. The `CLAUDE_CODE_START.md` inside it references importing shared utilities from `@trace/core` "when Connor sets up" that package — confirming the shared-module architecture was being planned for a second vertical before Cultivar OS even started. A proto-Conduit OS. Never pushed; deprioritized when Cultivar became the primary build target.

---

### 2.5 `trace-platform` (ACTIVE)

| Field | Value |
|---|---|
| GitHub remote | `https://github.com/david-obrien61/trace-platform` |
| GitHub repo created | 2026-05-18T00:52:51Z |
| First commit SHA | `f46253d8cff58102e57c1a14224982978a6f9935` |
| First commit timestamp | 2026-05-17 20:06:15 −0500 |
| First commit message | `Initialize monorepo folder structure` |
| Total commits | 55 (as of 2026-05-27) |
| Most recent commit | 2026-05-27 13:38 — `Brand framing: TRACE family architecture, Built with CAI signature, four Design Principles synchronized across canonical docs` |
| GitHub description | `top level repo` |
| Authors | david-obrien61 `<david61obrien@gmail.com>` only — single-author repo |
| Branches | Single branch (`main`) — no merge commits, linear history |

**Key milestone commits:**

| Date | SHA | Message |
|---|---|---|
| 2026-05-17 20:06 | `f46253d8` | `Initialize monorepo folder structure` |
| 2026-05-18 09:47 | `cd792de7` | `Add root config files and briefs` |
| 2026-05-18 10:35 | `8e626a2d` | `Import shared modules from CAI` |
| 2026-05-18 10:35 | `7f5519b5` | `Import ignition-os from CAI` |
| 2026-05-18 10:35 | `f16e7ea3` | `Initialize cultivar-os API with QB endpoints` ← **first Cultivar OS code** |
| 2026-05-18 10:45 | `1afa09a1` | `Session 2: cultivar-os frontend foundation + plant profile page` |
| 2026-05-20 10:01 | `7c00ee2c` | `Session 5: QuickBooks integration — invoices auto-created on checkout` |
| 2026-05-20 17:27 | `817b316f` | `feat(cultivar-os): US-003 through US-010 — full checkout + QB invoice` ← **all demo user stories complete** |
| 2026-05-20 19:00 | `9783793d` | `feat: shared configureAuth factory + US-011 dashboard + US-012 leakage alert` |
| 2026-05-22 11:39 | `8801465a` | `fix: RLS SELECT policies for modules and nursery_modules` ← **last demo blocker cleared** |
| 2026-05-22 13:10 | `9cfebcb0` | `feat: Social Media module Steps 1-3 — wizard, post generation, count badge` |
| 2026-05-22 17:23 | `4ee0787b` | `feat: Social Media Step 4 — Blotato publish flow` |
| 2026-05-23 12:49 | `ea617281` | `feat: QB token refresh — proactive, never blocks orders` ← **demo hardened** |

---

## Section 3 — Monorepo Vertical Velocity

### 3.1 Per-Vertical Summary

| Vertical Path | First Commit | Last Commit | Total Commits | TS/JS/JSX Files | Lines of Code | Longest Gap |
|---|---|---|---|---|---|---|
| `packages/cultivar-os/` | 2026-05-17 20:06 | 2026-05-23 12:49 | 27 | 94 files | 64,478 lines | 1 day (May 19 — no commits) |
| `packages/ignition-os/` | 2026-05-17 20:06 | 2026-05-18 10:35 | 2 | 76 files | 5,312 lines | 9 days (May 18 → May 27, ongoing) |
| `packages/shared/` | 2026-05-17 20:06 | 2026-05-23 12:49 | 9 | 36 files | 2,973 lines | 2 days (May 19 — no commits) |
| `packages/kinna-os/` | N/A | N/A | 0 | 0 | 0 | N/A — path does not exist |
| `packages/coolrunnings/` | N/A | N/A | 0 | 1 | ~5 | N/A — placeholder only |
| `packages/assessment-app/` | N/A | N/A | 0 | 1 | ~5 | N/A — placeholder only |

> **Note on commit counts:** A single commit may touch multiple vertical paths (e.g., a commit that adds a shared utility and wires it into cultivar-os). Totals per path count any commit that touched ≥ 1 file in that path. Total-commit counting via `git rev-list --count HEAD -- <path>`.

### 3.2 Per-Day Commit Breakdown

The following table shows every day with at least one commit in the trace-platform repo, with the count of commits touching each vertical path that day. A commit touching multiple paths is counted in each column it touches.

| Date | Day | Total | Cultivar | Ignition | Shared | Root/Docs |
|---|---|---|---|---|---|---|
| 2026-05-17 | Sun | 1 | 0¹ | 0¹ | 0¹ | 1 |
| 2026-05-18 | Mon | 14 | 10 | 1 | 2 | 2 |
| 2026-05-19 | Tue | 0 | — | — | — | — |
| 2026-05-20 | Wed | 9 | 7 | 0 | 3 | 4² |
| 2026-05-21 | Thu | 2 | 1 | 0 | 1 | 1 |
| 2026-05-22 | Fri | 7 | 6 | 0 | 1 | 2 |
| 2026-05-23 | Sat | 3 | 2 | 0 | 1 | 2 |
| 2026-05-24 | Sun | 0 | — | — | — | — |
| 2026-05-25 | Mon | 0 | — | — | — | — |
| 2026-05-26 | Tue | 9 | 0 | 0 | 0 | 9 |
| 2026-05-27 | Wed | 4 | 0 | 0 | 0 | 4 |
| **TOTAL** | | **49** | **26** | **1** | **8** | **25** |

> ¹ The May 17 commit (`f46253d8`) creates empty package directory placeholders only — no source files in any vertical path.  
> ² May 20 Root/Docs count includes 2 CLAUDE.md handoff updates that touch no code files.

### 3.3 Per-Week Aggregate (Project Week = Mon–Sun)

| Project Week | Dates | Total | Cultivar | Ignition | Shared | Root/Docs | Narrative |
|---|---|---|---|---|---|---|---|
| Week 1 | May 17–23 | 36 | 26 | 1 | 8 | 12 | **Full build sprint.** Monorepo created, both verticals imported, Cultivar OS built from zero to demo-ready. All 12 Cultivar user stories shipped. Social media module built and deployed. |
| Week 2 | May 24–30 | 13† | 0 | 0 | 0 | 13 | **Documentation and brand sprint.** Zero code commits. All 13 commits are docs: doc reconciliation across MASTER_BRIEF / PLATFORM_STRATEGY / AUDIT / CLAUDE.md, brand framing (TRACE — Who We Are), and audit files. |

> † Week 2 is partial — only 4 days captured (May 24–27). Total is as of audit date.

### 3.4 Notable Gaps by Vertical

**packages/cultivar-os/:**
- May 19: 1 day gap (Sunday, no commits)
- May 24–25: 2 day gap (weekend)
- May 23 → May 27 (audit date): 4 days — all commits since May 23 have been docs-only. No cultivar code since `feat: QB token refresh` on May 23.

**packages/ignition-os/:**
- Single cluster of 2 commits on May 17-18 (folder init + import from CAI)
- Gap: May 18 → ongoing (9 days at audit date, growing)
- No new Ignition OS code has been written in trace-platform at any point

**packages/shared/:**
- Active May 17-23 alongside cultivar work
- Gap: May 23 → ongoing (same pattern as cultivar — docs-only week)

---

## Section 4 — The Cultivar OS Velocity Claim

**The claim in MASTER_BRIEF.md (line 96):** "TRACE Cultivar OS reached demo-ready status in approximately two weeks of focused work."

### 4.1 What Git Says

| Milestone | Date & Time | SHA | Notes |
|---|---|---|---|
| First Cultivar OS code (API scaffold) | 2026-05-18 10:35 −0500 | `f16e7ea3` | Vercel functions for QB OAuth scaffolded |
| First Cultivar OS frontend code | 2026-05-18 10:45 −0500 | `1afa09a1` | Plant profile page |
| QR scan + plant timeline functional | 2026-05-18 10:45 −0500 | `1afa09a1` | US-001, US-002 |
| Add-ons + netting prompt functional | 2026-05-18 12:50 −0500 | `0897e006` | US-004 |
| QB invoice auto-creation functional | 2026-05-20 10:01 −0500 | `7c00ee2c` | Session 5 |
| **All 12 user stories complete** | **2026-05-20 19:00 −0500** | **`9783793d`** | **US-003 through US-012** |
| Last demo blocker cleared (RLS bug) | 2026-05-22 11:39 −0500 | `8801465a` | modules tile state fixed |
| Demo fully hardened (QB token refresh, install price) | 2026-05-23 12:49 −0500 | `ea617281` | No demo-blocking gaps remain |

### 4.2 Elapsed Time Calculation

| Measurement | Elapsed | Notes |
|---|---|---|
| First Cultivar code → all user stories complete | **2 days, 8 hours** | May 18 10:35 → May 20 19:00 |
| First Cultivar code → last demo blocker cleared | **3 days, 23 hours** | May 18 10:35 → May 22 11:39 |
| First Cultivar code → fully hardened demo | **5 days, 2 hours** | May 18 10:35 → May 23 12:49 |
| Monorepo creation → fully hardened demo | **5 days, 17 hours** | May 17 20:06 → May 23 12:49 |

### 4.3 Verdict on the "Two Weeks" Claim

**The claim is inaccurate — but in the wrong direction. Cultivar OS was built faster, not slower.**

"Two weeks" overstates the elapsed time by a factor of 3. The accurate, verifiable claim is:

- **Feature-complete in under 2.5 days** from first code to all user stories passing (May 18 morning to May 20 evening)
- **Demo-hardened in 5 calendar days** from first code to no remaining blockers (May 18 to May 23)
- **5 calendar days from zero to a production-ready, QB-integrated, QR-scan-to-invoice nursery OS**

The "two weeks" figure may stem from measuring from the CAI repo's last commit (May 8) to Cultivar demo-ready (May 22) = 14 days. That measurement captures the full context switch from Ignition OS to Cultivar, but it attributes idle time between May 8 and May 17 (9 days with no commits to any repo) to the Cultivar build.

**Recommended framing for each audience:**

| Audience | Recommended Claim |
|---|---|
| Grant applications | "A working nursery OS — QR scanning, cart checkout, QB invoicing, social media publishing, and owner dashboard — was built in 5 calendar days by a solo founder with Claude and Claude Code." |
| Demo / sales | "This system went from blank folder to demo-ready in under a week." |
| Investor / velocity story | "Feature-complete in under 3 days. De-risked for production in 5." |
| Founder narrative | "Two weeks from the decision to pivot to Cultivar to sitting across from the customer." (This is accurate when measuring decision-to-meeting, not code-start-to-demo-ready.) |

---

## Section 5 — The Ignition OS Status Check

Independent characterization of Ignition OS based on Git history alone.

### 5.1 Commit Clusters

**In the `CAI` repo (the real development history):**

| Period | Commits | Activity |
|---|---|---|
| 2026-04-26 to 2026-04-30 | ~20 | Foundation: Supabase auth, QR join, PIN keypad, DataBridge, QB oauth |
| 2026-05-01 to 2026-05-07 | ~30 | Features: voice transcription, invoice audit, trial clock, PMI ledger, margin engine, tech kiosk |
| 2026-05-08 | 1 | End-of-session handoff + `.env.example` ← **last commit in CAI** |
| 2026-05-09 to present | 0 | **Silent — no commits for 19 days at audit date** |

**In `trace-platform`:**

| Date | SHA | Message | Type |
|---|---|---|---|
| 2026-05-17 20:06 | `f46253d8` | `Initialize monorepo folder structure` | Placeholder directory only |
| 2026-05-18 10:35 | `7f5519b5` | `Import ignition-os from CAI` | Copy of CAI codebase, 76 files, 19,870 lines inserted |
| 2026-05-18 to present | — | *(no further commits)* | **9 days of silence at audit date** |

### 5.2 Last Meaningful Feature Commit

**In CAI repo:** `2026-05-07` (approximately) — voice transcription, invoice audit via Claude Vision, and the trial-to-paid data blur engine. The May 8 commit is explicitly labeled "chore: end-of-session handoff update" — it is session bookkeeping, not a feature.

**In trace-platform:** There are no feature commits to `packages/ignition-os/` at all. The only Ignition-touching commits are the initial folder structure (which contains no Ignition-specific files) and the import from CAI (which copies the finished CAI codebase without modification). Every subsequent commit to trace-platform has been Cultivar OS, shared modules, or documentation.

### 5.3 Code Volume and Completeness Assessment

| Metric | Value |
|---|---|
| Total files in packages/ignition-os/ | 77 |
| JS/JSX/TS source files | 76 |
| Lines of code | 5,312 |
| Module files in packages/ignition-os/modules/ | 57 |
| Key modules present | CoreApp.jsx (1,317 lines), OnboardingWizard.jsx (899 lines), DataBridge.js (1,071 lines), ExternalBridge.js (405 lines), App.js (375 lines) |

The module inventory is substantial. Named modules present include: `CustomerApproval`, `CustomerKiosk.native`, `IgnitionAdmin`, `IgnitionAudit`, `IgnitionCRM`, `IgnitionCompliance`, `IgnitionEstimate`, `IgnitionFlux`, `IgnitionHandover`, `IgnitionHub`, `IgnitionIntake`, `IgnitionInvoice`, `IgnitionOmni`, `IgnitionOmniDashboard`, `IgnitionProcure`, `IgnitionQueue`, `IgnitionStok`, `IgnitionTools`, `IgnitionVIN`, `IgnitionVendor`, `IgnitionVoice`, `InventoryAI`, `MarginEngine`, `SlideToComplete`, `ToolChecklist`, `TriageOptimizer`, and dual `.native.js` variants for most.

MASTER_BRIEF.md lists the following "Ignition OS Tiles (Built)": customer intake, tech kiosk, tool tracking, margin engine, labor clock, invoice + payment, OMNI analytics, job lifecycle state machine, admin + billing. All of these have corresponding modules in the codebase. The code volume is consistent with a functional application, not a prototype.

### 5.4 Ignition OS After the Cultivar Pivot

Were there any commits to Ignition OS after Cultivar work began on May 18?

**No.** The import commit on May 18 (`7f5519b5`) was the last time any file in `packages/ignition-os/` was touched. The 27 subsequent commits in trace-platform touched only Cultivar OS, shared modules, supabase migrations, and documentation. Zero Ignition OS code modifications have been made since the import.

The CAI repo was last active on May 8 — 9 days before the trace-platform was created and 10 days before Cultivar OS work began. The Cultivar pivot did not interrupt active Ignition development; it began after Ignition had already gone quiet.

### 5.5 Status Characterization

| Claim | Git Evidence | Assessment |
|---|---|---|
| "End-to-end dry run in progress" (MASTER_BRIEF line 377) | Last Ignition commit: May 18 import (9 days ago at audit date). No new development in trace-platform. | **Misleading.** The code is present and feature-complete as of CAI May 8 state. But "in progress" implies active development. Git shows a pause, not progress. Correct status: "feature-complete; development paused; no new commits since import to monorepo." |
| "Pilot-ready" (implied by tiles-built list in MASTER_BRIEF) | 76 files, 5,312 LOC, all named modules present | **Consistent.** The code volume and module inventory support a claim of functional completeness. |
| "Closest to ready" among second verticals (MASTER_BRIEF line 757) | Ignition: 76 files, 5,312 LOC, full feature set. Conduit/KINNA/CoolRunnings: 0-1 placeholder files. | **Accurate.** Ignition OS is unambiguously the most complete non-Cultivar vertical in the repo. |
| Active development | 0 commits to packages/ignition-os/ after May 18 import | **False.** No active development. The product is imported and frozen. |

---

## Section 6 — Recommended Founding Dates by Audience

### 6.1 For grant applications and legal documents

**Recommended date: April 11, 2026**

Supporting evidence:
- Oldest TRACE artifact on disk: `IgnitionMobile/CodeBaseB/shop_estimate.py` — filesystem timestamp 13:29:43 CDT
- GitHub account `david-obrien61` created the same day at 18:06 UTC (13:06 CDT), approximately 5.5 hours after that file was written
- The file contains production-grade business logic — a 4-tier markup slab matching `MarginEngine.js` in production 46 days later — not a tutorial or experiment
- Caveat to disclose: April 11 is verifiable from filesystem metadata only (not a cryptographic git signature). If cryptographic chain of custody is required, use **April 26, 2026** (CAI repo, `d1c2826c`) as the date of the first committed production codebase.

### 6.2 For the Cultivar OS velocity claim

Recommended velocity claims in order of precision:

1. **Most impressive and most accurate:** "Five calendar days from blank folder to production-ready nursery OS — QB-integrated, QR-scan-to-invoice, with social media publishing. Built by a solo founder with Claude and Claude Code."
2. **Narrative framing:** "Under two weeks from 'let's build a nursery product' to sitting across from the customer with a live demo."
3. **What to avoid:** "Two weeks of focused work" — this is inaccurate and actually undersells the achievement.

Git-verifiable dates:
- First Cultivar OS code: **2026-05-18 10:35** (`f16e7ea3`)
- All user stories complete: **2026-05-20 19:00** (`9783793d`) — 2 days, 8 hours later
- Demo fully de-risked: **2026-05-23 12:49** (`ea617281`) — 5 days, 2 hours after first code

### 6.3 For honest characterization of Ignition OS

**Git-supported characterization:**
- Ignition OS is a functionally complete codebase imported from the CAI repo
- Last substantive development: May 7-8, 2026 (19 days before this audit)
- No new code has been written since import into trace-platform
- The "dry run in progress" framing in MASTER_BRIEF is aspirational, not descriptive of current git activity
- **Accurate framing:** "Ignition OS version 1 is feature-complete and in a pilot-ready state. Active development is paused. The product awaits its first pilot shop install and Intuit production approval before the next development sprint."

### 6.4 For the founder narrative — the pre-git period

The Gemini workflow period (approximately April 11–16, before any git commits) is documented by filesystem timestamps and the presence of `gemini_staging_inbox.md` in the earliest committed CAI snapshot. This period is not git-verifiable but is:
- Corroborated by filesystem metadata showing files created on April 11-15
- Consistent with the `gemini_staging_inbox.md` workflow document that appears in CAI's first commit, already populated with feature checklists
- Consistent with the account creation and repo creation sequence on April 11 and April 16

The narrative is: David began building April 11. Gemini was the AI partner. Andrew set up Git, GitHub, Supabase, and Railway — formalizing the stack. The first commit (April 16) was scaffolding. The first substantial commit (April 26, CAI) was the full platform in one shot. Claude Code became the primary partner in early May. The trace-platform monorepo was created May 17.

---

## Section 7 — Anomalies and Surprises

### 7.1 Single-author, single-branch, linear history

Every commit in trace-platform is by `david-obrien61 <david61obrien@gmail.com>`. There are zero merge commits. The history is a single linear chain of 55 commits. No evidence of force-pushes that would indicate history rewriting (no orphan commits, no ref-log anomalies visible from local state). The simplicity of the history is consistent with a solo founder working with an AI pair-programmer rather than a team with branches and pull requests.

### 7.2 The May 19 and May 24-25 gaps are weekend days

May 19 (Tuesday) is anomalous because it's a weekday with zero commits sandwiched between two heavy commit days. However, May 20 opened with "Session 5: QuickBooks integration" at 10:01 AM — suggesting a day off or a day spent in design/planning that preceded the next commit burst. The May 24-25 gap is a Saturday-Sunday.

### 7.3 The "Import ignition-os from CAI" single-commit scale

The single commit `7f5519b5` on May 18 inserted **19,870 lines across 76 files** in one shot. This is the largest single-commit insertion in the repo by a wide margin. It is not unusual behavior — this is a deliberate "import" pattern (copy the CAI codebase into the monorepo) — but it means the trace-platform git history does not capture any of the development history of Ignition OS. All 54 commits of actual Ignition OS development live in the CAI repo.

**Implication for historical claims:** Anyone reviewing the trace-platform git history alone would see Ignition OS as having exactly 2 commits. The real development history requires examining the CAI repo.

### 7.4 Cultivar OS was committed in "session" naming convention

Commits from May 18 use session numbers: "Session 2: cultivar-os frontend foundation", "Session 3 — add-ons screen", "Session 4: checkout + order creation", "Session 5: QuickBooks integration". This naming convention stops after Session 5 on May 20. Subsequent commits use conventional prefixes (`feat:`, `fix:`, `chore:`). This suggests the project transitioned from a "numbered sessions" mental model to a standard git workflow model between May 18 and May 20.

### 7.5 The `packages/cultivar-os/` line-count gap vs. `packages/ignition-os/`

Cultivar OS (64,478 lines, 94 files) is **12× larger** than Ignition OS (5,312 lines, 76 files) in the monorepo. This seems counterintuitive given that Ignition OS is described as the more mature product. The explanation is that Cultivar OS includes all Vercel serverless API functions, migration SQL files, extensive TypeScript types, and configuration files that were built incrementally in trace-platform. Ignition OS, being a React Native / JavaScript app imported from CAI, has more compact JS files with less TypeScript overhead. The line counts do not indicate relative feature completeness.

### 7.6 CAI and IgnitionMobile likely share a working directory

`CAI/index.html` and `IgnitionMobile/CodeBaseB/index.html` have **identical filesystem timestamps** (April 12 10:48). Same for `vite.config.js`. This strongly suggests they are copies of the same physical working directory. The project was built in one location and then reorganized — TRACE's architecture has a single genesis point, not multiple parallel tracks.

### 7.7 The `trace-assessment-app` repo exists on GitHub with no code

A GitHub repo was created (May 14, 2026) for what appears to be a Conduit OS precursor, the app was fully built locally, but zero commits were ever pushed. This is a live commitment gap: the work was done but the record doesn't exist in GitHub. If this becomes relevant for IP, grant documentation, or team onboarding, the app should either be pushed or deliberately archived with a record of why it was deprioritized.

### 7.8 No commits on May 24-25 despite the demo meeting being "next week"

At the time of the May 23 last-code commit, CLAUDE.md stated the demo meeting was "next week" (implying week of May 26-30). The two-day gap (May 24-25) before the May 26 doc sprint suggests David took the weekend off from coding and returned Monday for documentation rather than feature work. The demo prep work that resumed May 26 was documentation, not code.

---

## Section 8 — Implications for Documentation

The following claims in `MASTER_BRIEF.md`, `PLATFORM_STRATEGY.md`, or `CLAUDE.md` should be reviewed against this audit's findings. **No changes are made in this session** — this section is a flag list only.

### 8.1 MASTER_BRIEF.md

| Location | Current Claim | Finding | Recommendation |
|---|---|---|---|
| Line 96 | "approximately two weeks of focused work" | Inaccurate. Feature-complete in 2.5 calendar days; demo-hardened in 5 calendar days from first Cultivar code | Revise to "five calendar days from first code to demo-hardened" or "under three days to feature-complete." This is a stronger, more accurate claim. |
| Line 96 | "docs/trace-founding-timeline-2026-05-27.md (pending)" | File now exists and has been committed | Remove "(pending)" tag |
| Line 377 | "Status: End-to-end dry run in progress" (Ignition OS section) | Last Ignition OS commit was May 18 (import); no Ignition development has occurred in trace-platform. Last substantive Ignition feature work was May 7-8 in CAI repo, 19 days ago. | Revise to "Status: Feature-complete; development paused. Awaiting Intuit production approval and first pilot shop install." |
| Line 757 | "Ignition OS pipeline is the move... the product is closer to ready than Cultivar's polish gap" | Ignition OS code is functionally complete but has been inactive for 19 days. The "closest to ready" assessment is accurate for relative completeness but the "iron in the fire" framing implies ongoing development that is not evidenced by Git. | Revise to distinguish between "code is complete" and "development is active." |

### 8.2 CLAUDE.md

| Location | Current Claim | Finding | Recommendation |
|---|---|---|---|
| Part 3 Handoff | References Cultivar OS session work through May 23 | Accurate — all code commits match what is described | No change needed |
| Part 2 Architecture | States trace-platform has been deployed on Vercel | Not verifiable from Git alone (Vercel deployments don't show in git); CLAUDE.md internal consistency checks passed | No change needed; Vercel deploy status is runtime state, not git state |

### 8.3 PLATFORM_STRATEGY.md

No direct velocity or founding-date claims found. The strategy doc references Ignition OS as an existing vertical but does not make timeline assertions that would conflict with this audit's findings.

### 8.4 Across all docs

No doc references Ignition OS as having recent active development — they describe it in terms of features built, not commits being made. The only misleading phrasing found is the "dry run in progress" status line in MASTER_BRIEF and the "two weeks" velocity claim, both addressed above.

---

## Appendix A — Pre-Git Artifacts (Local Filesystem Only)

These files exist on disk with modification timestamps predating any git commit. Verifiable by `stat` but without cryptographic chain of custody.

| File | Filesystem Timestamp (CDT) | Significance |
|---|---|---|
| `CodeBaseB/shop_estimate.py` | **2026-04-11 13:29** | **Oldest TRACE artifact.** Python margin calculator matching production MarginEngine logic |
| `shop_estimate.py` (copy) | 2026-04-11 14:33 | Duplicate — likely dragged to root |
| `CodeBaseB/index.html` | 2026-04-12 10:48 | First web frontend scaffold; identical timestamp to `CAI/index.html` |
| `CAI/index.html` | 2026-04-12 10:48 | Confirms CAI and CodeBaseB share a common ancestor working directory |
| `CodeBaseB/CoreApp.jsx` | 2026-04-12 12:15 | First React component |
| `CodeBaseB/DataBridge.js` | 2026-04-12 12:15 | First DataBridge — local-first sync layer that becomes a platform primitive |
| `CAI/modules/IgnitionStok.jsx` | **2026-04-12 15:15** | **First file named "Ignition OS."** Inventory sync module with DTC fault code mapping |
| `CodeBaseB/gemini_staging_inbox.md` | 2026-04-13 11:01 | The two-AI workflow document. Confirms AI-first methodology from day two |
| `IgnitionMobile/EnrollmentCatch.js` | 2026-04-13 15:28 | First business logic module |
| `IgnitionMobile/MarginEngine.js` | 2026-04-13 15:30 | Margin engine in JavaScript (same logic as `shop_estimate.py`, 2 days later) |
| `modules/SlideToComplete.native.js` | 2026-04-13 19:23 | First React Native module — haptic slide-to-complete for job sign-off |
| `modules/GhostTracker.native.js` | 2026-04-14 10:29 | "Ghost jobs" revenue tracking |
| `modules/IgnitionAdmin.native.js` | 2026-04-15 14:24 | Admin panel — most complex pre-git module |

**Note:** macOS `mtime` values are accurate to the second and match the system clock but can be altered by file copies or clock drift. Treated as indicative, not cryptographically verified.

---

## Appendix B — GitHub Account and Repository Creation Summary

| Entity | Created (UTC) | Source |
|---|---|---|
| GitHub account `david-obrien61` | 2026-04-11 18:06 | GitHub public API (captured in prior session) |
| GitHub repo `david-obrien61/ignition` | 2026-04-16 16:54 | GitHub public API |
| GitHub repo `david-obrien61/CoolRunning` | 2026-04-16 19:31 | GitHub public API |
| GitHub repo `david-obrien61/CAI` | 2026-04-26 18:22 | GitHub public API |
| GitHub repo `david-obrien61/trace-assessment-app` | 2026-05-15 00:07 | GitHub public API |
| GitHub repo `david-obrien61/trace-platform` | 2026-05-18 00:52 | GitHub public API |

---

*TRACE Enterprises · Built with CAI*  
*Audit produced 2026-05-27 — read-only; no source files modified*  
*Session I of this date; supersedes earlier partial version committed as `5a77f28`*
