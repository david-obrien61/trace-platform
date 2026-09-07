/**
 * ── measure-grid-standard-mutants — can four grids drift back into three shapes? ──────────────
 *
 * PURPOSE:      G11 ("column order is ACTIONS · NAME · DATA") is a rule about SOMETHING NOBODY
 *               NOTICES. Every mutant here produces a grid that renders perfectly: no error, no
 *               empty table, no red. The Edit button is simply in a different place than it is on
 *               the next screen — which is exactly why the platform accumulated three shapes
 *               without anyone deciding on any of them. Reading the screen cannot find these.
 *
 * 🔴 THE PROBES WERE WRITTEN ALONGSIDE THE CODE, SO THEIR FIRST GREEN RUN PROVED NOTHING (§6 r19).
 *               This is where they are made to refuse. C1 is the one that matters: it restores the
 *               engine that shipped — actions pinned AFTER the frozen run — under which /customers
 *               renders NAME · ACTIONS and /inventory renders ACTIONS · NAME, and the screens still
 *               work.
 *
 * ⚠️ S6/S7 EXIST TO PROVE THE CAP REACHES ITS POPULATION, NOT JUST ITS SUBJECT (tech-debt #182 —
 *               "a harness that cannot reach its target reports the same as one that passed").
 *               They mutate a consumer in `packages/shared` and one under `components/receipts`,
 *               i.e. the two places a cultivar-pages-only scan would silently miss — which is the
 *               live blind spot in `verify-ui-standard-divergence` (tech-debt #187).
 *
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR.
 *
 * Run: node scripts/measure-grid-standard-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

const ORDER   = 'packages/shared/src/components/datasheet/columnOrder.ts';
const PATCH   = 'packages/shared/src/components/datasheet/rowPatch.ts';
const ENGINE  = 'packages/shared/src/components/datasheet/DataSheet.tsx';
const INV     = 'packages/cultivar-os/src/pages/BusinessInventory.tsx';
const CUS     = 'packages/cultivar-os/src/pages/Customers.tsx';
const RCPT    = 'packages/cultivar-os/src/components/receipts/ReceiptsList.tsx';
const QBO     = 'packages/shared/src/components/QboBooksReader.tsx';

const S_ORDER = 'packages/shared/src/components/datasheet/columnOrder.test.ts';
const S_PATCH = 'packages/shared/src/components/datasheet/rowPatch.test.ts';
const S_GRID  = 'packages/cultivar-os/src/lib/gridStandard.test.ts';

function suiteIsGreen(suite) {
  try {
    execSync(`set -o pipefail; "${ESB}" "${suite}" --bundle --platform=node --format=cjs --log-level=error | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  // ══ the engine's placement rule ═══════════════════════════════════════════════════════
  { id: 'C1', target: ORDER, suite: S_ORDER,
    why: '🔴 THE ENGINE THAT SHIPPED — actions pinned AFTER the frozen run, so /customers renders NAME · ACTIONS and /inventory ACTIONS · NAME. Both screens work. This is the defect, restored.',
    from: '  const actionsAt = actionsWidth == null ? -1 : (idIdx === -1 ? 0 : idIdx);',
    to:   '  const actionsAt = actionsWidth == null ? -1 : frozen.length;' },
  { id: 'C2', target: ORDER, suite: S_ORDER,
    why: 'actions land immediately AFTER the identifier instead of before — one column out, on every grid at once',
    from: '  const actionsAt = actionsWidth == null ? -1 : (idIdx === -1 ? 0 : idIdx);',
    to:   '  const actionsAt = actionsWidth == null ? -1 : (idIdx === -1 ? 0 : idIdx + 1);' },
  { id: 'C3', target: ORDER, suite: S_ORDER,
    why: 'the no-identifier FALLBACK reverts to actions-last — a consumer that forgets the declaration silently gets the old shape back',
    from: '  const actionsAt = actionsWidth == null ? -1 : (idIdx === -1 ? 0 : idIdx);',
    to:   '  const actionsAt = actionsWidth == null ? -1 : (idIdx === -1 ? frozen.length : idIdx);' },
  { id: 'C4', target: ORDER, suite: S_ORDER,
    why: '🔴 the frozen run stops being CONTIGUOUS — every frozen column pins wherever it sits, which would have hidden the live G3 failure instead of exposing it',
    from: '  let firstScroll = 0;\n  while (firstScroll < cols.length && cols[firstScroll].frozen) firstScroll++;\n  const frozen = cols.slice(0, firstScroll);\n  const scrollKeys = cols.slice(firstScroll).map(c => c.key);',
    to:   '  const frozen = cols.filter(c => c.frozen);\n  const scrollKeys = cols.filter(c => !c.frozen).map(c => c.key);' },

  // ══ the reserved tracks (§6 r14 — the #104/#105 defect) ═══════════════════════════════
  { id: 'C5', target: ORDER, suite: S_ORDER,
    why: 'an undeclared frozenWidth reserves ZERO instead of the default — the pinned block collapses and scrolling columns pass underneath it',
    from: '    push(\'column\', frozen[i].key, frozen[i].frozenWidth ?? DEFAULT_FROZEN_WIDTH);',
    to:   '    push(\'column\', frozen[i].key, frozen[i].frozenWidth ?? 0);' },
  { id: 'C6', target: ORDER, suite: S_ORDER,
    why: '🔴 the left offsets stop accumulating — every pinned track sits at 0 and they stack on top of each other',
    from: '    pinned.push({ kind, key, left, width, last: false });\n    left += width;',
    to:   '    pinned.push({ kind, key, left: 0, width, last: false });\n    left += width;' },
  { id: 'C7', target: ORDER, suite: S_ORDER,
    why: 'the freeze edge moves to the FIRST pinned track — the line marking where the pinned block ends is drawn where it begins',
    from: '  if (pinned.length) pinned[pinned.length - 1].last = true;',
    to:   '  if (pinned.length) pinned[0].last = true;' },
  { id: 'C8', target: ORDER, suite: S_ORDER,
    why: 'the G10 disclosure toggle stops leading — it is pushed after the frozen run, back to the trailing position ledger #270 removed',
    from: '  if (expandWidth != null) push(\'expand\', \'__expand__\', expandWidth);',
    to:   '' },
  { id: 'C9', target: ORDER, suite: S_ORDER,
    why: 'two identifier columns report OK — a config mistake that renders fine goes unreported, which is how it would ship',
    from: '  return { key: ids[0]?.key ?? null, count: ids.length, ok: ids.length === 1 };',
    to:   '  return { key: ids[0]?.key ?? null, count: ids.length, ok: ids.length >= 1 };' },

  // ══ prove-then-move ══════════════════════════════════════════════════════════════════
  { id: 'P1', target: PATCH, suite: S_PATCH,
    why: '🔴 THE ONE THAT MATTERS — a zero-row RLS refusal counts as landed, so a refused inline edit repaints as saved and there is no longer a refetch to snap it back. Exactly what "do not move local state before the write is proven" forbids.',
    from: "  if (!ev.data || ev.data.length === 0) return { landed: false, message: refusedMessage, cause: 'refused' };",
    to:   '' },
  { id: 'P2', target: PATCH, suite: S_PATCH,
    why: 'the row count is checked BEFORE the error, so a write that both errored and returned rows reports success',
    from: "  if (ev.error) return { landed: false, message: ev.error.message, cause: 'error' };\n  if (!ev.data || ev.data.length === 0) return { landed: false, message: refusedMessage, cause: 'refused' };",
    to:   "  if (ev.data && ev.data.length > 0) return { landed: true, message: null, cause: null };\n  if (ev.error) return { landed: false, message: ev.error.message, cause: 'error' };\n  if (!ev.data || ev.data.length === 0) return { landed: false, message: refusedMessage, cause: 'refused' };" },
  { id: 'P3', target: PATCH, suite: S_PATCH,
    why: '🔴 every row object is rebuilt on every patch — the values are all correct and THE FLASH IS BACK, because React now re-renders all 447 rows to change one',
    from: '    if (r.id !== id) return r;',
    to:   '    if (r.id !== id) return { ...r };' },
  { id: 'P4', target: PATCH, suite: S_PATCH,
    why: 'a patch for a row that is no longer on screen forces a re-render anyway — the "same array" contract quietly dropped',
    from: '  return hit ? out : rows;\n}\n\n/**\n * The same merge across MANY rows',
    to:   '  return out;\n}\n\n/**\n * The same merge across MANY rows' },
  { id: 'P5', target: PATCH, suite: S_PATCH,
    why: '🔴 a group rename stamps the FIRST sibling\'s updated_at onto all of them — a fabricated timestamp on rows that were written at their own moment',
    from: '  const byId = new Map(patches.map(p => [p.id, p.applied]));',
    to:   '  const byId = new Map(patches.map(p => [p.id, patches[0].applied]));' },
  { id: 'P6', target: PATCH, suite: S_PATCH,
    why: 'the input array is mutated in place instead of replaced — React sees the same reference and may never repaint at all',
    from: '  const out = rows.map(r => {\n    if (r.id !== id) return r;\n    hit = true;\n    return { ...r, ...(applied as Partial<T>) };\n  });\n  return hit ? out : rows;',
    to:   '  for (const r of rows) if (r.id === id) { Object.assign(r, applied); hit = true; }\n  return rows;' },

  // ══ the consumers — and whether the cap reaches all of them ══════════════════════════
  { id: 'S1', target: CUS, suite: S_GRID,
    why: '🔴 /customers drops its `identifier` declaration — the grid still renders (actions lead, by the fallback) and nothing on screen says the rule stopped being asserted',
    from: "frozen: true, frozenWidth: 200, identifier: true,",
    to:   "frozen: true, frozenWidth: 200," },
  { id: 'S2', target: INV, suite: S_GRID,
    why: '🔴 THE LIVE DEFECT, RE-CREATED — /inventory\'s Name stops being part of the frozen run, so the identifier does not pin and the only way to see it is to scroll right on a 20-column grid',
    from: "sortVal: r => r.name.toLowerCase(), frozen: true, frozenWidth: 180, identifier: true,",
    to:   "sortVal: r => r.name.toLowerCase(), identifier: true," },
  { id: 'S3', target: INV, suite: S_GRID,
    why: 'a frozen column loses its reserved width — §6 r14\'s exact precondition for the #104/#105 overlap',
    from: "{ key: 'flag', header: '', sortable: false, hideable: false, frozen: true, frozenWidth: 34,",
    to:   "{ key: 'flag', header: '', sortable: false, hideable: false, frozen: true," },
  { id: 'S4', target: INV, suite: S_GRID,
    why: 'a second column claims to be the identifier — two identifiers render fine and the actions track silently binds to whichever comes first',
    from: "{ key: 'sku', header: 'SKU', sortable: true,",
    to:   "{ key: 'sku', header: 'SKU', identifier: true, sortable: true," },
  { id: 'S5', target: ENGINE, suite: S_GRID,
    why: '🔴 the engine stops delegating — the ordering arithmetic returns to the .tsx, where every assertion above still passes and no probe can reach the rule again (tech-debt #134)',
    from: "import { planTracks, type PinnedTrack } from './columnOrder';",
    to:   "import { planTracks as _pt, type PinnedTrack } from './columnOrderShim';" },
  { id: 'S6', target: QBO, suite: S_GRID,
    why: '⚠️ REACH, NOT SUBJECT — a consumer in `packages/shared` loses its declaration. A cultivar-pages-only scan reports green here, which is the live blind spot in the divergence cap (tech-debt #187).',
    from: "key: 'number', header: 'Invoice number', sortable: true, hideable: false, identifier: true,",
    to:   "key: 'number', header: 'Invoice number', sortable: true, hideable: false," },
  { id: 'S7', target: RCPT, suite: S_GRID,
    why: '⚠️ REACH — a consumer under components/, not pages/, loses its declaration. The population is discovered by what RENDERS the grid, not by which folder it sits in.',
    from: "key: 'vendor', header: 'Vendor', frozen: true, frozenWidth: 200, hideable: false, identifier: true,",
    to:   "key: 'vendor', header: 'Vendor', frozen: true, frozenWidth: 200, hideable: false," },
];

const files = [...new Set(MUTANTS.map(m => m.target))];
const originals = new Map(files.map(f => [f, readFileSync(ROOT + f, 'utf8')]));
let caught = 0, survived = 0, errored = 0;

try {
  for (const suite of [...new Set(MUTANTS.map(m => m.suite))]) {
    process.stdout.write(`  CONTROL ${suite.split('/').pop().padEnd(24)} … `);
    if (!suiteIsGreen(suite)) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
    console.log('GREEN ✓');
  }
  console.log('');

  for (const m of MUTANTS) {
    const original = originals.get(m.target);
    if (!original.includes(m.from)) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in ${m.target.split('/').pop()} — mutant never applied`);
      errored++; continue;
    }
    writeFileSync(ROOT + m.target, original.replace(m.from, m.to));
    const green = suiteIsGreen(m.suite);
    writeFileSync(ROOT + m.target, original);
    if (green) { console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); survived++; }
    else       { console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); caught++; }
  }
} finally {
  for (const [f, src] of originals) writeFileSync(ROOT + f, src);
}

console.log(`\n  ── ${caught}/${caught + survived} caught · ${survived} survived · ${errored} never applied ──\n`);
process.exit(survived > 0 || errored > 0 ? 1 : 0);
