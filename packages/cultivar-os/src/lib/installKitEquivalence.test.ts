/**
 * ── installKit ⇄ loadList EQUIVALENCE · 2026-09-25 (ledger #411) ────────────────────────────────
 *
 * 🔴 THIS IS THE ONE PROBE THAT MAKES P3 SAFE TO ADOPT, AND IT IS THE REASON THE KIT DOES NOT SHIP
 *    WIRED. `loadList.ts` already computes every install quantity LAWNS needs, under [[R-155]] and
 *    ledger #343, and it is the printed sheet the yard actually loads from. A configurable kit is only
 *    an improvement if it produces THE SAME NUMBERS from the same facts. Until that is proven, the
 *    kit is a second opinion, and a second opinion about what goes on a trailer is worse than none.
 *
 *    So: one stop is driven through the REAL `buildLoadList`, its OUTPUT is handed to `evaluateKit`,
 *    and the two are compared field by field. **Nothing here re-implements either side.**
 *
 * ⚠️ WHAT THIS DOES *NOT* PROVE, stated so nobody reads more into a green than it carries: it does not
 *    prove the kit is WIRED (it is not — `loadList.ts` is untouched, and the load list is frozen until
 *    crew-link's merge lands), and it does not prove the arithmetic is RIGHT — `loadList.test.ts` owns
 *    that. It proves the two AGREE, which is the only question adoption turns on.
 *
 * Run:  node_modules/.bin/esbuild packages/cultivar-os/src/lib/installKitEquivalence.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { buildLoadList, type LoadStopInput, type LoadListSettings } from './loadList';
import type { StopOrderItem } from './stopLoad';
import type { Ladder, Rung } from '@trace/shared/inventory';
import { evaluateKit, type KitComponent, type StopKitFacts } from '@trace/shared/inventory';
import { OPERATIONS_DEFAULTS } from '@trace/shared/production';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── LAWNS's live ladder, 2026-09-16 — the same fixture loadList.test.ts uses ─────────────────
const rung = (label: string, sortOrder: number, volumeGallons: number | null, posts: number,
              aliases: string[] = [], active = true): Rung => ({
  label, aliases, sortOrder, volumeGallons,
  handlingMinutes: null, handlingBecause: 'not timed', installTPostsPerTree: posts,
  installTPostsBecause: 'LAWNS, David 2026-09-12', caliperMinInches: null, caliperMaxInches: null,
  caliperBecause: 'not set', installPrice: null, installPriceBecause: 'not set',
  pytPrice: null, pytPriceBecause: 'not set', growMonths: null, growBecause: 'not set',
  holdMonths: null, holdBecause: 'not set', sellability: 'sold' as const,
  sellabilityBecause: 'not set', active,
});
const LAWNS: Ladder = [
  rung('slip', 10, null, 0, ['slips']), rung('4 in', 20, null, 0, ['4"']),
  rung('3/5 gal', 30, 4, 0, ['#3/5']), rung('15 gal', 40, 15, 2), rung('30 gal', 50, 30, 2),
  rung('45 gal', 60, 45, 2), rung('65 gal', 70, 65, 2),
  rung('95/100', 80, 95, 4, ['95 gal']), rung('200 gal', 90, 200, 4),
];
const SETTINGS: LoadListSettings = { ladder: LAWNS, ops: OPERATIONS_DEFAULTS };

const line = (quantity: number, description: string | null, lot?: { name: string; size: string | null }): StopOrderItem => ({
  order_id: 'o1', quantity, description, sku: null,
  business_inventory_id: lot ? 'lot-1' : null,
  business_inventory: lot ? { name: lot.name, size: lot.size } : null,
});
const stop = (items: StopOrderItem[], over: Partial<LoadStopInput> = {}): LoadStopInput => ({
  stopId: 's1', customerName: 'A Customer', address: '1 Somewhere', serviceType: 'planting',
  orderId: 'o1', canReadLines: true, linesRead: true, items, deerFence: null, ...over,
});

/**
 * 🔴 THE KIT IS BUILT FROM THE SAME OPERATIONS KEYS THE LOAD LIST READS, AND THAT IS THE POINT.
 * If the kit carried its own numbers, equivalence would prove only that two constants match. Taking
 * the factors FROM `OPERATIONS_DEFAULTS` means this probe fails the moment the kit's meaning drifts
 * from the config the load list uses — which is the drift worth catching (STD-011).
 */
const KIT: KitComponent[] = [
  { componentKey: 'special_mix', label: 'Special planting mix', qbItemId: '52',
    rule: 'per_container_gallon', factor: OPERATIONS_DEFAULTS.installMixContainerVolumesPerTree,
    unit: 'gal', because: 'from installMixContainerVolumesPerTree', active: true },
  { componentKey: 't_post', label: 'T-post', qbItemId: '200',
    rule: 'per_rung', factor: null, unit: 'each', because: 'the rung says how many', active: true },
  { componentKey: 'rope', label: 'Rope', qbItemId: '201',
    rule: 'per_t_post', factor: OPERATIONS_DEFAULTS.ropeFeetPerTPost,
    unit: 'ft', because: 'from ropeFeetPerTPost', active: true },
  { componentKey: 'water_monitor', label: 'Water monitor kit', qbItemId: '102',
    rule: 'only_if_ordered', factor: 1, unit: 'each', because: 'one per installed tree', active: true },
  { componentKey: 'bubbler', label: 'Tree bubbler', qbItemId: '121',
    rule: 'only_if_ordered', factor: 1, unit: 'each', because: 'billed lines only', active: true },
  { componentKey: 'trunk_protection', label: 'Trunk protection', qbItemId: '301',
    rule: 'only_if_marked', factor: 1, unit: 'each', because: 'marked lines only', active: true },
];

/** Turn ONE of the load list's own stops into the facts the evaluator takes. No re-derivation. */
function factsFrom(model: ReturnType<typeof buildLoadList>, i = 0): StopKitFacts {
  const s = model.stops[i];
  return {
    trees: s.trees.map(t => ({ quantity: t.quantity, gallons: t.gallons, tPosts: t.tPosts, rungLabel: t.rungLabel })),
    bubblers: s.bubblers,
    waterMonitors: s.waterMonitors,
    trunkProtection: s.trunkProtection,
    deerFencePosts: s.deerFencePosts,
    deerFence: s.deerFence,
    deerFenceFeet: null,
    isInstall: s.installs,
  };
}
const qty = (e: ReturnType<typeof evaluateKit>, k: string) => e.lines.find(l => l.componentKey === k)?.quantity ?? null;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// A · ONE INSTALL STOP: the kit reproduces the load list's mix, posts and rope exactly
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const m = buildLoadList('2026-10-03', [stop(
    [line(2, 'Live Oak 45 gallon', { name: 'Live Oak', size: '45 gal' }),
     line(3, 'Cedar Elm 15 gallon', { name: 'Cedar Elm', size: '15 gal' })],
    { installs: true })], SETTINGS);
  const s = m.stops[0];
  const e = evaluateKit(KIT, factsFrom(m));

  ok(qty(e, 'special_mix') === s.mixGallons,
    `A1 MIX AGREES: the kit says ${qty(e, 'special_mix')} gal and the load list says ${s.mixGallons} gal`);
  ok(qty(e, 't_post') === s.tPosts + s.deerFencePosts,
    `A2 T-POSTS AGREE: ${qty(e, 't_post')} vs the load list's ${s.tPosts} (+${s.deerFencePosts} fence)`);
  ok(qty(e, 'rope') === (s.tPosts + s.deerFencePosts) * OPERATIONS_DEFAULTS.ropeFeetPerTPost,
    `A3 ROPE AGREES: ${qty(e, 'rope')} ft — posts × ropeFeetPerTPost, the same arithmetic the day total uses`);
  ok(qty(e, 'water_monitor') === s.waterMonitors,
    `A4 WATER MONITORS AGREE: ${qty(e, 'water_monitor')} vs ${s.waterMonitors}`);
  ok(qty(e, 'bubbler') === s.bubblers,
    `A5 BUBBLERS AGREE: ${qty(e, 'bubbler')} vs ${s.bubblers} — and 0 is a real answer on both sides`);
  ok(qty(e, 'trunk_protection') === s.trunkProtection,
    `A6 TRUNK PROTECTION AGREES: ${qty(e, 'trunk_protection')} vs ${s.trunkProtection}`);

  // 2×45 + 3×15 = 135 container gallons × 2.0 = 270 gal. Stated so the figure is not just "equal".
  ok(s.mixGallons === 270 && qty(e, 'special_mix') === 270,
    'A7 and the shared figure is the RIGHT one: 135 container gallons × 2.0 = 270 gal');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// B · A DELIVERY-ONLY STOP: the load list still lists the trees, and the kit consumes nothing
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const m = buildLoadList('2026-10-03', [stop(
    [line(2, 'Live Oak 45 gallon', { name: 'Live Oak', size: '45 gal' })],
    { installs: false })], SETTINGS);
  const e = evaluateKit(KIT, factsFrom(m));
  ok(m.stops[0].treeCount === 2, 'B1 the load list still counts the trees on a delivery-only stop');
  ok(e.lines.length === 0 && e.issuable,
    'B2 and the kit consumes NOTHING there, which is a complete answer (David, 2026-09-25)');
  // ✏️ **B3 ASSERTED A DISAGREEMENT AND NOW ASSERTS AGREEMENT — REWRITTEN 2026-09-26 (ledger #416).**
  // It used to read: *"the load list still PRINTS N gal of mix for the stop… but nothing is ISSUED from
  // stock for a delivery. Printing and consuming are different questions."* That was an honest record of
  // a real divergence, and **it is what found tech-debt #364.** David then ruled (2026-09-25/26) that
  // install materials go ONLY on install stops, so the sheet no longer prints them either — and the two
  // sides now agree. **The probe is edited rather than deleted, because what changed is the platform's
  // behaviour, not the question the probe was asking.**
  ok(m.stops[0].mixGallons === 0 && qty(e, 'special_mix') === null,
    'B3 🔴 THE TWO NOW AGREE ON A DELIVERY-ONLY STOP: the sheet prints NO mix (it used to print it — tech-debt #364, ruled and fixed) and the kit issues none');
  ok(m.stops[0].treeCount === 2,
    'B4 and both still carry the TREES — it is the materials that stay behind, not the trees');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// C · A RUNG WITH NO VOLUME: both sides refuse to count it, and neither pretends it is zero
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const m = buildLoadList('2026-10-03', [stop(
    [line(2, 'Live Oak 45 gallon', { name: 'Live Oak', size: '45 gal' }),
     line(4, 'Yaupon slip', { name: 'Yaupon', size: 'slip' })],
    { installs: true })], SETTINGS);
  const s = m.stops[0];
  const e = evaluateKit(KIT, factsFrom(m));
  ok(qty(e, 'special_mix') === s.mixGallons,
    `C1 the sized trees' mix still AGREES (${qty(e, 'special_mix')} gal) with the slips present`);
  ok(e.incomplete.some(l => l.componentKey === 'special_mix'),
    'C2 and the kit marks the mix line INCOMPLETE, naming the slips that could not be counted');
  ok(!e.issuable,
    'C3 so the stop is not issuable — issuing the sized figure as the whole answer is the defect both sides exist to avoid');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// D · A WHOLE DAY: the kit summed per stop equals the load list's day totals
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const m = buildLoadList('2026-10-03', [
    stop([line(2, 'Live Oak 45 gallon', { name: 'Live Oak', size: '45 gal' })], { stopId: 's1', installs: true }),
    stop([line(1, 'Cedar Elm 95 gallon', { name: 'Cedar Elm', size: '95 gal' })], { stopId: 's2', installs: true }),
    stop([line(3, 'Yaupon 15 gallon', { name: 'Yaupon', size: '15 gal' })], { stopId: 's3', installs: true }),
  ], SETTINGS);

  let mix = 0, posts = 0, rope = 0;
  for (let i = 0; i < m.stops.length; i++) {
    const e = evaluateKit(KIT, factsFrom(m, i));
    mix += qty(e, 'special_mix') ?? 0;
    posts += qty(e, 't_post') ?? 0;
    rope += qty(e, 'rope') ?? 0;
  }
  ok(mix === m.mixGallons, `D1 the day's MIX agrees: ${mix} gal summed per stop vs ${m.mixGallons} on the sheet`);
  ok(posts === m.tPosts + m.deerFencePosts, `D2 the day's T-POSTS agree: ${posts} vs ${m.tPosts}+${m.deerFencePosts}`);
  ok(rope === m.ropeFeet, `D3 the day's ROPE agrees: ${rope} ft vs the sheet's ${m.ropeFeet} ft`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// E · THE PROBE COULD HAVE FAILED — a deliberately wrong factor must break equivalence (§6 r19)
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const m = buildLoadList('2026-10-03', [stop(
    [line(2, 'Live Oak 45 gallon', { name: 'Live Oak', size: '45 gal' })], { installs: true })], SETTINGS);
  const wrong = KIT.map(k => k.componentKey === 'special_mix' ? { ...k, factor: 1 } : k);
  const e = evaluateKit(wrong, factsFrom(m));
  ok(qty(e, 'special_mix') !== m.stops[0].mixGallons,
    'E1 a kit carrying the OLD 1.0 mix ratio DISAGREES with the load list — so these probes can fail, and a green means something');
  const wrongRope = KIT.map(k => k.componentKey === 'rope' ? { ...k, factor: 3 } : k);
  ok(qty(evaluateKit(wrongRope, factsFrom(m)), 'rope') !== m.ropeFeet,
    'E2 and so does a wrong rope factor');
}

console.log(`\ninstallKitEquivalence: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
