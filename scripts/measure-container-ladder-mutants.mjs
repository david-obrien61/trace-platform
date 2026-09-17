/**
 * ── measure-container-ladder-mutants — can a plan land on a pot that does not exist? ───────────
 *
 * PURPOSE:      Every mutant here either snaps an off-ladder size onto the nearest rung, collapses
 *               a range that spans two rungs, offers a retired rung, or breaks the one-rung
 *               grouping that makes "#3" and "5 gal" the same bucket. The five that matter most:
 *                 · R3 makes an off-ladder size resolve to SOMETHING. That is the 47-gallon defect
 *                   restored: a plan lands on a container nobody sells and costs mix, pots and
 *                   hours against it. 21 rows of `7 gal` are live at LAWNS today.
 *                 · R5 lets a RANGE collapse onto one end, so `10/15 gallon` silently becomes 15 —
 *                   the exact laundering `unitOfMeasure`'s own header refuses to reproduce.
 *                 · D1 offers a RETIRED rung, which is the half of R-133 that is easy to lose:
 *                   resolving and offering are different questions and only one filters.
 *                 · K2 stops the 3/5 rung claiming both ends, so Terry's one bucket splits in two
 *                   and the uppot split under-counts the rung.
 *                 · V2 lets two rungs claim one number silently, so which rung a lot lands on
 *                   becomes an accident of row order.
 *
 * 🔴 THREE VERDICTS, NOT TWO — AND THAT IS DELIBERATELY DIFFERENT FROM THE OTHER 18 HARNESSES.
 *    Tech-debt #293: with `pipefail` on, a mutant that DOES NOT COMPILE scores CAUGHT, because the
 *    pipeline fails at esbuild and the harness cannot tell that from a test that refused. Both are
 *    honestly "not survived", but CAUGHT asserts something the run never measured. Here the build
 *    and the run are SEPARATE steps, so a mutant that cannot compile reports NO-BUILD and is an
 *    ERROR, not a pass. ⚠️ This is the shape #293 asks for; it is implemented HERE ONLY rather than
 *    grown as a 19th copy — the shared helper the other 18 should adopt is still owed (§6 r8).
 *
 * 🔴 GREEN CONTROL FIRST, AND A MUTANT THAT NEVER APPLIED IS AN ERROR, NOT A PASS. A mutant that
 *    cannot reach its target has proven nothing (tech-debt #182 / #186 · R-33 · §6 r19).
 *
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT / SURVIVED / NO-BUILD per mutant + summary. Exit 1 unless all are CAUGHT.
 *
 * Run: node scripts/measure-container-ladder-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

const LADDER = ROOT + 'packages/shared/src/inventory/containerLadder.ts';
const MATH   = ROOT + 'packages/shared/src/production/productionMath.ts';

const SUITES = [
  'packages/shared/src/inventory/containerLadder.test.ts',
  'packages/shared/src/production/productionPlan.test.ts',
];

/** Build ONE suite. Returns null on success, or the compiler's own message. */
function build(suite) {
  try {
    return { ok: true, js: execSync(`${ESB} ${suite} --bundle --platform=node --format=cjs --log-level=error`,
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).toString() };
  } catch (e) {
    return { ok: false, err: String(e.stderr ?? e.message).slice(0, 300) };
  }
}

/** Run the built JS. Returns true when the suite PASSES. */
function run(js) {
  try {
    execSync('node', { cwd: ROOT, input: js, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    return true;
  } catch { return false; }
}

/** 'green' | 'red' | 'no-build' — the three states, kept apart. */
function suiteState() {
  for (const s of SUITES) {
    const b = build(s);
    if (!b.ok) return { state: 'no-build', detail: b.err };
    if (!run(b.js)) return { state: 'red' };
  }
  return { state: 'green' };
}

const MUTANTS = [
  // ── RESOLUTION: which rung is this size on ───────────────────────────────────────────────
  { id: 'R1', file: LADDER, why: '🔴 the ALIAS pass goes — "slip", "4\\"" and "95/100" stop resolving, i.e. three of David\'s nine rungs become unreachable',
    from: '  for (const rung of ladder) {\n    for (const a of rung.aliases) if (foldLabel(a) === folded) return { ok: true, rung, how: \'alias\' };\n  }',
    to:   '' },
  { id: 'R2', file: LADDER, why: '🔴 the LABEL pass goes, so a rung cannot be found by its own name',
    from: "  for (const rung of ladder) if (foldLabel(rung.label) === folded) return { ok: true, rung, how: 'label' };",
    to:   '' },
  { id: 'R3', file: LADDER, why: '🔴 THE 47-GALLON DEFECT RESTORED — an off-ladder size resolves to the first rung instead of refusing, so a plan lands on a container nobody sells',
    from: "  return {\n    ok: false,\n    reason: 'off_ladder',",
    to:   "  if (ladder.length > 0) return { ok: true, rung: ladder[0], how: 'number' };\n  return {\n    ok: false,\n    reason: 'off_ladder'," },
  { id: 'R4', file: LADDER, why: '🔴 BLANK and OFF-LADDER collapse into one answer — "no size recorded" and "a size that is not yours" are different questions with different fixes',
    from: "    return { ok: false, reason: 'blank', detail: 'No size recorded, so there is no rung to place it on.' };",
    to:   "    return { ok: false, reason: 'off_ladder', detail: 'No size recorded, so there is no rung to place it on.' };" },
  { id: 'R5', file: LADDER, why: '🔴 A RANGE COLLAPSES ONTO ONE END — "10/15 gallon" silently becomes the 15 rung, the exact laundering unitOfMeasure refuses to reproduce (tech-debt #125)',
    from: '      if (p.valueMax != null && p.valueMax !== p.value) {\n        if (keys.includes(p.value) && keys.includes(p.valueMax)) return { ok: true, rung, how: \'number\' };\n      } else if (keys.includes(p.value)) {',
    to:   '      if (false) {\n      } else if (keys.includes(p.value) || (p.valueMax != null && keys.includes(p.valueMax))) {' },
  // ✏️ R6 RE-AIMED 2026-09-16 (ledger #343): the kind check moved into the new `not_container`
  // refusal, so the mutant now removes THAT — a bag falls through to the numeric match again.
  { id: 'R6', file: LADDER, why: 'a NON-container parse reaches the numeric match, so a 15 lb bag lands on the 15 gallon rung (R-99)',
    from: "  if (p.kind !== 'container') {",
    to:   '  if (false) {' },
  { id: 'J1', file: LADDER, why: '🔴 UNREADABLE collapses into OFF-LADDER — a scribble is reported as "a size you have not set up", sending somebody to add a size that does not exist (ledger #343)',
    from: "      reason: 'unreadable',",
    to:   "      reason: 'off_ladder'," },
  { id: 'J2', file: LADDER, why: '🔴 a bag is reported as OFF-LADDER instead of NOT A CONTAINER — the load list would count fertiliser as an unstaked tree',
    from: "      reason: 'not_container',",
    to:   "      reason: 'off_ladder'," },

  // ── THE DERIVED KEYS ─────────────────────────────────────────────────────────────────────
  { id: 'K1', file: LADDER, why: '🔴 the keys stop being DERIVED and only the label counts — "15" and "#15" stop resolving, and every tenant must hand-declare every spelling',
    from: '  for (const label of [rung.label, ...rung.aliases]) {',
    to:   '  for (const label of [rung.label]) {' },
  { id: 'K2', file: LADDER, why: '🔴 THE 3/5 RUNG STOPS CLAIMING BOTH ENDS — Terry\'s one bucket splits in two and the uppot split under-counts the rung',
    from: '    if (p.valueMax != null && Number.isFinite(p.valueMax)) keys.add(p.valueMax);',
    to:   '' },
  { id: 'K3', file: LADDER, why: 'a non-container label contributes a key, so a 4" rung would claim the number 4 and match "4 gal"',
    from: "    if (!p || p.kind !== 'container') continue;",
    to:   '    if (!p) continue;' },

  // ── RETIRE, NEVER DELETE ─────────────────────────────────────────────────────────────────
  { id: 'D1', file: LADDER, why: '🔴 A RETIRED RUNG IS OFFERED — R-133\'s easy half to lose: resolving and offering are different questions and only one filters',
    from: '  return ladder\n    .filter((r) => r.active && r.sortOrder > rung.sortOrder)',
    to:   '  return ladder\n    .filter((r) => r.sortOrder > rung.sortOrder)' },
  { id: 'D2', file: LADDER, why: '🔴 a retired rung stops RESOLVING — every past lot and past order pointing at it becomes unreadable, which is deletion by another name',
    from: '  for (const rung of ladder) if (foldLabel(rung.label) === folded) return { ok: true, rung, how: \'label\' };',
    to:   '  for (const rung of ladder) if (rung.active && foldLabel(rung.label) === folded) return { ok: true, rung, how: \'label\' };' },
  { id: 'D3', file: LADDER, why: 'the offer list includes the rung the lot is already on — "uppot a 15 to a 15" becomes offerable',
    from: '    .filter((r) => r.active && r.sortOrder > rung.sortOrder)',
    to:   '    .filter((r) => r.active && r.sortOrder >= rung.sortOrder)' },
  { id: 'D4', file: LADDER, why: 'the offer list is UNORDERED, so "the next rung up" becomes whichever row came back first',
    from: '    .sort((a, b) => a.sortOrder - b.sortOrder);',
    to:   '    .sort(() => 0);' },

  // ── A COLLIDING LADDER ───────────────────────────────────────────────────────────────────
  { id: 'V1', file: LADDER, why: '🔴 a duplicate LABEL is not reported',
    from: "    if (labels.length > 1) out.push({ kind: 'duplicate_label',",
    to:   "    if (false) out.push({ kind: 'duplicate_label'," },
  { id: 'V2', file: LADDER, why: '🔴 TWO RUNGS CLAIM ONE NUMBER SILENTLY — which rung a lot lands on becomes an accident of row order, the order-dependent wrong answer this module exists to remove',
    from: '    if (labels.length > 1) {\n      out.push({ kind: \'duplicate_number\',',
    to:   '    if (false) {\n      out.push({ kind: \'duplicate_number\',' },
  { id: 'V3', file: LADDER, why: 'two rungs at one sort position are not reported, so "next rung up" is undefined between them and nothing says so',
    from: "    if (labels.length > 1) out.push({ kind: 'duplicate_sort',",
    to:   "    if (false) out.push({ kind: 'duplicate_sort'," },

  // ── THE MINUTES CARRY THEIR BASIS ────────────────────────────────────────────────────────
  { id: 'M1', file: LADDER, why: '🔴 an UNTIMED rung\'s fallback stops announcing itself — the global rate renders exactly like a figure somebody measured at this rung',
    from: '        `nobody has timed "${rung.label}" specifically, so the global rate stands in for it`,',
    to:   "        'estimated',"},
  { id: 'M2', file: LADDER, why: 'a rung with no figure reports ZERO minutes rather than falling back — a 200-gallon pot costs no labour',
    from: '  return rung.handlingMinutes == null',
    to:   '  return false' },

  // ── LEDGER #343: SAME SIZE ON THE LADDER · THE COPY SOURCE · COVERAGE · THE ROW MAPPING ──
  { id: 'S1', file: LADDER, why: '🔴 the ladder stops deciding "the same size" — "#3" and "5 gal" become two sizes and the count screen mints a second row for one bucket',
    from: '  if (ladder && ladder.length > 0) {\n    const ra = resolveRung(ladder, a);',
    to:   '  if (false) {\n    const ra = resolveRung(ladder!, a);' },
  { id: 'L1', file: LADDER, why: '🔴 a new size copies its posts from the SMALLEST rung instead of the largest — a new big size is born with a slip\'s 0 posts',
    from: '  return offered.length ? offered[offered.length - 1] : null;',
    to:   '  return offered.length ? offered[0] : null;' },
  { id: 'L2', file: LADDER, why: '🔴 retired rungs are OFFERED again — and one can become the copy source for a new size',
    from: '  return ladder.filter((r) => r.active).sort((a, b) => a.sortOrder - b.sortOrder);',
    to:   '  return [...ladder].sort((a, b) => a.sortOrder - b.sortOrder);' },
  { id: 'CV1', file: LADDER, why: '🔴🔴 off-ladder sizes are NAMED but not COUNTED — the preview says "7 gal" with a count of 0',
    from: '      e.count++;',
    to:   '' },
  { id: 'CV2', file: LADDER, why: 'two spellings of one off-ladder size are reported as two findings',
    from: '      const k = normalizeSize(size).toLowerCase();',
    to:   '      const k = String(size);' },
  { id: 'RM1', file: LADDER, why: '🔴 a row without the posts column reads 2 instead of the database default 0 — a number nobody entered',
    from: '    installTPostsPerTree: numOrNull(r.install_t_posts_per_tree) ?? 0,',
    to:   '    installTPostsPerTree: numOrNull(r.install_t_posts_per_tree) ?? 2,' },
  { id: 'SG1', file: MATH, why: '🔴🔴 THE UPPOT START IS READ OUT OF THE SIZE TEXT AGAIN — a "3/5 Gallon" lot starts at 3, not the rung\'s 4',
    from: '    if (r.ok) return r.rung.volumeGallons ?? 0;',
    to:   '    if (r.ok) return lot.unitValue ?? 0;' },
  { id: 'SG2', file: MATH, why: '🔴 the plan RECORDS the rung start but COSTS the mix from the text — two numbers for one move',
    from: '    const mixPerPot = mixCubicYardsPerPot(from, target, ops);',
    to:   '    const mixPerPot = mixCubicYardsPerPot(lot.unitValue ?? 0, target, ops);' },

  // ── THE REFUSAL REASONS ON THE PLAN ──────────────────────────────────────────────────────
  { id: 'C1', file: MATH, why: '🔴 ZERO ON HAND IS NO LONGER THE REASON GIVEN — 97 of Test Dave\'s 99 catalogue rows go back to being told their SIZE is unreadable, sending somebody to fix a size that would change nothing (David, 2026-09-14)',
    from: "  if (lot.qty === 0) {\n    return { ok: false, reason: 'no_stock',",
    to:   "  if (false) {\n    return { ok: false, reason: 'no_stock'," },
  { id: 'C2', file: MATH, why: '🔴 the ladder stops overruling the RANGE refusal, so "3/5 Gallon" — two live LAWNS trees — is refused again as a range despite being one rung',
    from: "  if (ladder != null) {\n    const r = resolveRung(ladder, lot.size);\n    if (r.ok) return lot.qty == null",
    to:   "  if (false) {\n    const r = resolveRung(ladder!, lot.size);\n    if (r.ok) return lot.qty == null" },
  { id: 'C3', file: MATH, why: '🔴 an OFF-LADDER size is reported as UNREADABLE — the 121 live off-ladder rows get a reason that sends somebody to the wrong fix',
    from: "    if (r.reason === 'off_ladder') return { ok: false, reason: 'off_ladder', detail: r.detail };",
    to:   '' },
  { id: 'C4', file: MATH, why: 'ZERO and NEVER-COUNTED collapse — "we counted and there are none" reads the same as "nobody has looked", which A9 exists to keep apart',
    from: '  if (lot.qty === 0) {',
    to:   '  if (lot.qty === 0 || lot.qty == null) {' },
  { id: 'G1', file: MATH, why: '🔴 the rung key ignores the LADDER and goes back to the raw number — "#3" and "5 gal" split into two buckets again',
    from: '  if (ladder != null) {\n    const r = resolveRung(ladder, lot.size);\n    if (!r.ok) return null;',
    to:   '  if (false) {\n    const r = resolveRung(ladder!, lot.size);\n    if (!r.ok) return null;' },
];

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const originals = new Map(FILES.map(f => [f, readFileSync(f, 'utf8')]));
let caught = 0, survived = 0, errored = 0, noBuild = 0;

try {
  process.stdout.write('  CONTROL (unmutated) … ');
  const control = suiteState();
  if (control.state !== 'green') {
    console.log(`${control.state.toUpperCase()} — aborting; every CAUGHT below would be meaningless.`);
    if (control.detail) console.log('  ' + control.detail);
    process.exit(2);
  }
  console.log('GREEN ✓\n');

  for (const m of MUTANTS) {
    const original = originals.get(m.file);
    const occurrences = original.split(m.from).length - 1;
    if (occurrences === 0) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in the source — mutant never applied`);
      errored++; continue;
    }
    if (occurrences > 1) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text appears ${occurrences}× — the mutant cannot say which site it changed`);
      errored++; continue;
    }
    writeFileSync(m.file, original.replace(m.from, m.to));
    const st = suiteState();
    if (st.state === 'no-build') {
      noBuild++;
      console.log(`  ${m.id.padEnd(4)} NO-BUILD ⚠   did not compile — NOT a pass; nothing was measured. ${m.why}`);
    } else if (st.state === 'green') {
      survived++; console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`);
    } else {
      caught++;  console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`);
    }
    writeFileSync(m.file, original);
  }
} finally {
  for (const [f, o] of originals) writeFileSync(f, o);
}

console.log(`\n  ── ${caught}/${MUTANTS.length} caught · ${survived} survived · ${noBuild} did not build · ${errored} never applied ──`);
if (survived > 0 || errored > 0 || noBuild > 0) process.exit(1);
