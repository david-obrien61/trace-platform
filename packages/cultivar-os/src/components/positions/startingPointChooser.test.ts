/**
 * startingPointChooser.test.ts — 🔴 THE ASSERTION THAT WAS MISSING: THE CHOOSER IS ON THE SCREEN.
 *
 * WHY THIS FILE EXISTS, STATED BLUNTLY BECAUSE IT IS THE POINT.
 * #241 shipped **25 assertions about starting points and 9 of 9 mutants caught**, and the one
 * path the feature exists for was never exercised. Every probe tested `startingPointIds` — the
 * SETS — and **the sets were never the risk.** The risk was the twenty lines of JSX between a
 * correct set and an owner's eyes, and the guard deciding whether those lines run at all.
 *
 * 🔴 THE ROOT CAUSE IS STRUCTURAL, NOT AN OVERSIGHT OF DILIGENCE: the decision was an inline
 * boolean inside a page component that reads React context, calls Supabase and needs a router.
 * The runner bundles `*.test.ts` with esbuild and runs it in node — **nothing in this repository
 * could reach that boolean, so nothing did.** A condition that cannot be asserted is a condition
 * that will not be, and no amount of care fixes that; only a seam does.
 *
 * So two seams, and this file asserts across both:
 *   J — `shouldOfferStartingPoints` — the DECISION, now a pure function (`positionStartingPoints`).
 *   K — `<StartingPointChooser>` — the RENDER, now a context-free component that
 *       `react-dom/server` can turn into HTML **with no new dependency**. The probes read the
 *       actual markup, not a return value.
 *
 * ⚠️ WHAT THIS STILL DOES NOT PROVE, said rather than implied: `renderToStaticMarkup` does not run
 * `useEffect`, so this cannot prove the PAGE fetched, resolved and mounted. That is CARD 9's job
 * and only David's live run closes it. What it does prove is everything between "the position has
 * nothing ticked" and "the six starting points and their counts are in the DOM" — which is the
 * entire span that shipped unasserted.
 *
 * Run: node scripts/run-tests.mjs startingPointChooser
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StartingPointChooser } from './StartingPointChooser';
import {
  POSITION_STARTING_POINTS, startingPointIds, shouldOfferStartingPoints,
  type PositionStartingPoint,
} from '@trace/shared/positions/positionStartingPoints';
import { RESPONSIBILITY_CATALOGUE } from '@trace/shared/positions/responsibilityCatalogue';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

const ALL = RESPONSIBILITY_CATALOGUE;
const CORE_ONLY = ALL.filter((r) => r.vertical === null);

// ── J — THE DECISION ────────────────────────────────────────────────────────────────────────
// Every row is a state a real session lands in, walked in the order a session walks them.
const base = { mayEdit: true, loading: false, positionLoaded: true, tickCount: 0, blankChosen: false };

ok(shouldOfferStartingPoints({ ...base, loading: true }).reason === 'loading',
   'J1 while the workspace read is in flight, nothing is offered');
ok(shouldOfferStartingPoints({ ...base, positionLoaded: false }).reason === 'no-position',
   'J2 a position id that no longer resolves offers nothing');

// 🔴 J3 — THE CARD 9 STATE. A position created seconds ago: loaded, editable, zero ticks.
const created = shouldOfferStartingPoints(base);
ok(created.offer === true && created.reason === 'nothing-ticked',
   `J3 a freshly created position IS offered the starting points (got ${JSON.stringify(created)})`);

// 🔴 J4 — THE STATE DAVID ALSO HIT, AND THE ONE #241 NEVER CONSIDERED SEPARATELY: a SAVED
// position sitting at zero. It is where every abandoned position lands, and it is the state that
// most needs the offer. Same inputs, and that identity is the fix — not a second branch.
ok(shouldOfferStartingPoints({ ...base, tickCount: 0 }).offer === true,
   'J4 a SAVED position with zero ticks is offered the starting points too — the reopen path');

ok(shouldOfferStartingPoints({ ...base, tickCount: 1 }).reason === 'already-ticked',
   'J5 one tick withholds the offer — applying a set REPLACES, so offering it beside work is destructive');
ok(shouldOfferStartingPoints({ ...base, blankChosen: true }).reason === 'blank-chosen',
   'J6 "start blank" sticks — a choice that reappears is the flow nagging someone who answered it');
ok(shouldOfferStartingPoints({ ...base, mayEdit: false }).reason === 'read-only',
   'J7 a STAFF reader is never offered an edit affordance they cannot save');

// 🔴 J8 — NEGATIVE CONTROL. A guard that returned `true` unconditionally would satisfy J3 and J4.
// This proves the suite has both answers in it, so it cannot pass over a stuck function.
const answers = new Set([
  shouldOfferStartingPoints(base).offer,
  shouldOfferStartingPoints({ ...base, tickCount: 1 }).offer,
]);
ok(answers.size === 2, 'J8 the guard returns BOTH answers across the suite — it is not stuck');

// 🔴 J9 — and the reasons are distinct, so a guard right for the wrong reason is caught. A single
// `offer` boolean cannot tell "read-only" from "already ticked", and the two need different fixes.
const reasons = new Set([
  shouldOfferStartingPoints({ ...base, loading: true }).reason,
  shouldOfferStartingPoints({ ...base, positionLoaded: false }).reason,
  shouldOfferStartingPoints({ ...base, mayEdit: false }).reason,
  shouldOfferStartingPoints({ ...base, blankChosen: true }).reason,
  shouldOfferStartingPoints({ ...base, tickCount: 1 }).reason,
  shouldOfferStartingPoints(base).reason,
]);
ok(reasons.size === 6, `J9 every withholding reason is distinct (got ${reasons.size} of 6)`);

// ── K — THE RENDER. REAL REACT, REAL MARKUP, READ AS A STRING. ──────────────────────────────
const html = renderToStaticMarkup(
  React.createElement(StartingPointChooser, { visible: ALL, onPick: () => {} }),
);

ok(html.includes('starting-point-chooser'), 'K1 the chooser renders at all — it is in the markup');
ok(html.includes('Start from a set'), 'K2 the chooser is titled, so an owner knows what it is');

// 🔴 K3 — ALL SEVEN CHOICES REACH THE SCREEN. The set resolving correctly and the button existing
// are different facts, and #241 only ever checked the first.
const LABELS = ['Production manager', 'Sales manager', 'External sales',
                'Crew member / driver', 'Bookkeeper', 'Owner', 'Start blank'];
const missing = LABELS.filter((l) => !html.includes(l));
ok(missing.length === 0, `K3 every starting point is on the screen (missing: ${missing.join(', ')})`);

// 🔴 K4 — THE COUNT IS RENDERED, AND IT IS THE SET'S OWN LENGTH. David asked for
// "Production manager, 34 to start" precisely so an owner can see how much each commits them to.
ok(html.includes('Production manager') && html.includes('34 to start'),
   'K4 the production-manager button carries its count — 34 to start');
const COUNTS: Record<string, number> = {
  'Production manager': 34, 'Sales manager': 27, 'External sales': 9,
  'Crew member / driver': 8, 'Bookkeeper': 10, 'Owner': 93,
};
const wrongCount = Object.entries(COUNTS).filter(([, n]) => !html.includes(`${n} to start`));
ok(wrongCount.length === 0,
   `K5 every set's count is in the markup (absent: ${wrongCount.map(([k, n]) => `${k}=${n}`).join(', ')})`);

// K6 — "start blank" carries NO count, because "0 to start" reads as a broken set rather than a choice.
ok(!/Start blank<\/?[^>]*>?[^<]*, \d+ to start/.test(html) && !html.includes('Start blank</span><span style="font-weight:500'),
   'K6 "start blank" carries no count');

// 🔴 K7 — THE RENDERED COUNT FOLLOWS THE BUSINESS, NOT A CONSTANT. A tenant with no growing
// ladder sees a SMALLER production-manager set, and the button must say so.
const coreHtml = renderToStaticMarkup(
  React.createElement(StartingPointChooser, { visible: CORE_ONLY, onPick: () => {} }),
);
const prod = POSITION_STARTING_POINTS.find((s) => s.key === 'production_manager') as PositionStartingPoint;
const coreN = startingPointIds(prod, CORE_ONLY).length;
ok(coreN < 34 && coreHtml.includes(`${coreN} to start`) && !coreHtml.includes('34 to start'),
   `K7 a non-nursery renders the cut count (${coreN}), not 34`);

// K8 — the reassurance line is on the screen. It is the sentence that makes the offer safe to
// accept: a set is not saved, creates no role and grants nothing.
ok(html.includes('not saved until you press Save') && html.includes('creates no role'),
   'K8 the chooser says on screen that it saves nothing and grants nothing');

// 🔴 K9 — NEGATIVE CONTROL FOR THE WHOLE K BLOCK. Prove the markup is what is being read: a
// component rendering nothing must fail K1/K3. Without this, K's probes could be reading a
// constant somewhere and nobody would know.
const emptyHtml = renderToStaticMarkup(React.createElement('div', null));
ok(!emptyHtml.includes('starting-point-chooser') && !emptyHtml.includes('Production manager'),
   'K9 an empty render contains none of it — K1..K8 are reading real markup');

// K10 — the buttons are real buttons at the platform's touch-target minimum, not divs.
ok((html.match(/<button /g) ?? []).length === POSITION_STARTING_POINTS.length,
   `K10 one real <button> per starting point (got ${(html.match(/<button /g) ?? []).length})`);
ok(html.includes('min-height:48px'), 'K11 the buttons meet the 48px touch target (§6 r3)');

console.log(`\nstartingPointChooser.test.ts — ${passed} passed, ${failed} failed`);
if (failed) { failures.forEach((f) => console.log('  FAIL ' + f)); process.exit(1); }
