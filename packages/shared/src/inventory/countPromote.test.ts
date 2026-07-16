/**
 * ── countPromote — the count's promote decision · D-49 · 2026-07-16 ──
 *
 * Reproduces the LIVE failure David hit owner-proving #55 (tech-debt #57): counting a scraped
 * variety CREATED a second row beside the parent instead of filling it, and the RE-SCAN of the
 * same slug then went UNKNOWN — because the family was left half-grouped and half-size-less, so
 * detectSizeCollision (correctly) refused to guess. Inventory climbed 114 → 118 on four scans
 * and all four varieties became permanently unscannable. Counting a variety made it uncountable.
 *
 * EVERY fixture below is REAL LIVE DATA (David's read-only catalog read, business
 * f7ec5d67-a9ef-4cb0-b807-438d67687d1b, 2026-07-16) — not invented shapes.
 *
 * THE RE-SCAN ASSERTIONS RUN THE REAL SHIPPED GATE. They call detectSizeCollision from
 * stockLineResolver — the actual function the scan path uses — against the simulated post-write
 * family. A test that re-implemented the gate would prove only that the test agrees with itself
 * (the #55 lesson: re-verify against the REAL function, not the probe's copy).
 *
 * Run (no test runner installed — pure TS, esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/inventory/countPromote.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { resolveCountTarget, isVarietyStub, baseSkuOf, sameSizeLabel, type CountSibling } from './countPromote';
import { detectSizeCollision } from './stockLineResolver';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// A family row as the scan's L4 sees it (the fields detectSizeCollision reads).
interface Row { id: string; size: string | null; variant_group: string | null; qty: number | null; sku: string | null }

/** Simulate the promote's WRITE against a family, then hand the post-state to the REAL gate.
 *  This is what makes "the re-scan resolves" a real assertion instead of a hopeful one. */
function applyTarget(family: Row[], target: ReturnType<typeof resolveCountTarget>, qty: number): Row[] {
  const rows = family.map(r => ({ ...r }));
  if (target.action === 'update') {
    const r = rows.find(x => x.id === target.rowId)!;
    r.qty = qty; if (target.variantGroup) r.variant_group = target.variantGroup;
  } else if (target.action === 'fill') {
    const r = rows.find(x => x.id === target.rowId)!;
    r.qty = qty; r.size = target.size; if (target.variantGroup) r.variant_group = target.variantGroup;
  } else if (target.action === 'create') {
    for (const id of target.regroup) rows.find(x => x.id === id)!.variant_group = target.variantGroup;
    rows.push({ id: 'NEW', size: target.size, variant_group: target.variantGroup, qty, sku: target.sku });
  }
  return rows;
}
/** The scan's own verdict on a family: what L4 → L5 does with >1 token-equal same-name rows. */
function rescanResolves(rows: Row[]): boolean {
  if (rows.length === 1) return true;                 // L4 single match → resolved
  return detectSizeCollision(rows);                   // >1 → the REAL gate decides picker vs UNKNOWN
}
const sibs = (rows: Row[]): CountSibling[] =>
  rows.map(r => ({ id: r.id, size: r.size, qty: r.qty, variant_group: r.variant_group, sku: r.sku }));

// ══ THE STUB PREDICATE (D-49) ════════════════════════════════════════════════
ok(isVarietyStub({ qty: 0, size: null, variant_group: null }), 'stub: qty 0 + no size + no group');
ok(isVarietyStub({ qty: 0, size: '  ', variant_group: '' }), 'stub: blank-string size/group count as absent');
ok(!isVarietyStub({ qty: 0, size: '30 gal', variant_group: null }), 'NOT a stub: a sold-out real lot keeps its size');
ok(!isVarietyStub({ qty: 10, size: null, variant_group: null }), 'NOT a stub: stock on hand means it is a lot');
ok(!isVarietyStub({ qty: 0, size: null, variant_group: 'sierra-mexican-red-oak' }), 'NOT a stub: already in a size-family');

// ══ THE FOUR LIVE ORPHANS — the defect, reproduced ═══════════════════════════
// Live: Basham's Party Pink Crape Myrtle DISC-1009 · qty 0 · size null · group null (2026-06-26 scrape).
// David counted 25 × "30 gal" → a SECOND row was born (e92aedb2, sku null) → re-scan UNKNOWN.
const BASHAMS: Row[] = [
  { id: '91be4388', size: null, variant_group: null, qty: 0, sku: 'DISC-1009' },
];
{
  const t = resolveCountTarget({ siblings: sibs(BASHAMS), groupKey: 'bashams-party-pink-crape-myrtle', size: '30 gal' });
  ok(t.action === 'fill', "Basham's: a counted stub FILLS in place — does NOT mint a sibling");
  const after = applyTarget(BASHAMS, t, 25);
  ok(after.length === 1, "Basham's: still ONE row after the count (the 114→118 climb is gone)");
  ok(after[0].sku === 'DISC-1009', "Basham's: the filled row KEEPS its scrape SKU");
  ok(after[0].size === '30 gal' && after[0].qty === 25, "Basham's: the count's size + qty land on it");
  ok(after[0].variant_group === 'bashams-party-pink-crape-myrtle', "Basham's: variant_group set from the QR slug");
  ok(rescanResolves(after), "Basham's: RE-SCAN RESOLVES — the defect that motivated D-49");
}
// The other three, same shape, same live ids/sizes.
for (const [name, id, sku, size, qty, grp] of [
  ["Evey's Pride Mimosa",   '970aa781', 'DISC-1070', '5 gal',  42, 'eveys-pride-mimosa'],
  ["Summer's Tower Redbud", '076a20a1', 'DISC-1099', '15 gal', 38, 'summers-tower-redbud'],
  ["Hearts A'fire Redbud",  '518dd451', 'DISC-1091', '45 gal', 39, 'hearts-afire-redbud'],
] as const) {
  const family: Row[] = [{ id, size: null, variant_group: null, qty: 0, sku }];
  const t = resolveCountTarget({ siblings: sibs(family), groupKey: grp, size });
  const after = applyTarget(family, t, qty);
  ok(t.action === 'fill' && after.length === 1, `${name}: stub FILLED, one row`);
  ok(after[0].sku === sku, `${name}: keeps ${sku}`);
  ok(rescanResolves(after), `${name}: re-scan RESOLVES`);
}

// ══ BRANCH 2 — UNGROUPED NON-STUB: create is right, but AUTO-GROUP the parent ═
// Live: Flip Side Vitex DISC-1104 · qty 10 · size "45" · variant_group NULL. A real lot, not a
// stub. Counting a SECOND size must mint a sibling AND regroup the parent — or the family is
// left mixed-group and the next scan goes UNKNOWN (the same dead end, different gate).
const FLIPSIDE: Row[] = [
  { id: 'flip-1104', size: '45', variant_group: null, qty: 10, sku: 'DISC-1104' },
];
{
  const t = resolveCountTarget({ siblings: sibs(FLIPSIDE), groupKey: 'flip-side-vitex', size: '30 gal' });
  ok(t.action === 'create', 'Flip Side: a real ungrouped lot + a NEW size → CREATE (not fill)');
  ok(t.action === 'create' && t.regroup.includes('flip-1104'), 'Flip Side: the ungrouped PARENT is regrouped in the same pass');
  ok(t.action === 'create' && t.sku === 'DISC-1104-30G', 'Flip Side: sibling SKU derives from the parent — DISC-1104-30G');
  const after = applyTarget(FLIPSIDE, t, 12);
  ok(after.every(r => r.variant_group === 'flip-side-vitex'), 'Flip Side: EVERY row of the family now carries the group');
  ok(rescanResolves(after), 'Flip Side: re-scan → the SIZE-PICKER fires (invariant holds by construction)');
}

// ══ THE LIVE CONTROLS — already-working families must not move ════════════════
// Live: 'Sierra' Mexican Red Oak — 2 rows, BOTH grouped, sizes ["15","30 gal"], skus [DISC-1001, NULL].
// Minted by this same CREATE path (sku NULL proves it) and it WORKS. Proof that CREATE is not
// the defect — CREATE-while-leaving-the-parent-ungrouped is.
const SIERRA: Row[] = [
  { id: 'sierra-15', size: '15',     variant_group: 'sierra-mexican-red-oak', qty: 3, sku: 'DISC-1001' },
  { id: 'sierra-30', size: '30 gal', variant_group: 'sierra-mexican-red-oak', qty: 4, sku: null },
];
ok(rescanResolves(SIERRA), "'Sierra' UNREGRESSED: the live 2-size family still resolves (picker fires)");
{
  const t = resolveCountTarget({ siblings: sibs(SIERRA), groupKey: 'sierra-mexican-red-oak', size: '15' });
  ok(t.action === 'update' && t.rowId === 'sierra-15', "'Sierra': counting an EXISTING size updates that row");
  ok(applyTarget(SIERRA, t, 9).length === 2, "'Sierra': no row minted by a re-count");
}
{
  // A genuine THIRD size on a working family — SKU lineage must reach past the sku-null sibling.
  const t = resolveCountTarget({ siblings: sibs(SIERRA), groupKey: 'sierra-mexican-red-oak', size: '45 gal' });
  ok(t.action === 'create' && t.sku === 'DISC-1001-45G', "'Sierra': a 3rd size derives from the BASE sku, not the sku-null sibling");
  ok(t.action === 'create' && t.regroup.length === 0, "'Sierra': nothing to regroup — already whole");
  ok(rescanResolves(applyTarget(SIERRA, t, 5)), "'Sierra': still resolves with three sizes");
}

// ══ SKU LINEAGE ══════════════════════════════════════════════════════════════
ok(baseSkuOf([{ sku: 'DISC-1001' }, { sku: null }]) === 'DISC-1001', 'baseSku: the one SKU in the family');
ok(baseSkuOf([{ sku: 'DISC-1001-30G' }, { sku: 'DISC-1001' }]) === 'DISC-1001', 'baseSku: SHORTEST wins — the base, never a derived sibling');
ok(baseSkuOf([{ sku: null }, { sku: '  ' }]) === null, 'baseSku: no SKU anywhere → null (D-9, never fabricate a base)');
{
  // D-9 omit-not-fake: a no-SKU parent yields a no-SKU sibling — blank, never invented.
  const family: Row[] = [{ id: 'x', size: '5 gal', variant_group: 'g', qty: 2, sku: null }];
  const t = resolveCountTarget({ siblings: sibs(family), groupKey: 'g', size: '15 gal' });
  ok(t.action === 'create' && t.sku === null, 'no-SKU parent → sibling SKU blank, not fabricated (D-9)');
}

// ══ PRESERVED BEHAVIOR — the branches that were already right ═════════════════
{
  const family: Row[] = [{ id: 'p', size: null, variant_group: null, qty: 0, sku: 'DISC-9' }];
  const t = resolveCountTarget({ siblings: sibs(family), groupKey: 'g', size: null });
  ok(t.action === 'update' && t.rowId === 'p', 'stub counted with NO size → plain update (it matched at size null)');
}
ok(resolveCountTarget({ siblings: [], groupKey: null, size: '5 gal' }).action === 'record-only',
   'plant tag with no linked lot → record-only (nothing to write to inventory)');
ok(resolveCountTarget({ siblings: [], groupKey: 'new-variety', size: '5 gal' }).action === 'create',
   'a brand-new variety with a group key → create');
ok(sameSizeLabel(' 30 GAL ', '30 gal'), 'size compare: case/whitespace-insensitive (free label)');
ok(!sameSizeLabel('15', '15 gal'), 'size compare: "15" != "15 gal" — RECORDED as tech-debt #56, not fixed here');

console.log(`\ncountPromote: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
