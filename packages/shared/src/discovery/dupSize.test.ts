/**
 * ── dupSize — the (variant_group, size) uniqueness fact, both moments · ledger #135 · 2026-07-16 ──
 *
 * Reproduces the LIVE failure David minted through the UI on 2026-07-16, in under a minute:
 *
 *   DISC-1002      | Acoma Crape Myrtle | qty 20 | size 15 | acoma-crape-myrtle
 *   DISC-1002-15G  | Acoma Crape Myrtle | qty ?  | size 15 | acoma-crape-myrtle
 *
 * Same group, same size. That is CASE 5 — ledger #73/#74's *same-group-same-size* dead end, which
 * the ledger has carried as THEORETICAL since 2026-06-30. It is now live.
 *
 * ROOT: D-46's editor enforces SKU uniqueness (DISC-1002-15G is unique → the guard passed) and
 * never checks SIZE uniqueness within the group. TWO DIFFERENT FACTS; only one was guarded. A SKU
 * identifies one sellable unit; a (group, size) pair identifies one VARIANT — WooCommerce and
 * Shopify both refuse a duplicate option combination independently of SKU (§6 r16).
 *
 * The detector (findDuplicateSizeGroups) already saw this collision AFTER the fact — it is what put
 * the amber flag on the row. What was missing was the guard that refuses to mint it. Same fact, same
 * key, opposite moment: this suite holds both to ONE key (sizeGroupKey) so they cannot drift.
 *
 * Run (no test runner installed — pure TS, esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/discovery/dupSize.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { findDuplicateSizeGroups, findSizeTwin, sizeGroupKey, type SizeTwinCandidate } from './dupSize';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const row = (id: string, name: string, size: string | null, vg: string | null, sku: string | null = null): SizeTwinCandidate =>
  ({ id, name, size, variant_group: vg, sku });

// ══ THE ONE KEY (STD-011) ════════════════════════════════════════════════════
ok(sizeGroupKey('acoma-crape-myrtle', '15') === '["acoma-crape-myrtle","15"]', 'key: the (group, size) pair, lowercased');
ok(sizeGroupKey('g', ' 30 GAL ') === sizeGroupKey('g', '30 gal'), 'key: size is a free label — case/whitespace-insensitive');
ok(sizeGroupKey(null, '15') === null, 'key: no group → cannot collide (a parent row is not a variant)');
ok(sizeGroupKey('g', null) === null, 'key: no size → cannot collide HERE (that is the blank-size class, a different gate)');
ok(sizeGroupKey('g', '  ') === null, 'key: blank-string size counts as absent');
ok(sizeGroupKey('a||b', 'c') !== sizeGroupKey('a', 'b||c'), 'key: the separator cannot be forged into a cross-pair collision');

// ══ THE GUARD — the live Acoma mint, refused (defect 2) ══════════════════════
// The catalog as it stood the moment David clicked "+ Add size" on the DISC-1002 row and typed 15.
const ACOMA_BEFORE: SizeTwinCandidate[] = [
  row('acoma-1002', 'Acoma Crape Myrtle', '15', 'acoma-crape-myrtle', 'DISC-1002'),
  row('vitex-1104', 'Flip Side Vitex',    '45', 'flip-side-vitex',    'DISC-1104'),
];
{
  const twin = findSizeTwin(ACOMA_BEFORE, { variantGroup: 'acoma-crape-myrtle', size: '15' });
  ok(twin !== null, 'Acoma: "+ Add size" with a size ALREADY in the group is REFUSED (the live CASE 5)');
  ok(twin?.id === 'acoma-1002', 'Acoma: the guard NAMES the existing row, so the owner can be offered "edit that one instead"');
  ok(twin?.sku === 'DISC-1002', 'Acoma: the twin carries its SKU — a bare refusal is not actionable, a named one is');
}
ok(findSizeTwin(ACOMA_BEFORE, { variantGroup: 'acoma-crape-myrtle', size: ' 15 ' }) !== null,
   'Acoma: whitespace does not sneak a duplicate past the guard');
ok(findSizeTwin(ACOMA_BEFORE, { variantGroup: 'acoma-crape-myrtle', size: '30 gal' }) === null,
   'Acoma: a genuinely NEW size is allowed through — the guard refuses duplicates, not additions');
ok(findSizeTwin(ACOMA_BEFORE, { variantGroup: 'flip-side-vitex', size: '15' }) === null,
   'a size may repeat across DIFFERENT varieties — 15 gal exists in many groups, that is not a collision');
ok(findSizeTwin(ACOMA_BEFORE, { variantGroup: 'acoma-crape-myrtle', size: '15', excludeId: 'acoma-1002' }) === null,
   're-saving a row its OWN size never false-collides (excludeId — the edit path)');
ok(findSizeTwin(ACOMA_BEFORE, { variantGroup: null, size: '15' }) === null,
   'an ungrouped row cannot collide — it is not in a family yet');
ok(findSizeTwin(ACOMA_BEFORE, { variantGroup: 'acoma-crape-myrtle', size: null }) === null,
   'a blank size is not a DUPLICATE — it is refused by the size-required rule, a different gate (never conflate them)');

// ══ THE DETECTOR — unregressed, and it agrees with the guard ═════════════════
// The catalog as it stands NOW: the guard did not exist, so the twin is real and still in the data.
const ACOMA_AFTER: SizeTwinCandidate[] = [
  ...ACOMA_BEFORE,
  row('acoma-15g', 'Acoma Crape Myrtle', '15', 'acoma-crape-myrtle', 'DISC-1002-15G'),
];
{
  const groups = findDuplicateSizeGroups(ACOMA_AFTER);
  ok(groups.length === 1, 'detector: ONE collision in the live catalog (not two — two ROWS, one collision)');
  ok(groups[0].count === 2, 'detector: the one collision involves TWO rows — the copy and the trace must agree on which noun they count');
  ok(groups[0].variantGroup === 'acoma-crape-myrtle' && groups[0].size === '15', 'detector: names the colliding pair');
  // The two moments of ONE fact must never disagree.
  ok(findSizeTwin(ACOMA_BEFORE, { variantGroup: 'acoma-crape-myrtle', size: '15' }) !== null && groups.length === 1,
     'guard and detector agree: what the detector flags after the fact is exactly what the guard now refuses before it');
}
ok(findDuplicateSizeGroups(ACOMA_BEFORE).length === 0, 'detector: the pre-mint catalog was clean (the guard would have kept it that way)');

// A blank-size row still cannot be seen by the detector — RECORDED, deliberately NOT widened here.
// This is why the grid was blind to the mixed-group/missing-size class all along (dupSize.ts:44):
// the one surface built to surface this damage could not see it.
ok(findDuplicateSizeGroups([
  row('a', 'Alley Cat Redbud Espalier', null, 'alley-cat-redbud-espalier'),
  row('b', 'Alley Cat Redbud Espalier', null, 'alley-cat-redbud-espalier'),
]).length === 0, 'KNOWN BLIND SPOT (recorded, not fixed): blank-size rows are invisible to the detector');

// tech-debt #56 — size VOCABULARY. Recorded here as a live limit, deliberately NOT fixed.
ok(findSizeTwin([row('s', 'Sierra Mexican Red Oak', '15', 'sierra-mexican-red-oak')],
                { variantGroup: 'sierra-mexican-red-oak', size: '15 gal' }) === null,
   'KNOWN LIMIT (tech-debt #56): "15 gal" does not collide with "15" — the size-vocabulary defect, its own build');

console.log(`\ndupSize: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
