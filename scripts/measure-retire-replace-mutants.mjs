/**
 * ── measure-retire-replace-mutants — can a physical count go missing? ─────────────────
 *
 * PURPOSE:      Every mutant here loses, duplicates, or destroys a row. The one that matters
 *               most is T3, because IT IS THE BUG THIS FILE SHIPPED IN ITS FIRST DRAFT: a single
 *               "SKU wins if present" key, which — given 447 rows with NO SKUs and 685 items that
 *               ALL have SKUs — matches nothing, retires every counted row and creates a duplicate
 *               for it. It was caught by a probe rather than by reading, and it stays here so the
 *               probe set is PROVEN to still catch it.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR.
 *
 * Run: node scripts/measure-retire-replace-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT   = new URL('..', import.meta.url).pathname;
const TARGET = ROOT + 'packages/shared/src/inventory/retireAndReplace.ts';
const SUITE  = 'packages/shared/src/inventory/retireAndReplace.test.ts';
const ESB    = ROOT + 'node_modules/.bin/esbuild';

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  { id: 'T1', why: '🔴 a COUNTED row can be retired — the one number nobody can walk a lot twice to recreate',
    from: '    const counted = Number.isFinite(row.qty) && row.qty > 0;',
    to:   '    const counted = false;' },
  { id: 'T2', why: '🔴 an ADOPTED row also gets a duplicate created — on-hand split across two rows (#56 at import time)',
    from: '    if (consumedShapes.has(shk) || (sk && consumedSkus.has(sk))) continue;',
    to:   '    if (false) continue;' },
  { id: 'T3', why: '🔴 THE FIRST-DRAFT BUG: one SKU-first key, so 447 SKU-less rows match none of 685 SKU-bearing items',
    from: '    const bySkuHit = sk ? bySku.get(sk) : undefined;\n    if (bySkuHit && !takenIds.has(bySkuHit.qboId)) return bySkuHit;\n    const byShapeHit = byShape.get(shapeKey(row.name, row.size));',
    to:   '    const bySkuHit = sk ? bySku.get(sk) : undefined;\n    if (sk) return bySkuHit && !takenIds.has(bySkuHit.qboId) ? bySkuHit : undefined;\n    const byShapeHit = byShape.get(shapeKey(row.name, row.size));' },
  { id: 'T4', why: '🔴 two UNPARSEABLE sizes match each other — everything nobody could interpret merges into one product',
    from: "    : `raw:${(size ?? '').trim().toLowerCase()}`;",
    to:   "    : 'raw:unknown';" },
  { id: 'T5', why: '🔴 the consumed SHAPE is not recorded, so a product QuickBooks lists twice creates a second row',
    from: '    consumedShapes.add(shapeKey(item.name, item.size));',
    to:   '' },
  { id: 'T6', why: 'the reported counts come from the INPUT lengths rather than the lists they claim to count',
    from: '  plan.counts.retired = plan.retire.length;',
    to:   '  plan.counts.retired = existing.length;' },
  { id: 'T7', why: 'a NEGATIVE quantity counts as stock, so a data defect is preserved as though it were a count',
    from: '&& row.qty > 0;',
    to:   '&& row.qty !== 0;' },
  { id: 'T8', why: 'a carried row stops naming the discrepancy and reads as a tidy-up',
    from: 'and QuickBooks has no matching product. Nothing was changed about it. Worth a look: you are holding stock your accounting system does not list.',
    to:   'and it was kept.' },
  { id: 'T9', why: 'first-writer-wins is dropped on the shape index, so a later duplicate overwrites the item already matched',
    from: '    if (!byShape.has(shk)) byShape.set(shk, item);',
    to:   '    byShape.set(shk, item);' },
  // 🔴 T10 IS THE DEFECT THIS HARNESS FOUND, PINNED SO IT CANNOT COME BACK. The first draft
  // consumed the match on the RETIRE path, which retired the old row AND suppressed its
  // replacement — the product vanished from the catalogue. No probe covered it; the harness
  // surfaced it by flagging the line's REMOVAL as an improvement. §H now pins the fix.
  { id: 'T10', why: '🔴 the RETIRE path consumes its match again, so a retired row loses its replacement and the product disappears',
    from: '  for (const item of incoming) {\n    const shk = shapeKey(item.name, item.size);',
    to:   '  for (const item of incoming) {\n    if (plan.retire.some(r => shapeKey(r.existing.name, r.existing.size) === shapeKey(item.name, item.size))) continue;\n    const shk = shapeKey(item.name, item.size);' },
];

const original = readFileSync(TARGET, 'utf8');
let caught = 0, survived = 0, errored = 0;
try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suiteIsGreen()) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
  console.log('GREEN ✓\n');
  for (const m of MUTANTS) {
    if (!original.includes(m.from)) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in the source — mutant never applied`);
      errored++; continue;
    }
    writeFileSync(TARGET, original.replace(m.from, m.to));
    if (suiteIsGreen()) { survived++; console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); }
    else               { caught++;  console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); }
  }
} finally {
  writeFileSync(TARGET, original);
}
console.log(`\n  ── ${caught}/${MUTANTS.length} caught · ${survived} survived · ${errored} never applied ──`);
if (survived > 0 || errored > 0) process.exit(1);
