# Findings & Cleanup — Session 2026-06-04

**Date:** 2026-06-04
**Type:** Live-testing findings (Ignition + Cultivar), sorted by when-to-fix.
**Builds on:** `onboarding-flow-findings-2026-06-03.md`, `platform-naming-vertical-leak-audit-2026-06-03.md`. Several items below are **confirmations** of things those docs predicted — noted inline.
**Decision this session:** Demo pushed to land the shared Identity & Access capability polished (same call as SM). See `SPEC-identity-and-access-2026-06-04.md`.

---

## The one-sentence diagnosis

The verticals were built as **siblings (copy-paste-then-diverge)** instead of as **consumers of a shared spine.** Every finding below is a symptom of that one root: capabilities built per-vertical or left half-built, vertical-noun tables leaking, and queries firing against tables/shapes that don't exist. The fix is one architectural move applied repeatedly — define each capability once in `packages/shared`, drive consumption via `business_modules`, stop copying.

---

## 🔴 BEFORE the demo (demo-safety only — small)

| # | Finding | Why it matters | Action | Status |
|---|---|---|---|---|
| D1 | Cultivar returning-owner sign-in | Lauren is a returning owner; if her sign-in path breaks she's locked out day-two. | **Decision: demo runs on the NEW shared auth, built first.** So this is covered by the rebuild, NOT by testing current Cultivar. *If* the demo ever reverts to running on current auth, test it then. (Note: prior doc confirms David's existing OWNER login works; the *new-owner* flow was untested — but new shared capability supersedes.) | Covered by rebuild |
| D2 | `[SM-TRACE]` / `[AUTH-TRACE]` debug logs flooding console | 46 issues in tonight's Cultivar console, much of it trace noise; unprofessional if a console is ever visible, and it hides real errors. | Gate `AUTH_DEBUG = false` and `SM_DEBUG = false` (STD-003 — preserve the probes, just silence). Thunder already offered to do this once sign-in was verified. **Sign-in IS verified now.** | Ready to do |

---

## 🟠 BEFORE real customer data / PINs (security & correctness — not demo-blocking)

| # | Finding | Why it matters | Action |
|---|---|---|---|
| S1 | **PIN hashing is fast SHA-256 over a 4-digit space** | 10,000 possible PINs + a fast hash = effectively reversible by anyone with `pin_hash` read access. The `{id}:` prefix salts across tenants but doesn't stop targeted brute-force. | bcrypt/argon2 + lockout-after-N. Spec §3. |
| S2 | **Reset flow grants ADMIN with no authorization check** | `pin_resets` verify matches `reset_code + shop_id + used + expiry` only — no check the requester is allowed to reset this business. Anyone who can write/read a code mints admin. Privilege-escalation path. | Add identity-tied authorization to PIN reset. Spec §5b. |
| S3 | **Reset codes stored plaintext** (`reset_code text`) | Plaintext credentials at rest. | Hash reset codes; keep the 1-hr expiry. Spec §5b. |
| S4 | **Silent signup failure** | `OwnerSignup` member-insert can fail while `onSuccess` still fires → owner created with no `business_members` row → locked at PIN gate. **This happened to David tonight (empty `shop_members`).** Prior doc (2026-06-03 §2) predicted exactly this. | Insert failure must HALT signup, surface a real error, and roll back / retry. Spec §7 AC#1. |
| S5 | **`member_devices` table missing** (404 on GET+POST, Ignition) | Code calls `/rest/v1/member_devices`; table was DROPPED June 2 (`20260602_ignition_drop_team_tables.sql`) and never recreated. Device layer is non-functional. | Recreate `business_id`-scoped per Spec §2. |
| S6 | **`pin_resets` table missing** (Ignition) | Code references it; dropped June 2, never recreated. **FORGOT PIN recovery is currently non-functional** (the "well-designed" flow has no backend). | Recreate `business_id`-scoped per Spec §5b. |
| S7 | **Owner self-recovery gap** | PIN reset generator lives in Admin→Team, behind the PIN gate. Top-level owner (no manager above) can't generate a code → chicken-and-egg lockout. **This is why David needed SQL to get in tonight.** | Owner self-recovery via Layer-1 identity. Spec §5b. |
| S8 | **`social_drafts` 400 (Bad Request)**, repeating in Cultivar | SM capability firing malformed queries on every dashboard load (bad select / column mismatch). Confirms SM is unbuilt and erroring live. | Resolve as part of SM build; verify table shape vs. query. |
| S9 | **`nursery_profiles` 406 (Not Acceptable)**, repeating in Cultivar | Likely `.single()` against a missing row; also a vertical-noun table (AC-1 leak — June-3 audit Finding #2). | Rename → `business_profiles` (Spec §4) + fix the lookup to tolerate no-row. |

*Note on the `1234` plaintext seen in `pin_hash` tonight:* **manually hand-entered by David during debugging** (PIN typed into the hash field by mistake), NOT a code bug. Action: *verify* the normal write path hashes correctly (folds into S1). Not a standalone finding.

---

## 🟡 POST-DEMO (the real architecture work — build shared, once)

### Capabilities to build/relocate into `packages/shared`
| # | Finding | Why it matters | Action |
|---|---|---|---|
| A1 | **Shared Identity & Access capability** | The keystone. Auth/PIN/device/reset built 3× (Ignition, Cultivar, now spec). Everything sits on it. | Build per `SPEC-identity-and-access-2026-06-04.md`. |
| A2 | **SM (Social Media) — build shared** | Built per-vertical, unbuilt/erroring (S8). Spec already exists. | Build shared per the SM spec; social-publishing as an adapter slot. |
| A3 | **QB (QuickBooks) — build shared adapter** | Cultivar has it real-ish; **Ignition has a QB "thing" that isn't built out** (it's in an audit). Doesn't transfer cleanly today. | Build as a pluggable accounting adapter in `shared`, both verticals consume. |

### Prerequisite (blocks A1–A3 from transferring)
| # | Finding | Why it matters | Action |
|---|---|---|---|
| P1 | **Ignition has NO `business_modules` table** | Confirmed by David (copied full Ignition table list — `business_modules` absent). Without it, Ignition cannot do the connector/capability model at all. Every shared capability assumes it exists per vertical. | Add `business_modules` to Ignition, **same shape as Cultivar's** (migrated this morning: `business_id, module_key, enabled, configured, config jsonb, timestamps`, PK `(business_id, module_key)`, membership-scoped RLS). |

### Identity-table reconciliation (kills split-brain — also Spec §4)
| # | Finding | Why it matters | Action |
|---|---|---|---|
| R1 | `businesses` vs `shops` | Two org models; sign-in uses `businesses`, PIN gate used `shop_members`. The mismatch IS the split-brain. | Canonical = `businesses` (+ `business_type`). Retire/`view` `shops`. |
| R2 | `users` / `employees` / `shop_members` vs `business_members` | Multiple "people" tables. | Canonical = `business_members`. |
| R3 | Cross-vertical tables in Ignition project: `nurseries`, `plants`, `plant_events` | Cultivar tables living in the Ignition Supabase project (`ufsgqckbxdtwviqjjtos`). AC-1 violation at the schema level. | Remove from Ignition project / noun-purge. |

### Hygiene / dead code
| # | Finding | Action |
|---|---|---|
| H1 | Legacy root `OnboardingWizard.jsx` (Ignition) — confirmed dead (only imported by `IgnitionCore.js`, not in web build). | Delete. |
| H2 | `App.js` mobile entry (Ignition) — dead for web; source of the regenerating `JOB-999` / `JOB-1102` demo blob in localStorage (harmless). | Delete / quarantine. |
| H3 | Stale demo seed `JOB-999` / `JOB-1102 // ???? UNKNOWN` in top bar. | Goes away with H2. |
| H4 | Carry-over from June-3 naming audit (still open): QR `nurseryName`, Settings placeholder, DiscoveryGlimpse "Cultivar OS", AIEngine `shopId`, color defaults `#27500A`, dual demo env vars. | See `platform-naming-vertical-leak-audit-2026-06-03.md` Do-Now / Post-Demo tables. |

---

## What changed vs. prior docs (so they reconcile)

- **`shop_members` empty / signup failure** — predicted in 2026-06-03 onboarding findings §2 ("table dropped, code still references it"). **Confirmed live tonight** and traced to the silent-`onSuccess` path (S4). `shop_members` was recreated (`20260603_recreate_shop_members.sql`); `member_devices` + `pin_resets` were **not** (S5, S6).
- **`nursery_profiles` / `nursery_modules`** — naming audit Findings #1, #2. Tonight: `nursery_profiles` confirmed **erroring live** (406) in Cultivar (S9). `business_modules` confirmed **absent in Ignition** (P1).
- **Ignition sign-in loop** — naming audit concluded it was the OWNER SYNC effect not setting `onboardingDone`. Tonight's session found and fixed the **adjacent** issue: the "Sign in" link mapped `signInPath '/'` → `setStep('WELCOME')` with **no SIGNIN screen existing**; built the SIGNIN step + `signInWithPassword`. Both are the same family (returning-user path under-built). **Now verified live** (returning owner signs in → reaches Command Grid).

---

## Tonight's actual win

Got into JB Auto through the front door (sign-in fix → `business_members` row → correct bcrypt-target hash typed at gate). More importantly: made the **foundational architecture call** (shared Identity & Access, build once) and **timed the demo to land it polished.** The lockout was the teacher — getting locked out of the identity layer is how its real shape got found. Map is now on paper (this doc + the spec). Backlog is sorted, not scattered.

---

*Hand both docs to Thunder to commit into the repo (audit/findings location per CLAUDE.md Part 9). Then rest.*
