/**
 * ── G10: the disclosure toggle LEADS, and the row is the click target · ledger #270 · 2026-09-03 ──
 *
 * David's ruling, minted as `ui-control-standards.md` §1 G10 BEFORE this code was written (R-74's
 * order: doc → widget → surfaces). Two halves, both previously unmet:
 *   ① the toggle was TRAILING — on a wide grid it sits past the horizontal fold, so the one control
 *     that reveals a row's detail was the one you had to scroll to find;
 *   ② the row was not a click target — a 15px chevron is a small thing to aim at.
 *
 * 🔴 WHY THIS FILE READS SOURCE TEXT RATHER THAN RENDERING. `DataSheet.tsx` is a `.tsx`, and a render
 * condition inside one is unreachable to this harness (tech-debt #134) — the same constraint that
 * made `receiptsList.test.ts` assert on the grid config as text. Reading the source is a weaker
 * instrument than rendering, and it is stated rather than hidden: these probes prove the CODE SAYS
 * the right thing, not that a browser DID the right thing. The browser half is owner-test CARD 19.
 *
 * The engine has 8 consumers, so every assertion here is a claim about all 8 at once.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planTracks, type TrackColumn } from './columnOrder';

const SRC = readFileSync(
  join(process.cwd(), 'packages/shared/src/components/datasheet/DataSheet.tsx'), 'utf8');

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push('  · ' + msg); console.error('   ✗ ' + msg); }
}

// ── ① THE TOGGLE LEADS ───────────────────────────────────────────────────────────────────────
//
// ✏️ FOUR OF THESE PROBES CHANGED INSTRUMENT ON 2026-09-07 (G11), AND IT IS AN UPGRADE, NOT A
// RELAXATION. They used to compare the character offsets of two JSX fragments in this file's
// source — the weaker instrument this header already apologises for — and G11 moved the pinned
// segment's arithmetic into `columnOrder.ts`, where it can be RUN. So G10a/b/e/f now assert the
// same facts by planning a real column set and reading the result, and G10c/d still read source
// because what they forbid is a fragment of markup, which is a text fact.
//
// ⚠️ The clause ids are UNCHANGED on purpose: `ui-standards.html` and the divergence declarations
// cite G10 by id, and renumbering to tidy a refactor breaks references to fix a preference.
const COLS: TrackColumn[] = [
  { key: 'flag', frozen: true, frozenWidth: 34 },
  { key: 'name', frozen: true, frozenWidth: 180, identifier: true },
  { key: 'data' },
];
const withToggle = planTracks(COLS, { expandWidth: 36, actionsWidth: 122 });

ok(withToggle.pinned[0].key === '__expand__',
  '🔴 G10a: the toggle leads the pinned segment — ahead of the frozen identifier run AND ahead of G11\'s actions track, not trailing');

ok(/\{plan\.pinned\.map\(t => pinnedHeader\(t\)\)\}/.test(SRC) && /\{plan\.pinned\.map\(t => pinnedCell\(/.test(SRC),
  'G10b: header and body render from THE SAME plan array, so they cannot disagree about the toggle\'s position — the old probe compared two independently-written fragments and could only notice a mismatch after someone edited one of them');

ok(!/\{renderExpand && <th style=\{S\.th\}><\/th>\}/.test(SRC),
  '🔴 G10c: the OLD TRAILING header cell is gone — leaving it would render an empty column at the far right AND throw the colSpan out');

// ── ② THE RESERVED TRACK (§6 r14 — the #104/#105 defect) ─────────────────────────────────────
ok(/const EXPAND_TRACK_W = \d+;/.test(SRC),
  'G10d: the toggle track has a FIXED width constant — a pinned column without a deterministic width is exactly what let scrolling columns pass underneath at #104/#105');
ok(withToggle.pinned[0].left === 0 && withToggle.pinned[1].left === 36,
  '🔴 G10e: the toggle takes track 0 and every downstream left offset shifts by exactly one track — the offsets still accumulate exactly (§6 r14)');
ok(!planTracks(COLS, { actionsWidth: 122 }).pinned.some(t => t.kind === 'expand'),
  'G10f: the toggle exists ONLY when the grid has an expansion — a grid with nothing to disclose gets no gutter and no mystery click target');

// ── ③ THE ROW IS THE CLICK TARGET, AND THE GUARD IS THE LOAD-BEARING PART ────────────────────
ok(/onClick=\{renderExpand \?/.test(SRC),
  '🔴 G10g: the row handler is attached ONLY when renderExpand is present — a grid with nothing to disclose must not acquire a mystery click target (clause exclusion ①)');

const guard = /closest\('input,button,a,select,label,textarea,\[role="button"\]'\)/.test(SRC);
ok(guard,
  '🔴 G10h: a click that STARTED in an interactive control is ignored. Without this the row swallows inline edit (G8) on the six editable consumers and every in-cell link — clause exclusion ②, and the defect that would have shipped silently because a grid still LOOKS right while its inputs stop taking focus');

ok(/ev\.stopPropagation\(\)/.test(SRC),
  'G10i: the toggle button stops propagation — otherwise clicking the control fires the row handler too and the drawer opens and closes in one click');

ok(/aria-expanded=\{isOpen\}/.test(SRC),
  'G10j: the toggle reports its state to assistive tech — a disclosure that does not say whether it is open is a control with no readable state');

// ── ④ A–Z SECTIONS INSIDE ONE SCROLL, AND AN INDEX THAT JUMPS (ledger #378) ─────────────────
// David, 2026-09-22: the list is GROUPED like a contacts app — section headings within one
// scroll, and a letter index that jumps to them. Same instrument and same caveat as above: this
// proves the CODE SAYS it, not that a browser did it. The browser half is the owner-test card.

ok(/const grouped = !!sectionIndex && sortKey === sectionIndex\.sortKey && sortDir === 'asc';/.test(SRC),
  '🔴 AZ1: HEADINGS ONLY EXIST WHILE THE GRID IS SORTED THE WAY THEY GROUP. A section heading asserts that everything beneath it belongs to that letter (§6 r18); sort by Added and every heading becomes a false claim, so they are withdrawn instead');

ok(/sectionIndex!\.keyOf\(view\[i - 1\]\) !== sectionKey/.test(SRC),
  '🔴 AZ2: a heading is emitted where the section CHANGES BETWEEN CONSECUTIVE ROWS — derived from the order actually on screen, so a heading can never disagree with the rows under it. A second grouping pass could');

ok(/filtered: status !== 'all' \|\| extra !== 'all' \|\| !!search/.test(SRC),
  "🔴 AZ3: THE COUNT PILL COUNTS EVERY DIMENSION THAT NARROWS THE VIEW, AND `extra` WAS MISSING. Picking a value in the second dropdown alone made the header read `12 of 647 items` — the POPULATION sentence — while a filter was active. Live on /inventory today, found building this and fixed in passing (§1.6 fix-all-in-one-pass)");

ok(!/indexKey !== 'all'/.test(SRC),
  '🔴 AZ4: THE LETTER INDEX IS NOT IN THE FILTERED FLAG, because it JUMPS rather than filters — every row is still shown, and the pill must not claim a narrowed list. This probe fails the moment somebody turns the index back into a filter without revisiting the claim');

// ✏️ The shape changed when the view became optionally CONTROLLED by the page (ledger #385):
// setting two fields now has to be ONE emit, or the second overwrites the first. The probe
// asserts the BEHAVIOUR — the grouping sort is restored — rather than the exact statement, which
// is what made it brittle here. Both branches are named so neither can quietly disappear.
ok(/if \(!grouped\) \{/.test(SRC)
   && /emit\(\{ sort: sectionIndex\.sortKey, dir: 'asc' \}\)/.test(SRC)
   && /setSortKeyOwn\(sectionIndex\.sortKey\); setSortDirOwn\('asc'\)/.test(SRC),
  'AZ5: pressing a letter under another sort RESTORES the grouping sort first — in BOTH modes (one emit when the page owns the view, local state when the grid does), so the index never silently does nothing');

ok(/sorted another way — a letter returns to A–Z order/.test(SRC),
  'AZ6: …and the strip SAYS SO BEFORE the press, so the grid restoring the sort does not look like it undoing the reader’s choice by itself');

ok(/const stick = headRowRef\.current\?\.getBoundingClientRect\(\)\.height \?\? 0;/.test(SRC),
  '🔴 AZ7: the jump offset is MEASURED from the sticky header, not assumed from a row height — the header’s height is whatever the consumer’s columns make it, and a guessed offset hides the heading you jumped to underneath it');

ok(/for \(const r of view\)/.test(SRC) && /sectionCounts/.test(SRC),
  '🔴 AZ8: the per-letter counts are over `view` — the rows a reader can actually reach. A jump can only land on a heading that is RENDERED, so a letter whose rows the search has hidden must read 0 and refuse the press');

ok(/disabled=\{empty\}/.test(SRC),
  'AZ9: a letter with nobody under it is disabled, not hidden and not live (§1.6 item 5, no dead affordance)');

ok(SRC.includes('{sectionIndex && ('),
  '🔴 AZ10: NEGATIVE CONTROL — the strip renders ONLY for a consumer that passes `sectionIndex`. The engine has 8 consumers; /inventory, /assets and five more must look exactly as they did, or this build changed seven screens nobody asked it to touch');

ok(/const sectionKey = grouped && sectionIndex \? sectionIndex\.keyOf\(row\) : null;/.test(SRC),
  'AZ11: …and the heading row itself is gated on the same flag, so an opted-out grid cannot grow one');

console.log(`\ndataSheetDisclosure: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
