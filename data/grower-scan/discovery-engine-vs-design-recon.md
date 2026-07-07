# THUNDER RECON — Discovery engine vs DESIGN INTENT + grower-scan grounding

**Date:** 2026-07-07
**Nature:** Verify-first recon, **READ-ONLY** — no code, schema, migration, or build. Nothing changed. Two-bar/schema gates N/A (nothing built).
**Repo is authority.** Every finding is grounded in live `file:line` evidence; where recall/design-docs and the code disagreed, the **code won**.
**Privacy respected:** `data/grower-scan/*.csv` are gitignored / desktop-only — **NOT read**. Only the tracked `*.md` recon notes were read.

**Purpose:** measure the discovery engine against its DESIGN INTENT and the gap-vs-decision principle, and check whether its per-vertical knowledge is GROUNDED in the ~31-nursery grower-scan market research or GUESSED.

---

## DESIGN INTENT (the yardstick — recovered from David's design discussions + the brief)

- Discovery scrapes a business's website to surface COMMON ISSUES / PROBLEMS / INSIGHTS for that business — grounded in real patterns, not guesses.
- Vertical-agnostic engine, PRE-FILTERED per vertical for that vertical's vocabulary + pain points (per-vertical `commonPainPoints` is BY DESIGN, not a leak).
- **Pain-first** (not website-first): listen → restate → iterate → confirm. Voice primary, text fallback.
- **THREE PATHS:** library-match → demo; no-match → "hollow shell" mockup labeled **"Proposed Feature — Not Yet Built"**; out-of-scope → honest refusal ("won't touch").
- **HONESTY ABOUT STATE:** found-on-site vs suggested/proposed must be distinctly labeled.
- **GAP-vs-DECISION principle (banked 2026-07-07):** an absent service may be a deliberate business decision, not a gap. Surface as a QUESTION not an assertion; respect owner corrections and stop re-surfacing; offer to IMPROVE a chosen model (e.g. formalize contractor referrals) rather than presume a gap.

This design intent is written into the repo — see [DISCOVERY_MODULE_BRIEF.md](../../DISCOVERY_MODULE_BRIEF.md) (Core Design Principles, incl. the banked gap-vs-decision block at :50-55), THOUGHTS.md:257 (pain-first), THOUGHTS.md:261-265 (three paths).

---

## FILES EXAMINED (all read; excerpts, not whole-file dumps where large)

**Engine (shared):** `packages/shared/src/discovery/` — engine.ts, seed.ts, synthesis.ts, types.ts, index.ts, verticals/nursery.ts, DiscoveryGlimpse.tsx (onboarding UI). (Also present but tangential: catalog.ts, populate.ts, compare.ts, costDiscovery.ts.)
**Endpoint:** `packages/cultivar-os/api/discovery/ingest.ts` (multiplexed POST actions through one Vercel function).
**UI surfaces:** `packages/cultivar-os/src/pages/DiscoveryInspect.tsx` (the v1 tool) + the shared `DiscoveryGlimpse.tsx` (onboarding-embedded).
**Design docs:** `DISCOVERY_MODULE_BRIEF.md`, `docs/DISCOVERY-ONBOARDING-CONCEPT-COMPILED.md`.
**Grower research (tracked notes only):** `data/grower-scan/grower-scan-report.md`, `data/grower-scan/role-and-discovery-recon.md` (CSVs NOT read).

---

## R1 — BUILT vs DESIGN

| Design element | Status | Evidence |
|---|---|---|
| **Website-first vs pain-first** | **Website-first BUILT; pain-first NOT-BUILT** | Both surfaces are URL→analysis. `painPoint` is a single *optional text field* passed through (engine.ts:96, DiscoveryInspect.tsx:87) and echoed into the email (synthesis.ts:31-37). There is **no listen→restate→iterate→confirm loop, no conversation, no voice**. The design's core mechanic (DISCOVERY_MODULE_BRIEF.md:42; THOUGHTS.md:257 "the new design starts with the prospect's pain… website becomes secondary") is absent. |
| **Three-paths model** (library-match→demo / no-match→hollow-shell "Proposed Feature — Not Yet Built" / out-of-scope→refusal) | **NOT-BUILT** | Zero pain-point library, zero hollow-shell generator, zero refusal path. grep for `hollow` / `Not Yet Built` / `won't touch` / refusal across all discovery code = **nothing**. The engine has exactly ONE path: URL→two-pass AI→profile→email. The three paths live only in THOUGHTS.md:261-265. |
| **Honesty-about-state (found vs suggested)** | **PARTIAL — better than feared** | The worry ("servicesFound discarded, uniform service_note") is **mostly unfounded**. `servicesFound` (explicit on site) is preserved on the profile and kept distinct from `suggestedOfferings` (proposed) at the type level (types.ts:26,30). Both UIs label them distinctly: DiscoveryInspect → "Strengths observed" / "Gaps (not mentioned on site)" / "Suggested service offerings"; DiscoveryGlimpse → "Strengths" / "Opportunities" / "Suggested in Cultivar OS". `seed.ts` is genuinely D-9 honest (suggested rows written `is_active=false`, flagged "price not set; confirm before activating"; unknown category → `uncategorized` not silent `addon` — seed.ts:16-24,68-80). **Two real nuances:** (a) `seed.ts` seeds ONLY `suggestedOfferings` — the confirmed `servicesFound` are shown but never written to `service_offerings`; (b) the DONE view relabels `gaps` as "**Opportunities**" — an assertion framing, which is the R3 defect, not a labeling-of-found defect. |
| **Is /discovery/inspect the OLD v1?** | **YES — it is the v1 being redesigned** | `DiscoveryInspect.tsx` is an internal prospecting tool: pick any URL + vertical + optional pain → analysis → copy/send email. It matches THOUGHTS.md:257 *verbatim* ("The current /discovery/inspect takes a URL and produces analysis"). `DiscoveryGlimpse` is the newer onboarding-embedded surface (still website-first, plus identity-conflict resolution + catalog seed). **Neither is the pain-first/three-paths design** — both are the website-first predecessor the design set out to replace. |

**Two-pass architecture (context):** the endpoint runs Haiku identity extraction (engine.ts:24 `runIdentity`) then Sonnet deep analysis (engine.ts:72 `runAnalysis`), then a silent-partner email (synthesis.ts:19 `runSynthesis`). The vertical schema pre-filters the prompt: engine.ts:98-102 injects `schema.extractionHints` + `schema.commonPainPoints`. Per-vertical filtering is BY DESIGN (confirmed intent), so that is not a leak.

---

## R2 — GROUNDED IN GROWER-SCAN, OR GUESSED?

**VERDICT: GUESSED (hand-authored, roadmap-derived) AND DISCONNECTED. The config cannot be grounded in the research — it predates it by ~3 weeks, and the research measures a different dimension entirely.**

Three independent proofs:

1. **Chronology is dispositive.** `verticals/nursery.ts` was committed **2026-05-29** ("Discovery v0: website inspection + silent partner analysis engine"). The grower-scan report is dated **2026-06-21**, and was only tracked in-repo **2026-07-06** ("chore: track grower-scan recon notes; gitignore named-nursery CSVs"). The config literally could not be grounded in research that did not yet exist.

2. **No wiring anywhere.** grep for `grower-scan` / `archetype` in discovery code = zero. `typicalOfferings` is defined in nursery.ts:33-42 but is **read by nothing** (engine.ts consumes only `extractionHints` + `commonPainPoints`) — dead config. There is **no code path** feeding grower findings into discovery config. Research lives on the desktop; config is hand-written.

3. **The research measures a *different dimension*.** `data/grower-scan/grower-scan-report.md` is a **catalog-scrapability fingerprint study** of 28 growers (3 anchors excluded). Its conclusions are about *whether you can scrape a grower's catalog*, NOT about services / gaps / "offers X but not Y" / archetypes:
   - Only **8/28** have a real scrapable catalog; **17/28** fingerprint predictions were **wrong** (report §2).
   - The "destination garden center = rich catalog" thesis **collapsed** — 2 of 15 held.
   - **Web maturity is bimodal** — a grower runs either a genuine e-comm/catalog engine or a brochure, "very little middle." Several publish stock only on Instagram/Facebook.
   - Richest data came from unexpected places (Far South's `/available` page = 647 rows; Hope Valley's retail PDF = the only site exposing name+size+price+stock together).

   None of this touches the services-offered / pain-point / "offers X but not Y" dimension that `nursery.ts` encodes. So even the research that DOES exist cannot ground nursery.ts's pain points.

**What nursery.ts actually is:** its `commonPainPoints` (manual invoicing; missed netting add-ons; delivery routing; warranty follow-up; social content; leakage — nursery.ts:24-31) are the **Cultivar / LAWNS product roadmap restated as "common pain points"** — the exact modules TRACE already built for LAWNS, not empirical cross-grower findings. That is roadmap-derived hand authoring — precisely the "guessed" concern.

**Honest twist (matters for the fix):** the grower-scan research IS genuinely relevant — but to the **catalog-populate path** (`populate.ts` / `catalog.ts`, capability 1.3), not to nursery.ts's pain points. And even there it is disconnected (desktop research, no config feed). Corroborated by `data/grower-scan/role-and-discovery-recon.md`, which describes the live engine writing catalog rows to `business_inventory` with `cost_confidence='UNKNOWN'` — i.e. the engine's grower-facing surface is catalog population, a different concern than the offerings/pain config.

---

## R3 — GAP-vs-DECISION: does the engine distinguish them?

**The principle is BANKED in the design but NOT IMPLEMENTED in code. The engine asserts opportunities; it does not ask questions.**

- **Design intent is explicit and rich** — DISCOVERY_MODULE_BRIEF.md:50-55, "**Not every absence is an opportunity (gap vs business decision)**", with the exact **"sells trees but doesn't offer planting → deliberate referral model, not an oversight"** example, the LAWNS **"fertilizer bundled into installation on purpose"** cousin case, and four rules: (1) surface an observed absence as a QUESTION not an assertion; (2) respect owner corrections and stop re-surfacing (record it as a business decision — the cousin of the Path-3 "won't touch" marker); (3) offer to IMPROVE the chosen model (formalize/track the contractor referral); (4) BuiltWithCAI thesis — tell a deliberate model apart from a genuine gap. This is the 2026-07-07 banked principle, written into the brief.

- **Code does the opposite:**
  - The prompt frames absences as assertions: gaps = "2-4 things common to {vertical} businesses that are **not mentioned on this site**" (engine.ts:117); suggestions = "suggest 3-6 services that this business **could add or formalize**" (engine.ts:130). No "deliberate-or-opportunity?" question.
  - `DiscoveryGlimpse` renders `gaps` under the heading "**Opportunities**" with a `→` bullet (DiscoveryGlimpse.tsx:457-476) — every absence presented as a fillable opportunity.
  - `synthesis.ts:11` softens tone ("frame as 'what could amplify this' not 'what is wrong'") — but soft-assertion is still assertion, not a gap-vs-decision question.
  - **No concept of "business decision / won't-touch / referral model / record-and-stop-resurfacing"** exists (grep = zero). No restate→confirm/correct loop for gaps. No persistence of an owner's "that's deliberate" correction.

- **The flagship case would misfire:** for "trees but no planting," the current engine puts planting/installation into `gaps`/`suggestedOfferings`, and the UI shows it under "Opportunities" as an assertion — **exactly the naive behavior the banked principle warns against.** It would NOT ask, would NOT recognize the chosen model, would NOT offer to formalize the referral. The LAWNS fertilizer case (bundled into installation) would be surfaced as a missing standalone service — the same mistake the brief calls out by name.

- **The needed mechanic already exists next door — for identity only.** The engine HAS a silent-partner restate→confirm/correct loop: the entered-vs-site **discrepancy resolution** (compare.ts + DiscoveryGlimpse.tsx:386-434 — "A couple of things to confirm… Use site value / Keep mine", never asserting which value is right; resolveConflict at :180). But it is wired **only to identity facts** (name/address/phone/email via `WRITABLE_COLUMN`, DiscoveryGlimpse.tsx:10-15), **NOT to service gaps.** It is a ready-made model for the gap-vs-decision loop — currently unapplied to gaps.

---

## R4 — SCOPE SUMMARY + FIX OPTIONS

**Fraction realized:** the built engine is the **website-inspection slice** of a much larger design — roughly a third by surface. Built: URL → two-pass AI (Haiku identity + Sonnet analysis) → profile (found / strengths / gaps / suggested) → silent-partner email → (in onboarding) identity-conflict resolution + live-site catalog seed. Not built: pain-first voice conversation, listen/restate/iterate/confirm, pain-point library, three paths (library-match / hollow-shell / refusal), gap-vs-decision question loop, and durable session persistence (`business_discovery_profiles` is gated/mostly unbuilt).

**Is services-labeling the main defect? — NO.** Honesty-about-found-vs-suggested is *already mostly correct* (data model + both UIs distinguish; seed.ts is D-9 honest). The real defects, ranked:

1. **Gap-vs-decision not implemented** — the sharpest banked-intent-vs-code gap, and the one that *actively misfires today* on the flagship LAWNS planting/fertilizer example.
2. **Vertical config guessed/disconnected** (R2) — nursery.ts is roadmap-derived; the grower research measures a different dimension (catalog scrapability) and feeds a different path.
3. **The larger pain-first / three-paths / library design is net-new** — big build, arguably a roadmap item, not a "fix."

### Fix options (scoped, NOT decided — David's call)

- **Option A — implement gap-vs-decision (recommended shape).** Reframe the engine's gaps/suggestions prompt as *questions* ("you sell trees but don't offer planting — deliberate, or opportunity?"), relabel the UI "Opportunities" accordingly, and add the record-as-business-decision / stop-re-surfacing loop **by reusing the existing identity-conflict resolution mechanic** (extend it from identity fields to gaps; add rule (3), "offer to improve the chosen model"). *Why this shape:* it is the one design element that is (a) explicitly banked in the brief, (b) misfiring today, and (c) buildable **without** the full pain-first/voice rebuild because the confirm/correct mechanic already exists. **Size: medium-small.** Needs a persistence home for recorded decisions (interacts with the gated `business_discovery_profiles`).

- **Option B — ground the vertical knowledge.** Weaker ROI than the prompt assumed: the grower-scan research is catalog-scrapability, so it does *not* directly ground nursery.ts's pain points. The genuinely groundable target is the **catalog-populate path** (set honest expectations from the research: most growers are brochures with no scrapable catalog; some publish only on social/PDF). That is a *different* improvement than fixing nursery.ts. Grounding nursery.ts itself would require a new services-dimension pass over the growers (out of the current research's scope, and the CSVs are catalog rows, not offerings analysis).

- **Option C — label cleanup only.** Marginal — labeling is already largely honest. Small polish (seed confirmed `servicesFound` too; clarify "Opportunities" is not an assertion). Low value on its own; subsumed by A.

- **Option D — the full design.** pain-first conversation + voice + three paths + library. High value, large net-new build; a roadmap item, not a fix.

### One-line recommendation (David decides)

The services-labeling issue is *not* the main defect — it's largely handled. The highest-value, correctly-sized move is **Option A (gap-vs-decision)** — it closes the banked-principle gap that misfires on TRACE's own LAWNS example and rides an existing mechanic — paired with an honest note that `nursery.ts` is roadmap-derived, not research-grounded (R2), and that grower-scan grounding belongs to the *catalog* path as a separate improvement.

---

## APPENDIX — key evidence index (for fast re-verification)

- Pain-first design: `DISCOVERY_MODULE_BRIEF.md:42`; `THOUGHTS.md:257`. Built as optional text field: `engine.ts:96`, `DiscoveryInspect.tsx:87`, `synthesis.ts:31-37`.
- Three paths: `THOUGHTS.md:261-265`. Not built: grep `hollow`/`Not Yet Built`/`won't touch` in discovery code = 0.
- Found vs suggested (honest): `types.ts:26,30`; UI labels `DiscoveryInspect.tsx:319,333,347`; `DiscoveryGlimpse.tsx:442,463,485`; seed honesty `seed.ts:16-24,68-80`.
- v1 identity: `DiscoveryInspect.tsx` (whole) vs `THOUGHTS.md:257`.
- R2 chronology: `git log` — nursery.ts committed 2026-05-29; grower-scan report tracked 2026-07-06; report dated 2026-06-21.
- R2 no wiring: grep `grower-scan`/`archetype` in discovery code = 0; `typicalOfferings` (nursery.ts:33-42) read by nothing.
- R2 research dimension: `data/grower-scan/grower-scan-report.md` §1-2 (8/28 catalogs; 17/28 predictions wrong; bimodal web maturity).
- R3 banked principle: `DISCOVERY_MODULE_BRIEF.md:50-55`. Code asserts: `engine.ts:117,130`; `DiscoveryGlimpse.tsx:457-476`. Existing confirm/correct mechanic (identity only): `compare.ts` + `DiscoveryGlimpse.tsx:180,386-434,10-15`.

---

*Recon only. No code, schema, migration, or build produced. No built-inventory change (nothing built). READ-ONLY honored; grower-scan CSVs not read (gitignore respected). Repo is authority — every claim is `file:line`-backed.*
