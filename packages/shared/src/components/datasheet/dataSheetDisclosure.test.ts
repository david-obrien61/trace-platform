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

// ── ④ THE A–Z STRIP, AND THE COUNT CLAIM IT MUST NOT BREAK (ledger #378) ────────────────────
// Same instrument and same caveat as above: this proves the CODE SAYS it, not that a browser did.
// The browser half is the owner-test card.

ok(/indexFilter && indexKey !== 'all'/.test(SRC),
  'AZ1: the letter narrows the view, AND-ed with the other dimensions rather than replacing them');

ok(/filtered: status !== 'all' \|\| extra !== 'all' \|\| indexKey !== 'all' \|\| !!search/.test(SRC),
  '🔴 AZ2: THE COUNT PILL COUNTS EVERY DIMENSION THAT NARROWS THE VIEW. With a letter picked and this flag false, the header renders the POPULATION sentence ("77 of 2005 customers") while a filter is active — §6 r18, and the same class as the `1000 of 1000` the pill exists to prevent. It also fixes `extra`, which was missing here and is live on /inventory today.');

ok(/indexCounts = useMemo\(/.test(SRC) && /for \(const r of rows\)/.test(SRC),
  '🔴 AZ3: the per-letter counts are computed over `rows` — the whole set the grid holds — NOT over `view`. Counting the filtered view makes every OTHER letter read 0 the moment you pick one, which is the flag-banner defect (flagCounts) in a new control');

ok(/disabled=\{empty\}/.test(SRC),
  '🔴 AZ4: a letter with nobody under it is DISABLED, not hidden and not live — hiding it makes a complete alphabet look like it has gaps, and leaving it live is a control that does nothing when pressed (§1.6 item 5)');

ok(/onClick=\{\(\) => setIndexKey\(indexKey === k \? 'all' : k\)\}/.test(SRC),
  'AZ5: pressing the active letter again clears it — the strip has a way back to everyone that is not "find the All button"');

ok(/aria-pressed=\{indexKey === k\}/.test(SRC),
  'AZ6: each letter reports whether it is the active one — a filter with no readable state is the disclosure defect (G10j) in a second control');

ok(SRC.includes('{indexFilter && ('),
  '🔴 AZ7: NEGATIVE CONTROL — the strip renders ONLY for a consumer that asked for one. The engine has 8 consumers; /inventory and /assets must look exactly as they did, or this build changed six screens nobody asked it to touch');

console.log(`\ndataSheetDisclosure: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
