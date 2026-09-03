/**
 * ── retireAndReplace — throwing away somebody's product list and keeping their count ──────
 *
 * 🔴 WHAT IS UNDER TEST IS CONSERVATION, NOT CLASSIFICATION. The dangerous outcome is not a row
 * in the wrong bucket — it is a row in NO bucket, or in two. Both produce a report that adds up
 * on screen while the database disagrees, and the one number that cannot be reconstructed
 * afterwards is a physical count somebody walked a lot to get.
 *
 * §A  conservation — every row lands exactly once, both directions
 * §B  🔴 a counted row is never retired, whatever else is true of it
 * §C  🔴 a counted row that matches is ADOPTED, not carried beside a duplicate
 * §D  matching is by meaning, not by raw string
 * §E  a counted row matching nothing is CARRIED and named as a finding
 * §F  duplicates on either side cannot double-consume
 * §G  the counts agree with the lists they claim to count
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/inventory/retireAndReplace.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { planRetireAndReplace, type ExistingRow, type IncomingItem } from './retireAndReplace';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const row = (id: string, name: string, size: string | null, qty = 0, sku: string | null = null): ExistingRow =>
  ({ id, name, size, qty, sku });
const item = (qboId: string, name: string, size: string | null, sku: string | null = null): IncomingItem =>
  ({ qboId, name, size, sku });

/** Conservation, asserted the same way every time. */
function conserved(existing: ExistingRow[], incoming: IncomingItem[]) {
  const p = planRetireAndReplace(existing, incoming);
  const outE = [...p.adopt.map(x => x.existing.id), ...p.carry.map(x => x.existing.id), ...p.retire.map(x => x.existing.id)];
  const outI = [...p.adopt.map(x => x.incoming.qboId), ...p.create.map(x => x.incoming.qboId)];
  return {
    p,
    everyRowOnce: outE.length === existing.length && new Set(outE).size === existing.length,
    everyItemOnce: new Set(outI).size === outI.length,
  };
}

// ── §A conservation ──────────────────────────────────────────────────────────
{
  const existing = [row('r1','Live Oak','15 gal'), row('r2','Red Maple','30 gal', 7), row('r3','Ghost Item',null)];
  const incoming = [item('q1','Live Oak','15 gal','LO15'), item('q2','Red Maple','30 gal','RM30'), item('q3','Cedar Elm','45 gal','CE45')];
  const { p, everyRowOnce, everyItemOnce } = conserved(existing, incoming);
  ok(everyRowOnce, '🔴 every existing row lands in EXACTLY ONE of adopt/carry/retire — none lost, none doubled');
  ok(everyItemOnce, '🔴 no incoming item is consumed twice');
  ok(p.counts.existingIn === 3 && p.counts.incomingIn === 3, 'the plan reports what went IN, so the split can be checked rather than trusted');
  ok(!('delete' in p), 'there is no delete bucket — a caller cannot act on one because the plan cannot express one');
}

// ── §B a counted row is NEVER retired ────────────────────────────────────────
{
  // The counted row matches nothing, has no SKU, and its name is junk — every reason to bin it.
  const existing = [row('r1','zzz unidentifiable junk',null, 4)];
  const p = planRetireAndReplace(existing, [item('q1','Live Oak','15 gal','LO15')]);
  ok(p.retire.length === 0, '🔴 a row with 4 on hand is NOT retired even when nothing about it matches — a count is the one thing nobody can recreate');
  ok(p.carry.length === 1, 'it is CARRIED');
  ok(p.create.length === 1, 'and the QuickBooks item is still added');
}
{
  const many = [row('a','A','15 gal',1), row('b','B','15 gal',0), row('c','C','15 gal',-3), row('d','D','15 gal', 0.5)];
  const p = planRetireAndReplace(many, []);
  const retiredIds = p.retire.map(x => x.existing.id).sort().join(',');
  ok(retiredIds === 'b,c', 'zero and NEGATIVE quantities retire; a negative count is not stock, it is a defect and retiring it does not destroy a real number');
  ok(p.carry.map(x => x.existing.id).sort().join(',') === 'a,d', 'and any positive quantity — including a fractional one — is kept');
}

// ── §C 🔴 ADOPT, not carry-beside-a-duplicate ────────────────────────────────
{
  const existing = [row('r1','Red Maple','30 gal', 7)];
  const incoming = [item('q1','Red Maple','30 gal','RM30')];
  const p = planRetireAndReplace(existing, incoming);
  ok(p.adopt.length === 1, '🔴 a counted row matching an incoming item is ADOPTED');
  ok(p.create.length === 0,
    '🔴 AND NO SECOND ROW IS CREATED FOR IT — creating one would split 7 on hand across two rows, which is tech-debt #56 manufactured deliberately at import time');
  ok(p.adopt[0].existing.qty === 7 && p.adopt[0].incoming.sku === 'RM30',
    'the row keeps its count and takes the QuickBooks identity');
  ok(p.carry.length === 0, 'and it is not double-reported as carried as well');
}

// ── §D matching is by MEANING ────────────────────────────────────────────────
{
  const p = planRetireAndReplace([row('r1','Red Maple','30 Gallon', 7)], [item('q1','Red Maple','30 gal','RM30')]);
  ok(p.adopt.length === 1 && p.create.length === 0,
    '🔴 `30 Gallon` and `30 gal` are the same shelf — raw string equality here would create a duplicate for a row that has stock on it');
}
{
  const p = planRetireAndReplace([row('r1','Red Maple','15 gal', 7)], [item('q1','Red Maple','30 gal','RM30')]);
  ok(p.carry.length === 1 && p.create.length === 1,
    'but 15 gal and 30 gal are DIFFERENT products — the negative control, without which the probe above passes on a matcher that matches everything');
}
{
  // Two sizes neither parser understands. They must NOT collapse into one another.
  const p = planRetireAndReplace([row('r1','Widget','flurb', 2)], [item('q1','Widget','glorp','W1')]);
  ok(p.carry.length === 1 && p.create.length === 1,
    '🔴 two UNPARSEABLE sizes do not match each other — treating null==null as "same size" would merge everything nobody could interpret');
}
{
  const p = planRetireAndReplace([row('r1','Widget','flurb', 2)], [item('q1','Widget',' FLURB ','W1')]);
  ok(p.adopt.length === 1,
    '…though the same unparseable label DOES match itself after trimming and casing');
}
{
  // SKU wins over name/size when both sides carry one.
  const p = planRetireAndReplace([row('r1','Old Name','15 gal', 3, 'LO15')], [item('q1','Completely Different Name','45 gal','LO15')]);
  ok(p.adopt.length === 1, 'a matching SKU is the identity QuickBooks considers canonical and wins over a renamed product');
}

// ── §E a counted row matching nothing is a FINDING ───────────────────────────
{
  const p = planRetireAndReplace([row('r1','Mystery Stock','15 gal', 12)], []);
  ok(p.carry.length === 1, 'stock QuickBooks has never heard of is kept');
  ok(/does not list|no matching product/i.test(p.carry[0].reason),
    '🔴 and the reason NAMES the discrepancy rather than reading as a tidy-up — deleting it loses a count, keeping it quietly hides a gap');
}

// ── §F duplicates cannot double-consume ──────────────────────────────────────
{
  // QuickBooks itself carries the same product twice.
  const p = planRetireAndReplace([row('r1','Live Oak','15 gal', 5)], [item('q1','Live Oak','15 gal','LO15'), item('q2','Live Oak','15 gal','LO15')]);
  ok(p.adopt.length === 1, 'a duplicated QuickBooks item adopts onto the counted row once');
  ok(p.create.length === 0,
    '🔴 and its twin does NOT become a second row — the on-hand would be split by a duplicate we imported ourselves');
}
{
  // Our own list carries the same product twice, both counted (the six known duplicate pairs).
  const p = planRetireAndReplace([row('r1','Live Oak','15 gal', 5), row('r2','Live Oak','15 gal', 2)], [item('q1','Live Oak','15 gal','LO15')]);
  ok(p.adopt.length === 1 && p.carry.length === 1,
    'two counted rows for one product: one adopts, the other is CARRIED — never silently merged, because merging two counts invents a third number nobody counted');
  ok(p.adopt.length + p.carry.length + p.retire.length === 2, 'and both are still accounted for');
}

// ── §G the counts agree with the lists ───────────────────────────────────────
{
  const existing = [row('r1','A','15 gal'), row('r2','B','30 gal', 4), row('r3','C','45 gal', 1), row('r4','D',null)];
  const incoming = [item('q1','A','15 gal','A15'), item('q2','B','30 gal','B30'), item('q3','E','5 gal','E5')];
  const p = planRetireAndReplace(existing, incoming);
  ok(p.counts.adopted === p.adopt.length && p.counts.carried === p.carry.length
     && p.counts.retired === p.retire.length && p.counts.created === p.create.length,
    '🔴 every reported count equals the list it claims to count — a count that disagrees with its own list is the #143 class');
  ok(p.counts.adopted + p.counts.carried + p.counts.retired === p.counts.existingIn,
    'and retired + carried + adopted accounts for every row that went in');
}


// ── §H 🔴 RETIRE-AND-REPLACE: THE REPLACEMENT ACTUALLY LANDS ─────────────────
{
  // The whole point of the build. An uncounted row is superseded by its QuickBooks twin: the old
  // row is hidden and the twin is CREATED, carrying the SKU and price the old row never had.
  const p = planRetireAndReplace([row('r1','Live Oak','15 gal', 0)], [item('q1','Live Oak','15 gal','LO15')]);
  ok(p.retire.length === 1, 'the uncounted row is retired');
  ok(p.create.length === 1 && p.create[0].incoming.sku === 'LO15',
    '🔴 AND ITS REPLACEMENT IS CREATED. Retiring the row while suppressing its twin would delete the product from the catalogue outright — a silent deletion dressed up as a retirement, on a build whose first rule is that nothing is deleted.');
  ok(p.adopt.length === 0 && p.carry.length === 0, 'and it is not double-reported');
}

// ── §I the SKU that no longer exists (the first-draft bug, from the other side) ──
{
  // The row HAS a SKU; QuickBooks has the same product under a DIFFERENT SKU. Matching on SKU
  // alone finds nothing and creates a duplicate of a row holding 9 on hand.
  const p = planRetireAndReplace([row('r1','Red Maple','30 gal', 9, 'OLD-RM30')],
                                 [item('q1','Red Maple','30 gal','NEW-RM30')]);
  ok(p.adopt.length === 1,
    '🔴 a row whose SKU is not in QuickBooks still matches by NAME AND SIZE — a renumbered product is the same shelf, and failing to see that splits 9 on hand across two rows');
  ok(p.create.length === 0, 'so no duplicate is created for it');
}

// ── §J QuickBooks lists one product twice under DIFFERENT SKUs ───────────────
{
  const p = planRetireAndReplace([row('r1','Cedar Elm','45 gal', 3)],
                                 [item('q1','Cedar Elm','45 gal','CE45-A'), item('q2','Cedar Elm','45 gal','CE45-B')]);
  ok(p.adopt.length === 1, 'the counted row adopts one of them');
  ok(p.create.length === 0,
    '🔴 and the OTHER SPELLING IS NOT CREATED — two different SKUs for one shelf still means one shelf, and creating the twin splits the count by a duplicate we imported ourselves');
}
{
  // …and the first-listed one is the one taken, deterministically.
  const p = planRetireAndReplace([row('r1','Cedar Elm','45 gal', 3)],
                                 [item('qFIRST','Cedar Elm','45 gal','CE-1'), item('qSECOND','Cedar Elm','45 gal','CE-2')]);
  ok(p.adopt[0].incoming.qboId === 'qFIRST',
    'first-listed wins, deterministically — a later duplicate must not overwrite the item already indexed, or which product a row adopts depends on list order');
}

console.log(`\n  retireAndReplace — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
