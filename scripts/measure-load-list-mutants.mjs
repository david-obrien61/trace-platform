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
  // ✏️ REWRITTEN 2026-09-16 (ledger #343). The model no longer holds BOM_RULES, a threshold or a
  // parser of its own: T-posts are read off the RUNG, the ratios off Operations config, and every
  // size goes through `resolveRung`. The mutants below attack THOSE seams — each one prints a
  // perfectly tidy page that is wrong on the trailer.

  // ══ §A THE FIGURES — config and rung, never a constant ════════════════════════════════
  { id: 'A1', target: LIB,
    why: '🔴 THE 1.0 MIX RATIO RETURNS AS A CONSTANT — the stored 2.0 is ignored and every load is half the mix it needs (David, 2026-09-15)',
    from: '      mixGallonsPerTree: v == null ? null : v * s.ops.installMixContainerVolumesPerTree,',
    to:   '      mixGallonsPerTree: v == null ? null : v * 1,' },
  { id: 'A1b', target: LIB,
    why: '🔴🔴 THE RATIO SPLITS IN TWO — a costing and a loading ratio, the shape [[R-155]] REMOVED (*"One key or none"*)',
    from: 'export interface LoadListSettings {',
    to:   'export interface LoadListSettings {\n  mixRatioCosting?: number;\n  mixRatioLoading?: number;' },
  { id: 'A1c', target: LIB,
    why: '🔴 THE TWO 0.7s ARE MERGED — the BOM reads `tradeGallonFactor`, folding a POT measurement into a MIX RECIPE',
    from: "import type { StopOrderItem } from './stopLoad';",
    to:   "import type { StopOrderItem } from './stopLoad';\nconst tradeGallonFactor = 0.7; void tradeGallonFactor;" },
  { id: 'A2', target: LIB,
    why: '🔴🔴 THE THRESHOLD RETURNS — posts computed from gallons again (≤65 → 2, else 4), ignoring the rung. Right on LAWNS today, wrong the day anyone edits a rung, which is the whole point of the ladder.',
    from: '      tPosts: it.rung.installTPostsPerTree,',
    to:   '      tPosts: (v ?? 0) <= 65 ? 2 : 4,' },
  { id: 'A2b', target: LIB,
    why: '🔴 every tree gets 2 posts — the biggest trees on the trailer arrive with half the stakes they need',
    from: '      tPosts: it.rung.installTPostsPerTree,',
    to:   '      tPosts: 2,' },
  { id: 'A3', target: LIB,
    why: 'rope ignores the stored figure and uses 4 — a nursery that set 5 ft loads short, and the page says 4',
    from: '    ropeFeet: day.tPosts * settings.ops.ropeFeetPerTPost,',
    to:   '    ropeFeet: day.tPosts * 4,' },
  { id: 'A3b', target: LIB,
    why: 'bubblers ignore the stored figure and use 1',
    from: '    bubblers: day.treeCount * settings.ops.bubblersPerTree,',
    to:   '    bubblers: day.treeCount * 1,' },
  { id: 'A4', target: LIB,
    why: 'the yards conversion ignores the configured figure and uses a round 200 — a wrong constant is invisible on paper',
    from: '  return Math.ceil((gallons / s.ops.trueGallonsPerCubicYard) * 2) / 2;',
    to:   '  return Math.ceil((gallons / 200) * 2) / 2;' },
  { id: 'A5', target: LIB,
    why: '🔴 the mix rounds DOWN instead of up — David ruled "err large, do not skimp"',
    from: '  return Math.ceil((gallons / s.ops.trueGallonsPerCubicYard) * 2) / 2;',
    to:   '  return Math.floor((gallons / s.ops.trueGallonsPerCubicYard) * 2) / 2;' },
  { id: 'A6', target: LIB,
    why: '⚠️ a mulch line returns to the model — materials that are never bought (tech-debt #299)',
    from: '      ropeFeetPerTPost: settings.ops.ropeFeetPerTPost,',
    to:   '      ropeFeetPerTPost: settings.ops.ropeFeetPerTPost,\n      mulchBagsPerTree: 2,' },
  { id: 'A7', target: LIB,
    why: '🔴🔴 THE VOLUME IS READ OUT OF THE SIZE TEXT AGAIN — "3/5 Gallon" becomes 3 instead of the rung\'s 4. Exactly the second size parser David ruled out.',
    from: '    return { ...base, rung: r.rung, gallons: r.rung.volumeGallons, kind: \'tree\', reason: null };',
    to:   '    return { ...base, rung: { ...r.rung, volumeGallons: parseFloat(sizeText) }, gallons: parseFloat(sizeText), kind: \'tree\', reason: null };' },

  // ══ §B READING A LINE — the confident wrong answer ════════════════════════════════════
  { id: 'B1', target: LIB,
    why: '🔴 THE SKU BECOMES A SIZE FALLBACK — TSK2 (a T-post COUNT) becomes a 2 gallon tree',
    from: '  const read = readProductFromDescription(item.description);',
    to:   '  const skuDigits = sku ? Number((/(\\d+)/.exec(sku) ?? [])[1]) : NaN;\n  if (!Number.isNaN(skuDigits)) return { quantity, name: item.description ?? sku ?? "?", sizeText: `${skuDigits} gallon`, rung: null, gallons: skuDigits, kind: "tree", offLadder: false, reason: null, sku, unreadText: null };\n  const read = readProductFromDescription(item.description);' },
  { id: 'B2', target: LIB,
    why: '🔴 an unreadable size is silently treated as "no size stated" — it stops being flagged',
    from: "    case 'unreadable':\n      return { ...base, kind: 'unresolved',",
    to:   "    case 'unreadable':\n      return { ...base, kind: 'no_size_stated'," },
  { id: 'B4', target: LIB,
    why: 'a 40 lb bag is counted as a tree — goods earn mix, stakes and a bubbler',
    from: "      return { ...base, kind: 'not_loaded', reason: `Not one of the things this sheet carries — sold by ${r.unit}",
    to:   "      return { ...base, kind: 'tree', reason: `Not one of the things this sheet carries — sold by ${r.unit}" },
  { id: 'B5', target: LIB,
    why: 'the lot\'s own size column stops being read — every checkout line reads as "no size"',
    from: '  if (lotName) return classify(quantity, lotName, lotSize, sku, ladder);',
    to:   '  if (lotName) return classify(quantity, lotName, null, sku, ladder);' },
  { id: 'B6', target: LIB,
    why: '🔴 the resolver is handed a ladder with its ALIASES stripped — "cuttings" stops being a slip. A size the parser cannot read is exactly what an alias is for.',
    from: '  const r = resolveRung(ladder, sizeText);',
    to:   '  const r = resolveRung(ladder.map(x => ({ ...x, aliases: [] })), sizeText);' },
  { id: 'B7', target: LIB,
    why: '🔴 trees consolidate by the TEXT, not the RUNG — "#3" and "5 gal" print as two rows of one bucket',
    from: '    const k = treeKey(it.name, it.rung);',
    to:   '    const k = treeKey(it.name, it.rung) + "|" + it.sizeText;' },

  // ══ 🔴 §C THE OMISSIONS — the class this page exists to prevent ═══════════════════════
  { id: 'C1', target: LIB,
    why: '🔴🔴 AN UNRESOLVED LINE IS FILTERED OFF THE PAGE — a blank the yard person reads as a zero',
    from: "  const unresolved = allItems.filter(i => i.kind === 'unresolved');",
    to:   '  const unresolved = [];' },
  { id: 'C2', target: LIB,
    why: '🔴🔴 AN OFF-LADDER TREE DROPS OUT OF THE DAY\'S TREE COUNT — "7 gallon" trees get no bubbler and the total reads complete',
    from: '    treeCount: trees.reduce((n, t) => n + t.quantity, 0) + offLadderTreeCount,',
    to:   '    treeCount: trees.reduce((n, t) => n + t.quantity, 0),' },
  { id: 'C2b', target: LIB,
    why: '🔴 an off-ladder line stops being MARKED off-ladder — it prints as an ordinary unreadable line and is not counted as a tree',
    from: "        ...base, kind: 'unresolved', offLadder: true, unreadText: sizeText,",
    to:   "        ...base, kind: 'unresolved', offLadder: false, unreadText: sizeText," },
  { id: 'C2c', target: LIB,
    why: '🔴🔴 AN OFF-LADDER SIZE IS SILENTLY DROPPED — "7 gallon" becomes "no size stated", the exact omission David named',
    from: "        ...base, kind: 'unresolved', offLadder: true, unreadText: sizeText,",
    to:   "        ...base, kind: 'no_size_stated', offLadder: false, unreadText: sizeText," },
  { id: 'C3', target: LIB,
    why: '🔴 the FLOOR warning never fires',
    from: '    totalsAreFloors: unresolved.length > 0 || unreadStops > 0 || noVolumeTrees.length > 0 || plantOnSite.length > 0,',
    to:   '    totalsAreFloors: false,' },
  { id: 'C3b', target: LIB,
    why: '🔴 an unreadable STOP stops raising the floor',
    from: '    totalsAreFloors: unresolved.length > 0 || unreadStops > 0 || noVolumeTrees.length > 0 || plantOnSite.length > 0,',
    to:   '    totalsAreFloors: unresolved.length > 0 || noVolumeTrees.length > 0 || plantOnSite.length > 0,' },
  { id: 'C3c', target: LIB,
    why: '🔴 a size with NO VOLUME stops raising the floor — its mix is missing and the total reads complete',
    from: '    totalsAreFloors: unresolved.length > 0 || unreadStops > 0 || noVolumeTrees.length > 0 || plantOnSite.length > 0,',
    to:   '    totalsAreFloors: unresolved.length > 0 || unreadStops > 0 || plantOnSite.length > 0,' },
  { id: 'C3d', target: LIB,
    why: '🔴 a rung with no volume is given one — a slip is mixed as a 15 gallon, a number nobody entered',
    from: '      mixGallonsPerTree: v == null ? null : v * s.ops.installMixContainerVolumesPerTree,',
    to:   '      mixGallonsPerTree: (v ?? 15) * s.ops.installMixContainerVolumesPerTree,' },
  { id: 'C4', target: LIB,
    why: '🔴 A WITHHELD ORDER READS AS AN EMPTY ONE',
    from: "      : !s.canReadLines ? 'You do not have permission to see what is on this order.'",
    to:   "      : !s.canReadLines ? 'No items are recorded on this order.'" },
  { id: 'C5', target: LIB,
    why: '🔴 A FAILED READ READS AS AN EMPTY ORDER',
    from: "      : !s.linesRead    ? 'We could not read what is on this order — this stop may need more than is listed.'",
    to:   "      : !s.linesRead    ? 'No items are recorded on this order.'" },
  { id: 'C6', target: LIB,
    why: '🔴🔴 A STOP WITH NOTHING ON IT IS DROPPED FROM THE DAY',
    from: '  for (const s of input) {',
    to:   '  for (const s of input.filter(x => x.items.length > 0)) {' },
  { id: 'C7', target: LIB,
    why: '🔴 the unread-stop count stops being kept',
    from: '    if (problem && s.orderId && (!s.canReadLines || !s.linesRead)) unreadStops++;',
    to:   '    // not counted' },
  { id: 'C8', target: LIB,
    why: '🔴🔴 A LINE NOBODY RECOGNISES IS TREATED AS A KNOWN NON-LOAD LINE — the allow-list turned into a silent filter, which is the one way David\'s rule can go wrong: an unreadable TREE disappears with the fees',
    from: "    return { ...base, kind: 'unresolved', reason: 'No container size on this line, and we do not recognise it — check it before you load.' };\n  }\n\n  const r = resolveRung(ladder, sizeText);",
    to:   "    return { ...base, kind: 'not_loaded', reason: 'No container size on this line, and we do not recognise it — check it before you load.' };\n  }\n\n  const r = resolveRung(ladder, sizeText);" },
  { id: 'C11', target: LIB,
    why: '🔴 the allow-list runs AFTER the description reader again — "Military Discount 5%" goes back to printing as an unreadable size (the defect that made step 0 exist)',
    from: '  const label = item.business_inventory?.name?.trim() || item.description?.trim() || \'\';\n  if (label || sku) {',
    to:   '  const label = item.business_inventory?.name?.trim() || item.description?.trim() || \'\';\n  if (false) {' },
  { id: 'C12', target: LIB,
    why: '🔴 TRUNK PROTECTION STOPS BEING COUNTED — it is on David\'s list and would vanish from the trailer',
    from: "      trunkProtection: items.filter(i => i.kind === 'trunk_protection').reduce((n, i) => n + i.quantity, 0),",
    to:   '      trunkProtection: 0,' },
  { id: 'C13', target: LIB,
    why: '🔴🔴 PLANT YOUR TREE IS DROPPED AS A FEE — the crew plants nine and the sheet says nothing about the ninth (David, 2026-09-17: it is WORK, not a fee)',
    from: "    if (matches(PLANT_ON_SITE, label, sku)) {\n      return { ...flat, kind: 'plant_on_site',",
    to:   "    if (matches(PLANT_ON_SITE, label, sku)) {\n      return { ...flat, kind: 'not_loaded'," },
  { id: 'C9', target: LIB,
    why: '⚠️ the deer-fence gap sentence stops saying nothing is recorded',
    from: "    'DEER FENCE — nothing recorded. Nothing in the system marks which stops need deer fence, so no fence posts are counted above. '",
    to:   "    'DEER FENCE. '" },
  { id: 'C10', target: LIB,
    why: '🔴🔴 THE UNKNOWN FENCE STOPS STOP BEING COUNTED — the UNRESOLVED block loses its fence line and the day reads as settled',
    from: "    if (fence === 'unknown' && sums.treeCount > 0) deerFenceUnknownStops++;",
    to:   '    // not counted' },

  // ══ §E DEER FENCE — "in total", and never guessed ═════════════════════════════════════
  { id: 'E1', target: LIB,
    why: '🔴 fence ADDS its full figure instead of bringing the tree to it — a 45 gallon gets 4 more posts, not 2',
    from: '      : trees.reduce((n, t) => n + Math.max(0, s.ops.deerFenceTPostsPerTree - t.tPosts) * t.quantity, 0),',
    to:   '      : trees.reduce((n, t) => n + s.ops.deerFenceTPostsPerTree * t.quantity, 0),' },
  { id: 'E2', target: LIB,
    why: '🔴🔴 FENCE POSTS ARE INVENTED FOR STOPS NOBODY MARKED — every unknown stop is fenced by assumption',
    from: "    deerFencePosts: fence !== 'yes' ? 0",
    to:   "    deerFencePosts: fence === 'no' ? 0" },

  // ══ §D CONSOLIDATION ══════════════════════════════════════════════════════════════════
  { id: 'D1', target: LIB,
    why: 'two identical trees stop consolidating',
    from: '    if (existing) { existing.quantity += it.quantity; continue; }',
    to:   '    if (existing) { continue; }' },
  { id: 'D2', target: LIB,
    why: '🔴 the per-tree quantity is ignored in the mix — an order for 6 trees contributes one tree\'s mix',
    from: '    mixGallons: trees.reduce((n, t) => n + (t.mixGallonsPerTree ?? 0) * t.quantity, 0),',
    to:   '    mixGallons: trees.reduce((n, t) => n + (t.mixGallonsPerTree ?? 0), 0),' },
  { id: 'D2b', target: LIB,
    why: '🔴 the per-tree quantity is ignored in the posts',
    from: '    tPosts: trees.reduce((n, t) => n + t.tPosts * t.quantity, 0),',
    to:   '    tPosts: trees.reduce((n, t) => n + t.tPosts, 0),' },
  { id: 'D3', target: LIB,
    why: 'the consolidated list stops being ordered by the ladder, biggest first',
    from: '  return [...by.values()].sort((a, b) => b.sortOrder - a.sortOrder || a.name.localeCompare(b.name));',
    to:   '  return [...by.values()];' },
  { id: 'D4', target: LIB,
    why: '🔴 a stop stops carrying its OWN mix — which is what breaks when a stop gets dropped',
    from: '      mixGallons: sums.mixGallons,',
    to:   '      mixGallons: 0,' },
  { id: 'D5', target: LIB,
    why: '🔴 a stop\'s own yards stop being computed — the page would have to type a conversion again',
    from: '      mixYards: toHalfYards(sums.mixGallons, settings),',
    to:   '      mixYards: 0,' },

  // ══ §H THE RING ([[R-156]]) ═══════════════════════════════════════════════════════════
  { id: 'H1', target: LIB,
    why: '🔴 an anchor moves — 95 gallon reads 10 ft instead of 12',
    from: "  { gallons: 95, diameterFeet: 12 },",
    to:   "  { gallons: 95, diameterFeet: 10 }," },
  { id: 'H2', target: LIB,
    why: '🔴🔴 THE TABLE RETURNS, ONE QUANTITY OVER — a five-row ring lookup',
    from: '  const g = gallons > 0 ? gallons : 0;\n  return RING_FIT.a * Math.sqrt(g) + RING_FIT.b;',
    to:   '  const RING_TABLE = { 15: 5, 30: 7, 45: 8, 65: 10, 95: 12 };\n  return RING_TABLE[gallons] ?? 0;' },
  { id: 'H3', target: LIB,
    why: '🔴 THE CURVE GOES LINEAR',
    from: '  return RING_FIT.a * Math.sqrt(g) + RING_FIT.b;',
    to:   '  return RING_FIT.a * g + RING_FIT.b;' },
  { id: 'H4', target: LIB,
    why: '🔴 the fit is pinned to ONE anchor instead of fitted THROUGH both',
    from: '  const a = (hi.diameterFeet - lo.diameterFeet) / (Math.sqrt(hi.gallons) - Math.sqrt(lo.gallons));\n  return { a, b: lo.diameterFeet - a * Math.sqrt(lo.gallons) };',
    to:   '  void hi;\n  return { a: lo.diameterFeet / Math.sqrt(lo.gallons), b: 0 };' },
  { id: 'H5', target: LIB,
    why: '🔴 fence becomes the DIAMETER rather than the circumference',
    from: '  return Math.PI * ringDiameterFeet(gallons);',
    to:   '  return ringDiameterFeet(gallons);' },
  { id: 'H6', target: LIB,
    why: '🔴 a rung with no volume is given a 0 ft ring — a zero that reads as measured',
    from: '      ringDiameterFeet: v == null ? null : ringDiameterFeet(v),',
    to:   '      ringDiameterFeet: v == null ? 0 : ringDiameterFeet(v),' },

  // ══ §V THE FIGURES USED — the page must print what it multiplied by ═══════════════════
  { id: 'V1', target: LIB,
    why: '🔴 the printed mix figure says 1 while the arithmetic used 2 — a page that states a figure it did not use',
    from: '      installMixContainerVolumesPerTree: settings.ops.installMixContainerVolumesPerTree,',
    to:   '      installMixContainerVolumesPerTree: 1,' },
  { id: 'V2', target: LIB,
    why: 'the printed rungs lose their posts source',
    from: "      seen.set(t.rungLabel, { label: t.rungLabel, volumeGallons: t.gallons, tPosts: t.tPosts, tPostsBecause: t.tPostsBecause });",
    to:   "      seen.set(t.rungLabel, { label: t.rungLabel, volumeGallons: t.gallons, tPosts: t.tPosts, tPostsBecause: '' });" },

  // ══ ⚠️ §P REACH — do the probes see the PAGE, or only the model? ══════════════════════
  { id: 'P1', target: PAGE,
    why: '⚠️ REACH, NOT SUBJECT — the page stops rendering the unresolved block. EXPECTED TO SURVIVE the model suite; caught by loadListPage.test.ts.',
    from: '              {model.unresolved.length > 0 ? (',
    to:   '              {false ? (' },
  { id: 'P5', target: PAGE, suite: PAGE_SUITE,
    why: '🔴 the deer-fence rule goes back to being a line per stop in the unresolved block (David, 2026-09-17: a rule, printed once at the top)',
    from: "              {model.unresolved.length > 0 ? (",
    to:   "              {model.deerFenceUnknownStops > 0 ? <div>Deer fence — stops</div> : null}\n              {model.unresolved.length > 0 ? (" },
  { id: 'P2', target: PAGE, suite: PAGE_SUITE,
    why: '🔴 the page loses its "could not read sizes" state — a failed ladder read prints as an ordinary day with every tree unresolved and no reason at the top',
    from: "        {settingsRead?.sizes === 'failed' ? (",
    to:   '        {false ? (' },
  { id: 'P3', target: PAGE, suite: PAGE_SUITE,
    why: '🔴 the page stops printing the figures it used',
    from: '            {model.valuesUsed.rungs.map(r => (',
    to:   '            {[].map(r => (' },
  { id: 'P6', target: PAGE, suite: PAGE_SUITE,
    why: '🔴 the deer-fence block prints on every day again — David, 2026-09-17: nothing unless a stop records it',
    from: "              {model.stops.some(st => st.deerFence === 'yes') ? (",
    to:   '              {true ? (' },
  { id: 'P7', target: PAGE, suite: PAGE_SUITE,
    why: '🔴 every recognised charge and discount prints on its stop again — the "too confusing" sheet David sent back',
    from: "                {s.items.filter(i => i.kind !== 'not_loaded' && i.kind !== 'plant_on_site')",
    to:   '                {s.items.filter(() => true)' },
  { id: 'P4', target: PAGE, suite: PAGE_SUITE,
    why: '🔴 the per-stop yards are re-typed in the page — the second conversion the model now owns',
    from: '                  {s.mixYards} yd mix ·{\' \'}',
    to:   '                  {Math.ceil((s.mixGallons / 201.974025974) * 2) / 2} yd mix ·{\' \'}' },
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
    const green = suiteIsGreen(m.suite ?? SUITE);
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
