/**
 * ── measure-load-list-mutants — would the yard person notice? ─────────────────────────────────
 *
 * PURPOSE:      Every mutant below produces a load list that PRINTS PERFECTLY and is wrong on the
 *               trailer. That is the whole hazard class of this page: there is no error state, no
 *               red text, no stack trace — just a number a person loads against. A short mix line
 *               is a second trip; a silently dropped stop is a customer with no tree.
 *
 * 🔴 THE MUTANTS THAT MATTER ARE THE OMISSIONS (§C). David's rule for this build is that the page
 *               may never silently omit something it could not compute — *"blank is
 *               indistinguishable from zero"* — so the probes that must never survive are the ones
 *               that make an unresolved line, a withheld stop or an out-of-ladder tree QUIETLY
 *               DISAPPEAR. Each of those mutants makes the page look tidier and read as complete.
 *
 * 🔴 THE PROBES WERE WRITTEN ALONGSIDE THE CODE, SO THEIR FIRST GREEN RUN PROVED NOTHING (§6 r19).
 *               This is where they are made to refuse.
 *
 * ⚠️ P1 EXISTS TO PROVE THE PROBES REACH THE PAGE AND NOT ONLY THE MODEL (tech-debt #182 — "a
 *               harness that cannot reach its target reports the same as one that passed").
 *
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * Run: node scripts/measure-load-list-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

const LIB   = 'packages/cultivar-os/src/lib/loadList.ts';
const PAGE  = 'packages/cultivar-os/src/pages/LoadList.tsx';
const SUITE = 'packages/cultivar-os/src/lib/loadList.test.ts';
const PAGE_SUITE = 'packages/cultivar-os/src/lib/loadListPage.test.ts';

function suiteIsGreen(suite) {
  try {
    execSync(`set -o pipefail; "${ESB}" "${suite}" --bundle --platform=node --format=cjs --log-level=error --external:node:fs | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  // ══ §A THE BILL OF MATERIALS — David's numbers, not the cost model's ══════════════════
  { id: 'A1', target: LIB,
    why: '🔴 THE 0.7 MIX RATIO RETURNS — every load on every day is ~30% short of mix and the page states the shortfall as a fact ([[R-155]])',
    from: '  mixContainerVolumesPerTree: 1.0,',
    to:   '  mixContainerVolumesPerTree: 0.7,' },
  { id: 'A1b', target: LIB,
    why: '🔴🔴 THE RATIO SPLITS IN TWO — a costing ratio and a loading ratio, which is exactly the shape [[R-155]] REMOVED (*"One key or none"*). The load list still prints 1.0 and reads perfectly; the second key is what a cost model would pick up, and the two drift apart with nothing comparing them (STD-011).',
    from: '  mixContainerVolumesPerTree: 1.0,',
    to:   '  mixContainerVolumesPerTree: 1.0,\n  mixRatioCosting: 0.7,\n  mixRatioLoading: 1.0,' },
  { id: 'A1c', target: LIB,
    why: '🔴 THE TWO 0.7s ARE MERGED — the BOM reads `tradeGallonFactor`, folding a POT measurement (trade gallons vs true gallons, owned by the uppot model) into a MIX RECIPE. Both numbers were 0.7 by coincidence, which is what makes this look like a tidy-up.',
    from: "import type { StopOrderItem } from './stopLoad';",
    to:   "import type { StopOrderItem } from './stopLoad';\nconst tradeGallonFactor = 0.7; void tradeGallonFactor;" },
  { id: 'A2', target: LIB,
    why: '🔴 a big tree drops to 2 T-posts — the biggest trees on the trailer arrive with half the stakes they need',
    from: '  tPostsAboveThreshold: 4,',
    to:   '  tPostsAboveThreshold: 2,' },
  { id: 'A2b', target: LIB,
    why: '🔴 the threshold slides to 95, so a 95 gallon reads 2 — David set the boundary at 65 INCLUSIVE and the off-by-one is invisible on paper',
    from: '  tPostsSmallThresholdGallons: 65,',
    to:   '  tPostsSmallThresholdGallons: 95,' },
  { id: 'A2c', target: LIB,
    why: '🔴 the boundary becomes EXCLUSIVE — a 65 gallon tree jumps to 4 posts, the other side of the same off-by-one',
    from: '  return gallons <= BOM_RULES.tPostsSmallThresholdGallons',
    to:   '  return gallons < BOM_RULES.tPostsSmallThresholdGallons' },
  { id: 'A2d', target: LIB,
    why: '🔴🔴 THE FIVE-ROW TABLE RETURNS — the exact defect David corrected. 15/30/45/65/95 answer and a 200 gallon Live Oak falls off the end into a hand-work note on a printed page.',
    from: '  return gallons <= BOM_RULES.tPostsSmallThresholdGallons\n    ? BOM_RULES.tPostsAtOrBelowThreshold\n    : BOM_RULES.tPostsAboveThreshold;',
    to:   '  const TABLE = { 15: 2, 30: 2, 45: 2, 65: 2, 95: 4 };\n  return TABLE[gallons] ?? 2;' },
  { id: 'A3', target: LIB,
    why: 'rope drops to 3 ft per post — short on every tree, and nothing on the page contradicts it',
    from: '  ropeFeetPerTPost: 4,',
    to:   '  ropeFeetPerTPost: 3,' },
  { id: 'A4', target: LIB,
    why: 'the yards conversion uses the round-number 200 instead of the cubic-inch definition — a wrong constant is invisible on paper',
    from: 'export const GALLONS_PER_CUBIC_YARD = 46656 / 231;',
    to:   'export const GALLONS_PER_CUBIC_YARD = 200;' },
  { id: 'A5', target: LIB,
    why: '🔴 the mix rounds DOWN instead of up — David ruled "err large, do not skimp", and rounding down runs the crew out on the last tree',
    from: '    mixYards: Math.ceil((mixGallons / GALLONS_PER_CUBIC_YARD) * 2) / 2,',
    to:   '    mixYards: Math.floor((mixGallons / GALLONS_PER_CUBIC_YARD) * 2) / 2,' },
  { id: 'A6', target: LIB,
    why: '⚠️ a mulch line returns to the model — materials that are never bought, which is exactly what the install cost model gets wrong (tech-debt #299)',
    from: '  bubblersPerTree: 1,',
    to:   '  bubblersPerTree: 1,\n  mulchBagsPerTree: 2,' },

  // ══ §B READING A LINE — the confident wrong answer ════════════════════════════════════
  { id: 'B1', target: LIB,
    why: '🔴 THE SKU BECOMES A SIZE FALLBACK — the tempting shortcut. TSK2 (a T-post COUNT) becomes a 2 gallon tree and MT10002 becomes a 10,002 gallon container',
    from: '  const read = readProductFromDescription(item.description);',
    to:   '  const skuDigits = sku ? Number((/(\\d+)/.exec(sku) ?? [])[1]) : NaN;\n  if (!Number.isNaN(skuDigits)) return { quantity, name: item.description ?? sku ?? "?", sizeText: `${skuDigits} gallon`, gallons: skuDigits, kind: "tree", reason: null, sku, unreadText: null };\n  const read = readProductFromDescription(item.description);' },
  { id: 'B2', target: LIB,
    why: '🔴 a size the parser DECLINED is silently treated as "no size stated" — an unreadable size becomes an ordinary fee line and stops being flagged',
    from: "    if (sizeText) {\n      return { ...base, gallons: null, kind: 'unresolved', unreadText: sizeText,",
    to:   "    if (false) {\n      return { ...base, gallons: null, kind: 'unresolved', unreadText: sizeText," },
  { id: 'B3', target: LIB,
    why: '🔴 a size RANGE collapses to its low end — "#3/5" loads as a 3 gallon and the mix and posts are computed off a size that may not be on the truck',
    from: '  if (parsed.kind === \'container\' && parsed.unit === \'gallon\' && parsed.valueMax != null) {',
    to:   '  if (false) {' },
  { id: 'B4', target: LIB,
    why: 'a 50 lb bag is counted as a tree — weight is read as a container, so fertiliser earns mix, stakes and a bubbler',
    from: "  if (parsed.kind === 'container' && parsed.unit === 'gallon' && parsed.value != null) {",
    to:   '  if (parsed.value != null) {' },
  { id: 'B5', target: LIB,
    why: 'the lot\'s own size column stops being read — every checkout line falls through to its (absent) description and resolves as unnamed',
    from: '    const parsed = lotSize ? parseUnitOfMeasure(lotSize) : null;',
    to:   '    const parsed = null;' },
  { id: 'B6', target: LIB,
    why: '⚠️ the size is normalised before display — "45 Gallon" is rewritten, and the yard person is matching against what is printed on the tag (D-23)',
    from: '  return `${name.toLowerCase().replace(/\\s+/g, \' \').trim()}|${normalizeSize(sizeText).toLowerCase()}`;',
    to:   '  return `${name}|${sizeText}`;' },

  // ══ 🔴 §C THE OMISSIONS — the class this whole build exists to prevent ════════════════
  { id: 'C1', target: LIB,
    why: '🔴🔴 AN UNRESOLVED LINE IS FILTERED OFF THE PAGE — the tidiest-looking mutant here, and the one David named: a blank the yard person reads as a zero',
    from: "  const unresolved = allItems.filter(i => i.kind === 'unresolved');",
    to:   '  const unresolved = [];' },
  { id: 'C2', target: LIB,
    why: '🔴🔴 THE LADDER GROWS AN UPPER BOUND — anything over 95 gallon returns to a hand-work case, which is precisely what David removed. The page looks careful and the biggest tree on the trailer is uncounted.',
    from: '  return gallons <= BOM_RULES.tPostsSmallThresholdGallons\n    ? BOM_RULES.tPostsAtOrBelowThreshold\n    : BOM_RULES.tPostsAboveThreshold;',
    to:   '  if (gallons > 95) return 0;\n  return gallons <= BOM_RULES.tPostsSmallThresholdGallons\n    ? BOM_RULES.tPostsAtOrBelowThreshold\n    : BOM_RULES.tPostsAboveThreshold;' },
  { id: 'C2b', target: LIB,
    why: '🔴 the special mix stops applying above 95 gallon — a 200 gallon tree arrives with no mix at all, and the yards line still reads like a complete answer',
    from: '  const mixGallons = trees.reduce((n, t) => n + t.gallons * t.quantity * BOM_RULES.mixContainerVolumesPerTree, 0);\n  const tPosts = trees.reduce((n, t) => n + t.tPosts * t.quantity, 0);\n  const unresolved',
    to:   '  const mixGallons = trees.reduce((n, t) => n + (t.gallons > 95 ? 0 : t.gallons) * t.quantity * BOM_RULES.mixContainerVolumesPerTree, 0);\n  const tPosts = trees.reduce((n, t) => n + t.tPosts * t.quantity, 0);\n  const unresolved' },
  { id: 'C3', target: LIB,
    why: '🔴 the FLOOR warning never fires — the totals present themselves as complete while a line nobody could read sits on the paperwork',
    from: '    totalsAreFloors: unresolved.length > 0 || unreadStops > 0,',
    to:   '    totalsAreFloors: false,' },
  { id: 'C3b', target: LIB,
    why: '🔴 an unreadable STOP stops raising the floor — only unreadable LINES do, so a whole withheld order reads as a complete day',
    from: '    totalsAreFloors: unresolved.length > 0 || unreadStops > 0,',
    to:   '    totalsAreFloors: unresolved.length > 0,' },
  { id: 'C4', target: LIB,
    why: '🔴 A WITHHELD ORDER READS AS AN EMPTY ONE — a fact about the VIEWER printed as a fact about the business, and the stop looks like it needs nothing',
    from: "      : !s.canReadLines ? 'You do not have permission to see what is on this order.'",
    to:   "      : !s.canReadLines ? 'No items are recorded on this order.'" },
  { id: 'C5', target: LIB,
    why: '🔴 A FAILED READ READS AS AN EMPTY ORDER — absent is not empty (D-9 / A9), and on paper the difference is a customer with no tree',
    from: "      : !s.linesRead    ? 'We could not read what is on this order — this stop may need more than is listed.'",
    to:   "      : !s.linesRead    ? 'No items are recorded on this order.'" },
  { id: 'C6', target: LIB,
    why: '🔴🔴 A STOP WITH NOTHING ON IT IS DROPPED FROM THE DAY — six stops print as five, nothing on the page is wrong, and there is just less of it',
    from: '  for (const s of input) {',
    to:   '  for (const s of input.filter(x => x.items.length > 0)) {' },
  { id: 'C7', target: LIB,
    why: '🔴 the unread-stop count stops being kept, so the header can no longer warn that the list may be short',
    from: '    if (problem && s.orderId && (!s.canReadLines || !s.linesRead)) unreadStops++;',
    to:   '    // not counted' },
  { id: 'C8', target: LIB,
    why: '🔴 the "no container size" lines are filtered away — Trip Charge, Trunk Protection and a bubbler line vanish, which is the word-matching rule R-144 forbids',
    from: "    noSizeStated: allItems.filter(i => i.kind === 'no_size_stated'),",
    to:   '    noSizeStated: [],' },
  { id: 'C9', target: LIB,
    why: '⚠️ the deer-fence gap sentence stops saying nothing is recorded — silence on a printout reads as "none needed"',
    from: "    'DEER FENCE — nothing recorded. Nothing in the system marks which stops need deer fence, so none is counted above. '",
    to:   "    'DEER FENCE. '" },
  { id: 'C10', target: LIB,
    why: '⚠️ the open 95 gallon question is answered by assumption instead of printed as open',
    from: "    'At 95 gallon and above a tree already has 4 T-posts — whether deer fence needs 4 more or reuses them is not settled. Ask before loading.',",
    to:   "    'At 95 gallon and above a tree already has 4 T-posts, so deer fence needs no more.'," },

  // ══ §D CONSOLIDATION — the headline the yard person actually reads ════════════════════
  { id: 'D1', target: LIB,
    why: 'two identical trees stop consolidating — "Live Oak 45 gallon ×1" twice instead of ×2, and a person counting rows loads the wrong number',
    from: '    if (existing) { existing.quantity += it.quantity; continue; }',
    to:   '    if (existing) { continue; }' },
  { id: 'D2', target: LIB,
    why: '🔴 the per-tree quantity is ignored in the totals — an order for 6 Eagleston Hollies contributes one tree\'s worth of mix, posts and bubblers',
    from: '  const treeCount = trees.reduce((n, t) => n + t.quantity, 0);\n  const mixGallons = trees.reduce((n, t) => n + t.gallons * t.quantity * BOM_RULES.mixContainerVolumesPerTree, 0);\n  const tPosts = trees.reduce((n, t) => n + t.tPosts * t.quantity, 0);',
    to:   '  const treeCount = trees.length;\n  const mixGallons = trees.reduce((n, t) => n + t.gallons * BOM_RULES.mixContainerVolumesPerTree, 0);\n  const tPosts = trees.reduce((n, t) => n + t.tPosts, 0);' },
  { id: 'D3', target: LIB,
    why: 'the consolidated list stops being ordered biggest-first, so the exceptions stop sitting where they are easiest to see',
    from: '  return [...by.values()].sort((a, b) => b.gallons - a.gallons || a.name.localeCompare(b.name));',
    to:   '  return [...by.values()];' },
  { id: 'D4', target: LIB,
    why: '🔴 a stop stops carrying its OWN totals and only the day\'s exist — which is precisely what breaks when a stop gets dropped',
    from: '      mixGallons, tPosts, unresolvedCount,',
    to:   '      mixGallons: 0, tPosts: 0, unresolvedCount: 0,' },

  // ══ §H THE RING — the T-post table's defect, one quantity over ([[R-156]]) ════════════
  { id: 'H1', target: LIB,
    why: '🔴 an anchor moves — 95 gallon reads 10 ft instead of 12. Every fence figure on the page is short and nothing contradicts it.',
    from: "  { gallons: 95, diameterFeet: 12 },",
    to:   "  { gallons: 95, diameterFeet: 10 }," },
  { id: 'H2', target: LIB,
    why: '🔴🔴 THE TABLE RETURNS, ONE QUANTITY OVER — a five-row ring lookup. The 200 gallon Live Oak resolves to 0 ft of fence, and **a zero beside a quantity heading reads as "none needed"**. This is the T-post defect David corrected, repeated in the ring.',
    from: '  const g = gallons > 0 ? gallons : 0;\n  return RING_FIT.a * Math.sqrt(g) + RING_FIT.b;',
    to:   '  const RING_TABLE = { 15: 5, 30: 7, 45: 8, 65: 10, 95: 12 };\n  return RING_TABLE[gallons] ?? 0;' },
  { id: 'H3', target: LIB,
    why: '🔴 THE CURVE GOES LINEAR — the square root is dropped. Exact at neither anchor and wildly over-orders fence at the big end, which is the reason David gave a square root at all.',
    from: '  return RING_FIT.a * Math.sqrt(g) + RING_FIT.b;',
    to:   '  return RING_FIT.a * g + RING_FIT.b;' },
  { id: 'H4', target: LIB,
    why: '🔴 the fit is pinned to ONE anchor instead of fitted THROUGH both — `d = k√g` off the 15 gallon figure. It is exact at 15, reads 12.58 ft at 95 against an anchor of 12, and the anchors stop being parameters.',
    from: '  const a = (hi.diameterFeet - lo.diameterFeet) / (Math.sqrt(hi.gallons) - Math.sqrt(lo.gallons));\n  return { a, b: lo.diameterFeet - a * Math.sqrt(lo.gallons) };',
    to:   '  void hi;\n  return { a: lo.diameterFeet / Math.sqrt(lo.gallons), b: 0 };' },
  { id: 'H5', target: LIB,
    why: '🔴 fence becomes the DIAMETER rather than the circumference — every roll ordered is ~3× short, and the number still looks like feet of fence.',
    from: '  return Math.PI * ringDiameterFeet(gallons);',
    to:   '  return ringDiameterFeet(gallons);' },
  { id: 'H6', target: LIB,
    why: '🔴 the tree row stops carrying its ring — the page would have to re-derive one, which is the D4 rule this build refuses.',
    from: '      ringDiameterFeet: ringDiameterFeet(it.gallons),',
    to:   '      ringDiameterFeet: 0,' },

  // ══ ⚠️ §P REACH — do the probes see the PAGE, or only the model? ══════════════════════
  { id: 'P1', target: PAGE,
    why: '⚠️ REACH, NOT SUBJECT — the page stops rendering the unresolved block entirely. EVERY mutant above is caught by the model suite and this one is EXPECTED TO SURVIVE it, which is how we know the .tsx is unprobed (tech-debt #182). It is caught by loadListPage.test.ts instead.',
    from: '              {model.unresolved.length > 0 ? (',
    to:   '              {false ? (' },
];

const files = [...new Set(MUTANTS.map(m => m.target))];
const originals = new Map(files.map(f => [f, readFileSync(ROOT + f, 'utf8')]));
let caught = 0, survived = 0, errored = 0;
const survivors = [];

try {
  process.stdout.write(`  CONTROL ${SUITE.split('/').pop().padEnd(22)} … `);
  if (!suiteIsGreen(SUITE)) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
  console.log('GREEN ✓\n');

  for (const m of MUTANTS) {
    const original = originals.get(m.target);
    if (!original.includes(m.from)) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in ${m.target.split('/').pop()} — mutant never applied`);
      errored++; continue;
    }
    writeFileSync(ROOT + m.target, original.replace(m.from, m.to));
    const green = suiteIsGreen(SUITE);
    writeFileSync(ROOT + m.target, original);
    if (green) { console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); survived++; survivors.push(m.id); }
    else       { console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); caught++; }
  }
} finally {
  for (const [f, src] of originals) writeFileSync(ROOT + f, src);
}

// P1 is the declared reach control: it MUST survive the model suite, and it MUST be caught by the
// page suite. Anything else surviving is a real hole.
// 🔴 P1 IS THE REACH CONTROL AND IT IS PROVEN IN BOTH DIRECTIONS, NOT ASSERTED. It must SURVIVE
// the model suite (which is how we know the .tsx is unprobed there — tech-debt #182) and it must
// be CAUGHT by the page suite. A control that is only ever expected to survive measures nothing.
const EXPECTED_SURVIVORS = ['P1'];
const realSurvivors = survivors.filter(id => !EXPECTED_SURVIVORS.includes(id));
const missingExpected = EXPECTED_SURVIVORS.filter(id => !survivors.includes(id));

// The other half of the reach control: re-apply P1 and prove the PAGE suite refuses it.
let reachProven = true;
{
  const m = MUTANTS.find(x => x.id === 'P1');
  const original = originals.get(m.target);
  try {
    writeFileSync(ROOT + m.target, original.replace(m.from, m.to));
    reachProven = !suiteIsGreen(PAGE_SUITE);
  } finally { writeFileSync(ROOT + m.target, original); }
  console.log(`\n  P1 against ${PAGE_SUITE.split('/').pop()} … ${reachProven ? 'CAUGHT ✓  the page suite DOES reach the .tsx' : '🔴 SURVIVED — the page suite reaches nothing either'}`);
}

console.log(`\n  ── ${caught}/${caught + survived} caught · ${survived} survived (${EXPECTED_SURVIVORS.join(', ')} expected) · ${errored} never applied ──`);
if (missingExpected.length) console.log(`  🔴 ${missingExpected.join(', ')} was expected to survive the MODEL suite and did not — the reach control no longer measures anything.`);
if (realSurvivors.length)   console.log(`  🔴 real survivors: ${realSurvivors.join(', ')}`);
console.log('');
process.exit(realSurvivors.length > 0 || missingExpected.length > 0 || errored > 0 || !reachProven ? 1 : 0);
