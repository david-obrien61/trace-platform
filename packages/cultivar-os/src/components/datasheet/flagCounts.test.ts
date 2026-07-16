/**
 * ── flagCounts — the flag banner describes the rows ON SCREEN · ledger #135 · 2026-07-16 ──
 *
 * Reproduces the LIVE failure David hit on 2026-07-16. He filtered /inventory to "alley" — 4 of 123
 * rows shown, sizes 15/30/45/60, all distinct, all grouped, ZERO collisions — and the banner read:
 *
 *   "2 size collisions — two rows share a variant group and size, so the scanner can't tell them
 *    apart. Edit the size or variant group on a flagged row to fix it."
 *
 * That was ACOMA's collision, elsewhere in the catalog, rendered over four clean rows. The trace
 * agreed there was exactly one collision and that it was not the one on screen:
 *   [TRACE:invsheet] dup-size flags {groups: 1}
 *
 * A red banner naming a defect that is not in what the owner is LOOKING AT is D-9 inverted: it does
 * not fabricate a value, it mis-attributes a real one. Worse, it told him to "edit a flagged row"
 * when no row on screen was flagged — an instruction that cannot be followed.
 *
 * FOLD-IN, same defect: the copy said "2 size collisions" while the trace said `collisions: Array(1)`.
 * It is ONE collision involving TWO rows. The copy counted rows and the prose said collisions. A
 * number that disagrees with its own trace is how the NEXT session misdiagnoses this.
 *
 * Run (pure TS, no React imported — esbuild → node):
 *   node_modules/.bin/esbuild packages/cultivar-os/src/components/datasheet/flagCounts.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { partitionFlagged } from './flagCounts';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

interface R { id: string; name: string; dup: boolean }
const r = (id: string, name: string, dup = false): R => ({ id, name, dup });
const isFlagged = (x: R) => x.dup;
const byId = (x: R) => x.id;

// The live catalog, reduced to the fact: four clean Alley Cat rows + the two colliding Acoma rows.
const ALL: R[] = [
  r('alley-15', 'Alley Cat Redbud Espalier'),
  r('alley-30', 'Alley Cat Redbud Espalier'),
  r('alley-45', 'Alley Cat Redbud Espalier'),
  r('alley-60', 'Alley Cat Redbud Espalier'),
  r('acoma-1002', 'Acoma Crape Myrtle', true),
  r('acoma-15g',  'Acoma Crape Myrtle', true),
];
const filter = (q: string) => ALL.filter(x => x.name.toLowerCase().includes(q));

// ══ THE LIVE DEFECT — filtered to "alley", 4 clean rows ══════════════════════
{
  const view = filter('alley');
  const p = partitionFlagged(ALL, view, isFlagged, byId);
  ok(view.length === 4, 'setup: the "alley" filter shows 4 rows (matches the live screen)');
  ok(p.inView === 0, 'filtered to a CLEAN variety → ZERO flagged rows in view — no banner claims a defect here (the live defect)');
  ok(p.elsewhere === 2, 'the 2 real flagged rows are reported as ELSEWHERE — surfaced honestly, never implied to be here');
}

// ══ FILTERED TO THE ACTUAL COLLISION ═════════════════════════════════════════
{
  const view = filter('acoma');
  const p = partitionFlagged(ALL, view, isFlagged, byId);
  ok(p.inView === 2, 'filtered to Acoma → the banner fires and counts the 2 rows that ARE on screen');
  ok(p.elsewhere === 0, 'nothing left elsewhere — the whole collision is in view');
}

// ══ UNFILTERED — the baseline the old rule got right by accident ═════════════
{
  const p = partitionFlagged(ALL, ALL, isFlagged, byId);
  ok(p.inView === 2 && p.elsewhere === 0, 'unfiltered: all flagged rows are in view (this case always worked — which is why it hid)');
}

// ══ SPLIT — half the collision filtered out ══════════════════════════════════
// The honest hard case: the owner sees ONE flagged row and its twin is hidden. The banner must not
// pretend the pair is on screen, and must not pretend there is nothing left to find.
{
  const view = ALL.filter(x => x.id !== 'acoma-15g');
  const p = partitionFlagged(ALL, view, isFlagged, byId);
  ok(p.inView === 1, 'split: one flagged row visible');
  ok(p.elsewhere === 1, 'split: its twin is hidden — reported as elsewhere, not silently dropped and not double-counted');
}

// ══ THE FLAG ITSELF IS A CATALOG FACT, NOT A VIEW FACT ═══════════════════════
// A row must not stop being flagged because its twin scrolled out of view — only the COUNT is
// view-scoped. Proven by the split case above: acoma-1002 stays flagged with its twin filtered out.
ok(partitionFlagged(ALL, ALL.filter(x => x.id === 'acoma-1002'), isFlagged, byId).inView === 1,
   'a flagged row stays flagged when viewed alone — the collision is a fact about the catalog, not the filter');

// ══ EDGES ════════════════════════════════════════════════════════════════════
ok(partitionFlagged([], [], isFlagged, byId).inView === 0, 'empty catalog → no banner');
{
  const clean = ALL.filter(x => !x.dup);
  const p = partitionFlagged(clean, clean, isFlagged, byId);
  ok(p.inView === 0 && p.elsewhere === 0, 'a catalog with no collisions → no banner anywhere');
}
{
  const p = partitionFlagged(ALL, [], isFlagged, byId);
  ok(p.inView === 0 && p.elsewhere === 2, 'a filter that shows nothing → nothing is "here"; the 2 are all elsewhere');
}

console.log(`\nflagCounts: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
